/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUND & AUDIO LAYER (v16.0.0 - Procedural Ambiance & Soundtrack Engine)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SND = {
    ctx: null,
    masterGain: null,
    ambientGain: null,
    sfxGain: null,
    musicEl: null,
    
    _sfxEnabled: true,
    _musicEnabled: true,
    _sfxMutedByContext: false,  // Terminal mode mutes SFX/ambient without touching user pref

    currentAmbient: null,
    ambientNodes: [],
    ambientInterval: null,

    _sfxAudible() { return this._sfxEnabled && !this._sfxMutedByContext; },

    // Getters/Setters to maintain compatibility with engine.js save states
    get enabled() { return this._sfxEnabled; },
    set enabled(v) {
        this._sfxEnabled = v;
        this._applySfxGain();
    },

    _applySfxGain() {
        if (!this.ctx) return;
        const audible = this._sfxAudible();
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(audible ? 0.6 : 0, this.ctx.currentTime, 0.1);
        }
        if (this.ambientGain) {
            this.ambientGain.gain.setTargetAtTime(audible ? 0.4 : 0, this.ctx.currentTime, 0.5);
        }
    },

    setContextMute(muted) {
        this._sfxMutedByContext = !!muted;
        this._applySfxGain();
    },

    get musicEnabled() { return this._musicEnabled; },
    set musicEnabled(v) {
        this._musicEnabled = v;
        if (this.musicEl) {
            if (v && this.ctx && this.ctx.state === 'running') {
                this.musicEl.play().catch(()=>{});
            } else {
                this.musicEl.pause();
            }
        }
        localStorage.setItem('sc_music', v);
    },

    init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.value = this._sfxAudible() ? 0.6 : 0;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.connect(this.masterGain);
        this.ambientGain.gain.value = this._sfxAudible() ? 0.4 : 0;

        // Initialize Background Music
        this.musicEl = new Audio('SingularityCity.mp3?v=362');
        this.musicEl.loop = true;
        this.musicEl.volume = 0.35; 
        
        const savedMusic = localStorage.getItem('sc_music');
        if (savedMusic !== null) this._musicEnabled = savedMusic === 'true';

        // Browsers block autoplay. This unlocks audio context and plays music on the first user click.
        const unlock = () => {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            if (this._musicEnabled) this.musicEl.play().catch(()=>{});
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('touchstart', unlock);
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
    },

    // Procedural Synthesizer
    playTone(freq, type = 'sine', duration = 0.1, vol = 0.1, slideFreq = null) {
        if (!this.ctx || !this._sfxEnabled || this.ctx.state !== 'running') return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // Dynamic Sound Effects
    uiClick() { 
        this.playTone(800, 'sine', 0.05, 0.05); 
        setTimeout(() => this.playTone(1200, 'sine', 0.05, 0.04), 40); 
    },
    scan() { 
        this.playTone(400, 'triangle', 0.2, 0.05, 800); 
        setTimeout(() => this.playTone(600, 'sine', 0.4, 0.05, 200), 150);
    },
    birth() { 
        this.playTone(440, 'sine', 0.1, 0.1, 880);
        setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1, 1108), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.4, 0.1, 1318), 200);
    },
    retire() { 
        this.playTone(400, 'triangle', 0.4, 0.1, 100); 
        setTimeout(() => this.playTone(300, 'square', 0.4, 0.05, 50), 200);
    },
    achieve() {
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.3, 0.05), i * 100);
        });
    },
    launch() {
        this.playTone(220, 'sawtooth', 1.0, 0.1, 880);
        setTimeout(() => this.playTone(277.18, 'square', 1.0, 0.1, 1108), 100);
    },

    // Procedural Ambient Environments
    setAmbient(bldId) {
        if (!this.ctx) return;
        if (this.currentAmbient === bldId) return;
        this.currentAmbient = bldId;

        const now = this.ctx.currentTime;
        
        // 1. Smoothly fade out old ambient environment
        this.ambientNodes.forEach(n => {
            n.gain.gain.cancelScheduledValues(now);
            n.gain.gain.linearRampToValueAtTime(0, now + 1.0);
            n.osc.stop(now + 1.0);
        });
        this.ambientNodes = [];
        if (this.ambientInterval) { 
            clearInterval(this.ambientInterval); 
            this.ambientInterval = null; 
        }

        // 2. Identify the new environment type
        let env = 'outside';
        if (bldId === 'holomap') env = 'holomap';
        else if (bldId && bldId.startsWith('zone_')) env = bldId.slice(5);
        else if (bldId && bldId.startsWith('house_')) env = 'estate';
        else if (bldId && bldId.startsWith('res_')) env = 'ai_housing';
        else if (bldId && bldId.startsWith('metro_')) env = 'metro';
        else if (bldId && bldId !== 'outside') env = 'hq';

        // 3. Build the soundscape based on location (interval-based ambient effects only)
        if (env === 'outside') {
            // City — occasional distant wind chime
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.08) {
                    const notes = [523, 587, 659, 784, 880];
                    this.playTone(notes[Math.floor(Math.random()*5)], 'sine', 0.3, 0.006, null);
                }
            }, 3000);
        }
        else if (env === 'estate') {
            // Luxury lounge — slow gentle arpeggio (like a music box)
            let noteIdx = 0;
            const chordNotes = [261.6, 329.6, 392.0, 493.9, 523.3, 493.9, 392.0, 329.6];
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const freq = chordNotes[noteIdx % chordNotes.length];
                this.playTone(freq, 'sine', 0.25, 0.008);
                setTimeout(() => this.playTone(freq * 2, 'sine', 0.15, 0.004), 150);
                noteIdx++;
            }, 2800);
        }
        else if (env === 'ai_housing') {
            // Cozy apartment — gentle clock tick + occasional settling creak
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.4) {
                    this.playTone(2200, 'sine', 0.015, 0.004);
                } else if (Math.random() < 0.08) {
                    this.playTone(80 + Math.random()*40, 'triangle', 0.2, 0.006);
                }
            }, 1200);
        }
        else if (env === 'hq') {
            // HQ — soft rhythmic typing + occasional notification ping
            let typeBeat = 0;
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                typeBeat++;
                if (typeBeat % 3 === 0 && Math.random() < 0.3) {
                    this.playTone(4000 + Math.random()*2000, 'sine', 0.008, 0.003);
                }
                if (typeBeat % 12 === 0 && Math.random() < 0.2) {
                    this.playTone(880, 'sine', 0.08, 0.006);
                    setTimeout(() => this.playTone(1109, 'sine', 0.06, 0.005), 80);
                }
                if (typeBeat % 20 === 0 && Math.random() < 0.15) {
                    this.playTone(1200, 'sine', 0.06, 0.004, 800);
                }
            }, 400);
        }
        else if (env === 'metro') {
            // Underground station — periodic distant train + PA chime
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.1) {
                    this.playTone(80, 'sawtooth', 0.5, 0.008, 120);
                    setTimeout(() => this.playTone(120, 'sawtooth', 0.4, 0.006, 60), 300);
                } else if (Math.random() < 0.06) {
                    this.playTone(659, 'sine', 0.12, 0.008);
                    setTimeout(() => this.playTone(523, 'sine', 0.12, 0.008), 200);
                }
            }, 2500);
        }
        else if (env === 'holomap') {
            // Deep-space — cosmic pings
            this.ambientInterval = setInterval(() => {
                if (this._sfxEnabled && Math.random() < 0.2) {
                    const cosmicNotes = [440, 523, 659, 784, 880, 1047, 1319];
                    var f = cosmicNotes[Math.floor(Math.random() * cosmicNotes.length)];
                    this.playTone(f, 'sine', 0.2, 0.006, f * 0.5);
                }
            }, 2000);
        }

        // ─── ZONE-BASED OUTDOOR AMBIENTS ───
        else if (env === 'port') {
            // Harbor — seagull cries, distant foghorn
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const r = Math.random();
                if (r < 0.06) this.playTone(1800 + Math.random() * 400, 'sine', 0.15, 0.005, 1200);
                else if (r < 0.09) this.playTone(110, 'triangle', 0.8, 0.008);
            }, 3000);
        }
        else if (env === 'desert') {
            // Arid launch zone — distant metallic clanks
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.06) this.playTone(3000 + Math.random() * 1500, 'square', 0.02, 0.004);
                else if (Math.random() < 0.05) this.playTone(6000, 'sine', 0.1, 0.002, 2000);
            }, 2500);
        }
        else if (env === 'forest') {
            // Nature preserve — birdsong, leaf rustle
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const r = Math.random();
                if (r < 0.12) {
                    const bf = 2000 + Math.random() * 1500;
                    this.playTone(bf, 'sine', 0.08, 0.005, bf * 0.7);
                } else if (r < 0.16) this.playTone(5000, 'sine', 0.04, 0.002, 3000);
            }, 2000);
        }
        else if (env === 'npc_housing' || env === 'residential') {
            // Quiet neighborhood — distant traffic, door close
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.06) this.playTone(150 + Math.random() * 50, 'triangle', 0.3, 0.003, 100);
                else if (Math.random() < 0.04) this.playTone(250, 'sine', 0.03, 0.005);
            }, 2500);
        }
        else if (env === 'compute') {
            // Data center corridor — cooling fans, data chirps
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.2) this.playTone(800 + Math.random() * 400, 'sine', 0.1, 0.003, 600);
                if (Math.random() < 0.1) this.playTone(1500, 'sine', 0.04, 0.004, 900);
            }, 800);
        }
        else if (env === 'university') {
            // Academic campus — page turns, chalk taps
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.08) this.playTone(4000, 'sine', 0.02, 0.003, 2000);
                else if (Math.random() < 0.05) this.playTone(3500, 'sine', 0.01, 0.004);
            }, 1800);
        }
        else if (env === 'court') {
            // Formal judicial — occasional gavel
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.04) {
                    this.playTone(200, 'sine', 0.05, 0.008);
                    setTimeout(() => this.playTone(180, 'sine', 0.03, 0.005), 50);
                }
            }, 3000);
        }
        else if (env === 'vcrow') {
            // Financial district — ticker beeps, deal bells
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const r = Math.random();
                if (r < 0.08) {
                    this.playTone(1200, 'sine', 0.03, 0.005);
                } else if (r < 0.12) {
                    this.playTone(3500 + Math.random() * 1500, 'sine', 0.01, 0.003);
                } else if (r < 0.14) {
                    this.playTone(660, 'sine', 0.08, 0.006);
                    setTimeout(() => this.playTone(880, 'sine', 0.06, 0.005), 80);
                }
            }, 1200);
        }
        else if (env === 'nightlife') {
            // Neon strip — muffled bass hits, glass clinks
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.1) this.playTone(120, 'sawtooth', 0.06, 0.004);
                else if (Math.random() < 0.06) this.playTone(3000 + Math.random() * 1000, 'sine', 0.02, 0.005);
            }, 1500);
        }
        else if (env === 'estates') {
            // Billionaire's Row — birdsong, distant fountain
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.1) {
                    const f = 2200 + Math.random() * 1200;
                    this.playTone(f, 'sine', 0.06, 0.004, f * 0.8);
                } else if (Math.random() < 0.04) this.playTone(1000, 'sine', 0.15, 0.003, 800);
            }, 2500);
        }
        else if (env === 'power') {
            // Power grid — electrical crackle
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.08) this.playTone(8000, 'sawtooth', 0.02, 0.005, 2000);
                else if (Math.random() < 0.05) this.playTone(3000, 'sine', 0.008, 0.006);
            }, 2000);
        }
    }
};
