/* ══════════════════════════════════════════════════════════════════════════
   ALIGNMENT FOREST CABINS — ported from pixi/js/interior_alignment.js.

   Two floors: a reading room built around a crackling hearth, and a loft
   whose whiteboard carries that institute's actual research programme. The
   whiteboard is the whole point — MIRI's embedded agency and Apollo's
   scheming evals should not be the same board in a different colour, so the
   copy is data, not decoration.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, vistaTex } from './kit.js';

export const INSTITUTES = {
    align_miri: {
        tag: 'MIRI', accent: 0x22d3ee,
        board: 'EMBEDDED AGENCY',
        lines: ['~Agent ⊆ Environment', 'Corrigibility vs optimality',
            'Logical induction', '+Decision-theoretic self-reference', '!avoid wireheading'],
        corkboard: ['Tiling agents draft', 'Reflective oracles', 'Naturalized induction'],
        lead: 'Decision Theorist'
    },
    align_metr: {
        tag: 'METR', accent: 0xa78bfa,
        board: 'DANGEROUS CAPABILITY EVALS',
        lines: ['~Autonomous replication  18%', 'Cyber-offense          34%',
            'Self-exfiltration      12%', '+Resource acquisition   27%', '!elicitation ceiling?'],
        corkboard: ['Pre-deployment gate', 'Task suite v3', 'Uplift study'],
        lead: 'Eval Engineer'
    },
    align_apollo: {
        tag: 'APOLLO', accent: 0xef4444,
        board: 'IN-CONTEXT SCHEMING',
        lines: ['~Model knows it is evaluated', 'Goal: preserve values long-term',
            'Action: strategic underperformance', '+evidence in CoT (redacted)', '!DECEPTIVE ALIGNMENT'],
        corkboard: ['Sandbagging transcripts', 'Oversight subversion', 'Trace forensics'],
        lead: 'Scheming Researcher'
    },
    align_redwood: {
        tag: 'REDWOOD', accent: 0x34d399,
        board: 'AI CONTROL PROTOCOLS',
        lines: ['~ASSUME the model may subvert', 'Untrusted monitor -> trusted audit',
            'Red-team vs deployment', '+safety despite subversion', 'Causal scrubbing: pass'],
        corkboard: ['Control eval harness', 'Trusted editing', 'Blue-team protocol'],
        lead: 'Control Researcher'
    },
    align_far: {
        tag: 'FAR AI', accent: 0xfbbf24,
        board: 'ADVERSARIAL ROBUSTNESS',
        lines: ['~KataGo: superhuman, defeated', 'Adversarial policy wins 99%',
            'RLHF re-jailbroken in 10 shots', '+alignment != robustness', '!multi-agent fragility'],
        corkboard: ['Adversarial training runs', 'Go exploit replication', 'Robustness gap memo'],
        lead: 'Robustness Researcher'
    }
};

function inst(b) {
    return INSTITUTES[b?.id] || {
        tag: String(b?.name || 'RESEARCH').toUpperCase().slice(0, 10), accent: 0x86efac,
        board: 'SAFETY RESEARCH', lines: ['~Thinking about it', 'Slowly'],
        corkboard: ['Reading group', 'Grant report'], lead: 'Researcher'
    };
}

export const ALIGNMENT = {
    id: 'alignment',
    theme(b, f, th) {
        const k = inst(b);
        th.cat = 'alignment';
        th.accent = '#' + k.accent.toString(16).padStart(6, '0');
        th.dim = true;
        if (f === 1) {                        // loft: bare timber under the roof
            th.wall = 0x4a3a28; th.ceil = 0x2e2418; th.floor = 0x6b5136;
            th.lamp = 0xffe0a0; th.noPanels = true;
        } else {
            th.wall = 0x3a3226; th.ceil = 0x241d14; th.floor = 0x4a3a28; th.lamp = 0xffd9a0;
        }
    },
    floors: [
        // ── 0 · READING ROOM ────────────────────────────────────────────────
        {
            key: 'reading', label: 'READING ROOM',
            build(c) {
                const k = inst(c.b);
                const accCss = '#' + k.accent.toString(16).padStart(6, '0');
                // exposed roof structure — the cabin's whole character
                for (let i = 0; i < 7; i++) c.box(c.W - 40, 9, 9, 0, c.H - 12, -180 + i * 62, 0x5c4033);
                c.box(14, 14, c.D - 40, 0, c.H - 4, 0, 0x4a3320);

                // the hearth, and everything arranged to face it
                P.fireplace(c, 20, -c.D / 2 + 42, 150, 0x6b6257);
                c.box(230, 1.8, 170, 20, 1, -70, 0x6b3a2a);
                for (const [ax, az, fc] of [[-80, -70, 1], [120, -70, 1], [20, 10, -1]]) {
                    c.box(52, 20, 50, ax, 10, az, 0x7c4432); c.solid(ax, az, 52, 50);
                    c.box(52, 36, 11, ax, 32, az - fc * 20, 0x8b5040);
                    for (const s of [-1, 1]) c.box(9, 20, 44, ax + s * 22, 26, az, 0x8b5040);
                }
                P.table(c, 20, -70, 70, 46, 0x5c4033, 22);
                c.lit(9, 6, 9, 20, 34, -70, 0xffe4ac);            // tea, still hot
                // log basket + fire irons
                c.box(30, 22, 30, -80, 11, -160, 0x4a3520); c.solid(-80, -160, 30, 30);
                for (let i = 0; i < 4; i++) c.box(26, 8, 8, -80, 20 + (i % 2) * 8, -160 + (i - 1.5) * 7, 0x6b5136);

                // bookshelves on the right wall and along the back — the left
                // wall is the lift bank, which every interior keeps clear
                for (let i = 0; i < 4; i++) P.bookshelf(c, c.W / 2 - 28, -140 + i * 96, 92, 82, 26, 1);
                for (const bx of [-212, -114, 190]) P.bookshelf(c, bx, -c.D / 2 + 24, 92, 82, 26, 0);
                P.bookshelf(c, -190, c.D / 2 - 32, 92, 82, 26, 0);

                // the window onto the pines — the reason you came to the forest.
                // It goes on the right wall so it never blocks the street door.
                const wx = c.W / 2 - c.WALL / 2 - 4;
                c.box(8, 104, 230, wx + 2, 52, -20, 0x5c4033);
                for (const wz of [-80, 40]) c.plate(vistaTex('pines', accCss), 96, 96, wx - 3, 54, wz, -Math.PI / 2);
                c.box(6, 104, 6, wx - 3, 52, -20, 0x4a3320);   // mullion

                // kitchen nook with the perpetual kettle, tucked by the door
                P.counter(c, -140, 188, 110, 42, 0x5c4033, 0x8a6a45, 0xffd9a0);
                c.box(20, 20, 20, -170, 50, 188, 0x9aa0a8);
                c.lit(10, 4, 10, -170, 62, 188, 0xffb020);
                // reading-group whiteboard, past the window on the same wall
                c.plate(panelTex({
                    w: 512, h: 256, bg: '#f2f1ea', accent: accCss, grid: true, gridColor: 'rgba(90,100,110,0.16)',
                    title: k.tag + ' READING GROUP', titleSize: 26, titleColor: '#243042', lineColor: '#33404f',
                    lines: k.corkboard.concat(['+tea at 16:00']), lineSize: 22
                }), 130, 66, wx - 3, 56, 160, -Math.PI / 2);

                c.npc(c, -30, 40, { name: k.tag + ' Researcher', role: k.lead, color: k.accent }, 1);
                c.npc(c, 170, 60, { name: 'Visiting Fellow', role: 'On Sabbatical', color: 0x94a3b8 }, -1);
                P.plant(c, 245, 180, 46);
            }
        },
        // ── 1 · LOFT ────────────────────────────────────────────────────────
        {
            key: 'loft', label: 'LOFT',
            build(c) {
                const k = inst(c.b);
                const accCss = '#' + k.accent.toString(16).padStart(6, '0');
                // sloped roof: stepped beams narrowing toward the ridge
                for (let i = 0; i < 6; i++) {
                    const inset = 12 + i * 22, y = c.H - 8 - i * 9;
                    for (const s of [-1, 1]) c.box(18, 8, c.D - 30, s * (c.W / 2 - inset), y, 0, 0x5c4033);
                }
                c.box(16, 12, c.D - 30, 0, c.H - 6, 0, 0x4a3320);
                for (let i = 0; i < 5; i++) c.box(c.W - 120, 7, 7, 0, c.H - 34, -160 + i * 80, 0x5c4033);

                // THE whiteboard — institute-specific, wall-sized, unmissable
                c.box(330, 130, 6, 10, 62, -c.D / 2 + c.WALL / 2 + 4, 0xe8e6dc);
                c.plate(panelTex({
                    w: 768, h: 384, bg: '#f6f5ef', accent: accCss, grid: true, gridColor: 'rgba(80,95,120,0.15)',
                    title: k.board, titleSize: 40, titleColor: '#1f2a3a',
                    lineColor: '#2b3648', warnColor: '#c02626', okColor: '#1f7a3f',
                    lines: k.lines, lineSize: 27, pad: 34
                }), 316, 118, 10, 62, -c.D / 2 + c.WALL / 2 + 8);
                for (const mx of [-70, 30, 90]) c.lit(12, 5, 4, mx, -2 + 6, -c.D / 2 + 22, k.accent);  // marker tray

                // terminal desk under the gable
                P.desk(c, -150, -40, 0x5c4033, 0x14324a);
                c.plate(panelTex({
                    w: 384, h: 192, bg: '#050a12', accent: accCss,
                    title: 'run.log', titleSize: 22,
                    lines: ['+seed 0 · converged', '~seed 1 · 4.2e3 steps', '!seed 2 · diverged'], lineSize: 18, pad: 20
                }), 40, 20, -160, 40, -54);
                // corkboard of pinned papers
                c.box(150, 90, 4, c.W / 2 - c.WALL / 2 - 5, 56, -60, 0x8a6a3a);
                c.plate(panelTex({
                    w: 384, h: 256, bg: '#c9a86a', accent: '#7a5a2a', frame: true,
                    title: 'PINNED', titleSize: 26, titleColor: '#3a2a12', lineColor: '#2e2412',
                    lines: k.corkboard, lineSize: 22
                }), 130, 84, c.W / 2 - c.WALL / 2 - 8, 56, -60, -Math.PI / 2);

                // dormer window, more pines
                c.plate(vistaTex('pines', accCss), 80, 80, 200, 54, c.D / 2 - c.WALL / 2 - 8, Math.PI);
                c.box(92, 92, 6, 200, 54, c.D / 2 - c.WALL / 2 - 5, 0x5c4033);

                // floor cushions, book stacks, a leaning second board
                for (const [cx, cz] of [[60, 60], [110, 90], [30, 110]]) {
                    c.box(40, 12, 40, cx, 6, cz, 0x6b3a2a); c.solid(cx, cz, 40, 40);
                }
                for (let i = 0; i < 5; i++) c.box(24, 6, 18, -120 + (i % 2) * 10, 3 + i * 6, 120, [0x9a3a3a, 0x3a5a9a, 0x3a7a4a][i % 3]);
                c.box(120, 4, 84, -230, 44, 90, 0xe8e6dc);
                c.lit(9, 40, 9, 230, 24, 150, 0xffe0a0);
                c.npc(c, -60, -60, { name: k.tag + ' Lead', role: 'At the Whiteboard', color: k.accent }, 1);
            }
        }
    ]
};
