# pipeline/ — 零依赖整片模板（v0.9）

把律师口播变成成片的**可照抄流水线**：`film.config.js 配置 → render.cjs 逐帧截图 → compose.sh 合成`。
不用 Remotion、不用 npm install，只需要本机 **Edge/Chrome + Node ≥ 22 + ffmpeg + python3**。
所有素材只在本机处理，不上传任何第三方服务。

**什么时候用这个模板**：环境装不了 Remotion、或模型不熟悉 React 时的默认整片路线。
Remotion 路线（references/remotion.md）功能等价，二选一，不要混用。
本模板已内置 v0.4 评审发现的全部坑的修复：

| 旧坑 | 本模板的修法 |
|---|---|
| 镜头全程固定缩放，画面像幻灯片 | 每镜头 `camera` 字段（camera.js preset），验收会查 transform |
| 背景单调白纸 | 每镜头 `bg` 字段（6 种场景底），验收会查 |
| 镜头之间硬切 | film.html 双缓冲交叉淡化（`transition` 帧数），帧级确定性 |
| `hold<1` 导致结尾冻结 | t01 = local/(frames-1)，最后一帧恰好完成，禁止 hold 参数 |
| 数字一闪而过 / 累加合计乱跳 | 配置层约束 + delivery-qa.md 的停帧抽查（见 SKILL.md §0.5） |
| 没有音效/干口播 | 声音两层：events.json（动作接触/冲击音）+ assets/sfx 真实录音库 + mix_sound.py，无 BGM，见 references/sound.md |
| 合成音"电子味"被用户否掉 | v0.7 起默认换真实素材：CC0 录音音效；make_sfx 降级离线兜底 |
| 律师只要音效不要背景音乐 / 翻页有"呼"声 | v0.8 删除 BGM 全链路与 whoosh：转场/翻页静音，只留接触/冲击音效 |
| 真人小窗太大/源画幅不一 | v0.9 源非 3:4 自动裁 3:4 以人物为中心，默认 300×400 左下角小窗 |
| 观众不知道讲到哪 / 律师要进度条 | v0.9 章节进度条：AI 读口播稿生成 chapters.json，顶部灰框分格+高亮+进度线 |
| 分镜文档与代码漂移 | 单一 STORYBOARD.md → film.config.js 一一对应 |

## 0. 前置检查

```bash
node -v        # ≥ 22（需要内置 WebSocket）
ffmpeg -version
ffprobe -version
python --version   # 3.8+；音效脚本用
```

浏览器：自动找 Edge/Chrome；找不到时用 `BROWSER_PATH="路径" node render.cjs` 指定。

## 1. 建工程并复制文件

在**用户授权的目录**建案件工程（例如 `D:/案件视频/某某案/`），复制以下文件到工程根目录：

```
来自 Skill 根目录：  kit.js  camera.js  actions.js
来自 pipeline/：     film.html  film.config.js  case-actions.js  render.cjs  compose.sh
来自 scripts/：      mix_sound.py  make_sfx.py   → 放到工程的 scripts/ 子目录
来自 assets/：       sfx/（真实录音库整目录）   → 放到工程的 assets/ 子目录
```

复制后工程结构：

```
案件工程/
├── kit.js  camera.js  actions.js        # 资产库（只读，不改）
├── film.html  film.config.js  case-actions.js
├── render.cjs  compose.sh
├── scripts/mix_sound.py  scripts/make_sfx.py
├── assets/sfx/（7 音套件 + lib/ + manifest.json + LICENSES.md）
├── voice.wav  captions.ass  person.mp4  # 案件素材（下一步准备）
├── chapters.json                        # 可选：章节进度条（AI 读口播稿生成，见 §5）
└── out/                                 # 成片输出
```

**不要改 kit.js/camera.js/actions.js 来适配案件**——案件差异全部写在 film.config.js 和 case-actions.js。

## 2. 准备声音与字幕

```bash
# 口播视频 → 音频（原声只保留这一份，后面不要再叠同源音轨）
ffmpeg -i 口播视频.mp4 -vn -ac 1 -ar 48000 voice.wav
# 总时长（填进 film.config.js 的 voiceDuration）
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.wav
# SRT → ASS（字幕内容必须先逐句校对，见 references/workflow.md 第二节）
ffmpeg -i captions.srt captions.ass
```

字幕样式建议：单 Main 样式、白字黑边、底部居中；**有真人小窗时 MarginV ≥ 460**（避免压到左下角 300×400 小窗）。
竖屏 9:16 时字幕放在下方安全区，上方 40% 留给标题（见 SKILL.md §5）；顶部章节条（如有）占 88px，与安全区不冲突。

