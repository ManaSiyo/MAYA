import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const admin = read('backend/status.html');
const marketing = read('backend/marketing.html');
const app = read('frontend/index.html');
const playground = read('playground/index.html');

let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); passed++; }
  catch (error) { console.log('  FAIL ' + name + ': ' + error.message); failed++; }
};

console.log('\nMAYA Admin UI contract\n');

await test('standalone Marketing remains served as its own complete fallback', () => {
  for (const token of ['id="ticker"', 'id="visitors-fold"', 'id="campaigns-table"',
    'id="ad-chart"', 'id="leads-table"', 'id="sources-table"', 'id="bottom-fold"']) {
    assert.ok(marketing.includes(token), token);
  }
});

await test('Admin embeds every approved Marketing surface under its shell', () => {
  // v13.72: the duplicate Manasiyo.com|MAYA visitor fold was removed from Admin
  // (Users and traffic already pairs both), but its Wix holders remain so the
  // paint stays safe.
  for (const token of ['id="mkt-ticker"', 'id="mkt-wix-tiles"',
    'id="campaigns-table"', 'id="ad-chart"', 'id="leads-table"',
    'id="sources-table"', 'id="bottom-fold"']) assert.ok(admin.includes(token), token);
  assert.ok(!admin.includes('id="visitors-fold"'), 'visitors-fold removed from Admin');
});

await test('Admin keeps Marketing spacing, table, folds, ticker and chart hover behavior', () => {
  assert.match(admin, /#adm-mkt \.panel\{[^}]*border-radius:18px[^}]*padding:16px 18px/);
  assert.match(admin, /#adm-mkt table\{width:100%/);
  assert.ok(admin.includes('#adm-mkt details.fold:not([open]) summary::after'));
  assert.ok(admin.includes('function bindChartHover('));
  assert.ok(admin.includes("addEventListener('touchmove'"));
  assert.ok(admin.includes('function buildTicker('));
  assert.ok(admin.includes('function paintVisitors('));
});

await test('Admin refresh and command actions fail visibly and writes wait for confirmation', () => {
  assert.ok(admin.includes('Existing numbers remain on screen'));
  assert.ok(admin.includes('r.status===401'));
  assert.ok(admin.includes('id="maya-action-queue"'));
  assert.ok(admin.includes("yes.onclick=()=>mayaConfirmAction(action.id)"));
  assert.ok(admin.includes('output:JSON.stringify(modelOut)'));
});

await test('the approved filing cabinet is promoted without removing Playground', () => {
  for (const source of [app, playground]) {
    for (const token of ['class="pg-tabrow"', 'id="pg-folder"', 'id="pg-pane-fabrics"',
      'id="pg-pane-pinterest"', 'function pgShow(', 'fabPane.appendChild(fab)',
      'pinPane.appendChild(pin)']) assert.ok(source.includes(token), token);
  }
  assert.ok(playground.includes('>Playground</div>'));
});

await test('all four release surfaces carry v13.99', () => {
  const version = source => (source.match(/name="maya-version" content="([0-9.]+)"/) || [])[1];
  assert.deepEqual([app, playground, admin, marketing].map(version), ['13.99', '13.99', '13.99', '13.99']);
});

await test('v13.99 drawer floor: circular logo, Hey Maya toggle beside it', () => {
  assert.ok(admin.includes('logo-circle.png'), 'circular logo file referenced');
  assert.ok(admin.includes('id="maya-toggle"'), 'toggle pill present');
  assert.ok(admin.includes('onclick="toggleWakeWord()"'), 'pill toggles the Hey Maya wake word');
  assert.ok(admin.includes("mtw.textContent=_wakeWantOn?'Turn off Hey Maya':'Turn on Hey Maya'"),
    'pill reads Turn on/off Hey Maya');
  assert.ok(admin.includes('class="voice-row"'), 'toggle rides beside the logo');
});

await test('v13.99 admin drawer: full-bleed, sheet-only hover, glued hamburger, one-click invoice', () => {
  assert.match(admin, /#drawer\{position:absolute;inset:0/, 'drawer is full-bleed, not an inset card');
  // the ADMIN wordmark's own chip strip carries only the sheet (the MAYA door
  // card keeps its separate rooms)
  const chips = admin.slice(admin.indexOf('class="brand-chips"'), admin.indexOf('class="brand-chips"') + 400);
  assert.ok(!chips.includes('>operations room<'), 'ADMIN hover: operations room gone');
  assert.ok(!chips.includes('>playground<'), 'ADMIN hover: playground gone');
  assert.ok(chips.includes('>the sheet</a>'), 'ADMIN hover: the sheet stays');
  assert.ok(admin.includes("hb.style.transform = 'translateX(' + (-Math.max(0, hs.scrollLeft - 18))"),
    'hamburger glued to the drawer edge per frame');
  assert.ok(!admin.includes('translateX(-356px)'), 'old CSS-transition slide removed');
  assert.ok(admin.includes('function _createInvoiceNow'), 'one-click invoice in the composer');
});

await test('v13.99 Lead Station: no Invoice columns, Last Quote, draggable columns', () => {
  assert.ok(!/'<th[^>]*>Invoice 1<\/th>'|>Invoice 1</.test(admin), 'Invoice 1 column removed');
  assert.ok(!admin.includes("label: 'Invoice"), 'no invoice column def');
  assert.ok(admin.includes("label: 'Last Quote'"), 'Quote renamed to Last Quote');
  assert.ok(admin.includes('_leadColDragStart'), 'columns are draggable');
  assert.ok(admin.includes('lead-col-first'), 'first column stays frozen');
  assert.ok(!admin.includes("'<div class=\"lead-when\">"), 'day-count line under the name removed');
});

await test('v13.99 Actions: email, phone, pay-link only; invoicing wired', () => {
  assert.ok(admin.includes('function _actionsCell'), 'actions cell builder');
  assert.ok(admin.includes('function leadInvoice'), 'invoice composer');
  assert.ok(admin.includes('lead-inv-modal'), 'invoice modal');
  assert.ok(!/lead-rec">'\s*\+\s*rec\(x\)/.test(admin), 'recommendation text dropped from actions');
});

await test('v13.99 the admin auto-refreshes on a new deploy (no more stale tab)', () => {
  assert.ok(admin.includes('function checkAdminUpdate'), 'admin has an update poller');
  assert.ok(admin.includes("fetch('/status.html?uv='"), 'poller fetches the live version');
  assert.ok(admin.includes('setInterval(checkAdminUpdate'), 'poller runs on an interval');
  assert.ok(admin.includes('<b>Aug 27</b>'), 'recent changes list is current');
});

console.log('\n' + (failed ? failed + ' FAILED' : passed + ' passed') + '\n');
process.exit(failed ? 1 : 0);
