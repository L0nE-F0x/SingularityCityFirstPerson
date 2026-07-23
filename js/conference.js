/* ══════════════════════════════════════════════════════════════════════════
   CONFERENCE EVENTS — when activeConference() matches calendar, dress the
   convention centre with banners + attendee pull + achievement.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { CONFERENCES, activeConference } from './data.js';

export function conferenceStatus(now = new Date(), forceId = null) {
    if (forceId) {
        const c = CONFERENCES.find(x => x.id === forceId);
        return c ? { active: true, conf: c, forced: true } : { active: false, conf: null };
    }
    const conf = activeConference(now);
    return { active: !!conf, conf, forced: false };
}

export const Conference = {
    active: false,
    conf: null,
    banners: null,
    _checked: false,

    init(scene) {
        const st = conferenceStatus();
        // also allow ?conf=neurips for testing
        const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
        const force = params.get('conf');
        const st2 = force ? conferenceStatus(new Date(), force) : st;
        this.conf = st2.conf;
        this.active = st2.active;

        const b = G.bldById['convention_center'];
        if (b && scene) {
            const group = new THREE.Group();
            const col = new THREE.Color(this.conf?.hex || '#22d3ee');
            for (let i = 0; i < 4; i++) {
                const m = new THREE.Mesh(
                    new THREE.BoxGeometry(40, 50, 3),
                    new THREE.MeshBasicMaterial({ color: col })
                );
                const a = (i / 4) * Math.PI * 2;
                m.position.set(b.worldX + Math.cos(a) * 90, 40, b.worldZ + Math.sin(a) * 90);
                m.rotation.y = -a;
                group.add(m);
            }
            group.visible = this.active;
            this.banners = group;
            scene.add(group);
        }
        if (this.active) {
            G.progress?.unlock('peer_reviewed');
            G.ui?.banner?.(`🎤 ${this.conf.name}`, this.conf.theme);
        }
    },

    update(_dt) {
        if (this.banners) this.banners.visible = this.active;
        // pull some citizens toward convention when active
        if (this.active && G.citizens && !this._checked) {
            this._checked = true;
            const list = G.citizens.list;
            for (let i = 0; i < list.length; i += 17) {
                list[i].targetBid = 'convention_center';
            }
        }
    },

    snapshot() {
        return {
            active: this.active,
            name: this.conf?.name || null,
            id: this.conf?.id || null,
            all: CONFERENCES.map(c => c.id)
        };
    }
};
