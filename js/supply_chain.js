/* ══════════════════════════════════════════════════════════════════════════
   SUPPLY CHAIN — ported from pixi/js/supply_chain.js.

   The Port already had ships and containers and the Compute District already
   had datacentres, but nothing connected them: the truck that drove between
   them was cosmetic and no building cared whether anything arrived.

   The loop, as in the 2D app:
     ships dock  →  stock rises  →  trucks haul it to the datacentres  →
     the datacentres burn it running training  →  if stock runs out the
     affected buildings brown out until a delivery lands.

   The part that makes it worth simulating is the last step. Shortage is
   visible on the buildings themselves — a starved datacentre dims toward
   amber and flickers — so you can stand in the Compute District and see that
   the GPU stock is gone without opening a panel.

   Stock levels are pure state and exported for the terminal panel; the
   rendering side only reads them.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { COMMODITIES } from './data.js';

/* Six tracked stocks, mapped onto the commodity ids the Port already lists.
   consume is units per in-game second at a nominal 10 operating datacentres;
   real draw scales with how many are actually running. */
const STOCKS = {
    gpu_rubin:   { label: 'Vera Rubin racks', cap: 300, start: 190, consume: 0.55, critical: true },
    gpu_b200:    { label: 'B200 accelerators', cap: 800, start: 520, consume: 1.10, critical: true },
    hbm_memory:  { label: 'HBM4 stacks',       cap: 700, start: 430, consume: 0.95, critical: true },
    coolant_sys: { label: 'Coolant loops',     cap: 400, start: 280, consume: 0.40, critical: false },
    helium:      { label: 'Helium',            cap: 600, start: 410, consume: 0.30, critical: false },
    electricity: { label: 'Grid capacity',     cap: 1000, start: 820, consume: 1.35, critical: true }
};

/** What a docking ship brings in. Ships arrive on a cycle in world.js. */
const MANIFESTS = [
    { gpu_b200: 150, hbm_memory: 120, coolant_sys: 40 },
    { gpu_rubin: 60, hbm_memory: 90, helium: 70 },
    { gpu_b200: 110, coolant_sys: 90, helium: 50 },
    { gpu_rubin: 45, gpu_b200: 80, hbm_memory: 60 }
];

const _c = new THREE.Color();
const _brown = new THREE.Color(0x6b4a1f);   // starved datacentre tint

