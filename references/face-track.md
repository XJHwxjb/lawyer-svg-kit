# 人脸追踪裁切（face-track）

手持 / 非固定机位素材的头会晃出固定裁切框。本流程把"晃动"翻译成一条设计过的运镜：
**离线检测 → 平滑 → 裁切关键帧 JSON → `TrackedVideo` 逐帧插值**。渲染期不跑模型，确定、可 scrub、可复渲，符合全库 `f(t)` 契约。

固定机位、人物基本不动的素材不需要本流程，直接固定裁切即可。

## 1. 安装与模型

```bash
pip install opencv-python numpy
```

- 检测器优先级：mediapipe（若已安装，需 Python ≤ 3.12）→ **YuNet**（默认）→ Haar（仅旧版 OpenCV 自带 xml 时）。
- YuNet 模型首次运行自动下载到 `~/.cache/face-track/face_detection_yunet_2023mar.onnx`（约 230KB）。
  下载源是 `media.githubusercontent.com`（opencv_zoo 走 Git LFS，github raw / contents API 只给指针）；
  网络受限时加 `--proxy http://127.0.0.1:7897`，或手动下载后用 `--model <path>` 指定。
- 全程本地运行，不上传任何画面。

## 2. 生成轨道

```bash
python scripts/face_track.py 案件视频.mp4 -o track.json --aspect 1.0 --debug-dir check/
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--aspect` | 1.0 | 裁切窗宽高比：1 = 方裁/圆裁，1.7778 = 横窗，0.5625 = 竖窗 |
| `--margin` | 4.0 | 裁切高 = 脸高 × margin（4 ≈ 胸口以上）；源素材更紧时自动 clamp 到源边界 |
| `--anchor` | 0.38 | 脸中心落在裁切窗高度的比例（上三分之一构图） |
| `--stride` | 2 | 每隔几帧检测一次；60fps 素材隔帧 = 30Hz 检测，足够 |
| `--score` | 0.5 | YuNet 置信度阈值；手持/模糊素材检出率低时降 0.3~0.4 |
| `--min-cutoff` / `--beta` | 0.6 / 0.4 | One-Euro 平滑：太小=飘，太大=抖 |
| `--window` | 0.25 | 中心平滑前后 lookahead 秒数 |
| `--debug-dir` | 无 | 写 5 张叠框检查图（绿=裁切框） |
| `--sendcmd` | 无 | 另写 ffmpeg sendcmd 命令文件（零依赖管线预裁切用） |

输出 JSON：

```jsonc
{
  "meta": { "fps": 60, "width": 1920, "height": 1080, "aspect": 1.0,
            "frame_count": 2642, "detector": "yunet", "detected_ratio": 1.0,
            "frame_unit": "source-video frames", "smoothing": {...} },
  "track": [ { "f": 0, "x": 447, "y": 0, "w": 1080, "h": 1080 }, ... ]  // 源视频帧号 + 源像素裁切框
}
```

**轨道以源视频帧计**，与合成 fps 无关；`TrackedVideo` 内部换算，不要在合成帧上直接查表。

## 3. 消费（两条路线二选一，与整片路线一致）

### Remotion 路线

```tsx
import {Sequence, staticFile} from 'remotion';
import {TrackedVideo} from '../remotion/TrackedVideo';
import track from './track/huang-square.json';

<Sequence durationInFrames={44 * 30}>
  <TrackedVideo
    src={staticFile('huang.mp4')}
    track={track}
    width={420} height={420}          // 宽高比必须等于 track.meta.aspect
    borderRadius="50%"                // 圆裁；方窗传 12 之类
    style={{position: 'absolute', left: 70, bottom: 70}}
  />
</Sequence>
```

- 组件内 `useCurrentFrame()` 是 Sequence 局部帧；素材有 trim 时传 `startFrom`（秒）。
- 窗内只放人物；字幕、姓名条、动画场景都在窗外层叠（见 [remotion.md](remotion.md) 整片骨架）。
- 纯函数 `cropAt(track, sourceFrame)` 单独导出，可用于自定义运镜或测试。

### 零依赖管线路线（pipeline/，默认推荐）

管线的人物小圆是 compose.sh 的 ffmpeg 叠加，不改模板：**先把人物视频预裁切成追踪版**，PERSON 填它。

```bash
python scripts/face_track.py person.mp4 -o track.json --aspect 1.0 --sendcmd track.cmd
ffmpeg -i person.mp4 -vf "sendcmd=f=track.cmd,crop=w=1080:h=1080:x=0:y=0" -an person-tracked.mp4
# compose.sh 顶部 PERSON=person-tracked.mp4（w/h 用 track.json 首点的值）
```

- sendcmd 时间轴 = 人物源视频秒，逐区间下发 crop 四参数；一次 ffmpeg pass 完成，确定可复跑。
- 预裁切后小圆叠加、循环、字幕 MarginV 等规则全部不变（pipeline/README.md §7）。
- Windows 下在工程目录内用**相对路径**跑这条 ffmpeg（盘符冒号会被 shell/滤镜转义弄坏）。

## 4. 验收

1. `detected_ratio ≥ 0.9`；偏低先降 `--score`，再考虑换 mediapipe。漏检帧已线性插值，但大面积漏检会漂。
2. `--debug-dir` 叠框图目视：绿框全程罩住头肩、不切脸。
3. 抽帧验证裁切数学（与组件同一公式）：
   ```bash
   ffmpeg -ss 22 -i 案件视频.mp4 -vf crop=1080:1080:563:0 -frames:v 1 spot.jpg
   ```
4. 平滑度：相邻关键点 dx 中位数应在个位像素；最大值偶发十几像素属手持正常，连续大跳=平滑不足。

## 5. 经验值

- **特写源（脸高 > 40% 画面高）**：方裁会 clamp 成"全高方窗水平滑动"，这是正确行为——上下已无裁切余量，追踪只负责水平跟随。
- **16:9 源 + 16:9 窗**：裁切≈全帧，追踪收益很小；横屏整片里人物窗优先选**方裁/圆裁**，追踪才真正藏掉杂背景。
- 追踪只解决构图漂移，不解决光线与背景观感；后者靠轻调色（对比/暖调）与窗外设计层。
- 平滑参数一轮调参即可定稿：先默认，看叠框与抽帧，飘就加 `--window`，抖就加 `--beta`。

## 6. 隐私

track JSON、叠框图、抽帧都含当事人/律师肖像：**只放用户授权的案件目录**（如 `D:/律师skill开发/track/`），
不进 Skill 仓库、不上传第三方服务。仓库只收脚本、组件与本文档。