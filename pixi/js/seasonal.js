/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SEASONAL EVENTS (v2.0.0)
   Date-driven event system for holidays, festivals, and seasonal overlays.
   Supports global events (visible to all) and regional events (filtered by
   browser timezone → region mapping).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Seasonal = {

    _eventsVisited: {},   // persisted set of event IDs the player has witnessed
    _playerRegion: null,  // detected region string e.g. 'south_asia', 'southeast_asia', …

    /* ─── TIMEZONE → REGION MAPPING ─── */
    _TZ_REGIONS: {
        south_asia:      ['Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Karachi', 'Asia/Thimphu'],
        southeast_asia:  ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak', 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Manila', 'Asia/Phnom_Penh', 'Asia/Vientiane', 'Asia/Yangon'],
        indonesia:       ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak'],
        east_asia:       ['Asia/Shanghai', 'Asia/Taipei', 'Asia/Hong_Kong', 'Asia/Macau', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Ulaanbaatar'],
        japan:           ['Asia/Tokyo'],
        middle_east:     ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Bahrain', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Baghdad', 'Asia/Tehran', 'Asia/Amman', 'Asia/Beirut', 'Asia/Damascus', 'Asia/Jerusalem', 'Asia/Aden', 'Africa/Cairo'],
        jewish:          ['Asia/Jerusalem', 'Asia/Tel_Aviv'],
        latin_america:   ['America/Mexico_City', 'America/Cancun', 'America/Monterrey', 'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Buenos_Aires', 'America/Sao_Paulo', 'America/Caracas', 'America/Guatemala', 'America/Havana', 'America/La_Paz', 'America/Asuncion', 'America/Montevideo', 'America/Guayaquil', 'America/Costa_Rica', 'America/Panama'],
        thailand:        ['Asia/Bangkok'],
    },

    /* ─── GLOBAL EVENTS (visible to everyone) ─── */
    EVENTS: [
        { id: 'winter_holiday', name: 'Winter Holidays',   icon: '🎄', startMonth: 12, startDay: 15, endMonth: 1,  endDay: 2,  chat: ['Happy holidays!', 'Who wants hot cocoa? ☕', 'Jingle bells, jingle bells!', 'Best time of year 🎅', 'Love the fairy lights!', 'Secret Santa time!', 'New year, new weights!'] },
        { id: 'halloween',      name: 'Halloween',         icon: '🎃', startMonth: 10, startDay: 25, endMonth: 10, endDay: 31, chat: ['Trick or treat! 🍬', 'Boo! Scared ya!', 'Nice costume!', 'Spooky vibes 👻', 'My loss function is TERRIFYING', 'Who\'s that ghost model?', 'Pumpkin spice everything'] },
        { id: 'cherry_blossom', name: 'Cherry Blossom',    icon: '🌸', startMonth: 4,  startDay: 1,  endMonth: 4,  endDay: 30, chat: ['The blossoms are beautiful!', 'Spring training season 🌱', 'Fresh gradients in the air', 'Hanami picnic anyone?', 'New season, new parameters'] },
        { id: 'new_year',       name: 'New Year',          icon: '🎆', startMonth: 12, startDay: 31, endMonth: 1,  endDay: 1,  chat: ['Happy New Year! 🎉', '3... 2... 1... LAUNCH!', 'New year, new benchmarks!', 'Resolution: beat GPT-5', 'What a year for AI!'] },
        { id: 'july_4',         name: 'Independence Day',  icon: '🎇', startMonth: 7,  startDay: 4,  endMonth: 7,  endDay: 4,  chat: ['Happy 4th! 🇺🇸', 'Fireworks time!', 'Freedom to compute!', 'Stars and stripes and GPUs'] },
        { id: 'easter',         name: 'Easter',            icon: '🐣', startMonth: 0,  startDay: 0,  endMonth: 0,  endDay: 0,  chat: ['Happy Easter! 🐰', 'Found an Easter egg!', 'Egg hunt in Pine Reserve!', 'Spring is here!', 'Chocolate inference 🍫'] },
        { id: 'lunar_new_year', name: 'Lunar New Year',    icon: '🧧', startMonth: 0,  startDay: 0,  endMonth: 0,  endDay: 0,  chat: ['Happy Lunar New Year! 🐉', 'Gong xi fa cai!', 'Red envelopes for everyone!', 'Dragon dance time!', 'Year of the AI 🧧'] },
    ],

    /* ─── REGIONAL EVENTS (filtered by timezone) ─── */
    REGIONAL_EVENTS: [
        /* ── SOUTH ASIA ── */
        { id: 'diwali',         name: 'Diwali',               icon: '🪔', regions: ['south_asia', 'southeast_asia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Happy Diwali! 🪔', 'Festival of lights!', 'Light over darkness!', 'Diyas everywhere!', 'Rangoli in the lobby!', 'Sweets for everyone! 🍬'] },
        { id: 'holi',           name: 'Holi',                 icon: '🎨', regions: ['south_asia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Happy Holi! 🎨', 'So many colors!', 'Holi hai!!', 'My GPU is rainbow now!', 'Color powder everywhere!', 'Spring is here!'] },

        /* ── INDONESIA / BALI ── */
        { id: 'nyepi',          name: 'Nyepi',                icon: '🕯️', regions: ['indonesia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Selamat Hari Raya Nyepi', 'Day of Silence...', 'No lights tonight 🕯️', 'Ogoh-ogoh parade was amazing!', 'Self-reflection mode', 'The island sleeps tonight'] },
        { id: 'galungan',       name: 'Galungan & Kuningan',  icon: '🎋', regions: ['indonesia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Rahajeng Galungan!', 'The penjor are beautiful 🎋', 'Ancestors visiting today', 'Offerings everywhere', 'Kuningan blessings!', 'Temple ceremony time'] },

        /* ── MIDDLE EAST / ISLAMIC ── */
        { id: 'ramadan',        name: 'Ramadan',              icon: '🌙', regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Ramadan Mubarak! 🌙', 'Iftar time!', 'Blessed month', 'Fasting and patience', 'The crescent moon is here', 'Sharing is caring'] },
        { id: 'eid_fitr',       name: 'Eid al-Fitr',          icon: '🕌', regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Eid Mubarak! 🕌', 'Selamat Hari Raya!', 'Celebration after fasting!', 'Sweets and joy!', 'Family gathering time'] },
        { id: 'eid_adha',       name: 'Eid al-Adha',          icon: '🐑', regions: ['middle_east', 'south_asia', 'southeast_asia', 'indonesia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Eid al-Adha Mubarak! 🐑', 'Festival of sacrifice', 'Sharing with the community', 'Blessed celebration'] },

        /* ── EAST ASIA ── */
        { id: 'mid_autumn',     name: 'Mid-Autumn Festival',  icon: '🥮', regions: ['east_asia', 'southeast_asia'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Happy Mid-Autumn! 🥮', 'Moon cake time!', 'The moon is so full tonight!', 'Lanterns in the park!', 'Family reunion dinner!'] },

        /* ── JAPAN ── */
        { id: 'obon',           name: 'Obon',                 icon: '🏮', regions: ['japan'],
          startMonth: 8, startDay: 13, endMonth: 8, endDay: 16,
          chat: ['Obon matsuri! 🏮', 'Ancestors are visiting', 'Bon Odori tonight!', 'Paper lanterns on the river', 'Time to remember'] },

        /* ── THAILAND ── */
        { id: 'songkran',       name: 'Songkran',             icon: '💦', regions: ['thailand', 'southeast_asia'],
          startMonth: 4, startDay: 13, endMonth: 4, endDay: 15,
          chat: ['Sawasdee Pi Mai! 💦', 'Water fight!!', 'Happy Songkran!', 'New year splash!', 'Stay cool!'] },

        /* ── LATIN AMERICA ── */
        { id: 'dia_muertos',    name: 'Día de los Muertos',   icon: '💀', regions: ['latin_america'],
          startMonth: 11, startDay: 1, endMonth: 11, endDay: 2,
          chat: ['Feliz Día de los Muertos! 💀', 'Marigolds everywhere!', 'Ofrendas for the departed', 'Sugar skulls!', 'Remember those we love'] },

        /* ── JEWISH ── */
        { id: 'hanukkah',       name: 'Hanukkah',             icon: '🕎', regions: ['jewish', 'middle_east'],
          startMonth: 0, startDay: 0, endMonth: 0, endDay: 0,
          chat: ['Happy Hanukkah! 🕎', 'Light the menorah!', 'Eight crazy nights!', 'Dreidel dreidel dreidel!', 'Festival of lights!'] },
    ],

    /* ─── YEAR LOOKUP TABLES FOR VARIABLE-DATE HOLIDAYS ───
       Islamic holidays shift ~11 days/year (pure lunar calendar).
       Hindu/Balinese holidays follow lunisolar calendars.
       Tables cover 2025-2032; after that, fallback to last known or skip. */
    _DATE_TABLES: {
        diwali:     { 2025: [10, 20], 2026: [11, 8],  2027: [10, 29], 2028: [10, 17], 2029: [11, 5],  2030: [10, 26], 2031: [10, 16], 2032: [11, 2] },
        holi:       { 2025: [3, 14],  2026: [3, 3],   2027: [3, 22],  2028: [3, 11],  2029: [3, 1],   2030: [3, 20],  2031: [3, 10],  2032: [2, 27] },
        nyepi:      { 2025: [3, 29],  2026: [3, 19],  2027: [3, 8],   2028: [3, 26],  2029: [3, 15],  2030: [3, 5],   2031: [3, 24],  2032: [3, 12] },
        galungan:   { 2025: [2, 26],  2026: [9, 23],  2027: [4, 21],  2028: [11, 15], 2029: [6, 13],  2030: [1, 8],   2031: [8, 6],   2032: [3, 4] },
        ramadan:    { 2025: [3, 1],   2026: [2, 18],  2027: [2, 8],   2028: [1, 28],  2029: [1, 16],  2030: [1, 6],   2031: [12, 26], 2032: [12, 15] },
        eid_fitr:   { 2025: [3, 30],  2026: [3, 20],  2027: [3, 10],  2028: [2, 27],  2029: [2, 14],  2030: [2, 4],   2031: [1, 25],  2032: [1, 14] },
        eid_adha:   { 2025: [6, 7],   2026: [5, 27],  2027: [5, 16],  2028: [5, 5],   2029: [4, 24],  2030: [4, 13],  2031: [4, 3],   2032: [3, 22] },
        mid_autumn: { 2025: [10, 6],  2026: [9, 25],  2027: [9, 15],  2028: [10, 3],  2029: [9, 22],  2030: [9, 12],  2031: [10, 1],  2032: [9, 19] },
        hanukkah:   { 2025: [12, 14], 2026: [12, 4],  2027: [12, 24], 2028: [12, 12], 2029: [12, 1],  2030: [12, 21], 2031: [12, 10], 2032: [11, 28] },
    },

    /* ─── FESTIVAL DURATIONS (days including start) ─── */
    _DURATIONS: {
        diwali: 5, holi: 2, nyepi: 3, galungan: 10, ramadan: 30, eid_fitr: 3,
        eid_adha: 3, mid_autumn: 3, hanukkah: 8,
    },

    init() {
        this._detectRegion();
        this._computeEaster();
        this._computeLunarNewYear();
        this._computeVariableDates();
    },

    /* ─── DETECT PLAYER REGION FROM TIMEZONE ─── */
    _detectRegion() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            this._playerTimezone = tz;
            this._playerRegions = [];
            for (const [region, zones] of Object.entries(this._TZ_REGIONS)) {
                if (zones.includes(tz)) this._playerRegions.push(region);
            }
        } catch (_) {
            this._playerRegions = [];
        }
    },

    /* ─── COMPUTE VARIABLE DATES FOR REGIONAL EVENTS ─── */
    _computeVariableDates() {
        const y = new Date().getFullYear();
        for (const ev of this.REGIONAL_EVENTS) {
            const table = this._DATE_TABLES[ev.id];
            if (!table) continue; // fixed-date events like obon, songkran, dia_muertos
            const dates = table[y];
            if (!dates) { ev.startMonth = 0; ev.startDay = 0; continue; } // no data for this year
            const dur = this._DURATIONS[ev.id] || 3;
            ev.startMonth = dates[0];
            ev.startDay = dates[1];
            // Compute end date by adding duration
            const startDate = new Date(y, dates[0] - 1, dates[1]);
            const endDate = new Date(startDate.getTime() + (dur - 1) * 86400000);
            ev.endMonth = endDate.getMonth() + 1;
            ev.endDay = endDate.getDate();
        }
    },

    _computeEaster() {
        const y = new Date().getFullYear();
        const a = y % 19, b = Math.floor(y / 100), c = y % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        const ev = this.EVENTS.find(e => e.id === 'easter');
        if (ev) {
            ev.startMonth = month; ev.startDay = day - 1;  // Sat before
            ev.endMonth = month;   ev.endDay = day + 1;    // Mon after
        }
    },

    _computeLunarNewYear() {
        // Approximate Lunar New Year dates for upcoming years
        const lny = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] };
        const y = new Date().getFullYear();
        const dates = lny[y] || [2, 1]; // fallback Feb 1
        const ev = this.EVENTS.find(e => e.id === 'lunar_new_year');
        if (ev) {
            ev.startMonth = dates[0]; ev.startDay = dates[1];
            ev.endMonth = dates[0];   ev.endDay = dates[1] + 2; // 3 day festival
        }
    },

    getActiveEvents() {
        const now = new Date();
        const m = now.getMonth() + 1, d = now.getDate();
        const active = [];

        // Check global events
        for (const ev of this.EVENTS) {
            if (ev.startMonth === 0) continue; // uncomputed
            if (this._isDateInRange(m, d, ev.startMonth, ev.startDay, ev.endMonth, ev.endDay)) {
                active.push(ev);
            }
        }

        // Check regional events (only if player is in a matching region)
        if (this._playerRegions && this._playerRegions.length > 0) {
            for (const ev of this.REGIONAL_EVENTS) {
                if (ev.startMonth === 0) continue;
                if (!ev.regions.some(r => this._playerRegions.includes(r))) continue;
                if (this._isDateInRange(m, d, ev.startMonth, ev.startDay, ev.endMonth, ev.endDay)) {
                    active.push(ev);
                }
            }
        }

        // Track achievements
        for (const ev of active) {
            if (!this._eventsVisited[ev.id]) {
                this._eventsVisited[ev.id] = true;
                const count = Object.keys(this._eventsVisited).length;
                if (count >= 3 && typeof G !== 'undefined') G.unlockAchieve('holiday_spirit');
            }
        }

        return active;
    },

    getActiveEvent() {
        const evts = this.getActiveEvents();
        return evts.length > 0 ? evts[0] : null;
    },

    isActive(eventId) {
        return this.getActiveEvents().some(e => e.id === eventId);
    },

    hasFireworks() {
        return this.isActive('new_year') || this.isActive('july_4') || this.isActive('diwali') || this.isActive('eid_fitr');
    },

    isWinter() {
        return this.isActive('winter_holiday');
    },

    isHalloween() {
        return this.isActive('halloween');
    },

    getSeasonalChat() {
        const evts = this.getActiveEvents();
        if (evts.length === 0) return null;
        const ev = evts[Math.floor(Math.random() * evts.length)];
        return ev.chat[Math.floor(Math.random() * ev.chat.length)];
    },

    _isDateInRange(m, d, sm, sd, em, ed) {
        // Handle wrap-around (e.g., Dec 15 → Jan 2)
        if (sm <= em) {
            // Same year range
            if (m < sm || m > em) return false;
            if (m === sm && d < sd) return false;
            if (m === em && d > ed) return false;
            return true;
        } else {
            // Wraps around year boundary
            if (m > em && m < sm) return false;
            if (m === sm && d < sd) return false;
            if (m === em && d > ed) return false;
            return true;
        }
    }
};
