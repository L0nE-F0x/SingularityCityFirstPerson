/** CDP probe: after boot, walk scene and report geometries with NaN positions. */
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scratch = process.env.PARITY_SCRATCH || path.dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9344;
const url = 'http://127.0.0.1:8931/index.html?autostart=1&dp=0.5&sim=1';
const profile = path.join(scratch, 'chrome-nan-profile');
fs.mkdirSync(profile, { recursive: true });

const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 1500));
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(p => p.type === 'page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const logs = [];

function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => {
        pending.set(id, resolve);
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 10000);
    });
}

await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    setTimeout(() => reject(new Error('ws timeout')), 5000);
});
ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
        const t = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
        logs.push(`console.${msg.params.type}: ${t}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        logs.push(`exception: ${d.exception?.description || d.text}`);
    }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await new Promise(r => setTimeout(r, 8000));

const expr = `(() => {
  const hits = [];
  let total = 0, nanN = 0;
  if (!window.G || !G.scene) return { err: 'no scene' };
  G.scene.traverse(o => {
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    total++;
    const arr = o.geometry.attributes.position.array;
    let nan = 0, inf = 0;
    for (let i = 0; i < arr.length; i++) {
      if (Number.isNaN(arr[i])) nan++;
      if (!Number.isFinite(arr[i])) inf++;
    }
    if (nan || inf) {
      nanN++;
      hits.push({
        type: o.type,
        name: o.name || '',
        uuid: o.uuid.slice(0,8),
        parent: o.parent?.type,
        count: arr.length/3,
        nan, inf,
        mat: o.material?.type,
        isLine: o.isLine || o.isLineSegments,
        isPoints: o.isPoints,
        isInstanced: o.isInstancedMesh,
        userData: Object.keys(o.userData||{})
      });
    }
    // also check bounding sphere
    try {
      o.geometry.computeBoundingSphere();
      const r = o.geometry.boundingSphere?.radius;
      if (r != null && !Number.isFinite(r)) {
        hits.push({ type: o.type, name: o.name, badSphere: r, count: arr.length/3, isLine: !!o.isLineSegments, isPoints: !!o.isPoints });
      }
    } catch (e) {
      hits.push({ type: o.type, sphereErr: String(e) });
    }
  });
  return { total, nanN, hits: hits.slice(0, 30), systems: {
    wet: !!G.wetness, metro: !!G.metro, vc: !!G.vcDealFlow, papers: !!G.researchPapers
  }};
})()`;

const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
const value = res?.result?.result?.value;
logs.push('SCAN ' + JSON.stringify(value, null, 2));
const out = path.join(scratch, 'nan_geo_scan.log');
fs.writeFileSync(out, logs.join('\n') + '\n');
console.log(logs.join('\n'));
try { child.kill(); } catch (_) {}
process.exit(value?.nanN ? 1 : 0);
