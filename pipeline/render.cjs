/* render.cjs — 整片逐帧渲染（pipeline 模板，v0.9）
 * 只用本机 Edge/Chrome + CDP + Node 内置模块，素材不出本机。
 * 需要 Node ≥ 22（内置 WebSocket）。
 *
 * 用法（在案件项目目录，与 film.html 同级）：
 *   node render.cjs                 全量渲染（已有帧自动跳过，可断点续渲）
 *   SHOT_LIMIT=3 node render.cjs    只渲前 3 个镜头（冒烟检查）
 *   PORT=8736 node render.cjs       换静态服务端口
 *
 * 产出：
 *   frames/%05d.jpg    全局帧序列（含交叉淡化帧），compose.sh 直接读取
 *   events.json        音效事件绝对秒点 [{time, sfx, shot}]，mix_sound.py 读取
 *                      （只含动作内置接触/冲击音效；转场/翻页静音，无自动 whoosh）
 *   film.info.json     时间轴/镜头元数据（验收与对轨用；有 chapters.json 时附带 chapters）
 *
 * 章节进度条（v0.9）：案件目录放 chapters.json（AI 读口播稿生成，见 references/chapters.md），
 *   渲染时自动注入合成页顶部灰框章节条；没有该文件 = 不画条（兼容 v0.8）。
 *
 * 与旧版 flash 工程的区别（修掉的坑）：
 *   · t01 = local/(frames-1)：最后一帧恰好完成动作，hold<1 的结尾冻结被禁止。
 *   · 转场在 film.html 内双缓冲完成，不再需要 build_seq.js 硬链接拼接。
 *   · 渲染前先跑资产验收（7 相位 + NaN 检查 + 镜头 transform 检查），不过不渲。 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (typeof WebSocket === 'undefined') throw new Error('需要 Node ≥ 22（内置 WebSocket）');

const ROOT = __dirname;
const FILM = require(path.join(ROOT, 'film.config.js'));
const CANVAS = { land: [1920, 1080], port: [1080, 1920] };
if (!CANVAS[FILM.orient]) throw new Error("film.config.js 的 orient 必须是 'land' 或 'port'");
const [CW, CH] = CANVAS[FILM.orient];
const FPS = FILM.fps || 30;
const FRAMES = path.join(ROOT, 'frames');
const HTTP_PORT = Number(process.env.PORT || 8735);
const RESTART_EVERY = 900; // 每渲 900 帧重启一次浏览器，防内存膨胀
const LIMIT = Number(process.env.SHOT_LIMIT || FILM.shots.length);

// 章节进度条（v0.9）：可选 chapters.json，AI 读口播稿生成（references/chapters.md）
const CHAPTERS_FILE = path.join(ROOT, 'chapters.json');
let CHAPTERS = null;
if (fs.existsSync(CHAPTERS_FILE)) {
  CHAPTERS = JSON.parse(fs.readFileSync(CHAPTERS_FILE, 'utf8'));
  if (!Array.isArray(CHAPTERS.chapters) || !CHAPTERS.chapters.length)
    throw new Error('chapters.json 的 chapters 必须是非空数组');
  for (const c of CHAPTERS.chapters)
    if (!c.label || !(c.end > c.start)) throw new Error('chapters.json 每项需要 label 与 end>start: ' + JSON.stringify(c));
}

const BROWSER = process.env.BROWSER_PATH || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.css': 'text/css;charset=utf-8', '.wav': 'audio/wav',
  '.ass': 'text/plain;charset=utf-8',
};

function startStatic() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, u === '/' ? '/film.html' : u);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(HTTP_PORT, '127.0.0.1', () => resolve(srv));
  });
}

async function withBrowser(fn) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-film-'));
  const browser = spawn(BROWSER, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--no-sandbox', '--hide-scrollbars', `--window-size=${CW},${CH}`,
    '--force-device-scale-factor=1', '--remote-debugging-port=0',
    '--user-data-dir=' + userDataDir, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let port = 0;
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  for (let i = 0; i < 120; i++) {
    if (fs.existsSync(portFile)) {
      const t = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (t) { port = Number(t); break; }
    }
    await sleep(100);
  }
  if (!port) { try { browser.kill(); } catch (e) {} throw new Error('DevTools 端口未就绪'); }

  let ws;
  try {
    let target = null;
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find(t => t.type === 'page');
        if (target) break;
      } catch (e) {}
      await sleep(150);
    }
    if (!target) throw new Error('找不到 page target');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    let seq = 0; const pending = new Map(); const errs = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text);
    });
    const send = (method, params = {}, ms = 25000) => new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP 超时: ' + method)); }, ms);
      pending.set(id, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expr, ms, awaitPromise) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise }, ms);
      if (r.exceptionDetails) throw new Error('页面脚本异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };
    const capture = async file => {
      const cap = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: false, optimizeForSpeed: true }, 25000);
      fs.writeFileSync(file, Buffer.from(cap.data, 'base64'));
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: CW, height: CH, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/film.html` });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      ready = await evaluate('!!(window.__ready && window.__film)');
      if (ready) break;
      await sleep(120);
    }
    if (!ready) throw new Error('合成页未就绪（film.html 脚本报错？看控制台）');
    if (CHAPTERS) await evaluate('__film.setChapters(' + JSON.stringify(CHAPTERS) + ')');

    return await fn({ send, evaluate, capture, errs });
  } finally {
    if (ws) { try { ws.close(); } catch (e) {} }
    try { browser.kill(); } catch (e) {}
    await sleep(400);
  }
}

async function main() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome，可用 BROWSER_PATH 环境变量指定');
  fs.mkdirSync(FRAMES, { recursive: true });
  const server = await startStatic();

  try {
    /* 1) 资产验收：每个镜头 7 相位，sceneRoot 非空、无 NaN/undefined、镜头 transform 生效 */
    const verify = await withBrowser(async ({ evaluate }) => {
      return await evaluate(`(async () => {
        const errs = [], nan = [], camBad = [];
        const info = __film.info;
        for (const s of info.shots) {
          try {
            for (const f of [0, .12, .3, .5, .7, .9, 1]) {
              __film.seekShot(s.index, f);
              const html = __film.sceneHTML();
              if (!html.length) throw new Error('sceneRoot 为空');
              if (/NaN|undefined/.test(html)) nan.push(s.id + '@' + f);
            }
            if (s.camera !== 'off') {
              __film.seekShot(s.index, .5);
              const tr = __film.camTransform() || '';
              if (!/scale\\(/.test(tr)) camBad.push(s.id);
            }
          } catch (e) { errs.push(s.id + ': ' + e.message); }
        }
        return { orient: info.orient, canvas: [info.W, info.H], totalFrames: info.totalFrames,
                 shots: info.shots.length, errs, nan, camBad };
      })()`, 120000, true);
    });
    console.log('ASSET_CHECK ' + JSON.stringify(verify));
    if (verify.errs.length || verify.nan.length || verify.camBad.length)
      throw new Error('资产验收未通过，先修镜头再渲染');

    const info = await withBrowser(async ({ evaluate }) => await evaluate('__film.info'));
    if (CHAPTERS) info.chapters = CHAPTERS.chapters;
    if (FILM.voiceDuration > 0) {
      const filmDur = info.totalFrames / FPS;
      if (filmDur < FILM.voiceDuration - 0.1)
        console.log(`WARN 画面总时长 ${filmDur.toFixed(2)}s < 口播 ${FILM.voiceDuration}s，结尾会缺画面，请补镜头时长`);
    }

    /* 2) 逐帧渲染（全局帧号，断点续渲） */
    const limitFrames = LIMIT >= info.shots.length ? info.totalFrames
      : info.shots[LIMIT].startFrame;
    const frameFile = g => path.join(FRAMES, String(g).padStart(5, '0') + '.jpg');
    const todo = [];
    for (let g = 0; g < limitFrames; g++) {
      const f = frameFile(g);
      if (!fs.existsSync(f) || fs.statSync(f).size < 2000) todo.push(g);
    }
    console.log(`RENDER total=${limitFrames} todo=${todo.length} (${CW}x${CH}@${FPS})` +
      (CHAPTERS ? ` chapters=${CHAPTERS.chapters.length}` : ' chapters=off'));

    const t0 = Date.now();
    let attempt = 0, done = 0;
    while (todo.length && attempt < 4) {
      attempt++;
      const batch = todo.slice();
      try {
        for (let c = 0; c < batch.length; c += RESTART_EVERY) {
          const chunk = batch.slice(c, c + RESTART_EVERY);
          await withBrowser(async ({ evaluate, capture }) => {
            for (const g of chunk) {
              await evaluate(`__film.renderFrame(${g})`);
              await capture(frameFile(g));
              todo.shift(); done++;
              if (done % 150 === 0) console.log(`  ${done}f  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            }
          });
        }
      } catch (e) {
        console.log(`  RETRY attempt ${attempt}: ${e.message.slice(0, 160)} (剩 ${todo.length}f)`);
      }
    }
    if (todo.length) throw new Error(`仍有 ${todo.length} 帧未渲染`);

    /* 3) 元数据与音效事件（绝对秒点 = (起始帧 + at*(帧数-1)) / fps）
       只取动作内置 events（接触/冲击点）；转场/翻页不配音（whoosh 已移除）。
       sfx:[] 的静音镜头由 film.html 把 events 置空，这里自然不产出。 */
    if (LIMIT >= info.shots.length) {
      const events = [];
      for (const s of info.shots) {
        for (const e of s.events || [])
          events.push({ time: +((s.startFrame + e.at * (s.frames - 1)) / FPS).toFixed(3), sfx: e.sfx, shot: s.id });
      }
      events.sort((a, b) => a.time - b.time);
      fs.writeFileSync(path.join(ROOT, 'events.json'), JSON.stringify(events, null, 2));
      fs.writeFileSync(path.join(ROOT, 'film.info.json'), JSON.stringify(info, null, 2));
      const files = fs.readdirSync(FRAMES).filter(f => f.endsWith('.jpg')).length;
      console.log('FRAME_SEQUENCE ' + JSON.stringify({ total: info.totalFrames, files, events: events.length }));
      if (files < info.totalFrames) throw new Error('帧数不足，检查 frames/ 目录');
    }
    console.log('ELAPSED ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  } finally {
    server.close();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });