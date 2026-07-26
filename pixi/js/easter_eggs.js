/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   EASTER EGGS (v16.5.0 - Extracted from engine.js)
   Mixin providing easter egg triggers for the game engine.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EasterEggs = {
    initEasterEggs() {
        const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

        // Konami Code listener
        window.addEventListener('keydown', (e) => {
            this._konamiSeq.push(e.key);
            if (this._konamiSeq.length > 10) this._konamiSeq.shift();
            if (this._konamiSeq.length === 10 && this._konamiSeq.every((k, i) => k === KONAMI[i])) {
                this._konamiSeq = [];
                this.triggerMatrixRain();
                this.unlockAchieve('konami');
            }
        });

        // Moon click listener
        if (this.celestialGfx) {
            this.celestialGfx.eventMode = 'static';
            this.celestialGfx.cursor = 'pointer';
            this.celestialGfx.on('pointerdown', () => {
                this._moonClicks++;
                if (typeof SND !== 'undefined') SND.playTone(600 + this._moonClicks * 200, 'sine', 0.08, 0.03);
                if (this._moonClicks >= 5) {
                    this._moonClicks = 0;
                    this.triggerCatMode();
                    this.unlockAchieve('cat_mode');
                }
            });
        }

        // Night Owl check
        const h = new Date().getHours();
        if (h >= 0 && h < 5) {
            setTimeout(() => this.unlockAchieve('night_owl'), 5000);
        }
    },

    triggerMatrixRain() {
        if (this._matrixMode) return;
        this._matrixMode = true;
        if (typeof UI !== 'undefined') UI.addToast('\ud83d\udd79\ufe0f THE MATRIX HAS YOU...');
        if (typeof SND !== 'undefined') { SND.playTone(200, 'sawtooth', 0.5, 0.05, 100); SND.playTone(150, 'square', 1.0, 0.03, 50); }

        const overlay = document.createElement('canvas');
        overlay.id = 'matrixRain';
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;opacity:0.85;';
        document.body.appendChild(overlay);

        const ctx = overlay.getContext('2d');
        const cols = Math.floor(overlay.width / 14);
        const drops = Array(cols).fill(1);
        const chars = '\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd\u30bf\u30c1\u30c4\u30c6\u30c8\u30ca\u30cb\u30cc\u30cd\u30ce\u30cf\u30d2\u30d5\u30d8\u30db\u30de\u30df\u30e0\u30e1\u30e2\u30e4\u30e6\u30e8\u30e9\u30ea\u30eb\u30ec\u30ed\u30ef\u30f2\u30f301';

        const drawFrame = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, overlay.width, overlay.height);
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            for (let i = 0; i < drops.length; i++) {
                const ch = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillStyle = Math.random() > 0.9 ? '#fff' : '#0f0';
                ctx.fillText(ch, i * 14, drops[i] * 14);
                if (drops[i] * 14 > overlay.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        };

        const matrixId = setInterval(drawFrame, 50);
        setTimeout(() => {
            clearInterval(matrixId);
            overlay.remove();
            this._matrixMode = false;
        }, 10000);
    },

    triggerCatMode() {
        if (this._catMode) return;
        this._catMode = true;
        if (typeof UI !== 'undefined') UI.addToast('\ud83d\udc31 CATURDAY MODE ACTIVATED!');
        if (typeof SND !== 'undefined') { SND.playTone(800, 'sine', 0.1, 0.04, 1200); SND.playTone(1000, 'triangle', 0.08, 0.03, 600); }

        const catEmojis = ['\ud83d\udc31', '\ud83d\ude3a', '\ud83d\ude38', '\ud83d\ude3b', '\ud83d\udc08', '\ud83d\ude3c', '\ud83d\ude40', '\ud83d\ude39', '\ud83d\ude3d', '\ud83d\ude3e'];
        const origEmojis = {};
        Object.keys(this.charRefs).forEach(id => {
            const refs = this.charRefs[id];
            if (refs && refs.emojiTxt) {
                origEmojis[id] = refs.emojiTxt.text;
                refs.emojiTxt.text = catEmojis[Math.floor(Math.random() * catEmojis.length)];
            }
        });

        setTimeout(() => {
            Object.keys(origEmojis).forEach(id => {
                const refs = this.charRefs[id];
                if (refs && refs.emojiTxt) refs.emojiTxt.text = origEmojis[id];
            });
            this._catMode = false;
            if (typeof UI !== 'undefined') UI.addToast('\ud83d\udc31 Cats have returned to their dimension.');
        }, 30000);
    }
};
