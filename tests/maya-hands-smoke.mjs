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
// v14.21: the app IS the Playground now, so the battery fires on both. With no
// MAYA_SURFACE set it runs itself once per surface and fails if either fails.
if (!process.env.MAYA_SURFACE) {
  const { spawnSync } = await import('node:child_process');
  let bad = 0;
  for (const s of (process.env.MAYA_SURFACES || 'playground,frontend').split(',')) {
    console.log('\n══════ surface: ' + s + ' ══════');
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, MAYA_SURFACE: s } });
    if (r.status !== 0) bad++;
  }
  process.exit(bad ? 1 : 0);
}
const SURFACE = process.env.MAYA_SURFACE;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // fake API surface so the page never waits on a real server
  if (p.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (p === '/api/pinterest/boards') return res.end(JSON.stringify({ boards: [{ id: 'b1', name: 'Summer whites' }, { id: 'b2', name: 'Red carpet' }] }));
    if (p === '/api/pinterest/search') return res.end(JSON.stringify({ ok: true, pins: [
      { id: 'w1', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'victorian corset in ivory silk' },
      { id: 'w2', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'black leather corset belt' }] }));
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

const exe = process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message || e).slice(0, 200)));
await page.goto('http://127.0.0.1:8898/' + SURFACE + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

let failed = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '   ' + extra : ''));
  if (!cond) failed++;
};

console.log('\nMAYA hands smoke test (' + SURFACE + ')\n');

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
  // v14.19: her hands on the clients
  ['list_clients', {}, o => o && typeof o.ok === 'boolean'],
  ['switch_client', { name: 'zzz nobody' }, o => o && o.ok === false],
  ['switch_client', {}, o => o && o.ok === false],
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
  // v14.17: search, the glide, and stop as a first class word
  ['search_pins', {}, o => o && o.ok === false && /no words/.test(o.reason)],
  // v14.18: nothing on the loaded wall means she goes wider by herself
  ['search_pins', { query: 'corsets' }, o => o && o.ok === true && o.matches === 2 && /everything saved/.test(o.from)],
  ['clear_pin_search', {}, o => o && o.ok === true],
  ['scroll', { direction: 'stop' }, o => o && o.ok === true && /stopped|nothing was moving/.test(o.note)],
  ['scroll_pins', { direction: 'stop' }, o => o && o.ok === true],
  // v14.13: the card editor. Every one of these is a bug Fromsa hit out loud.
  ['modify_garment', { text: 'make it a trench coat' }, o => o && o.ok === false && /open the card first/.test(o.reason)],
  ['modify_garment', {}, o => o && o.ok === false],
  ['card_version', { direction: 'previous' }, o => o && o.ok === false && /no picture is open/.test(o.reason)],
  ['render_status', {}, o => o && o.ok === true && o.rendering === false],
  ['visualize', {}, o => o && typeof o.ok === 'boolean'],
  // v14.14: deletion is a two step handshake, never a single guess
  ['delete_card', { query: 'the girl with the apple' }, o => o && o.ok === false && o.needsConfirmation === true],
  ['delete_card', { query: 'zzz nothing matches this' }, o => o && o.ok === false && !o.needsConfirmation],
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
  const posHit = _pgFindCardDetailed('the card on the left');
  out.posRegion = !!posHit.it && posHit.it.id === v2.id;
  out.posRegionInfo = posHit.it ? posHit.how : posHit.reason;
  out.snapshotPos = _pgBoardSnapshot().every(c => typeof c.pos === 'string');

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
ok('"the card on the left" resolves through the region, versions collapsed', editor.posRegion === true, JSON.stringify(editor.posRegionInfo || null));
ok('every board snapshot card carries a position word', editor.snapshotPos === true);
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

