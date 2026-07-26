/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BACKBONE ENVIRONMENT (v1.0.0)
   Renders network infrastructure animations: fiber pulses, server LEDs, satellite dishes,
   cooling fog, and the network status panel.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BackboneEnv = {
    _built: false,
    fiberPulses: [],     // Animated light dots traveling along cables
    serverLEDs: [],      // Blinking rack LEDs on building facades
    coolingFog: [],      // Fog/mist from cooling systems
    dishes: [],          // Rotating satellite dishes
    signalBars: [],      // Animated throughput bars on rooftops

    buildAnimations(charLayer) {
        if (this._built || typeof BackboneZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── FIBER PULSE PARTICLES (travel along underground cables) ───
        const ixp = BLDS.find(b => b.id === 'backbone_ixp');
        if (ixp) {
            const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
            for (let i = 0; i < 24; i++) {
                const p = new PIXI.Graphics();
                const col = cableCols[i % cableCols.length];
                p.beginFill(col, 0.7 + Math.random() * 0.3);
                p.drawCircle(0, 0, 1.5 + Math.random() * 1.5);
                p.endFill();
                // Start spread across the zone
                p.x = BackboneZone.zoneStartX + Math.random() * (BackboneZone.zoneEndX - BackboneZone.zoneStartX);
                p.y = gy + 38 + Math.random() * 25;
                p._speed = (1.5 + Math.random() * 2.5) * (Math.random() > 0.5 ? 1 : -1); // Bi-directional
                p._baseY = p.y;
                // Store building ref so _originX stays correct if Backbone zone is re-positioned later.
                p._ixpBld = ixp;
                charLayer.addChild(p);
                this.fiberPulses.push(p);
            }
        }

        // ─── COOLING FOG (from NOC and CDN) ───
        const coolBlds = ['backbone_noc', 'backbone_cdn'].map(id => BLDS.find(b => b.id === id)).filter(Boolean);
        coolBlds.forEach(bld => {
            for (let i = 0; i < 8; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(0xaaddff, 0.08 + Math.random() * 0.08);
                p.drawCircle(0, 0, 4 + Math.random() * 6);
                p.endFill();
                // Anchor to building — survives re-zoning
                p._bld = bld;
                p._offX = 10 + Math.random() * (bld.w - 20);
                p.x = bld.x + p._offX;
                p.y = gy - 20 - Math.random() * 30;
                p._speed = 0.15 + Math.random() * 0.2;
                p._phase = Math.random() * Math.PI * 2;
                p._resetY = gy - 10;
                charLayer.addChild(p);
                this.coolingFog.push(p);
            }
        });

        // ─── SERVER RACK LEDs (blinking indicators on building facades) ───
        const allBlds = BackboneZone.BLDS.map(d => BLDS.find(b => b.id === d.id)).filter(Boolean);
        allBlds.forEach(bld => {
            const floors = bld.fl || 3;
            const h = floors * 18 + 24;
            for (let li = 0; li < 12; li++) {
                const led = new PIXI.Graphics();
                const ledCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xef4444][Math.floor(Math.random() * 4)];
                led.beginFill(ledCol, 0.8);
                led.drawRect(0, 0, 2, 2);
                led.endFill();
                led._bld = bld;
                led._offX = 8 + Math.random() * (bld.w - 16);
                led.x = bld.x + led._offX;
                led.y = gy - 24 - h + 20 + Math.random() * (h - 40);
                led._phase = Math.random() * 200;
                led._rate = 30 + Math.random() * 80; // blink frequency
                charLayer.addChild(led);
                this.serverLEDs.push(led);
            }
        });
    },

    update() {
        if (!this._built) return;
        const fc = G.tick;

        // ─── Fiber pulses: travel along cables, reset when out of zone ───
        this.fiberPulses.forEach(p => {
            if (!p || p.destroyed) return;
            p.x += p._speed;
            p.y = p._baseY + Math.sin(fc * 0.02 + p._baseY) * 2;
            const margin = 400;
            if (p._speed > 0 && p.x > BackboneZone.zoneEndX + margin) {
                p.x = BackboneZone.zoneStartX - margin * 0.3;
            } else if (p._speed < 0 && p.x < BackboneZone.zoneStartX - margin) {
                p.x = BackboneZone.zoneEndX + margin * 0.3;
            }
            // Live IXP center — moves with zone
            const originX = p._ixpBld ? (p._ixpBld.x + p._ixpBld.w / 2) : 0;
            const distFromCenter = Math.abs(p.x - originX);
            p.alpha = distFromCenter < 100 ? 0.9 : Math.max(0.2, 0.9 - distFromCenter / 800);
        });

        // ─── Cooling fog: drift upward, sway (x tracks live building x) ───
        this.coolingFog.forEach(p => {
            if (!p || p.destroyed) return;
            p.y -= p._speed;
            const baseX = (p._bld ? p._bld.x : 0) + p._offX;
            p.x = baseX + Math.sin(fc * 0.015 + p._phase) * 8;
            p.alpha = Math.max(0, 0.12 - (p._resetY - p.y) * 0.001);
            if (p.y < p._resetY - 60) {
                p.y = p._resetY;
                p.alpha = 0.12;
            }
        });

        // ─── Server LEDs: stochastic blinking (re-anchor x to live building) ───
        this.serverLEDs.forEach(led => {
            if (!led || led.destroyed) return;
            if (led._bld) led.x = led._bld.x + led._offX;
            led.visible = ((fc + led._phase) % led._rate) < led._rate * 0.6;
        });
    },
};
