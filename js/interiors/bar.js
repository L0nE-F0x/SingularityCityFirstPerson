/* ══════════════════════════════════════════════════════════════════════════
   NEON BAR — four bespoke levels ported from pixi/js/interior_bar.js.

   Why four builders instead of one tinted room: the karaoke stage is the
   signature moment of this destination in the 2D app, and it cannot be
   expressed as "the bar, but purple". Each level owns its geometry, its
   staff and its lighting mood; the lift ties them together.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, nameTex, vistaTex } from './kit.js';

const STAFF = {
    bartender: { name: 'Bartender', role: 'Mixologist', color: 0xff00ff },
    bouncer: { name: 'Bouncer', role: 'Door Policy', color: 0xef4444 },
    dj: { name: 'DJ Dropout', role: 'Resident DJ', color: 0xa855f7 },
    hostess: { name: 'Hostess', role: 'VIP Host', color: 0xc084fc },
    singer: { name: 'Karaoke Singer', role: 'On Stage', color: 0xfbbf24 },
    cellarman: { name: 'Cellar Keeper', role: 'Stock Control', color: 0xf59e0b }
};

/** Backbar bottle wall — the one prop that says "bar" from any angle. */
function bottleWall(c, x0, x1, y, z, rnd) {
    const cols = [0xff00ff, 0x00ffff, 0xa855f7, 0xf59e0b, 0xef4444, 0x4ade80, 0xff69b4, 0x3b82f6];
    c.box(x1 - x0 + 14, 34, 8, (x0 + x1) / 2, y + 4, z, 0x160e12);
    for (let bx = x0; bx <= x1; bx += 13) {
        const h = 14 + Math.floor(rnd() * 10);
        c.lit(6, h, 6, bx, y + h / 2, z + 6, cols[Math.floor(rnd() * cols.length)]);
    }
    c.lit(x1 - x0 + 10, 1.5, 2, (x0 + x1) / 2, y - 2, z + 8, 0xe879f9);
}

