// MAYA app regression test. Companion to smoke.mjs (which covers the server).
// Boots the real pages headlessly and asserts the behaviors Fromsa has asked
// for stay true, so a fixed thing failing again is caught BEFORE a push.
// Add an assertion here every time an entry in docs/requests.txt is completed.
//
//   node tests/app-regression.mjs        (run from the repo root)
//
// Needs Playwright + Chromium. Claude runs this in its workspace as part of
// the pre-push loop: smoke.mjs, then this, then the push is prepared.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// v13.37: the folder was reorganised. One place says where every file is, so
// a move only ever needs editing here.
const AT = {
  index:     'frontend/index.html',
  status:    'backend/status.html',
  backend:   'backend/backend.html',
  marketing: 'backend/marketing.html',
  privacy:   'backend/privacy.html',
  verify:    'backend/verify.html',
  server:    'docs/server/server.js',
  build:     'cloudbuild.yaml',
  hosting:   'docs/firebase.json',
};
const INDEX_SOURCE = readFileSync(join(ROOT, AT.index), 'utf8');
const RULES_SOURCE = readFileSync(join(ROOT, 'docs/server/firestore.rules'), 'utf8');
const SERVER_SOURCE = readFileSync(join(ROOT, AT.server), 'utf8');
const BUILD_SOURCE = readFileSync(join(ROOT, 'cloudbuild.yaml'), 'utf8');
const MAP_SOURCE = readFileSync(join(ROOT, AT.status), 'utf8');
const STORAGE_RULES = existsSync(join(ROOT, 'docs/server/storage.rules'))
  ? readFileSync(join(ROOT, 'docs/server/storage.rules'), 'utf8') : '';
const BACKEND_SOURCE = existsSync(join(ROOT, AT.backend))
  ? readFileSync(join(ROOT, AT.backend), 'utf8') : '';
const HOSTING = JSON.parse(readFileSync(join(ROOT, AT.hosting), 'utf8'));
const FAVORITE_PULSE_SOURCE = INDEX_SOURCE.slice(
  INDEX_SOURCE.indexOf('@keyframes maya-favorite-pulse'),
  INDEX_SOURCE.indexOf('@keyframes maya-favorite-pulse') + 500,
);
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
let served = true;
try {
  await new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(8899, '127.0.0.1', resolve);
  });
} catch (error) {
  if (!error || error.code !== 'EPERM') throw error;
  served = false;
}
const PAGE_ROOT = served ? 'http://127.0.0.1:8899/' : pathToFileURL(ROOT + '/').href;

let failed = 0;
const ok = (name, cond) => { console.log((cond ? '  ok   ' : '  FAIL ') + name); if (!cond) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const pg = await browser.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e).split('\n')[0]));
// External CDNs are stubbed out; the page must still boot without them.
await pg.route('**/*', rt => rt.request().url().startsWith(PAGE_ROOT) ? rt.continue() : rt.abort());

