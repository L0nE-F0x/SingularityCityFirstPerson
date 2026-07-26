// Syntax-check every file under js/ (recursive) — real node --check on shipped sources.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'js');

function listJs(dir) {
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...listJs(p));
        else if (ent.name.endsWith('.js')) out.push(p);
    }
    return out;
}

const files = listJs(jsDir);
const lines = [];
let fail = 0;
for (const f of files) {
    try {
        execSync(`node --check "${f}"`, { stdio: 'pipe' });
        lines.push('OK  ' + path.relative(jsDir, f).replace(/\\/g, '/'));
    } catch (e) {
        fail++;
        lines.push('ERR ' + path.relative(jsDir, f).replace(/\\/g, '/') + '\n' + (e.stderr?.toString() || e.message));
    }
}
lines.push(fail ? `FAILED ${fail}` : `ALL ${files.length} OK`);
const out = process.env.PARITY_SCRATCH
    ? path.join(process.env.PARITY_SCRATCH, 'node_check.log')
    : path.join(root, 'tests', 'node_check.log');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exit(fail ? 1 : 0);