export const BAR = {
    id: 'bar',
    // Per-level mood. The cellar is the only place the neon stops.
    theme(b, f, th) {
        th.cat = 'bar';
        if (f === 1) { th.wall = 0x1d0f24; th.ceil = 0x0d0512; th.floor = 0x2c1836; th.lamp = 0xff00ff; th.accent = '#ff00ff'; }
        else if (f === 2) { th.wall = 0x2a1f18; th.ceil = 0x160f0a; th.floor = 0x3a2a1c; th.lamp = 0xfbbf24; th.accent = '#fbbf24'; }
        else if (f === 3) { th.wall = 0x2c2418; th.ceil = 0x171208; th.floor = 0x3a3020; th.lamp = 0xf59e0b; th.accent = '#f59e0b'; th.noPanels = true; }
        th.dim = true;
    },
    floors: [
        // ── 0 · MAIN BAR ────────────────────────────────────────────────────
        {
            key: 'main_bar', label: 'MAIN BAR',
            build(c) {
                const rnd = c.rnd;
                P.counter(c, -20, -150, 330, 44, 0x2a1028, 0x5a3a52, 0xe879f9);
                bottleWall(c, -170, 140, 52, -186, rnd);
                for (let i = -5; i <= 5; i++) P.stool(c, i * 30, -108);
                // glassware catching the backbar light
                for (let g = -4; g <= 4; g++) c.lit(5, 7, 5, g * 34, 46, -158, [0x00ffff, 0xff00ff, 0xa855f7][(g + 4) % 3]);

                // booths along the right wall
                for (let i = 0; i < 3; i++) P.booth(c, 210, -50 + i * 74, 0x2a1830, 0xf472b6);

                // jukebox + dance floor
                c.box(34, 46, 24, 250, 23, -140, 0x1a1030); c.solid(250, -140, 34, 24);
                c.lit(24, 16, 1, 250, 34, -127, 0xff00ff);
                c.lit(24, 8, 1, 250, 16, -127, 0x00ffff);
                for (let gx = -2; gx <= 1; gx++) for (let gz = 0; gz <= 2; gz++)
                    c.lit(46, 1, 46, gx * 52 + 26, 1.4, 40 + gz * 50, [0xe879f9, 0x5affc8, 0x8a5aff][(gx + gz + 4) % 3]);

                // neon signage over the counter and along both side walls
                c.plate(panelTex({
                    w: 512, h: 128, bg: '#150a1c', accent: '#00ffff', align: 'center',
                    title: 'NEON BAR', titleSize: 46, titleColor: '#ff5ad0',
                    lines: ['~GRADIENT DESCENT · 12', 'ATTENTION SPRITZ · 14', '+HAPPY HOUR UNTIL 20:00'],
                    lineSize: 20, padTop: 40
                }), 190, 48, -20, 76, -c.D / 2 + c.WALL / 2 + 3);
                for (const s of [-1, 1]) c.lit(2, 4, 300, s * (c.W / 2 - c.WALL), 66, 20, s > 0 ? 0xe879f9 : 0x5affc8);

                c.npc(c, -140, -112, STAFF.bartender, 1);
                c.npc(c, 200, 168, STAFF.bouncer, -1);
                P.plant(c, 250, 190, 44);
            }
        },
        // ── 1 · KARAOKE STAGE ───────────────────────────────────────────────
        {
            key: 'karaoke', label: 'KARAOKE STAGE',
            build(c) {
                const sz = -120;
                P.stage(c, 0, sz, 200, 90, 14, 0x2a1040, 0xff00ff);
                // footlights across the stage lip
                for (let i = -4; i <= 4; i++) c.lit(9, 3, 9, i * 22, 15, sz + 46, [0xff00ff, 0x00ffff, 0xa855f7, 0xfbbf24][(i + 4) % 4]);
                // mic stand, centre stage
                c.box(3, 30, 3, 0, 29, sz + 10, 0x8a8a8a);
                c.box(7, 7, 7, 0, 46, sz + 10, 0xd0d0d0);
                c.box(26, 2, 26, 0, 14.6, sz + 10, 0x1a1020);
                P.speaker(c, -122, sz + 10, 52);
                P.speaker(c, 122, sz + 10, 52);
                P.discoBall(c, 0, sz + 60, c.H - 30, 13);
                // the lyric screen is the thing you look at while someone murders a song
                c.plate(panelTex({
                    w: 512, h: 192, bg: '#080310', accent: '#ff69b4', align: 'center',
                    title: 'NOW SINGING', titleSize: 30, titleColor: '#ff9ad8',
                    lines: ['~SING YOUR TRAINING DATA', 'my weights, my rules', '+GRADIENT DESCENT BLUES'],
                    lineSize: 24, padTop: 44
                }), 210, 78, 0, 72, -c.D / 2 + c.WALL / 2 + 3);

                // cabaret seating either side of the stage
                // cabaret tables stay clear of the lift approach on the left wall
                for (const tx of [-175, -120, 160, 215]) {
                    P.table(c, tx, -20, 46, 46, 0x2a1040, 24);
                    P.chair(c, tx, 22, 0x3a1a50, -1);
                }
                for (let i = 0; i < 4; i++) P.table(c, -150 + i * 100, 90, 50, 50, 0x2a1040, 24);
                // queue rope for the sign-up list
                P.rope(c, 210, 150, 70, 0xfbbf24, 0xef4444);

                c.npc(c, 0, sz + 34, STAFF.singer, 1);
                c.npc(c, 190, -60, STAFF.dj, -1);
                // laser wash from the ceiling rig
                c.box(300, 6, 6, 0, c.H - 14, sz + 60, 0x1a1a22);
                for (let i = -3; i <= 3; i++) c.lit(8, 5, 8, i * 46, c.H - 20, sz + 60, [0xff00ff, 0x00ffff][(i + 3) % 2]);
            }
        },
        // ── 2 · VIP LOUNGE ──────────────────────────────────────────────────
        {
            key: 'vip', label: 'VIP LOUNGE',
            build(c) {
                // plush booth ring in gold and plum
                for (const [bx, bz] of [[-150, -130], [30, -130], [200, -130], [-150, 30], [30, 30]]) {
                    P.booth(c, bx, bz, 0x4a2060, 0xfbbf24);
                }
                // champagne service island
                P.counter(c, 200, 60, 90, 46, 0x3a2a18, 0xb08a4a, 0xfbbf24);
                for (const cx of [176, 192, 208, 224]) c.lit(7, 18, 7, cx, 50, 60, 0xfde68a);
                c.box(26, 22, 26, 200, 11, 96, 0x94a3b8);          // ice bucket
                c.lit(20, 6, 20, 200, 23, 96, 0xfbbf24);

                // velvet rope at the lift approach — this floor is the exclusive one
                P.rope(c, -120, 130, 90, 0xfbbf24, 0xef4444);
                P.rope(c, 30, 130, 90, 0xfbbf24, 0xef4444);

                // skyline view: the VIP floor is the only one with windows
                for (let i = 0; i < 3; i++) {
                    c.plate(vistaTex('city', '#fbbf24'), 96, 96, -140 + i * 150, 56, -c.D / 2 + c.WALL / 2 + 3);
                }
                c.lit(c.W - 60, 2, 2, 0, c.H - 8, 0, 0xfbbf24);
                for (const px of [-230, 250]) { c.box(4, 34, 4, px, 17, 180, 0xfbbf24); c.lit(10, 22, 10, px, 44, 180, 0xfde68a); }

                c.npc(c, -170, 170, STAFF.hostess, -1);
                P.plant(c, 250, -180, 52);
            }
        },
        // ── 3 · CELLAR ──────────────────────────────────────────────────────
        {
            key: 'cellar', label: 'CELLAR STORAGE',
            build(c) {
                // low vault: brick piers and a beam grid instead of neon
                for (const px of [-120, 0, 120]) {
                    P.column(c, px, -60, c.H - 6, 0x4a3a28, 22);
                    P.column(c, px, 90, c.H - 6, 0x4a3a28, 22);
                }
                c.box(c.W - 40, 8, 10, 0, c.H - 12, -60, 0x3a2c1c);
                c.box(c.W - 40, 8, 10, 0, c.H - 12, 90, 0x3a2c1c);

                for (let i = 0; i < 4; i++) P.wineRack(c, -150 + i * 70, -160, 62, 74, 28);
                for (const kx of [170, 205, 240]) P.barrel(c, kx, -150);
                for (let i = 0; i < 6; i++) P.crate(c, -110 + (i % 3) * 30, 40 + Math.floor(i / 3) * 34, 24);
                for (const bx of [190, 225]) { P.barrel(c, bx, 60); P.barrel(c, bx, 96); }

                // bare bulbs on a drop cord — the only light down here
                for (const bx of [-160, -40, 80, 200]) {
                    c.box(1.5, 18, 1.5, bx, c.H - 14, 0, 0x2a2418);
                    c.lit(7, 7, 7, bx, c.H - 24, 0, 0xffd9a0);
                }
                c.plate(panelTex({
                    w: 384, h: 128, bg: '#1a140a', accent: '#f59e0b',
                    title: 'CELLAR', titleSize: 34,
                    lines: ['!NO SMOKING — ETHANOL', '+STOCK COUNT: 1,204 BOTTLES'], lineSize: 20
                }), 150, 50, 40, 66, -c.D / 2 + c.WALL / 2 + 3);

                // the cellar rat has seniority over everyone
                P.rat(c, 60, 150, 1);
                c.plate(nameTex('Cellar Rat', 'Wine Cellar Guardian', '#f59e0b'), 54, 15, 60, 26, 150);
                c.npc(c, -230, 170, STAFF.cellarman, -1);
            }
        }
    ]
};
