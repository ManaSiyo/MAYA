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
  // v14.11: the batch from walking the whole interface like a user.
  ['zoom', { action: 'out' }, o => o && o.ok === true && /percent/.test(o.level)],
  ['zoom', { action: 'in' }, o => o && o.ok === true],
  ['zoom', { action: 'reset' }, o => o && o.ok === true && o.level === '100 percent'],
  ['organize_board', {}, o => o && o.ok === true],
  ['dissect_card', { query: 'apple' }, o => o && o.ok === false && /dissect/.test(o.reason)],
  ['dissect_card', { query: 'purple spacesuit' }, o => o && o.ok === false],
  ['add_reference', {}, o => o && o.ok === false],
  ['add_reference', { text: 'Mugler shoulders' }, o => o && typeof o.ok === 'boolean'],
  ['card_details', { query: 'quiet luxury' }, o => o && o.ok === true && o.bio && o.era],
  ['card_details', { query: 'purple spacesuit' }, o => o && o.ok === false],
  ['list_projects', {}, o => o && typeof o.ok === 'boolean'],
  ['open_project', { name: 'zzz no such project' }, o => o && o.ok === false],
  ['check_credits', {}, o => o && typeof o.ok === 'boolean'],
  ['background', { which: 'star' }, o => o && typeof o.ok === 'boolean'],
  ['set_measurement', { name: 'waist', value: 29 }, o => o && o.ok === true],
  ['set_measurement', { name: 'aura', value: 9 }, o => o && o.ok === false && Array.isArray(o.knows)],
  ['set_measurement', { name: 'waist', value: 'soft' }, o => o && o.ok === false],
  ['pick_fabric', { name: 'midnight velvet' }, o => o && o.ok === false && /picker is not open/.test(o.reason)],
  ['viewer', { action: 'heart' }, o => o && typeof o.ok === 'boolean'],
  ['viewer', { action: 'photo' }, o => o && typeof o.ok === 'boolean'],
  ['viewer', { action: 'attributes' }, o => o && typeof o.ok === 'boolean'],
  // v14.12: the second audit pass: honest scroll, moving hands, favorites by name.
  ['move_card', { query: 'apple', direction: 'right' }, o => o && o.ok === true && o.direction === 'right'],
  ['move_card', { query: 'apple', direction: 'center' }, o => o && o.ok === true],
  ['move_card', { query: 'apple', direction: 'sideways' }, o => o && o.ok === false && Array.isArray(o.directions)],
  ['move_card', { query: 'purple spacesuit', direction: 'left' }, o => o && o.ok === false],
  ['resize_card', { query: 'apple', size: 'bigger' }, o => o && o.ok === true && /px/.test(o.width)],
  ['resize_card', { query: 'apple', size: 'smaller' }, o => o && o.ok === true],
  ['list_favorites', {}, o => o && typeof o.ok === 'boolean'],
  ['open_favorite', { query: 'anything' }, o => o && typeof o.ok === 'boolean'],
  ['set_quality', { quality: 'high' }, o => o && o.ok === true && o.quality === 'high'],
  ['set_quality', { quality: 'ultra' }, o => o && o.ok === false],
  ['clear_hints', {}, o => o && o.ok === true],
  // v14.13: the card editor. Every one of these is a bug Fromsa hit out loud.
  ['modify_garment', { text: 'make it a trench coat' }, o => o && o.ok === false && /open the card first/.test(o.reason)],
  ['modify_garment', {}, o => o && o.ok === false],
  ['card_version', { direction: 'previous' }, o => o && o.ok === false && /no picture is open/.test(o.reason)],
  ['render_status', {}, o => o && o.ok === true && o.rendering === false],
  ['visualize', {}, o => o && typeof o.ok === 'boolean'],
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

// ── 3b. v14.12: scroll is honest about a closed drawer ──
const honest = await page.evaluate(async () => {
  try { toggleNotesDrawer(false); } catch (_) {}
  await new Promise(r => setTimeout(r, 700));
  const closedPins = await window._pgTool('scroll_pins', {}, { send: () => {} });
  const bare = await window._pgTool('scroll', {}, { send: () => {} });
  return { closedPins, bare };
});
ok('scroll_pins with the drawer closed says so instead of pretending',
  honest.closedPins && honest.closedPins.ok === false && /not open/.test(honest.closedPins.reason || ''),
  JSON.stringify(honest.closedPins));