// ── 3c2. v14.17: the glide moves on its own and stop halts it; search filters ──
const glide = await page.evaluate(async () => {
  const body = document.getElementById('pinterest-drawer-body');
  body.innerHTML = '';
  for (let i = 0; i < 30; i++) {
    const d = document.createElement('div'); d.className = 'pin-pic';
    d.dataset.alt = i % 3 === 0 ? 'black lace corset with ribbon' : 'silk gown flowing ' + i;
    d.style.height = '80px'; d.style.display = 'block'; body.appendChild(d);
  }
  // the drawer pane is display:none headless (no layout, nothing scrolls),
  // so the glide mechanics run on a real scrollable attached to the page
  const rig = document.createElement('div');
  rig.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;overflow-y:auto;';
  for (let i = 0; i < 40; i++) { const c = document.createElement('div'); c.style.height = '60px'; rig.appendChild(c); }
  document.body.appendChild(rig);
  const y0 = rig.scrollTop;
  _pgGlideStart(rig, 1);
  await new Promise(r => setTimeout(r, 300));
  const moved = rig.scrollTop > y0;
  const stopped = _pgGlideStop();
  const yStop = rig.scrollTop;
  await new Promise(r => setTimeout(r, 200));
  const stayed = rig.scrollTop === yStop;
  rig.remove();
  const matches = _pinSearch('corsets');
  const hidden = [...body.querySelectorAll('.pin-pic')].filter(el => el.style.display === 'none').length;
  _pinSearch('');
  const restored = [...body.querySelectorAll('.pin-pic')].filter(el => el.style.display === 'none').length === 0;
  body.innerHTML = '';
  return { moved, stopped, stayed, matches, hidden, restored };
});
ok('the glide moves the wall on its own', glide.moved === true, JSON.stringify(glide));
ok('stop halts the glide and it stays halted', glide.stopped === true && glide.stayed === true);
ok('searching corsets shows only corset pins (plural finds singular)', glide.matches === 10 && glide.hidden === 20);
ok('clearing the search brings the whole wall back', glide.restored === true);

// ── 3c3. v14.18: the glide slides SIDEWAYS too, and many rows at once ──
const glideX = await page.evaluate(async () => {
  const mkRow = () => {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:60px;overflow-x:auto;white-space:nowrap;';
    for (let i = 0; i < 30; i++) { const c = document.createElement('span'); c.style.cssText = 'display:inline-block;width:60px;height:50px;'; r.appendChild(c); }
    document.body.appendChild(r); return r;
  };
  const r1 = mkRow(), r2 = mkRow();
  _pgGlideStart([r1, r2], 1, 'x');
  await new Promise(r => setTimeout(r, 300));
  const moved = r1.scrollLeft > 0 && r2.scrollLeft > 0;
  const stopped = _pgGlideStop();
  r1.remove(); r2.remove();
  return { moved, stopped };
});
ok('the glide slides two rows sideways together and stops', glideX.moved === true && glideX.stopped === true, JSON.stringify(glideX));

// ── 3c4. v14.18: the wider room searches everything saved, not the loaded page ──
const wider = await page.evaluate(async () => {
  const out = {};
  out.res = await window._pgTool('search_pins', { query: 'corsets', wider: true }, { send: () => {} });
  const body = document.getElementById('pinterest-drawer-body');
  out.walls = body ? body.querySelectorAll('.pin-pic').length : -1;
  out.alt = body && body.querySelector('.pin-pic') ? body.querySelector('.pin-pic').dataset.alt : '';
  _pgGlideStop();
  const cleared = await window._pgTool('clear_pin_search', {}, { send: () => {} });
  out.cleared = cleared && cleared.ok === true;
  return out;
});
ok('the wider search renders every saved match onto the wall',
  wider.res && wider.res.ok === true && wider.res.matches === 2 && wider.walls === 2 && /corset/.test(wider.alt),
  JSON.stringify(wider.res));
ok('clearing after a wider search restores the wall', wider.cleared === true);

