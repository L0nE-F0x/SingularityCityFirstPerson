/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE DATA LAYER (v1.0.0 — Compute in Space: Phase 1)
   Defines space organizations, launch facilities, and real-time launch API integration.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Each org carries real-world flavor used by exteriors, interiors, panels and tooltips:
//   hq / founded / vehicle (flagship) / program (orbital-compute angle) /
//   milestone (latest real headline) / facts[] (panel bullets)
const SPACE_ORGS = {
    spacex: {
        name: 'SpaceX • xAI', ceo: 'Elon Musk', color: '#0033a0', icon: '🚀', region: 'us',
        hq: 'Starbase, Texas', founded: '2002 · merged with xAI Jan 2026', vehicle: 'Starship V3',
        program: 'AI1 orbital data-center constellation',
        milestone: 'Jan 2026: SpaceX acquired xAI in a $1.25T deal — the largest private merger in history — to put AI compute in orbit.',
        facts: [
            'AI1 satellite: 70 m solar wingspan (wider than a 747-8), ~120–150 kW of compute per node',
            'FCC filing seeks up to 1,000,000 orbital data-center sats at 500–2,000 km altitude',
            '100 Gbps laser inter-sat links, backhauled through Starlink; robot arms do on-orbit repair',
            'Starship V3 first flew May 22, 2026 (Flight 12); constellation roll-out slated for 2028'
        ],
        desc: 'The merged rocket + AI giant. Starship lifts Colossus-class GPU racks into orbit as the AI1 data-center constellation.'
    },
    blue_origin: {
        name: 'Blue Origin', ceo: 'Dave Limp', color: '#0077c8', icon: '🪶', region: 'us',
        hq: 'Kent, Washington', founded: '2000', vehicle: 'New Glenn',
        program: 'Blue Moon lunar cargo + orbital infrastructure',
        milestone: 'Jul 6, 2026: Blue Origin cleared all LC-36 debris in 9 days and began rebuilding the pad in a horizontal/vertical hybrid config — CEO Dave Limp reaffirmed New Glenn will fly again before year-end 2026.',
        facts: [
            'Nov 13, 2025: became the 2nd company ever to land an orbital-class booster (at sea, 375 mi offshore)',
            'May 28, 2026: a New Glenn was lost in a static-fire anomaly that damaged LC-36 — now rebuilding under a hybrid config',
            'Blue Moon MK1 "Endurance" finished NASA vacuum-chamber testing, awaiting its lunar debut',
            'Its BE-4 methalox engines also power ULA\'s Vulcan Centaur'
        ],
        desc: 'Gradatim Ferociter. New Glenn heavy-lift, sea-landing boosters and the Blue Moon lunar lander program.'
    },
    nasa: {
        name: 'NASA', ceo: 'Sean Duffy (acting)', color: '#fc3d21', icon: '🛸', region: 'us',
        hq: 'Washington, D.C.', founded: '1958', vehicle: 'SLS Block 1',
        program: 'Artemis lunar campaign + Deep Space Network',
        milestone: 'Apr 10, 2026: Artemis II crew (Wiseman, Glover, Koch, Hansen) splashed down after a 10-day trip around the Moon.',
        facts: [
            'Artemis II was the first crewed lunar flyby since Apollo 17 in 1972',
            'Artemis III targets a 2027 crewed rendezvous test; lunar landing to follow on commercial landers',
            'SLS is the most powerful operational rocket NASA has ever flown at 8.8M lbf liftoff thrust',
            'The Deep Space Network relays data for every interplanetary probe currently flying'
        ],
        desc: 'America\'s space agency. Fresh off Artemis II\'s crewed Moon flyby, relaying deep-space data for the whole industry.'
    },
    cnsa: {
        name: 'CNSA', ceo: 'Shan Zhongde', color: '#de2910', icon: '🇨🇳', region: 'cn',
        hq: 'Beijing', founded: '1993', vehicle: 'Long March 10',
        program: 'Crewed Moon landing before 2030 + Tiangong station',
        milestone: 'Feb 11, 2026: Long March 10A test stage flew the Mengzhou crew capsule\'s launch-escape demo — booster fished out of the South China Sea.',
        facts: [
            'May 24, 2026: Shenzhou-23 crew launched to Tiangong on a year-long expedition',
            'Long March 10 is the tri-core Moon rocket for the pre-2030 crewed lunar landing',
            'Mengzhou capsule + Lanyue lander passed integrated tests in early 2026',
            'A reusable 5 m Long March 10A derivative is slated to debut in 2026'
        ],
        desc: 'China National Space Administration. Racing toward a pre-2030 crewed Moon landing with Long March 10 and Mengzhou.'
    },
    esa: {
        name: 'ESA', ceo: 'Josef Aschbacher', color: '#003399', icon: '🇪🇺', region: 'eu',
        hq: 'Paris, France', founded: '1975', vehicle: 'Ariane 64',
        program: 'Sovereign European launch + Copernicus Earth AI',
        milestone: 'Apr 30, 2026: Ariane 6 flew its most powerful 4-booster configuration, lofting 32 Amazon Leo broadband satellites.',
        facts: [
            'Two 32-sat Amazon Leo batches delivered in 2026 (Feb 12 and Apr 30)',
            'Up to 8 Ariane 6 launches planned for 2026 from Kourou, French Guiana',
            'Next up: MTG-I2 weather satellite in Aug 2026',
            '23 member states fund Europe\'s independent access to space'
        ],
        desc: 'European Space Agency. Ariane 64 is Europe\'s heavy-lift workhorse, now hauling mega-constellation batches from Kourou.'
    },
    ula: {
        name: 'ULA', ceo: 'Tory Bruno', color: '#1a1a2e', icon: '⚡', region: 'us',
        hq: 'Centennial, Colorado', founded: '2006', vehicle: 'Vulcan Centaur',
        program: 'National-security heavy lift (USSF)',
        milestone: 'Jul 2, 2026: ULA flew its final-ever Atlas V (Amazon Leo satellites) — closing a 100% mission-success run — while Vulcan stays grounded pending the Feb 2026 booster investigation.',
        facts: [
            'Targeting 18–22 launches in 2026 once Vulcan resumes — its highest cadence ever',
            'Vulcan is powered by two Blue Origin BE-4 methalox engines',
            'A Feb 2026 solid-booster anomaly paused Vulcan flights pending investigation',
            '100% mission success record across Atlas, Delta and Vulcan'
        ],
        desc: 'United Launch Alliance. Vulcan Centaur hauls national-security payloads direct to GEO with a perfect success record.'
    },
    rocketlab: {
        name: 'Rocket Lab', ceo: 'Peter Beck', color: '#00b4d8', icon: '🌙', region: 'us',
        hq: 'Long Beach, California', founded: '2006', vehicle: 'Electron / Neutron',
        program: 'Dedicated smallsat launch + Neutron reusable medium-lift',
        milestone: 'May 2026: signed a five-launch Neutron deal while targeting Neutron\'s debut from Wallops in late 2026.',
        facts: [
            'Electron: 60+ launches, the world\'s most active small launcher',
            'Neutron debut slipped to 2026 after a stage-1 tank ruptured in hydrostatic testing',
            'Archimedes methalox engines power the reusable Neutron first stage',
            'Also builds spacecraft: ESCAPADE Mars probes, Photon, solar arrays'
        ],
        desc: 'The smallsat specialist. Electron flies constantly from New Zealand & Virginia while reusable Neutron preps its debut.'
    },
    isro: {
        name: 'ISRO', ceo: 'V. Narayanan', color: '#ff6b00', icon: '🇮🇳', region: 'in',
        hq: 'Bengaluru, India', founded: '1969', vehicle: 'LVM3',
        program: 'Gaganyaan human spaceflight',
        milestone: 'Jul 5, 2026: ISRO test-fired the SOLVE sub-orbital motor at Sriharikota to validate Gaganyaan\'s crew-module parachute recovery system; uncrewed Gaganyaan-1 still targets H2 2026.',
        facts: [
            '8,000+ ground tests completed for Gaganyaan by early 2026',
            'Apr 10, 2026: crew module aced an air-drop test over the Bay of Bengal',
            'Vyommitra, a humanoid robot, flies before the first crew does',
            'Chandrayaan-3 made India the first nation to land at the lunar south pole',
            'Famous for frugal engineering — Mars orbit was reached on a $74M budget'
        ],
        desc: 'Indian Space Research Organisation. Gaganyaan will make India the 4th nation to launch humans on its own rocket.'
    },
    jaxa: {
        name: 'JAXA', ceo: 'Hiroshi Yamakawa', color: '#00479d', icon: '🇯🇵', region: 'jp',
        hq: 'Tokyo, Japan', founded: '2003', vehicle: 'H3-24L',
        program: 'H3 cadence ramp + lunar precision landing',
        milestone: 'H3 is ramping cadence from Tanegashima, flying HTV-X cargo to the ISS and co-developing lunar tech with Artemis.',
        facts: [
            'SLIM made Japan the 5th country to soft-land on the Moon — within 100 m of target',
            'H3 is operated jointly with Mitsubishi Heavy Industries',
            'HTV-X is the new ISS cargo ship, evolved from Kounotori',
            'A JAXA astronaut is slated to be the first non-American on the lunar surface'
        ],
        desc: 'Japan Aerospace Exploration Agency. Precision landers, the H3 heavy-lifter and quantum-comm satellite research.'
    },
    roscosmos: {
        name: 'Roscosmos', ceo: 'Dmitry Bakanov', color: '#cc0000', icon: '☭', region: 'eu',
        hq: 'Moscow, Russia', founded: '1992', vehicle: 'Soyuz-2.1a',
        program: 'ISS Russian segment + Angara ramp-up',
        milestone: 'Soyuz keeps its unbroken crew-rotation record to the ISS from Baikonur — the longest-serving human launch system in history.',
        facts: [
            'Soyuz has flown crews since 1967 — 150+ crewed missions',
            'Baikonur Cosmodrome is the world\'s oldest spaceport (Sputnik, Gagarin)',
            'Angara A5 is the successor heavy-lifter, launching from Vostochny',
            'Plans its own ROS orbital station after the ISS era ends'
        ],
        desc: 'Russia\'s space agency. Soyuz — the longest-serving crew vehicle ever — still rotates cosmonauts to the ISS.'
    },
    northrop_grumman: {
        name: 'Northrop Grumman', ceo: 'Kathy Warden', color: '#003d7a', icon: '⚙️', region: 'us',
        hq: 'Falls Church, Virginia', founded: '1994', vehicle: 'Antares 330',
        program: 'ISS cargo + in-orbit satellite servicing',
        milestone: 'Antares 330 pairs a new Firefly-built first stage with Cygnus cargo ships bound for the ISS from Wallops Island.',
        facts: [
            'Cygnus freighters have delivered 60+ tons of cargo to the ISS',
            'Its MEV servicing vehicles were the first to dock with and extend live GEO satellites',
            'Builds the SLS solid rocket boosters and the James Webb telescope structure',
            'Antares 330 first stage is co-developed with Firefly Aerospace'
        ],
        desc: 'Defense & space prime. Cygnus ISS freighters, satellite-servicing tugs and the boosters that power SLS.'
    },
    firefly: {
        name: 'Firefly Aerospace', ceo: 'Jason Kim', color: '#f97316', icon: '🦋', region: 'us',
        hq: 'Cedar Park, Texas', founded: '2017', vehicle: 'Firefly Alpha',
        program: 'Blue Ghost lunar landers + responsive launch',
        milestone: 'Blue Ghost Mission 2 launches late 2026 — a far-side Moon landing, stacked on Firefly\'s Elytra Dark transfer vehicle.',
        facts: [
            'Mar 2025: Blue Ghost 1 made the first fully-successful commercial Moon landing',
            'Mission 2 carries ESA\'s Lunar Pathfinder comms satellite to lunar orbit',
            'Set the record for fastest responsive launch: 24-hr notice to orbit (VICTUS NOX)',
            'Also co-builds the Antares 330 first stage and the Eclipse launcher with Northrop'
        ],
        desc: 'Texas launch & lunar startup. First company to stick a fully successful commercial Moon landing, now aiming for the far side.'
    },
    landspace: {
        name: 'LandSpace', ceo: 'Zhang Changwu', color: '#7f1d1d', icon: '🐉', region: 'cn',
        hq: 'Beijing', founded: '2015', vehicle: 'Zhuque-3',
        program: 'Reusable stainless methalox launch',
        milestone: 'Dec 3, 2025: Zhuque-3 reached orbit on its debut — the booster crashed 17 s before touchdown; a "perfect landing" is the 2026 goal.',
        facts: [
            'Zhuque-2 was the world\'s first methalox rocket to reach orbit (July 2023)',
            'Zhuque-3: stainless-steel, Falcon-9-class, designed for 20 reuses',
            'Named for the Vermilion Bird (朱雀) of Chinese constellations',
            'Jun 29, 2026: Flight 2 vehicle completed a 9-engine static fire; 2nd landing attempt now expected late Jul 2026'
        ],
        desc: 'China\'s commercial methalox pioneer. Stainless-steel Zhuque-3 chases the country\'s first orbital booster landing.'
    }
};

