/** Headless CDP boot probe — captures console + body text. */
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scratch = process.env.PARITY_SCRATCH || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const url = process.argv[2] || 'http://127.0.0.1:8931/index.html?autostart=1&dp=0.5&debug=1&sim=1';
const profile = path.join(scratch, 'chrome-profile-probe');
fs.mkdirSync(profile, { recursive: true });

const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    '--window-size=1280,720', 'about:blank'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 1500));

async function get(path) {
    const r = await fetch(`http://127.0.0.1:${port}${path}`);
    return r.json();
}

const pages = await get('/json/list');
const page = pages.find(p => p.type === 'page') || pages[0];
const wsUrl = page.webSocketDebuggerUrl;
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();
const logs = [];

function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => {
        pending.set(id, resolve);
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 8000);
    });
}

await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    setTimeout(() => reject(new Error('ws open timeout')), 5000);
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
        logs.push(`exception: ${d.exception?.description || d.text || JSON.stringify(d)}`);
    }
});

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Page.navigate', { url });
await new Promise(r => setTimeout(r, 7000));

const evalRes = await send('Runtime.evaluate', {
    expression: `({
      text: document.body.innerText.slice(0, 800),
      hasCanvas: !!document.querySelector('canvas'),
      appKids: document.getElementById('app') ? document.getElementById('app').children.length : -1,
      gStarted: !!(window.G && window.G.started),
      err: window.__bootErr || null
    })`,
    returnByValue: true
});
const value = evalRes?.result?.result?.value;
logs.push('eval: ' + JSON.stringify(value));

const out = path.join(scratch, 'boot_probe.log');
fs.writeFileSync(out, logs.join('\n') + '\n');
console.log(logs.join('\n'));
console.log('wrote', out);

try { child.kill(); } catch (_) {}
process.exit(value?.hasCanvas || value?.gStarted ? 0 : 1);
