// Execute the actual Wix lead loader with fake providers: contact reads must
// neither wait for model-generated summaries nor use a ten-minute raw cache.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const start=source.indexOf('let _leadsCache ='),end=source.indexOf('// v13.54:',start);
let queries=0,summaries=0,now=Date.now();
const id='11111111-1111-4111-8111-111111111111';
const formId='d6894a81-9660-42ba-ae5b-874a85024837';
const submission={id,namespace:'wix.form_app.form',formId,createdDate:new Date(now).toISOString(),submissions:{first_name:'Test',phone:'+14155550123',what_are_you_picturing:'A garment with an original silhouette'}};
const FakeDate=class extends Date{static now(){return now;}};
const load=new Function('WIX_KEY','WIX_SITE','LEADS_DAYS','LEADS_NAMESPACE','LEADS_SKIP_FORMS','LEADS_ONLY_FORMS','wixFormNames','guessFormName','summarizeLead','fetch','AbortSignal','Date',source.slice(start,end)+';return wixLeads;')(
 'fake','site',365,'wix.form_app.form',/newsletter/,/Call back/,async()=>({[formId]:'Call back'}),()=> 'Call back',async()=>{summaries++;return 'AI summary';},async url=>{queries++;return {ok:true,json:async()=>url.includes('/namespace/query')?{submissions:[submission],metadata:{hasNext:false}}:{submission}};},AbortSignal,FakeDate);
const raw=await load();assert.equal(summaries,0);assert.equal(raw.list[0].phone,'+14155550123');assert.match(raw.list[0].note,/original silhouette/);
await load();assert.equal(queries,1,'Raw reads reuse the short cache');
now+=10001;await load();assert.equal(queries,2,'Raw data refreshes within seconds, not ten minutes');
await load({summaries:true});assert.equal(summaries,1,'AI summaries remain explicit and optional');
await load();assert.equal(summaries,1,'Summary cache cannot change the raw read mode');assert.equal(queries,4);
await load({fresh:true,submissionId:id});assert.equal(summaries,1);assert.equal(queries,5);
await load();assert.equal(queries,6,'Callback event invalidates the general feed cache');
submission.formId='another-form';assert.equal((await load({fresh:true,submissionId:id})).connected,false,'Worker re-fetch verifies the exact callback form');
console.log('PASS lead lookups bypass AI, short cache, isolated summary mode and callback invalidation');

// Full owner reads page beyond the former ten-page/60-row/year boundaries.
let requests=[],mode='normal';
const rows=Array.from({length:120},(_,i)=>({...submission,id:'lead-'+i,formId,createdDate:new Date(now-(i===119?400:i)*86400000).toISOString(),submissions:{...submission.submissions,first_name:'Lead '+i,email:'lead'+i+'@example.test'}}));
const pagedLoad=new Function('WIX_KEY','WIX_SITE','LEADS_DAYS','LEADS_NAMESPACE','LEADS_SKIP_FORMS','LEADS_ONLY_FORMS','wixFormNames','guessFormName','summarizeLead','fetch','AbortSignal','Date',source.slice(start,end)+';return wixLeads;')(
 'fake','site',365,'wix.form_app.form',/newsletter/,/Call back/,async()=>({[formId]:'Call back'}),()=> 'Call back',async()=>{throw Error('No AI in full reads');},async(url,options)=>{
  assert.equal(url,'https://www.wixapis.com/form-submission-service/v4/submissions/namespace/query');
  const body=JSON.parse(options.body),page=Number(body.query.cursorPaging.cursor||0);requests.push(body);
  if(page===1&&mode==='error')throw Error('upstream unavailable');
  return {ok:true,json:async()=>({submissions:rows.slice(page*10,page*10+10),...(mode==='missing'?{}:{metadata:{hasNext:mode==='repeat'||page<11,cursors:{next:mode==='repeat'?'1':String(page+1)}}})})};
 },AbortSignal,FakeDate);
