/* ══════════════════════════════════════════════════════════════════════════
   LONGEVITY WING — ported from pixi/js/interior_longevity.js.

   Five buildings, five storey lists, so one spec each (see agents.js for why).
   The wing's problem in first person is that "a lab" is the easiest room in
   the world to make generic: white walls, benches, done. So each building
   gets one piece of geometry nothing else in the city has — a folded protein
   ribbon you can walk under, a helix in a lit column, a ward of monitored
   beds, a farm of frosted dewars — and the benches are the supporting cast.

   B1 is the last lift stop rather than a negative floor, as in robotics.js.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, vistaTex } from './kit.js';
import { barsTex, logTex, metersTex, pipelineTex, cardsTex, chartTex, graphTex } from './screens.js';

const back = (c) => -c.D / 2 + c.WALL / 2 + 3;

// ── wing props ──────────────────────────────────────────────────────────────

/** Lab bench with a reagent shelf over it. The wing's workhorse. */
function bench(c, x, z, w = 130, d = 56, col = 0xdfe6ea) {
    c.box(w, 30, d, x, 15, z, 0xb8c4cc); c.solid(x, z, w, d);
    c.box(w + 6, 5, d + 6, x, 33, z, col);
    c.box(w - 10, 3, 6, x, 33, z, 0x9aa8b2);                    // sink lip
    for (const sx of [-1, 1]) c.box(4, 34, 4, x + sx * (w / 2 - 8), 50, z - d / 2 + 6, 0x8d9aa4);
    c.box(w - 8, 3, 24, x, 66, z - d / 2 + 6, col);              // shelf
    c.box(w - 8, 3, 24, x, 52, z - d / 2 + 6, col);
}

/** Fume hood: a lit glass box you work inside. Reads as "chemistry". */
function fumeHood(c, x, z, glow = 0x86efac, face = 1) {
    c.box(96, 82, 52, x, 41, z, 0xc8d2d8); c.solid(x, z, 96, 52);
    c.box(84, 44, 3, x, 48, z + face * 26, 0x1b2a2e);
    c.lit(78, 38, 1.2, x, 48, z + face * 27.6, glow);
    c.box(96, 7, 56, x, 86, z, 0xa8b4bc);                        // extract cowl
    c.box(20, 26, 20, x, 100, z, 0x8d9aa4);
    c.lit(70, 2, 2, x, 70, z + face * 27, 0xf8fafc);             // sash light
}

/** Upright -80 °C freezer, frost on the seal. */
function freezer(c, x, z, col = 0x7dd3fc, face = 1) {
    c.box(60, 92, 54, x, 46, z, 0xdfe6ea); c.solid(x, z, 60, 54);
    c.box(54, 84, 3, x, 46, z + face * 27.5, 0xc2ced6);
    c.lit(40, 12, 1.2, x, 78, z + face * 29, col);               // temperature readout
    c.box(20, 4, 4, x + 20, 46, z + face * 30, 0x8d9aa4);        // handle
    c.lit(52, 2, 2, x, 4, z + face * 28, 0xe0f2fe);              // frost pooling at the sill
}

/** Cryogenic dewar. Frost bands and a vapour skirt sell the temperature. */
function dewar(c, x, z, h = 78, col = 0x67e8f9) {
    c.box(52, h, 52, x, h / 2, z, 0xcbd5e1); c.solid(x, z, 52, 52);
    for (let i = 0; i < 3; i++) c.box(56, 5, 56, x, 14 + i * (h / 3.4), z, 0xe2f4fb);
    c.box(58, 8, 58, x, h + 4, z, 0x94a3b8);                     // lid clamp
    c.lit(30, 3, 30, x, h + 9, z, col);
    c.lit(20, 8, 1.4, x, h * 0.62, z + 27, col);                 // readout
    // vapour skirt: kept tight and dim, or a farm of these turns the floor
    // into one white slab and you lose the dewars in it
    c.lit(60, 1.6, 60, x, 1.4, z, 0x9fd4e2);
}

/** DNA double helix in a lit column — the genomics building's signature. */
function helix(c, x, z, h = 76, turns = 2.2, a = 0x38bdf8, b = 0xf472b6) {
    c.box(14, 5, 14, x, 2.5, z, 0x94a3b8); c.solid(x, z, 16, 16);
    const steps = 26, r = 15;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, ang = t * Math.PI * 2 * turns, y = 6 + t * h;
        const dx = Math.cos(ang) * r, dz = Math.sin(ang) * r;
        c.lit(5, 5, 5, x + dx, y, z + dz, a);
        c.lit(5, 5, 5, x - dx, y, z - dz, b);
        // base pairs every other step, drawn as a bar on the wider axis
        if (i % 2 === 0) {
            if (Math.abs(dx) > Math.abs(dz)) c.lit(Math.abs(dx) * 2, 1.6, 1.6, x, y, z + dz * 0.2, 0xe2e8f0);
            else c.lit(1.6, 1.6, Math.abs(dz) * 2, x + dx * 0.2, y, z, 0xe2e8f0);
        }
    }
    c.box(16, 4, 16, x, h + 8, z, 0x94a3b8);
}

/** Predicted protein fold: a lit backbone tracing a sine, with residue beads.
 *  The protein foundry's answer to "what does this building actually do". */
function foldRibbon(c, x, y, z, len = 200, col = 0x3b82f6, phase = 0) {
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = x - len / 2 + t * len;
        const py = y + Math.sin(t * 6.2 + phase) * 20;
        const pz = z + Math.cos(t * 4.1 + phase) * 16;
        c.lit(7, 7, 7, px, py, pz, col);
        if (i % 3 === 0) c.lit(3.5, 3.5, 3.5, px, py + 9, pz, 0xe2e8f0);
    }
}

/** Monitored trial bed with a vitals screen on a stand. */
function bedPod(c, x, z, col = 0xec4899, face = 1) {
    c.box(58, 22, 108, x, 11, z, 0xdfe6ea); c.solid(x, z, 58, 108);
    c.box(52, 8, 100, x, 26, z, 0xf1f5f9);                       // mattress
    c.box(46, 5, 22, x, 32, z - face * 38, 0xe2e8f0);            // pillow
    c.box(56, 26, 4, x, 34, z - face * 54, 0xc2ced6);            // headboard
    for (const sx of [-1, 1]) c.box(3, 18, 76, x + sx * 29, 32, z, 0xa8b4bc);   // rails
    c.box(9, 62, 9, x + 34, 31, z - face * 40, 0x94a3b8);        // monitor stand
    c.box(30, 22, 3, x + 34, 66, z - face * 40, 0x111827);
    c.lit(25, 17, 1.2, x + 34, 66, z - face * 41.6, col);
    c.lit(6, 3, 6, x - 22, 34, z - face * 46, 0x4ade80);         // pulse oximeter
}

/** Bench-top sequencer: a white box with a lit flow-cell window. */
function sequencer(c, x, z, col = 0x8b5cf6, face = 1) {
    c.box(70, 46, 54, x, 38, z, 0xe4eaee);
    c.box(74, 6, 58, x, 64, z, 0xcfd8de);
    c.box(46, 22, 3, x, 42, z + face * 27.5, 0x0f172a);
    c.lit(40, 17, 1.2, x, 42, z + face * 29, col);
    c.lit(10, 3, 1, x - 26, 58, z + face * 28, 0x4ade80);
}

