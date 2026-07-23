/* ══════════════════════════════════════════════════════════════════════════
   PROGRESSION — achievements, quests, visited districts, citizen meetings,
   easter-egg triggers, and localStorage persistence.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { ACHIEVEMENTS, QUESTS, DISTRICTS } from './data.js';

const SAVE_KEY = 'sc_fp_save_v1';

export const Progress = {
    init() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                G.achievements = s.achievements || {};
                G.visitedDistricts = s.visitedDistricts || {};
                G.metCitizens = s.metCitizens || {};
                G.stats = Object.assign({ tramsSpotted: 0, moonClicks: 0 }, s.stats);
                G.settings = Object.assign(G.settings, s.settings);
                G.quality = s.quality || G.quality;
                if (G.settings.timeScale) G.timeScale = G.settings.timeScale;
            }
        } catch (e) { /* fresh start */ }
    },

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                achievements: G.achievements,
                visitedDistricts: G.visitedDistricts,
                metCitizens: G.metCitizens,
                stats: G.stats,
                settings: G.settings,
                quality: G.quality
            }));
        } catch (e) { /* storage full/blocked — non-fatal */ }
    },

    unlock(key) {
        if (G.achievements[key]) return;
        const a = ACHIEVEMENTS[key];
        if (!a) return;
        G.achievements[key] = Date.now();
        G.ui?.addToast?.(`${a.icon} Achievement: ${a.name}`, 'achieve');
        G.audio?.sfx('achieve');
        // quest completion check
        for (const [qid, q] of Object.entries(QUESTS)) {
            if (!q.achieves.includes(key)) continue;
            const already = q.achieves.some(k => k !== key && G.achievements[k]);
            if (!already) {
                G.ui?.addToast?.(`📜 Quest complete: ${q.icon} ${q.title}`, 'quest');
                G.audio?.sfx('quest');
            }
        }
        this.save();
    },

    questDone(qid) {
        const q = QUESTS[qid];
        return q && q.achieves.some(k => G.achievements[k]);
    },

    visitDistrict(id) {
        if (!G.visitedDistricts[id]) {
            G.visitedDistricts[id] = Date.now();
            const n = Object.keys(G.visitedDistricts).length;
            if (n >= 5) this.unlock('tourist');
            if (n >= 10) this.unlock('explorer');
            if (n >= DISTRICTS.length) this.unlock('cartographer');
            if (id === 'underground') this.unlock('shadow_market');
            this.save();
        }
    },

    meetCitizen(c) {
        if (!G.metCitizens[c.model.id]) {
            G.metCitizens[c.model.id] = Date.now();
            if (c.named) this.unlock('meet_famous');
            if (Object.keys(G.metCitizens).length >= 10) this.unlock('social');
            this.save();
        }
    },

    caturday() {
        if (!G.achievements['cat_mode']) this.unlock('cat_mode');
        G.flags.caturday = true;
        // every citizen turns ginger for a while
        const orange = new THREE.Color('#e8933a');
        G.citizens.list.forEach((c, i) => G.citizens.mesh.setColorAt(i, orange));
        G.citizens.mesh.instanceColor.needsUpdate = true;
        G.ui.addToast('🐱 CATURDAY! Every citizen is a cat now. Meow.');
        G.audio?.sfx('meow');
        setTimeout(() => {
            G.flags.caturday = false;
            G.citizens.list.forEach((c, i) => G.citizens.mesh.setColorAt(i, c.color));
            G.citizens.mesh.instanceColor.needsUpdate = true;
        }, 30000);
    },

    konami() {
        if (G.flags.konami) return;
        G.flags.konami = true;
        this.unlock('konami');
        G.ui.addToast('🕹️ KONAMI! 30 seconds of rainbow skies.');
        G.audio?.sfx('quest');
        let hue = 0;
        const iv = setInterval(() => {
            hue = (hue + 0.03) % 1;
            G.weatherSys.skyU.top.value.setHSL(hue, 0.7, 0.5);
            G.weatherSys.skyU.bottom.value.setHSL((hue + 0.15) % 1, 0.7, 0.6);
        }, 50);
        setTimeout(() => { clearInterval(iv); G.flags.konami = false; }, 30000);
    },

    // event router used by systems (weather, trams, rockets…)
    event(name, data) {
        switch (name) {
            case 'weather_rain': this.unlock('rain_seen'); break;
            case 'weather_snow': this.unlock('snow_seen'); break;
            case 'weather_thunderstorm': this.unlock('thunder_seen'); break;
            case 'weather_fog': this.unlock('fog_seen'); break;
            case 'aurora': this.unlock('stargazer'); break;
            case 'rocket_launch': {
                // only counts if you're actually near the Space Zone to see it
                const p = G.camera.position;
                if (data && Math.hypot(p.x - data.x, p.z - data.z) < 2200) this.unlock('rocket_scientist');
                break;
            }
            case 'tram_depart': this.unlock('train_spotter'); break;
        }
    }
};
