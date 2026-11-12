# 声音设计（v0.7）——口播 + 真实曲目 BGM + 真实录音音效

三次真实反馈驱动的板块：v1 成片"画面静态"由 v0.5 镜头/场景底解决；v0.5 重跑成片
"没有音效、听起来不够带感"→ v0.6 补齐三层链路；v0.6 重跑后用户反馈**程序化合成音
"效果不太好"** → v0.7 换真实素材：音效 = CC0 真实录音库（assets/sfx），BGM = Mixkit
真实曲目运行时下载（fetch_bgm.py）。合成音降级为离线兜底。
**只参考方法论，不抽取任何参考片的音频/音乐**（版权）。

核心结论：BGM 不是可选的背景板，而是口播的情绪提升；干口播 + 零星音效仍然"不带感"。
成片音频必须三层齐全：**口播（事实与清晰度）+ BGM（情绪与节奏）+ 音效（动作与冲击）**。
优先级：**口播 > 音效 > BGM**——任何两层冲突时先保口播清晰，再保音效可闻，最后让音乐。

## 三层模型与响度契约

| 层 | 角色 | 响度（相对口播活跃 RMS） | 实现 |
|---|---|---|---|
| 口播 | 唯一事实来源，只播一次 | 基准；成片 loudnorm I=-16:TP=-1.5:LRA=11 | voice.wav |
| BGM | 情绪提升、节奏骨架、掩盖口播小瑕疵 | 间隙 ≈ −7dB；说话时 ≈ −17dB（自动 ducking） | fetch_bgm.py 真实曲目 / 授权音乐 / make_bgm.py 兜底 + mix_sound.py |
| 音效 | 动作接触/冲击/转场的可闻反馈 | gain 0.5，不压口播 | assets/sfx 真实录音库 + events.json + mix_sound.py |

mix_sound.py 用口播 RMS 包络（50ms 窗、attack 30ms、release 200ms、hangover 300ms——
词间/句间短停顿不触发抬头）自动生成 BGM 音量自动化，逐样本混音。混音本身纯 Python
标准库、与渲染引擎无关；ogg/mp3/flac 素材（真实库默认 ogg）用 ffmpeg 解码到临时 wav
（ffmpeg 本就是合成路线必备依赖，可用环境变量 FFMPEG 指定路径）。

## 规则 1 · 情绪提升：BGM 默认必加，默认真实曲目

- 默认 `bgm: 'auto'` = **fetch_bgm.py 按章节 mood 下载 Mixkit 真实曲目**组装 bgm.wav。
  网络失败自动回退 make_bgm.py 合成曲，**交付时必须声明是合成兜底**。
  `synth` = 直接合成（离线环境）；`off` = 无 BGM（仅用户明确说不要音乐，且交付声明）；
  填路径 = 用户自有授权音乐。"可不加音乐"的旧口径作废。
- 按章节选 mood（选曲清单 assets/bgm/catalog.json，每 mood 两首备选）：
  - `serious`：影视感/暗色氛围（Other World、Cyberpunk City）。案情讲述、严肃事实。
  - `steady`：中性舒缓（Your Breath、Pilates and Yoga）。法律分析、方法讲解。
  - `upbeat`：轻快律动（It's Love、Tech House vibes）。收尾、行动号召、节奏提速段。
  - 换曲：`--tracks '{"serious":140}'` 或改 catalog；新增曲目须先核对许可（见版权节）。
- 口播语气平、感染力弱时，BGM 承担情绪。不要靠提高口播音量或加夸张音效补情绪。

## 规则 2 · 音量的配比：自动化，不手调

- 数值契约见上表（−7 / −17）。mix_sound.py 自动执行；**不要**用固定音量把 BGM 全程
  压死或全程顶满，也不要逐句手调。
- 口播永远最清晰：任何时刻 BGM+音效不得掩蔽口播（听检 + 门禁 3 验证）。
- 音效 gain 0.5；密集音效处若压口播，降该镜头音效而不是降口播。
- fetch_bgm.py 先把每段曲目 RMS 校准到 0.12 再交给 ducking，章节间响度一致。

## 规则 3 · 关键节奏：金句/数字/开头落拍

