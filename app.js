/* 预览台驱动：时钟 / 控件 / 音效 / 导出 / 动作库 + 人物图鉴双模式 */
'use strict';

const $ = id => document.getElementById(id);
const stage = $('stage');

const P = {
  speed: 1, ease: 'smooth', amp: 1, scale: 1.12, outline: 6, shadow: 10,
  theme: 'cream', bg: 'paper', guides: false, loop: true, sound: true, dur: 4.6,
  orient: 'land',
};
const DEFAULTS = { ...P };

const GROUP_COLORS = {
  party: '#4d8fd1', court: '#c25062', agent: '#3fa87c',
  biz: '#eba63f', life: '#8a63d2', other: '#e08a63',
};

let act = null, api = null, S = null;
let t = 0, playing = true, scrubbing = false, lastFrame = -1;
let mode = 'acts', lastActId = null, lastChar = 'man', lastVariant = null;

/* ---------- 场景装配 ---------- */
const sceneRoot = $('sceneRoot');
const guidesG = $('guidesLayer');
const guideCross = $('guideCross');
const guidePath = $('guidePath');

function mount() {
  P.dur = act.dur;
  t = 0; playing = true; lastFrame = -1;
  sceneRoot.innerHTML = '';
  const below = el('g', {}, sceneRoot);
  const cast = act.cast || [{ id: 'man', who: 'man' }, { id: 'woman', who: 'woman' }];
  const chars = {};
  for (const c of cast) chars[c.id] = makeChar(sceneRoot, c.who, c.variant, c.opt);
  const above = el('g', {}, sceneRoot);
  const fx = el('g', {}, sceneRoot);
  S = { below, above, fx, chars, man: chars.man, woman: chars.woman };
  api = act.build(S);
  $('actName').textContent = act.name;
  $('actDesc').textContent = act.desc;
  const c = act.group
    ? { name: CHAR_GROUPS.find(g => g[0] === act.group)[1], color: GROUP_COLORS[act.group] }
    : CATS[act.cat];
  const cc = $('catChip');
  cc.textContent = c.name;
  cc.style.background = c.color;
  $('stageNum').textContent = String(act.num).padStart(2, '0');
  $('ticks').innerHTML = act.events.map(e =>
    `<span style="left:${e.at * 100}%" title="${e.sfx}"></span>`).join('');
  syncUI();
  render();
}

function setAction(id) {
  const found = ACTIONS.find(a => a.id === id) || ACTIONS[0];
  act = { ...found, num: ACTIONS.indexOf(found) + 1 };
  lastActId = act.id;
  mode = 'acts';
  $('variantRow').hidden = true;
  $('charActs').hidden = true;
  mount();
  buildLibs();
}

function setPortrait(who, variant) {
  const C = CHARS[who];
  const v = (C.variants || []).find(x => x.id === variant);
  const name = v ? `${C.label} · ${v.label}` : C.label;
  lastChar = who; lastVariant = variant || null;
  mode = 'chars';
  act = {
    id: `portrait-${who}${variant ? '-' + variant : ''}`,
    name, desc: C.desc, dur: 4.6, group: C.group, cast: [{ id: 'p', who, variant }],
    phases: [[1.01, '固定剪影']], events: [],
    num: Object.keys(CHARS).indexOf(who) + 1,
    build(S) {
      chip(el('g', {}, S.fx), 540, 752, name, GROUP_COLORS[C.group], 22);
      return {
        update(t, P) { S.chars.p.set(540, P.scale * 1.35, 0, 1); },
        anchors: () => [],
        guidePath: () => '',
      };
    },
  };
  mount();
  buildVariantRow(who, variant);
  buildCharActs(who);
  $('variantRow').hidden = false;
  $('charActs').hidden = false;
  buildLibs();
}

function buildVariantRow(who, variant) {
  const C = CHARS[who];
  const row = $('variantRow');
  row.innerHTML = '<span class="rowLbl">变体</span>';
  const mk = (id, label) => {
    const b = document.createElement('button');
    b.className = 'pill' + ((variant || null) === id ? ' on' : '');
    b.textContent = label;
    b.onclick = () => { audio(); setPortrait(who, id); };
    row.appendChild(b);
  };
  mk(null, '基础');
  for (const v of C.variants || []) mk(v.id, v.label);
}

