/* ══════════════════════════════════════════════════════════════════════════
   ROBOTICS QUARTER — ported from pixi/js/interior_robotics.js.

   Four buildings whose storey lists genuinely differ, so this exports one spec
   per building the way agents.js does. The 2D module stacks the assembly line
   with chassis fab on top and finished goods at the bottom — the line runs
   downhill — and that order is kept here, which is why floor 0 of the Assembly
   Line is the Hall of Humanoids and not the welding bay.

   Each building's B1 is appended as the last lift stop rather than a negative
   floor, matching the museum's archives: the lift only counts upward, and the
   floor plaque carries the "B1 ·" prefix so you still know where you are.

   The humanoids themselves live in robots.js — see that file for why the real
   silhouettes matter here.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex } from './kit.js';
import { barsTex, logTex, metersTex, pipelineTex, cardsTex, chartTex } from './screens.js';
import { robot, chassis, armRobot, cageWall, ROBOT_KEYS, ROBOT_PROFILES } from './robots.js';

const back = (c) => -c.D / 2 + c.WALL / 2 + 3;

/** Hazard chevrons painted on the floor — the quarter's visual signature, and
 *  the cheapest way to say "this is a factory, not an office". */
function hazardStrip(c, z, w, x = 0, col = 0xfbbf24) {
    c.box(w, 1.2, 22, x, 0.7, z, 0x1f2937);
    for (let i = 0; i < Math.floor(w / 26); i++) {
        c.lit(14, 1.4, 14, x - w / 2 + 16 + i * 26, 1.3, z, col);
    }
}

/** Overhead gantry rail with a travelling hoist. Every bay gets one. */
function gantry(c, z, col = 0xf97316, hookX = 0) {
    c.box(c.W - 80, 9, 14, 0, c.H - 16, z, 0x3a4250);
    c.lit(c.W - 110, 2, 3, 0, c.H - 21, z, col);
    c.box(26, 12, 20, hookX, c.H - 26, z, 0x64748b);
    c.box(3, 22, 3, hookX, c.H - 43, z, 0x94a3b8);
    c.box(12, 7, 12, hookX, c.H - 56, z, 0x475569);
}

/** Conveyor run down the middle of a bay, with roller detail. */
function conveyor(c, z, x = 0, w = 380, col = 0x22d3ee) {
    c.box(w, 20, 46, x, 10, z, 0x2a3140); c.solid(x, z, w, 46);
    c.box(w, 4, 52, x, 21, z, 0x3d4757);
    for (let i = 0; i < Math.floor(w / 16); i++) c.box(6, 3, 50, x - w / 2 + 10 + i * 16, 24, z, 0x596577);
    c.lit(w - 12, 1.5, 4, x, 24, z + 25, col);
    c.lit(w - 12, 1.5, 4, x, 24, z - 25, col);
}

/** Parts rack: open shelving with colour-coded bins. Warehouse signature. */
function partsRack(c, x, z, shelves = 4, h = 86, w = 74) {
    c.box(w, h, 34, x, h / 2, z, 0x3a4250); c.solid(x, z, w, 34);
    for (let s = 0; s < shelves; s++) {
        const sy = 10 + s * ((h - 14) / shelves);
        c.box(w - 4, 3, 32, x, sy, z, 0x545f6e);
        for (let b = 0; b < 4; b++) {
            const col = [0xec4899, 0x06b6d4, 0xfbbf24, 0x8b5cf6][(b + s) % 4];
            c.box(14, 11, 26, x - w / 2 + 12 + b * 17, sy + 8, z, col);
        }
    }
}

// ── floor kinds ─────────────────────────────────────────────────────────────
// One builder per prop treatment, mirroring the 2D module's _drawFloorProps
// switch. Wording differs per building and rides in on the floor entry `e`.

