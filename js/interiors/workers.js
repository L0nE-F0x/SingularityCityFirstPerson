/* ══════════════════════════════════════════════════════════════════════════
   WORKER HOUSING — ported from pixi/js/interior_npc.js.

   Six blocks (npc_apt_1..6) housing the people who actually run the city's
   infrastructure: the NOC leads, SREs, litho techs and power engineers from
   WORKERS in data.js. Three kinds of floor, in the 2D app's order:

     0        Foyer      — reception desk, mailboxes, resident board, doorman
     1..n-1   Apartments — four units a floor, each with a real occupant
     n        Laundry    — washers and storage cages (the "basement", reached
                           by riding to the top of the stack)

   The lift only travels up, so the 2D basement becomes the last stop rather
   than a level below the lobby. It is still lit and dressed as a basement,
   which is what makes it read.

   Occupancy is the point of the building: units are filled from the real
   WORKERS roster, and whether someone is home depends on their shift. Walk in
   at 03:00 and the night-shift units are dark and empty because those people
   are out at the datacentre.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, nameTex, seeded } from './kit.js';
import { WORKERS } from '../data.js';

const UNITS_PER_FLOOR = 4;

/** Stable slice of the roster for a given block, so unit 3B is always the
 *  same person no matter how many times you ride past it. */
function residentsFor(b) {
    const idx = Math.max(0, (parseInt(String(b?.id || '').replace('npc_apt_', ''), 10) || 1) - 1);
    const per = Math.ceil(WORKERS.length / 6);
    const start = (idx * per) % WORKERS.length;
    const out = [];
    for (let i = 0; i < per; i++) out.push(WORKERS[(start + i) % WORKERS.length]);
    return out;
}

/** Is this resident home right now? Night-shift staff invert the day. */
function isHome(w, night) {
    return w.shift === 'night' ? !night : night;
}

function unitLabel(floor, i) {
    return floor + 'ABCD'[i % 4];
}

/* ── floor builders ──────────────────────────────────────────────────────── */

function buildFoyer(c) {
    const res = residentsFor(c.b);
    const hw = c.W / 2, hd = c.D / 2;

    // reception desk with a monitor, facing the street door
    P.counter(c, 40, -40, 120, 40, 0x1e293b, 0x475569);
    c.solid(40, -40, 120, 40);
    P.screen(c, 40, 30, -22, 26, 14, 0x22d3ee);

    // mailbox wall — one pigeonhole per resident, lit if they have post
    const rnd = seeded((c.b.id || 'apt') + ':mail');
    const cols = 8, rows = Math.max(2, Math.ceil(res.length / 8));
    c.box(120, rows * 16 + 8, 8, -120, 44, -hd + c.WALL + 4, 0x1e293b);
    for (let r = 0; r < rows; r++) {
        for (let i = 0; i < cols; i++) {
            const mx = -172 + i * 14, my = 26 + r * 16;
            c.box(11, 12, 2, mx, my, -hd + c.WALL + 9, 0x334155);
            if (rnd() < 0.3) c.lit(3, 2, 1.5, mx, my - 4, -hd + c.WALL + 10.5, 0xfbbf24);
        }
    }

    // resident board: how many people live here, and how many are in
    const inNow = res.filter(w => isHome(w, c.night)).length;
    c.plate(panelTex({
        title: 'RESIDENTS',
        lines: [
            inNow + ' / ' + res.length + ' HOME',
            c.night ? 'NIGHT SHIFT OUT' : 'DAY SHIFT OUT',
            'BLOCK ' + String(c.b.id || '').replace('npc_apt_', '')
        ],
        accent: c.accentCss
    }), 76, 52, 150, 46, -hd + c.WALL / 2 + 3);

    // lobby seating and a tired pot plant
    c.box(70, 16, 26, -40, 8, 90, 0x334155); c.solid(-40, 90, 70, 26);
    c.box(70, 20, 8, -40, 22, 78, 0x3b4657);
    P.plant(c, hw - 60, 100, 42);
    P.plant(c, -hw + 60, 100, 34);

    // The doorman clocks off overnight — the 2D block does the same, and an
    // empty desk at 3am says more about shift work than a permanent NPC would.
    if (!c.night) {
        P.npc(c, 40, -8, { name: 'Doorman', role: 'Front of House', col: 0x475569 }, 1);
        c.plate(nameTex('Doorman', 'Front of House', c.accentCss), 46, 15, 40, 40, -14);
    }
}

