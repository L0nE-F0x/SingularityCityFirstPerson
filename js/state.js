/* ══════════════════════════════════════════════════════════════════════════
   SHARED STATE + WORLD CONSTANTS
   ══════════════════════════════════════════════════════════════════════════ */

// Scale: 10 world units = 1 meter. A 200-wide building = 20 m.
export const FLOOR_H = 24;        // 2.4 m per storey
export const EYE_H = 17;          // player eye height (1.7 m)
export const WALK_SPEED = 150;    // u/s  (~5.4 km/h)
export const SPRINT_SPEED = 320;  // u/s (~11.5 km/h)
export const PLAYER_RADIUS = 7;
export const GRAVITY = 900;
export const JUMP_VEL = 320;

// District grid
export const CELL_W = 800;
export const CELL_D = 800;
export const GAP = 200;
export const GRID_COLS = 5;
export const GRID_ROWS = 4;

// City extents (computed)
export const CITY_W = GRID_COLS * (CELL_W + GAP) - GAP;   // 4800
export const CITY_D = GRID_ROWS * (CELL_D + GAP) - GAP;   // 3800
export const SEA_X = -(CITY_W / 2) - 100;                 // water starts west of this

// The one global object. Populated by main.js at boot.
export const G = {
    // three
    renderer: null, scene: null, camera: null, canvas: null,
    // timing
    tick: 0, time: 0, dayPhase: 0.5, timeScale: 1, elapsed: 0,
    // world data
    bldById: {}, placements: [], colliders: [], districtAt: null,
    // systems (filled at boot)
    player: null, world: null, citizens: null, traffic: null,
    weatherSys: null, ui: null, audio: null, interact: null,
    // state
    started: false, paused: false, panelOpen: false, tourMode: false,
    orbitMode: false, xrayMode: false, holomapMode: false, terminalOpen: false,
    floorY: 0,          // ground level the player stands on (interiors sit low)
    inside: null,       // the building you are inside, or null
    quality: 'medium',
    achievements: {}, visitedDistricts: {}, metCitizens: {},
    stats: { tramsSpotted: 0, moonClicks: 0 },
    flags: { konami: false, caturday: false, auroraSeen: false },
    settings: { music: true, sfx: true, volume: 0.8, fov: 70, invertY: false, sensitivity: 1.0 },
    // perf
    fps: 60, frameMs: 16
};

export function qualityPreset(q) {
    switch (q) {
        // The production city is a PEDESTRIAN world — it runs a single Nvidia
        // delivery truck, not a traffic sim. A handful of ambient cars keeps
        // the streets from being dead without turning it into a freeway.
        case 'low':    { return { dpr: 1.0,  particles: 900,  citizens: 150, cars: 6,  far: 2600 }; }
        case 'high':   { return { dpr: 1.75, particles: 2200, citizens: 340, cars: 16, far: 4200 }; }
        default:       { return { dpr: 1.35, particles: 1500, citizens: 240, cars: 10, far: 3400 }; }
    }
}

// Day phase 0..1 from real wall clock (0 = midnight, 0.5 = noon), scaled by timeScale.
export function computeDayPhase(dt) {
    if (G.fixedPhase != null) return G.fixedPhase;   // dev/test override (?dp=)
    if (G.timeScale <= 1) {
        const d = new Date();
        return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
    }
    G._phaseAcc = (G._phaseAcc ?? computeDayPhase(0)) + (dt * G.timeScale) / 86400;
    return G._phaseAcc % 1;
}

export function clockString(dp) {
    const h = Math.floor(dp * 24), m = Math.floor((dp * 24 - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