export const SupplyChain = {
    stock: {},
    shortage: 0,          // 0 = fully stocked, 1 = empty across the board
    delivered: 0,
    trucks: [],

    init(scene) {
        this.scene = scene;
        for (const [k, s] of Object.entries(STOCKS)) this.stock[k] = { ...s, v: s.start };

        // Every datacentre and fab draws from the stock and shows the shortage.
        this.consumers = G.placements
            .filter(p => p.b && (p.b.type === 'datacenter' || p.b.type === 'fab'))
            .map(p => ({ b: p.b, x: p.x, z: p.z }));

        const port = G.bldById['port_warehouse'] || G.bldById['port_container'] || G.bldById['port_authority'];
        this.origin = port && Number.isFinite(port.worldX)
            ? { x: port.worldX, z: port.worldZ } : null;

        this._buildTrucks(scene);
        this._shipTimer = 18;
        this._truckTimer = 6;
    },

    /* One instanced box-truck mesh; individual hauls just move an instance.
       They drive the straight port→datacentre line rather than the road grid:
       traffic.js already owns road routing and this is a background detail. */
    _buildTrucks(scene) {
        const N = 5;
        const body = new THREE.BoxGeometry(52, 22, 22);
        body.translate(0, 15, 0);
        this._truckMesh = new THREE.InstancedMesh(body,
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 }), N);
        this._truckMesh.name = 'supplyTrucks';
        this._truckMesh.count = 0;
        scene.add(this._truckMesh);
        this._truckCap = N;
        this._dummy = new THREE.Object3D();
    },

    _spawnTruck() {
        if (!this.origin || !this.consumers.length) return;
        if (this.trucks.length >= this._truckCap) return;
        const dst = this.consumers[(Math.random() * this.consumers.length) | 0];
        // only haul what there is to haul
        const kinds = Object.keys(this.stock).filter(k => this.stock[k].v > this.stock[k].cap * 0.12);
        if (!kinds.length) return;
        const kind = kinds[(Math.random() * kinds.length) | 0];
        this.trucks.push({
            t: 0, dur: 26 + Math.random() * 14, kind,
            ax: this.origin.x, az: this.origin.z, bx: dst.x, bz: dst.z,
            col: kind.startsWith('gpu') ? 0x76b900 : kind === 'electricity' ? 0xfbbf24 : 0x38bdf8
        });
    },

    /** A ship docked: add its manifest to the stockpile. */
    deliver(manifest) {
        const m = manifest || MANIFESTS[(Math.random() * MANIFESTS.length) | 0];
        let any = 0;
        for (const [k, n] of Object.entries(m)) {
            const s = this.stock[k];
            if (!s) continue;
            const before = s.v;
            s.v = Math.min(s.cap, s.v + n);
            any += s.v - before;
        }
        if (any > 0) {
            this.delivered++;
            G.ui?.addToast?.(`📦 Shipment docked — ${Math.round(any)} units to the Compute District`, 'info');
        }
        return any;
    },

    update(dt) {
        if (!this.consumers) return;

        // ── consume: draw scales with how many datacentres are running ──
        const scale = Math.max(0.15, this.consumers.length / 10);
        for (const s of Object.values(this.stock)) {
            s.v = Math.max(0, s.v - s.consume * scale * dt);
        }
        // the grid trickles back on its own; silicon does not
        const e = this.stock.electricity;
        if (e) e.v = Math.min(e.cap, e.v + 1.05 * scale * dt);

        // ── ships: a delivery every so often, sooner if things are tight ──
        this._shipTimer -= dt * (1 + this.shortage);
        if (this._shipTimer <= 0) {
            this._shipTimer = 55 + Math.random() * 50;
            this.deliver();
        }

        // ── trucks ──
        this._truckTimer -= dt;
        if (this._truckTimer <= 0) {
            this._truckTimer = 7 + Math.random() * 9;
            this._spawnTruck();
        }
        this._stepTrucks(dt);

        // ── shortage severity, and what it does to the buildings ──
        /* A supply chain is as strong as its scarcest CRITICAL input. Averaging
           every stock hid real shortages: with accelerators at 17% but plenty
           of helium and grid, the mean still read "nominal" — and the whole
           point of simulating this is that an empty GPU stockpile is visible.
           Worst critical input dominates; the mean only softens it. */
        let worst = 1, mean = 0, n = 0;
        for (const s of Object.values(this.stock)) {
            const r = s.v / s.cap;
            if (s.critical) worst = Math.min(worst, r);
            mean += r; n++;
        }
        const health = 0.75 * worst + 0.25 * (n ? mean / n : 1);
        this.shortage = Math.max(0, Math.min(1, (0.5 - health) / 0.5));
        this._applyShortage();
    },

    _stepTrucks(dt) {
        const m = this._truckMesh;
        if (!m) return;
        const d = this._dummy;
        let live = 0;
        for (let i = this.trucks.length - 1; i >= 0; i--) {
            const t = this.trucks[i];
            t.t += dt;
            const k = t.t / t.dur;
            if (k >= 1) {
                // arrival tops the destination up a little — the haul mattered
                const s = this.stock[t.kind];
                if (s) s.v = Math.min(s.cap, s.v + 18);
                this.trucks.splice(i, 1);
                continue;
            }
            const x = t.ax + (t.bx - t.ax) * k;
            const z = t.az + (t.bz - t.az) * k;
            d.position.set(x, 0, z);
            d.rotation.set(0, Math.atan2(t.bx - t.ax, t.bz - t.az), 0);
            d.scale.setScalar(1);
            d.updateMatrix();
            m.setMatrixAt(live, d.matrix);
            m.setColorAt(live, _c.setHex(t.col));
            live++;
        }
        m.count = live;
        if (live) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        m.visible = live > 0 && !G.inside && !G.ridingMetro;
    },

    /* Brown out the starved buildings. Datacentres share instanced meshes with
       the rest of the city, so this reaches the individual instance colour
       recorded at build time rather than touching a material — otherwise a GPU
       shortage would dim every building in Singularity City. */
    _applyShortage() {
        const sev = this.shortage;
        if (sev < 0.02 && !this._wasDim) return;
        this._wasDim = sev >= 0.02;
        const flick = sev > 0.5
            ? 0.75 + Math.abs(Math.sin((G.time || 0) * 9)) * 0.25 : 1;
        const touched = new Set();
        const dim = (inst) => {
            if (!inst || !inst.mesh.instanceColor) return;
            _c.copy(inst.base).lerp(_brown, sev * 0.8).multiplyScalar(1 - sev * 0.35 * (2 - flick));
            inst.mesh.setColorAt(inst.i, _c);
            touched.add(inst.mesh);
        };
        for (const c of this.consumers) {
            dim(c.b._inst);        // the mass
            dim(c.b._capInst);     // and its parapet, or the roof stays lit
        }
        for (const mesh of touched) mesh.instanceColor.needsUpdate = true;
    },

    /** Live state for the terminal's Supply Chain panel. */
    snapshot() {
        const rows = Object.entries(this.stock).map(([k, s]) => ({
            id: k,
            label: s.label,
            pct: Math.round((s.v / s.cap) * 100),
            v: Math.round(s.v),
            cap: s.cap,
            critical: !!s.critical,
            commodity: COMMODITIES?.find(c => c.id === k) || null
        }));
        rows.sort((a, b) => a.pct - b.pct);
        return {
            shortage: +this.shortage.toFixed(2),
            status: this.shortage > 0.6 ? 'CRITICAL' : this.shortage > 0.25 ? 'TIGHT' : 'NOMINAL',
            deliveries: this.delivered,
            trucksRolling: this.trucks.length,
            consumers: this.consumers ? this.consumers.length : 0,
            rows
        };
    }
};
