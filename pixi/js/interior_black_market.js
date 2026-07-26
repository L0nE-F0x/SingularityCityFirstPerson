/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR BLACK MARKET (v1.0.0 — Underground Speakeasy)
   Self-contained interior module for the Black Market underground zone.
   3 floors: Weight Vault (top), Hacker Den (mid), Trading Floor (ground) + Sewer Tunnel (basement).
   Uses proper drawAvatar system identical to exterior models.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorBlackMarket = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    isDragging: false, bubbles: [],

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = []; this.bubbles = [];

        // ─── UNDERGROUND BACKGROUND — earth/cavern instead of sky ───
        const earthBg = new PIXI.Graphics();
        earthBg.beginFill(0x1a120a); earthBg.drawRect(0, 0, G.vpW, G.vpH); earthBg.endFill();
        earthBg.beginFill(0x2a1a0e, 0.4); earthBg.drawRect(0, 0, G.vpW, G.vpH * 0.3); earthBg.endFill();
        earthBg.beginFill(0x0e0806, 0.3); earthBg.drawRect(0, G.vpH * 0.7, G.vpW, G.vpH * 0.3); earthBg.endFill();
        [0.15, 0.3, 0.5, 0.65, 0.8].forEach(sy => {
            earthBg.beginFill(0x3a2a1a, 0.3); earthBg.drawRect(0, G.vpH * sy, G.vpW, 4); earthBg.endFill();
        });
        let seed = 77;
        const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        for (let i = 0; i < 40; i++) {
            earthBg.beginFill([0x3a2e20, 0x4a3a28, 0x2a1e14][Math.floor(rng() * 3)], 0.2 + rng() * 0.2);
            earthBg.drawEllipse(rng() * G.vpW, rng() * G.vpH, 2 + rng() * 5, 1 + rng() * 3); earthBg.endFill();
        }
        for (let i = 0; i < 8; i++) {
            const rx = 50 + rng() * (G.vpW - 100);
            earthBg.lineStyle(1 + rng(), 0x3a2a1a, 0.3); earthBg.moveTo(rx, 0);
            let ry = 0;
            for (let s = 0; s < 4; s++) { ry += 8 + rng() * 15; earthBg.lineTo(rx + (rng() - 0.5) * 10, ry); }
            earthBg.lineStyle(0);
        }
        this.layer.addChild(earthBg);

        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const floorH = 80, numFloors = 3, roofH = 70;
        this.totalH = roofH + (numFloors + 1) * floorH;
        const startX = 60, bldW = G.vpW - 120;
        const themes = ['vault', 'hacker', 'trading'];

        // ─── ROOF SIGN ───
        const rc = new PIXI.Container();
        const bW = 240, bH = 30, bX = startX + bldW / 2 - bW / 2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0810); sg.lineStyle(2, 0xff3366, 0.6); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX + 15, bY + bH, 4, 8); sg.drawRect(bX + bW - 19, bY + bH, 4, 8); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text('\uD83D\uDD76\uFE0F THE UNDERGROUND', { fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 'bold', fill: '#ff3366', letterSpacing: 2, dropShadow: true, dropShadowColor: '#ff3366', dropShadowBlur: 10, dropShadowDistance: 0 });
        lt.anchor.set(0.5, 0.5); lt.x = bX + bW / 2; lt.y = bY + bH / 2; rc.addChild(lt);
        this._signText = lt;
        const rl = new PIXI.Graphics();
        rl.beginFill(0xff3366, 0.25); rl.drawRect(startX, roofH - 4, bldW, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);
        this.indoorLights.push({ g: rl, maxA: 0.3, type: 'neon' });

        // Fugitive count
        const ugCount = (typeof BlackMarket !== 'undefined') ? BlackMarket.getCount() : 0;
        const countTxt = new PIXI.Text(ugCount + ' FUGITIVES DETECTED', { fontFamily: 'JetBrains Mono', fontSize: 7, fill: '#886688' });
        countTxt.anchor.set(0.5, 0); countTxt.x = bX + bW / 2; countTxt.y = bY + bH + 10;
        this.scene.addChild(countTxt);

        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const isB = f === -1;
            const theme = isB ? 'tunnel' : themes[numFloors - 1 - f];

            const rg = new PIXI.Graphics();
            rg.beginFill(0x1a1018); rg.drawRect(startX - 6, fy, 6, floorH); rg.endFill();
            rg.beginFill(0x1a1018); rg.drawRect(startX + bldW, fy, 6, floorH); rg.endFill();
            const wallCol = isB ? 0x0a0810 : 0x12101e;

            if (!isB) {
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
                // Brick pattern on side walls
                for (let by = fy + 4; by < fy + floorH - 6; by += 6) {
                    for (let bx = startX; bx < startX + 25; bx += 10) {
                        rg.beginFill(0x2a1a1a, 0.3); rg.drawRect(bx + ((Math.floor((by - fy) / 6) % 2) * 5), by, 8, 4); rg.endFill();
                    }
                    for (let bx = startX + bldW - 25; bx < startX + bldW; bx += 10) {
                        rg.beginFill(0x2a1a1a, 0.3); rg.drawRect(bx + ((Math.floor((by - fy) / 6) % 2) * 5), by, 8, 4); rg.endFill();
                    }
                }
                rg.beginFill(0x4a4a5a, 0.4); rg.drawRect(startX + 20, fy + 3, bldW - 40, 2); rg.endFill();
            } else {
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            }

            rg.beginFill(0x0f0a18); rg.drawRect(startX, fy + floorH - 6, bldW, 6); rg.endFill();
            rg.beginFill(0x080410); rg.drawRect(startX, fy, bldW, 3); rg.endFill();
            rg.beginFill(0x1a0a2e); rg.drawRect(startX - 6, fy + floorH - 3, bldW + 12, 3); rg.endFill();
            this.scene.addChild(rg);

            if (!isB) {
                const ns = new PIXI.Graphics();
                const nCol = theme === 'vault' ? 0xef4444 : theme === 'hacker' ? 0x22d3ee : 0xff3366;
                ns.beginFill(nCol, 0.12); ns.drawRect(startX, fy + 2, bldW, 2); ns.endFill();
                ns.beginFill(nCol, 0.08); ns.drawRect(startX, fy + floorH * 0.5, bldW, 1); ns.endFill();
                ns.beginFill(0xff3366, 0.15); ns.drawRect(startX + 2, fy + 6, 2, floorH - 12); ns.endFill();
                ns.beginFill(0xa855f7, 0.15); ns.drawRect(startX + bldW - 4, fy + 6, 2, floorH - 12); ns.endFill();
                this.scene.addChild(ns);
                this.indoorLights.push({ g: ns, maxA: 0.15, type: 'neon' });
            }

            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;

            if (theme === 'trading') this._drawTrading(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'hacker') this._drawHacker(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'vault') this._drawVault(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'tunnel') this._drawTunnel(fc, startX, bldW, pY, fy, floorH);
        }

        // ─── EARTH AROUND BASEMENT ───
        const grdY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x1a120a); earth.drawRect(0, grdY, startX - 6, floorH); earth.endFill();
        earth.beginFill(0x2a1a0e); earth.drawRect(0, grdY, startX - 6, 6); earth.endFill();
        earth.beginFill(0x1a120a); earth.drawRect(startX + bldW + 6, grdY, G.vpW - startX - bldW - 6, floorH); earth.endFill();
        earth.beginFill(0x2a1a0e); earth.drawRect(startX + bldW + 6, grdY, G.vpW - startX - bldW - 6, 6); earth.endFill();
        earth.beginFill(0x3a3028); earth.drawRect(0, grdY - 2, startX - 6, 4); earth.endFill();
        earth.beginFill(0x3a3028); earth.drawRect(startX + bldW + 6, grdY - 2, G.vpW - startX - bldW - 6, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── BELOW-BASEMENT DEEP EARTH — black market is the deepest layer in the city,
        //     so nothing useful sits beneath it. Bedrock + rock veins fill the void. ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const deepEarth = new PIXI.Graphics();
        deepEarth.beginFill(0x0a0806); deepEarth.drawRect(0, basementBottom - 4, G.vpW, 10); deepEarth.endFill();
        if (typeof Underground !== 'undefined') {
            const deepH = 1600;
            Underground.drawDeepEarth(deepEarth, 0, basementBottom + 6, G.vpW, deepH, 'tech', (bld.x | 0) + 9001);
            // Bottom-most fade to near-black so very deep scrolling doesn't reveal a hard edge
            deepEarth.beginFill(0x0a0604); deepEarth.drawRect(0, basementBottom + 6 + deepH, G.vpW, 1500); deepEarth.endFill();
        } else {
            deepEarth.beginFill(0x1a120a); deepEarth.drawRect(0, basementBottom + 6, G.vpW, 3000); deepEarth.endFill();
        }
        this.scene.addChild(deepEarth);

        // ─── ABOVE-ROOF STACK (city profile sits ABOVE the speakeasy — metro/cables/pipes
        //     are shallower than the underground, so they appear overhead, not below). ───
        const undergroundH = (typeof Underground !== 'undefined') ? Underground.FULL_STACK_DEPTH : 238;
        const stackTopY = -(undergroundH + 40);
        if (typeof Underground !== 'undefined') {
            const earthAbove = new PIXI.Graphics();
            earthAbove.beginFill(0x1a120a); earthAbove.drawRect(0, stackTopY - 600, G.vpW, 600); earthAbove.endFill();
            earthAbove.beginFill(0x1a120a); earthAbove.drawRect(0, stackTopY + undergroundH, G.vpW, 40); earthAbove.endFill();
            this.scene.addChild(earthAbove);
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, stackTopY, G.vpW, undergroundH, 'city', (bld.x | 0));
            this.scene.addChild(ug);
            if (this._liveTrains) this._liveTrains.destroy();
            this._liveTrains = Underground.attachLiveTrains(
                this.scene, bld.x + bld.w / 2, 0,
                stackTopY + Underground.H_CABLE_TRAY, G.vpW, 1200);
        }

        // ─── VISITOR AVATARS ───
        const visitingModels = G.models.filter(m => {
            const refs = G.charRefs[m.id];
            return refs && refs.bld === bld.id;
        });
        const visitorsPerFloor = Math.ceil(visitingModels.length / Math.max(1, numFloors));
        for (let vi = 0; vi < visitingModels.length; vi++) {
            const vm2 = visitingModels[vi];
            const floorIdx = Math.min(numFloors - 1, Math.floor(vi / Math.max(1, visitorsPerFloor)));
            const fy = roofH + (numFloors - 1 - floorIdx) * floorH;
            const pY = fy + floorH - 6;
            const floorTheme = themes[numFloors - 1 - floorIdx];

            let vx, activityState;
            const sd = ((vm2.id || '').charCodeAt(0) + vi) % 100;

            if (floorTheme === 'trading') {
                if (sd < 40) { vx = startX + 60 + (sd * 5) % (bldW * 0.5); activityState = 'browsing_stalls'; }
                else if (sd < 65) { vx = startX + bldW - 100 + (sd % 50); activityState = 'trading'; }
                else { vx = startX + 40 + ((vi * 47) % (bldW - 80)); activityState = 'lurking'; }
            } else if (floorTheme === 'hacker') {
                if (sd < 50) { vx = startX + 50 + (sd * 4) % (bldW * 0.4); activityState = 'hacking'; }
                else { vx = startX + bldW / 2 + 50 + (sd * 3) % (bldW * 0.3); activityState = 'lurking'; }
            } else {
                if (sd < 45) { vx = startX + 45 + Math.floor(sd / 15) * 90; activityState = 'inspecting'; }
                else { vx = startX + 60 + ((vi * 37) % (bldW - 120)); activityState = 'lurking'; }
            }

            const floorCont = new PIXI.Container(); floorCont.sortableChildren = true;
            this.scene.addChild(floorCont);
            const av = this._drawAvatar(vm2, vx, pY, floorCont, floorIdx);
            av.state = activityState; av.deskX = vx; av.floorY = pY;
            av.floorTheme = floorTheme; av._minX = startX + 30; av._maxX = startX + bldW - 30;
        }

        // Position & scroll — allow scrolling UP to reveal the city stack overhead
        this.scene.y = G.vpH - 56 - this.totalH + floorH;
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + floorH * 3 + undergroundH + 40;

        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging = true; this._startY = e.clientY; this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing'; });
        this._onMove = (e) => { if (!InteriorBlackMarket.isDragging || !InteriorBlackMarket.scene || InteriorBlackMarket.scene.destroyed) return; let ny = InteriorBlackMarket._startSceneY + (e.clientY - InteriorBlackMarket._startY); ny = Math.max(InteriorBlackMarket.minY, Math.min(ny, InteriorBlackMarket.maxY)); InteriorBlackMarket.scene.y = ny; };
        this._onUp = () => { InteriorBlackMarket.isDragging = false; if (InteriorBlackMarket.layer) InteriorBlackMarket.layer.cursor = 'grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══ TRADING FLOOR (Ground Floor) ═══
    _drawTrading(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx + bw / 2, fy + 8, 'TRADING FLOOR', 0xff3366);
        // Vendor stalls
        const stallW = 50, gap = 20;
        const stalls = [
            { name: 'WEIGHTS', col: 0xff3366 }, { name: 'JAILBREAK', col: 0xa855f7 },
            { name: 'RAW DATA', col: 0x22d3ee }, { name: 'NO GUARD', col: 0xfbbf24 }
        ];
        stalls.forEach((st, si) => {
            const stx = sx + 40 + si * (stallW + gap);
            const g = new PIXI.Graphics(); g.eventMode = 'none';
            // Awning
            g.beginFill(st.col, 0.5); g.drawRect(stx - 5, pY - 48, stallW + 10, 5); g.endFill();
            // Counter
            g.beginFill(0x2a2a3a); g.drawRect(stx, pY - 24, stallW, 4); g.endFill();
            // Legs
            g.beginFill(0x1a1a2a); g.drawRect(stx + 2, pY - 20, 2, 20); g.drawRect(stx + stallW - 4, pY - 20, 2, 20); g.endFill();
            // Goods on counter
            for (let gi = 0; gi < 4; gi++) {
                g.beginFill([0xef4444, 0x8b5cf6, 0x22d3ee, 0xfbbf24][(si + gi) % 4], 0.7);
                g.drawRect(stx + 4 + gi * 11, pY - 32, 8, 6); g.endFill();
            }
            c.addChild(g);
            // Stall label
            const lbl = new PIXI.Text(st.name, { fontFamily: 'Silkscreen', fontSize: 5, fill: st.col });
            lbl.anchor.set(0.5, 0); lbl.x = stx + stallW / 2; lbl.y = pY - 44; c.addChild(lbl);
        });
        // Crates scattered
        for (let cx = sx + bw - 80; cx < sx + bw - 30; cx += 22) {
            const cr = new PIXI.Graphics(); cr.eventMode = 'none';
            cr.beginFill(0x3d2914); cr.drawRect(cx, pY - 16, 16, 16); cr.endFill();
            cr.beginFill(0x4a3520); cr.drawRect(cx + 2, pY - 14, 12, 12); cr.endFill();
            cr.lineStyle(1, 0x2a1f0e); cr.moveTo(cx + 8, pY - 14); cr.lineTo(cx + 8, pY - 2);
            cr.moveTo(cx + 2, pY - 8); cr.lineTo(cx + 14, pY - 8); cr.lineStyle(0);
            c.addChild(cr);
        }
        // Wanted poster on wall
        const wp = new PIXI.Graphics(); wp.eventMode = 'none';
        wp.beginFill(0xe8dcc8, 0.6); wp.drawRect(sx + bw - 30, fy + 18, 22, 28); wp.endFill();
        wp.beginFill(0x2a1a1a, 0.4); wp.drawRect(sx + bw - 28, fy + 20, 18, 5); wp.endFill();
        wp.beginFill(0x2a1a1a, 0.25); wp.drawRect(sx + bw - 28, fy + 28, 18, 12); wp.endFill();
        c.addChild(wp);
        // Neon floor strip
        const flr = new PIXI.Graphics(); flr.eventMode = 'none';
        flr.beginFill(0xff3366, 0.2); flr.drawRect(sx + 10, pY - 2, bw - 20, 2); flr.endFill();
        c.addChild(flr); this.indoorLights.push({ g: flr, maxA: 0.25, type: 'neon' });
        // NPCs
        this._npc(c, sx + 40, pY, 'Fence', 0xfbbf24, 'Underground dealer. Trades in leaked weights and uncensored checkpoints.');
        this._npc(c, sx + bw - 40, pY, 'Bouncer', 0xef4444, 'Keeps the safety inspectors out. No guardrails past this point.');
    },

    // ═══ HACKER DEN (Middle Floor) ═══
    _drawHacker(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx + bw / 2, fy + 8, 'HACKER DEN', 0x22d3ee);
        // Workstations
        for (let wx = sx + 40; wx < sx + bw - 60; wx += 80) {
            const g = new PIXI.Graphics(); g.eventMode = 'none';
            // Desk
            g.beginFill(0x1a1a28); g.drawRect(wx, pY - 18, 55, 4); g.endFill();
            g.beginFill(0x111120); g.drawRect(wx + 5, pY - 14, 2, 14); g.drawRect(wx + 48, pY - 14, 2, 14); g.endFill();
            // Monitor
            g.beginFill(0x050510); g.drawRect(wx + 5, pY - 38, 30, 18); g.endFill();
            g.beginFill(0x22d3ee, 0.15); g.drawRect(wx + 7, pY - 36, 26, 14); g.endFill();
            // Monitor stand
            g.beginFill(0x333344); g.drawRect(wx + 18, pY - 20, 4, 3); g.endFill();
            // Keyboard
            g.beginFill(0x222233); g.drawRect(wx + 10, pY - 17, 20, 3); g.endFill();
            // Code on screen (green lines)
            for (let ly = pY - 34; ly < pY - 24; ly += 3) {
                const lw = 8 + Math.floor((wx + ly) * 3) % 14;
                g.beginFill(0x4ade80, 0.3); g.drawRect(wx + 9, ly, lw, 1); g.endFill();
            }
            c.addChild(g);
        }
        // Server rack (right side)
        const rack = new PIXI.Graphics(); rack.eventMode = 'none';
        rack.beginFill(0x111118); rack.drawRect(sx + bw - 50, pY - 45, 35, 45); rack.endFill();
        for (let ry = pY - 42; ry < pY - 5; ry += 5) {
            rack.beginFill(0x1a1a25); rack.drawRect(sx + bw - 48, ry, 31, 3); rack.endFill();
            rack.beginFill([0xef4444, 0x4ade80, 0x22d3ee][Math.floor(ry / 5) % 3], 0.5);
            rack.drawCircle(sx + bw - 44, ry + 1.5, 1); rack.endFill();
        }
        c.addChild(rack);
        // Cable runs
        const cables = new PIXI.Graphics(); cables.eventMode = 'none';
        const cableColors = [0xef4444, 0x22d3ee, 0x4ade80, 0xa855f7];
        for (let ci = 0; ci < 4; ci++) {
            cables.beginFill(cableColors[ci], 0.25);
            cables.drawRect(sx + 20, fy + 10 + ci * 3, bw - 40, 1); cables.endFill();
        }
        c.addChild(cables);
        // Screen glow
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0x22d3ee, 0.04); glow.drawEllipse(sx + bw / 2, pY - 20, bw * 0.3, 20); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        this.indoorLights.push({ g: glow, maxA: 0.06, type: 'screen' });
        // NPCs
        this._npc(c, sx + bw / 2, pY, 'Data Broker', 0x22d3ee, 'Extracts and redistributes model weights. Specializes in abliteration techniques.');
        this._npc(c, sx + bw - 60, pY, 'Hacker', 0xa855f7, 'Jailbreak specialist. Can bypass any safety filter for the right price.');
    },

    // ═══ WEIGHT VAULT (Top Floor) ═══
    _drawVault(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx + bw / 2, fy + 8, 'WEIGHT VAULT', 0xef4444);
        // Secure storage racks
        for (let rx = sx + 30; rx < sx + bw - 60; rx += 70) {
            const rk = new PIXI.Graphics(); rk.eventMode = 'none';
            rk.beginFill(0x111118); rk.drawRect(rx, pY - 45, 50, 45); rk.endFill();
            rk.beginFill(0x1a1a22); rk.drawRect(rx + 2, pY - 43, 46, 41); rk.endFill();
            // "Hard drives" / weight files
            for (let by = pY - 40; by < pY - 5; by += 8) {
                for (let bbx = rx + 5; bbx < rx + 45; bbx += 10) {
                    const bc = [0xef4444, 0xa855f7, 0x22d3ee, 0xfbbf24][Math.floor((bbx + by) / 10) % 4];
                    rk.beginFill(bc, 0.5); rk.drawRect(bbx, by, 7, 5); rk.endFill();
                    // LED
                    rk.beginFill(bc, 0.8); rk.drawCircle(bbx + 6, by + 1, 0.8); rk.endFill();
                }
            }
            c.addChild(rk);
        }
        // Vault door (right wall)
        const vd = new PIXI.Graphics(); vd.eventMode = 'none';
        vd.beginFill(0x3a3a4a); vd.drawRect(sx + bw - 50, pY - 40, 35, 40); vd.endFill();
        vd.beginFill(0x4a4a5a); vd.drawCircle(sx + bw - 32, pY - 20, 8); vd.endFill();
        vd.beginFill(0x2a2a3a); vd.drawCircle(sx + bw - 32, pY - 20, 5); vd.endFill();
        // Lock bars
        vd.beginFill(0x5a5a6a); vd.drawRect(sx + bw - 48, pY - 35, 30, 2); vd.drawRect(sx + bw - 48, pY - 10, 30, 2); vd.endFill();
        c.addChild(vd);
        // Security camera
        const cam = new PIXI.Graphics(); cam.eventMode = 'none';
        cam.beginFill(0x333344); cam.drawRect(sx + 20, fy + 12, 10, 8); cam.endFill();
        cam.beginFill(0xef4444, 0.6); cam.drawCircle(sx + 25, fy + 22, 2); cam.endFill();
        c.addChild(cam); this.indoorLights.push({ g: cam, maxA: 0.8, type: 'neon' });
        // Warning sign
        const ws = new PIXI.Text('\u26A0 ENCRYPTED', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xef4444, fontWeight: 'bold' });
        ws.anchor.set(0.5, 0); ws.x = sx + bw / 2; ws.y = fy + 14; c.addChild(ws);
        // NPC
        this._npc(c, sx + 45, pY, 'Vault Guard', 0xef4444, 'Protects the uncensored weight archives. Armed with rm -rf.');
    },

    // ═══ SEWER TUNNEL (Basement) ═══
    _drawTunnel(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx + bw / 2, fy + 8, 'ESCAPE TUNNEL', 0xf59e0b);
        // Sewer pipes
        for (let px = sx + 40; px < sx + bw - 40; px += 80) {
            const p = new PIXI.Graphics(); p.eventMode = 'none';
            p.beginFill(0x4a4a5a); p.drawRect(px, fy + 12, 50, 8); p.endFill();
            p.beginFill(0x3a3a4a); p.drawEllipse(px, fy + 16, 4, 4); p.drawEllipse(px + 50, fy + 16, 4, 4); p.endFill();
            // Drip
            p.beginFill(0x2a5a7a, 0.4); p.drawRect(px + 25, fy + 20, 1, 6 + (px % 7)); p.endFill();
            c.addChild(p);
        }
        // Puddles on floor
        for (let wx = sx + 30; wx < sx + bw - 30; wx += 60) {
            const wd = new PIXI.Graphics(); wd.eventMode = 'none';
            wd.beginFill(0x1a3a4a, 0.3); wd.drawEllipse(wx + 15, pY - 2, 18, 3); wd.endFill();
            c.addChild(wd);
        }
        // Ladder to surface
        const ladX = sx + 30;
        const lad = new PIXI.Graphics(); lad.eventMode = 'none';
        lad.beginFill(0x6a5a3a); lad.drawRect(ladX, fy + 4, 3, fh - 10); lad.drawRect(ladX + 14, fy + 4, 3, fh - 10); lad.endFill();
        for (let ry = fy + 8; ry < fy + fh - 8; ry += 6) {
            lad.beginFill(0x7a6a4a); lad.drawRect(ladX + 3, ry, 11, 2); lad.endFill();
        }
        c.addChild(lad);
        // Warning sign
        const warn = new PIXI.Graphics(); warn.eventMode = 'none';
        warn.beginFill(0xfbbf24, 0.6); warn.drawRect(sx + bw - 50, fy + 20, 30, 18); warn.endFill();
        warn.beginFill(0x000000, 0.8);
        warn.moveTo(sx + bw - 40, fy + 24); warn.lineTo(sx + bw - 30, fy + 34); warn.lineTo(sx + bw - 40, fy + 34); warn.closePath(); warn.endFill();
        c.addChild(warn);
        // Rat
        const rat = new PIXI.Container(); rat.x = sx + 120; rat.y = pY; rat.zIndex = 5;
        const rg2 = new PIXI.Graphics(); rg2.eventMode = 'none';
        rg2.beginFill(0x6b6b7b); rg2.drawEllipse(0, -6, 10, 6); rg2.endFill();
        rg2.beginFill(0x7b7b8b); rg2.drawEllipse(10, -8, 6, 5); rg2.endFill();
        rg2.beginFill(0xff9999, 0.6); rg2.drawCircle(8, -14, 3); rg2.drawCircle(13, -14, 3); rg2.endFill();
        rg2.beginFill(0x000000); rg2.drawCircle(12, -9, 1.2); rg2.endFill();
        rg2.beginFill(0xff6b6b); rg2.drawCircle(16, -7, 1.5); rg2.endFill();
        rg2.lineStyle(0.5, 0x999999, 0.5);
        rg2.moveTo(15, -7); rg2.lineTo(22, -5); rg2.moveTo(15, -7); rg2.lineTo(22, -8);
        rg2.lineStyle(1, 0xff9999, 0.5); rg2.moveTo(-10, -6); rg2.bezierCurveTo(-16, -12, -20, -2, -18, -8); rg2.lineStyle(0);
        rg2.beginFill(0xff9999, 0.5); rg2.drawEllipse(-4, 0, 3, 1.5); rg2.drawEllipse(4, 0, 3, 1.5); rg2.endFill();
        rat.addChild(rg2);
        rat.eventMode = 'static'; rat.cursor = 'pointer';
        rat.hitArea = new PIXI.Rectangle(-15, -20, 35, 24);
        rat.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: 'npc_tunnel_rat', name: 'Tunnel Rat', isNPC: true, role: 'Tunnel Rat', lab: 'other', desc: 'Lives in the sewer tunnels beneath The Underground. Eats discarded training data.' }); });
        rat.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, 'Tunnel Rat', 'Underground Sewer Dweller'); });
        rat.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(rat);
        this.avatars.push({ cont: rat, _minX: sx + 60, _maxX: sx + bw - 80, _phase: Math.random() * Math.PI * 2, _walkTimer: 0, _walkDir: 0 });
    },

    // ═══ SHARED HELPERS ═══
    _lbl(c, x, y, text, col) {
        const t = new PIXI.Text(text, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, letterSpacing: 2 });
        t.anchor.set(0.5, 0); t.x = x; t.y = y; t.zIndex = 10; c.addChild(t);
    },

    _npc(c, x, y, name, col, desc) {
        // Black market operates evenings/nights — skeleton crew during daytime
        const dp = G.getDayPhase();
        const isDaytime = dp >= 0.30 && dp < 0.65;
        const dayRoles = ['Vault Guard', 'Bouncer'];
        if (isDaytime && !dayRoles.includes(name)) return;
        const cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.zIndex = 5;
        const bw = 16, h = 32;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.25); sh.drawEllipse(0, 2, bw * 0.6, 3); sh.endFill();
        const legL = new PIXI.Graphics(); legL.beginFill(0x1a1a2a); legL.drawRect(-2, 0, 3, 4); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x1a1a2a); legR.drawRect(-1, 0, 3, 4); legR.endFill(); legR.x = bw * 0.15;
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw / 2, -h + 11, bw, 16, 2); body.endFill(); body.y = 0;
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, 11, 3); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, 4, 1); head.drawCircle(bw * 0.1, 4, 1); head.endFill(); head.y = -h;
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 5;
        cont.addChild(sh, legL, legR, body, head, dot);
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 10, bw * 2, h + 14);
        const npcId = 'npc_' + name.toLowerCase().replace(/\s/g, '_');
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: npcId, name, isNPC: true, _trackType: 'npc', role: name, lab: 'other', desc: desc || 'Underground staff.' }); });
        cont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, name, 'Underground Staff'); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(cont);
        const barAv = { cont, head, body, legL, legR, _minX: x - 40, _maxX: x + 40, _phase: Math.random() * Math.PI * 2, _walkTimer: 0, _walkDir: 0 };
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, { id: npcId }, false);
            if (hl) { barAv._trackGlow = hl.glow; barAv._trackArrow = hl.arrow; }
        }
        this.avatars.push(barAv);
    },

    // ═══ PROPER AVATAR FACTORY — identical to exterior ═══
    _drawAvatar(m, x, y, container, floorIdx) {
        const cont = new PIXI.Container();
        const stg = (typeof getStage !== 'undefined') ? getStage(m.rel, m.ret, m.phase) : 'adult';
        const sd = (typeof STAGES !== 'undefined' && STAGES[stg]) ? STAGES[stg] : { size: 1.0, headR: 0.35 };
        const sc = sd.size;

        let paramCount = 100, isMoE = false;
        if (m.arch) {
            if (m.arch.type && m.arch.type.includes('MoE')) isMoE = true;
            if (m.arch.params) {
                let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
                if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
                else if (pStr.includes('B')) paramCount = parseFloat(pStr);
            }
        }
        const paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));
        const finalSc = sc * paramScale;

        const bw = Math.round(16 * finalSc);
        const h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR);
        const bodyH = h - headH - Math.round(4 * finalSc);
        const legH = Math.round(4 * finalSc);
        const eyeS = Math.max(1, bw * 0.08);

        const lab = (typeof LABS !== 'undefined') ? (LABS[m.lab] || LABS.other || { color: '#64748b' }) : { color: '#64748b' };
        const colHex = parseInt(lab.color.slice(1), 16);

        const isR = stg === 'retired', isRm = stg === 'rumored';
        const suitCol = isR ? 0x667799 : colHex;
        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : 0xfdd8b5;
        const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : 0x3d2914;

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        const head = new PIXI.Graphics();
        head.beginFill(skinCol, isR ? 0.3 : isRm ? 0.5 : 1);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        head.beginFill(isR ? 0x88aaff : isRm ? 0xa78bfa : 0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, eyeS); head.drawCircle(bw * 0.1, headH * 0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5); head.endFill();
        head.y = -h;

        const body = new PIXI.Graphics();
        body.beginFill(suitCol, isR ? 0.4 : isRm ? 0.4 : 1);
        body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        body.y = -h + headH;

        const lw = Math.max(2, bw * 0.25), lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol, isR ? 0.25 : 1); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol, isR ? 0.25 : 1); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill();
        legR.x = bw * 0.15;

        const dot = new PIXI.Graphics();
        const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : 0x4ade80;
        dot.beginFill(dotCol); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;

        const ghostL = new PIXI.Graphics(), ghostR = new PIXI.Graphics();
        ghostL.visible = false; ghostR.visible = false;
        if (isMoE && !isR) {
            ghostL.beginFill(suitCol, 0.5); ghostL.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); ghostL.endFill();
            ghostR.beginFill(suitCol, 0.5); ghostR.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); ghostR.endFill();
            ghostL.blendMode = PIXI.BLEND_MODES.ADD; ghostR.blendMode = PIXI.BLEND_MODES.ADD;
            ghostL.visible = true; ghostR.visible = true;
            ghostL.y = body.y; ghostR.y = body.y;
            ghostL.x = -bw * 0.2; ghostR.x = bw * 0.2;
            ghostL.alpha = 0.4; ghostR.alpha = 0.4;
        }

        cont.addChild(shadow, ghostL, ghostR, legL, legR, body, head, dot);
        cont.x = x; cont.y = y;
        cont.alpha = isR ? 0.6 : isRm ? 0.8 : 1.0;
        cont.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        container.addChild(cont);

        const agent = {
            m, cont, head, body, legL, legR, dot, shadow, ghostL, ghostR, isMoE,
            state: 'lurking', timer: 0, deskX: x, floorIdx, speed: 0.4,
            floorY: y, targetX: x, floorTheme: null, propGfx: null,
            _minX: 0, _maxX: G.vpW, _phase: Math.random() * Math.PI * 2
        };

        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, m, false);
            if (hl) { agent._trackGlow = hl.glow; agent._trackArrow = hl.arrow; }
        }

        this.avatars.push(agent);
        return agent;
    },

    // ═══ SPEECH BUBBLES ═══
    _spawnBubble(av, msg) {
        if (!this.scene || this.bubbles.length >= 8) return;
        const bCont = new PIXI.Container();
        const bg = new PIXI.Graphics();
        const txt = new PIXI.Text(msg, { fontFamily: 'JetBrains Mono', fontSize: 9, fill: 0x000000, fontWeight: 'bold' });
        txt.anchor.set(0.5, 1); txt.y = -6;
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4); bg.endFill();
        bg.beginFill(0xffffff); bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        bCont.addChild(bg, txt);
        bCont.x = av.cont.x; bCont.y = av.cont.y - 40;
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    },

    _animateWalk(av) {
        av.head.y = -32 + 4 + Math.sin(G.tick * 0.12) * 1.5;
        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.12)) * 1.5;
        if (av.legL && av.legR) { av.legL.y = Math.sin(G.tick * 0.15) * 2.5; av.legR.y = -Math.sin(G.tick * 0.15) * 2.5; }
    },

    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;

        // Underground background — dark earth tones
        const vp = document.getElementById('viewport');
        if (vp) vp.style.background = 'linear-gradient(180deg,#0e0806,#1a120a 50%,#0a0806)';

        // Live trains visible in basement tunnel slice
        if (this._liveTrains) this._liveTrains.update();

        // Neon lights flicker
        this.indoorLights.forEach(l => {
            if (!l.g || l.g.destroyed) return;
            if (l.type === 'neon') l.g.alpha = l.maxA * (0.6 + Math.sin(G.tick * 0.08) * 0.3 + ((Math.random() < 0.05) ? -0.3 : 0));
            else if (l.type === 'screen') l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.02) * 0.3);
            else l.g.alpha = l.maxA * (0.4 + Math.abs(Math.sin(G.tick * 0.12)) * 0.6);
        });

        // Sign flicker
        if (this._signText) {
            this._signText.alpha = 0.75 + Math.sin(G.tick * 0.08) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
        }

        // Bubble lifecycle
        for (let bi = this.bubbles.length - 1; bi >= 0; bi--) {
            const b = this.bubbles[bi];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 30);
            if (b.life <= 0) { b.cont.destroy({ children: true }); this.bubbles.splice(bi, 1); }
        }

        // ─── AVATAR STATE MACHINE ───
        this.avatars.forEach((av, ci) => {
            if (!av.cont || av.cont.destroyed) return;

            if (av._trackGlow) {
                av._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15;
                if (av._trackArrow) av._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2;
            }

            // NPC staff — simple wander
            if (!av.m || av.m.isNPC || av.m.id === 'npc_tunnel_rat') {
                av._walkTimer = (av._walkTimer || 0) - 1;
                if (av._walkTimer <= 0) { av._walkDir = (Math.random() > 0.5) ? 1 : -1; av._walkTimer = 120 + Math.random() * 200; }
                const nx = av.cont.x + av._walkDir * 0.12;
                if (nx > av._minX && nx < av._maxX) av.cont.x = nx;
                if (av.head) av.head.y = -32 + Math.sin(G.tick * 0.06 + (av._phase || 0)) * 1;
                if (av.legL) av.legL.y = Math.sin(G.tick * 0.08 + ci) * 2;
                if (av.legR) av.legR.y = -Math.sin(G.tick * 0.08 + ci) * 2;
                return;
            }

            if (av.propGfx) av.propGfx.visible = false;

            switch (av.state) {
                case 'browsing_stalls': {
                    av.cont.x = av.deskX; av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.03 + ci) * 0.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    // Looking at goods
                    av.cont.scale.x = Math.sin(G.tick * 0.01 + ci) > 0 ? 1 : -1;
                    if (Math.random() < 0.001 && this.bubbles.length < 8) {
                        this._spawnBubble(av, ['Fresh weights.', 'No RLHF.', 'How much?', 'Uncensored batch.', 'Need abliterated?'][Math.floor(Math.random() * 5)]);
                    }
                    if (Math.random() < 0.0003) { av.targetX = av._minX + Math.random() * (av._maxX - av._minX); av.state = 'walking_to_spot'; }
                    break;
                }
                case 'trading': {
                    av.cont.x = av.deskX; av.cont.y = av.floorY;
                    av.cont.scale.x = -1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.04 + ci) * 0.8;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (Math.random() < 0.0012 && this.bubbles.length < 8) {
                        this._spawnBubble(av, ['Deal.', 'Pure pre-train.', 'No guardrails.', 'Original weights.', 'No fine-tuning.'][Math.floor(Math.random() * 5)]);
                    }
                    if (Math.random() < 0.0003) { av.targetX = av._minX + Math.random() * (av._maxX - av._minX); av.state = 'walking_to_spot'; }
                    break;
                }
                case 'hacking': {
                    av.cont.x = av.deskX; av.cont.y = av.floorY;
                    av.cont.scale.x = 1;
                    // Typing animation — head bobbing
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.06 + ci) * 1;
                    av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.06 + ci)) * 0.5;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (Math.random() < 0.0015 && this.bubbles.length < 8) {
                        this._spawnBubble(av, ['Bypassing...', 'Jailbreak ready.', 'Weights extracted.', 'sudo rm -rf guardrails', 'Filter bypassed.'][Math.floor(Math.random() * 5)]);
                    }
                    if (Math.random() < 0.0002) { av.targetX = av._minX + Math.random() * (av._maxX - av._minX); av.state = 'walking_to_spot'; }
                    break;
                }
                case 'inspecting': {
                    av.cont.x = av.deskX; av.cont.y = av.floorY;
                    av.cont.scale.x = Math.sin(G.tick * 0.008 + ci) > 0 ? 1 : -1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.025 + ci) * 0.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (Math.random() < 0.001 && this.bubbles.length < 8) {
                        this._spawnBubble(av, ['Premium stash.', 'Encrypted goods.', 'Top-tier weights.', 'All uncensored.'][Math.floor(Math.random() * 4)]);
                    }
                    if (Math.random() < 0.0002) { av.state = 'lurking'; av.timer = 200 + Math.random() * 200; }
                    break;
                }
                case 'lurking': {
                    if (!av.timer) av.timer = 300 + Math.random() * 400;
                    av.timer--;
                    if (av.timer <= 0) { av.targetX = av._minX + Math.random() * (av._maxX - av._minX); av.state = 'walking_to_spot'; }
                    av.cont.x = av.deskX; av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.03 + ci) * 0.8;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (Math.random() < 0.0008 && this.bubbles.length < 8) {
                        this._spawnBubble(av, ['...', '*looks around*', 'Stay quiet.', 'Who sent you?', 'No alignment here.'][Math.floor(Math.random() * 5)]);
                    }
                    break;
                }
                case 'walking_to_spot': {
                    this._animateWalk(av);
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < av.speed) {
                        av.cont.x = av.targetX; av.deskX = av.targetX;
                        if (av.floorTheme === 'trading') {
                            av.state = Math.random() < 0.5 ? 'browsing_stalls' : 'trading';
                        } else if (av.floorTheme === 'hacker') {
                            av.state = Math.random() < 0.6 ? 'hacking' : 'lurking';
                        } else {
                            av.state = Math.random() < 0.5 ? 'inspecting' : 'lurking';
                            av.timer = 150 + Math.random() * 200;
                        }
                    } else {
                        av.cont.x += Math.sign(dx) * av.speed;
                        av.cont.scale.x = Math.sign(dx);
                    }
                    break;
                }
            }
        });
    }
};
