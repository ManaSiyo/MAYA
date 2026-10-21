// Retirement is a routing/navigation contract. No production or stored-data access.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname),read=path=>readFileSync(resolve(root,path),'utf8');
const hosting=JSON.parse(read('docs/firebase.json')).hosting;
const absent=(source,pattern,label)=>assert.equal(pattern.test(source),false,label);
for(const [source,destination] of [
 ['/operations{,/**}','/operations.html'],['/aesthetics/operations','/operations.html'],['/aesthetics/operations/','/operations.html'],['/aesthetics/operations/index.html','/operations.html'],
 ['/playground.html','/'],['/playground{,/**}','/'],
 ['/affiliates.html','/status.html'],['/affiliates{,/**}','/status.html'],
 ['/backend/affiliates.html','/status.html'],['/backend/affiliates{,/**}','/status.html']
]){
 const routes=hosting.redirects.filter(route=>route.source===source);
 assert.deepEqual(routes,[{source,destination,type:301}],source+' permanently exits the retired workspace before the SPA fallback');
}
assert.ok(!hosting.rewrites.some(route=>/playground|affiliates/i.test(route.source+' '+route.destination)),'No retired path silently rewrites into an active view');
assert.ok(!existsSync(resolve(root,'aesthetics/operations/index.html')),'No alternate Operation Room implementation remains');
for(const asset of ['clo-library.js','tests-data.js','kb/kb.js'])assert.ok(existsSync(resolve(root,'aesthetics/operations/'+asset)),'Shared pattern asset remains: '+asset);
assert.ok(!existsSync(resolve(root,'playground/index.html')),'The staging implementation is deleted');
assert.ok(!existsSync(resolve(root,'backend/affiliates.html')),'No Affiliates served file remains');
assert.equal(hosting.rewrites.find(route=>route.source==='**')?.destination,'/frontend/index.html','The live client fallback remains');
assert.equal(hosting.rewrites.find(route=>route.source==='/status.html')?.destination,'/backend/status.html','Admin remains independently reachable');
assert.equal(hosting.rewrites.find(route=>route.source==='/api/**')?.run?.serviceId,'maya-api','Shared authenticated APIs remain');

function walk(directory){return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(directory+'/'+entry.name):[directory+'/'+entry.name]);}
const served=['frontend','backend','aesthetics'].flatMap(walk).filter(file=>['.html','.js'].includes(extname(file)));
for(const file of served){const source=read(file);absent(source,/(?:href|src)\s*=\s*["']\/(?:playground|affiliates)(?:[/.#?"'])/i,file+' has no active link to a retired workspace');absent(source,/["']\/(?:playground|affiliates)\.html["']/i,file+' has no generated retired route');}
const admin=read('backend/status.html');absent(admin,/IS_AFFILIATES|loadAffiliateLeads|clearAffiliateLeads|affiliate-profile|affiliates-view/,'Admin has no retired alternate boot or private loader');
const app=read('frontend/index.html');absent(app,/id=["'](?:pg-callouts|pg-card-back|pg-flip)["']|function pgFlipCard\(/,'Retirement does not promote the unapproved flip experiment');
assert.ok(/function pgShow\(/.test(app),'The approved shared filing cabinet remains');assert.ok(/async function _saveCurrentAvatarToLibrary\(/.test(app),'The existing client avatar workflow remains');
assert.ok(/\/api\/admin\/leads/.test(read('docs/server/server.js')),'The shared Leads API is not retired with one view');
assert.ok(/third parties, affiliates, or lead generators/.test(read('backend/privacy.html')),'Legal references are unrelated to the retired product');
console.log('Retired workspaces passed: permanent legacy-path redirects, deleted staging page, absent active navigation/alternate boot, live client/Admin/API continuity and no experimental promotion.');
