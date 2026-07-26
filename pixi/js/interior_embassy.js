/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR EMBASSY (v1.0.0 — Stage 4, Embassy Row Interiors)
   Self-contained interior module for the six national embassies on Embassy Row.
   Five themed floors per country:
     • Reception Hall      — marble atrium, grand desk with country seal, flag wall, security
     • Consular Services   — visa windows, queue, waiting area, bulletin board of requirements
     • AI Policy Attaché   — desks, monitors showing country's AI regulation, framework whiteboard
     • Ambassador's Office — ceremonial salon, grand desk, flags, conference table, country portrait
     • Archive (basement)  — classified reading room with locked cabinets
   Each country has its own accent palette and a distinctive silhouette on the lobby wall
   (eagle, Great Wall, 12-star ring, Big Ben, Taj Mahal, desert dunes).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorEmbassy = {
    scene: null, layer: null, bld: null, avatars: [], bubbles: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    // Country-specific theming. Keys match bld.id.
    COUNTRIES: {
        embassy_us: {
            full: 'UNITED STATES OF AMERICA',
            motto: 'E PLURIBUS UNUM',
            framework: 'NIST AI RMF',
            frameworkLines: ['Govern', 'Map', 'Measure', 'Manage', 'EO 14110 compliance'],
            silhouette: 'eagle',
            portraitRole: 'PRESIDENT',
            deskPlaqueLang: 'AMBASSADOR',
            stamps: ['VISA', 'H-1B', 'O-1', 'ESTA'],
            wallAccent: 0x002868,     // navy
            warmAccent: 0xbf0a30,     // red
            policyMsgs: [
                'Voluntary commitments signed.', 'Chip export review pending.',
                'Frontier Model Forum memo.', 'AISI joint eval scheduled.',
                'State patchwork tracked.', 'SB 1047 status: vetoed.',
                '14110 implementation update.', 'DoD procurement brief.'
            ]
        },
        embassy_cn: {
            full: 'PEOPLE\'S REPUBLIC OF CHINA',
            motto: '为人民服务',
            framework: 'CAC 生成式AI管理办法',
            frameworkLines: ['安全评估', '算法备案', '数据合规', 'Core Values Alignment', '预训练内容审核'],
            silhouette: 'great_wall',
            portraitRole: '主席',
            deskPlaqueLang: '大使',
            stamps: ['签证', 'Z-VISA', 'R-VISA', '工作'],
            wallAccent: 0xde2910,
            warmAccent: 0xffde00,
            policyMsgs: [
                'DeepSeek weights released.', 'Qwen3 benchmark update.',
                'Export control workaround.', 'Domestic compute survey.',
                'Generative AI filing approved.', 'Content audit passed.',
                'H20 shipment delayed.', 'MiC 2025 progress brief.'
            ]
        },
        embassy_eu: {
            full: 'EUROPEAN UNION DELEGATION',
            motto: 'IN VARIETATE CONCORDIA',
            framework: 'EU AI ACT',
            frameworkLines: ['Unacceptable Risk', 'High Risk', 'Limited Risk', 'GPAI >10^25 FLOPs', 'Art. 51 compliance'],
            silhouette: 'euro_ring',
            portraitRole: 'PRESIDENT OF COMMISSION',
            deskPlaqueLang: 'AMBASSADEUR',
            stamps: ['SCHENGEN', 'BLUE CARD', 'TYPE D'],
            wallAccent: 0x003399,
            warmAccent: 0xffcc00,
            policyMsgs: [
                'AI Act phase-in review.', 'Conformity assessment filed.',
                'GPAI code of practice draft.', 'Standards body coordination.',
                'National DPA consultation.', 'Mistral compliance ping.',
                'Data Act cross-reference.', 'Copyright triage update.'
            ]
        },
        embassy_uk: {
            full: 'UNITED KINGDOM',
            motto: 'DIEU ET MON DROIT',
            framework: 'AI SAFETY INSTITUTE',
            frameworkLines: ['Pre-deploy Evals', 'Dangerous Capability', 'Misuse Testing', 'Autonomy Probes', 'Bletchley Signatories'],
            silhouette: 'big_ben',
            portraitRole: 'HIS MAJESTY',
            deskPlaqueLang: 'HIGH COMMISSIONER',
            stamps: ['SKILLED WORKER', 'GLOBAL TALENT', 'HPI'],
            wallAccent: 0x012169,
            warmAccent: 0xc8102e,
            policyMsgs: [
                'Frontier model eval booked.', 'DeepMind lab visit scheduled.',
                'Bletchley follow-up meeting.', 'Principles white paper v2.',
                'AISI capability probe run.', 'DSIT briefing finalised.',
                'Inspect framework update.', 'Global Talent visa approved.'
            ]
        },
        embassy_in: {
            full: 'REPUBLIC OF INDIA',
            motto: 'सत्यमेव जयते',
            framework: 'INDIAAI MISSION',
            frameworkLines: ['AIKosh dataset', 'Sovereign Compute', 'IndiaAI Compute Portal', 'Indic LLMs', 'Responsible AI Guidelines'],
            silhouette: 'taj_mahal',
            portraitRole: 'RASHTRAPATI',
            deskPlaqueLang: 'उच्चायुक्त',
            stamps: ['E-VISA', 'PIO', 'OCI', 'BUSINESS'],
            wallAccent: 0xff9933,
            warmAccent: 0x138808,
            policyMsgs: [
                'Sarvam benchmark posted.', 'GPU allocation request.',
                'Krutrim partnership memo.', 'Bhashini language expansion.',
                'MeitY consultation draft.', 'Compute portal onboarding.',
                'IndiaAI grant awarded.', 'UN digital public goods note.'
            ]
        },
        embassy_ae: {
            full: 'UNITED ARAB EMIRATES',
            motto: 'الله • الوطن • الرئيس',
            framework: 'NATIONAL AI STRATEGY 2031',
            frameworkLines: ['Falcon open weights', 'Sovereign Compute', 'Talent Visas', 'G42 partnerships', 'Stargate UAE build'],
            silhouette: 'dunes',
            portraitRole: 'الرئيس',
            deskPlaqueLang: 'السفير',
            stamps: ['GOLDEN VISA', 'GREEN VISA', 'NOC'],
            wallAccent: 0x00732f,
            warmAccent: 0xce1126,
            policyMsgs: [
                'Falcon 3 release coordinated.', 'MBZUAI MoU signed.',
                'G42 / Microsoft checkpoint.', 'Stargate UAE site survey.',
                'Sovereign data pact ping.', 'Arabic benchmark milestone.',
                'Talent visa onboarding.', 'Crescent Fund placement.'
            ]
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

        const country = this.COUNTRIES[bld.id] || this.COUNTRIES.embassy_us;
        const accent = bld.accent || country.wallAccent || 0x002868;
        const warm = country.warmAccent || 0xbf0a30;
        const flagCols = bld.flagColors || [accent, 0xffffff, warm];

        const floorH = 82, startX = 60, bldW = G.vpW - 120;
        const floors = [
            { key: 'archive',    label: 'ARCHIVE' },          // basement (-1)
            { key: 'reception',  label: 'RECEPTION HALL' },   // ground
            { key: 'consular',   label: 'CONSULAR SERVICES' },
            { key: 'attache',    label: 'AI POLICY ATTACHÉ' },
            { key: 'ambassador', label: 'AMBASSADOR\'S OFFICE' }
        ];
        const numFloors = floors.length - 1; // basement separate
        const roofH = 70;
        this.totalH = roofH + (numFloors + 1) * floorH + 220;

        // ─── ROOF: Pediment + flag + country name plaque ───
        this._drawPediment(this.scene, startX, bldW, roofH, flagCols, accent, warm, bld.name);

        // ─── FLOORS (top-down render: index 0 = top) ───
        const winMarginX = 50;
        const winY_off = 18;
        const winH_px = floorH - 30;

        for (let f = -1; f < numFloors; f++) {
            const isBasement = f === -1;
            const floorDef = isBasement ? floors[0] : floors[numFloors - f]; // invert: top = ambassador
            const fy = roofH + (numFloors - 1 - f) * floorH;

            const rg = new PIXI.Graphics();
            // Side walls — classical ivory instead of glass
            rg.beginFill(0xd8d1b2); rg.drawRect(startX - 6, fy, 6, floorH); rg.drawRect(startX + bldW, fy, 6, floorH); rg.endFill();
            // Wall base color (marble above, stone in basement)
            const wallCol = isBasement ? 0x2a2418 : 0xf4efdc;
            rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();

            if (!isBasement) {
                // Arched windows flanking the floor — evenly spaced
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                this._drawArchedWindow(rg, winX, winY, winW, winH_px, accent);
                // Horizontal pilaster (architrave) between floors
                rg.beginFill(0xc6bfa2); rg.drawRect(startX, fy, bldW, 3); rg.endFill();
                rg.beginFill(accent, 0.18); rg.drawRect(startX, fy + 3, bldW, 1); rg.endFill();
            } else {
                // Basement: stone texture, exposed brick band
                for (let bx = startX; bx < startX + bldW; bx += 20) {
                    rg.beginFill(0x1d180e, 0.35); rg.drawRect(bx + 1, fy + 12, 18, 2); rg.endFill();
                    rg.beginFill(0x1d180e, 0.35); rg.drawRect(bx + 11, fy + 22, 18, 2); rg.endFill();
                }
            }

            // Floor slab divider
            rg.beginFill(0xbab396); rg.drawRect(startX, fy + floorH - 6, bldW, 6); rg.endFill();
            rg.beginFill(0xa8a288); rg.drawRect(startX - 6, fy + floorH - 3, bldW + 12, 3); rg.endFill();
            this.scene.addChild(rg);

            // Floor label
            const fl = new PIXI.Text(floorDef.label, {
                fontFamily: 'JetBrains Mono', fontSize: 7, fill: accent, letterSpacing: 2, fontWeight: 'bold'
            });
            fl.anchor.set(0.5, 0); fl.x = startX + bldW / 2; fl.y = fy + 6; this.scene.addChild(fl);

            // Props + NPCs per floor — reserve a 50px right-side bay for the elevator
            // so desks/printer/cabinets never sit underneath the cabin or shaft.
            const ELEV_BAY = 50;
            const propBw = bldW - ELEV_BAY;
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, propBw, pY, fy, floorH, floorDef.key, accent, warm, country, flagCols);

            // NPC spawn per floor. At night the embassy is empty except for the Marine Guard
            // on the reception floor — the rest of the diplomats are home in their residences.
            const dpNow = G.getDayPhase();
            const isNight = dpNow > 0.83 || dpNow < 0.25;
            const floorNpcs = this._getNPCsForFloor(floorDef.key, propBw, accent, warm, country);
            floorNpcs.forEach(npcDef => {
                if (isNight && !npcDef.nightShift) return;
                this.drawNPC(fc, startX + npcDef.xOff, pY, npcDef.role, npcDef.col, country);
            });
        }

        // ─── GROUND ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x3a2b18); earth.drawRect(0, groundY, startX - 6, floorH); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, floorH); earth.endFill();
        earth.beginFill(0x523d22); earth.drawRect(0, groundY, startX - 6, 6); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, 6); earth.endFill();
        // Grass strip on top of the earth
        earth.beginFill(0x3d6e3b); earth.drawRect(0, groundY - 2, startX - 6, 4); earth.drawRect(startX + bldW + 6, groundY - 2, G.vpW - startX - bldW - 6, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── ZONE-AWARE UNDERGROUND ───
        const surfaceY = groundY;
        const belowBasementY = roofH + (numFloors + 1) * floorH;
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── ELEVATOR ───
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
            if (!InteriorEmbassy.isDragging || !InteriorEmbassy.scene || InteriorEmbassy.scene.destroyed) return;
            let ny = InteriorEmbassy._startSceneY + (e.clientY - InteriorEmbassy._startY);
            ny = Math.max(InteriorEmbassy.minY, Math.min(ny, InteriorEmbassy.maxY));
            InteriorEmbassy.scene.y = ny;
        };
        this._onUp = () => {
            InteriorEmbassy.isDragging = false;
            if (InteriorEmbassy.layer) InteriorEmbassy.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    // ════════════════════════════════════════════════════
    //   ROOF — Classical pediment + flying flag + plaque
    // ════════════════════════════════════════════════════
    _drawPediment(c, sx, bw, roofH, flagCols, accent, warm, embName) {
        const g = new PIXI.Graphics();
        // Architrave (horizontal band below pediment)
        g.beginFill(0xc6bfa2); g.drawRect(sx, roofH - 12, bw, 12); g.endFill();
        g.beginFill(accent, 0.35); g.drawRect(sx, roofH - 12, bw, 3); g.endFill();
        // Triangular pediment
        g.beginFill(0xe9e4d2);
        g.drawPolygon([sx, roofH - 12, sx + bw / 2, 8, sx + bw, roofH - 12]);
        g.endFill();
        g.beginFill(accent, 0.55);
        g.drawPolygon([sx + 18, roofH - 14, sx + bw / 2, 16, sx + bw - 18, roofH - 14]);
        g.endFill();
        g.lineStyle(1.5, 0xa8a288, 0.9);
        g.moveTo(sx, roofH - 12); g.lineTo(sx + bw / 2, 8); g.lineTo(sx + bw, roofH - 12);
        g.lineStyle(0);
        // Flag-colour accent stripe on architrave
        const stripeW = (bw - 40) / flagCols.length;
        flagCols.forEach((col, i) => {
            g.beginFill(col, 0.85);
            g.drawRect(sx + 20 + i * stripeW, roofH - 7, stripeW, 3);
            g.endFill();
        });
        c.addChild(g);

        // ─── Flying flag on pole at apex of pediment ───
        const flagCont = new PIXI.Container();
        flagCont.x = sx + bw / 2; flagCont.y = 8;
        const pole = new PIXI.Graphics();
        pole.beginFill(0x7a7a7a); pole.drawRect(-1.5, -60, 3, 60); pole.endFill();
        pole.beginFill(0xfbbf24); pole.drawCircle(0, -60, 3); pole.endFill();
        flagCont.addChild(pole);
        const flag = new PIXI.Graphics();
        const fw = 42, fh = 26;
        // Country-accurate flag (Union Jack, Stars & Stripes, 5-star China, EU stars, etc.)
        const country = (this.bld && this.bld.country) || (this.bld && this.bld.id ? this.bld.id.replace('embassy_', '') : 'us');
        if (typeof EmbassyRow !== 'undefined' && EmbassyRow.drawCountryFlag) {
            EmbassyRow.drawCountryFlag(flag, country, fw, fh);
        } else {
            const sh = fh / Math.max(1, flagCols.length);
            flagCols.forEach((col, i) => { flag.beginFill(col); flag.drawRect(0, i * sh, fw, sh); flag.endFill(); });
        }
        flag.x = 2; flag.y = -55; flag.pivot.set(0, fh * 0.5);
        flagCont.addChild(flag);
        c.addChild(flagCont);
        this._roofFlag = flag;

        // ─── Marble name plaque on the architrave ───
        const plaqueW = Math.min(360, bw - 80);
        const pl = new PIXI.Graphics();
        pl.beginFill(0x1a1a28, 0.92);
        pl.drawRoundedRect(sx + bw / 2 - plaqueW / 2, roofH - 50, plaqueW, 26, 4);
        pl.endFill();
        pl.lineStyle(1.2, accent, 0.85);
        pl.drawRoundedRect(sx + bw / 2 - plaqueW / 2, roofH - 50, plaqueW, 26, 4);
        pl.lineStyle(0);
        c.addChild(pl);
        const plTxt = new PIXI.Text((embName || '').toUpperCase(), {
            fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 'bold',
            fill: 0xfffbe8, letterSpacing: 2
        });
        plTxt.anchor.set(0.5, 0.5);
        plTxt.x = sx + bw / 2; plTxt.y = roofH - 37;
        if (plTxt.width > plaqueW - 20) plTxt.scale.set((plaqueW - 20) / plTxt.width);
        c.addChild(plTxt);
    },

    // ════════════════════════════════════════════════════
    //   WINDOW — Arched classical window
    // ════════════════════════════════════════════════════
    _drawArchedWindow(g, x, y, w, h, accent) {
        // Window frame shadow
        g.beginFill(0x0a0a14); g.drawRect(x, y + h * 0.15, w, h - h * 0.15); g.endFill();
        g.beginFill(0x0a0a14);
        g.drawEllipse(x + w / 2, y + h * 0.15, w / 2, h * 0.15);
        g.endFill();
        // Window panes (warm ivory glow daytime, amber at night)
        g.beginFill(0xffe9a8, 0.55); g.drawRect(x + 3, y + h * 0.15, w - 6, h - h * 0.15 - 3); g.endFill();
        g.beginFill(0xffe9a8, 0.55); g.drawEllipse(x + w / 2, y + h * 0.15, w / 2 - 3, h * 0.15 - 1); g.endFill();
        // Mullions — 3 vertical + 1 horizontal crossing
        g.lineStyle(0.8, 0xa8a288, 0.85);
        const paneCount = 3;
        for (let i = 1; i < paneCount; i++) {
            const mx = x + (w / paneCount) * i;
            g.moveTo(mx, y + h * 0.15); g.lineTo(mx, y + h - 4);
        }
        g.moveTo(x + 3, y + h * 0.55); g.lineTo(x + w - 3, y + h * 0.55);
        g.lineStyle(0);
        // Stone sill
        g.beginFill(0xc6bfa2); g.drawRect(x - 2, y + h - 4, w + 4, 4); g.endFill();
        // Keystone at top of arch
        g.beginFill(accent, 0.55);
        g.drawPolygon([x + w / 2 - 3, y, x + w / 2 + 3, y, x + w / 2 + 4, y + 6, x + w / 2 - 4, y + 6]);
        g.endFill();
    },

    // ════════════════════════════════════════════════════
    //   FLOOR PROP RENDERERS
    // ════════════════════════════════════════════════════
    _drawFloorProps(c, sx, bw, pY, fy, fh, key, accent, warm, country, flagCols) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';

        if (key === 'reception') {
            // Marble floor
            g.beginFill(0xe9e4d2); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            // Checkerboard marble inlay
            for (let ix = sx + 20; ix < sx + bw - 20; ix += 36) {
                g.beginFill(0xc6bfa2, 0.35); g.drawRect(ix, pY - 4, 18, 4); g.endFill();
            }
            // Accent inlay strip along centre
            g.beginFill(accent, 0.12); g.drawRect(sx + 10, pY - 2, bw - 20, 1); g.endFill();
            // Grand reception desk — semi-circular, marble top
            const dw = bw * 0.34;
            const dx = sx + bw / 2 - dw / 2;
            g.beginFill(0x7a5a2a); g.drawRoundedRect(dx, pY - 22, dw, 22, 4); g.endFill();
            g.beginFill(0xe9e4d2); g.drawRect(dx + 2, pY - 22, dw - 4, 3); g.endFill();
            // Country seal on desk front
            g.beginFill(accent); g.drawCircle(dx + dw / 2, pY - 11, 7); g.endFill();
            g.beginFill(warm, 0.55); g.drawCircle(dx + dw / 2, pY - 11, 4); g.endFill();
            g.beginFill(0xfbbf24); g.drawCircle(dx + dw / 2, pY - 11, 2); g.endFill();
            c.addChild(g);
            // Phone + ledger on desk
            const ph = new PIXI.Graphics(); ph.eventMode = 'none';
            ph.beginFill(0x1a1a28); ph.drawRect(dx + 18, pY - 22, 10, 6); ph.endFill();
            ph.beginFill(0x3b3b58); ph.drawRect(dx + 19, pY - 21, 8, 2); ph.endFill();
            ph.beginFill(0xf4efdc); ph.drawRect(dx + dw - 34, pY - 22, 16, 4); ph.endFill(); // ledger
            ph.beginFill(accent, 0.4); ph.drawRect(dx + dw - 32, pY - 21, 12, 1); ph.endFill();
            c.addChild(ph);
            // Waiting area — leather Chesterfield sofas with coffee table
            for (const off of [sx + 30, sx + bw - 110]) {
                const sf = new PIXI.Graphics(); sf.eventMode = 'none';
                sf.beginFill(0x6b3d26); sf.drawRoundedRect(off, pY - 15, 70, 12, 3); sf.endFill();
                sf.beginFill(0x7c4a30); sf.drawRoundedRect(off, pY - 20, 70, 6, 3); sf.endFill();
                // Tufted button detail
                for (let bi = 0; bi < 3; bi++) {
                    sf.beginFill(0x4a2715); sf.drawCircle(off + 14 + bi * 22, pY - 12, 0.9); sf.endFill();
                }
                // Arms
                sf.beginFill(0x4a2715); sf.drawRoundedRect(off - 4, pY - 20, 6, 20, 2); sf.drawRoundedRect(off + 68, pY - 20, 6, 20, 2); sf.endFill();
                c.addChild(sf);
                // Coffee table
                const ct = new PIXI.Graphics(); ct.eventMode = 'none';
                ct.beginFill(0x4a2e18); ct.drawRect(off + 14, pY - 6, 42, 5); ct.endFill();
                ct.beginFill(0xa8a288, 0.5); ct.drawRect(off + 14, pY - 6, 42, 1); ct.endFill();
                // Magazines/newspaper
                ct.beginFill(0xf4efdc); ct.drawRect(off + 20, pY - 7, 10, 5); ct.endFill();
                ct.beginFill(accent, 0.4); ct.drawRect(off + 22, pY - 6, 6, 1); ct.endFill();
                c.addChild(ct);
            }
            // Country silhouette on back wall (country-specific motif)
            this._drawCountrySilhouette(c, sx + bw / 2, fy + fh * 0.45, 110, 40, accent, warm, country.silhouette);
            // Potted palms flanking entrance
            this._drawPalm(c, sx + 15, pY);
            this._drawPalm(c, sx + bw - 25, pY);
            // Red velvet rope + stanchions near door
            const rg = new PIXI.Graphics(); rg.eventMode = 'none';
            for (let sx2 of [sx + bw * 0.35, sx + bw * 0.65]) {
                rg.beginFill(0xfbbf24); rg.drawCircle(sx2, pY - 10, 2); rg.endFill();
                rg.beginFill(0x3a2a18); rg.drawRect(sx2 - 1, pY - 10, 2, 10); rg.endFill();
            }
            rg.lineStyle(1.5, warm, 0.75);
            rg.moveTo(sx + bw * 0.35, pY - 10); rg.lineTo(sx + bw * 0.65, pY - 10);
            rg.lineStyle(0);
            c.addChild(rg);

        } else if (key === 'consular') {
            // Wood floor
            g.beginFill(0x6b4a2c); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            for (let ix = sx; ix < sx + bw; ix += 30) {
                g.beginFill(0x5a3d24, 0.45); g.drawRect(ix, pY - 4, 1, 4); g.endFill();
            }
            // Visa windows — 3 booths with glass partitions
            const booths = 3;
            const boothW = (bw - 60) / booths;
            for (let bi = 0; bi < booths; bi++) {
                const bx = sx + 30 + bi * boothW;
                // Counter
                g.beginFill(0x3a2a18); g.drawRect(bx + 6, pY - 22, boothW - 12, 22); g.endFill();
                g.beginFill(0xa8a288); g.drawRect(bx + 6, pY - 22, boothW - 12, 3); g.endFill();
                // Glass partition with small opening
                g.beginFill(0xcce6ff, 0.18); g.drawRect(bx + 6, pY - 42, boothW - 12, 20); g.endFill();
                g.lineStyle(1, 0x7a7a7a, 0.6); g.drawRect(bx + 6, pY - 42, boothW - 12, 20); g.lineStyle(0);
                // Speaker grille / transaction opening
                g.beginFill(0x1a1a28); g.drawRect(bx + boothW / 2 - 8, pY - 30, 16, 5); g.endFill();
                // Window number sign
                g.beginFill(accent); g.drawRect(bx + boothW / 2 - 8, pY - 48, 16, 4); g.endFill();
                // Stamp tray + papers
                g.beginFill(warm, 0.65); g.drawRect(bx + 12, pY - 19, 10, 3); g.endFill();
                g.beginFill(0xf4efdc); g.drawRect(bx + 28, pY - 20, 14, 5); g.endFill();
            }
            c.addChild(g);
            // Booth number text labels
            for (let bi = 0; bi < booths; bi++) {
                const bx = sx + 30 + bi * boothW;
                const t = new PIXI.Text(String(bi + 1), { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0xfffbe8, fontWeight: 'bold' });
                t.anchor.set(0.5, 0.5); t.x = bx + boothW / 2; t.y = pY - 46;
                c.addChild(t);
            }
            // Queue rope system — stanchions + rope zig-zag
            const rg = new PIXI.Graphics(); rg.eventMode = 'none';
            const queueY = pY - 8;
            const stanchions = [
                { x: sx + 50, y: queueY },
                { x: sx + bw * 0.28, y: queueY },
                { x: sx + bw * 0.28, y: queueY - 14 },
                { x: sx + bw * 0.52, y: queueY - 14 },
                { x: sx + bw * 0.52, y: queueY },
                { x: sx + bw - 50, y: queueY }
            ];
            rg.lineStyle(1.2, warm, 0.65);
            for (let i = 0; i < stanchions.length - 1; i++) {
                rg.moveTo(stanchions[i].x, stanchions[i].y);
                rg.lineTo(stanchions[i + 1].x, stanchions[i + 1].y);
            }
            rg.lineStyle(0);
            for (const s of stanchions) {
                rg.beginFill(0x7a7a7a); rg.drawRect(s.x - 0.8, s.y, 1.6, 8); rg.endFill();
                rg.beginFill(0xfbbf24); rg.drawCircle(s.x, s.y, 1.6); rg.endFill();
            }
            c.addChild(rg);
            // Bulletin board — visa requirements with country-specific stamps
            const bbW = 90, bbX = sx + bw - bbW - 14, bbY = fy + 16;
            const bb = new PIXI.Graphics(); bb.eventMode = 'none';
            bb.beginFill(0x5a3d24); bb.drawRect(bbX, bbY, bbW, 26); bb.endFill();
            bb.beginFill(0x3a2a18); bb.drawRect(bbX + 2, bbY + 2, bbW - 4, 22); bb.endFill();
            // Pinned papers showing visa stamp labels
            country.stamps.forEach((stamp, si) => {
                const pX = bbX + 5 + (si % 2) * ((bbW - 12) / 2);
                const pY2 = bbY + 4 + Math.floor(si / 2) * 10;
                bb.beginFill(0xfffbe8); bb.drawRect(pX, pY2, (bbW - 14) / 2, 8); bb.endFill();
                bb.beginFill(warm, 0.55); bb.drawRect(pX + 1, pY2 + 1, (bbW - 14) / 2 - 2, 2); bb.endFill();
            });
            c.addChild(bb);

        } else if (key === 'attache') {
            // Office carpet
            g.beginFill(0x2a4a6e); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            g.beginFill(0x1a3a5e); g.drawRect(sx + 60, pY - 4, bw - 120, 4); g.endFill();
            // Policy framework whiteboard — country-specific framework lines
            const wbW = Math.min(180, bw * 0.44), wbX = sx + 30, wbY = fy + 16;
            g.beginFill(0xd8d1b2); g.drawRect(wbX - 3, wbY - 3, wbW + 6, 44); g.endFill();
            g.beginFill(0xfffbe8); g.drawRect(wbX, wbY, wbW, 38); g.endFill();
            // Whiteboard title band
            g.beginFill(accent, 0.92); g.drawRect(wbX, wbY, wbW, 10); g.endFill();
            c.addChild(g);
            const wbTitle = new PIXI.Text(country.framework, {
                fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 'bold', fill: 0xfffbe8, letterSpacing: 1.5
            });
            wbTitle.anchor.set(0.5, 0.5); wbTitle.x = wbX + wbW / 2; wbTitle.y = wbY + 5;
            if (wbTitle.width > wbW - 6) wbTitle.scale.set((wbW - 6) / wbTitle.width);
            c.addChild(wbTitle);
            // Framework bullet lines
            country.frameworkLines.forEach((line, li) => {
                const lineTxt = new PIXI.Text('• ' + line, {
                    fontFamily: 'JetBrains Mono', fontSize: 5.2, fill: 0x1a1a28
                });
                lineTxt.anchor.set(0, 0); lineTxt.x = wbX + 5; lineTxt.y = wbY + 14 + li * 5;
                if (lineTxt.width > wbW - 10) lineTxt.scale.set((wbW - 10) / lineTxt.width);
                c.addChild(lineTxt);
            });
            // Desks with monitors
            const deskCount = 3;
            const deskW = 56;
            const deskSpacing = Math.min(84, (bw - wbW - 100) / deskCount);
            const deskStart = wbX + wbW + 40;
            for (let di = 0; di < deskCount; di++) {
                const dx = deskStart + di * deskSpacing;
                const dg = new PIXI.Graphics(); dg.eventMode = 'none';
                // Desk
                dg.beginFill(0x5a3d24); dg.drawRect(dx, pY - 14, deskW, 14); dg.endFill();
                dg.beginFill(0x7c4a30); dg.drawRect(dx, pY - 14, deskW, 2); dg.endFill();
                // Monitor
                dg.beginFill(0x1a1a28); dg.drawRect(dx + 8, pY - 30, 24, 16); dg.endFill();
                dg.beginFill(accent, 0.25); dg.drawRect(dx + 10, pY - 28, 20, 12); dg.endFill();
                // Monitor stand
                dg.beginFill(0x333344); dg.drawRect(dx + 18, pY - 14, 4, 2); dg.endFill();
                // Keyboard + mouse
                dg.beginFill(0x222230); dg.drawRect(dx + 10, pY - 12, 20, 3); dg.endFill();
                dg.beginFill(0x333344); dg.drawCircle(dx + 36, pY - 10, 1.5); dg.endFill();
                // Papers
                dg.beginFill(0xfffbe8); dg.drawRect(dx + 38, pY - 12, 14, 10); dg.endFill();
                dg.beginFill(0x1a1a28, 0.25); dg.drawRect(dx + 40, pY - 10, 10, 1); dg.endFill();
                dg.beginFill(0x1a1a28, 0.25); dg.drawRect(dx + 40, pY - 8, 10, 1); dg.endFill();
                // Desk light
                dg.beginFill(0x333344); dg.drawRect(dx + 2, pY - 18, 2, 4); dg.endFill();
                dg.beginFill(0xfbbf24, 0.8); dg.drawCircle(dx + 3, pY - 20, 2.5); dg.endFill();
                this.indoorLights.push({ g: dg, maxA: 1, type: 'desk' });
                c.addChild(dg);
            }
            // Printer + fax by the wall
            const pr = new PIXI.Graphics(); pr.eventMode = 'none';
            pr.beginFill(0x222230); pr.drawRect(sx + bw - 40, pY - 18, 26, 18); pr.endFill();
            pr.beginFill(0x333344); pr.drawRect(sx + bw - 38, pY - 22, 22, 4); pr.endFill();
            pr.beginFill(0xfbbf24, 0.45); pr.drawRect(sx + bw - 36, pY - 14, 4, 2); pr.endFill();
            pr.beginFill(0x4ade80, 0.65); pr.drawRect(sx + bw - 30, pY - 14, 2, 2); pr.endFill();
            c.addChild(pr);

        } else if (key === 'ambassador') {
            // Hardwood + grand rug
            g.beginFill(0x5a3d24); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            const rugW = bw * 0.72, rugX = sx + bw / 2 - rugW / 2;
            g.beginFill(accent, 0.8); g.drawRect(rugX, pY - 4, rugW, 4); g.endFill();
            g.beginFill(warm, 0.35); g.drawRect(rugX + 8, pY - 3, rugW - 16, 2); g.endFill();
            g.beginFill(0xfbbf24, 0.5); g.drawRect(rugX + 14, pY - 2, rugW - 28, 1); g.endFill();
            // Grand mahogany desk with leather writing pad
            const dw = bw * 0.38, dx = sx + bw / 2 - dw / 2;
            g.beginFill(0x3a1f10); g.drawRect(dx, pY - 20, dw, 20); g.endFill();
            g.beginFill(0x4a2e18); g.drawRect(dx, pY - 20, dw, 3); g.endFill();
            g.beginFill(0x1a0a04, 0.7); g.drawRect(dx + 10, pY - 20, dw - 20, 2); g.endFill();
            // Leather blotter
            g.beginFill(0x2a4a6e, 0.9); g.drawRect(dx + 12, pY - 20, dw - 24, 4); g.endFill();
            // Pen holder + papers
            g.beginFill(0x1a0a04); g.drawCircle(dx + dw - 18, pY - 20, 2); g.endFill();
            g.beginFill(0xfffbe8); g.drawRect(dx + 14, pY - 19, 16, 4); g.endFill();
            g.beginFill(accent, 0.5); g.drawRect(dx + 15, pY - 18, 14, 1); g.endFill();
            // Desk name plaque
            g.beginFill(0x1a1a28); g.drawRect(dx + dw / 2 - 22, pY - 20, 44, 4); g.endFill();
            g.beginFill(0xfbbf24, 0.75); g.drawRect(dx + dw / 2 - 20, pY - 19, 40, 2); g.endFill();
            c.addChild(g);
            const plqTxt = new PIXI.Text(country.deskPlaqueLang, {
                fontFamily: 'JetBrains Mono', fontSize: 5, fontWeight: 'bold', fill: 0x1a1a28, letterSpacing: 0.8
            });
            plqTxt.anchor.set(0.5, 0.5); plqTxt.x = dx + dw / 2; plqTxt.y = pY - 18;
            if (plqTxt.width > 38) plqTxt.scale.set(38 / plqTxt.width);
            c.addChild(plqTxt);
            // Flag pair flanking desk — country flag + Singularity City flag
            for (let fi = 0; fi < 2; fi++) {
                const fx = fi === 0 ? dx - 18 : dx + dw + 12;
                const fg = new PIXI.Graphics(); fg.eventMode = 'none';
                fg.beginFill(0x7a7a7a); fg.drawRect(fx, pY - 42, 1.6, 42); fg.endFill();
                fg.beginFill(0xfbbf24); fg.drawCircle(fx + 0.8, pY - 42, 1.5); fg.endFill();
                if (fi === 0) {
                    // Country flag — horizontal hanging from short crossbar
                    const fw = 14, fh = 9;
                    if (typeof EmbassyRow !== 'undefined' && EmbassyRow.drawCountryFlag) {
                        const flagSub = new PIXI.Graphics(); flagSub.eventMode = 'none';
                        EmbassyRow.drawCountryFlag(flagSub, (this.bld && this.bld.country) || 'us', fw, fh);
                        flagSub.x = fx + 2; flagSub.y = pY - 38;
                        c.addChild(flagSub);
                    } else {
                        flagCols.forEach((col, ci) => {
                            fg.beginFill(col); fg.drawRect(fx + 2, pY - 38 + ci * (fh / flagCols.length), fw, fh / flagCols.length); fg.endFill();
                        });
                    }
                } else {
                    // Singularity City flag — black with cyan circle/orbit
                    fg.beginFill(0x0a0a14); fg.drawRect(fx - 14, pY - 38, 14, 9); fg.endFill();
                    fg.beginFill(0x22d3ee); fg.drawCircle(fx - 7, pY - 33, 2.5); fg.endFill();
                    fg.lineStyle(0.4, 0x22d3ee, 0.7); fg.drawCircle(fx - 7, pY - 33, 4); fg.lineStyle(0);
                    fg.beginFill(0xfbbf24); fg.drawCircle(fx - 7, pY - 29, 0.6); fg.endFill();
                }
                c.addChild(fg);
            }
            // Leather executive chair behind desk
            const ch = new PIXI.Graphics(); ch.eventMode = 'none';
            ch.beginFill(0x3a1f10); ch.drawRoundedRect(dx + dw / 2 - 10, pY - 32, 20, 32, 3); ch.endFill();
            ch.beginFill(0x4a2e18); ch.drawRect(dx + dw / 2 - 9, pY - 32, 18, 4); ch.endFill();
            // Chair base
            ch.beginFill(0x1a0a04); ch.drawRect(dx + dw / 2 - 2, pY - 4, 4, 4); ch.endFill();
            c.addChild(ch);
            // Conference table (smaller, to the side)
            const ctX = sx + 30, ctW = bw * 0.28, ctY = pY - 12;
            const ct = new PIXI.Graphics(); ct.eventMode = 'none';
            ct.beginFill(0x3a1f10); ct.drawRoundedRect(ctX, ctY, ctW, 12, 2); ct.endFill();
            ct.beginFill(0x4a2e18); ct.drawRect(ctX, ctY, ctW, 2); ct.endFill();
            // Four chairs around
            for (let ci = 0; ci < 4; ci++) {
                const cOff = ctX + 8 + ci * (ctW / 4);
                ct.beginFill(0x2a4a6e); ct.drawRect(cOff, ctY + 14, 8, 6); ct.endFill();
                ct.beginFill(0x1a3a5e); ct.drawRect(cOff, ctY + 14, 8, 2); ct.endFill();
            }
            // Teacups on table
            for (let cp = 0; cp < 3; cp++) {
                ct.beginFill(0xfffbe8); ct.drawCircle(ctX + 12 + cp * 20, ctY + 4, 2); ct.endFill();
                ct.beginFill(0x6b3d26); ct.drawCircle(ctX + 12 + cp * 20, ctY + 4, 1); ct.endFill();
            }
            c.addChild(ct);
            // Framed country portrait on back wall
            const pt = new PIXI.Graphics(); pt.eventMode = 'none';
            const ptX = sx + bw - 110, ptY = fy + 14;
            pt.beginFill(0x4a2e18); pt.drawRect(ptX, ptY, 60, 40); pt.endFill();
            pt.beginFill(0xfbbf24, 0.25); pt.drawRect(ptX + 2, ptY + 2, 56, 36); pt.endFill();
            pt.beginFill(accent, 0.35); pt.drawRect(ptX + 4, ptY + 4, 52, 32); pt.endFill();
            // Silhouette head in portrait
            pt.beginFill(0x1a1a28); pt.drawEllipse(ptX + 30, ptY + 22, 8, 10); pt.endFill();
            pt.beginFill(0x1a1a28); pt.drawRect(ptX + 22, ptY + 28, 16, 8); pt.endFill();
            c.addChild(pt);
            // Portrait caption
            const pCap = new PIXI.Text(country.portraitRole, {
                fontFamily: 'JetBrains Mono', fontSize: 5.5, fill: accent, fontWeight: 'bold', letterSpacing: 0.8
            });
            pCap.anchor.set(0.5, 0); pCap.x = ptX + 30; pCap.y = ptY + 42;
            if (pCap.width > 58) pCap.scale.set(58 / pCap.width);
            c.addChild(pCap);
            // Bookshelf
            const bs = new PIXI.Graphics(); bs.eventMode = 'none';
            const bsX = sx + 30, bsY = fy + 14, bsW = 80, bsH = 32;
            bs.beginFill(0x3a2a18); bs.drawRect(bsX, bsY, bsW, bsH); bs.endFill();
            bs.beginFill(0x5a3d24); bs.drawRect(bsX, bsY, bsW, 2); bs.endFill();
            // Book spines
            const bookCols = [0x6b3d26, 0x3a1f10, 0x4a2e18, 0x1a3a5e, 0x7c4a30, accent];
            for (let row = 0; row < 2; row++) {
                const rowY = bsY + 4 + row * 14;
                for (let col = 0; col < 12; col++) {
                    const bkX = bsX + 2 + col * 6.5;
                    const bkCol = bookCols[(row * 12 + col) % bookCols.length];
                    const bkH = 10 + Math.floor(Math.random() * 3);
                    bs.beginFill(bkCol); bs.drawRect(bkX, rowY + (12 - bkH), 5, bkH); bs.endFill();
                    bs.beginFill(0xfbbf24, 0.3); bs.drawRect(bkX, rowY + (12 - bkH), 5, 1); bs.endFill();
                }
            }
            c.addChild(bs);
            // Chandelier
            const ch2 = new PIXI.Graphics(); ch2.eventMode = 'none';
            ch2.beginFill(0x1a1a28); ch2.drawRect(sx + bw / 2 - 0.5, fy + 8, 1, 14); ch2.endFill();
            ch2.beginFill(0xfbbf24); ch2.drawCircle(sx + bw / 2, fy + 24, 6); ch2.endFill();
            ch2.beginFill(0xffe9a8, 0.7); ch2.drawCircle(sx + bw / 2, fy + 24, 4); ch2.endFill();
            for (let arm = 0; arm < 6; arm++) {
                const aa = (arm / 6) * Math.PI * 2;
                const ax = sx + bw / 2 + Math.cos(aa) * 12;
                const ay = fy + 24 + Math.sin(aa) * 4;
                ch2.beginFill(0xfbbf24); ch2.drawCircle(ax, ay, 1.5); ch2.endFill();
                ch2.beginFill(0xffe9a8, 0.6); ch2.drawCircle(ax, ay, 1); ch2.endFill();
            }
            c.addChild(ch2);
            this.indoorLights.push({ g: ch2, maxA: 1, type: 'chandelier' });

        } else if (key === 'archive') {
            // Stone floor
            g.beginFill(0x1a140a); g.drawRect(sx, pY - 4, bw, 4); g.endFill();
            for (let ix = sx; ix < sx + bw; ix += 40) {
                g.beginFill(0x2a1f12, 0.65); g.drawRect(ix, pY - 4, 38, 1); g.endFill();
            }
            // Locked filing cabinets along wall
            const cabW = 22, cabCount = Math.floor((bw - 60) / (cabW + 4));
            for (let ci = 0; ci < cabCount; ci++) {
                const cx = sx + 30 + ci * (cabW + 4);
                g.beginFill(0x2a2a38); g.drawRect(cx, pY - 50, cabW, 50); g.endFill();
                g.beginFill(0x3a3a48); g.drawRect(cx, pY - 50, cabW, 2); g.endFill();
                // 4 drawers
                for (let di = 0; di < 4; di++) {
                    g.beginFill(0x1a1a28); g.drawRect(cx + 1, pY - 48 + di * 12, cabW - 2, 10); g.endFill();
                    // Lock / handle
                    g.beginFill(0xfbbf24, 0.65); g.drawCircle(cx + cabW / 2, pY - 43 + di * 12, 0.8); g.endFill();
                    g.beginFill(0x7a7a7a); g.drawRect(cx + cabW / 2 - 3, pY - 45 + di * 12, 6, 1.5); g.endFill();
                }
                // Label tab
                g.beginFill(warm, 0.55); g.drawRect(cx + 3, pY - 48, 6, 2); g.endFill();
            }
            // Reading desk in centre
            const rdX = sx + bw / 2 - 40, rdY = pY - 14;
            g.beginFill(0x3a1f10); g.drawRect(rdX, rdY, 80, 14); g.endFill();
            g.beginFill(0x4a2e18); g.drawRect(rdX, rdY, 80, 2); g.endFill();
            // Green banker's lamp
            g.beginFill(0x333344); g.drawRect(rdX + 38, rdY - 12, 4, 12); g.endFill();
            g.beginFill(0x14532d); g.drawRect(rdX + 30, rdY - 18, 20, 8); g.endFill();
            g.beginFill(0x22c55e, 0.6); g.drawRect(rdX + 32, rdY - 12, 16, 2); g.endFill();
            // Papers + open folder
            g.beginFill(0xfffbe8); g.drawRect(rdX + 4, rdY - 4, 20, 8); g.endFill();
            g.beginFill(warm, 0.5); g.drawRect(rdX + 6, rdY - 3, 16, 1); g.endFill();
            // CLASSIFIED stamp on paper
            g.beginFill(warm, 0.8); g.drawRect(rdX + 8, rdY - 1, 12, 2); g.endFill();
            c.addChild(g);
            // Warning sign on wall
            const ws = new PIXI.Graphics(); ws.eventMode = 'none';
            ws.beginFill(0x1a1a28); ws.drawRect(sx + 20, fy + 14, 80, 18); ws.endFill();
            ws.beginFill(warm, 0.85); ws.drawRect(sx + 20, fy + 14, 80, 4); ws.endFill();
            c.addChild(ws);
            const wsT = new PIXI.Text('CLASSIFIED · NO PHONES', {
                fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xfffbe8, fontWeight: 'bold', letterSpacing: 0.8
            });
            wsT.anchor.set(0.5, 0.5); wsT.x = sx + 60; wsT.y = fy + 24; c.addChild(wsT);
            // Bare bulb hanging
            const bu = new PIXI.Graphics(); bu.eventMode = 'none';
            bu.beginFill(0x1a1a28); bu.drawRect(sx + bw / 2 - 0.5, fy + 8, 1, 10); bu.endFill();
            bu.beginFill(0xfbbf24); bu.drawCircle(sx + bw / 2, fy + 22, 4); bu.endFill();
            bu.beginFill(0xffe9a8, 0.7); bu.drawCircle(sx + bw / 2, fy + 22, 2.5); bu.endFill();
            c.addChild(bu);
            this.indoorLights.push({ g: bu, maxA: 1, type: 'bulb' });
        }
    },

    // ════════════════════════════════════════════════════
    //   COUNTRY SILHOUETTE (wall art on reception back wall)
    // ════════════════════════════════════════════════════
    _drawCountrySilhouette(c, cx, cy, w, h, accent, warm, key) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glow backing
        g.beginFill(accent, 0.06); g.drawRoundedRect(cx - w / 2 - 6, cy - h / 2 - 4, w + 12, h + 8, 4); g.endFill();
        g.beginFill(accent, 0.12); g.drawRect(cx - w / 2, cy - h / 2, w, h); g.endFill();
        const bx = cx - w / 2, by = cy - h / 2;

        if (key === 'eagle') {
            // Bald eagle with spread wings
            g.beginFill(accent, 0.78);
            g.drawPolygon([
                cx, by + h * 0.25,
                cx - w * 0.48, by + h * 0.55,
                cx - w * 0.22, by + h * 0.65,
                cx - w * 0.38, by + h * 0.85,
                cx - w * 0.05, by + h * 0.7,
                cx + w * 0.05, by + h * 0.7,
                cx + w * 0.38, by + h * 0.85,
                cx + w * 0.22, by + h * 0.65,
                cx + w * 0.48, by + h * 0.55
            ]);
            g.endFill();
            // Head
            g.beginFill(accent, 0.78); g.drawCircle(cx, by + h * 0.25, h * 0.12); g.endFill();
            // Beak
            g.beginFill(warm); g.drawPolygon([cx, by + h * 0.28, cx + h * 0.08, by + h * 0.32, cx, by + h * 0.36]); g.endFill();
        } else if (key === 'great_wall') {
            // Great wall silhouette with watchtowers
            g.beginFill(accent, 0.78);
            g.drawPolygon([
                bx, by + h * 0.85,
                bx + w * 0.15, by + h * 0.85,
                bx + w * 0.15, by + h * 0.45,
                bx + w * 0.22, by + h * 0.45,
                bx + w * 0.22, by + h * 0.85,
                bx + w * 0.5, by + h * 0.7,
                bx + w * 0.78, by + h * 0.85,
                bx + w * 0.78, by + h * 0.45,
                bx + w * 0.85, by + h * 0.45,
                bx + w * 0.85, by + h * 0.85,
                bx + w, by + h * 0.85,
                bx + w, by + h
            ].concat([bx, by + h]));
            g.endFill();
            // Merlons on wall
            for (let mi = 0; mi < 8; mi++) {
                const mx = bx + w * 0.3 + mi * (w * 0.4 / 8);
                g.beginFill(accent, 0.78); g.drawRect(mx, by + h * 0.62, w * 0.04, h * 0.08); g.endFill();
            }
        } else if (key === 'euro_ring') {
            // 12 gold stars in a circle
            const rr = h * 0.38;
            for (let si = 0; si < 12; si++) {
                const ang = (si / 12) * Math.PI * 2 - Math.PI / 2;
                const sx2 = cx + Math.cos(ang) * rr;
                const sy2 = cy + Math.sin(ang) * rr;
                g.beginFill(warm, 0.92);
                g.drawStar ? g.drawStar(sx2, sy2, 5, h * 0.07, h * 0.03) :
                    g.drawCircle(sx2, sy2, h * 0.05);
                g.endFill();
            }
            // Centre "EU" monogram
            g.beginFill(accent, 0.5); g.drawCircle(cx, cy, rr * 0.45); g.endFill();
        } else if (key === 'big_ben') {
            // Big Ben clock tower
            g.beginFill(accent, 0.78);
            g.drawRect(cx - w * 0.12, by + h * 0.15, w * 0.24, h * 0.8);
            g.endFill();
            // Clock face
            g.beginFill(warm, 0.7); g.drawCircle(cx, by + h * 0.32, h * 0.1); g.endFill();
            g.beginFill(0x1a1a28); g.drawCircle(cx, by + h * 0.32, h * 0.02); g.endFill();
            // Clock hands
            g.lineStyle(1, 0x1a1a28, 0.9);
            g.moveTo(cx, by + h * 0.32); g.lineTo(cx, by + h * 0.26);
            g.moveTo(cx, by + h * 0.32); g.lineTo(cx + h * 0.06, by + h * 0.32);
            g.lineStyle(0);
            // Spire
            g.beginFill(accent, 0.78);
            g.drawPolygon([cx - w * 0.12, by + h * 0.15, cx, by - h * 0.02, cx + w * 0.12, by + h * 0.15]);
            g.endFill();
        } else if (key === 'taj_mahal') {
            // Central dome
            g.beginFill(accent, 0.78); g.drawEllipse(cx, by + h * 0.5, w * 0.16, h * 0.2); g.endFill();
            g.beginFill(accent, 0.78); g.drawRect(cx - w * 0.18, by + h * 0.5, w * 0.36, h * 0.4); g.endFill();
            // Minaret spires (4)
            for (const mx of [bx + w * 0.1, bx + w * 0.28, bx + w * 0.72, bx + w * 0.9]) {
                g.beginFill(accent, 0.78); g.drawRect(mx - w * 0.02, by + h * 0.3, w * 0.04, h * 0.6); g.endFill();
                g.beginFill(warm, 0.65); g.drawEllipse(mx, by + h * 0.28, w * 0.025, h * 0.05); g.endFill();
            }
            // Spire on top of dome
            g.beginFill(warm, 0.82);
            g.drawPolygon([cx - w * 0.02, by + h * 0.3, cx, by + h * 0.18, cx + w * 0.02, by + h * 0.3]);
            g.endFill();
        } else if (key === 'dunes') {
            // Rolling dunes with crescent moon and palm
            g.beginFill(accent, 0.78);
            g.drawPolygon([
                bx, by + h * 0.9,
                bx + w * 0.22, by + h * 0.6,
                bx + w * 0.45, by + h * 0.75,
                bx + w * 0.68, by + h * 0.55,
                bx + w * 0.88, by + h * 0.72,
                bx + w, by + h * 0.6,
                bx + w, by + h,
                bx, by + h
            ]);
            g.endFill();
            // Crescent moon
            g.beginFill(warm, 0.85); g.drawCircle(bx + w * 0.82, by + h * 0.22, h * 0.12); g.endFill();
            g.beginFill(accent, 0.08); g.drawCircle(bx + w * 0.86, by + h * 0.2, h * 0.11); g.endFill();
            // Palm tree
            g.beginFill(0x3a2a18); g.drawRect(bx + w * 0.22, by + h * 0.4, w * 0.02, h * 0.25); g.endFill();
            for (let fr = 0; fr < 5; fr++) {
                const ang = (fr / 5) * Math.PI - Math.PI / 2;
                g.beginFill(0x166534, 0.85);
                g.drawEllipse(bx + w * 0.23 + Math.cos(ang) * w * 0.05, by + h * 0.38 + Math.sin(ang) * h * 0.08, w * 0.05, h * 0.025);
                g.endFill();
            }
        }
        c.addChild(g);
    },

    _drawPalm(c, x, pY) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pot
        g.beginFill(0xc6bfa2); g.drawRect(x - 5, pY - 10, 10, 10); g.endFill();
        g.beginFill(0x7a7a7a); g.drawRect(x - 5, pY - 10, 10, 2); g.endFill();
        // Trunk
        g.beginFill(0x3a2a18); g.drawRect(x - 1, pY - 28, 2, 18); g.endFill();
        // Fronds
        g.beginFill(0x166534, 0.9);
        g.drawEllipse(x - 8, pY - 30, 10, 3); g.drawEllipse(x + 8, pY - 30, 10, 3);
        g.drawEllipse(x - 6, pY - 34, 8, 2.5); g.drawEllipse(x + 6, pY - 34, 8, 2.5);
        g.drawEllipse(x, pY - 36, 3, 6);
        g.endFill();
        c.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   NPCs — Diplomatic pixel-art (suit, name badge)
    // ════════════════════════════════════════════════════

    _getNPCsForFloor(key, bw, accent, warm, country) {
        // Night: only the Marine Guard remains at his post. Everyone else
        // (consul, attaché, ambassador, chief of staff, archivist) commutes home
        // to the diplomat villas in Embassy Quarter and is asleep there.
        if (key === 'reception') {
            return [
                { role: 'Receptionist', col: 0x94a3b8, xOff: bw * 0.45, nightShift: false },
                { role: 'Marine Guard', col: warm,    xOff: bw * 0.15, nightShift: true }
            ];
        } else if (key === 'consular') {
            return [
                { role: 'Consul',       col: accent,  xOff: bw * 0.22, nightShift: false },
                { role: 'Visa Officer', col: 0x4ade80, xOff: bw * 0.5, nightShift: false },
                { role: 'Applicant',    col: 0xa855f7, xOff: bw * 0.78, nightShift: false }
            ];
        } else if (key === 'attache') {
            return [
                { role: 'AI Policy Attaché', col: 0xfbbf24, xOff: bw * 0.55, nightShift: false },
                { role: 'Tech Analyst',      col: 0x22d3ee, xOff: bw * 0.78, nightShift: false }
            ];
        } else if (key === 'ambassador') {
            return [
                { role: 'Ambassador',      col: accent, xOff: bw * 0.5, nightShift: false },
                { role: 'Chief of Staff',  col: 0x94a3b8, xOff: bw * 0.2, nightShift: false }
            ];
        } else if (key === 'archive') {
            return [
                { role: 'Archivist', col: 0x64748b, xOff: bw * 0.5, nightShift: false }
            ];
        }
        return [];
    },

    drawNPC(c, x, y, role, col, country) {
        const colHex = col || 0x64748b;
        const bw = 16, h = 32;
        // Seed from role + country so the same diplomat renders identically across
        // visits (hair/skin tone are picked from the seed inside HumanAvatar).
        const seed = 'embassy_' + (country ? country.full : 'x') + '_' + role;

        // ─── Delegate the pixel art to the shared HumanAvatar helper ───
        // Diplomats are humans in suits, so `suit: true` renders the jacket +
        // lapels + tie + pocket pin automatically. We suppress HumanAvatar's
        // default tag and add a smaller role tag below so the caption keeps
        // the previous two-line diplomat look (accent dot + role label).
        const av = HumanAvatar.draw(c, {
            x, y,
            name: null,                  // role tag drawn manually below
            shirt: 0x1a1a28,             // dark navy suit jacket
            accent: colHex,              // country colour → dot + tie + pin
            suit: true,
            tieColor: colHex,
            glasses: false,              // diplomats keep a clean look
            seed,
            showTag: false, showDot: true
        });
        const cont = av.cont, head = av.head, body = av.body;
        const legL = av.legL, legR = av.legR, dot = av.dot, shadow = av.shadow;

        // Role tag above head — country-accent coloured, two-line caption with
        // the accent dot above (matches v404 diplomat look)
        const tag = new PIXI.Text(role, {
            fontFamily: 'JetBrains Mono', fontSize: 5.5, fill: colHex, fontWeight: 'bold'
        });
        tag.anchor.set(0.5, 1); tag.y = -h - 12;
        cont.addChild(tag);

        // Hover / click wiring (preserved from v404)
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 16, bw * 2, h + 20);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                const desc = role + '. ' + (country ? country.full : 'Embassy staff') + '.';
                UI.selectModel({
                    id: 'dip_' + role.replace(/\s/g, '_').toLowerCase(),
                    name: role, isNPC: true, _trackType: 'npc',
                    role, lab: 'embassy', desc
                });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, role, country ? country.full : 'Embassy');
        });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip(); });

        const npcId = 'dip_' + role.replace(/\s/g, '_').toLowerCase();
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }

        const avObj = {
            m: { id: npcId, name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, tag,
            state: 'working', timer: 60 + Math.floor(Math.random() * 220),
            deskX: x, floorY: y, targetX: x, speed: 0.6,
            role, _h: h, _country: country
        };
        this.avatars.push(avObj);
        return avObj;
    },

    // ════════════════════════════════════════════════════
    //   ANIMATION — idle → walk → chat → idle
    // ════════════════════════════════════════════════════

    _updateAvatars() {
        const GENERIC_MSGS = [
            'Memo received.', 'Cable to capital.', 'Noted, thank you.',
            'Consultation scheduled.', 'Briefing at noon.', 'Please hold, one moment.'
        ];
        this.avatars.forEach((av, ai) => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            switch (av.state) {
                case 'working': {
                    // Gentle idle sway
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.6;
                    av.body.rotation = Math.sin(G.tick * 0.03 + av.deskX) * 0.012;
                    av.legL.y = 0; av.legR.y = 0;
                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.25) {
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 100;
                            av.targetX = Math.max(80, Math.min(G.vpW - 80, av.targetX));
                        } else if (r < 0.45) {
                            av.state = 'chatting';
                            av.timer = 60 + Math.floor(Math.random() * 80);
                            const msgs = (av._country && av._country.policyMsgs) ? av._country.policyMsgs.concat(GENERIC_MSGS) : GENERIC_MSGS;
                            this._spawnBubble(av, msgs[Math.floor(Math.random() * msgs.length)]);
                        } else {
                            av.timer = 120 + Math.floor(Math.random() * 220);
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
                    // Nod while talking
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
            else if (l.type === 'desk')   l.g.alpha = l.maxA * (0.85 + Math.sin(G.tick * 0.07) * 0.1);
            else if (l.type === 'bulb')   l.g.alpha = l.maxA * (0.75 + Math.sin(G.tick * 0.15) * 0.18);
            else                          l.g.alpha = l.maxA * (0.8 + Math.sin(G.tick * 0.04) * 0.15);
        });
        // Elevator
        if (this._lift && !this._lift.destroyed) this._lift.update();
        if (typeof InteriorCity !== 'undefined' && InteriorCity._liveTrains) InteriorCity._liveTrains.update();
        // Avatars
        this._updateAvatars();
    }
};

if (typeof window !== 'undefined') window.InteriorEmbassy = InteriorEmbassy;
