/**
 * Headless interior theme exercise — builds every cat without a browser.
 * Run: node tests/interior_theme_check.mjs
 * Also: node --check js/interior.js
 */
class FakeCtx {
    fillStyle = '#000'; strokeStyle = '#000'; lineWidth = 1;
    font = ''; textAlign = 'left'; textBaseline = 'top';
    fillRect() {} clearRect() {} strokeRect() {} beginPath() {} moveTo() {} lineTo() {} stroke() {}
    fillText() {} createLinearGradient() { return { addColorStop() {} }; }
}
class FakeCanvas {
    width = 0; height = 0;
    getContext() { return new FakeCtx(); }
}
globalThis.document = {
    createElement(tag) {
        if (tag === 'canvas') return new FakeCanvas();
        return { style: {}, addEventListener() {}, removeEventListener() {} };
    },
    addEventListener() {},
    removeEventListener() {}
};

import * as THREE from '../lib/three.module.js';
import { G } from '../js/state.js';
import { Interior } from '../js/interior.js';

const scene = new THREE.Scene();
G.scene = scene;
G.camera = new THREE.PerspectiveCamera(70, 1, 1, 1000);
G.camera.position.set(0, 17, 0);
G.player = {
    yaw: 0,
    teleport(x, z, yaw) {
        G.camera.position.x = x;
        G.camera.position.z = z;
        if (yaw != null) this.yaw = yaw;
    }
};
G.ui = { banner() {}, addToast() {}, prompt() {}, lookLabel() {} };
G.audio = { sfx() {} };
G.progress = { unlock() {} };
G.colliders = [];
G.panelOpen = false;
G.ridingMetro = false;

Interior.init(scene);

const buildings = [
    { id: 'hq_openai', name: 'OpenAI HQ', type: 'hq', emoji: '🏢', fl: 8, lab: 'openai' },
    { id: 'dc_core', name: 'Core DC', type: 'datacenter', emoji: '🖧', fl: 4 },
    { id: 'neon_bar', name: 'Neon Bar', type: 'bar', emoji: '🍸', fl: 3 },
    { id: 'metro_central', name: 'Central Station', type: 'metro', emoji: '🚇', fl: 1 },
    { id: 'black_market', name: 'Black Market', type: 'shop', emoji: '🕶️', fl: 1 },
    { id: 'vcrow_a16z', name: 'a16z', type: 'vcrow', emoji: '💰', fl: 5, district: 'vc' },
    { id: 'agents_hub', name: 'Agent Hub', type: 'agents', emoji: '🤖', fl: 3, district: 'agents' },
    { id: 'align_cabin', name: 'Alignment Cabin', type: 'cabin', emoji: '🌲', fl: 1, district: 'alignment' },
    { id: 'court_hearing', name: 'Hearing Room', type: 'court', emoji: '⚖️', fl: 2 },
    { id: 'embassy_us', name: 'US Embassy', type: 'embassy', emoji: '🏛️', fl: 4 },
    { id: 'mission_control', name: 'Mission Control', type: 'launchpad', emoji: '🚀', fl: 2 },
    { id: 'power_nuke', name: 'Reactor', type: 'nuclear', emoji: '⚛️', fl: 2 },
    { id: 'res_1', name: 'Apartment', type: 'housing', emoji: '🏠', fl: 6, district: 'residential' },
    { id: 'robo_1', name: 'Robo Works', type: 'lab', emoji: '🦾', fl: 1, district: 'robotics' },
    { id: 'long_1', name: 'Longevity Lab', type: 'lab', emoji: '🧬', fl: 2, district: 'longevity' },
    { id: 'uni_lib', name: 'University', type: 'university', emoji: '📚', fl: 4, district: 'university' },
    { id: 'times_hq', name: 'Times HQ', type: 'newspaper', emoji: '📰', fl: 3 },
    { id: 'wh_1', name: 'Warehouse', type: 'warehouse', emoji: '📦', fl: 1 },
    { id: 'arena', name: 'Arena', type: 'arena', emoji: '🏟️', fl: 1 },
    { id: 'cafe', name: 'Cafe', type: 'shop', emoji: '☕', fl: 1 },
    { id: 'gym', name: 'Gym', type: 'shop', emoji: '💪', fl: 1 },
    { id: 'nursery', name: 'Nursery', type: 'shop', emoji: '🍼', fl: 1 },
    { id: 'convention_center', name: 'Convention', type: 'conference', emoji: '🎤', fl: 2 },
    { id: 'backbone_ixp', name: 'IXP', type: 'backbone', emoji: '🌐', fl: 2 },
    { id: 'jail_main', name: 'City Jail', type: 'jail', emoji: '🔒', fl: 2 },
    { id: 'fab_1', name: 'Chip Fab', type: 'fab', emoji: '💿', fl: 3 },
];

let fail = 0;
const log = (s) => console.log(s);

for (const b of buildings) {
    try {
        Interior.building = null;
        Interior.group.visible = false;
        Interior.enter(b);
        if (!Interior.building) throw new Error('enter did not stick');
        const th = Interior._theme(b).cat;
        const kids = Interior.group.children.length;
        const lifts = Interior._liftZones.length;
        const mf = Interior.maxFloor;
        for (let f = 0; f <= mf; f++) {
            Interior.setFloorInstant ? Interior.setFloorInstant(f) : Interior._setFloor(f);
            if (Interior.floor !== f) throw new Error(`setFloor ${f} failed, got ${Interior.floor}`);
            if (Interior.group.children.length < 2) throw new Error(`empty room floor ${f}`);
        }
        if (mf > 0) {
            if (Interior._liftZones.length < 1) throw new Error('multi-floor but no lift zones');
            // Interior geometry is authored in local units and scaled by
            // ROOM_SCALE; stand at the lift in WORLD units, as the player does.
            const z = Interior.liftZoneWorld(0);
            if (!z) throw new Error('no world lift zone');
            G.camera.position.set(z.x + z.r * 0.3, 17, z.z);
            if (!Interior.atLift()) throw new Error('atLift false at zone');
        }
        Interior.exit(true);   // harness teardown; the player must ride down
        if (Interior.building) throw new Error('exit left building set');
        log(`OK  ${b.id.padEnd(22)} cat=${th.padEnd(12)} floors=0..${mf} meshes=${kids} lifts=${lifts}`);
    } catch (e) {
        fail++;
        log(`ERR ${b.id}: ${e.message}\n${e.stack}`);
        try { Interior.building = null; Interior.group.visible = false; } catch (_) {}
    }
}

if (typeof Interior._enrichRoom !== 'function') {
    fail++;
    log('ERR _enrichRoom missing');
} else log('OK  _enrichRoom present');

log(fail ? `FAILED ${fail}` : `ALL ${buildings.length} themes OK`);
process.exit(fail ? 1 : 0);
