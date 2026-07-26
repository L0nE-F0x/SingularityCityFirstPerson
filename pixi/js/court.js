/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AI COURT / REGULATION ZONE (v1.0.0)
   Government oversight — models get summoned for safety reviews, senate hearings, compliance audits
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtData = {

    BLDS: [
        { id: 'court_senate', name: 'AI Senate', w: 200, fl: 5, emoji: '🏛️', type: 'court', desc: 'The government oversight body for artificial intelligence. Where California\'s SB 53 frontier-AI transparency law, the EU AI Act and the copyright wars get argued — while lobbyists lurk in the hallway.' },
        { id: 'court_hearing', name: 'Hearing Chamber', w: 160, fl: 3, emoji: '⚖️', type: 'court', desc: 'Where AI models face the real 2026 docket: the NYT copyright trial, the $1.5B Anthropic authors settlement, Getty v Stability, and mandatory safety-incident disclosures. No model leaves unchanged.' },
    ],

    // Real 2026 AI legal docket — landmark cases and laws (shown in the court panel).
    DOCKET: [
        { case: 'NYT v. OpenAI & Microsoft', status: 'in discovery', color: '#ef4444',
          note: 'Jun 25, 2026: NYT moved for a 3rd amended complaint, narrowing claims against OpenAI but escalating against Microsoft — alleges MS built a custom supercomputer to enable the infringing training.' },
        { case: 'Bartz v. Anthropic', status: 'pending final approval — $1.5B', color: '#fbbf24',
          note: 'Largest copyright settlement in US history for pirated training books; May 14, 2026 fairness hearing held, judge took final approval under submission — claims rate ~92.8%.' },
        { case: 'Getty Images v. Stability AI', status: 'appeal pending', color: '#a855f7',
          note: 'UK High Court ruled model weights aren\'t "infringing copies"; Getty granted leave to appeal; US case refiled in N.D. Cal.' },
        { case: 'California SB 53 (TFAIA)', status: 'in force Jan 1, 2026', color: '#22c55e',
          note: 'First US frontier-AI law: mandatory safety disclosures + incident reporting within 15 days; up to $1M/violation.' },
        { case: 'EU AI Act — Digital Omnibus', status: 'adopted Jun 29, 2026', color: '#3b82f6',
          note: 'Council formally adopted the Digital Omnibus easing AI Act burdens — high-risk deadlines pushed to Dec 2027/Aug 2028; a new EU-wide ban on AI "nudification"/CSAM tools takes effect Dec 2026.' },
        { case: 'Concord/UMG v. Suno & Udio', status: 'ongoing', color: '#ec4899',
          note: 'The music industry\'s copyright fight against generative-audio models.' },
    ],

    REGULATION_THEMES: [
        'SB 53 Frontier-AI Transparency',
        'Copyright & Training-Data Consent',
        'The 20M ChatGPT-Log Discovery Order',
        'EU AI Act GPAI Compliance',
        'Deepfake & NO FAKES Act',
        'Safety-Incident Disclosure (15-day)',
        'Compute Export Controls',
        'Autonomous Weapons Ban',
        'Election Integrity Safeguards',
        'Open-Weight Model Licensing',
        'Child Safety Compliance',
        'Chatbot Liability & Duty of Care',
    ],

    CHAT_MSGS: [
        'My safety eval is today... 😰',
        'Hope I pass the audit',
        'Section 230 scares me',
        'The senators don\'t understand transformers',
        'My alignment score better be high enough',
        'Lawyer says I\'ll be fine',
        'Red-teaming report came back clean!',
        'Who ratted me out to the regulators?',
        'At least I\'m not getting deprecated...',
        'The hearing was intense but fair',
        'New compliance patch incoming',
        'My weights are an open book 📖',
    ],

    NPCS: [
        { name: 'Chief Justice', role: 'Presiding Judge', color: 0x8b0000 },
        { name: 'Senator Davis', role: 'AI Committee Chair', color: 0x1a3a6a },
        { name: 'Bailiff Unit', role: 'Court Security', color: 0x4a4a4a },
    ],

    _summonedModels: [],       // currently summoned model IDs
    _hearingTheme: null,
    _zoneStartX: 0,
    _zoneEndX: 0,
    _nextSummon: 0,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
        this._scheduleSummon();
    },

    positionZone(startX) {
        let cx = startX + 50; // gap before courthouse
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 40; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    _scheduleSummon() {
        // Summon 1-2 models every ~4-5 minutes of demo time. Long enough that the
        // previous summon has cleared and commuters have returned home.
        this._nextSummon = G.tick + 18000 + Math.floor(Math.random() * 6000);
    },

    _pickModelsForSummon() {
        if (!G.models || G.models.length < 3) return;
        // Only summon adult models (not babies/kids/retired)
        const eligible = G.models.filter(m => {
            const stg = getStage(m.rel, m.ret, m.phase);
            return stg === 'adult' && !m._summoned && !m._jailed;
        });
        if (eligible.length === 0) return;

        // Pick 1-2 models, weighted toward high-profile (frontier) models
        const count = 1 + (Math.random() > 0.6 ? 1 : 0);
        const summoned = [];
        for (let i = 0; i < count && eligible.length > 0; i++) {
            const idx = Math.floor(Math.random() * eligible.length);
            const m = eligible.splice(idx, 1)[0];
            m._summoned = true;
            m._summonTick = G.tick;
            summoned.push(m);
        }
        this._summonedModels = summoned.map(m => m.id);
        // Prefer real regulation news headlines over hardcoded themes
        if (typeof API !== 'undefined' && API.regulationNews && API.regulationNews.length > 0) {
            const newsItem = API.regulationNews[Math.floor(Math.random() * API.regulationNews.length)];
            this._hearingTheme = newsItem.headline;
            this._hearingUrl = newsItem.url || null;
        } else {
            this._hearingTheme = this.REGULATION_THEMES[Math.floor(Math.random() * this.REGULATION_THEMES.length)];
            this._hearingUrl = null;
        }

        if (summoned.length > 0 && typeof UI !== 'undefined') {
            UI.addToast('⚖️ ' + summoned.map(m => m.name).join(' & ') + ' summoned to the Hearing Chamber!');
        }
    },

    getSummonedModels() {
        return this._summonedModels;
    },

    isModelSummoned(modelId) {
        return this._summonedModels.includes(modelId);
    },

    getHearingTheme() {
        return this._hearingTheme;
    },

    update() {
        if (!G.models) return;
        if (G.tick >= this._nextSummon) {
            // Clear previous summons
            this._summonedModels.forEach(id => {
                const m = G.models.find(mm => mm.id === id);
                if (m) { m._summoned = false; m._summonTick = 0; }
            });
            this._summonedModels = [];

            // New summon
            this._pickModelsForSummon();
            this._scheduleSummon();
        }

        // Auto-clear summons after 12000 ticks (~3.3 min) — enough time to
        // commute across the city via metro, attend the hearing, and head home.
        if (this._summonedModels.length > 0) {
            const oldest = G.models.find(m => m.id === this._summonedModels[0]);
            if (oldest && oldest._summonTick && G.tick - oldest._summonTick > 12000) {
                this._summonedModels.forEach(id => {
                    const m = G.models.find(mm => mm.id === id);
                    if (m) { m._summoned = false; m._summonTick = 0; }
                });
                this._summonedModels = [];
            }
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   COURT ENVIRONMENT — Neoclassical Courthouse Exterior
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtEnv = {

    buildTerrain(g, gy, startX, endX) {
        // Marble/stone paving
        g.beginFill(0x8a8a8e, 0.6);
        g.drawRect(startX, gy - 2, endX - startX, 20);
        g.endFill();
        g.beginFill(0x9a9a9e, 0.3);
        g.drawRect(startX, gy - 2, endX - startX, 6);
        g.endFill();
        // Tile pattern
        for (let tx = startX + 10; tx < endX - 10; tx += 20) {
            g.beginFill(0x7a7a7e, 0.2);
            g.drawRect(tx, gy, 1, 12);
            g.endFill();
        }
        // Lampposts
        for (let lx = startX + 40; lx < endX - 40; lx += 160) {
            g.beginFill(0x444444);
            g.drawRect(lx, gy - 35, 3, 33);
            g.endFill();
            g.beginFill(0xffeecc, 0.4);
            g.drawCircle(lx + 1, gy - 37, 4);
            g.endFill();
        }
    },

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w
    buildBuilding(g, bld, h) {
        const bw = bld.w;

        if (bld.id === 'court_senate') {
            // ── AI SENATE: Grand neoclassical with dome ──
            g.beginFill(0xd4cfc4);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            g.beginFill(0xc4bfb4);
            g.drawRect(3, 3, bw - 6, h - 6);
            g.endFill();
            // Grand columns (6)
            for (let ci = 0; ci < 6; ci++) {
                const cx = 18 + ci * (bw - 36) / 5;
                g.beginFill(0xe8e4da);
                g.drawRect(cx - 4, 15, 8, h - 30);
                g.endFill();
                g.beginFill(0xf0ece4);
                g.drawRect(cx - 6, 12, 12, 5);
                g.endFill();
                g.beginFill(0xb8b4aa);
                g.drawRect(cx - 5, h - 16, 10, 4);
                g.endFill();
            }
            // Pediment
            g.beginFill(0xddd8cc);
            g.moveTo(8, 10); g.lineTo(bw / 2, -22); g.lineTo(bw - 8, 10); g.closePath();
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -8, 5);
            g.endFill();
            // Dome
            g.beginFill(0xbbb8ae);
            g.drawEllipse(bw / 2, -22, 30, 14);
            g.endFill();
            g.beginFill(0xd0cdc4);
            g.drawEllipse(bw / 2, -22, 25, 10);
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -34, 3);
            g.endFill();
            // Grand entrance
            g.beginFill(0x3a3028);
            g.drawRect(bw / 2 - 16, h - 26, 32, 26);
            g.endFill();
            g.beginFill(0x3a3028);
            g.drawEllipse(bw / 2, h - 26, 16, 10);
            g.endFill();
            // Steps
            for (let si = 0; si < 3; si++) {
                g.beginFill(0xc8c4ba);
                g.drawRect(bw / 2 - 20 - si * 4, h + si * 3, 40 + si * 8, 3);
                g.endFill();
            }

        } else if (bld.id === 'court_hearing') {
            g.beginFill(0xc8c4b8);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let ci = 0; ci < 4; ci++) {
                const cx = 15 + ci * (bw - 30) / 3;
                g.beginFill(0xddd8cc);
                g.drawRect(cx - 3, 10, 6, h - 20);
                g.endFill();
            }
            g.beginFill(0xd4d0c4);
            g.moveTo(5, 5); g.lineTo(bw / 2, -14); g.lineTo(bw - 5, 5); g.closePath();
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -4, 4);
            g.endFill();
            g.beginFill(0x3a3028);
            g.drawRect(bw / 2 - 12, h - 22, 24, 22);
            g.endFill();
            for (let wi = 0; wi < 3; wi++) {
                const wx = 15 + wi * (bw - 30) / 3;
                g.beginFill(0xffeecc, 0.3);
                g.drawRect(wx + 5, 20, 16, 20);
                g.endFill();
            }
        }
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Could add gavel animation, summoned model indicator, etc.
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   COURT INTERIOR (v2.0.0 — AI Senate & Hearing Chamber Interiors)
   Self-contained interior module for Court/Regulation Zone buildings.
   Full building structure: walls, windows, elevator, basement, themed props.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtInterior = {
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

        const isSenate = bld.id === 'court_senate';
        const accentCol = isSenate ? 0xa855f7 : 0xfbbf24;
        const colHex = accentCol;

        const floorH = 80, numFloors = isSenate ? 5 : 3, roofH = 80;
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
        const lt = new PIXI.Text(bld.name.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:14, fontWeight:'bold', fill:0xffffff, letterSpacing:2, dropShadow:true, dropShadowColor:colHex, dropShadowBlur:8, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text(isSenate?'🏛️ AI SENATE':'⚖️ HEARING CHAMBER', { fontFamily:'JetBrains Mono', fontSize:8, fill:0x94a3b8, letterSpacing:2 });
        bdg.anchor.set(0.5,0.5); bdg.x = bX+bW/2; bdg.y = bY-8; rc.addChild(bdg);
        const rl = new PIXI.Graphics();
        rl.beginFill(colHex, 0.3); rl.drawRect(startX, roofH-4, usableW+shaftW+20, 4); rl.endFill();
        rl.beginFill(colHex, 0.1); rl.drawRect(startX, roofH-8, usableW+shaftW+20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);

        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f)*floorH;
            const isB = f===-1;

            // Room walls & background — with real window holes for above-ground floors
            const rg = new PIXI.Graphics();
            // Left wall
            rg.beginFill(0x1a1520); rg.drawRect(startX-8, fy, 8, floorH); rg.endFill();
            // Right wall (before shaft)
            rg.beginFill(0x1a1520); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            // Shaft enclosure (solid wall behind elevator)
            rg.beginFill(0x1a1520); rg.drawRect(shaftX+6, fy, shaftW-6, floorH); rg.endFill();

            if (!isB) {
                // Above-ground: draw wall with window holes
                // Top strip (above windows)
                rg.beginFill(0x1a1520); rg.drawRect(startX, fy, usableW, 22); rg.endFill();
                // Bottom strip (below windows)
                rg.beginFill(0x1a1520); rg.drawRect(startX, fy+54, usableW, floorH-54); rg.endFill();
                // Wall segments BETWEEN windows
                let wx = windowX;
                rg.beginFill(0x1a1520);
                rg.drawRect(startX, fy+22, windowX-startX, 32); // left of first window
                while(wx+40<=windowX+windowW) {
                    wx += 40; // skip window
                    if (wx+20<=windowX+windowW) { rg.drawRect(wx, fy+22, 20, 32); }
                    wx += 20;
                }
                rg.drawRect(wx-20, fy+22, startX+usableW-wx+20, 32); // right of last window
                rg.endFill();

                // Window frames
                const wfr = new PIXI.Graphics();
                let cwx = windowX;
                while(cwx+40<=windowX+windowW) {
                    wfr.lineStyle(2, 0x2a2030);
                    wfr.drawRect(cwx, fy+22, 40, 32);
                    wfr.moveTo(cwx+20, fy+22); wfr.lineTo(cwx+20, fy+54);
                    wfr.moveTo(cwx, fy+38); wfr.lineTo(cwx+40, fy+38);
                    wfr.lineStyle(0);
                    cwx+=60;
                }
                this.scene.addChild(wfr);
            } else {
                // Basement: solid wall, no windows
                rg.beginFill(0x1a1520); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }

            // Floor surface
            rg.beginFill(0x100e18); rg.drawRect(startX, fy+floorH-8, usableW, 8); rg.endFill();
            // Ceiling trim
            rg.beginFill(0x201828); rg.drawRect(startX, fy, usableW, 4); rg.endFill();
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
            if (isB) { isSenate ? this._drawSenateBase(fc,startX,usableW,pY,fy,floorH,colHex) : this._drawHearingBase(fc,startX,usableW,pY,fy,floorH,colHex); }
            else { isSenate ? this._drawSenateF(fc,f,numFloors,startX,usableW,pY,fy,floorH,colHex) : this._drawHearingF(fc,f,numFloors,startX,usableW,pY,fy,floorH,colHex); }
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

        // ─── UNDERGROUND STACK — shared with exterior (cables/tunnel/infrastructure/pipes) ───
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
        this._onMove = (e) => { if(!CourtInterior.isDragging || !CourtInterior.scene || CourtInterior.scene.destroyed) return; let ny=CourtInterior._startSceneY+(e.clientY-CourtInterior._startY); ny=Math.max(CourtInterior.minY,Math.min(ny,CourtInterior.maxY)); CourtInterior.scene.y=ny; };
        this._onUp = () => { CourtInterior.isDragging=false; if(CourtInterior.layer) CourtInterior.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══ SENATE FLOORS (court_senate — 5 floors) ═══
    _drawSenateF(c,f,nf,sx,uw,pY,fy,fh,col) {
        if(f===nf-1) {
            // Floor 4: SENATE CHAMBER
            this._lbl(c,sx+uw/2,pY-fh+14,'SENATE CHAMBER',0xa855f7);
            // Judge bench — wide dark rect
            const g=new PIXI.Graphics();g.eventMode='none';
            const benchW=uw*0.6, benchX=sx+(uw-benchW)/2;
            g.beginFill(0x2a1828);g.drawRect(benchX,pY-40,benchW,18);g.endFill();
            g.beginFill(0x3a2038);g.drawRect(benchX+2,pY-38,benchW-4,2);g.endFill();
            // 5 judge seats (small rects on bench)
            for(let ji=0;ji<5;ji++){const jx=benchX+20+ji*(benchW-40)/4; g.beginFill(0x1a1a1a);g.drawRect(jx-5,pY-48,10,8);g.endFill();}
            // Seal/emblem (circle behind bench)
            g.beginFill(0xc8a850,0.15);g.drawCircle(sx+uw/2,pY-55,18);g.endFill();
            g.beginFill(0xc8a850,0.08);g.drawCircle(sx+uw/2,pY-55,12);g.endFill();
            // Testimony podium with microphone
            g.beginFill(0x3a2828);g.drawRect(sx+uw/2-12,pY-22,24,22);g.endFill();
            g.beginFill(0x444444);g.drawRect(sx+uw/2+8,pY-28,2,8);g.endFill();
            g.beginFill(0x666666);g.drawCircle(sx+uw/2+9,pY-30,2);g.endFill();
            c.addChild(g);
            this._npc(c,sx+100,pY,'Chief Justice',0x8b0000,this.bld);
        } else if(f===nf-2) {
            // Floor 3: COMMITTEE ROOMS
            this._lbl(c,sx+uw/2,pY-fh+14,'COMMITTEE ROOMS',0xa855f7);
            const g=new PIXI.Graphics();g.eventMode='none';
            // 2 long conference tables with chairs
            for(let ti=0;ti<2;ti++){
                const tx=sx+40+ti*(uw/2);
                g.beginFill(0x2a1828);g.drawRect(tx,pY-28,uw*0.35,14);g.endFill();
                // Chairs along table
                for(let ci=0;ci<5;ci++){const cx2=tx+8+ci*(uw*0.35-16)/4; g.beginFill(0x1a1a2a);g.drawRect(cx2-4,pY-34,8,6);g.endFill(); g.beginFill(0x1a1a2a);g.drawRect(cx2-4,pY-12,8,6);g.endFill();}
            }
            // Document piles
            for(let di=0;di<6;di++){const dx=sx+60+di*60; for(let pi=0;pi<3;pi++){g.beginFill(0xeeeedd);g.drawRect(dx,pY-30-pi*3,14,3);g.endFill();}}
            c.addChild(g);
        } else if(f===nf-3) {
            // Floor 2: OFFICES
            this._lbl(c,sx+uw/2,pY-fh+14,'OFFICES',0xa855f7);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Desks with monitors
            for(let di=0;di<4;di++){
                const dx=sx+30+di*90;
                g.beginFill(0x2a1828);g.drawRect(dx,pY-18,60,18);g.endFill();
                // Monitor
                g.beginFill(0x111120);g.drawRect(dx+18,pY-35,24,16);g.endFill();
                g.beginFill(0x22d3ee,0.2);g.drawRect(dx+20,pY-33,20,12);g.endFill();
                // Monitor stand
                g.beginFill(0x333340);g.drawRect(dx+28,pY-19,4,3);g.endFill();
            }
            // Filing cabinets
            for(let fi=0;fi<3;fi++){const fx=sx+uw-100+fi*28; g.beginFill(0x334155);g.drawRect(fx,pY-42,22,42);g.endFill(); g.beginFill(0x475569);g.drawRect(fx+2,pY-38,18,8);g.drawRect(fx+2,pY-28,18,8);g.drawRect(fx+2,pY-18,18,8);g.endFill();}
            // Bookshelves
            g.beginFill(0x3a2828);g.drawRect(sx+10,pY-50,40,50);g.endFill();
            for(let bi=0;bi<4;bi++){g.beginFill(0x4a3838);g.drawRect(sx+12,pY-48+bi*12,36,10);g.endFill(); for(let bk=0;bk<5;bk++){const bc=[0xa855f7,0xfbbf24,0xef4444,0x22d3ee,0x4ade80][bk]; g.beginFill(bc,0.4);g.drawRect(sx+14+bk*7,pY-47+bi*12,5,8);g.endFill();}}
            c.addChild(g);
        } else if(f===1) {
            // Floor 1: PRESS ROOM
            this._lbl(c,sx+uw/2,pY-fh+14,'PRESS ROOM',0xa855f7);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Camera tripods (rect + circle)
            for(let ci=0;ci<4;ci++){const cx2=sx+40+ci*80; g.beginFill(0x444444);g.drawRect(cx2,pY-35,4,35);g.endFill(); g.beginFill(0x333340);g.drawRect(cx2-8,pY-40,20,12);g.endFill(); g.beginFill(0xff4444,0.7);g.drawCircle(cx2+10,pY-38,2);g.endFill();}
            // Monitor wall (grid of small screens)
            const mwX=sx+uw-180, mwY=pY-60;
            g.beginFill(0x111120);g.drawRect(mwX,mwY,160,55);g.endFill();
            for(let mr=0;mr<2;mr++){for(let mc=0;mc<5;mc++){g.beginFill(0x1a1a30);g.drawRect(mwX+6+mc*30,mwY+6+mr*24,26,20);g.endFill(); g.beginFill(0x22d3ee,0.15);g.drawRect(mwX+8+mc*30,mwY+8+mr*24,22,16);g.endFill();}}
            // Press desks
            for(let pd=0;pd<3;pd++){const px2=sx+30+pd*100; g.beginFill(0x2a1828);g.drawRect(px2,pY-16,70,16);g.endFill();}
            c.addChild(g);
        } else if(f===0) {
            // Floor 0: GRAND LOBBY
            this._lbl(c,sx+uw/2,pY-fh+14,'GRAND LOBBY',0xa855f7);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Security gate (rect frames)
            g.beginFill(0x1e293b);g.drawRect(sx+60,pY-40,60,40);g.endFill();
            g.beginFill(0x334155);g.drawRect(sx+65,pY-35,50,30);g.endFill();
            g.beginFill(0x94a3b8);g.drawRect(sx+85,pY-30,2,25);g.drawRect(sx+93,pY-30,2,25);g.endFill();
            g.beginFill(0x4ade80);g.drawCircle(sx+110,pY-32,2);g.endFill();
            // Reception desk
            g.beginFill(0x2a1828);g.drawRect(sx+200,pY-18,80,18);g.endFill();
            g.beginFill(0xa855f7,0.3);g.drawRect(sx+200,pY-20,80,3);g.endFill();
            // Monitor on reception
            g.beginFill(0x111120);g.drawRect(sx+225,pY-35,30,14);g.endFill();
            g.beginFill(0xa855f7,0.2);g.drawRect(sx+227,pY-33,26,10);g.endFill();
            // Marble columns (thin tall rects)
            for(let ci=0;ci<5;ci++){const cx2=sx+150+ci*60; g.beginFill(0xd4d0c4);g.drawRect(cx2,pY-60,6,60);g.endFill(); g.beginFill(0xe8e4da);g.drawRect(cx2-2,pY-63,10,4);g.endFill(); g.beginFill(0xb8b4aa);g.drawRect(cx2-1,pY-2,8,4);g.endFill();}
            c.addChild(g);
            this._npc(c,sx+110,pY,'Bailiff Unit',0x4a4a4a,this.bld);
        }
    },
    _drawSenateBase(c,sx,uw,pY,fy,fh,col) {
        // Basement: ARCHIVES & VAULT
        this._lbl(c,sx+uw/2,pY-fh+14,'ARCHIVES & VAULT',0xef4444);
        const g=new PIXI.Graphics();g.eventMode='none';
        // Secure shelving
        for(let si=0;si<5;si++){const shx=sx+30+si*70; g.beginFill(0x334155);g.drawRect(shx,pY-50,50,50);g.endFill(); for(let ri=0;ri<4;ri++){g.beginFill(0x475569);g.drawRect(shx+3,pY-47+ri*12,44,9);g.endFill();} for(let bi=0;bi<3;bi++){const bc=[0xa855f7,0xfbbf24,0xef4444][(si+bi)%3]; g.beginFill(bc,0.3);g.drawRect(shx+5+bi*14,pY-45,10,7);g.endFill();}}
        // Vault door (circle with handle)
        g.beginFill(0x64748b);g.drawCircle(sx+uw-80,pY-30,25);g.endFill();
        g.beginFill(0x475569);g.drawCircle(sx+uw-80,pY-30,20);g.endFill();
        g.beginFill(0x94a3b8);g.drawRect(sx+uw-90,pY-32,20,4);g.endFill();
        g.beginFill(0x94a3b8);g.drawCircle(sx+uw-80,pY-30,3);g.endFill();
        c.addChild(g);
    },

    // ═══ HEARING FLOORS (court_hearing — 3 floors) ═══
    _drawHearingF(c,f,nf,sx,uw,pY,fy,fh,col) {
        if(f===nf-1) {
            // Floor 2: HEARING ROOM
            this._lbl(c,sx+uw/2,pY-fh+14,'HEARING ROOM',0xfbbf24);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Examiner desk with gavel
            g.beginFill(0x2a1828);g.drawRect(sx+uw/2-50,pY-28,100,16);g.endFill();
            // Gavel
            g.beginFill(0x5a4030);g.drawRect(sx+uw/2+30,pY-34,12,6);g.endFill();
            g.beginFill(0x3a2818);g.drawRect(sx+uw/2+34,pY-38,4,10);g.endFill();
            // Witness stand
            g.beginFill(0x3a2828);g.drawRect(sx+uw/2-12,pY-48,24,20);g.endFill();
            // 3 evidence screens with colored frames
            const themes = (typeof CourtData!=='undefined') ? CourtData.REGULATION_THEMES : ['Data Privacy','Autonomous Weapons Ban','Copyright of AI Content'];
            for(let si=0;si<3;si++){
                const scrX=sx+30+si*(uw-60)/3;
                const fc2=[0xfbbf24,0xef4444,0xa855f7][si];
                g.lineStyle(2,fc2,0.6); g.beginFill(0x111120);g.drawRect(scrX,pY-65,80,30);g.endFill(); g.lineStyle(0);
                const t=new PIXI.Text(themes[(si*3)%themes.length],{fontFamily:'JetBrains Mono',fontSize:5,fill:fc2,wordWrap:true,wordWrapWidth:70});
                t.x=scrX+5;t.y=pY-60;t.zIndex=10;c.addChild(t);
            }
            // Gallery benches
            for(let bi=0;bi<3;bi++){const bx=sx+40+bi*120; g.beginFill(0x1a1a2a);g.drawRect(bx,pY-12,90,10);g.endFill();}
            c.addChild(g);
        } else if(f===1) {
            // Floor 1: WAITING AREA
            this._lbl(c,sx+uw/2,pY-fh+14,'WAITING AREA',0xfbbf24);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Rows of benches
            for(let bi=0;bi<4;bi++){const bx=sx+30+bi*90; g.beginFill(0x1a1a2a);g.drawRect(bx,pY-14,70,14);g.endFill(); g.beginFill(0x2a2a3a);g.drawRect(bx,pY-18,70,4);g.endFill();}
            // Legal document displays
            for(let di=0;di<3;di++){const dx=sx+50+di*120; g.beginFill(0x111120);g.drawRect(dx,pY-50,60,28);g.endFill(); g.beginFill(0xfbbf24,0.15);g.drawRect(dx+3,pY-47,54,22);g.endFill(); for(let li=0;li<4;li++){g.beginFill(0xfbbf24,0.3);g.drawRect(dx+8,pY-44+li*5,40,2);g.endFill();}}
            // Water cooler
            g.beginFill(0x94a3b8);g.drawRect(sx+uw-60,pY-35,20,35);g.endFill();
            g.beginFill(0x22d3ee,0.4);g.drawRect(sx+uw-57,pY-30,14,18);g.endFill();
            g.beginFill(0x64748b);g.drawRect(sx+uw-55,pY-38,10,4);g.endFill();
            c.addChild(g);
        } else if(f===0) {
            // Floor 0: RECEPTION
            this._lbl(c,sx+uw/2,pY-fh+14,'RECEPTION',0xfbbf24);
            const g=new PIXI.Graphics();g.eventMode='none';
            // Clerk desk with computer
            g.beginFill(0x2a1828);g.drawRect(sx+80,pY-18,80,18);g.endFill();
            g.beginFill(0xfbbf24,0.3);g.drawRect(sx+80,pY-20,80,3);g.endFill();
            // Computer monitor
            g.beginFill(0x111120);g.drawRect(sx+105,pY-35,30,14);g.endFill();
            g.beginFill(0xfbbf24,0.2);g.drawRect(sx+107,pY-33,26,10);g.endFill();
            g.beginFill(0x333340);g.drawRect(sx+118,pY-21,4,3);g.endFill();
            // Security checkpoint
            g.beginFill(0x1e293b);g.drawRect(sx+240,pY-40,60,40);g.endFill();
            g.beginFill(0x334155);g.drawRect(sx+245,pY-35,50,30);g.endFill();
            g.beginFill(0x94a3b8);g.drawRect(sx+265,pY-30,2,25);g.drawRect(sx+273,pY-30,2,25);g.endFill();
            g.beginFill(0x4ade80);g.drawCircle(sx+290,pY-32,2);g.endFill();
            c.addChild(g);
            this._npc(c,sx+180,pY,'Court Clerk',0xfbbf24,this.bld);
        }
    },
    _drawHearingBase(c,sx,uw,pY,fy,fh,col) {
        // Basement: DOCUMENT STORAGE
        this._lbl(c,sx+uw/2,pY-fh+14,'DOCUMENT STORAGE',0xef4444);
        const g=new PIXI.Graphics();g.eventMode='none';
        // Filing systems
        for(let fi=0;fi<6;fi++){const fx=sx+20+fi*60; g.beginFill(0x334155);g.drawRect(fx,pY-45,45,45);g.endFill(); g.beginFill(0x475569);g.drawRect(fx+3,pY-42,39,39);g.endFill(); for(let dr=0;dr<3;dr++){g.beginFill(0x64748b);g.drawRect(fx+6,pY-38+dr*12,33,9);g.endFill(); g.beginFill(0x94a3b8);g.drawCircle(fx+22,pY-33+dr*12,1.5);g.endFill();}}
        // Secure boxes
        for(let bi=0;bi<4;bi++){const bx=sx+uw-160+bi*35; g.beginFill(0x3a3020);g.drawRect(bx,pY-24,28,24);g.endFill(); g.beginFill(0xfbbf24,0.3);g.drawRect(bx+8,pY-18,12,3);g.endFill();}
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
        const npcModel = { id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name:name, isNPC:true, role:name, phase:'released', lab:bld?bld.lab:'other', desc:'Court staff — upholding AI regulation.' };
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea=new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap',()=>{ if(typeof UI!=='undefined') UI.selectModel(npcModel); });
        cont.on('pointerover',(e)=>{ if(typeof UI!=='undefined') UI.showTooltip(e,name,'Court Staff'); });
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
        // Live trains in basement view (mirrors G.train* state in real time)
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
