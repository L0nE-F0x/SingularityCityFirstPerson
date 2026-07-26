/* ============================================================================
   SC Integrated Bridge — runs inside the vendored Pixi 2D copy (pixi/).
   Does NOT touch ApexForge production. Adds First Person navigation and
   shared progress keys with the Three.js FP app at the repo root.
   ============================================================================ */
(function () {
    'use strict';

    var RESUME_KEY = 'sc_view_resume_v1';
    var CITY_SAVE = 'sc_city_save_v1';
    var FP_SAVE = 'sc_fp_save_v1';
    var PROD_SAVE = 'sc_data';

    function fpUrl(token) {
        var u = new URL('../index.html', window.location.href);
        u.searchParams.set('autostart', '1');
        u.searchParams.set('view', 'fp');
        u.searchParams.set('from', 'pixi');
        if (token) {
            if (token.dayPhase != null && !isNaN(token.dayPhase)) {
                u.searchParams.set('dp', String(token.dayPhase));
            }
            if (token.buildingId) u.searchParams.set('inside', token.buildingId);
            // FP world is a different coordinate system than Pixi linear X —
            // only pass x/z if they look like FP coords (already set by FP side).
            if (token.fpX != null && token.fpZ != null) {
                u.searchParams.set('x', String(token.fpX));
                u.searchParams.set('z', String(token.fpZ));
                if (token.yaw != null) u.searchParams.set('yaw', String(token.yaw));
            }
        }
        return u.href;
    }

    function captureResume() {
        var token = {
            view: 'fp',
            from: 'pixi',
            at: Date.now(),
            dayPhase: null,
            buildingId: null,
            districtHint: null,
            camX: null
        };
        try {
            if (typeof G !== 'undefined') {
                if (typeof G.getDayPhase === 'function') token.dayPhase = G.getDayPhase();
                if (G.activeInterior && G.activeInterior.id) token.buildingId = G.activeInterior.id;
                if (typeof Camera !== 'undefined' && Camera.targetX != null) token.camX = Camera.targetX;
            }
        } catch (e) { /* ignore */ }
        try {
            sessionStorage.setItem(RESUME_KEY, JSON.stringify(token));
            localStorage.setItem(RESUME_KEY, JSON.stringify(token));
        } catch (e2) { /* ignore */ }
        return token;
    }

    function mergeProgressIntoCitySave() {
        // Pull Pixi achievements into unified city save so FP sees them.
        try {
            var prod = {};
            try { prod = JSON.parse(localStorage.getItem(PROD_SAVE) || '{}') || {}; } catch (e) { prod = {}; }
            var city = {};
            try { city = JSON.parse(localStorage.getItem(CITY_SAVE) || '{}') || {}; } catch (e2) { city = {}; }
            if (!city.v) city.v = 1;
            if (!city.progress) city.progress = {};
            city.progress.achievements = Object.assign(
                {},
                city.progress.achievements || {},
                prod.achievements || {}
            );
            if (prod.prefs) {
                city.settings = Object.assign({}, city.settings || {}, {
                    music: prod.prefs.music != null ? prod.prefs.music : true,
                    sfx: prod.prefs.sfx != null ? prod.prefs.sfx : true
                });
            }
            city.savedAt = Date.now();
            city.lastView = 'pixi';
            localStorage.setItem(CITY_SAVE, JSON.stringify(city));
            // Keep FP legacy key roughly in sync
            var legacy = {
                achievements: city.progress.achievements,
                visitedDistricts: (city.progress.visitedDistricts) || {},
                metCitizens: (city.progress.metCitizens) || {},
                stats: city.progress.stats || {},
                settings: city.settings || {},
                quality: city.quality || 'medium'
            };
            localStorage.setItem(FP_SAVE, JSON.stringify(legacy));
        } catch (e3) {
            console.warn('[SC Bridge] mergeProgress failed', e3);
        }
    }

    function goFirstPerson() {
        mergeProgressIntoCitySave();
        var token = captureResume();
        // Soft pause music if present
        try {
            if (typeof SND !== 'undefined' && SND.musicEnabled && SND.toggleMusic) {
                /* leave music state; FP has its own audio graph */
            }
            if (typeof G !== 'undefined' && G.app && G.app.ticker) G.app.ticker.stop();
        } catch (e) { /* ignore */ }
        window.location.href = fpUrl(token);
    }

    function injectStyles() {
        if (document.getElementById('sc-bridge-style')) return;
        var s = document.createElement('style');
        s.id = 'sc-bridge-style';
        s.textContent = [
            '.sc-fp-btn{background:linear-gradient(135deg,#be185d,#7c3aed)!important;',
            'border-color:#f472b6!important;color:#fff!important;font-weight:700!important}',
            '.sc-fp-btn:hover{filter:brightness(1.08)}',
            '.land-fp{margin-left:10px;background:linear-gradient(135deg,#be185d,#7c3aed);',
            'color:#fff;border:0;border-radius:10px;padding:14px 18px;font:700 14px/1 system-ui,sans-serif;',
            'cursor:pointer;box-shadow:0 8px 24px rgba(190,24,93,.35)}',
            '.land-fp:hover{filter:brightness(1.06)}',
            '.sc-bridge-banner{position:fixed;top:0;left:0;right:0;z-index:99999;pointer-events:none;',
            'display:flex;justify-content:center;padding:8px;font:12px/1.3 JetBrains Mono,monospace}',
            '.sc-bridge-banner span{pointer-events:auto;background:rgba(7,11,20,.88);color:#e2e8f0;',
            'border:1px solid rgba(244,114,182,.4);border-radius:999px;padding:6px 12px}',
            '.sc-bridge-banner a{color:#f9a8d4;margin-left:8px;font-weight:700}'
        ].join('');
        document.head.appendChild(s);
    }

    function injectToolbarButton() {
        var bar = document.getElementById('ctrlBar');
        if (!bar || document.getElementById('btnFirstPerson')) return;
        var btn = document.createElement('button');
        btn.className = 'btn sc-fp-btn';
        btn.id = 'btnFirstPerson';
        btn.title = 'Walk the city in first person (Three.js view in this integrated build)';
        btn.textContent = '🚶 First Person';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof UI !== 'undefined' && UI.uiClick) UI.uiClick();
            goFirstPerson();
        });
        // Prefer near holomap
        var macro = document.getElementById('btnMacro');
        if (macro && macro.parentNode === bar) bar.insertBefore(btn, macro.nextSibling);
        else bar.appendChild(btn);
    }

    function injectLandingButton() {
        var enter = document.querySelector('.land-enter');
        if (!enter || document.getElementById('landFirstPerson')) return;
        var wrap = enter.parentNode;
        var b = document.createElement('button');
        b.id = 'landFirstPerson';
        b.className = 'land-fp';
        b.type = 'button';
        b.textContent = '🚶 Walk First Person';
        b.title = 'Skip the top-down city and enter the first-person streets';
        b.addEventListener('click', function (e) {
            e.preventDefault();
            goFirstPerson();
        });
        if (wrap) wrap.insertBefore(b, enter.nextSibling);
    }

    function injectCornerChip() {
        if (document.getElementById('scBridgeChip')) return;
        var d = document.createElement('div');
        d.id = 'scBridgeChip';
        d.className = 'sc-bridge-banner';
        d.innerHTML = '<span>INTEGRATED BUILD · 2D + FP in one repo <a href="#" id="scBridgeFpLink">Open First Person →</a></span>';
        document.body.appendChild(d);
        document.getElementById('scBridgeFpLink').addEventListener('click', function (e) {
            e.preventDefault();
            goFirstPerson();
        });
    }

    function applyIncomingResume() {
        // If we arrived from FP with a resume token, try to pan camera to saved camX
        var raw = null;
        try { raw = sessionStorage.getItem(RESUME_KEY); } catch (e) { /* ignore */ }
        if (!raw) {
            try { raw = localStorage.getItem(RESUME_KEY); } catch (e2) { /* ignore */ }
        }
        if (!raw) return;
        var token;
        try { token = JSON.parse(raw); } catch (e3) { return; }
        if (!token || token.view !== 'pixi') return;

        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (typeof G === 'undefined' || !G.app) {
                if (tries > 80) clearInterval(iv);
                return;
            }
            clearInterval(iv);
            try {
                // Auto-enter city if still on landing
                if (typeof enterCity === 'function' && document.getElementById('landing') &&
                    getComputedStyle(document.getElementById('landing')).display !== 'none') {
                    // only auto-enter when coming from FP toggle
                    if (token.from === 'fp') enterCity();
                }
            } catch (e4) { /* ignore */ }
            try {
                if (token.camX != null && typeof Camera !== 'undefined') {
                    Camera.targetX = token.camX;
                    if (Camera.x != null) Camera.x = token.camX;
                }
            } catch (e5) { /* ignore */ }
            try {
                if (typeof UI !== 'undefined' && UI.addToast) {
                    UI.addToast('↩ Resumed 2D city from First Person');
                }
            } catch (e6) { /* ignore */ }
            // consume one-shot resume
            try {
                sessionStorage.removeItem(RESUME_KEY);
            } catch (e7) { /* ignore */ }
        }, 250);
    }

    function boot() {
        injectStyles();
        injectToolbarButton();
        injectLandingButton();
        injectCornerChip();
        applyIncomingResume();
        // Re-inject toolbar if ctrl bar mounts late
        var n = 0;
        var t = setInterval(function () {
            injectToolbarButton();
            n++;
            if (n > 40) clearInterval(t);
        }, 500);
        // Periodic progress merge so FP stays warm
        setInterval(mergeProgressIntoCitySave, 60000);
        window.SCIntegrated = {
            goFirstPerson: goFirstPerson,
            mergeProgress: mergeProgressIntoCitySave,
            captureResume: captureResume
        };
        console.log('[SC Bridge] Integrated 2D↔FP bridge ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
