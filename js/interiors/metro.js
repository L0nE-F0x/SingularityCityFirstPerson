/* ══════════════════════════════════════════════════════════════════════════
   METRO STATION — ported from pixi/js/interior_metro.js.

   Two levels only, and deliberately so: interact.js boards trains when
   `Interior.floor === Interior.maxFloor` and the building type is metro, so
   the platform must stay the top floor. Floor 0 is the ticket hall, floor 1
   the platform; the glass lift shaft is drawn on both so the descent reads.

   Staff rotate on the day/night shift like the 2D station does — eight named
   workers total, never all present at once.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, vistaTex } from './kit.js';

const STAFF = {
    ticket: { name: 'Ticket Agent', role: 'Ticket Agent', color: 0x3b82f6 },
    guard: { name: 'Station Guard', role: 'Station Guard', color: 0xef4444 },
    info: { name: 'Info Desk', role: 'Passenger Info', color: 0x06b6d4 },
    attendant: { name: 'Platform Attendant', role: 'Platform Attendant', color: 0xfbbf24 },
    dispatch: { name: 'Train Dispatcher', role: 'Dispatcher', color: 0x22c55e },
    nightGuard: { name: 'Night Guard', role: 'Night Guard', color: 0xef4444 },
    maint: { name: 'Maintenance Tech', role: 'Maintenance', color: 0x22c55e },
    signal: { name: 'Signal Operator', role: 'Signal Ops', color: 0x06b6d4 }
};

/** The glass lift that connects hall to platform. Drawn on both floors at the
 *  same x/z so riding the lift feels like the same shaft, not two rooms. */
function glassShaft(c, x, z, top) {
    const w = 62, d = 52;
    for (const sx of [-1, 1]) c.box(5, c.H, 5, x + sx * w / 2, c.H / 2, z - d / 2, 0x475569);
    for (const sx of [-1, 1]) c.box(5, c.H, 5, x + sx * w / 2, c.H / 2, z + d / 2, 0x475569);
    c.box(w, 4, d, x, c.H - 4, z, 0x334155);
    // glazing: thin lit panes so you can see the car through it
    for (const sz of [-1, 1]) c.lit(w - 8, c.H - 16, 1, x, c.H / 2, z + sz * d / 2, 0x0e3a52);
    c.lit(1, c.H - 16, d - 8, x - w / 2, c.H / 2, z, 0x0e3a52);
    // the car itself parks at whichever end of the shaft this floor is
    const cy = top ? 30 : c.H - 46;
    c.box(w - 14, 42, d - 14, x, cy, z, 0x94a3b8);
    c.lit(w - 22, 3, d - 22, x, cy + 20, z, 0xe0f2fe);
    c.lit(2, 38, 2, x - (w - 14) / 2, cy, z + (d - 14) / 2, 0x22d3ee);
    c.lit(2, 38, 2, x + (w - 14) / 2, cy, z + (d - 14) / 2, 0x22d3ee);
    c.solid(x, z, w, d);
    c.lit(30, 10, 2, x, c.H - 14, z + d / 2 + 1, 0xfbbf24);   // floor indicator
}

