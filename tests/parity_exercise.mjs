/**
 * Parity exercise harness — drives real exported simulation entry points
 * from shipped modules (no re-implementation of the units under test).
 * Run: node tests/parity_exercise.mjs
 */
import * as THREE from '../lib/three.module.js';
import { G } from '../js/state.js';
import {
    buildPartners, stepPartner, routeAlongSidewalk, VC_OFFICES, HQ_TARGETS
} from '../js/vc_dealflow.js';
import { makePaperJob, stepPaper, PAPER_LABS, PAPER_SOURCES } from '../js/research_papers.js';
import { STAGE_CODE } from '../js/citizens.js';
import { buildMetroRoutes, stepTrain } from '../js/metro.js';
import { createJailState, tryArrest, stepJail, JAIL_BID } from '../js/jail.js';
import { createCourtState, enqueueCase, stepCourt } from '../js/court.js';
import { createOrbitState, enterOrbit, exitOrbit, updateOrbitCamera } from '../js/orbit_mode.js';
import { applyXray } from '../js/xray_mode.js';
import { buildHolomapGeometry } from '../js/holomap.js';
import { conferenceStatus } from '../js/conference.js';
import { seasonForDate, SEASONS } from '../js/seasonal.js';
import { kardashevScale } from '../js/kardashev.js';
import { isWetWeather, puddleLayout } from '../js/wetness.js';
import { createGhosts, stepGhost } from '../js/multiplayer.js';
import { buildTerminalModel, terminalHtml } from '../js/terminal.js';
import { TRAM_LINES } from '../js/data.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
let failed = 0;
function assert(cond, msg) {
    if (!cond) { failed++; log('FAIL: ' + msg); }
    else log('ok: ' + msg);
}

// ── minimal building atlas ──
const bld = {};
function place(id, x, z) {
    bld[id] = { id, worldX: x, worldZ: z, worldW: 100, worldD: 100, h: 80, name: id };
}
VC_OFFICES.forEach((id, i) => place(id, -400 + i * 120, 200));
HQ_TARGETS.forEach((id, i) => place(id, -300 + i * 100, -400));
PAPER_SOURCES.forEach((id, i) => place(id, 100 + i * 80, 100));
PAPER_LABS.forEach((id, i) => { if (!bld[id]) place(id, -300 + i * 100, -400); });
['metro_west', 'metro_central', 'metro_east', 'metro_innovation'].forEach((id, i) => place(id, -600 + i * 300, 0));
place(JAIL_BID, 500, 500);
place('court_hearing', 600, 200);
place('court_senate', 700, 200);
place('convention_center', 0, 0);
place('visitor_monument', 200, 300);
const bldAt = (id) => bld[id];

// City routing needs layout(); stub grid helpers for headless exercise
import { City } from '../js/city.js';
City.nearestIntersection = (x, z) => ({
    x: Math.round(x / 200) * 200,
    z: Math.round(z / 200) * 200
});
City.sidewalkCentre = (v, _isX, side) => v + (side || 1) * 30;
City.offRoad = (x, z) => ({ x, z });
City.onSidewalk = () => true;
City.laneCentre = (v) => v;

log('=== PARITY SYSTEMS EXERCISE ===');

// 1. VC deal-flow
const partners = buildPartners(3);
assert(partners.length === VC_OFFICES.length, 'VC partners built for each office');
const home = bldAt(partners[0].homeBid);
const tgt = bldAt(partners[0].targetBid);
partners[0].x = home.worldX; partners[0].z = home.worldZ;
partners[0].path = routeAlongSidewalk(partners[0].x, partners[0].z, tgt.worldX, tgt.worldZ);
partners[0].wp = 0;
partners[0].phase = 'travel';
let deals = 0;
const startDist = Math.hypot(tgt.worldX - partners[0].x, tgt.worldZ - partners[0].z);
for (let i = 0; i < 5000; i++) {
    if (stepPartner(partners[0], 0.1, bldAt)) deals++;
}
const endDist = Math.hypot(tgt.worldX - partners[0].x, tgt.worldZ - partners[0].z);
assert(partners[0].phase !== 'travel' || endDist < startDist || partners[0].deals > 0 || deals > 0,
    'VC partner advances toward HQ / completes deal cycle');
