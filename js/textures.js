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
// AAA street-read: mullions, sky reflections, shopfronts, dirt, expensive night glow.
export function facade(floors, opts = {}) {
    const W = 512, H = 512;
    const cols = opts.cols || 8;
    const rows = Math.max(2, floors);
    const litRatio = opts.litRatio ?? 0.55;
    const [c, x] = canvas(W, H);
    const [ec, ex] = canvas(W, H);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);

    // ── cladding: cool concrete with vertical sky gradient ──
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e8ecf4');
    g.addColorStop(0.28, '#d0d6e0');
    g.addColorStop(0.62, '#b4bbc8');
    g.addColorStop(0.88, '#9aa3b2');
    g.addColorStop(1, '#7e8796');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // panel joints (curtain-wall grid under windows)
    x.strokeStyle = 'rgba(55,62,74,0.14)'; x.lineWidth = 1;
    for (let i = 1; i < cols; i++) {
        x.beginPath(); x.moveTo(i * (W / cols), 0); x.lineTo(i * (W / cols), H); x.stroke();
    }

    // fine aggregate grain
    for (let i = 0; i < 5200; i++) {
        const v = Math.random();
        x.fillStyle = v < 0.55
            ? `rgba(255,255,255,${Math.random() * 0.06})`
            : `rgba(0,0,0,${Math.random() * 0.05})`;
        x.fillRect(Math.random() * W, Math.random() * H, 1 + (v > 0.9 ? 2 : 1), 1 + (v > 0.85 ? 2 : 1));
    }

    // rain / soot streaks (mostly upper→lower)
    for (let i = 0; i < 55; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H * 0.75;
        x.fillStyle = `rgba(48,54,64,${0.025 + Math.random() * 0.055})`;
        x.fillRect(sx, sy, 1 + Math.random() * 2.5, 28 + Math.random() * 110);
    }
    // corner / edge darkening
    const edge = x.createLinearGradient(0, 0, 18, 0);
    edge.addColorStop(0, 'rgba(30,36,48,0.16)'); edge.addColorStop(1, 'rgba(30,36,48,0)');
    x.fillStyle = edge; x.fillRect(0, 0, 18, H);
    const edgeR = x.createLinearGradient(W, 0, W - 18, 0);
    edgeR.addColorStop(0, 'rgba(30,36,48,0.16)'); edgeR.addColorStop(1, 'rgba(30,36,48,0)');
    x.fillStyle = edgeR; x.fillRect(W - 18, 0, 18, H);

    const cw = W / cols;
    const groundH = H / rows * 1.42;                // taller ground floor for shopfronts
    const upperH = (H - groundH) / (rows - 1 || 1);

    // mullion style: 0 = cross, 1 = double vertical, 2 = grid
    const mullionStyle = Math.floor(Math.random() * 3);

    // ── upper floors ──
    for (let r = 0; r < rows - 1; r++) {
        const y0 = r * upperH;
        // floor slab band (horizontal massing read)
        x.fillStyle = 'rgba(255,255,255,0.28)';
        x.fillRect(0, y0, W, 2.5);
        x.fillStyle = 'rgba(35,42,54,0.32)';
        x.fillRect(0, y0 + upperH - 3.5, W, 3.5);
        // thin spandrel panel under windows
        x.fillStyle = 'rgba(90,98,112,0.18)';
        x.fillRect(0, y0 + upperH * 0.72, W, upperH * 0.12);

        for (let col = 0; col < cols; col++) {
            const pad = cw * 0.12;
            const wx = col * cw + pad, ww = cw - pad * 2;
            const wy = y0 + upperH * 0.18, wh = upperH * 0.52;

            // recessed reveal / shadow box
            x.fillStyle = 'rgba(42,48,60,0.55)';
            x.fillRect(wx - 2.5, wy - 2.5, ww + 5, wh + 5);

            // glass body: sky reflection top → room depth bottom
            const wg = x.createLinearGradient(wx, wy, wx + ww * 0.15, wy + wh);
            wg.addColorStop(0, '#c8e0f8');
            wg.addColorStop(0.18, '#8eb0d0');
            wg.addColorStop(0.42, '#4a6a88');
            wg.addColorStop(0.72, '#243848');
            wg.addColorStop(1, '#121a28');
            x.fillStyle = wg; x.fillRect(wx, wy, ww, wh);

            // secondary sky specular (diagonal sheen)
            const spec = x.createLinearGradient(wx, wy, wx + ww, wy + wh * 0.55);
            spec.addColorStop(0, 'rgba(240,248,255,0.32)');
            spec.addColorStop(0.35, 'rgba(200,220,245,0.12)');
            spec.addColorStop(0.55, 'rgba(200,220,245,0)');
            x.fillStyle = spec; x.fillRect(wx, wy, ww, wh * 0.55);
            // vertical highlight strip (curtain-wall read)
            x.fillStyle = 'rgba(230,240,255,0.14)';
            x.fillRect(wx + 1, wy + 1, ww * 0.22, wh - 2);

            // interior room tone (dark furniture mass at bottom of pane)
            if (Math.random() < 0.55) {
                x.fillStyle = 'rgba(12,16,24,0.35)';
                x.fillRect(wx + ww * 0.15, wy + wh * 0.55, ww * 0.7, wh * 0.4);
            }

            // ── mullions ──
            x.fillStyle = 'rgba(200,208,220,0.78)';
            if (mullionStyle === 0) {
                // classic cross
                x.fillRect(wx + ww * 0.5 - 0.7, wy, 1.4, wh);
                x.fillRect(wx, wy + wh * 0.38, ww, 1.3);
            } else if (mullionStyle === 1) {
                // double vertical + transom
                x.fillRect(wx + ww * 0.33 - 0.6, wy, 1.2, wh);
                x.fillRect(wx + ww * 0.66 - 0.6, wy, 1.2, wh);
                x.fillRect(wx, wy + wh * 0.42, ww, 1.1);
            } else {
                // 2×2 grid
                x.fillRect(wx + ww * 0.5 - 0.65, wy, 1.3, wh);
                x.fillRect(wx, wy + wh * 0.33, ww, 1.15);
                x.fillRect(wx, wy + wh * 0.66, ww, 1.15);
            }
            // outer frame
            x.strokeStyle = 'rgba(185,194,208,0.55)';
            x.lineWidth = 1.4;
            x.strokeRect(wx + 0.7, wy + 0.7, ww - 1.4, wh - 1.4);
            // head flashing
            x.fillStyle = 'rgba(230,236,246,0.55)';
            x.fillRect(wx - 1, wy - 1.5, ww + 2, 1.8);
            // sill (bright ledge)
            x.fillStyle = 'rgba(236,242,250,0.82)';
            x.fillRect(wx - 2.5, wy + wh + 1.5, ww + 5, 2.8);
            // bird dirt / drip under sill
            if (Math.random() < 0.45) {
                x.fillStyle = `rgba(55,60,70,${0.08 + Math.random() * 0.1})`;
                x.fillRect(wx + ww * 0.2, wy + wh + 4.5, 1 + Math.random() * 2, 6 + Math.random() * 14);
            }

            // ── night emissive (expensive interior lighting) ──
            if (Math.random() < litRatio) {
                const warm = Math.random() < 0.74;
                const base = warm
                    ? (Math.random() < 0.35 ? '#ffe8b8' : Math.random() < 0.5 ? '#ffd49a' : '#ffc878')
                    : (Math.random() < 0.4 ? '#d8ecff' : '#b8d8f8');
                // floor-lamp gradient: brighter toward bottom of room
                const eg = ex.createLinearGradient(wx, wy, wx, wy + wh);
                eg.addColorStop(0, warm ? '#6a5030' : '#304858');
                eg.addColorStop(0.35, base);
                eg.addColorStop(0.75, base);
                eg.addColorStop(1, warm ? '#fff0d0' : '#e8f4ff');
                ex.fillStyle = eg; ex.fillRect(wx, wy, ww, wh);

                // secondary monitor / cool task light patch
                if (Math.random() < 0.35) {
                    ex.fillStyle = warm ? 'rgba(140,190,255,0.55)' : 'rgba(255,220,160,0.4)';
                    ex.fillRect(wx + ww * 0.55, wy + wh * 0.2, ww * 0.28, wh * 0.28);
                }
                // soft lamp blob
                if (Math.random() < 0.4) {
                    const lx = wx + ww * (0.2 + Math.random() * 0.5);
                    const ly = wy + wh * (0.45 + Math.random() * 0.35);
                    const rg = ex.createRadialGradient(lx, ly, 1, lx, ly, ww * 0.35);
                    rg.addColorStop(0, warm ? 'rgba(255,240,200,0.95)' : 'rgba(220,240,255,0.9)');
                    rg.addColorStop(1, 'rgba(0,0,0,0)');
                    ex.fillStyle = rg; ex.fillRect(wx, wy, ww, wh);
                }
                // blinds / shade (mask top or half — not a hard black rectangle)
                const shade = Math.random();
                if (shade < 0.38) {
                    const bh = wh * (0.18 + Math.random() * 0.28);
                    ex.fillStyle = 'rgba(0,0,0,0.82)';
                    ex.fillRect(wx, wy, ww, bh);
                    // slat lines
                    ex.strokeStyle = 'rgba(0,0,0,0.35)';
                    ex.lineWidth = 1;
                    for (let sy = wy; sy < wy + bh; sy += 3) {
                        ex.beginPath(); ex.moveTo(wx, sy); ex.lineTo(wx + ww, sy); ex.stroke();
                    }
                } else if (shade < 0.55) {
                    // side curtain
                    ex.fillStyle = 'rgba(0,0,0,0.75)';
                    ex.fillRect(wx, wy, ww * (0.18 + Math.random() * 0.15), wh);
                }
            }
        }
    }

    // ── ground floor: shopfronts ──
    const gy = H - groundH;
    // stone / granite plinth
    const plinth = x.createLinearGradient(0, gy, 0, H);
    plinth.addColorStop(0, '#9aa1ac');
    plinth.addColorStop(0.35, '#858c98');
    plinth.addColorStop(1, '#6a717c');
    x.fillStyle = plinth; x.fillRect(0, gy, W, groundH);
    // street grime band at base
    const grime = x.createLinearGradient(0, H - groundH * 0.28, 0, H);
    grime.addColorStop(0, 'rgba(40,44,52,0)');
    grime.addColorStop(0.5, 'rgba(40,44,52,0.18)');
    grime.addColorStop(1, 'rgba(28,32,40,0.38)');
    x.fillStyle = grime; x.fillRect(0, H - groundH * 0.28, W, groundH * 0.28);
    // cornice above ground floor
    x.fillStyle = 'rgba(30,36,46,0.4)'; x.fillRect(0, gy, W, 4);
    x.fillStyle = 'rgba(220,228,240,0.35)'; x.fillRect(0, gy + 4, W, 2);

    const bays = Math.max(3, Math.round(cols * 0.75));
    const bw = W / bays;
    const fasciaCols = ['#3a4658', '#4a3a52', '#3a5248', '#524838', '#3a4858', '#483a4a'];

    for (let i = 0; i < bays; i++) {
        const bx = i * bw + 5;
        const bayW = bw - 10;
        const glassY = gy + groundH * 0.22;
        const glassH = groundH * 0.58;

        // pier / column between bays
        if (i > 0) {
            x.fillStyle = 'rgba(70,76,88,0.55)';
            x.fillRect(i * bw - 2.5, gy + 6, 5, groundH - 10);
            x.fillStyle = 'rgba(200,208,220,0.25)';
            x.fillRect(i * bw - 1, gy + 8, 2, groundH - 14);
        }

        // fascia / signboard band
        x.fillStyle = fasciaCols[i % fasciaCols.length];
        x.fillRect(bx, gy + groundH * 0.07, bayW, groundH * 0.12);
        // fascia highlight edge
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.fillRect(bx, gy + groundH * 0.07, bayW, 1.5);

        // shopfront glass
        const sg = x.createLinearGradient(bx, glassY, bx, glassY + glassH);
        sg.addColorStop(0, '#5a7898');
        sg.addColorStop(0.25, '#3a5068');
        sg.addColorStop(0.6, '#243848');
        sg.addColorStop(1, '#141c28');
        x.fillStyle = sg;
        x.fillRect(bx, glassY, bayW, glassH);
        // glass reflection sheen
        const sh = x.createLinearGradient(bx, glassY, bx + bayW * 0.5, glassY + glassH * 0.5);
        sh.addColorStop(0, 'rgba(210,230,255,0.28)');
        sh.addColorStop(0.5, 'rgba(180,210,240,0.08)');
        sh.addColorStop(1, 'rgba(180,210,240,0)');
        x.fillStyle = sh; x.fillRect(bx, glassY, bayW, glassH * 0.55);

        // frame + mid mullion
        x.strokeStyle = 'rgba(220,228,240,0.55)'; x.lineWidth = 2.2;
        x.strokeRect(bx + 1, glassY + 1, bayW - 2, glassH - 2);
        x.fillStyle = 'rgba(200,210,224,0.55)';
        x.fillRect(bx + bayW * 0.5 - 1, glassY, 2, glassH);
        // transom bar
        x.fillRect(bx, glassY + glassH * 0.22, bayW, 1.5);
        // kick plate
        x.fillStyle = 'rgba(50,56,66,0.75)';
        x.fillRect(bx, glassY + glassH - 5, bayW, 5);
        x.fillStyle = 'rgba(180,188,200,0.25)';
        x.fillRect(bx, glassY + glassH - 5, bayW, 1);

        // warm shop interior emissive (display + ceiling cans)
        if (Math.random() < 0.82) {
            const eg = ex.createLinearGradient(bx, glassY, bx, glassY + glassH);
            eg.addColorStop(0, '#fff2d0');
            eg.addColorStop(0.45, '#ffe0a8');
            eg.addColorStop(1, '#e8b060');
            ex.fillStyle = eg;
            ex.fillRect(bx + 3, glassY + 3, bayW - 6, glassH - 8);
            // product / mannequin silhouettes (dark against light)
            if (Math.random() < 0.5) {
                ex.fillStyle = 'rgba(0,0,0,0.25)';
                ex.fillRect(bx + bayW * 0.2, glassY + glassH * 0.35, bayW * 0.15, glassH * 0.5);
                ex.fillRect(bx + bayW * 0.6, glassY + glassH * 0.4, bayW * 0.18, glassH * 0.45);
            }
            // cool accent LED strip at top of glass
            if (Math.random() < 0.4) {
                ex.fillStyle = '#88d4ff';
                ex.fillRect(bx + 4, glassY + 4, bayW - 8, 3);
            }
        }
    }

    // main entrance (centre bay, full height doors)
    const mid = Math.floor(bays / 2);
    const ex0 = mid * bw + bw * 0.12;
    const exW = bw * 0.76;
    x.fillStyle = '#10141c';
    x.fillRect(ex0, gy + groundH * 0.16, exW, groundH * 0.84);
    // door glass panels
    const dg = x.createLinearGradient(ex0, gy + groundH * 0.2, ex0, H);
    dg.addColorStop(0, '#3a5068'); dg.addColorStop(1, '#1a2434');
    x.fillStyle = dg;
    x.fillRect(ex0 + 4, gy + groundH * 0.22, exW * 0.42 - 6, groundH * 0.72);
    x.fillRect(ex0 + exW * 0.5 + 2, gy + groundH * 0.22, exW * 0.42 - 6, groundH * 0.72);
    // centre mullion / door split
    x.fillStyle = 'rgba(210,218,230,0.7)';
    x.fillRect(ex0 + exW * 0.5 - 1.5, gy + groundH * 0.16, 3, groundH * 0.84);
    // handles
    x.fillStyle = 'rgba(220,200,140,0.85)';
    x.fillRect(ex0 + exW * 0.42, gy + groundH * 0.52, 3, 10);
    x.fillRect(ex0 + exW * 0.55, gy + groundH * 0.52, 3, 10);
    // lobby glow
    ex.fillStyle = '#fff4dc';
    ex.fillRect(ex0 + 5, gy + groundH * 0.24, exW - 10, groundH * 0.72);
    // canopy / marquee shadow + bar
    x.fillStyle = 'rgba(16,20,28,0.55)';
    x.fillRect(ex0 - 8, gy + groundH * 0.1, exW + 16, 7);
    x.fillStyle = 'rgba(200,210,224,0.4)';
    x.fillRect(ex0 - 8, gy + groundH * 0.1, exW + 16, 2);

    // final street soot speckles near base
    for (let i = 0; i < 180; i++) {
        x.fillStyle = `rgba(20,24,32,${Math.random() * 0.2})`;
        x.fillRect(Math.random() * W, H - 8 - Math.random() * 20, 1.5, 1.5);
    }

    const map = tex(c), emissive = tex(ec);
    map.anisotropy = 8;
    emissive.anisotropy = 4;
    return { map, emissiveMap: emissive };
}

