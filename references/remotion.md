# 用口播视频和 SRT 合成：Remotion 起步配方

本配方帮助 Agent 从视频与带时间戳的字幕搭起**可运行的基底**：真人/头像层 + 逐句字幕层 + 主库动画场景层。它不自动理解法律稿件或生成分镜；场景内容必须按 [workflow.md](workflow.md) 的分镜逐句替换。所有命令在**复制出的案件项目目录**执行，不是 Skill 安装目录；客户素材不得放入公开仓库、Skill 目录或云端。

`source.mp4`、`input.srt`、`lawyer-film.mp4` 是演示名称。先复制并重命名副本，禁止覆盖原件。只有普通稿件没有 SRT 时，先用本地可用工具转写并对照录音校对；没有工具时如实说明，不能编造时间戳。

## 0. 搭项目骨架

新建案件项目目录，写入 `package.json`（版本已经过验证）：

```json
{
  "name": "lawyer-film",
  "private": true,
  "scripts": {
    "dev": "remotion studio src/index.tsx",
    "typecheck": "tsc --noEmit",
    "render": "remotion render src/index.tsx LawyerFilm out/lawyer-film.mp4 --codec=h264 --crf=17"
  },
  "dependencies": {
    "@remotion/cli": "4.0.534",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "remotion": "4.0.534"
  },
  "devDependencies": {
    "@types/react": "19.2.0",
    "typescript": "5.9.2"
  }
}
```

`tsconfig.json`（`allowJs` 让主库 bundle 可被 TS 入口导入）：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "allowJs": true, "checkJs": false,
    "resolveJsonModule": true, "esModuleInterop": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["src"]
}
```

逐项执行 `node --version`（需 20+）、`npm --version`、`python --version`、`ffmpeg -version`、`ffprobe -version`，缺失先解决再继续。然后 `npm install`。Windows PowerShell 中 `npm`/`npx` 可换成 `npm.cmd`/`npx.cmd`。

**引入主库**：把 Skill 的 `kit.js` 与 `actions.js` 复制进项目并拼成一个 ES 模块（两文件共享同一模块作用域，内部引用自然成立；不改动 Skill 原件）：

```bash
mkdir -p src/kit
cp "<技能目录>/kit.js" "<技能目录>/actions.js" src/kit/
cat src/kit/kit.js src/kit/actions.js > src/kit/bundle.js
printf '\nexport { ACTIONS, CHARS, CATS, THEMES, setOrientation, makeChar, buildBG, el, chip, faceFlip };\n' >> src/kit/bundle.js
```

## 1. 安置和检查素材

将视频和字幕复制到 `public/media/source.mp4`、`input.srt`（路径含空格加引号）。原件保留；非 MP4 素材复制实际文件并改代码中的文件名。重编码、旋转、裁剪前先对照源素材确认：

```bash
ffprobe -v error -show_streams -show_format -of json "public/media/source.mp4"
```

查看分辨率、旋转标记、时长、视频流与音轨；在播放器中确认画面方向、人脸位置、开头结尾及实际音画同步。手机竖拍、变帧率和多音轨素材要特别检查；不要默认第一条音轨是目标声音。**画幅以项目选定的单一画幅为准**（横屏 16:9 或竖屏 9:16，见 SKILL.md），composition 宽高取主库导出 JSON 的 `orientation.W/H`。

## 2. 将时间戳转成数据

用 Skill 自带脚本（唯一实现，不要另写一份重复逻辑）：

```bash
python "<技能目录>/scripts/prepare_timing.py" --video "public/media/source.mp4" --srt "input.srt" --output "src/timing.json" --fps 30
```

成功后 `src/timing.json` 含 `fps`、`durationInFrames`、`durationSeconds` 和 `cues`（每条 `start`/`end` 秒 + 原文 `text`）。脚本会校验时间格式、顺序、空字幕与超出视频时长，并提示重叠。使用前逐句对照原 SRT 和实际口播——SRT 不保证准确。

帧 `f` 的展示时间为 `f / fps` 秒；字幕在 `start <= f/fps < end` 时显示。`ceil(时长 × fps)` 避免截断尾部，不应用它改变声音速度。容器时长异常或音轨比画面长时，检查各流时长按实际材料调整，不能盲信容器值。脚本不可用（无 Python/ffprobe）时如实说明障碍，不能编造时间戳。

## 3. 组装真人、字幕与主库动画

### 3.1 主库场景组件 KitShot

`update(t01, P)` 是纯时间函数：mount 时建一次 SVG 树，之后每帧只调 update。保存为 `src/KitShot.tsx`：

```tsx
import React, {useEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ACTIONS, THEMES, setOrientation, makeChar, buildBG, el} from './kit/bundle';

