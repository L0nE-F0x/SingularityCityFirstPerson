/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   EMBASSY QUARTER (v1.0.0 — Phase 5, diplomat residences)
   Six country-themed ambassador villas, placed immediately east of Embassy Row so the diplomats
   commute a short walk to their consulates. Each villa carries the host country's architectural
   vernacular — Georgian (US), pagoda (CN), Haussmann townhouse (EU), Victorian brick (UK),
   sandstone haveli (IN), modern Arabian (UAE) — plus a small flagpole on the roof.

   Clicking a villa opens UI.selectBld with an "Ambassador's Residence" brief. The resident
   diplomat NPC uses the InteriorNPC module (shared with Worker Housing / VC Suburbia).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EmbassyQuarter = {
    BLDS: [
        {
            id: 'diplomat_villa_us', name: 'US Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇺🇸',
            type: 'diplomat_villa', country: 'us',
            flagColors: [0xbf0a30, 0xffffff, 0x002868],
            accent: 0x002868,
            style: 'georgian',
            diplomatId: 'npc_dip_us',
            desc: 'Federal-style mansion housing the US Ambassador. White clapboard siding, black shutters, and a red-brick chimney. Flies the Stars and Stripes above a columned portico.'
        },
        {
            id: 'diplomat_villa_cn', name: 'Chinese Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇨🇳',
            type: 'diplomat_villa', country: 'cn',
            flagColors: [0xde2910, 0xffde00],
            accent: 0xde2910,
            style: 'pagoda',
            diplomatId: 'npc_dip_cn',
            desc: 'Traditional courtyard villa with layered pagoda roof and gold trim. Home to the Chinese Ambassador. Red lacquered gates face the street.'
        },
        {
            id: 'diplomat_villa_eu', name: 'EU Representative\'s Residence', w: 130, fl: 3, emoji: '🇪🇺',
            type: 'diplomat_villa', country: 'eu',
            flagColors: [0x003399, 0xffcc00],
            accent: 0x003399,
            style: 'haussmann',
            diplomatId: 'npc_dip_eu',
            desc: 'Haussmann-style Brussels townhouse with mansard roof, iron balcony, and tall french windows. Home to the EU Representative.'
        },
        {
            id: 'diplomat_villa_uk', name: 'UK High Commissioner\'s Residence', w: 130, fl: 3, emoji: '🇬🇧',
            type: 'diplomat_villa', country: 'uk',
            flagColors: [0xc8102e, 0xffffff, 0x012169],
            accent: 0x012169,
            style: 'victorian',
            diplomatId: 'npc_dip_uk',
            desc: 'Victorian red-brick terrace with bay windows, chimney stacks, and a glossy black door. Home to the UK High Commissioner.'
        },
        {
            id: 'diplomat_villa_in', name: 'Indian High Commissioner\'s Residence', w: 130, fl: 3, emoji: '🇮🇳',
            type: 'diplomat_villa', country: 'in',
            flagColors: [0xff9933, 0xffffff, 0x138808],
            accent: 0xff9933,
            style: 'haveli',
            diplomatId: 'npc_dip_in',
            desc: 'Rajasthani haveli-style residence with carved sandstone jharokha balconies and domed cupolas. Home to the Indian High Commissioner.'
        },
        {
            id: 'diplomat_villa_ae', name: 'UAE Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇦🇪',
            type: 'diplomat_villa', country: 'ae',
            flagColors: [0xce1126, 0x00732f, 0xffffff, 0x000000],
            accent: 0x00732f,
            style: 'arabian',
            diplomatId: 'npc_dip_ae',
            desc: 'Modern Arabian villa with cream stucco walls, crescent-arch mashrabiya windows, and a flat parapet roof. Home to the UAE Ambassador.'
        }
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { ...def, x: 0, lab: null };
                BLDS.push(bld);
                if (typeof G !== 'undefined' && G.bldById) G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(afterX) {
        let x = afterX + 40;
        this.zoneStartX = x;
        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) { bld.x = x; x += bld.w + 15; }
        });
        this.zoneEndX = x + 25;
        return this.zoneEndX;
    },

    /* ──────────────────────────────────────────────────────────────────────
       Exterior render. Called from environment.js for every b.type === 'diplomat_villa'.
       Draws country-themed facade into the building's graphics object.
       ────────────────────────────────────────────────────────────────────── */
    renderExterior(b, container, gfx, h) {
        const style = b.style || 'georgian';
        const flagCols = b.flagColors || [0xcccccc];
        const accent = (typeof b.accent === 'number') ? b.accent : flagCols[0];

        // Route to the country-specific renderer
        switch (style) {
            case 'georgian':   this._drawGeorgian(b, container, gfx, h, flagCols, accent); break;
            case 'pagoda':     this._drawPagoda(b, container, gfx, h, flagCols, accent); break;
            case 'haussmann':  this._drawHaussmann(b, container, gfx, h, flagCols, accent); break;
            case 'victorian':  this._drawVictorian(b, container, gfx, h, flagCols, accent); break;
            case 'haveli':     this._drawHaveli(b, container, gfx, h, flagCols, accent); break;
            case 'arabian':    this._drawArabian(b, container, gfx, h, flagCols, accent); break;
            default:           this._drawGeorgian(b, container, gfx, h, flagCols, accent); break;
        }

        // Shared: flag pole + flag (all villas carry the host country's flag)
        this._addFlagpole(b, container, flagCols);

        // Shared: small garden strip / path at the base
        this._addGarden(b, gfx, h, accent);
    },

    /* ─── Georgian/Federal (US) — white clapboard, red-brick chimney, dark-blue gabled roof ─── */
    _drawGeorgian(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Clapboard body (warm ivory)
        gfx.beginFill(0xf4efe2); gfx.drawRect(0, 0, W, h); gfx.endFill();
        // Clapboard horizontal siding lines
        gfx.lineStyle(0.5, 0xdcd5bf, 0.7);
        for (let y = 6; y < h - 4; y += 5) { gfx.moveTo(2, y); gfx.lineTo(W - 2, y); }
        gfx.lineStyle(0);
        // Stone foundation
        gfx.beginFill(0xb0a890); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Dark blue gabled roof
        gfx.beginFill(0x1e2a40);
        gfx.drawPolygon([-4, 0, W / 2, -18, W + 4, 0, W, 4, 0, 4]);
        gfx.endFill();
        // Roof shadow edge
        gfx.beginFill(0x0f1a2e);
        gfx.drawPolygon([W / 2, -18, W + 4, 0, W, 4]);
        gfx.endFill();
        // Red brick chimney (right side)
        gfx.beginFill(0x7a2b1f); gfx.drawRect(W - 26, -14, 10, 18); gfx.endFill();
        gfx.beginFill(0x5a1e14); gfx.drawRect(W - 26, -16, 10, 2); gfx.endFill();
        // Brick pattern on chimney
        gfx.lineStyle(0.4, 0x4a1a10, 0.8);
        gfx.moveTo(W - 21, -14); gfx.lineTo(W - 21, 4);
        gfx.moveTo(W - 26, -9); gfx.lineTo(W - 16, -9);
        gfx.moveTo(W - 26, -4); gfx.lineTo(W - 16, -4);
        gfx.lineStyle(0);
        // Front columned portico
        const portW = 34, portX = W / 2 - portW / 2, portY = h - 26;
        gfx.beginFill(0xfffbe8); gfx.drawRect(portX, portY, portW, 20); gfx.endFill();
        // Two Doric columns
        for (const cx of [portX + 4, portX + portW - 8]) {
            gfx.beginFill(0xfffbe8); gfx.drawRect(cx, portY - 4, 4, 22); gfx.endFill();
            gfx.beginFill(0xcfc8ad, 0.7); gfx.drawRect(cx + 2, portY - 4, 2, 22); gfx.endFill();
            gfx.beginFill(0xe8e0c5); gfx.drawRect(cx - 1, portY - 6, 6, 2); gfx.endFill();
        }
        // Portico pediment (small triangle above)
        gfx.beginFill(0xf4efe2);
        gfx.drawPolygon([portX - 2, portY - 6, portX + portW / 2, portY - 14, portX + portW + 2, portY - 6]);
        gfx.endFill();
        // Red door
        const dW = 10, dH = 18, dX = W / 2 - dW / 2, dY = h - dH - 6;
        gfx.beginFill(0x8b1a1a); gfx.drawRect(dX, dY, dW, dH); gfx.endFill();
        gfx.beginFill(0x6b1212); gfx.drawRect(dX + 1, dY + 1, dW - 2, dH - 2); gfx.endFill();
        gfx.beginFill(0xfbbf24); gfx.drawCircle(dX + dW - 2, dY + dH / 2, 0.7); gfx.endFill();
        // Windows with black shutters (2 on each floor)
        const winRows = [h - 46, h - 66];
        for (const wy of winRows) {
            if (wy < 4) continue;
            for (const wx of [W * 0.22 - 7, W * 0.78 - 7]) {
                // Shutter-black frames
                gfx.beginFill(0x1a1810); gfx.drawRect(wx - 2, wy, 2, 12); gfx.endFill();
                gfx.beginFill(0x1a1810); gfx.drawRect(wx + 14, wy, 2, 12); gfx.endFill();
                // Window glass
                gfx.beginFill(0x1a1a28); gfx.drawRect(wx, wy, 14, 12); gfx.endFill();
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx + 1, wy + 1, 12, 10); gfx.endFill();
                // Muntin cross
                gfx.lineStyle(0.4, 0xf4efe2, 0.8);
                gfx.moveTo(wx + 7, wy + 1); gfx.lineTo(wx + 7, wy + 11);
                gfx.moveTo(wx + 1, wy + 6); gfx.lineTo(wx + 13, wy + 6);
                gfx.lineStyle(0);
            }
        }
    },

    /* ─── Pagoda (CN) — red walls, golden trim, upturned tile roof layers ─── */
    _drawPagoda(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Body — deep red lacquer
        gfx.beginFill(0x7a1a1a); gfx.drawRect(0, 0, W, h); gfx.endFill();
        gfx.beginFill(0x951f20); gfx.drawRect(2, 2, W - 4, h - 6); gfx.endFill();
        // Stone foundation
        gfx.beginFill(0x5a5248); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Gold trim lines between floors
        gfx.beginFill(0xd4a83b);
        gfx.drawRect(0, 26, W, 2);
        gfx.drawRect(0, 46, W, 2);
        gfx.endFill();
        // Pagoda-style roof — wider overhang with upturned corners
        gfx.beginFill(0x2a6142);  // jade-green tiles
        gfx.drawPolygon([-8, 0, W / 2, -14, W + 8, 0, W + 4, 4, -4, 4]);
        gfx.endFill();
        // Second roof tier (smaller, above)
        gfx.beginFill(0x1f4a33);
        gfx.drawPolygon([10, -14, W / 2, -24, W - 10, -14, W - 14, -10, 14, -10]);
        gfx.endFill();
        // Gold ridge ornament
        gfx.beginFill(0xd4a83b); gfx.drawCircle(W / 2, -24, 2); gfx.endFill();
        gfx.beginFill(0xffe27a); gfx.drawCircle(W / 2, -25, 1); gfx.endFill();
        // Upturned eave corners (little yellow dots)
        gfx.beginFill(0xd4a83b);
        gfx.drawCircle(-6, 0, 1.8);
        gfx.drawCircle(W + 6, 0, 1.8);
        gfx.drawCircle(12, -12, 1.2);
        gfx.drawCircle(W - 12, -12, 1.2);
        gfx.endFill();
        // Gold-trimmed door
        const dW = 12, dH = 20, dX = W / 2 - dW / 2, dY = h - dH - 6;
        gfx.beginFill(0xd4a83b); gfx.drawRect(dX - 2, dY - 2, dW + 4, dH + 4); gfx.endFill();
        gfx.beginFill(0x5a0e0e); gfx.drawRect(dX, dY, dW, dH); gfx.endFill();
        gfx.beginFill(0x3a0808); gfx.drawRect(dX + 1, dY + 1, dW - 2, dH - 2); gfx.endFill();
        // Door split + brass knockers
        gfx.lineStyle(0.5, 0xd4a83b, 0.9);
        gfx.moveTo(dX + dW / 2, dY + 2); gfx.lineTo(dX + dW / 2, dY + dH - 2);
        gfx.lineStyle(0);
        gfx.beginFill(0xd4a83b);
        gfx.drawCircle(dX + dW / 2 - 2, dY + dH / 2, 0.8);
        gfx.drawCircle(dX + dW / 2 + 2, dY + dH / 2, 0.8);
        gfx.endFill();
        // Red lanterns flanking the door
        for (const lx of [dX - 10, dX + dW + 10]) {
            gfx.beginFill(0x333333); gfx.drawRect(lx - 0.5, dY + 2, 1, 3); gfx.endFill();
            gfx.beginFill(0xd4a83b); gfx.drawCircle(lx, dY + 10, 2.4); gfx.endFill();
            gfx.beginFill(0xff4a2b, 0.9); gfx.drawCircle(lx, dY + 10, 2); gfx.endFill();
            gfx.beginFill(0xfff1c2, 0.6); gfx.drawCircle(lx, dY + 10, 0.9); gfx.endFill();
        }
        // Windows — round / moon gates
        for (const wy of [h - 46, h - 66]) {
            if (wy < 4) continue;
            for (const wx of [W * 0.22, W * 0.78]) {
                gfx.beginFill(0xd4a83b); gfx.drawCircle(wx, wy + 6, 6); gfx.endFill();
                gfx.beginFill(0x1a1a28); gfx.drawCircle(wx, wy + 6, 5); gfx.endFill();
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawCircle(wx, wy + 6, 4); gfx.endFill();
                // Lattice cross
                gfx.lineStyle(0.4, 0xd4a83b, 0.8);
                gfx.moveTo(wx - 4, wy + 6); gfx.lineTo(wx + 4, wy + 6);
                gfx.moveTo(wx, wy + 2); gfx.lineTo(wx, wy + 10);
                gfx.lineStyle(0);
            }
        }
    },

    /* ─── Haussmann (EU) — cream limestone, mansard roof, iron balcony ─── */
    _drawHaussmann(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Limestone body
        gfx.beginFill(0xe8dfc7); gfx.drawRect(0, 0, W, h); gfx.endFill();
        gfx.beginFill(0xf2eacf); gfx.drawRect(2, 2, W - 4, h - 6); gfx.endFill();
        // Horizontal string courses (floor dividers)
        gfx.beginFill(0xcdc4a8);
        gfx.drawRect(0, 26, W, 1.5);
        gfx.drawRect(0, 46, W, 1.5);
        gfx.endFill();
        // Stone foundation with quoins
        gfx.beginFill(0xb8b09a); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Mansard roof — dark grey slate with a shallow flat top
        gfx.beginFill(0x3a3a44);
        gfx.drawPolygon([-2, 0, 6, -14, W - 6, -14, W + 2, 0]);
        gfx.endFill();
        // Roof dormer windows
        for (const dx of [W * 0.3 - 4, W * 0.7 - 4]) {
            gfx.beginFill(0x2a2a32); gfx.drawRect(dx, -11, 8, 7); gfx.endFill();
            gfx.beginFill(0xffe9a8, 0.6); gfx.drawRect(dx + 1, -10, 6, 5); gfx.endFill();
            // Tiny dormer roof (triangular)
            gfx.beginFill(0x2a2a32);
            gfx.drawPolygon([dx - 1, -11, dx + 4, -14, dx + 9, -11]);
            gfx.endFill();
        }
        // Ornate front door (tall, with arched top)
        const dW = 12, dH = 22, dX = W / 2 - dW / 2, dY = h - dH - 6;
        gfx.beginFill(0xd4b066); gfx.drawRect(dX - 2, dY - 2, dW + 4, dH + 4); gfx.endFill();  // gold frame
        gfx.beginFill(0x3a2a1a); gfx.drawRect(dX, dY + 2, dW, dH - 2); gfx.endFill();
        gfx.beginFill(0x3a2a1a); gfx.drawCircle(dX + dW / 2, dY + 2, dW / 2); gfx.endFill();  // arched top
        gfx.beginFill(0x2a1a10); gfx.drawRect(dX + 1, dY + 3, dW - 2, dH - 4); gfx.endFill();
        // Gold door split + handle
        gfx.lineStyle(0.5, 0xd4b066, 0.9);
        gfx.moveTo(dX + dW / 2, dY + 4); gfx.lineTo(dX + dW / 2, dY + dH - 2);
        gfx.lineStyle(0);
        gfx.beginFill(0xd4b066); gfx.drawCircle(dX + dW / 2 + 2, dY + dH / 2, 0.8); gfx.endFill();
        // Tall french windows on upper floors
        const winRows = [h - 46, h - 66];
        for (const wy of winRows) {
            if (wy < 4) continue;
            for (const wx of [W * 0.2 - 7, W * 0.8 - 7]) {
                gfx.beginFill(0xcfc2a3); gfx.drawRect(wx - 1, wy - 1, 16, 14); gfx.endFill();  // stone frame
                gfx.beginFill(0x1a1a28); gfx.drawRect(wx, wy, 14, 12); gfx.endFill();
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx + 1, wy + 1, 12, 10); gfx.endFill();
                gfx.lineStyle(0.4, 0xcfc2a3, 0.8);
                gfx.moveTo(wx + 7, wy + 1); gfx.lineTo(wx + 7, wy + 11);
                gfx.moveTo(wx + 1, wy + 6); gfx.lineTo(wx + 13, wy + 6);
                gfx.lineStyle(0);
            }
        }
        // Iron balcony on first upper floor (wrought iron railing)
        const balY = h - 46 + 13;
        gfx.lineStyle(0.6, 0x1a1a1a, 0.95);
        gfx.drawRect(8, balY, W - 16, 4);
        for (let bx = 10; bx < W - 10; bx += 3) {
            gfx.moveTo(bx, balY); gfx.lineTo(bx, balY + 4);
        }
        gfx.lineStyle(0);
    },

    /* ─── Victorian (UK) — red brick, bay windows, chimney stacks, dark slate roof ─── */
    _drawVictorian(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Red brick body
        gfx.beginFill(0x8b3a2e); gfx.drawRect(0, 0, W, h); gfx.endFill();
        gfx.beginFill(0xa04432); gfx.drawRect(2, 2, W - 4, h - 6); gfx.endFill();
        // Brick pattern
        gfx.lineStyle(0.3, 0x6a2820, 0.6);
        for (let y = 6; y < h - 4; y += 4) {
            gfx.moveTo(2, y); gfx.lineTo(W - 2, y);
            for (let x = (y % 8 === 0 ? 4 : 10); x < W - 2; x += 12) {
                gfx.moveTo(x, y); gfx.lineTo(x, y + 4);
            }
        }
        gfx.lineStyle(0);
        // Stone string course
        gfx.beginFill(0xddd0b8); gfx.drawRect(0, 26, W, 2); gfx.endFill();
        gfx.beginFill(0xddd0b8); gfx.drawRect(0, 46, W, 2); gfx.endFill();
        // Stone foundation
        gfx.beginFill(0x6a6358); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Dark slate pitched roof
        gfx.beginFill(0x2a2a32);
        gfx.drawPolygon([-4, 0, W / 2, -18, W + 4, 0, W, 4, 0, 4]);
        gfx.endFill();
        // Two red-brick chimney stacks
        for (const cx of [W * 0.2, W * 0.8]) {
            gfx.beginFill(0x7a2a20); gfx.drawRect(cx - 4, -16, 8, 18); gfx.endFill();
            gfx.beginFill(0x5a1e18); gfx.drawRect(cx - 4, -18, 8, 2); gfx.endFill();
            // Chimney pots
            gfx.beginFill(0x3a1a14); gfx.drawRect(cx - 3, -22, 2, 4); gfx.endFill();
            gfx.beginFill(0x3a1a14); gfx.drawRect(cx + 1, -22, 2, 4); gfx.endFill();
        }
        // Bay window (ground floor, projecting)
        const bayW = 40, bayX = W / 2 - bayW / 2, bayY = h - 34;
        gfx.beginFill(0x8b3a2e); gfx.drawRect(bayX - 2, bayY, bayW + 4, 22); gfx.endFill();
        gfx.beginFill(0xddd0b8); gfx.drawRect(bayX - 2, bayY, bayW + 4, 2); gfx.endFill();  // top trim
        // Three bay window panes
        for (let i = 0; i < 3; i++) {
            const bx = bayX + 2 + i * ((bayW - 4) / 3);
            const bw = (bayW - 4) / 3 - 2;
            gfx.beginFill(0x1a1a28); gfx.drawRect(bx, bayY + 4, bw, 14); gfx.endFill();
            gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(bx + 0.5, bayY + 4.5, bw - 1, 13); gfx.endFill();
            gfx.lineStyle(0.3, 0xddd0b8, 0.7);
            gfx.moveTo(bx + bw / 2, bayY + 4); gfx.lineTo(bx + bw / 2, bayY + 18);
            gfx.lineStyle(0);
        }
        // Small peak roof over bay
        gfx.beginFill(0x2a2a32);
        gfx.drawPolygon([bayX - 4, bayY, bayX + bayW / 2, bayY - 6, bayX + bayW + 4, bayY]);
        gfx.endFill();
        // Glossy black door (side of bay)
        const dW = 10, dH = 18, dX = 12, dY = h - dH - 6;
        gfx.beginFill(0xddd0b8); gfx.drawRect(dX - 2, dY - 3, dW + 4, dH + 4); gfx.endFill();
        gfx.beginFill(0x0a0a10); gfx.drawRect(dX, dY, dW, dH); gfx.endFill();
        gfx.beginFill(0x1a1a20); gfx.drawRect(dX + 1, dY + 1, dW - 2, dH - 2); gfx.endFill();
        // Brass knocker
        gfx.beginFill(0xd4a83b); gfx.drawCircle(dX + dW / 2, dY + 6, 1.2); gfx.endFill();
        // Upper floor windows (sash)
        for (const wy of [h - 66]) {
            if (wy < 4) continue;
            for (const wx of [W * 0.2 - 7, W * 0.5 - 7, W * 0.8 - 7]) {
                gfx.beginFill(0xddd0b8); gfx.drawRect(wx - 1, wy - 1, 16, 14); gfx.endFill();
                gfx.beginFill(0x1a1a28); gfx.drawRect(wx, wy, 14, 12); gfx.endFill();
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx + 1, wy + 1, 12, 10); gfx.endFill();
                gfx.lineStyle(0.4, 0xddd0b8, 0.8);
                gfx.moveTo(wx + 1, wy + 6); gfx.lineTo(wx + 13, wy + 6);
                gfx.lineStyle(0);
            }
        }
    },

    /* ─── Haveli (IN) — sandstone, jharokha balcony, domed cupolas ─── */
    _drawHaveli(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Sandstone body (warm pink)
        gfx.beginFill(0xc97a4a); gfx.drawRect(0, 0, W, h); gfx.endFill();
        gfx.beginFill(0xd88a5a); gfx.drawRect(2, 2, W - 4, h - 6); gfx.endFill();
        // Stone foundation
        gfx.beginFill(0x8a5030); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Decorative horizontal bands (carved motif lines)
        gfx.beginFill(0xa05c2f);
        gfx.drawRect(0, 26, W, 1.5);
        gfx.drawRect(0, 46, W, 1.5);
        gfx.drawRect(0, 10, W, 1);
        gfx.endFill();
        // Flat roof with crenelated parapet
        gfx.beginFill(0xc97a4a);
        gfx.drawRect(-2, 0, W + 4, 4);
        gfx.endFill();
        gfx.beginFill(0xa05c2f);
        for (let cx = 0; cx < W; cx += 8) {
            gfx.drawRect(cx, -4, 4, 4);
        }
        gfx.endFill();
        // Two corner domed cupolas (chhatris)
        for (const ux of [6, W - 10]) {
            // Pillars
            gfx.beginFill(0xd88a5a);
            gfx.drawRect(ux, -14, 2, 10);
            gfx.drawRect(ux + 4, -14, 2, 10);
            gfx.endFill();
            // Dome
            gfx.beginFill(0xfff2c4); gfx.drawCircle(ux + 3, -15, 4); gfx.endFill();
            gfx.beginFill(0xd4a83b); gfx.drawRect(ux + 2, -18, 2, 3); gfx.endFill();  // finial
            gfx.beginFill(0xd4a83b); gfx.drawCircle(ux + 3, -19, 0.8); gfx.endFill();
        }
        // Jharokha — carved projecting balcony on middle floor
        const jW = 40, jX = W / 2 - jW / 2, jY = h - 50;
        gfx.beginFill(0xa05c2f); gfx.drawRect(jX - 4, jY, jW + 8, 20); gfx.endFill();
        gfx.beginFill(0xd88a5a); gfx.drawRect(jX - 2, jY + 2, jW + 4, 16); gfx.endFill();
        // Jaali (lattice) pattern
        gfx.beginFill(0x1a1a28); gfx.drawRect(jX, jY + 4, jW, 12); gfx.endFill();
        gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(jX + 1, jY + 5, jW - 2, 10); gfx.endFill();
        gfx.lineStyle(0.3, 0xa05c2f, 0.8);
        for (let lx = jX + 4; lx < jX + jW; lx += 4) {
            gfx.moveTo(lx, jY + 4); gfx.lineTo(lx, jY + 16);
        }
        gfx.moveTo(jX, jY + 10); gfx.lineTo(jX + jW, jY + 10);
        gfx.lineStyle(0);
        // Small arched corbels under jharokha
        gfx.beginFill(0x8a5030);
        for (let cx = jX; cx < jX + jW + 4; cx += 8) {
            gfx.drawRect(cx, jY + 20, 4, 3);
        }
        gfx.endFill();
        // Arched saffron-trim door
        const dW = 12, dH = 20, dX = W / 2 - dW / 2, dY = h - dH - 6;
        gfx.beginFill(0xff9933); gfx.drawRect(dX - 2, dY - 3, dW + 4, dH + 4); gfx.endFill();  // saffron frame
        gfx.beginFill(0xd4a83b); gfx.drawRect(dX - 1, dY - 2, dW + 2, dH + 2); gfx.endFill();  // gold inner
        gfx.beginFill(0x4a2a10); gfx.drawRect(dX, dY + 3, dW, dH - 3); gfx.endFill();
        gfx.beginFill(0x4a2a10); gfx.drawCircle(dX + dW / 2, dY + 3, dW / 2); gfx.endFill();  // arched top
        gfx.beginFill(0x3a1a08); gfx.drawRect(dX + 1, dY + 4, dW - 2, dH - 5); gfx.endFill();
        gfx.beginFill(0xd4a83b); gfx.drawCircle(dX + dW / 2 + 2, dY + dH / 2, 0.9); gfx.endFill();
        // Small arched side windows (ground floor)
        for (const wx of [W * 0.15, W * 0.85]) {
            const ww = 10, wh = 14;
            gfx.beginFill(0xd4a83b); gfx.drawRect(wx - ww / 2 - 1, dY - 1, ww + 2, wh + 2); gfx.endFill();
            gfx.beginFill(0x1a1a28); gfx.drawRect(wx - ww / 2, dY + 2, ww, wh - 2); gfx.endFill();
            gfx.beginFill(0x1a1a28); gfx.drawCircle(wx, dY + 2, ww / 2); gfx.endFill();
            gfx.beginFill(0xffe9a8, 0.55); gfx.drawCircle(wx, dY + 2, ww / 2 - 1); gfx.endFill();
            gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx - ww / 2 + 1, dY + 2, ww - 2, wh - 4); gfx.endFill();
        }
    },

    /* ─── Modern Arabian (UAE) — cream stucco, crescent arches, flat parapet roof ─── */
    _drawArabian(b, container, gfx, h, flagCols, accent) {
        const W = b.w;
        // Cream stucco body
        gfx.beginFill(0xede3c8); gfx.drawRect(0, 0, W, h); gfx.endFill();
        gfx.beginFill(0xf5ecd1); gfx.drawRect(2, 2, W - 4, h - 6); gfx.endFill();
        // Foundation (sand tone)
        gfx.beginFill(0xc9b98a); gfx.drawRect(0, h - 6, W, 6); gfx.endFill();
        // Flat roof with crenelated parapet
        gfx.beginFill(0xede3c8); gfx.drawRect(-2, 0, W + 4, 4); gfx.endFill();
        gfx.beginFill(0xc9b98a);
        for (let cx = 0; cx < W; cx += 10) {
            gfx.drawRect(cx, -3, 5, 3);
        }
        gfx.endFill();
        // Central dome (small, with crescent finial)
        gfx.beginFill(0xede3c8); gfx.drawCircle(W / 2, -8, 8); gfx.endFill();
        gfx.beginFill(0xc9b98a); gfx.drawCircle(W / 2, -6, 8); gfx.endFill();
        gfx.beginFill(0xede3c8); gfx.drawCircle(W / 2, -8, 7); gfx.endFill();
        // Gold crescent + star finial
        gfx.beginFill(0xd4a83b); gfx.drawRect(W / 2 - 0.5, -18, 1, 5); gfx.endFill();
        gfx.beginFill(0xd4a83b); gfx.drawCircle(W / 2, -19, 1.4); gfx.endFill();
        gfx.beginFill(0xede3c8); gfx.drawCircle(W / 2 + 0.6, -18.8, 1.2); gfx.endFill();  // crescent cutout
        // Gold horizontal trim lines
        gfx.beginFill(0xd4a83b);
        gfx.drawRect(0, 26, W, 1);
        gfx.drawRect(0, 46, W, 1);
        gfx.endFill();
        // Grand arched entry door
        const dW = 14, dH = 24, dX = W / 2 - dW / 2, dY = h - dH - 6;
        gfx.beginFill(0xd4a83b); gfx.drawRect(dX - 3, dY - 3, dW + 6, dH + 3); gfx.endFill();
        gfx.beginFill(0xd4a83b); gfx.drawCircle(dX + dW / 2, dY - 3, (dW + 6) / 2); gfx.endFill();
        gfx.beginFill(0x3a2a18); gfx.drawRect(dX, dY + 2, dW, dH - 2); gfx.endFill();
        gfx.beginFill(0x3a2a18); gfx.drawCircle(dX + dW / 2, dY + 2, dW / 2); gfx.endFill();
        gfx.beginFill(0x2a1a10); gfx.drawRect(dX + 1, dY + 3, dW - 2, dH - 4); gfx.endFill();
        gfx.beginFill(0xd4a83b); gfx.drawCircle(dX + dW / 2, dY + dH - 3, 0.9); gfx.endFill();
        // Mashrabiya (lattice) arched windows on upper floors
        for (const wy of [h - 48, h - 68]) {
            if (wy < 4) continue;
            for (const wx of [W * 0.2 - 6, W * 0.8 - 6]) {
                const ww = 12, wh = 12;
                // Gold frame with arched top
                gfx.beginFill(0xd4a83b); gfx.drawRect(wx - 1, wy, ww + 2, wh + 1); gfx.endFill();
                gfx.beginFill(0xd4a83b); gfx.drawCircle(wx + ww / 2, wy, (ww + 2) / 2); gfx.endFill();
                // Dark window interior
                gfx.beginFill(0x1a1a28); gfx.drawRect(wx, wy + 1, ww, wh - 1); gfx.endFill();
                gfx.beginFill(0x1a1a28); gfx.drawCircle(wx + ww / 2, wy + 1, ww / 2); gfx.endFill();
                // Warm glow
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx + 1, wy + 2, ww - 2, wh - 3); gfx.endFill();
                gfx.beginFill(0xffe9a8, 0.55); gfx.drawCircle(wx + ww / 2, wy + 1, ww / 2 - 1); gfx.endFill();
                // Mashrabiya lattice (fine cross pattern)
                gfx.lineStyle(0.3, 0xd4a83b, 0.7);
                gfx.moveTo(wx + ww / 2, wy); gfx.lineTo(wx + ww / 2, wy + wh);
                gfx.moveTo(wx, wy + wh / 2); gfx.lineTo(wx + ww, wy + wh / 2);
                gfx.moveTo(wx + 3, wy + 2); gfx.lineTo(wx + ww - 3, wy + wh - 1);
                gfx.moveTo(wx + ww - 3, wy + 2); gfx.lineTo(wx + 3, wy + wh - 1);
                gfx.lineStyle(0);
            }
        }
        // Small palm tree silhouette in the yard (tight, stylised)
        const palmX = W + 6, palmY = h - 6;
        gfx.beginFill(0x5a3e1f); gfx.drawRect(palmX - 1, palmY - 14, 2, 14); gfx.endFill();
        gfx.beginFill(0x1f6b2a);
        gfx.drawPolygon([palmX, palmY - 14, palmX - 6, palmY - 18, palmX - 2, palmY - 16]);
        gfx.drawPolygon([palmX, palmY - 14, palmX + 6, palmY - 18, palmX + 2, palmY - 16]);
        gfx.drawPolygon([palmX, palmY - 14, palmX, palmY - 22, palmX + 2, palmY - 18]);
        gfx.drawPolygon([palmX, palmY - 14, palmX - 4, palmY - 20, palmX - 1, palmY - 17]);
        gfx.endFill();
    },

    /* ─── Shared: flagpole on roof ridge with the country's flag ─── */
    _addFlagpole(b, container, flagCols) {
        const flagCont = new PIXI.Container();
        flagCont.x = b.w * 0.5;
        flagCont.y = -22;
        // Pole
        const pole = new PIXI.Graphics();
        pole.beginFill(0x7a7a7a); pole.drawRect(-1, -20, 2, 22); pole.endFill();
        pole.beginFill(0xfbbf24); pole.drawCircle(0, -20, 1.4); pole.endFill();
        flagCont.addChild(pole);
        // Flag rectangle — country-accurate (Union Jack, Stars & Stripes, etc.)
        const flag = new PIXI.Graphics();
        const fw = 16, fh = 10;
        if (typeof EmbassyRow !== 'undefined' && EmbassyRow.drawCountryFlag) {
            EmbassyRow.drawCountryFlag(flag, b.country, fw, fh);
        } else {
            const sh = fh / Math.max(1, flagCols.length);
            flagCols.forEach((c, i) => { flag.beginFill(c); flag.drawRect(0, i * sh, fw, sh); flag.endFill(); });
        }
        flag.x = 1;
        flag.y = -19;
        flag.pivot.set(0, fh * 0.5);
        flagCont.addChild(flag);
        container.addChild(flagCont);
        b._flagGfx = flag;
    },

    /* ─── Shared: small garden path at the base (decorative) ─── */
    _addGarden(b, gfx, h, accent) {
        // Small grass strip left and right of the walkway
        gfx.beginFill(0x2a5a2a, 0.7);
        gfx.drawRect(-2, h + 2, b.w / 2 - 10, 2);
        gfx.drawRect(b.w / 2 + 10, h + 2, b.w / 2 - 8, 2);
        gfx.endFill();
        // Walkway
        gfx.beginFill(0xb8b09a);
        gfx.drawRect(b.w / 2 - 8, h + 2, 16, 2);
        gfx.endFill();
    },

    update() {
        // Flag wave (same gentle skew as EmbassyRow so both zones sync)
        const t = (typeof G !== 'undefined' ? G.tick : 0) * 0.05;
        this.BLDS.forEach((def, i) => {
            const bld = (typeof G !== 'undefined' && G.bldById) ? G.bldById[def.id] : null;
            if (!bld || !bld._flagGfx) return;
            bld._flagGfx.skew.x = Math.sin(t + i * 0.7 + 1.2) * 0.18;
        });
    }
};

if (typeof window !== 'undefined') window.EmbassyQuarter = EmbassyQuarter;
