/* ══════════════════════════════════════════════════════════════════════════
   AGENT DISTRICT — ported from pixi/js/interior_agents.js.

   Five buildings, each with its own storey list, so this module exports one
   spec per building rather than one shared spec: the Orchestration Hub is six
   floors of swarm control and the Tool Registry is four floors of API plumbing,
   and pretending they are the same building with different paint was exactly
   the failure mode the room registry exists to fix.

   Floors are ordered ground-up here, the reverse of the 2D module's roof-down
   list, because floor 0 is the one you walk in on.

   The nine floor *kinds* mirror the nine prop treatments in the 2D
   `_drawFloorProps` switch — a Task Queue and an Agent Bus really do look the
   same in both apps; what differs is the wording on the screens, which each
   floor entry carries as its own data.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex } from './kit.js';
import { graphTex, barsTex, logTex, metersTex, pipelineTex, cardsTex } from './screens.js';

// z of the back wall's plate plane — every room hangs its main display here
const back = (c) => -c.D / 2 + c.WALL / 2 + 3;

// ── district props ───────────────────────────────────────────────────────────

/** API bay: a rack whose face is a ladder of colour-coded connector ports.
 *  The Tool Registry's signature — you should be able to tell this floor from
 *  a compute rack at a glance, hence ports rather than blinkenlights. */
function apiRack(c, x, z, face = 1, h = 86, w = 46) {
    c.box(w, h, 30, x, h / 2, z, 0x11151f); c.solid(x, z, w, 30);
    c.box(w - 6, h - 10, 1.5, x, h / 2 + 1, z + face * 15.5, 0x080b12);
    const ports = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e, 0xa855f7, 0x3b82f6];
    for (let p = 0; p < 7; p++) {
        const py = 12 + p * ((h - 22) / 6);
        c.box(w - 12, 7, 2, x, py, z + face * 16.2, 0x0d1220);
        c.lit(5, 4, 1, x - w / 2 + 10, py, z + face * 17.2, ports[p % 6]);
        // the lit bar is the "traffic on this port" readout
        c.lit((w - 30) * (0.35 + ((p * 7) % 5) / 8), 2, 1, x + 3, py, z + face * 17.2, ports[(p + 3) % 6]);
    }
    c.lit(w - 14, 2, 1, x, h - 5, z + face * 17, 0xfbbf24);
}

/** Workflow node: a lit pillar you can walk between. The DAG is the room. */
function nodePillar(c, x, z, col, h = 44) {
    c.box(26, 5, 26, x, 2.5, z, 0x141a2a); c.solid(x, z, 24, 24);
    c.box(16, h, 16, x, 5 + h / 2, z, 0x0d1220);
    for (const s of [-1, 1]) {
        c.lit(1.6, h - 8, 1.6, x + s * 8.5, 5 + h / 2, z + 8.5, col);
        c.lit(1.6, h - 8, 1.6, x + s * 8.5, 5 + h / 2, z - 8.5, col);
    }
    c.lit(20, 8, 20, x, h + 9, z, col);
}

/** L-shaped floor conduit between two nodes. Axis-aligned on purpose: merged
 *  boxes cannot rotate, and a Manhattan route reads as a bus diagram anyway. */
function conduit(c, x0, z0, x1, z1, col, y = 1.5) {
    c.lit(Math.abs(x1 - x0) + 4, 1.2, 4, (x0 + x1) / 2, y, z0, col);
    if (z0 !== z1) c.lit(4, 1.2, Math.abs(z1 - z0) + 4, x1, y, (z0 + z1) / 2, col);
}

/** Guardrail shield — narrowing stacked slabs, since there is no fill path. */
function shield(c, x, y, z, col, s = 1) {
    c.box(26 * s, 30 * s, 3, x, y, z, 0x141824);
    c.lit(20 * s, 18 * s, 1, x, y + 4 * s, z + 2.2, col);
    c.lit(14 * s, 5 * s, 1, x, y - 7 * s, z + 2.2, col);
    c.lit(7 * s, 4 * s, 1, x, y - 11 * s, z + 2.2, col);
}

/** Sealed evaluation pod: glass box, floor grating, one occupant's worth of
 *  space. Used for sandbox runs and, upstairs, for replay observation. */
function pod(c, x, z, col, w = 62, d = 56, h = 62) {
    c.box(w, 6, d, x, 3, z, 0x1a2030); c.solid(x, z, w, d);
    c.lit(w - 14, 1.5, d - 14, x, 6.6, z, col);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        c.box(4, h, 4, x + sx * (w / 2 - 3), h / 2 + 6, z + sz * (d / 2 - 3), 0x2a3242);
    }
    c.box(w, 5, d, x, h + 8, z, 0x2a3242);
    c.lit(w - 10, 1.5, d - 10, x, h + 6, z, col);
    // glazing hinted with corner mullions only, so you can see the occupant
    for (const sz of [-1, 1]) c.lit(w - 12, 1.5, 1, x, 34, z + sz * (d / 2 - 1), col);
}

// ── floor kinds ──────────────────────────────────────────────────────────────
// Each takes (ctx, entry) where entry carries this floor's screen copy.

