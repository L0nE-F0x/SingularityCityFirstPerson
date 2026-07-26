/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE ROCKETS (v1.0.0 — Per-Org Flagship Vehicle Silhouettes)
   One shared pixel-art library so the exterior pad, the launch animation entity and the
   interior observation window all show the SAME real-world vehicle for each organization.
   Every vehicle is drawn base-at-(0,0), pointing up, engines at y≈0, nose at y≈-height.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceRockets = {

    // Flagship vehicle name per org key (used in tooltips / panels / signs)
    VEHICLES: {
        spacex:           'Starship V3',
        blue_origin:      'New Glenn',
        nasa:             'SLS Block 1',
        cnsa:             'Long March 10',
        esa:              'Ariane 64',
        ula:              'Vulcan Centaur',
        rocketlab:        'Electron',
        isro:             'LVM3',
        jaxa:             'H3-24L',
        roscosmos:        'Soyuz-2.1a',
        northrop_grumman: 'Antares 330',
        firefly:          'Firefly Alpha',
        landspace:        'Zhuque-3'
    },

    vehicleName(orgKey) { return this.VEHICLES[orgKey] || 'Rocket'; },

    // Approx drawn height (px at scale 1) — callers use it to place countdown text etc.
    HEIGHTS: {
        spacex: 70, blue_origin: 62, nasa: 70, cnsa: 62, esa: 56, ula: 58,
        rocketlab: 48, isro: 58, jaxa: 58, roscosmos: 56, northrop_grumman: 54,
        firefly: 48, landspace: 60
    },

    height(orgKey) { return this.HEIGHTS[orgKey] || 58; },

    // Draw the org's flagship vehicle into Graphics `g`, base centered at (0,0), scale `s`.
    draw(g, orgKey, s = 1) {
        const fn = this['_' + orgKey];
        if (fn) { fn.call(this, g, s); return; }
        // Fallback generic rocket
        g.beginFill(0xf1f5f9); g.drawRect(-4 * s, -45 * s, 8 * s, 45 * s); g.endFill();
        g.beginFill(0x94a3b8); g.drawPolygon([-4 * s, -45 * s, 0, -58 * s, 4 * s, -45 * s]); g.endFill();
    },

    // ─── SpaceX • xAI — Starship V3 full stack (stainless steel, black tiles, flaps) ───
    _spacex(g, s) {
        // Super Heavy booster
        g.beginFill(0xb4bcc4); g.drawRect(-6 * s, -42 * s, 12 * s, 42 * s); g.endFill();
        g.beginFill(0x9aa3ac); g.drawRect(-6 * s, -42 * s, 2.5 * s, 42 * s); g.endFill(); // shade
        g.beginFill(0xd9dee3); g.drawRect(3 * s, -42 * s, 2 * s, 42 * s); g.endFill();    // highlight
        // Grid fins
        g.beginFill(0x6b7280);
        g.drawRect(-9 * s, -40 * s, 3 * s, 6 * s);
        g.drawRect(6 * s, -40 * s, 3 * s, 6 * s);
        g.endFill();
        // Ship (upper stage) — slightly lighter steel
        g.beginFill(0xcdd4da); g.drawRect(-6 * s, -64 * s, 12 * s, 22 * s); g.endFill();
        g.beginFill(0xe3e8ec); g.drawRect(3 * s, -64 * s, 2 * s, 22 * s); g.endFill();
        // Nose cone
        g.beginFill(0xcdd4da); g.drawPolygon([-6 * s, -64 * s, -2 * s, -70 * s, 2 * s, -70 * s, 6 * s, -64 * s]); g.endFill();
        // Black heat-shield tile stripe (windward side)
        g.beginFill(0x1f2937);
        g.drawRect(-6 * s, -64 * s, 2.5 * s, 22 * s);
        g.drawPolygon([-6 * s, -64 * s, -2 * s, -70 * s, -1 * s, -70 * s, -4 * s, -64 * s]);
        g.endFill();
        // Forward + aft flaps
        g.beginFill(0x374151);
        g.drawPolygon([-6 * s, -62 * s, -10 * s, -58 * s, -6 * s, -56 * s]);
        g.drawPolygon([6 * s, -62 * s, 10 * s, -58 * s, 6 * s, -56 * s]);
        g.drawPolygon([-6 * s, -48 * s, -11 * s, -43 * s, -6 * s, -42 * s]);
        g.drawPolygon([6 * s, -48 * s, 11 * s, -43 * s, 6 * s, -42 * s]);
        g.endFill();
        // Interstage hot-stage ring
        g.beginFill(0x111827); g.drawRect(-6 * s, -43 * s, 12 * s, 2 * s); g.endFill();
    },

    // ─── Blue Origin — New Glenn (white, 7m bulbous fairing, blue feather) ───
    _blue_origin(g, s) {
        // First stage
        g.beginFill(0xf8fafc); g.drawRect(-5.5 * s, -42 * s, 11 * s, 42 * s); g.endFill();
        g.beginFill(0xd8dee5); g.drawRect(-5.5 * s, -42 * s, 2 * s, 42 * s); g.endFill();
        // Landing strakes at base
        g.beginFill(0x0077c8);
        g.drawPolygon([-5.5 * s, -10 * s, -8.5 * s, 0, -5.5 * s, 0]);
        g.drawPolygon([5.5 * s, -10 * s, 8.5 * s, 0, 5.5 * s, 0]);
        g.endFill();
        // Feather logo band
        g.beginFill(0x0077c8); g.drawRect(-5.5 * s, -30 * s, 11 * s, 3 * s); g.endFill();
        // Second stage
        g.beginFill(0xf1f5f9); g.drawRect(-5.5 * s, -48 * s, 11 * s, 6 * s); g.endFill();
        // Bulbous 7m fairing
        g.beginFill(0xffffff);
        g.drawPolygon([-5.5 * s, -48 * s, -7.5 * s, -52 * s, -7.5 * s, -58 * s, -3 * s, -62 * s, 3 * s, -62 * s, 7.5 * s, -58 * s, 7.5 * s, -52 * s, 5.5 * s, -48 * s]);
        g.endFill();
        g.beginFill(0xdbe3ea); g.drawRect(-7.5 * s, -58 * s, 2 * s, 6 * s); g.endFill();
        // Blue nose tip
        g.beginFill(0x0077c8); g.drawPolygon([-3 * s, -62 * s, 0, -62 * s, 3 * s, -62 * s, 1.5 * s, -62 * s]); g.drawRect(-3 * s, -62.5 * s, 6 * s, 1.5 * s); g.endFill();
    },

    // ─── NASA — SLS Block 1 (orange core, twin white SRBs, Orion + LAS) ───
    _nasa(g, s) {
        // Twin SRBs
        g.beginFill(0xf1f5f9);
        g.drawRect(-9.5 * s, -38 * s, 4.5 * s, 38 * s);
        g.drawRect(5 * s, -38 * s, 4.5 * s, 38 * s);
        g.endFill();
        g.beginFill(0xef4444); // SRB nose cones
        g.drawPolygon([-9.5 * s, -38 * s, -7.25 * s, -44 * s, -5 * s, -38 * s]);
        g.drawPolygon([5 * s, -38 * s, 7.25 * s, -44 * s, 9.5 * s, -38 * s]);
        g.endFill();
        // Orange core stage
        g.beginFill(0xd97d43); g.drawRect(-4.5 * s, -50 * s, 9 * s, 50 * s); g.endFill();
        g.beginFill(0xb96233); g.drawRect(-4.5 * s, -50 * s, 2 * s, 50 * s); g.endFill();
        g.beginFill(0xeb9a60); g.drawRect(2.5 * s, -50 * s, 1.5 * s, 50 * s); g.endFill();
        // ICPS upper stage (white)
        g.beginFill(0xf8fafc); g.drawRect(-3.5 * s, -58 * s, 7 * s, 8 * s); g.endFill();
        // Orion capsule (grey cone)
        g.beginFill(0x9ca3af); g.drawPolygon([-3.5 * s, -58 * s, 0, -64 * s, 3.5 * s, -58 * s]); g.endFill();
        // Launch Abort System needle
        g.beginFill(0xe5e7eb); g.drawRect(-0.8 * s, -70 * s, 1.6 * s, 6 * s); g.endFill();
        g.beginFill(0xef4444); g.drawRect(-0.8 * s, -70 * s, 1.6 * s, 1.5 * s); g.endFill();
    },

    // ─── CNSA — Long March 10 (white, red bands, tri-core moon rocket) ───
    _cnsa(g, s) {
        // Side boosters (CBC cores)
        g.beginFill(0xfafafa);
        g.drawRect(-10 * s, -32 * s, 4.5 * s, 32 * s);
        g.drawRect(5.5 * s, -32 * s, 4.5 * s, 32 * s);
        g.endFill();
        g.beginFill(0xde2910); // booster tips
        g.drawPolygon([-10 * s, -32 * s, -7.75 * s, -37 * s, -5.5 * s, -32 * s]);
        g.drawPolygon([5.5 * s, -32 * s, 7.75 * s, -37 * s, 10 * s, -32 * s]);
        g.endFill();
        // Core stage
        g.beginFill(0xffffff); g.drawRect(-5 * s, -48 * s, 10 * s, 48 * s); g.endFill();
        g.beginFill(0xe2e6ea); g.drawRect(-5 * s, -48 * s, 2 * s, 48 * s); g.endFill();
        // Red CZ bands
        g.beginFill(0xde2910);
        g.drawRect(-5 * s, -44 * s, 10 * s, 2.5 * s);
        g.drawRect(-5 * s, -20 * s, 10 * s, 2 * s);
        g.endFill();
        // PRC flag mark
        g.beginFill(0xde2910); g.drawRect(-3.5 * s, -38 * s, 5 * s, 3.5 * s); g.endFill();
        g.beginFill(0xffde00); g.drawRect(-3 * s, -37.5 * s, 1.2 * s, 1.2 * s); g.endFill();
        // Mengzhou capsule fairing
        g.beginFill(0xf1f5f9); g.drawPolygon([-5 * s, -48 * s, -3 * s, -56 * s, 3 * s, -56 * s, 5 * s, -48 * s]); g.endFill();
        // Escape tower
        g.beginFill(0xcbd5e1); g.drawRect(-0.8 * s, -62 * s, 1.6 * s, 6 * s); g.endFill();
    },

    // ─── ESA — Ariane 64 (white core, 4× P120C boosters, European blue) ───
    _esa(g, s) {
        // P120C boosters (2 visible in side view)
        g.beginFill(0xe9edf0);
        g.drawRect(-9 * s, -28 * s, 4.5 * s, 28 * s);
        g.drawRect(4.5 * s, -28 * s, 4.5 * s, 28 * s);
        g.endFill();
        g.beginFill(0x374151); // dark booster caps
        g.drawPolygon([-9 * s, -28 * s, -6.75 * s, -33 * s, -4.5 * s, -28 * s]);
        g.drawPolygon([4.5 * s, -28 * s, 6.75 * s, -33 * s, 9 * s, -28 * s]);
        g.endFill();
        // Core
        g.beginFill(0xffffff); g.drawRect(-4 * s, -44 * s, 8 * s, 44 * s); g.endFill();
        g.beginFill(0xdde3e8); g.drawRect(-4 * s, -44 * s, 1.6 * s, 44 * s); g.endFill();
        // ESA blue band + stars hint
        g.beginFill(0x003399); g.drawRect(-4 * s, -36 * s, 8 * s, 4 * s); g.endFill();
        g.beginFill(0xffcc00); g.drawRect(-2.5 * s, -34.8 * s, 1 * s, 1 * s); g.drawRect(0.5 * s, -34.8 * s, 1 * s, 1 * s); g.endFill();
        // Long fairing
        g.beginFill(0xf8fafc); g.drawRect(-4.5 * s, -52 * s, 9 * s, 8 * s); g.endFill();
        g.beginFill(0xf8fafc); g.drawPolygon([-4.5 * s, -52 * s, 0, -57 * s, 4.5 * s, -52 * s]); g.endFill();
    },

    // ─── ULA — Vulcan Centaur (white, red stripe, GEM-63XL SRBs) ───
    _ula(g, s) {
        // GEM-63XL solids
        g.beginFill(0xe5e7eb);
        g.drawRect(-8.5 * s, -24 * s, 3.5 * s, 24 * s);
        g.drawRect(5 * s, -24 * s, 3.5 * s, 24 * s);
        g.endFill();
        g.beginFill(0x475569);
        g.drawPolygon([-8.5 * s, -24 * s, -6.75 * s, -29 * s, -5 * s, -24 * s]);
        g.drawPolygon([5 * s, -24 * s, 6.75 * s, -29 * s, 8.5 * s, -24 * s]);
        g.endFill();
        // Booster stage
        g.beginFill(0xf8fafc); g.drawRect(-5 * s, -40 * s, 10 * s, 40 * s); g.endFill();
        g.beginFill(0xd7dde3); g.drawRect(-5 * s, -40 * s, 2 * s, 40 * s); g.endFill();
        // Signature red V stripe
        g.beginFill(0xdc2626);
        g.drawPolygon([-5 * s, -38 * s, 0, -30 * s, 5 * s, -38 * s, 5 * s, -34 * s, 0, -26 * s, -5 * s, -34 * s]);
        g.endFill();
        // Centaur V + fairing
        g.beginFill(0xffffff); g.drawRect(-6 * s, -52 * s, 12 * s, 12 * s); g.endFill();
        g.beginFill(0xe5e9ed); g.drawRect(-6 * s, -52 * s, 2 * s, 12 * s); g.endFill();
        g.beginFill(0xffffff); g.drawPolygon([-6 * s, -52 * s, 0, -58 * s, 6 * s, -52 * s]); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(-6 * s, -41 * s, 12 * s, 1.5 * s); g.endFill();
    },

    // ─── Rocket Lab — Electron (carbon-black, the smallsat workhorse) ───
    _rocketlab(g, s) {
        g.beginFill(0x18181b); g.drawRect(-3 * s, -42 * s, 6 * s, 42 * s); g.endFill();
        g.beginFill(0x3f3f46); g.drawRect(1 * s, -42 * s, 1.2 * s, 42 * s); g.endFill(); // sheen
        // White ELECTRON band
        g.beginFill(0xf8fafc); g.drawRect(-3 * s, -34 * s, 6 * s, 2 * s); g.endFill();
        // Rutherford battery band (silver)
        g.beginFill(0x94a3b8); g.drawRect(-3 * s, -10 * s, 6 * s, 2 * s); g.endFill();
        // Kick-stage separation line
        g.beginFill(0x00b4d8); g.drawRect(-3 * s, -38 * s, 6 * s, 1.2 * s); g.endFill();
        // Fairing
        g.beginFill(0x18181b); g.drawPolygon([-3 * s, -42 * s, 0, -48 * s, 3 * s, -42 * s]); g.endFill();
        g.beginFill(0x52525b); g.drawPolygon([-1 * s, -44.5 * s, 0, -47 * s, 1 * s, -44.5 * s]); g.endFill();
    },

    // ─── ISRO — LVM3 (white core, twin S200 solids, tricolor) ───
    _isro(g, s) {
        // S200 strap-ons
        g.beginFill(0xf5f0e8);
        g.drawRect(-9.5 * s, -34 * s, 4.5 * s, 34 * s);
        g.drawRect(5 * s, -34 * s, 4.5 * s, 34 * s);
        g.endFill();
        g.beginFill(0xff6b00);
        g.drawPolygon([-9.5 * s, -34 * s, -7.25 * s, -40 * s, -5 * s, -34 * s]);
        g.drawPolygon([5 * s, -34 * s, 7.25 * s, -40 * s, 9.5 * s, -34 * s]);
        g.endFill();
        // Core (L110 + C25)
        g.beginFill(0xfafaf5); g.drawRect(-4.5 * s, -46 * s, 9 * s, 46 * s); g.endFill();
        g.beginFill(0xe3ded2); g.drawRect(-4.5 * s, -46 * s, 1.8 * s, 46 * s); g.endFill();
        // Tricolor band
        g.beginFill(0xff6b00); g.drawRect(-4.5 * s, -30 * s, 9 * s, 2 * s); g.endFill();
        g.beginFill(0xffffff); g.drawRect(-4.5 * s, -28 * s, 9 * s, 2 * s); g.endFill();
        g.beginFill(0x138808); g.drawRect(-4.5 * s, -26 * s, 9 * s, 2 * s); g.endFill();
        // Ogive payload fairing (Gaganyaan-ready)
        g.beginFill(0xffffff);
        g.drawPolygon([-4.5 * s, -46 * s, -5.5 * s, -50 * s, -3 * s, -56 * s, 3 * s, -56 * s, 5.5 * s, -50 * s, 4.5 * s, -46 * s]);
        g.endFill();
        // Crew escape spike
        g.beginFill(0xcbd5e1); g.drawRect(-0.7 * s, -58 * s, 1.4 * s, 2.5 * s); g.endFill();
    },

    // ─── JAXA — H3-24L (white, orange tank foam accents, twin SRB-3) ───
    _jaxa(g, s) {
        // SRB-3 boosters
        g.beginFill(0xf8fafc);
        g.drawRect(-8.5 * s, -26 * s, 3.8 * s, 26 * s);
        g.drawRect(4.7 * s, -26 * s, 3.8 * s, 26 * s);
        g.endFill();
        g.beginFill(0x00479d);
        g.drawPolygon([-8.5 * s, -26 * s, -6.6 * s, -31 * s, -4.7 * s, -26 * s]);
        g.drawPolygon([4.7 * s, -26 * s, 6.6 * s, -31 * s, 8.5 * s, -26 * s]);
        g.endFill();
        // Core
        g.beginFill(0xffffff); g.drawRect(-4.5 * s, -46 * s, 9 * s, 46 * s); g.endFill();
        g.beginFill(0xe0e5ea); g.drawRect(-4.5 * s, -46 * s, 1.8 * s, 46 * s); g.endFill();
        // Orange insulation band (2nd stage tank)
        g.beginFill(0xf59e0b); g.drawRect(-4.5 * s, -40 * s, 9 * s, 6 * s); g.endFill();
        // JAXA red dot
        g.beginFill(0xdc2626); g.drawCircle(0, -22 * s, 1.8 * s); g.endFill();
        // Fairing
        g.beginFill(0xf8fafc); g.drawRect(-5 * s, -52 * s, 10 * s, 6 * s); g.endFill();
        g.beginFill(0xf8fafc); g.drawPolygon([-5 * s, -52 * s, 0, -58 * s, 5 * s, -52 * s]); g.endFill();
    },

    // ─── Roscosmos — Soyuz-2.1a (grey-green, 4 tapered strap-ons, escape tower) ───
    _roscosmos(g, s) {
        // Tapered strap-on boosters (Korolev cross makers)
        g.beginFill(0x8f9779);
        g.drawPolygon([-9 * s, 0, -8 * s, -26 * s, -4.5 * s, -20 * s, -4.5 * s, 0]);
        g.drawPolygon([9 * s, 0, 8 * s, -26 * s, 4.5 * s, -20 * s, 4.5 * s, 0]);
        g.endFill();
        g.beginFill(0x6f7860);
        g.drawPolygon([-9 * s, 0, -8.6 * s, -12 * s, -7 * s, -10 * s, -7 * s, 0]);
        g.endFill();
        // Core stage
        g.beginFill(0x9aa38b); g.drawRect(-4.5 * s, -40 * s, 9 * s, 40 * s); g.endFill();
        g.beginFill(0x7d8670); g.drawRect(-4.5 * s, -40 * s, 1.8 * s, 40 * s); g.endFill();
        // Orange-brown interstage lattice
        g.beginFill(0xb45309); g.drawRect(-4.5 * s, -34 * s, 9 * s, 3 * s); g.endFill();
        g.beginFill(0x92400e);
        for (let i = -4; i < 4; i += 2) { g.drawRect(i * s, -34 * s, 0.8 * s, 3 * s); }
        g.endFill();
        // Payload shroud (crew Soyuz — grey with escape tower)
        g.beginFill(0xd1d5db); g.drawRect(-3.5 * s, -50 * s, 7 * s, 10 * s); g.endFill();
        g.beginFill(0xd1d5db); g.drawPolygon([-3.5 * s, -50 * s, 0, -53 * s, 3.5 * s, -50 * s]); g.endFill();
        // Escape tower needle (iconic)
        g.beginFill(0x9ca3af); g.drawRect(-0.7 * s, -60 * s, 1.4 * s, 7 * s); g.endFill();
        g.beginFill(0x6b7280); g.drawRect(-1.4 * s, -55 * s, 2.8 * s, 2 * s); g.endFill();
    },

    // ─── Northrop Grumman — Antares 330 (white, dark first stage, Cygnus fairing) ───
    _northrop_grumman(g, s) {
        // First stage (new Firefly-built Miranda stage — dark carbon)
        g.beginFill(0x27272a); g.drawRect(-4.5 * s, -24 * s, 9 * s, 24 * s); g.endFill();
        g.beginFill(0x3f3f46); g.drawRect(2 * s, -24 * s, 1.5 * s, 24 * s); g.endFill();
        // Second stage (white Castor 30XL)
        g.beginFill(0xf8fafc); g.drawRect(-4.5 * s, -42 * s, 9 * s, 18 * s); g.endFill();
        g.beginFill(0xdde2e7); g.drawRect(-4.5 * s, -42 * s, 1.8 * s, 18 * s); g.endFill();
        // NG blue band
        g.beginFill(0x003d7a); g.drawRect(-4.5 * s, -26 * s, 9 * s, 2.5 * s); g.endFill();
        // Cygnus fairing (bulged)
        g.beginFill(0xffffff);
        g.drawPolygon([-4.5 * s, -42 * s, -5.5 * s, -46 * s, -3 * s, -52 * s, 3 * s, -52 * s, 5.5 * s, -46 * s, 4.5 * s, -42 * s]);
        g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(-3 * s, -52.8 * s, 6 * s, 1.2 * s); g.endFill();
    },

    // ─── Firefly — Alpha (white carbon, black interstage, firefly-green accents) ───
    _firefly(g, s) {
        g.beginFill(0xf8fafc); g.drawRect(-3.5 * s, -40 * s, 7 * s, 40 * s); g.endFill();
        g.beginFill(0xdde3e8); g.drawRect(-3.5 * s, -40 * s, 1.4 * s, 40 * s); g.endFill();
        // Black interstage
        g.beginFill(0x18181b); g.drawRect(-3.5 * s, -26 * s, 7 * s, 4 * s); g.endFill();
        // Firefly green glow band
        g.beginFill(0xa3e635); g.drawRect(-3.5 * s, -14 * s, 7 * s, 1.8 * s); g.endFill();
        g.beginFill(0xa3e635); g.drawRect(-3.5 * s, -30.8 * s, 7 * s, 1.2 * s); g.endFill();
        // Fairing with green tip
        g.beginFill(0xf8fafc); g.drawPolygon([-3.5 * s, -40 * s, 0, -47 * s, 3.5 * s, -40 * s]); g.endFill();
        g.beginFill(0xa3e635); g.drawPolygon([-1.2 * s, -44.5 * s, 0, -47 * s, 1.2 * s, -44.5 * s]); g.endFill();
    },

    // ─── LandSpace — Zhuque-3 (stainless steel, phoenix-red band, grid fins) ───
    _landspace(g, s) {
        // Stainless first stage
        g.beginFill(0xaeb6bd); g.drawRect(-5.5 * s, -38 * s, 11 * s, 38 * s); g.endFill();
        g.beginFill(0x8d959c); g.drawRect(-5.5 * s, -38 * s, 2.2 * s, 38 * s); g.endFill();
        g.beginFill(0xcfd6db); g.drawRect(2.8 * s, -38 * s, 1.8 * s, 38 * s); g.endFill();
        // Grid fins
        g.beginFill(0x52525b);
        g.drawRect(-8.5 * s, -36 * s, 3 * s, 5 * s);
        g.drawRect(5.5 * s, -36 * s, 3 * s, 5 * s);
        g.endFill();
        // Landing legs (folded)
        g.beginFill(0x3f3f46);
        g.drawPolygon([-5.5 * s, -12 * s, -7 * s, 0, -5.5 * s, 0]);
        g.drawPolygon([5.5 * s, -12 * s, 7 * s, 0, 5.5 * s, 0]);
        g.endFill();
        // Second stage
        g.beginFill(0xbfc7cd); g.drawRect(-5.5 * s, -52 * s, 11 * s, 14 * s); g.endFill();
        // Phoenix-red band (Zhuque = Vermilion Bird)
        g.beginFill(0x7f1d1d); g.drawRect(-5.5 * s, -44 * s, 11 * s, 3 * s); g.endFill();
        g.beginFill(0xdc2626); g.drawRect(-5.5 * s, -43.2 * s, 11 * s, 1.4 * s); g.endFill();
        // Blunt nose
        g.beginFill(0xbfc7cd); g.drawPolygon([-5.5 * s, -52 * s, -2 * s, -58 * s, 2 * s, -58 * s, 5.5 * s, -52 * s]); g.endFill();
        g.beginFill(0xdc2626); g.drawRect(-2 * s, -58.6 * s, 4 * s, 1.2 * s); g.endFill();
    }
};