console.log('\nMAYA app regression\n');
await pg.goto(PAGE_ROOT + AT.index, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(2500);

const r = await pg.evaluate(async () => {
  const out = {};
  out.version = document.querySelector('meta[name="maya-version"]').content;
  out.screens = document.getElementById('screens').children.length;
  // eval, not window[f]: let/const globals (projectStore) don't land on window.
  out.fnsMissing = ['bringCardToFront', '_groupOf', 'setFabricsTab', 'loadMyFabrics',
    'uploadMyFabricFiles', '_drainMyFabricCleanup', 'openUploadChooser', 'stackInspirationImages', 'projectStore',
    'shareCurrentProject', '_maybeOpenShare', '_urlToDataUrl']
    .filter(f => { try { return (0, eval)('typeof ' + f) === 'undefined'; } catch (_) { return true; } });
  out.tabs = !!document.getElementById('fabrics-tab-house') && !!document.getElementById('fabrics-tab-mine');
  out.uploadText = (document.querySelector('.upload-link') || {}).textContent || '';
  out.chooser = !!document.getElementById('upload-choose-modal');
  // v13.29: Share left the drawer and lives on each project row instead.
  out.shareBtn = ![...document.querySelectorAll('#notes-drawer button')]
    .some(b => b.textContent.trim() === 'Share');
  // Aug 13: the community wall. Three rows, visions only, one garment once.
  out.wallRows = document.querySelectorAll('#community-scroller .community-row').length;
  const wallProbe = document.createElement('div');
  wallProbe.className = 'community-card';
  wallProbe.innerHTML = '<div class="cc-meta">details</div>';
  document.body.appendChild(wallProbe);
  const wallStyle = getComputedStyle(wallProbe);
  const metaStyle = getComputedStyle(wallProbe.querySelector('.cc-meta'));
  // v13.24: a wall card is a favorite card lying down. NOTHING white behind
  // the picture (that plate was the lit column Fromsa saw), the same 16px
  // starlight glass as a favorite, and details only on hover or focus.
  out.wallMatchesInspo = wallStyle.borderRadius === '16px' &&
    wallStyle.backgroundColor === 'rgba(0, 0, 0, 0)' &&
    !wallStyle.boxShadow.includes('38px') && metaStyle.position === 'absolute' && metaStyle.opacity === '0';
  const wallImg = document.createElement('img');
  wallImg.className = 'cc-img';
  wallProbe.appendChild(wallImg);
  // The frame follows the picture's own shape once it loads, so contain has
  // no empty space to letterbox. 3/2 is only the placeholder.
  const arProbe = getComputedStyle(wallImg).aspectRatio;
  out.wallTakesPictureShape = (arProbe === '3 / 2' || arProbe === 'auto 3 / 2') &&
    typeof communityBoard.fit === 'function';
  wallProbe.style.setProperty('--cc-ar', '2 / 3');
  out.wallShapeOverrides = getComputedStyle(wallImg).aspectRatio.includes('2 / 3');
  wallProbe.remove();
  // v13.29: top row right, middle left, bottom right.
  out.wallMovesLeftToRight = communityBoard._startDrift.toString().includes('[-26, 21, -31]');
  out.visionGate = [
    communityBoard._isVision({ kind: 'inspo', image: 'x', inspirationId: 'insp_a1', version: 1, generatedBy: 'gpt-image-2' }) === true,
    communityBoard._isVision({ kind: 'inspo', image: 'x', inspirationId: 'insp_a1', version: 1, generatedBy: 'gpt-image-1.5' }) === false,
    communityBoard._isVision({ kind: 'inspo', image: 'x', inspirationId: 'insp_legacy1', version: 1 }) === true,
    communityBoard._isVision({ kind: 'inspo', image: 'x' }) === false,          // upload
    communityBoard._isVision({ kind: 'text', inspirationId: 'insp_a1', version: 1, generatedBy: 'gpt-image-2' }) === false,
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
                _safeImgSrc('data:image/svg+xml,<svg></svg>') === '' &&
                _safeImgSrc('data:text/html;base64,abc') === '';
  out.noInlineWallClicks = !document.body.innerHTML.includes('communityBoard.openPost(\'');
  const hostile = _sanitizeSharedItem({ x: 9e9, y: -4, card: {
    kind: 'inspo', image: 'https://example.com/look.jpg',
    realism: '\"><img src=x onerror=alert(1)>',
    fabrics: [{ name: 'silk', dataUrl: "https://x/y');color:red" }],
    refs: Array.from({ length: 80 }, (_, i) => ({ title: 'r' + i })),
  }});
  out.shareSanitized = hostile && hostile.x === 10000 && hostile.y === 0 &&
    !hostile.card.realism && hostile.card.refs.length === 50 &&
    !hostile.card.fabrics[0].dataUrl;
  out.fabricSwitchCarriesContext = runFabricSwitch.length === 3 &&
    runFabricSwitch.toString().includes('_opStillValid(ctx)');
  out.voiceCarriesContext = processLiveBatch.toString().includes('const ctx = _opContext()') &&
    processLiveBatch.toString().includes('_opStillValid(ctx)');
  const oldSave = projectStore.save, oldReady = projectStore.ready;
  const oldId = projectStore.currentId, oldDirty = projectStore._dirty;
  projectStore.currentId = 'regression-project'; projectStore._dirty = true;
  projectStore.ready = () => true;
  projectStore.save = async () => ({ written: false, reason: 'stale' });
  out.staleFlushBlocked = (await projectStore.flush()) === false;
  projectStore.save = oldSave; projectStore.ready = oldReady;
  projectStore.currentId = oldId; projectStore._dirty = oldDirty;
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
ok('all core functions defined (' + (r.fnsMissing.join(',') || 'none missing') + ')', r.fnsMissing.length === 0);
ok('fabrics tabs present (Mana Siyo / My fabrics)', r.tabs);
ok('upload button reads "+ upload"', r.uploadText.trim() === '+ upload');
ok('upload chooser exists', r.chooser);
ok('Share is no longer a drawer-wide button', r.shareBtn);
ok('community wall has three rows', r.wallRows === 3);
ok('community cards use quiet inspo glass with hover-only info', r.wallMatchesInspo);
ok('wall frames take each picture\'s own shape (no lit columns)', r.wallTakesPictureShape);
ok('a taller picture reshapes its own frame', r.wallShapeOverrides);
ok('the wall rows alternate direction', r.wallMovesLeftToRight);
ok('only generated visions reach the wall', r.visionGate);
ok('the same garment fingerprints the same across accounts', r.fpMatches);
ok('different versions stay different visions', r.fpDiffers);
ok('picture gate blocks non https, non image addresses', r.imgGate);
ok('wall cards carry no inline click handlers', r.noInlineWallClicks);
ok('hostile shared cards are bounded and stripped', r.shareSanitized);
ok('Switch Fabric carries the initiating project context', r.fabricSwitchCarriesContext);
ok('voice extraction carries the initiating project context', r.voiceCarriesContext);
ok('stale revision blocks a destructive flush', r.staleFlushBlocked);
ok('community posts use the captured project id', INDEX_SOURCE.includes('pid: projectId'));
ok('update watchdog respects a cancelled sign out', INDEX_SOURCE.includes('canReload = (await window.mayaSignOut()) !== false'));
ok('project deletion batches wall posts before Storage cleanup',
  INDEX_SOURCE.indexOf('communityDocs.forEach(ref => batch.delete(ref))') < INDEX_SOURCE.indexOf('this._cleanupDeletedAssets(id, paths, uid)'));
ok('Storage cleanup is pinned to the deleting account',
  INDEX_SOURCE.includes('this._cleanupDeletedAssets(id, paths, uid)') &&
  INDEX_SOURCE.includes("firebase.storage().ref('users/' + uid + '/projects/' + projectId + '/images')"));
// v13.24 FIX: these four used to read projectStore, _cardState, communityBoard
// and scanFabricsFromAssets straight from Node, where they do not exist. The
// suite died with a ReferenceError before reaching the stack and Systems Map
// checks, so "static assertions pass" was never true of the whole file. Page
// globals must be read INSIDE the page.
const p = await pg.evaluate(() => ({
  savesPinned: projectStore.save.toString().includes('this.ownerUid') &&
    projectStore._commit.toString().includes("reason: 'auth-changed'") &&
    projectStore.uploadImage.toString().includes('this._uid() !== uid'),
  cardStateComplete: _cardState.toString().includes('c.height') &&
    _cardState.toString().includes('c.stacked') &&
    projectStore._sig.toString().includes('Math.round(s.x || 0)'),
  liveListener: communityBoard._listen.toString().includes('onSnapshot') &&
    !communityBoard.enter.toString().includes('setInterval'),
  fabricsLazy: scanFabricsFromAssets.toString().includes('window.location.origin') &&
    !scanFabricsFromAssets.toString().includes('FileReader'),
}));
ok('queued project saves are pinned to their starting account',
  p.savesPinned && INDEX_SOURCE.includes('await firebase.auth().signOut()'));
ok('legacy recovery is idempotent and deletion blocks its source',
  INDEX_SOURCE.includes('dead.has(id) || recovered.has(id)') &&
  INDEX_SOURCE.includes("batch.set(this._tombs().doc(legacySource)"));
ok('remote equality covers complete visible card state', p.cardStateComplete);
ok('share rules bound the item list and schema',
  RULES_SOURCE.includes('request.resource.data.items.size() <= 200') && RULES_SOURCE.includes("request.resource.data.schema == 'v13.15'"));
ok('wall updates cannot move a post between projects',
  RULES_SOURCE.includes('request.resource.data.pid == resource.data.pid'));
ok('new wall posts require GPT Image 2 provenance',
  RULES_SOURCE.includes("request.resource.data.model == 'gpt-image-2'") &&
  INDEX_SOURCE.includes("model: card.generatedBy || 'gpt-image-2'"));
ok('community uses a live listener instead of polling', p.liveListener);
ok('fabric library is lazy and URL-backed',
  !INDEX_SOURCE.includes('[Maya fabric preload]') && p.fabricsLazy);
ok('OpenAI proxy bounds input, time, and response memory',
  SERVER_SOURCE.includes("limit: '24mb'") &&
  SERVER_SOURCE.includes('AbortSignal.timeout(285000)') &&
  SERVER_SOURCE.includes('Readable.fromWeb(upstream.body)'));
// v13.27 replaces the Drive-era version of this check: every call into the
// submission store is time bounded, and deep health names which way it failed.
ok('submission store calls time out and deep health names the cause',
  SERVER_SOURCE.includes("timedOut ? 'submissions_timeout'") &&
  SERVER_SOURCE.includes('signal: AbortSignal.timeout(60000)') &&
  SERVER_SOURCE.includes('signal: AbortSignal.timeout(15000)') &&
  SERVER_SOURCE.includes("out.detail = 'submissions_' + r.status"));
ok('only maya-v2 may deploy production',
  BUILD_SOURCE.includes('test "$BRANCH_NAME" = "maya-v2"'));
ok('My Fabrics deletion survives failed Storage cleanup',
  INDEX_SOURCE.includes('cleanupPaths: _myFabricCleanupPaths.slice(0, 100)') &&
  INDEX_SOURCE.includes('if (f.path) await _drainMyFabricCleanup(uid)'));
ok('Favorites animates opacity, not box-shadow',
  INDEX_SOURCE.includes('body.viewing-favorites .favorite-card::after') &&
  INDEX_SOURCE.includes('will-change: opacity') && !FAVORITE_PULSE_SOURCE.includes('box-shadow'));
ok('stack puts the LATEST version on top', r.stackLatestOnTop);
ok('stack offsets are 15px (30 percent tighter)', r.stackStep === 15);
ok('stacked flags set (whole stack drags as one)', r.stackFlags);
ok('stack button toggles, positions restored', r.unstackRestores);
ok('drag class churn cannot replay the entry fade', r.noFadeReplay);

await pg.goto(PAGE_ROOT + AT.status, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
const s = await pg.evaluate(() => ({
  order: [...document.querySelectorAll('details.fold')].map(d => d.id).join(','),
  archFold: (document.getElementById('arch-fold') || {}).tagName === 'DETAILS',
  arrows: document.querySelectorAll('.card .go').length,
  warnBanner: !!document.querySelector('.warn'),
  footerFolds: document.querySelectorAll('.map-footer details.fold').length,
  doorSizes: new Set([...document.querySelectorAll('.grid.doors .card b')]
    .map(el => getComputedStyle(el).fontSize)).size,
  healthUsesTimeouts: runChecks.toString().includes('_statusFetch'),
  lights: [...document.querySelectorAll('.lgt-lbl')].map(e => e.textContent).join(','),
  // v13.28: the credit ring. It must exist, stay hidden until there are
  // numbers, and paint the right arc for a given percentage.
  creditHiddenAtRest: document.getElementById('credit-row').classList.contains('hidden'),
  thumbnailsParallel: _paintThumbs.toString().includes('Promise.all'),
  tokenRefreshesHealth: _adoptToken.toString().includes('runChecks()'),
}));
// v13.26: the map speaks about SUBMISSIONS, not Google plumbing.
// v13.32: the privacy policy. It has to exist, be reachable BEFORE anyone
// signs in, and keep saying the things that are legally load bearing.
const PRIVACY_SOURCE = existsSync(join(ROOT, AT.privacy))
  ? readFileSync(join(ROOT, AT.privacy), 'utf8') : '';
ok('the privacy policy ships as a page', PRIVACY_SOURCE.includes('<h1>Privacy policy</h1>'));
ok('the policy still names the sensitive things',
  ['face photograph', 'community wall', 'OpenAI', 'Pinterest', 'Measurements', 'Deleting things']
    .every(t => PRIVACY_SOURCE.includes(t)));
ok('the policy still says how to be erased and how to reach a human',
  PRIVACY_SOURCE.includes('mailto:worldofsiyo@gmail.com') &&
  PRIVACY_SOURCE.includes('erased'));
ok('it is reachable before signing in, and from the drawer',
  INDEX_SOURCE.includes('href="/privacy.html"') &&
  INDEX_SOURCE.split('href="/privacy.html"').length - 1 >= 2);

// v13.31: pictures from elsewhere, and Pinterest.
ok('a picture can be fetched from any site, but never from inside the network',
  SERVER_SOURCE.includes("app.get('/api/fetchpic'") &&
  SERVER_SOURCE.includes('function isPrivateAddress(ip)') &&
  SERVER_SOURCE.includes('await dns.lookup(target.hostname') &&
  SERVER_SOURCE.includes("redirect: 'error'") &&
  SERVER_SOURCE.includes("p[0] === 169 && p[1] === 254"));
ok('the fetched picture must actually be a picture, and bounded',
  SERVER_SOURCE.includes('FETCHPIC_MAX') && SERVER_SOURCE.includes("!/^image\\//.test(type)"));
ok('Pinterest is server side only: the browser never sees the secret',
  SERVER_SOURCE.includes('PINTEREST_APP_SECRET') && SERVER_SOURCE.includes('pinBasic()') &&
  !INDEX_SOURCE.includes('PINTEREST_APP_SECRET') && !INDEX_SOURCE.includes('api.pinterest.com/v5/oauth'));
ok('the Pinterest callback trusts a signed state, not a query parameter',
  SERVER_SOURCE.includes('function pinState(uid)') &&
  SERVER_SOURCE.includes('crypto.timingSafeEqual') &&
  SERVER_SOURCE.includes("20 * 60 * 1000"));
ok('a Pinterest token is stored per account and can be forgotten',
  SERVER_SOURCE.includes("const PIN_PREFIX     = 'pinterest/'") &&
  SERVER_SOURCE.includes('async function pinForget(uid)') &&
  SERVER_SOURCE.includes("app.post('/api/pinterest/disconnect'"));
ok('the Pinterest door is always there, and falls back to pasted addresses',
  INDEX_SOURCE.includes('async function _pinRevealButton()') &&
  !INDEX_SOURCE.includes('>From a link<') &&
  INDEX_SOURCE.includes("closePinterest();openLinkImport()"));
ok('a Pinterest import is capped at six and goes through the same copy path',
  INDEX_SOURCE.includes('const PIN_PICK_MAX = 6;') &&
  INDEX_SOURCE.includes('await importPictureFromUrl(p.url, p.alt)'));
ok('pasted and dragged links import as inspo, six at a time',
  INDEX_SOURCE.includes('const LINK_IMPORT_MAX = 6;') &&
  INDEX_SOURCE.includes("_linksFromText(dropped)") &&
  INDEX_SOURCE.includes("e.dataTransfer.getData('text/uri-list')"));

// v13.30: the folder layout. The repo root IS the published website, so the
// served pages must be at the root and the notes must NOT be, and the hosting
// ignore list has to match. A tidy that breaks the deploy is not a tidy.
ok('every served page exists where the hosting map says it does',
  [AT.index, AT.status, AT.backend, AT.marketing, AT.privacy, AT.verify, 'backend/operations.html']
    .every(f => existsSync(join(ROOT, f))));
ok('the notes moved into docs and are not at the root',
  existsSync(join(ROOT, 'docs/README.md')) && existsSync(join(ROOT, 'docs/requests.txt')) &&
  existsSync(join(ROOT, 'docs/fixes.txt')) && existsSync(join(ROOT, 'docs/history.txt')) &&
  !existsSync(join(ROOT, 'README.md')) && !existsSync(join(ROOT, 'requests.txt')));
ok('the build still finds what it needs at the root',
  existsSync(join(ROOT, 'cloudbuild.yaml')) && existsSync(join(ROOT, 'CLAUDE.md')) &&
  existsSync(join(ROOT, 'AGENTS.md')) && existsSync(join(ROOT, 'tests')));
ok('hosting publishes the pages and hides everything else', (() => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'docs/firebase.json'), 'utf8'));
  const ig = cfg.hosting.ignore;
  return cfg.hosting.public === '.' && ig.includes('docs/**') && ig.includes('tests/**') &&
    ig.includes('**/.*') && !ig.some(p => /^(index|status|backend|operations|verify)\.html$/.test(p));
})());

// v13.29: the share fix Fromsa's friend hit. A share must carry COPIES of its
// pictures, readable by whoever opens the link, and one unreadable picture must
// not kill the whole import.
ok('a share copies its pictures somewhere the recipient may read',
  INDEX_SOURCE.includes("const _shareDir = 'shares/' + _uid + '/' + token + '/'") &&
  INDEX_SOURCE.includes('const _publish = async (src, key)') &&
  STORAGE_RULES.includes('match /shares/{uid}/{token}/{allPaths=**}') &&
  /match \/shares\/\{uid\}[\s\S]{0,200}?allow read: if request\.auth != null;/.test(STORAGE_RULES));
ok('one unreadable picture drops that picture, not the import',
  INDEX_SOURCE.includes('let _missed = 0;') &&
  INDEX_SOURCE.includes("console.warn('[share open] picture skipped,'"));
ok('revoking a share takes its copied pictures with it',
  INDEX_SOURCE.includes("paths.push('shares/' + uid + '/' + t + '/')") &&
  INDEX_SOURCE.includes("const sharePrefix = 'shares/' + uid + '/'"));
ok('Share belongs to a project, not to whatever is open',
  INDEX_SOURCE.includes('async function shareProjectById(id)') &&
  INDEX_SOURCE.includes('class="session-item-share"') &&
  !INDEX_SOURCE.includes('onclick="shareCurrentProject()"'));
ok('Save, New and Clean are gone; Fabrics and Pinterest share the row',
  !INDEX_SOURCE.includes('id="save-session-btn" class=') &&
  !INDEX_SOURCE.includes('onclick="cleanReferences()"') &&
  !INDEX_SOURCE.includes('title="Start a new project">New<') &&
  INDEX_SOURCE.includes('onclick="openFabricsDrawer()"') &&
  INDEX_SOURCE.includes('onclick="openPinterestDrawer()"'));
ok('notes belong to the vision on screen, not to the drawer',
  INDEX_SOURCE.includes('function renderViewerNotes(item)') &&
  INDEX_SOURCE.includes('renderViewerNotes(item);') &&
  !INDEX_SOURCE.includes('<summary>Design notes</summary>') &&
  !INDEX_SOURCE.includes('nothing captured yet'));
ok('the wall rolls right, left, right',
  INDEX_SOURCE.includes('const SPEEDS = [-26, 21, -31];'));
ok('deleting a project no longer says "everywhere"',
  !INDEX_SOURCE.includes('Project deleted everywhere') &&
  INDEX_SOURCE.includes("'Project deleted'"));
ok('the copy is short where Fromsa reads it most',
  INDEX_SOURCE.includes('>Choose your favorite</h2>') &&
  INDEX_SOURCE.includes('>Up to three.</div>') &&
  !INDEX_SOURCE.includes('Select up to three.'));
ok('the meter can report REAL OpenAI spend when an admin key is set',
  SERVER_SOURCE.includes('OPENAI_ADMIN_KEY') &&
  SERVER_SOURCE.includes('/v1/organization/costs?') &&
  SERVER_SOURCE.includes('OPENAI_CREDIT_USD') &&
  SERVER_SOURCE.includes("estimated: real === null"));
ok('the map says whether the number came from OpenAI or from MAYA',
  MAP_SOURCE.includes("d.estimated") && MAP_SOURCE.includes("'from OpenAI, $'") &&
  MAP_SOURCE.includes("'estimated by MAYA, $'"));
ok('submission cards cannot clip on hover',
  MAP_SOURCE.includes('#subs-strip{display:flex;gap:12px;overflow-x:auto;padding:10px 28px 12px;') &&
  MAP_SOURCE.includes('.sub-tile:hover{border-color:rgba(255,255,255,0.55);transform:scale(1.012)'));
ok('lights paint as each answer lands', MAP_SOURCE.includes("setDot('d-assets', a[0] && a[1] ? 'ok' : 'bad')"));

// v13.28: the credit meter. The ring paints from pctLeft, sits under LIVE NOW,
// and never claims to be a real balance.
const credit = await pg.evaluate(async () => {
  (0, eval)("_idTok = 'fake'");
  (0, eval)("_statusFetch = async () => ({ok:true,status:200,json:async()=>({ok:true,estimated:false," +
    "month:'2026-08',since:'2026-08-14',hasTopUp:true,spentUsd:5.31,budgetUsd:10,fundedUsd:10," +
    "remainingUsd:4.69,pctLeft:47,calls:96,images:34})})");
  await loadCredit();
  const ring = document.getElementById('credit-ring');
  const arc = ring.querySelector('.cr-arc');
  // The tiles are empty in a headless boot, so stand one up: a hidden row has
  // no geometry to line the ring up against.
  const tiles = document.getElementById('traffic-tiles');
  tiles.innerHTML = '<div class="tile live"><div class="k">live now</div><div class="v">1</div></div>';
  tiles.classList.remove('hidden');
  return {
    shown: !document.getElementById('credit-row').classList.contains('hidden'),
    pct: ring.querySelector('.cr-pct').textContent,
    amount: document.querySelector('#credit-side .cr-amt').textContent,
    sub: document.querySelector('#credit-side .cr-sub').textContent,
    offset: Number(arc.style.strokeDashoffset),
    circumference: Number(arc.style.strokeDasharray),
    leftAligned: Math.abs(ring.getBoundingClientRect().left - tiles.getBoundingClientRect().left) < 2,
  };
});
ok('the credit ring stays hidden until there are numbers', s.creditHiddenAtRest);
ok('the credit ring paints the right arc for 47 percent',
  credit.shown && credit.pct === '47%' &&
  Math.abs(credit.offset - credit.circumference * 0.53) < 1);
ok('the credit ring shows the money left and names its source',
  credit.amount === '$4.69 left of $10.00' && credit.sub.startsWith('from OpenAI,'));
ok('the credit ring sits under the LIVE NOW tile', credit.leftAligned);
ok('the meter is admin only and counts every successful call',
  SERVER_SOURCE.includes("app.get('/api/admin/spend'") &&
  SERVER_SOURCE.includes('await requireAdmin(req)') &&
  SERVER_SOURCE.includes('noteSpend(upstreamPath, req)'));
ok('each instance owns its own tally object, so none overwrite the others',
  SERVER_SOURCE.includes("METRICS_PREFIX + _spend.month + '/' + INSTANCE_ID") &&
  SERVER_SOURCE.includes("n.endsWith('/' + INSTANCE_ID + '.json')"));
ok('an image costs more of the budget than a chat call',
  SERVER_SOURCE.includes('OPENAI_PRICE_IMAGE') && SERVER_SOURCE.includes('PRICE_IMAGE * 0.25') &&
  SERVER_SOURCE.includes('MONTHLY_BUDGET_USD'));

ok('the map light reads Submissions', s.lights.includes('Submissions') && !s.lights.includes('Drive'));

ok('Systems Map order: traffic and marketing, changes, prompting, architecture',
  s.order === 'traffic-fold,changes-fold,pe-fold,arch-fold');
ok('Architecture is collapsible', s.archFold);
ok('door cards have no arrows', s.arrows === 0);
ok('"Never delete" banner removed', !s.warnBanner);
ok('folds live in the bottom footer', s.footerFolds === 3);
ok('all door texts share one font size', s.doorSizes === 1);
ok('Systems Map checks have request timeouts', s.healthUsesTimeouts);
ok('submission thumbnails load in parallel', s.thumbnailsParallel);
ok('sign in immediately refreshes deep health', s.tokenRefreshesHealth);

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
await pg.goto(PAGE_ROOT + AT.index, { waitUntil: 'domcontentloaded' });
await pg.evaluate(() => {
  localStorage.setItem('maya_google_token', 'FAKE.TOKEN.x');
  localStorage.setItem('maya_seen_version_app', '0.0');
});
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1500);
const appLoggedOut = await pg.evaluate(() => localStorage.getItem('maya_google_token') === null);
ok('app: version change clears the cached sign in', appLoggedOut);

