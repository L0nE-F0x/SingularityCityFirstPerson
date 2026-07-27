/* ══════════════════════════════════════════════════════════════════════════
   BACKBONE / IXP — ported from pixi/js/interior_backbone.js.

   Six levels: Meet-Me Room, Peering Hall, Cross-Connect Vault, NOC War Room,
   Cache Floor, Dish Control. In 2D each backbone building got a subset of
   these; in first person the lift makes it cheap to give one building the
   whole stack, so the IXP is the tour of the city's plumbing.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, vistaTex } from './kit.js';

/** Patch-panel bay: the visual signature of a carrier-neutral facility. */
function patchBay(c, x, z, face = 1, led = 0x22d3ee) {
    c.box(52, 88, 32, x, 44, z, 0x111825); c.solid(x, z, 52, 32);
    for (let u = 0; u < 7; u++) {
        const uy = 12 + u * 11;
        c.box(46, 8, 2, x, uy, z + face * 16.5, 0x0d1220);
        for (let p = 0; p < 6; p++) c.lit(3, 3, 1, x - 18 + p * 7.2, uy, z + face * 17.5, (p + u) % 3 ? led : 0x4ade80);
    }
    // fibre jumpers spilling out of the side, colour-coded by carrier
    for (let f = 0; f < 4; f++) {
        c.box(3, 60, 3, x + 22 - f * 3, 48, z + face * 19, [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15][f]);
    }
}

