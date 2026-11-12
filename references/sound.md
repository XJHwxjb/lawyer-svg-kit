# 声音设计（v0.6）——口播 + BGM + 音效三层

两次真实反馈驱动的板块：v1 成片"画面静态"由 v0.5 镜头/场景底解决；v0.5 重跑成片
"没有音效、听起来不够带感"——实测该片音轨只有干口播（-40dB/0.4s 静音段 26 处），
而参考片（抖音 @阿杜Next《看完学会正确的背景音乐使用方式》）同口径静音段为 0。
**只参考方法论，不抽取该参考片的音频/音乐**（版权）。

核心结论：BGM 不是可选的背景板，而是口播的情绪提升；干口播 + 零星音效仍然"不带感"。
成片音频必须三层齐全：**口播（事实与清晰度）+ BGM（情绪与节奏）+ 音效（动作与冲击）**。

## 三层模型与响度契约

| 层 | 角色 | 响度（相对口播活跃 RMS） | 实现 |
|---|---|---|---|
| 口播 | 唯一事实来源，只播一次 | 基准；成片 loudnorm I=-16:TP=-1.5:LRA=11 | voice.wav |
| BGM | 情绪提升、节奏骨架、掩盖口播小瑕疵 | 间隙 ≈ −7dB；说话时 ≈ −17dB（自动 ducking） | make_bgm.py / 授权音乐 + mix_sound.py |
| 音效 | 动作接触/冲击/转场的可闻反馈 | gain 0.5，不压口播 | make_sfx.py + events.json + mix_sound.py |

mix_sound.py 用口播 RMS 包络（50ms 窗、attack 30ms、release 200ms、hangover 300ms——
词间/句间短停顿不触发抬头）自动生成 BGM 音量自动化，逐样本混音，纯 Python 标准库、
不依赖 ffmpeg、与渲染引擎无关。

## 规则 1 · 情绪提升：BGM 默认必加

- 默认 `bgm: 'auto'`（make_bgm.py 程序化生成，无版权风险）。只有**用户明确说不要音乐**
  才 `off`，且交付时声明。"可不加音乐"的旧口径作废。
- 按章节选 mood，不要全片一种情绪：
  - `serious`（默认 76 BPM）：低频钢琴拨弦 + 弦乐垫、无鼓。案情讲述、严肃事实。
  - `steady`（96 BPM）：垫 + 八分琶音 + 轻鼓点。法律分析、方法讲解。
  - `upbeat`（124 BPM）：轻快鼓组 + 五声旋律。收尾、行动号召、节奏提速段。
- 口播语气平、感染力弱时，BGM 承担情绪（参考片原话："感染力弱都没有关系"）。
  不要靠提高口播音量或加夸张音效补情绪。

## 规则 2 · 音量的配比：自动化，不手调

- 数值契约见上表（−7 / −17）。mix_sound.py 自动执行；**不要**用固定音量把 BGM 全程
  压死或全程顶满，也不要逐句手调。
- 口播永远最清晰：任何时刻 BGM+音效不得掩蔽口播（听检 + 门禁 3 验证）。
- 音效 gain 0.5；密集音效处若压口播，降该镜头音效而不是降口播。

## 规则 3 · 关键节奏：金句/数字/开头落拍

- 拍网格 `t = n × 60 / bpm`（make_bgm.py 打印 beat 秒值）。写分镜时把**开头第一帧、
  关键数字揭示、金句 chip 落下**的 revealAt / events 秒点尽量对齐最近拍点（±0.15s 内
  微调画面事件去就音乐，不要为落拍改口播时间）。
- 数字到账的 `ching`、敲槌的 `thud/stamp` 落在重拍上；转场 whoosh 由 render.cjs 自动
  贴在镜头边界前 0.2s（画面同步优先）。
- 开头落在重拍：第一镜头起点即第 0 拍，make_bgm 从 t=0 起鼓/起拨弦。
- 节奏舒服能掩盖口播小瑕疵（参考片：口播小瑕疵被鼓点"掩盖"），但法律事实读音不得改。

## 规则 4 · 分段铺设：让视频呼吸

- `sections` 与 STORYBOARD 章节边界对齐：案情→分析→收尾 至少两次 mood 切换
  （96s 以上的片子禁止单一 mood 到底）。
- 边界处 make_bgm.py 自动做 0.5s「小停顿」呼吸（dip 到 30%，**不是静音**——静音会
  触发连续性门禁，也切断情绪）。