const KIND = {
    /** Command Bridge / Ops Deck / Swarm Control — the wall of everything. */
    bridge(c, e) {
        const A = e.css;
        c.box(c.W - 90, 86, 5, 0, 50, back(c) - 3, 0x08080f);
        c.plate(graphTex({
            w: 640, h: 320, accent: A, title: e.title || 'SWARM', sub: e.sub,
            cols: e.cols || [['planner'], ['tools', 'search', 'code'], ['critic', 'merge'], ['ship']],
            footer: e.footer
        }), 210, 84, 0, 52, back(c));
        c.plate(barsTex({
            w: 384, h: 288, accent: A, title: 'FLEET', sub: 'live',
            rows: e.fleet || [{ label: 'running', v: 0.74 }, { label: 'queued', v: 0.31 },
            { label: 'blocked', v: 0.12, col: '#f87171' }, { label: 'idle', v: 0.55, col: '#94a3b8' }]
        }), 116, 74, -186, 52, back(c));
        c.plate(logTex({
            w: 384, h: 288, accent: A, title: 'EVENTS',
            lines: e.log || ['+agent-7 spawned', '~handoff → critic', '!loop detected, pruned',
                '+eval 94.2%', '~context 78% full']
        }), 116, 74, 186, 52, back(c));
        c.lit(c.W - 100, 2, 3, 0, c.H - 8, back(c) + 6, e.accent);

        // two tiers of operator pods facing the wall; the back tier sits on a
        // riser with no collider, so you can walk up onto it
        for (let row = 0; row < 2; row++) {
            const z = -70 + row * 78, y = row ? 11 : 0;
            if (row) c.box(c.W - 190, y, 72, 10, y / 2, z, 0x141232);
            for (let i = 0; i < 4; i++) {
                const x = -140 + i * 100;
                c.box(92, 30, 48, x, y + 15, z, 0x1a1840); c.solid(x, z, 92, 48);
                c.box(98, 4, 54, x, y + 32, z, 0x241f4e);
                P.screen(c, x, y + 50, z - 21, 38, 24, [e.accent, 0x22d3ee][i % 2], 2.2, 1);
                P.chair(c, x, z + 42, 0x2c2a52, 1);
            }
        }
        // swarm table: a lit slab ringed by agent tokens, one per active worker
        c.box(150, 26, 96, 40, 13, 120, 0x141232); c.solid(40, 120, 150, 96);
        c.lit(132, 2, 78, 40, 27, 120, e.accent);
        for (let i = 0; i < 10; i++) {
            const a = i * Math.PI / 5;
            c.lit(9, 9, 9, 40 + Math.cos(a) * 56, 34, 120 + Math.sin(a) * 32,
                i % 3 ? e.accent : 0x4ade80);
        }
        c.npc(c, -215, 150, e.staff?.[0] || { name: 'Agent Architect', role: 'System Design', color: 0xf43f5e }, 1);
        c.npc(c, 215, 60, e.staff?.[1] || { name: 'Ops Lead', role: 'Orchestration', color: 0x22d3ee }, 1);
    },

    /** Agent Bus / Task Queue / Workflow Engine — the DAG as architecture. */
    flow(c, e) {
        const A = e.css;
        // seven nodes in a zigzag, wired by floor conduits and an overhead bus
        const cols = [0xf43f5e, 0x22d3ee, 0x4ade80, 0x8b5cf6, 0xfbbf24, 0x38bdf8, 0xa855f7];
        const pts = [];
        for (let i = 0; i < 7; i++) {
            // starts clear of the lift approach lane on the left wall
            const x = -150 + i * 58, z = -120 + (i % 2 ? 74 : 0);
            pts.push([x, z]);
            nodePillar(c, x, z, cols[i], 40 + (i % 3) * 8);
        }
        for (let i = 0; i < 6; i++) conduit(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], cols[i]);
        // overhead message bus with packets frozen mid-flight
        c.box(c.W - 80, 6, 20, 0, c.H - 16, -50, 0x1b1840);
        for (let i = 0; i < 14; i++) {
            c.lit(14, 3, 3, -230 + i * 35, c.H - 21, -50, i % 3 ? A === '#fbbf24' ? 0xfbbf24 : e.accent : 0x4ade80);
        }
        for (const dx of [-180, -20, 140]) c.box(5, 22, 5, dx, c.H - 28, -50, 0x2a2660);

        // task queue: a belt of work crates waiting their turn
        c.box(300, 14, 40, -40, 7, 120, 0x1a1840); c.solid(-40, 120, 300, 40);
        c.lit(288, 1.5, 26, -40, 15, 120, e.accent);
        for (let i = 0; i < 7; i++) P.crate(c, -170 + i * 44, 120, 20, [0x3a3468, 0x2a2a4a][i % 2]);
        c.plate(panelTex({
            w: 384, h: 128, bg: '#0b0920', accent: A, align: 'center',
            title: e.queueLabel || 'TASK QUEUE', titleSize: 28,
            lines: [e.queueLine || '~depth 148 · oldest 4m12s'], lineSize: 20
        }), 130, 44, c.W / 2 - c.WALL / 2 - 5, 58, 120, -Math.PI / 2);

        c.plate(graphTex({
            w: 640, h: 320, accent: A, title: e.title || 'WORKFLOW', sub: e.sub,
            cols: e.cols || [['ingest'], ['plan', 'retrieve'], ['act', 'verify'], ['emit']],
            footer: e.footer
        }), 220, 84, 0, 52, back(c));
        for (let i = 0; i < 4; i++) P.rack(c, 210, -140 + i * 60, e.accent, 44, 74, 30, -1);
        c.npc(c, -230, 170, e.staff?.[0] || { name: 'Flow Eng', role: 'Workflow Engine', color: 0x22d3ee }, 1);
    },

    /** API Vault / Integration Lab / Registry Floor — walls of tool plumbing. */
    apirack(c, e) {
        const A = e.css;
        // two aisles, offset so the gaps line up into a weaving path
        for (let i = 0; i < 7; i++) {
            apiRack(c, -160 + i * 65, -150, 1);
            if (i < 6) apiRack(c, -128 + i * 65, 10, -1);
        }
        for (const lz of [-150, 10]) {
            c.box(c.W - 150, 6, 16, 20, 92, lz, 0x2a2450);
            c.lit(c.W - 170, 1.5, 3, 20, 95, lz, e.accent);
        }
        // integration bench: patch cables between a tool and the thing it calls
        c.box(230, 30, 62, 20, 15, 120, 0x1c1a3c); c.solid(20, 120, 230, 62);
        c.box(236, 4, 68, 20, 32, 120, 0x272254);
        for (let i = 0; i < 6; i++) {
            c.lit(9, 4, 9, -70 + i * 36, 36, 104, [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e][i % 4]);
            c.box(3, 26, 3, -70 + i * 36, 47, 104, [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e][i % 4]);
        }
        c.plate(e.cards
            ? cardsTex({ w: 640, h: 384, accent: A, title: e.title || 'REGISTRY', sub: e.sub, cards: e.cards, perRow: 4 })
            : panelTex({
                w: 640, h: 320, bg: '#0b0a1c', accent: A, grid: true,
                title: e.title || 'API VAULT', titleSize: 30, lines: e.lines || [], lineSize: 22
            }), 230, 84, -20, 52, back(c));
        P.cabinet(c, 235, 150, 40, 60, 26, 0x2a2450, 4);
        c.npc(c, -230, 170, e.staff?.[0] || { name: 'Tool Engineer', role: 'Integration Dev', color: 0xfbbf24 }, 1);
        c.npc(c, 130, 170, e.staff?.[1] || { name: 'API Ops', role: 'Registry', color: 0x3b82f6 }, 1);
    },

    /** Auth Proxy / Guardrail Room / Staging — everything that says no. */
    guard(c, e) {
        const A = e.css;
        // the scanner arch: every request walks through it, and so do you
        for (const s of [-1, 1]) {
            c.box(20, 76, 46, s * 74, 38, -30, 0x2a1c26); c.solid(s * 74, -30, 20, 46);
            c.lit(6, 60, 6, s * 64, 40, -30, e.accent);
        }
        c.box(170, 16, 46, 0, 82, -30, 0x2a1c26);
        c.lit(140, 4, 4, 0, 74, -30, 0xef4444);
        c.lit(120, 1.5, 30, 0, 1.4, -30, 0x4ade80);

        // shield wall — one per policy class
        for (let i = 0; i < 5; i++) {
            shield(c, -160 + i * 80, 58, -c.D / 2 + c.WALL / 2 + 6,
                [0xef4444, 0xfbbf24, 0x4ade80, 0x22d3ee, 0xa855f7][i], 1.15);
        }
        c.plate(metersTex({
            w: 512, h: 288, accent: A, title: e.title || 'RATE LIMITS', sub: e.sub,
            rows: e.meters || [{ label: 'tokens / min', v: 0.62 }, { label: 'tool calls / min', v: 0.88 },
            { label: 'spend cap', v: 0.41 }, { label: 'egress', v: 0.24 }]
        }), 170, 80, 0, 50, back(c));
        // human-in-the-loop desk: the approve/deny button lives on a real desk
        c.box(150, 32, 54, -130, 16, 100, 0x2a1c26); c.solid(-130, 100, 150, 54);
        c.box(156, 4, 60, -130, 34, 100, 0x3a2632);
        P.screen(c, -130, 54, 72, 46, 28, 0xef4444, 2.4, 1);
        c.lit(14, 6, 14, -90, 38, 100, 0x4ade80);
        c.lit(14, 6, 14, -170, 38, 100, 0xef4444);
        P.chair(c, -130, 146, 0x3a3040, 1);
        // quarantine cages for the runs that failed policy
        for (let i = 0; i < 3; i++) {
            const x = 100 + (i % 2) * 90, z = 60 + Math.floor(i / 2) * 80;
            c.box(58, 54, 58, x, 27, z, 0x1e1824); c.solid(x, z, 58, 58);
            for (let bx = 0; bx < 5; bx++) c.lit(1.8, 46, 1.8, x - 22 + bx * 11, 28, z + 30, 0xf87171);
            c.lit(30, 3, 1, x, 56, z + 30, 0xef4444);
        }
        c.plate(panelTex({
            w: 384, h: 224, bg: '#140a10', accent: '#f87171', align: 'center',
            title: 'QUARANTINE', titleSize: 26, lines: ['!3 runs held', '~pending review'], lineSize: 20
        }), 110, 62, c.W / 2 - c.WALL / 2 - 5, 62, 100, -Math.PI / 2);
        c.npc(c, -230, 190, e.staff?.[0] || { name: 'Guardrail Eng', role: 'Safety & Alignment', color: 0xef4444 }, 1);
    },

    /** Eval Pit / Benchmark Hall / Arena Floor — agents graded in public. */
    bench(c, e) {
        const A = e.css;
        // the arena: a raised slab with tiered benches on three sides
        c.box(190, 10, 170, 0, 5, -30, 0x14211c); c.solid(0, -30, 190, 170);
        c.lit(180, 1.5, 160, 0, 10.6, -30, 0x0e2a20);
        for (const s of [-1, 1]) c.lit(4, 3, 166, s * 96, 11, -30, e.accent);
        c.lit(194, 3, 4, 0, 11, -116, e.accent);
        for (let r = 0; r < 2; r++) {
            const off = 118 + r * 32, h = 12 + r * 12;
            for (const s of [-1, 1]) {
                c.box(30, h, 190, s * off, h / 2, -30, 0x1f2937); c.solid(s * off, -30, 30, 190);
            }
            c.box(2 * off, h, 30, 0, h / 2, -30 - off, 0x1f2937);
        }
        // two contenders, mid-run
        pod(c, -52, -30, 0x4ade80, 58, 60, 56);
        pod(c, 52, -30, 0x22d3ee, 58, 60, 56);
        c.lit(16, 26, 12, -52, 22, -30, 0x4ade80);
        c.lit(16, 26, 12, 52, 22, -30, 0x22d3ee);

        c.plate(barsTex({
            w: 512, h: 320, accent: A, title: e.title || 'LEADERBOARD', sub: e.sub,
            rows: e.rows || [{ label: 'SWE-bench', v: 0.82 }, { label: 'GAIA', v: 0.71, col: '#22d3ee' },
            { label: 'WebArena', v: 0.58, col: '#fbbf24' }, { label: 'OSWorld', v: 0.38, col: '#f87171' },
            { label: 'τ-bench', v: 0.66, col: '#a855f7' }]
        }), 210, 76, 0, 54, back(c));
        // score pylons, parked in front of the tiers so they miss the lift lane
        for (const s of [-1, 1]) P.pylon(c, s * 170, 130, 74, s > 0 ? 0x4ade80 : 0x22d3ee, 30);
        // judges' bench by the door
        c.box(160, 30, 46, 20, 15, 160, 0x1f2937); c.solid(20, 160, 160, 46);
        c.box(166, 4, 52, 20, 32, 160, 0x2b3a44);
        for (let i = -1; i <= 1; i++) P.chair(c, 20 + i * 52, 196, 0x334155, -1);
        c.npc(c, -160, 120, e.staff?.[0] || { name: 'Sandbox Eng', role: 'Eval & Benchmarks', color: 0x4ade80 }, 1);
        c.npc(c, 160, 130, e.staff?.[1] || { name: 'Eval Lead', role: 'Scoring', color: 0x22d3ee }, 1);
    },

    /** Replay Room / Observation Deck — six screens of somebody else's trace. */
    replay(c, e) {
        const A = e.css;
        c.box(c.W - 120, 92, 5, 0, 54, back(c) - 3, 0x05070d);
        const traces = e.traces || [
            ['~tool: web.search', '+200 ok · 412ms', '~tool: fs.read', '!denied by policy', '+retry 1/3'],
            ['+plan accepted', '~subagent spawn', '+merge clean', '~ctx 41%'],
            ['!timeout 30s', '~backoff 2s', '+recovered', '+task done'],
            ['~embed 1.2k docs', '+index built', '~cosine 0.91'],
            ['+guard pass', '~human ack', '+shipped'],
            ['!loop x4 detected', '~pruning branch', '+converged']
        ];
        for (let i = 0; i < 6; i++) {
            const x = -180 + (i % 3) * 180, y = i < 3 ? 74 : 38;
            c.plate(logTex({
                w: 384, h: 256, accent: A, title: 'TRACE ' + (i + 1), stamps: false,
                lines: traces[i % traces.length], lineSize: 22
            }), 150, 32, x, y, back(c));
        }
        // scrub rail: the timeline of the run laid into the floor
        c.box(c.W - 140, 4, 22, 0, 2, 60, 0x161a24);
        c.lit(c.W - 160, 1.6, 8, 0, 4.4, 60, A === '#94a3b8' ? 0x94a3b8 : e.accent);
        for (let i = 0; i < 9; i++) {
            c.box(5, 12, 5, -200 + i * 50, 6, 60, 0x2a3040);
            c.lit(7, 3, 7, -200 + i * 50, 13, 60, i === 5 ? 0xef4444 : 0x4ade80);
        }
        // viewing row — this floor is for watching, so it has proper seats
        for (let i = 0; i < 5; i++) {
            const x = -180 + i * 90;
            c.box(46, 16, 44, x, 8, 130, 0x232a38); c.solid(x, 130, 46, 44);
            c.box(46, 34, 10, x, 30, 148, 0x2b3444);
        }
        // scrub console
        c.box(120, 30, 44, 190, 15, 190, 0x1c222e); c.solid(190, 190, 120, 44);
        P.screen(c, 190, 48, 170, 40, 22, e.accent, 2.2, 1);
        c.npc(c, -230, 190, e.staff?.[0] || { name: 'Trace Analyst', role: 'Replay', color: 0x94a3b8 }, 1);
    },

    /** Vector Store / Embedding Lab / Episodic Cache / Archive. */
    vector(c, e) {
        const A = e.css;
        // Two rack rows with one bay left out of each, at different ends: the
        // gaps are the only way through, so the floor walks like a stack aisle.
        for (let row = 0; row < 2; row++) {
            const z = -150 + row * 92, skip = row ? 1 : 5;
            for (let i = 0; i < 7; i++) {
                if (i === skip) continue;
                P.rack(c, -140 + i * 58, z, [0xa855f7, 0x8b5cf6, 0x22d3ee][(i + row) % 3], 50, 84, 32, 1);
            }
            c.box(c.W - 150, 6, 16, 34, 90, z, 0x2a2050);
            c.lit(c.W - 170, 1.5, 4, 34, 93, z, e.accent);
        }
        // the embedding well: a helix of lit cells rising through the room —
        // the one prop that makes a memory floor feel unlike a compute floor
        for (let i = 0; i < 26; i++) {
            const a = i * 0.62, y = 6 + i * 3.2;
            c.lit(8, 5, 8, 30 + Math.cos(a) * 32, y, 100 + Math.sin(a) * 32, i % 2 ? 0xa855f7 : 0x22d3ee);
            if (i % 3 === 0) c.box(70, 1.6, 1.6, 30, y, 100, 0x3a3468);
        }
        c.box(84, 6, 84, 30, 3, 100, 0x241f4a); c.solid(30, 100, 84, 84);
        c.plate(panelTex({
            w: 512, h: 288, bg: '#0b071a', accent: A, grid: true,
            title: e.title || 'VECTOR STORE', titleSize: 30, lines: e.lines || [], lineSize: 22
        }), 190, 84, -60, 52, back(c));
        c.plate(barsTex({
            w: 384, h: 256, accent: A, title: 'RECALL', sub: 'k=10',
            rows: e.rows || [{ label: 'precision', v: 0.91 }, { label: 'recall', v: 0.84, col: '#22d3ee' },
            { label: 'latency', v: 0.22, note: '3ms', col: '#4ade80' }]
        }), 130, 84, c.W / 2 - c.WALL / 2 - 5, 54, 60, -Math.PI / 2);
        P.cabinet(c, -235, 190, 40, 58, 26, 0x2a2450, 4);
        c.npc(c, -140, 175, e.staff?.[0] || { name: 'Memory Engineer', role: 'Knowledge Graphs', color: 0xa855f7 }, 1);
    },

    /** Knowledge Graph — a walk-in lattice of nodes and edges. */
    kgraph(c, e) {
        const A = e.css;
        // Lattice rather than a scatter: merged boxes cannot rotate, so only
        // axis-aligned edges are possible — and a regular lattice with gaps
        // punched in it reads as a graph far better than a grid of dots would.
        const NX = 7, NY = 4, NZ = 5;
        const cols = [0xa855f7, 0x22d3ee, 0x4ade80, 0xf43f5e];
        const on = [];
        for (let ix = 0; ix < NX; ix++) {
            on[ix] = [];
            for (let iy = 0; iy < NY; iy++) {
                on[ix][iy] = [];
                for (let iz = 0; iz < NZ; iz++) on[ix][iy][iz] = c.rnd() > 0.32;
            }
        }
        const px = (i) => -186 + i * 62, py = (i) => 34 + i * 15, pz = (i) => -130 + i * 52;
        for (let ix = 0; ix < NX; ix++) for (let iy = 0; iy < NY; iy++) for (let iz = 0; iz < NZ; iz++) {
            if (!on[ix][iy][iz]) continue;
            const col = cols[(ix + iy + iz) % 4];
            c.lit(9, 9, 9, px(ix), py(iy), pz(iz), col);
            if (ix + 1 < NX && on[ix + 1][iy][iz]) c.lit(54, 1.4, 1.4, px(ix) + 31, py(iy), pz(iz), 0x4b4a7a);
            if (iy + 1 < NY && on[ix][iy + 1][iz]) c.lit(1.4, 8, 1.4, px(ix), py(iy) + 7.5, pz(iz), 0x4b4a7a);
            if (iz + 1 < NZ && on[ix][iy][iz + 1]) c.lit(1.4, 1.4, 44, px(ix), py(iy), pz(iz) + 26, 0x4b4a7a);
        }
        // hanging supports so the lattice does not read as floating debris
        for (const hx of [-186, -62, 62, 186]) c.box(2.5, c.H - 90, 2.5, hx, c.H - 12, -130, 0x2a2450);
        // query console under the graph
        c.box(180, 30, 54, 0, 15, 150, 0x1c1638); c.solid(0, 150, 180, 54);
        c.box(186, 4, 60, 0, 32, 150, 0x271f4a);
        P.screen(c, 0, 52, 122, 60, 30, 0xa855f7, 2.4, 1);
        for (const s of [-1, 1]) P.chair(c, s * 60, 190, 0x2c2a52, -1);
        // the lattice fills the back of the room, so the legend goes side-on
        c.plate(graphTex({
            w: 640, h: 320, accent: A, title: e.title || 'KNOWLEDGE GRAPH', sub: e.sub,
            cols: e.cols || [['entity'], ['relation', 'alias'], ['claim', 'source'], ['answer']],
            footer: e.footer || '4.1M nodes · 22.7M edges'
        }), 200, 80, c.W / 2 - c.WALL / 2 - 5, 52, -20, -Math.PI / 2);
        c.plate(panelTex({
            w: 512, h: 224, bg: '#0a0618', accent: A, align: 'center',
            title: 'ONTOLOGY', titleSize: 28, lines: ['~812 conflicts open', '+last merge 04:12'], lineSize: 20
        }), 170, 46, 0, 22, back(c));
        c.npc(c, -232, 178, e.staff?.[0] || { name: 'Graph Ops', role: 'Ontology', color: 0x64748b }, 1);
    },

    /** Pipeline Floor / Release Deck — build to ship, physically. */
    pipeline(c, e) {
        const A = e.css;
        const stages = e.stages || [
            { label: 'BUILD', col: 0x4ade80 }, { label: 'TEST', col: 0x4ade80 },
            { label: 'STAGE', col: 0x22d3ee }, { label: 'GUARD', col: 0xfbbf24 },
            { label: 'SHIP', col: 0xef4444 }
        ];
        // The conveyor stops short of the left wall on purpose — the lift bank
        // lives there and a full-width collider would seal it off.
        c.box(400, 16, 46, 20, 8, -40, 0x1c1622); c.solid(20, -40, 400, 46);
        c.lit(386, 1.6, 30, 20, 17, -40, 0x2a2030);
        for (let i = 0; i < 5; i++) {
            const x = -160 + i * 95, s = stages[i % stages.length];
            for (const sx of [-1, 1]) c.box(12, 72, 54, x + sx * 34, 36, -40, 0x2a2030);
            c.box(92, 12, 54, x, 78, -40, 0x2a2030);
            c.lit(58, 5, 5, x, 70, -40, s.col);
            c.lit(4, 52, 4, x - 27, 40, -12, s.col);
            c.lit(4, 52, 4, x + 27, 40, -12, s.col);
            c.plate(panelTex({
                w: 256, h: 96, bg: '#0d0a12', accent: '#' + s.col.toString(16).padStart(6, '0'),
                align: 'center', title: s.label, titleSize: 30, lines: [s.note || ''], lineSize: 17, padTop: 34
            }), 68, 24, x, 78, -10);
            // an artefact riding this stage
            P.crate(c, x, -40, 22, [0x3a2a2a, 0x2a3040][i % 2]);
        }
        c.plate(pipelineTex({
            w: 640, h: 224, accent: A, title: e.title || 'RELEASE PIPELINE', sub: e.sub,
            stages: e.board || [{ label: 'Build', note: '3m04' }, { label: 'Test', note: '412/412' },
            { label: 'Stage', note: 'canary 5%', state: 'warn' }, { label: 'Guard', note: 'held', state: 'warn' },
            { label: 'Ship', note: 'blocked', state: 'fail' }]
        }), 240, 76, 0, 52, back(c));
        // release desk with the big red button and the rollback lever
        c.box(150, 32, 52, -130, 16, 120, 0x241c26); c.solid(-130, 120, 150, 52);
        c.box(156, 4, 58, -130, 34, 120, 0x33262e);
        P.screen(c, -130, 54, 94, 44, 26, 0xef4444, 2.4, 1);
        c.lit(16, 8, 16, -80, 40, 120, 0xef4444);
        c.box(5, 26, 5, -176, 47, 120, 0x64748b); c.lit(9, 9, 9, -176, 61, 120, 0xfbbf24);
        P.chair(c, -130, 166, 0x3a3040, 1);
        // shipped-artefact shelf by the door
        for (let i = 0; i < 4; i++) P.crate(c, 150 + (i % 2) * 46, 120 + Math.floor(i / 2) * 46, 26, 0x33262e);
        c.plate(metersTex({
            w: 512, h: 224, accent: A, title: 'ERROR BUDGET',
            rows: e.budget || [{ label: 'this window', v: 0.34 }, { label: 'rollback rate', v: 0.11 },
            { label: 'canary health', v: 0.93 }]
        }), 130, 58, c.W / 2 - c.WALL / 2 - 5, 62, 40, -Math.PI / 2);
        c.npc(c, -232, 178, e.staff?.[0] || { name: 'Deploy SRE', role: 'Production Reliability', color: 0xf97316 }, 1);
        c.npc(c, 60, 178, e.staff?.[1] || { name: 'Release Eng', role: 'Rollout', color: 0x4ade80 }, 1);
    }
};

