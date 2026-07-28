/* ══════════════════════════════════════════════════════════════════════════
   HUMANOID SILHOUETTES — the real 2026 flagship robots, in boxes.

   Ported from pixi/js/robot_models.js, which exists for the same reason this
   does: a Robotics Quarter full of identical grey mannequins is a shrug, but
   you can tell an Atlas from a Digit across a factory floor if the silhouette
   is honest. The 2D library draws them in Graphics primitives; here they are
   axis-aligned boxes merged into the room shell, so a display hall of eight
   humanoids still costs nothing extra at draw time.

   One assembly routine, driven by a per-company profile, rather than six
   copies of "torso, arms, head": the differences that actually read at
   distance are leg style, torso mass and what the face does. Everything else
   is palette.

   Coordinates match the kit: feet at y=0 (or o.y for a plinth), facing +1
   looks toward +Z (the street door), -1 toward the back wall.
   ══════════════════════════════════════════════════════════════════════════ */
import { nameTex, hex } from './kit.js';

/* Names track js/data.js ROBOTICS_COMPANIES; the styling notes are the real
   design cues each machine is recognised by. */
export const ROBOT_PROFILES = {
    tesla: {
        name: 'Optimus V3', maker: 'Tesla', accent: 0xe2e8f0, css: '#e2e8f0',
        scale: 1.0, shell: 0xe8eaed, dark: 0x17181a, trim: 0xc9ccd1,
        legs: 'straight', torso: 'slim', head: 'faceplate', led: 0x60a5fa,
        note: 'Dangerous, repetitive work'
    },
    figure: {
        name: 'Figure 03', maker: 'Figure', accent: 0x94a3b8, css: '#94a3b8',
        scale: 0.97, shell: 0xb0b5ba, dark: 0x101214, trim: 0xc4c8cc,
        legs: 'straight', torso: 'soft', head: 'screen', led: 0x60a5fa,
        note: 'Helix VLA, end to end'
    },
    boston_dynamics: {
        name: 'Atlas', maker: 'Boston Dynamics', accent: 0xf1f3f4, css: '#e5e7eb',
        scale: 1.07, shell: 0xf1f3f4, dark: 0x3c4043, trim: 0xd4d7da,
        legs: 'chunky', torso: 'broad', head: 'ring', led: 0x22d3ee,
        note: 'Electric, unreasonable mobility'
    },
    unitree: {
        name: 'Unitree H1', maker: 'Unitree', accent: 0x38bdf8, css: '#38bdf8',
        scale: 0.88, shell: 0x374151, dark: 0x111827, trim: 0x4b5563,
        legs: 'compact', torso: 'compact', head: 'visor', led: 0x38bdf8,
        note: 'Priced to undercut everyone'
    },
    agility: {
        name: 'Digit', maker: 'Agility', accent: 0x14b8a6, css: '#14b8a6',
        scale: 0.99, shell: 0xf4f6f7, dark: 0x1f2937, trim: 0x14b8a6,
        legs: 'digitigrade', torso: 'tall', head: 'sensorbar', led: 0x38bdf8,
        note: 'Totes, all day, no lunch'
    },
    apptronik: {
        name: 'Apollo', maker: 'Apptronik', accent: 0x22d3ee, css: '#22d3ee',
        scale: 1.0, shell: 0xf5f6f7, dark: 0x1f2937, trim: 0xdadde0,
        legs: 'straight', torso: 'armor', head: 'eyes', led: 0x22d3ee,
        note: 'Manufacturing and logistics'
    }
};

export const ROBOT_KEYS = Object.keys(ROBOT_PROFILES);

/** The flagship's display name, for plaques and panel copy. */
export function robotName(key) { return (ROBOT_PROFILES[key] || {}).name || 'Humanoid'; }

const TORSO = {
    slim:    { w: 15, d: 10, h: 16 },
    soft:    { w: 17, d: 12, h: 16 },
    broad:   { w: 19, d: 12, h: 17 },
    tall:    { w: 15, d: 11, h: 18 },
    compact: { w: 14, d: 9,  h: 14 },
    armor:   { w: 16, d: 11, h: 15 }
};

