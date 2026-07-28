/* ══════════════════════════════════════════════════════════════════════════
   INTERACTIVE TUTORIAL — a 30-step guided walkthrough of the first-person city.

   Ported from pixi/js/tutorial.js, but the 2D version could only ever point at
   DOM buttons: in 2D the whole city IS the viewport, so "look at the port" is a
   camera pan. Here half the curriculum is about things you do with your body
   (WASD, mouse look, jump, walk up to a door and press E), so the step list is
   split three ways:

     • DOM steps      — spotlight a HUD element with a cut-out overlay
     • world steps    — ease the camera to a landmark and narrate it
     • concept steps  — centred card, no target (controls, modes, keys)

   The cut-out is four surrounding divs rather than a radial-gradient mask: the
   hole then passes real pointer events through, and it stays crisp on every
   browser without a compositing layer per frame.

   Camera flights take the camera away from the player. `G.tourMode` is the
   existing "the camera is not yours right now" flag — Player.update() bails on
   it and the pointer-lock listener stops treating an unlock as a pause — so we
   raise it for the duration instead of inventing a second one. Everything the
   tutorial touches (camera transform, player enabled/yaw/pitch, minimap
   visibility, tourMode) is snapshotted on start and put back on stop.

   Runs once per browser (localStorage 'sc_fp_tutorial_done'), never under
   ?autostart=1 (headless screenshots), and is re-runnable from the pause menu.
   Force it with ?tutorial=1.
   ══════════════════════════════════════════════════════════════════════════ */
import { G } from './state.js';

const DONE_KEY = 'sc_fp_tutorial_done';

const IS_TOUCH = (() => {
    try {
        return matchMedia('(pointer: coarse)').matches ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } catch (e) { return false; }
})();

const $ = id => document.getElementById(id);

/* Camera framing for a subject building. Exported because daily_briefing.js
   frames the same landmarks and both were previously wrong in the same way:
   Tour._stopPos-style constants (stand 200 out, float at y≈100, aim at y≈90)
   were written when nothing was taller than a few floors. After the skyline
   pass bld_g is 864 units tall, so a fixed low camera pitches 30–45° DOWN and
   fills the frame with pavement while the tower clips the edge.

   So derive everything from the subject: back off until its full height covers
   ~75% of the vertical FOV, sit at 62% of its height and aim at 50%. That puts
   the horizon near the middle of the frame for a tower and keeps a squat data
   centre from being framed as if it were one. Footprint sets the floor on the
   distance so a wide, low building is not clipped by its own edges. */
export function subjectFraming(b) {
    const h = (Number.isFinite(b.worldH) && b.worldH > 0) ? b.worldH : 180;
    const foot = Math.max(b.worldW || 140, b.worldD || 140);
    const halfFov = ((G.camera?.fov || 70) * Math.PI / 180) / 2;
    const fit = h / (2 * 0.75 * Math.tan(halfFov));
    return {
        dist: Math.min(1700, Math.max(foot * 1.7 + 140, fit)),
        camY: Math.max(95, h * 0.62),
        lookY: Math.max(45, h * 0.5)
    };
}

function frameBuilding(b, i) {
    const f = subjectFraming(b);
    // Vary the approach bearing per step so consecutive flights do not all
    // arrive from the same corner.
    const ang = 0.7 + i * 1.13;
    return {
        px: b.worldX + Math.cos(ang) * f.dist, py: f.camY, pz: b.worldZ + Math.sin(ang) * f.dist,
        lx: b.worldX, ly: f.lookY, lz: b.worldZ
    };
}

