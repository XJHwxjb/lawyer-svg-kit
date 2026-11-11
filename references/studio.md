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
- 舞台头：类别 chip + 名称 + **横屏/竖屏画幅切换**（16:9 / 9:16）+ 画布尺寸徽章 + 阶段 chip；右上大数字 = 库内序号。
- 画幅是**项目级单选**：切换即选定，自动保存（localStorage `lawyer-kit-orient`），下次打开恢复；重置参数 / 随机风格**不改变**画幅；导出 SVG/JSON 跟随当前画幅。案件只交付选中的那一种画幅。
- 右栏控件：速度 / 时长 / 缓动(smooth·spring·back·linear) / 幅度 / 缩放 / 描边 / 投影 / 色调(cream·mist·dusk) / 场景底(paper·home·court·register) / 参考线。
- 走带：播放/暂停、重播、循环、时间轴 scrub；刻度 = 音效事件点。
- 键盘：空格播放暂停，←→ 逐帧（1/30s），**O 切换画幅**。
- 工具：重置参数 / 随机风格 / 导出当前帧 SVG / 导出参数 JSON。

## 3. 调试 API（window.__kit）

```js
__kit.setAction('gavel-drop')      // 切动作（重置时钟并播放）
__kit.setPortrait('police','traffic') // 切人物肖像（固定剪影+名字chip）
__kit.setMode('acts' | 'chars')    // 切库模式
__kit.setOrientation('land' | 'port') // 切画幅：横屏16:9 / 竖屏9:16（重排当前动作/肖像）
__kit.seek(0.62)                   // 定位到 t01 并暂停（确定性截图用）
__kit.pause() / __kit.play()
__kit.params                       // 实时参数对象 P（可直接改 scale/amp/ease/theme/orient…）
__kit.time / __kit.action / __kit.mode
__kit.orientation                  // 'land' | 'port'
__kit.canvas                       // { W, H, GROUND } 当前活画幅
```

## 4. 自动化验收模板

任何能跑 JS 的浏览器自动化（ego-browser / Playwright / Puppeteer）都适用：

```js
// 页面内执行：双画幅全库 sweep，收集运行时错误
const errs = [];
for (const orient of ['land', 'port']) {
  __kit.setOrientation(orient);
  for (const a of ACTIONS) {
    try {
      __kit.setAction(a.id);
      for (const f of [0, .12, .3, .5, .7, .9, 1]) __kit.seek(f);
    } catch (e) { errs.push(orient + '/' + a.id + ': ' + e.message); }
  }
}
return errs;   // 期望 []
```

配合控制台监听（console error / pageerror 期望 0）、关键帧截图、移动端视口（390×844）截图。
**双画幅 sweep 是库维护验收**（改 kit/actions 后跑一次，保证库在两种画幅都成立）；**按案件交付时只验收用户选中的画幅**（SKILL.md Step 4），不重复跑全库双画幅。
截图时建议模拟 `prefers-reduced-motion: reduce`（CDP `Emulation.setEmulatedMedia`），避免无头环境 CSS transition 停在中途导致按钮高亮与状态不同步；页面本身已内置该媒体查询（无障碍）。
本库开发期截图在 `qa/`：pXX-*.png 肖像、v-*.png 变体、a-*.png 动作关键帧、ui-*.png 界面、m-*.png 移动端。

## 5. 导出

- **当前帧 SVG**：克隆舞台 → 补 xmlns/width/height/viewBox（= 当前画幅）→ 序列化下载。独立打开即所见即所得（滤镜、灰化 style 一并带走）。文件名 `svg-kit-<action>-<land|port>-f<frame>.svg`。
- **参数 JSON**：`{ action, category, time, frame, orientation, params, events, phases, cast }`。`orientation = { id, label, W, H, GROUND, os, vs, cs, ts }`，Remotion 用它设 composition 宽高。给 Remotion/剪辑对轨用：events.at × dur = 音效秒点。

## 6. 移植 Remotion（整段动画）

完整合成配方（bundle 打包、KitShot 组件、整片骨架、已验证版本组合）见 [remotion.md](remotion.md)，本节只讲原理。

`update(t01, P)` 是纯函数，移植只需换时钟：

```tsx
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();
useEffect(() => { api.update(frame / durationInFrames, P); }, [frame]);
```

- 在 Remotion 组件 mount 时执行一次 `act.build(S)` 建 SVG 树（挂在 ref 容器内），之后每帧只调 update。
- **先 `setOrientation(orientation.id)` 再 build**：composition 宽高用 JSON 的 `orientation.W/H`；**只建案件选中画幅这一个 composition**，不横竖各建一份。项目日后改画幅时切换后重建即可。
- `P` 用 JSON 导出的 params 固定下来，保证逐帧确定性。
- 需要透明底：去掉 bgRect/groundRect/grain 三层，只留 sceneRoot。
- 音效：按 events 在 `<Audio>`/`<Sequence>` 上对齐 at × durationInFrames。

## 7. 常见问题

- 人物"没手接物"：cast 忘了 `opt:{noProp:true}` 或 hand 锚点写错 → 看参考线十字（开参考线）。
- 接物方背对镜头：flip 传错 → 用 `faceFlip(C, want)`，不要手写 ±1。
- 导出 SVG 打开是空白：克隆时丢了 `xmlns` 或滤镜 id 冲突 → 用预览台导出按钮，不要手抄 innerHTML。
- 灰化不生效：gray 参数走内层 tint 的 saturate；外层 cutout 不受影响（描边保持米白）。
- 竖屏里两人手交叉/道具错位：检查是否手写了画布坐标。动作里只写设计空间坐标，场景字面量必须过 `X()/Yg()/Ys()`（见 §8）。

## 8. 双画幅坐标契约（16:9 / 9:16）

动作与人物永远写在**设计空间** `1080×800, GROUND=700`；活画幅由 `setOrientation(id)` 切换：

| id | 画幅 | W×H | GROUND | os 物件 | vs 天空 | cs 人物 | ts 文字 |
|---|---|---|---|---|---|---|---|
| land | 横屏 16:9 | 1920×1080 | 945 | 1.15 | 1.6 | 1.15 | 1.15 |
| port | 竖屏 9:16 | 1080×1920 | 1640 | 1.3 | 2.0 | 1.3 | 1.2 |

映射函数（kit.js 全局）：

```js
X(x)  = x * W / 1080              // 横向：横屏拉开、竖屏保持原手距
Yg(y) = GROUND + (y - 700) * os   // 贴地物件：桌/文书/印章/钱堆/裂缝，位置与尺寸同因子缩放
Ys(y) = GROUND + (y - 700) * vs   // 天空 UI：chip/计数器，vs > os 抬进上方安全区边缘
```

自动映射 choke point（动作代码无需手换算）：
- `makeChar.set/hand`：x → X(x)，s → s × cs；返回的 hand 锚点已是画布坐标。
- `chip(g,x,y,text,color,fs)`：x → X、y → Ys、fs → fs × ts。
- `qbez/qd`：lift 自动 × os。

需要手映射的只有**场景字面量**（自定义道具位置、闪光 rect、裂缝组等）：位置用 `X()/Yg()`、尺寸乘 `O.os`；天空文字用 `Ys()` 与 `O.ts`。`anchors()/guidePath()` 返回**画布坐标**（即映射后的值）。

竖屏构图规则：W=1080 与设计空间同宽 → 所有交接/握手/上铐的手距不变；人物贴 GROUND=1640 布置，上方约 40%（y < ~760）是标题/字幕安全区，只允许天空 UI 与水印进入。横屏则靠 X 因子 1.78 拉开双人距离，构图更舒展。