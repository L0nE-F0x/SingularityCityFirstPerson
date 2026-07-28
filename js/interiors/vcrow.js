/* ══════════════════════════════════════════════════════════════════════════
   VC ROW — ported from pixi/js/interior_vcrow.js.

   Nine buildings, and the firms are the real ones (see BLDS in data.js), so
   the rooms are branded rather than generic: the accent, the lobby crest and
   the copy on the walls come from the firm, and the storey list is the firm's
   shape — YC is three floors of accelerator, SoftBank is a tower that starts
   at a vault.

   Floor kinds mirror the 2D module's THEMES table one for one. Where 2D
   aliased a theme (client_offices → partner offices, broker_floor and
   trading_room → trading floor) this does the same, because the difference
   really is only the people in it.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, sealTex, vistaTex, nameTex } from './kit.js';
import { barsTex, logTex, metersTex, cardsTex, chartTex, graphTex } from './screens.js';

const back = (c) => -c.D / 2 + c.WALL / 2 + 3;

// ── Row props ───────────────────────────────────────────────────────────────

/** Scrolling price ribbon around the room. The Row's ambient noise, in light. */
function ticker(c, y, col = 0x4ade80, alt = 0xf43f5e) {
    for (const sz of [-1, 1]) {
        c.box(c.W - 40, 9, 4, 0, y, sz * (c.D / 2 - 16), 0x0a0f18);
        for (let i = 0; i < 18; i++) {
            c.lit(16, 4, 1.4, -240 + i * 28, y, sz * (c.D / 2 - 18.6), (i + (sz > 0 ? 1 : 0)) % 3 ? col : alt);
        }
    }
    for (const sx of [-1, 1]) {
        c.box(4, 9, c.D - 60, sx * (c.W / 2 - 16), y, 0, 0x0a0f18);
        for (let i = 0; i < 12; i++) {
            c.lit(1.4, 4, 16, sx * (c.W / 2 - 18.6), y, -180 + i * 33, i % 3 ? alt : col);
        }
    }
}

/** Trading pod: a desk with a stacked bank of monitors. Four to a cluster. */
function tradeDesk(c, x, z, face = 1, col = 0x22d3ee) {
    c.box(110, 30, 62, x, 15, z, 0x18202e); c.solid(x, z, 110, 62);
    c.box(116, 4, 68, x, 32, z, 0x232d3e);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) {
        const mx = x - 26 + i * 52, my = 48 + r * 26;
        c.box(46, 24, 3, mx, my, z - face * 22, 0x0b0f18);
        c.lit(41, 19, 1.2, mx, my, z - face * 23.4, [col, 0x4ade80, 0xf43f5e, 0xfbbf24][(r * 2 + i) % 4]);
    }
    c.box(56, 3, 12, x, 35, z + face * 12, 0x94a3b8);            // keyboard tray
    P.chair(c, x, z + face * 44, 0x2b3546, face);
}

/** Glass-fronted office along a wall. Partner floors are a row of these. */
function glassOffice(c, x, z, w = 130, d = 96, accent = 0xfbbf24, face = 1) {
    for (const sx of [-1, 1]) c.box(6, 84, d, x + sx * (w / 2), 42, z, 0x1d2635);
    c.box(w, 84, 6, x, 42, z - face * (d / 2), 0x1d2635);
    // mullions only where the glass would be, so you can see the occupant
    for (let i = 0; i < 5; i++) c.box(3, 84, 3, x - w / 2 + 14 + i * ((w - 28) / 4), 42, z + face * (d / 2), 0x2b3546);
    c.box(w, 6, 8, x, 84, z + face * (d / 2), 0x2b3546);
    c.lit(w - 12, 1.6, 2, x, 80, z + face * (d / 2 - 2), accent);
    // the office itself
    P.desk(c, x, z - face * 14, 0x3a2f22, accent);
    P.bookshelf(c, x - w / 2 + 22, z - face * (d / 2 - 20), 70, 62, 22, 0);
    P.plant(c, x + w / 2 - 24, z - face * (d / 2 - 22), 40);
    c.solid(x, z, w + 8, d);
}

/** Deposit-box wall — the vault's whole personality. */
function depositWall(c, z, face = 1, accent = 0xfbbf24) {
    c.box(c.W - 80, 88, 22, 0, 44, z, 0x2b3241); c.solid(0, z, c.W - 80, 22);
    for (let r = 0; r < 7; r++) for (let i = 0; i < 22; i++) {
        c.box(18, 9, 2, -230 + i * 21, 10 + r * 12, z + face * 11.6, r % 2 ? 0x3d4658 : 0x353d4d);
        c.lit(2.5, 2.5, 1, -230 + i * 21 + 6, 10 + r * 12, z + face * 12.6, (i + r) % 5 ? 0x64748b : accent);
    }
}

/** Free-standing price pillar for the crypto floor. Reads from anywhere. */
function pricePillar(c, x, z, sym, col, h = 84) {
    c.box(30, h, 30, x, h / 2, z, 0x0a0d14); c.solid(x, z, 30, 30);
    for (const sz of [-1, 1]) c.lit(24, h - 20, 1.4, x, h / 2 + 4, z + sz * 15.8, col);
    for (const sx of [-1, 1]) c.lit(1.4, h - 20, 24, x + sx * 15.8, h / 2 + 4, z, col);
    c.lit(34, 4, 34, x, h + 3, z, col);
    c.plate(panelTex({
        w: 256, h: 256, bg: '#05070c', accent: '#' + col.toString(16), align: 'center',
        title: sym, titleSize: 46, lines: ['~LIVE'], lineSize: 20, padTop: 70
    }), 26, 26, x, h * 0.72, z + 16.4);
}

// ── floor kinds ─────────────────────────────────────────────────────────────