function buildCharActs(who) {
  const row = $('charActs');
  row.innerHTML = '<span class="rowLbl">相关动作</span>';
  const list = ACTIONS.filter(a => (a.cast || []).some(c => c.who === who));
  if (!list.length) {
    const s = document.createElement('span');
    s.className = 'rowNone';
    s.textContent = '暂无专属动作 · 可用通用交接/钱流机制组合';
    row.appendChild(s);
    return;
  }
  for (const a of list) {
    const b = document.createElement('button');
    b.className = 'pill act';
    b.textContent = a.name;
    b.onclick = () => { audio(); setMode('acts'); setAction(a.id); };
    row.appendChild(b);
  }
}

function markLibs() {
  document.querySelectorAll('.actBtn').forEach(b =>
    b.classList.toggle('on', mode === 'acts' && b.dataset.id === (act && act.id)));
  document.querySelectorAll('.charBtn').forEach(b =>
    b.classList.toggle('on', mode === 'chars' && b.dataset.who === lastChar));
  $('modeActs').classList.toggle('on', mode === 'acts');
  $('modeChars').classList.toggle('on', mode === 'chars');
}

function setMode(m) {
  if (mode === m) return;
  if (m === 'chars') setPortrait(lastChar, lastVariant);
  else setAction(lastActId || ACTIONS[0].id);
}

/* ---------- 画幅切换：横屏 16:9 / 竖屏 9:16 ---------- */
function applyCanvas() {
  stage.setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('bgRect').setAttribute('width', W);
  $('bgRect').setAttribute('height', H);
  $('groundRect').setAttribute('y', GROUND);
  $('groundRect').setAttribute('width', W);
  $('groundRect').setAttribute('height', H - GROUND);
  $('groundLine').setAttribute('x2', W);
  $('groundLine').setAttribute('y1', GROUND);
  $('groundLine').setAttribute('y2', GROUND);
  $('grainRect').setAttribute('width', W);
  $('grainRect').setAttribute('height', H);
  $('guideBase').setAttribute('d', `M0,${GROUND} H${W} M${X(540)},${Ys(100)} V${GROUND}`);
  const v = $('stageVert');
  v.setAttribute('x', X(66));
  v.setAttribute('y', Math.max(96, H * .085));
  v.setAttribute('font-size', 25 * O.ts);
  const n = $('stageNum');
  n.setAttribute('x', W - X(66));
  n.setAttribute('y', H * .24);
  n.setAttribute('font-size', 150 * O.os);
  $('canvasBadge').textContent = `${W} × ${H}`;
  $('orientLand').classList.toggle('on', O.id === 'land');
  $('orientPort').classList.toggle('on', O.id === 'port');
  $('orientLand').setAttribute('aria-selected', O.id === 'land');
  $('orientPort').setAttribute('aria-selected', O.id === 'port');
  document.querySelector('.stageBox').style.aspectRatio = `${W} / ${H}`;
}

function setOrient(id) {
  if (O.id === id) return;
  setOrientation(id);
  P.orient = id;
  applyCanvas();
  applyStyle();
  if (mode === 'chars') setPortrait(lastChar, lastVariant);
  else setAction(lastActId || ACTIONS[0].id);
}

function applyStyle() {
  const T = THEMES[P.theme];
  $('bgStop1').setAttribute('stop-color', T.bg1);
  $('bgStop2').setAttribute('stop-color', T.bg2);
  $('groundRect').setAttribute('fill', T.ground);
  $('groundLine').setAttribute('stroke', T.line);
  $('cutDilate').setAttribute('radius', P.outline);
  $('cutShadow').setAttribute('stdDeviation', (P.shadow * .6).toFixed(1));
  $('cutShadow').setAttribute('dy', (P.shadow * .9).toFixed(1));
  $('stageVert').setAttribute('fill', T.line);
  $('stageNum').setAttribute('fill', P.theme === 'dusk' ? '#f2e9d8' : T.line);
  buildBG($('bgFurn'), P.bg, P.theme);
}