- **合成兜底曲**：拍网格 `t = n × 60 / bpm`（make_bgm.py 打印 beat 秒值；mood 默认
  76/96/124 BPM）。写分镜时把开头第一帧、关键数字揭示、金句 chip 落下的 revealAt /
  events 秒点对齐最近拍点（±0.15s 内微调画面事件去就音乐，不要为落拍改口播时间）。
- **真实曲目**：曲子自带节拍，不硬套公式。要落拍时用 librosa
  (`librosa.beat.beat_track`) 或耳听找出重拍秒值，再对齐画面事件；找不到稳定拍点
  就不强求——情绪到位优先于机械落拍。
- 数字到账的 `ching`、敲槌的 `thud/stamp` 尽量落在重拍；转场 whoosh 由 render.cjs
  自动贴在镜头边界前 0.2s（画面同步优先）。
- 节奏舒服能掩盖口播小瑕疵，但法律事实读音不得改。

## 规则 4 · 分段铺设：让视频呼吸

- `sections` 与 STORYBOARD 章节边界对齐：案情→分析→收尾 至少两次 mood 切换
  （96s 以上的片子禁止单一 mood 到底）。
- **真实曲目**：fetch_bgm.py 在章节边界做 0.8s 线性交叉淡化（不是静音——静音会触发
  连续性门禁，也切断情绪）；曲目不够长自动循环（接缝 0.05s 微淡化）。
- **合成兜底**：make_bgm.py 边界 0.5s「小停顿」呼吸（dip 到 30%，不是静音）。
- 首尾淡入 0.4s / 淡出 0.8s 已内置（fetch_bgm）；与画面 fade 同步收尾。

## 音效层：真实录音库，密度与触发点

- **默认 8 音真实录音套件**（assets/sfx 根目录，CC0 为主，来源见 assets/sfx/LICENSES.md）：
  whoosh 挥动/转场、paper 纸张/翻面、ching 金钱/到账、thud 重物落地、stamp 盖章、
  crack 碎裂/撕毁、pop 气泡/出现、scratch 书写/划动。
- **lib/ 114 条备选**（impact/ding/riser/glitch/typing/…），manifest.json 逐条登记
  来源与许可。换音：把选中的 lib 录音复制到 sfx 根目录按事件命名，或自有授权音频
  同名覆盖（wav/ogg/mp3/flac 均可，mix_sound 自动解码）。
- **每镜头 ≥ 1 个音效**：pipeline 的 render.cjs 自动在每个镜头边界贴 whoosh（含开头），
  动作内置 events 再叠加接触点音效。`sfx: []` 可静音单镜头（慎用）。
- 触发点对齐实际接触/动作完成帧（主库 `events[].at × dur`），不是每个字幕都配。
- events 引用了根目录不存在的名字 → mix_sound 计入 `sfx_missing` 跳过；**交付前必须清零**。
- 离线兜底：make_sfx.py 合成音产出到 assets/sfx-synth（不覆盖真实库），
  混音 `--sfx-dir assets/sfx-synth`，交付须声明。
- 预览台 app.js 的音效是 WebAudio 即时合成近似音，只听个响；质感以成片混音为准。

## 版权与来源（v0.7 重点）

- **音效库**：112 条 CC0 1.0（可商用/修改/再分发，无需署名）+ 2 条 MIT 合成音
  （ching/stamp，来自 kmilo93sd/agent-video-editor，MIT 声明已存 assets/sfx/LICENSES.md）。
  来源仓库：Barty-Bart/motion-graphics（内置 CC0 录音）、kmilo93sd/agent-video-editor。
- **BGM（Mixkit Stock Music Free License，2026-10-13 核对）**：在线视频商用免费、
  无需署名；**禁止再分发原文件、禁止纯音乐发布、禁止 remix、禁止 Content ID 注册**。
  → mp3 只运行时下载到案件工程（bgm-src/），**绝不进公开仓库**；catalog.json 只存
  曲目 ID 与元数据。每个案件首次使用前打开 license_url 核对许可未变；fetch_bgm.py
  自动写 `bgm.credits.json`（曲目/作者/许可/核对日期/来源 URL），交付时随附。
- make_bgm.py / make_sfx.py 全部数学合成，零第三方素材，可商用（兜底用）。
- 用户提供的音乐须确认授权；**禁止**从抖音/平台视频抽音频当 BGM（参考片只学方法）。
- 私密口播/素材只在本机混音，不上传任何第三方服务。

