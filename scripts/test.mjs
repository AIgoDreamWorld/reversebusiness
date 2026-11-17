import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.resolve('test');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join('test', f));
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
