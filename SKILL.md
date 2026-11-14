---
name: lawyer-svg-kit
description: 法律科普/案件讲解视频的一站式 Skill：人物动作资产库 + 整片制作流程。当用户要做法律类视频、需要案件人物插画或交换/抓捕/敲槌等动作动画、或提到"彩礼案/律师视频/人物库/造人物/造动作"时使用。提供 16 个固定剪影人物（14 个换装变体）、36 个纯时间函数动作、51 个法律图标、横屏 16:9 或竖屏 9:16 单选生成、可交互预览台、口播/SRT 对齐、零依赖整片管线（镜头/场景底/转场/声音两层：口播+真实录音音效，无 BGM、翻页转场静音/真人 3:4 居中裁切小窗/口播稿自动章节进度条）与 Remotion 合成配方、成片验收，以及缺人物/缺动作时的制造教程。
---

# lawyer-svg-kit · 律师视频一站式 Skill

两层能力，一个入口：

- **资产层**：零依赖、纯 SVG、纯时间函数的人物与动作库。每个角色只有一张固定剪影（无表情、色块轮廓、贴纸描边），所有剧情靠"交换物动画"表达。全部状态由 `t ∈ [0,1]` 的纯函数决定 → 可 scrub、可逐帧导出、可直接移植 Remotion。同一套动作支持横屏 16:9（1920×1080）与竖屏 9:16（1080×1920），**按项目单选其一生成**，坐标自动重排，竖屏上方留标题/字幕安全区。
- **制作层**：把律师口播变成完整视频——素材清点、SRT 时间轴、逐句分镜、选角配动作、合成整片（**零依赖管线 pipeline/ 或 Remotion 二选一**：真人/头像 + 字幕 + 动画场景 + 镜头 + 音效）、渲染与成片验收。

## 0. 硬约束（每次任务先读）

1. **隐私**：当事人材料、证据、肖像、口播稿只存放在用户授权的位置；不得上传到任何第三方服务、不得公开推送含私密内容的仓库或页面。本库只含通用剪影与演示默认值，不含任何真实案件信息。
2. **事实**：法条编号、金额、日期、判决结果一律使用用户稿件提供的值。库内演示默认值（如 ¥660,000、《民法典》第1042条）**仅供预览**，成片必须替换为稿件值；稿件没给的数字不得编造。约定/请求/实付/判决金额分别登记，不能混标或自行相减当作已查明事实。
3. **风格**：人物保持"无表情极简剪影"语法（见 references/character-forge.md）。不要加五官、不要换写实风格、不要引入带表情的卡通人物——这是用户验收过的风格。
4. **画幅单选**：横屏 16:9 或竖屏 9:16 由律师选定，**只生成选中的那一种**；稿件没写就先问律师，问清再开工。选定后分镜、验收、导出、composition 全部只跟随这一个画幅。
5. **数字呈现**（防止"数字一闪而过/暂停时数字是错的"）：
   - 计数动画（count-up）必须随语义推进并**精确停在稿件值**——不得停在近似值，不得在停稳后继续累加。纯数字揭示（无伴随动画）的 count-up ≤ 0.6 秒；伴随实物流动的 count-up（如 money-flow 钞票逐张到账）允许与流动同步，但必须算好停留窗口。
   - 精确值在画面上停留 ≥ 1.2 秒（从停稳到转场开始），期间不被淡出/切镜吃掉。算法：`镜头dur × (1 − 计数结束的t01) ≥ 1.2`。例：money-flow 计数在 t=.8 结束 → 该镜头 dur 必须 ≥ 6s（默认 5.4s 只有 1.08s 停留，不够）。
   - **禁止滚动合计**：多个数字的"合计"只在口播说到合计的时刻一次性显示稿件值，不做实时累加动画（观众暂停时会看到错误的中间值）。
   - 约定/请求/实付/判决数字分别带标签显示（见第 2 条），标签与数字同帧出现；不同法律含义的数字不得画成可自动相减的账目。
   - 数字镜头用推近后停留的镜头：pipeline 填 `camera: 'hold'` 并 `focus` 指向数字位置；Remotion 用推近→保持的关键帧。
   - 验收方法：在精确值停留窗口内任取一帧暂停，读出的数字必须等于稿件值（delivery-qa.md 停帧抽查）。