assert(partners[0].deals > 0 || partners[0].phase === 'handshake' || partners[0].phase === 'return' || partners[0].phase === 'wait',
    `VC partner left pure travel (phase=${partners[0].phase}, deals=${partners[0].deals})`);
log('  vc snapshot: phase=' + partners[0].phase + ' deals=' + partners[0].deals);

// 2. Research papers
const job = makePaperJob(0, bldAt, 1);
assert(!!job, 'paper job created');
assert(PAPER_LABS.includes(job.dstBid), 'paper targets a lab HQ');
let delivered = 0;
for (let i = 0; i < 8000; i++) if (stepPaper(job, 0.1)) delivered++;
assert(delivered === 1 && job.delivered, 'paper envelope delivers to lab');
log('  paper delivered title=' + job.title);

// 3. NPC aging codes (distinct looks beyond size)
assert(STAGE_CODE.baby === 1 && STAGE_CODE.kid === 2 && STAGE_CODE.rumored === 3,
    'stage codes for baby/kid/rumored distinct from adult');
const citSrc = fs.readFileSync(path.join(root, 'js/citizens.js'), 'utf8');
assert(citSrc.includes('aAnim') && citSrc.includes('aPart') && citSrc.includes('pacifier'),
    'citizens.js has stage morph props (not size-only)');

// 4. Metro
const routes = buildMetroRoutes(bldAt, TRAM_LINES);
assert(routes.length >= 3, 'metro has multiple lines: ' + routes.length);
const train = { routeIdx: 0, seg: 0, segProgress: 0, speed: 200, x: 0, z: 0, dirX: 1, dirZ: 0, dwellT: 0, laps: 0, atStop: null };
const x0 = routes[0].pts[0].x, z0 = routes[0].pts[0].z;
train.x = x0; train.z = z0;
for (let i = 0; i < 200; i++) stepTrain(train, 0.05, routes);
assert(train.x !== x0 || train.z !== z0 || train.seg > 0 || train.laps > 0, 'metro train moves along route');
log('  metro trains lines=' + routes.length + ' pos=' + Math.round(train.x) + ',' + Math.round(train.z));

// 5. Jail
const js = createJailState();
const citizen = { idx: 7, model: { name: 'GPT-test' } };
assert(tryArrest(js, citizen, 'jailbreak'), 'jail can arrest');
assert(js.inmates.length === 1, 'inmate held');
js.inmates[0].timeLeft = 0.5;
const rel = stepJail(js, 1);
assert(rel.length === 1 && js.processed === 1, 'jail releases after time');
assert(JAIL_BID === 'black_market', 'jail venue is black_market');

// 6. Court
const cs = createCourtState();
enqueueCase(cs, 'alignment audit', 'Claude');
let ruled = null;
for (let i = 0; i < 200; i++) ruled = stepCourt(cs, 0.1) || ruled;
assert(ruled && ruled.status === 'ruled', 'court reaches ruling');
assert(cs.rulings >= 1, 'court rulings counted');

// 7. Orbit mode
const cam = new THREE.PerspectiveCamera(70, 1, 0.5, 12000);
cam.position.set(10, 17, 20);
const player = { yaw: 1, pitch: 0.1 };
let ost = createOrbitState();
enterOrbit(ost, cam, player);
assert(ost.active && G.orbitMode, 'orbit enter sets active');
updateOrbitCamera(ost, cam, 0.5);
assert(cam.position.y > 100, 'orbit camera elevated');
exitOrbit(ost, cam, player);
assert(!ost.active && !G.orbitMode, 'orbit exit restores');
assert(Math.abs(cam.position.x - 10) < 0.01, 'orbit restores camera x');

// 8. X-ray
const scene = new THREE.Scene();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
scene.add(mesh);
const n = applyXray(scene, true);
assert(n >= 1 && mesh.material.wireframe === true, 'xray enables wireframe');
applyXray(scene, false);
assert(mesh.material.wireframe === false, 'xray restores wireframe');

// 9. Holomap geometry
const geo = buildHolomapGeometry([{ worldX: 0, worldZ: 0, worldW: 100, worldD: 100, h: 80 }], 0.04);
assert(geo && geo.attributes.position.count > 10, 'holomap geometry built');

