import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createAdminNotificationStore} from '../docs/server/admin-notifications.mjs';
const objects=new Map();let writes=0,readMode='',writeMode='',collisions=0;
const path=subject=>'private/admin-notifications/'+Buffer.from(subject).toString('base64url')+'.json';
const read=async key=>{
 if(readMode==='unavailable')return {ok:false,status:503};
 if(readMode==='malformed')return {ok:true,buf:Buffer.from('{'),generation:'1'};
 if(readMode==='missing-generation')return {ok:true,buf:Buffer.from('{"version":1,"states":{},"items":[]}')};
 const item=objects.get(key);return item?{ok:true,buf:Buffer.from(item.json),generation:String(item.generation)}:{ok:false,status:404};
};
const write=async(key,buf,type,generation)=>{
 writes++;assert.equal(type,'application/json');assert.equal(typeof generation,'string');
 if(writeMode==='unavailable')throw Object.assign(Error('SECRET provider body'),{status:503});
 const old=objects.get(key);if(writeMode==='conflict'||String(old?.generation||0)!==generation){collisions++;throw Object.assign(Error('conflict'),{status:412});}
 objects.set(key,{json:buf.toString(),generation:(old?.generation||0)+1});
};
let tick=0;const store=createAdminNotificationStore({read,write,now:()=>new Date(Date.UTC(2026,10,3,0,0,tick++)).toISOString()});
const batch=(source,code)=>({items:[{source,code}]});
assert.deepEqual(await store.list('one'),[]);
assert.equal(writes,0,'A read never creates history');
let items=await store.record('one',batch('google_ads','oauth_expired'));
assert.equal(items.length,1);assert.equal(items[0].severity,'error');assert.match(items[0].text,/expired or was revoked/);
assert.deepEqual(await store.list('two'),[],'Accounts have independent history');
const firstId=items[0].id,beforeDedup=writes;
items=await store.record('one',batch('google_ads','oauth_expired'));
assert.equal(items.length,1);assert.equal(items[0].id,firstId);assert.equal(writes,beforeDedup,'Repeated state does not write or grow history');
items=await store.record('one',batch('google_ads','connected'));
assert.equal(items.length,2);assert.equal(items[0].code,'connected');assert.equal(items[0].severity,'info');
await store.record('two',batch('meta_ads','not_configured'));
assert.equal((await store.list('one')).length,2);
assert.equal((await store.list('two'))[0].source,'meta_ads');
const operational=await store.record('operational',{items:[{source:'leads',code:'unavailable'},{source:'analytics',code:'unavailable'}]});
assert.deepEqual(new Set(operational.map(item=>item.source)),new Set(['leads','analytics']),'Lead and Analytics states remain separate sources');
assert.ok(operational.some(item=>item.text==='Leads is unavailable.'&&item.severity==='error'));
assert.ok(operational.some(item=>item.text==='Analytics is unavailable.'&&item.severity==='error'));
await store.record('operational',batch('leads','healthy'));
assert.equal((await store.list('operational'))[0].text,'Leads is available.');
for(const source of ['leads','analytics'])await assert.rejects(store.record('operational',batch(source,'connected')),e=>e.status===400,'Non-Ads sources reject Ads-only states');

