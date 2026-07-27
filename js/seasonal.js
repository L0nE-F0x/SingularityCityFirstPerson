/* ══════════════════════════════════════════════════════════════════════════
   SEASONAL FESTIVALS — the real global holiday calendar, in 3D.

   This used to be a map of twelve month names ("Summer Compute", "Autumn
   Weights") and six coloured orbs spinning near the monument. The 2D city runs
   an actual calendar: 7 global holidays plus 12 regional ones filtered by the
   player's timezone, with variable-date festivals (Easter, Lunar New Year, and
   the whole lunar/lunisolar set) resolved from year tables, and each one draws
   its own thing in the world.

   Split in two on purpose:
     · a PURE calendar layer (FESTIVALS / REGIONAL / resolveFestivals /
       activeFestivals) that runs without a scene and is testable in node;
     · a decor layer that builds geometry only for whatever is actually
       running today, so the usual cost is zero.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { City } from './city.js';

/* ─── ambient month tone ───────────────────────────────────────────────────
   Kept from the original: when no festival is running the city still wants a
   seasonal accent colour, and the HUD still wants something to say. */
export const SEASONS = {
    0:  { id: 'new_year',    label: 'New Year Lights',    color: 0xfbbf24 },
    1:  { id: 'valentine',   label: 'Open-Source Hearts', color: 0xf472b6 },
    2:  { id: 'spring',      label: 'Spring Deploy',      color: 0x4ade80 },
    3:  { id: 'spring',      label: 'Spring Deploy',      color: 0x4ade80 },
    4:  { id: 'iclr_season', label: 'ICLR Season',        color: 0x4ade80 },
    5:  { id: 'summer',      label: 'Summer Compute',     color: 0xfbbf24 },
    6:  { id: 'summer',      label: 'Summer Compute',     color: 0x3b82f6 },
    7:  { id: 'back_school', label: 'Back to Pretrain',   color: 0xa78bfa },
    8:  { id: 'autumn',      label: 'Autumn Weights',     color: 0xf97316 },
    9:  { id: 'autumn',      label: 'Autumn Weights',     color: 0xf97316 },
    10: { id: 'neurips_eve', label: 'NeurIPS Eve',        color: 0xf43f5e },
    11: { id: 'holiday',     label: 'Holiday Tokens',     color: 0x22d3ee }
};
export function seasonForDate(d = new Date()) {
    return SEASONS[d.getMonth()] || SEASONS[0];
}

/* ─── timezone → cultural region ───────────────────────────────────────────
   Regional festivals only show for players who'd actually celebrate them;
   everyone sees the global set. */
const TZ_REGIONS = {
    east_asia:      ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Macau', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Seoul'],
    japan:          ['Asia/Tokyo'],
    south_asia:     ['Asia/Kolkata', 'Asia/Calcutta', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Karachi'],
    southeast_asia: ['Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Manila', 'Asia/Ho_Chi_Minh', 'Asia/Phnom_Penh', 'Asia/Yangon'],
    indonesia:      ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak'],
    middle_east:    ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Bahrain', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Baghdad', 'Asia/Tehran', 'Asia/Amman', 'Asia/Beirut', 'Asia/Jerusalem', 'Africa/Cairo'],
    jewish:         ['Asia/Jerusalem', 'Asia/Tel_Aviv'],
    latin_america:  ['America/Mexico_City', 'America/Cancun', 'America/Monterrey', 'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/Caracas', 'America/Guatemala', 'America/Havana', 'America/La_Paz', 'America/Panama'],
    thailand:       ['Asia/Bangkok']
};