// mood per floor kind: [wall, ceil, floor, lamp]
const MOOD = {
    bridge: [0x1a1440, 0x0b0722, 0x241f4e, 0xa78bfa],
    flow: [0x171436, 0x0a0820, 0x221e46, 0x8b5cf6],
    apirack: [0x1c1830, 0x0d0a1c, 0x272040, 0xfbbf24],
    guard: [0x2a1620, 0x140a10, 0x361e28, 0xef4444],
    bench: [0x14241e, 0x081410, 0x1d3229, 0x4ade80],
    replay: [0x101420, 0x05070d, 0x1a2030, 0x64748b],
    vector: [0x1e1440, 0x0c0620, 0x2a1f56, 0xa855f7],
    kgraph: [0x160f30, 0x080418, 0x231a48, 0xc084fc],
    pipeline: [0x241820, 0x100810, 0x30222a, 0xf97316]
};

// ── per-building floor lists (ground-up) ─────────────────────────────────────

const LAYOUTS = {
    agents_orchestrator: {
        accent: 0xf43f5e, css: '#f43f5e',
        floors: [
            {
                kind: 'bridge', label: 'COMMAND BRIDGE', title: 'FLEET TOPOLOGY', sub: '1,204 agents',
                cols: [['router'], ['planner', 'retriever', 'coder'], ['critic', 'merger'], ['deliver']],
                footer: 'p50 4.1s · p99 91s · 3 swarms degraded',
                staff: [{ name: 'Agent Architect', role: 'System Design', color: 0xf43f5e },
                { name: 'Ops Lead', role: 'Orchestration', color: 0x22d3ee }]
            },
            {
                kind: 'bridge', label: 'OPS DECK', title: 'SWARM HEALTH', sub: '18 swarms',
                cols: [['intake'], ['triage', 'dispatch'], ['workers'], ['audit']],
                footer: 'oncall: ops-lead · bridge 4412',
                fleet: [{ label: 'swarm-a', v: 0.91 }, { label: 'swarm-b', v: 0.64, col: '#22d3ee' },
                { label: 'swarm-c', v: 0.18, col: '#f87171' }, { label: 'swarm-d', v: 0.77, col: '#a855f7' }],
                log: ['+swarm-d scaled 40→64', '~swarm-b rebalancing', '!swarm-c stuck on tool auth',
                    '+nightly evals green'],
                staff: [{ name: 'Ops Lead', role: 'Orchestration', color: 0x22d3ee },
                { name: 'Duty Officer', role: 'Escalations', color: 0xfbbf24 }]
            },
            {
                kind: 'flow', label: 'TASK QUEUE', title: 'DISPATCH', sub: 'fair-share',
                cols: [['submit'], ['priority', 'batch'], ['lease'], ['ack']],
                queueLabel: 'TASK QUEUE', queueLine: '~depth 148 · oldest 4m12s',
                staff: [{ name: 'Queue Ops', role: 'Scheduling', color: 0xfbbf24 }]
            },
            {
                kind: 'flow', label: 'WORKFLOW ENGINE', title: 'GRAPH COMPILER', sub: 'v4.2',
                cols: [['parse'], ['plan', 'expand'], ['schedule', 'checkpoint'], ['run']],
                queueLabel: 'PENDING GRAPHS', queueLine: '~62 compiled · 4 cyclic, rejected',
                staff: [{ name: 'Flow Eng', role: 'Workflow Engine', color: 0x22d3ee }]
            },
            {
                kind: 'bridge', label: 'SWARM CONTROL', title: 'SWARM CONTROL', sub: 'multi-agent',
                cols: [['leader'], ['scout', 'builder', 'tester'], ['reviewer'], ['commit']],
                footer: 'consensus: 4/5 · handoffs 22k/hr',
                log: ['~leader election done', '+scout found 3 candidates', '~builder holds lock',
                    '!tester flake x2', '+commit merged'],
                staff: [{ name: 'Swarm Lead', role: 'Multi-Agent Systems', color: 0x8b5cf6 },
                { name: 'Ops Lead', role: 'Orchestration', color: 0x22d3ee }]
            },
            {
                kind: 'flow', label: 'AGENT BUS', title: 'MESSAGE BUS', sub: 'a2a + mcp',
                cols: [['publish'], ['topic', 'fanout'], ['deliver', 'retry'], ['ack']],
                queueLabel: 'BUS BACKLOG', queueLine: '+lag 41ms · dead letters 0',
                staff: [{ name: 'Bus Eng', role: 'Transport', color: 0xa855f7 }]
            }
        ]
    },
    agents_toolshop: {
        accent: 0xfbbf24, css: '#fbbf24',
        floors: [
            {
                kind: 'apirack', label: 'REGISTRY FLOOR', title: 'FRAMEWORK REGISTRY', sub: '2,400 tools',
                // the real 2026 frameworks the 2D registry floor lists
                cards: [
                    { name: 'Claude SDK', sub: 'Anthropic', stat: 'MCP native', col: '#d97706' },
                    { name: 'AgentKit', sub: 'OpenAI', stat: 'Operator', col: '#4ade80' },
                    { name: 'Devin', sub: 'Cognition', stat: 'autonomous SWE', col: '#8b5cf6' },
                    { name: 'Manus', sub: 'Xiao Hong', stat: 'general agent', col: '#f43f5e' },
                    { name: 'LangGraph', sub: 'Harrison Chase', stat: 'stateful graphs', col: '#22d3ee' },
                    { name: 'CrewAI', sub: 'João Moura', stat: 'role crews', col: '#ec4899' },
                    { name: 'Composio', sub: 'Karan Vaidya', stat: 'tool auth', col: '#a855f7' },
                    { name: 'n8n', sub: 'Jan Oberhauser', stat: 'workflow', col: '#ef4444' }
                ],
                staff: [{ name: 'Tool Engineer', role: 'Integration Dev', color: 0xfbbf24 },
                { name: 'Registrar', role: 'Catalogue', color: 0x3b82f6 }]
            },
            {
                kind: 'guard', label: 'AUTH PROXY', title: 'TOKEN BROKER', sub: 'oauth · scoped',
                meters: [{ label: 'active grants', v: 0.58 }, { label: 'scope escalations', v: 0.14 },
                { label: 'expiring < 24h', v: 0.79 }, { label: 'revoked today', v: 0.09 }],
                staff: [{ name: 'API Ops', role: 'Auth Proxy', color: 0x3b82f6 }]
            },
            {
                kind: 'apirack', label: 'INTEGRATION LAB', title: 'INTEGRATION LAB', sub: 'bench 6',
                lines: ['~new connector: ERP · draft', '+contract tests 118/118',
                    '!vendor rate limit halved', '~schema drift watch on 12 tools'],
                staff: [{ name: 'Tool Engineer', role: 'Integration Dev', color: 0xfbbf24 }]
            },
            {
                kind: 'apirack', label: 'API VAULT', title: 'API VAULT', sub: 'sealed',
                lines: ['+2,412 tools indexed', '~914 require human approval',
                    '!17 deprecated, sunset Q3', '+signing keys rotated'],
                staff: [{ name: 'Vault Keeper', role: 'Secrets', color: 0xa855f7 }]
            }
        ]
    },
    agents_sandbox: {
        accent: 0x4ade80, css: '#4ade80',
        floors: [
            {
                kind: 'bench', label: 'ARENA FLOOR', title: 'ARENA STANDINGS', sub: 'season 6',
                staff: [{ name: 'Sandbox Engineer', role: 'Eval & Benchmarks', color: 0x4ade80 },
                { name: 'Referee', role: 'Rules', color: 0xf1f5f9 }]
            },
            {
                kind: 'replay', label: 'OBSERVATION DECK', title: 'OBSERVATION',
                staff: [{ name: 'Trace Analyst', role: 'Observation Deck', color: 0x94a3b8 }]
            },
            {
                kind: 'replay', label: 'REPLAY ROOM', title: 'REPLAY',
                staff: [{ name: 'Replay Eng', role: 'Determinism', color: 0x22d3ee }]
            },
            {
                kind: 'bench', label: 'BENCHMARK HALL', title: 'BENCHMARK HALL', sub: 'nightly',
                rows: [{ label: 'SWE-bench V', v: 0.82 }, { label: 'GAIA L3', v: 0.44, col: '#22d3ee' },
                { label: 'WebArena', v: 0.58, col: '#fbbf24' }, { label: 'OSWorld', v: 0.38, col: '#f87171' },
                { label: 'τ-bench', v: 0.66, col: '#a855f7' }],
                staff: [{ name: 'Eval Lead', role: 'Scoring', color: 0x22d3ee }]
            },
            {
                kind: 'bench', label: 'EVAL PIT', title: 'HEAD TO HEAD', sub: 'sealed runs',
                rows: [{ label: 'candidate', v: 0.79 }, { label: 'incumbent', v: 0.74, col: '#22d3ee' },
                { label: 'ensemble', v: 0.86, col: '#a855f7' }, { label: 'human base', v: 0.91, col: '#fbbf24' }],
                staff: [{ name: 'Swarm Lead', role: 'Multi-Agent Systems', color: 0x8b5cf6 }]
            }
        ]
    },
    agents_deploy: {
        accent: 0xef4444, css: '#ef4444',
        floors: [
            {
                kind: 'pipeline', label: 'RELEASE DECK', title: 'RELEASE PIPELINE', sub: 'prod',
                staff: [{ name: 'Deploy SRE', role: 'Production Reliability', color: 0xf97316 },
                { name: 'Release Eng', role: 'Rollout', color: 0x4ade80 }]
            },
            {
                kind: 'pipeline', label: 'PIPELINE FLOOR', title: 'BUILD PIPELINE', sub: 'main',
                board: [{ label: 'Lint', note: 'clean' }, { label: 'Unit', note: '4,102' },
                { label: 'Integr', note: '96%', state: 'warn' }, { label: 'Pack', note: 'signed' },
                { label: 'Promote', note: 'queued' }],
                budget: [{ label: 'queue wait', v: 0.28 }, { label: 'cache hit', v: 0.86 },
                { label: 'flaky rate', v: 0.07 }],
                staff: [{ name: 'Build Eng', role: 'CI', color: 0x22d3ee }]
            },
            {
                kind: 'guard', label: 'GUARDRAIL ROOM', title: 'GUARDRAILS', sub: 'policy v9',
                meters: [{ label: 'blocked actions / hr', v: 0.44 }, { label: 'human approvals', v: 0.71 },
                { label: 'spend cap', v: 0.88 }, { label: 'egress denials', v: 0.19 }],
                staff: [{ name: 'Guardrail Engineer', role: 'Safety & Alignment', color: 0xef4444 }]
            },
            {
                kind: 'guard', label: 'STAGING', title: 'STAGING GATES', sub: 'canary',
                meters: [{ label: 'canary traffic', v: 0.05, cap: '5%' }, { label: 'error delta', v: 0.12 },
                { label: 'latency delta', v: 0.31 }, { label: 'soak remaining', v: 0.66 }],
                staff: [{ name: 'Deploy SRE', role: 'Production Reliability', color: 0xf97316 }]
            }
        ]
    },
    agents_memory: {
        accent: 0xa855f7, css: '#a855f7',
        floors: [
            {
                kind: 'vector', label: 'ARCHIVE', title: 'COLD ARCHIVE', sub: 'tape',
                lines: ['+41 PB sealed', '~restore SLA 6h', '!shelf 12 — media EOL', '+integrity scrub clean'],
                rows: [{ label: 'restores/day', v: 0.14, note: '31' }, { label: 'shelf use', v: 0.77, col: '#22d3ee' },
                { label: 'scrub queue', v: 0.09, col: '#4ade80' }],
                staff: [{ name: 'Archivist', role: 'Cold Storage', color: 0x64748b }]
            },
            {
                kind: 'vector', label: 'EPISODIC CACHE', title: 'EPISODIC CACHE', sub: 'ttl 30d',
                lines: ['+hit ratio 88.1%', '~evictions 4.2k/hr', '!one agent hoarding 12 GB',
                    '+compaction done'],
                rows: [{ label: 'hit ratio', v: 0.88 }, { label: 'evictions', v: 0.42, col: '#fbbf24' },
                { label: 'p99 read', v: 0.18, note: '6ms', col: '#4ade80' }],
                staff: [{ name: 'Cache Eng', role: 'Episodic Memory', color: 0x22d3ee }]
            },
            {
                kind: 'kgraph', label: 'KNOWLEDGE GRAPH', title: 'KNOWLEDGE GRAPH', sub: 'ontology v7',
                cols: [['entity'], ['relation', 'alias'], ['claim', 'source'], ['answer']],
                footer: '4.1M nodes · 22.7M edges · 812 conflicts open',
                staff: [{ name: 'Graph Ops', role: 'Ontology', color: 0x64748b }]
            },
            {
                kind: 'vector', label: 'EMBEDDING LAB', title: 'EMBEDDING LAB', sub: '3072-d',
                lines: ['~reindexing corpus 4 of 9', '+drift check passed',
                    '!two models, one index — migrate', '+quantised to int8'],
                rows: [{ label: 'throughput', v: 0.72, note: '18k/s' }, { label: 'drift', v: 0.21, col: '#fbbf24' },
                { label: 'index age', v: 0.35, note: '9d', col: '#22d3ee' }],
                staff: [{ name: 'Memory Engineer', role: 'Embeddings', color: 0xa855f7 }]
            },
            {
                kind: 'vector', label: 'VECTOR STORE', title: 'VECTOR STORE', sub: 'hnsw',
                lines: ['+1.2B vectors resident', '~shard 7 rebalancing', '+replica lag 40ms',
                    '!ef_search raised for recall'],
                staff: [{ name: 'Memory Engineer', role: 'Knowledge Graphs', color: 0xa855f7 }]
            }
        ]
    }
};

/** Build a registry spec from a floor list. One spec per building, because
 *  storey counts differ and `_floorsFor` reads them off the spec. */
function makeSpec(id, L) {
    for (const e of L.floors) { e.accent = e.accent || L.accent; e.css = e.css || L.css; }
    return {
        id,
        theme(b, f, th) {
            const e = L.floors[Math.max(0, Math.min(L.floors.length - 1, f))];
            const m = MOOD[e.kind] || MOOD.bridge;
            th.cat = 'agents'; th.dim = true;
            th.wall = m[0]; th.ceil = m[1]; th.floor = m[2]; th.lamp = m[3];
            th.accent = e.css;
        },
        floors: L.floors.map((e) => ({
            key: e.kind + '_' + e.label.toLowerCase().replace(/\W+/g, '_'),
            label: e.label,
            build: (c) => KIND[e.kind](c, e)
        }))
    };
}

export const AGENT_ROOMS = {};
for (const id of Object.keys(LAYOUTS)) AGENT_ROOMS[id] = makeSpec(id, LAYOUTS[id]);

/** Any other agents_* building borrows the Orchestration Hub's stack. */
export function agentRoom(b) {
    return AGENT_ROOMS[b?.id] || AGENT_ROOMS.agents_orchestrator;
}
