/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BITMAP FONTS (v1.0.0 — Phase 1a)
   Bakes the handful of fonts we use heavily in-world into BitmapFonts, so text updates become
   free (vertex writes) instead of expensive (canvas re-raster per character).

   Baseline to beat (measured v226, city scene, ~200 NPCs):
     • ~21,700 sprites, 8,268 cached textures, ~80 FPS, 12ms/frame

   Why bitmap fonts matter here:
     • Every PIXI.Text allocates a private canvas + texture.
     • Every `.text = newString` re-rasters it — a full canvas 2D draw + GPU upload.
     • Chat bubbles alone retext dozens of times per second as NPCs cycle through messages.
     • BitmapText reuses a single atlas texture; changing .text just rewrites quads.

   Fonts baked here are the ones used by createCharacter chat bubbles, street vendor signs,
   and any other high-churn in-world labels. The one-time bake cost at boot is ~50-150ms
   total and happens off the render path.

   All fonts use ASCII_PRINTABLE (95 chars) to keep atlas size small. Extended/unicode text
   should continue to use PIXI.Text.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BitmapFonts = {
    ready: false,
    _loaded: {},

    init() {
        if (this.ready || typeof PIXI === 'undefined' || !PIXI.BitmapFont) return;

        // Small helper — bake with ASCII printable range only. PIXI accepts either a char
        // list array or a PIXI.BitmapFont.ASCII constant; we spell it out for clarity.
        const ascii = [[' ', '~']];

        // Chat bubbles — black bold 8px. Used on every NPC speech bubble.
        this._bake('ChatBubble', {
            fontFamily: 'JetBrains Mono, Silkscreen, monospace',
            fontSize: 16, // bake at 2x then render at 8 → crisper on HiDPI
            fontWeight: 'bold',
            fill: 0x000000,
        }, { chars: ascii, resolution: 1 });

        // Neon signs on characters / street vendors — 8px white, tinted at use site.
        this._bake('Neon8', {
            fontFamily: 'Silkscreen, monospace',
            fontSize: 16,
            fill: 0xffffff,
            letterSpacing: 1,
        }, { chars: ascii, resolution: 1 });

        this.ready = true;
    },

    _bake(name, style, options) {
        try {
            PIXI.BitmapFont.from(name, style, options);
            this._loaded[name] = true;
        } catch (e) {
            // Non-fatal — consumers fall back to PIXI.Text if they check BitmapFonts.ready
            console.warn(`[BitmapFonts] failed to bake "${name}":`, e);
        }
    },

    // Convenience: returns true if a given baked font is available.
    has(name) {
        return !!this._loaded[name];
    },
};