function buildApartments(c) {
    const res = residentsFor(c.b);
    const hw = c.W / 2, hd = c.D / 2;
    const floor = c.floor;
    const rnd = seeded((c.b.id || 'apt') + ':f' + floor);

    // central corridor: units left and right of a runner
    c.box(c.W - 40, 1.4, 90, 0, 1, 0, 0x243040);
    for (let i = 0; i < 6; i++) c.lit(16, 1.2, 3, -170 + i * 68, c.H - 5, 0, 0xfff0c8);

    const unitW = (c.W - 60) / UNITS_PER_FLOOR;
    for (let u = 0; u < UNITS_PER_FLOOR; u++) {
        const ux = -hw + 30 + u * unitW + unitW / 2;
        const side = u % 2 === 0 ? -1 : 1;      // alternate sides of the corridor
        const uz = side * 120;
        const w = res[((floor - 1) * UNITS_PER_FLOOR + u) % res.length];
        const home = isHome(w, c.night);

        // party walls + the door onto the corridor
        c.box(6, c.H, 150, ux - unitW / 2, c.H / 2, uz, 0x2f3947);
        c.box(unitW, 6, 6, ux, c.H - 3, uz, 0x2f3947);
        c.box(26, 44, 4, ux, 22, uz - side * 74, home ? 0x4a5a3a : 0x33404f);
        // unit number plate beside the door
        c.plate(nameTex(unitLabel(floor, u), w.role, home ? c.accentCss : '#64748b'),
            40, 13, ux + 36, 34, uz - side * 72);

        // the flat itself: bed, desk, a screen that is only on if someone is in
        c.box(52, 14, 30, ux - 18, 7, uz + side * 30, 0x3f4a5c);
        c.solid(ux - 18, uz + side * 30, 52, 30);
        c.box(52, 6, 10, ux - 18, 16, uz + side * 44, 0xcbd5e1);   // pillow end
        P.desk(c, ux + 34, uz + side * 20, 0x4a3f33, home ? 0x1e293b : 0x111820);
        if (home) {
            P.screen(c, ux + 34, 30, uz + side * 20 - side * 8, 18, 11, w.color ? parseInt(w.color.slice(1), 16) : 0x38bdf8);
            P.npc(c, ux + 30, uz + side * 46, { name: w.name, role: w.role, col: parseInt((w.color || '#94a3b8').slice(1), 16) }, -side);
        }
        // a window on the outer wall, warm if occupied
        c.lit(34, 22, 2, ux, 42, side * (hd - c.WALL / 2 - 2), home ? 0xffe0a8 : 0x1b2534);
        // clutter varies per unit so four flats a floor don't read as one flat
        if (rnd() < 0.5) P.chair(c, ux + 6, uz + side * 58, 0x374151, -side);
        if (rnd() < 0.4) P.plant(c, ux - unitW / 2 + 16, uz + side * 56, 26);
        if (rnd() < 0.35) c.box(20, 26, 14, ux + unitW / 2 - 18, 13, uz + side * 20, 0x4b5563);
    }
}

