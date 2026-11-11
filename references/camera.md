# 镜头推进与分层

帮助画面从固定正面讲解变为具有空间关系的镜头。这是一套二维分层方案，并非真实三维透视。组件在 [remotion/CameraRig.tsx](../remotion/CameraRig.tsx)（`cameraAt` / `CameraLayer`），复制到案件项目后使用。

## 接上主库场景

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

如需移动纸张并衔接到下一镜，下一镜必须继承纸张前一镜结束时的画面坐标、尺寸和朝向，或明确设计一次切镜（文书独自贯穿多画面可用 [remotion/DocumentTransition.tsx](../remotion/DocumentTransition.tsx)）；最后在真实成片检查镜头交界前后相邻帧和画面可读性。音效可对准纸张落下等动作，但不能盖过旁白。

## 验收

从最终渲染抽查开头、运动中段和停止帧，并连续播放；检查推进过程中字幕、头像、主要信息始终清晰且在安全区，缩小到手机尺寸复查。静态终点看似正常不代表运动过程合格。