## 3. 填 film.config.js（从 STORYBOARD.md 逐行翻译）

先有覆盖完整口播的 STORYBOARD.md（references/workflow.md 第三节），再一行一行翻译成 shots：

| 分镜表字段 | film.config.js 字段 |
|---|---|
| 起止时间 | `dur` = 结束 − 开始（秒）；所有 dur 之和 = 口播总时长 |
| 动作 id（roster.md） | `act` |
| 剧情地点 | `bg`：home/court/register/office/warehouse/paper |
| 镜头设计（camera.md） | `camera`：push/hold/impact/pan/breathe/off |
| 焦点（数字/文书位置） | `focus: [x, y]`（设计空间 1080×800，可省略=自动锚点） |
| 音效事件 | 默认用动作内置 events；`sfx: []` 静音本镜头 |

**硬性要求（验收会查）：**
- 不允许全片 `camera: 'off'`；不允许全片 `bg: 'paper'`。
- 数字/金额镜头用 `camera: 'hold'` 并 `focus` 指向数字位置。
- 敲槌/盖章/摔碎镜头用 `camera: 'impact'`，事件秒点对齐口播。
- 金额、法条、日期只用稿件值（SKILL.md §0.2）。

自定义动作写 case-actions.js（文件内有示例），注册后 `act` 用其 id。

## 4. 声音素材（v0.8 默认真实音效，无 BGM，无需生成）

- **音效**：随模板复制的 `assets/sfx` 就是真实录音库（CC0 为主，7 音套件 + lib/ 100 条备选，
  来源与许可见 assets/sfx/LICENSES.md）。mix_sound.py 按 events 的语义名自动取用并解码 ogg/wav。
  换音/加音见 assets/sfx/README.md。离线兜底才跑 `python scripts/make_sfx.py --out assets/sfx-synth`
  （合成音，混音改 --sfx-dir 指向它，交付须声明）。
- **无 BGM**：律师要求只要音效、不要背景音乐。compose.sh 不再下载/合成 BGM，mix_sound.py
  只混口播+音效（无 ducking）。**转场/翻页静音**：whoosh 已删除，events.json 只含动作内置
  接触/冲击音效（paper/ching/thud/stamp/crack/pop/scratch）；句间自然停顿合法。

规则与门禁见 [../references/sound.md](../references/sound.md)。

## 5. 章节进度条（v0.9，可选）

律师要求"视频加进度条"：顶部灰框横条分 N 格，每格 = 口播的一个章节，讲到哪格高亮哪格。

1. **AI 读完整口播稿/SRT**，按语义转折归纳 3~6 个章节，标签 ≤8 字（观众词，不用内部术语）。
2. 边界秒点取 SRT 句边界；口播变速过（如 1.1x）先换算到成片时间轴。
3. 写 `chapters.json` 到工程根目录（格式与完整流程见 [../references/chapters.md](../references/chapters.md)）：
   `{"position":"top","chapters":[{"label":"引言","start":0,"end":5.2}, ...]}`
4. `node render.cjs` 自动注入：格宽 ∝ 时长、当前格高亮、底部细进度线；条在转场之外不闪不淡。
5. 没有 chapters.json = 不画条（兼容 v0.8 旧工程）。compose.sh 无需改动。

验收：每章中间时刻停帧，高亮格 = 当时口播话题；进度线 ≈ 已播比例（chapters.md §3）。

## 6. 冒烟渲染（先渲 3 个镜头检查）

```bash
SHOT_LIMIT=3 node render.cjs
```

检查 `frames/00000.jpg` 等：构图完整、人物接物正确、场景底出现、镜头有推拉；
有 chapters.json 时顶部章节条出现、首格高亮。**这一步必须实际打开图片看**，不能只看日志。
有问题改 film.config.js 后删掉 frames/ 重渲。

## 7. 全量渲染

```bash
node render.cjs
```

- 断点续渲：已有帧自动跳过；中断后重跑同一命令即可。
- 产出 `frames/%05d.jpg`（全局序列，含转场帧）、`events.json`、`film.info.json`（有章节条时附带 chapters）。
- 开头会跑 ASSET_CHECK：7 相位 + NaN 检查 + 镜头 transform 检查，不过不渲。
- 若日志出现 `WARN 画面总时长 < 口播`，回 film.config.js 补 dur，删 frames/ 重渲。

## 8. 合成成片

改 compose.sh 顶部「案件配置」（NAME/ORIENT_LABEL/FPS/VOICE/PERSON/CAPTIONS，
真人小窗另有 PERSON_W/PERSON_CY/PERSON_POS），然后：

