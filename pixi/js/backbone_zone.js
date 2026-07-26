/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   THE BACKBONE — Network Infrastructure District (v1.0.0)
   Internet backbone hub for Singularity City. Where submarine cables surface, networks peer,
   satellites downlink, and every byte enters the city. Origin point for all data cables.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BackboneZone = {
    BLDS: [
        { id: 'backbone_landing', name: 'Cable Landing Station',      w: 180, fl: 3, emoji: '🌊', type: 'backbone',
          desc: 'Where Meta\'s Project Waterworth surfaces — the world\'s longest subsea cable, 50,000 km across five continents, built to move AI traffic. Armored fiber pairs enter the city in a vault 40 m below sea level.',
          milestone: 'Apr 2026: Meta unveiled Project Waterworth — 50,000 km (longer than Earth\'s circumference), the highest-capacity subsea system ever, driven by AI.',
          facts: ['Meta has joined 20+ subsea cable projects; AI is now the primary driver', '3 new oceanic corridors for high-speed AI connectivity', 'A single cut here can reroute a continent\'s traffic'] },
        { id: 'backbone_ixp',     name: 'Internet Exchange Point',    w: 200, fl: 4, emoji: '🔀', type: 'backbone',
          desc: 'Singularity City IX — where all networks peer. 800+ connected ASNs exchanging 12 Tbps peak. Increasingly this is AI-fabric territory: Nvidia Spectrum-X and NVLink Fusion knit GPU clusters into one system.',
          milestone: 'Mar 2026: Nvidia invested $2B in Marvell to extend NVLink Fusion — AI-factory fabric where compute, optics and Ethernet are engineered as one.',
          facts: ['800G links accelerating; 1.6T optical moving into real deployment', 'Spectrum-X switches + ConnectX NICs + BlueField DPUs form the AI fabric', '800+ autonomous systems peer here'] },
        { id: 'backbone_ground',  name: 'Satellite Ground Station',   w: 190, fl: 3, emoji: '📡', type: 'backbone',
          desc: 'Starlink, Kuiper and OneWeb downlink array. 48 steerable dishes tracking 4,000+ LEO satellites — and, since the SpaceX•xAI merger, the ground half of orbital AI data centers. Low-latency space internet becomes terrestrial fiber here.',
          milestone: 'LEO downlink is now dual-purpose: consumer broadband AND backhaul for the first orbital compute nodes overhead.',
          facts: ['Tracks 4,000+ low-Earth-orbit satellites across three constellations', 'Laser inter-sat links backhaul through Starlink to these dishes', 'Direct-to-cell service reaches phones with no tower in sight'] },
        { id: 'backbone_cdn',     name: 'CDN / Edge Node',            w: 160, fl: 5, emoji: '⚡', type: 'backbone',
          desc: 'Cloudflare, Akamai & Fastly edge presence. Caches ~40% of the city\'s web traffic locally and increasingly runs inference at the edge. DDoS mitigation filters 2M+ malicious requests per second.',
          milestone: 'Cloudflare\'s Interconnect Anywhere now reaches its network from 1,600+ locations — and its edge runs AI inference next to the user.',
          facts: ['Edge inference puts models milliseconds from the user', 'Filters 2M+ malicious requests/second, including AI-scraper floods', 'Caches ~40% of city web traffic locally'] },
        { id: 'backbone_noc',     name: 'Network Operations Center',  w: 220, fl: 6, emoji: '🖥️', type: 'backbone',
          desc: 'The 24/7 nerve center. Engineers watch every packet, route and BGP session across the AI backbone. War room activates during outages — and in 2026, a bad BGP day can stall a training run worth millions.',
          milestone: 'The top 5 hyperscalers will spend $600B+ on infrastructure in 2026 (~$450B on AI) — and every byte of it is watched from rooms like this.',
          facts: ['Monitors 985K+ BGP prefixes in the global routing table', 'AI-training traffic now shapes peak-hour capacity planning', 'A single fiber cut triggers an all-hands incident bridge'] },
    ],

    // Real orgs that actually run this infrastructure (shown in the panel roster).
    PLAYERS: [
        { name: 'Nvidia Networking', color: '#76b900', icon: '🟩', note: 'Spectrum-X + NVLink Fusion — the AI-cluster fabric; $2B into Marvell' },
        { name: 'Meta',              color: '#0866ff', icon: '🌊', note: 'Project Waterworth — the 50,000 km subsea cable built for AI' },
        { name: 'Cloudflare',        color: '#f6821f', icon: '⚡', note: 'Edge, DDoS mitigation + inference at 1,600+ interconnect points' },
        { name: 'Starlink',          color: '#22d3ee', icon: '📡', note: 'LEO downlink + laser backhaul for orbital compute' },
        { name: 'Arista / Broadcom', color: '#a855f7', icon: '🔀', note: '800G→1.6T switch silicon powering scale-out fabrics' },
        { name: 'Equinix',           color: '#ef4444', icon: '🏢', note: 'Carrier-neutral IX + interconnect real estate' },
    ],

    NPCS: [
        { id: 'npc_noc_lead',     name: 'NOC Lead',         role: 'Network Operations',     workplace: 'backbone_noc',     color: '#22d3ee', shift: 'night' },
        { id: 'npc_peering_mgr',  name: 'Peering Manager',  role: 'IX Peering Relations',   workplace: 'backbone_ixp',     color: '#4ade80', shift: 'day' },
        { id: 'npc_cable_tech',   name: 'Cable Technician', role: 'Submarine Fiber Ops',    workplace: 'backbone_landing', color: '#fbbf24', shift: 'day' },
        { id: 'npc_sat_ops',      name: 'Satellite Ops',    role: 'Ground Station Control', workplace: 'backbone_ground',  color: '#a855f7', shift: 'night' },
        { id: 'npc_cdn_eng',      name: 'CDN Engineer',     role: 'Edge Cache Operations',  workplace: 'backbone_cdn',     color: '#f97316', shift: 'day' },
        { id: 'npc_sre',          name: 'Site Reliability',  role: 'SRE / Incident Response', workplace: 'backbone_noc',   color: '#ef4444', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,
    networkStats: {
        trafficTbps: 12.4,
        peeringASNs: 847,
        activeSats: 4200,
        cacheHitRate: 94.2,
        avgLatencyMs: 3.1,
        bgpPrefixes: 985000,
        status: 'operational'
    },
    statusTicker: [],
    tickerIdx: 0,
    cloudStatus: [],     // live cloud provider incidents
    trafficTrend: 'up',  // up/down/stable from Cloudflare Radar

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type,
                    milestone: def.milestone, facts: def.facts,
                    _isBackbone: true
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Register NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }

        this._buildTicker();
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 50;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    _buildTicker() {
        this.statusTicker = [];

        // Reference stats
        this.statusTicker.push(`🔀 IX Peak: ${this.networkStats.trafficTbps} Tbps — ${this.networkStats.peeringASNs} ASNs peering`);
        this.statusTicker.push(`📡 ${this.networkStats.activeSats.toLocaleString()} LEO satellites tracked — Starlink, Kuiper, OneWeb`);
        this.statusTicker.push(`⚡ CDN cache hit rate: ${this.networkStats.cacheHitRate}% — ${this.networkStats.avgLatencyMs}ms avg latency`);
        this.statusTicker.push(`🌐 BGP routing table: ${(this.networkStats.bgpPrefixes / 1000).toFixed(0)}K prefixes active`);
        this.statusTicker.push('🔒 DDoS mitigation: 2.1M malicious req/s filtered by edge nodes');
        this.statusTicker.push('🌊 14 submarine cable pairs — 800 Tbps total trans-oceanic capacity');
        // Real 2026 backbone headlines
        this.statusTicker.push('🌊 Meta Project Waterworth: 50,000 km subsea cable across 5 continents, built for AI');
        this.statusTicker.push('🟩 Nvidia invests $2B in Marvell — NVLink Fusion extends the AI-factory fabric');
        this.statusTicker.push('⚡ Cloudflare Interconnect Anywhere reaches its network from 1,600+ locations');
        this.statusTicker.push('📈 800G links scaling · 1.6T optical moving from roadmap into real deployment');
        this.statusTicker.push('💰 Top-5 hyperscalers to spend $600B+ on infra in 2026 — ~75% on AI');

        // Live cloud status (if available)
        if (this.cloudStatus.length > 0) {
            this.cloudStatus.slice(0, 4).forEach(s => {
                const emoji = s.severity === 'major' ? '🔴' : s.severity === 'minor' ? '🟡' : '🟢';
                this.statusTicker.push(`${emoji} ${s.headline}`);
            });
        }

        // Shuffle
        for (let i = this.statusTicker.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.statusTicker[i], this.statusTicker[j]] = [this.statusTicker[j], this.statusTicker[i]];
        }
    },

    getNextTickerItem() {
        if (!this.statusTicker.length) return '';
        const item = this.statusTicker[this.tickerIdx % this.statusTicker.length];
        this.tickerIdx++;
        return item;
    },

    update() {
        // Slowly vary stats for visual interest
        if (G.tick % 300 === 0) {
            this.networkStats.trafficTbps = +(10 + Math.random() * 5).toFixed(1);
            this.networkStats.cacheHitRate = +(92 + Math.random() * 6).toFixed(1);
            this.networkStats.avgLatencyMs = +(2 + Math.random() * 3).toFixed(1);
            this.networkStats.activeSats = 4000 + Math.floor(Math.random() * 500);
        }
    }
};
