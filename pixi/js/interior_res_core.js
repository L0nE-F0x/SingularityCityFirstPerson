/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR RESIDENTIAL CORE (v15.2.0 - Billionaire's Row Estates Update)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorRes = {
    ...InteriorResProps,
    ...InteriorResAI,
    
    layer: null,
    scene: null,
    skyContainer: null,
    celestialGfx: null,
    starsLayer: null,
    bld: null,
    indoorLights: [],
    
    avatars: [],
    bubbles: [],
    floors: {},
    elevators: [],
    
    bldW: 0,
    startX: 0,
    usableW: 0,
    
    isDragging: false,
    startY: 0,
    startSceneY: 0,
    minY: 0,
    maxY: 0,
    totalH: 0,

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.layer.removeChildren();
        this.avatars = [];
        this.bubbles = [];
        this.floors = {};
        this.elevators = [];
        this.indoorLights = [];
        this.ceoCarGfx = null;
        
        const isEstate = bld.id.startsWith('house_');
        const resRegion = bld.id.split('_')[1] || 'eu';
        const lab = LABS[bld.lab] || LABS.other || { color: '#64748b' };
        const colHex = parseInt(lab.color.slice(1), 16); 
        
        // Determine estate style for prop variety
        let estateStyle = 'modern';
        if (isEstate) {
            const labRegion = (lab.region) ? lab.region : 'eu';
            if (bld.lab === 'xai') estateStyle = 'brutalist';
            else if (bld.lab === 'openai' || bld.lab === 'anthropic') estateStyle = 'penthouse';
            else if (bld.lab === 'google' || bld.lab === 'meta') estateStyle = 'villa';
            else if (bld.lab === 'microsoft' || bld.lab === 'amazon' || bld.lab === 'apple' || bld.lab === 'nvidia' || bld.lab === 'ibm') estateStyle = 'colonial';
            else if (labRegion === 'eu') estateStyle = 'chateau';
            else if (labRegion === 'cn') estateStyle = 'pagoda';
        } 
        
        this.skyContainer = new PIXI.Container();
        this.layer.addChild(this.skyContainer);
        
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 100; i++) { 
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff); 
            s.drawCircle(0, 0, .5 + Math.random() * 1.5); 
            s.endFill(); 
            s.x = Math.random() * G.vpW; 
            s.y = Math.random() * G.vpH * .5; 
            s._phase = Math.random() * Math.PI * 2; 
            this.starsLayer.addChild(s); 
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        
        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);
        
        const activeModels = G.models.filter(m => (!m.ret || new Date(m.ret) > new Date()) && ((LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region === resRegion : resRegion === 'eu'));
        
        const requiredAptFloors = Math.ceil(activeModels.length / 4);
        const numFloors = isEstate ? (bld.fl || 2) : Math.max(2, 1 + requiredAptFloors); 
        const minFloor = isEstate ? -2 : -1;

        const floorH = 80; 
        const roofH = 80; 
        this.totalH = roofH + (numFloors - minFloor) * floorH; 
        
        // ─── BELOW THE DEEPEST FLOOR — matches what the exterior shows.
        //     Estates: brown bedrock + rock veins (the same earth that flanks each
        //     silo shaft in the city view; the silo itself is the f=-2 floor).
        //     Regular residentials: standard city stack (cables/metro/pipes). ───
        const ugGfx = new PIXI.Graphics();
        const ugTopY = this.totalH;
        const earthH = 2000;
        if (typeof Underground !== 'undefined') {
            if (isEstate) {
                Underground.drawDeepEarth(ugGfx, 0, ugTopY, G.vpW, earthH, 'tech', (bld.x | 0));
            } else {
                const cityDepth = Underground.depthOf('city');
                Underground.drawBasementStack(ugGfx, 0, ugTopY, G.vpW, cityDepth, 'city', (bld.x | 0));
                Underground.drawDeepEarth(ugGfx, 0, ugTopY + cityDepth, G.vpW, earthH - cityDepth, 'tech', (bld.x | 0));
            }
        } else {
            ugGfx.beginFill(0x05050a); ugGfx.drawRect(0, ugTopY, G.vpW, earthH); ugGfx.endFill();
        }
        ugGfx.beginFill(0x05050a); ugGfx.drawRect(0, ugTopY + earthH, G.vpW, 800); ugGfx.endFill();
        this.scene.addChild(ugGfx);

        this.bldW = isEstate ? Math.min(G.vpW, 800) : G.vpW; 
        this.startX = isEstate ? (G.vpW - this.bldW) / 2 : 0;
        
        const shaftW = 60;
        const shaftX = this.startX + this.bldW - shaftW - 20;
        this.usableW = this.bldW - shaftW - 20;
        
        const windowX = this.startX + 60; 
        const windowW = this.usableW - 120;

        const bldBg = new PIXI.Graphics();
        bldBg.beginFill(isEstate ? 0x151520 : 0x1e1e2f);
        bldBg.drawRect(this.startX, roofH - 4, this.bldW, 4);
        bldBg.endFill();
        
        for (let f = minFloor; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            
            if (f === -1) {
                bldBg.beginFill(0x0a0a10);
                bldBg.drawRect(0, fy, G.vpW, floorH);
                bldBg.endFill();
                bldBg.beginFill(0x121220);
                bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                bldBg.endFill();
            } else if (f === -2) {
                bldBg.beginFill(0x050508);
                bldBg.drawRect(0, fy, G.vpW, floorH);
                bldBg.endFill();
                bldBg.beginFill(0x0a0a10);
                bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                bldBg.endFill();
            } else {
                this.drawNegativeSpaceWall(bldBg, isEstate ? 0x151520 : 0x1e1e2f, this.startX, fy, this.bldW, floorH, false, windowX, windowW, isEstate ? 'estate' : 'residential');
            }
        }
        this.scene.addChild(bldBg);
        
        const groundLine = new PIXI.Graphics();
        groundLine.beginFill(0x11111a);
        groundLine.drawRect(0, this.totalH - floorH, G.vpW, 4);
        groundLine.endFill();
        this.scene.addChild(groundLine);

        this.drawRoof(roofH, this.startX, this.usableW, colHex, lab, bld);
        
        for (let f = minFloor; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH; 
            const isBasement = f === -1;
            const isSilo = f === -2;
            
            this.floors[f] = { y: fy + floorH - 4, elevatorX: shaftX + 15, breakSpots: [] };
            
            const roomGfx = new PIXI.Graphics();
            if (isSilo) {
                // Silo floor has no room interior — drawSiloInterior handles everything
            } else if (isBasement) {
                this.drawBasementInterior(roomGfx, this.startX, fy, this.bldW, floorH);
            } else {
                this.drawRoomInterior(roomGfx, this.startX, fy, this.usableW, floorH, colHex, false, windowX, windowW, isEstate ? 'estate' : 'residential');
            }
            this.scene.addChild(roomGfx);
            
            const floorLine = new PIXI.Graphics();
            floorLine.beginFill(isSilo ? 0x0a0a0f : (isEstate ? 0x151520 : 0x1e1e2f)); 
            floorLine.drawRect(this.startX, fy + floorH - 4, this.bldW, 4); 
            floorLine.endFill();
            this.scene.addChild(floorLine);
            
            if (isBasement) {
                const door = new PIXI.Graphics();
                door.beginFill(0x33334a); 
                door.lineStyle(1, 0x1e1e32);
                door.drawRect(shaftX + 15, fy + floorH - 44, 30, 40);
                door.moveTo(shaftX + 30, fy + floorH - 44); 
                door.lineTo(shaftX + 30, fy + floorH - 4); 
                door.endFill();
                door.beginFill(0x1e1e32); 
                door.drawRect(shaftX + 5, fy + floorH - 25, 4, 8);
                if (Math.random() > 0.5) { 
                    door.beginFill(0x4ade80); 
                    door.drawCircle(shaftX + 7, fy + floorH - 23, 1); 
                }
                door.endFill();
                this.scene.addChild(door);
            }
            
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;
            this.scene.addChild(floorCont);
            
            if (f >= 0) {
                const winFrame = new PIXI.Graphics();
                winFrame.beginFill(0xffffff, 0.03); 
                winFrame.lineStyle(4, 0x33334a); 
                if (isEstate) {
                    winFrame.drawRect(windowX, fy + 15, windowW, floorH - 35);
                } else {
                    let currX = windowX;
                    while (currX + 40 <= windowX + windowW) {
                        winFrame.drawRect(currX, fy + 25, 40, 30);
                        currX += 60;
                    }
                }
                winFrame.lineStyle(0); 
                winFrame.endFill();
                floorCont.addChild(winFrame);
            }
            
            // ─── SILO FLOOR (f === -2) — only for estates ───
            if (isSilo && isEstate) {
                this.drawSiloInterior(floorCont, this.startX + 10, fy, this.bldW - 70, floorH, colHex);
                
                // Biometric scanner near elevator
                const scanGfx = new PIXI.Graphics();
                scanGfx.beginFill(0x1e293b); scanGfx.drawRect(shaftX - 10, fy + floorH - 40, 20, 36); scanGfx.endFill();
                scanGfx.beginFill(0x0f172a); scanGfx.drawRect(shaftX - 6, fy + floorH - 36, 12, 18); scanGfx.endFill();
                scanGfx.beginFill(0xef4444, 0.5); scanGfx.drawCircle(shaftX, fy + floorH - 22, 3); scanGfx.endFill();
                floorCont.addChild(scanGfx);
            }
            // ─── BASEMENT FLOOR (f === -1) ───
            else if (isBasement) {
                const cables = new PIXI.Graphics();
                cables.lineStyle(3, 0x222233);
                cables.moveTo(this.startX, fy + 6); 
                cables.lineTo(this.startX + this.usableW, fy + 6);
                cables.lineStyle(2, colHex || 0x0ea5e9, 0.6);
                cables.moveTo(this.startX, fy + 12); 
                cables.lineTo(this.startX + this.usableW, fy + 12);
                floorCont.addChild(cables);

                if (isEstate) {
                    const parkingLines = new PIXI.Graphics();
                    parkingLines.lineStyle(2, 0xffffff, 0.4);
                    parkingLines.moveTo(this.startX + 150, fy + floorH - 4); 
                    parkingLines.lineTo(this.startX + 120, fy + floorH - 14);
                    parkingLines.moveTo(this.startX + 250, fy + floorH - 4); 
                    parkingLines.lineTo(this.startX + 220, fy + floorH - 14);
                    floorCont.addChild(parkingLines);
                    
                    if (G.ceoRefs && G.ceoRefs[bld.lab]) {
                        const ceoRef = G.ceoRefs[bld.lab];
                        this.ceoCarGfx = new PIXI.Graphics();
                        this.ceoCarGfx.beginFill(colHex); this.ceoCarGfx.drawRoundedRect(-22, -18, 44, 18, 4); this.ceoCarGfx.endFill();
                        this.ceoCarGfx.beginFill(colHex, 0.8); this.ceoCarGfx.drawRoundedRect(-12, -28, 24, 12, 4); this.ceoCarGfx.endFill();
                        this.ceoCarGfx.beginFill(0x333333); this.ceoCarGfx.drawCircle(-12, -1, 4); this.ceoCarGfx.drawCircle(12, -1, 4); this.ceoCarGfx.endFill();
                        this.ceoCarGfx.beginFill(0xffffff, 1.0); this.ceoCarGfx.drawRect(20, -8, 4, 6); this.ceoCarGfx.endFill();
                        this.ceoCarGfx.beginFill(0xff3333, 1.0); this.ceoCarGfx.drawRect(-26, -10, 4, 4); this.ceoCarGfx.endFill();
                        
                        this.ceoCarGfx.x = this.startX + 180;
                        this.ceoCarGfx.y = fy + floorH - 4;
                        floorCont.addChild(this.ceoCarGfx);
                        this.ceoCarGfx.visible = (ceoRef.bld === bld.id);
                    }
                } else {
                    let currX = this.startX + 80;
                    while (currX < this.startX + this.usableW - 100) {
                        if (Math.random() > 0.4) {
                            this.drawServerRack(floorCont, currX, fy + floorH - 4, colHex || 0x0ea5e9);
                        } else {
                            this.drawLiquidCooledServer(floorCont, currX, fy + floorH - 4);
                        }
                        currX += 50 + Math.random() * 30;
                    }
                }
            } 
            // ─── ESTATE LIVING & OFFICE FLOORS (CEO personality-themed) ───
            else if (isEstate) {
                const sy = fy + floorH - 4; // standing Y
                const sx = this.startX;     // left edge
                const lab_id = bld.lab;

                if (f === 0) {
                    // ─── GROUND FLOOR — uniquely themed per CEO ───
                    if (lab_id === 'xai') {
                        // Elon Musk — Industrial tech baron: MMA octagon, rocket model, trophy case, gaming
                        this.drawMMAOctagon(floorCont, sx + 140, sy);
                        this.drawRocketModel(floorCont, sx + 260, sy);
                        this.drawTrophyCase(floorCont, sx + 340, sy, colHex);
                        this.drawArcadeCabinet(floorCont, sx + 440, sy);
                        this.drawLivingArea(floorCont, sx + 550, sy, 2);
                    } else if (lab_id === 'openai') {
                        // Sam Altman — Silicon Valley minimalist: grand piano, meditation, indoor garden, whiteboard
                        this.drawGrandPiano(floorCont, sx + 100, sy);
                        this.drawMeditationCorner(floorCont, sx + 220, sy);
                        this.drawIndoorGarden(floorCont, sx + 340, sy);
                        this.drawWhiteboard(floorCont, sx + 460, sy);
                        this.drawLivingArea(floorCont, sx + 580, sy, 2);
                    } else if (lab_id === 'anthropic') {
                        // Dario Amodei — Academic retreat: massive bookshelf, chess area, telescope, plants
                        this.drawBookshelfWall(floorCont, sx + 120, sy, 90);
                        this.drawPoolTable(floorCont, sx + 270, sy);
                        this.drawTelescope(floorCont, sx + 380, sy);
                        this.drawPottedPlant(floorCont, sx + 440, sy, 2);
                        this.drawLivingArea(floorCont, sx + 550, sy, 2);
                        this.drawPottedPlant(floorCont, sx + 630, sy, 1);
                    } else if (lab_id === 'google') {
                        // Sundar Pichai — Family modern: cricket bat, kitchen, plants, meditation
                        this.drawCricketBat(floorCont, sx + 80, sy);
                        this.drawKitchen(floorCont, sx + 180, sy, 'us', 2);
                        this.drawLivingArea(floorCont, sx + 310, sy, 2);
                        this.drawMeditationCorner(floorCont, sx + 440, sy);
                        this.drawPottedPlant(floorCont, sx + 520, sy, 1);
                        this.drawBookshelfWall(floorCont, sx + 600, sy, 60);
                    } else if (lab_id === 'meta') {
                        // Mark Zuckerberg — Island warrior: MMA octagon, surfboard, VR display, tiki bar
                        this.drawMMAOctagon(floorCont, sx + 140, sy);
                        this.drawSurfboard(floorCont, sx + 260, sy);
                        this.drawVRHeadsetDisplay(floorCont, sx + 330, sy);
                        this.drawHomeBar(floorCont, sx + 450, sy);
                        this.drawLivingArea(floorCont, sx + 580, sy, 3);
                    } else if (lab_id === 'microsoft') {
                        // Satya Nadella — Thoughtful leader: library wall, cricket, meditation, art
                        this.drawBookshelfWall(floorCont, sx + 110, sy, 100);
                        this.drawCricketBat(floorCont, sx + 230, sy);
                        this.drawMeditationCorner(floorCont, sx + 330, sy);
                        this.drawLivingArea(floorCont, sx + 470, sy, 2);
                        this.drawPottedPlant(floorCont, sx + 580, sy, 2);
                        this.drawFireplace(floorCont, sx + 630, sy);
                    } else if (lab_id === 'nvidia') {
                        // Jensen Huang — Leather jacket legend: jacket display, cooking station, GPU showcase, karaoke
                        this.drawLeatherJacketDisplay(floorCont, sx + 100, sy, colHex);
                        this.drawCookingStation(floorCont, sx + 220, sy);
                        this.drawGPUShowcase(floorCont, sx + 360, sy, colHex);
                        this.drawHomeBar(floorCont, sx + 480, sy);
                        this.drawLivingArea(floorCont, sx + 600, sy, 2);
                    } else if (lab_id === 'amazon') {
                        // Jeff Bezos — Space cowboy: telescope, rocket model, gym, pool table
                        this.drawTelescope(floorCont, sx + 100, sy);
                        this.drawRocketModel(floorCont, sx + 200, sy);
                        this.drawGymCorner(floorCont, sx + 320, sy);
                        this.drawPoolTable(floorCont, sx + 480, sy);
                        this.drawLivingArea(floorCont, sx + 600, sy, 1);
                    } else if (lab_id === 'apple') {
                        // Tim Cook — Zen minimalist: meditation, standing desk, gym, indoor garden
                        this.drawMeditationCorner(floorCont, sx + 120, sy);
                        this.drawGymCorner(floorCont, sx + 280, sy);
                        this.drawIndoorGarden(floorCont, sx + 440, sy);
                        this.drawLivingArea(floorCont, sx + 580, sy, 2);
                    } else if (lab_id === 'ibm') {
                        // IBM — Corporate classic: fireplace, bookshelf, pool table, bar
                        this.drawFireplace(floorCont, sx + 120, sy);
                        this.drawBookshelfWall(floorCont, sx + 260, sy, 80);
                        this.drawPoolTable(floorCont, sx + 420, sy);
                        this.drawHomeBar(floorCont, sx + 570, sy);
                    } else if (estateStyle === 'chateau') {
                        // European founders: wine, piano, fireplace, garden
                        this.drawGrandPiano(floorCont, sx + 110, sy);
                        this.drawFireplace(floorCont, sx + 260, sy);
                        this.drawWineRack(floorCont, sx + 380, sy);
                        this.drawLivingArea(floorCont, sx + 500, sy, 2);
                        this.drawPottedPlant(floorCont, sx + 600, sy, 2);
                    } else if (estateStyle === 'pagoda') {
                        // Chinese founders: bonsai, scroll art, kitchen, meditation
                        this.drawBonsaiTree(floorCont, sx + 100, sy);
                        this.drawScrollArt(floorCont, sx + 180, sy);
                        this.drawKitchen(floorCont, sx + 300, sy, 'cn', 2);
                        this.drawMeditationCorner(floorCont, sx + 440, sy);
                        this.drawLivingArea(floorCont, sx + 570, sy, 2);
                    } else {
                        // Generic modern estate
                        this.drawLivingArea(floorCont, sx + 130, sy, 2);
                        this.drawKitchen(floorCont, sx + 300, sy, 'eu', 2);
                        this.drawArcadeCabinet(floorCont, sx + 440, sy);
                        this.drawPottedPlant(floorCont, sx + 540, sy, 1);
                    }
                } else if (f === 1) {
                    // ─── UPPER FLOOR — bedroom + office + personality accent ───
                    this.drawLuxuryBed(floorCont, sx + 160, sy, colHex);
                    this.drawNightstand(floorCont, sx + 120, sy, 2);

                    if (lab_id === 'xai') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawTrophyCase(floorCont, sx + 460, sy, colHex);
                        this.drawRocketModel(floorCont, sx + 560, sy);
                    } else if (lab_id === 'openai') {
                        this.drawStandingDesk(floorCont, sx + 320, sy, colHex);
                        this.drawWhiteboard(floorCont, sx + 460, sy);
                        this.drawWineRack(floorCont, sx + 580, sy);
                    } else if (lab_id === 'anthropic') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawBookshelfWall(floorCont, sx + 480, sy, 70);
                        this.drawPottedPlant(floorCont, sx + 580, sy, 2);
                        this.drawPottedPlant(floorCont, sx + 620, sy, 1);
                    } else if (lab_id === 'google') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawBookshelfWall(floorCont, sx + 480, sy, 60);
                        this.drawPottedPlant(floorCont, sx + 580, sy, 1);
                    } else if (lab_id === 'meta') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawVRHeadsetDisplay(floorCont, sx + 460, sy);
                        this.drawSurfboard(floorCont, sx + 560, sy);
                    } else if (lab_id === 'microsoft') {
                        this.drawStandingDesk(floorCont, sx + 320, sy, colHex);
                        this.drawBookshelfWall(floorCont, sx + 470, sy, 70);
                        this.drawPottedPlant(floorCont, sx + 580, sy, 2);
                    } else if (lab_id === 'nvidia') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawLeatherJacketDisplay(floorCont, sx + 470, sy, colHex);
                        this.drawGPUShowcase(floorCont, sx + 580, sy, colHex);
                    } else if (lab_id === 'amazon') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawTelescope(floorCont, sx + 470, sy);
                        this.drawTrophyCase(floorCont, sx + 580, sy, colHex);
                    } else if (lab_id === 'apple') {
                        this.drawStandingDesk(floorCont, sx + 320, sy, colHex);
                        this.drawMeditationCorner(floorCont, sx + 470, sy);
                        this.drawIndoorGarden(floorCont, sx + 580, sy);
                    } else if (lab_id === 'ibm') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawFireplace(floorCont, sx + 480, sy);
                        this.drawBookshelfWall(floorCont, sx + 600, sy, 50);
                    } else if (estateStyle === 'chateau') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawWineRack(floorCont, sx + 480, sy);
                        this.drawFireplace(floorCont, sx + 580, sy);
                    } else if (estateStyle === 'pagoda') {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawBonsaiTree(floorCont, sx + 480, sy);
                        this.drawScrollArt(floorCont, sx + 560, sy);
                    } else {
                        this.drawBossDesk(floorCont, sx + 320, sy, colHex);
                        this.drawChair(floorCont, sx + 285, sy);
                        this.drawGeckoTerrarium(floorCont, sx + 480, sy);
                        this.drawPottedPlant(floorCont, sx + 560, sy, 1);
                    }
                }

                if (f === 1 && G.ceoRefs && G.ceoRefs[bld.lab]) {
                    const ceoRef = G.ceoRefs[bld.lab];
                    if (ceoRef.bld === bld.id) {
                        const ceoModel = { id: 'ceo_'+bld.lab, name: ceoRef.f.name, lab: bld.lab, phase: 'released', isCeo: true, founderData: ceoRef.f };
                        
                        let startState = 'ceo_working';
                        let spawnX = this.startX + 305;
                        let spawnY = this.floors[1] ? this.floors[1].y : fy + floorH - 4;
                        let floorI = 1;

                        if (ceoRef.wantsToEnter) {
                            startState = 'ceo_entering';
                            spawnX = this.startX + 180;
                            spawnY = this.totalH - 80 - 4;
                            floorI = -1;
                        } else if (ceoRef.wantsToLeave) {
                            startState = 'ceo_leaving';
                            spawnX = this.startX + 305;
                            spawnY = this.floors[1] ? this.floors[1].y : fy + floorH - 4;
                            floorI = 1;
                        }

                        let av = this.drawAvatar(ceoModel, spawnX, spawnY, floorCont, floorI, false, true);
                        av.cont.zIndex = 100;
                        av.state = startState;
                        av.deskX = this.startX + 305;
                        av.bedX = this.startX + 160;
                        av.bedY = this.floors[1] ? this.floors[1].y - 12 : fy + floorH - 16;
                        av.targetX = shaftX + 15;
                    }
                }
            } 
            else if (f === 0) {
                this.drawCouches(floorCont, this.startX + 120, fy + floorH - 4, colHex);
                this.drawPottedPlant(floorCont, this.startX + 180, fy + floorH - 4, 1);
                this.drawWaterCooler(floorCont, this.startX + 220, fy + floorH - 4);
                this.drawReceptionDesk(floorCont, this.startX + 300, fy + floorH - 4, colHex);
                // Receptionist NPC sits at the front desk so a tracked
                // resident has a recognisable face to walk past on entry.
                const _dpRes = G.getDayPhase();
                const _isNightRes = _dpRes > 0.83 || _dpRes < 0.25;
                if (!_isNightRes) {
                    this.drawAvatar({
                        id: 'res_rec_' + bld.id, name: 'Concierge', isNPC: true,
                        role: 'Concierge', phase: 'released', lab: bld.lab || 'other',
                        desc: 'Greeting residents and signing for packages.'
                    }, this.startX + 285, fy + floorH - 4, floorCont, f, true);
                }
                
                G.models.forEach((m) => {
                    const refs = G.charRefs[m.id];
                    if (refs && refs.bld === bld.id) {
                        if (!activeModels.find(am => am.id === m.id)) {
                            const rx = this.startX + 80 + Math.random() * (this.usableW - 160);
                            let av = this.drawAvatar(m, rx, fy + floorH - 4, floorCont, f, false);
                            av.cont.zIndex = 100;
                            av.jobTheme = 'residential'; 
                            av.deskX = rx; 
                            av.floorY = fy + floorH - 4; 
                            
                            if (refs.wantsToEnter) { 
                                av.state = 'entering_lobby'; 
                                av.cont.x = this.startX + this.usableW / 2; 
                                av.cont.y = this.totalH - 80 - 4; 
                            } else if (refs.wantsToLeave) { 
                                av.state = 'walking_out'; 
                                av.targetX = this.startX + this.usableW / 2; 
                            } else {
                                av.state = 'working';
                            }
                        }
                    }
                });
            } else {
                const aptFloorIdx = f - 1;
                const startIndex = aptFloorIdx * 4;
                const floorModelsQueue = activeModels.slice(startIndex, startIndex + 4);
                
                const totalAptAreaW = this.usableW - 60; 
                const aptWidth = totalAptAreaW / 4; 
                
                floorModelsQueue.forEach((m, idx) => {
                    const aptStartX = this.startX + 60 + (idx * aptWidth);
                    
                    if (idx > 0) {
                        const wall = new PIXI.Graphics();
                        wall.beginFill(0x121220); 
                        wall.drawRect(aptStartX - 2, fy + 20, 4, floorH - 20);
                        wall.endFill();
                        floorCont.addChild(wall);
                    }

                    const bathW = Math.min(60, aptWidth * 0.2); 
                    const bedW = Math.min(130, aptWidth * 0.35); 
                    const livingW = aptWidth - bathW - bedW;

                    const bathWall = new PIXI.Graphics();
                    bathWall.beginFill(0x2a2a42, 0.6); 
                    bathWall.drawRect(aptStartX + bathW, fy + 35, 2, floorH - 35);
                    bathWall.endFill();
                    floorCont.addChild(bathWall);

                    const bedWall = new PIXI.Graphics();
                    bedWall.beginFill(0x2a2a42, 0.6);
                    bedWall.drawRect(aptStartX + bathW + livingW, fy + 35, 2, floorH - 35);
                    bedWall.endFill();
                    floorCont.addChild(bedWall);
                    
                    const showerStyle = Math.floor(Math.random() * 4) + 1;
                    const kitchenStyle = Math.floor(Math.random() * 4) + 1;
                    const bedStyle = Math.floor(Math.random() * 4) + 1;
                    const livingStyle = Math.floor(Math.random() * 4) + 1;
                    const plantStyle = Math.floor(Math.random() * 4) + 1;
                    const nightstandStyle = Math.floor(Math.random() * 4) + 1;

                    const showerX = aptStartX + (bathW / 2);
                    const plantX = aptStartX + bathW + 15;
                    const kitchenX = aptStartX + bathW + (livingW * 0.35);
                    const livingX = aptStartX + bathW + (livingW * 0.75);
                    const nightstandX = aptStartX + aptWidth - bedW + 15;
                    const bedX = aptStartX + aptWidth - (bedW / 2) + 10;

                    this.drawShower(floorCont, showerX, fy + floorH - 4, showerStyle);
                    
                    if (Math.random() < 0.15) {
                        this.drawGeckoTerrarium(floorCont, plantX, fy + floorH - 4);
                    } else {
                        this.drawPottedPlant(floorCont, plantX, fy + floorH - 4, plantStyle);
                    }
                    
                    this.drawKitchen(floorCont, kitchenX, fy + floorH - 4, resRegion, kitchenStyle);
                    this.drawLivingArea(floorCont, livingX, fy + floorH - 4, livingStyle);
                    this.drawNightstand(floorCont, nightstandX, fy + floorH - 4, nightstandStyle);
                    this.drawBed(floorCont, bedX, fy + floorH - 4, resRegion, bedStyle);
                    
                    const refs = G.charRefs[m.id];
                    if (refs && refs.bld === bld.id) {
                        let av = this.drawAvatar(m, livingX - 10, fy + floorH - 4, floorCont, f, false);
                        av.cont.zIndex = 100;
                        av.jobTheme = 'residential';
                        av.region = resRegion;
                        av.deskX = livingX - 10; 
                        av.floorY = fy + floorH - 4;
                        
                        let bedYOffset = 16;
                        if (resRegion === 'cn') bedYOffset = 10;
                        if (resRegion === 'eu') bedYOffset = 12;
                        
                        av.bedX = bedX;
                        av.bedY = fy + floorH - 4 - bedYOffset;

                        if (refs.wantsToEnter) { 
                            av.state = 'entering_lobby'; 
                            av.cont.x = this.startX + this.usableW / 2; 
                            av.cont.y = this.totalH - 80 - 4; 
                        } else if (refs.wantsToLeave) { 
                            av.state = 'walking_to_elevator_down'; 
                            av.targetX = this.floors[f].elevatorX; 
                        } else {
                            av.state = 'working';
                        }
                    }
                });
            }
        }
        
        const elevatorContainer = new PIXI.Container();
        elevatorContainer.y = roofH + (numFloors - 1) * floorH + floorH;
        this.scene.addChild(elevatorContainer);
        this.initLift(elevatorContainer, bld.id, numFloors, floorH, shaftX + 15, minFloor);

        const bottomPadding = 56;
        const initY = G.vpH - bottomPadding - this.totalH + floorH;
        this.scene.y = initY; 
        // Allow scrolling down to see silo, up to see roof — generous range
        this.minY = Math.min(initY - floorH * 4, G.vpH - bottomPadding - this.totalH - floorH);
        this.maxY = Math.max(initY + floorH * 4, G.vpH - bottomPadding);

        this.layer.eventMode = 'static'; 
        this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this.onMove); 
        window.removeEventListener('pointerup', this.onUp);
        
        this.layer.on('pointerdown', (e) => { 
            this.isDragging = true; 
            this.startY = e.clientY; 
            this.startSceneY = this.scene.y; 
            this.layer.cursor = 'grabbing'; 
        });
        window.addEventListener('pointermove', this.onMove); 
        window.addEventListener('pointerup', this.onUp);
    },

    onMove: (e) => {
        if (!InteriorRes.isDragging || !InteriorRes.scene || InteriorRes.scene.destroyed) return;
        let newY = InteriorRes.startSceneY + (e.clientY - InteriorRes.startY);
        if (newY < InteriorRes.minY) newY = InteriorRes.minY;
        if (newY > InteriorRes.maxY) newY = InteriorRes.maxY;
        InteriorRes.scene.y = newY;
        // Silo Breach: scrolled down far enough to see the silo in an estate
        if (InteriorRes.bld && InteriorRes.bld.id.startsWith('house_') && InteriorRes.floors[-2] && newY <= InteriorRes.minY + 30) {
            if (typeof G !== 'undefined') G.unlockAchieve('silo_breach');
        }
    },
    
    onUp: () => { 
        InteriorRes.isDragging = false; 
        if (InteriorRes.layer) InteriorRes.layer.cursor = 'grab'; 
    },

    update() {
        if (!this.layer || !this.layer.visible) return;
        
        this.updateLifts();
        
        const dp = G.getDayPhase();
        const night = dp > .83 || dp < .25;
        const vp = document.getElementById('viewport'); 
        
        let sky;
        if (dp < .22) {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        } else if (dp < .30) { 
            const t = (dp - .22) / .08; 
            sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`; 
        } else if (dp < .72) {
            sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        } else if (dp < .84) { 
            const t = (dp - .72) / .12; 
            sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`; 
        } else {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        }
        
        if (typeof Environment !== 'undefined' && !night && dp > .3 && dp < .72) {
            const _ew = Environment.weather;
            if (_ew === 'rain' || _ew === 'drizzle')   sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
            else if (_ew === 'thunderstorm')           sky = 'linear-gradient(180deg,#1a1f2a,#2d3340 50%,#444a55)';
            else if (_ew === 'overcast')               sky = 'linear-gradient(180deg,#4a5568,#64748b 50%,#94a3b8)';
            else if (_ew === 'fog')                    sky = 'linear-gradient(180deg,#8a9099,#a8b1bb 50%,#c0c8d0)';
            else if (_ew === 'partly_cloudy')          sky = 'linear-gradient(180deg,#355088,#6a9abf 50%,#93b9d8)';
        }
        if (typeof Environment !== 'undefined' && Environment.weather === 'snow') {
            sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        }
        if (vp) vp.style.background = sky;

        if (this.celestialGfx) {
            this.celestialGfx.clear();
            if (night) { 
                let np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42; 
                this.celestialGfx.beginFill(0xe8e8d0); 
                this.celestialGfx.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); 
                this.celestialGfx.endFill(); 
            } else { 
                let dayP = (dp - 0.25) / (0.83 - 0.25); 
                this.celestialGfx.beginFill(0xffe066); 
                this.celestialGfx.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15); 
                this.celestialGfx.endFill(); 
            }
        }
        
        if (this.starsLayer) { 
            this.starsLayer.visible = night; 
            if (night) { 
                this.starsLayer.children.forEach(s => { 
                    s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; 
                }); 
            } 
        }

        if (this.indoorLights) {
            const isWorkingHours = dp >= 0.35 && dp <= 0.80;
            const nightMode = night || !isWorkingHours;
            
            this.indoorLights.forEach((l, idx) => {
                let targetAlpha = 0;
                
                if (l.type === 'ceiling') {
                    targetAlpha = nightMode ? l.maxA * 0.2 : l.maxA;
                } else if (l.type === 'server') {
                    targetAlpha = l.maxA * (0.6 + Math.random() * 0.4); 
                } else if (l.type === 'screen') {
                    const base = nightMode ? l.maxA : l.maxA * 0.3;
                    targetAlpha = base * (0.9 + Math.sin(G.tick * 0.05 + idx) * 0.1);
                }
                
                l.g.alpha += (targetAlpha - l.g.alpha) * 0.1;
            });
        }
        
        if (this.ceoCarGfx && G.ceoRefs && G.ceoRefs[this.bld.lab]) {
            this.ceoCarGfx.visible = (G.ceoRefs[this.bld.lab].bld === this.bld.id);
        }

        this.avatars.forEach((av, i) => {
            // Tracking highlight pulse
            if (av._trackGlow) {
                av._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15;
                if (av._trackArrow) av._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2;
            }

            const refs = G.charRefs[av.m.id];

            if ((av.state === 'walking_to_prop' || av.state === 'returning') && av.timer <= 0 && !av.m.isCeo) {
                let partner = this.avatars.find(other => 
                    other !== av && 
                    !other.m.isCeo &&
                    (other.state === 'walking_to_prop' || other.state === 'returning') && 
                    other.floorIdx === av.floorIdx && 
                    Math.abs(other.cont.x - av.cont.x) < 25 && 
                    other.timer <= 0
                );

                if (partner && Math.random() < 0.1) {
                    av.resumeState = av.state;
                    partner.resumeState = partner.state;
                    av.state = 'chatting';
                    partner.state = 'chatting';
                    
                    av.timer = 180 + Math.random() * 120;
                    partner.timer = av.timer; 
                    
                    av.cont.scale.x = Math.sign(partner.cont.x - av.cont.x) || 1;
                    partner.cont.scale.x = Math.sign(av.cont.x - partner.cont.x) || -1;

                    const topics = ["AGI timelines?", "Need more H100s.", "My loss curve...", "Open weights?", "Synthetic data is key.", "RLHF is tedious."];
                    this.spawnBubble(av, topics[Math.floor(Math.random() * topics.length)]);
                    
                    setTimeout(() => { 
                        if (!this.layer || !this.layer.visible || G.activeInterior !== this.bld.id) return;
                        if (partner.state === 'chatting') {
                            const replies = ["Agreed.", "Not scalable.", "Pfft, closed source.", "Compute is king.", "Data wall approaching."];
                            this.spawnBubble(partner, replies[Math.floor(Math.random() * replies.length)]);
                        }
                    }, 1500);
                }
            }

            switch (av.state) {
                case 'ceo_entering': {
                    this.animateWalk(av);
                    const dxEnter = this.floors[-1].elevatorX - av.cont.x;
                    if (Math.abs(dxEnter) < av.speed) {
                        av.cont.x = this.floors[-1].elevatorX;
                        av.state = 'ceo_calling_up';
                    } else {
                        av.cont.x += Math.sign(dxEnter) * av.speed;
                        av.cont.scale.x = Math.sign(dxEnter);
                    }
                    break;
                }
                case 'ceo_calling_up': {
                    const cLiftUp = this.getLift(this.bld.id);
                    if (cLiftUp) { cLiftUp.call(-1); av.state = 'ceo_waiting_up'; }
                    break;
                }
                case 'ceo_waiting_up': {
                    const wLiftUp = this.getLift(this.bld.id);
                    if (wLiftUp && wLiftUp.currentFloor === -1 && wLiftUp.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_up';
                    }
                    break;
                }
                case 'ceo_delay_up': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_up';
                    break;
                }
                case 'ceo_riding_up': {
                    const rLiftUp = this.getLift(this.bld.id);
                    if (rLiftUp) {
                        av.cont.visible = false;
                        const topFl = (this.bld.fl || 2) - 1;
                        rLiftUp.call(topFl);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftUp.car.y;
                        if (rLiftUp.currentFloor === topFl && rLiftUp.state === 'open') {
                            av.cont.y = this.floors[topFl].y;
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_desk'; 
                            av.floorIdx = topFl;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_desk': {
                    av.cont.rotation = 0;
                    this.animateWalk(av);
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) {
                        av.cont.x = av.deskX;
                        av.state = 'ceo_working';
                    } else {
                        av.cont.x += Math.sign(dx) * av.speed;
                        av.cont.scale.x = Math.sign(dx);
                    }
                    break;
                }
                case 'ceo_working': {
                    if (night && av.bedX) {
                        av.state = 'ceo_walking_to_bed';
                        av.targetX = av.bedX;
                    } else {
                        av.cont.rotation = 0;
                        av.cont.x = av.deskX; 
                        av.cont.y = av.floorY; 
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.1) * 1.5; 
                        av.body.y = -32 + 12 + 4;
                        if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                        if (Math.random() < 0.002 && this.bubbles.length < 5) {
                            this.spawnBubble(av, ["Reviewing the benchmarks.", "Check the stock price.", "We need more compute."][Math.floor(Math.random()*3)]);
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_bed': {
                    this.animateWalk(av);
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < av.speed) {
                        av.cont.x = av.targetX;
                        av.state = 'ceo_sleeping';
                    } else {
                        av.cont.x += Math.sign(dx) * av.speed;
                        av.cont.scale.x = Math.sign(dx);
                    }
                    break;
                }
                case 'ceo_sleeping': {
                    if (!night) {
                        // Wake up — restore avatar parts
                        if (av._sleepGfx) av._sleepGfx.visible = false;
                        if (av.head) av.head.visible = true;
                        if (av.body) av.body.visible = true;
                        if (av.legL) av.legL.visible = true;
                        if (av.legR) av.legR.visible = true;
                        if (av.dot) av.dot.visible = true;
                        if (av.shadow) av.shadow.visible = true;
                        if (av.ghostL) av.ghostL.visible = true;
                        if (av.ghostR) av.ghostR.visible = true;
                        av.state = 'ceo_walking_to_desk';
                        av.targetX = av.deskX;
                    } else {
                        av.cont.x = av.bedX;
                        av.cont.y = av.bedY + 12; // floor level (bedY = floorY - 12)
                        av.cont.rotation = 0;
                        av.cont.scale.x = 1;
                        if (av.head) av.head.visible = false;
                        if (av.body) av.body.visible = false;
                        if (av.legL) av.legL.visible = false;
                        if (av.legR) av.legR.visible = false;
                        if (av.dot) av.dot.visible = false;
                        if (av.shadow) av.shadow.visible = false;
                        if (av.ghostL) av.ghostL.visible = false;
                        if (av.ghostR) av.ghostR.visible = false;
                        if (!av._sleepGfx) {
                            const labData = (typeof LABS !== 'undefined' && LABS[av.m.lab]) || { color: '#a855f7' };
                            const col = parseInt(labData.color.replace('#', ''), 16);
                            const bt = -10;
                            const sg = new PIXI.Graphics();
                            sg.beginFill(0xddd8c8, 0.7); sg.drawRoundedRect(-21, bt - 9, 16, 8, 3); sg.endFill();
                            sg.beginFill(0xfdd8b5); sg.drawCircle(-13, bt - 6, 5); sg.endFill();
                            sg.beginFill(0x2c1810, 0.7); sg.drawEllipse(-13, bt - 11, 4, 2); sg.endFill();
                            sg.beginFill(0x2c1810, 0.5); sg.drawRect(-16, bt - 6, 2, 1); sg.drawRect(-11, bt - 6, 2, 1); sg.endFill();
                            sg.beginFill(0x2c1810, 0.2); sg.drawRect(-14, bt - 3, 3, 0.7); sg.endFill();
                            sg.beginFill(col, 0.5);
                            sg.moveTo(-6, bt + 2); sg.lineTo(-6, bt - 2);
                            sg.quadraticCurveTo(8, bt - 14, 24, bt - 1);
                            sg.lineTo(24, bt + 2); sg.closePath(); sg.endFill();
                            sg.beginFill(col, 0.25);
                            sg.moveTo(-5, bt + 1); sg.lineTo(-5, bt - 1);
                            sg.quadraticCurveTo(8, bt - 12, 23, bt);
                            sg.lineTo(23, bt + 1); sg.closePath(); sg.endFill();
                            const sc = new PIXI.Container();
                            sc.addChild(sg);
                            sc.eventMode = 'static'; sc.cursor = 'pointer';
                            sc.hitArea = new PIXI.Rectangle(-24, bt - 14, 52, 20);
                            sc.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(av.m); });
                            sc.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, av.m.name, 'CEO (sleeping)'); });
                            sc.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
                            const zc = new PIXI.Container(); zc.x = -6; zc.y = bt - 14;
                            const z1 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
                            z1.anchor.set(0.5); z1.alpha = 0.7;
                            const z2 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 9, fill: col, fontWeight: 'bold' });
                            z2.anchor.set(0.5); z2.x = 5; z2.y = -8; z2.alpha = 0.5;
                            const z3 = new PIXI.Text('Z', { fontFamily: 'JetBrains Mono', fontSize: 11, fill: col, fontWeight: 'bold' });
                            z3.anchor.set(0.5); z3.x = 10; z3.y = -18; z3.alpha = 0.3;
                            zc.addChild(z1, z2, z3);
                            sc.addChild(zc);
                            av._sleepGfx = sc; av._z1 = z1; av._z2 = z2; av._z3 = z3; av._zPhase = Math.random() * Math.PI * 2;
                            av.cont.addChild(sc);
                        }
                        av._sleepGfx.visible = true;
                        const zt = G.tick * 0.04 + av._zPhase;
                        av._z1.y = Math.sin(zt) * 3; av._z1.alpha = 0.5 + Math.sin(zt) * 0.3;
                        av._z2.y = -8 + Math.sin(zt + 1) * 3; av._z2.alpha = 0.3 + Math.sin(zt + 1) * 0.25;
                        av._z3.y = -18 + Math.sin(zt + 2) * 3; av._z3.alpha = 0.15 + Math.sin(zt + 2) * 0.2;
                    }
                    break;
                }
                case 'ceo_leaving': {
                    this.animateWalk(av);
                    const topFl = (this.bld.fl || 2) - 1;
                    const dxLeave = this.floors[topFl].elevatorX - av.cont.x;
                    if (Math.abs(dxLeave) < av.speed) {
                        av.cont.x = this.floors[topFl].elevatorX;
                        av.state = 'ceo_calling_down';
                    } else {
                        av.cont.x += Math.sign(dxLeave) * av.speed;
                        av.cont.scale.x = Math.sign(dxLeave);
                    }
                    break;
                }
                case 'ceo_calling_down': {
                    const topFl = (this.bld.fl || 2) - 1;
                    const cLiftDn = this.getLift(this.bld.id);
                    if (cLiftDn) { cLiftDn.call(topFl); av.state = 'ceo_waiting_down'; }
                    break;
                }
                case 'ceo_waiting_down': {
                    const topFl = (this.bld.fl || 2) - 1;
                    const wLiftDn = this.getLift(this.bld.id);
                    if (wLiftDn && wLiftDn.currentFloor === topFl && wLiftDn.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_down';
                    }
                    break;
                }
                case 'ceo_delay_down': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_down';
                    break;
                }
                case 'ceo_riding_down': {
                    const rLiftDn = this.getLift(this.bld.id);
                    if (rLiftDn) {
                        av.cont.visible = false;
                        rLiftDn.call(-1);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftDn.car.y; 
                        if (rLiftDn.currentFloor === -1 && rLiftDn.state === 'open') {
                            av.cont.y = this.totalH - 80 - 4; 
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_car';
                            av.floorIdx = -1;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_car': {
                    this.animateWalk(av);
                    const dxCar = (this.startX + 180) - av.cont.x;
                    if (Math.abs(dxCar) < av.speed) {
                        av.state = 'gone';
                        av.cont.visible = false;
                        const ceoRef = G.ceoRefs[av.m.lab];
                        if (ceoRef) {
                            ceoRef.bld = null;
                            ceoRef.wantsToLeave = false;
                        }
                    } else {
                        av.cont.x += Math.sign(dxCar) * av.speed;
                        av.cont.scale.x = Math.sign(dxCar);
                    }
                    break;
                }

                case 'entering_lobby': {
                    if (av.floorIdx === 0) {
                        this.animateWalk(av); 
                        const dx = av.deskX - av.cont.x;
                        if (Math.abs(dx) < av.speed) { 
                            av.cont.x = av.deskX; 
                            if (refs) refs.wantsToEnter = false; 
                            av.state = 'working'; 
                        } else { 
                            av.cont.x += Math.sign(dx) * av.speed; 
                            av.cont.scale.x = Math.sign(dx); 
                        }
                    } else {
                        av.targetX = this.floors[0].elevatorX; 
                        this.animateWalk(av); 
                        const dx = av.targetX - av.cont.x;
                        if (Math.abs(dx) < av.speed) { 
                            av.cont.x = av.targetX; 
                            av.state = 'calling_lift_up'; 
                        } else { 
                            av.cont.x += Math.sign(dx) * av.speed; 
                            av.cont.scale.x = Math.sign(dx); 
                        }
                    }
                    break;
                }
                case 'calling_lift_up': { 
                    const lift = this.getLift(this.bld.id); 
                    if (lift) { 
                        lift.call(0); 
                        av.state = 'waiting_lift_up'; 
                    } 
                    break; 
                }
                case 'waiting_lift_up': { 
                    const lift = this.getLift(this.bld.id); 
                    if (lift && lift.currentFloor === 0 && lift.state === 'open') { 
                        av.timer = 20 + Math.random() * 20; 
                        av.state = 'delay_enter_lift_up'; 
                    } 
                    break; 
                }
                case 'delay_enter_lift_up': { 
                    av.timer--; 
                    if (av.timer <= 0) av.state = 'riding_lift_up'; 
                    break; 
                }
                case 'riding_lift_up': {
                    const lift = this.getLift(this.bld.id);
                    if (lift) {
                        av.cont.visible = false; 
                        lift.call(av.floorIdx);
                        av.cont.y = (this.totalH - 80 - 4) + lift.car.y; 
                        if (lift.currentFloor === av.floorIdx && lift.state === 'open') { 
                            av.cont.y = av.floorY; 
                            av.cont.visible = true; 
                            av.state = 'walking_to_desk'; 
                        }
                    }
                    break;
                }
                case 'walking_to_desk': {
                    this.animateWalk(av); 
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) { 
                        av.cont.x = av.deskX; 
                        if (refs) refs.wantsToEnter = false; 
                        av.state = 'working'; 
                    } else { 
                        av.cont.x += Math.sign(dx) * av.speed; 
                        av.cont.scale.x = Math.sign(dx); 
                    }
                    break;
                }

                case 'working': {
                    if (av.m.isCeo) break; 
                    
                    const actData = getAct(getStage(av.m.rel, av.m.ret, av.m.phase), dp, G.models.indexOf(av.m), av.m);
                    if (actData.act === 'sleep' && av.bedX !== undefined) {
                        av.cont.x = av.bedX;
                        av.cont.y = av.floorY;
                        av.cont.rotation = 0;
                        av.cont.scale.x = 1;
                        // Hide avatar parts
                        if (av.head) av.head.visible = false;
                        if (av.body) av.body.visible = false;
                        if (av.legL) av.legL.visible = false;
                        if (av.legR) av.legR.visible = false;
                        if (av.dot) av.dot.visible = false;
                        if (av.shadow) av.shadow.visible = false;
                        if (av.ghostL) av.ghostL.visible = false;
                        if (av.ghostR) av.ghostR.visible = false;
                        // Lazy-init sleeping graphics
                        if (!av._sleepGfx) {
                            const labData = (typeof LABS !== 'undefined' && LABS[av.m.lab]) || { color: '#3b82f6' };
                            const col = parseInt(labData.color.replace('#', ''), 16);
                            const bt = -10; // mattress surface in local coords
                            const sg = new PIXI.Graphics();
                            sg.beginFill(0xddd8c8, 0.7); sg.drawRoundedRect(-15, bt - 8, 14, 7, 3); sg.endFill();
                            sg.beginFill(0xfdd8b5); sg.drawCircle(-8, bt - 5, 4); sg.endFill();
                            sg.beginFill(0x2c1810, 0.7); sg.drawEllipse(-8, bt - 9, 3.5, 1.5); sg.endFill();
                            sg.beginFill(0x2c1810, 0.5); sg.drawRect(-10.5, bt - 5, 1.8, 0.8); sg.drawRect(-6, bt - 5, 1.8, 0.8); sg.endFill();
                            sg.beginFill(0x2c1810, 0.2); sg.drawRect(-9, bt - 2.5, 2.5, 0.6); sg.endFill();
                            sg.beginFill(col, 0.5);
                            sg.moveTo(-2, bt + 2); sg.lineTo(-2, bt - 1);
                            sg.quadraticCurveTo(7, bt - 11, 18, bt);
                            sg.lineTo(18, bt + 2); sg.closePath(); sg.endFill();
                            sg.beginFill(col, 0.25);
                            sg.moveTo(-1, bt + 1); sg.lineTo(-1, bt);
                            sg.quadraticCurveTo(7, bt - 9, 17, bt + 1);
                            sg.lineTo(17, bt + 1); sg.closePath(); sg.endFill();
                            const sc = new PIXI.Container();
                            sc.addChild(sg);
                            sc.eventMode = 'static'; sc.cursor = 'pointer';
                            sc.hitArea = new PIXI.Rectangle(-18, bt - 12, 40, 18);
                            sc.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(av.m); });
                            sc.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, av.m.name, (LABS[av.m.lab] || { name: 'Lab' }).name + ' (sleeping)'); });
                            sc.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
                            const zc = new PIXI.Container(); zc.x = -2; zc.y = bt - 12;
                            const z1 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
                            z1.anchor.set(0.5); z1.alpha = 0.7;
                            const z2 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 9, fill: col, fontWeight: 'bold' });
                            z2.anchor.set(0.5); z2.x = 5; z2.y = -8; z2.alpha = 0.5;
                            const z3 = new PIXI.Text('Z', { fontFamily: 'JetBrains Mono', fontSize: 11, fill: col, fontWeight: 'bold' });
                            z3.anchor.set(0.5); z3.x = 10; z3.y = -18; z3.alpha = 0.3;
                            zc.addChild(z1, z2, z3);
                            sc.addChild(zc);
                            av._sleepGfx = sc; av._z1 = z1; av._z2 = z2; av._z3 = z3; av._zPhase = Math.random() * Math.PI * 2;
                            av.cont.addChild(sc);
                        }
                        av._sleepGfx.visible = true;
                        const zt = G.tick * 0.04 + av._zPhase;
                        av._z1.y = Math.sin(zt) * 3; av._z1.alpha = 0.5 + Math.sin(zt) * 0.3;
                        av._z2.y = -8 + Math.sin(zt + 1) * 3; av._z2.alpha = 0.3 + Math.sin(zt + 1) * 0.25;
                        av._z3.y = -18 + Math.sin(zt + 2) * 3; av._z3.alpha = 0.15 + Math.sin(zt + 2) * 0.2;
                    } else {
                        // Awake — restore avatar, hide sleep graphics
                        if (av._sleepGfx) av._sleepGfx.visible = false;
                        if (av.head) av.head.visible = true;
                        if (av.body) av.body.visible = true;
                        if (av.legL) av.legL.visible = true;
                        if (av.legR) av.legR.visible = true;
                        if (av.dot) av.dot.visible = true;
                        if (av.shadow) av.shadow.visible = true;
                        if (av.ghostL) av.ghostL.visible = true;
                        if (av.ghostR) av.ghostR.visible = true;
                        av.cont.rotation = 0;
                        av.cont.x = av.deskX - 30 + Math.sin(G.tick * 0.02 + i) * 20;
                        av.cont.y = av.floorY;
                        av.cont.scale.x = Math.sign(Math.cos(G.tick * 0.02 + i)) || 1;
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.15) * 1.5;
                        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.15)) * 1.5;
                        if (av.legL && av.legR) {
                            av.legL.y = Math.sin(G.tick * 0.15) * 2;
                            av.legR.y = -Math.sin(G.tick * 0.15) * 2;
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["Making coffee.", "Watching the gecko.", "Reading papers."][Math.floor(Math.random()*3)]);
                        }
                    }
                    break;
                }

                case 'chatting': {
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.1 + i) * 1.5;
                    av.body.y = -32 + 12 + 4 + (Math.sin(G.tick * 0.1 + i) * 1.5 * 0.5);
                    if (av.legL && av.legR) { 
                        av.legL.y = 0; 
                        av.legR.y = 0; 
                    }
                    
                    if (Math.random() < 0.01 && this.bubbles.length < 15) {
                        const chats = ["Interesting.", "Hmm...", "Parameter count?", "Check my benchmarks."];
                        this.spawnBubble(av, chats[Math.floor(Math.random() * chats.length)]);
                    }

                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = av.resumeState || 'returning';
                        av.timer = 60; 
                    }
                    break;
                }

                case 'walking_to_elevator_down': {
                    if (av.floorIdx === 0) {
                        av.state = 'walking_out'; 
                        av.targetX = this.startX + this.usableW / 2;
                    } else {
                        av.cont.rotation = 0; 
                        this.animateWalk(av);
                        const distDown = av.targetX - av.cont.x;
                        if (Math.abs(distDown) < av.speed) {
                            av.cont.x = av.targetX;
                            av.state = 'calling_lift';
                            if (av.legL && av.legR) { 
                                av.legL.y = 0; 
                                av.legR.y = 0; 
                            }
                        } else {
                            av.cont.x += Math.sign(distDown) * av.speed;
                            av.cont.scale.x = Math.sign(distDown); 
                        }
                    }
                    break;
                }

                case 'calling_lift': {
                    const cLift = this.getLift(this.bld.id);
                    if (cLift) {
                        cLift.call(av.floorIdx);
                        av.state = 'waiting_lift';
                    }
                    break;
                }

                case 'waiting_lift': {
                    const wLift = this.getLift(this.bld.id);
                    if (wLift && wLift.currentFloor === av.floorIdx && wLift.state === 'open') {
                        av.timer = 20 + Math.random() * 20;
                        av.state = 'delay_enter_lift';
                    }
                    break;
                }

                case 'delay_enter_lift': {
                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = 'entering_lift';
                    }
                    break;
                }

                case 'entering_lift': {
                    const eLift = this.getLift(this.bld.id);
                    if (eLift) {
                        av.cont.visible = false;
                        eLift.call(0);
                        av.state = 'riding_lift';
                    }
                    break;
                }

                case 'riding_lift': {
                    const rLift = this.getLift(this.bld.id);
                    if (rLift) {
                        const groundFloorY = this.totalH - 80 - 4; 
                        av.cont.y = groundFloorY + rLift.car.y; 
                        
                        if (rLift.currentFloor === 0 && rLift.state === 'open') {
                            av.state = 'walking_out';
                            av.cont.y = groundFloorY; 
                            av.cont.visible = true; 
                            av.targetX = this.startX + this.usableW / 2; 
                        }
                    }
                    break;
                }
                    
                case 'walking_out': {
                    this.animateWalk(av);
                    const outDist = av.targetX - av.cont.x;
                    if (Math.abs(outDist) < av.speed) {
                        av.state = 'gone';
                        av.cont.visible = false;
                        
                        if (refs) {
                            refs.bld = null; 
                            refs.wantsToLeave = false; 
                            refs.c.x = G.bldById[this.bld.id].x + (G.bldById[this.bld.id].w / 2);
                            refs.c.visible = true;
                        }
                    } else {
                        av.cont.x += Math.sign(outDist) * av.speed;
                        av.cont.scale.x = Math.sign(outDist); 
                    }
                    break;
                }
            }
        });
        
        for (let i = this.elevators.length - 1; i >= 0; i--) {
            let e = this.elevators[i];
            e.y += e.speed;
            e.car.y = e.y;
            
            if ((e.speed > 0 && e.y >= e.endY) || (e.speed < 0 && e.y <= e.endY)) {
                if (e.callback) e.callback();
                e.car.destroy();
                this.elevators.splice(i, 1);
            }
        }
        
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 20);
            
            if (b.life <= 0) {
                b.cont.destroy();
                this.bubbles.splice(i, 1);
            }
        }
    }
};
