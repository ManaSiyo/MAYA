import assert from 'node:assert/strict';
import {createLeadAlerts} from '../docs/server/lead-alerts.mjs';
const files=new Map();let seq=0,texts=0,calls=0;
const now=Date.parse('2026-09-30T19:00:00Z');
const store={
  read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
  write:async(key,buf,_,expected)=>{if(expected!==(files.get(key)?.generation||'0'))throw Object.assign(Error('conflict'),{status:412});files.set(key,{value:JSON.parse(buf),generation:String(++seq)});},
};
const alerts=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:true,list:[
  {id:'new',source:'wix',name:'Nick',ts:'2026-09-30T18:25:49Z',wrote:'A custom suit'},
  {id:'old',source:'wix',name:'Older',ts:'2026-09-05T18:00:00Z'},
  {id:'manual',source:'maya',name:'Manual',ts:'2026-09-30T18:00:00Z'},
]}),textOwner:async body=>{texts++;assert.match(body,/Nick/);return {ok:true}},callOwner:async reason=>{calls++;assert.match(reason,/Nick/);return {ok:true}}});
assert.deepEqual(await alerts.run(),{checked:1,texts:1,calls:1,failed:[]});
assert.deepEqual(await alerts.run(),{checked:1,texts:0,calls:0,failed:[]});
assert.equal(texts,1);assert.equal(calls,1);
let retryNow=now,attempts=0;
const retry=createLeadAlerts({...store,now:()=>retryNow,fetchLeads:async()=>({connected:true,list:[
  {id:'retry',source:'wix',name:'Retry',ts:'2026-09-30T18:25:49Z'},
]}),textOwner:async()=>({ok:++attempts>1}),callOwner:async()=>({ok:true})});
assert.equal((await retry.run()).failed.length,1);
assert.equal((await retry.run()).texts,0);
retryNow+=15*60000;
assert.equal((await retry.run()).texts,1);
assert.equal(attempts,2);
const uncertain=createLeadAlerts({...store,now:()=>retryNow,fetchLeads:async()=>({connected:true,list:[
  {id:'uncertain',source:'wix',name:'Uncertain',ts:'2026-09-30T18:25:49Z'},
]}),textOwner:async()=>({ok:false,why:'Twilio did not answer: timeout'}),callOwner:async()=>({ok:true})});
assert.equal((await uncertain.run()).failed.length,1);
retryNow+=15*60000;
assert.equal((await uncertain.run()).texts,0);
const disconnected=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:false})});
await assert.rejects(disconnected.run(),/unavailable/);
console.log('Lead alerts: new Call back submission, deduplication, old/manual exclusion, outage.');

// Failure paths must preserve independent channels and expose durable evidence.
let formatCalls=0;
const fallback=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:true,list:[{id:'format-failure',source:'wix',name:'Fallback',phone:'+14155550101',ts:new Date(now).toISOString()}]}),formatText:async()=>{throw Error('preference storage unavailable');},textOwner:async body=>{assert.match(body,/Fallback/);return {ok:true,sid:'SMfallback',status:'queued'};},callOwner:async()=>{formatCalls++;return {ok:true,sid:'CAfallback'};}});
await fallback.run({source:'scheduled'});assert.equal(formatCalls,1);
const observed=await fallback.status();assert.equal(observed.health.lastSource,'scheduled');assert.equal(observed.health.lastScheduledAt,new Date(now).toISOString());assert.equal(observed.items[0].textSid,'SMfallback');assert.equal(observed.items[0].textStatus,'queued');assert.equal(observed.items[0].callSid,'CAfallback');assert.equal(observed.pending,0);
await disconnected.run().catch(()=>{});assert.match((await disconnected.status()).health.lastError,/unavailable/);
const beforeStatus=texts+calls;await alerts.status();assert.equal(texts+calls,beforeStatus,'Reading status must never send');
let independentCalls=0;
const throws=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:true,list:[{id:'throws',source:'wix',name:'Throws',ts:new Date(now).toISOString()}]}),textOwner:async()=>{throw Error('socket reset');},callOwner:async()=>{independentCalls++;return {ok:true};}});
assert.equal((await throws.run()).failed.length,1);assert.equal(independentCalls,1);await throws.run();assert.equal(independentCalls,1);assert.equal((await throws.status()).items[0].text,'uncertain');

