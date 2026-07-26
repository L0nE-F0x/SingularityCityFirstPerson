/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE INTERIOR (v1.0.0 — Phase 3: Mission Control, Assembly, Tracking Interiors)
   Handles interior views for space zone buildings with unique props and compute tracking.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceInterior = {
    // ─── Per-org launchpad interior config — real-world showcase prop, milestone
    //     plaque lines, and named NPC crew roles (floor 0 + observation deck) ───
    ORG_PAD: {
        spacex: {
            showcase: { kind: 'sat', label: 'AI1 Orbital Data Center', sub: '70 m solar wings · 150 kW compute · laser links' },
            plaque: ['$1.25T xAI merger — Jan 2026', 'FCC: up to 1M compute sats', 'Constellation roll-out 2028'],
            npcs0: [['Starship Flight Dir', 0xef4444], ['AI1 Payload Eng', null]],
            robot: 'Optimus',
            npcs1: [['Booster Catch Op', null], ['Starlink Laser Tech', 0x38bdf8]]
        },
        blue_origin: {
            showcase: { kind: 'lander', label: 'Blue Moon MK1 "Endurance"', sub: 'Passed NASA vacuum-chamber tests' },
            plaque: ['Nov 2025: booster landed at sea', 'Apr 2026: first NG reflight', 'LC-36 rebuild under way'],
            npcs0: [['NG Flight Director', 0xef4444], ['BE-4 Engineer', null]],
            npcs1: [['MK1 Lander Tech', null], ['Jacklyn Barge Ops', 0x38bdf8]]
        },
        nasa: {
            showcase: { kind: 'capsule', label: 'Orion Capsule', sub: 'Carried the Artemis II crew around the Moon' },
            plaque: ['Artemis II: crewed lunar flyby', 'Splashdown Apr 10, 2026', 'Artemis III targets 2027'],
            npcs0: [['Artemis Flight Dir', 0xef4444], ['Orion Systems Eng', null]],
            npcs1: [['SLS Booster Eng', null], ['EVA Suit Tech', 0x38bdf8]]
        },
        cnsa: {
            showcase: { kind: 'capsule', label: 'Mengzhou Capsule', sub: 'Launch-escape demo flown Feb 2026' },
            plaque: ['Moon landing before 2030', 'Shenzhou-23: year-long mission', 'LM-10 booster recovered at sea'],
            npcs0: [['LM-10 Flight Dir', 0xef4444], ['Mengzhou Engineer', null]],
            npcs1: [['Taikonaut Trainer', null], ['Lanyue Lander Eng', 0x38bdf8]]
        },
        esa: {
            showcase: { kind: 'sat', label: 'Amazon Leo Satellite', sub: '32 per Ariane 64 — two batches flown in 2026' },
            plaque: ['Ariane 64: 4-booster config', '8 launches planned in 2026', 'Next: MTG-I2 (Aug 2026)'],
            npcs0: [['DDO Kourou', 0xef4444], ['Range Safety CSG', null]],
            npcs1: [['Leo Constellation Eng', null], ['Vega Ops', 0x38bdf8]]
        },
        ula: {
            showcase: { kind: 'engine', label: 'BE-4 Engine', sub: 'Methalox power, built by Blue Origin' },
            plaque: ['USSF-87 direct to GEO', 'Target: 18–22 launches in 2026', '100% mission success record'],
            npcs0: [['Vulcan Launch Dir', 0xef4444], ['Centaur Fueling', null]],
            npcs1: [['GEM-63XL Tech', null], ['GSO Mission Planner', 0x38bdf8]]
        },
        rocketlab: {
            showcase: { kind: 'engine', label: 'Archimedes Engine', sub: 'Methalox engine for reusable Neutron' },
            plaque: ['Neutron debut: late 2026', '5-launch Neutron deal signed', 'Electron: 60+ flights'],
            npcs0: [['Neutron Test Lead', 0xef4444], ['Electron Recovery', null]],
            npcs1: [['Archimedes Eng', null], ['Wallops Range Ops', 0x38bdf8]]
        },
        isro: {
            showcase: { kind: 'capsule', label: 'Gaganyaan Crew Module', sub: 'Air-drop test aced Apr 2026' },
            plaque: ['Gaganyaan-1: H2 2026', '8,000+ ground tests done', '4th nation to fly crew solo'],
            npcs0: [['Gaganyaan Flight Dir', 0xef4444], ['CE-20 Cryo Engineer', null]],
            robot: 'Vyommitra',
            npcs1: [['Crew Module Tech', null], ['Recovery Dive Team', 0x38bdf8]]
        },
        jaxa: {
            showcase: { kind: 'engine', label: 'LE-9 Engine', sub: 'Expander-bleed hydrogen engine for H3' },
            plaque: ['SLIM: 100 m precision landing', 'HTV-X cargo to the ISS', 'JAXA astronaut on Artemis crew'],
            npcs0: [['H3 Flight Director', 0xef4444], ['LE-9 Engineer', null]],
            npcs1: [['HTV-X Cargo Ops', null], ['SLIM Nav Engineer', 0x38bdf8]]
        },
        roscosmos: {
            showcase: { kind: 'capsule', label: 'Soyuz MS Capsule', sub: '150+ crewed flights since 1967' },
            plaque: ['Longest-serving crew vehicle', 'Baikonur: oldest spaceport', 'ROS station planned post-ISS'],
            npcs0: [['Soyuz Flight Dir', 0xef4444], ['Kosmodrome Ops', null]],
            npcs1: [['Cosmonaut Trainer', null], ['Progress Cargo Ops', 0x38bdf8]]
        },
        northrop_grumman: {
            showcase: { kind: 'sat', label: 'Cygnus Freighter', sub: '60+ tons of ISS cargo delivered' },
            plaque: ['Antares 330: new Firefly stage', 'MEV: first GEO sat servicing', 'Builds SLS solid boosters'],
            npcs0: [['Antares Launch Dir', 0xef4444], ['Cygnus Ops', null]],
            npcs1: [['Solid Motor Eng', null], ['MEV Servicing Eng', 0x38bdf8]]
        },
        firefly: {
            showcase: { kind: 'lander', label: 'Blue Ghost 2 Lander', sub: 'Far-side Moon landing, late 2026' },
            plaque: ['Blue Ghost 1 landed on Moon', 'VICTUS NOX: 24-hr launch', 'Mission 2: lunar far side'],
            npcs0: [['Alpha Launch Dir', 0xef4444], ['Blue Ghost Ops', null]],
            npcs1: [['Elytra Nav Eng', null], ['Lunar Payload Eng', 0x38bdf8]]
        },
        landspace: {
            showcase: { kind: 'engine', label: 'TQ-12A Engine', sub: 'Methalox — first type to reach orbit, 2023' },
            plaque: ['ZQ-3 reached orbit on debut', 'Landing missed by just 17 s', '2026 goal: perfect landing'],
            npcs0: [['ZQ-3 Flight Dir', 0xef4444], ['Methalox Prop Eng', null]],
            npcs1: [['Landing Burn Analyst', null], ['Recovery Team Lead', 0x38bdf8]]
        }
    },

    avatars: [],
    bubbles: [],
    indoorLights: [],
    scene: null,
    layer: null,
    bld: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _noYScroll: false,
    
    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.layer.removeChildren();
        this.avatars = [];
        this.bubbles = [];
        this.indoorLights = [];
        this.observationWindows = [];

        // ─── SKY LAYER (behind scene — DOM sky shows through window cutouts) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 80);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        } else {
            // Fallback if InteriorCity not loaded yet
            this.skyContainer = new PIXI.Container();
            layer.addChild(this.skyContainer);
            this.starsLayer = new PIXI.Container();
            this.celestialGfx = new PIXI.Graphics();
            this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        }

        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);

        const org = bld.org ? SPACE_ORGS[bld.org] : null;
        const colHex = org ? parseInt(org.color.slice(1), 16) : 0x0ea5e9;

        // Building palette by type — mirrors space_environment.js exterior values
        // launchpad: concrete grey gantry; mission_control & tracking: navy; assembly: VAB grey
        const isAssembly = bld.type === 'assembly';
        const isLaunchpad = bld.type === 'launchpad';
        const wallCol  = isAssembly  ? 0x6b7280 :  // VAB grey-blue
                         isLaunchpad ? 0x475569 :  // dark concrete
                                       0x1e293b;   // navy (mission_control / tracking)
        const trimCol  = isAssembly  ? 0xcbd5e1 :  // light VAB highlight
                         isLaunchpad ? 0x64748b :  // medium concrete
                                       0x334155;   // navy trim
        const wallEdge = isAssembly  ? 0x4b5563 :
                         isLaunchpad ? 0x334155 :
                                       0x0f172a;
        const floorSlabCol = isAssembly ? 0x4b5563 : 0x0a1018;

        const floorH = 80;
        const numFloors = isAssembly ? 4 : bld.type === 'mission_control' ? 3 : isLaunchpad ? 2 : 2;
        const roofH = 70;
        // totalH includes roof + above-ground floors + basement floor + underground stack
        const undergroundH = (typeof Underground !== 'undefined') ? (Underground.depthOf('space') + 60) : 360;
        this.totalH = roofH + (numFloors + 1) * floorH + undergroundH;

        const bldW = Math.min(G.vpW - 60, 900);
        const startX = (G.vpW - bldW) / 2;

        // Window band constants for punched cutouts (above-ground floors)
        const winMarginX = 40;
        const winY_off = 14;
        const winH_px = floorH - 30;
        const mullionPitch = 60;
        const mullionW = 6;

        // ─── ROOF — type-specific silhouette ───
        const roof = new PIXI.Graphics();
        // Roof slab
        roof.beginFill(wallCol);
        roof.drawRect(startX, roofH - 12, bldW, 12);
        roof.endFill();
        // Trim line
        roof.beginFill(trimCol, 0.85);
        roof.drawRect(startX, roofH - 14, bldW, 2);
        roof.endFill();
        // Roof label band
        roof.beginFill(wallEdge, 0.95);
        roof.drawRect(startX, roofH - 30, bldW, 18);
        roof.endFill();
        roof.beginFill(colHex, 0.18);
        roof.drawRect(startX, roofH - 30, bldW, 18);
        roof.endFill();
        this.scene.addChild(roof);

        // Type-specific rooftop features (built into the roof container, scene-relative)
        this._drawRoofFeatures(this.scene, bld, startX, bldW, roofH, colHex);

        // Roof label text
        const orgName = org ? org.name : (bld.name || '');
        const roofTxt = new PIXI.Text(orgName.toUpperCase(), {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fill: colHex, fontWeight: 'bold', letterSpacing: 4
        });
        roofTxt.anchor.set(0.5, 0.5);
        roofTxt.x = startX + bldW / 2;
        roofTxt.y = roofH - 21;
        if (roofTxt.width > bldW - 20) roofTxt.scale.set((bldW - 20) / roofTxt.width);
        this.scene.addChild(roofTxt);

        // Side wall columns (frame the building)
        const sideCols = new PIXI.Graphics();
        sideCols.beginFill(wallEdge);
        sideCols.drawRect(startX - 6, roofH, 6, (numFloors + 1) * floorH);
        sideCols.drawRect(startX + bldW, roofH, 6, (numFloors + 1) * floorH);
        sideCols.endFill();
        // Edge highlight
        sideCols.beginFill(trimCol, 0.6);
        sideCols.drawRect(startX - 6, roofH, 2, (numFloors + 1) * floorH);
        sideCols.drawRect(startX + bldW + 4, roofH, 2, (numFloors + 1) * floorH);
        sideCols.endFill();
        this.scene.addChild(sideCols);

        // Build floors — basement (f=-1) + above-ground (f=0..numFloors-1)
        for (let f = -1; f < numFloors; f++) {
            const isBasement = f === -1;
            const fy = isBasement
                ? roofH + numFloors * floorH
                : roofH + (numFloors - 1 - f) * floorH;
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;

            // Floor background — basement is solid, above-ground has window cutout
            const floorBg = new PIXI.Graphics();
            if (isBasement) {
                floorBg.beginFill(wallEdge);
                floorBg.drawRect(startX, fy, bldW, floorH);
                floorBg.endFill();
                // Subtle hazard accent
                floorBg.beginFill(colHex, 0.08);
                floorBg.drawRect(startX, fy, bldW, 2);
                floorBg.endFill();
            } else {
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                if (typeof InteriorCity !== 'undefined' && InteriorCity._drawWallWithWindowCutout) {
                    InteriorCity._drawWallWithWindowCutout(
                        floorBg, wallCol,
                        startX, fy, bldW, floorH,
                        winX, winY, winW, winH_px,
                        mullionPitch, mullionW
                    );
                } else {
                    floorBg.beginFill(wallCol); floorBg.drawRect(startX, fy, bldW, floorH); floorBg.endFill();
                }
                // Window frame
                floorBg.lineStyle(1.5, trimCol, 0.9);
                floorBg.drawRect(winX, winY, winW, winH_px);
                floorBg.moveTo(winX, winY + winH_px * 0.5);
                floorBg.lineTo(winX + winW, winY + winH_px * 0.5);
                floorBg.lineStyle(0);
                // Faint org-color tint over window glass
                floorBg.beginFill(colHex, 0.05);
                floorBg.drawRect(winX, winY, winW, winH_px);
                floorBg.endFill();
            }
            // Floor slab divider
            floorBg.beginFill(floorSlabCol);
            floorBg.drawRect(startX, fy + floorH - 6, bldW, 6);
            floorBg.endFill();
            // Top accent
            floorBg.beginFill(colHex, 0.12);
            floorBg.drawRect(startX, fy, bldW, 2);
            floorBg.endFill();
            floorCont.addChild(floorBg);

            const propY = fy + floorH - 6;

            if (isBasement) {
                // Basement floor — type-specific industrial sub-level
                this._drawBasementProps(floorCont, bld, startX, bldW, fy, floorH, colHex);
            } else if (bld.type === 'mission_control') {
                if (f === numFloors - 1) {
                    this.drawBigScreen(floorCont, startX + bldW / 2, fy + 8, bldW - 100, floorH - 20, colHex);
                    this.drawNPC(floorCont, startX + 120, propY, 'Flight Director', colHex);
                    this.drawNPC(floorCont, startX + bldW - 120, propY, 'CAPCOM', colHex);
                } else if (f === 0) {
                    this.drawCommRack(floorCont, startX + 60, propY, colHex);
                    this.drawCommRack(floorCont, startX + 160, propY, colHex);
                    this.drawServerCabinet(floorCont, startX + 280, propY, colHex);
                    this.drawCoffeeMachine(floorCont, startX + bldW - 100, propY);
                    this.drawNPC(floorCont, startX + 350, propY, 'Network Ops', colHex);
                    this.drawNPC(floorCont, startX + bldW - 60, propY, 'Intern', 0x94a3b8);
                } else {
                    let currX = startX + 60;
                    let npcCount = 0;
                    while (currX < startX + bldW - 120) {
                        this.drawOperatorDesk(floorCont, currX, propY, colHex);
                        if (npcCount < 3) this.drawNPC(floorCont, currX + 50, propY, ['GNC', 'Telemetry', 'Propulsion'][npcCount], colHex);
                        currX += 120; npcCount++;
                    }
                }
            } else if (bld.type === 'assembly') {
                if (f === numFloors - 1) {
                    this.drawOverheadCrane(floorCont, startX + bldW / 2, fy + 10, bldW - 60);
                    this.drawNPC(floorCont, startX + 100, propY, 'Crane Op', 0xfacc15);
                } else if (f === 0) {
                    this.drawRocketBay(floorCont, startX + bldW / 2, propY, colHex);
                    this.drawNPC(floorCont, startX + bldW / 2 + 100, propY, 'Chief Engineer', colHex);
                    this.drawNPC(floorCont, startX + bldW / 2 - 100, propY, 'Technician', 0x94a3b8);
                } else {
                    this.drawCleanRoom(floorCont, startX + 80, fy, bldW - 160, floorH);
                    let currX = startX + 100;
                    while (currX < startX + bldW - 160) {
                        this.drawPayloadRack(floorCont, currX, propY, colHex);
                        currX += 100;
                    }
                    this.drawNPC(floorCont, startX + bldW / 2, propY, 'Payload Spec', 0xf1f5f9);
                }
            } else if (bld.type === 'tracking') {
                if (f === numFloors - 1) {
                    this.drawOrbitalDisplay(floorCont, startX + bldW / 2, fy + 8, bldW - 80, floorH - 16);
                    this.drawNPC(floorCont, startX + bldW / 2 - 60, propY, 'Analyst', colHex);
                } else {
                    let currX = startX + 60;
                    let npcIdx = 0;
                    while (currX < startX + bldW - 120) {
                        this.drawTrackingConsole(floorCont, currX, propY, colHex);
                        if (npcIdx < 2) this.drawNPC(floorCont, currX + 50, propY, ['Signal Proc', 'Orbit Calc'][npcIdx], colHex);
                        currX += 140; npcIdx++;
                    }
                }
            } else if (bld.type === 'launchpad') {
                const pad = this.ORG_PAD[bld.org] || {};
                if (f === 0) {
                    // Ground floor: milestone plaque + launch consoles + countdown
                    // + org showcase artifact + org-specific crew (and robots!)
                    if (pad.plaque && bldW > 420) {
                        this.drawFactPlaque(floorCont, startX + 24, fy + 10, Math.min(215, bldW * 0.3), colHex,
                            org ? org.name : bld.name, pad.plaque);
                    }
                    this.drawLaunchConsole(floorCont, startX + 70, propY, colHex);
                    if (bldW > 680) this.drawLaunchConsole(floorCont, startX + 230, propY, colHex);
                    this.drawCountdownClock(floorCont, startX + bldW / 2, fy + 10, bld);
                    if (pad.showcase && bldW > 520) {
                        this._drawShowcase(floorCont, pad.showcase, startX + bldW - 160, propY, colHex);
                    }
                    const npcs0 = pad.npcs0 || [['Launch Dir', 0xef4444], ['Range Safety', 0xfacc15]];
                    npcs0.forEach((n, i) => {
                        const nx = startX + 150 + i * 170;
                        if (nx < startX + bldW - 100) this.drawNPC(floorCont, nx, propY, n[0], n[1] || colHex);
                    });
                    if (pad.robot && bldW > 600) {
                        this.drawRobotNPC(floorCont, startX + bldW - 240, propY, pad.robot);
                    }
                    this.drawCoffeeMachine(floorCont, startX + bldW - 60, propY);
                } else {
                    // Upper floor: OBSERVATION DECK — a giant window onto the
                    // launch pad with a live rocket whose state mirrors the
                    // exterior pad. When liftoff fires, you watch from inside.
                    const obsW = Math.min(bldW - 120, 520);
                    const obsX = startX + (bldW - obsW) / 2;
                    const obsY = fy + 8;
                    const obsH = floorH - 18;
                    this.drawObservationWindow(floorCont, obsX, obsY, obsW, obsH, bld, colHex);
                    if ((bldW - obsW) / 2 >= 130) {
                        this.drawMissionPatchWall(floorCont, startX + 26, fy + 12, colHex);
                    }
                    const npcs1 = pad.npcs1 || [['Weather', 0x38bdf8], ['Capsule Comm', colHex]];
                    this.drawNPC(floorCont, startX + 60, propY, npcs1[0][0], npcs1[0][1] || colHex);
                    if (npcs1[1]) this.drawNPC(floorCont, startX + bldW - 70, propY, npcs1[1][0], npcs1[1][1] || colHex);
                }
            }
            
            this.scene.addChild(floorCont);
        }

        // ─── DESERT SAND SURFACE STRIP (matches space_environment.js exterior) ───
        // Flanks only — building basement occludes its own footprint.
        // Spans from soft sand top (groundY-18) all the way down to where the underground
        // stack begins (basementBottom+2), so no sky-gap shows through beside the building.
        const groundY = roofH + numFloors * floorH;
        const flankBottom = roofH + (numFloors + 1) * floorH + 2; // = undergroundY
        const flankH = flankBottom - groundY;
        const sand = new PIXI.Graphics();
        const leftW = startX - 6;
        const rightX = startX + bldW + 6;
        const rightW = G.vpW - rightX;

        // Helper: paint the full flank column (sand top → road → compacted earth down to underground)
        const paintFlank = (fx, fw) => {
            if (fw <= 0) return;
            // Soft sand top (above ground line)
            sand.beginFill(0xc2956a); sand.drawRect(fx, groundY - 18, fw, 18); sand.endFill();
            sand.beginFill(0xd4a574); sand.drawRect(fx, groundY - 18, fw, 9); sand.endFill();
            sand.beginFill(0xe0b88a); sand.drawRect(fx, groundY - 18, fw, 2); sand.endFill();
            // Compacted sand road (top 28px below ground line)
            sand.beginFill(0x8b7355); sand.drawRect(fx, groundY, fw, Math.min(28, flankH)); sand.endFill();
            sand.beginFill(0x9a8265); sand.drawRect(fx, groundY, fw, Math.min(14, flankH)); sand.endFill();
            // Below the road — packed dirt fading into the upper sandstone of the underground
            if (flankH > 28) {
                sand.beginFill(0x6b4423); sand.drawRect(fx, groundY + 28, fw, flankH - 28); sand.endFill();
                sand.beginFill(0x5c3a1e); sand.drawRect(fx, groundY + 28, fw, Math.min(8, flankH - 28)); sand.endFill();
            }
        };
        paintFlank(0, leftW);
        paintFlank(rightX, rightW);

        // Road dashed centerline (skip building footprint)
        for (let mx = 0; mx < G.vpW; mx += 40) {
            if (mx + 20 < startX || mx > startX + bldW) {
                sand.beginFill(0xd4a574, 0.4); sand.drawRect(mx, groundY + 12, 20, 3); sand.endFill();
            }
        }
        // Sand texture dots scattered across flanks (above ground only)
        const sandRng = this._sandSeed(bld.x | 0);
        for (let i = 0; i < 80; i++) {
            const sx = sandRng() * G.vpW;
            if (sx > startX - 8 && sx < startX + bldW + 8) continue;
            const sy = groundY - 16 + sandRng() * 14;
            sand.beginFill(sandRng() > 0.5 ? 0xb8895e : 0xdabc8e, 0.3);
            sand.drawRect(sx, sy, 1 + sandRng() * 2, 1);
            sand.endFill();
        }
        this.scene.addChild(sand);

        // ─── DESERT UNDERGROUND STACK (space profile) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 2;
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'space', (bld.x | 0));
            this.scene.addChild(ug);
            // Final dark fill below
            const fill = new PIXI.Graphics();
            fill.beginFill(0x080503);
            fill.drawRect(0, undergroundY + undergroundH, G.vpW, 2000);
            fill.endFill();
            this.scene.addChild(fill);
        }

        // Position scene — bottom of basement floor sits near viewport bottom
        // (underground extends below; user scrolls down to expose it)
        const bottomPadding = 56;
        this.scene.y = G.vpH - bottomPadding - this.totalH + (floorH + undergroundH);
        // Scroll bounds: up to expose roof+sky, down to expose full underground stack
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + undergroundH + floorH;
        this._noYScroll = false;
        
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!this.isDragging || !this.scene || this.scene.destroyed) return;
            let newY = this._startSceneY + (e.clientY - this._startY);
            if (newY < this.minY) newY = this.minY;
            if (newY > this.maxY) newY = this.maxY;
            this.scene.y = newY;
        };
        this._onUp = () => { this.isDragging = false; if (this.layer) this.layer.cursor = 'grab'; };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },
    
    update() {
        if (!this.layer || !this.layer.visible) return;

        // Shared sky/sun/moon/stars logic — keeps in sync with all other interiors
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        
        // Animate indoor lights (screen flicker)
        this.indoorLights.forEach(l => {
            if (l.type === 'screen') {
                l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.1 + l.g.x * 0.01) * 0.3);
            } else if (l.type === 'blink') {
                l.g.alpha = Math.sin(G.tick * 0.05) > 0 ? l.maxA : 0.1;
            }
        });

        // Animate space NPCs
        this.updateAvatars();

        // Live observation windows (launchpad interiors)
        this.updateObservationWindows();
    },
    
    // ════════════════════════════════════════════════════
    //   SPACE INTERIOR PROPS
    // ════════════════════════════════════════════════════
    
    drawBigScreen(c, cx, y, w, h, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Screen bezel
        g.beginFill(0x1a1a2e);
        g.drawRect(cx - w/2, y, w, h);
        g.endFill();
        // Screen surface
        g.beginFill(0x0a1628);
        g.drawRect(cx - w/2 + 4, y + 4, w - 8, h - 8);
        g.endFill();
        // Grid lines (orbital tracks)
        g.lineStyle(1, col, 0.15);
        for (let gx = cx - w/2 + 20; gx < cx + w/2; gx += 40) {
            g.moveTo(gx, y + 4); g.lineTo(gx, y + h - 4);
        }
        for (let gy = y + 15; gy < y + h; gy += 20) {
            g.moveTo(cx - w/2 + 4, gy); g.lineTo(cx + w/2 - 4, gy);
        }
        g.lineStyle(0);
        // Earth circle
        g.beginFill(0x1e40af, 0.4);
        g.drawCircle(cx, y + h/2, Math.min(w, h) * 0.25);
        g.endFill();
        g.beginFill(0x166534, 0.3);
        g.drawEllipse(cx - 5, y + h/2 - 3, 12, 8);
        g.drawEllipse(cx + 10, y + h/2 + 5, 8, 6);
        g.endFill();
        // Orbital path arcs
        g.lineStyle(1, 0x22d3ee, 0.4);
        g.drawEllipse(cx, y + h/2, Math.min(w,h) * 0.35, Math.min(w,h) * 0.15);
        g.lineStyle(1, 0xfbbf24, 0.3);
        g.drawEllipse(cx, y + h/2, Math.min(w,h) * 0.42, Math.min(w,h) * 0.2);
        g.lineStyle(0);
        // Satellite dots on orbits
        const t = G.tick * 0.005;
        [0x22d3ee, 0xfbbf24, 0x4ade80].forEach((dotCol, i) => {
            const angle = t + i * 2.1;
            const rx = Math.min(w,h) * (0.35 + i * 0.07);
            const ry = Math.min(w,h) * (0.15 + i * 0.05);
            g.beginFill(dotCol); g.drawCircle(cx + Math.cos(angle)*rx, y + h/2 + Math.sin(angle)*ry, 2); g.endFill();
        });
        // Glow
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.05); glow.drawRect(cx - w/2, y, w, h); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'screen' });
    },
    
    drawOperatorDesk(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Desk surface
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 18, 80, 18); g.endFill();
        g.beginFill(0x222240); g.drawRect(x, y - 20, 80, 4); g.endFill();
        // Triple monitors
        for (let mx = 0; mx < 3; mx++) {
            const sx = x + 5 + mx * 26;
            g.beginFill(0x111118); g.drawRect(sx, y - 38, 22, 16); g.endFill();
            const screenGlow = new PIXI.Graphics();
            screenGlow.beginFill(col, 0.5); screenGlow.drawRect(sx + 1, y - 37, 20, 14); screenGlow.endFill();
            screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
            c.addChild(screenGlow);
            this.indoorLights.push({ g: screenGlow, maxA: 0.6, type: 'screen' });
        }
        // Chair
        g.beginFill(0x1e293b); g.drawRect(x + 30, y - 6, 16, 6); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x + 36, y - 14, 4, 8); g.endFill();
        c.addChild(g);
    },
    
    drawCommRack(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111118); g.drawRect(x, y - 50, 30, 50); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(x + 2, y - 48, 26, 46); g.endFill();
        // LEDs
        for (let ly = y - 45; ly < y - 5; ly += 8) {
            const ledCol = Math.random() > 0.3 ? 0x4ade80 : 0xef4444;
            g.beginFill(ledCol); g.drawCircle(x + 8, ly, 1.5); g.endFill();
            g.beginFill(col, 0.3); g.drawRect(x + 14, ly - 2, 12, 4); g.endFill();
        }
        c.addChild(g);
    },
    
    drawServerCabinet(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a12); g.drawRect(x, y - 55, 40, 55); g.endFill();
        g.beginFill(0x111120); g.drawRect(x + 3, y - 52, 34, 49); g.endFill();
        // Server units
        for (let sy = y - 50; sy < y - 5; sy += 10) {
            g.beginFill(0x1a1a30); g.drawRect(x + 5, sy, 30, 8); g.endFill();
            g.beginFill(0x4ade80); g.drawCircle(x + 10, sy + 4, 1); g.endFill();
            g.beginFill(col, 0.2); g.drawRect(x + 14, sy + 2, 18, 4); g.endFill();
        }
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.06); glow.drawRect(x, y - 55, 40, 55); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'blink' });
    },
    
    drawCoffeeMachine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x333340); g.drawRect(x, y - 25, 18, 25); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x + 4, y - 8, 10, 8); g.endFill();
        g.beginFill(0x4ade80); g.drawCircle(x + 9, y - 18, 2); g.endFill();
        c.addChild(g);
    },
    
    drawOverheadCrane(c, cx, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rail
        g.beginFill(0xfacc15); g.drawRect(cx - w/2, y, w, 4); g.endFill();
        // Trolley
        g.beginFill(0x475569); g.drawRect(cx - 15, y + 4, 30, 12); g.endFill();
        // Hook cable
        g.beginFill(0x94a3b8); g.drawRect(cx - 1, y + 16, 2, 30); g.endFill();
        // Hook
        g.lineStyle(2, 0xfacc15); g.arc(cx, y + 48, 6, 0, Math.PI); g.lineStyle(0);
        c.addChild(g);
    },
    
    drawRocketBay(c, cx, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rocket in assembly (horizontal)
        g.beginFill(0xf1f5f9); g.drawRect(cx - 60, y - 20, 120, 16); g.endFill();
        g.beginFill(col); g.drawPolygon([cx + 60, y - 20, cx + 76, y - 12, cx + 60, y - 4]); g.endFill();
        g.beginFill(col); g.drawRect(cx - 20, y - 18, 30, 12); g.endFill();
        // Support cradle
        g.beginFill(0x475569); g.drawRect(cx - 50, y - 4, 20, 4); g.drawRect(cx + 30, y - 4, 20, 4); g.endFill();
        g.beginFill(0x334155); g.drawRect(cx - 45, y - 8, 4, 8); g.drawRect(cx + 41, y - 8, 4, 8); g.endFill();
        // Floor markings
        g.beginFill(0xfacc15, 0.3);
        for (let mx = cx - 80; mx < cx + 80; mx += 20) { g.drawRect(mx, y - 2, 10, 2); }
        g.endFill();
        c.addChild(g);
    },
    
    drawCleanRoom(c, x, y, w, h) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // White clean room overlay
        g.beginFill(0xffffff, 0.03); g.drawRect(x, y, w, h); g.endFill();
        g.lineStyle(1, 0x38bdf8, 0.15); g.drawRect(x, y, w, h); g.lineStyle(0);
        // Airlock markers
        g.beginFill(0x22d3ee, 0.2); g.drawRect(x, y + h/2 - 15, 4, 30); g.drawRect(x + w - 4, y + h/2 - 15, 4, 30); g.endFill();
        c.addChild(g);
    },
    
    drawPayloadRack(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 40, 50, 40); g.endFill();
        g.beginFill(0x111118); g.drawRect(x + 4, y - 36, 42, 32); g.endFill();
        // Payload fairing shape
        g.beginFill(0xf1f5f9, 0.3);
        g.drawPolygon([x + 15, y - 32, x + 25, y - 8, x + 35, y - 32]);
        g.endFill();
        g.beginFill(col, 0.2); g.drawRect(x + 18, y - 25, 14, 12); g.endFill();
        // Status LED
        g.beginFill(0x4ade80); g.drawCircle(x + 45, y - 4, 2); g.endFill();
        c.addChild(g);
    },
    
    drawOrbitalDisplay(c, cx, y, w, h) {
        // Similar to big screen but with satellite constellation focus
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a18); g.drawRect(cx - w/2, y, w, h); g.endFill();
        g.beginFill(0x0a1628); g.drawRect(cx - w/2 + 3, y + 3, w - 6, h - 6); g.endFill();
        // Polar grid
        g.lineStyle(1, 0x22d3ee, 0.1);
        for (let r = 10; r < Math.min(w,h)/2; r += 15) {
            g.drawCircle(cx, y + h/2, r);
        }
        g.lineStyle(0);
        // Constellation dots
        for (let i = 0; i < 30; i++) {
            const angle = i * 0.21 + G.tick * 0.002;
            const radius = 10 + (i % 5) * 12;
            g.beginFill(i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0x4ade80 : 0xfbbf24, 0.7);
            g.drawCircle(cx + Math.cos(angle) * radius, y + h/2 + Math.sin(angle) * radius * 0.4, 1.5);
            g.endFill();
        }
        // Label
        const lbl = new PIXI.Text('ORBITAL CONSTELLATION', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 7, fill: 0x22d3ee, letterSpacing: 2
        });
        lbl.anchor.set(0.5, 0); lbl.x = cx; lbl.y = y + h - 12;
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.04); glow.drawRect(cx - w/2, y, w, h); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow, lbl);
        this.indoorLights.push({ g: glow, maxA: 0.06, type: 'screen' });
    },
    
    drawTrackingConsole(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Console desk
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 16, 100, 16); g.endFill();
        // Dual screens
        g.beginFill(0x111118); g.drawRect(x + 5, y - 36, 40, 18); g.endFill();
        g.beginFill(0x111118); g.drawRect(x + 50, y - 36, 40, 18); g.endFill();
        // Screen content — signal waveform
        const wave1 = new PIXI.Graphics();
        wave1.lineStyle(1, 0x22d3ee, 0.7);
        for (let wx = 0; wx < 36; wx++) {
            const wy = Math.sin(wx * 0.3) * 4;
            if (wx === 0) wave1.moveTo(x + 7 + wx, y - 27 + wy);
            else wave1.lineTo(x + 7 + wx, y - 27 + wy);
        }
        wave1.lineStyle(0);
        const wave2 = new PIXI.Graphics();
        wave2.lineStyle(1, 0x4ade80, 0.7);
        for (let wx = 0; wx < 36; wx++) {
            const wy = Math.cos(wx * 0.4) * 3;
            if (wx === 0) wave2.moveTo(x + 52 + wx, y - 27 + wy);
            else wave2.lineTo(x + 52 + wx, y - 27 + wy);
        }
        wave2.lineStyle(0);
        // Chair
        g.beginFill(0x1e293b); g.drawRect(x + 40, y - 4, 16, 4); g.endFill();
        c.addChild(g, wave1, wave2);
    },
    
    drawLaunchConsole(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Wide console
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 20, 120, 20); g.endFill();
        g.beginFill(0x222240); g.drawRect(x, y - 22, 120, 4); g.endFill();
        // Main screen
        g.beginFill(0x111118); g.drawRect(x + 10, y - 42, 60, 18); g.endFill();
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(col, 0.4); screenGlow.drawRect(x + 11, y - 41, 58, 16); screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        // Status panel
        g.beginFill(0x111118); g.drawRect(x + 80, y - 42, 30, 18); g.endFill();
        // GO/NO-GO lights
        ['#4ade80', '#4ade80', '#4ade80', '#fbbf24'].forEach((ledCol, i) => {
            g.beginFill(parseInt(ledCol.slice(1), 16));
            g.drawCircle(x + 88 + i * 7, y - 33, 2);
            g.endFill();
        });
        // Big red button
        g.beginFill(0xef4444); g.drawCircle(x + 95, y - 6, 6); g.endFill();
        g.beginFill(0xb91c1c); g.drawCircle(x + 95, y - 6, 4); g.endFill();
        c.addChild(g, screenGlow);
        this.indoorLights.push({ g: screenGlow, maxA: 0.5, type: 'screen' });
    },
    
    drawCountdownClock(c, cx, y, bld) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a12); g.drawRect(cx - 50, y, 100, 30); g.endFill();
        g.beginFill(0x111120); g.drawRect(cx - 48, y + 2, 96, 26); g.endFill();
        g.lineStyle(1, 0xef4444, 0.5); g.drawRect(cx - 50, y, 100, 30); g.lineStyle(0);
        const txt = new PIXI.Text('T-00:00:00', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fill: 0xef4444, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 0.5);
        txt.x = cx; txt.y = y + 15;
        c.addChild(g, txt);
        bld._countdownClock = txt;
    },

    // ════════════════════════════════════════════════════
    //   ORG SHOWCASE PROPS — real-world artifacts on display
    //   Each tags its own specific hover tooltip (first-wins
    //   beats the generic autoTipModule label).
    // ════════════════════════════════════════════════════

    _drawShowcase(c, sc, x, y, col) {
        const fn = { sat: 'drawSatelliteShowcase', lander: 'drawLanderShowcase',
                     engine: 'drawEngineShowcase', capsule: 'drawCapsuleShowcase' }[sc.kind];
        if (fn) this[fn](c, x, y, col, sc.label, sc.sub);
    },

    _showcaseStand(g, cx, y, w) {
        // Museum-style display stand + soft spotlight pool
        g.beginFill(0xfacc15, 0.06); g.drawEllipse(cx, y - 2, w * 0.8, 5); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(cx - w / 2, y - 6, w, 6); g.endFill();
        g.beginFill(0x334155); g.drawRect(cx - w / 2, y - 7, w, 2); g.endFill();
    },

    drawSatelliteShowcase(c, x, y, col, label, sub) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        const cx = x + 45;
        this._showcaseStand(g, cx, y, 84);
        // Support pylon
        g.beginFill(0x475569); g.drawRect(cx - 2, y - 26, 4, 20); g.endFill();
        // Satellite bus (silver box)
        g.beginFill(0xcbd5e1); g.drawRect(cx - 9, y - 40, 18, 14); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(cx - 9, y - 40, 18, 3); g.endFill();
        // Solar wings (blue cell grid)
        [[-9, -1], [9, 1]].forEach(([ox, dir]) => {
            const wx = cx + ox + (dir < 0 ? -30 : 0);
            g.beginFill(0x1e40af); g.drawRect(wx, y - 38, 30, 10); g.endFill();
            g.beginFill(0x3b82f6, 0.5);
            for (let px = wx + 2; px < wx + 28; px += 6) g.drawRect(px, y - 37, 4, 8);
            g.endFill();
        });
        // Laser comm terminals (blinking)
        g.beginFill(0xf87171); g.drawCircle(cx - 6, y - 42, 1.5); g.endFill();
        const laser = new PIXI.Graphics();
        laser.beginFill(0x22d3ee); laser.drawCircle(cx + 6, y - 42, 1.5); laser.endFill();
        laser.blendMode = PIXI.BLEND_MODES.ADD;
        // Dish
        g.beginFill(0xf1f5f9); g.drawPolygon([cx - 4, y - 40, cx, y - 46, cx + 4, y - 40]); g.endFill();
        sc.addChild(g, laser);
        this.indoorLights.push({ g: laser, maxA: 1, type: 'blink' });
        this._showcaseLabel(sc, cx, y, label);
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, label, sub);
    },

    drawLanderShowcase(c, x, y, col, label, sub) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        const cx = x + 45;
        this._showcaseStand(g, cx, y, 76);
        // Landing legs (splayed)
        g.beginFill(0x9ca3af);
        g.drawPolygon([cx - 8, y - 26, cx - 18, y - 7, cx - 15, y - 7]);
        g.drawPolygon([cx + 8, y - 26, cx + 18, y - 7, cx + 15, y - 7]);
        g.endFill();
        // Footpads
        g.beginFill(0x6b7280); g.drawRect(cx - 20, y - 8, 7, 2); g.drawRect(cx + 13, y - 8, 7, 2); g.endFill();
        // Descent engine bell
        g.beginFill(0x52525b); g.drawPolygon([cx - 3, y - 24, cx - 5, y - 16, cx + 5, y - 16, cx + 3, y - 24]); g.endFill();
        // Body — gold multi-layer insulation
        g.beginFill(0xca8a04); g.drawRect(cx - 12, y - 42, 24, 18); g.endFill();
        g.beginFill(0xfbbf24, 0.55);
        g.drawRect(cx - 12, y - 42, 24, 3); g.drawRect(cx - 12, y - 34, 24, 2);
        g.endFill();
        // Tank domes
        g.beginFill(0xe5e7eb); g.drawCircle(cx - 6, y - 45, 4); g.drawCircle(cx + 6, y - 45, 4); g.endFill();
        // Org-color logo band
        g.beginFill(col); g.drawRect(cx - 12, y - 30, 24, 2.5); g.endFill();
        // Antenna
        g.beginFill(0xcbd5e1); g.drawRect(cx - 0.7, y - 54, 1.4, 6); g.drawCircle(cx, y - 55, 1.5); g.endFill();
        sc.addChild(g);
        this._showcaseLabel(sc, cx, y, label);
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, label, sub);
    },

    drawEngineShowcase(c, x, y, col, label, sub) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        const cx = x + 45;
        this._showcaseStand(g, cx, y, 76);
        // Test-stand A-frame
        g.beginFill(0xfacc15);
        g.drawRect(cx - 22, y - 48, 3, 42); g.drawRect(cx + 19, y - 48, 3, 42);
        g.drawRect(cx - 22, y - 48, 44, 3);
        g.endFill();
        // Powerhead + turbopumps
        g.beginFill(0x374151); g.drawRect(cx - 7, y - 45, 14, 8); g.endFill();
        g.beginFill(0x6b7280); g.drawCircle(cx - 8, y - 41, 3.5); g.drawCircle(cx + 8, y - 41, 3.5); g.endFill();
        // Nozzle bell (copper-lined)
        g.beginFill(0x78350f); g.drawPolygon([cx - 5, y - 37, cx - 12, y - 14, cx + 12, y - 14, cx + 5, y - 37]); g.endFill();
        g.beginFill(0xb45309); g.drawPolygon([cx - 4, y - 36, cx - 10, y - 15, cx - 5, y - 15, cx - 1, y - 36]); g.endFill();
        // Cooling channels
        g.lineStyle(1, 0xd97706, 0.4);
        for (let ly = y - 33; ly < y - 16; ly += 4) {
            const t = (y - 14 - ly) / 23;
            g.moveTo(cx - 5 - (1 - t) * 7, ly); g.lineTo(cx + 5 + (1 - t) * 7, ly);
        }
        g.lineStyle(0);
        // Propellant feed lines
        g.beginFill(0x0369a1); g.drawRect(cx - 20, y - 43, 13, 2.5); g.endFill();
        g.beginFill(0xb45309); g.drawRect(cx + 7, y - 43, 13, 2.5); g.endFill();
        sc.addChild(g);
        this._showcaseLabel(sc, cx, y, label);
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, label, sub);
    },

    drawCapsuleShowcase(c, x, y, col, label, sub) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        const cx = x + 45;
        this._showcaseStand(g, cx, y, 76);
        // Cradle
        g.beginFill(0x475569); g.drawRect(cx - 14, y - 10, 5, 4); g.drawRect(cx + 9, y - 10, 5, 4); g.endFill();
        // Heat shield (ablative brown)
        g.beginFill(0x7c2d12); g.drawEllipse(cx, y - 12, 15, 4); g.endFill();
        // Gumdrop capsule body
        g.beginFill(0xd1d5db);
        g.drawPolygon([cx - 15, y - 13, cx - 6, y - 36, cx + 6, y - 36, cx + 15, y - 13]);
        g.endFill();
        g.beginFill(0xf3f4f6);
        g.drawPolygon([cx - 12, y - 14, cx - 5, y - 34, cx - 1, y - 34, cx - 6, y - 14]);
        g.endFill();
        // Org accent stripe
        g.beginFill(col); g.drawPolygon([cx - 13, y - 18, cx - 12, y - 21, cx + 12, y - 21, cx + 13, y - 18]); g.endFill();
        // Windows
        g.beginFill(0x0ea5e9, 0.8); g.drawCircle(cx - 3, y - 27, 2); g.drawCircle(cx + 4, y - 27, 2); g.endFill();
        // Docking hatch on top
        g.beginFill(0x6b7280); g.drawRect(cx - 4, y - 40, 8, 4); g.endFill();
        g.beginFill(0x9ca3af); g.drawRect(cx - 2.5, y - 42, 5, 2); g.endFill();
        sc.addChild(g);
        this._showcaseLabel(sc, cx, y, label);
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, label, sub);
    },

    _showcaseLabel(sc, cx, y, label) {
        const txt = new PIXI.Text(label.toUpperCase(), {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: 0x94a3b8, letterSpacing: 0.5
        });
        txt.anchor.set(0.5, 0); txt.x = cx; txt.y = y + 2;
        if (txt.width > 100) txt.scale.set(100 / txt.width);
        sc.addChild(txt);
    },

    // Wall-mounted milestone plaque — org headline facts, museum style
    drawFactPlaque(c, x, y, w, col, title, lines) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        const h = 12 + lines.length * 9;
        g.beginFill(0x0a1018, 0.92); g.drawRoundedRect(x, y, w, h, 3); g.endFill();
        g.lineStyle(1, col, 0.55); g.drawRoundedRect(x, y, w, h, 3); g.lineStyle(0);
        g.beginFill(col, 0.16); g.drawRect(x, y, w, 10); g.endFill();
        sc.addChild(g);
        const tt = new PIXI.Text(`★ ${title.toUpperCase()} — 2026`, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: col, fontWeight: 'bold', letterSpacing: 0.5
        });
        tt.x = x + 5; tt.y = y + 2;
        if (tt.width > w - 10) tt.scale.set((w - 10) / tt.width);
        sc.addChild(tt);
        lines.forEach((ln, i) => {
            const lt = new PIXI.Text('· ' + ln, {
                fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: 0xcbd5e1
            });
            lt.x = x + 5; lt.y = y + 12 + i * 9;
            if (lt.width > w - 10) lt.scale.set((w - 10) / lt.width);
            sc.addChild(lt);
        });
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, 'Milestone Plaque', 'Real 2026 headlines for this org');
    },

    // Wall of embroidered mission patches (observation deck)
    drawMissionPatchWall(c, x, y, col) {
        const sc = new PIXI.Container();
        const g = new PIXI.Graphics();
        g.beginFill(0x111827, 0.8); g.drawRoundedRect(x, y, 88, 48, 3); g.endFill();
        g.lineStyle(1, 0x334155); g.drawRoundedRect(x, y, 88, 48, 3); g.lineStyle(0);
        const patchCols = [col, 0xfbbf24, 0x4ade80, 0xf87171, 0x38bdf8, 0xc084fc];
        for (let i = 0; i < 6; i++) {
            const px = x + 16 + (i % 3) * 28, py = y + 14 + Math.floor(i / 3) * 22;
            g.beginFill(0x1f2937); g.drawCircle(px, py, 8); g.endFill();
            g.lineStyle(1.5, patchCols[i], 0.9); g.drawCircle(px, py, 8); g.lineStyle(0);
            g.beginFill(patchCols[i], 0.7);
            if (i % 3 === 0) g.drawPolygon([px, py - 4, px + 3, py + 3, px - 3, py + 3]);          // rocket tri
            else if (i % 3 === 1) g.drawCircle(px, py, 2.5);                                        // planet
            else { g.drawRect(px - 3.5, py - 0.8, 7, 1.6); g.drawRect(px - 0.8, py - 3.5, 1.6, 7); } // star cross
            g.endFill();
        }
        sc.addChild(g);
        c.addChild(sc);
        if (typeof UI !== 'undefined' && UI.tip) UI.tip(sc, 'Mission Patch Wall', 'One patch per flown mission');
    },

    // Humanoid robot crew member (Optimus at Starbase, Vyommitra at SDSC)
    drawRobotNPC(c, x, y, name) {
        const bw = 12, h = 28, headH = 10;
        const cont = new PIXI.Container();

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        // Metallic head with glowing visor
        const head = new PIXI.Graphics();
        head.beginFill(0xd1d5db); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, 2); head.endFill();
        head.beginFill(0x111827); head.drawRect(-bw * 0.32, headH * 0.28, bw * 0.64, headH * 0.32); head.endFill();
        head.beginFill(0x22d3ee); head.drawRect(-bw * 0.24, headH * 0.36, bw * 0.2, headH * 0.16);
        head.drawRect(bw * 0.06, headH * 0.36, bw * 0.2, headH * 0.16); head.endFill();
        head.y = -h;

        // Torso — panelled metal with power core
        const body = new PIXI.Graphics();
        body.beginFill(0x9ca3af); body.drawRoundedRect(-bw / 2, 0, bw, h - headH - 4, 1.5); body.endFill();
        body.beginFill(0x6b7280); body.drawRect(-bw / 2, (h - headH - 4) * 0.45, bw, 1.5); body.endFill();
        body.beginFill(0x22d3ee, 0.9); body.drawCircle(0, (h - headH - 4) * 0.3, 1.8); body.endFill();
        body.y = -h + headH;

        // Actuator legs
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x4b5563); legL.drawRect(-lw / 2, 0, lw, 4); legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x4b5563); legR.drawRect(-lw / 2, 0, lw, 4); legR.endFill();
        legR.x = bw * 0.15;

        const dot = new PIXI.Graphics();
        dot.beginFill(0x22d3ee); dot.drawCircle(0, 0, 2); dot.endFill();
        dot.y = -h - 6;

        cont.addChild(shadow, legL, legR, body, head, dot);
        cont.x = x; cont.y = y;

        const txt = new PIXI.Text(`🤖 ${name}`, { fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: 0x22d3ee });
        txt.anchor.set(0.5, 1); txt.y = -h - 8;
        cont.addChild(txt);

        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.addToast(`🤖 ${name} — humanoid robot crew member`);
        });
        c.addChild(cont);

        const agent = {
            m: { id: 'robot_' + name.toLowerCase(), name, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.5,
            role: name, _h: h, isRobot: true
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   OBSERVATION WINDOW — live view onto the launch pad
    //   Mirrors SpaceEntities.rockets[bld.id] state so the
    //   user can watch a real liftoff from inside the building.
    // ════════════════════════════════════════════════════
    drawObservationWindow(c, x, y, w, h, bld, colHex) {
        if (!this.observationWindows) this.observationWindows = [];

        const frame = new PIXI.Graphics(); frame.eventMode = 'none';
        // Outer mullion (bezel)
        frame.beginFill(0x1f2937);
        frame.drawRect(x - 6, y - 6, w + 12, h + 12);
        frame.endFill();
        frame.beginFill(0x111827);
        frame.drawRect(x - 4, y - 4, w + 8, h + 8);
        frame.endFill();
        c.addChild(frame);

        // Inner clipping container — rocket animation lives here
        const inner = new PIXI.Container();
        inner.x = x; inner.y = y;
        // Mask so the rocket disappears off the top during liftoff
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff);
        mask.drawRect(x, y, w, h);
        mask.endFill();
        c.addChild(mask);
        inner.mask = mask;
        c.addChild(inner);

        // Sky gradient (light desert blue, darkening upward)
        const sky = new PIXI.Graphics();
        const skyBands = 6;
        for (let i = 0; i < skyBands; i++) {
            const t = i / (skyBands - 1);
            const r = Math.round(0x6b + t * (0xc8 - 0x6b));
            const gC = Math.round(0xa8 + t * (0xe0 - 0xa8));
            const b = Math.round(0xd8 + t * (0xf2 - 0xd8));
            sky.beginFill((r << 16) | (gC << 8) | b);
            sky.drawRect(0, (h * i) / skyBands, w, h / skyBands + 1);
            sky.endFill();
        }
        inner.addChild(sky);

        // Distant gantry tower (centered)
        const cx = w / 2;
        const groundY = h - 14;
        const towerH = h * 0.7;
        const towerW = 8;
        const tower = new PIXI.Graphics();
        tower.beginFill(0x475569);
        tower.drawRect(cx - 16 - towerW, groundY - towerH, towerW, towerH);
        tower.endFill();
        tower.beginFill(0x334155);
        tower.drawRect(cx - 16 - towerW, groundY - towerH, 2, towerH);
        tower.endFill();
        // Crossbeams
        tower.lineStyle(1, 0x64748b, 0.7);
        for (let by = groundY - towerH + 8; by < groundY; by += 10) {
            tower.moveTo(cx - 16 - towerW, by);
            tower.lineTo(cx - 16, by);
        }
        tower.lineStyle(0);
        // Beacon at top
        tower.beginFill(0xef4444);
        tower.drawCircle(cx - 16 - towerW / 2, groundY - towerH - 2, 1.5);
        tower.endFill();
        inner.addChild(tower);

        // Concrete pad
        const pad = new PIXI.Graphics();
        pad.beginFill(0x9ca3af);
        pad.drawRect(0, groundY, w, h - groundY);
        pad.endFill();
        pad.beginFill(0x6b7280);
        pad.drawRect(cx - 30, groundY, 60, 4);
        pad.endFill();
        inner.addChild(pad);

        // Rocket — the org's real flagship vehicle (same silhouette as the exterior)
        const rocketCont = new PIXI.Container();
        rocketCont.sortableChildren = true;
        const rocketBody = new PIXI.Graphics();
        if (typeof SpaceRockets !== 'undefined' && bld.org) {
            SpaceRockets.draw(rocketBody, bld.org, 0.62);
        } else {
            rocketBody.beginFill(0xf1f5f9);
            rocketBody.drawRect(-4, -36, 8, 36);
            rocketBody.endFill();
            rocketBody.beginFill(colHex);
            rocketBody.drawPolygon([-4, -36, 0, -48, 4, -36]);
            rocketBody.endFill();
        }
        rocketCont.addChild(rocketBody);

        // Flame
        const flameGfx = new PIXI.Graphics();
        flameGfx.blendMode = PIXI.BLEND_MODES.ADD;
        flameGfx.visible = false;
        rocketCont.addChild(flameGfx);

        rocketCont.x = cx;
        rocketCont.y = groundY;
        const baseY = rocketCont.y;
        inner.addChild(rocketCont);

        // Status readout (top-left of window)
        const statusBg = new PIXI.Graphics();
        statusBg.beginFill(0x000000, 0.55);
        statusBg.drawRect(4, 4, 80, 14);
        statusBg.endFill();
        inner.addChild(statusBg);
        const statusTxt = new PIXI.Text('STANDBY', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fill: 0x22d3ee, fontWeight: 'bold'
        });
        statusTxt.x = 8; statusTxt.y = 6;
        inner.addChild(statusTxt);

        // Smoke particles container (clipped by mask)
        const smokeLayer = new PIXI.Container();
        inner.addChild(smokeLayer);

        this.observationWindows.push({
            bldId: bld.id,
            inner, rocketCont, rocketBody, flameGfx, statusTxt,
            smokeLayer, smokeParticles: [],
            baseY, groundY, w, h, cx,
            ascentSpeed: 0
        });
    },

    updateObservationWindows() {
        if (!this.observationWindows || !this.observationWindows.length) return;
        if (typeof SpaceEntities === 'undefined') return;

        for (const ow of this.observationWindows) {
            const r = SpaceEntities.rockets[ow.bldId];
            if (!r) continue;
            const state = r.state;

            // Status text + color
            let label = '', color = 0x22d3ee;
            if (r.launchData && (state === 'idle' || state === 'preparation' || state === 'countdown')) {
                if (typeof SpaceData !== 'undefined') {
                    label = SpaceData.getCountdown(r.launchData) || '';
                }
                color = state === 'countdown' ? 0xef4444 : state === 'preparation' ? 0xfbbf24 : 0x22d3ee;
            } else if (state === 'ignition') { label = 'IGNITION'; color = 0xef4444; }
            else if (state === 'liftoff' || state === 'ascending') { label = `T+${Math.floor((r.timer || 0) / 60)}s`; color = 0x4ade80; }
            else if (state === 'orbit') { label = 'ORBIT'; color = 0x4ade80; }
            else if (state === 'idle') { label = ''; }
            ow.statusTxt.text = label;
            ow.statusTxt.style.fill = color;
            ow.statusTxt.visible = !!label;

            // Reset rocket visibility for non-flying states
            if (state === 'idle' || state === 'preparation' || state === 'countdown') {
                ow.rocketCont.visible = true;
                ow.rocketCont.y = ow.baseY;
                ow.rocketCont.alpha = 1;
                ow.flameGfx.visible = false;
                ow.ascentSpeed = 0;
                // Light shake during countdown
                if (state === 'countdown') {
                    ow.rocketCont.x = ow.cx + (Math.random() - 0.5) * 0.6;
                } else {
                    ow.rocketCont.x = ow.cx;
                }
            } else if (state === 'ignition') {
                ow.rocketCont.visible = true;
                ow.rocketCont.y = ow.baseY;
                ow.rocketCont.x = ow.cx + (Math.random() - 0.5) * 1.2;
                ow.rocketCont.alpha = 1;
                this._drawWindowFlame(ow.flameGfx, 1.4);
                ow.flameGfx.visible = true;
                if (G.tick % 3 === 0) this._spawnWindowSmoke(ow);
                ow.ascentSpeed = 0;
            } else if (state === 'liftoff' || state === 'ascending') {
                ow.rocketCont.visible = true;
                ow.ascentSpeed = Math.min(2.4, ow.ascentSpeed + 0.04);
                ow.rocketCont.y -= ow.ascentSpeed;
                ow.rocketCont.x = ow.cx + (Math.random() - 0.5) * 0.8;
                this._drawWindowFlame(ow.flameGfx, 1.6 + Math.sin(G.tick * 0.2) * 0.2);
                ow.flameGfx.visible = true;
                if (G.tick % 4 === 0) this._spawnWindowSmoke(ow);
                // Fade out as it leaves the window top
                if (ow.rocketCont.y < -20) ow.rocketCont.alpha = Math.max(0, ow.rocketCont.alpha - 0.04);
            } else if (state === 'orbit' || state === 'resetting') {
                ow.rocketCont.visible = false;
                ow.flameGfx.visible = false;
                if (state === 'resetting' && r.timer < 30) {
                    // Fade rocket back in for next cycle
                    ow.rocketCont.visible = true;
                    ow.rocketCont.y = ow.baseY;
                    ow.rocketCont.x = ow.cx;
                    ow.rocketCont.alpha = 1;
                    ow.ascentSpeed = 0;
                }
            }

            // Update smoke particles
            for (let i = ow.smokeParticles.length - 1; i >= 0; i--) {
                const p = ow.smokeParticles[i];
                p.g.x += p.vx; p.g.y += p.vy;
                p.life--;
                p.g.scale.set(1 + (1 - p.life / p.maxLife) * 1.3);
                p.g.alpha = (p.life / p.maxLife) * 0.55;
                if (p.life <= 0) {
                    ow.smokeLayer.removeChild(p.g); p.g.destroy();
                    ow.smokeParticles.splice(i, 1);
                }
            }
        }
    },

    _drawWindowFlame(g, intensity) {
        g.clear();
        const h = 4 + intensity * 8;
        g.beginFill(0xef4444, 0.8);
        g.drawPolygon([-3 - intensity, 0, 0, h + Math.sin(G.tick * 0.3) * 2, 3 + intensity, 0]);
        g.endFill();
        g.beginFill(0xfbbf24, 0.9);
        g.drawPolygon([-2, 0, 0, h * 0.6, 2, 0]);
        g.endFill();
        g.beginFill(0xffffff, 0.7);
        g.drawPolygon([-1, 0, 0, h * 0.3, 1, 0]);
        g.endFill();
    },

    _spawnWindowSmoke(ow) {
        const g = new PIXI.Graphics();
        g.beginFill(0xe2e8f0, 0.5);
        g.drawCircle(0, 0, 2 + Math.random() * 3);
        g.endFill();
        g.x = ow.cx + (Math.random() - 0.5) * 14;
        g.y = ow.groundY - 2;
        ow.smokeLayer.addChild(g);
        ow.smokeParticles.push({
            g,
            vx: (Math.random() - 0.5) * 1.2,
            vy: 0.2 + Math.random() * 0.6,
            life: 30 + Math.random() * 30,
            maxLife: 60
        });
        if (ow.smokeParticles[ow.smokeParticles.length - 1]) {
            const p = ow.smokeParticles[ow.smokeParticles.length - 1];
            p.maxLife = p.life;
        }
    },

    // Deterministic PRNG seeded by building world-X — keeps sand texture stable per visit.
    _sandSeed(seed) {
        let s = (seed | 0) || 7;
        return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    },

    // ════════════════════════════════════════════════════
    //   ROOFTOP FEATURES — type-specific silhouettes that mirror the exterior
    // ════════════════════════════════════════════════════
    _drawRoofFeatures(parent, bld, startX, bldW, roofH, colHex) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        if (bld.type === 'mission_control') {
            // Satellite dish on roof (centered, mirrors exterior)
            const cx = startX + bldW / 2;
            g.beginFill(0xf1f5f9);
            g.drawPolygon([cx - 22, roofH - 30, cx, roofH - 50, cx + 22, roofH - 30]);
            g.endFill();
            g.beginFill(0x94a3b8);
            g.drawRect(cx - 2, roofH - 30, 4, 14);
            g.endFill();
            // Receiver tip
            g.beginFill(0x22d3ee);
            g.drawCircle(cx, roofH - 48, 2);
            g.endFill();
            // Signal arcs
            g.lineStyle(1, 0x22d3ee, 0.3);
            g.drawCircle(cx, roofH - 50, 8);
            g.drawCircle(cx, roofH - 50, 14);
            g.lineStyle(0);
        } else if (bld.type === 'tracking') {
            // Multiple dish array on roof (mirrors exterior)
            [-50, -16, 18, 52].forEach((off, i) => {
                const dx = startX + bldW / 2 + off;
                // Dish (triangle)
                g.beginFill(0xf1f5f9);
                g.drawPolygon([dx - 12, roofH - 30, dx, roofH - 46, dx + 12, roofH - 30]);
                g.endFill();
                // Mast
                g.beginFill(0x94a3b8);
                g.drawRect(dx - 1, roofH - 30, 2, 12);
                g.endFill();
                // Signal arc
                g.lineStyle(1, 0x22d3ee, 0.3 + (i % 2) * 0.2);
                g.drawCircle(dx, roofH - 48, 5);
                g.drawCircle(dx, roofH - 48, 9);
                g.lineStyle(0);
            });
        } else if (bld.type === 'assembly') {
            // VAB-style flag stripe (mirrors exterior NASA homage)
            const cx = startX + bldW / 2;
            g.beginFill(0x1e40af);
            g.drawRect(cx - 38, roofH - 60, 76, 28);
            g.endFill();
            g.beginFill(0xef4444);
            for (let sy = roofH - 56; sy < roofH - 32; sy += 6) {
                g.drawRect(cx - 36, sy, 72, 3);
            }
            g.endFill();
            g.beginFill(0xffffff);
            g.drawRect(cx - 36, roofH - 58, 26, 12);
            g.endFill();
            // Star dots in canton
            g.beginFill(0x1e40af);
            for (let sx = cx - 33; sx < cx - 12; sx += 6) {
                for (let sy = roofH - 56; sy < roofH - 48; sy += 4) {
                    g.drawRect(sx, sy, 1.5, 1.5);
                }
            }
            g.endFill();
        } else if (bld.type === 'launchpad') {
            // Gantry tower silhouette behind the building
            const cx = startX + bldW / 2;
            // Twin tower legs
            g.beginFill(0x475569);
            g.drawRect(cx - 18, roofH - 80, 5, 50);
            g.drawRect(cx + 13, roofH - 80, 5, 50);
            g.endFill();
            // Cross beams
            g.beginFill(0x64748b);
            for (let by = roofH - 75; by < roofH - 30; by += 8) {
                g.drawRect(cx - 18, by, 36, 2);
            }
            g.endFill();
            // Swing arm (red)
            g.beginFill(0xef4444);
            g.drawRect(cx + 18, roofH - 60, 20, 3);
            g.endFill();
            // Top antenna
            g.beginFill(0xfacc15);
            g.drawCircle(cx, roofH - 84, 2);
            g.endFill();
        }
        parent.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   BASEMENT PROPS — type-specific industrial sub-level
    // ════════════════════════════════════════════════════
    _drawBasementProps(c, bld, startX, bldW, fy, floorH, colHex) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Concrete floor with hazard stripes (common to all)
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(startX + 6, fy + floorH - 12, bldW - 12, 8);
        g.endFill();
        for (let i = 0; i < Math.floor(bldW / 22); i++) {
            g.beginFill((i % 2 === 0) ? 0xfbbf24 : 0x1a1a2e, 0.4);
            g.drawRect(startX + 8 + i * 22, fy + floorH - 4, 18, 2);
            g.endFill();
        }
        const labelTxt = (bld.type === 'launchpad'      ? 'B1 · FLAME TRENCH & FUEL LINES' :
                         bld.type === 'mission_control' ? 'B1 · BACKUP POWER & COOLING'   :
                         bld.type === 'assembly'        ? 'B1 · TRANSPORTER CRAWLER BAY'  :
                         bld.type === 'tracking'        ? 'B1 · COOLED SIGNAL VAULT'      :
                                                          'B1 · SUB-LEVEL');
        const lbl = new PIXI.Text(labelTxt, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x64748b, letterSpacing: 1
        });
        lbl.x = startX + 8; lbl.y = fy + 4;
        lbl.alpha = 0.7;
        c.addChild(g, lbl);

        if (bld.type === 'launchpad') {
            // Flame trench — angled black void with ducting
            const tx = startX + bldW / 2 - 60;
            g.beginFill(0x000000);
            g.drawPolygon([tx, fy + 18, tx + 120, fy + 18, tx + 100, fy + floorH - 14, tx + 20, fy + floorH - 14]);
            g.endFill();
            g.beginFill(0xfbbf24, 0.15);
            g.drawPolygon([tx + 10, fy + 22, tx + 110, fy + 22, tx + 95, fy + floorH - 18, tx + 25, fy + floorH - 18]);
            g.endFill();
            // Fuel pipes flanking
            g.beginFill(0x0369a1);
            g.drawRect(startX + 30, fy + 30, bldW - 60, 5);
            g.endFill();
            g.beginFill(0x0284c7);
            g.drawRect(startX + 30, fy + 31, bldW - 60, 2);
            g.endFill();
            g.beginFill(0xb45309);
            g.drawRect(startX + 30, fy + 50, bldW - 60, 5);
            g.endFill();
            // Junction valves
            for (let vx = startX + 60; vx < startX + bldW - 40; vx += 200) {
                g.beginFill(0x334155); g.drawRect(vx, fy + 26, 12, 12); g.endFill();
                g.beginFill(0xef4444); g.drawCircle(vx + 6, fy + 32, 2); g.endFill();
            }
        } else if (bld.type === 'mission_control') {
            // Backup generator banks + cooling ducts
            for (let i = 0; i < 5; i++) {
                const gx = startX + 30 + i * 100;
                if (gx + 70 > startX + bldW - 20) break;
                // Generator
                g.beginFill(0x334155); g.drawRect(gx, fy + 24, 60, 36); g.endFill();
                g.beginFill(0x1f2937); g.drawRect(gx + 4, fy + 28, 52, 28); g.endFill();
                // Vents
                for (let vy = fy + 32; vy < fy + 55; vy += 4) {
                    g.beginFill(0x0f172a); g.drawRect(gx + 8, vy, 44, 2); g.endFill();
                }
                // Status LED
                g.beginFill(0x4ade80); g.drawCircle(gx + 56, fy + 28, 2); g.endFill();
            }
            // Cooling pipe overhead
            g.beginFill(0x0369a1); g.drawRect(startX + 20, fy + 12, bldW - 40, 6); g.endFill();
            g.beginFill(0x0284c7); g.drawRect(startX + 20, fy + 13, bldW - 40, 3); g.endFill();
        } else if (bld.type === 'assembly') {
            // Crawler transporter — wide tracked vehicle
            const cx = startX + bldW / 2;
            g.beginFill(0x4b5563); g.drawRect(cx - 140, fy + 30, 280, 26); g.endFill();
            g.beginFill(0x374151); g.drawRect(cx - 130, fy + 35, 260, 16); g.endFill();
            // Tracks (wheel rows)
            for (let trx = cx - 130; trx < cx + 130; trx += 18) {
                g.beginFill(0x1f2937); g.drawCircle(trx, fy + 56, 5); g.endFill();
                g.beginFill(0x0a0f1a); g.drawCircle(trx, fy + 56, 2); g.endFill();
            }
            // Top platform (where rocket would sit)
            g.beginFill(0x6b7280); g.drawRect(cx - 100, fy + 22, 200, 8); g.endFill();
            g.beginFill(0xfbbf24); g.drawRect(cx - 100, fy + 22, 200, 1); g.endFill();
            // Side warning markings
            g.beginFill(0xfbbf24);
            for (let mx = cx - 130; mx < cx + 130; mx += 18) {
                g.drawRect(mx, fy + 30, 8, 3);
            }
            g.endFill();
        } else if (bld.type === 'tracking') {
            // Cooled signal vault — server racks + LN2 tanks
            for (let i = 0; i < 4; i++) {
                const rx = startX + 40 + i * 110;
                if (rx + 80 > startX + bldW - 20) break;
                // Server rack
                g.beginFill(0x0a0a12); g.drawRect(rx, fy + 14, 50, 50); g.endFill();
                g.beginFill(0x111120); g.drawRect(rx + 3, fy + 17, 44, 44); g.endFill();
                for (let sy = fy + 20; sy < fy + 60; sy += 7) {
                    g.beginFill(0x1a1a30); g.drawRect(rx + 6, sy, 38, 5); g.endFill();
                    g.beginFill(0x4ade80); g.drawCircle(rx + 10, sy + 2.5, 0.8); g.endFill();
                    g.beginFill(colHex, 0.25); g.drawRect(rx + 14, sy + 1, 26, 3); g.endFill();
                }
                // LN2 tank beside rack
                g.beginFill(0xcbd5e1); g.drawRect(rx + 56, fy + 24, 20, 38); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(rx + 58, fy + 26, 16, 34); g.endFill();
                g.beginFill(0x22d3ee, 0.4); g.drawRect(rx + 60, fy + 28, 12, 10); g.endFill();
                // Frost wisps
                g.beginFill(0xffffff, 0.2); g.drawCircle(rx + 66, fy + 22, 3); g.endFill();
            }
            // Cold pipe along ceiling
            g.beginFill(0x22d3ee, 0.3); g.drawRect(startX + 20, fy + 8, bldW - 40, 4); g.endFill();
        }
        // NOTE: `g` was already added alongside the label up top — re-adding it here
        // would move it ABOVE the label in z-order and hide the basement text.
    },

    drawNPC(c, x, y, role, col) {
        const colHex = col || 0x64748b;
        const bw = 12;
        const h = 28;
        const headH = 10;
        const bodyH = h - headH - 4;
        const legH = 4;
        const eyeS = 1;

        const cont = new PIXI.Container();

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();

        // Head
        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, eyeS);
        head.drawCircle(bw * 0.1, headH * 0.38, eyeS);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(colHex);
        body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
        body.endFill();
        body.y = -h + headH;

        // Legs
        const lw = Math.max(2, bw * 0.25);
        const lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x1e293b);
        legL.drawRect(-lw / 2, 0, lw, lh);
        legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x1e293b);
        legR.drawRect(-lw / 2, 0, lw, lh);
        legR.endFill();
        legR.x = bw * 0.15;

        // Status dot
        const dot = new PIXI.Graphics();
        dot.beginFill(colHex);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;

        cont.addChild(shadow, legL, legR, body, head, dot);
        cont.x = x;
        cont.y = y;

        // Role label above head
        const txt = new PIXI.Text(role, { fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: colHex });
        txt.anchor.set(0.5, 1);
        txt.y = -h - 8;
        cont.addChild(txt);

        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.addToast(`${role} — Space Zone Personnel`);
        });

        c.addChild(cont);

        const agent = {
            m: { id: 'npc_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.8,
            role, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   SPACE NPC ANIMATION & STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const SPACE_MSGS = [
            "Telemetry nominal.", "Signal acquired.", "Orbit stable.",
            "Recalculating trajectory.", "Comms check.", "All systems go.",
            "Adjusting azimuth.", "Fuel pressure OK.", "T-minus holding.",
            "Copy that, Houston.", "Roger, flight.", "Go for launch."
        ];
        const ROBOT_MSGS = [
            "Beep. All systems nominal.", "Torque check complete.",
            "Recharging at 87%.", "Human detected. Hello.",
            "Running gait diagnostics.", "Payload secured. Beep."
        ];
        const msgsFor = (av) => av.isRobot ? ROBOT_MSGS : SPACE_MSGS;

        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            switch (av.state) {
                case 'working': {
                    // Idle animation — slight head bob and body sway
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.03 + av.deskX)) * 0.3;

                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.3) {
                            // Walk to a random nearby spot
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 120;
                            av.targetX = Math.max(30, Math.min(G.vpW - 30, av.targetX));
                        } else if (r < 0.5) {
                            // Chat with someone
                            av.state = 'chatting';
                            av.timer = 80 + Math.floor(Math.random() * 60);
                            const msgs = msgsFor(av);
                            this.spawnBubble(av, msgs[Math.floor(Math.random() * msgs.length)]);
                        } else {
                            // Keep working, reset timer
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.3) {
                                const msgs = msgsFor(av);
                                this.spawnBubble(av, msgs[Math.floor(Math.random() * msgs.length)]);
                            }
                        }
                    }
                    break;
                }

                case 'walking': {
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < 2) {
                        av.cont.x = av.targetX;
                        av.cont.scale.x = 1;
                        if (av.label) av.label.scale.x = 1;
                        if (av.dot) av.dot.scale.x = 1;
                        av.state = 'working';
                        av.timer = 100 + Math.floor(Math.random() * 200);
                    } else {
                        const dir = dx > 0 ? 1 : -1;
                        av.cont.x += dir * av.speed;
                        av.cont.scale.x = dir;
                        // Counter-scale text & dot so they don't mirror
                        if (av.label) av.label.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    // Walk animation
                    av.head.y = -av._h + Math.sin(G.tick * 0.2) * 1.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.2)) * 1.5;
                    av.legL.y = Math.sin(G.tick * 0.3) * 3;
                    av.legR.y = -Math.sin(G.tick * 0.3) * 3;
                    break;
                }

                case 'chatting': {
                    // Slight gesturing animation
                    av.head.y = -av._h + Math.sin(G.tick * 0.06) * 1;
                    av.body.y = -av._h + av._h * 0.36;

                    if (av.timer <= 0) {
                        av.state = 'working';
                        av.timer = 80 + Math.floor(Math.random() * 150);
                    }
                    break;
                }
            }
        });

        // Update speech bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 20);
            if (b.life <= 0) {
                if (b.cont.parent) b.cont.parent.removeChild(b.cont);
                b.cont.destroy({ children: true });
                this.bubbles.splice(i, 1);
            }
        }
    },

    spawnBubble(av, msg) {
        if (!this.scene || this.scene.destroyed) return;
        const bCont = new PIXI.Container();
        const txt = new PIXI.Text(msg, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x000000, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 1);
        txt.y = -6;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.beginFill(0xffffff);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        bCont.addChild(bg, txt);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - av._h - 10;
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    }
};
