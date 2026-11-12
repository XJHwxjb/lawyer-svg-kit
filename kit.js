/* 固定层 SVG 人物 + 交换物动画库 · 基础构建器
   所有动画均为 t 的纯函数，便于后续移植 Remotion（逐帧确定性渲染）。
   双画幅：设计空间 1080×800 → setOrientation('land'|'port') 活画幅，X/Yg/Ys 自动映射。 */
'use strict';

const NS = 'http://www.w3.org/2000/svg';

/* ---------- 双画幅坐标系统 ----------
   动作一律按 1080×800 设计稿坐标书写（脚底基准 GROUND=700）。
   X  → 横向位置映射；Yg → 贴地物件（桌/文书/印章/钱堆）；Ys → 天空 UI（chip/计数器）。
   os 物件缩放 · vs 天空纵向展开 · cs 人物缩放 · ts 文字缩放。
   横屏 16:9 = 1920×1080，竖屏 9:16 = 1080×1920，切换后必须重新 mount。 */
const DESIGN = { W: 1080, H: 800, GROUND: 700 };
const ORIENTATIONS = {
  land: { id: 'land', label: '横屏 16:9', W: 1920, H: 1080, GROUND: 945, os: 1.15, vs: 1.6, cs: 1.15, ts: 1.15 },
  port: { id: 'port', label: '竖屏 9:16', W: 1080, H: 1920, GROUND: 1640, os: 1.3, vs: 2.0, cs: 1.3, ts: 1.2 },
};
let O = ORIENTATIONS.land;
let W = O.W, H = O.H, GROUND = O.GROUND;
function setOrientation(id) {
  O = ORIENTATIONS[id] || ORIENTATIONS.land;
  W = O.W; H = O.H; GROUND = O.GROUND;
  return O;
}
const X = x => x * W / DESIGN.W;
const Yg = y => GROUND + (y - DESIGN.GROUND) * O.os;
const Ys = y => GROUND + (y - DESIGN.GROUND) * O.vs;

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function txt(node, s) { node.textContent = s; return node; }

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const E = {
  linear: u => u,
  smooth: u => u * u * (3 - 2 * u),
  spring: u => 1 - Math.exp(-6 * u) * Math.cos(9 * u),
  back: u => { const c = 1.70158 * 1.2; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; },
  inQuad: u => u * u,
};
const ease = (P, u) => (E[P.ease] || E.smooth)(clamp01(u));
/* 衰减抖动：impact 后的高频余震 */
const shake = (t, at, dur, amp) => {
  const u = seg(t, at, at + dur);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * 46) * (1 - u) * (1 - u) * amp;
};
const fmtMoney = v => '¥' + Math.round(v).toLocaleString('en-US');

const PAL = {
  skin: '#e8b48c', skinShade: '#d69f76',
  hairM: '#3a2f28', hairW: '#4a3628',
  shirt: '#46689b', pants: '#333a47', dress: '#c25062', shoe: '#23262e',
  ink: '#2a2622', paper: '#fdf8ee',
  seal: '#d43a2f', sealDeep: '#a8271e', gold: '#e9a13b', goldDeep: '#c77f1d',
  jade: '#2f9e6e', azure: '#3a7bd5', magenta: '#c25062',
};
const THEMES = {
  cream: { bg1: '#f6ecd9', bg2: '#e7dabf', ground: '#d9c9a8', line: '#b7a687', label: '纸纹·暖' },
  mist:  { bg1: '#e9eef3', bg2: '#d3dce5', ground: '#b9c4d0', line: '#93a2b3', label: '雾青·冷' },
  dusk:  { bg1: '#3b4054', bg2: '#2a2e3d', ground: '#222532', line: '#4a5068', label: '暮色·深' },
};

/* ---------- 固定人物（一个姿势，全片不变） ---------- */
/* 局部坐标：脚底 (0,0)，向上为负。接物点见 CHARS[who].hand。 */

