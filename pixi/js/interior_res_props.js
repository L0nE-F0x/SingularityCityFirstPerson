/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR RESIDENTIAL PROPS (v15.2.0 - Billionaire's Row Props)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorResProps = {
    lifts: {},

    initLift(layer, bldId, numFloors, floorHeight, shaftX, minFloor) {
        if (this.lifts[bldId]) {
            this.lifts[bldId].destroy();
            delete this.lifts[bldId];
        }
        const lift = new ResElevator(layer, numFloors, floorHeight, shaftX, minFloor);
        this.lifts[bldId] = lift;
        return lift;
    },

    updateLifts() {
        Object.values(this.lifts).forEach(lift => {
            if (!lift.destroyed) lift.update();
        });
    },
    
    getLift(bldId) {
        return this.lifts[bldId];
    },

    drawRoof(roofH, startX, usableW, colHex, lab, bld) {
        const roofCont = new PIXI.Container();
        const isEstate = bld.id.startsWith('house_');
        const boardW = isEstate ? 280 : 220; 
        const boardH = 34; 
        const boardX = startX + usableW / 2 - boardW / 2; 
        const boardY = roofH - boardH - 10;
        
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0x111111); 
        gfx.lineStyle(2, colHex, 0.8); 
        gfx.drawRect(boardX, boardY, boardW, boardH); 
        gfx.endFill(); 
        gfx.lineStyle(0);
        
        gfx.beginFill(0x333333); 
        gfx.drawRect(boardX + 15, boardY + boardH, 6, 10); 
        gfx.drawRect(boardX + boardW - 21, boardY + boardH, 6, 10); 
        gfx.endFill();
        
        if (isEstate && bld.lab === 'xai') {
            gfx.beginFill(0x222233); gfx.drawEllipse(startX + usableW/2, roofH - 5, 40, 10); gfx.endFill();
            gfx.lineStyle(2, 0xfacc15); gfx.drawCircle(startX + usableW/2, roofH - 5, 15); gfx.lineStyle(0);
            const hTxt = new PIXI.Text('H', { fontFamily: 'Arial', fontSize: 16, fill: 0xfacc15, fontWeight: 'bold' });
            hTxt.anchor.set(0.5); hTxt.x = startX + usableW/2; hTxt.y = roofH - 5;
            roofCont.addChild(hTxt);
        }
        
        roofCont.addChild(gfx);
        
        const safeLabName = lab ? (lab.name || bld.name) : (bld.name || 'RESIDENTIAL');
        const textToDisplay = isEstate ? bld.name.toUpperCase() : (bld.lab ? safeLabName.toUpperCase() : `${bld.emoji || ''} ${(bld.name || 'TOWER').toUpperCase()}`.trim());
        
        const logoTxt = new PIXI.Text(textToDisplay, { 
            fontFamily: 'JetBrains Mono', 
            fontSize: 14, 
            fontWeight: 'bold', 
            fill: 0xffffff, 
            letterSpacing: 2, 
            dropShadow: true, 
            dropShadowColor: colHex, 
            dropShadowBlur: 8, 
            dropShadowDistance: 0 
        });
        logoTxt.anchor.set(0.5, 0.5); 
        logoTxt.x = startX + usableW / 2; 
        logoTxt.y = boardY + boardH / 2; 
        roofCont.addChild(logoTxt);
        
        this.scene.addChild(roofCont);
    },

    drawBasementInterior(gfx, x, y, w, h) {
        gfx.beginFill(0x0e0e15); 
        gfx.drawRect(x, y, w, h); 
        gfx.endFill();
        
        gfx.beginFill(0x0a0a10); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill();
        
        gfx.beginFill(0x1a1a2e); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill();
        
        for(let i = x + 100; i < x + w - 100; i += 150) {
            gfx.beginFill(0xffffff, 0.5); 
            gfx.drawRect(i - 10, y, 20, 2); 
            gfx.endFill();
            
            gfx.beginFill(0xfffce0, 0.02);
            gfx.moveTo(i - 10, y + 2); 
            gfx.lineTo(i + 10, y + 2);
            gfx.lineTo(i + 40, y + h - 8); 
            gfx.lineTo(i - 40, y + h - 8);
            gfx.endFill();
        }
    },

    drawNegativeSpaceWall(gfx, wallColor, x, y, w, h, isCeo, windowX, windowW, theme = 'residential') {
        gfx.beginFill(wallColor);
        if (theme === 'estate') {
            gfx.drawRect(x, y, w, 15); 
            gfx.drawRect(x, y + h - 20, w, 20); 
            gfx.drawRect(x, y + 15, windowX - x, h - 35); 
            gfx.drawRect(windowX + windowW, y + 15, x + w - (windowX + windowW), h - 35);
        } else {
            gfx.drawRect(x, y, w, 25); 
            gfx.drawRect(x, y + 55, w, h - 55); 
            gfx.drawRect(x, y + 25, windowX - x, 30); 
            
            let currX = windowX;
            while (currX + 40 <= windowX + windowW) {
                currX += 40; 
                let pillarW = Math.min(20, windowX + windowW - currX);
                if (pillarW > 0) gfx.drawRect(currX, y + 25, pillarW, 30);
                currX += 20; 
            }
            
            if (currX < windowX + windowW) gfx.drawRect(currX, y + 25, (windowX + windowW) - currX, 30);
            gfx.drawRect(windowX + windowW, y + 25, x + w - (windowX + windowW), 30);
        }
        gfx.endFill();
    },

    drawRoomInterior(gfx, x, y, w, h, colHex, isCeo, windowX, windowW, theme = 'general') {
        let wallCol = theme === 'estate' ? 0x151520 : 0x1e1e2f;
        let floorCol = theme === 'estate' ? 0x0a0a10 : 0x0f0f1a;
        let lightCol = 0xfef08a;
        let beamAlpha = 0.20;
        let ceilingLightA = 0.6;
        
        this.drawNegativeSpaceWall(gfx, wallCol, x, y, w, h, isCeo, windowX, windowW, theme);
        
        gfx.beginFill(floorCol); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill(); 
        
        gfx.lineStyle(1, 0x000000, 0.15);
        for(let i = x; i < x + w; i += 20) { 
            if (theme !== 'estate' && i > windowX && i < windowX + windowW) {
                let offset = i - windowX;
                if (offset % 60 < 40) continue; 
            }
            gfx.moveTo(i, y); 
            gfx.lineTo(i, y + h - 8); 
        }
        gfx.lineStyle(0);
        
        gfx.beginFill(0x222233); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill(); 
        
        const lightZones = theme === 'estate' ? 4 : 2; 
        const spacing = w / (lightZones + 1);
        for(let i = 1; i <= lightZones; i++) {
            const lx = x + (i * spacing);
            gfx.beginFill(lightCol, ceilingLightA); 
            gfx.drawRect(lx - 12, y, 24, 2); 
            gfx.endFill();
            
            const beam = new PIXI.Graphics();
            beam.beginFill(lightCol, beamAlpha);
            beam.moveTo(lx - 12, y + 2); 
            beam.lineTo(lx + 12, y + 2); 
            beam.lineTo(lx + 50, y + h - 8); 
            beam.lineTo(lx - 50, y + h - 8); 
            beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD;
            gfx.addChild(beam);
            
            if (!this.indoorLights) this.indoorLights = [];
            this.indoorLights.push({ g: beam, maxA: beamAlpha, type: 'ceiling' });
        }
    },

    drawServerRack(c, x, y, col) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0x11111a); 
        g.drawRect(x-10, y-30, 20, 30); 
        g.endFill(); 
        
        g.beginFill(0x222233); 
        for(let sy=y-26; sy<y-4; sy+=6) g.drawRect(x-8, sy, 16, 4); 
        
        g.beginFill(col); 
        for(let sy=y-25; sy<y-4; sy+=6) { 
            g.drawCircle(x-5, sy+1, 1); 
            g.drawCircle(x-1, sy+1, 1); 
        } 
        g.endFill(); 
        c.addChild(g); 
        
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.8);
        for(let sy=y-25; sy<y-4; sy+=6) { 
            glow.drawCircle(x-5, sy+1, 1.5); 
            glow.drawCircle(x-1, sy+1, 1.5); 
        }
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 1.0, type: 'server' });
    },

    drawLiquidCooledServer(c, x, y) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        g.beginFill(0x11111a); 
        g.drawRect(x-15, y-40, 30, 40); 
        g.endFill();
        
        g.beginFill(0x222233); 
        g.drawRect(x-12, y-38, 24, 36); 
        g.endFill();
        
        g.beginFill(0x06b6d4); 
        g.drawRect(x-8, y-36, 4, 32); 
        g.drawRect(x+4, y-36, 4, 32); 
        g.endFill();
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0x06b6d4, 0.4); 
        glow.drawRect(x-8, y-36, 4, 32); 
        glow.drawRect(x+4, y-36, 4, 32); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; 
        c.addChild(g, glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'server' });
    },

    drawReceptionDesk(c, x, y, col) { 
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none'; 
        g.beginFill(0x2a2a3e); 
        g.drawRect(x-10, y-22, 40, 22); 
        g.endFill(); 
        g.beginFill(col, 0.8); 
        g.drawRect(x-12, y-22, 44, 4); 
        g.endFill(); 
        g.beginFill(0x11111a); 
        g.drawRect(x+5, y-32, 6, 10); 
        g.endFill(); 
        g.beginFill(0x22d3ee); 
        g.drawRect(x+4, y-31, 2, 8); 
        g.endFill(); 
        c.addChild(g); 
    },
    
    drawCouches(c, x, y, colHex) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(colHex, 0.3); 
        g.drawRect(x-20, y-10, 40, 10); 
        g.beginFill(0x333333); 
        g.drawRect(x-24, y-16, 6, 16); 
        g.drawRect(x+18, y-16, 6, 16); 
        g.drawRect(x-20, y-20, 40, 10); 
        g.endFill(); 
        c.addChild(g); 
    },

    drawWaterCooler(c, x, y) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0xdddddd); 
        g.drawRect(x-5, y-18, 10, 18); 
        g.endFill(); 
        g.beginFill(0x3b82f6, 0.6); 
        g.drawRoundedRect(x-4, y-32, 8, 14, 2); 
        g.endFill(); 
        g.beginFill(0x11111a); 
        g.drawRect(x-3, y-14, 6, 4); 
        g.endFill(); 
        g.beginFill(0xff3333); 
        g.drawRect(x-3, y-17, 2, 2); 
        g.beginFill(0x3b82f6); 
        g.drawRect(x+1, y-17, 2, 2); 
        g.endFill(); 
        c.addChild(g); 
    },

    drawShower(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        if (style === 1 || style === 3) { 
            g.beginFill(0x1e293b); g.drawRect(x - 14, y - 4, 28, 4); g.endFill(); 
            g.beginFill(0x0ea5e9, 0.15); g.lineStyle(1, 0xcbd5e1, 0.3); g.drawRect(x - 14, y - 40, 28, 40); g.lineStyle(0); 
            g.beginFill(0x94a3b8); g.drawRect(x - 4, y - 40, 8, 3); g.endFill(); 
            g.beginFill(0x38bdf8, 0.4); g.drawRect(x - 2, y - 37, 4, 25); g.endFill(); 
        } else { 
            g.beginFill(0xf8fafc); g.drawRect(x - 18, y - 10, 36, 10); g.endFill(); 
            g.beginFill(0xe2e8f0); g.drawRect(x - 16, y - 40, 32, 2); g.endFill(); 
            g.beginFill(0x38bdf8, 0.2); g.drawRect(x - 16, y - 38, 16, 28); g.endFill(); 
            g.beginFill(0x94a3b8); g.drawRect(x + 10, y - 30, 4, 4); g.endFill(); 
        }
        c.addChild(g);
    },

    drawKitchen(c, x, y, region, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x475569); g.drawRect(x - 25, y - 40, 14, 40); g.endFill(); 
        g.beginFill(0x94a3b8); g.drawRect(x - 23, y - 20, 2, 10); g.drawRect(x - 23, y - 35, 2, 10); g.endFill(); 
        
        const counterCol = (style === 1 || style === 4) ? 0x1e293b : 0xb45309; 
        const topCol = (style === 1 || style === 4) ? 0xf1f5f9 : 0x0f172a; 
        
        g.beginFill(counterCol); g.drawRect(x - 10, y - 18, 35, 18); g.endFill(); 
        g.beginFill(topCol); g.drawRect(x - 12, y - 18, 39, 3); g.endFill(); 
        
        g.beginFill(0x0ea5e9); g.drawRect(x - 5, y - 18, 10, 2); g.endFill(); 
        g.beginFill(0x64748b); g.drawRect(x - 1, y - 22, 2, 4); g.endFill(); 
        
        g.beginFill(0x111111); g.drawRect(x + 10, y - 18, 12, 2); g.endFill(); 
        g.beginFill(0xef4444); g.drawCircle(x + 13, y - 17, 1); g.drawCircle(x + 19, y - 17, 1); g.endFill(); 
        
        if (style === 2 || style === 3) {
            g.beginFill(counterCol); g.drawRect(x - 10, y - 40, 35, 10); g.endFill(); 
        } else {
            g.beginFill(0x64748b); g.drawRect(x + 10, y - 35, 12, 4); g.endFill(); 
        }
        c.addChild(g);
    },

    drawBed(c, x, y, region, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const frameCol = (style === 1 || style === 4) ? 0x334155 : 0x78350f;
        const duvetCol = style === 1 ? 0x3b82f6 : (style === 2 ? 0x10b981 : (style === 3 ? 0xf43f5e : 0xa855f7));
        
        g.beginFill(frameCol); g.drawRect(x - 22, y - 18, 6, 18); g.endFill();
        g.beginFill(frameCol); g.drawRect(x - 18, y - 6, 38, 6); g.endFill();
        g.beginFill(0xf1f5f9); g.drawRect(x - 16, y - 10, 34, 4); g.endFill();
        g.beginFill(duvetCol); g.drawRect(x - 2, y - 11, 20, 6); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x - 15, y - 12, 6, 4); g.drawRect(x - 8, y - 12, 6, 4); g.endFill();
        
        c.addChild(g);
    },

    drawPottedPlant(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const potCol = (style === 1 || style === 3) ? 0xffedd5 : 0xc2410c; 
        
        g.beginFill(potCol); 
        g.drawPolygon([x - 4, y - 6, x + 4, y - 6, x + 3, y, x - 3, y]); 
        g.endFill();
        
        g.beginFill(0x22c55e); 
        if (style === 1 || style === 4) { 
            g.drawCircle(x, y - 10, 5); 
            g.drawCircle(x - 4, y - 8, 4); 
            g.drawCircle(x + 4, y - 8, 4);
        } else { 
            g.drawPolygon([x - 2, y - 6, x - 4, y - 18, x, y - 6]);
            g.drawPolygon([x, y - 6, x + 1, y - 20, x + 2, y - 6]);
            g.drawPolygon([x + 2, y - 6, x + 5, y - 15, x + 4, y - 6]);
        }
        g.endFill();
        c.addChild(g);
    },

    drawGeckoTerrarium(c, x, y) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x33334a); 
        g.drawRect(x-12, y-8, 24, 8); 
        g.endFill(); 
        
        g.beginFill(0x111111, 0.5); 
        g.drawRect(x-10, y-20, 20, 12); 
        g.endFill(); 
        
        g.lineStyle(1, 0xffffff, 0.2); 
        g.drawRect(x-10, y-20, 20, 12); 
        g.lineStyle(0);
        
        g.beginFill(0x22c55e); 
        g.drawCircle(x-5, y-12, 3); 
        g.drawCircle(x+4, y-14, 2); 
        g.endFill(); 
        
        g.beginFill(0xfacc15); 
        g.drawRect(x-1, y-10, 2, 1); 
        g.endFill(); 
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.2); 
        glow.drawRect(x-10, y-20, 20, 12); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; 
        c.addChild(g, glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.3, type: 'ceiling' });
    },

    drawLivingArea(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const sofaCol = (style === 1 || style === 3) ? 0x6366f1 : 0x8b5cf6;
        
        g.beginFill(sofaCol); 
        g.drawRect(x - 15, y - 12, 30, 8); 
        g.beginFill(sofaCol - 0x111111); 
        g.drawRect(x - 15, y - 6, 30, 6); 
        g.beginFill(0x333333); 
        g.drawRect(x - 16, y - 10, 4, 10); 
        g.drawRect(x + 12, y - 10, 4, 10); 
        g.endFill();
        
        g.beginFill(0xd97706); g.drawRect(x - 8, y - 2, 16, 2); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x - 7, y, 2, 2); g.drawRect(x + 5, y, 2, 2); g.endFill();
        
        const tvX = x + 25;
        g.beginFill(0x1e293b); g.drawRect(tvX - 10, y - 6, 20, 6); g.endFill(); 
        g.beginFill(0x0f172a); g.drawRect(tvX - 8, y - 20, 16, 10); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(tvX - 7, y - 19, 14, 8); g.endFill(); 
        c.addChild(g);
        
        const tvGlow = new PIXI.Graphics();
        tvGlow.beginFill(0x22d3ee, 0.3); 
        tvGlow.drawRect(tvX - 7, y - 19, 14, 8); 
        tvGlow.endFill();
        tvGlow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(tvGlow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: tvGlow, maxA: 0.5, type: 'screen' });
    },

    drawNightstand(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x475569); g.drawRect(x - 5, y - 8, 10, 8); g.endFill(); 
        g.beginFill(0x1e293b); g.drawRect(x - 4, y - 6, 8, 2); g.endFill(); 
        
        g.beginFill(0x94a3b8); g.drawRect(x - 1, y - 12, 2, 4); g.endFill(); 
        g.beginFill(0xfef08a); g.drawPolygon([x - 3, y - 12, x + 3, y - 12, x + 2, y - 16, x - 2, y - 16]); g.endFill(); 
        c.addChild(g);
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.4); 
        glow.drawCircle(x, y - 12, 15); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'ceiling' }); 
    },

    // ─── NEW ESTATE EXCLUSIVE PROPS ───
    drawGrandPiano(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); 
        g.drawRect(x-20, y-15, 40, 10); 
        g.drawRect(x-18, y-5, 4, 5); 
        g.drawRect(x+14, y-5, 4, 5); 
        g.endFill();
        g.beginFill(0xffffff); 
        for(let i=0; i<10; i++) g.drawRect(x-18 + i*4, y-15, 3, 2); 
        g.endFill();
        c.addChild(g);
    },

    drawLuxuryBed(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-30, y-20, 6, 20); g.endFill();
        g.beginFill(0x2a2a42); g.drawRect(x-24, y-10, 48, 10); g.endFill();
        g.beginFill(col); g.drawRect(x-10, y-12, 34, 8); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x-22, y-14, 8, 5); g.drawRect(x-12, y-14, 8, 5); g.endFill();
        c.addChild(g);
    },

    drawBossDesk(c, x, y, col) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,50,18); g.endFill(); 
        g.beginFill(col); g.drawRect(x-8,y-18,56,5); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x+10,y-30,6,12); g.drawRect(x+20,y-30,6,12); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x+9,y-29,2,10); g.drawRect(x+19,y-29,2,10); g.endFill(); 
        c.addChild(g); 
    },

    drawChair(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,4,12); g.drawRect(x-5,y-8,12,3); 
        g.beginFill(0x33334a); g.drawRect(x+1,y-5,2,3); g.drawRect(x-3,y-2,10,2); g.endFill(); 
        c.addChild(g); 
    },

    drawArcadeCabinet(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); g.drawPolygon([x-10,y, x-10,y-30, x-8,y-35, x+8,y-35, x+10,y-30, x+10,y]); g.endFill();
        g.beginFill(0x222222); g.drawRect(x-8, y-32, 16, 12); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-12, y-20, 24, 4); g.endFill(); 
        const glow = new PIXI.Graphics();
        glow.beginFill(0x00ffff, 0.6); glow.drawRect(x-6, y-30, 12, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawRing(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-40, y-10, 80, 10); g.endFill(); 
        g.beginFill(0x4ade80, 0.4); g.drawRect(x-40, y-10, 80, 2); g.endFill(); 
        g.beginFill(0x33334a); g.drawRect(x-40, y-30, 4, 20); g.drawRect(x+36, y-30, 4, 20); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-40, y-25, 80, 2); g.endFill(); 
        g.beginFill(0xffffff); g.drawRect(x-40, y-15, 80, 2); g.endFill(); 
        c.addChild(g);
    },

    // ─── NEW LUXURY ESTATE PROPS ───

    drawWineRack(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Wooden rack frame
        g.beginFill(0x78350f); g.drawRect(x-20, y-45, 40, 45); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x-18, y-43, 36, 41); g.endFill();
        // Wine bottles (rows)
        for(let wy=y-40; wy<y-5; wy+=8) {
            for(let wx=x-14; wx<x+14; wx+=8) {
                g.beginFill(0x4c1d20); g.drawRect(wx, wy, 6, 5); g.endFill();
                g.beginFill(0x7f1d1d, 0.8); g.drawCircle(wx+3, wy+2, 2); g.endFill();
            }
        }
        c.addChild(g);
    },

    drawTrophyCase(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass case
        g.beginFill(0x1e293b); g.drawRect(x-22, y-40, 44, 40); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-20, y-38, 40, 36); g.endFill();
        g.lineStyle(1, 0x38bdf8, 0.3); g.drawRect(x-20, y-38, 40, 36); g.lineStyle(0);
        // Trophies
        g.beginFill(0xfbbf24); g.drawRect(x-8, y-28, 4, 14); g.drawRect(x-12, y-28, 12, 4); g.endFill();
        g.beginFill(col || 0xfbbf24); g.drawRect(x+6, y-22, 4, 10); g.drawRect(x+2, y-22, 12, 3); g.endFill();
        g.beginFill(0xc0c0c0); g.drawRect(x-4, y-18, 3, 8); g.endFill();
        // Glass reflection
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0x38bdf8, 0.06); glow.drawRect(x-20, y-38, 40, 36); glow.endFill();
        c.addChild(g, glow);
    },

    drawFireplace(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Mantle
        g.beginFill(0x44403c); g.drawRect(x-30, y-40, 60, 40); g.endFill();
        g.beginFill(0x57534e); g.drawRect(x-32, y-42, 64, 6); g.endFill();
        // Firebox
        g.beginFill(0x1c1917); g.drawRect(x-18, y-30, 36, 26); g.endFill();
        // Flames
        g.beginFill(0xf97316, 0.8); 
        g.drawPolygon([x-10, y-4, x-5, y-20, x, y-8]); 
        g.drawPolygon([x-2, y-4, x+4, y-24, x+10, y-4]); 
        g.endFill();
        g.beginFill(0xfbbf24, 0.6); 
        g.drawPolygon([x-6, y-4, x-2, y-16, x+2, y-4]); 
        g.endFill();
        // Glow
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0xf97316, 0.08); glow.drawCircle(x, y-15, 40); glow.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.12, type: 'fire' });
    },

    drawBonsaiTree(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pot
        g.beginFill(0x78350f); g.drawRect(x-8, y-8, 16, 8); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x-10, y-10, 20, 4); g.endFill();
        // Trunk
        g.beginFill(0x5c4033); g.drawRect(x-2, y-22, 4, 14); g.endFill();
        g.beginFill(0x5c4033); g.drawRect(x, y-24, 8, 3); g.endFill();
        // Canopy
        g.beginFill(0x166534); g.drawCircle(x-4, y-26, 8); g.drawCircle(x+6, y-24, 6); g.drawCircle(x, y-30, 7); g.endFill();
        c.addChild(g);
    },

    drawScrollArt(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Hanging scroll
        g.beginFill(0x78350f); g.drawRect(x-12, y-50, 24, 3); g.endFill();
        g.beginFill(0xfef3c7); g.drawRect(x-10, y-47, 20, 35); g.endFill();
        // Ink brush strokes (abstract)
        g.beginFill(0x1c1917, 0.7);
        g.drawRect(x-6, y-42, 2, 20);
        g.drawRect(x-2, y-38, 2, 16);
        g.drawRect(x+3, y-40, 2, 22);
        g.endFill();
        g.beginFill(0xdc2626, 0.8); g.drawRect(x+2, y-18, 5, 5); g.endFill();
        // Bottom rod
        g.beginFill(0x78350f); g.drawRect(x-12, y-12, 24, 3); g.endFill();
        c.addChild(g);
    },

    // ─── CEO PERSONALITY-THEMED PROPS ───

    drawMMAOctagon(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Platform
        g.beginFill(0x1a1a2e); g.drawRect(x - 50, y - 6, 100, 6); g.endFill();
        // Canvas mat
        g.beginFill(0x2d2d4d); g.drawRect(x - 45, y - 8, 90, 4); g.endFill();
        // Cage posts
        g.beginFill(0x64748b); g.drawRect(x - 48, y - 44, 4, 40); g.drawRect(x + 44, y - 44, 4, 40); g.endFill();
        // Cage mesh (horizontal wires)
        g.lineStyle(1, 0x94a3b8, 0.4);
        for (let wy = y - 40; wy < y - 10; wy += 6) { g.moveTo(x - 46, wy); g.lineTo(x + 46, wy); }
        g.lineStyle(0);
        // Corner pads
        g.beginFill(0xef4444); g.drawRect(x - 48, y - 44, 6, 6); g.drawRect(x + 42, y - 44, 6, 6); g.endFill();
        // "UFC" label on mat
        g.beginFill(0xef4444, 0.3); g.drawRect(x - 12, y - 7, 24, 2); g.endFill();
        c.addChild(g);
    },

    drawSurfboard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Wall-mounted surfboard (angled)
        g.beginFill(0x0ea5e9);
        g.drawPolygon([x - 3, y - 55, x + 3, y - 55, x + 5, y - 8, x + 2, y, x - 2, y, x - 5, y - 8]);
        g.endFill();
        // Stripe
        g.beginFill(0xfbbf24); g.drawRect(x - 2, y - 45, 4, 30); g.endFill();
        // Fin
        g.beginFill(0x0369a1); g.drawPolygon([x - 1, y - 6, x + 4, y - 2, x - 1, y - 2]); g.endFill();
        // Wall mount brackets
        g.beginFill(0x64748b); g.drawRect(x - 8, y - 40, 3, 6); g.drawRect(x - 8, y - 20, 3, 6); g.endFill();
        c.addChild(g);
    },

    drawVRHeadsetDisplay(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Display pedestal
        g.beginFill(0x1e293b); g.drawRect(x - 12, y - 8, 24, 8); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x - 8, y - 10, 16, 4); g.endFill();
        // VR headset
        g.beginFill(0x334155); g.drawRoundedRect(x - 10, y - 22, 20, 12, 3); g.endFill();
        g.beginFill(0x0ea5e9, 0.4); g.drawRect(x - 8, y - 20, 7, 8); g.drawRect(x + 1, y - 20, 7, 8); g.endFill();
        // Strap
        g.lineStyle(2, 0x475569); g.moveTo(x - 10, y - 16); g.lineTo(x - 14, y - 20); g.moveTo(x + 10, y - 16); g.lineTo(x + 14, y - 20); g.lineStyle(0);
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0x0ea5e9, 0.15); glow.drawCircle(x, y - 16, 18); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'screen' });
    },

    drawTelescope(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tripod legs
        g.beginFill(0x64748b);
        g.drawPolygon([x - 2, y - 30, x - 14, y, x - 10, y]); // left leg
        g.drawPolygon([x + 2, y - 30, x + 14, y, x + 10, y]); // right leg
        g.drawPolygon([x - 1, y - 30, x + 4, y, x + 8, y]);   // back leg
        g.endFill();
        // Telescope tube (angled upward)
        g.beginFill(0x1e293b); g.drawPolygon([x - 4, y - 32, x + 20, y - 48, x + 22, y - 44, x - 2, y - 28]); g.endFill();
        // Lens
        g.beginFill(0x38bdf8, 0.6); g.drawCircle(x + 22, y - 46, 3); g.endFill();
        // Eyepiece
        g.beginFill(0x475569); g.drawRect(x - 6, y - 34, 4, 4); g.endFill();
        c.addChild(g);
    },

    drawLeatherJacketDisplay(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass display case
        g.beginFill(0x1e293b); g.drawRect(x - 16, y - 50, 32, 50); g.endFill();
        g.lineStyle(1, 0x38bdf8, 0.2); g.drawRect(x - 16, y - 50, 32, 50); g.lineStyle(0);
        // Jacket silhouette
        g.beginFill(0x111111);
        g.drawPolygon([x - 10, y - 42, x - 6, y - 44, x, y - 40, x + 6, y - 44, x + 10, y - 42, x + 12, y - 14, x - 12, y - 14]);
        g.endFill();
        // Collar
        g.beginFill(0x1a1a1a); g.drawPolygon([x - 6, y - 44, x, y - 40, x + 6, y - 44, x + 4, y - 46, x, y - 43, x - 4, y - 46]); g.endFill();
        // Zipper line
        g.beginFill(0x64748b); g.drawRect(x - 1, y - 40, 2, 26); g.endFill();
        // Spotlight
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(col || 0xfbbf24, 0.06); glow.drawCircle(x, y - 30, 22); glow.endFill();
        c.addChild(g, glow);
    },

    drawBookshelfWall(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const shelfW = w || 80;
        // Wooden frame
        g.beginFill(0x5c3a1e); g.drawRect(x - shelfW / 2, y - 55, shelfW, 55); g.endFill();
        g.beginFill(0x4a2e16); g.drawRect(x - shelfW / 2 + 2, y - 53, shelfW - 4, 51); g.endFill();
        // Shelves with books
        const bookCols = [0x3b82f6, 0xef4444, 0x22c55e, 0xfbbf24, 0xa855f7, 0x06b6d4, 0xf97316, 0xec4899];
        for (let sy = y - 50; sy < y - 5; sy += 14) {
            g.beginFill(0x5c3a1e); g.drawRect(x - shelfW / 2 + 2, sy + 11, shelfW - 4, 2); g.endFill();
            for (let bx = x - shelfW / 2 + 5; bx < x + shelfW / 2 - 5; bx += 5) {
                const bh = 8 + Math.floor((bx * 7 + sy * 3) % 4);
                g.beginFill(bookCols[(bx * 3 + sy) % bookCols.length], 0.8);
                g.drawRect(bx, sy + 11 - bh, 3, bh);
                g.endFill();
            }
        }
        c.addChild(g);
    },

    drawMeditationCorner(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tatami/mat
        g.beginFill(0x92400e, 0.4); g.drawEllipse(x, y - 2, 22, 6); g.endFill();
        // Meditation cushion (zafu)
        g.beginFill(0x7c3aed); g.drawEllipse(x, y - 6, 10, 4); g.endFill();
        g.beginFill(0x6d28d9); g.drawEllipse(x, y - 8, 8, 3); g.endFill();
        // Incense holder
        g.beginFill(0x78350f); g.drawRect(x + 18, y - 4, 6, 4); g.endFill();
        // Smoke wisps
        g.lineStyle(1, 0x94a3b8, 0.3);
        g.moveTo(x + 21, y - 6); g.quadraticCurveTo(x + 23, y - 16, x + 19, y - 24);
        g.moveTo(x + 21, y - 6); g.quadraticCurveTo(x + 18, y - 14, x + 22, y - 22);
        g.lineStyle(0);
        // Candle
        g.beginFill(0xfef3c7); g.drawRect(x - 20, y - 8, 4, 8); g.endFill();
        g.beginFill(0xfbbf24); g.drawPolygon([x - 20, y - 8, x - 18, y - 14, x - 16, y - 8]); g.endFill();
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0xfbbf24, 0.06); glow.drawCircle(x - 18, y - 10, 16); glow.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'fire' });
    },

    drawRocketModel(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pedestal
        g.beginFill(0x1e293b); g.drawRect(x - 10, y - 6, 20, 6); g.endFill();
        g.beginFill(0x334155); g.drawRect(x - 12, y - 8, 24, 4); g.endFill();
        // Rocket body
        g.beginFill(0xf1f5f9); g.drawRect(x - 4, y - 42, 8, 34); g.endFill();
        // Nose cone
        g.beginFill(0xf1f5f9); g.drawPolygon([x - 4, y - 42, x, y - 52, x + 4, y - 42]); g.endFill();
        // Window
        g.beginFill(0x0ea5e9); g.drawCircle(x, y - 36, 2); g.endFill();
        // Fins
        g.beginFill(0x64748b);
        g.drawPolygon([x - 4, y - 12, x - 10, y - 8, x - 4, y - 20]);
        g.drawPolygon([x + 4, y - 12, x + 10, y - 8, x + 4, y - 20]);
        g.endFill();
        // Exhaust glow
        g.beginFill(0xf97316, 0.4); g.drawPolygon([x - 3, y - 8, x, y - 2, x + 3, y - 8]); g.endFill();
        c.addChild(g);
    },

    drawCookingStation(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Counter
        g.beginFill(0x334155); g.drawRect(x - 30, y - 16, 60, 16); g.endFill();
        g.beginFill(0xf1f5f9); g.drawRect(x - 32, y - 16, 64, 3); g.endFill();
        // Stove burners
        g.beginFill(0x111111); g.drawCircle(x - 12, y - 16, 6); g.drawCircle(x + 12, y - 16, 6); g.endFill();
        g.beginFill(0xef4444, 0.5); g.drawCircle(x - 12, y - 16, 3); g.endFill();
        // Pot
        g.beginFill(0x64748b); g.drawRect(x + 6, y - 26, 14, 10); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(x + 4, y - 26, 18, 2); g.endFill();
        // Steam
        g.lineStyle(1, 0xffffff, 0.2);
        g.moveTo(x + 10, y - 28); g.quadraticCurveTo(x + 8, y - 36, x + 12, y - 42);
        g.moveTo(x + 16, y - 28); g.quadraticCurveTo(x + 18, y - 34, x + 14, y - 40);
        g.lineStyle(0);
        // Hanging utensils
        g.beginFill(0x94a3b8);
        g.drawRect(x - 24, y - 40, 1, 12); g.drawRect(x - 20, y - 38, 1, 10); g.drawRect(x - 16, y - 42, 1, 14);
        g.endFill();
        // Knife block
        g.beginFill(0x5c3a1e); g.drawRect(x + 22, y - 24, 8, 8); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(x + 24, y - 30, 1, 8); g.drawRect(x + 27, y - 28, 1, 6); g.endFill();
        c.addChild(g);
    },

    drawGPUShowcase(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass display case
        g.beginFill(0x0f172a); g.drawRect(x - 22, y - 45, 44, 45); g.endFill();
        g.lineStyle(1, col || 0x76b900, 0.3); g.drawRect(x - 22, y - 45, 44, 45); g.lineStyle(0);
        // GPU cards (stacked)
        for (let i = 0; i < 4; i++) {
            const gy2 = y - 38 + i * 9;
            g.beginFill(0x1e293b); g.drawRect(x - 16, gy2, 32, 7); g.endFill();
            g.beginFill(col || 0x76b900, 0.6); g.drawRect(x - 14, gy2 + 1, 8, 5); g.endFill();
            // Heat pipes
            g.beginFill(0x64748b); g.drawRect(x + 2, gy2 + 2, 12, 1); g.drawRect(x + 2, gy2 + 4, 12, 1); g.endFill();
            // LED
            g.beginFill(col || 0x76b900); g.drawCircle(x + 16, gy2 + 3, 1); g.endFill();
        }
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(col || 0x76b900, 0.06); glow.drawRect(x - 22, y - 45, 44, 45); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.1, type: 'screen' });
    },

    drawGymCorner(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Bench press
        g.beginFill(0x1e293b); g.drawRect(x - 20, y - 8, 40, 4); g.endFill(); // bench
        g.beginFill(0x334155); g.drawRect(x - 22, y - 4, 4, 4); g.drawRect(x + 18, y - 4, 4, 4); g.endFill(); // legs
        // Barbell rack
        g.beginFill(0x64748b); g.drawRect(x - 24, y - 30, 4, 26); g.drawRect(x + 20, y - 30, 4, 26); g.endFill();
        // Barbell
        g.beginFill(0x94a3b8); g.drawRect(x - 28, y - 28, 56, 2); g.endFill();
        // Weight plates
        g.beginFill(0x1e293b); g.drawRect(x - 30, y - 32, 6, 10); g.drawRect(x + 24, y - 32, 6, 10); g.endFill();
        // Dumbbells on floor
        g.beginFill(0x64748b); g.drawRect(x + 30, y - 4, 14, 3); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x + 28, y - 6, 4, 6); g.drawRect(x + 42, y - 6, 4, 6); g.endFill();
        c.addChild(g);
    },

    drawPoolTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Table legs
        g.beginFill(0x5c3a1e); g.drawRect(x - 38, y - 4, 4, 4); g.drawRect(x + 34, y - 4, 4, 4); g.endFill();
        // Table body
        g.beginFill(0x5c3a1e); g.drawRect(x - 40, y - 12, 80, 8); g.endFill();
        // Green felt
        g.beginFill(0x166534); g.drawRect(x - 36, y - 14, 72, 6); g.endFill();
        // Rails
        g.beginFill(0x4a2e16); g.drawRect(x - 38, y - 16, 76, 2); g.endFill();
        // Corner pockets
        g.beginFill(0x000000); g.drawCircle(x - 35, y - 13, 2); g.drawCircle(x + 35, y - 13, 2); g.endFill();
        // Balls
        g.beginFill(0xffffff); g.drawCircle(x - 10, y - 12, 1.5); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x + 8, y - 11, 1.5); g.endFill();
        g.beginFill(0xfbbf24); g.drawCircle(x + 12, y - 12, 1.5); g.endFill();
        g.beginFill(0x3b82f6); g.drawCircle(x + 10, y - 13, 1.5); g.endFill();
        c.addChild(g);
    },

    drawHomeBar(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Bar counter
        g.beginFill(0x5c3a1e); g.drawRect(x - 30, y - 18, 60, 18); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x - 32, y - 20, 64, 4); g.endFill();
        // Back shelf with bottles
        g.beginFill(0x3a2a18); g.drawRect(x - 28, y - 48, 56, 28); g.endFill();
        const bottleCols = [0x22c55e, 0xfbbf24, 0xef4444, 0x3b82f6, 0xa855f7, 0xffffff];
        for (let i = 0; i < 8; i++) {
            const bx = x - 24 + i * 7;
            g.beginFill(bottleCols[i % bottleCols.length], 0.7);
            g.drawRect(bx, y - 44, 4, 16);
            g.endFill();
            g.beginFill(bottleCols[i % bottleCols.length], 0.5);
            g.drawRect(bx + 1, y - 48, 2, 4);
            g.endFill();
        }
        // Shelf
        g.beginFill(0x5c3a1e); g.drawRect(x - 28, y - 28, 56, 2); g.endFill();
        // Glasses on lower shelf
        for (let i = 0; i < 4; i++) {
            g.beginFill(0xffffff, 0.3); g.drawRect(x - 22 + i * 12, y - 26, 4, 6); g.endFill();
        }
        // Bar stools
        g.beginFill(0x1e293b); g.drawCircle(x - 16, y - 4, 5); g.drawCircle(x + 16, y - 4, 5); g.endFill();
        g.beginFill(0x334155); g.drawRect(x - 17, y - 2, 2, 2); g.drawRect(x + 15, y - 2, 2, 2); g.endFill();
        c.addChild(g);
    },

    drawCricketBat(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Wall-mounted cricket bat (vertical)
        g.beginFill(0xd4a574); g.drawRect(x - 4, y - 48, 8, 30); g.endFill(); // blade
        g.beginFill(0xc2956b); g.drawRect(x - 3, y - 18, 6, 14); g.endFill(); // handle
        g.beginFill(0x78350f); g.drawRect(x - 2, y - 16, 4, 10); g.endFill(); // grip
        // Cricket ball beside it
        g.beginFill(0xdc2626); g.drawCircle(x + 14, y - 6, 4); g.endFill();
        g.lineStyle(1, 0xfef3c7, 0.6); g.moveTo(x + 11, y - 6); g.lineTo(x + 17, y - 6); g.lineStyle(0);
        // Mount bracket
        g.beginFill(0x64748b); g.drawRect(x - 6, y - 40, 2, 6); g.drawRect(x - 6, y - 24, 2, 6); g.endFill();
        c.addChild(g);
    },

    drawStandingDesk(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tall desk frame
        g.beginFill(0x475569); g.drawRect(x - 22, y - 2, 4, 2); g.drawRect(x + 18, y - 2, 4, 2); g.endFill(); // feet
        g.beginFill(0x64748b); g.drawRect(x - 20, y - 28, 4, 26); g.drawRect(x + 16, y - 28, 4, 26); g.endFill(); // legs
        // Desktop
        g.beginFill(0x1e293b); g.drawRect(x - 24, y - 30, 48, 4); g.endFill();
        // Monitor (tall mounted)
        g.beginFill(0x0f172a); g.drawRect(x - 10, y - 46, 20, 14); g.endFill();
        g.beginFill(col || 0x22d3ee); g.drawRect(x - 8, y - 44, 16, 10); g.endFill();
        // Keyboard
        g.beginFill(0x334155); g.drawRect(x - 8, y - 28, 16, 2); g.endFill();
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(col || 0x22d3ee, 0.15); glow.drawRect(x - 8, y - 44, 16, 10); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.3, type: 'screen' });
    },

    drawWhiteboard(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const bw = w || 60;
        // Board
        g.beginFill(0xf1f5f9); g.drawRect(x - bw / 2, y - 40, bw, 30); g.endFill();
        g.lineStyle(1, 0x94a3b8, 0.4); g.drawRect(x - bw / 2, y - 40, bw, 30); g.lineStyle(0);
        // Scribbles
        g.lineStyle(2, 0x3b82f6, 0.4);
        g.moveTo(x - bw / 2 + 6, y - 34); g.lineTo(x - 4, y - 30); g.lineTo(x + 10, y - 36);
        g.lineStyle(1, 0xef4444, 0.3);
        g.moveTo(x - 10, y - 22); g.lineTo(x + bw / 2 - 8, y - 18);
        g.lineStyle(1, 0x22c55e, 0.3);
        g.moveTo(x - bw / 2 + 8, y - 16); g.lineTo(x + 6, y - 20);
        g.lineStyle(0);
        // Tray
        g.beginFill(0x94a3b8); g.drawRect(x - bw / 2, y - 10, bw, 3); g.endFill();
        // Markers
        g.beginFill(0xef4444); g.drawRect(x - 8, y - 12, 6, 2); g.endFill();
        g.beginFill(0x3b82f6); g.drawRect(x + 2, y - 12, 6, 2); g.endFill();
        c.addChild(g);
    },

    drawIndoorGarden(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Planter box
        g.beginFill(0x5c3a1e); g.drawRect(x - 30, y - 6, 60, 6); g.endFill();
        g.beginFill(0x3a2a18); g.drawRect(x - 28, y - 4, 56, 2); g.endFill();
        // Soil
        g.beginFill(0x2a1e10); g.drawRect(x - 28, y - 8, 56, 4); g.endFill();
        // Plants (varied shapes)
        const plantCols = [0x22c55e, 0x16a34a, 0x15803d, 0x166534, 0x4ade80];
        for (let i = 0; i < 6; i++) {
            const px = x - 22 + i * 9;
            const ph = 10 + (i * 7) % 12;
            g.beginFill(plantCols[i % plantCols.length]);
            g.drawPolygon([px - 2, y - 8, px, y - 8 - ph, px + 2, y - 8]);
            if (i % 2 === 0) g.drawCircle(px, y - 10 - ph / 2, 4);
            g.endFill();
        }
        c.addChild(g);
    },

    drawSiloInterior(c, x, y, w, floorH, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Reinforced concrete walls
        g.beginFill(0x0a0a0f); g.drawRect(x, y, w, floorH); g.endFill();
        g.beginFill(0x111118); g.drawRect(x+8, y+8, w-16, floorH-16); g.endFill();
        // Hazard tape top
        g.beginFill(0xfbbf24);
        for(var hx=x; hx<x+w; hx+=16) {
            g.drawPolygon([hx, y, hx+8, y, hx+2, y+6, hx-6, y+6]);
        }
        g.endFill();
        g.beginFill(0x000000);
        for(var hx2=x+8; hx2<x+w; hx2+=16) {
            g.drawPolygon([hx2, y, hx2+8, y, hx2+2, y+6, hx2-6, y+6]);
        }
        g.endFill();
        // Server racks
        for(var rx=x+30; rx<x+w-60; rx+=55) {
            // Rack body
            g.beginFill(0x1e293b); g.drawRect(rx, y+14, 28, floorH-22); g.endFill();
            g.beginFill(0x0f172a); g.drawRect(rx+3, y+18, 22, floorH-30); g.endFill();
            // Drive bays
            for(var dy=y+22; dy<y+floorH-14; dy+=7) {
                g.beginFill(0x334155); g.drawRect(rx+5, dy, 18, 5); g.endFill();
                // Status LEDs
                g.beginFill(Math.random()>0.3 ? 0x4ade80 : 0xef4444); g.drawCircle(rx+8, dy+2, 1); g.endFill();
                g.beginFill(0x06b6d4, 0.6); g.drawCircle(rx+12, dy+2, 1); g.endFill();
            }
        }
        // Central data core column
        var coreX = x + w/2;
        g.beginFill(0x0f172a); g.drawRect(coreX-12, y+10, 24, floorH-18); g.endFill();
        g.beginFill(col || 0x06b6d4, 0.4); g.drawRect(coreX-8, y+14, 16, floorH-26); g.endFill();
        // Pulsing core glow
        var glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(col || 0x06b6d4, 0.06); glow.drawRect(coreX-30, y+10, 60, floorH-18); glow.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.1, type: 'screen' });
        // SILO label
        var siloTxt = new PIXI.Text('SECURE SILO', { fontFamily: 'Silkscreen', fontSize: 7, fill: 0xef4444, letterSpacing: 2 });
        siloTxt.anchor.set(0.5, 0); siloTxt.x = x + w/2; siloTxt.y = y + 4;
        c.addChild(siloTxt);
    }
};