// v13.27: submissions moved out of Google Drive into MAYA's own bucket. No
// OAuth refresh token anywhere in the server, one prefix per submission, and
// every read path locked to a file directly inside a submission.
ok('no OAuth refresh token remains in the server',
  !SERVER_SOURCE.includes('GOOGLE_OAUTH_REFRESH_TOKEN') &&
  !SERVER_SOURCE.includes('getDriveAccessToken') &&
  !SERVER_SOURCE.includes('DRIVE_FOLDER_ID'));
ok('the submission store is MAYA\'s own bucket, reached with the service identity',
  SERVER_SOURCE.includes("const SUB_PREFIX = 'submissions/'") &&
  SERVER_SOURCE.includes('serviceToken(STORAGE_SCOPE)') &&
  SERVER_SOURCE.includes('metadata.google.internal'));
ok('a submission read cannot escape its own submission',
  SERVER_SOURCE.includes('function idToPath(id)') &&
  SERVER_SOURCE.includes("!p.startsWith(SUB_PREFIX) || p.includes('..')") &&
  SERVER_SOURCE.includes('rest.length !== 2'));
ok('the whole feed is one storage request, not one per submission',
  SERVER_SOURCE.includes('async function gcsListSubmissions()') &&
  SERVER_SOURCE.includes("maxResults: '1000'"));
