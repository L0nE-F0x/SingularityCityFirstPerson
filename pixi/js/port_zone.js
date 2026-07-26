/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PORT / TRADE ZONE (v1.0.0)
   Harbor district representing the global AI supply chain.
   Container ships deliver critical resources for the race to AGI.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PortZone = {
    COMMODITIES: [
        { id: 'gpu_rubin',      name: 'NVIDIA Vera Rubin',    emoji: '🖥️', unit: 'rack',  category: 'compute',     desc: 'Launched at CES Jan 2026 — six new chips, full production, shipping to AWS/Google/Microsoft/OCI in H2 2026.' },
        { id: 'gpu_b200',       name: 'NVIDIA B200',          emoji: '🖥️', unit: 'unit',  category: 'compute',     desc: 'Blackwell workhorse for trillion-parameter models — still the volume shipper while Rubin ramps.' },
        { id: 'gpu_h100',       name: 'NVIDIA H100 80GB',     emoji: '🖥️', unit: 'unit',  category: 'compute',     desc: 'The 2023 legend, now trading second-hand as clusters upgrade to Blackwell and Rubin.' },
        { id: 'euv_scanner',    name: 'High-NA EUV (EXE:5200)', emoji: '🔬', unit: 'machine', category: 'fabrication', desc: 'ASML\'s $380M lithography monster — ~250 crates per machine. Only ~10 ship worldwide in 2026; Intel & Samsung lead, TSMC waits till 2029.' },
        { id: 'hbm_memory',     name: 'HBM4 Memory',          emoji: '🧠', unit: 'stack', category: 'compute',     desc: 'Mass production began Feb 2026. SK Hynix supplies ~2/3 of NVIDIA\'s HBM4; a 12-high stack clears $600.' },
        { id: 'silicon_wafer',  name: 'N2 Wafers (300mm)',    emoji: '💿', unit: 'wafer', category: 'fabrication', desc: 'TSMC\'s 2nm node hit volume production Q4 2025 — capacity growing 70%/yr through 2028.' },
        { id: 'helium',         name: 'Liquid Helium',        emoji: '💨', unit: 'L',     category: 'cooling',     desc: 'Cryogenic coolant for EUV lithography and quantum systems.' },
        { id: 'rare_earth',     name: 'Rare Earth (Nd/Ga)',   emoji: '⛏️', unit: 'kg',    category: 'materials',   desc: 'Neodymium & gallium — China\'s export-license counter-move in the chip war.' },
        { id: 'power_xfmr',     name: 'Power Transformers',   emoji: '⚡', unit: 'unit',  category: 'power',       desc: 'High-voltage transformers — 3-year lead times, the sleeper bottleneck of the DC buildout.' },
        { id: 'fiber_optic',    name: 'Fiber Optic Cable',    emoji: '📡', unit: 'km',    category: 'network',     desc: 'Submarine & terrestrial fiber for inter-DC networking.' },
        { id: 'coolant_sys',    name: 'Liquid Cooling Systems', emoji: '🧊', unit: 'unit', category: 'cooling',    desc: 'Direct-to-chip liquid cooling — mandatory at Rubin-class rack densities.' },
        { id: 'server_rack',    name: 'Server Rack Chassis',  emoji: '🏗️', unit: 'unit',  category: 'infra',       desc: 'Open Compute Project rack frames for hyperscale DCs.' },
        { id: 'copper',         name: 'Copper (Grade A)',     emoji: '🔶', unit: 'tonne', category: 'materials',   desc: 'Essential conductor for power distribution and PCBs.' },
        { id: 'electricity',    name: 'Electricity (Ind.)',   emoji: '🔌', unit: 'MWh',   category: 'power',       desc: 'Industrial electricity — the largest ongoing cost of AGI.' }
    ],

    // Live price cache (loaded from Supabase or fallback)
    prices: {},
    ships: [],
    buildings: [],
    _inited: false,

    init() {
        if (this._inited) return;
        this._inited = true;

        // Ensure port buildings exist in BLDS — each carries real 2026 supply-chain
        // flavor (milestone + facts) that feeds the building info panel.
        const portBlds = [
            { id: 'port_authority', name: 'Port Authority',  w: 140, fl: 3, emoji: '⚓', desc: 'Singularity City harbor master. Tracks every EUV crate, HBM pallet and GPU rack crossing the quay.',
              milestone: 'The AI supply chain now moves more value per container than any cargo in maritime history — one EUV shipment outprices a fleet of car carriers.',
              facts: [
                  'A single High-NA EUV machine ships as ~250 crates on multiple aircraft & vessels',
                  'GPU racks ride as air freight when clusters slip schedule — sea freight when they don\'t',
                  'Harbor radar tracks 5 inbound supply vessels on rotation'
              ] },
            { id: 'port_customs',   name: 'Export Control Office', w: 110, fl: 2, emoji: '🛃', desc: 'Where the chip war gets bureaucratic. Licenses, end-user checks and tariff stamps for every advanced-node shipment.',
              milestone: 'Jul 2, 2026: Nvidia\'s CEO conceded China\'s AI-chip market to Huawei after booking zero China data-center revenue — the H200 export approval is a dead letter, blocked by Beijing rather than Washington.',
              facts: [
                  'Jan 2026: Washington moved H200-to-China sales to case-by-case review — a 50% volume cap and a 25% tariff; not one chip has actually shipped',
                  '~10 Chinese firms cleared for H200s at 75,000 units each — all stuck in legal limbo',
                  'Jun 2026: US says the ban follows Chinese firms even OUTSIDE China',
                  'China counters with gallium & rare-earth export licenses'
              ] },
            { id: 'port_warehouse', name: 'GPU Warehouse',   w: 180, fl: 2, emoji: '📦', desc: 'Bonded warehouse holding Vera Rubin racks and Blackwell pallets awaiting deployment to the Compute District.',
              milestone: 'NVIDIA\'s Rubin platform went full production after its CES 2026 launch — first racks land at AWS, Google, Microsoft and OCI in H2 2026.',
              facts: [
                  'One Rubin-class rack outvalues its own delivery truck ~20×',
                  'Insurance won\'t cover a full warehouse — contents rotate out within 72 hours',
                  'H100s now leave through the side door: the second-hand market'
              ] },
            { id: 'port_container', name: 'Container Terminal', w: 160, fl: 1, emoji: '🧱', desc: 'Stacked steel from Kaohsiung, Busan, Rotterdam and Phoenix. The reach stacker never sleeps.',
              milestone: 'Feb 2026: HBM4 mass production began at SK Hynix and Samsung simultaneously — the single most fought-over cargo on this yard.',
              facts: [
                  'SK Hynix ships ~2/3 of NVIDIA\'s HBM4 — from Icheon via Busan',
                  'TSMC Arizona wafers now flow BOTH ways across the Pacific',
                  'A 12-high HBM4 stack clears $600 — a pallet is a house'
              ] },
            { id: 'port_fuel',      name: 'Fuel & Gas Depot', w: 120, fl: 1, emoji: '⛽', desc: 'Cryogenic helium spheres and diesel reserves. EUV lithography drinks liquid helium; backup gensets drink everything else.',
              milestone: 'Helium stays on the critical list — every EUV scanner at every fab needs an unbroken cryogenic supply chain.',
              facts: [
                  'Liquid helium boils at −269 °C — 4 degrees above absolute zero',
                  'One helium supply hiccup can idle a $380M scanner',
                  'Diesel here backstops the data centers the grid can\'t yet feed'
              ] },
            { id: 'port_crane',     name: 'Cargo Crane',      w: 80,  fl: 1, emoji: '🏗️', desc: 'Ship-to-shore gantry crane. Rated 40 lifts/hour — handled with extreme care when the manifest says lithography.',
              milestone: 'The white-glove lift: EUV crates move at half speed, double riggers, zero wind tolerance.',
              facts: [
                  'A dropped container of HBM4 is an eight-figure insurance claim',
                  'Operators call GPU racks "eggs" on the radio',
                  'Boom clearance sized for the largest container ships afloat'
              ] }
        ];
        portBlds.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { id: def.id, name: def.name, w: def.w, x: 0, fl: def.fl, emoji: def.emoji, lab: null, desc: def.desc, _isPort: true, milestone: def.milestone, facts: def.facts };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Ships spawned after positioning (in positionZone)
        this.loadPrices();
    },

    // Position port zone to the LEFT of Space Zone
    positionZone(spaceLeftX) {
        const portBlds = BLDS.filter(b => b._isPort || b.id.startsWith('port_'));
        let px = spaceLeftX - 200;
        const reversed = [...portBlds].reverse();
        reversed.forEach(b => {
            px -= b.w + 40;
            b.x = px;
        });
        const leftmost = portBlds.reduce((min, b) => b.x < min ? b.x : min, Infinity);
        this.oceanStartX = leftmost - 600;
        this.oceanEndX = leftmost;
        this.coastlineX = leftmost - 40;
        
        // Spawn ships now that we know ocean coordinates
        if (!this.ships.length) this._spawnShips();
        
        return this.oceanStartX;
    },

    _spawnShips() {
        // 5 supply vessels on rotation — each carrying REAL 2026 chip-war cargo.
        // `special: 'euv'` draws a single white-glove ASML crate instead of container rows.
        const shipCargos = [
            { cargo: 'gpu_rubin',  label: 'MV VERA RUBIN',     color: 0x76b900, flag: '🇹🇼', origin: 'Kaohsiung, Taiwan',
              story: 'Rubin racks fresh off TSMC N2 + CoWoS — full production since CES 2026' },
            { cargo: 'euv_scanner', label: 'MV VELDHOVEN STAR', color: 0x1d4ed8, flag: '🇳🇱', origin: 'Rotterdam, Netherlands', special: 'euv',
              story: 'ONE High-NA EUV scanner aboard: $380M, ~250 crates, armed escort to the fab' },
            { cargo: 'hbm_memory', label: 'MV ICHEON EXPRESS', color: 0xf59e0b, flag: '🇰🇷', origin: 'Busan, South Korea',
              story: 'HBM4 stacks from SK Hynix — the memory 2/3 of NVIDIA\'s Rubin fleet depends on' },
            { cargo: 'silicon_wafer', label: 'MV GIGAFAB ARIZONA', color: 0xef4444, flag: '🇺🇸', origin: 'Phoenix ↔ Hsinchu',
              story: 'N2 wafer lots — TSMC\'s Arizona GigaFab now ships both directions across the Pacific' },
            { cargo: 'rare_earth', label: 'MV MINERAL KING',   color: 0xa855f7, flag: '🇲🇾', origin: 'Penang, Malaysia',
              story: 'Gallium & neodymium routed through third countries — the chip war\'s other front' }
        ];
        shipCargos.forEach((sc, i) => {
            this.ships.push({
                ...sc, x: -100 - i * 400,
                state: i === 0 ? 'sailing_in' : 'waiting', dir: 1,
                dockX: 0, // set during positioning
                speed: 0.3 + Math.random() * 0.2,
                dockTimer: 0,
                bobPhase: Math.random() * Math.PI * 2
            });
        });
    },

    async loadPrices() {
        // Fallback estimates load FIRST so every commodity always has a price;
        // Supabase rows then overwrite whatever the live table actually tracks.
        // (New commodities like euv_scanner/gpu_rubin stay on fallback until the
        // DB grows matching rows.)
        this._loadFallbackPrices();
        if (typeof API !== 'undefined' && API.supabase) {
            try {
                const { data, error } = await API.supabase.from('port_commodities').select('*');
                if (!error && data && data.length > 0) {
                    data.forEach(row => {
                        this.prices[row.id] = {
                            price: row.price, currency: row.currency || 'USD',
                            change_pct: row.change_pct || 0, updated: row.updated_at,
                            supply_status: row.supply_status || 'stable'
                        };
                    });
                }
            } catch (e) { /* fallback prices already in place */ }
        }
    },

    _loadFallbackPrices() {
        // Estimated prices (2026-Q2 market)
        this.prices = {
            gpu_rubin:     { price: 3200000, currency: 'USD', change_pct: 0.0,   supply_status: 'scarce',   updated: '2026-Q2' },
            gpu_b200:      { price: 42000,   currency: 'USD', change_pct: -4.8,  supply_status: 'tight',    updated: '2026-Q2' },
            gpu_h100:      { price: 21000,   currency: 'USD', change_pct: -18.5, supply_status: 'surplus',  updated: '2026-Q2' },
            euv_scanner:   { price: 380000000, currency: 'USD', change_pct: 8.6, supply_status: 'critical', updated: '2026-Q2' },
            hbm_memory:    { price: 650,     currency: 'USD', change_pct: 31.0,  supply_status: 'critical', updated: '2026-Q2' },
            silicon_wafer: { price: 165,     currency: 'USD', change_pct: 9.4,   supply_status: 'tight',    updated: '2026-Q2' },
            helium:        { price: 38,      currency: 'USD', change_pct: 12.1,  supply_status: 'critical', updated: '2026-Q2' },
            rare_earth:    { price: 445,     currency: 'USD', change_pct: 24.3,  supply_status: 'scarce',   updated: '2026-Q2' },
            power_xfmr:    { price: 92000,   currency: 'USD', change_pct: 11.7,  supply_status: 'tight',    updated: '2026-Q2' },
            fiber_optic:   { price: 1150,    currency: 'USD', change_pct: -1.3,  supply_status: 'stable',   updated: '2026-Q2' },
            coolant_sys:   { price: 5200,    currency: 'USD', change_pct: 15.2,  supply_status: 'tight',    updated: '2026-Q2' },
            server_rack:   { price: 2350,    currency: 'USD', change_pct: 3.8,   supply_status: 'stable',   updated: '2026-Q2' },
            copper:        { price: 10400,   currency: 'USD', change_pct: 7.2,   supply_status: 'tight',    updated: '2026-Q2' },
            electricity:   { price: 74,      currency: 'USD', change_pct: 8.8,   supply_status: 'tight',    updated: '2026-Q2' }
        };
    },

    update() {
        if (!this.ships.length) return;
        const craneBld = BLDS.find(b => b.id === 'port_crane');
        const warehouseBld = BLDS.find(b => b.id === 'port_warehouse');
        const baseDockX = craneBld ? craneBld.x - 20 : (warehouseBld ? warehouseBld.x + warehouseBld.w / 2 : 300);

        this.ships.forEach((ship, si) => {
            // Each ship docks further left (under crane, then warehouse area)
            ship.dockX = baseDockX - si * 180;
            
            // Staggered arrival: ship can only sail in if previous ship has docked or left
            const prevShip = si > 0 ? this.ships[si - 1] : null;
            const canSail = !prevShip || prevShip.state === 'docked' || prevShip.state === 'sailing_out' || (prevShip.x > ship.dockX + 200);

            if (ship.state === 'waiting') {
                // Waiting offshore for slot
                if (canSail) ship.state = 'sailing_in';
            } else if (ship.state === 'sailing_in') {
                ship.x += ship.speed;
                ship.dir = 1; // facing right
                if (ship.x >= ship.dockX) { 
                    ship.state = 'docked'; 
                    ship.dockTimer = 800 + Math.random() * 400;
                    ship.x = ship.dockX;
                }
            } else if (ship.state === 'docked') {
                ship.x = ship.dockX;
                ship.dir = 1;
                ship.dockTimer--;
                if (ship.dockTimer <= 0) ship.state = 'sailing_out';
            } else if (ship.state === 'sailing_out') {
                ship.x -= ship.speed * 0.8;
                ship.dir = -1; // facing left (departing)
                if (ship.x < -400) {
                    ship.state = 'waiting';
                    ship.x = -200 - Math.random() * 200;
                    ship.dir = 1;
                }
            }
        });
    },

    // Format price for display
    fmtPrice(id) {
        const p = this.prices[id];
        if (!p) return '—';
        const val = p.price >= 1e6 ? `$${(p.price/1e6).toFixed(p.price >= 1e8 ? 0 : 1)}M` : p.price >= 10000 ? `$${(p.price/1000).toFixed(1)}K` : p.price >= 1000 ? `$${p.price.toLocaleString()}` : `$${p.price}`;
        const arrow = p.change_pct > 0 ? '▲' : p.change_pct < 0 ? '▼' : '—';
        const col = p.change_pct > 10 ? '#ef4444' : p.change_pct > 0 ? '#f59e0b' : p.change_pct < -5 ? '#4ade80' : '#94a3b8';
        return `${val} <span style="color:${col}">${arrow} ${Math.abs(p.change_pct).toFixed(1)}%</span>`;
    },

    supplyColor(id) {
        const s = this.prices[id]?.supply_status;
        if (s === 'critical') return '#ef4444';
        if (s === 'scarce') return '#f59e0b';
        if (s === 'tight') return '#fbbf24';
        return '#4ade80';
    },

    supplyLabel(id) {
        return (this.prices[id]?.supply_status || 'unknown').toUpperCase();
    }
};