// ─── Neon sign atlas ─────────────────────────────────────────────────────────
// All building signs on ONE 4096×2048 texture → merged quads → 1 draw call.
// High-contrast readable text; never empty boards; neon-friendly plates.
/** One full-bleed sign plate texture (no atlas UV math — always readable). */
export function makeSignPlate(text, color = '#22d3ee', emoji = '') {
    const W = 512, H = 128;
    const [c, x] = canvas(W, H);
    // Full opaque background
    x.fillStyle = '#0a101c';
    x.fillRect(0, 0, W, H);
    // Inner panel
    x.fillStyle = '#111827';
    x.fillRect(6, 6, W - 12, H - 12);
    // Neon border
    const neon = color || '#22d3ee';
    x.strokeStyle = neon;
    x.lineWidth = 6;
    x.shadowColor = neon;
    x.shadowBlur = 16;
    x.strokeRect(8, 8, W - 16, H - 16);
    x.shadowBlur = 0;
    x.strokeStyle = 'rgba(255,255,255,0.45)';
    x.lineWidth = 2;
    x.strokeRect(12, 12, W - 24, H - 24);

    // Label
    let label = String(text || 'BUILDING').trim().toUpperCase();
    if (!label) label = 'BUILDING';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    // emoji left
    if (emoji) {
        x.textAlign = 'left';
        x.font = '40px sans-serif';
        x.fillStyle = '#ffffff';
        x.fillText(String(emoji).slice(0, 3), 22, H / 2);
        x.textAlign = 'center';
    }
    let fs = 40;
    x.font = `bold ${fs}px monospace, Consolas, "Courier New", sans-serif`;
    const maxW = emoji ? W - 100 : W - 40;
    while (x.measureText(label).width > maxW && fs > 14) {
        fs -= 2;
        x.font = `bold ${fs}px monospace, Consolas, "Courier New", sans-serif`;
    }
    // outline + fill
    x.lineWidth = 5;
    x.strokeStyle = '#000000';
    x.strokeText(label, W / 2 + (emoji ? 12 : 0), H / 2, maxW);
    x.fillStyle = neon;
    x.shadowColor = neon;
    x.shadowBlur = 10;
    x.fillText(label, W / 2 + (emoji ? 12 : 0), H / 2, maxW);
    x.shadowBlur = 0;
    x.fillStyle = '#ffffff';
    x.fillText(label, W / 2 + (emoji ? 12 : 0), H / 2, maxW);

    const t = tex(c);
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
}