ok('deep health asks the submission store, and says so',
  SERVER_SOURCE.includes('submissions: false, drive: false') &&
  SERVER_SOURCE.includes('out.ok = out.openai && out.submissions'));
ok('the map reads the new health field and stops linking to Drive',
  MAP_SOURCE.includes('(j.submissions===true)||(j.drive===true)') &&
  !MAP_SOURCE.includes('drive.google.com'));
ok('the Brief no longer paints from a public Drive thumbnail',
  !BACKEND_SOURCE.includes('drive.google.com/thumbnail'));

// v13.26: the picture-read fix. A saved project's card picture is a Storage
// address; the browser draws it but will not let script read it without CORS on
// the bucket, which is why every Visualize died as "connection hiccup". Every
// place that reads a picture's bytes must go through blobFromPicture, and the
// server must offer the same-origin fallback, host-locked.
// The only two raw reads left in the file are the helper's own two branches.
const RAW_PICTURE_READS = INDEX_SOURCE.split('await (await fetch(src)).blob()').length - 1;
ok('every stored picture is read through the one helper',
  INDEX_SOURCE.includes('async function blobFromPicture(src)') &&
  INDEX_SOURCE.includes('const rawBlob = await blobFromPicture(src);') &&
  RAW_PICTURE_READS === 2 &&
  !INDEX_SOURCE.includes('await (await fetch(it.card.image)).blob()') &&
  !INDEX_SOURCE.includes('await (await fetch(videoUrl)).blob()') &&
  !INDEX_SOURCE.includes('await (await fetch(lastOnePagerImage)).blob()'));