```bash
bash compose.sh
```

- 有 events.json + assets/sfx 时自动混音（口播+音效，音效音量 0.5，不压口播；ogg/mp3 自动 ffmpeg 解码）。
- 无 BGM、无 ducking（律师要求只要音效）；转场/翻页静音（whoosh 已移除）；句间自然停顿合法。
- PERSON 留空 = 纯动画；填路径 = 真人 3:4 小窗（v0.9）：
  - 源非 3:4 自动裁 3:4：宽源水平居中裁两侧；窄源按 PERSON_CY（默认 0.30）纵向锚定脸部。
  - 默认 300×400 左下角（PERSON_W 调大小、PERSON_POS 调位置）；循环播放，声音忽略。
  - 裁切后必须抽帧目检：脸完整在窗内、不切头顶/下巴（PERSON_CY 取 0.25~0.40 微调）。
- 响度统一 loudnorm I=-16；首尾 0.35s/0.6s 淡入淡出。
- 输出 `out/<NAME>_<ORIENT_LABEL>.mp4`——文件名必须与配置一致，别手改 OUT。

## 9. 验收（不通过不交付）

按 references/delivery-qa.md 执行，至少包括：

```bash
# 冻结门禁：任何 ≥0.5s 的静止段都要解释（合法静止只有结尾淡出前）
ffmpeg -i out/成片.mp4 -vf freezedetect=n=-60dB:d=0.5 -f null - 2>&1 | grep freeze
# 音效门禁：峰值不过载 + events.json 无 whoosh（转场/翻页静音）；句间静音合法（无 BGM）
ffmpeg -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "Peak level"
# 时长/分辨率核对
ffprobe -v error -show_entries format=duration:stream=width,height -of json out/成片.mp4
```

再实听实看：开头/经过/解释/收尾各抽一段连续播放；关键数字停帧核对稿件值；
转场处逐帧看有无跳变。检查记录写进工程（QA.md），交付时说明已做与未做。

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| `DevTools 端口未就绪` | 浏览器被占用/安全软件拦截；换 `PORT=8736`，或 BROWSER_PATH 换浏览器 |
| `合成页未就绪` | film.html 脚本加载失败：检查 kit.js/camera.js/actions.js/case-actions.js/film.config.js 是否齐全、film.config.js 语法（node --check） |
| ASSET_CHECK 报 `找不到动作 id` | 拼写错误，或自定义动作没在 case-actions.js 用 def() 注册 |
| ASSET_CHECK 报 camBad | 该镜头 camera 写了 off 以外的值但 transform 没生效——检查 camera.js 是否复制到位 |
| 画面 NaN/undefined | 动作代码写了画布坐标字面量；场景字面量必须过 X()/Yg()/Ys()（studio.md §8） |
| 成片结尾画面不动 | dur 之和 < 口播时长；补镜头时长重渲 |
| 转场太频繁/太慢 | 调 FILM.transition（帧数）；不要超过最短镜头帧数的一半 |
| 字幕压到真人小窗 | captions.ass 的 MarginV 加到 ≥ 460 |
| 章节条没出现 | chapters.json 不在工程根目录 / JSON 语法错 / chapters 为空；看 render.cjs 日志 chapters=off |
| 章节高亮与口播对不上 | 边界秒点没换算变速系数或章节脱离语义；按 references/chapters.md 重划 |
| 真人小窗切到头顶/下巴 | PERSON_CY 微调（0.25~0.40）；宽源人物不居中时改 crop x 表达式 |
| 渲染很慢 | 正常：1080p 约 3–8 帧/秒。900 帧自动重启浏览器；可断点续渲 |
| 合成极慢/画面卡在约 1 秒 | 个别 ffmpeg 构建的 aac 在"纯数字静音+衰减尾音"上掉进 denormal 浮点陷阱（慢约百倍）。compose.sh 已混入 -86dBFS 不可闻抖动噪声消除；自改音频链路时务必保留那路 amix |
| 成片干巴巴/完全无音效 | 音轨只 map 了原声（自建引擎常见）。按 references/sound.md 引擎无关强制补 mix_sound 链路（口播+音效），音轨用 mixed.wav |
| 翻页/转场还有"呼"声 | 用了旧模板（render.cjs 自动 whoosh / 旧 actions.js / 旧 sfx 库）；更新到 v0.8，删 frames/ 重渲 events |
| mix_sound 报 sfx_missing | events 引用了 assets/sfx 根目录没有的名字；按 assets/sfx/README.md 补音或改 events |