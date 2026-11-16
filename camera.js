/* camera.js — 零依赖镜头模块（v0.5 新增）
   与 remotion/CameraRig.tsx 同一套数学，但按 t01∈[0,1] 求值（kit 的时钟是时间不是帧）。
   依赖 kit.js 的全局 W/H/X/Yg，必须在 kit.js 之后加载。

   ── 给制作 Agent 的最小用法（照抄即可）──────────────────────────────
   1) HTML 里把"会随镜头移动的世界"包进一个 <g id="camWorld">：
      地面 groundRect + 地平线 groundLine + 场景底 bgFurn + 人物场景 sceneRoot。
      背景渐变 bgRect、水印、字幕、头像放在 camWorld 外面（它们不该动）。
   2) 每帧（t01 = 当前时间 / 镜头总时长）：
        const keys = presetCamera('push', camFocus(540, 430)); // 设计空间焦点
        applyCamera(camWorld, cameraAt(t01, keys));
   3) 整片模板 pipeline/film.html 已接好，案件制作优先用模板，不要手搓。

   ── 硬规则 ─────────────────────────────────────────────────────────
   · 镜头状态一律用画布像素。
   · v0.13 去放大化：preset 一律纯平移（scale 恒 1），不做缩放动画——
     可读性由 params.scale 静态放大承担，冲击感由道具级动画+音效承担。
     手写 keys 想静态放大可以 scale>1，但必须全程恒定，禁止缩放动画。
   · 全舞台镜头（camWorld 包整个画面）时 scale 必须 ≥ 1，否则画面边缘露底。
     本文件所有 preset 都保证 ≥ 1；手写 keys 时自己守住这条。
   · keys 的 at 必须递增、取值 [0,1]；cameraAt 会校验并抛错。
   · 焦点用 camFocus(x, y)：传设计空间坐标（1080×800, GROUND=700），
     返回画布坐标。不要手写画布像素，换画幅会错位。
   · 一个镜头内焦点固定（mount 时取一次锚点），不要每帧换焦点，否则画面抖。
   · transform 数值精度：scale 至少 4 位小数（0.0001）。量化到 0.01 会让推近
     "停数帧跳一次"（放大抖动、平移/静止不抖）；translate 0.01px 即可。
*/
'use strict';

const camMix = (a, b, p) => a + (b - a) * p;
const camSmooth = p => { const v = Math.max(0, Math.min(1, p)); return v * v * (3 - 2 * v); };
/* 线性为主+少量缓动：首尾速度不趋零，30fps 下不出现"伪冻结"，观感更连续。 */
const camGlide = p => { const v = Math.max(0, Math.min(1, p)); return .72 * v + .28 * camSmooth(v); };

/** keys: [{at, x, y, scale}]，at 递增；at 之前/之后保持边界状态。返回 {x,y,scale}。 */
function cameraAt(t01, keys) {
  if (!keys || !keys.length) throw new Error('cameraAt 至少需要一个关键帧');
  if (keys.some((k, i) =>
    !Number.isFinite(k.at) || !Number.isFinite(k.x) || !Number.isFinite(k.y) ||
    !Number.isFinite(k.scale) || k.scale <= 0 ||
    (i > 0 && k.at <= keys[i - 1].at)))
    throw new Error('镜头关键帧必须有限、at 递增且 scale > 0');
  const next = keys.findIndex(k => k.at > t01);
  if (next === 0) return { x: keys[0].x, y: keys[0].y, scale: keys[0].scale };
  if (next < 0) { const k = keys[keys.length - 1]; return { x: k.x, y: k.y, scale: k.scale }; }
  const a = keys[next - 1], b = keys[next];
  const p = camGlide((t01 - a.at) / (b.at - a.at));
  return { x: camMix(a.x, b.x, p), y: camMix(a.y, b.y, p), scale: camMix(a.scale, b.scale, p) };
}