ok('the helper falls back to MAYA\'s own server',
  INDEX_SOURCE.includes("'/api/imgproxy?u=' + encodeURIComponent(src)"));
ok('the picture proxy is signed in, host locked and size capped',
  SERVER_SOURCE.includes("app.get('/api/imgproxy', requireAuthHeader") &&
  SERVER_SOURCE.includes('IMGPROXY_HOSTS.has(target.hostname)') &&
  SERVER_SOURCE.includes("redirect: 'error'") &&
  SERVER_SOURCE.includes('IMGPROXY_MAX'));
ok('the proxy refuses anything that is not a picture',
  SERVER_SOURCE.includes("!/^image\\/|^video\\//.test(type)"));

// v13.25: the deploy check page. Fromsa's Mac has no Node, so /verify.html is
// the only verifier he can actually run. It must exist, must ask deep health
// with the borrowed Systems Map token, and must never render that token.
const VERIFY_SOURCE = existsSync(join(ROOT, AT.verify))
  ? readFileSync(join(ROOT, AT.verify), 'utf8') : '';
ok('deploy check page ships', VERIFY_SOURCE.includes('MAYA Deploy Check'));
ok('deploy check asks the real Drive question',
  VERIFY_SOURCE.includes("localStorage.getItem('maya_admin_tok')") &&
  VERIFY_SOURCE.includes('/api/healthz/deep'));
