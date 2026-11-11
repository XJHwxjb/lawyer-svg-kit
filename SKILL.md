---
name: lawyer-svg-kit
description: 法律科普/案件讲解视频的人物与动作素材库。当用户要做法律类视频、需要案件人物插画或交换/抓捕/敲槌等动作动画、或提到"彩礼案/律师视频/人物库/造人物/造动作"时使用。提供 16 个固定剪影人物（30+ 变体）、36 个纯时间函数动作、可交互预览台，以及缺人物/缺动作时的制造教程。
---

# lawyer-svg-kit · 法律视频人物动作素材库

一套**零依赖、纯 SVG、纯时间函数**的人物与动作资产：每个角色只有一张固定剪影（无表情、色块轮廓、贴纸描边），所有剧情靠"交换物动画"表达。全部状态由 `t ∈ [0,1]` 的纯函数决定 → 可 scrub、可逐帧导出、可直接移植 Remotion。

## 0. 硬约束（每次任务先读）

1. **隐私**：当事人材料、证据、肖像、口播稿只存放在用户授权的位置；不得上传到任何第三方服务、不得公开推送含私密内容的仓库或页面。本库只含通用剪影与演示默认值，不含任何真实案件信息。
2. **事实**：法条编号、金额、日期、判决结果一律使用用户稿件提供的值。库内演示默认值（如 ¥660,000、《民法典》第1042条）**仅供预览**，成片必须替换为稿件值；稿件没给的数字不得编造。
3. **风格**：人物保持"无表情极简剪影"语法（见 references/character-forge.md）。不要加五官、不要换写实风格——这是用户验收过的风格。

## 1. 接到案件后的标准流程

### Step 1 · 拆稿选角
读口播稿/分镜，列出两类清单：
- **角色清单**：谁出场？归入六组之一：当事人 / 司法·执法 / 代理·调解 / 商事 / 民生 / 对抗·其他。
- **动作清单**：每场戏的核心动词是什么？归入五类机制：物件交接 hand / 金钱扩展 money / 整体位移 move / 共同焦点 focus / 锁定·联合 lock。

### Step 2 · 查库
打开 [references/roster.md](references/roster.md)：
- 角色 → 人物 id + 变体（如"拖欠工资的公司老板" → `boss`；"受伤工人" → `worker` 变体 `injured`）。
- 动作 → 动作 id（如"敲槌宣判" → `gavel-drop`；"转移财产" → `asset-hide`）。
- 该文件还有 **11 个业务领域 → 推荐 cast + 动作组合** 的矩阵（婚姻家事/继承/劳动/公司股权/合同债务/房产物业/交通/医疗/消费知产/刑事/行政），直接照抄组合再按稿件微调。

### Step 3 · 缺什么造什么
- 库里没有的角色 → 按 [references/character-forge.md](references/character-forge.md) 造：复制最接近的 draw 函数 → 改"帽子/制服色/手持道具"三件套 → 注册进 `CHARS` → 肖像验收。
- 库里没有的动作 → 按 [references/action-forge.md](references/action-forge.md) 造：**优先用九个动作工厂拼**（交接/钱流/砸章/焦点/双人位移/锁定/联合/灰化/归属），工厂覆盖不了才写自定义 `build(S)`。
- 造完必须回写 roster.md 的表格，保持库与文档同步。

### Step 4 · 预览验收
按 [references/studio.md](references/studio.md) 起本地服务打开预览台：
- 动作库模式逐动作播放；人物图鉴模式逐角色看肖像与变体。
- 用 `window.__kit` 做确定性验收：`setAction(id)` / `setPortrait(who, variant)` / `seek(f)` / `pause()`。
- 验收清单：36+ 动作在 t = 0/.12/.3/.5/.7/.9/1 无异常；控制台零报错；接物方朝向正确（镜像检查）；移动端布局不溢出。

### Step 5 · 导出进片
- 单帧：预览台"导出当前帧 SVG"（独立可打开的 .svg）。
- 参数：导出 JSON（action/cast/params/events/phases），供 Remotion 或剪辑软件对轨。
- 整段：把 `update(t01, P)` 映射到 Remotion `useCurrentFrame()`，逐帧渲染同一棵 SVG 树（见 studio.md 的移植节）。
- 音效事件点 `events[].at` 与画面冲击帧对齐，混音时按此贴 SFX。

## 2. 资产地图

```
kit.js        基础构建器：坐标契约 / 剪影语法 / 16 人物 draw / 道具 / makeChar
actions.js    9 个动作工厂 + 36 个动作定义（cast / phases / events）
app.js        预览台驱动：时钟 / 控件 / 音效 / 导出 / 双模式库
index.html    预览台页面（SVG 舞台 + 控件）
style.css     预览台样式
references/   roster.md · character-forge.md · action-forge.md · studio.md
qa/           开发期验收截图（不属于运行资产）
```

运行只需浏览器打开 `index.html`（建议本地静态服务）。无构建、无 npm 依赖。

## 3. 关键契约速查

- 舞台 `W=1080, H=800, GROUND=700`；人物局部坐标脚底 `(0,0)`、向上为负。
- `makeChar(root, who, variant, opt)` → `{ set(x,s,deg,flip,gray,op), hand(x,s,deg,flip), C }`。
- 动作 `build(S)` → `{ update(t01,P), anchors(P), guidePath(P) }`；`S = { below, above, fx, chars, man, woman }`，角色一律走 `S.chars[id]`。
- 飞行道具的给出方加 `opt:{noProp:true}`（去掉 baked 手持道具）；接物方用 `faceFlip(C, want)` 镜像。
- baked 手持道具**不得含文字**（镜像后文字会反）；文字只出现在飞行道具与 chip 上。

## 4. 交付前自检

- [ ] 角色/动作全部来自库或按教程新造并回写 roster.md
- [ ] 法条/金额/日期已替换为稿件值
- [ ] 预览验收清单全过（含镜像与移动端）
- [ ] 私密材料未离开授权目录
- [ ] 导出 SVG 单独打开无报错、滤镜完整