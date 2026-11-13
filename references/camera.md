# 镜头推进与分层

帮助画面从固定正面讲解变为具有空间关系的镜头。这是一套二维分层方案，并非真实三维透视。两条路线同一套数学：

- **零依赖**：[camera.js](../camera.js)（`cameraAt` / `applyCamera` / `camFocus` / preset），按 t01∈[0,1] 求值，pipeline/ 模板已接好。
- **Remotion**：[remotion/CameraRig.tsx](../remotion/CameraRig.tsx)（`cameraAt` / `CameraLayer`），按帧求值，复制到案件项目后使用。

本文档管**动画场景层**的镜头。真人小窗自己的手持漂移是另一回事：用 [face-track.md](face-track.md) 的追踪裁切（`TrackedVideo` 或 sendcmd 预裁切），不要拿场景镜头去追人脸。

## 零依赖路线（camera.js，默认推荐）

加载顺序：`kit.js → camera.js → actions.js`。镜头状态用画布像素，`scale > 1` = 推进放大。

**最小用法（照抄）**：把地面 + 场景底 + 人物场景包进一个 `<g id="camWorld">`（背景渐变、水印、字幕放在外面），每帧：

```js
// 焦点：设计空间坐标（1080×800, GROUND=700）→ 画布像素，不要手写画布坐标
const focus = camFocus(540, 430);
// 选一个 preset（见下表），t01 = 当前时间 / 镜头总时长
const keys = presetCamera('hold', focus);
applyCamera(document.getElementById('camWorld'), cameraAt(t01, keys));
// camera: 'off' 时：camWorld.removeAttribute('transform')
```

**preset 一览**（全部保证 scale ≥ 1，焦点固定不抖）：

| preset | 效果 | 用在哪 |
|---|---|---|
| `push` | 1 → 1.1 全程缓慢推进 | 叙事铺垫、开场 |
| `hold` | 前 40% 推近到 1.12，之后停留（带 1% 极缓漂移防冻结） | **数字/文书镜头首选**（停稳让观众读清） |
| `impact` | 事件时刻快速 punch 到 1.14 再落到 1.06（前后带极缓漂移防冻结） | 敲槌/盖章/摔碎，`camImpact(focus, at)` 的 at 对齐事件秒点/镜头时长 |
| `pan` | 焦点左 → 右横移，scale 1.08 | 时间线、双方对照 |
| `breathe` | 1 → 1.045 → 1 极缓起伏 | 否则完全静止的镜头兜底 |
| `off` | 不动（presetCamera 返回 null） | 仅当镜头内有持续动作时允许 |

**手写关键帧**：`cameraAt(t01, [{at:0, x, y, scale:1}, {at:.4, x, y, scale:1.12}, {at:1, x, y, scale:1.12}])`。`at` 必须递增、取值 [0,1]；x/y 是希望出现在画面中心的画布坐标；scale > 0（全舞台镜头必须 ≥ 1，否则边缘露底）。边界之外保持首/末状态。

**规则**：
- 一个镜头内焦点固定（mount 时取一次锚点或显式 `focus`），不要每帧换焦点。
- `depth` 参数默认 1（全量跟随）。**不要用 depth < 1 做视差**：贴地家具/人物会离地漂移；整个动作世界放同一层。
- pipeline 模板里这些都已接好：每镜头在 film.config.js 填 `camera` 与 `focus` 即可，不需要手写上面的代码。

## Remotion 路线：接上主库场景

`CameraLayer` 包住 [remotion.md](remotion.md) 的 `KitShot` 即可；字幕、头像和固定界面放在镜头层之外，避免被放大或移动：

```tsx
import {useCurrentFrame} from 'remotion';
import {CameraLayer, cameraAt, type CameraKey} from './CameraRig';
import {KitShot} from './KitShot';

const keys: CameraKey[] = [
  {frame: 0, x: 960, y: 540, scale: 1},
  {frame: 60, x: 1000, y: 520, scale: 1.12},
];
const Shot: React.FC = () => {
  const f = useCurrentFrame();   // 镜头局部帧；没有 Sequence 时先减去镜头起始帧
  const camera = cameraAt(f, keys);
  return <>
    <CameraLayer camera={camera} depth={0.2}><Background /></CameraLayer>
    <CameraLayer camera={camera} depth={1}>
      <KitShot actionId="doc-handoff" orient="land" params={params}/>
    </CameraLayer>
    <Captions />
  </>;
};
```

`Background`、`Captions` 为你的组件。画布尺寸默认 1920×1080；**竖屏项目**把 `CameraLayer` 的 `width/height` 与关键帧中心坐标改为 1080×1920 体系，关键帧坐标按构图重设，不能沿用横屏数值。

## 规则

- `keys` 至少一项；`frame` 为同一时间坐标中的有限数字，严格递增；`x/y` 是希望出现在画面中心的画布坐标，`scale` 必须大于 0。关键帧之前和之后保持边界状态。
- `depth` 介于 0 和 1，越大越跟随镜头；超出范围会被限制。建议背景 0.1–0.3，人物和人物持有的道具共同为 1。**不要把同一次交接的手和物品放到不同运动层**，否则接触点会漂移——主库的一个动作整体放在同一层。
- 片段开始的镜头状态应与上个镜头结束状态相同，除非明确设计切镜；缩放时在最终视频中检查画面边缘，避免底色缝隙、人物被裁掉或字幕遮挡。字幕和头像留在安全区，实际平台安全区以用户要求为准。
- 有意义地移动：叙事变为核对材料时再推进，重要信息给足阅读时间；不要对所有句子持续缩放。人物、证据及文字不得暗示原稿没有的事实。为 25/60fps 项目按实际帧率重新计算帧号，不要直接沿用示例的 30fps 数值。
- **动感最低要求（SKILL.md §0.6）**：每镜头必须有镜头运动或持续动作，二者至少其一；镜头之间必须有转场（pipeline 默认 12 帧交叉淡化）；禁止全片硬切、全片固定机位。

如需移动纸张并衔接到下一镜，下一镜必须继承纸张前一镜结束时的画面坐标、尺寸和朝向，或明确设计一次切镜（文书独自贯穿多画面可用 [remotion/DocumentTransition.tsx](../remotion/DocumentTransition.tsx)）；最后在真实成片检查镜头交界前后相邻帧和画面可读性。音效可对准纸张落下等动作，但不能盖过旁白。

## 验收

从最终渲染抽查开头、运动中段和停止帧，并连续播放；检查推进过程中字幕、头像、主要信息始终清晰且在安全区，缩小到手机尺寸复查。静态终点看似正常不代表运动过程合格。