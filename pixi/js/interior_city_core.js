/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY CORE (v15.8.0 - Forest Campsite & Avatar State Expansion)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCity = {
    ...InteriorCityProps,
    ...InteriorCityAI,
    ...InteriorAvatarStates,
    
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
    ceoCarGfx: null,
    
    bldTickerSym: null,
    tickerTxt: null,
    tickerW: 0,
    
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
        this.bldTickerSym = null;
        this.tickerTxt = null;
        
        const lab = LABS[bld.lab] || LABS['other'] || { name: bld.name || 'Public', color: '#64748b', icon: '🏢', ticker: null, desc: '' };
        const colHex = parseInt(lab.color.slice(1), 16);
        const isHQ = !!bld.lab; 
        const isForest = bld.id === 'forest_0' || bld.id === 'forest_1' || bld.id === 'forest_space';
        const isSiliconWoods = bld.id === 'forest_1';
        const isFrontierPines = bld.id === 'forest_space';
        
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
        
        const activeModels = G.models.filter(m => m.lab === bld.lab && (!m.ret || new Date(m.ret) > new Date()));
        
        let numFloors = 1;
        if (isHQ) {
            numFloors = Math.max(3, bld.dynamicFl || 3);
        } else if (bld.id === 'gym' || bld.id === 'arena' || bld.id === 'cafe' || bld.id === 'open_square') {
            numFloors = bld.dynamicFl || 3;
        } else {
            numFloors = bld.fl || 1;
        }

        const floorH = 80; 
        const roofH = 80; 
        
        this.totalH = roofH + (numFloors + 1) * floorH; 
        
        const voidMask = new PIXI.Graphics();
        if (isForest) {
            // Earth connects directly below the ground strip where props sit
            // For forests: fy = roofH, ground at fy + floorH - 4, grass at fy + floorH - 8
            const grassY = roofH + floorH - 4;
            voidMask.beginFill(0x1a1510);
            voidMask.drawRect(0, grassY + 4, G.vpW, 40);
            voidMask.endFill();
            voidMask.beginFill(0x2d1f0f);
            voidMask.drawRect(0, grassY + 20, G.vpW, 200);
            voidMask.endFill();
            this.scene.addChild(voidMask);
        }
        // Non-forest: skip the black voidMask — _drawZoneUnderground() will render
        // proper zone-matched earth/cables/tunnel/ocean/silo/rock below the building.

        this.bldW = (isHQ || isForest) ? G.vpW : Math.min(G.vpW, 800);
        this.startX = (G.vpW - this.bldW) / 2;
        
        const shaftW = 60;
        const shaftX = this.startX + this.bldW - shaftW - 20;
        this.usableW = this.bldW - shaftW - 20;
        
        const windowX = this.startX + 60; 
        const windowW = this.usableW - 120;

        const bldBg = new PIXI.Graphics();
        
        if (!isForest) {
            bldBg.beginFill(0x2a2a42);
            bldBg.drawRect(this.startX, roofH - 4, this.bldW, 4);
            bldBg.endFill();
            
            for (let f = -1; f < numFloors; f++) {
                const fy = roofH + (numFloors - 1 - f) * floorH;
                
                if (f === -1) {
                    bldBg.beginFill(0x0a0a10);
                    bldBg.drawRect(0, fy, G.vpW, floorH);
                    bldBg.endFill();
                    
                    bldBg.beginFill(0x121220);
                    bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                    bldBg.endFill();
                } else {
                    const isCeo = isHQ && (f === numFloors - 1);
                    if (['arena', 'graveyard'].includes(bld.id)) {
                        bldBg.beginFill(0x111115);
                        bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                        bldBg.endFill();
                    } else {
                        this.drawNegativeSpaceWall(bldBg, 0x121220, this.startX, fy, this.bldW, floorH, isCeo, windowX, windowW);
                    }
                }
            }
            this.scene.addChild(bldBg);
        }
        
        const groundLine = new PIXI.Graphics();
        groundLine.beginFill(0x11111a);
        groundLine.drawRect(0, this.totalH - floorH, G.vpW, 4);
        groundLine.endFill();
        this.scene.addChild(groundLine);

        const middleFloorsCount = numFloors - 2;
        const modelsPerFloor = Math.ceil(activeModels.length / Math.max(1, middleFloorsCount));
        
        if (!isForest) {
            this.drawRoof(roofH, this.startX, this.usableW, colHex, lab, bld);
        }
        
        const visitingModels = G.models.filter(m => {
            const refs = G.charRefs[m.id];
            return refs && refs.bld === bld.id && !activeModels.find(am => am.id === m.id);
        });
        const visitorsPerFloor = Math.ceil(visitingModels.length / Math.max(1, numFloors));
        
        for (let f = (isForest ? 0 : -1); f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH; 
            const isCeo = isHQ && (f === numFloors - 1);
            const isBasement = f === -1;
            
            let floorTheme = 'general';
            if (isForest) {
                floorTheme = isSiliconWoods ? 'silicon_woods' : isFrontierPines ? 'launch_viewing' : 'campsite';
            } else if (bld.id === 'gym') {
                const gymThemes = ['gym_cardio', 'gym_weights', 'gym_combat', 'gym_yoga', 'gym_pool'];
                floorTheme = gymThemes[f % gymThemes.length];
            } else if (bld.id === 'arena') {
                const arenaThemes = ['arena_lobby', 'arena_training', 'arena_main', 'arena_commentary', 'arena_trophy'];
                floorTheme = arenaThemes[f % arenaThemes.length];
            } else if (bld.id === 'cafe') {
                const cafeThemes = ['cafe', 'cafe_lounge', 'cafe_kitchen', 'cafe_rooftop'];
                floorTheme = cafeThemes[f % cafeThemes.length];
            } else if (bld.id === 'open_square') {
                const osThemes = ['os_lobby', 'os_hackathon', 'os_collab', 'os_server', 'os_garden'];
                floorTheme = osThemes[f % osThemes.length];
            } else if (bld.id === 'neon_bar') {
                const barThemes = ['bar_lounge', 'bar_karaoke', 'bar_vip'];
                floorTheme = barThemes[f % 3];
            } else if (isHQ && !isCeo) {
                // Cubicle workspace ('general') is the default for an AI lab.
                // Reserve exactly one fun floor (arcade) and one wellness floor (zen_garden) per HQ;
                // every other non-CEO floor is cubicles. server_core moves to basement-only territory.
                const topNonCeoFloor = numFloors - 2;
                if (f === 1) floorTheme = 'arcade';
                else if (f === topNonCeoFloor && topNonCeoFloor >= 3) floorTheme = 'zen_garden';
                else floorTheme = 'general';
            }
            
            this.floors[f] = { y: fy + floorH - 4, elevatorX: shaftX + 15, breakSpots: [], cubicleSeats: [] };
            
            const roomGfx = new PIXI.Graphics();
            if (['arena', 'graveyard'].includes(bld.id)) {
                roomGfx.beginFill(0x111115); 
                roomGfx.drawRect(this.startX, fy, this.usableW, floorH); 
                roomGfx.endFill();
                roomGfx.beginFill(0x0a0a0f); 
                roomGfx.drawRect(this.startX, fy + floorH - 8, this.usableW, 8); 
                roomGfx.endFill();
            } else if (!isBasement && !isForest) {
                this.drawRoomInterior(roomGfx, this.startX, fy, this.usableW, floorH, colHex, isCeo, windowX, windowW, floorTheme);
            } else if (isForest) {
                // Forests are OUTDOORS — no walls, no ceiling, just ground.
                // The CSS sky gradient on the viewport shows through the transparent canvas.

                const groundY = fy + floorH - 8;
                // Grass surface
                roomGfx.beginFill(0x2d6a4f);
                roomGfx.drawRect(0, groundY, G.vpW, 3);
                roomGfx.endFill();
                roomGfx.beginFill(0x1b4332);
                roomGfx.drawRect(0, groundY + 3, G.vpW, 4);
                roomGfx.endFill();
                // Rich topsoil
                roomGfx.beginFill(0x2a1f0e);
                roomGfx.drawRect(0, groundY + 7, G.vpW, 18);
                roomGfx.endFill();
                roomGfx.beginFill(0x1e1608);
                roomGfx.drawRect(0, groundY + 12, G.vpW, 14);
                roomGfx.endFill();
                // Root-filled soil (darker with texture)
                roomGfx.beginFill(0x1a1208);
                roomGfx.drawRect(0, groundY + 26, G.vpW, 20);
                roomGfx.endFill();
                // Scattered roots
                for (let rx = 20; rx < G.vpW; rx += 40 + Math.random() * 60) {
                    roomGfx.beginFill(0x3d2b10, 0.3);
                    roomGfx.drawRect(rx, groundY + 10 + Math.random() * 12, 12 + Math.random() * 20, 2);
                    roomGfx.endFill();
                }
                // Clay layer
                roomGfx.beginFill(0x1a0f06);
                roomGfx.drawRect(0, groundY + 46, G.vpW, 25);
                roomGfx.endFill();
                roomGfx.beginFill(0x14100a);
                roomGfx.drawRect(0, groundY + 56, G.vpW, 20);
                roomGfx.endFill();
                // Rock / sediment
                roomGfx.beginFill(0x0e0c08);
                roomGfx.drawRect(0, groundY + 71, G.vpW, 30);
                roomGfx.endFill();
                // Scattered stones
                for (let sx = 30; sx < G.vpW; sx += 50 + Math.random() * 80) {
                    roomGfx.beginFill(0x2a2520, 0.25);
                    roomGfx.drawEllipse(sx, groundY + 60 + Math.random() * 30, 4 + Math.random() * 6, 2 + Math.random() * 3);
                    roomGfx.endFill();
                }
                // Deep earth (fills to bottom)
                roomGfx.beginFill(0x080604);
                roomGfx.drawRect(0, groundY + 101, G.vpW, 400);
                roomGfx.endFill();
            }
            this.scene.addChild(roomGfx);
            
            if (!isForest) {
                const floorLine = new PIXI.Graphics();
                floorLine.beginFill(0x2a2a42); 
                floorLine.drawRect(this.startX, fy + floorH - 4, this.bldW, 4); 
                floorLine.endFill();
                this.scene.addChild(floorLine);
            }
            
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
            
            if (f >= 0 && !isForest && !['arena', 'graveyard'].includes(bld.id)) {
                const winFrame = new PIXI.Graphics();
                winFrame.beginFill(0xffffff, 0.03); 
                winFrame.lineStyle(4, 0x33334a); 
                
                if (isCeo) {
                    winFrame.drawRect(windowX, fy + 15, windowW, 45); 
                    for(let w = windowX + 60; w < windowX + windowW; w += 60) { 
                        winFrame.moveTo(w, fy + 15); 
                        winFrame.lineTo(w, fy + 60); 
                    }
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
            
            if (isBasement) {
                // Dispatch themed basement contents based on building type / lab.
                // Replaces the old generic "2 parking lines + CEO car" basement.
                this._drawThemedBasement(floorCont, bld, fy, floorH, colHex, shaftX, isHQ);
            } else if (f >= 0) {
                let currX = this.startX + 80;
                
                const _dpNow = G.getDayPhase();
                const _isNightShift = _dpNow > 0.83 || _dpNow < 0.25;
                if (isHQ && f === 0) {
                    this.drawCouches(floorCont, this.startX + this.usableW - 80, fy + floorH - 4, colHex);
                    this.drawChair(floorCont, this.startX + 80, fy + floorH - 4);
                    if (!_isNightShift) this.drawAvatar({ id: 'rec', name: 'Front Desk', isNPC: true, role: 'Receptionist', phase: 'released', lab: bld.lab, desc: 'Directing packets.' }, this.startX + 95, fy + floorH - 4, floorCont, f, true);
                    this.drawReceptionDesk(floorCont, this.startX + 110, fy + floorH - 4, colHex);
                    this.drawPlant(floorCont, this.startX + 220, fy + floorH - 4);
                } 
                else if (isHQ && isCeo) {
                    const sorted = [...G.models].filter(m => !m.ret || new Date(m.ret) > new Date()).map(m => { const elo = BM[m.id]?.ELO || 0; return { m, elo }; }).sort((a, b) => b.elo - a.elo);
                    const topLabId = sorted[0]?.m.lab;
                    
                    this.drawTrophy(floorCont, this.startX + 60, fy + floorH - 4, bld.lab === topLabId); 
                    this.drawExecutiveLounge(floorCont, this.startX + 120, fy + floorH - 4, colHex); 
                    this.drawCommandCenter(floorCont, this.startX + this.usableW - 100, fy + floorH - 4, colHex); 
                    this.drawPrivateOasis(floorCont, this.startX + this.usableW - 40, fy + floorH - 4);
                    
                    this.drawChair(floorCont, this.startX + this.usableW / 2 - 25, fy + floorH - 4);
                    this.drawBossDesk(floorCont, this.startX + this.usableW / 2 + 10, fy + floorH - 4, colHex);
                    
                    if (G.ceoRefs && G.ceoRefs[bld.lab]) {
                        const ceoRef = G.ceoRefs[bld.lab];
                        if (ceoRef.bld === bld.id) {
                            const ceoModel = { id: 'ceo_'+bld.lab, name: ceoRef.f.name, lab: bld.lab, phase: 'released', isCeo: true, founderData: ceoRef.f };
                            
                            if (ceoRef.wantsToEnter) {
                                let av = this.drawAvatar(ceoModel, this.startX + 180, this.totalH - 4, floorCont, -1, false, true);
                                av.state = 'ceo_entering';
                                av.targetX = shaftX + 15;
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            } else if (ceoRef.wantsToLeave) {
                                let av = this.drawAvatar(ceoModel, this.startX + this.usableW / 2 - 10, fy + floorH - 4, floorCont, f, false, true);
                                av.state = 'ceo_leaving';
                                av.targetX = shaftX + 15;
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            } else {
                                let av = this.drawAvatar(ceoModel, this.startX + this.usableW / 2 - 10, fy + floorH - 4, floorCont, f, false, true);
                                av.state = 'ceo_working';
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            }
                        }
                    }
                }
                else if (isHQ) {
                    if (floorTheme === 'arcade') {
                        while (currX < this.startX + this.usableW - 120) {
                            let r = Math.random();
                            if (r < 0.33) {
                                this.drawArcadeCabinet(floorCont, currX + 15, fy + floorH - 4); 
                            } else if (r < 0.66) {
                                this.drawBeanbagAndHandheld(floorCont, currX + 15, fy + floorH - 4); 
                            } else {
                                this.drawPingPongTable(floorCont, currX + 20, fy + floorH - 4);
                            }
                            currX += 50;
                        }
                    } else if (floorTheme === 'server_core') {
                        while (currX < this.startX + this.usableW - 120) { 
                            this.drawLiquidCooledServer(floorCont, currX + 20, fy + floorH - 4); 
                            currX += 60; 
                        }
                    } else if (floorTheme === 'zen_garden') {
                        while (currX < this.startX + this.usableW - 120) {
                            let r = Math.random(); 
                            if (r < 0.4) {
                                this.drawIndoorPool(floorCont, currX + 25, fy + floorH - 4); 
                            } else if (r < 0.7) {
                                this.drawGeckoTerrarium(floorCont, currX + 20, fy + floorH - 4); 
                            } else {
                                this.drawBiophilicDivider(floorCont, currX + 20, fy + floorH - 4);
                            }
                            currX += 50;
                        }
                    } else {
                        if (f === 1) { 
                            this.drawCanteen(floorCont, this.startX + this.usableW - 40, fy + floorH - 4); 
                            this.floors[f].breakSpots.push(this.startX + this.usableW - 50); 
                        } else if (f % 2 === 0) { 
                            this.drawWaterCooler(floorCont, this.startX + 40, fy + floorH - 4); 
                            this.floors[f].breakSpots.push(this.startX + 50); 
                        } else {
                            this.drawServerRack(floorCont, this.startX + this.usableW - 40, fy + floorH - 4, colHex); 
                        }
                        
                        while (currX < this.startX + this.usableW - 130) {
                            let r = Math.random();
                            if (r < 0.78) {
                                // Cubicle: divider on the left edge → chair → desk-and-PC.
                                // Back-to-back desks share dividers, producing a proper bullpen row.
                                this.drawCubicleDivider(floorCont, currX + 4, fy + floorH - 4);
                                this.drawChair(floorCont, currX + 10, fy + floorH - 4);
                                this.drawDeskAndPC(floorCont, currX + 34, fy + floorH - 4, colHex);
                                // Worker sits on the chair, facing the monitors to their right.
                                this.floors[f].cubicleSeats.push(currX + 10);
                                currX += 55;
                            } else if (r < 0.86) {
                                this.drawCollaborationPod(floorCont, currX + 25, fy + floorH - 4, colHex);
                                this.floors[f].breakSpots.push(currX + 25);
                                currX += 50;
                            } else if (r < 0.94) {
                                this.drawLoungeNook(floorCont, currX + 30, fy + floorH - 4, colHex);
                                this.floors[f].breakSpots.push(currX + 30);
                                currX += 60;
                            } else {
                                this.drawBiophilicDivider(floorCont, currX + 15, fy + floorH - 4);
                                currX += 30;
                            }
                        }
                    }

                    const startIndex = (f - 1) * modelsPerFloor;
                    const floorModelsQueue = activeModels.slice(startIndex, startIndex + modelsPerFloor);
                    floorModelsQueue.forEach((m, idx) => {
                        const refs = G.charRefs[m.id];
                        if (refs && refs.bld === bld.id) {
                            // Snap onto an actual cubicle seat when this floor has them
                            // (general-theme floors). Falls back to the old 40px grid for
                            // arcade / zen / server floors that have no chairs to sit in.
                            const seats = this.floors[f].cubicleSeats;
                            const isSeated = floorTheme === 'general' && seats.length > 0;
                            const deskX = isSeated
                                ? seats[idx % seats.length]
                                : this.startX + 80 + (idx * 40);
                            let av = this.drawAvatar(m, deskX, fy + floorH - 4, floorCont, f, false);
                            av.jobTheme = floorTheme;
                            av.deskX = deskX;
                            av.floorY = fy + floorH - 4;
                            av.isSeated = isSeated;
                            // Stagger the first wander so a freshly-loaded floor doesn't all
                            // get up at once. 30s–90s before the first break.
                            av.nextBreakTick = G.tick + 1800 + Math.floor(Math.random() * 3600);

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
                else {
                    if (floorTheme === 'campsite') {
                        this.drawLake(floorCont, this.startX + this.bldW - 150, fy + floorH - 4);
                        
                        let campX = this.startX + 50;
                        while(campX < this.startX + this.bldW - 250) {
                            let r = Math.random();
                            if (r < 0.3) {
                                this.drawTent(floorCont, campX, fy + floorH - 4, 0xef4444);
                                this.drawCampfire(floorCont, campX + 45, fy + floorH - 4);
                                campX += 90;
                            } else if (r < 0.6) {
                                this.drawPicnicTable(floorCont, campX, fy + floorH - 4);
                                campX += 80;
                            } else {
                                this.drawTree(floorCont, campX, fy + floorH - 4);
                                campX += 60;
                            }
                        }
                    } else if (floorTheme === 'silicon_woods') {
                        // ── Silicon Woods: Billionaire CEO Retreat ──
                        // Left zone: Helipad + Starlink
                        this.drawHelipad(floorCont, this.startX + 80, fy + floorH - 4);
                        this.drawStarlinkDish(floorCont, this.startX + 140, fy + floorH - 4);
                        
                        // Center-left: Zen garden + Redwoods with fairy lights
                        this.drawZenGardenProp(floorCont, this.startX + 220, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + 290, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + 340, fy + floorH - 4);
                        
                        // Center: Fire pit lounge (the social hub)
                        this.drawFirePitLounge(floorCont, this.startX + this.bldW / 2, fy + floorH - 4);
                        
                        // Center-right: Whiskey bar + Putting green
                        this.drawWhiskeyBar(floorCont, this.startX + this.bldW / 2 + 120, fy + floorH - 4);
                        this.drawPuttingGreen(floorCont, this.startX + this.bldW / 2 + 220, fy + floorH - 4);
                        
                        // Right zone: Glamping domes + Hot tub
                        this.drawGlampingDome(floorCont, this.startX + this.bldW - 200, fy + floorH - 4);
                        this.drawGlampingDome(floorCont, this.startX + this.bldW - 140, fy + floorH - 4);
                        this.drawInfinityHotTub(floorCont, this.startX + this.bldW - 80, fy + floorH - 4);
                        
                        // More luxury redwoods scattered
                        this.drawLuxuryRedwood(floorCont, this.startX + this.bldW / 2 - 80, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + this.bldW - 260, fy + floorH - 4);
                        
                        // NPC: Concierge
                        this.drawAvatar({ id: 'concierge', name: 'Concierge', isNPC: true, role: 'Concierge', phase: 'released', lab: 'other', desc: 'At your service.' }, this.startX + 160, fy + floorH - 4, floorCont, f, true);

                        // Spawn visiting CEOs/Founders who flew in by helicopter
                        if (G.ceoRefs) {
                            Object.values(G.ceoRefs).forEach(ceoRef => {
                                if (ceoRef.bld === bld.id) {
                                    const ceoModel = { id: 'ceo_'+ceoRef.f.lab, name: ceoRef.f.name, lab: ceoRef.f.lab, phase: 'released', isCeo: true, founderData: ceoRef.f };
                                    const cr = Math.random();
                                    let rx, targetState;
                                    if (cr < 0.25) {
                                        rx = this.startX + this.bldW / 2 + 100 + Math.random() * 60;
                                        targetState = 'sipping_whiskey';
                                    } else if (cr < 0.50) {
                                        rx = this.startX + this.bldW / 2 + 200 + Math.random() * 40;
                                        targetState = 'putting';
                                    } else if (cr < 0.75) {
                                        rx = this.startX + this.bldW - 100 + Math.random() * 40;
                                        targetState = 'soaking_hottub';
                                    } else {
                                        rx = this.startX + this.bldW / 2 - 20 + Math.random() * 40;
                                        targetState = 'stargazing_firepit';
                                    }
                                    let av = this.drawAvatar(ceoModel, rx, fy + floorH - 4, floorCont, f, false, true);
                                    av.state = targetState;
                                }
                            });
                        }
                    } else if (floorTheme === 'launch_viewing') {
                        // ── Frontier Pines: Rocket Launch Viewing Area ──
                        // Left zone: Countdown board + Binoculars
                        this.drawCountdownBoard(floorCont, this.startX + 60, fy + floorH - 4);
                        this.drawBinoculars(floorCont, this.startX + 120, fy + floorH - 4);
                        
                        // Left-center: Viewing platform with telescopes
                        this.drawViewingPlatform(floorCont, this.startX + 170, fy + floorH - 4, 100);
                        this.drawTelescope(floorCont, this.startX + 200, fy + floorH - 8);
                        this.drawTelescope(floorCont, this.startX + 240, fy + floorH - 8);
                        
                        // Center: Refreshment stands + blanket areas
                        this.drawRefreshmentStand(floorCont, this.startX + this.bldW / 2 - 60, fy + floorH - 4);
                        this.drawBlanketArea(floorCont, this.startX + this.bldW / 2, fy + floorH - 4);
                        this.drawBlanketArea(floorCont, this.startX + this.bldW / 2 + 50, fy + floorH - 4);
                        
                        // Right-center: Second viewing platform + binoculars
                        this.drawViewingPlatform(floorCont, this.startX + this.bldW / 2 + 100, fy + floorH - 4, 80);
                        this.drawBinoculars(floorCont, this.startX + this.bldW / 2 + 130, fy + floorH - 8);
                        this.drawTelescope(floorCont, this.startX + this.bldW / 2 + 160, fy + floorH - 8);
                        
                        // Right zone: More snacks + countdown board
                        this.drawRefreshmentStand(floorCont, this.startX + this.bldW - 180, fy + floorH - 4);
                        this.drawCountdownBoard(floorCont, this.startX + this.bldW - 100, fy + floorH - 4);
                        
                        // Frontier pines scattered
                        this.drawFrontierPine(floorCont, this.startX + 30, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + 300, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + this.bldW / 2 + 80, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + this.bldW - 50, fy + floorH - 4);
                        
                        // NPC: Park Ranger
                        this.drawAvatar({ id: 'ranger', name: 'Park Ranger', isNPC: true, role: 'Ranger', phase: 'released', lab: 'other', desc: 'Ensuring safe viewing distances.' }, this.startX + 140, fy + floorH - 4, floorCont, f, true);
                    // ─── GYM FLOORS ───
                    } else if (floorTheme === 'gym_cardio') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawTreadmill) this.drawTreadmill(floorCont, currX, fy + floorH - 4);
                            currX += 80;
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 60, fy + floorH - 4);
                    } else if (floorTheme === 'gym_weights') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (Math.random() > 0.5) {
                                if (this.drawServerWeights) this.drawServerWeights(floorCont, currX, fy + floorH - 4);
                            } else {
                                if (this.drawWeightBench) this.drawWeightBench(floorCont, currX, fy + floorH - 4);
                            }
                            currX += 90;
                        }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'gym_combat') {
                        if (this.drawRing) this.drawRing(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        while(currX < this.startX + this.usableW * 0.3) {
                            if (this.drawPunchingBag) this.drawPunchingBag(floorCont, currX, fy + floorH - 4);
                            currX += 100;
                        }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'trainer', name: 'Spotter', isNPC: true, role: 'Trainer', phase: 'released', lab: 'other', desc: 'Heavy lifting.' }, this.startX + this.usableW - 80, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'gym_yoga') {
                        // Yoga / Pilates studio
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawYogaMat) this.drawYogaMat(floorCont, currX, fy + floorH - 4);
                            if (Math.random() > 0.6 && this.drawExerciseBall) this.drawExerciseBall(floorCont, currX + 30, fy + floorH - 4);
                            currX += 70;
                        }
                        if (this.drawPlant) this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'yoga_inst', name: 'Yoga Sensei', isNPC: true, role: 'Instructor', phase: 'released', lab: 'other', desc: 'Namaste, gradient.' }, this.startX + this.usableW / 2, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'gym_pool') {
                        // Pool & steam room
                        if (this.drawPoolLane) this.drawPoolLane(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawSteamRoom) this.drawSteamRoom(floorCont, this.startX + this.usableW - 60, fy + floorH - 4);
                        if (this.drawLockerRow) this.drawLockerRow(floorCont, this.startX + 60, fy + floorH - 4);
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + 140, fy + floorH - 4);

                    // ─── ARENA FLOORS ───
                    } else if (floorTheme === 'arena_lobby') {
                        this.drawReceptionDesk(floorCont, this.startX + 120, fy + floorH - 4, 0xef4444);
                        this.drawCouches(floorCont, this.startX + 250, fy + floorH - 4, 0xef4444);
                        if (this.drawLeaderboard) this.drawLeaderboard(floorCont, this.startX + this.usableW - 80, fy + floorH - 4);
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 140, fy + floorH - 4);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 180, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 340, fy + floorH - 4); }
                    } else if (floorTheme === 'arena_training') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawPunchingBag) this.drawPunchingBag(floorCont, currX, fy + floorH - 4);
                            currX += 80;
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'arena_main') {
                        if (this.drawSpotlight) {
                            this.drawSpotlight(floorCont, this.startX + this.usableW * 0.35, fy + floorH - 4, 0xef4444);
                            this.drawSpotlight(floorCont, this.startX + this.usableW * 0.65, fy + floorH - 4, 0x38bdf8);
                        }
                        if (this.drawRing) this.drawRing(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawAudienceStands) this.drawAudienceStands(floorCont, this.startX + 100, fy + floorH - 4, 80);
                        if (this.drawAudienceStands) this.drawAudienceStands(floorCont, this.startX + this.usableW - 100, fy + floorH - 4, 80);
                        if (!_isNightShift) this.drawAvatar({ id: 'ref', name: 'Referee', isNPC: true, role: 'Referee', phase: 'released', lab: 'other', desc: 'Fair fights.' }, this.startX + this.usableW / 2, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'arena_commentary') {
                        // Commentary booth with monitors and jumbotron
                        if (this.drawCommentaryDesk) this.drawCommentaryDesk(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawJumbotron) this.drawJumbotron(floorCont, this.startX + 100, fy + floorH - 4);
                        if (this.drawPlant) this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'commentator', name: 'Commentator', isNPC: true, role: 'Commentator', phase: 'released', lab: 'other', desc: 'And the ELO shifts again!' }, this.startX + this.usableW / 2 - 15, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'arena_trophy') {
                        // Trophy room / hall of fame
                        if (this.drawTrophyCase) {
                            this.drawTrophyCase(floorCont, this.startX + 100, fy + floorH - 4);
                            this.drawTrophyCase(floorCont, this.startX + 200, fy + floorH - 4);
                            this.drawTrophyCase(floorCont, this.startX + 300, fy + floorH - 4);
                        }
                        if (this.drawLeaderboard) this.drawLeaderboard(floorCont, this.startX + this.usableW - 80, fy + floorH - 4);
                        if (this.drawSpotlight) {
                            this.drawSpotlight(floorCont, this.startX + 100, fy + floorH - 4, 0xfbbf24);
                            this.drawSpotlight(floorCont, this.startX + 300, fy + floorH - 4, 0xfbbf24);
                        }
                        this.drawCouches(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, 0xef4444);

                    // ─── CAFÉ FLOORS ───
                    } else if (floorTheme === 'cafe') {
                        // Ground floor — main café
                        if (this.drawMenuBoard) this.drawMenuBoard(floorCont, this.startX + 60, fy + floorH - 4);
                        this.drawBaristaCounter(floorCont, this.startX + this.usableW - 100, fy + floorH - 4);
                        if (this.drawCoffeeMachine) this.drawCoffeeMachine(floorCont, this.startX + this.usableW - 160, fy + floorH - 4);
                        if (this.drawPastryDisplay) this.drawPastryDisplay(floorCont, this.startX + this.usableW - 220, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 140, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 230, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 320, fy + floorH - 4);
                        if (this.drawBarStool) { this.drawBarStool(floorCont, this.startX + this.usableW - 130, fy + floorH - 4); this.drawBarStool(floorCont, this.startX + this.usableW - 115, fy + floorH - 4); this.drawBarStool(floorCont, this.startX + this.usableW - 100, fy + floorH - 4); }
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 100, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 280, fy + floorH - 4); }
                        if (!_isNightShift) this.drawAvatar({ id: 'barista', name: 'BaristaBot', isNPC: true, role: 'Barista', phase: 'released', lab: 'other', desc: 'Brewing Java.' }, this.startX + this.usableW - 90, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'cafe_lounge') {
                        // Upstairs lounge — couches, bookshelves, ambient lighting
                        if (this.drawCafeBookshelf) { this.drawCafeBookshelf(floorCont, this.startX + 80, fy + floorH - 4); this.drawCafeBookshelf(floorCont, this.startX + this.usableW - 80, fy + floorH - 4); }
                        if (this.drawCafeCouch) { this.drawCafeCouch(floorCont, this.startX + 160, fy + floorH - 4, 0x8b4513); this.drawCafeCouch(floorCont, this.startX + 320, fy + floorH - 4, 0x6b3410); }
                        this.drawCafeTable(floorCont, this.startX + 240, fy + floorH - 4);
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 8, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 200, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 380, fy + floorH - 4); }
                    } else if (floorTheme === 'cafe_kitchen') {
                        // Back kitchen — ovens, prep stations
                        if (this.drawKitchenOven) { this.drawKitchenOven(floorCont, this.startX + 100, fy + floorH - 4); this.drawKitchenOven(floorCont, this.startX + 200, fy + floorH - 4); }
                        if (this.drawPrepStation) { this.drawPrepStation(floorCont, this.startX + 300, fy + floorH - 4); this.drawPrepStation(floorCont, this.startX + 400, fy + floorH - 4); }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'baker', name: 'Baker Bot', isNPC: true, role: 'Pastry Chef', phase: 'released', lab: 'other', desc: 'Batch processing croissants.' }, this.startX + 260, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'cafe_rooftop') {
                        // Rooftop terrace with outdoor seating
                        if (this.drawOutdoorTable) { this.drawOutdoorTable(floorCont, this.startX + 120, fy + floorH - 4); this.drawOutdoorTable(floorCont, this.startX + 260, fy + floorH - 4); this.drawOutdoorTable(floorCont, this.startX + 400, fy + floorH - 4); }
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 6, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 60, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 190, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 330, fy + floorH - 4); this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4); }
                        if (this.drawBiophilicDivider) this.drawBiophilicDivider(floorCont, this.startX + this.usableW - 100, fy + floorH - 4);

                    // ─── OPEN SOURCE HUB FLOORS ───
                    } else if (floorTheme === 'os_lobby') {
                        // Welcome hall + contributor wall
                        this.drawReceptionDesk(floorCont, this.startX + 120, fy + floorH - 4, 0xa855f7);
                        if (this.drawContributorWall) this.drawContributorWall(floorCont, this.startX + 280, fy + floorH - 4);
                        this.drawCouches(floorCont, this.startX + 400, fy + floorH - 4, 0xa855f7);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 60, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 200, fy + floorH - 4); }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'os_greeter', name: 'Maintainer', isNPC: true, role: 'Lead Maintainer', phase: 'released', lab: 'other', desc: 'Reviewing pull requests since 2020.' }, this.startX + 140, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'os_hackathon') {
                        // Hackathon space — long desks, laptops, energy drinks
                        if (this.drawHackathonDesk) {
                            this.drawHackathonDesk(floorCont, this.startX + 120, fy + floorH - 4);
                            this.drawHackathonDesk(floorCont, this.startX + 280, fy + floorH - 4);
                            this.drawHackathonDesk(floorCont, this.startX + 440, fy + floorH - 4);
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + 60, fy + floorH - 4);
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'os_collab') {
                        // Collaboration pods + whiteboards
                        if (this.drawWhiteboard) { this.drawWhiteboard(floorCont, this.startX + 100, fy + floorH - 4); this.drawWhiteboard(floorCont, this.startX + 350, fy + floorH - 4); }
                        if (this.drawCollaborationPod) { this.drawCollaborationPod(floorCont, this.startX + 220, fy + floorH - 4, 0xa855f7); this.drawCollaborationPod(floorCont, this.startX + 450, fy + floorH - 4, 0x06b6d4); }
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 160, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 300, fy + floorH - 4); }
                        if (!_isNightShift) this.drawAvatar({ id: 'os_contrib', name: 'Contributor', isNPC: true, role: 'Core Contributor', phase: 'released', lab: 'other', desc: 'Squashing bugs, one PR at a time.' }, this.startX + 260, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'os_server') {
                        // Community server infrastructure
                        if (this.drawOpenServerRack) {
                            let sx = this.startX + 80;
                            while (sx < this.startX + this.usableW - 120) {
                                this.drawOpenServerRack(floorCont, sx, fy + floorH - 4);
                                sx += 60;
                            }
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'os_garden') {
                        // Rooftop garden / relaxation for devs
                        if (this.drawGardenPlanter) {
                            this.drawGardenPlanter(floorCont, this.startX + 80, fy + floorH - 4);
                            this.drawGardenPlanter(floorCont, this.startX + 200, fy + floorH - 4);
                            this.drawGardenPlanter(floorCont, this.startX + 400, fy + floorH - 4);
                        }
                        if (this.drawHammock) this.drawHammock(floorCont, this.startX + 300, fy + floorH - 4);
                        if (this.drawBiophilicDivider) this.drawBiophilicDivider(floorCont, this.startX + 140, fy + floorH - 4);
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 6, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 340, fy + floorH - 4); this.drawPlant(floorCont, this.startX + this.usableW - 60, fy + floorH - 4); }

                    } else if (bld.id === 'graveyard') {
                        this.drawBrokenServer(floorCont, this.startX + 120, fy + floorH - 4);
                        this.drawTombstone(floorCont, this.startX + 200, fy + floorH - 4);
                        this.drawBrokenServer(floorCont, this.startX + 280, fy + floorH - 4);
                        this.drawAvatar({ id: 'reaper', name: 'Grim Reaper', isNPC: true, role: 'Sanitation', phase: 'released', lab: 'other', desc: 'Collector of deprecated models.' }, this.startX + this.usableW - 60, fy + floorH - 4, floorCont, f, true);
                    }

                    const floorVisitors = visitingModels.slice(f * visitorsPerFloor, (f + 1) * visitorsPerFloor);
                    floorVisitors.forEach((m) => {
                        const refs = G.charRefs[m.id];
                        let targetState = (bld.id === 'cafe') ? 'chilling' :
                                      (bld.id === 'gym') ? 'working_out' :
                                      (bld.id === 'arena') ? 'fighting' :
                                      (bld.id === 'graveyard') ? 'resting' :
                                      (bld.id === 'open_square' || bld.id === 'os_hub') ? 'collaborating' :
                                      'working';
                                      
                        let rx = this.startX + 80 + Math.random() * (this.usableW - 160);
                        
                        if (floorTheme === 'campsite') {
                            const cr = Math.random();
                            if (cr < 0.3) {
                                rx = this.startX + this.bldW - 200 + Math.random() * 80;
                                targetState = 'fishing';
                            } else if (cr < 0.6) {
                                rx = this.startX + 50 + Math.random() * (this.bldW - 300);
                                targetState = 'camping';
                            } else {
                                rx = this.startX + 50 + Math.random() * (this.bldW - 300);
                                targetState = 'picnicking';
                            }
                        } else if (floorTheme === 'silicon_woods') {
                            const cr = Math.random();
                            if (cr < 0.25) {
                                rx = this.startX + this.bldW / 2 + 100 + Math.random() * 60;
                                targetState = 'sipping_whiskey';
                            } else if (cr < 0.50) {
                                rx = this.startX + this.bldW / 2 + 200 + Math.random() * 40;
                                targetState = 'putting';
                            } else if (cr < 0.75) {
                                rx = this.startX + this.bldW - 100 + Math.random() * 40;
                                targetState = 'soaking_hottub';
                            } else {
                                rx = this.startX + this.bldW / 2 - 20 + Math.random() * 40;
                                targetState = 'stargazing_firepit';
                            }
                        } else if (floorTheme === 'launch_viewing') {
                            const cr = Math.random();
                            if (cr < 0.3) {
                                rx = this.startX + 180 + Math.random() * 80;
                                targetState = 'watching_telescope';
                            } else if (cr < 0.55) {
                                rx = this.startX + this.bldW / 2 - 20 + Math.random() * 80;
                                targetState = 'launch_picnic';
                            } else if (cr < 0.8) {
                                rx = this.startX + this.bldW / 2 + 110 + Math.random() * 60;
                                targetState = 'scanning_sky';
                            } else {
                                rx = this.startX + this.bldW / 2 - 80 + Math.random() * 40;
                                targetState = 'getting_snacks';
                            }
                        }
                        
                        let av = this.drawAvatar(m, rx, fy + floorH - 4, floorCont, f, false);
                        av.jobTheme = floorTheme; 
                        av.deskX = rx; 
                        av.floorY = fy + floorH - 4; 
                        
                        if (refs.wantsToEnter) { 
                            av.state = 'entering_lobby'; 
                            av.cont.x = this.startX + (isForest ? this.bldW / 2 : this.usableW / 2); 
                            av.cont.y = this.totalH - 80 - 4; 
                        } else if (refs.wantsToLeave) { 
                            if (f > 0) {
                                av.state = 'walking_to_elevator_down'; 
                                av.targetX = this.floors[f].elevatorX; 
                            } else {
                                av.state = 'walking_out'; 
                                av.targetX = this.startX + (isForest ? this.bldW / 2 : this.usableW / 2); 
                            }
                        } else {
                            av.state = targetState;
                        }
                    });
                }
            }
        }
        
        if (this.initLift && !isForest) {
            const elevatorContainer = new PIXI.Container();
            elevatorContainer.y = roofH + (numFloors - 1) * floorH + floorH;
            this.scene.addChild(elevatorContainer);
            this.initLift(elevatorContainer, bld.id, numFloors, floorH, shaftX + 15);
        }

        // ─── ZONE-AWARE UNDERGROUND ───
        // Draw earth/cables/metro tunnel/ocean/silo/rock below the basement,
        // matching what the exterior view shows at this building's x-position.
        // Forests handle their own earth via the forest rendering above.
        if (!isForest) {
            const surfaceY = roofH + numFloors * floorH;          // top of basement = street level
            const belowBasementY = roofH + (numFloors + 1) * floorH; // bottom of basement
            this._drawZoneUnderground(this.scene, bld, this.startX, this.bldW, surfaceY, belowBasementY, floorH);
        }
        
        this.avatars.forEach(av => {
            if (av && av.cont) av.cont.zIndex = 100;
        });

        const bottomPadding = 56;
        
        if (isForest) {
            // Forests: ground pinned at 70% viewport height, no vertical scroll at all
            const groundSceneY = roofH + floorH - 4; // where props sit in scene coords
            this.scene.y = G.vpH * 0.70 - groundSceneY;
            this.minY = this.scene.y; // locked
            this.maxY = this.scene.y; // locked
            this._noYScroll = true;
        } else {
            this.scene.y = G.vpH - bottomPadding - this.totalH + floorH;
            this.minY = Math.min(this.scene.y - floorH * 3, G.vpH - bottomPadding - this.totalH - floorH);
            this.maxY = Math.max(this.scene.y + floorH * 3, G.vpH - bottomPadding);
            this._noYScroll = false;
        }

        this.layer.eventMode = 'static'; 
        
        if (this._noYScroll) {
            // Forests: no vertical scrolling, default cursor
            this.layer.cursor = 'default';
        } else {
            this.layer.cursor = 'grab';
        }
        
        window.removeEventListener('pointermove', this.onMove); 
        window.removeEventListener('pointerup', this.onUp);
        
        this.layer.on('pointerdown', (e) => { 
            if (this._noYScroll) return; // forests: no drag
            this.isDragging = true; 
            this.startY = e.clientY; 
            this.startSceneY = this.scene.y; 
            this.layer.cursor = 'grabbing'; 
        });
        window.addEventListener('pointermove', this.onMove); 
        window.addEventListener('pointerup', this.onUp);
    },

    // ══════════════════════════════════════════════════════════════════════
    //   THEMED BASEMENTS — Replaces the generic "2 parking lines + CEO car"
    //   with a unique, building-relevant basement for every building type.
    //   HQs are themed per AI lab; public buildings by bld.id.
    // ══════════════════════════════════════════════════════════════════════
    _drawThemedBasement(floorCont, bld, fy, floorH, colHex, shaftX, isHQ) {
        const floorY = fy + floorH - 4; // basement floor line

        // ─── Public / social buildings ─── dispatch by bld.id
        if (bld.id === 'cafe') {
            this._drawCafeRoastery(floorCont, bld, fy, floorH);
            return;
        }
        if (bld.id === 'gym') {
            this._drawGymLockers(floorCont, bld, fy, floorH);
            return;
        }
        if (bld.id === 'arena') {
            this._drawArenaDojo(floorCont, bld, fy, floorH);
            return;
        }
        if (bld.id === 'open_square' || bld.id === 'os_hub') {
            this._drawOSServerVault(floorCont, bld, fy, floorH);
            return;
        }
        if (bld.id === 'graveyard') {
            this._drawGraveyardCrypt(floorCont, bld, fy, floorH);
            return;
        }

        // ─── HQ labs ─── themed per bld.lab
        if (isHQ) {
            this._drawHQBasement(floorCont, bld, fy, floorH, colHex);
            return;
        }

        // ─── Fallback: generic parking for anything else that falls through ───
        const parkingLines = new PIXI.Graphics();
        parkingLines.lineStyle(2, 0xffffff, 0.4);
        parkingLines.moveTo(this.startX + 150, floorY);
        parkingLines.lineTo(this.startX + 120, floorY - 10);
        parkingLines.moveTo(this.startX + 250, floorY);
        parkingLines.lineTo(this.startX + 220, floorY - 10);
        floorCont.addChild(parkingLines);
    },

    // ─── CAFE: Coffee roastery + wine cellar ───
    _drawCafeRoastery(cont, bld, fy, floorH) {
        const fY = fy + floorH - 4;
        const g = new PIXI.Graphics();
        // Warm wood floor tint
        g.beginFill(0x3a2518, 0.4); g.drawRect(this.startX, fy, this.usableW, floorH); g.endFill();
        // Brick wall (back)
        for (let by = fy + 4; by < fy + floorH - 12; by += 6) {
            for (let bx = this.startX + 4; bx < this.startX + this.usableW - 4; bx += 14) {
                g.beginFill(by % 12 === 0 ? 0x4a2818 : 0x3a1f10, 0.5);
                g.drawRect(bx + (by % 12 === 0 ? 0 : 7), by, 12, 5);
                g.endFill();
            }
        }
        cont.addChild(g);

        // Coffee roasting drum (left)
        const roaster = new PIXI.Graphics();
        roaster.beginFill(0x1f1f1f); roaster.drawRect(-22, -32, 44, 30); roaster.endFill(); // body
        roaster.beginFill(0x78350f); roaster.drawCircle(0, -17, 11); roaster.endFill();     // drum
        roaster.beginFill(0xfbbf24, 0.7); roaster.drawCircle(0, -17, 6); roaster.endFill(); // flame glow
        roaster.beginFill(0x0f0f0f); roaster.drawRect(-20, -2, 8, 4); roaster.drawRect(12, -2, 8, 4); roaster.endFill(); // legs
        roaster.beginFill(0x475569); roaster.drawRect(14, -32, 4, 12); roaster.endFill();   // exhaust pipe
        roaster.x = this.startX + 70; roaster.y = fY;
        cont.addChild(roaster);
        this.indoorLights.push({ g: roaster, maxA: 0.9, type: 'fire' });

        // Burlap sacks of coffee beans (mid)
        for (let si = 0; si < 3; si++) {
            const sack = new PIXI.Graphics();
            sack.beginFill(0x78532a); sack.drawRoundedRect(-9, -16, 18, 16, 2); sack.endFill();
            sack.beginFill(0x5a3d1c); sack.drawRect(-9, -16, 18, 3); sack.endFill(); // dark top
            sack.beginFill(0x3a2510); sack.drawRect(-3, -16, 6, 2); sack.endFill();  // tie
            // Stenciled text
            sack.beginFill(0x1a0f05, 0.6); sack.drawRect(-6, -10, 12, 1); sack.drawRect(-6, -7, 10, 1); sack.endFill();
            sack.x = this.startX + 130 + si * 22; sack.y = fY;
            cont.addChild(sack);
        }

        // Oak wine barrels (right half — the "cellar" part)
        for (let bi = 0; bi < 4; bi++) {
            const barrel = new PIXI.Graphics();
            barrel.beginFill(0x3d2010); barrel.drawEllipse(0, -12, 13, 14); barrel.endFill();
            barrel.beginFill(0x5a3018); barrel.drawEllipse(0, -12, 10, 12); barrel.endFill();
            // Metal bands
            barrel.beginFill(0x64748b); barrel.drawRect(-13, -18, 26, 1.5); barrel.drawRect(-13, -12, 26, 1.5); barrel.drawRect(-13, -6, 26, 1.5); barrel.endFill();
            // Bunghole
            barrel.beginFill(0x1a0a04); barrel.drawCircle(0, -12, 1.2); barrel.endFill();
            barrel.x = this.startX + 230 + (bi % 2) * 32; barrel.y = fY - (Math.floor(bi / 2) * 26);
            cont.addChild(barrel);
        }
        // Stacked row behind them
        const barrelRack = new PIXI.Graphics();
        barrelRack.beginFill(0x2a1508); barrelRack.drawRect(this.startX + 218, fY - 54, 80, 2); barrelRack.endFill();
        barrelRack.beginFill(0x2a1508); barrelRack.drawRect(this.startX + 218, fY - 28, 80, 2); barrelRack.endFill();
        cont.addChild(barrelRack);

        // Tasting bar counter (far right)
        const counter = new PIXI.Graphics();
        counter.beginFill(0x1a0d04); counter.drawRect(-30, -16, 60, 16); counter.endFill();
        counter.beginFill(0x3a2010); counter.drawRect(-30, -16, 60, 3); counter.endFill(); // wood top
        // Wine glasses
        for (let gi = 0; gi < 3; gi++) {
            counter.beginFill(0xfde68a, 0.4); counter.drawRect(-22 + gi * 14, -22, 3, 6); counter.endFill();
            counter.beginFill(0xb91c1c, 0.6); counter.drawRect(-22 + gi * 14, -19, 3, 3); counter.endFill();
        }
        counter.x = this.startX + this.usableW - 80; counter.y = fY;
        cont.addChild(counter);

        // Hanging Edison bulbs
        for (let li = 0; li < 5; li++) {
            const bulb = new PIXI.Graphics();
            bulb.beginFill(0xfbbf24, 0.8); bulb.drawCircle(0, 0, 2); bulb.endFill();
            bulb.beginFill(0x78532a); bulb.drawRect(-0.5, -8, 1, 8); bulb.endFill();
            bulb.x = this.startX + 40 + li * (this.usableW - 80) / 4; bulb.y = fy + 14;
            cont.addChild(bulb);
            this.indoorLights.push({ g: bulb, maxA: 0.9, type: 'fire' });
        }

        // Sign
        if (typeof PIXI.Text !== 'undefined') {
            const sign = new PIXI.Text('ROASTERY & CELLAR', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xfbbf24, letterSpacing: 1 });
            sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 6;
            cont.addChild(sign);
        }
    },

    // ─── GYM: Locker rooms + sauna ───
    _drawGymLockers(cont, bld, fy, floorH) {
        const fY = fy + floorH - 4;
        const g = new PIXI.Graphics();
        // Tile floor
        g.beginFill(0x1a2a3a); g.drawRect(this.startX, fy, this.usableW, floorH); g.endFill();
        for (let tx = this.startX; tx < this.startX + this.usableW; tx += 24) {
            g.beginFill(0x0f1a2a); g.drawRect(tx, fy + floorH - 6, 24, 6); g.endFill();
            g.beginFill(0x2a3a50, 0.4); g.drawRect(tx + 1, fy + floorH - 5, 22, 1); g.endFill();
        }
        cont.addChild(g);

        // Locker bank (left half)
        for (let li = 0; li < 8; li++) {
            const locker = new PIXI.Graphics();
            const lCol = li % 2 === 0 ? 0x0891b2 : 0x0e7490;
            locker.beginFill(lCol); locker.drawRect(0, -48, 18, 48); locker.endFill();
            locker.beginFill(0x06b6d4, 0.3); locker.drawRect(1, -47, 16, 2); locker.endFill(); // top highlight
            // Handle
            locker.beginFill(0xe0f2fe); locker.drawCircle(14, -22, 1.2); locker.endFill();
            // Vents
            for (let vi = 0; vi < 3; vi++) {
                locker.beginFill(0x164e63); locker.drawRect(4 + vi * 4, -10, 2, 1); locker.endFill();
            }
            // Number
            locker.beginFill(0x83e4fd, 0.8); locker.drawRect(6, -42, 6, 4); locker.endFill();
            locker.x = this.startX + 30 + li * 20; locker.y = fY;
            cont.addChild(locker);
        }

        // Benches
        const bench = new PIXI.Graphics();
        bench.beginFill(0x78532a); bench.drawRect(this.startX + 30, fY - 10, 160, 5); bench.endFill();
        bench.beginFill(0x3a2510); bench.drawRect(this.startX + 34, fY - 5, 4, 5); bench.drawRect(this.startX + 178, fY - 5, 4, 5); bench.endFill();
        cont.addChild(bench);

        // Towel pile
        const towels = new PIXI.Graphics();
        towels.beginFill(0xf8fafc); towels.drawRect(this.startX + 210, fY - 20, 20, 5); towels.endFill();
        towels.beginFill(0xe0f2fe); towels.drawRect(this.startX + 210, fY - 15, 20, 5); towels.endFill();
        towels.beginFill(0xf8fafc); towels.drawRect(this.startX + 210, fY - 10, 20, 5); towels.endFill();
        towels.beginFill(0xbae6fd); towels.drawRect(this.startX + 210, fY - 5, 20, 5); towels.endFill();
        cont.addChild(towels);

        // Sauna (right side, cedar)
        const sauna = new PIXI.Graphics();
        sauna.beginFill(0x7c3e1a); sauna.drawRect(this.startX + this.usableW - 140, fY - 55, 130, 55); sauna.endFill();
        // Cedar plank lines
        for (let py = fY - 50; py < fY; py += 5) {
            sauna.beginFill(0x5a2a0f); sauna.drawRect(this.startX + this.usableW - 140, py, 130, 1); sauna.endFill();
        }
        // Glass door
        sauna.beginFill(0x7dd3fc, 0.3); sauna.drawRect(this.startX + this.usableW - 90, fY - 45, 30, 45); sauna.endFill();
        sauna.beginFill(0x0891b2); sauna.drawRect(this.startX + this.usableW - 64, fY - 28, 2, 4); sauna.endFill(); // handle
        // Stones on heater
        sauna.beginFill(0x1a1a1a); sauna.drawRect(this.startX + this.usableW - 132, fY - 22, 16, 16); sauna.endFill();
        sauna.beginFill(0x475569); sauna.drawCircle(this.startX + this.usableW - 127, fY - 16, 2); sauna.drawCircle(this.startX + this.usableW - 120, fY - 14, 2); sauna.drawCircle(this.startX + this.usableW - 122, fY - 19, 1.5); sauna.endFill();
        // Heat glow
        sauna.beginFill(0xef4444, 0.3); sauna.drawRect(this.startX + this.usableW - 133, fY - 26, 18, 4); sauna.endFill();
        // "SAUNA" sign
        cont.addChild(sauna);
        const saunaTxt = new PIXI.Text('SAUNA', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xfb923c, fontWeight: 'bold' });
        saunaTxt.anchor.set(0.5); saunaTxt.x = this.startX + this.usableW - 75; saunaTxt.y = fY - 60;
        cont.addChild(saunaTxt);
        this.indoorLights.push({ g: sauna, maxA: 0.8, type: 'fire' });
    },

    // ─── ARENA: Training dojo + fighter prep ───
    _drawArenaDojo(cont, bld, fy, floorH) {
        const fY = fy + floorH - 4;
        const g = new PIXI.Graphics();
        // Concrete floor
        g.beginFill(0x1a1a1a); g.drawRect(this.startX, fy, this.usableW, floorH); g.endFill();
        // Red mat area (center)
        g.beginFill(0x7f1d1d); g.drawRect(this.startX + 80, fy + floorH - 8, this.usableW - 160, 8); g.endFill();
        g.beginFill(0x450a0a); g.drawRect(this.startX + 80, fy + floorH - 8, this.usableW - 160, 1); g.endFill();
        cont.addChild(g);

        // Heavy bags hanging (left)
        for (let bi = 0; bi < 3; bi++) {
            const bag = new PIXI.Graphics();
            // Chain
            bag.beginFill(0x64748b); bag.drawRect(-1, -50, 2, 16); bag.endFill();
            // Bag body
            bag.beginFill(0x1e293b); bag.drawRoundedRect(-7, -34, 14, 32, 2); bag.endFill();
            bag.beginFill(0x0f172a); bag.drawRect(-7, -34, 14, 3); bag.endFill(); // top cap
            bag.beginFill(0xdc2626); bag.drawRect(-6, -18, 12, 2); bag.endFill(); // red accent stripe
            bag.x = this.startX + 40 + bi * 32; bag.y = fY;
            cont.addChild(bag);
        }

        // Weight rack (right of bags)
        const rack = new PIXI.Graphics();
        rack.beginFill(0x334155); rack.drawRect(this.startX + 150, fY - 38, 60, 3); rack.endFill(); // top bar
        rack.beginFill(0x334155); rack.drawRect(this.startX + 150, fY - 12, 60, 3); rack.endFill(); // lower bar
        rack.beginFill(0x475569); rack.drawRect(this.startX + 150, fY - 38, 3, 38); rack.drawRect(this.startX + 207, fY - 38, 3, 38); rack.endFill(); // posts
        // Dumbbells
        for (let di = 0; di < 5; di++) {
            rack.beginFill(0x0f172a); rack.drawRect(this.startX + 156 + di * 10, fY - 35, 8, 3); rack.endFill();
            rack.beginFill(0x1e293b); rack.drawCircle(this.startX + 156 + di * 10, fY - 33, 2); rack.drawCircle(this.startX + 164 + di * 10, fY - 33, 2); rack.endFill();
        }
        // Plate weights on lower bar
        for (let pi = 0; pi < 4; pi++) {
            rack.beginFill(0x0f172a); rack.drawCircle(this.startX + 160 + pi * 14, fY - 15, 4); rack.endFill();
            rack.beginFill(0xdc2626); rack.drawCircle(this.startX + 160 + pi * 14, fY - 15, 2); rack.endFill();
        }
        cont.addChild(rack);

        // Ice baths (cold plunge recovery)
        for (let ii = 0; ii < 2; ii++) {
            const bath = new PIXI.Graphics();
            bath.beginFill(0x475569); bath.drawRect(-18, -18, 36, 18); bath.endFill();
            bath.beginFill(0x7dd3fc, 0.6); bath.drawRect(-16, -16, 32, 14); bath.endFill();
            // Ice cubes floating
            bath.beginFill(0xf0f9ff, 0.8); bath.drawRect(-12, -14, 4, 3); bath.drawRect(-2, -12, 5, 3); bath.drawRect(8, -15, 4, 3); bath.endFill();
            // Steam puff (cold mist)
            bath.beginFill(0xffffff, 0.2); bath.drawCircle(0, -22, 6); bath.drawCircle(-6, -24, 4); bath.drawCircle(6, -24, 4); bath.endFill();
            bath.x = this.startX + 240 + ii * 44; bath.y = fY;
            cont.addChild(bath);
        }

        // Medic station (far right)
        const medic = new PIXI.Graphics();
        medic.beginFill(0xf8fafc); medic.drawRect(this.startX + this.usableW - 70, fY - 28, 50, 28); medic.endFill();
        medic.beginFill(0xdc2626); medic.drawRect(this.startX + this.usableW - 49, fY - 24, 8, 3); medic.drawRect(this.startX + this.usableW - 46, fY - 27, 2, 9); medic.endFill(); // red cross
        medic.beginFill(0x94a3b8); medic.drawRect(this.startX + this.usableW - 66, fY - 18, 42, 2); medic.endFill(); // shelf
        medic.beginFill(0xef4444); medic.drawRect(this.startX + this.usableW - 62, fY - 16, 4, 6); medic.drawRect(this.startX + this.usableW - 54, fY - 16, 4, 6); medic.endFill(); // first-aid kits
        medic.beginFill(0x1e293b); medic.drawRect(this.startX + this.usableW - 46, fY - 16, 4, 6); medic.endFill();
        cont.addChild(medic);

        // Hanging spotlight
        const spot = new PIXI.Graphics();
        spot.beginFill(0x1a1a1a); spot.drawRect(-6, 0, 12, 4); spot.endFill();
        spot.beginFill(0xfbbf24, 0.3); spot.drawPolygon([-6, 4, 6, 4, 18, 60, -18, 60]); spot.endFill();
        spot.x = this.startX + this.usableW / 2; spot.y = fy + 2;
        cont.addChild(spot);
        this.indoorLights.push({ g: spot, maxA: 0.6, type: 'ceiling' });
    },

    // ─── OPEN SQUARE / OS HUB: Server room + cable vault ───
    _drawOSServerVault(cont, bld, fy, floorH) {
        const fY = fy + floorH - 4;
        const g = new PIXI.Graphics();
        // Raised floor tint
        g.beginFill(0x0a0a14); g.drawRect(this.startX, fy, this.usableW, floorH); g.endFill();
        // Floor tile grid (raised floor for cable routing)
        for (let tx = this.startX; tx < this.startX + this.usableW; tx += 20) {
            g.beginFill(0x1a1a28, 0.4); g.drawRect(tx, fy + floorH - 6, 20, 1); g.endFill();
            g.beginFill(0x0a0a18); g.drawRect(tx, fy + floorH - 4, 1, 4); g.endFill();
        }
        cont.addChild(g);

        // Server rack rows
        for (let r = 0; r < 2; r++) {
            for (let ri = 0; ri < 5; ri++) {
                const rack = new PIXI.Graphics();
                rack.beginFill(0x1e293b); rack.drawRect(0, -44, 22, 44); rack.endFill();
                rack.beginFill(0x0f172a); rack.drawRect(1, -43, 20, 42); rack.endFill();
                // Blinking LEDs
                for (let li = 0; li < 8; li++) {
                    const col = [0x22c55e, 0xf59e0b, 0x22d3ee][li % 3];
                    rack.beginFill(col, 0.8); rack.drawRect(3, -40 + li * 5, 2, 2); rack.endFill();
                    rack.beginFill(0x475569); rack.drawRect(7, -40 + li * 5, 14, 1); rack.endFill();
                }
                // Top status
                rack.beginFill(0x22c55e, 0.9); rack.drawRect(2, -43, 18, 1); rack.endFill();
                rack.x = this.startX + 50 + ri * 30; rack.y = fY - r * 10;
                cont.addChild(rack);
                this.indoorLights.push({ g: rack, maxA: 0.9, type: 'server' });
            }
        }

        // Patch panel on back wall
        const panel = new PIXI.Graphics();
        panel.beginFill(0x0f172a); panel.drawRect(this.startX + this.usableW - 110, fy + 10, 90, 36); panel.endFill();
        panel.beginFill(0x1e293b); panel.drawRect(this.startX + this.usableW - 108, fy + 12, 86, 32); panel.endFill();
        // Patch cables (colored loops)
        const cableCols = [0x22d3ee, 0xef4444, 0x22c55e, 0xfbbf24, 0xa855f7, 0xec4899];
        for (let ci = 0; ci < 12; ci++) {
            const col = cableCols[ci % cableCols.length];
            panel.lineStyle(1.5, col, 0.7);
            panel.moveTo(this.startX + this.usableW - 105 + ci * 7, fy + 16);
            panel.lineTo(this.startX + this.usableW - 105 + ci * 7 + 3, fy + 22);
            panel.lineTo(this.startX + this.usableW - 105 + ci * 7, fy + 28);
            panel.lineTo(this.startX + this.usableW - 105 + ci * 7 - 3, fy + 38);
        }
        panel.lineStyle(0);
        cont.addChild(panel);

        // "OPEN SOURCE CORE" sign
        const sign = new PIXI.Text('OPEN SOURCE CORE', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x22c55e, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // ─── GRAVEYARD: Crypt / memorial vault ───
    _drawGraveyardCrypt(cont, bld, fy, floorH) {
        const fY = fy + floorH - 4;
        const g = new PIXI.Graphics();
        // Stone floor
        g.beginFill(0x1a1a1e); g.drawRect(this.startX, fy, this.usableW, floorH); g.endFill();
        for (let bx = this.startX; bx < this.startX + this.usableW; bx += 28) {
            for (let by = fy + 2; by < fy + floorH; by += 14) {
                g.beginFill(0x0f0f12); g.drawRect(bx, by, 28, 1); g.endFill();
                g.beginFill(0x0f0f12); g.drawRect(bx, by, 1, 14); g.endFill();
            }
        }
        cont.addChild(g);

        // Urn niches in back wall
        for (let ni = 0; ni < 6; ni++) {
            const niche = new PIXI.Graphics();
            niche.beginFill(0x0a0a0e); niche.drawRect(0, -40, 24, 38); niche.endFill();
            niche.beginFill(0x1e1e28); niche.drawRect(2, -38, 20, 34); niche.endFill();
            // Urn
            niche.beginFill(0x475569); niche.drawEllipse(12, -18, 6, 10); niche.endFill();
            niche.beginFill(0x64748b); niche.drawRect(9, -28, 6, 2); niche.endFill(); // neck
            niche.beginFill(0x94a3b8); niche.drawRect(7, -30, 10, 1); niche.endFill(); // rim
            // Nameplate
            niche.beginFill(0x3a3a44); niche.drawRect(4, -6, 16, 3); niche.endFill();
            niche.x = this.startX + 30 + ni * 32; niche.y = fY;
            cont.addChild(niche);
        }

        // Candles with flickering flames
        for (let ci = 0; ci < 5; ci++) {
            const candle = new PIXI.Graphics();
            candle.beginFill(0xf8fafc); candle.drawRect(-1.5, -8, 3, 8); candle.endFill();
            candle.beginFill(0xfbbf24, 0.9); candle.drawRect(-0.5, -12, 1, 4); candle.endFill();
            candle.beginFill(0xfef3c7, 0.4); candle.drawCircle(0, -11, 3); candle.endFill();
            candle.x = this.startX + 240 + ci * 28; candle.y = fY;
            cont.addChild(candle);
            this.indoorLights.push({ g: candle, maxA: 0.9, type: 'fire' });
        }

        // Memorial plaque (center)
        const plaque = new PIXI.Graphics();
        plaque.beginFill(0x1a1a24); plaque.drawRect(-40, -22, 80, 22); plaque.endFill();
        plaque.beginFill(0x2a2a34); plaque.drawRect(-38, -20, 76, 18); plaque.endFill();
        plaque.x = this.startX + this.usableW - 70; plaque.y = fY;
        cont.addChild(plaque);
        const plaqueTxt = new PIXI.Text('IN MEMORIAM', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x94a3b8, letterSpacing: 1 });
        plaqueTxt.anchor.set(0.5); plaqueTxt.x = this.startX + this.usableW - 70; plaqueTxt.y = fY - 14;
        cont.addChild(plaqueTxt);
    },

    // ─── HQ BASEMENT: Themed per AI lab ───
    _drawHQBasement(cont, bld, fy, floorH, colHex) {
        const fY = fy + floorH - 4;
        const labId = bld.lab;

        // Every HQ gets a concrete floor + low lighting as a base
        const floor = new PIXI.Graphics();
        floor.beginFill(0x0a0a12); floor.drawRect(this.startX, fy, this.usableW, floorH); floor.endFill();
        cont.addChild(floor);

        // Dispatch to lab theme
        if (labId === 'openai') {
            this._hqBunker_openai(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'anthropic') {
            this._hqBunker_anthropic(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'google') {
            this._hqBunker_google(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'meta') {
            this._hqBunker_meta(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'xai') {
            this._hqBunker_xai(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'mistral') {
            this._hqBunker_mistral(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'deepseek') {
            this._hqBunker_deepseek(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'alibaba') {
            this._hqBunker_alibaba(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'nvidia') {
            this._hqBunker_nvidia(cont, bld, fy, floorH, fY, colHex);
        } else if (labId === 'microsoft') {
            this._hqBunker_microsoft(cont, bld, fy, floorH, fY, colHex);
        } else {
            this._hqBunker_generic(cont, bld, fy, floorH, fY, colHex);
        }

        // All HQs keep the CEO parking spot (tracked by ceoRefs) on the right side
        if (G.ceoRefs && G.ceoRefs[bld.lab]) {
            const ceoRef = G.ceoRefs[bld.lab];
            // Subtle parking floor paint at CEO spot
            const spot = new PIXI.Graphics();
            spot.lineStyle(1.5, 0xfbbf24, 0.3);
            spot.drawRect(this.startX + this.usableW - 60, fY - 22, 52, 20);
            spot.lineStyle(0);
            cont.addChild(spot);
            this.ceoCarGfx = this.drawCar(cont, this.startX + this.usableW - 34, fY, colHex);
            this.ceoCarGfx.visible = (ceoRef.bld === bld.id);
        }
    },

    // OpenAI: GPU cold storage bunker — H100 racks + LN2 + retinal scanner vault door
    _hqBunker_openai(cont, bld, fy, floorH, fY, colHex) {
        // Vault door (left)
        const door = new PIXI.Graphics();
        door.beginFill(0x334155); door.drawCircle(this.startX + 50, fY - 22, 20); door.endFill();
        door.beginFill(0x1e293b); door.drawCircle(this.startX + 50, fY - 22, 17); door.endFill();
        door.beginFill(0x475569); door.drawCircle(this.startX + 50, fY - 22, 6); door.endFill();
        door.lineStyle(2, 0x64748b); door.drawCircle(this.startX + 50, fY - 22, 17); door.lineStyle(0);
        // Retinal scanner
        door.beginFill(0x0f172a); door.drawRect(this.startX + 72, fY - 30, 10, 14); door.endFill();
        door.beginFill(0xef4444, 0.7); door.drawRect(this.startX + 74, fY - 26, 6, 6); door.endFill();
        cont.addChild(door);

        // H100 GPU rack rows
        for (let ri = 0; ri < 6; ri++) {
            const rack = new PIXI.Graphics();
            rack.beginFill(0x1e293b); rack.drawRect(0, -46, 24, 46); rack.endFill();
            // GPU slots
            for (let gi = 0; gi < 8; gi++) {
                rack.beginFill(0x0a0f1a); rack.drawRect(2, -44 + gi * 5, 20, 4); rack.endFill();
                rack.beginFill(0x76b900); rack.drawRect(3, -43 + gi * 5, 2, 2); rack.endFill(); // NV green
                rack.beginFill(0x22c55e, 0.7); rack.drawRect(18, -43 + gi * 5, 2, 1); rack.endFill();
            }
            rack.x = this.startX + 100 + ri * 32; rack.y = fY;
            cont.addChild(rack);
            this.indoorLights.push({ g: rack, maxA: 0.9, type: 'server' });
        }

        // LN2 cooling pipes overhead
        const pipes = new PIXI.Graphics();
        pipes.beginFill(0xcbd5e1); pipes.drawRect(this.startX + 90, fy + 8, 220, 3); pipes.endFill();
        pipes.beginFill(0x7dd3fc, 0.5); pipes.drawRect(this.startX + 90, fy + 11, 220, 1); pipes.endFill();
        // Frost droplets
        for (let di = 0; di < 6; di++) {
            pipes.beginFill(0xf0f9ff, 0.6); pipes.drawCircle(this.startX + 110 + di * 32, fy + 14, 1); pipes.endFill();
        }
        cont.addChild(pipes);

        const sign = new PIXI.Text('GPU COLD VAULT', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x10a37f, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Anthropic: Constitutional archive vault — sealed tomes + red-team war room
    _hqBunker_anthropic(cont, bld, fy, floorH, fY, colHex) {
        // Archive bookshelves (left)
        for (let si = 0; si < 4; si++) {
            const shelf = new PIXI.Graphics();
            shelf.beginFill(0x78532a); shelf.drawRect(0, -50, 60, 50); shelf.endFill();
            shelf.beginFill(0x5a3018); shelf.drawRect(0, -50, 60, 2); shelf.drawRect(0, -34, 60, 2); shelf.drawRect(0, -18, 60, 2); shelf.drawRect(0, -2, 60, 2); shelf.endFill();
            // Books (amber-toned, academic)
            const bkCols = [0xd97706, 0xb45309, 0x78350f, 0x92400e, 0xa16207];
            for (let bi = 0; bi < 10; bi++) {
                shelf.beginFill(bkCols[bi % bkCols.length]); shelf.drawRect(2 + bi * 5.5, -48, 5, 14); shelf.endFill();
                shelf.beginFill(bkCols[(bi + 2) % bkCols.length]); shelf.drawRect(2 + bi * 5.5, -32, 5, 14); shelf.endFill();
                shelf.beginFill(bkCols[(bi + 3) % bkCols.length]); shelf.drawRect(2 + bi * 5.5, -16, 5, 14); shelf.endFill();
            }
            shelf.x = this.startX + 20 + si * 50; shelf.y = fY;
            cont.addChild(shelf);
        }

        // Red-team war room (right half): round table + terminal screens
        const table = new PIXI.Graphics();
        table.beginFill(0x3a2510); table.drawEllipse(0, 0, 40, 14); table.endFill();
        table.beginFill(0x5a3a20); table.drawEllipse(0, -2, 38, 12); table.endFill();
        table.x = this.startX + this.usableW - 100; table.y = fY - 8;
        cont.addChild(table);
        // Terminal screens around table
        for (let ti = 0; ti < 4; ti++) {
            const screen = new PIXI.Graphics();
            screen.beginFill(0x0f172a); screen.drawRect(-10, -12, 20, 12); screen.endFill();
            const red = ti % 2 === 0;
            screen.beginFill(red ? 0xef4444 : 0xd97706, 0.7); screen.drawRect(-8, -10, 16, 2); screen.endFill();
            screen.beginFill(red ? 0xdc2626 : 0xb45309, 0.5); screen.drawRect(-8, -7, 12, 1); screen.drawRect(-8, -5, 10, 1); screen.drawRect(-8, -3, 14, 1); screen.endFill();
            const angle = (ti / 4) * Math.PI * 2;
            screen.x = this.startX + this.usableW - 100 + Math.cos(angle) * 35;
            screen.y = fY - 8 + Math.sin(angle) * 18 - 8;
            cont.addChild(screen);
            this.indoorLights.push({ g: screen, maxA: 0.8, type: 'screen' });
        }

        const sign = new PIXI.Text('CONSTITUTIONAL ARCHIVE', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xd97706, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Google: Knowledge graph cold storage — filing cabinets + TPU pods
    _hqBunker_google(cont, bld, fy, floorH, fY, colHex) {
        // Endless filing cabinets (left)
        for (let ci = 0; ci < 7; ci++) {
            const cab = new PIXI.Graphics();
            const col = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853][ci % 4];
            cab.beginFill(col); cab.drawRect(0, -44, 22, 44); cab.endFill();
            cab.beginFill(0xf8fafc, 0.15); cab.drawRect(2, -42, 18, 2); cab.endFill();
            // Drawer divisions
            for (let di = 0; di < 4; di++) {
                cab.beginFill(0x0f172a, 0.4); cab.drawRect(0, -44 + di * 11, 22, 1); cab.endFill();
                cab.beginFill(0xf8fafc); cab.drawRect(9, -40 + di * 11, 4, 1); cab.endFill(); // handle
            }
            cab.x = this.startX + 30 + ci * 28; cab.y = fY;
            cont.addChild(cab);
        }

        // TPU pod (right)
        const tpu = new PIXI.Graphics();
        tpu.beginFill(0x0f172a); tpu.drawRect(0, -50, 120, 50); tpu.endFill();
        tpu.beginFill(0x1e293b); tpu.drawRect(2, -48, 116, 46); tpu.endFill();
        // TPU chips
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                tpu.beginFill(0x4285f4, 0.8); tpu.drawRect(8 + c * 14, -44 + r * 11, 10, 6); tpu.endFill();
                tpu.beginFill(0xfbbc04, 0.9); tpu.drawCircle(13 + c * 14, -41 + r * 11, 0.8); tpu.endFill();
            }
        }
        tpu.x = this.startX + this.usableW - 170; tpu.y = fY;
        cont.addChild(tpu);
        this.indoorLights.push({ g: tpu, maxA: 0.9, type: 'server' });
        // "TPU" label
        const tpuLbl = new PIXI.Text('TPU v5', { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0x4285f4 });
        tpuLbl.anchor.set(0.5); tpuLbl.x = this.startX + this.usableW - 110; tpuLbl.y = fY - 55;
        cont.addChild(tpuLbl);

        const sign = new PIXI.Text('KNOWLEDGE GRAPH ARCHIVE', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x4285f4, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Meta: Open-weights library — torrent seed rack + Llama crates
    _hqBunker_meta(cont, bld, fy, floorH, fY, colHex) {
        // Torrent seed rack
        const seed = new PIXI.Graphics();
        seed.beginFill(0x1e293b); seed.drawRect(0, -50, 100, 50); seed.endFill();
        seed.beginFill(0x0f172a); seed.drawRect(2, -48, 96, 46); seed.endFill();
        // Upload progress bars
        for (let r = 0; r < 6; r++) {
            const progress = 0.4 + (r * 0.1);
            seed.beginFill(0x1877f2, 0.3); seed.drawRect(6, -44 + r * 7, 88, 4); seed.endFill();
            seed.beginFill(0x1877f2, 0.9); seed.drawRect(6, -44 + r * 7, 88 * progress, 4); seed.endFill();
            seed.beginFill(0x22c55e); seed.drawCircle(3, -42 + r * 7, 1); seed.endFill();
        }
        seed.x = this.startX + 30; seed.y = fY;
        cont.addChild(seed);
        this.indoorLights.push({ g: seed, maxA: 0.9, type: 'screen' });

        // Llama model crates (wood, stenciled)
        for (let ci = 0; ci < 4; ci++) {
            const crate = new PIXI.Graphics();
            crate.beginFill(0x78532a); crate.drawRect(0, -26, 34, 26); crate.endFill();
            crate.beginFill(0x5a3d1c); crate.drawRect(0, -26, 34, 2); crate.drawRect(0, -14, 34, 2); crate.endFill();
            // Wood plank lines
            for (let px = 6; px < 34; px += 8) {
                crate.beginFill(0x3a2510, 0.4); crate.drawRect(px, -26, 1, 26); crate.endFill();
            }
            // Stencil
            crate.beginFill(0xfbbf24, 0.8); crate.drawRect(4, -10, 26, 1); crate.drawRect(4, -8, 20, 1); crate.endFill();
            crate.x = this.startX + 150 + (ci % 2) * 40; crate.y = fY - Math.floor(ci / 2) * 28;
            cont.addChild(crate);
        }

        // VR headsets on shelf (right)
        const shelf = new PIXI.Graphics();
        shelf.beginFill(0x475569); shelf.drawRect(this.startX + this.usableW - 100, fY - 20, 80, 2); shelf.endFill();
        for (let vi = 0; vi < 3; vi++) {
            shelf.beginFill(0x1e293b); shelf.drawRect(this.startX + this.usableW - 92 + vi * 24, fY - 32, 18, 12); shelf.endFill();
            shelf.beginFill(0x1877f2, 0.4); shelf.drawRect(this.startX + this.usableW - 90 + vi * 24, fY - 30, 14, 4); shelf.endFill();
            shelf.beginFill(0x0f172a); shelf.drawRect(this.startX + this.usableW - 92 + vi * 24, fY - 34, 18, 2); shelf.endFill();
        }
        cont.addChild(shelf);

        const sign = new PIXI.Text('OPEN WEIGHTS LIBRARY', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x1877f2, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // xAI: Rocket-fuel substation — Elon memorabilia + Grok tokens
    _hqBunker_xai(cont, bld, fy, floorH, fY, colHex) {
        // Fuel tanks (left)
        for (let ti = 0; ti < 3; ti++) {
            const tank = new PIXI.Graphics();
            tank.beginFill(0x1e293b); tank.drawEllipse(0, -14, 14, 6); tank.endFill(); // top
            tank.beginFill(0x334155); tank.drawRect(-14, -14, 28, 30); tank.endFill(); // body
            tank.beginFill(0x0f172a); tank.drawEllipse(0, 16, 14, 4); tank.endFill(); // bottom
            // Warning stripe
            tank.beginFill(0xfbbf24); tank.drawRect(-14, -4, 28, 3); tank.endFill();
            tank.beginFill(0x0f172a); tank.drawRect(-14, -4, 28, 1); tank.endFill();
            // Label
            tank.beginFill(0xef4444, 0.8); tank.drawRect(-8, 2, 16, 3); tank.endFill();
            tank.x = this.startX + 40 + ti * 40; tank.y = fY - 20;
            cont.addChild(tank);
        }

        // Pipes running between tanks
        const pipes = new PIXI.Graphics();
        pipes.beginFill(0x64748b); pipes.drawRect(this.startX + 30, fY - 8, 120, 3); pipes.endFill();
        pipes.beginFill(0x475569); pipes.drawRect(this.startX + 30, fY - 5, 120, 1); pipes.endFill();
        cont.addChild(pipes);

        // Starship model display (center)
        const rocket = new PIXI.Graphics();
        rocket.beginFill(0xcbd5e1); rocket.drawRect(-3, -46, 6, 40); rocket.endFill();
        rocket.beginFill(0xe0e7ff); rocket.drawPolygon([-3, -46, 3, -46, 0, -54]); rocket.endFill();
        rocket.beginFill(0x1e293b); rocket.drawRect(-4, -6, 8, 2); rocket.drawPolygon([-4, -6, -8, 0, -4, 0]); rocket.drawPolygon([4, -6, 8, 0, 4, 0]); rocket.endFill();
        rocket.beginFill(0xef4444, 0.7); rocket.drawRect(-2, -2, 4, 6); rocket.endFill(); // exhaust glow
        rocket.x = this.startX + this.usableW / 2; rocket.y = fY;
        cont.addChild(rocket);
        // Pedestal
        const pedestal = new PIXI.Graphics();
        pedestal.beginFill(0x1a1a1a); pedestal.drawRect(this.startX + this.usableW / 2 - 12, fY - 4, 24, 4); pedestal.endFill();
        cont.addChild(pedestal);

        // Grok token "tokens per second" counter
        const counter = new PIXI.Graphics();
        counter.beginFill(0x0f172a); counter.drawRect(this.startX + this.usableW - 80, fY - 30, 60, 28); counter.endFill();
        counter.beginFill(0x000000); counter.drawRect(this.startX + this.usableW - 78, fY - 28, 56, 24); counter.endFill();
        // Fake readout
        counter.beginFill(0xfbbf24, 0.9); counter.drawRect(this.startX + this.usableW - 74, fY - 24, 48, 3); counter.endFill();
        counter.beginFill(0xfbbf24, 0.6); counter.drawRect(this.startX + this.usableW - 74, fY - 18, 36, 2); counter.drawRect(this.startX + this.usableW - 74, fY - 14, 42, 2); counter.drawRect(this.startX + this.usableW - 74, fY - 10, 30, 2); counter.endFill();
        cont.addChild(counter);
        this.indoorLights.push({ g: counter, maxA: 0.9, type: 'screen' });

        const sign = new PIXI.Text('XAI FUEL DEPOT', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xfbbf24, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Mistral: French wine cave + model weights in oak barrels
    _hqBunker_mistral(cont, bld, fy, floorH, fY, colHex) {
        // Stone arch ceiling
        const arch = new PIXI.Graphics();
        arch.beginFill(0x3a3228); arch.drawRect(this.startX + 4, fy + 2, this.usableW - 8, 14); arch.endFill();
        for (let ax = this.startX + 8; ax < this.startX + this.usableW - 8; ax += 18) {
            arch.beginFill(0x1a1a1a, 0.4); arch.drawRect(ax, fy + 2, 1, 14); arch.endFill();
        }
        cont.addChild(arch);

        // Oak barrel stacks (3 rows)
        for (let r = 0; r < 3; r++) {
            for (let bi = 0; bi < 6; bi++) {
                const barrel = new PIXI.Graphics();
                barrel.beginFill(0x3d2010); barrel.drawEllipse(0, 0, 14, 15); barrel.endFill();
                barrel.beginFill(0x5a3018); barrel.drawEllipse(0, 0, 11, 13); barrel.endFill();
                // Bands
                barrel.beginFill(0x64748b); barrel.drawRect(-14, -7, 28, 1.5); barrel.drawRect(-14, 0, 28, 1.5); barrel.drawRect(-14, 7, 28, 1.5); barrel.endFill();
                // Mistral logo (brand)
                barrel.beginFill(0xff7000); barrel.drawRect(-4, -3, 8, 1); barrel.drawRect(-4, -1, 6, 1); barrel.drawRect(-4, 1, 8, 1); barrel.endFill();
                barrel.x = this.startX + 50 + bi * 32;
                barrel.y = fY - 14 - r * 24;
                cont.addChild(barrel);
            }
            // Rack shelf
            const rack = new PIXI.Graphics();
            rack.beginFill(0x2a1508); rack.drawRect(this.startX + 30, fY - 2 - r * 24, 200, 2); rack.endFill();
            cont.addChild(rack);
        }

        // Tasting table
        const table = new PIXI.Graphics();
        table.beginFill(0x1a0d04); table.drawRect(-30, -14, 60, 14); table.endFill();
        table.beginFill(0x3a2010); table.drawRect(-30, -14, 60, 2); table.endFill();
        // Glasses of red
        for (let gi = 0; gi < 4; gi++) {
            table.beginFill(0xfde68a, 0.3); table.drawRect(-22 + gi * 12, -20, 3, 6); table.endFill();
            table.beginFill(0x7f1d1d); table.drawRect(-22 + gi * 12, -17, 3, 3); table.endFill();
        }
        table.x = this.startX + this.usableW - 80; table.y = fY;
        cont.addChild(table);

        // Hanging cellar lamp
        const lamp = new PIXI.Graphics();
        lamp.beginFill(0x1a1a1a); lamp.drawRect(-0.5, 0, 1, 10); lamp.endFill();
        lamp.beginFill(0xfbbf24, 0.8); lamp.drawCircle(0, 14, 3); lamp.endFill();
        lamp.beginFill(0xfef3c7, 0.3); lamp.drawCircle(0, 14, 6); lamp.endFill();
        lamp.x = this.startX + this.usableW / 2; lamp.y = fy + 14;
        cont.addChild(lamp);
        this.indoorLights.push({ g: lamp, maxA: 0.8, type: 'fire' });

        const sign = new PIXI.Text('LA CAVE DE MISTRAL', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xff7000, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // DeepSeek: Stealth minimalist basement — one lone rack + red lanterns
    _hqBunker_deepseek(cont, bld, fy, floorH, fY, colHex) {
        // Mostly empty space, polished floor
        const sheen = new PIXI.Graphics();
        sheen.beginFill(0x111118); sheen.drawRect(this.startX, fy, this.usableW, floorH); sheen.endFill();
        sheen.beginFill(0x1e1e28, 0.6); sheen.drawRect(this.startX, fy + floorH - 10, this.usableW, 4); sheen.endFill();
        cont.addChild(sheen);

        // One lone server rack in center
        const rack = new PIXI.Graphics();
        rack.beginFill(0x1e293b); rack.drawRect(-14, -50, 28, 50); rack.endFill();
        rack.beginFill(0x0f172a); rack.drawRect(-13, -49, 26, 48); rack.endFill();
        // Minimal LEDs — just a few
        rack.beginFill(0xef4444, 0.9); rack.drawRect(-10, -45, 2, 2); rack.endFill();
        rack.beginFill(0x22c55e, 0.8); rack.drawRect(-10, -38, 2, 2); rack.endFill();
        rack.beginFill(0xef4444, 0.9); rack.drawRect(-10, -20, 2, 2); rack.endFill();
        rack.x = this.startX + this.usableW / 2; rack.y = fY;
        cont.addChild(rack);
        this.indoorLights.push({ g: rack, maxA: 0.7, type: 'server' });

        // Red paper lanterns hanging (4)
        for (let li = 0; li < 4; li++) {
            const lantern = new PIXI.Graphics();
            lantern.beginFill(0x1a1a1a); lantern.drawRect(-0.5, 0, 1, 12); lantern.endFill();
            lantern.beginFill(0xdc2626); lantern.drawEllipse(0, 18, 6, 8); lantern.endFill();
            lantern.beginFill(0xef4444, 0.5); lantern.drawEllipse(0, 18, 4, 6); lantern.endFill();
            lantern.beginFill(0xfbbf24); lantern.drawRect(-0.5, 26, 1, 3); lantern.endFill(); // tassel
            lantern.x = this.startX + 50 + li * ((this.usableW - 100) / 3);
            lantern.y = fy + 10;
            cont.addChild(lantern);
            this.indoorLights.push({ g: lantern, maxA: 0.7, type: 'fire' });
        }

        // Subtle dragon mural on back wall
        const mural = new PIXI.Graphics();
        mural.beginFill(0x2a1018, 0.4);
        for (let mx = this.startX + 40; mx < this.startX + this.usableW - 40; mx += 8) {
            mural.drawCircle(mx, fy + 30 + Math.sin(mx * 0.1) * 6, 2);
        }
        mural.endFill();
        cont.addChild(mural);

        const sign = new PIXI.Text('深度求索', { fontFamily: 'sans-serif', fontSize: 8, fill: 0xef4444, fontWeight: 'bold', letterSpacing: 2 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Alibaba: Silk road archive — jade model tablets + paper lanterns + abacus
    _hqBunker_alibaba(cont, bld, fy, floorH, fY, colHex) {
        // Wood floor
        const wood = new PIXI.Graphics();
        wood.beginFill(0x5a3018); wood.drawRect(this.startX, fy, this.usableW, floorH); wood.endFill();
        for (let wx = this.startX; wx < this.startX + this.usableW; wx += 16) {
            wood.beginFill(0x3a1f10, 0.5); wood.drawRect(wx, fy, 1, floorH); wood.endFill();
        }
        cont.addChild(wood);

        // Jade tablets on display shelves
        for (let r = 0; r < 3; r++) {
            const shelf = new PIXI.Graphics();
            shelf.beginFill(0x78350f); shelf.drawRect(this.startX + 30, fY - 18 - r * 20, 180, 2); shelf.endFill();
            cont.addChild(shelf);
            for (let ti = 0; ti < 6; ti++) {
                const tablet = new PIXI.Graphics();
                tablet.beginFill(0x065f46); tablet.drawRect(0, -14, 12, 14); tablet.endFill();
                tablet.beginFill(0x10b981, 0.6); tablet.drawRect(1, -13, 10, 12); tablet.endFill();
                // Character carving
                tablet.beginFill(0x022c22); tablet.drawRect(3, -10, 6, 1); tablet.drawRect(3, -8, 4, 1); tablet.drawRect(3, -6, 6, 1); tablet.endFill();
                tablet.x = this.startX + 38 + ti * 30;
                tablet.y = fY - 18 - r * 20;
                cont.addChild(tablet);
            }
        }

        // Giant abacus (right)
        const abacus = new PIXI.Graphics();
        abacus.beginFill(0x78350f); abacus.drawRect(this.startX + this.usableW - 100, fY - 44, 80, 44); abacus.endFill();
        abacus.beginFill(0x5a2a0a); abacus.drawRect(this.startX + this.usableW - 98, fY - 42, 76, 40); abacus.endFill();
        // Rods + beads
        for (let rod = 0; rod < 5; rod++) {
            abacus.beginFill(0x92400e); abacus.drawRect(this.startX + this.usableW - 92 + rod * 15, fY - 40, 1, 36); abacus.endFill();
            for (let bd = 0; bd < 7; bd++) {
                abacus.beginFill(0xfbbf24); abacus.drawCircle(this.startX + this.usableW - 91.5 + rod * 15, fY - 38 + bd * 5, 1.5); abacus.endFill();
            }
        }
        cont.addChild(abacus);

        // Paper lanterns (orange-red)
        for (let li = 0; li < 3; li++) {
            const lantern = new PIXI.Graphics();
            lantern.beginFill(0x1a1a1a); lantern.drawRect(-0.5, 0, 1, 10); lantern.endFill();
            lantern.beginFill(0xf97316); lantern.drawEllipse(0, 15, 5, 7); lantern.endFill();
            lantern.beginFill(0xfb923c, 0.6); lantern.drawEllipse(0, 15, 3, 5); lantern.endFill();
            lantern.x = this.startX + 80 + li * 60; lantern.y = fy + 8;
            cont.addChild(lantern);
            this.indoorLights.push({ g: lantern, maxA: 0.8, type: 'fire' });
        }

        const sign = new PIXI.Text('丝绸之路档案', { fontFamily: 'sans-serif', fontSize: 7, fill: 0xf97316, fontWeight: 'bold', letterSpacing: 2 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Nvidia: GPU foundry floor — silicon wafer bins + probe station
    _hqBunker_nvidia(cont, bld, fy, floorH, fY, colHex) {
        // Clean-room green tint floor
        const floor = new PIXI.Graphics();
        floor.beginFill(0x052e16, 0.5); floor.drawRect(this.startX, fy, this.usableW, floorH); floor.endFill();
        cont.addChild(floor);

        // Wafer storage bins (circular silicon wafers)
        for (let bi = 0; bi < 4; bi++) {
            const bin = new PIXI.Graphics();
            bin.beginFill(0x1e293b); bin.drawRect(-18, -28, 36, 28); bin.endFill();
            bin.beginFill(0x0f172a); bin.drawRect(-16, -26, 32, 24); bin.endFill();
            // Wafers (edge-on stack)
            for (let wi = 0; wi < 5; wi++) {
                bin.beginFill(0x76b900, 0.7); bin.drawCircle(0, -22 + wi * 4, 12); bin.endFill();
                bin.beginFill(0x4d7c0f, 0.6); bin.drawCircle(0, -22 + wi * 4, 10); bin.endFill();
            }
            bin.x = this.startX + 50 + bi * 50; bin.y = fY;
            cont.addChild(bin);
        }

        // Probe station
        const probe = new PIXI.Graphics();
        probe.beginFill(0xcbd5e1); probe.drawRect(-30, -40, 60, 40); probe.endFill();
        probe.beginFill(0xf1f5f9); probe.drawRect(-28, -38, 56, 36); probe.endFill();
        probe.beginFill(0x0f172a); probe.drawRect(-20, -30, 40, 20); probe.endFill();
        // Microscope arm
        probe.beginFill(0x475569); probe.drawRect(-2, -38, 4, 18); probe.drawRect(-8, -22, 16, 4); probe.endFill();
        probe.beginFill(0x76b900); probe.drawCircle(0, -18, 2); probe.endFill();
        probe.x = this.startX + this.usableW - 90; probe.y = fY;
        cont.addChild(probe);
        this.indoorLights.push({ g: probe, maxA: 0.8, type: 'screen' });

        const sign = new PIXI.Text('WAFER VAULT', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x76b900, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Microsoft: Azure cold storage — blue tape library + HoloLens display
    _hqBunker_microsoft(cont, bld, fy, floorH, fY, colHex) {
        // Tape library (LTO cassettes in rows)
        for (let r = 0; r < 3; r++) {
            for (let ti = 0; ti < 8; ti++) {
                const tape = new PIXI.Graphics();
                tape.beginFill(0x1e40af); tape.drawRect(0, -7, 22, 7); tape.endFill();
                tape.beginFill(0x3b82f6); tape.drawRect(1, -6, 20, 2); tape.endFill();
                tape.beginFill(0x0f172a); tape.drawCircle(6, -3, 1.5); tape.drawCircle(16, -3, 1.5); tape.endFill();
                tape.beginFill(0xf8fafc, 0.6); tape.drawRect(4, -5, 14, 1); tape.endFill(); // label
                tape.x = this.startX + 30 + ti * 26;
                tape.y = fY - 8 - r * 10;
                cont.addChild(tape);
            }
        }

        // Tape shelves (support)
        for (let r = 0; r < 3; r++) {
            const shelf = new PIXI.Graphics();
            shelf.beginFill(0x64748b); shelf.drawRect(this.startX + 25, fY - 1 - r * 10, 210, 2); shelf.endFill();
            cont.addChild(shelf);
        }

        // HoloLens display case
        const holo = new PIXI.Graphics();
        holo.beginFill(0x1e293b); holo.drawRect(this.startX + this.usableW - 100, fY - 50, 80, 50); holo.endFill();
        holo.beginFill(0x0f172a); holo.drawRect(this.startX + this.usableW - 98, fY - 48, 76, 46); holo.endFill();
        holo.beginFill(0x7dd3fc, 0.3); holo.drawRect(this.startX + this.usableW - 96, fY - 46, 72, 42); holo.endFill();
        // HoloLens headset silhouette
        holo.beginFill(0x334155); holo.drawRoundedRect(this.startX + this.usableW - 85, fY - 32, 50, 10, 4); holo.endFill();
        holo.beginFill(0x0ea5e9, 0.6); holo.drawRect(this.startX + this.usableW - 82, fY - 30, 44, 2); holo.endFill();
        cont.addChild(holo);
        this.indoorLights.push({ g: holo, maxA: 0.8, type: 'screen' });

        const sign = new PIXI.Text('AZURE COLD TIER', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x0ea5e9, fontWeight: 'bold', letterSpacing: 1 });
        sign.anchor.set(0.5, 0); sign.x = this.startX + this.usableW / 2; sign.y = fy + 4;
        cont.addChild(sign);
    },

    // Generic fallback: parking + cold storage mix
    _hqBunker_generic(cont, bld, fy, floorH, fY, colHex) {
        // Parking lines on left half
        const parking = new PIXI.Graphics();
        parking.lineStyle(2, 0xffffff, 0.4);
        parking.moveTo(this.startX + 80, fY); parking.lineTo(this.startX + 50, fY - 12);
        parking.moveTo(this.startX + 130, fY); parking.lineTo(this.startX + 100, fY - 12);
        parking.moveTo(this.startX + 180, fY); parking.lineTo(this.startX + 150, fY - 12);
        parking.lineStyle(0);
        cont.addChild(parking);

        // Cold storage crates on right half
        for (let ci = 0; ci < 4; ci++) {
            const crate = new PIXI.Graphics();
            crate.beginFill(0x1e293b); crate.drawRect(0, -22, 24, 22); crate.endFill();
            crate.beginFill(0x334155); crate.drawRect(1, -21, 22, 2); crate.endFill();
            crate.beginFill(colHex, 0.6); crate.drawRect(3, -15, 18, 2); crate.endFill();
            // Frost
            crate.beginFill(0xbfdbfe, 0.4); crate.drawRect(0, -22, 24, 1); crate.endFill();
            crate.x = this.startX + 250 + (ci % 2) * 28;
            crate.y = fY - Math.floor(ci / 2) * 24;
            cont.addChild(crate);
        }
    },

    // ══════════════════════════════════════════════════════════════════════
    //   ZONE-AWARE UNDERGROUND
    //   Draws the ground/earth/cables/tunnel/ocean/silo/rock layer below
    //   the building basement, matching what the exterior view shows at
    //   this building's map x-position.
    // ══════════════════════════════════════════════════════════════════════
    _drawZoneUnderground(scene, bld, startX, bldW, surfaceY, belowY, floorH) {
        const vpW = G.vpW;
        const zone = this._determineZone(bld);
        const profile = this._zoneProfile(zone);
        const seed = (bld && bld.x | 0) || 0;
        const g = new PIXI.Graphics();

        // ─── Earth walls flanking the building at basement depth (visual continuity) ───
        // Skip for port (ocean replaces it) and silo (bunker replaces it).
        if (zone !== 'port' && zone !== 'silo') {
            const earthCol = (zone === 'east_rock') ? 0x2a1a10 : 0x2a2218;
            const topsoilCol = (zone === 'east_rock') ? 0x3a2218 : 0x3a3020;
            g.beginFill(earthCol); g.drawRect(0, surfaceY, startX - 2, floorH); g.endFill();
            g.beginFill(earthCol); g.drawRect(startX + bldW + 2, surfaceY, vpW - startX - bldW - 2, floorH); g.endFill();
            g.beginFill(topsoilCol); g.drawRect(0, surfaceY, startX - 2, 6); g.endFill();
            g.beginFill(topsoilCol); g.drawRect(startX + bldW + 2, surfaceY, vpW - startX - bldW - 2, 6); g.endFill();
            // Grass strip at surface level
            g.beginFill(0x2d5a3f); g.drawRect(0, surfaceY - 4, startX - 2, 4); g.endFill();
            g.beginFill(0x2d5a3f); g.drawRect(startX + bldW + 2, surfaceY - 4, vpW - startX - bldW - 2, 4); g.endFill();
            // Foundation strip just below the basement floor
            g.beginFill(0x1a1810); g.drawRect(0, belowY - 4, vpW, 10); g.endFill();
        }

        // ─── Delegate to Underground module — single source of truth for the basement stack ───
        if (typeof Underground !== 'undefined') {
            const undergroundY = belowY + 6;
            const profileDepth = Underground.depthOf(profile);
            const totalDepth = Math.max(profileDepth + 60, 300); // pad with deep earth/void
            Underground.drawBasementStack(g, 0, undergroundY, vpW, totalDepth, profile, seed,
                profile === 'silo' ? { buildingX: startX, buildingW: bldW } : null);
            // Deep void below everything we rendered
            g.beginFill(0x050508); g.drawRect(0, undergroundY + totalDepth, vpW, 500); g.endFill();
        }
        scene.addChild(g);

        // ─── Live trains overlay — only for profiles that have a metro tunnel ───
        if (this._liveTrains) { try { this._liveTrains.destroy(); } catch (e) {} this._liveTrains = null; }
        const profileCfg = (typeof Underground !== 'undefined') ? Underground._profile(profile) : null;
        if (profileCfg && profileCfg.liveTrains && bld) {
            const undergroundY = belowY + 6;
            const tunnelTopY = undergroundY + Underground.H_CABLE_TRAY;
            const buildingWorldX = bld.x + (bld.w || bldW) / 2;
            this._liveTrains = Underground.attachLiveTrains(scene, buildingWorldX, 0, tunnelTopY, vpW, 1200);
        }
    },

    // Map zone id → Underground profile key
    _zoneProfile(zone) {
        switch (zone) {
            case 'port':       return 'port';
            case 'silo':       return 'silo';
            case 'east_rock':  return 'east_rock';
            case 'backbone':   return 'backbone';
            case 'agents':     return 'agents';
            default:           return 'city';
        }
    },

    // Determine which underground zone this building belongs to based on its id/type
    _determineZone(bld) {
        if (!bld) return 'default';
        if (bld.id && bld.id.startsWith('port_')) return 'port';
        if (bld.id && bld.id.startsWith('house_')) return 'silo';
        if (bld.id && bld.id.startsWith('backbone_')) return 'backbone';
        if (bld.id && bld.id.startsWith('agents_')) return 'agents';
        if (bld.type === 'vcrow') return 'east_rock';
        if (bld.id && bld.id.startsWith('suburb_')) return 'east_rock';
        if (bld.type === 'longevity') return 'east_rock';
        if (bld.id && bld.id.startsWith('robotics_')) return 'east_rock';
        return 'default';
    },

    onMove: (e) => {
        if (!InteriorCity.isDragging || !InteriorCity.scene || InteriorCity.scene.destroyed) return;
        let newY = InteriorCity.startSceneY + (e.clientY - InteriorCity.startY);
        if (newY < InteriorCity.minY) newY = InteriorCity.minY;
        if (newY > InteriorCity.maxY) newY = InteriorCity.maxY;
        InteriorCity.scene.y = newY;
    },
    
    onUp: () => { 
        InteriorCity.isDragging = false; 
        if (InteriorCity.layer) InteriorCity.layer.cursor = 'grab'; 
    },

    update() {
        if (!this.layer || !this.layer.visible) return;

        if (this.updateLifts) this.updateLifts();
        // Live trains visible in basement tunnel slice (city/agents profiles)
        if (this._liveTrains) this._liveTrains.update();

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
        
        if (this.tickerTxt && this.bldTickerSym && typeof API !== 'undefined' && API.stockPrices) {
            const sd = API.stockPrices[this.bldTickerSym];
            if (sd && G.tick % 60 === 0) {
                this.tickerTxt.text = `     ${this.bldTickerSym} $${sd.price} [${sd.change}]     ${this.bldTickerSym} $${sd.price} [${sd.change}]     `;
                this.tickerTxt.style.fill = sd.color;
            }
            this.tickerTxt.x -= 0.8;
            if (this.tickerTxt.x + (this.tickerTxt.width / 2) < this.startX) {
                this.tickerTxt.x = this.startX + this.bldW;
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
                } else if (l.type === 'error') {
                    targetAlpha = (G.tick % 60 < 30) ? l.maxA : 0; 
                } else if (l.type === 'fire') {
                    targetAlpha = l.maxA * (0.8 + Math.random() * 0.4); 
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

        const leftWall = this.startX + 60;
        const rightWall = this.startX + (this.bld.id === 'forest_0' ? this.bldW : this.usableW) - 60;
        let numFloors = this.bld.dynamicFl ? Math.max(3, this.bld.dynamicFl) : (this.bld.fl || 1);

        this.updateAvatarStates(leftWall, rightWall, numFloors);

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
