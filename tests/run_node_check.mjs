// Syntax-check every file under js/ — real node --check on shipped sources.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));
const lines = [];
let fail = 0;
for (const f of files) {
    try {
        execSync(`node --check "${f}"`, { stdio: 'pipe' });
        lines.push('OK  ' + path.basename(f));
    } catch (e) {
        fail++;
        lines.push('ERR ' + path.basename(f) + '\n' + (e.stderr?.toString() || e.message));
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