## 引擎无关强制（防"自建引擎跳过声音"）

无论 pipeline / Remotion / 自建渲染引擎，都必须：
1. 产出 `events.json`（绝对秒点；自建引擎至少给每个镜头边界一个 whoosh）；
2. 跑 `fetch_bgm.py`（或授权音乐 / make_bgm.py 兜底）+ `mix_sound.py` 得到 `mixed.wav`；
3. 合成时音轨用 `mixed.wav`，**只 `-map` 原声 = 不合格**；
4. 成片过下面门禁。v0.5 重跑事故正是自建引擎只 map 原声导致全片无 BGM 无音效。

## 快速执行（pipeline 路线已内置，自建引擎照抄）

```bash
# 案件工程先复制 scripts/ 与 assets/（sfx 真实库 + bgm/catalog.json）
python scripts/fetch_bgm.py --dur 96.133 --config sound.json --out bgm.wav --cache-dir bgm-src
# 网络失败时 compose.sh 自动回退；手动兜底：
# python scripts/make_bgm.py --dur 96.133 --config sound.json --out bgm.wav
python scripts/mix_sound.py --voice voice.wav --events events.json \
    --sfx-dir assets/sfx --bgm bgm.wav --out mixed.wav
# 合成脚本音轨用 mixed.wav；最后 loudnorm=I=-16:TP=-1.5:LRA=11
```

## 可执行门禁（先跑命令再实听）

```bash
# 0) 许可台账：bgm.credits.json 存在且 license_checked 为近期日期；
#    mix_sound 输出无 sfx_missing（真实 BGM 路线）
# 1) BGM 连续性：-40dB/0.4s 静音段应为 0（合法例外：声明过的 ≤0.6s 呼吸，且呼吸是 dip 不是静音）
ffmpeg -i out/成片.mp4 -af silencedetect=n=-40dB:d=0.4 -f null - 2>&1 | grep -c silence_start
# 2) 无削波
ffmpeg -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "Peak level"
# 3) ducking 抽查：长间隙(≥0.6s)后半段（避开章节交叉淡化）与说话段各取 0.3–0.4s 窗，
#    BGM 层 RMS 差应 ≈ 6–12dB；说话段 BGM 至少比口播 RMS 低 12dB
#    （mixed.wav 减去 voice.wav 即 BGM+音效层；或直接听检间隙音乐抬头）
# 4) 音效可闻：events.json 任取 3 个秒点，±0.15s 窗 RMS 应明显高于相邻无事件窗
ffmpeg -ss 4.4 -t 0.4 -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "RMS level"
```

门禁 1 不为 0 → 没混 BGM 或 BGM 被静音，回 mix_sound 链路修；门禁 3 差值 < 6dB →
ducking 没生效或 BGM 太小，检查 --bgm 是否传入。

**人工听检（命令过了也不豁免）**：戴耳机听 5 个最高风险秒点——开头第一秒、章节切换
边界、关键数字 ching 处、音效最密集处、收尾淡出；再抽听开头/中段/收尾各一段，确认
情绪随章节变化、口播清晰、音效对齐动作、真实录音无爆音/截断。

## 常见问题

| 现象 | 处理 |
|---|---|
| 成片干巴巴、句间全静音 | 没走 mix_sound / 只 map 原声；按引擎无关强制补链路 |
| BGM 压口播 | 检查 ducking（−17dB）是否生效；不要手调固定音量 |
| 句间音乐不抬头 | 长间隙(≥0.6s)后半段应抬到 ≈−7dB；<0.3s 短停顿不抬是正常防 pumping；检查 hangover/release 是否生效 |
| 全片情绪一个味 | sections 没配；按章节切 mood |
| fetch_bgm FETCH_FAIL | 网络/代理问题：加 --proxy http://127.0.0.1:7897 重试；仍失败走合成兜底并声明 |
| 音效"电子味"重 | 误用了 assets/sfx-synth 兜底库；换回 assets/sfx 真实库 |
| ogg/mp3 解码报错 | ffmpeg 不在 PATH；设 FFMPEG 环境变量或安装 ffmpeg |
| 合成极慢/卡约 1 秒 | ffmpeg aac denormal 陷阱；保留 compose.sh 的 dither amix |