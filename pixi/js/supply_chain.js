/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SUPPLY CHAIN SIMULATION (v1.0.0)
   Connects Port → Data Centers with delivery trucks, inventory tracking, and shortage effects.
   Ships deliver commodities → inventory stockpile → trucks carry to DCs → DCs consume for training.
   When supply runs low, DC buildings show visual slowdown (flickering, dimmer windows).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SupplyChain = {

    // City-wide commodity inventory (units in stockpile)
    inventory: {
        gpu_h100:      { stock: 500, capacity: 1000, consumeRate: 0.8 },
        gpu_b200:      { stock: 300, capacity: 800,  consumeRate: 0.5 },
        helium:        { stock: 400, capacity: 600,  consumeRate: 0.3 },
        hbm_memory:    { stock: 350, capacity: 700,  consumeRate: 0.6 },
        coolant_sys:   { stock: 200, capacity: 400,  consumeRate: 0.2 },
        electricity:   { stock: 800, capacity: 1000, consumeRate: 1.2 },
    },

    _trucks: [],           // animated delivery sprites
    _truckLayer: null,
    _lastConsumeTick: 0,
    _lastDeliveryTick: 0,
    _shortageEffects: {},  // DC building ID → shortage severity (0-1)
    MAX_TRUCKS: 4,

    init(carLayer) {
        this._truckLayer = carLayer;
    },

    update() {
        if (!this._truckLayer) return;

        // ── CONSUME: DCs drain inventory every 120 ticks (~2 seconds) ──
        if (G.tick - this._lastConsumeTick >= 120) {
            this._consumeResources();
            this._lastConsumeTick = G.tick;
        }

        // ── DELIVER: Ships that dock add to inventory ──
        if (typeof PortZone !== 'undefined') {
            PortZone.ships.forEach(ship => {
                if (ship.state === 'docked' && !ship._delivered) {
                    this._deliverCargo(ship);
                    ship._delivered = true;
                }
                if (ship.state !== 'docked') {
                    ship._delivered = false;
                }
            });
        }

        // ── TRUCKS: Spawn delivery trucks when inventory is healthy ──
        if (G.tick - this._lastDeliveryTick >= 200 && this._trucks.length < this.MAX_TRUCKS) {
            this._spawnTruck();
            this._lastDeliveryTick = G.tick;
        }

        // ── ANIMATE TRUCKS ──
        for (let i = this._trucks.length - 1; i >= 0; i--) {
            const t = this._trucks[i];
            this._updateTruck(t, i);
        }

        // ── SHORTAGE VISUAL EFFECTS on DC buildings ──
        this._updateShortageEffects();
    },

    _consumeResources() {
        // Scale consumption by number of operational DCs
        let dcCount = 0;
        if (typeof DC_FACILITIES !== 'undefined') {
            dcCount = DC_FACILITIES.filter(dc => dc.status === 'operational').length;
        }
        if (dcCount === 0) dcCount = 5; // fallback

        const scale = dcCount / 10; // normalize to ~10 DCs
        for (const key in this.inventory) {
            const inv = this.inventory[key];
            inv.stock = Math.max(0, inv.stock - inv.consumeRate * scale);
        }
    },

    _deliverCargo(ship) {
        // Map ship cargo to inventory keys
        const cargoMap = {
            gpu_h100: 'gpu_h100',
            gpu_b200: 'gpu_b200',
            helium: 'helium',
            rare_earth: 'hbm_memory',  // rare earth → processed into HBM
        };
        const invKey = cargoMap[ship.cargo];
        if (invKey && this.inventory[invKey]) {
            const amount = 80 + Math.floor(Math.random() * 40);
            this.inventory[invKey].stock = Math.min(
                this.inventory[invKey].capacity,
                this.inventory[invKey].stock + amount
            );
        }
        // Also replenish electricity and coolant from any delivery
        if (this.inventory.electricity) {
            this.inventory.electricity.stock = Math.min(
                this.inventory.electricity.capacity,
                this.inventory.electricity.stock + 50
            );
        }
        if (this.inventory.coolant_sys) {
            this.inventory.coolant_sys.stock = Math.min(
                this.inventory.coolant_sys.capacity,
                this.inventory.coolant_sys.stock + 20
            );
        }
    },

    _spawnTruck() {
        // Find port warehouse and a random DC
        const warehouse = G.bldById['port_warehouse'];
        const dcBlds = BLDS ? BLDS.filter(b => b.id.startsWith('dc_') && b.x > 0) : [];
        if (!warehouse || dcBlds.length === 0) return;

        const targetDc = dcBlds[Math.floor(Math.random() * dcBlds.length)];
        const startX = warehouse.x + warehouse.w / 2;
        const endX = targetDc.x + targetDc.w / 2;

        // Pick cargo type for visual label
        const cargoTypes = ['gpu_h100', 'gpu_b200', 'hbm_memory', 'coolant_sys'];
        const cargo = cargoTypes[Math.floor(Math.random() * cargoTypes.length)];
        const comm = typeof PortZone !== 'undefined' ? PortZone.COMMODITIES.find(c => c.id === cargo) : null;

        const truck = this._createTruckSprite(comm);
        truck.x = startX;
        truck.y = G.groundY + 2;
        this._truckLayer.addChild(truck);

        this._trucks.push({
            sprite: truck,
            startX,
            endX,
            state: 'delivering', // delivering → returning → done
            speed: 0.8 + Math.random() * 0.4,
            cargo,
        });
    },

    _createTruckSprite(commodity) {
        const c = new PIXI.Container();
        const g = new PIXI.Graphics();

        // Layout: trailer on LEFT, cab on RIGHT → cab leads when moving right (scale.x=1)
        // Truck body/trailer
        g.beginFill(0x475569); g.drawRect(0, -20, 36, 20); g.endFill();
        // Cargo color stripe
        const cargoCol = commodity ? 0x4ade80 : 0xfbbf24;
        g.beginFill(cargoCol, 0.7); g.drawRect(1, -19, 34, 5); g.endFill();
        // Side rivets
        for (let ri = 0; ri < 4; ri++) {
            g.beginFill(0x5a6a7a, 0.5); g.drawCircle(6 + ri * 8, -7, 1); g.endFill();
        }
        // Truck cab (right side = front)
        g.beginFill(0x3b82f6); g.drawRoundedRect(36, -18, 16, 18, 2); g.endFill();
        // Windshield (on front face of cab)
        g.beginFill(0x88ccee, 0.7); g.drawRect(42, -16, 8, 7); g.endFill();
        // Exhaust pipe (behind trailer = left side)
        g.beginFill(0x3a3a4a); g.drawRect(-3, -6, 3, 6); g.endFill();
        // Wheels
        g.beginFill(0x1a1a2e); g.drawCircle(8, 2, 4); g.drawCircle(24, 2, 4); g.drawCircle(44, 2, 4); g.endFill();
        g.beginFill(0x555566); g.drawCircle(8, 2, 2); g.drawCircle(24, 2, 2); g.drawCircle(44, 2, 2); g.endFill();

        c.addChild(g);

        // Cargo label (emoji on trailer)
        const label = new PIXI.Text(commodity?.emoji || '📦', { fontSize: 12, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' });
        label.anchor.set(0.5, 0.5);
        label.x = 18; label.y = -10;
        c.addChild(label);

        // Tooltip on hover
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.on('pointerover', (e) => {
            const cargo = commodity ? commodity.name : 'GPU Shipment';
            if (typeof UI !== 'undefined') UI.showTooltip(e, '🚚 ' + cargo, 'Supply chain delivery in transit');
        });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        return c;
    },

    _updateTruck(truck, index) {
        if (truck.state === 'delivering') {
            const dir = truck.endX > truck.startX ? 1 : -1;
            truck.sprite.x += truck.speed * dir;
            truck.sprite.scale.x = dir;

            if ((dir > 0 && truck.sprite.x >= truck.endX) || (dir < 0 && truck.sprite.x <= truck.endX)) {
                truck.state = 'returning';
                // Deliver inventory boost to the target DC area
                const inv = this.inventory[truck.cargo];
                if (inv) inv.stock = Math.min(inv.capacity, inv.stock + 15);
            }
        } else if (truck.state === 'returning') {
            const dir = truck.startX > truck.sprite.x ? 1 : -1;
            truck.sprite.x += truck.speed * 0.6 * dir;
            truck.sprite.scale.x = dir;

            if (Math.abs(truck.sprite.x - truck.startX) < 5) {
                truck.state = 'done';
            }
        } else if (truck.state === 'done') {
            if (truck.sprite.parent) truck.sprite.parent.removeChild(truck.sprite);
            this._trucks.splice(index, 1);
        }
    },

    _updateShortageEffects() {
        // Calculate overall shortage severity (0 = fully stocked, 1 = empty)
        let totalRatio = 0;
        let count = 0;
        for (const key in this.inventory) {
            const inv = this.inventory[key];
            totalRatio += inv.stock / inv.capacity;
            count++;
        }
        const avgRatio = count > 0 ? totalRatio / count : 1;
        const shortage = Math.max(0, 1 - avgRatio); // 0 = fine, 1 = crisis

        // Apply visual effects to DC buildings
        if (BLDS) {
            BLDS.forEach(b => {
                if (!b.id.startsWith('dc_') && !b.id.startsWith('fab_')) return;
                if (!b._container || b._container.destroyed) return;

                // Store shortage level for other systems to read
                b._shortage = shortage;

                // Dim building alpha when shortage is high
                if (shortage > 0.3) {
                    const flicker = shortage > 0.6 ? Math.sin(G.tick * 0.1 + b.x) * 0.1 : 0;
                    b._container.alpha = Math.max(0.5, 1 - shortage * 0.4 + flicker);
                } else {
                    b._container.alpha = 1;
                }
            });
        }
    },

    // Get shortage level for UI/other systems
    getShortageLevel() {
        let totalRatio = 0;
        let count = 0;
        for (const key in this.inventory) {
            const inv = this.inventory[key];
            totalRatio += inv.stock / inv.capacity;
            count++;
        }
        return count > 0 ? Math.max(0, 1 - totalRatio / count) : 0;
    },

    // Get inventory summary for UI panels
    getInventorySummary() {
        const result = [];
        for (const key in this.inventory) {
            const inv = this.inventory[key];
            const pct = Math.round((inv.stock / inv.capacity) * 100);
            let status = 'OK';
            let color = '#4ade80';
            if (pct < 25) { status = 'CRITICAL'; color = '#ef4444'; }
            else if (pct < 50) { status = 'LOW'; color = '#f59e0b'; }
            else if (pct < 75) { status = 'MODERATE'; color = '#fbbf24'; }
            result.push({ id: key, stock: Math.round(inv.stock), capacity: inv.capacity, pct, status, color });
        }
        return result;
    }
};