export const BACKBONE = {
    id: 'backbone',
    theme(b, f, th) {
        th.cat = 'backbone';
        th.dim = true;
        const moods = [
            [0x123a44, 0x08222a, 0x0e5566, 0x22d3ee, '#22d3ee'],   // meet-me
            [0x0f3040, 0x061a24, 0x0e4a60, 0x38bdf8, '#38bdf8'],   // peering
            [0x1a2430, 0x0a1018, 0x243244, 0xfacc15, '#facc15'],   // cross-connect
            [0x1a1420, 0x0c0810, 0x2a1c26, 0xef4444, '#ef4444'],   // war room
            [0x1c2030, 0x0c1018, 0x2a3040, 0xf97316, '#f97316'],   // cache
            [0x18202c, 0x080c14, 0x263040, 0xa855f7, '#a855f7']    // dish control
        ];
        const m = moods[Math.max(0, Math.min(moods.length - 1, f))];
        th.wall = m[0]; th.ceil = m[1]; th.floor = m[2]; th.lamp = m[3]; th.accent = m[4];
    },
    floors: [
        // ── 0 · MEET-ME ROOM ────────────────────────────────────────────────
        {
            key: 'meetme', label: 'MEET-ME ROOM',
            build(c) {
                // two aisles of patch bays facing each other across a cable ladder
                for (let i = 0; i < 6; i++) {
                    patchBay(c, -160 + i * 78, -130, 1, 0x22d3ee);
                    patchBay(c, -160 + i * 78, 30, -1, 0x4ade80);
                }
                for (const lz of [-130, 30]) {
                    c.box(c.W - 100, 6, 18, -35, 92, lz, 0x2a3644);
                    c.lit(c.W - 120, 1.5, 3, -35, 95, lz, 0x22d3ee);
                }
                // overhead fibre runway between the aisles
                c.box(c.W - 60, 5, 44, 0, c.H - 20, -50, 0x1e2c38);
                for (let i = 0; i < 10; i++) c.box(c.W - 80, 2.5, 2.5, 0, c.H - 24, -66 + i * 4, [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15][i % 4]);
                // carrier board: who is present in the facility
                c.plate(panelTex({
                    w: 640, h: 256, bg: '#04121a', accent: '#22d3ee', grid: true,
                    title: 'PRESENT IN FACILITY', titleSize: 30,
                    lines: ['+812 ASNs · 12.4 Tbps peak', '~route servers: 2 of 2 up',
                        '+cross-connects: 3,104 live', '!capacity: cage 7 full'], lineSize: 22
                }), 240, 96, 0, 66, -c.D / 2 + c.WALL / 2 + 3);
                // ESD mat and tools by the door
                c.box(90, 1.6, 60, 200, 1, 160, 0x0e5566);
                P.cabinet(c, 250, 90, 40, 60, 26, 0x2a3644, 3);
                c.npc(c, -150, 150, { name: 'IX Operator', role: 'Meet-Me Room', color: 0x22d3ee }, -1);
                c.npc(c, 60, 150, { name: 'Patch Tech', role: 'Cross-Connects', color: 0xfacc15 }, -1);
            }
        },
        // ── 1 · PEERING HALL ────────────────────────────────────────────────
        {
            key: 'peering', label: 'PEERING HALL',
            build(c) {
                // caged customer suites, each with its own mesh door
                for (let i = 0; i < 4; i++) {
                    const x = -155 + i * 125;
                    for (const s of [-1, 1]) c.box(6, 84, 6, x + s * 55, 42, -70, 0x64748b);
                    c.box(116, 6, 6, x, 84, -70, 0x64748b);
                    for (let m = 0; m < 9; m++) c.lit(1.6, 76, 1.6, x - 50 + m * 12.5, 42, -46, 0x7c8894);
                    P.rack(c, x - 26, -100, 0x4ade80, 44, 78, 32, 1);
                    P.rack(c, x + 26, -100, 0x38bdf8, 44, 78, 32, 1);
                    c.plate(panelTex({
                        w: 256, h: 96, bg: '#061620', accent: '#38bdf8', align: 'center',
                        title: 'CAGE ' + (i + 1), titleSize: 26, lines: ['~AS' + (13335 + i * 977)], lineSize: 18, padTop: 30
                    }), 58, 22, x, 92, -46);
                }
                // route-server console island
                c.box(220, 32, 80, 20, 16, 90, 0x14202c); c.solid(20, 90, 220, 80);
                c.box(226, 4, 86, 20, 34, 90, 0x1e2c3a);
                for (let i = -2; i <= 2; i++) {
                    P.screen(c, 20 + i * 44, 56, 62, 36, 26, [0x38bdf8, 0x4ade80][(i + 2) % 2], 2.5, 1);
                    P.chair(c, 20 + i * 44, 138, 0x334155, 1);
                }
                c.plate(panelTex({
                    w: 640, h: 224, bg: '#04121a', accent: '#38bdf8', grid: true,
                    title: 'BGP SESSIONS', titleSize: 30,
                    lines: ['+established 1,806', '~idle 4', '!flapping AS64512 — damping applied'], lineSize: 22
                }), 240, 84, 20, 66, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, -220, 130, { name: 'Peering Eng', role: 'Peering Hall', color: 0x4ade80 }, -1);
            }
        },
        // ── 2 · CROSS-CONNECT VAULT ─────────────────────────────────────────
        {
            key: 'crossconnect', label: 'CROSS-CONNECT VAULT',
            build(c) {
                // trunk bundles entering through the vault wall
                const cols = [0x22d3ee, 0x4ade80, 0xfacc15, 0xf43f5e, 0x8b5cf6];
                for (let i = 0; i < 5; i++) {
                    const y = 22 + i * 14;
                    c.box(c.W - 60, 11, 11, 0, y, -150, 0x1a1f2a);
                    c.lit(c.W - 80, 4, 4, 0, y, -144, cols[i]);
                    for (const bx of [-180, -40, 100, 230]) c.box(18, 16, 16, bx, y, -150, 0x2a3242);
                }
                // splice trays on benches down the middle
                for (let i = 0; i < 3; i++) {
                    const x = -110 + i * 155;
                    c.box(140, 30, 60, x, 15, 20, 0x1a2540); c.solid(x, 20, 140, 60);
                    c.box(146, 4, 66, x, 32, 20, 0x243050);
                    for (let f = 0; f < 6; f++) c.lit(9, 3, 9, x - 55 + f * 22, 35, 20, cols[f % 5]);
                    c.lit(60, 8, 2, x, 52, -8, 0xfacc15);
                }
                // the vault door and the humidity/temp readout
                c.box(150, 84, 18, -180, 42, c.D / 2 - 40, 0x2a3242); c.solid(-180, c.D / 2 - 40, 150, 18);
                c.box(40, 40, 10, -180, 44, c.D / 2 - 50, 0x64748b);
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#0a0f18', accent: '#facc15',
                    title: 'VAULT CONDITIONS', titleSize: 30,
                    lines: ['+22.1 °C  ·  41% RH', '~bend radius audit due', '!tray 14 — unlabelled jumper'], lineSize: 22
                }), 190, 84, 90, 62, -c.D / 2 + c.WALL / 2 + 3);
                for (let i = 0; i < 4; i++) P.barrel(c, 240, -60 + i * 60, 0x2a3242);   // spare fibre drums
                c.npc(c, 20, 130, { name: 'Splice Tech', role: 'Cross-Connect Vault', color: 0xfacc15 }, -1);
            }
        },
        // ── 3 · NOC WAR ROOM ────────────────────────────────────────────────
        {
            key: 'noc', label: 'NOC WAR ROOM',
            build(c) {
                // the video wall: four panels of everything on fire
                const walls = [
                    { t: 'TRAFFIC', l: ['+12.4 Tbps', '~peak 14.1', '+headroom 18%'] },
                    { t: 'INCIDENTS', l: ['!P1 · cable cut, EAST', '~P3 · cache miss spike', '+P4 · resolved'] },
                    { t: 'LATENCY', l: ['+p50  4.1 ms', '~p95 18.7 ms', '!p99 91.2 ms'] },
                    { t: 'ROUTES', l: ['+1,806 sessions', '!2 withdrawn', '~damping active'] }
                ];
                for (let i = 0; i < 4; i++) {
                    const x = -195 + i * 130;
                    c.box(120, 82, 5, x, 58, -c.D / 2 + c.WALL / 2 + 4, 0x0a0a12);
                    c.plate(panelTex({
                        w: 384, h: 256, bg: '#05070e', accent: '#ef4444', grid: true,
                        title: walls[i].t, titleSize: 28, lines: walls[i].l, lineSize: 21
                    }), 112, 74, x, 58, -c.D / 2 + c.WALL / 2 + 7);
                }
                c.lit(c.W - 60, 2, 3, 0, 104, -c.D / 2 + 20, 0xef4444);
                // tiered operator desks facing the wall
                for (let row = 0; row < 2; row++) {
                    const z = -40 + row * 80, h = row ? 12 : 0;
                    // the back tier is a low riser you step onto — no collider,
                    // or it would wall the room in half
                    if (row) c.box(c.W - 160, h, 74, 30, h / 2, z, 0x1a1420);
                    for (let i = 0; i < 4; i++) {
                        const x = -130 + i * 110;
                        c.box(100, 30, 50, x, h + 15, z, 0x24202c); c.solid(x, z, 100, 50);
                        c.box(106, 4, 56, x, h + 32, z, 0x342c3a);
                        P.screen(c, x, h + 48, z - 22, 40, 24, row ? 0xef4444 : 0x38bdf8, 2.2, 1);
                        P.chair(c, x, z + 44, 0x3a3040, 1);
                    }
                }
                // incident bridge phone and the escalation whiteboard
                c.box(50, 26, 40, 240, 13, -140, 0x2a2230); c.solid(240, -140, 50, 40);
                c.lit(30, 4, 1, 240, 28, -120, 0xef4444);
                c.plate(panelTex({
                    w: 512, h: 288, bg: '#f4f2ee', accent: '#ef4444', grid: true, gridColor: 'rgba(90,90,110,0.15)',
                    title: 'ESCALATION', titleSize: 28, titleColor: '#241a1a', lineColor: '#33282c',
                    lines: ['!P1 → IC + comms in 5 min', '~P2 → on-call lead',
                        '+P3 → ticket, next business day', 'bridge: 4412'], lineSize: 21
                }), 130, 74, c.W / 2 - c.WALL / 2 - 5, 56, 90, -Math.PI / 2);
                c.npc(c, -230, 150, { name: 'NOC Lead', role: 'Incident Commander', color: 0x22d3ee }, -1);
                c.npc(c, -60, 150, { name: 'SRE', role: 'On Call', color: 0xef4444 }, -1);
                c.npc(c, 130, 150, { name: 'Analyst', role: 'Traffic Analysis', color: 0x94a3b8 }, -1);
            }
        },
        // ── 4 · CACHE FLOOR ─────────────────────────────────────────────────
        {
            key: 'cache', label: 'CACHE FLOOR',
            build(c) {
                // hot/cold aisle containment — the floor is nothing but racks
                for (let row = 0; row < 3; row++) {
                    const z = -140 + row * 100;
                    for (let i = 0; i < 7; i++) P.rack(c, -175 + i * 68, z, [0xf97316, 0x4ade80, 0x38bdf8][(i + row) % 3], 62, 86, 34, 1);
                    c.box(c.W - 60, 6, 16, 0, 92, z, 0x2a3040);           // cable tray
                    c.lit(c.W - 90, 1.5, 4, 0, 95, z, 0xf97316);
                    c.lit(c.W - 100, 1.2, 10, 0, 1.2, z + 50, 0x0ea5e9);  // cold aisle marker
                }
                // containment curtains at the aisle ends
                for (const s of [-1, 1]) for (let row = 0; row < 3; row++) {
                    c.box(6, 76, 44, s * 258, 38, -140 + row * 100, 0x3a4250);
                }
                // CRAC units and the PDU column
                for (const cx of [-250, 250]) {
                    c.box(40, 82, 46, cx, 41, 192, 0x475569); c.solid(cx, 192, 40, 46);
                    c.lit(24, 8, 1, cx, 66, 214, 0x22d3ee);
                }
                c.box(28, c.H - 8, 28, 20, c.H / 2, 190, 0x2a3040); c.solid(20, 190, 28, 28);
                for (let i = 0; i < 8; i++) c.lit(6, 4, 1, 20, 20 + i * 9, 205, i % 4 ? 0x4ade80 : 0xf97316);
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#0d1018', accent: '#f97316',
                    title: 'EDGE CACHE', titleSize: 30,
                    lines: ['+hit ratio 94.2%', '~origin fetches 5.8%', '+purge queue empty', '!disk 88% on shelf 3'], lineSize: 22
                }), 200, 88, -120, 62, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, 130, 200, { name: 'Cache Ops', role: 'Edge Compute', color: 0xf97316 }, -1);
            }
        },
        // ── 5 · DISH CONTROL ────────────────────────────────────────────────
        {
            key: 'dish', label: 'DISH CONTROL',
            build(c) {
                // three tracking dishes seen through the control-room glazing
                for (let i = 0; i < 3; i++) {
                    const x = -160 + i * 160;
                    c.box(50, 14, 50, x, 7, -150, 0x334155); c.solid(x, -150, 50, 50);
                    c.box(18, 40, 18, x, 34, -150, 0x64748b);
                    // dish face built from narrowing slabs so it reads as a bowl
                    for (let r = 0; r < 5; r++) {
                        const w = 76 - r * 13;
                        c.box(w, 6, 12 - r, x, 58 + r * 6, -150 + r * 2, 0xcbd5e1);
                    }
                    c.box(6, 24, 6, x, 92, -138, 0x94a3b8);
                    c.lit(9, 9, 9, x, 104, -138, 0xf97316);               // feed horn
                    c.lit(4, 4, 4, x, 112, -150, 0xef4444);               // aviation lamp
                }
                c.box(c.W - 40, 6, 6, 0, 96, -100, 0x2a3040);
                c.lit(c.W - 60, 1.5, 2, 0, 99, -100, 0xa855f7);
                // control consoles facing the dishes
                for (let i = 0; i < 4; i++) {
                    const x = -130 + i * 110;
                    c.box(100, 32, 56, x, 16, 40, 0x263040); c.solid(x, 40, 100, 56);
                    c.box(106, 4, 62, x, 34, 40, 0x333f52);
                    P.screen(c, x, 52, 12, 42, 26, [0xa855f7, 0x38bdf8, 0x4ade80, 0xa855f7][i], 2.4, 1);
                    P.chair(c, x, 92, 0x334155, 1);
                }
                // pass-schedule board and the sky view
                c.plate(panelTex({
                    w: 512, h: 256, bg: '#080a16', accent: '#a855f7', grid: true,
                    title: 'PASS SCHEDULE', titleSize: 30,
                    lines: ['+LEO-4471  AOS 00:41  12°', '~LEO-2210  AOS 01:07  38°',
                        '!GEO-11    keyhole conflict', '+downlink 8.2 Gbps'], lineSize: 21
                }), 200, 100, 130, 62, c.D / 2 - c.WALL / 2 - 6, Math.PI);
                c.plate(vistaTex('city', '#a855f7'), 84, 84, -140, 60, c.D / 2 - c.WALL / 2 - 6, Math.PI);
                P.rack(c, 250, 130, 0xa855f7, 50, 84, 34, -1);
                c.npc(c, -240, 150, { name: 'Sat Ops', role: 'Dish Control', color: 0xa855f7 }, -1);
                c.npc(c, 30, 160, { name: 'RF Engineer', role: 'Link Budget', color: 0x64748b }, -1);
            }
        }
    ]
};