for(let i=0;i<205;i++)await store.record('bounded',batch('api',i%2?'healthy':'unavailable'));
assert.equal((await store.list('bounded')).length,200,'History has a hard per-account bound');
await Promise.all([store.record('race',batch('site','healthy')),store.record('race',batch('images','healthy'))]);
assert.equal((await store.list('race')).length,2,'CAS retry preserves concurrent sources');assert.ok(collisions>0);
const same=await Promise.all([store.record('same',batch('api','healthy')),store.record('same',batch('api','healthy'))]);
assert.equal((await store.list('same')).length,1,'Concurrent identical checks create one transition');assert.equal(same[0][0].id,same[1][0].id);
for(const input of [null,{},[],{items:[]},{items:Array.from({length:17},(_,i)=>({source:'api',code:'healthy'}))},{items:[{source:'evil',code:'healthy'}]},{items:[{source:'__proto__',code:'healthy'}]},{items:[{source:'api',code:'constructor'}]},{items:[{source:'api',code:'SECRET'}]},{items:[{source:'api',code:'healthy',text:'SECRET'}]},{items:[{source:'api',code:'healthy'}],account:'two'},{items:[{source:'api',code:'healthy'},{source:'api',code:'unavailable'}]}]){
 const before=writes;await assert.rejects(store.record('one',input),e=>e.status===400);assert.equal(writes,before,'Invalid input never reaches storage');
}
for(const subject of ['',null,'x'.repeat(201)])await assert.rejects(store.record(subject,batch('api','healthy')),e=>e.status===400);
for(const mode of ['unavailable','malformed','missing-generation']){
 readMode=mode;const before=writes;await assert.rejects(store.list('one'));await assert.rejects(store.record('one',batch('api','healthy')));assert.equal(writes,before,'Failed initial reads never overwrite history');
}readMode='';
for(const doc of [{},{version:1,states:{api:'raw-error'},items:[]},{version:1,states:{},items:{}},{version:1,states:{},items:[{id:'bad',source:'api',code:'healthy',ts:'invalid'}]},{version:1,states:{},items:[],secret:'not accepted'},{version:1,states:{},items:[{id:crypto.randomUUID(),source:'api',code:'healthy',ts:new Date().toISOString(),text:'raw provider text'}]}]){
 objects.set(path('broken'),{json:JSON.stringify(doc),generation:1});const before=writes;
 await assert.rejects(store.list('broken'),e=>e.status===503);await assert.rejects(store.record('broken',batch('api','healthy')),e=>e.status===503);assert.equal(writes,before);
}
writeMode='unavailable';await assert.rejects(store.record('one',batch('api','healthy')));writeMode='conflict';await assert.rejects(store.record('one',batch('api','healthy')),e=>e.status===409);writeMode='';
assert.ok([...objects.values()].every(item=>!item.json.includes('SECRET')),'No arbitrary/provider input enters persisted history');

// Execute the actual route block to prove verified identity, no-store and safe errors.
const server=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const start=server.indexOf('// Admin notifications are fixed operational states');
assert.ok(start>=0);const block=server.slice(start,server.indexOf('// WR leads are private',start));
const routes=new Map();let user={sub:'verified-owner'},authError=null,listFailure=null,called=[];
const context={app:{get:(path,...handlers)=>routes.set('GET '+path,handlers),post:(path,...handlers)=>routes.set('POST '+path,handlers)},requireAuthHeader(){},express:{json:()=>()=>{}},requireAdmin:async()=>{if(authError)throw authError;return user;},createAdminNotificationStore:()=>({list:async subject=>{called.push(['list',subject]);if(listFailure)throw listFailure;return [];},record:async(subject,input)=>{called.push(['record',subject,input]);if(listFailure)throw listFailure;return [];}}),gcsGet(){},gcsPut(){}};
runInNewContext(block,context);
const response=()=>({code:200,headers:{},status(value){this.code=value;return this;},set(key,value){this.headers[key]=value;return this;},json(body){this.body=body;return this;}});
for(const method of ['GET','POST']){
 const handlers=routes.get(method+' /api/admin/notifications');assert.equal(handlers[1],context.requireAuthHeader);
 const middlewareResponse=response();let proceeded=false;handlers[0]({},middlewareResponse,()=>{proceeded=true;});assert.equal(proceeded,true);assert.equal(middlewareResponse.headers['Cache-Control'],'private, no-store','Even rejected authentication responses are no-store');
 const run=handlers.at(-1),res=response();await run({body:{...batch('api','healthy'),subject:'attacker'}},res);
 assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(called.at(-1)[1],'verified-owner');
 authError=Object.assign(Error('private account email'),{status:403});const denied=response();await run({},denied);assert.equal(denied.code,403);assert.deepEqual(JSON.parse(JSON.stringify(denied.body)),{error:'admin_required'});assert.equal(denied.headers['Cache-Control'],'private, no-store');authError=null;
 for(const status of [400,409,503,500]){listFailure=Object.assign(Error('SECRET provider body'),{status});const failure=response();await run({body:batch('api','healthy')},failure);assert.equal(failure.code,method==='POST'&&[400,409].includes(status)?status:503);assert.ok(!JSON.stringify(failure.body).includes('SECRET'));assert.equal(failure.headers['Cache-Control'],'private, no-store');}listFailure=null;
}
console.log('Admin notifications: verified Admin routes, account isolation, fixed safe states, transition/recovery dedup, 200-item bound, CAS races and fail-closed storage passed.');