- 首尾淡入 0.5s / 淡出 0.8s 已内置；与画面 fade 同步收尾。

## 音效层：密度与触发点

- 8 个无版权占位音（make_sfx.py）：whoosh 挥动/转场、paper 纸张/翻面、ching 金钱/到账、
  thud 重物落地、stamp 盖章、crack 碎裂/撕毁、pop 气泡/出现、scratch 书写/划动。
- **每镜头 ≥ 1 个音效**：pipeline 的 render.cjs 自动在每个镜头边界贴 whoosh（含开头），
  动作内置 events 再叠加接触点音效。`sfx: []` 可静音单镜头（慎用）。
- 触发点对齐实际接触/动作完成帧（主库 `events[].at × dur`），不是每个字幕都配。
- 想要更高质量：用**有使用权限**的同名 wav 覆盖 assets/sfx/ 即可。

## 版权与来源

- make_bgm.py / make_sfx.py 全部数学合成，零第三方素材，可商用。
- 用户提供的音乐须确认授权；**禁止**从抖音/平台视频抽音频当 BGM（参考片只学方法）。
- 私密口播/素材只在本机混音，不上传任何第三方服务。

## 引擎无关强制（防"自建引擎跳过声音"）

无论 pipeline / Remotion / 自建渲染引擎，都必须：
1. 产出 `events.json`（绝对秒点；自建引擎至少给每个镜头边界一个 whoosh）；
2. 跑 `make_bgm.py`（或授权音乐）+ `mix_sound.py` 得到 `mixed.wav`；
3. 合成时音轨用 `mixed.wav`，**只 `-map` 原声 = 不合格**；
4. 成片过下面门禁。v0.5 重跑事故正是自建引擎只 map 原声导致全片无 BGM 无音效。

## 快速执行（pipeline 路线已内置，自建引擎照抄）

```bash
python scripts/make_sfx.py --out assets/sfx                 # 一次即可
python scripts/make_bgm.py --dur 96.133 --config sound.json --out bgm.wav
python scripts/mix_sound.py --voice voice.wav --events events.json \
    --sfx-dir assets/sfx --bgm bgm.wav --out mixed.wav
# 合成脚本音轨用 mixed.wav；最后 loudnorm=I=-16:TP=-1.5:LRA=11
```

## 可执行门禁（先跑命令再实听）

```bash
# 1) BGM 连续性：-40dB/0.4s 静音段应为 0（合法例外：声明过的 ≤0.6s 呼吸，且呼吸是 dip 不是静音）
ffmpeg -i out/成片.mp4 -af silencedetect=n=-40dB:d=0.4 -f null - 2>&1 | grep -c silence_start
# 2) 无削波
ffmpeg -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "Peak level"
# 3) ducking 抽查：长间隙(≥0.6s)后半段（避开章节呼吸 dip）与说话段各取 0.3–0.4s 窗，
#    BGM 层 RMS 差应 ≈ 6–12dB；说话段 BGM 至少比口播 RMS 低 12dB
#    （mixed.wav 减去 voice.wav 即 BGM+音效层；或直接听检间隙音乐抬头）
# 4) 音效可闻：events.json 任取 3 个秒点，±0.15s 窗 RMS 应明显高于相邻无事件窗
ffmpeg -ss 4.4 -t 0.4 -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "RMS level"
```

门禁 1 不为 0 → 没混 BGM 或 BGM 被静音，回 mix_sound 链路修；门禁 3 差值 < 6dB →
ducking 没生效或 BGM 太小，检查 --bgm 是否传入。命令通过仍须实听：开头/中段/收尾/
音效密集处各一段，确认情绪随章节变化、口播清晰、音效对齐动作。

## 常见问题

| 现象 | 处理 |
|---|---|
| 成片干巴巴、句间全静音 | 没走 mix_sound / 只 map 原声；按引擎无关强制补链路 |
| BGM 压口播 | 检查 ducking（−17dB）是否生效；不要手调固定音量 |
| 句间音乐不抬头 | 长间隙(≥0.6s)后半段应抬到 ≈−7dB；<0.3s 短停顿不抬是正常防 pumping；检查 hangover/release 是否生效 |
| 全片情绪一个味 | sections 没配；按章节切 mood |
| 合成极慢/卡约 1 秒 | ffmpeg aac denormal 陷阱；保留 compose.sh 的 dither amix |