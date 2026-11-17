#!/usr/bin/env node
// rebiz: reversebusiness 의 실행 파일. 의존성 없음, Node 18 이상.
//
//   rebiz                       에이전트를 찾아 스킬을 설치하고(REA 가 없으면 REA 도 함께), 예시 해부 화면을 연다
//   rebiz <주소>                그 주소의 공개 페이지를 읽어 해부 화면을 연다 (에이전트 없이). REA 가 있으면 정밀 모드
//   rebiz demo                  예시 해부 화면만 연다
//   rebiz view <report.json>    리포트를 해부 화면으로 연다 (--mine <내 버전 폴더>)
//   rebiz check <report.json>   리포트 검사
//   rebiz draft <REA Evidence JSON ...>                       REA 근거에서 초안 만들기
//   rebiz clone-check <내 버전 폴더> --source <source.json>    내 버전이 원본과 겹치는지 검사
//   rebiz --remove              이 도구가 설치한 스킬만 지우기
//
// 우리 스킬 설치는 폴더 복사 하나뿐이고 에이전트의 설정 파일을 건드리지 않는다.
// REA(별개의 도구, 원본 morluto/rea, MIT)를 함께 설치할 때 에이전트 설정에 연결을 더하는 것은 REA 의 setup 이 한다. --no-rea 로 건너뛴다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTerm } from '../lib/term.mjs';
import { SKILL_NAME, planTargets, planInstall, applyInstall, planRemove, applyRemove, countFiles } from '../lib/agents.mjs';
import { REA_PACKAGE, REA_REPO, REA_NODE, REA_CLIENTS, reaState, reaInstaller, runRea, currentNode } from '../skill/reversebusiness/tools/rea-bridge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const SKILL_SRC = path.join(ROOT, 'skill', SKILL_NAME);
const VIEWER_SRC = path.join(ROOT, 'viewer');
const TOOLS = path.join(SKILL_SRC, 'tools');
const EXAMPLE = path.join(ROOT, 'examples', 'aicitybuilders-vibecoding');
const NPX = 'npx github:wonseokjung/reversebusiness';
const HOME = os.homedir();
const T = makeTerm(process.stdout);
const say = T.say;
const tilde = (p) => (p === HOME || p.startsWith(HOME + path.sep) ? `~${p.slice(HOME.length)}` : p);
const tool = (name) => import(pathToFileURL(path.join(TOOLS, name)).href);
const looksLikeUrl = (a) => /^https?:\/\//i.test(a) || /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(a) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(a);