const KIND = {

    /** HALL OF HUMANOIDS — every real flagship in a lit display bay. */
    goods(c, e) {
        const keys = ROBOT_KEYS;
        const bayW = 480 / keys.length;
        keys.forEach((key, i) => {
            const p = ROBOT_PROFILES[key];
            const x = -240 + bayW / 2 + i * bayW;
            // backlit alcove: a dark recess with the maker's colour washing it
            c.box(bayW - 8, 78, 26, x, 39, -150, 0x0d1220); c.solid(x, -150, bayW - 8, 26);
            c.lit(bayW - 22, 62, 1.5, x, 42, -136.5, p.accent);
            c.box(bayW - 14, 12, 44, x, 6, -128, 0x1a2540);               // podium
            c.lit(bayW - 20, 1.6, 40, x, 12.4, -128, p.accent);
            robot(c, key, x, -128, { y: 12, facing: 1, label: true, scale: 1.05 });
            if (i) c.box(4, 78, 30, x - bayW / 2, 39, -150, 0x1a2540);    // bay divider
        });
        // allocation desks flank the aisle rather than crossing it — the view
        // from the street door has to land on the robots, not on a chair back
        for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
            P.desk(c, sx * (120 + i * 90), 60, 0x2a3140, 0x10b981);
        }
        c.plate(cardsTex({
            w: 768, h: 320, accent: e.css, bg: '#070c14',
            title: 'FLEET ALLOCATION', sub: 'this quarter', perRow: 3,
            cards: keys.map((k) => ({
                name: ROBOT_PROFILES[k].name, sub: ROBOT_PROFILES[k].maker,
                stat: ROBOT_PROFILES[k].note, col: ROBOT_PROFILES[k].css
            }))
        }), 250, 104, 60, 62, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        hazardStrip(c, 150, 420, 0, 0x10b981);
        c.npc(c, -200, 150, { name: 'QA Inspector', role: 'Finished Goods', color: 0x4ade80 }, -1);
        c.npc(c, 210, 130, { name: 'Fleet Allocator', role: 'Dispatch', color: 0x10b981 }, -1);
    },

    /** CALIBRATION — a laser grid chamber with one robot on the rig. */
    calibration(c, e) {
        // the grid: floor lines and a ceiling emitter frame, no walls, so the
        // room reads as a measurement volume rather than a corridor
        for (let i = 0; i < 11; i++) {
            c.lit(1.2, 0.8, 300, -220 + i * 44, 1.1, -40, 0xf43f5e);
            c.lit(1.2, 0.8, 300, -220 + i * 44, c.H - 8, -40, 0x7f1d3a);
        }
        for (let i = 0; i < 7; i++) c.lit(460, 0.8, 1.2, 0, 1.1, -180 + i * 50, 0xf43f5e);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            c.box(7, c.H - 10, 7, sx * 224, c.H / 2, -40 + sz * 152, 0x2a3140);
        }
        // the rig itself: a turntable with an Optimus being measured
        c.box(96, 10, 96, 0, 5, -40, 0x1a2540); c.solid(0, -40, 96, 96);
        c.lit(84, 1.6, 84, 0, 10.6, -40, 0xf43f5e);
        robot(c, 'tesla', 0, -40, { y: 10, facing: 1, pose: 'reach', label: true, scale: 1.1 });
        for (const sx of [-1, 1]) {                                        // tracker masts
            c.box(10, 74, 10, sx * 120, 37, -40, 0x3a4250); c.solid(sx * 120, -40, 10, 10);
            c.lit(12, 6, 12, sx * 120, 76, -40, 0x22d3ee);
            c.lit(4, 4, 4, sx * 120, 60, -40 + 6, 0xf43f5e);
        }
        for (let i = 0; i < 3; i++) {
            const x = -150 + i * 150;
            c.box(90, 30, 46, x, 15, 130, 0x24303f); c.solid(x, 130, 90, 46);
            c.box(96, 4, 52, x, 32, 130, 0x33404f);
            P.screen(c, x, 50, 108, 40, 24, [0x22d3ee, 0xf43f5e, 0x4ade80][i], 2.4, 1);
            P.chair(c, x, 176, 0x334155, 1);
        }
        c.plate(metersTex({
            w: 576, h: 288, accent: e.css, title: 'CALIBRATION', sub: 'unit 4471',
            rows: [{ label: 'joint zero drift', v: 0.12 }, { label: 'IMU bias', v: 0.31 },
            { label: 'stereo reprojection', v: 0.08 }, { label: 'torque map', v: 0.94, cap: 'PASS' }]
        }), 220, 110, -80, 64, back(c));
        c.npc(c, 180, 190, { name: 'Calibration Tech', role: 'Metrology', color: 0x22d3ee }, -1);
        c.npc(c, -220, 100, { name: 'Sensor Eng', role: 'Optics', color: 0x06b6d4 }, 1);
    },

    /** AI BRAIN UPLOAD — racks, cradles, and robots waiting to be filled. */
    upload(c, e) {
        for (let i = 0; i < 7; i++) P.rack(c, -210 + i * 70, -150, [0x22d3ee, 0x8b5cf6, 0x4ade80][i % 3], 60, 88, 34, 1);
        c.box(c.W - 90, 6, 18, 0, 94, -150, 0x2a3140);
        c.lit(c.W - 120, 1.6, 4, 0, 97, -150, 0x8b5cf6);
        // upload cradles: a robot slumped in a frame with an umbilical to the rack
        for (let i = 0; i < 4; i++) {
            const x = -180 + i * 120, key = ['figure', 'apptronik', 'unitree', 'tesla'][i];
            c.box(56, 12, 54, x, 6, -20, 0x1a2540); c.solid(x, -20, 56, 54);
            for (const sx of [-1, 1]) c.box(5, 62, 5, x + sx * 25, 43, -42, 0x3a4250);
            c.box(56, 5, 5, x, 74, -42, 0x3a4250);
            robot(c, key, x, -20, { y: 12, facing: 1, solid: false, scale: 0.92 });
            c.lit(3, 40, 3, x + 22, 40, -34, 0x8b5cf6);                    // umbilical
            c.lit(20, 2, 1, x, 78, -42, i < 3 ? 0x4ade80 : 0xfbbf24);      // progress lamp
        }
        for (let i = 0; i < 3; i++) P.desk(c, -140 + i * 140, 130, 0x24303f, 0x8b5cf6);
        c.plate(logTex({
            w: 640, h: 320, accent: e.css, bg: '#08061a',
            title: 'WEIGHT TRANSFER', sub: 'vla-2026.4',
            lines: ['+unit 4471 · 12.4 GB · verified', '~unit 4472 · streaming 61%',
                '!unit 4473 · checksum retry 2', '+policy head swapped, sim eval queued',
                '~safety layer pinned, cannot hot-patch']
        }), 240, 118, -40, 64, back(c));
        c.npc(c, 200, 150, { name: 'Helix Trainer', role: 'Policy Upload', color: 0x3b82f6 }, -1);
        c.npc(c, -230, 60, { name: 'Neural Tuner', role: 'Fine-tuning', color: 0xa855f7 }, 1);
    },

    /** MOTOR INTEGRATION — dynamometers spinning actuators to destruction. */
    motor(c, e) {
        for (let i = 0; i < 5; i++) {
            const x = -200 + i * 100;
            c.box(80, 66, 60, x, 33, -140, 0x1e293b); c.solid(x, -140, 80, 60);
            c.box(86, 5, 66, x, 68, -140, 0x2b3a4e);
            // the coil: concentric lit rings faked with nested frames
            for (let r = 0; r < 3; r++) {
                const s = 34 - r * 10;
                c.lit(s, s, 2, x, 40, -110, [0xf97316, 0xfbbf24, 0xfde68a][r]);
                c.box(s + 4, s + 4, 2, x, 40, -108.5, 0x111827);
            }
            c.lit(5, 5, 5, x + 32, 66, -110, 0x4ade80);                    // power lamp
            c.plate(panelTex({
                w: 256, h: 96, bg: '#0b1018', accent: '#f97316', align: 'center',
                title: 'RIG ' + (i + 1), titleSize: 26,
                lines: ['~' + (180 + i * 27) + ' Nm'], lineSize: 18, padTop: 30
            }), 54, 20, x, 78, -108);
        }
        // tendon-drive bench: spools of cable and the tension tester
        for (let i = 0; i < 3; i++) {
            const x = -140 + i * 145;
            P.table(c, x, 40, 110, 56, 0x33404f, 28);
            for (let s = 0; s < 3; s++) P.barrel(c, x - 34 + s * 34, 30, [0x92400e, 0x475569, 0x92400e][s]);
            c.lit(40, 3, 20, x, 62, 40, 0xfbbf24);
        }
        conveyor(c, 150, 0, 400, 0xf97316);
        gantry(c, -60, 0xf97316, -80);
        c.plate(barsTex({
            w: 576, h: 320, accent: e.css, title: 'ACTUATOR YIELD', sub: 'lot 88',
            rows: [{ label: 'hip yaw', v: 0.94 }, { label: 'knee', v: 0.88 },
            { label: 'shoulder', v: 0.97 }, { label: 'wrist', v: 0.71, col: '#fbbf24' },
            { label: 'hand', v: 0.52, col: '#f87171' }]
        }), 230, 128, 20, 66, back(c));
        c.npc(c, -240, 120, { name: 'Motor Engineer', role: 'Drivetrain', color: 0xf97316 }, 1);
        c.npc(c, 210, 100, { name: 'Tendon Tech', role: 'Cable Drives', color: 0xd9c9a8 }, -1);
    },

    /** CHASSIS FABRICATION — welding cells behind fencing, sparks and jigs. */
    chassisfab(c, e) {
        for (let i = 0; i < 4; i++) {
            const x = -195 + i * 130;
            chassis(c, x, -150, i % 3, e.accent);
            armRobot(c, x + 44, -150, 1, 0xf97316, 46);
            // weld flash: a hot core with a cooler halo, so it reads at distance
            c.lit(10, 8, 10, x + 44, 34, -128, 0xffe9a8);
            c.lit(20, 4, 6, x + 44, 32, -126, 0xff8a2a);
        }
        cageWall(c, -30, -100, 460, 'x', 44, 0xfbbf24);
        hazardStrip(c, -84, 460, -30);
        conveyor(c, 20, 0, 420, 0xec4899);
        for (let i = 0; i < 5; i++) {
            c.box(30, 8, 22, -170 + i * 88, 26, 20, 0x8b93a1);              // frames in transit
            c.box(6, 20, 6, -170 + i * 88, 38, 20, 0x6b7280);
        }
        for (let i = 0; i < 3; i++) P.crate(c, -220 + i * 40, 170, 30, 0x3d2914);
        armRobot(c, 150, 130, -1, 0xec4899, 52);
        gantry(c, 90, 0xec4899, 60);
        c.plate(pipelineTex({
            w: 768, h: 224, accent: e.css, title: 'LINE STATUS', sub: 'shift 2',
            stages: [{ label: 'CUT', note: 'ok' }, { label: 'WELD', note: '412/hr' },
            { label: 'GRIND', note: 'ok' }, { label: 'PAINT', state: 'warn', note: 'queue 9' },
            { label: 'JIG', note: 'ok' }]
        }), 250, 74, -20, 74, back(c));
        c.plate(panelTex({
            w: 512, h: 224, bg: '#160a12', accent: '#fbbf24',
            title: 'EYE + EAR PROTECTION', titleSize: 28,
            lines: ['!arc flash hazard beyond this line', '~cell interlocks armed',
                '+last recordable: 214 days'], lineSize: 21
        }), 150, 66, c.W / 2 - c.WALL / 2 - 5, 56, 60, -Math.PI / 2);
        c.npc(c, -60, 160, { name: 'Line Lead', role: 'Chassis Fab', color: 0x3b82f6 }, -1);
        c.npc(c, 120, 180, { name: 'Welder', role: 'Cell 3', color: 0xe82127 }, -1);
    },

    /** WALK TEST — a gait chamber with tracking cameras and a treadmill. */
    walktest(c, e) {
        // instrumented treadmill, the room's centrepiece
        c.box(150, 18, 90, 0, 9, -60, 0x1e293b); c.solid(0, -60, 150, 90);
        for (let i = 0; i < 12; i++) c.box(140, 3, 5, 0, 19, -100 + i * 7, i % 2 ? 0x475569 : 0x3a4250);
        for (const sx of [-1, 1]) {
            c.box(7, 60, 7, sx * 82, 30, -60, 0x64748b);
            c.box(7, 7, 90, sx * 82, 58, -60, 0x64748b);
        }
        robot(c, 'apptronik', 0, -60, { y: 20, facing: 1, pose: 'stride', label: true });
        // motion-capture ring: cameras on masts all round the volume
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, cx = Math.cos(a) * 175, cz = -60 + Math.sin(a) * 130;
            c.box(8, 66, 8, cx, 33, cz, 0x2a3140);
            c.box(14, 10, 14, cx, 70, cz, 0x111827);
            c.lit(6, 5, 6, cx * 0.86, 70, cz * 0.9 - 6, 0xf43f5e);
        }
        // force plates set into the floor, and the analyst bench
        for (let i = 0; i < 4; i++) c.lit(48, 1.4, 48, -170 + i * 66, 1.2, 90, 0x22d3ee);
        P.table(c, 170, 110, 120, 56, 0x33404f, 28);
        for (let i = 0; i < 2; i++) P.screen(c, 140 + i * 60, 52, 86, 46, 28, [0x06b6d4, 0x4ade80][i], 2.4, 1);
        c.plate(chartTex({
            w: 640, h: 288, accent: e.css, title: 'GAIT TRACE', sub: 'unit 7710',
            series: [{ pts: [0.4, 0.72, 0.31, 0.78, 0.29, 0.81, 0.34, 0.76, 0.4], col: '#06b6d4' },
            { pts: [0.5, 0.44, 0.62, 0.41, 0.66, 0.38, 0.6, 0.45, 0.5], col: '#fbbf24', w: 2 }],
            legend: [{ label: 'CoM', col: '#06b6d4' }, { label: 'ZMP', col: '#fbbf24' }]
        }), 240, 108, -60, 64, back(c));
        c.npc(c, -190, 130, { name: 'Gait Analyst', role: 'Biomechanics', color: 0x06b6d4 }, -1);
        c.npc(c, 230, 40, { name: 'Test Engineer', role: 'Walk Test', color: 0x22d3ee }, 1);
    },

    /** OBSTACLE COURSE — ramps, hurdles, a finish gate, Atlas and an H1. */
    obstacle(c, e) {
        hazardStrip(c, 200, 460, 0, 0x06b6d4);
        P.stairs(c, -190, -160, 5, 9, 18, 90, 0x334155, 1);                // ramp up
        c.box(90, 45, 40, -190, 22, -58, 0x334155); c.solid(-190, -58, 90, 40);
        P.stairs(c, -190, -30, 5, 9, 18, 90, 0x3a4250, 1);                 // and down
        for (let i = 0; i < 4; i++) {                                       // hurdles
            const x = -60 + i * 80;
            for (const sx of [-1, 1]) c.box(5, 26, 5, x, 13, -120 + sx * 26, 0x475569);
            c.box(5, 5, 58, x, 27, -120, 0xfbbf24);
        }
        for (let i = 0; i < 6; i++) c.box(34, 12, 34, -40 + i * 56, 6, -20, i % 2 ? 0x3a4250 : 0x2a3140);  // stepping blocks
        c.box(28, 3, 220, 150, 24, 60, 0x475569);                           // balance beam
        for (const sz of [-1, 1]) c.box(8, 24, 8, 150, 12, 60 + sz * 100, 0x334155);
        // finish gate
        for (const sx of [-1, 1]) c.box(8, 70, 8, sx * 110, 35, 170, 0x2a3140);
        c.box(228, 8, 8, 0, 72, 170, 0x2a3140);
        c.lit(214, 3, 3, 0, 66, 170, 0x4ade80);
        robot(c, 'boston_dynamics', -110, 30, { facing: 1, pose: 'stride', label: true, scale: 1.05 });
        robot(c, 'unitree', 70, 110, { facing: -1, pose: 'reach', label: true });
        P.table(c, -220, 150, 90, 50, 0x33404f, 28);
        P.screen(c, -220, 52, 128, 44, 26, 0x06b6d4, 2.4, 1);
        c.plate(barsTex({
            w: 576, h: 288, accent: e.css, title: 'COURSE TIMES', sub: 'best of day',
            rows: [{ label: 'Atlas', v: 0.96, note: '41s' }, { label: 'H1', v: 0.82, note: '48s' },
            { label: 'Optimus V3', v: 0.7, note: '56s', col: '#fbbf24' },
            { label: 'Digit', v: 0.55, note: '71s', col: '#fbbf24' }]
        }), 220, 110, -40, 64, back(c));
        c.npc(c, 230, 190, { name: 'Course Designer', role: 'Obstacle Course', color: 0x06b6d4 }, -1);
        c.npc(c, -250, 60, { name: 'Choreographer', role: 'Kung-Fu Routines', color: 0x10b981 }, 1);
    },

    /** ENDURANCE — treadmill bank, battery swap station, hours-since board. */
    endurance(c, e) {
        for (let i = 0; i < 4; i++) {
            const x = -180 + i * 120;
            c.box(90, 14, 66, x, 7, -120, 0x1e293b); c.solid(x, -120, 90, 66);
            for (let b = 0; b < 8; b++) c.box(84, 2.5, 4, x, 15, -148 + b * 7.5, b % 2 ? 0x475569 : 0x3a4250);
            for (const sx of [-1, 1]) c.box(5, 44, 5, x + sx * 48, 22, -120, 0x64748b);
            c.box(5, 5, 66, x, 44, -120, 0x64748b);
            robot(c, ['agility', 'figure', 'tesla', 'apptronik'][i], x, -120,
                { y: 16, facing: 1, pose: 'stride', solid: false, scale: 0.94 });
            P.screen(c, x, 56, -160, 34, 20, 0x22d3ee, 2.2, 1);
        }
        // battery swap: charged packs racked, spent packs on the cart
        c.box(150, 84, 40, -180, 42, 120, 0x24303f); c.solid(-180, 120, 150, 40);
        for (let r = 0; r < 4; r++) for (let b = 0; b < 4; b++) {
            c.box(28, 14, 4, -232 + b * 35, 14 + r * 20, 141, 0x334155);
            c.lit(6, 8, 1, -218 + b * 35, 14 + r * 20, 143, (r + b) % 3 ? 0x4ade80 : 0xfbbf24);
        }
        c.box(70, 26, 46, -40, 13, 150, 0x475569); c.solid(-40, 150, 70, 46);
        for (let i = 0; i < 3; i++) c.box(24, 12, 34, -66 + i * 26, 32, 150, 0x334155);
        c.plate(metersTex({
            w: 576, h: 288, accent: e.css, title: 'ENDURANCE RUN', sub: 'hour 61',
            rows: [{ label: 'lane 1 · Digit', v: 0.91, cap: '61h' }, { label: 'lane 2 · Figure 03', v: 0.74, cap: '49h' },
            { label: 'lane 3 · Optimus', v: 0.44, cap: '29h' }, { label: 'lane 4 · Apollo', v: 0.12, cap: 'swap' }]
        }), 230, 114, 60, 64, back(c));
        c.plate(panelTex({
            w: 512, h: 192, bg: '#06121a', accent: e.css, align: 'center',
            title: 'DAYS WITHOUT A FALL', titleSize: 30,
            lines: ['~17'], lineSize: 44, padTop: 42
        }), 150, 56, 180, 58, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, 150, 150, { name: 'Endurance Lead', role: 'Duty Cycles', color: 0x06b6d4 }, -1);
        c.npc(c, -110, 178, { name: 'Battery Tech', role: 'Pack Swaps', color: 0x1d4ed8 }, -1);
    },

    /** LOADING BAY — roll-up doors, a truck backed in, pallets staged. */
    loading(c, e) {
        // three roll-up doors in the back wall, one of them open onto a trailer
        for (let i = 0; i < 3; i++) {
            const x = -160 + i * 160;
            c.box(130, 76, 12, x, 38, -c.D / 2 + 22, 0x2a3140);
            for (let s = 0; s < 8; s++) c.box(124, 7, 4, x, 8 + s * 9, -c.D / 2 + 28, s % 2 ? 0x3d4757 : 0x333e4c);
            c.lit(110, 3, 2, x, 80, -c.D / 2 + 28, i === 1 ? 0x4ade80 : 0xf43f5e);
            c.box(150, 6, 20, x, 86, -c.D / 2 + 34, 0x1f2937);              // door lintel
        }
        // the trailer that door 2 is loading into
        c.box(120, 70, 66, 0, 39, -c.D / 2 + 56, 0x1e293b); c.solid(0, -c.D / 2 + 56, 120, 66);
        c.lit(96, 34, 1.4, 0, 46, -c.D / 2 + 89, 0x10b981);
        c.box(126, 6, 70, 0, 6, -c.D / 2 + 56, 0x111827);
        // dock levellers and staged pallets
        for (let i = 0; i < 4; i++) {
            const x = -195 + i * 130;
            c.box(96, 5, 60, x, 2.5, -80, 0x3a4250);
            c.box(88, 10, 52, x, 10, -20, 0x78350f); c.solid(x, -20, 88, 52);
            for (let s = 0; s < 2; s++) c.box(74, 26, 44, x, 22 + s * 27, -20, 0xb9c2cc);   // shrink-wrapped stacks
            c.lit(66, 1.6, 38, x, 62, -20, 0x9fb6c9);
        }
        hazardStrip(c, 40, 460, 0, 0x10b981);
        // forklift parked by the office
        c.box(46, 30, 66, 200, 15, 120, 0xfbbf24); c.solid(200, 120, 46, 66);
        c.box(38, 26, 30, 200, 42, 134, 0x1f2937);
        c.box(8, 70, 8, 200, 35, 86, 0x64748b);
        for (const sx of [-1, 1]) c.box(6, 4, 30, 200 + sx * 12, 3, 74, 0x475569);
        c.plate(logTex({
            w: 640, h: 288, accent: e.css, bg: '#04120c',
            title: 'MANIFEST', sub: 'door 2',
            lines: ['+GXO · 24 Digit · loaded', '~Hyundai · 12 Atlas · staging',
                '!Fremont · 40 Optimus · customs hold', '+Home pilot · 6 NEO · sealed']
        }), 240, 108, 40, 64, c.D / 2 - c.WALL / 2 - 6, Math.PI);
        c.npc(c, -230, 100, { name: 'Dock Foreman', role: 'Loading Bay', color: 0x10b981 }, 1);
        c.npc(c, 100, 130, { name: 'GXO Liaison', role: 'Logistics', color: 0x14b8a6 }, -1);
    },

    /** PACKAGING — crating line, foam cutting, a robot being boxed. */
    packaging(c, e) {
        conveyor(c, -120, 0, 440, 0x10b981);
        for (let i = 0; i < 5; i++) {
            const x = -176 + i * 88;
            c.box(50, 44, 40, x, 44, -120, i < 2 ? 0xb9c2cc : 0x78350f);    // crates in progress
            if (i >= 2) c.lit(40, 2, 30, x, 67, -120, 0xfbbf24);
        }
        armRobot(c, -80, -60, -1, 0x10b981, 44);
        armRobot(c, 120, -60, -1, 0x10b981, 44);
        // foam cutting bench and the label printer
        P.table(c, -170, 40, 130, 64, 0x33404f, 28);
        for (let i = 0; i < 4; i++) c.box(26, 8, 40, -218 + i * 32, 34, 40, 0xe2e8f0);
        c.box(50, 40, 40, 40, 20, 40, 0x24303f); c.solid(40, 40, 50, 40);
        c.lit(34, 3, 26, 40, 42, 40, 0x4ade80);
        // one crate open with a NEO-style unit nested in foam
        c.box(80, 22, 62, 190, 11, 60, 0x78350f); c.solid(190, 60, 80, 62);
        c.box(70, 6, 52, 190, 24, 60, 0xe8dcc0);
        robot(c, 'figure', 190, 60, { y: 26, facing: -1, solid: false, scale: 0.72 });
        for (let i = 0; i < 6; i++) P.crate(c, -220 + (i % 3) * 40, 150 + Math.floor(i / 3) * 40, 32, 0x6b4423);
        c.plate(pipelineTex({
            w: 768, h: 224, accent: e.css, title: 'PACK LINE', sub: 'lot 812',
            stages: [{ label: 'CLEAN', note: 'ok' }, { label: 'FOAM', note: 'ok' },
            { label: 'CRATE', note: '61/hr' }, { label: 'SEAL', note: 'ok' },
            { label: 'LABEL', state: 'warn', note: 'ribbon low' }]
        }), 250, 74, 40, 74, back(c));
        c.npc(c, 100, 160, { name: 'Pack Lead', role: 'Crating', color: 0xd9c9a8 }, -1);
    },

    /** QA FINAL CHECK — inspection booths with pass/fail towers. */
    qa(c, e) {
        for (let i = 0; i < 4; i++) {
            const x = -195 + i * 130, pass = i !== 2;
            // booth: three walls and a lit floor pad, so you read it as a station
            c.box(110, 74, 10, x, 37, -160, 0x24303f); c.solid(x, -160, 110, 10);
            for (const sx of [-1, 1]) c.box(10, 74, 60, x + sx * 50, 37, -130, 0x24303f);
            c.lit(94, 1.5, 54, x, 1.4, -128, pass ? 0x14532d : 0x4c0519);
            robot(c, ['tesla', 'agility', 'unitree', 'apptronik'][i], x, -128,
                { facing: 1, solid: false, scale: 0.95 });
            // andon tower — the only thing you need to read from the lift
            c.box(12, 46, 12, x + 46, 23, -102, 0x1f2937);
            c.lit(11, 11, 11, x + 46, 40, -102, pass ? 0x4ade80 : 0x1a2e20);
            c.lit(11, 11, 11, x + 46, 28, -102, pass ? 0x2a2a12 : 0xfbbf24);
            c.lit(11, 11, 11, x + 46, 16, -102, pass ? 0x2a1218 : 0xf43f5e);
            c.plate(panelTex({
                w: 256, h: 96, bg: '#0b1018', accent: pass ? '#4ade80' : '#f43f5e', align: 'center',
                title: 'BOOTH ' + (i + 1), titleSize: 24,
                lines: [pass ? '+PASS' : '!HOLD'], lineSize: 22, padTop: 28
            }), 60, 22, x, 82, -155);
        }
        for (let i = 0; i < 3; i++) P.desk(c, -140 + i * 140, 20, 0x2a3140, 0x4ade80);
        P.cabinet(c, 230, 100, 60, 70, 32, 0x475569, 4);
        hazardStrip(c, 110, 420, -20, 0x4ade80);
        c.plate(barsTex({
            w: 576, h: 320, accent: e.css, title: 'FIRST-PASS YIELD', sub: 'week 31',
            rows: [{ label: 'gait', v: 0.97 }, { label: 'grip force', v: 0.93 },
            { label: 'thermals', v: 0.89 }, { label: 'audio', v: 0.99 },
            { label: 'hand dexterity', v: 0.61, col: '#f87171' }]
        }), 230, 128, 20, 66, back(c));
        c.npc(c, -240, 150, { name: 'QA Lead', role: 'Final Check', color: 0x4ade80 }, 1);
        c.npc(c, 140, 170, { name: 'Inspector', role: 'Holds & Rework', color: 0xf43f5e }, -1);
    },

    /** R&D BENCH LAB — morphology / actuators / sensor fusion share a shape,
     *  and differ by what is on the benches and the wall. */
    lab(c, e) {
        for (let i = 0; i < 4; i++) {
            const x = -195 + i * 130;
            P.table(c, x, -140, 118, 60, 0x33404f, 30);
            P.screen(c, x + 30, 56, -166, 42, 26, e.accent, 2.4, 1);
            // bench instrument: a microscope-ish column, or a test cell
            c.box(14, 26, 14, x - 34, 43, -140, 0x64748b);
            c.box(26, 6, 20, x - 34, 58, -140, 0x8b93a1);
            c.lit(10, 3, 10, x - 34, 33, -140, 0x22d3ee);
            P.chair(c, x, -80, 0x334155, -1);
        }
        // the specimen row down the middle: whatever this lab is pulling apart
        for (let i = 0; i < (e.specimens || []).length; i++) {
            const sp = e.specimens[i], x = -150 + i * 150;
            c.box(70, 26, 50, x, 13, -10, 0x2a3140); c.solid(x, -10, 70, 50);
            P.vitrine(c, x, -10, 60, 42, 40, sp.col || e.accent);
            c.plate(panelTex({
                w: 256, h: 96, bg: '#0a0f18', accent: e.css, align: 'center',
                title: sp.name, titleSize: 22, lines: ['~' + sp.note], lineSize: 16, padTop: 28
            }), 62, 22, x, 34, 16);
        }
        // whiteboard wall of sketches — R&D floors are argument, not output
        c.plate(panelTex({
            w: 640, h: 320, bg: '#f2f0ea', accent: e.css, grid: true, gridColor: 'rgba(90,90,110,0.16)',
            title: e.board || 'OPEN QUESTIONS', titleSize: 28, titleColor: '#241f2e', lineColor: '#33303c',
            lines: e.notes || [], lineSize: 21
        }), 190, 96, c.W / 2 - c.WALL / 2 - 5, 58, 40, -Math.PI / 2);
        c.plate(e.screen === 'meters'
            ? metersTex({ w: 576, h: 288, accent: e.css, title: e.title, sub: e.sub, rows: e.rows || [] })
            : barsTex({ w: 576, h: 288, accent: e.css, title: e.title, sub: e.sub, rows: e.rows || [] }),
            230, 114, -20, 64, back(c));
        P.plant(c, 235, 170, 54);
        for (const s of e.staff || []) c.npc(c, s.x, s.z, s, s.f || -1);
    },

    /** EMBODIED AI — sim pods, a milestone wall, and a live policy rollout. */
    embodied(c, e) {
        // four sim pods: a seated researcher, a screen, a caged robot mirroring
        for (let i = 0; i < 3; i++) {
            const x = -170 + i * 170;
            c.box(120, 8, 110, x, 4, -110, 0x1a1440); c.solid(x, -110, 120, 110);
            c.lit(104, 1.6, 94, x, 8.6, -110, 0x8b5cf6);
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                c.box(5, 66, 5, x + sx * 57, 41, -110 + sz * 52, 0x2a2450);
            }
            c.box(120, 5, 110, x, 76, -110, 0x2a2450);
            robot(c, ['figure', 'apptronik', 'unitree'][i], x, -110,
                { y: 9, facing: 1, pose: 'work', solid: false, scale: 0.95 });
            P.screen(c, x, 52, -50, 54, 32, 0x8b5cf6, 2.6, 1);
        }
        for (let i = 0; i < 3; i++) { P.desk(c, -170 + i * 170, 60, 0x241d52, 0xa855f7); }
        c.plate(panelTex({
            w: 640, h: 288, bg: '#0a1018', accent: '#8b5cf6',
            title: '★ EMBODIED AI — 2026', titleSize: 30,
            lines: ['~Helix VLA runs Figure 03 end to end', '+Apollo data trains Gemini Robotics',
                '~H1 fleet: autonomous routines on TV', '!sim-to-real gap: still the whole job'],
            lineSize: 21
        }), 240, 108, -20, 64, back(c));
        c.plate(chartTex({
            w: 576, h: 256, accent: '#a855f7', title: 'SIM → REAL', sub: 'success rate',
            series: [{ pts: [0.2, 0.31, 0.44, 0.52, 0.61, 0.69, 0.74, 0.79], col: '#a855f7' },
            { pts: [0.18, 0.24, 0.3, 0.33, 0.38, 0.41, 0.44, 0.46], col: '#22d3ee', w: 2 }],
            legend: [{ label: 'sim', col: '#a855f7' }, { label: 'real', col: '#22d3ee' }]
        }), 190, 84, c.W / 2 - c.WALL / 2 - 5, 58, 60, -Math.PI / 2);
        c.npc(c, -240, 150, { name: 'VLA Researcher', role: 'Embodied AI', color: 0x8b5cf6 }, 1);
        c.npc(c, 190, 170, { name: 'Gemini Liaison', role: 'Robotics Models', color: 0x22d3ee }, -1);
    },

    /** B1 · PARTS WAREHOUSE — aisles of racks, a forklift, pick lanes. */
    warehouse(c, e) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
            partsRack(c, -190 + i * 92, -150 + row * 110, 4, 88, 78);
        }
        hazardStrip(c, -40, 460, 0);
        // pick station and the forklift charging bay
        c.box(140, 34, 60, -150, 17, 60, 0x2a3140); c.solid(-150, 60, 140, 60);
        c.box(146, 4, 66, -150, 36, 60, 0x3d4757);
        for (let i = 0; i < 4; i++) c.box(28, 16, 24, -204 + i * 36, 46, 60, [0xec4899, 0x06b6d4, 0xfbbf24, 0x8b5cf6][i]);
        c.box(50, 32, 70, 190, 16, 60, 0xfbbf24); c.solid(190, 60, 50, 70);
        c.box(40, 28, 32, 190, 45, 76, 0x1f2937);
        c.box(9, 74, 9, 190, 37, 22, 0x64748b);
        c.lit(6, 6, 6, 190, 76, 60, 0xf97316);
        c.box(20, 40, 14, 240, 20, 60, 0x24303f); c.lit(12, 8, 2, 240, 34, 68, 0x4ade80);
        for (let i = 0; i < 5; i++) P.crate(c, -210 + i * 46, 170, 34, 0x4a3520);
        c.plate(logTex({
            w: 576, h: 288, accent: e.css, title: 'PICK QUEUE', sub: 'B1',
            lines: ['+aisle 2 · hip actuators · 40', '~aisle 4 · hand assemblies · 12',
                '!aisle 5 · torque sensors · backorder', '+aisle 1 · shells · 300']
        }), 220, 110, -20, 62, back(c));
        c.npc(c, 100, 150, { name: 'Stores Keeper', role: 'Parts Warehouse', color: 0xfbbf24 }, -1);
    },

    /** B1 · CRASH-TEST PIT — padded walls, a sled track, and the dummies. */
    crashpit(c, e) {
        // padded containment: quilted blocks up the walls
        for (let i = 0; i < 9; i++) for (let r = 0; r < 3; r++) {
            c.box(52, 26, 10, -232 + i * 58, 14 + r * 28, -c.D / 2 + 20, r % 2 ? 0x3f2a3a : 0x4a3244);
        }
        for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) for (let r = 0; r < 3; r++) {
            c.box(10, 26, 52, sx * (c.W / 2 - 20), 14 + r * 28, -160 + i * 62, r % 2 ? 0x3f2a3a : 0x4a3244);
        }
        // impact track: a rail with a sled and a crumpled target
        c.box(40, 8, 300, -60, 4, -20, 0x2a3140);
        c.lit(24, 1.6, 290, -60, 8.6, -20, 0xf43f5e);
        c.box(64, 34, 50, -60, 25, 90, 0x475569); c.solid(-60, 90, 64, 50);
        c.lit(52, 6, 6, -60, 44, 66, 0xfbbf24);
        c.box(80, 66, 26, -60, 33, -140, 0x24303f); c.solid(-60, -140, 80, 26);
        // dummies at various stages of being ruined — tipped ones lose the head
        robot(c, 'tesla', -60, -110, { facing: 1, solid: false, scale: 0.95 });
        for (let i = 0; i < 3; i++) {
            const x = 110 + (i % 2) * 70, z = -120 + i * 80;
            c.box(20, 8, 34, x, 4, z, 0xb6bcc4); c.solid(x, z, 24, 36);
            c.box(16, 7, 14, x, 11, z + 12, 0x8b93a1);
            for (const sx of [-1, 1]) c.box(5, 6, 22, x + sx * 11, 4, z - 6, 0x9aa2ac);
            c.lit(3, 3, 3, x, 12, z + 19, 0xf43f5e);
        }
        // high-speed camera rig and the review bench
        for (const sx of [-1, 1]) {
            c.box(9, 56, 9, sx * 150, 28, -40, 0x2a3140);
            c.box(18, 12, 26, sx * 150, 60, -40, 0x111827);
            c.lit(6, 5, 6, sx * 132, 60, -40, 0xf43f5e);
        }
        P.table(c, 170, 150, 120, 56, 0x33404f, 28);
        P.screen(c, 170, 52, 122, 46, 28, 0xf43f5e, 2.4, 1);
        c.plate(metersTex({
            w: 576, h: 288, accent: '#f43f5e', title: 'IMPACT LOG', sub: 'sled 12',
            rows: [{ label: 'peak g', v: 0.88, cap: '41 g' }, { label: 'shell integrity', v: 0.34 },
            { label: 'battery breach', v: 0.02, cap: 'none' }, { label: 'head detach', v: 1, cap: 'YES' }]
        }), 220, 110, 40, 62, back(c));
        c.npc(c, -220, 150, { name: 'Crash Engineer', role: 'Structural', color: 0xf43f5e }, 1);
    },

    /** B1 · SHIPPING DOCK — containers, a rail spur, cold concrete. */
    shipdock(c, e) {
        for (let i = 0; i < 3; i++) {
            const x = -170 + i * 170;
            c.box(150, 74, 76, x, 37, -140, [0x10b981, 0x1d4ed8, 0x92400e][i]); c.solid(x, -140, 150, 76);
            // corrugation: proud ribs in a darker shade of the container's paint
            for (let r = 0; r < 9; r++) c.box(6, 70, 78, x - 68 + r * 17, 37, -140, [0x0e7f61, 0x1a44b0, 0x7a3608][i]);
            c.lit(60, 3, 2, x, 62, -101, 0xe2e8f0);
        }
        c.box(c.W - 60, 6, 22, 0, 2, 0, 0x3a4250);                          // rail spur
        for (let i = 0; i < 16; i++) c.box(24, 4, 34, -240 + i * 32, 2, 0, 0x2a3140);
        for (const rz of [-9, 9]) c.lit(c.W - 80, 2, 4, 0, 5, rz, 0x94a3b8);
        for (let i = 0; i < 5; i++) {
            c.box(90, 12, 56, -180 + i * 92, 6, 90, 0x78350f); c.solid(-180 + i * 92, 90, 90, 56);
            c.box(76, 30, 46, -180 + i * 92, 27, 90, 0xb9c2cc);
        }
        c.box(60, 84, 60, 230, 42, 170, 0x24303f); c.solid(230, 170, 60, 60);
        c.lit(44, 30, 1.5, 230, 54, 200, 0x10b981);
        c.plate(cardsTex({
            w: 640, h: 288, accent: e.css, title: 'OUTBOUND', sub: 'B1 dock', perRow: 3,
            cards: [{ name: 'GXO', sub: 'Memphis', stat: '24 Digit' },
            { name: 'Hyundai', sub: 'Ulsan', stat: '12 Atlas', col: '#22d3ee' },
            { name: 'Fremont', sub: 'held', stat: 'customs', col: '#f87171' },
            { name: 'BMW', sub: 'Spartanburg', stat: '8 Figure' },
            { name: 'Amazon', sub: 'BFI4', stat: '30 Digit', col: '#22d3ee' },
            { name: 'Pilot', sub: 'homes', stat: '6 units' }]
        }), 240, 108, -20, 62, back(c));
        c.npc(c, 90, 170, { name: 'Yard Master', role: 'Shipping Dock', color: 0x10b981 }, -1);
    },

    /** B1 · PROTOTYPE GRAVEYARD — the honest floor. Everything that failed. */
    graveyard(c, e) {
        // dismantled units piled against the back wall, limbs on shelves
        for (let i = 0; i < 5; i++) {
            const x = -200 + i * 100;
            c.box(56, 18, 44, x, 9, -160, 0x475569); c.solid(x, -160, 56, 44);
            c.box(30, 14, 24, x - 6, 24, -160, 0x8b93a1);
            for (const sx of [-1, 1]) c.box(6, 8, 30, x + sx * 20, 22, -152, 0x9aa2ac);
            if (i % 2) c.box(16, 15, 14, x + 14, 38, -160, 0xb6bcc4);       // a head, still on
            c.lit(2.4, 30, 2.4, x + 24, 24, -140, [0xf43f5e, 0xfbbf24, 0x22d3ee][i % 3]);  // loose wiring
        }
        for (let i = 0; i < 3; i++) partsRack(c, -180 + i * 110, -60, 3, 66, 84);
        // the wall of shame, and the bench where somebody still tries
        c.plate(panelTex({
            w: 640, h: 320, bg: '#f2f0ea', accent: '#8b5cf6', grid: true, gridColor: 'rgba(90,90,110,0.16)',
            title: 'CAUSE OF DEATH', titleSize: 28, titleColor: '#241f2e', lineColor: '#33303c',
            lines: ['!v7 — knee actuator, 41 min MTBF', '!v9 — hands cost more than the robot',
                '~v11 — walked fine, could not stand up', '!v12 — battery fire (once)',
                '+v14 — shipped'], lineSize: 21
        }), 240, 118, -20, 62, back(c));
        P.table(c, 150, 80, 130, 60, 0x33404f, 30);
        armRobot(c, 220, 20, -1, 0x8b5cf6, 38);
        P.screen(c, 150, 56, 52, 48, 28, 0x8b5cf6, 2.4, 1);
        for (let i = 0; i < 6; i++) P.crate(c, -220 + (i % 3) * 42, 140 + Math.floor(i / 3) * 42, 30, 0x3d2914);
        P.rat(c, 60, 190, 1);                                               // the basement has tenants
        c.npc(c, -80, 150, { name: 'Salvage Tech', role: 'Prototype Graveyard', color: 0x64748b }, -1);
    }
};