/**
 * One humanoid. `o`:
 *   facing  +1 toward the door (default), -1 toward the back wall
 *   scale   multiplies the profile's own scale
 *   y       feet height, for plinths and pallets
 *   pose    'stand' | 'work' (arms forward) | 'stride' | 'reach' | 'slump'
 *   label   true to hang a nameplate; needs c.plate
 *   solid   false to skip the collider (display bays behind glass)
 */
export function robot(c, key, x, z, o = {}) {
    const p = ROBOT_PROFILES[key] || ROBOT_PROFILES.tesla;
    const s = (o.scale || 1) * p.scale;
    const f = o.facing != null ? o.facing : 1;
    const y0 = o.y || 0;
    const pose = o.pose || 'stand';
    const U = (n) => n * s;                       // profile units → world units
    const Y = (n) => y0 + n * s;
    const shell = p.shell, dark = p.dark, trim = p.trim, led = p.led;

    // ── legs ────────────────────────────────────────────────────────────────
    const stride = pose === 'stride' ? U(5) : 0;
    let hipY = 18, legW = 6, legD = 7;
    if (p.legs === 'chunky') { hipY = 19; legW = 7.5; legD = 9; }
    if (p.legs === 'compact') { hipY = 15; legW = 5.5; legD = 6.5; }
    if (p.legs === 'tall') hipY = 19;

    if (p.legs === 'digitigrade') {
        // Digit's backwards knee: thigh forward, shin kicking back, foot forward
        // again. Three stacked slabs per leg is enough for the silhouette to be
        // unmistakable from the side, which is the only view that matters.
        hipY = 20;
        for (const sx of [-1, 1]) {
            const lx = x + sx * U(4.4);
            c.box(U(5), U(8), U(6), lx, Y(15), z + f * U(2.5), shell);
            c.box(U(4.4), U(9), U(5.5), lx, Y(7.5), z - f * U(2.5), shell);
            c.box(U(6), U(2.4), U(9), lx, Y(1.2), z + f * U(1.5), p.dark);
            c.box(U(5.2), U(1.6), U(6.2), lx, Y(11.5), z, trim);   // knee actuator
        }
    } else {
        for (const sx of [-1, 1]) {
            const lz = z + sx * f * stride;
            c.box(U(legW), U(hipY), U(legD), x + sx * U(legW * 0.78), Y(hipY / 2), lz, shell);
            c.box(U(legW + 0.4), U(2), U(legD + 0.4), x + sx * U(legW * 0.78), Y(hipY * 0.55), lz, dark);
            c.box(U(legW + 1.2), U(2.2), U(legD + 2.6), x + sx * U(legW * 0.78), Y(1.1), lz + f * U(1), dark);
        }
    }
    // pelvis block ties the legs to the torso
    c.box(U(legW * 2.6), U(4), U(legD + 1), x, Y(hipY + 2), z, dark);

    // ── torso ───────────────────────────────────────────────────────────────
    const t = TORSO[p.torso] || TORSO.slim;
    const chestY = hipY + 4 + t.h / 2;
    c.box(U(t.w), U(t.h), U(t.d), x, Y(chestY), z, shell);
    if (p.torso === 'armor') {
        // Apollo wears a chest plate over a dark midriff — the two-tone break is
        // the fastest way to tell it from Optimus at a distance.
        c.box(U(t.w + 0.6), U(t.h * 0.55), U(t.d + 0.6), x, Y(chestY + t.h * 0.22), z, trim);
        c.box(U(t.w - 1), U(t.h * 0.3), U(t.d - 0.6), x, Y(hipY + 5), z, dark);
    } else if (p.torso === 'soft') {
        c.box(U(t.w - 3), U(t.h * 0.45), U(t.d + 0.6), x, Y(chestY + t.h * 0.2), z, trim);
    } else if (p.torso === 'tall') {
        for (const sx of [-1, 1]) c.box(U(2.6), U(t.h), U(t.d + 0.4), x + sx * U(t.w / 2 - 1.3), Y(chestY), z, trim);
    } else if (p.torso === 'broad') {
        c.box(U(6), U(t.h * 0.5), U(t.d + 0.8), x, Y(chestY - 1), z, dark);
    } else {
        c.box(U(t.w + 0.4), U(1.6), U(t.d + 0.4), x, Y(chestY - t.h * 0.22), z, trim);
    }
    // status LED on the sternum — the only light most of these carry, and it
    // keeps a white robot legible in the dim testing chambers
    c.lit(U(3.4), U(1.4), U(1), x, Y(chestY + t.h * 0.3), z + f * U(t.d / 2 + 0.4), led);

    // ── arms ────────────────────────────────────────────────────────────────
    const armH = t.h * 0.92, armY = chestY + t.h * 0.04;
    const armZ = pose === 'work' ? f * U(4) : pose === 'reach' ? f * U(7) : 0;
    const armDrop = pose === 'reach' ? U(4) : 0;
    for (const sx of [-1, 1]) {
        const ax = x + sx * U(t.w / 2 + 2.2);
        if (p.torso === 'broad') c.box(U(5), U(5), U(5), ax, Y(chestY + t.h * 0.42), z, dark);  // shoulder actuator
        c.box(U(3.8), U(armH), U(4.4), ax, Y(armY) + armDrop, z + armZ, shell);
        c.box(U(4), U(1.6), U(4.6), ax, Y(armY + armH * 0.18) + armDrop, z + armZ, dark);
        // forearm angles in when the robot is working a bench
        if (pose === 'work' || pose === 'reach') {
            c.box(U(3.4), U(3.4), U(6), ax, Y(armY - armH * 0.4) + armDrop, z + armZ + f * U(3.4), trim);
        }
    }

    // ── head ────────────────────────────────────────────────────────────────
    const headY = chestY + t.h / 2 + (p.head === 'sensorbar' ? 3.2 : 5);
    const fz = (dd) => z + f * U(dd);
    if (p.head === 'ring') {
        // Atlas's ring light: four lit bars around a dark disc face.
        c.box(U(9), U(9), U(8.5), x, Y(headY), z, dark);
        for (const sy of [-1, 1]) c.lit(U(6), U(1.2), U(1), x, Y(headY + sy * 2.6), fz(4.6), 0xffffff);
        for (const sx of [-1, 1]) c.lit(U(1.2), U(5.2), U(1), x + sx * U(2.6), Y(headY), fz(4.6), 0xffffff);
        c.lit(U(2.4), U(2.4), U(1), x, Y(headY), fz(4.8), led);
    } else if (p.head === 'sensorbar') {
        // Digit has no face — a wide LiDAR bar with two eye LEDs.
        c.box(U(11), U(5.5), U(7), x, Y(headY), z, dark);
        for (const sx of [-1, 1]) c.lit(U(2), U(2), U(1), x + sx * U(2.4), Y(headY + 0.4), fz(3.8), led);
        c.box(U(3), U(2), U(3), x, Y(headY + 3.4), z, trim);
    } else {
        c.box(U(9.4), U(9), U(8.4), x, Y(headY), z, shell);
        if (p.head === 'faceplate') {
            c.box(U(7.4), U(7), U(1.4), x, Y(headY), fz(4.4), dark);
            c.lit(U(2.2), U(1), U(0.8), x - U(1.6), Y(headY + 1.6), fz(5.2), 0x9aa6b4);   // gloss
        } else if (p.head === 'screen') {
            c.box(U(7.8), U(7.4), U(1.4), x, Y(headY), fz(4.4), dark);
            c.lit(U(1.4), U(1.4), U(0.8), x, Y(headY + 0.6), fz(5.2), led);
        } else if (p.head === 'visor') {
            c.box(U(8.4), U(4), U(1.4), x, Y(headY + 0.8), fz(4.4), dark);
            c.lit(U(6.4), U(1.4), U(0.8), x, Y(headY + 0.8), fz(5.2), led);
        } else {                                       // 'eyes' — Apollo's visor
            c.box(U(7.6), U(4.6), U(1.4), x, Y(headY + 0.6), fz(4.4), dark);
            for (const sx of [-1, 1]) c.lit(U(1.6), U(1.6), U(0.8), x + sx * U(1.9), Y(headY + 0.8), fz(5.2), led);
        }
    }

    if (o.solid !== false) c.solid(x, z, U(t.w + 6), U(t.d + 8));
    if (o.label && c.plate) {
        c.plate(nameTex(p.name, p.maker, hex(p.accent)), U(40), U(11),
            x, Y(headY + 12), z + f * U(2), f > 0 ? 0 : Math.PI);
    }
    return p;
}