6. **动感最低要求**（防止"成片像幻灯片"）：
   - 每个镜头内部必须有**随时间变化的镜头运动**（camera ≠ off）或**持续的动作/部件运动**，二者至少其一。元素入场后完全静止等下一镜 = 不合格。
   - 镜头之间必须有转场：pipeline 默认 12 帧交叉淡化（`transition` 可调）；Remotion 用 DocumentTransition 或明确设计的切镜。禁止全片硬切。
   - 场景底不得全片 `paper`：按剧情地点选 home/court/register/office/warehouse（kit.js `buildBG`，预览台"场景底"可预览）。
   - 声音两层必须齐全（§0.7 与 references/sound.md）：口播 + 动作音效，每镜头 ≥1 个接触/冲击音效；**不加 BGM**，转场/翻页静音（whoosh 已移除）。
   - 构图：横屏人物高度 ≥ 画面高度 35%（默认参数约 36%）；自定义窄画幅或缩小构图时用 `cs/os ≥ 1.4` 或 `P.scale ≥ 1.3` 补回，不得让人物缩成角落小人。连续 3 个以上镜头画面上方 1/3 全空 = 构图单调，应加天空 UI（chip/计数器）或换景别。
   - 验收方法：freezedetect 冻结门禁 + 抽段连续播放（delivery-qa.md）。
7. **声音两层**（防止"成片干口播、不带感"，见 [references/sound.md](references/sound.md)）：
   - 成片音频 = 口播 + 音效，优先级口播 > 音效。音效默认 = `assets/sfx` **真实录音库**（CC0 为主，7 音套件 + 100 条备选）；**不加 BGM**（律师要求只要音效、不要背景音乐）。离线兜底 `make_sfx.py` 合成，交付必须声明。
   - **转场/翻页静音**：whoosh 已从主库 events、render.cjs、预览台与音效库删除；镜头交叉淡化不发声，文书只有落桌/接触才用 paper。句间静音合法（无 BGM，不再要求全片连续有声）。
   - 音效触发点对齐接触/冲击帧（`events[].at × dur`），每镜头 ≥1 个接触/冲击音效；mix_sound 输出 `sfx_missing` 必须为空、峰值不过载（≤0.98）。
   - 任何渲染路线（含自建引擎）都必须走 `mix_sound.py` 混音并过 delivery-qa.md 声音门禁（峰值/可闻/sfx_missing 清零/无 whoosh + 五秒点耳机听检）；只 map 原声 = 不合格。
8. **真人小窗 3:4 居中**（v0.9，律师要求，见 [references/studio.md](references/studio.md)）：
   - 真人源视频**不是 3:4 就先裁成 3:4**，且必须以律师人物为中心：宽源（16:9 等）水平居中裁两侧；窄源（9:16 等）按 `PERSON_CY` 纵向锚定脸部（默认 0.30，脸落在窗内上 1/3）。源已是 3:4 则不裁。
   - 小窗默认 300×400（3:4）左下角，`PERSON_W/PERSON_POS` 可调；竖屏字幕 MarginV ≥ 460 别压窗。裁切效果必须抽帧目检：脸完整在窗内、不切头顶/下巴。
9. **章节进度条**（v0.9，律师要求，见 [references/chapters.md](references/chapters.md)）：
   - AI 先读懂本期口播稿，归纳 **3~6 个章节**（标签 ≤8 字），写 `chapters.json`（label/start/end 秒，与成片时间轴一致）；渲染时自动在画面顶部生成灰框分格进度条：格宽 ∝ 章节时长、当前格高亮、底部细进度线。
   - 章节边界必须对齐口播语义转折（不是均分时长）；标签用观众词（"引言/痛点/怎么办"），不用内部术语。没有 chapters.json = 不画条（兼容旧工程）。
   - 验收：抽 3 个时间点停帧，高亮格与当时口播内容一致；进度线连续推进无跳变。

## 1. 先判断入口