const DEFS = `<defs>
  <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
    <stop id="bgStop1" offset="0"/><stop id="bgStop2" offset="1"/>
  </linearGradient>
  <filter id="cutout" x="-40%" y="-40%" width="180%" height="180%">
    <feMorphology id="cutDilate" in="SourceAlpha" operator="dilate" radius="6" result="d"/>
    <feFlood flood-color="#fff6e8" result="f"/>
    <feComposite in="f" in2="d" operator="in" result="o"/>
    <feDropShadow id="cutShadow" in="o" dx="0" dy="9" stdDeviation="6" flood-color="#1a1408" flood-opacity=".35" result="s"/>
    <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;

export const KitShot: React.FC<{actionId: string; orient: 'land' | 'port'; params: any}> =
 ({actionId, orient, params}) => {
  const ref = useRef<SVGSVGElement>(null);
  const apiRef = useRef<{update: (t: number, P: any) => void} | null>(null);
  const frame = useCurrentFrame();                 // Sequence 内局部帧
  const {durationInFrames} = useVideoConfig();

  useEffect(() => {                               // 建树：每个镜头一次
    const svg = ref.current!;
    const O = setOrientation(orient);             // 必须先切画幅再 build
    svg.setAttribute('viewBox', `0 0 ${O.W} ${O.H}`);
    svg.innerHTML = DEFS;
    const T = THEMES[params.theme];
    const bg = el('g', {}, svg);
    el('rect', {width: O.W, height: O.H, fill: 'url(#bgGrad)'}, bg);
    buildBG(bg, params.bg, params.theme);
    const scene = el('g', {}, svg);
    const act = ACTIONS.find((a: any) => a.id === actionId)!;
    const below = el('g', {}, scene);
    const chars: any = {};
    for (const c of act.cast || [{id: 'man', who: 'man'}, {id: 'woman', who: 'woman'}])
      chars[c.id] = makeChar(scene, c.who, c.variant, c.opt);
    const above = el('g', {}, scene);
    const fx = el('g', {}, scene);
    const S = {below, above, fx, chars, man: chars.man, woman: chars.woman};
    svg.querySelector('#bgStop1')!.setAttribute('stop-color', T.bg1);
    svg.querySelector('#bgStop2')!.setAttribute('stop-color', T.bg2);
    svg.querySelector('#cutDilate')!.setAttribute('radius', params.outline);
    svg.querySelector('#cutShadow')!.setAttribute('stdDeviation', (params.shadow * .6).toFixed(1));
    svg.querySelector('#cutShadow')!.setAttribute('dy', (params.shadow * .9).toFixed(1));
    apiRef.current = act.build(S);
  }, [actionId, orient]);

  useEffect(() => {                               // 每帧求值：任意跳帧一致
    apiRef.current?.update(frame / durationInFrames, params);
  }, [frame, actionId, orient]);

  return <svg ref={ref} width="100%" height="100%" style={{position: 'absolute', inset: 0}}/>;
};
```

要点：

- `params` 用预览台**导出 JSON 的 params 块**原样固定（含稿件替换后的金额/文案），保证逐帧确定性；`orientation` 块决定 `orient` 与 composition 宽高。**只建案件选中画幅这一个 composition**。
- Sequence 的 `durationInFrames` = 动作 `dur` 秒 × fps（dur 见导出 JSON 或 roster）；`t01 = 局部帧 / durationInFrames`。
- 需要透明底叠在真人画面上：去掉 bg 层（bgGrad rect + buildBG），只留 scene。
- 音效：按导出 JSON `events[].at × dur` 秒点在 `<Sequence>`/`<Audio>` 上对齐。
- 镜头推进/分层见 [camera.md](camera.md)；图标动效与文书转场用 [remotion/](../remotion/README.md) 组件。

### 3.2 整片入口

保存为 `src/index.tsx`。视频自带音轨只用一次，不额外叠加同源 `<Audio>`。中文字体需本机有 CJK 字体；真人窗口位置按源画幅调整（下例为横屏演示）：

```tsx
import React from 'react';
import {AbsoluteFill, Composition, OffthreadVideo, Sequence, registerRoot,
        staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import timing from './timing.json';
import {KitShot} from './KitShot';
import params from './params.json';   // 预览台导出 JSON 的 params 块

const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const captions = timing.cues.filter(c => c.start <= time && time < c.end);
  return <AbsoluteFill style={{backgroundColor: '#0b1724', color: 'white'}}>
    {/* 动画层：按分镜排布多个 Sequence，下例仅一个镜头占位 */}
    <Sequence from={0} durationInFrames={Math.round(4.6 * fps)}>
      <KitShot actionId="doc-handoff" orient="land" params={params}/>
    </Sequence>
    {/* 真人层：独立稳定窗口，不随镜头运动 */}
    <div style={{position: 'absolute', left: 70, top: 120, width: 520, height: 690,
                 borderRadius: 24, overflow: 'hidden', background: '#16283b'}}>
      <OffthreadVideo src={staticFile('media/source.mp4')}
        style={{width: '100%', height: '100%', objectFit: 'contain'}}/>
    </div>
    {/* 字幕层：稳定图层，避开真人与动画 */}
    <div style={{position: 'absolute', left: 180, right: 180, bottom: 65, textAlign: 'center',
                 fontFamily: 'Microsoft YaHei, Noto Sans CJK SC, sans-serif', fontSize: 42,
                 fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.35,
                 textShadow: '0 2px 8px #000, 0 0 4px #000'}}>
      {captions.map(c => c.text).join('\n')}
    </div>
  </AbsoluteFill>;
};
registerRoot(() => <Composition id="LawyerFilm" component={Film} width={1920} height={1080}
  fps={timing.fps} durationInFrames={timing.durationInFrames}/>);
```

