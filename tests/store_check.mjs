/**
 * Lightweight CityStore contract test (Node). Mocks localStorage.
 */
import assert from 'assert';
import { createRequire } from 'module';

// localStorage polyfill before importing store modules
const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
};
globalThis.location = { search: '' };
globalThis.window = globalThis;

const { CityStore } = await import('../js/store/city_store.js');
const { INTEGRATION } = await import('../js/store/config.js');

CityStore.init();
const s0 = CityStore.getSnapshot();
assert.equal(s0.view, 'fp');
assert.ok(Array.isArray(s0.news));
assert.equal(typeof s0.aiIndex, 'number');

let saw = false;
const unsub = CityStore.subscribe((patch) => { if (patch.weather) saw = true; });
CityStore.syncSim({ dayPhase: 0.42, timeScale: 1, weatherState: 'rain', weatherIntensity: 0.8, climate: 'temperate' });
assert.equal(CityStore.getSnapshot().dayPhase, 0.42);
assert.equal(CityStore.getSnapshot().weather.state, 'rain');
assert.ok(saw);
unsub();

assert.ok(CityStore.unlockAchievement('first_steps'));
assert.equal(CityStore.unlockAchievement('first_steps'), false); // already
assert.ok(CityStore.getSnapshot().progress.achievements.first_steps);

CityStore.saveProgress();
const raw = localStorage.getItem(INTEGRATION.SAVE_KEY);
assert.ok(raw);
const parsed = JSON.parse(raw);
assert.equal(parsed.v, INTEGRATION.version);
assert.ok(parsed.progress.achievements.first_steps);

// legacy key dual-write
assert.ok(localStorage.getItem(INTEGRATION.LEGACY_FP_SAVE_KEY));

CityStore.setView('map');
assert.equal(CityStore.getView(), 'map');
const token = CityStore.captureResume('fp', { x: 10, z: -20, districtId: 'civic' });
assert.equal(token.districtId, 'civic');
CityStore.applyResume(token);
assert.equal(CityStore.getView(), 'fp');

CityStore.setNews([{ headline: 'Test live headline', url: '#', source: 'Unit' }], { online: true, sources: ['unit'] });
assert.equal(CityStore.getSnapshot().live.online, true);
assert.equal(CityStore.getSnapshot().news[0].headline, 'Test live headline');

console.log('store_check: OK');
