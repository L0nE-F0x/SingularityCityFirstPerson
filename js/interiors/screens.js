/* ══════════════════════════════════════════════════════════════════════════
   SCREEN TEXTURES — the charts, graphs, logs and dashboards that district
   rooms hang on their walls.

   Why a second texture module instead of more helpers in kit.js: kit.js is the
   *room* vocabulary (panels, plaques, flags, props). These are *data displays*,
   and several districts want the same ones — a benchmark bar chart reads the
   same in the Sandbox Arena as in a robotics test cell, and a trade blotter is
   a log screen with different words. Keeping them apart stops kit.js growing a
   second personality.

   Canvas rules are identical to kit.js, because the headless theme check runs
   these against the same stub 2D context: fillRect / strokeRect / clearRect /
   beginPath+moveTo+lineTo+stroke / fillText / createLinearGradient only. No
   arc(), no fill(), no save/restore, no measureText.
   ══════════════════════════════════════════════════════════════════════════ */
import { canvas, tex } from './kit.js';

/** Title bar shared by every display. Returns the y to start content at. */
function header(x, W, title, accent, sub) {
    if (!title) return 12;
    x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, 0, W, 52);
    x.fillStyle = accent; x.fillRect(0, 0, 7, 52);
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillStyle = accent;
    x.font = 'bold 28px Silkscreen, monospace';
    x.fillText(String(title).slice(0, 26), 20, 27);
    if (sub) {
        x.textAlign = 'right';
        x.fillStyle = '#7c8aa0';
        x.font = '17px Silkscreen, monospace';
        x.fillText(String(sub).slice(0, 22), W - 16, 29);
        x.textAlign = 'left';
    }
    x.strokeStyle = accent; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 52); x.lineTo(W, 52); x.stroke();
    return 52;
}

/** A graph node drawn as a bezelled square — no arc() available, and squares
 *  read better than diamonds at the sizes these end up on a wall. */
function node(x, nx, ny, r, col, label) {
    x.fillStyle = '#080c16'; x.fillRect(nx - r, ny - r, r * 2, r * 2);
    x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(nx - r, ny - r, r * 2, r * 2);
    x.fillStyle = col; x.fillRect(nx - r * 0.42, ny - r * 0.42, r * 0.84, r * 0.84);
    if (label) {
        x.fillStyle = '#c3cede';
        x.font = '15px Silkscreen, monospace';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(label).slice(0, 13), nx, ny + r + 14);
        x.textAlign = 'left';
    }
}

/** Directed edge with a chevron head, drawn from stroke segments only. */
function edge(x, x0, y0, x1, y1, col, alpha = 0.55) {
    x.strokeStyle = col; x.lineWidth = 2;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, hx = x1 - ux * 12, hy = y1 - uy * 12;
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(hx - uy * 6, hy + ux * 6); x.lineTo(x1, y1);
    x.lineTo(hx + uy * 6, hy - ux * 6); x.stroke();
    void alpha;
}

/** Workflow / swarm DAG. `cols` is an array of columns, each an array of
 *  labels or { label, col }. Edges fan between neighbouring columns. */
export function graphTex(opts = {}) {
    const W = opts.w || 640, H = opts.h || 320;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#a78bfa';
    x.fillStyle = opts.bg || '#070a16'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(120,140,200,0.10)'; x.lineWidth = 1;
    for (let g = 40; g < W; g += 40) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, H); x.stroke(); }
    for (let g = 40; g < H; g += 40) { x.beginPath(); x.moveTo(0, g); x.lineTo(W, g); x.stroke(); }
    const top = header(x, W, opts.title, accent, opts.sub);
    const cols = opts.cols || [];
    const r = opts.r || 17;
    const bandTop = top + 34, bandH = H - bandTop - 30;
    const pos = cols.map((col, ci) => col.map((n, ni) => ({
        x: (W / (cols.length + 1)) * (ci + 1),
        y: bandTop + bandH * ((ni + 1) / (col.length + 1)),
        label: typeof n === 'string' ? n : n.label,
        col: (typeof n === 'object' && n.col) || accent
    })));
    for (let ci = 0; ci < pos.length - 1; ci++) {
        for (const a of pos[ci]) for (const b of pos[ci + 1]) {
            edge(x, a.x + r, a.y, b.x - r, b.y, 'rgba(148,163,184,0.45)');
        }
    }
    for (const col of pos) for (const n of col) node(x, n.x, n.y, r, n.col, n.label);
    if (opts.footer) {
        x.fillStyle = '#64748b';
        x.font = '17px Silkscreen, monospace';
        x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText(String(opts.footer).slice(0, 44), 16, H - 15);
    }
    return tex(c);
}