export function signAtlas(signs) {
    // Keep for API compatibility — builds a real atlas AND returns uv map.
    // Prefer makeSignPlate for guaranteed text; atlas still used if callers need one mesh.
    const COLS = 8, ROWS = 16, CW = 512, CH = 128;
    const [c, x] = canvas(COLS * CW, ROWS * CH);
    // Fill entire atlas dark so empty UV never reads as clear
    x.fillStyle = '#0a101c';
    x.fillRect(0, 0, c.width, c.height);
    const uv = new Map();
    signs.forEach((s, i) => {
        if (i >= COLS * ROWS) return;
        const col = i % COLS, row = Math.floor(i / COLS);
        const px = col * CW, py = row * CH;
        const neon = s.color || '#22d3ee';
        let label = String(s.text || s.id || 'BUILDING').trim().toUpperCase() || 'BUILDING';

        x.fillStyle = '#111827';
        x.fillRect(px + 4, py + 4, CW - 8, CH - 8);
        x.strokeStyle = neon;
        x.lineWidth = 5;
        x.shadowColor = neon;
        x.shadowBlur = 12;
        x.strokeRect(px + 8, py + 8, CW - 16, CH - 16);
        x.shadowBlur = 0;

        x.textAlign = 'center';
        x.textBaseline = 'middle';
        let fs = 36;
        x.font = `bold ${fs}px monospace, Consolas, sans-serif`;
        while (x.measureText(label).width > CW - 36 && fs > 12) {
            fs -= 2;
            x.font = `bold ${fs}px monospace, Consolas, sans-serif`;
        }
        x.lineWidth = 4;
        x.strokeStyle = '#000';
        x.strokeText(label, px + CW / 2, py + CH / 2, CW - 36);
        x.fillStyle = '#ffffff';
        x.shadowColor = neon;
        x.shadowBlur = 8;
        x.fillText(label, px + CW / 2, py + CH / 2, CW - 36);
        x.shadowBlur = 0;

        const u0 = px / c.width, u1 = (px + CW) / c.width;
        const v0 = 1 - (py + CH) / c.height, v1 = 1 - py / c.height;
        uv.set(s.id, { u0, v0, u1, v1 });
    });
    const t = tex(c);
    t.anisotropy = 8;
    t.needsUpdate = true;
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
    const [c, x] = canvas(256, 256);
    // layered asphalt base
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#2a2e36'); g.addColorStop(0.5, '#23262e'); g.addColorStop(1, '#1e2128');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    // aggregate / chip seal
    for (let i = 0; i < 2800; i++) {
        const v = Math.random();
        x.fillStyle = v < 0.45 ? `rgba(255,255,255,${Math.random() * 0.05})`
            : v < 0.8 ? `rgba(0,0,0,${Math.random() * 0.18})`
            : `rgba(90,100,110,${Math.random() * 0.08})`;
        x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // wheel-polished longitudinal bands
    for (let i = 0; i < 8; i++) {
        x.fillStyle = `rgba(255,255,255,${0.01 + Math.random() * 0.018})`;
        x.fillRect(0, 20 + i * 28 + Math.random() * 6, 256, 5 + Math.random() * 10);
    }
    // oil stains / patches
    for (let i = 0; i < 14; i++) {
        x.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.1})`;
        const w = 22 + Math.random() * 55;
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, w, w * (0.4 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
        x.fill();
    }
    // hairline cracks
    x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        x.beginPath();
        let px = Math.random() * 256, py = Math.random() * 256;
        x.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
            px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40;
            x.lineTo(px, py);
        }
        x.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

// ─── Sidewalk / plaza pavement ───────────────────────────────────────────────
export function pavement() {
    const [c, x] = canvas(128, 128);
    x.fillStyle = '#6e7480'; x.fillRect(0, 0, 128, 128);
    // per-tile variation
    for (let ty = 0; ty < 128; ty += 32) {
        for (let tx = 0; tx < 128; tx += 32) {
            x.fillStyle = `rgba(${100 + Math.random() * 30|0},${105 + Math.random() * 25|0},${110 + Math.random() * 25|0},${0.15 + Math.random() * 0.2})`;
            x.fillRect(tx + 1, ty + 1, 30, 30);
        }
    }
    // joint lines (grout)
    x.strokeStyle = 'rgba(30,34,42,0.45)'; x.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
        x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
    }
    x.strokeStyle = 'rgba(200,206,216,0.12)'; x.lineWidth = 1;
    for (let i = 0; i <= 128; i += 32) {
        x.beginPath(); x.moveTo(i + 1, 0); x.lineTo(i + 1, 128); x.stroke();
        x.beginPath(); x.moveTo(0, i + 1); x.lineTo(128, i + 1); x.stroke();
    }
    // surface grit
    for (let i = 0; i < 600; i++) {
        x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        x.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
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

