/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CROWD SEPARATION (Phase 5 — smart crowd pathing)
   Local avoidance force so walking NPCs don't clump on top of each other on the sidewalk.
   Uses a single-frame spatial hash so neighbor lookup is O(n) instead of O(n²).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CrowdSeparation = {
    CELL_SIZE: 32,
    RADIUS: 14,
    Y_BAND: 18,
    STRENGTH: 0.35,
    MAX_NUDGE: 0.7,

    _cells: new Map(),
    _pool: [],
    _poolIdx: 0,

    _acquire(x, y, i) {
        let obj;
        if (this._poolIdx < this._pool.length) {
            obj = this._pool[this._poolIdx++];
            obj.x = x; obj.y = y; obj.i = i;
        } else {
            obj = { x, y, i };
            this._pool.push(obj);
            this._poolIdx++;
        }
        return obj;
    },

    rebuild(models, charRefs, camLeft, camRight) {
        this._cells.clear();
        this._poolIdx = 0;
        const cs = this.CELL_SIZE;
        const len = models.length;
        for (let i = 0; i < len; i++) {
            const m = models[i];
            const refs = charRefs[m.id];
            if (!refs) continue;
            if (refs.bld !== null) continue;
            if (refs._metroState && refs._metroState !== 'none') continue;
            if (refs._streetState === 'chatting') continue;
            if (!refs.c.visible) continue;
            const x = refs.c.x;
            if (x < camLeft || x > camRight) continue;
            const y = (typeof refs._logicalY === 'number') ? refs._logicalY : refs.c.y;
            const cellX = Math.floor(x / cs);
            const cellY = Math.floor(y / cs);
            const key = cellX * 10000 + cellY;
            let arr = this._cells.get(key);
            if (!arr) { arr = []; this._cells.set(key, arr); }
            arr.push(this._acquire(x, y, i));
        }
    },

    nudge(refs, i) {
        if (!refs) return 0;
        if (refs.bld !== null) return 0;
        if (refs._metroState && refs._metroState !== 'none') return 0;
        if (refs._streetState === 'chatting') return 0;
        const cs = this.CELL_SIZE;
        const r = this.RADIUS;
        const yb = this.Y_BAND;
        const st = this.STRENGTH;
        const x = refs.c.x;
        const y = (typeof refs._logicalY === 'number') ? refs._logicalY : refs.c.y;
        const cellX = Math.floor(x / cs);
        const cellY = Math.floor(y / cs);
        let dx = 0;
        for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
            for (let cy = cellY - 1; cy <= cellY + 1; cy++) {
                const arr = this._cells.get(cx * 10000 + cy);
                if (!arr) continue;
                for (let k = 0; k < arr.length; k++) {
                    const other = arr[k];
                    if (other.i === i) continue;
                    const ddy = y - other.y;
                    if (ddy > yb || ddy < -yb) continue;
                    const ddx = x - other.x;
                    const adx = ddx < 0 ? -ddx : ddx;
                    if (adx > r) continue;
                    // Quadratic falloff: stronger push when closer, zero at radius edge
                    const t = 1 - adx / r;
                    const push = st * t * t + 0.08 * t;
                    dx += ddx >= 0 ? push : -push;
                }
            }
        }
        const mx = this.MAX_NUDGE;
        if (dx > mx) dx = mx;
        else if (dx < -mx) dx = -mx;
        return dx;
    }
};

if (typeof window !== 'undefined') window.CrowdSeparation = CrowdSeparation;