// 명령 표. 일의 순서대로 묶는다: 읽기 -> 검사 -> 보기 -> 만들기와 적용 -> 설치.
// planned 가 붙은 이름은 다음 판에 들어올 자리다. 지금은 안내만 하고, 다른 뜻으로 쓰지 않도록 이름을 잡아 둔다.
const COMMAND_TABLE = [
  { name: 'dissect', group: 'read', usage: 'rebiz <주소>', text: 'robots.txt 확인 뒤 공개 페이지를 읽고 해부 화면 열기 (rebiz dissect <주소> 와 같음. --own, --light, --no-render)' },
  { name: 'draft', group: 'read', usage: 'rebiz draft <근거 JSON ...>', text: 'REA 근거와 정밀 모드 기록에서 초안 만들기 (옵션은 draft --help)', pass: 'from-rea.mjs' },
  { name: 'collect', group: 'read', hidden: true, pass: 'collect.mjs' },
  { name: 'check', group: 'check', usage: 'rebiz check <report.json>', text: '리포트 검사 (--dissect-only: 해부만 했을 때)' },
  { name: 'clone-check', group: 'check', usage: 'rebiz clone-check <폴더> --source <source.json>', text: '내 버전이 원본과 겹치는지 검사', pass: 'check-clone.mjs' },
  { name: 'view', group: 'see', usage: 'rebiz view <report.json>', text: '리포트를 해부 화면으로 열기 (--mine <내 버전 폴더>, --out <파일>, --lang en)' },
  { name: 'demo', group: 'see', usage: 'rebiz demo', text: '예시 해부 화면만 열기' },
  { name: 'video', group: 'see', usage: 'rebiz video', text: '해부 영상 뽑기', planned: '0.5.0', now: 'rebiz view report.json 으로 해부 화면을 열고 "영상으로 저장 (9:16)" 단추를 누르세요.' },
  { name: 'build', group: 'make', usage: 'rebiz build [--topic "내 사업 주제"]', text: '리포트의 내 버전 명세로 새 사이트 만들기', planned: '0.5.0', now: '에이전트에게 이렇게 말하세요: "reversebusiness 로 report.json 의 6번 칸 명세만 보고 내 버전을 새로 만들어 줘"' },
  { name: 'apply', group: 'make', usage: 'rebiz apply <내 프로젝트 폴더>', text: '배운 구조를 이미 있는 프로젝트에 적용 (새 git 브랜치에서, 바뀔 것을 먼저 보여 주고, 배포는 하지 않음)', planned: '0.5.0', now: '에이전트에게 이렇게 말하세요: "reversebusiness 로 report.json 의 구조를 <내 프로젝트 폴더> 에 적용해 줘. 새 브랜치에서 하고, 바뀔 것을 먼저 보여 줘"' },
  { name: 'install', group: 'setup', usage: 'rebiz', text: '깔려 있는 에이전트를 찾아 스킬 설치, REA 가 없으면 함께 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity)' },
  { name: 'remove', group: 'setup', usage: 'rebiz --remove', text: '이 도구가 설치한 스킬만 지우기 (REA 는 지우지 않음)', alias: ['uninstall'] },
  { name: 'help', group: 'setup', hidden: true },
  { name: 'version', group: 'setup', hidden: true },
];
const GROUPS = [['read', '읽기'], ['check', '검사'], ['see', '보기'], ['make', '만들기와 적용'], ['setup', '설치']];
const commandOf = (word) => COMMAND_TABLE.find((c) => c.name === word || (c.alias || []).includes(word)) || null;
function parse(argv) {
  const o = { cmd: '', agents: [], dirs: [], rest: [], dryRun: false, force: false, project: false, open: true, yes: false, lang: '', pages: 5, relation: 'third-party', render: 'auto', dissectOnly: false, noRea: false, light: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => String(argv[++i] ?? '');
    if (!o.cmd && commandOf(a)) o.cmd = commandOf(a).name;
    else if (a === '--remove') o.cmd = 'remove';
    else if (a === '--help' || a === '-h') o.cmd = 'help';
    else if (a === '--version' || a === '-v') o.cmd = 'version';
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--force') o.force = true;
    else if (a === '--project') o.project = true;
    else if (a === '--no-open') o.open = false;
    else if (a === '--agent') o.agents.push(...next().split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--dir') o.dirs.push(next());
    else if (a === '--out') o.out = next();
    else if (a === '--mine') o.mine = next();
    else if (a === '--lang') o.lang = next();
    else if (a === '--pages') o.pages = Number(next());
    else if (a === '--relation') o.relation = next();
    else if (a === '--own') o.relation = 'own';
    else if (a === '--no-render') o.render = 'off';
    else if (a === '--render') o.render = 'force';
    else if (a === '--dissect-only') o.dissectOnly = true;
    else if (a === '--no-rea') o.noRea = true;
    else if (a === '--light') o.light = true;
    else if (a.startsWith('-')) { o.bad = a; }
    else o.rest.push(a);
  }
  // rebiz report.json 처럼 있는 파일을 주면 그 리포트를 연다.
  if (!o.cmd && o.rest.length && /\.json$/i.test(o.rest[0]) && fs.existsSync(o.rest[0])) o.cmd = 'view';
  if (!o.cmd && o.rest.length && looksLikeUrl(o.rest[0])) o.cmd = 'dissect';
  if (!o.cmd && o.rest.length) o.bad = o.bad || o.rest[0];
  if (!o.cmd) o.cmd = 'install';
  return o;
}

function banner(extra = '') {
  say(`${T.gold('▍')}${T.bold('reversebusiness')} ${T.dim(PKG.version)}${extra ? `  ${T.dim(extra)}` : ''}`);
}
function promo() {
  say();
  T.rule();
  say(`${T.ivory('CONNECT AI LAB')} ${T.dim('·')} 모두를 위한 AI 교육`);
  say(`${T.dim('유튜브')}  https://www.youtube.com/@CONNECT-AI-LAB`);
  say(`${T.dim('강의')}    https://www.aicitybuilders.com`);
}

function help() {
  banner();
  say('사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다. 읽기, 해부(6칸), 내 버전 만들기, 검사.');
  say();
  say(`  ${NPX}                 에이전트에 스킬 설치(REA 가 없으면 함께) + 예시 해부 화면 열기`);
  say(`  ${NPX} <주소>          그 주소를 바로 해부 (에이전트 없이, 공개 페이지 최대 5장)`);
  say();
  for (const [key, title] of GROUPS) {
    const list = COMMAND_TABLE.filter((c) => c.group === key && !c.hidden);
    const later = list.length > 0 && list.every((c) => c.planned);
    say(`${title}${later ? T.dim(`  (다음 판 ${list[0].planned} 에 들어옵니다)`) : ''}`);
    const w = Math.max(...list.map((c) => T.width(c.usage))) + 3;
    for (const c of list) say(`  ${c.planned ? T.dim(T.pad(c.usage, w)) : T.pad(c.usage, w)}${T.dim(c.text)}${c.planned && !later ? T.dim(`  (${c.planned} 예정)`) : ''}`);
  }
  say();
  say('옵션');
  say('  --yes, -y        묻지 않고 설치');
  say('  --dry-run        무엇이 바뀌는지만 보여 주기');
  say('  --remove         이 도구가 설치한 스킬만 지우기');
  say('  --no-open        브라우저를 열지 않고 주소만 출력');
  say('  --agent <이름>   claude, codex, cursor, gemini, antigravity, agents (쉼표로 여러 개)');
  say('  --dir <폴더>     스킬 폴더를 직접 지정      --project   지금 폴더의 .claude/skills');
  say('  --force          같은 이름의 다른 폴더가 있으면 백업하고 설치');
  say('  --out <폴더>     <주소> 를 읽은 결과를 둘 곳    --pages <1~5>   읽을 페이지 수');
  say('  --own            <주소> 가 내 것일 때 (리포트에 내 것으로 적음)');
  say('  --no-render      글이 얇아도 브라우저로 그려 읽지 않기   --render   항상 그려 읽기');
  say('  --light          REA 가 있어도 가벼운 모드로 읽기 (펼치기와 코드 읽기 없음)');
  say('  --no-rea         설치할 때 REA 는 건너뛰기');
  say('  --dissect-only   check 에서 내 버전 칸이 비어 있어도 통과 (해부만 했을 때)');
  promo();
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.question(question, (a) => { answered = true; rl.close(); resolve(a.trim().toLowerCase()); });
    // 답 없이 입력이 닫히면 설치하지 않는 쪽으로 본다.
    rl.on('close', () => { if (!answered) { process.stdout.write('\n'); resolve('n'); } });
  });
}