// ── STEP LIST ───────────────────────────────────────────────────────────────
// { chapter, title, body | bodyDesktop/bodyTouch, target, at, placement }
//   target — CSS selector for a DOM spotlight, or null for a centred card
//   at     — building id; the camera eases there before the card shows
const STEPS = [
    // ══ Chapter 1 — first steps ══
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'Welcome to Singularity City',
        body: "You are standing in a <b>living model of the AI industry</b>. Every tower is a real lab, every pedestrian is a real model, and the headlines on the blimps are today's actual news. This walkthrough takes about four minutes — <b>skip anytime</b> with the button below or the <b>ESC</b> key.",
        target: null
    },
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'Look around',
        bodyDesktop: "Move the mouse to look. Click the city once to capture your cursor, press <b>ESC</b> to release it again. The dot in the middle of the screen is your <b>crosshair</b> — whatever it rests on is what you can interact with.",
        bodyTouch: "Drag on the city to look around. The dot in the middle is your <b>crosshair</b> — whatever it rests on is what you can interact with.",
        target: '#crosshair',
        placement: 'bottom'
    },
    {
        chapter: 'Chapter 1 · Welcome',
        title: 'Walk, run, jump',
        bodyDesktop: "<b>W A S D</b> to walk (arrow keys work too). Hold <b>SHIFT</b> to sprint — the city is 4.8 km across, you will want it. <b>SPACE</b> jumps. The streets are solid; buildings are not doors, so walk up to one and look for the prompt.",
        bodyTouch: "Use the on-screen stick to walk. The city is 4.8 km across, so take the metro for long trips.",
        target: null
    },

    // ══ Chapter 2 — the HUD ══
    {
        chapter: 'Chapter 2 · Your HUD',
        title: 'Clock, weather, district',
        body: "Top left: the <b>city clock</b> runs on your real local time, so the sun outside your window is roughly the sun over the city. Under it, the live <b>weather</b> and the <b>district</b> you are standing in. Walking into a new district for the first time unlocks it on your map.",
        target: '#hudLeft',
        placement: 'right'
    },
    {
        chapter: 'Chapter 2 · Your HUD',
        title: 'AI Index and population',
        body: "Top right: the <b>AI Index</b> is a composite of benchmark ceilings, lab diversity, open-weight ratio and installed compute — the city's stock market in one number. Below it, how many model citizens are alive right now.",
        target: '#hudRight',
        placement: 'left'
    },
    {
        chapter: 'Chapter 2 · Your HUD',
        title: 'The quest tracker',
        body: "Your current objective sits here. Quests are gentle nudges toward places worth seeing — a graveyard of retired models, the black market, the courthouse mid-trial. Finishing them unlocks achievements.",
        target: '#questTracker',
        placement: 'right'
    },
    {
        chapter: 'Chapter 2 · Your HUD',
        title: 'The minimap',
        body: "Press <b>M</b> to toggle the minimap. Cyan arrow is you, grey lines are roads, coloured dots are lab HQs, and a green outline means you have already visited that district. Handy when you are three districts deep and lost.",
        target: '#minimap',
        placement: 'left',
        onEnter() { $('minimap')?.classList.remove('hidden'); }
    },
    {
        chapter: 'Chapter 2 · Your HUD',
        title: 'Notifications',
        body: "Toasts appear here — achievements, arriving trains, and <b>live news reactions</b>: when a real headline breaks about a lab, that lab's HQ reacts. Fireworks for a launch, red flicker for a crisis, a pulse to the courthouse for a lawsuit.",
        target: '#toasts',
        placement: 'top'
    },

    // ══ Chapter 3 — the city itself ══
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Visitor Monument',
        body: "This is where you spawned, in the <b>Civic Center</b>. The city is a 5×5 grid of districts with the sea to the west. Let me fly you over the ones worth walking to.",
        target: null,
        at: 'visitor_monument'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Tech District',
        body: "Seven <b>lab headquarters</b> — OpenAI, Anthropic, Google DeepMind, Meta, Mistral, xAI, DeepSeek. Tower height tracks how much each lab has shipped. Their founders keep an office up top and actually commute here in the morning.",
        target: null,
        at: 'bld_o'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'Step inside',
        body: "Walk up to any building and the prompt reads <b>[E] Enter</b>. Press <b>E</b> to go in — lobbies, server aisles, the bar, the courthouse gallery. Press <b>E</b> again at the door to leave, and <b>F</b> to ride the lift between floors.",
        target: null,
        at: 'bld_a'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'Talk to the citizens',
        body: "Every pedestrian is a released model, sized by parameter count and coloured by lab. Put your crosshair on one and press <b>E</b> for its full card: benchmarks, architecture, price, and what it is doing right now. They chat to each other too — walk close and read the bubbles.",
        target: null,
        at: 'open_square'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Metro',
        body: "Four lines run under the city. Stand on a platform, wait for a train, and press <b>E</b> to board — the camera rides with it through the tunnels. It is the fastest way from the port to the estates without sprinting the whole diagonal.",
        target: null,
        at: 'metro_central'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The AI Court',
        body: "Copyright suits, antitrust hearings, safety subpoenas. When a real regulatory headline breaks, a pulse runs from the accused lab's HQ to this building and a case joins the docket.",
        target: null,
        at: 'court_senate'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Compute District',
        body: "Where the training actually happens. Every data centre here is a real facility with its real accelerator count, power draw and cooling. Go inside and walk the aisles — the racks hum at the pitch of the money burning inside them.",
        target: null,
        at: 'dc_xai_memphis'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Power Grid',
        body: "Nuclear, solar, wind, hydro, an SMR and one optimistic fusion pilot. Open any of them for live output in megawatts — the solar farm genuinely drops to zero after sunset, and the district is sized to feed the compute you just flew over.",
        target: null,
        at: 'power_nuclear'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Space Zone',
        body: "Thirteen launch pads, a vehicle assembly building and mission control. Rockets lift off on their own schedule — if you hear the rumble anywhere in the city, look north-west and up.",
        target: null,
        at: 'pad_spacex'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Port',
        body: "Where the hardware arrives. Container cranes, customs, the fuel dock and the warehouse that feeds the compute district. The sea starts just west of here — the edge of the map is a beach, not a wall.",
        target: null,
        at: 'port_crane'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'The Underground',
        body: "The wasteland district in the south-west. Abliterated checkpoints, uncensored weights, a suspiciously cheap H100. No guardrails past the fence — and an achievement for whoever finds it.",
        target: null,
        at: 'black_market'
    },
    {
        chapter: 'Chapter 3 · The City',
        title: 'Public life',
        body: "The city is not all silicon: a park with the leaderboard monument, the arena where models fight for ELO, a neon bar that fills after work, and a graveyard for the deprecated. Come back at night — it looks completely different.",
        target: null,
        at: 'neon_bar'
    },

    // ══ Chapter 4 — the tools ══
    {
        chapter: 'Chapter 4 · Tools',
        title: 'The pause panels',
        body: "Press <b>TAB</b> to pause. Behind it: census, benchmark leaderboard, quest log, achievements, today's newspaper, the conference calendar, compute and supply chain, API prices, model family trees and a head-to-head comparison tool. <b>TAB</b> again to get back out.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'The data terminal',
        body: "<b>Ctrl+D</b> (or the <b>`</b> backtick key) opens a full-screen analyst terminal — live index, lab standings, the news wire, the event log. It is the fastest way to see the whole simulation as numbers rather than streets.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'The city map',
        body: "<b>V</b> opens the full city map, and <b>M</b> toggles the corner minimap you saw earlier. The big map labels every district and marks the ones you have visited in green.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'Auto-tour',
        body: "Press <b>T</b> and the camera flies a cinematic circuit of thirty landmarks with captions, exactly like the flights in this walkthrough. Any key hands control back. Sit through the whole thing for an achievement. Leave the tab alone and the same tour starts itself as a screensaver — the delay is under Settings.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'Free-fly',
        body: "<b>C</b> unlocks the camera from the street so you can soar over the city — WASD, Space/Q up, Ctrl/E down, Shift to boost. Perfect for a bird's-eye look at the skyline, sea and hills. Press <b>C</b> again to land.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'Orbit view',
        body: "<b>O</b> lifts you out of your body and up into orbit — the whole grid at once, districts labelled, the sea to the west. Press <b>O</b> again and you drop back exactly where you were standing.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'X-ray mode',
        body: "<b>X</b> dims the city to wireframe: building outlines in their lab's colour, ID labels floating over each footprint, and data packets running the streets. A diagnostic view for when you want the schematic instead of the skyline.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'The holomap',
        body: "<b>H</b> raises a hologram of the entire industry in front of you — labs as orbiting clusters, models as points, scaled by capability. The same data as the leaderboard, in a shape you can walk around.",
        target: null
    },
    {
        chapter: 'Chapter 4 · Tools',
        title: 'Jump to the 2D city',
        body: "Press <b>P</b> at any time — even with your mouse captured — to hard-swap into the 2D Singularity City. It is the same world, the same live data, seen from the side. Press the button in its corner to come back here.",
        target: null
    },

    // ══ Chapter 5 — finale ══
    {
        chapter: "Chapter 5 · You're ready",
        title: 'The daily briefing',
        body: "One more thing worth knowing: the pause menu has a <b>📽 Daily Briefing</b> button. It builds a short camera reel of the labs that are in today's news and records it to a video file you can keep. Try it after a big news day.",
        target: null
    },
    {
        chapter: "Chapter 5 · You're ready",
        title: 'Go and get lost',
        body: "That is the tour. There are easter eggs, seasonal festivals, a citizen of the day, weather you have not seen yet and thirty-odd achievements waiting. <b>Walk somewhere and press E on whatever looks interesting.</b><br><br>You can restart this walkthrough anytime from <b>TAB → 🎓 Tutorial</b>.",
        target: null,
        at: 'visitor_monument'
    }
];