// per-kind mood: [wall, ceil, floor, lamp]
const MOOD = {
    goods:      [0x1c2431, 0x0e141c, 0x2a3442, 0x9ff5c8],
    calibration:[0x241a24, 0x120c14, 0x30222e, 0xff9fb0],
    upload:     [0x1a1832, 0x0c0a1c, 0x272248, 0xc4b5fd],
    motor:      [0x2c2418, 0x171208, 0x3c3222, 0xffd9a0],
    chassisfab: [0x2a1c26, 0x140c12, 0x38283a, 0xffc0e0],
    walktest:   [0x14242c, 0x081218, 0x1e3440, 0xa5f3fc],
    obstacle:   [0x16262e, 0x0a141a, 0x203a44, 0xa5f3fc],
    endurance:  [0x142430, 0x08121a, 0x1e3442, 0x9fe8ff],
    loading:    [0x18281f, 0x0c1610, 0x243c30, 0xa7f3d0],
    packaging:  [0x1c2a22, 0x0e1812, 0x283e32, 0xbbf7d0],
    qa:         [0x1a2a24, 0x0c1614, 0x263c34, 0xbbf7d0],
    lab:        [0x22203a, 0x121026, 0x2e2c4c, 0xd8ccff],
    embodied:   [0x1e1a3e, 0x100c26, 0x2a2454, 0xc4b5fd],
    warehouse:  [0x232830, 0x12161c, 0x30363f, 0xffe0b0],
    crashpit:   [0x2a1a24, 0x140a10, 0x362430, 0xff9fb0],
    shipdock:   [0x1a2620, 0x0c1410, 0x263630, 0xa7f3d0],
    graveyard:  [0x22202c, 0x101018, 0x2e2c38, 0xc0b8e0]
};

