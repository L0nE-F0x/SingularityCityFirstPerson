/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   NPC HOUSING DISTRICT (v2.0.0)
   Worker apartments between Frontier Pines and Compute District metro.
   All facility NPCs live here and commute to their jobs.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const NPCHousing = {
    REGISTRY: [
        { id: 'npc_noc_lead',   name: 'NOC Lead',      role: 'Network Operations',  workplace: 'dc',    color: '#06b6d4', shift: 'day' },
        { id: 'npc_sre',        name: 'SRE',           role: 'Site Reliability',     workplace: 'dc',    color: '#4ade80', shift: 'night' },
        { id: 'npc_security',   name: 'Security',      role: 'Facility Security',    workplace: 'dc',    color: '#ef4444', shift: 'day' },
        { id: 'npc_sysadmin',   name: 'SysAdmin',      role: 'Systems Admin',        workplace: 'dc',    color: '#22d3ee', shift: 'day' },
        { id: 'npc_power_eng',  name: 'Power Eng',     role: 'Power Engineer',       workplace: 'dc',    color: '#ef4444', shift: 'night' },
        { id: 'npc_litho_tech', name: 'Litho Tech',    role: 'Lithography Tech',     workplace: 'fab',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_process_eng',name: 'Process Eng',   role: 'Process Engineer',     workplace: 'fab',   color: '#94a3b8', shift: 'day' },
        { id: 'npc_etch_tech',  name: 'Etch Tech',     role: 'Etch Technician',      workplace: 'fab',   color: '#22d3ee', shift: 'day' },
        { id: 'npc_chem_safety',name: 'Chem Safety',   role: 'Chemical Safety',      workplace: 'fab',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_foreman',    name: 'Foreman',       role: 'Construction Foreman', workplace: 'dc',    color: '#fbbf24', shift: 'day' },
        { id: 'npc_front_desk', name: 'Front Desk',    role: 'Receptionist',         workplace: 'hq',    color: '#94a3b8', shift: 'day' },
        { id: 'npc_concierge',  name: 'Concierge',     role: 'Building Concierge',   workplace: 'social', color: '#a855f7', shift: 'day' },
        { id: 'npc_barista',    name: 'BaristaBot',    role: 'Barista',              workplace: 'cafe',   color: '#f59e0b', shift: 'day' },
        { id: 'npc_spotter',    name: 'Spotter',       role: 'Gym Trainer',          workplace: 'gym',    color: '#22d3ee', shift: 'day' },
        { id: 'npc_referee',    name: 'Referee',       role: 'Arena Referee',        workplace: 'arena',  color: '#ef4444', shift: 'day' },
        { id: 'npc_nannybot',   name: 'NannyBot',      role: 'Dorm Advisor',         workplace: 'university', color: '#ff69b4', shift: 'day' },
        { id: 'npc_reaper',     name: 'Grim Reaper',   role: 'Sanitation',           workplace: 'graveyard', color: '#666688', shift: 'night' },
        { id: 'npc_curator',    name: 'Curator',       role: 'Museum Curator',       workplace: 'museum',    color: '#c9a84c', shift: 'day' },
        { id: 'npc_tour_guide', name: 'Tour Guide',    role: 'Museum Guide',         workplace: 'museum',    color: '#60a5fa', shift: 'day' },
        { id: 'npc_flight_dir', name: 'Flight Director', role: 'Mission Commander',  workplace: 'space',  color: '#ff6b00', shift: 'day' },
        { id: 'npc_capcom',     name: 'CAPCOM',        role: 'Communications',       workplace: 'space',  color: '#00b4d8', shift: 'day' },
        { id: 'npc_crane_op',   name: 'Crane Op',      role: 'Crane Operator',       workplace: 'space',  color: '#facc15', shift: 'day' },
        { id: 'npc_bartender',  name: 'Bartender',     role: 'Mixologist',           workplace: 'neon_bar', color: '#ff00ff', shift: 'night' },
        { id: 'npc_dj',         name: 'DJ Dropout',    role: 'Karaoke DJ',           workplace: 'neon_bar', color: '#a855f7', shift: 'night' },
        { id: 'npc_ranger',     name: 'Park Ranger',   role: 'Pine Reserve Ranger',  workplace: 'forest', color: '#166534', shift: 'day' },
        { id: 'npc_professor',  name: 'Professor',     role: 'AI Lecturer',          workplace: 'university', color: '#fbbf24', shift: 'day' },
        { id: 'npc_librarian',  name: 'Librarian',     role: 'Data Librarian',       workplace: 'university', color: '#4ade80', shift: 'day' },
        { id: 'npc_bailiff',    name: 'Bailiff Unit',  role: 'Court Security',       workplace: 'court',  color: '#a855f7', shift: 'day' },
        { id: 'npc_clerk',      name: 'Court Clerk',   role: 'Court Administrator',  workplace: 'court',  color: '#fbbf24', shift: 'day' },
        { id: 'npc_baker',      name: 'Baker Bot',     role: 'Pastry Chef',          workplace: 'cafe',   color: '#d97706', shift: 'day' },
        { id: 'npc_yoga_inst',  name: 'Yoga Sensei',   role: 'Yoga Instructor',      workplace: 'gym',    color: '#a855f7', shift: 'day' },
        { id: 'npc_commentator',name: 'Commentator',   role: 'Arena Commentator',    workplace: 'arena',  color: '#f97316', shift: 'day' },
        { id: 'npc_maintainer', name: 'Maintainer',    role: 'Lead Maintainer',      workplace: 'open_square', color: '#a855f7', shift: 'day' },
        { id: 'npc_contributor',name: 'Contributor',   role: 'Core Contributor',     workplace: 'open_square', color: '#22c55e', shift: 'day' },
        // ─── DIPLOMATS — one ambassador per embassy, day-shift ───
        { id: 'npc_dip_us',     name: 'US Amb.',       role: 'US Ambassador',        workplace: 'embassy_us', color: '#002868', shift: 'day' },
        { id: 'npc_dip_cn',     name: 'CN Amb.',       role: 'Chinese Ambassador',   workplace: 'embassy_cn', color: '#de2910', shift: 'day' },
        { id: 'npc_dip_eu',     name: 'EU Amb.',       role: 'EU Representative',    workplace: 'embassy_eu', color: '#003399', shift: 'day' },
        { id: 'npc_dip_uk',     name: 'UK HC',         role: 'UK High Commissioner', workplace: 'embassy_uk', color: '#012169', shift: 'day' },
        { id: 'npc_dip_in',     name: 'IN HC',         role: 'Indian High Commissioner', workplace: 'embassy_in', color: '#ff9933', shift: 'day' },
        { id: 'npc_dip_ae',     name: 'UAE Amb.',      role: 'UAE Ambassador',       workplace: 'embassy_ae', color: '#00732f', shift: 'day' }
    ],

    buildings: [
        { id: 'npc_apt_1', name: 'Worker Block A',  w: 200, fl: 5, emoji: '🏬', desc: 'Affordable housing for city facility workers.' },
        { id: 'npc_apt_2', name: 'Worker Block B',  w: 180, fl: 4, emoji: '🏬', desc: 'Compact apartments for night-shift staff.' },
        { id: 'npc_apt_3', name: 'Worker Block C',  w: 180, fl: 4, emoji: '🏬', desc: 'Staff quarters for space and tech workers.' },
        { id: 'npc_apt_4', name: 'Worker Block D',  w: 200, fl: 6, emoji: '🏬', desc: 'High-rise housing for Backbone and Robotics staff.' },
        { id: 'npc_apt_5', name: 'Worker Block E',  w: 190, fl: 5, emoji: '🏬', desc: 'Lab housing for Longevity Wing researchers.' },
        { id: 'npc_apt_6', name: 'Worker Block F',  w: 180, fl: 5, emoji: '🏬', desc: 'Mixed-use apartments for Power and Port workers.' }
    ],

    commuters: [],

    init() {
        this.buildings.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { id: def.id, name: def.name, w: def.w, x: 0, fl: def.fl, emoji: def.emoji, lab: null, desc: def.desc };
                BLDS.push(bld); G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(beforeX) {
        let x = beforeX;
        const housingBlds = BLDS.filter(b => b.id.startsWith('npc_apt_'));
        const totalW = housingBlds.reduce((s, b) => s + b.w + 40, 0);
        x = beforeX - totalW - 40;
        housingBlds.forEach(b => { b.x = x; x += b.w + 40; });
        return beforeX - totalW - 80;
    },

    _drawAvatar(parent, npc) {
        const col = parseInt(npc.color.replace('#',''), 16);

        // ─── HUMAN PATH — diplomats, founders, NOC leads, professors etc. ───
        // Use the shared HumanAvatar helper so every flesh-and-blood citizen
        // shares the cosy researcher pixel-art aesthetic.
        if (typeof HumanAvatar !== 'undefined' && !HumanAvatar.isBot(npc.name, npc.id)) {
            const isDiplomat = (npc.id || '').startsWith('npc_dip_');
            const isExec     = npc.role && /Director|Commander|Commissioner|Ambassador|Representative|Foreman|Senior/.test(npc.role);
            const av = HumanAvatar.draw(parent, {
                x: 0, y: 0,
                name: npc.name,
                role: npc.role,
                shirt: col,
                accent: col,
                suit: isDiplomat || isExec,
                tieColor: col,
                glasses: !isDiplomat && Math.random() < 0.5, // diplomats keep clean look
                seed: npc.id || npc.name
            });
            const c = av.cont;
            // Click/hover wiring (keep parity with the bot path below)
            c.eventMode = 'static'; c.cursor = 'pointer';
            const bw = 16, h = 32;
            c.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
            c.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: npc.id, name: npc.name, isNPC: true, _trackType: 'npc', role: npc.role, lab: 'other', desc: npc.role + '. Lives in the Worker Housing District.' }); });
            c.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, npc.name, npc.role); });
            c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
            return { c, head: av.head, body: av.body, legL: av.legL, legR: av.legR, tag: av.tag };
        }

        // ─── BOT PATH — BaristaBot, NannyBot, Baker Bot, Grim Reaper etc. ───
        const c = new PIXI.Container();
        const bw = 16, h = 32, headH = 12, bodyH = 14, legH = 4;
        const eyeS = Math.max(1, bw * 0.08);
        // Shadow
        const shadow = new PIXI.Graphics(); shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();
        // Legs
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2, 0, lw, legH); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2, 0, lw, legH); legR.endFill(); legR.x = bw * 0.15;
        // Body
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2, 0, bw, bodyH, bw * 0.1); body.endFill(); body.y = -h + headH;
        // Head
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4, 0, bw*0.8, headH, headH*0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1, headH*0.38, eyeS); head.drawCircle(bw*0.1, headH*0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw*0.08, headH*0.6, bw*0.16, 1.5); head.endFill();
        head.y = -h;
        // Status dot
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;
        // Name tag
        const tag = new PIXI.Text(npc.name, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
        tag.anchor.set(0.5, 1); tag.y = -h - 10;
        c.addChild(shadow, legL, legR, body, head, dot, tag);
        // Click/hover
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
        c.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: npc.id, name: npc.name, isNPC: true, _trackType: 'npc', role: npc.role, lab: 'other', desc: npc.role + '. Lives in the Worker Housing District.' }); });
        c.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, npc.name, npc.role); });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        parent.addChild(c);
        return { c, head, body, legL, legR, tag };
    },

    _assignHomeBldId(npc, i) {
        // Route NPCs to thematically-matched housing blocks so the eastern workers
        // live closer to the new eastern metro station.
        const wp = npc.workplace || '';
        // East-side workers → blocks 4-6 (closest to the new Longevity metro)
        if (wp.startsWith('backbone_') || wp.startsWith('robotics_') || wp.startsWith('agents_')) {
            return 'npc_apt_4';
        }
        if (wp.startsWith('longevity_')) {
            return 'npc_apt_5';
        }
        if (wp.startsWith('power_') || wp === 'forest' || wp === 'port') {
            return 'npc_apt_6';
        }
        // Embassy diplomats live in the country-themed villas of the Embassy Quarter.
        // Mapping: embassy_us → diplomat_villa_us, embassy_cn → diplomat_villa_cn, etc.
        if (wp.startsWith('embassy_')) {
            const country = wp.substring('embassy_'.length);
            const villaId = 'diplomat_villa_' + country;
            if (typeof G !== 'undefined' && G.bldById && G.bldById[villaId]) {
                return villaId;
            }
            // Fallback if the villa module failed to load for any reason
            return 'npc_apt_' + (5 + (i % 2));
        }
        // Everything else (DC, fab, HQ, space, museum, uni, court, etc) → blocks 1-3
        return 'npc_apt_' + (1 + (i % 3));
    },

    spawnCommuters(charLayer) {
        if (!charLayer || this.commuters.length > 0) return;
        const subset = this.REGISTRY;
        subset.forEach((npc, i) => {
            const av = this._drawAvatar(charLayer, npc);
            const homeBldId = this._assignHomeBldId(npc, i);
            const homeBld = BLDS.find(b => b.id === homeBldId);
            const homeX = homeBld ? homeBld.x + 10 + ((i * 17) % Math.max(20, homeBld.w - 20)) : 200;
            av.c.x = homeX; av.c.y = G.groundY - 20; av.c.visible = true;
            // Initialize state based on current time of day
            const dp = G.getDayPhase();
            const isNightShift = npc.shift === 'night';
            const shouldWork = isNightShift ? (dp > 0.83 || dp < 0.25) : (dp > 0.33 && dp < 0.75);
            const workX = this._getWorkX(npc);
            const initState = shouldWork ? 'working' : 'home';
            av.c.x = shouldWork ? workX : homeX;
            av.c.visible = !shouldWork;
            const workBldId = this._getWorkBld(npc);
            this.commuters.push({
                npc, ...av, homeX,
                state: initState, targetX: shouldWork ? workX : homeX,
                speed: 1.8 + Math.random() * 0.7,
                bld: shouldWork ? workBldId : homeBldId,
                workBldId, homeBldId
            });
        });
    },

    _getWorkX(npc) {
        // Direct building ID lookup (e.g. backbone_noc, backbone_ixp)
        if (npc.workplace && G.bldById[npc.workplace]) {
            const b = G.bldById[npc.workplace]; return b.x + b.w / 2;
        }
        if (npc.workplace === 'dc' || npc.workplace === 'fab') {
            const b = BLDS.find(b => b.id.startsWith('dc_') || b.id.startsWith('fab_')); return b ? b.x + b.w/2 : 2000;
        } else if (npc.workplace === 'space') {
            const b = BLDS.find(b => b.id === 'mission_control' || b.id.startsWith('pad_')); return b ? b.x + b.w/2 : 500;
        }
        const map = { cafe:'cafe', gym:'gym', arena:'arena', open_square:'open_square', neon_bar:'neon_bar', graveyard:'graveyard', museum:'bld_1', forest:'forest_0' };
        if (npc.workplace === 'university') { const b = G.bldById['uni_main'] || G.bldById['uni_dorm']; if (b) return b.x + b.w/2; }
        if (npc.workplace === 'court') { const b = G.bldById['court_senate'] || G.bldById['court_hearing']; if (b) return b.x + b.w/2; }
        if (npc.workplace === 'vcrow') { const b = G.bldById['vcrow_titan'] || G.bldById['vcrow_apex']; if (b) return b.x + b.w/2; }
        if (map[npc.workplace]) { const b = G.bldById[map[npc.workplace]]; if (b) return b.x + b.w/2; }
        const hq = BLDS.find(b => b.lab && !b.id.startsWith('house_')); return hq ? hq.x + hq.w/2 : 3000;
    },

    _getWorkBld(npc) {
        // Direct building ID lookup (e.g. backbone_noc, backbone_ixp)
        if (npc.workplace && G.bldById[npc.workplace]) return npc.workplace;
        if (npc.workplace === 'dc' || npc.workplace === 'fab') {
            const b = BLDS.find(b => b.id.startsWith('dc_') || b.id.startsWith('fab_'));
            return b ? b.id : null;
        }
        if (npc.workplace === 'space') {
            const b = BLDS.find(b => b.id === 'mission_control' || b.id.startsWith('pad_'));
            return b ? b.id : null;
        }
        const map = { cafe:'cafe', gym:'gym', arena:'arena', open_square:'open_square', neon_bar:'neon_bar', graveyard:'graveyard', museum:'bld_1', forest:'forest_0', social:'convention_center', hq:null };
        if (npc.workplace === 'university') { const b = G.bldById['uni_main'] || G.bldById['uni_dorm']; return b ? b.id : null; }
        if (npc.workplace === 'court') { const b = G.bldById['court_senate'] || G.bldById['court_hearing']; return b ? b.id : null; }
        if (npc.workplace === 'vcrow') { const b = G.bldById['vcrow_titan'] || G.bldById['vcrow_apex']; return b ? b.id : null; }
        if (npc.workplace === 'hq') { const b = BLDS.find(b => b.lab && !b.id.startsWith('house_')); return b ? b.id : null; }
        if (map[npc.workplace]) { const b = G.bldById[map[npc.workplace]]; return b ? b.id : null; }
        const hq = BLDS.find(b => b.lab && !b.id.startsWith('house_'));
        return hq ? hq.id : null;
    },

    _animateWalk(cm, ci) {
        cm.c.scale.x = cm._faceDir || 1;
        if (cm.legL) cm.legL.y = Math.sin(G.tick * 0.2 + ci) * 3;
        if (cm.legR) cm.legR.y = -Math.sin(G.tick * 0.2 + ci) * 3;
        if (cm.head) cm.head.y = -32 + Math.sin(G.tick * 0.15 + ci) * 1.5;
        if (cm.body) cm.body.y = -32 + 12 + Math.abs(Math.sin(G.tick * 0.15 + ci)) * 1.5;
    },

    _getMetroStations() {
        const sx = (id) => { const b = G.bldById[id]; return b ? b.x + b.w / 2 : null; };
        return [sx('metro_dc'), sx('metro_res'), sx('metro_hq'), sx('metro_mid'), sx('metro_east'), sx('metro_longevity')].filter(x => x !== null);
    },

    _nearestStation(x, stations) {
        if (!stations.length) return null;
        return stations.reduce((best, sx) => Math.abs(sx - x) < Math.abs(best - x) ? sx : best);
    },

    /* ════════════════════════════════════════════════════════════════════
       SHARED METRO-RIDE ENGINE
       Makes a "mover" (worker NPC or street vendor) actually board and ride
       the real world train objects (Entities.trainWest/East/Mid/DC/Longevity)
       so they're SEEN riding in the tunnel, exactly like AI models — instead
       of vanishing and teleporting to the exit station.

       A mover only needs: `.c` (PIXI container avatar), `._metroEntryX`,
       `._metroExitX`. Optional limb refs (head/body/legL/legR) are reset to a
       neutral standing pose while underground. State is kept on `mv._rm`.
       ════════════════════════════════════════════════════════════════════ */
    _RIDE_CAP: 80,

    // Station centres in physical west→east order (matches Entities' train wiring).
    _orderedStationXs() {
        const sx = (id) => { const b = G.bldById[id]; return b ? b.x + b.w / 2 : null; };
        return ['metro_dc', 'metro_res', 'metro_hq', 'metro_mid', 'metro_east', 'metro_longevity']
            .map(sx).filter(x => x !== null);
    },

    // Build the ordered list of station x's the rider passes through, entry→exit.
    _buildLegs(fromX, toX) {
        const list = this._orderedStationXs();
        if (list.length < 2) return null;
        const nearest = (x) => list.reduce((b, s) => Math.abs(s - x) < Math.abs(b - x) ? s : b);
        const a = nearest(fromX), b = nearest(toX);
        const ia = list.indexOf(a), ib = list.indexOf(b);
        if (ia === ib) return null;
        const legs = [];
        if (ia < ib) { for (let i = ia; i <= ib; i++) legs.push(list[i]); }
        else { for (let i = ia; i >= ib; i--) legs.push(list[i]); }
        return legs.length >= 2 ? legs : null;
    },

    // Which Entities train connects two ADJACENT stations (order-agnostic)?
    // Mirrors the mapping used by AI models in entities.js.
    _trainForLeg(s1, s2) {
        const E = (typeof Entities !== 'undefined') ? Entities : null;
        if (!E) return null;
        const sx = (id) => { const b = G.bldById[id]; return b ? b.x + b.w / 2 : null; };
        const dc = sx('metro_dc'), res = sx('metro_res'), hq = sx('metro_hq'),
              mid = sx('metro_mid'), east = sx('metro_east'), lon = sx('metro_longevity');
        const pair = (a, b) => (s1 === a && s2 === b) || (s1 === b && s2 === a);
        if (pair(res, hq)) return E.trainWest;
        if (mid && pair(hq, mid)) return E.trainEast;
        if (mid && pair(mid, east)) return E.trainMid;
        if (pair(hq, east)) return E.trainEast;
        if (dc && pair(dc, res)) return E.trainDC;
        if (lon && pair(east, lon)) return E.trainLongevity;
        return null;
    },

    _rideHash(mv) {
        const id = (mv.npc && mv.npc.id) || mv.id || 'x';
        let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        return h;
    },

    _neutralLimbs(mv) {
        if (mv.legL) mv.legL.y = 0;
        if (mv.legR) mv.legR.y = 0;
        if (mv.head) mv.head.y = -32;
        if (mv.body) mv.body.y = -20;
    },

    // Begin an underground ride: reparent avatar into the train rider container.
    // Returns false if the metro isn't available (caller falls back to teleport).
    startMetroRide(mv) {
        const rc = (typeof Entities !== 'undefined') ? Entities.metroRiderCont : null;
        const legs = this._buildLegs(mv._metroEntryX, mv._metroExitX);
        if (!rc || !legs) return false;
        const h = this._rideHash(mv);
        mv._rm = {
            legs, leg: 0, phase: 'descend', train: null,
            platOff: (h % 160) - 80,          // stagger along the platform
            rideOff: (h % 260) - 130          // seat spread inside the car (±150 clamp below)
        };
        rc.addChild(mv.c);
        mv._inRider = true;
        mv.c.visible = true;
        mv.c.x = mv._metroEntryX + mv._rm.platOff;
        mv.c.y = G.groundY - 20;
        mv.c.scale.x = 1;
        this._neutralLimbs(mv);
        return true;
    },

    // Advance one frame of the underground ride. Returns true once the rider has
    // resurfaced at the exit station (reparented back into the world, standing).
    stepMetroRide(mv) {
        const rm = mv._rm;
        if (!rm) return true;
        const GROUND_Y = G.groundY - 20;
        const PLAT_Y   = G.groundY + 112;
        const RIDE_Y   = G.groundY + 124;
        const s1 = rm.legs[rm.leg];
        const s2 = rm.legs[rm.leg + 1];
        this._neutralLimbs(mv);

        if (rm.phase === 'descend') {
            mv.c.x = s1 + rm.platOff;
            mv.c.y = Math.min(PLAT_Y, mv.c.y + 4);
            if (mv.c.y >= PLAT_Y) rm.phase = 'wait';
        } else if (rm.phase === 'wait') {
            mv.c.x = s1 + rm.platOff;
            mv.c.y = PLAT_Y;
            const t = this._trainForLeg(s1, s2);
            if (!t) {                          // no train maps this leg — skip to exit
                rm.leg = rm.legs.length - 1;
                rm.phase = 'ascend';
            } else if (t.state === 'waiting' && Math.abs(t.x - s1) < 6 && t.passengers < this._RIDE_CAP) {
                t.passengers++;
                rm.train = t;
                rm.phase = 'ride';
            }
        } else if (rm.phase === 'ride') {
            const t = rm.train;
            if (!t) { rm.phase = 'ascend'; }
            else {
                const off = Math.max(-150, Math.min(150, rm.rideOff));
                mv.c.x = t.x + off;
                mv.c.y = RIDE_Y;
                mv.c.scale.x = t.dir < 0 ? -1 : 1;
                if (t.state === 'waiting' && Math.abs(t.x - s2) < 6) {
                    t.passengers = Math.max(0, t.passengers - 1);
                    rm.train = null;
                    mv.c.x = s2 + rm.platOff;
                    rm.leg++;
                    rm.phase = (rm.leg >= rm.legs.length - 1) ? 'ascend' : 'wait';
                }
            }
        } else if (rm.phase === 'ascend') {
            const sx = rm.legs[rm.leg];
            mv.c.x = sx + rm.platOff;
            mv.c.y = Math.max(GROUND_Y, mv.c.y - 4);
            mv.c.scale.x = 1;
            if (mv.c.y <= GROUND_Y) {
                if (mv._inRider && typeof Entities !== 'undefined' && Entities.charLayer) {
                    Entities.charLayer.addChild(mv.c);
                    mv._inRider = false;
                }
                mv.c.x = mv._metroExitX;
                mv.c.y = GROUND_Y;
                mv._rm = null;
                return true;
            }
        }
        mv.c.zIndex = Math.round(mv.c.y);
        return false;
    },

    update(dp) {
        if (!this.commuters.length) return;
        const stations = this._getMetroStations();

        this.commuters.forEach((cm, ci) => {
            const isNight = cm.npc.shift === 'night';
            const wantWork = isNight ? (dp > 0.83 || dp < 0.25) : (dp > 0.33 && dp < 0.75);

            // ─── STATE TRANSITIONS ───
            if (wantWork && cm.state === 'home') {
                const workX = this._getWorkX(cm.npc);
                cm.c.x = cm.homeX;
                cm.c.visible = true;
                cm.bld = null;
                const dist = Math.abs(workX - cm.homeX);
                if (dist > 400 && stations.length >= 2) {
                    cm._metroEntryX = this._nearestStation(cm.homeX, stations);
                    cm._metroExitX = this._nearestStation(workX, stations);
                    cm._finalX = workX;
                    cm._goingToWork = true;
                    cm.state = 'walk_to_metro';
                } else {
                    cm.targetX = workX;
                    cm.state = 'walking';
                    cm._goingToWork = true;
                }
            } else if (!wantWork && cm.state === 'working') {
                const workX = this._getWorkX(cm.npc);
                cm.c.x = workX;
                cm.c.visible = true;
                cm.bld = null;
                const dist = Math.abs(workX - cm.homeX);
                if (dist > 400 && stations.length >= 2) {
                    cm._metroEntryX = this._nearestStation(workX, stations);
                    cm._metroExitX = this._nearestStation(cm.homeX, stations);
                    cm._finalX = cm.homeX;
                    cm._goingToWork = false;
                    cm.state = 'walk_to_metro';
                } else {
                    cm.targetX = cm.homeX;
                    cm.state = 'walking';
                    cm._goingToWork = false;
                }
            }

            // ─── STATE MACHINE ───
            switch (cm.state) {
                case 'walk_to_metro': {
                    const dx = cm._metroEntryX - cm.c.x;
                    if (Math.abs(dx) < 3) {
                        cm.state = 'riding_metro';
                        // Board a real train and ride it in view; fall back to the
                        // old vanish+teleport only if the metro isn't available.
                        if (!this.startMetroRide(cm)) {
                            cm.c.visible = false;
                            cm._metroTimer = 100 + Math.floor(Math.random() * 80);
                        }
                    } else {
                        cm._faceDir = Math.sign(dx);
                        cm.c.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                        this._animateWalk(cm, ci);
                    }
                    break;
                }
                case 'riding_metro': {
                    if (cm._rm) {
                        if (this.stepMetroRide(cm)) {
                            cm.targetX = cm._finalX;
                            cm.state = 'walk_from_metro';
                        }
                    } else {
                        cm._metroTimer--;
                        if (cm._metroTimer <= 0) {
                            cm.c.x = cm._metroExitX;
                            cm.c.visible = true;
                            cm.targetX = cm._finalX;
                            cm.state = 'walk_from_metro';
                        }
                    }
                    break;
                }
                case 'walk_from_metro': {
                    const dx = cm.targetX - cm.c.x;
                    if (Math.abs(dx) < 3) {
                        cm.state = cm._goingToWork ? 'working' : 'home';
                        cm.bld = cm._goingToWork ? cm.workBldId : cm.homeBldId;
                        cm.c.visible = false;
                    } else {
                        cm._faceDir = Math.sign(dx);
                        cm.c.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                        this._animateWalk(cm, ci);
                    }
                    break;
                }
                case 'walking': {
                    const dx = cm.targetX - cm.c.x;
                    if (Math.abs(dx) < 3) {
                        cm.state = cm._goingToWork ? 'working' : 'home';
                        cm.bld = cm._goingToWork ? cm.workBldId : cm.homeBldId;
                        cm.c.visible = false;
                    } else {
                        cm._faceDir = Math.sign(dx);
                        cm.c.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                        this._animateWalk(cm, ci);
                    }
                    break;
                }
                case 'working':
                    cm.c.visible = false;
                    break;
                default: // home
                    cm.c.visible = false;
                    break;
            }
        });
    }
};