class ResElevator {
    constructor(layer, numFloors, floorHeight, shaftX, minFloor) {
        this.layer = layer;
        this.numFloors = numFloors;
        this.floorHeight = floorHeight;
        this.x = shaftX;
        this.minFloor = (minFloor !== undefined) ? minFloor : -1;
        this.destroyed = false;

        this.state = 'idle'; 
        this.currentFloor = 0;
        this.targetFloor = 0;
        this.timer = 0;
        this.doorWidth = 24;
        this.speed = 2.5;
        
        this.callQueue = [];
        this.doors = [];
        
        const totalFloors = numFloors - this.minFloor;
        const shaftHeight = (numFloors - 1 - this.minFloor) * this.floorHeight;
        
        this.shaft = new PIXI.Graphics();
        this.shaft.beginFill(0x1a1a24);
        this.shaft.drawRect(
            this.x - this.doorWidth, 
            -((this.numFloors - 1) * this.floorHeight), 
            this.doorWidth * 2, 
            shaftHeight
        );
        this.shaft.endFill();
        this.layer.addChild(this.shaft);

        this.car = new PIXI.Graphics();
        this.car.beginFill(0x3a3a4c);
        this.car.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth * 2, this.floorHeight - 5);
        this.car.endFill();
        this.car.x = this.x;
        this.car.y = 0;
        this.layer.addChild(this.car);

