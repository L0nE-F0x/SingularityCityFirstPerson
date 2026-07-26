/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN "INTERIOR" (v2.0.0 — real-world camera cutaway)

   There is NO separate interior scene. The exterior IS the source of truth: the
   train, its real riders, the tunnel, the buildings above and every other entity
   are already rendered in G.world at their true world positions. "Boarding" a
   train (G.enterTrainFocus) simply:

     • keeps G.world visible and zooms the camera onto the chosen train (Camera
       reads InteriorTrain.ZOOM and follows Entities[key].x — see camera.js), and
     • slices the near wall off that train: the front panel is hidden so you see
       straight into the car at the REAL models riding it, with a light interior
       cutaway (floor / ceiling / seats / poles) drawn on the body so it reads as
       an opened car.

   Everything outside — the city skyline, the stations it pulls into, NPCs getting
   on and off, other trains — is the actual world, in its actual place, going past
   exactly as it does outside. Tracking a model who boards this train also "just
   works", because the camera is on the same real world.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorTrain = {
    ZOOM: 2.0,            // camera zoom while boarded (camera.js reads this)
    _key: null,
    _train: null,         // the train object we cut open (to detect rebuilds)
    _cut: null,           // cutaway interior overlay, child of train.c

    // Exterior train geometry (buildTrainSprite): body spans x:-180..180, y:-35..30.
    _BODY_L: -180, _BODY_R: 180, _BODY_T: -35, _BODY_B: 30,

    enter(key) {
        // Restore any train we previously opened (e.g. user tapped a different car).
        if (this._key && this._key !== key) this.exit();
        this._key = key;
        const t = (typeof Entities !== 'undefined') ? Entities[key] : null;
        if (!t) return;
        this._openCar(t);
    },

    /* Hide the near wall and add the interior cutaway so the real riders show. */
    _openCar(t) {
        this._train = t;
        if (t.front) {
            if (t._frontWasVisible === undefined) t._frontWasVisible = t.front.visible;
            t.front.visible = false;
        }
        if (this._cut && !this._cut.destroyed) {
            if (this._cut.parent) this._cut.parent.removeChild(this._cut);
            this._cut.destroy();
        }
        this._cut = this._buildCutaway();
        if (t.c && this._cut) t.c.addChild(this._cut);   // sits over the body, behind riders
    },

    /* A furnished metro-car interior in the train's local coords. Drawn on the body
       container (t.c) so it moves with the train and renders behind the riders
       (which live in the separate riderCont layered above the bodies). Inset a few
       px from the body edges so the train's dark hull frames the cutaway. */
    _buildCutaway() {
        const g = new PIXI.Graphics();
        const L = this._BODY_L + 3, R = this._BODY_R - 3, W = R - L;   // -177..177
        const T = this._BODY_T + 3, B = this._BODY_B - 2;             // -32..28
        const seatY = B - 16, floorY = B - 7;

        // ── Walls — light slate so the open car reads as an interior, not a void ──
        g.beginFill(0x55677d); g.drawRect(L, T, W, B - T); g.endFill();
        g.beginFill(0x647a91); g.drawRect(L, T, W, 13); g.endFill();           // brighter near ceiling
        g.beginFill(0x3d4d60); g.drawRect(L, seatY - 4, W, 4); g.endFill();    // dado shadow line

        // ── Ceiling: dark rail + warm recessed lights ──
        g.beginFill(0x1e293b); g.drawRect(L, T, W, 6); g.endFill();
        g.beginFill(0xfde68a, 0.30); g.drawRect(L + 10, T + 3, W - 20, 2); g.endFill();
        g.beginFill(0xfffbe8);
        for (let lx = L + 16; lx < R - 14; lx += 46) g.drawRect(lx, T + 3, 26, 1.6);
        g.endFill();

        // ── Route-map strip (cyan line + station nodes), like a real car ──
        const mapY = T + 8;
        g.beginFill(0x0ea5e9, 0.65); g.drawRect(L + 30, mapY, W - 60, 1.5); g.endFill();
        g.beginFill(0xfde68a);
        for (let i = 0; i < 6; i++) g.drawCircle(L + 34 + (i / 5) * (W - 68), mapY + 0.75, 2);
        g.endFill();

        // ── Windows: dark tunnel glass + chrome frame + top reflection; ad panel between ──
        const winY = T + 12, wh = 14, ww = 40, pitch = 54;
        for (let wx = L + 12; wx + ww < R - 8; wx += pitch) {
            g.beginFill(0x0b111b); g.drawRect(wx, winY, ww, wh); g.endFill();
            g.beginFill(0x9fd8f5, 0.12); g.drawRect(wx + 2, winY + 2, ww - 4, 4); g.endFill();
            g.lineStyle(1.5, 0xaeb9c7, 0.9); g.drawRect(wx, winY, ww, wh); g.lineStyle(0);
            // little ad poster in the gap after the window
            const ax = wx + ww + 3;
            if (ax + 8 < R - 8) {
                g.beginFill([0x22c55e, 0xf97316, 0xa855f7, 0x06b6d4][((wx + 999) >> 3) & 3], 0.8);
                g.drawRect(ax, winY + 1, 8, wh - 2); g.endFill();
            }
        }

        // ── Grab rail under the windows + hanging hand-straps ──
        const railY = winY + wh + 3;
        g.beginFill(0x94a3b8); g.drawRect(L + 10, railY, W - 20, 2); g.endFill();
        for (let sx = L + 30; sx < R - 24; sx += 38) {
            g.lineStyle(1.5, 0x64748b, 0.95); g.moveTo(sx, railY + 2); g.lineTo(sx, railY + 11); g.lineStyle(0);
            g.beginFill(0xcbd5e1); g.drawCircle(sx, railY + 13, 2.2); g.endFill();
            g.beginFill(0x0b111b); g.drawCircle(sx, railY + 13, 1); g.endFill();
        }

        // ── Bench seats: base + teal cushions + dividers ──
        g.beginFill(0x1e293b); g.drawRect(L, seatY, W, B - seatY); g.endFill();
        for (let cx = L + 6; cx + 42 < R; cx += 50) {
            g.beginFill(0x0e7490); g.drawRect(cx, seatY + 1, 42, 6); g.endFill();
            g.beginFill(0x22d3ee, 0.5); g.drawRect(cx, seatY + 1, 42, 1.5); g.endFill();
            g.beginFill(0x334155); g.drawRect(cx - 3, seatY, 3, 9); g.endFill();
        }

        // ── Floor: panel + aisle seams + yellow safety edge ──
        g.beginFill(0x0f172a); g.drawRect(L, floorY, W, B - floorY); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(L, floorY, W, 1.5); g.endFill();
        g.beginFill(0x223044);
        for (let fx = L + 8; fx < R; fx += 30) g.drawRect(fx, floorY + 3, 14, 1);
        g.endFill();
        g.beginFill(0xfacc15, 0.6); g.drawRect(L, B - 1.5, W, 1.5); g.endFill();

        // ── Vertical grab poles (full height), with a chrome highlight ──
        for (const px of [-120, -40, 40, 120]) {
            g.beginFill(0x94a3b8); g.drawRect(px - 1, T + 6, 2.4, seatY - (T + 6)); g.endFill();
            g.beginFill(0xe2e8f0, 0.8); g.drawRect(px - 1, T + 6, 0.9, seatY - (T + 6)); g.endFill();
        }
        return g;
    },

    /* Re-assert the cutaway each frame; rebuild it if the city recreated the train. */
    update() {
        const t = (this._key && typeof Entities !== 'undefined') ? Entities[this._key] : null;
        if (!t) return;
        if (t !== this._train) { this._openCar(t); return; }      // train object was rebuilt
        if (t.front && t.front.visible) t.front.visible = false;  // keep the wall sliced open
    },

    /* Restore the train to its normal exterior look. */
    exit() {
        const t = this._train;
        if (t) {
            if (t.front) t.front.visible = (t._frontWasVisible !== false);
            t._frontWasVisible = undefined;
        }
        if (this._cut && !this._cut.destroyed) {
            if (this._cut.parent) this._cut.parent.removeChild(this._cut);
            this._cut.destroy();
        }
        this._cut = null;
        this._train = null;
        this._key = null;
    }
};
