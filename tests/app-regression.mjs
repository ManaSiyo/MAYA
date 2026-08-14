// MAYA app regression test. Companion to smoke.mjs (which covers the server).
// Boots the real pages headlessly and asserts the behaviors Fromsa has asked
// for stay true, so a fixed thing failing again is caught BEFORE a push.
// Add an assertion here every time an entry in requests.txt is completed.
//
//   node tests/app-regression.mjs        (run from the repo root)
//
// Needs Playwright + Chromium. Claude runs this in its workspace as part of
// the pre-push loop: smoke.mjs, then this, then the push is prepared.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (existsSync(f) && !f.includes('..')) {
    res.setHeader('Content-Type', MIME[extname(f)] || 'application/octet-stream');
    res.end(readFileSync(f));
  } else { res.statusCode = 404; res.end('nf'); }
});
await new Promise(r => srv.listen(8899, r));

let failed = 0;
const ok = (name, cond) => { console.log((cond ? '  ok   ' : '  FAIL ') + name); if (!cond) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const pg = await browser.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e).split('\n')[0]));
// External CDNs are stubbed out; the page must still boot without them.
await pg.route('**/*', rt => rt.request().url().startsWith('http://127.0.0.1:8899') ? rt.continue() : rt.abort());

console.log('\nMAYA app regression\n');
await pg.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(2500);

const r = await pg.evaluate(() => {
  const out = {};
  out.version = document.querySelector('meta[name="maya-version"]').content;
  out.screens = document.getElementById('screens').children.length;
  // eval, not window[f]: let/const globals (projectStore) don't land on window.
  out.fnsMissing = ['bringCardToFront', '_groupOf', 'setFabricsTab', 'loadMyFabrics',
    'uploadMyFabricFiles', 'openUploadChooser', 'stackInspirationImages', 'projectStore',
    'shareCurrentProject', '_maybeOpenShare', '_urlToDataUrl']
    .filter(f => { try { return (0, eval)('typeof ' + f) === 'undefined'; } catch (_) { return true; } });
  out.tabs = !!document.getElementById('fabrics-tab-house') && !!document.getElementById('fabrics-tab-mine');
  out.uploadText = (document.querySelector('.upload-link') || {}).textContent || '';
  out.chooser = !!document.getElementById('upload-choose-modal');
  out.shareBtn = [...document.querySelectorAll('#notes-drawer button')]
    .some(b => b.textContent.trim() === 'Share');
  // Aug 13: the community wall. Three rows, visions only, one garment once.
  out.wallRows = document.querySelectorAll('#community-scroller .community-row').length;
  out.visionGate = [
    communityBoard._isVision({ kind: 'inspo', image: 'x', inspirationId: 'a' }) === true,
    communityBoard._isVision({ kind: 'inspo', image: 'x' }) === false,          // upload
    communityBoard._isVision({ kind: 'text', inspirationId: 'a' }) === false,
  ].every(Boolean);
  // The same garment copied into another account keeps its inspiration id,
  // so both hearts fingerprint identically and the wall shows one.
  out.fpMatches = communityBoard._fp({ inspirationId: 'g1', version: 2, imageUrl: 'https://a/one.jpg' }) ===
                  communityBoard._fp({ inspirationId: 'g1', version: 2, imageUrl: 'https://b/two.jpg' });
  out.fpDiffers = communityBoard._fp({ inspirationId: 'g1', version: 1 }) !==
                  communityBoard._fp({ inspirationId: 'g1', version: 2 });
  // Aug 14 security: the picture gate and the death of inline handlers.
  out.imgGate = _safeImgSrc('javascript:alert(1)') === '' &&
                _safeImgSrc('vbscript:x') === '' &&
                _safeImgSrc('https://x/y.jpg') === 'https://x/y.jpg' &&
                _safeImgSrc('data:image/jpeg;base64,abc') !== '' &&
                _safeImgSrc('data:text/html;base64,abc') === '';
  out.noInlineWallClicks = !document.body.innerHTML.includes('communityBoard.openPost(\'');
  // Aug 13: stack behavior. Latest version on top, 15px steps, toggle
  // unstack restores positions, flags set for whole-stack dragging.
  const mk = (id, v, x) => { const el = document.createElement('div');
    el.style.left = x + 'px'; el.style.top = '300px'; document.body.appendChild(el);
    const card = { kind: 'inspo', image: 'x', inspirationId: 'rt', version: v };
    items.push({ id, el, card }); return items[items.length - 1]; };
  const a = mk(9101, 1, 100), b = mk(9102, 2, 160), c = mk(9103, 3, 220);
  stackInspirationImages(9103);
  const z = m => parseInt(m.el.style.zIndex) || 0;
  out.stackLatestOnTop = z(c) > z(b) && z(b) > z(a);
  out.stackStep = Math.abs(parseInt(b.el.style.left) - parseInt(c.el.style.left));
  out.stackFlags = !!(a.card.stacked && b.card.stacked && c.card.stacked);
  stackInspirationImages(9103);
  out.unstackRestores = !a.card.stacked && parseInt(a.el.style.left) === 100;
  // Aug 13: entry-fade flicker guard. Simulated drag class churn must not
  // leave a card with a live entry animation.
  const probe = document.createElement('div'); probe.className = 'item-card';
  document.body.appendChild(probe);
  probe.style.animation = 'none';                     // what pointerdown does
  probe.classList.add('dragging'); probe.classList.remove('dragging');
  out.noFadeReplay = getComputedStyle(probe).animationName === 'none';
  return out;
});
ok('page boots with zero runtime errors', errs.length === 0);
ok('three vertical screens', r.screens === 3);
ok('all v13.4 functions defined (' + (r.fnsMissing.join(',') || 'none missing') + ')', r.fnsMissing.length === 0);
ok('fabrics tabs present (Mana Siyo / My fabrics)', r.tabs);
ok('upload button reads "+ upload"', r.uploadText.trim() === '+ upload');
ok('upload chooser exists', r.chooser);
ok('Share button lives in the drawer', r.shareBtn);
ok('community wall has three rows', r.wallRows === 3);
ok('only generated visions reach the wall', r.visionGate);
ok('the same garment fingerprints the same across accounts', r.fpMatches);
ok('different versions stay different visions', r.fpDiffers);
ok('picture gate blocks non https, non image addresses', r.imgGate);
ok('wall cards carry no inline click handlers', r.noInlineWallClicks);
ok('stack puts the LATEST version on top', r.stackLatestOnTop);
ok('stack offsets are 15px (30 percent tighter)', r.stackStep === 15);
ok('stacked flags set (whole stack drags as one)', r.stackFlags);
ok('stack button toggles, positions restored', r.unstackRestores);
ok('drag class churn cannot replay the entry fade', r.noFadeReplay);