const LAYOUTS = {
    robotics_assembly: {
        accent: 0xec4899, css: '#ec4899',
        floors: [
            { kind: 'goods', label: 'FINISHED GOODS BAY' },
            { kind: 'calibration', label: 'CALIBRATION STATION' },
            { kind: 'upload', label: 'AI BRAIN UPLOAD' },
            { kind: 'motor', label: 'MOTOR INTEGRATION' },
            { kind: 'chassisfab', label: 'CHASSIS FABRICATION' },
            { kind: 'warehouse', label: 'B1 · PARTS WAREHOUSE' }
        ]
    },
    robotics_testing: {
        accent: 0x06b6d4, css: '#06b6d4',
        floors: [
            { kind: 'endurance', label: 'ENDURANCE RUN' },
            { kind: 'obstacle', label: 'OBSTACLE COURSE' },
            { kind: 'walktest', label: 'WALK TEST CHAMBER' },
            { kind: 'crashpit', label: 'B1 · CRASH-TEST PIT' }
        ]
    },
    robotics_deploy: {
        accent: 0x10b981, css: '#10b981',
        floors: [
            { kind: 'loading', label: 'LOADING BAY' },
            { kind: 'packaging', label: 'PACKAGING' },
            { kind: 'qa', label: 'QA FINAL CHECK' },
            { kind: 'shipdock', label: 'B1 · SHIPPING DOCK' }
        ]
    },
    robotics_rd: {
        accent: 0x8b5cf6, css: '#8b5cf6',
        floors: [
            {
                kind: 'lab', label: 'MORPHOLOGY LAB',
                title: 'FORM FACTORS', sub: 'candidate set',
                specimens: [{ name: 'BIPED', note: 'stairs, doors, ladders', col: 0xec4899 },
                { name: 'WHEELED', note: 'flat floors only', col: 0x22d3ee },
                { name: 'QUADRUPED', note: 'no hands, no problems', col: 0xfbbf24 }],
                board: 'MORPHOLOGY',
                notes: ['~why humanoid? because the world is', '!hands are 40% of the BOM',
                    '~wheels win on flat, lose on stairs', '+two legs, five fingers, one argument'],
                rows: [{ label: 'biped', v: 0.82 }, { label: 'wheeled', v: 0.44, col: '#22d3ee' },
                { label: 'quadruped', v: 0.61, col: '#fbbf24' }, { label: 'centaur', v: 0.27, col: '#f87171' }],
                staff: [{ name: 'Apollo Designer', x: -230, z: 120, role: 'Morphology', color: 0xec4899, f: 1 },
                { name: 'Kinematics Eng', x: 120, z: 160, role: 'Linkages', color: 0xa855f7, f: -1 }]
            },
            {
                kind: 'lab', label: 'ACTUATOR R&D',
                title: 'TORQUE DENSITY', sub: 'Nm / kg', screen: 'meters',
                specimens: [{ name: 'HARMONIC', note: 'precise, expensive', col: 0xf97316 },
                { name: 'CYCLOIDAL', note: 'stiff, heavy', col: 0xfbbf24 },
                { name: 'TENDON', note: 'light, hard to tune', col: 0xd9c9a8 }],
                board: 'ACTUATORS',
                notes: ['~quasi-direct drive is winning', '!thermal limit before torque limit',
                    '+backdrivable = safe around people', '~gearbox noise is a product problem'],
                rows: [{ label: 'hip', v: 0.78 }, { label: 'knee', v: 0.84 },
                { label: 'shoulder', v: 0.62 }, { label: 'finger', v: 0.41 }],
                staff: [{ name: 'Actuator R&D', x: -220, z: 130, role: 'Drivetrain', color: 0xf97316, f: 1 },
                { name: 'Torque Eng', x: 100, z: 170, role: 'Test Cells', color: 0xfbbf24, f: -1 }]
            },
            {
                kind: 'lab', label: 'SENSOR FUSION',
                title: 'PERCEPTION STACK', sub: 'latency budget', screen: 'meters',
                specimens: [{ name: 'LIDAR', note: 'geometry, no colour', col: 0x22d3ee },
                { name: 'STEREO', note: 'cheap, sunlight hates it', col: 0x06b6d4 },
                { name: 'TACTILE', note: 'the underrated one', col: 0x4ade80 }],
                board: 'FUSION',
                notes: ['~cameras only, or cameras plus?', '!depth is a lie at 8 m',
                    '+tactile closes the grasp loop', '~calibration drifts every 40 hours'],
                rows: [{ label: 'capture', v: 0.18, cap: '7ms' }, { label: 'fusion', v: 0.42, cap: '16ms' },
                { label: 'policy', v: 0.66, cap: '26ms' }, { label: 'actuation', v: 0.24, cap: '9ms' }],
                staff: [{ name: 'Sensor Fusion', x: -230, z: 140, role: 'Perception', color: 0x22d3ee, f: 1 },
                { name: 'Lidar Eng', x: 130, z: 165, role: 'Depth', color: 0x06b6d4, f: -1 }]
            },
            { kind: 'embodied', label: 'EMBODIED AI' },
            { kind: 'graveyard', label: 'B1 · PROTOTYPE GRAVEYARD' }
        ]
    }
};

/** Build a registry spec from a floor list — same shape as agents.js, since
 *  `_floorsFor` reads the storey count straight off the spec. */
function makeSpec(id, L) {
    for (const e of L.floors) { e.accent = e.accent || L.accent; e.css = e.css || L.css; }
    return {
        id,
        theme(b, f, th) {
            const e = L.floors[Math.max(0, Math.min(L.floors.length - 1, f))];
            const m = MOOD[e.kind] || MOOD.goods;
            th.cat = 'robotics'; th.dim = true;
            th.wall = m[0]; th.ceil = m[1]; th.floor = m[2]; th.lamp = m[3];
            th.accent = e.css;
        },
        floors: L.floors.map((e) => ({
            key: e.kind,
            label: e.label,
            build: (c) => KIND[e.kind](c, e)
        }))
    };
}

export const ROBOTICS_ROOMS = {};
for (const id of Object.keys(LAYOUTS)) ROBOTICS_ROOMS[id] = makeSpec(id, LAYOUTS[id]);

/** Any other robotics_* building borrows the Assembly Line's stack. */
export function roboticsRoom(b) {
    return ROBOTICS_ROOMS[b?.id] || ROBOTICS_ROOMS.robotics_assembly;
}
