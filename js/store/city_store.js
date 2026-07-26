/* ============================================================================
   CITYSTORE — single shared brain for the integrated product (this repo only).

   Views (first-person Three, 2D city-map shell) subscribe; they do not each
   own a private save/live fork. Static data.js remains offline fallback.

   Production ApexForge/SingularityCity is NOT modified. When a future site
   merge happens, this interface is the contract both renderers should use.
   ============================================================================ */

import { INTEGRATION } from './config.js';
import { NEWS as FALLBACK_NEWS, SEED, ROSTER, DC_FACILITIES } from '../data.js';

/** @typedef {'fp' | 'map'} ViewId */

function emptyProgress() {
    return {
        achievements: {},
        visitedDistricts: {},
        metCitizens: {},
        flags: {},
        stats: { tramsSpotted: 0, moonClicks: 0 }
    };
}

function defaultSettings() {
    return {
        music: true,
        sfx: true,
        volume: 0.8,
        fov: 70,
        invertY: false,
        sensitivity: 1.0,
        timeScale: 1
    };
}

function defaultSnapshot() {
    return {
        dayPhase: 0.5,
        timeScale: 1,
        weather: { state: 'clear', intensity: 0, climate: undefined },
        aiIndex: 512,
        aiDelta: 0,
        news: FALLBACK_NEWS.map(n => ({ ...n, source: n.source || 'Static' })),
        cotd: null,
        progress: emptyProgress(),
        settings: defaultSettings(),
        quality: 'medium',
        view: 'fp',
        live: { online: false, lastFetch: 0, sources: [], models: undefined, error: null },
        source: 'offline'
    };
}

const _subs = new Set();
let _snap = defaultSnapshot();
let _hydrated = false;

function emit(patch) {
    for (const fn of _subs) {
        try { fn(patch, _snap); } catch (e) { console.warn('[CityStore] subscriber error', e); }
    }
}

function deepMergeProgress(into, from) {
    if (!from) return into;
    into.achievements = Object.assign({}, into.achievements, from.achievements || {});
    into.visitedDistricts = Object.assign({}, into.visitedDistricts, from.visitedDistricts || {});
    into.metCitizens = Object.assign({}, into.metCitizens, from.metCitizens || {});
    into.flags = Object.assign({}, into.flags, from.flags || {});
    into.stats = Object.assign({}, into.stats, from.stats || {});
    return into;
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(INTEGRATION.SAVE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) { /* fall through */ }

    try {
        const legacy = localStorage.getItem(INTEGRATION.LEGACY_FP_SAVE_KEY);
        if (!legacy) return null;
        const s = JSON.parse(legacy);
        const migrated = {
            v: INTEGRATION.version,
            progress: {
                achievements: s.achievements || {},
                visitedDistricts: s.visitedDistricts || {},
                metCitizens: s.metCitizens || {},
                flags: s.flags || {},
                stats: s.stats || { tramsSpotted: 0, moonClicks: 0 }
            },
            settings: s.settings || defaultSettings(),
            quality: s.quality || 'medium',
            view: {
                fp: {
                    fov: s.settings?.fov,
                    sensitivity: s.settings?.sensitivity,
                    invertY: s.settings?.invertY
                },
                pixi: {}
            }
        };
        try { localStorage.setItem(INTEGRATION.SAVE_KEY, JSON.stringify(migrated)); } catch (_) { /* ignore */ }
        return migrated;
    } catch (_) {
        return null;
    }
}