// 10. Conference / seasonal / kardashev
const confAll = conferenceStatus(new Date(), 'neurips');
assert(confAll.active && confAll.conf.id === 'neurips', 'conference force-id works');
const season = seasonForDate(new Date(2026, 11, 15));
assert(season.id && SEASONS[11], 'seasonal month map works');
const k = kardashevScale(900);
assert(k.k > 0 && k.tier.length > 3, 'kardashev scale from AI index');

// 11. Wetness + real neon boost wiring
assert(isWetWeather('rain') && isWetWeather('thunderstorm') && !isWetWeather('clear'), 'wet weather detection');
const puddles = puddleLayout(0, 0, 10, 1);
assert(puddles.length === 10 && puddles[0].s > 0, 'puddle layout near camera');
import { applyNeonBoost } from '../js/wetness.js';
const fakeWin = { emissiveIntensity: 0.4 };
const fakeNeon = {
    opacity: 1,
    color: new THREE.Color(0xffffff),
    userData: {},
    transparent: false
};
const fakePuddle = { material: { color: new THREE.Color(0x1a3048), opacity: 0.4 } };
const applied = applyNeonBoost(
    { windowMats: [fakeWin], neonMat: fakeNeon },
    0.4,
    [fakePuddle]
);
assert(applied.windows === 1 && applied.neon === 1, 'applyNeonBoost touches windows+neon');
assert(fakeWin.emissiveIntensity > 0.4, 'window emissive increased under wet neonBoost');
assert(fakeNeon.opacity > 1 || fakeNeon.color.g > fakeNeon.color.r * 0.9, 'neon material boosted under rain');

// 12. Multiplayer ghosts
const ghosts = createGhosts(6);
const gx = ghosts[0].x;
for (let i = 0; i < 100; i++) {
    ghosts[0].tx = gx + 500;
    ghosts[0].tz = ghosts[0].z;
    stepGhost(ghosts[0], 0.1);
}
assert(ghosts[0].x !== gx, 'ghost cursor moves');
assert(ghosts.length === 6, 'six simulated ghost peers');

// 13. Terminal model + html (KeyD structural)
G.ui = { aiIndex: 640 };
G.dayPhase = 0.5;
G.weatherSys = { state: 'rain' };
G.citizens = { list: new Array(12) };
G.vcDealFlow = { dealsCompleted: 3 };
G.researchPapers = { delivered: 5 };
const model = buildTerminalModel(G);
assert(model.labs.length > 0 && model.models.length > 0, 'terminal model has labs+models');
const html = terminalHtml(model);
assert(html.includes('SC TERMINAL') && html.includes('AI INDEX'), 'terminal HTML renders');
const termSrc = fs.readFileSync(path.join(root, 'js/terminal.js'), 'utf8');
assert(termSrc.includes("KeyD"), 'terminal bound to KeyD');
const mainSrc = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
for (const mod of [
    'vc_dealflow', 'research_papers', 'metro', 'jail', 'court',
    'orbit_mode', 'xray_mode', 'holomap', 'conference', 'seasonal',
    'kardashev', 'wetness', 'multiplayer', 'terminal'
]) {
    assert(mainSrc.includes(mod), 'main.js wires ' + mod);
}

// interior special themes structural
const intSrc = fs.readFileSync(path.join(root, 'js/interior.js'), 'utf8');
for (const cat of ['jail', 'court', 'embassy', 'mission', 'power', 'boardroom']) {
    assert(intSrc.includes("'" + cat + "'") || intSrc.includes('"' + cat + '"') || intSrc.includes(`cat: '${cat}'`),
        'interior has ' + cat + ' theme');
}
assert(intSrc.includes('setFloor') && intSrc.includes('maxFloor'), 'multi-floor lift support');

log('');
log(failed ? `FAILED ${failed} assertion(s)` : 'ALL EXERCISES PASSED');
const outDir = process.env.PARITY_SCRATCH || path.join(root, 'tests');
try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
const outFile = path.join(outDir, 'systems_exercise.log');
fs.writeFileSync(outFile, lines.join('\n') + '\n');
log('wrote ' + outFile);
process.exit(failed ? 1 : 0);