ok('deploy check never prints the sign in token',
  !/textContent\s*=\s*tok/.test(VERIFY_SOURCE) && !VERIFY_SOURCE.includes('innerHTML = tok'));


// ── v13.33, Aug 19 ─────────────────────────────────────────────────────────
ok('the wall drifts with a transform, not the scroll position',
  INDEX_SOURCE.includes('.community-track {') &&
  INDEX_SOURCE.includes("row.track.style.transform = 'translate3d('") &&
  !INDEX_SOURCE.includes('el.scrollLeft = row.pos;'));
ok('a short row loops too, so the third row is never still',
  INDEX_SOURCE.includes('track.scrollWidth >= el.clientWidth + row.period + 20') &&
  !INDEX_SOURCE.includes('if (el.scrollWidth - el.clientWidth < 40) continue;'));
ok('Settings is gone from the drawer, Tip, Logout and Privacy stay',
  !INDEX_SOURCE.includes('title="Account &amp; preferences">Settings<') &&
  INDEX_SOURCE.includes('onclick="openTip()"') &&
  INDEX_SOURCE.includes('onclick="mayaSignOut()"') &&
  INDEX_SOURCE.includes('href="/privacy.html"'));
ok('the notes column carries this version, and only this version',
  INDEX_SOURCE.includes("groups.push({ t: 'Asked for, this version'") &&
  INDEX_SOURCE.includes('id="viewer-notes"') &&
  INDEX_SOURCE.includes('mods: Array.isArray(mods) ? mods.slice(0, 12) : null,'));

