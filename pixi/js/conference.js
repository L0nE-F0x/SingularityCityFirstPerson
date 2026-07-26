/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE SYSTEM (v1.0.0)
   NeurIPS, ICML, ICLR conference weeks — convention center with keynotes, posters, and demo booths
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceData = {

    CONFERENCES: [
        { id: 'neurips', name: 'NeurIPS',  month: 12, startDay: 8,  endDay: 14, color: 0xf43f5e, hex: '#f43f5e', theme: 'Neural Information Processing Systems' },
        { id: 'icml',    name: 'ICML',     month: 7,  startDay: 21, endDay: 27, color: 0x3b82f6, hex: '#3b82f6', theme: 'International Conference on Machine Learning' },
        { id: 'iclr',    name: 'ICLR',     month: 5,  startDay: 5,  endDay: 9,  color: 0x4ade80, hex: '#4ade80', theme: 'International Conference on Learning Representations' },
        { id: 'cvpr',    name: 'CVPR',     month: 6,  startDay: 16, endDay: 20, color: 0xfbbf24, hex: '#fbbf24', theme: 'Conference on Computer Vision and Pattern Recognition' },
        { id: 'aaai',    name: 'AAAI',     month: 2,  startDay: 24, endDay: 28, color: 0xa78bfa, hex: '#a78bfa', theme: 'Association for the Advancement of AI' },
    ],

    PAPER_TITLES: [
        'Scaling Laws for Neural Language Models',
        'Attention Is Still All You Need (For Now)',
        'Towards Efficient Inference at the Edge',
        'Can Transformers Learn to Reason?',
        'RLHF Considered Harmful: A Retrospective',
        'Mixture of Experts: A Practical Guide',
        'Self-Play and the Emergence of Agency',
        'Sparse Attention Beats Dense: Empirical Results',
        'Why Your Tokenizer Matters More Than You Think',
        'The Unreasonable Effectiveness of Data',
        'Alignment Tax: How Much Performance Do We Lose?',
        'Benchmarking the Benchmarks',
        'Long-Context Models: Are We There Yet?',
        'Multimodal Reasoning in the Wild',
        'On the Geometry of Latent Spaces',
        'Emergent Tool Use in Foundation Models',
    ],

    CHAT_MSGS: [
        'My poster is in session B3',
        'Did you see that keynote? 🎤',
        'Rejected from oral presentation 😤',
        'Spotlight paper! 🌟',
        'The coffee line is insane',
        'Networking event tonight!',
        'Our ablation study is solid',
        'Best paper nominee!',
        'So many vision papers this year',
        'The hallway track is where the real talks happen',
        'Anyone going to the workshop tomorrow?',
        'My GPU cluster ran out mid-experiment 😭',
        'SOTA on 3 benchmarks!',
        'Need more baselines...',
        'The reviewer was harsh but fair',
    ],

    _bld: null,
    _active: null,

    init() {
        // Only inject building if a conference is currently active
        this._active = this.getActiveConference();
        if (this._active) {
            this._injectBuilding();
        }
    },

    _injectBuilding() {
        if (BLDS.find(b => b.id === 'convention_center')) return;
        const conf = this._active;
        const bld = {
            id: 'convention_center',
            name: conf.name + ' Convention Center',
            w: 200, fl: 4, x: 0,
            emoji: '🎓',
            lab: null,
            type: 'convention_center',
            desc: conf.theme + '. ' + conf.name + ' ' + new Date().getFullYear() + ' is in session — posters, keynotes, and demo booths.',
            _confColor: conf.color,
            _confId: conf.id,
        };
        BLDS.push(bld);
        G.bldById['convention_center'] = bld;
        this._bld = bld;
    },

    getActiveConference() {
        const now = new Date();
        const m = now.getMonth() + 1, d = now.getDate();
        for (const c of this.CONFERENCES) {
            if (m === c.month && d >= c.startDay && d <= c.endDay) return c;
        }
        return null;
    },

    isActive() {
        return this._active !== null;
    },

    getConferenceChat() {
        return this.CHAT_MSGS[Math.floor(Math.random() * this.CHAT_MSGS.length)];
    },

    getPaperTitle() {
        // Prefer real arXiv papers when available
        if (typeof API !== 'undefined' && API.arxivPapers && API.arxivPapers.length > 0) {
            return API.arxivPapers[Math.floor(Math.random() * API.arxivPapers.length)].title;
        }
        return this.PAPER_TITLES[Math.floor(Math.random() * this.PAPER_TITLES.length)];
    },

    /* Called from engine loop */
    update() {
        // Re-check conference status every 60 seconds
        if (G.tick % 3600 === 0) {
            const was = this._active;
            this._active = this.getActiveConference();
            if (!was && this._active) {
                this._injectBuilding();
                if (typeof UI !== 'undefined') UI.addToast('🎓 ' + this._active.name + ' conference has begun!');
            } else if (was && !this._active) {
                // Conference ended — remove building from arrays
                const idx = BLDS.findIndex(b => b.id === 'convention_center');
                if (idx !== -1) BLDS.splice(idx, 1);
                delete G.bldById['convention_center'];
                this._bld = null;
                if (typeof Environment !== 'undefined' && Environment.buildBuildings) Environment.buildBuildings();
            }
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE ENVIRONMENT — Convention Center Exterior Rendering
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceEnv = {

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w
    buildBuilding(g, bld, h) {
        if (!bld || bld.id !== 'convention_center') return;
        const bw = bld.w;
        const conf = ConferenceData._active;
        const col = conf ? conf.color : 0x6366f1;

        g.beginFill(0x1e1b2e);
        g.drawRoundedRect(0, 0, bw, h, 4);
        g.endFill();
        g.beginFill(0x2a2745, 0.8);
        g.drawRect(4, 4, bw - 8, h * 0.6);
        g.endFill();
        // Conference banner
        g.beginFill(col, 0.9);
        g.drawRect(10, h * 0.3, bw - 20, 14);
        g.endFill();
        // Entrance
        g.beginFill(0x444466);
        g.drawRect(bw / 2 - 15, h - 20, 30, 20);
        g.endFill();
        g.beginFill(col, 0.5);
        g.drawRect(bw / 2 - 12, h - 18, 11, 16);
        g.drawRect(bw / 2 + 1, h - 18, 11, 16);
        g.endFill();
        // Roof dome
        g.beginFill(0x2a2745);
        g.drawEllipse(bw / 2, -4, bw * 0.25, 8);
        g.endFill();
        g.beginFill(col, 0.4);
        g.drawEllipse(bw / 2, -4, bw * 0.2, 5);
        g.endFill();
        // Glowing windows
        for (let row = 1; row >= 0; row--) {
            for (let col2 = 0; col2 < 5; col2++) {
                const wx = 12 + col2 * (bw - 24) / 5;
                const wy = h * 0.65 + row * 16;
                g.beginFill(0x334466, 0.6);
                g.drawRect(wx, wy, 18, 10);
                g.endFill();
                g.beginFill(0xffcc66, 0.15);
                g.drawRect(wx + 1, wy + 1, 16, 8);
                g.endFill();
            }
        }
        // Spotlights
        g.beginFill(col, 0.08);
        g.moveTo(bw * 0.3, 0); g.lineTo(bw * 0.2, h); g.lineTo(bw * 0.4, h); g.closePath();
        g.endFill();
        g.beginFill(col, 0.08);
        g.moveTo(bw * 0.7, 0); g.lineTo(bw * 0.6, h); g.lineTo(bw * 0.8, h); g.closePath();
        g.endFill();
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Could add banner animation, attendee particles, etc.
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE INTERIOR — Poster session, keynote stage, demo booths
   Full building structure: walls, windows, elevator, basement, themed props.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceInterior = {
    avatars: [], bubbles: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _noYScroll: false, elevators: [], lifts: {},

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = []; this.elevators = [];

        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()*1.2); s.endFill(); s.x = Math.random()*G.vpW; s.y = Math.random()*G.vpH*.5; s._phase = Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const conf = ConferenceData._active || { name: 'AI Conference', color: 0x6366f1 };
        const colHex = conf.color;
        const accentCol = colHex;

        const floorH = 80, numFloors = 4, roofH = 80;
        const totalFloors = numFloors + 1; // above-ground + basement
        this.totalH = roofH + totalFloors * floorH;

        const startX = 60, shaftW = 60, shaftX = G.vpW - shaftW - 80;
        const usableW = shaftX - startX - 20;
        const windowX = startX + 50, windowW = usableW - 100;

        // ─── ROOF SIGN BOARD ───
        const rc = new PIXI.Container();
        const bW = 220, bH = 34, bX = startX + usableW/2 - bW/2 + 10, bY = roofH - bH - 10;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, colHex, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+15, bY+bH, 6, 10); sg.drawRect(bX+bW-21, bY+bH, 6, 10); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text((conf.name + ' Convention Center').toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:14, fontWeight:'bold', fill:0xffffff, letterSpacing:2, dropShadow:true, dropShadowColor:colHex, dropShadowBlur:8, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text('🎓 CONVENTION CENTER', { fontFamily:'JetBrains Mono', fontSize:8, fill:0x94a3b8, letterSpacing:2 });
        bdg.anchor.set(0.5,0.5); bdg.x = bX+bW/2; bdg.y = bY-8; rc.addChild(bdg);
        const rl = new PIXI.Graphics();
        rl.beginFill(colHex, 0.3); rl.drawRect(startX, roofH-4, usableW+shaftW+20, 4); rl.endFill();
        rl.beginFill(colHex, 0.1); rl.drawRect(startX, roofH-8, usableW+shaftW+20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);

        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f)*floorH;
            const isB = f===-1;

            // Room walls & background
            const rg = new PIXI.Graphics();
            // Left wall
            rg.beginFill(0x080c12); rg.drawRect(startX-8, fy, 8, floorH); rg.endFill();
            // Right wall (before shaft)
            rg.beginFill(0x080c12); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            // Shaft enclosure (solid wall behind elevator)
            rg.beginFill(0x080c12); rg.drawRect(shaftX+6, fy, shaftW-6, floorH); rg.endFill();

            if (!isB) {
                // Above-ground: draw wall with window holes
                rg.beginFill(0x0a0e14); rg.drawRect(startX, fy, usableW, 22); rg.endFill();
                rg.beginFill(0x0a0e14); rg.drawRect(startX, fy+54, usableW, floorH-54); rg.endFill();
                let wx = windowX;
                rg.beginFill(0x0a0e14);
                rg.drawRect(startX, fy+22, windowX-startX, 32);
                while(wx+40<=windowX+windowW) {
                    wx += 40;
                    if (wx+20<=windowX+windowW) { rg.drawRect(wx, fy+22, 20, 32); }
                    wx += 20;
                }
                rg.drawRect(wx-20, fy+22, startX+usableW-wx+20, 32);
                rg.endFill();

                // Window frames
                const wfr = new PIXI.Graphics();
                let cwx = windowX;
                while(cwx+40<=windowX+windowW) {
                    wfr.lineStyle(2, 0x1a2030);
                    wfr.drawRect(cwx, fy+22, 40, 32);
                    wfr.moveTo(cwx+20, fy+22); wfr.lineTo(cwx+20, fy+54);
                    wfr.moveTo(cwx, fy+38); wfr.lineTo(cwx+40, fy+38);
                    wfr.lineStyle(0);
                    cwx+=60;
                }
                this.scene.addChild(wfr);
            } else {
                // Basement: solid wall, no windows
                rg.beginFill(0x0a0e14); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }

            // Floor surface
            rg.beginFill(0x060a10); rg.drawRect(startX, fy+floorH-8, usableW, 8); rg.endFill();
            // Ceiling trim
            rg.beginFill(0x111822); rg.drawRect(startX, fy, usableW, 4); rg.endFill();
            // Floor separator line
            rg.beginFill(0x2a2a42); rg.drawRect(startX-8, fy+floorH-4, usableW+shaftW+28, 4); rg.endFill();
            this.scene.addChild(rg);

            // Ceiling lights
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
            if (isB) {
                // Basement: AV & STORAGE
                this._drawBasement(fc, startX, usableW, pY, fy, floorH, colHex);
            } else if (f === 0) {
                // Floor 0: REGISTRATION
                this._drawRegistration(fc, startX, usableW, pY, fy, floorH, colHex, conf);
            } else if (f === 1) {
                // Floor 1: DEMO BOOTHS & EXPO
                this._drawDemoBooths(fc, startX, usableW, pY, fy, floorH, colHex);
            } else if (f === 2) {
                // Floor 2: POSTER SESSION
                this._drawPosterSession(fc, startX, usableW, pY, fy, floorH, colHex);
            } else if (f === 3) {
                // Floor 3: KEYNOTE HALL
                this._drawKeynoteHall(fc, startX, usableW, pY, fy, floorH, colHex, conf);
            }
        }

        // ─── UNDERGROUND EARTH around basement ───
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

        // ─── UNDERGROUND STACK — shared with exterior (city profile: cables/tunnel/infrastructure/pipes) ───
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
                this.scene,
                bld.x + bld.w / 2,
                0,
                undergroundY + Underground.H_CABLE_TRAY,
                G.vpW,
                1200
            );
        }

        // Position & scroll
        const bp = 56, initY = G.vpH-bp-this.totalH+floorH;
        this.scene.y = initY;
        this.minY = Math.min(initY - floorH * 3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = Math.max(initY + floorH * 3, G.vpH - bp);
        this._noYScroll = false;

        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { if(this._noYScroll) return; this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!ConferenceInterior.isDragging || !ConferenceInterior.scene || ConferenceInterior.scene.destroyed) return; let ny=ConferenceInterior._startSceneY+(e.clientY-ConferenceInterior._startY); ny=Math.max(ConferenceInterior.minY,Math.min(ny,ConferenceInterior.maxY)); ConferenceInterior.scene.y=ny; };
        this._onUp = () => { ConferenceInterior.isDragging=false; if(ConferenceInterior.layer) ConferenceInterior.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);

        // Achievement
        if (typeof G !== 'undefined') G.unlockAchieve('peer_reviewed');
    },

    // ═══ FLOOR DRAWING ═══
    _drawKeynoteHall(c, sx, uw, pY, fy, fh, col, conf) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'KEYNOTE HALL', col);
        // Large stage platform
        const g = new PIXI.Graphics(); g.eventMode='none';
        const stageW = uw*0.6, stageX = sx+(uw-stageW)/2;
        g.beginFill(0x2a1f4e); g.drawRoundedRect(stageX, pY-20, stageW, 20, 4); g.endFill();
        g.beginFill(col, 0.3); g.drawRect(stageX+2, pY-20, stageW-4, 3); g.endFill();
        // Presentation screen with conference-colored border
        g.lineStyle(2, col, 0.8); g.beginFill(0x0a0a1e); g.drawRect(stageX+stageW/2-60, pY-60, 120, 35); g.endFill(); g.lineStyle(0);
        // Screen content lines
        for (let i=0; i<3; i++) { g.beginFill(0x334466, 0.6); g.drawRect(stageX+stageW/2-50, pY-55+i*10, 100, 3); g.endFill(); }
        // Podium
        g.beginFill(0x3a3060); g.drawRect(stageX+stageW/2-8, pY-18, 16, 16); g.endFill();
        g.beginFill(col, 0.5); g.drawRect(stageX+stageW/2-5, pY-16, 10, 6); g.endFill();
        // Spotlight beams (additive blend triangles)
        const sp = new PIXI.Graphics(); sp.eventMode='none'; sp.blendMode = PIXI.BLEND_MODES.ADD;
        sp.beginFill(col, 0.06); sp.moveTo(stageX+stageW*0.3, fy+4); sp.lineTo(stageX+stageW*0.15, pY-20); sp.lineTo(stageX+stageW*0.45, pY-20); sp.closePath(); sp.endFill();
        sp.beginFill(col, 0.06); sp.moveTo(stageX+stageW*0.7, fy+4); sp.lineTo(stageX+stageW*0.55, pY-20); sp.lineTo(stageX+stageW*0.85, pY-20); sp.closePath(); sp.endFill();
        // Audience seats (3 rows of small rects)
        for (let row=0; row<3; row++) {
            for (let s=0; s<10; s++) {
                const ax = sx+30+s*((uw-60)/10);
                const ay = pY-4-row*10;
                g.beginFill(0x333350); g.drawRect(ax, ay-6, 10, 6); g.endFill();
            }
        }
        c.addChild(g, sp);
        this.indoorLights.push({ g:sp, maxA:0.08, type:'screen' });
        this._npc(c, stageX+stageW/2, pY, 'Speaker', col, this.bld);
    },

    _drawPosterSession(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'POSTER SESSION', col);
        const g = new PIXI.Graphics(); g.eventMode='none';
        // 5-6 poster boards (tall narrow rects)
        const numPosters = 6;
        const gap = uw / (numPosters + 1);
        for (let i=0; i<numPosters; i++) {
            const px = sx + gap*(i+1) - 12;
            // Poster board
            g.beginFill(0xeeeeee); g.drawRect(px, pY-55, 24, 45); g.endFill();
            // Conference-colored header strip
            g.beginFill(col); g.drawRect(px, pY-55, 24, 6); g.endFill();
            // Gray content lines
            for (let ln=0; ln<4; ln++) { g.beginFill(0xaaaaaa); g.drawRect(px+3, pY-46+ln*9, 18, 2); g.endFill(); }
            // Small desk in front of each
            g.beginFill(0x1e293b); g.drawRect(px-2, pY-8, 28, 8); g.endFill();
            g.beginFill(col, 0.2); g.drawRect(px-2, pY-10, 28, 2); g.endFill();
        }
        c.addChild(g);
    },

    _drawDemoBooths(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'DEMO BOOTHS & EXPO', col);
        const labArr = Object.values(LABS).slice(0,4);
        const numBooths = Math.min(4, labArr.length);
        const gap = uw / (numBooths + 1);
        for (let i=0; i<numBooths; i++) {
            const lab = labArr[i];
            const labCol = parseInt((lab.color||'#666').replace('#',''),16);
            const bx = sx + gap*(i+1) - 25;
            const g = new PIXI.Graphics(); g.eventMode='none';
            // Booth frame rect
            g.lineStyle(2, labCol, 0.6); g.beginFill(0x1a1830); g.drawRect(bx, pY-50, 50, 50); g.endFill(); g.lineStyle(0);
            // Lab-colored accent top
            g.beginFill(labCol); g.drawRect(bx, pY-50, 50, 6); g.endFill();
            // Demo screen (small dark rect)
            g.beginFill(0x0a0a18); g.drawRect(bx+8, pY-40, 34, 18); g.endFill();
            g.beginFill(labCol, 0.2); g.drawRect(bx+10, pY-38, 30, 14); g.endFill();
            // Booth desk
            g.beginFill(0x1e293b); g.drawRect(bx+5, pY-8, 40, 8); g.endFill();
            c.addChild(g);
        }
    },

    _drawRegistration(c, sx, uw, pY, fy, fh, col, conf) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'REGISTRATION', col);
        const g = new PIXI.Graphics(); g.eventMode='none';
        // Long registration desk
        const deskW = uw*0.5, deskX = sx+(uw-deskW)/2;
        g.beginFill(0x1e293b); g.drawRect(deskX, pY-16, deskW, 16); g.endFill();
        g.beginFill(col, 0.3); g.drawRect(deskX, pY-18, deskW, 3); g.endFill();
        // Badge printer (small rect with green light)
        g.beginFill(0x222240); g.drawRect(deskX+deskW+15, pY-14, 20, 14); g.endFill();
        g.beginFill(0x4ade80); g.drawCircle(deskX+deskW+25, pY-16, 2); g.endFill();
        // Info board
        g.beginFill(0x1a1a30); g.drawRect(sx+30, pY-50, 30, 40); g.endFill();
        g.beginFill(col, 0.4); g.drawRect(sx+30, pY-50, 30, 5); g.endFill();
        for (let ln=0; ln<3; ln++) { g.beginFill(0x444466); g.drawRect(sx+34, pY-42+ln*10, 22, 3); g.endFill(); }
        // Welcome banner with conference name
        g.beginFill(col, 0.7); g.drawRect(sx+uw/2-60, fy+8, 120, 14); g.endFill();
        c.addChild(g);
        const bt = new PIXI.Text('WELCOME TO '+conf.name, { fontFamily:'JetBrains Mono', fontSize:6, fill:0xffffff, fontWeight:'bold' });
        bt.anchor.set(0.5,0.5); bt.x=sx+uw/2; bt.y=fy+15; bt.zIndex=10; c.addChild(bt);
        this._npc(c, deskX+deskW/2, pY, 'Receptionist', col, this.bld);
    },

    _drawBasement(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx+uw/2, pY-fh+14, 'AV & STORAGE', 0xef4444);
        const g = new PIXI.Graphics(); g.eventMode='none';
        // Equipment crates
        for (let i=0; i<4; i++) {
            const cx = sx+30+i*70;
            g.beginFill(0x3a3020); g.drawRect(cx, pY-25, 30, 25); g.endFill();
            g.beginFill(0x4a4030); g.drawRect(cx+2, pY-23, 26, 21); g.endFill();
            g.beginFill(0x5a5040); g.drawRect(cx+5, pY-15, 20, 2); g.endFill();
        }
        // Cable drums (circles)
        for (let i=0; i<3; i++) {
            const dx = sx+uw-120+i*40;
            g.beginFill(0x333355); g.drawCircle(dx, pY-12, 10); g.endFill();
            g.beginFill(0x222240); g.drawCircle(dx, pY-12, 6); g.endFill();
            g.beginFill(col, 0.3); g.drawCircle(dx, pY-12, 2); g.endFill();
        }
        // AV rack
        g.beginFill(0x1a1a2e); g.drawRect(sx+uw/2-15, pY-45, 30, 45); g.endFill();
        g.beginFill(0x111120); g.drawRect(sx+uw/2-12, pY-42, 24, 39); g.endFill();
        for (let s=pY-40; s<pY-5; s+=8) {
            g.beginFill(0x1a1a30); g.drawRect(sx+uw/2-10, s, 20, 6); g.endFill();
            g.beginFill(0x4ade80); g.drawCircle(sx+uw/2-6, s+3, 1); g.endFill();
        }
        // Conduit lines
        g.beginFill(0xef4444, 0.15); g.drawRect(sx, fy+4, uw, 2); g.endFill();
        for (let cx2=sx+30; cx2<sx+uw; cx2+=60) { g.beginFill(0xef4444, 0.3); g.drawCircle(cx2, fy+5, 1.5); g.endFill(); }
        c.addChild(g);
    },

    // ═══ PROPS ═══
    _lbl(c,x,y,t,col) { const tx=new PIXI.Text(t,{fontFamily:'JetBrains Mono',fontSize:7,fill:col||0x94a3b8,letterSpacing:2}); tx.anchor.set(0.5,0); tx.x=x; tx.y=y; tx.zIndex=10; c.addChild(tx); },
    _npc(c,x,y,name,col,bld) {
        const cont=new PIXI.Container(); cont.x=x; cont.y=y; cont.sortableChildren=true; cont.zIndex=5;
        const labCol=col||0x64748b; const bw=16; const h=32; const headH=Math.round(h*0.35); const bodyH=h-headH-4;
        // Shadow
        const sh=new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill(); cont.addChild(sh);
        // Legs
        const lw=Math.max(2,bw*0.25); const lh=4;
        const legL=new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,lh); legL.endFill(); legL.x=-bw*0.15; cont.addChild(legL);
        const legR=new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,lh); legR.endFill(); legR.x=bw*0.15; cont.addChild(legR);
        // Body
        const body=new PIXI.Graphics(); body.beginFill(labCol); body.drawRoundedRect(-bw/2,0,bw,Math.max(bodyH,4),bw*0.1); body.endFill(); body.y=-h+headH; cont.addChild(body);
        // Head
        const head=new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        const eyeS=Math.max(1,bw*0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,eyeS); head.drawCircle(bw*0.1,headH*0.38,eyeS); head.endFill();
        head.beginFill(0x000000,0.4); head.drawRect(-bw*0.08,headH*0.6,bw*0.16,1.5); head.endFill();
        head.y=-h; cont.addChild(head);
        // Status dot
        const dot=new PIXI.Graphics(); dot.beginFill(0x4ade80); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-6; cont.addChild(dot);
        // (name tag removed — hover tooltip + info panel only)
        // Click → NPC info panel
        const npcModel = { id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name:name, isNPC:true, role:name, phase:'released', lab:bld?bld.lab:'other', desc:'Conference staff — managing the event.' };
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea=new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap',()=>{ if(typeof UI!=='undefined') UI.selectModel(npcModel); });
        cont.on('pointerover',(e)=>{ if(typeof UI!=='undefined') UI.showTooltip(e,name,'Conference Staff'); });
        cont.on('pointerout',()=>{ if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({cont,head,body,legL,legR,_minX:x-60,_maxX:x+60,_phase:Math.random()*Math.PI*2,_walkTimer:0,_walkDir:0});
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
        // NPC wandering with walk animation
        this.avatars.forEach(av=>{if(!av.cont||av.cont.destroyed)return;av._walkTimer=(av._walkTimer||0)-1;if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;}const nx=av.cont.x+av._walkDir*0.3;if(nx>av._minX&&nx<av._maxX)av.cont.x=nx;
            // Walk animation — legs swing, head/body bob
            if(av.head){av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5;}
            if(av.body){av.body.y=-32+11+Math.abs(Math.sin(G.tick*0.15+av._phase))*1.5;}
            if(av.legL){av.legL.y=Math.sin(G.tick*0.2+av._phase)*3;}
            if(av.legR){av.legR.y=-Math.sin(G.tick*0.2+av._phase)*3;}
        });
    }
};