const KIND = {

    /** RECEPTION — the crest, the couch, and somebody deciding if you're in. */
    reception(c, e) {
        P.counter(c, -70, -150, 200, 58, 0x1b2330, 0x2a3547, e.accent);
        c.plate(sealTex(e.glyph || '◆', e.firm, e.tagline || 'VC ROW', e.css), 84, 84, -70, 68, back(c));
        // brand band and the awards shelf
        c.lit(c.W - 90, 5, 2, 0, 100, back(c), e.accent);
        for (let i = 0; i < 3; i++) {
            c.box(50, 4, 22, 150 + 0, 40 + i * 22, -c.D / 2 + 22, 0x2a3547);
            for (let t = 0; t < 3; t++) c.lit(9, 12, 9, 128 + t * 22, 48 + i * 22, -c.D / 2 + 22, e.accent);
        }
        // waiting lounge
        for (let i = 0; i < 2; i++) {
            const z = 20 + i * 90;
            c.box(180, 20, 56, -110, 10, z, 0x25303f); c.solid(-110, z, 180, 56);
            c.box(180, 36, 12, -110, 30, z - 24, 0x2d394a);
            c.lit(160, 1.6, 44, -110, 21, z, 0x36445a);
        }
        P.table(c, -110, 75, 90, 44, 0x1f2836, 22);
        c.box(40, 4, 26, -110, 26, 75, 0xdfe6ea);                     // press clippings
        P.turnstile(c, 130, 40, 0x4ade80);
        P.turnstile(c, 130, 130, 0x4ade80);
        c.plate(cardsTex({
            w: 640, h: 288, accent: e.css, title: 'PORTFOLIO', sub: e.firm, perRow: 3,
            cards: e.portfolio || []
        }), 200, 90, 190, 58, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        P.plant(c, 245, -60, 62); P.plant(c, -245, 160, 62);
        c.npc(c, -70, -108, { name: 'Receptionist', role: e.firm, color: 0x94a3b8 }, 1);
        c.npc(c, 180, 120, { name: 'Security', role: 'Front of House', color: 0xef4444 }, -1);
    },

    /** DEAL ROOM — one long table and a term sheet nobody has signed yet. */
    deal_room(c, e) {
        c.box(300, 8, 90, -20, 30, -40, 0x2a1f14); c.solid(-20, -40, 300, 90);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(14, 30, 14, -20 + sx * 132, 15, -40 + sz * 32, 0x1f1810);
        for (let i = 0; i < 5; i++) {
            P.chair(c, -160 + i * 70, 30, 0x2b3546, -1);
            P.chair(c, -160 + i * 70, -110, 0x2b3546, 1);
            c.box(22, 2, 16, -160 + i * 70, 35, -66, 0xe8eef4);        // printed decks
            c.box(22, 2, 16, -160 + i * 70, 35, -14, 0xe8eef4);
        }
        c.lit(280, 2, 6, -20, 36, -40, e.accent);                      // table light strip
        for (let i = 0; i < 3; i++) { c.box(10, 8, 10, -120 + i * 100, c.H - 14, -40, 0x1b2330); c.lit(22, 5, 22, -120 + i * 100, c.H - 20, -40, 0xfff2d8); }
        c.plate(barsTex({
            w: 768, h: 320, accent: e.css, title: 'CAP TABLE', sub: 'post-money',
            rows: [{ label: 'founders', v: 0.42 }, { label: 'this round', v: 0.18, col: '#fbbf24' },
            { label: 'prior rounds', v: 0.26, col: '#22d3ee' }, { label: 'option pool', v: 0.11 },
            { label: 'advisors', v: 0.03, col: '#94a3b8' }]
        }), 250, 104, -20, 66, back(c));
        c.plate(panelTex({
            w: 512, h: 288, bg: '#f4f2ee', accent: e.css, grid: true, gridColor: 'rgba(90,90,110,0.15)',
            title: 'TERM SHEET', titleSize: 28, titleColor: '#241f1a', lineColor: '#33302c',
            lines: ['~1x non-participating preferred', '+pro rata for existing',
                '!board seat — still arguing', '~30-day exclusivity'], lineSize: 21
        }), 160, 90, c.W / 2 - c.WALL / 2 - 5, 58, 60, -Math.PI / 2);
        P.cabinet(c, -230, 150, 70, 60, 30, 0x2a3547, 3);
        c.box(60, 4, 30, -230, 63, 150, 0x1b2330);
        c.lit(30, 6, 12, -230, 70, 150, 0xfbbf24);                     // coffee flask
        c.npc(c, 120, 150, { name: 'VC Partner', role: e.firm, color: 0x4ade80 }, -1);
        c.npc(c, -90, 165, { name: 'Analyst', role: 'Diligence', color: 0x22d3ee }, -1);
    },

    /** PARTNER OFFICES — glass boxes and a corridor of closed doors. */
    partner_offices(c, e) {
        for (let i = 0; i < 3; i++) glassOffice(c, -170 + i * 170, -140, 150, 100, e.accent, 1);
        for (let i = 0; i < 2; i++) glassOffice(c, -90 + i * 190, 150, 150, 100, e.accent, -1);
        // corridor runner and the wall of framed exits
        c.box(c.W - 120, 1.8, 70, 0, 1, 10, 0x3a2a2a);
        for (let i = 0; i < 4; i++) {
            P.frame(c, -180 + i * 120, 56, back(c) + 1, 60, 40, 0x6b5136, [0x1e3a5f, 0x143a2a, 0x3a2a14, 0x2a1f3a][i], 1);
            c.plate(nameTex(['ACQUIRED', 'IPO 2024', '10x', 'WRITE-OFF'][i], ['$4.1B', '$18B', 'seed', 'it happens'][i], e.css),
                58, 16, -180 + i * 120, 32, back(c) + 1);
        }
        c.plate(panelTex({
            w: 512, h: 224, bg: '#0d1420', accent: e.css,
            title: 'PARTNER MEETING', titleSize: 28,
            lines: ['~Monday 08:00, no exceptions', '+3 new deals on the agenda',
                '!one re-up nobody wants to defend'], lineSize: 21
        }), 160, 70, c.W / 2 - c.WALL / 2 - 5, 58, 20, -Math.PI / 2);
        c.npc(c, -170, -60, { name: 'General Partner', role: e.firm, color: 0xfbbf24 }, 1);
        c.npc(c, 40, 70, { name: 'Associate', role: 'Sourcing', color: 0x4ade80 }, 1);
    },

    /** FUND OPS — capital calls, LP letters, and the least glamorous floor. */
    fund_ops(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
            const x = -180 + i * 120, z = -130 + row * 110;
            // low cubicle walls, so the floor reads as admin rather than open plan
            for (const sx of [-1, 1]) c.box(5, 46, 74, x + sx * 52, 23, z, 0x36404f);
            c.box(104, 46, 5, x, 23, z - 38, 0x36404f);
            P.desk(c, x, z, 0x2a3242, 0x22d3ee);
            c.solid(x, z, 110, 80);
        }
        for (let i = 0; i < 5; i++) P.cabinet(c, -200 + i * 46, 150, 44, 66, 28, 0x475569, 4);
        for (let i = 0; i < 6; i++) P.crate(c, 90 + (i % 3) * 36, 150 + Math.floor(i / 3) * 36, 28, 0x6b5136);
        c.plate(metersTex({
            w: 640, h: 288, accent: e.css, title: 'CAPITAL CALLS', sub: 'fund VIII',
            rows: [{ label: 'committed', v: 1, cap: '$4.2B' }, { label: 'called', v: 0.58 },
            { label: 'deployed', v: 0.44 }, { label: 'reserves', v: 0.31, cap: 'held' }]
        }), 230, 104, -20, 64, back(c));
        c.plate(logTex({
            w: 512, h: 288, accent: e.css, title: 'LP LETTERS', sub: 'Q3',
            lines: ['+41 sent, 39 acknowledged', '~one LP asking about markdowns',
                '!audit sample requested', '+K-1s on schedule']
        }), 160, 90, c.W / 2 - c.WALL / 2 - 5, 58, 40, -Math.PI / 2);
        c.npc(c, -240, 60, { name: 'Controller', role: 'Fund Ops', color: 0x94a3b8 }, 1);
        c.npc(c, 210, 100, { name: 'Compliance', role: 'Reg D', color: 0xa855f7 }, -1);
    },

    /** ANALYTICS — quants, and the charts they are paid to believe in. */
    analytics(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
            tradeDesk(c, -180 + i * 120, -130 + row * 120, 1, 0x22d3ee);
        }
        c.plate(chartTex({
            w: 768, h: 320, accent: e.css, title: 'SECTOR MULTIPLES', sub: 'forward ARR',
            series: [{ pts: [0.3, 0.42, 0.51, 0.62, 0.58, 0.71, 0.79, 0.74, 0.83], col: '#22d3ee' },
            { pts: [0.28, 0.3, 0.36, 0.34, 0.4, 0.44, 0.42, 0.47, 0.5], col: '#fbbf24', w: 2 },
            { pts: [0.6, 0.55, 0.48, 0.41, 0.37, 0.3, 0.26, 0.22, 0.18], col: '#f87171', w: 2 }],
            legend: [{ label: 'AI infra', col: '#22d3ee' }, { label: 'apps', col: '#fbbf24' }, { label: 'SaaS', col: '#f87171' }]
        }), 250, 104, -20, 66, back(c));
        c.plate(graphTex({
            w: 576, h: 288, accent: e.css, title: 'SIGNAL GRAPH', sub: 'sourcing',
            cols: [['github'], ['hiring', 'papers'], ['score', 'warm intro'], ['first call']]
        }), 180, 90, c.W / 2 - c.WALL / 2 - 5, 58, 60, -Math.PI / 2);
        ticker(c, 88, 0x22d3ee, 0xf43f5e);
        c.npc(c, -60, 130, { name: 'Quant', role: 'Valuation', color: 0x22d3ee }, -1);
        c.npc(c, 180, 150, { name: 'Data Engineer', role: 'Signals', color: 0x06b6d4 }, -1);
    },

    /** TRADING FLOOR — the loudest room on the Row. */
    trading_floor(c, e) {
        for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
            tradeDesk(c, -180 + i * 120, -160 + row * 105, 1, [0xf43f5e, 0x4ade80, 0x22d3ee][row]);
        }
        ticker(c, 84, 0x4ade80, 0xf43f5e);
        // the big board over the pit
        const boards = [
            logTex({ w: 384, h: 288, accent: '#4ade80', title: 'BLOTTER', lines: ['+BUY 4.1k OPENAI-S', '~SELL 900 ANTH-P', '!halt: MODEL-IDX', '+fill 22.41'] }),
            barsTex({ w: 384, h: 288, accent: '#22d3ee', title: 'VOLUME', rows: [{ label: 'pre-IPO', v: 0.82 }, { label: 'compute fut', v: 0.61 }, { label: 'model idx', v: 0.34 }] }),
            metersTex({ w: 384, h: 288, accent: '#f43f5e', title: 'RISK', rows: [{ label: 'gross', v: 0.78 }, { label: 'net', v: 0.42 }, { label: 'VaR', v: 0.91, cap: 'breach' }] })
        ];
        for (let i = 0; i < 3; i++) {
            const x = -160 + i * 160;
            c.box(140, 84, 6, x, 58, -c.D / 2 + 19, 0x080c14);
            c.plate(boards[i], 132, 78, x, 58, -c.D / 2 + 23);
        }
        c.lit(c.W - 70, 2, 3, 0, 104, -c.D / 2 + 30, 0xf43f5e);
        c.npc(c, -240, 190, { name: 'Floor Trader', role: 'Pre-IPO Desk', color: 0xef4444 }, 1);
        c.npc(c, 60, 195, { name: 'Broker', role: 'Client Flow', color: 0x22d3ee }, -1);
        c.npc(c, 230, 180, { name: 'Algo Bot', role: 'Market Making', color: 0x4ade80 }, -1);
    },

    /** COWORKING — YC's actual product: desks, and other founders at them. */
    coworking(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 2; i++) {
            const x = -110 + i * 220, z = -140 + row * 110;
            P.table(c, x, z, 190, 74, 0x8a6a45, 28);
            for (let s = 0; s < 3; s++) {
                c.box(28, 18, 3, x - 62 + s * 62, 42, z - 16, 0x111827);   // laptops
                c.lit(24, 14, 1.2, x - 62 + s * 62, 42, z - 14.6, [0x4ade80, 0x22d3ee, 0xfbbf24][s]);
                c.box(26, 3, 18, x - 62 + s * 62, 31, z + 4, 0x94a3b8);
                P.chair(c, x - 62 + s * 62, z + 44, 0x36404f, 1);
            }
        }
        // whiteboards, snacks, and a table-tennis table that never gets used
        for (let i = 0; i < 3; i++) {
            c.plate(panelTex({
                w: 512, h: 320, bg: '#f6f5f1', accent: e.css, grid: true, gridColor: 'rgba(90,90,110,0.14)',
                title: ['GROWTH', 'PRICING', 'LAUNCH'][i], titleSize: 26, titleColor: '#241f1a', lineColor: '#33302c',
                lines: [['~7% w/w', '+2 design partners', '!churn at 4%'],
                ['~usage-based', '!seat pricing is dead', '+enterprise tier'],
                ['+demo day in 11 days', '~press embargo', '!nothing works yet']][i], lineSize: 20
            }), 150, 94, -160 + i * 160, 60, back(c));
        }
        c.box(150, 26, 84, 190, 25, 90, 0x1f6b45); c.solid(190, 90, 150, 84);
        c.lit(140, 1.6, 4, 190, 39, 90, 0xf8fafc);
        c.box(4, 14, 80, 190, 44, 90, 0xe8eef4);
        P.counter(c, -200, 150, 110, 46, 0x3a2f22, 0x5a4632, 0xfbbf24);
        for (let i = 0; i < 4; i++) c.lit(10, 14, 10, -240 + i * 26, 48, 150, [0xf97316, 0x4ade80, 0xfbbf24, 0xef4444][i]);
        c.npc(c, -20, 60, { name: 'Founder', role: 'W26 Batch', color: 0xfbbf24 }, 1);
        c.npc(c, 150, 170, { name: 'Hacker', role: 'Shipping', color: 0x4ade80 }, -1);
    },

    /** PITCH STAGE — Demo Day. Two minutes, one slide, the whole Row watching. */
    pitch_stage(c, e) {
        P.stage(c, 0, -150, 300, 90, 16, 0x1a1420, e.accent);
        c.box(240, 100, 8, 0, 66, -c.D / 2 + 22, 0x05070c);
        c.plate(panelTex({
            w: 768, h: 384, bg: '#07070c', accent: e.css, align: 'center',
            title: 'DEMO DAY', titleSize: 52,
            lines: ['~batch W26', '+142 companies', 'two minutes each'], lineSize: 26, padTop: 90
        }), 230, 94, 0, 66, -c.D / 2 + 26.5);
        c.box(26, 44, 26, -80, 38, -130, 0x2a3242);                    // lectern
        c.lit(20, 2, 20, -80, 61, -130, 0xfff2d8);
        for (const sx of [-1, 1]) { P.speaker(c, sx * 170, -150, 60, 26, 24); }
        for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {        // truss lighting
            c.box(10, 10, 10, sx * 110, c.H - 14, -110 + i * 26, 0x111827);
            c.lit(9, 26, 9, sx * 110, c.H - 32, -110 + i * 26, [0xf97316, 0xfbbf24, 0xef4444][i]);
        }
        for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) {
            const x = -195 + i * 65, z = -40 + row * 58;
            c.box(48, 16, 44, x, 8, z, 0x2a2230); c.solid(x, z, 48, 44);
            c.box(48, 34, 9, x, 26, z + 18, 0x342a3c);
        }
        c.plate(cardsTex({
            w: 640, h: 256, accent: e.css, title: 'ON DECK', sub: 'next three', perRow: 3,
            cards: [{ name: 'Slot 41', sub: 'agents for ops', stat: '$500k / 7%' },
            { name: 'Slot 42', sub: 'eval tooling', stat: '$500k / 7%', col: '#22d3ee' },
            { name: 'Slot 43', sub: 'robot fleet SaaS', stat: '$500k / 7%', col: '#4ade80' }]
        }), 200, 80, 0, 60, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -80, -104, { name: 'Founder', role: 'Pitching', color: 0xfbbf24 }, 1);
        c.npc(c, 200, 140, { name: 'Judge', role: 'Partner', color: 0xa855f7 }, -1);
    },

    /** VAULT — deposit boxes, a door you could not move, and one guard. */
    vault(c, e) {
        depositWall(c, -c.D / 2 + 34, 1, e.accent);
        for (const sx of [-1, 1]) {
            c.box(22, 88, 200, sx * 200, 44, -20, 0x2b3241); c.solid(sx * 200, -20, 22, 200);
            for (let r = 0; r < 6; r++) for (let i = 0; i < 8; i++) {
                c.box(2, 10, 18, sx * 189, 12 + r * 13, -100 + i * 24, 0x3d4658);
            }
        }
        // the door: a slab, a wheel, and a lot of bolt work
        c.box(120, 92, 26, 0, 46, 150, 0x475569); c.solid(0, 150, 120, 26);
        c.box(96, 76, 8, 0, 46, 135, 0x64748b);
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            c.box(9, 9, 6, Math.cos(a) * 32, 46 + Math.sin(a) * 30, 130, 0x94a3b8);
        }
        c.lit(20, 20, 4, 0, 46, 128, e.accent);
        // bullion pallets under a single hard light
        for (let i = 0; i < 3; i++) {
            const x = -110 + i * 110;
            c.box(76, 8, 56, x, 4, 30, 0x3a2f22); c.solid(x, 30, 76, 56);
            for (let r = 0; r < 3; r++) for (let b = 0; b < 3; b++) {
                c.lit(20, 7, 13, x - 22 + b * 22, 11 + r * 8, 30, r === 2 && b === 1 ? 0xfff0b0 : 0xd9b23a);
            }
            c.box(12, 10, 12, x, c.H - 12, 30, 0x111827);
            c.lit(26, 4, 26, x, c.H - 19, 30, 0xfff2d8);
        }
        c.plate(logTex({
            w: 576, h: 256, accent: e.css, title: 'ACCESS LOG', sub: 'B1',
            lines: ['+08:41 · dual key · box 1104', '~11:02 · audit walk', '!02:17 · door held 90 s',
                '+seals intact']
        }), 200, 90, 0, 62, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -60, 120, { name: 'Vault Guard', role: 'Custody', color: 0xef4444 }, 1);
    },

    /** LEGAL — the floor where the deal actually happens, slowly. */
    legal(c, e) {
        for (let i = 0; i < 4; i++) P.bookshelf(c, -190 + i * 78, -160, 74, 86, 26, 0);
        for (const sx of [-1, 1]) P.bookshelf(c, sx * 230, 0, 180, 82, 26, 1);
        c.box(240, 8, 84, -20, 30, -30, 0x3a2a1a); c.solid(-20, -30, 240, 84);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(12, 30, 12, -20 + sx * 104, 15, -30 + sz * 30, 0x2a1f12);
        for (let i = 0; i < 4; i++) { P.chair(c, -125 + i * 70, 35, 0x2b3546, -1); P.chair(c, -125 + i * 70, -95, 0x2b3546, 1); }
        for (let i = 0; i < 6; i++) {                                   // banker's boxes
            c.box(40, 26, 30, -60 + (i % 3) * 46, 13 + Math.floor(i / 3) * 27, 130, 0xd6cdb8);
            c.lit(30, 2, 1, -60 + (i % 3) * 46, 18 + Math.floor(i / 3) * 27, 145.4, 0x8a7048);
        }
        c.solid(-14, 130, 132, 30);
        c.box(28, 4, 20, -20, 35, -50, 0xe8eef4);                       // the signature page
        c.lit(24, 1, 16, -20, 37.2, -50, 0xfffaf0);
        c.plate(panelTex({
            w: 640, h: 320, bg: '#f4f1ea', accent: e.css, grid: true, gridColor: 'rgba(90,90,110,0.14)',
            title: 'CLOSING CHECKLIST', titleSize: 28, titleColor: '#241f1a', lineColor: '#33302c',
            lines: ['+SPA executed', '+disclosure schedules', '~side letter, LP 4',
                '!regulatory clearance pending', '~wire instructions confirmed twice'], lineSize: 21
        }), 240, 118, -20, 62, back(c));
        c.npc(c, 150, 60, { name: 'Counsel', role: 'Transactions', color: 0x94a3b8 }, -1);
        c.npc(c, 190, 150, { name: 'Paralegal', role: 'Closing Binders', color: 0xa855f7 }, -1);
    },

    /** BOARDROOM — the table is the architecture. */
    boardroom(c, e) {
        // a long table with rounded ends faked by two narrower end slabs
        c.box(280, 9, 110, 0, 32, -30, 0x241a10); c.solid(0, -30, 280, 110);
        for (const sx of [-1, 1]) c.box(40, 9, 78, sx * 158, 32, -30, 0x241a10);
        c.box(270, 24, 100, 0, 16, -30, 0x1a1209);
        c.lit(250, 1.8, 80, 0, 37, -30, 0x2e2418);
        for (let i = 0; i < 6; i++) {
            P.chair(c, -175 + i * 70, 42, 0x2b2436, -1);
            P.chair(c, -175 + i * 70, -102, 0x2b2436, 1);
            c.box(20, 2, 14, -175 + i * 70, 38, 6, 0xe8eef4);
            c.box(20, 2, 14, -175 + i * 70, 38, -66, 0xe8eef4);
        }
        for (const sx of [-1, 1]) P.chair(c, sx * 190, -30, 0x3a2f22, 0);      // the chair and the CEO
        for (let i = 0; i < 3; i++) { c.box(12, 10, 12, -110 + i * 110, c.H - 12, -30, 0x1b1a20); c.lit(30, 5, 24, -110 + i * 110, c.H - 19, -30, 0xfff2d8); }
        c.plate(metersTex({
            w: 768, h: 288, accent: e.css, title: 'FUND PERFORMANCE', sub: 'net to LPs',
            rows: [{ label: 'TVPI', v: 0.74, cap: '2.4x' }, { label: 'DPI', v: 0.31, cap: '0.9x' },
            { label: 'IRR', v: 0.62, cap: '28%' }, { label: 'loss ratio', v: 0.41, cap: '31%' }]
        }), 250, 94, -20, 68, back(c));
        for (let i = 0; i < 3; i++) P.frame(c, c.W / 2 - c.WALL / 2 - 6, 60, -80 + i * 80, 44, 56, 0x8a6a3a, 0x2a2418, -1);
        c.box(70, 30, 40, 210, 15, 150, 0x3a2f22); c.solid(210, 150, 70, 40);
        c.lit(16, 20, 16, 195, 40, 150, 0x8a5a2a);                              // decanter
        c.npc(c, -200, 130, { name: 'Director', role: 'Board', color: 0xfbbf24 }, 1);
        c.npc(c, 60, 160, { name: 'Board Secretary', role: 'Minutes', color: 0x94a3b8 }, -1);
    },

    /** EXECUTIVE — one desk, one view, and nothing else competing for it. */
    executive(c, e) {
        c.box(170, 10, 80, -40, 34, -110, 0x241a10); c.solid(-40, -110, 170, 80);
        for (const sx of [-1, 1]) c.box(20, 34, 70, -40 + sx * 72, 17, -110, 0x1a1209);
        c.box(46, 22, 3, -70, 50, -136, 0x0b0f18);
        c.lit(40, 17, 1.2, -70, 50, -137.4, e.accent);
        c.box(30, 5, 20, 0, 40, -100, 0xe8eef4);
        P.chair(c, -40, -60, 0x2a1f12, -1);
        for (let i = 0; i < 2; i++) P.chair(c, -90 + i * 100, -170, 0x3a2f22, 1);
        // the window wall, which is the actual point of the corner office
        for (let i = 0; i < 3; i++) {
            c.plate(vistaTex('city', e.css), 110, 110, c.W / 2 - c.WALL / 2 - 5, 58, -120 + i * 120, -Math.PI / 2);
            c.box(5, 90, 5, c.W / 2 - c.WALL / 2 - 3, 50, -180 + i * 120, 0x2b3241);
        }
        // seating group and the bar cart every one of these rooms has
        c.box(120, 20, 62, 90, 10, 60, 0x2b2436); c.solid(90, 60, 120, 62);
        c.box(120, 36, 12, 90, 30, 34, 0x342a3c);
        for (const sx of [-1, 1]) { c.box(56, 20, 56, 90 + sx * 100, 10, 120, 0x2b2436); c.solid(90 + sx * 100, 120, 56, 56); }
        P.table(c, 90, 120, 74, 44, 0x241a10, 22);
        c.box(46, 26, 34, -190, 26, 120, 0x3a2f22); c.solid(-190, 120, 46, 34);
        for (let i = 0; i < 3; i++) c.lit(9, 16, 9, -204 + i * 14, 47, 120, [0x8a5a2a, 0xb8863a, 0x6b3a1a][i]);
        c.plate(panelTex({
            w: 512, h: 256, bg: '#12100a', accent: e.css, align: 'center',
            title: e.firm, titleSize: 32, lines: ['~' + (e.tagline || 'VC ROW'), '+' + (e.aum || 'AUM undisclosed')],
            lineSize: 20, padTop: 60
        }), 170, 84, -60, 66, back(c));
        P.plant(c, 235, 180, 66);
        c.npc(c, -40, -20, { name: 'Managing Partner', role: e.firm, color: 0xfbbf24 }, 1);
    },

    /** ROOFTOP LOUNGE — where the actual sourcing happens. */
    rooftop_lounge(c, e) {
        // the city on three sides, planters standing in for the parapet
        for (let i = 0; i < 4; i++) c.plate(vistaTex('city', e.css), 120, 100, -180 + i * 120, 58, back(c) + 1);
        for (let i = 0; i < 6; i++) {
            c.box(78, 26, 34, -215 + i * 86, 13, -c.D / 2 + 34, 0x2a2418); c.solid(-215 + i * 86, -c.D / 2 + 34, 78, 34);
            c.box(64, 22, 24, -215 + i * 86, 34, -c.D / 2 + 34, 0x1f5132);
        }
        P.counter(c, -140, 40, 180, 52, 0x241a10, 0x3a2f22, e.accent);
        for (let i = 0; i < 6; i++) c.lit(8, 15, 8, -215 + i * 30, 50, 40, [0x8a5a2a, 0xb8863a, 0x4a7c59, 0x6b3a1a, 0xb8863a, 0x8a5a2a][i]);
        for (let i = 0; i < 4; i++) P.stool(c, -200 + i * 42, 90, 0x3a2f22);
        // low seating around a fire table
        c.box(90, 24, 90, 120, 12, 30, 0x2a2418); c.solid(120, 30, 90, 90);
        c.lit(60, 8, 60, 120, 26, 30, 0xff8a2a);
        c.lit(40, 14, 40, 120, 31, 30, 0xffc04a);
        for (const [sx, sz] of [[-1, 0], [1, 0], [0, 1]]) {
            c.box(70, 20, 54, 120 + sx * 100, 10, 30 + sz * 90, 0x36404f);
            c.box(70, 30, 12, 120 + sx * 100, 26, 30 + sz * 90 + (sz ? 20 : 0), 0x3f4a5c);
            c.solid(120 + sx * 100, 30 + sz * 90, 70, 54);
        }
        for (let i = 0; i < 7; i++) c.lit(4, 4, 4, -230 + i * 78, c.H - 26, 120, 0xffe8b0);   // festoon lights
        c.box(c.W - 60, 2, 2, 0, c.H - 24, 120, 0x2b3241);
        c.plate(panelTex({
            w: 512, h: 192, bg: '#120e08', accent: e.css, align: 'center',
            title: e.firm + ' LP DINNER', titleSize: 24, lines: ['~19:00 · roof', '+no decks, no phones'], lineSize: 19, padTop: 50
        }), 160, 60, c.W / 2 - c.WALL / 2 - 5, 62, 150, -Math.PI / 2);
        c.npc(c, -140, 0, { name: 'Bartender', role: 'Rooftop', color: 0x8a5a2a }, 1);
        c.npc(c, 30, 160, { name: 'LP Guest', role: 'Sovereign Fund', color: 0xfbbf24 }, -1);
        c.npc(c, 210, 150, { name: 'General Partner', role: e.firm, color: 0x4ade80 }, -1);
    },

    /** CRYPTO FLOOR — Cryptex only. Price pillars and a wall of hashrate. */
    crypto(c, e) {
        pricePillar(c, -150, -110, 'BTC', 0xf7931a, 92);
        pricePillar(c, 0, -140, 'ETH', 0x8b5cf6, 84);
        pricePillar(c, 150, -110, 'SOL', 0x22d3ee, 78);
        for (let i = 0; i < 6; i++) P.rack(c, -200 + i * 80, -190, 0xf7931a, 66, 78, 30, 1);
        for (let i = 0; i < 3; i++) tradeDesk(c, -160 + i * 160, 40, 1, 0xf7931a);
        ticker(c, 86, 0xf7931a, 0x22d3ee);
        c.plate(chartTex({
            w: 768, h: 288, accent: e.css, title: 'AGENT PAYMENT RAILS', sub: 'tx / s',
            series: [{ pts: [0.2, 0.34, 0.29, 0.48, 0.61, 0.55, 0.74, 0.88], col: '#f7931a' },
            { pts: [0.4, 0.38, 0.44, 0.4, 0.47, 0.51, 0.49, 0.58], col: '#8b5cf6', w: 2 }],
            legend: [{ label: 'settlements', col: '#f7931a' }, { label: 'streams', col: '#8b5cf6' }]
        }), 250, 94, -20, 66, back(c));
        c.plate(logTex({
            w: 576, h: 288, accent: e.css, title: 'COMPUTE FUTURES', sub: 'H200-hr',
            lines: ['+Q1 settled at 2.41', '~Q2 bid 2.68 / ask 2.79', '!Q3 curve inverted',
                '+physical delivery: 2 sites']
        }), 180, 90, c.W / 2 - c.WALL / 2 - 5, 58, 120, -Math.PI / 2);
        c.npc(c, -230, 150, { name: 'Desk Head', role: 'Digital Assets', color: 0xf7931a }, 1);
        c.npc(c, 190, 160, { name: 'Rails Engineer', role: 'Settlement', color: 0x8b5cf6 }, -1);
    }
};

