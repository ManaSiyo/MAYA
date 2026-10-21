// Keep the old entry point; pixel matches are no longer presented as role usage.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url);
execFileSync('python3',[new URL('tests/typography-role-usage.py',root).pathname],{stdio:'inherit'});
const report=JSON.parse(readFileSync(new URL('aesthetics/aesthetic-control/typography-usage.json',root)));
for(const bucket of Object.values(report.categories)){
 assert.equal(bucket.count,bucket.locations.length);
 assert.equal(Object.values(bucket.roles).reduce((n,r)=>n+r.count,0),bucket.count);
 assert.equal(new Set(bucket.locations.map(l=>l.page+':'+l.line+':'+l.snippet)).size,bucket.count);
 for(const l of bucket.locations){const lines=readFileSync(new URL(l.page,root),'utf8').split('\n');assert.ok(lines[l.line-1].includes('<'+l.tag)||lines[l.line-1].includes('createElement')||lines[l.line-1].includes('const tile ='),l.page+':'+l.line);}
}
for(const id of ['brand-title','client-name-modal-title'])assert.ok(report.categories.H1.locations.some(l=>l.page==='frontend/index.html'&&l.id===id));
assert.ok(report.categories.H1.locations.some(l=>l.page==='backend/outbound.html'&&l.snippet.includes('OUTBOUND')));
assert.ok(report.categories.H4.roles.dashboard.count>=2,'Admin number templates must be included');
assert.ok(report.categories.P2.count>0,'No empty typography groups');
console.log('Role audit passed: source evidence, unique locations, H1 roles and dynamic number templates.');
