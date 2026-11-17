// 설치기 시험. 임시 HOME 에서만 돌린다. 내 실제 에이전트 폴더는 건드리지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'rebiz.mjs');
const EXAMPLE = path.join(ROOT, 'examples', 'aicitybuilders-vibecoding', 'report.json');

function home(...agents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebiz-home-'));
  for (const a of agents) fs.mkdirSync(path.join(dir, a), { recursive: true });
  return dir;
}
function run(dir, ...args) {
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, NO_COLOR: '1', TMPDIR: path.join(dir, 'tmp') };
  delete env.CLAUDE_CONFIG_DIR; delete env.CODEX_HOME;
  fs.mkdirSync(env.TMPDIR, { recursive: true });
  const r = spawnSync(process.execPath, [CLI, ...args], { env, cwd: dir, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const tree = (dir) => {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(path.relative(dir, p)); } };
  walk(dir);
  return out.sort();
};
const skillAt = (dir, ...p) => path.join(dir, ...p, 'reversebusiness');

test('dry-run 은 아무것도 바꾸지 않고 바뀔 것만 보여 준다', () => {
  const dir = home('.claude', '.codex', '.gemini/config');
  const before = tree(dir);
  const r = run(dir, '--dry-run');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Claude Code\s+~\/\.claude\/skills\/reversebusiness\s+새로 설치/);
  assert.match(r.out, /Codex\s+~\/\.agents\/skills\/reversebusiness\s+새로 설치/);
  assert.match(r.out, /Antigravity\s+~\/\.gemini\/config\/skills\/reversebusiness\s+새로 설치/);
  assert.match(r.out, /에이전트의 설정 파일은 건드리지 않습니다/);
  assert.deepEqual(tree(dir), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--yes 없이 사람 없는 터미널에서는 설치하지 않고, 예시 화면 주소는 알려 준다', () => {
  const dir = home('.claude');
  const r = run(dir, '--no-open');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /--yes 를 붙여 다시 실행하세요/);
  assert.ok(!fs.existsSync(skillAt(dir, '.claude', 'skills')));
  const url = (/해부 화면 {2}(file:\/\/\S+)/.exec(r.out) || [])[1];
  assert.ok(url, r.out);
  assert.ok(fs.existsSync(fileURLToPath(url)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--yes: 찾은 에이전트에 설치하고, 예시 해부 화면을 만들고, 다음에 할 말을 알려 준다', () => {
  const dir = home('.claude', '.codex', '.cursor', '.gemini/config');
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{"keep":"me"}\n');
  fs.writeFileSync(path.join(dir, '.codex', 'config.toml'), 'model = "x"\n');
  const r = run(dir, '--yes', '--no-open');
  assert.equal(r.status, 0, r.out);
  for (const p of [['.claude', 'skills'], ['.agents', 'skills'], ['.gemini', 'config', 'skills']]) {
    const d = skillAt(dir, ...p);
    for (const f of ['SKILL.md', '.rebiz.json', 'report.schema.json', 'tools/collect.mjs', 'tools/check-report.mjs', 'tools/build-view.mjs', 'viewer/index.html', 'viewer/stage.js']) assert.ok(fs.existsSync(path.join(d, f)), `${d}/${f}`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.rebiz.json'), 'utf8')).package, 'rebiz');
  }
  assert.match(r.out, /Codex, Cursor\s+~\/\.agents\/skills\/reversebusiness/, 'Codex 와 Cursor 는 공용 폴더 한 벌');
  assert.ok(!fs.existsSync(path.join(dir, '.cursor', 'skills')));
  // 설정 파일은 그대로
  assert.equal(fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8'), '{"keep":"me"}\n');
  assert.equal(fs.readFileSync(path.join(dir, '.codex', 'config.toml'), 'utf8'), 'model = "x"\n');
  const outside = tree(dir).filter((f) => !f.includes(`skills${path.sep}reversebusiness${path.sep}`) && !f.startsWith(`tmp${path.sep}`));
  assert.deepEqual(outside, ['.claude/settings.json', '.codex/config.toml'].map((f) => f.split('/').join(path.sep)), '스킬 폴더 밖에는 아무것도 만들지 않는다');
  assert.match(r.out, /이제 에이전트를 새로 시작하고 이렇게 말하세요/);
  assert.match(r.out, /"reversebusiness 로 <궁금한 사업의 주소> 를 해부해 줘"/);
  const url = (/해부 화면 {2}(file:\/\/\S+)/.exec(r.out) || [])[1];
  const html = fs.readFileSync(fileURLToPath(url), 'utf8');
  assert.ok(html.includes('"schema":"rebiz/report@1"') && html.includes('"mine":{"html"'), '예시 해부 화면에 리포트와 내 버전 미리보기가 들어 있다');
  assert.match(r.out, /CONNECT AI LAB · 모두를 위한 AI 교육/);
  // 설치된 스킬 폴더만으로 도구가 돈다
  const tools = path.join(skillAt(dir, '.claude', 'skills'), 'tools');
  const chk = spawnSync(process.execPath, [path.join(tools, 'check-report.mjs'), EXAMPLE], { encoding: 'utf8' });
  assert.equal(chk.status, 0, chk.stdout);
  assert.match(chk.stdout, /통과 \(경고 0개\)/, '설치된 폴더에서 바로 돌려도 실제로 검사한다');
  const out = path.join(dir, 'tmp', 'view.html');
  const view = spawnSync(process.execPath, [path.join(tools, 'build-view.mjs'), EXAMPLE, '--out', out], { encoding: 'utf8' });
  assert.equal(view.status, 0, view.stdout + view.stderr);
  assert.ok(fs.statSync(out).size > 50_000);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('다시 실행하면 갱신, 남의 폴더는 건너뛰고, --force 는 백업 뒤 설치', () => {
  const dir = home('.claude', '.codex');
  const theirs = skillAt(dir, '.agents', 'skills');
  fs.mkdirSync(theirs, { recursive: true });
  fs.writeFileSync(path.join(theirs, 'SKILL.md'), 'someone else\n');
  let r = run(dir, '--yes', '--no-open');
  assert.match(r.out, /건너뜀\s+같은 이름의 다른 폴더가 이미 있어요/);
  assert.equal(fs.readFileSync(path.join(theirs, 'SKILL.md'), 'utf8'), 'someone else\n');
  assert.ok(fs.existsSync(path.join(skillAt(dir, '.claude', 'skills'), '.rebiz.json')));
  r = run(dir, '--yes', '--no-open');
  assert.match(r.out, /Claude Code\s+~\/\.claude\/skills\/reversebusiness\s+갱신/);
  r = run(dir, '--yes', '--no-open', '--force');
  assert.match(r.out, /백업\s+~\/\.agents\/skills\/reversebusiness\.backup-\d{14}/);
  assert.ok(fs.existsSync(path.join(theirs, '.rebiz.json')));
  const backup = fs.readdirSync(path.join(dir, '.agents', 'skills')).find((f) => f.startsWith('reversebusiness.backup-'));
  assert.equal(fs.readFileSync(path.join(dir, '.agents', 'skills', backup, 'SKILL.md'), 'utf8'), 'someone else\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--remove 는 표식이 있는 폴더만 지운다', () => {
  const dir = home('.claude', '.gemini/config');
  run(dir, '--yes', '--no-open');
  const theirs = skillAt(dir, '.agents', 'skills');
  fs.mkdirSync(theirs, { recursive: true });
  fs.writeFileSync(path.join(theirs, 'SKILL.md'), 'not ours\n');
  const other = path.join(dir, '.claude', 'skills', 'another-skill');
  fs.mkdirSync(other, { recursive: true });
  let r = run(dir, '--remove', '--dry-run');
  assert.match(r.out, /지울 예정\s+~\/\.claude\/skills\/reversebusiness/);
  assert.ok(fs.existsSync(skillAt(dir, '.claude', 'skills')));
  r = run(dir, '--remove');
  assert.equal(r.status, 0, r.out);
  assert.ok(!fs.existsSync(skillAt(dir, '.claude', 'skills')));
  assert.ok(!fs.existsSync(skillAt(dir, '.gemini', 'config', 'skills')));
  assert.ok(fs.existsSync(theirs), '표식이 없는 폴더는 남는다');
  assert.match(r.out, /남겨 둠\s+~\/\.agents\/skills\/reversebusiness/);
  assert.ok(fs.existsSync(other));
  assert.match(run(dir, '--remove').out, /남겨 둠|지울 것이 없습니다/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--agent 로 고르기, 모르는 이름은 거절, 에이전트가 없으면 안내', () => {
  const dir = home();
  let r = run(dir, '--agent', 'cursor', '--yes', '--no-open');
  assert.equal(r.status, 0, r.out);
  assert.ok(fs.existsSync(path.join(skillAt(dir, '.agents', 'skills'), 'SKILL.md')));
  r = run(dir, '--agent', 'nobody', '--yes', '--no-open');
  assert.equal(r.status, 2);
  assert.match(r.out, /모르는 에이전트: nobody/);
  const empty = home();
  r = run(empty, '--yes', '--no-open');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /에이전트 폴더를 찾지 못했습니다/);
  assert.match(r.out, /해부 화면 {2}file:\/\//, '에이전트가 없어도 예시 화면은 보여 준다');
  assert.deepEqual(tree(empty).filter((f) => !f.startsWith('tmp')), []);
  r = run(empty, '--dir', path.join(empty, 'custom-skills'), '--yes', '--no-open');
  assert.ok(fs.existsSync(path.join(empty, 'custom-skills', 'reversebusiness', 'SKILL.md')));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(empty, { recursive: true, force: true });
});

test('심볼릭 링크로 된 스킬 폴더는 건드리지 않는다', { skip: process.platform === 'win32' }, () => {
  const dir = home('.claude/skills');
  const real = path.join(dir, 'elsewhere');
  fs.mkdirSync(real);
  fs.symlinkSync(real, skillAt(dir, '.claude', 'skills'));
  const r = run(dir, '--yes', '--no-open');
  assert.match(r.out, /건드리지 않음\s+심볼릭 링크라서/);
  assert.deepEqual(fs.readdirSync(real), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('도움말, 판 번호, 모르는 인자', () => {
  const dir = home();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'rebiz');
  assert.deepEqual(Object.keys(pkg.bin), ['rebiz']);
  assert.equal(pkg.private, true);
  assert.equal(run(dir, '--version').out.trim(), pkg.version);
  assert.match(run(dir, '--help').out, /npx github:wonseokjung\/reversebusiness <주소>/);
  const bad = run(dir, '--nope');
  assert.equal(bad.status, 2);
  assert.match(bad.out, /모르는 인자: --nope/);
  assert.ok(!/\x1b\[/.test(run(dir, '--help').out), '사람이 보는 터미널이 아니면 색을 쓰지 않는다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('표식이 내 것이 아니거나, 가는 길에 심볼릭 링크가 있으면 건드리지 않는다', { skip: process.platform === 'win32' }, () => {
  const dir = home('.claude/skills', '.codex');
  // 1. 다른 도구의 표식이 든 폴더: 지우지도 덮지도 않는다
  const fake = skillAt(dir, '.claude', 'skills');
  fs.mkdirSync(fake);
  fs.writeFileSync(path.join(fake, '.rebiz.json'), '{}');
  fs.writeFileSync(path.join(fake, 'keep.txt'), 'mine');
  let r = run(dir, '--remove');
  assert.match(r.out, /남겨 둠\s+~\/\.claude\/skills\/reversebusiness/);
  assert.equal(fs.readFileSync(path.join(fake, 'keep.txt'), 'utf8'), 'mine');
  r = run(dir, '--agent', 'claude', '--yes', '--no-open');
  assert.match(r.out, /건너뜀/);
  assert.equal(fs.readFileSync(path.join(fake, 'keep.txt'), 'utf8'), 'mine');
  // 2. ~/.agents 가 다른 곳을 가리키는 링크: 설치하지 않는다
  const elsewhere = path.join(dir, 'elsewhere');
  fs.mkdirSync(path.join(elsewhere, 'skills'), { recursive: true });
  fs.symlinkSync(elsewhere, path.join(dir, '.agents'));
  r = run(dir, '--agent', 'codex', '--yes', '--no-open');
  assert.match(r.out, /건드리지 않음\s+심볼릭 링크라서/);
  assert.deepEqual(fs.readdirSync(path.join(elsewhere, 'skills')), []);
  // 3. 표식 파일이 링크인 폴더: 내 것으로 보지 않는다
  const dir2 = home('.claude/skills');
  const d2 = skillAt(dir2, '.claude', 'skills');
  fs.mkdirSync(d2);
  fs.writeFileSync(path.join(dir2, 'real-marker.json'), '{"package":"rebiz","version":"0.0.1"}');
  fs.symlinkSync(path.join(dir2, 'real-marker.json'), path.join(d2, '.rebiz.json'));
  r = run(dir2, '--remove');
  assert.ok(fs.existsSync(d2));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
});