// 해부 화면을 만들고 연다. 열 수 없으면 주소만 알려 준다.
async function showView(reportFile, { mine, out, lang, open }) {
  const { buildView, openFile } = await tool('build-view.mjs');
  const file = buildView(reportFile, out, { mine, lang });
  const url = pathToFileURL(file).href;
  say(`${T.gold('해부 화면')}  ${url}`);
  if (open) { openFile(file); say(T.dim('브라우저에서 열었습니다. 열리지 않으면 위 주소를 브라우저에 붙여 넣으세요.')); }
  return file;
}
async function showDemo(o) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebiz-'));
  const out = path.join(dir, 'reversebusiness-demo.html');
  return showView(path.join(EXAMPLE, 'report.json'), { mine: path.join(EXAMPLE, 'my-version'), out, lang: o.lang, open: o.open });
}

const ACTION_LABEL = { install: '새로 설치', update: '갱신', replace: '백업 후 설치', skip: '건너뜀', blocked: '건드리지 않음' };
// REA 가 낸 JSON 을 읽는다 (앞뒤에 다른 글이 섞여도 첫 중괄호부터 읽는다).
function parseJson(text) {
  const i = String(text).indexOf('{');
  if (i < 0) return null;
  try { return JSON.parse(String(text).slice(i)); } catch { return null; }
}
const REA_HOW = `npx -y ${REA_PACKAGE}@latest setup`;
// REA 를 함께 설치할지 정한다. 여기서는 아무것도 내려받지 않고 아무것도 바꾸지 않는다 (확인을 받은 뒤에만 REA 를 부른다).
async function planRea(o, targets) {
  if (o.noRea) return { state: 'skip', line: 'REA 는 설치하지 않습니다 (--no-rea). 가벼운 모드로 동작합니다.' };
  const st = await reaState();
  if (st.state === 'present') return { state: 'present', line: st.runner ? `REA 있음${st.version ? ` (${st.version})` : ''}. 건드리지 않습니다. 주소를 넣으면 정밀 모드로 읽습니다.` : `REA 있음 (스킬 확인). 건드리지 않습니다. 다만 지금 Node(${currentNode()})로는 REA 를 부를 수 없어 주소 해부는 가벼운 모드로 동작합니다. REA 는 ${REA_NODE}이 필요합니다.` };
  if (st.state === 'node-too-old') return { state: 'node-too-old', line: `REA 는 건너뜁니다. REA 는 ${REA_NODE}이 필요한데 지금 Node 는 ${currentNode()} 입니다. Node 를 올린 뒤 ${REA_HOW} 을 실행하면 정밀 모드가 켜집니다. 그때까지는 가벼운 모드로 동작합니다.` };
  const clients = [...new Set(targets.flatMap((t) => t.keys || []).map((k) => REA_CLIENTS[k]).filter(Boolean))];
  if (!clients.length) return { state: 'no-client', line: `REA 는 건너뜁니다. REA 를 연결할 에이전트를 고르지 않았습니다. 나중에: ${REA_HOW}` };
  return { state: 'install', installer: reaInstaller(), args: ['setup', ...clients.flatMap((c) => ['--client', c])], clients };
}
const REA_ACT = { configure_client: 'REA 연결 추가', install_skill: 'REA 스킬 설치' };
function showReaPlan(rp) {
  say(T.dim(`REA (원본 ${REA_REPO.replace('https://', '')}, MIT, 별개의 도구)`));
  if (rp.state !== 'install') { say(`  ${rp.state === 'present' ? T.ivory(rp.line) : T.dim(rp.line)}`); return; }
  say(`  ${T.ivory('REA(원본, MIT, morluto/rea)도 설치합니다. 에이전트 설정에 REA 연결을 추가합니다.')}`);
  say(`  ${T.pad('연결할 에이전트', 18)}${rp.clients.join(', ')}  ${T.gold('REA 연결 추가, REA 스킬 설치')}`);
  say(T.dim(`  확인하면 npm 의 공식 패키지 ${REA_PACKAGE} 를 내려받아 REA 의 setup 을 실행합니다. 확인 전에는 내려받지 않습니다.`));
  say(T.dim(`  설정 파일을 바꾸는 것은 REA 의 setup 이며, 바꾸기 전에 REA 가 백업을 남깁니다. 미리 자세히 보려면: ${REA_HOW} --dry-run`));
  say(T.dim('  건너뛰려면 --no-rea'));
}
// 확인을 받은 뒤에만 부른다: REA 가 스스로 낸 계획(dry-run)을 먼저 받아 보여 주고, 이어서 설치한다.
async function applyRea(rp) {
  say(T.dim(`REA 의 설치 계획을 받아 오는 중입니다 (npm 의 공식 패키지 ${REA_PACKAGE})`));
  const p = await runRea(rp.installer, [...rp.args, '--dry-run', '--json'], { timeoutMs: 180000 });
  const pj = p.code === 0 ? parseJson(p.stdout) : null;
  if (!pj || pj.status !== 'planned' || !Array.isArray(pj.plannedActions)) { say(`  ${T.gold('REA 는 건너뜁니다')}  REA 의 설치 계획을 받지 못했습니다${p.timedOut ? ' (시간 초과)' : ''}. 우리 스킬은 그대로 쓸 수 있고 가벼운 모드로 동작합니다. 나중에: ${REA_HOW}`); return false; }
  if (pj.plannedActions.length) {
    const w = Math.max(...pj.plannedActions.map((a) => T.width(String(a.label || a.kind)))) + 2;
    for (const a of pj.plannedActions) say(`  ${T.pad(String(a.label || a.kind), w)}${tilde(String(a.target || ''))}  ${T.gold(REA_ACT[a.kind] || String(a.kind))}`);
  }
  say(T.dim(`REA 를 설치하는 중입니다 (${REA_PACKAGE} setup)`));
  const r = await runRea(rp.installer, [...rp.args, '--yes', '--json'], { timeoutMs: 600000 });
  const j = parseJson(r.stdout);
  if (r.code !== 0 || !j) { say(`  ${T.gold('REA 설치 실패')}  ${r.timedOut ? '시간 초과' : 'REA setup 이 끝나지 않았습니다'}. 우리 스킬은 그대로 쓸 수 있고 가벼운 모드로 동작합니다. 나중에: ${REA_HOW}`); return false; }
  // REA 는 한 일을 "configured_<에이전트>", "installed_skill" 같은 이름으로 돌려준다 (옛 모양인 { kind } 도 읽는다).
  const applied = (Array.isArray(j.appliedActions) ? j.appliedActions : []).map((a) => (typeof a === 'string' ? a : String((a && (a.kind || a.id)) || '')));
  const nc = applied.filter((a) => /^configure/.test(a)).length;
  const ns = applied.some((a) => /^install(ed)?_skill/.test(a));
  say(`  ${T.gold('REA 설치')}  에이전트 연결 ${nc}곳${ns ? ', REA 스킬 설치' : ''}${j.status ? T.dim(`  (${j.status})`) : ''}`);
  return true;
}

