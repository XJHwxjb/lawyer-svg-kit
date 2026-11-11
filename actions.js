/* 交换物动画库 · 8 个动作（4 类 × 2）
   每个动作 = build(S) 返回 { update(t01,P), anchors(), guidePath(), phases, events, dur }
   t01 ∈ [0,1]，全部状态由 t 纯函数决定 → 可 scrub、可移植 Remotion。 */
'use strict';

const MANX = 320, WOMX = 760;
const qbez = (a, b, lift, u) => {
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 - lift;
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]];
};
const qd = (a, b, lift) => `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2 - lift} ${b[0]},${b[1]}`;

const CATS = {
  hand: { name: '物件交接', color: '#4d8fd1' },
  money: { name: '金钱扩展', color: '#eba63f' },
  move: { name: '整体位移', color: '#c25062' },
  focus: { name: '共同焦点', color: '#3fa87c' },
};

const ACTIONS = [];
function def(o) { ACTIONS.push(o); return o; }

/* ============ A1 文书递接 ============ */
def({
  id: 'doc-handoff', cat: 'hand', name: '文书递接', dur: 4.6,
  desc: '起诉状从男方手中弧线飞出，女方接住时翻面一次',
  phases: [[.18, '持握示证'], [.55, '弧线递出'], [.75, '接住翻面'], [1.01, '持稳确认']],
  events: [{ at: .18, sfx: 'whoosh' }, { at: .55, sfx: 'paper' }],
  build(S) {
    const doc = propDoc(el('g', {}, S.above));
    let pos = [0, 0];
    return {
      update(t, P) {
        const s = P.scale;
        const mh = S.man.hand(MANX, s), wh = S.woman.hand(WOMX, s);
        let rot = -6, fx = 1;
        if (t < .18) { pos = [mh[0], mh[1] - 12 * ease(P, seg(t, 0, .18))]; }
        else if (t < .55) { const u = ease(P, seg(t, .18, .55)); pos = qbez(mh, wh, 150 * P.amp, u); rot = lerp(-8, 6, u); }
        else if (t < .75) { const v = seg(t, .55, .75); pos = wh; fx = Math.cos(v * Math.PI * 2); rot = 6; }
        else { const w = seg(t, .75, 1); pos = [wh[0], wh[1] - 5 * Math.sin(w * Math.PI)]; rot = 4; }
        doc.setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${rot}) scale(${fx},1)`);
        S.man.set(MANX, s, 3 * Math.sin(seg(t, .1, .3) * Math.PI));
        S.woman.set(WOMX, s, -3 * Math.sin(seg(t, .5, .7) * Math.PI));
      },
      anchors: () => [pos, S.man.hand(MANX, 1), S.woman.hand(WOMX, 1)],
      guidePath: P => qd(S.man.hand(MANX, P.scale), S.woman.hand(WOMX, P.scale), 150 * P.amp),
    };
  },
});

/* ============ A2 结婚证合拢 / 裂开 ============ */
def({
  id: 'cert-join-split', cat: 'hand', name: '结婚证合·裂', dur: 5.2,
  desc: '两证合拢脉冲发光，随后裂缝闪白、分飞回各自手中',
  phases: [[.3, '两证合拢'], [.45, '合证脉冲'], [.6, '持证停留'], [.85, '裂开分飞'], [1.01, '各执一端']],
  events: [{ at: .3, sfx: 'pop' }, { at: .6, sfx: 'crack' }],
  build(S) {
    const cM = propCert(el('g', {}, S.above));
    const cW = propCert(el('g', {}, S.above));
    const spark = symbolSpark(el('g', { opacity: 0 }, S.fx));
    const flash = el('rect', { x: 536, y: 380, width: 8, height: 180, rx: 4, fill: '#fff', opacity: 0 }, S.fx);
    const C = [540, 470];
    let pM = C, pW = C;
    return {
      update(t, P) {
        const s = P.scale;
        const mh = S.man.hand(MANX, s), wh = S.woman.hand(WOMX, s);
        const u1 = ease(P, seg(t, 0, .3));
        const jM = [C[0] - 16, C[1] - 6], jW = [C[0] + 16, C[1] + 6];
        let rM = lerp(-10, -4, u1), rW = lerp(10, 4, u1), sc = 1;
        pM = [lerp(mh[0], jM[0], u1), lerp(mh[1], jM[1], u1)];
        pW = [lerp(wh[0], jW[0], u1), lerp(wh[1], jW[1], u1)];
        const p = seg(t, .3, .45);
        sc = 1 + .08 * Math.sin(p * Math.PI) * P.amp;
        spark.setAttribute('opacity', Math.sin(p * Math.PI));
        spark.setAttribute('transform', `translate(${C[0]},${C[1] - 70}) scale(${.6 + .6 * Math.sin(p * Math.PI)}) rotate(${p * 90})`);
        if (t >= .6) {
          const u2 = ease(P, seg(t, .6, .85));
          pM = [lerp(jM[0], mh[0], u2), lerp(jM[1], mh[1], u2) - 40 * Math.sin(u2 * Math.PI) * P.amp];
          pW = [lerp(jW[0], wh[0], u2), lerp(jW[1], wh[1], u2) - 40 * Math.sin(u2 * Math.PI) * P.amp];
          rM = lerp(-4, -24, u2); rW = lerp(4, 24, u2);
          flash.setAttribute('opacity', .85 * Math.sin(seg(t, .6, .68) * Math.PI));
        } else flash.setAttribute('opacity', 0);
        const bob = t > .85 ? 4 * Math.sin(seg(t, .85, 1) * Math.PI) : 0;
        cM.setAttribute('transform', `translate(${pM[0]},${pM[1] - bob}) rotate(${rM}) scale(${sc})`);
        cW.setAttribute('transform', `translate(${pW[0]},${pW[1] - bob}) rotate(${rW}) scale(${sc})`);
        S.man.set(MANX, s, 2 * Math.sin(seg(t, .6, .8) * Math.PI));
        S.woman.set(WOMX, s, -2 * Math.sin(seg(t, .6, .8) * Math.PI));
      },
      anchors: () => [pM, pW],
      guidePath: () => `M${MANX + 80},542 L540,470 L${WOMX - 80},542`,
    };
  },
});

/* ============ B1 钞票流 + 计数 ============ */
def({
  id: 'money-flow', cat: 'money', name: '钞票流·计数', dur: 5.4,
  desc: '10 张钞票沿曲线流向女方落堆，上方金额同步 count-up 到 ¥660,000',
  phases: [[.2, '钞票流出'], [.8, '计数累加'], [1.01, '落堆成山']],
  events: Array.from({ length: 10 }, (_, i) => ({ at: .06 + i * .055 + .32, sfx: 'ching' })),
  build(S) {
    const N = 10, PILE = [880, 692];
    const notes = Array.from({ length: N }, () => propNote(el('g', { opacity: 0 }, S.above)));
    const pile = el('g', { transform: `translate(${PILE[0]},${PILE[1]})` }, S.above);
    const layers = Array.from({ length: N }, (_, i) =>
      el('rect', { x: -58, y: -10 - i * 10, width: 116, height: 14, rx: 4, fill: i % 2 ? PAL.seal : '#c03328', stroke: PAL.sealDeep, 'stroke-width': 1, opacity: 0 }, pile));
    const topNote = propNote(el('g', { opacity: 0, transform: 'translate(0,-116) rotate(-4)' }, pile));
    const counter = el('g', {}, S.fx);
    const cRect = el('rect', { x: 540 - 130, y: 250, width: 260, height: 62, rx: 31, fill: PAL.ink, opacity: .88 }, counter);
    const cText = txt(el('text', { x: 540, y: 292, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 800, fill: PAL.gold }, counter), '¥0');
    let last = [0, 0];
    return {
      update(t, P) {
        const s = P.scale;
        const mh = S.man.hand(MANX, s);
        let arrived = 0;
        for (let i = 0; i < N; i++) {
          const st = .06 + i * .055, u = seg(t, st, st + .32);
          if (u <= 0) { notes[i].setAttribute('opacity', 0); continue; }
          if (u >= 1) {
            arrived++;
            notes[i].setAttribute('opacity', 0);
            layers[i].setAttribute('opacity', 1);
            continue;
          }
          const e = E.smooth(u);
          const pos = qbez(mh, [PILE[0], 620], (100 + Math.sin(i * 2.1) * 24) * P.amp, e);
          last = pos;
          notes[i].setAttribute('opacity', 1);
          notes[i].setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${Math.sin(u * Math.PI) * 20 * P.amp + (i % 3 - 1) * 6}) scale(${.8 + .2 * Math.sin(u * Math.PI)})`);
        }
        topNote.setAttribute('opacity', arrived === N ? 1 : 0);
        const val = 660000 * E.smooth(seg(t, .06, .8));
        txt(cText, fmtMoney(val));
        const w = cText.textContent.length * 20 + 50;
        cRect.setAttribute('x', 540 - w / 2); cRect.setAttribute('width', w);
        counter.setAttribute('opacity', t > .04 ? 1 : 0);
        S.man.set(MANX, s, 2 * Math.sin(seg(t, .05, .25) * Math.PI));
        S.woman.set(WOMX, s, -2 * Math.sin(seg(t, .5, .7) * Math.PI));
      },
      anchors: () => [last, PILE],
      guidePath: P => qd(S.man.hand(MANX, P.scale), [PILE[0], 620], 100 * P.amp),
    };
  },
});

