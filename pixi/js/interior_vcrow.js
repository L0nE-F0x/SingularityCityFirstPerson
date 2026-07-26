/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR VC ROW (v1.0.0)
   Self-contained interior module for Venture Capital Row buildings.
   Each building gets themed floors: trading desks, deal boards, pitch stages, vaults, boardrooms.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorVCRow = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    // Floor themes per building
    THEMES: {
        vcrow_apex:         ['reception', 'deal_room', 'partner_offices', 'fund_ops', 'boardroom', 'rooftop_lounge'],
        vcrow_horizon:      ['reception', 'deal_room', 'partner_offices', 'analytics', 'boardroom'],
        vcrow_thrive:       ['reception', 'deal_room', 'partner_offices', 'fund_ops', 'rooftop_lounge'],
        vcrow_foundersfund: ['reception', 'deal_room', 'partner_offices', 'trading_room'],
        vcrow_launchpad:    ['reception', 'coworking', 'pitch_stage'],
        vcrow_mgx:          ['reception', 'analytics', 'client_offices', 'fund_ops', 'boardroom'],
        vcrow_titan:        ['vault', 'reception', 'trading_floor', 'legal', 'boardroom', 'executive'],
        vcrow_exchange:     ['reception', 'broker_floor', 'trading_floor'],
    },

    // NPC pools by theme
    NPCS: {
        reception:       [{ name: 'Receptionist', color: 0x94a3b8 }, { name: 'Security', color: 0xef4444 }],
        deal_room:       [{ name: 'VC Partner', color: 0x4ade80 }, { name: 'Analyst', color: 0x22d3ee }],
        partner_offices: [{ name: 'GP', color: 0xfbbf24 }, { name: 'Associate', color: 0x4ade80 }],
        fund_ops:        [{ name: 'Controller', color: 0x94a3b8 }, { name: 'Compliance', color: 0xa855f7 }],
        rooftop_lounge:  [{ name: 'LP Guest', color: 0xfbbf24 }],
        analytics:       [{ name: 'Quant', color: 0x22d3ee }, { name: 'Data Eng', color: 0x06b6d4 }],
        client_offices:  [{ name: 'Client Mgr', color: 0x4ade80 }],
        trading_room:    [{ name: 'Trader', color: 0xef4444 }, { name: 'Analyst', color: 0x22d3ee }],
        coworking:       [{ name: 'Founder', color: 0xfbbf24 }, { name: 'Hacker', color: 0x4ade80 }],
        pitch_stage:     [{ name: 'Mentor', color: 0xfbbf24 }, { name: 'Judge', color: 0xa855f7 }],
        vault:           [{ name: 'Guard', color: 0xef4444 }],
        trading_floor:   [{ name: 'Trader', color: 0xef4444 }, { name: 'Broker', color: 0x22d3ee }, { name: 'Algo Bot', color: 0x4ade80 }],
        legal:           [{ name: 'Lawyer', color: 0x94a3b8 }, { name: 'Paralegal', color: 0xa855f7 }],
        boardroom:       [{ name: 'Director', color: 0xfbbf24 }, { name: 'Secretary', color: 0x94a3b8 }],
        executive:       [{ name: 'CEO', color: 0xfbbf24 }, { name: 'CFO', color: 0x4ade80 }],
        broker_floor:    [{ name: 'Broker', color: 0x22d3ee }, { name: 'Clerk', color: 0x94a3b8 }],
    },

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];

        // Sky
        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 60; i++) {
            const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0, 0, .5 + Math.random()); s.endFill();
            s.x = Math.random() * G.vpW; s.y = Math.random() * G.vpH * .4; s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const themes = this.THEMES[bld.id] || ['reception', 'trading_floor'];
        const numFloors = themes.length;
        const floorH = 80, roofH = 70;
        this.totalH = roofH + (numFloors + 1) * floorH;
        const startX = 60, bldW = G.vpW - 120;
        const shaftW = 50, shaftX = startX + bldW - shaftW - 15;
        const usableW = bldW - shaftW - 20;

        // Accent color per building — matches the exterior brand palette
        const accents = {
            vcrow_apex: 0xe07a5f, vcrow_horizon: 0xb23b34, vcrow_thrive: 0x6366f1,
            vcrow_foundersfund: 0x38bdf8, vcrow_launchpad: 0xff6a00, vcrow_mgx: 0xc9a227,
            vcrow_titan: 0x9aa0a6, vcrow_exchange: 0xef4444
        };
        const accent = (bld.color ? parseInt(bld.color.slice(1), 16) : null) || accents[bld.id] || 0x4ade80;

        // ─── ROOF SIGN ───
        const rc = new PIXI.Container();
        const bW = 220, bH = 30, bX = startX + bldW / 2 - bW / 2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0a14); sg.lineStyle(2, accent, 0.5); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX + 15, bY + bH, 4, 8); sg.drawRect(bX + bW - 19, bY + bH, 4, 8); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text((bld.emoji || '💰') + ' ' + bld.name.toUpperCase(), {
            fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 'bold', fill: accent,
            letterSpacing: 2, dropShadow: true, dropShadowColor: accent, dropShadowBlur: 8, dropShadowDistance: 0
        });
        lt.anchor.set(0.5, 0.5); lt.x = bX + bW / 2; lt.y = bY + bH / 2; rc.addChild(lt);
        // Accent strip under roof
        const rl = new PIXI.Graphics();
        rl.beginFill(accent, 0.2); rl.drawRect(startX, roofH - 4, bldW, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);

        // ─── FLOORS (top-down: index 0 = top floor) ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const isBasement = f === -1;
            const theme = isBasement ? 'basement' : themes[f];

            // Walls
            const rg = new PIXI.Graphics();
            rg.beginFill(0x0a0a14); rg.drawRect(startX - 6, fy, 6, floorH); rg.endFill();
            rg.beginFill(0x0a0a14); rg.drawRect(startX + bldW, fy, 6, floorH); rg.endFill();
            const wallCol = isBasement ? 0x0a0a10 : 0x10101a;

            if (!isBasement) {
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, 20); rg.endFill();
                rg.beginFill(wallCol); rg.drawRect(startX, fy + 54, bldW, floorH - 54); rg.endFill();
                // Wall segments between windows
                let wx = startX + 40;
                rg.beginFill(wallCol); rg.drawRect(startX, fy + 20, 40, 34); rg.endFill();
                while (wx + 40 <= startX + bldW - 40) {
                    wx += 40;
                    if (wx + 20 <= startX + bldW - 40) { rg.beginFill(wallCol); rg.drawRect(wx, fy + 20, 20, 34); rg.endFill(); }
                    wx += 20;
                }
                rg.beginFill(wallCol); rg.drawRect(wx - 20, fy + 20, startX + bldW - wx + 20, 34); rg.endFill();
                // Window frames
                const wf = new PIXI.Graphics();
                let wx2 = startX + 40;
                while (wx2 + 40 <= startX + bldW - 40) {
                    wf.lineStyle(2, 0x1a2030); wf.drawRect(wx2, fy + 20, 40, 34);
                    wf.moveTo(wx2 + 20, fy + 20); wf.lineTo(wx2 + 20, fy + 54);
                    wf.moveTo(wx2, fy + 37); wf.lineTo(wx2 + 40, fy + 37);
                    wf.lineStyle(0); wx2 += 60;
                }
                this.scene.addChild(wf);
            } else {
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            }
            // Floor + ceiling lines
            rg.beginFill(0x0f0f18); rg.drawRect(startX, fy + floorH - 6, bldW, 6); rg.endFill();
            rg.beginFill(0x080810); rg.drawRect(startX, fy, bldW, 3); rg.endFill();
            rg.beginFill(0x1a1a2a); rg.drawRect(startX - 6, fy + floorH - 3, bldW + 12, 3); rg.endFill();
            this.scene.addChild(rg);

            // Accent strip on wall
            if (!isBasement) {
                const ns = new PIXI.Graphics();
                ns.beginFill(accent, 0.08); ns.drawRect(startX, fy + 2, bldW, 2); ns.endFill();
                ns.beginFill(accent, 0.05); ns.drawRect(startX, fy + floorH * 0.5, bldW, 1); ns.endFill();
                this.scene.addChild(ns);
                this.indoorLights.push({ g: ns, maxA: 0.1, type: 'accent' });
            }

            // Floor container for props + NPCs
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;

            // Route to themed draw functions
            if (isBasement)                    this._drawBasement(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'reception')    this._drawReception(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'deal_room')    this._drawDealRoom(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'partner_offices') this._drawPartnerOffices(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'fund_ops')     this._drawFundOps(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'rooftop_lounge') this._drawRooftopLounge(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'analytics')    this._drawAnalytics(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'client_offices') this._drawPartnerOffices(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'trading_room' || theme === 'trading_floor') this._drawTradingFloor(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'coworking')    this._drawCoworking(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'pitch_stage')  this._drawPitchStage(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'vault')        this._drawVault(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'legal')        this._drawLegal(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'boardroom')    this._drawBoardroom(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'executive')    this._drawExecutive(fc, startX, bldW, pY, fy, floorH, accent);
            else if (theme === 'broker_floor') this._drawTradingFloor(fc, startX, bldW, pY, fy, floorH, accent);

            // Spawn themed NPCs (time-aware: only security at night)
            if (!isBasement && this.NPCS[theme]) {
                const dp = G.getDayPhase();
                const isNight = dp > 0.83 || dp < 0.25;
                const npcs = isNight
                    ? this.NPCS[theme].filter(n => n.name === 'Security' || n.name === 'Guard')
                    : this.NPCS[theme];
                npcs.forEach((npc, ni) => {
                    const nx = startX + 60 + ni * (usableW - 80) / Math.max(1, npcs.length - 1);
                    this._npc(fc, nx, pY, npc.name, npc.color, startX + 15, shaftX - 15);
                });
            }
        }

        // ─── ELEVATOR SHAFT (right side, full height) ───
        const shaftGfx = new PIXI.Graphics(); shaftGfx.eventMode = 'none';
        // Shaft background
        shaftGfx.beginFill(0x0a0a12); shaftGfx.drawRect(shaftX, roofH, shaftW, (numFloors + 1) * floorH); shaftGfx.endFill();
        // Shaft walls
        shaftGfx.beginFill(0x1a1a2a); shaftGfx.drawRect(shaftX - 2, roofH, 2, (numFloors + 1) * floorH); shaftGfx.endFill();
        shaftGfx.beginFill(0x1a1a2a); shaftGfx.drawRect(shaftX + shaftW, roofH, 2, (numFloors + 1) * floorH); shaftGfx.endFill();
        // Rails
        shaftGfx.beginFill(0x333344, 0.4); shaftGfx.drawRect(shaftX + 4, roofH, 2, (numFloors + 1) * floorH); shaftGfx.endFill();
        shaftGfx.beginFill(0x333344, 0.4); shaftGfx.drawRect(shaftX + shaftW - 6, roofH, 2, (numFloors + 1) * floorH); shaftGfx.endFill();
        // Floor doors + indicators at each level
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const doorY = fy + floorH - 44;
            // Door frame
            shaftGfx.beginFill(0x222230); shaftGfx.drawRect(shaftX + 8, doorY, shaftW - 16, 40); shaftGfx.endFill();
            // Double doors
            shaftGfx.beginFill(0x333348); shaftGfx.drawRect(shaftX + 10, doorY + 2, (shaftW - 20) / 2 - 1, 36); shaftGfx.endFill();
            shaftGfx.beginFill(0x333348); shaftGfx.drawRect(shaftX + 10 + (shaftW - 20) / 2 + 1, doorY + 2, (shaftW - 20) / 2 - 1, 36); shaftGfx.endFill();
            // Floor indicator
            shaftGfx.beginFill(accent, 0.5); shaftGfx.drawCircle(shaftX + shaftW / 2, doorY - 4, 3); shaftGfx.endFill();
        }
        // Elevator car (parked at ground floor)
        const carFy = roofH + (numFloors - 1) * floorH; // ground floor position
        shaftGfx.beginFill(0x444460); shaftGfx.drawRect(shaftX + 6, carFy + 10, shaftW - 12, floorH - 14); shaftGfx.endFill();
        shaftGfx.beginFill(0x555578); shaftGfx.drawRect(shaftX + 8, carFy + 12, shaftW - 16, 3); shaftGfx.endFill();
        // Elevator car interior light
        shaftGfx.beginFill(0xffffee, 0.08); shaftGfx.drawRect(shaftX + 8, carFy + 16, shaftW - 16, floorH - 30); shaftGfx.endFill();
        this.scene.addChild(shaftGfx);

        // ─── EARTH AROUND BASEMENT (east_rock zone — vc row sits past metro terminus) ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a1a10); earth.drawRect(0, groundY, startX - 6, floorH); earth.endFill();
        earth.beginFill(0x3a2218); earth.drawRect(0, groundY, startX - 6, 6); earth.endFill();
        earth.beginFill(0x2a1a10); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, floorH); earth.endFill();
        earth.beginFill(0x3a2218); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, 6); earth.endFill();
        this.scene.addChild(earth);

        // ─── BELOW-BASEMENT STACK (east_rock profile — pipes continue, no cables/tunnel) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 6;
        const undergroundH = (typeof Underground !== 'undefined') ? Math.max(Underground.depthOf('east_rock') + 60, 300) : 300;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, basementBottom - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, undergroundY + undergroundH, G.vpW, 3000); vm.endFill();
        this.scene.addChild(vm);
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'east_rock', (bld.x | 0));
            this.scene.addChild(ug);
        }

        // Position scene so ground floor is visible
        const bp = 56; this.scene.y = G.vpH - bp - this.totalH + floorH;
        this.minY = Math.min(this.scene.y - floorH * 3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = this.scene.y + floorH * 3;

        // Drag scroll
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        this.layer.hitArea = new PIXI.Rectangle(0, 0, G.vpW, G.vpH);
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging = true; this._startY = e.clientY; this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing'; });
        this._onMove = (e) => { if (!InteriorVCRow.isDragging || !InteriorVCRow.scene || InteriorVCRow.scene.destroyed) return; let ny = InteriorVCRow._startSceneY + (e.clientY - InteriorVCRow._startY); ny = Math.max(InteriorVCRow.minY, Math.min(ny, InteriorVCRow.maxY)); InteriorVCRow.scene.y = ny; };
        this._onUp = () => { InteriorVCRow.isDragging = false; if (InteriorVCRow.layer) InteriorVCRow.layer.cursor = 'grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══════════════════════════════════════════════════════════════
    // FLOOR THEME RENDERERS
    // ═══════════════════════════════════════════════════════════════

    _drawBasement(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'EXECUTIVE PARKING', 0x666688);
        // Parking lines
        const pg = new PIXI.Graphics(); pg.eventMode = 'none';
        pg.lineStyle(1, 0xffffff, 0.25);
        for (let px = sx + 40; px < sx + bw - 80; px += 80) {
            pg.moveTo(px, pY); pg.lineTo(px - 10, pY - 12);
        }
        pg.lineStyle(0);
        c.addChild(pg);
        // Luxury cars (CEO car style: body + cabin + wheels + headlight + brake light)
        const carColors = [0x22d3ee, 0xef4444, 0xfbbf24, 0x4ade80, 0xa855f7];
        for (let ci = 0; ci < Math.min(5, Math.floor((bw - 120) / 90)); ci++) {
            const cx = sx + 70 + ci * 90;
            const col = carColors[ci % carColors.length];
            const cg = new PIXI.Graphics(); cg.eventMode = 'none';
            // Body
            cg.beginFill(col); cg.drawRoundedRect(cx - 22, pY - 18, 44, 18, 4); cg.endFill();
            // Cabin/roof
            cg.beginFill(col, 0.8); cg.drawRoundedRect(cx - 12, pY - 28, 24, 12, 4); cg.endFill();
            // Windows
            cg.beginFill(0xffffff, 0.15); cg.drawRect(cx - 10, pY - 26, 9, 8); cg.drawRect(cx + 1, pY - 26, 9, 8); cg.endFill();
            // Wheels
            cg.beginFill(0x333333); cg.drawCircle(cx - 12, pY - 1, 4); cg.drawCircle(cx + 12, pY - 1, 4); cg.endFill();
            cg.beginFill(0x555555); cg.drawCircle(cx - 12, pY - 1, 2); cg.drawCircle(cx + 12, pY - 1, 2); cg.endFill();
            // Headlight
            cg.beginFill(0xffffff, 1.0); cg.drawRect(cx + 20, pY - 8, 4, 6); cg.endFill();
            // Brake light
            cg.beginFill(0xff3333, 1.0); cg.drawRect(cx - 26, pY - 10, 4, 4); cg.endFill();
            // Headlight beam glow
            cg.beginFill(0xffffee, 0.06); cg.drawPolygon([cx + 24, pY - 8, cx + 60, pY - 4, cx + 60, pY + 4, cx + 24, pY]); cg.endFill();
            c.addChild(cg);
        }
        // Utility panel (near elevator)
        const up = new PIXI.Graphics(); up.eventMode = 'none';
        up.beginFill(0x222230); up.drawRect(sx + bw - 80, pY - 40, 40, 40); up.endFill();
        up.beginFill(0xef4444, 0.4); up.drawCircle(sx + bw - 60, pY - 30, 3); up.endFill();
        up.beginFill(0x4ade80, 0.4); up.drawCircle(sx + bw - 60, pY - 18, 3); up.endFill();
        c.addChild(up);
    },

    _drawReception(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'RECEPTION', accent);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Marble floor with accent inlay
        g.beginFill(0x1a1a28, 0.5); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
        g.beginFill(accent, 0.04); g.drawRect(sx, pY - 2, bw, 2); g.endFill();
        // Floor inlay pattern
        for (let ix = sx + 40; ix < sx + bw - 40; ix += 30) {
            g.beginFill(accent, 0.03); g.drawRect(ix, pY - 4, 20, 4); g.endFill();
        }
        // Reception desk — curved front, marble-topped
        const dw = bw * 0.38;
        const dx = sx + bw / 2 - dw / 2;
        g.beginFill(0x1a1a2a); g.drawRoundedRect(dx, pY - 24, dw, 24, 4); g.endFill();
        g.beginFill(0x222238); g.drawRect(dx + 3, pY - 22, dw - 6, 2); g.endFill();
        g.beginFill(accent, 0.15); g.drawRect(dx, pY - 24, dw, 3); g.endFill();
        // Logo backlit panel on desk front
        g.beginFill(0x0a0a14); g.drawRoundedRect(dx + dw / 2 - 25, pY - 18, 50, 14, 2); g.endFill();
        g.beginFill(accent, 0.25); g.drawRoundedRect(dx + dw / 2 - 22, pY - 15, 44, 8, 2); g.endFill();
        // Accent glow behind logo
        g.beginFill(accent, 0.04); g.drawRoundedRect(dx + dw / 2 - 30, pY - 20, 60, 18, 3); g.endFill();
        c.addChild(g);
        // Dual monitors on desk
        this._monitor(c, dx + 20, pY - 24, accent);
        this._monitor(c, dx + dw - 20, pY - 24, accent);
        // Phone on desk
        const ph = new PIXI.Graphics(); ph.eventMode = 'none';
        ph.beginFill(0x333344); ph.drawRect(dx + dw / 2 + 12, pY - 22, 8, 5); ph.endFill();
        ph.beginFill(0x444458); ph.drawRect(dx + dw / 2 + 13, pY - 20, 6, 2); ph.endFill();
        c.addChild(ph);
        // Waiting area — L-shaped sofas with coffee table
        for (const off of [sx + 25, sx + bw - 110]) {
            const sf = new PIXI.Graphics(); sf.eventMode = 'none';
            sf.beginFill(0x222240); sf.drawRoundedRect(off, pY - 16, 60, 12, 3); sf.endFill();
            sf.beginFill(0x2a2a50); sf.drawRoundedRect(off - 4, pY - 20, 8, 20, 2); sf.drawRoundedRect(off + 56, pY - 20, 8, 20, 2); sf.endFill();
            // Cushion details
            sf.beginFill(0x2e2e55, 0.5); sf.drawRect(off + 6, pY - 14, 20, 8); sf.drawRect(off + 30, pY - 14, 20, 8); sf.endFill();
            c.addChild(sf);
            // Coffee table in front
            const ct = new PIXI.Graphics(); ct.eventMode = 'none';
            ct.beginFill(0x1a1a2a); ct.drawRect(off + 12, pY - 8, 36, 6); ct.endFill();
            ct.beginFill(accent, 0.06); ct.drawRect(off + 14, pY - 6, 32, 2); ct.endFill();
            // Magazine on table
            ct.beginFill(0xffffff, 0.08); ct.drawRect(off + 18, pY - 7, 8, 4); ct.endFill();
            c.addChild(ct);
        }
        // Company logo on back wall
        const wl = new PIXI.Graphics(); wl.eventMode = 'none';
        wl.beginFill(accent, 0.06); wl.drawCircle(sx + bw / 2, fy + 30, 12); wl.endFill();
        wl.beginFill(accent, 0.12); wl.drawCircle(sx + bw / 2, fy + 30, 8); wl.endFill();
        wl.beginFill(accent, 0.2); wl.drawCircle(sx + bw / 2, fy + 30, 4); wl.endFill();
        c.addChild(wl);
        // Potted plants flanking entry
        this._plant(c, sx + 15, pY);
        this._plant(c, sx + bw - 25, pY);
    },

    _drawDealRoom(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'DEAL ROOM', accent);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Polished conference table — dark walnut
        const tw = bw * 0.5, tx = sx + bw / 2 - tw / 2;
        g.beginFill(0x2a1a10); g.drawRoundedRect(tx, pY - 18, tw, 14, 4); g.endFill();
        g.beginFill(0x3a2a18); g.drawRoundedRect(tx + 3, pY - 16, tw - 6, 10, 2); g.endFill();
        // Table reflection highlight
        g.beginFill(0xffffff, 0.03); g.drawRect(tx + 10, pY - 15, tw - 20, 3); g.endFill();
        // Chairs around table — leather executive chairs
        for (let cx = tx + 12; cx < tx + tw - 10; cx += 22) {
            g.beginFill(0x222240); g.drawRoundedRect(cx, pY - 26, 12, 10, 3); g.endFill();
            g.beginFill(0x333358); g.drawRoundedRect(cx + 1, pY - 24, 10, 4, 2); g.endFill();
            g.beginFill(0x222240); g.drawRect(cx + 4, pY - 3, 4, 3); g.endFill();
        }
        // Term sheet documents + pens
        for (let dx = tx + 15; dx < tx + tw - 20; dx += 28) {
            g.beginFill(0xffffff, 0.12); g.drawRect(dx, pY - 15, 8, 10); g.endFill();
            g.beginFill(accent, 0.2); g.drawRect(dx + 1, pY - 13, 6, 1); g.drawRect(dx + 1, pY - 10, 4, 1); g.drawRect(dx + 1, pY - 8, 5, 1); g.endFill();
            // Pen
            g.beginFill(0x1a1a28); g.drawRect(dx + 10, pY - 12, 1, 8); g.endFill();
        }
        // Water carafe + glasses
        g.beginFill(0x93c5fd, 0.15); g.drawRect(tx + tw / 2 - 3, pY - 16, 6, 8); g.endFill();
        g.beginFill(0xffffff, 0.1); g.drawRect(tx + tw / 2 + 6, pY - 13, 3, 5); g.drawRect(tx + tw / 2 - 10, pY - 13, 3, 5); g.endFill();
        c.addChild(g);
        // Deal pipeline board on left wall — Kanban-style
        const dbx = sx + 20, dby = fy + 12;
        const dbW = bw * 0.28, dbH = 36;
        const db = new PIXI.Graphics(); db.eventMode = 'none';
        db.beginFill(0x0a0a14); db.drawRect(dbx, dby, dbW, dbH); db.endFill();
        // Column headers: Pipeline | Due Diligence | Term Sheet | Closed
        const cols = ['Pipeline', 'DD', 'Terms', 'Closed'];
        const colW = (dbW - 8) / cols.length;
        for (let ci = 0; ci < cols.length; ci++) {
            const cx = dbx + 4 + ci * colW;
            db.beginFill(accent, 0.08); db.drawRect(cx, dby + 2, colW - 2, 6); db.endFill();
            // Deal cards
            const numCards = 1 + Math.floor(Math.random() * 3);
            for (let card = 0; card < numCards; card++) {
                const isGreen = ci === 3 || Math.random() > 0.3;
                db.beginFill(isGreen ? 0x4ade80 : 0xfbbf24, 0.3);
                db.drawRoundedRect(cx + 1, dby + 10 + card * 7, colW - 4, 5, 1);
                db.endFill();
            }
            // Column separator
            if (ci > 0) { db.beginFill(0x333344, 0.3); db.drawRect(cx - 1, dby + 2, 1, dbH - 4); db.endFill(); }
        }
        c.addChild(db);
        // Large presentation screen on right wall
        this._wallScreen(c, sx + bw - 110, fy + 12, 75, 34, accent);
        // Video conferencing camera above screen
        const cam = new PIXI.Graphics(); cam.eventMode = 'none';
        cam.beginFill(0x333344); cam.drawRect(sx + bw - 80, fy + 10, 12, 4); cam.endFill();
        cam.beginFill(0x4ade80, 0.5); cam.drawCircle(sx + bw - 74, fy + 10, 1.5); cam.endFill();
        c.addChild(cam);
    },

    _drawPartnerOffices(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'OFFICES', accent);
        // Glass office partitions
        const numOffices = 3;
        const offW = (bw - 40) / numOffices;
        for (let i = 0; i < numOffices; i++) {
            const ox = sx + 20 + i * offW;
            const og = new PIXI.Graphics(); og.eventMode = 'none';
            // Glass walls
            og.beginFill(0x1a2030, 0.4); og.drawRect(ox, fy + 14, 2, fh - 20); og.endFill();
            og.beginFill(accent, 0.06); og.drawRect(ox + 2, fy + 14, offW - 4, fh - 20); og.endFill();
            // Desk
            og.beginFill(0x1a1a2a); og.drawRect(ox + 10, pY - 16, offW * 0.5, 12); og.endFill();
            og.beginFill(0x222240); og.drawRect(ox + 12, pY - 14, offW * 0.5 - 4, 8); og.endFill();
            c.addChild(og);
            // Monitor
            this._monitor(c, ox + 10 + offW * 0.25, pY - 16, accent);
            // Chair
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            ch.beginFill(0x333350); ch.drawRoundedRect(ox + 10 + offW * 0.25 - 5, pY - 22, 10, 8, 2); ch.endFill();
            c.addChild(ch);
            // Bookshelf
            this._bookshelf(c, ox + offW - 30, pY, 20, 35);
        }
    },

    _drawFundOps(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'FUND OPERATIONS', accent);
        // Work desks in rows
        for (let dx = sx + 40; dx < sx + bw - 80; dx += 70) {
            const dg = new PIXI.Graphics(); dg.eventMode = 'none';
            dg.beginFill(0x1a1a2a); dg.drawRect(dx, pY - 16, 50, 12); dg.endFill();
            dg.beginFill(0x222240); dg.drawRect(dx + 2, pY - 14, 46, 8); dg.endFill();
            c.addChild(dg);
            this._monitor(c, dx + 25, pY - 16, accent);
        }
        // Filing cabinets
        for (let fx = sx + bw - 70; fx < sx + bw - 20; fx += 20) {
            const fg = new PIXI.Graphics(); fg.eventMode = 'none';
            fg.beginFill(0x222230); fg.drawRect(fx, pY - 35, 16, 35); fg.endFill();
            for (let dy = pY - 32; dy < pY - 5; dy += 8) {
                fg.beginFill(0x333344); fg.drawRect(fx + 2, dy, 12, 6); fg.endFill();
                fg.beginFill(0x94a3b8, 0.3); fg.drawCircle(fx + 8, dy + 3, 1); fg.endFill();
            }
            c.addChild(fg);
        }
        // Printer
        const pr = new PIXI.Graphics(); pr.eventMode = 'none';
        pr.beginFill(0x333344); pr.drawRect(sx + 20, pY - 15, 25, 15); pr.endFill();
        pr.beginFill(0x4ade80, 0.4); pr.drawCircle(sx + 40, pY - 10, 2); pr.endFill();
        c.addChild(pr);
    },

    _drawRooftopLounge(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'ROOFTOP LOUNGE', accent);
        // Bar counter
        const barW = bw * 0.3;
        const barX = sx + bw - barW - 30;
        const bg = new PIXI.Graphics(); bg.eventMode = 'none';
        bg.beginFill(0x1a1a2a); bg.drawRect(barX, pY - 20, barW, 20); bg.endFill();
        bg.beginFill(accent, 0.1); bg.drawRect(barX, pY - 22, barW, 3); bg.endFill();
        c.addChild(bg);
        // Bottles
        for (let bx = barX + 8; bx < barX + barW - 10; bx += 12) {
            const bh = 8 + Math.random() * 6;
            const bc = [accent, 0xfbbf24, 0xa855f7][Math.floor(bx / 12) % 3];
            const bt = new PIXI.Graphics(); bt.eventMode = 'none';
            bt.beginFill(bc, 0.5); bt.drawRect(bx, pY - 22 - bh, 5, bh); bt.endFill();
            c.addChild(bt);
        }
        // Lounge seating groups
        for (let gx = sx + 30; gx < barX - 40; gx += 90) {
            // Low table
            const tg = new PIXI.Graphics(); tg.eventMode = 'none';
            tg.beginFill(0x1a1a2a); tg.drawRect(gx + 15, pY - 10, 40, 10); tg.endFill();
            tg.beginFill(accent, 0.06); tg.drawRect(gx + 17, pY - 8, 36, 6); tg.endFill();
            c.addChild(tg);
            // Couches around table
            const sf = new PIXI.Graphics(); sf.eventMode = 'none';
            sf.beginFill(0x222240); sf.drawRoundedRect(gx, pY - 14, 60, 10, 3); sf.endFill();
            sf.beginFill(0x2a2a50); sf.drawRoundedRect(gx - 4, pY - 18, 8, 18, 2); sf.drawRoundedRect(gx + 56, pY - 18, 8, 18, 2); sf.endFill();
            c.addChild(sf);
        }
        this._plant(c, sx + 20, pY);
    },

    _drawAnalytics(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'ANALYTICS LAB', accent);
        // Multi-monitor desks
        for (let dx = sx + 30; dx < sx + bw - 80; dx += 80) {
            const dg = new PIXI.Graphics(); dg.eventMode = 'none';
            dg.beginFill(0x1a1a2a); dg.drawRect(dx, pY - 16, 60, 12); dg.endFill();
            c.addChild(dg);
            // Triple monitors
            for (let mx = dx + 5; mx < dx + 55; mx += 18) {
                this._monitor(c, mx + 7, pY - 16, accent);
            }
        }
        // Big data wall screen
        this._wallScreen(c, sx + bw / 2 - 60, fy + 12, 120, 35, accent);
        // Data viz dots on screen
        const dvg = new PIXI.Graphics(); dvg.eventMode = 'none';
        for (let i = 0; i < 20; i++) {
            dvg.beginFill(Math.random() > 0.5 ? 0x4ade80 : 0xef4444, 0.5);
            dvg.drawCircle(sx + bw / 2 - 50 + Math.random() * 100, fy + 18 + Math.random() * 22, 1.5);
            dvg.endFill();
        }
        c.addChild(dvg);
    },

    _drawTradingFloor(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'TRADING FLOOR', 0xef4444);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Trading desk pods — curved arrangements
        for (let row = 0; row < 2; row++) {
            const ry = pY - 6 - row * 24;
            for (let dx = sx + 25; dx < sx + bw - 80; dx += 60) {
                // Desk
                g.beginFill(0x1a1a2a); g.drawRoundedRect(dx, ry - 10, 45, 10, 2); g.endFill();
                g.beginFill(0x222238); g.drawRect(dx + 2, ry - 8, 41, 2); g.endFill();
                // Phone/intercom
                g.beginFill(0x333344); g.drawRect(dx + 38, ry - 8, 5, 4); g.endFill();
            }
        }
        c.addChild(g);
        // Monitors on desks (separate for glow animation)
        for (let row = 0; row < 2; row++) {
            const ry = pY - 6 - row * 24;
            for (let dx = sx + 25; dx < sx + bw - 80; dx += 60) {
                this._monitor(c, dx + 10, ry - 10, 0x4ade80);
                this._monitor(c, dx + 26, ry - 10, 0xef4444);
            }
        }
        // Overhead multi-panel ticker board
        const tkW = bw * 0.75;
        const tkX = sx + bw / 2 - tkW / 2;
        const tkG = new PIXI.Graphics(); tkG.eventMode = 'none';
        tkG.beginFill(0x0a0a14); tkG.drawRect(tkX, fy + 10, tkW, 16); tkG.endFill();
        tkG.beginFill(0x111120); tkG.drawRect(tkX + 1, fy + 11, tkW - 2, 14); tkG.endFill();
        // Ticker symbols with mini charts
        const syms = ['GPT +4.2%', 'CLDE -1.1%', 'XAI +7.8%', 'MSTRL +2.3%', 'INFL -3.4%', 'NVDA +1.9%'];
        const symW = (tkW - 8) / syms.length;
        for (let i = 0; i < syms.length; i++) {
            const isUp = syms[i].includes('+');
            const col = isUp ? 0x4ade80 : 0xef4444;
            const sx2 = tkX + 4 + i * symW;
            tkG.beginFill(col, 0.5); tkG.drawRect(sx2, fy + 12, symW - 4, 4); tkG.endFill();
            // Mini sparkline
            tkG.beginFill(col, 0.3);
            for (let px = 0; px < 6; px++) {
                const h = 2 + Math.random() * 5;
                tkG.drawRect(sx2 + px * ((symW - 6) / 6), fy + 22 - h, (symW - 6) / 6 - 1, h);
            }
            tkG.endFill();
        }
        c.addChild(tkG);
        this.indoorLights.push({ g: tkG, maxA: 0.7, type: 'ticker' });
        // Clock on wall
        const clk = new PIXI.Graphics(); clk.eventMode = 'none';
        clk.beginFill(0x222230); clk.drawCircle(sx + bw - 40, fy + 20, 8); clk.endFill();
        clk.beginFill(0x0a0a14); clk.drawCircle(sx + bw - 40, fy + 20, 6); clk.endFill();
        clk.beginFill(0xef4444, 0.6); clk.drawRect(sx + bw - 40, fy + 15, 1, 5); clk.endFill();
        clk.beginFill(0xffffff, 0.4); clk.drawRect(sx + bw - 43, fy + 20, 4, 1); clk.endFill();
        c.addChild(clk);
    },

    _drawCoworking(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'CO-WORKING SPACE', accent);
        // Long shared tables
        for (let tx = sx + 30; tx < sx + bw - 80; tx += 100) {
            const tg = new PIXI.Graphics(); tg.eventMode = 'none';
            tg.beginFill(0x1a1a2a); tg.drawRect(tx, pY - 16, 80, 12); tg.endFill();
            tg.beginFill(0x222240); tg.drawRect(tx + 2, pY - 14, 76, 8); tg.endFill();
            c.addChild(tg);
            // Laptops on table
            for (let lx = tx + 10; lx < tx + 70; lx += 20) {
                const lg = new PIXI.Graphics(); lg.eventMode = 'none';
                lg.beginFill(0x333344); lg.drawRect(lx, pY - 20, 10, 6); lg.endFill();
                lg.beginFill(accent, 0.2); lg.drawRect(lx + 1, pY - 19, 8, 4); lg.endFill();
                c.addChild(lg);
            }
        }
        // Whiteboard
        const wbx = sx + bw - 60;
        const wb = new PIXI.Graphics(); wb.eventMode = 'none';
        wb.beginFill(0xffffff, 0.08); wb.drawRect(wbx, fy + 16, 40, 28); wb.endFill();
        wb.lineStyle(1, accent, 0.3);
        wb.moveTo(wbx + 5, fy + 24); wb.lineTo(wbx + 35, fy + 28);
        wb.moveTo(wbx + 5, fy + 30); wb.lineTo(wbx + 25, fy + 34);
        wb.lineStyle(0);
        c.addChild(wb);
        // Coffee station
        this._coffeeMachine(c, sx + 20, pY);
    },

    _drawPitchStage(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'PITCH STAGE', 0xfbbf24);
        // Stage platform
        const stgW = bw * 0.4, stgX = sx + bw / 2 - stgW / 2;
        const sg = new PIXI.Graphics(); sg.eventMode = 'none';
        sg.beginFill(0x222230); sg.drawRect(stgX, pY - 8, stgW, 8); sg.endFill();
        sg.beginFill(0x2a2a40); sg.drawRect(stgX, pY - 10, stgW, 3); sg.endFill();
        // Stage lights
        for (let lx = stgX + 10; lx < stgX + stgW; lx += 20) {
            sg.beginFill([0xfbbf24, 0x4ade80, 0x22d3ee][Math.floor(lx / 20) % 3], 0.4);
            sg.drawCircle(lx, pY - 6, 2); sg.endFill();
        }
        c.addChild(sg);
        // Podium
        const pod = new PIXI.Graphics(); pod.eventMode = 'none';
        pod.beginFill(0x1a1a2a); pod.drawRect(sx + bw / 2 - 10, pY - 30, 20, 22); pod.endFill();
        pod.beginFill(accent, 0.15); pod.drawRect(sx + bw / 2 - 6, pY - 26, 12, 14); pod.endFill();
        c.addChild(pod);
        // Big screen behind stage
        this._wallScreen(c, stgX + 10, fy + 12, stgW - 20, 30, accent);
        // Audience seating
        for (let rx = sx + 20; rx < stgX - 20; rx += 30) {
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            ch.beginFill(0x222240); ch.drawRoundedRect(rx, pY - 10, 20, 8, 2); ch.endFill();
            c.addChild(ch);
        }
        for (let rx = stgX + stgW + 20; rx < sx + bw - 20; rx += 30) {
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            ch.beginFill(0x222240); ch.drawRoundedRect(rx, pY - 10, 20, 8, 2); ch.endFill();
            c.addChild(ch);
        }
    },

    _drawVault(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'VAULT', 0xfbbf24);
        // Giant vault door
        const vdx = sx + bw / 2 - 30;
        const vd = new PIXI.Graphics(); vd.eventMode = 'none';
        vd.beginFill(0x555570); vd.drawRoundedRect(vdx, pY - 45, 60, 45, 6); vd.endFill();
        vd.beginFill(0x666688); vd.drawCircle(vdx + 30, pY - 22, 15); vd.endFill();
        vd.beginFill(0x777799); vd.drawCircle(vdx + 30, pY - 22, 10); vd.endFill();
        // Spokes
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            vd.lineStyle(2, 0x555570); vd.moveTo(vdx + 30, pY - 22);
            vd.lineTo(vdx + 30 + Math.cos(a) * 10, pY - 22 + Math.sin(a) * 10);
        }
        vd.lineStyle(0);
        vd.beginFill(0x333344); vd.drawCircle(vdx + 30, pY - 22, 3); vd.endFill();
        c.addChild(vd);
        // Gold bar stacks on sides
        for (const offX of [sx + 30, sx + bw - 70]) {
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3 - row; col++) {
                    const gx = offX + col * 12 + row * 6;
                    const gy = pY - 6 - row * 8;
                    const gb = new PIXI.Graphics(); gb.eventMode = 'none';
                    gb.beginFill(0xfbbf24, 0.8); gb.drawRect(gx, gy, 10, 6); gb.endFill();
                    gb.beginFill(0xfcd34d, 0.6); gb.drawRect(gx + 1, gy + 1, 8, 2); gb.endFill();
                    c.addChild(gb);
                }
            }
        }
        // Safety deposit boxes on wall
        for (let bx = sx + 100; bx < sx + bw - 100; bx += 14) {
            for (let by = fy + 14; by < fy + 46; by += 10) {
                const sb = new PIXI.Graphics(); sb.eventMode = 'none';
                sb.beginFill(0x333344); sb.drawRect(bx, by, 12, 8); sb.endFill();
                sb.beginFill(0xfbbf24, 0.2); sb.drawCircle(bx + 6, by + 4, 1); sb.endFill();
                c.addChild(sb);
            }
        }
    },

    _drawLegal(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'LEGAL DEPT', 0x94a3b8);
        // Desks with document stacks
        for (let dx = sx + 40; dx < sx + bw - 80; dx += 80) {
            const dg = new PIXI.Graphics(); dg.eventMode = 'none';
            dg.beginFill(0x1a1a2a); dg.drawRect(dx, pY - 16, 55, 12); dg.endFill();
            c.addChild(dg);
            this._monitor(c, dx + 30, pY - 16, 0x94a3b8);
            // Document stack
            for (let s = 0; s < 3; s++) {
                const doc = new PIXI.Graphics(); doc.eventMode = 'none';
                doc.beginFill(0xffffff, 0.12 + s * 0.03); doc.drawRect(dx + 5, pY - 18 - s * 3, 12, 3); doc.endFill();
                c.addChild(doc);
            }
        }
        // Law books on wall shelf
        this._bookshelf(c, sx + bw - 50, pY, 40, 40);
        this._bookshelf(c, sx + 20, pY, 30, 35);
    },

    _drawBoardroom(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'BOARDROOM', 0xfbbf24);
        // Long oval table
        const tw = bw * 0.55, tx = sx + bw / 2 - tw / 2;
        const tg = new PIXI.Graphics(); tg.eventMode = 'none';
        tg.beginFill(0x2a1a10); tg.drawEllipse(tx + tw / 2, pY - 12, tw / 2, 8); tg.endFill();
        tg.beginFill(0x3a2a18); tg.drawEllipse(tx + tw / 2, pY - 12, tw / 2 - 3, 5); tg.endFill();
        c.addChild(tg);
        // High-back chairs
        for (let cx = tx + 15; cx < tx + tw - 10; cx += 22) {
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            ch.beginFill(0x222240); ch.drawRoundedRect(cx, pY - 26, 12, 14, 2); ch.endFill();
            ch.beginFill(0x333350); ch.drawRect(cx + 2, pY - 24, 8, 4); ch.endFill();
            c.addChild(ch);
        }
        // Wall screen
        this._wallScreen(c, sx + bw / 2 - 50, fy + 12, 100, 30, accent);
        // Water pitchers and notepads on table
        for (let nx = tx + 20; nx < tx + tw - 20; nx += 40) {
            const np = new PIXI.Graphics(); np.eventMode = 'none';
            np.beginFill(0xffffff, 0.12); np.drawRect(nx, pY - 14, 6, 4); np.endFill();
            np.beginFill(0x22d3ee, 0.2); np.drawRect(nx + 10, pY - 15, 4, 6); np.endFill();
            c.addChild(np);
        }
    },

    _drawExecutive(c, sx, bw, pY, fy, fh, accent) {
        this._lbl(c, sx + bw / 2, fy + 8, 'EXECUTIVE SUITE', 0xfbbf24);
        // CEO desk (large, centered)
        const dx = sx + bw / 2 - 40;
        const dg = new PIXI.Graphics(); dg.eventMode = 'none';
        dg.beginFill(0x2a1a10); dg.drawRoundedRect(dx, pY - 20, 80, 16, 4); dg.endFill();
        dg.beginFill(0x3a2a18); dg.drawRect(dx + 4, pY - 18, 72, 10); dg.endFill();
        c.addChild(dg);
        // Executive chair
        const ech = new PIXI.Graphics(); ech.eventMode = 'none';
        ech.beginFill(0x333350); ech.drawRoundedRect(dx + 30, pY - 30, 20, 14, 3); ech.endFill();
        ech.beginFill(0x444468); ech.drawRoundedRect(dx + 32, pY - 28, 16, 4, 2); ech.endFill();
        c.addChild(ech);
        // Triple monitor setup
        for (let mx = dx + 15; mx < dx + 65; mx += 20) {
            this._monitor(c, mx + 5, pY - 20, accent);
        }
        // Trophy case
        const tcx = sx + 30;
        const tc = new PIXI.Graphics(); tc.eventMode = 'none';
        tc.beginFill(0x222230); tc.drawRect(tcx, pY - 40, 40, 40); tc.endFill();
        tc.beginFill(0x1a1a28, 0.5); tc.drawRect(tcx + 3, pY - 37, 34, 34); tc.endFill();
        // Trophies inside
        tc.beginFill(0xfbbf24); tc.drawRect(tcx + 10, pY - 28, 6, 10); tc.drawRect(tcx + 7, pY - 28, 12, 3); tc.endFill();
        tc.beginFill(0xc0c0c0); tc.drawRect(tcx + 22, pY - 24, 5, 8); tc.drawRect(tcx + 20, pY - 24, 9, 3); tc.endFill();
        c.addChild(tc);
        // Bookshelf
        this._bookshelf(c, sx + bw - 50, pY, 35, 40);
        // City view painting
        const pvx = sx + bw / 2 - 30;
        const pv = new PIXI.Graphics(); pv.eventMode = 'none';
        pv.beginFill(0x1a1a28); pv.drawRect(pvx, fy + 14, 60, 25); pv.endFill();
        pv.beginFill(0x0a1020); pv.drawRect(pvx + 2, fy + 16, 56, 21); pv.endFill();
        // Mini skyline
        for (let bx = pvx + 5; bx < pvx + 55; bx += 8) {
            const bh = 6 + Math.random() * 12;
            pv.beginFill(0x222240); pv.drawRect(bx, fy + 35 - bh, 5, bh); pv.endFill();
            pv.beginFill(0xfbbf24, 0.3); pv.drawRect(bx + 1, fy + 36 - bh, 1, 1); pv.endFill();
        }
        c.addChild(pv);
        this._plant(c, sx + 80, pY);
    },

    // ═══════════════════════════════════════════════════════════════
    // SHARED HELPERS
    // ═══════════════════════════════════════════════════════════════

    _lbl(c, x, y, text, col) {
        const t = new PIXI.Text(text, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, letterSpacing: 2 });
        t.anchor.set(0.5, 0); t.x = x; t.y = y; t.zIndex = 10; c.addChild(t);
    },

    _npc(c, x, y, name, col, wallLeft, wallRight) {
        const bldName = this.bld ? this.bld.name : 'VC Row';
        const vcNpcId = 'npc_vc_' + name.toLowerCase().replace(/\s/g, '_');
        const bw = 16, h = 32;
        let cont, head, body, legL, legR;
        // ─── HUMAN PATH — VC Row is full of bankers, traders, founders. Render
        //     them in the unified human pixel-art style (researcher-cosy with a
        //     suit jacket since this is the financial district). ────────────────
        if (typeof HumanAvatar !== 'undefined' && !HumanAvatar.isBot(name, vcNpcId)) {
            const av = HumanAvatar.draw(c, {
                x, y, name: null, shirt: col, accent: col,
                suit: true, tieColor: col,
                glasses: Math.random() < 0.4,
                seed: vcNpcId, showTag: false, showDot: true
            });
            cont = av.cont; head = av.head; body = av.body; legL = av.legL; legR = av.legR;
            cont.zIndex = 5;
        } else {
            // ─── BOT PATH — Algo Bot etc keep the angular/synthetic look ──────
            cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.zIndex = 5;
            const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.25); sh.drawEllipse(0, 2, bw * 0.6, 3); sh.endFill();
            legL = new PIXI.Graphics(); legL.beginFill(0x1a1a28); legL.drawRect(-2, 0, 3, 4); legL.endFill(); legL.x = -bw * 0.15;
            legR = new PIXI.Graphics(); legR.beginFill(0x1a1a28); legR.drawRect(-1, 0, 3, 4); legR.endFill(); legR.x = bw * 0.15;
            body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw / 2, -h + 11, bw, 16, 2); body.endFill();
            body.beginFill(0x0f0f18); body.drawRect(-1, -h + 12, 2, 8); body.endFill();
            head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, 11, 3); head.endFill();
            head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, 4, 1); head.drawCircle(bw * 0.1, 4, 1); head.endFill();
            head.beginFill(0x1a1008); head.drawRoundedRect(-bw * 0.42, -1, bw * 0.84, 4, 2); head.endFill();
            head.y = -h;
            const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 5;
            cont.addChild(sh, legL, legR, body, head, dot);
            c.addChild(cont);
        }
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 10, bw * 2, h + 14);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: vcNpcId, name, isNPC: true, _trackType: 'vc_commuter', role: name, lab: 'other', desc: name + ' at ' + bldName + '. Part of the financial district workforce.' }); });
        cont.on('pointerover', (e) => { if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, name, bldName); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip(); });
        // Clamp walk bounds to building interior walls (before elevator shaft)
        const minX = Math.max(wallLeft || (x - 30), x - 50);
        const maxX = Math.min(wallRight || (x + 30), x + 50);
        const vcAv = { cont, head, body, legL, legR, _minX: minX, _maxX: maxX, _phase: Math.random() * Math.PI * 2, _walkTimer: 0, _walkDir: 0, _deskX: x };
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, { id: vcNpcId }, false);
            if (hl) { vcAv._trackGlow = hl.glow; vcAv._trackArrow = hl.arrow; }
        }
        this.avatars.push(vcAv);
    },

    _monitor(c, x, y, accent) {
        const mg = new PIXI.Graphics(); mg.eventMode = 'none';
        mg.beginFill(0x111118); mg.drawRect(x - 5, y - 10, 10, 8); mg.endFill();
        mg.beginFill(accent, 0.15); mg.drawRect(x - 4, y - 9, 8, 6); mg.endFill();
        mg.beginFill(0x333344); mg.drawRect(x - 1, y - 2, 2, 2); mg.endFill();
        c.addChild(mg);
        this.indoorLights.push({ g: mg, maxA: 0.2, type: 'screen' });
    },

    _plant(c, x, y) {
        const pg = new PIXI.Graphics(); pg.eventMode = 'none';
        pg.beginFill(0x3d2914); pg.drawRect(x - 4, y - 12, 8, 12); pg.endFill();
        pg.beginFill(0x4a3520); pg.drawRect(x - 5, y - 14, 10, 3); pg.endFill();
        pg.beginFill(0x2d6a4f); pg.drawCircle(x, y - 18, 8); pg.endFill();
        pg.beginFill(0x40916c); pg.drawCircle(x - 4, y - 20, 5); pg.drawCircle(x + 4, y - 20, 5); pg.endFill();
        c.addChild(pg);
    },

    _bookshelf(c, x, y, w, h) {
        const bg = new PIXI.Graphics(); bg.eventMode = 'none';
        bg.beginFill(0x2a1a10); bg.drawRect(x, y - h, w, h); bg.endFill();
        const bookCols = [0xef4444, 0x4ade80, 0x22d3ee, 0xfbbf24, 0xa855f7, 0x94a3b8, 0xf97316];
        for (let sy = y - h + 4; sy < y - 4; sy += 10) {
            for (let bx = x + 2; bx < x + w - 4; bx += 5) {
                const bc = bookCols[Math.floor(Math.random() * bookCols.length)];
                const bh = 6 + Math.random() * 3;
                bg.beginFill(bc, 0.5); bg.drawRect(bx, sy + 8 - bh, 3, bh); bg.endFill();
            }
            bg.beginFill(0x3a2a18); bg.drawRect(x, sy + 8, w, 2); bg.endFill();
        }
        c.addChild(bg);
    },

    _wallScreen(c, x, y, w, h, accent) {
        const sg = new PIXI.Graphics(); sg.eventMode = 'none';
        sg.beginFill(0x0a0a14); sg.drawRect(x, y, w, h); sg.endFill();
        sg.beginFill(accent, 0.06); sg.drawRect(x + 2, y + 2, w - 4, h - 4); sg.endFill();
        // Scan line effect
        for (let ly = y + 4; ly < y + h - 2; ly += 3) {
            sg.beginFill(accent, 0.03); sg.drawRect(x + 2, ly, w - 4, 1); sg.endFill();
        }
        c.addChild(sg);
        this.indoorLights.push({ g: sg, maxA: 0.1, type: 'screen' });
    },

    _coffeeMachine(c, x, y) {
        const cg = new PIXI.Graphics(); cg.eventMode = 'none';
        cg.beginFill(0x333344); cg.drawRect(x, y - 22, 18, 22); cg.endFill();
        cg.beginFill(0x444458); cg.drawRect(x + 2, y - 18, 14, 10); cg.endFill();
        cg.beginFill(0xef4444, 0.5); cg.drawCircle(x + 14, y - 16, 2); cg.endFill();
        // Cup
        cg.beginFill(0xffffff, 0.3); cg.drawRect(x + 5, y - 8, 8, 6); cg.endFill();
        cg.beginFill(0x6b4226, 0.5); cg.drawRect(x + 6, y - 7, 6, 3); cg.endFill();
        c.addChild(cg);
    },

    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        const dp = G.getDayPhase(); const night = dp > .83 || dp < .25;

        // Sky gradient
        const vp = document.getElementById('viewport');
        if (vp) {
            let sky;
            if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
            else if (dp < .30) { const t = (dp - .22) / .08; sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`; }
            else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
            else if (dp < .84) { const t = (dp - .72) / .12; sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`; }
            else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
            vp.style.background = sky;
        }

        // Celestial (sun/moon)
        if (this.celestialGfx) {
            this.celestialGfx.clear();
            if (night) { let np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42; this.celestialGfx.beginFill(0xe8e8d0); this.celestialGfx.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); this.celestialGfx.endFill(); }
            else { let dayP = (dp - 0.25) / (0.83 - 0.25); this.celestialGfx.beginFill(0xffe066); this.celestialGfx.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15); this.celestialGfx.endFill(); }
        }
        // Stars
        if (this.starsLayer) { this.starsLayer.visible = night; if (night) this.starsLayer.children.forEach(s => { s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; }); }

        // Indoor lights
        this.indoorLights.forEach(l => {
            if (!l.g || l.g.destroyed) return;
            if (l.type === 'screen') l.g.alpha = l.maxA * (0.6 + Math.sin(G.tick * 0.06) * 0.3);
            else if (l.type === 'ticker') l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.04) * 0.2);
            else l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.02) * 0.3);
        });

        // NPC state machine: idle at desk → walk short distance → return
        this.avatars.forEach((av, ci) => {
            if (!av.cont || av.cont.destroyed) return;
            if (av._trackGlow) { av._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15; if (av._trackArrow) av._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2; }
            const state = av._state || 'idle';
            av._walkTimer = (av._walkTimer || 0) - 1;

            if (state === 'idle') {
                // Subtle head bob while working
                if (av.head) av.head.y = -32 + Math.sin(G.tick * 0.04 + av._phase) * 0.5;
                if (av.body) av.body.rotation = Math.sin(G.tick * 0.03 + av._phase * 2) * 0.015;
                av.legL.y = 0; av.legR.y = 0;
                if (av._walkTimer <= 0) {
                    // Pick a nearby target within bounds
                    const range = Math.min(40, (av._maxX - av._minX) * 0.4);
                    av._targetX = av.cont.x + (Math.random() - 0.5) * range;
                    av._targetX = Math.max(av._minX, Math.min(av._maxX, av._targetX));
                    av._state = 'walking';
                    av._walkTimer = 120 + Math.random() * 180;
                }
            } else if (state === 'walking') {
                const dx = av._targetX - av.cont.x;
                if (Math.abs(dx) < 1.5) {
                    av.cont.x = av._targetX;
                    av._state = 'idle';
                    av._walkTimer = 80 + Math.random() * 200;
                    av.cont.scale.x = 1;
                } else {
                    const dir = dx > 0 ? 1 : -1;
                    av.cont.x += dir * 0.4;
                    av.cont.scale.x = dir;
                    if (av.head) av.head.y = -32 + Math.sin(G.tick * 0.2 + av._phase) * 1.2;
                    if (av.legL) av.legL.y = Math.sin(G.tick * 0.25 + ci) * 2.5;
                    if (av.legR) av.legR.y = -Math.sin(G.tick * 0.25 + ci) * 2.5;
                }
            }
        });
    }
};
