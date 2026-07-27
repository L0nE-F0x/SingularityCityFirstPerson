/* ══════════════════════════════════════════════════════════════════════════
   INTERIOR KIT — the shared vocabulary every bespoke room builder speaks.

   Why this exists: the FP interior used to be one procedural box re-tinted per
   destination, so a museum and a nightclub had identical geometry. Room
   builders need a common set of props, panel textures and named NPCs before
   per-destination layouts are worth writing — otherwise every layout re-invents
   a chair. Everything here appends into the caller's merge buckets (box/lit),
   so a densely dressed room still costs two draw calls plus its textured
   plates.

   Canvas rules: the headless theme check runs these texture helpers against a
   stub 2D context that only implements fillRect / strokeRect / clearRect /
   beginPath+moveTo+lineTo+stroke / fillText / createLinearGradient. Nothing in
   this file may reach for arc(), fill(), save/restore or measureText.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// ── canvas plumbing (local copy of the textures.js house style; textures.js is
//    owned by another module, so interiors keep their own panel factory) ──────
export function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}
export function tex(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
export const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

/** Deterministic PRNG — rooms must rebuild identically when the lift moves you
 *  between floors, otherwise props teleport every ride. */
export function seeded(str) {
    let s = 2166136261;
    for (let i = 0; i < str.length; i++) { s ^= str.charCodeAt(i); s = Math.imul(s, 16777619); }
    return () => {
        s = (Math.imul(s, 48271) % 2147483647) >>> 0;
        return (s % 100000) / 100000;
    };
}

// ── panel textures ───────────────────────────────────────────────────────────

/** Generic framed information panel — whiteboards, screens, boards, plaques. */
export function panelTex(opts = {}) {
    const W = opts.w || 512, H = opts.h || 256;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#38bdf8';
    x.fillStyle = opts.bg || '#0b1220';
    x.fillRect(0, 0, W, H);
    if (opts.grid) {                       // faint ruled backdrop (whiteboards)
        x.strokeStyle = opts.gridColor || 'rgba(120,140,170,0.18)';
        x.lineWidth = 1;
        for (let gy = 40; gy < H; gy += 40) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
    }
    if (opts.frame !== false) {
        x.strokeStyle = accent; x.lineWidth = 8;
        x.strokeRect(4, 4, W - 8, H - 8);
    }
    const centred = opts.align === 'center';
    x.textAlign = centred ? 'center' : 'left';
    x.textBaseline = 'middle';
    const lx = centred ? W / 2 : (opts.pad || 30);
    let y = opts.padTop || 44;
    if (opts.title) {
        const ts = opts.titleSize || 36;
        x.fillStyle = opts.titleColor || accent;
        x.font = `bold ${ts}px Silkscreen, monospace`;
        x.fillText(String(opts.title), lx, y);
        y += ts * 0.62;
        x.strokeStyle = accent; x.lineWidth = 4;
        x.beginPath(); x.moveTo(opts.pad || 30, y); x.lineTo(W - (opts.pad || 30), y); x.stroke();
        y += (opts.titleSize || 36) * 0.72;
    }
    const ls = opts.lineSize || 24;
    for (const raw of opts.lines || []) {
        const ln = String(raw);
        // a leading marker colours the row — cheap way to show status rows
        let col = opts.lineColor || '#cbd5e1';
        let text = ln;
        if (ln.startsWith('!')) { col = opts.warnColor || '#f87171'; text = ln.slice(1); }
        else if (ln.startsWith('+')) { col = opts.okColor || '#4ade80'; text = ln.slice(1); }
        else if (ln.startsWith('~')) { col = accent; text = ln.slice(1); }
        x.fillStyle = col;
        x.font = `${ls}px Silkscreen, monospace`;
        x.fillText(text, lx, y);
        y += ls * 1.42;
        if (y > H - 12) break;
    }
    return tex(c);
}