let result=await pagedLoad();assert.equal(result.list.length,60);assert.equal(requests.length,10);assert.equal(result.complete,false,'Default page guard cannot claim a complete feed');
requests=[];result=await pagedLoad({all:true});assert.equal(result.list.length,120);assert.equal(result.complete,true);assert.equal(requests.length,12);assert.equal(result.list.at(-1).id,'lead-119','Full reads include retained callback leads older than one year');
assert.deepEqual(requests[0].query.filter,{namespace:'wix.form_app.form'});assert.deepEqual(Object.keys(requests[1].query),['cursorPaging']);
await pagedLoad({all:true});assert.equal(requests.length,12,'Full raw result uses short cache');
result=await pagedLoad();assert.equal(result.list.length,60,'Full cache never changes default UI window');assert.equal(requests.length,22);
for(const degraded of ['error','missing','repeat']){mode=degraded;requests=[];result=await pagedLoad({all:true,fresh:true});assert.equal(result.complete,false,degraded);assert.ok(result.list.length);assert.ok(requests.length<=2,'Malformed/repeated paging cannot spin');}

// Execute the actual merge/enrichment path, preserving default callers' 60 rows.
const mergeStart=source.indexOf('function applyLatestLeadNote('),mergeEnd=source.indexOf("app.get('/api/admin/leads'",mergeStart);
let notesFail=false,wixFail=false,fullOption;
const original=rows.map((r,i)=>({id:r.id,ts:r.createdDate,name:'Lead '+i,email:'lead'+i+'@example.test',note:'Original'}));
const feedLoad=new Function('wixLeads','loadManualLeads','loadLeadNotes','Date',source.slice(mergeStart,mergeEnd)+';return loadLeadFeed;')(
 async options=>{fullOption=options.all;return wixFail?{connected:false,complete:false,why:'Unavailable'}:{connected:true,complete:true,list:options.all?original:original.slice(0,60)};},
 async()=>({items:[{id:'manual',name:'Manual',ts:new Date(now+1000).toISOString(),stage:'contacted'}],tombstones:['lead-1'],overrides:{'lead-80':{stage:'contacted'}}}),
 async email=>{if(notesFail&&email==='lead95@example.test')throw Error('unavailable');return {notes:[],contacts:email==='lead95@example.test'?[{ts:new Date(now).toISOString(),type:'email'}]:[]};},FakeDate);
result=await feedLoad();assert.equal(fullOption,false);assert.equal(result.list.length,60);
result=await feedLoad({all:true});assert.equal(fullOption,true);assert.equal(result.list.length,120);assert.equal(result.complete,true);assert.equal(result.list[0].id,'manual');assert.ok(!result.list.some(l=>l.id==='lead-1'));assert.equal(result.list.find(l=>l.id==='lead-80').stage,'contacted');assert.equal(result.list.find(l=>l.id==='lead-95').lastContact,'email');assert.equal(original[95].lastContact,undefined,'Enrichment must not mutate shared Wix cache');
notesFail=true;result=await feedLoad({all:true});assert.equal(result.complete,false);assert.equal(result.list.find(l=>l.id==='lead-95').statusUnavailable,true);
wixFail=true;result=await feedLoad({all:true});assert.equal(result.complete,false);assert.equal(result.list.length,1,'Available manual rows remain an explicitly partial report');
console.log('PASS full retained lead pagination, cursor integrity, truthful partials, full enrichment and default UI window');

// A 60-row ordinary UI/phone read starts all note reads together. Only full
// reports batch enrichment, avoiding a new three-wave delay on existing paths.
let noteStarts=0,releaseNotes;
const noteBarrier=new Promise(resolve=>{releaseNotes=resolve;});
const parallelFeed=new Function('wixLeads','loadManualLeads','loadLeadNotes','Date',source.slice(mergeStart,mergeEnd)+';return loadLeadFeed;')(
 async()=>({connected:true,complete:true,list:original.slice(0,60)}),async()=>({items:[]}),async()=>{noteStarts++;await noteBarrier;return {notes:[],contacts:[]};},FakeDate);
const normalRead=parallelFeed();await new Promise(resolve=>setImmediate(resolve));
assert.equal(noteStarts,60,'Ordinary reads must not wait for an earlier 20-note batch');releaseNotes();assert.equal((await normalRead).list.length,60);
console.log('PASS ordinary UI and phone note enrichment remains parallel');