export const METRO = {
    id: 'metro',
    theme(b, f, th) {
        if (f >= 1) {
            th.cat = 'platform';
            th.wall = 0x0f172a; th.ceil = 0x020617; th.floor = 0x1e293b;
            th.lamp = 0xfbbf24; th.accent = '#fbbf24'; th.dim = true;
        } else {
            th.cat = 'metro';
            th.wall = 0x1e293b; th.ceil = 0x0f172a; th.floor = 0x334155;
            th.lamp = 0x22d3ee; th.accent = '#22d3ee'; th.dim = true;
        }
    },
    floors: [
        // ── 0 · TICKET HALL ─────────────────────────────────────────────────
        {
            key: 'hall', label: 'TICKET HALL',
            build(c) {
                const night = c.night;
                // fare gates across the middle of the hall
                for (const gx of [-84, -28, 28, 84]) P.turnstile(c, gx, 20, gx < 0 ? 0x4ade80 : 0xef4444);
                c.lit(240, 1.2, 6, 0, 1.2, 62, 0x22d3ee);          // wayfinding stripe
                c.lit(6, 1.2, 150, 0, 1.2, 120, 0x22d3ee);

                // ticket vending machines against the back wall
                for (let i = 0; i < 4; i++) {
                    const mx = -165 + i * 62;
                    c.box(46, 60, 28, mx, 30, -160, 0x1e293b); c.solid(mx, -160, 46, 28);
                    c.lit(34, 24, 1, mx, 42, -145, 0x22d3ee);
                    c.lit(20, 5, 1, mx, 22, -145, 0x4ade80);
                }
                // staffed ticket office window
                P.counter(c, 150, -160, 120, 40, 0x243447, 0x3d5570, 0x22d3ee);
                c.box(126, 34, 6, 150, 58, -178, 0x0f172a);
                c.lit(110, 24, 1, 150, 58, -174, 0x0e3a52);

                // departure board — the reason anybody looks up in a station
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#050a14', accent: '#22d3ee',
                    title: 'DEPARTURES', titleSize: 32, grid: true,
                    lines: ['+WEST LINE      2 min', '+EAST LINE      4 min',
                        '~INNOVATION     7 min', '!ALL LINES  ' + (night ? 'REDUCED SVC' : 'GOOD SERVICE')],
                    lineSize: 22
                }), 230, 100, -40, 62, -c.D / 2 + c.WALL / 2 + 3);

                // network map kiosk
                P.pylon(c, 235, 40, 78, 0x38bdf8, 34);
                c.plate(panelTex({
                    w: 256, h: 256, bg: '#071018', accent: '#38bdf8', align: 'center',
                    title: 'NETWORK', titleSize: 24,
                    lines: ['~west · central', '~central · east', '~central · innovation', '+you are here'], lineSize: 18
                }), 30, 30, 235, 46, 47);

                glassShaft(c, 170, 130, true);
                // stair well down to the platform, beside the lift
                P.stairs(c, 60, 60, 9, 5, 12, 76, 0x475569, 1);
                for (const rx of [22, 98]) c.box(4, 40, 4, rx, 20, 100, 0x94a3b8);

                P.plant(c, -250, 170, 36);
                c.box(20, 24, 20, -140, 12, 170, 0x475569);        // litter bin

                if (night) {
                    c.npc(c, 210, 130, STAFF.nightGuard, -1);
                } else {
                    c.npc(c, 150, -128, STAFF.ticket, 1);
                    c.npc(c, 215, 170, STAFF.guard, -1);
                    c.npc(c, -80, 150, STAFF.info, -1);
                }
            }
        },
        // ── 1 · PLATFORM ────────────────────────────────────────────────────
        {
            key: 'platform', label: 'PLATFORM',
            build(c) {
                const night = c.night;
                const trackZ = -170;
                // platform edge: tactile strip then a drop to the ballast
                c.box(c.W - 20, 3, 30, 0, 1.5, trackZ + 62, 0xfbbf24);
                c.lit(c.W - 60, 1.6, 8, 0, 3, trackZ + 60, 0xfde68a);
                c.box(c.W - 20, 22, 92, 0, -9, trackZ, 0x020617);
                for (const rail of [-16, 16]) c.box(c.W - 30, 3, 4, 0, 1, trackZ + rail, 0x8b95a3);
                for (let i = 0; i < 14; i++) c.box(44, 2.5, 9, -260 + i * 40, -0.5, trackZ, 0x3f3f46);
                // conductor rail, kept off to one side like the real thing
                c.box(c.W - 30, 3, 4, 0, 2, trackZ + 34, 0x64748b);
                c.lit(c.W - 60, 1, 1.5, 0, 4, trackZ + 34, 0xf59e0b);

                // tunnel mouths at both ends of the track bed
                for (const s of [-1, 1]) {
                    c.box(150, 62, 16, s * 200, 31, trackZ - 44, 0x0b1220);
                    c.plate(vistaTex('tunnel', '#fbbf24'), 116, 82, s * 200, 34, trackZ - 34);
                }

                // canopy columns down the platform spine
                for (const px of [-200, -70, 70, 200]) {
                    P.column(c, px, -20, c.H - 6, 0x475569, 18);
                    c.lit(22, 4, 22, px, c.H - 14, -20, 0xfbbf24);
                }
                // benches and waiting furniture behind the columns
                for (const bx of [-185, -80, 120, 230]) {
                    c.box(64, 12, 20, bx, 12, 60, 0x334155); c.solid(bx, 60, 64, 20);
                    for (const s of [-1, 1]) c.box(6, 12, 16, bx + s * 26, 6, 60, 0x475569);
                    c.box(64, 22, 5, bx, 24, 70, 0x475569);
                }
                // next-train indicator hanging over the platform
                c.plate(panelTex({
                    w: 512, h: 128, bg: '#050a14', accent: '#fbbf24', align: 'center',
                    title: night ? 'LAST TRAINS' : 'NEXT TRAIN', titleSize: 30,
                    lines: ['~CENTRAL · ALL STOPS', '+ARRIVING — STAND BACK'], lineSize: 22, padTop: 36
                }), 210, 52, 0, 78, 20);
                c.box(216, 6, 6, 0, c.H - 10, 20, 0x1e293b);

                // ad panels on the far wall, and a vending machine
                for (let i = 0; i < 4; i++) {
                    c.box(58, 44, 3, -180 + i * 120, 50, c.D / 2 - c.WALL / 2 - 6, 0x0f172a);
                    c.lit(50, 36, 1.2, -180 + i * 120, 50, c.D / 2 - c.WALL / 2 - 8,
                        [0x22d3ee, 0xf472b6, 0xfbbf24, 0x4ade80][i]);
                }
                c.box(40, 58, 28, 250, 29, 130, 0x1e293b); c.solid(250, 130, 40, 28);
                c.lit(28, 34, 1, 250, 36, 145, 0xf472b6);

                glassShaft(c, 170, 130, false);

                if (night) {
                    c.npc(c, -60, 30, STAFF.maint, 1);
                    c.npc(c, 230, 40, STAFF.signal, -1);
                } else {
                    c.npc(c, -120, 20, STAFF.attendant, 1);
                    c.npc(c, 60, 20, STAFF.dispatch, 1);
                }
            }
        }
    ]
};