/** Leaderboard / benchmark bars. rows: { label, v (0..1), note?, col? }. */
export function barsTex(opts = {}) {
    const W = opts.w || 512, H = opts.h || 320;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#4ade80';
    x.fillStyle = opts.bg || '#060a12'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const rows = opts.rows || [];
    const labW = opts.labelWidth || 176;
    const rowH = Math.min(46, (H - top - 20) / Math.max(1, rows.length));
    x.textBaseline = 'middle';
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i], y = top + 16 + i * rowH;
        const col = r.col || accent;
        x.textAlign = 'left';
        x.fillStyle = '#dbe3ee';
        x.font = '19px Silkscreen, monospace';
        x.fillText(String(r.label).slice(0, 15), 14, y + rowH * 0.34);
        const tw = W - labW - 96;
        x.fillStyle = 'rgba(148,163,184,0.16)';
        x.fillRect(labW, y + rowH * 0.12, tw, rowH * 0.44);
        x.fillStyle = col;
        x.fillRect(labW, y + rowH * 0.12, Math.max(3, tw * Math.min(1, Math.max(0, r.v))), rowH * 0.44);
        x.fillStyle = '#94a3b8';
        x.font = '17px Silkscreen, monospace';
        x.fillText(r.note != null ? String(r.note) : Math.round(r.v * 100) + '%', labW + tw + 12, y + rowH * 0.34);
    }
    return tex(c);
}

/** Trace / blotter log. Lines take kit.js's marker prefixes (! + ~). */
export function logTex(opts = {}) {
    const W = opts.w || 512, H = opts.h || 320;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#22d3ee';
    x.fillStyle = opts.bg || '#04060d'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const lines = opts.lines || [];
    const ls = opts.lineSize || 19;
    let y = top + 20, t = opts.t0 != null ? opts.t0 : 41;
    x.textBaseline = 'middle'; x.textAlign = 'left';
    for (const raw of lines) {
        const s = String(raw);
        let col = '#9fb0c4', text = s;
        if (s.startsWith('!')) { col = '#f87171'; text = s.slice(1); }
        else if (s.startsWith('+')) { col = '#4ade80'; text = s.slice(1); }
        else if (s.startsWith('~')) { col = accent; text = s.slice(1); }
        if (opts.stamps !== false) {
            x.fillStyle = '#3f4c5f';
            x.font = `${ls - 3}px Silkscreen, monospace`;
            x.fillText('00:' + String(t % 60).padStart(2, '0') + ':' + String((t * 7) % 60).padStart(2, '0'), 12, y);
        }
        x.fillStyle = col;
        x.font = `${ls}px Silkscreen, monospace`;
        x.fillText(text.slice(0, 34), opts.stamps === false ? 14 : 112, y);
        y += ls * 1.5; t += 3;
        if (y > H - 10) break;
    }
    return tex(c);
}

/** Quota / rate-limit meters. rows: { label, v (0..1), cap? }. */
export function metersTex(opts = {}) {
    const W = opts.w || 512, H = opts.h || 288;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#ef4444';
    x.fillStyle = opts.bg || '#0a0710'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const rows = opts.rows || [];
    const rowH = Math.min(54, (H - top - 16) / Math.max(1, rows.length));
    x.textBaseline = 'middle'; x.textAlign = 'left';
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i], y = top + 14 + i * rowH;
        const hot = r.v > 0.82;
        x.fillStyle = '#dbe3ee';
        x.font = '19px Silkscreen, monospace';
        x.fillText(String(r.label).slice(0, 24), 14, y + 12);
        x.fillStyle = hot ? '#f87171' : '#7fe6a6';
        x.textAlign = 'right';
        x.font = '17px Silkscreen, monospace';
        x.fillText(r.cap || Math.round(r.v * 100) + '%', W - 14, y + 12);
        x.textAlign = 'left';
        // segmented track — segments read as "budget" better than a solid bar
        const tw = W - 28, segs = 24, sw = tw / segs, on = Math.round(segs * Math.min(1, r.v));
        for (let s = 0; s < segs; s++) {
            x.fillStyle = s < on ? (hot ? '#ef4444' : accent) : 'rgba(148,163,184,0.14)';
            x.fillRect(14 + s * sw, y + 24, sw - 3, rowH * 0.34);
        }
    }
    return tex(c);
}