function drawMan(g, o = {}) {
  el('path', { d: 'M-22,-212 Q-30,-180 -30,-152', stroke: '#35507c', 'stroke-width': 14, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('circle', { cx: -31, cy: -146, r: 7.5, fill: PAL.skin }, g);
  el('path', { d: 'M-12,-134 L-13,-10 M12,-134 L13,-10', stroke: PAL.pants, 'stroke-width': 17, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('rect', { x: -24, y: -12, width: 27, height: 12, rx: 6, fill: PAL.shoe }, g);
  el('rect', { x: 1, y: -12, width: 27, height: 12, rx: 6, fill: PAL.shoe }, g);
  el('path', { d: 'M-26,-136 C-30,-180 -30,-208 -25,-220 C-19,-234 -9,-238 0,-238 C9,-238 19,-234 25,-220 C30,-208 30,-180 26,-136 C9,-130 -9,-130 -26,-136 Z', fill: PAL.shirt }, g);
  el('path', { d: 'M18,-216 Q44,-196 72,-164', stroke: '#35507c', 'stroke-width': 14, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('circle', { cx: 80, cy: -158, r: 8, fill: PAL.skin }, g);
  el('rect', { x: -6, y: -254, width: 12, height: 20, rx: 5, fill: PAL.skinShade }, g);
  el('ellipse', { cx: 0, cy: -272, rx: 24, ry: 26, fill: PAL.skin }, g);
  el('path', { d: 'M-24,-272 a24,26 0 0 1 48,0 q0,5 -2,8 q-5,-15 -22,-15 q-17,0 -22,15 q-2,-3 -2,-8 z', fill: PAL.hairM }, g);
  if (o.bandage) el('rect', { x: 50, y: -186, width: 20, height: 11, rx: 5, fill: '#fff', transform: 'rotate(38 60 -180)' }, g);
  if (o.prop === 'key') {
    el('circle', { cx: -31, cy: -132, r: 6, fill: 'none', stroke: PAL.gold, 'stroke-width': 3 }, g);
    el('path', { d: 'M-31,-126 v14 m0,-5 h5 m-5,5 h4', stroke: PAL.gold, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
  }
}
function drawWoman(g, o = {}) {
  el('ellipse', { cx: 13, cy: -260, rx: 12, ry: 19, fill: PAL.hairW }, g);
  el('circle', { cx: 19, cy: -291, r: 10, fill: PAL.hairW }, g);
  el('path', { d: 'M22,-212 Q30,-180 30,-152', stroke: '#a84350', 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('circle', { cx: 31, cy: -146, r: 7, fill: PAL.skin }, g);
  el('path', { d: 'M-10,-126 L-11,-9 M10,-126 L11,-9', stroke: PAL.skin, 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('rect', { x: -26, y: -10, width: 26, height: 10, rx: 5, fill: '#7a2f3a' }, g);
  el('rect', { x: 0, y: -10, width: 26, height: 10, rx: 5, fill: '#7a2f3a' }, g);
  el('path', { d: 'M-34,-124 C-26,-160 -22,-190 -19,-212 C-16,-232 -8,-238 0,-238 C8,-238 16,-232 19,-212 C22,-190 26,-160 34,-124 C12,-117 -12,-117 -34,-124 Z', fill: o.dress || PAL.dress }, g);
  el('path', { d: 'M-18,-216 Q-44,-196 -72,-164', stroke: '#a84350', 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, g);
  el('circle', { cx: -80, cy: -158, r: 8, fill: PAL.skin }, g);
  el('rect', { x: -6, y: -252, width: 12, height: 18, rx: 5, fill: PAL.skinShade }, g);
  el('ellipse', { cx: 0, cy: -272, rx: 23, ry: 25, fill: PAL.skin }, g);
  el('path', { d: 'M-23,-272 a23,25 0 0 1 46,0 q0,6 -3,9 q-3,-16 -20,-16 q-14,0 -20,12 q-3,-1 -3,-5 z', fill: PAL.hairW }, g);
  el('path', { d: 'M-23,-276 q-4,14 0,26 q3,-1 5,-5 q-3,-10 -1,-21 z', fill: PAL.hairW }, g);
  el('circle', { cx: 16, cy: -287, r: 2.6, fill: PAL.gold }, g);
  if (o.prop === 'suitcase') {
    el('rect', { x: 24, y: -140, width: 26, height: 34, rx: 5, fill: '#8a5a33' }, g);
    el('path', { d: 'M32,-140 q5,-8 10,0', stroke: '#6d4526', 'stroke-width': 3, fill: 'none' }, g);
  }
}

/* ---------- 极简剪影通用语法（无表情·色块轮廓） ---------- */
const TORSO_M = 'M-26,-136 C-30,-180 -30,-208 -25,-220 C-19,-234 -9,-238 0,-238 C9,-238 19,-234 25,-220 C30,-208 30,-180 26,-136 C9,-130 -9,-130 -26,-136 Z';
const limb = (g, d, c, w) => el('path', { d, stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none' }, g);
const mitt = (g, x, y, r) => el('circle', { cx: x, cy: y, r, fill: PAL.skin }, g);
const hairCap = (g, rx, ry, cy, fill) => el('path', { d: `M${-rx},${cy} a${rx},${ry} 0 0 1 ${rx * 2},0 q0,5 -2,8 q-5,-15 ${-(rx - 2)},-15 q${-(rx - 2)},0 ${-(rx - 2)},15 q-2,-3 -2,-8 z`, fill }, g);
function bodyBase(g, o) {
  limb(g, 'M-22,-212 Q-30,-180 -30,-152', o.armC, o.armW || 14);
  mitt(g, -31, -146, 7.5);
  limb(g, `M-12,${o.legY || -134} L-13,-10 M12,${o.legY || -134} L13,-10`, o.legC, o.legW || 17);
  el('rect', { x: -24, y: -(o.shoeH || 12), width: 27, height: o.shoeH || 12, rx: 6, fill: o.shoeC }, g);
  el('rect', { x: 1, y: -(o.shoeH || 12), width: 27, height: o.shoeH || 12, rx: 6, fill: o.shoeC }, g);
  el('path', { d: o.torso || TORSO_M, fill: o.torsoC, stroke: o.stroke || 'none', 'stroke-width': o.stroke ? 1.5 : 0 }, g);
  if (o.vest) el('path', { d: o.vest, fill: o.vestC }, g);
  if (o.raise) { limb(g, 'M18,-216 Q40,-240 52,-262', o.armC, o.armW || 14); mitt(g, 55, -266, 8); }
  else { limb(g, 'M18,-216 Q44,-196 72,-164', o.armC, o.armW || 14); mitt(g, 80, -158, 8); }
  el('rect', { x: -6, y: -254, width: 12, height: 20, rx: 5, fill: PAL.skinShade }, g);
  el('ellipse', { cx: o.headCx || 0, cy: -272, rx: o.headRx || 24, ry: o.headRy || 26, fill: PAL.skin }, g);
}
const held = (g, fn, noProp, rot = 0, sc = .9) => { if (!noProp) fn(el('g', { transform: `translate(80,-158) rotate(${rot}) scale(${sc})` }, g)); };

function drawJudge(g, o = {}) {
  bodyBase(g, { torso: 'M-30,-132 C-32,-180 -30,-208 -25,-220 C-19,-234 -9,-238 0,-238 C9,-238 19,-234 25,-220 C30,-208 32,-180 30,-132 C10,-126 -10,-126 -30,-132 Z', torsoC: '#2b2f3a', armC: '#232732', legC: '#23262e', shoeC: '#1a1d24' });
  el('path', { d: 'M-4,-238 L4,-238 L6,-132 L-6,-132 Z', fill: PAL.seal }, g);
  el('circle', { cx: 0, cy: -212, r: 3, fill: PAL.gold }, g);
  hairCap(g, 24, 26, -272, '#2f2a26');
  held(g, propGavel, o.noProp, -24);
}
function drawPolice(g, o = {}) {
  const u = o.uniform || '#1f3a5f';
  bodyBase(g, { torsoC: u, armC: '#16293f', legC: '#23262e', shoeC: '#1a1d24' });
  el('rect', { x: -26, y: -152, width: 52, height: 8, rx: 4, fill: '#16293f' }, g);
  el('circle', { cx: 9, cy: -212, r: 2.6, fill: PAL.gold }, g);
  if (o.capWhite) limb(g, 'M-26,-196 L26,-176', '#d7e3ee', 8);
  hairCap(g, 24, 26, -272, '#2f2a26');
  const cc = o.capWhite ? '#e8eef4' : u;
  el('path', { d: 'M-24,-280 Q0,-300 24,-280 L24,-272 Q0,-280 -24,-272 Z', fill: cc }, g);
  el('path', { d: 'M-26,-272 Q0,-264 30,-272 L30,-267 Q0,-259 -26,-267 Z', fill: o.capWhite ? '#b9c4d0' : '#16293f' }, g);
  el('circle', { cx: 0, cy: -283, r: 2.6, fill: PAL.gold }, g);
  held(g, propCuffs, o.noProp, 0, 1);
}
function drawLawyer(g, o = {}) {
  bodyBase(g, { torsoC: '#3a3f4a', armC: '#2e333d', legC: '#2b303c', shoeC: '#1a1d24' });
  el('path', { d: 'M-8,-238 L0,-228 L8,-238 Z', fill: '#fff', opacity: .9 }, g);
  el('path', { d: 'M0,-230 L4,-222 L0,-194 L-4,-222 Z', fill: PAL.seal }, g);
  hairCap(g, 24, 26, -272, '#2f2a26');
  held(g, propLawBook, o.noProp, -8);
}
function drawRogue(g, o = {}) {
  el('g', { transform: 'translate(-36,-150) scale(.8)' }, g);
  propBag(g.lastChild);
  bodyBase(g, { torsoC: '#5a6070', armC: '#4a505c', legC: '#333a47', shoeC: '#23262e' });
  el('path', { d: 'M-24,-238 q-10,10 -6,22 l10,-4 q-4,-10 2,-16 z', fill: '#4a505c' }, g);
  hairCap(g, 24, 26, -272, '#23262e');
  el('path', { d: 'M2,-284 q22,-2 27,8 l-2,5 q-12,-7 -25,-5 z', fill: '#23262e' }, g);
}
function drawMediator(g, o = {}) {
  bodyBase(g, { torsoC: '#7a8aa0', armC: '#66788e', legC: '#3a3f4a', shoeC: '#23262e' });
  hairCap(g, 24, 26, -272, '#4a3628');
  held(g, propFolder, o.noProp, -6);
}
function drawWitness(g, o = {}) {
  bodyBase(g, { torsoC: '#6b7f5a', armC: '#5a6d4a', legC: '#333a47', shoeC: '#23262e', raise: true });
  hairCap(g, 24, 26, -272, '#3a2f28');
}
function drawParent(g, o = {}) {
  bodyBase(g, { torsoC: o.torsoC || '#7a6a5a', armC: '#66584a', legC: '#3a3f4a', shoeC: '#23262e', headCx: 6 });
  limb(g, 'M-31,-146 L-31,-2', '#8a5a33', 5);
  hairCap(g, 24, 26, -272, '#b9b3a8');
  if (o.flower) { el('circle', { cx: 22, cy: -292, r: 6, fill: PAL.seal }, g); el('circle', { cx: 22, cy: -292, r: 2.2, fill: PAL.gold }, g); }
  held(g, propBankbook, o.noProp, -6);
}
function drawProsecutor(g, o = {}) {
  bodyBase(g, { torsoC: '#274058', armC: '#1c3044', legC: '#23262e', shoeC: '#1a1d24' });
  el('path', { d: 'M0,-236 L3,-228 L0,-200 L-3,-228 Z', fill: PAL.seal }, g);
  el('circle', { cx: 9, cy: -212, r: 2.6, fill: PAL.gold }, g);
  hairCap(g, 24, 26, -272, '#2f2a26');
  held(g, propIndict, o.noProp, -6);
}
function drawClerk(g, o = {}) {
  bodyBase(g, { torsoC: o.uniform || '#5a6a7a', armC: '#48586a', legC: '#3a3f4a', shoeC: '#23262e' });
  hairCap(g, 23, 25, -272, '#4a3628');
  el('circle', { cx: 17, cy: -291, r: 9, fill: '#4a3628' }, g);
  if (o.notary) held(g, gg => propCert(gg, '公证书'), o.noProp, -6, .6);
  else held(g, propRecordBook, o.noProp, -6);
}
function drawBoss(g, o = {}) {
  bodyBase(g, { torsoC: o.suit || '#4a4f5a', armC: '#3a3f4a', legC: '#2b303c', shoeC: '#1a1d24' });
  el('path', { d: 'M0,-236 L4,-228 L0,-198 L-4,-228 Z', fill: PAL.gold }, g);
  el('rect', { x: -48, y: -142, width: 30, height: 24, rx: 4, fill: '#8a5a33' }, g);
  el('path', { d: 'M-40,-142 q7,-8 14,0', stroke: '#6d4526', 'stroke-width': 3, fill: 'none' }, g);
  hairCap(g, 24, 26, -272, '#2f2a26');
  if (o.prop === 'folder') held(g, propFolder, o.noProp, -6);
  else if (o.prop === 'bag') held(g, propBag, o.noProp, 0, .8);
  else held(g, propCompanySeal, o.noProp, 0, 1);
}
function drawWorker(g, o = {}) {
  if (o.box) { el('rect', { x: -54, y: -212, width: 26, height: 34, rx: 4, fill: PAL.gold, stroke: PAL.goldDeep, 'stroke-width': 1.5 }, g); }
  bodyBase(g, { torsoC: o.uniform || '#3a7bd5', armC: '#2c5fa8', legC: '#333a47', shoeC: '#23262e' });
  limb(g, 'M-26,-192 L26,-180', '#d7e3ee', 6);
  hairCap(g, 24, 26, -272, '#2f2a26');
  el('path', { d: 'M-24,-276 a24,20 0 0 1 48,0 l0,6 q-24,-6 -48,0 z', fill: PAL.gold }, g);
  el('rect', { x: -28, y: -272, width: 56, height: 6, rx: 3, fill: PAL.goldDeep }, g);
  if (o.bandage) el('rect', { x: 50, y: -186, width: 20, height: 11, rx: 5, fill: '#fff', transform: 'rotate(38 60 -180)' }, g);
  if (o.wrench) limb(g, 'M-31,-140 v20 m-5,-20 a5,5 0 1 1 10,0', '#8f9bab', 4);
}
function drawDoctor(g, o = {}) {
  bodyBase(g, { torso: 'M-28,-120 C-30,-180 -30,-208 -25,-220 C-19,-234 -9,-238 0,-238 C9,-238 19,-234 25,-220 C30,-208 30,-180 28,-120 C10,-114 -10,-114 -28,-120 Z', torsoC: '#f2f5f7', stroke: '#c9d4dc', armC: '#e2e9ee', legC: '#3a3f4a', shoeC: '#23262e' });
  limb(g, 'M-8,-236 q8,18 16,0', '#2b2f3a', 3);
  el('circle', { cx: 8, cy: -214, r: 4, fill: '#2b2f3a' }, g);
  hairCap(g, 24, 26, -272, '#3a2f28');
  held(g, propMedChart, o.noProp, -6);
}
function drawAccountant(g, o = {}) {
  bodyBase(g, { torsoC: '#7a8aa0', armC: '#66788e', legC: '#3a3f4a', shoeC: '#23262e', vest: 'M-26,-136 C-28,-180 -28,-206 -24,-218 L-10,-230 L0,-214 L10,-230 L24,-218 C28,-206 28,-180 26,-136 C9,-130 -9,-130 -26,-136 Z', vestC: '#3a3f4a' });
  hairCap(g, 24, 26, -272, '#2f2a26');
  held(g, propLedger, o.noProp, -6);
}
function drawChild(g, o = {}) {
  el('rect', { x: -32, y: -122, width: 14, height: 26, rx: 5, fill: PAL.seal }, g);
  limb(g, 'M-14,-124 Q-20,-104 -20,-92', '#2c5fa8', 10);
  mitt(g, -21, -88, 5.5);
  limb(g, 'M-8,-62 L-9,-8 M8,-62 L9,-8', PAL.pants, 12);
  el('rect', { x: -18, y: -9, width: 20, height: 9, rx: 4.5, fill: PAL.shoe }, g);
  el('rect', { x: 0, y: -9, width: 20, height: 9, rx: 4.5, fill: PAL.shoe }, g);
  el('path', { d: 'M-18,-64 C-20,-96 -20,-116 -16,-126 C-12,-138 -6,-140 0,-140 C6,-140 12,-138 16,-126 C20,-116 20,-96 18,-64 C6,-60 -6,-60 -18,-64 Z', fill: PAL.azure }, g);
  limb(g, 'M12,-126 Q30,-114 48,-108', '#2c5fa8', 10);
  mitt(g, 55, -105, 6);
  el('rect', { x: -4, y: -152, width: 8, height: 14, rx: 4, fill: PAL.skinShade }, g);
  el('ellipse', { cx: 0, cy: -170, rx: 19, ry: 20, fill: PAL.skin }, g);
  hairCap(g, 19, 20, -170, '#3a2f28');
}

/* ---------- 人物注册表：基础剪影 + 换色换道具变体 ---------- */
const CHAR_GROUPS = [
  ['party', '当事人'], ['court', '司法·执法'], ['agent', '代理·调解'],
  ['biz', '商事'], ['life', '民生'], ['other', '对抗·其他'],
];
const CHARS = {
  man: { label: '男方', group: 'party', hand: [80, -158], draw: drawMan, desc: '通用男性当事人：原告/被告/债权人/房东/买方/消费者', variants: [
    { id: 'patient', label: '患者', opt: { bandage: true } }, { id: 'landlord', label: '房东', opt: { prop: 'key' } }] },
  woman: { label: '女方', group: 'party', hand: [-80, -158], draw: drawWoman, desc: '通用女性当事人：配偶/租客/权利人', variants: [
    { id: 'third', label: '第三者', opt: { dress: '#8a4fbf' } }, { id: 'tenant', label: '租客', opt: { prop: 'suitcase' } }] },
  child: { label: '小孩', group: 'party', hand: [55, -105], draw: drawChild, small: true, desc: '未成年子女：抚养权/抚养费/探望权', variants: [] },
  parent: { label: '父母', group: 'party', hand: [80, -158], draw: drawParent, desc: '出资父母/立遗嘱老人：彩礼出资/继承', variants: [
    { id: 'matchmaker', label: '媒婆', opt: { flower: true, torsoC: '#a04a5a' } }] },
  judge: { label: '法官', group: 'court', hand: [80, -158], draw: drawJudge, desc: '黑袍红襟+法槌：敲槌定音/宣判/递判决书', variants: [] },
  prosecutor: { label: '检察官', group: 'court', hand: [80, -158], draw: drawProsecutor, desc: '制服+起诉书：提起公诉/宣读起诉书', variants: [] },
  clerk: { label: '书记员', group: 'court', hand: [80, -158], draw: drawClerk, desc: '灰制服+记录本：庭审记录/递笔录', variants: [
    { id: 'notary', label: '公证员', opt: { notary: true, uniform: '#274058' } }] },
  police: { label: '警察', group: 'court', hand: [80, -158], draw: drawPolice, desc: '大檐帽+手铐：上铐抓捕/带离/出示拘留证', variants: [
    { id: 'traffic', label: '交警', opt: { capWhite: true } }, { id: 'bailiff', label: '法警', opt: { uniform: '#23262e' } }] },
  lawyer: { label: '律师', group: 'agent', hand: [80, -158], draw: drawLawyer, desc: '西装红领带+法典：亮法条/指证据/递委托', variants: [] },
  mediator: { label: '调解员', group: 'agent', hand: [80, -158], draw: drawMediator, desc: '工作服+文件夹：递调解协议/促成握手', variants: [] },
  boss: { label: '老板', group: 'biz', hand: [80, -158], draw: drawBoss, desc: '深灰西装+公章+公文包：签约/抢公章/股权', variants: [
    { id: 'hr', label: 'HR', opt: { prop: 'folder' } }, { id: 'investor', label: '投资人', opt: { prop: 'bag' } },
    { id: 'partner', label: '合伙人', opt: { suit: '#6a5a4a' } }] },
  accountant: { label: '会计', group: 'biz', hand: [80, -158], draw: drawAccountant, desc: '马甲+账本：对账/转移资产曝光', variants: [] },
  worker: { label: '工人', group: 'life', hand: [80, -158], draw: drawWorker, desc: '安全帽+工装：讨薪/工伤/劳动合同', variants: [
    { id: 'rider', label: '骑手', opt: { box: true } }, { id: 'injured', label: '工伤者', opt: { bandage: true } },
    { id: 'property', label: '物业', opt: { wrench: true, uniform: '#5a7a6a' } }] },
  doctor: { label: '医生', group: 'life', hand: [80, -158], draw: drawDoctor, desc: '白大褂+听诊器+病历：递病历/医疗鉴定', variants: [] },
  rogue: { label: '老赖', group: 'other', hand: [80, -158], draw: drawRogue, desc: '鸭舌帽+帽衫+背后钱袋：转移财产/查封/限高', variants: [] },
  witness: { label: '证人', group: 'other', hand: [55, -266], draw: drawWitness, desc: '举手姿势即身份：宣誓/递证言', variants: [] },
};
for (const k in CHARS) CHARS[k].face = CHARS[k].face || 1;
CHARS.woman.face = -1;

/* ---------- 新道具 ---------- */
function propGavel(g) {
  el('rect', { x: -4, y: -30, width: 8, height: 40, rx: 4, fill: '#8a5a33', transform: 'rotate(-30)' }, g);
  el('rect', { x: -20, y: -44, width: 40, height: 16, rx: 7, fill: '#a06a3c', transform: 'rotate(-30)' }, g);
  el('rect', { x: -25, y: -42, width: 6, height: 12, rx: 3, fill: '#8a5a33', transform: 'rotate(-30)' }, g);
  el('rect', { x: 19, y: -42, width: 6, height: 12, rx: 3, fill: '#8a5a33', transform: 'rotate(-30)' }, g);
  return g;
}
function propCuffs(g) {
  el('circle', { cx: -10, cy: 0, r: 8, fill: 'none', stroke: '#8f9bab', 'stroke-width': 3.5 }, g);
  el('circle', { cx: 10, cy: 0, r: 8, fill: 'none', stroke: '#8f9bab', 'stroke-width': 3.5 }, g);
  el('path', { d: 'M-2,0 h4', stroke: '#8f9bab', 'stroke-width': 3 }, g);
  return g;
}
function propCompanySeal(g) {
  el('circle', { cx: 0, cy: 0, r: 12, fill: PAL.seal, stroke: PAL.sealDeep, 'stroke-width': 2 }, g);
  el('rect', { x: -3, y: -24, width: 6, height: 12, rx: 3, fill: PAL.sealDeep }, g);
  el('circle', { cx: 0, cy: 0, r: 4, fill: PAL.gold }, g);
  return g;
}
function propLawBook(g) {
  el('rect', { x: -20, y: -28, width: 40, height: 56, rx: 4, fill: PAL.seal, stroke: PAL.sealDeep, 'stroke-width': 2 }, g);
  el('circle', { cx: 0, cy: -8, r: 6, fill: PAL.gold }, g);
  el('rect', { x: -12, y: 8, width: 24, height: 4, rx: 2, fill: PAL.gold, opacity: .8 }, g);
  return g;
}
function propLedger(g) {
  el('rect', { x: -24, y: -18, width: 48, height: 36, rx: 4, fill: PAL.jade }, g);
  for (let i = 0; i < 3; i++) el('rect', { x: -16, y: -10 + i * 9, width: 32, height: 4, rx: 2, fill: '#fff', opacity: .8 }, g);
  return g;
}
function propMedChart(g) {
  el('rect', { x: -18, y: -24, width: 36, height: 48, rx: 4, fill: '#fff', stroke: '#c9d4dc', 'stroke-width': 1.5 }, g);
  el('rect', { x: -3, y: -18, width: 6, height: 16, rx: 2, fill: PAL.seal }, g);
  el('rect', { x: -8, y: -13, width: 16, height: 6, rx: 2, fill: PAL.seal }, g);
  el('rect', { x: -11, y: 6, width: 22, height: 3.5, rx: 1.75, fill: '#b9c4d0' }, g);
  el('rect', { x: -11, y: 13, width: 16, height: 3.5, rx: 1.75, fill: '#b9c4d0' }, g);
  return g;
}
function propFolder(g) {
  el('rect', { x: -22, y: -22, width: 18, height: 8, rx: 3, fill: PAL.goldDeep }, g);
  el('rect', { x: -22, y: -16, width: 44, height: 32, rx: 4, fill: PAL.gold }, g);
  return g;
}
function propBankbook(g) {
  el('rect', { x: -16, y: -12, width: 32, height: 24, rx: 3, fill: PAL.sealDeep }, g);
  el('rect', { x: -10, y: -5, width: 20, height: 3.5, rx: 1.75, fill: PAL.gold }, g);
  return g;
}
function propRecordBook(g) {
  el('rect', { x: -20, y: -14, width: 40, height: 28, rx: 4, fill: PAL.paper, stroke: '#c9bda6', 'stroke-width': 1.5 }, g);
  el('rect', { x: -13, y: -7, width: 26, height: 3.5, rx: 1.75, fill: '#b9ad97' }, g);
  el('rect', { x: -13, y: 0, width: 20, height: 3.5, rx: 1.75, fill: '#b9ad97' }, g);
  return g;
}
function propIndict(g) {
  el('rect', { x: -18, y: -24, width: 36, height: 48, rx: 4, fill: PAL.paper, stroke: '#c9bda6', 'stroke-width': 1.5 }, g);
  el('rect', { x: -12, y: -18, width: 24, height: 6, rx: 2, fill: PAL.seal }, g);
  el('rect', { x: -12, y: -6, width: 24, height: 3.5, rx: 1.75, fill: '#b9ad97' }, g);
  el('rect', { x: -12, y: 1, width: 18, height: 3.5, rx: 1.75, fill: '#b9ad97' }, g);
  return g;
}
function propBag(g) {
  el('path', { d: 'M0,-26 q-6,8 -14,12 q-10,6 -10,18 q0,14 24,14 q24,0 24,-14 q0,-12 -10,-18 q-8,-4 -14,-12 z', fill: '#8a5a33' }, g);
  el('rect', { x: -6, y: -30, width: 12, height: 6, rx: 3, fill: '#6d4526' }, g);
  el('circle', { cx: 0, cy: 4, r: 4, fill: PAL.gold }, g);
  return g;
}

/* 人物根节点：cutout 描边+投影滤镜在外层，灰度滤镜在内层（分手/缺席用） */
function makeChar(root, who, variant, optExtra) {
  const C = CHARS[who];
  const v = (C.variants || []).find(x => x.id === variant);
  const opt = { ...(v ? v.opt : {}), ...(optExtra || {}) };
  const shadow = el('ellipse', { cx: 0, cy: GROUND + 6, rx: C.small ? 40 : 58, ry: 10, fill: '#000', opacity: .16 }, root);
  const outer = el('g', { filter: 'url(#cutout)' }, root);
  const tint = el('g', {}, outer);
  const art = el('g', {}, tint);
  C.draw(art, opt);
  return {
    who, shadow, outer, tint, C,
    /* x: 脚底设计稿横坐标（自动映射到当前画幅）；deg: 绕脚底倾斜；flip: 水平翻转；gray: 0~1 去色；op: 透明度 */
    set(x, s, deg = 0, flip = 1, gray = 0, op = 1) {
      const cx = X(x), cs = s * O.cs;
      outer.setAttribute('transform', `translate(${cx},${GROUND}) rotate(${deg}) scale(${cs * flip},${cs})`);
      outer.setAttribute('opacity', op);
      shadow.setAttribute('cx', cx);
      shadow.setAttribute('rx', (C.small ? 40 : 58) * cs);
      shadow.setAttribute('opacity', .16 * op);
      tint.style.filter = gray > 0.02 ? `saturate(${1 - gray})` : '';
    },
    hand(x, s, deg = 0, flip = 1) {
      const [hx, hy] = C.hand;
      const cs = s * O.cs;
      const r = deg * Math.PI / 180;
      const lx = hx * cs * flip, ly = hy * cs;
      return [X(x) + lx * Math.cos(r) - ly * Math.sin(r), GROUND + lx * Math.sin(r) + ly * Math.cos(r)];
    },
  };
}

/* ---------- 道具 ---------- */
function propDoc(g, title = '民事起诉状') {
  el('rect', { x: -60, y: -80, width: 120, height: 160, rx: 6, fill: PAL.paper, stroke: '#c9bda6', 'stroke-width': 2 }, g);
  el('path', { d: 'M36,-80 L60,-56 L60,-80 Z', fill: '#e4d8c0' }, g);
  el('rect', { x: -44, y: -64, width: 88, height: 10, rx: 3, fill: PAL.seal }, g);
  txt(el('text', { x: 0, y: -38, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: PAL.ink }, g), title);
  for (let i = 0; i < 5; i++)
    el('rect', { x: -44, y: -20 + i * 16, width: i === 4 ? 52 : 88, height: 5, rx: 2.5, fill: '#b9ad97' }, g);
  el('circle', { cx: 34, cy: 58, r: 14, fill: 'none', stroke: PAL.seal, 'stroke-width': 3, opacity: .8 }, g);
  return g;
}
function propCert(g, title = '结婚证') {
  el('rect', { x: -45, y: -60, width: 90, height: 120, rx: 6, fill: PAL.seal, stroke: PAL.sealDeep, 'stroke-width': 2 }, g);
  el('rect', { x: -37, y: -52, width: 74, height: 104, rx: 4, fill: 'none', stroke: PAL.gold, 'stroke-width': 1.6, opacity: .8 }, g);
  el('circle', { cx: 0, cy: -22, r: 14, fill: PAL.gold }, g);
  el('path', { d: 'M0,-30 l3,6 6,1 -4,5 1,6 -6,-3 -6,3 1,-6 -4,-5 6,-1 Z', fill: PAL.sealDeep }, g);
  txt(el('text', { x: 0, y: 22, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: PAL.gold }, g), title);
  return g;
}
function propNote(g) {
  el('rect', { x: -55, y: -26, width: 110, height: 52, rx: 5, fill: PAL.seal, stroke: PAL.sealDeep, 'stroke-width': 1.5 }, g);
  el('rect', { x: -49, y: -20, width: 98, height: 40, rx: 3, fill: 'none', stroke: '#f2c9b8', 'stroke-width': 1.2, opacity: .7 }, g);
  el('circle', { cx: -28, cy: 0, r: 14, fill: PAL.gold }, g);
  txt(el('text', { x: -28, y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: PAL.sealDeep }, g), '100');
  txt(el('text', { x: 18, y: 6, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: '#f6d7c8' }, g), '壹佰圆');
  return g;
}
function propStack(g, n = 5) {
  for (let i = 0; i < n; i++)
    el('rect', { x: -58, y: -10 - i * 9, width: 116, height: 12, rx: 4, fill: i % 2 ? PAL.seal : '#c03328', stroke: PAL.sealDeep, 'stroke-width': 1 }, g);
  const top = el('g', { transform: `translate(0,${-10 - n * 9}) rotate(-3)` }, g);
  propNote(top);
  el('rect', { x: -14, y: -10 - n * 9, width: 28, height: n * 9 + 12, fill: PAL.paper, opacity: .92 }, g);
  txt(el('text', { x: 0, y: -10 - n * 9 / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: PAL.sealDeep }, g), '¥');
  return g;
}
function propStamp(g) {
  el('rect', { x: -34, y: -18, width: 68, height: 20, rx: 5, fill: PAL.sealDeep }, g);
  el('rect', { x: -30, y: -4, width: 60, height: 6, rx: 3, fill: PAL.seal }, g);
  el('rect', { x: -9, y: -52, width: 18, height: 36, rx: 6, fill: '#8a5a33' }, g);
  el('circle', { cx: 0, cy: -58, r: 15, fill: '#a06a3c' }, g);
  el('circle', { cx: -5, cy: -63, r: 5, fill: '#c08b52', opacity: .8 }, g);
  return g;
}
function propImprint(g, text = '事实认定专用') {
  el('circle', { cx: 0, cy: 0, r: 34, fill: 'none', stroke: PAL.seal, 'stroke-width': 4, opacity: .9 }, g);
  el('path', { d: 'M0,-12 l4,8 9,1 -6,6 1,9 -8,-4 -8,4 1,-9 -6,-6 9,-1 Z', fill: PAL.seal, opacity: .9 }, g);
  const ring = el('path', { id: 'sealRing', d: 'M -26,0 A 26,26 0 1,1 26,0', fill: 'none' }, g);
  const t = el('text', { 'font-size': 10, 'font-weight': 700, fill: PAL.seal, opacity: .9 }, g);
  const tp = el('textPath', { href: '#sealRing', startOffset: '50%', 'text-anchor': 'middle' }, t);
  txt(tp, text);
  return g;
}
function propPen(g) {
  el('path', { d: 'M0,0 L6,-14 L10,-12 Z', fill: PAL.gold }, g);
  el('rect', { x: 5, y: -52, width: 9, height: 40, rx: 4, transform: 'rotate(24 9 -32)', fill: PAL.ink }, g);
  el('rect', { x: 5, y: -52, width: 9, height: 10, rx: 4, transform: 'rotate(24 9 -32)', fill: PAL.gold }, g);
  return g;
}
function propTable(g, w = 300) {
  el('rect', { x: -w / 2, y: 0, width: w, height: 16, rx: 6, fill: '#a06a3c' }, g);
  el('rect', { x: -w / 2, y: 0, width: w, height: 6, rx: 3, fill: '#c08b52' }, g);
  el('rect', { x: -w / 2 + 18, y: 16, width: 14, height: 84, rx: 4, fill: '#8a5a33' }, g);
  el('rect', { x: w / 2 - 32, y: 16, width: 14, height: 84, rx: 4, fill: '#8a5a33' }, g);
  return g;
}
function chip(g, x, y, text, color, fs = 20) {
  const cx = X(x), cy = Ys(y), f = fs * O.ts;
  const w = text.length * f + 36 * O.ts;
  el('rect', { x: cx - w / 2, y: cy - f * 0.95, width: w, height: f * 1.9, rx: f * 0.95, fill: color, opacity: .95 }, g);
  txt(el('text', { x: cx, y: cy + f * 0.36, 'text-anchor': 'middle', 'font-size': f, 'font-weight': 700, fill: '#fff8ec' }, g), text);
  return g;
}
function symbolAnger(g) {
  el('path', { d: 'M-14,-4 q-6,-10 4,-14 M4,-18 q10,-6 14,4 M18,4 q6,10 -4,14 M-4,18 q-10,6 -14,-4', stroke: PAL.seal, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' }, g);
  return g;
}
function symbolHeartBreak(g) {
  el('path', { d: 'M-2,-14 C-10,-26 -28,-22 -28,-8 C-28,4 -12,14 -2,22 L-6,8 L2,2 L-4,-6 Z', fill: PAL.magenta }, g);
  el('path', { d: 'M2,-14 C10,-26 28,-22 28,-8 C28,4 12,14 2,22 L6,10 L-2,4 L4,-4 Z', fill: PAL.magenta, opacity: .75, transform: 'translate(5,3) rotate(8)' }, g);
  return g;
}
function symbolSpark(g) {
  el('path', { d: 'M0,-26 L5,-6 L26,0 L5,6 L0,26 L-5,6 L-26,0 L-5,-6 Z', fill: PAL.gold }, g);
  return g;
}

/* ---------- 场景底（章节背景锚点，双画幅自动映射） ---------- */
function buildBG(root, kind, theme) {
  root.innerHTML = '';
  const T = THEMES[theme];
  const os = O.os;
  if (kind === 'home') {
    const win = el('g', { transform: `translate(${X(120)},${Yg(120)}) scale(${os})` }, root);
    el('rect', { x: 0, y: 0, width: 200, height: 160, rx: 10, fill: T.line, opacity: .35 }, win);
    el('rect', { x: 12, y: 12, width: 176, height: 136, rx: 6, fill: '#bcd6e8', opacity: .8 }, win);
    el('path', { d: 'M100,12 v136 M12,80 h176', stroke: T.line, 'stroke-width': 6, opacity: .6 }, win);
    const lamp = el('g', { transform: `translate(${X(850)},${Yg(250)}) scale(${os})` }, root);
    el('rect', { x: -90, y: -100, width: 180, height: 130, rx: 8, fill: T.line, opacity: .3 }, lamp);
    el('path', { d: 'M0,30 v60 M-30,90 h60', stroke: '#8a5a33', 'stroke-width': 8, 'stroke-linecap': 'round' }, lamp);
    el('circle', { cx: 0, cy: 0, r: 34, fill: PAL.jade, opacity: .7 }, lamp);
  } else if (kind === 'court') {
    el('rect', { x: 0, y: Yg(90), width: W, height: 250 * os, fill: '#8a5a33', opacity: .28 }, root);
    for (let i = 0; i < 9; i++) el('rect', { x: X(40 + i * 120), y: Yg(90), width: 10 * os, height: 250 * os, fill: '#6d4526', opacity: .3 }, root);
    const emb = el('g', { transform: `translate(${X(540)},${Yg(180)}) scale(${os})` }, root);
    el('circle', { cx: 0, cy: 0, r: 52, fill: PAL.seal, opacity: .85 }, emb);
    el('circle', { cx: 0, cy: 0, r: 40, fill: 'none', stroke: PAL.gold, 'stroke-width': 3 }, emb);
    el('path', { d: 'M0,-22 l7,14 15,2 -11,11 3,15 -14,-7 -14,7 3,-15 -11,-11 15,-2 Z', fill: PAL.gold }, emb);
    const bench = el('g', { transform: `translate(${X(540)},${Yg(560)}) scale(${os})` }, root);
    el('rect', { x: -300, y: 0, width: 600, height: 60, rx: 8, fill: '#8a5a33' }, bench);
    el('rect', { x: -300, y: 0, width: 600, height: 12, rx: 6, fill: '#a06a3c' }, bench);
    chip(root, 330, 592, '原告', PAL.azure, 18);
    chip(root, 750, 592, '被告', PAL.magenta, 18);
  } else if (kind === 'register') {
    el('rect', { x: 0, y: Yg(80), width: W, height: 280 * os, fill: PAL.seal, opacity: .22 }, root);
    const emb = el('g', { transform: `translate(${X(540)},${Yg(190)}) scale(${os})` }, root);
    el('circle', { cx: 0, cy: 0, r: 56, fill: PAL.seal, opacity: .8 }, emb);
    el('path', { d: 'M0,24 C-20,6 -32,-8 -32,-22 C-32,-34 -22,-40 -12,-36 C-6,-33 -2,-28 0,-24 C2,-28 6,-33 12,-36 C22,-40 32,-34 32,-22 C32,-8 20,6 0,24 Z', fill: PAL.gold }, emb);
    const desk = el('g', { transform: `translate(${X(540)},${Yg(560)}) scale(${os})` }, root);
    el('rect', { x: -360, y: 0, width: 720, height: 56, rx: 8, fill: '#a06a3c' }, desk);
    el('rect', { x: -360, y: 0, width: 720, height: 10, rx: 5, fill: '#c08b52' }, desk);
    txt(el('text', { x: X(540), y: Yg(400), 'text-anchor': 'middle', 'font-size': 26 * O.ts, 'font-weight': 700, fill: T.line, opacity: .9 }, root), '婚姻登记处');
  } else if (kind === 'office') {
    const win = el('g', { transform: `translate(${X(90)},${Yg(110)}) scale(${os})` }, root);
    el('rect', { x: 0, y: 0, width: 230, height: 170, rx: 8, fill: T.line, opacity: .35 }, win);
    el('rect', { x: 10, y: 10, width: 210, height: 150, rx: 4, fill: '#cfe0ea', opacity: .75 }, win);
    for (let i = 0; i < 6; i++) el('rect', { x: 10, y: 16 + i * 24, width: 210, height: 9, fill: T.line, opacity: .4 }, win);
    const clock = el('g', { transform: `translate(${X(730)},${Yg(140)}) scale(${os})` }, root);
    el('circle', { cx: 0, cy: 0, r: 34, fill: PAL.paper, stroke: T.line, 'stroke-width': 4, opacity: .9 }, clock);
    el('path', { d: 'M0,0 V-20 M0,0 L13,7', stroke: PAL.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, clock);
    const cab = el('g', { transform: `translate(${X(880)},${Yg(430)}) scale(${os})` }, root);
    el('rect', { x: -70, y: 0, width: 140, height: 270, rx: 8, fill: '#8a5a33', opacity: .85 }, cab);
    for (let i = 0; i < 3; i++) {
      el('rect', { x: -58, y: 14 + i * 86, width: 116, height: 72, rx: 5, fill: '#a06a3c' }, cab);
      el('rect', { x: -16, y: 44 + i * 86, width: 32, height: 8, rx: 4, fill: '#6d4526' }, cab);
    }
  } else if (kind === 'warehouse') {
    for (const sx of [150, 810]) {
      const shelf = el('g', { transform: `translate(${X(sx)},${Yg(330)}) scale(${os})` }, root);
      el('rect', { x: -110, y: 0, width: 12, height: 370, fill: '#8a5a33', opacity: .8 }, shelf);
      el('rect', { x: 98, y: 0, width: 12, height: 370, fill: '#8a5a33', opacity: .8 }, shelf);
      for (let i = 0; i < 3; i++) {
        el('rect', { x: -110, y: 60 + i * 120, width: 220, height: 10, fill: '#a06a3c', opacity: .9 }, shelf);
        el('rect', { x: -92, y: 18 + i * 120, width: 52, height: 42, rx: 3, fill: PAL.gold, opacity: .75 }, shelf);
        el('rect', { x: -30, y: 26 + i * 120, width: 44, height: 34, rx: 3, fill: '#c08b52', opacity: .75 }, shelf);
        el('rect', { x: 24, y: 14 + i * 120, width: 56, height: 46, rx: 3, fill: PAL.goldDeep, opacity: .6 }, shelf);
      }
    }
    for (const lx of [330, 540, 750]) {
      const lamp = el('g', { transform: `translate(${X(lx)},${Yg(90)}) scale(${os})` }, root);
      el('path', { d: 'M0,0 v40', stroke: T.line, 'stroke-width': 4, opacity: .6 }, lamp);
      el('path', { d: 'M-26,40 h52 l-10,18 h-32 z', fill: T.line, opacity: .55 }, lamp);
      el('ellipse', { cx: 0, cy: 64, rx: 16, ry: 6, fill: PAL.gold, opacity: .5 }, lamp);
    }
  }
  return root;
}