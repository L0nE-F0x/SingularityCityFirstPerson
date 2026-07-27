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
import { BLDS } from '../js/data.js';
import { createCourtState, enqueueCase, stepCourt } from '../js/court.js';
import { createOrbitState, enterOrbit, exitOrbit, updateOrbitCamera } from '../js/orbit_mode.js';
import { applyXray } from '../js/xray_mode.js';
import { buildHolomapGeometry } from '../js/holomap.js';
import { conferenceStatus } from '../js/conference.js';
import { seasonForDate, SEASONS, easterFor, resolveFestivals, activeFestivals, FESTIVALS, REGIONAL } from '../js/seasonal.js';
import { classifyHeadline } from '../js/news_reactivity.js';
import { kardashevScale } from '../js/kardashev.js';
import { isWetWeather, puddleLayout } from '../js/wetness.js';
import { createGhosts, Multiplayer } from '../js/multiplayer.js';
import { buildTerminalModel, terminalHtml } from '../js/terminal.js';
import { TRAM_LINES, getFounderAct, FOUNDERS, LAB_HQ as HQMAP } from '../js/data.js';
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
// The jail used to borrow the Black Market as a holding area because there was
// no detention building. There is one now, and it must be a real placed building.
assert(JAIL_BID === 'ai_jail', 'jail venue is the AI Detention Center');
assert(BLDS.some(b => b.id === JAIL_BID), 'detention centre exists in BLDS');

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

// 10b. Festival calendar — the real 19-holiday set, not a month label map
assert(FESTIVALS.length + REGIONAL.length === 19, '19 festivals defined');
{
    const e = easterFor(2026);
    assert(e.month === 4 && e.day === 5, 'Easter 2026 computus = 5 April');
    const resolved = resolveFestivals(2026);
    assert(resolved.every(f => f.sm > 0), 'every 2026 festival resolves to a date');
    // sweep the year with every region enabled: all 19 must fire at some point
    const allRegions = ['east_asia', 'japan', 'south_asia', 'southeast_asia',
        'indonesia', 'middle_east', 'jewish', 'latin_america', 'thailand'];
    const seen = new Set();
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
        for (const f of activeFestivals(new Date(d), allRegions)) seen.add(f.id);
    }
    assert(seen.size === 19, 'all 19 festivals fire during 2026 (got ' + seen.size + ')');
    // regional festivals must NOT show to a player outside their region
    const diwaliDay = new Date(2026, 10, 9);
    assert(activeFestivals(diwaliDay, ['south_asia']).some(f => f.id === 'diwali'), 'Diwali shows in South Asia');
    assert(!activeFestivals(diwaliDay, []).some(f => f.id === 'diwali'), 'Diwali hidden outside its regions');
}

// 10c. News reactivity classifier
{
    const c = (t) => classifyHeadline(t);
    assert(c('OpenAI launches GPT-5').lab === 'openai', 'routes to OpenAI');
    assert(c('OpenAI launches GPT-5').sentiment === 'celebrate', 'launch = celebrate');
    assert(c('Meta researcher resigns amid class action').sentiment === 'emergency', 'lawsuit = emergency');
    assert(c('EU AI Act: Google faces antitrust hearing').sentiment === 'regulatory', 'hearing = regulatory');
    assert(c('xAI under fire after Grok outage').sentiment === 'crisis', 'outage = crisis');
    // the classic false positive: "O2 Arena" must not read as OpenAI's o2
    assert(c('Concert at the O2 Arena sells out').lab === null, 'O2 Arena is not OpenAI');
}

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

// 12. Multiplayer — offline by design (no fake ghost peers when nobody is online)
const ghosts = createGhosts(6);
assert(ghosts.length === 0, 'no placeholder ghost peers offline');
const mpSnap = Multiplayer.snapshot();
assert(mpSnap.count === 0 && mpSnap.online === false, 'multiplayer reports offline empty city');

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
    'kardashev', 'wetness', 'terminal'
]) {
    assert(mainSrc.includes(mod), 'main.js wires ' + mod);
}
// multiplayer module exists but is intentionally NOT booted with fake peers
assert(fs.existsSync(path.join(root, 'js/multiplayer.js')), 'multiplayer.js present (offline stub)');
assert(!mainSrc.includes("from './multiplayer.js'"), 'main does not spawn offline ghost peers');