export const CityStore = {
    getSnapshot() { return _snap; },

    subscribe(fn) {
        _subs.add(fn);
        return () => _subs.delete(fn);
    },

    patch(partial) {
        if (!partial || typeof partial !== 'object') return;
        const next = { ..._snap, ...partial };
        if (partial.weather) next.weather = { ..._snap.weather, ...partial.weather };
        if (partial.progress) {
            next.progress = {
                ..._snap.progress,
                ...partial.progress,
                achievements: { ..._snap.progress.achievements, ...(partial.progress.achievements || {}) },
                visitedDistricts: { ..._snap.progress.visitedDistricts, ...(partial.progress.visitedDistricts || {}) },
                metCitizens: { ..._snap.progress.metCitizens, ...(partial.progress.metCitizens || {}) },
                flags: { ..._snap.progress.flags, ...(partial.progress.flags || {}) },
                stats: { ..._snap.progress.stats, ...(partial.progress.stats || {}) }
            };
        }
        if (partial.settings) next.settings = { ..._snap.settings, ...partial.settings };
        if (partial.live) next.live = { ..._snap.live, ...partial.live };
        if (partial.news) next.news = partial.news;
        _snap = next;
        emit(partial);
    },

    init() {
        if (_hydrated) return _snap;
        _snap = defaultSnapshot();
        const saved = loadFromStorage();
        if (saved) {
            if (saved.progress) deepMergeProgress(_snap.progress, saved.progress);
            if (saved.settings) _snap.settings = { ..._snap.settings, ...saved.settings };
            if (saved.quality) _snap.quality = saved.quality;
            if (saved.settings?.timeScale != null) _snap.timeScale = Number(saved.settings.timeScale) || 1;
        }
        try {
            const prod = localStorage.getItem('sc_data');
            if (prod) {
                const d = JSON.parse(prod);
                if (d.achievements) deepMergeProgress(_snap.progress, { achievements: d.achievements });
            }
        } catch (_) { /* ignore */ }

        const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
        if (params?.get('view') === 'map') _snap.view = 'map';
        else if (params?.get('view') === 'fp') _snap.view = 'fp';

        _hydrated = true;
        emit({ ..._snap });
        return _snap;
    },

    saveProgress() {
        const payload = {
            v: INTEGRATION.version,
            progress: _snap.progress,
            settings: _snap.settings,
            quality: _snap.quality,
            view: {
                fp: {
                    fov: _snap.settings.fov,
                    sensitivity: _snap.settings.sensitivity,
                    invertY: _snap.settings.invertY
                },
                pixi: {}
            },
            savedAt: Date.now()
        };
        try {
            localStorage.setItem(INTEGRATION.SAVE_KEY, JSON.stringify(payload));
            localStorage.setItem(INTEGRATION.LEGACY_FP_SAVE_KEY, JSON.stringify({
                achievements: _snap.progress.achievements,
                visitedDistricts: _snap.progress.visitedDistricts,
                metCitizens: _snap.progress.metCitizens,
                stats: _snap.progress.stats,
                settings: _snap.settings,
                quality: _snap.quality
            }));
        } catch (e) {
            console.warn('[CityStore] save failed', e);
        }
    },

    updateSettings(partial) {
        this.patch({ settings: { ..._snap.settings, ...partial } });
        if (partial.timeScale != null) this.patch({ timeScale: Number(partial.timeScale) || 1 });
        this.saveProgress();
    },

    unlockAchievement(id, at = Date.now()) {
        if (!id || _snap.progress.achievements[id]) return false;
        this.patch({ progress: { achievements: { [id]: at } } });
        this.saveProgress();
        return true;
    },

    markDistrict(id, at = Date.now()) {
        if (!id || _snap.progress.visitedDistricts[id]) return false;
        this.patch({ progress: { visitedDistricts: { [id]: at } } });
        this.saveProgress();
        return true;
    },

    markCitizen(id, at = Date.now()) {
        if (!id || _snap.progress.metCitizens[id]) return false;
        this.patch({ progress: { metCitizens: { [id]: at } } });
        this.saveProgress();
        return true;
    },

    setView(view) {
        if (view !== 'fp' && view !== 'map') return;
        if (_snap.view === view) return;
        this.patch({ view });
    },

    getView() { return _snap.view; },

    captureResume(view, extra = {}) {
        return {
            view: view || _snap.view,
            dayPhase: _snap.dayPhase,
            districtId: extra.districtId ?? null,
            buildingId: extra.buildingId ?? null,
            x: extra.x,
            z: extra.z,
            yaw: extra.yaw,
            at: Date.now()
        };
    },

    applyResume(token) {
        if (!token) return;
        const patch = {};
        if (typeof token.dayPhase === 'number') patch.dayPhase = token.dayPhase;
        if (token.view === 'fp' || token.view === 'map') patch.view = token.view;
        if (Object.keys(patch).length) this.patch(patch);
        return token;
    },

    recomputeOfflineAiIndex(citizenCount = 0) {
        const named = SEED.filter(m => m.benchmarks && Object.keys(m.benchmarks).length);
        const avg = (b) => {
            const vals = Object.values(b).filter(v => typeof v === 'number');
            return vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : 0;
        };
        const ceiling = named.length ? Math.max(...named.map(m => avg(m.benchmarks))) : 50;
        const labs = new Set(ROSTER.map(r => r.lab).concat(SEED.map(m => m.lab)));
        const osRatio = ROSTER.length ? ROSTER.filter(r => r.os).length / ROSTER.length : 0;
        const compute = DC_FACILITIES.length * 12;
        const score = ceiling * 2.5 + citizenCount * 0.55 + labs.size * 8 + osRatio * 60 + compute;
        const next = Math.min(1000, Math.round(score + Math.sin(Date.now() / 8e5) * 14));
        const delta = next - _snap.aiIndex;
        this.patch({ aiIndex: next, aiDelta: delta });
        return next;
    },

    syncSim({ dayPhase, timeScale, weatherState, weatherIntensity, climate }) {
        const w = _snap.weather;
        const same =
            _snap.dayPhase === dayPhase &&
            _snap.timeScale === timeScale &&
            w.state === weatherState &&
            w.intensity === weatherIntensity &&
            w.climate === climate;
        if (same) return;
        this.patch({
            dayPhase,
            timeScale,
            weather: {
                state: weatherState ?? w.state,
                intensity: weatherIntensity ?? w.intensity,
                climate: climate ?? w.climate
            }
        });
    },

    setCotd(cotd) { this.patch({ cotd }); },

    setNews(news, meta = {}) {
        const list = Array.isArray(news) && news.length ? news : _snap.news;
        const online = !!meta.online;
        this.patch({
            news: list,
            source: online ? (meta.mixed ? 'mixed' : 'live') : 'offline',
            live: {
                online,
                lastFetch: meta.lastFetch ?? Date.now(),
                sources: meta.sources || _snap.live.sources,
                models: meta.models ?? _snap.live.models,
                error: meta.error ?? null
            }
        });
    }
};

if (typeof window !== 'undefined') window.CityStore = CityStore;