// per-kind mood: the Row is dark, warm and expensive — except where it trades
const MOOD = {
    reception:       [0x141c28, 0x080d16, 0x1e2836, 0xd8e6f4],
    deal_room:       [0x1a1a22, 0x0c0c12, 0x262630, 0xffe8c0],
    partner_offices: [0x181e28, 0x0c1016, 0x232c38, 0xffe8c0],
    fund_ops:        [0x1c222c, 0x0e1218, 0x28303c, 0xd8e6f4],
    analytics:       [0x0f1a24, 0x060d14, 0x1a2836, 0xa5f3fc],
    trading_floor:   [0x120d14, 0x08050a, 0x1e1620, 0xffb4b4],
    coworking:       [0x1e2028, 0x101218, 0x2c2f38, 0xffe8c0],
    pitch_stage:     [0x14101c, 0x0a0812, 0x201a2c, 0xffc98a],
    vault:           [0x1a1a1e, 0x0c0c10, 0x26262c, 0xffe0a0],
    legal:           [0x201c16, 0x100e0a, 0x2c2820, 0xffeec8],
    boardroom:       [0x1a1620, 0x0c0a10, 0x261f2c, 0xffe0a8],
    executive:       [0x1c1710, 0x0e0b08, 0x282018, 0xffe8b8],
    rooftop_lounge:  [0x12100c, 0x080706, 0x1e1a14, 0xffd9a0],
    crypto:          [0x18120a, 0x0c0806, 0x241a10, 0xffc98a]
};

