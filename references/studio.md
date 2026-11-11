# 预览台与验收/导出（studio）

## 1. 启动

零依赖静态页面。任选一种：

```bash
cd <kit 目录>
python -m http.server 8734        # 或 npx serve / 任意静态服务
# 浏览器打开 http://127.0.0.1:8734/index.html
```

直接双击 index.html 也能跑（无 fetch、无模块），但导出下载与自动化建议走 http。

## 2. 界面

- 左上切换：**动作库**（36 动作按五类分组）/ **人物图鉴**（16 人物按六组分组，+N 表示变体数）。
- 图鉴模式舞台上方两行：**变体**（基础/各变体 pill）、**相关动作**（点 pill 跳回动作库播放）。
- 舞台头：类别 chip + 名称 + 阶段 chip；右上大数字 = 库内序号。
- 右栏控件：速度 / 时长 / 缓动(smooth·spring·back·linear) / 幅度 / 缩放 / 描边 / 投影 / 色调(cream·mist·dusk) / 场景底(paper·home·court·register) / 参考线。
- 走带：播放/暂停、重播、循环、时间轴 scrub；刻度 = 音效事件点。
- 键盘：空格播放暂停，←→ 逐帧（1/30s）。
- 工具：重置参数 / 随机风格 / 导出当前帧 SVG / 导出参数 JSON。

## 3. 调试 API（window.__kit）

```js
__kit.setAction('gavel-drop')      // 切动作（重置时钟并播放）
__kit.setPortrait('police','traffic') // 切人物肖像（固定剪影+名字chip）
__kit.setMode('acts' | 'chars')    // 切库模式
__kit.seek(0.62)                   // 定位到 t01 并暂停（确定性截图用）
__kit.pause() / __kit.play()
__kit.params                       // 实时参数对象 P（可直接改 scale/amp/ease/theme…）
__kit.time / __kit.action / __kit.mode
```

## 4. 自动化验收模板

任何能跑 JS 的浏览器自动化（ego-browser / Playwright / Puppeteer）都适用：

```js
// 页面内执行：全库 sweep，收集运行时错误
const errs = [];
for (const a of ACTIONS) {
  try {
    __kit.setAction(a.id);
    for (const f of [0, .12, .3, .5, .7, .9, 1]) __kit.seek(f);
  } catch (e) { errs.push(a.id + ': ' + e.message); }
}
return errs;   // 期望 []
```

配合控制台监听（console error / pageerror 期望 0）、关键帧截图、移动端视口（390×844）截图。
本库开发期截图在 `qa/`：pXX-*.png 肖像、v-*.png 变体、a-*.png 动作关键帧、ui-*.png 界面、m-*.png 移动端。

## 5. 导出

- **当前帧 SVG**：克隆舞台 → 补 xmlns/width/height → 序列化下载。独立打开即所见即所得（滤镜、灰化 style 一并带走）。文件名 `svg-kit-<action>-f<frame>.svg`。
- **参数 JSON**：`{ action, category, time, frame, params, events, phases, cast }`。给 Remotion/剪辑对轨用：events.at × dur = 音效秒点。

## 6. 移植 Remotion（整段动画）

`update(t01, P)` 是纯函数，移植只需换时钟：

```tsx
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();
useEffect(() => { api.update(frame / durationInFrames, P); }, [frame]);
```

- 在 Remotion 组件 mount 时执行一次 `act.build(S)` 建 SVG 树（挂在 ref 容器内），之后每帧只调 update。
- `P` 用 JSON 导出的 params 固定下来，保证逐帧确定性。
- 需要透明底：去掉 bgRect/groundRect/grain 三层，只留 sceneRoot。
- 音效：按 events 在 `<Audio>`/`<Sequence>` 上对齐 at × durationInFrames。

## 7. 常见问题

- 人物"没手接物"：cast 忘了 `opt:{noProp:true}` 或 hand 锚点写错 → 看参考线十字（开参考线）。
- 接物方背对镜头：flip 传错 → 用 `faceFlip(C, want)`，不要手写 ±1。
- 导出 SVG 打开是空白：克隆时丢了 `xmlns` 或滤镜 id 冲突 → 用预览台导出按钮，不要手抄 innerHTML。
- 灰化不生效：gray 参数走内层 tint 的 saturate；外层 cutout 不受影响（描边保持米白）。