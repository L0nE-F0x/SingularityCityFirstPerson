/* ══════════════════════════════════════════════════════════════════════════
   TEXTURE FACTORY — everything is procedural canvas textures (zero assets),
   in the spirit of the 2D version. One shared sign atlas keeps draw calls low.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

// ─── Building facades ────────────────────────────────────────────────────────
// Grayscale so per-instance color tints the facade. Emissive = windows only,
// glowing warm at night regardless of the building tint.
export function facade(floors, opts = {}) {
    const W = 512, H = 512;                         // 4× the old texel budget
    const cols = opts.cols || 8;
    const rows = Math.max(2, floors);
    const [c, x] = canvas(W, H);
    const [ec, ex] = canvas(W, H);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);

    // ── cladding: concrete with a vertical gradient and grain ──
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#d6dae1'); g.addColorStop(0.55, '#c2c7d0'); g.addColorStop(1, '#a9afb9');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
        x.fillStyle = `rgba(0,0,0,${Math.random() * 0.045})`;
        x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // faint weathering streaks under the floor lines
    for (let i = 0; i < 40; i++) {
        x.fillStyle = `rgba(70,76,86,${0.03 + Math.random() * 0.05})`;
        x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 30 + Math.random() * 90);
    }

    const cw = W / cols;
    const groundH = H / rows * 1.35;                // taller ground floor
    const upperH = (H - groundH) / (rows - 1 || 1);

    // ── upper floors ──
    for (let r = 0; r < rows - 1; r++) {
        const y0 = r * upperH;
        // floor slab band — this is what gives a facade its horizontal read
        x.fillStyle = 'rgba(255,255,255,0.22)';
        x.fillRect(0, y0, W, 2);
        x.fillStyle = 'rgba(40,46,56,0.28)';
        x.fillRect(0, y0 + upperH - 3, W, 3);

        for (let col = 0; col < cols; col++) {
            const wx = col * cw + cw * 0.16, ww = cw * 0.68;
            const wy = y0 + upperH * 0.22, wh = upperH * 0.54;
            // recessed reveal
            x.fillStyle = 'rgba(60,66,78,0.5)';
            x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
            // glass: sky reflection on top, room darkness below
            const wg = x.createLinearGradient(wx, wy, wx, wy + wh);
            wg.addColorStop(0, '#8fb4d8');
            wg.addColorStop(0.45, '#4d637e');
            wg.addColorStop(1, '#2b3648');
            x.fillStyle = wg; x.fillRect(wx, wy, ww, wh);
            // mullion + transom
            x.fillStyle = 'rgba(200,206,216,0.5)';
            x.fillRect(wx + ww / 2 - 0.5, wy, 1, wh);
            x.fillRect(wx, wy + wh * 0.34, ww, 1);
            // sill
            x.fillStyle = 'rgba(232,236,242,0.55)';
            x.fillRect(wx - 2, wy + wh + 2, ww + 4, 2);

            if (Math.random() < (opts.litRatio ?? 0.55)) {
                const warm = Math.random() < 0.78;
                ex.fillStyle = warm ? '#ffd9a0' : '#cfeaff';
                ex.fillRect(wx, wy, ww, wh);
                // blinds: a lit window is rarely a perfect rectangle
                if (Math.random() < 0.4) {
                    ex.fillStyle = '#000';
                    ex.fillRect(wx, wy, ww, wh * (0.15 + Math.random() * 0.3));
                }
            }
        }
    }

    // ── ground floor: shopfronts, not more of the same windows ──
    const gy = H - groundH;
    x.fillStyle = '#8d939d'; x.fillRect(0, gy, W, groundH);
    x.fillStyle = 'rgba(30,34,42,0.35)'; x.fillRect(0, gy, W, 4);
    const bays = Math.max(3, Math.round(cols * 0.75));
    const bw = W / bays;
    for (let i = 0; i < bays; i++) {
        const bx = i * bw + 4;
        // glazed shopfront
        const sg = x.createLinearGradient(0, gy, 0, H);
        sg.addColorStop(0, '#39485c'); sg.addColorStop(1, '#1d2431');
        x.fillStyle = sg;
        x.fillRect(bx, gy + groundH * 0.2, bw - 8, groundH * 0.62);
        x.strokeStyle = 'rgba(226,232,240,0.45)'; x.lineWidth = 2;
        x.strokeRect(bx, gy + groundH * 0.2, bw - 8, groundH * 0.62);
        // fascia over the shopfront
        x.fillStyle = ['#3d4a5e', '#4a3d55', '#3d5548', '#55483d'][i % 4];
        x.fillRect(bx, gy + groundH * 0.06, bw - 8, groundH * 0.13);
        // shopfronts stay lit later than offices
        if (Math.random() < 0.75) {
            ex.fillStyle = '#ffe6b8';
            ex.fillRect(bx + 3, gy + groundH * 0.23, bw - 14, groundH * 0.56);
        }
    }
    // main entrance in the middle bay
    const ex0 = W / 2 - bw * 0.34;
    x.fillStyle = '#161b25';
    x.fillRect(ex0, gy + groundH * 0.18, bw * 0.68, groundH * 0.82);
    x.fillStyle = 'rgba(226,232,240,0.5)';
    x.fillRect(ex0 + bw * 0.33, gy + groundH * 0.18, 2, groundH * 0.82);
    ex.fillStyle = '#fff2d6';
    ex.fillRect(ex0 + 4, gy + groundH * 0.22, bw * 0.68 - 8, groundH * 0.7);
    // canopy shadow
    x.fillStyle = 'rgba(20,24,32,0.5)';
    x.fillRect(ex0 - 6, gy + groundH * 0.12, bw * 0.68 + 12, 6);

    const map = tex(c), emissive = tex(ec);
    return { map, emissiveMap: emissive };
}

// ─── Neon sign atlas ─────────────────────────────────────────────────────────
// All building signs on ONE 2048² texture → merged quads → 1 draw call.
export function signAtlas(signs) {
    // signs: [{ id, text, color }]  →  cells of 512×128 on a 4096×2048 canvas (8×16 = 128 cells)
    const COLS = 8, ROWS = 16, CW = 512, CH = 128;
    const [c, x] = canvas(COLS * CW, ROWS * CH);
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, c.width, c.height);
    const uv = new Map();
    signs.forEach((s, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const px = col * CW, py = row * CH;
        // plate
        x.fillStyle = 'rgba(8,10,18,0.92)';
        roundRect(x, px + 8, py + 22, CW - 16, CH - 44, 10); x.fill();
        // neon border
        x.strokeStyle = s.color || '#22d3ee'; x.lineWidth = 4;
        x.shadowColor = s.color || '#22d3ee'; x.shadowBlur = 18;
        roundRect(x, px + 8, py + 22, CW - 16, CH - 44, 10); x.stroke();
        x.shadowBlur = 0;
        // emoji
        x.font = '44px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText(s.emoji || '🏢', px + 26, py + CH / 2 + 2);
        // name (shrink to fit)
        let fs = 34;
        x.font = `bold ${fs}px Silkscreen, monospace`;
        while (x.measureText(s.text).width > CW - 120 && fs > 14) {
            fs -= 2; x.font = `bold ${fs}px Silkscreen, monospace`;
        }
        x.fillStyle = '#ffffff';
        x.shadowColor = s.color || '#22d3ee'; x.shadowBlur = 10;
        x.fillText(s.text, px + 84, py + CH / 2 + 2, CW - 110);
        x.shadowBlur = 0;
        const u0 = px / c.width, v0 = 1 - (py + CH) / c.height;
        const u1 = (px + CW) / c.width, v1 = 1 - py / c.height;
        uv.set(s.id, { u0, v0, u1, v1 });
    });
    const t = tex(c);
    t.anisotropy = 8;
    return { texture: t, uv };
}

function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
}

// ─── Road ────────────────────────────────────────────────────────────────────
// Plain asphalt — NO lane markings. This tile repeats in both directions, so
// anything painted into it (there used to be a centre line here) shows up as a
// grid running across the road as well as along it. Markings are geometry, in
// world.js `_buildRoadMarkings`.
export function road() {
    const [c, x] = canvas(128, 128);
    x.fillStyle = '#25282f'; x.fillRect(0, 0, 128, 128);
    // aggregate speckle
    for (let i = 0; i < 900; i++) {
        const v = Math.random();
        x.fillStyle = v < 0.5 ? `rgba(255,255,255,${Math.random() * 0.045})`
            : `rgba(0,0,0,${Math.random() * 0.16})`;
        x.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
    // faint wheel-polished bands + patches, so big spans aren't dead flat
    for (let i = 0; i < 5; i++) {
        x.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.014})`;
        x.fillRect(0, Math.random() * 128, 128, 6 + Math.random() * 12);
    }
    for (let i = 0; i < 7; i++) {
        x.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
        const w = 18 + Math.random() * 40;
        x.fillRect(Math.random() * 128, Math.random() * 128, w, w * 0.6);
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// ─── Sidewalk / plaza pavement ───────────────────────────────────────────────
export function pavement() {
    const [c, x] = canvas(64, 64);
    x.fillStyle = '#6b7079'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
    for (let i = 0; i <= 64; i += 16) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke();
        x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// ─── Shared surface detail for specialty structures ──────────────────────────
// Near-white so it multiplies the vertex tint without shifting colour; carries
// concrete grain, faint form-work seams and streaking so big flat structures
// (cooling towers, plant halls, plinths) stop reading as solid blocks.
let _detail;
export function detail() {
    if (_detail) return _detail;
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#ececec'; x.fillRect(0, 0, 256, 256);
    // fine aggregate speckle
    for (let i = 0; i < 4200; i++) {
        const v = Math.random();
        x.fillStyle = v < 0.5 ? `rgba(255,255,255,${Math.random() * 0.5})`
            : `rgba(90,96,104,${Math.random() * 0.22})`;
        x.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
    // horizontal form-work seams every ~32px (concrete pour lines)
    for (let y = 0; y < 256; y += 32) {
        x.fillStyle = 'rgba(120,126,134,0.16)';
        x.fillRect(0, y + (Math.random() - 0.5) * 3, 256, 1.4);
    }
    // vertical weathering streaks
    for (let i = 0; i < 26; i++) {
        x.fillStyle = `rgba(96,102,110,${0.04 + Math.random() * 0.08})`;
        const w = 1 + Math.random() * 3;
        x.fillRect(Math.random() * 256, Math.random() * 256, w, 40 + Math.random() * 120);
    }
    // a few darker patches so tiling is less obvious
    for (let i = 0; i < 8; i++) {
        x.fillStyle = `rgba(80,86,94,${0.03 + Math.random() * 0.05})`;
        const s = 20 + Math.random() * 60;
        x.fillRect(Math.random() * 256, Math.random() * 256, s, s * 0.7);
    }
    _detail = tex(c);
    _detail.wrapS = _detail.wrapT = THREE.RepeatWrapping;
    return _detail;
}

// ─── Lobby floor: big polished stone tiles ───────────────────────────────────
export function lobbyFloor() {
    const [c, x] = canvas(128, 128);
    x.fillStyle = '#b9bec7'; x.fillRect(0, 0, 128, 128);
    // veining
    for (let i = 0; i < 26; i++) {
        x.strokeStyle = `rgba(120,128,142,${0.08 + Math.random() * 0.16})`;
        x.lineWidth = 0.6 + Math.random() * 1.4;
        x.beginPath();
        let px = Math.random() * 128, py = Math.random() * 128;
        x.moveTo(px, py);
        for (let s = 0; s < 4; s++) {
            px += (Math.random() - 0.5) * 60; py += (Math.random() - 0.5) * 60;
            x.lineTo(px, py);
        }
        x.stroke();
    }
    // sheen + tile joints
    const g = x.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.10)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(90,98,112,0.5)'; x.lineWidth = 1.5;
    x.strokeRect(0, 0, 128, 128);
    x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64);
    x.strokeStyle = 'rgba(90,98,112,0.28)'; x.lineWidth = 1; x.stroke();
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// ─── Lobby name board (interiors) ────────────────────────────────────────────
export function lobbySign(name, emoji, accent, sub) {
    const [c, x] = canvas(1024, 256);
    x.clearRect(0, 0, 1024, 256);
    x.fillStyle = 'rgba(16,20,28,0.92)';
    x.fillRect(0, 0, 1024, 256);
    x.fillStyle = accent;
    x.fillRect(0, 0, 1024, 10);
    x.fillRect(0, 246, 1024, 10);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#f2f5f9';
    x.font = 'bold 88px Silkscreen, monospace';
    x.fillText(`${emoji} ${name}`.slice(0, 30), 512, 108);
    if (sub) {
        x.fillStyle = accent;
        x.font = '44px Silkscreen, monospace';
        x.fillText(String(sub).toUpperCase().slice(0, 40), 512, 186);
    }
    return tex(c);
}

// ─── Water ───────────────────────────────────────────────────────────────────
export function water() {
    const [c, x] = canvas(256, 256);
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1a3d5c'); g.addColorStop(1, '#122b44');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
        x.strokeStyle = `rgba(140,200,255,${0.05 + Math.random() * 0.12})`;
        x.lineWidth = 1 + Math.random() * 2;
        const y = Math.random() * 256, w = 20 + Math.random() * 80;
        x.beginPath(); x.moveTo(Math.random() * 256, y);
        x.lineTo(Math.random() * 256 + w, y + (Math.random() - 0.5) * 6); x.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(30, 30);
    return t;
}

// ─── Blimp side panel ────────────────────────────────────────────────────────
export function blimpPanel(headline) {
    const [c, x] = canvas(512, 128);
    x.fillStyle = '#0d1526'; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#f59e0b'; x.lineWidth = 6; x.strokeRect(4, 4, 504, 120);
    x.fillStyle = '#fbbf24'; x.font = 'bold 26px Silkscreen, monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = headline.split(' ');
    let line = '', lines = [];
    for (const w of words) {
        if ((line + ' ' + w).trim().length > 30) { lines.push(line.trim()); line = w; }
        else line += ' ' + w;
    }
    lines.push(line.trim());
    lines = lines.slice(0, 3);
    lines.forEach((l, i) => x.fillText(l, 256, 64 + (i - (lines.length - 1) / 2) * 32));
    return tex(c);
}

// ─── AI Index billboard (dynamic, redrawn periodically) ─────────────────────
export function aiIndexBoard() {
    const [c, x] = canvas(512, 256);
    const t = tex(c);
    const history = [];
    function draw(score, delta) {
        history.push(score); if (history.length > 40) history.shift();
        x.fillStyle = '#05080f'; x.fillRect(0, 0, 512, 256);
        x.strokeStyle = '#22d3ee'; x.lineWidth = 8; x.strokeRect(6, 6, 500, 244);
        x.fillStyle = '#7c8db0'; x.font = 'bold 22px Silkscreen, monospace'; x.textAlign = 'center';
        x.fillText('GLOBAL AI INDEX', 256, 40);
        const col = score < 200 ? '#ef4444' : score < 500 ? '#facc15' : score < 800 ? '#4ade80' : '#22d3ee';
        x.fillStyle = col; x.font = 'bold 84px Silkscreen, monospace';
        x.shadowColor = col; x.shadowBlur = 24;
        x.fillText(String(Math.round(score)), 256, 120);
        x.shadowBlur = 0;
        x.fillStyle = delta >= 0 ? '#4ade80' : '#ef4444'; x.font = 'bold 22px Silkscreen, monospace';
        x.fillText(`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} / day`, 256, 156);
        // sparkline
        if (history.length > 1) {
            x.strokeStyle = '#4ade80'; x.lineWidth = 3; x.beginPath();
            const min = Math.min(...history), max = Math.max(...history), span = Math.max(1, max - min);
            history.forEach((v, i) => {
                const px = 40 + (i / (history.length - 1)) * 432;
                const py = 230 - ((v - min) / span) * 50;
                i ? x.lineTo(px, py) : x.moveTo(px, py);
            });
            x.stroke();
        }
        t.needsUpdate = true;
    }
    draw(512, 1.2);
    return { texture: t, draw };
}

// ─── Sky sprites ─────────────────────────────────────────────────────────────
export function sunSprite() {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.25, 'rgba(255,220,120,0.95)');
    g.addColorStop(1, 'rgba(255,180,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return tex(c, false);
}
export function moonSprite() {
    const [c, x] = canvas(128, 128);
    x.fillStyle = '#e8e4d8';
    x.beginPath(); x.arc(64, 64, 40, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(150,146,138,0.6)';
    [[52, 50, 9], [76, 68, 12], [58, 78, 6], [80, 44, 5]].forEach(([cx, cy, r]) => {
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    });
    const g = x.createRadialGradient(64, 64, 40, 64, 64, 64);
    g.addColorStop(0, 'rgba(220,220,200,0.35)'); g.addColorStop(1, 'rgba(220,220,200,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return tex(c, false);
}
export function glowSprite(color = 'rgba(255,255,255,1)') {
    const [c, x] = canvas(64, 64);
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return tex(c, false);
}