/* Firm identity. The Row's buildings carry a `firm` in data.js; the glyph,
   palette and portfolio are the flavour the rooms hang on the walls. */
const FIRMS = {
    vcrow_apex: {
        firm: 'a16z', glyph: 'A16Z', accent: 0xe07a5f, css: '#e07a5f',
        tagline: 'SOFTWARE IS EATING', aum: '$15B fund family',
        portfolio: [{ name: 'OpenAI', sub: 'co-led', stat: '$122B' },
        { name: 'Thinking Mach', sub: 'seed', stat: '$2B', col: '#22d3ee' },
        { name: 'Databricks', sub: 'growth', stat: '$62B', col: '#4ade80' }]
    },
    vcrow_horizon: {
        firm: 'Sequoia', glyph: '🌲', accent: 0xb23b34, css: '#b23b34',
        tagline: 'SINCE 1972', aum: 'evergreen fund',
        portfolio: [{ name: 'Anthropic', sub: 'Series H', stat: '$65B' },
        { name: 'Stripe', sub: 'early', stat: '$95B', col: '#22d3ee' },
        { name: 'Nvidia', sub: '1993', stat: 'the one', col: '#4ade80' }]
    },
    vcrow_thrive: {
        firm: 'Thrive', glyph: '📈', accent: 0x6366f1, css: '#6366f1',
        tagline: 'CONVICTION, REPEATED', aum: '$10B fund IX',
        portfolio: [{ name: 'OpenAI', sub: 'every round', stat: '~$1B ea' },
        { name: 'Stripe', sub: 'growth', stat: '$95B', col: '#22d3ee' },
        { name: 'Instacart', sub: 'IPO', stat: 'exited', col: '#4ade80' }]
    },
    vcrow_foundersfund: {
        firm: 'Founders Fund', glyph: '🚀', accent: 0x38bdf8, css: '#38bdf8',
        tagline: 'WE WANTED FLYING CARS', aum: '$4.5B',
        portfolio: [{ name: 'SpaceX', sub: 'first check', stat: '$350B' },
        { name: 'Anduril', sub: 'seed', stat: '$28B', col: '#22d3ee' },
        { name: 'xAI', sub: 'Series E', stat: '$20B', col: '#4ade80' }]
    },
    vcrow_launchpad: {
        firm: 'Y Combinator', glyph: 'Y', accent: 0xff6a00, css: '#ff6a00',
        tagline: 'MAKE SOMETHING PEOPLE WANT', aum: '$500K for 7%',
        portfolio: [{ name: 'Airbnb', sub: 'W09', stat: 'IPO' },
        { name: 'Stripe', sub: 'S09', stat: '$95B', col: '#22d3ee' },
        { name: 'W26 batch', sub: 'AI-first', stat: '142 cos', col: '#4ade80' }]
    },
    vcrow_mgx: {
        firm: 'MGX', glyph: '💠', accent: 0xc9a227, css: '#c9a227',
        tagline: 'ABU DHABI · NATION SCALE', aum: 'sovereign',
        portfolio: [{ name: 'Stargate', sub: 'co-owner', stat: '$500B' },
        { name: 'OpenAI', sub: 'round', stat: '$122B', col: '#22d3ee' },
        { name: 'xAI', sub: 'Series E', stat: '$20B', col: '#4ade80' }]
    },
    vcrow_titan: {
        firm: 'SoftBank', glyph: '🏦', accent: 0x9aa0a6, css: '#9aa0a6',
        tagline: 'VISION FUND', aum: '$30B into OpenAI',
        portfolio: [{ name: 'OpenAI', sub: 'anchor', stat: '$30B' },
        { name: 'Arm', sub: 'listed', stat: 'majority', col: '#22d3ee' },
        { name: 'Stargate', sub: '40%', stat: '$500B JV', col: '#4ade80' }]
    },
    vcrow_exchange: {
        firm: 'AI Exchange', glyph: '📊', accent: 0xef4444, css: '#ef4444',
        tagline: 'SECONDARY MARKET', aum: 'pre-IPO tenders',
        portfolio: [{ name: 'Tenders', sub: 'pre-IPO', stat: '41 live' },
        { name: 'Compute fut', sub: 'H200-hr', stat: 'Q2 2.68', col: '#22d3ee' },
        { name: 'Model idx', sub: 'derivative', stat: 'halted', col: '#f87171' }]
    },
    vcrow_cryptex: {
        firm: 'Cryptex', glyph: '₿', accent: 0xf7931a, css: '#f7931a',
        tagline: 'CRYPTO × AI NEXUS', aum: 'agent payment rails',
        portfolio: [{ name: 'BTC/ETH/SOL', sub: 'spot', stat: 'live' },
        { name: 'Agent rails', sub: 'settlement', stat: '88k tx/s', col: '#8b5cf6' },
        { name: 'DePIN compute', sub: 'futures', stat: 'Q3 inv', col: '#22d3ee' }]
    }
};

