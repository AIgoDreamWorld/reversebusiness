// 그려진 화면 읽기: 이 컴퓨터의 Chrome 계열 브라우저를 임시 프로필로 잠깐 띄워, 스크립트가 그린 뒤의 화면을 읽는다.
// 의존성 없음. 브라우저와는 파이프(--remote-debugging-pipe)로만 말한다. 포트를 열지 않는다.
//
// 지키는 것:
//   - 임시 프로필만 쓴다. 평소 브라우저의 쿠키, 로그인, 확장 프로그램을 쓰지 않는다. 끝나면 브라우저를 끄고 임시 폴더를 지운다.
//   - 누르지 않고, 입력하지 않고, 내려받지 않는다. 화면 캡처를 찍지 않는다.
//   - 브라우저 안에서 나가는 요청도 거른다: GET 이 아닌 요청, robots.txt 가 막은 주소, 로그인과 결제 주소,
//     다른 사이트로 넘어가기, 분석과 광고 도구, 끼워 넣은 다른 페이지, 영상 파일은 보내지 않는다.
//   - 쿠키를 돌려보내지 않는다 (요청을 내보내기 직전마다 쿠키를 비우고, 페이지 스크립트의 쿠키 쓰기를 끈다).
//   - 저장소의 값을 읽지 않는다. 읽는 것은 그려진 화면의 글자, 구조, 구역의 위치와 크기뿐이다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const RENDER_LIMITS = { startMs: 12000, navMs: 15000, settleMs: 5000, idleMs: 700, growMs: 2500, maxRequests: 300, maxHeight: 12000, width: 1440, height: 900 };