async function install(o) {
  banner(o.dryRun ? 'dry-run: 아무것도 바꾸지 않습니다' : 'CONNECT AI LAB');
  say('사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다.');
  say();
  const { targets, unknown, known } = planTargets({ agents: o.agents, dirs: o.dirs, project: o.project });
  if (unknown.length) { say(`모르는 에이전트: ${unknown.join(', ')}  (${known.join(', ')} 중에서)`); process.exitCode = 2; return; }
  let installed = 0;
  let reaInstalled = false;
  if (!targets.length) {
    say('이 컴퓨터에서 에이전트 폴더를 찾지 못했습니다 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity).');
    say(`직접 고르기:  ${NPX} --agent claude   또는   --dir <스킬 폴더>`);
  } else {
    const plan = planInstall(targets, { force: o.force, version: PKG.version });
    const rp = await planRea(o, targets);
    const files = countFiles(SKILL_SRC) + countFiles(VIEWER_SRC);
    const w = Math.max(...plan.map((p) => T.width(p.label))) + 2;
    const w2 = Math.max(...plan.map((p) => T.width(tilde(p.dest)))) + 2;
    say(T.dim('찾은 에이전트와 바뀔 것'));
    for (const p of plan) {
      const label = p.action === 'update' ? `${ACTION_LABEL.update} (${p.from} → ${p.to})` : ACTION_LABEL[p.action];
      say(`  ${T.ivory(T.pad(p.label, w))}${T.pad(tilde(p.dest), w2)}${p.action === 'skip' || p.action === 'blocked' ? T.dim(label) : T.gold(label)}${p.why ? T.dim(`  ${p.why}`) : ''}`);
    }
    const todo = plan.filter((p) => !['skip', 'blocked'].includes(p.action));
    say(T.dim(`  위 폴더에 reversebusiness 스킬 파일 ${files}개를 복사합니다. 이 복사는 에이전트의 설정 파일을 건드리지 않습니다.`));
    say();
    showReaPlan(rp);
    say();
    const withRea = rp.state === 'install';
    if (!todo.length && !withRea) { say('새로 설치할 곳이 없습니다.'); }
    else if (o.dryRun) { say(`실제로 설치하려면 --dry-run 을 빼고 실행하세요:  ${NPX} --yes`); }
    else {
      let go = o.yes;
      if (!go && process.stdin.isTTY && process.stdout.isTTY) {
        const a = await ask(`${T.gold('?')} ${withRea ? 'reversebusiness 와 REA 를 설치할까요?' : '설치할까요?'} [Y/n] `);
        go = a === '' || a === 'y' || a === 'yes' || a === 'ㅛ' || a === '예' || a === '네';
        if (!go) say('설치하지 않았습니다.');
      } else if (!go) {
        say(`확인이 필요합니다. 설치하려면 --yes 를 붙여 다시 실행하세요:  ${NPX} --yes`);
      }
      if (go) {
        const done = applyInstall(plan, { skillSrc: SKILL_SRC, viewerSrc: VIEWER_SRC, version: PKG.version, pkgName: PKG.name });
        for (const d of done) {
          if (d.backup) say(`  ${T.dim('백업')}  ${tilde(d.backup)}`);
          if (d.files) { say(`  ${T.gold('설치')}  ${T.pad(d.label, w)}${tilde(d.dest)}  ${T.dim(`파일 ${d.files}개`)}`); installed += 1; }
        }
        if (withRea) reaInstalled = await applyRea(rp);
      }
    }
  }
  if (o.dryRun) return;
  say();
  await showDemo(o);
  say();
  if (installed || reaInstalled) {
    say(`${T.bold('이제 에이전트를 새로 시작하고 이렇게 말하세요')}`);
    say(`  ${T.hi('"reversebusiness 로 <궁금한 사업의 주소> 를 해부해 줘"')}`);
  } else {
    say(`${T.bold('에이전트 없이 바로 해부하기')}`);
  }
  say(`  ${T.dim('터미널에서 바로:')}  ${NPX} <주소>`);
  say(`  ${T.dim('지우기:')}          ${NPX} --remove`);
  say(T.dim('지켜야 할 선: 로그인, 결제, 접근 제한을 넘지 않고, 코드, 문구, 이미지, 브랜드를 가져오지 않습니다.'));
  promo();
}

