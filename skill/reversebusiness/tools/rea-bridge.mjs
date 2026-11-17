// 선택적 로컬 REA 연동 다리. REA 는 별개의 도구다 (원본 https://github.com/morluto/rea, MIT License).
// 이 키트는 REA 를 내려받거나 설치하지 않으며 REA 의 코드도 포함하지 않는다.
// 이미 컴퓨터에 rea 실행 파일이 깔려 있는 경우에만 자동으로 연동해 정밀 모드로 읽는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const REA_PACKAGE = 'rea-agents';
export const REA_REPO = 'https://github.com/morluto/rea';
export const REA_SKILL = 'reverse-engineer-anything';
export const REA_NODE = 'Node 22.19 이상(22.x), 24.11 이상(24.x), 26 이상';
export const REA_CLIENTS = { claude: 'claude_code', codex: 'codex', cursor: 'cursor', gemini: 'gemini_cli', antigravity: 'antigravity' };

// REA 가 받는 Node 판인지: ^22.19 || ^24.11 || >=26 (홀수 판과 시험판은 받지 않는다)
export const currentNode = (env = process.env) => env.REBIZ_NODE || process.version;
export function nodeOk(version = currentNode()) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(String(version).trim());
  if (!m || m[4]) return false;
  const major = Number(m[1]), minor = Number(m[2]);
  return (major === 22 && minor >= 19) || (major === 24 && minor >= 11) || (major >= 26 && major % 2 === 0);
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const subdirs = (dir) => { try { return fs.readdirSync(dir).map((d) => path.join(dir, d)).sort().reverse(); } catch { return []; } };
const isWinBatch = (p, platform = process.platform) => platform === 'win32' && /\.(cmd|bat)$/i.test(String(p));

function versionOf(bin, platform = process.platform) {
  try {
    const r = isWinBatch(bin, platform)
      ? spawnSync('cmd.exe', ['/d', '/c', bin, '--version'], { encoding: 'utf8', timeout: 5000 })
      : spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 ? r.stdout.trim() : '';
  } catch { return ''; }
}

// 이미 깔려 있는 rea 실행 파일을 찾는다.
export function findRea({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  if (env.REBIZ_REA === 'none') return null;
  const names = platform === 'win32' ? ['rea.cmd', 'rea.exe'] : ['rea'];
  const dirs = [];
  if (env.REBIZ_REA) dirs.push(path.dirname(env.REBIZ_REA));
  dirs.push(...String(env.PATH || '').split(path.delimiter).filter(Boolean));
  if (!env.REBIZ_REA) {
    dirs.push(path.join(home, '.local', 'bin'), '/usr/local/bin', '/opt/homebrew/bin', path.join(home, '.npm-global', 'bin'), path.join(home, '.bun', 'bin'), path.join(home, '.volta', 'bin'));
    for (const base of [path.join(home, '.local', 'opt'), path.join(home, '.nvm', 'versions', 'node'), path.join(home, '.asdf', 'installs', 'nodejs'), '/usr/local/lib/nodejs']) for (const d of subdirs(base)) dirs.push(path.join(d, 'bin'));
    for (const base of [path.join(home, '.fnm', 'node-versions'), path.join(home, 'Library', 'Application Support', 'fnm', 'node-versions'), path.join(home, '.local', 'share', 'fnm', 'node-versions')]) for (const d of subdirs(base)) dirs.push(path.join(d, 'installation', 'bin'));
    if (platform === 'win32') {
      if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'));
      if (env.LOCALAPPDATA) dirs.push(path.join(env.LOCALAPPDATA, 'Programs', 'nodejs'));
    }
  }
  const seen = new Set();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    for (const name of names) {
      const bin = path.join(dir, name);
      if (!isFile(bin)) continue;
      if (platform === 'win32') return nodeOk(currentNode(env)) ? { bin, node: '' } : null;
      const sibling = path.join(dir, 'node');
      if (isFile(sibling) && nodeOk(versionOf(sibling, platform))) return { bin, node: sibling };
      if (nodeOk(currentNode(env))) return { bin, node: process.execPath };
    }
  }
  return null;
}

export function reaSkillPresent({ env = process.env, home = os.homedir() } = {}) {
  const roots = [path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'skills'), path.join(home, '.agents', 'skills'), path.join(home, '.gemini', 'config', 'skills'), path.join(home, '.cursor', 'skills')];
  return roots.some((r) => isFile(path.join(r, REA_SKILL, 'SKILL.md')));
}

// 로컬에 이미 깔린 REA 만 사용한다 (자동 내려받기 없음).
export function reaRunner({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  if (env.REBIZ_REA_RUNNER) {
    try { const a = JSON.parse(env.REBIZ_REA_RUNNER); if (Array.isArray(a) && a.length) return { cmd: String(a[0]), pre: a.slice(1).map(String), how: 'test' }; } catch { /* 아래로 */ }
  }
  const found = findRea({ env, home, platform });
  if (!found) return null;
  return found.node
    ? { cmd: found.node, pre: [found.bin], how: 'installed', bin: found.bin }
    : isWinBatch(found.bin, platform)
      ? { cmd: 'cmd.exe', pre: ['/d', '/c', found.bin], how: 'installed', bin: found.bin }
      : { cmd: found.bin, pre: [], how: 'installed', bin: found.bin };
}

export function runRea(runner, args, { timeoutMs = 60000, cwd, env = process.env, maxBytes = 64_000_000 } = {}) {
  return new Promise((resolve) => {
    let out = Buffer.alloc(0), err = '', timedOut = false, done = false;
    let child;
    try { child = spawn(runner.cmd, [...runner.pre, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ code: -1, stdout: '', stderr: String(e && e.message), timedOut: false }); return; }
    const finish = (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout: out.toString('utf8'), stderr: err.slice(-2000), timedOut }); };
    const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } }, timeoutMs);
    child.stdout.on('data', (d) => { if (out.length < maxBytes) out = Buffer.concat([out, d]); });
    child.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    child.on('error', (e) => { err += String(e && e.message); finish(-1); });
    child.on('close', (code) => finish(code == null ? -1 : code));
  });
}

export async function reaVersion(runner) {
  const r = await runRea(runner, ['--version'], { timeoutMs: 20000 });
  const m = /\d+\.\d+\.\d+/.exec(r.stdout);
  return r.code === 0 && m ? m[0] : '';
}

export async function reaState({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  const runner = reaRunner({ env, home, platform });
  if (runner) return { state: 'present', runner, version: await reaVersion(runner) };
  return { state: 'absent', runner: null, version: '' };
}
