import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const cut=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
for(const file of ['frontend/index.html','playground/index.html']){
 const source=readFileSync(file,'utf8');
 for(const boundary of ['queued','read','delete','query','duplicate','normal'])for(const returnToA of [false,true]){
  let user='A',waited=false,queued;const gate=deferred(),deleted=[],queried=[],assets=[];
  const pause=async phase=>{if(phase===boundary){waited=true;await gate.promise;}};
  const doc={get:async()=>{await pause('read');return {exists:true,data:()=>({uid:'A',storagePath:'A/main'})};},delete:async()=>{deleted.push('A/main');await pause('delete');}};
  const query={where:(key,op,value)=>{queried.push([key,value]);return query;},limit:()=>query,get:async()=>{await pause('query');return {docs:[{id:'A/legacy',data:()=>({uid:'A',storagePath:'A/legacy'}),ref:{delete:async()=>{deleted.push('A/legacy');await pause('duplicate');}}}]};}};
  const context={_authSeq:1,currentScreen:0,console,firebase:{storage:()=>({ref:path=>({delete:async()=>assets.push(path)})})}};
  runInNewContext('globalThis.board={'+cut(source,'  unpublish(item) {','  _applySnapshot(q)')+'};',context);
  const board=context.board;Object.assign(board,{_uid:()=>user,_postId:()=> 'A/main',_col:()=>({doc:()=>doc,where:query.where}),_fp:()=> 'shared-image',posts:[{id:'A/main'},{id:'B/post'}],render(){},_queue:(key,fn)=>{assert.equal(key,'A:A/main');if(boundary==='queued'){queued=fn;waited=true;return gate.promise.then(fn);}return fn();}});
  const item={card:{favorited:false,_communityId:'A/main'}};const pending=board.unpublish(item);
  if(boundary!=='normal'){
   while(!waited)await Promise.resolve();user='B';context._authSeq++;if(returnToA){user='A';context._authSeq++;}gate.resolve();
  }
  await pending;
  assert.ok(queried.every(([key,value])=>key!=='uid'||value==='A'),file+' pins cleanup UID');
  assert.ok(deleted.every(v=>v.startsWith('A/')));assert.ok(assets.every(v=>v.startsWith('A/')));
  if(['queued','read'].includes(boundary))assert.equal(deleted.length,0);
  if(boundary==='delete')assert.deepEqual(queried,[]);
  if(boundary==='query')assert.deepEqual(deleted,['A/main']);
  if(boundary!=='normal')assert.equal(item.card._communityId,'A/main','stale completion cannot mutate card');
  else{assert.deepEqual(deleted,['A/main','A/legacy']);assert.deepEqual(assets,['A/main','A/legacy']);assert.equal(item.card._communityId,undefined);}
 }
}
const source=readFileSync('backend/outbound.js','utf8'),jwt=(sub,n)=>'x.'+Buffer.from(JSON.stringify({sub,n})).toString('base64url')+'.x';
for(const result of [200,401]){
 let bearer=jwt('A',1),handler,cleared=0,loads=0;const gate=deferred();
 const ctx={console,atob,AbortSignal,localStorage:{getItem:()=>bearer},window:{addEventListener:(name,fn)=>handler=fn},fetch:async()=>{await gate.promise;return {ok:result===200,status:result,json:async()=>result===200?{ok:true,saved:'draft'}:{error:'old token expired'}};},clearWorkspace:()=>cleared++,notice(){},run:()=>loads++,load(){}};
 runInNewContext("let session=localStorage.getItem('maya_admin_tok'),authEpoch=0,busy=false,reloadPending=false;"+cut(source,'function token(){','async function run(fn)')+cut(source,"window.addEventListener('storage',",'\nrun(load);'),ctx);
 const pending=ctx.api('/save',{subject:'Reviewed draft'}).catch(e=>e);
 bearer=jwt('A',2);handler({key:'maya_admin_tok'});gate.resolve();const value=await pending;
 assert.equal(cleared,0,'same subject renewal preserves modal/drafts');assert.equal(loads,0,'same subject does not reload');
 if(result===200)assert.equal(value.saved,'draft');else assert.match(value.message,/expired/,'old token error remains explicit without clearing draft');
 bearer=jwt('B',1);handler({key:'maya_admin_tok'});assert.equal(cleared,1);assert.equal(loads,1);
}
console.log('Client account races: queued/read/delete/legacy cleanup boundaries, A→B→A, normal cleanup and Outbound same-account renewal passed.');
