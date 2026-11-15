/* 文字重叠审查（v0.12）· 可移植浏览器端 snippet
   用途：任何 HTML/SVG 视频引擎（含自建引擎、Remotion 预览页）审查画面文字是否互相重叠。
   用法三选一：
   1) 控制台：把本文件内容整段粘进页面 DevTools Console，调用 auditTextOverlap()；
   2) CDP：Runtime.evaluate 执行本文件内容 + 'auditTextOverlap()'（returnByValue:true）；
   3) 逐帧/逐镜头：先 seek 到目标时刻再调用；转场交叉淡化期间两镜文字同屏属正常残影，
      只在单镜稳定时刻采样（建议 t=0.3/0.5/0.7/0.9），避免误报。
   返回 {rects, pairs}：pairs 非空 = 存在重叠（a/b 为文字内容，ix/iy 为相交像素）。
   判定：可见文本包围盒两两相交 >2px×2px。opacity<0.05、hidden、defs/mask 内、零尺寸排除；
   只看 text×text（HTML 引擎取叶子文本节点），文字压自己底板/卡片属正常包含不算重叠。
   局限：烧录字幕/真人小圆是合成期叠加、不在 DOM 里——那两类靠 delivery-qa.md 抽帧目检。 */
'use strict';
function auditTextOverlap() {
  const nodes = [...document.querySelectorAll('text')];
  for (const n of document.querySelectorAll('body *')) {
    if (n.childElementCount === 0 && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName) &&
        (n.textContent || '').trim() && !n.closest('svg')) nodes.push(n);
  }
  const rects = [];
  for (const n of nodes) {
    if (n.closest('defs,mask,clipPath,pattern')) continue;
    let op = 1, vis = true;
    for (let p = n; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.visibility === 'hidden' || cs.display === 'none') { vis = false; break; }
      op *= parseFloat(cs.opacity || 1);
    }
    if (!vis || op < 0.05) continue;
    const t = (n.textContent || '').trim();
    if (!t) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    rects.push({ t, x: r.x, y: r.y, w: r.width, h: r.height });
  }
  const pairs = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ix > 2 && iy > 2) pairs.push({ a: a.t, b: b.t, ix: +ix.toFixed(1), iy: +iy.toFixed(1) });
  }
  return { rects, pairs };
}
if (typeof module !== 'undefined') module.exports = { auditTextOverlap };