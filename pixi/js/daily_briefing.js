/* ════════════════════════════════════════════════════════════════════════════════
   DAILY BRIEFING — auto-generated 30-second video summary of yesterday's
   news-engine reactions, ready to drag into an X post.

   Flow:
     1. On boot, we check the persisted news event log (sc_news_events_v1)
        for ≥3 events from yesterday's UTC date. If found AND we haven't
        already generated/skipped a briefing for today, the prompt toast
        auto-shows: "📽 Daily Briefing for [date] is ready" → [Generate]
        [Skip] [×]
     2. Generate enters briefing mode. The viewport plays a scripted reel
        recorded by MediaRecorder pulled from G.app.view.captureStream():
          • 3s intro overlay (date banner)
          • 6 events × 4s reel — camera lerps to each lab's HQ, the
            reaction re-fires (NewsReactivity.fire() bypassing cooldown),
            we hold for the visible burst
          • 3s outro overlay (@SingularityCity branding)
     3. On stop, the recorded WebM is downloaded as
        singularity-city-briefing-YYYY-MM-DD.webm and a share toast appears
        with a pre-written X post body + drag-drop instruction.
     4. A floating ✕ Stop button is visible the whole time so the user can
        abort. Stopping mid-briefing discards the recording.

   For testing without real news data: DailyBriefing._test() seeds 6 fake
   events for "yesterday" and immediately enters briefing mode.
   ════════════════════════════════════════════════════════════════════════════════ */

