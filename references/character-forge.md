# 造人物教程（character-forge）

目标：库里没有的角色，用同一套剪影语法造出来，注册后即可被所有动作工厂使用。

## 1. 风格语法（不可偏离）

- **无表情**：不画五官。身份靠"帽子 / 制服色 / 手持道具"三件套 + 姿态开关。
- **胶囊四肢**：`limb(g, d, color, width)` = round-cap 描边路径；手是 `mitt(g,x,y,r)` 圆点。
- **躯干**：一条闭合 bezier 色块（`TORSO_M` 或自定义 path）。
- **头**：ellipse + `hairCap()` 发盖；帽子用 path/rect 叠在头上。
- **贴纸感**：不用自己画描边——`makeChar` 外层套 `#cutout` 滤镜（feMorphology 膨胀 + 米白 flood + 投影），内层 `#gray` 供灰化。
- **道具无文字**：baked 手持道具会被镜像（flip=-1），文字会反。文字只允许出现在飞行道具/chip。

## 2. 坐标契约

- 局部坐标：脚底 `(0,0)`，向上为负。成人头心 ≈ `(0,-272)`，手 ≈ `(80,-158)`。
- 世界：`GROUND=700`；`set(x,s,deg,flip,gray,op)` 把脚底放到 `(x,700)`。
- 接物锚点写进注册表 `hand`；举手姿势用 `[55,-266]`（配合 `bodyBase({raise:true})`）。
- 小孩等小体型：整体缩小画（头心 -170、手 [55,-105]）并标 `small:true`（影子半径自动变小）。

## 3.  helper 速查（kit.js）

```js
el(tag, attrs, parent)            // 建 SVG 节点
limb(g, d, c, w)                  // 胶囊四肢
mitt(g, x, y, r)                  // 手圆点
hairCap(g, rx, ry, cy, fill)      // 发盖（rx/ry=头半径, cy=头心y）
bodyBase(g, o)                    // 一次画完四肢+躯干+头
held(g, propFn, noProp, rot, sc)  // 把道具挂到 (80,-158)，noProp=true 时不挂
```

`bodyBase(g, o)` 的 o：
| 键 | 默认 | 作用 |
|---|---|---|
| torso / torsoC | TORSO_M / 必填 | 躯干 path 与色 |
| armC / armW | 必填 / 14 | 手臂色/粗 |
| legC / legW / legY | 必填 / 17 / -134 | 腿色/粗/起点 |
| shoeC / shoeH | 必填 / 12 | 鞋 |
| headRx / headRy / headCx | 24 / 26 / 0 | 头尺寸/偏移（驼背用 headCx:6） |
| raise | false | true=举手臂到 (55,-266) |
| vest / vestC | — | 叠一件马甲/反光背心 path |
| stroke | none | 躯干描边色（白大褂用 #c9d4dc） |

调色板 `PAL`：skin/skinShade/hairM/hairW/shirt/pants/dress/shoe/ink/paper/seal/sealDeep/gold/jade/azure。新制服色直接写 hex，但优先复用 PAL 保持全片统一。

## 4. 五步造人

1. **选模板**：找最接近的现有 draw 复制。制服类→`drawPolice`；袍类→`drawJudge`；西装→`drawLawyer`/`drawBoss`；工装→`drawWorker`；老幼→`drawParent`/`drawChild`。
2. **改三件套**：帽子 path、制服色、手持道具（复用 `propFolder/propLawBook/propLedger/...`，没有就写一个无文字小道具函数）。
3. **写 draw 函数**：`function drawXxx(g, o = {}) { bodyBase(g, {...}); /*帽/徽/条*/ hairCap(...); held(g, propYyy, o.noProp, rot); /*变体开关*/ }`。
4. **注册**：在 `CHARS` 加一行 `{ label, group, hand, draw, desc, variants }`；只换色/换道具的需求做成 variants 的 `opt`，不要新 draw。
5. **验收**：预览台人物图鉴点新角色看肖像；`__kit.setPortrait(id)` 截图；再把它塞进一个 actHandoff 当接物方，检查 `flip=-1` 镜像后道具/帽子不穿帮。

## 5. 完整示例：造"税务员"

```js
/* kit.js：道具（无文字） */
function propTaxFolder(g) {
  el('rect', { x: -40, y: -52, width: 80, height: 104, rx: 6, fill: '#3a7bd5', stroke: '#2b5c9e', 'stroke-width': 2 }, g);
  el('rect', { x: -30, y: -40, width: 60, height: 8, rx: 4, fill: PAL.gold }, g);
  el('circle', { cx: 0, cy: 6, r: 16, fill: 'none', stroke: PAL.gold, 'stroke-width': 3 }, g);
  el('path', { d: 'M-8,6 h16 M0,-2 v16', stroke: PAL.gold, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
  return g;
}
/* kit.js：人物 */
function drawTaxOfficer(g, o = {}) {
  const u = o.uniform || '#274058';
  bodyBase(g, { torsoC: u, armC: u, legC: '#23262e', shoeC: '#1a1d24' });
  el('path', { d: 'M-24,-286 q24,-14 48,0 l-4,10 q-20,-8 -40,0 z', fill: u }, g);   // 大檐帽顶
  el('rect', { x: -26, y: -278, width: 52, height: 6, rx: 3, fill: '#1a1d24' }, g);  // 帽檐
  el('circle', { cx: 0, cy: -288, r: 3.5, fill: PAL.gold }, g);                      // 帽徽
  el('path', { d: 'M-4,-238 L4,-238 L5,-150 L-5,-150 Z', fill: PAL.gold, opacity: .9 }, g); // 领带
  hairCap(g, 24, 26, -272, '#2f2a26');
  held(g, propTaxFolder, o.noProp, -8);
}
/* CHARS 注册 */
tax: { label: '税务员', group: 'court', hand: [80, -158], draw: drawTaxOfficer,
  desc: '深蓝制服+大檐帽+税徽文件夹：税务稽查/送达', variants: [] },
```

然后造动作（action-forge.md）：`actHandoff({ id:'tax-notice', from:'tax', to:'boss', prop:'doc', title:'税务处理决定书', cast:[{id:'tax',who:'tax',opt:{noProp:true}},{id:'boss',who:'boss'}] })`。

## 6. 常见坑

- 帽子画在 hairCap **之后**才会盖住头发；先画帽再画发会露发边。
- `held()` 的 rot 是道具自身旋转；接物飞行道具的旋转由动作控制，两者别叠加过猛。
- 变体 opt 会与动作 cast 的 opt 合并（cast 优先），所以 `noProp` 永远能在动作侧关掉 baked 道具。
- 新人物忘了写 `hand` → 所有交接动作接物点错位；忘了 `group` → 图鉴分组崩溃。