/* ============ B2 钱堆分裂 ============ */
def({
  id: 'stack-split', cat: 'money', name: '钱堆分裂', dur: 4.6,
  desc: '66万总堆蓄力后分裂：10万判决返还飞向男方，其余留存女方',
  phases: [[.2, '总额示数'], [.35, '蓄力压缩'], [.7, '分裂飞送'], [1.01, '落定盖章']],
  events: [{ at: .35, sfx: 'whoosh' }, { at: .7, sfx: 'thud' }],
  build(S) {
    propTable(el('g', { transform: 'translate(540,600)' }, S.below), 320);
    const all = propStack(el('g', {}, S.above), 6);
    const labAll = chip(el('g', {}, S.fx), 540, 400, '66万 · 彩礼总额', PAL.ink, 22);
    const L = propStack(el('g', { opacity: 0 }, S.above), 2);
    const R = propStack(el('g', { opacity: 0 }, S.above), 5);
    const labL = chip(el('g', { opacity: 0 }, S.fx), 320, 330, '10万 · 判决返还', PAL.gold, 20);
    const labR = chip(el('g', { opacity: 0 }, S.fx), 760, 330, '其余留存', PAL.jade, 20);
    const dust = Array.from({ length: 8 }, (_, i) =>
      el('circle', { r: 5, fill: '#b7a687', opacity: 0 }, S.fx));
    let pL = [540, 588], pR = [540, 588];
    return {
      update(t, P) {
        const s = P.scale;
        const p0 = seg(t, 0, .2), q = seg(t, .2, .35);
        let sc = 1 + .04 * Math.sin(p0 * Math.PI * 2) * P.amp;
        let sy = 1 - .12 * Math.sin(q * Math.PI) * P.amp, sx = 1 + .1 * Math.sin(q * Math.PI) * P.amp;
        const u = ease(P, seg(t, .35, .7));
        all.setAttribute('opacity', 1 - seg(u, 0, .2));
        all.setAttribute('transform', `translate(540,588) scale(${sx * sc},${sy * sc})`);
        labAll.setAttribute('opacity', 1 - seg(t, .35, .45));
        const lift = 90 * P.amp;
        const mh = S.man.hand(MANX, s), wh = S.woman.hand(WOMX, s);
        pL = qbez([540, 588], mh, lift, u);
        pR = qbez([540, 588], wh, lift, u);
        const bounce = t > .7 ? -10 * Math.sin(seg(t, .7, .85) * Math.PI) * P.amp : 0;
        L.setAttribute('opacity', seg(u, 0, .15));
        R.setAttribute('opacity', seg(u, 0, .15));
        L.setAttribute('transform', `translate(${pL[0]},${pL[1] + bounce}) rotate(${-6 * Math.sin(u * Math.PI)})`);
        R.setAttribute('transform', `translate(${pR[0]},${pR[1] + bounce}) rotate(${6 * Math.sin(u * Math.PI)})`);
        labL.setAttribute('opacity', seg(t, .62, .75));
        labR.setAttribute('opacity', seg(t, .62, .75));
        const du = seg(t, .7, .92);
        dust.forEach((d, i) => {
          const side = i < 4 ? 320 : 760, k = i % 4;
          const ang = (-140 + k * 30) * Math.PI / 180;
          d.setAttribute('opacity', du > 0 && du < 1 ? (1 - du) * .8 : 0);
          d.setAttribute('cx', side + Math.cos(ang) * lerp(12, 80, du) * (k % 2 ? 1 : -1));
          d.setAttribute('cy', 600 + Math.sin(ang) * lerp(6, 46, du));
        });
        S.man.set(MANX, s, 2 * Math.sin(seg(t, .35, .6) * Math.PI));
        S.woman.set(WOMX, s, -2 * Math.sin(seg(t, .35, .6) * Math.PI));
      },
      anchors: () => [pL, pR],
      guidePath: P => `M540,588 Q430,${588 - 90 * P.amp} ${MANX + 80 * P.scale},${700 - 158 * P.scale} M540,588 Q650,${588 - 90 * P.amp} ${WOMX - 80 * P.scale},${700 - 158 * P.scale}`,
    };
  },
});

/* ============ C1 靠近 / 退后 ============ */
def({
  id: 'approach-retreat', cat: 'move', name: '靠近·退后', dur: 4.8,
  desc: '两人滑入对峙、怒标弹出、僵持微颤，再退回复位',
  phases: [[.4, '靠近对峙'], [.55, '僵持微颤'], [.9, '退后疏远'], [1.01, '复位']],
  events: [{ at: .02, sfx: 'whoosh' }, { at: .4, sfx: 'thud' }, { at: .55, sfx: 'whoosh' }],
  build(S) {
    const anger = symbolAnger(el('g', { opacity: 0 }, S.fx));
    const dist = el('g', { opacity: 0 }, S.fx);
    const dLine = el('path', { stroke: PAL.azure, 'stroke-width': 3, 'stroke-dasharray': '8 7', fill: 'none' }, dist);
    let xM = 180, xW = 900;
    return {
      update(t, P) {
        const s = P.scale;
        const u = ease(P, seg(t, 0, .4));
        const v = ease(P, seg(t, .55, .9));
        xM = lerp(lerp(180, 430, u), 180, v);
        xW = lerp(lerp(900, 650, u), 900, v);
        const tr = shake(t, .42, .16, 2.4 * P.amp);
        const lean = 4 * u * (1 - v);
        S.man.set(xM + tr, s, lean);
        S.woman.set(xW - tr, s, -lean);
        const ap = seg(t, .42, .52);
        anger.setAttribute('opacity', ap * (1 - seg(t, .55, .65)));
        anger.setAttribute('transform', `translate(${xM + 40},${GROUND - 330 * s}) scale(${E.back(ap) * .9})`);
        dist.setAttribute('opacity', P.guides ? .9 : 0);
        dLine.setAttribute('d', `M${xM + 60},430 L${xW - 60},430`);
      },
      anchors: P => [[xM, GROUND - 158 * P.scale], [xW, GROUND - 158 * P.scale]],
      guidePath: () => `M180,660 L430,660 M900,660 L650,660`,
    };
  },
});