/* `decor` names the world dressing each festival gets — see _buildDecor. */
export const FESTIVALS = [
    { id: 'winter_holiday', name: 'Winter Holidays',  icon: '🎄', color: 0x2ecc71, sm: 12, sd: 15, em: 1,  ed: 2,  decor: ['fairylights', 'tree'],
      chat: ['Happy holidays!', 'Who wants hot cocoa? ☕', 'Best time of year 🎅', 'Secret Santa time!', 'New year, new weights!'] },
    { id: 'halloween',      name: 'Halloween',        icon: '🎃', color: 0xf97316, sm: 10, sd: 25, em: 10, ed: 31, decor: ['pumpkins'],
      chat: ['Trick or treat! 🍬', 'Boo! Scared ya!', 'Spooky vibes 👻', 'My loss function is TERRIFYING', 'Who\'s that ghost model?'] },
    { id: 'cherry_blossom', name: 'Cherry Blossom',   icon: '🌸', color: 0xf9a8d4, sm: 4,  sd: 1,  em: 4,  ed: 30, decor: ['blossom'],
      chat: ['The blossoms are beautiful!', 'Spring training season 🌱', 'Hanami picnic anyone?', 'New season, new parameters'] },
    { id: 'new_year',       name: 'New Year',         icon: '🎆', color: 0xfbbf24, sm: 12, sd: 31, em: 1,  ed: 1,  decor: ['fireworks', 'fairylights'],
      chat: ['Happy New Year! 🎉', '3... 2... 1... LAUNCH!', 'New year, new benchmarks!', 'What a year for AI!'] },
    { id: 'july_4',         name: 'Independence Day', icon: '🎇', color: 0x3b82f6, sm: 7,  sd: 4,  em: 7,  ed: 4,  decor: ['fireworks'],
      chat: ['Happy 4th! 🇺🇸', 'Fireworks time!', 'Freedom to compute!', 'Stars and stripes and GPUs'] },
    // variable — resolved by resolveFestivals()
    { id: 'easter',         name: 'Easter',           icon: '🐣', color: 0xa7f3d0, sm: 0, sd: 0, em: 0, ed: 0, decor: ['eggs'],
      chat: ['Happy Easter! 🐰', 'Found an Easter egg!', 'Egg hunt in Pine Reserve!', 'Chocolate inference 🍫'] },
    { id: 'lunar_new_year', name: 'Lunar New Year',   icon: '🧧', color: 0xef4444, sm: 0, sd: 0, em: 0, ed: 0, decor: ['lanterns'],
      chat: ['Happy Lunar New Year! 🐉', 'Gong xi fa cai!', 'Red envelopes for everyone!', 'Year of the AI 🧧'] }
];

export const REGIONAL = [
    { id: 'diwali',     name: 'Diwali',              icon: '🪔', color: 0xfbbf24, regions: ['south_asia', 'southeast_asia'], decor: ['diyas', 'fireworks'],
      chat: ['Happy Diwali! 🪔', 'Festival of lights!', 'Diyas everywhere!', 'Rangoli in the lobby!'] },
    { id: 'holi',       name: 'Holi',                icon: '🎨', color: 0xe879f9, regions: ['south_asia'], decor: ['colourburst'],
      chat: ['Happy Holi! 🎨', 'Holi hai!!', 'My GPU is rainbow now!', 'Color powder everywhere!'] },
    { id: 'nyepi',      name: 'Nyepi',               icon: '🕯️', color: 0x64748b, regions: ['indonesia'], decor: ['blackout', 'ogoh'],
      chat: ['Selamat Hari Raya Nyepi', 'Day of Silence...', 'No lights tonight 🕯️', 'The island sleeps tonight'] },
    { id: 'galungan',   name: 'Galungan & Kuningan', icon: '🎋', color: 0xfacc15, regions: ['indonesia'], decor: ['penjor'],
      chat: ['Rahajeng Galungan!', 'The penjor are beautiful 🎋', 'Offerings everywhere', 'Temple ceremony time'] },
    { id: 'ramadan',    name: 'Ramadan',             icon: '🌙', color: 0x818cf8, regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'], decor: ['lanterns'],
      chat: ['Ramadan Mubarak! 🌙', 'Iftar time!', 'Blessed month', 'The crescent moon is here'] },
    { id: 'eid_fitr',   name: 'Eid al-Fitr',         icon: '🕌', color: 0x34d399, regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'], decor: ['lanterns', 'fireworks'],
      chat: ['Eid Mubarak! 🕌', 'Selamat Hari Raya!', 'Celebration after fasting!', 'Sweets and joy!'] },
    { id: 'eid_adha',   name: 'Eid al-Adha',         icon: '🐑', color: 0x34d399, regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'], decor: ['lanterns'],
      chat: ['Eid al-Adha Mubarak! 🐑', 'Festival of sacrifice', 'Blessed celebration'] },
    { id: 'mid_autumn', name: 'Mid-Autumn Festival', icon: '🥮', color: 0xfcd34d, regions: ['east_asia', 'southeast_asia'], decor: ['lanterns'],
      chat: ['Happy Mid-Autumn! 🥮', 'Moon cake time!', 'The moon is so full tonight!', 'Lanterns in the park!'] },
    { id: 'obon',       name: 'Obon',                icon: '🏮', color: 0xfb923c, regions: ['japan'], sm: 8, sd: 13, em: 8, ed: 16, decor: ['lanterns'],
      chat: ['Obon matsuri! 🏮', 'Bon Odori tonight!', 'Paper lanterns on the river', 'Time to remember'] },
    { id: 'songkran',   name: 'Songkran',            icon: '💦', color: 0x38bdf8, regions: ['thailand', 'southeast_asia'], sm: 4, sd: 13, em: 4, ed: 15, decor: ['water'],
      chat: ['Sawasdee Pi Mai! 💦', 'Water fight!!', 'Happy Songkran!', 'Stay cool!'] },
    { id: 'dia_muertos', name: 'Día de los Muertos', icon: '💀', color: 0xf59e0b, regions: ['latin_america'], sm: 11, sd: 1, em: 11, ed: 2, decor: ['ofrenda'],
      chat: ['Feliz Día de los Muertos! 💀', 'Marigolds everywhere!', 'Ofrendas for the departed', 'Remember those we love'] },
    { id: 'hanukkah',   name: 'Hanukkah',            icon: '🕎', color: 0x60a5fa, regions: ['jewish', 'middle_east'], decor: ['menorah'],
      chat: ['Happy Hanukkah! 🕎', 'Light the menorah!', 'Eight crazy nights!', 'Festival of lights!'] }
];

