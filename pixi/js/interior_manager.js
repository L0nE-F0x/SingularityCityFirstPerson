/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR MANAGER (v15.2.0 - Estate Router Update)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Interior = {
    isDragging: false,
    layer: null,
    activeModule: null,

    build(bld, layer) {
        this.layer = layer;

        // Auto-tag interior furniture/items with hover tooltips (one-shot).
        if (typeof UI !== 'undefined' && UI.initInteriorTips) UI.initInteriorTips();

        // Route to the appropriate interior module
        if (bld.id.startsWith('res_') || bld.id.startsWith('house_')) {
            this.activeModule = InteriorRes;
        } else if (bld.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(bld.type) && typeof SpaceInterior !== 'undefined') {
            this.activeModule = SpaceInterior;
        } else if ((bld.id.startsWith('dc_') || bld.id.startsWith('fab_')) && typeof InteriorDC !== 'undefined') {
            this.activeModule = InteriorDC;
        } else if (bld.id === 'neon_bar' && typeof InteriorBar !== 'undefined') {
            this.activeModule = InteriorBar;
        } else if (bld.id === 'black_market' && typeof InteriorBlackMarket !== 'undefined') {
            this.activeModule = InteriorBlackMarket;
        } else if (bld.id.startsWith('power_') && typeof InteriorPower !== 'undefined') {
            this.activeModule = InteriorPower;
        } else if (bld.id === 'bld_1' && typeof InteriorLegacy !== 'undefined') {
            this.activeModule = InteriorLegacy;
        } else if (bld.id.startsWith('npc_apt_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.id.startsWith('suburb_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.id.startsWith('diplomat_villa_') && typeof InteriorAmbassadorRes !== 'undefined') {
            this.activeModule = InteriorAmbassadorRes;
        } else if (bld.type === 'university' && typeof UniversityInterior !== 'undefined') {
            this.activeModule = UniversityInterior;
        } else if (bld.type === 'court' && typeof CourtInterior !== 'undefined') {
            this.activeModule = CourtInterior;
        } else if (bld.type === 'jail' && typeof JailInterior !== 'undefined') {
            this.activeModule = JailInterior;
        } else if (bld.id === 'convention_center' && typeof ConferenceInterior !== 'undefined') {
            this.activeModule = ConferenceInterior;
        } else if (bld.type === 'vcrow' && typeof InteriorVCRow !== 'undefined') {
            this.activeModule = InteriorVCRow;
        } else if (bld.type === 'backbone' && typeof InteriorBackbone !== 'undefined') {
            this.activeModule = InteriorBackbone;
        } else if (bld.type === 'robotics' && typeof InteriorRobotics !== 'undefined') {
            this.activeModule = InteriorRobotics;
        } else if (bld.type === 'longevity' && typeof InteriorLongevity !== 'undefined') {
            this.activeModule = InteriorLongevity;
        } else if (bld.type === 'agents' && typeof InteriorAgents !== 'undefined') {
            this.activeModule = InteriorAgents;
        } else if (bld.type === 'alignment' && typeof InteriorAlignment !== 'undefined') {
            this.activeModule = InteriorAlignment;
        } else if (bld.type === 'embassy' && typeof InteriorEmbassy !== 'undefined') {
            this.activeModule = InteriorEmbassy;
        // NB: trains are NOT a building interior — clicking one calls G.enterTrainFocus()
        // (a real-world camera cutaway), so there is no 'train' route here.
        } else if (bld.id && bld.id.startsWith('metro_') && typeof InteriorMetroStation !== 'undefined') {
            this.activeModule = InteriorMetroStation;
        } else if (bld.id === 'times_hq' && typeof InteriorNewspaper !== 'undefined') {
            this.activeModule = InteriorNewspaper;
        } else {
            this.activeModule = InteriorCity;
        }

        if (this.activeModule && this.activeModule.build) {
            this.activeModule.build(bld, layer);
            this.isDragging = this.activeModule.isDragging;
        }
    },

    cleanup() {
        // Remove stale window event listeners when exiting any interior
        if (this.activeModule) {
            // Modules use either onMove/_onMove and onUp/_onUp patterns
            const moveFn = this.activeModule.onMove || this.activeModule._onMove;
            const upFn = this.activeModule.onUp || this.activeModule._onUp;
            if (moveFn) window.removeEventListener('pointermove', moveFn);
            if (upFn) window.removeEventListener('pointerup', upFn);
            this.activeModule.isDragging = false;
            this.activeModule.scene = null;
            if (this.activeModule.layer) {
                this.activeModule.layer.removeAllListeners();
                this.activeModule.layer = null;
            }
        }
        this.activeModule = null;
        this.isDragging = false;
    },

    update() {
        if (this.activeModule && this.activeModule.update) {
            this.activeModule.update();
        }
        // After the module's own update has positioned avatars, pan the scene
        // to keep the tracked avatar centered. Runs once per frame so elevator
        // / walking motion is followed smoothly.
        this._updateInteriorCamera();
    },

    // ─────────────────────────────────────────────────────────────
    //   INTERIOR CAMERA FOLLOW (used while G.tracking is active)
    // ─────────────────────────────────────────────────────────────
    _updateInteriorCamera() {
        if (typeof G === 'undefined') return;
        const m = this.activeModule;
        if (!m) return;
        const scene = m.scene;
        if (!scene || scene.destroyed) return;

        // Lazily remember the scene's resting transform so we can restore it
        // when tracking ends (or when the user starts dragging the interior).
        if (typeof scene._restX === 'undefined') {
            scene._restX = scene.x || 0;
            scene._restY = scene.y || 0;
            scene._restScale = scene.scale ? scene.scale.x : 1;
        }

        if (!G.tracking) {
            // Smoothly return scene to its resting transform.
            if (scene._cameraEngaged) {
                const lerp = 0.1;
                scene.x += (scene._restX - scene.x) * lerp;
                scene.y += (scene._restY - scene.y) * lerp;
                if (scene.scale) {
                    const ns = scene.scale.x + (scene._restScale - scene.scale.x) * lerp;
                    scene.scale.set(ns);
                }
                if (Math.abs(scene.x - scene._restX) < 0.5
                    && Math.abs(scene.y - scene._restY) < 0.5
                    && (!scene.scale || Math.abs(scene.scale.x - scene._restScale) < 0.005)) {
                    scene.x = scene._restX;
                    scene.y = scene._restY;
                    if (scene.scale) scene.scale.set(scene._restScale);
                    scene._cameraEngaged = false;
                }
            }
            return;
        }

        const av = this._findTrackedAvatar();
        if (!av || !av.cont || av.cont.destroyed) return;

        // Use the avatar's pre-scale local position; we apply scale ourselves
        // so the centering math stays correct as we zoom in.
        const targetScale = 1.45;
        const curScale = scene.scale ? scene.scale.x : 1;
        const newScale = curScale + (targetScale - curScale) * 0.05;
        if (scene.scale) scene.scale.set(newScale);

        const avX = av.cont.x;
        const avY = av.cont.y;
        // Sit the avatar in the lower-middle of the viewport so we can see
        // the floor they're walking on plus the ceiling above.
        const targetSceneX = G.vpW / 2 - avX * newScale;
        const targetSceneY = G.vpH * 0.55 - avY * newScale;

        const lerp = 0.08;
        scene.x += (targetSceneX - scene.x) * lerp;
        scene.y += (targetSceneY - scene.y) * lerp;
        scene._cameraEngaged = true;
    },

    _findTrackedAvatar() {
        if (typeof G === 'undefined' || !G.tracking) return null;
        const m = this.activeModule;
        if (!m) return null;
        const t = G.tracking;
        const tid = t.id;

        // Most modules expose `avatars` (an array of objects with .m and .cont).
        if (Array.isArray(m.avatars)) {
            for (const av of m.avatars) {
                if (!av || !av.m || !av.cont) continue;
                if (t.type === 'ceo' && av.m.isCeo && av.m.lab === t.lab) return av;
                if (av.m.id === tid) return av;
            }
        }
        // InteriorCityAI alt path uses `workers`.
        if (Array.isArray(m.workers)) {
            for (const w of m.workers) {
                if (!w || !w.m || !w.c) continue;
                if (w.m.id === tid) return { cont: w.c, m: w.m };
            }
        }
        // Metro stations / DC / a few others use a Map keyed by id.
        if (m.avatarPool && typeof m.avatarPool.get === 'function') {
            const direct = m.avatarPool.get(tid);
            if (direct && direct.cont && direct.cont.visible) return direct;
            const npc = m.avatarPool.get('npc_' + tid);
            if (npc && npc.cont && npc.cont.visible) return npc;
        }
        return null;
    }
};
