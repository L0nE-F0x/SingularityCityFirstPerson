/* ============================================================================
   MULTIPLAYER — intentionally offline in this build.

   Production 2D has real Supabase ghost cursors when peers are connected.
   We do NOT invent fake "Vesper / Nova" pedestrians when nobody is online —
   placeholders were misleading. When a real network layer is wired, export
   hooks live here; until then this module is a no-op.
   ============================================================================ */

/** @deprecated offline — always empty */
export function createGhosts(n = 0) {
    return [];
}

/** @deprecated offline — no-op */
export function stepGhost(_g, _dt) {
    /* no-op */
}

export const Multiplayer = {
    active: false,
    ghosts: [],
    init(_scene) {
        this.ghosts = [];
        this.active = false;
        // Explicitly no meshes, no sprites, no name tags.
    },
    update(_dt) { /* offline */ },
    snapshot() {
        return { count: 0, names: [], simulated: false, online: false };
    }
};

if (typeof window !== 'undefined') window.Multiplayer = Multiplayer;