/* ============ C2 分手裂缝 ============ */
def({
  id: 'breakup-crack', cat: 'move', name: '分手·裂缝', dur: 5.2,
  desc: '并肩→裂缝生长→闪白分离→两人灰化淡出，碎心弹出',
  phases: [[.1, '并肩'], [.45, '裂缝生长'], [.8, '分离'], [1.01, '灰化疏远']],
  events: [{ at: .45, sfx: 'crack' }, { at: .72, sfx: 'thud' }],
  build(S) {
    const d = 'M540,300 L528,360 L552,410 L530,470 L556,530 L534,600 L548,660 L540,700';
    const crack = el('path', { d, fill: 'none', stroke: PAL.ink, 'stroke-width': 7, 'stroke-linejoin': 'round', opacity: 0 }, S.fx);
    const core = el('path', { d, fill: 'none', stroke: '#fff8ec', 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: 0 }, S.fx);
    const Llen = crack.getTotalLength();
    crack.setAttribute('stroke-dasharray', Llen);
    core.setAttribute('stroke-dasharray', Llen);
    const flash = el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff', opacity: 0 }, S.fx);
    const heart = symbolHeartBreak(el('g', { opacity: 0 }, S.fx));
    let xM = 460, xW = 620;
    return {
      update(t, P) {
        const s = P.scale;
        const cu = seg(t, .1, .45);
        crack.setAttribute('opacity', cu > 0 ? 1 - .6 * seg(t, .85, 1) : 0);
        core.setAttribute('opacity', cu > 0 ? 1 - .6 * seg(t, .85, 1) : 0);
        crack.setAttribute('stroke-dashoffset', Llen * (1 - cu));
        core.setAttribute('stroke-dashoffset', Llen * (1 - cu));
        flash.setAttribute('opacity', .5 * Math.sin(seg(t, .45, .55) * Math.PI));
        const v = ease(P, seg(t, .45, .8));
        xM = lerp(460, 250, v); xW = lerp(620, 830, v);
        const g = seg(t, .6, 1);
        S.man.set(xM, s, -6 * v, 1, .85 * g, 1 - .25 * g);
        S.woman.set(xW, s, 6 * v, 1, .85 * g, 1 - .25 * g);
        const hp = seg(t, .5, .62);
        heart.setAttribute('opacity', hp);
        heart.setAttribute('transform', `translate(540,320) scale(${E.back(hp)})`);
      },
      anchors: () => [[xM, 542], [xW, 542], [540, 500]],
      guidePath: () => 'M460,660 L250,660 M620,660 L830,660',
    };
  },
});

/* ============ D1 印章砸落 ============ */
def({
  id: 'stamp-drop', cat: 'focus', name: '印章砸落', dur: 4.6,
  desc: '印章举起砸向证据清单：冲击波环+纸面余震+红色认定印显现',
  phases: [[.25, '举章'], [.38, '砸落'], [.6, '冲击余震'], [.85, '抬章'], [1.01, '认定完成']],
  events: [{ at: .25, sfx: 'whoosh' }, { at: .38, sfx: 'stamp' }],
  build(S) {
    propTable(el('g', { transform: 'translate(540,600)' }, S.below), 320);
    const doc = propDoc(el('g', {}, S.above), '证据清单');
    const imprint = propImprint(el('g', { opacity: 0, transform: 'translate(540,545)' }, S.above));
    const stamp = propStamp(el('g', {}, S.above));
    const ring = el('circle', { cx: 540, cy: 545, r: 20, fill: 'none', stroke: PAL.seal, 'stroke-width': 6, opacity: 0 }, S.fx);
    const dust = Array.from({ length: 6 }, () => el('circle', { r: 4.5, fill: '#b7a687', opacity: 0 }, S.fx));
    return {
      update(t, P) {
        const s = P.scale;
        let y;
        if (t < .25) { const r = ease(P, seg(t, 0, .25)); y = lerp(430, 330, r) + Math.sin(r * Math.PI * 2) * 4; }
        else if (t < .38) y = lerp(330, 545, E.inQuad(seg(t, .25, .38)));
        else if (t < .6) y = 545;
        else y = lerp(545, 320, ease(P, seg(t, .6, .85)));
        stamp.setAttribute('opacity', 1 - seg(t, .85, 1));
        stamp.setAttribute('transform', `translate(540,${y})`);
        const ru = seg(t, .38, .62);
        ring.setAttribute('r', lerp(20, 150 * P.amp, E.smooth(ru)));
        ring.setAttribute('opacity', ru > 0 ? (1 - ru) * .8 : 0);
        const dx = shake(t, .38, .25, 6 * P.amp);
        doc.setAttribute('transform', `translate(${540 + dx},520) rotate(${-3 + shake(t, .38, .25, 2 * P.amp)}) scale(.9)`);
        imprint.setAttribute('opacity', seg(t, .38, .5));
        const du = seg(t, .38, .6);
        dust.forEach((d, i) => {
          const ang = (i / 6) * Math.PI * 2;
          d.setAttribute('opacity', du > 0 && du < 1 ? (1 - du) * .85 : 0);
          d.setAttribute('cx', 540 + Math.cos(ang) * lerp(16, 95 * P.amp, du));
          d.setAttribute('cy', 545 + Math.sin(ang) * lerp(8, 40, du));
        });
        const lean = 3 * Math.sin(seg(t, .38, .55) * Math.PI);
        S.man.set(MANX, s, lean);
        S.woman.set(WOMX, s, -lean);
      },
      anchors: () => [[540, 545], [540, 545]],
      guidePath: () => 'M540,330 L540,545',
    };
  },
});