/* Storey lists, ground-up. Aliases from the 2D THEMES table are resolved
   here rather than in KIND, so the registry stays a data table. */
const STACKS = {
    vcrow_apex: ['reception', 'deal_room', 'partner_offices', 'fund_ops', 'boardroom', 'rooftop_lounge'],
    vcrow_horizon: ['reception', 'deal_room', 'partner_offices', 'analytics', 'boardroom'],
    vcrow_thrive: ['reception', 'deal_room', 'partner_offices', 'fund_ops', 'rooftop_lounge'],
    vcrow_foundersfund: ['reception', 'deal_room', 'partner_offices', 'trading_floor'],
    vcrow_launchpad: ['reception', 'coworking', 'pitch_stage'],
    vcrow_mgx: ['reception', 'analytics', 'partner_offices', 'fund_ops', 'boardroom'],
    vcrow_titan: ['reception', 'trading_floor', 'legal', 'boardroom', 'executive', 'vault'],
    vcrow_exchange: ['reception', 'trading_floor', 'analytics'],
    vcrow_cryptex: ['reception', 'crypto', 'trading_floor', 'vault']
};

/* Floor plaques. Aliased kinds need per-building wording so a SoftBank
   trading floor is not labelled the same as an AI Exchange broker floor. */
const LABELS = {
    reception: 'RECEPTION', deal_room: 'DEAL ROOM', partner_offices: 'PARTNER OFFICES',
    fund_ops: 'FUND OPERATIONS', analytics: 'ANALYTICS', trading_floor: 'TRADING FLOOR',
    coworking: 'COWORKING', pitch_stage: 'PITCH STAGE', vault: 'B1 · VAULT',
    legal: 'LEGAL', boardroom: 'BOARDROOM', executive: 'EXECUTIVE SUITE',
    rooftop_lounge: 'ROOFTOP LOUNGE', crypto: 'DIGITAL ASSETS FLOOR'
};
const LABEL_OVERRIDES = {
    vcrow_exchange: { trading_floor: 'BROKER FLOOR', analytics: 'TRADING FLOOR' },
    vcrow_foundersfund: { trading_floor: 'TRADING ROOM' },
    vcrow_mgx: { partner_offices: 'CLIENT OFFICES' }
};

function makeSpec(id) {
    const kinds = STACKS[id] || ['reception', 'trading_floor'];
    const f = FIRMS[id] || { firm: 'VC Row', accent: 0xfbbf24, css: '#fbbf24' };
    const over = LABEL_OVERRIDES[id] || {};
    return {
        id,
        theme(b, i, th) {
            const k = kinds[Math.max(0, Math.min(kinds.length - 1, i))];
            const m = MOOD[k] || MOOD.reception;
            th.cat = 'vc'; th.dim = true;
            th.wall = m[0]; th.ceil = m[1]; th.floor = m[2]; th.lamp = m[3];
            th.accent = f.css;
        },
        floors: kinds.map((k) => ({
            key: k,
            label: over[k] || LABELS[k] || k.toUpperCase(),
            build: (c) => KIND[k](c, { ...f })
        }))
    };
}

export const VCROW_ROOMS = {};
for (const id of Object.keys(STACKS)) VCROW_ROOMS[id] = makeSpec(id);

/** Any other vcrow_* building borrows a16z's stack. */
export function vcrowRoom(b) {
    return VCROW_ROOMS[b?.id] || VCROW_ROOMS.vcrow_apex;
}
