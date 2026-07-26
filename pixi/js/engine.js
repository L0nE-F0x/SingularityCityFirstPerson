/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SINGULARITY CITY v16.6.0 — HYBRID DYNAMIC ENGINE (Worker + Single-Pass Optimization)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CoreLabRegions = {
    openai: 'us', anthropic: 'us', google: 'us', meta: 'us', xai: 'us',
    microsoft: 'us', amazon: 'us', apple: 'us', databricks: 'us',
    snowflake: 'us', nvidia: 'us', ibm: 'us', ai21: 'us', cohere: 'us',
    huggingface: 'us',
    
    deepseek: 'cn', alibaba: 'cn', baidu: 'cn', tencent: 'cn', 
    zhipu_ai: 'cn', '01_ai': 'cn', upstage: 'cn',
    
    mistral: 'eu', stability: 'eu', tii: 'eu', bigcode: 'eu'
};

const G = {
    app: null, world: null, macroLayer: null, viewMode: 'micro', 
    tick: 0, models: [],
    charRefs: {}, autoScanId: null, autoScanMin: 0,
    cars: [], nextCarTick: 200,
    apiProvider: "google", modelId: "", authKey: "", finnhubKey: "",

    // User experience preferences (persisted via sc_data.prefs). Each key is a
    // simple toggle read at the point-of-use so a false value cleanly disables
    // that behaviour. idleTourMin drives the auto-tour screensaver delay.
    prefs: {
        dailyBrief: true,     // auto-prompt for the Daily Briefing video
        newsToasts: true,     // in-canvas share/alert toast on live news reactions
        autoTour: true,       // idle screensaver camera tour
        idleTourMin: 5,       // minutes of inactivity before the tour auto-starts
        sfx: true,            // procedural sound effects & ambiance
        music: true,          // background soundtrack
        weather: true,        // dynamic weather (rain/fog) effects
        reduceMotion: null,   // null = follow OS prefers-reduced-motion; true/false = explicit override
        uiScale: 1,           // UI text scale: 1 (normal), 1.15 (large), 1.3 (larger)
    },
    pref(k) { return this.prefs ? this.prefs[k] : undefined; },

    // True when motion should be minimised (photosensitivity / vestibular needs):
    // an explicit user override wins, otherwise we honour the OS setting. Read by
    // the weather effects (no lightning flash, fewer particles) and CSS.
    reduceMotionOn() {
        if (this.prefs && this.prefs.reduceMotion !== null && this.prefs.reduceMotion !== undefined) return !!this.prefs.reduceMotion;
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    },

    // Apply accessibility prefs to the DOM: reduced-motion body class + global
    // flag for the canvas effects, and the UI text-scale class. Idempotent —
    // called on boot and after Settings save.
    applyAccessibility() {
        const rm = this.reduceMotionOn();
        window._reduceMotion = rm;
        if (document.body) document.body.classList.toggle('reduce-motion', rm);
        const scale = (this.prefs && this.prefs.uiScale) || 1;
        if (document.body) {
            document.body.classList.toggle('ui-lg', scale >= 1.15 && scale < 1.3);
            document.body.classList.toggle('ui-xl', scale >= 1.3);
        }
    },
    
    supabaseUrl: "https://uojpqygjbxranpdvkwwz.supabase.co", 
    supabaseKey: "sb_publishable_Dm4KFmAqRuSSXkKWT04ATw_Ki8QFdZj",
    
    achievements: {}, chatBubbles: {},
    bldById: {}, bldsByLab: {}, socialSpots: [],
    
    // ─── EASTER EGGS & TRACKING ───
    _konamiSeq: [], _moonClicks: 0, _catMode: false, _matrixMode: false,
    _visitedInteriors: {}, _trainsDeparted: 0,
    
    starsLayer: null, cloudLayer: null, bldLayer: null, groundGfx: null,
    undergroundLayer: null, trainLayer: null, 
    reflectionLayer: null, charLayer: null, carLayer: null, lightLayer: null, fxGfx: null, celestialGfx: null,
    staticLightsGfx: null,
    
    dataPackets: [], macroNodes: [], pingRings: [],
    
    // ─── CAMERA TRACKING ───
    tracking: null,  // { type: 'model'|'ceo', id: string, lab: string, _lastBld: string|null }
    
    vpW: 0, vpH: 0, cityW: 3400, groundY: 0,
    savedCamX: 0, 
    
    interiorLayer: null,
    activeInterior: null,
    trainFocus: null,        // train key while "boarded" — the camera-cutaway ride view

    getDayPhase() { 
        const n = new Date();
        return (n.getHours() * 60 + n.getMinutes()) / 1440; 
    },
    getCityWidth() { 
        if (!BLDS || BLDS.length === 0) return 3400;
        const last = BLDS[BLDS.length - 1];
        return Math.max(3400, last.x + last.w + 200); 
    },

    recalculateZoning() {
        if (!window.BLDS) return;
        
        if (!BLDS.find(b => b.id === 'metro_east')) {
            const mEast = { id: 'metro_east', name: 'Eastern Hub', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Eastern transit hub.' };
            BLDS.push(mEast);
            this.bldById['metro_east'] = mEast;
        }

        // Innovation Line — terminus station serving all innovation zones (Backbone, Robotics, Longevity, Agents, Alignment)
        if (!BLDS.find(b => b.id === 'metro_longevity')) {
            const mLong = { id: 'metro_longevity', name: 'Innovation Line', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Terminus station serving the Innovation Corridor — Backbone, Robotics, Longevity, Agent District and Alignment Forest workers.' };
            BLDS.push(mLong);
            this.bldById['metro_longevity'] = mLong;
        }
        
        // Neon Bar — nightlife destination
        if (!BLDS.find(b => b.id === 'neon_bar')) {
            const bar = { id: 'neon_bar', name: 'Neon Bar', w: 130, x: 0, fl: 3, emoji: '🍸', lab: null, desc: 'Late-night karaoke bar. Models unwind with drinks and sing their training data.' };
            BLDS.push(bar);
            this.bldById['neon_bar'] = bar;
        }
        
        // Visitor Monument — public counter
        if (!BLDS.find(b => b.id === 'visitor_monument')) {
            const mon = { id: 'visitor_monument', name: 'Visitor Monument', w: 80, x: 0, fl: 1, emoji: '🌐', lab: null, desc: 'A monument tracking every unique visitor to Singularity City. Your presence is recorded.' };
            BLDS.push(mon);
            this.bldById['visitor_monument'] = mon;
        }

        // Model Graveyard — final resting place for retired/deprecated AI models (haunted by ghosts)
        if (!BLDS.find(b => b.id === 'graveyard')) {
            const grave = { id: 'graveyard', name: 'Model Graveyard', w: 200, x: 0, fl: 1, emoji: '⚰️', lab: null, desc: 'A memorial park honoring retired and deprecated AI models. Quiet, reverent, eternal.' };
            BLDS.push(grave);
            this.bldById['graveyard'] = grave;
        }

        // The Singularity City Times — weekly newspaper of record
        if (!BLDS.find(b => b.id === 'times_hq')) {
            const times = { id: 'times_hq', name: 'Singularity City Times', w: 150, x: 0, fl: 3, emoji: '📰', lab: null, desc: 'The city\u2019s weekly newspaper of record. Click to read this week\u2019s front page.' };
            BLDS.push(times);
            this.bldById['times_hq'] = times;
        }

        let fCamp = BLDS.find(b => b.id === 'forest_0');
        if (!fCamp) {
            fCamp = { id: 'forest_0', name: 'Pine Reserve', w: 400, x: 1450, fl: 1, emoji: '🌲', lab: null, desc: 'A serene camping ground.' };
            BLDS.push(fCamp);
            this.bldById['forest_0'] = fCamp;
        }

        // Helper: is this a space zone building?
        const isSpaceBld = (b) => b.id.startsWith('pad_') || b.id === 'mission_control' || b.id === 'space_assembly' || b.id === 'tracking_station';
        const isSpaceOrForestSep = (b) => isSpaceBld(b) || b.id === 'forest_space';

        // ─── PORT / TRADE ZONE: Initialize buildings ───
        if (typeof PortZone !== 'undefined') PortZone.init();
        
        // ─── SPACE ZONE: Place all space buildings to the far left ───
        // ─── PORT / TRADE ZONE: Position at far left, then space after it ───
        let portEndX = 100;
        if (typeof PortZone !== 'undefined') {
            const portBlds = BLDS.filter(b => b.id.startsWith('port_'));
            let px = 100;
            portBlds.forEach(b => { b.x = px; px += b.w + 40; });
            portEndX = px + 60;
            
            // Set ocean coordinates (left of port buildings)
            PortZone.oceanStartX = -400;
            PortZone.oceanEndX = 80;
            PortZone.coastlineX = 60;
            if (!PortZone.ships.length) PortZone._spawnShips();
        }
        
        let spaceX = portEndX;
        
        const spaceBlds = BLDS.filter(isSpaceBld).sort((a, b) => {
            // Launch pads first, then shared infrastructure
            const typeOrder = { launchpad: 0, mission_control: 1, assembly: 2, tracking: 3 };
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });
        spaceBlds.forEach(b => {
            b.x = spaceX;
            spaceX += b.w + 60;
        });
        
        // Separation forest between space zone and residential
        let fSpace = BLDS.find(b => b.id === 'forest_space');
        if (fSpace) {
            fSpace.x = spaceX + 150;
            spaceX = fSpace.x + fSpace.w + 150;
        }
        
        // ─── DATA CENTER & CHIP FAB ZONE (between space zone and residential) ───
        const isDcBld = (b) => b.id.startsWith('dc_') || b.id.startsWith('fab_') || b.id === 'metro_dc';
        
        // Ensure DC facilities exist as BLDS entries
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => {
                const statusIcon = dc.status === 'construction' ? '🚧' : '✅';
                const typeIcon = dc.type === 'chipfab' ? '🔧' : '🖥️';
                
                let existing = BLDS.find(b => b.id === dc.id);
                if (!existing) {
                    existing = {
                        id: dc.id, name: dc.name, w: dc.w || 160, x: 0,
                        fl: dc.status === 'construction' ? 4 : 3,
                        emoji: typeIcon,
                        lab: dc.operator
                    };
                    BLDS.push(existing);
                    this.bldById[dc.id] = existing;
                }
                
                // Always refresh DC-specific data (survives Supabase reloads)
                existing.dcData = dc;
                existing.type = dc.type;
                existing.desc = dc.desc;
                existing.fl = dc.status === 'construction' ? 4 : 3;
                
                // Build rich tooltip
                let tipParts = [dc.desc];
                tipParts.push('<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">');
                tipParts.push(`${statusIcon} STATUS: ${dc.status === 'construction' ? 'Under Construction' : 'Operational'}<br>`);
                tipParts.push(`📍 ${dc.location}<br>`);
                if (dc.gpus) tipParts.push(`⚡ GPUs: ${dc.gpus}<br>`);
                if (dc.power_mw) tipParts.push(`🔌 Power: ${dc.power_mw} MW<br>`);
                if (dc.cooling) tipParts.push(`❄️ Cooling: ${dc.cooling}<br>`);
                if (dc.process) tipParts.push(`🔬 Process: ${dc.process}<br>`);
                if (dc.products) tipParts.push(`📦 Products: ${dc.products}<br>`);
                if (dc.investment) tipParts.push(`💰 Investment: ${dc.investment}<br>`);
                if (dc.completion) tipParts.push(`📅 Est. Completion: ${dc.completion}<br>`);
                tipParts.push('</span>');
                existing.tip = tipParts.join('');
            });
        }
        
        // Metro station for data center zone
        if (!BLDS.find(b => b.id === 'metro_dc')) {
            const mDc = { id: 'metro_dc', name: 'Compute District', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Data center district transit hub.' };
            BLDS.push(mDc);
            this.bldById['metro_dc'] = mDc;
        }
        
        // ─── NPC HOUSING: Place worker apartments between Frontier Pines and Metro DC ───
        // (Positioned AFTER fSpace, BEFORE dcX)
        let npcEndX = spaceX + 100;
        if (typeof NPCHousing !== 'undefined') {
            let npcX = fSpace ? fSpace.x + fSpace.w + 80 : spaceX + 100;
            const npcBlds = BLDS.filter(b => b.id.startsWith('npc_apt_'));
            npcBlds.forEach(b => {
                b.x = npcX;
                npcX += b.w + 40;
            });
            npcEndX = npcX;
        }

        // Place DC zone after NPC housing — metro station first (leftmost)
        let dcX = npcEndX + 60;
        
        const mDc = BLDS.find(b => b.id === 'metro_dc');
        if (mDc) { mDc.x = dcX; dcX += mDc.w + 60; }
        
        // Then operational DCs, construction sites, chip fabs
        const dcOrder = { datacenter: 0, chipfab: 1 };
        const statusOrder = { operational: 0, construction: 1 };
        BLDS.filter(b => b.id.startsWith('dc_') || b.id.startsWith('fab_'))
            .sort((a, b) => {
                const ad = a.dcData || {}; const bd = b.dcData || {};
                const typeA = dcOrder[ad.type] || 0; const typeB = dcOrder[bd.type] || 0;
                if (typeA !== typeB) return typeA - typeB;
                const statA = statusOrder[ad.status] || 0; const statB = statusOrder[bd.status] || 0;
                return statA - statB;
            })
            .forEach(b => {
                b.x = dcX;
                dcX += b.w + 50;
            });

        // Place residential buildings after the DC zone
        let resX = dcX + 80;
        BLDS.filter(b => b.id.startsWith('res_') || b.id === 'metro_res')
            .sort((a, b) => (a.x || 0) - (b.x || 0))
            .forEach(b => {
                b.x = resX;
                resX += b.w + 60;
            });

        BLDS.sort((a, b) => a.x - b.x);

        let maxResOrDcX = 0;
        BLDS.forEach(b => {
            if (b.id.startsWith('res_') || b.id === 'metro_res' || isDcBld(b) || b.id.startsWith('npc_apt_')) {
                if (b.x + b.w > maxResOrDcX) maxResOrDcX = b.x + b.w;
            }
        });

        // ─── TECH DISTRICT COMPACTION ───
        // Collect all tech buildings (lab HQs + social), sort by current x, reposition tightly
        const isSpecialId = (id) => id.startsWith('res_') || id === 'metro_res' || id.startsWith('house_') ||
            id === 'metro_east' || id === 'metro_dc' || id === 'metro_mid' || id === 'metro_longevity' || id.startsWith('npc_apt_') ||
            id.startsWith('suburb_') ||
            id === 'neon_bar' || id === 'visitor_monument' || id === 'times_hq' || id === 'graveyard' || id === 'forest_0' || id === 'forest_1' || id.startsWith('port_') || id.startsWith('power_') ||
            id.startsWith('uni_') || id.startsWith('court_') || id === 'city_park' || id === 'ai_index' || id === 'black_market' || id === 'convention_center' || id.startsWith('backbone_') ||
            id.startsWith('vcrow_') || id.startsWith('robotics_') || id.startsWith('longevity_') || id.startsWith('agents_') ||
            id.startsWith('embassy_') || id.startsWith('diplomat_villa_') || id.startsWith('align_');

        const techBldsList = BLDS.filter(b =>
            !isSpecialId(b.id) && !isDcBld(b) && !isSpaceOrForestSep(b)
        ).sort((a, b) => a.x - b.x);
        
        // ─── UNIVERSITY CAMPUS: Place after residential, before Pine Reserve ───
        let afterResX = maxResOrDcX;
        if (typeof UniversityData !== 'undefined' && UniversityData.BLDS.length > 0) {
            afterResX = UniversityData.positionZone(maxResOrDcX);
        }

        // Place Pine Reserve, then start tech district after it
        const pineGap = 100; // gap on each side of forest
        let techStartX = afterResX + pineGap;
        if (fCamp) {
            fCamp.x = techStartX;
            techStartX = fCamp.x + fCamp.w + pineGap;
        }

        // ─── AI COURT: Place after Pine Reserve, before tech district ───
        if (typeof CourtData !== 'undefined' && CourtData.BLDS.length > 0) {
            techStartX = CourtData.positionZone(techStartX);
        }

        // ─── AI DETENTION CENTER: Right next to the courthouse — summoned, then jailed ───
        if (typeof JailData !== 'undefined' && JailData.BLDS.length > 0) {
            techStartX = JailData.positionZone(techStartX);
        }

        // ─── CENTRAL PARK: Green space between Court and Tech District ───
        if (typeof CityPark !== 'undefined' && CityPark.BLDS.length > 0) {
            techStartX = CityPark.positionZone(techStartX);
        }

        // ─── MODEL GRAVEYARD: Memorial park at the very start of the Tech District
        // Positioned between Central Park and the Legacy Systems Museum — where ghosts
        // haunt retired AI models. Placed explicitly (not compacted) so it keeps its
        // home between the green space and the first tech building.
        const graveEarly = BLDS.find(b => b.id === 'graveyard');
        if (graveEarly) {
            graveEarly.x = techStartX;
            techStartX += graveEarly.w + 65;
        }

        // Compact tech buildings with consistent 50px gaps
        let techX = techStartX;
        techBldsList.forEach(b => {
            b.x = techX;
            techX += b.w + 65;
        });
        
        let rightMostTechX = techX;

        // Mid-tech metro station — placed after the median tech building
        if (!BLDS.find(b => b.id === 'metro_mid')) {
            const mMid2 = { id: 'metro_mid', name: 'Central Line', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Central tech district transit hub.' };
            BLDS.push(mMid2);
            this.bldById['metro_mid'] = mMid2;
        }
        const mMid = BLDS.find(b => b.id === 'metro_mid');
        const vMonEarly = BLDS.find(b => b.id === 'visitor_monument');
        if (mMid && techBldsList.length >= 4) {
            const medianIdx = Math.floor(techBldsList.length / 2);
            const leftBld = techBldsList[medianIdx];
            mMid.x = leftBld.x + leftBld.w + 15;

            // Place Visitor Monument right next to Central Line metro
            let stationRight = mMid.x + mMid.w + 15;
            if (vMonEarly) {
                vMonEarly.x = stationRight;
                stationRight = vMonEarly.x + vMonEarly.w + 15;
            }

            // Shift right-side buildings to make room for station + monument
            const rightBlds = techBldsList.filter(b => b.x > leftBld.x);
            if (rightBlds.length > 0 && rightBlds[0].x < stationRight) {
                const shiftNeeded = stationRight - rightBlds[0].x;
                rightBlds.forEach(b => { b.x += shiftNeeded; });
            }
            // Update rightMostTechX after shift
            const lastTech = rightBlds[rightBlds.length - 1] || leftBld;
            rightMostTechX = lastTech.x + lastTech.w + 30;
        } else if (mMid) {
            mMid.x = techStartX + (rightMostTechX - techStartX) / 2;
            if (vMonEarly) vMonEarly.x = mMid.x + mMid.w + 15;
        }

        let currentX = rightMostTechX + 60;

        // ─── VENTURE CAPITAL ROW ───
        if (typeof VCRow !== 'undefined') {
            currentX = VCRow.positionZone(currentX);
        }

        // Convention Center — active during conference weeks
        const convBld = BLDS.find(b => b.id === 'convention_center');
        if (convBld) {
            convBld.x = currentX;
            currentX += convBld.w + 50;
        }

        // ─── EMBASSY ROW: Diplomatic quarter between Convention Center and AI Index ───
        if (typeof EmbassyRow !== 'undefined') {
            currentX = EmbassyRow.positionZone(currentX);
        }

        // ─── EMBASSY QUARTER: Ambassador residences east of Embassy Row (Stage 5) ───
        if (typeof EmbassyQuarter !== 'undefined') {
            currentX = EmbassyQuarter.positionZone(currentX);
        }

        // ─── GLOBAL AI INDEX: Billboard after Embassy Row ───
        if (typeof AIIndex !== 'undefined' && AIIndex.BLDS.length > 0) {
            currentX = AIIndex.positionZone(currentX);
        }

        // (Visitor Monument is now positioned next to Central Line metro station — see techBlds layout above)

        // Singularity City Times HQ — weekly newspaper
        const tHQ = BLDS.find(b => b.id === 'times_hq');
        if (tHQ) {
            tHQ.x = currentX;
            currentX += tHQ.w + 90; // Extra gap for dumpster entrance
        }

        // Neon Bar — nightlife strip
        const nBar = BLDS.find(b => b.id === 'neon_bar');
        if (nBar) {
            nBar.x = currentX;
            currentX += nBar.w + 40;
        }

        // ─── BLACK MARKET: Underground zone beneath Neon Bar ───
        // Positioned underground (not on the horizontal map) — accessed via dumpster click
        if (typeof BlackMarket !== 'undefined') {
            BlackMarket.positionUnderground();
        }

        let mEast = BLDS.find(b => b.id === 'metro_east');
        if (mEast) {
            mEast.x = currentX;
            currentX += mEast.w;
        }

        // ─── THE BACKBONE: Network Infrastructure District ───
        if (typeof BackboneZone !== 'undefined') {
            currentX = BackboneZone.positionZone(currentX);
        } else {
            currentX += 500;
        }

        // ─── ROBOTICS FACTORY: Physical AI Manufacturing District ───
        if (typeof RoboticsZone !== 'undefined') {
            currentX = RoboticsZone.positionZone(currentX);
        }

        // ─── LONGEVITY RESEARCH WING: AI Drug Discovery ───
        if (typeof LongevityZone !== 'undefined') {
            currentX = LongevityZone.positionZone(currentX);
        }

        // ─── AGENT DISTRICT: Autonomous AI Agent Frameworks ───
        if (typeof AgentsZone !== 'undefined') {
            currentX = AgentsZone.positionZone(currentX);
        }

        // ─── ALIGNMENT FOREST: AI Safety Research Quarter ───
        if (typeof AlignmentForest !== 'undefined') {
            currentX = AlignmentForest.positionZone(currentX);
        }

        // Longevity Line — eastern terminus metro between Longevity Wing and Silicon Woods
        const mLong = BLDS.find(b => b.id === 'metro_longevity');
        if (mLong) {
            currentX += 40;
            mLong.x = currentX;
            currentX += mLong.w + 40;
        }

        // ─── VC SUBURBIA: Middle-class townhomes between Longevity Line and Silicon Woods ───
        if (typeof VCRow !== 'undefined' && VCRow.positionSuburbs) {
            currentX = VCRow.positionSuburbs(currentX);
        }

        let fSilicon = BLDS.find(b => b.id === 'forest_1');
        if (fSilicon) {
            fSilicon.x = currentX;
            currentX += fSilicon.w + 300;
        }

        // ─── Ensure every founder has an estate in Billionaire's Row ───
        if (typeof REAL_FOUNDERS !== 'undefined') {
            REAL_FOUNDERS.forEach(f => {
                if (!f.lab) return;
                const estateId = 'house_' + f.lab;
                if (!BLDS.find(b => b.id === estateId)) {
                    const labData = LABS[f.lab] || LABS.other || { name: f.lab, color: '#64748b' };
                    const newEstate = {
                        id: estateId,
                        name: `${f.name}'s Estate`,
                        w: 200,
                        x: 0, // will be placed below
                        fl: 2,
                        emoji: '🏡',
                        lab: f.lab,
                        desc: `Private residence of ${f.name}, ${f.role || 'CEO'} of ${labData.name}.`
                    };
                    BLDS.push(newEstate);
                    this.bldById[estateId] = newEstate;
                    if (!this.bldsByLab[f.lab]) this.bldsByLab[f.lab] = [];
                    this.bldsByLab[f.lab].push(newEstate);
                }
            });
        }

        BLDS.forEach(b => {
            if (b.id.startsWith('house_')) {
                b.x = currentX;
                currentX += b.w + 100; 
            }
        });

        // ─── POWER GRID ZONE: Far right after estates ───
        if (typeof PowerZone !== 'undefined') {
            currentX = PowerZone.positionZone(currentX);
        }

        // ─── ZONE BOUNDARY REGISTRY (for ambient sound & environment systems) ───
        this.zoneBounds = [];
        const addZB = (z, arr) => {
            const bs = arr.filter(Boolean);
            if (!bs.length) return;
            bs.sort((a, b) => a.x - b.x);
            this.zoneBounds.push({ zone: z, x0: bs[0].x - 60, x1: bs[bs.length - 1].x + bs[bs.length - 1].w + 60 });
        };
        addZB('port', BLDS.filter(b => b.id.startsWith('port_')));
        addZB('desert', BLDS.filter(isSpaceBld));
        if (fSpace) addZB('forest', [fSpace]);
        addZB('npc_housing', BLDS.filter(b => b.id.startsWith('npc_apt_')));
        addZB('compute', BLDS.filter(isDcBld));
        addZB('residential', BLDS.filter(b => b.id.startsWith('res_') || b.id === 'metro_res'));
        addZB('university', BLDS.filter(b => b.id.startsWith('uni_')));
        if (fCamp) addZB('forest', [fCamp]);
        addZB('court', BLDS.filter(b => b.id.startsWith('court_')));
        addZB('jail', BLDS.filter(b => b.id === 'ai_jail'));
        addZB('city_park', BLDS.filter(b => b.id === 'city_park'));
        addZB('vcrow', BLDS.filter(b => b.id.startsWith('vcrow_')));
        if (nBar) addZB('nightlife', [nBar]);
        if (fSilicon) addZB('forest', [fSilicon]);
        addZB('estates', BLDS.filter(b => b.id.startsWith('house_')));
        addZB('backbone', BLDS.filter(b => b.id.startsWith('backbone_')));
        addZB('robotics', BLDS.filter(b => b.id.startsWith('robotics_')));
        addZB('longevity', BLDS.filter(b => b.id.startsWith('longevity_')));
        addZB('agents', BLDS.filter(b => b.id.startsWith('agents_')));
        addZB('suburbia', BLDS.filter(b => b.id.startsWith('suburb_')));
        addZB('power', BLDS.filter(b => b.id.startsWith('power_')));

        BLDS.sort((a, b) => a.x - b.x);
        this.cityW = this.getCityWidth();
    },
  
    unlockAchieve(key) {
      if (this.achievements[key]) return;
      this.achievements[key] = Date.now();
      if (typeof Quests !== 'undefined') Quests.onAchievement(key);
      const a = ACHIEVEMENTS[key];
      if (!a) return;
      if (typeof UI !== 'undefined') UI.addToast(`🏆 Achievement: ${a.icon} ${a.name}!`);
      if (typeof SND !== 'undefined') SND.achieve();
      if (typeof NOTIFY !== 'undefined') NOTIFY.send('Achievement Unlocked!', `${a.icon} ${a.name} — ${a.desc}`);
      this.save();
    },

    // Easter eggs (initEasterEggs, triggerMatrixRain, triggerCatMode) → easter_eggs.js
    // Persistence (save, load, saveSettings, startAutoScan, _postToWorker) → persistence.js

    getLabIcon(labId) {
        const pool = ['🚀', '🛰️', '⚡', '💡', '🔥', '⚙️', '🧬', '🧪', '🔭', '📡', '🕹️', '💎', '💠', '🔆', '🔑', '🌍', '💻'];
        const hash = Array.from(labId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return pool[hash % pool.length];
    },

    ensureLabExists(rawLabId, suggestedRegion) {
        if (!rawLabId || rawLabId === 'other') return 'other';
        
        let norm = rawLabId.toLowerCase().replace(/[^a-z0-9]/g, '');
        let canonical = rawLabId.toLowerCase().trim().replace(/\s+/g, '_');
        
        if (norm.includes('google') || norm.includes('deepmind')) canonical = 'google';
        else if (norm.includes('openai')) canonical = 'openai';
        else if (norm.includes('meta') || norm.includes('facebook')) canonical = 'meta';
        else if (norm.includes('anthropic')) canonical = 'anthropic';
        else if (norm.includes('xai') || norm === 'x') canonical = 'xai';
        else if (norm.includes('mistral')) canonical = 'mistral';
        else if (norm.includes('alibaba') || norm.includes('qwen') || norm.includes('tongyi')) canonical = 'alibaba';
        else if (norm.includes('deepseek')) canonical = 'deepseek';
        else if (norm.includes('cohere')) canonical = 'cohere';
        else if (norm.includes('01ai') || norm.includes('01_ai')) canonical = '01_ai';
        else if (norm.includes('microsoft')) canonical = 'microsoft';
        else if (norm.includes('amazon') || norm.includes('aws')) canonical = 'amazon';
        else if (norm.includes('stability')) canonical = 'stability';
        else if (norm.includes('apple')) canonical = 'apple';
        else if (norm.includes('ibm')) canonical = 'ibm';
        else if (norm.includes('nvidia')) canonical = 'nvidia';
        else if (norm.includes('baidu') || norm.includes('ernie')) canonical = 'baidu';
        else if (norm.includes('tencent')) canonical = 'tencent';
        else if (norm.includes('ai21')) canonical = 'ai21';
        else if (norm.includes('bigcode')) canonical = 'bigcode';
        else if (norm.includes('tii') || norm.includes('falcon')) canonical = 'tii';
        else if (norm.includes('zhipu') || norm.includes('glm')) canonical = 'zhipu_ai';
        else if (norm.includes('upstage')) canonical = 'upstage';
        else if (norm.includes('databricks')) canonical = 'databricks';
        else if (norm.includes('snowflake')) canonical = 'snowflake';
        else if (norm.includes('huggingface') || norm.includes('hugging')) canonical = 'huggingface';

        if (LABS[canonical]) {
            if (suggestedRegion && (!LABS[canonical].region || LABS[canonical].region === 'eu')) {
                LABS[canonical].region = suggestedRegion;
            }
            
            // FIX: Lab exists in LABS (from Supabase) but may have no HQ building.
            // This happens when a lab is added to the 'labs' table but not the 'blds' table.
            const hasHQ = BLDS.some(b => b.lab === canonical && !b.id.startsWith('house_'));
            if (!hasHQ && canonical !== 'other') {
                const hash = Array.from(canonical).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const newW = 140 + (hash % 60);
                const techBlds = BLDS.filter(b => b.id !== 'forest_1' && b.id !== 'forest_0' && !b.id.startsWith('house_') && !b.id.startsWith('suburb_') && b.id !== 'metro_east' && b.id !== 'metro_longevity');
                const lastTech = techBlds[techBlds.length - 1];
                const newX = lastTech ? (lastTech.x + lastTech.w + 80) : 100;
                
                const newBld = {
                    id: 'bld_' + canonical, name: (LABS[canonical].name || canonical) + ' HQ', w: newW, x: newX, fl: 3, lab: canonical, desc: `Headquarters for ${LABS[canonical].name || canonical}.`
                };
                
                BLDS.push(newBld);
                this.bldById[newBld.id] = newBld;
                if (!this.bldsByLab[canonical]) this.bldsByLab[canonical] = [];
                this.bldsByLab[canonical].unshift(newBld);
                
                this.recalculateZoning();
                
                if (this.bldLayer) {
                    if (typeof Environment !== 'undefined') { Environment.buildGround(); Environment.buildBuildings(); }
                    if (this.viewMode === 'macro') this.buildMacroLayer();
                }
                
                if (typeof UI !== 'undefined') UI.addLog(`🏗️ New HQ zoned for ${LABS[canonical].name || canonical}!`);
            }
            
            return canonical;
        }

        for (let existingKey in LABS) {
            let existingNorm = existingKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === existingNorm || (norm.length > 5 && existingNorm.includes(norm)) || (existingNorm.length > 5 && norm.includes(existingNorm))) {
                if (suggestedRegion && (!LABS[existingKey].region || LABS[existingKey].region === 'eu')) {
                    LABS[existingKey].region = suggestedRegion;
                }
                return existingKey;
            }
        }

        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'];
        const hash = Array.from(canonical).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const color = colors[hash % colors.length];
        const niceName = canonical.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        // ─── HYBRID LOGIC: Use local mapping if known, otherwise use API guess ───
        const finalRegion = CoreLabRegions[canonical] || suggestedRegion || 'eu';

        LABS[canonical] = { name: niceName, color: color, icon: this.getLabIcon(canonical), ticker: null, region: finalRegion };
        
        const techBlds = BLDS.filter(b => b.id !== 'forest_1' && b.id !== 'forest_0' && !b.id.startsWith('house_') && !b.id.startsWith('suburb_') && b.id !== 'metro_east' && b.id !== 'metro_longevity');
        const lastTech = techBlds[techBlds.length - 1];
        const newX = lastTech ? (lastTech.x + lastTech.w + 80) : 100;
        const newW = 140 + (hash % 60); 
        
        const newBld = {
            id: 'bld_' + canonical, name: niceName + ' HQ', w: newW, x: newX, fl: 3, lab: canonical, desc: `Newly zoned headquarters for ${niceName}.`
        };
        
        BLDS.push(newBld);
        this.bldById[newBld.id] = newBld;
        
        if (!this.bldsByLab[canonical]) this.bldsByLab[canonical] = [];
        this.bldsByLab[canonical].unshift(newBld);
        
        this.recalculateZoning();
        
        if (this.bldLayer) { 
            if (typeof Environment !== 'undefined') { Environment.buildGround(); Environment.buildBuildings(); }
            if (this.viewMode === 'macro') this.buildMacroLayer();
        }
        
        if (typeof UI !== 'undefined') UI.addLog(`🏗️ New land zoned for ${niceName} HQ in ${finalRegion.toUpperCase()} Sector!`);
        return canonical;
    },
    

    evolveCity() {
      // Time-gate: don't rebuild more than once every 3 seconds
      const now = Date.now();
      if (this._lastEvolve && now - this._lastEvolve < 3000) {
          if (!this._evolveDeferred) {
              this._evolveDeferred = setTimeout(() => { this._evolveDeferred = null; this.evolveCity(); }, 3000);
          }
          return;
      }
      this._lastEvolve = now;

      // Flip any construction sites whose completion year has arrived
      if (typeof DCManager !== 'undefined') DCManager.checkCompletions();

      // Post data to worker for NEXT cycle's cache
      this._postToWorker();

      // ─── AGGREGATION: Use worker cache if available, else single-pass inline ───
      let topLab = null, cheapestLab = null;
      let perLab, perRegion;

      const wc = this._workerCache;
      if (wc) {
          topLab = wc.topLab;
          cheapestLab = wc.cheapestLab;
          perLab = wc.perLab;
          perRegion = wc.perRegion;
      } else {
          // Inline single-pass fallback (replaces 60+ redundant .filter() calls)
          let topElo = 0, lowestCost = 999;
          perLab = {};
          perRegion = {};

          for (let i = 0; i < this.models.length; i++) {
              const m = this.models[i];
              const isAlive = !m.ret || new Date(m.ret).getTime() > now;

              if (!perLab[m.lab]) perLab[m.lab] = { active: 0, total: 0, osCount: 0, topScore: 0, topName: '' };
              const pl = perLab[m.lab];
              pl.total++;
              if (isAlive) pl.active++;
              if (m.os) pl.osCount++;

              // Benchmark scoring
              let score = 0;
              if (typeof avgBM === 'function') score = avgBM(m.id) || 0;
              if (score === 0) score = (typeof BM !== 'undefined' && BM[m.id]?.ELO) || 0;
              if (score === 0 && typeof BM !== 'undefined') {
                  const bms = BM[m.id] || {};
                  const vals = Object.values(bms).filter(v => typeof v === 'number' && v > 0);
                  if (vals.length > 0) score = vals.reduce((a, b) => a + b, 0) / vals.length;
              }
              if (score >= pl.topScore) { pl.topScore = score; pl.topName = m.name; }

              if (typeof BM !== 'undefined' && BM[m.id]?.ELO > topElo) { topElo = BM[m.id].ELO; topLab = m.lab; }
              if (typeof COSTS !== 'undefined' && COSTS[m.id]?.output > 0 && COSTS[m.id].output < lowestCost) { lowestCost = COSTS[m.id].output; cheapestLab = m.lab; }

              if (isAlive) {
                  const r = (LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
                  perRegion[r] = (perRegion[r] || 0) + 1;
              }
          }
      }

      // ─── Apply aggregated data to buildings ───
      BLDS.forEach(b => {
        if (b.id === 'cafe' || b.id === 'gym' || b.id === 'arena' || b.id === 'open_square') {
            if (b.id === 'cafe') {
                b.dynamicFl = 4; b.w = Math.max(b.w || 0, 160);
                b.desc = 'API Café — the city\'s beloved coffee house. Code reviews over lattes, pastries & rooftop vibes.';
            } else if (b.id === 'gym') {
                b.dynamicFl = 5; b.w = Math.max(b.w || 0, 200);
                b.desc = 'RLHF Gym — five floors of heavy compute training: cardio, weights, combat, yoga & pool.';
            } else if (b.id === 'arena') {
                b.dynamicFl = 5; b.w = Math.max(b.w || 0, 210);
                b.desc = 'LMSYS Chatbot Arena — where models battle for ELO supremacy across five legendary floors.';
            } else if (b.id === 'open_square') {
                b.dynamicFl = 5; b.w = Math.max(b.w || 0, 210);
                b.desc = 'Open Source Hub — collaborative HQ for open-source contributors, hackathons & community servers.';
            }
        }

        if (b.id === 'neon_bar') {
            b.dynamicFl = 3;
            b.desc = 'Late-night karaoke bar. Models unwind and sing their training data.';
        }

        if (b.id.startsWith('res_')) {
            const resRegion = b.id.split('_')[1] || 'eu';
            const count = perRegion[resRegion] || 0;
            b.dynamicFl = Math.max(b.fl || 2, Math.floor(count / 4) + 2);
            b.desc = `High-density residential housing block for AI citizens in the ${resRegion.toUpperCase()} region.`;
            b.tip = `🏢 ${b.name}<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">POPULATION: ${count} Citizens<br>CAPACITY: ${b.dynamicFl * 4} Units</span>`;
            return;
        }

        if (!b.lab) return;

        if (b.id.startsWith('house_')) {
            const founder = typeof REAL_FOUNDERS !== 'undefined' ? REAL_FOUNDERS.find(f => f.lab === b.lab) : null;
            const fName = founder ? founder.name : 'Executive';
            b.desc = `The private residential estate of ${fName}.`;
            b.tip = `🏡 ${fName}'s Estate<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Highly secure, private grounds.<br>Off-limits to standard AI citizens.</span>`;
            return;
        }

        if (b.id.startsWith('dc_') || b.id.startsWith('fab_')) return;

        const pl = perLab[b.lab] || { active: 0, total: 0, osCount: 0, topScore: 0, topName: '' };

        b.dynamicFl = Math.max(b.fl || 3, Math.floor(pl.active / 2) + 2);
        if (b.dynamicFl < 3) b.dynamicFl = 3;

        b.isTopLab = (b.lab === topLab);
        b.isCheapest = (b.lab === cheapestLab);

        const philosophy = pl.osCount >= (pl.total / 2) ? "🟢 Open-Weights Focus" : "🔒 Closed-Weights Focus";
        const flagshipText = pl.topName || (pl.total > 0 ? 'Active' : 'Awaiting Data');
        const modelCount = pl.total;
        const benchInfo = pl.topScore > 0 ? `⚡ AVG SCORE: ${pl.topScore.toFixed(0)}%` : '';

        const baseLore = LABS[b.lab]?.desc || `An emerging AI research facility actively contributing to the global intelligence frontier.`;
        b.desc = baseLore;
        b.tip = `${baseLore}<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">🏢 STAFF: ${modelCount} AI Citizens<br>🧠 FLAGSHIP: ${flagshipText}<br>${benchInfo ? benchInfo + '<br>' : ''}${philosophy}</span>`;
      });

      if (typeof Environment !== 'undefined' && Environment.buildBuildings) Environment.buildBuildings();
    },

    enterInterior(b) {
        // Manual entry (non-tracking) — direct swap, no fade
        this._performEnterInterior(b);
    },

    _performEnterInterior(b) {
        // Save zoom level so we can restore it when exiting
        if (typeof Camera !== 'undefined') this._savedInteriorZoom = Camera.targetZoom;

        this.activeInterior = b.id;

        // Track unique interiors visited for Interior Designer achievement
        if (!this._visitedInteriors[b.id]) {
            this._visitedInteriors[b.id] = true;
            if (Object.keys(this._visitedInteriors).length >= 10) {
                this.unlockAchieve('interior_designer');
            }
        }

        if (typeof SND !== 'undefined') SND.setAmbient(b.id);

        this.world.visible = false;
        if(this.macroLayer) this.macroLayer.visible = false;

        if (!this.interiorLayer) {
            this.interiorLayer = new PIXI.Container();
            this.app.stage.addChild(this.interiorLayer);
        }
        this.interiorLayer.visible = true;

        if (typeof Interior !== 'undefined') {
            Interior.build(b, this.interiorLayer);
        }

        let exitBtn = document.getElementById('btnExitInterior');
        if (!exitBtn) {
            exitBtn = document.createElement('button');
            exitBtn.id = 'btnExitInterior';
            exitBtn.style.cssText = 'position:fixed; top:0px; right:20px; z-index:9999; background:#f43f5e; color:#fff; border:none; border-bottom: 3px solid #be123c; padding:12px 20px; border-radius:0 0 6px 6px; cursor:pointer; font-size:12px; font-weight:bold; font-family:"Press Start 2P", monospace; box-shadow: 0 4px 8px rgba(0,0,0,0.5); transition: background 0.2s; max-width: calc(100vw - 16px);';
            exitBtn.onmouseover = () => { exitBtn.style.background = '#e11d48'; };
            exitBtn.onmouseout = () => { exitBtn.style.background = '#f43f5e'; };
            document.body.appendChild(exitBtn);
        }
        // Reset label + handler every time (train focus relabels/rebinds this same button).
        exitBtn.innerHTML = '🚪 EXIT BUILDING';
        exitBtn.onclick = () => { if(typeof SND !== 'undefined') SND.uiClick(); this.exitInterior(); };
        exitBtn.style.display = 'block';

        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
        // Hide tooltip and Kardashev HUD
        if (typeof UI !== 'undefined') UI.hideTooltip();
        const kHud = document.getElementById('kardashevHUD');
        if (kHud) { kHud.style.opacity = '0'; kHud.style.pointerEvents = 'none'; }
    },

    exitInterior() {
        // Manual exit (non-tracking) — direct swap, no fade
        this._performExitInterior();
    },

    _performExitInterior() {
        this.activeInterior = null;

        if (typeof SND !== 'undefined') SND.setAmbient('outside');
        // Clean up interior module event listeners before destroying PIXI objects
        if (typeof Interior !== 'undefined') Interior.cleanup();
        // Force Environment to re-apply the sky gradient on next frame
        // (interiors like The Underground overwrite vp.style.background directly)
        if (typeof Environment !== 'undefined') Environment._lastSky = null;
        // Destroy all PIXI children to prevent memory leak from accumulated interiors
        if (this.interiorLayer) {
            this.interiorLayer.removeChildren().forEach(c => { if (c.destroy) c.destroy({ children: true, texture: false, baseTexture: false }); });
            this.interiorLayer.visible = false;
        }
        this.world.visible = true;

        const exitBtn = document.getElementById('btnExitInterior');
        if (exitBtn) exitBtn.style.display = 'none';

        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';

        // NO full rebuild here — just let the normal update loop handle positioning.
        // Full rebuilds were causing tracking mode lag and metro passenger teleportation.

        if (typeof Camera !== 'undefined') {
            // Restore zoom: tracking keeps 1.3; AutoTour uses its saved zoom; otherwise restore pre-interior zoom
            if (this.tracking) {
                Camera.targetZoom = 1.3;
            } else if (typeof AutoTour !== 'undefined' && AutoTour.active && AutoTour._userZoom) {
                Camera.targetZoom = AutoTour._userZoom;
            } else {
                Camera.targetZoom = this._savedInteriorZoom || 0.80;
            }
        }
    },

    // ═══════════════════════════════════════════════
    //   TRAIN FOCUS — "board" a train as a real-world camera cutaway.
    //   Unlike building interiors, the world stays VISIBLE: we zoom the camera
    //   onto the chosen train and slice its near wall off (hide the front panel),
    //   so the REAL city, tunnel, NPCs, other trains and riders all show in their
    //   true positions, going past exactly as they do outside.
    // ═══════════════════════════════════════════════
    enterTrainFocus(key) {
        if (!key || typeof Entities === 'undefined' || !Entities[key]) return;
        if (this.activeInterior) this._performExitInterior();   // leave any building first
        if (typeof Camera !== 'undefined') this._savedTrainZoom = Camera.targetZoom;
        this.trainFocus = key;
        if (typeof SND !== 'undefined') SND.setAmbient('train');
        if (typeof InteriorTrain !== 'undefined' && InteriorTrain.enter) InteriorTrain.enter(key);

        let exitBtn = document.getElementById('btnExitInterior');
        if (!exitBtn) {
            exitBtn = document.createElement('button');
            exitBtn.id = 'btnExitInterior';
            exitBtn.style.cssText = 'position:fixed; top:0px; right:20px; z-index:9999; background:#f43f5e; color:#fff; border:none; border-bottom: 3px solid #be123c; padding:12px 20px; border-radius:0 0 6px 6px; cursor:pointer; font-size:12px; font-weight:bold; font-family:"Press Start 2P", monospace; box-shadow: 0 4px 8px rgba(0,0,0,0.5); transition: background 0.2s; max-width: calc(100vw - 16px);';
            exitBtn.onmouseover = () => { exitBtn.style.background = '#e11d48'; };
            exitBtn.onmouseout = () => { exitBtn.style.background = '#f43f5e'; };
            document.body.appendChild(exitBtn);
        }
        exitBtn.innerHTML = '🚪 GET OFF TRAIN';
        exitBtn.onclick = () => { if(typeof SND !== 'undefined') SND.uiClick(); this.exitTrainFocus(); };
        exitBtn.style.display = 'block';

        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        if (typeof UI !== 'undefined') UI.hideTooltip();
    },

    exitTrainFocus() {
        if (!this.trainFocus) return;
        if (typeof InteriorTrain !== 'undefined' && InteriorTrain.exit) InteriorTrain.exit();
        this.trainFocus = null;
        if (typeof SND !== 'undefined') SND.setAmbient('outside');

        const exitBtn = document.getElementById('btnExitInterior');
        if (exitBtn) { exitBtn.style.display = 'none'; exitBtn.innerHTML = '🚪 EXIT BUILDING'; }
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';

        if (typeof Camera !== 'undefined') {
            Camera.targetZoom = this.tracking ? 1.3 : (this._savedTrainZoom || 0.80);
        }
    },

    // Resolve a live train object (e.g. refs._ridingTrain) back to its Entities key
    // ('trainWest'…'trainLongevity') so it can be passed to enterTrainFocus().
    _trainKeyOf(trainObj) {
        if (!trainObj || typeof Entities === 'undefined') return null;
        const keys = ['trainWest', 'trainEast', 'trainMid', 'trainDC', 'trainLongevity'];
        for (const k of keys) {
            if (Entities[k] === trainObj) return k;
        }
        return null;
    },

    // ═══════════════════════════════════════════════
    //   CAMERA TRACKING SYSTEM
    // ═══════════════════════════════════════════════

    startTracking(type, id, lab) {
        // Save zoom so stopTracking can restore it
        if (typeof Camera !== 'undefined') this._savedTrackingZoom = Camera.targetZoom;
        this.tracking = { type, id, lab, _lastBld: null };
        this._transitioning = false;
        // If the entity is already inside a building, force-replay the lobby
        // entry choreography so the first transition shows them walking in.
        this._forceEnteringChoreography(this.tracking, null);

        // Show persistent tracking HUD
        let hud = document.getElementById('trackingHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'trackingHud';
            hud.style.cssText = 'position:absolute; bottom:40px; left:50%; transform:translateX(-50%); z-index:150; background:rgba(10,10,25,0.9); border:1px solid #22d3ee; border-radius:20px; padding:6px 16px; display:flex; align-items:center; gap:10px; font-family:"JetBrains Mono",monospace; font-size:10px; color:#22d3ee; pointer-events:all; box-shadow:0 4px 15px rgba(34,211,238,0.3); animation:slideUp 0.3s ease; max-width:calc(100vw - 24px); flex-wrap:wrap; justify-content:center;';
            document.getElementById('gameWrap').appendChild(hud);
        }

        let name = id;
        if (type === 'ceo') { name = G.ceoRefs[lab]?.f?.name || lab; }
        else if (type === 'model') { name = G.models.find(m => m.id === id)?.name || id; }
        else if (type === 'npc') { const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === id); name = cm ? cm.npc.name : id; }
        else if (type === 'vendor') { const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === id); name = vm ? vm.def.name : id; }
        else if (type === 'vc_commuter') { const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === id); name = cm ? cm.npc.name : id; }

        const activity = this._getTrackingActivity();

        hud.innerHTML = `<span style="animation:pulse 2s infinite">📡</span> <span style="color:#fff;font-weight:bold">${escapeHTML(name)}</span> <span id="trackActivity" style="color:#94a3b8;font-size:9px">${activity}</span> <button onclick="G.stopTracking()" style="background:#f43f5e;color:#fff;border:none;border-radius:10px;padding:2px 10px;font-family:inherit;font-size:9px;cursor:pointer;font-weight:bold">STOP</button>`;
        hud.style.display = 'flex';

        if (typeof UI !== 'undefined') UI.addToast(`📡 Tracking ${name}`);
    },
    
    stopTracking() {
        // If we boarded a train as part of this track, drop the cutaway too so the
        // user isn't left in a "GET OFF TRAIN" cutaway with no active tracking.
        if (this.tracking && this.tracking._trainFollow && this.trainFocus) {
            this.exitTrainFocus();
        }
        this.tracking = null;
        this._transitioning = false;

        const hud = document.getElementById('trackingHud');
        if (hud) hud.style.display = 'none';

        // Clear transition overlay
        const ov = document.getElementById('transitionOverlay');
        if (ov) ov.style.opacity = '0';

        if (typeof Camera !== 'undefined') {
            // Restore zoom: AutoTour uses its saved zoom; otherwise restore pre-tracking zoom
            if (typeof AutoTour !== 'undefined' && AutoTour.active && AutoTour._userZoom) {
                Camera.targetZoom = AutoTour._userZoom;
            } else {
                Camera.targetZoom = this._savedTrackingZoom || 0.80;
            }
        }
    },

    // Returns raw activity code for tracked entity (used for auto-rebuild detection)
    _getTrackingActCode() {
        if (!this.tracking) return null;
        const t = this.tracking;
        if (t.type === 'model') {
            const m = G.models.find(m => m.id === t.id);
            if (m && typeof getStage === 'function' && typeof getAct === 'function') {
                const refs = G.charRefs[t.id];
                if (refs && refs._metroState && refs._metroState !== 'none') return 'metro_' + refs._metroState;
                const stg = getStage(m.rel, m.ret, m.phase);
                const idx = G.models.indexOf(m);
                const dp = G.getDayPhase();
                const { act, bid } = getAct(stg, dp, idx, m);
                return act + ':' + (bid || '');
            }
        } else if (t.type === 'ceo') {
            const ceo = G.ceoRefs ? G.ceoRefs[t.lab] : null;
            if (ceo) {
                if (ceo._inHeli) return 'heli';
                if (ceo.bld) return 'bld:' + ceo.bld;
                return 'driving';
            }
        } else if (t.type === 'npc') {
            const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === t.id);
            if (cm) return cm.state;
        } else if (t.type === 'vendor') {
            const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === t.id);
            if (vm) return vm.state;
        } else if (t.type === 'vc_commuter') {
            const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === t.id);
            if (cm) return cm.state;
        }
        return null;
    },

    _getTrackingActivity() {
        if (!this.tracking) return '';
        const t = this.tracking;

        if (t.type === 'model') {
            // Metro state detection first
            const refs = G.charRefs[t.id];
            if (refs && refs._metroState && refs._metroState !== 'none') {
                if (refs._metroState === 'entering') return '🚇 Heading to Platform';
                if (refs._metroState === 'waiting_train') return '🚇 Waiting for Train';
                if (refs._metroState === 'riding') return '🚇 Riding Metro';
                if (refs._metroState === 'exiting') return '🚇 Leaving Station';
            }
            const m = G.models.find(m => m.id === t.id);
            if (m && typeof getStage === 'function' && typeof getAct === 'function') {
                const stg = getStage(m.rel, m.ret, m.phase);
                const idx = G.models.indexOf(m);
                const dp = G.getDayPhase();
                const { act } = getAct(stg, dp, idx, m);
                const ai = ACTS[act] || { icon: '💻', label: 'Processing' };
                return ai.icon + ' ' + ai.label;
            }
        } else if (t.type === 'ceo') {
            const ceo = G.ceoRefs ? G.ceoRefs[t.lab] : null;
            if (ceo) {
                if (ceo._inHeli) return '🚁 Flying';
                if (ceo.bld) {
                    if (ceo.bld.startsWith('house_')) return '🏠 At Home';
                    if (ceo.bld === 'forest_1') return '🌲 Silicon Woods';
                    return '💼 At Office';
                }
                if (ceo.carCont && ceo.carCont.visible) return '🚗 Driving';
                return '🏙️ Out & About';
            }
        } else if (t.type === 'npc') {
            const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === t.id);
            if (cm) {
                if (cm.state === 'working') return '💼 ' + cm.npc.role;
                if (cm.state === 'commuting_to_work') return '🚶 Commuting to Work';
                if (cm.state === 'commuting_home') return '🚶 Heading Home';
                return '🏠 Resting';
            }
        } else if (t.type === 'vendor') {
            const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === t.id);
            if (vm) {
                if (vm.state === 'vending') return vm.def.emoji + ' Selling ' + vm.def.item;
                if (vm.state === 'commute_to') return '🚶 Setting Up Cart';
                if (vm.state === 'commute_home') return '🚶 Packing Up';
                return '🏠 Resting';
            }
        } else if (t.type === 'vc_commuter') {
            const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === t.id);
            if (cm) {
                if (cm.state === 'at_work') return '💼 ' + cm.npc.role;
                if (cm.state === 'driving_to_work') return '🚗 Driving to Work';
                if (cm.state === 'driving_home') return '🚗 Driving Home';
                return '🏠 Resting';
            }
        }
        return '📡 Tracking';
    },

    _getTransitionOverlay() {
        let ov = document.getElementById('transitionOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'transitionOverlay';
            ov.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:#000;opacity:0;pointer-events:none;transition:opacity 0.2s ease;z-index:200;';
            document.getElementById('gameWrap').appendChild(ov);
        }
        return ov;
    },

    _addTrackHighlight(cont, m, isCeo) {
        if (!G.tracking) return null;
        let isTracked = false;
        const t = G.tracking;
        if (t.type === 'model' && t.id === m.id) isTracked = true;
        if (t.type === 'ceo' && isCeo && t.lab === m.lab) isTracked = true;
        if (t.type === 'npc' && t.id === m.id) isTracked = true;
        if (t.type === 'vendor' && t.id === m.id) isTracked = true;
        if (t.type === 'vc_commuter' && t.id === m.id) isTracked = true;

        if (!isTracked) return null;

        // Pulsing glow ring beneath the avatar
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.35);
        glow.drawEllipse(0, 4, 14, 6);
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChildAt(glow, 0);

        // Bouncing arrow above
        const arrow = new PIXI.Graphics();
        arrow.beginFill(0x22d3ee);
        arrow.moveTo(0, -42);
        arrow.lineTo(-5, -36);
        arrow.lineTo(5, -36);
        arrow.closePath();
        arrow.endFill();
        arrow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(arrow);

        return { glow, arrow };
    },
    
    updateTracking() {
        if (!this.tracking) return;

        let entityBld = null;

        if (this.tracking.type === 'model') {
            const refs = G.charRefs[this.tracking.id];
            if (!refs) return;

            // ── Metro RIDING → real-world train-focus cutaway (NOT the station
            //    interior). A riding model is physically on a moving train between
            //    stations, so projecting it into a station platform centres the
            //    camera on the avatar at track level surrounded by black trackbed/
            //    void. Instead board the real car: enterTrainFocus keeps G.world
            //    visible, zooms onto the actual train and slices its near wall off,
            //    so the real tunnel/city/other riders all show in place. ──
            const ridingTrainKey =
                (refs._metroState === 'riding') ? this._trainKeyOf(refs._ridingTrain) : null;
            if (ridingTrainKey) {
                if (this.trainFocus !== ridingTrainKey) {
                    this.enterTrainFocus(ridingTrainKey);   // also exits any active building interior
                }
                this.tracking._trainFollow = true;
                this.tracking._lastBld = null;
                // Keep the activity label fresh while riding (the early return below
                // skips the periodic refresh at the end of updateTracking).
                if (G.tick % 30 === 0) {
                    const el = document.getElementById('trackActivity');
                    if (el) el.textContent = this._getTrackingActivity();
                }
                return;
            }
            // Left the train (arrived / boarding the next leg) — drop the cutaway so
            // the station-interior follow below can take over for entering/exiting.
            if (this.tracking._trainFollow) {
                if (this.trainFocus) this.exitTrainFocus();
                this.tracking._trainFollow = false;
            }

            entityBld = refs.bld; // null if on street, building id if inside

            // Metro tracking: when the entity is in a metro state, pretend they're
            // "inside" the nearest station so the tracking fade takes us into the
            // metro station interior. Resolves to whichever station's x matches the
            // current leg (or is nearest to refs.c.x if no active leg).
            if (!entityBld && refs._metroState && refs._metroState !== 'none') {
                let targetStationX = null;
                if (refs._metroLegs && refs._currentLeg !== undefined) {
                    targetStationX = refs._metroLegs[refs._currentLeg];
                }
                if (targetStationX == null && refs.c) targetStationX = refs.c.x;
                const stationIds = ['metro_dc', 'metro_res', 'metro_hq', 'metro_mid', 'metro_east', 'metro_longevity'];
                let bestId = null, bestDist = Infinity;
                for (const sid of stationIds) {
                    const sb = this.bldById[sid];
                    if (!sb) continue;
                    const sx = sb.x + sb.w / 2;
                    const d = Math.abs(sx - targetStationX);
                    if (d < bestDist) { bestDist = d; bestId = sid; }
                }
                // Only project into a station if the entity is close to one. While
                // riding between stations we let the inside view continue showing
                // the departure/arrival station (which one is closer wins), so the
                // passenger stays visible the entire trip rather than flickering out.
                if (bestId) entityBld = bestId;
            }
        } else if (this.tracking.type === 'ceo') {
            const ceo = G.ceoRefs ? G.ceoRefs[this.tracking.lab] : null;
            if (!ceo) return;
            entityBld = ceo.bld;
        } else if (this.tracking.type === 'npc') {
            const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === this.tracking.id);
            if (!cm) return;
            entityBld = cm.bld;
        } else if (this.tracking.type === 'vendor') {
            const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === this.tracking.id);
            if (!vm) return;
            entityBld = vm.bld;
        } else if (this.tracking.type === 'vc_commuter') {
            const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === this.tracking.id);
            if (!cm) return;
            entityBld = cm.bld;
        }

        const wasInside = this.tracking._lastBld;
        const isNowInside = entityBld;

        // Entity just entered a building — follow them in (with fade).
        // Force the lobby-walk choreography so we see them step through the
        // front door, past reception, into the elevator and over to their
        // desk/bed instead of teleporting to their final pose.
        if (!wasInside && isNowInside && !this._transitioning) {
            const bld = this.bldById[isNowInside];
            if (bld && !this.activeInterior) {
                this._forceEnteringChoreography(this.tracking, isNowInside);
                this._transitionEnter(bld);
            }
        }

        // Entity just left a building — follow them out (with fade)
        if (wasInside && !isNowInside && !this._transitioning) {
            if (this.activeInterior) {
                this._transitionExit();
            }
        }

        // Entity moved to a DIFFERENT building — transition out then in
        if (wasInside && isNowInside && wasInside !== isNowInside && !this._transitioning) {
            this._transitioning = true;
            const ov = this._getTransitionOverlay();
            ov.style.transition = 'opacity 0.2s ease-in';
            ov.style.opacity = '1';
            setTimeout(() => {
                if (this.activeInterior) this._performExitInterior();
                setTimeout(() => {
                    if (this.tracking) {
                        const bld = this.bldById[isNowInside];
                        if (bld) this._performEnterInterior(bld);
                    }
                    ov.style.transition = 'opacity 0.3s ease-out';
                    ov.style.opacity = '0';
                    setTimeout(() => { this._transitioning = false; }, 300);
                }, 100);
            }, 200);
        }

        this.tracking._lastBld = entityBld;

        // Periodic HUD activity refresh (every 30 ticks ≈ 0.5s)
        if (G.tick % 30 === 0) {
            const el = document.getElementById('trackActivity');
            if (el) el.textContent = this._getTrackingActivity();
        }

        // Auto-rebuild interior when tracked entity's activity changes (every 120 ticks ≈ 2s)
        if (G.tick % 120 === 0 && entityBld && this.activeInterior && !this._transitioning) {
            const curAct = this._getTrackingActCode();
            if (curAct && this.tracking._lastActCode && curAct !== this.tracking._lastActCode) {
                // Activity changed while in same building — soft rebuild with fade
                const bld = this.bldById[entityBld];
                if (bld) this._transitionEnter(bld);
            }
            this.tracking._lastActCode = curAct;
        }
    },

    _transitionEnter(bld) {
        this._transitioning = true;
        const ov = this._getTransitionOverlay();
        ov.style.transition = 'opacity 0.2s ease-in';
        ov.style.opacity = '1';
        setTimeout(() => {
            this._performEnterInterior(bld);
            ov.style.transition = 'opacity 0.3s ease-out';
            ov.style.opacity = '0';
            setTimeout(() => { this._transitioning = false; }, 300);
        }, 200);
    },

    // ─── Force entering-lobby choreography for the tracked entity ────────
    // Without this, an interior built mid-tracking sees `wantsToEnter=false`
    // and spawns the avatar at their desk/bed, looking like a teleport.
    _forceEnteringChoreography(t, _bldId) {
        if (!t) return;
        if (t.type === 'model') {
            const refs = G.charRefs[t.id];
            if (refs) {
                refs.wantsToEnter = true;
                refs.wantsToLeave = false;
                refs._indoorArrived = false;
            }
        } else if (t.type === 'ceo') {
            const ceo = G.ceoRefs ? G.ceoRefs[t.lab] : null;
            if (ceo) {
                ceo.wantsToEnter = true;
                ceo.wantsToLeave = false;
            }
        }
    },

    _transitionExit() {
        this._transitioning = true;
        const ov = this._getTransitionOverlay();
        ov.style.transition = 'opacity 0.2s ease-in';
        ov.style.opacity = '1';
        setTimeout(() => {
            this._performExitInterior();
            ov.style.transition = 'opacity 0.3s ease-out';
            ov.style.opacity = '0';
            setTimeout(() => { this._transitioning = false; }, 300);
        }, 200);
    },
  
    toggleMacro() {
      const btn = document.getElementById('btnMacro');
      const wrap = document.getElementById('gameWrap');
      if (this.viewMode === 'micro') {
        this.viewMode = 'macro'; 
        btn.classList.add('macro-active');
        wrap.classList.add('macro-mode'); 
        btn.innerHTML = '🏙️ Street View';
        this.world.visible = false; 
        this.macroLayer.visible = false;
        // Launch 3D Holomap
        if (typeof Holomap !== 'undefined') Holomap.show();
      } else {
        this.viewMode = 'micro'; 
        btn.classList.remove('macro-active'); 
        wrap.classList.remove('macro-mode'); 
        btn.innerHTML = '🌍 Holomap';
        this.world.visible = true; 
        this.macroLayer.visible = false;
        // Hide 3D Holomap
        if (typeof Holomap !== 'undefined') Holomap.hide();
      }
    },

    // Minimap & macro view → macro_view.js (mixed in via Object.assign)
  
    init() {
      Object.keys(LABS).forEach(key => { 
          if (!LABS[key].icon || LABS[key].icon === '🏗️') { LABS[key].icon = this.getLabIcon(key); } 
          // FIX: CoreLabRegions is the ground-truth for known labs.
          // The old check `if (!LABS[key].region)` never fired because
          // fetchCoreData() already set every lab to 'eu' as a fallback,
          // making the condition always false and bypassing CoreLabRegions entirely.
          if (CoreLabRegions[key]) {
              LABS[key].region = CoreLabRegions[key];
          } else if (!LABS[key].region) {
              LABS[key].region = 'eu';
          }
      });
      
      if (typeof UI !== 'undefined' && UI.selectBld) {
          const origSelect = UI.selectBld;
          UI.selectBld = function(b) {
              origSelect.call(UI, b);
              setTimeout(() => {
                  const p = document.getElementById('infoPanel');
                  if (p && b && b.id !== 'park' && b.id !== 'graveyard' && b.id !== 'visitor_monument' && b.id !== 'city_park' && b.id !== 'ai_index' && b.id !== 'black_market') {
                      const titleArea = p.querySelector('.ipanel-name') || p.querySelector('.ipanel-title');
                      if (!document.getElementById('btnInside')) {
                          const btn = document.createElement('button');
                          btn.id = 'btnInside';
                          btn.innerHTML = '🏢 GO INSIDE';
                          btn.style.cssText = 'background:var(--ac); color:#000; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:10px; margin-left:15px; font-family:"Press Start 2P", monospace; display:inline-block; vertical-align:middle;';
                          btn.onclick = () => { if(typeof SND !== 'undefined') SND.uiClick(); G.enterInterior(b); };
                          
                          if (titleArea) { titleArea.appendChild(btn); } 
                          else { p.insertBefore(btn, p.firstChild); }
                      }
                  }
              }, 50);
          };
      }

      if (typeof SND !== 'undefined') SND.init(); 
      if (typeof NOTIFY !== 'undefined') NOTIFY.init();
      
      this.models = [...SEED];
      this.load();
      if (typeof this.applyAccessibility === 'function') this.applyAccessibility();
      this.pingRings = [];
      
      // Remove nursery building (replaced by University Campus)
      const nurseryIdx = BLDS.findIndex(b => b.id === 'nursery');
      if (nurseryIdx !== -1) BLDS.splice(nurseryIdx, 1);

      BLDS.forEach(b => {
          this.bldById[b.id] = b;
          if (b.lab) { 
              if (!this.bldsByLab[b.lab]) this.bldsByLab[b.lab] = []; 
              if (!b.id.startsWith('house_')) {
                  this.bldsByLab[b.lab].unshift(b); 
              } else {
                  this.bldsByLab[b.lab].push(b); 
              }
          } 
      });
      
      // ─── SPACE ZONE: Inject space buildings before zoning ───
      if (typeof SpaceData !== 'undefined') SpaceData.init();
      
      // ─── Register nightlife activity ───
      if (typeof ACTS !== 'undefined') {
          if (!ACTS.nightlife) ACTS.nightlife = { label: 'Nightlife', verb: 'partying', icon: '🍸', indoor: true };
      }
      
      // ─── Visitor tracking ───
      if (typeof VisitorTracker !== 'undefined') {
          VisitorTracker.init();
          setInterval(() => VisitorTracker.refresh(), 120000); // refresh every 2 min
      }
      
      // ─── COMPUTE DISTRICT: Check construction completions ───
      if (typeof DCManager !== 'undefined') DCManager.checkCompletions();
      
      // ─── NPC HOUSING: Initialize buildings ───
      if (typeof NPCHousing !== 'undefined') NPCHousing.init();
      if (typeof PowerZone !== 'undefined') PowerZone.init();

      // ─── NEW ZONES: University, Court, Conference, Seasonal ───
      if (typeof Seasonal !== 'undefined') Seasonal.init();
      if (typeof UniversityData !== 'undefined') UniversityData.init();
      if (typeof CourtData !== 'undefined') CourtData.init();
      if (typeof JailData !== 'undefined') JailData.init();
      if (typeof CityPark !== 'undefined') CityPark.init();
      if (typeof AIIndex !== 'undefined') AIIndex.init();
      if (typeof BlackMarket !== 'undefined') BlackMarket.init();
      if (typeof ConferenceData !== 'undefined') ConferenceData.init();
      if (typeof VCRow !== 'undefined') VCRow.init();
      if (typeof EmbassyRow !== 'undefined') EmbassyRow.init();
      if (typeof EmbassyQuarter !== 'undefined') EmbassyQuarter.init();
      if (typeof BackboneZone !== 'undefined') BackboneZone.init();
      if (typeof RoboticsZone !== 'undefined') RoboticsZone.init();
      if (typeof LongevityZone !== 'undefined') LongevityZone.init();
      if (typeof AgentsZone !== 'undefined') AgentsZone.init();
      if (typeof AlignmentForest !== 'undefined') AlignmentForest.init();
      if (typeof InteriorNewspaper !== 'undefined') InteriorNewspaper.init();

      this.recalculateZoning(); 
      
      
      this.socialSpots = BLDS.filter(b => ['cafe', 'open_square', 'gym', 'arena', 'forest_0', 'city_park'].includes(b.id));
      
      // Add Frontier Pines as a social destination when a launch is within 2 hours
      if (typeof SpaceData !== 'undefined' && SpaceData.launches && SpaceData.launches.length > 0) {
          const now = Date.now();
          const imminentLaunch = SpaceData.launches.find(l => {
              const diff = new Date(l.net).getTime() - now;
              return diff > -300000 && diff < 7200000; // within 2 hours or just happened
          });
          if (imminentLaunch) {
              const fp = BLDS.find(b => b.id === 'forest_space');
              if (fp && !this.socialSpots.includes(fp)) {
                  this.socialSpots.push(fp);
              }
          }
      }
  
      const vp = document.getElementById('viewport'); 
      this.vpW = window.innerWidth; 
      this.vpH = window.innerHeight;
      this.groundY = this.vpH - 56;
      
      // Cap DPR at 1.5 — pixel art looks identical above this, but render cost scales quadratically.
      // At 2x DPR on a 1920x1080 desktop, internal buffer is 3840x2160 (8.3M px/frame).
      // At 1.5x it drops to 2880x1620 (4.7M px/frame) — ~43% reduction with zero visible difference.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.app = new PIXI.Application({ width: this.vpW, height: this.vpH, backgroundAlpha: 0, antialias: false, resolution: dpr, autoDensity: true });
      // Cap the ticker at 60fps — the sim uses raw tick counting (tick++/frame) and
      // every throttle ("% 2 === 0") assumes 60Hz. Without this, 120–165Hz displays
      // run the whole city at 2x+ speed and burn double the CPU for no visual gain.
      this.app.ticker.maxFPS = 60;
      vp.appendChild(this.app.view);
      this.app.view.style.touchAction = 'none';

      // Bake bitmap fonts once — must happen before any in-world text is created.
      // See js/bitmap_fonts.js for the list and rationale.
      if (typeof BitmapFonts !== 'undefined') BitmapFonts.init();

      // ─── RESIZE HANDLER ───
      // groundY is a WORLD coordinate, not a screen coordinate.
      // It is set ONCE at init and NEVER changes. The camera maps world→screen.
      // Read from window (not vp element) to avoid feedback loop with canvas resize.
      window.addEventListener('resize', () => {
          this.vpW = window.innerWidth;
          this.vpH = window.innerHeight;
          this.app.renderer.resize(this.vpW, this.vpH);
          if (this.viewMode === 'macro') this.buildMacroLayer();
          if (typeof OrbitMode !== 'undefined') OrbitMode.resize();
      });
      
      // Alt-tab: browser toolbar may appear/disappear without firing resize
      // Also keep simulation running in background at reduced tick rate
      this._bgInterval = null;
      document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
              // Browser pauses rAF when tab is hidden — run sim at ~2 tps instead.
              // Skip if the Terminal's own simPump is already stepping the sim,
              // otherwise both pumps run G.loop() and the sim ticks ~20% fast.
              if (!this._bgInterval && !(typeof Terminal !== 'undefined' && Terminal._simPump)) {
                  this._bgInterval = setInterval(() => this.loop(), 500);
              }
          } else {
              // Tab visible again — stop background ticker, let rAF resume
              if (this._bgInterval) {
                  clearInterval(this._bgInterval);
                  this._bgInterval = null;
              }
              this.vpW = window.innerWidth;
              this.vpH = window.innerHeight;
              this.app.renderer.resize(this.vpW, this.vpH);
              // Re-acquire wake lock (released when screen turns off)
              if (window.isMobile && typeof _requestWakeLock === 'function') _requestWakeLock();
          }
      });
      
      this.world = new PIXI.Container(); 
      this.macroLayer = new PIXI.Container(); 
      this.app.stage.addChild(this.world); 
      this.app.stage.addChild(this.macroLayer); 
      this.macroLayer.visible = false;
      
      if (PIXI.filters && PIXI.filters.AdvancedBloomFilter) {
          this.bloomFilter = new PIXI.filters.AdvancedBloomFilter({ threshold: 0.6, bloomScale: 0.6, brightness: 1.0, blur: 4, quality: 2 });
          this.world.filters = [this.bloomFilter];
          this.crtFilter = new PIXI.filters.CRTFilter({ curvature: 2, lineContrast: 0.25, vignetting: 0.3, vignettingAlpha: 0.7, noise: 0.15, seed: Math.random() });
          this.glitchFilter = new PIXI.filters.GlitchFilter({ slices: 6, offset: 4, direction: 0, fillMode: 2, average: false }); 
          this.macroLayer.filters = [this.crtFilter, this.glitchFilter];
      }
  
      this.starsLayer = new PIXI.Container(); 
      this.celestialGfx = new PIXI.Graphics(); 
      this.cloudLayer = new PIXI.Container();
      this.bldLayer = new PIXI.Container(); 
      this.groundGfx = new PIXI.Graphics(); 
      this.reflectionLayer = new PIXI.Container();
      this.undergroundLayer = new PIXI.Container();
      this.trainLayer = new PIXI.Container();
      
      this.charLayer = new PIXI.Container();
      this.charLayer.sortableChildren = true;
      this.carLayer = new PIXI.Container();
      this.carLayer.sortableChildren = true;
      this.lightLayer = new PIXI.Container(); 
      this.lightLayer.alpha = 0; 
      this.staticLightsGfx = new PIXI.Graphics();
      this.lightLayer.addChild(this.staticLightsGfx);
      this.fxGfx = new PIXI.Graphics();
      // ─── Phase 6: shadow layer sits on top of groundGfx, below everything else ───
      this.shadowLayer = new PIXI.Container();

      this.world.addChild(this.starsLayer, this.celestialGfx, this.cloudLayer, this.bldLayer, this.undergroundLayer, this.groundGfx, this.shadowLayer, this.trainLayer, this.reflectionLayer, this.charLayer, this.carLayer, this.lightLayer, this.fxGfx);

      if (typeof Shadows !== 'undefined') Shadows.init(this.shadowLayer);
      
      if (typeof Environment !== 'undefined') {
          Environment.init({ starsLayer: this.starsLayer, celestialGfx: this.celestialGfx, cloudLayer: this.cloudLayer, bldLayer: this.bldLayer, groundGfx: this.groundGfx, reflectionLayer: this.reflectionLayer, staticLightsGfx: this.staticLightsGfx, lightLayer: this.lightLayer, fxGfx: this.fxGfx });
      }

      // ─── SEASONAL & AURORA: Initialize visual overlay systems ───
      if (typeof SeasonalEnv !== 'undefined') SeasonalEnv.init({ bldLayer: this.bldLayer, fxGfx: this.fxGfx });
      if (typeof Aurora !== 'undefined') Aurora.init();
      // ─── CITY AMBIENCE: parallax skylines, color grading, night lighting, vignettes ───
      if (typeof CityAmbience !== 'undefined') CityAmbience.init();

      if (typeof Entities !== 'undefined') {
          Entities.init({ 
              charLayer: this.charLayer, 
              carLayer: this.carLayer, 
              reflectionLayer: this.reflectionLayer, 
              lightLayer: this.lightLayer,
              undergroundLayer: this.undergroundLayer, 
              trainLayer: this.trainLayer              
          });
      }
      
      // ─── NPC HOUSING: Spawn commuter NPCs ───
      if (typeof NPCHousing !== 'undefined' && this.charLayer) {
          NPCHousing.spawnCommuters(this.charLayer);
      }
      // ─── STREET VENDORS: Food carts in tech district ───
      if (typeof StreetVendors !== 'undefined' && this.charLayer) {
          StreetVendors.init(this.charLayer);
      }
      // ─── LAYER-DEPENDENT INITS: These need charLayer/carLayer to exist ───
      if (typeof BirdFlocks !== 'undefined' && this.charLayer) BirdFlocks.init(this.charLayer);
      if (typeof HNBlimps !== 'undefined' && this.charLayer) HNBlimps.init({ charLayer: this.charLayer });
      if (typeof SupplyChain !== 'undefined' && this.carLayer) SupplyChain.init(this.carLayer);
      
      // ─── LAZY ZONE BOOT: Defer heavy visual animations until camera enters each zone ───
      // Each *Env.buildAnimations() call spawns 50-120 PIXI.Graphics (pulses, LEDs, fog,
      // particles). The player only sees one zone at a time, so firing all six at boot
      // wastes ~400-600 sprite allocations + their texture uploads before the first frame
      // is drawn. Instead we register each zone with an X range and a boot fn. The per-frame
      // `_checkLazyZones()` pass fires the boot fn when the camera's visible world range
      // (with one-viewport margin) first overlaps the zone bounds. After boot the zone's
      // Env.update() takes over exactly as before.
      this._lazyZones = [];
      const self = this;
      const registerLazy = (name, boundsFn, bootFn) => {
          self._lazyZones.push({ name, boundsFn, bootFn, booted: false });
      };

      if (typeof PortEnv !== 'undefined' && typeof PortZone !== 'undefined') {
          registerLazy('port',
              () => {
                  // Cover ocean + port buildings — buildOceanLife spawns fish across the
                  // whole port building span, so wait until the camera is within that range.
                  const pBlds = (typeof BLDS !== 'undefined') ? BLDS.filter(b => b.id && b.id.startsWith('port_')) : [];
                  let x0 = (PortZone.oceanStartX || 0) - 200;
                  let x1 = (PortZone.oceanEndX || 0) + 200;
                  if (pBlds.length) {
                      x0 = Math.min(x0, Math.min.apply(null, pBlds.map(b => b.x)) - 200);
                      x1 = Math.max(x1, Math.max.apply(null, pBlds.map(b => b.x + b.w)) + 200);
                  }
                  return { x0, x1 };
              },
              () => { PortEnv.buildShips(self.charLayer); PortEnv.buildOceanLife(self.charLayer); });
      }
      if (typeof PowerEnv !== 'undefined' && typeof PowerZone !== 'undefined') {
          registerLazy('power',
              () => ({ x0: PowerZone.zoneStartX, x1: PowerZone.zoneEndX }),
              () => PowerEnv.buildAnimations(self.charLayer));
      }
      if (typeof VCRowEnv !== 'undefined' && typeof VCRow !== 'undefined') {
          registerLazy('vcrow',
              () => ({ x0: VCRow.zoneStartX, x1: VCRow.zoneEndX }),
              () => VCRowEnv.buildAnimations(self.charLayer));
      }
      if (typeof BackboneEnv !== 'undefined' && typeof BackboneZone !== 'undefined') {
          registerLazy('backbone',
              () => ({ x0: BackboneZone.zoneStartX, x1: BackboneZone.zoneEndX }),
              () => BackboneEnv.buildAnimations(self.charLayer));
      }
      if (typeof RoboticsEnv !== 'undefined' && typeof RoboticsZone !== 'undefined') {
          registerLazy('robotics',
              () => ({ x0: RoboticsZone.zoneStartX, x1: RoboticsZone.zoneEndX }),
              () => RoboticsEnv.buildAnimations(self.charLayer));
      }
      if (typeof LongevityEnv !== 'undefined' && typeof LongevityZone !== 'undefined') {
          registerLazy('longevity',
              () => ({ x0: LongevityZone.zoneStartX, x1: LongevityZone.zoneEndX }),
              () => LongevityEnv.buildAnimations(self.charLayer));
      }
      if (typeof AgentsEnv !== 'undefined' && typeof AgentsZone !== 'undefined') {
          registerLazy('agents',
              () => ({ x0: AgentsZone.zoneStartX, x1: AgentsZone.zoneEndX }),
              () => AgentsEnv.buildAnimations(self.charLayer));
      }

      // VC Row cars and Space rockets are spawned immediately because they already have
      // their own internal on/off logic and their count is small (<30 combined).
      if (typeof VCRow !== 'undefined' && this.carLayer) {
          VCRow.spawnCars(this.carLayer);
      }

      // ─── MULTIPLAYER PRESENCE: Ghost cursors + reactions ───
      if (typeof Multiplayer !== 'undefined') {
          Multiplayer.init(this.charLayer);
      }

      // ─── SPACE ENTITIES: Rockets on launch pads ───
      if (typeof SpaceEntities !== 'undefined') {
          SpaceEntities.init(this.carLayer);
      }

      // ─── COMPUTE WORKER: Offload model data crunching to separate thread ───
      this._workerCache = null;
      if (typeof Worker !== 'undefined') {
          try {
              this._computeWorker = new Worker('js/compute_worker.js');
              this._computeWorker.onmessage = (e) => {
                  if (e.data.type === 'crunched') this._workerCache = e.data.payload;
              };
              this._computeWorker.onerror = () => { this._computeWorker = null; };
          } catch(ex) { /* Worker unavailable — will use inline fallback */ }
      }

      this.evolveCity(); 
      if (typeof Entities !== 'undefined') {
          this.models.forEach(m => Entities.createChar(m));
      }
      
      if (typeof Camera !== 'undefined') {
          Camera.init();
          if (this.savedCamX !== undefined) {
              Camera.x = this.savedCamX;
              Camera.targetX = this.savedCamX;
          }
      }

      // Kardashev Scale — build HUD gauge after initial data loads
      if (typeof Kardashev !== 'undefined') {
          setTimeout(() => { if (typeof Kardashev !== 'undefined') { Kardashev.calculate(); Kardashev.buildHUD(); Kardashev.updateHUD(); } }, 8000);
      }
      
      if (typeof API !== 'undefined') {
          API.fetchLiveNews();
          setInterval(() => API.fetchLiveNews(), 10 * 60 * 1000);
          if (this.finnhubKey) API.fetchStocks();
          setInterval(() => { 
              API.newsIdx = (API.newsIdx + 1) % (API.liveNews.length || NEWS.length || 1); 
              if (typeof UI !== 'undefined') UI.updateTicker(); 
          }, 6000);
      }
      
      // ─── SPACE ZONE: Fetch upcoming launches ───
      if (typeof SpaceData !== 'undefined') {
          SpaceData.fetchLaunches();
          setInterval(() => SpaceData.fetchLaunches(), 30 * 60 * 1000); // every 30 min
      }
      
      // ─── HUGGING FACE: Trending open-source model discovery ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchHuggingFace(), 5000); // initial fetch after 5s
          setInterval(() => API.fetchHuggingFace(), 15 * 60 * 1000); // every 15 min
      }
      
      // ─── ZEROEVAL: Benchmark, pricing & model data (free, no-auth) ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchZeroEval(), 8000); // initial fetch after 8s
          setInterval(() => API.fetchZeroEval(), 20 * 60 * 1000); // every 20 min
      }

      // ─── OPENROUTER: Catches beta/preview models before GA (free, no-auth) ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchOpenRouter(), 11000); // initial fetch after 11s
          setInterval(() => API.fetchOpenRouter(), 25 * 60 * 1000); // every 25 min
      }

      // ─── COINGECKO: Live crypto prices for the Cryptex Exchange ticker ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchCoinGecko(), 3000); // fast initial fetch so ticker lights up quickly
          setInterval(() => API.fetchCoinGecko(), 2 * 60 * 1000); // every 2 min (well under 30/min free tier)
      }

      // ─── AUTO-PURGE HALLUCINATIONS: After ZeroEval + HF have loaded, scrub the LOCAL
      // model list of any models that aren't in the verified registry. (The cloud DB is
      // scrubbed server-side by the db-maintenance scheduled function — the browser's
      // anon key deliberately has no DELETE rights; see sc_models_rls.sql.)
      if (typeof API !== 'undefined') {
          setTimeout(() => {
              if (typeof API.purgeHallucinations === 'function') {
                  API.purgeHallucinations();
              }
          }, 15000); // 7s after ZeroEval, giving HF + ZeroEval time to populate the registry
          // Re-run every 30 min to catch anything new from periodic LLM scans
          setInterval(() => {
              if (typeof API.purgeHallucinations === 'function') {
                  API.purgeHallucinations();
              }
          }, 30 * 60 * 1000);
      }

      // ─── AUTO-DEDUPE: Collapse same-name models written under different IDs by
      // separate sources (LLM scan vs OpenRouter vs ZeroEval). Local display only —
      // cloud reconciliation happens in the db-maintenance scheduled function.
      // Runs AFTER purge so we don't dedupe against models about to be filtered.
      if (typeof API !== 'undefined') {
          setTimeout(() => {
              if (typeof API.dedupeModels === 'function') {
                  API.dedupeModels();
              }
          }, 20000);
          setInterval(() => {
              if (typeof API.dedupeModels === 'function') {
                  API.dedupeModels();
              }
          }, 30 * 60 * 1000);
      }

      // ─── LIVE DATA: VC Funding, Supply Chain, Regulation News, arXiv Papers, RSS Deals ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchVCFunding(), 10000);
          setTimeout(() => API.fetchSupplyChain(), 12000);
          setTimeout(() => API.fetchRegulationNews(), 15000);
          setTimeout(() => API.fetchArxivPapers(), 18000);
          setTimeout(() => API.fetchVCDealsRSS(), 22000);            // RSS VC deal headlines
          setTimeout(() => API.fetchSupplyChainNews(), 26000);       // RSS semiconductor news
          setTimeout(() => API.fetchNetworkStatus(), 30000);         // Cloud status for Backbone
          setTimeout(() => API.fetchAIEvents(), 34000);              // AI events calendar from RSS + LLM
          setTimeout(() => API.fetchGlobalGrid(), 40000);              // Global power grid from OSM Overpass
          setInterval(() => API.fetchVCFunding(), 30 * 60 * 1000);        // every 30 min
          setInterval(() => API.fetchSupplyChain(), 60 * 60 * 1000);      // every hour
          setInterval(() => API.fetchRegulationNews(), 15 * 60 * 1000);   // every 15 min
          setInterval(() => API.fetchArxivPapers(), 60 * 60 * 1000);      // every hour
          setInterval(() => API.fetchVCDealsRSS(), 30 * 60 * 1000);      // every 30 min
          setInterval(() => API.fetchSupplyChainNews(), 60 * 60 * 1000);  // every hour
          setInterval(() => API.fetchNetworkStatus(), 15 * 60 * 1000);    // every 15 min
      }
      
      this.startAutoScan(); 
      if (typeof UI !== 'undefined') UI.updateSoundBtn();
      
      this.initMinimap();
      this.initEasterEggs();
      if (typeof Debug !== 'undefined') Debug.init();
      if (typeof AutoTour !== 'undefined') AutoTour.init();
      if (typeof Newspaper !== 'undefined') Newspaper.init();

      window.addEventListener('beforeunload', () => {
          this.save();
          if (typeof Multiplayer !== 'undefined') Multiplayer.destroy();
      });

      this.app.ticker.add(() => this.loop());
    },
  
    // buildMacroLayer → macro_view.js (mixed in via Object.assign)

    // Off-screen cull stats (read by debug overlay)
    _cullStats: { chars: 0, cars: 0, vendors: 0, total: 0, hidden: 0 },

    // Lazy zone boot — fires each zone's heavy buildAnimations() call only once the
    // camera's visible world range (with one-viewport margin) first overlaps it.
    // Called from update() every frame. Cheap linear scan of 6 entries.
    _checkLazyZones() {
      if (!this._lazyZones || !this._lazyZones.length || typeof Camera === 'undefined') return;
      const zoom = Camera.zoom || 1;
      const vpW = this.vpW || 800;
      const worldLeft = -Camera.x;
      const worldRight = worldLeft + vpW / zoom;
      const margin = vpW / zoom; // pre-boot one viewport before it enters
      const minX = worldLeft - margin;
      const maxX = worldRight + margin;

      for (let i = 0; i < this._lazyZones.length; i++) {
          const z = this._lazyZones[i];
          if (z.booted) continue;
          let b;
          try { b = z.boundsFn(); } catch (e) { continue; }
          if (!b || !isFinite(b.x0) || !isFinite(b.x1)) continue;
          // Overlap test: camera visible range overlaps zone X range
          if (b.x1 >= minX && b.x0 <= maxX) {
              try { z.bootFn(); } catch (e) { console.warn('Lazy zone boot failed:', z.name, e); }
              z.booted = true;
          }
      }
    },

    // Debug helper: how many zones have booted
    _lazyZoneStats() {
      if (!this._lazyZones) return { booted: 0, total: 0 };
      let booted = 0;
      for (let i = 0; i < this._lazyZones.length; i++) if (this._lazyZones[i].booted) booted++;
      return { booted, total: this._lazyZones.length };
    },

    // Cull objects whose world X is outside the camera viewport. Uses a
    // horizontal-only check — the city is wide and flat, so vertical culling
    // wouldn't save much. A margin of one viewport width on each side hides the
    // cost of characters walking in at the edge.
    //
    // Avatars get DEEP-POOLED: each is ~17 display objects (905 models ≈ 15k in
    // charLayer at boot), and `renderable=false` still leaves them in PIXI's
    // transform pass and the charLayer zIndex sort. Detaching off-screen and
    // hidden-indoors avatars from the tree entirely cuts charLayer to a few
    // thousand objects (~30% faster renders, measured v519). Sim state in
    // entities.js keeps running while detached — it reads/writes refs.c.x/y
    // directly and has its own off-screen throttles.
    _cullOffScreen() {
      if (typeof Camera === 'undefined' || !this.world) return;
      const zoom = Camera.zoom || 1;
      const vpW = this.vpW || 800;
      // Visible world X range (see camera.js: world.x = Camera.x * zoom)
      const worldLeft = -Camera.x;
      const worldRight = worldLeft + vpW / zoom;
      const margin = vpW / zoom; // one viewport of padding either side
      const minX = worldLeft - margin;
      const maxX = worldRight + margin;

      let cChars = 0, cCars = 0, cVend = 0, total = 0, hidden = 0;

      // Characters — pool: detach when off-screen or hidden indoors, re-attach
      // when the sim wants them shown again. ONLY ever detach from charLayer:
      // metro riders live on metroRiderCont/trainLayer via the entities.js
      // layer-swap (_inTrainLayer) and must not be touched here.
      const refs = this.charRefs;
      const layer = this.charLayer;
      if (refs && layer) {
          for (const id in refs) {
              const r = refs[id];
              if (!r || !r.c) continue;
              total++;
              const c = r.c;
              const onScreen = c.x >= minX && c.x <= maxX;
              const wanted = onScreen && c.visible !== false;
              if (c.parent === layer) {
                  if (wanted) {
                      r._pooled = false;
                  } else {
                      layer.removeChild(c);
                      r._pooled = true;
                  }
              } else if (!c.parent && r._pooled) {
                  if (wanted) {
                      c.renderable = true; // clear any stale flag from pre-pool builds
                      layer.addChild(c);
                      r._pooled = false;
                  }
              } else if (c.parent) {
                  // On another layer (metro rider) — legacy renderable culling only
                  if (c.renderable !== onScreen) c.renderable = onScreen;
              }
              if (!wanted) { cChars++; hidden++; }
          }
      }

      // Cars (c.gfx is the sprite). Respect existing .visible flag — we only flip
      // renderable, not visibility, so port/teleport logic continues to work.
      if (this.cars && this.cars.length) {
          for (let i = 0; i < this.cars.length; i++) {
              const car = this.cars[i];
              if (!car || !car.gfx) continue;
              total++;
              const onScreen = car.gfx.x >= minX && car.gfx.x <= maxX;
              if (car.gfx.renderable !== onScreen) car.gfx.renderable = onScreen;
              if (!onScreen) { cCars++; hidden++; }
          }
      }

      // Street vendors (avatar + stall)
      if (typeof StreetVendors !== 'undefined' && StreetVendors.vendors) {
          const v = StreetVendors.vendors;
          for (let i = 0; i < v.length; i++) {
              const vm = v[i];
              if (!vm || !vm.c) continue;
              total++;
              const onScreen = vm.c.x >= minX && vm.c.x <= maxX;
              if (vm.c.renderable !== onScreen) vm.c.renderable = onScreen;
              if (vm.stall && vm.stall.cont) vm.stall.cont.renderable = onScreen;
              if (!onScreen) { cVend++; hidden++; }
          }
      }

      const s = this._cullStats;
      s.chars = cChars; s.cars = cCars; s.vendors = cVend;
      s.total = total; s.hidden = hidden;
    },

    loop() {
      this.tick++;
      if(this.viewMode === 'micro' && typeof Entities !== 'undefined') { 
          if (this.tick > this.nextCarTick) { 
              Entities.spawnCar();
              this.nextCarTick = this.tick + 600 + Math.floor(Math.random() * 800); 
          } 
          Entities.updateChatBubbles(this.getDayPhase());
      }
      // Tracking runs every frame, even during interiors, to detect transitions
      if (this.tracking) this.updateTracking();
      // Minimap update every 10 frames
      if (this.tick % 10 === 0) this.updateMinimap();
      this.update();
      // Debug overlay — cheap no-op when hidden, samples frame time when visible
      if (typeof Debug !== 'undefined' && Debug.active) Debug.update();
    },
  
    update() {
      // Auto-tour runs first so it can self-bail when a blocking mode activates.
      // Cheap no-op when inactive (just an idle timer check).
      if (typeof AutoTour !== 'undefined') AutoTour.update();

      // Orbit Mode runs independently — update even during transitions
      if (typeof OrbitMode !== 'undefined' && (OrbitMode.active || OrbitMode._transitioning)) {
          OrbitMode.update();
          if (OrbitMode.active && !OrbitMode._transitioning) return; // fully in orbit — skip city updates
          // During transition, continue with city updates below for smooth crossfade
      }

      if (this.activeInterior && typeof Interior !== 'undefined') {
          Interior.update();
          // HUD elements that should still tick during interior mode
          if (typeof Kardashev !== 'undefined') Kardashev.tick();
          if (typeof Camera !== 'undefined' && Camera._updateZoomPill) Camera._updateZoomPill();
          // Keep entity simulation alive so trains, NPCs, CEOs, cars etc. never
          // freeze while the player is viewing any interior.
          const dp = this.getDayPhase();
          const night = dp > .83 || dp < .25;
          if (typeof Entities !== 'undefined') Entities.update(dp, night);
          if (typeof NPCHousing !== 'undefined') NPCHousing.update(dp);
          if (typeof StreetVendors !== 'undefined') StreetVendors.update(dp);
          if (typeof VCRow !== 'undefined') { VCRow.update(); VCRow.updateCommuters(dp); }
          if (typeof SupplyChain !== 'undefined') SupplyChain.update();
          // Keep rocket state machine ticking so launchpad observation windows
          // can mirror live liftoffs while the player is inside.
          if (typeof SpaceEntities !== 'undefined') SpaceEntities.update();
          // Camera keeps tracking target updated for seamless interior↔exterior transitions
          if (typeof Camera !== 'undefined') Camera.update();
          return;
      }

      if(this.viewMode === 'macro') {
        if(this.macroLayer.alpha < 1) this.macroLayer.alpha += 0.05;
        if(this.centerNodeGfx) this.centerNodeGfx.scale.set(1 + Math.sin(this.tick * 0.05) * 0.1);
        if (this.crtFilter && this.glitchFilter) { 
            this.crtFilter.time += 0.3; 
            this.crtFilter.seed = Math.random();
            if (Math.random() > 0.98 && this.glitchFilter.offset < 5) { 
                this.glitchFilter.refresh(); 
                this.glitchFilter.offset = 2 + Math.random() * 4;
            } else if(this.glitchFilter.offset > 0) { 
                this.glitchFilter.offset *= 0.8; 
                if(this.glitchFilter.offset < 0.5) this.glitchFilter.offset = 0;
            } 
        }
        return;
      }

      if (typeof Camera !== 'undefined') Camera.update();

      // Keep the train-cutaway in sync (front held open, riders/seats positioned)
      // while "boarded". Runs in the normal path so the whole city stays live.
      if (this.trainFocus && typeof InteriorTrain !== 'undefined' && InteriorTrain.update) InteriorTrain.update();

      // Zone-based ambient sound (every ~30 frames ≈ 0.5s)
      if (!this.activeInterior && typeof SND !== 'undefined' && typeof Camera !== 'undefined' && this.tick % 30 === 0) {
          const wcx = -Camera.x + G.vpW / (2 * Camera.zoom);
          let zone = 'outside';
          if (this.zoneBounds) {
              for (const zb of this.zoneBounds) {
                  if (wcx >= zb.x0 && wcx <= zb.x1) { zone = 'zone_' + zb.zone; break; }
              }
          }
          SND.setAmbient(zone);
      }

      // Cull BEFORE entity updates — renderable flags let entities.js skip more work
      this._cullOffScreen();

      const dp = this.getDayPhase();
      const night = dp > .83 || dp < .25;
      const targetLightAlpha = night ? 1 : 0;
      this.lightLayer.alpha += (targetLightAlpha - this.lightLayer.alpha) * 0.05;

      // ─── Cache subsystem references once (avoids ~30 typeof checks per frame) ───
      if (!this._subsys) {
          this._subsys = {
              Entities: typeof Entities !== 'undefined' ? Entities : null,
              Environment: typeof Environment !== 'undefined' ? Environment : null,
              SpaceEntities: typeof SpaceEntities !== 'undefined' ? SpaceEntities : null,
              NPCHousing: typeof NPCHousing !== 'undefined' ? NPCHousing : null,
              StreetVendors: typeof StreetVendors !== 'undefined' ? StreetVendors : null,
              PortEnv: typeof PortEnv !== 'undefined' ? PortEnv : null,
              PowerEnv: typeof PowerEnv !== 'undefined' ? PowerEnv : null,
              VCRowEnv: typeof VCRowEnv !== 'undefined' ? VCRowEnv : null,
              BackboneEnv: typeof BackboneEnv !== 'undefined' ? BackboneEnv : null,
              BackboneZone: typeof BackboneZone !== 'undefined' ? BackboneZone : null,
              RoboticsEnv: typeof RoboticsEnv !== 'undefined' ? RoboticsEnv : null,
              RoboticsZone: typeof RoboticsZone !== 'undefined' ? RoboticsZone : null,
              LongevityEnv: typeof LongevityEnv !== 'undefined' ? LongevityEnv : null,
              LongevityZone: typeof LongevityZone !== 'undefined' ? LongevityZone : null,
              AgentsEnv: typeof AgentsEnv !== 'undefined' ? AgentsEnv : null,
              AgentsZone: typeof AgentsZone !== 'undefined' ? AgentsZone : null,
              XRayMode: typeof XRayMode !== 'undefined' ? XRayMode : null,
              VCRow: typeof VCRow !== 'undefined' ? VCRow : null,
              Multiplayer: typeof Multiplayer !== 'undefined' ? Multiplayer : null,
              SeasonalEnv: typeof SeasonalEnv !== 'undefined' ? SeasonalEnv : null,
              Aurora: typeof Aurora !== 'undefined' ? Aurora : null,
              UniversityData: typeof UniversityData !== 'undefined' ? UniversityData : null,
              UniversityEnv: typeof UniversityEnv !== 'undefined' ? UniversityEnv : null,
              CourtData: typeof CourtData !== 'undefined' ? CourtData : null,
              JailData: typeof JailData !== 'undefined' ? JailData : null,
              CityPark: typeof CityPark !== 'undefined' ? CityPark : null,
              BirdFlocks: typeof BirdFlocks !== 'undefined' ? BirdFlocks : null,
              HNBlimps: typeof HNBlimps !== 'undefined' ? HNBlimps : null,
              NewsReactivity: typeof NewsReactivity !== 'undefined' ? NewsReactivity : null,
              CitizenOfDay: typeof CitizenOfDay !== 'undefined' ? CitizenOfDay : null,
              DailyBriefing: typeof DailyBriefing !== 'undefined' ? DailyBriefing : null,
              EmbassyRow: typeof EmbassyRow !== 'undefined' ? EmbassyRow : null,
              EmbassyQuarter: typeof EmbassyQuarter !== 'undefined' ? EmbassyQuarter : null,
              AlignmentForest: typeof AlignmentForest !== 'undefined' ? AlignmentForest : null,
              Shadows: typeof Shadows !== 'undefined' ? Shadows : null,
              AIIndex: typeof AIIndex !== 'undefined' ? AIIndex : null,
              SupplyChain: typeof SupplyChain !== 'undefined' ? SupplyChain : null,
              BlackMarket: typeof BlackMarket !== 'undefined' ? BlackMarket : null,
              ConferenceData: typeof ConferenceData !== 'undefined' ? ConferenceData : null,
              Kardashev: typeof Kardashev !== 'undefined' ? Kardashev : null,
              CityAmbience: typeof CityAmbience !== 'undefined' ? CityAmbience : null,
          };
      }
      const S = this._subsys;

      let occ = {};
      if (S.Entities) occ = S.Entities.update(dp, night);
      if (S.Environment) S.Environment.update(dp, night, occ);
      if (S.CityAmbience) S.CityAmbience.update(dp, night); // parallax runs every frame for smooth scroll
      if (S.SpaceEntities) S.SpaceEntities.update();
      if (S.NPCHousing) S.NPCHousing.update(dp);
      if (S.StreetVendors) S.StreetVendors.update(dp);
      if (S.PortEnv) S.PortEnv.update();
      if (S.SupplyChain) S.SupplyChain.update();
      // Throttle purely-visual zone envs to every other frame (smooth at 30fps)
      if (this.tick % 2 === 0) {
          if (S.PowerEnv) S.PowerEnv.update();
          if (S.BackboneEnv) S.BackboneEnv.update();
          if (S.LongevityEnv) S.LongevityEnv.update();
      }
      if (S.VCRowEnv) S.VCRowEnv.update();
      if (S.BackboneZone) S.BackboneZone.update();
      if (S.RoboticsEnv) S.RoboticsEnv.update();
      if (S.RoboticsZone) S.RoboticsZone.update();
      if (S.LongevityZone) S.LongevityZone.update();
      if (S.AgentsEnv) S.AgentsEnv.update();
      if (S.AgentsZone) S.AgentsZone.update();
      if (S.XRayMode) S.XRayMode.update();
      if (S.VCRow) { S.VCRow.update(); S.VCRow.updateCommuters(dp); }
      if (S.Multiplayer) S.Multiplayer.update();
      if (S.SeasonalEnv) S.SeasonalEnv.update();
      if (S.Aurora) S.Aurora.draw(night);
      if (S.UniversityData) S.UniversityData.update();
      if (S.UniversityEnv) S.UniversityEnv.update();
      if (S.CourtData) S.CourtData.update();
      if (S.JailData) S.JailData.update();
      if (S.CityPark) S.CityPark.update();
      if (this.tick % 2 === 0 && S.BirdFlocks) S.BirdFlocks.update(); // every other frame for perf
      if (S.HNBlimps) S.HNBlimps.update();
      if (S.NewsReactivity) S.NewsReactivity.update();
      if (S.CitizenOfDay) S.CitizenOfDay.update();
      if (S.DailyBriefing) S.DailyBriefing.update();
      if (S.EmbassyRow && this.tick % 2 === 0) S.EmbassyRow.update();
      if (S.EmbassyQuarter && this.tick % 2 === 0) S.EmbassyQuarter.update();
      if (S.AlignmentForest) S.AlignmentForest.update();
      if (S.Shadows && this.tick % 30 === 0) S.Shadows.update(dp);
      if (S.ConferenceData) S.ConferenceData.update();
      if (S.Kardashev) S.Kardashev.tick();
      if (S.AIIndex) S.AIIndex.tick();
      if (S.BlackMarket) S.BlackMarket.update();

      // Lazy zone boot — spawn each zone's visual animations on first approach
      this._checkLazyZones();

      if (this.tick % 60 === 0) {
        // NOTE: Building sign/window occupancy updates are handled by Environment.update()

        const hh = Math.floor(dp * 24), mn = Math.floor((dp * 1440) % 60);
        const ts = `${String(hh).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
        let lbl; 
        if (hh < 6) lbl = 'Night';
        else if (hh < 8) lbl = 'Dawn'; 
        else if (hh < 12) lbl = 'Morning';
        else if (hh < 14) lbl = 'Lunch'; 
        else if (hh < 17) lbl = 'Afternoon';
        else if (hh < 20) lbl = 'Evening'; 
        else lbl = 'Night';
        
        // ─── HUD STATS: Use worker cache or single-pass inline ───
        let alive, dead, disc, preT, labCount;
        const wc = this._workerCache;
        if (wc && wc.stats) {
            alive = wc.stats.alive; dead = wc.stats.dead;
            disc = wc.stats.discovered; preT = wc.stats.training;
            labCount = wc.stats.labCount;
        } else {
            alive = 0; disc = 0; preT = 0;
            const labSet = new Set();
            const nowMs = Date.now();
            for (let i = 0; i < this.models.length; i++) {
                const m = this.models[i];
                if (!m._retMs && m.ret) m._retMs = new Date(m.ret).getTime();
                if (!m.ret || m._retMs > nowMs) alive++;
                if (m._src) disc++;
                const ph = m.phase;
                if (ph === 'rumored' || ph === 'pre_training' || ph === 'training') preT++;
                labSet.add(m.lab);
            }
            dead = this.models.length - alive;
            labCount = labSet.size;
        }
        const _wIcons = { rain:'🌧️', drizzle:'🌦️', thunderstorm:'⛈️', snow:'❄️', cherry:'🌸', leaves:'🍂', fog:'🌫️', overcast:'☁️', partly_cloudy:'⛅' };
        const wI = (typeof Environment !== 'undefined') ? (_wIcons[Environment.weather] || '') : '';

        if (!this._nfoEl) this._nfoEl = document.getElementById('nfo');
        const nfoEl = this._nfoEl;
        if (nfoEl) {
            if (this._estateCount === undefined) { this._estateCount = typeof BLDS !== 'undefined' ? BLDS.filter(b => b.id.startsWith('house_')).length : 0; }
            const estateCount = this._estateCount;
            nfoEl.innerHTML = `<span title="Current time of day in Singularity City — ${lbl}">🕒 <span class="st">${ts}</span></span><span style="font-size:7px;color:var(--ac)" title="City is running live — all data updates in real time">● LIVE</span><span title="Active AI model citizens currently in the city">👥 <span class="st">${alive}</span></span><span title="${labCount} AI labs with districts in the city">🏢 <span class="st">${labCount}</span></span><span title="${estateCount} CEO/Founder estates on Billionaire's Row">🏛️ <span class="st">${estateCount}</span></span>${preT > 0 ? `<span title="Models currently in pre-training, training, or rumored phase">🔬 <span class="st" style="color:var(--pk)">${preT}</span></span>` : ''}<span title="${dead} retired or deprecated models (visible as ghosts)">👻 <span class="st">${dead}</span></span>${disc > 0 ? `<span title="${disc} models discovered via network scans by all players globally">🛰️ <span class="st" style="color:var(--cy)">${disc}</span></span>` : ''}${wI ? `<span title="Current weather: ${Environment.weather || 'clear'}">${wI}</span>` : ''}${this.autoScanMin > 0 ? `<span style="font-size:7px;color:var(--cy)" title="Auto-scan interval — scanning for new models every ${this.autoScanMin} minutes">🔄 ${this.autoScanMin}m</span>` : ''}`;
        }
      }
    },
    
    celebrate() { if (typeof SND !== 'undefined') SND.launch(); },
    
    dramaticLaunch(name) { 
        if (typeof SND !== 'undefined') SND.launch(); 
        if (typeof UI !== 'undefined') UI.addToast(`🎉 ${name} HAS ARRIVED IN SINGULARITY CITY!`); 
        if (typeof NOTIFY !== 'undefined') NOTIFY.send('New Model Born!', `${name} has arrived!`); 
    }
};

// Mix in extracted modules
Object.assign(G, EasterEggs, Persistence, MacroView);

(function() {
  const uiFix = document.createElement('style');
  uiFix.innerHTML = `
      #nfo {
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          margin: 0 !important;
          z-index: 100;
      }
  `;
  document.head.appendChild(uiFix);

  const ls = document.getElementById('landStars');
  if (ls) { 
      for (let i = 0; i < 80; i++) { 
          const s = document.createElement('div'); 
          s.className = 'land-star'; 
          s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${Math.random() * 2 + .5}px;height:${Math.random() * 2 + .5}px;animation-delay:${Math.random() * 3}s`; 
          ls.appendChild(s); 
      } 
  }
  const sk = document.getElementById('landSkyline'); 
  if (sk) { 
      [40, 65, 90, 55, 70, 45, 80, 50, 35, 60, 75, 45, 85, 55, 40].forEach(h => { 
          const b = document.createElement('div');
          b.className = 'land-bld'; 
          b.style.cssText = `width:${20 + Math.random() * 30}px;height:${h + Math.random() * 20}px`; 
          sk.appendChild(b); 
      }); 
  }
})();

