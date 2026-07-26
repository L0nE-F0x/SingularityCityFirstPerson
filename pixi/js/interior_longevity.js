/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH INTERIORS (v1.0.0)
   Interior views for Drug Discovery Lab, Clinical Trials Center, Genomics, Cryonics Vault.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorLongevity = {
    container: null,
    scene: null,
    layer: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _startY: 0,
    _startSceneY: 0,
    avatars: [],
    bubbles: [],

    layouts: {
        'longevity_protein': {
            floors: ['Structure Prediction', 'Interactome Modeling', 'AlphaFold 3 Cluster', 'Target Validation', 'Therapy Pipeline'],
            roofLabel: 'AI PROTEIN FOUNDRY',
            col: 0x3b82f6,
            npcs: ['AlphaFold 3 Ops', 'Protein Modeling']
        },
        'longevity_discovery': {
            floors: ['Compound Synthesis', 'Molecular Screening', 'Generative Chemistry AI', 'Target Identification', 'Lead Optimization'],
            roofLabel: 'DRUG DISCOVERY LAB',
            col: 0x22c55e,
            npcs: ['Drug Design', 'Molecular Modeling', 'Compound Synthesis']
        },
        'longevity_trials': {
            floors: ['Patient Intake', 'Phase I Safety', 'Phase II Efficacy', 'Adaptive Protocol Engine'],
            roofLabel: 'CLINICAL TRIALS CENTER',
            col: 0xec4899,
            npcs: ['Clinical Operations', 'Data Analysis']
        },
        'longevity_genomics': {
            floors: ['Sample Prep', 'Sequencing Arrays', 'Bioinformatics Pipeline', 'Epigenome Analysis'],
            roofLabel: 'GENOMICS SEQUENCING',
            col: 0x8b5cf6,
            npcs: ['Sequencing Lead', 'Pipeline Dev']
        },
        'longevity_cryo': {
            floors: ['Intake Processing', 'Vitrification Chamber', 'Deep Storage (-196°C)'],
            roofLabel: 'CRYONICS VAULT',
            col: 0x67e8f9,
            npcs: ['Preservation Ops']
        }
    },

    build(bld, layer) {
        this.container = layer;
        this.layer = layer;
        this.avatars = [];
        this.bubbles = [];
        const layout = this.layouts[bld.id];
        if (!layout) return;

        // Use stage/viewport coords (G.vpW/G.vpH), NOT renderer.width/height
        // which returns DPR-scaled pixel size and breaks layout on hi-DPR displays.
        // This matches the pattern used by every other interior module.
        const W = G.vpW;
        const H = G.vpH;
        const floorH = 80;
        const roofH = 36;
        const numFloors = layout.floors.length;
        // +1 for basement, +220 for zone underground (matches Backbone)
        const totalH = roofH + (numFloors + 1) * floorH + 220;
        const startX = W * 0.12;
        const bldW = W * 0.76;

        // ─── SKY LAYER (behind scene — DOM sky shows through window cutouts) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }

        // Scene container for scrolling
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── ROOF ───
        const roof = new PIXI.Graphics();
        roof.beginFill(0x1a1a2e);
        roof.drawRect(startX - 6, 0, bldW + 12, roofH);
        roof.endFill();
        roof.beginFill(layout.col, 0.3);
        roof.drawRect(startX, 2, bldW, 4);
        roof.endFill();
        this.scene.addChild(roof);

        const roofTxt = new PIXI.Text(layout.roofLabel, {
            fontFamily: 'monospace', fontSize: 11, fill: layout.col, fontWeight: 'bold'
        });
        roofTxt.anchor.set(0.5, 0.5);
        roofTxt.x = startX + bldW / 2;
        roofTxt.y = roofH / 2;
        this.scene.addChild(roofTxt);

        // ─── ELEVATOR LAYOUT (defined early so floor props can use usableW) ───
        // CityElevator shaft is 48px wide (doorWidth=24 each side of center).
        // Place center so right edge of shaft = right edge of building wall.
        const elevatorX = startX + bldW - 26;   // shaft right edge at startX+bldW-2
        const usableW = bldW - 54;              // floor content stops 6px left of shaft

        // ─── FLOORS (f = -1 is themed basement, f = 0..N-1 are normal floors) ───
        // Window band constants for above-ground floors — sky shows through cutout
        const winMarginX = 40;           // space on left/right of window band
        const winY_off = 12;             // window top offset from slab top
        const winH_px = floorH - 26;     // window height (leaves sill + header)
        const mullionPitch = 56;         // pillar spacing
        const mullionW = 6;

        for (let f = -1; f < numFloors; f++) {
            const isBasement = f === -1;
            const fy = isBasement
                ? roofH + numFloors * floorH
                : roofH + (numFloors - 1 - f) * floorH;

            // Floor slab
            const slab = new PIXI.Graphics();
            if (isBasement) {
                // Basement: solid wall, no window (it is underground)
                slab.beginFill(0x0a0f1a);
                slab.drawRect(startX, fy, bldW, floorH);
                slab.endFill();
            } else {
                // Above-ground: punch a window cutout (DOM sky shows through)
                const wallCol = 0x111827;
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                InteriorCity._drawWallWithWindowCutout(
                    slab, wallCol,
                    startX, fy, bldW, floorH,
                    winX, winY, winW, winH_px,
                    mullionPitch, mullionW
                );
                // Window frame lines (stroked only — no fill)
                slab.lineStyle(1.5, 0x1e293b, 0.9);
                slab.drawRect(winX, winY, winW, winH_px);
                slab.moveTo(winX, winY + winH_px * 0.5);
                slab.lineTo(winX + winW, winY + winH_px * 0.5);
                slab.lineStyle(0);
                // Subtle tint over the window to hint at glazing (keeps sky readable)
                slab.beginFill(layout.col, 0.05);
                slab.drawRect(winX, winY, winW, winH_px);
                slab.endFill();
            }
            // Left & right walls
            slab.beginFill(isBasement ? 0x1a2332 : 0x1e293b);
            slab.drawRect(startX - 6, fy, 6, floorH);
            slab.drawRect(startX + bldW, fy, 6, floorH);
            slab.endFill();
            // Floor line
            slab.beginFill(0x334155);
            slab.drawRect(startX, fy + floorH - 2, bldW, 2);
            slab.endFill();
            // Accent
            slab.beginFill(layout.col, isBasement ? 0.08 : 0.15);
            slab.drawRect(startX, fy, bldW, 2);
            slab.endFill();
            this.scene.addChild(slab);

            // Floor props FIRST so the label always reads on top of the equipment
            const floorName = isBasement ? 'B1 · ' + this._basementLabel(bld.id) : layout.floors[f];
            const propsContainer = new PIXI.Container();
            propsContainer.sortableChildren = true;
            propsContainer.x = startX;
            propsContainer.y = fy;
            this.scene.addChild(propsContainer);
            if (isBasement) {
                this._buildBasementProps(propsContainer, bld.id, usableW, floorH, layout.col);
            } else {
                this._buildFloorProps(propsContainer, floorName, usableW, floorH, layout.col, bld.id);
            }

            // Floor label LAST, with a dark backing chip for legibility
            const label = new PIXI.Text(floorName, {
                fontFamily: 'monospace', fontSize: 9, fill: isBasement ? 0x94a3b8 : 0xcbd5e1
            });
            label.x = startX + 8;
            label.y = fy + 5;
            const labelBg = new PIXI.Graphics();
            labelBg.beginFill(0x0a0f18, 0.72);
            labelBg.drawRoundedRect(label.x - 4, label.y - 2, label.width + 8, label.height + 4, 3);
            labelBg.endFill();
            this.scene.addChild(labelBg, label);
        }

        // ─── GROUND SECTION (below basement) ───
        const surfaceY = roofH + numFloors * floorH;              // top of basement = street level
        const belowBasementY = roofH + (numFloors + 1) * floorH;  // bottom of basement
        const ground = new PIXI.Graphics();
        ground.beginFill(0x064e3b, 0.3);
        ground.drawRect(startX - 6, belowBasementY, bldW + 12, 40);
        ground.endFill();
        this.scene.addChild(ground);

        // DNA strand decoration at bottom
        for (let i = 0; i < 20; i++) {
            const dot = new PIXI.Graphics();
            const col = i % 2 === 0 ? layout.col : 0x06b6d4;
            dot.beginFill(col, 0.4);
            dot.drawCircle(0, 0, 1.5);
            dot.endFill();
            dot.x = startX + 10 + i * ((bldW - 20) / 20);
            dot.y = belowBasementY + 20 + Math.sin(i * 0.6) * 8;
            this.scene.addChild(dot);
        }

        // ─── ZONE-AWARE UNDERGROUND (longevity is past metro terminus → east_rock zone) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── ELEVATOR (shaftW/shaftX defined above with usableW) ───
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container();
            ec.y = surfaceY;  // ground floor bottom (CityElevator draws upward)
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

        // ─── Spawn interior NPCs (usableW keeps NPCs out of shaft zone) ───
        this._spawnNPCs(this.scene, startX, usableW, roofH, floorH, numFloors, layout);

        // ─── Scrolling — use same proven pattern as Backbone/VCRow ───
        const bp = 56;
        this.scene.y = H - bp - totalH + floorH;
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + floorH * 3;

        layer.eventMode = 'static';
        layer.cursor = 'grab';
        layer.hitArea = new PIXI.Rectangle(0, 0, W, H);
        if (this._onMove) window.removeEventListener('pointermove', this._onMove);
        if (this._onUp) window.removeEventListener('pointerup', this._onUp);
        layer.on('pointerdown', (e) => {
            this.isDragging = true; this._startY = e.clientY;
            this._startSceneY = this.scene.y; layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorLongevity.isDragging || !InteriorLongevity.scene || InteriorLongevity.scene.destroyed) return;
            let ny = InteriorLongevity._startSceneY + (e.clientY - InteriorLongevity._startY);
            ny = Math.max(InteriorLongevity.minY, Math.min(ny, InteriorLongevity.maxY));
            InteriorLongevity.scene.y = ny;
        };
        this._onUp = () => {
            InteriorLongevity.isDragging = false;
            if (InteriorLongevity.layer) InteriorLongevity.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    _basementLabel(bldId) {
        return {
            'longevity_protein':   'GPU FOLDING CLUSTER',
            'longevity_discovery': 'COMPOUND LIBRARY (-80°C)',
            'longevity_trials':    'BIOHAZARD SAMPLE ARCHIVE',
            'longevity_genomics':  'SEQUENCER COLD ROOM',
            'longevity_cryo':      'VITRIFICATION VAULT (-196°C)'
        }[bldId] || 'SUB-LEVEL';
    },

    _buildBasementProps(container, bldId, bldW, floorH, col) {
        // Common concrete floor texture
        const floor = new PIXI.Graphics();
        floor.beginFill(0x0f172a, 0.6);
        floor.drawRect(6, floorH - 10, bldW - 12, 8);
        floor.endFill();
        // Hazard stripe along front
        for (let i = 0; i < Math.floor(bldW / 16); i++) {
            floor.beginFill((i % 2 === 0) ? 0xfbbf24 : 0x1a1a2e, 0.4);
            floor.drawRect(8 + i * 16, floorH - 3, 14, 2);
            floor.endFill();
        }
        container.addChild(floor);

        if (bldId === 'longevity_discovery') {
            // -80°C compound library: freezer banks with frosted doors
            for (let i = 0; i < 5; i++) {
                const frz = new PIXI.Graphics();
                frz.beginFill(0x1e293b);
                frz.drawRect(0, 0, 44, 56);
                frz.endFill();
                // Frosted door
                frz.beginFill(0xbfdbfe, 0.35);
                frz.drawRect(3, 4, 38, 40);
                frz.endFill();
                // Temperature readout
                frz.beginFill(0x0ea5e9, 0.9);
                frz.drawRect(10, 46, 24, 6);
                frz.endFill();
                // Ice frost on edges
                frz.beginFill(0xffffff, 0.4);
                frz.drawRect(3, 4, 38, 2);
                frz.drawRect(3, 42, 38, 2);
                frz.endFill();
                // Frost puff on top
                frz.beginFill(0xe0f2fe, 0.25);
                frz.drawCircle(22, -2, 8);
                frz.endFill();
                frz.x = 15 + i * ((bldW - 30) / 5);
                frz.y = floorH - 66;
                container.addChild(frz);
            }
            // Compound tray on wheeled cart
            const cart = new PIXI.Graphics();
            cart.beginFill(0x64748b);
            cart.drawRect(0, 0, 50, 4);
            cart.beginFill(0x374151);
            cart.drawRect(4, 4, 6, 10);
            cart.drawRect(40, 4, 6, 10);
            cart.beginFill(0x22c55e, 0.6);
            for (let i = 0; i < 5; i++) { cart.drawRect(4 + i * 8, -6, 5, 6); }
            cart.endFill();
            cart.x = bldW * 0.5 - 25;
            cart.y = floorH - 20;
            container.addChild(cart);
        } else if (bldId === 'longevity_trials') {
            // Biohazard sample archive: locked fridge rows + biohazard drums
            for (let i = 0; i < 6; i++) {
                const bin = new PIXI.Graphics();
                bin.beginFill(0xfef3c7, 0.25);
                bin.drawRect(0, 0, 22, 50);
                bin.endFill();
                bin.lineStyle(1, 0xf59e0b, 0.8);
                bin.drawRect(0, 0, 22, 50);
                bin.lineStyle(0);
                // Biohazard symbol
                bin.beginFill(0xf59e0b, 0.9);
                bin.drawCircle(11, 14, 3);
                bin.endFill();
                bin.beginFill(0x1a1a2e);
                bin.drawCircle(11, 14, 1.5);
                bin.endFill();
                // Sample tubes inside
                for (let t = 0; t < 3; t++) {
                    bin.beginFill(0xec4899, 0.7);
                    bin.drawRect(4 + t * 6, 25, 3, 12);
                    bin.endFill();
                }
                bin.x = 15 + i * ((bldW - 30) / 6);
                bin.y = floorH - 60;
                container.addChild(bin);
            }
            // Biohazard drum
            const drum = new PIXI.Graphics();
            drum.beginFill(0xf59e0b);
            drum.drawRect(0, 0, 24, 32);
            drum.beginFill(0x1a1a2e);
            drum.drawCircle(12, 12, 5);
            drum.endFill();
            drum.x = bldW - 50;
            drum.y = floorH - 42;
            container.addChild(drum);
        } else if (bldId === 'longevity_genomics') {
            // Sequencer cold room: LN2 dewars + chilled sequencer racks
            for (let i = 0; i < 3; i++) {
                const dewar = new PIXI.Graphics();
                // Silver cylindrical dewar
                dewar.beginFill(0xcbd5e1);
                dewar.drawRect(0, 6, 30, 50);
                dewar.drawEllipse(15, 6, 15, 4);
                dewar.endFill();
                // LN2 vapor plume
                dewar.beginFill(0xe0f2fe, 0.5);
                dewar.drawCircle(15, 0, 7);
                dewar.drawCircle(22, -3, 5);
                dewar.endFill();
                // Valve
                dewar.beginFill(0xef4444);
                dewar.drawRect(12, 14, 6, 4);
                dewar.endFill();
                // Label
                dewar.beginFill(0x0f172a, 0.7);
                dewar.drawRect(4, 28, 22, 10);
                dewar.endFill();
                dewar.x = 20 + i * 55;
                dewar.y = floorH - 60;
                container.addChild(dewar);
            }
            // Sequencer rack
            const seq = new PIXI.Graphics();
            seq.beginFill(0x1e293b);
            seq.drawRect(0, 0, bldW * 0.4, 56);
            seq.endFill();
            for (let r = 0; r < 6; r++) {
                seq.beginFill(0x8b5cf6, 0.7);
                seq.drawRect(4, 4 + r * 8, bldW * 0.4 - 8, 4);
                seq.endFill();
                seq.beginFill(0x06b6d4, 0.9);
                seq.drawCircle(bldW * 0.4 - 8, 6 + r * 8, 1.2);
                seq.endFill();
            }
            seq.x = bldW * 0.55;
            seq.y = floorH - 66;
            container.addChild(seq);
        } else if (bldId === 'longevity_cryo') {
            // Vitrification tanks: vertical dewars holding patients at -196°C
            for (let i = 0; i < 5; i++) {
                const tank = new PIXI.Graphics();
                // Tank body - chrome
                tank.beginFill(0xcbd5e1);
                tank.drawRoundedRect(0, 0, 36, 66, 4);
                tank.endFill();
                // Viewing port
                tank.beginFill(0x0f172a);
                tank.drawCircle(18, 18, 9);
                tank.endFill();
                tank.beginFill(0x67e8f9, 0.4);
                tank.drawCircle(18, 18, 8);
                tank.endFill();
                // Frost around port
                tank.beginFill(0xffffff, 0.3);
                tank.drawCircle(18, 18, 9);
                tank.endFill();
                tank.beginFill(0x0f172a);
                tank.drawCircle(18, 18, 7);
                tank.endFill();
                // Temperature display
                tank.beginFill(0x67e8f9, 0.9);
                tank.drawRect(8, 34, 20, 6);
                tank.endFill();
                // Valves
                tank.beginFill(0xef4444);
                tank.drawRect(4, 48, 4, 4);
                tank.drawRect(28, 48, 4, 4);
                tank.endFill();
                // Ice puddle at base
                tank.beginFill(0xe0f2fe, 0.3);
                tank.drawEllipse(18, 70, 22, 4);
                tank.endFill();
                // LN2 vapor at top
                tank.beginFill(0xe0f2fe, 0.35);
                tank.drawCircle(10, -4, 6);
                tank.drawCircle(22, -6, 7);
                tank.drawCircle(28, -2, 5);
                tank.endFill();
                tank.x = 12 + i * ((bldW - 30) / 5);
                tank.y = floorH - 74;
                container.addChild(tank);
            }
        }
    },

    _buildFloorProps(container, floorName, bldW, floorH, col, bldId) {
        const fn = floorName.toLowerCase();
        const midY = floorH * 0.55;

        if (fn.includes('pipeline')) {
            // ─── THERAPY PIPELINE — every real AI-bio company's lead candidate ───
            const cos = (typeof LONGEVITY_COMPANIES !== 'undefined') ? Object.values(LONGEVITY_COMPANIES) : [];
            if (cos.length) {
                const cardW = (bldW - 20) / cos.length;
                cos.forEach((co, i) => {
                    const cx = 10 + i * cardW;
                    const card = new PIXI.Container();
                    const g = new PIXI.Graphics();
                    const coCol = parseInt(co.color.slice(1), 16);
                    g.beginFill(0x0a1420, 0.9); g.drawRoundedRect(cx + 2, 12, cardW - 6, floorH - 26, 3); g.endFill();
                    g.lineStyle(1, coCol, 0.55); g.drawRoundedRect(cx + 2, 12, cardW - 6, floorH - 26, 3); g.lineStyle(0);
                    g.beginFill(coCol, 0.18); g.drawRect(cx + 2, 12, cardW - 6, 10); g.endFill();
                    // Little vial of the candidate, brand-colored
                    const vx = cx + cardW / 2;
                    g.beginFill(0x94a3b8); g.drawRect(vx - 4, floorH - 34, 8, 4); g.endFill();
                    g.beginFill(0xcbd5e1, 0.5); g.drawRect(vx - 3, floorH - 30, 6, 14); g.endFill();
                    g.beginFill(coCol, 0.8); g.drawRect(vx - 3, floorH - 22, 6, 6); g.endFill();
                    card.addChild(g);
                    const nm = new PIXI.Text(co.name, { fontFamily: 'monospace', fontSize: 6, fill: coCol, fontWeight: 'bold' });
                    nm.anchor.set(0.5, 0); nm.x = vx; nm.y = 14; if (nm.width > cardW - 10) nm.scale.set((cardW - 10) / nm.width);
                    card.addChild(nm);
                    const dg = new PIXI.Text(co.drug || '', { fontFamily: 'monospace', fontSize: 5.5, fill: 0xcbd5e1 });
                    dg.anchor.set(0.5, 0); dg.x = vx; dg.y = floorH - 44; if (dg.width > cardW - 8) dg.scale.set((cardW - 8) / dg.width);
                    card.addChild(dg);
                    if (typeof UI !== 'undefined') UI.tip(card, `${co.icon} ${co.name} — ${co.drug || ''}`, co.milestone);
                    container.addChild(card);
                });
            }
        } else if (fn.includes('structure') || fn.includes('interactome') || fn.includes('alphafold') || (fn.includes('target') && bldId === 'longevity_protein')) {
            // AI Protein Foundry floors — folded-protein ribbons + GPU racks
            for (let i = 0; i < 3; i++) {
                const rib = new PIXI.Graphics();
                rib.lineStyle(2, [0x3b82f6, 0x22d3ee, 0x8b5cf6][i % 3], 0.8);
                const rx = 30 + i * (bldW / 3.2);
                for (let s = 0; s <= 14; s++) {
                    const xx = rx + s * 3, yy = midY + Math.sin(s * 0.7) * 12;
                    if (s === 0) rib.moveTo(xx, yy); else rib.lineTo(xx, yy);
                }
                rib.lineStyle(0);
                for (let s = 0; s <= 14; s += 2) { rib.beginFill([0x3b82f6, 0x22d3ee, 0x8b5cf6][i % 3]); rib.drawCircle(rx + s * 3, midY + Math.sin(s * 0.7) * 12, 1.8); rib.endFill(); }
                rib.x = 0; rib.y = 0;
                if (typeof UI !== 'undefined') UI.tip(rib, 'Predicted Protein Fold', 'AlphaFold 3 structure');
                container.addChild(rib);
            }
            // GPU fold cluster along the back
            const gpu = new PIXI.Graphics();
            gpu.beginFill(0x0a0f1a); gpu.drawRect(bldW - 60, 14, 46, floorH - 30); gpu.endFill();
            for (let ly = 20; ly < floorH - 24; ly += 8) { gpu.beginFill(0x22d3ee, 0.6); gpu.drawRect(bldW - 54, ly, 34, 2); gpu.endFill(); }
            if (typeof UI !== 'undefined') UI.tip(gpu, 'Folding GPU Cluster', 'Runs AlphaFold 3 inference');
            container.addChild(gpu);
        } else if (fn.includes('synthesis') || fn.includes('compound')) {
            // Lab benches with flasks
            for (let i = 0; i < 4; i++) {
                const bench = new PIXI.Graphics();
                bench.beginFill(0x374151);
                bench.drawRect(0, 0, 40, 8);
                bench.endFill();
                // Flask
                bench.beginFill(0x22c55e, 0.6);
                bench.drawRect(10, -12, 6, 12);
                bench.endFill();
                bench.beginFill(0x22c55e, 0.3);
                bench.drawCircle(13, -14, 5);
                bench.endFill();
                bench.x = 20 + i * (bldW / 4.5);
                bench.y = midY;
                container.addChild(bench);
            }
        } else if (fn.includes('screening') || fn.includes('molecular')) {
            // HTS microplate arrays
            for (let i = 0; i < 3; i++) {
                const plate = new PIXI.Graphics();
                plate.beginFill(0x1e293b);
                plate.drawRect(0, 0, 50, 25);
                plate.endFill();
                // Wells grid
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 6; c++) {
                        const wellCol = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444][Math.floor(Math.random() * 4)];
                        plate.beginFill(wellCol, 0.5);
                        plate.drawCircle(6 + c * 7, 5 + r * 6, 2);
                        plate.endFill();
                    }
                }
                plate.x = 15 + i * (bldW / 3.5);
                plate.y = midY - 10;
                container.addChild(plate);
            }
        } else if (fn.includes('generative') || fn.includes('chemistry ai')) {
            // Server racks with neural network viz
            for (let i = 0; i < 5; i++) {
                const rack = new PIXI.Graphics();
                rack.beginFill(0x1e293b);
                rack.drawRect(0, 0, 20, 35);
                rack.endFill();
                for (let l = 0; l < 5; l++) {
                    rack.beginFill(col, 0.6);
                    rack.drawRect(3, 3 + l * 6, 14, 4);
                    rack.endFill();
                }
                rack.x = 15 + i * (bldW / 5.5);
                rack.y = midY - 15;
                container.addChild(rack);
            }
        } else if (fn.includes('target')) {
            // Protein structure display
            for (let i = 0; i < 3; i++) {
                const screen = new PIXI.Graphics();
                screen.beginFill(0x0f172a);
                screen.drawRect(0, 0, 55, 35);
                screen.endFill();
                screen.lineStyle(1, col, 0.5);
                // Ribbon diagram hint
                for (let s = 0; s < 6; s++) {
                    screen.moveTo(5 + s * 8, 8 + Math.sin(s) * 10);
                    screen.lineTo(5 + (s + 1) * 8, 8 + Math.sin(s + 1) * 10);
                }
                screen.x = 15 + i * (bldW / 3.5);
                screen.y = midY - 15;
                container.addChild(screen);
            }
        } else if (fn.includes('lead optimization')) {
            // ADMET dashboards
            for (let i = 0; i < 4; i++) {
                const dash = new PIXI.Graphics();
                dash.beginFill(0x0f172a);
                dash.drawRect(0, 0, 40, 28);
                dash.endFill();
                // Bar chart
                for (let b = 0; b < 5; b++) {
                    const h = 5 + Math.random() * 18;
                    dash.beginFill([0x22c55e, 0xfbbf24, 0xef4444][Math.floor(Math.random() * 3)], 0.6);
                    dash.drawRect(4 + b * 7, 25 - h, 5, h);
                    dash.endFill();
                }
                dash.x = 15 + i * (bldW / 4.5);
                dash.y = midY - 10;
                container.addChild(dash);
            }
        } else if (fn.includes('patient') || fn.includes('intake')) {
            // Reception desks with patient icons
            for (let i = 0; i < 3; i++) {
                const desk = new PIXI.Graphics();
                desk.beginFill(0x374151);
                desk.drawRect(0, 0, 50, 10);
                desk.endFill();
                desk.beginFill(0xec4899, 0.4);
                desk.drawRect(5, -8, 12, 8);
                desk.endFill();
                desk.x = 20 + i * (bldW / 3.5);
                desk.y = midY;
                container.addChild(desk);
            }
        } else if (fn.includes('phase i') || fn.includes('safety')) {
            // Monitoring stations with vital signs
            for (let i = 0; i < 4; i++) {
                const mon = new PIXI.Graphics();
                mon.beginFill(0x0f172a);
                mon.drawRect(0, 0, 35, 25);
                mon.endFill();
                // ECG line
                mon.lineStyle(1, 0x22c55e, 0.8);
                mon.moveTo(2, 12);
                for (let x = 0; x < 30; x += 3) {
                    const spike = (x > 12 && x < 18) ? -8 + Math.random() * 16 : 0;
                    mon.lineTo(2 + x, 12 + spike);
                }
                mon.x = 15 + i * (bldW / 4.5);
                mon.y = midY - 10;
                container.addChild(mon);
            }
        } else if (fn.includes('phase ii') || fn.includes('efficacy')) {
            // Data analysis screens
            for (let i = 0; i < 3; i++) {
                const scr = new PIXI.Graphics();
                scr.beginFill(0x0f172a);
                scr.drawRect(0, 0, 50, 30);
                scr.endFill();
                // Kaplan-Meier curve hint
                scr.lineStyle(1, 0x3b82f6, 0.7);
                scr.moveTo(5, 5);
                let cx = 5, cy = 5;
                for (let s = 0; s < 5; s++) {
                    cx += 8;
                    scr.lineTo(cx, cy);
                    cy += 2 + Math.random() * 3;
                    scr.lineTo(cx, cy);
                }
                // Control arm
                scr.lineStyle(1, 0xef4444, 0.5);
                scr.moveTo(5, 5);
                cx = 5; cy = 5;
                for (let s = 0; s < 5; s++) {
                    cx += 8;
                    scr.lineTo(cx, cy);
                    cy += 3 + Math.random() * 4;
                    scr.lineTo(cx, cy);
                }
                scr.x = 15 + i * (bldW / 3.5);
                scr.y = midY - 12;
                container.addChild(scr);
            }
        } else if (fn.includes('adaptive') || fn.includes('protocol')) {
            // Protocol engine dashboards
            for (let i = 0; i < 3; i++) {
                const panel = new PIXI.Graphics();
                panel.beginFill(0x1e293b);
                panel.drawRect(0, 0, 55, 30);
                panel.endFill();
                // Flow diagram nodes
                const nodeColors = [0x22c55e, 0xfbbf24, 0x3b82f6];
                for (let n = 0; n < 3; n++) {
                    panel.beginFill(nodeColors[n], 0.6);
                    panel.drawCircle(10 + n * 16, 15, 4);
                    panel.endFill();
                    if (n < 2) {
                        panel.lineStyle(1, 0x64748b, 0.5);
                        panel.moveTo(14 + n * 16, 15);
                        panel.lineTo(22 + n * 16, 15);
                        panel.lineStyle(0);
                    }
                }
                panel.x = 15 + i * (bldW / 3.5);
                panel.y = midY - 12;
                container.addChild(panel);
            }
        } else if (fn.includes('sample prep')) {
            // Pipettes and tubes
            for (let i = 0; i < 5; i++) {
                const tube = new PIXI.Graphics();
                tube.beginFill(0x374151);
                tube.drawRect(0, 0, 4, 22);
                tube.endFill();
                const fillH = 5 + Math.random() * 14;
                const fillCol = [0x22c55e, 0x06b6d4, 0xfbbf24, 0xec4899][Math.floor(Math.random() * 4)];
                tube.beginFill(fillCol, 0.5);
                tube.drawRect(0, 22 - fillH, 4, fillH);
                tube.endFill();
                tube.x = 20 + i * (bldW / 5.5);
                tube.y = midY - 8;
                container.addChild(tube);
            }
        } else if (fn.includes('sequencing') || fn.includes('arrays')) {
            // Sequencer machines
            for (let i = 0; i < 3; i++) {
                const seq = new PIXI.Graphics();
                seq.beginFill(0x1e293b);
                seq.drawRect(0, 0, 45, 30);
                seq.endFill();
                // ATCG color bars
                const bases = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444];
                for (let b = 0; b < 20; b++) {
                    seq.beginFill(bases[Math.floor(Math.random() * 4)], 0.7);
                    seq.drawRect(3 + b * 2, 5, 1.5, 20);
                    seq.endFill();
                }
                seq.x = 15 + i * (bldW / 3.5);
                seq.y = midY - 12;
                container.addChild(seq);
            }
        } else if (fn.includes('bioinformatics') || fn.includes('pipeline')) {
            // Terminal screens with alignment data
            for (let i = 0; i < 4; i++) {
                const term = new PIXI.Graphics();
                term.beginFill(0x0a0a0a);
                term.drawRect(0, 0, 40, 28);
                term.endFill();
                // Text lines
                for (let l = 0; l < 5; l++) {
                    const lineCol = [0x22c55e, 0x06b6d4][l % 2];
                    term.beginFill(lineCol, 0.4);
                    term.drawRect(3, 3 + l * 5, 15 + Math.random() * 18, 2);
                    term.endFill();
                }
                term.x = 15 + i * (bldW / 4.5);
                term.y = midY - 10;
                container.addChild(term);
            }
        } else if (fn.includes('epigenome')) {
            // Methylation heatmaps
            for (let i = 0; i < 3; i++) {
                const hm = new PIXI.Graphics();
                for (let r = 0; r < 6; r++) {
                    for (let c = 0; c < 8; c++) {
                        const intensity = Math.random();
                        const hmCol = intensity > 0.5 ? 0x8b5cf6 : 0x1e293b;
                        hm.beginFill(hmCol, 0.3 + intensity * 0.5);
                        hm.drawRect(c * 5, r * 5, 4, 4);
                        hm.endFill();
                    }
                }
                hm.x = 15 + i * (bldW / 3.5);
                hm.y = midY - 12;
                container.addChild(hm);
            }
        } else if (fn.includes('vitrification')) {
            // Cryo tanks
            for (let i = 0; i < 4; i++) {
                const tank = new PIXI.Graphics();
                tank.beginFill(0x1e3a5f);
                tank.drawRect(0, 0, 18, 35);
                tank.endFill();
                tank.beginFill(0x93c5fd, 0.3);
                tank.drawRect(2, 10, 14, 23);
                tank.endFill();
                // Frost line
                tank.beginFill(0xbfdbfe, 0.5);
                tank.drawRect(0, 8, 18, 2);
                tank.endFill();
                tank.x = 20 + i * (bldW / 4.5);
                tank.y = midY - 15;
                container.addChild(tank);
            }
        } else if (fn.includes('deep storage') || fn.includes('-196')) {
            // Dewar vessels with frost
            for (let i = 0; i < 5; i++) {
                const dewar = new PIXI.Graphics();
                dewar.beginFill(0x1e293b);
                dewar.drawCircle(0, 0, 12);
                dewar.endFill();
                dewar.beginFill(0x67e8f9, 0.2);
                dewar.drawCircle(0, 0, 9);
                dewar.endFill();
                // Frost crystals
                dewar.beginFill(0xbfdbfe, 0.6);
                for (let c = 0; c < 3; c++) {
                    const angle = c * 2.1;
                    dewar.drawCircle(Math.cos(angle) * 5, Math.sin(angle) * 5, 1.5);
                }
                dewar.endFill();
                dewar.x = 20 + i * (bldW / 5.5);
                dewar.y = midY;
                container.addChild(dewar);
            }
        } else if (fn.includes('processing')) {
            // Intake desks and scanners
            for (let i = 0; i < 3; i++) {
                const desk = new PIXI.Graphics();
                desk.beginFill(0x374151);
                desk.drawRect(0, 0, 45, 10);
                desk.endFill();
                desk.beginFill(0x67e8f9, 0.3);
                desk.drawRect(15, -15, 15, 15);
                desk.endFill();
                desk.x = 20 + i * (bldW / 3.5);
                desk.y = midY;
                container.addChild(desk);
            }
        }
    },

    _spawnNPCs(cont, sx, bw, roofH, floorH, numFloors, layout) {
        // Labs run around the clock (genomics pipelines, cryo techs on night shift, trial
        // monitoring). Spawn NPCs on every floor regardless of hour.
        for (let fi = 0; fi < numFloors; fi++) {
            const fy = roofH + (numFloors - 1 - fi) * floorH;
            const ny = fy + floorH - 8;
            const floorName = layout.floors[fi];
            const floorNpcs = this._getNPCsForFloor(floorName, layout, bw);
            floorNpcs.forEach(def => {
                this.drawNPC(cont, sx + def.xOff, ny, def.role, def.col, def.prop);
            });
            // Reception on the lowest floor — clipboard greeter.
            if (fi === 0) {
                this._drawReceptionDesk(cont, sx + bw * 0.15, ny, layout.col);
                this.drawNPC(cont, sx + bw * 0.18, ny, 'Receptionist', layout.col, 'clipboard');
            }
        }
    },

    _drawReceptionDesk(c, x, y, col) {
        const g = new PIXI.Graphics();
        g.beginFill(0x1a2540); g.drawRect(x, y - 14, 60, 14); g.endFill();
        g.beginFill(0x0f1a2d); g.drawRect(x, y - 14, 60, 2); g.endFill();
        g.beginFill(col, 0.4); g.drawRect(x + 4, y - 12, 52, 1); g.endFill();
        g.beginFill(0x0a0f1a); g.drawRect(x + 36, y - 24, 18, 10); g.endFill();
        g.beginFill(col, 0.45); g.drawRect(x + 38, y - 22, 14, 6); g.endFill();
        g.beginFill(0xfbbf24); g.drawRect(x + 8, y - 18, 8, 6); g.endFill();
        g.beginFill(0xffffff, 0.6); g.drawRect(x + 9, y - 17, 6, 4); g.endFill();
        c.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   FLOOR → NPC ASSIGNMENT
    //   prop: 'clipboard' | 'goggles' | 'mask' | 'cryo' | null
    // ════════════════════════════════════════════════════

    _getNPCsForFloor(floorName, layout, bw) {
        const fn = floorName.toLowerCase();
        const col = layout.col;

        if (fn.includes('synthesis') || fn.includes('compound')) {
            return [
                { role: 'Synthesis Tech',     col: 0x22c55e, xOff: bw * 0.25, prop: 'goggles' },
                { role: 'Medicinal Chemist',  col: 0x06b6d4, xOff: bw * 0.55, prop: 'goggles' },
                { role: 'Lab Assistant',      col: 0x84cc16, xOff: bw * 0.82, prop: 'clipboard' }
            ];
        } else if (fn.includes('screening') || fn.includes('molecular')) {
            return [
                { role: 'Screening Scientist', col: 0x22c55e, xOff: bw * 0.3,  prop: 'goggles' },
                { role: 'HTS Operator',        col: 0x06b6d4, xOff: bw * 0.65, prop: 'goggles' }
            ];
        } else if (fn.includes('generative') || fn.includes('chemistry ai')) {
            return [
                { role: 'ML Engineer',     col: 0x3b82f6, xOff: bw * 0.3,  prop: null },
                { role: 'Research Chemist', col: 0x22c55e, xOff: bw * 0.6,  prop: 'goggles' },
                { role: 'Data Scientist',  col: 0x8b5cf6, xOff: bw * 0.85, prop: null }
            ];
        } else if (fn.includes('target')) {
            return [
                { role: 'Structural Bio',   col: 0x8b5cf6, xOff: bw * 0.3,  prop: null },
                { role: 'Protein Modeler',  col: 0x06b6d4, xOff: bw * 0.7,  prop: null }
            ];
        } else if (fn.includes('lead optimization')) {
            return [
                { role: 'ADMET Analyst',    col: 0xfbbf24, xOff: bw * 0.3,  prop: 'clipboard' },
                { role: 'Pharmacologist',   col: 0xec4899, xOff: bw * 0.7,  prop: 'goggles' }
            ];
        } else if (fn.includes('intake processing') || (fn.includes('processing') && fn.includes('intake'))) {
            // Cryonics intake — cold chain, not clinical
            return [
                { role: 'Intake Specialist', col: 0x67e8f9, xOff: bw * 0.3, prop: 'mask' },
                { role: 'Cryo Intake',       col: 0x06b6d4, xOff: bw * 0.7, prop: 'cryo' }
            ];
        } else if (fn.includes('patient') || fn.includes('intake')) {
            return [
                { role: 'Trial Coordinator', col: 0xec4899, xOff: bw * 0.25, prop: 'clipboard' },
                { role: 'Intake Nurse',      col: 0xf43f5e, xOff: bw * 0.55, prop: 'mask' },
                { role: 'Patient Advocate',  col: 0xf97316, xOff: bw * 0.82, prop: 'clipboard' }
            ];
        } else if (fn.includes('phase ii') || fn.includes('efficacy')) {
            return [
                { role: 'Biostatistician',  col: 0xfbbf24, xOff: bw * 0.3,  prop: null },
                { role: 'Data Manager',     col: 0x3b82f6, xOff: bw * 0.7,  prop: 'clipboard' }
            ];
        } else if (fn.includes('phase i') || fn.includes('safety')) {
            return [
                { role: 'Clinical Monitor', col: 0xec4899, xOff: bw * 0.3,  prop: 'clipboard' },
                { role: 'Safety Officer',   col: 0xef4444, xOff: bw * 0.65, prop: 'mask' }
            ];
        } else if (fn.includes('adaptive') || fn.includes('protocol')) {
            return [
                { role: 'Trial Manager',    col: 0xec4899, xOff: bw * 0.3,  prop: 'clipboard' },
                { role: 'Protocol Eng',     col: 0x22c55e, xOff: bw * 0.7,  prop: null }
            ];
        } else if (fn.includes('sample prep')) {
            return [
                { role: 'Lab Tech',         col: 0x22c55e, xOff: bw * 0.3,  prop: 'goggles' },
                { role: 'Sample Prepper',   col: 0x06b6d4, xOff: bw * 0.7,  prop: 'goggles' }
            ];
        } else if (fn.includes('sequencing') || fn.includes('arrays')) {
            return [
                { role: 'Sequencing Lead',  col: 0x8b5cf6, xOff: bw * 0.3,  prop: 'goggles' },
                { role: 'Machine Tech',     col: 0xa855f7, xOff: bw * 0.65, prop: null }
            ];
        } else if (fn.includes('bioinformatics') || fn.includes('pipeline')) {
            return [
                { role: 'Bioinformatics Eng', col: 0x8b5cf6, xOff: bw * 0.3,  prop: null },
                { role: 'Pipeline Dev',       col: 0x06b6d4, xOff: bw * 0.65, prop: null },
                { role: 'Genomics Scientist', col: 0xa855f7, xOff: bw * 0.9,  prop: null }
            ];
        } else if (fn.includes('epigenome')) {
            return [
                { role: 'Epigenetics Lead', col: 0x8b5cf6, xOff: bw * 0.3,  prop: null },
                { role: 'Methyl Analyst',   col: 0xa855f7, xOff: bw * 0.7,  prop: null }
            ];
        } else if (fn.includes('vitrification')) {
            return [
                { role: 'Cryo Technician',  col: 0x67e8f9, xOff: bw * 0.3,  prop: 'cryo' },
                { role: 'Preservation Lead', col: 0x93c5fd, xOff: bw * 0.7, prop: 'cryo' }
            ];
        } else if (fn.includes('deep storage') || fn.includes('-196')) {
            return [
                { role: 'Vault Monitor',    col: 0x67e8f9, xOff: bw * 0.3,  prop: 'cryo' },
                { role: 'Dewar Operator',   col: 0x93c5fd, xOff: bw * 0.7,  prop: 'cryo' }
            ];
        } else if (fn.includes('processing')) {
            return [
                { role: 'Intake Specialist', col: 0x67e8f9, xOff: bw * 0.3, prop: 'mask' },
                { role: 'Cryo Intake',       col: 0x06b6d4, xOff: bw * 0.7, prop: 'cryo' }
            ];
        } else {
            return [{ role: 'Researcher', col: col, xOff: bw * 0.5, prop: 'goggles' }];
        }
    },

    // ════════════════════════════════════════════════════
    //   PIXEL ART NPC (standard avatar — lab coat + prop)
    // ════════════════════════════════════════════════════

    drawNPC(c, x, y, role, col, prop) {
        const colHex = col || 0x22c55e;
        const bw = 16, h = 32, headH = Math.round(32 * 0.4), bodyH = h - headH - 4, legH = 4, eyeS = Math.max(1, 16 * 0.08);
        const cont = new PIXI.Container();

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.38, eyeS); head.drawCircle(bw * 0.1, headH * 0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5); head.endFill();
        // Hair cap (muted so lab coat reads as dominant)
        head.beginFill(0x4b5563); head.drawRoundedRect(-bw * 0.4, -1, bw * 0.8, 2, 1); head.endFill();
        // Prop on head / face
        if (prop === 'goggles') {
            head.beginFill(0x93c5fd, 0.75); head.drawRect(-bw * 0.4, headH * 0.25, bw * 0.8, 2.5); head.endFill();
            head.beginFill(0x0f172a); head.drawRect(-bw * 0.15, headH * 0.25, 0.8, 2.5); head.endFill();
        } else if (prop === 'mask') {
            head.beginFill(0xf8fafc); head.drawRect(-bw * 0.4, headH * 0.55, bw * 0.8, 3); head.endFill();
            head.beginFill(0xcbd5e1, 0.6); head.drawRect(-bw * 0.4, headH * 0.55, bw * 0.8, 1); head.endFill();
        } else if (prop === 'cryo') {
            // Cold-weather cap / balaclava hint
            head.beginFill(0x60a5fa); head.drawRoundedRect(-bw * 0.42, -2, bw * 0.84, 4, 1); head.endFill();
            head.beginFill(0xbfdbfe); head.drawRect(-bw * 0.42, 0, bw * 0.84, 1); head.endFill();
        }
        head.y = -h;

        // Lab coat body (white), with role color as accent trim
        const body = new PIXI.Graphics();
        body.beginFill(0xf8fafc); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        // Coat opening seam
        body.beginFill(0xcbd5e1, 0.7); body.drawRect(-0.5, 0, 1, Math.max(bodyH, 4)); body.endFill();
        // Role-color collar accent
        body.beginFill(colHex); body.drawRect(-bw / 2, 0, bw, 1.5); body.endFill();
        // Role-color pocket (left side)
        body.beginFill(colHex, 0.6); body.drawRect(-bw * 0.4, Math.max(bodyH, 4) * 0.55, bw * 0.3, 1.5); body.endFill();
        // Clipboard held in front (if assigned)
        if (prop === 'clipboard') {
            body.beginFill(0x78350f); body.drawRect(bw * 0.15, Math.max(bodyH, 4) * 0.3, bw * 0.35, bw * 0.45); body.endFill();
            body.beginFill(0xfef3c7); body.drawRect(bw * 0.2, Math.max(bodyH, 4) * 0.35, bw * 0.25, bw * 0.35); body.endFill();
            body.beginFill(0x475569); body.drawRect(bw * 0.22, Math.max(bodyH, 4) * 0.4, bw * 0.2, 0.5); body.endFill();
            body.beginFill(0x475569); body.drawRect(bw * 0.22, Math.max(bodyH, 4) * 0.5, bw * 0.15, 0.5); body.endFill();
        }
        // Cryo gloves (blue hands)
        if (prop === 'cryo') {
            body.beginFill(0x60a5fa); body.drawRect(-bw * 0.55, Math.max(bodyH, 4) * 0.5, bw * 0.2, 2); body.endFill();
            body.beginFill(0x60a5fa); body.drawRect(bw * 0.35, Math.max(bodyH, 4) * 0.5, bw * 0.2, 2); body.endFill();
        }
        body.y = -h + headH;

        const lw = Math.max(2, bw * 0.25), lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x1e293b); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x1e293b); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15;

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
                UI.selectModel({ id: 'longev_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true, _trackType: 'npc', role: role, lab: 'longevity', desc: role + '. Longevity Research.' });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, role, 'Longevity Research');
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
        });

        const npcId = 'longev_' + role.replace(/\s/g, '_').toLowerCase();
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }

        c.addChild(cont);

        const agent = {
            m: { id: npcId, name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.7,
            role, prop, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   NPC ANIMATION STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const LONGEVITY_MSGS = [
            "Compound 447 active.", "IC50 reached.", "Trial arm B promising.",
            "Genome aligned.", "Protein folded.", "Senolytic working.",
            "ADMET profile clean.", "Vital signs stable.", "Sequencing 2.3B reads.",
            "Methylation dropping.", "Cryo stable at -196°C.", "Autophagy induced.",
            "Patient enrolled.", "Dose escalation OK.", "Epigenetic clock -0.4y.",
            "Telomerase upregulated.", "Assay clean.", "Phase II looking good.",
            "Dewar nominal.", "Vitrification complete.", "Methyl signature found."
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
                            this.spawnBubble(av, LONGEVITY_MSGS[Math.floor(Math.random() * LONGEVITY_MSGS.length)]);
                        } else {
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.22) {
                                this.spawnBubble(av, LONGEVITY_MSGS[Math.floor(Math.random() * LONGEVITY_MSGS.length)]);
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

    update() {
        // Paint DOM sky gradient + celestial gfx + twinkle stars.
        // Floors above-ground have window cutouts, so this sky shows through.
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        if (this._lift && !this._lift.destroyed) this._lift.update();
        this.updateAvatars();
    },

    cleanup() {
        if (this._lift) { this._lift.destroy(); this._lift = null; }
        this.container = null;
        this.layer = null;
        this.scene = null;
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this.isDragging = false;
        this.avatars = [];
        this.bubbles = [];
    }
};