/** 把镜头状态写到 <g> 的 transform。depth=1 全量跟随；depth<1 视差（慎用：贴地家具会离地）。 */
function applyCamera(g, cam, depth = 1) {
  const d = Math.max(0, Math.min(1, depth));
  const s = camMix(1, cam.scale, d);
  const x = camMix(W / 2, cam.x, d), y = camMix(H / 2, cam.y, d);
  // scale 精度必须到 0.0001：推近每帧增量仅 ~0.002，若量化到 0.01 会"停数帧跳一次"，
  // 表现为放大时抖动（平移/静止不受影响）。0.0001 在 1920 宽下边缘位移 <0.1px。
  const r = v => +v.toFixed(4);
  g.setAttribute('transform', `translate(${r(W / 2 - x * s)}, ${r(H / 2 - y * s)}) scale(${r(s)})`);
}

/** 设计空间焦点 → 画布像素。x,y 用动作代码同款坐标（脚底基准 GROUND=700）。 */
function camFocus(x, y) { return [X(x), Yg(y)]; }

const camKey = (at, pt, scale) => ({ at, x: pt[0], y: pt[1], scale });

/** 全程缓慢平移推进（v0.13 起无缩放）：起幅偏右上，滑向焦点。适合叙事铺垫。 */
function camPush(focusPt) {
  return [camKey(0, [focusPt[0] + W * .03, focusPt[1] + H * .015], 1), camKey(1, focusPt, 1)];
}

/** 停稳+微漂移：前 pushEnd 从略偏起幅滑到焦点，之后继续极缓平移（全程约 2%W）。
    漂移防 freezedetect 冻结（横屏亚像素阈值）；无缩放，数字/文书镜头首选。 */
function camHoldPush(focusPt, pushEnd = .4) {
  return [camKey(0, [focusPt[0] - W * .01, focusPt[1] - H * .004], 1),
    camKey(pushEnd, focusPt, 1),
    camKey(1, [focusPt[0] + W * .01, focusPt[1] + H * .004], 1)];
}

/** 横移：焦点左侧 → 右侧，scale 恒定（默认 1）。适合时间线/双方对照。 */
function camPan(fromPt, toPt, scale = 1) {
  return [camKey(0, fromPt, scale), camKey(1, toPt, scale)];
}

/** 冲击：at 时刻焦点快速下震再落回（v0.13 起纯平移轻震，无 punch 缩放），
    前后带极缓漂移防冻结。配合敲槌/盖章/摔碎等事件，at 对齐事件秒点/镜头总时长。 */
function camImpact(focusPt, at = .5) {
  const pre = Math.max(0, at - .08), post = Math.min(1, at + .18);
  const raw = [camKey(0, [focusPt[0] - W * .006, focusPt[1]], 1), camKey(pre, focusPt, 1),
    camKey(at, [focusPt[0], focusPt[1] + H * .015], 1), camKey(post, focusPt, 1),
    camKey(1, [focusPt[0] + W * .006, focusPt[1]], 1)];
  return raw.filter((k, i) => i === 0 || k.at > raw[i - 1].at);
}

/** 呼吸：极缓平移起伏（无缩放）。给"否则完全静止"的镜头兜底用。 */
function camBreathe(focusPt) {
  return [camKey(0, focusPt, 1), camKey(.5, [focusPt[0] + W * .012, focusPt[1] - H * .008], 1), camKey(1, focusPt, 1)];
}

/** 按名字取 preset。focusPt 是画布像素（用 camFocus 生成）；缺省用画面中心偏下。
    off 返回 null（调用方应清除 transform）。 */
function presetCamera(name, focusPt) {
  const f = focusPt || [W / 2, H * .55];
  switch (name) {
    case 'push': return camPush(f);
    case 'hold': return camHoldPush(f);
    case 'pan': return camPan([f[0] - W * .06, f[1]], [f[0] + W * .06, f[1]]);
    case 'impact': return camImpact(f);
    case 'breathe': return camBreathe(f);
    default: return null;
  }
}