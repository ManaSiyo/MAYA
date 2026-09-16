// MAYA live verification. The third test, and the only one that looks at what
// the WORLD actually has: smoke.mjs proves the server code, app-regression.mjs
// proves the pages in a browser, and this proves the deploy landed.
//
//   node tests/verify-live.mjs            (run from the repo root)
//   node tests/verify-live.mjs --wait     (poll for up to 6 minutes)
//
// Written August 16 2026 because a version sat "pushed" for two days while the
// live site served the old one, and nobody knew until Fromsa noticed. Never
// again: after every push, run this. It needs the internet, so it runs from
// ~/Desktop/MAYA-new, not from an agent sandbox.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.MAYA_SITE || 'https://maya.manasiyo.com';
const WAIT = process.argv.includes('--wait');

const localVersion = (src) => (readFileSync(join(ROOT, src), 'utf8')
  .match(/name="maya-version" content="([\d.]+)"/) || [])[1];
const WANT = localVersion('index.html');
const WANT_MAP = localVersion('status.html');

let failed = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '   ' + detail : ''));
  if (!cond) failed++;
};
const get = async (path) => {
  const r = await fetch(SITE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now(),
    { headers: { 'Cache-Control': 'no-cache' } });
  return { status: r.status, text: await r.text() };
};
const versionOf = (t) => (t.match(/name="maya-version" content="([\d.]+)"/) || [])[1] || 'none';

console.log('\nMAYA live verification, ' + SITE + '\n');
ok('the two local pages carry the same version (' + WANT + ')', WANT === WANT_MAP, WANT_MAP);

// Cloud Build takes about four minutes. --wait polls instead of failing early.
let app = await get('/index.html');
if (WAIT) {
  for (let i = 0; i < 36 && versionOf(app.text) !== WANT; i++) {
    process.stdout.write('  ..   waiting for the deploy, live is ' + versionOf(app.text) + '\r');
    await new Promise(r => setTimeout(r, 10_000));
    app = await get('/index.html');
  }
  process.stdout.write('                                                          \r');
}
const map = await get('/status.html');
ok('live app is the version in this folder', versionOf(app.text) === WANT, 'live ' + versionOf(app.text));
ok('live Systems Map is the same version', versionOf(map.text) === WANT, 'live ' + versionOf(map.text));

// Whole-file equality would fail on nothing but a stray newline, so this checks
// the things that break silently: the page is whole, and the shape of the work
// that shipped last is present in what the world downloads.
ok('app page is whole', app.status === 200 && app.text.length > 400_000, app.text.length + ' chars');
ok('map page is whole', map.status === 200 && map.text.length > 30_000, map.text.length + ' chars');
ok('community cards carry no white plate behind the picture',
  !/\.community-card \{[\s\S]{0,400}?background: rgba\(255,255,255,0\.06\)/.test(app.text));
ok('community frames take each picture\'s own shape',
  app.text.includes('aspect-ratio: var(--cc-ar, 3 / 2)') && app.text.includes('communityBoard.fit(this)'));
ok('wall details stay hidden until hover', /\.cc-meta \{[\s\S]{0,300}?opacity: 0;/.test(app.text));
ok('the deploy signs everyone out on the next load',
  app.text.includes('maya_seen_version_app') && map.text.includes('maya_seen_version_map'));

const health = await get('/api/healthz');
let h = {};
try { h = JSON.parse(health.text); } catch (_) {}
ok('server answers', health.status === 200 && h.ok === true, h.service || health.status);
ok('OpenAI key is configured on the server', !!(h.configured && h.configured.openai));
ok('Drive is configured on the server', !!(h.configured && h.configured.drive));
console.log('  note   configured is not the same as working. Drive authorisation is only');
console.log('         provable from a signed-in Systems Map or /api/healthz/deep.');

const css = await get('/aesthetics/ui/status-v13.19.css');
ok('scoped Systems Map stylesheet is served', css.status === 200);
const rules = await get('/docs/server/firestore.rules');
ok('internal files are NOT published', rules.status === 404 || rules.text.includes('<!DOCTYPE'));

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
