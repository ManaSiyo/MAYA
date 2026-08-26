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

await test('all four release surfaces carry v13.90', () => {
  const version = source => (source.match(/name="maya-version" content="([0-9.]+)"/) || [])[1];
  assert.deepEqual([app, playground, admin, marketing].map(version), ['13.90', '13.90', '13.90', '13.90']);
});

console.log('\n' + (failed ? failed + ' FAILED' : passed + ' passed') + '\n');
process.exit(failed ? 1 : 0);
