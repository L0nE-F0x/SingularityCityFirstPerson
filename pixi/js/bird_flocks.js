/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BIRD FLOCKS (v1.0.0)
   Procedural bird formations that fly overhead, land on buildings/trees, scatter when camera approaches.
   Max 3 flocks × 5-8 birds = 15-24 sprites. Uses culling + object pooling for zero perf impact.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BirdFlocks = {

    MAX_FLOCKS: 3,
    BIRDS_PER_FLOCK: 6,
    _flocks: [],
    _container: null,
    _tick: 0,
    _nextSpawn: 60,

    init(charLayer) {
        this._container = new PIXI.Container();
        this._container.zIndex = 500;
        charLayer.addChild(this._container);
    },

    update() {
        if (!this._container) return;
        this._tick++;

        const camX = -Camera.x * Camera.zoom;
        const camW = G.vpW;
        const viewLeft = camX - 200;
        const viewRight = camX + camW + 200;

        // Spawn new flocks periodically
        if (this._tick >= this._nextSpawn && this._flocks.length < this.MAX_FLOCKS) {
            this._spawnFlock(camX, camW);
            this._nextSpawn = this._tick + 400 + Math.floor(Math.random() * 500);
        }

        // Update each flock
        for (let fi = this._flocks.length - 1; fi >= 0; fi--) {
            const flock = this._flocks[fi];

            if (flock.state === 'flying') {
                this._updateFlying(flock, viewLeft, viewRight);
            } else if (flock.state === 'landing') {
                this._updateLanding(flock);
            } else if (flock.state === 'perched') {
                this._updatePerched(flock, camX, camW);
            } else if (flock.state === 'scattering') {
                this._updateScattering(flock, viewLeft, viewRight);
            }

            // Remove dead flocks
            if (flock.state === 'dead') {
                flock.birds.forEach(bird => {
                    if (bird.sprite && bird.sprite.parent) {
                        bird.sprite.parent.removeChild(bird.sprite);
                    }
                });
                this._flocks.splice(fi, 1);
            }
        }
    },

    _spawnFlock(camX, camW) {
        const flock = {
            state: 'flying',
            birds: [],
            targetX: 0,
            targetY: 0,
            perchTimer: 0,
            dir: Math.random() < 0.5 ? 1 : -1,
            speed: 1.2 + Math.random() * 0.8,
            altitude: G.groundY - 200 - Math.random() * 150,
            life: 0,
        };

        // Spawn off-screen in flight direction
        const startX = flock.dir > 0 ? camX - 100 : camX + camW + 100;

        // Pick a landing zone if available (prefer city_park, residential, forest areas)
        const parkBld = G.bldById['city_park'];
        const forestBld = G.bldById['forest_0'];
        const candidates = [parkBld, forestBld].filter(Boolean);
        if (candidates.length > 0) {
            const target = candidates[Math.floor(Math.random() * candidates.length)];
            flock.targetX = target.x + Math.random() * target.w;
            flock.targetY = G.groundY - 160 - Math.random() * 60;
        }

        const count = this.BIRDS_PER_FLOCK + Math.floor(Math.random() * 3) - 1;
        for (let i = 0; i < count; i++) {
            const sprite = this._createBirdSprite();
            // V-formation offset
            const row = Math.floor(i / 2);
            const side = i % 2 === 0 ? -1 : 1;
            sprite.x = startX + row * 12 * -flock.dir + side * (row + 1) * 8;
            sprite.y = flock.altitude + row * 4 + Math.random() * 3;
            sprite.scale.x = flock.dir;
            this._container.addChild(sprite);
            flock.birds.push({
                sprite,
                offsetX: row * 12 * -flock.dir + side * (row + 1) * 8,
                offsetY: row * 4 + Math.random() * 3,
                wingPhase: Math.random() * Math.PI * 2,
                wingSpeed: 0.15 + Math.random() * 0.05,
            });
        }

        this._flocks.push(flock);
    },

    _createBirdSprite() {
        const g = new PIXI.Graphics();
        // Bird body — visible dark brown
        g.beginFill(0x4a3828, 0.95);
        g.drawEllipse(0, 0, 5, 2.5); // body
        g.endFill();
        // Head
        g.beginFill(0x3a2818, 0.9);
        g.drawCircle(4, -1, 2);
        g.endFill();
        // Beak
        g.beginFill(0xd4a020);
        g.moveTo(6, -1); g.lineTo(8, -0.5); g.lineTo(6, 0);
        g.closePath(); g.endFill();
        // Wings drawn dynamically in update
        g._wingL = new PIXI.Graphics();
        g._wingR = new PIXI.Graphics();
        g.addChild(g._wingL, g._wingR);
        return g;
    },

    _drawWings(sprite, phase, isPerched) {
        const wingL = sprite._wingL;
        const wingR = sprite._wingR;
        wingL.clear();
        wingR.clear();
        if (isPerched) {
            // Folded wings — tucked along body
            wingL.beginFill(0x5a4838, 0.7);
            wingL.drawEllipse(-3, -1, 3, 1.5);
            wingL.endFill();
            wingR.beginFill(0x5a4838, 0.7);
            wingR.drawEllipse(3, -1, 3, 1.5);
            wingR.endFill();
        } else {
            // Flapping wings — larger, more visible
            const wingY = Math.sin(phase) * 5;
            wingL.beginFill(0x5a4838, 0.85);
            wingL.moveTo(0, 0); wingL.lineTo(-8, wingY - 2); wingL.lineTo(-5, wingY);
            wingL.closePath(); wingL.endFill();
            wingR.beginFill(0x5a4838, 0.85);
            wingR.moveTo(0, 0); wingR.lineTo(8, wingY - 2); wingR.lineTo(5, wingY);
            wingR.closePath(); wingR.endFill();
        }
    },

    _updateFlying(flock, viewLeft, viewRight) {
        flock.life++;
        const leaderX = flock.birds[0]?.sprite.x || 0;

        // Check if flock should start landing
        if (flock.targetX > 0 && Math.abs(leaderX - flock.targetX) < 40 && Math.random() < 0.02) {
            flock.state = 'landing';
            return;
        }

        // Move birds in formation
        flock.birds.forEach((bird, i) => {
            bird.sprite.x += flock.speed * flock.dir;
            bird.sprite.y = flock.altitude + bird.offsetY + Math.sin(this._tick * 0.02 + i * 0.5) * 2;
            bird.wingPhase += bird.wingSpeed;
            this._drawWings(bird.sprite, bird.wingPhase, false);
            bird.sprite.scale.x = flock.dir;
        });

        // Remove if completely off-screen for a while
        if (flock.life > 300 && (leaderX < viewLeft - 200 || leaderX > viewRight + 200)) {
            flock.state = 'dead';
        }
    },

    _updateLanding(flock) {
        let allLanded = true;
        flock.birds.forEach((bird, i) => {
            const targetY = flock.targetY + (i % 3) * 3;
            const targetX = flock.targetX + (i - flock.birds.length / 2) * 10;
            const dx = targetX - bird.sprite.x;
            const dy = targetY - bird.sprite.y;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                bird.sprite.x += dx * 0.06;
                bird.sprite.y += dy * 0.06;
                bird.wingPhase += bird.wingSpeed * 0.5;
                this._drawWings(bird.sprite, bird.wingPhase, false);
                allLanded = false;
            } else {
                bird.sprite.x = targetX;
                bird.sprite.y = targetY;
                this._drawWings(bird.sprite, 0, true);
            }
            bird.sprite.scale.x = dx > 0 ? 1 : -1;
        });

        if (allLanded) {
            flock.state = 'perched';
            flock.perchTimer = 300 + Math.floor(Math.random() * 400);
        }
    },

    _updatePerched(flock, camX, camW) {
        flock.perchTimer--;

        // Idle animation — occasional head bob
        flock.birds.forEach((bird, i) => {
            if (this._tick % 60 === (i * 7) % 60) {
                bird.sprite.y += Math.random() < 0.5 ? -0.5 : 0.5;
            }
        });

        // Scatter if camera gets close
        const leaderX = flock.birds[0]?.sprite.x || 0;
        const camCenter = camX + camW / 2;
        const camDist = Math.abs(leaderX - camCenter);
        if (camDist < camW * 0.3 && Camera.zoom > 0.8) {
            flock.state = 'scattering';
            flock.dir = leaderX > camCenter ? 1 : -1;
            flock.birds.forEach(bird => {
                bird._scatterVx = flock.dir * (2 + Math.random() * 2);
                bird._scatterVy = -(3 + Math.random() * 3);
            });
            return;
        }

        // Fly away after perch timer expires
        if (flock.perchTimer <= 0) {
            flock.state = 'scattering';
            flock.dir = Math.random() < 0.5 ? 1 : -1;
            flock.birds.forEach(bird => {
                bird._scatterVx = flock.dir * (1.5 + Math.random() * 1.5);
                bird._scatterVy = -(2 + Math.random() * 2);
            });
        }
    },

    _updateScattering(flock, viewLeft, viewRight) {
        let allGone = true;
        flock.birds.forEach(bird => {
            bird.sprite.x += bird._scatterVx || 0;
            bird.sprite.y += bird._scatterVy || 0;
            bird._scatterVy = (bird._scatterVy || 0) + 0.03; // gentle gravity
            if (bird._scatterVy > 0) bird._scatterVy = Math.min(bird._scatterVy, 0.5); // cap descent
            bird.wingPhase += bird.wingSpeed * 1.5;
            this._drawWings(bird.sprite, bird.wingPhase, false);
            bird.sprite.scale.x = (bird._scatterVx || 1) > 0 ? 1 : -1;

            if (bird.sprite.x > viewLeft - 100 && bird.sprite.x < viewRight + 100) {
                allGone = false;
            }
        });

        if (allGone) {
            flock.state = 'dead';
        }
    }
};
