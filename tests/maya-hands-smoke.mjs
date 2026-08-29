// MAYA hands smoke test. Boots the playground headless, seeds a fake board,
// then fires the battery of tool calls Maya herself makes on a live call,
// straight through _pgTool. Every call must come back with a shape (ok:true,
// or ok:false with a reason). A thrown exception, a hang, or a missing
// function is a bug: it means Maya freezes mid sentence on a real call.
//
//   node tests/maya-hands-smoke.mjs
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // fake API surface so the page never waits on a real server
  if (p.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (p === '/api/pinterest/boards') return res.end(JSON.stringify({ boards: [{ id: 'b1', name: 'Summer whites' }, { id: 'b2', name: 'Red carpet' }] }));
    if (p === '/api/pinterest/pins') return res.end(JSON.stringify({ pins: [] }));
    if (p === '/api/feature') return res.end(JSON.stringify({ ok: true }));
    if (p === '/api/feedback') return res.end(JSON.stringify({ ok: true }));
    if (p === '/api/usage') return res.end(JSON.stringify({ usd: 0, cap: 2 }));
    return res.end(JSON.stringify({ ok: true }));
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (existsSync(f) && !f.includes('..')) {
    res.setHeader('Content-Type', MIME[extname(f)] || 'application/octet-stream');
    res.end(readFileSync(f));
  } else { res.statusCode = 404; res.end('nf'); }
});
await new Promise(r => srv.listen(8898, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message || e).slice(0, 200)));
await page.goto('http://127.0.0.1:8898/playground/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

let failed = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '   ' + extra : ''));
  if (!cond) failed++;
};

console.log('\nMAYA hands smoke test\n');

// ── 1. every function her hands rest on must exist ──
const missing = await page.evaluate(() => {
  const need = ['_pgTool', '_pgRunCall', '_pgFindCard', '_pgBoardSnapshot', '_pgDrawerState',
    '_pgWhoAmI', '_pgAutoLog', '_fbRenderMayaLogs', 'toggleNotesDrawer', 'pgTab',
    'processConsultation', 'visualizeGarment', 'openFeedback', 'getApiKey', 'setScreen',
    '_favStep', 'pgMayaStart', 'pgMayaStop', '_pgWakeStart', '_pgWakeStop', '_pgWakePause', '_pgWakeResume',
    'startListening', 'stopListening', 'startVisualizeListen', 'stopVisualizeListen'];
  return need.filter(n => typeof window[n] !== 'function');
});
ok('every function Maya\'s hands rest on exists', missing.length === 0, missing.join(', '));

// ── 2. seed a fake board so card tools have something to grip ──
await page.evaluate(() => {
  window.getApiKey = () => 'smoke-token';
  const mk = (caption, kind, profile) => {
    const el = document.createElement('div');
    el.className = 'moodboard-item';
    const del = document.createElement('div'); del.className = 'delete-btn'; el.appendChild(del);
    const fav = document.createElement('div'); fav.className = 'fav-btn'; el.appendChild(fav);
    document.body.appendChild(el);
    const card = { caption, kind, title: caption.split(' ').slice(0, 3).join(' '), profile };
    // the page declares `items` with let/const (script scope, not on window)
    const arr = (0, eval)('typeof items !== "undefined" ? items : (window.items = window.items || [])');
    arr.push({ card, el });
    return card;
  };
  mk('white and red outfit, the girl carrying an apple', 'render',
    { bio: 'A crisp two tone look with a playful prop', aesthetic: 'Fresh minimalism', silhouette: 'A line', color: 'White and red', era: 'Now' });
  mk('black slip dress, bias cut', 'render',
    { bio: 'Liquid bias satin in deep black', aesthetic: 'Quiet luxury', silhouette: 'Bias slip', color: 'Black', era: 'Nineties' });
});