const SPACE_BLDS = [
    // Launch pads — each org gets a pad + mission control
    { id: 'pad_spacex',      name: 'Starbase Pad 2',      w: 180, fl: 1, org: 'spacex',      type: 'launchpad',      desc: 'Starship V3 launch mount with Mechazilla catch tower. Every flight lofts AI1 orbital data-center hardware for the merged SpaceX • xAI constellation.' },
    { id: 'pad_blue_origin', name: 'LC-36',               w: 160, fl: 1, org: 'blue_origin',  type: 'launchpad',      desc: 'Cape Canaveral Launch Complex 36 — New Glenn\'s home pad, being rebuilt after the May 2026 static-fire anomaly. Booster reflights land downrange on the barge Jacklyn.' },
    { id: 'pad_nasa',        name: 'LC-39B',              w: 180, fl: 1, org: 'nasa',         type: 'launchpad',      desc: 'Kennedy Space Center Pad 39B — the Artemis pad. SLS launched the Artemis II crew around the Moon from here in 2026.' },
    { id: 'pad_cnsa',        name: 'Wenchang LC-2',       w: 160, fl: 1, org: 'cnsa',         type: 'launchpad',      desc: 'Wenchang Spacecraft Launch Site, Hainan. Long March 10 Moon-rocket flights and Tiangong station logistics.' },
    { id: 'pad_esa',         name: 'ELA-4',               w: 140, fl: 1, org: 'esa',          type: 'launchpad',      desc: 'Europe\'s Spaceport, Kourou. Ariane 64 flies with four boosters here, hauling 32-satellite Amazon Leo batches to LEO.' },
    { id: 'pad_ula',         name: 'SLC-41',              w: 150, fl: 1, org: 'ula',           type: 'launchpad',      desc: 'Cape Canaveral Space Launch Complex 41. Vulcan Centaur flies national-security missions direct to GEO — 18–22 launches targeted in 2026.' },
    { id: 'pad_rocketlab',   name: 'LC-1A',               w: 120, fl: 1, org: 'rocketlab',     type: 'launchpad',      desc: 'Launch Complex 1, Māhia Peninsula, New Zealand — the world\'s only private orbital launch site. Electron flies here; Neutron debuts from Wallops.' },
    { id: 'pad_northrop_grumman', name: 'MARS Pad-0A',    w: 140, fl: 1, org: 'northrop_grumman', type: 'launchpad',   desc: 'Mid-Atlantic Regional Spaceport Pad 0A, Wallops Island. Antares 330 launches Cygnus cargo freighters to the ISS.' },
    { id: 'pad_firefly',     name: 'SLC-2W',              w: 120, fl: 1, org: 'firefly',       type: 'launchpad',      desc: 'Vandenberg SLC-2 West. Firefly Alpha responsive launches — and the staging point for Blue Ghost lunar landers.' },
    { id: 'pad_landspace',   name: 'JSLC LC-96',          w: 130, fl: 1, org: 'landspace',     type: 'launchpad',      desc: 'Jiuquan Satellite Launch Centre, Gobi Desert. Stainless-steel Zhuque-3 launches and landing-recovery attempts.' },
    { id: 'pad_isro',        name: 'SDSC SLP',            w: 140, fl: 1, org: 'isro',          type: 'launchpad',      desc: 'Satish Dhawan Space Centre Second Launch Pad, Sriharikota. LVM3 and the human-rated Gaganyaan stack fly from here.' },
    { id: 'pad_jaxa',        name: 'Tanegashima LP-2',    w: 140, fl: 1, org: 'jaxa',          type: 'launchpad',      desc: 'Tanegashima Space Center — often called the world\'s most beautiful launch site. H3 heavy-lift, operated with Mitsubishi Heavy Industries.' },
    { id: 'pad_roscosmos',   name: 'Baikonur LC-31/6',    w: 150, fl: 1, org: 'roscosmos',     type: 'launchpad',      desc: 'Baikonur Cosmodrome Site 31, Kazakhstan. Soyuz crew rotations to the ISS — flying from the world\'s oldest spaceport.' },

    // Shared infrastructure
    { id: 'mission_control',  name: 'Deep Space Network',  w: 200, fl: 3, org: null,           type: 'mission_control', desc: 'Modeled on NASA\'s DSN — three 70 m dish complexes in Goldstone, Madrid and Canberra keep contact with every probe beyond Earth orbit, plus the AI1 compute constellation.' },
    { id: 'space_assembly',   name: 'Vehicle Assembly',    w: 220, fl: 4, org: null,           type: 'assembly',        desc: 'Homage to KSC\'s Vehicle Assembly Building — the largest single-story building on Earth, so big it has its own weather. Rockets are stacked and mated to payloads here.' },
    { id: 'tracking_station', name: 'Orbital Tracking',    w: 160, fl: 2, org: null,           type: 'tracking',        desc: 'Space-domain awareness station. Tracks 12,000+ active satellites — including the growing orbital data-center fleets — and issues conjunction warnings.' }
];

