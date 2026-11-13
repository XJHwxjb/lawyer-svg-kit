# Remotion 组件（整片合成用）

四个风格无关的纯帧函数组件，复制到案件项目后按需改造。**人物与剧情动作一律用主库**（kit.js / actions.js，移植方法见 [../references/studio.md](../references/studio.md) 与 [../references/remotion.md](../references/remotion.md)）；这里只放主库没有的镜头与图示能力。

| 文件 | 用途 | 与主库的分工 |
|---|---|---|
| `CameraRig.tsx` | 镜头推进/平移 + 分层视差（`cameraAt` / `CameraLayer`） | 包住主库渲染出的 SVG 场景层；字幕/头像层放在镜头外 |
| `LegalMotion.tsx` | 天平摆动、法槌落槌、清单逐行描线（图标级动画） | **有人物敲槌** → 主库 `gavel-drop`；**无人物的图标动效** → 这里 |
| `DocumentTransition.tsx` | 文书桌面→近看→归档的整镜转场（1920×1080） | **人物之间递文书** → 主库 `doc-handoff`；**文书独自贯穿三个画面** → 这里。竖屏项目需重排坐标，不能只改画布 |
| `TrackedVideo.tsx` | 人脸追踪人物窗（`cropAt` / `TrackedVideo`，方窗/圆裁） | 消费 `scripts/face_track.py` 的轨道 JSON；**轨道以源视频帧计**，组件内按 fps 换算。手持素材专用，固定机位不需要 |

共同约定：

- `frame` 一律是**本镜头局部帧**（`useCurrentFrame()` 在 `Sequence` 内从 0 起算），`fps` 与合成一致；任意跳帧结果相同。
- 组件只依赖 React，无其他依赖；`npx tsc --noEmit` 可通过（需项目已装 remotion/react 类型）。
- 文案只填经稿件核对的值；`DocumentTransition` 的 `title` 不传时保持无字图形。
- 这些是起点不是成片：接进项目后按 [../references/delivery-qa.md](../references/delivery-qa.md) 从最终 MP4 验收。