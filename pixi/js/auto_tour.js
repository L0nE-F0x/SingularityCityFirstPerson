/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AUTO-TOUR / SCREENSAVER MODE (v2.0.0 — Cinematic Overhaul)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Randomised, activity-aware, cinematic camera tour with interior visits.
   Designed to look like a beautiful living screensaver on a second monitor.

   Behaviour
     • After `IDLE_MS` of no user input the tour auto-starts (or press T).
     • Each stop is chosen randomly from a large pool of city landmarks, labs,
       zones, and interiors — weighted by category:
         40 % — HIGH-ACTIVITY hot-spots  (busiest buildings right now)
         30 % — SCENIC / CINEMATIC       (wide panoramas, space zone, parks)
         20 % — INTERIOR DIVE            (enter a random building's interior)
         10 % — TRACKING FOLLOW          (follow a random walking model)
     • Variable dwell times, zoom levels, and gentle slow-pan drift per stop.
     • Tiny pill-shaped HUD indicator (top-right) so the view stays unobstructed.
     • Any real input cancels the tour.  T toggles manually.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AutoTour = {
    active: false,
    _bootOk: false,
    embedSticky: false,

    /* ── Tuning ───────────────────────────────────────────────── */
    IDLE_MS:  300000,          // 5 minutes of no input before tour auto-starts
    HOLD_MS_MIN: 10000,        // slower pace between location jumps
    HOLD_MS_MAX: 18000,
    INTERIOR_HOLD_MS: 16000,
    TRACK_HOLD_MS: 14000,
    MIN_STOPS: 3,

    /* ── Category weights (must sum to 1.0) ──────────────────── */
    W_ACTIVITY: 0.40,
    W_SCENIC:   0.30,
    W_INTERIOR: 0.20,
    W_TRACKING: 0.10,

    /* ── Scenic panorama stops (wide shots of beautiful zones) ─ */
    _scenicDefs: [
        { bldId: 'mission_control',   label: 'Space Port',        zoom: 0.75, yOffset: -60,  pan: 0.15 },
        { bldId: 'pad_spacex',        label: 'SpaceX Launch Pad',  zoom: 0.90, yOffset: -40,  pan: 0.10 },
        { bldId: 'park',              label: 'Leaderboard Park',   zoom: 1.10, yOffset: -20,  pan: 0.08 },
        { bldId: 'arena',             label: 'LMSYS Arena',        zoom: 1.00, yOffset: -25,  pan: 0.10 },
        { bldId: 'visitor_monument',  label: 'Visitor Monument',   zoom: 1.20, yOffset:  -5,  pan: 0.05 },
        { bldId: 'neon_bar',          label: 'Neon Nightlife',     zoom: 1.05, yOffset: -20,  pan: 0.12 },
        { bldId: 'forest_0',          label: 'Pine Reserve',       zoom: 0.85, yOffset: -30,  pan: 0.18 },
        { bldId: 'power_solar',       label: 'Solar + Storage',    zoom: 0.80, yOffset: -40,  pan: 0.15 },
        { bldId: 'power_nuclear',     label: 'Crane Clean Energy', zoom: 0.90, yOffset: -30,  pan: 0.10 },
        { bldId: 'port_authority',    label: 'Trade Port',         zoom: 0.80, yOffset: -35,  pan: 0.18 },
        { bldId: 'graveyard',         label: 'Model Graveyard',    zoom: 1.10, yOffset: -15,  pan: 0.06 },
        { bldId: 'convention_center', label: 'Conference Center',  zoom: 0.95, yOffset: -25,  pan: 0.12 },
        { bldId: 'court_hearing',     label: 'AI Court',           zoom: 1.10, yOffset: -15,  pan: 0.08 },
        { bldId: 'city_park',         label: 'Central Park',       zoom: 0.90, yOffset: -20,  pan: 0.14 },
        { bldId: 'uni_main',          label: 'AI Academy',         zoom: 1.00, yOffset: -25,  pan: 0.10 },
        { bldId: 'metro_mid',         label: 'Central Metro',      zoom: 1.05, yOffset: -20,  pan: 0.08 },
        { bldId: 'backbone_ixp',      label: 'Internet Exchange',  zoom: 0.90, yOffset: -30,  pan: 0.12 },
        { bldId: 'robotics_assembly', label: 'Robotics Factory',   zoom: 0.90, yOffset: -25,  pan: 0.14 },
        { bldId: 'longevity_discovery',label:'Longevity Wing',     zoom: 0.95, yOffset: -20,  pan: 0.10 },
        { bldId: 'times_hq',          label: 'Newspaper HQ',      zoom: 1.10, yOffset: -15,  pan: 0.06 },
        { bldId: 'agents_orchestrator', label: 'Agent District',  zoom: 0.90, yOffset: -25,  pan: 0.12 },
        { bldId: 'align_redwood',     label: 'Alignment Forest',   zoom: 0.90, yOffset: -25,  pan: 0.14 },
        { bldId: 'embassy_us',        label: 'Embassy Row',        zoom: 0.95, yOffset: -20,  pan: 0.12 },
        { bldId: 'vcrow_apex',        label: 'VC Row',             zoom: 0.95, yOffset: -25,  pan: 0.10 },
        // Black Market is underground — auto-tour can't visit it
    ],

    /* ── Buildings eligible for interior visits ───────────────── */
    _interiorBldIds: [
        'neon_bar', 'bld_1', 'convention_center', 'times_hq',
        'uni_main', 'uni_lab', 'uni_library',
        'court_hearing', 'court_senate',
        'dc_xai_memphis', 'dc_google_dalles', 'dc_stargate', 'dc_aws_virginia',
        'metro_east', 'metro_mid', 'metro_dc',
        'vcrow_apex', 'vcrow_titan',
        'robotics_assembly', 'robotics_testing',
        'longevity_discovery', 'longevity_genomics',
        'backbone_ixp',
        'power_nuclear', 'power_solar',
        'res_us', 'res_eu', 'res_cn',
        'agents_orchestrator', 'agents_sandbox',
        'align_redwood', 'align_apollo',
        'embassy_us', 'embassy_cn', 'diplomat_villa_us',
    ],

    /* ── Runtime state ────────────────────────────────────────── */
    _idx: 0,
    _stopStartedAt: 0,
    _currentHoldMs: 7000,
    _lastInputAt: 0,
    _overlayEl: null,
    _labelEl: null,
    _savedZoom: 1,
    _savedTargetX: 0,
    _savedTargetY: 0,
    _recentStops: [],       // last N stop IDs to avoid repeats
    _currentMode: 'scenic', // 'activity' | 'scenic' | 'interior' | 'tracking'
    _panDrift: 0,           // pixels/frame horizontal drift for cinematic feel
    _panDir: 1,             // 1 or -1
    _isInsideBuilding: false,
    _trackingModelId: null,

    /* ═══════════════════════════════════════════════════════════ */
    init() {
        if (this._bootOk) return;
        this._bootOk = true;
        this._lastInputAt = performance.now();

        /* ── Tiny pill overlay — top-right, unobtrusive ─────── */
        const el = document.createElement('div');
        el.id = 'autoTourOverlay';
        el.style.cssText = [
            'position:fixed',
            'top:max(12px, env(safe-area-inset-top))',
            'right:max(12px, env(safe-area-inset-right))',
            'z-index:99998',
            'padding:5px 12px',
            'background:rgba(0,0,0,0.55)',
            'border:1px solid rgba(120,220,255,0.3)',
            'border-radius:20px',
            'color:#8df',
            'font:8px/1.4 "Press Start 2P","Courier New",monospace',
            'letter-spacing:0.5px',
            'text-shadow:0 0 4px rgba(120,220,255,0.4)',
            'pointer-events:none',
            'opacity:0',
            'transition:opacity 400ms ease',
            'user-select:none',
            'backdrop-filter:blur(2px)',
            '-webkit-backdrop-filter:blur(2px)',
            'white-space:nowrap',
        ].join(';');
        el.innerHTML =
            '<span style="color:#9fd;margin-right:6px">◆</span>' +
            '<span id="autoTourLabel" style="color:#cfe">AUTO-TOUR</span>';
        document.body.appendChild(el);
        this._overlayEl = el;
        this._labelEl = el.querySelector('#autoTourLabel');

        /* ── Input listeners ────────────────────────────────── */
        const bump = () => this._onUserInput();
        window.addEventListener('pointerdown', bump, true);
        window.addEventListener('pointermove', (e) => {
            if (this._lastMoveX === undefined) { this._lastMoveX = e.clientX; this._lastMoveY = e.clientY; return; }
            const dx = e.clientX - this._lastMoveX;
            const dy = e.clientY - this._lastMoveY;
            if (dx * dx + dy * dy < 9) return;
            this._lastMoveX = e.clientX;
            this._lastMoveY = e.clientY;
            bump();
        }, true);
        window.addEventListener('wheel', bump, { capture: true, passive: true });
        window.addEventListener('touchstart', bump, { capture: true, passive: true });
        window.addEventListener('keydown', (e) => {
            if ((e.key === 't' || e.key === 'T') &&
                !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable))) {
                e.preventDefault();
                this.toggle();
                return;
            }
            bump();
        }, true);
    },

    /* ═══════════════════════════════════════════════════════════ */
    update() {
        if (!this._bootOk) return;
        const now = performance.now();

        if (this.active) {
            this._tickActive(now);
            return;
        }

        // Idle watchdog — user can disable the auto-start screensaver or change
        // its delay in Settings. Manual start (T / toggle()) is unaffected.
        if (typeof G !== 'undefined' && G.prefs && G.prefs.autoTour === false) return;
        const idleMs = (typeof G !== 'undefined' && G.prefs && G.prefs.idleTourMin > 0)
            ? G.prefs.idleTourMin * 60000
            : this.IDLE_MS;
        if (now - this._lastInputAt >= idleMs && this._canStart()) {
            this.start();
        }
    },

    _canStart() {
        if (typeof G === 'undefined' || !G.app) return false;
        if (G.activeInterior) return false;
        if (G.trainFocus) return false;            // don't hijack the camera while riding a train
        if (G.viewMode === 'macro') return false;
        if (G.tracking) return false;
        if (typeof OrbitMode !== 'undefined' && (OrbitMode.active || OrbitMode._transitioning)) return false;
        if (typeof XRayMode !== 'undefined' && XRayMode.active) return false;
        if (document.querySelector('.ov.open, .modal.open, #settingsPanel.open')) return false;
        if (typeof G !== 'undefined' && G.tick < 120) return false;
        return true;
    },

    toggle() {
        if (this.active) this.stop('toggle');
        else {
            if (!this._canStart()) {
                if (typeof UI !== 'undefined' && UI.addToast) UI.addToast('Auto-tour unavailable in this mode');
                return;
            }
            this.start();
        }
    },

    /* ═══════════════════════════════════════════════════════════ */
    start() {
        if (this.active) return;
        if (!this._canStart()) return;

        this._savedZoom = Camera.targetZoom;
        this._savedTargetX = Camera.targetX;
        this._savedTargetY = Camera.targetY;
        this._userZoom = Camera.targetZoom; // preserve user's zoom level
        this._recentStops = [];
        this._isInsideBuilding = false;
        this._trackingModelId = null;

        this.active = true;
        this._stopStartedAt = performance.now();
        this._pickAndAdvance();
        this._showOverlay();
    },

    stop(reason) {
        if (!this.active) return;
        this.active = false;

        // If we're inside a building, exit first
        if (this._isInsideBuilding && G.activeInterior) {
            this._exitInterior();
        }

        // If we were tracking, stop
        if (this._trackingModelId && G.tracking) {
            G.stopTracking();
            this._trackingModelId = null;
        }

        this._hideOverlay();
        if (reason === 'toggle' && this._savedZoom) {
            Camera.targetZoom = this._savedZoom;
        }
    },

    _onUserInput() {
        this._lastInputAt = performance.now();
        if (this.embedSticky) return;
        if (this.active) this.stop('input');
    },

    /* ═══════════════════════════════════════════════════════════ */
    _tickActive(now) {
        // Safety — bail if we entered a blocking mode
        if (G.viewMode === 'macro') { this.stop('mode-change'); return; }
        if (typeof OrbitMode !== 'undefined' && (OrbitMode.active || OrbitMode._transitioning)) { this.stop('mode-change'); return; }
        if (typeof XRayMode !== 'undefined' && XRayMode.active) { this.stop('mode-change'); return; }

        // Safety — if we think we're inside but the interior was already closed, reset flag.
        // IMPORTANT: skip during an in-flight transition — `_transitionEnter` sets
        // `_transitioning=true` and opens the overlay for 200ms before G.activeInterior
        // actually becomes set, so without this guard we'd reset the flag in the gap
        // and then the next safety check would immediately exit the interior.
        if (this._isInsideBuilding && !G.activeInterior && !G._transitioning) {
            this._isInsideBuilding = false;
            this._interiorEnteredAt = null;
        }

        // Safety — if we're in an interior we didn't enter deliberately
        // (e.g., tracked model walked into a building via engine tracking code)
        if (G.activeInterior && !this._isInsideBuilding && !this._trackingModelId && !G._transitioning) {
            this._exitInterior();
            this._stopStartedAt = now;
            this._currentHoldMs = 1500;
            return;
        }

        // Safety timeout — force-exit if stuck inside a building for too long
        if (this._isInsideBuilding && G.activeInterior && this._interiorEnteredAt) {
            const stuckMs = now - this._interiorEnteredAt;
            if (stuckMs > this.INTERIOR_HOLD_MS + 8000) {
                // Something went wrong — force exit to keep the tour moving
                this._exitInterior();
                this._isInsideBuilding = false;
                this._interiorEnteredAt = null;
                this._stopStartedAt = now;
                this._currentHoldMs = 1500;
                return;
            }
        }

        // Apply gentle horizontal drift for cinematic panning (exterior only)
        if (!this._isInsideBuilding && !this._trackingModelId && this._panDrift) {
            Camera.targetX += this._panDrift * this._panDir;
        }

        // Advance when hold time elapsed
        if (now - this._stopStartedAt >= this._currentHoldMs) {
            // If inside a building, exit first before next stop
            if (this._isInsideBuilding) {
                this._exitInterior();
                this._isInsideBuilding = false;
                this._interiorEnteredAt = null;
                // Pause after exiting so the zoom/fade glide back to user level before the next jump
                this._stopStartedAt = now;
                this._currentHoldMs = 2500;
                return;
            }
            // If tracking, stop tracking — also exit interior if tracking led us into one.
            // G.stopTracking() restores AutoTour._userZoom automatically; we also restore the
            // saved Y so the underground view (metro/pipes) comes back for the next scenic stop.
            if (this._trackingModelId) {
                if (G.activeInterior) this._exitInterior();
                if (G.tracking) G.stopTracking();
                this._trackingModelId = null;
                if (this._savedTargetY !== undefined) Camera.targetY = this._savedTargetY;
                this._stopStartedAt = now;
                this._currentHoldMs = 2500;
                return;
            }
            this._pickAndAdvance();
            this._stopStartedAt = now;
        }
    },

    /* ═══════════════════════════════════════════════════════════ */
    /*  STOP SELECTION — weighted random by category              */
    /* ═══════════════════════════════════════════════════════════ */
    _pickAndAdvance() {
        const roll = Math.random();
        let mode;
        if (roll < this.W_ACTIVITY) mode = 'activity';
        else if (roll < this.W_ACTIVITY + this.W_SCENIC) mode = 'scenic';
        else if (roll < this.W_ACTIVITY + this.W_SCENIC + this.W_INTERIOR) mode = 'interior';
        else mode = 'tracking';

        this._currentMode = mode;

        switch (mode) {
            case 'activity': this._advanceActivity(); break;
            case 'scenic':   this._advanceScenic();   break;
            case 'interior': this._advanceInterior(); break;
            case 'tracking': this._advanceTracking(); break;
        }
    },

    /* ── ACTIVITY: find the busiest buildings and visit one ──── */
    _advanceActivity() {
        if (typeof G === 'undefined' || !G.models || !G.charRefs || !G.bldById) {
            this._advanceScenic(); return;
        }

        // Count population per building
        const pop = {};
        const now = Date.now();
        for (const m of G.models) {
            if (m.ret && new Date(m.ret).getTime() <= now) continue;
            const refs = G.charRefs[m.id];
            if (!refs || !refs.bld) continue;
            pop[refs.bld] = (pop[refs.bld] || 0) + 1;
        }

        // Sort buildings by population, pick from top 10
        const entries = Object.entries(pop)
            .filter(([id]) => G.bldById[id] && !this._recentStops.includes(id))
            .sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) { this._advanceScenic(); return; }

        const topN = entries.slice(0, Math.min(10, entries.length));
        const pick = topN[Math.floor(Math.random() * topN.length)];
        const bldId = pick[0];
        const count = pick[1];
        const b = G.bldById[bldId];

        this._addRecent(bldId);

        const holdMs = this.HOLD_MS_MIN + Math.random() * (this.HOLD_MS_MAX - this.HOLD_MS_MIN);
        this._currentHoldMs = holdMs;

        // Gentle pan drift (halved for smoother cinematic feel)
        this._panDrift = 0.03 + Math.random() * 0.05;
        this._panDir = Math.random() < 0.5 ? 1 : -1;

        // Only pan horizontally — preserve user's zoom and Y so underground view
        // (metro rails, water/electric pipes) stays visible throughout the tour.
        const z = Camera.zoom || this._userZoom || 1;
        const worldX = b.x + b.w / 2;
        Camera.targetX = -(worldX) + (G.vpW / 2) / z;

        const label = (b.lab ? b.lab.toUpperCase() + ' HQ' : b.label || b.id) + ' (' + count + ' active)';
        this._setLabel(label);
    },

    /* ── SCENIC: pick a random panoramic shot ──────────────── */
    _advanceScenic() {
        // Filter to only existing buildings, exclude recent
        const avail = this._scenicDefs.filter(d =>
            G.bldById && G.bldById[d.bldId] && !this._recentStops.includes(d.bldId)
        );

        if (avail.length === 0) {
            // Reset recents if we've exhausted everything
            this._recentStops = [];
            const fallback = this._scenicDefs.filter(d => G.bldById && G.bldById[d.bldId]);
            if (fallback.length === 0) return;
            this._advanceScenic();
            return;
        }

        const def = avail[Math.floor(Math.random() * avail.length)];
        const b = G.bldById[def.bldId];
        this._addRecent(def.bldId);

        const holdMs = this.HOLD_MS_MIN + Math.random() * (this.HOLD_MS_MAX - this.HOLD_MS_MIN);
        this._currentHoldMs = holdMs;

        // Cinematic drift (halved for smoother cinematic feel)
        this._panDrift = (def.pan || 0.10) * 0.5;
        this._panDir = Math.random() < 0.5 ? 1 : -1;

        // Only pan horizontally — preserve user's zoom and Y so underground view
        // (metro rails, water/electric pipes) stays visible throughout the tour.
        const z = Camera.zoom || this._userZoom || 1;
        const worldX = b.x + b.w / 2;
        Camera.targetX = -(worldX) + (G.vpW / 2) / z;

        this._setLabel(def.label);
    },

    /* ── INTERIOR: enter a random building ─────────────────── */
    _advanceInterior() {
        if (typeof G === 'undefined' || !G.bldById || G.activeInterior) {
            this._advanceScenic(); return;
        }

        // Filter to existing, non-recent buildings
        const avail = this._interiorBldIds.filter(id =>
            G.bldById[id] && !this._recentStops.includes(id)
        );

        if (avail.length === 0) { this._advanceScenic(); return; }

        const bldId = avail[Math.floor(Math.random() * avail.length)];
        const b = G.bldById[bldId];
        this._addRecent(bldId);

        // First pan to the building — only modify X so the user's Y/zoom is preserved
        const z = Camera.zoom || this._userZoom || 1;
        const worldX = b.x + b.w / 2;
        Camera.targetX = -(worldX) + (G.vpW / 2) / z;
        this._panDrift = 0;

        const label = b.lab ? b.lab.toUpperCase() + ' — Inside' : (b.label || bldId) + ' — Inside';
        this._setLabel(label);

        // Enter interior after a brief pause to let the (now slower) pan complete
        this._currentHoldMs = this.INTERIOR_HOLD_MS;
        setTimeout(() => {
            if (!this.active) return;
            if (G.activeInterior) return;
            // Use the transition-based entry for smooth fade
            if (typeof G !== 'undefined' && G._transitionEnter) {
                G._transitionEnter(b);
            } else if (typeof G !== 'undefined' && G.enterInterior) {
                G.enterInterior(b);
            }
            this._isInsideBuilding = true;
            this._interiorEnteredAt = performance.now();
        }, 3500);
    },

    /* ── TRACKING: follow a random walking model ───────────── */
    _advanceTracking() {
        if (typeof G === 'undefined' || !G.models || !G.charRefs) {
            this._advanceScenic(); return;
        }

        // Find models that are currently walking outside (visible, no building)
        const now = Date.now();
        const walkers = G.models.filter(m => {
            if (m.ret && new Date(m.ret).getTime() <= now) return false;
            const refs = G.charRefs[m.id];
            if (!refs || !refs.c) return false;
            if (refs.bld) return false;
            if (!refs.c.visible) return false;
            return true;
        });

        if (walkers.length === 0) { this._advanceActivity(); return; }

        const model = walkers[Math.floor(Math.random() * walkers.length)];

        // Use the game's built-in tracking system
        G.tracking = { type: 'model', id: model.id, lab: model.lab };
        this._trackingModelId = model.id;
        this._panDrift = 0;
        this._currentHoldMs = this.TRACK_HOLD_MS;

        const label = 'Following ' + (model.name || model.id);
        this._setLabel(label);
    },

    /* ═══════════════════════════════════════════════════════════ */
    _exitInterior() {
        if (typeof G !== 'undefined' && G.activeInterior) {
            if (G._transitionExit) {
                G._transitionExit();
            } else if (G._performExitInterior) {
                G._performExitInterior();
            }
        }
        this._isInsideBuilding = false;
        this._interiorEnteredAt = null;
    },

    _addRecent(id) {
        this._recentStops.push(id);
        // Keep a rolling window so we don't repeat the last 8 stops
        if (this._recentStops.length > 8) this._recentStops.shift();
    },

    _setLabel(text) {
        if (this._labelEl) this._labelEl.textContent = text;
    },

    /* ═══════════════════════════════════════════════════════════ */
    _showOverlay() {
        if (!this._overlayEl) return;
        this._overlayEl.style.opacity = '1';
    },

    _hideOverlay() {
        if (!this._overlayEl) return;
        this._overlayEl.style.opacity = '0';
    },
};
