/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR AMBASSADOR RESIDENCE (v1.0.0 — Embassy Quarter luxury residences)
   Self-contained interior module for the six national ambassador residences on Embassy Row.
   Four themed floors per residence:
     • Wine Cellar (basement)   — vaulted stone, wine racks, safe, tasting table
     • Grand Reception / Dining — marble floor, chandelier, formal dining table, fireplace, portraits
     • Study / Library          — floor-to-ceiling bookshelves, leather chairs, globe, writing desk
     • Master Suite             — four-poster bed, vanity, wardrobe, ambassador sleeps at night
   Per-country theming uses the same style keys as the exterior (georgian/pagoda/haussmann/
   victorian/haveli/arabian) — wall colours, floor pattern, and ornament change per country.
   Day state: empty — the ambassador + family are at the embassy or in the city.
   Night state: ambassador sleeping in master suite; optional butler polishing silver in reception.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorAmbassadorRes = {
    scene: null, layer: null, bld: null, avatars: [], bubbles: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    // Country-specific theming. Keys match bld.id.
    COUNTRIES: {
        diplomat_villa_us: {
            full: 'UNITED STATES OF AMERICA',
            title: 'AMBASSADOR', familyName: 'AMBASSADOR & MRS.',
            style: 'georgian',
            wallCol: 0xf5f0e4,      // cream plaster
            floorCol: 0x6b3d26,     // walnut
            trimCol: 0xe9e4d2,      // white trim
            accent: 0x002868,       // navy
            warm: 0xbf0a30,         // red
            artSubject: 'FOUNDING FATHER',
            wineLabels: ['NAPA RES.', 'SONOMA', 'OREGON PN', 'KENTUCKY']
        },
        diplomat_villa_cn: {
            full: 'PEOPLE\'S REPUBLIC OF CHINA',
            title: '大使', familyName: '大使及夫人',
            style: 'pagoda',
            wallCol: 0xf7e9d1,      // cream silk
            floorCol: 0x3a1f10,     // lacquered red-brown
            trimCol: 0xffde00,      // gold trim
            accent: 0xde2910,       // red
            warm: 0xffde00,         // gold
            artSubject: '山水画',
            wineLabels: ['茅台', '五粮液', '汾酒', '龙井']
        },
        diplomat_villa_eu: {
            full: 'EUROPEAN UNION DELEGATION',
            title: 'REPRÉSENTANT', familyName: 'LE REPRÉSENTANT',
            style: 'haussmann',
            wallCol: 0xe9dfc9,      // parisian cream
            floorCol: 0x7a5a2a,     // parquet oak
            trimCol: 0xfbbf24,      // gilded moulding
            accent: 0x003399,       // eu blue
            warm: 0xffcc00,         // eu gold
            artSubject: 'RENAISSANCE',
            wineLabels: ['BORDEAUX', 'CHAMPAGNE', 'CHIANTI', 'RIOJA']
        },
        diplomat_villa_uk: {
            full: 'UNITED KINGDOM',
            title: 'HIGH COMMISSIONER', familyName: 'HIS EXCELLENCY',
            style: 'victorian',
            wallCol: 0x8a3a2a,      // deep oxblood wallpaper
            floorCol: 0x3a1f10,     // dark stained oak
            trimCol: 0xe9d7a8,      // ivory trim
            accent: 0x012169,       // navy
            warm: 0xc8102e,         // red
            artSubject: 'TURNER LANDSCAPE',
            wineLabels: ['CLARET', 'PORT', 'SHERRY', 'SCOTCH']
        },
        diplomat_villa_in: {
            full: 'REPUBLIC OF INDIA',
            title: 'उच्चायुक्त', familyName: 'HIS EXCELLENCY',
            style: 'haveli',
            wallCol: 0xf5d7a8,      // sandstone
            floorCol: 0x9a5a2a,     // terracotta
            trimCol: 0xfbbf24,      // brass
            accent: 0xff9933,       // saffron
            warm: 0x138808,         // india green
            artSubject: 'MUGHAL MINIATURE',
            wineLabels: ['SULA', 'GROVER', 'FRATELLI', 'KING\'S']
        },
        diplomat_villa_ae: {
            full: 'UNITED ARAB EMIRATES',
            title: 'السفير', familyName: 'صاحب السعادة',
            style: 'arabian',
            wallCol: 0xf0e4cd,      // warm cream
            floorCol: 0xb89355,     // sand marble
            trimCol: 0xfbbf24,      // gold
            accent: 0x00732f,       // green
            warm: 0xce1126,         // red
            artSubject: 'CALLIGRAPHY',
            wineLabels: ['KARAK TEA', 'GAHWA', 'ROSEWATER', 'KUMIS']
        }
    },

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = [];

        // ─── SKY (shared helper for day/night lighting) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const country = this.COUNTRIES[bld.id] || this.COUNTRIES.diplomat_villa_us;
        const accent = bld.accent || country.accent || 0x002868;
        const warm = country.warm || 0xbf0a30;
        const flagCols = bld.flagColors || [accent, 0xffffff, warm];

        const floorH = 92, startX = 60, bldW = G.vpW - 120;
        // Top-down list: 0 = top (master suite), descending through study, reception, cellar (basement).
        const floors = [
            { key: 'cellar',    label: 'WINE CELLAR' },            // basement (-1)
            { key: 'reception', label: 'GRAND RECEPTION' },        // ground (0)
            { key: 'study',     label: 'STUDY & LIBRARY' },        // 1
            { key: 'master',    label: 'MASTER SUITE' }            // 2 (top)
        ];
        const numFloors = floors.length - 1; // basement separate
        const roofH = 78;
        this.totalH = roofH + (numFloors + 1) * floorH + 220;

        // ─── ROOF (style-specific mansard / pagoda / pitched) + flag ───
        this._drawRoof(this.scene, startX, bldW, roofH, flagCols, accent, warm, country, bld.name);

        // ─── FLOORS (top-down render: index 0 = top) ───
        const winMarginX = 60;
        const winY_off = 22;
        const winH_px = floorH - 36;

        for (let f = -1; f < numFloors; f++) {
            const isBasement = f === -1;
            const floorDef = isBasement ? floors[0] : floors[numFloors - f];
            const fy = roofH + (numFloors - 1 - f) * floorH;

            const rg = new PIXI.Graphics();
            // Side walls — cream plaster stucco instead of glass (residence, not office)
            rg.beginFill(0xc6bfa2); rg.drawRect(startX - 6, fy, 6, floorH); rg.drawRect(startX + bldW, fy, 6, floorH); rg.endFill();
            // Wall base colour from country theme (basement always stone)
            const wallCol = isBasement ? 0x2a2418 : country.wallCol;
            rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();

            if (!isBasement) {
                // Residential windows — sash style with decorative surrounds
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                this._drawResidenceWindow(rg, winX, winY, winW, winH_px, accent, country.trimCol, country.style);
                // Horizontal moulding band (architrave) below ceiling
                rg.beginFill(country.trimCol); rg.drawRect(startX, fy, bldW, 4); rg.endFill();
                rg.beginFill(accent, 0.2); rg.drawRect(startX, fy + 4, bldW, 1); rg.endFill();
                // Baseboard at bottom
                rg.beginFill(country.trimCol, 0.8); rg.drawRect(startX, fy + floorH - 10, bldW, 4); rg.endFill();
            } else {
                // Vaulted cellar — stone arches
                for (let bx = startX + 20; bx < startX + bldW - 20; bx += 60) {
                    rg.beginFill(0x1d180e, 0.5); rg.drawEllipse(bx + 25, fy + 12, 24, 10); rg.endFill();
                    rg.beginFill(country.wallCol === 0x2a2418 ? 0x3a2f22 : 0x3a2f22, 0.35); rg.drawEllipse(bx + 25, fy + 12, 20, 8); rg.endFill();
                }
                // Stone brick pattern
                for (let bx = startX; bx < startX + bldW; bx += 20) {
                    rg.beginFill(0x1d180e, 0.45); rg.drawRect(bx + 1, fy + 30, 18, 2); rg.endFill();
                    rg.beginFill(0x1d180e, 0.45); rg.drawRect(bx + 11, fy + 44, 18, 2); rg.endFill();
                    rg.beginFill(0x1d180e, 0.45); rg.drawRect(bx + 1, fy + 58, 18, 2); rg.endFill();
                }
            }

            // Floor slab divider
            rg.beginFill(0xa8a288); rg.drawRect(startX, fy + floorH - 6, bldW, 6); rg.endFill();
            rg.beginFill(0x8a8268); rg.drawRect(startX - 6, fy + floorH - 3, bldW + 12, 3); rg.endFill();
            this.scene.addChild(rg);

            // Floor label
            const fl = new PIXI.Text(floorDef.label, {
                fontFamily: 'JetBrains Mono', fontSize: 7, fill: isBasement ? 0xc6bfa2 : accent, letterSpacing: 2, fontWeight: 'bold'
            });
            fl.anchor.set(0.5, 0); fl.x = startX + bldW / 2; fl.y = fy + 6; this.scene.addChild(fl);

            // Props + NPCs per floor — reserve a 50px right-side bay for the elevator
            const ELEV_BAY = 50;
            const propBw = bldW - ELEV_BAY;
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, propBw, pY, fy, floorH, floorDef.key, accent, warm, country, flagCols);

            // NPC spawn per floor. Day: empty (ambassador at embassy).
            // Night: ambassador sleeping in master suite; butler in reception polishing silver.
            const dpNow = G.getDayPhase();
            const isNight = dpNow > 0.83 || dpNow < 0.25;
            const isDeepNight = dpNow > 0.9 || dpNow < 0.22;
            this._spawnFloorNPCs(fc, startX, propBw, pY, fy, floorH, floorDef.key, accent, warm, country, isNight, isDeepNight);
        }

        // ─── GROUND ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x3a2b18); earth.drawRect(0, groundY, startX - 6, floorH); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, floorH); earth.endFill();
        earth.beginFill(0x523d22); earth.drawRect(0, groundY, startX - 6, 6); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, 6); earth.endFill();
        // Manicured lawn strip
        earth.beginFill(0x3d6e3b); earth.drawRect(0, groundY - 2, startX - 6, 4); earth.drawRect(startX + bldW + 6, groundY - 2, G.vpW - startX - bldW - 6, 4); earth.endFill();
        // Garden hedges
        for (let hx = 10; hx < startX - 10; hx += 14) {
            earth.beginFill(0x2d5e2b); earth.drawCircle(hx, groundY - 2, 5); earth.endFill();
        }
        for (let hx = startX + bldW + 16; hx < G.vpW - 10; hx += 14) {
            earth.beginFill(0x2d5e2b); earth.drawCircle(hx, groundY - 2, 5); earth.endFill();
        }
        this.scene.addChild(earth);

        // ─── ZONE-AWARE UNDERGROUND ───
        const surfaceY = groundY;
        const belowBasementY = roofH + (numFloors + 1) * floorH;
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── ELEVATOR (residence staircase alternative — small private lift) ───
        const elevatorX = startX + bldW - 30;
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container();
            ec.y = groundY;
            this.scene.addChild(ec);
            const em = new PIXI.Graphics();
            em.beginFill(0xffffff);
            em.drawRect(startX, -numFloors * floorH, bldW, (numFloors + 1) * floorH);
            em.endFill();
            ec.addChild(em);
            ec.mask = em;
            this._lift = new CityElevator(ec, numFloors, floorH, elevatorX);
        }

        // Position + drag-scroll
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
            if (!InteriorAmbassadorRes.isDragging || !InteriorAmbassadorRes.scene || InteriorAmbassadorRes.scene.destroyed) return;
            let ny = InteriorAmbassadorRes._startSceneY + (e.clientY - InteriorAmbassadorRes._startY);
            ny = Math.max(InteriorAmbassadorRes.minY, Math.min(ny, InteriorAmbassadorRes.maxY));
            InteriorAmbassadorRes.scene.y = ny;
        };
        this._onUp = () => {
            InteriorAmbassadorRes.isDragging = false;
            if (InteriorAmbassadorRes.layer) InteriorAmbassadorRes.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    // ════════════════════════════════════════════════════
    //   ROOF — Style-specific mansard / pagoda / pitched + flag
    // ════════════════════════════════════════════════════
    _drawRoof(c, sx, bw, roofH, flagCols, accent, warm, country, bldName) {
        const g = new PIXI.Graphics();
        const st = country.style || 'georgian';

        if (st === 'pagoda') {
            // Pagoda: tiered curved eaves with upturned corners
            g.beginFill(0x8a2a1a);
            g.moveTo(sx - 12, roofH);
            g.quadraticCurveTo(sx - 20, roofH - 18, sx + 12, roofH - 20);
            g.lineTo(sx + bw - 12, roofH - 20);
            g.quadraticCurveTo(sx + bw + 20, roofH - 18, sx + bw + 12, roofH);
            g.closePath();
            g.endFill();
            // Second tier
            g.beginFill(0xb33a22);
            g.moveTo(sx + 30, roofH - 20);
            g.quadraticCurveTo(sx + 20, roofH - 36, sx + 50, roofH - 42);
            g.lineTo(sx + bw - 50, roofH - 42);
            g.quadraticCurveTo(sx + bw - 20, roofH - 36, sx + bw - 30, roofH - 20);
            g.closePath();
            g.endFill();
            // Gold trim
            g.beginFill(warm, 0.85); g.drawRect(sx + 12, roofH - 22, bw - 24, 2); g.endFill();
            g.beginFill(warm, 0.85); g.drawRect(sx + 50, roofH - 44, bw - 100, 2); g.endFill();
            // Ridge tiles
            for (let tx = sx + 20; tx < sx + bw - 20; tx += 10) {
                g.beginFill(0x6a1a0a, 0.65); g.drawRect(tx, roofH - 14, 8, 2); g.endFill();
            }
        } else if (st === 'haussmann') {
            // Mansard: steep slate upper roof with dormer windows
            g.beginFill(0x2a2a38);
            g.moveTo(sx, roofH);
            g.lineTo(sx + 14, roofH - 44);
            g.lineTo(sx + bw - 14, roofH - 44);
            g.lineTo(sx + bw, roofH);
            g.closePath();
            g.endFill();
            // Flat top cap
            g.beginFill(0x1a1a28); g.drawRect(sx + 14, roofH - 46, bw - 28, 4); g.endFill();
            // Dormers
            const numDormers = 3;
            const spacing = (bw - 60) / numDormers;
            for (let di = 0; di < numDormers; di++) {
                const dx = sx + 30 + di * spacing + spacing / 2;
                g.beginFill(country.trimCol); g.drawRect(dx - 7, roofH - 30, 14, 14); g.endFill();
                g.beginFill(0xffe9a8, 0.55); g.drawRect(dx - 5, roofH - 28, 10, 10); g.endFill();
                g.beginFill(country.trimCol);
                g.drawPolygon([dx - 8, roofH - 30, dx, roofH - 38, dx + 8, roofH - 30]);
                g.endFill();
                this.indoorLights.push({ g, maxA: 1, type: 'dormer' });
            }
            // Gold gilded cornice
            g.beginFill(warm, 0.75); g.drawRect(sx, roofH - 4, bw, 4); g.endFill();
        } else if (st === 'haveli') {
            // Sandstone dome + carved parapet with cupolas
            g.beginFill(0xd9a04f); g.drawRect(sx, roofH - 24, bw, 24); g.endFill();
            // Jali lattice band
            for (let jx = sx + 6; jx < sx + bw - 6; jx += 8) {
                g.beginFill(0xb8843a, 0.6); g.drawRect(jx, roofH - 20, 4, 12); g.endFill();
                g.beginFill(0xf5d7a8, 0.5); g.drawRect(jx + 1, roofH - 19, 2, 10); g.endFill();
            }
            // Cupola domes
            for (const cx of [sx + 30, sx + bw - 30]) {
                g.beginFill(0xd9a04f); g.drawEllipse(cx, roofH - 24, 12, 10); g.endFill();
                g.beginFill(warm, 0.85); g.drawRect(cx - 1, roofH - 40, 2, 6); g.endFill();
                g.beginFill(warm, 0.85); g.drawCircle(cx, roofH - 41, 2); g.endFill();
            }
            // Central larger dome
            g.beginFill(0xd9a04f); g.drawEllipse(sx + bw / 2, roofH - 24, 22, 16); g.endFill();
            g.beginFill(warm, 0.4); g.drawEllipse(sx + bw / 2, roofH - 28, 18, 10); g.endFill();
        } else if (st === 'arabian') {
            // Flat parapet with crescent moon finial + crenelated trim
            g.beginFill(country.wallCol); g.drawRect(sx, roofH - 20, bw, 20); g.endFill();
            // Crenelations
            for (let tx = sx; tx < sx + bw; tx += 16) {
                g.beginFill(country.wallCol); g.drawRect(tx, roofH - 28, 10, 8); g.endFill();
            }
            // Gold trim line
            g.beginFill(warm, 0.85); g.drawRect(sx, roofH - 22, bw, 2); g.endFill();
            // Crescent moon finial centre
            const cx = sx + bw / 2;
            g.beginFill(warm, 0.9); g.drawCircle(cx, roofH - 40, 4); g.endFill();
            g.beginFill(country.wallCol); g.drawCircle(cx + 1.5, roofH - 41, 3.5); g.endFill();
        } else if (st === 'victorian') {
            // Pitched slate roof with chimneys
            g.beginFill(0x3a1f10);
            g.drawPolygon([sx, roofH, sx + bw / 2, 8, sx + bw, roofH]);
            g.endFill();
            // Slate texture lines
            g.lineStyle(0.5, 0x2a1508, 0.7);
            for (let i = 1; i < 5; i++) {
                g.moveTo(sx + i * (bw / 10), roofH - i * 4);
                g.lineTo(sx + bw - i * (bw / 10), roofH - i * 4);
            }
            g.lineStyle(0);
            // Two brick chimneys
            for (const cx of [sx + bw * 0.25, sx + bw * 0.75]) {
                g.beginFill(0x6b3026); g.drawRect(cx - 5, roofH - 40, 10, 24); g.endFill();
                g.beginFill(0x4a1f18); g.drawRect(cx - 5, roofH - 40, 10, 2); g.endFill();
                // Smoke puffs
                g.beginFill(0xc6bfa2, 0.35); g.drawCircle(cx, roofH - 44, 2); g.drawCircle(cx + 2, roofH - 47, 2.5); g.endFill();
            }
        } else {
            // Georgian: classical pediment with gable
            g.beginFill(0xe9e4d2);
            g.drawPolygon([sx, roofH - 12, sx + bw / 2, 10, sx + bw, roofH - 12]);
            g.endFill();
            g.beginFill(accent, 0.55);
            g.drawPolygon([sx + 18, roofH - 14, sx + bw / 2, 18, sx + bw - 18, roofH - 14]);
            g.endFill();
            g.lineStyle(1.5, 0xa8a288, 0.9);
            g.moveTo(sx, roofH - 12); g.lineTo(sx + bw / 2, 10); g.lineTo(sx + bw, roofH - 12);
            g.lineStyle(0);
            // Red brick chimney
            g.beginFill(0x6b3026); g.drawRect(sx + bw * 0.75, roofH - 36, 10, 22); g.endFill();
            g.beginFill(0x4a1f18); g.drawRect(sx + bw * 0.75, roofH - 36, 10, 2); g.endFill();
            // Architrave band
            g.beginFill(country.trimCol); g.drawRect(sx, roofH - 12, bw, 12); g.endFill();
            g.beginFill(accent, 0.35); g.drawRect(sx, roofH - 12, bw, 3); g.endFill();
        }
        c.addChild(g);

        // ─── Flying flag on pole at apex ───
        const flagCont = new PIXI.Container();
        flagCont.x = sx + bw / 2; flagCont.y = 10;
        const pole = new PIXI.Graphics();
        pole.beginFill(0x7a7a7a); pole.drawRect(-1.5, -62, 3, 62); pole.endFill();
        pole.beginFill(0xfbbf24); pole.drawCircle(0, -62, 3); pole.endFill();
        flagCont.addChild(pole);
        const flag = new PIXI.Graphics();
        const fw = 34, fh = 22;
        // Country-accurate flag via shared helper
        const countryCode = (this.bld && this.bld.country) || (this.bld && this.bld.id ? this.bld.id.replace('diplomat_villa_', '') : 'us');
        if (typeof EmbassyRow !== 'undefined' && EmbassyRow.drawCountryFlag) {
            EmbassyRow.drawCountryFlag(flag, countryCode, fw, fh);
        } else {
            const sh = fh / Math.max(1, flagCols.length);
            flagCols.forEach((col, i) => { flag.beginFill(col); flag.drawRect(0, i * sh, fw, sh); flag.endFill(); });
        }
        flag.x = 2; flag.y = -57; flag.pivot.set(0, fh * 0.5);
        flagCont.addChild(flag);
        c.addChild(flagCont);
        this._roofFlag = flag;

        // ─── Name plaque on facade ───
        const plaqueW = Math.min(340, bw - 80);
        const pl = new PIXI.Graphics();
        pl.beginFill(0x1a1a28, 0.92);
        pl.drawRoundedRect(sx + bw / 2 - plaqueW / 2, roofH - 8, plaqueW, 22, 4);
        pl.endFill();
        pl.lineStyle(1.2, warm, 0.85);
        pl.drawRoundedRect(sx + bw / 2 - plaqueW / 2, roofH - 8, plaqueW, 22, 4);
        pl.lineStyle(0);
        c.addChild(pl);
        const plTxt = new PIXI.Text((bldName || '').toUpperCase(), {
            fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold',
            fill: 0xfffbe8, letterSpacing: 1.8
        });
        plTxt.anchor.set(0.5, 0.5);
        plTxt.x = sx + bw / 2; plTxt.y = roofH + 3;
        if (plTxt.width > plaqueW - 20) plTxt.scale.set((plaqueW - 20) / plTxt.width);
        c.addChild(plTxt);
    },

    // ════════════════════════════════════════════════════
    //   WINDOW — Residence sash window with decorative surround
    // ════════════════════════════════════════════════════
    _drawResidenceWindow(g, x, y, w, h, accent, trimCol, style) {
        // Background frame
        g.beginFill(0x1a1a28); g.drawRect(x - 3, y - 3, w + 6, h + 6); g.endFill();
        // Glass (warm glow from within)
        g.beginFill(0xffe9a8, 0.55); g.drawRect(x, y, w, h); g.endFill();

        // Mullions: 2 vertical + 1 horizontal crossing (traditional sash)
        g.lineStyle(0.8, trimCol, 0.85);
        for (let i = 1; i < 3; i++) {
            const mx = x + (w / 3) * i;
            g.moveTo(mx, y); g.lineTo(mx, y + h);
        }
        g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5);
        g.lineStyle(0);

        // Style-specific decorative surround
        if (style === 'pagoda') {
            // Upturned eave above
            g.beginFill(0x8a2a1a);
            g.moveTo(x - 6, y - 4); g.quadraticCurveTo(x + w / 2, y - 12, x + w + 6, y - 4);
            g.lineTo(x + w + 4, y - 2); g.lineTo(x - 4, y - 2); g.closePath();
            g.endFill();
        } else if (style === 'victorian') {
            // Pointed arch header + bay window projection
            g.beginFill(0x8a3a2a);
            g.drawPolygon([x - 3, y - 3, x + w / 2, y - 10, x + w + 3, y - 3]);
            g.endFill();
        } else if (style === 'haveli') {
            // Jharokha scalloped arch
            g.beginFill(0xd9a04f);
            g.drawPolygon([x - 3, y - 3, x + w * 0.2, y - 8, x + w * 0.5, y - 4, x + w * 0.8, y - 8, x + w + 3, y - 3]);
            g.endFill();
            // Carved brackets
            g.beginFill(0xb8843a); g.drawRect(x - 3, y + h - 6, 3, 6); g.drawRect(x + w, y + h - 6, 3, 6); g.endFill();
        } else if (style === 'arabian') {
            // Pointed mashrabiya arch + geometric lattice over glass
            g.beginFill(accent);
            g.drawPolygon([x - 3, y - 3, x + w / 2, y - 12, x + w + 3, y - 3]);
            g.endFill();
            g.lineStyle(0.4, trimCol, 0.7);
            for (let lx = x + 4; lx < x + w; lx += 6) {
                g.moveTo(lx, y); g.lineTo(lx, y + h);
            }
            g.lineStyle(0);
        } else {
            // Georgian/Haussmann: simple pediment + sill
            g.beginFill(trimCol);
            g.drawRect(x - 4, y - 4, w + 8, 3);
            g.drawRect(x - 5, y + h, w + 10, 3);
            g.endFill();
        }

        // Drapes (elegant side curtains, always present for residence)
        g.beginFill(accent, 0.55); g.drawRect(x - 2, y, 4, h); g.endFill();
        g.beginFill(accent, 0.55); g.drawRect(x + w - 2, y, 4, h); g.endFill();
        g.beginFill(trimCol, 0.45); g.drawRect(x - 2, y, 4, 2); g.drawRect(x + w - 2, y, 4, 2); g.endFill();
    },

    // ════════════════════════════════════════════════════
    //   FLOOR PROP RENDERERS
    // ════════════════════════════════════════════════════
    _drawFloorProps(c, sx, bw, pY, fy, fh, key, accent, warm, country, flagCols) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';

        if (key === 'reception') {
            // ─── Marble checkered floor ───
            g.beginFill(country.floorCol); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            for (let ix = sx + 10; ix < sx + bw - 10; ix += 28) {
                g.beginFill(country.trimCol, 0.3); g.drawRect(ix, pY - 4, 14, 4); g.endFill();
            }
            // Accent runner rug down the centre
            const rugW = bw * 0.58, rugX = sx + bw / 2 - rugW / 2;
            g.beginFill(accent, 0.65); g.drawRect(rugX, pY - 4, rugW, 4); g.endFill();
            g.beginFill(warm, 0.35); g.drawRect(rugX + 10, pY - 3, rugW - 20, 2); g.endFill();
            g.beginFill(country.trimCol, 0.5); g.drawRect(rugX + 16, pY - 2, rugW - 32, 1); g.endFill();

            // ─── Formal dining table centre ───
            const tW = bw * 0.46, tX = sx + bw / 2 - tW / 2;
            g.beginFill(0x3a1f10); g.drawRoundedRect(tX, pY - 20, tW, 18, 3); g.endFill();
            g.beginFill(0x4a2e18); g.drawRect(tX + 2, pY - 20, tW - 4, 3); g.endFill();
            // White linen tablecloth
            g.beginFill(0xfffbe8, 0.92); g.drawRect(tX + 4, pY - 19, tW - 8, 14); g.endFill();
            g.beginFill(accent, 0.3); g.drawRect(tX + 4, pY - 19, tW - 8, 1); g.endFill();
            c.addChild(g);

            // Silverware + candelabra settings along the table
            const placeSettings = 6;
            const pSp = (tW - 16) / placeSettings;
            for (let ps = 0; ps < placeSettings; ps++) {
                const psX = tX + 12 + ps * pSp;
                const ps_g = new PIXI.Graphics(); ps_g.eventMode = 'none';
                // Plate
                ps_g.beginFill(0xfffbe8); ps_g.drawCircle(psX, pY - 12, 2.5); ps_g.endFill();
                ps_g.beginFill(country.trimCol, 0.8); ps_g.drawCircle(psX, pY - 12, 1.2); ps_g.endFill();
                ps_g.beginFill(accent, 0.6); ps_g.drawCircle(psX, pY - 12, 0.6); ps_g.endFill();
                // Wine glass
                ps_g.beginFill(0xcce6ff, 0.55); ps_g.drawRect(psX - 0.8, pY - 18, 1.6, 3); ps_g.endFill();
                c.addChild(ps_g);
            }
            // Silver candelabra centrepieces (3)
            for (let ci = 0; ci < 3; ci++) {
                const cX = tX + tW / 4 + ci * (tW / 4);
                const cg = new PIXI.Graphics(); cg.eventMode = 'none';
                cg.beginFill(0xc0c6d0); cg.drawRect(cX - 1, pY - 14, 2, 6); cg.endFill();
                cg.beginFill(0xc0c6d0); cg.drawRect(cX - 4, pY - 20, 8, 2); cg.endFill();
                // Candles
                for (let cand = -1; cand <= 1; cand++) {
                    cg.beginFill(0xfffbe8); cg.drawRect(cX + cand * 3 - 0.5, pY - 24, 1, 4); cg.endFill();
                    // Flame
                    cg.beginFill(0xfbbf24, 0.9); cg.drawEllipse(cX + cand * 3, pY - 26, 0.9, 1.4); cg.endFill();
                    cg.beginFill(0xffe9a8, 0.7); cg.drawEllipse(cX + cand * 3, pY - 26, 0.5, 1); cg.endFill();
                }
                c.addChild(cg);
                this.indoorLights.push({ g: cg, maxA: 1, type: 'candle' });
            }

            // ─── Dining chairs flanking the table (6 on each side) ───
            for (let ci = 0; ci < 6; ci++) {
                const cOff = tX + 8 + ci * (tW / 6);
                const ch = new PIXI.Graphics(); ch.eventMode = 'none';
                // Seat
                ch.beginFill(0x3a1f10); ch.drawRect(cOff, pY - 6, 10, 6); ch.endFill();
                // High back
                ch.beginFill(0x4a2e18); ch.drawRect(cOff + 1, pY - 20, 8, 14); ch.endFill();
                ch.beginFill(accent, 0.75); ch.drawRect(cOff + 2, pY - 12, 6, 4); ch.endFill();
                c.addChild(ch);
            }

            // ─── Grand chandelier above table ───
            const ch2 = new PIXI.Graphics(); ch2.eventMode = 'none';
            const chX = sx + bw / 2;
            ch2.beginFill(0x1a1a28); ch2.drawRect(chX - 0.5, fy + 8, 1, 16); ch2.endFill();
            ch2.beginFill(country.trimCol); ch2.drawCircle(chX, fy + 28, 8); ch2.endFill();
            ch2.beginFill(0xffe9a8, 0.85); ch2.drawCircle(chX, fy + 28, 5.5); ch2.endFill();
            // 8 crystal arms
            for (let arm = 0; arm < 8; arm++) {
                const aa = (arm / 8) * Math.PI * 2;
                const ax = chX + Math.cos(aa) * 16;
                const ay = fy + 28 + Math.sin(aa) * 6;
                ch2.beginFill(country.trimCol); ch2.drawCircle(ax, ay, 2); ch2.endFill();
                ch2.beginFill(0xffe9a8, 0.8); ch2.drawCircle(ax, ay, 1.2); ch2.endFill();
                // Crystal droplet
                ch2.beginFill(0xcce6ff, 0.7); ch2.drawPolygon([ax, ay + 2, ax - 1, ay + 5, ax + 1, ay + 5]); ch2.endFill();
            }
            c.addChild(ch2);
            this.indoorLights.push({ g: ch2, maxA: 1, type: 'chandelier' });

            // ─── Grand fireplace on left wall with oil painting above ───
            const fpX = sx + 18, fpW = 60, fpY = pY - 34;
            const fp = new PIXI.Graphics(); fp.eventMode = 'none';
            // Marble mantle
            fp.beginFill(country.trimCol); fp.drawRect(fpX - 4, fpY - 4, fpW + 8, 4); fp.endFill();
            fp.beginFill(0xe9e4d2); fp.drawRect(fpX, fpY, fpW, 34); fp.endFill();
            // Hearth opening
            fp.beginFill(0x1a0a04); fp.drawRect(fpX + 12, fpY + 8, fpW - 24, 22); fp.endFill();
            // Fire (only at night)
            fp.beginFill(0xfbbf24, 0.85); fp.drawEllipse(fpX + fpW / 2, fpY + 24, 8, 5); fp.endFill();
            fp.beginFill(0xbf0a30, 0.75); fp.drawEllipse(fpX + fpW / 2, fpY + 26, 5, 3); fp.endFill();
            fp.beginFill(0xffe9a8, 0.7); fp.drawEllipse(fpX + fpW / 2, fpY + 25, 3, 2); fp.endFill();
            // Logs
            fp.beginFill(0x3a1f10); fp.drawRect(fpX + 16, fpY + 27, 6, 3); fp.drawRect(fpX + 26, fpY + 26, 6, 3); fp.drawRect(fpX + 36, fpY + 27, 6, 3); fp.endFill();
            c.addChild(fp);
            this.indoorLights.push({ g: fp, maxA: 1, type: 'fire' });
            // Portrait above fireplace
            const port = new PIXI.Graphics(); port.eventMode = 'none';
            const portY = fy + 14;
            port.beginFill(country.trimCol); port.drawRect(fpX + 6, portY, fpW - 12, 32); port.endFill();
            port.beginFill(0x4a2e18); port.drawRect(fpX + 8, portY + 2, fpW - 16, 28); port.endFill();
            port.beginFill(accent, 0.45); port.drawRect(fpX + 10, portY + 4, fpW - 20, 24); port.endFill();
            // Silhouetted figure
            port.beginFill(0x1a1a28); port.drawEllipse(fpX + fpW / 2, portY + 14, 5, 6); port.endFill();
            port.beginFill(0x1a1a28); port.drawRect(fpX + fpW / 2 - 7, portY + 18, 14, 10); port.endFill();
            c.addChild(port);
            const pCap = new PIXI.Text(country.artSubject, {
                fontFamily: 'JetBrains Mono', fontSize: 4.5, fill: accent, fontWeight: 'bold', letterSpacing: 0.6
            });
            pCap.anchor.set(0.5, 0); pCap.x = fpX + fpW / 2; pCap.y = portY + 34;
            if (pCap.width > fpW - 8) pCap.scale.set((fpW - 8) / pCap.width);
            c.addChild(pCap);

            // ─── Potted palms / ornamentals flanking room ───
            this._drawOrnamental(c, sx + bw - 80, pY, country);
            this._drawOrnamental(c, sx + bw - 54, pY, country);

            // ─── Side console with vase of flowers ───
            const cnX = sx + bw - 40, cnY = pY;
            const cn = new PIXI.Graphics(); cn.eventMode = 'none';
            cn.beginFill(0x3a1f10); cn.drawRect(cnX, cnY - 16, 30, 16); cn.endFill();
            cn.beginFill(country.trimCol, 0.85); cn.drawRect(cnX, cnY - 16, 30, 2); cn.endFill();
            // Vase
            cn.beginFill(accent); cn.drawRect(cnX + 12, cnY - 22, 6, 6); cn.endFill();
            cn.beginFill(country.trimCol, 0.7); cn.drawRect(cnX + 12, cnY - 22, 6, 1); cn.endFill();
            // Flowers
            for (let fi = 0; fi < 5; fi++) {
                const fx = cnX + 10 + fi * 2.5;
                cn.beginFill(warm, 0.9); cn.drawCircle(fx, cnY - 26 - (fi % 2) * 2, 1.2); cn.endFill();
                cn.beginFill(0xfbbf24, 0.5); cn.drawCircle(fx, cnY - 26 - (fi % 2) * 2, 0.5); cn.endFill();
            }
            c.addChild(cn);

        } else if (key === 'study') {
            // ─── Rich hardwood parquet ───
            g.beginFill(country.floorCol); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            // Parquet herringbone pattern
            for (let ix = sx; ix < sx + bw; ix += 16) {
                g.beginFill(country.floorCol === 0x3a1f10 ? 0x2a1508 : 0x5a2d18, 0.45);
                g.drawRect(ix, pY - 4, 1, 4); g.endFill();
            }
            // Ornate rug
            const rugW = bw * 0.64, rugX = sx + bw / 2 - rugW / 2;
            g.beginFill(0x5a1a0a); g.drawRect(rugX, pY - 4, rugW, 4); g.endFill();
            g.beginFill(warm, 0.55); g.drawRect(rugX + 6, pY - 3, rugW - 12, 2); g.endFill();
            g.beginFill(country.trimCol, 0.5); g.drawRect(rugX + 12, pY - 2, rugW - 24, 1); g.endFill();
            c.addChild(g);

            // ─── Floor-to-ceiling bookshelves along back wall ───
            const bsX = sx + 18, bsY = fy + 10, bsW = bw * 0.42, bsH = fh - 32;
            const bs = new PIXI.Graphics(); bs.eventMode = 'none';
            bs.beginFill(0x3a1f10); bs.drawRect(bsX, bsY, bsW, bsH); bs.endFill();
            bs.beginFill(0x5a3d24); bs.drawRect(bsX, bsY, bsW, 3); bs.endFill();
            bs.beginFill(0x5a3d24); bs.drawRect(bsX, bsY + bsH - 3, bsW, 3); bs.endFill();
            // Book spines across 5 shelves
            const bookCols = [0x6b3d26, 0x3a1f10, 0x4a2e18, 0x1a3a5e, 0x7c4a30, accent, warm, 0x5a1a0a];
            const shelves = 5;
            const shelfH = (bsH - 6) / shelves;
            for (let row = 0; row < shelves; row++) {
                const rowY = bsY + 4 + row * shelfH;
                // Shelf divider
                bs.beginFill(0x5a3d24); bs.drawRect(bsX, rowY + shelfH - 2, bsW, 1); bs.endFill();
                for (let col = 0; col < Math.floor(bsW / 4.5); col++) {
                    const bkX = bsX + 2 + col * 4.5;
                    const bkCol = bookCols[(row * 20 + col) % bookCols.length];
                    const bkH = Math.max(6, shelfH - 4 - (col % 3));
                    bs.beginFill(bkCol); bs.drawRect(bkX, rowY + (shelfH - 2 - bkH), 3.5, bkH); bs.endFill();
                    bs.beginFill(country.trimCol, 0.3); bs.drawRect(bkX, rowY + (shelfH - 2 - bkH), 3.5, 0.8); bs.endFill();
                }
            }
            // Ladder on rail
            bs.beginFill(country.trimCol, 0.75); bs.drawRect(bsX + bsW * 0.6, bsY + 4, 2, bsH - 8); bs.endFill();
            bs.beginFill(0x5a3d24); bs.drawRect(bsX + bsW * 0.6 - 3, bsY + 6, 8, 2); bs.endFill();
            c.addChild(bs);

            // ─── Leather writing desk with brass lamp + globe ───
            const dW = bw * 0.3, dX = sx + bw - dW - 70;
            const dk = new PIXI.Graphics(); dk.eventMode = 'none';
            dk.beginFill(0x3a1f10); dk.drawRect(dX, pY - 22, dW, 22); dk.endFill();
            dk.beginFill(0x4a2e18); dk.drawRect(dX, pY - 22, dW, 3); dk.endFill();
            // Green leather writing surface
            dk.beginFill(0x14532d); dk.drawRect(dX + 4, pY - 22, dW - 8, 4); dk.endFill();
            dk.beginFill(country.trimCol, 0.5); dk.drawRect(dX + 4, pY - 22, dW - 8, 1); dk.endFill();
            // Drawer handles
            dk.beginFill(country.trimCol); dk.drawCircle(dX + 10, pY - 10, 0.8); dk.drawCircle(dX + dW - 10, pY - 10, 0.8); dk.endFill();
            // Brass banker's lamp
            dk.beginFill(country.trimCol); dk.drawRect(dX + 8, pY - 30, 2, 8); dk.endFill();
            dk.beginFill(0x14532d); dk.drawRect(dX + 2, pY - 34, 14, 4); dk.endFill();
            dk.beginFill(country.trimCol, 0.75); dk.drawRect(dX + 4, pY - 32, 10, 1); dk.endFill();
            dk.beginFill(0xffe9a8, 0.8); dk.drawRect(dX + 4, pY - 30, 10, 2); dk.endFill();
            // Papers + quill
            dk.beginFill(0xfffbe8); dk.drawRect(dX + 22, pY - 22, 16, 10); dk.endFill();
            dk.beginFill(accent, 0.45); dk.drawRect(dX + 24, pY - 20, 12, 1); dk.endFill();
            dk.beginFill(accent, 0.45); dk.drawRect(dX + 24, pY - 18, 12, 1); dk.endFill();
            dk.beginFill(accent, 0.45); dk.drawRect(dX + 24, pY - 16, 12, 1); dk.endFill();
            dk.beginFill(0x1a1a28); dk.drawRect(dX + 42, pY - 24, 2, 12); dk.endFill();
            // Ink pot
            dk.beginFill(0x1a0a04); dk.drawRect(dX + 48, pY - 18, 4, 6); dk.endFill();
            dk.beginFill(country.trimCol); dk.drawRect(dX + 48, pY - 18, 4, 1); dk.endFill();
            c.addChild(dk);
            this.indoorLights.push({ g: dk, maxA: 1, type: 'desk' });

            // Leather wingback chair behind desk
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            const chX = dX + dW / 2 - 8;
            ch.beginFill(0x3a1f10); ch.drawRoundedRect(chX, pY - 36, 16, 36, 3); ch.endFill();
            ch.beginFill(0x4a2e18); ch.drawRect(chX, pY - 36, 16, 3); ch.endFill();
            ch.beginFill(0x1a0a04); ch.drawRect(chX + 6, pY - 4, 4, 4); ch.endFill();
            c.addChild(ch);

            // ─── Antique globe ───
            const gbX = sx + bw - 48, gbY = pY - 6;
            const gb = new PIXI.Graphics(); gb.eventMode = 'none';
            gb.beginFill(0x3a1f10); gb.drawRect(gbX - 6, gbY, 12, 6); gb.endFill();
            gb.beginFill(country.trimCol); gb.drawRect(gbX - 1, gbY - 4, 2, 4); gb.endFill();
            gb.beginFill(0x2a4a6e); gb.drawCircle(gbX, gbY - 14, 8); gb.endFill();
            gb.beginFill(0x3d6e3b, 0.8); gb.drawEllipse(gbX - 2, gbY - 14, 3, 2); gb.drawEllipse(gbX + 3, gbY - 16, 2.5, 1.5); gb.endFill();
            gb.lineStyle(0.5, country.trimCol, 0.75); gb.drawCircle(gbX, gbY - 14, 8); gb.lineStyle(0);
            c.addChild(gb);

            // ─── Leather Chesterfield reading chair in corner ───
            const rc = new PIXI.Graphics(); rc.eventMode = 'none';
            // Skip this if under bookshelf - place away from shelf
            const cX = sx + bw * 0.2, cY = pY;
            // Low table beside chair with whiskey decanter
            const sT = new PIXI.Graphics(); sT.eventMode = 'none';
            sT.beginFill(0x3a1f10); sT.drawRect(cX - 6, cY - 10, 14, 10); sT.endFill();
            sT.beginFill(country.trimCol, 0.7); sT.drawRect(cX - 6, cY - 10, 14, 1); sT.endFill();
            // Decanter
            sT.beginFill(0xfbbf24, 0.85); sT.drawRect(cX - 2, cY - 18, 4, 8); sT.endFill();
            sT.beginFill(country.trimCol); sT.drawRect(cX - 1, cY - 20, 2, 2); sT.endFill();
            // Tumbler
            sT.beginFill(0xfbbf24, 0.7); sT.drawRect(cX + 3, cY - 15, 3, 5); sT.endFill();
            c.addChild(sT);

        } else if (key === 'master') {
            // ─── Plush carpet ───
            g.beginFill(country.floorCol); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            // Carpet pattern
            for (let ix = sx; ix < sx + bw; ix += 20) {
                g.beginFill(country.trimCol, 0.18); g.drawRect(ix, pY - 4, 1, 4); g.endFill();
            }
            // Luxurious bedroom rug beside bed
            const rugW = bw * 0.45, rugX = sx + bw / 2 - rugW / 2;
            g.beginFill(0x5a1a0a); g.drawRect(rugX, pY - 4, rugW, 4); g.endFill();
            g.beginFill(warm, 0.5); g.drawRect(rugX + 8, pY - 3, rugW - 16, 2); g.endFill();
            g.beginFill(country.trimCol, 0.5); g.drawRect(rugX + 14, pY - 2, rugW - 28, 1); g.endFill();

            // ─── Four-poster bed centre ───
            const bdW = bw * 0.42, bdX = sx + bw / 2 - bdW / 2;
            const bdY = pY - 4;
            // Base frame
            g.beginFill(0x3a1f10); g.drawRect(bdX, bdY - 4, bdW, 4); g.endFill();
            // Mattress
            g.beginFill(0xfffbe8); g.drawRect(bdX + 2, bdY - 16, bdW - 4, 12); g.endFill();
            g.beginFill(country.trimCol, 0.3); g.drawRect(bdX + 2, bdY - 16, bdW - 4, 1); g.endFill();
            // Duvet (folded over)
            g.beginFill(accent, 0.8); g.drawRect(bdX + 2, bdY - 16, bdW - 4, 6); g.endFill();
            g.beginFill(country.trimCol, 0.45); g.drawRect(bdX + 2, bdY - 11, bdW - 4, 1); g.endFill();
            // Four posters
            for (const postX of [bdX, bdX + bdW - 3]) {
                g.beginFill(0x3a1f10); g.drawRect(postX, bdY - 44, 3, 44); g.endFill();
                g.beginFill(country.trimCol); g.drawCircle(postX + 1.5, bdY - 46, 2); g.endFill();
            }
            // Canopy cross beam
            g.beginFill(0x3a1f10); g.drawRect(bdX, bdY - 44, bdW, 3); g.endFill();
            // Canopy fabric drape
            g.beginFill(accent, 0.5); g.drawRect(bdX, bdY - 41, 4, 14); g.drawRect(bdX + bdW - 4, bdY - 41, 4, 14); g.endFill();
            g.beginFill(country.trimCol, 0.3); g.drawRect(bdX + 2, bdY - 41, bdW - 4, 3); g.endFill();
            // Headboard
            g.beginFill(0x3a1f10); g.drawRect(bdX, bdY - 28, bdW, 12); g.endFill();
            g.beginFill(accent, 0.6); g.drawRect(bdX + 2, bdY - 26, bdW - 4, 8); g.endFill();
            g.beginFill(country.trimCol, 0.45); g.drawRect(bdX + 4, bdY - 24, bdW - 8, 1); g.endFill();
            c.addChild(g);

            // Pillows (2, always shown)
            const pwG = new PIXI.Graphics(); pwG.eventMode = 'none';
            pwG.beginFill(0xfffbe8); pwG.drawRoundedRect(bdX + 4, bdY - 20, (bdW - 10) / 2, 6, 2); pwG.endFill();
            pwG.beginFill(0xfffbe8); pwG.drawRoundedRect(bdX + 6 + (bdW - 10) / 2, bdY - 20, (bdW - 10) / 2, 6, 2); pwG.endFill();
            pwG.beginFill(country.trimCol, 0.4); pwG.drawRect(bdX + 6, bdY - 20, (bdW - 14) / 2, 1); pwG.endFill();
            c.addChild(pwG);
            this._bedRect = { x: bdX, y: bdY - 20, w: bdW, h: 14 };

            // ─── Nightstands flanking bed ───
            for (const nsX of [bdX - 20, bdX + bdW + 6]) {
                const ns = new PIXI.Graphics(); ns.eventMode = 'none';
                ns.beginFill(0x3a1f10); ns.drawRect(nsX, pY - 18, 16, 18); ns.endFill();
                ns.beginFill(0x4a2e18); ns.drawRect(nsX, pY - 18, 16, 3); ns.endFill();
                // Drawer handle
                ns.beginFill(country.trimCol); ns.drawCircle(nsX + 8, pY - 10, 0.8); ns.endFill();
                // Alarm clock
                ns.beginFill(0x1a1a28); ns.drawRect(nsX + 2, pY - 24, 6, 6); ns.endFill();
                ns.beginFill(warm, 0.85); ns.drawRect(nsX + 3, pY - 22, 4, 2); ns.endFill();
                // Table lamp
                ns.beginFill(country.trimCol); ns.drawRect(nsX + 12, pY - 24, 2, 6); ns.endFill();
                ns.beginFill(accent, 0.7); ns.drawPolygon([nsX + 10, pY - 28, nsX + 14, pY - 28, nsX + 16, pY - 24, nsX + 8, pY - 24]); ns.endFill();
                ns.beginFill(0xffe9a8, 0.5); ns.drawRect(nsX + 10, pY - 26, 4, 2); ns.endFill();
                c.addChild(ns);
                this.indoorLights.push({ g: ns, maxA: 1, type: 'lamp' });
            }

            // ─── Wardrobe ───
            const wbX = sx + 20, wbY = pY - 44;
            const wb = new PIXI.Graphics(); wb.eventMode = 'none';
            wb.beginFill(0x3a1f10); wb.drawRect(wbX, wbY, 48, 44); wb.endFill();
            wb.beginFill(0x4a2e18); wb.drawRect(wbX, wbY, 48, 4); wb.endFill();
            // Two doors with mirror panels
            wb.beginFill(country.trimCol, 0.4); wb.drawRect(wbX + 4, wbY + 6, 18, 32); wb.endFill();
            wb.beginFill(country.trimCol, 0.4); wb.drawRect(wbX + 26, wbY + 6, 18, 32); wb.endFill();
            wb.beginFill(country.trimCol); wb.drawCircle(wbX + 22, wbY + 22, 0.8); wb.drawCircle(wbX + 26, wbY + 22, 0.8); wb.endFill();
            c.addChild(wb);

            // ─── Vanity with mirror ───
            const vX = sx + bw - 66, vY = pY;
            const vn = new PIXI.Graphics(); vn.eventMode = 'none';
            vn.beginFill(0x3a1f10); vn.drawRect(vX, vY - 18, 42, 18); vn.endFill();
            vn.beginFill(0x4a2e18); vn.drawRect(vX, vY - 18, 42, 3); vn.endFill();
            // Oval mirror
            vn.beginFill(country.trimCol); vn.drawEllipse(vX + 21, vY - 32, 14, 12); vn.endFill();
            vn.beginFill(0xcce6ff, 0.7); vn.drawEllipse(vX + 21, vY - 32, 12, 10); vn.endFill();
            // Perfume bottles
            vn.beginFill(warm, 0.85); vn.drawRect(vX + 4, vY - 22, 2, 4); vn.endFill();
            vn.beginFill(accent, 0.85); vn.drawRect(vX + 8, vY - 22, 2, 4); vn.endFill();
            vn.beginFill(country.trimCol, 0.85); vn.drawRect(vX + 12, vY - 22, 2, 4); vn.endFill();
            // Vanity stool
            vn.beginFill(0x3a1f10); vn.drawRect(vX + 16, vY - 6, 10, 6); vn.endFill();
            vn.beginFill(accent, 0.6); vn.drawRect(vX + 16, vY - 6, 10, 2); vn.endFill();
            c.addChild(vn);

            // ─── Framed art above bed ───
            const fArtX = bdX + bdW / 2 - 22, fArtY = fy + 10;
            const fa = new PIXI.Graphics(); fa.eventMode = 'none';
            fa.beginFill(country.trimCol); fa.drawRect(fArtX, fArtY, 44, 22); fa.endFill();
            fa.beginFill(0x4a2e18); fa.drawRect(fArtX + 2, fArtY + 2, 40, 18); fa.endFill();
            fa.beginFill(accent, 0.4); fa.drawRect(fArtX + 4, fArtY + 4, 36, 14); fa.endFill();
            // Abstract flourish
            fa.beginFill(warm, 0.65); fa.drawRect(fArtX + 8, fArtY + 8, 14, 2); fa.endFill();
            fa.beginFill(country.trimCol, 0.6); fa.drawRect(fArtX + 22, fArtY + 12, 14, 2); fa.endFill();
            c.addChild(fa);

            // ─── Ceiling medallion + pendant lamp ───
            const cp = new PIXI.Graphics(); cp.eventMode = 'none';
            const cpX = sx + bw / 2;
            cp.beginFill(country.trimCol, 0.35); cp.drawCircle(cpX, fy + 6, 10); cp.endFill();
            cp.beginFill(0x1a1a28); cp.drawRect(cpX - 0.5, fy + 6, 1, 20); cp.endFill();
            cp.beginFill(country.trimCol); cp.drawEllipse(cpX, fy + 30, 10, 6); cp.endFill();
            cp.beginFill(0xffe9a8, 0.8); cp.drawEllipse(cpX, fy + 30, 7, 4); cp.endFill();
            c.addChild(cp);
            this.indoorLights.push({ g: cp, maxA: 1, type: 'pendant' });

        } else if (key === 'cellar') {
            // ─── Stone floor ───
            g.beginFill(0x1a140a); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            for (let ix = sx; ix < sx + bw; ix += 30) {
                g.beginFill(0x2a1f12, 0.7); g.drawRect(ix, pY - 4, 28, 1); g.endFill();
            }

            // ─── Wine racks along both walls ───
            const rkH = fh - 28, rkW = 28;
            const rackCount = Math.floor((bw - 120) / (rkW + 4));
            for (let ri = 0; ri < Math.min(6, rackCount); ri++) {
                const rkX = sx + 14 + ri * (rkW + 4);
                g.beginFill(0x3a1f10); g.drawRect(rkX, fy + 14, rkW, rkH); g.endFill();
                g.beginFill(0x4a2e18); g.drawRect(rkX, fy + 14, rkW, 3); g.endFill();
                // Wine bottles stacked in X-pattern
                const rows = 6;
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < 3; col++) {
                        const bX = rkX + 4 + col * 8;
                        const bY = fy + 18 + row * ((rkH - 10) / rows);
                        g.beginFill(row % 2 === 0 ? 0x5a1a0a : 0x14532d);
                        g.drawCircle(bX, bY, 2);
                        g.endFill();
                        // Cork
                        g.beginFill(0xc6a87a); g.drawCircle(bX, bY, 1); g.endFill();
                    }
                }
            }
            c.addChild(g);

            // ─── Tasting table in centre with decanter + glasses ───
            const tbX = sx + bw - 140, tbY = pY - 12;
            const tb = new PIXI.Graphics(); tb.eventMode = 'none';
            tb.beginFill(0x3a1f10); tb.drawRect(tbX, tbY, 80, 12); tb.endFill();
            tb.beginFill(0x4a2e18); tb.drawRect(tbX, tbY, 80, 2); tb.endFill();
            // Wine decanter
            tb.beginFill(0x5a1a0a, 0.85); tb.drawRect(tbX + 12, tbY - 12, 6, 12); tb.endFill();
            tb.beginFill(0x3a0a04); tb.drawRect(tbX + 12, tbY - 14, 6, 2); tb.endFill();
            // Wine glasses
            for (let gi = 0; gi < 3; gi++) {
                const gX = tbX + 28 + gi * 10;
                tb.beginFill(0xcce6ff, 0.55); tb.drawRect(gX, tbY - 10, 3, 6); tb.endFill();
                tb.beginFill(0x5a1a0a, 0.7); tb.drawRect(gX, tbY - 8, 3, 3); tb.endFill();
                tb.beginFill(0xcce6ff, 0.4); tb.drawRect(gX, tbY - 4, 3, 1); tb.endFill();
                tb.beginFill(0xcce6ff, 0.55); tb.drawRect(gX + 1, tbY - 3, 1, 4); tb.endFill();
            }
            // Cheese board
            tb.beginFill(0x7c5a30); tb.drawRect(tbX + 60, tbY - 4, 16, 3); tb.endFill();
            tb.beginFill(0xffe9a8); tb.drawRect(tbX + 62, tbY - 7, 4, 3); tb.endFill();
            tb.beginFill(country.trimCol); tb.drawRect(tbX + 68, tbY - 6, 3, 2); tb.endFill();
            c.addChild(tb);

            // ─── Wine region labels ───
            country.wineLabels.forEach((lbl, li) => {
                const lX = sx + 14 + li * 32;
                const lT = new PIXI.Text(lbl, {
                    fontFamily: 'JetBrains Mono', fontSize: 4.5, fill: country.trimCol, fontWeight: 'bold'
                });
                lT.anchor.set(0, 0); lT.x = lX; lT.y = fy + 14 + rkH + 2;
                c.addChild(lT);
            });

            // ─── Safe built into back wall ───
            const sfX = sx + bw - 50, sfY = fy + 20;
            const sf = new PIXI.Graphics(); sf.eventMode = 'none';
            sf.beginFill(0x1a1a28); sf.drawRect(sfX, sfY, 40, 40); sf.endFill();
            sf.beginFill(0x2a2a38); sf.drawRect(sfX + 2, sfY + 2, 36, 36); sf.endFill();
            // Dial
            sf.beginFill(country.trimCol); sf.drawCircle(sfX + 20, sfY + 20, 7); sf.endFill();
            sf.beginFill(0x1a1a28); sf.drawCircle(sfX + 20, sfY + 20, 5); sf.endFill();
            sf.beginFill(country.trimCol); sf.drawRect(sfX + 19.5, sfY + 14, 1, 6); sf.endFill();
            // Handle
            sf.beginFill(country.trimCol); sf.drawRect(sfX + 28, sfY + 18, 10, 4); sf.endFill();
            c.addChild(sf);
            const sfLabel = new PIXI.Text('CLASSIFIED', {
                fontFamily: 'JetBrains Mono', fontSize: 4, fill: warm, fontWeight: 'bold', letterSpacing: 0.8
            });
            sfLabel.anchor.set(0.5, 0); sfLabel.x = sfX + 20; sfLabel.y = sfY + 42;
            c.addChild(sfLabel);

            // ─── Bare bulb hanging ───
            const bu = new PIXI.Graphics(); bu.eventMode = 'none';
            bu.beginFill(0x1a1a28); bu.drawRect(sx + bw / 2 - 0.5, fy + 6, 1, 12); bu.endFill();
            bu.beginFill(country.trimCol); bu.drawCircle(sx + bw / 2, fy + 22, 4); bu.endFill();
            bu.beginFill(0xffe9a8, 0.75); bu.drawCircle(sx + bw / 2, fy + 22, 2.5); bu.endFill();
            c.addChild(bu);
            this.indoorLights.push({ g: bu, maxA: 1, type: 'bulb' });
        }
    },

    // Style-appropriate ornamental plant
    _drawOrnamental(c, x, pY, country) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const st = country.style;
        // Pot
        g.beginFill(country.trimCol); g.drawRect(x - 5, pY - 10, 10, 10); g.endFill();
        g.beginFill(country.accent, 0.4); g.drawRect(x - 5, pY - 10, 10, 2); g.endFill();

        if (st === 'pagoda') {
            // Bonsai tree
            g.beginFill(0x3a2a18); g.drawRect(x - 1, pY - 18, 2, 8); g.endFill();
            g.beginFill(0x166534, 0.85); g.drawEllipse(x - 4, pY - 20, 6, 3); g.drawEllipse(x + 4, pY - 20, 6, 3); g.drawEllipse(x, pY - 24, 5, 2.5); g.endFill();
            g.beginFill(country.warm, 0.5); g.drawCircle(x - 3, pY - 20, 0.6); g.drawCircle(x + 3, pY - 22, 0.6); g.endFill();
        } else if (st === 'haveli' || st === 'arabian') {
            // Tall palm
            g.beginFill(0x3a2a18); g.drawRect(x - 1, pY - 28, 2, 18); g.endFill();
            g.beginFill(0x166534, 0.9);
            g.drawEllipse(x - 8, pY - 30, 10, 3); g.drawEllipse(x + 8, pY - 30, 10, 3);
            g.drawEllipse(x - 6, pY - 34, 8, 2.5); g.drawEllipse(x + 6, pY - 34, 8, 2.5);
            g.drawEllipse(x, pY - 36, 3, 6);
            g.endFill();
            if (st === 'haveli') {
                g.beginFill(country.warm, 0.7); g.drawCircle(x - 2, pY - 32, 0.5); g.drawCircle(x + 3, pY - 34, 0.5); g.endFill();
            }
        } else {
            // Classical fern / ficus
            g.beginFill(0x3a2a18); g.drawRect(x - 1, pY - 22, 2, 12); g.endFill();
            g.beginFill(0x2d5e2b); g.drawEllipse(x, pY - 28, 8, 8); g.endFill();
            g.beginFill(0x3d7e3b, 0.7); g.drawEllipse(x - 2, pY - 30, 5, 4); g.drawEllipse(x + 3, pY - 29, 4, 3); g.endFill();
        }
        c.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   NPC SPAWNING — day empty, night ambassador sleeping
    // ════════════════════════════════════════════════════
    _spawnFloorNPCs(c, sx, bw, pY, fy, fh, key, accent, warm, country, isNight, isDeepNight) {
        // Master suite: ambassador sleeping (deep night) or preparing for bed (evening).
        if (key === 'master' && isNight && this._bedRect) {
            this._drawSleepingAmbassador(c, this._bedRect, accent, country);
            return;
        }
        // Reception: at night (not deep night), butler polishing silver; during the "prime" evening dinner hour
        // an ambassador + partner dining. Otherwise empty.
        if (key === 'reception' && isNight && !isDeepNight) {
            // Butler polishing
            this.drawNPC(c, sx + bw - 70, pY, 'Butler', 0x94a3b8, country);
        }
        // Study: evening reading (before bed, not deep night)
        if (key === 'study' && isNight && !isDeepNight) {
            // Ambassador reading by fire (evening only)
            // we draw this as a standing NPC near desk — it'll animate to idle
            this.drawNPC(c, sx + bw * 0.55, pY, 'Ambassador', accent, country);
        }
        // Day: everyone's out (at the embassy / in the city). Cellar/reception/study empty except for ambient state.
    },

    // Draw a sleeping ambassador on the bed (pillow + head + blanket + zzz)
    _drawSleepingAmbassador(c, bedRect, accent, country) {
        const { x: bx, y: by, w: bw, h: bh } = bedRect;
        const sleeper = new PIXI.Graphics();
        // Replace pillows area with a head on the pillow — don't rotate!
        // Head resting on pillow (left side of bed)
        sleeper.beginFill(0xfdd8b5); sleeper.drawCircle(bx + 10, by + 3, 4); sleeper.endFill();
        // Hair
        sleeper.beginFill(0x2c1810, 0.75); sleeper.drawEllipse(bx + 10, by + 1, 4, 1.8); sleeper.endFill();
        // Closed eyes
        sleeper.beginFill(0x2c1810, 0.55); sleeper.drawRect(bx + 7.5, by + 3, 1.8, 0.8); sleeper.drawRect(bx + 11, by + 3, 1.8, 0.8); sleeper.endFill();
        // Peaceful smile
        sleeper.beginFill(0x2c1810, 0.25); sleeper.drawRect(bx + 9, by + 5.5, 2.5, 0.6); sleeper.endFill();
        // Blanket hump over body (country-accent coloured duvet)
        sleeper.beginFill(accent, 0.82);
        sleeper.moveTo(bx + 14, by + 10); sleeper.lineTo(bx + 14, by + 5);
        sleeper.quadraticCurveTo(bx + bw / 2, by - 4, bx + bw - 4, by + 4);
        sleeper.lineTo(bx + bw - 4, by + 10); sleeper.closePath(); sleeper.endFill();
        // Blanket highlight
        sleeper.beginFill(country.trimCol, 0.35);
        sleeper.moveTo(bx + 15, by + 8); sleeper.lineTo(bx + 15, by + 6);
        sleeper.quadraticCurveTo(bx + bw / 2, by - 2, bx + bw - 5, by + 6);
        sleeper.lineTo(bx + bw - 5, by + 8); sleeper.closePath(); sleeper.endFill();

        const sleeperCont = new PIXI.Container();
        sleeperCont.addChild(sleeper);
        sleeperCont.eventMode = 'static'; sleeperCont.cursor = 'pointer';
        sleeperCont.hitArea = new PIXI.Rectangle(bx + 4, by - 8, bw - 8, bh + 12);
        const _rl = country.title + ' (sleeping)';
        const _nm = country.full + ' ' + country.title;
        const _nid = 'npc_dip_' + (country.full.split(' ')[0].toLowerCase());
        sleeperCont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                UI.selectModel({
                    id: _nid, name: _nm, isNPC: true, _trackType: 'npc',
                    role: country.title, lab: 'other',
                    desc: country.title + ' of ' + country.full + '. Currently sleeping in their private residence.'
                });
            }
        });
        sleeperCont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, _nm, _rl); });
        sleeperCont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(sleeperCont);

        // Animated Zzz
        const zzzCont = new PIXI.Container();
        zzzCont.x = bx + 18; zzzCont.y = by - 4;
        const z1 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 7, fill: accent, fontWeight: 'bold' });
        z1.anchor.set(0.5); z1.x = 0; z1.y = 0; z1.alpha = 0.7;
        const z2 = new PIXI.Text('z', { fontFamily: 'JetBrains Mono', fontSize: 9, fill: accent, fontWeight: 'bold' });
        z2.anchor.set(0.5); z2.x = 5; z2.y = -8; z2.alpha = 0.5;
        const z3 = new PIXI.Text('Z', { fontFamily: 'JetBrains Mono', fontSize: 11, fill: accent, fontWeight: 'bold' });
        z3.anchor.set(0.5); z3.x = 10; z3.y = -18; z3.alpha = 0.3;
        zzzCont.addChild(z1, z2, z3);
        c.addChild(zzzCont);
        this.avatars.push({ cont: zzzCont, _isZzz: true, _z1: z1, _z2: z2, _z3: z3, _phase: Math.random() * Math.PI * 2 });
    },

    // ════════════════════════════════════════════════════
    //   STANDING NPC — butler, ambassador, partner
    // ════════════════════════════════════════════════════
    drawNPC(c, x, y, role, col, country) {
        const colHex = col || 0x64748b;
        const bw = 16, h = 32;
        const seed = 'amb_res_' + (country ? country.full : 'x') + '_' + role;

        const av = HumanAvatar.draw(c, {
            x, y,
            name: null,
            shirt: role === 'Butler' ? 0x1a1a28 : 0x1a1a28,
            accent: colHex,
            suit: true,
            tieColor: colHex,
            glasses: false,
            seed,
            showTag: false, showDot: true
        });
        const cont = av.cont, head = av.head, body = av.body;
        const legL = av.legL, legR = av.legR, dot = av.dot, shadow = av.shadow;

        // Role tag above head
        const tag = new PIXI.Text(role, {
            fontFamily: 'JetBrains Mono', fontSize: 5.5, fill: colHex, fontWeight: 'bold'
        });
        tag.anchor.set(0.5, 1); tag.y = -h - 12;
        cont.addChild(tag);

        // Hover / click wiring
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 16, bw * 2, h + 20);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                const desc = role + '. ' + (country ? country.full + ' ambassador\'s residence.' : 'Ambassador residence staff.');
                UI.selectModel({
                    id: 'amb_res_' + role.replace(/\s/g, '_').toLowerCase() + '_' + (country ? country.full.split(' ')[0].toLowerCase() : 'x'),
                    name: role, isNPC: true, _trackType: 'npc',
                    role, lab: 'other', desc
                });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, role, country ? country.full : 'Residence');
        });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip(); });

        const npcId = 'amb_res_' + role.replace(/\s/g, '_').toLowerCase() + '_' + (country ? country.full.split(' ')[0].toLowerCase() : 'x');
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }

        const avObj = {
            m: { id: npcId, name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, tag,
            state: 'working', timer: 60 + Math.floor(Math.random() * 220),
            deskX: x, floorY: y, targetX: x, speed: 0.5,
            role, _h: h, _country: country
        };
        this.avatars.push(avObj);
        return avObj;
    },

    // ════════════════════════════════════════════════════
    //   ANIMATION — idle sway + bubble chatter
    // ════════════════════════════════════════════════════
    _updateAvatars() {
        const GENERIC_MSGS = [
            'More tea, sir?', 'Polishing the silver.', 'Dinner at eight.',
            'Mrs. sends her regards.', 'Fetching the decanter.', 'I\'ll draw the curtains.'
        ];
        this.avatars.forEach((av, ai) => {
            if (!av.cont || av.cont.destroyed) return;
            // Zzz animation (sleeping ambassador)
            if (av._isZzz) {
                av._phase += 0.05;
                const flow = (Math.sin(av._phase) + 1) * 0.5;
                if (av._z1) av._z1.alpha = 0.35 + flow * 0.5;
                if (av._z2) av._z2.alpha = 0.25 + flow * 0.4;
                if (av._z3) av._z3.alpha = 0.15 + flow * 0.3;
                av.cont.y = (av.cont.__baseY || av.cont.y) - Math.sin(av._phase * 0.5) * 1.5;
                if (av.cont.__baseY === undefined) av.cont.__baseY = av.cont.y;
                return;
            }
            av.timer--;

            switch (av.state) {
                case 'working': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.6;
                    av.body.rotation = Math.sin(G.tick * 0.03 + av.deskX) * 0.012;
                    av.legL.y = 0; av.legR.y = 0;
                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.25) {
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 80;
                            av.targetX = Math.max(80, Math.min(G.vpW - 80, av.targetX));
                        } else if (r < 0.45) {
                            av.state = 'chatting';
                            av.timer = 60 + Math.floor(Math.random() * 80);
                            this._spawnBubble(av, GENERIC_MSGS[Math.floor(Math.random() * GENERIC_MSGS.length)]);
                        } else {
                            av.timer = 140 + Math.floor(Math.random() * 220);
                        }
                    }
                    break;
                }
                case 'walking': {
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < 1.5) {
                        av.cont.x = av.targetX;
                        av.cont.scale.x = 1;
                        if (av.dot) av.dot.scale.x = 1;
                        av.state = 'working';
                        av.timer = 120 + Math.floor(Math.random() * 220);
                    } else {
                        const dir = dx > 0 ? 1 : -1;
                        av.cont.x += dir * av.speed;
                        av.cont.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    av.head.y = -av._h + Math.sin(G.tick * 0.14 + ai) * 1.2;
                    av.body.y = -av._h + av._h * 0.38 + Math.abs(Math.sin(G.tick * 0.14 + ai)) * 1.2;
                    av.legL.y = Math.sin(G.tick * 0.18 + ai) * 2.5;
                    av.legR.y = -Math.sin(G.tick * 0.18 + ai) * 2.5;
                    break;
                }
                case 'chatting': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.1) * 1.1;
                    av.body.rotation = Math.sin(G.tick * 0.05) * 0.018;
                    if (av.timer <= 0) {
                        av.state = 'working';
                        av.timer = 100 + Math.floor(Math.random() * 220);
                    }
                    break;
                }
            }
        });

        // Bubble life cycle
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.12;
            b.cont.alpha = Math.min(1, b.life / 22);
            if (b.life <= 0) {
                if (b.cont.parent) b.cont.parent.removeChild(b.cont);
                b.cont.destroy({ children: true });
                this.bubbles.splice(i, 1);
            }
        }
    },

    _spawnBubble(av, msg) {
        if (!this.scene || this.scene.destroyed) return;
        const bCont = new PIXI.Container();
        const txt = new PIXI.Text(msg, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 7.5, fill: 0x1a1a28, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 1); txt.y = -6;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xfffbe8);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.lineStyle(0.8, 0xa8a288, 0.7);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.lineStyle(0);
        bg.beginFill(0xfffbe8);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        bCont.addChild(bg, txt);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - av._h - 10;
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 140 });
    },

    // ════════════════════════════════════════════════════
    //   UPDATE
    // ════════════════════════════════════════════════════
    update() {
        if (!this.scene) return;
        // Shared sky dynamics
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        // Flag wave on rooftop
        if (this._roofFlag && !this._roofFlag.destroyed) {
            this._roofFlag.skew.x = Math.sin(G.tick * 0.06) * 0.18;
        }
        // Indoor light flicker
        this.indoorLights.forEach(l => {
            if (!l.g || l.g.destroyed) return;
            if (l.type === 'chandelier') l.g.alpha = l.maxA * (0.85 + Math.sin(G.tick * 0.03) * 0.12);
            else if (l.type === 'candle') l.g.alpha = l.maxA * (0.75 + Math.sin(G.tick * 0.2) * 0.2);
            else if (l.type === 'fire')   l.g.alpha = l.maxA * (0.8 + Math.sin(G.tick * 0.25) * 0.18);
            else if (l.type === 'lamp')   l.g.alpha = l.maxA * (0.9 + Math.sin(G.tick * 0.05) * 0.08);
            else if (l.type === 'desk')   l.g.alpha = l.maxA * (0.85 + Math.sin(G.tick * 0.07) * 0.1);
            else if (l.type === 'bulb')   l.g.alpha = l.maxA * (0.75 + Math.sin(G.tick * 0.15) * 0.18);
            else if (l.type === 'pendant') l.g.alpha = l.maxA * (0.88 + Math.sin(G.tick * 0.04) * 0.1);
            else                          l.g.alpha = l.maxA * (0.8 + Math.sin(G.tick * 0.04) * 0.15);
        });
        // Elevator
        if (this._lift && !this._lift.destroyed) this._lift.update();
        if (typeof InteriorCity !== 'undefined' && InteriorCity._liveTrains) InteriorCity._liveTrains.update();
        // Avatars
        this._updateAvatars();
    }
};

if (typeof window !== 'undefined') window.InteriorAmbassadorRes = InteriorAmbassadorRes;
