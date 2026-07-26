/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR NPC APARTMENTS (v2.0.0)
   Self-contained interior module for Worker Housing buildings.
   Floors: Foyer (ground), Apartments (upper), Laundry/Storage (basement). Elevator included.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorNPC = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [], lifts: {},
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _noYScroll: false,
    
    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];
        
        // Sky
        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 60; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()); s.endFill(); s.x=Math.random()*G.vpW; s.y=Math.random()*G.vpH*.4; s._phase=Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);
        
        const floorH = 80, numFloors = bld.fl || 3, roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH;
        const startX = 60, shaftW = 50, shaftX = G.vpW - shaftW - 60;
        const usableW = shaftX - startX - 20;
        const windowX = startX + 50, windowW = usableW - 80;
        
        // Get residents for this building.
        // Worker blocks (npc_apt_*) use NPCHousing routing, suburban townhomes use VC Row NPCs.
        let residents = [];
        if (bld.id.startsWith('suburb_')) {
            if (typeof VCRow !== 'undefined' && VCRow.SUBURB_BLDS) {
                const idx = VCRow.SUBURB_BLDS.findIndex(s => s.id === bld.id);
                if (idx >= 0 && VCRow.NPCS[idx]) residents = [VCRow.NPCS[idx]];
            }
        } else if (typeof NPCHousing !== 'undefined') {
            residents = NPCHousing.REGISTRY.filter((n, i) => NPCHousing._assignHomeBldId(n, i) === bld.id);
        }
        
        // ─── ROOF SIGN ───
        const rc = new PIXI.Container();
        const bW = 180, bH = 28, bX = startX + usableW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, 0x475569, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+12, bY+bH, 4, 8); sg.drawRect(bX+bW-16, bY+bH, 4, 8); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(bld.name.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:11, fontWeight:'bold', fill:'#94a3b8', letterSpacing:2 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt);
        const rl = new PIXI.Graphics(); rl.beginFill(0x475569, 0.3); rl.drawRect(startX, roofH-4, usableW+shaftW+20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);
        
        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f) * floorH;
            const isB = f === -1;
            
            // Walls with window holes
            const rg = new PIXI.Graphics();
            rg.beginFill(0x1a2030); rg.drawRect(startX-6, fy, 6, floorH); rg.endFill();
            rg.beginFill(0x1a2030); rg.drawRect(shaftX-2, fy, 8, floorH); rg.endFill();
            // Right wall beyond shaft + shaft background
            rg.beginFill(0x1a2030); rg.drawRect(shaftX+shaftW-4, fy, 6, floorH); rg.endFill();
            rg.beginFill(0x0f1520); rg.drawRect(shaftX+6, fy, shaftW-12, floorH); rg.endFill();
            
            if (!isB) {
                rg.beginFill(0x151c28); rg.drawRect(startX, fy, usableW, 20); rg.endFill();
                rg.beginFill(0x151c28); rg.drawRect(startX, fy+52, usableW, floorH-52); rg.endFill();
                let wx = windowX;
                rg.beginFill(0x151c28); rg.drawRect(startX, fy+20, windowX-startX, 32); rg.endFill();
                while (wx+40 <= windowX+windowW) { wx += 40; if (wx+20 <= windowX+windowW) { rg.beginFill(0x151c28); rg.drawRect(wx, fy+20, 20, 32); rg.endFill(); } wx += 20; }
                rg.beginFill(0x151c28); rg.drawRect(wx-20, fy+20, startX+usableW-wx+20, 32); rg.endFill();
                // Window frames
                const wf = new PIXI.Graphics(); let cwx = windowX;
                while (cwx+40 <= windowX+windowW) { wf.lineStyle(2, 0x2a3448); wf.drawRect(cwx, fy+20, 40, 32); wf.moveTo(cwx+20,fy+20); wf.lineTo(cwx+20,fy+52); wf.moveTo(cwx,fy+36); wf.lineTo(cwx+40,fy+36); wf.lineStyle(0); cwx+=60; }
                this.scene.addChild(wf);
            } else {
                rg.beginFill(0x10161e); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }
            rg.beginFill(0x0f1520); rg.drawRect(startX, fy+floorH-6, usableW, 6); rg.endFill();
            rg.beginFill(0x0c1018); rg.drawRect(startX, fy, usableW, 3); rg.endFill();
            rg.beginFill(0x222a38); rg.drawRect(startX-6, fy+floorH-3, usableW+shaftW+28, 3); rg.endFill();
            this.scene.addChild(rg);
            
            // Ceiling lights
            for (let li = 1; li <= 4; li++) {
                const lx = startX + (li * usableW / 5);
                const lg = new PIXI.Graphics(); lg.beginFill(0xfbbf24, 0.3); lg.drawRect(lx-8, fy+2, 16, 2); lg.endFill();
                const bm = new PIXI.Graphics(); bm.beginFill(0xfbbf24, 0.03); bm.moveTo(lx-8,fy+4); bm.lineTo(lx+8,fy+4); bm.lineTo(lx+20,fy+floorH-6); bm.lineTo(lx-20,fy+floorH-6); bm.closePath(); bm.endFill();
                this.scene.addChild(lg, bm); this.indoorLights.push({ g: bm, maxA: 0.05, type: 'screen' });
            }
            
            // Elevator door
            const dr = new PIXI.Graphics();
            dr.beginFill(0x2a3448); dr.lineStyle(1, 0x1a2030);
            dr.drawRect(shaftX+15, fy+floorH-44, 30, 40);
            dr.moveTo(shaftX+30, fy+floorH-44); dr.lineTo(shaftX+30, fy+floorH-4); dr.endFill();
            dr.beginFill(0x1a2030); dr.drawRect(shaftX+5, fy+floorH-25, 4, 8);
            dr.beginFill(isB ? 0xef4444 : 0x4ade80); dr.drawCircle(shaftX+7, fy+floorH-23, 1.5); dr.endFill();
            this.scene.addChild(dr);
            
            // Floor content
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            
            if (isB) this._drawBasement(fc, startX, usableW, pY, fy, floorH);
            else if (f === 0) this._drawFoyer(fc, startX, usableW, pY, fy, floorH, residents);
            else this._drawApartments(fc, startX, usableW, pY, fy, floorH, f, residents);
        }
        
        // ─── ELEVATOR ───
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container(); ec.y = roofH+(numFloors-1)*floorH+floorH; this.scene.addChild(ec);
            if (this.lifts[bld.id]) this.lifts[bld.id].destroy();
            this.lifts[bld.id] = new CityElevator(ec, numFloors, floorH, shaftX+15);
        }
        
        // ─── EARTH AROUND BASEMENT (zone-tinted) ───
        // suburb_* houses live in the VC/Banking east_rock zone — no metro tunnel below,
        // and the surface earth is rose-brown rock. npc_apt_* are core city.
        const isSuburb = bld.id && bld.id.startsWith('suburb_');
        const profile  = isSuburb ? 'east_rock' : 'city';
        const earthBase = isSuburb ? 0x2d1a11 : 0x2a2218;
        const earthHi   = isSuburb ? 0x3d261a : 0x3a3020;
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(earthBase); earth.drawRect(0, groundY, startX-6, floorH); earth.endFill();
        earth.beginFill(earthHi);   earth.drawRect(0, groundY, startX-6, 6); earth.endFill();
        earth.beginFill(earthBase); earth.drawRect(shaftX+shaftW, groundY, G.vpW-shaftX-shaftW, floorH); earth.endFill();
        earth.beginFill(earthHi);   earth.drawRect(shaftX+shaftW, groundY, G.vpW-shaftX-shaftW, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY-2, startX-6, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(shaftX+shaftW, groundY-2, G.vpW-shaftX-shaftW, 6); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY-4, startX-6, 4); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(shaftX+shaftW, groundY-4, G.vpW-shaftX-shaftW, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── BELOW-BASEMENT STACK (per-zone profile — exterior is the blueprint) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 6;
        const profileDepth = (typeof Underground !== 'undefined') ? Underground.depthOf(profile) : 238;
        const undergroundH = Math.max(profileDepth + 60, 300);
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, basementBottom - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, undergroundY + undergroundH, G.vpW, 3000); vm.endFill();
        this.scene.addChild(vm);
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, profile, (bld.x | 0));
            this.scene.addChild(ug);
            // Live trains only for profiles with a metro tunnel (city has it, east_rock doesn't)
            if (this._liveTrains) { try { this._liveTrains.destroy(); } catch (e) {} this._liveTrains = null; }
            const profileCfg = Underground._profile ? Underground._profile(profile) : null;
            if (profileCfg && profileCfg.liveTrains) {
                this._liveTrains = Underground.attachLiveTrains(
                    this.scene, bld.x + bld.w / 2, 0,
                    undergroundY + Underground.H_CABLE_TRAY, G.vpW, 1200);
            }
        }
        
        // ─── TRACKED NPC WALK-IN ANIMATION ───
        if (typeof G !== 'undefined' && G.tracking && G.tracking.type === 'npc') {
            const trackedId = G.tracking.id;
            const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === trackedId);
            if (cm && cm.bld === bld.id) {
                // Find the resident data to get their color
                const trackedRes = residents.find(r => 'npc_' + r.name.toLowerCase().replace(/\s/g, '_') === trackedId);
                const col = trackedRes ? parseInt(trackedRes.color.replace('#', ''), 16) : 0x475569;
                // Build a walk-in avatar at the foyer entrance (left side, ground floor)
                const groundFY = roofH + (numFloors - 1) * floorH;
                const walkY = groundFY + floorH - 6;
                const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
                // Create the walking-in NPC at far left
                const wc = new PIXI.Container(); wc.x = startX - 10; wc.y = walkY; wc.zIndex = 20;
                const bw = 16, h = 32, headH = 12;
                const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.25); sh.drawEllipse(0, 2, bw * 0.6, 3); sh.endFill();
                const lw = Math.max(2, bw * 0.25);
                const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2, 0, lw, 4); legL.endFill(); legL.x = -bw * 0.15;
                const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2, 0, lw, 4); legR.endFill(); legR.x = bw * 0.15;
                const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2, 0, bw, 14, bw * 0.1); body.endFill(); body.y = -h + headH;
                const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
                head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.38, 1); head.drawCircle(bw * 0.1, headH * 0.38, 1); head.endFill(); head.y = -h;
                const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;
                wc.addChild(sh, legL, legR, body, head, dot);
                fc.addChild(wc);
                const walkTarget = startX + usableW / 2;
                const avObj = { cont: wc, head, body, legL, legR, _isWalkIn: true, _walkTarget: walkTarget, _walkSpeed: 1.2, _phase: 0 };
                // Tracking highlight
                if (G._addTrackHighlight) {
                    const hl = G._addTrackHighlight(wc, { id: trackedId }, false);
                    if (hl) { avObj._trackGlow = hl.glow; avObj._trackArrow = hl.arrow; }
                }
                this.avatars.push(avObj);
            }
        }

        // Position & scroll
        const bp = 56; const initY = G.vpH-bp-this.totalH+floorH;
        this.scene.y = initY;
        this.minY = Math.min(initY - floorH*3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = initY + floorH*3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorNPC.isDragging || !InteriorNPC.scene || InteriorNPC.scene.destroyed) return; let ny=InteriorNPC._startSceneY+(e.clientY-InteriorNPC._startY); ny=Math.max(InteriorNPC.minY,Math.min(ny,InteriorNPC.maxY)); InteriorNPC.scene.y=ny; };
        this._onUp = () => { InteriorNPC.isDragging=false; if(InteriorNPC.layer) InteriorNPC.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },
    
    // ═══ FOYER (Ground Floor) ═══
    _drawFoyer(c, sx, uw, pY, fy, fh, residents) {
        this._lbl(c, sx+uw/2, fy+8, 'LOBBY & RECEPTION', 0x94a3b8);
        // Reception desk
        const dg = new PIXI.Graphics(); dg.eventMode='none';
        dg.beginFill(0x1e293b); dg.drawRect(sx+40, pY-18, 80, 18); dg.endFill();
        dg.beginFill(0x475569); dg.drawRect(sx+40, pY-20, 80, 3); dg.endFill();
        dg.beginFill(0x0a0a18); dg.drawRect(sx+60, pY-32, 20, 12); dg.endFill();
        dg.beginFill(0x22d3ee, 0.3); dg.drawRect(sx+62, pY-30, 16, 8); dg.endFill();
        c.addChild(dg);
        // Mailboxes
        const mb = new PIXI.Graphics(); mb.eventMode='none';
        mb.beginFill(0x1e293b); mb.drawRect(sx+160, pY-40, 60, 40); mb.endFill();
        for (let my = pY-38; my < pY-4; my += 10) {
            for (let mx = sx+164; mx < sx+216; mx += 14) {
                mb.beginFill(0x334155); mb.drawRect(mx, my, 10, 7); mb.endFill();
            }
        }
        c.addChild(mb);
        // Seating
        const couch = new PIXI.Graphics(); couch.eventMode='none';
        couch.beginFill(0x334155, 0.8); couch.drawRoundedRect(sx+260, pY-12, 50, 12, 2); couch.endFill();
        couch.beginFill(0x334155, 0.5); couch.drawRoundedRect(sx+256, pY-18, 6, 18, 2); couch.drawRoundedRect(sx+306, pY-18, 6, 18, 2); couch.endFill();
        c.addChild(couch);
        // Plant
        const pl = new PIXI.Graphics(); pl.eventMode='none';
        pl.beginFill(0x334155); pl.drawRect(sx+uw-60, pY-12, 14, 12); pl.endFill();
        pl.beginFill(0x166534); pl.drawEllipse(sx+uw-53, pY-18, 10, 8); pl.endFill();
        pl.beginFill(0x1b4332); pl.drawEllipse(sx+uw-53, pY-16, 7, 6); pl.endFill();
        c.addChild(pl);
        // Resident board
        const bd = new PIXI.Graphics(); bd.eventMode='none';
        bd.beginFill(0x0f172a); bd.drawRect(sx+360, pY-45, 80, 40); bd.endFill();
        bd.beginFill(0x1e293b); bd.drawRect(sx+362, pY-43, 76, 36); bd.endFill();
        c.addChild(bd);
        const bdt = new PIXI.Text(`${residents.length} RESIDENTS`, { fontFamily:'JetBrains Mono', fontSize:6, fill:'#4ade80' });
        bdt.anchor.set(0.5,0.5); bdt.x = sx+400; bdt.y = pY-30; c.addChild(bdt);
        // NPC (skip at night — doorman goes home)
        const dp = G.getDayPhase();
        if (!(dp > 0.83 || dp < 0.25)) this._npc(c, sx+80, pY, 'Doorman', 0x475569);
    },
    
    // ═══ APARTMENTS (Upper Floors) ═══
    _drawApartments(c, sx, uw, pY, fy, fh, floor, residents) {
        // Floor number on right side (avoid overlapping nameplates)
        const flbl = new PIXI.Text('FL' + floor, { fontFamily:'JetBrains Mono', fontSize:6, fill:'#475569', letterSpacing:1 }); flbl.anchor.set(1,0); flbl.x = sx+uw-5; flbl.y = fy+6; c.addChild(flbl);
        const unitsPerFloor = 4;
        const unitW = (uw - 20) / unitsPerFloor;
        for (let u = 0; u < unitsPerFloor; u++) {
            const ux = sx + 10 + u * unitW;
            const ri = (floor - 1) * unitsPerFloor + u;
            const resident = residents[ri % residents.length];
            if (!resident) continue;
            const col = parseInt(resident.color.replace('#',''), 16);
            
            // Unit divider
            if (u > 0) { const dv = new PIXI.Graphics(); dv.beginFill(0x2a3040); dv.drawRect(ux-2, fy+4, 2, fh-10); dv.endFill(); c.addChild(dv); }
            
            const unit = new PIXI.Container();
            // Bed with colored blanket
            const bed = new PIXI.Graphics(); bed.eventMode='none';
            bed.beginFill(0x1e293b); bed.drawRect(ux+8, pY-16, 40, 16); bed.endFill();
            bed.beginFill(col, 0.4); bed.drawRect(ux+8, pY-18, 40, 4); bed.endFill();
            bed.beginFill(0xffffff, 0.3); bed.drawRect(ux+10, pY-17, 12, 3); bed.endFill();
            unit.addChild(bed);
            // Desk + monitor
            const desk = new PIXI.Graphics(); desk.eventMode='none';
            desk.beginFill(0x334155); desk.drawRect(ux+60, pY-20, 30, 20); desk.endFill();
            desk.beginFill(0x475569); desk.drawRect(ux+60, pY-22, 30, 3); desk.endFill();
            desk.beginFill(0x0a0a18); desk.drawRect(ux+65, pY-36, 20, 14); desk.endFill();
            desk.beginFill(col, 0.3); desk.drawRect(ux+67, pY-34, 16, 10); desk.endFill();
            unit.addChild(desk);
            // Chair
            const ch = new PIXI.Graphics(); ch.eventMode='none';
            ch.beginFill(0x334155); ch.drawRect(ux+70, pY-10, 10, 10); ch.endFill();
            ch.beginFill(0x475569); ch.drawRect(ux+68, pY-14, 14, 4); ch.endFill();
            unit.addChild(ch);
            // Wardrobe
            const wd = new PIXI.Graphics(); wd.eventMode='none';
            wd.beginFill(0x1e293b); wd.drawRect(ux+100, pY-40, 20, 40); wd.endFill();
            wd.beginFill(0x334155); wd.drawRect(ux+102, pY-38, 16, 36); wd.endFill();
            wd.beginFill(col, 0.2); wd.drawRect(ux+104, pY-36, 12, 14); wd.endFill();
            unit.addChild(wd);
            // Nameplate
            const nm = new PIXI.Text(resident.name, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, fontWeight:'bold' });
            nm.anchor.set(0,0.5); nm.x = ux+8; nm.y = fy+14; unit.addChild(nm);
            const rl = new PIXI.Text(resident.role, { fontFamily:'JetBrains Mono', fontSize:5, fill:0x64748b });
            rl.anchor.set(0,0.5); rl.x = ux+8; rl.y = fy+22; unit.addChild(rl);
            
            // Resident NPC avatar (visible when home/off-duty)
            const isNightShift = resident.shift === 'night';
            const dp = G.getDayPhase();
            const isAtWork = isNightShift ? (dp > 0.83 || dp < 0.25) : (dp > 0.33 && dp < 0.75);
            if (!isAtWork) {
                // Check if sleeping (late night for day shift, midday for night shift)
                const isSleeping = isNightShift ? (dp > 0.42 && dp < 0.75) : (dp > 0.88 || dp < 0.25);
                if (isSleeping) {
                    const bedTop = pY - 16; // top surface of bed frame
                    const sleeper = new PIXI.Graphics();
                    // Pillow (fluffy, raised above mattress)
                    sleeper.beginFill(0xddd8c8, 0.7); sleeper.drawRoundedRect(ux + 9, bedTop - 10, 14, 8, 3); sleeper.endFill();
                    // Head resting on pillow
                    sleeper.beginFill(0xfdd8b5); sleeper.drawCircle(ux + 16, bedTop - 7, 4); sleeper.endFill();
                    // Hair
                    sleeper.beginFill(0x2c1810, 0.7); sleeper.drawEllipse(ux + 16, bedTop - 11, 3.5, 1.5); sleeper.endFill();
                    // Closed eyes (small lashes)
                    sleeper.beginFill(0x2c1810, 0.5); sleeper.drawRect(ux + 13.5, bedTop - 7, 1.8, 0.8); sleeper.drawRect(ux + 17, bedTop - 7, 1.8, 0.8); sleeper.endFill();
                    // Peaceful mouth
                    sleeper.beginFill(0x2c1810, 0.2); sleeper.drawRect(ux + 15, bedTop - 4.5, 2.5, 0.6); sleeper.endFill();
                    // Blanket covering body (contour hump)
                    sleeper.beginFill(col, 0.5);
                    sleeper.moveTo(ux + 22, bedTop); sleeper.lineTo(ux + 22, bedTop - 3);
                    sleeper.quadraticCurveTo(ux + 31, bedTop - 13, ux + 46, bedTop - 2);
                    sleeper.lineTo(ux + 46, bedTop); sleeper.closePath(); sleeper.endFill();
                    // Blanket top shimmer
                    sleeper.beginFill(col, 0.25);
                    sleeper.moveTo(ux + 23, bedTop - 1); sleeper.lineTo(ux + 23, bedTop - 2);
                    sleeper.quadraticCurveTo(ux + 31, bedTop - 11, ux + 45, bedTop - 1);
                    sleeper.lineTo(ux + 45, bedTop - 1); sleeper.closePath(); sleeper.endFill();
                    // Interactive wrapper
                    const sleeperCont = new PIXI.Container();
                    sleeperCont.addChild(sleeper);
                    sleeperCont.eventMode = 'static'; sleeperCont.cursor = 'pointer';
                    sleeperCont.hitArea = new PIXI.Rectangle(ux + 6, bedTop - 14, 44, 18);
                    const _nm = resident.name, _rl = resident.role;
                    const _nid = 'npc_' + _nm.toLowerCase().replace(/\s/g, '_');
                    sleeperCont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: _nid, name: _nm, isNPC: true, _trackType: 'npc', role: _rl, lab: 'other', desc: _rl + '. Currently sleeping.' }); });
                    sleeperCont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, _nm, _rl + ' (sleeping)'); });
                    sleeperCont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
                    unit.addChild(sleeperCont);
                    // Animated Zzz
                    const zzzCont = new PIXI.Container(); zzzCont.x = ux + 24; zzzCont.y = bedTop - 14;
                    const z1 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
                    z1.anchor.set(0.5); z1.x = 0; z1.y = 0; z1.alpha = 0.7;
                    const z2 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 9, fill: col, fontWeight: 'bold' });
                    z2.anchor.set(0.5); z2.x = 5; z2.y = -8; z2.alpha = 0.5;
                    const z3 = new PIXI.Text('Z', { fontFamily: 'JetBrains Mono', fontSize: 11, fill: col, fontWeight: 'bold' });
                    z3.anchor.set(0.5); z3.x = 10; z3.y = -18; z3.alpha = 0.3;
                    zzzCont.addChild(z1, z2, z3);
                    unit.addChild(zzzCont);
                    this.avatars.push({ cont: zzzCont, _isZzz: true, _z1: z1, _z2: z2, _z3: z3, _phase: Math.random() * Math.PI * 2 });
                } else {
                    this._npc(unit, ux + 72, pY, resident.name, col);
                }
            }
            c.addChild(unit);
        }
    },
    
    // ═══ BASEMENT — Laundry & Storage ═══
    _drawBasement(c, sx, uw, pY, fy, fh) {
        this._lbl(c, sx+uw/2, fy+8, 'LAUNDRY & STORAGE', 0xef4444);
        // Washing machines
        for (let wx = sx+30; wx < sx+uw/2-20; wx += 50) {
            const wm = new PIXI.Graphics(); wm.eventMode='none';
            wm.beginFill(0xf1f5f9); wm.drawRoundedRect(wx, pY-35, 30, 35, 2); wm.endFill();
            wm.beginFill(0x94a3b8); wm.drawRect(wx+2, pY-33, 26, 8); wm.endFill();
            wm.beginFill(0x0a0a18); wm.drawCircle(wx+15, pY-14, 9); wm.endFill();
            wm.beginFill(0x22d3ee, 0.3); wm.drawCircle(wx+15, pY-14, 7); wm.endFill();
            wm.beginFill(0x4ade80); wm.drawCircle(wx+6, pY-30, 1.5); wm.endFill();
            c.addChild(wm);
        }
        // Storage cages
        for (let cx = sx+uw/2+20; cx < sx+uw-40; cx += 60) {
            const cage = new PIXI.Graphics(); cage.eventMode='none';
            cage.beginFill(0x1e293b, 0.5); cage.drawRect(cx, pY-40, 40, 40); cage.endFill();
            cage.lineStyle(1, 0x475569, 0.4);
            for (let gy = pY-38; gy < pY; gy += 8) { cage.moveTo(cx, gy); cage.lineTo(cx+40, gy); }
            for (let gx = cx; gx <= cx+40; gx += 8) { cage.moveTo(gx, pY-40); cage.lineTo(gx, pY); }
            cage.lineStyle(0);
            // Stuff inside
            cage.beginFill(0x78582e, 0.5); cage.drawRect(cx+5, pY-15, 14, 15); cage.endFill();
            cage.beginFill(0x334155, 0.5); cage.drawRect(cx+22, pY-20, 12, 20); cage.endFill();
            c.addChild(cage);
        }
        // Red warning conduits
        const rd = new PIXI.Graphics(); rd.eventMode='none';
        rd.beginFill(0xef4444, 0.1); rd.drawRect(sx, fy+4, uw, 2); rd.endFill();
        for (let rx = sx+30; rx < sx+uw; rx += 60) { rd.beginFill(0xef4444, 0.3); rd.drawCircle(rx, fy+5, 1.5); rd.endFill(); }
        c.addChild(rd);
    },
    
    // ═══ HELPERS ═══
    _lbl(c, x, y, text, col) { const t = new PIXI.Text(text, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, letterSpacing:2 }); t.anchor.set(0.5,0); t.x=x; t.y=y; t.zIndex=10; c.addChild(t); },
    
    _npc(c, x, y, name, col) {
        const npcId = 'npc_'+name.toLowerCase().replace(/\s/g,'_');
        const bw=16, h=32, headH=12;
        let cont, head, body, legL, legR;
        // ─── HUMAN PATH — most apartment residents are flesh-and-blood workers ─
        if (typeof HumanAvatar !== 'undefined' && !HumanAvatar.isBot(name, npcId)) {
            const av = HumanAvatar.draw(c, {
                x, y, name: null,             // tag drawn separately below for layout
                shirt: col, accent: col,
                glasses: Math.random() < 0.5,
                seed: npcId, showTag: false, showDot: true
            });
            cont = av.cont; head = av.head; body = av.body; legL = av.legL; legR = av.legR;
            cont.zIndex = 5;
        } else {
            // ─── BOT PATH — preserve the old square-headed look for bots/AI ──
            cont = new PIXI.Container(); cont.x=x; cont.y=y; cont.zIndex=5;
            const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill();
            const lw = Math.max(2, bw*0.25);
            legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,4); legL.endFill(); legL.x=-bw*0.15;
            legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,4); legR.endFill(); legR.x=bw*0.15;
            body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2,0,bw,14,bw*0.1); body.endFill(); body.y=-h+headH;
            head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
            head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,1); head.drawCircle(bw*0.1,headH*0.38,1); head.endFill(); head.y=-h;
            const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-6;
            cont.addChild(sh,legL,legR,body,head,dot);
            c.addChild(cont);
        }
        cont.eventMode='static'; cont.cursor='pointer'; cont.hitArea=new PIXI.Rectangle(-bw,-h-12,bw*2,h+16);
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel({ id:npcId, name, isNPC:true, _trackType:'npc', role:name, lab:'other', desc:'Building staff.' }); });
        cont.on('pointerover', (e) => { if(typeof UI!=='undefined') UI.showTooltip(e, name, 'Building Staff'); });
        cont.on('pointerout', () => { if(typeof UI!=='undefined') UI.hideTooltip(); });
        const avObj = { cont, head, body, legL, legR, _minX:x-50, _maxX:x+50, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 };
        // Tracking highlight
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, { id: npcId }, false);
            if (hl) { avObj._trackGlow = hl.glow; avObj._trackArrow = hl.arrow; }
        }
        this.avatars.push(avObj);
    },
    
    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        const dp = G.getDayPhase(); const night = dp>.83||dp<.25;
        const vp = document.getElementById('viewport');
        if(vp){let sky;if(dp<.22)sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';else if(dp<.30){const t=(dp-.22)/.08;sky=`linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`;} else if(dp<.72) sky='linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if(dp<.84){const t=(dp-.72)/.12;sky=`linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`;} else sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';vp.style.background=sky;}
        if(this.celestialGfx){this.celestialGfx.clear();if(night){let np=dp>0.83?(dp-0.83)/0.42:(dp+0.17)/0.42;this.celestialGfx.beginFill(0xe8e8d0);this.celestialGfx.drawCircle(G.vpW*np,40+Math.sin(np*Math.PI)*120,12);this.celestialGfx.endFill();}else{let dayP=(dp-0.25)/(0.83-0.25);this.celestialGfx.beginFill(0xffe066);this.celestialGfx.drawCircle(G.vpW*dayP,40+Math.sin(dayP*Math.PI)*120,15);this.celestialGfx.endFill();}}
        if(this.starsLayer){this.starsLayer.visible=night;if(night)this.starsLayer.children.forEach(s=>{s.alpha=.15+Math.abs(Math.sin(G.tick*.03+s._phase))*.5;});}
        this.indoorLights.forEach(l => { if(!l.g||l.g.destroyed) return; l.g.alpha = l.maxA*(0.7+Math.sin(G.tick*0.02)*0.3); });
        if (this.bld && this.lifts[this.bld.id]) this.lifts[this.bld.id].update();
        if (this._liveTrains) this._liveTrains.update();
        this.avatars.forEach((av,ci) => { if(!av.cont||av.cont.destroyed) return; if(av._trackGlow){av._trackGlow.alpha=0.25+Math.sin(G.tick*0.1)*0.15;if(av._trackArrow)av._trackArrow.y=Math.sin(G.tick*0.15)*3-2;} if(av._isWalkIn){const dx=av._walkTarget-av.cont.x;if(Math.abs(dx)<av._walkSpeed){av.cont.x=av._walkTarget;av._isWalkIn=false;av._walkDir=0;av._walkTimer=60+Math.random()*120;av._minX=av._walkTarget-50;av._maxX=av._walkTarget+50;}else{av.cont.x+=Math.sign(dx)*av._walkSpeed;av.cont.scale.x=Math.sign(dx);if(av.head)av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5;if(av.legL)av.legL.y=Math.sin(G.tick*0.25+ci)*4;if(av.legR)av.legR.y=-Math.sin(G.tick*0.25+ci)*4;}return;} if(av._isZzz){const t=G.tick*0.04+av._phase;av._z1.y=Math.sin(t)*3;av._z1.alpha=0.5+Math.sin(t)*0.3;av._z2.y=-8+Math.sin(t+1)*3;av._z2.alpha=0.3+Math.sin(t+1)*0.25;av._z3.y=-18+Math.sin(t+2)*3;av._z3.alpha=0.15+Math.sin(t+2)*0.2;return;} av._walkTimer--; if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;} const nx=av.cont.x+av._walkDir*0.3; if(nx>av._minX&&nx<av._maxX)av.cont.x=nx; if(av.head)av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5; if(av.legL)av.legL.y=Math.sin(G.tick*0.2+ci)*3; if(av.legR)av.legR.y=-Math.sin(G.tick*0.2+ci)*3; });
    }
};
