/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   X-RAY MODE (v2.0.0 — Data Spine Diagnostic Overlay)
   Strips away city visuals to reveal pure data flows, network connections, building stats,
   and inter-lab relationships as a dark hacker/terminal aesthetic.
   v2: Correct dynamic building heights, population heat fills, benchmark bars, model counts,
       animated vertical data streams inside tall buildings, live HUD legend.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const XRayMode = {
    active: false,
    overlay: null,         // PIXI container for x-ray graphics
    _dataFlows: [],        // Animated data packets between buildings
    _statLabels: [],       // Building stat text overlays
    _wireframes: [],       // Building wireframe outlines
    _gridLines: null,      // Background grid
    _connectionLines: null, // Lab-to-lab connection lines
    _pulseRings: [],       // Pulse rings at building bases
    _scanLine: null,       // Horizontal scan line effect
    _scanY: 0,
    _dataStreams: [],       // Vertical data streams inside buildings
    _hud: null,            // HUD container (fixed on screen)

    // Saved layer alphas for restoration
    _savedAlphas: {},

    // ─── Height helper — matches environment.js exactly ───
    _getBldH(b) {
        const floors = b.dynamicFl || b.fl || 2;
        return floors * 18 + 24;
    },

    _getBldFloors(b) {
        return b.dynamicFl || b.fl || 2;
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (this.active || !G.app || G.activeInterior) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;
        this.active = true;

        const btn = document.getElementById('btnXRay');
        if (btn) btn.classList.add('xray-active');

        const wrap = document.getElementById('gameWrap');
        if (wrap) wrap.classList.add('xray-mode');

        // Save & fully HIDE existing world layers so X-Ray reads as a pure neon overlay
        // on black (works regardless of day/night — no faded-daylight bleed-through).
        this._savedAlphas = {
            cloud: G.cloudLayer ? G.cloudLayer.alpha : 1,
            stars: G.starsLayer ? G.starsLayer.alpha : 1,
            celestial: G.celestialGfx ? G.celestialGfx.alpha : 1,
            light: G.lightLayer ? G.lightLayer.alpha : 1,
            staticLights: G.staticLightsGfx ? G.staticLightsGfx.alpha : 1,
            char: G.charLayer ? G.charLayer.alpha : 1,
            car: G.carLayer ? G.carLayer.alpha : 1,
            fx: G.fxGfx ? G.fxGfx.alpha : 1,
            reflection: G.reflectionLayer ? G.reflectionLayer.alpha : 1,
            bld: G.bldLayer ? G.bldLayer.alpha : 1,
            ground: G.groundGfx ? G.groundGfx.alpha : 1,
            underground: G.undergroundLayer ? G.undergroundLayer.alpha : 1,
            train: G.trainLayer ? G.trainLayer.alpha : 1,
        };

        if (G.cloudLayer) G.cloudLayer.alpha = 0;
        if (G.starsLayer) G.starsLayer.alpha = 0;
        if (G.celestialGfx) G.celestialGfx.alpha = 0;
        if (G.lightLayer) G.lightLayer.alpha = 0;
        if (G.staticLightsGfx) G.staticLightsGfx.alpha = 0;
        if (G.charLayer) G.charLayer.alpha = 0;
        if (G.carLayer) G.carLayer.alpha = 0;
        if (G.fxGfx) G.fxGfx.alpha = 0;
        if (G.reflectionLayer) G.reflectionLayer.alpha = 0;
        if (G.bldLayer) G.bldLayer.alpha = 0;
        if (G.groundGfx) G.groundGfx.alpha = 0;
        if (G.undergroundLayer) G.undergroundLayer.alpha = 0;
        if (G.trainLayer) G.trainLayer.alpha = 0;

        // Build overlay
        this.overlay = new PIXI.Container();
        this.overlay.zIndex = 999;
        G.world.addChild(this.overlay);

        this._buildBackdrop();
        this._buildGrid();
        this._buildHorizon();
        this._buildWireframes();
        this._buildConnections();
        this._buildStatLabels();
        this._buildScanLine();
        this._buildHUD();

    },

    exit() {
        if (!this.active) return;
        this.active = false;

        const btn = document.getElementById('btnXRay');
        if (btn) btn.classList.remove('xray-active');

        const wrap = document.getElementById('gameWrap');
        if (wrap) wrap.classList.remove('xray-mode');

        // Restore layer alphas
        const s = this._savedAlphas;
        if (G.cloudLayer) G.cloudLayer.alpha = s.cloud != null ? s.cloud : 1;
        if (G.starsLayer) G.starsLayer.alpha = s.stars != null ? s.stars : 1;
        if (G.celestialGfx) G.celestialGfx.alpha = s.celestial != null ? s.celestial : 1;
        if (G.lightLayer) G.lightLayer.alpha = s.light != null ? s.light : 1;
        if (G.staticLightsGfx) G.staticLightsGfx.alpha = s.staticLights != null ? s.staticLights : 1;
        if (G.charLayer) G.charLayer.alpha = s.char != null ? s.char : 1;
        if (G.carLayer) G.carLayer.alpha = s.car != null ? s.car : 1;
        if (G.fxGfx) G.fxGfx.alpha = s.fx != null ? s.fx : 1;
        if (G.reflectionLayer) G.reflectionLayer.alpha = s.reflection != null ? s.reflection : 1;
        if (G.bldLayer) G.bldLayer.alpha = s.bld != null ? s.bld : 1;
        if (G.groundGfx) G.groundGfx.alpha = s.ground != null ? s.ground : 1;
        if (G.undergroundLayer) G.undergroundLayer.alpha = s.underground != null ? s.underground : 1;
        if (G.trainLayer) G.trainLayer.alpha = s.train != null ? s.train : 1;
        // Force sky to re-apply on next environment update (skip-if-active path was taken)
        if (typeof Environment !== 'undefined') Environment._lastSky = null;

        // Remove overlay
        if (this.overlay) {
            if (this.overlay.parent) this.overlay.parent.removeChild(this.overlay);
            this.overlay.destroy({ children: true });
            this.overlay = null;
        }

        // Remove HUD
        if (this._hud) {
            if (this._hud.parent) this._hud.parent.removeChild(this._hud);
            this._hud.destroy({ children: true });
            this._hud = null;
        }

        this._dataFlows = [];
        this._statLabels = [];
        this._wireframes = [];
        this._pulseRings = [];
        this._dataStreams = [];
        this._gridLines = null;
        this._connectionLines = null;
        this._scanLine = null;

    },

    // ─── BACKDROP: Solid near-black rectangle covering the full world area ───
    _buildBackdrop() {
        const bg = new PIXI.Graphics();
        const cityW = G.cityW || G.getCityWidth();
        bg.beginFill(0x02060a, 1);
        bg.drawRect(-4000, -5000, cityW + 8000, 10000);
        bg.endFill();
        bg.beginFill(0x031018, 0.5);
        bg.drawRect(-4000, -5000, cityW + 8000, 4500);
        bg.endFill();
        this.overlay.addChild(bg);
    },

    // ─── GRID: Neon coordinate grid across the full scene ───
    _buildGrid() {
        const g = new PIXI.Graphics();
        const gy = G.groundY;
        const cityW = G.cityW || G.getCityWidth();
        const topY = gy - 1400;
        const botY = gy + 400;

        g.lineStyle(1, 0x00ff88, 0.05);
        for (let x = 0; x < cityW; x += 120) {
            g.moveTo(x, topY); g.lineTo(x, botY);
        }
        for (let y = topY; y <= botY; y += 60) {
            g.moveTo(0, y); g.lineTo(cityW, y);
        }
        g.lineStyle(1, 0x00ff88, 0.12);
        for (let x = 0; x < cityW; x += 600) {
            g.moveTo(x, topY); g.lineTo(x, botY);
        }
        for (let y = topY; y <= botY; y += 300) {
            g.moveTo(0, y); g.lineTo(cityW, y);
        }

        this._gridLines = g;
        this.overlay.addChild(g);
    },

    // ─── HORIZON: Bright neon ground line + underground band ───
    _buildHorizon() {
        const g = new PIXI.Graphics();
        const gy = G.groundY;
        const cityW = G.cityW || G.getCityWidth();

        g.lineStyle(2, 0x00ff88, 0.8);
        g.moveTo(-2000, gy); g.lineTo(cityW + 2000, gy);
        g.lineStyle(4, 0x00ff88, 0.15);
        g.moveTo(-2000, gy + 2); g.lineTo(cityW + 2000, gy + 2);

        g.beginFill(0x001a12, 0.5);
        g.drawRect(-2000, gy + 4, cityW + 4000, 280);
        g.endFill();

        // Dotted depth horizons
        g.lineStyle(1, 0x00ff88, 0.25);
        for (let x = -2000; x < cityW + 2000; x += 12) {
            g.moveTo(x, gy + 120); g.lineTo(x + 6, gy + 120);
        }
        g.lineStyle(1, 0x06b6d4, 0.35);
        for (let x = -2000; x < cityW + 2000; x += 14) {
            g.moveTo(x, gy + 220); g.lineTo(x + 7, gy + 220);
        }
        g.lineStyle(1, 0xf59e0b, 0.3);
        for (let x = -2000; x < cityW + 2000; x += 14) {
            g.moveTo(x, gy + 237); g.lineTo(x + 7, gy + 237);
        }

        this.overlay.addChild(g);
    },

    // ─── WIREFRAMES: Neon outlines of all buildings (using DYNAMIC height) ───
    _buildWireframes() {
        this._wireframes = [];
        this._pulseRings = [];
        this._dataStreams = [];
        const gy = G.groundY;

        BLDS.forEach(b => {
            if (!b.w || b.w < 10) return;
            const h = this._getBldH(b);
            const floors = this._getBldFloors(b);
            const labColor = this._getLabColor(b);

            const wf = new PIXI.Graphics();

            // ─── Population heat fill (taller fill = more models) ───
            const pop = this._getBldPop(b);
            if (pop > 0) {
                const heatPct = Math.min(1, pop / Math.max(1, floors * 4));
                const heatH = h * heatPct;
                wf.beginFill(labColor, 0.04 + heatPct * 0.12);
                wf.drawRect(b.x, gy - heatH, b.w, heatH);
                wf.endFill();
            }

            // Soft inner fill
            wf.beginFill(labColor, 0.06);
            wf.drawRect(b.x, gy - h, b.w, h);
            wf.endFill();
            // Outer glow
            wf.lineStyle(4, labColor, 0.18);
            wf.drawRect(b.x, gy - h, b.w, h);
            // Main neon stroke
            wf.lineStyle(1.5, labColor, 0.95);
            wf.drawRect(b.x, gy - h, b.w, h);

            // Floor lines
            wf.lineStyle(0.5, labColor, 0.25);
            for (let f = 1; f < floors; f++) {
                const fy = gy - f * 18;
                wf.moveTo(b.x, fy); wf.lineTo(b.x + b.w, fy);
            }

            // Corner brackets
            const bracketLen = Math.min(12, b.w * 0.15);
            wf.lineStyle(2, labColor, 1.0);
            wf.moveTo(b.x, gy - h + bracketLen); wf.lineTo(b.x, gy - h); wf.lineTo(b.x + bracketLen, gy - h);
            wf.moveTo(b.x + b.w - bracketLen, gy - h); wf.lineTo(b.x + b.w, gy - h); wf.lineTo(b.x + b.w, gy - h + bracketLen);
            wf.moveTo(b.x, gy - bracketLen); wf.lineTo(b.x, gy); wf.lineTo(b.x + bracketLen, gy);
            wf.moveTo(b.x + b.w - bracketLen, gy); wf.lineTo(b.x + b.w, gy); wf.lineTo(b.x + b.w, gy - bracketLen);

            // ─── Benchmark score bar (left edge, inside building) ───
            const bmScore = this._getBldBenchmark(b);
            if (bmScore > 0) {
                const barMaxH = h - 6;
                const barH = (bmScore / 100) * barMaxH;
                wf.beginFill(0x22d3ee, 0.15);
                wf.drawRect(b.x + 2, gy - barH - 3, 4, barH);
                wf.endFill();
                wf.beginFill(0x22d3ee, 0.5);
                wf.drawRect(b.x + 2, gy - barH - 3, 4, Math.min(6, barH));
                wf.endFill();
            }

            this.overlay.addChild(wf);
            this._wireframes.push(wf);

            // ─── Animated vertical data streams (inside tall buildings) ───
            if (floors >= 5 && b.w >= 40) {
                const streamCount = Math.min(4, Math.floor(b.w / 40));
                for (let si = 0; si < streamCount; si++) {
                    const sx = b.x + b.w * (0.2 + si * 0.6 / Math.max(1, streamCount - 1));
                    const stream = new PIXI.Graphics();
                    stream._bx = sx;
                    stream._topY = gy - h + 4;
                    stream._botY = gy - 4;
                    stream._col = labColor;
                    stream._phase = Math.random() * h;
                    stream._speed = 0.5 + Math.random() * 1.0;
                    this.overlay.addChild(stream);
                    this._dataStreams.push(stream);
                }
            }

            // Pulse ring at building base
            const ring = new PIXI.Graphics();
            ring._cx = b.x + b.w / 2;
            ring._cy = gy;
            ring._col = labColor;
            ring._phase = Math.random() * Math.PI * 2;
            ring._radius = b.w * 0.3;
            this.overlay.addChild(ring);
            this._pulseRings.push(ring);
        });
    },

    // ─── CONNECTIONS: Lines between buildings of the same lab ───
    _buildConnections() {
        const gy = G.groundY;
        const g = new PIXI.Graphics();
        const labGroups = {};

        BLDS.forEach(b => {
            if (!b.lab) return;
            if (!labGroups[b.lab]) labGroups[b.lab] = [];
            labGroups[b.lab].push(b);
        });

        // Draw arc connections between same-lab buildings
        Object.entries(labGroups).forEach(([lab, blds]) => {
            if (blds.length < 2) return;
            const col = this._getLabColorFromId(lab);

            for (let i = 0; i < blds.length - 1; i++) {
                const a = blds[i];
                const bld = blds[i + 1];
                const ax = a.x + a.w / 2;
                const bx = bld.x + bld.w / 2;
                const midX = (ax + bx) / 2;
                const dist = Math.abs(bx - ax);
                const arcHeight = Math.min(dist * 0.15, 60);

                g.lineStyle(1.2, col, 0.35);
                g.moveTo(ax, gy - 5);
                g.quadraticCurveTo(midX, gy - 5 - arcHeight, bx, gy - 5);
            }

            if (blds.length >= 2) {
                for (let i = 0; i < Math.min(blds.length - 1, 3); i++) {
                    this._spawnDataFlow(blds[i], blds[i + 1], col);
                }
            }
        });

        // Cross-lab data flow: connect labs that share a zone
        const zonePairs = [
            ['robotics_', 0x22c55e],
            ['longevity_', 0x8b5cf6],
            ['backbone_', 0x06b6d4],
            ['dc_', 0x3b82f6],
            ['power_', 0xfbbf24],
        ];
        zonePairs.forEach(([prefix, col]) => {
            const zoneBlds = BLDS.filter(b => b.id.startsWith(prefix));
            for (let i = 0; i < zoneBlds.length - 1; i++) {
                const a = zoneBlds[i];
                const bld = zoneBlds[i + 1];
                g.lineStyle(1, col, 0.28);
                g.moveTo(a.x + a.w / 2, gy - 5);
                g.lineTo(bld.x + bld.w / 2, gy - 5);
                this._spawnDataFlow(a, bld, col);
            }
        });

        this._connectionLines = g;
        this.overlay.addChild(g);
    },

    _spawnDataFlow(bldA, bldB, col) {
        const gy = G.groundY;
        const packet = new PIXI.Graphics();
        packet.beginFill(col, 0.8);
        packet.drawCircle(0, 0, 2);
        packet.endFill();
        packet.lineStyle(1, col, 0.3);
        packet.drawCircle(0, 0, 4);

        const ax = bldA.x + bldA.w / 2;
        const bx = bldB.x + bldB.w / 2;
        const dist = Math.abs(bx - ax);
        const arcHeight = Math.min(dist * 0.15, 60);

        packet._ax = ax;
        packet._bx = bx;
        packet._arcHeight = arcHeight;
        packet._baseY = gy - 5;
        packet._t = Math.random();
        packet._speed = 0.003 + Math.random() * 0.004;
        packet._dir = Math.random() > 0.5 ? 1 : -1;

        packet.x = ax;
        packet.y = gy - 5;
        this.overlay.addChild(packet);
        this._dataFlows.push(packet);
    },

    // ─── STAT LABELS: Building name + key metrics floating above ───
    _buildStatLabels() {
        const gy = G.groundY;
        this._statLabels = [];

        BLDS.forEach(b => {
            if (!b.w || b.w < 30) return;
            const h = this._getBldH(b);
            const floors = this._getBldFloors(b);
            const labColor = this._getLabColor(b);
            const hexStr = '#' + labColor.toString(16).padStart(6, '0');

            // Building name (use readable name, fallback to id)
            const displayName = b.name || b.id;
            const idLabel = new PIXI.Text(displayName, {
                fontFamily: 'monospace', fontSize: 7, fill: hexStr, fontWeight: 'bold'
            });
            idLabel.anchor.set(0.5, 1);
            idLabel.x = b.x + b.w / 2;
            idLabel.y = gy - h - 20;
            // Scale down if too wide for the building
            if (idLabel.width > b.w + 20) idLabel.scale.set((b.w + 20) / idLabel.width);
            this.overlay.addChild(idLabel);
            this._statLabels.push(idLabel);

            // Stats line: floors | population | benchmark
            const stats = [];
            stats.push(floors + 'F');
            const pop = this._getBldPop(b);
            if (pop > 0) stats.push(pop + (b.lab ? ' models' : ' pop'));
            const bm = this._getBldBenchmark(b);
            if (bm > 0) stats.push('BM:' + bm.toFixed(0));
            if (b.lab) {
                const labInfo = typeof LABS !== 'undefined' && LABS[b.lab];
                if (labInfo && labInfo.region) stats.push(labInfo.region.toUpperCase());
            }

            if (stats.length > 0) {
                const statLine = new PIXI.Text(stats.join(' | '), {
                    fontFamily: 'monospace', fontSize: 6, fill: 0x64748b
                });
                statLine.anchor.set(0.5, 1);
                statLine.x = b.x + b.w / 2;
                statLine.y = gy - h - 10;
                if (statLine.width > b.w + 20) statLine.scale.set((b.w + 20) / statLine.width);
                this.overlay.addChild(statLine);
                this._statLabels.push(statLine);
            }

            // ─── Model count badge (circle with number, top-right of building) ───
            if (pop > 0 && b.w >= 40) {
                const badge = new PIXI.Graphics();
                const badgeX = b.x + b.w - 1;
                const badgeY = gy - h + 1;
                const badgeR = Math.max(7, Math.min(12, pop * 0.6));
                badge.beginFill(0x000000, 0.7);
                badge.drawCircle(badgeX, badgeY, badgeR + 1);
                badge.endFill();
                badge.lineStyle(1.5, labColor, 0.9);
                badge.drawCircle(badgeX, badgeY, badgeR);
                this.overlay.addChild(badge);

                const countTxt = new PIXI.Text(String(pop), {
                    fontFamily: 'monospace', fontSize: pop >= 10 ? 6 : 7, fill: hexStr, fontWeight: 'bold'
                });
                countTxt.anchor.set(0.5, 0.5);
                countTxt.x = badgeX;
                countTxt.y = badgeY;
                this.overlay.addChild(countTxt);
                this._statLabels.push(countTxt);
            }
        });
    },

    // ─── SCAN LINE: Horizontal sweep effect ───
    _buildScanLine() {
        const sl = new PIXI.Graphics();
        sl.beginFill(0x00ff88, 0.2);
        sl.drawRect(-5000, 0, 80000, 2);
        sl.endFill();
        sl.beginFill(0x00ff88, 0.08);
        sl.drawRect(-5000, -20, 80000, 20);
        sl.endFill();
        sl.beginFill(0x00ff88, 0.04);
        sl.drawRect(-5000, -50, 80000, 30);
        sl.endFill();
        this._scanLine = sl;
        this._scanY = G.groundY - 1000;
        sl.y = this._scanY;
        this.overlay.addChild(sl);
    },

    // ─── HUD: Fixed on-screen legend + live stats ───
    _buildHUD() {
        this._hud = new PIXI.Container();
        this._hud.zIndex = 1000;
        // Add to stage (not world) so it stays fixed on screen
        G.app.stage.addChild(this._hud);

        const pad = 10;
        const lineH = 13;
        let y = pad;

        // Title
        const title = new PIXI.Text('X-RAY DIAGNOSTIC', {
            fontFamily: 'monospace', fontSize: 9, fill: 0x00ff88, fontWeight: 'bold', letterSpacing: 2
        });
        title.x = pad; title.y = y;
        this._hud.addChild(title);
        y += lineH + 4;

        // Separator
        const sep = new PIXI.Graphics();
        sep.beginFill(0x00ff88, 0.3); sep.drawRect(pad, y, 130, 1); sep.endFill();
        this._hud.addChild(sep);
        y += 6;

        // Live stats (updated each frame)
        const models = G.models || [];
        const alive = models.filter(m => !m.ret || new Date(m.ret) > new Date()).length;
        const labCount = typeof LABS !== 'undefined' ? Object.keys(LABS).length : 0;
        const bldCount = BLDS.length;

        const statLines = [
            { label: 'MODELS', val: alive + ' / ' + models.length, col: 0x22d3ee },
            { label: 'LABS', val: String(labCount), col: 0xfbbf24 },
            { label: 'BUILDINGS', val: String(bldCount), col: 0x00ff88 },
        ];

        // Add benchmark leader if available
        if (typeof BM !== 'undefined') {
            let topElo = 0, topName = '';
            models.forEach(m => {
                const elo = BM[m.id]?.ELO || 0;
                if (elo > topElo) { topElo = elo; topName = m.name; }
            });
            if (topName) {
                statLines.push({ label: 'TOP ELO', val: topName.split(' ')[0] + ' ' + topElo.toFixed(0), col: 0xef4444 });
            }
        }

        // Day phase
        const dp = G.getDayPhase();
        const hours = Math.floor(dp * 24);
        const mins = Math.floor((dp * 24 - hours) * 60);
        statLines.push({ label: 'TIME', val: String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0'), col: 0x64748b });

        statLines.forEach(s => {
            const lbl = new PIXI.Text(s.label, {
                fontFamily: 'monospace', fontSize: 7, fill: 0x475569
            });
            lbl.x = pad; lbl.y = y;
            this._hud.addChild(lbl);

            const val = new PIXI.Text(s.val, {
                fontFamily: 'monospace', fontSize: 7, fill: s.col, fontWeight: 'bold'
            });
            val.anchor.set(1, 0);
            val.x = pad + 138; val.y = y;
            this._hud.addChild(val);
            y += lineH;
        });

        y += 4;
        const sep2 = new PIXI.Graphics();
        sep2.beginFill(0x00ff88, 0.3); sep2.drawRect(pad, y, 130, 1); sep2.endFill();
        this._hud.addChild(sep2);
        y += 6;

        // Legend
        const legendItems = [
            { col: 0x22d3ee, label: 'Benchmark Bar' },
            { col: 0x00ff88, label: 'Population Heat' },
            { col: 0xfbbf24, label: 'Data Flow' },
        ];
        legendItems.forEach(item => {
            const dot = new PIXI.Graphics();
            dot.beginFill(item.col, 0.9); dot.drawCircle(pad + 4, y + 4, 3); dot.endFill();
            this._hud.addChild(dot);
            const txt = new PIXI.Text(item.label, {
                fontFamily: 'monospace', fontSize: 6, fill: 0x94a3b8
            });
            txt.x = pad + 12; txt.y = y;
            this._hud.addChild(txt);
            y += lineH - 2;
        });

        // Background panel
        const panel = new PIXI.Graphics();
        panel.beginFill(0x020a0f, 0.85);
        panel.drawRoundedRect(pad - 4, pad - 4, 150, y - pad + 8, 4);
        panel.endFill();
        panel.lineStyle(1, 0x00ff88, 0.3);
        panel.drawRoundedRect(pad - 4, pad - 4, 150, y - pad + 8, 4);
        this._hud.addChildAt(panel, 0);
    },

    // ─── UPDATE: Called every frame from engine ───
    update() {
        if (!this.active || !this.overlay) return;
        const fc = G.tick;

        // Data flow packets — move along arcs
        this._dataFlows.forEach(p => {
            if (!p || p.destroyed) return;
            p._t += p._speed * p._dir;
            if (p._t > 1) { p._t = 0; }
            if (p._t < 0) { p._t = 1; }

            const t = p._t;
            const ax = p._ax;
            const bx = p._bx;
            const midX = (ax + bx) / 2;
            const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * midX + t * t * bx;
            const y = (1 - t) * (1 - t) * p._baseY + 2 * (1 - t) * t * (p._baseY - p._arcHeight) + t * t * p._baseY;
            p.x = x;
            p.y = y;
            p.alpha = 0.4 + Math.sin(t * Math.PI) * 0.6;
        });

        // Pulse rings — breathing effect
        this._pulseRings.forEach(ring => {
            if (!ring || ring.destroyed) return;
            ring.clear();
            ring._phase += 0.03;
            const scale = 1 + Math.sin(ring._phase) * 0.3;
            const alpha = 0.15 + Math.sin(ring._phase) * 0.1;
            ring.lineStyle(1, ring._col, alpha);
            ring.drawCircle(ring._cx, ring._cy, ring._radius * scale);
        });

        // Vertical data streams inside tall buildings
        this._dataStreams.forEach(s => {
            if (!s || s.destroyed) return;
            s.clear();
            s._phase += s._speed;
            const streamH = s._botY - s._topY;
            if (streamH <= 0) return;
            // Draw falling dots
            for (let di = 0; di < 5; di++) {
                const dotY = s._topY + ((s._phase + di * streamH / 5) % streamH);
                const a = 0.15 + Math.sin(fc * 0.05 + di * 1.3) * 0.15;
                s.beginFill(s._col, a);
                s.drawCircle(s._bx, dotY, 1);
                s.endFill();
            }
            // Dim vertical line
            s.lineStyle(0.5, s._col, 0.06);
            s.moveTo(s._bx, s._topY); s.lineTo(s._bx, s._botY);
        });

        // Scan line — sweep up and down
        if (this._scanLine) {
            this._scanY += 1.2;
            if (this._scanY > G.groundY + 50) this._scanY = G.groundY - 1200;
            this._scanLine.y = this._scanY;
        }
    },

    // ─── DATA HELPERS ───
    _getBldPop(b) {
        if (!G.models) return 0;
        if (b.lab) {
            return G.models.filter(m => m.lab === b.lab && (!m.ret || new Date(m.ret) > new Date())).length;
        }
        if (b.id.startsWith('res_')) {
            const region = b.id.split('_')[1] || 'eu';
            return G.models.filter(m => {
                if (m.ret && new Date(m.ret) <= new Date()) return false;
                const r = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
                return r === region;
            }).length;
        }
        return 0;
    },

    _getBldBenchmark(b) {
        if (!b.lab || typeof BM === 'undefined' || !G.models) return 0;
        let best = 0;
        G.models.forEach(m => {
            if (m.lab !== b.lab) return;
            if (m.ret && new Date(m.ret) <= new Date()) return;
            const elo = BM[m.id]?.ELO || 0;
            if (elo > best) best = elo;
            if (best === 0) {
                const bms = BM[m.id] || {};
                const vals = Object.values(bms).filter(v => typeof v === 'number' && v > 0);
                if (vals.length > 0) {
                    const avg = vals.reduce((a, c) => a + c, 0) / vals.length;
                    if (avg > best) best = avg;
                }
            }
        });
        return best;
    },

    // ─── COLOR HELPERS ───
    _getLabColor(bld) {
        if (bld.lab && typeof LABS !== 'undefined' && LABS[bld.lab]) {
            return parseInt(LABS[bld.lab].color.replace('#', ''), 16) || 0x00ff88;
        }
        if (bld.type === 'robotics') return 0xf59e0b;
        if (bld.type === 'longevity') return 0x22c55e;
        if (bld.type === 'backbone') return 0x06b6d4;
        if (bld.type === 'court') return 0xef4444;
        if (bld.type === 'jail') return 0xea580c;
        if (bld.type === 'university') return 0x8b5cf6;
        if (bld.type === 'launchpad') return 0xf97316;
        if (bld.id.startsWith('dc_') || bld.id.startsWith('fab_')) return 0x3b82f6;
        if (bld.id.startsWith('power_')) return 0xfbbf24;
        if (bld.id.startsWith('port_')) return 0x06b6d4;
        if (bld.id.startsWith('vcrow_')) return 0x10b981;
        if (bld.id.startsWith('house_')) return 0xa855f7;
        if (bld.id.startsWith('res_')) return 0x64748b;
        return 0x00ff88;
    },

    _getLabColorFromId(labId) {
        if (typeof LABS !== 'undefined' && LABS[labId]) {
            return parseInt(LABS[labId].color.replace('#', ''), 16) || 0x00ff88;
        }
        return 0x00ff88;
    }
};
