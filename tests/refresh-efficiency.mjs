import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const front=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
const admin=readFileSync(new URL('../backend/status.html',import.meta.url),'utf8');
const old='a'.repeat(40), next='b'.repeat(40);

async function watchdog(source,isAdmin,commit,{hidden=false,invalid=false,busy=false,saveFails=false}={}){
  let urls=[],reloaded=0,signouts=0,callbacks=[];
  const document={hidden,body:{classList:{contains:()=>busy}},getElementById:()=>null,
    querySelector:s=>({content:s.includes('maya-build')?old:'14.40'}),addEventListener:()=>{}};
  const context=vm.createContext({document,console,Date,isListening:busy,window:{mayaSignOut:async()=>{signouts++;return !saveFails;}},
    location:{reload:()=>reloaded++},setInterval:fn=>callbacks.push(fn),setTimeout:(fn,ms)=>{if(ms===900)fn();},
    fetch:async url=>{urls.push(url);if(url==='/release.json')return {ok:true,json:async()=>invalid?{}:{commit}};
      return {text:async()=>`<meta name="maya-version" content="14.40"><meta name="maya-build" content="${commit}">`};}});
  if(isAdmin){const start=source.indexOf('(function(){\n  const RUN =');const end=source.indexOf('\n})();',start);assert(start>=0&&end>start);vm.runInContext(source.slice(start,end+6),context);await callbacks[0]();}
  else {const start=source.indexOf('const _RUNNING_VERSION =');const end=source.indexOf('setInterval(_checkForUpdate',start);assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),context);await context._checkForUpdate();}
  return {urls,reloaded,signouts};
}
for(const [source,isAdmin] of [[front,false],[admin,true]]){
  let r=await watchdog(source,isAdmin,old);assert.deepEqual(r.urls,['/release.json']);assert.equal(r.reloaded,0);
  r=await watchdog(source,isAdmin,next);assert.deepEqual(r.urls,['/release.json']);assert.equal(r.reloaded,1);if(!isAdmin)assert.equal(r.signouts,1);
  r=await watchdog(source,isAdmin,next,{invalid:true});assert.equal(r.urls.length,2);assert.equal(r.reloaded,1);
  r=await watchdog(source,isAdmin,next,{hidden:true});assert.equal(r.urls.length,0);
  r=await watchdog(source,isAdmin,next,{busy:true});assert.equal(r.reloaded,0);
  if(!isAdmin){r=await watchdog(source,isAdmin,next,{saveFails:true});assert.equal(r.reloaded,0);}
}

let clock=1_000_000, calls=0, arriving=false, visible=true, tick;
const doc={get visibilityState(){return visible?'visible':'hidden';},querySelector:()=>arriving?{}:null};
const context=vm.createContext({document:doc,_idTok:'token',loadSubmissions:()=>calls++,Date:{now:()=>clock},setInterval:fn=>tick=fn});
const start=admin.indexOf('let _subsQuick =');const end=admin.indexOf('// The meter moves',start);assert(start>=0&&end>start);
vm.runInContext(admin.slice(start,end),context);
for(let i=0;i<7;i++){tick();clock+=5000;}assert.equal(calls,3,'normal polling is at most once every 15 seconds');
visible=false;tick();assert.equal(calls,3);
visible=true;arriving=true;tick();clock+=5000;tick();assert.equal(calls,5,'arriving submissions retain the quick refresh');
assert.equal((admin.match(/setInterval\(\(\) => \{\s*if \(_idTok && document\.visibilityState === 'visible'\) loadTraffic\(\)/g)||[]).length,1);
assert.equal((admin.match(/dispatchEvent\(new CustomEvent\('maya-model-snapshot'/g)||[]).length,1);
let msgTick,threadCalls=0,listCalls=0,bookingCalls=0;
const msgDoc={get visibilityState(){return visible?'visible':'hidden';},getElementById:()=>({scrollLeft:200,scrollWidth:300,clientWidth:100})};
const msgContext=vm.createContext({document:msgDoc,_msgOpen:{number:'fixture'},loadThread:()=>threadCalls++,loadThreads:()=>listCalls++,loadBookingPending:()=>bookingCalls++,setInterval:fn=>msgTick=fn});
const msgStart=admin.indexOf("setInterval(() => { if(document.visibilityState!=='visible')return;const hs=");
const msgEnd=admin.indexOf('}, 8000)',msgStart);assert(msgStart>=0&&msgEnd>msgStart);
vm.runInContext(admin.slice(msgStart,msgEnd+8),msgContext);
visible=false;msgTick();assert.deepEqual([threadCalls,listCalls,bookingCalls],[0,0,0]);
visible=true;msgTick();assert.deepEqual([threadCalls,listCalls,bookingCalls],[1,0,1]);
assert(admin.includes("_msgTab !== 'messages' && document.visibilityState === 'visible'"));
console.log('Refresh efficiency: release marker, safe fallback, voice deferral, visibility and polling cadence passed.');