ok('bare scroll with the drawer closed never claims the pins',
  honest.bare && honest.bare.area !== 'pins', JSON.stringify(honest.bare));

// ── 3c. v14.13: the card editor, with a picture actually open ──
const editor = await page.evaluate(async () => {
  const out = {};
  const mk = (n, ver) => {
    const el = document.createElement('div');
    el.className = 'moodboard-item'; el.style.left = (n * 300) + 'px'; el.style.top = '80px';
    document.body.appendChild(el);
    const card = { kind: 'inspo', image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      caption: n === 0 ? 'red fur bomber over crocodile flares' : 'ivory column gown',
      inspirationId: 'insp-1', version: ver, profile: { color: n === 0 ? 'Red and bronze' : 'Ivory' } };
    const it = { id: 'seed-' + n + '-' + ver, card, el };
    (0, eval)('items').push(it);
    return it;
  };
  const v1 = mk(0, 1), v2 = mk(0, 2), other = mk(1, 1);
  other.card.inspirationId = 'insp-2';
  // viewerItemId and the viewer helpers are page-scope: indirect eval reaches
  // the script's lexical scope, a window assignment does not.
  window.__seedId = v2.id;
  (0, eval)('viewerItemId = window.__seedId');
  window.__spy = out;
  (0, eval)('viewerStep = (d) => { window.__spy.viewerStepCalledWith = d; }');
  (0, eval)('_favStep = () => { window.__spy.favStepCalled = true; }');
  (0, eval)('modifySubmit = () => { window.__spy.modifySubmitCalled = true; }');
  const modal = document.getElementById('garment-modal'); if (modal) modal.classList.add('open');
  const nav = document.getElementById('viewer-version-nav'); if (nav) nav.style.display = 'flex';

  out.deictic = (typeof _pgFindCardDetailed === 'function') && _pgFindCardDetailed('this one').it === v2;
  out.positional = (typeof _pgFindCardDetailed === 'function') && !!_pgFindCardDetailed('the one on the left').it;
  // a color word either lands on one piece or reports the ambiguity with
  // candidates to read back. What it must never do is guess wrong silently.
  const red = _pgFindCardDetailed('the red one');
  out.byColor = !!red.it || (red.ambiguous === true && Array.isArray(red.candidates) && red.candidates.length > 1);
  const fam = _pgFindCardDetailed('crocodile flares');
  out.versionsCollapse = !!fam.it && fam.it.id === v2.id;

  out.modify = await window._pgTool('modify_garment', { text: 'make it a trench coat' }, { send: () => {} });
  out.version = await window._pgTool('card_version', { direction: 'previous' }, { send: () => {} });
  out.visualizeInViewer = await window._pgTool('visualize', {}, { send: () => {} });
  out.fabricModalOpen = !!(document.getElementById('fabric-mode-modal') || {}).classList &&
    document.getElementById('fabric-mode-modal').classList.contains('open');
  try { showError('OpenAI error: 403'); } catch (_) {}
  out.status = await window._pgTool('render_status', {}, { send: () => {} });
  if (modal) modal.classList.remove('open');
  return out;
});
ok('"this one" resolves to the picture on screen', editor.deictic === true);
ok('"the one on the left" resolves by position', editor.positional === true);
ok('a color word finds one piece or names the candidates, never a silent wrong guess', editor.byColor === true);
ok('two versions of one piece are never an ambiguous question', editor.versionsCollapse === true);
ok('modify_garment applies the change through the modify pipeline',
  editor.modify && editor.modify.ok === true && editor.modifySubmitCalled === true, JSON.stringify(editor.modify));
ok('modify_garment NEVER opens the fabric popup', editor.fabricModalOpen === false);
ok('card_version steps versions, never the favorites strip',
  editor.version && editor.version.ok === true && editor.version.sameGarment === true &&
  editor.viewerStepCalledWith === -1 && !editor.favStepCalled, JSON.stringify(editor.version));
ok('visualize inside an open picture renders THIS piece, no home screen flow',
  editor.visualizeInViewer && editor.visualizeInViewer.ok === true && /this piece/.test(editor.visualizeInViewer.note || ''),
  JSON.stringify(editor.visualizeInViewer));
ok('a failed render is readable by Maya and auto-logged',
  editor.status && editor.status.failed === true && /403/.test(editor.status.error || ''), JSON.stringify(editor.status));

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