function render() {
  const t01 = Math.min(t / P.dur, 1);
  api.update(t01, P);
  guidesG.setAttribute('opacity', P.guides ? 1 : 0);
  if (P.guides) {
    const pts = api.anchors(P) || [];
    guideCross.innerHTML = pts.map(p =>
      `<path d="M${p[0] - 9},${p[1]} H${p[0] + 9} M${p[0]},${p[1] - 9} V${p[1] + 9}" />`).join('');
    guidePath.setAttribute('d', api.guidePath ? api.guidePath(P) : '');
  }
  const ph = act.phases.find(p => t01 < p[0]);
  $('phaseChip').textContent = ph ? ph[1] : '';
  const frame = Math.round(t * 30);
  $('readout').textContent = `${t.toFixed(2)}s / ${P.dur.toFixed(1)}s · f${frame}`;
  if (!scrubbing) $('scrub').value = Math.round(t01 * 1000);
  $('playBtn').textContent = playing ? '暂停' : '播放';
  $('playBtn').classList.toggle('paused', !playing);
}

/* ---------- 时钟 ---------- */
let prev = performance.now();
function tick(now) {
  const dt = Math.min((now - prev) / 1000, .1);
  prev = now;
  if (playing && !scrubbing) {
    const before = t;
    t += dt * P.speed;
    if (t >= P.dur) {
      if (P.loop) { fireEvents(before, P.dur); t = 0; lastFrame = -1; }
      else { fireEvents(before, P.dur); t = P.dur; playing = false; }
    } else fireEvents(before, t);
  }
  render();
  requestAnimationFrame(tick);
}
function fireEvents(a, b) {
  for (const e of act.events) {
    const at = e.at * P.dur;
    if (at > a && at <= b) sfx(e.sfx);
  }
}

/* ---------- 音效（全部绑定可见事件） ---------- */
let AC = null, master = null;
const lastSfx = {};
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = P.sound ? .5 : 0;
    master.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function noiseBuf(dur) {
  const b = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function env(g, t0, a, peak, dec) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(.001, t0 + a + dec);
}
function sfx(name) {
  if (!P.sound) return;
  const now = performance.now();
  if (lastSfx[name] && now - lastSfx[name] < 90) return;
  lastSfx[name] = now;
  const ctx = audio(), t0 = ctx.currentTime;
  const out = master;
  if (name === 'whoosh') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(.4);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t0); bp.frequency.exponentialRampToValueAtTime(1900, t0 + .3);
    const g = ctx.createGain(); env(g, t0, .06, .4, .3);
    src.connect(bp).connect(g).connect(out); src.start(t0); src.stop(t0 + .4);
  } else if (name === 'paper') {
    for (let i = 0; i < 2; i++) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(.1);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = ctx.createGain(); env(g, t0 + i * .07, .01, .3, .09);
      src.connect(hp).connect(g).connect(out); src.start(t0 + i * .07);
    }
  } else if (name === 'ching') {
    [1568, 2093, 3136].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - .5) * .01);
      const g = ctx.createGain(); env(g, t0, .005, .14 / (i + 1), .35);
      o.connect(g).connect(out); o.start(t0); o.stop(t0 + .4);
    });
  } else if (name === 'thud' || name === 'stamp') {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .2);
    const g = ctx.createGain(); env(g, t0, .005, .7, .22);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + .25);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(.12);
    const lp = ctx.createBiquadFilter(); lp.type = name === 'stamp' ? 'highpass' : 'lowpass';
    lp.frequency.value = name === 'stamp' ? 2000 : 320;
    const g2 = ctx.createGain(); env(g2, t0, .003, name === 'stamp' ? .4 : .3, .1);
    src.connect(lp).connect(g2).connect(out); src.start(t0);
  } else if (name === 'crack') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(.25);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8;
    bp.frequency.setValueAtTime(1100, t0); bp.frequency.exponentialRampToValueAtTime(180, t0 + .22);
    const g = ctx.createGain(); env(g, t0, .005, .55, .22);
    src.connect(bp).connect(g).connect(out); src.start(t0);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(240, t0); o.frequency.exponentialRampToValueAtTime(50, t0 + .18);
    const g2 = ctx.createGain(); env(g2, t0, .005, .2, .18);
    o.connect(g2).connect(out); o.start(t0); o.stop(t0 + .2);
  } else if (name === 'pop') {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(520, t0); o.frequency.exponentialRampToValueAtTime(940, t0 + .07);
    const g = ctx.createGain(); env(g, t0, .005, .3, .09);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + .12);
  } else if (name === 'scratch') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(.6);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(.16, t0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 13;
    const lg = ctx.createGain(); lg.gain.value = .1;
    lfo.connect(lg).connect(g.gain);
    g.gain.setValueAtTime(.16, t0 + .5); g.gain.linearRampToValueAtTime(0, t0 + .6);
    src.connect(bp).connect(g).connect(out); src.start(t0); lfo.start(t0); lfo.stop(t0 + .6);
  }
}