/** Flag / banner: horizontal or vertical bands, optional emblem glyph. */
export function flagTex(cols, opts = {}) {
    const W = 256, H = 160;
    const [c, x] = canvas(W, H);
    const list = cols && cols.length ? cols : ['#334155'];
    const vertical = !!opts.vertical;
    const n = list.length;
    for (let i = 0; i < n; i++) {
        x.fillStyle = typeof list[i] === 'number' ? hex(list[i]) : list[i];
        if (vertical) x.fillRect(Math.round(i * W / n), 0, Math.ceil(W / n), H);
        else x.fillRect(0, Math.round(i * H / n), W, Math.ceil(H / n));
    }
    if (opts.glyph) {
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = opts.glyphColor || 'rgba(255,255,255,0.9)';
        x.font = 'bold 74px Silkscreen, monospace';
        x.fillText(opts.glyph, W / 2, H / 2);
    }
    // cloth shading so a flat quad still reads as fabric
    const g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.20)');
    g.addColorStop(1, 'rgba(255,255,255,0.06)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    return tex(c);
}

/** State seal / crest plaque — nested frames plus glyph, no arcs available. */
export function sealTex(glyph, name, sub, accent = '#c8a04a') {
    const S = 256;
    const [c, x] = canvas(S, S);
    x.fillStyle = '#141a24'; x.fillRect(0, 0, S, S);
    x.strokeStyle = accent; x.lineWidth = 7; x.strokeRect(10, 10, S - 20, S - 20);
    x.lineWidth = 3; x.strokeRect(24, 24, S - 48, S - 48);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = accent;
    x.font = 'bold 92px Silkscreen, monospace';
    x.fillText(glyph || '★', S / 2, S / 2 - 14);
    x.fillStyle = '#e8eef6';
    x.font = 'bold 22px Silkscreen, monospace';
    x.fillText(String(name || '').slice(0, 18), S / 2, S - 62);
    if (sub) {
        x.fillStyle = accent;
        x.font = '16px Silkscreen, monospace';
        x.fillText(String(sub).slice(0, 26), S / 2, S - 36);
    }
    return tex(c);
}

/** Newspaper front page for the press hall / newsroom walls. */
export function frontPageTex(masthead, headline, deck) {
    const W = 384, H = 512;
    const [c, x] = canvas(W, H);
    x.fillStyle = '#efe9dc'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1b1b18';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 40px Silkscreen, monospace';
    x.fillText(String(masthead).slice(0, 16), W / 2, 44);
    x.strokeStyle = '#1b1b18'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(18, 70); x.lineTo(W - 18, 70); x.stroke();
    x.textAlign = 'left';
    x.font = 'bold 27px Silkscreen, monospace';
    const words = String(headline).split(' ');
    let line = '', y = 108;
    for (const w of words) {                       // no measureText in the stub
        if ((line + ' ' + w).trim().length > 20) { x.fillText(line, 20, y); y += 32; line = w; }
        else line = (line + ' ' + w).trim();
    }
    if (line) { x.fillText(line, 20, y); y += 34; }
    if (deck) {
        x.fillStyle = '#4a453c';
        x.font = '18px Silkscreen, monospace';
        x.fillText(String(deck).slice(0, 30), 20, y); y += 28;
    }
    // column rules of body copy
    x.fillStyle = 'rgba(40,38,34,0.42)';
    for (let col = 0; col < 2; col++) {
        for (let r = 0; r < 16; r++) {
            const w = 120 - ((r * 37) % 40);
            x.fillRect(20 + col * 180, y + 12 + r * 14, w, 5);
        }
    }
    x.fillStyle = '#8a8378';
    x.fillRect(20 + 180, y + 12, 150, 96);          // photo block
    return tex(c);
}

/** NPC nameplate — one small plate per named staffer. */
export function nameTex(name, role, accent = '#38bdf8') {
    const W = 256, H = 72;
    const [c, x] = canvas(W, H);
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(10,14,20,0.86)'; x.fillRect(0, 0, W, H);
    x.fillStyle = accent; x.fillRect(0, 0, W, 5); x.fillRect(0, H - 5, W, 5);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#f2f5f9';
    x.font = 'bold 28px Silkscreen, monospace';
    x.fillText(String(name).slice(0, 20), W / 2, 26);
    if (role) {
        x.fillStyle = accent;
        x.font = '17px Silkscreen, monospace';
        x.fillText(String(role).toUpperCase().slice(0, 26), W / 2, 52);
    }
    return tex(c);
}

