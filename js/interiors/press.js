/* ══════════════════════════════════════════════════════════════════════════
   SINGULARITY CITY TIMES — ported from pixi/js/interior_newspaper.js.

   Lobby (with the working printing press), Newsroom, Editor's Office.
   The press is the interactive prop of the whole building in 2D: clicking it
   opens the paper. In first person that becomes a walk-up hotspot — stand at
   the press and press E. The staff roster is the same ten people, on the same
   day/night rotation, so the newsroom empties out overnight the way it should.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, frontPageTex } from './kit.js';

// Same roster and shift split as pixi InteriorNewspaper.NPCS.
export const PRESS_STAFF = [
    { name: 'Editor-in-Chief', role: 'Editor-in-Chief', color: 0xfbbf24, shift: 'day', floor: 2, x: -120, z: 40, face: 1 },
    { name: 'Senior Reporter', role: 'Industry Watch', color: 0x3b82f6, shift: 'day', floor: 1, x: -190, z: -20, face: 1 },
    { name: 'Journalist', role: 'General Reporter', color: 0x22c55e, shift: 'day', floor: 1, x: -60, z: -20, face: 1 },
    { name: 'Investigative', role: 'Black Market Beat', color: 0x06b6d4, shift: 'day', floor: 1, x: 70, z: -20, face: 1 },
    { name: 'Photographer', role: 'Photographer', color: 0xa855f7, shift: 'day', floor: 1, x: 200, z: 90, face: -1 },
    { name: 'Copy Editor', role: 'Defender of the En-Dash', color: 0xf97316, shift: 'day', floor: 1, x: -60, z: 90, face: 1 },
    { name: 'Receptionist', role: 'Front Desk', color: 0xfb7185, shift: 'day', floor: 0, x: -150, z: -96, face: 1 },
    { name: 'Night Editor', role: 'Night Editor', color: 0xfbbf24, shift: 'night', floor: 2, x: -120, z: 40, face: 1 },
    { name: 'Breaking News', role: 'Breaking News Desk', color: 0xef4444, shift: 'night', floor: 1, x: -60, z: -20, face: 1 },
    { name: 'Print Operator', role: 'Runs the Press', color: 0x22c55e, shift: 'night', floor: 0, x: 60, z: 60, face: -1 }
];

function staffOn(c, floorIdx) {
    const want = c.night ? 'night' : 'day';
    for (const s of PRESS_STAFF) {
        if (s.floor !== floorIdx || s.shift !== want) continue;
        c.npc(c, s.x, s.z, s, s.face);
    }
}

export const PRESS = {
    id: 'press',
    theme(b, f, th) {
        th.cat = 'press';
        th.accent = '#fbbf24';
        if (f === 1) { th.wall = 0xd8d2c4; th.ceil = 0xc4bfb0; th.floor = 0x8a8578; th.lamp = 0xfff2d0; }
        else if (f === 2) { th.wall = 0x3f3a30; th.ceil = 0x2a251e; th.floor = 0x5a4a34; th.lamp = 0xffe0a0; th.dim = true; }
        else { th.wall = 0xd6d0c2; th.ceil = 0xc8c2b2; th.floor = 0x9a9488; th.lamp = 0xfff2d0; }
    },
    floors: [
        // ── 0 · LOBBY & PRINTING PRESS ──────────────────────────────────────
        {
            key: 'lobby', label: 'LOBBY & PRESS',
            build(c) {
                // reception desk under the masthead
                P.counter(c, -110, -120, 150, 46, 0x5c4033, 0x8a6a45, 0xfbbf24);
                c.plate(panelTex({
                    w: 640, h: 160, bg: '#1b1b18', accent: '#fbbf24', align: 'center',
                    title: 'THE SINGULARITY CITY TIMES', titleSize: 30, titleColor: '#f4e6c0',
                    lines: ['~ALL THE GRADIENTS FIT TO PRINT'], lineSize: 20, padTop: 44
                }), 240, 60, -80, 76, -c.D / 2 + c.WALL / 2 + 3);

                // ── the press itself: rollers, web, delivery belt ──
                const px = 110, pz = 40;
                c.box(190, 76, 96, px, 38, pz, 0x3a4048); c.solid(px, pz, 190, 96);
                c.box(196, 8, 102, px, 80, pz, 0x22262c);
                for (let i = 0; i < 3; i++) {                 // roller drums, front face
                    const rx = px - 58 + i * 58;
                    c.box(40, 40, 6, rx, 44, pz + 50, 0x1a1e24);
                    c.lit(28, 28, 1.5, rx, 44, pz + 53, 0x8a8578);
                    c.box(8, 8, 8, rx, 44, pz + 55, 0x64748b);
                }
                c.lit(170, 4, 3, px, 20, pz + 50, 0xfbbf24);  // ink line
                // paper web climbing out of the machine
                for (let i = 0; i < 5; i++) c.box(150, 2, 16, px, 84 + i * 3, pz - 20 - i * 14, 0xefe9dc);
                // delivery belt spitting out finished editions
                c.box(64, 26, 120, px + 128, 13, pz + 30, 0x4a5058); c.solid(px + 128, pz + 30, 64, 120);
                for (let i = 0; i < 5; i++) c.box(52, 5, 16, px + 128, 28 + i, pz - 10 + i * 24, 0xefe9dc);
                for (let i = 0; i < 3; i++) c.box(56, 16, 40, px + 128, 34 + i * 4, pz + 70, 0xe4dcc8);
                c.lit(40, 3, 3, px + 128, 30, pz + 92, 0x4ade80);
                // status lamps and a bundle of newsprint reels
                for (let i = 0; i < 3; i++) c.lit(7, 7, 7, px - 60 + i * 60, 88, pz + 30, [0x4ade80, 0xfbbf24, 0xef4444][i]);
                for (let i = 0; i < 3; i++) P.barrel(c, 230, -150 + i * 44, 0xdad2c0);   // newsprint reels

                // stand here and press E for the paper — the 2D click target,
                // reachable on foot. Kept clear of the lift and the exit door.
                c.hotspot(px, pz + 96, 62, '📰 read today\'s edition', 'newspaper');
                c.lit(70, 1.4, 40, px, 1.2, pz + 96, 0xfbbf24);

                // front pages framed along the right wall (the left is the lift bank)
                for (let i = 0; i < 3; i++) {
                    c.plate(frontPageTex('THE TIMES',
                        ['MODEL RELEASED OVERNIGHT', 'CITY COMPUTE HITS RECORD', 'COURT RULES ON EVALS'][i],
                        ['Front page, archived', 'Business section', 'Civic desk'][i]),
                        56, 74, c.W / 2 - c.WALL / 2 - 5, 52, -140 + i * 80, -Math.PI / 2);
                }
                // waiting bench for tipsters
                for (let i = 0; i < 4; i++) c.box(38, 20, 34, -195 + i * 44, 10, 185, 0x6b5136);
                P.plant(c, 250, 180, 46);
                staffOn(c, 0);
            }
        },
        // ── 1 · NEWSROOM ────────────────────────────────────────────────────
        {
            key: 'newsroom', label: 'NEWSROOM',
            build(c) {
                // open-plan pods of reporter desks, back to back
                for (let row = 0; row < 2; row++) {
                    for (let i = 0; i < 4; i++) {
                        const x = -155 + i * 122, z = -50 + row * 110;
                        P.desk(c, x, z, 0x6b5136, 0x14324a);
                        c.box(84, 34, 4, x, 17, z - 30, 0xbfc7d2);      // low partition
                        c.box(20, 22, 14, x + 30, 39, z, 0x475569);     // phone
                    }
                    c.box(c.W - 140, 3, 8, 0, 44, -80 + row * 110, 0xcbd5e1);
                }
                // the wire wall: rolling headlines everybody works against
                c.plate(panelTex({
                    w: 640, h: 224, bg: '#0b1220', accent: '#fbbf24', grid: true,
                    title: 'THE WIRE', titleSize: 32,
                    lines: c.night
                        ? ['!03:12 frontier drop, unverified', '~03:40 arena ELO shifts', '+04:05 desk assigned']
                        : ['+09:02 lab announces eval suite', '~10:15 court hearing scheduled',
                            '!11:40 outage on the backbone', '+12:00 index at record high'],
                    lineSize: 22
                }), 250, 88, 0, 66, -c.D / 2 + c.WALL / 2 + 3);
                // photo desk and lightbox
                c.box(120, 32, 60, 210, 16, 90, 0x475569); c.solid(210, 90, 120, 60);
                c.lit(100, 3, 46, 210, 33, 90, 0xe0f2fe);
                for (let i = 0; i < 4; i++) c.lit(20, 14, 1, 168 + i * 28, 52, 62, 0x94a3b8);
                // the morgue: bound back issues, kept off the wire wall
                for (let i = 0; i < 2; i++) P.bookshelf(c, c.W / 2 - 30, -160 + i * 96, 92, 80, 26, 1);
                for (const bx of [-190, 190]) P.bookshelf(c, bx, c.D / 2 - 34, 92, 80, 26, 0);
                // coffee station, because it is always deadline
                P.counter(c, 210, -160, 110, 40, 0x5c4033, 0x8a6a45, 0xfbbf24);
                c.box(22, 26, 22, 180, 53, -160, 0x2a2e34);
                c.lit(12, 5, 12, 180, 68, -160, 0xffb020);
                staffOn(c, 1);
            }
        },
        // ── 2 · EDITOR'S OFFICE ─────────────────────────────────────────────
        {
            key: 'editor', label: "EDITOR'S OFFICE",
            build(c) {
                // heavy desk, glass partition onto the newsroom, front-page wall
                c.box(180, 34, 84, -120, 17, 0, 0x5a4a34); c.solid(-120, 0, 180, 84);
                c.box(186, 5, 90, -120, 36, 0, 0x7a6242);
                c.lit(26, 16, 3, -160, 46, -22, 0x14324a);
                c.box(26, 24, 24, -80, 13, 30, 0x4a3a28);
                P.chair(c, -120, -56, 0x3a2e22, 1);
                for (const s of [-1, 1]) P.chair(c, -120 + s * 46, 70, 0x5a4a34, -1);

                // tomorrow's front page, pinned up and still arguable
                c.plate(frontPageTex('THE TIMES',
                    c.night ? 'NIGHT DESK HOLDS THE SPLASH' : 'WHAT LEADS TOMORROW?',
                    c.night ? 'Second edition, 02:00' : 'Editorial conference, 16:00'),
                    120, 158, 30, 62, -c.D / 2 + c.WALL / 2 + 3);
                // the wall of past splashes
                for (let i = 0; i < 3; i++) {
                    P.frame(c, c.W / 2 - c.WALL / 2 - 5, 60, -110 + i * 92, 60, 46, 0x8a6a3a, 0x2a3a52, -1);
                }
                // glass partition to the newsroom
                c.box(6, 78, 200, 130, 39, 40, 0x6b7280);
                c.lit(1.5, 68, 190, 133, 42, 40, 0x9fc8e0);
                // globe, drinks tray, and the spike for killed stories
                c.box(22, 22, 22, 220, 32, -150, 0x2f6bb0);
                c.box(28, 4, 28, 220, 19, -150, 0x8a6a3a);
                P.cabinet(c, -240, 190, 44, 56, 30, 0x5a4a34, 3);
                c.box(14, 26, 14, -60, 13, -120, 0x475569);
                c.lit(3, 22, 3, -60, 36, -120, 0xef4444);
                P.plant(c, 245, 170, 50);
                staffOn(c, 2);
            }
        }
    ]
};
