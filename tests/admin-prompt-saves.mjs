// The Admin editor is retired; protect the real consumers of its existing live settings.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const admin=read('backend/status.html');
assert.doesNotMatch(admin,/id="(?:pe-|arch-)|function (?:savePrompting|loadPrompting|_fbBridge)\b|firebase(?:-app|-auth|-firestore)-compat/,'Retired UI and Firebase editing startup must not remain in served Admin');
assert.match(admin,/id="features-fold"/);assert.match(admin,/id="changes-fold"/);
assert.doesNotMatch(admin,/(?:href|aria-controls)=["']#?(?:pe-fold|arch-fold)["']/,'No retired navigation targets');
const rules=read('docs/server/firestore.rules');assert.match(rules,/match \/config\/\{docId\}/,'Existing live config remains readable under its original rules');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
for(const path of ['frontend/index.html','playground/index.html']){
 const html=read(path),start=html.indexOf('let _promptCfg = null;'),end=html.indexOf('// v9.9: render the cached face descriptors',start);
 assert.ok(start>=0&&end>start);const source=html.slice(start,end);
 assert.ok((html.match(/_promptTuning\(\)/g)||[]).length>2,path+' retains active rendering calls');
 assert.ok((html.match(/buildMeasClause\(\)/g)||[]).length>2,path+' retains active body rendering calls');
 function fixture(){
  const reads=[],auth={currentUser:null,onAuthStateChanged(fn){this.callback=fn;}};
  const state={get:async()=>({exists:true,data:()=>({character:'Saved person',background:'Saved studio',style:'Saved light',body:'Saved proportions'})}),teardowns:0,boots:0};
  const firebase={apps:[{}],auth:()=>auth,firestore:()=>({collection(collection){assert.equal(collection,'config');return {doc(id){assert.equal(id,'prompting');return {get(){reads.push(collection+'/'+id);return state.get();}};}};}})};
  const context=vm.createContext({window:{firebase},firebase,console,_authSeq:0,_cloudBooted:false,lastSummary:{_measurements:{height:68}},projectStore:{async teardown(){state.teardowns++;}},async _cloudBoot(){state.boots++;},_pgVoiceScopeChanged(){},setTimeout(){throw Error('Unexpected SDK retry');}});
  vm.runInContext(source,context);
  const settle=()=>vm.runInContext('_firebaseAuthTransition',context);
  return {state,reads,context,async sign(uid){auth.currentUser=uid?{uid}:null;auth.callback(auth.currentUser);await settle();},begin(uid){auth.currentUser=uid?{uid}:null;auth.callback(auth.currentUser);return settle();},settle,tuning:()=>vm.runInContext('_promptTuning()',context),body:()=>vm.runInContext('buildMeasClause()',context)};
 }
 {
  const f=fixture();await f.sign('a');assert.equal(f.tuning(),' CHARACTER, atelier direction: Saved person BACKGROUND, atelier direction: Saved studio STYLE, atelier direction: Saved light');
  assert.match(f.body(),/approximately 68 inches tall/);assert.match(f.body(),/Natural adult photographic proportions/);assert.match(f.body(),/BODY, atelier direction: Saved proportions/);assert.deepEqual(f.reads,['config/prompting']);checks++;
  await f.sign(null);assert.equal(f.tuning(),'');assert.doesNotMatch(f.body(),/Saved proportions/);assert.equal(f.state.teardowns,1);checks++;
 }
 for(const unavailable of ['absent','failed']){
  const f=fixture();f.state.get=unavailable==='absent'?async()=>({exists:false}):async()=>{throw Error('Fixture unavailable');};await f.sign('a');assert.equal(f.tuning(),'');assert.doesNotMatch(f.body(),/atelier direction/);assert.match(f.body(),/Natural adult photographic proportions/);checks++;
 }
 {
  const f=fixture();await f.sign('a');const delayed=deferred();f.state.get=()=>delayed.promise;
  const pending=f.begin('a');await tick();f.state.get=async()=>({exists:true,data:()=>({character:'Account B setting'})});const next=f.begin('b');
  delayed.resolve({exists:true,data:()=>({character:'Stale A setting',body:'Stale body'})});await Promise.all([pending,next]);assert.equal(f.tuning(),' CHARACTER, atelier direction: Account B setting');assert.doesNotMatch(f.body(),/Stale body/);assert.equal(f.state.teardowns,1);checks++;
 }
 {
  const f=fixture(),delayed=deferred();f.state.get=()=>delayed.promise;const pending=f.begin('a');await tick();const out=f.begin(null);delayed.resolve({exists:true,data:()=>({style:'Late signed-out setting'})});await Promise.all([pending,out]);assert.equal(f.tuning(),'');checks++;
 }
}
console.log(`Admin retirement: both retired sections/startup absent; ${checks} active App/Playground prompting read, rendering and account-race checks passed without writes.`);