export const Tutorial = {
    active: false,
    STEPS,
    _idx: 0,
    _built: false,
    _saved: null,
    _flight: null,
    _reposT: 0,
    _autoT: -1,          // >=0 counts down to the first-run auto-start
    FLIGHT_T: 2.4,

    init() {
        G.tutorial = this;   // console/debug reach, same as every other system
        const params = new URLSearchParams(location.search);
        // ?autostart=1 is the headless screenshot path — a modal overlay would
        // land in every frame of it.
        const suppressed = params.get('autostart') === '1';
        const forced = params.get('tutorial') === '1';
        if (suppressed) return;
        // 3.4 s: the entry banner runs 3.2 s, and dimming the screen over the
        // top of "SINGULARITY CITY" would step on the arrival.
        if (forced || !this.isDone()) this._autoT = 3.4;
    },

    isDone() {
        try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; }
    },
    _markDone() {
        try { localStorage.setItem(DONE_KEY, '1'); } catch (e) { /* private mode */ }
    },
    /** Clear the "seen it" flag so the walkthrough auto-runs again next boot. */
    reset() {
        try { localStorage.removeItem(DONE_KEY); } catch (e) { /* private mode */ }
    },

    // ── lifecycle ───────────────────────────────────────────────────────────
    start(fromIdx = 0) {
        if (this.active || !G.started) return;
        this.active = true;
        this._autoT = -1;
        this._idx = Math.max(0, Math.min(STEPS.length - 1, fromIdx));

        const cam = G.camera;
        this._saved = {
            enabled: G.player.enabled,
            tourMode: G.tourMode,
            yaw: G.player.yaw, pitch: G.player.pitch,
            x: cam.position.x, y: cam.position.y, z: cam.position.z,
            minimapHidden: !!$('minimap')?.classList.contains('hidden')
        };

        // tourMode: the camera stops belonging to the player, and releasing the
        // pointer stops being read as "the user wants the pause menu".
        G.tourMode = true;
        G.player.enabled = false;
        G.player.unlock();
        if (G.ui?.els?.pauseMenu) G.ui.els.pauseMenu.classList.add('hidden');
        G.paused = false;

        this._build();
        this._ov.classList.remove('hidden');
        this._bindKeys();
        this._render();
    },

    /** Finish normally — remembers that the player has seen it. */
    complete() {
        this._markDone();
        this.stop();
    },

    /** Leave without marking it done (the Skip button also marks it done — a
        player who skips does not want it again tomorrow). */
    stop() {
        if (!this.active) return;
        this.active = false;
        this._flight = null;
        if (this._ov) this._ov.classList.add('hidden');
        this._unbindKeys();

        const s = this._saved;
        this._saved = null;
        if (!s) return;

        // Put the camera, the controller and the HUD back exactly as found.
        if (s.minimapHidden) $('minimap')?.classList.add('hidden');
        G.player.yaw = s.yaw;
        G.player.pitch = s.pitch;
        G.player.teleport(s.x, s.z, s.yaw);
        G.camera.position.set(s.x, s.y, s.z);
        G.camera.rotation.order = 'YXZ';
        G.camera.rotation.set(s.pitch, s.yaw, 0);
        G.tourMode = s.tourMode;
        G.player.enabled = s.enabled;
        if (!G.panelOpen && !G.paused && !G.tourMode) G.player.lock();
    },

    next() {
        if (!this.active) return;
        if (this._idx >= STEPS.length - 1) { this.complete(); return; }
        this._idx++;
        this._render();
    },
    prev() {
        if (!this.active || this._idx <= 0) return;
        this._idx--;
        this._render();
    },
    skip() {
        if (!this.active) return;
        this._markDone();
        this.stop();
        G.ui?.addToast?.('🎓 Tutorial skipped — restart it from <b>TAB → Tutorial</b>', 'info');
    },

    // ── per-frame ───────────────────────────────────────────────────────────
    update(dt) {
        // First run: wait until the player is actually in the world (and give
        // the entry banner a moment) before taking the screen over.
        if (this._autoT >= 0) {
            if (!G.started || G.panelOpen || G.paused) return;
            this._autoT -= dt;
            if (this._autoT <= 0) { this._autoT = -1; this.start(); }
            return;
        }
        if (!this.active) return;

        const f = this._flight;
        if (f) {
            f.t = Math.min(f.dur, f.t + dt);
            const k = f.t / f.dur;
            const e = k * k * (3 - 2 * k);           // smoothstep, no overshoot
            const cam = G.camera;
            cam.position.set(
                f.fx + (f.px - f.fx) * e,
                f.fy + (f.py - f.fy) * e,
                f.fz + (f.pz - f.fz) * e
            );
            cam.lookAt(
                f.flx + (f.lx - f.flx) * e,
                f.fly + (f.ly - f.fly) * e,
                f.flz + (f.lz - f.flz) * e
            );
            if (f.t >= f.dur) this._flight = null;
        }

        // HUD nodes resize as their text changes (POP, clock), so the cut-out
        // is re-measured a few times a second rather than only on resize.
        this._reposT -= dt;
        if (this._reposT <= 0) { this._reposT = 0.3; this._position(STEPS[this._idx]); }
    },

    // ── DOM ─────────────────────────────────────────────────────────────────
    _build() {
        if (this._built) return;
        const ov = document.createElement('div');
        ov.id = 'tutOverlay';
        ov.className = 'hidden';
        ov.innerHTML = `
            <div class="tut-mask" data-side="t"></div>
            <div class="tut-mask" data-side="b"></div>
            <div class="tut-mask" data-side="l"></div>
            <div class="tut-mask" data-side="r"></div>
            <div class="tut-ring" id="tutRing"></div>
            <div class="tut-card" id="tutCard">
                <div class="tut-chapter" id="tutChapter"></div>
                <div class="tut-title" id="tutTitle"></div>
                <div class="tut-body" id="tutBody"></div>
                <div class="tut-prog"><div class="tut-prog-fill" id="tutFill"></div></div>
                <div class="tut-foot">
                    <span class="tut-count" id="tutCount"></span>
                    <button class="tut-btn tut-skip" id="tutSkip">Skip</button>
                    <button class="tut-btn" id="tutPrev">← Back</button>
                    <button class="tut-btn tut-next" id="tutNext">Next →</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        this._ov = ov;
        this._masks = {};
        ov.querySelectorAll('.tut-mask').forEach(m => { this._masks[m.dataset.side] = m; });
        this._ring = $('tutRing');
        this._card = $('tutCard');
        $('tutNext').onclick = () => this.next();
        $('tutPrev').onclick = () => this.prev();
        $('tutSkip').onclick = () => this.skip();
        this._onResize = () => this._position(STEPS[this._idx]);
        this._built = true;
    },

    _bindKeys() {
        if (this._keyHandler) return;
        // Capture phase: the walkthrough owns ESC/Enter/arrows/TAB while it is
        // up, so arrow-key navigation cannot also feed the konami listener and
        // TAB cannot pop the pause menu behind the overlay. Everything else
        // (WASD, E, M…) passes straight through and still works.
        this._keyHandler = (e) => {
            if (!this.active) return;
            switch (e.code) {
                case 'Escape': this.skip(); break;
                case 'Enter': case 'ArrowRight': case 'PageDown': this.next(); break;
                case 'ArrowLeft': case 'PageUp': this.prev(); break;
                case 'Tab': break;
                default: return;
            }
            e.preventDefault();
            e.stopPropagation();
        };
        window.addEventListener('keydown', this._keyHandler, true);
        window.addEventListener('resize', this._onResize);
    },
    _unbindKeys() {
        if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler, true);
        window.removeEventListener('resize', this._onResize);
        this._keyHandler = null;
    },

    _render() {
        const step = STEPS[this._idx];
        if (!step) return;

        if (typeof step.onEnter === 'function') {
            try { step.onEnter(); } catch (e) { console.warn('[Tutorial] onEnter', e); }
        }
        if (step.at) this._flyTo(step.at);

        $('tutChapter').textContent = step.chapter || '';
        $('tutTitle').textContent = step.title || '';
        $('tutBody').innerHTML = (IS_TOUCH && step.bodyTouch) ? step.bodyTouch
            : (step.bodyDesktop || step.body || step.bodyTouch || '');

        const n = STEPS.length;
        $('tutFill').style.width = Math.round(((this._idx + 1) / n) * 100) + '%';
        $('tutCount').textContent = `${this._idx + 1} / ${n}`;
        $('tutPrev').style.visibility = this._idx === 0 ? 'hidden' : '';
        $('tutNext').textContent = this._idx === n - 1 ? '✓ Finish' : 'Next →';

        this._position(step);
    },

    _flyTo(bid) {
        const b = G.bldById?.[bid];
        // A missing landmark must not strand the camera mid-air — the step just
        // narrates from wherever we already are.
        if (!b || !Number.isFinite(b.worldX)) { this._flight = null; return; }
        const f = frameBuilding(b, this._idx);
        const cam = G.camera;
        // Current aim point, so the pan starts from where the player is looking
        // instead of snapping the heading on frame one.
        const dir = { x: -Math.sin(cam.rotation.y), z: -Math.cos(cam.rotation.y) };
        this._flight = {
            t: 0, dur: this.FLIGHT_T,
            fx: cam.position.x, fy: cam.position.y, fz: cam.position.z,
            flx: cam.position.x + dir.x * 240, fly: cam.position.y, flz: cam.position.z + dir.z * 240,
            px: f.px, py: f.py, pz: f.pz, lx: f.lx, ly: f.ly, lz: f.lz
        };
    },

    // Four rectangles around the hole. With a zero-size hole at the origin the
    // bottom panel simply covers the whole screen, which is the "no target" case.
    _setHole(x, y, w, h) {
        const vw = innerWidth, vh = innerHeight;
        const m = this._masks;
        const put = (el, l, t, ww, hh) => {
            el.style.left = l + 'px'; el.style.top = t + 'px';
            el.style.width = Math.max(0, ww) + 'px'; el.style.height = Math.max(0, hh) + 'px';
        };
        put(m.t, 0, 0, vw, y);
        put(m.b, 0, y + h, vw, vh - (y + h));
        put(m.l, 0, y, x, h);
        put(m.r, x + w, y, vw - (x + w), h);
    },

    _position(step) {
        if (!step || !this._card) return;
        const card = this._card, ring = this._ring;
        const el = step.target ? document.querySelector(step.target) : null;
        const r = el ? el.getBoundingClientRect() : null;
        const usable = r && (r.width > 0 || r.height > 0) &&
            r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;

        if (!usable) {
            this._setHole(0, 0, 0, 0);
            ring.style.display = 'none';
            card.classList.add('tut-center');
            card.style.left = ''; card.style.top = '';
            return;
        }

        const pad = 10;
        const hx = r.left - pad, hy = r.top - pad;
        const hw = r.width + pad * 2, hh = r.height + pad * 2;
        this._setHole(hx, hy, hw, hh);
        ring.style.display = 'block';
        ring.style.left = hx + 'px'; ring.style.top = hy + 'px';
        ring.style.width = hw + 'px'; ring.style.height = hh + 'px';

        // Small screens have nowhere to put a 380px card beside a HUD corner —
        // keep the highlight, centre the copy.
        if (innerWidth < 720 || innerHeight < 560) {
            card.classList.add('tut-center');
            card.style.left = ''; card.style.top = '';
            return;
        }

        card.classList.remove('tut-center');
        const cw = card.offsetWidth || 380, ch = card.offsetHeight || 260, gap = 20, edge = 16;
        let left, top;
        switch (step.placement) {
            case 'right': left = r.right + gap; top = r.top + r.height / 2 - ch / 2; break;
            case 'left':  left = r.left - cw - gap; top = r.top + r.height / 2 - ch / 2; break;
            case 'top':   left = r.left + r.width / 2 - cw / 2; top = r.top - ch - gap; break;
            default:      left = r.left + r.width / 2 - cw / 2; top = r.bottom + gap; break;
        }
        // If the preferred side has no room, flip to the opposite one before
        // clamping — clamping alone would park the card on top of the hole.
        if (left < edge && step.placement === 'left') left = r.right + gap;
        if (left + cw > innerWidth - edge && step.placement === 'right') left = r.left - cw - gap;
        if (top < edge && step.placement === 'top') top = r.bottom + gap;
        if (top + ch > innerHeight - edge && step.placement !== 'top') top = r.top - ch - gap;

        card.style.left = Math.max(edge, Math.min(left, innerWidth - cw - edge)) + 'px';
        card.style.top = Math.max(edge, Math.min(top, innerHeight - ch - edge)) + 'px';
    }
};
