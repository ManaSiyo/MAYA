// Import and served-asset contracts; complements behavior tests, not runtime isolation.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname),server=resolve(root,'docs/server');
const fabric=['fabric-search.mjs','fabric-discovery.mjs','fabric-retailers.mjs','fabric-sourcing.js'];
const allowed=new Set([...fabric,'model-config.mjs']);
const modules=readdirSync(server).filter(name=>/\.(?:mjs|js)$/.test(name));
const read=name=>readFileSync(resolve(server,name),'utf8');
const imports=source=>[...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
for(const name of fabric){
 for(const target of imports(read(name)).filter(path=>path.startsWith('.'))){
  const local=relative(server,resolve(server,target));assert.ok(allowed.has(local),name+' may not import another department: '+local);
 }
}
for(const name of modules.filter(name=>name!=='server.js'&&!fabric.includes(name))){
 assert.ok(!imports(read(name)).some(path=>fabric.some(f=>path.endsWith('/'+f))),name+' may not depend on Fabrics');
}
const routeSource=read('fabric-search.mjs');
assert.ok(!/app\.use\s*\(/.test(routeSource),'Fabric mounting may not install application-wide middleware');
for(const route of routeSource.matchAll(/app\.(?:get|post|put|patch|delete)\(\s*['"]([^'"]+)/g))assert.ok(route[1].startsWith('/api/admin/fabrics/'),route[1]);
for(const page of ['frontend/index.html','backend/status.html','backend/outbound.html'])assert.doesNotMatch(readFileSync(resolve(root,page),'utf8'),/\/(?:fabric-assistant|fabric-search-details)\.(?:js|css)/,page+' must not load fabric assets');
for(const page of ['backend/backend.html','backend/operations.html']){
 const source=readFileSync(resolve(root,page),'utf8');assert.match(source,/fabric-search-details\.js\?v=1/);assert.match(source,/fabric-assistant\.js\?v=5/);
}
for(const file of ['aesthetics/ui/fabric-assistant.js','aesthetics/ui/fabric-search-details.js'])assert.doesNotMatch(readFileSync(resolve(root,file),'utf8'),/\/api\/(?:messages|sms|phone|outbound|wix)|localStorage\.setItem|document\.documentElement\.style/,file+' must not mutate another department or shared private storage');
const css=readFileSync(resolve(root,'aesthetics/ui/fabric-assistant.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
for(const block of css.matchAll(/([^{}]+)\{/g)){
 const selector=block[1].trim();if(selector.startsWith('@'))continue;
 for(const part of selector.split(','))assert.match(part.trim(),/^\.(?:fa-|fabric-)/,'Fabric CSS must be namespaced: '+part);
}
console.log('Domain boundaries: '+modules.length+' server modules inspected; fabric imports/routes/assets/styles are isolated from communications, CRM and client entry points. Shared process/auth/design remain intentional contracts.');