/* Lunar and lunisolar festivals don't sit still: Islamic dates walk ~11 days a
   year, the Hindu and Balinese calendars are lunisolar. Tables beat trying to
   implement four calendar systems; outside the covered years the festival
   simply doesn't fire, which is the honest failure mode. [month, day] */
const DATE_TABLES = {
    diwali:     { 2025: [10, 20], 2026: [11, 8],  2027: [10, 29], 2028: [10, 17], 2029: [11, 5],  2030: [10, 26], 2031: [10, 16], 2032: [11, 2] },
    holi:       { 2025: [3, 14],  2026: [3, 3],   2027: [3, 22],  2028: [3, 11],  2029: [3, 1],   2030: [3, 20],  2031: [3, 10],  2032: [2, 27] },
    nyepi:      { 2025: [3, 29],  2026: [3, 19],  2027: [3, 8],   2028: [3, 26],  2029: [3, 15],  2030: [3, 5],   2031: [3, 24],  2032: [3, 12] },
    galungan:   { 2025: [2, 26],  2026: [9, 23],  2027: [4, 21],  2028: [11, 15], 2029: [6, 13],  2030: [1, 8],   2031: [8, 6],   2032: [3, 4] },
    ramadan:    { 2025: [3, 1],   2026: [2, 18],  2027: [2, 8],   2028: [1, 28],  2029: [1, 16],  2030: [1, 6],   2031: [12, 26], 2032: [12, 15] },
    eid_fitr:   { 2025: [3, 30],  2026: [3, 20],  2027: [3, 10],  2028: [2, 27],  2029: [2, 14],  2030: [2, 4],   2031: [1, 25],  2032: [1, 14] },
    eid_adha:   { 2025: [6, 7],   2026: [5, 27],  2027: [5, 16],  2028: [5, 5],   2029: [4, 24],  2030: [4, 13],  2031: [4, 3],   2032: [3, 22] },
    mid_autumn: { 2025: [10, 6],  2026: [9, 25],  2027: [9, 15],  2028: [10, 3],  2029: [9, 22],  2030: [9, 12],  2031: [10, 1],  2032: [9, 19] },
    hanukkah:   { 2025: [12, 14], 2026: [12, 4],  2027: [12, 24], 2028: [12, 12], 2029: [12, 1],  2030: [12, 21], 2031: [12, 10], 2032: [11, 28] }
};
const DURATIONS = { diwali: 5, holi: 2, nyepi: 3, galungan: 10, ramadan: 30, eid_fitr: 3, eid_adha: 3, mid_autumn: 3, hanukkah: 8 };
const LNY = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11] };