function remove(o) {
  banner(o.dryRun ? '지우기 dry-run' : '지우기');
  say();
  const plan = planRemove({ agents: o.agents, dirs: o.dirs, project: o.project });
  if (!plan.length) { say('지울 것이 없습니다.'); return; }
  for (const p of plan) {
    if (p.action === 'keep') say(`  ${T.dim('남겨 둠')}  ${tilde(p.dest)}  ${T.dim('이 도구가 설치한 폴더가 아닙니다')}`);
    else say(`  ${T.gold(o.dryRun ? '지울 예정' : '지움')}  ${tilde(p.dest)}`);
  }
  if (!o.dryRun) applyRemove(plan);
  say();
  say(T.dim('백업 폴더(reversebusiness.backup-...)가 있다면 그대로 남아 있습니다.'));
  say(T.dim(`REA 는 지우지 않았습니다 (별개의 도구). REA 까지 지우려면: npx -y ${REA_PACKAGE}@latest uninstall`));
}

async function view(o) {
  const file = o.rest[0];
  if (!file) { say('사용: rebiz view <report.json> [--mine <내 버전 폴더>] [--out <파일>] [--no-open]'); process.exitCode = 2; return; }
  try { await showView(file, { mine: o.mine, out: o.out && path.resolve(o.out), lang: o.lang, open: o.open }); } catch (e) { say(`만들지 못했습니다: ${e.message}`); process.exitCode = 1; }
}

