/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BACKBONE INTERIORS (v1.0.0)
   Self-contained interior module for network infrastructure buildings.
   IXP: Meet-Me Room, Peering Hall, Cross-Connect Vault
   NOC: War Room, Monitoring Wall, Incident Room
   Landing: Cable Vault, Amplifier Room
   CDN: Cache Floor, Edge Compute
   Ground Station: Dish Control, Tracking Room
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorBackbone = {
    scene: null, layer: null, bld: null, avatars: [], bubbles: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = [];

        // Sky — use shared helper for consistency with InteriorCity
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const floorH = 80, startX = 60, bldW = G.vpW - 120;
        const layouts = {
            'backbone_ixp':     { floors: ['Cross-Connect Vault', 'Peering Hall', 'Meet-Me Room', 'NOC Desk'],
                                  roofLabel: 'INTERNET EXCHANGE', col: 0x22d3ee, npcs: ['Peering Eng', 'IX Operator'] },
            'backbone_landing': { floors: ['Cable Vault', 'Amplifier Room', 'Monitoring'],
                                  roofLabel: 'CABLE LANDING', col: 0x3b82f6, npcs: ['Splice Tech', 'Cable Tech'] },
            'backbone_ground':  { floors: ['Antenna Hall', 'Tracking Room', 'Dish Control'],
                                  roofLabel: 'GROUND STATION', col: 0xa855f7, npcs: ['Sat Ops', 'RF Engineer'] },
            'backbone_cdn':     { floors: ['Cache Floor', 'Edge Compute', 'WAF Control', 'Ops Deck', 'Boardroom'],
                                  roofLabel: 'CDN / EDGE NODE', col: 0xf97316, npcs: ['CDN Eng', 'Cache Ops'] },
            'backbone_noc':     { floors: ['Server Basement', 'Incident Room', 'War Room', 'Monitoring Wall', 'Executive Floor', 'Rooftop Terrace'],
                                  roofLabel: 'NETWORK OPS CENTER', col: 0xef4444, npcs: ['NOC Lead', 'SRE', 'Analyst'] }
        };
        const layout = layouts[bld.id] || { floors: ['Operations'], roofLabel: bld.name.toUpperCase(), col: 0x22d3ee, npcs: [] };
        const numFloors = layout.floors.length;
        const roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH + 220;

        // Roof sign
        const rc = new PIXI.Container();
        const bW = 220, bH = 28, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0f1a); sg.lineStyle(2, layout.col, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        // Accent glow
        sg.beginFill(layout.col, 0.05); sg.drawRect(bX, bY, bW, bH); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(layout.roofLabel, { fontFamily:'JetBrains Mono', fontSize:11, fontWeight:'bold', fill:'#' + layout.col.toString(16).padStart(6,'0'), letterSpacing:2 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt); this.scene.addChild(rc);

        // Floors
        const winMarginX = 50;
        const winY_off = 16;
        const winH_px = floorH - 28;
        const mullionPitch = 60;
        const mullionW = 6;

        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f) * floorH;
            const isB = f === -1;
            const floorName = isB ? layout.floors[0] : layout.floors[numFloors - 1 - f] || 'Operations';
            const rg = new PIXI.Graphics();
            // Side walls (columns)
            rg.beginFill(0x0c1525); rg.drawRect(startX-6, fy, 6, floorH); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wc = isB ? 0x0a1220 : 0x0c1525;
            if (isB) {
                // Basement: solid wall (underground)
                rg.beginFill(wc); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            } else {
                // Above-ground: punched window cutout — DOM sky shows through
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                InteriorCity._drawWallWithWindowCutout(
                    rg, wc,
                    startX, fy, bldW, floorH,
                    winX, winY, winW, winH_px,
                    mullionPitch, mullionW
                );
                // Window frames (stroked only)
                rg.lineStyle(1.5, 0x1a2a40, 0.9);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.moveTo(winX, winY + winH_px * 0.5);
                rg.lineTo(winX + winW, winY + winH_px * 0.5);
                rg.lineStyle(0);
                // Cyan glazing tint for backbone theme
                rg.beginFill(layout.col, 0.04);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.endFill();
            }
            // Floor slab
            rg.beginFill(0x0a1220); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x1a2a40); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            // Accent line (cyan glow at ceiling)
            rg.beginFill(layout.col, 0.08); rg.drawRect(startX, fy, bldW, 2); rg.endFill();
            this.scene.addChild(rg);
            // Floor label
            const fl = new PIXI.Text(floorName.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:7, fill:layout.col, letterSpacing:2 });
            fl.anchor.set(0.5,0); fl.x = startX+bldW/2; fl.y = fy+6; this.scene.addChild(fl);
            // Floor props
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, bldW, pY, fy, floorH, floorName, layout.col, bld.id);
            // Spawn NPCs on this floor (night: only essential ops roles)
            const _dpNow = G.getDayPhase();
            const _isNight = _dpNow > 0.83 || _dpNow < 0.25;
            const _nightRoles = ['NOC Lead','SRE','Security Eng','Incident Cmdr','Sat Ops'];
            const floorNpcs = this._getNPCsForFloor(floorName, layout, f, numFloors);
            floorNpcs.forEach(npcDef => {
                if (_isNight && !_nightRoles.includes(npcDef.role)) return;
                this.drawNPC(fc, startX + npcDef.xOff, pY, npcDef.role, npcDef.col);
            });
            if (f === 0) {
                this._drawReceptionDesk(fc, startX + 80, pY, layout.col);
                this.drawNPC(fc, startX + 95, pY, 'Receptionist', layout.col);
            }
        }

        // ─── GROUND (fills sides beyond the building footprint) ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x0a1020); earth.drawRect(0, groundY, startX-6, floorH); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, floorH); earth.endFill();
        earth.beginFill(0x141e30); earth.drawRect(0, groundY, startX-6, 6); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x1a2a3a); earth.drawRect(0, groundY-2, startX-6, 4); earth.drawRect(startX+bldW+6, groundY-2, G.vpW-startX-bldW-6, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── ZONE-AWARE UNDERGROUND ───
        const surfaceY = groundY;
        const belowBasementY = roofH + (numFloors + 1) * floorH;
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── ELEVATOR (flush against right wall) ───
        const elevatorX = startX + bldW - 26;  // shaft right edge 2px from wall
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container();
            ec.y = groundY;  // ground floor bottom (CityElevator draws upward)
            this.scene.addChild(ec);
            // Mask: clip elevator to building bounds so shaft doesn't extend
            // past the right wall or below the ground floor
            const em = new PIXI.Graphics();
            em.beginFill(0xffffff);
            em.drawRect(startX, -numFloors * floorH, bldW, (numFloors + 1) * floorH);
            em.endFill();
            ec.addChild(em);
            ec.mask = em;
            this._lift = new CityElevator(ec, numFloors, floorH, elevatorX);
        }

        // Position + scroll
        const bp = 56;
        this.scene.y = G.vpH - bp - this.totalH + floorH;
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + floorH * 3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        this.layer.hitArea = new PIXI.Rectangle(0, 0, G.vpW, G.vpH);
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            this.isDragging = true; this._startY = e.clientY;
            this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorBackbone.isDragging || !InteriorBackbone.scene || InteriorBackbone.scene.destroyed) return;
            let ny = InteriorBackbone._startSceneY + (e.clientY - InteriorBackbone._startY);
            ny = Math.max(InteriorBackbone.minY, Math.min(ny, InteriorBackbone.maxY));
            InteriorBackbone.scene.y = ny;
        };
        this._onUp = () => {
            InteriorBackbone.isDragging = false;
            if (InteriorBackbone.layer) InteriorBackbone.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    _drawFloorProps(c, sx, bw, pY, fy, fh, floorName, col, bldId) {
        const fn = floorName.toLowerCase();
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        let _t = floorName;
        if (fn.includes('war room') || fn.includes('monitoring')) _t = 'Monitoring Wall';
        else if (fn.includes('peering') || fn.includes('meet-me') || fn.includes('cross-connect')) _t = 'Peering Racks';
        else if (fn.includes('cable vault') || fn.includes('amplifier')) _t = 'Cable Vault';
        else if (fn.includes('cache') || fn.includes('edge compute') || fn.includes('server')) _t = 'Edge Servers';
        else if (fn.includes('dish') || fn.includes('tracking') || fn.includes('antenna')) _t = 'Satellite Dishes';
        UI.tip(g, _t, 'Backbone equipment');

        if (fn.includes('war room') || fn.includes('monitoring')) {
            // Wall of screens
            for (let mx = sx+30; mx < sx+bw-50; mx += 55) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+12, 42, 28); g.endFill();
                g.beginFill(col, 0.15); g.drawRect(mx+2, fy+14, 38, 24); g.endFill();
                // Fake graph lines on screen
                for (let ly = 0; ly < 4; ly++) {
                    g.beginFill(col, 0.1 + Math.random() * 0.15);
                    g.drawRect(mx+4, fy+16+ly*5, 34, 1); g.endFill();
                }
                // Status dot
                const dotCol = Math.random() > 0.2 ? 0x4ade80 : 0xef4444;
                g.beginFill(dotCol, 0.8); g.drawCircle(mx+38, fy+16, 2); g.endFill();
            }
            // Operator desks
            for (let dx = sx+50; dx < sx+bw-80; dx += 100) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 60, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 60, 3); g.endFill();
                // Chair
                g.beginFill(0x334155); g.drawCircle(dx+30, pY-4, 6); g.endFill();
            }
        } else if (fn.includes('peering') || fn.includes('meet-me') || fn.includes('cross-connect')) {
            // Server racks / patch panels
            for (let rx = sx+25; rx < sx+bw-40; rx += 40) {
                // Rack enclosure
                g.beginFill(0x111825); g.drawRect(rx, fy+12, 28, fh-22); g.endFill();
                g.beginFill(0x1a2540); g.drawRect(rx, fy+12, 28, 3); g.endFill();
                // Rack units with LEDs
                for (let ru = 0; ru < 6; ru++) {
                    const uy = fy+18+ru*8;
                    g.beginFill(0x0d1220); g.drawRect(rx+2, uy, 24, 6); g.endFill();
                    // Activity LEDs
                    const ledCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xef4444][Math.floor(Math.random()*4)];
                    g.beginFill(ledCol, 0.6+Math.random()*0.4);
                    g.drawRect(rx+4, uy+2, 2, 2); g.endFill();
                    g.beginFill(ledCol, 0.3+Math.random()*0.4);
                    g.drawRect(rx+8, uy+2, 2, 2); g.endFill();
                }
                // Fiber patch cables (colored lines down the side)
                const patchCol = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15][Math.floor(Math.random()*4)];
                g.beginFill(patchCol, 0.3); g.drawRect(rx+26, fy+16, 2, fh-30); g.endFill();
            }
        } else if (fn.includes('cable vault') || fn.includes('amplifier')) {
            // Thick submarine cable bundles
            const cableColors = [0x22d3ee, 0x4ade80, 0xfacc15, 0xf43f5e, 0x8b5cf6];
            for (let ci = 0; ci < 5; ci++) {
                const cy = fy + 20 + ci * 11;
                g.beginFill(0x1a1a2a); g.drawRect(sx+20, cy, bw-40, 8); g.endFill();
                g.beginFill(cableColors[ci], 0.25); g.drawRect(sx+22, cy+2, bw-44, 4); g.endFill();
            }
            // Splice trays
            for (let tx = sx+60; tx < sx+bw-80; tx += 120) {
                g.beginFill(0x1a2540); g.drawRect(tx, pY-20, 80, 20); g.endFill();
                g.beginFill(0x222a40); g.drawRect(tx, pY-22, 80, 3); g.endFill();
                // Fiber loops
                for (let fi = 0; fi < 6; fi++) {
                    g.beginFill(cableColors[fi % cableColors.length], 0.35);
                    g.drawCircle(tx+10+fi*11, pY-10, 3); g.endFill();
                }
            }
        } else if (fn.includes('cache') || fn.includes('edge compute') || fn.includes('server')) {
            // Server racks with hot/cold aisle
            for (let rx = sx+20; rx < sx+bw-30; rx += 50) {
                g.beginFill(0x0d1525); g.drawRect(rx, fy+14, 35, fh-24); g.endFill();
                g.beginFill(0x141e30); g.drawRect(rx, fy+14, 35, 3); g.endFill();
                // Blinkenlights
                for (let ru = 0; ru < 8; ru++) {
                    const uy = fy+20+ru*6;
                    g.beginFill(0x0a0f1a); g.drawRect(rx+2, uy, 31, 4); g.endFill();
                    for (let li = 0; li < 4; li++) {
                        const on = Math.random() > 0.3;
                        g.beginFill(on ? 0x4ade80 : 0x1a2530, on ? 0.6 : 0.2);
                        g.drawRect(rx+4+li*7, uy+1, 2, 2); g.endFill();
                    }
                }
            }
        } else if (fn.includes('dish') || fn.includes('tracking') || fn.includes('antenna')) {
            // Satellite dish representations
            for (let dx = sx+60; dx < sx+bw-80; dx += 110) {
                // Dish base
                g.beginFill(0x334155); g.drawRect(dx+15, pY-10, 20, 10); g.endFill();
                // Dish arm
                g.beginFill(0x64748b); g.drawRect(dx+22, fy+20, 6, pY-30-fy); g.endFill();
                // Dish
                g.beginFill(0xcbd5e1, 0.4);
                g.drawEllipse(dx+25, fy+22, 30, 12); g.endFill();
                g.beginFill(0xe2e8f0, 0.3);
                g.drawEllipse(dx+25, fy+22, 26, 9); g.endFill();
                // Feed horn
                g.beginFill(0xf97316, 0.6); g.drawCircle(dx+25, fy+22, 3); g.endFill();
            }
            // Rack equipment
            for (let rx = sx+30; rx < sx+bw-50; rx += 80) {
                g.beginFill(0x111825); g.drawRect(rx, pY-28, 24, 28); g.endFill();
                g.beginFill(0x4ade80, 0.4); g.drawRect(rx+2, pY-26, 2, 2); g.endFill();
                g.beginFill(0x22d3ee, 0.4); g.drawRect(rx+6, pY-26, 2, 2); g.endFill();
            }
        } else if (fn.includes('incident') || fn.includes('executive') || fn.includes('ops deck') || fn.includes('boardroom')) {
            // Conference/ops table
            g.beginFill(0x1e293b); g.drawRect(sx+bw/2-80, pY-16, 160, 16); g.endFill();
            g.beginFill(0x334155); g.drawRect(sx+bw/2-80, pY-18, 160, 3); g.endFill();
            // Chairs around table
            for (let ci = 0; ci < 6; ci++) {
                const cx = sx+bw/2-70+ci*28;
                g.beginFill(0x475569); g.drawCircle(cx, pY-6, 5); g.endFill();
            }
            // Wall screen
            g.beginFill(0x0a0a18); g.drawRect(sx+bw/2-60, fy+14, 120, 30); g.endFill();
            g.beginFill(col, 0.12); g.drawRect(sx+bw/2-58, fy+16, 116, 26); g.endFill();
        } else if (fn.includes('waf') || fn.includes('noc desk')) {
            // Firewall / security displays
            for (let mx = sx+35; mx < sx+bw-45; mx += 65) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 50, 26); g.endFill();
                g.beginFill(0xef4444, 0.1); g.drawRect(mx+2, fy+16, 46, 22); g.endFill();
                // Shield icon
                g.beginFill(0xef4444, 0.3);
                g.drawPolygon([mx+25, fy+18, mx+35, fy+22, mx+35, fy+32, mx+25, fy+36, mx+15, fy+32, mx+15, fy+22]);
                g.endFill();
            }
        } else if (fn.includes('rooftop') || fn.includes('terrace')) {
            // Antenna array on rooftop
            for (let ax = sx+40; ax < sx+bw-40; ax += 80) {
                g.beginFill(0x64748b); g.drawRect(ax, fy+10, 4, fh-20); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(ax-8, fy+15, 20, 3); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(ax-6, fy+25, 16, 3); g.endFill();
                // Blinking light on top
                g.beginFill(0xef4444, 0.7); g.drawCircle(ax+2, fy+8, 2); g.endFill();
            }
        } else {
            // Generic ops floor
            for (let dx = sx+50; dx < sx+bw-60; dx += 80) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 50, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 50, 3); g.endFill();
            }
        }

        c.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   NPC FLOOR ASSIGNMENT
    // ════════════════════════════════════════════════════

    _getNPCsForFloor(floorName, layout, floorIdx, numFloors) {
        const fn = floorName.toLowerCase();
        const bw = G.vpW - 120;
        // Assign defined NPCs to specific floors, plus generic extras
        if (fn.includes('war room') || fn.includes('monitoring wall')) {
            return [
                { role: 'NOC Lead', col: 0x22d3ee, xOff: bw * 0.25 },
                { role: 'SRE', col: 0xef4444, xOff: bw * 0.55 },
                { role: 'Analyst', col: 0x94a3b8, xOff: bw * 0.8 }
            ];
        } else if (fn.includes('peering') || fn.includes('meet-me')) {
            return [
                { role: 'Peering Eng', col: 0x4ade80, xOff: bw * 0.3 },
                { role: 'IX Operator', col: 0x22d3ee, xOff: bw * 0.65 }
            ];
        } else if (fn.includes('cross-connect')) {
            return [{ role: 'Patch Tech', col: 0xfbbf24, xOff: bw * 0.5 }];
        } else if (fn.includes('cable vault') || fn.includes('amplifier')) {
            return [
                { role: 'Splice Tech', col: 0xfbbf24, xOff: bw * 0.35 },
                { role: 'Cable Tech', col: 0x3b82f6, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('cache') || fn.includes('edge compute') || fn.includes('server')) {
            return [
                { role: 'CDN Eng', col: 0xf97316, xOff: bw * 0.3 },
                { role: 'Cache Ops', col: 0x94a3b8, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('dish') || fn.includes('tracking') || fn.includes('antenna')) {
            return [
                { role: 'Sat Ops', col: 0xa855f7, xOff: bw * 0.3 },
                { role: 'RF Engineer', col: 0x64748b, xOff: bw * 0.65 }
            ];
        } else if (fn.includes('incident') || fn.includes('ops deck')) {
            return [
                { role: 'Incident Cmdr', col: 0xef4444, xOff: bw * 0.4 },
                { role: 'Comms Lead', col: 0x94a3b8, xOff: bw * 0.6 }
            ];
        } else if (fn.includes('waf') || fn.includes('noc desk')) {
            return [{ role: 'Security Eng', col: 0xef4444, xOff: bw * 0.5 }];
        } else if (fn.includes('executive') || fn.includes('boardroom')) {
            return [{ role: 'VP Infra', col: 0xfbbf24, xOff: bw * 0.5 }];
        } else if (fn.includes('rooftop') || fn.includes('terrace')) {
            return []; // No NPCs on rooftop antenna array
        } else {
            return [{ role: 'Technician', col: 0x64748b, xOff: bw * 0.5 }];
        }
    },

    // ════════════════════════════════════════════════════
    //   PIXEL ART NPC
    // ════════════════════════════════════════════════════

    _drawReceptionDesk(c, x, y, col) {
        const g = new PIXI.Graphics();
        g.beginFill(0x1a2540); g.drawRect(x, y - 14, 60, 14); g.endFill();
        g.beginFill(0x0f1a2d); g.drawRect(x, y - 14, 60, 2); g.endFill();
        g.beginFill(col, 0.4); g.drawRect(x + 4, y - 12, 52, 1); g.endFill();
        g.beginFill(0x0a0f1a); g.drawRect(x + 36, y - 24, 18, 10); g.endFill();
        g.beginFill(col, 0.45); g.drawRect(x + 38, y - 22, 14, 6); g.endFill();
        g.beginFill(0xfbbf24); g.drawRect(x + 8, y - 18, 8, 6); g.endFill();
        g.beginFill(0xffffff, 0.6); g.drawRect(x + 9, y - 17, 6, 4); g.endFill();
        UI.tip(g, 'Reception Desk');
        c.addChild(g);
    },

    drawNPC(c, x, y, role, col) {
        const colHex = col || 0x64748b;
        const bw = 16, h = 32, headH = Math.round(32 * 0.4), bodyH = h - headH - 4, legH = 4, eyeS = Math.max(1, 16 * 0.08);
        const cont = new PIXI.Container();

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.38, eyeS); head.drawCircle(bw * 0.1, headH * 0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5); head.endFill();
        head.y = -h;

        const body = new PIXI.Graphics();
        body.beginFill(colHex); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        body.y = -h + headH;

        const lw = Math.max(2, bw * 0.25), lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x3d2914); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x3d2914); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15;

        const dot = new PIXI.Graphics();
        dot.beginFill(colHex); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;

        cont.addChild(shadow, legL, legR, body, head, dot);
        cont.x = x; cont.y = y;

        const txt = new PIXI.Text(role, { fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: colHex });
        txt.anchor.set(0.5, 1); txt.y = -h - 8;
        cont.addChild(txt);

        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                UI.selectModel({ id: 'bb_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true, _trackType: 'npc', role: role, lab: 'backbone', desc: role + '. Backbone Infrastructure.' });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, role, 'Backbone Infrastructure');
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
        });

        const npcId = 'bb_' + role.replace(/\s/g, '_').toLowerCase();
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }

        c.addChild(cont);

        const agent = {
            m: { id: npcId, name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.8,
            role, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   NPC ANIMATION STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const BACKBONE_MSGS = [
            "BGP converged.", "Latency nominal.", "Cache hit 94%.",
            "Fiber signal clean.", "Peering session up.", "Route flap detected.",
            "DDoS mitigated.", "Failover tested.", "Patch panel traced.",
            "Satellite lock OK.", "Traffic spike — scaling.", "All green."
        ];

        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            switch (av.state) {
                case 'working': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.03 + av.deskX)) * 0.3;
                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.3) {
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 120;
                            av.targetX = Math.max(30, Math.min(G.vpW - 30, av.targetX));
                        } else if (r < 0.5) {
                            av.state = 'chatting';
                            av.timer = 80 + Math.floor(Math.random() * 60);
                            this.spawnBubble(av, BACKBONE_MSGS[Math.floor(Math.random() * BACKBONE_MSGS.length)]);
                        } else {
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.3) {
                                this.spawnBubble(av, BACKBONE_MSGS[Math.floor(Math.random() * BACKBONE_MSGS.length)]);
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
                        if (av.label) av.label.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    av.head.y = -av._h + Math.sin(G.tick * 0.12) * 1.5;
                    av.body.y = -av._h + av._h * 0.4 + Math.abs(Math.sin(G.tick * 0.12)) * 1.5;
                    av.legL.y = Math.sin(G.tick * 0.15) * 2.5;
                    av.legR.y = -Math.sin(G.tick * 0.15) * 2.5;
                    break;
                }
                case 'chatting': {
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
        const txt = new PIXI.Text(msg, { fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        txt.anchor.set(0.5, 1); txt.y = -6;
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
    },

    // ════════════════════════════════════════════════════
    //   UPDATE LOOP
    // ════════════════════════════════════════════════════

    update() {
        // Paint DOM sky gradient + celestial gfx + twinkle stars
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        // Animate LEDs on war room screens (flicker effect)
        if (this.scene) {
            const fc = G.tick || 0;
            this.indoorLights.forEach(l => {
                if (l._flicker) l.alpha = 0.3 + Math.sin(fc * 0.05 + l._phase) * 0.3;
            });
        }
        if (this._lift && !this._lift.destroyed) this._lift.update();
        // Animate NPCs
        this.updateAvatars();
    }
};
