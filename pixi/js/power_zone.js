/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER GRID ZONE (v1.0.0)
   Utility district powering Singularity City. Located far right after Billionaire's Row.
   Solar, wind, nuclear, coal, and hydro — each with real MW output and cost/MWh.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PowerZone = {
    // Each source is modeled on a REAL 2026 AI-energy deal. The real-world fields
    // (operator/offtaker/deal/online/milestone/facts) feed the building info panel;
    // mw/costMWh keep driving the city-scale supply simulation.
    SOURCES: [
        { id: 'power_solar',   name: 'Solar + Storage',  emoji: '☀️', mw: 200, costMWh: 28,  type: 'renewable', w: 200, fl: 3,
          desc: 'Photovoltaic farm with grid-scale battery containers — the pattern hyperscalers now pair with every AI campus. Sun-tracking by day, batteries firming the evening ramp.',
          operator: 'Utility-scale IPP', offtaker: 'AI data-center PPAs', online: 'Operational',
          milestone: 'Solar+BESS became the fastest new power AI builders can buy — most of the 2026 US interconnection queue is exactly this.',
          facts: [
              'Batteries shift solar into the evening AI inference peak',
              'Fastest time-to-power of any new-build source (18–24 months)',
              'Tracking arrays follow the sun — watch the tilt change through the day'
          ],
          tip: '200 MW peak · $28/MWh · Renewable' },
        { id: 'power_wind',    name: 'SunZia Wind',      emoji: '💨', mw: 150, costMWh: 35,  type: 'renewable', w: 160, fl: 5,
          desc: 'Modeled on SunZia — the largest wind project in the Western Hemisphere, shipping New Mexico wind to Western data-center load over a purpose-built 550-mile HVDC line.',
          operator: 'Pattern Energy', offtaker: 'Western grid + tech PPAs', online: 'Operational 2026',
          milestone: 'SunZia: ~3.5 GW of wind + a dedicated 550-mile transmission line — proof that the grid, not the turbine, is the hard part.',
          facts: [
              'Largest wind + transmission project in the Western Hemisphere',
              'Output climbs when storms roll through the city — watch the blades',
              'New transmission is the #1 bottleneck for powering AI growth'
          ],
          tip: '150 MW peak · $35/MWh · Renewable' },
        { id: 'power_nuclear', name: 'Crane Clean Energy', emoji: '☢️', mw: 835, costMWh: 65, type: 'baseload',  w: 180, fl: 6,
          desc: 'Modeled on the Crane Clean Energy Center — Three Mile Island Unit 1, being restarted by Constellation with every megawatt sold to Microsoft for 20 years to power AI data centers.',
          operator: 'Constellation Energy', offtaker: 'Microsoft (20-yr PPA, 100%)', online: 'Restart on track for 2027',
          milestone: 'Jun 8, 2026: NRC released a draft environmental assessment finding no significant impact from the Crane/TMI Unit 1 restart — public comment ran through Jul 8, 2026, setting up a final NRC decision.',
          facts: [
              'First-ever restart of a retired US nuclear plant, driven entirely by AI demand',
              'Jun 2026: FERC granted the interconnection waiver keeping the restart on schedule',
              '835 MW · Microsoft buys 100% of output for 20 years',
              'TMI Unit 1 ran safely for 45 years; Unit 2 (the 1979 accident) stays sealed',
              '600+ permanent jobs return to the Susquehanna riverbank'
          ],
          tip: '835 MW constant · $65/MWh · Baseload' },
        { id: 'power_coal',    name: 'Gas Turbine Array', emoji: '🔥', mw: 420, costMWh: 95,  type: 'fossil',    w: 160, fl: 5,
          desc: 'Modeled on the turbines at xAI\'s Colossus in Memphis — dozens of mobile gas units thrown up faster than the grid could respond. Controversial, permit-challenged, and very 2026.',
          operator: 'On-site behind-the-meter', offtaker: 'Colossus-class AI campus', online: 'Operational (backup pledged)',
          milestone: 'Jul 2, 2026: Shelby County Health Dept. permitted 15 backup-only gas turbines with "state-of-the-art emissions controls" for xAI\'s Memphis site — NAACP immediately appealed; DOJ separately intervened in a parallel Mississippi Clean Air Act suit citing national security.',
          facts: [
              'Gas turbines = instant power while grid interconnects take years',
              'The Memphis fleet became the emblem of the AI power crunch',
              '2026: turbines doubled to ~35 units before the backup-only permit landed'
          ],
          tip: '420 MW constant · $95/MWh · Fossil' },
        { id: 'power_hydro',   name: 'Columbia Hydro',   emoji: '🌊', mw: 400, costMWh: 42,  type: 'renewable', w: 200, fl: 5,
          desc: 'Modeled on the Columbia River dams that made the Pacific Northwest a data-center mecca — the cheap, clean baseload that attracted Google to The Dalles two decades ago.',
          operator: 'Federal hydro system', offtaker: 'PNW data-center corridor', online: 'Operational since 1957',
          milestone: 'The original AI power play: Columbia River hydro is why hyperscale data centers colonized Oregon and Washington in the first place.',
          facts: [
              'Google\'s first hyperscale DC (The Dalles, 2006) sits on this hydro',
              'Clean, constant, and the cheapest baseload on the city grid',
              'New AI load now outstrips what the river can spare'
          ],
          tip: '400 MW constant · $42/MWh · Renewable' },
        { id: 'power_smr',     name: 'Hermes 2 SMR',     emoji: '⚛️', mw: 50,  costMWh: 90,  type: 'baseload',  w: 150, fl: 3,
          desc: 'Modeled on Kairos Power\'s Hermes 2 in Oak Ridge — the first Gen IV power reactor ever to get a US construction permit, feeding Google\'s Tennessee data centers via TVA.',
          operator: 'Kairos Power', offtaker: 'Google via TVA', online: 'Under construction · online 2030', status: 'construction',
          milestone: 'Apr 2026: Kairos broke ground on Hermes 2 — first power-producing Gen IV reactor with an NRC construction permit, 50 MW to TVA for Google.',
          facts: [
              'Google\'s master deal: up to 500 MW of Kairos SMRs by 2035',
              'Molten fluoride salt coolant + TRISO pebble fuel — walk-away safe',
              'Built small on purpose: factory-style reactor production is the goal'
          ],
          tip: '50 MW · under construction · online 2030' },
        { id: 'power_fusion',  name: 'Polaris Fusion',   emoji: '🌀', mw: 50,  costMWh: 120, type: 'experimental', w: 150, fl: 3,
          desc: 'Modeled on Helion\'s Polaris — the pulsed field-reversed fusion machine racing to deliver the world\'s first fusion PPA, sold to Microsoft before the plant even exists.',
          operator: 'Helion Energy', offtaker: 'Microsoft (world\'s 1st fusion PPA)', online: 'Polaris pulsing · grid power 2028',
          milestone: 'Jun 4, 2026: Helion raised a $465M Series G (led by Thrive Capital) at a $15.5B valuation — nearly triple its prior round — to fund Orion, the plant that owes Microsoft 50 MW by ~2028.',
          facts: [
              'World\'s first fusion power purchase agreement (Microsoft, 2023)',
              'Feb 2026: Polaris test reactor hit 150-million-°C plasma',
              'Pulsed machine — watch the output spike and fade with each shot',
              'Direct energy recovery: no steam turbines, magnets harvest the pulse',
              'Sam Altman is Helion\'s largest investor — AI paying for fusion'
          ],
          tip: '50 MW pulsed · $120/MWh · Experimental' }
    ],

    NPCS: [
        { id: 'npc_grid_ops',     name: 'Grid Operator',    role: 'Grid Operations',        workplace: 'power_nuclear', color: '#22d3ee', shift: 'day' },
        { id: 'npc_reactor_tech', name: 'Reactor Tech',     role: 'Crane CEC Restart Crew', workplace: 'power_nuclear', color: '#4ade80', shift: 'night' },
        { id: 'npc_solar_eng',    name: 'Solar Engineer',   role: 'PV + BESS Maintenance',  workplace: 'power_solar',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_turbine_tech', name: 'Turbine Tech',     role: 'Wind Turbine Engineer',  workplace: 'power_wind',    color: '#60a5fa', shift: 'day' },
        { id: 'npc_coal_foreman', name: 'Turbine Foreman',  role: 'Gas Genset Operations',  workplace: 'power_coal',    color: '#94a3b8', shift: 'night' },
        { id: 'npc_dam_keeper',   name: 'Dam Keeper',       role: 'Hydroelectric Ops',      workplace: 'power_hydro',   color: '#06b6d4', shift: 'day' },
        { id: 'npc_smr_eng',      name: 'SMR Engineer',     role: 'Hermes 2 Construction',  workplace: 'power_smr',     color: '#2dd4bf', shift: 'day' },
        { id: 'npc_plasma_phys',  name: 'Plasma Physicist', role: 'Polaris Pulse Ops',      workplace: 'power_fusion',  color: '#c084fc', shift: 'night' }
    ],

    _inited: false,
    gridSupply: 0,
    gridDemand: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.SOURCES.forEach(src => {
            if (!BLDS.find(b => b.id === src.id)) {
                const bld = { id: src.id, name: src.name, w: src.w, x: 0, fl: src.fl, emoji: src.emoji, lab: null, desc: src.desc, _isPower: true, _powerSrc: src };
                BLDS.push(bld); G.bldById[src.id] = bld;
            }
        });
        // Register power NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }
    },

    positionZone(afterX) {
        let x = afterX + 80;
        // Transmission pylons gap
        const pylonStartX = x; x += 120;
        this.SOURCES.forEach(src => {
            const bld = BLDS.find(b => b.id === src.id);
            if (bld) { bld.x = x; x += bld.w + 60; }
        });
        this.zoneStartX = pylonStartX;
        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    // Calculate live power output (solar varies by time, wind by weather)
    getOutput(srcId) {
        const src = this.SOURCES.find(s => s.id === srcId);
        if (!src) return 0;
        if (srcId === 'power_solar') {
            const dp = G.getDayPhase();
            if (dp < 0.25 || dp > 0.83) return 0; // Night
            const dayProgress = (dp - 0.25) / (0.83 - 0.25);
            // Weather derate: clouds, fog, and storms choke photovoltaic output.
            const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            const wDerate = w === 'thunderstorm' ? 0.15
                : w === 'overcast' ? 0.35
                : (w === 'rain' || w === 'snow') ? 0.50
                : w === 'drizzle' ? 0.65
                : w === 'fog' ? 0.45
                : w === 'partly_cloudy' ? 0.80
                : w === 'sandstorm' ? 0.30
                : 1.0;
            return Math.round(src.mw * Math.sin(dayProgress * Math.PI) * wDerate);
        }
        if (srcId === 'power_wind') {
            const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            // Wind output: stronger during storms, weaker during fog/calm.
            const mult = w === 'thunderstorm' ? 1.8
                : (w === 'rain' || w === 'drizzle') ? 1.4
                : w === 'snow' ? 1.2
                : w === 'sandstorm' ? 1.6
                : w === 'overcast' ? 0.9
                : w === 'partly_cloudy' ? 0.75
                : w === 'fog' ? 0.35
                : 0.6;
            return Math.round(src.mw * mult);
        }
        if (src.status === 'construction') return 0; // Hermes 2 — online 2030
        if (srcId === 'power_fusion') {
            // Polaris is a PULSED machine — output spikes with each shot, then fades.
            const pulse = Math.max(0, Math.sin(G.tick * 0.01));
            return Math.round(src.mw * pulse * pulse);
        }
        return src.mw; // Nuclear, gas, hydro = constant
    },

    getTotalSupply() {
        return this.SOURCES.reduce((sum, s) => sum + this.getOutput(s.id), 0);
    },

    getTotalDemand() {
        let dcDemand = 0;
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => { if (dc.power_mw) dcDemand += dc.power_mw; });
        }
        const cityBase = 200; // Metro, streetlights, buildings
        return dcDemand + cityBase;
    },

    update() {
        this.gridSupply = this.getTotalSupply();
        this.gridDemand = this.getTotalDemand();
    }
};