        for(let i = this.minFloor; i < numFloors; i++) {
            let fy = -i * this.floorHeight;
            
            let leftDoor = new PIXI.Graphics();
            let rightDoor = new PIXI.Graphics();
            this.drawDoor(leftDoor, true);
            this.drawDoor(rightDoor, false);
            leftDoor.x = this.x; leftDoor.y = fy;
            rightDoor.x = this.x; rightDoor.y = fy;
            
            this.layer.addChild(leftDoor, rightDoor);
            
            let lightContainer = new PIXI.Container();
            lightContainer.x = this.x; 
            lightContainer.y = fy - this.floorHeight + 12;
            
            let floorLights = [];
            for(let j = this.minFloor; j < numFloors; j++) {
                let l = new PIXI.Graphics();
                l.beginFill(0x222222); 
                const maxW = 36;
                const spacing = Math.min(6, maxW / totalFloors);
                const lightIdx = j - this.minFloor;
                l.drawCircle((lightIdx - totalFloors/2) * spacing + (spacing/2), 0, Math.min(1.5, spacing/3)); 
                l.endFill();
                floorLights.push(l);
                lightContainer.addChild(l);
            }
            this.layer.addChild(lightContainer);

            this.doors.push({ 
                left: leftDoor, 
                right: rightDoor, 
                openAmt: 0, 
                lights: floorLights,
                floorNum: i
            });
        }
    }

    drawDoor(gfx, isLeft) {
        gfx.clear();
        gfx.beginFill(0x4a4a5a);
        gfx.lineStyle(1, 0x2a2a3a);
        if (isLeft) {
            gfx.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        } else {
            gfx.drawRect(0, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        }
        gfx.endFill();
    }

    call(floor) {
        if (!this.callQueue.includes(floor) && (this.currentFloor !== floor || this.state !== 'open')) {
            this.callQueue.push(floor);
        }
    }

    update() {
        if (this.destroyed || !this.car || this.car.destroyed) { this.destroyed = true; return; }
        let currentPassingFloor = -Math.round(this.car.y / this.floorHeight);
        const totalFloors = this.numFloors - this.minFloor;
        const maxW = 36; 
        const spacing = Math.min(6, maxW / totalFloors);

        this.doors.forEach((doorObj) => {
            doorObj.lights.forEach((light, lightIdx) => {
                const representedFloor = lightIdx + this.minFloor; 
                light.clear();
                if (representedFloor === currentPassingFloor) {
                    light.beginFill(0x4ade80); 
                } else {
                    light.beginFill(0x222222); 
                }
                light.drawCircle((lightIdx - totalFloors/2) * spacing + (spacing/2), 0, Math.min(1.5, spacing/3));
                light.endFill();
            });
        });

        if (this.state === 'idle') {
            if (this.callQueue.length > 0) {
                this.targetFloor = this.callQueue.shift();
                if (this.targetFloor === this.currentFloor) {
                    this.state = 'opening';
                } else {
                    this.state = 'moving';
                }
            }
        } 
        else if (this.state === 'moving') {
            let targetY = -this.targetFloor * this.floorHeight;
            let dir = Math.sign(targetY - this.car.y);
            this.car.y += dir * this.speed;
            
            if (Math.abs(this.car.y - targetY) <= this.speed) {
                this.car.y = targetY;
                this.currentFloor = this.targetFloor;
                this.state = 'opening';
            }
        } 
        else if (this.state === 'opening') {
            let door = this.doors[this.currentFloor - this.minFloor];
            if (!door) { this.state = 'idle'; return; }
            door.openAmt += 0.05;
            if (door.openAmt >= 1) {
                door.openAmt = 1;
                this.state = 'open';
                this.timer = 90; 
            }
            this.updateDoorVisuals(door);
        } 
        else if (this.state === 'open') {
            this.timer--;
            if (this.timer <= 0) {
                this.state = 'closing';
            }
        } 
        else if (this.state === 'closing') {
            let door = this.doors[this.currentFloor - this.minFloor];
            if (!door) { this.state = 'idle'; return; }
            door.openAmt -= 0.05;
            if (door.openAmt <= 0) {
                door.openAmt = 0;
                this.state = 'idle';
            }
            this.updateDoorVisuals(door);
        }
    }

    updateDoorVisuals(door) {
        door.left.x = this.x - (door.openAmt * this.doorWidth * 0.9);
        door.right.x = this.x + (door.openAmt * this.doorWidth * 0.9);
    }

    destroy() {
        this.destroyed = true;
        if (this.shaft && !this.shaft.destroyed) this.shaft.destroy();
        if (this.car && !this.car.destroyed) this.car.destroy();
        this.doors.forEach(d => {
            if (d.left && !d.left.destroyed) d.left.destroy();
            if (d.right && !d.right.destroyed) d.right.destroy();
            d.lights.forEach(l => { if (l && !l.destroyed) l.destroy(); });
        });
    }
}
