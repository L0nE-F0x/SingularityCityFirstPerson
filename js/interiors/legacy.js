/* ══════════════════════════════════════════════════════════════════════════
   LEGACY SYSTEMS MUSEUM — ported from pixi/js/interior_legacy.js.

   Hall of Architectures, Timeline Gallery, Hall of Fame, Archives basement.
   FP had no museum theme at all, so this room type is new geometry rather
   than a re-dress: plinths, vitrines, roped-off galleries and a cold store
   of retired hardware in the basement.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, sealTex, nameTex } from './kit.js';

const ARCHITECTURES = [
    ['PERCEPTRON', '1958 · one layer, big claims'],
    ['LSTM', '1997 · memory that forgets on purpose'],
    ['CNN', '1998 · convolutions all the way down'],
    ['SEQ2SEQ', '2014 · encoder, decoder, hope'],
    ['TRANSFORMER', '2017 · attention is all you need'],
    ['MoE', '2021 · only some of the model shows up']
];

const TIMELINE = [
    ['1956', 'Dartmouth workshop'],
    ['1997', 'Deep Blue takes game six'],
    ['2012', 'AlexNet wins ImageNet'],
    ['2017', 'Attention is all you need'],
    ['2022', 'Chat interfaces go public'],
    ['2024', 'Reasoning models ship']
];

const FAME = [
    ['ELIZA', 'Therapist, 1966'],
    ['SHRDLU', 'Blocks world, 1970'],
    ['DEEP BLUE', 'Chess, 1997'],
    ['WATSON', 'Jeopardy!, 2011'],
    ['ALPHAGO', 'Go, 2016'],
    ['GPT-2', 'Withheld, 2019']
];

export const LEGACY = {
    id: 'legacy',
    theme(b, f, th) {
        th.cat = 'museum';
        th.accent = '#c8a04a';
        if (f === 1) { th.wall = 0x1d2430; th.ceil = 0x0f141c; th.floor = 0x2a3240; th.lamp = 0xfbbf24; th.dim = true; }
        else if (f === 2) { th.wall = 0x2a2418; th.ceil = 0x191408; th.floor = 0x3a3020; th.lamp = 0xffe0a0; th.dim = true; }
        else if (f === 3) { th.wall = 0x2e3238; th.ceil = 0x171a1e; th.floor = 0x3a4048; th.lamp = 0x9fd0ff; th.dim = true; th.noPanels = true; }
        else { th.wall = 0xe6e2d6; th.ceil = 0xd6d2c6; th.floor = 0xb8b2a2; th.lamp = 0xfff2d8; }
    },
    floors: [
        // ── 0 · HALL OF ARCHITECTURES ───────────────────────────────────────
        {
            key: 'architectures', label: 'HALL OF ARCHITECTURES',
            build(c) {
                // welcome desk + gallery colonnade
                P.counter(c, -140, -140, 130, 46, 0x6b5136, 0x8a6a45, 0xc8a04a);
                c.plate(sealTex('◈', 'LEGACY', 'SYSTEMS MUSEUM', '#c8a04a'), 60, 60, 60, 70, -c.D / 2 + c.WALL / 2 + 3);
                for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.column(c, s * (s < 0 ? 178 : 200), -110 + i * 110, c.H - 4, 0xd8d2c2, 20);

                // six plinths, each with a model architecture under glass
                for (let i = 0; i < 6; i++) {
                    const x = -140 + (i % 3) * 155, z = -40 + Math.floor(i / 3) * 120;
                    c.box(70, 26, 50, x, 13, z, 0x8a8578); c.solid(x, z, 70, 50);
                    P.vitrine(c, x, z, 58, 40, 40, [0x38bdf8, 0x4ade80, 0xa855f7, 0xfbbf24, 0xf472b6, 0x22d3ee][i]);
                    c.plate(nameTex(ARCHITECTURES[i][0], ARCHITECTURES[i][1], '#c8a04a'), 64, 18, x, 34, z + 22);
                    P.rope(c, x, z + 44, 74, 0xc8a04a, 0x7c2d12);
                }
                // orientation board by the door
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#f0ece0', accent: '#8a6a3a', frame: true,
                    title: 'TODAY AT THE MUSEUM', titleSize: 28, titleColor: '#3a3020', lineColor: '#3a352c',
                    lines: ['~11:00 Tour: before the transformer', '14:00 Talk: what MoE forgot',
                        '+16:00 Hall of Fame unveiling'], lineSize: 21
                }), 140, 62, c.W / 2 - c.WALL / 2 - 5, 54, 120, -Math.PI / 2);
                P.plant(c, 245, 175, 52); P.plant(c, -245, 175, 52);
                c.npc(c, -100, -96, { name: 'Curator', role: 'Collections', color: 0xc8a04a }, 1);
                c.npc(c, 190, 150, { name: 'Tour Guide', role: 'Docent', color: 0x60a5fa }, -1);
            }
        },
        // ── 1 · TIMELINE GALLERY ────────────────────────────────────────────
        {
            key: 'timeline', label: 'TIMELINE GALLERY',
            build(c) {
                // a lit spine running the length of the room — the timeline itself
                c.box(c.W - 80, 8, 22, 10, 30, 0, 0x111827);
                c.lit(c.W - 90, 3, 12, 10, 35, 0, 0xfbbf24);
                for (let i = 0; i < 6; i++) {
                    const x = -210 + i * 88;
                    const up = i % 2 === 0;
                    c.box(6, 34, 6, x, up ? 51 : 13, 0, 0x475569);       // tick riser
                    c.lit(9, 9, 9, x, up ? 68 : 0, 0, 0xfbbf24);
                    c.plate(panelTex({
                        w: 256, h: 160, bg: '#0b1220', accent: '#fbbf24', align: 'center',
                        title: TIMELINE[i][0], titleSize: 34,
                        lines: ['~' + TIMELINE[i][1]], lineSize: 17, padTop: 40
                    }), 74, 46, x, up ? 84 : 62, up ? -26 : 26, up ? 0 : Math.PI);
                }
                // exhibit alcoves along the back wall
                for (let i = 0; i < 4; i++) {
                    const x = -170 + i * 120;
                    c.box(100, 76, 20, x, 38, -c.D / 2 + 24, 0x141a24); c.solid(x, -c.D / 2 + 24, 100, 20);
                    c.lit(84, 60, 1.2, x, 40, -c.D / 2 + 34, [0x1e3a5f, 0x2a1f3a, 0x143a2a, 0x3a2a14][i]);
                    c.lit(60, 3, 8, x, 80, -c.D / 2 + 40, 0xfff2d8);      // picture light
                }
                // seating island for the film loop
                c.box(150, 20, 70, 10, 10, 150, 0x3a4250); c.solid(10, 150, 150, 70);
                c.box(156, 4, 76, 10, 22, 150, 0x4a5462);
                c.plate(panelTex({
                    w: 512, h: 288, bg: '#04070e', accent: '#38bdf8', align: 'center',
                    title: 'SEVENTY YEARS IN 6 MIN', titleSize: 26,
                    lines: ['~now playing', 'archive footage', '+captions available'], lineSize: 20, padTop: 40
                }), 150, 84, 10, 58, c.D / 2 - c.WALL / 2 - 6, Math.PI);
                for (const px of [-240, 250]) P.rope(c, px, 60, 90, 0xc8a04a, 0x7c2d12);
                c.npc(c, 220, -60, { name: 'Docent', role: 'Timeline Gallery', color: 0x60a5fa }, -1);
            }
        },
        // ── 2 · HALL OF FAME ────────────────────────────────────────────────
        {
            key: 'fame', label: 'HALL OF FAME',
            build(c) {
                // busts on plinths in two facing ranks, gold light between them
                for (let i = 0; i < 6; i++) {
                    const s = i < 3 ? -1 : 1;
                    const x = -140 + (i % 3) * 140, z = s * 100;
                    c.box(46, 54, 46, x, 27, z, 0x8a8070); c.solid(x, z, 46, 46);
                    c.box(52, 5, 52, x, 56, z, 0xa8a090);
                    c.box(24, 22, 22, x, 70, z, 0xd8cfae);              // head
                    c.box(34, 12, 26, x, 60, z, 0xc9c0a0);              // shoulders
                    c.lit(20, 3, 20, x, 84, z, 0xffe0a0);
                    c.plate(nameTex(FAME[i][0], FAME[i][1], '#c8a04a'), 58, 16, x, 46, z + (s < 0 ? 25 : -25), s < 0 ? 0 : Math.PI);
                }
                // honours board on the back wall
                c.plate(panelTex({
                    w: 640, h: 288, bg: '#1a140a', accent: '#c8a04a',
                    title: 'HALL OF FAME', titleSize: 38,
                    lines: FAME.map(f => '~' + f[0] + '  ·  ' + f[1]), lineSize: 22
                }), 250, 112, 10, 62, -c.D / 2 + c.WALL / 2 + 3);
                // red carpet down the middle, brass rope both sides
                c.box(120, 1.8, c.D - 60, 10, 1, 0, 0x7c2d12);
                for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P.rope(c, 10 + s * 70, -110 + i * 110, 96, 0xc8a04a, 0x7c2d12);
                for (const px of [-230, 250]) { c.box(6, 64, 6, px, 32, -60, 0x8a7048); c.lit(16, 12, 16, px, 68, -60, 0xffe0a0); }
                c.npc(c, -230, 160, { name: 'Curator', role: 'Hall of Fame', color: 0xc8a04a }, -1);
            }
        },
        // ── 3 · ARCHIVES ────────────────────────────────────────────────────
        {
            key: 'archives', label: 'ARCHIVES & COLD STORE',
            build(c) {
                // exposed services overhead — this is back-of-house, not gallery
                for (let i = 0; i < 7; i++) c.box(c.W - 30, 10, 10, 0, c.H - 12, -180 + i * 62, 0x3a4048);
                for (const py of [c.H - 26, c.H - 38]) c.box(16, 16, c.D - 40, -200, py, 0, 0x4a5058);
                for (const bx of [-160, -20, 120, 240]) {
                    c.box(10, 8, 10, bx, c.H - 22, 60, 0x2a3038);
                    c.lit(9, 6, 26, bx, c.H - 28, 60, 0xc8dcf0);
                }
                // rolling stacks of retired hardware
                for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
                    P.rack(c, -150 + i * 92, -140 + r * 96, [0x39ff88, 0x2aa0ff, 0xffd23a][(i + r) % 3], 80, 82, 36, 1);
                }
                for (let i = 0; i < 4; i++) P.cabinet(c, -145 + i * 105, 40, 80, 66, 32, 0x475569, 4);
                // tape library + crates awaiting accession
                for (let i = 0; i < 6; i++) P.crate(c, -195 + (i % 3) * 34, 172 + Math.floor(i / 3) * 32, 26, 0x4a4438);
                c.box(120, 70, 40, 200, 35, 150, 0x2e3238); c.solid(200, 150, 120, 40);
                for (let r = 0; r < 4; r++) for (let t = 0; t < 8; t++)
                    c.box(11, 12, 3, 152 + t * 13, 12 + r * 17, 170, [0x1a1e24, 0x2a3038][(r + t) % 2]);
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#0d1218', accent: '#9fd0ff',
                    title: 'ACCESSION QUEUE', titleSize: 30,
                    lines: ['+TPU v2 pod — catalogued', '~GPU cluster (2016) — cleaning',
                        '!tape reels — degrading', 'Perceptron replica — on loan'], lineSize: 21
                }), 200, 88, 20, 62, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, -240, 60, { name: 'Archivist', role: 'Cold Store', color: 0x64748b }, 1);
            }
        }
    ]
};
