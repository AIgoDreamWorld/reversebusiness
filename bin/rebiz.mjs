#!/usr/bin/env node
// rebiz: reversebusiness 의 실행 파일. 의존성 없음, Node 18 이상.
//
//   rebiz                       에이전트를 찾아 스킬을 설치하고, 예시 해부 화면을 연다
//   rebiz <주소>                그 주소의 공개 페이지를 가볍게 읽어 해부 화면을 연다 (에이전트 없이)
//   rebiz demo                  예시 해부 화면만 연다
//   rebiz view <report.json>    리포트를 해부 화면으로 연다 (--mine <내 버전 폴더>)
//   rebiz check <report.json>   리포트 검사
//   rebiz draft <REA Evidence JSON ...>                       REA 근거에서 초안 만들기
//   rebiz clone-check <내 버전 폴더> --source <source.json>    내 버전이 원본과 겹치는지 검사
//   rebiz --remove              이 도구가 설치한 스킬만 지우기
//
// 설치가 하는 일은 폴더 복사 하나뿐이다. 에이전트의 설정 파일은 건드리지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTerm } from '../lib/term.mjs';
import { SKILL_NAME, planTargets, planInstall, applyInstall, planRemove, applyRemove, countFiles } from '../lib/agents.mjs';

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

const COMMANDS = new Set(['install', 'demo', 'view', 'check', 'help', 'version', 'remove', 'uninstall']);
function parse(argv) {
  const o = { cmd: '', agents: [], dirs: [], rest: [], dryRun: false, force: false, project: false, open: true, yes: false, lang: '', pages: 5, relation: 'third-party' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => String(argv[++i] ?? '');
    if (!o.cmd && COMMANDS.has(a)) o.cmd = a === 'uninstall' ? 'remove' : a;
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
    else if (a.startsWith('-')) { o.bad = a; }
    else o.rest.push(a);
  }
  // rebiz report.json 처럼 있는 파일을 주면 그 리포트를 연다.
  if (!o.cmd && o.rest.length && /\.json$/i.test(o.rest[0]) && fs.existsSync(o.rest[0])) o.cmd = 'view';
  if (!o.cmd && o.rest.length && looksLikeUrl(o.rest[0])) o.cmd = 'url';
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
  say(`  ${NPX}                 에이전트에 스킬 설치 + 예시 해부 화면 열기`);
  say(`  ${NPX} <주소>          그 주소를 바로 해부 (에이전트 없이, 공개 페이지 최대 5장)`);
  say();
  say('명령');
  say('  rebiz                         깔려 있는 에이전트를 찾아 설치 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity)');
  say('  rebiz <주소>                  robots.txt 확인 뒤 공개 페이지를 읽고 해부 화면 열기');
  say('  rebiz demo                    예시 해부 화면만 열기');
  say('  rebiz view <report.json>      리포트를 해부 화면으로 열기  (--mine <내 버전 폴더>, --out <파일>, --lang en)');
  say('  rebiz check <report.json>     리포트 검사');
  say('  rebiz draft <근거 JSON ...>   REA 근거에서 초안 만들기 (옵션은 draft --help)');
  say('  rebiz clone-check <폴더> --source <source.json>   내 버전이 원본과 겹치는지 검사');
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
async function install(o) {
  banner(o.dryRun ? 'dry-run: 아무것도 바꾸지 않습니다' : 'CONNECT AI LAB');
  say('사업 웹사이트 주소 하나를 넣으면 그 사업을 해부합니다.');
  say();
  const { targets, unknown, known } = planTargets({ agents: o.agents, dirs: o.dirs, project: o.project });
  if (unknown.length) { say(`모르는 에이전트: ${unknown.join(', ')}  (${known.join(', ')} 중에서)`); process.exitCode = 2; return; }
  let installed = 0;
  if (!targets.length) {
    say('이 컴퓨터에서 에이전트 폴더를 찾지 못했습니다 (Claude Code, Codex, Gemini CLI, Cursor, Antigravity).');
    say(`직접 고르기:  ${NPX} --agent claude   또는   --dir <스킬 폴더>`);
  } else {
    const plan = planInstall(targets, { force: o.force, version: PKG.version });
    const files = countFiles(SKILL_SRC) + countFiles(VIEWER_SRC);
    const w = Math.max(...plan.map((p) => T.width(p.label))) + 2;
    const w2 = Math.max(...plan.map((p) => T.width(tilde(p.dest)))) + 2;
    say(T.dim('찾은 에이전트와 바뀔 것'));
    for (const p of plan) {
      const label = p.action === 'update' ? `${ACTION_LABEL.update} (${p.from} → ${p.to})` : ACTION_LABEL[p.action];
      say(`  ${T.ivory(T.pad(p.label, w))}${T.pad(tilde(p.dest), w2)}${p.action === 'skip' || p.action === 'blocked' ? T.dim(label) : T.gold(label)}${p.why ? T.dim(`  ${p.why}`) : ''}`);
    }
    const todo = plan.filter((p) => !['skip', 'blocked'].includes(p.action));
    say(T.dim(`  위 폴더에 스킬 파일 ${files}개를 복사합니다. 에이전트의 설정 파일은 건드리지 않습니다.`));
    say();
    if (!todo.length) { say('새로 설치할 곳이 없습니다.'); }
    else if (o.dryRun) { say(`실제로 설치하려면 --dry-run 을 빼고 실행하세요:  ${NPX} --yes`); }
    else {
      let go = o.yes;
      if (!go && process.stdin.isTTY && process.stdout.isTTY) {
        const a = await ask(`${T.gold('?')} 설치할까요? [Y/n] `);
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
      }
    }
  }
  if (o.dryRun) return;
  say();
  await showDemo(o);
  say();
  if (installed) {
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
}

async function view(o) {
  const file = o.rest[0];
  if (!file) { say('사용: rebiz view <report.json> [--mine <내 버전 폴더>] [--out <파일>] [--no-open]'); process.exitCode = 2; return; }
  try { await showView(file, { mine: o.mine, out: o.out && path.resolve(o.out), lang: o.lang, open: o.open }); } catch (e) { say(`만들지 못했습니다: ${e.message}`); process.exitCode = 1; }
}

async function check(o) {
  const file = o.rest[0];
  if (!file) { say('사용: rebiz check <report.json>'); process.exitCode = 2; return; }
  const { checkReport } = await tool('check-report.mjs');
  let r;
  try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { say(`읽을 수 없습니다: ${e.message}`); process.exitCode = 2; return; }
  const { errors, warnings, counts } = checkReport(r);
  say(`관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}`);
  for (const w of warnings) say(`경고  ${w}`);
  for (const e of errors) say(`오류  ${e}`);
  say(errors.length ? `오류 ${errors.length}개. 고친 뒤 다시 검사해 주세요.` : `통과 (경고 ${warnings.length}개)`);
  if (errors.length) process.exitCode = 1;
}

// PATH 에 rea 가 있는지 이름만 본다. 실행하지 않는다.
function hasRea() {
  const names = process.platform === 'win32' ? ['rea.cmd', 'rea.exe', 'rea'] : ['rea'];
  return String(process.env.PATH || '').split(path.delimiter).filter(Boolean).some((d) => names.some((n) => { try { return fs.statSync(path.join(d, n)).isFile(); } catch { return false; } }));
}

async function dissectUrl(o) {
  const { collect, buildDraftFromPages, writeOutputs, outDirFor, Stop } = await tool('collect.mjs');
  const { checkReport } = await tool('check-report.mjs');
  const input = o.rest[0];
  if (!(o.pages >= 1) || !['own', 'third-party'].includes(o.relation)) { say('--pages 는 1에서 5, --relation 은 own 또는 third-party'); process.exitCode = 2; return; }
  banner('가벼운 수집기');
  say(`${T.dim('대상')}  ${input}`);
  say(T.dim('공개 페이지만 읽습니다: robots.txt 먼저, 최대 5장, 요청 사이 2초, 로그인과 폼 제출 없음, 쿠키 저장 없음.'));
  say();
  const started = Date.now();
  let c;
  try {
    c = await collect(input, { version: PKG.version, maxPages: o.pages, onStep: (s) => say(`  ${T.dim('·')} ${s}`) });
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
  const dir = path.resolve(o.out || outDirFor(input));
  writeOutputs(dir, c, built);
  const { counts } = checkReport(built.report);
  say();
  say(`${T.dim('읽은 것')}  페이지 ${c.pages.length}장 · 요청 ${c.log.length}번 · ${Math.round((Date.now() - started) / 1000)}초`);
  if (c.stop) say(`${T.dim('알림')}    ${c.stop.message}`);
  for (const s of c.skipped) say(`${T.dim('건너뜀')}  ${s.url}  ${T.dim(s.why)}`);
  say(`${T.dim('문장')}    관찰 ${counts.observed} · 추정 ${counts.inferred} · 모름 ${counts.unknown}`);
  if (built.thin) say(T.dim('  받은 HTML 에 글이 적습니다. 스크립트로 그리는 화면은 이 수집기가 보지 못합니다. 에이전트와 함께 채우면 더 정확합니다.'));
  say();
  await showView(path.join(dir, 'report.json'), { out: path.join(dir, 'report.html'), lang: o.lang, open: o.open });
  say(`${T.dim('저장')}    ${tilde(dir)}${path.sep}  report.json · report.html · source.json · requests.json`);
  say(T.dim('          source.json 은 겹침 검사에만 쓰고 어디에도 올리지 않습니다.'));
  say();
  say(T.bold('여기까지가 자동으로 확인된 것입니다. 해석은 에이전트와 함께 채웁니다'));
  const rel = path.relative(process.cwd(), path.join(dir, 'report.json'));
  say(`  ${T.hi(`"reversebusiness 로 ${rel && !rel.startsWith('..') ? rel : tilde(path.join(dir, 'report.json'))} 을 이어서 해부해 줘"`)}`);
  if (hasRea()) say(`  ${T.dim('REA 가 깔려 있습니다. 정밀 모드:')} "reversebusiness 로 ${input} 를 REA 로 읽어서 해부해 줘"`);
  else say(`  ${T.dim('스킬이 아직 없다면:')} ${NPX}`);
  promo();
}

// draft, clone-check 는 스킬 폴더의 도구에 인자를 그대로 넘긴다.
const PASS = { draft: 'from-rea.mjs', 'clone-check': 'check-clone.mjs', collect: 'collect.mjs' };
if (PASS[process.argv[2]]) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, PASS[process.argv[2]]), ...process.argv.slice(3)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const o = parse(process.argv.slice(2));
if (o.bad) { say(`모르는 인자: ${o.bad}`); say(); help(); process.exitCode = 2; }
else if (o.cmd === 'help') help();
else if (o.cmd === 'version') say(PKG.version);
else if (o.cmd === 'remove') remove(o);
else if (o.cmd === 'view') await view(o);
else if (o.cmd === 'check') await check(o);
else if (o.cmd === 'demo') { banner('예시 해부'); await showDemo(o); promo(); }
else if (o.cmd === 'url') await dissectUrl(o);
else await install(o);