// ── v13.36, Aug 21 ─────────────────────────────────────────────────────────
ok('the drawer says avatar, and projects make their own new one',
  INDEX_SOURCE.includes('+ New avatar') && !INDEX_SOURCE.includes('+ New client') &&
  INDEX_SOURCE.includes('session-item-new') && INDEX_SOURCE.includes('_NEW_PROJECT_ROW'));
ok('the card count and the privacy underline are gone',
  INDEX_SOURCE.includes('id="item-count" style="display:none"') &&
  INDEX_SOURCE.includes('#notes-drawer a.drawer-settings-link { text-decoration: none; }'));
ok('the heart lives on the picture, the favorites pill does not exist',
  INDEX_SOURCE.includes('class="viewer-heart"') &&
  INDEX_SOURCE.includes('function viewerToggleHeart()') &&
  !INDEX_SOURCE.includes('id="modify-primary"') &&
  !INDEX_SOURCE.includes("sec.textContent  = isFav ? 'Remove from Favorites'"));
ok('the three ways to change a vision are one tap, Submit appears above them',
  INDEX_SOURCE.includes('function _refreshSubmitReady()') &&
  INDEX_SOURCE.includes('#garment-modal.can-submit #viewer-row-modify-2 { display: flex; }') &&
  INDEX_SOURCE.indexOf('id="viewer-row-modify-2"') < INDEX_SOURCE.indexOf('id="viewer-row-modify-1"'));
ok('Pinterest is a drawer in the same language as Fabrics',
  INDEX_SOURCE.includes('id="pinterest-drawer"') &&
  INDEX_SOURCE.includes('function setPinterestTab(tab)') &&
  INDEX_SOURCE.includes('>All saves<') && INDEX_SOURCE.includes('>Boards<') &&
  INDEX_SOURCE.includes('openPinterestDrawer()'));
ok('all saves means every pin on the account, not just one board',
  SERVER_SOURCE.includes("const path = board ? ('/boards/' + board + '/pins?'") &&
  SERVER_SOURCE.includes("('/pins?' + qs.toString())"));
ok('the upload button is brighter and the chooser sits lower',
  INDEX_SOURCE.includes('color: rgba(200,210,230,0.36)') &&
  INDEX_SOURCE.includes('padding-bottom: 92px;'));
ok('the share popup says Copy to clipboard and really copies',
  INDEX_SOURCE.includes('>Copy to clipboard<') &&
  INDEX_SOURCE.includes('function _copyToClipboard(text)') &&
  INDEX_SOURCE.includes("document.execCommand && document.execCommand('copy')"));
ok('Escape closes the share popup and the fabrics drawer',
  INDEX_SOURCE.includes("if (_share && _share.classList.contains('open')) { closeShareModal(); return; }") &&
  INDEX_SOURCE.includes("_fd.classList.contains('open') && typeof closeFabricsDrawer === 'function'"));
ok('a submission always carries its picture, whatever form it is in',
  INDEX_SOURCE.includes('async function _dreamGarmentBytes(src)') &&
  INDEX_SOURCE.includes('const dg = await _dreamGarmentBytes(lastOnePagerImage);') &&
  INDEX_SOURCE.includes('_sendSubmissionFile(token, folder_id, f)'));
ok('the map stops saying arriving once the picture clearly is not coming',
  MAP_SOURCE.includes('const ARRIVING_MS = 3 * 60 * 1000;') &&
  MAP_SOURCE.includes("'no picture'") &&
  MAP_SOURCE.includes(".badge:not(.stale)"));