window.DailyBriefing = (function() {

    const STATE = {
        // Prompt
        promptEl: null,
        // Briefing
        active: false,
        date: null,           // "YYYY-MM-DD" — the day this briefing summarizes
        events: [],
        phase: 'idle',        // 'idle' | 'intro' | 'reel' | 'outro' | 'done'
        phaseStartMs: 0,
        eventIdx: -1,
        eventStartMs: 0,
        eventReactionFired: false,
        // PIXI overlay
        overlay: null,
        overlayBg: null,
        overlayTitle: null,
        overlaySub: null,
        // PIXI sky backdrop (for canvas-captured sky gradient — Environment paints
        // the sky as a CSS gradient on the viewport DIV, which captureStream
        // can't see. Briefing draws a matching gradient INTO the canvas.)
        backdrop: null,
        backdropGfx: null,
        backdropLastTick: -1,
        // Recording
        recorder: null,
        chunks: [],
        // UI
        stopBtnEl: null,
        // Persistence
        lastChecked: 0,
        // Set when the user closes the prompt with × — suppresses the auto
        // re-prompt for the rest of this session (Skip Today persists across
        // reloads; × is just "not now"). Without this the prompt re-appeared
        // every 5s because dismissPrompt() saves no state.
        dismissedSession: false
    };

    const LS_BRIEF_KEY = 'sc_briefing_v1';     // { generatedDate, skippedDate }
    const LS_EVENTS_KEY = 'sc_news_events_v1'; // shared with news_reactivity.js
    const FPS = 30;

    // Phase timings in ms — total = 3000 + 6*4000 + 3000 = 30,000ms (30s)
    const TIMING = {
        intro:    3000,
        perEvent: 4000,
        eventCount: 6,
        outro:    3000
    };

    // ─── DATE UTILS ──────────────────────────────────────────────────────────
    function utcDateString(d) {
        d = d || new Date();
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
    function yesterdayUtcDateString() {
        return utcDateString(new Date(Date.now() - 86400000));
    }
    function prettyDate(s) {
        // "2026-05-08" → "May 8, 2026"
        try {
            const [y, m, d] = s.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d));
            return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
        } catch { return s; }
    }

    // ─── PERSISTENCE ─────────────────────────────────────────────────────────
    function loadBriefState() {
        try { return JSON.parse(localStorage.getItem(LS_BRIEF_KEY) || '{}') || {}; }
        catch { return {}; }
    }
    function saveBriefState(p) {
        try {
            const cur = loadBriefState();
            const next = Object.assign({}, cur, p);
            localStorage.setItem(LS_BRIEF_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    }
    function loadNewsEvents() {
        try { return JSON.parse(localStorage.getItem(LS_EVENTS_KEY) || '[]') || []; }
        catch { return []; }
    }

    // ─── EVENT SELECTION ─────────────────────────────────────────────────────
    function pickEventsForDate(dateStr) {
        // Merged cloud + local lookup via the API helper. Falls back to
        // raw localStorage when API isn't loaded yet (very early boot).
        let all;
        if (typeof API !== 'undefined' && typeof API.getEventsByDate === 'function') {
            all = API.getEventsByDate(dateStr);
        } else {
            all = loadNewsEvents().filter(e => e && e.date === dateStr);
        }
        const filtered = all.filter(e => e && e.lab);
        // Up to 6 events. Prefer one per lab for variety, then fill chronologically.
        const seenLabs = new Set();
        const primary = [];
        for (const e of filtered) {
            if (seenLabs.has(e.lab)) continue;
            seenLabs.add(e.lab);
            primary.push(e);
            if (primary.length >= TIMING.eventCount) break;
        }
        if (primary.length < TIMING.eventCount) {
            // Top up with remaining events not yet selected
            for (const e of filtered) {
                if (primary.includes(e)) continue;
                primary.push(e);
                if (primary.length >= TIMING.eventCount) break;
            }
        }
        return primary.slice(0, TIMING.eventCount);
    }

    // ─── PROMPT TOAST ────────────────────────────────────────────────────────
    function showPrompt(events, dateStr) {
        if (STATE.promptEl) return;
        const host = document.createElement('div');
        host.id = 'sc-briefing-prompt';
        host.innerHTML = `
            <div class="sc-bp-head">
                <span class="sc-bp-emoji">📽</span>
                <span class="sc-bp-title">Daily Briefing</span>
                <button class="sc-bp-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-bp-body">${escapeHtml(prettyDate(dateStr))} — ${events.length} event${events.length === 1 ? '' : 's'} from yesterday in Singularity City. Generate a 30-second video summary?</div>
            <div class="sc-bp-actions">
                <button class="sc-bp-btn sc-bp-go">▶ Generate</button>
                <button class="sc-bp-btn sc-bp-skip">Skip Today</button>
            </div>
        `;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('sc-bp-in'));
        STATE.promptEl = host;

        host.querySelector('.sc-bp-close').onclick = () => {
            STATE.dismissedSession = true;   // don't nag again until reload
            dismissPrompt();
        };
        host.querySelector('.sc-bp-skip').onclick = () => {
            saveBriefState({ skippedDate: utcDateString() });
            dismissPrompt();
        };
        host.querySelector('.sc-bp-go').onclick = () => {
            dismissPrompt();
            startBriefing(events, dateStr);
        };
    }

    function dismissPrompt() {
        if (!STATE.promptEl) return;
        STATE.promptEl.classList.remove('sc-bp-in');
        const el = STATE.promptEl;
        STATE.promptEl = null;
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }

    // ─── STOP BUTTON ─────────────────────────────────────────────────────────
    function showStopButton() {
        if (STATE.stopBtnEl) return;
        const btn = document.createElement('button');
        btn.id = 'sc-briefing-stop';
        btn.innerHTML = '✕ Stop Briefing';
        btn.onclick = () => abortBriefing();
        document.body.appendChild(btn);
        requestAnimationFrame(() => btn.classList.add('sc-bs-in'));
        STATE.stopBtnEl = btn;
    }
    function hideStopButton() {
        if (!STATE.stopBtnEl) return;
        STATE.stopBtnEl.classList.remove('sc-bs-in');
        const el = STATE.stopBtnEl;
        STATE.stopBtnEl = null;
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }

    // ─── SKY BACKDROP (drawn INTO the canvas so MediaRecorder captures the
    //     gradient that Environment normally paints on the viewport DIV via
    //     CSS — invisible to canvas captureStream). Lives at the BOTTOM of
    //     stage children so it draws behind everything else. ────────────────
    function buildBackdrop() {
        if (!G.app || !G.app.stage) return null;
        if (STATE.backdrop) return STATE.backdrop;
        const cont = new PIXI.Container();
        const g = new PIXI.Graphics();
        cont.addChild(g);
        // addChildAt(0) → first child, rendered first → behind everything else
        G.app.stage.addChildAt(cont, 0);
        STATE.backdrop = cont;
        STATE.backdropGfx = g;
        updateBackdrop();
        return cont;
    }

    function destroyBackdrop() {
        if (!STATE.backdrop) return;
        if (STATE.backdrop.parent) STATE.backdrop.parent.removeChild(STATE.backdrop);
        STATE.backdrop.destroy({ children: true });
        STATE.backdrop = null;
        STATE.backdropGfx = null;
    }

    // Read the viewport DIV's current CSS gradient and parse the rgb() stops
    // back to PIXI hex colors. Avoids reimplementing Environment's day-phase /
    // weather logic — whatever the user sees, the canvas mirrors.
    function getSkyStops() {
        try {
            const vp = document.getElementById('viewport');
            if (!vp) return null;
            const bg = getComputedStyle(vp).backgroundImage;
            const matches = bg && bg.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/g);
            if (!matches || !matches.length) {
                // Maybe a solid color in backgroundColor instead
                const bc = getComputedStyle(vp).backgroundColor;
                const m = bc && bc.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (m) {
                    const r = +m[1], gn = +m[2], b = +m[3];
                    const c = (r << 16) | (gn << 8) | b;
                    return [c, c, c];
                }
                return null;
            }
            const hexes = matches.map(s => {
                const p = s.match(/\d+/g).map(Number);
                return ((p[0] & 0xff) << 16) | ((p[1] & 0xff) << 8) | (p[2] & 0xff);
            });
            while (hexes.length < 3) hexes.push(hexes[hexes.length - 1]);
            return hexes.slice(0, 3);
        } catch (_e) { return null; }
    }

    function lerpColor(a, b, t) {
        const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
        const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bv = Math.round(ab + (bb - ab) * t);
        return (r << 16) | (g << 8) | bv;
    }

    function updateBackdrop() {
        if (!STATE.backdropGfx) return;
        const stops = getSkyStops();
        if (!stops) return;
        const [top, mid, bot] = stops;
        const w = G.vpW || (G.app && G.app.renderer && G.app.renderer.width) || 1280;
        const h = G.vpH || (G.app && G.app.renderer && G.app.renderer.height) || 720;
        const g = STATE.backdropGfx;
        g.clear();
        // 30-band approximation of a smooth 3-stop vertical gradient.
        const BANDS = 30;
        const bandH = h / BANDS;
        for (let i = 0; i < BANDS; i++) {
            const t = i / (BANDS - 1);
            const c = (t < 0.5)
                ? lerpColor(top, mid, t * 2)
                : lerpColor(mid, bot, (t - 0.5) * 2);
            g.beginFill(c, 1);
            g.drawRect(0, i * bandH, w, bandH + 1);
            g.endFill();
        }
    }

    // ─── PIXI OVERLAY (intro/outro banners drawn into the canvas so
    //     MediaRecorder captures them) ───────────────────────────────────────
    function buildOverlay() {
        if (!G.app || !G.app.stage) return null;
        const cont = new PIXI.Container();
        cont.zIndex = 99999;

        const bg = new PIXI.Graphics();
        cont.addChild(bg);

        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Press Start 2P, Silkscreen, monospace',
            fontSize: 32,
            fill: '#fbbf24',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000',
            dropShadowDistance: 0,
            dropShadowBlur: 12,
            align: 'center'
        });
        const subStyle = new PIXI.TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 16,
            fill: '#e8e8f0',
            align: 'center'
        });
        const title = new PIXI.Text('', titleStyle);
        title.anchor.set(0.5);
        cont.addChild(title);

        const sub = new PIXI.Text('', subStyle);
        sub.anchor.set(0.5);
        cont.addChild(sub);

        G.app.stage.addChild(cont);

        STATE.overlay = cont;
        STATE.overlayBg = bg;
        STATE.overlayTitle = title;
        STATE.overlaySub = sub;
        return cont;
    }

    function destroyOverlay() {
        if (!STATE.overlay) return;
        if (STATE.overlay.parent) STATE.overlay.parent.removeChild(STATE.overlay);
        STATE.overlay.destroy({ children: true });
        STATE.overlay = null;
        STATE.overlayBg = null;
        STATE.overlayTitle = null;
        STATE.overlaySub = null;
    }

    function drawOverlay({ alpha, title, subtitle, bandY }) {
        if (!STATE.overlay) return;
        const w = G.vpW || G.app.renderer.width;
        const h = G.vpH || G.app.renderer.height;
        STATE.overlay.x = 0;
        STATE.overlay.y = 0;

        // Lower-third dark band with cyan border. Drawn in screen space.
        const bandH = 110;
        const cy = bandY != null ? bandY : (h * 0.5);
        STATE.overlayBg.clear();
        STATE.overlayBg.beginFill(0x040410, 0.78 * alpha);
        STATE.overlayBg.drawRect(0, cy - bandH / 2, w, bandH);
        STATE.overlayBg.endFill();
        STATE.overlayBg.beginFill(0xfbbf24, 0.85 * alpha);
        STATE.overlayBg.drawRect(0, cy - bandH / 2, w, 2);
        STATE.overlayBg.drawRect(0, cy + bandH / 2 - 2, w, 2);
        STATE.overlayBg.endFill();

        STATE.overlayTitle.text = title || '';
        STATE.overlayTitle.x = w / 2;
        STATE.overlayTitle.y = cy - 16;
        STATE.overlayTitle.alpha = alpha;

        STATE.overlaySub.text = subtitle || '';
        STATE.overlaySub.x = w / 2;
        STATE.overlaySub.y = cy + 22;
        STATE.overlaySub.alpha = alpha;
    }

    function clearOverlay() {
        if (!STATE.overlay) return;
        STATE.overlayBg.clear();
        STATE.overlayTitle.text = '';
        STATE.overlaySub.text = '';
    }

    // ─── CAMERA SCRIPTING ────────────────────────────────────────────────────
    function camFlyToLab(labId) {
        if (typeof G === 'undefined' || !G.bldsByLab) return;
        const blds = G.bldsByLab[labId] || [];
        const hq = blds.find(b => !b.id.startsWith('house_'));
        if (!hq) return;
        const cx = hq.x + hq.w / 2;
        // Disable any active tracking so we own the camera target
        G.tracking = null;
        if (typeof Camera !== 'undefined') {
            // Match the city's natural Y framing: targetY = 0 keeps screen_y=0
            // mapped to world_y=0 (top of the sky). Anything more negative
            // looks above the sky's bounded geometry → black void.
            // Zoom matches the player's default city view (~0.85) so the shot
            // feels familiar, not zoomed-in surveillance-cam.
            const targetZoom = 0.85;
            Camera.targetX = -(cx) + (G.vpW / 2) / targetZoom;
            Camera.targetY = 0;
            Camera.targetZoom = targetZoom;
        }
    }

    function camWideAerial() {
        if (typeof Camera === 'undefined') return;
        G.tracking = null;
        const cw = G.cityW || 4000;
        // Wider shot for the intro/outro. Same Y=0 rule — never frame above
        // the sky's draw bounds.
        const targetZoom = 0.6;
        Camera.targetX = -(cw / 2) + (G.vpW / 2) / targetZoom;
        Camera.targetY = 0;
        Camera.targetZoom = targetZoom;
    }

    // ─── RECORDING ───────────────────────────────────────────────────────────
    function pickBestMimeType() {
        const candidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        for (const m of candidates) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
        }
        return 'video/webm';
    }

    function startRecording() {
        if (!G.app || !G.app.view) return false;
        let stream;
        try { stream = G.app.view.captureStream(FPS); }
        catch (_e) { return false; }
        if (!stream) return false;

        STATE.chunks = [];
        const mimeType = pickBestMimeType();
        let rec;
        try {
            // Pixel art at native canvas resolution looks crisp at high bitrate;
            // 8 Mbps is the sweet spot for hard-edge pixel content without
            // breaking X's upload limit (X allows up to 512 MB / 140s).
            rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
        } catch (_e) {
            // Fallback without explicit mime
            try { rec = new MediaRecorder(stream); } catch { return false; }
        }
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) STATE.chunks.push(e.data); };
        rec.onstop = () => onRecordingStop(mimeType);
        try { rec.start(250); } catch (_e) { return false; }
        STATE.recorder = rec;
        return true;
    }

    function stopRecording() {
        if (STATE.recorder && STATE.recorder.state !== 'inactive') {
            try { STATE.recorder.stop(); } catch (_e) { /* ignore */ }
        }
    }

    function onRecordingStop(mimeType) {
        if (STATE.phase === 'cancelled') {
            STATE.recorder = null;
            STATE.chunks = [];
            return;
        }
        if (!STATE.chunks.length) {
            STATE.recorder = null;
            return;
        }
        const blob = new Blob(STATE.chunks, { type: mimeType.split(';')[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `singularity-city-briefing-${STATE.date}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        STATE.recorder = null;
        STATE.chunks = [];

        showShareToast(STATE.date, STATE.events);
    }

    // ─── SHARE TOAST (post-briefing) ─────────────────────────────────────────
    function showShareToast(dateStr, events) {
        const summary = events.slice(0, 4).map(e => `${e.emoji || '•'} ${labShortName(e.lab)}`).join('  ');
        const body = `Yesterday in Singularity City — ${prettyDate(dateStr)}.\n${summary}\n\nWatch: https://singularitycity.net`;

        const host = document.createElement('div');
        host.id = 'sc-briefing-share';
        host.innerHTML = `
            <div class="sc-bs-head">
                <span class="sc-bs-emoji">📽</span>
                <span class="sc-bs-title">Briefing Saved</span>
                <button class="sc-bs-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-bs-body">Your video downloaded — drag it onto your X post.</div>
            <div class="sc-bs-actions">
                <button class="sc-bs-btn sc-bs-post">𝕏 Post Draft</button>
                <button class="sc-bs-btn sc-bs-copy">📋 Copy Text</button>
            </div>
        `;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('sc-bs-show-in'));

        host.querySelector('.sc-bs-close').onclick = () => fadeOut(host);
        host.querySelector('.sc-bs-post').onclick = () => {
            const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(body);
            window.open(intent, '_blank', 'noopener');
        };
        host.querySelector('.sc-bs-copy').onclick = async () => {
            try { await navigator.clipboard.writeText(body); }
            catch { /* ignore */ }
            const b = host.querySelector('.sc-bs-copy');
            b.textContent = '✓ Copied';
            setTimeout(() => { b.textContent = '📋 Copy Text'; }, 1500);
        };

        // Auto-fade after 60s
        setTimeout(() => fadeOut(host), 60000);
    }

    function fadeOut(host) {
        if (!host || !host.parentNode) return;
        host.classList.remove('sc-bs-show-in');
        setTimeout(() => { if (host.parentNode) host.parentNode.removeChild(host); }, 280);
    }

    function labShortName(labId) {
        if (typeof LABS !== 'undefined' && LABS[labId] && LABS[labId].name) return LABS[labId].name;
        return labId || 'Lab';
    }

    // ─── BRIEFING FLOW ───────────────────────────────────────────────────────
    function startBriefing(events, dateStr) {
        if (STATE.active) return;
        if (!events || !events.length) return;
        if (typeof G === 'undefined' || !G.app) return;

        STATE.active = true;
        STATE.events = events;
        STATE.date = dateStr;
        STATE.phase = 'intro';
        STATE.phaseStartMs = Date.now();
        STATE.eventIdx = -1;
        STATE.eventStartMs = 0;
        STATE.eventReactionFired = false;

        // Disable AutoTour and other camera hijackers for the duration
        try { if (typeof AutoTour !== 'undefined' && AutoTour.stop) AutoTour.stop(); } catch (_e) { /* ignore */ }
        try {
            if (typeof AutoTour !== 'undefined') {
                AutoTour._briefingDisabled = true;
                AutoTour._disabled = true;
            }
        } catch (_e) { /* ignore */ }

        // Tell NewsReactivity to not flood share toasts during replay
        try { if (typeof NewsReactivity !== 'undefined' && NewsReactivity.setReplayMode) NewsReactivity.setReplayMode(true); } catch (_e) { /* ignore */ }

        buildBackdrop();
        buildOverlay();
        camWideAerial();
        showStopButton();

        // Mark today as generated regardless of recording success — so we
        // don't keep prompting on subsequent reloads today.
        saveBriefState({ generatedDate: utcDateString() });

        // Start MediaRecorder a tick later so the overlay has rendered at
        // least one frame before the first capture.
        setTimeout(() => {
            const ok = startRecording();
            if (!ok) {
                console.warn('[DailyBriefing] Recording unavailable — running without capture');
            }
        }, 60);
    }

    function abortBriefing() {
        STATE.phase = 'cancelled';
        finishBriefing(true);
    }

    function finishBriefing(cancelled) {
        // Stop the recording (download triggered in onstop unless cancelled)
        stopRecording();

        STATE.active = false;
        STATE.events = [];
        STATE.eventIdx = -1;
        STATE.phase = cancelled ? 'cancelled' : 'done';
        clearOverlay();
        destroyOverlay();
        destroyBackdrop();
        hideStopButton();

        try { if (typeof NewsReactivity !== 'undefined' && NewsReactivity.setReplayMode) NewsReactivity.setReplayMode(false); } catch (_e) { /* ignore */ }
        try {
            if (typeof AutoTour !== 'undefined') {
                AutoTour._briefingDisabled = false;
                AutoTour._disabled = false;
            }
        } catch (_e) { /* ignore */ }
    }

    // ─── UPDATE TICK ─────────────────────────────────────────────────────────
    function update() {
        // First-load auto-prompt detection (cheap, run once per ~5s)
        const now = Date.now();
        if (!STATE.active && (now - STATE.lastChecked) > 5000) {
            STATE.lastChecked = now;
            maybeShowPrompt();
        }

        if (!STATE.active) return;
        const elapsed = now - STATE.phaseStartMs;

        // Refresh the canvas sky backdrop ~once per second so it tracks
        // any dp/weather changes the Environment makes mid-briefing.
        if (STATE.backdropGfx && (G.tick - STATE.backdropLastTick) > 60) {
            STATE.backdropLastTick = G.tick;
            updateBackdrop();
        }

        switch (STATE.phase) {
            case 'intro': {
                const t = Math.min(1, elapsed / TIMING.intro);
                const fade = t < 0.85 ? Math.min(1, t / 0.25) : Math.max(0, (1 - (t - 0.85) / 0.15));
                drawOverlay({
                    alpha: fade,
                    title: 'DAILY BRIEFING',
                    subtitle: prettyDate(STATE.date) + ' · @SingularityCity'
                });
                if (elapsed >= TIMING.intro) {
                    STATE.phase = 'reel';
                    STATE.phaseStartMs = now;
                    STATE.eventIdx = -1;
                    advanceEvent(now);
                }
                break;
            }
            case 'reel': {
                if (STATE.eventIdx < 0 || STATE.eventIdx >= STATE.events.length) {
                    STATE.phase = 'outro';
                    STATE.phaseStartMs = now;
                    clearOverlay();
                    camWideAerial();
                    break;
                }
                const ev = STATE.events[STATE.eventIdx];
                const evElapsed = now - STATE.eventStartMs;

                // Lower-third headline band for the current event
                drawOverlay({
                    alpha: 0.92,
                    title: (ev.emoji || '🚨') + ' ' + (ev.archetype || 'News'),
                    subtitle: trimTitle(ev.title || ''),
                    bandY: G.vpH - 80
                });

                // Fire the actual reaction at +1.2s so the camera has settled
                if (!STATE.eventReactionFired && evElapsed >= 1200) {
                    STATE.eventReactionFired = true;
                    try {
                        if (typeof NewsReactivity !== 'undefined' && NewsReactivity.fire) NewsReactivity.fire(ev);
                    } catch (_e) { /* ignore */ }
                }

                if (evElapsed >= TIMING.perEvent) advanceEvent(now);
                break;
            }
            case 'outro': {
                const t = Math.min(1, elapsed / TIMING.outro);
                const fade = t < 0.85 ? Math.min(1, t / 0.25) : Math.max(0, (1 - (t - 0.85) / 0.15));
                drawOverlay({
                    alpha: fade,
                    title: 'SINGULARITY CITY',
                    subtitle: 'singularitycity.net · @SingularityCity'
                });
                if (elapsed >= TIMING.outro) finishBriefing(false);
                break;
            }
            default: break;
        }
    }

    function advanceEvent(now) {
        STATE.eventIdx++;
        if (STATE.eventIdx >= STATE.events.length) {
            STATE.phase = 'outro';
            STATE.phaseStartMs = now;
            clearOverlay();
            camWideAerial();
            return;
        }
        STATE.eventStartMs = now;
        STATE.eventReactionFired = false;
        const ev = STATE.events[STATE.eventIdx];
        camFlyToLab(ev.lab);
    }

    function trimTitle(s) {
        if (!s) return '';
        return s.length > 70 ? s.slice(0, 67) + '...' : s;
    }

    // ─── AUTO-PROMPT DETECTION ───────────────────────────────────────────────
    // Walks back from yesterday up to LOOKBACK_DAYS, picking the most recent
    // UTC day with ≥3 logged events. Necessary because users away for several
    // days have an empty log for "literal yesterday" — but might still have a
    // good briefing waiting from an older session.
    const LOOKBACK_DAYS = 7;

    function findMostRecentBriefingDate(minEvents) {
        const min = minEvents != null ? minEvents : 3;
        const today = utcDateString();
        for (let off = 1; off <= LOOKBACK_DAYS; off++) {
            const d = utcDateString(new Date(Date.now() - off * 86400000));
            if (d === today) continue;
            const events = pickEventsForDate(d);
            if (events.length >= min) return { date: d, events };
        }
        return null;
    }

    function maybeShowPrompt() {
        if (typeof G === 'undefined' || !G.app) return;   // wait for boot
        if (G.prefs && G.prefs.dailyBrief === false) return; // user disabled the auto-prompt
        if (STATE.promptEl) return;                        // already shown
        if (STATE.dismissedSession) return;                // user closed it this session
        const today = utcDateString();
        const brief = loadBriefState();
        if (brief.generatedDate === today) return;         // already generated today
        if (brief.skippedDate === today) return;           // user said skip today
        const result = findMostRecentBriefingDate(3);
        if (!result) return;                               // no recent day has enough drama
        showPrompt(result.events, result.date);
    }

    // ─── MANUAL TRIGGER (hotkey + 📽 button) ─────────────────────────────────
    // Skips the prompt — user already opted in by hitting the trigger.
    // Falls back through: 3+ events in last 7d → 1+ event in last 14d.
    // If neither, refuses rather than synthesizing fake events — the user
    // would otherwise see (and possibly tweet) demo placeholders thinking
    // they're real news.
    function triggerManual() {
        if (STATE.active) return;
        dismissPrompt();
        let result = findMostRecentBriefingDate(3);
        if (!result) result = findMostRecentBriefingDate(1);
        if (!result) {
            showNoDataToast();
            return;
        }
        startBriefing(result.events, result.date);
    }

    // Short corner toast when no real events are logged. Tells the user how
    // to bootstrap their first briefing without showing fake data.
    function showNoDataToast() {
        const old = document.getElementById('sc-briefing-nodata');
        if (old) old.remove();
        const host = document.createElement('div');
        host.id = 'sc-briefing-nodata';
        host.innerHTML = `
            <div class="sc-bp-head">
                <span class="sc-bp-emoji">📽</span>
                <span class="sc-bp-title">No briefing yet</span>
                <button class="sc-bp-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-bp-body">No real AI news events have been logged in the last 14 days. The briefing builds from headlines the city auto-reacts to — keep the app open during breaking news to populate your first briefing.</div>
        `;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('sc-bp-in'));
        host.querySelector('.sc-bp-close').onclick = () => {
            host.classList.remove('sc-bp-in');
            setTimeout(() => host.remove(), 280);
        };
        setTimeout(() => {
            if (host.parentNode) {
                host.classList.remove('sc-bp-in');
                setTimeout(() => host.remove(), 280);
            }
        }, 8000);
    }

    function setupHotkey() {
        window.addEventListener('keydown', (e) => {
            // Shift+B (or shift+b) — only when not typing in an input
            if (!e.shiftKey) return;
            if (e.key !== 'B' && e.key !== 'b') return;
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
            e.preventDefault();
            triggerManual();
        }, { passive: false });
    }

    function buildTriggerButton() {
        if (document.getElementById('briefing-btn')) return;
        const bar = document.getElementById('mpReactions');
        if (!bar) return;
        const btn = document.createElement('button');
        btn.id = 'briefing-btn';
        btn.className = 'mp-react-btn briefing-btn';
        btn.title = 'Daily Briefing (Shift+B)';
        btn.textContent = '📽';
        btn.onclick = triggerManual;
        bar.appendChild(btn);
    }

    function tryAttachTriggerButton(retries) {
        retries = retries || 0;
        if (document.getElementById('briefing-btn')) return;
        if (document.getElementById('mpReactions')) { buildTriggerButton(); return; }
        if (retries > 100) return;
        setTimeout(() => tryAttachTriggerButton(retries + 1), 100);
    }

    // ─── PUBLIC TEST HOOK ────────────────────────────────────────────────────
    function _test() {
        // Synthesize 6 fake events for "yesterday" and start the briefing now.
        const yest = yesterdayUtcDateString();
        const labs = (typeof LABS !== 'undefined') ? Object.keys(LABS).filter(k => k !== 'other').slice(0, 6) : ['openai','anthropic','google','xai','meta','deepseek'];
        if (!labs.length) labs.push('openai');
        const types = ['celebrate','crisis','emergency','regulatory','celebrate','crisis'];
        const titles = [
            'Lab unveils next-gen reasoning model',
            'Lab faces controversy over training data',
            'Board fires CEO in late-night meeting',
            'EU regulators open hearing on lab',
            'Lab partners with Microsoft for $10B deal',
            'Outage hits flagship API for 4 hours'
        ];
        const archetypes = { celebrate: 'Launch Party', crisis: 'Crisis Flicker', emergency: 'Emergency Huddle', regulatory: 'Court Convene' };
        const emojis     = { celebrate: '🎉',           crisis: '😰',             emergency: '🚁',                 regulatory: '⚖️'           };
        const fake = [];
        for (let i = 0; i < 6; i++) {
            const t = types[i];
            fake.push({
                date: yest,
                ts: yest + 'T0' + (8 + i) + ':00:00Z',
                type: t,
                archetype: archetypes[t],
                emoji: emojis[t],
                lab: labs[i % labs.length],
                title: titles[i] + ' (test)',
                url: 'https://news.ycombinator.com'
            });
        }
        startBriefing(fake, yest);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function init() {
        setupHotkey();
        tryAttachTriggerButton();
    }

    return { init, update, _test, abort: abortBriefing, triggerManual, _state: STATE };
})();

// Auto-init on DOM ready
(function() {
    function tryInit() {
        if (typeof DailyBriefing !== 'undefined') DailyBriefing.init();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
})();
