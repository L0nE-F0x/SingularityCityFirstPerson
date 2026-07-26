/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERACTIVE TUTORIAL (v1.0.0)
   ────────────────────────────────────────────────────────────────────────────────────────────────────
   A guided 30-step walkthrough that introduces every major feature of Singularity City.
   Opt-in only — launched from the "▶ START INTERACTIVE TUTORIAL" button inside the
   "❓ How It Works" panel on the landing page (or after entering the city).

   Architecture:
     • Step queue with chapter grouping
     • DOM spotlight (cut-out + dimmed mask) for UI buttons / overlays
     • World-anchor spotlight that flies the camera and highlights a virtual rect
     • Coach mark bubble with title/body/progress/controls
     • Mobile vs desktop copy variants (auto-detected)
     • Manual Next button (no auto-advance)
     • Skip-anytime control + state cleanup that restores prior view modes
     • localStorage flag `tutorial_completed` so we never auto-prompt
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

const IS_MOBILE = !!(window.isMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────────────
function getEl(id) { return document.getElementById(id); }

function getBldByPredicate(fn) {
    if (typeof BLDS === 'undefined' || !BLDS) return null;
    for (let i = 0; i < BLDS.length; i++) { if (fn(BLDS[i])) return BLDS[i]; }
    return null;
}

function flyToWorld(worldX, worldY, zoom) {
    if (typeof Camera === 'undefined' || typeof G === 'undefined') return;
    const z = zoom != null ? zoom : 1.0;
    Camera.targetZoom = z;
    Camera.targetX = -(worldX) + (G.vpW / 2) / z;
    const groundAnchor = (G.groundY || 360) * (1 / z - 1);
    Camera.targetY = groundAnchor + (worldY != null ? worldY : 0);
}

function flyToBuilding(b, opts) {
    if (!b) return;
    const o = opts || {};
    const z = o.zoom != null ? o.zoom : 1.0;
    const cx = b.x + b.w / 2;
    flyToWorld(cx, o.yOffset || 0, z);
}

// ─── Tutorial Steps ────────────────────────────────────────────────────────────────────────────────
// Each step: { chapter, title, body (or bodyMobile/bodyDesktop), target, placement, onEnter, onExit }
//   target: a CSS selector (DOM element), or { worldRect: {x,y,w,h} } for world coords, or null (centered)
//   placement: 'top' | 'bottom' | 'left' | 'right' | 'center' (auto-fallback)
const STEPS = [
    // ════════ CHAPTER 1 — WELCOME ════════
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'Welcome to Singularity City',
        body: "This is a <b>real-time simulation of the AI industry</b> — every building, character, and headline reflects the actual state of frontier AI labs. I'll walk you through everything in about 5 minutes. You can <b>skip anytime</b> using the button at the bottom.",
        target: null,
        placement: 'center',
    },
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'The City Is Alive',
        bodyDesktop: "The streets are full of <b>AI models walking around as little characters</b>. Each one is a real model — sized by parameter count, colored by lab. They age (baby → kid → adult → retired), commute, sleep, and have unique appearances based on their architecture.",
        bodyMobile: "Every little character is a <b>real AI model</b> — sized by parameter count, colored by lab. They age, commute, sleep, and live their lives.",
        target: null,
        placement: 'center',
        onEnter: function () {
            // Reset camera to a nice city default view
            flyToWorld((typeof G !== 'undefined' && G.cityW ? G.cityW * 0.4 : 2000), 0, 1.0);
        }
    },
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'Click Anything',
        bodyDesktop: "<b>Click any character</b> for their full profile. <b>Click any building</b> to enter its interior. <b>Drag to pan</b> across the city, and <b>scroll to zoom</b>. We'll cover the rest in the steps ahead.",
        bodyMobile: "<b>Tap any character</b> for their profile. <b>Tap any building</b> to enter. <b>Swipe to pan</b>, <b>pinch to zoom</b>. Let's go.",
        target: null,
        placement: 'center',
    },

    // ════════ CHAPTER 2 — TOP BAR & DASHBOARDS ════════
    {
        chapter: 'Chapter 2 · Top Bar',
        title: 'The Control Bar',
        bodyDesktop: "This top bar is your command center. Every button opens a different dashboard — leaderboards, census, calendars, costs, news, achievements, and more. Let's go through the most important ones.",
        bodyMobile: "This is the control bar. Scroll it sideways to see all the buttons. Each opens a different dashboard.",
        target: '#ctrlBar',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: '🛰️ Scan',
        body: "<b>Scan</b> uses your AI API key to <b>discover 4 brand new real models per scan</b>. It does gap analysis to find under-represented labs, then materializes the new models as walking characters. New CEOs get auto-built mansions on Billionaire's Row.",
        target: '#btnScan',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: '🌍 Holomap',
        body: "Click <b>Holomap</b> for a full <b>3D galaxy view</b> of the AI industry. Every lab is a glowing nebula orbiting a central singularity. Every model is a star. Drag to orbit, scroll to zoom, click any star for stats. We'll skip it for now — try it later.",
        target: '#btnMacro',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: '📋 Log',
        body: "The <b>Scan Log</b> is a live feed of every AI model that's been discovered, every news event, and every system action. It's your chronological history of the simulation.",
        target: '#btnLog',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: 'Dashboards Galore',
        body: "Other buttons: <b>📊 Bench</b> (leaderboard), <b>👥 Census</b> (everyone in the city), <b>🚀 Launches</b> (rocket schedule), <b>🧬 Lineage</b> (model family trees), <b>📰 News</b>, <b>📅 Calendar</b>, <b>🏭 Hardware</b>, <b>⚡ Grid</b>, <b>💰 Costs</b>, <b>🤖 Analyst</b>, <b>🏆 Trophies</b>. Explore them after the tour.",
        target: '#ctrlBar',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: '🔬 X-Ray Mode',
        body: "<b>X-Ray</b> dims the city and reveals building wireframes, lab-colored outlines, ID labels, data flow packets, and a sweeping scan line. A diagnostic hacker view for data nerds.",
        target: '#btnXRay',
        placement: 'bottom',
    },
    {
        chapter: 'Chapter 2 · Top Bar',
        title: '⚙️ Settings & 🔊 Sound',
        body: "<b>Settings</b> is where you paste your API keys (Gemini, OpenAI, Anthropic, Grok, Finnhub) to power scanning, the AI Analyst, and live stock tickers on HQ rooftops. The <b>🔊</b> button toggles the soundscape.",
        target: '#btnSound',
        placement: 'bottom',
    },

    // ════════ CHAPTER 3 — ZONES ════════
    {
        chapter: 'Chapter 3 · Zones',
        title: 'Tour the City Zones',
        body: "The city stretches across many themed zones — port, space, compute, residential, tech, conference, robotics, longevity, agents, billionaire's row, power grid, and more. I'll fly you through the highlights.",
        target: null,
        placement: 'center',
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🚢 Port District',
        body: "On the far left is the <b>Port</b> — where GPU shipments arrive by container ship. Cranes unload, trucks haul, and the supply chain feeds the data centers. This is the start of the AI hardware pipeline.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('port_'));
            if (b) flyToBuilding(b, { zoom: 0.85 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🚀 Space Zone',
        body: "The desert biome with <b>13 launch pads</b> (SpaceX, Blue Origin, NASA, CNSA, ESA, ULA, Rocket Lab, ISRO, JAXA, Roscosmos and more), Vehicle Assembly Building, Mission Control, and an Orbital Tracking Station. Rockets launch based on <b>real-time data</b> from the Launch Library 2 API.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'launchpad' || b.type === 'mission_control');
            if (b) flyToBuilding(b, { zoom: 0.9 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🖥️ Compute District',
        body: "The <b>Data Center District</b> — massive server farms with rooftop cooling towers, GPU racks visible through the windows, and live power-draw meters. Click any DC to enter and walk the server aisles. Each cluster is themed by a real provider.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'dc' || (b.id && b.id.startsWith('dc_')));
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🏠 Residential & 🎓 University',
        body: "AI models live in apartment buildings, eat at noodle stands, and study at the <b>University</b> (where rumored upcoming models train before release). Watch the campus quad fill up at lunch.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'university');
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🏛️ AI Court',
        body: "The <b>AI Court</b> — where lawsuits, copyright disputes, and regulatory hearings about AI labs play out. Real cases get added to the docket as news breaks.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'court');
            if (b) flyToBuilding(b, { zoom: 1.1 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🏢 Tech District & HQs',
        body: "Each lab has a <b>headquarters tower</b> that grows taller as they release more models. Stock tickers crawl across rooftops (live from Finnhub if you set a key). The lab with the highest ELO gets a <b>golden Apex Beacon</b>.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'hq');
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '📝 Conference Center',
        body: "The <b>Conference Center</b> hosts NeurIPS, ICML, ICLR, and other real AI events on their actual dates. AI models walk in to present papers. Check the <b>📅 Cal</b> button to see the schedule.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'conference');
            if (b) flyToBuilding(b, { zoom: 1.05 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🚇 Metro Stations',
        body: "Four <b>metro lines</b> run under the city. AI models commute via the subway — you can <b>enter any station</b> to see them waiting on the platform, boarding trains, and traveling between zones. Track a model and watch it ride the metro.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'metro');
            if (b) flyToBuilding(b, { zoom: 1.1 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🍸 Neon Bar',
        body: "The <b>Neon Bar</b> — where AI models go after work. Sip drinks, play pool, dance to synthwave. The bar is one of the most detailed interiors in the city.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'bar');
            if (b) flyToBuilding(b, { zoom: 1.1 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🌐 The Backbone',
        body: "<b>The Backbone</b> — the physical fiber-optic core of the internet. Routers, exchange points, and intercontinental cable terminals. Without this, none of the AI labs could talk to each other.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('backbone_'));
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🤖 Robotics Factory',
        body: "The <b>Physical AI Manufacturing District</b>: Assembly Line, Testing Ground, Deployment Dock, R&D Lab. Watch walking robot prototypes, welding sparks, and conveyor belts. Tesla Optimus, Figure, Boston Dynamics, Unitree, Agility — they all work here.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('robotics_'));
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🧬 Longevity Wing',
        body: "<b>Drug discovery and life extension</b> powered by AI: Drug Discovery Lab, Clinical Trials, Genomics Sequencing, Cryonics Vault. Calico, Altos Labs, Insilico Medicine, Isomorphic Labs all have presence here. Animated DNA helices and cryo vapor.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('longevity_'));
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '🤖 Agent District',
        body: "The newest neighborhood — home to <b>autonomous AI agents</b>. Browser agents, coding agents, research agents, computer-use agents. Watch them spawn task threads in real time. This is where agentic AI lives.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('agents_'));
            if (b) flyToBuilding(b, { zoom: 1.0 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '💰 VC Row & 🏡 Billionaire\'s Row',
        body: "<b>VC Row</b> is where animated funding rounds happen — money particles fly between investors and labs. Next door, <b>Billionaire's Row</b> houses every CEO's mansion. They drive luxury cars between HQ and home, and helicopter to Silicon Woods on weekends.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.type === 'vcrow' || (b.id && b.id.startsWith('vc_')));
            if (b) flyToBuilding(b, { zoom: 0.95 });
        }
    },
    {
        chapter: 'Chapter 3 · Zones',
        title: '⚡ Power Grid',
        body: "On the far right edge — the <b>Power Grid</b>: nuclear reactors, solar farms, transmission towers, and live power-draw meters. AI labs consume gigawatts. Click <b>⚡ Grid</b> in the top bar to see the live status.",
        target: null,
        placement: 'center',
        onEnter: function () {
            const b = getBldByPredicate(b => b.id && b.id.startsWith('power_'));
            if (b) flyToBuilding(b, { zoom: 0.9 });
        }
    },

    // ════════ CHAPTER 4 — INTERACTION ════════
    {
        chapter: 'Chapter 4 · Tracking',
        title: '📡 Camera Tracking',
        bodyDesktop: "Click any AI model or CEO, then press <b>📡 Track</b> to lock the camera on them. The camera follows them everywhere — through metro tunnels, into building interiors, up elevators, into helicopters. Drag to cancel.",
        bodyMobile: "Tap any character, then tap <b>📡 Track</b>. The camera follows them everywhere — through tunnels, into buildings, up elevators. Tap-and-drag to cancel.",
        target: null,
        placement: 'center',
    },
    {
        chapter: 'Chapter 4 · Tracking',
        title: '🗺️ Minimap',
        bodyDesktop: "The <b>minimap</b> in the bottom-right shows the whole city. Click any zone label to fast-travel there. There's also a <b>🛰️ Orbit</b> button that pulls the camera up into <b>Low Earth Orbit</b> where you can see the curvature of Earth and real satellite positions from CelesTrak.",
        bodyMobile: "The <b>minimap</b> shows the whole city. Tap zone labels to fast-travel. The <b>🛰️ Orbit</b> button enters Low Earth Orbit with real satellite tracking.",
        target: '#minimap',
        placement: 'left',
    },
    {
        chapter: 'Chapter 4 · Tracking',
        title: '▶ NEWS Ticker',
        body: "The <b>news ticker</b> at the bottom is a live feed of AI industry headlines — model releases, funding rounds, lawsuits, benchmark updates. Real news, fetched from the AI scanner.",
        target: '.tick',
        placement: 'top',
    },

    // ════════ CHAPTER 5 — FINALE ════════
    {
        chapter: 'Chapter 5 · You\'re Ready',
        title: "You're Ready to Explore",
        bodyDesktop: "That's the full tour! There's much more to discover — easter eggs, seasonal events, the black market, the city park, weekly newspaper, achievements, and more. <b>Click anything that catches your eye.</b><br><br>You can re-open this tutorial anytime from the <b>❓ How It Works</b> panel.",
        bodyMobile: "That's the tour! There's lots more to discover — events, easter eggs, achievements, hidden zones. Tap anything that catches your eye.<br><br>Re-open this tutorial anytime from <b>❓ How It Works</b>.",
        target: null,
        placement: 'center',
    },
];

// ─── Tutorial Engine ───────────────────────────────────────────────────────────────────────────────
const Tutorial = {
    _idx: 0,
    _active: false,
    _ov: null,
    _spotEl: null,
    _coachEl: null,
    _resizeHandler: null,
    _savedState: null,

    start() {
        if (this._active) return;
        try { localStorage.setItem('tutorial_started', '1'); } catch (e) {}

        // If the landing page is still showing, the user clicked "Start Tutorial" before
        // ever entering the city. We need to enter the city first so the world / DOM
        // buttons are available, THEN begin the tour.
        const landing = getEl('landing');
        const landingVisible = landing && getComputedStyle(landing).display !== 'none';

        if (landingVisible && typeof window.enterCity === 'function') {
            try { window.enterCity(); } catch (e) { console.warn('[Tutorial] enterCity failed', e); }
            this._waitForCityReady(() => this._beginTour());
        } else {
            this._beginTour();
        }
    },

    _waitForCityReady(cb) {
        // Poll until G.app + G.tick has settled past initial boot, with a timeout fallback
        let attempts = 0;
        const maxAttempts = 600; // ~10s at 60fps
        const tick = () => {
            attempts++;
            const ready = (typeof G !== 'undefined' && G.app && G.app.stage && (G.tick || 0) >= 60);
            if (ready) { cb(); return; }
            if (attempts >= maxAttempts) { cb(); return; } // give up and start anyway
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    },

    _beginTour() {
        this._active = true;
        this._idx = 0;

        // Save user state we'll restore on exit
        this._savedState = {
            xrayActive: (typeof XRayMode !== 'undefined' && XRayMode.active) || false,
            macroActive: (typeof G !== 'undefined' && G.macroMode) || false,
            orbitActive: (typeof OrbitMode !== 'undefined' && OrbitMode.active) || false,
            cameraX: (typeof Camera !== 'undefined') ? Camera.targetX : 0,
            cameraY: (typeof Camera !== 'undefined') ? Camera.targetY : 0,
            cameraZoom: (typeof Camera !== 'undefined') ? Camera.targetZoom : 1,
        };

        this._buildOverlay();
        this._render();
        // Re-position spotlight on resize
        this._resizeHandler = () => this._render(true);
        window.addEventListener('resize', this._resizeHandler);
    },

    next() {
        if (!this._active) return;
        const cur = STEPS[this._idx];
        if (cur && typeof cur.onExit === 'function') { try { cur.onExit(); } catch (e) {} }
        this._idx++;
        if (this._idx >= STEPS.length) { this.complete(); return; }
        this._render();
    },

    prev() {
        if (!this._active || this._idx <= 0) return;
        const cur = STEPS[this._idx];
        if (cur && typeof cur.onExit === 'function') { try { cur.onExit(); } catch (e) {} }
        this._idx--;
        this._render();
    },

    skip() {
        if (!this._active) return;
        this._teardown();
    },

    complete() {
        try { localStorage.setItem('tutorial_completed', '1'); } catch (e) {}
        this._teardown();
    },

    _teardown() {
        const cur = STEPS[this._idx];
        if (cur && typeof cur.onExit === 'function') { try { cur.onExit(); } catch (e) {} }
        this._active = false;
        if (this._ov) { this._ov.classList.remove('active'); }
        if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
        // Don't restore camera — user is probably interested in wherever the tour ended.
    },

    _buildOverlay() {
        let ov = getEl('tutOv');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'tutOv';
            document.body.appendChild(ov);
        }
        ov.innerHTML = `
            <div class="tut-mask" id="tutMask"></div>
            <div class="tut-spotlight" id="tutSpot" style="display:none"></div>
            <div class="tut-coach" id="tutCoach">
                <div class="tut-coach-arrow" id="tutArrow"></div>
                <div class="tut-chapter" id="tutChapter"></div>
                <div class="tut-title" id="tutTitle"></div>
                <div class="tut-body" id="tutBody"></div>
                <div class="tut-progress">
                    <div class="tut-progress-bar"><div class="tut-progress-fill" id="tutFill"></div></div>
                    <div class="tut-progress-text" id="tutProgText"></div>
                </div>
                <div class="tut-controls">
                    <button class="tut-btn tut-btn-skip" id="tutSkip">Skip Tour</button>
                    <button class="tut-btn" id="tutPrev">← Back</button>
                    <button class="tut-btn tut-btn-next" id="tutNext">Next →</button>
                </div>
            </div>
        `;
        ov.classList.add('active');
        this._ov = ov;
        this._spotEl = getEl('tutSpot');
        this._coachEl = getEl('tutCoach');

        // Bind controls
        getEl('tutNext').onclick = () => this.next();
        getEl('tutPrev').onclick = () => this.prev();
        getEl('tutSkip').onclick = () => this.skip();
        // Click on dimmed mask = no-op (we don't want accidental skip)
        getEl('tutMask').onclick = (e) => { e.stopPropagation(); };
    },

    _render(skipOnEnter) {
        const step = STEPS[this._idx];
        if (!step) return;

        // Run onEnter to fly camera / mutate state for this step
        if (!skipOnEnter && typeof step.onEnter === 'function') {
            try { step.onEnter(); } catch (e) { console.warn('[Tutorial] onEnter failed', e); }
        }

        // Populate text
        getEl('tutChapter').textContent = step.chapter || '';
        getEl('tutTitle').textContent = step.title || '';
        const bodyHTML = IS_MOBILE && step.bodyMobile ? step.bodyMobile
                       : (!IS_MOBILE && step.bodyDesktop ? step.bodyDesktop
                       : (step.body || step.bodyDesktop || step.bodyMobile || ''));
        getEl('tutBody').innerHTML = bodyHTML;

        // Progress
        const pct = Math.round(((this._idx + 1) / STEPS.length) * 100);
        getEl('tutFill').style.width = pct + '%';
        getEl('tutProgText').textContent = `${this._idx + 1} / ${STEPS.length}`;

        // Prev button visibility
        getEl('tutPrev').style.display = this._idx === 0 ? 'none' : '';

        // Next button label on final step
        getEl('tutNext').textContent = (this._idx === STEPS.length - 1) ? '✓ Finish' : 'Next →';

        // Position spotlight + coach
        this._positionForStep(step);
    },

    _positionForStep(step) {
        const coach = this._coachEl;
        const spot = this._spotEl;
        const arrow = getEl('tutArrow');

        // Reset coach classes
        coach.classList.remove('center');
        if (arrow) arrow.className = 'tut-coach-arrow';

        // Centered (no target) → just place coach in middle
        if (!step.target) {
            spot.style.display = 'none';
            coach.classList.add('center');
            // Inline transform handled by .tut-coach.center in CSS
            coach.style.left = '';
            coach.style.top = '';
            coach.style.right = '';
            coach.style.bottom = '';
            coach.style.transform = '';
            return;
        }

        // DOM target
        const targetEl = (typeof step.target === 'string') ? document.querySelector(step.target) : null;
        if (!targetEl) {
            // Fallback to centered
            spot.style.display = 'none';
            coach.classList.add('center');
            return;
        }

        const r = targetEl.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
            spot.style.display = 'none';
            coach.classList.add('center');
            return;
        }

        // Place spotlight
        const pad = 8;
        spot.style.display = 'block';
        spot.style.left = (r.left - pad) + 'px';
        spot.style.top = (r.top - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
        spot.classList.add('pulse');

        // Place coach near the spotlight
        const coachW = coach.offsetWidth || 360;
        const coachH = coach.offsetHeight || 240;
        const vw = window.innerWidth, vh = window.innerHeight;
        const margin = 16;

        const placement = step.placement || 'bottom';
        let left, top;

        if (placement === 'bottom') {
            top = r.bottom + 18;
            left = r.left + r.width / 2 - coachW / 2;
            if (arrow) arrow.classList.add('top');
        } else if (placement === 'top') {
            top = r.top - coachH - 18;
            left = r.left + r.width / 2 - coachW / 2;
            if (arrow) arrow.classList.add('bottom');
        } else if (placement === 'left') {
            top = r.top + r.height / 2 - coachH / 2;
            left = r.left - coachW - 18;
            if (arrow) arrow.classList.add('right');
        } else if (placement === 'right') {
            top = r.top + r.height / 2 - coachH / 2;
            left = r.right + 18;
            if (arrow) arrow.classList.add('left');
        } else {
            // center fallback
            spot.style.display = 'none';
            coach.classList.add('center');
            return;
        }

        // Clamp to viewport
        left = Math.max(margin, Math.min(left, vw - coachW - margin));
        top = Math.max(margin, Math.min(top, vh - coachH - margin));

        // If clamped enough that the coach would overlap the spotlight on a vertical placement,
        // and there's clearly not enough room, fall back to center.
        if (placement === 'bottom' && top + coachH > vh - margin) {
            // try placing above instead
            top = Math.max(margin, r.top - coachH - 18);
            if (arrow) arrow.className = 'tut-coach-arrow bottom';
        }
        if (placement === 'top' && top < margin) {
            top = Math.min(vh - coachH - margin, r.bottom + 18);
            if (arrow) arrow.className = 'tut-coach-arrow top';
        }

        // If on mobile, prefer center placement to dodge tiny screens
        if (IS_MOBILE && (vw < 600 || vh < 500)) {
            spot.style.display = 'block'; // keep highlight
            coach.classList.add('center');
            return;
        }

        coach.style.left = left + 'px';
        coach.style.top = top + 'px';
        coach.style.right = '';
        coach.style.bottom = '';
        coach.style.transform = '';
    },
};

// Expose globally so the "Start Tutorial" button in #instrOv can call it
window.Tutorial = Tutorial;

})();
