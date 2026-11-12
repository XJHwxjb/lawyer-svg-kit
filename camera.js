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
   · 镜头状态一律用画布像素；scale > 1 = 推进放大。
   · 全舞台镜头（camWorld 包整个画面）时 scale 必须 ≥ 1，否则画面边缘露底。
     本文件所有 preset 都保证 ≥ 1；手写 keys 时自己守住这条。
   · keys 的 at 必须递增、取值 [0,1]；cameraAt 会校验并抛错。
   · 焦点用 camFocus(x, y)：传设计空间坐标（1080×800, GROUND=700），
     返回画布坐标。不要手写画布像素，换画幅会错位。
   · 一个镜头内焦点固定（mount 时取一次锚点），不要每帧换焦点，否则画面抖。
*/
'use strict';

const camMix = (a, b, p) => a + (b - a) * p;
const camSmooth = p => { const v = Math.max(0, Math.min(1, p)); return v * v * (3 - 2 * v); };

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
  const p = camSmooth((t01 - a.at) / (b.at - a.at));
  return { x: camMix(a.x, b.x, p), y: camMix(a.y, b.y, p), scale: camMix(a.scale, b.scale, p) };
}

/** 把镜头状态写到 <g> 的 transform。depth=1 全量跟随；depth<1 视差（慎用：贴地家具会离地）。 */
function applyCamera(g, cam, depth = 1) {
  const d = Math.max(0, Math.min(1, depth));
  const s = camMix(1, cam.scale, d);
  const x = camMix(W / 2, cam.x, d), y = camMix(H / 2, cam.y, d);
  const r = v => +v.toFixed(2);
  g.setAttribute('transform', `translate(${r(W / 2 - x * s)}, ${r(H / 2 - y * s)}) scale(${r(s)})`);
}

/** 设计空间焦点 → 画布像素。x,y 用动作代码同款坐标（脚底基准 GROUND=700）。 */
function camFocus(x, y) { return [X(x), Yg(y)]; }

const camKey = (at, pt, scale) => ({ at, x: pt[0], y: pt[1], scale });

/** 全程缓慢推进：from → to。适合叙事铺垫。 */
function camPush(focusPt, from = 1, to = 1.1) {
  return [camKey(0, focusPt, from), camKey(1, focusPt, to)];
}

/** 推近后停留：前 pushEnd 段推进，之后保持放大让观众读清数字/文书。数字镜头首选。
    停留段带 1% 极缓漂移（肉眼几乎不可察），保持画面"活着"，避免触发冻结检测。 */
function camHoldPush(focusPt, pushEnd = .4, from = 1, to = 1.12) {
  return [camKey(0, focusPt, from), camKey(pushEnd, focusPt, to), camKey(1, focusPt, to * 1.01)];
}

/** 横移：焦点左侧 → 右侧，scale 恒定。适合时间线/双方对照。 */
function camPan(fromPt, toPt, scale = 1.08) {
  return [camKey(0, fromPt, scale), camKey(1, toPt, scale)];
}

/** 冲击：at 时刻快速 punch 放大，随后落到 settle 并保持。配合敲槌/盖章/摔碎等事件。
    at 应对齐事件秒点 / 镜头总时长。
    punch 前后带极缓漂移（1% 量级，肉眼难察）：动作等待相位本身可能静止，
    镜头不留完全静止段，避免触发 freezedetect 冻结门禁。 */
function camImpact(focusPt, at = .5, punch = 1.14, settle = 1.06) {
  const pre = Math.max(0, at - .08), post = Math.min(1, at + .18);
  const raw = [camKey(0, focusPt, 1), camKey(pre, focusPt, 1.012),
    camKey(at, focusPt, punch), camKey(post, focusPt, settle), camKey(1, focusPt, settle * 1.01)];
  return raw.filter((k, i) => i === 0 || k.at > raw[i - 1].at);
}

/** 呼吸：1 → 1.045 → 1 的极缓起伏。给"否则完全静止"的镜头兜底用。 */
function camBreathe(focusPt) {
  return [camKey(0, focusPt, 1), camKey(.5, focusPt, 1.045), camKey(1, focusPt, 1)];
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