| 用户要什么 | 走哪条流程 |
|---|---|
| 只要人物/动作素材、单帧 SVG、某段动画 | **资产库流程**（§2） |
| 完整法律科普视频（口播 + 字幕 + 画面） | **整片制作流程**（§3），其中选角配动作复用 §2 |
| 修改/检查已有视频的人物动作 | 定位原工程 → 按 §2 查库/造动作 → 只改用户指定部分 → 重新验收受影响部分与成片播放 |

## 2. 资产库流程（选角 → 查库 → 造 → 验收 → 导出）

### Step 1 · 拆稿选角
读口播稿/分镜，列出三类清单：
- **角色清单**：谁出场？归入六组之一：当事人 / 司法·执法 / 代理·调解 / 商事 / 民生 / 对抗·其他。
- **动作清单**：每场戏的核心动词是什么？归入五类机制：物件交接 hand / 金钱扩展 money / 整体位移 move / 共同焦点 focus / 锁定·联合 lock。
- **画幅选择（单选）**：横屏 16:9（B站/西瓜/庭审演示）或竖屏 9:16（抖音/视频号/快手），由稿件/投放平台或律师口头指定；**稿件没写就先问律师选哪一种，问清再开工**。记入案件配置 `orient: 'land' | 'port'`。

### Step 2 · 查库
打开 [references/roster.md](references/roster.md)：
- 角色 → 人物 id + 变体（如"拖欠工资的公司老板" → `boss`；"受伤工人" → `worker` 变体 `injured`）。
- 动作 → 动作 id（如"敲槌宣判" → `gavel-drop`；"转移财产" → `asset-hide`）。
- 该文件还有 **11 个业务领域 → 推荐 cast + 动作组合** 的矩阵（婚姻家事/继承/劳动/公司股权/合同债务/房产物业/交通/医疗/消费知产/刑事/行政），直接照抄组合再按稿件微调。
- 无人物的图示/证据板图案 → [references/legal-icons.md](references/legal-icons.md)（51 个法律图标）。

### Step 3 · 缺什么造什么
- 库里没有的角色 → 按 [references/character-forge.md](references/character-forge.md) 造：复制最接近的 draw 函数 → 改"帽子/制服色/手持道具"三件套 → 注册进 `CHARS` → 肖像验收。
- 库里没有的动作 → 按 [references/action-forge.md](references/action-forge.md) 造：**优先用九个动作工厂拼**（交接/钱流/砸章/焦点/双人位移/锁定/联合/灰化/归属），工厂覆盖不了才写自定义 `build(S)`。
- 造完必须回写 roster.md 的表格，保持库与文档同步。

### Step 4 · 预览验收
按 [references/studio.md](references/studio.md) 起本地服务打开预览台：
- 动作库模式逐动作播放；人物图鉴模式逐角色看肖像与变体。
- 用 `window.__kit` 做确定性验收：`setOrientation(案件 orient)` / `setAction(id)` / `setPortrait(who, variant)` / `seek(f)` / `pause()`。
- 验收清单：案件用到的全部动作在 t = 0/.12/.3/.5/.7/.9/1 于**选中画幅**无异常；控制台零报错；接物方朝向正确（镜像检查）；选竖屏时剧情元素不侵入上方标题安全区；移动端布局不溢出。（全库双画幅 sweep 属库维护验收，见 studio.md §4，不按案件重复跑。）

