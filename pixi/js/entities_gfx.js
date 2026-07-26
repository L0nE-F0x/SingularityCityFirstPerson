/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENTITIES GRAPHICS (v16.4.0 - Dynamic Metro & Silos Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EntitiesGfx = {
    initCEO(f, carLayer, reflectionLayer) {
        const colHex = parseInt((LABS[f.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        
        const drawBody = (g) => {
            g.beginFill(colHex); g.drawRoundedRect(-22, -18, 44, 18, 4); g.endFill();
            g.beginFill(colHex, 0.8); g.drawRoundedRect(-12, -28, 24, 12, 4); g.endFill();
            g.beginFill(0x333333); g.drawCircle(-12, -1, 4); g.drawCircle(12, -1, 4); g.endFill();
            g.beginFill(0xffffff, 1.0); g.drawRect(20, -8, 4, 6); g.endFill();
            g.beginFill(0xff3333, 1.0); g.drawRect(-26, -10, 4, 4); g.endFill();
        };

        const carCont = new PIXI.Container(); 
        const gfx = new PIXI.Graphics();
        drawBody(gfx); 
        carCont.addChild(gfx);

        const beam = new PIXI.Graphics(); 
        beam.beginFill(0xffffee, 0.4); 
        beam.drawPolygon([24, -8, 200, -40, 200, 30, 24, 0]); 
        beam.endFill();
        beam.blendMode = PIXI.BLEND_MODES.ADD; 
        carCont.addChildAt(beam, 0); 

        const face = new PIXI.Graphics(); 
        face.beginFill(0xfdd8b5); face.drawCircle(0, 0, 4); face.endFill(); 
        face.beginFill(0x2c1810); face.drawCircle(-1.5, -0.5, 0.8); 
        face.drawCircle(1.5, -0.5, 0.8); face.endFill(); 
        face.x = 0; face.y = -22; 
        carCont.addChild(face);

        const refCont = new PIXI.Container();
        const refGfx = new PIXI.Graphics(); 
        drawBody(refGfx); 
        refGfx.tint = 0x5555aa; 
        refCont.addChild(refGfx);

        carCont.eventMode = 'static';
        carCont.cursor = 'pointer'; 
        carCont.hitArea = new PIXI.Rectangle(window.isMobile ? -35 : -25, window.isMobile ? -45 : -35, window.isMobile ? 70 : 50, window.isMobile ? 60 : 40);
        carCont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.showFounder(f); });
        carCont.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, f.name, f.role); });
        carCont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(carCont); 
        reflectionLayer.addChild(refCont);

        carCont.visible = false;
        refCont.visible = false;

        const startDir = Math.random() > 0.5 ? 1 : -1;
        const startX = startDir > 0 ? -(200 + Math.random() * 1500) : (G.cityW + 200 + Math.random() * 1500);

        return {
            f: f,
            carCont: carCont,
            refCont: refCont,
            beam: beam,
            bld: null,
            wantsToEnter: false,
            wantsToLeave: false,
            logicalX: startX,
            targetX: startX,
            speed: 2 + Math.random(), 
            dir: startDir,
            _hasResetForMorning: false
        };
    },

    initHelicopter(f, carLayer) {
        const colHex = parseInt((LABS[f.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        const cont = new PIXI.Container();
        cont.visible = false;
        
        const body = new PIXI.Graphics();
        
        // Tail boom — long tapered bar
        body.beginFill(colHex, 0.7); body.drawRect(-44, -3, 26, 5); body.endFill();
        // Tail boom stripe
        body.beginFill(0x000000, 0.15); body.drawRect(-44, -1, 26, 2); body.endFill();
        // Tail fin (vertical stabilizer)
        body.beginFill(colHex, 0.9);
        body.drawPolygon([-44, -3, -50, -14, -42, -3]);
        body.endFill();
        body.beginFill(0xffffff, 0.15);
        body.drawPolygon([-44, -3, -48, -10, -44, -5]);
        body.endFill();
        // Tail rotor housing
        body.beginFill(0x1e293b); body.drawRect(-50, -12, 5, 14); body.endFill();
        // Tail rotor disc
        body.beginFill(0x94a3b8, 0.4); body.drawEllipse(-48, -5, 2, 8); body.endFill();
        
        // Main fuselage — rounded, premium shape
        body.beginFill(colHex); body.drawRoundedRect(-20, -12, 44, 18, 7); body.endFill();
        // Fuselage belly highlight
        body.beginFill(0xffffff, 0.08); body.drawRoundedRect(-18, 0, 40, 5, 3); body.endFill();
        // Fuselage top shadow
        body.beginFill(0x000000, 0.12); body.drawRoundedRect(-18, -12, 40, 5, 3); body.endFill();
        
        // Engine housing (top bulge behind rotor mast)
        body.beginFill(colHex, 0.85); body.drawRoundedRect(-8, -16, 20, 6, 3); body.endFill();
        body.beginFill(0x000000, 0.1); body.drawRect(-6, -16, 16, 2); body.endFill();
        // Engine exhaust vent
        body.beginFill(0x334155); body.drawRect(-10, -14, 4, 4); body.endFill();
        
        // Rotor mast
        body.beginFill(0x64748b); body.drawRect(-1, -18, 3, 6); body.endFill();
        
        // Cockpit windshield — larger, angled, glassy
        body.beginFill(0x0f172a, 0.8); body.drawRoundedRect(14, -10, 14, 14, 4); body.endFill();
        body.beginFill(0x38bdf8, 0.35); body.drawRoundedRect(15, -9, 12, 12, 3); body.endFill();
        // Windshield frame divider
        body.beginFill(colHex, 0.6); body.drawRect(20, -9, 1, 12); body.endFill();
        // Windshield reflection
        body.beginFill(0xffffff, 0.12);
        body.drawPolygon([16, -8, 22, -8, 16, -2]);
        body.endFill();
        
        // Door line
        body.beginFill(0x000000, 0.15); body.drawRect(2, -10, 1, 14); body.endFill();
        
        // Skids (landing gear) — more detailed
        body.beginFill(0x475569);
        body.drawRect(-14, 6, 3, 7); body.drawRect(12, 6, 3, 7); // Struts
        body.endFill();
        body.beginFill(0x64748b);
        body.drawRoundedRect(-20, 12, 40, 2, 1); // Cross bar
        body.endFill();
        
        // Navigation lights
        body.beginFill(0xef4444); body.drawCircle(-44, -1, 2); body.endFill(); // Tail red
        body.beginFill(0x4ade80); body.drawCircle(26, -2, 2); body.endFill(); // Nose green
        // Anti-collision beacon on top
        body.beginFill(0xffffff, 0.6); body.drawCircle(2, -16, 1.5); body.endFill();
        
        // Lab color accent stripe along fuselage
        body.beginFill(0xffffff, 0.2); body.drawRect(-18, -4, 42, 2); body.endFill();
        
        cont.addChild(body);
        
        // CEO/Founder face in cockpit
        const face = new PIXI.Graphics();
        face.beginFill(0xfdd8b5); face.drawCircle(0, 0, 3.5); face.endFill(); // Head
        face.beginFill(0x2c1810); face.drawCircle(-1.2, -0.5, 0.7); face.drawCircle(1.2, -0.5, 0.7); face.endFill(); // Eyes
        face.beginFill(0x2c1810, 0.4); face.drawRect(-2.5, -3.5, 5, 2); face.endFill(); // Hair
        face.x = 21; face.y = -3;
        cont.addChild(face);
        
        // Main rotor — 4 blades
        const rotor = new PIXI.Graphics();
        rotor.beginFill(0x94a3b8, 0.7); rotor.drawRect(-30, -1.5, 60, 3); rotor.endFill();
        rotor.beginFill(0x94a3b8, 0.5); rotor.drawRect(-1.5, -30, 3, 60); rotor.endFill();
        // Blade tips
        rotor.beginFill(0xef4444, 0.6);
        rotor.drawRect(-30, -1.5, 4, 3); rotor.drawRect(26, -1.5, 4, 3);
        rotor.drawRect(-1.5, -30, 3, 4); rotor.drawRect(-1.5, 26, 3, 4);
        rotor.endFill();
        rotor.y = -18;
        cont.addChild(rotor);
        
        // Rotor disc blur (visible when spinning fast)
        const rotorBlur = new PIXI.Graphics();
        rotorBlur.beginFill(0x94a3b8, 0.06); rotorBlur.drawCircle(0, -18, 32); rotorBlur.endFill();
        rotorBlur.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(rotorBlur);
        
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(window.isMobile ? -62 : -52, window.isMobile ? -45 : -35, window.isMobile ? 102 : 82, window.isMobile ? 72 : 52);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.showFounder(f); });
        cont.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, `${f.name}'s Helicopter`, 'CEO scenic flyover'); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(cont);
        
        return {
            f: f,
            cont: cont,
            body: body,
            rotor: rotor,
            rotorBlur: rotorBlur,
            state: 'hidden',
            logicalX: 0,
            logicalY: 0,
            targetX: 0,
            targetY: 0,
            homeX: 0,
            homeY: 0,
            timer: 0,
            speed: 4
        };
    },

    initMetro(undergroundLayer, charLayer, carLayer, trainLayer) {
        const tunnelY = G.groundY + 120;
        
        let resStation = G.bldById ? G.bldById['metro_res'] : null;
        let hqStation = G.bldById ? G.bldById['metro_hq'] : null;
        let eastStation = G.bldById ? G.bldById['metro_east'] : null;
        let dcStation = G.bldById ? G.bldById['metro_dc'] : null;
        let midStation = G.bldById ? G.bldById['metro_mid'] : null;
        let longStation = G.bldById ? G.bldById['metro_longevity'] : null;

        let mResX = resStation ? resStation.x + resStation.w / 2 : 1350;
        let mHqX = hqStation ? hqStation.x + hqStation.w / 2 : 4700;
        let mEastX = eastStation ? eastStation.x + eastStation.w / 2 : 7000;
        let mDcX = dcStation ? dcStation.x + dcStation.w / 2 : null;
        let mMidX = midStation ? midStation.x + midStation.w / 2 : null;
        let mLongX = longStation ? longStation.x + longStation.w / 2 : null;

        // 1. Draw Massive Tunnel (oversized to survive any city expansion)
        const gfx = new PIXI.Graphics();
        const tunnelW = 50000;
        gfx.beginFill(0x050508);
        gfx.drawRect(-2000, tunnelY - 50, tunnelW, 100);
        gfx.endFill();
        
        gfx.beginFill(0x1a1a24);
        gfx.drawRect(-2000, tunnelY + 30, tunnelW, 20);
        gfx.endFill();
        
        gfx.beginFill(0x4a4a5a);
        gfx.drawRect(-2000, tunnelY + 35, tunnelW, 3);
        gfx.drawRect(-2000, tunnelY + 42, tunnelW, 3);
        gfx.endFill();
        
        for (let x = -1000; x < 48000; x += 150) {
            gfx.beginFill(0x111115);
            gfx.drawRect(x, tunnelY - 50, 20, 100);
            gfx.endFill();
            gfx.beginFill(0xef4444);
            gfx.drawCircle(x + 10, tunnelY - 30, 2);
            gfx.endFill();
        }
        undergroundLayer.addChild(gfx);

        // 2. Dynamic Station Visuals
        const stationVisuals = [];
        const stationDefs = [
            { x: mResX, label: "RESIDENTIAL SECTOR", col: 0x38bdf8, bldId: 'metro_res' },
            { x: mHqX, label: "TECH DISTRICT", col: 0xfacc15, bldId: 'metro_hq' },
            { x: mEastX, label: "EASTERN HUB", col: 0xa855f7, bldId: 'metro_east' }
        ];
        if (mDcX) stationDefs.splice(0, 0, { x: mDcX, label: "COMPUTE DISTRICT", col: 0x06b6d4, bldId: 'metro_dc' });
        if (mMidX) stationDefs.splice(stationDefs.findIndex(s => s.label === "EASTERN HUB"), 0, { x: mMidX, label: "CENTRAL LINE", col: 0xf97316, bldId: 'metro_mid' });
        if (mLongX) stationDefs.push({ x: mLongX, label: "INNOVATION LINE", col: 0x22c55e, bldId: 'metro_longevity' });
        
        stationDefs.forEach((sd, idx) => {
            const sx = sd.x;
            const col = sd.col;
            const pWidth = 360;
            const pLeft = -pWidth / 2;

            const statCont = new PIXI.Container();
            statCont.x = sx;

            const pGfx = new PIXI.Graphics();
            pGfx.beginFill(0x0a0a12);
            pGfx.drawRect(pLeft, tunnelY - 70, pWidth, 70);
            pGfx.endFill();

            pGfx.lineStyle(1, 0x1e1e2f, 0.5);
            for(let wx = pLeft; wx <= pWidth/2; wx += 20) {
                pGfx.moveTo(wx, tunnelY - 70);
                pGfx.lineTo(wx, tunnelY);
            }
            pGfx.lineStyle(0);

            pGfx.beginFill(0x11111a);
            pGfx.drawRect(-140, tunnelY - 70, 15, 70);
            pGfx.drawRect(125, tunnelY - 70, 15, 70);
            pGfx.endFill();

            pGfx.beginFill(0x2a2a3e);
            pGfx.drawRect(pLeft, tunnelY - 5, pWidth, 15); 
            pGfx.endFill();
            
            pGfx.beginFill(0xfacc15); 
            pGfx.drawRect(pLeft, tunnelY + 8, pWidth, 2);
            pGfx.endFill();

            pGfx.beginFill(0xd97706);
            for(let tx = pLeft; tx < pWidth/2; tx += 6) {
                pGfx.drawRect(tx, tunnelY + 6, 4, 2);
            }
            pGfx.endFill();
            statCont.addChild(pGfx);

            const signCol = col;
            const signX = -90;

            const signBg = new PIXI.Graphics();
            signBg.beginFill(0x05050a);
            signBg.lineStyle(1, signCol, 0.5);
            signBg.drawRect(signX - 70, tunnelY - 50, 140, 16);
            signBg.endFill();
            statCont.addChild(signBg);

            const neonSign = new PIXI.Text(sd.label, { 
                fontFamily: 'Silkscreen', fontSize: 8, fill: signCol, 
                dropShadow: true, dropShadowColor: signCol, dropShadowBlur: 5, dropShadowDistance: 0 
            });
            neonSign.anchor.set(0.5, 0.5); 
            neonSign.x = signX; 
            neonSign.y = tunnelY - 42;
            statCont.addChild(neonSign);

            undergroundLayer.addChild(statCont);

            const backCutout = new PIXI.Graphics();
            backCutout.beginFill(0x050508);
            backCutout.drawRect(-20, G.groundY, 40, tunnelY - G.groundY - 5);
            backCutout.endFill();
            backCutout.x = sx;
            undergroundLayer.addChild(backCutout);

            const glassFront = new PIXI.Graphics();
            glassFront.beginFill(0x22d3ee, 0.1);
            glassFront.lineStyle(2, 0x22d3ee, 0.4);
            glassFront.drawRect(-20, G.groundY - 35, 40, tunnelY - G.groundY + 30);
            glassFront.endFill();
            glassFront.lineStyle(0);
            glassFront.x = sx;
            undergroundLayer.addChild(glassFront);

            stationVisuals.push({ statCont, backCutout, glassFront, _bldId: sd.bldId });
        });

        const bunkerGfx = new PIXI.Graphics();
        charLayer.addChildAt(bunkerGfx, 0);
        const bunkerTxts = [];

        this.drawBunkers(bunkerGfx, charLayer, bunkerTxts);

        const tW = this.createTrainObj(trainLayer, carLayer, mResX, mHqX, 180, tunnelY);
        const tE = mMidX ? this.createTrainObj(trainLayer, carLayer, mHqX, mMidX, 90, tunnelY) : this.createTrainObj(trainLayer, carLayer, mHqX, mEastX, 90, tunnelY);
        const tM = mMidX ? this.createTrainObj(trainLayer, carLayer, mMidX, mEastX, 45, tunnelY) : null;
        const tD = mDcX ? this.createTrainObj(trainLayer, carLayer, mDcX, mResX, 120, tunnelY) : null;
        const tL = mLongX ? this.createTrainObj(trainLayer, carLayer, mEastX, mLongX, 60, tunnelY) : null;

        // Restructure trainLayer: bodies → riderCont → fronts
        // so metro riders render INSIDE the train (behind front panel)
        const riderCont = new PIXI.Container();
        riderCont.sortableChildren = true;
        [tW, tE, tM, tD, tL].forEach(t => { if (t) trainLayer.removeChild(t.front); });
        trainLayer.addChild(riderCont);
        [tW, tE, tM, tD, tL].forEach(t => { if (t) trainLayer.addChild(t.front); });

        // ─── Click-to-board: trains route into the train interior just like buildings ───
        const trainLabels = {
            trainWest:      'Line 1 · Westbound',
            trainEast:      'Line 1 · Eastbound',
            trainMid:       'Line 2 · Central',
            trainDC:        'Compute Spur',
            trainLongevity: 'Innovation Line'
        };
        const wireTrainClick = (t, key) => {
            if (!t) return;
            const name = trainLabels[key] || 'Metro Train';
            const onTap = () => {
                if (typeof SND !== 'undefined' && SND.uiClick) SND.uiClick();
                // Board the train as a real-world camera cutaway (keeps the city
                // visible and zooms onto this train) rather than a separate scene.
                if (typeof G !== 'undefined' && typeof G.enterTrainFocus === 'function') {
                    G.enterTrainFocus(key);
                }
            };
            [t.c, t.front].forEach(node => {
                if (!node) return;
                node.eventMode = 'static';
                node.cursor = 'pointer';
                node.hitArea = new PIXI.Rectangle(-185, -40, 370, 75);
                node.on('pointertap', onTap);
                node.on('pointerover', e => {
                    if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, '🚇 ' + name, 'Tap to board this train');
                });
                node.on('pointerout', () => {
                    if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
                });
            });
        };
        wireTrainClick(tW, 'trainWest');
        wireTrainClick(tE, 'trainEast');
        wireTrainClick(tM, 'trainMid');
        wireTrainClick(tD, 'trainDC');
        wireTrainClick(tL, 'trainLongevity');

        return {
            trainWest: tW, trainEast: tE, trainMid: tM, trainDC: tD, trainLongevity: tL,
            riderCont: riderCont,
            stationVisuals: stationVisuals,
            bunkerGfx: bunkerGfx,
            bunkerTxts: bunkerTxts
        };
    },

    drawBunkers(bunkerGfx, charLayer, bunkerTxts) {
        bunkerGfx.clear();
        if (bunkerTxts) {
            bunkerTxts.forEach(t => t.destroy());
            bunkerTxts.length = 0;
        }

        if (typeof window.BLDS === 'undefined') return;

        window.BLDS.forEach(b => {
            if (b.id.startsWith('house_')) {
                const bnkW = b.w - 20;
                const bnkX = b.x + 10;
                const bnkH = 220; 
                
                bunkerGfx.beginFill(0x0a0a0f);
                bunkerGfx.drawRect(bnkX, G.groundY + 30, bnkW, bnkH);
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0x1e293b);
                bunkerGfx.drawRect(bnkX + 6, G.groundY + 36, bnkW - 12, bnkH - 12);
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0xfacc15);
                bunkerGfx.drawRect(bnkX + 6, G.groundY + 36, bnkW - 12, 8);
                bunkerGfx.beginFill(0x000000);
                for(let hx = bnkX + 6; hx < bnkX + bnkW - 12; hx += 16) {
                    bunkerGfx.drawPolygon([hx, G.groundY+36, hx+8, G.groundY+36, hx+2, G.groundY+44, hx-6, G.groundY+44]);
                }
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0x0f172a);
                bunkerGfx.drawRect(bnkX + 20, G.groundY + 60, bnkW - 40, bnkH - 80);
                bunkerGfx.endFill();

                for(let sy = G.groundY + 70; sy < G.groundY + bnkH - 30; sy += 35) {
                    bunkerGfx.beginFill(0x334155);
                    bunkerGfx.drawRect(bnkX + 6, sy, bnkW - 12, 4); 
                    bunkerGfx.endFill();
                    
                    bunkerGfx.beginFill(0x020617);
                    bunkerGfx.drawRect(bnkX + 30, sy - 20, 40, 20);
                    bunkerGfx.drawRect(bnkX + bnkW - 70, sy - 20, 40, 20);
                    bunkerGfx.endFill();
                    
                    bunkerGfx.beginFill(0x10b981);
                    for(let lx = 0; lx < 3; lx++) {
                        bunkerGfx.drawCircle(bnkX + 42 + (lx*12), sy - 10, 2);
                        bunkerGfx.drawCircle(bnkX + bnkW - 58 + (lx*12), sy - 10, 2);
                    }
                    bunkerGfx.endFill();

                    bunkerGfx.beginFill(0x06b6d4, 0.6);
                    bunkerGfx.drawRect(bnkX + bnkW/2 - 6, sy - 25, 12, 25);
                    bunkerGfx.endFill();
                    bunkerGfx.beginFill(0x22d3ee, 0.9);
                    bunkerGfx.drawRect(bnkX + bnkW/2 - 2, sy - 25, 4, 25);
                    bunkerGfx.endFill();
                }
                
                bunkerGfx.beginFill(0x000000, 0.85);
                bunkerGfx.drawRect(bnkX + bnkW/2 - 50, G.groundY + 45, 100, 14);
                bunkerGfx.lineStyle(1, 0xef4444, 0.5);
                bunkerGfx.drawRect(bnkX + bnkW/2 - 50, G.groundY + 45, 100, 14);
                bunkerGfx.lineStyle(0);
                bunkerGfx.endFill();

                const bnkTxt = new PIXI.Text('SECURE SILO', { fontFamily: 'Silkscreen', fontSize: 8, fill: 0xef4444, letterSpacing: 1 });
                bnkTxt.anchor.set(0.5);
                bnkTxt.x = b.x + b.w/2;
                bnkTxt.y = G.groundY + 52;
                charLayer.addChildAt(bnkTxt, 1);
                bunkerTxts.push(bnkTxt);
            }
        });
    },

    /* Shared train visual — used by exterior createTrainObj AND Underground.attachLiveTrains
       so the basement view never drifts from the city above. Returns body+front graphics. */
    buildTrainSprite() {
        const tBg = new PIXI.Graphics();
        tBg.beginFill(0x1e293b);
        tBg.drawRoundedRect(-180, -35, 360, 65, 8);
        tBg.endFill();
        tBg.beginFill(0x0284c7);
        tBg.drawRect(-175, 4, 350, 8);
        tBg.endFill();
        tBg.beginFill(0x94a3b8);
        for (let px = -160; px <= 160; px += 45) { tBg.drawRect(px - 1, -25, 2, 29); }
        tBg.endFill();

        const fGfx = new PIXI.Graphics();
        fGfx.beginFill(0xcbd5e1); fGfx.drawRoundedRect(-180, -35, 360, 15, 8); fGfx.endFill();
        fGfx.beginFill(0x94a3b8); fGfx.drawRect(-180, -4, 360, 34); fGfx.endFill();
        fGfx.beginFill(0x94a3b8); for (let px = -180; px <= 180; px += 45) { fGfx.drawRect(px - 5, -20, 10, 16); } fGfx.endFill();
        fGfx.beginFill(0x64748b);
        fGfx.drawRect(-100, -28, 20, 50); fGfx.drawRect(0, -28, 20, 50); fGfx.drawRect(100, -28, 20, 50); fGfx.endFill();
        fGfx.beginFill(0x0f172a, 0.6);
        fGfx.drawRect(-96, -18, 12, 16); fGfx.drawRect(4, -18, 12, 16); fGfx.drawRect(104, -18, 12, 16); fGfx.endFill();
        fGfx.beginFill(0x1e293b); fGfx.drawRect(-175, 30, 350, 10); fGfx.endFill();
        fGfx.beginFill(0x0ea5e9); fGfx.drawRect(-180, -2, 360, 4); fGfx.endFill();
        fGfx.beginFill(0xe0f2fe, 0.15); fGfx.drawRect(-180, -20, 360, 16); fGfx.endFill();

        const lightL = new PIXI.Graphics(); lightL.beginFill(0xef4444); lightL.drawCircle(-175, 0, 4); lightL.endFill();
        const lightR = new PIXI.Graphics(); lightR.beginFill(0x4ade80); lightR.drawCircle(175, 0, 4); lightR.endFill();

        return { tBg, fGfx, lightL, lightR };
    },

    createTrainObj(trainLayer, carLayer, st1, st2, startDelay, tunnelY) {
        let t = {
            c: new PIXI.Container(),
            front: new PIXI.Container(),
            x: st1, y: tunnelY,
            st1: st1, st2: st2, targetX: st2,
            state: 'waiting', timer: startDelay,
            speed: 6, dir: 1, passengers: 0
        };

        const { tBg, fGfx, lightL, lightR } = this.buildTrainSprite();
        t.c.addChild(tBg);
        t.c.x = t.x; t.c.y = t.y;
        t.front.addChild(fGfx, lightL, lightR);
        t.lightL = lightL; t.lightR = lightR;
        t.front.x = t.x; t.front.y = t.y;

        trainLayer.addChild(t.c);
        trainLayer.addChild(t.front);
        return t;
    },

    spawnCar(carLayer, reflectionLayer, dir) {
        const container = new PIXI.Container(); 
        const gfx = new PIXI.Graphics();
        const tCol = 0x76b900; 
        
        gfx.beginFill(0x222222); gfx.drawRect(-45, -35, 60, 30); gfx.endFill();
        gfx.beginFill(0x11111a); gfx.drawRect(-45, -5, 60, 5); gfx.endFill();
        gfx.beginFill(tCol); gfx.drawRect(-25, -22, 20, 4); gfx.endFill(); 
        
        gfx.beginFill(0x111111); gfx.drawRoundedRect(15, -25, 20, 20, 2); gfx.endFill();
        gfx.beginFill(tCol); gfx.drawRoundedRect(20, -20, 15, 15, 2); gfx.endFill();
        gfx.beginFill(0xdddddd); gfx.drawRect(30, -18, 5, 8); gfx.endFill();
        
        gfx.beginFill(0x050505);
        gfx.drawCircle(-30, 0, 5); gfx.drawCircle(-15, 0, 5); 
        gfx.drawCircle(25, 0, 5); gfx.endFill(); 
        
        container.addChild(gfx);
        const beam = new PIXI.Graphics(); 
        beam.beginFill(0xffffee, 0.5); 
        beam.drawPolygon([35, -10, 250, -40, 250, 30, 35, 0]); 
        beam.endFill();
        beam.blendMode = PIXI.BLEND_MODES.ADD; container.addChildAt(beam, 0); 
        
        const refCont = new PIXI.Container();
        const refGfx = gfx.clone(); refGfx.tint = 0x5555aa; refCont.addChild(refGfx);
        
        const laneY = dir > 0 ? 26 : 12;
        container.y = G.groundY + laneY; container.zIndex = Math.round(container.y); container.x = dir > 0 ? -60 : G.cityW + 60;
        container.scale.x = dir; 
        refCont.y = container.y; refCont.x = container.x; refCont.scale.x = dir; refCont.scale.y = -1; 
        
        container.eventMode = 'static'; container.cursor = 'pointer'; container.hitArea = new PIXI.Rectangle(-50, -40, 90, 45);
        container.on('pointertap', () => { if (typeof UI !== 'undefined') UI.addToast('🚚 Nvidia Logistics delivering fresh H100 pallets.'); });
        container.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, "Nvidia Logistics", "GPU Delivery Run"); });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(container); reflectionLayer.addChild(refCont);
        return { gfx: container, ref: refCont, beam: beam, dir, speed: 0.8 + Math.random()*0.4, isTruck: true };
    },

    createChar(m, charLayer) {
        const c = new PIXI.Container();
        const shadow = new PIXI.Graphics(); const head = new PIXI.Graphics(); const body = new PIXI.Graphics(); const legL = new PIXI.Graphics();
        const legR = new PIXI.Graphics(); const dot = new PIXI.Graphics();
        
        const umbrella = new PIXI.Graphics(); umbrella.visible = false;
        const ghostL = new PIXI.Graphics(); ghostL.visible = false;
        const ghostR = new PIXI.Graphics(); ghostR.visible = false;
        
        const briefcase = new PIXI.Graphics(); briefcase.visible = false;

        // Court summon marker — small ⚖️ floats above head when subpoenaed.
        const summonIcon = new PIXI.Text('⚖️', { fontFamily: 'JetBrains Mono', fontSize: 11 });
        summonIcon.anchor.set(0.5, 1); summonIcon.visible = false;

        // Spectral glow aura (visible on retired/ghost models)
        const ghostGlow = new PIXI.Graphics(); ghostGlow.visible = false;
        ghostGlow.blendMode = PIXI.BLEND_MODES.ADD;
        
        const chat = new PIXI.Container();
        const chatBg = new PIXI.Graphics();
        // BitmapText — the single highest-churn text in the game. Baked font in bitmap_fonts.js.
        // Falls back to PIXI.Text if the bake failed (e.g. font not loaded yet).
        const chatTxt = (typeof BitmapFonts !== 'undefined' && BitmapFonts.has('ChatBubble'))
            ? new PIXI.BitmapText('', { fontName: 'ChatBubble', fontSize: 8 })
            : new PIXI.Text('', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        chatTxt.anchor.set(0.5, 1); chatTxt.y = -4;
        chat.addChild(chatBg, chatTxt);
        chat.visible = false;
        
        c.addChild(ghostGlow, shadow, ghostL, ghostR, legL, legR, body, head, dot, umbrella, briefcase, summonIcon, chat);
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        c.on('pointerover', e => { 
            if (typeof UI === 'undefined') return;
            const stg = getStage(m.rel, m.ret, m.phase); const sd = STAGES[stg]; const idx = G.models.indexOf(m); const dp = G.getDayPhase(); 
            const ai = (typeof ACTS !== 'undefined' && ACTS[getAct(stg, dp, idx, m).act]) ? ACTS[getAct(stg, dp, idx, m).act] : { icon: '💻', label: 'Processing' }; 
            UI.showTooltip(e, `${m.name}${m.phase === 'rumored' ? ' 🔮' : ''}`, `${ai.icon} ${ai.label} · ${sd.label}`, true); 
        });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        charLayer.addChild(c); 
        
        let paramCount = 100; 
        let isMoE = false;
        if (m.arch) {
            if (m.arch.type && m.arch.type.includes('MoE')) isMoE = true;
            if (m.arch.params) {
                let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
                if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
                else if (pStr.includes('B')) paramCount = parseFloat(pStr);
            }
        }
        
        const paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));

        const stg = getStage(m.rel, m.ret, m.phase);
        const dpNow = G.getDayPhase();
        const { act: initAct, bid } = getAct(stg, dpNow, G.models.indexOf(m), m);

        let defaultHq = (G.bldsByLab[m.lab] || []).find(x => !x.id.startsWith('house_')) || (G.bldsByLab[m.lab] || [])[0];
        let startBld = bid ? G.bldById[bid] : defaultHq || G.bldById['uni_dorm'];

        // BUG FIX (v351): Prevent models from initializing into social/daytime buildings
        // during night hours. Any model whose schedule resolves to a non-residential
        // building at night is misrouted — redirect to residential.
        const _night = dpNow > .83 || dpNow < .25;
        const _socialIds = { cafe:1, open_square:1, gym:1, arena:1, city_park:1, park:1 };
        if (_night && startBld && _socialIds[startBld.id]) {
            const _region = (LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
            const _resBld = G.bldById['res_' + _region];
            if (_resBld) {
                console.warn(`[v351] Redirected ${m.name} from ${startBld.id} to ${_resBld.id} (night, act=${initAct}, bid=${bid})`);
                startBld = _resBld;
            }
        }

        G.charRefs[m.id] = {
            c, shadow, head, body, legL, legR, dot, umbrella, ghostL, ghostR, ghostGlow, briefcase, summonIcon, chat, chatBg, chatTxt,
            paramScale, isMoE,
            bld: startBld ? startBld.id : null,
            wantsToLeave: false, 
            wantsToEnter: false,
            _state: null, _chatMsg: null, 
            _streetState: 'walking', _chatTimer: 0,
            _metroState: 'none',
            _logicalY: G.groundY - 20,
            _initPos: false,
            elev: null 
        };
    },

    createElevatorPlatform(refs) {
        refs.elev = new PIXI.Graphics();
        refs.elev.beginFill(0x94a3b8);
        refs.elev.lineStyle(1, 0x22d3ee, 0.5);
        refs.elev.drawRect(-15, 0, 30, 4);
        refs.elev.endFill();
        refs.c.addChildAt(refs.elev, 0);
    },

    spawnDataCube(m, refs, charLayer, dataCubesArray) {
        const labColHex = parseInt((LABS[m.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        const cube = new PIXI.Graphics();
        cube.beginFill(labColHex, 0.9);
        cube.drawRect(-3, -3, 6, 6);
        cube.endFill();
        
        const glow = new PIXI.Graphics();
        glow.beginFill(labColHex, 0.4);
        glow.drawCircle(0, 0, 8);
        glow.endFill();
        cube.addChild(glow);
        cube.blendMode = PIXI.BLEND_MODES.ADD;
        
        cube.x = refs.c.x + (Math.random() * 20 - 10);
        cube.y = refs.c.y - 20;
        cube.vy = -1.5 - Math.random() * 2;
        cube.vx = (Math.random() - 0.5) * 3;
        cube.life = 90 + Math.random() * 60;
        cube.maxLife = cube.life;
        
        charLayer.addChildAt(cube, 0);
        dataCubesArray.push(cube);
    },

    updateChatBubbleVisuals(refs, msg) {
        refs.chatTxt.text = msg;
        refs.chatBg.clear();
        refs.chatBg.beginFill(0xffffff);
        refs.chatBg.drawRoundedRect(-refs.chatTxt.width/2 - 6, -refs.chatTxt.height - 8, refs.chatTxt.width + 12, refs.chatTxt.height + 8, 4);
        refs.chatBg.endFill();
        refs.chatBg.beginFill(0xffffff);
        refs.chatBg.moveTo(-3, -4); refs.chatBg.lineTo(3, -4); refs.chatBg.lineTo(0, 2); refs.chatBg.endFill();
    },

    updateCharStateVisuals(m, refs, stg, isR, isRm, sc, sd, colHex) {
        const finalSc = sc * (refs.paramScale||1); 
        const bw = Math.round(16 * finalSc), h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR), bodyH = h - headH - Math.round(4 * finalSc), legH = Math.round(4 * finalSc);
        const suitCol = isR ? 0x667799 : colHex;
        const eyeS = Math.max(1, bw * .08);
        
        refs.shadow.clear(); refs.shadow.beginFill(0x000000, 0.25); refs.shadow.drawEllipse(0, 2, bw * 0.6, 3); refs.shadow.endFill();
        refs.head.clear();
        // ─── AGE-SPECIFIC SKIN TONES ───
        const babySkin = 0xffe4c4;  // rosier/pinker for babies
        const kidSkin  = 0xfde0b8;  // slightly warmer for kids
        const ageSkin = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : stg === 'baby' ? babySkin : stg === 'kid' ? kidSkin : 0xfdd8b5;
        refs.head.beginFill(ageSkin, isR ? .3 : isRm ? .5 : 1);
        refs.head.drawRoundedRect(-bw * .4, 0, bw * .8, headH, headH * .25); refs.head.endFill();
        // Eyes — babies get bigger, rounder eyes; kids get standard
        const ageEyeS = stg === 'baby' ? eyeS * 1.4 : eyeS;
        const eyeCol = isR ? 0xaaccff : isRm ? 0xa78bfa : stg === 'baby' ? 0x1a1a2e : 0x2c1810;
        refs.head.beginFill(eyeCol); refs.head.drawCircle(-bw * .12, headH * .38, isR ? eyeS * 1.5 : ageEyeS);
        refs.head.drawCircle(bw * .12, headH * .38, isR ? eyeS * 1.5 : ageEyeS); refs.head.endFill();
        // Baby eye highlights (cute sparkle)
        if (stg === 'baby') {
            refs.head.beginFill(0xffffff, 0.7); refs.head.drawCircle(-bw * .12 + 1, headH * .35, ageEyeS * 0.4);
            refs.head.drawCircle(bw * .12 + 1, headH * .35, ageEyeS * 0.4); refs.head.endFill();
        }
        // Mouth — babies get a small 'o', kids get a smile, adults get neutral line
        if (stg === 'baby') {
            refs.head.beginFill(0xdd8888, 0.6); refs.head.drawCircle(0, headH * .65, bw * .06); refs.head.endFill();
        } else {
            refs.head.beginFill(0x000000, 0.4); refs.head.drawRect(-bw * .08, headH * .6, bw * .16, 1.5); refs.head.endFill();
        }
        // ─── BABY ACCESSORIES: Pacifier + tuft of hair ───
        if (stg === 'baby') {
            // Tuft of hair on top
            refs.head.beginFill(eyeCol, 0.7);
            refs.head.drawEllipse(-bw * .1, -1, bw * .12, 3);
            refs.head.drawEllipse(bw * .05, -2, bw * .10, 2.5);
            refs.head.endFill();
            // Pacifier
            refs.head.beginFill(0xff88aa, 0.8); refs.head.drawCircle(0, headH * .72, bw * .1); refs.head.endFill();
            refs.head.beginFill(0xffaacc, 0.9); refs.head.drawCircle(0, headH * .72, bw * .06); refs.head.endFill();
        }
        // ─── KID ACCESSORIES: Baseball cap ───
        if (stg === 'kid') {
            // Cap brim
            refs.head.beginFill(suitCol, 0.9);
            refs.head.drawRect(-bw * .45, -1, bw * .9, 3);
            refs.head.endFill();
            // Cap dome
            refs.head.beginFill(suitCol, 0.85);
            refs.head.drawRoundedRect(-bw * .38, -4, bw * .76, 5, 2);
            refs.head.endFill();
            // Cap button
            refs.head.beginFill(0xffffff, 0.4); refs.head.drawCircle(0, -3, 1); refs.head.endFill();
        }
        // ─── RUMORED: Question mark floating above ───
        if (isRm) {
            refs.head.beginFill(0xa78bfa, 0.7);
            refs.head.drawRect(-1, -8, 2, 4); // stem
            refs.head.drawCircle(0, -10, 2.5); // top curve
            refs.head.drawCircle(0, -3, 1); // dot
            refs.head.endFill();
        }
        refs.head.y = -h;

        if (refs._metroState !== 'riding') {
            refs.body.clear();
            // ─── AGE-SPECIFIC BODY STYLE ───
            if (stg === 'baby') {
                // Onesie — rounded, pastel version of lab color
                const onesieCol = suitCol;
                refs.body.beginFill(onesieCol, isRm ? .4 : 0.85);
                refs.body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .25); refs.body.endFill();
                // Onesie buttons
                refs.body.beginFill(0xffffff, 0.5);
                for (let bi = 0; bi < Math.min(2, bodyH / 4); bi++) {
                    refs.body.drawCircle(0, 2 + bi * 3, 0.8);
                }
                refs.body.endFill();
            } else if (stg === 'kid') {
                // T-shirt + shorts look — lab color top, darker bottom
                const shirtH = Math.max(bodyH * 0.6, 3);
                refs.body.beginFill(suitCol, isRm ? .4 : 1);
                refs.body.drawRoundedRect(-bw / 2, 0, bw, shirtH, bw * .1); refs.body.endFill();
                // Shorts
                refs.body.beginFill(0x2a2a3a, 0.8);
                refs.body.drawRect(-bw / 2, shirtH, bw, Math.max(bodyH - shirtH, 2)); refs.body.endFill();
            } else {
                refs.body.beginFill(suitCol, isR ? .4 : isRm ? .4 : 1);
                refs.body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1); refs.body.endFill();
            }
            refs.body.y = -h + headH;
        }

        // ─── AGE-SPECIFIC LEG COLORS ───
        const ageLegCol = isR ? 0x7788aa : isRm ? 0x6b7280 : stg === 'baby' ? 0xfdd8b5 : stg === 'kid' ? 0x2a2a3a : 0x3d2914;
        const lw = Math.max(2, bw * .25), lh = Math.max(legH, 2); refs.legL.clear();
        refs.legL.beginFill(ageLegCol, isR ? .25 : 1);
        refs.legL.drawRect(-lw / 2, 0, lw, lh); refs.legL.endFill(); refs.legL.x = -bw * .15; refs.legR.clear();
        refs.legR.beginFill(ageLegCol, isR ? .25 : 1);
        refs.legR.drawRect(-lw / 2, 0, lw, lh); refs.legR.endFill(); refs.legR.x = bw * .15;
        refs.dot.clear(); const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : stg === 'kid' ? 0x22d3ee : 0x4ade80; refs.dot.beginFill(dotCol); refs.dot.drawCircle(0, 0, stg === 'baby' ? 2.5 : 2); refs.dot.endFill();
        refs.dot.y = -h - 6;

        // Spectral glow for retired models
        if (refs.ghostGlow) {
            refs.ghostGlow.clear();
            if (isR) {
                refs.ghostGlow.visible = true;
                refs.ghostGlow.beginFill(0x6688ff, 0.15);
                refs.ghostGlow.drawEllipse(0, -h * 0.4, bw * 1.2, h * 0.6);
                refs.ghostGlow.endFill();
                refs.ghostGlow.beginFill(0x88aaff, 0.08);
                refs.ghostGlow.drawEllipse(0, -h * 0.4, bw * 1.8, h * 0.8);
                refs.ghostGlow.endFill();
            } else {
                refs.ghostGlow.visible = false;
            }
        }

        if (refs.isMoE) {
            refs.ghostL.clear(); refs.ghostR.clear();
            refs.ghostL.beginFill(suitCol, 0.5); refs.ghostR.beginFill(suitCol, 0.5);
            refs.ghostL.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1);
            refs.ghostR.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1);
            refs.ghostL.endFill(); refs.ghostR.endFill();
            refs.ghostL.blendMode = PIXI.BLEND_MODES.ADD; refs.ghostR.blendMode = PIXI.BLEND_MODES.ADD;
        }

        refs.umbrella.clear();
        const uW = 14 * finalSc;
        refs.umbrella.beginFill(colHex, 0.95);
        refs.umbrella.lineStyle(1, 0x000000, 0.3);
        refs.umbrella.drawPolygon([
            -uW, 0, -uW*0.7, -uW*0.6, -uW*0.3, -uW*0.8,
            0, -uW*0.9, uW*0.3, -uW*0.8, uW*0.7, -uW*0.6, uW, 0
        ]);
        refs.umbrella.endFill();
        refs.umbrella.lineStyle(0);
        refs.umbrella.beginFill(0x444455);
        refs.umbrella.drawRect(-1, 0, 2, uW*1.4); 
        refs.umbrella.endFill();
        refs.umbrella.y = -h - (6 * finalSc);
        refs.umbrella.x = 2 * finalSc;

        refs.briefcase.clear();
        if (!m.os && stg !== 'baby' && stg !== 'rumored') {
            refs.briefcase.beginFill(0x11111a);
            refs.briefcase.drawRoundedRect(-6 * finalSc, 2 * finalSc, 8 * finalSc, 8 * finalSc, 1);
            refs.briefcase.beginFill(0x33334a);
            refs.briefcase.drawRect(-4 * finalSc, 0, 4 * finalSc, 2 * finalSc);
            refs.briefcase.beginFill(0xff3333); 
            refs.briefcase.drawRect(-3 * finalSc, 5 * finalSc, 2 * finalSc, 2 * finalSc);
            refs.briefcase.endFill();
            refs.briefcase.x = bw / 2 + (2 * finalSc);
            refs.briefcase.y = -h / 2;
        }

        const _tp = window.isMobile ? 12 : 0;
        refs.c.hitArea = new PIXI.Rectangle(-bw / 2 - 20 - _tp, -h - 30 - _tp, bw + 40 + _tp * 2, h + 50 + _tp * 2);
        refs.chat.x = 0;
    }
};