/** Anonymous Gregorian computus — Easter Sunday for a given year. */
export function easterFor(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

/** Fill in every variable date for `year`. Pure: returns a new array. */
export function resolveFestivals(year) {
    const out = [...FESTIVALS, ...REGIONAL].map(f => ({ ...f }));
    const span = (f, m, d, days) => {
        const start = new Date(year, m - 1, d);
        const end = new Date(start.getTime() + (days - 1) * 86400000);
        f.sm = m; f.sd = d;
        f.em = end.getMonth() + 1; f.ed = end.getDate();
    };
    for (const f of out) {
        if (f.id === 'easter') {
            const e = easterFor(year);
            span(f, e.month, Math.max(1, e.day - 1), 3);       // Sat → Mon
        } else if (f.id === 'lunar_new_year') {
            const t = LNY[year];
            if (t) span(f, t[0], t[1], 3); else f.sm = 0;
        } else if (DATE_TABLES[f.id]) {
            const t = DATE_TABLES[f.id][year];
            if (t) span(f, t[0], t[1], DURATIONS[f.id] || 3); else f.sm = 0;
        }
    }
    return out;
}

/** Inclusive date-in-range that copes with a window wrapping the new year. */
function inRange(m, d, sm, sd, em, ed) {
    if (!sm) return false;
    const at = m * 100 + d, from = sm * 100 + sd, to = em * 100 + ed;
    return from <= to ? (at >= from && at <= to) : (at >= from || at <= to);
}

/** Everything running on `date` for a player in `regions`. Pure. */
export function activeFestivals(date = new Date(), regions = []) {
    const m = date.getMonth() + 1, d = date.getDate();
    return resolveFestivals(date.getFullYear()).filter(f => {
        if (!inRange(m, d, f.sm, f.sd, f.em, f.ed)) return false;
        if (!f.regions) return true;
        return f.regions.some(r => regions.includes(r));
    });
}

export function detectRegions() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        return Object.entries(TZ_REGIONS).filter(([, zs]) => zs.includes(tz)).map(([r]) => r);
    } catch (e) {
        return [];
    }
}

