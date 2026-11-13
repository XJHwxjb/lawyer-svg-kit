# 声音设计（v0.8）——口播 + 真实录音音效（无 BGM）

真实反馈驱动的板块：v1 成片"画面静态"由 v0.5 镜头/场景底解决；v0.5 重跑成片
"没有音效、听起来不够带感"→ v0.6 补齐声音链路；v0.6 程序化合成音"效果不太好"
→ v0.7 换真实素材（CC0 录音音效 + Mixkit 曲目 BGM）；v0.7 重跑后律师明确
**只要音效、不要背景音乐**，且不要翻页/转场那一声"呼"→ v0.8 收敛为两层：
**口播 + 动作音效**，删除 BGM 全链路，删除 whoosh 转场音效，翻页/转场静音。
**只参考方法论，不抽取任何参考片的音频/音乐**（版权）。

核心结论：律师要的是"动作有反馈"，不是"背景有音乐"。成片音频 = **口播（事实与
清晰度）+ 音效（动作与冲击）**，优先级 **口播 > 音效**——冲突时先保口播清晰，再保
音效可闻。**不加 BGM**；句间静音是合法的（口播本来的呼吸），不再要求全片连续有声。

## 两层模型与响度契约

| 层 | 角色 | 响度 | 实现 |
|---|---|---|---|
| 口播 | 唯一事实来源，只播一次 | 基准；成片 loudnorm I=-16:TP=-1.5:LRA=11 | voice.wav |
| 音效 | 动作接触/冲击的可闻反馈 | gain 0.5，不压口播 | assets/sfx 真实录音库 + events.json + mix_sound.py |

mix_sound.py 逐样本把音效贴到口播上（无 BGM、无 ducking）。混音纯 Python 标准库、
与渲染引擎无关；ogg/mp3/flac 素材（真实库默认 ogg）用 ffmpeg 解码到临时 wav
（ffmpeg 本就是合成路线必备依赖，可用环境变量 FFMPEG 指定路径）。真实录音常带
前导静音，mix_sound 用 `trim_lead`（阈值 max(0.005, 峰值×2%)）把 onset 对齐到事件
秒点，避免"画面砸下了、声音晚半拍"。

## 规则 1 · 只要音效，不要 BGM

- 成片**不加任何背景音乐**。律师明确要求"加音效而不是加背景音乐"；BGM 全链路
  （fetch_bgm.py / make_bgm.py / assets/bgm / mix_sound 的 --bgm / ducking）已在 v0.8 移除。
- 不要靠加 BGM 补情绪或掩盖口播瑕疵；情绪靠画面动作、镜头节奏与音效反馈表达。
- 句间静音合法：口播词间/句间的自然停顿不再触发任何"连续性门禁"。silencedetect
  只用于排查**异常**长静音（如整段口播丢失），不是"必须为 0"。
- 若用户日后改口要音乐，那是另一次明确授权的需求，不在本 Skill 默认范围。

## 规则 2 · 音量配比：口播优先

- 音效 gain 0.5（mix_sound 默认）；密集音效处若压口播，降该镜头音效而不是降口播。
- 口播永远最清晰：任何时刻音效不得掩蔽口播（听检 + 峰值/可闻门禁验证）。
- 成片统一 loudnorm I=-16:TP=-1.5:LRA=11；mix_sound 输出峰值不得过载（≤0.98 线性）。

## 规则 3 · 音效触发点：对齐接触/冲击帧

- 触发点对齐实际接触/动作完成帧（主库 `events[].at × dur`），不是每个字幕都配。
- 数字到账的 `ching`、敲槌/盖章的 `thud/stamp`、碎裂的 `crack` 落在画面冲击那一帧；
  三者（events 的 at = shake 的 at = 印显现起点）对齐才有"砸实"感。
- **转场/翻页不配音**：whoosh 已从主库 events、render.cjs 自动转场音、app.js 预览合成、
  assets/sfx 库与 manifest 全部删除。镜头交叉淡化是静音的；文书"翻页"本身不发声，
  只有文书**落桌/接触**才用 `paper`。

## 音效层：真实录音库，7 音套件

- **默认 7 音真实录音套件**（assets/sfx 根目录，CC0 为主，来源见 assets/sfx/LICENSES.md）：
  paper 纸张/落桌接触、ching 金钱/到账、thud 重物落地、stamp 盖章、crack 碎裂/撕毁、
  pop 气泡/出现、scratch 书写/划动。**没有 whoosh**（转场/翻页静音）。
- **lib/ 100 条备选**（impact/ding/riser/glitch/typing/transition-UI/…），manifest.json
  逐条登记来源与许可。换音：把选中的 lib 录音复制到 sfx 根目录按事件命名，或自有
  授权音频同名覆盖（wav/ogg/mp3/flac 均可，mix_sound 自动解码）。
