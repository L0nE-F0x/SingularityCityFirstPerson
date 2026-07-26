/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PERSISTENCE (v16.5.0 - Extracted from engine.js)
   Mixin providing save/load and worker communication for the game engine.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Persistence = {
    save() {
        const disc = this.models.filter(m => m._src);
        let currentCamX = 0;
        if (typeof Camera !== 'undefined') currentCamX = Camera.targetX;
        else if (this.savedCamX !== undefined) currentCamX = this.savedCamX;

        try {
            localStorage.setItem('sc_data', JSON.stringify({
                apiProvider: this.apiProvider,
                modelId: this.modelId,
                authKey: this.authKey,
                finnhubKey: this.finnhubKey,
                autoScanMin: this.autoScanMin,
                prefs: this.prefs,
                discovered: disc,
                sound: typeof SND !== 'undefined' ? SND.enabled : true,
                achievements: this.achievements,
                camX: currentCamX,
                seasonalVisited: typeof Seasonal !== 'undefined' ? Seasonal._eventsVisited : {}
            }));
        } catch(e) { console.warn('[Persistence] save failed (storage quota?):', e && e.message); }
    },

    load() {
        try {
            const raw = localStorage.getItem('sc_data');
            if (!raw) return;
            const d = JSON.parse(raw);
            if (d.apiProvider) this.apiProvider = d.apiProvider;
            if (d.modelId) this.modelId = d.modelId;
            if (d.authKey) this.authKey = d.authKey;
            if (d.finnhubKey) this.finnhubKey = d.finnhubKey;
            if (d.sound !== undefined && typeof SND !== 'undefined') SND.enabled = d.sound;
            if (d.autoScanMin) this.autoScanMin = d.autoScanMin;
            // Merge saved prefs over defaults so newly-added toggles keep their
            // default when loading an older save.
            if (d.prefs) this.prefs = Object.assign({}, this.prefs, d.prefs);
            if (d.achievements) this.achievements = d.achievements;
            if (d.camX !== undefined) this.savedCamX = d.camX;
            if (d.seasonalVisited && typeof Seasonal !== 'undefined') Seasonal._eventsVisited = d.seasonalVisited;

            if (d.discovered && d.discovered.length) {
                const ids = new Set(this.models.map(m => m.id));
                d.discovered.forEach(m => {
                    if (!ids.has(m.id)) {
                        if (m.benchmarks) BM[m.id] = m.benchmarks;
                        m.lab = this.ensureLabExists(m.lab, m.region);
                        this.models.push(m);
                        ids.add(m.id);
                    }
                });
                if (typeof UI !== 'undefined') UI.addLog(`\ud83d\udcc2 Loaded ${d.discovered.length} discovered models.`);
            }
        } catch(e) { console.warn('[Persistence] load failed (corrupt save?):', e && e.message); }
    },

    saveSettings() {
        this.apiProvider = document.getElementById('apiProviderSel').value;
        this.modelId = document.getElementById('modelIdInput').value;
        this.authKey = document.getElementById('authKeyInput').value;
        this.finnhubKey = document.getElementById('finnhubKeyInput').value;
        this.autoScanMin = parseInt(document.getElementById('autoScanSel').value) || 0;

        // Experience preference toggles. Helper reads a checkbox if present,
        // otherwise leaves the existing value untouched.
        const chk = (id, cur) => { const el = document.getElementById(id); return el ? el.checked : cur; };
        this.prefs.dailyBrief = chk('prefDailyBrief', this.prefs.dailyBrief);
        this.prefs.newsToasts = chk('prefNewsToasts', this.prefs.newsToasts);
        this.prefs.autoTour   = chk('prefAutoTour',   this.prefs.autoTour);
        this.prefs.weather    = chk('prefWeather',    this.prefs.weather);
        const idleSel = document.getElementById('prefIdleTourMin');
        if (idleSel) this.prefs.idleTourMin = parseInt(idleSel.value) || 5;

        // Accessibility: reduced-motion (explicit override) + UI text scale.
        const rmEl = document.getElementById('prefReduceMotion');
        if (rmEl) this.prefs.reduceMotion = rmEl.checked;
        const scaleEl = document.getElementById('prefUiScale');
        if (scaleEl) this.prefs.uiScale = parseFloat(scaleEl.value) || 1;
        if (typeof this.applyAccessibility === 'function') this.applyAccessibility();

        // Sound prefs mirror the SND layer's own persisted flags.
        if (typeof SND !== 'undefined') {
            const sfxEl = document.getElementById('prefSfx');
            if (sfxEl) SND.enabled = sfxEl.checked;
            const musicEl = document.getElementById('prefMusic');
            if (musicEl && SND.musicEnabled !== musicEl.checked) SND.toggleMusic();
            this.prefs.sfx = SND.enabled;
            this.prefs.music = SND.musicEnabled;
            if (typeof UI !== 'undefined' && UI.updateSoundBtn) UI.updateSoundBtn();
        }

        this.save();
        this.startAutoScan();
        document.getElementById('settingsOv').classList.remove('open');
        if (this.authKey && typeof API !== 'undefined') API.doScan();
    },

    startAutoScan() {
        if (this.autoScanId) clearInterval(this.autoScanId);
        if (this.autoScanMin > 0 && this.authKey) {
            this.autoScanId = setInterval(() => { if(typeof API !== 'undefined') API.doScan(); }, this.autoScanMin * 60000);
            if (typeof UI !== 'undefined') UI.addLog(`\ud83d\udd04 Auto-scan: every ${this.autoScanMin}m`);
        }
    },

    _postToWorker() {
        if (!this._computeWorker) return;
        try {
            const models = [];
            for (let i = 0; i < this.models.length; i++) {
                const m = this.models[i];
                models.push({ id: m.id, lab: m.lab, name: m.name, ret: m.ret, os: m.os, phase: m.phase, _src: m._src });
            }
            const labRegions = {};
            for (const k in LABS) if (LABS[k]) labRegions[k] = LABS[k].region || 'eu';
            this._computeWorker.postMessage({
                type: 'crunch',
                payload: { models, benchmarks: (typeof BM !== 'undefined' ? BM : {}), costs: (typeof COSTS !== 'undefined' ? COSTS : {}), labRegions }
            });
        } catch(ex) { /* serialization failed — will use inline fallback */ }
    }
};
