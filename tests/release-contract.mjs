import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const build=read('cloudbuild.yaml'),docker=read('docs/server/Dockerfile');
assert.match(build,/npm ci --ignore-scripts/);
assert.match(build,/npx --no-install playwright install --with-deps chromium/);
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
for(const path of ['AGENTS.md','docs/README.md','docs/design.md'])assert.ok(read(path).includes('Aesthetic Control is the final completion gate.'),path);
console.log('Repository-wide Aesthetic Control governing rule and final release gate order passed.');