- **每镜头 ≥ 1 个接触/冲击音效**（动作内置 events）；纯位移/无接触镜头可无音效，
  但不靠转场 whoosh 凑数。`sfx: []` 可静音单镜头（film.html 把该镜头 events 置空）。
- events 引用了根目录不存在的名字 → mix_sound 计入 `sfx_missing` 跳过；**交付前必须清零**。
- 离线兜底：make_sfx.py 合成音产出到 assets/sfx-synth（不覆盖真实库，7 音、无 whoosh），
  混音 `--sfx-dir assets/sfx-synth`，交付须声明。
- 预览台 app.js 的音效是 WebAudio 即时合成近似音，只听个响；质感以成片混音为准。

## 版权与来源

- **音效库**：98 条 CC0 1.0（可商用/修改/再分发，无需署名）+ 2 条 MIT 合成音
  （ching/stamp，来自 kmilo93sd/agent-video-editor，MIT 声明已存 assets/sfx/LICENSES.md）。
  来源仓库：Barty-Bart/motion-graphics（内置 CC0 录音）、kmilo93sd/agent-video-editor。
- make_sfx.py 全部数学合成，零第三方素材，可商用（兜底用）。
- 用户提供的音效须确认授权；**禁止**从抖音/平台视频抽音频当音效（参考片只学方法）。
- 私密口播/素材只在本机混音，不上传任何第三方服务。
- v0.8 不再使用 Mixkit 曲目 BGM；相关许可台账（bgm.credits.json）与下载脚本已移除。

## 引擎无关强制（防"自建引擎跳过音效"）

无论 pipeline / Remotion / 自建渲染引擎，都必须：
1. 产出 `events.json`（绝对秒点；只含动作内置接触/冲击音效，**不含转场 whoosh**）；
2. 跑 `mix_sound.py` 得到 `mixed.wav`（口播 + 音效，无 BGM）；
3. 合成时音轨用 `mixed.wav`，**只 `-map` 原声 = 不合格**（成片应有动作音效）；
4. 成片过下面门禁。v0.5 重跑事故正是自建引擎只 map 原声导致全片无音效。

## 快速执行（pipeline 路线已内置，自建引擎照抄）

```bash
# 案件工程先复制 scripts/ 与 assets/（sfx 真实库）
python scripts/mix_sound.py --voice voice.wav --events events.json \
    --sfx-dir assets/sfx --out mixed.wav
# 合成脚本音轨用 mixed.wav；最后 loudnorm=I=-16:TP=-1.5:LRA=11
# 无 BGM、无 ducking；句间静音合法
```

## 可执行门禁（先跑命令再实听）

```bash
# 1) 无削波
ffmpeg -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "Peak level"
# 2) 音效可闻：events.json 任取 3 个秒点，±0.15s 窗 RMS 应明显高于相邻无事件窗
ffmpeg -ss 4.4 -t 0.4 -i out/成片.mp4 -af astats=metadata=1 -f null - 2>&1 | grep "RMS level"
# 3) sfx_missing 清零：mix_sound.py 输出不得有 sfx_missing（有 = 音效被静默跳过）
# 4) 无 whoosh：events.json 里不得出现 sfx=="whoosh"（转场/翻页应静音）
```

峰值过载 → 降音效 gain 或检查 loudnorm；音效不可闻 → 检查 events 秒点与 --sfx-dir；
sfx_missing 非空 → 按 assets/sfx/README.md 补音或改 events；events 里有 whoosh →
说明用了旧模板/旧 actions.js，更新到 v0.8。

**人工听检（命令过了也不豁免）**：戴耳机听 5 个最高风险秒点——开头第一秒、关键数字
ching 处、敲槌/盖章冲击处、音效最密集处、收尾淡出；再抽听开头/中段/收尾各一段，确认
口播清晰、音效对齐动作、真实录音无爆音/截断、**翻页/转场处没有"呼"声**。

## 常见问题

| 现象 | 处理 |
|---|---|
| 成片干巴巴、完全无音效 | 没走 mix_sound / 只 map 原声；按引擎无关强制补链路 |
| 翻页/转场还有"呼"声 | 用了旧模板（render.cjs 自动 whoosh / 旧 actions.js / 旧 sfx 库）；更新到 v0.8，重渲 events |
| 音效压口播 | 降该镜头音效 gain，不要降口播 |
| 句间有静音 | v0.8 合法（无 BGM）；只排查异常长静音（整段口播丢失） |
| 音效"电子味"重 | 误用了 assets/sfx-synth 兜底库；换回 assets/sfx 真实库 |
| ogg/mp3 解码报错 | ffmpeg 不在 PATH；设 FFMPEG 环境变量或安装 ffmpeg |
| 合成极慢/卡约 1 秒 | ffmpeg aac denormal 陷阱；保留 compose.sh 的 dither amix |