const MAC = [
  ['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  ['Chromium', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  ['Brave', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
];
const LINUX = [['Google Chrome', 'google-chrome'], ['Google Chrome', 'google-chrome-stable'], ['Chromium', 'chromium'], ['Chromium', 'chromium-browser'], ['Microsoft Edge', 'microsoft-edge'], ['Brave', 'brave-browser']];
const WIN = [
  ['Google Chrome', 'Google\\Chrome\\Application\\chrome.exe'],
  ['Microsoft Edge', 'Microsoft\\Edge\\Application\\msedge.exe'],
  ['Brave', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'],
  ['Chromium', 'Chromium\\Application\\chrome.exe'],
];
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// 이 컴퓨터에서 쓸 수 있는 브라우저를 찾는다. REBIZ_BROWSER=none 이면 없는 것으로 본다.
export function findBrowser({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  const forced = env.REBIZ_BROWSER || env.CHROME_PATH || '';
  if (forced === 'none') return null;
  if (forced) return isFile(forced) ? { name: path.basename(forced), path: forced } : null;
  if (platform === 'darwin') {
    for (const [name, p] of MAC) for (const base of ['', home]) if (isFile(base + p)) return { name, path: base + p };
  } else if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    for (const [name, p] of WIN) for (const r of roots) if (isFile(path.join(r, p))) return { name, path: path.join(r, p) };
  } else {
    const dirs = String(env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const [name, bin] of LINUX) for (const d of dirs) if (isFile(path.join(d, bin))) return { name, path: path.join(d, bin) };
  }
  return null;
}

// 분석, 광고, 채팅 도구: 화면을 읽는 데 필요 없고, 방문 통계를 흐리지 않도록 부르지 않는다.
const TRACKERS = /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|googleadservices\.com|facebook\.net|connect\.facebook\.com|clarity\.ms|hotjar\.com|hotjar\.io|segment\.(io|com)|amplitude\.com|mixpanel\.com|sentry\.io|fullstory\.com|intercom\.io|intercomcdn\.com|channel\.io|criteo\.(com|net)|analytics\.tiktok\.com|analytics\.twitter\.com|ads-twitter\.com|px\.ads\.linkedin\.com|snap\.licdn\.com|wcs\.naver\.(net|com)|datadoghq\.com|newrelic\.com|nr-data\.net|posthog\.com|plausible\.io|braze\.com|airbridge\.io|appsflyer\.com)$/i;
export const isTracker = (hostname) => TRACKERS.test(String(hostname || ''));

// 그려진 화면에서 글자와 구조, 구역의 위치와 크기를 읽는 짧은 스크립트. 아무것도 누르지 않는다.
const EXTRACT = `(() => {
  const de = document.documentElement, body = document.body;
  const out = { html: '', blocks: [], docH: 0, docW: innerWidth, url: location.href };
  if (!de || !body) return out;
  const W = innerWidth;
  out.docH = Math.max(de.scrollHeight, body.scrollHeight);
  const rect = (el) => el.getBoundingClientRect();
  const vis = (el) => {
    if (!(el instanceof HTMLElement) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META)$/.test(el.tagName)) return false;
    const r = rect(el), cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (r.height < 20 || r.width < W * 0.3) return false;
    if (cs.position === 'fixed' || cs.position === 'sticky') return r.top + scrollY < 8 && r.height < 220;
    return true;
  };
  let list = [...body.children].filter(vis);
  for (let step = 0; step < 16 && list.length && list.length < 14; step++) {
    let big = null;
    for (const el of list) { const h = rect(el).height; if (!big || h > big.h) big = { el, h }; }
    const kids = [...big.el.children].filter(vis);
    if (list.length === 1) { if (!kids.length) break; list = kids; continue; }
    const sum = kids.reduce((a, k) => a + rect(k).height, 0);
    if (big.h / out.docH < 0.3 || kids.length < 2 || sum > big.h * 1.3 || sum < big.h * 0.5) break;
    list.splice(list.indexOf(big.el), 1, ...kids);
  }
  list.sort((a, b) => rect(a).top - rect(b).top);
  out.blocks = list.slice(0, 18).map((el, i) => { el.setAttribute('data-rebiz-b', String(i)); const r = rect(el); return { i, top: Math.round(r.top + scrollY), height: Math.round(r.height) }; });
  out.html = de.outerHTML.slice(0, 3000000);
  return out;
})()`;

function cdpPipe(child) {
  const toBrowser = child.stdio[3], fromBrowser = child.stdio[4];
  let seq = 0, buf = Buffer.alloc(0), closed = false;
  const pending = new Map();
  const handlers = new Set();
  fromBrowser.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (let i = buf.indexOf(0); i >= 0; i = buf.indexOf(0)) {
      const raw = buf.subarray(0, i).toString('utf8');
      buf = buf.subarray(i + 1);
      let m;
      try { m = JSON.parse(raw); } catch { continue; }
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.no(new Error(m.error.message)); else p.ok(m.result); } else for (const h of handlers) h(m);
    }
  });
  const fail = () => { closed = true; for (const p of pending.values()) p.no(new Error('browser closed')); pending.clear(); };
  fromBrowser.on('close', fail);
  toBrowser.on('error', fail);
  child.on('exit', fail);
  return {
    send(method, params = {}, sessionId) {
      if (closed) return Promise.reject(new Error('browser closed'));
      return new Promise((ok, no) => {
        const id = ++seq;
        pending.set(id, { ok, no });
        try { toBrowser.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`); } catch (e) { pending.delete(id); no(e); }
      });
    },
    on(fn) { handlers.add(fn); return () => handlers.delete(fn); },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(`${what} 시간 초과`)), ms))]);

// 브라우저를 띄운다. 돌려주는 render(url, { allow }) 로 한 장씩 읽고, 끝나면 close() 를 꼭 부른다.
export async function openRenderer({ browser = findBrowser(), version = '0', repo = '', limits = {} } = {}) {
  if (!browser) throw new Error('브라우저를 찾지 못했어요');
  const L = { ...RENDER_LIMITS, ...limits };
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rebiz-render-'));
  const child = spawn(browser.path, [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, `--window-size=${L.width},${L.height}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--disable-client-side-phishing-detection', '--metrics-recording-only', '--no-pings', '--mute-audio', '--hide-scrollbars',
    '--password-store=basic', '--use-mock-keychain', '--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  let exited = false;
  child.on('exit', () => { exited = true; });
  child.on('error', () => { exited = true; });
  const onExit = () => { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } };
  process.on('exit', onExit);
  const cdp = cdpPipe(child);

  async function close() {
    process.removeListener('exit', onExit);
    if (!exited) {
      try { await withTimeout(cdp.send('Browser.close'), 2000, '끄기'); } catch { /* 아래에서 끈다 */ }
      for (let i = 0; i < 20 && !exited; i += 1) await sleep(100);
      if (!exited) { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } for (let i = 0; i < 20 && !exited; i += 1) await sleep(100); }
    }
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); } catch { /* 임시 폴더는 운영체제가 지운다 */ }
    return { exited, profileRemoved: !fs.existsSync(profile) };
  }

  let ua;
  try {
    const v = await withTimeout(cdp.send('Browser.getVersion'), L.startMs, '브라우저 시작');
    // 누가 읽는지 숨기지 않는다: 헤드리스 브라우저라는 것과 이 도구의 이름을 함께 밝힌다.
    ua = `${v.userAgent} rebiz/${version}${repo ? ` (+${repo})` : ''}`;
    try { await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }); } catch { /* 옛 브라우저 */ }
  } catch (e) { await close(); throw e; }

  async function render(url, { allow = async () => ({ ok: true }) } = {}) {
    const stats = { allowed: 0, blocked: 0, why: {}, status: 0, mainBlocked: '', cookiesDropped: 0 };
    const note = (why) => { stats.blocked += 1; stats.why[why] = (stats.why[why] || 0) + 1; };
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (method, params) => cdp.send(method, params, sessionId);
    const inflight = new Set();
    let loaded = false, lastActivity = Date.now(), mainFrame = '', first = true;
    const off = cdp.on((m) => {
      if (m.sessionId !== sessionId) return;
      const p = m.params || {};
      if (m.method === 'Network.responseReceivedExtraInfo') {
        // 응답이 쿠키를 심으면 바로 지운다.
        if (Object.keys(p.headers || {}).some((k) => /^set-cookie$/i.test(k))) { stats.cookiesDropped += 1; S('Network.clearBrowserCookies').catch(() => {}); }
      } else if (m.method === 'Fetch.requestPaused') {
        lastActivity = Date.now();
        (async () => {
          const req = p.request || {};
          const isMain = p.resourceType === 'Document' && p.frameId === mainFrame;
          let verdict;
          if (!/^https?:/i.test(req.url)) verdict = { ok: true };
          else if (stats.allowed >= L.maxRequests) verdict = { ok: false, why: '요청 한도' };
          else if (req.method !== 'GET') verdict = { ok: false, why: 'GET 이 아닌 요청' };
          else if (p.resourceType === 'Document' && !isMain) verdict = { ok: false, why: '끼워 넣은 다른 페이지' };
          else if (['Ping', 'CSPViolationReport', 'Media', 'EventSource', 'WebSocket'].includes(p.resourceType)) verdict = { ok: false, why: p.resourceType === 'Media' ? '영상 파일' : '알림 신호' };
          else {
            try { verdict = await allow(req.url, { isMain, first: isMain && first, type: p.resourceType }); } catch { verdict = { ok: false, why: '확인 실패' }; }
          }
          if (isMain) first = false;
          try {
            if (verdict.ok) {
              stats.allowed += 1;
              if (p.networkId) inflight.add(p.networkId);
              // 받은 쿠키를 돌려보내지 않도록, 요청을 내보내기 직전에 쿠키를 비운다.
              try { await S('Network.clearBrowserCookies'); } catch { /* 그대로 보낸다 */ }
              await S('Fetch.continueRequest', { requestId: p.requestId });
            } else {
              note(verdict.why || '막음');
              if (isMain) stats.mainBlocked = verdict.why || '막음';
              await S('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
            }
          } catch { /* 탭이 이미 닫힘 */ }
        })();
      } else if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') { inflight.delete(p.requestId); lastActivity = Date.now(); } else if (m.method === 'Network.responseReceived') {
        if (p.type === 'Document' && p.frameId === mainFrame && p.response) stats.status = p.response.status;
      } else if (m.method === 'Page.loadEventFired') { loaded = true; lastActivity = Date.now(); } else if (m.method === 'Page.javascriptDialogOpening') { S('Page.handleJavaScriptDialog', { accept: false }).catch(() => {}); }
    });
    const idle = async (maxMs) => {
      const until = Date.now() + maxMs;
      while (Date.now() < until) { if (inflight.size === 0 && Date.now() - lastActivity >= L.idleMs) return true; await sleep(100); }
      return false;
    };
    try {
      await S('Page.enable');
      await S('Network.enable');
      await S('Emulation.setUserAgentOverride', { userAgent: ua });
      await S('Emulation.setDeviceMetricsOverride', { width: L.width, height: L.height, deviceScaleFactor: 1, mobile: false });
      mainFrame = (await S('Page.getFrameTree')).frameTree.frame.id;
      try { await S('Emulation.setDocumentCookieDisabled', { disabled: true }); } catch { /* 옛 브라우저 */ }
      await S('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const started = Date.now();
      S('Page.navigate', { url }).catch(() => {});
      while (!loaded && Date.now() - started < L.navMs && !stats.mainBlocked) await sleep(100);
      const timedOut = !loaded && !stats.mainBlocked;
      if (!stats.mainBlocked || !first) await idle(L.settleMs);
      // 아래쪽이 화면에 들어와야 그려지는 구역이 있으므로, 누르거나 굴리지 않고 창만 길게 늘인다.
      let page = { html: '', blocks: [], docH: 0, docW: L.width, url };
      try {
        const h = (await S('Runtime.evaluate', { expression: 'Math.max(document.documentElement ? document.documentElement.scrollHeight : 0, document.body ? document.body.scrollHeight : 0)', returnByValue: true })).result.value || 0;
        if (h > L.height) { await S('Emulation.setDeviceMetricsOverride', { width: L.width, height: Math.min(h, L.maxHeight), deviceScaleFactor: 1, mobile: false }); lastActivity = Date.now(); await idle(L.growMs); }
        const r = await withTimeout(S('Runtime.evaluate', { expression: EXTRACT, returnByValue: true }), 8000, '화면 읽기');
        if (r.result && r.result.value) page = r.result.value;
      } catch { /* 읽지 못하면 빈 결과를 돌려준다 */ }
      return { ...page, status: stats.status, stats, timedOut, userAgent: ua, ms: Date.now() - started };
    } finally {
      off();
      try { await withTimeout(cdp.send('Target.closeTarget', { targetId }), 2000, '탭 닫기'); } catch { /* 브라우저를 끌 때 같이 닫힌다 */ }
    }
  }

  return { render, close, browser, userAgent: ua, profile, pid: child.pid };
}
