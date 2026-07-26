/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SHADOWS (Phase 6 — dynamic shadow casting)
   One skewed parallelogram per building, anchored at the base, flattened onto the ground plane.
   Angle & length track the day/night clock: long at sunrise/sunset, short at noon, hidden at night.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Shadows = {
    layer: null,
    items: [],
    _lastDp: -999,
    _built: false,

    SKIP_IDS: new Set([
        'city_park', 'graveyard', 'fountain', 'open_square', 'park'
    ]),
    SKIP_PREFIXES: ['forest_', 'align_'],

    // Shadow geometry tuning
    LEN_MULT: 2.2,          // horizontal shear per unit of effective height (sunrise/sunset stretch)
    Y_EXTENT_MULT: 0.08,    // ground-perspective tilt — keep small so shadows lie flat on the ground
    MAX_EFF_H: 200,         // cap applied to the *effective* shadow height, so both hShift AND yExt scale
                            //   together for super-tall buildings — preserves a consistent shear angle
                            //   across every shadow in the frame (parallel-sun rule).
    BASE_INSET_Y: 24,       // buildings render their bottom at (groundY - 24); align shadow top to match.

    init(layer) {
        this.layer = layer;
    },

    _shouldShadow(b) {
        if (!b || !b.w || b.w < 30) return false;
        if (b.y && b.y > 9999) return false;
        const fl = b.dynamicFl || b.fl || 0;
        if (fl < 1) return false;
        if (this.SKIP_IDS.has(b.id)) return false;
        for (let i = 0; i < this.SKIP_PREFIXES.length; i++) {
            if (b.id.startsWith(this.SKIP_PREFIXES[i])) return false;
        }
        if (b.type === 'alignment') return false;
        if (b.type === 'monument') return false;
        return true;
    },

    _build() {
        if (!this.layer || typeof BLDS === 'undefined' || typeof G === 'undefined') return;
        this.items.length = 0;
        this.layer.removeChildren();
        // Shadow top edge must align with the building's visible base (groundY - 24), not raw groundY,
        // otherwise shadows float 24px below their owner and look disconnected.
        const gY = G.groundY - this.BASE_INSET_Y;
        for (let i = 0; i < BLDS.length; i++) {
            const b = BLDS[i];
            if (!this._shouldShadow(b)) continue;
            const floors = b.dynamicFl || b.fl || 1;
            const h = floors * 18 + 24;
            const gfx = new PIXI.Graphics();
            gfx.x = b.x;
            gfx.y = gY;
            this.layer.addChild(gfx);
            this.items.push({ b, gfx, h });
        }
        this._built = true;
    },

    update(dp) {
        if (!this.layer || typeof G === 'undefined') return;
        if (!this._built) {
            if (typeof BLDS === 'undefined' || BLDS.length === 0) return;
            this._build();
        }
        // Skip redraw if sun hasn't moved appreciably (dp granularity ~ 0.0007/minute)
        if (Math.abs(dp - this._lastDp) < 0.001) return;
        this._lastDp = dp;

        const night = dp > 0.83 || dp < 0.25;
        if (night) {
            this.layer.visible = false;
            return;
        }
        this.layer.visible = true;

        const tRaw = (dp - 0.25) / 0.58;
        const t = tRaw < 0 ? 0 : (tRaw > 1 ? 1 : tRaw);
        const sunAngle = t * Math.PI;
        const sunX = -Math.cos(sunAngle);
        const sunY = Math.sin(sunAngle);

        let alpha = 0.14 + 0.22 * sunY;
        if (dp < 0.27) alpha *= (dp - 0.25) / 0.02;
        else if (dp > 0.81) alpha *= (0.83 - dp) / 0.02;
        if (alpha < 0) alpha = 0;

        const lenMult = this.LEN_MULT;
        const yMult = this.Y_EXTENT_MULT;
        const maxEffH = this.MAX_EFF_H;

        for (let i = 0; i < this.items.length; i++) {
            const it = this.items[i];
            // Cap the EFFECTIVE height (not the final hShift) so both the horizontal shear and the
            // ground y-extent scale by the same factor — every shadow ends up at the same angle,
            // which is how parallel sunlight should look. Short buildings → short shadows,
            // tall buildings → long shadows, but shear ratio (yExt/hShift) is identical for all.
            const effH = it.h > maxEffH ? maxEffH : it.h;
            const w = it.b.w;
            const hShift = -sunX * effH * lenMult;
            const yExt = effH * yMult;
            const g = it.gfx;
            g.clear();
            g.beginFill(0x000000, alpha);
            g.moveTo(0, 0);
            g.lineTo(w, 0);
            g.lineTo(w + hShift, yExt);
            g.lineTo(hShift, yExt);
            g.closePath();
            g.endFill();
        }
    },

    // Called when BLDS changes (e.g., a zone reflows). Forces rebuild next update().
    invalidate() {
        this._built = false;
        this._lastDp = -999;
    }
};

if (typeof window !== 'undefined') window.Shadows = Shadows;
