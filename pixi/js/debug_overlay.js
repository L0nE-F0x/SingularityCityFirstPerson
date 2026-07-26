/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   DEBUG / PERF OVERLAY (v1.0.0 — Phase 0b)
   DOM-based overlay toggled with the `~` / `` ` `` key. Reports real-time metrics so we can
   *measure* before we optimize:
     • FPS        — current + rolling min/avg/max over last ~60 frames
     • Frame time — last frame ms + a 120-sample spark graph
     • Sprites    — recursive child count of G.app.stage
     • Textures   — PIXI TextureCache size
     • Memory     — JS heap (Chromium only; hidden on Safari/FF)
     • Mode       — city / macro / interior / orbit / xray
     • Camera     — x, y, zoom
     • Tick       — engine.tick

   Rendered as absolutely positioned HTML (not PIXI) so the overlay never shows up in its own
   sprite count and the measurement cost stays constant regardless of what PIXI is doing.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Debug = {
    active: false,
    el: null,
    graphCanvas: null,
    graphCtx: null,

    // Rolling samples
    _samples: [],           // last N frame times (ms)
    _maxSamples: 120,
    _lastFrameTime: 0,
    _fpsMin: Infinity,
    _fpsMax: 0,

    // Throttle the text update so the readout doesn't flicker at 60Hz
    _textTick: 0,

    init() {
        // Build the DOM overlay once. It stays hidden until toggled.
        const el = document.createElement('div');
        el.id = 'debugOverlay';
        el.style.cssText = [
            'position:fixed',
            'top:max(8px, env(safe-area-inset-top))',
            'left:max(8px, env(safe-area-inset-left))',
            'z-index:99999',
            'padding:10px 12px',
            'background:rgba(0,0,0,0.78)',
            'color:#0f0',
            'font:11px/1.45 "Press Start 2P", "Courier New", monospace',
            'letter-spacing:0.5px',
            'border:1px solid rgba(0,255,0,0.35)',
            'border-radius:4px',
            'pointer-events:none',
            'text-shadow:0 0 2px #0f0',
            'min-width:230px',
            'max-width:calc(100vw - 16px)',
            'display:none',
            'backdrop-filter:blur(2px)',
            '-webkit-backdrop-filter:blur(2px)',
            'user-select:none',
        ].join(';');

        el.innerHTML = `
            <div style="color:#9fc;font-weight:bold;margin-bottom:6px;letter-spacing:1px">◆ DEBUG / PERF</div>
            <div id="dbgFps">FPS: --</div>
            <div id="dbgFrame">FRM: -- ms</div>
            <canvas id="dbgGraph" width="220" height="38"
                    style="display:block;margin:4px 0 6px;background:rgba(0,255,0,0.05);border:1px solid rgba(0,255,0,0.2)"></canvas>
            <div id="dbgSprites">SPR: --</div>
            <div id="dbgTextures">TEX: --</div>
            <div id="dbgMem" style="display:none">MEM: --</div>
            <div id="dbgMode">MODE: --</div>
            <div id="dbgCam">CAM: --</div>
            <div id="dbgCull">CULL: --</div>
            <div id="dbgLazy">LZN: --</div>
            <div id="dbgGoal">GOAL: --</div>
            <div id="dbgTick">TICK: --</div>
            <div style="color:#6a6;font-size:9px;margin-top:6px;letter-spacing:0.5px">~ to toggle</div>
        `;
        document.body.appendChild(el);
        this.el = el;

        this.graphCanvas = el.querySelector('#dbgGraph');
        this.graphCtx = this.graphCanvas.getContext('2d');

        // Hide MEM row if the Chromium non-standard API is unavailable
        if (performance && performance.memory) {
            el.querySelector('#dbgMem').style.display = '';
        }

        // Hotkey listener. Backtick / tilde same physical key. Ignore when typing in inputs.
        window.addEventListener('keydown', (e) => {
            if (e.key !== '`' && e.key !== '~') return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            e.preventDefault();
            this.toggle();
        });

        this._lastFrameTime = performance.now();
    },

    toggle() {
        if (this.active) this.hide();
        else this.show();
    },

    show() {
        if (!this.el) return;
        this.active = true;
        this.el.style.display = '';
        // Reset rolling stats so the first opened reading isn't polluted by stale data
        this._samples.length = 0;
        this._fpsMin = Infinity;
        this._fpsMax = 0;
        this._lastFrameTime = performance.now();
    },

    hide() {
        if (!this.el) return;
        this.active = false;
        this.el.style.display = 'none';
    },

    // Called from the engine ticker every frame (cheap no-op when hidden)
    update() {
        if (!this.active || !this.el) return;

        const now = performance.now();
        const dt = now - this._lastFrameTime;
        this._lastFrameTime = now;

        // Filter background-tick pollution. When the tab is hidden, engine.js falls
        // back to a setInterval(500) loop which would show up as giant frame times and
        // wreck the rolling average. Anything ≥100ms is almost certainly a bg tick
        // or a real stall — either way it's not a useful rAF sample.
        if (dt < 100) {
            this._samples.push(dt);
            if (this._samples.length > this._maxSamples) this._samples.shift();

            const fps = dt > 0 ? 1000 / dt : 0;
            if (fps < this._fpsMin) this._fpsMin = fps;
            if (fps > this._fpsMax) this._fpsMax = fps;
        }

        // Draw the spark graph every frame (cheap — 220x38 canvas)
        this._drawGraph();

        // Text updates every 6 frames (~10Hz) so the eye can actually read them
        this._textTick++;
        if (this._textTick % 6 !== 0) return;

        // Rolling average
        let sum = 0;
        for (let i = 0; i < this._samples.length; i++) sum += this._samples[i];
        const avgMs = sum / this._samples.length;
        const avgFps = avgMs > 0 ? 1000 / avgMs : 0;

        // Colour FPS by health
        let fpsColour = '#0f0';
        if (avgFps < 30) fpsColour = '#f33';
        else if (avgFps < 50) fpsColour = '#fd3';

        this.el.querySelector('#dbgFps').innerHTML =
            `FPS: <span style="color:${fpsColour}">${avgFps.toFixed(0)}</span> ` +
            `<span style="color:#6a6;font-size:9px">(${this._fpsMin === Infinity ? '--' : this._fpsMin.toFixed(0)}/${this._fpsMax.toFixed(0)})</span>`;
        this.el.querySelector('#dbgFrame').textContent = `FRM: ${avgMs.toFixed(1)} ms`;

        // Sprite count — recursive walk of stage
        let spriteCount = 0;
        if (typeof G !== 'undefined' && G.app && G.app.stage) {
            spriteCount = this._countChildren(G.app.stage);
        }
        this.el.querySelector('#dbgSprites').textContent = `SPR: ${spriteCount.toLocaleString()}`;

        // Texture cache size
        let texCount = 0;
        if (typeof PIXI !== 'undefined' && PIXI.utils && PIXI.utils.TextureCache) {
            texCount = Object.keys(PIXI.utils.TextureCache).length;
        }
        this.el.querySelector('#dbgTextures').textContent = `TEX: ${texCount}`;

        // Heap (Chromium only)
        if (performance && performance.memory) {
            const mb = performance.memory.usedJSHeapSize / 1048576;
            this.el.querySelector('#dbgMem').textContent = `MEM: ${mb.toFixed(0)} MB`;
        }

        // Mode
        let mode = 'city';
        if (typeof G !== 'undefined') {
            if (G.activeInterior) mode = 'interior:' + G.activeInterior;
            else if (typeof OrbitMode !== 'undefined' && OrbitMode.active) mode = 'orbit';
            else if (typeof XRayMode !== 'undefined' && XRayMode.active) mode = 'xray';
            else if (G.viewMode === 'macro') mode = 'macro';
        }
        this.el.querySelector('#dbgMode').textContent = `MODE: ${mode}`;

        // Camera
        if (typeof Camera !== 'undefined') {
            this.el.querySelector('#dbgCam').textContent =
                `CAM: ${Camera.x.toFixed(0)},${Camera.y.toFixed(0)} z${Camera.zoom.toFixed(2)}`;
        }

        // Cull stats (how many characters/cars/vendors the off-screen pass hid this frame)
        if (typeof G !== 'undefined' && G._cullStats) {
            const s = G._cullStats;
            const pct = s.total > 0 ? Math.round((s.hidden / s.total) * 100) : 0;
            this.el.querySelector('#dbgCull').textContent =
                `CULL: ${s.hidden}/${s.total} (${pct}%)`;
        }

        // Lazy zone boot stats (how many of the deferred zones have been visited yet)
        if (typeof G !== 'undefined' && typeof G._lazyZoneStats === 'function') {
            const lz = G._lazyZoneStats();
            this.el.querySelector('#dbgLazy').textContent =
                `LZN: ${lz.booted}/${lz.total}`;
        }

        // Goal-driven NPC counts (~20% of adult models get a lifestyle archetype)
        if (typeof Goals !== 'undefined' && typeof Goals.stats === 'function') {
            // Cache — stats walk every model, so only update every 60 text ticks (~60s)
            if (!this._goalCache || this._textTick - this._goalCacheTick > 360) {
                this._goalCache = Goals.stats();
                this._goalCacheTick = this._textTick;
            }
            const gs = this._goalCache;
            this.el.querySelector('#dbgGoal').textContent =
                `GOAL: ${gs.withGoal}/${gs.total}`;
        }

        // Engine tick
        if (typeof G !== 'undefined' && G.tick != null) {
            this.el.querySelector('#dbgTick').textContent = `TICK: ${G.tick}`;
        }
    },

    _countChildren(node) {
        let n = 1;
        if (node.children && node.children.length) {
            for (let i = 0; i < node.children.length; i++) {
                n += this._countChildren(node.children[i]);
            }
        }
        return n;
    },

    _drawGraph() {
        const ctx = this.graphCtx;
        const w = this.graphCanvas.width;
        const h = this.graphCanvas.height;
        ctx.clearRect(0, 0, w, h);

        // Baseline reference lines at 16.67ms (60fps) and 33.33ms (30fps)
        const scaleMs = 50; // top of graph = 50ms (20fps) — anything above clips
        const y60 = h - (16.67 / scaleMs) * h;
        const y30 = h - (33.33 / scaleMs) * h;

        ctx.strokeStyle = 'rgba(0,255,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y60);
        ctx.lineTo(w, y60);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,200,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(0, y30);
        ctx.lineTo(w, y30);
        ctx.stroke();

        // Frame time bars
        const n = this._samples.length;
        if (n === 0) return;
        const barW = w / this._maxSamples;
        for (let i = 0; i < n; i++) {
            const ms = this._samples[i];
            const barH = Math.min((ms / scaleMs) * h, h);
            // Colour by health — green ≤16.67ms, yellow ≤33ms, red above
            let col = '#0f0';
            if (ms > 33.33) col = '#f33';
            else if (ms > 16.67) col = '#fd3';
            ctx.fillStyle = col;
            ctx.fillRect(i * barW, h - barH, Math.max(1, barW - 0.5), barH);
        }
    },
};