async function check(o) {
  const file = o.rest[0];
  if (!file) { say('사용: rebiz check <report.json> [--dissect-only]'); process.exitCode = 2; return; }
  const { checkReport } = await tool('check-report.mjs');
  let r;
  try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { say(`읽을 수 없습니다: ${e.message}`); process.exitCode = 2; return; }
  const { errors, warnings, counts, myVersion } = checkReport(r, { dissectOnly: o.dissectOnly });
  say(`관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}`);
  if (o.dissectOnly) say(`내 버전 칸  ${myVersion === 'empty' ? '아직 안 씀 (해부만 검사)' : '쓰여 있어서 함께 검사'}`);
  for (const w of warnings) say(`경고  ${w}`);
  for (const e of errors) say(`오류  ${e}`);
  say(errors.length ? `오류 ${errors.length}개. 고친 뒤 다시 검사해 주세요.` : `통과 (경고 ${warnings.length}개)${o.dissectOnly && myVersion === 'empty' ? ' · 해부만' : ''}`);
  if (errors.length) process.exitCode = 1;
}

async function dissectUrl(o) {
  const { collect, buildDraftFromPages, writeOutputs, outDirFor, Stop } = await tool('collect.mjs');
  const { checkReport } = await tool('check-report.mjs');
  const input = o.rest[0];
  if (!(o.pages >= 1) || !['own', 'third-party'].includes(o.relation)) { say('--pages 는 1에서 5, --relation 은 own 또는 third-party'); process.exitCode = 2; return; }
  banner('주소 해부');
  say(`${T.dim('대상')}  ${input}`);
  say(T.dim('공개 페이지만 읽습니다: robots.txt 먼저, 최대 5장, 요청 사이 2초, 로그인과 폼 제출 없음, 쿠키 저장 없음.'));
  if (o.relation === 'own') say(T.dim('내 것으로 적습니다 (--own). 읽는 방식과 한도는 같습니다.'));
  say();
  const started = Date.now();
  let dir;
  try { dir = path.resolve(o.out || outDirFor(input)); } catch (e) { say(`${T.gold('멈춤')}  ${e.message}`); process.exitCode = 3; return; }
  let c;
  try {
    c = await collect(input, { version: PKG.version, maxPages: o.pages, render: o.render, mode: o.light ? 'light' : 'auto', relation: o.relation, evidenceDir: path.join(dir, 'evidence'), onStep: (s) => say(`  ${T.dim('·')} ${s}`) });
  } catch (e) {
    say(`${T.gold('멈춤')}  ${e.message}`);
    process.exitCode = e instanceof Stop ? 3 : 1;
    return;
  }
  if (!c.pages.length) {
    say();
    say(`${T.gold('멈춤')}  ${c.stop ? c.stop.message : '읽은 페이지가 없습니다.'}`);
    say(T.dim('막힌 곳은 넘지 않습니다. 직접 본 화면을 메모해 에이전트에게 넘기는 방법이 스킬 문서에 있습니다.'));
    process.exitCode = 3;
    return;
  }
  const built = buildDraftFromPages(c, { relation: o.relation, version: PKG.version });
  writeOutputs(dir, c, built);
  const { counts } = checkReport(built.report);
  say();
  say(`${T.dim('읽은 것')}  페이지 ${c.pages.length}장 · 요청 ${c.log.length}번 · ${Math.round((Date.now() - started) / 1000)}초`);
  if (c.stop) say(`${T.dim('알림')}    ${c.stop.message}`);
  for (const s of c.skipped) say(`${T.dim('건너뜀')}  ${s.url}  ${T.dim(s.why)}`);
  say(`${T.dim('문장')}    관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}${counts.code ? ` · 코드 흔적 ${counts.code}` : ''}`);
  const DEPTH = { surface: '겉 읽기', flow: '흐름 읽기', code: '속 읽기' };
  const STATE = { done: '읽음', partial: '일부만', skipped: '안 함', blocked: '약관이 막음', failed: '실패' };
  say(`${T.dim('깊이')}    ${c.deep.mode === 'precise' ? '정밀 모드 (REA)' : '가벼운 모드'}`);
  for (const st of built.report.meta.depth.steps) say(`          ${T.pad(DEPTH[st.key], 10)}${st.state === 'done' || st.state === 'partial' ? T.gold(T.pad(STATE[st.state], 12)) : T.dim(T.pad(STATE[st.state], 12))}${T.dim(st.note || '')}`);
  if (c.render.mode === 'used') say(`${T.dim('그려 읽기')} ${c.render.browser} 임시 프로필로 ${c.render.pages}장. 브라우저를 끄고 프로필을 지웠습니다${c.render.blocked ? `. 브라우저 안에서 보내지 않은 요청 ${c.render.blocked}개` : ''}.`);
  else if (c.render.mode === 'failed') say(`${T.dim('그려 읽기')} 실패: ${c.render.error || ''} 받은 HTML 만 읽었습니다.`);
  if (built.thin) {
    say();
    say(`${T.gold('얇은 결과')}  ${built.read.note}`);
    say(`${T.dim('다음')}       ${built.read.next}`);
  }
  say();
  await showView(path.join(dir, 'report.json'), { out: path.join(dir, 'report.html'), lang: o.lang, open: o.open });
  say(`${T.dim('저장')}    ${tilde(dir)}${path.sep}  report.json · report.html · source.json · requests.json${c.deep.mode === 'precise' ? ' · evidence/' : ''}`);
  say(T.dim('          source.json 과 evidence 폴더는 내 컴퓨터에만 두고 어디에도 올리지 않습니다.'));
  say();
  say(T.bold('여기까지가 자동으로 확인된 것입니다. 해석은 에이전트와 함께 채웁니다'));
  const rel = path.relative(process.cwd(), path.join(dir, 'report.json'));
  say(`  ${T.hi(`"reversebusiness 로 ${rel && !rel.startsWith('..') ? rel : tilde(path.join(dir, 'report.json'))} 을 이어서 해부해 줘"`)}`);
  if (c.deep.mode !== 'precise' && !o.light) say(`  ${T.dim('더 깊게(흐름과 속까지) 읽으려면 REA 가 필요합니다. 한 줄로 같이 설치:')} ${NPX}`);
  else say(`  ${T.dim('스킬이 아직 없다면:')} ${NPX}`);
  promo();
}

// 다음 판에 들어올 명령: 지금은 무엇이 될지와 그때까지 쓸 방법을 알려 준다.
function planned(c) {
  banner();
  say(`${T.bold(c.usage)} 는 다음 판(${c.planned})에 들어옵니다: ${c.text}.`);
  say(`${T.dim('지금은')}  ${c.now}`);
  process.exitCode = 2;
}

// 스킬 폴더의 도구에 인자를 그대로 넘기는 명령 (draft, clone-check, collect)
const first = commandOf(process.argv[2]);
if (first && first.pass) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, first.pass), ...process.argv.slice(3)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
if (first && first.planned) planned(first);
else {
  const o = parse(process.argv.slice(2));
  const run = { help, version: () => say(PKG.version), remove: () => remove(o), view: () => view(o), check: () => check(o), demo: async () => { banner('예시 해부'); await showDemo(o); promo(); }, dissect: () => dissectUrl(o), install: () => install(o) };
  if (o.bad) { say(`모르는 인자: ${o.bad}`); say(); help(); process.exitCode = 2; }
  else if (o.cmd === 'dissect' && !o.rest.length) { say('사용: rebiz <주소>   (예: rebiz https://example.com --own)'); process.exitCode = 2; }
  else await run[o.cmd]();
}