async function enterCity(opts = {}) {
  // One-shot guard. The landing buttons disable themselves on click, but a
  // programmatic double-call (tutorial race, embed auto-boot + manual click)
  // would run the whole boot twice and duplicate every polling setInterval
  // (news/launches/HuggingFace/etc.), doubling API traffic. Belt-and-suspenders.
  if (window._cityEntering) return;
  window._cityEntering = true;

  const isTerminal = !!opts.terminal;

  // ─── BUTTON ANIMATION — only the clicked button animates ───
  // The other button gets locked out (disabled + dim) to show it's no longer interactive.
  const cityBtn = document.querySelector('.land-enter');
  const termBtn = document.querySelector('.land-terminal');
  const clickedBtn = isTerminal ? termBtn : cityBtn;
  const otherBtn   = isTerminal ? cityBtn : termBtn;

  if (clickedBtn) {
      const label = isTerminal ? 'Booting Terminal…' : 'Downloading City Data…';
      clickedBtn.classList.add('land-btn-loading');
      clickedBtn.innerHTML = `<span class="land-btn-spin"></span>${label}`;
      clickedBtn.disabled = true;
  }
  if (otherBtn) {
      otherBtn.disabled = true;
      otherBtn.style.opacity = '0.35';
      otherBtn.style.pointerEvents = 'none';
  }

  // ─── LOADING SCREEN helpers ───
  const loader = document.getElementById('sc-loader');
  const loaderFill   = document.getElementById('sc-loader-fill');
  const loaderPct    = document.getElementById('sc-loader-pct');
  const loaderStatus = document.getElementById('sc-loader-status');
  const loaderBadge  = document.getElementById('sc-loader-badge');
  const loaderSub    = document.getElementById('sc-loader-sub');
  const tasksEl      = document.getElementById('sc-loader-tasks');

  // Derive the running version from the cache-bust query on our own script tags
  // (all js/*.js tags share the same ?v= which cachebust.mjs keeps in sync with
  // sw.js CACHE_NAME). Falls back gracefully if no tag matches.
  const _verMatch = (document.querySelector('script[src*="js/"][src*="?v="]')?.src || '').match(/\?v=(\d+)/);
  const _ver = _verMatch ? _verMatch[1] : '';

  // Theme the loader for Terminal boot (amber) vs City (cyan/default)
  if (loaderBadge) {
      const prefix = isTerminal ? 'TERMINAL BOOT' : 'SYSTEM BOOT';
      loaderBadge.textContent = _ver ? `${prefix} · v${_ver}` : prefix;
  }
  if (isTerminal) {
      if (loaderSub)   loaderSub.textContent   = 'REAL-TIME AI INDUSTRY DASHBOARD';
      if (loader)      loader.classList.add('sc-loader-terminal');
  }

  const setProgress = (pct, msg) => {
      if (loaderFill)   loaderFill.style.width = pct + '%';
      if (loaderPct)    loaderPct.textContent  = Math.round(pct) + '%';
      if (loaderStatus) loaderStatus.textContent = msg;
  };

  // Task state machine: pending (○) → running (amber pulse) → done (✓ green)
  const setTask = (key, state) => {
      if (!tasksEl) return;
      const el = tasksEl.querySelector(`.sc-task[data-task="${key}"]`);
      if (!el) return;
      el.classList.remove('sc-task-running', 'sc-task-done');
      const icon = el.querySelector('.sc-task-icon');
      if (state === 'running') {
          el.classList.add('sc-task-running');
          if (icon) icon.textContent = '●';
      } else if (state === 'done') {
          el.classList.add('sc-task-done');
          if (icon) icon.textContent = '✓';
      } else {
          if (icon) icon.textContent = '○';
      }
  };

  // Show loader, start fading landing page EARLY so the boot sequence is visible
  if (loader) loader.style.display = '';
  const instrOv = document.getElementById('instrOv');
  if (instrOv) instrOv.classList.remove('open');
  const l = document.getElementById('landing');
  if (l) l.classList.add('exit');
  if (l) setTimeout(() => l.remove(), 900);

  // Yield a frame so the loader paints before heavy init
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // ── PHASE 1: CONNECT CLOUD ──
  setTask('net', 'running');
  setProgress(5, 'Connecting to cloud…');
  if (typeof API !== 'undefined') {
      API.initSupabase();
      await API.fetchCoreData();
  }
  setTask('net', 'done');

  // ── PHASE 2: BUILD CITY LAYOUT ──
  setTask('layout', 'running');
  setProgress(30, 'Building city layout…');
  // (layout work happens inside G.init — we mark it running here so the UI reflects it)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  setTask('layout', 'done');

  // ── PHASE 3: INIT ENGINE ──
  setTask('engine', 'running');
  setProgress(40, 'Initializing simulation engine…');
  G.init();
  setTask('engine', 'done');

  // ── PHASE 4: LOAD 3D HOLOMAP ──
  setTask('holomap', 'running');
  setProgress(55, 'Loading 3D holomap…');
  if (typeof Holomap !== 'undefined') Holomap.init();
  setTask('holomap', 'done');

  // ── PHASE 5: FETCH AI MODELS ──
  setTask('models', 'running');
  setProgress(65, 'Fetching AI models…');
  if (typeof API !== 'undefined') {
      await API.fetchCloudModels();
      // Cloud events (sc_events) — server-accumulated AI signal. Non-blocking
      // so missing table doesn't slow city boot. Refetched every 10 min by
      // News Reactivity for fresh server-side events.
      API.fetchCloudEvents().catch(() => {});
  }
  setTask('models', 'done');

  // ── PHASE 6: RENDER CITY ──
  setTask('render', 'running');
  setProgress(85, 'Rendering city…');
  // Yield again so loader updates before final render burst
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const gw = document.getElementById('gameWrap');
  if (gw) gw.classList.add('active');
  setTask('render', 'done');

  setProgress(100, isTerminal ? 'Terminal online' : 'Welcome to Singularity City');

  // Fade out loader after a beat (longer if terminal so the user sees the "online" state)
  setTimeout(() => {
      if (loader) loader.classList.add('hidden');
      setTimeout(() => {
          if (loader) {
              loader.style.display = 'none';
              loader.classList.remove('sc-loader-terminal');
          }
      }, 700);
  }, 500);

  if (typeof SND !== 'undefined') {
      SND.init();
      SND.setAmbient('outside');
  }

  // ─── MOBILE: fullscreen, wake lock, orientation ───
  if (window.isMobile) {
      if (typeof _requestFullscreen === 'function') _requestFullscreen();
      if (typeof _requestWakeLock === 'function') _requestWakeLock();
      if (typeof _lockLandscape === 'function') _lockLandscape();
      // Enable orientation check now that we're in the city
      window._orientCheckEnabled = true;
      if (typeof _checkOrientation === 'function') _checkOrientation();
      // Hide install banner if still showing
      const ib = document.getElementById('installBanner');
      if (ib) ib.style.display = 'none';
  }

  // ─── TERMINAL MODE HOOK ───
  // If the user clicked "Open the Terminal", or a saved preference / auto-open flag is set,
  // flip the dashboard on now that the sim is fully booted. The Terminal module runs
  // its own 4 Hz update loop and can be toggled back to pixel view via the D hotkey.
  if (isTerminal && typeof Terminal !== 'undefined' && Terminal.open) {
      Terminal.open();
  } else if (typeof Terminal !== 'undefined' && Terminal.tryAutoOpen) {
      Terminal.tryAutoOpen();
  }
}
