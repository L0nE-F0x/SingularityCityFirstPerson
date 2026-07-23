/* ══════════════════════════════════════════════════════════════════════════
   RESEARCH-PAPER DELIVERIES — arXiv-style envelopes travel from the
   university / press to lab HQs. Pool-bounded sprites (flat cost).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { City } from './city.js';

export const PAPER_SOURCES = ['uni_main', 'times_hq', 'convention_center'];
export const PAPER_LABS = [
    'bld_o', 'bld_a', 'bld_g', 'bld_m', 'bld_mi', 'bld_ds', 'bld_x'
];
const POOL = 12;
const TITLES = [
    'Attention Is All You Need', 'Scaling Laws for NN', 'Constitutional AI',
    'Chain-of-Thought', 'RLHF Survey', 'Mixture of Experts',
    'FlashAttention', 'LoRA: Low-Rank', 'DPO Alignment', 'Grok-1 Tech Report',
    'Multimodal Fusion', 'Toolformer'
];

/** Build a delivery job (pure). */
export function makePaperJob(i, bldAt, seed = 0) {
    const srcId = PAPER_SOURCES[(i + seed) % PAPER_SOURCES.length];
    const dstId = PAPER_LABS[(i * 5 + seed) % PAPER_LABS.length];
    const src = bldAt(srcId);
    const dst = bldAt(dstId);
    if (!src || !dst) return null;
    return {
        id: 'paper_' + i,
        title: TITLES[i % TITLES.length],
        srcBid: srcId,
        dstBid: dstId,
        x: src.worldX,
        y: 28 + (i % 5) * 4,
        z: src.worldZ,
        tx: dst.worldX,
        tz: dst.worldZ,
        progress: 0,
        speed: 55 + (i % 4) * 12,
        delivered: false,
        age: 0
    };
}

/** Advance envelope; returns true when newly delivered. */
export function stepPaper(job, dt) {
    if (!job || job.delivered) return false;
    job.age += dt;
    const dx = job.tx - job.x, dz = job.tz - job.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 18) {
        job.delivered = true;
        job.progress = 1;
        return true;
    }
    const v = job.speed * dt;
    job.x += (dx / dist) * v;
    job.z += (dz / dist) * v;
    job.y = 24 + Math.sin(job.age * 3 + job.id.length) * 4;
    job.progress = 1 - dist / (Math.hypot(job.tx - job.x, job.tz - job.z) + dist);
    return false;
}

function envelopeTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 80;
    const g = c.getContext('2d');
    g.fillStyle = '#f5f0e1';
    g.fillRect(0, 0, 128, 80);
    g.strokeStyle = '#c4a574';
    g.lineWidth = 3;
    g.strokeRect(4, 4, 120, 72);
    g.beginPath();
    g.moveTo(4, 4); g.lineTo(64, 40); g.lineTo(124, 4);
    g.strokeStyle = '#b8956a';
    g.stroke();
    g.fillStyle = '#8b4513';
    g.font = 'bold 14px monospace';
    g.fillText('arXiv', 40, 58);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export const ResearchPapers = {
    jobs: [],
    sprites: [],
    delivered: 0,
    _pool: POOL,
    active: true,

    init(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        const tex = envelopeTexture();
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        this.jobs = [];
        this.sprites = [];
        for (let i = 0; i < POOL; i++) {
            const sp = new THREE.Sprite(mat.clone());
            sp.scale.set(18, 11, 1);
            sp.visible = false;
            this.group.add(sp);
            this.sprites.push(sp);
            const job = makePaperJob(i, (id) => G.bldById[id], i);
            if (job) {
                // stagger start positions along path
                const t = (i / POOL);
                job.x = job.x + (job.tx - job.x) * t * 0.15;
                job.z = job.z + (job.tz - job.z) * t * 0.15;
                this.jobs.push(job);
                sp.visible = true;
            } else {
                this.jobs.push(null);
            }
        }
    },

    _respawn(i) {
        const job = makePaperJob(i + this.delivered, (id) => G.bldById[id], this.delivered + i);
        this.jobs[i] = job;
        if (this.sprites[i]) this.sprites[i].visible = !!job;
    },

    update(dt) {
        if (!this.active) return;
        for (let i = 0; i < this.jobs.length; i++) {
            let job = this.jobs[i];
            if (!job) { this._respawn(i); job = this.jobs[i]; }
            if (!job) continue;
            if (stepPaper(job, dt)) {
                this.delivered++;
                this._respawn(i);
                job = this.jobs[i];
            }
            const sp = this.sprites[i];
            if (sp && job) {
                sp.position.set(job.x, job.y, job.z);
                sp.visible = !job.delivered;
            }
        }
    },

    snapshot() {
        return {
            pool: this.jobs.filter(Boolean).length,
            delivered: this.delivered,
            inFlight: this.jobs.filter(j => j && !j.delivered).length,
            titles: this.jobs.filter(Boolean).map(j => j.title)
        };
    }
};
