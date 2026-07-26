/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOTICS FACTORY ZONE (v1.0.0 — Physical AI Manufacturing District)
   Tesla Optimus, Figure, 1X, Boston Dynamics — assembly line, testing ground, deployment dock.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Each company carries real-world flavor used by the Testing Ground walkers, factory
// interiors, panels and tooltips: robot (flagship) / ceo / hq / founded / program /
// milestone (latest real headline) / facts[] (panel bullets). Keys match RobotModels.
const ROBOTICS_COMPANIES = {
    tesla: {
        name: 'Tesla', robot: 'Optimus V3', ceo: 'Elon Musk', color: '#e82127', icon: '🤖',
        hq: 'Fremont, California', founded: '2021 (program)',
        program: 'Mass-market humanoid on repurposed Model S/X line',
        milestone: 'V3 production starts at Fremont in summer 2026 — on the line freed up when Model S/X ended in May.',
        facts: [
            '10,000 unique parts on an all-new production line',
            'Fremont targets a 1M/yr run-rate; the Giga Texas line aims at 10M/yr',
            'Musk: initial output "quite slow… literally impossible to predict"'
        ],
        desc: 'The volume play. Optimus V3 enters production on Fremont\'s old Model S/X line, chasing a million units a year.'
    },
    figure: {
        name: 'Figure AI', robot: 'Figure 03', ceo: 'Brett Adcock', color: '#3b82f6', icon: '🦾',
        hq: 'San Jose, California', founded: '2022',
        program: 'BotQ high-volume manufacturing + Helix VLA brain',
        milestone: 'Mar 2026: BotQ hit ONE ROBOT PER HOUR — a 24× throughput jump in under 120 days, 350+ Figure 03s delivered.',
        facts: [
            'BotQ first-gen line: up to 12,000 humanoids/yr, 100k over 4 years',
            'End-of-line first-pass yield above 80%; battery line at 99.3%',
            'Helix vision-language-action model runs the robot end-to-end'
        ],
        desc: 'The manufacturing sprinter. BotQ went from one robot a day to one an hour, all driven by the in-house Helix AI.'
    },
    boston_dynamics: {
        name: 'Boston Dynamics', robot: 'Atlas', ceo: 'Robert Playter', color: '#f59e0b', icon: '🏃',
        hq: 'Waltham, Massachusetts', founded: '1992',
        program: 'Electric Atlas for Hyundai factories + DeepMind research',
        milestone: 'Jul 5, 2026: Atlas delivered the match ball at the FIFA World Cup Round of 16 (Brazil vs. Norway, East Rutherford, NJ) — Hyundai\'s first live robotics activation before a global audience.',
        facts: [
            'The all-electric Atlas debuted an upgrade at CES 2026',
            'Parent Hyundai puts Atlas to work in its own car plants first',
            '2026 Atlas fleets are fully allocated — Hyundai\'s Metaplant RMAC and Google DeepMind',
            '30+ years of legged robots: BigDog → Spot → Atlas'
        ],
        desc: 'The OG. Electric Atlas trades parkour fame for factory shifts at Hyundai — and a research fleet at Google DeepMind.'
    },
    agility: {
        name: 'Agility Robotics', robot: 'Digit', ceo: 'Peggy Johnson', color: '#14b8a6', icon: '📦',
        hq: 'Salem, Oregon', founded: '2015',
        program: 'RoboFab factory + warehouse Robots-as-a-Service',
        milestone: 'Jul 2, 2026: Agility agreed to go public via a $2.5B SPAC merger with Churchill Capital Corp XI (ticker AGLT), backed by a $200M Foxconn-led PIPE.',
        facts: [
            'Apr 2026: Digit was the only humanoid earning real revenue — 100,000+ totes moved at GXO warehouses',
            'Digit now runs at 9 customer sites (Schaeffler, GXO, Toyota, Mercado Libre) with 65,000+ operating hours',
            'RoboFab in Salem, OR was the first purpose-built humanoid factory',
            'The backwards "bird legs" are for reach + battery efficiency'
        ],
        desc: 'The revenue leader. While rivals demo, Digit clocks in — moving totes on paid contracts with its unmistakable bird legs.'
    },
    '1x': {
        name: '1X Technologies', robot: 'NEO', ceo: 'Bernt Børnich', color: '#d9c9a8', icon: '🧍',
        hq: 'Palo Alto + Moss, Norway', founded: '2014',
        program: 'Humanoid for the HOME — knit-suit NEO',
        milestone: '10,000 NEO pre-orders in the first five days; full-scale production started at Hayward, CA in Apr 2026.',
        facts: [
            '$20K Early Access or subscription; first homes served in 2026',
            'Hayward plant: 58,000 sq ft, scaling to 100k robots/yr by end-2027',
            'Soft knit suit + quiet tendon drives — designed to live with people'
        ],
        desc: 'The home robot. NEO wears a knit suit, whispers instead of whirs, and racked up 10,000 pre-orders in five days.'
    },
    apptronik: {
        name: 'Apptronik', robot: 'Apollo 2', ceo: 'Jeff Cardenas', color: '#ec4899', icon: '🌟',
        hq: 'Austin, Texas', founded: '2016',
        program: 'Apollo 2 + Google DeepMind Gemini Robotics data engine',
        milestone: 'Jun 30, 2026: Apollo 2 unveiled at the expanded Robot Park in Austin — in biped AND wheeled-base versions.',
        facts: [
            'Apollo data trains Google DeepMind\'s Gemini Robotics models',
            'Closed a $935M Series A; deployed with Mercedes-Benz',
            'Born from UT Austin\'s Human Centered Robotics Lab + NASA Valkyrie'
        ],
        desc: 'The DeepMind partner. Apollo 2 works Mercedes lines while its every move trains Gemini Robotics.'
    },
    unitree: {
        name: 'Unitree', robot: 'G1', ceo: 'Wang Xingxing', color: '#10b981', icon: '🥋',
        hq: 'Hangzhou, China', founded: '2016',
        program: 'Mass-market agile humanoids (G1/H2) + IPO run',
        milestone: 'Jul 2, 2026: China\'s CSRC granted final approval for Unitree\'s ~$619M Shanghai STAR Market IPO — a record-fast 73-day review — with a trading debut targeted for late Jul 2026.',
        facts: [
            'Feb 2026: a fleet of G1s performed a fully autonomous kung-fu routine on Chinese national TV',
            '5,500+ humanoids shipped in 2025 — volume leader; 10–20k targeted for 2026',
            'G1 starts around $16K — the price disruptor',
            'H2 pushes dynamic agility: flips, spins and recovery from shoves'
        ],
        desc: 'The volume disruptor. Kung-fu G1 fleets, $16K price tags and more humanoids shipped than anyone else.'
    },
    ubtech: {
        name: 'UBTech', robot: 'Walker S2', ceo: 'Zhou Jian', color: '#1d4ed8', icon: '🔋',
        hq: 'Shenzhen, China', founded: '2012',
        program: 'Industrial humanoids with autonomous battery hot-swap',
        milestone: 'Jul 2, 2026: Walker S2 went live at the China-Vietnam Fangchenggang border crossing under a ¥264M contract — patrols, cargo inspection, multilingual queue guidance.',
        facts: [
            'Walker S2 entered mass production with orders past ¥800M (~$112M) — hundreds delivered to factory lines',
            'Walker S2 swaps its own battery — 24/7 shifts, no humans needed',
            'Jun 30, 2026: unveiled UWORLD U1, the first mass-producible full-size consumer humanoid — 13,361+ orders already',
            'Deployed with BYD, Foxconn and Zeekr production lines'
        ],
        desc: 'The industrial workhorse. Walker S2 hot-swaps its own batteries mid-shift and has the largest humanoid order book in China.'
    }
};

