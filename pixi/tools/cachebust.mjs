// Tiny dev-only script: rewrite <script src="js/foo.js"> → <script src="js/foo.js?v=N">
// in index.html. Run via `node tools/cachebust.mjs [version]`. Idempotent — strips any
// existing ?v=... first, then appends the new one. Used to defeat browser HTTP cache during
// rapid iteration without having to manually edit every tag.
//
// Usage:
//   node tools/cachebust.mjs          # auto-pick next safe version (max(local, remote) + 1)
//   node tools/cachebust.mjs 227      # force a specific version
//
// Auto-mode runs `git fetch origin main` and reads the remote sw.js CACHE_NAME so
// parallel sessions can't pick the same version and accidentally skip cache
// invalidation. Falls back to local-only bump if git/network fails.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function extractVersion(swContent) {
    const m = swContent && swContent.match(/CACHE_NAME = 'singularity-city-v(\d+)'/);
    return m ? parseInt(m[1], 10) : 0;
}

function getLocalVersion() {
    try { return extractVersion(readFileSync('sw.js', 'utf8')); }
    catch { return 0; }
}

function getRemoteVersion() {
    try {
        execSync('git fetch origin main --quiet', { stdio: 'pipe' });
        const remoteSw = execSync('git show origin/main:sw.js', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        return extractVersion(remoteSw);
    } catch (e) {
        const firstLine = String(e.message || e).split('\n')[0];
        console.warn(`cachebust: couldn't read remote sw.js (${firstLine}) — falling back to local-only bump`);
        return 0;
    }
}

let version = process.argv[2];
if (!version) {
    const local = getLocalVersion();
    const remote = getRemoteVersion();
    const next = Math.max(local, remote) + 1;
    version = String(next);
    console.log(`cachebust: auto-detected — local=v${local}, remote=v${remote} → bumping to v${version}`);
}

const path = 'index.html';
let html = readFileSync(path, 'utf8');

// Replace only local js/* script tags. CDN tags are left alone.
// Handles both <script src="..."> and <script defer src="...">
html = html.replace(
    /<script(\s+defer)?\s+src="(js\/[^"?]+)(\?v=[^"]*)?"><\/script>/g,
    `<script$1 src="$2?v=${version}"></script>`
);

// Also bump local css/* stylesheet tags
html = html.replace(
    /<link\s+rel="stylesheet"\s+href="(css\/[^"?]+)(\?v=[^"]*)?"\s*>/g,
    `<link rel="stylesheet" href="$1?v=${version}">`
);

writeFileSync(path, html);

// Keep the service-worker CACHE_NAME in sync with index.html versions.
// Without this, bumping only index.html leaves the SW serving stale cached
// copies of the old assets — a silent production-deploy hazard.
const swPath = 'sw.js';
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(
    /const CACHE_NAME = 'singularity-city-v[^']*';/,
    `const CACHE_NAME = 'singularity-city-v${version}';`
);

// Regenerate CORE_ASSETS from index.html so the precache list can never drift
// from the script tags again (robot_models.js/space_rockets.js were once added
// to index.html but not here — offline PWA then threw in those zones).
const jsAssets = [...html.matchAll(/<script(?:\s+defer)?\s+src="(js\/[^"?]+)(?:\?v=[^"]*)?"><\/script>/g)].map(m => '/' + m[1]);
const cssAssets = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="(css\/[^"?]+)(?:\?v=[^"]*)?"\s*>/g)].map(m => '/' + m[1]);
const STATIC_ASSETS = [
    '/', '/index.html', '/manifest.json', '/og-image.png',
    '/favicon.ico', '/favicon-32.png', '/icon-192.png', '/icon-512.png',
    // Loaded via new Worker(), not a <script> tag — keep it precached.
    '/js/compute_worker.js',
];
const assets = [...STATIC_ASSETS, ...cssAssets, ...jsAssets];
const assetList = assets.map(a => `    '${a}'`).join(',\n');
// Presence test, not before/after equality — when the regenerated list is
// byte-identical to what's already in sw.js the replace is a no-op, and an
// equality check would false-positive this warning.
if (!/const CORE_ASSETS = \[[\s\S]*?\];/.test(sw)) {
    console.warn('cachebust: WARNING — could not find CORE_ASSETS in sw.js; precache not regenerated');
} else {
    sw = sw.replace(
        /const CORE_ASSETS = \[[\s\S]*?\];/,
        `const CORE_ASSETS = [\n${assetList}\n];`
    );
}
writeFileSync(swPath, sw);

console.log(`cachebust: bumped local js/* and css/* tags, sw.js CACHE_NAME to v=${version}, regenerated CORE_ASSETS (${assets.length} entries)`);