function buildLaundry(c) {
    const hw = c.W / 2, hd = c.D / 2;
    const rnd = seeded((c.b.id || 'apt') + ':wash');

    // washer bank down the left of the room
    for (let i = 0; i < 5; i++) {
        const wx = -hw + 70 + i * 62;
        c.box(46, 40, 40, wx, 20, -110, 0xe2e8f0);
        c.solid(wx, -110, 46, 40);
        c.box(40, 9, 3, wx, 36, -90, 0x94a3b8);            // control panel
        c.box(20, 20, 3, wx, 18, -90, 0x0a0e18);           // porthole
        const running = rnd() < 0.45;
        c.lit(15, 15, 1.5, wx, 18, -88.5, running ? 0x22d3ee : 0x18222e);
        c.lit(3, 3, 1.5, wx - 16, 34, -88.5, running ? 0x4ade80 : 0x2a3340);
    }
    c.plate(panelTex({ title: 'LAUNDRY', lines: ['5 MACHINES', 'CARD ONLY', '+NO DYEING'], accent: c.accentCss }),
        70, 48, -hw + 150, 56, -hd + c.WALL / 2 + 3);

    // storage cages down the right — mesh fronts with junk behind
    for (let i = 0; i < 4; i++) {
        const cx = -60 + i * 78;
        c.box(64, 66, 4, cx, 33, 108, 0x475569);
        for (let g = 0; g < 7; g++) c.box(62, 1.2, 1.2, cx, 6 + g * 10, 110, 0x64748b);
        for (let g = 0; g < 6; g++) c.box(1.2, 64, 1.2, cx - 30 + g * 12, 33, 110, 0x64748b);
        c.box(4, 66, 60, cx - 32, 33, 138, 0x3d4757);
        c.solid(cx, 120, 64, 60);
        // stuff inside
        P.crate(c, cx - 14, 140, 20, 0x3d2914);
        if (rnd() < 0.6) P.barrel(c, cx + 16, 146, 0x5a5340);
        if (rnd() < 0.5) c.box(24, 34, 18, cx + 8, 17, 128, 0x334155);
    }

    // basement services: red conduit run and a bare strip light
    c.box(c.W - 40, 4, 4, 0, c.H - 10, -hd + 40, 0x7f1d1d);
    for (let i = 0; i < 7; i++) c.lit(4, 4, 4, -160 + i * 54, c.H - 10, -hd + 40, 0xef4444);
    for (let i = 0; i < 3; i++) c.lit(120, 2, 6, -140 + i * 140, c.H - 6, 20, 0xdbeafe);

    // a folding table nobody folds anything on
    P.table(c, 120, -40, 90, 50, 0x6b7280, 24);
    if (!c.night) P.npc(c, 60, -30, { name: 'Maintenance Tech', role: 'Building Services', col: 0xf59e0b }, 1);
}

/* ── the spec ────────────────────────────────────────────────────────────── */
export const WORKER_HOUSING = {
    id: 'worker_housing',

    theme(b, f, th, maxFloor) {
        th.cat = 'home';
        th.accent = '#38bdf8';
        if (f === 0) {
            // foyer: municipal, a bit institutional, well lit
            th.wall = 0x3d4757; th.ceil = 0x2b3340; th.floor = 0x55606e; th.lamp = 0xfff0c8;
        } else if (f >= maxFloor && maxFloor > 1) {
            // laundry / storage: concrete, cold strip light
            th.wall = 0x3a3f47; th.ceil = 0x24282e; th.floor = 0x4a5058; th.lamp = 0xdbeafe;
            th.dim = true; th.noPanels = true;
        } else {
            // residential corridors: warmer, dimmer, lower-key than the lobby
            /* Not `dim`: a residential corridor still has to be legible, and
               at dim the whole floor read as a dark blue canyon with the units
               invisible inside it. Warm and slightly under the lobby instead. */
            th.wall = 0x5b6675; th.ceil = 0x424c5a; th.floor = 0x4d5765; th.lamp = 0xffe6b8;
        }
    },

    /* A representative stack, for anything that wants the spec without a
       building in hand. Real blocks go through workerRoom(), which trims to
       the storey count and turns the last stop into the laundry. */
    floors: [
        { key: 'foyer', label: 'FOYER', build: buildFoyer },
        { key: 'apt1', label: 'FLOOR 1', build: buildApartments },
        { key: 'apt2', label: 'FLOOR 2', build: buildApartments },
        { key: 'laundry', label: 'LAUNDRY & STORAGE', build: buildLaundry }
    ]
};

/** Floor list trimmed to a block's real storey count, with the last stop
 *  turned into the laundry basement. */
export function workerRoom(b) {
    const storeys = Math.max(2, Math.min(9, (b?.worldFloors || b?.fl || 4)));
    const floors = [{ key: 'foyer', label: 'FOYER', build: buildFoyer }];
    for (let f = 1; f < storeys - 1; f++) {
        floors.push({ key: 'apt' + f, label: 'FLOOR ' + f, build: buildApartments });
    }
    floors.push({ key: 'laundry', label: 'LAUNDRY & STORAGE', build: buildLaundry });
    return { id: 'worker_housing_' + (b?.id || 'x'), theme: WORKER_HOUSING.theme, floors };
}
