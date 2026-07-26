/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   HUMAN AVATAR (v1.0.0 — Unified Human Pixel Art Aesthetic)
   ════════════════════════════════════════════════════════════════════════════════════════════════════
   Singularity City has two visual classes of citizen:
     • AI/Bot citizens — the AI models (Claude, Gemini, GPT…), worker bots (BaristaBot, NannyBot,
       Grim Reaper) and other synthetic life. These keep their existing per-personality look.
     • Human citizens   — CEOs, founders, VC bankers, embassy diplomats, alignment researchers,
       police, judges, professors, etc. These should all share a single coherent pixel-art look.

   This helper renders the HUMAN pixel art style. It mirrors the cosy researcher aesthetic from
   the Alignment Forest cabins (round head, hair cap, optional round glasses, sweater body,
   dark trousers) and lets callers vary skin tone, hair, shirt and accessories deterministically
   from a string seed (e.g. the NPC id) so the same person looks the same across visits.

   USAGE
     const av = HumanAvatar.draw(parent, {
         x: 100, y: groundY, name: 'Sam Altman', shirt: 0x1e3a8a,
         glasses: true, suit: true, hairColor: 0x3a2410, seed: 'npc_sam'
     });
     // av = { cont, head, body, legL, legR, dot, tag, shadow }
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const HumanAvatar = {
    SKIN_TONES: [0xfdd7b0, 0xe8b68a, 0xd19867, 0x8b5a3c, 0x5a3823],
    HAIR_COLS:  [0x2a1a0e, 0x1a1008, 0x4a2e18, 0x8b5a2b, 0xc4a777, 0xd4d4d4, 0x5a3a20],
    SHIRT_COLS: [0x374151, 0x1e3a8a, 0x064e3b, 0x7c2d12, 0x581c87, 0x525252, 0x0e7490],
    SUIT_COLS:  [0x1a1a28, 0x14213d, 0x252525, 0x2a1f1f, 0x101020],

    // Heuristic: NPC names containing "Bot" (case-insensitive) or matching the
    // known synthetic-citizen ids should NOT use the human style.
    isBot(name, id) {
        if (!name && !id) return false;
        if (id === 'npc_reaper') return true; // grim reaper is a synthetic anomaly
        const n = (name || '') + ' ' + (id || '');
        return /bot/i.test(n);
    },

    // Cheap seeded random — same seed → same outfit every time.
    _seedRng(seed) {
        let h = 2166136261;
        const s = String(seed || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return () => {
            h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
            return ((h >>> 0) % 10000) / 10000;
        };
    },

    pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; },

    /**
     * Draw a human avatar onto `parent`. Returns the parts so the caller can
     * animate them (legs/body bobbing, head flipping, etc).
     *
     * Options:
     *   x, y           position on the parent
     *   name           displayed under the dot (optional — pass null/'' to suppress)
     *   role           shown in tooltip / accessibility (string, optional)
     *   shirt          0xRRGGBB shirt/sweater colour. If undefined, picked from seed.
     *   accent         0xRRGGBB (dot above head + tag colour). Defaults to shirt.
     *   suit           true → render a suit jacket with lapel + tie (CEO/diplomat/banker)
     *   tieColor       only used if suit=true. Defaults to accent.
     *   hairColor      0xRRGGBB. If undefined, picked from seed.
     *   skinColor      0xRRGGBB. If undefined, picked from seed.
     *   glasses        true → round researcher-style glasses
     *   beard          true → small dark stubble strip
     *   hat            'cap'|'beret'|'crown'|null
     *   facing         1 (right) or -1 (left). Default 1.
     *   seed           string used to derive deterministic random outfit pieces.
     *   showTag        false → suppress the floating name above the head
     *   showDot        false → suppress the accent dot above the head
     */
    draw(parent, opts) {
        opts = opts || {};
        const rng = this._seedRng(opts.seed || opts.name || 'human');
        const skinCol  = (opts.skinColor != null) ? opts.skinColor : this.pick(this.SKIN_TONES, rng);
        const hairCol  = (opts.hairColor != null) ? opts.hairColor : this.pick(this.HAIR_COLS,  rng);
        const shirtCol = (opts.shirt != null)     ? opts.shirt     : this.pick(this.SHIRT_COLS, rng);
        const accent   = (opts.accent != null)    ? opts.accent    : shirtCol;
        const isSuit   = !!opts.suit;
        const tieCol   = (opts.tieColor != null) ? opts.tieColor : accent;
        const trouserCol = isSuit ? 0x0a0a14 : 0x1a1a1a;
        const shoeCol = 0x000000;

        // Standard pixel-doll dimensions — keep same proportions as embassy/housing
        // so humans can stand alongside bots without scale mismatches.
        const bw = 16, h = 32;
        const headH = Math.round(h * 0.38); // ≈12
        const bodyH = h - headH - 4;        // ≈16
        const legH = 4;

        const cont = new PIXI.Container();
        cont.x = opts.x || 0;
        cont.y = opts.y || 0;
        if (opts.facing === -1) cont.scale.x = -1;

        // ─── Shadow ───
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();

        // ─── Legs (drawn first so the body sits in front) ───
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics();
        legL.beginFill(trouserCol); legL.drawRect(-lw / 2, 0, lw, legH); legL.endFill();
        legL.beginFill(shoeCol);    legL.drawRect(-lw / 2, legH - 1, lw, 1); legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(trouserCol); legR.drawRect(-lw / 2, 0, lw, legH); legR.endFill();
        legR.beginFill(shoeCol);    legR.drawRect(-lw / 2, legH - 1, lw, 1); legR.endFill();
        legR.x = bw * 0.15;

        // ─── Body — drawn in LOCAL coords (y=0..bodyH), positioned via body.y ───
        const body = new PIXI.Graphics();
        if (isSuit) {
            // Suit jacket
            body.beginFill(shirtCol); body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1); body.endFill();
            // White shirt V
            body.beginFill(0xfffbe8); body.drawPolygon([-bw * 0.15, 0, bw * 0.15, 0, 0, bodyH * 0.5]); body.endFill();
            // Tie (accent colour)
            body.beginFill(tieCol); body.drawPolygon([-bw * 0.06, 0, bw * 0.06, 0, bw * 0.035, bodyH * 0.7, -bw * 0.035, bodyH * 0.7]); body.endFill();
            // Lapels
            body.beginFill(0x0a0a14); body.drawPolygon([-bw * 0.4, 0, -bw * 0.15, 0, -bw * 0.25, bodyH * 0.45]); body.endFill();
            body.beginFill(0x0a0a14); body.drawPolygon([bw * 0.4, 0, bw * 0.15, 0, bw * 0.25, bodyH * 0.45]); body.endFill();
            // Pocket pin (subtle accent)
            body.beginFill(accent, 0.95); body.drawCircle(-bw * 0.28, bodyH * 0.18, 0.9); body.endFill();
        } else {
            // Casual sweater — top highlight strip for a knit feel
            body.beginFill(shirtCol); body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1); body.endFill();
            body.beginFill(shirtCol, 0.7); body.drawRect(-bw / 2, 0, bw, 2); body.endFill();
            // Optional accent stripe across the chest
            if (rng() < 0.35) {
                body.beginFill(0xffffff, 0.18);
                body.drawRect(-bw / 2, bodyH * 0.5, bw, 1);
                body.endFill();
            }
        }
        body.y = -h + headH;

        // ─── Head — drawn in LOCAL coords (origin = top-left of head box) ──────
        // Local y range: 0 (top of skull) → headH (bottom of jaw). Position is set
        // via head.y = -h so the head sits above the body. Animations like
        // `head.y = -h + Math.sin(t)*1.5` continue to work as before.
        const head = new PIXI.Graphics();
        const skullCY = headH * 0.5;
        const skullR  = headH * 0.5;
        // Round skull (researcher look)
        head.beginFill(skinCol);
        head.drawCircle(0, skullCY, skullR);
        head.endFill();
        // Hair cap on top
        head.beginFill(hairCol, 0.95);
        head.drawRect(-headH * 0.42, 0, headH * 0.84, headH * 0.32);
        head.endFill();
        // Optional side hair (random based on seed)
        if (rng() < 0.55) {
            head.beginFill(hairCol, 0.85);
            head.drawRect(-headH * 0.5, 1, 1, headH * 0.5);
            head.drawRect(headH * 0.5 - 1, 1, 1, headH * 0.5);
            head.endFill();
        }
        // Eyes — two tiny dark dots
        const eyeY = headH * 0.55;
        head.beginFill(0x1a1a1a);
        head.drawCircle(-headH * 0.18, eyeY, 0.9);
        head.drawCircle( headH * 0.18, eyeY, 0.9);
        head.endFill();
        // Optional round glasses
        if (opts.glasses) {
            head.lineStyle(0.8, 0x1a1a1a, 0.9);
            head.drawCircle(-headH * 0.18, eyeY, 1.6);
            head.drawCircle( headH * 0.18, eyeY, 1.6);
            head.moveTo(-headH * 0.05, eyeY); head.lineTo(headH * 0.05, eyeY); // bridge
            head.lineStyle(0);
        }
        // Mouth
        head.beginFill(0x000000, 0.4);
        head.drawRect(-headH * 0.08, headH * 0.78, headH * 0.16, 0.9);
        head.endFill();
        // Optional beard stubble
        if (opts.beard) {
            head.beginFill(0x1a1008, 0.45);
            head.drawRect(-headH * 0.3, headH * 0.7, headH * 0.6, 1.6);
            head.endFill();
        }
        // Optional headwear
        if (opts.hat === 'cap') {
            head.beginFill(0x111827); head.drawRect(-headH * 0.5, -1, headH, 2); head.endFill();
            head.beginFill(0x111827); head.drawRect(-headH * 0.7, -1, headH * 0.4, 1); head.endFill(); // brim
        } else if (opts.hat === 'beret') {
            head.beginFill(0x7c2d12); head.drawCircle(0, -1, headH * 0.55); head.endFill();
        } else if (opts.hat === 'crown') {
            head.beginFill(0xfbbf24); head.drawRect(-headH * 0.45, -2, headH * 0.9, 2); head.endFill();
            head.beginFill(0xfbbf24); head.drawRect(-headH * 0.45, -4, 1.5, 2); head.drawRect(0, -4, 1.5, 2); head.drawRect(headH * 0.45 - 1.5, -4, 1.5, 2); head.endFill();
        }
        head.y = -h;

        // ─── Accent dot above head (matches city-NPC convention) ───
        let dot = null;
        if (opts.showDot !== false) {
            dot = new PIXI.Graphics();
            dot.beginFill(accent); dot.drawCircle(0, 0, 2); dot.endFill();
            dot.y = -h - 8;
        }

        // ─── Floating name tag ───
        let tag = null;
        if (opts.showTag !== false && opts.name) {
            tag = new PIXI.Text(opts.name, {
                fontFamily: 'JetBrains Mono', fontSize: 7, fill: accent, fontWeight: 'bold'
            });
            tag.anchor.set(0.5, 1);
            tag.y = -h - 12;
            // Keep the tag readable even if the body is mirrored
            if (opts.facing === -1) tag.scale.x = -1;
        }

        cont.addChild(shadow, legL, legR, body, head);
        if (dot) cont.addChild(dot);
        if (tag) cont.addChild(tag);

        if (parent) parent.addChild(cont);

        return { cont, head, body, legL, legR, dot, tag, shadow };
    },

    // ─── Per-founder pixel-art fingerprints ─────────────────────────────────
    // Hand-tuned look for each well-known founder so Sam Altman, Elon Musk, etc.
    // are individually recognizable inside their HQs and cars. Anyone not in this
    // table falls back to a seeded random outfit (still HumanAvatar style, just
    // not specifically themed).
    //
    // Fields:
    //   skin, hair       0xRRGGBB → passed through to draw() as skinColor/hairColor
    //   glasses, beard   bool      → passed through unchanged
    //   suit             bool      → render suit jacket vs. casual sweater
    //   shirt            0xRRGGBB → jacket / sweater colour
    FOUNDER_LOOKS: {
        'Sam Altman':       { skin: 0xfdd7b0, hair: 0x4a2e18, glasses: false, beard: false, suit: false, shirt: 0x6b7280 },
        'Dario Amodei':     { skin: 0xfdd7b0, hair: 0x2a1a0e, glasses: false, beard: true,  suit: false, shirt: 0x374151 },
        'Demis Hassabis':   { skin: 0xfdd7b0, hair: 0x2a1a0e, glasses: false, beard: false, suit: true,  shirt: 0x14213d },
        'Mark Zuckerberg':  { skin: 0xfdd7b0, hair: 0x4a2e18, glasses: false, beard: false, suit: false, shirt: 0x9ca3af }, // signature gray tee
        'Elon Musk':        { skin: 0xfdd7b0, hair: 0x8b5a2b, glasses: false, beard: false, suit: false, shirt: 0x111827 }, // dark tee
        'Liang Wenfeng':    { skin: 0xe8b68a, hair: 0x1a1008, glasses: true,  beard: false, suit: false, shirt: 0x374151 },
        'Eddie Wu':         { skin: 0xe8b68a, hair: 0x1a1008, glasses: true,  beard: false, suit: true,  shirt: 0x14213d },
        'Arthur Mensch':    { skin: 0xfdd7b0, hair: 0x2a1a0e, glasses: false, beard: true,  suit: false, shirt: 0x064e3b },
        'Najwa Aaraj':      { skin: 0xd19867, hair: 0x1a1008, glasses: false, beard: false, suit: true,  shirt: 0x14213d },
        'Satya Nadella':    { skin: 0xd19867, hair: 0x1a1008, glasses: true,  beard: false, suit: true,  shirt: 0x1a1a28 },
        'Jensen Huang':     { skin: 0xe8b68a, hair: 0xd4d4d4, glasses: true,  beard: false, suit: false, shirt: 0x0a0a0a }, // signature leather jacket
        'Robin Li':         { skin: 0xe8b68a, hair: 0x1a1008, glasses: false, beard: false, suit: true,  shirt: 0x14213d },
        'Emad Mostaque':    { skin: 0xd19867, hair: 0x1a1008, glasses: false, beard: true,  suit: false, shirt: 0x581c87 },
        'Aidan Gomez':      { skin: 0xfdd7b0, hair: 0x2a1a0e, glasses: false, beard: false, suit: false, shirt: 0x0e7490 },
        'Tim Cook':         { skin: 0xfdd7b0, hair: 0xd4d4d4, glasses: false, beard: false, suit: false, shirt: 0x525252 }, // silver hair
        'Arvind Krishna':   { skin: 0xd19867, hair: 0x1a1008, glasses: true,  beard: false, suit: true,  shirt: 0x14213d },
        'Ori Goshen':       { skin: 0xe8b68a, hair: 0x2a1a0e, glasses: false, beard: true,  suit: false, shirt: 0x374151 },
        'Julien Chaumond':  { skin: 0xfdd7b0, hair: 0x4a2e18, glasses: false, beard: false, suit: false, shirt: 0xfbbf24 }, // HF yellow
        'Andy Jassy':       { skin: 0xfdd7b0, hair: 0x4a2e18, glasses: false, beard: false, suit: true,  shirt: 0x374151 },
        'Tang Jie':         { skin: 0xe8b68a, hair: 0x1a1008, glasses: true,  beard: false, suit: true,  shirt: 0x14213d },
    },

    lookupFounder(name) {
        if (!name) return null;
        return this.FOUNDER_LOOKS[name] || null;
    },

    // Convenience: draw a founder by their REAL_FOUNDERS object. Falls back to
    // seeded random + accent=lab color when the founder isn't in FOUNDER_LOOKS,
    // so newly-discovered founders still render as humans (just generic ones).
    drawFounder(parent, founder, opts) {
        opts = opts || {};
        const look = this.lookupFounder(founder && founder.name);
        const labColHex = (founder && founder.color)
            ? parseInt(String(founder.color).replace('#', ''), 16)
            : 0x64748b;

        const merged = Object.assign({}, opts);
        merged.seed   = opts.seed   || ('founder_' + (founder && founder.name));
        merged.accent = (opts.accent != null) ? opts.accent : labColHex;
        merged.name   = (opts.name !== undefined) ? opts.name : (founder && founder.name);

        if (look) {
            if (merged.skinColor == null) merged.skinColor = look.skin;
            if (merged.hairColor == null) merged.hairColor = look.hair;
            if (merged.glasses   == null) merged.glasses   = look.glasses;
            if (merged.beard     == null) merged.beard     = look.beard;
            if (merged.suit      == null) merged.suit      = look.suit;
            if (merged.shirt     == null) merged.shirt     = look.shirt;
            if (merged.tieColor  == null) merged.tieColor  = labColHex;
        } else {
            // Unknown founder — default to suit so they still read as a CEO
            if (merged.suit == null) merged.suit = true;
            if (merged.tieColor == null) merged.tieColor = labColHex;
        }
        return this.draw(parent, merged);
    }
};

if (typeof window !== 'undefined') window.HumanAvatar = HumanAvatar;