/** Window / vista plate: the view a room claims to have (pines, tunnel, city). */
export function vistaTex(kind, accent = '#86efac') {
    const W = 256, H = 256;
    const [c, x] = canvas(W, H);
    if (kind === 'pines') {
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1b2b3f'); g.addColorStop(0.55, '#28405a'); g.addColorStop(1, '#101a12');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) {                 // stars
            x.fillStyle = 'rgba(255,255,255,0.6)';
            x.fillRect((i * 47) % W, (i * 31) % 90, 2, 2);
        }
        // pine ranks: stacked triangles drawn as narrowing bars (no fill paths)
        for (let t = 0; t < 9; t++) {
            const tx = 8 + t * 29, base = 200 + ((t * 13) % 26);
            const dark = t % 2 ? '#12301f' : '#0d2417';
            for (let s = 0; s < 10; s++) {
                const w = 30 - s * 2.6;
                x.fillStyle = dark;
                x.fillRect(tx + (30 - w) / 2, base - s * 13, w, 14);
            }
            x.fillStyle = '#2a1c10';
            x.fillRect(tx + 13, base, 5, 22);
        }
        x.fillStyle = '#0b1410'; x.fillRect(0, H - 26, W, 26);
    } else if (kind === 'tunnel') {
        x.fillStyle = '#03060c'; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 7; i++) {                  // receding ring lights
            const s = 8 + i * 16;
            x.strokeStyle = `rgba(56,189,248,${0.35 - i * 0.04})`;
            x.lineWidth = 3;
            x.strokeRect(s, s * 0.8, W - s * 2, H - s * 1.6);
        }
        x.fillStyle = 'rgba(251,191,36,0.55)';
        x.fillRect(W / 2 - 8, H / 2 - 8, 16, 16);
    } else {                                            // 'city'
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0b1526'); g.addColorStop(1, '#233650');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) {
            const bw = 10 + ((i * 17) % 22), bh = 40 + ((i * 53) % 130);
            x.fillStyle = '#111b2b';
            x.fillRect(i * 19, H - bh, bw, bh);
            for (let wy = 0; wy < bh - 12; wy += 12) {
                x.fillStyle = (i + wy) % 3 ? 'rgba(255,214,140,0.55)' : 'rgba(120,190,255,0.4)';
                x.fillRect(i * 19 + 3, H - bh + 6 + wy, 4, 5);
            }
        }
    }
    x.strokeStyle = accent; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
    return tex(c);
}

// ── the twelve named interior NPCs ported from pixi/js/interior_city_core.js ──
// Shared roster so any room builder can place a known face rather than an
// anonymous mannequin. Keys are stable ids; rooms reference them by key.
export const CORE_NPCS = {
    front_desk:  { name: 'Front Desk',   role: 'Receptionist',     color: 0x3b82f6, desc: 'Directing packets.' },
    concierge:   { name: 'Concierge',    role: 'Concierge',        color: 0xfbbf24, desc: 'At your service.' },
    park_ranger: { name: 'Park Ranger',  role: 'Ranger',           color: 0x22c55e, desc: 'Ensuring safe viewing distances.' },
    spotter:     { name: 'Spotter',      role: 'Trainer',          color: 0x0ea5e9, desc: 'Heavy lifting.' },
    yoga_sensei: { name: 'Yoga Sensei',  role: 'Instructor',       color: 0xa78bfa, desc: 'Namaste, gradient.' },
    referee:     { name: 'Referee',      role: 'Referee',          color: 0xf1f5f9, desc: 'Fair fights.' },
    commentator: { name: 'Commentator',  role: 'Commentator',      color: 0xf97316, desc: 'And the ELO shifts again!' },
    barista_bot: { name: 'BaristaBot',   role: 'Barista',          color: 0xd97706, desc: 'Brewing Java.' },
    baker_bot:   { name: 'Baker Bot',    role: 'Pastry Chef',      color: 0xfcd34d, desc: 'Batch processing croissants.' },
    maintainer:  { name: 'Maintainer',   role: 'Lead Maintainer',  color: 0x4ade80, desc: 'Reviewing pull requests since 2020.' },
    contributor: { name: 'Contributor',  role: 'Core Contributor', color: 0x22d3ee, desc: 'Squashing bugs, one PR at a time.' },
    grim_reaper: { name: 'Grim Reaper',  role: 'Sanitation',       color: 0x111827, desc: 'Collector of deprecated models.' }
};