/** Chassis on a jig: a half-built humanoid, exposed frame, no head yet.
 *  The assembly line needs "not finished" to read instantly. */
export function chassis(c, x, z, stage = 0, col = 0xec4899) {
    c.box(30, 4, 26, x, 2, z, 0x2a3140); c.solid(x, z, 30, 26);          // jig base
    for (const sx of [-1, 1]) c.box(3.5, 46, 3.5, x + sx * 13, 25, z, 0x475569);
    c.box(30, 3.5, 3.5, x, 48, z, 0x475569);
    // stage 0 spine only, 1 adds a ribcage, 2 adds limbs — the line's progress
    c.box(5, 24, 5, x, 22, z, 0x8b93a1);
    if (stage >= 1) {
        c.box(15, 12, 9, x, 30, z, 0x6b7280);
        for (const sx of [-1, 1]) c.box(1.6, 11, 8, x + sx * 5, 22, z, 0x8b93a1);
    }
    if (stage >= 2) {
        for (const sx of [-1, 1]) {
            c.box(3.4, 13, 4, x + sx * 10, 30, z, 0xb6bcc4);
            c.box(5.4, 14, 6, x + sx * 4.6, 10, z, 0xb6bcc4);
        }
    }
    c.lit(9, 2, 9, x, 50, z, col);                                        // jig lamp
    for (let i = 0; i < 3; i++) c.lit(2, 2, 2, x - 6 + i * 6, 5, z + 13, i <= stage ? 0x4ade80 : 0x334155);
}