### 3.3 必须按实际项目调整的地方

| 项目 | 示例中的位置 | 实际处理 |
| --- | --- | --- |
| 画幅 | `width={1920} height={1080}`、`orient="land"` | 取项目选定画幅与导出 JSON 的 orientation 块；竖屏须重排真人窗口与字幕，不能只改画布数字 |
| 视频文件名 | `staticFile('media/source.mp4')` | 与 `public/media/` 下实际文件完全一致 |
| 真人窗口 | `left:70, top:120, width:520, height:690` | 按源画幅与人物位置调整；全程检查人脸和手势 |
| 字幕位置和大小 | `left/right/bottom`、`fontSize:42` | 避开真人、动画和平台遮挡区；长句分行，字不出框 |
| 动画镜头 | 单个 `Sequence` + `KitShot` | 按逐句分镜替换为多个镜头，起止覆盖整段叙事；每个镜头的 actionId/params 来自分镜与导出 JSON |
| 输出文件 | `out/lawyer-film.mp4` | 改成用户指定路径；不覆盖输入素材 |

`contain` 保留原始画面；需要充满窗口裁切时改 `cover` 并按**实际逐帧人脸位置**调 `objectPosition`。口播原音与画面必须来自同一持续播放的视频层；确需单独提取/降噪/混音时静音视频层，只播放同步处理后的音轨并按素材起始时间对齐，检验无双声、重复或漂移。切割后的多个片段按相同源时间切音视频，不单独改变任何一方速度。

`<Sequence from={起始帧} durationInFrames={帧数}>` 的 `from` 是全局输出帧，子组件 `useCurrentFrame()` 从该段起点重新计数。真人视频层保持连续播放，场景切换不重新启动视频或音频。用户给的是头像或单独音频时另行设计展示与音轨，不能声称静态头像是口播视频。

## 4. 渲染并复查

```bash
npm run typecheck
npm run render
ffprobe -v error -show_streams -show_format -of json "out/lawyer-film.mp4"
```

首次渲染可能需要 Remotion 支持的浏览器；按本机条件安装或用 `--browser-executable="浏览器路径"`。源视频音轨/编码不能被浏览器解码时，先在**案件项目中**用 ffmpeg 创建兼容副本并检查同步、方向与质量；不覆盖原件。变帧率素材须实播检查全程同步。按 [delivery-qa.md](delivery-qa.md) 实听、实看、对照字幕并记录结果；本示例只是起点，完整分镜、数据核对和成片质量仍由 Agent 完成。

## 常见问题：先看现象，再找原因

| 现象 | 检查和处理 |
| --- | --- |
| `ffprobe` 或 `node` 找不到 | 检查安装与 PATH；修复后重新执行版本命令，不要跳过素材检查 |
| 找不到 `timing.json` | 先成功运行时间轴脚本；确认文件真的写在项目 `src/` 下 |
| 找不到视频或画面黑 | 核对 `public/media/` 文件名与 `staticFile()` 路径大小写、编码和权限 |
| 找不到 `LawyerFilm` | 确认入口是 `src/index.tsx` 且注册的 `<Composition id>` 与渲染命令一致 |
| KitShot 空白 | bundle 是否拼接并追加了 export；`setOrientation` 是否在 build 之前；viewBox 是否等于当前画幅 |
| 人物描边/投影消失 | DEFS 里的 `cutout` 滤镜是否注入；`cutDilate/cutShadow` 参数是否按 params 设置 |
| 字幕乱码、错位或溢出 | 检查 SRT 编码与时间、中文字体、安全区和句长；播放前中后并修正 |
| 声音重叠、回声或不同步 | 同源视频与 `<Audio>` 是否同时播放？视频只用一条原声；独立混音时静音视频层并对齐 |
| 动作与口播错位 | 检查 Sequence 的 from/durationInFrames 与局部帧换算；全局帧与局部帧不混用 |
| 找不到浏览器或无法渲染 | 按 Remotion 报错安装/指定 Chromium；不要在失败后声称成片已导出 |

有错误时保留原始报错、检查路径和依赖，再小范围修改并重试。无法解决时交付实际已完成的文件和明确障碍，不能把代码示例描述成已经产生的成片。