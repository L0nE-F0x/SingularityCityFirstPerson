/* ══════════════════════════════════════════════════════════════════════════
   AMBASSADOR RESIDENCES — ported from pixi/js/interior_ambassador_res.js.

   Four floors: Grand Reception, Study & Library, Master Suite, Wine Cellar.
   The villas share a plan (they are all the same kind of grace-and-favour
   house) but the reception's national style, the study's reading list and
   the cellar's stock are per country, so entering the UAE residence after
   the UK one should not feel like re-entering the same room.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, flagTex, sealTex, vistaTex } from './kit.js';
import { COUNTRIES } from './embassy.js';

// Residence-specific flavour layered on top of the shared country record.
const RES = {
    us: { style: 'COLONIAL REVIVAL', wood: 0x8a6136, rug: 0x7c2d12, wine: 'NAPA CABERNET',
        reading: ['~The Federalist Papers', 'Compute and the Commons', '+AI and National Power'] },
    cn: { style: 'COURTYARD VILLA', wood: 0x6b3a1a, rug: 0xb91c1c, wine: 'MOUTAI RESERVE',
        reading: ['~Records of the Grand Historian', 'Algorithmic Governance', '+Made in China 2025'] },
    eu: { style: 'MODERNIST GLASS', wood: 0x9aa0a8, rug: 0x1e3a8a, wine: 'BURGUNDY GRAND CRU',
        reading: ['~Treaty of Rome, annotated', 'The Brussels Effect', '+AI Act commentary'] },
    uk: { style: 'GEORGIAN BRICK', wood: 0x7a4a2a, rug: 0x1f3d2b, wine: 'VINTAGE PORT',
        reading: ['~Hansard, bound', 'Bletchley and After', '+Notes on Machine Intelligence'] },
    jp: { style: 'SUKIYA TEAHOUSE', wood: 0xa8875a, rug: 0xd6cdb6, wine: 'JUNMAI DAIGINJO',
        reading: ['~The Book of Tea', 'Robotics and Society', '+Hiroshima Process papers'] },
    in: { style: 'SANDSTONE HAVELI', wood: 0xa8703a, rug: 0xb45309, wine: 'NASHIK VALLEY RESERVE',
        reading: ['~Arthashastra', 'Digital Public Infrastructure', '+Indic Language Models'] },
    ae: { style: 'MASHRABIYA MODERN', wood: 0xc9ab74, rug: 0x0f766e, wine: 'DATE ARAK (SEALED)',
        reading: ['~Poetry of the Gulf', 'Sovereign Compute', '+Falcon technical report'] }
};

function keyFor(b) {
    const k = String(b?.id || '').replace('diplomat_villa_', '');
    return COUNTRIES[k] ? k : 'us';
}

export const VILLA = {
    id: 'villa',
    theme(b, f, th) {
        const k = COUNTRIES[keyFor(b)];
        th.cat = 'home';
        th.accent = '#' + k.warm.toString(16).padStart(6, '0');
        if (f === 1) { th.wall = 0x3f3226; th.ceil = 0x2a2018; th.floor = 0x5a4028; th.lamp = 0xffe0a0; th.dim = true; }
        else if (f === 2) { th.wall = 0xe4d8c0; th.ceil = 0xd2c4a8; th.floor = 0x8a6a45; th.lamp = 0xffeec8; }
        else if (f === 3) { th.wall = 0x33291c; th.ceil = 0x1c1610; th.floor = 0x3f3427; th.lamp = 0xf59e0b; th.dim = true; th.noPanels = true; }
        else { th.wall = 0xe8dcc4; th.ceil = 0xdccfb4; th.floor = 0xa07a4a; th.lamp = 0xffe4ac; }
    },
    floors: [
        // ── 0 · GRAND RECEPTION ─────────────────────────────────────────────
        {
            key: 'reception', label: 'GRAND RECEPTION',
            build(c) {
                const kk = keyFor(c.b), k = COUNTRIES[kk], r = RES[kk];
                // double-height feel: paired columns and a long runner
                for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.column(c, s * 175, -120 + i * 110, c.H - 4, 0xe8e2cc, 20);
                c.box(150, 1.6, 300, 20, 1, -10, r.rug);
                c.box(130, 1.8, 280, 20, 1.4, -10, 0x8a7048);

                // ceremonial fireplace with the national arms over the mantel
                P.fireplace(c, -60, -c.D / 2 + 40, 130, 0x8a8070);
                c.plate(sealTex(k.glyph, k.short, r.style, '#' + k.warm.toString(16).padStart(6, '0')),
                    58, 58, -60, 84, -c.D / 2 + c.WALL / 2 + 3);
                c.plate(flagTex(k.flag), 62, 40, 150, 68, -c.D / 2 + c.WALL / 2 + 3);

                // reception furniture: two sofa groups and a grand piano-ish bulk
                for (const [gx, gz] of [[-150, 60], [150, 60]]) {
                    c.box(110, 22, 40, gx, 11, gz, 0x6b5136); c.solid(gx, gz, 110, 40);
                    c.box(110, 26, 12, gx, 30, gz - 20, 0x7a5c40);
                    P.chair(c, gx - 66, gz + 30, 0x6b5136, -1);
                    P.chair(c, gx + 66, gz + 30, 0x6b5136, -1);
                    P.table(c, gx, gz + 56, 66, 40, r.wood, 20);
                }
                c.box(120, 34, 70, 190, 17, -120, 0x1a1a1a); c.solid(190, -120, 120, 70);
                c.box(126, 4, 76, 190, 36, -120, 0x2a2a2a);
                c.box(70, 6, 40, 190, 42, -140, 0x111111);   // raised lid

                // catering table and standing lamps
                P.counter(c, -140, 188, 110, 40, r.wood, 0xd4c4a8, k.warm);
                for (const lx of [-250, 250]) { c.box(6, 60, 6, lx, 30, -195, 0x5a4634); c.lit(20, 14, 20, lx, 66, -195, 0xffe0a0); }
                P.plant(c, 245, 170, 60); P.plant(c, -248, -200, 60);
                c.npc(c, 60, 120, { name: k.title === 'HIGH COMMISSIONER' ? 'High Commissioner' : 'Ambassador', role: 'Host', color: k.accent }, -1);
                c.npc(c, -190, 100, { name: 'Butler', role: 'Residence Staff', color: 0x334155 }, 1);
            }
        },
        // ── 1 · STUDY & LIBRARY ─────────────────────────────────────────────
        {
            key: 'study', label: 'STUDY & LIBRARY',
            build(c) {
                const kk = keyFor(c.b), r = RES[kk], k = COUNTRIES[kk];
                // Books line the right wall and the whole back wall. The left wall
                // belongs to the lift bank, so the shelving stops short of it.
                for (let i = 0; i < 4; i++) P.bookshelf(c, c.W / 2 - 30, -150 + i * 100, 96, 86, 30, 1);
                for (let i = 0; i < 5; i++) P.bookshelf(c, -212 + i * 100, -c.D / 2 + 26, 92, 86, 30, 0);
                P.bookshelf(c, -160, c.D / 2 - 34, 92, 86, 30, 0);
                // partner desk under a green banker's lamp
                c.box(160, 32, 80, 20, 16, -40, r.wood); c.solid(20, -40, 160, 80);
                c.box(166, 4, 86, 20, 34, -40, 0x4a3520);
                c.lit(26, 10, 16, -30, 42, -40, 0x1e6b3a);
                c.lit(24, 14, 3, 60, 44, -56, 0x14324a);
                P.chair(c, 20, 16, 0x4a3320, -1);
                // reading chairs by a lit hearth
                P.fireplace(c, 200, -150, 96, 0x7a7268);
                for (const [ax, az] of [[150, -60], [230, -60]]) {
                    c.box(48, 20, 46, ax, 10, az, 0x6b3a2a); c.solid(ax, az, 48, 46);
                    c.box(48, 34, 10, ax, 30, az - 18, 0x7c4432);
                    for (const s of [-1, 1]) c.box(8, 18, 40, ax + s * 20, 24, az, 0x7c4432);
                }
                // globe, ladder and the reading list the ambassador is working through
                c.box(20, 20, 20, -200, 30, 60, 0x2f6bb0);
                c.box(26, 4, 26, -200, 18, 60, 0x8a6a3a);
                c.box(4, 90, 4, -190, 45, -120, 0x6b5136);
                for (let s = 0; s < 7; s++) c.box(28, 3, 3, -176, 12 + s * 13, -120, 0x6b5136);
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#1d1710', accent: '#' + k.warm.toString(16).padStart(6, '0'),
                    title: 'ON THE DESK', titleSize: 28, lines: r.reading.concat(['Despatch box — locked']), lineSize: 21
                }), 170, 74, 20, 74, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, -80, 60, { name: 'Political Counsellor', role: 'Residence Study', color: 0x94a3b8 }, -1);
            }
        },
        // ── 2 · MASTER SUITE ────────────────────────────────────────────────
        {
            key: 'master', label: 'MASTER SUITE',
            build(c) {
                const kk = keyFor(c.b), r = RES[kk], k = COUNTRIES[kk];
                // four-poster bed against the back wall
                const bz = -120;
                c.box(180, 26, 130, 20, 13, bz, r.wood); c.solid(20, bz, 180, 130);
                c.box(186, 12, 136, 20, 32, bz, 0xe8e2d4);           // mattress + linen
                c.box(160, 10, 34, 20, 42, bz - 44, 0xf4f0e6);       // pillows
                c.box(186, 6, 70, 20, 40, bz + 30, r.rug);           // throw
                for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                    c.box(9, 86, 9, 20 + sx * 88, 43, bz + sz * 62, 0x4a3520);
                }
                c.box(190, 8, 8, 20, 86, bz - 62, 0x4a3520);
                c.box(190, 8, 8, 20, 86, bz + 62, 0x4a3520);
                c.box(8, 8, 130, -68, 86, bz, 0x4a3520);
                c.box(8, 8, 130, 108, 86, bz, 0x4a3520);
                for (const s of [-1, 1]) {
                    P.table(c, 20 + s * 118, bz - 20, 44, 40, r.wood, 24);
                    c.lit(14, 20, 14, 20 + s * 118, 40, bz - 20, 0xffe0a0);
                }
                // dressing area and a private terrace window
                P.cabinet(c, -215, 190, 60, 78, 34, r.wood, 4);
                c.box(70, 90, 6, -150, 45, c.D / 2 - c.WALL / 2 - 6, 0x6b5136);
                c.lit(58, 76, 1.2, -150, 45, c.D / 2 - c.WALL / 2 - 10, 0xb8c8d8);   // full-length mirror
                c.plate(vistaTex('city', '#' + k.warm.toString(16).padStart(6, '0')), 92, 92, 220, 56, -c.D / 2 + c.WALL / 2 + 3);
                c.box(100, 8, 8, 220, 106, -c.D / 2 + 12, 0x6b5136);
                // sitting corner with morning coffee
                P.table(c, 200, 110, 70, 50, r.wood, 24);
                P.chair(c, 160, 110, 0x6b5136, 0);
                P.chair(c, 240, 110, 0x6b5136, 0);
                c.lit(9, 9, 9, 200, 30, 110, 0xffe4ac);
                c.box(180, 1.6, 140, 20, 1, 120, r.rug);
                c.npc(c, -80, 150, { name: 'Housekeeper', role: 'Residence Staff', color: 0x8a7048 }, -1);
            }
        },
        // ── 3 · WINE CELLAR ─────────────────────────────────────────────────
        {
            key: 'cellar', label: 'WINE CELLAR',
            build(c) {
                const kk = keyFor(c.b), r = RES[kk];
                // vaulted stone: ribs and piers, no ceiling panels at all
                for (let i = 0; i < 8; i++) {
                    const z = -180 + i * 52;
                    c.box(c.W - 30, 12, 14, 0, c.H - 10, z, 0x3a3024);
                    for (const s of [-1, 1]) c.box(14, 34, 14, s * (c.W / 2 - 26), c.H - 28, z, 0x3a3024);
                }
                // racks along the back wall and the right wall, plus a central
                // island — the left wall is the lift bank in every interior
                for (let i = 0; i < 5; i++) P.wineRack(c, -190 + i * 100, -190, 66, 80, 30);
                for (let i = 0; i < 4; i++) P.wineRack(c, 246, -120 + i * 96, 24, 80, 62);
                for (let i = 0; i < 3; i++) P.wineRack(c, -60 + i * 74, -40, 66, 78, 30);
                // tasting table under a single lamp
                P.table(c, 20, 120, 130, 66, 0x4a3520, 28);
                for (const s of [-1, 1]) P.chair(c, 20 + s * 50, 170, 0x3a2e22, -1);
                c.box(2, 22, 2, 20, c.H - 12, 120, 0x2a2418);
                c.lit(30, 6, 30, 20, c.H - 24, 120, 0xffd9a0);
                for (let g = 0; g < 4; g++) c.lit(5, 9, 5, -20 + g * 26, 34, 120, 0xf5e6c8);
                // the crated pride of the cellar
                for (let i = 0; i < 4; i++) P.crate(c, -195 + i * 30, 175, 26, 0x3d2914);
                c.plate(panelTex({
                    w: 384, h: 160, bg: '#1a140a', accent: '#f59e0b',
                    title: 'CELLAR BOOK', titleSize: 28,
                    lines: ['~' + r.wine, '+Reserved: state dinner', '!Do not disturb the sediment'], lineSize: 20
                }), 150, 62, 20, 62, -c.D / 2 + c.WALL / 2 + 3);
                for (const bx of [-160, -60, 60, 160]) {
                    c.box(10, 8, 10, bx, c.H - 20, 170, 0x2a2418);
                    c.lit(6, 6, 6, bx, c.H - 26, 170, 0xffc98a);
                }
                P.rat(c, 200, 190, -1);
                c.npc(c, 210, 60, { name: 'Sommelier', role: 'Residence Cellar', color: 0x7c2d12 }, 1);
            }
        }
    ]
};
