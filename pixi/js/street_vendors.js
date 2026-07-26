/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   STREET VENDORS (v1.0.0)
   Mobile food carts and merchants scattered along the tech district.
   NPCs commute from worker housing, set up stalls during business hours, call out to passersby.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const StreetVendors = {
    VENDORS: [
        { id: 'sv_taco',    name: 'Taco Bot',      emoji: '🌮', item: 'Street Tacos',  color: 0xff6b35, canopy: 0xcc4422 },
        { id: 'sv_coffee',  name: 'Byte Brew',     emoji: '☕', item: 'Artisan Coffee', color: 0x8b4513, canopy: 0x5c2e0a },
        { id: 'sv_noodle',  name: 'Ramen-san',     emoji: '🍜', item: 'Hot Noodles',    color: 0xdc143c, canopy: 0x9b0f2e },
        { id: 'sv_ice',     name: 'Gelato GPU',    emoji: '🍦', item: 'Gelato',         color: 0xff69b4, canopy: 0xcc5590 },
        { id: 'sv_pretzel', name: 'Pretzel Net',    emoji: '🥨', item: 'Fresh Pretzels', color: 0xdaa520, canopy: 0x8b6914 },
        { id: 'sv_book',    name: 'PageRank Books', emoji: '📚', item: 'Used Books',     color: 0x228b22, canopy: 0x186618 },
    ],

    vendors: [],

    CALLS: [
        'Fresh {item}! 🔥', '{emoji} Best {item} in the city!',
        'Hot off the cart!', '{emoji} {item} special today!',
        'Come try our {item}!', 'Nothing beats street {item}!',
        '{emoji} Get em while they last!', 'Freshly made {item}!',
    ],

    init(charLayer) {
        if (!charLayer || this.vendors.length > 0) return;

        // Find tech district buildings for positioning
        const techBlds = BLDS.filter(b =>
            b.lab && !b.id.startsWith('house_') && !b.id.startsWith('res_') &&
            !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && !b.id.startsWith('port_') &&
            !b.id.startsWith('power_') && !b.id.startsWith('uni_') && !b.id.startsWith('court_') &&
            !b.id.startsWith('npc_apt_') && !b.id.startsWith('metro_') && !b.id.startsWith('pad_') &&
            b.id !== 'forest_0' && b.id !== 'forest_1' && b.id !== 'forest_space' &&
            !b.id.startsWith('space_') && b.id !== 'convention_center' &&
            b.id !== 'visitor_monument' && b.id !== 'neon_bar'
        ).sort((a, b) => a.x - b.x);

        // Place stalls in gaps between tech buildings
        const spots = [];
        for (let i = 0; i < techBlds.length - 1 && spots.length < this.VENDORS.length; i += 2) {
            const b1 = techBlds[i];
            const b2 = techBlds[i + 1];
            if (b1 && b2) spots.push(b1.x + b1.w + (b2.x - b1.x - b1.w) / 2);
        }
        // Fallback: evenly spaced through tech district
        if (spots.length < this.VENDORS.length && techBlds.length >= 2) {
            const sx = techBlds[0].x;
            const ex = techBlds[techBlds.length - 1].x + techBlds[techBlds.length - 1].w;
            for (let i = spots.length; i < this.VENDORS.length; i++) {
                spots.push(sx + ((ex - sx) * (i + 0.5)) / this.VENDORS.length);
            }
        }

        // Home base — worker housing
        const homeBld = G.bldById['npc_apt_1'];
        const homeBase = homeBld ? homeBld.x + homeBld.w / 2 : 300;

        const dp = G.getDayPhase();
        const isVending = dp >= 0.33 && dp < 0.75;

        this.VENDORS.forEach((v, i) => {
            const stallX = spots[i] || 3000 + i * 200;
            const stall = this._drawStall(charLayer, v, stallX);
            const av = this._drawAvatar(charLayer, v);
            const homeX = homeBase + (i - 2.5) * 35;

            av.c.x = isVending ? stallX - 20 : homeX;
            av.c.y = G.groundY - 18;
            av.c.visible = isVending;
            stall.cont.visible = isVending;

            const homeBldId = 'npc_apt_1';
            this.vendors.push({
                def: v, ...av, stall, stallX, homeX,
                state: isVending ? 'vending' : 'home',
                speed: 1.0 + Math.random() * 0.4,
                chatTimer: 0,
                bld: isVending ? null : homeBldId,
                homeBldId
            });
        });
    },

    // ─── STALL GRAPHIC (cart + canopy + sign) ───
    _drawStall(parent, v, x) {
        const cont = new PIXI.Container();
        cont.x = x;
        cont.y = G.groundY;
        cont.zIndex = 0; // behind characters (they have zIndex ≈ groundY)

        const g = new PIXI.Graphics();

        // Shadow
        g.beginFill(0x000000, 0.15);
        g.drawEllipse(0, 0, 22, 4);
        g.endFill();

        // Cart base
        g.beginFill(0x8b6914);
        g.drawRoundedRect(-18, -22, 36, 18, 2);
        g.endFill();

        // Counter top
        g.beginFill(0xd4a556);
        g.drawRect(-20, -24, 40, 4);
        g.endFill();

        // Wheels
        g.beginFill(0x555555);
        g.drawCircle(-14, -2, 3);
        g.drawCircle(14, -2, 3);
        g.endFill();
        g.beginFill(0x888888);
        g.drawCircle(-14, -2, 1.5);
        g.drawCircle(14, -2, 1.5);
        g.endFill();

        // Canopy pole
        g.beginFill(0x888888);
        g.drawRect(-1, -44, 2, 22);
        g.endFill();

        // Striped canopy
        g.beginFill(v.canopy);
        g.moveTo(-24, -44);
        g.lineTo(24, -44);
        g.lineTo(20, -36);
        g.lineTo(-20, -36);
        g.closePath();
        g.endFill();
        // Stripes
        g.beginFill(0xffffff, 0.15);
        g.drawRect(-16, -44, 8, 8);
        g.drawRect(0, -44, 8, 8);
        g.endFill();

        // Small items on counter
        g.beginFill(v.color, 0.6);
        g.drawRect(-12, -26, 6, 3);
        g.drawRect(-3, -27, 5, 4);
        g.drawRect(6, -26, 7, 3);
        g.endFill();

        cont.addChild(g);

        // Emoji sign
        const sign = new PIXI.Text(v.emoji, { fontSize: 12 });
        sign.anchor.set(0.5);
        sign.y = -52;
        cont.addChild(sign);


        // Click interaction
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        const hitPad = window.isMobile ? 10 : 0;
        cont.hitArea = new PIXI.Rectangle(-25 - hitPad, -62 - hitPad, 50 + hitPad * 2, 66 + hitPad * 2);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.addToast(`${v.emoji} ${v.name} — Fresh ${v.item}!`);
        });
        cont.on('pointerover', e => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, v.name, `Selling ${v.item}`);
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined') UI.hideTooltip();
        });

        parent.addChild(cont);
        return { cont, g, sign };
    },

    // ─── VENDOR AVATAR (small NPC with chef hat) ───
    _drawAvatar(parent, v) {
        const c = new PIXI.Container();
        const bw = 14, h = 28, headH = 10, bodyH = 12, legH = 4;

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.2);
        shadow.drawEllipse(0, 2, bw * 0.5, 2.5);
        shadow.endFill();

        // Legs
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x3d2914); legL.drawRect(-lw / 2, 0, lw, legH); legL.endFill();
        legL.x = -bw * 0.15;

        const legR = new PIXI.Graphics();
        legR.beginFill(0x3d2914); legR.drawRect(-lw / 2, 0, lw, legH); legR.endFill();
        legR.x = bw * 0.15;

        // Body (apron color)
        const body = new PIXI.Graphics();
        body.beginFill(v.color);
        body.drawRoundedRect(-bw / 2, 0, bw, bodyH, 2);
        body.endFill();
        body.y = -h + headH;

        // Head
        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        // Eyes
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, 1);
        head.drawCircle(bw * 0.1, headH * 0.38, 1);
        head.endFill();
        // Chef hat
        head.beginFill(0xffffff);
        head.drawRoundedRect(-bw * 0.35, -5, bw * 0.7, 6, 2);
        head.endFill();
        head.y = -h;

        // Chat bubble — matches standard entity style (white rounded bg + tail)
        const chat = new PIXI.Container();
        const chatBg = new PIXI.Graphics();
        const chatTxt = (typeof BitmapFonts !== 'undefined' && BitmapFonts.has('ChatBubble'))
            ? new PIXI.BitmapText('', { fontName: 'ChatBubble', fontSize: 8 })
            : new PIXI.Text('', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        chatTxt.anchor.set(0.5, 1); chatTxt.y = -4;
        chat.addChild(chatBg, chatTxt);
        chat.y = -h - 10;
        chat.visible = false;

        c.addChild(shadow, legL, legR, body, head, chat);

        // Click interaction
        c.eventMode = 'static';
        c.cursor = 'pointer';
        const hitPad = window.isMobile ? 10 : 0;
        c.hitArea = new PIXI.Rectangle(-bw - hitPad, -h - 16 - hitPad, bw * 2 + hitPad * 2, h + 20 + hitPad * 2);
        c.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.selectModel({
                id: v.id, name: v.name, isNPC: true, _trackType: 'vendor',
                role: `Street Vendor — ${v.item}`,
                lab: 'other',
                desc: `${v.name} sells ${v.item.toLowerCase()} from a mobile cart in the tech district.`
            });
        });
        c.on('pointerover', e => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, v.name, `${v.emoji} ${v.item}`);
        });
        c.on('pointerout', () => {
            if (typeof UI !== 'undefined') UI.hideTooltip();
        });

        parent.addChild(c);
        return { c, head, body, legL, legR, chat, chatBg, chatTxt };
    },

    // ─── MAIN UPDATE LOOP ───
    update(dp) {
        if (!this.vendors.length) return;

        this.vendors.forEach((vm, vi) => {
            const vendTime = dp >= 0.33 && dp < 0.83;
            const goTime   = dp >= 0.28 && dp < 0.33;

            // State machine — use metro like other NPCs
            if ((vendTime || goTime) && vm.state === 'home') {
                vm.c.visible = true;
                vm.c.x = vm.homeX;
                vm.bld = null;
                const destX = vm.stallX - 20;
                const dist = Math.abs(destX - vm.homeX);
                const stations = typeof NPCHousing !== 'undefined' ? NPCHousing._getMetroStations() : [];
                if (dist > 400 && stations.length >= 2) {
                    vm._metroEntryX = NPCHousing._nearestStation(vm.homeX, stations);
                    vm._metroExitX = NPCHousing._nearestStation(destX, stations);
                    vm._finalX = destX;
                    vm.state = 'walk_to_metro';
                } else {
                    vm.state = 'commute_to';
                }
            } else if (!vendTime && !goTime && vm.state === 'vending') {
                vm.stall.cont.visible = false;
                vm.bld = null;
                const dist = Math.abs(vm.homeX - vm.c.x);
                const stations = typeof NPCHousing !== 'undefined' ? NPCHousing._getMetroStations() : [];
                if (dist > 400 && stations.length >= 2) {
                    vm._metroEntryX = NPCHousing._nearestStation(vm.c.x, stations);
                    vm._metroExitX = NPCHousing._nearestStation(vm.homeX, stations);
                    vm._finalX = vm.homeX;
                    vm.state = 'walk_to_metro';
                } else {
                    vm.state = 'commute_home';
                }
            }

            // Movement & animation
            if (vm.state === 'walk_to_metro') {
                const dx = vm._metroEntryX - vm.c.x;
                if (Math.abs(dx) < 3) {
                    vm.state = 'riding_metro';
                    // Ride a real train in view; fall back to teleport if unavailable.
                    if (!(typeof NPCHousing !== 'undefined' && NPCHousing.startMetroRide(vm))) {
                        vm.c.visible = false;
                        vm._metroTimer = 100 + Math.floor(Math.random() * 80);
                    }
                } else {
                    vm.c.x += Math.sign(dx) * Math.min(vm.speed, Math.abs(dx));
                    vm.c.scale.x = dx > 0 ? 1 : -1;
                    vm.chat.scale.x = vm.c.scale.x;
                    this._animWalk(vm, vi);
                }
                vm.chat.visible = false;

            } else if (vm.state === 'riding_metro') {
                vm.chat.visible = false;
                const goingToStall = Math.abs(vm._finalX - (vm.stallX - 20)) < 50;
                if (vm._rm) {
                    if (NPCHousing.stepMetroRide(vm)) {
                        vm.state = goingToStall ? 'commute_to' : 'commute_home';
                    }
                } else {
                    vm._metroTimer--;
                    if (vm._metroTimer <= 0) {
                        vm.c.x = vm._metroExitX;
                        vm.c.visible = true;
                        vm.state = goingToStall ? 'commute_to' : 'commute_home';
                    }
                }

            } else if (vm.state === 'commute_to') {
                const dx = vm.stallX - 20 - vm.c.x;
                if (Math.abs(dx) < 3) {
                    vm.state = 'vending';
                    vm.c.x = vm.stallX - 20;
                    vm.stall.cont.visible = true;
                    vm.stall.cont.x = vm.stallX;
                } else {
                    vm.c.x += Math.sign(dx) * Math.min(vm.speed, Math.abs(dx));
                    vm.c.scale.x = dx > 0 ? 1 : -1;
                    vm.chat.scale.x = vm.c.scale.x;
                    this._animWalk(vm, vi);
                }
                vm.chat.visible = false;

            } else if (vm.state === 'commute_home') {
                const dx = vm.homeX - vm.c.x;
                if (Math.abs(dx) < 3) {
                    vm.state = 'home';
                    vm.c.visible = false;
                    vm.bld = vm.homeBldId;
                } else {
                    vm.c.x += Math.sign(dx) * Math.min(vm.speed, Math.abs(dx));
                    vm.c.scale.x = dx > 0 ? 1 : -1;
                    vm.chat.scale.x = vm.c.scale.x;
                    this._animWalk(vm, vi);
                }
                vm.chat.visible = false;

            } else if (vm.state === 'vending') {
                vm.c.visible = true;

                // Roam along the street — cart moves with vendor
                if (!vm._roamDir) vm._roamDir = 1;
                if (!vm._roamTimer) vm._roamTimer = 80 + Math.random() * 120;
                vm._roamTimer--;
                if (vm._roamTimer <= 0) {
                    vm._roamDir *= -1;
                    vm._roamTimer = 80 + Math.random() * 160;
                }
                const roamRange = 80;
                const nx = vm.c.x + vm._roamDir * 0.35;
                if (nx > vm.stallX - roamRange && nx < vm.stallX + roamRange) {
                    vm.c.x = nx;
                    // Move cart with the vendor
                    vm.stall.cont.x = nx + 20;
                }
                const dir = vm._roamDir > 0 ? 1 : -1;
                vm.c.scale.x = dir;
                vm.chat.scale.x = dir; // counter-scale chat text
                this._animWalk(vm, vi);

                // Vendor call-outs — standard bubble style
                vm.chatTimer--;
                if (vm.chatTimer <= 0 && Math.random() < 0.004) {
                    const tmpl = this.CALLS[Math.floor(Math.random() * this.CALLS.length)];
                    const msg = tmpl.replace(/\{item\}/g, vm.def.item).replace(/\{emoji\}/g, vm.def.emoji);
                    vm.chatTxt.text = msg;
                    vm.chatBg.clear();
                    vm.chatBg.beginFill(0xffffff);
                    vm.chatBg.drawRoundedRect(-vm.chatTxt.width / 2 - 6, -vm.chatTxt.height - 8, vm.chatTxt.width + 12, vm.chatTxt.height + 8, 4);
                    vm.chatBg.endFill();
                    vm.chatBg.beginFill(0xffffff);
                    vm.chatBg.moveTo(-3, -4); vm.chatBg.lineTo(3, -4); vm.chatBg.lineTo(0, 2); vm.chatBg.endFill();
                    vm.chat.visible = true;
                    vm.chatTimer = 300;
                } else if (vm.chatTimer <= 0) {
                    vm.chat.visible = false;
                }

            } else {
                // Home — hidden
                vm.c.visible = false;
                vm.stall.cont.visible = false;
            }
        });
    },

    _animWalk(vm, vi) {
        vm.legL.y = Math.sin(G.tick * 0.2 + vi) * 3;
        vm.legR.y = -Math.sin(G.tick * 0.2 + vi) * 3;
        vm.head.y = -28 + Math.sin(G.tick * 0.15 + vi) * 1.5;
        vm.body.y = -28 + 10 + Math.abs(Math.sin(G.tick * 0.15 + vi)) * 1.5;
    }
};