// interior special themes structural
const intSrc = fs.readFileSync(path.join(root, 'js/interior.js'), 'utf8');
for (const cat of ['jail', 'court', 'embassy', 'mission', 'power', 'boardroom']) {
    assert(intSrc.includes("'" + cat + "'") || intSrc.includes('"' + cat + '"') || intSrc.includes(`cat: '${cat}'`),
        'interior has ' + cat + ' theme');
}
assert(intSrc.includes('setFloor') && intSrc.includes('maxFloor'), 'multi-floor lift support');


// 14. Founder schedule + LAB_HQ
assert(FOUNDERS.length >= 6, 'founders roster present');
assert(HQMAP.openai === 'bld_o' && HQMAP.xai === 'bld_x', 'LAB_HQ maps labs to buildings');
const fa = getFounderAct(0.4, 0.5, { lab: 'openai', name: 'Sam' });
assert(fa.act === 'work' && fa.bid === 'bld_o', 'founder midday work at HQ');
const fl = getFounderAct(0.52, 0.1, { lab: 'openai', name: 'Sam' });
assert(['lunch', 'socialize', 'work'].includes(fl.act), 'founder lunch window mobile');
const fsleep = getFounderAct(0.1, 0.2, { lab: 'xai', name: 'Elon' });
assert(fsleep.act === 'sleep', 'founder night sleep');

// 15. Metro board/alight API structural
const metroSrc = fs.readFileSync(path.join(root, 'js/metro.js'), 'utf8');
assert(metroSrc.includes('board(') && metroSrc.includes('alight(') && metroSrc.includes('canBoardNear'),
    'metro has board/alight/canBoardNear');
assert(metroSrc.includes('riding') && metroSrc.includes('cabin'), 'metro ride cabin present');
// dwell long enough to board
const train2 = { routeIdx: 0, seg: 0, segProgress: 0.999, speed: 200, x: routes[0].pts[0].x, z: routes[0].pts[0].z, dirX: 1, dirZ: 0, dwellT: 0, laps: 0, atStop: null, _longDwell: true };
for (let i = 0; i < 5; i++) stepTrain(train2, 0.05, routes);
assert(train2.dwellT > 0 || train2.atStop, 'metro dwells at stops for boarding');

// 16. Elevator / multi-floor structural
assert(intSrc.includes('rideElevator') && intSrc.includes("cat: 'metro'") && (intSrc.includes("cat === 'platform'") || (intSrc.includes("cat === 'platform'") || intSrc.includes("'platform'"))),
    'interior elevators + metro platform themes');
assert(intSrc.includes('MeshStandardMaterial'), 'interior uses upgraded materials');

// 17. Founder VIP traffic structural
const trafSrc = fs.readFileSync(path.join(root, 'js/traffic.js'), 'utf8');
assert(trafSrc.includes('_initVipCars') && trafSrc.includes('_initFounderHelis'),
    'traffic has VIP founder cars + founder helis');
assert(trafSrc.includes('FOUNDERS'), 'traffic imports founders');

// 18. Citizens schedule helpers
const citSrc2 = fs.readFileSync(path.join(root, 'js/citizens.js'), 'utf8');
assert(citSrc2.includes('getFounderAct') && citSrc2.includes('scheduleSnapshot') && citSrc2.includes('founders()'),
    'citizens founder schedule + snapshot helpers');


// 19. Destination themes (2D parity routes)
for (const cat of ['underground', 'vc', 'agents', 'alignment', 'arena', 'cafe', 'gym', 'nursery', 'conference', 'backbone']) {
    assert(intSrc.includes("'" + cat + "'") || intSrc.includes(`cat: '${cat}'`) || intSrc.includes(`cat === '${cat}'`),
        'interior destination theme: ' + cat);
}
assert(intSrc.includes("launchpad") && intSrc.includes('mission'),
    'launchpads map to mission interiors');
assert(!/NO = new Set\(\[[^\]]*launchpad/.test(intSrc),
    'launchpad not blocked from enter');
assert(fs.readFileSync(path.join(root, 'js/world.js'), 'utf8').includes('_crown') ||
    fs.readFileSync(path.join(root, 'js/world.js'), 'utf8').includes('Crown'),
    'skyline crown/spire polish present');

log('');
log(failed ? `FAILED ${failed} assertion(s)` : 'ALL EXERCISES PASSED');
const outDir = process.env.PARITY_SCRATCH || path.join(root, 'tests');
try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
const outFile = path.join(outDir, 'systems_exercise.log');
fs.writeFileSync(outFile, lines.join('\n') + '\n');
log('wrote ' + outFile);
process.exit(failed ? 1 : 0);
