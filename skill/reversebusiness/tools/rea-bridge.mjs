// REA 를 찾고 부르는 다리. REA 는 별개의 도구다 (원본 https://github.com/morluto/rea, MIT License).
// 우리는 REA 의 코드를 묶어 넣지 않는다. 이미 깔린 rea 실행 파일을 부르거나, 공식 npm 패키지 이름으로만 부른다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// 공식 npm 패키지 이름. 이 이름만 쓴다. 비슷한 이름의 패키지나 다른 주소에서 받지 않는다.
export const REA_PACKAGE = 'rea-agents';
export const REA_REPO = 'https://github.com/morluto/rea';
export const REA_SKILL = 'reverse-engineer-anything';
export const REA_NODE = 'Node 22.19 이상(22.x), 24.11 이상(24.x), 26 이상';
// 우리 에이전트 이름 -> REA 가 쓰는 이름
export const REA_CLIENTS = { claude: 'claude_code', codex: 'codex', cursor: 'cursor', gemini: 'gemini_cli', antigravity: 'antigravity' };

// REA 가 받는 Node 판인지: ^22.19 || ^24.11 || >=26 (홀수 판과 시험판은 받지 않는다)
export const currentNode = (env = process.env) => env.REBIZ_NODE || process.version; // 시험에서 Node 판을 바꿔 볼 때만 REBIZ_NODE 를 쓴다
export function nodeOk(version = currentNode()) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(String(version).trim());
  if (!m || m[4]) return false;
  const major = Number(m[1]), minor = Number(m[2]);
  return (major === 22 && minor >= 19) || (major === 24 && minor >= 11) || (major >= 26 && major % 2 === 0);
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const subdirs = (dir) => { try { return fs.readdirSync(dir).map((d) => path.join(dir, d)).sort().reverse(); } catch { return []; } };
const versionOf = (bin) => { try { const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000 }); return r.status === 0 ? r.stdout.trim() : ''; } catch { return ''; } };

// rea 실행 파일을 찾는다: PATH, 그리고 Node 를 흔히 두는 곳. 설정 파일은 열어 보지 않는다.
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
    if (platform === 'win32' && env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'));
  }
  const seen = new Set();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    for (const name of names) {
      const bin = path.join(dir, name);
      if (!isFile(bin)) continue;
      if (platform === 'win32') return { bin, node: '' };
      // rea 는 Node 로 도는 스크립트다. 같은 폴더의 node 가 REA 가 받는 판이면 그것으로, 아니면 지금 Node 로 돌린다.
      const sibling = path.join(dir, 'node');
      if (isFile(sibling) && nodeOk(versionOf(sibling))) return { bin, node: sibling };
      if (nodeOk(currentNode(env))) return { bin, node: process.execPath };
    }
  }
  return null;
}

// REA 스킬이 이미 놓여 있는지 (REA 를 npx 로 설치한 경우 실행 파일이 따로 없다).
export function reaSkillPresent({ env = process.env, home = os.homedir() } = {}) {
  const roots = [path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'skills'), path.join(home, '.agents', 'skills'), path.join(home, '.gemini', 'config', 'skills'), path.join(home, '.cursor', 'skills')];
  return roots.some((r) => isFile(path.join(r, REA_SKILL, 'SKILL.md')));
}

// REA 를 부르는 방법을 정한다. how: installed(깔린 실행 파일), npx(공식 패키지를 npx 로), test(시험용 대역)
export function reaRunner({ env = process.env, home = os.homedir(), platform = process.platform, allowNpx = true } = {}) {
  if (env.REBIZ_REA_RUNNER) {
    try { const a = JSON.parse(env.REBIZ_REA_RUNNER); if (Array.isArray(a) && a.length) return { cmd: String(a[0]), pre: a.slice(1).map(String), how: 'test' }; } catch { /* 아래로 */ }
  }
  const found = findRea({ env, home, platform });
  if (found) return found.node ? { cmd: found.node, pre: [found.bin], how: 'installed', bin: found.bin } : { cmd: 'cmd.exe', pre: ['/d', '/c', found.bin], how: 'installed', bin: found.bin };
  if (!allowNpx || env.REBIZ_REA === 'none' || !nodeOk(currentNode(env))) return null;
  const npx = path.join(path.dirname(process.execPath), platform === 'win32' ? 'npx.cmd' : 'npx');
  const pre = ['-y', `${REA_PACKAGE}@latest`];
  if (platform === 'win32') return { cmd: 'cmd.exe', pre: ['/d', '/c', isFile(npx) ? npx : 'npx.cmd', ...pre], how: 'npx' };
  return { cmd: isFile(npx) ? npx : 'npx', pre, how: 'npx' };
}

// REA 를 한 번 부른다. 시간 한도를 넘으면 끈다. 표준 출력은 한도까지만 모은다.
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

// 지금 REA 가 어떤 상태인지: present(있음) / absent(없지만 설치할 수 있음) / node-too-old(Node 가 낮아 설치할 수 없음)
export async function reaState({ env = process.env, home = os.homedir() } = {}) {
  const runner = reaRunner({ env, home, allowNpx: false });
  if (runner) return { state: 'present', runner, version: await reaVersion(runner) };
  if (reaSkillPresent({ env, home })) return { state: 'present', runner: reaRunner({ env, home }), version: '' };
  return { state: reaInstaller({ env }) ? 'absent' : 'node-too-old', runner: null, version: '' };
}

// 설치할 때 부르는 방법: 공식 패키지를 npx 로. (시험에서는 REBIZ_REA_INSTALLER 로 대역을 쓴다.)
export function reaInstaller({ env = process.env, platform = process.platform } = {}) {
  if (env.REBIZ_REA_INSTALLER) {
    try { const a = JSON.parse(env.REBIZ_REA_INSTALLER); if (Array.isArray(a) && a.length) return { cmd: String(a[0]), pre: a.slice(1).map(String), how: 'test' }; } catch { /* 아래로 */ }
  }
  if (!nodeOk(currentNode(env))) return null;
  const npx = path.join(path.dirname(process.execPath), platform === 'win32' ? 'npx.cmd' : 'npx');
  const pre = ['-y', `${REA_PACKAGE}@latest`];
  if (platform === 'win32') return { cmd: 'cmd.exe', pre: ['/d', '/c', isFile(npx) ? npx : 'npx.cmd', ...pre], how: 'npx' };
  return { cmd: isFile(npx) ? npx : 'npx', pre, how: 'npx' };
}
