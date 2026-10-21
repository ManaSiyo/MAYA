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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.MAYA_SITE || 'https://maya.manasiyo.com';
const WAIT = process.argv.includes('--wait');
const WANT_COMMIT = (process.env.MAYA_COMMIT || execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'})).trim();
if(!/^[0-9a-f]{40}$/.test(WANT_COMMIT))throw Error('Expected a full release commit SHA.');

const localVersion = (src) => (readFileSync(join(ROOT, src), 'utf8')
  .match(/name="maya-version" content="([\d.]+)"/) || [])[1];
const WANT = localVersion('frontend/index.html');
const WANT_MAP = localVersion('backend/status.html');

let failed = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '   ' + detail : ''));
  if (!cond) failed++;
};
const get = async (path) => {
  const r = await fetch(SITE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now(),
    { headers: { 'Cache-Control': 'no-cache' }, signal:AbortSignal.timeout(15000) });
  return { status: r.status, contentType:r.headers.get('content-type')||'', text: await r.text() };
};
const versionOf = (t) => (t.match(/name="maya-version" content="([\d.]+)"/) || [])[1] || 'none';

console.log('\nMAYA live verification, ' + SITE + '\n');
ok('the two local pages carry the same version (' + WANT + ')', WANT === WANT_MAP, WANT_MAP);

// Display versions can remain unchanged across pushes: wait for the actual commit.
const readRelease=async()=>{const r=await get('/release.json');try{return r.status===200?JSON.parse(r.text):{};}catch{return {};}};
let release=await readRelease();
if(WAIT){
  for(let i=0;i<36 && release.commit!==WANT_COMMIT;i++){
    console.log('  ..   waiting for '+WANT_COMMIT.slice(0,7)+', live '+String(release.commit||'unknown').slice(0,7));
    await new Promise(r=>setTimeout(r,10000));release=await readRelease();
  }
}
ok('live published commit matches the requested release',release.commit === WANT_COMMIT,'live '+(release.commit||'missing')+'; expected '+WANT_COMMIT);
const app = await get('/index.html');
const map = await get('/status.html');
const buildOf=t=>(t.match(/name="maya-build" content="([0-9a-f]{40})"/)||[])[1];
ok('app and Admin carry the exact published build',buildOf(app.text)===WANT_COMMIT && buildOf(map.text)===WANT_COMMIT);
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
ok('wall details stay hidden until hover', /\.community-card\s+\.cc-meta\s*\{[^}]*opacity:\s*0\s*;/.test(app.text));
ok('the deploy signs everyone out on the next load',
  app.text.includes('maya_seen_version_app') && map.text.includes('maya_seen_version_map'));

const outbound = await get('/outbound.html');
const outboundScript = await get('/backend/outbound.js');
ok('Outbound is the real page, not the app fallback',outbound.status===200 && versionOf(outbound.text)===WANT && outbound.text.includes('id="campaigns"') && outbound.text.includes('/backend/outbound.js'));
ok('Outbound module is served as JavaScript',outboundScript.status===200 && /javascript/.test(outboundScript.contentType) && outboundScript.text.includes('/api/admin/outbound'));

const health = await get('/api/healthz');
let h = {};
try { h = JSON.parse(health.text); } catch (_) {}
ok('server answers', health.status === 200 && h.ok === true, h.service || health.status);
ok('API carries the exact published build',h.commit===WANT_COMMIT,'live '+(h.commit||'missing')+'; expected '+WANT_COMMIT);
ok('OpenAI key is configured on the server', !!(h.configured && h.configured.openai));
ok('Submission storage is configured', !!h.configured?.submissions);
console.log('  note   configuration does not prove authenticated provider access.');

const css = await get('/aesthetics/ui/maya-canon.css');
ok('shared canon CSS is served, not an HTML fallback', css.status === 200 && /text\/css/.test(css.contentType) && css.text.includes('--maya-font-ui'));
const meter = await get('/aesthetics/ui/ai-meter.js');
ok('AI meter module is served', meter.status === 200 && /javascript/.test(meter.contentType) && meter.text.includes('class MayaAIMeter'));
for(const path of ['/api/admin/outbound','/api/admin/outbound/intelligence','/api/admin/ai-meter']){const route=await get(path);ok(path+' exists and requires sign-in',route.status===401 && /json/.test(route.contentType));}
const rules = await get('/docs/server/firestore.rules');
ok('internal files are NOT published', rules.status === 404 || rules.text.includes('<!DOCTYPE'));

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
