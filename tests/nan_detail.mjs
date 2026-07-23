import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
const scratch = process.env.PARITY_SCRATCH;
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9346;
const profile = path.join(scratch, 'chrome-nan3');
fs.mkdirSync(profile, { recursive: true });
const child = spawn(chrome, ['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--no-first-run','--user-data-dir='+profile,'--remote-debugging-port='+port,'about:blank'], {stdio:'ignore'});
await new Promise(r=>setTimeout(r,1500));
const pages = await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const page = pages.find(p=>p.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=1; const pending=new Map();
function send(m,p={}){const i=id++; ws.send(JSON.stringify({id:i,method:m,params:p})); return new Promise(res=>{pending.set(i,res); setTimeout(()=>{if(pending.has(i)){pending.delete(i);res(null)}},10000)})}
await new Promise((res,rej)=>{ws.addEventListener('open',res); ws.addEventListener('error',rej)});
ws.addEventListener('message',ev=>{const msg=JSON.parse(ev.data); if(msg.id&&pending.has(msg.id)){pending.get(msg.id)(msg); pending.delete(msg.id)}});
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url:'http://127.0.0.1:8931/index.html?autostart=1&dp=0.5'});
await new Promise(r=>setTimeout(r,7000));
const expr = `(() => {
  const mon = (G.placements||[]).filter(p => p.type==='monument' || p.id==='visitor_monument').map(p=>({id:p.id,type:p.type,worldX:p.worldX,worldZ:p.worldZ,x:p.x,z:p.z,keys:Object.keys(p).slice(0,20)}));
  const seasonalIs = G.seasonal?.mesh;
  let seasonalNan=false, verts=0;
  if(seasonalIs){
    const a=seasonalIs.geometry.attributes.position.array;
    verts=a.length/3;
    for(let i=0;i<a.length;i++) if(Number.isNaN(a[i])){seasonalNan=true; break;}
  }
  return {mon, seasonalNan, verts, seasonalExists:!!seasonalIs, placementsN:(G.placements||[]).length};
})()`;
const res = await send('Runtime.evaluate',{expression:expr,returnByValue:true});
console.log(JSON.stringify(res?.result?.result?.value,null,2));
fs.writeFileSync(path.join(scratch,'nan_detail.log'), JSON.stringify(res?.result?.result?.value,null,2));
try{child.kill()}catch{}
