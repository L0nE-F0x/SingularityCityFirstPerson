/* ══════════════════════════════════════════════════════════════════════════
   ROOM REGISTRY — maps a building to a bespoke multi-floor layout.

   Why a registry rather than more branches in Interior._dress: a destination's
   layout is a data problem (which floors, what is on them, who works there),
   not a rendering problem. Room specs live in their own modules so a single
   destination can be as detailed as its 2D counterpart without turning
   interior.js into a 10k-line switch.

   A spec is:
     { id, floors: [ { key, label, build(ctx) } ], theme?(b, floorIdx, th) }
   Floor 0 is always the level you walk in on; the lift reaches the rest.
   Anything without a spec falls through to Interior's generic themed room.
   ══════════════════════════════════════════════════════════════════════════ */
import { BAR } from './bar.js';
import { UNDERGROUND } from './underground.js';
import { METRO } from './metro.js';
import { EMBASSY } from './embassy.js';
import { VILLA } from './villa.js';
import { ALIGNMENT } from './alignment.js';
import { PRESS } from './press.js';
import { LEGACY } from './legacy.js';
import { BACKBONE } from './backbone.js';
import { AGENT_ROOMS, agentRoom } from './agents.js';
import { ROBOTICS_ROOMS, roboticsRoom } from './robotics.js';
import { LONGEVITY_ROOMS, longevityRoom } from './longevity.js';

export const ROOM_SPECS = [BAR, UNDERGROUND, METRO, EMBASSY, VILLA, ALIGNMENT, PRESS, LEGACY, BACKBONE,
    ...Object.values(AGENT_ROOMS), ...Object.values(ROBOTICS_ROOMS), ...Object.values(LONGEVITY_ROOMS)];

/** Which bespoke layout (if any) this building should use. */
export function resolveRoom(b) {
    if (!b) return null;
    const id = b.id || '', t = b.type || '';
    if (id === 'neon_bar' || t === 'bar') return BAR;
    if (id === 'black_market' || t === 'black_market') return UNDERGROUND;
    if (t === 'metro' || id.startsWith('metro_')) return METRO;
    if (t === 'embassy' || id.startsWith('embassy_')) return EMBASSY;
    if (id.startsWith('diplomat_villa_')) return VILLA;
    if (t === 'cabin' || id.startsWith('align_')) return ALIGNMENT;
    if (t === 'newspaper' || id === 'times_hq') return PRESS;
    if (id === 'bld_1') return LEGACY;                       // Legacy Systems museum
    if (id.startsWith('backbone_') || t === 'backbone') return BACKBONE;
    // Agent District: one spec per building, since their storey lists differ.
    if (id.startsWith('agents_') || t === 'agents') return agentRoom(b);
    // Robotics Quarter: likewise — assembly is six storeys, testing is four.
    if (id.startsWith('robotics_') || t === 'robotics' || b.district === 'robotics') return roboticsRoom(b);
    // Longevity Wing: five buildings, five different research stacks.
    if (id.startsWith('longevity_') || t === 'longevity' || b.district === 'longevity') return longevityRoom(b);
    return null;
}

/** Human-readable floor name, for lift banners and the floor plaque. */
export function floorLabel(spec, idx) {
    const f = spec?.floors?.[idx];
    return f ? f.label : null;
}