// ── 3. the battery: what Maya actually asks for on a call ──
const DC = '{ send: function(){} }';
const battery = [
  ['list_board', {}, o => o && o.board !== undefined],
  ['open_drawer', { tab: 'pinterest' }, o => o && o.ok === true],
  ['open_drawer', { tab: 'nonsense' }, o => o && o.ok === true],
  ['scroll_pins', { direction: 'down' }, o => o && typeof o.ok === 'boolean'],
  ['close_drawer', {}, o => o && o.ok === true],
  ['open_card', { query: 'the girl with the apple' }, o => o && o.ok === true],
  ['open_card', { query: 'purple spacesuit' }, o => o && o.ok === false && o.reason],
  ['open_card', {}, o => o && o.ok === false],
  ['favorite_card', { query: 'black slip' }, o => o && o.ok === true],
  ['delete_card', { query: 'black slip' }, o => o && typeof o.ok === 'boolean'],
  ['viewer', { action: 'close' }, o => o && typeof o.ok === 'boolean'],
  ['viewer', { action: 'next' }, o => o && typeof o.ok === 'boolean'],
  ['viewer', { action: 'launch_rocket' }, o => o && o.ok === false && Array.isArray(o.actions)],
  ['pin_view', { which: 'boards' }, o => o && typeof o.ok === 'boolean'],
  ['open_board', { name: 'summer' }, o => o && typeof o.ok === 'boolean'],
  ['open_board', { name: 'no such board' }, o => o && o.ok === false],
  ['bring_in_pins', { query: 'red dress' }, o => o && typeof o.ok === 'boolean'],
  ['describe_garment', { text: 'a white bias cut slip dress with a red sash' }, o => o && typeof o.ok === 'boolean'],
  ['describe_garment', {}, o => o && o.ok === false],
  ['visualize', {}, o => o && typeof o.ok === 'boolean'],
  ['write_feedback', { notes: 'What: X. Why: Y. Where: Z.', kind: 'feature' }, o => o && o.ok === true],
  ['log_feature', { text: 'smoke: Maya should scroll the favorites' }, o => o && o.ok === true],
  // v14.10: her legs. She must be able to walk the three screens and scroll them.
  ['go_to_screen', { where: 'favorites' }, o => o && o.ok === true],
  ['go_to_screen', { where: 'community' }, o => o && o.ok === true],
  ['go_to_screen', { where: 'home' }, o => o && o.ok === true],
  ['go_to_screen', { where: 'attic' }, o => o && o.ok === false],
  ['scroll', { area: 'favorites', direction: 'down' }, o => o && typeof o.ok === 'boolean'],
  ['scroll', { area: 'community', direction: 'down' }, o => o && typeof o.ok === 'boolean'],
  ['scroll', { area: 'pins', direction: 'down' }, o => o && typeof o.ok === 'boolean'],
  ['scroll', {}, o => o && typeof o.ok === 'boolean'],
  ['no_such_tool', {}, o => o && o.ok === false && o.reason === 'unknown tool'],
];
for (const [name, args, judge] of battery) {
  let out, threw = null;
  try {
    out = await Promise.race([
      page.evaluate(([n, a]) => window._pgTool(n, a, { send: () => {} }), [name, args]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('HANG: no answer in 12s')), 12000)),
    ]);
  } catch (e) { threw = String(e && e.message || e).slice(0, 120); }
  ok('tool ' + name + ' ' + JSON.stringify(args).slice(0, 48),
    !threw && judge(out),
    threw ? 'THREW: ' + threw : (out && out.ok === false ? 'said no: ' + (out.reason || '(no reason)') : ''));
}

// ── 4. the failed hand files itself (v14.09 observer) ──
const logged = await page.evaluate(async () => {
  const before = (window._pgMayaLogBuf || []).length;
  await window._pgRunCall({ send: () => {} }, 'open_card', 'call_smoke_1', JSON.stringify({ query: 'purple spacesuit' }));
  return (window._pgMayaLogBuf || []).length > before;
});
ok('a failed tool call auto-logs itself to the studio', logged);

// ── 5. her ears: the voice plumbing survives without a mic or a token ──
const voice = await page.evaluate(async () => {
  const r = {};
  try { _pgWakePause(); _pgWakeResume(); r.pauseResume = true; } catch (e) { r.pauseResume = String(e.message).slice(0, 80); }
  try { _pgWakeStop(); r.stop = true; } catch (e) { r.stop = String(e.message).slice(0, 80); }
  try { pgMayaStop(); r.mayaStop = true; } catch (e) { r.mayaStop = String(e.message).slice(0, 80); }
  return r;
});
ok('wake pause/resume never throws', voice.pauseResume === true, String(voice.pauseResume));
ok('wake stop never throws', voice.stop === true, String(voice.stop));
ok('pgMayaStop with no live call never throws', voice.mayaStop === true, String(voice.mayaStop));

// ── 6. zero uncaught page errors through the whole battery ──
ok('zero uncaught page errors during the battery', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close(); srv.close();
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