/* ---------- UI ---------- */
function buildLibs() {
  const libs = $('libs');
  libs.innerHTML = '';
  if (mode === 'acts') {
    let i = 0;
    for (const key of Object.keys(CATS)) {
      const c = CATS[key];
      const h = document.createElement('div');
      h.className = 'libHead';
      h.innerHTML = `<span class="dot" style="background:${c.color}"></span>${c.name}`;
      libs.appendChild(h);
      for (const a of ACTIONS.filter(x => x.cat === key)) {
        i++;
        const b = document.createElement('button');
        b.className = 'actBtn'; b.dataset.id = a.id;
        b.innerHTML = `<span class="num" style="color:${c.color}">${String(i).padStart(2, '0')}</span>
          <span class="meta"><strong>${a.name}</strong><small>${a.desc}</small></span>`;
        b.onclick = () => { audio(); setAction(a.id); };
        libs.appendChild(b);
      }
    }
  } else {
    let i = 0;
    for (const [key, label] of CHAR_GROUPS) {
      const color = GROUP_COLORS[key];
      const h = document.createElement('div');
      h.className = 'libHead';
      h.innerHTML = `<span class="dot" style="background:${color}"></span>${label}`;
      libs.appendChild(h);
      for (const who of Object.keys(CHARS).filter(k => CHARS[k].group === key)) {
        i++;
        const C = CHARS[who];
        const b = document.createElement('button');
        b.className = 'actBtn charBtn'; b.dataset.who = who;
        const vn = (C.variants || []).length;
        b.innerHTML = `<span class="num" style="color:${color}">${String(i).padStart(2, '0')}</span>
          <span class="meta"><strong>${C.label}${vn ? `<em class="vcount">+${vn}</em>` : ''}</strong><small>${C.desc}</small></span>`;
        b.onclick = () => { audio(); setPortrait(who, null); };
        libs.appendChild(b);
      }
    }
  }
  markLibs();
}

function syncUI() {
  $('speed').value = P.speed;
  $('dur').value = P.dur; $('durVal').textContent = P.dur.toFixed(1) + 's';
  $('ease').value = P.ease;
  $('amp').value = P.amp; $('ampVal').textContent = P.amp.toFixed(2) + '×';
  $('scale').value = P.scale; $('scaleVal').textContent = P.scale.toFixed(2) + '×';
  $('outline').value = P.outline; $('outlineVal').textContent = P.outline + 'px';
  $('shadow').value = P.shadow; $('shadowVal').textContent = P.shadow + 'px';
  $('theme').value = P.theme;
  $('bg').value = P.bg;
  $('guides').checked = P.guides;
  $('loopBtn').classList.toggle('on', P.loop);
  $('loopBtn').setAttribute('aria-pressed', P.loop);
  $('soundBtn').textContent = P.sound ? '声音：开' : '声音：关';
  $('soundBtn').classList.toggle('on', P.sound);
}

