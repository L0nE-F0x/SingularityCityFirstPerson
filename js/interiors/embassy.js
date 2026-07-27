/* ══════════════════════════════════════════════════════════════════════════
   EMBASSIES — ported from pixi/js/interior_embassy.js.

   Five themed floors shared by every mission, but the *contents* are per
   country: the seal on the reception desk, the flag wall, the visa stamps in
   consular, and — the point of the whole building — that country's real AI
   regulation on the attaché's screens. Swapping the palette alone would have
   missed the joke, which is that the EU floor is about conformity assessment
   and the US floor is about executive orders.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, flagTex, sealTex } from './kit.js';

// Keyed by the country suffix of the building id (embassy_us → 'us').
export const COUNTRIES = {
    us: {
        full: 'UNITED STATES OF AMERICA', short: 'USA', glyph: '★',
        motto: 'E PLURIBUS UNUM', title: 'AMBASSADOR', head: 'PRESIDENT',
        framework: 'NIST AI RMF',
        frameworkLines: ['~Govern · Map · Measure · Manage', '+EO 14110 compliance filed',
            '!State patchwork tracked', 'AISI joint eval scheduled'],
        stamps: ['VISA', 'H-1B', 'O-1', 'ESTA'],
        flag: ['#3c3b6e', '#b22234', '#ffffff', '#b22234'], accent: 0x3c3b6e, warm: 0xbf0a30,
        archive: ['!CLASSIFIED — chip export annex', '~Frontier Model Forum memos', '+Voluntary commitments, signed']
    },
    cn: {
        full: "PEOPLE'S REPUBLIC OF CHINA", short: 'PRC', glyph: '★',
        motto: 'SERVE THE PEOPLE', title: 'AMBASSADOR', head: 'CHAIRMAN',
        framework: 'CAC GENERATIVE AI MEASURES',
        frameworkLines: ['~Security assessment filed', '+Algorithm registration done',
            'Core values alignment audit', '!Pre-training content review'],
        stamps: ['Z-VISA', 'R-VISA', 'WORK', 'TRANSIT'],
        flag: ['#de2910', '#de2910', '#ffde00'], accent: 0xde2910, warm: 0xffde00,
        archive: ['!Domestic compute survey', '~H20 shipment delay file', '+DeepSeek release dossier']
    },
    eu: {
        full: 'EUROPEAN UNION DELEGATION', short: 'EU', glyph: '✶',
        motto: 'IN VARIETATE CONCORDIA', title: 'AMBASSADEUR', head: 'PRESIDENT OF COMMISSION',
        framework: 'EU AI ACT',
        frameworkLines: ['!Unacceptable risk — banned', '~High risk — conformity assessment',
            'Limited risk — transparency', '+GPAI > 10^25 FLOPs, Art. 51'],
        stamps: ['SCHENGEN', 'BLUE CARD', 'TYPE D'],
        flag: ['#003399', '#003399', '#ffcc00'], accent: 0x003399, warm: 0xffcc00,
        archive: ['~GPAI code of practice draft', '+Standards body coordination', '!National DPA consultation']
    },
    uk: {
        full: 'UNITED KINGDOM', short: 'UK', glyph: '⚜',
        motto: 'DIEU ET MON DROIT', title: 'HIGH COMMISSIONER', head: 'HIS MAJESTY',
        framework: 'AI SAFETY INSTITUTE',
        frameworkLines: ['~Pre-deployment evals booked', '!Dangerous capability probes',
            'Misuse + autonomy testing', '+Bletchley signatories tracked'],
        stamps: ['SKILLED WORKER', 'GLOBAL TALENT', 'HPI'],
        flag: ['#012169', '#ffffff', '#c8102e'], accent: 0x012169, warm: 0xc8102e,
        archive: ['~Inspect framework updates', '+DSIT briefing, finalised', '!Frontier lab visit notes']
    },
    jp: {
        full: 'JAPAN', short: 'JPN', glyph: '◉',
        motto: 'PEACE AND PROSPERITY', title: 'AMBASSADOR', head: 'PRIME MINISTER',
        framework: 'AI GUIDELINES FOR BUSINESS',
        frameworkLines: ['~Soft-law, sector guidance', '+Hiroshima Process code',
            'Copyright Art. 30-4 training', '!Robotics safety liaison'],
        stamps: ['WORK', 'HSP', 'STARTUP', 'TRANSIT'],
        flag: ['#ffffff', '#bc002d', '#ffffff'], accent: 0xbc002d, warm: 0xffffff,
        archive: ['~METI consultation drafts', '+Sakana / PFN partnership file', '!Pacific compute MoU']
    },
    in: {
        full: 'REPUBLIC OF INDIA', short: 'IND', glyph: '☸',
        motto: 'SATYAMEVA JAYATE', title: 'HIGH COMMISSIONER', head: 'RASHTRAPATI',
        framework: 'INDIAAI MISSION',
        frameworkLines: ['~AIKosh dataset onboarding', '+Sovereign compute portal',
            'Indic LLM programme', '!Responsible AI guidelines'],
        stamps: ['E-VISA', 'PIO', 'OCI', 'BUSINESS'],
        flag: ['#ff9933', '#ffffff', '#138808'], accent: 0xff9933, warm: 0x138808,
        archive: ['~Bhashini language expansion', '+IndiaAI grant awards', '!GPU allocation requests']
    },
    ae: {
        full: 'UNITED ARAB EMIRATES', short: 'UAE', glyph: '☾',
        motto: 'GOD · NATION · PRESIDENT', title: 'AMBASSADOR', head: 'PRESIDENT',
        framework: 'NATIONAL AI STRATEGY 2031',
        frameworkLines: ['~Falcon open weights programme', '+Sovereign compute build-out',
            'Talent visa pipeline', '!G42 partnership review'],
        stamps: ['GOLDEN VISA', 'GREEN VISA', 'NOC'],
        flag: ['#00732f', '#ffffff', '#000000'], accent: 0x00732f, warm: 0xce1126,
        archive: ['~Stargate site survey', '+MBZUAI MoU, signed', '!Arabic benchmark milestones']
    }
};

export function countryFor(b) {
    const key = String(b?.id || '').replace('embassy_', '');
    return COUNTRIES[key] || COUNTRIES.us;
}

export const EMBASSY = {
    id: 'embassy',
    theme(b, f, th) {
        const k = countryFor(b);
        th.cat = f === 4 ? 'embassy' : (f === 3 ? 'boardroom' : 'embassy');
        th.accent = '#' + k.accent.toString(16).padStart(6, '0');
        if (f === 4) {                       // archive: stone basement, no marble
            th.wall = 0x2a2418; th.ceil = 0x171208; th.floor = 0x3a342a;
            th.lamp = 0xffe0a0; th.dim = true; th.noPanels = true;
        } else if (f === 3) {                // ambassador's salon
            th.wall = 0xe8ddc4; th.ceil = 0xd6c9a8; th.floor = 0x6b4a2a; th.lamp = 0xffeec8;
        } else {
            th.wall = 0xf4efdc; th.ceil = 0xe4dcc4; th.floor = 0xbab396; th.lamp = 0xfff6e2;
        }
    },
    floors: [
        // ── 0 · RECEPTION HALL ──────────────────────────────────────────────
        {
            key: 'reception', label: 'RECEPTION HALL',
            build(c) {
                const k = countryFor(c.b);
                // marble atrium: colonnade down both sides
                for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
                    P.column(c, s * 190, -140 + i * 96, c.H - 4, 0xe8e2cc, 22);
                }
                // grand desk with the state seal on its face
                P.counter(c, 20, -130, 190, 54, 0xa88a5c, 0xc9ab74, k.warm);
                c.plate(sealTex(k.glyph, k.short, k.motto.slice(0, 22), '#' + k.warm.toString(16).padStart(6, '0')),
                    46, 46, 20, 22, -101);
                // flag wall behind reception — country flag flanked by city colours
                c.plate(flagTex(k.flag), 78, 50, -110, 66, -c.D / 2 + c.WALL / 2 + 3);
                c.plate(flagTex(k.flag), 78, 50, 150, 66, -c.D / 2 + c.WALL / 2 + 3);
                c.plate(sealTex(k.glyph, k.short, k.full.slice(0, 24), '#' + k.warm.toString(16).padStart(6, '0')),
                    64, 64, 20, 62, -c.D / 2 + c.WALL / 2 + 3);
                // standing flagpoles either side of the desk
                for (const s of [-1, 1]) {
                    c.box(5, 84, 5, 20 + s * 118, 42, -92, 0x8a7048);
                    c.lit(9, 9, 9, 20 + s * 118, 86, -92, k.warm);
                    c.plate(flagTex(k.flag, { vertical: true }), 26, 40, 20 + s * 118 + 16, 62, -92);
                }
                // security screening lane by the door
                for (const gx of [-60, 60]) {
                    c.box(16, 44, 70, gx, 22, 120, 0xcbd5e1); c.solid(gx, 120, 16, 70);
                    c.lit(4, 6, 60, gx, 46, 120, 0x38bdf8);
                }
                c.box(70, 30, 44, 200, 15, 120, 0x94a3b8); c.solid(200, 120, 70, 44);  // x-ray belt
                c.lit(58, 3, 34, 200, 31, 120, 0x22d3ee);
                // waiting lounge
                for (const [sx, sz] of [[-200, 30], [-200, 90], [-130, 30], [-130, 90]]) P.chair(c, sx, sz, 0x64748b, -1);
                P.table(c, -165, 60, 60, 40, 0x8a7048, 22);
                P.plant(c, 245, -160, 56); P.plant(c, -245, 190, 56);
                c.npc(c, -40, -96, { name: 'Receptionist', role: 'Front of House', color: 0x94a3b8 }, 1);
                c.npc(c, 130, 160, { name: 'Marine Guard', role: 'Mission Security', color: k.warm }, -1);
            }
        },
        // ── 1 · CONSULAR SERVICES ───────────────────────────────────────────
        {
            key: 'consular', label: 'CONSULAR SERVICES',
            build(c) {
                const k = countryFor(c.b);
                // four visa windows in a partitioned counter run
                for (let i = 0; i < 4; i++) {
                    const x = -155 + i * 118;
                    c.box(104, 40, 40, x, 20, -140, 0xd8d1b2); c.solid(x, -140, 104, 40);
                    c.box(110, 5, 46, x, 42, -140, 0xbfb694);
                    c.box(104, 46, 5, x, 68, -152, 0x9aa0a8);        // glazing above
                    c.lit(92, 34, 1, x, 68, -149, 0x9fc8e0);
                    c.box(4, 52, 40, x + 58, 66, -140, 0xc6bfa2);     // divider
                    c.plate(panelTex({
                        w: 256, h: 96, bg: '#111a26', accent: '#38bdf8', align: 'center',
                        title: 'WINDOW ' + (i + 1), titleSize: 26, lines: ['~' + (k.stamps[i] || 'GENERAL')], lineSize: 18, padTop: 30
                    }), 56, 21, x, 52, -119);
                }
                // the queue: rope switchbacks and a "now serving" pylon
                for (let r = 0; r < 3; r++) P.rope(c, -60 + r * 6, -40 + r * 60, 220, 0xa88a5c, 0x64748b);
                P.pylon(c, 210, -30, 70, 0x4ade80, 30);
                c.plate(panelTex({
                    w: 256, h: 256, bg: '#0b1220', accent: '#4ade80', align: 'center',
                    title: 'NOW SERVING', titleSize: 24, lines: ['+B-114', '~WAIT 40 MIN', 'TAKE A TICKET'], lineSize: 20
                }), 28, 28, 210, 42, -14);
                // waiting benches
                for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) {
                    c.box(34, 20, 30, -160 + i * 82, 10, 60 + r * 50, 0x8a7048);
                    c.box(34, 24, 5, -160 + i * 82, 30, 60 + r * 50 + 12, 0x9a7f56);
                }
                // requirements bulletin board
                c.plate(panelTex({
                    w: 512, h: 256, bg: '#efe9dc', accent: '#8a6a3a', frame: true,
                    title: 'VISA REQUIREMENTS', titleSize: 30, titleColor: '#5a4634', lineColor: '#3a352c',
                    lines: ['1. Passport valid 6 months', '2. Proof of compute funding',
                        '3. Model provenance letter', '4. Biometrics on arrival'], lineSize: 22
                }), 150, 74, 240, 54, 150, -Math.PI / 2);
                c.npc(c, -180, -110, { name: 'Visa Officer', role: 'Consular Section', color: 0x4ade80 }, 1);
                c.npc(c, 60, -110, { name: 'Consul', role: 'Head of Section', color: k.accent }, 1);
                c.npc(c, -20, 30, { name: 'Applicant', role: 'Waiting Since 07:00', color: 0xa855f7 }, -1);
            }
        },
        // ── 2 · AI POLICY ATTACHÉ ───────────────────────────────────────────
        {
            key: 'attache', label: 'AI POLICY ATTACHÉ',
            build(c) {
                const k = countryFor(c.b);
                // the wall of regulation — this floor's whole reason to exist
                c.plate(panelTex({
                    w: 640, h: 288, bg: '#0b1220', accent: '#' + k.accent.toString(16).padStart(6, '0'),
                    title: k.framework, titleSize: 32, grid: true,
                    lines: k.frameworkLines, lineSize: 23
                }), 260, 116, 20, 62, -c.D / 2 + c.WALL / 2 + 3);
                // analyst desks facing the board
                for (let i = 0; i < 4; i++) P.desk(c, -170 + i * 110, -20, 0x6b5136, 0x14324a);
                for (let i = 0; i < 3; i++) P.desk(c, -120 + i * 110, 90, 0x6b5136, 0x14324a);
                // side whiteboard with the working framework diagram
                c.plate(panelTex({
                    w: 512, h: 320, bg: '#f4f4ef', accent: '#334155', grid: true, gridColor: 'rgba(80,90,110,0.16)',
                    title: 'RISK TIERING', titleSize: 28, titleColor: '#1f2937', lineColor: '#2b3648',
                    lines: ['~capability -> threshold', 'threshold -> obligation',
                        '+eval evidence -> filing', '!gap: open weights'], lineSize: 22
                }), 120, 76, c.W / 2 - c.WALL / 2 - 5, 54, -60, -Math.PI / 2);
                // shredder + secure bin, because policy floors run on paper
                c.box(30, 44, 30, 235, 22, 120, 0x475569); c.solid(235, 120, 30, 30);
                c.lit(20, 3, 1, 235, 44, 135, 0xef4444);
                P.cabinet(c, -240, 190, 44, 62, 28, 0x5a6472, 4);
                P.plant(c, 240, -170, 48);
                c.npc(c, 90, 130, { name: 'AI Policy Attaché', role: k.framework.slice(0, 22), color: 0xfbbf24 }, -1);
                c.npc(c, -60, 130, { name: 'Tech Analyst', role: 'Evals Liaison', color: 0x22d3ee }, -1);
            }
        },
        // ── 3 · AMBASSADOR'S OFFICE ─────────────────────────────────────────
        {
            key: 'ambassador', label: "AMBASSADOR'S OFFICE",
            build(c) {
                const k = countryFor(c.b);
                const warmCss = '#' + k.warm.toString(16).padStart(6, '0');
                // ceremonial desk, portrait of the head of state, paired flags
                c.box(180, 34, 76, 20, 17, -130, 0x6b4a2a); c.solid(20, -130, 180, 76);
                c.box(188, 5, 84, 20, 36, -130, 0x8a6136);
                c.box(28, 26, 26, 20, 13, -78, 0x4a3320);
                P.chair(c, 20, -178, 0x4a3320, 1);
                c.plate(sealTex(k.glyph, k.head, k.full.slice(0, 24), warmCss),
                    72, 72, 20, 66, -c.D / 2 + c.WALL / 2 + 3);
                for (const s of [-1, 1]) {
                    c.box(5, 88, 5, 20 + s * 108, 44, -c.D / 2 + 40, 0x8a7048);
                    c.plate(flagTex(k.flag, { vertical: true }), 28, 44, 20 + s * 108 + (s > 0 ? 17 : -17), 62, -c.D / 2 + 40);
                }
                // conference table for the delegation
                c.box(210, 30, 90, 0, 15, 40, 0x5a3f22); c.solid(0, 40, 210, 90);
                c.box(216, 4, 96, 0, 32, 40, 0x7a5730);
                for (let i = -3; i <= 3; i++) { P.chair(c, i * 30, -20, 0x4a3320, -1); P.chair(c, i * 30, 100, 0x4a3320, 1); }
                // drinks cabinet and reading lamp — the salon touches
                P.cabinet(c, -240, 190, 44, 54, 30, 0x5a3f22, 2);
                c.lit(14, 22, 14, -240, 66, 190, 0xffe0a0);
                P.bookshelf(c, c.W / 2 - 34, -40, 150, 84, 28, 1);
                P.plant(c, 240, 160, 56);
                c.npc(c, -50, -96, { name: 'Ambassador', role: k.title, color: k.accent }, 1);
                c.npc(c, -200, 150, { name: 'Chief of Staff', role: 'Mission Chief of Staff', color: 0x94a3b8 }, -1);
            }
        },
        // ── 4 · CLASSIFIED ARCHIVE ──────────────────────────────────────────
        {
            key: 'archive', label: 'CLASSIFIED ARCHIVE',
            build(c) {
                const k = countryFor(c.b);
                // rolling stacks: dense rows of locked cabinets, narrow aisles
                for (let r = 0; r < 3; r++) {
                    for (let i = 0; i < 6; i++) {
                        P.cabinet(c, -172 + i * 78, -150 + r * 84, 66, 78, 34, 0x4a4438, 5);
                    }
                    c.lit(c.W - 120, 1, 4, 10, 1.4, -108 + r * 84, 0xf59e0b);
                }
                // the reading table under a single hard light
                c.box(150, 30, 70, 40, 15, 150, 0x5a4634); c.solid(40, 150, 150, 70);
                P.chair(c, 40, 108, 0x3a2e22, 1);
                c.box(2, 22, 2, 40, c.H - 12, 150, 0x2a2418);
                c.lit(34, 6, 34, 40, c.H - 24, 150, 0xffe0a0);
                // caged door and a warning board
                for (let i = 0; i < 8; i++) c.lit(2.5, 70, 2.5, -250 + i * 12, 35, 170, 0x8a8578);
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#1a140a', accent: '#ef4444',
                    title: 'RESTRICTED — ' + k.short, titleSize: 30,
                    lines: k.archive.concat(['!No devices beyond this point']), lineSize: 21
                }), 210, 92, 40, 62, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, -240, 150, { name: 'Archivist', role: 'Records Officer', color: 0x64748b }, 1);
            }
        }
    ]
};
