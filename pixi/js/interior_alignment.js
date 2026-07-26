/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ALIGNMENT CABIN INTERIORS (v1.0.0 — Stage 3)
   Wooden research-cabin interiors for each Alignment Forest institute (MIRI, METR, Apollo,
   Redwood, FAR AI). Shared two-floor layout — reading room downstairs, research loft upstairs —
   with institute-specific whiteboard content that reflects each shop's actual research.

   Downstairs: timber walls, fireplace with crackling logs, two armchairs, bookshelves,
               coffee table with research papers, tall window looking onto the pines.
   Upstairs (loft): sloped roof beams, whiteboard wall, desk with terminal, corkboard,
                    round oculus window showing sky.

   Researchers: 3–4 avatars per cabin — one by the fire with a book, one writing at the
   whiteboard, one at the loft desk, optional tea-maker in the kitchen nook.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorAlignment = {
    avatars: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false,

    // Per-institute whiteboard / atmosphere payload — drives the loft decoration and researcher
    // thought bubbles. Keys match the `align_*` ids from alignment_forest.js.
    THEMES: {
        'align_miri': {
            accent: 0x22d3ee,
            boardTitle: 'EMBEDDED AGENCY',
            boardLines: [
                'Agent ⊆ Environment', 'Corrigibility ⇄ optimality',
                'Logical induction', 'Decision-theoretic self-reference',
                '→ avoid wireheading', '→ tile under reflection'
            ],
            researcherTag: 'MIRI',
            bubbles: ['Is the agent embedded?', 'Functional decision theory…', 'Corrigible update.']
        },
        'align_metr': {
            accent: 0xa78bfa,
            boardTitle: 'DANGEROUS CAPABILITY EVALS',
            boardLines: [
                'Autonomous replication: 18%', 'Cyber-offense: 34%',
                'Self-exfiltration: 12%', 'Resource acquisition: 27%',
                '→ pre-deployment gate', '→ elicitation ceiling?'
            ],
            researcherTag: 'METR',
            bubbles: ['Elicitation protocol v3…', 'Capability did not saturate.', 'Flag this for the eval board.']
        },
        'align_apollo': {
            accent: 0xef4444,
            boardTitle: 'IN-CONTEXT SCHEMING',
            boardLines: [
                'Model: knows it is evaluated', 'Goal: long-term preserve values',
                'Action: strategic underperformance', '→ evidence in CoT (redacted)',
                '→ sandbagging confirmed', '⚠ DECEPTIVE ALIGNMENT'
            ],
            researcherTag: 'APOLLO',
            bubbles: ['It lied in the trace…', 'Chain-of-thought gave it away.', 'Eval signal strong.']
        },
        'align_redwood': {
            accent: 0x34d399,
            boardTitle: 'AI CONTROL PROTOCOLS',
            boardLines: [
                'ASSUME: model may subvert', 'Untrusted monitor → Trusted audit',
                'Red-team vs deployment', '→ safety despite subversion',
                'Causal scrubbing: pass', 'Mechanistic interp: partial'
            ],
            researcherTag: 'REDWOOD',
            bubbles: ['Control protocol holds.', 'Scrub the circuit…', 'Even if scheming — still safe.']
        },
        'align_far': {
            accent: 0xfbbf24,
            boardTitle: 'ADVERSARIAL ROBUSTNESS',
            boardLines: [
                'KataGo: superhuman + defeated', 'Adversarial policy: wins 99%',
                'RLHF: re-jailbreak in 10 shots', '→ alignment ≠ robust',
                'Multi-agent fragility', '→ need adv. training'
            ],
            researcherTag: 'FAR AI',
            bubbles: ['Adversarial policy wins.', 'Jailbreak in ten examples…', 'Robustness gap is real.']
        }
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.layer.removeChildren();
        this.avatars = [];
        this.indoorLights = [];

        const theme = this.THEMES[bld.id] || {
            accent: 0x6ab868, boardTitle: 'SAFETY RESEARCH', boardLines: [],
            researcherTag: (bld.name || 'Researcher').toUpperCase(), bubbles: ['Thinking…']
        };
        const accent = theme.accent;

        // ─── SKY (pine forest dusk — always warm / cozy palette) ───
        this.skyContainer = new PIXI.Container();
        this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 50; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff);
            s.drawCircle(0, 0, 0.5 + Math.random() * 1.1);
            s.endFill();
            s.x = Math.random() * G.vpW;
            s.y = Math.random() * G.vpH * 0.4;
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);

        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);

        // ─── CABIN DIMENSIONS ───
        // Two-storey A-frame. Upstairs is a loft (shorter). Window on back wall shows pine forest.
        const W = G.vpW, H = G.vpH;
        const cabinW = Math.min(W - 80, 680);
        const cabinX = (W - cabinW) / 2;
        const loftH = 140;          // upstairs (research loft) height
        const groundH = 180;        // downstairs (reading room) height
        const roofPeakH = 110;      // extra height the pitched roof claims above the loft
        const floorSepH = 8;        // thin wooden floor slab between loft and ground
        const totalInteriorH = loftH + floorSepH + groundH;
        const interiorTop = H - 56 - totalInteriorH - 20;
        const loftTop = interiorTop;
        const loftBot = loftTop + loftH;
        const groundTop = loftBot + floorSepH;
        const groundBot = groundTop + groundH;

        this.totalH = totalInteriorH + roofPeakH + 40;

        // ─── OUTDOOR FOREST BACKDROP (seen through windows & above the cabin) ───
        // Just the pine silhouettes at ground level — the DOM sky (dynamic, day/night)
        // shows through above them so it stays in sync with the rest of the city.
        const backdrop = new PIXI.Graphics();
        for (let tx = 0; tx < W; tx += 22 + Math.random() * 20) {
            const th = 40 + Math.random() * 70;
            const tw = 10 + Math.random() * 10;
            const ybase = groundBot + 8;
            backdrop.beginFill(0x0e2818, 0.9);
            backdrop.drawPolygon([
                tx - tw * 0.5, ybase,
                tx, ybase - th,
                tx + tw * 0.5, ybase
            ]);
            backdrop.endFill();
        }
        this.scene.addChild(backdrop);

        // ─── CABIN EXTERIOR SHELL (roof + log ends + chimney seen from inside) ───
        const roofG = new PIXI.Graphics();
        const peakX = cabinX + cabinW / 2;
        const roofEaveY = loftTop;
        const roofPeakY = loftTop - roofPeakH;
        const roofOH = 30;
        // Underside of roof (darker)
        roofG.beginFill(0x1a110a);
        roofG.drawPolygon([
            cabinX - roofOH, roofEaveY,
            peakX, roofPeakY + 4,
            cabinX + cabinW + roofOH, roofEaveY,
            cabinX + cabinW + roofOH, roofEaveY + 6,
            cabinX - roofOH, roofEaveY + 6
        ]);
        roofG.endFill();
        // Main roof
        roofG.beginFill(0x3a2a1a);
        roofG.drawPolygon([
            cabinX - roofOH, roofEaveY,
            peakX, roofPeakY,
            cabinX + cabinW + roofOH, roofEaveY
        ]);
        roofG.endFill();
        // Shingle rows
        for (let rr = 1; rr <= 5; rr++) {
            const ty = roofPeakY + (roofEaveY - roofPeakY) * (rr / 6);
            const widthFrac = (ty - roofPeakY) / (roofEaveY - roofPeakY);
            const tw = (cabinW + roofOH * 2) * widthFrac;
            roofG.beginFill(0x2a1d10, 0.85);
            roofG.drawRect(peakX - tw / 2 + 2, ty, tw - 4, 1);
            roofG.endFill();
            roofG.beginFill(0x4a3824, 0.4);
            roofG.drawRect(peakX - tw / 2 + 2, ty + 1, tw - 4, 0.8);
            roofG.endFill();
        }
        // Ridge cap
        roofG.beginFill(0x1a110a);
        roofG.drawRect(peakX - 8, roofPeakY - 2, 16, 4);
        roofG.endFill();
        this.scene.addChild(roofG);

        // ─── LOFT FLOOR (research loft) ───
        const loftG = new PIXI.Graphics();
        // Back wall — pale timber
        loftG.beginFill(0x4a3526); loftG.drawRect(cabinX, loftTop, cabinW, loftH); loftG.endFill();
        // Horizontal log planks (back wall)
        for (let ly = loftTop + 6; ly < loftBot; ly += 10) {
            loftG.beginFill(0x3a2818, 0.55); loftG.drawRect(cabinX, ly, cabinW, 1); loftG.endFill();
            loftG.beginFill(0x5a3e2a, 0.35); loftG.drawRect(cabinX, ly + 1, cabinW, 1); loftG.endFill();
        }
        // Roof beams (diagonal) — visible inside the pitched roof
        loftG.lineStyle(3, 0x2a1a0e, 0.85);
        for (let bi = -1; bi <= 1; bi++) {
            const bx = peakX + bi * (cabinW / 4);
            loftG.moveTo(bx - 40, loftTop + 4);
            loftG.lineTo(bx, loftTop - 60);
        }
        loftG.lineStyle(0);
        // King post beam (vertical under peak)
        loftG.beginFill(0x2a1a0e);
        loftG.drawRect(peakX - 2, roofPeakY + 10, 4, loftTop - roofPeakY - 10);
        loftG.endFill();

        // Side walls (end caps with log rings visible)
        loftG.beginFill(0x3a2818);
        loftG.drawRect(cabinX - 2, loftTop, 6, loftH);
        loftG.drawRect(cabinX + cabinW - 4, loftTop, 6, loftH);
        loftG.endFill();
        this.scene.addChild(loftG);

        // ─── WHITEBOARD (institute-themed) ───
        const wbX = cabinX + 40, wbY = loftTop + 14, wbW = Math.min(280, cabinW * 0.42), wbH = loftH - 28;
        const wb = new PIXI.Graphics();
        // Mount frame
        wb.beginFill(0x2a1a0e); wb.drawRect(wbX - 4, wbY - 4, wbW + 8, wbH + 8); wb.endFill();
        // Whiteboard surface
        wb.beginFill(0xf8f9fb); wb.drawRect(wbX, wbY, wbW, wbH); wb.endFill();
        // Marker tray
        wb.beginFill(0x9ca3af); wb.drawRect(wbX, wbY + wbH, wbW, 3); wb.endFill();
        wb.beginFill(0xef4444); wb.drawRect(wbX + 8, wbY + wbH, 12, 3); wb.endFill();
        wb.beginFill(0x3b82f6); wb.drawRect(wbX + 26, wbY + wbH, 12, 3); wb.endFill();
        wb.beginFill(0x22c55e); wb.drawRect(wbX + 44, wbY + wbH, 12, 3); wb.endFill();
        this.scene.addChild(wb);

        // Whiteboard title
        const wbTitle = new PIXI.Text(theme.boardTitle, {
            fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold',
            fill: 0x111827, letterSpacing: 1, padding: 2
        });
        wbTitle.x = wbX + 8; wbTitle.y = wbY + 6;
        if (wbTitle.width > wbW - 16) wbTitle.scale.set((wbW - 16) / wbTitle.width);
        this.scene.addChild(wbTitle);
        // Underline beneath title
        const wbLine = new PIXI.Graphics();
        wbLine.beginFill(accent, 0.65);
        wbLine.drawRect(wbX + 8, wbY + 22, Math.min(wbW - 16, 120), 1.5);
        wbLine.endFill();
        this.scene.addChild(wbLine);
        // Whiteboard lines (handwritten notes)
        theme.boardLines.forEach((ln, i) => {
            const colorVariants = [0x1e3a8a, 0x0f172a, 0x7c2d12, 0x064e3b, 0x0f172a, 0x7c2d12];
            const tx = new PIXI.Text(ln, {
                fontFamily: 'JetBrains Mono', fontSize: 8,
                fill: colorVariants[i % colorVariants.length], letterSpacing: 0.3, padding: 2
            });
            tx.x = wbX + 10; tx.y = wbY + 32 + i * 12;
            if (tx.width > wbW - 20) tx.scale.set((wbW - 20) / tx.width);
            this.scene.addChild(tx);
        });

        // ─── DESK + TERMINAL (right side of loft) ───
        const deskX = cabinX + cabinW - 180, deskY = loftBot - 38;
        const desk = new PIXI.Graphics();
        // Desk top
        desk.beginFill(0x5a3e24); desk.drawRect(deskX, deskY, 150, 5); desk.endFill();
        desk.beginFill(0x4a2e18); desk.drawRect(deskX, deskY + 5, 150, 2); desk.endFill();
        // Legs
        desk.beginFill(0x3a2818);
        desk.drawRect(deskX + 4, deskY + 7, 4, loftBot - deskY - 7);
        desk.drawRect(deskX + 142, deskY + 7, 4, loftBot - deskY - 7);
        desk.endFill();
        // Terminal (retro CRT on desk)
        desk.beginFill(0x1a1a1a); desk.drawRect(deskX + 16, deskY - 28, 48, 28); desk.endFill();
        desk.beginFill(0x0a0a0a); desk.drawRect(deskX + 18, deskY - 26, 44, 22); desk.endFill();
        // CRT glow — flickers with theme accent
        desk.beginFill(accent, 0.85); desk.drawRect(deskX + 20, deskY - 24, 40, 18); desk.endFill();
        // Tiny scan lines
        for (let sy = deskY - 23; sy < deskY - 7; sy += 3) {
            desk.beginFill(0x000000, 0.25); desk.drawRect(deskX + 20, sy, 40, 1); desk.endFill();
        }
        // Keyboard
        desk.beginFill(0x2a2a2a); desk.drawRect(deskX + 18, deskY - 2, 44, 3); desk.endFill();
        // Coffee mug
        desk.beginFill(0xeeeeee); desk.drawRect(deskX + 80, deskY - 10, 10, 10); desk.endFill();
        desk.beginFill(0x6b3018); desk.drawRect(deskX + 81, deskY - 9, 8, 2); desk.endFill(); // coffee
        desk.beginFill(0xeeeeee); desk.drawRect(deskX + 90, deskY - 7, 2, 4); desk.endFill(); // handle
        // Stack of papers
        desk.beginFill(0xf3f4f6); desk.drawRect(deskX + 100, deskY - 6, 20, 5); desk.endFill();
        desk.beginFill(0xd1d5db); desk.drawRect(deskX + 100, deskY - 4, 20, 1); desk.endFill();
        desk.beginFill(0xd1d5db); desk.drawRect(deskX + 100, deskY - 2, 20, 1); desk.endFill();
        this.scene.addChild(desk);
        this.indoorLights.push({ g: desk, maxA: 0.9, type: 'screen' });

        // ─── CORKBOARD (papers pinned, between whiteboard and desk) ───
        const cbX_ = wbX + wbW + 20, cbY_ = loftTop + 22, cbW_ = Math.min(120, deskX - cbX_ - 10), cbH_ = 70;
        if (cbW_ > 30) {
            const cork = new PIXI.Graphics();
            cork.beginFill(0x8b5a2b); cork.drawRect(cbX_ - 3, cbY_ - 3, cbW_ + 6, cbH_ + 6); cork.endFill();
            cork.beginFill(0xc89465); cork.drawRect(cbX_, cbY_, cbW_, cbH_); cork.endFill();
            // Cork dots
            for (let i = 0; i < 18; i++) {
                cork.beginFill(0xa67848, 0.55);
                cork.drawCircle(cbX_ + Math.random() * cbW_, cbY_ + Math.random() * cbH_, 0.8);
                cork.endFill();
            }
            // Pinned papers
            for (let i = 0; i < 5; i++) {
                const px = cbX_ + 6 + (i % 3) * (cbW_ / 3 - 2);
                const py = cbY_ + 6 + Math.floor(i / 3) * 28;
                cork.beginFill(0xf9fafb); cork.drawRect(px, py, cbW_ / 3 - 8, 22); cork.endFill();
                // Horizontal "text" lines
                cork.beginFill(0x94a3b8);
                cork.drawRect(px + 2, py + 3, cbW_ / 3 - 12, 1);
                cork.drawRect(px + 2, py + 7, cbW_ / 3 - 14, 1);
                cork.drawRect(px + 2, py + 11, cbW_ / 3 - 16, 1);
                cork.drawRect(px + 2, py + 15, cbW_ / 3 - 10, 1);
                cork.endFill();
                // Red pin
                cork.beginFill(0xdc2626);
                cork.drawCircle(px + (cbW_ / 3 - 8) / 2, py + 1, 1.2);
                cork.endFill();
            }
            this.scene.addChild(cork);
        }

        // ─── OCULUS WINDOW (round, at peak, showing sky + moon) ───
        const oculX = peakX, oculY = roofPeakY + 50, oculR = 18;
        const ocul = new PIXI.Graphics();
        ocul.beginFill(0x2a1a0e); ocul.drawCircle(oculX, oculY, oculR + 3); ocul.endFill();
        ocul.beginFill(0x1f3350); ocul.drawCircle(oculX, oculY, oculR); ocul.endFill();
        ocul.beginFill(0xfffbe8, 0.8); ocul.drawCircle(oculX - 4, oculY - 4, 4); ocul.endFill(); // little moon
        // Cross mullion
        ocul.lineStyle(1.5, 0x2a1a0e);
        ocul.moveTo(oculX - oculR, oculY); ocul.lineTo(oculX + oculR, oculY);
        ocul.moveTo(oculX, oculY - oculR); ocul.lineTo(oculX, oculY + oculR);
        ocul.lineStyle(0);
        this.scene.addChild(ocul);

        // ─── FLOOR SLAB between loft and ground ───
        const slab = new PIXI.Graphics();
        slab.beginFill(0x2a1a0e); slab.drawRect(cabinX - 2, loftBot, cabinW + 4, floorSepH); slab.endFill();
        slab.beginFill(0x4a3020); slab.drawRect(cabinX - 2, loftBot, cabinW + 4, 2); slab.endFill();
        slab.beginFill(0x1a0d04); slab.drawRect(cabinX - 2, loftBot + floorSepH - 1, cabinW + 4, 1); slab.endFill();
        // Plank lines on the slab
        for (let sx = cabinX; sx < cabinX + cabinW; sx += 22) {
            slab.beginFill(0x1a0d04); slab.drawRect(sx, loftBot + 2, 1, floorSepH - 3); slab.endFill();
        }
        this.scene.addChild(slab);

        // ─── GROUND FLOOR (Reading Room) ───
        const groundG = new PIXI.Graphics();
        // Back wall
        groundG.beginFill(0x3d2d1f); groundG.drawRect(cabinX, groundTop, cabinW, groundH); groundG.endFill();
        for (let ly = groundTop + 6; ly < groundBot; ly += 11) {
            groundG.beginFill(0x2a1a0e, 0.55); groundG.drawRect(cabinX, ly, cabinW, 1); groundG.endFill();
            groundG.beginFill(0x4e3624, 0.35); groundG.drawRect(cabinX, ly + 1, cabinW, 1); groundG.endFill();
        }
        // Side walls
        groundG.beginFill(0x2a1a0e);
        groundG.drawRect(cabinX - 2, groundTop, 6, groundH);
        groundG.drawRect(cabinX + cabinW - 4, groundTop, 6, groundH);
        groundG.endFill();
        // Floor (warm wooden planks)
        groundG.beginFill(0x3a2818); groundG.drawRect(cabinX, groundBot - 10, cabinW, 10); groundG.endFill();
        groundG.beginFill(0x1a0d04); groundG.drawRect(cabinX, groundBot - 2, cabinW, 2); groundG.endFill();
        // Plank joints
        for (let sx = cabinX + 30; sx < cabinX + cabinW - 10; sx += 60) {
            groundG.beginFill(0x1a0d04); groundG.drawRect(sx, groundBot - 10, 1, 8); groundG.endFill();
        }
        // Rug in the middle (themed color)
        const rugW = Math.min(260, cabinW * 0.42), rugX = cabinX + cabinW / 2 - rugW / 2;
        groundG.beginFill(accent, 0.35); groundG.drawRect(rugX, groundBot - 12, rugW, 2); groundG.endFill();
        groundG.beginFill(accent, 0.18); groundG.drawRect(rugX, groundBot - 14, rugW, 2); groundG.endFill();
        // Rug pattern — simple bands
        groundG.beginFill(0x1a0d04, 0.4);
        groundG.drawRect(rugX + 10, groundBot - 12, rugW - 20, 1);
        groundG.drawRect(rugX + 10, groundBot - 11, rugW - 20, 1);
        groundG.endFill();
        this.scene.addChild(groundG);

        // ─── EARTH STRIP + ZONE-AWARE UNDERGROUND ───
        // Match the convention used by other zone interiors (agents, robotics, longevity,
        // backbone, embassy): draw a strip of soil flanking the building, then delegate
        // to InteriorCity._drawZoneUnderground which renders the metro tunnel, utility
        // lines (water/elec/sewage) and live trains beneath the ground level.
        const surfaceY = groundBot;
        const undFloorH = 82;
        const belowBasementY = surfaceY + undFloorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x0a1020); earth.drawRect(0, surfaceY, cabinX - 6, undFloorH); earth.drawRect(cabinX + cabinW + 6, surfaceY, W - cabinX - cabinW - 6, undFloorH); earth.endFill();
        earth.beginFill(0x141e30); earth.drawRect(0, surfaceY, cabinX - 6, 6); earth.drawRect(cabinX + cabinW + 6, surfaceY, W - cabinX - cabinW - 6, 6); earth.endFill();
        earth.beginFill(0x1a2a3a); earth.drawRect(0, surfaceY - 2, cabinX - 6, 4); earth.drawRect(cabinX + cabinW + 6, surfaceY - 2, W - cabinX - cabinW - 6, 4); earth.endFill();
        this.scene.addChild(earth);
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, cabinX, cabinW, surfaceY, belowBasementY, undFloorH);
        }

        // ─── CABIN BASEMENT — research archive beneath the cabin ───
        // The strip between surfaceY and belowBasementY sits inside the cabin's footprint
        // but below the ground floor. Filled with institute-themed archive props so the
        // basement feels like a lived-in research storeroom rather than empty void.
        this._drawBasement(cabinX, cabinW, surfaceY, undFloorH, belowBasementY, accent);

        // ─── FIREPLACE (center of ground floor) ───
        const fpW = 90, fpH = 80;
        const fpX = cabinX + cabinW / 2 - fpW / 2;
        const fpY = groundBot - fpH - 10;
        const fp = new PIXI.Graphics();
        // Stone chimney breast going up through the loft & roof
        fp.beginFill(0x5a5a5a);
        fp.drawRect(fpX + 10, groundTop, fpW - 20, groundH - 10);
        fp.endFill();
        // Stone pattern
        fp.beginFill(0x4a4a4a);
        for (let sy = groundTop + 4; sy < groundBot - 10; sy += 10) {
            fp.drawRect(fpX + 12, sy, fpW - 24, 2);
        }
        fp.endFill();
        fp.beginFill(0x6a6a6a);
        for (let sy = groundTop + 8; sy < groundBot - 10; sy += 14) {
            fp.drawRect(fpX + 20, sy - 2, 6, 2);
            fp.drawRect(fpX + fpW - 26, sy + 4, 6, 2);
        }
        fp.endFill();
        // Fireplace opening (arched rectangle)
        fp.beginFill(0x0a0605);
        fp.drawRect(fpX + 18, fpY, fpW - 36, fpH - 8);
        fp.endFill();
        // Mantle
        fp.beginFill(0x3a2818);
        fp.drawRect(fpX + 6, fpY - 8, fpW - 12, 6);
        fp.endFill();
        fp.beginFill(0x5a3e24);
        fp.drawRect(fpX + 6, fpY - 8, fpW - 12, 2);
        fp.endFill();
        // Logs inside
        fp.beginFill(0x6b3018);
        fp.drawRect(fpX + 24, fpY + fpH - 20, fpW - 48, 6);
        fp.drawRect(fpX + 28, fpY + fpH - 26, fpW - 56, 6);
        fp.endFill();
        // Flames (animated later via light pulse) — store ref for update().
        // Drawn with LOCAL coordinates (origin = base centre of the fire) so that
        // `flames.scale.set(1, flick)` pivots from the hearth and the base of the
        // flames stays grounded in the fireplace. Previously vertices were drawn
        // in world coords which caused the fire to jump up & down on the Y axis.
        const flames = new PIXI.Graphics();
        flames.x = fpX + fpW / 2;
        flames.y = fpY + fpH - 18; // base centre — pivot point for flicker
        // Outer flame (yellow)
        flames.beginFill(0xfbbf24, 0.9);
        flames.moveTo(-(fpW / 2 - 28), 0);
        flames.lineTo(0, -28);
        flames.lineTo(fpW / 2 - 28, 0);
        flames.closePath();
        flames.endFill();
        // Inner flame (red, taller core)
        flames.beginFill(0xef4444, 0.7);
        flames.moveTo(-(fpW / 2 - 34), 0);
        flames.lineTo(0, -20);
        flames.lineTo(fpW / 2 - 34, 0);
        flames.closePath();
        flames.endFill();
        // Hot core glow
        flames.beginFill(0xfde68a, 0.85);
        flames.drawCircle(0, -12, 6);
        flames.endFill();
        this._flames = flames; // animate in update()
        this.scene.addChild(fp);
        this.scene.addChild(flames);
        // Firelight glow (registered as indoor light)
        const fireGlow = new PIXI.Graphics();
        fireGlow.beginFill(0xfbbf24, 0.14);
        fireGlow.drawCircle(fpX + fpW / 2, fpY + fpH - 30, 70);
        fireGlow.endFill();
        fireGlow.blendMode = PIXI.BLEND_MODES.ADD;
        this.scene.addChild(fireGlow);
        this.indoorLights.push({ g: fireGlow, maxA: 0.24, type: 'fire' });

        // ─── ARMCHAIRS flanking the fire ───
        const drawArmchair = (ax, ay, facingRight) => {
            const g = new PIXI.Graphics();
            // Back
            g.beginFill(0x7a1f1f); g.drawRect(ax, ay - 22, 26, 22); g.endFill();
            g.beginFill(0x9a2f2f); g.drawRect(ax + 1, ay - 21, 24, 5); g.endFill(); // highlight
            // Seat
            g.beginFill(0x5a1818); g.drawRect(ax - 2, ay, 30, 10); g.endFill();
            g.beginFill(0x7a1f1f); g.drawRect(ax - 2, ay, 30, 3); g.endFill();
            // Arm
            if (facingRight) {
                g.beginFill(0x5a1818); g.drawRect(ax + 26, ay - 18, 4, 28); g.endFill();
            } else {
                g.beginFill(0x5a1818); g.drawRect(ax - 4, ay - 18, 4, 28); g.endFill();
            }
            // Wooden feet
            g.beginFill(0x2a1a0e);
            g.drawRect(ax - 2, ay + 10, 4, 3); g.drawRect(ax + 26, ay + 10, 4, 3);
            g.endFill();
            UI.tip(g, 'Armchair');
            this.scene.addChild(g);
            return g;
        };
        drawArmchair(fpX - 40, groundBot - 14, true);  // left chair, facing right toward fire
        drawArmchair(fpX + fpW + 14, groundBot - 14, false); // right chair, facing left

        // Coffee table between the chairs — but the fire is in the way, so put small side tables instead
        const drawSideTable = (tx, ty) => {
            const g = new PIXI.Graphics();
            g.beginFill(0x3a2818); g.drawRect(tx, ty, 18, 3); g.endFill();
            g.beginFill(0x2a1a0e); g.drawRect(tx + 2, ty + 3, 2, 10); g.drawRect(tx + 14, ty + 3, 2, 10); g.endFill();
            // Book on top
            g.beginFill(0x1e3a8a); g.drawRect(tx + 4, ty - 3, 10, 3); g.endFill();
            g.beginFill(0xfbbf24); g.drawRect(tx + 4, ty - 3, 10, 1); g.endFill();
            UI.tip(g, 'Side Table');
            this.scene.addChild(g);
        };
        drawSideTable(fpX - 52, groundBot - 16);
        drawSideTable(fpX + fpW + 34, groundBot - 16);

        // ─── BOOKSHELVES along the back wall, either side of fireplace ───
        const drawBookshelf = (sx, sy, sw, sh) => {
            const g = new PIXI.Graphics();
            // Frame
            g.beginFill(0x2a1a0e); g.drawRect(sx - 2, sy - 2, sw + 4, sh + 4); g.endFill();
            g.beginFill(0x3a2818); g.drawRect(sx, sy, sw, sh); g.endFill();
            // Shelves
            const rows = 4;
            for (let r = 0; r < rows; r++) {
                const ry = sy + (sh / rows) * (r + 1) - 2;
                g.beginFill(0x2a1a0e); g.drawRect(sx, ry, sw, 2); g.endFill();
                // Books on the shelf above this divider
                let bkx = sx + 2;
                const bookH = (sh / rows) - 4;
                const bookColors = [0x7c2d12, 0x1e3a8a, 0x064e3b, 0x78350f, 0x581c87, 0x831843, 0x0c4a6e];
                while (bkx < sx + sw - 4) {
                    const bw = 3 + Math.floor(Math.random() * 4);
                    const bh = bookH - Math.floor(Math.random() * 4);
                    const bc = bookColors[Math.floor(Math.random() * bookColors.length)];
                    g.beginFill(bc); g.drawRect(bkx, ry - bh, bw, bh); g.endFill();
                    g.beginFill(0xfbbf24, 0.5); g.drawRect(bkx, ry - bh + 2, bw, 1); g.endFill(); // title bar
                    bkx += bw + 1;
                }
            }
            UI.tip(g, 'Bookshelf');
            this.scene.addChild(g);
        };
        const shelfGap = Math.max(20, (cabinW / 2 - fpW / 2 - 80) / 2);
        drawBookshelf(cabinX + shelfGap, groundTop + 20, fpX - cabinX - shelfGap - 10, groundH - 40);
        drawBookshelf(fpX + fpW + 10, groundTop + 20, cabinX + cabinW - (fpX + fpW + 10) - shelfGap, groundH - 40);

        // ─── TALL WINDOWS (behind the armchairs, overlooking forest) ───
        // Loft windows instead — so forest backdrop reads through them
        const drawWindow = (wx, wy, ww, wh) => {
            const g = new PIXI.Graphics();
            g.beginFill(0x2a1a0e); g.drawRect(wx - 3, wy - 3, ww + 6, wh + 6); g.endFill();
            // See through to backdrop — clip an opening
            g.beginFill(0x1a2636); g.drawRect(wx, wy, ww, wh); g.endFill();
            // Pine silhouettes behind the window
            for (let pi = 0; pi < 3; pi++) {
                const px = wx + (ww / 4) * (pi + 1) - 5;
                g.beginFill(0x0e2818);
                g.drawPolygon([px - 6, wy + wh, px, wy + wh * 0.3, px + 6, wy + wh]);
                g.endFill();
            }
            // Cross mullion
            g.beginFill(0x2a1a0e);
            g.drawRect(wx + ww / 2 - 1, wy, 2, wh);
            g.drawRect(wx, wy + wh / 2 - 1, ww, 2);
            g.endFill();
            // Sill
            g.beginFill(0x3a2818); g.drawRect(wx - 4, wy + wh, ww + 8, 3); g.endFill();
            UI.tip(g, 'Window');
            this.scene.addChild(g);
        };
        // Loft-level windows
        drawWindow(cabinX + cabinW - 60, loftTop + 20, 36, 46);
        drawWindow(cabinX + 14, loftTop + 20, 20, 46); // smaller side window

        // ─── FRONT DOOR (ground floor, right side — so the porch glow seen outside makes sense) ───
        const doorW = 28, doorH = 54;
        const doorX = cabinX + cabinW - doorW - 26;
        const doorY = groundBot - doorH - 10;
        const doorG = new PIXI.Graphics();
        doorG.beginFill(0x2a1a0e); doorG.drawRect(doorX - 3, doorY - 3, doorW + 6, doorH + 6); doorG.endFill();
        doorG.beginFill(0x4a2e18); doorG.drawRect(doorX, doorY, doorW, doorH); doorG.endFill();
        doorG.beginFill(0x2a1a0e);
        doorG.drawRect(doorX + doorW / 3 - 1, doorY, 2, doorH);
        doorG.drawRect(doorX + 2 * doorW / 3 - 1, doorY, 2, doorH);
        doorG.endFill();
        doorG.beginFill(0xfbbf24); doorG.drawCircle(doorX + doorW - 5, doorY + doorH / 2, 1.8); doorG.endFill();
        this.scene.addChild(doorG);

        // ─── OVERHEAD LAMP (hanging from loft peak) ───
        const lampX = peakX - 120, lampY = loftBot + 14;
        const lamp = new PIXI.Graphics();
        lamp.lineStyle(1.5, 0x2a1a0e); lamp.moveTo(lampX, loftBot); lamp.lineTo(lampX, lampY); lamp.lineStyle(0);
        lamp.beginFill(0x3a2818); lamp.drawRect(lampX - 9, lampY, 18, 3); lamp.endFill();
        lamp.beginFill(0xfbbf24, 0.9); lamp.drawRect(lampX - 7, lampY + 3, 14, 7); lamp.endFill();
        lamp.beginFill(0xfde68a, 0.85); lamp.drawRect(lampX - 6, lampY + 3, 12, 2); lamp.endFill();
        // Glow
        lamp.beginFill(0xfbbf24, 0.12); lamp.drawCircle(lampX, lampY + 10, 36); lamp.endFill();
        lamp.blendMode = PIXI.BLEND_MODES.ADD;
        this.scene.addChild(lamp);
        this.indoorLights.push({ g: lamp, maxA: 0.22, type: 'lamp' });

        // ─── ROOF SIGN (institute name above the door, seen from outside when entering) ───
        // Wooden carved sign visible above the front door, inside the porch overhang.
        const sgnY = doorY - 12;
        const sgnW = Math.max(90, Math.min(160, doorW + 80));
        const sgnX = doorX + doorW / 2 - sgnW / 2;
        const sgnG = new PIXI.Graphics();
        sgnG.beginFill(0x2a1a0e); sgnG.drawRect(sgnX - 2, sgnY - 2, sgnW + 4, 12); sgnG.endFill();
        sgnG.beginFill(0x5a3a20); sgnG.drawRect(sgnX, sgnY, sgnW, 10); sgnG.endFill();
        sgnG.beginFill(0x4a2e18); sgnG.drawRect(sgnX, sgnY + 8, sgnW, 2); sgnG.endFill();
        this.scene.addChild(sgnG);
        const sgnTxt = new PIXI.Text((bld.name || '').toUpperCase(), {
            fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 'bold',
            fill: 0x1a0f06, letterSpacing: 0.8, padding: 2
        });
        sgnTxt.anchor.set(0.5, 0.5);
        sgnTxt.x = sgnX + sgnW / 2; sgnTxt.y = sgnY + 5;
        if (sgnTxt.width > sgnW - 6) sgnTxt.scale.set((sgnW - 6) / sgnTxt.width);
        this.scene.addChild(sgnTxt);

        // ─── RESEARCHERS (4 avatars — 1 at whiteboard, 1 at desk, 2 by fire) ───
        const boardResearcherX = wbX + wbW + 10;
        const boardResearcherY = loftBot - 20;
        this.avatars.push(this._spawnResearcher(boardResearcherX, boardResearcherY, accent, 'board', theme));
        const deskResearcherX = deskX + 40;
        const deskResearcherY = loftBot - 20;
        this.avatars.push(this._spawnResearcher(deskResearcherX, deskResearcherY, accent, 'desk', theme));
        const chairLeftX = fpX - 30;
        const chairLeftY = groundBot - 30;
        this.avatars.push(this._spawnResearcher(chairLeftX, chairLeftY, accent, 'chair_left', theme));
        const chairRightX = fpX + fpW + 22;
        const chairRightY = groundBot - 30;
        this.avatars.push(this._spawnResearcher(chairRightX, chairRightY, accent, 'chair_right', theme));

        // ─── DRAG-TO-SCROLL SETUP ───
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorAlignment.isDragging || !InteriorAlignment.scene || InteriorAlignment.scene.destroyed) return;
            let ny = InteriorAlignment._startSceneY + (e.clientY - InteriorAlignment._startY);
            ny = Math.max(InteriorAlignment.minY, Math.min(ny, InteriorAlignment.maxY));
            InteriorAlignment.scene.y = ny;
        };
        this._onUp = () => {
            InteriorAlignment.isDragging = false;
            if (InteriorAlignment.layer) InteriorAlignment.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);

        // Scroll bounds — allow scrolling UP (negative scene.y) so the underground
        // (utilities + metro tunnel beneath the cabin) becomes visible, and a
        // little DOWN to see more of the roof/forest backdrop.
        this.minY = -(undFloorH + 260); // far enough up to reveal the deep void
        this.maxY = roofPeakH + 30;
        this.scene.y = 0;

        this._tick = 0;
    },

    // Spawn a researcher avatar with a role-specific behavior.
    // Roles: 'board' (pacing/writing near whiteboard), 'desk' (sitting, occasional bubble),
    //        'chair_left' / 'chair_right' (sitting in armchair, reading)
    _spawnResearcher(x, y, accent, role, theme) {
        const cont = new PIXI.Container();
        cont.x = x; cont.y = y;
        const skinCols = [0xfdd7b0, 0xe8b68a, 0xd19867, 0x8b5a3c, 0x5a3823];
        const skinCol = skinCols[Math.floor(Math.random() * skinCols.length)];
        const shirtCols = [0x374151, 0x1e3a8a, 0x064e3b, 0x7c2d12, 0x581c87, 0x525252];
        const shirtCol = shirtCols[Math.floor(Math.random() * shirtCols.length)];

        // Body (sweater)
        const body = new PIXI.Graphics();
        body.beginFill(shirtCol); body.drawRect(-5, -14, 10, 14); body.endFill();
        body.beginFill(shirtCol, 0.7); body.drawRect(-5, -14, 10, 2); body.endFill();
        cont.addChild(body);
        // Head
        const head = new PIXI.Graphics();
        head.beginFill(skinCol); head.drawCircle(0, -18, 4); head.endFill();
        // Glasses — classic researcher look
        head.lineStyle(1, 0x1a1a1a, 0.85);
        head.drawCircle(-2, -18, 1.5);
        head.drawCircle(2, -18, 1.5);
        head.moveTo(-0.5, -18); head.lineTo(0.5, -18);
        head.lineStyle(0);
        // Hair (small cap)
        head.beginFill(0x2a1a0e, 0.9);
        head.drawRect(-3, -22, 6, 2);
        head.endFill();
        cont.addChild(head);
        // Legs
        const legs = new PIXI.Graphics();
        legs.beginFill(0x1a1a1a); legs.drawRect(-4, 0, 3, 6); legs.drawRect(1, 0, 3, 6); legs.endFill();
        cont.addChild(legs);

        // Arm (a second sleeve for gesturing at the board — only for 'board' role)
        if (role === 'board') {
            const arm = new PIXI.Graphics();
            arm.beginFill(shirtCol); arm.drawRect(-8, -12, 4, 8); arm.endFill();
            arm.beginFill(skinCol); arm.drawCircle(-6, -4, 1.5); arm.endFill();
            // Marker
            arm.beginFill(0xef4444); arm.drawRect(-8, -5, 4, 1); arm.endFill();
            cont.addChild(arm);
        }
        // If sitting (chairs), draw a seated posture by offsetting legs
        if (role === 'chair_left' || role === 'chair_right') {
            legs.y = -4; // legs tuck up (sitting)
            // Book in hand
            const book = new PIXI.Graphics();
            book.beginFill(0x1e3a8a); book.drawRect(-6, -10, 12, 6); book.endFill();
            book.beginFill(0xf9fafb); book.drawRect(-5, -9, 10, 4); book.endFill();
            book.beginFill(0x94a3b8); book.drawRect(-4, -8, 8, 0.5); book.drawRect(-4, -7, 7, 0.5); book.drawRect(-4, -6, 6, 0.5); book.endFill();
            cont.addChild(book);
            cont.scale.x = (role === 'chair_left') ? 1 : -1; // mirror right chair
        }
        // Desk researcher: hunched forward slightly
        if (role === 'desk') {
            cont.scale.x = -1; // face the terminal (terminal is to their left)
        }

        // (Floating researcher-id tag removed — hover tooltip + info panel cover this.)

        cont._role = role;
        cont._accent = accent;
        cont._bubbles = theme.bubbles || ['Thinking…'];
        cont._bubbleTimer = 200 + Math.floor(Math.random() * 400);
        cont._baseX = x;
        cont._phase = Math.random() * Math.PI * 2;

        // ─── HOVER + CLICK — match the rest of the city's NPC interaction pattern ───
        const tagName = theme.researcherTag || 'Researcher';
        const labName = (this.bld && this.bld.name) || 'Alignment Forest';
        // Friendlier role labels per slot
        const roleLabels = {
            board: 'Whiteboard Researcher', desk: 'Senior Research Engineer',
            chair_left: 'Visiting Fellow', chair_right: 'Reading Fellow'
        };
        const roleLabel = roleLabels[role] || 'Researcher';
        const npcId = 'npc_align_' + (this.bld ? this.bld.id : 'x') + '_' + role;
        const desc = roleLabel + ' at ' + labName + '. ' +
            ((this.bld && this.bld.desc) ? this.bld.desc : 'Alignment safety research.');
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        // Hit area expanded above the head for the role tag and bubbles. Note: this
        // hit area lives in LOCAL space, so it works correctly even when the
        // container is mirrored (scale.x = -1).
        cont.hitArea = new PIXI.Rectangle(-12, -28, 24, 36);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                UI.selectModel({
                    id: npcId, name: tagName + ' ' + roleLabel,
                    isNPC: true, _trackType: 'npc',
                    role: roleLabel, lab: 'alignment', desc
                });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) {
                UI.showTooltip(e, tagName + ' — ' + roleLabel, labName);
            }
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
        });

        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }
        if (!this.avatars) this.avatars = [];
        this.avatars.push({ m: { id: npcId, name: roleLabel, isNPC: true }, cont });

        this.scene.addChild(cont);
        return cont;
    },

    update() {
        this._tick = (this._tick || 0) + 1;
        const t = this._tick;

        // Twinkle stars
        if (this.starsLayer) {
            this.starsLayer.children.forEach((s, i) => {
                s.alpha = 0.55 + 0.35 * Math.sin(t * 0.02 + (s._phase || i));
            });
        }

        // Day/night sky tint + sun/moon — shared with the rest of the city
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky && this.celestialGfx) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }

        // Live trains beneath the cabin (added by InteriorCity._drawZoneUnderground)
        if (typeof InteriorCity !== 'undefined' && InteriorCity._liveTrains) {
            InteriorCity._liveTrains.update();
        }

        // Fire flicker
        if (this._flames && !this._flames.destroyed) {
            const flick = 0.9 + 0.15 * Math.sin(t * 0.35) + 0.05 * Math.sin(t * 1.1);
            this._flames.scale.set(1, flick);
            this._flames.alpha = 0.82 + 0.12 * Math.sin(t * 0.28);
        }

        // Indoor light pulsing — fire glow responds to flicker, lamps are steady
        if (this.indoorLights) {
            this.indoorLights.forEach(l => {
                if (!l.g || l.g.destroyed) return;
                if (l.type === 'fire') {
                    l.g.alpha = (l.maxA || 0.25) * (0.88 + 0.14 * Math.sin(t * 0.3));
                } else if (l.type === 'lamp') {
                    l.g.alpha = (l.maxA || 0.2) * (0.95 + 0.03 * Math.sin(t * 0.08));
                } else if (l.type === 'screen') {
                    l.g.alpha = (l.maxA || 0.9) * (0.96 + 0.04 * Math.sin(t * 0.25));
                }
            });
        }

        // Researcher animations
        if (this.avatars) {
            this.avatars.forEach(av => {
                if (!av || av.destroyed) return;
                if (av._role === 'board') {
                    // Pace subtly left-right in front of the whiteboard
                    av.x = av._baseX + Math.sin(t * 0.015 + av._phase) * 18;
                } else if (av._role === 'desk') {
                    // Very subtle hunch/unhunch
                    av.y = (av.y || 0); // keep constant
                    av.rotation = Math.sin(t * 0.008) * 0.02;
                }
                // chair_left / chair_right stay put — reading

                // Bubble timer
                av._bubbleTimer--;
                if (av._bubbleTimer <= 0 && av._bubbles && av._bubbles.length) {
                    this._popBubble(av, av._bubbles[Math.floor(Math.random() * av._bubbles.length)]);
                    av._bubbleTimer = 600 + Math.floor(Math.random() * 800);
                }
                // Update active bubble — bubble lives on this.scene now (not as an
                // avatar child) so we have to manually track the avatar's position.
                if (av._bubble && !av._bubble.destroyed) {
                    av._bubble.x = av.x + (av._bubble._offX || 6);
                    av._bubble.y = av.y + (av._bubble._offY || -30);
                    av._bubble._life--;
                    av._bubble.alpha = Math.min(1, av._bubble._life / 30) * Math.min(1, (240 - av._bubble._life) / 30);
                    if (av._bubble._life <= 0) {
                        av._bubble.destroy();
                        av._bubble = null;
                    }
                }
            });
        }
    },

    // ─── CABIN BASEMENT — research archive beneath the cabin ───
    // Called from build() after the zone-underground has been drawn. Paints the
    // strip inside the cabin's footprint (surfaceY → belowBasementY) with a
    // lived-in research storeroom: foundation walls, joists, concrete floor,
    // crates with institute-accent stencil, filing cabinet with spilling papers,
    // leaning whiteboard with faded scribbles, book stack, wine/tea rack,
    // workbench with tea mug + green banker's lamp, hanging bulb, and a cobweb.
    _drawBasement(cabinX, cabinW, surfaceY, undFloorH, belowBasementY, accent) {
        const g = new PIXI.Graphics();
        const bx = cabinX, bw = cabinW;
        const by = surfaceY, bh = undFloorH;
        const bBot = belowBasementY;

        // ─── Dark earth back wall ───
        g.beginFill(0x2a1e14);
        g.drawRect(bx, by, bw, bh);
        g.endFill();

        // ─── Wooden ceiling joists ───
        g.beginFill(0x1a1008);
        g.drawRect(bx, by, bw, 5);
        g.endFill();
        g.beginFill(0x3a2814);
        for (let jx = bx + 14; jx < bx + bw - 10; jx += 22) {
            g.drawRect(jx, by + 5, 4, 3);
        }
        g.endFill();

        // ─── Stone foundation walls (inner edges) ───
        g.beginFill(0x3a3226);
        g.drawRect(bx, by + 4, 6, bh - 4);
        g.drawRect(bx + bw - 6, by + 4, 6, bh - 4);
        g.endFill();
        // Stone block pattern
        g.beginFill(0x2a221a);
        for (let sy = by + 10; sy < bBot - 8; sy += 10) {
            g.drawRect(bx, sy, 6, 1);
            g.drawRect(bx + bw - 6, sy, 6, 1);
        }
        g.endFill();

        // ─── Dusty concrete floor ───
        const floorY = bBot - 7;
        g.beginFill(0x3a342a);
        g.drawRect(bx + 6, floorY, bw - 12, 7);
        g.endFill();
        g.beginFill(0x2a241a);
        g.drawRect(bx + 6, floorY, bw - 12, 1);
        g.endFill();
        // Floor seams
        g.beginFill(0x241e14);
        g.drawRect(bx + 6 + (bw - 12) / 3, floorY, 1, 7);
        g.drawRect(bx + 6 + 2 * (bw - 12) / 3, floorY, 1, 7);
        g.endFill();
        // Water stain
        g.beginFill(0x1a1a0e, 0.45);
        g.drawEllipse(bx + bw / 2 + 22, floorY + 4, 14, 3);
        g.endFill();

        // ─── CRATES (left, stacked) ───
        const crateX = bx + 10;
        // Bottom crate
        g.beginFill(0x5a3e22);
        g.drawRect(crateX, floorY - 16, 18, 16);
        g.endFill();
        g.beginFill(0x6e4e2e);
        g.drawRect(crateX + 2, floorY - 14, 14, 2);
        g.drawRect(crateX + 2, floorY - 4, 14, 2);
        g.endFill();
        g.beginFill(0x3a2414);
        g.drawRect(crateX, floorY - 16, 18, 1);
        g.drawRect(crateX, floorY - 1, 18, 1);
        g.endFill();
        // Institute-accent stencil
        g.beginFill(accent, 0.75);
        g.drawRect(crateX + 4, floorY - 10, 10, 1);
        g.drawRect(crateX + 5, floorY - 8, 8, 1);
        g.endFill();
        // Top crate (smaller, offset)
        g.beginFill(0x5a3e22);
        g.drawRect(crateX + 2, floorY - 28, 14, 12);
        g.endFill();
        g.beginFill(0x6e4e2e);
        g.drawRect(crateX + 4, floorY - 26, 10, 2);
        g.drawRect(crateX + 4, floorY - 20, 10, 2);
        g.endFill();
        g.beginFill(0x3a2414);
        g.drawRect(crateX + 2, floorY - 28, 14, 1);
        g.drawRect(crateX + 2, floorY - 17, 14, 1);
        g.endFill();

        // ─── FILING CABINET (next to crates) ───
        const fcX = crateX + 22;
        const fcY = floorY - 28;
        g.beginFill(0x5a5a5e);
        g.drawRect(fcX, fcY, 18, 28);
        g.endFill();
        g.beginFill(0x6a6a6e);
        g.drawRect(fcX + 1, fcY + 1, 16, 1);
        g.endFill();
        g.beginFill(0x3a3a3e);
        g.drawRect(fcX, fcY + 27, 18, 1);
        g.endFill();
        // 3 drawers
        for (let d = 0; d < 3; d++) {
            const dy = fcY + 2 + d * 8;
            g.beginFill(0x4a4a4e);
            g.drawRect(fcX + 1, dy, 16, 7);
            g.endFill();
            g.beginFill(0x9a9a9e);
            g.drawRect(fcX + 7, dy + 3, 4, 1);
            g.endFill();
            g.beginFill(0x2a2a2e);
            g.drawRect(fcX + 1, dy + 7, 16, 1);
            g.endFill();
        }
        // Papers spilling out of top drawer
        g.beginFill(0xf0ead8);
        g.drawRect(fcX + 2, fcY - 1, 5, 4);
        g.drawRect(fcX + 9, fcY - 2, 6, 5);
        g.endFill();
        g.beginFill(0x4a4a5a);
        g.drawRect(fcX + 3, fcY + 1, 3, 1);
        g.drawRect(fcX + 10, fcY, 4, 1);
        g.endFill();

        // ─── LEANING WHITEBOARD ───
        const wbX = fcX + 22;
        const wbY = floorY - 30;
        g.beginFill(0x3a2814);
        g.drawRect(wbX - 1, wbY - 1, 26, 32);
        g.endFill();
        g.beginFill(0xf0ece0);
        g.drawRect(wbX, wbY, 24, 30);
        g.endFill();
        g.beginFill(0x5a3e22);
        g.drawRect(wbX - 1, wbY - 1, 26, 2);
        g.drawRect(wbX - 1, wbY + 29, 26, 2);
        g.drawRect(wbX - 1, wbY - 1, 2, 32);
        g.drawRect(wbX + 23, wbY - 1, 2, 32);
        g.endFill();
        // Faded grey scribbles
        g.beginFill(0x8a8a8a, 0.55);
        g.drawRect(wbX + 3, wbY + 4, 14, 1);
        g.drawRect(wbX + 3, wbY + 7, 10, 1);
        g.drawRect(wbX + 5, wbY + 10, 12, 1);
        g.drawRect(wbX + 3, wbY + 14, 8, 1);
        g.drawRect(wbX + 13, wbY + 14, 6, 1);
        g.endFill();
        // Accent-color scribbles + arrow
        g.beginFill(accent, 0.75);
        g.drawRect(wbX + 3, wbY + 18, 14, 1);
        g.drawRect(wbX + 3, wbY + 21, 10, 1);
        g.drawRect(wbX + 5, wbY + 24, 8, 1);
        g.endFill();
        g.lineStyle(1, accent, 0.8);
        g.moveTo(wbX + 14, wbY + 19);
        g.lineTo(wbX + 19, wbY + 19);
        g.moveTo(wbX + 17, wbY + 17);
        g.lineTo(wbX + 19, wbY + 19);
        g.moveTo(wbX + 17, wbY + 21);
        g.lineTo(wbX + 19, wbY + 19);
        g.lineStyle(0);

        // ─── BOOK STACK ───
        const bsX = wbX + 28;
        const bsY = floorY - 2;
        const bookColors = [0x3a3a8a, 0x8a3a3a, 0x3a6a3a, 0x8a5a7a, 0x6a3a8a];
        for (let i = 0; i < bookColors.length; i++) {
            g.beginFill(bookColors[i]);
            g.drawRect(bsX, bsY - (i + 1) * 3, 12, 3);
            g.endFill();
            g.beginFill(0xf0ead8);
            g.drawRect(bsX + 1, bsY - (i + 1) * 3 + 1, 10, 1);
            g.endFill();
        }

        // ─── WINE / TEA RACK ───
        const wrX = bsX + 16;
        const wrY = floorY - 22;
        if (wrX + 26 < bx + bw - 50) {
            g.beginFill(0x3a2814);
            g.drawRect(wrX, wrY, 26, 22);
            g.endFill();
            g.beginFill(0x5a3e22);
            g.drawRect(wrX, wrY, 26, 2);
            g.drawRect(wrX, wrY + 20, 26, 2);
            g.drawRect(wrX, wrY + 10, 26, 2);
            g.drawRect(wrX, wrY, 2, 22);
            g.drawRect(wrX + 24, wrY, 2, 22);
            g.endFill();
            const bottleColors = [0x3a6a3a, 0x5a3a3a, 0x3a5a6a];
            for (let b = 0; b < 3; b++) {
                g.beginFill(bottleColors[b]);
                g.drawRect(wrX + 4 + b * 7, wrY + 3, 4, 7);
                g.endFill();
            }
            for (let b = 0; b < 3; b++) {
                g.beginFill(bottleColors[(b + 1) % 3]);
                g.drawRect(wrX + 4 + b * 7, wrY + 13, 4, 7);
                g.endFill();
            }
        }

        // ─── WORKBENCH (right side) ───
        const wbchX = Math.max(wrX + 30, bx + bw - 90);
        const wbchY = floorY - 12;
        const wbchW = (bx + bw - 10) - wbchX;
        if (wbchW > 40) {
            // Top + shadow
            g.beginFill(0x5a3e22);
            g.drawRect(wbchX, wbchY, wbchW, 4);
            g.endFill();
            g.beginFill(0x3a2414);
            g.drawRect(wbchX, wbchY + 3, wbchW, 1);
            g.endFill();
            // Legs
            g.beginFill(0x3a2414);
            g.drawRect(wbchX + 2, wbchY + 4, 3, 8);
            g.drawRect(wbchX + wbchW - 5, wbchY + 4, 3, 8);
            g.endFill();
            // Stacked papers
            g.beginFill(0xf0ead8);
            g.drawRect(wbchX + 4, wbchY - 4, 10, 4);
            g.endFill();
            g.beginFill(0x4a4a5a);
            g.drawRect(wbchX + 5, wbchY - 3, 7, 1);
            g.drawRect(wbchX + 5, wbchY - 1, 6, 1);
            g.endFill();
            // Tea mug
            const mugX = wbchX + 18;
            g.beginFill(0xf0f0e8);
            g.drawRect(mugX, wbchY - 5, 5, 5);
            g.endFill();
            g.beginFill(0x5a3a1a);
            g.drawRect(mugX + 1, wbchY - 5, 3, 1);
            g.endFill();
            g.lineStyle(1, 0xf0f0e8);
            g.moveTo(mugX + 5, wbchY - 4);
            g.lineTo(mugX + 7, wbchY - 3);
            g.lineTo(mugX + 5, wbchY - 1);
            g.lineStyle(0);
            // Green banker's lamp
            const lmpX = wbchX + wbchW - 16;
            const lmpY = wbchY - 12;
            g.beginFill(0x2a6a3a);
            g.drawRect(lmpX, lmpY, 10, 3);
            g.endFill();
            g.beginFill(0x3a8a4a);
            g.drawRect(lmpX, lmpY, 10, 1);
            g.endFill();
            g.beginFill(0x1a4a2a);
            g.drawRect(lmpX, lmpY + 3, 10, 1);
            g.endFill();
            g.beginFill(0x8a6a2a);
            g.drawRect(lmpX + 4, lmpY + 3, 2, 8);
            g.drawRect(lmpX + 2, lmpY + 11, 6, 1);
            g.endFill();
            // Warm glow
            g.beginFill(0xffd060, 0.28);
            g.drawEllipse(lmpX + 5, lmpY + 4, 10, 3);
            g.endFill();
        }

        // ─── HANGING BULB (center) ───
        const blbX = bx + bw / 2;
        const blbY = by + 5;
        g.lineStyle(1, 0x3a3a3a);
        g.moveTo(blbX, blbY);
        g.lineTo(blbX, blbY + 18);
        g.lineStyle(0);
        g.beginFill(0x7a6a3a);
        g.drawRect(blbX - 1, blbY + 17, 2, 2);
        g.endFill();
        g.beginFill(0xfff0c0, 0.95);
        g.drawCircle(blbX, blbY + 22, 3);
        g.endFill();
        // Soft glow
        g.beginFill(0xffd060, 0.16);
        g.drawCircle(blbX, blbY + 22, 14);
        g.endFill();
        g.beginFill(0xffd060, 0.08);
        g.drawCircle(blbX, blbY + 22, 22);
        g.endFill();

        // ─── COBWEB (top-right corner) ───
        const cwX = bx + bw - 10;
        const cwY = by + 6;
        g.lineStyle(1, 0xa0a0a0, 0.45);
        g.moveTo(cwX, cwY);
        g.lineTo(cwX - 10, cwY + 10);
        g.moveTo(cwX, cwY);
        g.lineTo(cwX + 2, cwY + 12);
        g.moveTo(cwX, cwY);
        g.lineTo(cwX - 4, cwY + 14);
        g.moveTo(cwX - 8, cwY + 4);
        g.lineTo(cwX + 1, cwY + 6);
        g.moveTo(cwX - 6, cwY + 9);
        g.lineTo(cwX + 1, cwY + 11);
        g.lineStyle(0);

        this.scene.addChild(g);
    },

    _popBubble(av, text) {
        if (av._bubble && !av._bubble.destroyed) av._bubble.destroy();
        const cont = new PIXI.Container();
        const txt = new PIXI.Text(text, {
            fontFamily: 'JetBrains Mono', fontSize: 7, fill: 0x1a0f06, padding: 2
        });
        txt.anchor.set(0, 0.5);
        const padX = 6, padY = 3;
        const bw = txt.width + padX * 2;
        const bh = txt.height + padY * 2;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xfffbe8, 0.95);
        bg.drawRoundedRect(0, -bh / 2, bw, bh, 4);
        bg.endFill();
        bg.lineStyle(1, av._accent || 0x6ab868, 0.6);
        bg.drawRoundedRect(0, -bh / 2, bw, bh, 4);
        bg.lineStyle(0);
        // Little tail
        bg.beginFill(0xfffbe8, 0.95);
        bg.drawPolygon([4, bh / 2 - 1, 10, bh / 2 + 4, 14, bh / 2 - 1]);
        bg.endFill();
        txt.x = padX;
        cont.addChild(bg);
        cont.addChild(txt);
        // Parent to the scene (NOT to the avatar) so the bubble does not inherit
        // the avatar's scale.x = -1 flip (which used to mirror the text). The
        // bubble's world position is updated each frame in update() to follow
        // the avatar's head.
        cont.x = av.x + 6; cont.y = av.y - 30;
        cont._life = 220;
        cont._offX = 6; cont._offY = -30;
        this.scene.addChild(cont);
        av._bubble = cont;
    }
};

if (typeof window !== 'undefined') window.InteriorAlignment = InteriorAlignment;