/* ============ D2 签字 ============ */
def({
  id: 'signature', cat: 'focus', name: '执笔签字', dur: 5.2,
  desc: '笔从男方手中飞到协议上沿签名路径描边，收笔后弹出确认章',
  phases: [[.2, '执笔就位'], [.7, '落笔签字'], [.85, '收笔返回'], [1.01, '签字确认']],
  events: [{ at: .05, sfx: 'paper' }, { at: .2, sfx: 'scratch' }, { at: .8, sfx: 'pop' }],
  build(S) {
    propTable(el('g', { transform: 'translate(540,600)' }, S.below), 320);
    const doc = propDoc(el('g', { transform: 'translate(540,520) rotate(-2) scale(.9)' }, S.above), '调解协议');
    const sig = el('path', { d: 'M-40,44 C-24,10 -12,64 2,32 S 22,52 40,26', fill: 'none', stroke: PAL.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, doc);
    const SL = sig.getTotalLength();
    sig.setAttribute('stroke-dasharray', SL);
    sig.setAttribute('stroke-dashoffset', SL);
    const pen = propPen(el('g', {}, S.above));
    const check = chip(el('g', { opacity: 0 }, S.fx), 540, 380, '签字确认', PAL.jade, 22);
    const rad = -2 * Math.PI / 180;
    const docWorld = p => [540 + .9 * (p.x * Math.cos(rad) - p.y * Math.sin(rad)), 520 + .9 * (p.x * Math.sin(rad) + p.y * Math.cos(rad))];
    let pos = [0, 0];
    return {
      update(t, P) {
        const s = P.scale;
        const mh = S.man.hand(MANX, s);
        const start = docWorld(sig.getPointAtLength(0));
        let rot = 0;
        if (t < .2) { const u = ease(P, seg(t, 0, .2)); pos = [lerp(mh[0], start[0], u), lerp(mh[1], start[1], u) - 30 * Math.sin(u * Math.PI) * P.amp]; rot = lerp(0, -8, u); }
        else if (t < .7) {
          const w = seg(t, .2, .7);
          pos = docWorld(sig.getPointAtLength(SL * w));
          rot = -8 + Math.sin(w * 42) * 4 * P.amp;
          sig.setAttribute('stroke-dashoffset', SL * (1 - w));
        } else {
          sig.setAttribute('stroke-dashoffset', 0);
          const end = docWorld(sig.getPointAtLength(SL));
          const l = ease(P, seg(t, .7, .85));
          pos = [lerp(end[0], mh[0], l), lerp(end[1], mh[1], l) - 30 * Math.sin(l * Math.PI) * P.amp];
          rot = lerp(-8, 0, l);
        }
        pen.setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${rot})`);
        const cp = seg(t, .8, .92);
        check.setAttribute('opacity', cp);
        check.setAttribute('transform', `translate(0,${(1 - E.back(cp)) * -24}) scale(1)`);
        const writing = t >= .2 && t < .7 ? 1 : 0;
        S.man.set(MANX, s, 2 * writing + 2 * Math.sin(seg(t, 0, .2) * Math.PI));
        S.woman.set(WOMX, s, -2 * writing);
      },
      anchors: () => [pos],
      guidePath: () => 'M400,542 Q470,470 505,560',
    };
  },
});

/* ============================================================
   动作工厂：新人物招牌动作全部由以下机制组合而成。
   造新动作 = 选机制 + 填配置（见 references/action-forge.md）。
   ============================================================ */
CATS.lock = { name: '锁定·联合', color: '#8a63d2' };

const PROP_FNS = {
  doc: (g, t) => propDoc(g, t), indict: g => propIndict(g), cert: (g, t) => propCert(g, t),
  book: g => propLawBook(g), folder: g => propFolder(g), chart: g => propMedChart(g),
  ledger: g => propLedger(g), record: g => propRecordBook(g), bankbook: g => propBankbook(g),
};
const STAMP_FNS = { stamp: g => propStamp(g), gavel: g => propGavel(g), seal: g => propCompanySeal(g) };
const faceFlip = (C, want) => want / C.face;
const chEvents = n => Array.from({ length: n }, (_, i) => ({ at: .06 + i * .055 + .32, sfx: 'ching' }));

/* 机制·交接：道具从 from 手弧线飞向 to 手，接住翻面 */
function actHandoff(o) {
  return def({
    id: o.id, cat: 'hand', name: o.name, dur: o.dur || 4.6, desc: o.desc, cast: o.cast,
    phases: [[.18, '持握示证'], [.55, '弧线递出'], [.75, '接住翻面'], [1.01, '持稳确认']],
    events: [{ at: .18, sfx: 'whoosh' }, { at: .55, sfx: 'paper' }],
    build(S) {
      const A = S.chars[o.from], B = S.chars[o.to];
      const fA = faceFlip(A.C, 1), fB = faceFlip(B.C, -1);
      const prop = PROP_FNS[o.prop || 'doc'](el('g', {}, S.above), o.title);
      let pos = [0, 0];
      return {
        update(t, P) {
          const s = P.scale;
          const ah = A.hand(o.fromX, s, 0, fA), bh = B.hand(o.toX, s, 0, fB);
          let rot = -6, fx = 1;
          if (t < .18) pos = [ah[0], ah[1] - 12 * ease(P, seg(t, 0, .18))];
          else if (t < .55) { const u = ease(P, seg(t, .18, .55)); pos = qbez(ah, bh, 150 * P.amp, u); rot = lerp(-8, 6, u); }
          else if (t < .75) { const v = seg(t, .55, .75); pos = bh; fx = Math.cos(v * Math.PI * 2); rot = 6; }
          else { const w = seg(t, .75, 1); pos = [bh[0], bh[1] - 5 * Math.sin(w * Math.PI)]; rot = 4; }
          prop.setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${rot}) scale(${fx},${o.propScale || 1})`);
          A.set(o.fromX, s, 3 * Math.sin(seg(t, .1, .3) * Math.PI), fA);
          B.set(o.toX, s, -3 * Math.sin(seg(t, .5, .7) * Math.PI), fB);
        },
        anchors: () => [pos],
        guidePath: P => qd(A.hand(o.fromX, P.scale, 0, fA), B.hand(o.toX, P.scale, 0, fB), 150 * P.amp),
      };
    },
  });
}