### Step 5 · 导出进片
- 单帧：预览台"导出当前帧 SVG"（独立可打开的 .svg，尺寸即当前画幅 1920×1080 或 1080×1920）。
- 参数：导出 JSON（action/cast/params/events/phases/**orientation**），供 Remotion 或剪辑软件对轨；orientation 块含画幅 id 与 W/H/GROUND/缩放因子。
- 整段：两条路线二选一——按 [references/remotion.md](references/remotion.md) 把 `update(t01, P)` 映射到 Remotion `useCurrentFrame()`，逐帧渲染同一棵 SVG 树；或直接用 [pipeline/](pipeline/README.md) 零依赖管线（film.config.js 引用动作 id，无需移植代码）。composition/画布宽高取 JSON 的 orientation 块，**只建选中画幅这一个 composition**。
- 音效事件点 `events[].at` 与画面冲击帧对齐，混音时按此贴 SFX。

## 3. 整片制作流程

**第一次做整片先读 [references/workflow.md](references/workflow.md)**（逐步执行指南），按阶段产出可检查的结果：

1. **读懂任务**：成片还是样片？素材、输出位置、平台、时长、真人画面安排；**选定画幅**（没写先问）。
2. **可靠时间轴**：ffprobe 检查素材；SRT 逐句对照原声校对；用 [scripts/prepare_timing.py](scripts/prepare_timing.py) 生成 timing.json。不猜测法律事实与数字。
3. **逐句分镜**：STORYBOARD.md 覆盖完整时长，每行含原句/含义/人物动作（roster 动作 id）/道具流向/revealAt/转场。叙事与节奏方法见 [references/narrative.md](references/narrative.md)——先事实表，再行为，最后图表文字；避免整片像幻灯片。
4. **选角与动作准备**：复用 §2（查库 → 造 → 预览台在选中画幅验收）。
5. **合成整片**：两条路线**二选一，不要混用**，都必须满足 §0.5 数字呈现与 §0.6 动感最低要求：
   - **零依赖管线（默认推荐）**：按 [pipeline/README.md](pipeline/README.md) 把模板复制进案件工程，填 `film.config.js` → `node render.cjs` → `bash compose.sh`。镜头推拉、6 种场景底、交叉淡化、音效混音、真人 3:4 小窗、章节进度条已内置，不需要 npm/React。章节条先按 [references/chapters.md](references/chapters.md) 从口播稿生成 chapters.json。
   - **Remotion**：需要更复杂合成且环境允许时，按 [references/remotion.md](references/remotion.md) 搭真人/头像层 + 字幕层 + 主库动画场景层；镜头推进用 [references/camera.md](references/camera.md)；图标动效与文书转场用 [remotion/](remotion/README.md) 组件。
   原声只播放一次，字幕不改变法律含义。
6. **成片验收交付**：按 [references/delivery-qa.md](references/delivery-qa.md) 对实际导出的 MP4 实听实看；交付成片 + 可编辑工程路径，说明时长、画幅、已完成检查与限制。

用户只要样片时做到样片就交付并等待反馈；要完整视频时 10 秒样片只是内部检查，不能当作完成。

## 4. 资产地图

```
kit.js        基础构建器：坐标契约 / 剪影语法 / 16 人物 draw / 道具 / makeChar / 6 种场景底 buildBG
camera.js     零依赖镜头模块：cameraAt / applyCamera / camFocus / 5 个 preset + off（与 CameraRig 同数学）
actions.js    9 个动作工厂 + 36 个动作定义（cast / phases / events）
app.js        预览台驱动：时钟 / 控件 / 音效 / 导出 / 双模式库
index.html    预览台页面（SVG 舞台 + 控件）
style.css     预览台样式
references/   资产层：roster · character-forge · action-forge · studio
              制作层：workflow · narrative · remotion · camera · legal-icons · sound · chapters · delivery-qa
pipeline/     零依赖整片模板：film.html(双缓冲转场+章节条) · film.config.js · case-actions.js ·
              render.cjs(CDP 逐帧，转场/翻页静音，注入 chapters.json) · compose.sh(ffmpeg 合成+声音两层+真人3:4小窗) · README.md(照抄指南)
assets/legal-svg/   51 个法律图标 + catalog.json + 预览图（图示/证据板用）
assets/sfx/         真实录音音效库（v0.8 默认）：7 音套件（无 whoosh）+ lib/ 100 条备选 + manifest.json + LICENSES.md
remotion/     CameraRig（镜头分层）· LegalMotion（图标动效）· DocumentTransition（文书转场）
scripts/      prepare_timing.py（SRT + 视频 → timing.json）·
              mix_sound.py（口播+音效两层混音，ogg/mp3 自动解码，无 BGM/ducking）· make_sfx.py（离线合成兜底，7 音）
docs/         公开 README 截图
qa/           开发期验收截图（不属于运行资产）
```

资产层运行只需浏览器打开 `index.html`（建议本地静态服务），无构建、无 npm 依赖；制作层两条路线（pipeline/ 零依赖管线、Remotion 工程）都在案件项目目录搭建，不在 Skill 目录内写入客户素材。

## 5. 关键契约速查

- **设计空间** `1080×800, GROUND=700`：写动作/造人物时唯一使用的坐标系；人物局部坐标脚底 `(0,0)`、向上为负。
- **活画幅** `setOrientation(id)`：`land` 横屏 16:9 = `1920×1080, GROUND=945`；`port` 竖屏 9:16 = `1080×1920, GROUND=1640`。映射函数 `X(x)` 横向、`Yg(y)` 贴地物件、`Ys(y)` 天空 UI；`makeChar.set/hand`、`chip`、`qbez/qd` 内部自动映射，动作代码无需手换算。
- 竖屏上方约 40% 为**标题/字幕安全区**：剧情元素贴地布置，计数 chip 等天空 UI 由 `Ys` 自动抬升，不得把关键剧情放进安全区。
- 画幅是**项目级单选**：预览台横屏/竖屏切换（或 `O` 键）即选择入口，选定自动保存（localStorage），重置参数/随机风格不改变它；导出 SVG/JSON 跟随当前画幅。
- `makeChar(root, who, variant, opt)` → `{ set(x,s,deg,flip,gray,op), hand(x,s,deg,flip), C }`。
- 动作 `build(S)` → `{ update(t01,P), anchors(P), guidePath(P) }`；`S = { below, above, fx, chars, man, woman }`，角色一律走 `S.chars[id]`。
- 飞行道具的给出方加 `opt:{noProp:true}`（去掉 baked 手持道具）；接物方用 `faceFlip(C, want)` 镜像。
- baked 手持道具**不得含文字**（镜像后文字会反）；文字只出现在飞行道具与 chip 上。
- **镜头（零依赖）**：`camera.js` 的 `cameraAt(t01, keys[{at,x,y,scale}])` 求值 + `applyCamera(g, cam)` 写 transform；焦点用 `camFocus(x, y)` 传设计空间坐标；全舞台镜头 scale ≥ 1（否则边缘露底）；preset：push/hold/impact/pan/breathe。与 Remotion CameraRig 同一套数学，两条路线观感一致。
- Remotion 里**全局帧与局部帧不混用**：Sequence 内 `useCurrentFrame()` 从 0 起算；`t01 = 局部帧 / durationInFrames`。

## 6. 交付前自检

资产交付：
- [ ] 角色/动作全部来自库或按教程新造并回写 roster.md
- [ ] 法条/金额/日期已替换为稿件值
- [ ] 预览验收清单全过（含镜像与移动端）
- [ ] 已按**用户选定的单一画幅**验收并导出（选竖屏时安全区无剧情元素）；未产出未选画幅的成片资产
- [ ] 导出 SVG 单独打开无报错、滤镜完整

整片交付（另加）：
- [ ] 分镜覆盖完整口播时长，无漏句/空白/重叠；**只有一份 STORYBOARD.md**，配置/代码与之一致
- [ ] 原声只播放一次、音画同步，字幕与稿件一致
- [ ] 数字停帧抽查：每个关键金额在停留窗口内暂停读值 = 稿件值；count-up ≤ 0.6s、停稳 ≥ 1.2s；无滚动合计（§0.5）
- [ ] freezedetect 冻结门禁通过（≥ 0.5s 静止段均已解释）；每镜头有镜头运动或持续动作（§0.6）
- [ ] 转场已实现（非全片硬切）；场景底按剧情选择（非全片 paper）
- [ ] 声音两层门禁通过（sound.md）：音效每镜头 ≥1 且可闻、sfx_missing 为空、峰值不过载、events 无 whoosh（转场/翻页静音）；无 BGM；合成兜底已声明（如用）；五秒点耳机听检已做
- [ ] 真人小窗（如有）：源非 3:4 已裁 3:4 且以人物为中心，抽帧脸完整不切头；字幕未压窗（§0.8）
- [ ] 章节条（如有 chapters.json）：3~6 格、标签对齐口播语义、停帧抽查高亮格正确、进度线连续（§0.9）
- [ ] 成片 MP4 实听实看验收（delivery-qa.md），检查记录留存
- [ ] 交付成片 + 可编辑工程路径，说明已完成检查与限制；成片文件名 = out/<案件名>_<画幅>.mp4
- [ ] 私密材料未离开授权目录
