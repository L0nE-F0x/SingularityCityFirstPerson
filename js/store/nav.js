/* ============================================================================
   Cross-view navigation — hard-swap between root FP and vendored Pixi 2D.
   Shared resume token in sessionStorage/localStorage (sc_view_resume_v1).
   ============================================================================ */

import { INTEGRATION } from './config.js';
import { CityStore } from './city_store.js';
import { G } from '../state.js';

const RESUME_KEY = INTEGRATION.resumeKey || 'sc_view_resume_v1';

export function readResumeToken() {
    let raw = null;
    try { raw = sessionStorage.getItem(RESUME_KEY); } catch (_) { /* ignore */ }
    if (!raw) {
        try { raw = localStorage.getItem(RESUME_KEY); } catch (_) { /* ignore */ }
    }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
}

export function writeResumeToken(token) {
    const t = { ...token, at: Date.now() };
    const s = JSON.stringify(t);
    try { sessionStorage.setItem(RESUME_KEY, s); } catch (_) { /* ignore */ }
    try { localStorage.setItem(RESUME_KEY, s); } catch (_) { /* ignore */ }
    return t;
}

export function clearResumeToken() {
    try { sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
}

/** Capture FP pose and navigate to vendored Pixi 2D. */
export function goPixi2D(extra = {}) {
    // Leaving FP intentionally — don't flash the pause menu when pointer lock drops
    try { G._suppressPauseOnUnlock = true; } catch (_) { /* ignore */ }
    try { G.player?.unlock?.(); } catch (_) { /* ignore */ }
    CityStore.saveProgress();
    const token = {
        view: 'pixi',
        from: 'fp',
        dayPhase: G.dayPhase,
        buildingId: G.inside?.id || null,
        camX: extra.camX ?? null,
        fpX: G.camera?.position?.x,
        fpZ: G.camera?.position?.z,
        yaw: G.player?.yaw,
        districtId: extra.districtId || null
    };
    writeResumeToken(token);
    CityStore.patch({ view: 'pixi' });
    const url = new URL(INTEGRATION.classic2dUrl, window.location.href);
    // Prefer entering city when arriving from FP
    url.searchParams.set('from', 'fp');
    window.location.href = url.href;
}

/** Build FP URL (used rarely from module context). */
export function fpHref(params = {}) {
    const u = new URL('./index.html', window.location.href);
    Object.entries(params).forEach(([k, v]) => {
        if (v != null) u.searchParams.set(k, String(v));
    });
    return u.href;
}