// ── decoration helpers ───────────────────────────────────────────────────────
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const Seasonal = {
    season: null,
    active: [],
    regions: [],
    label: '',
    _objs: [],
    _twinkles: [],
    _shells: [],
    _sparks: null,

    init(scene) {
        this.scene = scene;
        const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

        // ?festival=<id> forces one on; ?month=<0-11> keeps the old month probe
        this.regions = detectRegions();
        const forced = params.get('festival');
        const m = params.get('month');
        const when = m != null ? new Date(2026, parseInt(m, 10), 15) : new Date();
        this.season = seasonForDate(when);

        if (forced) {
            const all = resolveFestivals(when.getFullYear());
            this.active = all.filter(f => f.id === forced);
        } else {
            // Force-list every region when testing so regional decor is reachable
            const regions = params.get('allregions') === '1' ? Object.keys(TZ_REGIONS) : this.regions;
            this.active = activeFestivals(when, regions);
        }

        this.label = this.active.length
            ? this.active.map(f => f.icon + ' ' + f.name).join(' · ')
            : this.season.label;

        const kinds = new Set();
        for (const f of this.active) for (const k of (f.decor || [])) kinds.add(k);
        for (const k of kinds) this._buildDecor(k, scene);

        // Nothing running: keep a quiet accent so the monument isn't bare.
        if (!this.active.length) this._buildAmbientOrbs(scene);
    },

    _add(obj, scene) { obj.userData.seasonal = true; scene.add(obj); this._objs.push(obj); },

    /** Remember a lamp mesh's authored colour so flicker can modulate it. */
    _registerTwinkle(mesh) {
        this._twinkles.push({ mesh, base: mesh.material.color.clone(), phase: this._twinkles.length * 1.7 });
    },

    /** Every festival's world dressing. Only the active ones are ever built. */
    _buildDecor(kind, scene) {
        const rng = mulberry32(4242);
        const col = new THREE.Color(this.active[0]?.color ?? 0xfbbf24);
        const D = new THREE.Object3D();

        const monument = G.bldById?.['visitor_monument'] || G.bldById?.['park'];
        const mx = monument?.worldX ?? 0, mz = monument?.worldZ ?? 0;

        switch (kind) {
            case 'fairylights':
            case 'lanterns':
            case 'diyas': {
                /* One instanced emissive bulb serves fairy lights, paper
                   lanterns and diya lamps — the difference is where they hang
                   and how big they are, not what they are. */
                const isDiya = kind === 'diyas';
                const isLantern = kind === 'lanterns';
                const geo = isDiya
                    ? new THREE.CylinderGeometry(3.4, 2.6, 2.6, 8)
                    : new THREE.SphereGeometry(isLantern ? 5.5 : 2.4, 8, 6);
                const hue = isDiya ? 0xffb648 : (isLantern ? 0xff5a4a : 0xfff0c0);
                const spots = [];
                for (const ax of City.avenueXs) {
                    for (let z = -CITY_D / 2 + 90; z < CITY_D / 2; z += isDiya ? 60 : 110) {
                        spots.push({ x: ax + 79, y: isDiya ? 4 : (isLantern ? 62 : 74), z });
                        spots.push({ x: ax - 79, y: isDiya ? 4 : (isLantern ? 62 : 74), z: z + 30 });
                    }
                }
                const im = new THREE.InstancedMesh(geo,
                    new THREE.MeshBasicMaterial({ color: hue, toneMapped: false }), spots.length);
                spots.forEach((s, i) => {
                    D.position.set(s.x, s.y, s.z); D.scale.setScalar(0.85 + rng() * 0.5);
                    D.updateMatrix(); im.setMatrixAt(i, D.matrix);
                });
                im.instanceMatrix.needsUpdate = true;
                im.userData.noShadow = true;
                this._add(im, scene);
                this._registerTwinkle(im);
                break;
            }
            case 'tree': {
                const parts = [];
                const paint = (g, hex) => {
                    const c = new THREE.Color(hex), n = g.attributes.position.count;
                    const a = new Float32Array(n * 3);
                    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
                    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
                    return g;
                };
                parts.push(paint(new THREE.CylinderGeometry(6, 8, 22, 8).translate(mx, 11, mz), 0x4a3524));
                for (let i = 0; i < 4; i++) {
                    const r = 46 - i * 10, h = 34;
                    parts.push(paint(new THREE.ConeGeometry(r, h, 12).translate(mx, 26 + i * 26, mz), 0x1f6b34));
                }
                const tree = new THREE.Mesh(mergeGeometries(parts, false),
                    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
                this._add(tree, scene);
                const star = new THREE.Mesh(new THREE.OctahedronGeometry(9),
                    new THREE.MeshBasicMaterial({ color: 0xffe680, toneMapped: false }));
                star.position.set(mx, 26 + 3 * 26 + 24, mz);
                this._add(star, scene);
                this._star = star;
                break;
            }
            case 'pumpkins': {
                const geo = mergeGeometries([
                    new THREE.SphereGeometry(7, 10, 7).scale(1, 0.82, 1),
                    new THREE.CylinderGeometry(1.2, 1.6, 4, 5).translate(0, 7, 0)
                ], false);
                const spots = [];
                for (const ax of City.avenueXs) {
                    for (let z = -CITY_D / 2 + 140; z < CITY_D / 2; z += 190) {
                        spots.push({ x: ax + (rng() < 0.5 ? 82 : -82), z: z + rng() * 60 });
                    }
                }
                const im = new THREE.InstancedMesh(geo,
                    new THREE.MeshStandardMaterial({
                        color: 0xe07b1e, emissive: new THREE.Color(0xff6a00),
                        emissiveIntensity: 0.55, roughness: 0.7
                    }), spots.length);
                spots.forEach((s, i) => {
                    D.position.set(s.x, 8, s.z); D.rotation.set(0, rng() * Math.PI, 0);
                    D.scale.setScalar(0.8 + rng() * 0.6); D.updateMatrix(); im.setMatrixAt(i, D.matrix);
                });
                im.instanceMatrix.needsUpdate = true;
                this._add(im, scene);
                break;
            }
            case 'penjor': {
                /* Balinese penjor: a tall bamboo pole bowing over the street.
                   A curved arc of segments reads as the bow far better than a
                   straight pole with a flag on it. */
                const parts = [];
                for (const ax of City.avenueXs) {
                    for (let z = -CITY_D / 2 + 200; z < CITY_D / 2; z += 340) {
                        const bx = ax + 84;
                        for (let s = 0; s < 12; s++) {
                            const t = s / 11;
                            const y = 12 + t * 120;
                            const bend = Math.pow(t, 2.4) * 62;
                            const g = new THREE.BoxGeometry(3.2, 12, 3.2);
                            g.rotateZ(-Math.pow(t, 1.6) * 0.8);
                            g.translate(bx - bend, y, z);
                            parts.push(g);
                        }
                    }
                }
                if (parts.length) {
                    const m = new THREE.Mesh(mergeGeometries(parts, false),
                        new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.75 }));
                    this._add(m, scene);
                }
                break;
            }
            case 'ofrenda': {
                const gy = G.bldById?.['graveyard'];
                const ox = gy?.worldX ?? mx, oz = gy?.worldZ ?? mz;
                const parts = [];
                const paint = (g, hex) => {
                    const c = new THREE.Color(hex), n = g.attributes.position.count;
                    const a = new Float32Array(n * 3);
                    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
                    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
                    return g;
                };
                for (let tier = 0; tier < 3; tier++) {
                    const w = 90 - tier * 22;
                    parts.push(paint(new THREE.BoxGeometry(w, 10, w * 0.5).translate(ox, 5 + tier * 12, oz), 0x7c2d5a));
                }
                // marigold path
                for (let i = 0; i < 60; i++) {
                    const a = rng() * Math.PI * 2, r = 50 + rng() * 90;
                    parts.push(paint(new THREE.SphereGeometry(2.6, 5, 4)
                        .translate(ox + Math.cos(a) * r, 2, oz + Math.sin(a) * r), 0xf59e0b));
                }
                const m = new THREE.Mesh(mergeGeometries(parts, false),
                    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
                this._add(m, scene);
                break;
            }
            case 'menorah': {
                const parts = [];
                parts.push(new THREE.BoxGeometry(70, 5, 8).translate(mx, 40, mz));
                parts.push(new THREE.CylinderGeometry(4, 8, 40, 8).translate(mx, 20, mz));
                const flames = [];
                for (let i = 0; i < 9; i++) {
                    const bx = mx - 32 + i * 8;
                    parts.push(new THREE.CylinderGeometry(1.6, 1.6, 16, 6).translate(bx, 50, mz));
                    flames.push({ x: bx, y: 60, z: mz });
                }
                const body = new THREE.Mesh(mergeGeometries(parts, false),
                    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }));
                this._add(body, scene);
                const fg = new THREE.SphereGeometry(2.4, 6, 5);
                const fi = new THREE.InstancedMesh(fg,
                    new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), flames.length);
                flames.forEach((f, i) => { D.position.set(f.x, f.y, f.z); D.scale.setScalar(1); D.updateMatrix(); fi.setMatrixAt(i, D.matrix); });
                fi.instanceMatrix.needsUpdate = true;
                this._add(fi, scene);
                this._registerTwinkle(fi);
                break;
            }
            case 'ogoh': {
                // Ogoh-ogoh effigy paraded before Nyepi — a hulking figure on a plinth
                const parts = [];
                parts.push(new THREE.BoxGeometry(70, 8, 70).translate(mx, 4, mz));
                parts.push(new THREE.BoxGeometry(34, 44, 24).translate(mx, 32, mz));
                parts.push(new THREE.SphereGeometry(16, 10, 8).translate(mx, 66, mz));
                for (const s of [-1, 1]) {
                    parts.push(new THREE.BoxGeometry(9, 40, 9).translate(mx + s * 26, 40, mz));
                    parts.push(new THREE.ConeGeometry(6, 18, 6).translate(mx + s * 10, 82, mz));
                }
                const m = new THREE.Mesh(mergeGeometries(parts, false),
                    new THREE.MeshStandardMaterial({ color: 0x9b2c2c, roughness: 0.75 }));
                this._add(m, scene);
                break;
            }
            case 'eggs': {
                const geo = new THREE.SphereGeometry(4.5, 8, 7).scale(1, 1.3, 1);
                const spots = [];
                for (const d of City.districts) {
                    if (!['park', 'forest', 'suburban', 'academic'].includes(d.biome)) continue;
                    for (let i = 0; i < 26; i++) {
                        spots.push({ x: d.cx + (rng() - 0.5) * 620, z: d.cz + (rng() - 0.5) * 620, h: rng() });
                    }
                }
                if (!spots.length) break;
                const im = new THREE.InstancedMesh(geo,
                    new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.5 }), spots.length);
                const c = new THREE.Color();
                spots.forEach((s, i) => {
                    D.position.set(s.x, 5, s.z); D.rotation.set(0, rng() * 3.14, 0.2);
                    D.scale.setScalar(1); D.updateMatrix(); im.setMatrixAt(i, D.matrix);
                    im.setColorAt(i, c.setHSL(s.h, 0.75, 0.68));
                });
                im.instanceMatrix.needsUpdate = true;
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
                this._add(im, scene);
                break;
            }
            case 'blossom':
                // Weather already owns falling petals — just ask for that state.
                G.weatherSys?.set?.('cherry');
                break;
            case 'blackout':
                // Nyepi is the day of silence: the city goes dark.
                this.blackout = true;
                break;
            case 'fireworks':
            case 'colourburst':
            case 'water':
                this._initSparks(kind, scene, col);
                break;
        }
    },

    /* Fireworks, Holi powder and Songkran water are the same system: bursts of
       coloured points with different launch behaviour and gravity. */
    _initSparks(kind, scene, baseCol) {
        const N = kind === 'fireworks' ? 900 : 520;
        this._sparkKind = kind;
        this._shells = [];
        const pos = new Float32Array(N * 3);
        const colr = new Float32Array(N * 3);
        const alpha = new Float32Array(N);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const cx = c.getContext('2d');
        const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = g; cx.fillRect(0, 0, 32, 32);
        const map = new THREE.CanvasTexture(c);
        map.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.ShaderMaterial({
            uniforms: { map: { value: map }, uSize: { value: kind === 'water' ? 9 : 16 } },
            vertexShader: `attribute float aAlpha; uniform float uSize; varying vec3 vC; varying float vA;
                void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
                gl_PointSize=uSize*(420.0/max(40.0,-mv.z))*6.0; gl_Position=projectionMatrix*mv; }`,
            fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
                void main(){ float a=texture2D(map,gl_PointCoord).a*vA; if(a<0.01) discard;
                gl_FragColor=vec4(vC,a); }`,
            transparent: true, depthWrite: false, vertexColors: true,
            blending: kind === 'water' ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false
        });
        this._sparks = new THREE.Points(geo, mat);
        this._sparks.frustumCulled = false;
        this._sparks.name = 'seasonalSparks';
        this._add(this._sparks, scene);
        this._sparkData = { pos, colr, alpha, N, geo, next: 0, timer: 0, base: baseCol };
    },

    _launchBurst() {
        const S = this._sparkData;
        if (!S) return;
        const kind = this._sparkKind;
        const rng = Math.random;
        const per = kind === 'fireworks' ? 90 : 60;
        // fireworks pop over the skyline; powder and water happen at head height
        const ox = (rng() - 0.5) * CITY_W * 0.8;
        const oz = (rng() - 0.5) * CITY_D * 0.8;
        const oy = kind === 'fireworks' ? 420 + rng() * 320 : 18 + rng() * 26;
        const hue = kind === 'water' ? 0.55 : rng();
        const c = new THREE.Color();
        for (let k = 0; k < per; k++) {
            const i = S.next; S.next = (S.next + 1) % S.N;
            const th = rng() * Math.PI * 2, ph = Math.acos(2 * rng() - 1);
            const sp = kind === 'fireworks' ? 60 + rng() * 90 : 22 + rng() * 30;
            S.pos[i * 3] = ox; S.pos[i * 3 + 1] = oy; S.pos[i * 3 + 2] = oz;
            c.setHSL(kind === 'water' ? 0.55 : (hue + rng() * 0.12) % 1,
                kind === 'water' ? 0.5 : 0.95, kind === 'water' ? 0.75 : 0.62);
            S.colr[i * 3] = c.r; S.colr[i * 3 + 1] = c.g; S.colr[i * 3 + 2] = c.b;
            S.alpha[i] = 1;
            (S.vel || (S.vel = new Float32Array(S.N * 3)));
            S.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
            S.vel[i * 3 + 1] = Math.cos(ph) * sp;
            S.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
        }
    },

    _buildAmbientOrbs(scene) {
        const mon = G.bldById?.['visitor_monument'];
        const cx = Number.isFinite(mon?.worldX) ? mon.worldX : 0;
        const cz = Number.isFinite(mon?.worldZ) ? mon.worldZ : 0;
        const col = new THREE.Color(this.season.color);
        const parts = [];
        for (let i = 0; i < 6; i++) {
            const g = new THREE.SphereGeometry(5, 6, 6);
            const a = (i / 6) * Math.PI * 2;
            g.translate(cx + Math.cos(a) * 60, 35 + (i % 2) * 10, cz + Math.sin(a) * 60);
            const n = g.attributes.position.count;
            const arr = new Float32Array(n * 3);
            for (let j = 0; j < n; j++) { arr[j * 3] = col.r; arr[j * 3 + 1] = col.g; arr[j * 3 + 2] = col.b; }
            g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
            parts.push(g);
        }
        const merged = mergeGeometries(parts, false);
        const posA = merged?.attributes?.position?.array;
        if (!posA) return;
        for (let i = 0; i < posA.length; i++) if (!Number.isFinite(posA[i])) return;
        this.mesh = new THREE.Mesh(merged,
            new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
        this.mesh.name = 'seasonalDecor';
        this._add(this.mesh, scene);
    },

    /** A line for the chat bubbles, if a festival is running. */
    chatLine() {
        if (!this.active.length) return null;
        const f = this.active[Math.floor(Math.random() * this.active.length)];
        return f.chat[Math.floor(Math.random() * f.chat.length)];
    },

    isActive(id) { return this.active.some(f => f.id === id); },

    update(dt) {
        const t = G.time || 0;
        if (this.mesh) this.mesh.rotation.y += dt * 0.15;
        if (this._star) this._star.rotation.y += dt * 0.8;
        // Candle / bulb flicker. Modulate a COPY of the authored colour —
        // setScalar() would set r=g=b and turn every warm lamp grey.
        for (const tw of this._twinkles) {
            const f = 0.82 + Math.sin(t * 5.1 + tw.phase) * 0.13 + Math.sin(t * 11.3 + tw.phase) * 0.05;
            tw.mesh.material.color.copy(tw.base).multiplyScalar(f);
        }

        const S = this._sparkData;
        if (!S) return;
        // launch cadence: fireworks are an event, powder and water are constant
        S.timer -= dt;
        if (S.timer <= 0) {
            this._launchBurst();
            S.timer = this._sparkKind === 'fireworks' ? 0.5 + Math.random() * 1.4 : 0.16;
        }
        if (!S.vel) return;
        const grav = this._sparkKind === 'fireworks' ? 42 : 120;
        const fade = this._sparkKind === 'fireworks' ? 0.5 : 1.1;
        for (let i = 0; i < S.N; i++) {
            if (S.alpha[i] <= 0) continue;
            S.vel[i * 3 + 1] -= grav * dt;
            S.pos[i * 3] += S.vel[i * 3] * dt;
            S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt;
            S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
            S.alpha[i] = Math.max(0, S.alpha[i] - fade * dt);
            if (S.pos[i * 3 + 1] < 1) S.alpha[i] = 0;
        }
        S.geo.attributes.position.needsUpdate = true;
        S.geo.attributes.color.needsUpdate = true;
        S.geo.attributes.aAlpha.needsUpdate = true;
    },

    snapshot() {
        return {
            id: this.active[0]?.id ?? this.season?.id,
            label: this.label,
            festivals: this.active.map(f => f.id),
            regions: this.regions,
            month: new Date().getMonth(),
            hasDecor: this._objs.length > 0
        };
    }
};