// ── 3c5. v14.19: the drawer's people and projects, untangled ──
const drawer = await page.evaluate(async () => {
  const out = {};
  out.photoOpensList = /toggleAvatarSwitcher/.test(document.getElementById('drawer-avatar-button').getAttribute('onclick') || '');
  // a project label must never read as the client's name
  (0, eval)("lastSummary = null; currentClientName = 'Untitled 09/01 19:03';");
  refreshDrawerClientName();
  out.nameNoLeak = document.getElementById('drawer-avatar-name').textContent;
  // the open project is highlighted at all times: on the pill and in the list
  projectStore.currentId = 'p1';
  (0, eval)("currentClientName = 'Rudy the Presley';");
  const list = document.getElementById('drawer-sessions-list');
  list.innerHTML = '<div class="session-item" data-id="p1"></div><div class="session-item active" data-id="p2"></div>';
  pgUpdatePill();
  const beside = document.getElementById('pg-project-beside');
  out.pill = beside.textContent.trim();
  out.pillOn = beside.classList.contains('on');
  out.rowP1 = list.querySelector('[data-id="p1"]').classList.contains('active');
  out.rowP2 = list.querySelector('[data-id="p2"]').classList.contains('active');
  // clients: the current one is marked, each has an x, switching keeps the board
  (0, eval)("_avatarLibCache = [{ id: 'micheal', name: 'Micheal', face: null, measurements: { height: '180' } }, { id: 'rudy', name: 'Rudy', face: null }]; lastSummary = { client: { name: 'Rudy' }, dream_outcome: 'a fedora' };");
  out.list = await window._pgTool('list_clients', {}, { send: () => {} });
  (0, eval)('_avatarSwitcherOpen = false');
  await toggleAvatarSwitcher();
  const panel = document.getElementById('drawer-avatar-switcher');
  out.rows = panel.querySelectorAll('.avatar-switch-row[data-id]').length;
  out.activeRow = (panel.querySelector('.avatar-switch-row.active') || {}).dataset ? panel.querySelector('.avatar-switch-row.active').dataset.id : '';
  out.xs = panel.querySelectorAll('.avatar-switch-delete').length;
  const cardsBefore = (0, eval)('items.length');
  out.sw = await window._pgTool('switch_client', { name: 'micheal' }, { send: () => {} });
  out.cardsKept = (0, eval)('items.length') === cardsBefore;
  const ls = (0, eval)('lastSummary');
  out.wearing = ls && ls.client && ls.client.name;
  out.height = ls && ls._measurements && ls._measurements.height;
  out.notesKept = ls && ls.dream_outcome;
  out.switcherClosed = panel.style.display === 'none';
  // naming a client in place, without renaming the project
  pgRenameClient();
  const inp = document.getElementById('pg-client-rename');
  out.renameBox = !!inp;
  if (inp) { inp.value = 'Aster'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  await new Promise(r => setTimeout(r, 50));
  out.renamed = document.getElementById('drawer-avatar-name').textContent;
  out.projectUntouched = (0, eval)('currentClientName');
  out.boxGone = !document.getElementById('pg-client-rename');
  projectStore.currentId = null;
  (0, eval)("currentClientName = null; lastSummary = null;");
  refreshDrawerClientName();
  out.pillIdle = document.getElementById('pg-project-beside').textContent.trim();
  return out;
});
ok('the photo opens the client list, not the measurements', drawer.photoOpensList === true);
ok('a project label never reads as the client name', drawer.nameNoLeak === 'client', drawer.nameNoLeak);
ok('the open project is highlighted on the pill', /^Rudy the Presley/.test(drawer.pill) && drawer.pillOn === true, drawer.pill);
ok('the open project is highlighted in the list, and only it', drawer.rowP1 === true && drawer.rowP2 === false);
ok('list_clients names the people and who wears the board', drawer.list && drawer.list.ok === true && drawer.list.current === 'Rudy' && drawer.list.clients.length === 2, JSON.stringify(drawer.list));
ok('the client list marks the current client and gives each an x', drawer.rows === 2 && drawer.activeRow === 'rudy' && drawer.xs === 2, JSON.stringify({ rows: drawer.rows, activeRow: drawer.activeRow, xs: drawer.xs }));
ok('switching the client keeps every card and the notes', drawer.sw && drawer.sw.ok === true && drawer.cardsKept === true && drawer.wearing === 'Micheal' && drawer.height === '180' && drawer.notesKept === 'a fedora' && drawer.switcherClosed === true, JSON.stringify(drawer.sw));
ok('a client can be named in place without renaming the project', drawer.renameBox === true && drawer.renamed === 'Aster' && drawer.projectUntouched === 'Rudy the Presley' && drawer.boxGone === true, JSON.stringify({ renamed: drawer.renamed, proj: drawer.projectUntouched }));
ok('with no project open the pill reads Projects', /^Projects/.test(drawer.pillIdle), drawer.pillIdle);

// ── 3c6. v14.20: Profile, the Projects fold, renaming in place, the finger's wider search ──
const fold = await page.evaluate(async () => {
  const out = {};
  pgShow('avatar');
  out.title = (document.getElementById('pg-tabtitle') || {}).textContent;
  const pf = document.getElementById('pg-projects');
  out.foldAboveStats = !!pf && pf.nextElementSibling && pf.nextElementSibling.id === 'pg-stats';
  out.listInFold = !!document.querySelector('#pg-projects-body #drawer-sessions-list');
  out.pillHidden = getComputedStyle(document.getElementById('pg-project-beside')).display === 'none';
  out.actionsHidden = getComputedStyle(document.querySelector('#pg-avatar-row .pg-avatar-actions')).display === 'none';
  // the summary carries the open project's name
  projectStore.currentId = 'p1';
  (0, eval)("currentClientName = 'Rudy the Presley';");
  pgUpdatePill();
  out.summary = (document.getElementById('pg-projects-current') || {}).textContent;
  // the client dropdown carries Rename, Randomize, Replace and Remove, list or no list
  (0, eval)("_avatarLibCache = []; lastSummary = { client: { name: 'Rudy' } }; _avatarSwitcherOpen = false;");
  await toggleAvatarSwitcher();
  const panel = document.getElementById('drawer-avatar-switcher');
  out.actionButtons = [...panel.querySelectorAll('.avatar-switch-actions .drawer-action')].map(b => b.textContent.trim());
  out.newClient = /New avatar/.test(panel.textContent);
  (0, eval)('_closeAvatarSwitcher()');
  // renaming a project where it sits
  const list = document.getElementById('drawer-sessions-list');
  list.innerHTML = '<div class="session-item active" data-id="p1"><button class="session-item-rename"></button><div class="session-item-title">Rudy the Presley</div></div>';
  pgRenameProject('p1');
  const inp = list.querySelector('.pg-project-rename');
  out.renameBox = !!inp;
  if (inp) { inp.value = 'Gala 2026'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
  await new Promise(r => setTimeout(r, 80));
  out.renamed = (0, eval)('currentClientName');
  out.titleAfter = (list.querySelector('.session-item-title') || {}).textContent;
  pgUpdatePill();
  out.summaryAfter = (document.getElementById('pg-projects-current') || {}).textContent;
  projectStore.currentId = null; (0, eval)("currentClientName = null; lastSummary = null;");
  pgUpdatePill();
  out.summaryIdle = (document.getElementById('pg-projects-current') || {}).textContent;
  // the search pill and the finger's wider search
  out.glass = !!document.querySelector('#pin-search-btn svg');
  out.inputCentered = getComputedStyle(document.getElementById('pin-search-input')).textAlign === 'center';
  const wide = await _pinWideSearch('corsets');
  out.wide = wide;
  out.wideWall = document.querySelectorAll('#pinterest-drawer-body .pin-pic').length;
  _pinSearchInput('');
  out.restored = window._pinWiderActive === false;
  // every render prompt says the head is never enlarged
  (0, eval)("lastSummary = null;");
  out.clause = buildMeasClause();
  return out;
});
ok('the tab reads Profile', fold.title === 'Profile', fold.title);
ok('Projects is a fold above Stats holding the list', fold.foldAboveStats === true && fold.listInFold === true);
ok('the placeholder pills and the beside pill are gone', fold.pillHidden === true && fold.actionsHidden === true);
ok('the fold summary carries the open project name', fold.summary === 'Rudy the Presley' && fold.summaryIdle === '', JSON.stringify([fold.summary, fold.summaryIdle]));
ok('the client dropdown carries Rename, Randomize, Replace and Remove even when empty',
  fold.actionButtons.length === 4 && fold.actionButtons[0] === 'Rename' && fold.actionButtons[1] === 'Randomize' && fold.newClient === true, JSON.stringify(fold.actionButtons));
ok('a project is renamed where it sits', fold.renameBox === true && fold.renamed === 'Gala 2026' && fold.summaryAfter === 'Gala 2026', JSON.stringify([fold.renamed, fold.titleAfter, fold.summaryAfter]));
ok('the search pill is a real magnifying glass with a centered box', fold.glass === true && fold.inputCentered === true);
ok('the finger search reaches everything saved and a cleared box restores the wall', fold.wide && fold.wide.ok === true && fold.wide.matches === 2 && fold.wideWall === 2 && fold.restored === true, JSON.stringify(fold.wide));
ok('every render prompt says the head is never enlarged', /one eighth of the standing height/.test(fold.clause), fold.clause.slice(0, 60));

// ── 3c7. v14.22: the image filter refuses the face, the render still happens ──
const ladder = await page.evaluate(async () => {
  const out = { edits: [], gens: [] };
  const FACE = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const PIC = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';
  const origEdit = window.callOpenAIImageEditSafe, origGen = window.callOpenAIImageSafe;
  const origErr = window._pgLastRenderError;
  const origFade = window.fadeOutFloatingCards; window.fadeOutFloatingCards = () => {};
  // a real visualize consumes the cards that fed it; remember them so the board is put back afterwards
  const snap = (0, eval)('items').map(i => ({ i, consumed: i.consumed, el: i.el, parent: i.el && i.el.parentNode, next: i.el && i.el.nextSibling }));
  window.callOpenAIImageEditSafe = async (anchors, prompt) => {
    out.edits.push(prompt.slice(0, 60));
    const list = Array.isArray(anchors) ? anchors : [anchors];
    if (list[0] && list[0].length < 200) throw new Error('Your request was rejected by the safety system.');
    return PIC;
  };
  window.callOpenAIImageSafe = async (prompt) => { out.gens.push(prompt); return PIC; };
  (0, eval)("lastSummary = { client: { name: 'Linda' }, _face_photo: '" + FACE + "', _face_descriptors: { age_range: '14-16' }, _measurements: { height: '62' }, dream_outcome: 'a navy gown' }; selectedImageReferences = []; selectedImageReference = null; visualizeModifications = [];");
  window._pgLastRenderError = '';
  const before = (0, eval)('items.length');
  try { await _runVisualizeNow(); } catch (e) { out.threw = String(e && e.message || e); }
  // the fed cards fly into the picture on a 520ms timer; wait it out before putting the board back
  await new Promise(r => setTimeout(r, 1100));
  out.after = (0, eval)('items.length');
  out.note = window._mayaRenderNote || '';
  out.err = window._pgLastRenderError || '';
  out.genHasFace = out.gens.some(p => /client's face|Image 1/.test(p));
  out.genHasAge = out.gens.some(p => /14-16/.test(p));
  out.genHasHeight = out.gens.some(p => /62 inches/.test(p));
  out.placed = out.after === before + 1;
  // leave the board as it was for the checks that follow
  snap.forEach(r => { r.i.consumed = r.consumed; if (r.el) { r.i.el = r.el; if (r.parent && !r.el.isConnected) { try { r.parent.insertBefore(r.el, r.next && r.next.isConnected ? r.next : null); } catch (_) { r.parent.appendChild(r.el); } } r.el.style.opacity = ''; r.el.style.display = ''; } });
  try { (0, eval)('(function(){ const it = items[items.length - 1]; if (it && it.card && it.card.kind === "inspo") { items.pop(); if (it.el) it.el.remove(); } })()'); } catch (_) {}
  window.callOpenAIImageEditSafe = origEdit; window.callOpenAIImageSafe = origGen; window._pgLastRenderError = origErr; window.fadeOutFloatingCards = origFade;
  (0, eval)("lastSummary = null;");
  return out;
});
ok('a face the filter refuses still renders, on a fit model with the same measurements',
  !ladder.threw && ladder.placed === true && ladder.edits.length === 1 && ladder.gens.length === 1 && ladder.genHasFace === false && ladder.genHasAge === false && ladder.genHasHeight === true,
  JSON.stringify({ threw: ladder.threw, placed: ladder.placed, edits: ladder.edits.length, gens: ladder.gens.length, face: ladder.genHasFace, age: ladder.genHasAge, height: ladder.genHasHeight }));
ok('and it says so, to the person and to Maya', /fit model/.test(ladder.note) && ladder.err === '', ladder.note);

// ── 3d. v14.16: the studio gauge never claims zero of two dollars ──
const gauge = await page.evaluate(() => {
  (0, eval)('_mayaUsage = { spentUsd: 9.4, capUsd: 2, images: 120, perCard: 0.065, admin: true, projects: 3, ok: true }');
  try { _renderDrawerStats(); } catch (e) { return { err: String(e.message) }; }
  const v = (document.getElementById('pg-gauge-value') || {}).textContent;
  const c = (document.getElementById('pg-gauge-cap') || {}).textContent;
  return { v, c };
});
ok('an admin gauge says Studio, no cap, never $0.00 of $2', gauge.v === 'Studio' && gauge.c === 'no cap', JSON.stringify(gauge));

// ── 4. the observer, v14.14 rules: defects file themselves, expected
// answers stay out of the inbox (that was the inaccurate-logs complaint)
const observer = await page.evaluate(async () => {
  const out = {};
  const b0 = (window._pgMayaLogBuf || []).length;
  await window._pgRunCall({ send: () => {} }, 'open_card', 'call_ob_1', JSON.stringify({ query: 'purple spacesuit' }));
  out.benignStayedQuiet = (window._pgMayaLogBuf || []).length === b0;
  const orig = window._pgTool;
  window._pgTool = () => { throw new Error('exploded for the test'); };
  await window._pgRunCall({ send: () => {} }, 'open_card', 'call_ob_2', '{}');
  window._pgTool = orig;
  out.defectFiled = (window._pgMayaLogBuf || []).length === b0 + 1;
  return out;
});
ok('an expected miss (no such card) does NOT file a defect', observer.benignStayedQuiet);
ok('a thrown tool DOES file itself to the studio', observer.defectFiled);

// ── 4b. v14.14: the real routing layer, driven by synthetic model events ──
const routing = await page.evaluate(async () => {
  const out = { sent: [] };
  const dc = { send: (x) => { try { out.sent.push(JSON.parse(x)); } catch (_) {} } };
  const handler = _pgOnMessage(dc);
  const fire = (o) => handler({ data: JSON.stringify(o) });
  window._PG_TOOL_TIMEOUT_MS = 600;
  fire({ type: 'response.function_call_arguments.done', call_id: 'c1', name: 'open_card', arguments: '{not json' });
  fire({ type: 'response.function_call_arguments.done', call_id: 'c2', name: 'warp_drive', arguments: '{}' });
  fire({ type: 'response.function_call_arguments.done', call_id: 'c2', name: 'warp_drive', arguments: '{}' });
  const orig = window._pgTool;
  window._pgTool = (n, a, d) => n === 'hang_forever' ? new Promise(() => {}) : orig(n, a, d);
  fire({ type: 'response.function_call_arguments.done', call_id: 'c3', name: 'hang_forever', arguments: '{}' });
  await new Promise(r => setTimeout(r, 1800));
  window._pgTool = orig;
  delete window._PG_TOOL_TIMEOUT_MS;
  const outs = out.sent.filter(m => m && m.item && m.item.type === 'function_call_output');
  const byId = {}; outs.forEach(m => { byId[m.item.call_id] = JSON.parse(m.item.output); });
  return { count: outs.length, c1: byId.c1, c2: byId.c2, c3: byId.c3 };
});
ok('malformed arguments still produce a truthful function output', routing.c1 && routing.c1.ok === false);
ok('an unknown tool answers unknown tool through the routing layer', routing.c2 && routing.c2.reason === 'unknown tool');
ok('a duplicate call id is answered exactly once', routing.count === 3);
ok('a hanging tool times out and still answers the model', routing.c3 && routing.c3.ok === false && /timed out/.test(routing.c3.reason), JSON.stringify(routing.c3));

// ── 4c. v14.14: named-but-unmatched never falls back to the open card ──
const nofall = await page.evaluate(async () => {
  const modal = document.getElementById('garment-modal'); if (modal) modal.classList.add('open');
  const first = (0, eval)('items').find(i => i && i.card && i.card.caption);
  (0, eval)('viewerItemId = "' + first.id + '"');
  const miss = _pgFindCardDetailed('chartreuse parachute pants');
  const hit = _pgFindCardDetailed('this one');
  if (modal) modal.classList.remove('open');
  return { missIsNull: !miss.it, deicticStillWorks: !!hit.it };
});
ok('an explicitly named card that matches nothing is a MISS, not the open card', nofall.missIsNull);
ok('"this one" still resolves to the open card', nofall.deicticStillWorks);

// ── 4d. v14.14: the delete handshake executes only after confirm ──
const delflow = await page.evaluate(async () => {
  const el = document.createElement('div'); el.className = 'moodboard-item';
  const btn = document.createElement('div'); btn.className = 'delete-btn';
  let clicked = false; btn.addEventListener('click', () => { clicked = true; });
  el.appendChild(btn); document.body.appendChild(el);
  (0, eval)('items').push({ id: 'del-1', card: { caption: 'doomed neon parka', kind: 'render' }, el });
  const first = await window._pgTool('delete_card', { query: 'doomed neon parka' }, { send: () => {} });
  const notYet = !clicked;
  const second = await window._pgTool('delete_card', { query: 'doomed neon parka', confirm: true }, { send: () => {} });
  return { first, second, notYet, clicked };
});
ok('delete stages without touching the card', delflow.first && delflow.first.needsConfirmation === true && delflow.notYet);
ok('delete with confirm executes the staged card', delflow.second && delflow.second.ok === true && delflow.clicked);

// ── 4e. v14.14: the render outcome watcher speaks failure truthfully ──
const watcher = await page.evaluate(async () => {
  const out = { sent: [] };
  const dc = { send: (x) => { try { out.sent.push(JSON.parse(x)); } catch (_) {} } };
  window._PG_WATCH_MS = 80;
  (0, eval)('_renderLabels').push({ label: 'modifying', startedAt: Date.now(), expectedMs: 1000 });
  _pgWatchRender(dc);
  await new Promise(r => setTimeout(r, 250));
  window._pgLastRenderError = 'OpenAI error: 403';
  (0, eval)('_renderLabels').pop();
  await new Promise(r => setTimeout(r, 400));
  delete window._PG_WATCH_MS;
  const said = out.sent.filter(m => m && m.item && m.item.type === 'message')
    .map(m => (m.item.content && m.item.content[0] && m.item.content[0].text) || '').join(' ');
  window._pgLastRenderError = null;
  return { said };
});
ok('the watcher tells Maya a render FAILED, with the error',
  /FAILED/.test(watcher.said) && /403/.test(watcher.said), watcher.said.slice(0, 120));

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