// ── prop library ─────────────────────────────────────────────────────────────
// Every helper takes the room context first and merges into its buckets, so
// props are free at draw time. Coordinates are interior-local: +Z is the street
// door, -Z the back wall, -X the lift bank wall.

export const P = {
    /** Work desk with monitor, keyboard glow and a chair. */
    desk(c, x, z, col = 0x5c4033, screen = 0x1e293b) {
        c.box(70, 28, 36, x, 14, z, col); c.solid(x, z, 70, 36);
        c.box(26, 16, 3, x - 10, 38, z - 14, 0x111827);
        c.lit(22, 12, 1, x - 10, 38, z - 12, screen);
        c.lit(20, 2, 8, x + 16, 29, z - 6, 0x94a3b8);
        c.box(22, 22, 22, x, 11, z + 28, 0x374151);
        c.box(20, 20, 4, x, 30, z + 38, 0x2b3543);
    },
    /** Four-leg table with a top slab. */
    table(c, x, z, w = 70, d = 44, col = 0x6d5238, h = 26) {
        c.box(w, 4, d, x, h, z, col);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            c.box(5, h, 5, x + sx * (w / 2 - 6), h / 2, z + sz * (d / 2 - 6), col);
        }
        c.solid(x, z, w, d);
    },
    chair(c, x, z, col = 0x374151, back = 1) {
        c.box(20, 4, 20, x, 18, z, col);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            c.box(3, 18, 3, x + sx * 7, 9, z + sz * 7, col);
        }
        if (back) c.box(20, 20, 4, x, 30, z + back * 9, col);
    },
    /** Upholstered booth: bench, high back, table, glow strip. */
    booth(c, x, z, col = 0x3b1f3a, glow = 0xf472b6) {
        c.box(74, 18, 52, x, 9, z, col); c.solid(x, z, 74, 52);
        c.box(74, 40, 10, x, 30, z - 26, col);
        c.box(50, 4, 30, x, 26, z + 4, 0x2a1830);
        c.box(8, 24, 8, x, 13, z + 4, 0x2a1830);
        c.lit(46, 2, 1, x, 33, z - 20, glow);
        c.lit(4, 5, 4, x, 30, z + 4, 0xfbbf24);   // candle
    },
    stool(c, x, z, seat = 0x8a2a6a) {
        c.box(6, 22, 6, x, 11, z, 0x241a20);
        c.box(18, 4, 18, x, 24, z, seat);
        c.solid(x, z, 14, 14);
    },
    plant(c, x, z, h = 40, pot = 0x4b5563) {
        c.box(18, 12, 18, x, 6, z, pot); c.solid(x, z, 18, 18);
        c.box(12, h * 0.5, 12, x, 12 + h * 0.25, z, 0x166534);
        c.box(22, h * 0.4, 22, x, 12 + h * 0.55, z, 0x15803d);
    },
    /** Wall-mounted lit screen with a bezel. */
    screen(c, x, y, z, w, h, col, depth = 2.5, face = 1) {
        c.box(w + 8, h + 8, depth, x, y, z, 0x111827);
        c.lit(w, h, 1.2, x, y, z + face * (depth / 2 + 0.8), col);
    },
    /** Server / equipment rack with a status LED ladder. */
    rack(c, x, z, led = 0x39ff88, w = 46, h = 84, d = 34, face = 1) {
        c.box(w, h, d, x, h / 2, z, 0x14181e); c.solid(x, z, w, d);
        c.box(w - 6, h - 12, 1.5, x, h / 2 + 2, z + face * (d / 2 + 0.5), 0x0a0d12);
        for (let l = 0; l < 10; l++) {
            c.lit(3, 3, 1, x - w / 2 + 8 + (l % 5) * ((w - 16) / 4), 14 + Math.floor(l / 5) * (h * 0.4), z + face * (d / 2 + 1), led);
        }
        c.lit(w - 16, 2, 1, x, h - 6, z + face * (d / 2 + 1), led);
    },
    /** Bookcase with coloured spines. */
    bookshelf(c, x, z, w = 90, h = 76, d = 26, rotY = 0) {
        const along = rotY ? 'z' : 'x';
        const W = along === 'x' ? w : d, D = along === 'x' ? d : w;
        c.box(W, h, D, x, h / 2, z, 0x4a3520);
        c.solid(x, z, W, D);
        const shelves = Math.max(3, Math.round(h / 20));
        for (let s = 0; s < shelves; s++) {
            const sy = 8 + s * ((h - 12) / shelves);
            c.box(W - 6, 2.5, D - 6, x, sy, z, 0x6b5136);
            const n = Math.floor((along === 'x' ? W : D) / 7) - 1;
            for (let b = 0; b < n; b++) {
                const off = -((along === 'x' ? W : D) / 2) + 6 + b * 7;
                const col = [0x9a3a3a, 0x3a5a9a, 0x3a7a4a, 0xb8863a, 0x6b3a7a][(b + s) % 5];
                if (along === 'x') c.box(5, 13, D - 12, x + off, sy + 8, z, col);
                else c.box(W - 12, 13, 5, x, sy + 8, z + off, col);
            }
        }
    },
    /** Crackling hearth — the alignment cabin's signature. */
    fireplace(c, x, z, w = 110, stone = 0x6b6257) {
        c.box(w, 62, 34, x, 31, z, stone); c.solid(x, z, w, 34);
        c.box(w + 18, 8, 40, x, 66, z, 0x565049);            // mantel
        c.box(w - 40, 40, 8, x, 20, z + 14, 0x14100c);       // firebox mouth
        // layered embers: warm core, cooler tips, so the fire reads at distance
        c.lit(w - 54, 6, 14, x, 6, z + 10, 0xff8a2a);
        c.lit(w - 66, 10, 12, x, 13, z + 10, 0xffc04a);
        c.lit(16, 16, 8, x - 14, 20, z + 10, 0xff6a1a);
        c.lit(12, 20, 8, x + 12, 22, z + 10, 0xffd166);
        for (const lx of [-1, 1]) c.box(10, 10, 26, x + lx * 22, 5, z + 12, 0x3a2a1a);  // logs
        c.box(w - 20, 3, 30, x, 1.5, z + 16, 0x2a2622);      // hearthstone
    },
    /** Kitchen / bar / reception counter with a lit lip. */
    counter(c, x, z, w, d, body = 0x2a1c14, top = 0x5a3a22, glow = null) {
        c.box(w, 38, d, x, 19, z, body); c.solid(x, z, w + 6, d + 6);
        c.box(w + 6, 5, d + 6, x, 40, z, top);
        if (glow) c.lit(w - 10, 2, 1.5, x, 24, z + d / 2 + 1, glow);
    },
    crate(c, x, z, s = 22, col = 0x3d2914) {
        c.box(s, s, s, x, s / 2, z, col);
        c.box(s + 1, 2, 2, x, s * 0.5, z + s / 2, 0x2a1f0e);
        c.box(2, s + 1, 2, x, s * 0.5, z + s / 2, 0x2a1f0e);
        c.solid(x, z, s, s);
    },
    barrel(c, x, z, col = 0x78582e) {
        c.box(24, 30, 24, x, 15, z, col);
        c.box(26, 3, 26, x, 8, z, 0x92703a);
        c.box(26, 3, 26, x, 24, z, 0x92703a);
        c.solid(x, z, 24, 24);
    },
    /** Wine rack packed with bottles — cellar signature. */
    wineRack(c, x, z, w = 60, h = 70, d = 26) {
        c.box(w, h, d, x, h / 2, z, 0x3d2914); c.solid(x, z, w, d);
        for (let r = 0; r < 5; r++) {
            c.box(w - 4, 2, d - 4, x, 8 + r * (h - 12) / 5, z, 0x4a3520);
            for (let b = 0; b < Math.floor(w / 9); b++) {
                const col = [0x7c2d12, 0x1a4d2e, 0x4a1942, 0x5a3a10][(b + r) % 4];
                c.box(6, 6, d - 10, x - w / 2 + 6 + b * 9, 12 + r * (h - 12) / 5, z, col);
            }
        }
    },
    /** Velvet rope pair — queues, VIP entrances, museum galleries. */
    rope(c, x, z, span = 60, post = 0xfbbf24, rope = 0xef4444) {
        for (const s of [-1, 1]) {
            c.box(6, 34, 6, x + s * span / 2, 17, z, post);
            c.lit(8, 4, 8, x + s * span / 2, 36, z, post);
        }
        c.lit(span, 3, 3, x, 26, z, rope);
    },
    /** Structural column with a capital, used to break up big halls. */
    column(c, x, z, h, col = 0x94a3b8, w = 16) {
        c.box(w, h, w, x, h / 2, z, col); c.solid(x, z, w, w);
        c.box(w + 8, 6, w + 8, x, h - 3, z, col);
        c.box(w + 10, 5, w + 10, x, 2.5, z, col);
    },
    /** Stair flight (used for mezzanines / platform descents). */
    stairs(c, x, z, steps, rise, run, w = 70, col = 0x475569, dir = 1) {
        for (let i = 0; i < steps; i++) {
            c.box(w, rise, run, x, rise / 2 + i * rise, z + dir * i * run, col);
        }
        c.solid(x, z + dir * steps * run / 2, w, steps * run);
    },
    /** Framed picture — portraits, art, wanted posters. */
    frame(c, x, y, z, w, h, col = 0x8a6a3a, art = 0x2a3a52, face = 1) {
        c.box(w + 8, h + 8, 3, x, y, z, col);
        c.lit(w, h, 1.2, x, y, z + face * 2.2, art);
    },
    /** Small four-legged critter (cellar rat / tunnel rat). */
    rat(c, x, z, facing = 1) {
        c.box(18, 8, 10, x, 5, z, 0x6b6b7b);
        c.box(10, 8, 9, x + facing * 12, 7, z, 0x7b7b8b);
        c.box(4, 5, 2, x + facing * 10, 12, z - 3, 0xff9999);
        c.box(4, 5, 2, x + facing * 10, 12, z + 3, 0xff9999);
        c.lit(2, 2, 2, x + facing * 16, 8, z - 2, 0x111111);
        c.box(14, 2, 2, x - facing * 15, 7, z, 0xff9999);
    },

    /** Named staffer. Blocky on purpose — these are set dressing you can read
     *  from across the room, not citizens; the nameplate carries the identity. */
    npc(c, x, z, def = {}, facing = 1) {
        const col = def.color != null ? def.color : 0x64748b;
        const skin = def.skin != null ? def.skin : 0xd9b38c;
        c.box(15, 13, 9, x, 6.5, z, 0x1f2937);          // legs
        c.box(19, 17, 12, x, 21, z, col);               // torso
        for (const s of [-1, 1]) c.box(4, 15, 6, x + s * 11.5, 21, z, col);
        c.box(11, 10, 10, x, 34, z, skin);              // head
        c.box(12, 3, 11, x, 38.5, z, def.hair != null ? def.hair : 0x2b2118);
        c.lit(2.5, 2, 1, x - 3, 35, z + facing * 5.4, 0x0b0f16);
        c.lit(2.5, 2, 1, x + 3, 35, z + facing * 5.4, 0x0b0f16);
        // lanyard/collar glow keeps staff legible in the dim rooms (bar, sewer)
        c.lit(17, 2.5, 3, x, 28, z, col);
        if (c.plate && def.name) {
            c.plate(nameTex(def.name, def.role, hex(col)), 46, 13,
                x, 47, z + facing * 1.2, facing > 0 ? 0 : Math.PI);
        }
    },

    /** Raised performance / speaking platform with edge lighting. */
    stage(c, x, z, w, d, h = 12, body = 0x1a1020, edge = 0xe879f9) {
        c.box(w, h, d, x, h / 2, z, body); c.solid(x, z, w, d);
        c.lit(w + 4, 2, 2, x, h, z + d / 2, edge);
        c.lit(w + 4, 2, 2, x, h, z - d / 2, edge);
        for (const s of [-1, 1]) c.lit(2, 2, d, x + s * w / 2, h, z, edge);
    },
    /** Mirror-ball on a drop rod. Faceted with a ring of little lit cubes. */
    discoBall(c, x, z, y, r = 11) {
        c.box(2, 16, 2, x, y + 12, z, 0x64748b);
        c.box(r, r, r, x, y, z, 0xb8c2cc);
        for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            c.lit(3, 3, 3, x + Math.cos(ang) * r * 0.8, y, z + Math.sin(ang) * r * 0.8, 0xffffff);
        }
        c.lit(3, 3, 3, x, y + r * 0.75, z, 0xffffff);
    },
    /** PA stack. */
    speaker(c, x, z, h = 46, w = 22, d = 20) {
        c.box(w, h, d, x, h / 2, z, 0x111118); c.solid(x, z, w, d);
        c.box(w - 6, w - 6, 2, x, h * 0.66, z + d / 2, 0x24242f);
        c.box(w - 12, w - 12, 2, x, h * 0.3, z + d / 2, 0x24242f);
        c.lit(4, 2, 1, x, h - 5, z + d / 2 + 0.6, 0x4ade80);
    },
    /** Glass display case for museum galleries / vault exhibits. */
    vitrine(c, x, z, w = 54, d = 34, h = 34, glow = 0x38bdf8) {
        c.box(w, 20, d, x, 10, z, 0x2a2e36); c.solid(x, z, w, d);
        c.box(w + 4, 3, d + 4, x, 21, z, 0x3d434d);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            c.box(2.5, h, 2.5, x + sx * (w / 2 - 2), 22 + h / 2, z + sz * (d / 2 - 2), 0x6b7280);
        }
        c.box(w, 2, d, x, 22 + h, z, 0x3d434d);
        c.lit(w - 14, h - 10, d - 14, x, 26 + h / 2, z, glow);   // exhibit inside
    },
    /** Ticket-hall style gate you walk between. */
    turnstile(c, x, z, open = 0x4ade80) {
        c.box(14, 34, 62, x, 17, z, 0x64748b); c.solid(x, z, 14, 62);
        c.box(16, 4, 62, x, 35, z, 0x94a3b8);
        c.lit(6, 6, 6, x, 38, z + 26, open);
        c.lit(3, 2, 40, x, 30, z, 0x22d3ee);
    },
    /** Free-standing lit pylon used for wayfinding / departure info. */
    pylon(c, x, z, h = 74, col = 0x22d3ee, w = 30) {
        c.box(w, h, 12, x, h / 2, z, 0x0f172a); c.solid(x, z, w, 12);
        c.lit(w - 6, h - 14, 1.2, x, h / 2 + 2, z + 6.6, col);
        c.lit(w - 6, h - 14, 1.2, x, h / 2 + 2, z - 6.6, col);
    },
    /** Filing / archive cabinet bank. */
    cabinet(c, x, z, w = 40, h = 60, d = 26, col = 0x475569, drawers = 4) {
        c.box(w, h, d, x, h / 2, z, col); c.solid(x, z, w, d);
        for (let i = 0; i < drawers; i++) {
            c.box(w - 6, h / drawers - 4, 2, x, 6 + i * (h / drawers), z + d / 2, 0x334155);
            c.lit(10, 2, 1, x, 6 + i * (h / drawers), z + d / 2 + 1.2, 0x94a3b8);
        }
    }
};