await pg.goto('http://127.0.0.1:8899/status.html', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
const s = await pg.evaluate(() => ({
  order: [...document.querySelectorAll('details.fold')].map(d => d.id).join(','),
  archFold: (document.getElementById('arch-fold') || {}).tagName === 'DETAILS',
  arrows: document.querySelectorAll('.card .go').length,
  warnBanner: !!document.querySelector('.warn'),
  footerFolds: document.querySelectorAll('.map-footer details.fold').length,
  doorSizes: new Set([...document.querySelectorAll('.grid.doors .card b')]
    .map(el => getComputedStyle(el).fontSize)).size,
}));
ok('Systems Map order: changes, prompting, architecture', s.order === 'changes-fold,pe-fold,arch-fold');
ok('Architecture is collapsible', s.archFold);
ok('door cards have no arrows', s.arrows === 0);
ok('"Never delete" banner removed', !s.warnBanner);
ok('folds live in the bottom footer', s.footerFolds === 3);
ok('all door texts share one font size', s.doorSizes === 1);

// Aug 13: every deploy signs both pages out on next load, and the two
// pages must carry the SAME version number or the map's logout never fires.
const mapVer = await pg.evaluate(() =>
  (document.querySelector('meta[name="maya-version"]') || {}).content || 'missing');
ok('index and map carry the same maya-version (' + r.version + ')', mapVer === r.version);
await pg.evaluate(() => {
  localStorage.setItem('maya_admin_tok', 'FAKE.TOKEN.x');
  localStorage.setItem('maya_seen_version_map', '0.0');
});
await pg.reload({ waitUntil: 'domcontentloaded' });
const mapLoggedOut = await pg.evaluate(() => localStorage.getItem('maya_admin_tok') === null);
ok('map: version change clears the cached sign in', mapLoggedOut);
await pg.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'domcontentloaded' });
await pg.evaluate(() => {
  localStorage.setItem('maya_google_token', 'FAKE.TOKEN.x');
  localStorage.setItem('maya_seen_version_app', '0.0');
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
const appLoggedOut = await pg.evaluate(() => localStorage.getItem('maya_google_token') === null);
ok('app: version change clears the cached sign in', appLoggedOut);

await browser.close(); srv.close();
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