/** Six-axis industrial arm on a pedestal. Elbow direction follows `face`. */
export function armRobot(c, x, z, face = 1, col = 0xf97316, h = 40) {
    c.box(24, 8, 24, x, 4, z, 0x2a3140); c.solid(x, z, 24, 24);
    c.box(16, h * 0.45, 16, x, 8 + h * 0.22, z, 0x4a5568);                // base joint
    c.lit(17, 2.5, 17, x, 8 + h * 0.45, z, col);
    c.box(10, h * 0.5, 10, x, 10 + h * 0.66, z, 0xd6dbe2);                // upper arm
    c.box(8, 8, 26, x, 10 + h * 0.9, z + face * 9, 0xd6dbe2);             // forearm reach
    c.box(6, 10, 6, x, 6 + h * 0.9, z + face * 20, 0x4a5568);             // wrist
    c.lit(5, 4, 5, x, h * 0.9, z + face * 20, col);                       // torch / gripper
}

/** Chest-high safety fence panel — mesh hinted with vertical bars. */
export function cageWall(c, x, z, len, axis = 'x', h = 44, col = 0xfbbf24) {
    const along = axis === 'x';
    const W = along ? len : 4, D = along ? 4 : len;
    c.box(along ? len : 5, 4, along ? 5 : len, x, h, z, col);             // top rail
    for (let i = 0; i <= len / 12; i++) {
        const off = -len / 2 + i * 12;
        c.box(1.8, h, 1.8, x + (along ? off : 0), h / 2, z + (along ? 0 : off), 0x8f98a4);
    }
    c.box(along ? len : 4, 2.5, along ? 4 : len, x, 3, z, 0x64748b);      // kick rail
    c.solid(x, z, W, D);
}
