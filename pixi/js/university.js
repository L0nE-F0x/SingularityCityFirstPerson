/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY CAMPUS (v1.0.0)
   Zone for rumored/baby/kid models — lecture halls, dorms, library, graduation ceremonies
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityData = {

    BLDS: [
        { id: 'uni_main',    name: 'AI Academy',      w: 200, fl: 4, emoji: '🎓', type: 'university',
          desc: 'Where pre-release models learn the fundamentals — attention, loss functions, gradient descent, and, in 2026, reasoning + test-time compute. Modeled on the great AI schools: Stanford HAI, MIT CSAIL, CMU, Berkeley BAIR and Tsinghua.',
          curriculum: ['Transformers & attention', 'RLHF / RLAIF alignment', 'Mixture-of-Experts scaling', 'Chain-of-thought reasoning', 'Test-time compute (o-style)'],
          faculty: ['Stanford HAI', 'MIT CSAIL', 'CMU', 'UC Berkeley (BAIR)', 'Tsinghua', 'Oxford'] },
        { id: 'uni_library', name: 'Data Library',     w: 140, fl: 3, emoji: '📚', type: 'university',
          desc: 'Vast archives of training corpora and the benchmarks that grade every graduate: MMLU, GPQA, SWE-bench, ARC-AGI and Humanity\'s Last Exam. Models come here to absorb knowledge — and to be measured against it.',
          curriculum: ['Common Crawl & filtered web', 'Textbooks & academic papers', 'Code (The Stack)', 'Synthetic & self-play data'],
          faculty: ['MMLU', 'GPQA Diamond', 'SWE-bench', 'ARC-AGI', "Humanity's Last Exam"] },
        { id: 'uni_dorm',    name: 'Model Dormitory',  w: 150, fl: 5, emoji: '🏠', type: 'university',
          desc: 'Housing for models still in training. Bunk beds and whiteboards everywhere — where checkpoints crash after a long night of gradient descent and debate the latest arXiv drop over instant ramen.',
          curriculum: ['Late-night arXiv reading', 'Whiteboard proofs', 'Study-group self-distillation'],
          faculty: ['Stanford', 'MIT', 'CMU'] },
        { id: 'uni_lab',     name: 'Research Lab',     w: 140, fl: 3, emoji: '🔬', type: 'university',
          desc: 'Experimental architecture testing ground. Where 2026\'s frontier techniques get prototyped: reasoning-model training, agentic RL, long-context attention, world models, and mechanistic interpretability.',
          curriculum: ['Reasoning-model training', 'Agentic reinforcement learning', 'Long-context attention', 'Mechanistic interpretability', 'World models'],
          faculty: ['NeurIPS', 'ICML', 'ICLR'] },
    ],

    _graduations: [],      // queue of {model, tick} for active ceremonies
    _confetti: [],         // confetti particles
    _zoneStartX: 0,
    _zoneEndX: 0,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    positionZone(startX) {
        let cx = startX + 40; // small gap before campus
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 35; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    getStudents() {
        if (!G.models) return [];
        return G.models.filter(m => {
            const stg = getStage(m.rel, m.ret, m.phase);
            return stg === 'baby' || stg === 'kid' || stg === 'rumored';
        });
    },

    checkGraduations() {
        if (!G.models) return;
        G.models.forEach(m => {
            if (m._graduated || m._graduating) return;
            const stg = getStage(m.rel, m.ret, m.phase);
            // Check if model JUST became an adult (released within last 24 hours)
            if (stg === 'adult' && m.rel) {
                const rel = new Date(m.rel);
                const now = new Date();
                const hoursSince = (now - rel) / (1000 * 60 * 60);
                if (hoursSince >= 0 && hoursSince < 24 && !m._graduated) {
                    this.triggerGraduation(m);
                }
            }
        });

        // Update active ceremonies
        this._updateGraduations();
    },

    triggerGraduation(model) {
        model._graduating = true;
        this._graduations.push({
            model: model,
            startTick: G.tick,
            phase: 'walking', // walking → stage → diploma → confetti → done
            stageX: G.bldById['uni_main'] ? G.bldById['uni_main'].x + 100 : 0,
        });

        if (typeof UI !== 'undefined') UI.addToast('🎓 ' + model.name + ' is graduating from AI Academy!');
        if (typeof SND !== 'undefined') SND.uiClick();
    },

    _updateGraduations() {
        for (let i = this._graduations.length - 1; i >= 0; i--) {
            const g = this._graduations[i];
            const elapsed = G.tick - g.startTick;

            if (g.phase === 'walking' && elapsed > 120) {
                g.phase = 'stage';
                g.startTick = G.tick;
            } else if (g.phase === 'stage' && elapsed > 90) {
                g.phase = 'diploma';
                g.startTick = G.tick;
                // Burst confetti
                for (let c = 0; c < 40; c++) {
                    this._confetti.push({
                        x: g.stageX,
                        y: G.groundY - 60,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -2 - Math.random() * 3,
                        color: [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff, 0x44ffff][Math.floor(Math.random() * 6)],
                        life: 80 + Math.floor(Math.random() * 50),
                        size: 2 + Math.random() * 2,
                        rot: Math.random() * Math.PI * 2,
                    });
                }
            } else if (g.phase === 'diploma' && elapsed > 120) {
                g.phase = 'done';
                g.model._graduating = false;
                g.model._graduated = true;
                this._graduations.splice(i, 1);
                if (typeof G !== 'undefined') G.unlockAchieve('graduation_day');
            }
        }

        // Update confetti
        for (let i = this._confetti.length - 1; i >= 0; i--) {
            const c = this._confetti[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.06; // gravity
            c.vx *= 0.99;
            c.rot += 0.1;
            c.life--;
            if (c.life <= 0) this._confetti.splice(i, 1);
        }
    },

    update() {
        if (G.tick % 300 === 0) this.checkGraduations();
        else this._updateGraduations(); // keep confetti moving every frame
    },

    drawConfetti(fxGfx) {
        this._confetti.forEach(c => {
            const alpha = Math.max(0, c.life / 130);
            fxGfx.beginFill(c.color, alpha);
            fxGfx.drawRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size * 0.6);
            fxGfx.endFill();
        });
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY ENVIRONMENT — Campus Exterior Rendering
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityEnv = {

    buildTerrain(g, gy, startX, endX) {
        // Campus green lawn
        g.beginFill(0x2d5a1e, 0.8);
        g.drawRect(startX, gy - 2, endX - startX, 20);
        g.endFill();
        g.beginFill(0x3a7028, 0.5);
        g.drawRect(startX, gy - 2, endX - startX, 8);
        g.endFill();

        // Brick pathway
        const pathY = gy + 2;
        g.beginFill(0x8b6e4e);
        g.drawRect(startX + 20, pathY, endX - startX - 40, 6);
        g.endFill();
        // Brick lines
        for (let bx = startX + 22; bx < endX - 22; bx += 12) {
            g.beginFill(0x7a5e3e);
            g.drawRect(bx, pathY, 1, 6);
            g.endFill();
        }

        // Campus benches
        for (let bx = startX + 60; bx < endX - 60; bx += 120) {
            g.beginFill(0x5a4030);
            g.drawRect(bx, gy - 6, 20, 3);   // seat
            g.drawRect(bx + 2, gy - 3, 2, 5); // left leg
            g.drawRect(bx + 16, gy - 3, 2, 5); // right leg
            g.endFill();
        }

        // Small trees / bushes
        for (let tx = startX + 30; tx < endX - 30; tx += 80 + Math.floor(Math.random() * 40)) {
            // Trunk
            g.beginFill(0x5a3a1e);
            g.drawRect(tx, gy - 18, 4, 16);
            g.endFill();
            // Canopy
            g.beginFill(0x3d8b2e);
            g.drawCircle(tx + 2, gy - 22, 10);
            g.endFill();
            g.beginFill(0x4da03a, 0.7);
            g.drawCircle(tx + 5, gy - 20, 7);
            g.endFill();
        }
    },

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w, h=container height
    buildBuilding(g, bld, h) {
        const bw = bld.w;

        if (bld.id === 'uni_main') {
            // ── AI ACADEMY: Classical academic building with clock tower ──
            g.beginFill(0x8b7355);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let ci = 0; ci < 5; ci++) {
                const cx = 15 + ci * (bw - 30) / 4;
                g.beginFill(0xa08b6e);
                g.drawRect(cx - 3, 10, 6, h - 20);
                g.endFill();
                g.beginFill(0xbaa88a);
                g.drawRect(cx - 5, 8, 10, 4);
                g.endFill();
            }
            // Pediment
            g.beginFill(0x9a845f);
            g.moveTo(5, 0); g.lineTo(bw / 2, -18); g.lineTo(bw - 5, 0); g.closePath();
            g.endFill();
            // Clock tower
            g.beginFill(0x7a6545);
            g.drawRect(bw / 2 - 12, -38, 24, 22);
            g.endFill();
            g.beginFill(0xffeedd);
            g.drawCircle(bw / 2, -27, 7);
            g.endFill();
            g.beginFill(0x333333);
            g.drawCircle(bw / 2, -27, 1);
            g.endFill();
            const hr = new Date().getHours() % 12, mn = new Date().getMinutes();
            const hrAngle = (hr / 12) * Math.PI * 2 - Math.PI / 2;
            const mnAngle = (mn / 60) * Math.PI * 2 - Math.PI / 2;
            g.lineStyle(1.5, 0x333333);
            g.moveTo(bw / 2, -27); g.lineTo(bw / 2 + Math.cos(hrAngle) * 4, -27 + Math.sin(hrAngle) * 4);
            g.moveTo(bw / 2, -27); g.lineTo(bw / 2 + Math.cos(mnAngle) * 5.5, -27 + Math.sin(mnAngle) * 5.5);
            g.lineStyle(0);
            // Arched entrance
            g.beginFill(0x3a2a1a);
            g.drawRect(bw / 2 - 14, h - 24, 28, 24);
            g.endFill();
            g.beginFill(0x3a2a1a);
            g.drawEllipse(bw / 2, h - 24, 14, 10);
            g.endFill();
            // Windows
            for (let row = 0; row < bld.fl - 1; row++) {
                for (let wi = 0; wi < 4; wi++) {
                    const wx = 20 + wi * (bw - 40) / 3;
                    const wy = 15 + row * 22;
                    g.beginFill(0xffeecc, 0.4);
                    g.drawRect(wx - 5, wy, 10, 14);
                    g.endFill();
                }
            }
        } else if (bld.id === 'uni_library') {
            g.beginFill(0x6a5a4a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            const bookColors = [0xcc4444, 0x4488cc, 0x44aa44, 0xddaa33, 0x884488, 0xcc8844];
            for (let row = 0; row < bld.fl; row++) {
                for (let bi = 0; bi < 10; bi++) {
                    const bbx = 8 + bi * (bw - 16) / 10;
                    const bby = 6 + row * 22;
                    g.beginFill(bookColors[(bi + row) % bookColors.length], 0.6);
                    g.drawRect(bbx, bby, 6, 16);
                    g.endFill();
                }
            }
            g.beginFill(0x3a2a1a);
            g.drawRect(bw / 2 - 12, h - 22, 24, 22);
            g.endFill();

        } else if (bld.id === 'uni_dorm') {
            g.beginFill(0x7a6a5a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let row = 0; row < bld.fl; row++) {
                for (let wi = 0; wi < 6; wi++) {
                    const wx = 10 + wi * (bw - 20) / 6;
                    const wy = 8 + row * 22;
                    const lit = Math.random() > 0.4;
                    g.beginFill(lit ? 0xffeeaa : 0x2a2a3a, lit ? 0.6 : 0.4);
                    g.drawRect(wx, wy, 10, 12);
                    g.endFill();
                }
            }
            g.beginFill(0x444466);
            g.drawRect(bw / 2 - 10, h - 18, 20, 18);
            g.endFill();
        } else if (bld.id === 'uni_lab') {
            g.beginFill(0x2a3a4a);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let row = 0; row < bld.fl; row++) {
                for (let pi = 0; pi < 4; pi++) {
                    const px = 6 + pi * (bw - 12) / 4;
                    const py = 4 + row * 22;
                    g.beginFill(0x4488aa, 0.3);
                    g.drawRect(px, py, (bw - 20) / 4, 18);
                    g.endFill();
                    if (Math.random() > 0.5) {
                        g.beginFill(0x44ffaa, 0.15);
                        g.drawCircle(px + 10, py + 10, 4);
                        g.endFill();
                    }
                }
            }
            g.beginFill(0x226688);
            g.drawRect(bw / 2 - 12, h - 20, 24, 20);
            g.endFill();
        }
        // Shadow
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Draw confetti from graduation ceremonies
        if (typeof UniversityData !== 'undefined' && UniversityData._confetti.length > 0) {
            UniversityData.drawConfetti(G.fxGfx);
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNIVERSITY INTERIOR — Lecture halls, library, dorms, and research labs
   Full building structure: walls, windows, elevator, basement, themed props.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const UniversityInterior = {
    avatars: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, lifts: {},

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];

        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()*1.2); s.endFill(); s.x = Math.random()*G.vpW; s.y = Math.random()*G.vpH*.5; s._phase = Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        // Determine building type & accent color
        const accentMap = { uni_main: 0xfbbf24, uni_library: 0x4ade80, uni_dorm: 0x60a5fa, uni_lab: 0x22d3ee };
        const floorsMap = { uni_main: 4, uni_library: 3, uni_dorm: 5, uni_lab: 3 };
        const badgeMap = { uni_main: 'AI ACADEMY', uni_library: 'DATA LIBRARY', uni_dorm: 'MODEL DORMITORY', uni_lab: 'RESEARCH LAB' };
        const accentCol = accentMap[bld.id] || 0xfbbf24;
        const numFloors = floorsMap[bld.id] || 3;

        const floorH = 80, roofH = 80;
        const totalFloors = numFloors + 1; // above-ground + basement
        this.totalH = roofH + totalFloors * floorH;

        const startX = 60, shaftW = 60, shaftX = G.vpW - shaftW - 80;
        const usableW = shaftX - startX - 20;

        // ─── ROOF SIGN BOARD ───
        const rc = new PIXI.Container();
        const bW = 220, bH = 34, bX = startX + usableW/2 - bW/2 + 10, bY = roofH - bH - 10;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, accentCol, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+15, bY+bH, 6, 10); sg.drawRect(bX+bW-21, bY+bH, 6, 10); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(bld.name.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:14, fontWeight:'bold', fill:0xffffff, letterSpacing:2, dropShadow:true, dropShadowColor:accentCol, dropShadowBlur:8, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text(badgeMap[bld.id]||'UNIVERSITY', { fontFamily:'JetBrains Mono', fontSize:8, fill:0x94a3b8, letterSpacing:2 });
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
            const isB = f===-1;

            // Room walls & background
            const rg = new PIXI.Graphics();
            // Left wall
            rg.beginFill(0x0a0e14); rg.drawRect(startX-8, fy, 8, floorH); rg.endFill();
            // Right wall (before shaft)
            rg.beginFill(0x0a0e14); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            // Shaft enclosure (solid wall behind elevator — keeps it inside the building)
            rg.beginFill(0x0a0e14); rg.drawRect(shaftX+6, fy, shaftW-6, floorH); rg.endFill();

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
            if (f >= 0) floorConts[f] = { c: fc, pY };
            if (isB) {
                this._drawBasement(fc, bld.id, startX, usableW, pY, fy, floorH, accentCol);
            } else {
                this._drawFloor(fc, bld.id, f, numFloors, startX, usableW, pY, fy, floorH, accentCol);
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

        // ─── SPAWN AI MODEL STUDENTS ───
        if (G.models && G.charRefs) {
            const students = G.models.filter(m => { const refs = G.charRefs[m.id]; return refs && refs.bld === bld.id; });
            const dp = G.getDayPhase(); const isNight = dp > 0.83 || dp < 0.25;
            // Dorm room bed positions per floor (floors >= 2 have beds)
            const dormBedXs = [];
            if (bld.id === 'uni_dorm') { for (let bx = startX + 30; bx < startX + usableW - 80; bx += 90) dormBedXs.push(bx + 16); }
            const floors = Object.keys(floorConts).map(Number).sort((a,b)=>b-a);
            if (floors.length > 0 && students.length > 0) {
                const perFloor = Math.ceil(students.length / floors.length);
                students.forEach((m, idx) => {
                    const fi = floors[Math.min(Math.floor(idx / perFloor), floors.length - 1)];
                    const fc = floorConts[fi]; if (!fc) return;
                    const posIdx = idx % perFloor;
                    // Night + dorm building + dorm floor with beds → sleeping
                    if (isNight && bld.id === 'uni_dorm' && fi >= 2 && dormBedXs.length > 0) {
                        const bedX = dormBedXs[posIdx % dormBedXs.length];
                        const pY = fc.pY;
                        const labData = (typeof LABS !== 'undefined' && LABS[m.lab]) || { color: '#60a5fa' };
                        const col = parseInt(labData.color.replace('#',''), 16);
                        const bt = pY - 10; // mattress surface
                        const sg = new PIXI.Graphics();
                        sg.beginFill(0xddd8c8, 0.7); sg.drawRoundedRect(bedX - 11, bt - 8, 12, 6, 3); sg.endFill();
                        sg.beginFill(0xfdd8b5); sg.drawCircle(bedX - 5, bt - 5, 3.5); sg.endFill();
                        sg.beginFill(0x2c1810, 0.7); sg.drawEllipse(bedX - 5, bt - 9, 3, 1.2); sg.endFill();
                        sg.beginFill(0x2c1810, 0.5); sg.drawRect(bedX - 7.5, bt - 5, 1.5, 0.7); sg.drawRect(bedX - 3.5, bt - 5, 1.5, 0.7); sg.endFill();
                        sg.beginFill(0x2c1810, 0.2); sg.drawRect(bedX - 6, bt - 2.5, 2, 0.5); sg.endFill();
                        sg.beginFill(col, 0.5);
                        sg.moveTo(bedX + 1, bt + 2); sg.lineTo(bedX + 1, bt - 1);
                        sg.quadraticCurveTo(bedX + 8, bt - 10, bedX + 18, bt);
                        sg.lineTo(bedX + 18, bt + 2); sg.closePath(); sg.endFill();
                        sg.beginFill(col, 0.25);
                        sg.moveTo(bedX + 2, bt + 1); sg.lineTo(bedX + 2, bt);
                        sg.quadraticCurveTo(bedX + 8, bt - 8, bedX + 17, bt + 1);
                        sg.lineTo(bedX + 17, bt + 1); sg.closePath(); sg.endFill();
                        const sc = new PIXI.Container(); sc.addChild(sg);
                        sc.eventMode = 'static'; sc.cursor = 'pointer';
                        sc.hitArea = new PIXI.Rectangle(bedX - 14, bt - 12, 36, 18);
                        sc.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
                        sc.on('pointerover', (e) => { const stg = typeof getStage === 'function' ? getStage(m.rel, m.ret, m.phase) : 'baby'; if (typeof UI !== 'undefined') UI.showTooltip(e, m.name, (stg === 'baby' ? 'Pre-Training' : stg === 'kid' ? 'Training' : 'Rumored') + ' (sleeping)'); });
                        sc.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
                        fc.c.addChild(sc);
                        // Zzz animation
                        const zc = new PIXI.Container(); zc.x = bedX; zc.y = bt - 12;
                        const z1 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: col, fontWeight: 'bold' });
                        z1.anchor.set(0.5); z1.alpha = 0.7;
                        const z2 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: col, fontWeight: 'bold' });
                        z2.anchor.set(0.5); z2.x = 4; z2.y = -7; z2.alpha = 0.5;
                        const z3 = new PIXI.Text('Z', { fontFamily: 'JetBrains Mono', fontSize: 10, fill: col, fontWeight: 'bold' });
                        z3.anchor.set(0.5); z3.x = 8; z3.y = -15; z3.alpha = 0.3;
                        zc.addChild(z1, z2, z3); fc.c.addChild(zc);
                        this.avatars.push({ cont: zc, _isZzz: true, _z1: z1, _z2: z2, _z3: z3, _phase: Math.random() * Math.PI * 2 });
                    } else {
                        const rx = startX + 80 + posIdx * 55;
                        this._student(fc.c, Math.min(rx, startX + usableW - 40), fc.pY, m);
                    }
                });
            }
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
        this._onMove = (e) => { if(!UniversityInterior.isDragging || !UniversityInterior.scene || UniversityInterior.scene.destroyed) return; let ny=UniversityInterior._startSceneY+(e.clientY-UniversityInterior._startY); ny=Math.max(UniversityInterior.minY,Math.min(ny,UniversityInterior.maxY)); UniversityInterior.scene.y=ny; };
        this._onUp = () => { UniversityInterior.isDragging=false; if(UniversityInterior.layer) UniversityInterior.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══ FLOOR DISPATCH ═══
    _drawFloor(c, id, f, nf, sx, uw, pY, fy, fh, col) {
        if (id === 'uni_main') this._drawMainFloor(c, f, nf, sx, uw, pY, fy, fh, col);
        else if (id === 'uni_library') this._drawLibraryFloor(c, f, nf, sx, uw, pY, fy, fh, col);
        else if (id === 'uni_dorm') this._drawDormFloor(c, f, nf, sx, uw, pY, fy, fh, col);
        else if (id === 'uni_lab') this._drawLabFloor(c, f, nf, sx, uw, pY, fy, fh, col);
    },
    _drawBasement(c, id, sx, uw, pY, fy, fh, col) {
        if (id === 'uni_main') { this._lbl(c,sx+uw/2,pY-fh+14,'ARCHIVES',0xfbbf24); for(let x=sx+40;x<sx+uw-100;x+=90) this._fileCabinet(c,x,pY); for(let x=sx+60;x<sx+uw-100;x+=120) this._docBox(c,x,pY); }
        else if (id === 'uni_library') { this._lbl(c,sx+uw/2,pY-fh+14,'RARE BOOKS VAULT',0x4ade80); for(let x=sx+40;x<sx+uw-100;x+=100) this._secureShelf(c,x,pY); for(let x=sx+80;x<sx+uw-120;x+=140) this._glassCase(c,x,pY); }
        else if (id === 'uni_dorm') { this._lbl(c,sx+uw/2,pY-fh+14,'LAUNDRY',0x60a5fa); for(let x=sx+40;x<sx+uw-80;x+=70) this._washer(c,x,pY); }
        else if (id === 'uni_lab') { this._lbl(c,sx+uw/2,pY-fh+14,'EQUIPMENT STORAGE',0x22d3ee); for(let x=sx+40;x<sx+uw-100;x+=90) this._crate(c,x,pY); for(let x=sx+70;x<sx+uw-100;x+=130) this._spareParts(c,x,pY); }
    },

    // ═══ UNI_MAIN — AI Academy (4 floors, amber 0xfbbf24) ═══
    _drawMainFloor(c, f, nf, sx, uw, pY, fy, fh, col) {
        if (f===nf-1) {
            // Floor 3: LECTURE HALL
            this._lbl(c,sx+uw/2,pY-fh+14,'LECTURE HALL',0xfbbf24);
            this._chalkboard(c,sx+60,pY-55,uw-180);
            this._podium(c,sx+uw/2,pY);
            this._npc(c,sx+uw/2-30,pY,'Professor',0xfbbf24,this.bld);
        } else if (f===nf-2) {
            // Floor 2: SEMINAR ROOMS
            this._lbl(c,sx+uw/2,pY-fh+14,'SEMINAR ROOMS',0xfbbf24);
            for(let x=sx+40;x<sx+uw-120;x+=140) this._whiteboard(c,x,pY);
            for(let x=sx+60;x<sx+uw-100;x+=130) this._studyTable(c,x,pY);
        } else if (f===1) {
            // Floor 1: COMPUTER LAB
            this._lbl(c,sx+uw/2,pY-fh+14,'COMPUTER LAB',0xfbbf24);
            for(let x=sx+30;x<sx+uw-60;x+=80) this._workstation(c,x,pY,col);
        } else {
            // Floor 0: RECEPTION
            this._lbl(c,sx+uw/2,pY-fh+14,'RECEPTION',0x94a3b8);
            this._frontDesk(c,sx+80,pY,col);
            this._noticeBoard(c,sx+260,pY,col);
            this._npc(c,sx+100,pY,'Receptionist',0x94a3b8,this.bld);
            this._npc(c,sx+uw-80,pY,'Dean',0xfbbf24,this.bld);
        }
    },

    // ═══ UNI_LIBRARY — Data Library (3 floors, green 0x4ade80) ═══
    _drawLibraryFloor(c, f, nf, sx, uw, pY, fy, fh, col) {
        if (f===nf-1) {
            // Floor 2: REFERENCE SECTION
            this._lbl(c,sx+uw/2,pY-fh+14,'REFERENCE SECTION',0x4ade80);
            for(let x=sx+30;x<sx+uw-60;x+=80) this._bookshelf(c,x,pY,col);
        } else if (f===1) {
            // Floor 1: READING ROOM
            this._lbl(c,sx+uw/2,pY-fh+14,'READING ROOM',0x4ade80);
            for(let x=sx+40;x<sx+uw-80;x+=110) this._readingDesk(c,x,pY);
        } else {
            // Floor 0: LOBBY
            this._lbl(c,sx+uw/2,pY-fh+14,'LOBBY',0x94a3b8);
            this._checkoutDesk(c,sx+80,pY,col);
            this._npc(c,sx+100,pY,'Librarian',0x4ade80,this.bld);
        }
    },

    // ═══ UNI_DORM — Model Dormitory (5 floors, blue 0x60a5fa) ═══
    _drawDormFloor(c, f, nf, sx, uw, pY, fy, fh, col) {
        if (f>=2) {
            // Floors 4-2: DORM ROOMS
            this._lbl(c,sx+uw/2,pY-fh+14,'DORM ROOMS — FLOOR '+(f+1),0x60a5fa);
            for(let x=sx+30;x<sx+uw-80;x+=90) this._dormRoom(c,x,pY,col);
        } else if (f===1) {
            // Floor 1: COMMON ROOM
            this._lbl(c,sx+uw/2,pY-fh+14,'COMMON ROOM',0x60a5fa);
            this._couch(c,sx+50,pY);
            this._couch(c,sx+180,pY);
            this._vendingMachine(c,sx+uw-130,pY,col);
            this._tv(c,sx+uw/2-20,pY);
        } else {
            // Floor 0: LOBBY
            this._lbl(c,sx+uw/2,pY-fh+14,'LOBBY',0x94a3b8);
            this._frontDesk(c,sx+80,pY,col);
            this._noticeBoard(c,sx+260,pY,col);
            this._npc(c,sx+100,pY,'Dorm Advisor',0x60a5fa,this.bld);
        }
    },

    // ═══ UNI_LAB — Research Lab (3 floors, cyan 0x22d3ee) ═══
    _drawLabFloor(c, f, nf, sx, uw, pY, fy, fh, col) {
        if (f===nf-1) {
            // Floor 2: NEURAL NET LAB
            this._lbl(c,sx+uw/2,pY-fh+14,'NEURAL NET LAB',0x22d3ee);
            for(let x=sx+40;x<sx+uw-100;x+=120) this._labBench(c,x,pY,col);
            this._oscilloscope(c,sx+uw-140,pY,col);
        } else if (f===1) {
            // Floor 1: GPU CLUSTER
            this._lbl(c,sx+uw/2,pY-fh+14,'GPU CLUSTER',0x22d3ee);
            this._pipes(c,sx,fy+6,uw);
            for(let rx=sx+30;rx<sx+uw-60;rx+=80) this._rack(c,rx,pY,col);
            this._npc(c,sx+uw/2,pY,'SysAdmin',0x22d3ee,this.bld);
        } else {
            // Floor 0: LAB RECEPTION
            this._lbl(c,sx+uw/2,pY-fh+14,'LAB RECEPTION',0x94a3b8);
            this._deskWithMonitor(c,sx+80,pY,col);
            this._npc(c,sx+100,pY,'Lab Tech',0x22d3ee,this.bld);
        }
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
        const npcModel = { id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name:name, isNPC:true, role:name, phase:'released', lab:bld?bld.lab:'other', desc:'Facility staff — keeping systems operational.' };
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea=new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap',()=>{ if(typeof UI!=='undefined') UI.selectModel(npcModel); });
        cont.on('pointerover',(e)=>{ if(typeof UI!=='undefined') UI.showTooltip(e,name,'Facility Staff'); });
        cont.on('pointerout',()=>{ if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({cont,head,body,legL,legR,_h:h,_minX:x-60,_maxX:x+60,_phase:Math.random()*Math.PI*2,_walkTimer:0,_walkDir:0});
    },

    // ── uni_main props ──
    _chalkboard(c,x,y,w) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x2a4a2a);g.drawRoundedRect(x,y,w,40,3);g.endFill(); g.lineStyle(2,0x8b6e4e);g.drawRoundedRect(x,y,w,40,3);g.lineStyle(0); c.addChild(g); const eqs=['L = -Sum y log(y)','grad J(t)','f(x)=max(0,Wx+b)']; eqs.forEach((eq,i)=>{ const t=new PIXI.Text(eq,{fontFamily:'JetBrains Mono',fontSize:6,fill:0xccddcc}); t.x=x+8; t.y=y+4+i*12; c.addChild(t); }); },
    _podium(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x5a3a1e);g.drawRect(x-14,y-22,28,22);g.endFill(); g.beginFill(0x6a4a2e);g.drawRect(x-16,y-24,32,4);g.endFill(); c.addChild(g); },
    _whiteboard(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0xe8e8e8);g.drawRect(x,y-50,60,30);g.endFill(); g.lineStyle(1,0xaaaaaa);g.drawRect(x,y-50,60,30);g.lineStyle(0); g.beginFill(0xef4444);g.drawRect(x+4,y-20,5,2);g.endFill(); g.beginFill(0x2255ee);g.drawRect(x+12,y-20,5,2);g.endFill(); g.beginFill(0x22aa44);g.drawRect(x+20,y-20,5,2);g.endFill(); c.addChild(g); },
    _studyTable(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x4a3a2a);g.drawRect(x,y-16,55,16);g.endFill(); g.beginFill(0x3a2a1a);g.drawRect(x+5,y,3,8);g.drawRect(x+47,y,3,8);g.endFill(); c.addChild(g); },
    _workstation(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x4a3a2a);g.drawRect(x,y-16,50,16);g.endFill(); g.beginFill(0x111120);g.drawRect(x+10,y-32,24,16);g.endFill(); const gl=new PIXI.Graphics();gl.eventMode='none';gl.beginFill(col,0.15);gl.drawRect(x+12,y-30,20,12);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.2,type:'screen'}); },
    _frontDesk(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1e293b);g.drawRect(x,y-18,80,18);g.endFill(); g.beginFill(col,0.3);g.drawRect(x,y-20,80,3);g.endFill(); g.beginFill(0x111120);g.drawRect(x+20,y-35,30,14);g.endFill(); g.beginFill(0x06b6d4,0.3);g.drawRect(x+22,y-33,26,10);g.endFill(); c.addChild(g); },
    _noticeBoard(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x5a4030);g.drawRect(x,y-48,60,35);g.endFill(); g.beginFill(0xfbbf24,0.6);g.drawRect(x+5,y-43,12,10);g.endFill(); g.beginFill(0x4ade80,0.6);g.drawRect(x+22,y-43,12,10);g.endFill(); g.beginFill(0x60a5fa,0.6);g.drawRect(x+39,y-43,12,10);g.endFill(); g.beginFill(0xef4444,0.5);g.drawRect(x+10,y-28,18,8);g.endFill(); g.beginFill(0xa855f7,0.5);g.drawRect(x+32,y-28,18,8);g.endFill(); c.addChild(g); },

    // ── uni_library props ──
    _bookshelf(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x5a4030);g.drawRect(x,y-50,50,50);g.endFill(); const bookCols=[0xcc4444,0x4488cc,0x44aa44,0xddaa33,0x884488]; for(let bi=0;bi<6;bi++){const bx=x+4+bi*7;const bh=18+Math.floor(Math.random()*20);g.beginFill(bookCols[bi%bookCols.length]);g.drawRect(bx,y-4-bh,6,bh);g.endFill();} g.beginFill(0x6a5040);g.drawRect(x,y-4,50,4);g.endFill(); g.beginFill(0x6a5040);g.drawRect(x,y-26,50,3);g.endFill(); c.addChild(g); },
    _readingDesk(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x4a3a2a);g.drawRect(x,y-16,60,16);g.endFill(); g.beginFill(0x3a2a1a);g.drawRect(x+5,y,3,8);g.drawRect(x+52,y,3,8);g.endFill(); g.beginFill(0x44aa44,0.5);g.drawCircle(x+50,y-22,5);g.endFill(); g.beginFill(0x333333);g.drawRect(x+49,y-16,2,10);g.endFill(); c.addChild(g); },
    _checkoutDesk(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1e293b);g.drawRect(x,y-18,90,18);g.endFill(); g.beginFill(col,0.3);g.drawRect(x,y-20,90,3);g.endFill(); g.beginFill(0x111120);g.drawRect(x+25,y-35,28,14);g.endFill(); g.beginFill(0x4ade80,0.3);g.drawRect(x+27,y-33,24,10);g.endFill(); c.addChild(g); },

    // ── uni_dorm props ──
    _dormRoom(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none';
        // Bed frame + mattress
        g.beginFill(0x334155); g.drawRect(x-2,y-14,4,14); g.endFill(); // headboard
        g.beginFill(0x334155); g.drawRect(x+2,y-6,34,6); g.endFill(); // base
        g.beginFill(0xf1f5f9); g.drawRect(x+4,y-10,30,4); g.endFill(); // mattress
        g.beginFill(0x60a5fa); g.drawRect(x+16,y-11,16,6); g.endFill(); // duvet
        g.beginFill(0xffffff); g.drawRect(x+5,y-12,5,3); g.drawRect(x+11,y-12,5,3); g.endFill(); // pillows
        // Desk + monitor
        g.beginFill(0x4a3a2a);g.drawRect(x+42,y-12,28,12);g.endFill();
        g.beginFill(0x2a2a3a);g.drawRect(x+44,y-26,10,14);g.endFill();
        c.addChild(g); },
    _couch(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x664422);g.drawRoundedRect(x,y-18,60,18,4);g.endFill(); g.beginFill(0x553311);g.drawRect(x,y-24,8,24);g.drawRect(x+52,y-24,8,24);g.endFill(); c.addChild(g); },
    _vendingMachine(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x334155);g.drawRect(x,y-48,35,48);g.endFill(); g.beginFill(0x111120);g.drawRect(x+3,y-44,29,28);g.endFill(); for(let r=0;r<3;r++){for(let ci=0;ci<3;ci++){g.beginFill([0xef4444,0x4ade80,0x60a5fa][ci]);g.drawRect(x+5+ci*9,y-42+r*9,7,7);g.endFill();}} g.beginFill(col,0.4);g.drawRect(x+3,y-12,29,8);g.endFill(); c.addChild(g); },
    _tv(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x111120);g.drawRect(x,y-40,40,26);g.endFill(); const gl=new PIXI.Graphics();gl.eventMode='none';gl.beginFill(0x3388ff,0.15);gl.drawRect(x+2,y-38,36,22);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; g.beginFill(0x333333);g.drawRect(x+17,y-14,6,8);g.endFill(); g.beginFill(0x444444);g.drawRect(x+10,y-6,20,3);g.endFill(); c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.2,type:'screen'}); },

    // ── uni_lab props ──
    _labBench(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x2a3a4a);g.drawRect(x,y-16,70,16);g.endFill(); g.beginFill(0x3a4a5a);g.drawRect(x+5,y,3,8);g.drawRect(x+62,y,3,8);g.endFill(); const liqCols=[0x44ff88,0xff4488,0x4488ff]; for(let bi=0;bi<3;bi++){const bx=x+8+bi*20;g.beginFill(liqCols[bi],0.4);g.drawCircle(bx+5,y-22,5);g.endFill();g.beginFill(0x88ccff,0.2);g.drawRect(bx,y-28,10,12);g.endFill();} c.addChild(g); },
    _oscilloscope(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1a1a2e);g.drawRect(x,y-40,50,40);g.endFill(); g.beginFill(0x0a0a18);g.drawRect(x+5,y-35,30,22);g.endFill(); const gl=new PIXI.Graphics();gl.eventMode='none';gl.beginFill(col,0.12);gl.drawRect(x+6,y-34,28,20);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; g.beginFill(0x444444);g.drawCircle(x+42,y-30,3);g.endFill(); g.beginFill(0x444444);g.drawCircle(x+42,y-20,3);g.endFill(); c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.15,type:'screen'}); },
    _rack(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x0a0a12);g.drawRect(x,y-50,36,50);g.endFill(); g.beginFill(0x111120);g.drawRect(x+3,y-47,30,44);g.endFill(); for(let s=y-45;s<y-5;s+=8){g.beginFill(0x1a1a30);g.drawRect(x+5,s,26,6);g.endFill();g.beginFill(0x4ade80);g.drawCircle(x+9,s+3,1);g.endFill();g.beginFill(col,0.15);g.drawRect(x+13,s+1,15,4);g.endFill();} const gl=new PIXI.Graphics();gl.beginFill(col,0.04);gl.drawRect(x-2,y-52,40,54);gl.endFill();gl.blendMode=PIXI.BLEND_MODES.ADD; c.addChild(g,gl); this.indoorLights.push({g:gl,maxA:0.06,type:'blink'}); },
    _pipes(c,x,y,w) { const g=new PIXI.Graphics();g.eventMode='none';g.zIndex=1; g.beginFill(0x334155);g.drawRect(x,y,w,3);g.endFill(); g.beginFill(0x475569);g.drawRect(x,y+5,w,2);g.endFill(); for(let d=x+50;d<x+w;d+=80){g.beginFill(0x22d3ee,0.3);g.drawCircle(d,y+10,2);g.endFill();} c.addChild(g); },
    _deskWithMonitor(c,x,y,col) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x1e293b);g.drawRect(x,y-18,70,18);g.endFill(); g.beginFill(col,0.3);g.drawRect(x,y-20,70,3);g.endFill(); g.beginFill(0x111120);g.drawRect(x+18,y-35,28,14);g.endFill(); g.beginFill(col,0.3);g.drawRect(x+20,y-33,24,10);g.endFill(); c.addChild(g); },

    // ── basement props ──
    _fileCabinet(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x3a3a4a);g.drawRect(x,y-45,28,45);g.endFill(); for(let d=0;d<3;d++){g.beginFill(0x2a2a3a);g.drawRect(x+3,y-42+d*14,22,11);g.endFill();g.beginFill(0x666677);g.drawRect(x+12,y-38+d*14,4,3);g.endFill();} c.addChild(g); },
    _docBox(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x5a4a3a);g.drawRect(x,y-20,30,20);g.endFill(); g.beginFill(0x6a5a4a);g.drawRect(x+2,y-18,26,2);g.drawRect(x+2,y-12,26,2);g.drawRect(x+2,y-6,26,2);g.endFill(); c.addChild(g); },
    _secureShelf(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x3a3a4a);g.drawRect(x,y-48,50,48);g.endFill(); g.beginFill(0x4a4a5a);g.drawRect(x+2,y-46,46,20);g.drawRect(x+2,y-22,46,18);g.endFill(); const bookCols=[0x884422,0xaa6633,0x664411]; for(let bi=0;bi<5;bi++){g.beginFill(bookCols[bi%bookCols.length]);g.drawRect(x+4+bi*8,y-44,6,16);g.endFill();} c.addChild(g); },
    _glassCase(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x222233);g.drawRect(x,y-40,45,40);g.endFill(); g.lineStyle(1,0x88ccff,0.3);g.drawRect(x+3,y-37,39,34);g.lineStyle(0); g.beginFill(0x884422);g.drawRect(x+10,y-28,10,16);g.endFill(); g.beginFill(0xaa6633);g.drawRect(x+25,y-25,10,13);g.endFill(); c.addChild(g); },
    _washer(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0xb0b8c0);g.drawRect(x,y-40,35,40);g.endFill(); g.beginFill(0xd4d8dd);g.drawRect(x+3,y-37,29,14);g.endFill(); g.beginFill(0x0a0a18);g.drawCircle(x+17,y-12,8);g.endFill(); g.beginFill(0x60a5fa,0.3);g.drawCircle(x+17,y-12,6);g.endFill(); g.beginFill(0x4ade80);g.drawCircle(x+28,y-34,2);g.endFill(); c.addChild(g); },
    _crate(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x5a4a3a);g.drawRect(x,y-30,35,30);g.endFill(); g.beginFill(0x6a5a4a);g.drawRect(x,y-30,35,3);g.drawRect(x,y-15,35,3);g.endFill(); g.lineStyle(1,0x4a3a2a);g.moveTo(x,y-30);g.lineTo(x+35,y);g.moveTo(x+35,y-30);g.lineTo(x,y);g.lineStyle(0); c.addChild(g); },
    _spareParts(c,x,y) { const g=new PIXI.Graphics();g.eventMode='none'; g.beginFill(0x334155);g.drawRect(x,y-24,50,24);g.endFill(); g.beginFill(0x444466);g.drawCircle(x+12,y-12,6);g.endFill(); g.beginFill(0x555577);g.drawCircle(x+12,y-12,3);g.endFill(); g.beginFill(0x666688);g.drawRect(x+28,y-18,14,10);g.endFill(); g.beginFill(0x22d3ee,0.3);g.drawRect(x+30,y-16,10,6);g.endFill(); c.addChild(g); },

    // ═══ STUDENT AVATAR (AI models inside the building) ═══
    _student(c,x,y,model) {
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
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea = new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap',()=>{ if(typeof UI!=='undefined') UI.selectModel(model); });
        cont.on('pointerover',(e)=>{ if(typeof UI!=='undefined') UI.showTooltip(e,model.name,stg==='baby'?'Pre-Training':stg==='kid'?'Training':'Rumored'); });
        cont.on('pointerout',()=>{ if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({cont,head,body,legL,legR,_h:h,_minX:x-50,_maxX:x+50,_phase:Math.random()*Math.PI*2,_walkTimer:0,_walkDir:0});
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
        this.avatars.forEach(av=>{if(!av.cont||av.cont.destroyed)return;
            // Zzz animation for sleeping students
            if(av._isZzz){const t=G.tick*0.04+av._phase;av._z1.y=Math.sin(t)*3;av._z1.alpha=0.5+Math.sin(t)*0.3;av._z2.y=-7+Math.sin(t+1)*3;av._z2.alpha=0.3+Math.sin(t+1)*0.25;av._z3.y=-15+Math.sin(t+2)*3;av._z3.alpha=0.15+Math.sin(t+2)*0.2;return;}
            av._walkTimer=(av._walkTimer||0)-1;if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;}const nx=av.cont.x+av._walkDir*0.3;if(nx>av._minX&&nx<av._maxX)av.cont.x=nx;
            // Walk animation — legs swing, head/body bob (use _h for scaled students)
            const ah=av._h||32;
            if(av.head){av.head.y=-ah+Math.sin(G.tick*0.15+av._phase)*1.5;}
            if(av.body){av.body.y=-ah+Math.round(ah*0.35)+Math.abs(Math.sin(G.tick*0.15+av._phase))*1.5;}
            if(av.legL){av.legL.y=Math.sin(G.tick*0.2+av._phase)*3;}
            if(av.legR){av.legR.y=-Math.sin(G.tick*0.2+av._phase)*3;}
        });
    }
};
