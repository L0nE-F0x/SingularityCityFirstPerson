// tools/freshness.mjs — Accuracy self-check (MAINTENANCE.md Part E).
//
// Scans every js/*.js for `milestone:` strings, parses the leading date, and
// flags any data feed (file) whose NEWEST milestone is older than a threshold,
// plus counts undated milestones. Run before a monthly data refresh to see at a
// glance which zones have gone stale.
//
// Usage:
//   node tools/freshness.mjs        # default: flag feeds stale > 6 months
//   node tools/freshness.mjs 3      # flag feeds whose newest milestone > 3 months old
//
// Exit code is 1 if any dated feed is stale (so it can gate a CI/pre-refresh
// check); 0 otherwise. Undated-only feeds are reported but never fail the run.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'js');
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const thresholdMonths = parseInt(process.argv[2], 10) || 6;
const now = new Date();
const cutoff = new Date(now.getFullYear(), now.getMonth() - thresholdMonths, now.getDate());

// Parse a leading date out of a milestone string. Handles "Jul 6, 2026",
// "Jul 2026", and season/half/quarter-prefixed or bare "2026". Day defaults to
// mid-month and month to mid-year so partial dates sort sensibly.
function parseDate(s) {
    let m = s.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})/i);
    if (m) return new Date(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2] ? +m[2] : 15);
    m = s.match(/^(?:H[12]|Q[1-4]|early|mid|late|spring|summer|fall|autumn|winter)?[ -]*(\d{4})\b/i);
    if (m) return new Date(+m[1], 5, 15); // year-only → mid-year
    return null;
}

const fmt = (d) => d ? d.toISOString().slice(0, 10) : '—';

const feeds = [];
for (const file of readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(join(jsDir, file), 'utf8');
    const re = /milestone:\s*(['"])((?:\\.|(?!\1).)*)\1/g;
    const dates = [];
    let undated = 0, total = 0, match;
    while ((match = re.exec(src))) {
        total++;
        const d = parseDate(match[2]);
        if (d) dates.push(d); else undated++;
    }
    if (total === 0) continue;
    const newest = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    feeds.push({ file, total, dated: dates.length, undated, newest });
}

// Stalest first; undated-only feeds last.
feeds.sort((a, b) => (a.newest ? a.newest.getTime() : Infinity) - (b.newest ? b.newest.getTime() : Infinity));

let stale = 0, undatedOnly = 0;
console.log(`\nMilestone freshness — today ${fmt(now)}, threshold ${thresholdMonths} months (cutoff ${fmt(cutoff)})\n`);
console.log('  status   newest      dated/undated  feed');
console.log('  ' + '─'.repeat(58));
for (const f of feeds) {
    let status;
    if (!f.newest) { status = 'NO DATE'; undatedOnly++; }
    else if (f.newest < cutoff) { status = 'STALE'; stale++; }
    else { status = 'ok'; }
    const flag = status === 'STALE' ? '⚠ ' : status === 'NO DATE' ? '? ' : '  ';
    console.log(`  ${flag}${status.padEnd(7)} ${fmt(f.newest).padEnd(11)} ${String(f.dated).padStart(2)}/${String(f.undated).padEnd(2)}          js/${f.file}`);
}
console.log('');
if (stale) console.log(`⚠  ${stale} feed(s) stale (> ${thresholdMonths} months). Refresh their milestones — see MAINTENANCE.md.`);
if (undatedOnly) console.log(`?  ${undatedOnly} feed(s) have only undated milestones (can't assess freshness).`);
if (!stale && !undatedOnly) console.log('✓  All milestone feeds are fresh.');
console.log('');

process.exit(stale ? 1 : 0);