/** Robotic liquid handler over a deck of microplates. */
function liquidHandler(c, x, z, col = 0x22c55e) {
    c.box(150, 26, 84, x, 13, z, 0xc8d2d8); c.solid(x, z, 150, 84);
    c.box(156, 4, 90, x, 28, z, 0xdfe6ea);
    for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) {
        const px = x - 54 + i * 36, pz = z - 18 + r * 36;
        c.box(30, 5, 22, px, 32, pz, 0x1e293b);
        for (let w = 0; w < 4; w++) c.lit(4, 1.5, 4, px - 10 + w * 7, 35, pz, [col, 0x3b82f6, 0xfbbf24, 0xef4444][(i + w + r) % 4]);
    }
    for (const sx of [-1, 1]) c.box(6, 56, 6, x + sx * 74, 56, z, 0x94a3b8);   // gantry legs
    c.box(154, 6, 12, x, 82, z, 0x94a3b8);
    c.box(24, 18, 18, x - 30, 72, z, 0x64748b);                                // pipetting head
    c.lit(18, 3, 12, x - 30, 62, z, col);
}

// ── floor kinds ─────────────────────────────────────────────────────────────

const KIND = {

    /** Generic wet lab, parameterised. Covers the floors whose 2D treatment is
     *  "benches with different glassware" — the differences that matter are on
     *  the walls and in what is standing on the bench. */
    wet(c, e) {
        for (let i = 0; i < 3; i++) fumeHood(c, -170 + i * 170, -170, e.accent, 1);
        for (let row = 0; row < 2; row++) {
            const z = -70 + row * 90;
            for (let i = 0; i < 2; i++) {
                const x = -110 + i * 220;
                bench(c, x, z, 150, 56);
                P.chair(c, x - 40, z + 46, 0x94a3b8, -1);
            }
        }
        // whatever this floor is actually doing sits on the benches
        const item = e.item || 'flask';
        for (let row = 0; row < 2; row++) for (let i = 0; i < 2; i++) {
            const x = -110 + i * 220, z = -70 + row * 90;
            for (let k = 0; k < 3; k++) {
                const px = x - 44 + k * 44;
                if (item === 'flask') {
                    c.box(13, 15, 13, px, 43, z, 0xbfeadb);
                    c.lit(10, 7, 10, px, 39, z, [0x22c55e, 0x38bdf8, 0xfbbf24][k]);
                    c.box(4, 8, 4, px, 54, z, 0xd6e6ee);
                } else if (item === 'scope') {
                    c.box(11, 24, 11, px, 48, z, 0x64748b);
                    c.box(22, 5, 18, px, 40, z + 6, 0x8d9aa4);
                    c.lit(7, 3, 7, px, 37, z + 6, 0xe0f2fe);
                } else {                                     // 'plate' — assay trays
                    c.box(28, 5, 20, px, 38, z, 0x1e293b);
                    for (let w = 0; w < 4; w++) c.lit(4, 1.6, 4, px - 9 + w * 6.5, 41, z, [0x22c55e, 0x38bdf8, 0xfbbf24, 0xef4444][(k + w) % 4]);
                }
            }
            P.screen(c, x + 56, 52, z - 26, 34, 22, e.accent, 2.2, 1);
        }
        c.plate(e.screen === 'bars'
            ? barsTex({ w: 576, h: 288, accent: e.css, title: e.title, sub: e.sub, rows: e.rows || [] })
            : logTex({ w: 576, h: 288, accent: e.css, title: e.title, sub: e.sub, lines: e.lines || [] }),
            230, 114, -20, 64, back(c));
        if (e.board) {
            c.plate(panelTex({
                w: 512, h: 256, bg: '#f4f6f4', accent: e.css, grid: true, gridColor: 'rgba(90,110,100,0.16)',
                title: e.board, titleSize: 26, titleColor: '#1f2a26', lineColor: '#333c38',
                lines: e.notes || [], lineSize: 20
            }), 160, 80, c.W / 2 - c.WALL / 2 - 5, 56, 40, -Math.PI / 2);
        }
        P.plant(c, 240, 170, 52);
        for (const s of e.staff || []) c.npc(c, s.x, s.z, s, s.f || -1);
    },

    /** STRUCTURE PREDICTION — folds hanging in the air over the workstations. */
    fold(c, e) {
        // hung low enough that you walk under them rather than past them
        for (let i = 0; i < 3; i++) {
            foldRibbon(c, -150 + i * 150, 56, -120 + i * 40, 190, [0x3b82f6, 0x22d3ee, 0x8b5cf6][i], i * 1.7);
        }
        // the wall of solved structures
        for (let i = 0; i < 4; i++) {
            const x = -180 + i * 120;
            c.box(100, 70, 8, x, 44, -c.D / 2 + 20, 0x0d1626);
            c.lit(88, 58, 1.4, x, 44, -c.D / 2 + 25, [0x102a44, 0x0e2a3a, 0x1b1d44, 0x102a44][i]);
            foldRibbon(c, x, 44, -c.D / 2 + 27, 76, [0x60a5fa, 0x22d3ee, 0xa78bfa, 0x34d399][i], i * 2.2);
        }
        for (let i = 0; i < 4; i++) {
            const x = -165 + i * 110;
            c.box(96, 30, 54, x, 15, 60, 0xc8d2d8); c.solid(x, 60, 96, 54);
            c.box(102, 4, 60, x, 32, 60, 0xdfe6ea);
            P.screen(c, x, 50, 34, 42, 26, 0x3b82f6, 2.4, 1);
            P.chair(c, x, 108, 0x94a3b8, 1);
        }
        c.plate(metersTex({
            w: 640, h: 288, accent: e.css, title: 'PREDICTION QUEUE', sub: 'AF3',
            rows: [{ label: 'monomers', v: 0.96, cap: 'done' }, { label: 'protein–ligand', v: 0.72 },
            { label: 'protein–DNA', v: 0.48 }, { label: 'disordered regions', v: 0.19, cap: 'hard' }]
        }), 230, 104, 40, 66, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -230, 140, { name: 'Structure Lead', role: 'AlphaFold 3', color: 0x3b82f6 }, 1);
        c.npc(c, 200, 150, { name: 'Modeller', role: 'Confidence Scores', color: 0x22d3ee }, -1);
    },

    /** GPU CLUSTER / FOLD FARM — the compute the ribbons are made of. */
    gpu(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) {
            P.rack(c, -195 + i * 65, -150 + row * 110, [0x3b82f6, 0x22d3ee, 0x4ade80][(i + row) % 3], 58, 88, 34, 1);
        }
        for (const z of [-150, -40]) {
            c.box(c.W - 90, 6, 16, 0, 92, z, 0x2a3644);
            c.lit(c.W - 120, 1.5, 4, 0, 95, z, 0x22d3ee);
            c.lit(c.W - 110, 1.2, 10, 0, 1.2, z + 52, 0x0ea5e9);      // cold aisle
        }
        for (const cx of [-240, 240]) {
            c.box(44, 84, 50, cx, 42, 130, 0x94a3b8); c.solid(cx, 130, 44, 50);
            c.lit(28, 8, 1.4, cx, 66, 156, 0x67e8f9);
        }
        c.box(150, 34, 60, 40, 17, 150, 0xc8d2d8); c.solid(40, 150, 150, 60);
        for (let i = 0; i < 2; i++) P.screen(c, -10 + i * 100, 54, 122, 44, 26, [0x3b82f6, 0x4ade80][i], 2.4, 1);
        c.plate(barsTex({
            w: 640, h: 320, accent: e.css, title: 'FOLD FARM', sub: 'B1',
            rows: [{ label: 'GPU util', v: 0.97 }, { label: 'queue depth', v: 0.62, col: '#fbbf24' },
            { label: 'inference/s', v: 0.81, note: '2.4k' }, { label: 'power draw', v: 0.88, note: '4.1 MW', col: '#f87171' },
            { label: 'chilled water', v: 0.44, col: '#22d3ee' }]
        }), 240, 120, 20, 64, back(c));
        c.npc(c, 190, 190, { name: 'Cluster Ops', role: 'Fold Farm', color: 0x22d3ee }, -1);
    },

    /** THERAPY PIPELINE — one lit vial plinth per real AI-bio company. */
    pipeline(c, e) {
        const cos = e.companies || [];
        const w = 460 / Math.max(1, cos.length);
        cos.forEach((co, i) => {
            const x = -230 + w / 2 + i * w;
            c.box(w - 10, 34, 56, x, 17, -110, 0xdfe6ea); c.solid(x, -110, w - 10, 56);
            c.box(w - 4, 5, 62, x, 37, -110, 0xeef3f6);
            P.vitrine(c, x, -110, w - 20, 40, 46, co.col);
            // the candidate itself: a stoppered vial glowing in the case
            c.box(13, 26, 13, x, 54, -110, 0xdbe9f0);
            c.lit(9, 15, 9, x, 50, -110, co.col);
            c.box(15, 5, 15, x, 69, -110, 0x94a3b8);
            c.plate(panelTex({
                w: 256, h: 112, bg: '#0a1420', accent: co.css, align: 'center',
                title: co.name, titleSize: 22, lines: ['~' + co.drug], lineSize: 15, padTop: 30
            }), w - 16, 30, x, 96, -78);
        });
        for (let i = 0; i < 3; i++) { P.table(c, -150 + i * 150, 60, 120, 56, 0xc8d2d8, 30); P.chair(c, -150 + i * 150, 108, 0x94a3b8, 1); }
        c.plate(pipelineTex({
            w: 768, h: 224, accent: e.css, title: 'PHASE GATES', sub: 'wing-wide',
            stages: [{ label: 'TARGET', note: '31 live' }, { label: 'LEAD', note: '12' },
            { label: 'IND', note: '5', state: 'warn' }, { label: 'PH I', note: '3' }, { label: 'PH II', note: '1' }]
        }), 250, 74, -20, 74, back(c));
        c.plate(vistaTex('city', e.css), 78, 78, c.W / 2 - c.WALL / 2 - 5, 58, 150, -Math.PI / 2);
        c.npc(c, -230, 160, { name: 'Portfolio Lead', role: 'Therapy Pipeline', color: 0x3b82f6 }, 1);
    },

    /** MOLECULAR SCREENING — a liquid-handling hall running plates all night. */
    screening(c, e) {
        for (let i = 0; i < 2; i++) liquidHandler(c, -100 + i * 200, -140, 0x22c55e);
        liquidHandler(c, 0, -20, 0x38bdf8);
        // plate hotels: towers of trays waiting their turn
        for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
            const x = sx * (170 + i * 60), z = 60;
            c.box(52, 96, 44, x, 48, z, 0xdfe6ea); c.solid(x, z, 52, 44);
            for (let s = 0; s < 9; s++) {
                c.box(46, 4, 40, x, 10 + s * 10, z, 0x1e293b);
                c.lit(34, 1.6, 30, x, 13 + s * 10, z, [0x22c55e, 0x38bdf8][(s + i) % 2]);
            }
        }
        for (let i = 0; i < 2; i++) { P.desk(c, -60 + i * 120, 130, 0xb8c4cc, 0x22c55e); }
        c.plate(barsTex({
            w: 640, h: 320, accent: e.css, title: 'HIT RATE', sub: '1.2M wells',
            rows: [{ label: 'plates run', v: 0.84, note: '9,120' }, { label: 'hits', v: 0.11, note: '1,043' },
            { label: 'confirmed', v: 0.04, note: '388', col: '#fbbf24' },
            { label: 'cytotoxic', v: 0.28, col: '#f87171' }, { label: 'reruns', v: 0.16 }]
        }), 240, 120, -20, 64, back(c));
        c.plate(panelTex({
            w: 512, h: 224, bg: '#0b1a12', accent: e.css,
            title: 'LIGHTS-OUT RUN', titleSize: 28,
            lines: ['+deck 1 · 22:00 → 06:00', '~deck 2 · reagent low', '!deck 3 · tip jam, cleared'], lineSize: 21
        }), 160, 70, c.W / 2 - c.WALL / 2 - 5, 56, 150, -Math.PI / 2);
        c.npc(c, -220, 170, { name: 'Screening Lead', role: 'HTS', color: 0x22c55e }, 1);
        c.npc(c, 210, 150, { name: 'Assay Dev', role: 'Plate QC', color: 0x38bdf8 }, -1);
    },

    /** GENERATIVE CHEMISTRY — the model that draws molecules nobody has made. */
    genchem(c, e) {
        for (let i = 0; i < 6; i++) P.rack(c, -200 + i * 78, -160, 0x22c55e, 56, 84, 32, 1);
        // a molecule graph standing in the room: nodes on posts, lit bonds
        const nodes = [[-120, 40, -40], [-40, 66, -10], [40, 44, -50], [110, 70, -10], [30, 30, 50], [-60, 52, 60]];
        for (const [nx, ny, nz] of nodes) {
            c.box(5, ny - 6, 5, nx, (ny - 6) / 2, nz, 0x94a3b8);
            c.lit(15, 15, 15, nx, ny, nz, 0x22c55e);
        }
        for (let i = 0; i < nodes.length - 1; i++) {
            const [ax, ay, az] = nodes[i], [bx, by, bz] = nodes[i + 1];
            c.lit(Math.abs(bx - ax) + 3, 2.6, 2.6, (ax + bx) / 2, (ay + by) / 2, az, 0xa7f3d0);
            c.lit(2.6, 2.6, Math.abs(bz - az) + 3, bx, (ay + by) / 2, (az + bz) / 2, 0xa7f3d0);
        }
        for (let i = 0; i < 3; i++) { P.desk(c, -140 + i * 140, 150, 0xb8c4cc, 0x22c55e); }
        c.plate(graphTex({
            w: 768, h: 320, accent: e.css, title: 'GENERATIVE LOOP', sub: 'design→make→test',
            cols: [['prior'], ['propose', 'filter'], ['synthesise', 'assay'], ['learn']]
        }), 250, 104, -20, 66, back(c));
        c.plate(logTex({
            w: 512, h: 288, accent: e.css, title: 'PROPOSALS', sub: 'last hour',
            lines: ['+412k molecules enumerated', '~1,204 pass synthesisability',
                '!62 hit the patent wall', '+18 queued for synthesis']
        }), 160, 90, c.W / 2 - c.WALL / 2 - 5, 56, 60, -Math.PI / 2);
        c.npc(c, 210, 160, { name: 'Chem AI Lead', role: 'Generative Models', color: 0x22c55e }, -1);
    },

    /** PATIENT INTAKE — a waiting room, which is what a trials centre mostly is. */
    intake(c, e) {
        P.counter(c, -110, -150, 190, 56, 0xc8d2d8, 0xe8eef2, 0xec4899);
        c.plate(panelTex({
            w: 640, h: 224, bg: '#f6eef3', accent: e.css,
            title: 'CLINICAL TRIALS CENTER', titleSize: 30, titleColor: '#3a2030', lineColor: '#443040',
            lines: ['~check in at the desk', 'bring your study card', '+interpreters available'], lineSize: 21
        }), 240, 84, -110, 74, back(c));
        // waiting rows facing each other across a low table
        for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
            const x = -170 + i * 70, z = -20 + row * 110;
            c.box(58, 16, 48, x, 8, z, 0xd9c6cf); c.solid(x, z, 58, 48);
            c.box(58, 34, 10, x, 26, z + (row ? 20 : -20), 0xc9b2be);
            c.lit(48, 1.6, 40, x, 17, z, 0xf6e6ee);
        }
        P.table(c, -20, 45, 200, 40, 0xb8a2ae, 22);
        for (let i = 0; i < 3; i++) c.box(24, 4, 30, -80 + i * 60, 26, 45, 0xf1f5f9);   // leaflets
        // the calling screen and a play corner, because families wait too
        P.screen(c, 170, 62, -150, 74, 44, 0xec4899, 3, 1);
        c.box(90, 6, 80, 200, 3, 120, 0xf9a8d4); c.solid(200, 120, 90, 80);
        for (let i = 0; i < 4; i++) c.box(20, 20, 20, 175 + (i % 2) * 40, 14, 100 + Math.floor(i / 2) * 38, [0x60a5fa, 0xfbbf24, 0x4ade80, 0xf472b6][i]);
        P.plant(c, -240, 130, 62); P.plant(c, 245, -60, 62);
        c.npc(c, -110, -110, { name: 'Study Coordinator', role: 'Intake', color: 0xec4899 }, 1);
        c.npc(c, 60, 160, { name: 'Nurse', role: 'Screening', color: 0x38bdf8 }, -1);
    },

    /** PHASE I — a small, heavily monitored unit. Safety is the whole point. */
    phase1(c, e) {
        for (let i = 0; i < 4; i++) bedPod(c, -180 + i * 120, -100, 0xec4899, 1);
        for (let i = 0; i < 4; i++) {                                   // privacy curtain rails
            c.box(92, 4, 4, -180 + i * 120, 78, -100, 0x94a3b8);
            for (const sx of [-1, 1]) c.box(4, 4, 116, -180 + i * 120 + sx * 44, 78, -100, 0x94a3b8);
        }
        // crash cart and the nurses' station facing the beds
        c.box(46, 40, 32, 220, 20, -100, 0xef4444); c.solid(220, -100, 46, 32);
        for (let i = 0; i < 3; i++) c.box(40, 3, 28, 220, 12 + i * 12, -100, 0xfca5a5);
        c.box(210, 34, 66, -60, 17, 80, 0xc8d2d8); c.solid(-60, 80, 210, 66);
        c.box(216, 4, 72, -60, 36, 80, 0xdfe6ea);
        for (let i = -1; i <= 1; i++) { P.screen(c, -60 + i * 68, 56, 50, 46, 28, 0xec4899, 2.4, 1); P.chair(c, -60 + i * 68, 128, 0x94a3b8, 1); }
        c.plate(metersTex({
            w: 640, h: 288, accent: e.css, title: 'DOSE ESCALATION', sub: 'cohort 4',
            rows: [{ label: 'cohort 1 · 10 mg', v: 1, cap: 'clear' }, { label: 'cohort 2 · 30 mg', v: 1, cap: 'clear' },
            { label: 'cohort 3 · 100 mg', v: 0.86, cap: 'grade 1' }, { label: 'cohort 4 · 300 mg', v: 0.35, cap: 'dosing' }]
        }), 230, 104, 60, 64, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.plate(panelTex({
            w: 512, h: 224, bg: '#1a0e14', accent: '#f87171',
            title: 'STOPPING RULES', titleSize: 28,
            lines: ['!any grade 3 → halt cohort', '~2 grade 2 → hold and review',
                '+DSMB meets weekly'], lineSize: 21
        }), 160, 70, c.W / 2 - c.WALL / 2 - 5, 56, 20, -Math.PI / 2);
        c.npc(c, -180, 150, { name: 'Trial Physician', role: 'Phase I Safety', color: 0xec4899 }, -1);
        c.npc(c, 150, 130, { name: 'Research Nurse', role: 'Vitals', color: 0x38bdf8 }, -1);
    },

    /** PHASE II — bigger ward, and a wall arguing about whether it works. */
    phase2(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
            bedPod(c, -170 + i * 130, -130 + row * 150, row ? 0x8b5cf6 : 0xec4899, 1);
        }
        for (const sx of [-1, 1]) P.column(c, sx * 210, 0, c.H - 4, 0xdfe6ea, 18);
        c.plate(chartTex({
            w: 768, h: 320, accent: e.css, title: 'EFFICACY', sub: 'primary endpoint',
            series: [{ pts: [0.5, 0.54, 0.6, 0.66, 0.71, 0.78, 0.82, 0.86], col: '#ec4899' },
            { pts: [0.5, 0.51, 0.53, 0.52, 0.55, 0.54, 0.57, 0.56], col: '#94a3b8', w: 2 }],
            legend: [{ label: 'treatment', col: '#ec4899' }, { label: 'placebo', col: '#94a3b8' }]
        }), 250, 104, -20, 66, back(c));
        c.plate(barsTex({
            w: 512, h: 288, accent: e.css, title: 'ENROLMENT', sub: 'n = 412',
            rows: [{ label: 'site A', v: 0.92 }, { label: 'site B', v: 0.71 },
            { label: 'site C', v: 0.44, col: '#fbbf24' }, { label: 'dropouts', v: 0.09, col: '#f87171' }]
        }), 160, 90, c.W / 2 - c.WALL / 2 - 5, 56, 60, -Math.PI / 2);
        c.box(180, 34, 60, 60, 17, 170, 0xc8d2d8); c.solid(60, 170, 180, 60);
        for (let i = -1; i <= 1; i++) P.screen(c, 60 + i * 60, 54, 142, 40, 24, 0x8b5cf6, 2.4, 1);
        c.npc(c, -230, 90, { name: 'Principal Investigator', role: 'Phase II', color: 0xec4899 }, 1);
        c.npc(c, 200, 30, { name: 'Biostatistician', role: 'Endpoints', color: 0x8b5cf6 }, -1);
    },

    /** ADAPTIVE PROTOCOL ENGINE — the room that reallocates patients live. */
    adaptive(c, e) {
        for (let i = 0; i < 4; i++) {
            const x = -195 + i * 130;
            c.box(120, 80, 6, x, 56, -c.D / 2 + 19, 0x0a0f18);
            c.plate([
                metersTex({ w: 384, h: 288, accent: e.css, title: 'ARM A', sub: 'allocation', rows: [{ label: 'weight', v: 0.62 }, { label: 'responders', v: 0.71 }, { label: 'toxicity', v: 0.14 }] }),
                metersTex({ w: 384, h: 288, accent: '#8b5cf6', title: 'ARM B', sub: 'allocation', rows: [{ label: 'weight', v: 0.24 }, { label: 'responders', v: 0.38 }, { label: 'toxicity', v: 0.31 }] }),
                logTex({ w: 384, h: 288, accent: '#22d3ee', title: 'DECISIONS', lines: ['~arm B down-weighted', '+arm A expanded', '!arm C futility'] }),
                barsTex({ w: 384, h: 288, accent: '#fbbf24', title: 'POSTERIOR', rows: [{ label: 'P(A>ctrl)', v: 0.94 }, { label: 'P(B>ctrl)', v: 0.41 }, { label: 'P(C>ctrl)', v: 0.08, col: '#f87171' }] })
            ][i], 112, 74, x, 56, -c.D / 2 + 23);
        }
        c.lit(c.W - 70, 2, 3, 0, 102, -c.D / 2 + 34, e.accent);
        for (let row = 0; row < 2; row++) {
            const z = -30 + row * 90, h = row ? 12 : 0;
            if (row) c.box(c.W - 180, h, 76, 20, h / 2, z, 0x2a2436);
            for (let i = 0; i < 4; i++) {
                const x = -120 + i * 105;
                c.box(96, 30, 52, x, h + 15, z, 0xc8d2d8); c.solid(x, z, 96, 52);
                c.box(102, 4, 58, x, h + 32, z, 0xdfe6ea);
                P.screen(c, x, h + 48, z - 24, 40, 24, row ? 0x8b5cf6 : 0xec4899, 2.2, 1);
                P.chair(c, x, z + 44, 0x94a3b8, 1);
            }
        }
        c.plate(panelTex({
            w: 512, h: 224, bg: '#f4eef6', accent: e.css, grid: true, gridColor: 'rgba(110,90,120,0.16)',
            title: 'PRE-REGISTERED', titleSize: 26, titleColor: '#2a1f2e', lineColor: '#3a2f3c',
            lines: ['~adaptation rules locked before day 1', '+interim looks: 3', '!no unblinded eyes on arms'], lineSize: 20
        }), 160, 70, c.W / 2 - c.WALL / 2 - 5, 56, 130, -Math.PI / 2);
        c.npc(c, -230, 170, { name: 'Protocol Engineer', role: 'Adaptive Design', color: 0x8b5cf6 }, 1);
    },

    /** SEQUENCING ARRAYS — rows of sequencers and the helix that justifies them. */
    seqarray(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
            const x = -190 + i * 95, z = -150 + row * 95;
            c.box(88, 26, 62, x, 13, z, 0xc8d2d8); c.solid(x, z, 88, 62);
            c.box(94, 4, 68, x, 28, z, 0xdfe6ea);
            sequencer(c, x, z, [0x8b5cf6, 0x38bdf8][(i + row) % 2], 1);
        }
        helix(c, 0, 90, 80, 2.4, 0x8b5cf6, 0x38bdf8);
        for (const sx of [-1, 1]) helix(c, sx * 150, 90, 62, 1.8, 0x38bdf8, 0xf472b6);
        c.plate(metersTex({
            w: 640, h: 288, accent: e.css, title: 'RUN STATUS', sub: '48 flowcells',
            rows: [{ label: 'Q30', v: 0.94 }, { label: 'cluster density', v: 0.79 },
            { label: 'reads passing', v: 0.91 }, { label: 'reagent remaining', v: 0.22, cap: 'order' }]
        }), 230, 104, -20, 64, back(c));
        c.plate(panelTex({
            w: 512, h: 192, bg: '#160e26', accent: e.css, align: 'center',
            title: 'GENOMES TODAY', titleSize: 28, lines: ['~1,412'], lineSize: 44, padTop: 42
        }), 150, 56, 200, 58, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -240, 40, { name: 'Sequencing Lead', role: 'Arrays', color: 0x8b5cf6 }, 1);
    },

    /** BIOINFORMATICS — where the reads become an answer. */
    bioinfo(c, e) {
        for (let i = 0; i < 5; i++) P.rack(c, -190 + i * 95, -160, 0x8b5cf6, 62, 86, 34, 1);
        c.box(c.W - 90, 6, 16, 0, 92, -160, 0x2a3644);
        c.lit(c.W - 120, 1.5, 4, 0, 95, -160, 0x8b5cf6);
        for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
            const x = -150 + i * 150, z = -40 + row * 100;
            c.box(120, 30, 56, x, 15, z, 0xc8d2d8); c.solid(x, z, 120, 56);
            c.box(126, 4, 62, x, 32, z, 0xdfe6ea);
            for (let s = -1; s <= 1; s += 2) P.screen(c, x + s * 30, 52, z - 26, 50, 30, s < 0 ? 0x8b5cf6 : 0x22d3ee, 2.4, 1);
            P.chair(c, x, z + 46, 0x94a3b8, 1);
        }
        c.plate(graphTex({
            w: 768, h: 320, accent: e.css, title: 'PIPELINE', sub: 'per sample',
            cols: [['fastq'], ['align', 'trim'], ['call', 'filter'], ['annotate'], ['report']]
        }), 250, 104, -20, 66, back(c));
        c.plate(logTex({
            w: 512, h: 288, accent: e.css, title: 'JOBS', sub: 'slurm',
            lines: ['+1,204 complete', '~318 running', '!12 failed — bad index',
                '+median turnaround 4h']
        }), 160, 90, c.W / 2 - c.WALL / 2 - 5, 56, 80, -Math.PI / 2);
        c.npc(c, 220, 150, { name: 'Pipeline Dev', role: 'Bioinformatics', color: 0x22d3ee }, -1);
    },

    /** CRYO INTAKE — the paperwork end of immortality. Deliberately clinical. */
    cryointake(c, e) {
        P.counter(c, -120, -160, 180, 54, 0xc8d2d8, 0xe8eef2, 0x67e8f9);
        c.plate(panelTex({
            w: 640, h: 256, bg: '#eef7fa', accent: e.css,
            title: 'CRYONICS VAULT — INTAKE', titleSize: 28, titleColor: '#123038', lineColor: '#2a3f47',
            lines: ['~standby team on 20 min notice', 'membership and directives verified here',
                '!this is preservation, not resurrection', '+perfusion suite through the doors'], lineSize: 20
        }), 240, 96, -120, 76, back(c));
        // the gurney bay and the standby kit, ready to go
        for (let i = 0; i < 2; i++) {
            const x = 80 + i * 110;
            c.box(56, 26, 116, x, 26, -140, 0xa8b4bc); c.solid(x, -140, 56, 116);
            c.box(60, 6, 120, x, 41, -140, 0xdfe6ea);
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(6, 13, 6, x + sx * 22, 6, -140 + sz * 48, 0x64748b);
            c.lit(44, 1.5, 100, x, 45, -140, 0xe0f2fe);
        }
        for (let i = 0; i < 3; i++) P.cabinet(c, 200, -20 + i * 70, 56, 66, 30, 0xc8d2d8, 3);
        for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
            const x = -200 + i * 62, z = 20 + row * 90;
            c.box(52, 14, 46, x, 7, z, 0xbcd2da); c.solid(x, z, 52, 46);
            c.box(52, 30, 9, x, 24, z + (row ? 18 : -18), 0xa8c2cc);
        }
        P.plant(c, -245, 170, 58);
        c.plate(cardsTex({
            w: 640, h: 256, accent: e.css, title: 'STANDBY', sub: 'today', perRow: 3,
            cards: [{ name: 'Team 1', sub: 'on call', stat: 'ready' },
            { name: 'Team 2', sub: 'in transit', stat: 'ETA 40m', col: '#fbbf24' },
            { name: 'Perfusate', sub: 'batch 41', stat: 'in date' }]
        }), 200, 80, 60, 60, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -120, -110, { name: 'Intake Officer', role: 'Membership', color: 0x67e8f9 }, 1);
        c.npc(c, 40, 150, { name: 'Standby Lead', role: 'Response', color: 0x38bdf8 }, -1);
    },

    /** VITRIFICATION — the theatre where the cooling curve is run. */
    vitrify(c, e) {
        // the table under a lamp array, ringed by perfusion machines
        c.box(70, 30, 140, 0, 30, -60, 0xa8b4bc); c.solid(0, -60, 70, 140);
        c.box(76, 7, 146, 0, 48, -60, 0xdfe6ea);
        c.lit(60, 1.6, 128, 0, 52, -60, 0xe0f2fe);
        for (let i = 0; i < 3; i++) {
            c.box(46, 8, 46, -30 + i * 30, c.H - 12, -60, 0xcbd5e1);
            c.lit(38, 4, 38, -30 + i * 30, c.H - 17, -60, 0xf0fdff);
        }
        for (const sx of [-1, 1]) {
            c.box(56, 74, 46, sx * 110, 37, -80, 0xdfe6ea); c.solid(sx * 110, -80, 56, 46);
            c.lit(40, 22, 1.4, sx * 110, 56, -56, 0x67e8f9);
            for (let i = 0; i < 4; i++) c.lit(6, 4, 1, sx * 110 - 15 + i * 10, 26, -56, [0x4ade80, 0x67e8f9, 0xfbbf24, 0x4ade80][i]);
            c.lit(3, 40, 3, sx * 96, 40, -60, 0xa5f3fc);            // perfusion line
        }
        // cooling curve on the wall — the one number that matters
        c.plate(chartTex({
            w: 768, h: 320, accent: e.css, title: 'COOLING CURVE', sub: '°C / min',
            series: [{ pts: [1, 0.86, 0.7, 0.55, 0.4, 0.28, 0.17, 0.09, 0.03], col: '#67e8f9' },
            { pts: [1, 0.88, 0.74, 0.6, 0.46, 0.33, 0.22, 0.13, 0.06], col: '#475569', w: 2 }],
            legend: [{ label: 'actual', col: '#67e8f9' }, { label: 'target', col: '#94a3b8' }]
        }), 250, 104, -20, 66, back(c));
        for (let i = 0; i < 2; i++) {
            c.box(110, 32, 54, 190, 16, -20 + i * 90, 0xc8d2d8); c.solid(190, -20 + i * 90, 110, 54);
            P.screen(c, 190, 52, -46 + i * 90, 44, 26, 0x67e8f9, 2.4, 1);
        }
        for (let i = 0; i < 3; i++) P.cabinet(c, -210, -20 + i * 72, 56, 64, 30, 0xc8d2d8, 3);
        c.plate(panelTex({
            w: 512, h: 224, bg: '#08202a', accent: e.css,
            title: 'CRYOPROTECTANT', titleSize: 28,
            lines: ['~ramp to 60% w/v over 3 h', '+ice nucleation: none detected',
                '!below −124 °C the glass can crack'], lineSize: 21
        }), 160, 70, c.W / 2 - c.WALL / 2 - 5, 56, 120, -Math.PI / 2);
        c.npc(c, -140, 130, { name: 'Perfusionist', role: 'Vitrification', color: 0x67e8f9 }, -1);
    },

    /** DEEP STORAGE — the dewar farm. Quiet, cold, and full of people. */
    deepstore(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
            dewar(c, -190 + i * 95, -150 + row * 100, row ? 86 : 78, 0x67e8f9);
        }
        for (let i = 0; i < 3; i++) dewar(c, -120 + i * 120, 40, 70, 0xa5f3fc);
        // LN2 header running overhead, feeding each dewar
        for (const z of [-150, -50, 40]) {
            c.box(c.W - 90, 10, 10, 0, c.H - 18, z, 0xcbd5e1);
            c.lit(c.W - 120, 3, 3, 0, c.H - 24, z, 0xa5f3fc);
        }
        // frost creeping along the aisle floor between the two dewar ranks
        for (let i = 0; i < 5; i++) c.lit(74, 1.2, 26, -190 + i * 95, 1.1, -100, 0xcfeaf3);
        c.box(140, 34, 56, 190, 17, 150, 0xc8d2d8); c.solid(190, 150, 140, 56);
        P.screen(c, 190, 54, 122, 48, 28, 0x67e8f9, 2.4, 1);
        c.plate(metersTex({
            w: 640, h: 288, accent: e.css, title: 'DEWAR TELEMETRY', sub: '−196 °C',
            rows: [{ label: 'LN2 level A-block', v: 0.88 }, { label: 'LN2 level B-block', v: 0.64 },
            { label: 'boil-off / day', v: 0.11, cap: '1.4%' }, { label: 'days of reserve', v: 0.72, cap: '43' }]
        }), 230, 104, -40, 64, back(c));
        c.plate(panelTex({
            w: 512, h: 256, bg: '#06202a', accent: e.css, align: 'center',
            title: 'PATIENTS IN SUSPENSION', titleSize: 24,
            lines: ['~248', 'longest: 41 years', '+neuro 61 · whole body 187'], lineSize: 20, padTop: 44
        }), 160, 80, c.W / 2 - c.WALL / 2 - 5, 58, 60, -Math.PI / 2);
        c.npc(c, 60, 170, { name: 'Preservation Ops', role: 'Deep Storage', color: 0x67e8f9 }, -1);
    },

    /** B1 · LN2 PLANT — the machine keeping the vault honest. */
    ln2(c, e) {
        for (const sx of [-1, 1]) {
            c.box(72, c.H - 20, 72, sx * 190, (c.H - 20) / 2, -140, 0xcbd5e1); c.solid(sx * 190, -140, 72, 72);
            for (let i = 0; i < 4; i++) c.box(78, 6, 78, sx * 190, 16 + i * 20, -140, 0xe2f4fb);
            c.lit(30, 10, 1.6, sx * 190, 60, -102, 0x67e8f9);
        }
        // compressor skids and the pipe gallery between them
        for (let i = 0; i < 3; i++) {
            const x = -110 + i * 110;
            c.box(90, 52, 70, x, 26, -40, 0x94a3b8); c.solid(x, -40, 90, 70);
            c.box(96, 6, 76, x, 55, -40, 0xa8b4bc);
            c.box(30, 26, 30, x, 71, -40, 0x64748b);
            c.lit(20, 6, 1.4, x, 40, -4, i === 1 ? 0xfbbf24 : 0x4ade80);
        }
        for (let i = 0; i < 4; i++) {
            c.box(c.W - 80, 9, 9, 0, 70 + i * 6, 30, 0xcbd5e1);
            c.lit(c.W - 110, 2.4, 2.4, 0, 70 + i * 6, 36, [0xa5f3fc, 0x67e8f9, 0xa5f3fc, 0xe0f2fe][i]);
        }
        for (let i = 0; i < 4; i++) P.barrel(c, -200 + i * 56, 130, 0xcbd5e1);
        c.box(150, 84, 40, 160, 42, 150, 0xc8d2d8); c.solid(160, 150, 150, 40);
        c.lit(120, 40, 1.5, 160, 52, 171, 0x67e8f9);
        c.plate(metersTex({
            w: 576, h: 288, accent: e.css, title: 'LN2 PLANT', sub: 'B1',
            rows: [{ label: 'liquefier duty', v: 0.81 }, { label: 'buffer tank', v: 0.67 },
            { label: 'compressor 2', v: 0.94, cap: 'service' }, { label: 'O2 sensor', v: 0.2, cap: 'safe' }]
        }), 220, 110, -40, 62, back(c));
        c.plate(panelTex({
            w: 512, h: 192, bg: '#1a1206', accent: '#fbbf24',
            title: 'ASPHYXIATION HAZARD', titleSize: 26,
            lines: ['!nitrogen displaces oxygen without warning', '~check the door light before entry'], lineSize: 20
        }), 150, 56, c.W / 2 - c.WALL / 2 - 5, 54, 60, -Math.PI / 2);
        c.npc(c, -40, 170, { name: 'Plant Engineer', role: 'LN2 Plant', color: 0x67e8f9 }, -1);
    },

    /** B1 · COLD STORE — freezer farms, whatever the building is freezing. */
    coldstore(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
            freezer(c, -195 + i * 78, -150 + row * 120, e.accent, row ? -1 : 1);
        }
        for (const z of [-150, -30]) {
            c.box(c.W - 80, 6, 14, 0, 98, z, 0x94a3b8);
            c.lit(c.W - 110, 1.5, 3, 0, 101, z, e.accent);
        }
        // sample handling bench, chilled, plus the alarm panel nobody wants lit
        bench(c, -80, 90, 190, 60);
        for (let i = 0; i < 4; i++) {
            c.box(26, 8, 20, -150 + i * 46, 39, 90, 0x1e293b);
            for (let w = 0; w < 3; w++) c.lit(4, 2, 4, -158 + i * 46 + w * 7, 44, 90, [0x38bdf8, 0x4ade80, 0xf472b6][(i + w) % 3]);
        }
        c.box(70, 60, 20, 190, 44, 100, 0x111827); c.solid(190, 100, 70, 20);
        for (let i = 0; i < 4; i++) c.lit(50, 6, 1.4, 190, 26 + i * 16, 111, i === 2 ? 0xf43f5e : 0x4ade80);
        for (let i = 0; i < 4; i++) P.crate(c, -230 + i * 40, 180, 30, 0x475569);
        c.plate(logTex({
            w: 576, h: 288, accent: e.css, title: e.title || 'COLD CHAIN', sub: 'B1',
            lines: e.lines || ['+all units in range', '~unit 7 defrost cycle', '!unit 12 door ajar 40 s', '+backup CO2 armed']
        }), 220, 110, -20, 62, back(c));
        c.npc(c, 90, 170, { name: 'Sample Custodian', role: e.custodian || 'Cold Store', color: 0x38bdf8 }, -1);
    },

    /** B1 · BIOHAZARD ARCHIVE — locked, logged, and slightly unnerving. */
    biohazard(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
            const x = -190 + i * 95, z = -150 + row * 110;
            c.box(76, 92, 46, x, 46, z, 0xb8c4cc); c.solid(x, z, 76, 46);
            for (let s = 0; s < 5; s++) {
                c.box(70, 3, 42, x, 12 + s * 17, z, 0xa0aeb8);
                for (let b = 0; b < 3; b++) c.lit(16, 9, 30, x - 22 + b * 22, 20 + s * 17, z, [0xfbbf24, 0xf43f5e, 0x4ade80][(b + s) % 3]);
            }
            c.lit(60, 3, 2, x, 90, z + 24, 0xfbbf24);
        }
        // airlock at the near end, with the trefoil-ish warning plate
        c.box(120, 84, 14, -40, 42, 120, 0xc8d2d8); c.solid(-40, 120, 120, 14);
        c.box(46, 46, 4, -40, 52, 128, 0x0f172a);
        c.lit(38, 38, 1.2, -40, 52, 130, 0x1a2a12);
        c.plate(panelTex({
            w: 384, h: 384, bg: '#1a1606', accent: '#fbbf24', align: 'center',
            title: 'BSL-3', titleSize: 44, lines: ['!AUTHORISED', '!PERSONNEL', '~ONLY'], lineSize: 26, padTop: 70
        }), 66, 66, -40, 52, 128.5);
        for (let i = 0; i < 3; i++) P.cabinet(c, 190, -60 + i * 76, 60, 70, 32, 0xb8c4cc, 4);
        c.plate(logTex({
            w: 576, h: 288, accent: e.css, title: 'CHAIN OF CUSTODY', sub: 'B1',
            lines: ['+41 aliquots logged out', '~2 pending destruction', '!one box unaccounted since March',
                '+audit due Friday']
        }), 220, 110, 60, 62, back(c));
        c.npc(c, -180, 180, { name: 'Biosafety Officer', role: 'Sample Archive', color: 0xfbbf24 }, -1);
    }
};