/* 机制·钱流：钞票流 + 计数；mode=pile 落堆 / mode=chip 流入暗处（转移财产） */
function actMoney(o) {
  return def({
    id: o.id, cat: 'money', name: o.name, dur: o.dur || 5.4, desc: o.desc, cast: o.cast,
    phases: [[.2, '钞票流出'], [.8, '计数累加'], [1.01, o.mode === 'chip' ? '流入暗处' : '落堆成山']],
    events: chEvents(10),
    build(S) {
      const A = S.chars[o.from], B = o.to ? S.chars[o.to] : null;
      const fA = faceFlip(A.C, 1), fB = B ? faceFlip(B.C, -1) : 1;
      const N = 10, PILE = [o.pileX != null ? o.pileX : o.toX + 120, 692];
      const notes = Array.from({ length: N }, () => propNote(el('g', { opacity: 0 }, S.above)));
      const pile = el('g', { transform: `translate(${PILE[0]},${PILE[1]})`, opacity: o.mode === 'chip' ? 0 : 1 }, S.above);
      const layers = Array.from({ length: N }, (_, i) =>
        el('rect', { x: -58, y: -10 - i * 10, width: 116, height: 14, rx: 4, fill: i % 2 ? PAL.seal : '#c03328', stroke: PAL.sealDeep, 'stroke-width': 1, opacity: 0 }, pile));
      const topNote = propNote(el('g', { opacity: 0, transform: 'translate(0,-116) rotate(-4)' }, pile));
      const target = o.mode === 'chip' ? chip(el('g', {}, S.fx), PILE[0], 620, o.chipText || '他人账户', PAL.ink, 20) : null;
      const counter = el('g', {}, S.fx);
      const cRect = el('rect', { x: 410, y: 250, width: 260, height: 62, rx: 31, fill: PAL.ink, opacity: .88 }, counter);
      const cText = txt(el('text', { x: 540, y: 292, 'text-anchor': 'middle', 'font-size': 32, 'font-weight': 800, fill: o.mode === 'chip' ? '#e08a63' : PAL.gold }, counter), '¥0');
      let last = [0, 0];
      return {
        update(t, P) {
          const s = P.scale;
          const ah = A.hand(o.fromX, s, 0, fA);
          const start = o.sneak ? [o.fromX - 46 * s, GROUND - 150 * s] : ah;
          const end = [PILE[0], 620];
          let arrived = 0;
          for (let i = 0; i < N; i++) {
            const st = .06 + i * .055, u = seg(t, st, st + .32);
            if (u <= 0) { notes[i].setAttribute('opacity', 0); continue; }
            if (u >= 1) {
              arrived++;
              notes[i].setAttribute('opacity', 0);
              if (o.mode !== 'chip') layers[i].setAttribute('opacity', 1);
              continue;
            }
            const e = E.smooth(u);
            const pos = qbez(start, end, (o.sneak ? 60 : 100 + Math.sin(i * 2.1) * 24) * P.amp, e);
            last = pos;
            notes[i].setAttribute('opacity', o.mode === 'chip' ? .8 : 1);
            notes[i].setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${Math.sin(u * Math.PI) * 20 * P.amp + (i % 3 - 1) * 6}) scale(${.8 + .2 * Math.sin(u * Math.PI)})`);
          }
          topNote.setAttribute('opacity', arrived === N && o.mode !== 'chip' ? 1 : 0);
          if (target) target.setAttribute('transform', `scale(${1 + .06 * Math.sin(seg(t, .4, .9) * Math.PI * 3) * P.amp})`);
          txt(cText, (o.label ? o.label + ' ' : '') + fmtMoney(o.amount * E.smooth(seg(t, .06, .8))));
          const w = cText.textContent.length * 19 + 50;
          cRect.setAttribute('x', 540 - w / 2); cRect.setAttribute('width', w);
          counter.setAttribute('opacity', t > .04 ? 1 : 0);
          A.set(o.fromX, s, 2 * Math.sin(seg(t, .05, .25) * Math.PI), fA);
          if (B) B.set(o.toX, s, -2 * Math.sin(seg(t, .5, .7) * Math.PI), fB);
          if (o.extra) o.extra(S, t, P);
        },
        anchors: () => [last, PILE],
        guidePath: P => qd(A.hand(o.fromX, P.scale, 0, fA), [PILE[0], 620], 100 * P.amp),
      };
    },
  });
}

/* 机制·砸章：举章→砸落→冲击波→认定印→结论 chip（法槌/公章/印章同构） */
function actStamp(o) {
  return def({
    id: o.id, cat: 'focus', name: o.name, dur: o.dur || 4.6, desc: o.desc, cast: o.cast,
    phases: [[.25, '举章'], [.38, '砸落'], [.6, '冲击余震'], [.85, '抬章'], [1.01, o.chipText]],
    events: [{ at: .25, sfx: 'whoosh' }, { at: .38, sfx: 'stamp' }, { at: .8, sfx: 'pop' }],
    build(S) {
      const C = S.chars[o.caster], W = o.watch ? S.chars[o.watch] : null;
      const fC = faceFlip(C.C, 1);
      propTable(el('g', { transform: 'translate(540,600)' }, S.below), 320);
      const doc = propDoc(el('g', {}, S.above), o.docTitle);
      const imprint = propImprint(el('g', { opacity: 0, transform: 'translate(540,545)' }, S.above), o.imprintText);
      const stamp = STAMP_FNS[o.prop || 'stamp'](el('g', {}, S.above));
      const ring = el('circle', { cx: 540, cy: 545, r: 20, fill: 'none', stroke: PAL.seal, 'stroke-width': 6, opacity: 0 }, S.fx);
      const dust = Array.from({ length: 6 }, () => el('circle', { r: 4.5, fill: '#b7a687', opacity: 0 }, S.fx));
      const done = chip(el('g', { opacity: 0 }, S.fx), 540, 370, o.chipText, o.chipColor || PAL.seal, 22);
      return {
        update(t, P) {
          const s = P.scale;
          let y;
          if (t < .25) { const r = ease(P, seg(t, 0, .25)); y = lerp(430, 330, r) + Math.sin(r * Math.PI * 2) * 4; }
          else if (t < .38) y = lerp(330, 545, E.inQuad(seg(t, .25, .38)));
          else if (t < .6) y = 545;
          else y = lerp(545, 320, ease(P, seg(t, .6, .85)));
          stamp.setAttribute('opacity', 1 - seg(t, .85, 1));
          stamp.setAttribute('transform', `translate(540,${y})`);
          const ru = seg(t, .38, .62);
          ring.setAttribute('r', lerp(20, 150 * P.amp, E.smooth(ru)));
          ring.setAttribute('opacity', ru > 0 ? (1 - ru) * .8 : 0);
          const dx = shake(t, .38, .25, 6 * P.amp);
          doc.setAttribute('transform', `translate(${540 + dx},520) rotate(${-3 + shake(t, .38, .25, 2 * P.amp)}) scale(.9)`);
          imprint.setAttribute('opacity', seg(t, .38, .5));
          const du = seg(t, .38, .6);
          dust.forEach((d, i) => {
            const ang = (i / 6) * Math.PI * 2;
            d.setAttribute('opacity', du > 0 && du < 1 ? (1 - du) * .85 : 0);
            d.setAttribute('cx', 540 + Math.cos(ang) * lerp(16, 95 * P.amp, du));
            d.setAttribute('cy', 545 + Math.sin(ang) * lerp(8, 40, du));
          });
          const dp = seg(t, .78, .9);
          done.setAttribute('opacity', dp);
          done.setAttribute('transform', `translate(0,${(1 - E.back(dp)) * -24})`);
          const lean = 3 * Math.sin(seg(t, .38, .55) * Math.PI);
          C.set(o.casterX, s, lean, fC);
          if (W) W.set(o.watchX || 760, s, -lean, W.C.face === -1 ? 1 : -1);
        },
        anchors: () => [[540, 545]],
        guidePath: () => 'M540,330 L540,545',
      };
    },
  });
}

/* 机制·焦点：文书/法典/账本展开逐行点亮，或纯 chip+火花（宣誓） */
function actFocus(o) {
  return def({
    id: o.id, cat: 'focus', name: o.name, dur: o.dur || 5.2, desc: o.desc, cast: o.cast,
    phases: [[.25, '展开示证'], [.7, '逐行点亮'], [1.01, o.chipText]],
    events: [{ at: .2, sfx: 'paper' }, { at: .75, sfx: 'pop' }],
    build(S) {
      const C = S.chars[o.caster], W = o.watch ? S.chars[o.watch] : null;
      const fC = faceFlip(C.C, 1);
      let prop = null, lines = [];
      if (o.kind === 'doc') {
        prop = propDoc(el('g', { opacity: 0 }, S.above), o.title);
        lines = (o.lines || []).map((s, i) =>
          txt(el('text', { x: 540, y: 452 + i * 26, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: PAL.ink, opacity: 0 }, S.above), s));
      } else if (o.kind === 'book') prop = propLawBook(el('g', { opacity: 0 }, S.above));
      else if (o.kind === 'ledger') prop = propLedger(el('g', { opacity: 0 }, S.above));
      const spark = symbolSpark(el('g', { opacity: 0 }, S.fx));
      const done = chip(el('g', { opacity: 0 }, S.fx), 540, 330, o.chipText, o.chipColor || PAL.jade, 22);
      return {
        update(t, P) {
          const s = P.scale;
          const up = ease(P, seg(t, .05, .25));
          if (prop) {
            prop.setAttribute('opacity', up);
            const sc = (o.kind === 'doc' ? .95 : 1.25) * (.8 + .2 * up);
            prop.setAttribute('transform', `translate(540,${lerp(560, 470, up)}) scale(${sc})`);
          }
          lines.forEach((n, i) => n.setAttribute('opacity', seg(t, .3 + i * .12, .42 + i * .12)));
          const sp = seg(t, .7, .85);
          const hx = o.kind === 'chip' ? C.hand(o.casterX, s, 0, fC) : [540, 400];
          spark.setAttribute('opacity', Math.sin(sp * Math.PI));
          spark.setAttribute('transform', `translate(${hx[0]},${hx[1] - 40}) scale(${.5 + .7 * Math.sin(sp * Math.PI)}) rotate(${sp * 90})`);
          const dp = seg(t, .75, .9);
          done.setAttribute('opacity', dp);
          done.setAttribute('transform', `translate(0,${(1 - E.back(dp)) * -24})`);
          C.set(o.casterX, s, 3 * Math.sin(seg(t, .1, .4) * Math.PI), fC);
          if (W) W.set(o.watchX || 760, s, -2 * Math.sin(seg(t, .3, .6) * Math.PI), W.C.face === -1 ? 1 : -1);
        },
        anchors: () => [[540, 470]],
        guidePath: () => '',
      };
    },
  });
}

/* 机制·双人位移：同步滑入/滑出，可灰化（带离/搀扶） */
function actMovePair(o) {
  return def({
    id: o.id, cat: 'move', name: o.name, dur: o.dur || 4.8, desc: o.desc, cast: o.cast,
    phases: [[.15, '就位'], [.8, o.grayB ? '押解/搀扶移出' : '同步位移'], [1.01, '离场']],
    events: [{ at: .1, sfx: 'whoosh' }, { at: .8, sfx: 'thud' }],
    build(S) {
      const A = S.chars[o.a], B = S.chars[o.b];
      const fA = o.faceA != null ? faceFlip(A.C, o.faceA) : 1;
      const fB = o.faceB != null ? faceFlip(B.C, o.faceB) : 1;
      let xa = o.a0, xb = o.b0;
      return {
        update(t, P) {
          const s = P.scale;
          const u = ease(P, seg(t, .15, .85));
          xa = lerp(o.a0, o.a1, u); xb = lerp(o.b0, o.b1, u);
          const step = Math.sin(t * Math.PI * 6) * 1.5 * (u > 0 && u < 1 ? 1 : 0);
          const g = o.grayB ? seg(t, .3, .8) : 0;
          A.set(xa, s, o.leanA || 0, fA);
          B.set(xb + step, s, o.leanB || 0, fB, .8 * g, 1 - .2 * g);
        },
        anchors: () => [[xa, 542], [xb, 542]],
        guidePath: () => `M${o.a0},660 L${o.a1},660 M${o.b0},660 L${o.b1},660`,
      };
    },
  });
}

/* 机制·锁定：走近→手铐落腕→火花咔嗒→对方灰化低头 */
function actLock(o) {
  return def({
    id: o.id, cat: 'lock', name: o.name, dur: o.dur || 5.2, desc: o.desc, cast: o.cast,
    phases: [[.35, '走近控制'], [.55, '手铐落腕'], [.75, '咔嗒锁定'], [1.01, '灰化低头']],
    events: [{ at: .05, sfx: 'whoosh' }, { at: .55, sfx: 'ching' }, { at: .75, sfx: 'thud' }],
    build(S) {
      const A = S.chars[o.a], B = S.chars[o.b];
      const fA = faceFlip(A.C, 1), fB = faceFlip(B.C, -1);
      const cuffs = propCuffs(el('g', { opacity: 0 }, S.above));
      const spark = symbolSpark(el('g', { opacity: 0 }, S.fx));
      const done = chip(el('g', { opacity: 0 }, S.fx), 540, 330, o.chipText || '依法拘留', PAL.azure, 22);
      let xa = o.a0, pos = [0, 0];
      return {
        update(t, P) {
          const s = P.scale;
          const u = ease(P, seg(t, 0, .35));
          xa = lerp(o.a0, o.a1, u);
          const bh = B.hand(o.b0, s, 0, fB);
          const ah = A.hand(xa, s, 0, fA);
          if (t < .35) pos = ah;
          else if (t < .55) { const v = ease(P, seg(t, .35, .55)); pos = qbez(ah, bh, 80 * P.amp, v); }
          else pos = bh;
          cuffs.setAttribute('opacity', seg(t, .3, .4));
          cuffs.setAttribute('transform', `translate(${pos[0]},${pos[1]}) scale(${1 + .1 * Math.sin(seg(t, .55, .7) * Math.PI)})`);
          const sp = seg(t, .55, .7);
          spark.setAttribute('opacity', Math.sin(sp * Math.PI));
          spark.setAttribute('transform', `translate(${bh[0]},${bh[1] - 30}) scale(${.5 + .6 * Math.sin(sp * Math.PI)})`);
          const g = seg(t, .6, .9);
          const dp = seg(t, .75, .9);
          done.setAttribute('opacity', dp);
          done.setAttribute('transform', `translate(0,${(1 - E.back(dp)) * -24})`);
          A.set(xa, s, 2 * u, fA);
          B.set(o.b0, s, 8 * g, fB, .8 * g, 1 - .15 * g);
        },
        anchors: () => [pos],
        guidePath: P => qd(A.hand(o.a1, P.scale, 0, fA), B.hand(o.b0, P.scale, 0, fB), 80 * P.amp),
      };
    },
  });
}

/* 机制·联合：双方倾身手部相会（握手）或同争一物（抢公章） */
function actJoint(o) {
  return def({
    id: o.id, cat: 'lock', name: o.name, dur: o.dur || 5, desc: o.desc, cast: o.cast,
    phases: [[.4, '倾身靠近'], [.6, o.mode === 'seal' ? '双手争章' : '握手达成'], [.85, '脉冲确认'], [1.01, o.chipText]],
    events: [{ at: .4, sfx: 'whoosh' }, { at: .6, sfx: o.mode === 'seal' ? 'thud' : 'pop' }],
    build(S) {
      const A = S.chars[o.a], B = S.chars[o.b];
      const M = o.mid ? S.chars[o.mid] : null;
      const fA = faceFlip(A.C, 1), fB = faceFlip(B.C, -1);
      const seal = o.mode === 'seal' ? propCompanySeal(el('g', {}, S.above)) : null;
      if (o.mode === 'seal') propTable(el('g', { transform: 'translate(540,600)' }, S.below), 260);
      const spark = symbolSpark(el('g', { opacity: 0 }, S.fx));
      const done = chip(el('g', { opacity: 0 }, S.fx), 540, 330, o.chipText, o.chipColor || PAL.jade, 22);
      let xa = o.a0, xb = o.b0;
      return {
        update(t, P) {
          const s = P.scale;
          const u = ease(P, seg(t, .1, .45));
          xa = lerp(o.a0, o.a1, u); xb = lerp(o.b0, o.b1, u);
          const tr = o.mode === 'seal' ? shake(t, .5, .3, 3 * P.amp) : 0;
          const lean = 6 * u;
          A.set(xa + tr, s, lean, fA);
          B.set(xb - tr, s, -lean, fB);
          if (M) M.set(540, s * .95, 0, 1, 0, .9);
          if (seal) seal.setAttribute('transform', `translate(${540 + tr},545) scale(1.2)`);
          const sp = seg(t, .55, .75);
          spark.setAttribute('opacity', Math.sin(sp * Math.PI));
          spark.setAttribute('transform', `translate(540,${GROUND - 158 * s - (seal ? 60 : 30)}) scale(${.5 + .8 * Math.sin(sp * Math.PI)}) rotate(${sp * 90})`);
          const dp = seg(t, .7, .88);
          done.setAttribute('opacity', dp);
          done.setAttribute('transform', `translate(0,${(1 - E.back(dp)) * -24})`);
        },
        anchors: P => [[540, GROUND - 158 * P.scale]],
        guidePath: () => `M${o.a0},660 L${o.a1},660 M${o.b0},660 L${o.b1},660`,
      };
    },
  });
}

/* 机制·灰化：限制牌从头顶落下→全身灰化低头（限高/失信） */
function actGray(o) {
  return def({
    id: o.id, cat: 'move', name: o.name, dur: 4.6, desc: o.desc, cast: o.cast,
    phases: [[.3, '限制牌落下'], [.6, '灰化低头'], [1.01, '受限定格']],
    events: [{ at: .3, sfx: 'thud' }],
    build(S) {
      const C = S.chars[o.who];
      const tag = chip(el('g', {}, S.fx), 540, 200, o.chipText, PAL.ink, 22);
      const dust = Array.from({ length: 6 }, () => el('circle', { r: 4.5, fill: '#b7a687', opacity: 0 }, S.fx));
      return {
        update(t, P) {
          const s = P.scale;
          const u = E.inQuad(seg(t, .05, .3));
          tag.setAttribute('transform', `translate(0,${lerp(160, GROUND - 330 * s, u) - 200})`);
          const g = seg(t, .3, .7);
          C.set(540, s, 8 * g, 1, .85 * g, 1 - .2 * g);
          const du = seg(t, .3, .55);
          dust.forEach((d, i) => {
            const ang = (i / 6) * Math.PI * 2;
            d.setAttribute('opacity', du > 0 && du < 1 ? (1 - du) * .8 : 0);
            d.setAttribute('cx', 540 + Math.cos(ang) * lerp(14, 80 * P.amp, du));
            d.setAttribute('cy', GROUND - 320 * s + Math.sin(ang) * lerp(6, 30, du));
          });
        },
        anchors: () => [[540, 370]],
        guidePath: () => 'M540,160 L540,370',
      };
    },
  });
}

/* 机制·归属：小孩从中间走向父/母一侧（抚养权） */
function actCustody(o) {
  return def({
    id: o.id, cat: 'move', name: o.name, dur: 5, desc: o.desc, cast: o.cast,
    phases: [[.2, '居中犹豫'], [.7, '走向归属'], [1.01, o.chipText]],
    events: [{ at: .2, sfx: 'whoosh' }, { at: .7, sfx: 'pop' }],
    build(S) {
      const M = S.chars.man, W = S.chars.woman, K = S.chars.child;
      const done = chip(el('g', { opacity: 0 }, S.fx), 540, 300, o.chipText, PAL.azure, 22);
      const spark = symbolSpark(el('g', { opacity: 0 }, S.fx));
      let xk = 540;
      return {
        update(t, P) {
          const s = P.scale;
          const u = ease(P, seg(t, .2, .7));
          xk = lerp(540, o.toX, u);
          const wob = Math.sin(seg(t, 0, .2) * Math.PI * 2) * 3;
          K.set(xk, s * .9, wob * (1 - u), o.toX < 540 ? -1 : 1);
          M.set(320, s, 3 * Math.sin(seg(t, .5, .8) * Math.PI), 1);
          W.set(760, s, -3 * Math.sin(seg(t, .5, .8) * Math.PI), 1);
          const dp = seg(t, .65, .8);
          done.setAttribute('opacity', dp);
          done.setAttribute('transform', `translate(0,${(1 - E.back(dp)) * -24})`);
          const sp = seg(t, .7, .85);
          spark.setAttribute('opacity', Math.sin(sp * Math.PI));
          spark.setAttribute('transform', `translate(${xk},${GROUND - 220 * s}) scale(${.5 + .6 * Math.sin(sp * Math.PI)})`);
        },
        anchors: () => [[xk, 542]],
        guidePath: () => `M540,660 L${o.toX},660`,
      };
    },
  });
}

/* ============ 法官 ============ */
actStamp({
  id: 'gavel-drop', name: '敲槌定音', caster: 'judge', casterX: 320, watch: 'woman',
  prop: 'gavel', docTitle: '判决书', imprintText: '判决生效', chipText: '判决如下',
  desc: '法槌举起砸落判决书：冲击波+生效印+判决如下章',
  cast: [{ id: 'judge', who: 'judge', opt: { noProp: true } }, { id: 'woman', who: 'woman' }],
});
actHandoff({
  id: 'verdict-handoff', name: '递判决书', from: 'judge', to: 'man', fromX: 320, toX: 760,
  prop: 'doc', title: '判决书', desc: '判决书从法官手中弧线飞向当事人，接住翻面',
  cast: [{ id: 'judge', who: 'judge', opt: { noProp: true } }, { id: 'man', who: 'man' }],
});
/* ============ 警察 ============ */
actLock({
  id: 'arrest', name: '上铐抓捕', a: 'police', b: 'rogue', a0: 180, a1: 470, b0: 760,
  chipText: '依法拘留', desc: '警察走近控制，手铐落腕咔嗒锁定，老赖灰化低头',
  cast: [{ id: 'police', who: 'police', opt: { noProp: true } }, { id: 'rogue', who: 'rogue' }],
});
actMovePair({
  id: 'escort', name: '带离现场', a: 'police', b: 'rogue', a0: 380, a1: 1250, b0: 560, b1: 1430,
  grayB: true, faceB: 1, leanB: 6, desc: '警察押解灰化老赖同步移出画面',
  cast: [{ id: 'police', who: 'police' }, { id: 'rogue', who: 'rogue' }],
});
/* ============ 律师 ============ */
actFocus({
  id: 'law-reveal', name: '亮法条', caster: 'lawyer', casterX: 320, watch: 'man', kind: 'book',
  chipText: '《民法典》第1042条', chipColor: PAL.seal, desc: '法典展开脉冲，弹出适用条文 chip（条文按稿件替换）',
  cast: [{ id: 'lawyer', who: 'lawyer', opt: { noProp: true } }, { id: 'man', who: 'man' }],
});
actHandoff({
  id: 'retainer-handoff', name: '递委托手续', from: 'lawyer', to: 'man', fromX: 320, toX: 760,
  prop: 'folder', desc: '委托代理合同文件夹从律师手飞向当事人',
  cast: [{ id: 'lawyer', who: 'lawyer', opt: { noProp: true } }, { id: 'man', who: 'man' }],
});
/* ============ 老赖 ============ */
actMoney({
  id: 'asset-hide', name: '转移财产', from: 'rogue', fromX: 320, mode: 'chip', sneak: true,
  amount: 660000, label: '转移', chipText: '他人账户', pileX: 880,
  desc: '钞票从老赖背后沿低弧线溜入他人账户，计数曝光',
  cast: [{ id: 'rogue', who: 'rogue' }],
});
actGray({
  id: 'limit-gray', name: '限高灰化', who: 'rogue', chipText: '限制高消费',
  desc: '限高牌从头顶落下，老赖全身灰化低头定格',
  cast: [{ id: 'rogue', who: 'rogue' }],
});
/* ============ 调解员 ============ */
actHandoff({
  id: 'mediation-handoff', name: '递调解协议', from: 'mediator', to: 'woman', fromX: 320, toX: 760,
  prop: 'doc', title: '调解协议', desc: '调解协议从调解员手飞向女方',
  cast: [{ id: 'mediator', who: 'mediator', opt: { noProp: true } }, { id: 'woman', who: 'woman' }],
});
actJoint({
  id: 'handshake', name: '促成握手', mode: 'shake', a: 'man', b: 'woman', mid: 'mediator',
  a0: 240, a1: 440, b0: 840, b1: 640, chipText: '调解成功',
  desc: '调解员居中，双方倾身握手，暖色火花确认',
  cast: [{ id: 'mediator', who: 'mediator' }, { id: 'man', who: 'man' }, { id: 'woman', who: 'woman' }],
});
/* ============ 证人 ============ */
actFocus({
  id: 'oath', name: '宣誓保证', caster: 'witness', casterX: 540, kind: 'chip',
  chipText: '如实作证', desc: '证人举手宣誓，火花+如实作证 chip',
  cast: [{ id: 'witness', who: 'witness' }],
});
actHandoff({
  id: 'testimony-handoff', name: '递证言', from: 'witness', to: 'judge', fromX: 320, toX: 760,
  prop: 'doc', title: '证人证言', desc: '证言从证人举起的另一手递向法官',
  cast: [{ id: 'witness', who: 'witness' }, { id: 'judge', who: 'judge', opt: { noProp: true } }],
});
/* ============ 父母 ============ */
actMoney({
  id: 'savings-flow', name: '递积蓄', from: 'parent', to: 'man', fromX: 320, toX: 760,
  amount: 660000, label: '彩礼出资', desc: '父母积蓄钞票流飞向子女落堆，出资计数',
  cast: [{ id: 'parent', who: 'parent', opt: { noProp: true } }, { id: 'man', who: 'man' }],
});
actMovePair({
  id: 'support-exit', name: '搀扶离场', a: 'parent', b: 'man', a0: 500, a1: -140, b0: 680, b1: 40,
  faceA: -1, faceB: -1, leanA: -3, leanB: -3, dur: 5.6, desc: '父母与子女同步缓慢移出画面，互相搀扶',
  cast: [{ id: 'parent', who: 'parent' }, { id: 'man', who: 'man' }],
});
/* ============ 检察官 ============ */
actHandoff({
  id: 'indict-handoff', name: '提起公诉', from: 'prosecutor', to: 'judge', fromX: 320, toX: 760,
  prop: 'indict', desc: '起诉书从检察官手飞向法官',
  cast: [{ id: 'prosecutor', who: 'prosecutor', opt: { noProp: true } }, { id: 'judge', who: 'judge', opt: { noProp: true } }],
});
actFocus({
  id: 'indict-read', name: '宣读起诉书', caster: 'prosecutor', casterX: 320, watch: 'judge', kind: 'doc',
  title: '起诉书', lines: ['犯罪事实清楚', '证据确实充分', '依法提起公诉'], chipText: '提起公诉',
  desc: '起诉书展开逐行点亮，弹出提起公诉 chip',
  cast: [{ id: 'prosecutor', who: 'prosecutor', opt: { noProp: true } }, { id: 'judge', who: 'judge', opt: { noProp: true } }],
});
/* ============ 书记员 ============ */
actFocus({
  id: 'record-focus', name: '庭审记录', caster: 'clerk', casterX: 320, watch: 'judge', kind: 'ledger',
  chipText: '庭审笔录', desc: '记录本展开点亮，庭审笔录 chip 确认',
  cast: [{ id: 'clerk', who: 'clerk', opt: { noProp: true } }, { id: 'judge', who: 'judge', opt: { noProp: true } }],
});
actHandoff({
  id: 'record-handoff', name: '递笔录', from: 'clerk', to: 'man', fromX: 320, toX: 760,
  prop: 'record', desc: '庭审笔录从书记员手飞向当事人签字',
  cast: [{ id: 'clerk', who: 'clerk', opt: { noProp: true } }, { id: 'man', who: 'man' }],
});
/* ============ 老板 ============ */
actStamp({
  id: 'contract-seal', name: '盖章签约', caster: 'boss', casterX: 320, watch: 'worker',
  prop: 'seal', docTitle: '劳动合同', imprintText: '合同专用章', chipText: '签约成立', chipColor: PAL.jade,
  desc: '公章砸落劳动合同：冲击波+合同专用章+签约成立',
  cast: [{ id: 'boss', who: 'boss', opt: { noProp: true } }, { id: 'worker', who: 'worker' }],
});
actJoint({
  id: 'seal-grab', name: '抢公章', mode: 'seal', a: 'boss', b: 'boss2',
  a0: 300, a1: 450, b0: 780, b1: 630, chipText: '公章归属 · 依法判决', chipColor: PAL.seal,
  desc: '两位老板倾身争抢桌上公章，僵持微颤后判决归属',
  cast: [{ id: 'boss', who: 'boss', opt: { noProp: true } }, { id: 'boss2', who: 'boss', variant: 'partner', opt: { noProp: true } }],
});
/* ============ 工人 ============ */
actMoney({
  id: 'wages-flow', name: '讨薪·计数', from: 'boss', to: 'worker', fromX: 320, toX: 760,
  amount: 86000, label: '拖欠工资', desc: '工资钞票从老板手流向工人落堆，欠薪计数',
  cast: [{ id: 'boss', who: 'boss', opt: { noProp: true } }, { id: 'worker', who: 'worker' }],
});
actFocus({
  id: 'injury-focus', name: '工伤认定', caster: 'worker', casterX: 540, watch: 'boss', watchX: 800, kind: 'chip',
  chipText: '工伤认定', chipColor: PAL.gold, desc: '工伤者绷带臂火花脉冲，工伤认定 chip',
  cast: [{ id: 'worker', who: 'worker', variant: 'injured' }, { id: 'boss', who: 'boss' }],
});
/* ============ 医生 ============ */
actHandoff({
  id: 'chart-handoff', name: '递病历', from: 'doctor', to: 'man', fromX: 320, toX: 760,
  prop: 'chart', desc: '病历夹从医生手飞向患者',
  cast: [{ id: 'doctor', who: 'doctor', opt: { noProp: true } }, { id: 'man', who: 'man', variant: 'patient' }],
});
actFocus({
  id: 'appraisal-focus', name: '医疗鉴定', caster: 'doctor', casterX: 320, watch: 'man', kind: 'doc',
  title: '鉴定意见', lines: ['诊疗行为', '损害后果', '因果关系'], chipText: '医疗鉴定',
  desc: '鉴定意见展开三要素逐行点亮',
  cast: [{ id: 'doctor', who: 'doctor', opt: { noProp: true } }, { id: 'man', who: 'man', variant: 'patient' }],
});
/* ============ 会计 ============ */
actFocus({
  id: 'audit-focus', name: '对账', caster: 'accountant', casterX: 320, watch: 'boss', kind: 'ledger',
  chipText: '账目核对', desc: '账本展开点亮，账目核对 chip',
  cast: [{ id: 'accountant', who: 'accountant', opt: { noProp: true } }, { id: 'boss', who: 'boss' }],
});
actMoney({
  id: 'embezzle-expose', name: '转移资产曝光', from: 'accountant', fromX: 320, mode: 'chip', sneak: true,
  amount: 1200000, label: '挪用', chipText: '他人账户', pileX: 880, watch: 'boss',
  desc: '账本资金沿低弧线溜入他人账户，挪用金额曝光',
  cast: [{ id: 'accountant', who: 'accountant', opt: { noProp: true } }, { id: 'boss', who: 'boss' }],
  extra(S, t, P) { S.chars.boss.set(800, P.scale, -3 * Math.sin(seg(t, .4, .7) * Math.PI), -1); },
});
/* ============ 小孩 ============ */
actCustody({
  id: 'custody-move', name: '抚养权归属', toX: 430, chipText: '抚养权 · 父',
  desc: '小孩居中犹豫后走向父方，抚养权 chip 落定',
  cast: [{ id: 'man', who: 'man' }, { id: 'woman', who: 'woman' }, { id: 'child', who: 'child' }],
});
actMoney({
  id: 'alimony-flow', name: '抚养费·计数', from: 'man', to: 'woman', fromX: 320, toX: 700,
  amount: 36000, label: '抚养费', pileX: 990, desc: '抚养费钞票流飞向抚养方落堆，小孩依偎在侧',
  cast: [{ id: 'man', who: 'man' }, { id: 'woman', who: 'woman' }, { id: 'child', who: 'child' }],
  extra(S, t, P) { S.chars.child.set(860, P.scale * .9, 0, -1); },
});