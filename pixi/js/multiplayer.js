/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   MULTIPLAYER PRESENCE (v1.0.0)
   Ghost cursors, live visitor counter, emoji reactions via Supabase Realtime.
   Fully graceful — city works fine if Supabase is unavailable.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Multiplayer = {
    _DEFAULT_COLOR: 0x22d3ee,
    _DEFAULT_HANDLE: '???',

    _inited: false,
    _channel: null,
    _reactChannel: null,
    _myId: '',
    _myHandle: '',
    _myColor: 0x22d3ee,
    _peers: {},
    _ghostLayer: null,
    _lastBroadcast: 0,
    _lastSentWorldX: null,
    _reactionQueue: [],
    _reactionGfx: null,
    _counterEl: null,

    _PREFIXES: ['Neo', 'Cyber', 'Neon', 'Glitch', 'Pixel', 'Hex', 'Flux', 'Zeta', 'Byte', 'Void',
                'Syn', 'Drift', 'Pulse', 'Arc', 'Ion', 'Null', 'Axis', 'Qubit', 'Vex', 'Rift'],
    _SUFFIXES: ['Walker', 'Runner', 'Ghost', 'Fox', 'Hawk', 'Wolf', 'Cat', 'Spark', 'Shade', 'Wave',
                'Mind', 'Core', 'Node', 'Link', 'Bit', 'Mask', 'Blade', 'Crypt', 'Storm', 'Glow'],

    _generateHandle() {
        const p = this._PREFIXES[Math.floor(Math.random() * this._PREFIXES.length)];
        const s = this._SUFFIXES[Math.floor(Math.random() * this._SUFFIXES.length)];
        const n = Math.floor(Math.random() * 100);
        return `${p}${s}${n}`;
    },

    _generateColor() {
        const hue = Math.floor(Math.random() * 360);
        // HSL to hex — bright, saturated colors for ghost cursors
        const sat = 0.8, lit = 0.6;
        const c = (1 - Math.abs(2 * lit - 1)) * sat;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = lit - c / 2;
        let r, g, b;
        if (hue < 60) { r = c; g = x; b = 0; }
        else if (hue < 120) { r = x; g = c; b = 0; }
        else if (hue < 180) { r = 0; g = c; b = x; }
        else if (hue < 240) { r = 0; g = x; b = c; }
        else if (hue < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        const toHex = (v) => Math.round((v + m) * 255);
        return (toHex(r) << 16) | (toHex(g) << 8) | toHex(b);
    },

    init(ghostLayer) {
        if (this._inited) return;
        if (!API.supabase) { this._offlineMode(); return; }
        this._inited = true;
        this._ghostLayer = ghostLayer;

        // Reuse visitor ID from VisitorTracker (already written to localStorage)
        this._myId = localStorage.getItem('sc_visitor_id') || 'v_anon';

        let handle = localStorage.getItem('sc_mp_handle');
        let color = localStorage.getItem('sc_mp_color');
        if (!handle) {
            handle = this._generateHandle();
            localStorage.setItem('sc_mp_handle', handle);
        }
        if (!color) {
            color = this._generateColor().toString();
            localStorage.setItem('sc_mp_color', color);
        }
        this._myHandle = handle;
        this._myColor = parseInt(color);

        this._reactionGfx = new PIXI.Container();
        this._reactionGfx.zIndex = 999;
        if (ghostLayer) ghostLayer.addChild(this._reactionGfx);

        this._buildUI();
        this._connectPresence();
        this._connectReactions();
    },

    _offlineMode() {
        this._buildUI();
        this._updateCounterUI(1);
    },

    _connectPresence() {
        try {
            this._channel = API.supabase.channel('city-presence', {
                config: { presence: { key: this._myId } }
            });

            this._channel
                .on('presence', { event: 'sync' }, () => {
                    this._onPresenceSync(this._channel.presenceState());
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (key === this._myId) return;
                    newPresences.forEach(p => this._addPeer(key, p));
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    this._removePeer(key);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        const wx = this._getWorldX();
                        this._lastSentWorldX = wx;
                        await this._channel.track({
                            handle: this._myHandle,
                            color: this._myColor,
                            worldX: wx
                        });
                    }
                });
        } catch (e) {
            console.warn('Multiplayer presence connection failed:', e);
            this._updateCounterUI(1);
        }
    },

    _connectReactions() {
        try {
            this._reactChannel = API.supabase.channel('city-reactions');

            this._reactChannel
                .on('broadcast', { event: 'reaction' }, ({ payload }) => {
                    if (!payload || payload.senderId === this._myId) return;
                    // Anyone with the public anon key can broadcast on this
                    // channel — clamp everything before it touches the stage.
                    if (!this.REACTIONS.includes(payload.emoji)) return;
                    const wx = Number(payload.worldX);
                    if (!isFinite(wx)) return;
                    this._spawnReactionBubble(payload.emoji, Math.max(0, Math.min(wx, 1e6)));
                })
                .subscribe();
        } catch (e) {
            console.warn('Multiplayer reactions channel failed:', e);
        }
    },

    _onPresenceSync(state) {
        const peerIds = new Set();
        let count = 0;

        Object.entries(state).forEach(([key, presences]) => {
            count++;
            if (key === this._myId) return;
            peerIds.add(key);
            const latest = presences[presences.length - 1];
            const existing = this._peers[key];
            if (existing) {
                const sane = this._sanePeer(latest);
                existing.worldX = sane.worldX;
                existing.handle = sane.handle;
                existing.color = sane.color;
                existing.lastSeen = Date.now();
            } else {
                this._addPeer(key, latest);
            }
        });

        Object.keys(this._peers).forEach(k => {
            if (!peerIds.has(k)) this._removePeer(k);
        });

        this._updateCounterUI(Math.max(1, count));
    },

    // Presence payloads come from other anonymous clients — clamp before render.
    _sanePeer(presence) {
        const c = Number(presence && presence.color);
        return {
            color: (isFinite(c) && c >= 0 && c <= 0xffffff) ? c : this._DEFAULT_COLOR,
            handle: String((presence && presence.handle) || this._DEFAULT_HANDLE).slice(0, 20),
            worldX: Math.max(0, Math.min(Number((presence && presence.worldX) || 0) || 0, 1e6)),
        };
    },

    _addPeer(key, presence) {
        if (key === this._myId || this._peers[key]) return;
        const { color, handle, worldX } = this._sanePeer(presence);

        const cont = new PIXI.Container();
        cont.alpha = 0.35;
        cont.zIndex = 5;

        const body = new PIXI.Graphics();
        body.beginFill(color, 0.6);
        body.drawRoundedRect(-5, -16, 10, 16, 3);
        body.endFill();
        body.beginFill(color, 0.7);
        body.drawCircle(0, -20, 5);
        body.endFill();
        body.beginFill(color, 0.15);
        body.drawCircle(0, -10, 14);
        body.endFill();
        cont.addChild(body);

        const tag = new PIXI.Text(handle, {
            fontFamily: 'JetBrains Mono', fontSize: 7, fill: color,
            fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x000000,
            dropShadowBlur: 3, dropShadowDistance: 0
        });
        tag.anchor.set(0.5, 1);
        tag.y = -28;
        cont.addChild(tag);

        cont.x = worldX;
        cont.y = G.groundY - 2;

        if (this._ghostLayer) this._ghostLayer.addChild(cont);

        this._peers[key] = { worldX, handle, color, lastSeen: Date.now(), gfx: cont };
    },

    _removePeer(key) {
        const peer = this._peers[key];
        if (!peer) return;
        if (peer.gfx && peer.gfx.parent) peer.gfx.parent.removeChild(peer.gfx);
        if (peer.gfx) peer.gfx.destroy({ children: true });
        delete this._peers[key];
    },

    REACTIONS: ['🔥', '🚀', '👀', '💰', '🤯'],

    sendReaction(emoji) {
        const worldX = this._getWorldX();
        this._spawnReactionBubble(emoji, worldX);

        if (this._reactChannel) {
            try {
                this._reactChannel.send({
                    type: 'broadcast',
                    event: 'reaction',
                    payload: { emoji, worldX, senderId: this._myId }
                });
            } catch (e) { /* silent */ }
        }
    },

    _MAX_REACTION_QUEUE: 30,

    _spawnReactionBubble(emoji, worldX) {
        if (this._reactionQueue.length >= this._MAX_REACTION_QUEUE) return; // flood guard
        this._reactionQueue.push({
            emoji, worldX,
            worldY: G.groundY - 40 - Math.random() * 30,
            age: 0
        });
    },

    _buildUI() {
        const topMain = document.querySelector('.top-main');
        if (topMain && !document.getElementById('mpCounter')) {
            const badge = document.createElement('div');
            badge.id = 'mpCounter';
            badge.className = 'mp-counter';
            badge.innerHTML = '<span class="mp-dot"></span><span class="mp-count">1</span><span class="mp-label">online</span>';
            topMain.appendChild(badge);
            this._counterEl = badge;
        }

        if (!document.getElementById('mpReactions')) {
            const bar = document.createElement('div');
            bar.id = 'mpReactions';
            bar.className = 'mp-reactions';
            this.REACTIONS.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'mp-react-btn';
                btn.textContent = emoji;
                btn.title = `Send ${emoji} reaction`;
                btn.onclick = () => {
                    this.sendReaction(emoji);
                    btn.classList.add('mp-react-pop');
                    setTimeout(() => btn.classList.remove('mp-react-pop'), 300);
                };
                bar.appendChild(btn);
            });
            const wrap = document.getElementById('gameWrap');
            if (wrap) wrap.appendChild(bar);
        }
    },

    _updateCounterUI(count) {
        const el = this._counterEl || document.getElementById('mpCounter');
        if (!el) return;
        const countSpan = el.querySelector('.mp-count');
        const labelSpan = el.querySelector('.mp-label');
        if (countSpan) countSpan.textContent = count;
        if (labelSpan) labelSpan.textContent = count === 1 ? 'explorer' : 'explorers';
    },

    _getWorldX() {
        if (typeof Camera !== 'undefined') {
            return Math.round(-Camera.x + G.vpW / (2 * (Camera.zoom || 1)));
        }
        return 0;
    },

    update() {
        if (!this._inited) return;

        const now = Date.now();

        // Broadcast position every 2 seconds, but only if camera moved
        if (now - this._lastBroadcast > 2000 && this._channel) {
            const wx = this._getWorldX();
            if (wx !== this._lastSentWorldX) {
                this._lastBroadcast = now;
                this._lastSentWorldX = wx;
                try {
                    this._channel.track({
                        handle: this._myHandle,
                        color: this._myColor,
                        worldX: wx
                    });
                } catch (e) { /* silent */ }
            }
        }

        // Smooth peer ghost positions
        for (const key in this._peers) {
            const peer = this._peers[key];
            if (!peer.gfx) continue;
            const targetX = peer.worldX || 0;
            peer.gfx.x += (targetX - peer.gfx.x) * 0.08;
            peer.gfx.y = G.groundY - 2;
            peer.gfx.alpha = 0.3 + Math.sin(G.tick * 0.03 + (peer.color || 0)) * 0.08;
        }

        this._updateReactions();
    },

    _updateReactions() {
        if (!this._reactionGfx) return;

        while (this._reactionQueue.length > 0) {
            const r = this._reactionQueue.shift();
            const txt = new PIXI.Text(r.emoji, { fontSize: 18 });
            txt.anchor.set(0.5);
            txt.x = r.worldX + (Math.random() - 0.5) * 40;
            txt.y = r.worldY;
            txt._age = 0;
            txt._startY = txt.y;
            txt._driftX = (Math.random() - 0.5) * 0.5;
            this._reactionGfx.addChild(txt);
        }

        const len = this._reactionGfx.children.length;
        if (len === 0) return;

        for (let i = len - 1; i >= 0; i--) {
            const txt = this._reactionGfx.children[i];
            txt._age++;
            txt.y = txt._startY - txt._age * 0.6;
            txt.x += txt._driftX;
            txt.alpha = Math.max(0, 1 - txt._age / 90);
            txt.scale.set(1 + Math.sin(txt._age * 0.1) * 0.1);
            if (txt._age > 90) {
                this._reactionGfx.removeChild(txt);
                txt.destroy();
            }
        }
    },

    destroy() {
        if (this._channel) {
            try { this._channel.unsubscribe(); } catch (e) { /* */ }
        }
        if (this._reactChannel) {
            try { this._reactChannel.unsubscribe(); } catch (e) { /* */ }
        }
        Object.keys(this._peers).forEach(k => this._removePeer(k));
        this._inited = false;
    }
};