/** Deployment pipeline: stage boxes with chevrons between them. */
export function pipelineTex(opts = {}) {
    const W = opts.w || 640, H = opts.h || 224;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#ef4444';
    x.fillStyle = opts.bg || '#080a12'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const st = opts.stages || [];
    const pad = 14, gap = 26;
    const sw = (W - pad * 2 - gap * Math.max(0, st.length - 1)) / Math.max(1, st.length);
    const sy = top + 22, sh = H - sy - 34;
    x.textBaseline = 'middle';
    for (let i = 0; i < st.length; i++) {
        const s = st[i], sx = pad + i * (sw + gap);
        const col = s.col || (s.state === 'warn' ? '#fbbf24' : s.state === 'fail' ? '#f87171' : '#4ade80');
        x.fillStyle = '#0d1220'; x.fillRect(sx, sy, sw, sh);
        x.strokeStyle = col; x.lineWidth = 3; x.strokeRect(sx, sy, sw, sh);
        x.fillStyle = col; x.fillRect(sx, sy, sw, 7);
        x.textAlign = 'center';
        x.fillStyle = '#e6edf6';
        x.font = 'bold 20px Silkscreen, monospace';
        x.fillText(String(s.label).slice(0, 9), sx + sw / 2, sy + sh * 0.42);
        if (s.note) {
            x.fillStyle = col;
            x.font = '15px Silkscreen, monospace';
            x.fillText(String(s.note).slice(0, 11), sx + sw / 2, sy + sh * 0.74);
        }
        if (i < st.length - 1) {
            const cx = sx + sw + gap / 2, cy = sy + sh / 2;
            x.strokeStyle = '#475569'; x.lineWidth = 3;
            x.beginPath(); x.moveTo(cx - 8, cy - 8); x.lineTo(cx + 5, cy); x.lineTo(cx - 8, cy + 8); x.stroke();
        }
    }
    x.textAlign = 'left';
    return tex(c);
}

/** Grid of small cards — registries, rosters, portfolio pages. */
export function cardsTex(opts = {}) {
    const W = opts.w || 640, H = opts.h || 384;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#fbbf24';
    x.fillStyle = opts.bg || '#070a12'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const cards = opts.cards || [];
    const perRow = opts.perRow || 3;
    const rows = Math.max(1, Math.ceil(cards.length / perRow));
    const pad = 12;
    const cw = (W - pad * (perRow + 1)) / perRow;
    const ch = (H - top - pad * (rows + 1)) / rows;
    x.textBaseline = 'middle';
    for (let i = 0; i < cards.length; i++) {
        const cd = cards[i];
        const cx = pad + (i % perRow) * (cw + pad);
        const cy = top + pad + Math.floor(i / perRow) * (ch + pad);
        const col = cd.col || accent;
        x.fillStyle = '#0c111d'; x.fillRect(cx, cy, cw, ch);
        x.strokeStyle = col; x.lineWidth = 2; x.strokeRect(cx, cy, cw, ch);
        x.fillStyle = col; x.fillRect(cx, cy, cw, 6);
        x.textAlign = 'left';
        x.fillStyle = '#e8eef7';
        x.font = 'bold 19px Silkscreen, monospace';
        x.fillText(String(cd.name).slice(0, 15), cx + 8, cy + 26);
        if (cd.sub) {
            x.fillStyle = '#93a2b6';
            x.font = '15px Silkscreen, monospace';
            x.fillText(String(cd.sub).slice(0, 19), cx + 8, cy + 48);
        }
        if (cd.stat) {
            x.fillStyle = col;
            x.font = 'bold 17px Silkscreen, monospace';
            x.fillText(String(cd.stat).slice(0, 14), cx + 8, cy + ch - 16);
        }
    }
    x.textAlign = 'left';
    return tex(c);
}

/** Line / candle trace over time — trials, telemetry, tickers. */
export function chartTex(opts = {}) {
    const W = opts.w || 512, H = opts.h || 288;
    const [c, x] = canvas(W, H);
    const accent = opts.accent || '#4ade80';
    x.fillStyle = opts.bg || '#05080f'; x.fillRect(0, 0, W, H);
    const top = header(x, W, opts.title, accent, opts.sub);
    const plotY = top + 14, plotH = H - plotY - 26;
    x.strokeStyle = 'rgba(148,163,184,0.14)'; x.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
        const gy = plotY + (plotH / 4) * g;
        x.beginPath(); x.moveTo(12, gy); x.lineTo(W - 12, gy); x.stroke();
    }
    const series = opts.series || [];
    for (const s of series) {
        const pts = s.pts || [];
        x.strokeStyle = s.col || accent; x.lineWidth = s.w || 3;
        x.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const px = 12 + (W - 24) * (i / Math.max(1, pts.length - 1));
            const py = plotY + plotH * (1 - Math.min(1, Math.max(0, pts[i])));
            if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
        // last-value tick so overlapping series stay tellable apart
        if (pts.length) {
            const py = plotY + plotH * (1 - Math.min(1, Math.max(0, pts[pts.length - 1])));
            x.fillStyle = s.col || accent;
            x.fillRect(W - 20, py - 4, 8, 8);
        }
    }
    if (opts.legend) {
        x.textBaseline = 'middle'; x.textAlign = 'left';
        let lx = 14;
        for (const l of opts.legend) {
            x.fillStyle = l.col || accent; x.fillRect(lx, H - 18, 12, 12);
            x.fillStyle = '#a7b4c6';
            x.font = '16px Silkscreen, monospace';
            x.fillText(String(l.label).slice(0, 12), lx + 18, H - 12);
            lx += 20 + String(l.label).slice(0, 12).length * 10;
        }
    }
    return tex(c);
}