// per-kind mood: the wing runs bright and clinical, unlike the robotics quarter
const MOOD = {
    wet:        [0xdfe8ea, 0xcfdde0, 0xc0d2d6, 0xf0ffff, false],
    fold:       [0x18243a, 0x0c1424, 0x22314c, 0xbfdbfe, true],
    gpu:        [0x16222e, 0x0a1018, 0x22303e, 0x9fe8ff, true],
    pipeline:   [0xe4ecf2, 0xd2dee6, 0xc2d2de, 0xeaf6ff, false],
    screening:  [0xdfeae2, 0xcedcd2, 0xbed2c4, 0xecfff2, false],
    genchem:    [0x18261e, 0x0c1610, 0x223428, 0xa7f3d0, true],
    intake:     [0xf2e6ee, 0xe6d6e2, 0xd8c2d0, 0xffeef6, false],
    phase1:     [0xeee4ea, 0xdcd0d8, 0xccbcc8, 0xfff0f6, false],
    phase2:     [0xeae2ee, 0xd8cede, 0xc6bad0, 0xf6eeff, false],
    adaptive:   [0x241c30, 0x120c1a, 0x30263e, 0xd8ccff, true],
    seqarray:   [0x1e1a30, 0x100c1c, 0x2a2440, 0xd8ccff, true],
    bioinfo:    [0x1c1a2c, 0x0e0c18, 0x282438, 0xc4b5fd, true],
    cryointake: [0xe2f0f4, 0xd0e2e8, 0xbed6de, 0xeafcff, false],
    vitrify:    [0xdcecf2, 0xc8dce4, 0xb4d0da, 0xe0fbff, false],
    deepstore:  [0x16303a, 0x0a1a20, 0x1e404c, 0xa5f3fc, true],
    ln2:        [0x1a2c34, 0x0c181e, 0x243a44, 0xa5f3fc, true],
    coldstore:  [0x1c2a32, 0x0e161c, 0x26383f, 0x9fe8ff, true],
    biohazard:  [0x241f14, 0x120f08, 0x30291a, 0xfde68a, true]
};