ok('the map headlines live now and unique users',
  MAP_SOURCE.includes('function _paintHeadTiles(d)') &&
  MAP_SOURCE.includes('>users<') &&
  MAP_SOURCE.includes('id="traffic-fold"'));
ok('the map hamburger links the privacy policy',
  MAP_SOURCE.includes('<a href="/privacy.html" target="_blank">Privacy policy'));
ok('unique accounts are counted by MAYA itself',
  SERVER_SOURCE.includes("const USERS_PREFIX = 'metrics/users/'") &&
  SERVER_SOURCE.includes('function noteUser(sub)') &&
  SERVER_SOURCE.includes('async function countUsers()') &&
  SERVER_SOURCE.includes('accounts: accounts || null'));
ok('the credit ring counts from the day the money was loaded',
  SERVER_SOURCE.includes('async function openAiCostSince(startSec)') &&
  SERVER_SOURCE.includes('fundedUsd') &&
  SERVER_SOURCE.includes("const CREDIT_DOC = 'metrics/credit.json'") &&
  SERVER_SOURCE.includes("app.post('/api/admin/credit'") &&
  MAP_SOURCE.includes('function saveTopUp()') &&
  MAP_SOURCE.includes('id="topup"'));

// ── v13.34, Aug 20 ─────────────────────────────────────────────────────────
const MKT_SOURCE = existsSync(join(ROOT, AT.marketing))
  ? readFileSync(join(ROOT, AT.marketing), 'utf8') : '';
ok('the fourth door is Marketing', MAP_SOURCE.includes('href="/marketing.html"') &&
  MAP_SOURCE.includes('grid-template-columns:repeat(4,1fr)'));
ok('the marketing page ships and signs in like the map',
  MKT_SOURCE.includes('MAYA Marketing') &&
  MKT_SOURCE.includes("localStorage.getItem('maya_admin_tok')") &&
  MKT_SOURCE.includes('/api/admin/marketing'));
ok('the marketing page never invents an ad number',
  MKT_SOURCE.includes("'Not connected. '") && MKT_SOURCE.includes('function paintAds('));
ok('marketing reads Analytics, Meta and Google Ads separately',
  SERVER_SOURCE.includes("app.get('/api/admin/marketing'") &&
  SERVER_SOURCE.includes('async function metaInsights()') &&
  SERVER_SOURCE.includes('async function googleAdsInsights()') &&
  SERVER_SOURCE.includes('MARKETING_GA_PROPERTY_ID'));
ok('traffic and marketing share one fold, loaded only when opened',
  !MAP_SOURCE.includes('id="marketing-fold"') &&
  MAP_SOURCE.includes('<h2 class="grp">Traffic and marketing</h2>') &&
  MAP_SOURCE.includes('async function loadMarketing()') &&
  MAP_SOURCE.includes('if(this.open)loadMarketing()'));

// ── v13.35, Aug 20 ─────────────────────────────────────────────────────────
ok('only the logo, the wordmark and the menu are pinned',
  MAP_SOURCE.includes('#top-lights{display:flex') &&
  !/id="top-bar"[\s\S]{0,900}id="top-lights"/.test(MAP_SOURCE));
ok('the logo goes home to the Systems Map',
  MAP_SOURCE.includes('<a href="/status.html"') &&
  MKT_SOURCE.includes('<a href="/status.html"') &&
  BACKEND_SOURCE.includes('<a href="/status.html"'));
ok('one heading, Users, with four numbers under it',
  MAP_SOURCE.includes('<h2 class="grp">Users</h2>') &&
  !MAP_SOURCE.includes('Who is here') &&
  MAP_SOURCE.includes(">users<") && MAP_SOURCE.includes('>today<') && MAP_SOURCE.includes('>7 days<'));


// ── v13.37, the folder ─────────────────────────────────────────────────────
// A tidy folder that breaks the website is not tidy. Every page that had a URL
// before must still answer on that URL, which is what these check.
const _rw = (HOSTING.hosting.rewrites || []);
const _dest = (src) => (_rw.find(r => r.source === src) || {}).destination;
ok('every page still answers on the address it always had',
  _dest('/status.html') === '/backend/status.html' &&
  _dest('/marketing.html') === '/backend/marketing.html' &&
  _dest('/operations.html') === '/backend/operations.html' &&
  _dest('/backend.html') === '/backend/backend.html' &&
  _dest('/privacy.html') === '/backend/privacy.html' &&
  _dest('/verify.html') === '/backend/verify.html');
ok('the app is still what the front door serves',
  (_rw[_rw.length - 1] || {}).source === '**' &&
  (_rw[_rw.length - 1] || {}).destination === '/frontend/index.html');
ok('the API rewrite still comes first', (_rw[0] || {}).source === '/api/**' && !!(_rw[0] || {}).run);
ok('pictures still deploy: aesthetics is not inside the ignored folder',
  existsSync(join(ROOT, 'aesthetics')) &&
  !(HOSTING.hosting.ignore || []).some(g => g === 'aesthetics/**'));
ok('the handoff lives where both agents look',
  existsSync(join(ROOT, 'AGENTS.md')) && existsSync(join(ROOT, 'CLAUDE.md')) &&
  readFileSync(join(ROOT, 'AGENTS.md'), 'utf8').includes('frontend/index.html') &&
  readFileSync(join(ROOT, 'AGENTS.md'), 'utf8').includes('backend/status.html'));

await browser.close(); if (served) srv.close();
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
