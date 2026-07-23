/* ══════════════════════════════════════════════════════════════════════════
   AUDIO — procedural WebAudio SFX (in the spirit of the 2D snd.js) plus the
   Singularity City theme track. Everything degrades silently if audio is
   blocked before the first user gesture.
   ══════════════════════════════════════════════════════════════════════════ */
import { G } from './state.js';

export const Audio = {
    ctx: null,
    music: null,
    master: null,
    rainNode: null, rainGain: null,
    windNode: null, windGain: null,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = G.settings.volume;
            this.master.connect(this.ctx.destination);
            this._startBeds();
        } catch (e) { this.ctx = null; }

        if (G.settings.music) {
            this.music = new window.Audio('assets/SingularityCity.mp3');
            this.music.loop = true;
            this.music.volume = 0.35 * G.settings.volume;
            this.music.play().catch(() => {});
        }
    },

    setVolume(v) {
        G.settings.volume = v;
        if (this.master) this.master.gain.value = v;
        if (this.music) this.music.volume = 0.35 * v;
    },
    toggleMusic(on) {
        G.settings.music = on;
        if (on && !this.music) {
            this.music = new window.Audio('assets/SingularityCity.mp3');
            this.music.loop = true;
        }
        if (this.music) { on ? this.music.play().catch(() => {}) : this.music.pause(); }
    },

    _noiseBuffer(sec = 1.5) {
        const n = this.ctx.sampleRate * sec;
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    },

    // rain + wind ambient beds (gain driven by weather each frame)
    _startBeds() {
        const buf = this._noiseBuffer(2);
        // rain: bandpassed noise
        this.rainNode = this.ctx.createBufferSource();
        this.rainNode.buffer = buf; this.rainNode.loop = true;
        const rainFilt = this.ctx.createBiquadFilter();
        rainFilt.type = 'bandpass'; rainFilt.frequency.value = 2400; rainFilt.Q.value = 0.6;
        this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
        this.rainNode.connect(rainFilt).connect(this.rainGain).connect(this.master);
        this.rainNode.start();
        // wind: lowpassed noise, slow LFO on gain
        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = buf; this.windNode.loop = true; this.windNode.playbackRate.value = 0.4;
        const windFilt = this.ctx.createBiquadFilter();
        windFilt.type = 'lowpass'; windFilt.frequency.value = 380;
        this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.02;
        this.windNode.connect(windFilt).connect(this.windGain).connect(this.master);
        this.windNode.start();
        const lfo = this.ctx.createOscillator(), lfoG = this.ctx.createGain();
        lfo.frequency.value = 0.13; lfoG.gain.value = 0.012;
        lfo.connect(lfoG).connect(this.windGain.gain);
        lfo.start();
    },

    setWeatherBeds(state, intensity, night) {
        if (!this.ctx) return;
        const rain = { drizzle: 0.05, rain: 0.11, thunderstorm: 0.16 }[state] || 0;
        if (this.rainGain) this.rainGain.gain.linearRampToValueAtTime(rain * intensity, this.ctx.currentTime + 1.2);
        const wind = 0.015 + (state === 'thunderstorm' ? 0.05 : state === 'snow' ? 0.035 : 0.012) + night * 0.005;
        if (this.windGain) this.windGain.gain.linearRampToValueAtTime(wind, this.ctx.currentTime + 2);
    },

    _osc(type, f0, f1, t, dur, vol = 0.12) {
        if (!this.ctx || !G.settings.sfx) return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
    },

    _noise(t, dur, freq, vol = 0.1, type = 'lowpass') {
        if (!this.ctx || !G.settings.sfx) return;
        const s = this.ctx.createBufferSource();
        s.buffer = this._noiseBuffer(Math.max(0.3, dur));
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(this.master);
        s.start(t); s.stop(t + dur + 0.05);
    },

    sfx(name, opt) {
        if (!this.ctx || !G.settings.sfx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        const t = this.ctx.currentTime;
        switch (name) {
            case 'step': this._noise(t, 0.07, 300 + Math.random() * 150, 0.045); break;
            case 'step_run': this._noise(t, 0.08, 350 + Math.random() * 200, 0.07); break;
            case 'jump': this._osc('sine', 300, 500, t, 0.12, 0.06); break;
            case 'blip': this._osc('square', 880, 990, t, 0.07, 0.05); break;
            case 'open': this._osc('square', 440, 660, t, 0.1, 0.06); this._osc('square', 660, 880, t + 0.07, 0.1, 0.05); break;
            case 'close': this._osc('square', 660, 440, t, 0.1, 0.05); break;
            case 'district':
                [523, 659, 784].forEach((f, i) => this._osc('triangle', f, null, t + i * 0.07, 0.16, 0.05));
                break;
            case 'achieve':
                [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, null, t + i * 0.09, 0.22, 0.07));
                break;
            case 'quest':
                [392, 523, 659, 784, 1047].forEach((f, i) => this._osc('sine', f, null, t + i * 0.08, 0.3, 0.06));
                break;
            case 'thunder': {
                const delay = opt || 0.5;
                this._noise(t + delay, 1.8, 120, 0.35);
                this._noise(t + delay + 0.15, 1.2, 80, 0.3);
                break;
            }
            case 'rocket': this._noise(t, 3.5, 200, 0.2); this._osc('sawtooth', 60, 30, t, 3, 0.08); break;
            case 'meow': this._osc('sawtooth', 700, 350, t, 0.35, 0.08); this._osc('sawtooth', 720, 380, t + 0.05, 0.3, 0.05); break;
            case 'splash': this._noise(t, 0.4, 900, 0.08); break;
        }
    }
};
