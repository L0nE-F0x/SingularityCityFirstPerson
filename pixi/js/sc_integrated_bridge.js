/* ============================================================================
   SC Integrated Bridge — runs inside the vendored Pixi 2D copy (pixi/).
   Does NOT touch ApexForge production. Adds First Person navigation and
   shared progress keys with the Three.js FP app at the repo root.

   Product flow (owner 2026-07-28):
   - Landing page is pure 2D — no "Walk First Person" / "Open First Person" chips.
   - FP is reachable only from the in-city top toolbar button.
   - That button stays compact so the music control still fits on laptop widths.
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
        // Do NOT stop the Pixi ticker here. If navigation is cancelled or the
        // FP URL 404s, a stopped ticker leaves a frozen/black 2D city.
        window.location.href = fpUrl(token);
    }

    function injectStyles() {
        if (document.getElementById('sc-bridge-style')) return;
        document.documentElement.classList.add('sc-integrated');
        var s = document.createElement('style');
        s.id = 'sc-bridge-style';
        // Compact the whole control bar slightly so the injected FP button does
        // not push 🔊 / 🎵 off the right edge on ~1280–1440px laptop widths.
        s.textContent = [
            'html.sc-integrated #ctrlBar .btn{',
            'padding:5px 7px;font-size:9px;gap:4px}',
            'html.sc-integrated #ctrlBar .btn .btn-label{display:none}',
            /* Compact FP control — mode sibling of Holomap, not a hero CTA */
            'html.sc-integrated #ctrlBar .sc-fp-btn{',
            'background:linear-gradient(135deg,#9d174d,#6d28d9)!important;',
            'border-color:rgba(244,114,182,.55)!important;color:#fff!important;',
            'font-weight:700!important;padding:5px 8px!important;font-size:9px!important;',
            'letter-spacing:0;min-width:0}',
            'html.sc-integrated #ctrlBar .sc-fp-btn:hover{filter:brightness(1.08)}',
            /* Music is injected with marginLeft:8px — reclaim a few px */
            'html.sc-integrated #btnMusic{margin-left:4px!important}',
            /* Ensure the horizontal strip can scroll if the viewport is very narrow */
            'html.sc-integrated .ctrls{overflow-x:auto;overflow-y:hidden}',
            'html.sc-integrated .ctrls-scroll{scrollbar-width:thin}'
        ].join('');
        document.head.appendChild(s);
    }

    function injectToolbarButton() {
        var bar = document.getElementById('ctrlBar');
        if (!bar || document.getElementById('btnFirstPerson')) return;
        var btn = document.createElement('button');
        btn.className = 'btn sc-fp-btn';
        btn.id = 'btnFirstPerson';
        btn.type = 'button';
        btn.title = 'Walk the city in first person';
        btn.setAttribute('aria-label', 'First Person');
        // Short label keeps ⚙️ 🔊 🎵 on-screen. Full name lives in the tooltip.
        btn.textContent = '🚶 FP';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof UI !== 'undefined' && UI.uiClick) UI.uiClick();
            goFirstPerson();
        });
        // Prefer near holomap (view-mode cluster)
        var macro = document.getElementById('btnMacro');
        if (macro && macro.parentNode === bar) bar.insertBefore(btn, macro.nextSibling);
        else {
            // Fall back: insert before settings/sound cluster so it stays a "mode"
            var settings = bar.querySelector('button[title="Settings"]') || document.getElementById('btnSound');
            if (settings && settings.parentNode === bar) bar.insertBefore(btn, settings);
            else bar.appendChild(btn);
        }
    }

    /** Remove legacy dual-entry affordances if a cached HTML still had them. */
    function stripLandingFpEntries() {
        var land = document.getElementById('landFirstPerson');
        if (land && land.parentNode) land.parentNode.removeChild(land);
        var chip = document.getElementById('scBridgeChip');
        if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
        // Older banner variants
        var banners = document.querySelectorAll('.sc-bridge-banner');
        for (var i = 0; i < banners.length; i++) {
            if (banners[i].parentNode) banners[i].parentNode.removeChild(banners[i]);
        }
    }

    /**
     * After the city boots, make sure the Pixi canvas is actually drawing.
     * A stuck loader or a ticker that never started presents as a black void
     * with chrome (toolbar/minimap) still visible — the report we got in playtest.
     */
    function ensureCityVisible() {
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            var loader = document.getElementById('sc-loader');
            var gw = document.getElementById('gameWrap');
            var ready = typeof G !== 'undefined' && G.app && G.app.ticker;

            if (ready && gw && gw.classList.contains('active')) {
                // Force-dismiss loader if it got stuck at 100%
                if (loader) {
                    loader.classList.add('hidden');
                    loader.style.display = 'none';
                }
                try {
                    if (G.app.ticker && !G.app.ticker.started) G.app.ticker.start();
                } catch (e) { /* ignore */ }
                // If minimap zone list is empty after boot, rebuild it
                try {
                    var zones = document.getElementById('mmZones');
                    if (zones && zones.children.length === 0 && typeof G.initMinimap === 'function') {
                        G.initMinimap();
                    }
                } catch (e2) { /* ignore */ }
                clearInterval(iv);
                return;
            }
            if (tries > 60) clearInterval(iv); // ~30s
        }, 500);
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
        stripLandingFpEntries();
        injectToolbarButton();
        applyIncomingResume();
        ensureCityVisible();
        // Re-inject toolbar if ctrl bar mounts late; keep stripping landing CTAs
        var n = 0;
        var t = setInterval(function () {
            stripLandingFpEntries();
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
        console.log('[SC Bridge] Integrated 2D→FP bridge ready (toolbar only)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
