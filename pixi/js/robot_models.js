/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOT MODELS (v1.0.0 — Per-Company Humanoid Silhouettes)
   One shared pixel-art library so the Testing Ground walkers, the factory interiors and the
   deployment dock all show each company's REAL flagship humanoid. Mirrors space_rockets.js.
   Every robot is drawn feet-at-(0,0), standing up, head top at y≈-height.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const RobotModels = {

    // Flagship humanoid per company key (matches ROBOTICS_COMPANIES keys)
    ROBOTS: {
        tesla:           'Optimus V3',
        figure:          'Figure 03',
        boston_dynamics: 'Atlas',
        agility:         'Digit',
        '1x':            'NEO',
        apptronik:       'Apollo 2',
        unitree:         'Unitree G1',
        ubtech:          'Walker S2'
    },

    robotName(key) { return this.ROBOTS[key] || 'Humanoid'; },

    // Drawn height (px at scale 1) — callers use it for placement / labels
    HEIGHTS: {
        tesla: 32, figure: 31, boston_dynamics: 33, agility: 30,
        '1x': 29, apptronik: 31, unitree: 26, ubtech: 32
    },

    height(key) { return this.HEIGHTS[key] || 30; },

    // Draw the company's flagship humanoid into Graphics `g`, feet centered at (0,0), scale `s`.
    draw(g, key, s = 1) {
        const fn = this['_' + key.replace(/^(\d)/, 'k$1')];
        if (fn) { fn.call(this, g, s); return; }
        // Fallback generic bot
        g.beginFill(0xc0c0d0); g.drawRect(-3 * s, -28 * s, 6 * s, 6 * s); g.endFill();
        g.beginFill(0x8890a0); g.drawRect(-4 * s, -22 * s, 8 * s, 12 * s); g.endFill();
        g.beginFill(0x607080); g.drawRect(-3 * s, -10 * s, 2.5 * s, 10 * s); g.drawRect(0.5 * s, -10 * s, 2.5 * s, 10 * s); g.endFill();
    },

    // ─── Tesla — Optimus V3 (smooth white shell, glossy black faceplate) ───
    _tesla(g, s) {
        // Legs — slim white with black knee joints
        g.beginFill(0xe8eaed);
        g.drawRect(-3.4 * s, -12 * s, 2.8 * s, 12 * s);
        g.drawRect(0.6 * s, -12 * s, 2.8 * s, 12 * s);
        g.endFill();
        g.beginFill(0x17181a);
        g.drawRect(-3.4 * s, -7 * s, 2.8 * s, 1.6 * s);
        g.drawRect(0.6 * s, -7 * s, 2.8 * s, 1.6 * s);
        g.endFill();
        // Pelvis
        g.beginFill(0x17181a); g.drawRect(-3.6 * s, -14 * s, 7.2 * s, 2.4 * s); g.endFill();
        // Torso — sculpted white chest, black waist seam
        g.beginFill(0xe8eaed); g.drawRoundedRect(-4.6 * s, -25 * s, 9.2 * s, 11 * s, 2 * s); g.endFill();
        g.beginFill(0xc9ccd1); g.drawRect(-4.6 * s, -18 * s, 9.2 * s, 1.4 * s); g.endFill();
        g.beginFill(0xc9ccd1); g.drawRect(-1 * s, -24 * s, 2 * s, 8 * s); g.endFill(); // chest seam
        // Arms — white with black elbow joints
        g.beginFill(0xe8eaed);
        g.drawRect(-6.6 * s, -24 * s, 2 * s, 10 * s);
        g.drawRect(4.6 * s, -24 * s, 2 * s, 10 * s);
        g.endFill();
        g.beginFill(0x17181a);
        g.drawRect(-6.6 * s, -19.6 * s, 2 * s, 1.4 * s);
        g.drawRect(4.6 * s, -19.6 * s, 2 * s, 1.4 * s);
        g.endFill();
        // Head — white helmet, glossy black faceplate
        g.beginFill(0xe8eaed); g.drawRoundedRect(-3 * s, -32 * s, 6 * s, 6.4 * s, 2 * s); g.endFill();
        g.beginFill(0x0b0c0e); g.drawRoundedRect(-2.3 * s, -31.2 * s, 4.6 * s, 4.8 * s, 1.6 * s); g.endFill();
        g.beginFill(0x2f3237, 0.9); g.drawRect(-1.6 * s, -30.6 * s, 1.4 * s, 1 * s); g.endFill(); // gloss
    },

    // ─── Figure — Figure 03 (soft-goods grey fabric, rounded, black face screen) ───
    _figure(g, s) {
        // Legs — fabric grey
        g.beginFill(0x9aa0a6);
        g.drawRect(-3.4 * s, -12 * s, 3 * s, 12 * s);
        g.drawRect(0.4 * s, -12 * s, 3 * s, 12 * s);
        g.endFill();
        g.beginFill(0x7d8288);
        g.drawRect(-3.4 * s, -6.4 * s, 3 * s, 1.2 * s);
        g.drawRect(0.4 * s, -6.4 * s, 3 * s, 1.2 * s);
        g.endFill();
        // Torso — rounded soft-goods, lighter chest panel
        g.beginFill(0xb0b5ba); g.drawRoundedRect(-4.8 * s, -24 * s, 9.6 * s, 12 * s, 3.5 * s); g.endFill();
        g.beginFill(0xc4c8cc); g.drawRoundedRect(-3.4 * s, -23 * s, 6.8 * s, 6 * s, 2.5 * s); g.endFill();
        // Rounded shoulders + arms
        g.beginFill(0xb0b5ba);
        g.drawCircle(-5.4 * s, -22 * s, 1.9 * s);
        g.drawCircle(5.4 * s, -22 * s, 1.9 * s);
        g.drawRect(-6.4 * s, -22 * s, 2 * s, 9 * s);
        g.drawRect(4.4 * s, -22 * s, 2 * s, 9 * s);
        g.endFill();
        // Head — rounded, full black face screen
        g.beginFill(0xb0b5ba); g.drawRoundedRect(-3 * s, -31 * s, 6 * s, 6.6 * s, 2.6 * s); g.endFill();
        g.beginFill(0x101214); g.drawRoundedRect(-2.4 * s, -30.2 * s, 4.8 * s, 5 * s, 2 * s); g.endFill();
        // Camera dot
        g.beginFill(0x60a5fa, 0.9); g.drawCircle(0, -28 * s, 0.7 * s); g.endFill();
    },

    // ─── Boston Dynamics — electric Atlas (white shell, ring-light head, chunky) ───
    _boston_dynamics(g, s) {
        // Legs — chunky white with dark hip/knee actuators
        g.beginFill(0xf1f3f4);
        g.drawRect(-3.8 * s, -13 * s, 3.2 * s, 13 * s);
        g.drawRect(0.6 * s, -13 * s, 3.2 * s, 13 * s);
        g.endFill();
        g.beginFill(0x3c4043);
        g.drawRect(-3.8 * s, -8 * s, 3.2 * s, 2 * s);
        g.drawRect(0.6 * s, -8 * s, 3.2 * s, 2 * s);
        g.drawRect(-4 * s, -15 * s, 8 * s, 2.6 * s); // pelvis block
        g.endFill();
        // Torso — broad white chest, dark core
        g.beginFill(0xf1f3f4); g.drawRoundedRect(-5.4 * s, -26 * s, 10.8 * s, 11.6 * s, 2.5 * s); g.endFill();
        g.beginFill(0x3c4043); g.drawRect(-2 * s, -21 * s, 4 * s, 6 * s); g.endFill();
        // Big shoulder actuators + arms
        g.beginFill(0x3c4043);
        g.drawCircle(-6 * s, -23.5 * s, 2.3 * s);
        g.drawCircle(6 * s, -23.5 * s, 2.3 * s);
        g.endFill();
        g.beginFill(0xf1f3f4);
        g.drawRect(-7.2 * s, -22 * s, 2.4 * s, 10 * s);
        g.drawRect(4.8 * s, -22 * s, 2.4 * s, 10 * s);
        g.endFill();
        // Head — the iconic ring light
        g.beginFill(0x3c4043); g.drawCircle(0, -30 * s, 3.1 * s); g.endFill();
        g.lineStyle(1.2 * s, 0xffffff, 0.95);
        g.drawCircle(0, -30 * s, 2.1 * s);
        g.lineStyle(0);
        g.beginFill(0x22d3ee, 0.5); g.drawCircle(0, -30 * s, 0.9 * s); g.endFill();
    },

    // ─── Agility — Digit (teal-white torso, backwards bird legs, sensor head) ───
    _agility(g, s) {
        // The signature backwards-bending legs (bird / digitigrade)
        g.beginFill(0xd8dcdf);
        // Left leg: thigh forward, shin kicks back, foot forward
        g.drawPolygon([-3.6 * s, -13 * s, -1.6 * s, -13 * s, -3.4 * s, -7 * s, -1.2 * s, -1.6 * s, -3.2 * s, -1.6 * s, -5 * s, -7 * s]);
        // Right leg
        g.drawPolygon([1.6 * s, -13 * s, 3.6 * s, -13 * s, 5 * s, -7 * s, 3.2 * s, -1.6 * s, 1.2 * s, -1.6 * s, 3.4 * s, -7 * s]);
        g.endFill();
        // Feet
        g.beginFill(0x64748b);
        g.drawRect(-4.2 * s, -1.6 * s, 3.4 * s, 1.6 * s);
        g.drawRect(0.8 * s, -1.6 * s, 3.4 * s, 1.6 * s);
        g.endFill();
        // Torso — tall box, white with teal side panels
        g.beginFill(0xf4f6f7); g.drawRoundedRect(-4.6 * s, -25 * s, 9.2 * s, 12.4 * s, 2 * s); g.endFill();
        g.beginFill(0x14b8a6);
        g.drawRect(-4.6 * s, -25 * s, 1.8 * s, 12.4 * s);
        g.drawRect(2.8 * s, -25 * s, 1.8 * s, 12.4 * s);
        g.endFill();
        // Slim arms
        g.beginFill(0xd8dcdf);
        g.drawRect(-6.2 * s, -23 * s, 1.6 * s, 9 * s);
        g.drawRect(4.6 * s, -23 * s, 1.6 * s, 9 * s);
        g.endFill();
        // Head — flat sensor bar with two LED "eyes"
        g.beginFill(0x1f2937); g.drawRoundedRect(-3.4 * s, -30 * s, 6.8 * s, 4.4 * s, 1.4 * s); g.endFill();
        g.beginFill(0x38bdf8);
        g.drawCircle(-1.5 * s, -27.8 * s, 0.9 * s);
        g.drawCircle(1.5 * s, -27.8 * s, 0.9 * s);
        g.endFill();
    },

    // ─── 1X — NEO (soft knit suit, warm beige, friendly home robot) ───
    _k1x(g, s) {
        // Legs — knit fabric
        g.beginFill(0xd9c9a8);
        g.drawRect(-3.2 * s, -12 * s, 2.8 * s, 12 * s);
        g.drawRect(0.4 * s, -12 * s, 2.8 * s, 12 * s);
        g.endFill();
        // Knit texture lines
        g.beginFill(0xc4b494, 0.7);
        g.drawRect(-3.2 * s, -9 * s, 2.8 * s, 0.8 * s);
        g.drawRect(0.4 * s, -9 * s, 2.8 * s, 0.8 * s);
        g.drawRect(-3.2 * s, -5 * s, 2.8 * s, 0.8 * s);
        g.drawRect(0.4 * s, -5 * s, 2.8 * s, 0.8 * s);
        g.endFill();
        // Torso — soft cream sweater
        g.beginFill(0xe8dcc0); g.drawRoundedRect(-4.4 * s, -23 * s, 8.8 * s, 11 * s, 3.5 * s); g.endFill();
        g.beginFill(0xd9c9a8, 0.8); g.drawRect(-4.4 * s, -17 * s, 8.8 * s, 1 * s); g.endFill();
        // Soft arms
        g.beginFill(0xe8dcc0);
        g.drawRoundedRect(-6.2 * s, -22 * s, 2 * s, 9.5 * s, 1 * s);
        g.drawRoundedRect(4.2 * s, -22 * s, 2 * s, 9.5 * s, 1 * s);
        g.endFill();
        // Head — small, rounded, soft grey face
        g.beginFill(0xe8dcc0); g.drawCircle(0, -26.5 * s, 3 * s); g.endFill();
        g.beginFill(0x8f959b); g.drawRoundedRect(-2 * s, -28 * s, 4 * s, 3.6 * s, 1.6 * s); g.endFill();
        g.beginFill(0xffffff, 0.35); g.drawCircle(-0.9 * s, -26.6 * s, 0.5 * s); g.drawCircle(0.9 * s, -26.6 * s, 0.5 * s); g.endFill();
    },

    // ─── Apptronik — Apollo 2 (white armor, dark core, friendly LED-eye face) ───
    _apptronik(g, s) {
        // Legs — white panels
        g.beginFill(0xf5f6f7);
        g.drawRect(-3.4 * s, -12.5 * s, 3 * s, 12.5 * s);
        g.drawRect(0.4 * s, -12.5 * s, 3 * s, 12.5 * s);
        g.endFill();
        g.beginFill(0x9aa0a6);
        g.drawRect(-3.4 * s, -7 * s, 3 * s, 1.4 * s);
        g.drawRect(0.4 * s, -7 * s, 3 * s, 1.4 * s);
        g.endFill();
        // Torso — white chest armor over dark midriff
        g.beginFill(0x1f2937); g.drawRect(-4 * s, -16 * s, 8 * s, 4 * s); g.endFill(); // dark waist
        g.beginFill(0xf5f6f7); g.drawRoundedRect(-4.8 * s, -24.5 * s, 9.6 * s, 9.5 * s, 2.5 * s); g.endFill();
        g.beginFill(0xdadde0); g.drawRect(-4.8 * s, -20 * s, 9.6 * s, 1.2 * s); g.endFill();
        // Arms
        g.beginFill(0xf5f6f7);
        g.drawRect(-6.6 * s, -23 * s, 2 * s, 9.5 * s);
        g.drawRect(4.6 * s, -23 * s, 2 * s, 9.5 * s);
        g.endFill();
        g.beginFill(0x1f2937);
        g.drawRect(-6.6 * s, -18.6 * s, 2 * s, 1.2 * s);
        g.drawRect(4.6 * s, -18.6 * s, 2 * s, 1.2 * s);
        g.endFill();
        // Head — white helmet, dark visor with two friendly cyan eyes
        g.beginFill(0xf5f6f7); g.drawRoundedRect(-3.1 * s, -31 * s, 6.2 * s, 6.6 * s, 2.2 * s); g.endFill();
        g.beginFill(0x111827); g.drawRoundedRect(-2.4 * s, -30 * s, 4.8 * s, 4.2 * s, 1.6 * s); g.endFill();
        g.beginFill(0x22d3ee);
        g.drawCircle(-1.2 * s, -28 * s, 0.7 * s);
        g.drawCircle(1.2 * s, -28 * s, 0.7 * s);
        g.endFill();
    },

    // ─── Unitree — G1 (compact matte black, glossy visor strip, springy) ───
    _unitree(g, s) {
        // Legs — compact, crouch-ready
        g.beginFill(0x374151);
        g.drawRect(-3 * s, -10 * s, 2.6 * s, 10 * s);
        g.drawRect(0.4 * s, -10 * s, 2.6 * s, 10 * s);
        g.endFill();
        g.beginFill(0x111827);
        g.drawRect(-3 * s, -5.6 * s, 2.6 * s, 1.4 * s);
        g.drawRect(0.4 * s, -5.6 * s, 2.6 * s, 1.4 * s);
        g.endFill();
        // Torso — compact dark box, silver chest plate
        g.beginFill(0x1f2937); g.drawRoundedRect(-4 * s, -19.5 * s, 8 * s, 9.5 * s, 2 * s); g.endFill();
        g.beginFill(0x4b5563); g.drawRoundedRect(-2.8 * s, -18.5 * s, 5.6 * s, 4.5 * s, 1.5 * s); g.endFill();
        // Arms — jointed, slightly bent (kung-fu ready)
        g.beginFill(0x374151);
        g.drawRect(-5.6 * s, -18 * s, 1.8 * s, 6 * s);
        g.drawRect(3.8 * s, -18 * s, 1.8 * s, 6 * s);
        g.endFill();
        g.beginFill(0x1f2937);
        g.drawRect(-6.2 * s, -12.5 * s, 2 * s, 4 * s);
        g.drawRect(4.2 * s, -12.5 * s, 2 * s, 4 * s);
        g.endFill();
        // Head — rounded with glossy black visor + blue LED strip
        g.beginFill(0x111827); g.drawRoundedRect(-2.8 * s, -25.5 * s, 5.6 * s, 6 * s, 2.4 * s); g.endFill();
        g.beginFill(0x38bdf8, 0.9); g.drawRoundedRect(-2 * s, -23.6 * s, 4 * s, 1.2 * s, 0.6 * s); g.endFill();
    },

    // ─── UBTech — Walker S2 (white industrial panels, navy accents, swap battery pack) ───
    _ubtech(g, s) {
        // Legs — sturdy white
        g.beginFill(0xeef0f2);
        g.drawRect(-3.6 * s, -13 * s, 3 * s, 13 * s);
        g.drawRect(0.6 * s, -13 * s, 3 * s, 13 * s);
        g.endFill();
        g.beginFill(0x1d4ed8);
        g.drawRect(-3.6 * s, -7.4 * s, 3 * s, 1.4 * s);
        g.drawRect(0.6 * s, -7.4 * s, 3 * s, 1.4 * s);
        g.endFill();
        // Signature hot-swap battery pack on the back
        g.beginFill(0x334155); g.drawRoundedRect(-2.6 * s, -27 * s, 5.2 * s, 4 * s, 1 * s); g.endFill();
        g.beginFill(0x4ade80); g.drawRect(-1.6 * s, -26.2 * s, 1 * s, 2.4 * s); g.endFill();
        // Torso — broad white industrial chest with navy trim
        g.beginFill(0xeef0f2); g.drawRoundedRect(-5 * s, -25 * s, 10 * s, 11.5 * s, 2 * s); g.endFill();
        g.beginFill(0x1d4ed8);
        g.drawRect(-5 * s, -25 * s, 10 * s, 1.4 * s);
        g.drawRect(-5 * s, -15 * s, 10 * s, 1.2 * s);
        g.endFill();
        // Arms
        g.beginFill(0xeef0f2);
        g.drawRect(-6.8 * s, -23.5 * s, 2.1 * s, 10 * s);
        g.drawRect(4.7 * s, -23.5 * s, 2.1 * s, 10 * s);
        g.endFill();
        g.beginFill(0x1d4ed8);
        g.drawRect(-6.8 * s, -19 * s, 2.1 * s, 1.2 * s);
        g.drawRect(4.7 * s, -19 * s, 2.1 * s, 1.2 * s);
        g.endFill();
        // Head — white helmet with wide navy visor
        g.beginFill(0xeef0f2); g.drawRoundedRect(-3 * s, -31.5 * s, 6 * s, 6.2 * s, 2 * s); g.endFill();
        g.beginFill(0x172554); g.drawRoundedRect(-2.4 * s, -30.4 * s, 4.8 * s, 2.8 * s, 1.2 * s); g.endFill();
        g.beginFill(0x60a5fa, 0.9); g.drawRect(-1.7 * s, -29.7 * s, 3.4 * s, 1 * s); g.endFill();
    }
};