const RoboticsZone = {
    BLDS: [
        { id: 'robotics_assembly',  name: 'Assembly Line',       w: 240, fl: 5, emoji: '🏭', type: 'robotics', desc: 'Modeled on Figure\'s BotQ and Tesla\'s Fremont line — the 2026 humanoid factories that went from one robot a day to one an hour. Chassis fab, motor integration, AI brain upload, calibration, and a finished-goods hall with all eight flagship humanoids.' },
        { id: 'robotics_testing',   name: 'Testing Ground',      w: 200, fl: 3, emoji: '🔬', type: 'robotics', desc: 'Walk tests, obstacle courses and endurance runs. All eight 2026 flagship humanoids pace the yard here — from Atlas to the kung-fu-trained Unitree G1.' },
        { id: 'robotics_deploy',    name: 'Deployment Dock',     w: 180, fl: 3, emoji: '🚛', type: 'robotics', desc: 'Where the robots clock in for real jobs: GXO warehouses, Hyundai and Mercedes plants, BYD lines — and, since NEO started shipping, people\'s living rooms.' },
        { id: 'robotics_rd',        name: 'R&D Lab',             w: 200, fl: 4, emoji: '🧠', type: 'robotics', desc: 'Next-gen actuators, sensors and embodied AI. The 2026 frontier: vision-language-action brains like Helix and Gemini Robotics, trained on live factory data.' },
    ],

    NPCS: [
        { id: 'npc_robo_engineer',   name: 'Robotics Engineer',   role: 'System Design',        workplace: 'robotics_assembly', color: '#ec4899', shift: 'day' },
        { id: 'npc_robo_mfg',        name: 'Manufacturing Tech',  role: 'Production Ops',       workplace: 'robotics_assembly', color: '#f97316', shift: 'day' },
        { id: 'npc_robo_welder',     name: 'Precision Welder',    role: 'Chassis Fabrication',   workplace: 'robotics_assembly', color: '#facc15', shift: 'day' },
        { id: 'npc_robo_tester',     name: 'Test Engineer',       role: 'QA Lead',               workplace: 'robotics_testing',  color: '#06b6d4', shift: 'day' },
        { id: 'npc_robo_calibrator', name: 'Calibration Tech',    role: 'Sensor Calibration',    workplace: 'robotics_testing',  color: '#22d3ee', shift: 'day' },
        { id: 'npc_robo_logistics',  name: 'Logistics Manager',   role: 'Shipping Coordinator',  workplace: 'robotics_deploy',   color: '#10b981', shift: 'day' },
        { id: 'npc_robo_researcher', name: 'AI Researcher',       role: 'Embodied Intelligence', workplace: 'robotics_rd',       color: '#8b5cf6', shift: 'day' },
        { id: 'npc_robo_intern',     name: 'Robotics Intern',     role: 'Junior Engineer',       workplace: 'robotics_rd',       color: '#a855f7', shift: 'day' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Production stats (visual flair)
    unitsProduced: 0,
    _prodRate: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

        // Inject buildings into global BLDS
        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type
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
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 45;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    update() {
        if (!this._inited) return;
        // Increment production counter during working hours
        const dp = G.getDayPhase();
        if (dp > 0.33 && dp < 0.75 && G.tick % 120 === 0) {
            this.unitsProduced++;
        }
    },

    getCompany(name) {
        const n = name.toLowerCase();
        for (const [key, co] of Object.entries(ROBOTICS_COMPANIES)) {
            if (n.includes(key) || n.includes(co.name.toLowerCase())) return co;
        }
        return null;
    }
};