// Separation forest between space zone and residential
const SPACE_FOREST = { id: 'forest_space', name: 'Frontier Pines', w: 350, fl: 1, emoji: '🌲', lab: null, desc: 'A rugged treeline marking the boundary between the space frontier and the city.' };

const SpaceData = {
    launches: [],
    nextFetchTick: 0,
    
    init() {
        // Inject space buildings into BLDS if not already present
        if (!BLDS.find(b => b.id === 'pad_spacex')) {
            SPACE_BLDS.forEach(sb => {
                const bld = { ...sb, x: 0 }; // x will be set by recalculateZoning
                BLDS.push(bld);
                G.bldById[bld.id] = bld;
            });
        }
        
        // Inject separation forest
        if (!BLDS.find(b => b.id === 'forest_space')) {
            const f = { ...SPACE_FOREST, x: 0 };
            BLDS.push(f);
            G.bldById[f.id] = f;
        }
        
    },
    
    async fetchLaunches(force) {
        // Cache in localStorage to avoid 429 rate limits (15-min TTL)
        const CACHE_KEY = 'sc_launches', TTL = 15 * 60 * 1000;
        if (!force) {
            try {
                const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
                if (cached && Date.now() - cached.ts < TTL) {
                    this.launches = cached.data;
                    return;
                }
            } catch(_) {}
        }
        try {
            // mode=list strips launch_service_provider — we need normal/detailed mode
            // to extract the provider name for pad matching.
            const r = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20', {
                signal: AbortSignal.timeout(10000)
            });
            if (!r.ok) {
                if (r.status === 429) { console.warn('[Space API] Rate limited (429). Using cached data if available.'); return; }
                return;
            }
            const d = await r.json();
            if (d.results) {
                this.launches = d.results.map(l => ({
                    id: l.id,
                    name: l.name,
                    net: l.net, // NET = No Earlier Than (ISO date)
                    status: l.status?.abbrev || 'TBD',
                    provider: l.launch_service_provider?.name || 'Unknown',
                    rocket: l.rocket?.configuration?.name || 'Unknown',
                    pad: l.pad?.name || 'Unknown',
                    mission: l.mission?.name || null,
                    image: l.image || null
                }));
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: this.launches })); } catch(_) {}
                if (typeof UI !== 'undefined') {
                    UI.addToast(`🚀 ${this.launches.length} upcoming launches tracked`);
                }
            }
        } catch(e) {
            console.warn('[Space API] Failed to fetch launches:', e.message);
        }
    },
    
    getNextLaunch() {
        if (!this.launches.length) return null;
        const now = new Date();
        return this.launches.find(l => new Date(l.net) > now) || this.launches[0];
    },
    
    getCountdown(launch) {
        if (!launch || !launch.net) return null;
        const diff = new Date(launch.net) - new Date();
        if (diff < 0) return 'LAUNCHED';
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) return `T-${d}d ${h}h ${m}m`;
        if (h > 0) return `T-${h}h ${m}m ${s}s`;
        return `T-${m}m ${s}s`;
    },
    
    getOrgForProvider(providerName) {
        const n = providerName.toLowerCase();
        // Specific commercial providers first (more specific than country-level fallthroughs).
        if (n.includes('spacex')) return 'spacex';
        if (n.includes('blue origin')) return 'blue_origin';
        if (n.includes('rocket lab')) return 'rocketlab';
        if (n.includes('northrop grumman')) return 'northrop_grumman';
        if (n.includes('firefly')) return 'firefly';
        if (n.includes('landspace')) return 'landspace';
        if (n.includes('ula') || n.includes('united launch')) return 'ula';
        // National agencies and their commercial operators.
        if (n.includes('nasa')) return 'nasa';
        if (n.includes('isro') || n.includes('indian space')) return 'isro';
        if (n.includes('jaxa') || n.includes('mitsubishi')) return 'jaxa';
        if (n.includes('roscosmos') || n.includes('russian federal')) return 'roscosmos';
        // European cluster — Arianespace, Avio (Vega), Isar, Rocket Factory Augsburg etc.
        if (n.includes('arianespace') || n.includes('esa') || n.includes('european space')
            || n.includes('avio') || n.includes('isar') || n.includes('rocket factory')) return 'esa';
        // Chinese state + commercial — CASC, Galactic Energy, ExPace, Deep Blue, iSpace, Orienspace.
        if (n.includes('casc') || n.includes('china') || n.includes('galactic energy')
            || n.includes('expace') || n.includes('deep blue') || n.includes('ispace')
            || n.includes('orienspace')) return 'cnsa';
        return null;
    }
};
