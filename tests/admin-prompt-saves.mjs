// Executes the served Prompt Engine with deferred fake Firestore/auth results.
// No SDK, provider, credentials or network are used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../backend/status.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let _fbUser = null;'),html.indexOf('_gisBoot();',html.indexOf('let _fbUser = null;')));
assert.ok(source.includes('async function savePrompting()'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const snap=words=>({exists:words!==null,data:()=>words});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const elements=new Map(),events=new Map(),writes=[],reads=[],bridges=[];
 for(const id of ['pe-character','pe-background','pe-style','pe-body','pe-save','pe-state'])elements.set(id,{value:'',textContent:'',disabled:false,addEventListener(type,fn){this[type]=fn;}});
 let admin={session:1,subject:'a',token:'a-1'};
 const hooks={get:async()=>snap({character:'Saved character',body:'Saved body'}),set:async()=>{}};
 const auth={currentUser:null,signInWithCredential:credential=>{const d=deferred();bridges.push({credential,...d});return d.promise;}};
 const authFn=()=>auth;authFn.GoogleAuthProvider={credential:token=>token};
 const ref=path=>({collection:name=>ref(path+'/'+name),doc:name=>ref(path+'/'+name),get(){reads.push(path);return hooks.get(path);},set(body){writes.push({path,body});return hooks.set(path,body);}});
 const firebase={apps:[{}],auth:authFn,firestore:()=>({collection:name=>ref(name)})};
 const context=vm.createContext({firebase,FIREBASE_CONFIG:{},Date,JSON,Object,Error,
  document:{getElementById:id=>elements.get(id)},window:{firebase,addEventListener:(type,fn)=>events.set(type,fn)},
  _adminContext:()=>({...admin}),_adminContextCurrent:c=>!!c?.token&&c.session===admin.session&&c.subject===admin.subject});
 vm.runInContext(source,context);
 const user=id=>({uid:'uid-'+id,email:id+'@example.test',providerData:[{providerId:'google.com',uid:id}]});
 const bind=id=>{auth.currentUser=user(id);context.nextUser=auth.currentUser;vm.runInContext('_fbUser=nextUser',context);};bind('a');
 const edit=(key,text)=>{const el=elements.get('pe-'+key);el.value=text;el.input();};
 const change=id=>{admin={session:admin.session+1,subject:id,token:id+'-'+(admin.session+1)};events.get('maya-owner-session-changed')();bind(id);};
 return {context,elements,writes,reads,bridges,hooks,auth,edit,change,user,bind,
  text:()=>elements.get('pe-state').textContent,value:key=>elements.get('pe-'+key).value,
  renew(){admin={...admin,token:admin.subject+'-renewed'};},
  load:()=>context.loadPrompting(),save:()=>context.savePrompting()};
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
await test('a late initial read preserves words typed while loading',async()=>{
 const f=fixture(),read=deferred();f.hooks.get=()=>read.promise;const pending=f.load();f.edit('body','New words');read.resolve(snap({body:'Old saved words'}));await pending;
 assert.equal(f.value('body'),'New words');assert.match(f.text(),/unsaved/i);
});
await test('same-account token renewal preserves dirty fields without another read',async()=>{
 const f=fixture();await f.load();f.edit('body','Renewal draft');f.renew();f.context._fbBridge('a-renewed');f.bridges[0].resolve({user:f.user('a')});await tick();
 assert.equal(f.value('body'),'Renewal draft');assert.equal(f.reads.length,2);
});
await test('same-account token renewal preserves a pending save acknowledgement',async()=>{
 const f=fixture();await f.load();const write=deferred();f.hooks.set=()=>write.promise;f.edit('body','Renewed save');const pending=f.save();
 f.renew();f.context._fbBridge('a-renewed');f.bridges[0].resolve({user:f.user('a')});await tick();write.resolve();await pending;
 assert.equal(f.writes.length,1);assert.equal(f.reads.length,2);assert.match(f.text(),/Saved live/);assert.equal(f.value('body'),'Renewed save');
});
await test('a save serializes clicks and acknowledges only the submitted version',async()=>{
 const f=fixture();await f.load();const write=deferred();f.hooks.set=()=>write.promise;f.edit('body','First version');const pending=f.save();await f.save();
 assert.equal(f.writes.length,1);assert.equal(f.elements.get('pe-save').disabled,true);f.edit('body','Second version');write.resolve();await pending;
 assert.equal(f.value('body'),'Second version');assert.match(f.text(),/newer changes are unsaved/);assert.equal(f.elements.get('pe-save').disabled,false);
 f.hooks.set=async()=>{};await f.save();assert.equal(f.writes[1].body.body,'Second version');assert.doesNotMatch(f.text(),/unsaved/);
});
await test('an earlier read cannot repaint after a save acknowledgement',async()=>{
 const f=fixture();await f.load();const read=deferred();f.hooks.get=()=>read.promise;const pending=f.load();f.edit('body','Saved newer words');await f.save();read.resolve(snap({body:'Obsolete words'}));await pending;
 assert.equal(f.value('body'),'Saved newer words');assert.match(f.text(),/Saved live/);
});
await test('changing accounts blocks the old save fallback and acknowledgement',async()=>{
 const f=fixture();await f.load();const write=deferred();f.hooks.set=()=>write.promise;f.edit('body','Account A');const pending=f.save();f.change('b');write.reject({code:'permission-denied'});await pending;
 assert.equal(f.writes.length,1,'No draft write under either account after the live write fails');assert.equal(f.value('body'),'');assert.match(f.text(),/Sign in above/);
});
await test('A to B to A rejects the first A read',async()=>{
 const f=fixture(),read=deferred();f.hooks.get=()=>read.promise;const pending=f.load();f.change('b');f.change('a');read.resolve(snap({body:'Old account epoch'}));await pending;assert.equal(f.value('body'),'');
});
await test('a stale sign-in completion cannot restore the prior account',async()=>{
 const f=fixture();f.context._fbBridge('a-1');f.change('b');f.bridges[0].resolve({user:f.user('a')});await tick();
 assert.equal(vm.runInContext('_fbUser.uid',f.context),'uid-b');assert.equal(f.reads.length,0);
});
await test('a mismatched Firebase identity cannot read or save words',async()=>{
 const f=fixture();f.auth.currentUser=f.user('b');await f.load();f.edit('body','Wrong auth');await f.save();assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);assert.match(f.text(),/Sign in above/);
});
await test('a bridge linked to a different Google subject cannot load its private draft',async()=>{
 const f=fixture();f.context._fbBridge('a-1');f.auth.currentUser=f.user('b');f.bridges[0].resolve({user:f.user('b')});await tick();
 assert.equal(f.reads.length,0);assert.match(f.text(),/Could not link to the vault/);
});
await test('failed reads report unavailability instead of an empty saved document',async()=>{
 const f=fixture();f.hooks.get=async()=>{throw {code:'unavailable'};};await f.load();assert.match(f.text(),/could not be loaded/);assert.doesNotMatch(f.text(),/nothing saved/);
 f.edit('body','Retain this draft');await f.save();assert.equal(f.writes.length,0,'Failed initial reads never permit a blind replacement');assert.equal(f.value('body'),'Retain this draft');
});
await test('same-account denied live save falls back to its captured private draft',async()=>{
 const f=fixture();await f.load();f.hooks.set=async path=>{if(path==='config/prompting')throw {code:'permission-denied'};};f.edit('body','Private words');await f.save();
 assert.deepEqual(f.writes.map(w=>w.path),['config/prompting','users/uid-a/settings/prompting']);assert.match(f.text(),/Saved as a private draft/);assert.match(f.text(),/Live app unchanged/);
});
await test('parallel reads restore the newer private draft without presenting it as live',async()=>{
 const f=fixture(),live=deferred(),draft=deferred();f.hooks.get=path=>path==='config/prompting'?live.promise:draft.promise;
 const pending=f.load();assert.equal(f.reads.length,2,'Both independent reads start before either resolves');
 live.resolve(snap({body:'Live words',updatedAt:'2026-10-16T00:00:00Z'}));draft.resolve(snap({body:'Private newer draft',updatedAt:'2026-10-17T00:00:00Z'}));await pending;
 assert.equal(f.value('body'),'Private newer draft');assert.match(f.text(),/Private draft restored.*Live app unchanged/);
});
await test('newer live words take precedence over an old fallback draft',async()=>{
 const f=fixture();f.hooks.get=async path=>snap({body:path==='config/prompting'?'New live':'Old draft',updatedAt:path==='config/prompting'?'2026-10-17T00:00:00Z':'2026-10-16T00:00:00Z'});
 await f.load();assert.equal(f.value('body'),'New live');assert.match(f.text(),/^live,/);
});
await test('failed live and draft saves retain editable words and allow retry',async()=>{
 const f=fixture();await f.load();f.hooks.set=async()=>{throw {code:'unavailable'};};f.edit('body','Retry me');await f.save();assert.match(f.text(),/could not save/i);assert.equal(f.value('body'),'Retry me');assert.equal(f.elements.get('pe-save').disabled,false);
 f.hooks.set=async()=>{};await f.save();assert.match(f.text(),/Saved live/);
});
await test('Save before the initial read waits for review and preserves untouched saved fields',async()=>{
 const f=fixture(),read=deferred();f.hooks.get=()=>read.promise;const load=f.load();f.edit('body','Typed before loading');const save=f.save();
 assert.equal(f.reads.length,2,'Save joins the existing read instead of starting duplicates');assert.equal(f.writes.length,0);
 read.resolve(snap({character:'Existing character',body:'Old body'}));await Promise.all([load,save]);
 assert.equal(f.value('character'),'Existing character');assert.equal(f.value('body'),'Typed before loading');assert.match(f.text(),/Review them, then press Save/);assert.equal(f.writes.length,0);
 await f.save();assert.equal(f.writes[0].body.character,'Existing character');assert.equal(f.writes[0].body.body,'Typed before loading');
});
console.log(`Admin Prompt Engine: ${passed}/${passed} deferred save/read/account checks passed.`);