/** The wing's real portfolio, for the Therapy Pipeline plinths. Kept local
 *  because LONGEVITY_COMPANIES in data.js carries no colour or lead drug. */
const PORTFOLIO = [
    { name: 'Isomorphic', drug: 'AF3 oncology', col: 0x3b82f6, css: '#3b82f6' },
    { name: 'Retro Bio', drug: 'autophagy pill', col: 0xa855f7, css: '#a855f7' },
    { name: 'Altos Labs', drug: 'reprogramming', col: 0x22d3ee, css: '#22d3ee' },
    { name: 'Insilico', drug: 'ISM001-055', col: 0x22c55e, css: '#22c55e' },
    { name: 'Recursion', drug: 'REC-4881', col: 0xf472b6, css: '#f472b6' },
    { name: 'Calico', drug: 'ABBV-CLS-7262', col: 0xfbbf24, css: '#fbbf24' }
];

const LAYOUTS = {
    longevity_protein: {
        accent: 0x3b82f6, css: '#3b82f6',
        floors: [
            { kind: 'fold', label: 'STRUCTURE PREDICTION' },
            {
                kind: 'wet', label: 'INTERACTOME MODELING', item: 'scope', screen: 'bars',
                title: 'INTERACTOME', sub: '22.7M edges',
                rows: [{ label: 'protein–protein', v: 0.74 }, { label: 'protein–DNA', v: 0.51 },
                { label: 'protein–ligand', v: 0.88 }, { label: 'validated', v: 0.29, col: '#fbbf24' }],
                board: 'OPEN PROBLEMS',
                notes: ['~structure is not function', '!co-folding ≠ co-expression',
                    '+wet-lab validation is the bottleneck'],
                staff: [{ name: 'Interactome Lead', x: -230, z: 150, role: 'Networks', color: 0x3b82f6, f: 1 },
                { name: 'Validation Sci', x: 190, z: 160, role: 'Wet Lab', color: 0x22d3ee, f: -1 }]
            },
            { kind: 'gpu', label: 'ALPHAFOLD 3 CLUSTER' },
            {
                kind: 'wet', label: 'TARGET VALIDATION', item: 'plate', screen: 'bars',
                title: 'TARGET SCORECARD', sub: 'top 6',
                rows: [{ label: 'tractability', v: 0.72 }, { label: 'genetic evidence', v: 0.86 },
                { label: 'safety liability', v: 0.31, col: '#fbbf24' }, { label: 'novelty', v: 0.64 }],
                staff: [{ name: 'Target Biologist', x: -220, z: 160, role: 'Validation', color: 0x3b82f6, f: 1 }]
            },
            { kind: 'pipeline', label: 'THERAPY PIPELINE', companies: PORTFOLIO },
            { kind: 'gpu', label: 'B1 · GPU FOLDING CLUSTER' }
        ]
    },
    longevity_discovery: {
        accent: 0x22c55e, css: '#22c55e',
        floors: [
            {
                kind: 'wet', label: 'COMPOUND SYNTHESIS', item: 'flask',
                title: 'SYNTHESIS QUEUE', sub: 'bench 1–4',
                lines: ['+18 routes proposed by the model', '~4 on the bench today',
                    '!one step needs a reagent nobody sells', '+2 delivered to screening'],
                board: 'ROUTE NOTES',
                notes: ['~the model does not know about smell', '!protecting groups, again',
                    '+yield beat prediction by 12%'],
                staff: [{ name: 'Synthetic Chemist', x: -230, z: 150, role: 'Med Chem', color: 0x22c55e, f: 1 },
                { name: 'Lab Tech', x: 200, z: 160, role: 'Workups', color: 0x86efac, f: -1 }]
            },
            { kind: 'screening', label: 'MOLECULAR SCREENING' },
            { kind: 'genchem', label: 'GENERATIVE CHEMISTRY AI' },
            {
                kind: 'wet', label: 'TARGET IDENTIFICATION', item: 'scope', screen: 'bars',
                title: 'TARGET RANKING', sub: 'aging hallmarks',
                rows: [{ label: 'senescence', v: 0.81 }, { label: 'mitochondrial', v: 0.66 },
                { label: 'proteostasis', v: 0.74 }, { label: 'epigenetic drift', v: 0.58 }],
                staff: [{ name: 'Target Sci', x: -220, z: 155, role: 'Discovery Biology', color: 0x22c55e, f: 1 }]
            },
            {
                kind: 'wet', label: 'LEAD OPTIMIZATION', item: 'plate', screen: 'bars',
                title: 'ADMET', sub: 'lead series 4',
                rows: [{ label: 'absorption', v: 0.78 }, { label: 'half-life', v: 0.62 },
                { label: 'hERG', v: 0.22, col: '#4ade80' }, { label: 'hepatotox', v: 0.44, col: '#fbbf24' },
                { label: 'brain penetrance', v: 0.15, col: '#f87171' }],
                board: 'SERIES 4',
                notes: ['~potency is easy, PK is the job', '!the fluorine helped and we do not know why',
                    '+backup series started'],
                staff: [{ name: 'DMPK Lead', x: -230, z: 150, role: 'Lead Optimisation', color: 0x22c55e, f: 1 }]
            },
            {
                kind: 'coldstore', label: 'B1 · COMPOUND LIBRARY (−80 °C)', accent: 0x22c55e,
                title: 'LIBRARY', custodian: 'Compound Library',
                lines: ['+1.2M compounds plated', '~re-plating series 4', '!freezer 9 alarm cleared', '+DMSO stock ok']
            }
        ]
    },
    longevity_trials: {
        accent: 0xec4899, css: '#ec4899',
        floors: [
            { kind: 'intake', label: 'PATIENT INTAKE' },
            { kind: 'phase1', label: 'PHASE I SAFETY' },
            { kind: 'phase2', label: 'PHASE II EFFICACY' },
            { kind: 'adaptive', label: 'ADAPTIVE PROTOCOL ENGINE' },
            { kind: 'biohazard', label: 'B1 · BIOHAZARD SAMPLE ARCHIVE' }
        ]
    },
    longevity_genomics: {
        accent: 0x8b5cf6, css: '#8b5cf6',
        floors: [
            {
                kind: 'wet', label: 'SAMPLE PREP', item: 'plate',
                title: 'ACCESSIONING', sub: 'today',
                lines: ['+412 samples received', '~61 awaiting extraction', '!3 haemolysed — recollect',
                    '+libraries pooled for run 88'],
                board: 'PREP NOTES',
                notes: ['~barcode before you pipette', '!never trust an unlabelled tube',
                    '+RIN above 8 or it does not go on'],
                staff: [{ name: 'Prep Tech', x: -230, z: 155, role: 'Extraction', color: 0x8b5cf6, f: 1 },
                { name: 'Accessioner', x: 200, z: 160, role: 'Intake', color: 0x38bdf8, f: -1 }]
            },
            { kind: 'seqarray', label: 'SEQUENCING ARRAYS' },
            { kind: 'bioinfo', label: 'BIOINFORMATICS PIPELINE' },
            {
                kind: 'wet', label: 'EPIGENOME ANALYSIS', item: 'scope', screen: 'bars',
                title: 'METHYLATION CLOCKS', sub: 'cohort 12',
                rows: [{ label: 'Horvath', v: 0.68, note: '−2.1y' }, { label: 'GrimAge', v: 0.54, note: '−0.8y' },
                { label: 'PhenoAge', v: 0.72, note: '−3.4y' }, { label: 'DunedinPACE', v: 0.44, note: '0.96' }],
                board: 'CLOCKS',
                notes: ['~a clock is a correlation, not a cause', '!batch effects look like rejuvenation',
                    '+pre-register the endpoint'],
                staff: [{ name: 'Epigenomics Lead', x: -225, z: 150, role: 'Clocks', color: 0x8b5cf6, f: 1 }]
            },
            {
                kind: 'coldstore', label: 'B1 · SEQUENCER COLD ROOM', accent: 0x8b5cf6,
                title: 'REAGENT STORE', custodian: 'Cold Room',
                lines: ['+flowcells: 61 in date', '~two lots expire this month', '!−80 unit 4 compressor noisy',
                    '+LIMS reconciled']
            }
        ]
    },
    longevity_cryo: {
        accent: 0x67e8f9, css: '#67e8f9',
        floors: [
            { kind: 'cryointake', label: 'INTAKE PROCESSING' },
            { kind: 'vitrify', label: 'VITRIFICATION CHAMBER' },
            { kind: 'deepstore', label: 'DEEP STORAGE (−196 °C)' },
            { kind: 'ln2', label: 'B1 · LN2 PLANT' }
        ]
    }
};

function makeSpec(id, L) {
    for (const e of L.floors) { e.accent = e.accent || L.accent; e.css = e.css || L.css; }
    return {
        id,
        theme(b, f, th) {
            const e = L.floors[Math.max(0, Math.min(L.floors.length - 1, f))];
            const m = MOOD[e.kind] || MOOD.wet;
            th.cat = 'longevity';
            th.wall = m[0]; th.ceil = m[1]; th.floor = m[2]; th.lamp = m[3];
            th.dim = !!m[4];
            th.accent = e.css;
        },
        floors: L.floors.map((e) => ({
            key: e.kind,
            label: e.label,
            build: (c) => KIND[e.kind](c, e)
        }))
    };
}

export const LONGEVITY_ROOMS = {};
for (const id of Object.keys(LAYOUTS)) LONGEVITY_ROOMS[id] = makeSpec(id, LAYOUTS[id]);

/** Any other longevity_* building borrows the Drug Discovery stack. */
export function longevityRoom(b) {
    return LONGEVITY_ROOMS[b?.id] || LONGEVITY_ROOMS.longevity_discovery;
}
