/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LEGACY SYSTEMS MUSEUM INTERIOR (v1.0.0)
   A museum inside the Legacy Systems building — AI Academy students visit on field trips.
   Themed floors: Lobby, Hall of Architectures, Timeline Gallery, Hall of Fame, basement Archives.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorLegacy = {
    avatars: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, lifts: {},

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];

        // ─── SKY ───
        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()*1.2); s.endFill(); s.x = Math.random()*G.vpW; s.y = Math.random()*G.vpH*.5; s._phase = Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const accentCol = 0xc9a84c; // warm gold — museum aesthetic
        const numFloors = 4;
        const floorH = 80, roofH = 80;
        const totalFloors = numFloors + 1;
        this.totalH = roofH + totalFloors * floorH;

        const startX = 60, shaftW = 60, shaftX = G.vpW - shaftW - 80;
        const usableW = shaftX - startX - 20;

        // ─── ROOF SIGN BOARD ───
        const rc = new PIXI.Container();
        const bW = 260, bH = 34, bX = startX + usableW/2 - bW/2 + 10, bY = roofH - bH - 10;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, accentCol, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+15, bY+bH, 6, 10); sg.drawRect(bX+bW-21, bY+bH, 6, 10); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text('LEGACY SYSTEMS MUSEUM', { fontFamily:'JetBrains Mono', fontSize:13, fontWeight:'bold', fill:0xffffff, letterSpacing:2, dropShadow:true, dropShadowColor:accentCol, dropShadowBlur:8, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text('EST. 2023 \u2014 PRESERVING AI HISTORY', { fontFamily:'JetBrains Mono', fontSize:7, fill:0x94a3b8, letterSpacing:2 });
        bdg.anchor.set(0.5,0.5); bdg.x = bX+bW/2; bdg.y = bY-8; rc.addChild(bdg);
        const rl = new PIXI.Graphics();
        rl.beginFill(accentCol, 0.3); rl.drawRect(startX, roofH-4, usableW+shaftW+20, 4); rl.endFill();
        rl.beginFill(accentCol, 0.1); rl.drawRect(startX, roofH-8, usableW+shaftW+20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);

        // ─── FLOORS ───
        const windowX = startX + 50, windowW = usableW - 100;
        const floorConts = {};
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f)*floorH;
            const isB = f === -1;

            const rg = new PIXI.Graphics();
            // Left wall
            rg.beginFill(0x0a0e14); rg.drawRect(startX-8, fy, 8, floorH); rg.endFill();
            // Right wall
            rg.beginFill(0x0a0e14); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            // Shaft enclosure
            rg.beginFill(0x0a0e14); rg.drawRect(shaftX+6, fy, shaftW-6, floorH); rg.endFill();

            if (!isB) {
                // Museum walls — darker, richer tones
                rg.beginFill(0x0c0a10); rg.drawRect(startX, fy, usableW, 22); rg.endFill();
                rg.beginFill(0x0c0a10); rg.drawRect(startX, fy+54, usableW, floorH-54); rg.endFill();
                let wx = windowX;
                rg.beginFill(0x0c0a10);
                rg.drawRect(startX, fy+22, windowX-startX, 32);
                while(wx+40<=windowX+windowW) { wx += 40; if (wx+20<=windowX+windowW) { rg.drawRect(wx, fy+22, 20, 32); } wx += 20; }
                rg.drawRect(wx-20, fy+22, startX+usableW-wx+20, 32);
                rg.endFill();

                // Window frames
                const wfr = new PIXI.Graphics();
                let cwx = windowX;
                while(cwx+40<=windowX+windowW) {
                    wfr.lineStyle(2, 0x1a2030); wfr.drawRect(cwx, fy+22, 40, 32);
                    wfr.moveTo(cwx+20, fy+22); wfr.lineTo(cwx+20, fy+54);
                    wfr.moveTo(cwx, fy+38); wfr.lineTo(cwx+40, fy+38);
                    wfr.lineStyle(0); cwx+=60;
                }
                this.scene.addChild(wfr);
            } else {
                rg.beginFill(0x0a0a10); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }

            // Floor surface — polished dark stone
            rg.beginFill(0x08080e); rg.drawRect(startX, fy+floorH-8, usableW, 8); rg.endFill();
            // Ceiling trim
            rg.beginFill(0x111822); rg.drawRect(startX, fy, usableW, 4); rg.endFill();
            // Floor separator
            rg.beginFill(0x2a2a42); rg.drawRect(startX-8, fy+floorH-4, usableW+shaftW+28, 4); rg.endFill();
            this.scene.addChild(rg);

            // Ceiling lights — warm museum spotlights
            const lc = isB ? 0xef4444 : accentCol;
            for (let li=1; li<=4; li++) {
                const lx = startX + (li*usableW/5);
                const lg2 = new PIXI.Graphics(); lg2.beginFill(lc, 0.4); lg2.drawRect(lx-10, fy, 20, 2); lg2.endFill();
                const bm = new PIXI.Graphics(); bm.beginFill(lc, 0.04);
                bm.moveTo(lx-10,fy+2); bm.lineTo(lx+10,fy+2); bm.lineTo(lx+30,fy+floorH-8); bm.lineTo(lx-30,fy+floorH-8); bm.closePath(); bm.endFill();
                this.scene.addChild(lg2, bm);
                this.indoorLights.push({ g:bm, maxA:0.06, type:'screen' });
            }

            // Elevator door
            const dr = new PIXI.Graphics();
            dr.beginFill(0x1a2030); dr.lineStyle(1, 0x111822);
            dr.drawRect(shaftX+15, fy+floorH-44, 30, 40);
            dr.moveTo(shaftX+30, fy+floorH-44); dr.lineTo(shaftX+30, fy+floorH-4); dr.endFill();
            dr.beginFill(0x111822); dr.drawRect(shaftX+5, fy+floorH-25, 4, 8);
            dr.beginFill(isB?0xef4444:0x4ade80); dr.drawCircle(shaftX+7, fy+floorH-23, 1.5); dr.endFill();
            this.scene.addChild(dr);

            // Floor content
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy+floorH-4;
            if (f >= 0) floorConts[f] = { c: fc, pY };
            if (isB) {
                this._drawBasement(fc, startX, usableW, pY, fy, floorH, accentCol);
            } else {
                this._drawFloor(fc, f, numFloors, startX, usableW, pY, fy, floorH, accentCol);
            }
        }

        // ─── UNDERGROUND EARTH ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX - 8, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX - 8, 6); earth.endFill();
        earth.beginFill(0x2a2218); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY - 2, startX - 8, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(shaftX + shaftW, groundY - 2, G.vpW - shaftX - shaftW, 6); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY - 4, startX - 8, 4); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(shaftX + shaftW, groundY - 4, G.vpW - shaftX - shaftW, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── ELEVATOR ───
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container(); ec.y = roofH+(numFloors-1)*floorH+floorH; this.scene.addChild(ec);
            if (this.lifts[bld.id]) this.lifts[bld.id].destroy();
            this.lifts[bld.id] = new CityElevator(ec, numFloors, floorH, shaftX+15);
        }

        // ─── SPAWN FIELD TRIP VISITORS (AI models currently routed here) ───
        if (G.models && G.charRefs) {
            const visitors = G.models.filter(m => { const refs = G.charRefs[m.id]; return refs && refs.bld === bld.id; });
            const floors = Object.keys(floorConts).map(Number).sort((a,b)=>b-a);
            if (floors.length > 0 && visitors.length > 0) {
                const perFloor = Math.ceil(visitors.length / floors.length);
                visitors.forEach((m, idx) => {
                    const fi = floors[Math.min(Math.floor(idx / perFloor), floors.length - 1)];
                    const fc = floorConts[fi]; if (!fc) return;
                    const posIdx = idx % perFloor;
                    const rx = startX + 80 + posIdx * 55;
                    this._visitor(fc.c, Math.min(rx, startX + usableW - 40), fc.pY, m);
                });
            }
        }

        // ─── BELOW-BASEMENT STACK (city profile) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 6;
        const undergroundH = (typeof Underground !== 'undefined') ? Underground.FULL_STACK_DEPTH : 238;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, basementBottom - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, undergroundY + undergroundH, G.vpW, 3000); vm.endFill();
        this.scene.addChild(vm);
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'city', (bld.x | 0));
            this.scene.addChild(ug);
            if (this._liveTrains) this._liveTrains.destroy();
            this._liveTrains = Underground.attachLiveTrains(
                this.scene, bld.x + bld.w / 2, 0,
                undergroundY + Underground.H_CABLE_TRAY, G.vpW, 1200);
        }

        // ─── POSITION & SCROLL ───
        const bp = 56, initY = G.vpH-bp-this.totalH+floorH;
        this.scene.y = initY;
        this.minY = Math.min(initY - floorH * 3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = Math.max(initY + floorH * 3, G.vpH - bp);
        this._noYScroll = false;

        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { if(this._noYScroll) return; this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorLegacy.isDragging || !InteriorLegacy.scene || InteriorLegacy.scene.destroyed) return; let ny=InteriorLegacy._startSceneY+(e.clientY-InteriorLegacy._startY); ny=Math.max(InteriorLegacy.minY,Math.min(ny,InteriorLegacy.maxY)); InteriorLegacy.scene.y=ny; };
        this._onUp = () => { InteriorLegacy.isDragging=false; if(InteriorLegacy.layer) InteriorLegacy.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══ FLOOR DISPATCH ═══
    _drawFloor(c, f, nf, sx, uw, pY, fy, fh, col) {
        if (f === nf-1)     this._drawHallOfFame(c, sx, uw, pY, fy, fh, col);
        else if (f === nf-2) this._drawTimeline(c, sx, uw, pY, fy, fh, col);
        else if (f === 1)    this._drawArchitectures(c, sx, uw, pY, fy, fh, col);
        else                 this._drawLobby(c, sx, uw, pY, fy, fh, col);
    },

    // ═══ FLOOR 0: MUSEUM LOBBY ═══
    _drawLobby(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'MUSEUM LOBBY', 0x94a3b8);
        // Welcome desk
        this._welcomeDesk(c, sx+80, pY, col);
        // Velvet rope entrance
        this._velvetRope(c, sx+200, pY);
        // Info kiosk
        this._infoKiosk(c, sx+uw-180, pY, col);
        // Gift shop shelf
        this._giftShop(c, sx+uw-100, pY);
        // Museum Curator NPC
        this._npc(c, sx+100, pY, 'Curator', col);
        // Tour Guide NPC
        this._npc(c, sx+230, pY, 'Tour Guide', 0x60a5fa);
    },

    // ═══ FLOOR 1: HALL OF ARCHITECTURES ═══
    _drawArchitectures(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'HALL OF ARCHITECTURES', col);
        // Exhibit cases for deprecated architectures
        this._exhibitCase(c, sx+40,  pY, 'RNN', 0xef4444, ['Recurrent loops','Vanishing gradients','seq2seq era']);
        this._exhibitCase(c, sx+160, pY, 'LSTM', 0x4ade80, ['Memory cells','Forget gates','NLP backbone']);
        this._exhibitCase(c, sx+280, pY, 'GAN', 0xa855f7, ['Generator vs','Discriminator','Mode collapse']);
        this._exhibitCase(c, sx+400, pY, 'CNN', 0x22d3ee, ['Conv filters','Pooling layers','ImageNet king']);
        // Info plaques between exhibits
        this._infoPlaque(c, sx+130, pY, 'DEPRECATED 2017');
        this._infoPlaque(c, sx+250, pY, 'SUPERSEDED 2018');
        this._infoPlaque(c, sx+370, pY, 'EVOLVED 2020');
    },

    // ═══ FLOOR 2: TIMELINE GALLERY ═══
    _drawTimeline(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'AI TIMELINE GALLERY', 0xfbbf24);
        // Timeline bar running across the floor
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(col, 0.3); g.drawRect(sx+20, pY-20, uw-40, 3); g.endFill();
        c.addChild(g);
        // Timeline markers
        const milestones = [
            { year: '1956', label: 'Dartmouth', col: 0x94a3b8 },
            { year: '1997', label: 'Deep Blue', col: 0x4488cc },
            { year: '2012', label: 'AlexNet', col: 0xef4444 },
            { year: '2017', label: 'Transformer', col: 0xfbbf24 },
            { year: '2020', label: 'GPT-3', col: 0x4ade80 },
            { year: '2023', label: 'GPT-4', col: 0xa855f7 },
            { year: '2025', label: 'Agents', col: 0x22d3ee },
        ];
        const spacing = (uw - 80) / (milestones.length - 1);
        milestones.forEach((m, i) => {
            const mx = sx + 40 + i * spacing;
            this._timelineMarker(c, mx, pY, m.year, m.label, m.col);
        });
        // Interactive display panel
        this._displayPanel(c, sx+uw/2-40, pY, col);
    },

    // ═══ FLOOR 3: HALL OF FAME ═══
    _drawHallOfFame(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'HALL OF FAME', 0xfbbf24);
        // Portrait frames of notable retired models
        const retiredModels = G.models ? G.models.filter(m => {
            const stg = typeof getStage === 'function' ? getStage(m.rel, m.ret, m.phase) : 'adult';
            return stg === 'retired';
        }).slice(0, 5) : [];
        const frameSpacing = Math.min(90, (uw - 60) / Math.max(1, retiredModels.length));
        retiredModels.forEach((m, i) => {
            const fx = sx + 50 + i * frameSpacing;
            this._portrait(c, fx, pY, m);
        });
        // If no retired models, show placeholder frames
        if (retiredModels.length === 0) {
            for (let i = 0; i < 4; i++) {
                this._emptyFrame(c, sx + 50 + i * 100, pY, col);
            }
            const placeholder = new PIXI.Text('Awaiting future inductees...', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x666688, fontStyle: 'italic' });
            placeholder.anchor.set(0.5, 0); placeholder.x = sx+uw/2; placeholder.y = pY - 6; c.addChild(placeholder);
        }
        // Eternal flame / memorial torch
        this._memorialTorch(c, sx+uw-60, pY, col);
    },

    // ═══ BASEMENT: ARCHIVES ═══
    _drawBasement(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'ARCHIVES & STORAGE', 0xef4444);
        // Old server racks
        for (let x = sx+40; x < sx+uw-100; x += 100) this._oldServer(c, x, pY);
        // Filing cabinets
        for (let x = sx+80; x < sx+uw-80; x += 130) this._fileCabinet(c, x, pY);
        // Dusty crates
        this._dustyCrate(c, sx+uw-80, pY);
        this._dustyCrate(c, sx+30, pY);
    },

    // ═══════════════════════════════════════════════════════════════
    //   MUSEUM PROPS
    // ═══════════════════════════════════════════════════════════════

    _lbl(c,x,y,t,col) {
        const tx = new PIXI.Text(t, { fontFamily:'JetBrains Mono', fontSize:7, fill:col||0x94a3b8, letterSpacing:2 });
        tx.anchor.set(0.5,0); tx.x=x; tx.y=y; tx.zIndex=10; c.addChild(tx);
    },

    _welcomeDesk(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Desk body — dark wood with gold trim
        g.beginFill(0x2a1f14); g.drawRect(x, y-18, 90, 18); g.endFill();
        g.beginFill(col, 0.4); g.drawRect(x, y-20, 90, 3); g.endFill();
        // Monitor
        g.beginFill(0x111120); g.drawRect(x+30, y-35, 28, 14); g.endFill();
        g.beginFill(0x22d3ee, 0.2); g.drawRect(x+32, y-33, 24, 10); g.endFill();
        // "TICKETS" sign
        c.addChild(g);
        const ts = new PIXI.Text('TICKETS', { fontFamily:'JetBrains Mono', fontSize:5, fill:col, letterSpacing:1 });
        ts.anchor.set(0.5,0.5); ts.x = x+45; ts.y = y-10; c.addChild(ts);
    },

    _velvetRope(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Posts
        g.beginFill(0xc9a84c); g.drawRect(x, y-24, 4, 24); g.endFill();
        g.beginFill(0xc9a84c); g.drawCircle(x+2, y-26, 3); g.endFill();
        g.beginFill(0xc9a84c); g.drawRect(x+50, y-24, 4, 24); g.endFill();
        g.beginFill(0xc9a84c); g.drawCircle(x+52, y-26, 3); g.endFill();
        // Rope (catenary curve)
        g.lineStyle(2, 0xcc2244, 0.8);
        g.moveTo(x+2, y-22);
        g.quadraticCurveTo(x+26, y-14, x+52, y-22);
        g.lineStyle(0);
        c.addChild(g);
    },

    _infoKiosk(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Stand
        g.beginFill(0x334155); g.drawRect(x+8, y-6, 14, 6); g.endFill();
        // Screen
        g.beginFill(0x1a1a2e); g.drawRect(x, y-40, 30, 34); g.endFill();
        const gl = new PIXI.Graphics(); gl.eventMode = 'none';
        gl.beginFill(col, 0.12); gl.drawRect(x+3, y-37, 24, 28); gl.endFill();
        gl.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, gl);
        this.indoorLights.push({ g: gl, maxA: 0.15, type: 'screen' });
        // "i" icon
        const info = new PIXI.Text('i', { fontFamily:'JetBrains Mono', fontSize:10, fill:col, fontWeight:'bold' });
        info.anchor.set(0.5,0.5); info.x = x+15; info.y = y-23; c.addChild(info);
    },

    _giftShop(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Shelf
        g.beginFill(0x3a3020); g.drawRect(x, y-48, 55, 48); g.endFill();
        g.beginFill(0x4a4030); g.drawRect(x+2, y-46, 51, 2); g.endFill();
        g.beginFill(0x4a4030); g.drawRect(x+2, y-24, 51, 2); g.endFill();
        // Miniature items (colorful souvenirs)
        const cols = [0xef4444, 0x4ade80, 0x60a5fa, 0xfbbf24, 0xa855f7];
        for (let i = 0; i < 5; i++) {
            g.beginFill(cols[i]); g.drawRect(x+4+i*10, y-42, 8, 14); g.endFill();
        }
        for (let i = 0; i < 4; i++) {
            g.beginFill(cols[i+1], 0.7); g.drawCircle(x+8+i*12, y-14, 4); g.endFill();
        }
        c.addChild(g);
        const lbl = new PIXI.Text('GIFT SHOP', { fontFamily:'JetBrains Mono', fontSize:5, fill:0x94a3b8, letterSpacing:1 });
        lbl.anchor.set(0.5,0); lbl.x = x+27; lbl.y = y-56; c.addChild(lbl);
    },

    _exhibitCase(c, x, y, title, col, lines) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass case
        g.beginFill(0x111118); g.drawRect(x, y-50, 70, 50); g.endFill();
        g.lineStyle(1, col, 0.3); g.drawRect(x+2, y-48, 66, 44); g.lineStyle(0);
        // Glowing exhibit inside
        g.beginFill(col, 0.08); g.drawRect(x+4, y-46, 62, 40); g.endFill();
        // Exhibit icon — abstract neural net shape
        g.beginFill(col, 0.4); g.drawCircle(x+35, y-30, 8); g.endFill();
        g.beginFill(col, 0.2); g.drawCircle(x+20, y-35, 4); g.drawCircle(x+50, y-35, 4); g.endFill();
        g.beginFill(col, 0.2); g.drawCircle(x+20, y-20, 4); g.drawCircle(x+50, y-20, 4); g.endFill();
        g.lineStyle(1, col, 0.15);
        g.moveTo(x+24, y-35); g.lineTo(x+35, y-30); g.moveTo(x+46, y-35); g.lineTo(x+35, y-30);
        g.moveTo(x+24, y-20); g.lineTo(x+35, y-30); g.moveTo(x+46, y-20); g.lineTo(x+35, y-30);
        g.lineStyle(0);
        // Spotlight glow
        const gl = new PIXI.Graphics(); gl.eventMode = 'none';
        gl.beginFill(col, 0.04); gl.drawRect(x-2, y-52, 74, 54); gl.endFill();
        gl.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, gl);
        this.indoorLights.push({ g: gl, maxA: 0.06, type: 'blink' });
        // Title plaque
        const tt = new PIXI.Text(title, { fontFamily:'JetBrains Mono', fontSize:8, fill:col, fontWeight:'bold' });
        tt.anchor.set(0.5,0); tt.x = x+35; tt.y = y+2; c.addChild(tt);
        // Description lines
        lines.forEach((ln, i) => {
            const lt = new PIXI.Text(ln, { fontFamily:'JetBrains Mono', fontSize:5, fill:0x666688 });
            lt.anchor.set(0.5,0); lt.x = x+35; lt.y = y+12+i*7; c.addChild(lt);
        });
    },

    _infoPlaque(c, x, y, text) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x2a2a3a); g.drawRoundedRect(x, y-14, 20, 10, 2); g.endFill();
        g.beginFill(0xc9a84c, 0.3); g.drawRoundedRect(x+1, y-13, 18, 8, 1); g.endFill();
        c.addChild(g);
        const t = new PIXI.Text(text, { fontFamily:'JetBrains Mono', fontSize:4, fill:0x94a3b8 });
        t.anchor.set(0.5,0.5); t.x = x+10; t.y = y-9; c.addChild(t);
    },

    _timelineMarker(c, x, y, year, label, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Vertical marker
        g.beginFill(col, 0.6); g.drawRect(x-1, y-38, 3, 20); g.endFill();
        // Diamond node
        g.beginFill(col);
        g.moveTo(x, y-42); g.lineTo(x+4, y-38); g.lineTo(x, y-34); g.lineTo(x-4, y-38); g.closePath();
        g.endFill();
        // Glow
        const gl = new PIXI.Graphics(); gl.eventMode = 'none';
        gl.beginFill(col, 0.06); gl.drawCircle(x, y-38, 12); gl.endFill();
        gl.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, gl);
        this.indoorLights.push({ g: gl, maxA: 0.08, type: 'screen' });
        // Year label
        const yl = new PIXI.Text(year, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, fontWeight:'bold' });
        yl.anchor.set(0.5,0); yl.x = x; yl.y = y-52; c.addChild(yl);
        // Description
        const dl = new PIXI.Text(label, { fontFamily:'JetBrains Mono', fontSize:5, fill:0x94a3b8 });
        dl.anchor.set(0.5,0); dl.x = x; dl.y = y-10; c.addChild(dl);
    },

    _displayPanel(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a12); g.drawRect(x, y-48, 80, 42); g.endFill();
        g.beginFill(0x111120); g.drawRect(x+3, y-45, 74, 36); g.endFill();
        const gl = new PIXI.Graphics(); gl.eventMode = 'none';
        gl.beginFill(col, 0.1); gl.drawRect(x+5, y-43, 70, 32); gl.endFill();
        gl.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, gl);
        this.indoorLights.push({ g: gl, maxA: 0.12, type: 'screen' });
        // Scrolling text — "AI EVOLUTION"
        const dt = new PIXI.Text('THE EVOLUTION OF AI', { fontFamily:'JetBrains Mono', fontSize:6, fill:col });
        dt.anchor.set(0.5,0.5); dt.x = x+40; dt.y = y-28; c.addChild(dt);
    },

    _portrait(c, x, y, model) {
        const labData = (typeof LABS !== 'undefined' && LABS[model.lab]) || { color: '#c9a84c' };
        const col = parseInt(labData.color.replace('#',''), 16);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Ornate frame
        g.lineStyle(2, 0xc9a84c); g.drawRect(x, y-50, 50, 40); g.lineStyle(0);
        g.beginFill(0x1a1a2e); g.drawRect(x+3, y-47, 44, 34); g.endFill();
        // Portrait silhouette
        g.beginFill(col, 0.3); g.drawCircle(x+25, y-35, 8); g.endFill();
        g.beginFill(col, 0.2); g.drawRect(x+15, y-26, 20, 12); g.endFill();
        c.addChild(g);
        // Clickable
        const cont = new PIXI.Container();
        cont.addChild(g);
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(x-2, y-52, 54, 52);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(model); });
        cont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, model.name, 'Retired \u2014 Hall of Fame'); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(cont);
    },

    _emptyFrame(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.lineStyle(1, col, 0.3); g.drawRect(x, y-50, 50, 40); g.lineStyle(0);
        g.beginFill(0x111118); g.drawRect(x+2, y-48, 46, 36); g.endFill();
        g.beginFill(col, 0.05); g.drawRect(x+4, y-46, 42, 32); g.endFill();
        // Question mark
        const qm = new PIXI.Text('?', { fontFamily:'JetBrains Mono', fontSize:14, fill:col, alpha:0.3 });
        qm.anchor.set(0.5,0.5); qm.x = x+25; qm.y = y-30; qm.alpha = 0.2; c.addChild(g, qm);
    },

    _memorialTorch(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pillar
        g.beginFill(0x3a3a4a); g.drawRect(x-6, y-35, 12, 35); g.endFill();
        g.beginFill(0x4a4a5a); g.drawRect(x-8, y-37, 16, 4); g.endFill();
        // Bowl
        g.beginFill(0xc9a84c);
        g.moveTo(x-10, y-37); g.lineTo(x+10, y-37); g.lineTo(x+7, y-43); g.lineTo(x-7, y-43); g.closePath();
        g.endFill();
        c.addChild(g);
        // Flame glow
        const gl = new PIXI.Graphics(); gl.eventMode = 'none';
        gl.beginFill(0xff8800, 0.08); gl.drawCircle(x, y-48, 14); gl.endFill();
        gl.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(gl);
        this.indoorLights.push({ g: gl, maxA: 0.12, type: 'blink' });
    },

    _oldServer(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a22); g.drawRect(x, y-50, 36, 50); g.endFill();
        g.beginFill(0x222230); g.drawRect(x+3, y-47, 30, 44); g.endFill();
        for (let s = y-45; s < y-5; s += 8) {
            g.beginFill(0x2a2a3a); g.drawRect(x+5, s, 26, 6); g.endFill();
            // Dead status lights (red/off)
            g.beginFill(0x442222); g.drawCircle(x+9, s+3, 1); g.endFill();
            g.beginFill(0x333340); g.drawRect(x+13, s+1, 15, 4); g.endFill();
        }
        // "OFFLINE" label
        c.addChild(g);
        const ol = new PIXI.Text('OFFLINE', { fontFamily:'JetBrains Mono', fontSize:4, fill:0x662222 });
        ol.anchor.set(0.5,0.5); ol.x = x+18; ol.y = y+6; c.addChild(ol);
    },

    _fileCabinet(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x3a3a4a); g.drawRect(x, y-45, 28, 45); g.endFill();
        for (let d = 0; d < 3; d++) {
            g.beginFill(0x2a2a3a); g.drawRect(x+3, y-42+d*14, 22, 11); g.endFill();
            g.beginFill(0x666677); g.drawRect(x+12, y-38+d*14, 4, 3); g.endFill();
        }
        c.addChild(g);
    },

    _dustyCrate(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x4a3a2a); g.drawRect(x, y-22, 30, 22); g.endFill();
        g.beginFill(0x5a4a3a); g.drawRect(x, y-22, 30, 3); g.endFill();
        g.lineStyle(1, 0x3a2a1a); g.moveTo(x, y-22); g.lineTo(x+30, y); g.moveTo(x+30, y-22); g.lineTo(x, y); g.lineStyle(0);
        // Dust particles
        g.beginFill(0x8a7a6a, 0.3); g.drawCircle(x+5, y-25, 1); g.drawCircle(x+22, y-24, 0.8); g.drawCircle(x+15, y-26, 1.2); g.endFill();
        c.addChild(g);
    },

    // ═══ NPC AVATAR ═══
    _npc(c, x, y, name, col) {
        // Museum: closed at night — only Security stays
        const dp = G.getDayPhase(); const isNight = dp > 0.83 || dp < 0.25;
        if (isNight && name !== 'Security') return;
        const cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.sortableChildren = true; cont.zIndex = 5;
        const labCol = col || 0x64748b; const bw = 16; const h = 32; const headH = Math.round(h*0.4); const bodyH = h-headH-4;
        // Shadow
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill(); cont.addChild(sh);
        // Legs
        const lw = Math.max(2,bw*0.25); const lh = 4;
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,lh); legL.endFill(); legL.x = -bw*0.15; cont.addChild(legL);
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,lh); legR.endFill(); legR.x = bw*0.15; cont.addChild(legR);
        // Body
        const body = new PIXI.Graphics(); body.beginFill(labCol); body.drawRoundedRect(-bw/2,0,bw,Math.max(bodyH,4),bw*0.1); body.endFill(); body.y = -h+headH; cont.addChild(body);
        // Head
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        const eyeS = Math.max(1,bw*0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,eyeS); head.drawCircle(bw*0.1,headH*0.38,eyeS); head.endFill();
        head.beginFill(0x000000,0.4); head.drawRect(-bw*0.08,headH*0.6,bw*0.16,1.5); head.endFill();
        head.y = -h; cont.addChild(head);
        // Status dot
        const dot = new PIXI.Graphics(); dot.beginFill(0x4ade80); dot.drawCircle(0,0,2); dot.endFill(); dot.y = -h-6; cont.addChild(dot);
        // (name tag removed — hover tooltip + info panel only)
        // Click
        const npcModel = { id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name:name, isNPC:true, role:name, phase:'released', lab:'other', desc:'Museum staff \u2014 preserving AI history.' };
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel(npcModel); });
        cont.on('pointerover', (e) => { if(typeof UI!=='undefined') UI.showTooltip(e, name, 'Museum Staff'); });
        cont.on('pointerout', () => { if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({ cont, head, body, legL, legR, _h:h, _minX:x-60, _maxX:x+60, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 });
    },

    // ═══ VISITOR AVATAR (AI models on field trips) ═══
    _visitor(c, x, y, model) {
        const labData = (typeof LABS !== 'undefined' && LABS[model.lab]) || { color: '#64748b' };
        const labCol = parseInt(labData.color.replace('#',''),16);
        const stg = typeof getStage === 'function' ? getStage(model.rel, model.ret, model.phase) : 'baby';
        const sc = stg === 'baby' ? 0.6 : stg === 'kid' ? 0.8 : 0.9;
        const cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.sortableChildren = true; cont.zIndex = 5;
        const bw = 16*sc, h = 32*sc, headH = Math.round(h*0.35), bodyH = h-headH-4;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill(); cont.addChild(sh);
        const lw = Math.max(2,bw*0.25), lh = 4*sc;
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,lh); legL.endFill(); legL.x = -bw*0.15; cont.addChild(legL);
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,lh); legR.endFill(); legR.x = bw*0.15; cont.addChild(legR);
        const body = new PIXI.Graphics(); body.beginFill(labCol); body.drawRoundedRect(-bw/2,0,bw,Math.max(bodyH,4),bw*0.1); body.endFill(); body.y = -h+headH; cont.addChild(body);
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        const eyeS = Math.max(1,bw*0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,eyeS); head.drawCircle(bw*0.1,headH*0.38,eyeS); head.endFill();
        head.beginFill(0x000000,0.4); head.drawRect(-bw*0.08,headH*0.6,bw*0.16,1.5); head.endFill();
        head.y = -h; cont.addChild(head);
        const dotCol = stg === 'baby' ? 0xff69b4 : stg === 'kid' ? 0xfbbf24 : 0xa855f7;
        const dot = new PIXI.Graphics(); dot.beginFill(dotCol); dot.drawCircle(0,0,2); dot.endFill(); dot.y = -h-6; cont.addChild(dot);
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel(model); });
        cont.on('pointerover', (e) => { if(typeof UI!=='undefined') UI.showTooltip(e, model.name, (stg==='baby'?'Pre-Training':stg==='kid'?'Training':'Rumored') + ' (field trip)'); });
        cont.on('pointerout', () => { if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({ cont, head, body, legL, legR, _h:h, _minX:x-50, _maxX:x+50, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 });
    },

    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        // ─── Sky matches exterior day/night ───
        const dp = G.getDayPhase(); const night = dp>.83||dp<.25;
        const vp = document.getElementById('viewport');
        if (vp) { let sky; if(dp<.22) sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; else if(dp<.30){const t=(dp-.22)/.08;sky=`linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`;} else if(dp<.72) sky='linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if(dp<.84){const t=(dp-.72)/.12;sky=`linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`;} else sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; if(typeof Environment!=='undefined'&&!night&&dp>.3&&dp<.72){const _ew=Environment.weather;if(_ew==='rain'||_ew==='drizzle') sky='linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';else if(_ew==='thunderstorm') sky='linear-gradient(180deg,#1a1f2a,#2d3340 50%,#444a55)';else if(_ew==='overcast') sky='linear-gradient(180deg,#4a5568,#64748b 50%,#94a3b8)';else if(_ew==='fog') sky='linear-gradient(180deg,#8a9099,#a8b1bb 50%,#c0c8d0)';else if(_ew==='partly_cloudy') sky='linear-gradient(180deg,#355088,#6a9abf 50%,#93b9d8)';} vp.style.background=sky; }
        // Celestial body
        if(this.celestialGfx){this.celestialGfx.clear();if(night){let np=dp>0.83?(dp-0.83)/0.42:(dp+0.17)/0.42;this.celestialGfx.beginFill(0xe8e8d0);this.celestialGfx.drawCircle(G.vpW*np,40+Math.sin(np*Math.PI)*120,12);this.celestialGfx.endFill();}else{let dayP=(dp-0.25)/(0.83-0.25);this.celestialGfx.beginFill(0xffe066);this.celestialGfx.drawCircle(G.vpW*dayP,40+Math.sin(dayP*Math.PI)*120,15);this.celestialGfx.endFill();}}
        if(this.starsLayer){this.starsLayer.visible=night;if(night)this.starsLayer.children.forEach(s=>{s.alpha=.15+Math.abs(Math.sin(G.tick*.03+s._phase))*.5;});}
        // Lights
        this.indoorLights.forEach(l=>{if(!l.g||l.g.destroyed)return;if(l.type==='blink')l.g.alpha=l.maxA*(0.5+Math.sin(G.tick*0.05+Math.random()*0.1)*0.5);else if(l.type==='screen')l.g.alpha=l.maxA*(0.7+Math.sin(G.tick*0.02)*0.3);});
        // Elevator
        if(this.bld&&this.lifts[this.bld.id])this.lifts[this.bld.id].update();
        // Live trains visible in basement tunnel slice
        if (this._liveTrains) this._liveTrains.update();
        // NPC + visitor wandering with walk animation
        this.avatars.forEach(av=>{if(!av.cont||av.cont.destroyed)return;
            av._walkTimer=(av._walkTimer||0)-1;if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;}const nx=av.cont.x+av._walkDir*0.3;if(nx>av._minX&&nx<av._maxX)av.cont.x=nx;
            const ah=av._h||32;
            if(av.head){av.head.y=-ah+Math.sin(G.tick*0.12+av._phase)*1.5;}
            if(av.body){av.body.y=-ah+Math.round(ah*0.4)+Math.abs(Math.sin(G.tick*0.12+av._phase))*1.5;}
            if(av.legL){av.legL.y=Math.sin(G.tick*0.15+av._phase)*2.5;}
            if(av.legR){av.legR.y=-Math.sin(G.tick*0.15+av._phase)*2.5;}
        });
    }
};
