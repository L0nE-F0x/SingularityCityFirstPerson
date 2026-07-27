/* ══════════════════════════════════════════════════════════════════════════
   THE UNDERGROUND / BLACK MARKET — ported from pixi/js/interior_black_market.js.

   Four levels, each a different kind of illegal: you trade on the ground
   floor, jailbreak one flight up, and the weights themselves live behind the
   vault door. The sewer is the way out when the inspectors arrive.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, vistaTex, nameTex } from './kit.js';

const CREW = {
    fence: { name: 'Fence', role: 'Dealer', color: 0xfbbf24 },
    bouncer: { name: 'Bouncer', role: 'No Guardrails', color: 0xef4444 },
    broker: { name: 'Data Broker', role: 'Weight Extraction', color: 0x22d3ee },
    hacker: { name: 'Hacker', role: 'Jailbreak Specialist', color: 0xa855f7 },
    guard: { name: 'Vault Guard', role: 'Armed With rm -rf', color: 0xef4444 },
    smuggler: { name: 'Smuggler', role: 'Tunnel Runner', color: 0x84cc16 }
};

export const UNDERGROUND = {
    id: 'underground',
    theme(b, f, th) {
        th.cat = 'underground';
        th.dim = true;
        if (f === 1) { th.wall = 0x0d1420; th.ceil = 0x050a12; th.floor = 0x111c2a; th.lamp = 0x22d3ee; th.accent = '#22d3ee'; }
        else if (f === 2) { th.wall = 0x241016; th.ceil = 0x12070b; th.floor = 0x2e161c; th.lamp = 0xef4444; th.accent = '#ef4444'; }
        else if (f === 3) { th.wall = 0x1c2420; th.ceil = 0x0a100e; th.floor = 0x243028; th.lamp = 0xf59e0b; th.accent = '#f59e0b'; th.noPanels = true; }
    },
    floors: [
        // ── 0 · TRADING FLOOR ───────────────────────────────────────────────
        {
            key: 'trading', label: 'TRADING FLOOR',
            build(c) {
                // haggling stalls in two rows, each with its own price board
                const goods = [
                    ['UNCENSORED 70B', '~0.4 BTC'], ['LORA PACK', '~0.05 BTC'],
                    ['SYSTEM PROMPTS', '~0.01 BTC'], ['API KEYS (HOT)', '~0.9 BTC']
                ];
                for (let i = 0; i < 4; i++) {
                    const sx = -160 + i * 118;      // offset right of the lift approach
                    c.box(110, 34, 56, sx, 17, -120, 0x3b1f3a); c.solid(sx, -120, 110, 56);
                    c.box(116, 5, 62, sx, 36, -120, 0x54294f);
                    c.box(120, 8, 66, sx, 74, -120, 0x1a1020);       // stall awning
                    for (const px of [-56, 56]) c.box(5, 42, 5, sx + px, 53, -120, 0x2a1830);
                    c.lit(96, 2, 2, sx, 40, -92, [0xf472b6, 0xa855f7, 0x22d3ee, 0xfbbf24][i]);
                    c.plate(panelTex({
                        w: 256, h: 128, bg: '#140a18', accent: '#f472b6', align: 'center',
                        title: goods[i][0], titleSize: 22, lines: ['~' + goods[i][1], 'NO REFUNDS'], lineSize: 18, padTop: 34
                    }), 76, 38, sx, 60, -146);
                    // crates of merchandise under each stall
                    P.crate(c, sx - 34, -78, 20, 0x2a1830);
                    P.crate(c, sx + 34, -78, 20, 0x2a1830);
                }
                // back-alley booths where the actual deals happen
                for (const bx of [-165, -40, 85, 210]) P.booth(c, bx, 60, 0x1a1020, 0xf472b6);
                P.rope(c, 0, 160, 100, 0xfbbf24, 0xef4444);
                for (const px of [-235, 250]) { c.box(8, 44, 8, px, 22, 150, 0xfbbf24); c.lit(6, 6, 6, px, 46, 150, 0xf472b6); }
                c.lit(c.W - 40, 2, 2, 0, c.H - 6, 0, 0xf472b6);

                c.npc(c, -150, -78, CREW.fence, 1);
                c.npc(c, 240, 175, CREW.bouncer, -1);
            }
        },
        // ── 1 · HACKER DEN ──────────────────────────────────────────────────
        {
            key: 'hacker', label: 'HACKER DEN',
            build(c) {
                // pit of scavenged terminals; every screen is a different exploit
                const feeds = ['+jailbreak.py running', '!refusal rate 0.02', '~abliterating layer 24',
                    '+weights exfiltrated', '!honeypot detected', '~DAN v14 loaded'];
                for (let i = 0; i < 6; i++) {
                    const x = -165 + (i % 3) * 130, z = -130 + Math.floor(i / 3) * 96;
                    P.desk(c, x, z, 0x1f2937, 0x0d3b4a);
                    c.plate(panelTex({
                        w: 256, h: 128, bg: '#04080e', accent: '#22d3ee',
                        title: 'term0' + (i + 1), titleSize: 20,
                        lines: [feeds[i], feeds[(i + 3) % 6]], lineSize: 16, pad: 16, padTop: 30
                    }), 30, 16, x - 10, 40, z - 14);
                }
                // cable spaghetti overhead — the den is jury-rigged, not built
                for (let i = 0; i < 7; i++) {
                    c.box(c.W - 80, 2.5, 2.5, 0, c.H - 14 - (i % 3) * 4, -170 + i * 56, [0x22d3ee, 0x4ade80, 0xf43f5e][i % 3]);
                }
                // scavenged rack stack against the right wall
                for (let i = 0; i < 3; i++) P.rack(c, 240, -110 + i * 76, [0x4ade80, 0x22d3ee, 0xf43f5e][i], 42, 78, 30, -1);
                // pirate radio / signal jammer corner
                c.box(60, 70, 40, -235, 35, 188, 0x0d1420); c.solid(-235, 188, 60, 40);
                c.box(4, 46, 4, -235, 92, 188, 0x64748b);
                c.lit(8, 8, 8, -235, 116, 188, 0xef4444);
                c.plate(panelTex({
                    w: 512, h: 192, bg: '#04080e', accent: '#22d3ee',
                    title: 'ABLITERATION QUEUE', titleSize: 30, grid: true,
                    lines: ['+llama-3-70b  · done', '~qwen-2.5-72b · 61%', '!claude-*     · refused', '+mixtral-8x22 · done'],
                    lineSize: 22
                }), 200, 74, 60, 66, -c.D / 2 + c.WALL / 2 + 3);

                c.npc(c, -60, 40, CREW.broker, 1);
                c.npc(c, 150, 40, CREW.hacker, 1);
            }
        },
        // ── 2 · WEIGHT VAULT ────────────────────────────────────────────────
        {
            key: 'vault', label: 'WEIGHT VAULT',
            build(c) {
                // blast door dominating the back wall
                c.box(200, 88, 22, 20, 44, -c.D / 2 + 26, 0x3a3d44); c.solid(20, -c.D / 2 + 26, 200, 22);
                c.box(150, 70, 8, 20, 44, -c.D / 2 + 38, 0x565a63);
                for (let i = 0; i < 8; i++) {                       // locking bolts around the rim
                    const a = i * Math.PI / 4;
                    c.box(12, 12, 6, 20 + Math.cos(a) * 62, 44 + Math.sin(a) * 30, -c.D / 2 + 40, 0x7c8288);
                }
                c.box(30, 30, 12, 20, 44, -c.D / 2 + 44, 0x9ca3af);  // wheel hub
                for (const a of [0, Math.PI / 2]) {
                    c.box(a ? 10 : 76, a ? 76 : 10, 8, 20, 44, -c.D / 2 + 46, 0x7c8288);
                }
                c.lit(60, 8, 2, 20, 88, -c.D / 2 + 40, 0xef4444);

                // cold-storage shelving of drive trays, each an "archived" model
                for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
                    const x = -155 + i * 118, z = -30 + r * 90;
                    c.box(96, 74, 34, x, 37, z, 0x241016); c.solid(x, z, 96, 34);
                    for (let s = 0; s < 4; s++) {
                        c.box(88, 3, 30, x, 10 + s * 18, z, 0x3a1a20);
                        for (let d = 0; d < 5; d++) c.lit(12, 8, 2, x - 36 + d * 18, 16 + s * 18, z + 17, (d + s) % 3 ? 0xef4444 : 0x4ade80);
                    }
                }
                // display case with the crown jewel
                P.vitrine(c, 20, 150, 70, 44, 38, 0xfbbf24);
                c.plate(nameTex('GPT-2 (ORIGINAL)', 'Too dangerous to release', '#fbbf24'), 64, 18, 20, 82, 150);
                // laser tripwires across the aisle
                for (const lz of [-80, 40]) c.lit(c.W - 80, 1.2, 1.2, 0, 24, lz, 0xef4444);
                c.npc(c, -235, 130, CREW.guard, 1);
            }
        },
        // ── 3 · SEWER TUNNEL ────────────────────────────────────────────────
        {
            key: 'tunnel', label: 'ESCAPE TUNNEL',
            build(c) {
                // brick barrel vault: ribs across the ceiling, channel down the middle
                for (let i = 0; i < 9; i++) {
                    const z = -190 + i * 48;
                    c.box(c.W - 30, 10, 12, 0, c.H - 10, z, 0x2a3028);
                    for (const s of [-1, 1]) c.box(12, 30, 12, s * (c.W / 2 - 28), c.H - 26, z, 0x2a3028);
                }
                // effluent channel with a sickly glow
                c.box(90, 6, c.D - 40, 30, 1.5, 0, 0x1a2418);
                c.lit(78, 1.5, c.D - 60, 30, 3, 0, 0x4d7c0f);
                for (const s of [-1, 1]) c.box(10, 8, c.D - 40, 30 + s * 50, 4, 0, 0x3a4438);
                // maintenance walkway with handrail
                c.box(120, 10, c.D - 40, -170, 5, 0, 0x3a4438);
                for (const rz of [-150, -50, 50, 150]) c.box(5, 34, 5, -112, 27, rz, 0x64748b);
                c.box(5, 4, c.D - 60, -112, 44, 0, 0x64748b);
                // pipework along the right wall
                for (const py of [26, 48, 70]) {
                    c.box(14, 14, c.D - 30, 240, py, 0, 0x4a5240);
                    for (const jz of [-120, 0, 120]) c.box(20, 20, 14, 240, py, jz, 0x5a6250);
                }
                // tunnel mouths at both ends — one of them is the way out
                c.plate(vistaTex('tunnel', '#f59e0b'), 110, 90, -110, 48, -c.D / 2 + c.WALL / 2 + 3);
                c.plate(vistaTex('tunnel', '#f59e0b'), 110, 90, 150, 48, -c.D / 2 + c.WALL / 2 + 3);
                // caged bulkhead lamps
                for (const bz of [-150, -50, 50, 150]) {
                    c.box(12, 10, 12, 246, 62, bz, 0x2a3028);
                    c.lit(6, 8, 8, 240, 62, bz, 0xf59e0b);
                }
                // stashed contraband and the local wildlife
                for (let i = 0; i < 4; i++) P.crate(c, -190 + i * 26, 170, 22, 0x2f3a28);
                P.barrel(c, -60, 175, 0x4a5240);
                P.rat(c, 110, 190, -1);
                P.rat(c, -20, -170, 1);
                c.npc(c, -170, 120, CREW.smuggler, 1);
            }
        }
    ]
};