function bind() {
  $('modeActs').onclick = () => { audio(); setMode('acts'); };
  $('modeChars').onclick = () => { audio(); setMode('chars'); };
  $('orientLand').onclick = () => { audio(); setOrient('land'); };
  $('orientPort').onclick = () => { audio(); setOrient('port'); };
  $('playBtn').onclick = () => { audio(); if (!playing && t >= P.dur) t = 0; playing = !playing; };
  $('restartBtn').onclick = () => { audio(); t = 0; playing = true; lastFrame = -1; };
  $('loopBtn').onclick = () => { P.loop = !P.loop; syncUI(); };
  $('soundBtn').onclick = () => {
    P.sound = !P.sound;
    if (P.sound) audio();
    if (master) master.gain.value = P.sound ? .5 : 0;
    syncUI();
  };
  const sc = $('scrub');
  sc.addEventListener('pointerdown', () => { scrubbing = true; });
  sc.addEventListener('input', () => { t = sc.value / 1000 * P.dur; render(); });
  window.addEventListener('pointerup', () => { scrubbing = false; });
  $('speed').onchange = e => { P.speed = +e.target.value; };
  $('dur').oninput = e => { P.dur = +e.target.value; t = Math.min(t, P.dur); $('durVal').textContent = P.dur.toFixed(1) + 's'; };
  $('ease').onchange = e => { P.ease = e.target.value; };
  $('amp').oninput = e => { P.amp = +e.target.value; $('ampVal').textContent = P.amp.toFixed(2) + '×'; };
  $('scale').oninput = e => { P.scale = +e.target.value; $('scaleVal').textContent = P.scale.toFixed(2) + '×'; };
  $('outline').oninput = e => { P.outline = +e.target.value; $('outlineVal').textContent = P.outline + 'px'; applyStyle(); };
  $('shadow').oninput = e => { P.shadow = +e.target.value; $('shadowVal').textContent = P.shadow + 'px'; applyStyle(); };
  $('theme').onchange = e => { P.theme = e.target.value; applyStyle(); };
  $('bg').onchange = e => { P.bg = e.target.value; applyStyle(); };
  $('guides').onchange = e => { P.guides = e.target.checked; };
  $('resetBtn').onclick = () => { Object.assign(P, DEFAULTS, { dur: act.dur }); setOrient(P.orient); applyStyle(); syncUI(); };
  $('randBtn').onclick = () => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    P.ease = pick(['smooth', 'spring', 'back', 'linear']);
    P.amp = +(0.6 + Math.random() * .8).toFixed(2);
    P.dur = Math.min(8, Math.max(2, Math.round(act.dur * (0.8 + Math.random() * .5) * 2) / 2));
    P.speed = pick([.75, 1, 1.25, 1.5]);
    P.theme = pick(Object.keys(THEMES));
    P.bg = pick(['paper', 'home', 'court', 'register']);
    t = 0; playing = true;
    setOrient(pick(['land', 'port']));
    applyStyle(); syncUI();
  };
  $('exportSvgBtn').onclick = exportSVG;
  $('exportJsonBtn').onclick = exportJSON;
  window.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); $('playBtn').click(); }
    if (e.code === 'ArrowRight') { t = Math.min(t + 1 / 30, P.dur); render(); }
    if (e.code === 'ArrowLeft') { t = Math.max(t - 1 / 30, 0); render(); }
    if (e.code === 'KeyO') setOrient(O.id === 'land' ? 'port' : 'land');
  });
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportSVG() {
  const clone = stage.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  clone.setAttribute('viewBox', `0 0 ${W} ${H}`);
  clone.querySelectorAll('[style]').forEach(n => {
    if (n.style.filter) n.setAttribute('style', `filter:${n.style.filter}`);
  });
  const src = new XMLSerializer().serializeToString(clone);
  download(`svg-kit-${act.id}-${O.id}-f${Math.round(t * 30)}.svg`, new Blob([src], { type: 'image/svg+xml' }));
}
function exportJSON() {
  const data = {
    action: act.id, category: act.cat || null, time: +t.toFixed(3), frame: Math.round(t * 30),
    orientation: { id: O.id, label: O.label, W, H, GROUND, os: O.os, vs: O.vs, cs: O.cs, ts: O.ts },
    params: { ...P }, events: act.events, phases: act.phases, cast: act.cast || null,
  };
  download(`svg-kit-${act.id}-${O.id}-params.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

/* ---------- 启动 ---------- */
setOrientation(P.orient);
buildLibs();
bind();
applyCanvas();
applyStyle();
setAction(ACTIONS[0].id);
requestAnimationFrame(tick);

window.__kit = {
  params: P,
  seek: f => { t = clamp01(f) * P.dur; playing = false; render(); },
  play: () => { playing = true; },
  pause: () => { playing = false; },
  setAction,
  setPortrait,
  setMode,
  setOrientation: setOrient,
  get time() { return t; },
  get action() { return act.id; },
  get mode() { return mode; },
  get orientation() { return O.id; },
  get canvas() { return { W, H, GROUND }; },
};