// Isolated route tests prove owner-only read and Scheduler-only execution.
const {mountLeadAlertRoutes}=await import('../docs/server/lead-alerts.mjs');
const routes=new Map();let ran=0,available=true,failed=false;
mountLeadAlertRoutes({get:(path,...handlers)=>routes.set('GET '+path,handlers.at(-1)),post:(path,...handlers)=>routes.set('POST '+path,handlers.at(-1))},{requireAuthHeader:()=>{},requireOwner:async req=>{if(req.kind!=='owner')throw Object.assign(Error('Denied'),{status:403});},verifyScheduler:async req=>{if(req.kind!=='scheduler')throw Object.assign(Error('Denied'),{status:401});},getAlerts:()=>available?{status:async()=>({pending:1}),run:async options=>{assert.equal(options.source,'scheduled');ran++;return {checked:1,texts:0,calls:0,failed:failed?[{channel:'text',why:'refused'}]:[]};}}:null,readiness:()=>({schedulerConfigured:true})});
const response=()=>({code:200,set(){return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
for(const kind of ['anonymous','owner']){const res=response();await routes.get('POST /api/tasks/lead-alerts')({kind},res);assert.equal(res.code,401);}assert.equal(ran,0);
let res=response();await routes.get('GET /api/admin/lead-alerts/status')({kind:'anonymous'},res);assert.equal(res.code,403);
res=response();await routes.get('GET /api/admin/lead-alerts/status')({kind:'owner'},res);assert.equal(res.body.pending,1);assert.equal(ran,0);
res=response();await routes.get('POST /api/tasks/lead-alerts')({kind:'scheduler'},res);assert.equal(res.code,200);assert.equal(ran,1);
failed=true;res=response();await routes.get('POST /api/tasks/lead-alerts')({kind:'scheduler'},res);assert.equal(res.code,503);assert.equal(res.body.ok,false);
available=false;res=response();await routes.get('POST /api/tasks/lead-alerts')({kind:'scheduler'},res);assert.equal(res.code,503);
console.log('Callback diagnostics, format fallback, independent channels and dedicated owner/Scheduler route guards passed.');

// An unknown previous attempt remains a visible failure, never a false healthy run.
assert.equal((await throws.run()).failed.length,1);
assert.equal((await throws.status()).health.lastResult.failed.length,1);

// Failed durable claims must not reach either provider.
let forbiddenSends=0;
const noClaims=createLeadAlerts({...store,now:()=>now,write:async(key,...args)=>{if(key.endsWith('/callbacks.json'))throw Error('storage down');return store.write(key,...args);},fetchLeads:async()=>({connected:true,list:[{id:'no-claims',source:'wix',name:'No claims',ts:new Date(now).toISOString()}]}),textOwner:async()=>{forbiddenSends++;return {ok:true};},callOwner:async()=>{forbiddenSends++;return {ok:true};}});
assert.equal((await noClaims.run()).failed.length,2);assert.equal(forbiddenSends,0);

// Overlapping workers share generation claims: one text and one call only.
const parallelFiles=new Map();let parallelSeq=0,parallelTexts=0,parallelCalls=0;
const parallelStore={read:async key=>parallelFiles.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(parallelFiles.get(key).value)),generation:parallelFiles.get(key).generation}:{ok:false,status:404},write:async(key,buf,_,expected)=>{if(expected!==(parallelFiles.get(key)?.generation||'0'))throw Object.assign(Error('conflict'),{status:412});parallelFiles.set(key,{value:JSON.parse(buf),generation:String(++parallelSeq)});}};
const concurrent=createLeadAlerts({...parallelStore,now:()=>now,fetchLeads:async()=>({connected:true,list:[{id:'concurrent',source:'wix',name:'Concurrent',ts:new Date(now).toISOString()}]}),textOwner:async()=>{parallelTexts++;return {ok:true,sid:'SMconcurrent'};},callOwner:async()=>{parallelCalls++;return {ok:true,sid:'CAconcurrent'};}});
await Promise.all([concurrent.run(),concurrent.run()]);assert.equal(parallelTexts,1);assert.equal(parallelCalls,1);

// Admin reports failures without HTML injection or leaking a late account response.
const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
const admin=await readFile(new URL('../backend/status.html',import.meta.url),'utf8');
const statusFunction=admin.slice(admin.indexOf('let _callbackStatusBusy=false;'),admin.indexOf('async function checkLeadAlerts('));
const note={style:{},textContent:''};let resolveStatus;
const context={IS_AFFILIATES:false,_idTok:'owner-a',document:{getElementById:()=>note},Date,fetch:async()=>({ok:true,json:async()=>({ok:true,readiness:{schedulerConfigured:false,smsConfigured:true,voiceConfigured:true,ownerNumberConfigured:true},feed:{connected:true},items:[{name:'Julia',text:'failed',textError:'provider refused',call:'accepted'}]})})};
runInNewContext(statusFunction,context);await context.loadLeadAlertStatus();assert.match(note.textContent,/Immediate Wix callback trigger is not configured/);assert.match(note.textContent,/Julia: text failed/);assert.equal(note.style.display,'block');
context.fetch=()=>new Promise(resolve=>{resolveStatus=resolve;});const late=context.loadLeadAlertStatus();context._idTok='owner-b';const oldText=note.textContent;resolveStatus({ok:true,json:async()=>({ok:true,readiness:{},feed:{},items:[{name:'Other account'}]})});await late;assert.equal(note.textContent,oldText);
console.log('Concurrent claims, storage failure, persistent uncertainty and account-safe Admin warnings passed.');

// A blocked SMS formatter/provider cannot hold up the independent owner call.
let releaseText,ringed=false;
const fast=createLeadAlerts({...parallelStore,now:()=>now,fetchLeads:async id=>({connected:true,list:[{id:'fast',source:'wix',name:'Fast',ts:new Date(now).toISOString()},{id:'unrelated',source:'wix',name:'Unrelated',ts:new Date(now).toISOString()}]}),formatText:()=>new Promise(resolve=>{releaseText=resolve;}),textOwner:async()=>({ok:true}),callOwner:async()=>{ringed=true;return {ok:true};}});
const running=fast.run({source:'wix-event',submissionId:'fast'});
for(let i=0;i<50&&!ringed;i++)await new Promise(r=>setTimeout(r,1));
assert.equal(ringed,true,'Owner rings before SMS formatting resolves');releaseText('Fast');
assert.equal((await running).checked,1,'Immediate event sends only its verified submission');
const timing=(await fast.status()).items.find(l=>l.id==='fast');assert.equal(timing.callLeadAgeMs,0);assert.equal(timing.callProviderMs,0);
console.log('Immediate submission scoping, parallel owner ring and durable dispatch timing passed.');
