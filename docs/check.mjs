// One release command: packaging, behavior, forced-GC deadlines, then UI authority.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {buildSite} from './build-site.mjs';
const root=new URL('../',import.meta.url).pathname;process.chdir(root);
const started=performance.now();
const config=JSON.parse(readFileSync('docs/firebase.json','utf8'));
assert.equal(config.hosting.public,'.hosting');
assert.equal(config.hosting.rewrites.find(x=>x.source==='/api/**').run.serviceId,'maya-api');
for(const path of ['/operations.html','/backend/operations.html','/wr.html','/backend/wr.html','/terms.html','/backend/terms.html'])assert.ok(config.hosting.redirects.some(x=>x.source===path));
for(const folder of ['frontend','backend'])for(const entry of readdirSync(folder)){if(!entry.endsWith('.html'))continue;const source=readFileSync(folder+'/'+entry,'utf8');for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|type=["'](?:module|importmap|application\/(?:ld\+)?json)/i.test(match[1]))continue;new vm.Script(match[2],{filename:folder+'/'+entry});}}
for(const file of readdirSync('backend/server').filter(x=>/\.(?:mjs|js)$/.test(x))){const checked=spawnSync(process.execPath,['--check','backend/server/'+file],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);}
const output=buildSite('a'.repeat(40));
assert.ok(!existsSync(output+'/docs'));assert.ok(!existsSync(output+'/backend/server'));
assert.ok(!existsSync(output+'/aesthetics/headshots'));assert.ok(!existsSync(output+'/backend/wr.html'));
const docker=readFileSync('backend/server/Dockerfile','utf8');
for(const match of docker.matchAll(/^COPY\s+(.+?)\s+\.\//gm))for(const file of match[1].split(/\s+/))assert.ok(existsSync('backend/server/'+file),'Docker source missing: '+file);
const imported=[...readFileSync('backend/server/server.js','utf8').matchAll(/from\s+['"]\.\/([^'"]+)/g)].map(x=>x[1]);for(const file of imported)assert.ok(docker.includes(file),'Docker does not package '+file);
const redirects=new Set(config.hosting.redirects.map(r=>r.source));
for(const folder of ['frontend','backend'])for(const file of readdirSync(output+'/'+folder).filter(x=>x.endsWith('.html'))){
 const html=readFileSync(output+'/'+folder+'/'+file,'utf8');
 for(const match of html.matchAll(/(?:src|href)=["'](\/(?:aesthetics|backend)\/[^"'?<>]+)(?:[?][^"']*)?["']/g)){
  const path=decodeURIComponent(match[1]);if(redirects.has(path))continue;assert.ok(existsSync(output+path),'Missing served asset '+path+' in '+file);
 }
}
console.log('Packaging and syntax passed');
// A separate process keeps provider fixtures and environment mutations isolated.
const {checks}=await import('./check-runtime.mjs');
for(const name of Object.keys(checks)){
 const result=spawnSync(process.execPath,['--input-type=module','-e',`const {checks}=await import('./docs/check-runtime.mjs');await checks[${JSON.stringify(name)}]();`],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 if(result.status!==0){process.stderr.write(result.stdout+result.stderr);throw result.error||Error(name+' failed');}console.log('PASS '+name);
}
const gc=spawnSync(process.execPath,['--expose-gc','--input-type=module','-e',"const t=setInterval(()=>global.gc(),5);try{const {checks}=await import('./docs/check-runtime.mjs');await checks['fabric-search']();await checks['fabric-worldwide']();}finally{clearInterval(t)}"],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
assert.equal(gc.status,0,'Fabric deadline/GC: '+gc.stdout+gc.stderr);console.log('PASS Fabric forced-GC deadlines');
// Final presentation gate: defaults and visibly different saved settings.
const ui=spawnSync(process.execPath,['docs/check-ui.mjs'],{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});process.stdout.write(ui.stdout);assert.equal(ui.status,0,ui.error?.message||ui.stderr);
console.log('Release checks passed in '+Math.round(performance.now()-started)+' ms. Live provider performance is separate.');
