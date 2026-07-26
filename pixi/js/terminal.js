/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (v4.0 — Phase 4: Visual Dashboard)
   A Bloomberg-inspired data dashboard that runs alongside the PixiJS pixel-art city. Same sim,
   no art. For users who want the data without the toy.

   Phase 4 changes:
     • Auto-boot only on explicit ?mode=terminal (no localStorage preference)
     • Comprehensive city-HUD hide list (Kardashev speedometer, reactions, zoom pill, scan log)
     • Fixed citizen count + K-scale data sources (NPCHousing.REGISTRY + Kardashev.score)
     • Fixed population panel data source
     • Default labs sort: ELO desc (apex first, obscure labs sink)
     • Dense 12×8 grid — 96 cells, no empty space
     • SVG chart primitives: sparkline, donut, pentagon radar, semicircular gauge
     • History ring buffers for time-series visualisations
     • Panels rebuilt with charts: donuts (POWER, COMPUTE, POPULATION), radar (KARDASHEV),
       gauge (AGENTS), sparklines (ROBOTICS, LONGEVITY, SUPPLY, AGENTS)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Terminal = {
    isOpen: false,
    _built: false,
    _pendingOpen: false,
    _loopTimer: null,
    _initialized: false,

    // Per-panel state
    _labsSort: { col: 'elo', dir: 'desc' },
    _sigCache: {},          // Panel-id → last-rendered signature (cheap change-detection)

    // Interactive filters (click a legend dot / row to highlight a slice; click again clears)
    _filter: { compute: null, power: null, population: null, labs: null, supply: null, kardashev: null },

    // Hover tooltip — single DOM node reused across every [data-tip] element
    _tip: null,

    // History ring buffers for sparklines (64 samples × 250ms = 16s window)
    _HISTORY_MAX: 64,
    _history: {
        supply_mw: [], demand_mw: [],
        dc_total_mw: [],
        robotics_units: [],
        longevity_compounds: [], longevity_trials: [], longevity_genomes: [],
        agents_active: [], agents_tasks: [], agents_errors: [],
        kardashev_score: [],
        supply_gpu: [], supply_hbm: []
    },

    _pushHistory(key, val) {
        const h = this._history[key];
        if (!h) return;
        h.push(val);
        if (h.length > this._HISTORY_MAX) h.shift();
    },

    _captureHistory() {
        try {
            if (typeof PowerZone !== 'undefined') {
                if (typeof PowerZone.getTotalSupply === 'function')
                    this._pushHistory('supply_mw', PowerZone.getTotalSupply() || 0);
                if (typeof PowerZone.getTotalDemand === 'function')
                    this._pushHistory('demand_mw', PowerZone.getTotalDemand() || 0);
            }
            if (typeof DC_FACILITIES !== 'undefined' && Array.isArray(DC_FACILITIES)) {
                const mw = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type !== 'chipfab')
                    .reduce((s, d) => s + (d.power_mw || 0), 0);
                this._pushHistory('dc_total_mw', mw);
            }
            if (typeof RoboticsZone !== 'undefined')
                this._pushHistory('robotics_units', RoboticsZone.unitsProduced || 0);
            if (typeof LongevityZone !== 'undefined') {
                this._pushHistory('longevity_compounds', LongevityZone.compoundsScreened || 0);
                this._pushHistory('longevity_trials', LongevityZone.trialsActive || 0);
                this._pushHistory('longevity_genomes', LongevityZone.genomesSequenced || 0);
            }
            if (typeof AgentsZone !== 'undefined' && AgentsZone.agentStats) {
                const s = AgentsZone.agentStats;
                this._pushHistory('agents_active', s.activeAgents || 0);
                this._pushHistory('agents_tasks', s.tasksPerHour || 0);
                this._pushHistory('agents_errors', s.errorRate || 0);
            }
            if (typeof Kardashev !== 'undefined' && typeof Kardashev.score === 'number') {
                this._pushHistory('kardashev_score', Kardashev.score);
            }
            if (typeof SupplyChain !== 'undefined' && SupplyChain.inventory) {
                const inv = SupplyChain.inventory;
                const gpuStock = (inv.gpu_h100 && inv.gpu_h100.stock || 0) + (inv.gpu_b200 && inv.gpu_b200.stock || 0);
                this._pushHistory('supply_gpu', gpuStock);
                this._pushHistory('supply_hbm', (inv.hbm_memory && inv.hbm_memory.stock) || 0);
            }
        } catch (e) {}
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PERSISTED HISTORY — the Terminal's memory.
    // The 16s ring buffers above are for live motion. This layer persists a coarse series per
    // metric to localStorage so charts span the whole session AND prior sessions, and we can show
    // real deltas (Δ vs 24h) and all-time highs. A daily Supabase snapshot (netlify/functions/
    // snapshot-metrics.mjs) feeds authoritative global points on top of this when available.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _LH_KEY: 'sc_term_hist_v1',
    _LH_MAX: 720,          // points retained per metric
    _LH_MINGAP: 8000,      // ms between persisted samples per metric
    _longHist: null,
    _lhLast: {},           // metric → last-sample wall time
    _lhDirty: false,
    _lhLastSave: 0,

    _lhLoad() {
        if (this._longHist) return this._longHist;
        let obj = {};
        try { obj = JSON.parse(localStorage.getItem(this._LH_KEY)) || {}; } catch (e) { obj = {}; }
        this._longHist = (obj && typeof obj === 'object') ? obj : {};
        return this._longHist;
    },

    _lhSample(metric, v) {
        if (typeof v !== 'number' || !isFinite(v)) return;
        const now = Date.now();
        if (this._lhLast[metric] && now - this._lhLast[metric] < this._LH_MINGAP) return;
        this._lhLast[metric] = now;
        const lh = this._lhLoad();
        const arr = lh[metric] || (lh[metric] = []);
        // Skip a duplicate value at the tail unless >5min passed (keeps flat series compact).
        const tail = arr[arr.length - 1];
        if (tail && tail.v === v && now - tail.t < 300000) { tail.t = now; this._lhDirty = true; return; }
        arr.push({ t: now, v });
        if (arr.length > this._LH_MAX) arr.shift();
        this._lhDirty = true;
    },

    _lhSave() {
        if (!this._lhDirty || !this._longHist) return;
        try { localStorage.setItem(this._LH_KEY, JSON.stringify(this._longHist)); this._lhDirty = false; } catch (e) {}
    },

    _lhSeries(metric) { return (this._lhLoad()[metric] || []).map(p => p.v); },

    _lhStat(metric) {
        const arr = this._lhLoad()[metric] || [];
        if (!arr.length) return null;
        const first = arr[0], last = arr[arr.length - 1];
        let max = -Infinity, min = Infinity;
        for (const p of arr) { if (p.v > max) max = p.v; if (p.v < min) min = p.v; }
        const dayAgo = last.t - 86400000;
        let ref = first;
        for (const p of arr) { if (p.t <= dayAgo) ref = p; else break; }
        return { first: first.v, last: last.v, min, max, ath: max, atl: min, delta: last.v - ref.v, n: arr.length, spanMs: last.t - first.t };
    },

    // Human span label, e.g. "45s" / "12m" / "3h" / "2d".
    _lhSpan(metric) {
        const arr = this._lhLoad()[metric] || [];
        if (arr.length < 2) return '';
        const s = (arr[arr.length - 1].t - arr[0].t) / 1000;
        if (s < 90) return Math.round(s) + 's';
        if (s < 5400) return Math.round(s / 60) + 'm';
        if (s < 172800) return Math.round(s / 3600) + 'h';
        return Math.round(s / 86400) + 'd';
    },

    // Colored ▲/▼ delta chip from a metric's persisted series.
    _deltaChip(metric, opts = {}) {
        const st = this._lhStat(metric);
        if (!st || st.n < 3) return '';
        const d = st.delta;
        if (!isFinite(d)) return '';
        const up = d > 0, flat = d === 0;
        const cls = flat ? 'tm-delta-flat' : up ? 'tm-delta-up' : 'tm-delta-down';
        let txt;
        if (opts.pct) {
            const base = st.last - d;
            txt = (up ? '+' : '') + (base ? (d / Math.abs(base) * 100) : 0).toFixed(1) + '%';
        } else {
            const f = opts.fmt || ((v) => String(Math.round(v)));
            txt = (up ? '+' : '') + f(d);
        }
        return `<span class="tm-delta ${cls}">${flat ? '±' : up ? '▲' : '▼'} ${txt}</span>`;
    },

    // Sample the real-industry metrics into the persisted series (called from the 4Hz loop).
    _captureLongHistory() {
        try {
            if (typeof G !== 'undefined' && Array.isArray(G.models)) {
                this._lhSample('models', G.models.length);
                const BM_ = (typeof BM !== 'undefined') ? BM : {};
                let topElo = 0, bench = 0;
                for (const m of G.models) {
                    const b = BM_[m.id]; if (!b) continue;
                    if (typeof b.ELO === 'number' && b.ELO > topElo) topElo = b.ELO;
                    const vals = [b.MMLU, b.HumanEval, b.MATH, b.GPQA].filter(v => typeof v === 'number');
                    if (vals.length) { const a = vals.reduce((s, x) => s + x, 0) / vals.length; if (a > bench) bench = a; }
                }
                if (topElo > 0) this._lhSample('topElo', topElo);
                if (bench > 0) this._lhSample('benchCeiling', bench);
            }
            if (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY))
                this._lhSample('citizens', NPCHousing.REGISTRY.length);
            if (typeof Kardashev !== 'undefined' && typeof Kardashev.score === 'number')
                this._lhSample('kscore', Kardashev.score);
            if (typeof DC_FACILITIES !== 'undefined' && Array.isArray(DC_FACILITIES)) {
                const mw = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type !== 'chipfab')
                    .reduce((s, d) => s + (d.power_mw || 0), 0);
                this._lhSample('computeMW', mw);
            }
            const now = Date.now();
            if (now - this._lhLastSave > 20000) { this._lhSave(); this._lhLastSave = now; }
        } catch (e) {}
    },

    // Merge the always-on daily cloud snapshot (sc_metrics_history) on top of local samples.
    // Stored under cloud_* keys so the daily cadence never mixes with fine per-session points;
    // drill-down charts prefer these authoritative daily series. Silent no-op if the table
    // hasn't been provisioned yet (sc_metrics_history_schema.sql).
    _lhCloudFetched: false,
    _lhFetchCloud() {
        try {
            if (this._lhCloudFetched) return;
            if (typeof API === 'undefined' || !API.supabase) return;
            this._lhCloudFetched = true;
            API.supabase.from('sc_metrics_history').select('*').order('day', { ascending: true })
                .then(({ data, error }) => {
                    if (error || !Array.isArray(data) || !data.length) return;
                    const lh = this._lhLoad();
                    const map = { models: 'models', active_models: 'active_models', labs: 'labs', top_elo: 'topElo', bench_ceiling: 'benchCeiling' };
                    for (const col in map) {
                        const arr = [];
                        for (const row of data) {
                            const v = row[col];
                            if (typeof v === 'number' && isFinite(v)) arr.push({ t: new Date(row.day + 'T12:00:00Z').getTime(), v });
                        }
                        if (arr.length) lh['cloud_' + map[col]] = arr;
                    }
                    this._lhDirty = true; this._lhSave();
                })
                .catch(() => {});
        } catch (e) {}
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // INIT + LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // D hotkey — toggles terminal/city without stealing focus from form fields or modals
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.target && e.target.isContentEditable) return;
            if (e.key !== 'd' && e.key !== 'D') return;
            const ov = document.querySelector('.ov.open, .modal.open');
            if (ov) return;
            e.preventDefault();
            this.toggle();
        });

        // Defensive: strip any stale ?mode=terminal from the URL. Previously the URL
        // was pinned while Terminal was open, so closing the tab stranded the param
        // and auto-booted Terminal on every subsequent visit. We no longer auto-boot
        // from URL at all — the landing page ALWAYS shows so the user can choose.
        try {
            const p = new URLSearchParams(window.location.search);
            if (p.has('mode')) {
                p.delete('mode');
                const q = p.toString();
                const newUrl = window.location.pathname + (q ? '?' + q : '') + window.location.hash;
                window.history.replaceState(null, '', newUrl);
            }
        } catch (e) {}

        // Defensive: clear any stale preference key from the pre-Phase-4 version.
        try { localStorage.removeItem('sc_terminal_pref'); } catch (e) {}

        // Flush the persisted history series when the tab closes.
        window.addEventListener('beforeunload', () => this._lhSave());

        // No auto-bootstrap. Terminal opens only when the user clicks the landing
        // button or presses D after entering the city.
    },

    tryAutoOpen() {
        if (this._pendingOpen) {
            this._pendingOpen = false;
            this.open();
        }
    },

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        document.body.classList.add('terminal-mode');
        this._buildShell();
        this._startUpdateLoop();
        this._pauseCityRender();   // stop drawing the pixel-art city nobody's looking at
        this._lhFetchCloud();      // pull the always-on daily snapshot, if provisioned
        // Mute SFX & ambient while in Terminal; soundtrack stays on.
        if (typeof SND !== 'undefined' && SND.setContextMute) SND.setContextMute(true);
        // NOTE: We no longer pin ?mode=terminal to the URL while Terminal is open.
        // Doing so used to mean that closing the tab stranded the param in the
        // address bar, and the next visit auto-booted Terminal before the user
        // could choose. The param is consumed once on init() and never re-emitted.
    },

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('terminal-mode');
        this._hideTip();
        this._cmdClose();
        this._lhSave();            // flush persisted history
        if (this._loopTimer) { clearInterval(this._loopTimer); this._loopTimer = null; } // stop the 4Hz tick
        this._resumeCityRender();  // hand rendering back to the city
        if (typeof SND !== 'undefined' && SND.setContextMute) SND.setContextMute(false);
        // Defensive — strip ?mode=terminal if anything put it back.
        this._syncUrl(false);
    },

    toggle() { if (this.isOpen) this.close(); else this.open(); },

    _syncUrl(terminalOn) {
        try {
            const url = new URL(window.location.href);
            // We only ever clear the param now. Never set it.
            url.searchParams.delete('mode');
            window.history.replaceState(null, '', url);
        } catch (e) {}
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // SHELL — 12×8 grid, 96 cells, no empty space.
    // cols/rows per panel let us fill the grid exactly.
    //
    //   Row 1-2: [LABS 6×2]        [NEWS 3×2]     [EVENTS 3×2]
    //   Row 3-4: [ALIGN 3×2]       [EMBASSY 4×2]  [KARDASHEV 5×2]
    //   Row 5:   [COMPUTE 6×1]     [CAPITAL 6×1]
    //   Row 6-7: [POWER 4×2]       [SUPPLY 4×2]   [AGENTS 4×2]
    //   Row 8:   [POPULATION 4×1]  [ROBOTICS 4×1] [LONGEVITY 4×1]
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    PANELS: [
        { id: 'labs',       title: 'AI LABS',           cols: 6, rows: 2, live: true, hint: 'Sortable table — ELO, compute, valuation, flagship' },
        { id: 'news',       title: 'LIVE NEWS',         cols: 6, rows: 2, live: true, hint: 'Hacker News + tech headlines' },
        { id: 'alignment',  title: 'ALIGNMENT',         cols: 3, rows: 2, live: true, hint: 'Five orgs — focus, lead, location' },
        { id: 'embassy',    title: 'EMBASSY RELATIONS', cols: 4, rows: 2, live: true, hint: '6×6 bilateral matrix' },
        { id: 'kardashev',  title: 'KARDASHEV',         cols: 5, rows: 2, live: true, hint: 'K-scale + 5-pillar radar' },
        { id: 'compute',    title: 'COMPUTE INFRA',     cols: 6, rows: 1, live: true, hint: 'MW capacity · operator donut · trend' },
        { id: 'capital',    title: 'THE TAPE',          cols: 6, rows: 1, live: true, hint: 'Fused wire — news · deals · launches · rulings' },
        { id: 'power',      title: 'POWER GRID',        cols: 4, rows: 2, live: true, hint: 'Source donut · demand trend' },
        { id: 'supply',     title: 'SUPPLY CHAIN',      cols: 4, rows: 2, live: true, hint: 'Inventory bars · bottlenecks' },
        { id: 'agents',     title: 'AGENTS',            cols: 4, rows: 2, live: true, hint: 'Active · error gauge · task trend' },
        { id: 'population', title: 'POPULATION',        cols: 4, rows: 1, live: true, hint: 'NPC count · workplace donut' },
        { id: 'robotics',   title: 'ROBOTICS',          cols: 4, rows: 1, live: true, hint: 'Units · capability curve' },
        { id: 'longevity',  title: 'LONGEVITY',         cols: 4, rows: 1, live: true, hint: 'Compound / trial / genome trends' }
    ],

    _buildShell() {
        if (this._built) return;
        this._built = true;
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        const tag = (p) => p.live
            ? '<span class="tm-panel-live"><span class="tm-live-dot"></span>LIVE</span>'
            : `<span class="tm-panel-tag">${p.phase || ''}</span>`;

        const body = (p) => p.live
            ? `<div class="tm-panel-body tm-body-${p.id}" id="tm-body-${p.id}"></div>`
            : `<div class="tm-panel-body"><div class="tm-placeholder"><div class="tm-placeholder-grid"></div><div class="tm-placeholder-hint">${p.hint}</div></div></div>`;

        const panelsHtml = this.PANELS.map(p => {
            const style = `grid-column: span ${p.cols}; grid-row: span ${p.rows};`;
            const infoTip = this._tipAttr(
                `<div class="tm-tip-hd">${this._esc(p.title)}</div>` +
                `<div class="tm-tip-body">${this._esc(p.hint || '')}</div>`
            );
            return `
                <div class="tm-panel${p.live ? ' tm-panel-live-on' : ''}" data-panel="${p.id}" style="${style}">
                    <div class="tm-panel-h">
                        <span class="tm-panel-title">${p.title}</span>
                        <span class="tm-panel-info" data-tip="${infoTip}">i</span>
                        ${tag(p)}
                    </div>
                    ${body(p)}
                </div>
            `;
        }).join('');

        shell.innerHTML = `
            <div class="tm-topbar">
                <div class="tm-logo">
                    <span class="tm-logo-dot"></span>
                    <span class="tm-logo-main">SINGULARITY</span>
                    <span class="tm-logo-suf">⟫ TERMINAL</span>
                </div>
                <div class="tm-status" id="tm-status">
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Sim tick</div><div class=&quot;tm-tip-body&quot;>60 ticks per in-game day. Advances while city runs behind shell.</div>')}"><span class="tm-lbl">TICK</span><span class="tm-val" id="tm-tick">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Citizens</div><div class=&quot;tm-tip-body&quot;>Total NPCs in housing registry. Each has a home, workplace, and schedule.</div>')}"><span class="tm-lbl">CITIZENS</span><span class="tm-val" id="tm-citizens">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Buildings</div><div class=&quot;tm-tip-body&quot;>All structures placed across city + space zones.</div>')}"><span class="tm-lbl">BLDS</span><span class="tm-val" id="tm-buildings">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Kardashev score</div><div class=&quot;tm-tip-body&quot;>Civilizational energy-mastery index. Earth today ≈ 0.73. K = 1.0 is Type I.</div>')}"><span class="tm-lbl">K-SCALE</span><span class="tm-val" id="tm-kardashev">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Sim step rate</div><div class=&quot;tm-tip-body&quot;>City render is PAUSED in Terminal — no pixel art is drawn. The sim keeps advancing behind the shell; this is its step rate in Hz.</div>')}"><span class="tm-lbl">SIM</span><span class="tm-val" id="tm-fps">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Wall clock</div><div class=&quot;tm-tip-body&quot;>Real-world UTC time.</div>')}"><span class="tm-lbl">UTC</span><span class="tm-val" id="tm-clock">—</span></span>
                </div>
                <div class="tm-topbar-right">
                    <button class="tm-cta-btn" onclick="Terminal.close()" title="Switch to pixel-art city view (D)">▶ ENTER CITY</button>
                </div>
            </div>
            <div class="tm-cmdbar">
                <span class="tm-cmd-prompt">&gt;</span>
                <input id="tm-cmd-input" class="tm-cmd-input" type="text" autocomplete="off" spellcheck="false" placeholder="type a lab · model · country · function —  OPENAI · LEAD · CN · POWER    ( press / )" aria-label="Terminal command line" />
                <span class="tm-cmd-hint" id="tm-cmd-hint"><kbd>/</kbd> focus&nbsp;&nbsp;<kbd>&uarr;&darr;</kbd> nav&nbsp;&nbsp;<kbd>&crarr;</kbd> go&nbsp;&nbsp;<kbd>esc</kbd> clear</span>
                <div class="tm-cmd-dropdown" id="tm-cmd-dropdown" style="display:none"></div>
            </div>
            <div class="tm-watchbar" id="tm-watchbar" style="display:none"></div>
            <div class="tm-grid">${panelsHtml}</div>
            <div id="tm-detail" class="tm-detail" style="display:none"></div>
            <div class="tm-tape-strip" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>The tape</div><div class=&quot;tm-tip-body&quot;>Fused wire — news, deals, launches, rulings. Hover to pause.</div>')}"><div class="tm-tape-track" id="tm-tape-track"></div></div>
            <div class="tm-footer">
                <span class="tm-foot-chunk"><kbd>D</kbd> toggle city / terminal</span>
                <span class="tm-foot-chunk tm-foot-mid">command line · persisted charts · drill-downs · fused tape</span>
                <span class="tm-foot-chunk" id="tm-version">—</span>
            </div>
            <div class="tm-toasts" id="tm-toasts"></div>
        `;

        // Version badge
        const v = document.getElementById('tm-version');
        if (v) {
            const ver = (typeof G !== 'undefined' && G.VERSION) ? G.VERSION : '';
            v.textContent = ver ? ('v' + ver) : '';
        }

        this._bindInteractions();
        this._bindCommandBar();
        this._renderWatchbar();
        this._renderAlignment(); // Static — rendered once on build
    },

    _bindInteractions() {
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        // ── Click: labs header sort + data-action dispatch ──
        shell.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-col]');
            if (th) {
                const col = th.dataset.col;
                if (this._labsSort.col === col) {
                    this._labsSort.dir = this._labsSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._labsSort.col = col;
                    this._labsSort.dir = (col === 'name' || col === 'region') ? 'asc' : 'desc';
                }
                this._sigCache.labs = null;
                this._renderLabs();
                return;
            }
            const actEl = e.target.closest('[data-action]');
            if (actEl) {
                // Don't hijack real anchor links — let the browser follow them.
                const a = e.target.closest('a[href]');
                if (a && a.getAttribute('href')) return;
                e.preventDefault();
                this._onAction(actEl.getAttribute('data-action'));
            }
        });

        // ── Hover: delegated tooltip via [data-tip] ──
        shell.addEventListener('pointermove', (e) => {
            const tipEl = e.target.closest && e.target.closest('[data-tip]');
            if (!tipEl) { this._hideTip(); return; }
            this._showTip(tipEl.getAttribute('data-tip'), e.clientX, e.clientY);
        });
        shell.addEventListener('pointerleave', () => this._hideTip());
        // Hide on scroll — prevents stale tooltip when the grid scrolls
        shell.addEventListener('scroll', () => this._hideTip(), true);
        // Global safety: hide if terminal closes
        window.addEventListener('blur', () => this._hideTip());
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // SVG CHART PRIMITIVES
    // All helpers return an inline SVG string ready to drop into innerHTML.
    // No dependencies, CSS-stylable, scales cleanly.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _svgSpark(vals, opts = {}) {
        const w = opts.w || 120;
        const h = opts.h || 32;
        const color = opts.color || '#22d3ee';
        const fill = opts.fill !== false;
        if (!vals || vals.length < 2) {
            return `<svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" class="tm-spark-empty">—</text></svg>`;
        }
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = (max - min) || Math.abs(max) || 1;
        const stepX = w / (vals.length - 1);
        const y = (v) => h - ((v - min) / range) * (h - 6) - 3;
        const points = vals.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const areaPoints = `0,${h} ${points} ${w},${h}`;
        const lastX = (vals.length - 1) * stepX;
        const lastY = y(vals[vals.length - 1]);
        return `
            <svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                ${fill ? `<polygon points="${areaPoints}" fill="${color}" opacity="0.14"/>` : ''}
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.2" fill="${color}" style="filter:drop-shadow(0 0 3px ${color})"/>
            </svg>
        `;
    },

    _svgDonut(segments, opts = {}) {
        const size = opts.size || 80;
        const thick = opts.thick || 12;
        const cx = size / 2, cy = size / 2;
        const r = (size - thick) / 2 - 1;
        const c = 2 * Math.PI * r;
        const total = segments.reduce((s, x) => s + (x.value || 0), 0);
        if (total <= 0) {
            return `<svg class="tm-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#14142a" stroke-width="${thick}"/>
            </svg>`;
        }
        let offset = 0;
        const parts = segments.map(seg => {
            const frac = (seg.value || 0) / total;
            const dash = frac * c;
            if (dash <= 0.01) return '';
            const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="${seg.color || '#8a8aa0'}" stroke-width="${thick}"
                stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
                stroke-dashoffset="${(-offset).toFixed(2)}"
                transform="rotate(-90 ${cx} ${cy})"/>`;
            offset += dash;
            return el;
        }).join('');
        const center = opts.center || '';
        const centerSub = opts.centerSub || '';
        return `
            <svg class="tm-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#14142a" stroke-width="${thick}"/>
                ${parts}
                ${center ? `<text x="${cx}" y="${cy + 1}" text-anchor="middle" class="tm-donut-c">${center}</text>` : ''}
                ${centerSub ? `<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="tm-donut-cs">${centerSub}</text>` : ''}
            </svg>
        `;
    },

    _svgRadar(values, opts = {}) {
        const size = opts.size || 140;
        const cx = size / 2, cy = size / 2;
        const pad = opts.pad || 18;
        const r = size / 2 - pad;
        const n = values.length || 1;
        if (n < 3) {
            return `<svg class="tm-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"></svg>`;
        }
        const axisPts = [];
        const ringPts = [[], [], [], []];
        const dataPts = [];
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);
            axisPts.push({
                x: cx + cosA * r, y: cy + sinA * r,
                lx: cx + cosA * (r + 11), ly: cy + sinA * (r + 11),
                label: values[i].label || ''
            });
            const v = Math.max(0, Math.min(1, values[i].value || 0));
            dataPts.push({ x: cx + cosA * r * v, y: cy + sinA * r * v });
            [0.25, 0.5, 0.75, 1.0].forEach((k, ki) => {
                ringPts[ki].push(`${(cx + cosA * r * k).toFixed(1)},${(cy + sinA * r * k).toFixed(1)}`);
            });
        }
        const rings = ringPts.map((pts, i) => {
            const alpha = 0.06 + i * 0.03;
            return `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(138,138,160,${alpha})" stroke-width="0.7"/>`;
        }).join('');
        const axes = axisPts.map(p =>
            `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(138,138,160,0.12)" stroke-width="0.7"/>`
        ).join('');
        const labels = axisPts.map(p =>
            `<text x="${p.lx.toFixed(1)}" y="${p.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="tm-radar-lbl">${p.label}</text>`
        ).join('');
        const polyPts = dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const poly = `<polygon points="${polyPts}" fill="rgba(34,211,238,0.22)" stroke="#22d3ee" stroke-width="1.4" style="filter:drop-shadow(0 0 4px rgba(34,211,238,0.4))"/>`;
        const dots = dataPts.map(p =>
            `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="#22d3ee"/>`
        ).join('');
        return `
            <svg class="tm-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                ${rings}${axes}${poly}${dots}${labels}
            </svg>
        `;
    },

    _svgGauge(value, opts = {}) {
        const w = opts.w || 120;
        const h = opts.h || 72;
        const cx = w / 2;
        const cy = h - 10;
        const r = Math.min(w / 2 - 10, h - 18);
        const v = Math.max(0, Math.min(1, value));
        const pt = (a) => ({
            x: cx + Math.cos(a) * r,
            y: cy - Math.sin(a) * r
        });
        const start = pt(Math.PI);   // left
        const end = pt(0);            // right
        const valPt = pt(Math.PI * (1 - v));
        const trackPath = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
        const fillPath = v > 0.001
            ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${valPt.x.toFixed(1)} ${valPt.y.toFixed(1)}`
            : '';
        const color = opts.color || (v < 0.33 ? '#34d399' : v < 0.66 ? '#fbbf24' : '#f87171');
        const label = opts.label || '';
        const sub = opts.sub || '';
        return `
            <svg class="tm-gauge" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
                <path d="${trackPath}" fill="none" stroke="#14142a" stroke-width="9" stroke-linecap="round"/>
                ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${color})"/>` : ''}
                ${label ? `<text x="${cx}" y="${cy - 8}" text-anchor="middle" class="tm-gauge-v" fill="${color}">${label}</text>` : ''}
                ${sub ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" class="tm-gauge-s">${sub}</text>` : ''}
            </svg>
        `;
    },

    // Stacked horizontal bar — [{label, value, color}]
    _svgStackBar(segments, opts = {}) {
        const w = opts.w || 240;
        const h = opts.h || 14;
        const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
        let off = 0;
        const parts = segments.map(seg => {
            const width = (seg.value || 0) / total * w;
            const rect = `<rect x="${off.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="${h}" fill="${seg.color || '#8a8aa0'}"/>`;
            off += width;
            return rect;
        }).join('');
        return `<svg class="tm-stackbar" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${parts}</svg>`;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // TOOLTIP + ACTION SYSTEM
    // Any element with `data-tip="..."` gets a Bloomberg-amber hover tooltip.
    // Any element with `data-action="kind:arg"` fires _onAction on click (cursor:pointer via CSS).
    // Tooltip HTML is already HTML-safe when composed — we only attribute-escape the quotes.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _esc(s) {
        return String(s == null ? '' : s).replace(/[<>&"']/g, c =>
            ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
    },

    // Attribute-safe encoding for composed tooltip HTML (content is assumed already HTML-safe).
    _tipAttr(html) {
        return String(html == null ? '' : html).replace(/"/g, '&quot;');
    },

    _ensureTooltip() {
        if (this._tip && document.body.contains(this._tip)) return this._tip;
        const t = document.createElement('div');
        t.className = 'tm-tooltip';
        t.style.display = 'none';
        document.body.appendChild(t);
        this._tip = t;
        return t;
    },

    _showTip(html, x, y) {
        if (!html) { this._hideTip(); return; }
        const t = this._ensureTooltip();
        t.innerHTML = html;
        t.style.display = 'block';
        // Measure after reflow for edge-aware placement
        t.style.left = '-9999px';
        t.style.top = '0px';
        const r = t.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = x + 14, top = y + 16;
        if (left + r.width > vw - 8)  left = x - r.width - 14;
        if (top  + r.height > vh - 8) top  = y - r.height - 14;
        if (left < 4) left = 4;
        if (top  < 4) top  = 4;
        t.style.left = left + 'px';
        t.style.top  = top + 'px';
    },

    _hideTip() {
        if (this._tip) this._tip.style.display = 'none';
    },

    // Delegated click handler for data-action elements.
    // Format: "kind:arg" — kind ∈ { labs, event, align, filter, embassy, pillar, news, deal }.
    _onAction(raw) {
        if (!raw) return;
        const idx = raw.indexOf(':');
        const kind = idx < 0 ? raw : raw.slice(0, idx);
        const arg  = idx < 0 ? ''  : raw.slice(idx + 1);

        switch (kind) {
            case 'labs': {
                // Toggle label filter on labs table
                this._filter.labs = (this._filter.labs === arg) ? null : arg;
                this._sigCache.labs = null;
                this._renderLabs();
                break;
            }
            case 'filter': {
                // arg = "panel:key" — toggle highlight for a donut/legend segment
                const sep = arg.indexOf(':');
                if (sep < 0) return;
                const panel = arg.slice(0, sep);
                const key   = arg.slice(sep + 1);
                if (!this._filter) this._filter = {};
                this._filter[panel] = (this._filter[panel] === key) ? null : key;
                this._sigCache[panel] = null;  // force re-render
                // Also re-render immediately if the panel has a render method
                const fn = this['_render' + panel.charAt(0).toUpperCase() + panel.slice(1)];
                if (typeof fn === 'function') fn.call(this);
                break;
            }
            case 'embassy': {
                // arg = "a_b" — toggle bilateral focus
                this._filter.embassy = (this._filter.embassy === arg) ? null : arg;
                this._sigCache.embassy = null;
                this._renderEmbassy();
                break;
            }
            case 'pillar': {
                this._filter.kardashev = (this._filter.kardashev === arg) ? null : arg;
                this._sigCache.kardashev = null;
                this._renderKardashev();
                break;
            }
            case 'open': {
                const sep = arg.indexOf(':');
                if (sep < 0) break;
                this.openEntity({ kind: arg.slice(0, sep), id: arg.slice(sep + 1) });
                break;
            }
            case 'closedetail': { this.closeEntity(); break; }
            case 'watch': {
                const sep = arg.indexOf(':');
                if (sep < 0) break;
                this._toggleWatch({ kind: arg.slice(0, sep), id: arg.slice(sep + 1) });
                break;
            }
            // labs-row, align, event: extensibility hooks — reserved but not routed yet
            default: break;
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // CITY RENDER PAUSE — the Terminal shows no pixel art, so stop drawing it.
    // Pixi's ticker drives BOTH G.loop() and the stage render. Stopping the ticker kills the GPU
    // draw of the ~thousands of city sprites; we then pump G.loop() on a light interval so the sim
    // keeps advancing and every panel stays live. Mirrors the proven hidden-tab background pump in
    // engine.js (visibilitychange → setInterval(loop, 500)).
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _cityPaused: false,
    _simPump: null,
    _simSteps: 0,
    _tps: 0,
    _lastTpsAt: 0,

    _pauseCityRender() {
        try {
            if (typeof G === 'undefined' || !G.app || !G.app.ticker) return;
            if (this._cityPaused) return;
            this._cityPaused = true;
            G.app.ticker.stop();                       // halt render + the rAF-driven loop
            this._simSteps = 0;
            this._lastTpsAt = performance.now();
            if (!this._simPump) {
                this._simPump = setInterval(() => {
                    try { if (typeof G !== 'undefined' && typeof G.loop === 'function') G.loop(); } catch (e) {}
                    this._simSteps++;
                }, 100);                                // ~10 Hz sim, zero draw calls
            }
        } catch (e) {}
    },

    _resumeCityRender() {
        try {
            if (this._simPump) { clearInterval(this._simPump); this._simPump = null; }
            if (this._cityPaused && typeof G !== 'undefined' && G.app && G.app.ticker && !G.app.ticker.started) {
                G.app.ticker.start();
            }
        } catch (e) {}
        this._cityPaused = false;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // COMMAND LINE — the Bloomberg ⟨GO⟩ bar.
    // Type a lab, model, country, power source, or a function word and jump/act instantly.
    // `/` (or `:`) focuses it from anywhere; ↑/↓ navigate; ↵ runs; esc clears.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _cmd: { results: [], active: 0, index: null, boundGlobal: false },

    // Static function words. `run` is invoked with `this` = Terminal.
    _cmdFunctions() {
        const P = (id) => () => this._gotoPanel(id, { flash: true });
        const leaderboard = () => {
            this._labsSort = { col: 'elo', dir: 'desc' };
            this._sigCache.labs = null; this._renderLabs();
            this._gotoPanel('labs', { flash: true });
        };
        return [
            { key: 'LEAD',      label: 'LEAD',      sub: 'lab leaderboard · ELO desc',  run: leaderboard },
            { key: 'ELO',       label: 'ELO',       sub: 'sort labs by ELO',            run: leaderboard },
            { key: 'LABS',      label: 'LABS',      sub: 'AI labs league table',        run: P('labs') },
            { key: 'NEWS',      label: 'NEWS',      sub: 'live news wire',              run: P('news') },
            { key: 'TAPE',      label: 'TAPE',      sub: 'the fused wire',              run: P('capital') },
            { key: 'DEALS',     label: 'DEALS',     sub: 'the fused wire',              run: P('capital') },
            { key: 'CAPITAL',   label: 'CAPITAL',   sub: 'the fused wire',              run: P('capital') },
            { key: 'COMPUTE',   label: 'COMPUTE',   sub: 'compute infrastructure',     run: P('compute') },
            { key: 'POWER',     label: 'POWER',     sub: 'power grid',                 run: P('power') },
            { key: 'SUPPLY',    label: 'SUPPLY',    sub: 'supply chain',               run: P('supply') },
            { key: 'AGENTS',    label: 'AGENTS',    sub: 'agent fleet',                run: P('agents') },
            { key: 'ALIGN',     label: 'ALIGN',     sub: 'alignment orgs',             run: P('alignment') },
            { key: 'EMBASSY',   label: 'EMBASSY',   sub: 'embassy relations matrix',   run: P('embassy') },
            { key: 'KARDASHEV', label: 'KARDASHEV', sub: 'Kardashev scale',            run: P('kardashev') },
            { key: 'K',         label: 'K',         sub: 'Kardashev scale',            run: P('kardashev') },
            { key: 'ROBOTICS',  label: 'ROBOTICS',  sub: 'humanoid output',            run: P('robotics') },
            { key: 'LONGEVITY', label: 'LONGEVITY', sub: 'longevity research',         run: P('longevity') },
            { key: 'POP',       label: 'POP',       sub: 'population registry',        run: P('population') },
            { key: 'WATCH',     label: 'WATCH',     sub: 'pin entities from their ★',  run: () => this._toast('Open any lab, model, country or source and hit ☆ WATCH to pin it here.') },
            { key: 'HELP',      label: 'HELP',      sub: 'what can I type here?',      run: () => this._cmdHelp() }
        ];
    },

    _buildCommandIndex() {
        const idx = [];
        for (const f of this._cmdFunctions()) {
            idx.push({ type: 'fn', typeLabel: 'FN', key: f.key, label: f.label, sub: f.sub, color: '#fbbf24', run: f.run });
        }
        try {
            for (const r of this._computeLabRows()) {
                idx.push({
                    type: 'lab', typeLabel: 'LAB', key: r.id, label: r.name, color: r.color,
                    sub: `${r.region} · ${r.models} models · ELO ${r.elo == null ? '—' : Math.round(r.elo)}`,
                    run: () => this.openEntity({ kind: 'lab', id: r.id })
                });
            }
        } catch (e) {}
        try {
            if (typeof G !== 'undefined' && Array.isArray(G.models)) {
                const BM_ = (typeof BM !== 'undefined') ? BM : {};
                G.models
                    .map(m => ({ m, elo: (BM_[m.id] && typeof BM_[m.id].ELO === 'number') ? BM_[m.id].ELO : null }))
                    .filter(x => x.elo != null)
                    .sort((a, b) => b.elo - a.elo)
                    .slice(0, 80)
                    .forEach(({ m, elo }) => {
                        const lab = (typeof LABS !== 'undefined' && LABS[m.lab]) ? LABS[m.lab] : null;
                        idx.push({
                            type: 'model', typeLabel: 'MDL', key: m.id, label: m.name || m.id,
                            color: (lab && lab.color) || '#22d3ee',
                            sub: `${lab ? lab.name : (m.lab || '—')} · ELO ${Math.round(elo)}`,
                            run: () => this.openEntity({ kind: 'model', id: m.id })
                        });
                    });
            }
        } catch (e) {}
        try {
            if (typeof EmbassyRow !== 'undefined' && Array.isArray(EmbassyRow.BLDS)) {
                const names = { us: 'United States', cn: 'China', eu: 'Europe', uk: 'United Kingdom', in: 'India', ae: 'UAE' };
                for (const b of EmbassyRow.BLDS) {
                    const id = String(b.country || '').toLowerCase();
                    if (!id) continue;
                    idx.push({
                        type: 'country', typeLabel: 'GOV', key: id, label: id.toUpperCase(),
                        color: (typeof b.accent === 'number') ? '#' + b.accent.toString(16).padStart(6, '0') : '#60a5fa',
                        sub: names[id] || 'country desk',
                        run: () => this.openEntity({ kind: 'country', id })
                    });
                }
            }
        } catch (e) {}
        try {
            if (typeof PowerZone !== 'undefined' && Array.isArray(PowerZone.SOURCES)) {
                for (const s of PowerZone.SOURCES) {
                    const label = s.name || s.id;
                    idx.push({
                        type: 'source', typeLabel: 'PWR', key: s.id || label, label,
                        color: '#facc15', sub: `${Math.round(s.mw || 0)} MW source`,
                        run: () => { this._filter.power = label; this._sigCache.power = null; this._renderPower(); this._gotoPanel('power', { flash: true }); }
                    });
                }
            }
        } catch (e) {}
        return idx;
    },

    _cmdScore(q, text) {
        if (!q) return 0;
        const t = String(text || '').toLowerCase();
        q = q.toLowerCase();
        if (t === q) return 1000;
        if (t.startsWith(q)) return 800 - (t.length - q.length);
        if (t.split(/[\s_-]/).some(w => w.startsWith(q))) return 600 - t.length;
        const i = t.indexOf(q);
        if (i >= 0) return 400 - i - t.length * 0.1;
        let qi = 0;
        for (let ci = 0; ci < t.length && qi < q.length; ci++) if (t[ci] === q[qi]) qi++;
        if (qi === q.length) return 200 - t.length * 0.1;
        return -1;
    },

    _cmdSearch(query) {
        const q = (query || '').trim();
        const index = this._cmd.index || (this._cmd.index = this._buildCommandIndex());
        if (!q) return index.filter(e => e.type === 'fn').slice(0, 8);
        const typeBoost = { fn: 60, lab: 40, country: 30, source: 20, model: 0 };
        const scored = [];
        for (const e of index) {
            const a = this._cmdScore(q, e.label);
            const b = e.key !== e.label ? this._cmdScore(q, e.key) : -1;
            const best = Math.max(a, b) + (typeBoost[e.type] || 0);
            if (Math.max(a, b) > 0) scored.push({ e, s: best });
        }
        scored.sort((x, y) => y.s - x.s);
        return scored.slice(0, 9).map(x => x.e);
    },

    _bindCommandBar() {
        const input = document.getElementById('tm-cmd-input');
        const dd = document.getElementById('tm-cmd-dropdown');
        if (!input || !dd) return;

        input.addEventListener('focus', () => { this._cmd.index = this._buildCommandIndex(); this._cmdUpdate(); });
        input.addEventListener('input', () => this._cmdUpdate());
        input.addEventListener('keydown', (e) => {
            const n = this._cmd.results.length;
            if (e.key === 'ArrowDown') { e.preventDefault(); this._cmd.active = n ? (this._cmd.active + 1) % n : 0; this._cmdPaint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this._cmd.active = n ? (this._cmd.active - 1 + n) % n : 0; this._cmdPaint(); }
            else if (e.key === 'Enter') { e.preventDefault(); this._cmdRun(this._cmd.results[this._cmd.active]); }
            else if (e.key === 'Escape') { e.preventDefault(); input.value = ''; input.blur(); this._cmdClose(); }
        });
        input.addEventListener('blur', () => { setTimeout(() => this._cmdClose(), 130); });

        dd.addEventListener('mousedown', (e) => {
            const row = e.target.closest('[data-cmd-idx]');
            if (!row) return;
            e.preventDefault();                                   // keep focus off the blur race
            this._cmdRun(this._cmd.results[parseInt(row.getAttribute('data-cmd-idx'), 10)]);
        });

        if (!this._cmd.boundGlobal) {
            this._cmd.boundGlobal = true;
            window.addEventListener('keydown', (e) => {
                if (!this.isOpen) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                const tag = (e.target && e.target.tagName) || '';
                if (e.key === 'Escape' && this._detail) { e.preventDefault(); this.closeEntity(); return; }
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (e.key === '/' || e.key === ':') { e.preventDefault(); const el = document.getElementById('tm-cmd-input'); if (el) el.focus(); }
            });
        }
    },

    _cmdUpdate() {
        const input = document.getElementById('tm-cmd-input');
        if (!input) return;
        this._cmd.results = this._cmdSearch(input.value);
        this._cmd.active = 0;
        this._cmdPaint();
    },

    _cmdPaint() {
        const dd = document.getElementById('tm-cmd-dropdown');
        if (!dd) return;
        const rs = this._cmd.results;
        if (!rs || !rs.length) { dd.style.display = 'none'; return; }
        const esc = (s) => this._esc(s);
        dd.innerHTML = rs.map((e, i) => `
            <div class="tm-cmd-item${i === this._cmd.active ? ' active' : ''}" data-cmd-idx="${i}">
                <span class="tm-cmd-type tm-cmd-type-${e.type}">${esc(e.typeLabel)}</span>
                <span class="tm-cmd-dot" style="background:${esc(e.color || '#8a8aa0')}"></span>
                <span class="tm-cmd-label">${esc(e.label)}</span>
                <span class="tm-cmd-sub">${esc(e.sub || '')}</span>
            </div>
        `).join('');
        dd.style.display = 'block';
    },

    _cmdRun(entry) {
        const input = document.getElementById('tm-cmd-input');
        if (entry) { try { if (typeof entry.run === 'function') entry.run.call(this); } catch (e) {} }
        if (input) { input.value = ''; input.blur(); }
        this._cmdClose();
    },

    _cmdClose() {
        const dd = document.getElementById('tm-cmd-dropdown');
        if (dd) dd.style.display = 'none';
    },

    _cmdHelp() {
        const hint = document.getElementById('tm-cmd-hint');
        if (hint) { hint.classList.add('tm-cmd-hint-flash'); setTimeout(() => hint.classList.remove('tm-cmd-hint-flash'), 1400); }
    },

    // Smooth-scroll a panel into view and flash its border amber.
    _gotoPanel(id, opts = {}) {
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;
        const panel = shell.querySelector(`[data-panel="${id}"]`);
        if (!panel) return;
        try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { try { panel.scrollIntoView(); } catch (e2) {} }
        if (opts.flash) {
            panel.classList.remove('tm-panel-flash');
            void panel.offsetWidth;                                // reflow so the animation restarts
            panel.classList.add('tm-panel-flash');
            setTimeout(() => panel.classList.remove('tm-panel-flash'), 1500);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // DRILL-DOWN ENTITY PAGES — full-shell takeover for a lab / model / country / power source.
    // Reached from the command line and from clicking a lab row. Esc backs out.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _detail: null,

    openEntity(ref) {
        if (!ref || !ref.kind) return;
        let html = null;
        try {
            if (ref.kind === 'lab') html = this._detailLab(ref.id);
            else if (ref.kind === 'model') html = this._detailModel(ref.id);
            else if (ref.kind === 'country') html = this._detailCountry(ref.id);
            else if (ref.kind === 'source') html = this._detailSource(ref.id);
        } catch (e) { html = null; }
        const host = document.getElementById('tm-detail');
        if (!host) return;
        if (!html) {   // couldn't build a page — fall back to navigate-and-flash
            if (ref.kind === 'source') this._gotoPanel('power', { flash: true });
            else if (ref.kind === 'country') { this._filter.embassy = ref.id; this._sigCache.embassy = null; this._renderEmbassy(); this._gotoPanel('embassy', { flash: true }); }
            else this._gotoPanel('labs', { flash: true });
            return;
        }
        this._detail = ref;
        host.innerHTML = html;
        host.style.display = 'block';
        host.scrollTop = 0;
    },

    closeEntity() {
        this._detail = null;
        const host = document.getElementById('tm-detail');
        if (host) { host.style.display = 'none'; host.innerHTML = ''; }
    },

    _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; },
    _yearsSince(d) {
        if (!d) return null;
        const t = Date.parse(d); if (isNaN(t)) return null;
        return (Date.now() - t) / (365.25 * 86400000);
    },

    // Match a free-text term against the live news + HN wires.
    _newsMentions(term, max = 6) {
        const t = String(term || '').toLowerCase().trim();
        if (t.length < 2) return [];
        const out = [], seen = new Set();
        const push = (title, url, src) => {
            if (!title) return;
            const tl = title.toLowerCase();
            if (!tl.includes(t) || seen.has(tl)) return;
            seen.add(tl); out.push({ title, url, src });
        };
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories)) HNBlimps._stories.forEach(s => s && push(s.title, s.url, 'HN'));
        if (typeof API !== 'undefined' && Array.isArray(API.liveNews)) API.liveNews.forEach(n => n && push(n.headline || n.title, n.url, n.source || 'NEWS'));
        return out.slice(0, max);
    },

    _dChrome(o) {
        const esc = (s) => this._esc(s);
        const chips = (o.chips || []).filter(Boolean).map(c =>
            `<span class="tm-d-chip"${c.action ? ` data-action="${esc(c.action)}"` : ''}${c.tip ? ` data-tip="${this._tipAttr(c.tip)}"` : ''}>` +
            `<span class="tm-d-chip-k">${esc(c.k)}</span><span class="tm-d-chip-v"${c.color ? ` style="color:${esc(c.color)}"` : ''}>${c.v == null ? '—' : c.v}</span></span>`
        ).join('');
        return `
            <div class="tm-d-wrap">
                <div class="tm-d-head">
                    <button class="tm-d-back" data-action="closedetail" data-tip="${this._tipAttr('Back to dashboard · esc')}">&larr; BACK</button>
                    <span class="tm-cmd-type tm-cmd-type-${esc(o.type)}">${esc(o.typeLabel || o.type)}</span>
                    <span class="tm-d-dot" style="background:${esc(o.color || '#8a8aa0')}"></span>
                    <span class="tm-d-title" style="color:${esc(o.color || '#e8e8f0')}">${esc(o.title)}</span>
                    ${o.crown ? '<span class="tm-apex" data-tip="' + this._tipAttr('<b>Apex lab</b><br/>Holds a benchmark crown') + '">♕</span>' : ''}
                    ${o.watchRef ? `<button class="tm-d-watch${this._isWatched(o.watchRef) ? ' on' : ''}" data-action="watch:${esc(o.watchRef.kind)}:${esc(o.watchRef.id)}" data-tip="${this._tipAttr(this._isWatched(o.watchRef) ? 'Unpin from watchlist' : 'Pin to watchlist')}">${this._isWatched(o.watchRef) ? '★ WATCHING' : '☆ WATCH'}</button>` : ''}
                    ${o.sub ? `<span class="tm-d-sub">${esc(o.sub)}</span>` : ''}
                </div>
                ${chips ? `<div class="tm-d-chips">${chips}</div>` : ''}
                <div class="tm-d-body">${o.body}</div>
            </div>`;
    },

    _dSection(title, inner, span) {
        return `<div class="tm-d-sec${span ? ' tm-d-sec-span' : ''}"><div class="tm-d-sec-h">${this._esc(title)}</div><div class="tm-d-sec-b">${inner}</div></div>`;
    },

    _dNews(term) {
        const news = this._newsMentions(term, 6);
        if (!news.length) return `<div class="tm-empty">No recent mentions on the wire</div>`;
        const esc = (s) => this._esc(s);
        return news.map(n => {
            const url = n.url ? ` href="${safeHref(n.url)}" target="_blank" rel="noopener"` : '';
            const src = String(n.src).toUpperCase().replace(/\s+/g, '');
            return `<div class="tm-d-news-item"><span class="tm-news-source ${n.src === 'HN' ? 'tm-tag-hn' : 'tm-tag-news'}">${esc(src)}</span><a class="tm-news-title"${url}>${esc(n.title)}</a></div>`;
        }).join('');
    },

    _benchRadar(bm) {
        const g = (k) => this._num(bm && bm[k]);
        const axes = [
            { label: 'MMLU', v: g('MMLU') }, { label: 'GPQA', v: g('GPQA') }, { label: 'MATH', v: g('MATH') },
            { label: 'CODE', v: g('HumanEval') != null ? g('HumanEval') : g('HUMANEVAL') }, { label: 'ARC', v: g('ARC') }
        ].filter(a => a.v != null);
        if (axes.length < 3) return '';
        return this._svgRadar(axes.map(a => ({ label: a.label, value: a.v / 100 })), { size: 168, pad: 26 });
    },

    _detailLab(id) {
        const lab = (typeof LABS !== 'undefined') ? LABS[id] : null;
        if (!lab) return null;
        const esc = (s) => this._esc(s);
        const color = lab.color || '#8a8aa0';
        const BM_ = (typeof BM !== 'undefined') ? BM : {};
        const models = (typeof G !== 'undefined' && Array.isArray(G.models)) ? G.models.filter(m => m.lab === id) : [];
        let topElo = null, flagship = null, scoreSum = 0, scoreN = 0;
        const rows = models.map(m => {
            const b = BM_[m.id] || {};
            const vals = [b.MMLU, b.HumanEval || b.HUMANEVAL, b.MATH, b.GPQA].map(v => this._num(v)).filter(v => v != null);
            const avg = vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : null;
            if (avg != null) { scoreSum += avg; scoreN++; }
            const elo = this._num(b.ELO);
            if (elo != null && (topElo == null || elo > topElo)) { topElo = elo; }
            return { m, elo, avg, phase: m.phase, rel: m.rel };
        }).sort((a, b) => (b.avg || 0) - (a.avg || 0) || (b.elo || 0) - (a.elo || 0));
        flagship = rows.length ? rows[0].m : null;   // best by benchmark avg (ELO is sparse/stale)
        const avgScore = scoreN ? scoreSum / scoreN : null;
        const region = (lab.region || '?').toUpperCase();
        const regionName = { US: 'United States', EU: 'Europe', CN: 'China', UK: 'United Kingdom', IN: 'India', AE: 'UAE' }[region] || region;
        const hq = (typeof G !== 'undefined' && G.bldById) ? G.bldById['bld_' + id] : null;
        const apex = !!(hq && hq.isTopLab);

        let hqMW = 0; const hqDCs = [];
        if (typeof DC_FACILITIES !== 'undefined' && Array.isArray(DC_FACILITIES)) {
            DC_FACILITIES.forEach(d => { if (d && d.status === 'operational' && String(d.operator).toLowerCase() === id) { hqMW += d.power_mw || 0; hqDCs.push(d); } });
        }

        const rosterRows = rows.map((r, i) => {
            const pct = r.avg != null ? Math.max(2, Math.min(100, r.avg)) : 0;
            return `
                <tr class="tm-clickable" data-action="open:model:${esc(r.m.id)}" data-tip="${this._tipAttr('<b>' + esc(r.m.name || r.m.id) + '</b><br/>Click for full model page')}">
                    <td class="tm-rank">${i + 1}</td>
                    <td class="tm-lab-name">${esc(r.m.name || r.m.id)}</td>
                    <td class="tm-flagship">${esc(r.phase || '—')}</td>
                    <td class="tm-num">${r.avg != null ? r.avg.toFixed(0) : '—'}</td>
                    <td><div class="tm-d-bar"><div class="tm-d-bar-fill" style="width:${pct}%;background:${color}"></div></div></td>
                    <td class="tm-num tm-elo">${r.elo != null ? Math.round(r.elo) : '—'}</td>
                </tr>`;
        }).join('') || '<tr><td colspan="6" class="tm-empty">No models tracked</td></tr>';

        const radar = flagship ? this._benchRadar(BM_[flagship.id]) : '';
        const computeBody = hqDCs.length
            ? `<div class="tm-d-kv"><span>Operational MW</span><b>${hqMW >= 1000 ? (hqMW / 1000).toFixed(1) + ' GW' : hqMW + ' MW'}</b></div>` +
              hqDCs.slice(0, 6).map(d => `<div class="tm-d-kv"><span>${esc(d.name)}</span><b>${d.power_mw || 0} MW</b></div>`).join('')
            : '<div class="tm-empty">No dedicated facilities tracked</div>';

        const body = `
            <div class="tm-d-grid">
                ${this._dSection('Flagship profile', `
                    <div class="tm-d-flag">
                        ${radar || '<div class="tm-empty">No benchmark data</div>'}
                        <div class="tm-d-flag-meta">
                            <div class="tm-d-flag-name" style="color:${color}">${esc(flagship ? (flagship.name || flagship.id) : '—')}</div>
                            <div class="tm-d-kv"><span>Top ELO</span><b style="color:#22d3ee">${topElo != null ? Math.round(topElo) : '—'}</b></div>
                            <div class="tm-d-kv"><span>Avg score</span><b>${avgScore != null ? avgScore.toFixed(1) : '—'}</b></div>
                            <div class="tm-d-kv"><span>Models</span><b>${models.length}</b></div>
                        </div>
                    </div>`)}
                ${this._dSection('Compute footprint', computeBody)}
                ${this._dSection('Model roster', `
                    <div class="tm-scroll tm-d-roster">
                        <table class="tm-table"><thead><tr>
                            <th class="tm-rank">#</th><th>MODEL</th><th>PHASE</th><th class="tm-num">AVG</th><th>SCORE</th><th class="tm-num">ELO</th>
                        </tr></thead><tbody>${rosterRows}</tbody></table>
                    </div>`, true)}
                ${this._dSection('On the wire', this._dNews(lab.name || id), true)}
            </div>`;

        return this._dChrome({
            body,
            watchRef: { kind: 'lab', id },
            type: 'lab', typeLabel: 'LAB', title: lab.name || id, color, crown: apex,
            sub: lab.desc || '',
            chips: [
                { k: 'REGION', v: esc(regionName) },
                { k: 'MODELS', v: models.length },
                { k: 'AVG', v: avgScore != null ? avgScore.toFixed(0) : '—' },
                { k: 'TOP ELO', v: topElo != null ? Math.round(topElo) : '—', color: '#22d3ee' },
                hqMW ? { k: 'COMPUTE', v: (hqMW >= 1000 ? (hqMW / 1000).toFixed(1) + ' GW' : hqMW + ' MW') } : null
            ]
        });
    },

    _detailModel(id) {
        if (typeof G === 'undefined' || !Array.isArray(G.models)) return null;
        const m = G.models.find(x => x.id === id);
        if (!m) return null;
        const esc = (s) => this._esc(s);
        const BM_ = (typeof BM !== 'undefined') ? BM : {};
        const b = BM_[id] || {};
        const lab = (typeof LABS !== 'undefined' && LABS[m.lab]) ? LABS[m.lab] : null;
        const color = (lab && lab.color) || '#22d3ee';
        const elo = this._num(b.ELO);
        const age = this._yearsSince(m.rel);
        const radar = this._benchRadar(b);

        const benchKeys = [['MMLU', 'MMLU'], ['GPQA', 'GPQA'], ['MATH', 'MATH'], ['HumanEval', 'CODE'], ['ARC', 'ARC'], ['MGSM', 'MGSM']];
        const benchBars = benchKeys.map(([k, lbl]) => {
            const v = this._num(b[k] != null ? b[k] : b[k.toUpperCase()]);
            if (v == null) return '';
            return `<div class="tm-bar-row"><span class="tm-bar-lbl">${lbl}</span><div class="tm-bar-track"><div class="tm-bar-fill" style="width:${Math.max(2, Math.min(100, v))}%;background:${color}"></div></div><span class="tm-bar-val">${v}</span></div>`;
        }).join('') || '<div class="tm-empty">No benchmark data</div>';

        const body = `
            <div class="tm-d-grid">
                ${this._dSection('Benchmark radar', radar || '<div class="tm-empty">No benchmark data</div>')}
                ${this._dSection('Scores', `<div class="tm-bars">${benchBars}</div>`)}
                ${this._dSection('Vitals', `
                    <div class="tm-d-kv"><span>Lab</span><b class="tm-clickable" data-action="open:lab:${esc(m.lab)}" style="color:${color}">${esc(lab ? lab.name : m.lab)} &rsaquo;</b></div>
                    <div class="tm-d-kv"><span>Phase</span><b>${esc(m.phase || '—')}</b></div>
                    <div class="tm-d-kv"><span>Released</span><b>${esc(m.rel || '—')}${age != null ? ` <span class="tm-dim">(${age < 1 ? Math.round(age * 12) + 'mo' : age.toFixed(1) + 'y'})</span>` : ''}</b></div>
                    <div class="tm-d-kv"><span>Weights</span><b>${m.os ? 'Open' : 'Closed'}</b></div>
                    <div class="tm-d-kv"><span>Context</span><b>${m.ctx ? (m.ctx >= 1000 ? (m.ctx / 1000) + 'K' : m.ctx) + ' tok' : '—'}</b></div>
                    <div class="tm-d-kv"><span>Cost in / out</span><b>${m.cost_input != null ? '$' + m.cost_input : '—'} / ${m.cost_out != null ? '$' + m.cost_out : '—'}</b></div>
                    <div class="tm-d-kv"><span>ELO</span><b style="color:#22d3ee">${elo != null ? Math.round(elo) : '—'}</b></div>`)}
                ${this._dSection('On the wire', this._dNews(m.name || id), true)}
            </div>`;

        return this._dChrome({
            body,
            watchRef: { kind: 'model', id },
            type: 'model', typeLabel: 'MDL', title: m.name || id, color,
            sub: m.desc || (lab ? lab.name : ''),
            chips: [
                { k: 'LAB', v: esc(lab ? lab.name : m.lab), color, action: 'open:lab:' + esc(m.lab), tip: 'Open ' + esc(lab ? lab.name : m.lab) + ' →' },
                { k: 'PHASE', v: esc(m.phase || '—') },
                { k: 'ELO', v: elo != null ? Math.round(elo) : '—', color: '#22d3ee' },
                { k: 'WEIGHTS', v: m.os ? 'Open' : 'Closed' }
            ]
        });
    },

    _detailCountry(id) {
        const code = String(id || '').toUpperCase();
        const names = { us: 'United States', cn: 'China', eu: 'Europe', uk: 'United Kingdom', in: 'India', ae: 'UAE' };
        const esc = (s) => this._esc(s);
        const emb = (typeof EmbassyRow !== 'undefined' && Array.isArray(EmbassyRow.BLDS))
            ? EmbassyRow.BLDS.find(b => String(b.country).toLowerCase() === id) : null;
        const accent = emb && typeof emb.accent === 'number' ? '#' + emb.accent.toString(16).padStart(6, '0') : '#60a5fa';

        const rel = this.EMBASSY_RELATIONS;
        const others = ['us', 'cn', 'eu', 'uk', 'in', 'ae'].filter(c => c !== id);
        const getScore = (a, b) => (rel[a + '_' + b] != null ? rel[a + '_' + b] : rel[b + '_' + a] != null ? rel[b + '_' + a] : 50);
        const relLabel = (s) => s >= 75 ? 'Aligned' : s >= 55 ? 'Neutral' : s >= 35 ? 'Tense' : 'Restricted';
        const relColor = (s) => s >= 75 ? '#34d399' : s >= 55 ? '#fbbf24' : s >= 35 ? '#fb923c' : '#f87171';
        const relRows = others.map(o => {
            const s = getScore(id, o);
            return `<div class="tm-d-kv"><span>${esc((names[o] || o))}</span><b style="color:${relColor(s)}">${s} · ${relLabel(s)}</b></div>`;
        }).join('');

        const labsHere = (typeof LABS !== 'undefined')
            ? Object.keys(LABS).filter(k => String(LABS[k].region || '').toLowerCase() === id) : [];
        const labChips = labsHere.length
            ? labsHere.map(k => `<span class="tm-d-tag tm-clickable" data-action="open:lab:${esc(k)}" style="border-color:${esc(LABS[k].color || '#8a8aa0')}">${esc(LABS[k].name || k)}</span>`).join('')
            : '<div class="tm-empty">No tracked labs HQ\'d here</div>';

        const policy = emb ? `
            ${emb.framework ? `<div class="tm-d-kv"><span>Framework</span><b>${esc(emb.framework)}</b></div>` : ''}
            ${emb.regulator ? `<div class="tm-d-kv"><span>Regulator</span><b>${esc(emb.regulator)}</b></div>` : ''}
            ${emb.stance ? `<div class="tm-d-kv"><span>Stance</span><b>${esc(emb.stance)}</b></div>` : ''}
            ${emb.milestone ? `<div class="tm-d-note">${esc(emb.milestone)}</div>` : ''}
            ${emb.desc ? `<div class="tm-d-note tm-dim">${esc(emb.desc)}</div>` : ''}` : '<div class="tm-empty">No policy brief</div>';

        const body = `
            <div class="tm-d-grid">
                ${this._dSection('AI policy desk', policy)}
                ${this._dSection('Bilateral relations', relRows || '<div class="tm-empty">—</div>')}
                ${this._dSection('Labs headquartered here', `<div class="tm-d-tags">${labChips}</div>`, true)}
            </div>`;

        return this._dChrome({
            body,
            watchRef: { kind: 'country', id },
            type: 'country', typeLabel: 'GOV', title: names[id] || code, color: accent,
            sub: emb && emb.framework ? emb.framework : 'National AI desk',
            chips: [
                { k: 'CODE', v: code },
                emb && emb.regulator ? { k: 'REGULATOR', v: esc(emb.regulator) } : null,
                { k: 'LABS', v: labsHere.length }
            ]
        });
    },

    _detailSource(id) {
        if (typeof PowerZone === 'undefined' || !Array.isArray(PowerZone.SOURCES)) return null;
        const s = PowerZone.SOURCES.find(x => x.id === id || x.name === id);
        if (!s) return null;
        const esc = (x) => this._esc(x);
        const totalSupply = (typeof PowerZone.getTotalSupply === 'function') ? PowerZone.getTotalSupply() : 0;
        const share = totalSupply > 0 ? (s.mw / totalSupply * 100) : null;
        const facts = Array.isArray(s.facts) ? s.facts : [];
        const factList = facts.length ? `<ul class="tm-d-facts">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';

        const body = `
            <div class="tm-d-grid">
                ${this._dSection('Output', `
                    <div class="tm-d-kv"><span>Capacity</span><b>${s.mw >= 1000 ? (s.mw / 1000).toFixed(1) + ' GW' : s.mw + ' MW'}</b></div>
                    <div class="tm-d-kv"><span>Grid share</span><b>${share != null ? share.toFixed(1) + '%' : '—'}</b></div>
                    <div class="tm-d-kv"><span>Cost</span><b>${s.costMWh != null ? '$' + s.costMWh + '/MWh' : '—'}</b></div>
                    <div class="tm-d-kv"><span>Status</span><b style="color:#34d399">${esc(s.online || 'Operational')}</b></div>
                    <div class="tm-d-kv"><span>Offtaker</span><b>${esc(s.offtaker || '—')}</b></div>`)}
                ${this._dSection('Profile', `<div class="tm-d-note">${esc(s.desc || '')}</div>${s.milestone ? `<div class="tm-d-note tm-dim">${esc(s.milestone)}</div>` : ''}`)}
                ${factList ? this._dSection('Field notes', factList, true) : ''}
            </div>`;

        return this._dChrome({
            body,
            watchRef: { kind: 'source', id },
            type: 'source', typeLabel: 'PWR', title: s.name || id, color: '#facc15',
            sub: (s.type || 'power') + ' source',
            chips: [
                { k: 'CAPACITY', v: s.mw >= 1000 ? (s.mw / 1000).toFixed(1) + ' GW' : s.mw + ' MW' },
                share != null ? { k: 'GRID SHARE', v: share.toFixed(1) + '%' } : null,
                { k: 'COST', v: s.costMWh != null ? '$' + s.costMWh : '—' }
            ]
        });
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // WATCHLIST + ALERTS — pin entities; get toasts when their state changes.
    // Pins persist to localStorage. The alert engine snapshots each watched entity and diffs it
    // over time (new flagship, new/retired models, ELO moves, phase changes) → in-terminal toast.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _WATCH_KEY: 'sc_term_watch_v1',
    _watch: null,
    _watchState: {},
    _watchAlertLast: 0,

    _watchLoad() {
        if (this._watch) return this._watch;
        let a = []; try { a = JSON.parse(localStorage.getItem(this._WATCH_KEY)) || []; } catch (e) { a = []; }
        this._watch = Array.isArray(a) ? a : [];
        return this._watch;
    },
    _watchSave() { try { localStorage.setItem(this._WATCH_KEY, JSON.stringify(this._watchLoad())); } catch (e) {} },
    _watchKey(ref) { return ref.kind + ':' + ref.id; },
    _isWatched(ref) { const k = this._watchKey(ref); return this._watchLoad().some(w => w.kind + ':' + w.id === k); },

    _entityMeta(ref) {
        if (ref.kind === 'lab' && typeof LABS !== 'undefined' && LABS[ref.id]) return { label: LABS[ref.id].name || ref.id, color: LABS[ref.id].color || '#8a8aa0' };
        if (ref.kind === 'model' && typeof G !== 'undefined') { const m = (G.models || []).find(x => x.id === ref.id); const lab = m && typeof LABS !== 'undefined' && LABS[m.lab]; return { label: m ? (m.name || m.id) : ref.id, color: (lab && lab.color) || '#22d3ee' }; }
        if (ref.kind === 'country') { const names = { us: 'United States', cn: 'China', eu: 'Europe', uk: 'United Kingdom', in: 'India', ae: 'UAE' }; return { label: names[ref.id] || String(ref.id).toUpperCase(), color: '#60a5fa' }; }
        if (ref.kind === 'source' && typeof PowerZone !== 'undefined') { const s = (PowerZone.SOURCES || []).find(x => x.id === ref.id || x.name === ref.id); return { label: s ? (s.name || ref.id) : ref.id, color: '#facc15' }; }
        return { label: ref.label || ref.id, color: '#8a8aa0' };
    },

    _watchSnapshot(ref) {
        try {
            if (ref.kind === 'lab') {
                const BM_ = (typeof BM !== 'undefined') ? BM : {};
                const models = (G.models || []).filter(m => m.lab === ref.id);
                let topElo = 0, flag = null, fa = -1;
                models.forEach(m => {
                    const b = BM_[m.id] || {};
                    const e = this._num(b.ELO); if (e != null && e > topElo) topElo = e;
                    const vals = [b.MMLU, b.HumanEval || b.HUMANEVAL, b.MATH, b.GPQA].map(v => this._num(v)).filter(v => v != null);
                    const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : -1;
                    if (avg > fa) { fa = avg; flag = m.name || m.id; }
                });
                return { models: models.length, topElo: Math.round(topElo), flag };
            }
            if (ref.kind === 'model') { const m = (G.models || []).find(x => x.id === ref.id); if (!m) return null; const b = (typeof BM !== 'undefined' && BM[ref.id]) || {}; return { phase: m.phase, elo: this._num(b.ELO), ret: !!m.ret }; }
            if (ref.kind === 'country') { const labs = Object.keys((typeof LABS !== 'undefined' && LABS) || {}).filter(k => String(LABS[k].region || '').toLowerCase() === ref.id).length; return { labs }; }
            if (ref.kind === 'source') { const s = (PowerZone.SOURCES || []).find(x => x.id === ref.id || x.name === ref.id); return s ? { mw: s.mw } : null; }
        } catch (e) {}
        return null;
    },

    _toggleWatch(ref) {
        const list = this._watchLoad();
        const k = this._watchKey(ref);
        const i = list.findIndex(w => w.kind + ':' + w.id === k);
        const meta = this._entityMeta(ref);
        if (i >= 0) { list.splice(i, 1); this._toast('Unpinned ' + this._esc(meta.label)); }
        else {
            list.push({ kind: ref.kind, id: ref.id, label: meta.label, color: meta.color });
            this._watchState[k] = this._watchSnapshot(ref);   // seed so we don't alert on the pin itself
            this._toast('<b style="color:' + this._esc(meta.color) + '">' + this._esc(meta.label) + '</b> added to watchlist', { color: meta.color });
        }
        this._watchSave();
        this._renderWatchbar();
        if (this._detail && this._detail.kind === ref.kind && this._detail.id === ref.id) this.openEntity(this._detail);
    },

    _renderWatchbar() {
        const bar = document.getElementById('tm-watchbar');
        if (!bar) return;
        const list = this._watchLoad();
        if (!list.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
        const esc = (s) => this._esc(s);
        bar.style.display = 'flex';
        bar.innerHTML = '<span class="tm-watch-lbl">★ WATCH</span>' + list.map(w => {
            const snap = this._watchSnapshot({ kind: w.kind, id: w.id }) || {};
            let metric = '';
            if (w.kind === 'lab') metric = (snap.models || 0) + 'm' + (snap.topElo ? ' · ' + snap.topElo : '');
            else if (w.kind === 'model') metric = snap.elo ? ('ELO ' + snap.elo) : (snap.phase || '');
            else if (w.kind === 'country') metric = (snap.labs || 0) + ' labs';
            else if (w.kind === 'source') metric = (snap.mw || 0) + 'MW';
            return `<span class="tm-watch-chip tm-clickable" data-action="open:${esc(w.kind)}:${esc(w.id)}" data-tip="${this._tipAttr('Open ' + esc(w.label))}">
                <span class="tm-watch-dot" style="background:${esc(w.color)}"></span>
                <span class="tm-watch-name">${esc(w.label)}</span>
                <span class="tm-watch-metric">${esc(metric)}</span>
                <span class="tm-watch-x" data-action="watch:${esc(w.kind)}:${esc(w.id)}" data-tip="${this._tipAttr('Unpin')}">×</span>
            </span>`;
        }).join('');
    },

    _checkWatchAlerts() {
        const now = Date.now();
        if (now - this._watchAlertLast < 3000) return;
        this._watchAlertLast = now;
        const list = this._watchLoad();
        if (!list.length) return;
        for (const w of list) {
            const ref = { kind: w.kind, id: w.id };
            const k = this._watchKey(ref);
            const cur = this._watchSnapshot(ref);
            if (!cur) continue;
            const prev = this._watchState[k];
            if (prev) {
                if (w.kind === 'lab') {
                    if (cur.flag && prev.flag && cur.flag !== prev.flag) this._alert(w, 'new flagship — ' + cur.flag, 'launch');
                    if (cur.models > prev.models) this._alert(w, '+' + (cur.models - prev.models) + ' new model' + (cur.models - prev.models > 1 ? 's' : ''), 'launch');
                    else if (cur.models < prev.models) this._alert(w, (prev.models - cur.models) + ' model(s) retired', 'policy');
                    if (cur.topElo && prev.topElo && Math.abs(cur.topElo - prev.topElo) >= 5) this._alert(w, 'top ELO ' + prev.topElo + ' → ' + cur.topElo, 'trophy');
                } else if (w.kind === 'model') {
                    if (cur.phase !== prev.phase) this._alert(w, 'phase ' + prev.phase + ' → ' + cur.phase, cur.ret ? 'policy' : 'launch');
                    if (cur.elo && prev.elo && Math.abs(cur.elo - prev.elo) >= 5) this._alert(w, 'ELO ' + prev.elo + ' → ' + cur.elo, 'trophy');
                } else if (w.kind === 'country') {
                    if (cur.labs !== prev.labs) this._alert(w, 'labs ' + prev.labs + ' → ' + cur.labs, 'build');
                } else if (w.kind === 'source') {
                    if (cur.mw !== prev.mw) this._alert(w, 'capacity ' + prev.mw + ' → ' + cur.mw + ' MW', 'build');
                }
            }
            this._watchState[k] = cur;
        }
        this._renderWatchbar();
    },

    _alert(w, msg, cat) {
        const c = this._TAPE_COLORS[cat] || w.color || '#fbbf24';
        this._toast('<b style="color:' + this._esc(w.color || c) + '">' + this._esc(w.label) + '</b> ' + this._esc(msg), { color: c, ref: { kind: w.kind, id: w.id }, sticky: true });
    },

    _toast(html, opts = {}) {
        const host = document.getElementById('tm-toasts');
        if (!host) return;
        const el = document.createElement('div');
        el.className = 'tm-toast';
        if (opts.color) el.style.borderLeftColor = opts.color;
        el.innerHTML = '<span class="tm-toast-msg">' + html + '</span><span class="tm-toast-x" role="button" aria-label="Dismiss">×</span>';
        const dismiss = () => { el.classList.add('tm-toast-out'); setTimeout(() => el.remove(), 350); };
        el.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('tm-toast-x')) { dismiss(); return; }
            if (opts.ref) { this.openEntity(opts.ref); dismiss(); }
        });
        if (opts.ref) el.classList.add('tm-clickable');
        host.appendChild(el);
        while (host.children.length > 5) host.firstChild.remove();
        setTimeout(dismiss, opts.sticky ? 11000 : 6000);
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // UPDATE LOOP — 4 Hz
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _startUpdateLoop() {
        if (this._loopTimer) return;
        const tick = () => {
            if (!this.isOpen) return;
            this._captureHistory();
            this._captureLongHistory();
            this._refresh();
        };
        this._loopTimer = setInterval(tick, 250);
        tick();
    },

    _refresh() {
        this._refreshTopBar();
        this._renderLabs();
        this._renderNews();
        // Alignment is static — rendered once on build
        this._renderCompute();
        this._renderCapital();
        this._refreshTapeStrip();
        this._renderEmbassy();
        this._renderPower();
        this._renderRobotics();
        this._renderLongevity();
        this._renderAgents();
        this._renderSupply();
        this._renderKardashev();
        this._renderPopulation();
        this._checkWatchAlerts();
    },

    _refreshTopBar() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && el.textContent !== val) el.textContent = val;
        };
        const G_ = (typeof G !== 'undefined') ? G : null;

        set('tm-tick', G_ ? String(G_.tick || 0) : '—');

        // FIX: citizens from NPCHousing.REGISTRY (authoritative) not G.agents/G.humans
        let citizens = '—';
        try {
            if (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) {
                citizens = NPCHousing.REGISTRY.length.toLocaleString();
            }
        } catch (e) {}
        set('tm-citizens', citizens);

        set('tm-buildings', (typeof BLDS !== 'undefined') ? BLDS.length.toLocaleString() : '—');

        // FIX: K-scale reads Kardashev.score first (the actual live field)
        let kscale = '—';
        try {
            if (typeof Kardashev !== 'undefined') {
                if (typeof Kardashev.score === 'number') kscale = Kardashev.score.toFixed(3);
                else if (typeof Kardashev.currentLevel === 'function') kscale = Kardashev.currentLevel().toFixed(3);
                else if (typeof Kardashev.level === 'number') kscale = Kardashev.level.toFixed(3);
            }
        } catch (e) {}
        const kEl = document.getElementById('tm-kardashev');
        if (kEl) {
            const chip = this._deltaChip('kscore', { pct: true });
            const html = this._esc(kscale) + (chip ? ' ' + chip : '');
            if (kEl.innerHTML !== html) kEl.innerHTML = html;
        }

        // City render is paused in Terminal; show the sim's step rate (Hz) instead of a dead
        // renderer FPS. Measured from the pump counter over a ~1s window.
        let fpsVal = '—';
        try {
            if (this._cityPaused) {
                const now = performance.now();
                if (!this._lastTpsAt) { this._lastTpsAt = now; this._simSteps = 0; }
                const dt = now - this._lastTpsAt;
                if (dt >= 1000) { this._tps = Math.round(this._simSteps * 1000 / dt); this._simSteps = 0; this._lastTpsAt = now; }
                fpsVal = String(this._tps || 0);
            } else if (G_ && G_.app && G_.app.ticker) {
                fpsVal = G_.app.ticker.FPS.toFixed(0);
            }
        } catch (e) {}
        set('tm-fps', fpsVal);

        set('tm-clock', new Date().toISOString().substr(11, 8) + ' UTC');
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · AI LABS — sortable table, default ELO desc
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _computeLabRows() {
        const rows = [];
        if (typeof LABS === 'undefined' || typeof G === 'undefined' || !Array.isArray(G.models)) return rows;
        const BM_ = (typeof BM !== 'undefined') ? BM : {};

        Object.keys(LABS).forEach(labId => {
            const lab = LABS[labId];
            if (!lab) return;
            const models = G.models.filter(m => m.lab === labId);
            if (!models.length && labId !== 'other') return;

            let scoreSum = 0, scoreN = 0;
            let topElo = null, flagshipName = null;
            for (const m of models) {
                const b = BM_[m.id];
                if (!b) continue;
                const vals = [b.MMLU, b.HumanEval, b.MATH, b.GPQA].filter(v => typeof v === 'number');
                if (vals.length) {
                    const avg = vals.reduce((a, x) => a + x, 0) / vals.length;
                    scoreSum += avg; scoreN++;
                }
                if (typeof b.ELO === 'number') {
                    if (topElo === null || b.ELO > topElo) {
                        topElo = b.ELO;
                        flagshipName = m.name || m.id;
                    }
                }
            }
            const avgScore = scoreN ? (scoreSum / scoreN) : null;

            const hq = (G.bldById && G.bldById['bld_' + labId]) || null;
            const isApex = !!(hq && hq.isTopLab);

            rows.push({
                id: labId,
                name: lab.name || labId,
                color: lab.color || '#8a8aa0',
                region: (lab.region || '?').toUpperCase(),
                models: models.length,
                score: avgScore,
                flagship: flagshipName,
                elo: topElo,
                apex: isApex
            });
        });
        return rows;
    },

    _sortLabRows(rows) {
        const { col, dir } = this._labsSort;
        const mul = (dir === 'asc') ? 1 : -1;
        const get = (r) => {
            switch (col) {
                case 'name':     return (r.name || '').toLowerCase();
                case 'region':   return r.region || '';
                case 'models':   return r.models || 0;
                case 'score':    return r.score == null ? -1 : r.score;
                case 'elo':      return r.elo == null ? -1 : r.elo;
                case 'flagship': return (r.flagship || '').toLowerCase();
                default:         return 0;
            }
        };
        return rows.slice().sort((a, b) => {
            // Primary: selected column
            const av = get(a), bv = get(b);
            if (av < bv) return -1 * mul;
            if (av > bv) return 1 * mul;
            // Secondary tiebreak: apex always wins
            if (a.apex !== b.apex) return a.apex ? -1 : 1;
            // Tertiary: ELO desc (labs with ELO rank above those without)
            const ae = a.elo == null ? -1 : a.elo;
            const be = b.elo == null ? -1 : b.elo;
            return be - ae;
        });
    },

    _renderLabs() {
        const host = document.getElementById('tm-body-labs');
        if (!host) return;
        const rows = this._computeLabRows();
        const sortedAll = this._sortLabRows(rows);
        // Apply region filter if active
        const regionFilter = this._filter.labs;
        const sorted = regionFilter ? sortedAll.filter(r => r.region === regionFilter) : sortedAll;

        const sig = this._labsSort.col + ':' + this._labsSort.dir + ':' + (regionFilter || '') + ':' + sorted.length + ':' +
                    sorted.slice(0, 6).map(r => r.id + (r.score || 0).toFixed(1) + (r.elo || 0)).join('|');
        if (this._sigCache.labs === sig) return;
        this._sigCache.labs = sig;

        if (!sortedAll.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for model data…</div>';
            return;
        }

        const arrow = (c) => this._labsSort.col !== c ? '' : (this._labsSort.dir === 'asc' ? ' ▴' : ' ▾');
        const fmtScore = (s) => s == null ? '—' : s.toFixed(0);
        const fmtElo   = (e) => e == null ? '—' : e.toFixed(0);
        const esc = (s) => this._esc(s);

        // Header column tooltips explain what each column shows
        const thTip = {
            name:     'Lab name. Click to sort A→Z / Z→A.',
            region:   'HQ region. US · EU · CN · UK · IN · AE. Click a pill in a row to filter.',
            models:   'Total shipped models tracked in this sim.',
            score:    'Average benchmark score across MMLU · HumanEval · MATH · GPQA.',
            flagship: 'Top ELO model from this lab.',
            elo:      'LMArena-style head-to-head ELO of the lab\'s top model.'
        };
        const thTipAttr = (c) => this._tipAttr(
            `<div class="tm-tip-hd">${esc(c.toUpperCase())}</div>` +
            `<div class="tm-tip-body">${esc(thTip[c] || '')}</div>` +
            `<div class="tm-tip-foot">click to sort · click again to reverse</div>`
        );

        const body = sorted.map((r, i) => {
            const regionLbl = { US:'United States', EU:'Europe', CN:'China', UK:'United Kingdom', IN:'India', AE:'UAE' }[r.region] || r.region;
            const rowTip = this._tipAttr(
                `<div class="tm-tip-hd" style="color:${esc(r.color)}">${esc(r.name)}${r.apex ? ' <span class="tm-tip-crown">♕</span>' : ''}</div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Region</span><b>${esc(regionLbl)}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Models</span><b>${r.models}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Avg score</span><b>${fmtScore(r.score)}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Flagship</span><b>${esc(r.flagship || '—')}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Top ELO</span><b style="color:#22d3ee">${fmtElo(r.elo)}</b></div>` +
                (r.apex ? `<div class="tm-tip-foot">Apex lab — currently holds a benchmark crown</div>` : '')
            );
            const regionTip = this._tipAttr(
                `<div class="tm-tip-hd">${esc(r.region)}</div>` +
                `<div class="tm-tip-body">Click to filter labs by <b>${esc(regionLbl)}</b></div>`
            );
            return `
                <tr class="tm-clickable" data-action="open:lab:${esc(r.id)}" data-tip="${rowTip}">
                    <td class="tm-rank">${i + 1}</td>
                    <td class="tm-lab-name">
                        <span class="tm-lab-dot" style="background:${r.color}"></span>
                        ${esc(r.name)}
                        ${r.apex ? '<span class="tm-apex" data-tip="' + this._tipAttr('<b>Apex lab</b><br/>Holds a benchmark crown') + '">♕</span>' : ''}
                    </td>
                    <td class="tm-region tm-region-${r.region.toLowerCase()} tm-clickable" data-action="labs:${esc(r.region)}" data-tip="${regionTip}">${esc(r.region)}</td>
                    <td class="tm-num">${r.models}</td>
                    <td class="tm-num">${fmtScore(r.score)}</td>
                    <td class="tm-flagship">${esc(r.flagship || '—')}</td>
                    <td class="tm-num tm-elo">${fmtElo(r.elo)}</td>
                </tr>
            `;
        }).join('');

        const filterBadge = regionFilter
            ? `<div class="tm-filter-badge" data-action="labs:${esc(regionFilter)}" data-tip="${this._tipAttr('Click to clear region filter')}">FILTER · ${esc(regionFilter)} <span class="tm-filter-x">×</span></div>`
            : '';

        host.innerHTML = `
            ${filterBadge}
            <div class="tm-scroll">
                <table class="tm-table tm-labs-table">
                    <thead>
                        <tr>
                            <th class="tm-rank">#</th>
                            <th data-col="name"     data-tip="${thTipAttr('name')}">LAB${arrow('name')}</th>
                            <th data-col="region"   data-tip="${thTipAttr('region')}">REG${arrow('region')}</th>
                            <th data-col="models"   class="tm-num" data-tip="${thTipAttr('models')}">MODELS${arrow('models')}</th>
                            <th data-col="score"    class="tm-num" data-tip="${thTipAttr('score')}">AVG${arrow('score')}</th>
                            <th data-col="flagship" data-tip="${thTipAttr('flagship')}">FLAGSHIP${arrow('flagship')}</th>
                            <th data-col="elo"      class="tm-num" data-tip="${thTipAttr('elo')}">ELO${arrow('elo')}</th>
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ALIGNMENT ORGS — static cards
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderAlignment() {
        const host = document.getElementById('tm-body-alignment');
        if (!host) return;
        if (typeof AlignmentForest === 'undefined' || !Array.isArray(AlignmentForest.BLDS)) {
            host.innerHTML = '<div class="tm-empty">Alignment data unavailable</div>';
            return;
        }
        const esc = (s) => this._esc(s);
        const hex = (n) => '#' + (typeof n === 'number' ? n.toString(16).padStart(6, '0') : '8a8aa0');

        host.innerHTML = `
            <div class="tm-align-grid tm-scroll">
                ${AlignmentForest.BLDS.map(o => {
                    const color = hex(o.shield);
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd" style="color:${esc(color)}">${esc(o.name)}</div>` +
                        `<div class="tm-tip-body">${esc(o.focus || '')}</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Lead</span><b>${esc(o.lead || '—')}</b></div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Founded</span><b>${esc(o.founded || '—')}</b></div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Location</span><b>${esc(o.location || '—')}</b></div>` +
                        `<div class="tm-tip-foot">AI safety organization — Alignment Forest</div>`
                    );
                    return `
                        <div class="tm-align-card" style="border-left-color:${color}" data-tip="${tip}">
                            <div class="tm-align-top">
                                <span class="tm-align-name" style="color:${color}">${esc(o.name)}</span>
                                <span class="tm-align-year">${esc(o.founded || '')}</span>
                            </div>
                            <div class="tm-align-focus">${esc(o.focus || '')}</div>
                            <div class="tm-align-meta">
                                <span class="tm-align-lead">${esc(o.lead || '')}</span>
                            </div>
                            <div class="tm-align-loc">📍 ${esc(o.location || '')}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · LIVE NEWS
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _collectNewsItems() {
        const items = [];
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories)) {
            for (const s of HNBlimps._stories) {
                if (!s || !s.title) continue;
                items.push({ source: 'HN', title: s.title, url: s.url, score: s.score, comments: s.descendants });
            }
        }
        if (typeof API !== 'undefined' && Array.isArray(API.liveNews)) {
            for (const n of API.liveNews) {
                if (!n) continue;
                items.push({
                    source: (n.source || 'NEWS').toUpperCase().replace(/\s+/g, ''),
                    title: n.headline || n.title,
                    url: n.url
                });
            }
        }
        return items;
    },

    _renderNews() {
        const host = document.getElementById('tm-body-news');
        if (!host) return;
        const items = this._collectNewsItems();
        const sig = 'n:' + items.length + ':' + (items[0] ? (items[0].title || '').slice(0, 40) : '');
        if (this._sigCache.news === sig) return;
        this._sigCache.news = sig;

        if (!items.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for headlines…</div>';
            return;
        }
        const esc = (s) => this._esc(s);
        const MAX = 24;

        host.innerHTML = `
            <div class="tm-scroll tm-news-list">
                ${items.slice(0, MAX).map(n => {
                    const url = n.url ? ` href="${safeHref(n.url)}" target="_blank" rel="noopener"` : '';
                    const tag = n.source === 'HN' ? 'tm-tag-hn' : 'tm-tag-news';
                    const isHN = n.source === 'HN';
                    const scoreBlock = (isHN && typeof n.score === 'number')
                        ? `<span class="tm-news-score">▲ ${n.score}</span>` : '';
                    const itemTip = this._tipAttr(
                        `<div class="tm-tip-hd">${esc(n.source)}</div>` +
                        `<div class="tm-tip-body">${esc(n.title)}</div>` +
                        (isHN && typeof n.score === 'number'
                            ? `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b>▲ ${n.score}</b></div>` +
                              `<div class="tm-tip-row"><span class="tm-tip-k">Comments</span><b>${n.comments || 0}</b></div>`
                            : '') +
                        (n.url ? `<div class="tm-tip-foot">Click to open in new tab ↗</div>` : '')
                    );
                    const srcTip = this._tipAttr(
                        `<div class="tm-tip-hd">${esc(n.source)}</div>` +
                        `<div class="tm-tip-body">${isHN ? 'Hacker News — ranked by upvotes' : 'Live tech news feed'}</div>`
                    );
                    return `
                        <div class="tm-news-item" data-tip="${itemTip}">
                            <span class="tm-news-source ${tag}" data-tip="${srcTip}">${esc(n.source)}</span>
                            <a class="tm-news-title"${url}>${esc(n.title)}</a>
                            ${scoreBlock}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ACTIVITY STREAM (was EVENTS LOG)
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderEvents() {
        const host = document.getElementById('tm-body-events');
        if (!host) return;
        const log = (typeof UI !== 'undefined' && Array.isArray(UI.scanLog)) ? UI.scanLog : [];
        const sig = 'e:' + log.length + ':' + (log[0] ? ((log[0].t || '') + (log[0].msg || '').slice(0, 24)) : '');
        if (this._sigCache.events === sig) return;
        this._sigCache.events = sig;

        if (!log.length) {
            host.innerHTML = '<div class="tm-empty">No events yet</div>';
            return;
        }
        const classify = (msg) => {
            const s = String(msg || '');
            if (/^🚀|^🛰️/.test(s))                        return 'launch';
            if (/^💰|^💼/.test(s))                         return 'deal';
            if (/^🏆|^👑/.test(s))                          return 'trophy';
            if (/^🏗️|^🧬/.test(s))                         return 'build';
            if (/^⚖️|^🏛️/.test(s))                         return 'policy';
            if (/^✨|^☄️|^🌙|^🏜️/.test(s))                  return 'env';
            if (/^📊|^👻/.test(s))                          return 'model';
            return 'other';
        };
        const catLabel = {
            launch: 'Launch event',
            deal:   'Capital / business',
            trophy: 'Benchmark trophy',
            build:  'Construction / biotech',
            policy: 'Regulatory / court',
            env:    'Environmental',
            model:  'Model shipment',
            other:  'Sim event'
        };
        const esc = (s) => this._esc(s);

        host.innerHTML = `
            <div class="tm-scroll tm-events-list">
                ${log.slice(0, 30).map(e => {
                    const cat = classify(e.msg);
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd tm-tip-hd-${cat}">${esc(catLabel[cat])}</div>` +
                        `<div class="tm-tip-body">${esc(e.msg || '')}</div>` +
                        `<div class="tm-tip-foot">${esc(e.t || '')} — activity stream</div>`
                    );
                    return `
                        <div class="tm-event-item tm-ev-${cat}" data-tip="${tip}">
                            <span class="tm-event-time">${esc(e.t || '')}</span>
                            <span class="tm-event-msg">${e.msg || ''}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · COMPUTE INFRA (6×1) — big MW · operator donut · MW trend sparkline · mini stats
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderCompute() {
        const host = document.getElementById('tm-body-compute');
        if (!host) return;
        if (typeof DC_FACILITIES === 'undefined' || !Array.isArray(DC_FACILITIES)) {
            host.innerHTML = '<div class="tm-empty">Compute data unavailable</div>';
            return;
        }

        const op = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type !== 'chipfab');
        const fabs = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type === 'chipfab');
        const totalMW = op.reduce((s, d) => s + (d.power_mw || 0), 0);
        const construction = DC_FACILITIES.filter(d => d && d.status === 'construction').length;

        // Operator aggregation (top 5 by MW)
        const byOp = {};
        op.forEach(d => {
            const o = d.operator || d.name || 'other';
            byOp[o] = (byOp[o] || 0) + (d.power_mw || 0);
        });
        const opColors = ['#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];
        const topOps = Object.entries(byOp).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const otherMW = Object.entries(byOp).sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [,v]) => s + v, 0);
        const segments = topOps.map(([name, mw], i) => ({ label: name, value: mw, color: opColors[i] }));
        if (otherMW > 0) segments.push({ label: 'other', value: otherMW, color: '#4a4a5a' });

        const hist = this._history.dc_total_mw;
        const lastMW = hist[hist.length - 1] || 0;
        const focusOp = this._filter.compute;
        const sig = 'c:' + op.length + ':' + totalMW + ':' + fabs.length + ':' + construction + ':' + lastMW + ':' + (hist.length || 0) + ':' + (focusOp || '') + ':' + this._lhSeries('computeMW').length;
        if (this._sigCache.compute === sig) return;
        this._sigCache.compute = sig;

        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + ' GW' : Math.round(n).toLocaleString() + ' MW';
        const esc = (s) => this._esc(s);
        const pct = (v) => totalMW > 0 ? ((v / totalMW) * 100).toFixed(1) + '%' : '—';

        // Apply filter: dim segments that aren't the focused operator
        const dimmed = segments.map(s => focusOp && s.label !== focusOp
            ? { ...s, color: '#2a2a3a' }
            : s);

        // Persisted MW series (falls back to the live 16s buffer until history accrues)
        const mwSeriesLong = this._lhSeries('computeMW');
        const mwSeries = mwSeriesLong.length >= 8 ? mwSeriesLong : hist;
        const mwStat = this._lhStat('computeMW');
        const mwSpan = this._lhSpan('computeMW') || '16s';

        const heroTip = this._tipAttr(
            `<div class="tm-tip-hd">Compute capacity</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Total</span><b>${fmtMW(totalMW)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Datacenters</span><b>${op.length}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Chip fabs</span><b>${fabs.length}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Under build</span><b>${construction}</b></div>`
        );
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Operator share</div>` +
            `<div class="tm-tip-body">${segments.length} operators · click legend dot to focus</div>`
        );
        const sparkTip = this._tipAttr(
            `<div class="tm-tip-hd">MW trend · ${mwSpan}</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${fmtMW(lastMW)}</b></div>` +
            (mwStat ? `<div class="tm-tip-row"><span class="tm-tip-k">Δ ${mwSpan}</span><b class="${mwStat.delta >= 0 ? 'tm-tip-good' : 'tm-tip-bad'}">${(mwStat.delta >= 0 ? '+' : '') + Math.round(mwStat.delta)} MW</b></div>` +
                      `<div class="tm-tip-row"><span class="tm-tip-k">Peak</span><b>${fmtMW(mwStat.ath)}</b></div>` : '') +
            `<div class="tm-tip-foot">persisted across sessions</div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout">
                <div class="tm-col tm-col-stat" data-tip="${heroTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${(totalMW >= 1000 ? (totalMW/1000).toFixed(1) : Math.round(totalMW).toLocaleString())}</span>
                        <span class="tm-stat-unit">${totalMW >= 1000 ? 'GW' : 'MW'}</span>
                    </div>
                    <div class="tm-ministats">
                        <span data-tip="${this._tipAttr('<b>' + op.length + '</b> operational datacenters')}"><b>${op.length}</b> DCs</span>
                        <span data-tip="${this._tipAttr('<b>' + fabs.length + '</b> operational chip fabs')}"><b>${fabs.length}</b> fabs</span>
                        <span data-tip="${this._tipAttr('<b>' + construction + '</b> sites under construction')}"><b>${construction}</b> build</span>
                    </div>
                </div>
                <div class="tm-col tm-col-donut" data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, { size: 88, thick: 13, center: fmtMW(totalMW) })}
                    <div class="tm-donut-legend">
                        ${segments.slice(0, 4).map(s => {
                            const active = focusOp === s.label;
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd" style="color:${esc(s.color)}">${esc(s.label)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Capacity</span><b>${fmtMW(s.value)}</b></div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${pct(s.value)}</b></div>` +
                                `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} operator</div>`
                            );
                            return `
                                <div class="tm-legend-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:compute:${esc(s.label)}" data-tip="${tip}">
                                    <span class="tm-legend-dot" style="background:${s.color}"></span>
                                    <span class="tm-legend-lbl">${esc(s.label)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="tm-col tm-col-spark" data-tip="${sparkTip}">
                    <div class="tm-spark-lbl">MW TREND · ${mwSpan}</div>
                    ${this._svgSpark(mwSeries, { w: 200, h: 54, color: '#22d3ee' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // THE TAPE — one fused, color-coded wire.
    // Merges the news wires, VC deals, and the sim event log (model launches, benchmark crownings,
    // policy/bans, builds) into a single categorized stream. Rendered in two places: the CAPITAL
    // panel (vertical feed) and the full-width scrolling ticker strip above the footer.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _TAPE_COLORS: {
        news: '#22d3ee', deal: '#34d399', launch: '#fbbf24', trophy: '#facc15',
        policy: '#f87171', build: '#a78bfa', model: '#60a5fa', env: '#5eead4', other: '#8a8aa0'
    },

    _tapeCat(msg) {
        const s = String(msg || '');
        if (/^🚀|^🛰️/.test(s)) return 'launch';
        if (/^💰|^💼/.test(s)) return 'deal';
        if (/^🏆|^👑/.test(s)) return 'trophy';
        if (/^🏗️|^🧬/.test(s)) return 'build';
        if (/^⚖️|^🏛️|^🚔|^⛔|^🚨/.test(s)) return 'policy';
        if (/^✨|^☄️|^🌙|^🏜️/.test(s)) return 'env';
        if (/^📊|^👻/.test(s)) return 'model';
        return 'other';
    },

    _stripEmoji(s) {
        return String(s || '').replace(/^[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]+/u, '').trim();
    },

    _collectTape() {
        const items = [];
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories))
            HNBlimps._stories.forEach(s => { if (s && s.title) items.push({ cat: 'news', src: 'HN', text: s.title, url: s.url, score: s.score }); });
        if (typeof API !== 'undefined' && Array.isArray(API.liveNews))
            API.liveNews.forEach(n => { if (n) { const t = n.headline || n.title; if (t) items.push({ cat: 'news', src: String(n.source || 'NEWS').toUpperCase().replace(/\s+/g, ''), text: t, url: n.url }); } });
        if (typeof API !== 'undefined' && Array.isArray(API.vcDeals))
            API.vcDeals.forEach(d => { if (d && d.headline) items.push({ cat: 'deal', src: 'DEAL', text: (d.amount ? d.amount + ' — ' : '') + d.headline, url: d.url }); });
        // Cap sim-log events so high-frequency build spam can't bury news & deals.
        if (typeof UI !== 'undefined' && Array.isArray(UI.scanLog))
            UI.scanLog.slice(0, 18).forEach(e => { if (e && e.msg) { const cat = this._tapeCat(e.msg); const text = this._stripEmoji(e.msg); if (text) items.push({ cat, src: cat.toUpperCase(), text, t: e.t }); } });
        return items;
    },

    _renderCapital() {
        const host = document.getElementById('tm-body-capital');
        if (!host) return;
        const items = this._collectTape();
        const sig = 'tape:' + items.length + ':' + (items[0] ? items[0].text.slice(0, 32) : '');
        if (this._sigCache.capital === sig) return;
        this._sigCache.capital = sig;

        if (!items.length) { host.innerHTML = '<div class="tm-empty">The wire is quiet…</div>'; return; }
        const esc = (s) => this._esc(s);

        host.innerHTML = `
            <div class="tm-scroll tm-tape-feed">
                ${items.slice(0, 40).map(it => {
                    const c = this._TAPE_COLORS[it.cat] || '#8a8aa0';
                    const isLink = !!it.url;
                    const attrs = isLink ? ` href="${safeHref(it.url)}" target="_blank" rel="noopener"` : '';
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd" style="color:${c}">${esc(it.src)} · ${esc(it.cat)}</div>` +
                        `<div class="tm-tip-body">${esc(it.text)}</div>` +
                        (isLink ? `<div class="tm-tip-foot">Click to open ↗</div>` : (it.t ? `<div class="tm-tip-foot">${esc(it.t)} — sim event</div>` : ''))
                    );
                    return `<${isLink ? 'a' : 'div'} class="tm-tape-row"${attrs} data-tip="${tip}">
                        <span class="tm-tape-cat" style="background:${c}">${esc(it.src)}</span>
                        <span class="tm-tape-txt">${esc(it.text)}</span>
                        ${it.score ? `<span class="tm-news-score">▲ ${it.score}</span>` : ''}
                    </${isLink ? 'a' : 'div'}>`;
                }).join('')}
            </div>
        `;
    },

    // Full-width scrolling ticker strip (above the footer). Rebuilds only when the fused
    // signature changes so the CSS scroll animation isn't reset on every 4Hz tick.
    _refreshTapeStrip() {
        const track = document.getElementById('tm-tape-track');
        if (!track) return;
        const items = this._collectTape().slice(0, 28);
        const sig = 'strip:' + items.length + ':' + (items[0] ? items[0].text.slice(0, 24) : '');
        if (this._sigCache.tapestrip === sig) return;
        this._sigCache.tapestrip = sig;
        if (!items.length) { track.innerHTML = ''; return; }
        const esc = (s) => this._esc(s);
        const one = items.map(it => {
            const c = this._TAPE_COLORS[it.cat] || '#8a8aa0';
            return `<span class="tm-tstrip-item"><span class="tm-tstrip-dot" style="background:${c}"></span><span class="tm-tstrip-src" style="color:${c}">${esc(it.src)}</span> ${esc(it.text)}</span>`;
        }).join('<span class="tm-tstrip-sep">•</span>');
        // Duplicate the run so the -50% translate loops seamlessly.
        track.innerHTML = one + '<span class="tm-tstrip-sep">•</span>' + one;
        track.style.animationDuration = Math.max(45, items.length * 3.5) + 's';
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · EMBASSY RELATIONS — 6×6 matrix
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    EMBASSY_RELATIONS: {
        'us_cn': 22, 'us_eu': 82, 'us_uk': 90, 'us_in': 70, 'us_ae': 62,
        'cn_eu': 48, 'cn_uk': 40, 'cn_in': 28, 'cn_ae': 72,
        'eu_uk': 75, 'eu_in': 65, 'eu_ae': 58,
        'uk_in': 78, 'uk_ae': 68,
        'in_ae': 76
    },

    _renderEmbassy() {
        const host = document.getElementById('tm-body-embassy');
        if (!host) return;
        if (typeof EmbassyRow === 'undefined' || !Array.isArray(EmbassyRow.BLDS)) {
            host.innerHTML = '<div class="tm-empty">Embassy data unavailable</div>';
            return;
        }
        const countries = EmbassyRow.BLDS.map(b => ({
            id: String(b.country || '').toLowerCase(),
            code: String(b.country || '').toUpperCase(),
            accent: (typeof b.accent === 'number') ? b.accent : 0x8a8aa0
        })).filter(c => c.id);

        const focus = this._filter.embassy;
        const sig = 'em:' + countries.map(c => c.id).join(',') + ':' + (focus || '');
        if (this._sigCache.embassy === sig) return;
        this._sigCache.embassy = sig;

        const relations = this.EMBASSY_RELATIONS;
        const getScore = (a, b) => {
            if (a === b) return null;
            if (relations[a + '_' + b] != null) return relations[a + '_' + b];
            if (relations[b + '_' + a] != null) return relations[b + '_' + a];
            return 50;
        };
        const cellCls = (s) => {
            if (s === null) return 'tm-m-self';
            if (s >= 75) return 'tm-m-good';
            if (s >= 55) return 'tm-m-neutral';
            if (s >= 35) return 'tm-m-cool';
            return 'tm-m-cold';
        };
        const scoreLabel = (s) => {
            if (s === null) return 'self';
            if (s >= 75) return 'Aligned · open flow';
            if (s >= 55) return 'Neutral · standard trade';
            if (s >= 35) return 'Tense · export controls';
            return 'Restricted · heavy sanctions';
        };
        const scoreClass = (s) => {
            if (s === null) return 'tm-tip-muted';
            if (s >= 75) return 'tm-tip-good';
            if (s >= 55) return 'tm-tip-warn';
            if (s >= 35) return 'tm-tip-warn';
            return 'tm-tip-bad';
        };
        const hex = (n) => '#' + n.toString(16).padStart(6, '0');
        const countryName = { us:'United States', cn:'China', eu:'Europe', uk:'United Kingdom', in:'India', ae:'UAE' };
        const esc = (s) => this._esc(s);

        // Build tip for a header cell (country column/row label)
        const headerTip = (code, id) => this._tipAttr(
            `<div class="tm-tip-hd">${esc(code)}</div>` +
            `<div class="tm-tip-body">${esc(countryName[id] || code)}</div>` +
            `<div class="tm-tip-foot">Click any cell to focus this country's row & column</div>`
        );

        host.innerHTML = `
            <div class="tm-scroll tm-matrix-wrap">
                <table class="tm-matrix">
                    <thead>
                        <tr>
                            <th></th>
                            ${countries.map(c => `<th style="color:${hex(c.accent)}" data-tip="${headerTip(c.code, c.id)}">${c.code}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${countries.map(r => `
                            <tr>
                                <th style="color:${hex(r.accent)}" data-tip="${headerTip(r.code, r.id)}">${r.code}</th>
                                ${countries.map(c => {
                                    const s = getScore(r.id, c.id);
                                    const key = r.id + '_' + c.id;
                                    const keyRev = c.id + '_' + r.id;
                                    const isFocus = focus && (focus === key || focus === keyRev || focus === r.id || focus === c.id);
                                    const dimCls = focus && !isFocus ? ' tm-dim' : '';
                                    const tip = this._tipAttr(
                                        `<div class="tm-tip-hd">${esc(r.code)} → ${esc(c.code)}</div>` +
                                        (s === null
                                            ? `<div class="tm-tip-body tm-tip-muted">Self-reference</div>`
                                            : `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b class="${scoreClass(s)}">${s}/100</b></div>` +
                                              `<div class="tm-tip-body ${scoreClass(s)}">${esc(scoreLabel(s))}</div>` +
                                              `<div class="tm-tip-foot">Click to focus this pair on the matrix</div>`)
                                    );
                                    const action = s === null ? '' : ` data-action="embassy:${key}"`;
                                    const click  = s === null ? '' : ' tm-clickable';
                                    return `<td class="${cellCls(s)}${click}${dimCls}" data-tip="${tip}"${action}>${s === null ? '·' : s}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="tm-m-legend">
                    <span class="tm-m-dot tm-m-good"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-good&quot;>Aligned</b><br/>Score 75-100<br/>Open trade, shared research')}"></span>aligned
                    <span class="tm-m-dot tm-m-neutral" data-tip="${this._tipAttr('<b class=&quot;tm-tip-warn&quot;>Neutral</b><br/>Score 55-74<br/>Standard bilateral')}"></span>neutral
                    <span class="tm-m-dot tm-m-cool"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-warn&quot;>Tense</b><br/>Score 35-54<br/>Export controls')}"></span>tense
                    <span class="tm-m-dot tm-m-cold"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-bad&quot;>Restricted</b><br/>Score <35<br/>Heavy sanctions')}"></span>restricted
                    ${focus ? `<span class="tm-filter-badge tm-filter-inline" data-action="embassy:${esc(focus)}" data-tip="${this._tipAttr('Click to clear focus')}">FOCUS · ${esc(focus.toUpperCase().replace('_', ' → '))} <span class="tm-filter-x">×</span></span>` : ''}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · POWER GRID (4×2) — donut source mix + sparkline supply/demand + reserve readout
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderPower() {
        const host = document.getElementById('tm-body-power');
        if (!host) return;
        if (typeof PowerZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Grid offline</div>';
            return;
        }

        const supply = (typeof PowerZone.getTotalSupply === 'function') ? PowerZone.getTotalSupply() : 0;
        const demand = (typeof PowerZone.getTotalDemand === 'function') ? PowerZone.getTotalDemand() : 0;
        const balance = supply - demand;
        const reserveP = supply > 0 ? (balance / supply * 100) : 0;
        const sources = Array.isArray(PowerZone.SOURCES) ? PowerZone.SOURCES : [];

        const focusSrc = this._filter.power;
        const sig = 'p:' + supply.toFixed(0) + ':' + demand.toFixed(0) + ':' + sources.length + ':' + (this._history.supply_mw.length || 0) + ':' + (focusSrc || '');
        if (this._sigCache.power === sig) return;
        this._sigCache.power = sig;

        const srcColors = {
            solar: '#facc15', wind: '#22d3ee', nuclear: '#a78bfa',
            coal: '#78716c', hydro: '#60a5fa', gas: '#fb923c',
            geothermal: '#f472b6', fusion: '#c084fc'
        };
        const segments = sources.map(s => ({
            label: s.name || s.id,
            value: s.mw || 0,
            color: srcColors[s.id] || srcColors[(s.name || '').toLowerCase()] || '#8a8aa0'
        })).filter(s => s.value > 0);

        const reserveColor = reserveP >= 10 ? '#34d399' : reserveP >= 0 ? '#fbbf24' : '#f87171';
        const reserveStat = reserveP >= 10 ? 'Healthy headroom' : reserveP >= 0 ? 'Tight margin' : 'Deficit — blackouts likely';
        const reserveCls  = reserveP >= 10 ? 'tm-tip-good'    : reserveP >= 0 ? 'tm-tip-warn'  : 'tm-tip-bad';
        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'GW' : Math.round(n) + 'MW';
        const pctShare = (v) => supply > 0 ? ((v / supply) * 100).toFixed(1) + '%' : '—';
        const esc = (s) => this._esc(s);

        // Dim non-focused segments
        const dimmed = segments.map(s => focusSrc && s.label !== focusSrc
            ? { ...s, color: '#2a2a3a' }
            : s);

        // Hero / donut tooltip
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Power supply</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Total</span><b>${fmtMW(supply)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Sources</span><b>${segments.length}</b></div>` +
            `<div class="tm-tip-foot">Click a legend row to filter a source</div>`
        );
        const demandTip = this._tipAttr(
            `<div class="tm-tip-hd">Grid demand</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Draw</span><b>${fmtMW(demand)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Of supply</span><b>${supply > 0 ? (demand/supply*100).toFixed(0) : 0}%</b></div>`
        );
        const reserveTip = this._tipAttr(
            `<div class="tm-tip-hd">Spare capacity</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Margin</span><b class="${reserveCls}">${reserveP >= 0 ? '+' : ''}${reserveP.toFixed(1)}%</b></div>` +
            `<div class="tm-tip-body ${reserveCls}">${esc(reserveStat)}</div>`
        );
        const sourcesTip = this._tipAttr(
            `<div class="tm-tip-hd">Generation mix</div>` +
            `<div class="tm-tip-body">${segments.length} active sources</div>`
        );

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-power-hero">
                    <div data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, {
                        size: 110, thick: 16,
                        center: (supply >= 1000 ? (supply/1000).toFixed(1) : Math.round(supply)),
                        centerSub: (supply >= 1000 ? 'GW' : 'MW') + ' supply'
                    })}
                    </div>
                    <div class="tm-power-readouts">
                        <div class="tm-readout" data-tip="${demandTip}">
                            <span class="tm-readout-lbl">DEMAND</span>
                            <span class="tm-readout-val">${fmtMW(demand)}</span>
                        </div>
                        <div class="tm-readout" data-tip="${reserveTip}">
                            <span class="tm-readout-lbl">RESERVE</span>
                            <span class="tm-readout-val" style="color:${reserveColor}">${reserveP >= 0 ? '+' : ''}${reserveP.toFixed(0)}%</span>
                        </div>
                        <div class="tm-readout" data-tip="${sourcesTip}">
                            <span class="tm-readout-lbl">SOURCES</span>
                            <span class="tm-readout-val">${segments.length}</span>
                        </div>
                    </div>
                </div>
                <div class="tm-power-legend">
                    ${segments.slice(0, 6).map(s => {
                        const active = focusSrc === s.label;
                        const tip = this._tipAttr(
                            `<div class="tm-tip-hd" style="color:${esc(s.color)}">${esc(s.label)}</div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Output</span><b>${fmtMW(s.value)}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${pctShare(s.value)}</b></div>` +
                            `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} source</div>`
                        );
                        return `
                            <div class="tm-legend-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:power:${esc(s.label)}" data-tip="${tip}">
                                <span class="tm-legend-dot" style="background:${s.color}"></span>
                                <span class="tm-legend-lbl">${esc(s.label)}</span>
                                <span class="tm-legend-val">${fmtMW(s.value)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="tm-spark-block">
                    <div class="tm-spark-hd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Supply trend (16s)</div><div class=&quot;tm-tip-body&quot;>Total grid output over the last 64 ticks</div>')}">
                        <span class="tm-spark-t">SUPPLY</span>
                        ${this._svgSpark(this._history.supply_mw, { w: 120, h: 28, color: '#34d399' })}
                    </div>
                    <div class="tm-spark-hd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Demand trend (16s)</div><div class=&quot;tm-tip-body&quot;>Grid draw from datacenters + zones</div>')}">
                        <span class="tm-spark-t">DEMAND</span>
                        ${this._svgSpark(this._history.demand_mw, { w: 120, h: 28, color: '#fbbf24' })}
                    </div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ROBOTICS (4×1) — units + capability curve
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderRobotics() {
        const host = document.getElementById('tm-body-robotics');
        if (!host) return;
        if (typeof RoboticsZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Robotics unavailable</div>';
            return;
        }
        const units = RoboticsZone.unitsProduced || 0;
        const facilities = Array.isArray(RoboticsZone.BLDS) ? RoboticsZone.BLDS.length : 0;
        const hist = this._history.robotics_units;
        const lastVal = hist[hist.length - 1] || 0;

        const sig = 'r:' + units + ':' + facilities + ':' + lastVal + ':' + hist.length;
        if (this._sigCache.robotics === sig) return;
        this._sigCache.robotics = sig;

        const capability = units > 0 ? Math.min(100, Math.log10(units + 1) * 22) : 0;
        const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        const firstVal = hist[0] || 0;
        const deltaTxt = ((lastVal - firstVal) >= 0 ? '+' : '') + fmt(lastVal - firstVal);
        const deltaCls = (lastVal - firstVal) > 0 ? 'tm-tip-good' : (lastVal - firstVal) < 0 ? 'tm-tip-bad' : 'tm-tip-muted';

        const statTip = this._tipAttr(
            `<div class="tm-tip-hd">Humanoid production</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Units</span><b>${units.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Facilities</span><b>${facilities}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span><b class="${deltaCls}">${deltaTxt}</b></div>`
        );
        const capTip = this._tipAttr(
            `<div class="tm-tip-hd">Capability index</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b>${capability.toFixed(1)} / 100</b></div>` +
            `<div class="tm-tip-body">Log-scaled from fleet size: log10(N+1) × 22</div>` +
            `<div class="tm-tip-foot">Units trend sparkline shown below</div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat" data-tip="${statTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${fmt(units)}</span>
                        <span class="tm-stat-unit">units</span>
                    </div>
                    <div class="tm-stat-sub">${facilities} facilities</div>
                </div>
                <div class="tm-col tm-col-wide" data-tip="${capTip}">
                    <div class="tm-cap-row">
                        <span class="tm-cap-lbl">CAPABILITY</span>
                        <span class="tm-cap-val">${capability.toFixed(0)}</span>
                    </div>
                    <div class="tm-meter-track"><div class="tm-meter-fill" style="width:${capability.toFixed(1)}%"></div></div>
                    ${this._svgSpark(hist, { w: 180, h: 30, color: '#a78bfa' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · LONGEVITY (4×1) — three stat cells with sparklines each
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderLongevity() {
        const host = document.getElementById('tm-body-longevity');
        if (!host) return;
        if (typeof LongevityZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Longevity unavailable</div>';
            return;
        }
        const compounds = LongevityZone.compoundsScreened || 0;
        const trials = LongevityZone.trialsActive || 0;
        const genomes = LongevityZone.genomesSequenced || 0;
        const hC = this._history.longevity_compounds;
        const hT = this._history.longevity_trials;
        const hG = this._history.longevity_genomes;

        const sig = 'l:' + compounds + ':' + trials + ':' + genomes + ':' + hC.length;
        if (this._sigCache.longevity === sig) return;
        this._sigCache.longevity = sig;

        const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        const mkTip = (hd, body, current, hist, unit) => {
            const first = hist[0] || 0;
            const last  = hist[hist.length - 1] || 0;
            const d = last - first;
            const dCls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return this._tipAttr(
                `<div class="tm-tip-hd">${hd}</div>` +
                `<div class="tm-tip-body">${body}</div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Current</span><b>${current.toLocaleString()} ${unit}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span><b class="${dCls}">${(d >= 0 ? '+' : '') + fmt(d)}</b></div>`
            );
        };

        host.innerHTML = `
            <div class="tm-long-grid">
                <div class="tm-long-cell" data-tip="${mkTip('Compounds screened', 'Molecules tested against longevity targets in lab pipelines.', compounds, hC, 'compounds')}">
                    <span class="tm-long-num">${fmt(compounds)}</span>
                    <span class="tm-long-lbl">compounds</span>
                    ${this._svgSpark(hC, { w: 110, h: 24, color: '#34d399' })}
                </div>
                <div class="tm-long-cell" data-tip="${mkTip('Active trials', 'Clinical trials currently running in longevity facilities.', trials, hT, 'trials')}">
                    <span class="tm-long-num">${trials}</span>
                    <span class="tm-long-lbl">trials</span>
                    ${this._svgSpark(hT, { w: 110, h: 24, color: '#fbbf24' })}
                </div>
                <div class="tm-long-cell" data-tip="${mkTip('Genomes sequenced', 'Full human genomes processed for biomarker & lifespan research.', genomes, hG, 'genomes')}">
                    <span class="tm-long-num">${fmt(genomes)}</span>
                    <span class="tm-long-lbl">genomes</span>
                    ${this._svgSpark(hG, { w: 110, h: 24, color: '#22d3ee' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · AGENTS (4×2) — active + gauge + tasks sparkline + swarm/tool metrics
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderAgents() {
        const host = document.getElementById('tm-body-agents');
        if (!host) return;
        const s = (typeof AgentsZone !== 'undefined' && AgentsZone.agentStats) ? AgentsZone.agentStats : null;
        if (!s) {
            host.innerHTML = '<div class="tm-empty">Agent data unavailable</div>';
            return;
        }

        const active = s.activeAgents || 0;
        const tasks  = s.tasksPerHour || 0;
        const tools  = s.toolCalls    || 0;
        const err    = s.errorRate    || 0;
        const swarms = s.swarmSize    || 0;
        const hTasks = this._history.agents_tasks;
        const hActive = this._history.agents_active;

        const sig = 'a:' + active + ':' + tasks + ':' + tools + ':' + err.toFixed(2) + ':' + hTasks.length;
        if (this._sigCache.agents === sig) return;
        this._sigCache.agents = sig;

        const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
        // Error gauge: clamp 0..5% → 0..1 (so 2.5% fills half the gauge)
        const errNorm = Math.min(1, err / 5);
        const errCls  = err < 1.5 ? 'tm-tip-good' : err < 3 ? 'tm-tip-warn' : 'tm-tip-bad';
        const errLbl  = err < 1.5 ? 'Nominal' : err < 3 ? 'Elevated' : 'Critical';
        const sparkDelta = (hist) => {
            const a = hist[0] || 0, b = hist[hist.length - 1] || 0, d = b - a;
            const cls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return `<b class="${cls}">${(d >= 0 ? '+' : '') + fmtK(d)}</b>`;
        };

        const heroTip = this._tipAttr(
            `<div class="tm-tip-hd">Agent fleet</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Active</span><b>${active.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Swarms</span><b>${swarms}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Tool calls/hr</span><b>${fmtK(tools)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Tasks/hr</span><b>${fmtK(tasks)}</b></div>`
        );
        const tasksTip = this._tipAttr(
            `<div class="tm-tip-hd">Task throughput</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${fmtK(tasks)} / hr</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span>${sparkDelta(hTasks)}</div>`
        );
        const activeTip = this._tipAttr(
            `<div class="tm-tip-hd">Active agent trend</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${active.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span>${sparkDelta(hActive)}</div>`
        );
        const gaugeTip = this._tipAttr(
            `<div class="tm-tip-hd">Error rate</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Rate</span><b class="${errCls}">${err.toFixed(2)}%</b></div>` +
            `<div class="tm-tip-body ${errCls}">${errLbl}</div>` +
            `<div class="tm-tip-foot">Gauge full scale = 5%</div>`
        );

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-agents-hero" data-tip="${heroTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${active.toLocaleString()}</span>
                        <span class="tm-stat-unit">active</span>
                    </div>
                    <div class="tm-ministats">
                        <span><b>${swarms}</b> swarms</span>
                        <span><b>${fmtK(tools)}</b> tool calls/hr</span>
                    </div>
                </div>
                <div class="tm-agents-spark" data-tip="${tasksTip}">
                    <div class="tm-spark-lbl">TASKS/HR · ${fmtK(tasks)}</div>
                    ${this._svgSpark(hTasks, { w: 240, h: 36, color: '#22d3ee' })}
                </div>
                <div class="tm-agents-spark" data-tip="${activeTip}">
                    <div class="tm-spark-lbl">ACTIVE AGENTS</div>
                    ${this._svgSpark(hActive, { w: 240, h: 30, color: '#34d399' })}
                </div>
                <div class="tm-agents-gauge" data-tip="${gaugeTip}">
                    ${this._svgGauge(errNorm, { w: 140, h: 72, label: err.toFixed(2) + '%', sub: 'ERROR RATE' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · SUPPLY CHAIN (4×2) — bars + sparklines + bottlenecks
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderSupply() {
        const host = document.getElementById('tm-body-supply');
        if (!host) return;
        const SC = (typeof SupplyChain !== 'undefined') ? SupplyChain : null;
        const inv = SC && SC.inventory ? SC.inventory : null;
        const bottlenecks = (typeof SUPPLY_CHAIN !== 'undefined' && Array.isArray(SUPPLY_CHAIN.bottlenecks))
            ? SUPPLY_CHAIN.bottlenecks : [];

        if (!inv) {
            host.innerHTML = '<div class="tm-empty">Supply chain unavailable</div>';
            return;
        }
        const keys = Object.keys(inv);
        const sig = 's:' + keys.map(k => k + ':' + ((inv[k] && inv[k].stock) | 0)).join('|') + '|b:' + bottlenecks.length + ':' + this._history.supply_gpu.length;
        if (this._sigCache.supply === sig) return;
        this._sigCache.supply = sig;

        const names = {
            gpu_h100: 'H100', gpu_b200: 'B200',
            helium: 'He', hbm_memory: 'HBM',
            coolant_sys: 'Coolant', electricity: 'Power'
        };
        const fullNames = {
            gpu_h100: 'NVIDIA H100 GPU',
            gpu_b200: 'NVIDIA B200 GPU',
            helium: 'Helium (coolant)',
            hbm_memory: 'High-bandwidth memory',
            coolant_sys: 'Liquid cooling systems',
            electricity: 'Grid power (MW)'
        };
        const pctColor = (p) => p >= 60 ? '#34d399' : p >= 30 ? '#fbbf24' : '#f87171';
        const pctCls   = (p) => p >= 60 ? 'tm-tip-good' : p >= 30 ? 'tm-tip-warn' : 'tm-tip-bad';
        const pctLbl   = (p) => p >= 60 ? 'Healthy' : p >= 30 ? 'Tight' : 'Shortage';
        const esc = (s) => this._esc(s);

        const rows = keys.map(k => {
            const v = inv[k] || {};
            const cap = v.capacity || 1;
            const pct = Math.max(0, Math.min(100, (v.stock || 0) / cap * 100));
            return { k, pct, stock: v.stock || 0, cap };
        }).sort((a, b) => a.pct - b.pct);

        const sparkDelta = (hist) => {
            const a = hist[0] || 0, b = hist[hist.length - 1] || 0, d = b - a;
            const cls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return `<b class="${cls}">${(d >= 0 ? '+' : '') + Math.round(d).toLocaleString()}</b>`;
        };

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-bars tm-bars-dense">
                    ${rows.slice(0, 5).map(r => {
                        const tip = this._tipAttr(
                            `<div class="tm-tip-hd">${esc(fullNames[r.k] || r.k)}</div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Stock</span><b>${r.stock.toLocaleString()}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Capacity</span><b>${r.cap.toLocaleString()}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Fill</span><b class="${pctCls(r.pct)}">${r.pct.toFixed(1)}%</b></div>` +
                            `<div class="tm-tip-body ${pctCls(r.pct)}">${pctLbl(r.pct)}</div>`
                        );
                        return `
                        <div class="tm-bar-row" data-tip="${tip}">
                            <span class="tm-bar-lbl">${esc(names[r.k] || r.k)}</span>
                            <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${r.pct.toFixed(0)}%;background:${pctColor(r.pct)}"></div></div>
                            <span class="tm-bar-val">${r.pct.toFixed(0)}%</span>
                        </div>
                    `;
                    }).join('')}
                </div>
                <div class="tm-spark-block tm-spark-block-pad">
                    <div class="tm-spark-hd" data-tip="${this._tipAttr(
                        `<div class="tm-tip-hd">GPU stockpile (16s)</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span>${sparkDelta(this._history.supply_gpu)}</div>` +
                        `<div class="tm-tip-body">Combined H100 + B200 inventory</div>`
                    )}">
                        <span class="tm-spark-t">GPU STOCK</span>
                        ${this._svgSpark(this._history.supply_gpu, { w: 120, h: 24, color: '#22d3ee' })}
                    </div>
                    <div class="tm-spark-hd" data-tip="${this._tipAttr(
                        `<div class="tm-tip-hd">HBM memory (16s)</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span>${sparkDelta(this._history.supply_hbm)}</div>` +
                        `<div class="tm-tip-body">High-bandwidth memory inventory</div>`
                    )}">
                        <span class="tm-spark-t">HBM</span>
                        ${this._svgSpark(this._history.supply_hbm, { w: 120, h: 24, color: '#a78bfa' })}
                    </div>
                </div>
                ${bottlenecks.length ? `
                    <div class="tm-subhd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Supply bottlenecks</div><div class=&quot;tm-tip-body&quot;>Upstream chokepoints throttling production</div>')}">Bottlenecks</div>
                    <div class="tm-bn-list">
                        ${bottlenecks.slice(0, 3).map(b => {
                            const load = b.load || 0;
                            const health = 100 - load;
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd">${esc(b.name)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Load</span><b class="${pctCls(health)}">${load}%</b></div>` +
                                `<div class="tm-tip-body">At ${load}% capacity — ${load >= 90 ? 'critical' : load >= 70 ? 'stressed' : 'normal'}</div>`
                            );
                            return `
                                <div class="tm-bn-row" data-tip="${tip}">
                                    <span class="tm-bn-name">${esc(b.name)}</span>
                                    <span class="tm-bn-load" style="color:${pctColor(health)}">${load}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · KARDASHEV (5×2) — big K + progress + pentagon radar + sparkline
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderKardashev() {
        const host = document.getElementById('tm-body-kardashev');
        if (!host) return;
        const K = (typeof Kardashev !== 'undefined') ? Kardashev : null;
        if (!K) {
            host.innerHTML = '<div class="tm-empty">Kardashev offline</div>';
            return;
        }

        let score = 0;
        if (typeof K.score === 'number') score = K.score;
        else if (typeof K.currentLevel === 'function') { try { score = K.currentLevel(); } catch (e) {} }
        else if (typeof K.level === 'number') score = K.level;

        const pct = Math.max(0, Math.min(100, ((score - 0.7) / 0.3) * 100));
        const sig = 'k:' + score.toFixed(4) + ':' + this._history.kardashev_score.length;
        if (this._sigCache.kardashev === sig) return;
        this._sigCache.kardashev = sig;

        // Next milestone — MILESTONES uses `k` field
        let next = null;
        if (Array.isArray(K.MILESTONES)) {
            for (const m of K.MILESTONES) {
                const t = (typeof m.k === 'number') ? m.k
                        : (typeof m.score === 'number') ? m.score
                        : (typeof m.threshold === 'number') ? m.threshold : null;
                if (t !== null && t > score) { next = { obj: m, threshold: t }; break; }
            }
        }

        // Pillar entries for radar
        const pillars = K.pillars || {};
        const pillarEntries = Object.entries(pillars).map(([k, v]) => {
            const val = (typeof v === 'number') ? v : (v && typeof v.score === 'number') ? v.score : 0;
            return { label: k.slice(0, 4).toUpperCase(), value: val <= 1 ? val : val / 100 };
        }).slice(0, 6);

        const esc = (s) => this._esc(s);
        const pillarNames = { compute: 'Compute', energy: 'Energy', cognition: 'Cognition', biology: 'Biology', space: 'Space', population: 'Population', alignment: 'Alignment' };
        const kSeriesLong = this._lhSeries('kscore');
        const kSeries = kSeriesLong.length >= 8 ? kSeriesLong : this._history.kardashev_score;
        const kStat = this._lhStat('kscore');
        const kSpan = this._lhSpan('kscore') || '16s';

        const scoreTip = this._tipAttr(
            `<div class="tm-tip-hd">Kardashev scale</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b style="color:#fbbf24">K = ${score.toFixed(3)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Type I target</span><b>K = 1.000</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Progress</span><b>${pct.toFixed(1)}% of gap</b></div>` +
            `<div class="tm-tip-body">Civilizational energy-mastery index. Earth sits near 0.73 today.</div>`
        );
        const progTip = this._tipAttr(
            `<div class="tm-tip-hd">K-gap bar</div>` +
            `<div class="tm-tip-body">Maps 0.700 → 1.000. Right edge is Type I.</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Current</span><b>${pct.toFixed(1)}%</b></div>`
        );
        const nextTip = next ? this._tipAttr(
            `<div class="tm-tip-hd">Next milestone</div>` +
            `<div class="tm-tip-body">${esc((next.obj && (next.obj.name || next.obj.id)) || 'milestone')}</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Fires at</span><b>K = ${next.threshold.toFixed(3)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">To go</span><b class="tm-tip-warn">${(next.threshold - score).toFixed(3)}</b></div>`
        ) : this._tipAttr(`<div class="tm-tip-hd">Apex reached</div><div class="tm-tip-body">Type I Kardashev achieved. No further milestones tracked.</div>`);
        const sparkTip = this._tipAttr(
            `<div class="tm-tip-hd">K-score trend · ${kSpan}</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${score.toFixed(4)}</b></div>` +
            (kStat ? `<div class="tm-tip-row"><span class="tm-tip-k">Δ ${kSpan}</span><b class="${kStat.delta >= 0 ? 'tm-tip-good' : 'tm-tip-bad'}">${(kStat.delta >= 0 ? '+' : '') + kStat.delta.toFixed(4)}</b></div>` +
                     `<div class="tm-tip-row"><span class="tm-tip-k">All-time high</span><b>${kStat.ath.toFixed(4)}</b></div>` : '') +
            `<div class="tm-tip-foot">persisted across sessions</div>`
        );
        const radarTip = this._tipAttr(
            `<div class="tm-tip-hd">Pillar radar</div>` +
            `<div class="tm-tip-body">${pillarEntries.length} civilizational pillars. Each axis shows 0-100% of Type I target.</div>` +
            `<div class="tm-tip-foot">Hover a pillar chip for details</div>`
        );

        host.innerHTML = `
            <div class="tm-k-layout">
                <div class="tm-k-left">
                    <div class="tm-stat-big tm-k-big" data-tip="${scoreTip}">
                        <span class="tm-stat-unit">K</span>
                        <span class="tm-stat-num">${score.toFixed(3)}</span>
                    </div>
                    <div class="tm-kprog" data-tip="${progTip}">
                        <div class="tm-kprog-track"><div class="tm-kprog-fill" style="width:${pct.toFixed(1)}%"></div></div>
                        <div class="tm-kprog-labels"><span>0.700</span><span>1.000</span></div>
                    </div>
                    <div class="tm-k-next" data-tip="${nextTip}">${next ? `▲ NEXT: ${esc((next.obj && (next.obj.name || next.obj.id)) || 'milestone')} @ ${next.threshold.toFixed(3)}` : '⟡ APEX'}</div>
                    <div class="tm-k-spark" data-tip="${sparkTip}">
                        <div class="tm-spark-lbl">K-SCORE TREND · ${kSpan} ${this._deltaChip('kscore', { pct: true })}</div>
                        ${this._svgSpark(kSeries, { w: 220, h: 32, color: '#fbbf24' })}
                    </div>
                </div>
                <div class="tm-k-right">
                    <div data-tip="${radarTip}">
                    ${pillarEntries.length >= 3 ? this._svgRadar(pillarEntries, { size: 180, pad: 24 }) : '<div class="tm-empty">No pillars</div>'}
                    </div>
                    <div class="tm-k-pillars">
                        ${pillarEntries.map(p => {
                            const pct100 = Math.round(p.value * 100);
                            const full = pillarNames[p.label.toLowerCase()] || pillarNames[(p.label || '').toLowerCase().slice(0,4)] || p.label;
                            const pTip = this._tipAttr(
                                `<div class="tm-tip-hd">${esc(full)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Progress</span><b style="color:#22d3ee">${pct100}%</b></div>` +
                                `<div class="tm-tip-body">${esc(p.label)} pillar contribution to K-score</div>`
                            );
                            return `
                                <div class="tm-k-pillar" data-tip="${pTip}">
                                    <span class="tm-k-pillar-name">${esc(p.label)}</span>
                                    <span class="tm-k-pillar-val">${pct100}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · POPULATION (4×1) — NPC count + workplace donut
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderPopulation() {
        const host = document.getElementById('tm-body-population');
        if (!host) return;
        const NH = (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) ? NPCHousing : null;
        const reg = NH ? NH.REGISTRY : [];

        // FIX: use NPCHousing.REGISTRY.length as the authoritative citizen count
        const sim = reg.length;
        const focusZone = this._filter.population;
        const sig = 'pop:' + sim + ':' + (focusZone || '');
        if (this._sigCache.population === sig) return;
        this._sigCache.population = sig;

        if (!sim) {
            host.innerHTML = `
                <div class="tm-stat-block">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">0</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">no registry</div>
                </div>
            `;
            return;
        }

        // Group by workplace zone prefix
        const byZone = {};
        for (const n of reg) {
            const w = String(n.workplace || 'other').toLowerCase();
            let zone = w.split(/[_:]/)[0];
            if (zone === 'dc' || zone === 'bld') zone = 'compute';
            if (zone === 'other' && w.includes('court')) zone = 'court';
            byZone[zone] = (byZone[zone] || 0) + 1;
        }
        const zoneColors = {
            compute:  '#22d3ee',
            power:    '#fbbf24',
            agents:   '#a78bfa',
            embassy:  '#60a5fa',
            vcrow:    '#34d399',
            robotics: '#fb923c',
            longev:   '#f472b6',
            backbone: '#c084fc',
            align:    '#f87171',
            univ:     '#818cf8',
            court:    '#facc15',
            space:    '#38bdf8',
            port:     '#4ade80',
            other:    '#6a6a80'
        };
        const zoneLabel = {
            compute:'Datacenters & labs', power:'Power grid', agents:'Agent platforms',
            embassy:'Embassy row', vcrow:'VC row', robotics:'Robotics', longev:'Longevity',
            backbone:'Backbone zone', align:'Alignment forest', univ:'University',
            court:'Court', space:'Spaceport', port:'Port', other:'Other / unemployed'
        };
        const sorted = Object.entries(byZone).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 6);
        const other = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
        const segments = top.map(([z, n]) => ({ label: z, value: n, color: zoneColors[z] || '#8a8aa0' }));
        if (other) segments.push({ label: 'other', value: other, color: '#4a4a5a' });
        const dimmed = segments.map(s => focusZone && s.label !== focusZone
            ? { ...s, color: '#2a2a3a' }
            : s);
        const esc = (s) => this._esc(s);

        const statTip = this._tipAttr(
            `<div class="tm-tip-hd">Population registry</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Citizens</span><b>${sim.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Zones</span><b>${sorted.length}</b></div>` +
            `<div class="tm-tip-body">Authoritative count from NPCHousing.REGISTRY</div>`
        );
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Workplace distribution</div>` +
            `<div class="tm-tip-body">Where the city's citizens commute to each morning</div>` +
            `<div class="tm-tip-foot">Click a zone row to focus</div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat" data-tip="${statTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${sim.toLocaleString()}</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">${sorted.length} zones</div>
                </div>
                <div class="tm-col tm-col-donut" data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, { size: 70, thick: 11 })}
                </div>
                <div class="tm-col tm-col-wide">
                    <div class="tm-pop-list">
                        ${top.slice(0, 4).map(([z, n]) => {
                            const active = focusZone === z;
                            const share = ((n / sim) * 100).toFixed(1) + '%';
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd" style="color:${esc(zoneColors[z] || '#8a8aa0')}">${esc((zoneLabel[z] || z).toUpperCase())}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Workers</span><b>${n}</b></div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${share}</b></div>` +
                                `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} zone</div>`
                            );
                            return `
                                <div class="tm-pop-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:population:${esc(z)}" data-tip="${tip}">
                                    <span class="tm-legend-dot" style="background:${zoneColors[z] || '#8a8aa0'}"></span>
                                    <span class="tm-pop-lbl">${esc(z.toUpperCase())}</span>
                                    <span class="tm-pop-val">${n}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
};

if (typeof window !== 'undefined') {
    window.Terminal = Terminal;

    window.enterTerminal = function () {
        Terminal._pendingOpen = true;
        // Pass the terminal flag so enterCity() animates the correct button and
        // themes the loading screen amber. enterCity() will call Terminal.open()
        // once the sim is booted.
        if (typeof enterCity === 'function') enterCity({ terminal: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Terminal.init());
    } else {
        Terminal.init();
    }
}
