import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname} from 'node:path';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const build=read('cloudbuild.yaml'),docker=read('docs/server/Dockerfile');
assert.match(build,/npm ci --ignore-scripts/);
assert.match(build,/npx --no-install playwright install --with-deps chromium/);
assert.match(build,/playwright install --with-deps chromium > \/tmp\/maya-browser-install.log 2>&1 \|\| \{ tail -80 \/tmp\/maya-browser-install.log; exit 1; \}/,'Browser installation failures must expose their tail and fail the build');
const rawWrapper=build.match(/^        node\(\) \{[\s\S]*?^        \}/m)?.[0];
assert.ok(rawWrapper,'Every Node release check must keep a full temporary log and a bounded failure tail');
assert.doesNotMatch(rawWrapper,/(?<!\$)\$(?!\$)/,'Shell dollars must survive Cloud Build substitution');
const wrapper=rawWrapper.replace(/^ {8}/gm,'').replace(/\$\$/g,'$');
const run=code=>spawnSync('bash',['-ceu',wrapper+'\nnode -e "$MAYA_RELEASE_PROBE"'],{encoding:'utf8',env:{...process.env,MAYA_RELEASE_PROBE:code,PATH:dirname(process.execPath)+':'+(process.env.PATH||'')}});
const success=run('console.log("noisy-success")');assert.equal(success.status,0);assert.match(success.stdout,/PASS node/);assert.doesNotMatch(success.stdout,/noisy-success/);
const failure=run('console.error("specific-failure");process.exit(7)');assert.equal(failure.status,7,'Release wrapper must preserve a failing child exit');assert.match(failure.stdout,/FAIL node/);assert.match(failure.stdout,/specific-failure/,'The actual failing tail must reach the build log');
const early=run('console.log("FAIL early surface");for(let i=0;i<200;i++)console.log("later pass "+i);process.exit(1)');assert.equal(early.status,1);assert.match(early.stdout,/FAIL early surface/,'An earlier surface failure cannot be hidden by a later passing tail');
assert.doesNotMatch(build,/if npm install|checks skipped|maya-phone skipped/,'Required gates cannot fail open on dependency installation');
assert.match(build,/MAYA_BUILD_COMMIT=\$COMMIT_SHA/);assert.match(docker,/ARG MAYA_BUILD_COMMIT/);
assert.match(docker,/writeFileSync\('build-info.json'/);assert.match(docker,/npm ci --omit=dev/);
const tests=JSON.parse(read('package.json')),server=JSON.parse(read('docs/server/package.json'));
for(const [name,version] of Object.entries(server.dependencies)){
 assert.equal(tests.devDependencies[name],version,'Release tests and server must use the same '+name);
 assert.match(version,/^\d+\.\d+\.\d+$/);
}
for(const dir of ['', 'docs/server/']){
 const manifest=JSON.parse(read(dir+'package.json')),lock=JSON.parse(read(dir+'package-lock.json'));
 assert.deepEqual(lock.packages[''].dependencies||{},manifest.dependencies||{});
 assert.deepEqual(lock.packages[''].devDependencies||{},manifest.devDependencies||{});
}
const hosting=JSON.parse(read('docs/firebase.json')).hosting.ignore;
assert.ok(hosting.includes('package.json')&&hosting.includes('package-lock.json'));
console.log('Mandatory release dependencies, reproducible runtime packages and API build identity passed.');

const releaseChecks=build.slice(build.indexOf('  - id: Test release contracts'),build.indexOf('  - id: Build server'));
const commands=[...releaseChecks.matchAll(/^\s+node (.+)$/gm)].map(m=>m[1]);
assert.equal(commands.at(-1),'tests/aesthetic-authority.mjs','Aesthetic Control must be the last release verification');
assert.equal(commands.filter(c=>c==='tests/aesthetic-authority.mjs').length,1);
for(const path of ['tests/component-gallery.mjs','tests/app-regression.mjs']){
 const source=read(path),launch=source.match(/chromium\.launch\([^\n]+/u)?.[0];
 assert.ok(launch?.includes('process.env.PW_CHROMIUM')&&launch.includes('process.env.CHROMIUM_PATH'),path+' retains explicit isolated browser overrides');
 assert.doesNotMatch(launch,/\/opt\/pw-browsers|\/Applications\//u,path+' must default to the pinned Playwright-installed browser, not a machine-specific application');
}
for(const path of ['AGENTS.md','docs/README.md','docs/design.md'])assert.ok(read(path).includes('Aesthetic Control is the final completion gate.'),path);
console.log('Repository-wide Aesthetic Control governing rule and final release gate order passed.');

const hostingHeaders=JSON.parse(read('docs/firebase.json')).hosting.headers;
for(const asset of ['fabric-assistant.js','fabric-assistant.css','fabric-search-details.js','voice-preparation.js']){
 const rule=hostingHeaders.find(r=>r.source==='/aesthetics/ui/'+asset);
 assert.ok(rule?.headers.some(h=>h.key==='Cache-Control'&&h.value==='no-cache'),asset+' must revalidate shared behavior');
}
for(const page of ['backend/backend.html','backend/operations.html']){
 const html=read(page);
 for(const ext of ['js','css'])assert.ok(html.includes('/aesthetics/ui/fabric-assistant.'+ext+'?v=5'),page+' must load the current fabric asset version');
 assert.doesNotMatch(html,/fabric-assistant\.(?:js|css)\?v=3/);
}
console.log('Fabric asset URLs bypass retained v3 caches; shared fabric and voice runtime revalidate.');

const inventoryRule=hostingHeaders.find(r=>r.source==='/aesthetics/fabrics/fabrics.json');
assert.ok(inventoryRule?.headers.some(h=>h.key==='Cache-Control'&&h.value==='no-cache'),'Inventory metadata must revalidate independently of week-cached images');
console.log('Inventory metadata revalidates without changing photograph caching.');
