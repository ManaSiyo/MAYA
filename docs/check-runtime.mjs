// Behavioral checks retained from the old test tree. Fake providers only.
// Each named check has its own scope; run all through node docs/check.mjs.
export const checks = {};

checks['frontend-pinterest-performance']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{parseHTML}=await import('linkedom');
 const source=readFileSync('frontend/index.html','utf8'),{document}=parseHTML('<html><body><div id="pinterest-drawer"><span id="pin-drawer-title"></span><div id="pin-tabs"><button id="pin-tab-all"></button><button id="pin-tab-boards"></button><input id="pin-search-input"></div><div id="pinterest-drawer-body"></div><div id="pin-drawer-foot"><button id="pin-import-btn"></button></div></div></body></html>');
 let owner='A',googleOwner='A',project='first',signedIn=true;const requests=[],held=new Map(),imports=[],notices=[],observers=[];
 const token=who=>'fixture.'+Buffer.from(JSON.stringify({sub:who,exp:Date.now()/1000+3600})).toString('base64')+'.fixture';
 const delay=()=>new Promise(resolve=>setTimeout(resolve,0)),settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const hold=(who,path)=>{let release;const promise=new Promise(resolve=>release=resolve);held.set(who+'|'+path,{promise,release});return release;};
 const c=vm.createContext({document,URLSearchParams,DOMException,AbortController,atob,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:fn=>setTimeout(fn,0),console,
  location:{origin:'https://maya.test'},addEventListener(){},removeEventListener(){},getApiKey:()=>signedIn?token(googleOwner):'',projectStore:{_uid:()=>signedIn?'firebase-'+owner:null},firebase:{auth:()=>({currentUser:signedIn?{uid:'firebase-'+owner,providerData:[{providerId:'google.com',uid:owner}]}:null})},
  escapeHtml:v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),_safeImgSrc:v=>v,showToast:v=>notices.push(v),showError:v=>notices.push(v),
  _opContext:()=>({owner,project}),_opStillValid:ctx=>ctx.owner===owner&&ctx.project===project,
  importPictureFromUrl:(url,alt,options)=>new Promise(resolve=>imports.push({url,alt,options,resolve})),
  IntersectionObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(el){this.el=el;}disconnect(){this.el=null;}},
  fetch:async(path,options)=>{const who=JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64')).sub;requests.push({who,path,signal:options.signal});await held.get(who+'|'+path)?.promise;
   const u=new URL(path,'https://maya.test'),board=u.searchParams.get('board')||'all';let data;
   const pin=i=>({id:who+'-'+board+'-'+i,url:'https://pinimg.example/'+who+'/'+board+'/'+i+'.jpg',alt:'Wool coat '+i});
   if(u.pathname==='/api/pinterest/status')data={configured:true,connected:true};
   else if(u.pathname==='/api/pinterest/boards')data={boards:[{id:'coats',name:'Coats',pins:6,cover:pin(0).url},{id:'slow',name:'Slow board',pins:6,cover:pin(1).url}]};
   else if(u.pathname==='/api/pinterest/pins')data=u.searchParams.has('bookmark')?{pins:[pin(0),pin(6)],bookmark:''}:{pins:Array.from({length:6},(_,i)=>pin(i)),bookmark:'next'};
   else if(u.pathname==='/api/pinterest/everywhere')data={pins:[{id:'search',url:'https://pinimg.example/'+who+'/search.jpg',alt:'Search coat'}]};
   else throw Error('Unexpected Pinterest request '+path);
   return {ok:true,json:async()=>data};}
 });c.window=c;
 const start=source.indexOf('const PIN_PICK_MAX'),end=source.indexOf('// v13.41: FEEDBACK.',start);vm.runInContext(source.slice(start,end),c);
 vm.runInContext(source.slice(source.indexOf('function _pinSearch(q)'),source.indexOf('// v14.13: one step, the right kind.')),c);
 const run=code=>vm.runInContext(code,c),body=document.getElementById('pinterest-drawer-body'),count=path=>requests.filter(r=>r.path===path).length;
 c._pinAccountChanged();assert.equal(requests.length,0,'Login warmup waits until after the first paint');
 for(let i=0;i<20&&requests.length<2;i++)await delay();await settle();
 assert.deepEqual(requests.map(r=>r.path),['/api/pinterest/status','/api/pinterest/pins?']);assert.equal(body.childElementCount,0,'Preload keeps the hidden drawer unmounted');assert.equal(document.getElementById('pinterest-drawer').classList.contains('open'),false);
 assert.equal(run('[..._pinSession.pages.get("all").grid.querySelectorAll("img")].filter(img=>img.loading==="eager").length'),4,'Warmup is bounded to four first-page photographs');assert.equal(notices.length,0);
 await c.openPinterestDrawer();const first=body.querySelector('img'),allGrid=body.querySelector('.pin-grid');body.scrollTop=137;c._pinToggle(body.querySelector('.pin-pic'));
 for(let i=0;i<10;i++){project='new-project-'+i;c.closePinterestDrawer();await c.openPinterestDrawer();await c.setPinterestTab('all');}
 assert.equal(body.querySelector('img'),first);assert.equal(body.querySelector('.pin-grid'),allGrid);assert.equal(body.scrollTop,137);assert.equal(body.querySelector('.pin-pic').classList.contains('picked'),true);assert.equal(requests.length,2,'Ten new projects and drawer reopenings reuse the two warmup reads');
 await Promise.all([c.setPinterestTab('boards'),c.setPinterestTab('boards')]);const boardImage=body.querySelector('img');body.scrollTop=81;
 for(let i=0;i<10;i++){await c.setPinterestTab('all');assert.equal(body.querySelector('img'),first);await c.setPinterestTab('boards');assert.equal(body.querySelector('img'),boardImage);}
 assert.equal(count('/api/pinterest/boards'),1);assert.equal(count('/api/pinterest/pins?'),1);assert.equal(body.scrollTop,81,'Cached board directory preserves its scroll position');
 await Promise.all([c._pinDrawerPins('coats','Coats'),c._pinDrawerPins('coats','Coats')]);const coatImage=body.querySelector('img');assert.equal(count('/api/pinterest/pins?board=coats'),1);
 await c.setPinterestTab('all');await Promise.all([c._pinLoadNext(),c._pinLoadNext()]);assert.equal(count('/api/pinterest/pins?bookmark=next'),1);assert.equal(body.querySelectorAll('.pin-pic').length,7,'Pagination appends only the unseen pin');assert.equal(body.querySelector('img'),first);
 const releaseSlow=hold('A','/api/pinterest/pins?board=slow'),slow=c._pinDrawerPins('slow','Slow board');await c.setPinterestTab('all');releaseSlow();await slow;assert.equal(body.querySelector('img'),first,'An inactive board response cannot replace the active wall');await c._pinDrawerPins('slow','Slow board');assert.equal(count('/api/pinterest/pins?board=slow'),1);
 await c._pinDrawerPins('coats','Coats');assert.equal(body.querySelector('img'),coatImage);body.scrollTop=99;const beforeSearch=requests.length;c._pinSearchInput('wool');await settle();assert.equal(requests.length,beforeSearch,'Typing never runs a provider search');
 await c._pinWideSearch('coat','everywhere');assert.match(body.querySelector('img').src,/search/);c._pinSearchRestore();assert.equal(body.querySelector('img'),coatImage);assert.equal(body.scrollTop,99,'Clearing wider search restores the same board and scroll');assert.equal(requests.length,beforeSearch+1);
 const releaseOld=hold('A','/api/pinterest/pins?board=stale'),stale=c._pinDrawerPins('stale','Stale board');const oldRequest=requests.at(-1);owner=googleOwner='B';c._pinAccountChanged();assert.equal(body.childElementCount,0);assert.equal(oldRequest.signal.aborted,true);await c._pinDrawerBoot();releaseOld();await stale;assert.ok(body.querySelector('img').src.includes('/B/'),'Old account response stays discarded');
 const beforeMismatch=requests.length;googleOwner='C';c._pinAccountChanged();assert.equal(body.childElementCount,0);await settle();assert.equal(requests.length,beforeMismatch,'Google/Firebase identity mismatch clears old data without starting new reads');
 owner='C';c._pinAccountChanged();await c._pinDrawerBoot();assert.ok(body.querySelector('img').src.includes('/C/'));
 body.querySelectorAll('.pin-pic').forEach(el=>c._pinToggle(el));const batch=c._pinImport();await settle();assert.equal(imports.length,2);assert.ok(imports.every(i=>i.options.context.project===project));project='another-project';imports.forEach(i=>i.resolve(false));await batch;assert.equal(imports.length,2,'Project change cancels the rest of the selected-pin import queue');
 signedIn=false;c._pinAccountChanged();assert.equal(body.childElementCount,0);assert.equal(run('_pinSession'),null);
 assert.match(source,/\_firebaseAuthUid = nextUid;\s*try \{ if\(typeof _pinAccountChanged/);assert.match(source,/_googleIdToken = null;[\s\S]*?_pinClearAccount/);
 console.log('Pinterest performance: 2 warmup reads, 4 eager thumbnails, 10 project reopenings + 20 tab swaps with 0 repeat page reads; image/grid identity and scroll retained; pagination, search, account cancellation and import isolation passed.');
};

checks['deployment-verification']=async function(){
 const {default:assert}=await import('node:assert/strict'),{verifyDeployment}=await import('./build-site.mjs');
 const commit='a'.repeat(40),seen=[];let fault='';
 const fetchImpl=async(url,options)=>{
  const u=new URL(url),path=u.pathname;seen.push(path);assert.equal(u.hostname,'maya.manasiyo.com');assert.equal(u.searchParams.get('release_check'),commit);assert.equal(options.headers['Cache-Control'],'no-cache');
  if(fault==='http'&&path==='/release.json')return new Response('',{status:503});
  const actual=fault===path?'b'.repeat(40):commit;
  return path==='/release.json'||path==='/api/healthz'?Response.json({commit:actual}):new Response(fault==='missing'&&path==='/backend.html'?'<head></head>':'<head><meta name="maya-build" content="'+actual+'"></head>');
 };
 assert.equal((await verifyDeployment(commit,{fetchImpl})).paths.length,7);assert.equal(seen.length,7);
 for(fault of ['/api/healthz','/backend.html','/backend2.html','/backend/operation-workspace.html','missing','http'])await assert.rejects(verifyDeployment(commit,{fetchImpl}),/Production release is not verified/);
 await assert.rejects(verifyDeployment('short',{fetchImpl}),/full Git commit/);
 console.log('Production verification: exact Hosting/API/Brief/iframe stamps required; stale, missing and failed responses cannot report success.');
};

checks['server-startup']=async function(){
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import http from 'node:http';
  const listen=http.Server.prototype.listen;let server;
  http.Server.prototype.listen=function(_port,callback){server=this;return listen.call(this,0,'127.0.0.1',callback);};
  globalThis.fetch=async()=>{throw Error('External provider access is disabled in startup tests');};
  globalThis.setInterval=()=>({unref(){}});
  await import('./backend/server/server.js');
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const request=path=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,path},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));}).once('error',reject));
  assert.equal(await request('/api/healthz'),200);
  for(const path of ['/api/source-fabric','/api/rank-fabric','/api/visualize-fabric'])assert.equal(await request(path),410);
  assert.equal(await request('/api/admin/models'),401);
  server.close();process.exit(0);
 `],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,K_SERVICE:'fixture-cloud-run',PORT:'0'},encoding:'utf8',timeout:10000});
 const {default:assert}=await import('node:assert/strict');assert.equal(result.status,0,result.stdout+result.stderr);
};

checks['lead-store']=async function(){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const {createLeadStore,createLeadNoteStore}=await import('../backend/server/lead-store.mjs');

const files=new Map();let generation=0,writes=0,conflicts=0;
const storage={
  read:async key=>{const item=files.get(key);return item?{ok:true,generation:item.generation,buf:Buffer.from(JSON.stringify(item.value))}:{ok:false,status:404};},
  write:async(key,buf,type,expected)=>{writes++;if(expected!==(files.get(key)?.generation||'0')){conflicts++;throw Object.assign(Error('conflict'),{status:412});}files.set(key,{generation:String(++generation),value:JSON.parse(buf)});},
};
let clock='2026-10-07T14:00:00Z';const deps={...storage,now:()=>clock},leads=createLeadStore(deps);
const alice=await leads.add({name:'Alice',email:'Alice@EXAMPLE.com',note:'Original'});
assert.equal(alice.email,'alice@example.com');
await Promise.all([leads.update(alice.id,{phone:'+14155550123'}),leads.ownerCommit({action:'update',id:alice.id,displayName:'Alice',note:'Reviewed owner note'},'sms_one')]);
let record=await leads.read(),updated=record.items.find(x=>x.id===alice.id);
assert.equal(updated.phone,'+14155550123');assert.equal(updated.note,'Reviewed owner note');assert.equal(updated.noteUpdatedAt,clock);assert.ok(conflicts>0);
const server=readFileSync(new URL('../backend/server/server.js',import.meta.url),'utf8');
const ctx={lead:structuredClone(updated),note:{ts:'2020-01-01',text:'Older email note'}};
runInNewContext(server.slice(server.indexOf('function applyLatestLeadNote('),server.indexOf('async function loadLeadFeed('))+'\napplyLatestLeadNote(lead,note);',ctx);
assert.equal(ctx.lead.note,'Reviewed owner note');
clock='2026-10-08T14:00:00Z';await leads.ownerCommit({action:'update',id:alice.id,displayName:'Alice',note:'Wrong replay'},'sms_one');
assert.equal((await leads.read()).items[0].note,'Reviewed owner note');
const request={uid:'admin-a',requestId:'12345678-1234-1234-1234-123456789abc'};
const [first,replay]=await Promise.all([leads.add({name:'Bob'},request),leads.add({name:'Bob'},request)]);
assert.equal(first.id,replay.id);assert.equal((await leads.read()).items.filter(x=>x.name==='Bob').length,1);
await assert.rejects(leads.add({name:'Different'},request),e=>e.status===409);
assert.notEqual((await leads.add({name:'Bob'},{...request,uid:'admin-b'})).id,first.id);
let uncertain=true;
const ambiguous=createLeadStore({...deps,write:async(...args)=>{await storage.write(...args);if(uncertain){uncertain=false;throw Error('response lost after durable save');}}});
const uncertainRequest={...request,requestId:'uncertain-reviewed-request-00001'};
await assert.rejects(ambiguous.add({name:'Uncertain'},uncertainRequest),/response lost/);
const recovered=await createLeadStore(deps).add({name:'Uncertain'},uncertainRequest);
assert.equal((await leads.read()).items.filter(x=>x.name==='Uncertain').length,1);assert.ok(recovered.id);
await leads.remove(first.id);await leads.add({name:'Bob'},request);assert.ok(!(await leads.read()).items.some(x=>x.id===first.id),'Replay cannot resurrect a removed lead');
await Promise.all([leads.update(alice.id,{stage:'completed'}),leads.remove('wix-removed')]);
record=await leads.read();assert.equal(record.items.find(x=>x.id===alice.id).stage,'completed');assert.ok(record.tombstones.includes('wix-removed'));assert.ok(record.ownerRequests.sms_one);
assert.equal(await leads.update('wix-removed',{note:'Do not resurrect'}),null);
const many=Array.from({length:205},(_,i)=>({id:'m_old'+i,name:'Legacy '+i}));
files.set('many',{generation:String(++generation),value:{items:many,legacyMetadata:{keep:true}}});
const oldStore=createLeadStore({...deps,path:'many'});await oldStore.add({name:'New'});assert.equal((await oldStore.read()).items.length,206);assert.deepEqual((await oldStore.read()).legacyMetadata,{keep:true});

for(const value of [{ok:false,status:503},{ok:true,generation:'9',buf:Buffer.from('{')},{ok:true,generation:'9',buf:Buffer.from('{}')},{ok:true,generation:'9',buf:Buffer.from('{"items":"broken"}')},{ok:true,buf:Buffer.from('{"items":[]}')}]){
  let badWrites=0;const broken=createLeadStore({read:async()=>value,write:async()=>badWrites++});
  for(const action of [()=>broken.read(),()=>broken.add({name:'New'}),()=>broken.update(alice.id,{name:'Changed'}),()=>broken.remove('wix-id'),()=>broken.ownerCommit({action:'add',name:'New'},'sms_new')])await assert.rejects(action);
  assert.equal(badWrites,0);
}
const notePath=email=>'legacy-notes/'+email,notes=createLeadNoteStore({...deps,path:notePath});
await Promise.all([notes.append('Alice@EXAMPLE.com',{note:'One'}),notes.append('alice@example.com',{note:'Two',contact:'call'})]);
const savedNotes=await notes.read('alice@example.com');assert.equal(savedNotes.notes.length,2);assert.equal(savedNotes.contacts.length,1);
savedNotes.notes.length=0;assert.equal((await notes.read('alice@example.com')).notes.length,2);
const failing=createLeadNoteStore({...deps,path:notePath,write:async()=>{throw Error('write failed');}});
await assert.rejects(failing.append('alice@example.com',{note:'Never saved'}));assert.equal((await notes.read('alice@example.com')).notes.length,2);
for(const value of [{ok:false,status:503},{ok:true,generation:'2',buf:Buffer.from('{')},{ok:true,generation:'2',buf:Buffer.from('{}')}]){
  let badWrites=0;const broken=createLeadNoteStore({read:async()=>value,write:async()=>badWrites++,path:notePath});
  await assert.rejects(broken.append('alice@example.com',{note:'New'}));assert.equal(badWrites,0);
}
// The real production phone adapter must return a complete corrected lead.
const adapterSource=server.slice(server.indexOf('    saveLead: async (lead, prevId) => {'),server.indexOf('    saveTranscript: async',server.indexOf('    saveLead: async (lead, prevId) => {')));
const phoneContext={_leadsCache:{},updateLead:(...args)=>leads.update(...args),appendManualLead:(...args)=>leads.add(...args),_messages:{name:async()=>{}}};
runInNewContext('phone={'+adapterSource+'};',phoneContext);
const corrected=await phoneContext.phone.saveLead({name:'Alice corrected',phone:'+14155550123',wrote:'Corrected request'},alice.id);
assert.equal(corrected.id,alice.id);assert.equal(corrected.name,'Alice corrected');assert.equal(corrected.wrote,'Corrected request');assert.equal(corrected.email,'alice@example.com');
assert.ok(!/gcsPut\(MAYA_LEADS_PATH|gcsPut\(leadNotePath/.test(server),'All lead/note writers share the checked store');
console.log('Lead store: fail-closed reads, cross-writer CAS, idempotent account-bound adds, preserved history/tombstones, note precedence and production phone adapter passed.');

};

checks['owner-sms-access']=async function(){
const {default:assert}=await import('node:assert/strict');
const {createOwnerSMSAccess,messageLines}=await import('../backend/server/owner-sms-access.mjs');
const {createMessageArchive}=await import('../backend/server/message-archive.mjs');
const {createMessageStore}=await import('../backend/server/maya-messages.mjs');
const {createOwnerConversation}=await import('../backend/server/owner-conversation.mjs');
const {createOwnerCRM}=await import('../backend/server/owner-crm.mjs');
const files=new Map();let revision=0,now=Date.now(),sends=0,ai=0,blocked=false,changed=false,uncertain=false;
const storage={read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
 write:async(key,buf,type,expected)=>{assert.equal(expected,files.get(key)?.generation||'0');files.set(key,{value:JSON.parse(buf),generation:String(++revision)});}};
const client='+14155550100',owner='+15105550100';
let rec={threads:{}};
const archive=createMessageArchive(storage);
const threads=createMessageStore({load:async()=>structuredClone(rec),save:async value=>{rec=structuredClone(value);},archive});
await threads.name(client,'Nick One');
await threads.inbound({from:client,text:'Hi Maya, I need a blue suit.',sid:'SMclient'});
await threads.outbound({to:client,text:'Hi Nick, would Thursday work?',sid:'SMreply',status:'delivered',by:'maya'});
await threads.call({number:client,dir:'in',seconds:42,transcript:[{who:'caller',text:'What fabric?'},{who:'maya',text:'Linen is available.'}]});
const deps={...storage,ownerNumber:owner,now:()=>now,threads,find:async q=>({ok:true,lead:{id:'leadnick',name:q,phone:client}}),leadById:async()=>({phone:changed?'+14155550101':client}),
 sendClient:async(number,text)=>{sends++;assert.equal(number,client);if(uncertain)throw new Error('timeout');await threads.outbound({to:number,text,sid:'SMsent'+sends,status:'queued',by:'owner-sms'});return {ok:true,sid:'SMsent'+sends};},
 audit:async()=>['Signup text accepted; call attempted.'],features:async()=>['2026-10-01 | requested | New tool'],status:async()=>'Read commands available; AI limit reached.'};
const access=createOwnerSMSAccess(deps);
const crm=createOwnerCRM({...storage,ownerNumber:owner,ownerEmails:['owner@example.com'],direct:access.direct,converse:async()=>{ai++;return {action:'chat',reply:'Hello'};}});
await crm.bind({sub:'owner',email:'owner@example.com'});
const sms=(text,sid)=>crm.handle({from:owner,text,sid});
assert.equal(await crm.handle({from:'+15105550101',text:'THREAD Nick',sid:'SMstranger'}),'');
const phoneConversation=createOwnerConversation({...storage,ownerNumber:owner,smsAction:access.act});
assert.match((await phoneConversation.phoneControl(owner,{action:'client_history',query:'Nick'},'voice_history')).reply,/Thursday work/);
await assert.rejects(phoneConversation.phoneControl('+15105550101',{action:'client_history',query:'Nick'},'forged'),/Verified owner/);
await assert.rejects(phoneConversation.act('owner',{action:'sms_send',code:'00000000'},'ai_send'),/not available/);
const report=await sms('Where did you text Nick?','SMhistory');assert.match(report,/Thursday work/);assert.match(report,/blue suit/);assert.match(report,/delivered/);assert.match(report,/Linen is available/);assert.equal(ai,0);
assert.equal(await sms('Where did you text Nick?','SMhistory'),report);
assert.match(await sms('STATUS','SMstatus'),/AI limit reached/);assert.equal(ai,0);
assert.match(await sms('MAYA HELP','SMhelp'),/THREAD Nick/);assert.match(await sms('INBOX','SMinbox'),/Nick One/);
assert.match(await sms('FEATURES','SMfeatures'),/New tool/);
assert.match(await sms('ACTIONS','SMactions'),/Thursday work/);
await threads.name('+14155550101','Nick Two');
assert.match(await sms('THREAD Nick','SMambiguous'),/More than one contact/);
assert.match(await sms('THREAD '+client,'SMexact'),/Thursday work/);
await threads.remove('+14155550101');
for(let i=0;i<405;i++)await threads.inbound({from:client,text:'Entry '+i+' 🙂'.repeat(10),sid:'SMentry'+i});
assert.equal((await threads.get(client)).messages.length,400);
const history=await threads.history(client);assert.equal(history.messages.length,408);assert.ok(history.messages.some(m=>m.id==='SMclient'));
await threads.status({sid:'SMreply',status:'undelivered',errorCode:30034});
assert.equal((await threads.history(client)).messages.find(m=>m.id==='SMreply').status,'delivered');
await threads.outbound({to:client,text:'Archived queued',sid:'SMqueued',status:'queued'});
for(let i=0;i<401;i++)await threads.inbound({from:client,text:'Later '+i,sid:'SMlater'+i});
await threads.status({sid:'SMqueued',status:'undelivered',errorCode:30034});
assert.equal((await threads.history(client)).messages.find(m=>m.id==='SMqueued').errorCode,'30034');
const paged=await sms('THREAD '+client,'SMpaged');assert.ok(paged.length<1600);assert.match(paged,/Next: MORE/);
let next=paged.match(/Next: (MORE \w+ \d+)/)[1],full=paged.split('\n').slice(1,-1).join('\n'),pages=1;
while(next){const page=await sms(next,'SMpage'+pages++);assert.ok(page.length<1600);full+=page.split('\n').slice(1,-1).join('\n');next=page.match(/Next: (MORE \w+ \d+)/)?.[1];}
assert.match(full,/blue suit/);assert.match(full,/Thursday work/);assert.match(full,/Linen is available/);
const code=paged.match(/MORE (\w+) /)[1];assert.match(await sms('MORE '+code+' 99999','SMbadpage'),/Choose page/);
assert.match(await access.direct('another-owner','MORE '+code+' 1','cross').catch(e=>e.message),/expired or code/);
await threads.inbound({from:client,text:'Newer message after snapshot',sid:'SMafterreport'});
const recreated=createOwnerSMSAccess(deps);assert.equal((await recreated.direct('owner','MORE '+code+' 1','reboot')).reply,paged);
const preview=await sms('REPLY '+client+': Thursday works.','SMdraft');assert.match(preview,/Nothing sent/);assert.equal(sends,0);
const sendCode=preview.match(/SEND (\w+)/)[1];assert.match(await sms('SEND '+sendCode,'SMsend'),/Carrier accepted/);assert.equal(sends,1);
assert.match(await sms('SEND '+sendCode,'SMsendagain'),/already attempted/);assert.equal(sends,1);
const changedPreview=await sms('REPLY Fresh Nick: Confirm the recipient.','SMchangedpreview');changed=true;
assert.match(await sms('SEND '+changedPreview.match(/SEND (\w+)/)[1],'SMchangedrecipient'),/Contact changed/);assert.equal(sends,1);changed=false;
const stopPreview=await sms('REPLY '+client+': Checking in.','SMstopdraft');await threads.block(client,true);
assert.match(await sms('SEND '+stopPreview.match(/SEND (\w+)/)[1],'SMblockedsend'),/blocked/);assert.equal(sends,1);await threads.block(client,false);
await threads.inbound({from:client,text:'STOP',sid:'SMstop'});assert.match(await sms('REPLY '+client+': Checking in.','SMoptout'),/opted out/);
await threads.inbound({from:client,text:'START',sid:'SMstart'});
uncertain=true;const uncertainDraft=await sms('REPLY '+client+': Unknown outcome.','SMuncertaindraft'),uncertainCode=uncertainDraft.match(/SEND (\w+)/)[1];
assert.match(await sms('SEND '+uncertainCode,'SMuncertainsend'),/uncertain/);assert.equal(sends,2);await sms('SEND '+uncertainCode,'SMuncertainretry');assert.equal(sends,2);
const expireDraft=await sms('REPLY '+client+': Expiring.','SMexpdraft');now+=600001;assert.match(await sms('SEND '+expireDraft.match(/SEND (\w+)/)[1],'SMexpired'),/expired/);
assert.equal(await access.act('owner',{action:'sms_send',code:sendCode},'ai'),null);assert.equal(sends,2);
now+=86400001;assert.match(await sms('MORE '+code+' 1','SMexpiredreport'),/expired/);
await threads.remove(client);assert.equal(await threads.history(client),null);await threads.inbound({from:client,text:'New conversation',sid:'SMfresh'});assert.equal((await threads.history(client)).messages.length,1);
let badRec={threads:{[client]:{number:client,messages:Array.from({length:400},(_,i)=>({id:'old'+i,ts:'2026-10-01'}))}}};
const broken=createMessageStore({load:async()=>structuredClone(badRec),save:async r=>{badRec=r;},archive:{append:async()=>{throw new Error('archive unavailable');}}});
await assert.rejects(broken.inbound({from:client,text:'Must not erase earlier history',sid:'SMfailure'}),/archive unavailable/);assert.equal(badRec.threads[client].messages.length,400);
const noRead=createOwnerSMSAccess({...deps,threads:{list:async()=>{throw new Error('storage unavailable');}}});await assert.rejects(noRead.direct('owner','INBOX','bad'),/unavailable/);

// Natural full status reports use the verified owner account and survive restarts.
const reportLeads=Array.from({length:101},(_,i)=>({id:'full-'+i,name:'Report Client '+i,phone:'+1415555'+String(i).padStart(4,'0'),stage:i<60?'new':'contacted',note:'Actual requested garment '+i}));
let fullReads=0,chatCalls=0;
const ownerReports=createOwnerConversation({...storage,ownerNumber:owner,smsAction:access.act,listAll:async uid=>{assert.equal(uid,'owner');fullReads++;return {list:reportLeads,complete:true};},complete:async()=>{chatCalls++;throw Error('AI offline');}});
const reportCRM=createOwnerCRM({...storage,ownerNumber:owner,ownerEmails:['owner@example.com'],direct:access.direct,converse:ownerReports.decide,ownerAction:ownerReports.act});
const recordBefore=JSON.stringify(rec),sendsBefore=sends;
let leadPage=await reportCRM.handle({from:owner,text:'Text me all the contacted leads',sid:'SMfullcontacted'});
assert.match(leadPage,/Contacted leads/);assert.match(leadPage,/41 shown of 41/);assert.match(leadPage,/Status: Contacted/);assert.equal(chatCalls,0);assert.equal(fullReads,1);
const restartedReports=createOwnerSMSAccess(deps),reportCode=leadPage.match(/MORE (\w+) /)[1];
let combined=leadPage.split('\n').slice(1,-1).join('\n'),pageIndex=1;
while(leadPage.match(/Next: (MORE \w+ \d+)/)){
 leadPage=(await restartedReports.direct('owner',leadPage.match(/Next: (MORE \w+ \d+)/)[1],'readfull'+pageIndex++)).reply;
 assert.ok(leadPage.length<1600);combined+=leadPage.split('\n').slice(1,-1).join('\n');
}
for(let i=60;i<101;i++)assert.ok(combined.includes('Report Client '+i+'\n'),String(i));
assert.ok(!combined.includes('Report Client 59\n'));assert.equal(fullReads,1,'MORE reads one durable snapshot rather than refetching a shifted dataset');
await assert.rejects(restartedReports.direct('another-owner','MORE '+reportCode+' 1','crossfull'),/expired or code/);
assert.equal(await reportCRM.handle({from:'+15105550101',text:'ALL LEADS',sid:'SMfullforged'}),'');assert.equal(fullReads,1);
assert.equal(JSON.stringify(rec),recordBefore,'Owner lead reports do not mark client messages read or alter history');assert.equal(sends,sendsBefore,'No client send is possible from a lead report');
assert.equal(chatCalls,0);
console.log('Natural contacted-lead reports page every real match beyond 60, survive recreation and preserve owner/client boundaries.');
assert.ok(messageLines({number:client,messages:[{kind:'call',dir:'in',ts:'now'}]})[0].includes('No transcript recorded'));
console.log('Owner SMS access: history both ways, call transcripts, AI-free controls, ambiguity, account-bound durable paging, confirmation, STOP/block, expiry, uncertain sends and archival preservation passed.');

let conflict=true,conflictRec={threads:{[client]:{number:client,messages:Array.from({length:400},(_,i)=>({id:'conflict'+i,ts:'2026-10-01'}))}}};
const conflictStore=createMessageStore({load:async()=>structuredClone(conflictRec),save:async r=>{if(conflict){conflict=false;throw Object.assign(new Error('revision conflict'),{status:412});}conflictRec=r;},archive});
await conflictStore.inbound({from:client,text:'Survives retry',sid:'SMconflict'});
assert.equal((await conflictStore.history(client)).messages.filter(m=>m.id==='conflict0').length,1);
assert.equal((await conflictStore.history(client)).messages.filter(m=>m.id==='SMconflict').length,1);
console.log('Archive-before-trim survives a live inbox revision conflict without duplicating history.');

// A callback can update the live message after another instance archives it,
// but before that instance saves its trimmed inbox. Retrying must carry the
// newer delivery result into the already-created archive entry.
for(const result of [{status:'delivered'},{status:'undelivered',errorCode:'30034'}]){
  const epoch='overflow'+result.status;
  let liveGeneration=1,interleave=true;
  let live={threads:{[client]:{number:client,historyEpoch:epoch,messages:Array.from({length:400},(_,i)=>({id:i?'overflow'+i:'SMoverflow',dir:'out',status:'queued',text:'Original '+i,ts:'2026-10-01'}))}}};
  const instance=beforeSave=>{let generation;return createMessageStore({archive,
    load:async()=>{generation=liveGeneration;return structuredClone(live);},
    save:async value=>{if(beforeSave)await beforeSave();if(generation!==liveGeneration)throw Object.assign(new Error('revision conflict'),{status:412});live=structuredClone(value);liveGeneration++;},
  });};
  const callback=instance();
  const overflowing=instance(async()=>{if(interleave){interleave=false;await callback.status({sid:'SMoverflow',...result});}});
  await overflowing.inbound({from:client,text:'Causes overflow',sid:'SMoverflownew'});
  const archived=(await archive.read(client,epoch)).find(m=>m.id==='SMoverflow');
  assert.equal(archived.status,result.status);assert.equal(archived.errorCode,result.errorCode);
  assert.equal(live.threads[client].messages.length,400);
  assert.equal((await overflowing.history(client)).messages.length,401);
  await archive.append(client,epoch,[{id:'SMoverflow',status:'sent',text:'Stale copy'}]);
  await archive.status(client,epoch,{sid:'SMoverflow',status:result.status==='delivered'?'failed':'delivered'});
  const retained=(await archive.read(client,epoch)).find(m=>m.id==='SMoverflow');
  assert.equal(retained.status,result.status);assert.equal(retained.text,'Original 0');
}
console.log('Overflow retries preserve concurrent terminal delivery results and reject stale/contradictory status.');

let ownerTexts=0,requested;
const leadReader=createOwnerConversation({...storage,ownerNumber:owner,smsAction:access.act,find:deps.find,list:async n=>{requested=n;return Array.from({length:n},(_,i)=>({name:'Contact '+i,phone:client,note:'A saved request '.repeat(20)}));},complete:async()=>{throw Error('AI unavailable');},textOwner:async text=>{ownerTexts++;assert.match(text,/Contact 0\n\+14155550100/);return {ok:true};}});
const readCRM=createOwnerCRM({...storage,ownerNumber:owner,ownerEmails:['owner@example.com'],direct:access.direct,converse:leadReader.decide,ownerAction:leadReader.act});
const leadReply=await readCRM.handle({from:owner,text:'Send me the last 5 leads',sid:'SMlatestleadread'});assert.equal(requested,5);assert.match(leadReply,/Latest leads.*page 1\//);assert.match(leadReply,/Contact 0\n\+14155550100/);
const continuation=leadReply.match(/Next: (MORE [a-f0-9]{8} 2)/)[1];assert.match(await readCRM.handle({from:owner,text:continuation,sid:'SMmoreleads'}),/Contact 4/);
await leadReader.phoneControl(owner,{action:'text_owner',report:'leads',count:5},'voice_live_leads');await leadReader.phoneControl(owner,{action:'text_owner',report:'leads',count:5},'voice_live_leads');assert.equal(ownerTexts,1);
assert.equal(await readCRM.handle({from:'+15105550101',text:'Send me the last 5 leads',sid:'SMnotownerleads'}),'');
console.log('Natural SMS lead reads and grounded phone texts work with AI down and durable report pagination, without client sends.');

};

checks['maya-messages']=async function(){
// tests/maya-messages.mjs: the studio's text threads, against a fake Twilio
// and an in memory store. Run: node tests/maya-messages.mjs
const {default:crypto}=await import('node:crypto');
const {default:http}=await import('node:http');
let express;
try { express = (await import('express')).default; }
catch (e) { console.log('SKIPPED maya-messages: express is not installed here; CI installs it'); throw Error('Required test dependency missing.'); }
const { createMessageStore, sendSms, readSmsStatus, mountMessages, e164, isNo, isYes, introducedName } = await import('../backend/server/maya-messages.mjs');

let passed = 0, failed = 0;
function ok(name, cond, detail) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); } }

ok('numbers normalize to E.164', e164('(510) 991-9445') === '+15109919445' && e164('+15109909223') === '+15109909223' && e164('15109909223') === '+15109909223');
ok('a no is a no, anything else is a yes', isNo('STOP') && isNo('no thanks') && isYes('sure, sounds good') && !isYes('Stop'));
ok('clear introductions recognize names without an AI request',
  introducedName("Hi, my name is Mary E. Ingram. I need a fitting.") === 'Mary E. Ingram' &&
  introducedName("Hello, this is José O’Connor, looking for a suit") === 'José O’Connor' &&
  introducedName("I'm Mary and I would like a jacket") === 'Mary');
ok('ordinary inquiries and markup never become contact names',
  ['I am interested in a suit', 'This is a question', 'My friend is Mary', 'My name is <img src=x>', 'STOP'].every(t => !introducedName(t)));
let nameBucket = null;
const nameStore = createMessageStore({load:async()=>nameBucket,save:async r=>{nameBucket=structuredClone(r);}});
await nameStore.inbound({from:'+14155550190',text:'Hi, my name is Mary Ingram, can I book?',sid:'SMname1'});
ok('a stranger introduction names its own thread and appears in the inbox',
  (await nameStore.list())[0].name === 'Mary Ingram' && (await nameStore.get('+14155550190')).nameSource === 'sms');
await nameStore.name('+14155550190', 'Mary, fitting client');
await nameStore.inbound({from:'+14155550190',text:'This is Someone Else',sid:'SMname2'});
ok('SMS introductions never overwrite an owner-assigned name', (await nameStore.get('+14155550190')).name === 'Mary, fitting client');
await nameStore.block('+14155550191',true);
await nameStore.inbound({from:'+14155550191',text:'My name is Blocked Person',sid:'SMname3'});
ok('blocked senders cannot create a name or message through an introduction', !(await nameStore.get('+14155550191')).name && !(await nameStore.get('+14155550191')).messages.length);

// the store on a fake bucket
let bucket = null;
const store = createMessageStore({ load: async () => bucket, save: async (rec) => { bucket = JSON.parse(JSON.stringify(rec)); }, log: () => {} });
await store.outbound({ to: '646-996-6115', text: 'Hi Kristi, it\'s Mana Siyo. We just saw your request and we\'re going to call you shortly. Okay to text you here about it?', sid: 'SM1', asks: true, name: 'Kristi Lugo' });
ok('the first text asks, and the thread waits on the answer', (await store.consent('+16469966115')) === 'asked' && (await store.get('+16469966115')).name === 'Kristi Lugo');
await store.inbound({ from: '+16469966115', text: 'Yes of course', sid: 'SM2' });
ok('a reply that is not a no is consent; the thread counts one unread', (await store.consent('+16469966115')) === 'yes' && (await store.get('+16469966115')).unread === 1);
await store.call({ number: '+16469966115', dir: 'out', seconds: 95, mode: 'client', summary: 'Thursday at three is perfect.',
  transcript:Array.from({length:310},(_,i)=>({who:i%2?'maya':'caller',text:'Line '+i})) });
ok('a call keeps its full text transcript in the Messages thread',(await store.get('+16469966115')).messages.at(-1).transcript.length===310);
const list = await store.list();
ok('the thread list carries name, unread and the last thing that happened', list.length === 1 && list[0].name === 'Kristi Lugo' && list[0].unread === 1 && list[0].last.kind === 'call' && list[0].last.seconds === 95, JSON.stringify(list));
await store.markRead('+16469966115');
await store.inbound({ from: '+16469966115', text: 'STOP', sid: 'SM3' });
ok('STOP closes the thread to texts', (await store.consent('+16469966115')) === 'stop' && (await store.get('+16469966115')).messages.length === 4);
await store.inbound({ from: '+14155550100', text: 'Hi, do you make suits?', sid: 'SM4' });
ok('a stranger texting in opens a thread of their own, and counts as yes', (await store.list()).length === 2 && (await store.consent('+14155550100')) === 'yes');

// sendSms against a fake Twilio
const twRest = [];
const twSrv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { if (req.method === 'GET') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({to:'+14155550100',status:'undelivered',error_code:30034})); } const form = Object.fromEntries(new URLSearchParams(b)); twRest.push({ url: req.url, form }); res.setHeader('Content-Type', 'application/json'); if (form.To === '+14155559999') { res.statusCode = 400; res.end(JSON.stringify({ code: 30034, message: 'Unregistered' })); } else { res.statusCode = 201; res.end(JSON.stringify({ sid: 'SM' + twRest.length, status: 'queued' })); } }); });
await new Promise(r => twSrv.listen(0, '127.0.0.1', r));
const tdeps = { accountSid: 'ACtest', authToken: 'tok', fromNumber: '+15109909223', twilioApi: 'http://127.0.0.1:' + twSrv.address().port };
const sent = await sendSms(tdeps, { to: '646 996 6115', text: 'Great. We will call you around 3 pm.' });
ok('a text goes out from the studio number', sent.ok === true && twRest[0].url === '/2010-04-01/Accounts/ACtest/Messages.json' && twRest[0].form.From === '+15109909223' && twRest[0].form.To === '+16469966115');
const blocked = await sendSms(tdeps, { to: '+14155559999', text: 'x' });
ok('an unregistered number failure directs the owner to approval and sender assignment', blocked.ok === false && /carrier registration/.test(blocked.why) && /approval and sender assignment/.test(blocked.why) && !/still in review/.test(blocked.why));
ok('an invalid country-coded number is refused before Twilio', (await sendSms(tdeps, { to: '+44 20', text: 'x' })).ok === false);
ok('formatted explicit international SMS is normalized', e164('+44 (7700) 900-123') === '+447700900123');
ok('implicit foreign digits and letters are refused', e164('447700900123') === '' && e164('+44abc7700900123') === '');

// the routes
const app = express();
const AUTH = 'tok';
const calls = [];
const ownerCommands=[];
mountMessages(app, {
  ownerCommand:async input=>{ownerCommands.push(input);return input.from==='+15105550199'?'Preview: A & B <lead>. Reply YES abc123':'';},
  store, readStatus: (sid, to) => readSmsStatus(tdeps, sid, to), sendSms: (to, text) => sendSms(tdeps, { to, text }), authToken: AUTH, publicHost: 'maya-api-53947659283.us-west1.run.app', webhookHosts: ['maya.manasiyo.com'],
  requireAdmin: async (req) => { if (req.get('authorization') === 'Bearer admin') return { email: 'worldofsiyo@gmail.com' }; const e = new Error('no'); e.status = 401; throw e; },
  json: express.json(), urlencoded: express.urlencoded({ extended: false }),
  callClient: async (x) => { calls.push(x); return { ok: true, sid: 'CAx' }; }, log: () => {},
});
const server = http.createServer(app);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const H = { 'Authorization': 'Bearer admin', 'Content-Type': 'application/json' };
const sign = (u, p) => crypto.createHmac('sha1', AUTH).update(u + Object.keys(p).sort().map(k => k + p[k]).join('')).digest('base64');

ok('the threads need an admin', (await fetch(base + '/api/admin/messages')).status === 401);
const threads = await (await fetch(base + '/api/admin/messages', { headers: H })).json();
ok('the admin sees the threads', threads.ok && threads.threads.length === 2 && threads.threads.some(t => t.number === '+14155550100'));
const p = { From: '+14155550100', Body: 'And a coat', MessageSid: 'SM9' };
const unsigned = await fetch(base + '/api/phone/sms', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString() });
const signed = await fetch(base + '/api/phone/sms', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign('https://maya.manasiyo.com/api/phone/sms', p) }, body: new URLSearchParams(p).toString() });
ok('an incoming text is accepted only with Twilio\'s signature and lands in the thread', unsigned.status === 403 && signed.status === 200 && /<Response><\/Response>/.test(await signed.text()) && (await store.get('+14155550100')).messages.length === 2);
const th = await (await fetch(base + '/api/admin/messages/thread?number=%2B14155550100', { headers: H })).json();
ok('opening a thread returns it and clears the unread count', th.ok && th.thread.messages.length === 2 && (await store.get('+14155550100')).unread === 0);
const snd = await (await fetch(base + '/api/admin/messages/send', { method: 'POST', headers: H, body: JSON.stringify({ to: '+14155550100', text: 'Yes we do. What are you picturing?',requestId:'fixture-send-00001' }) })).json();
ok('a text typed in Admin goes out and is kept in the thread', snd.ok === true && (await store.get('+14155550100')).messages.length === 3 && (await store.get('+14155550100')).messages[2].dir === 'out');
const stopped = await fetch(base + '/api/admin/messages/send', { method: 'POST', headers: H, body: JSON.stringify({ to: '+16469966115', text: 'x' }) });
ok('a thread that said STOP refuses to send', stopped.status === 409);
const cc = await (await fetch(base + '/api/admin/phone/call-client', { method: 'POST', headers: H, body: JSON.stringify({ to: '646 996 6115', name: 'Kristi Lugo', reason: 'Thursday?' }) })).json();
ok('the phone icon route hands the call to Maya with the number in E.164', cc.ok === true && calls.length === 1 && calls[0].to === '+16469966115' && calls[0].name === 'Kristi Lugo');

await store.status({ sid: 'SMearly', status: 'undelivered', errorCode: '30034' });
await store.outbound({ to: '+14155550100', text: 'test', sid: 'SMearly', status: 'queued' });
const early = (await store.get('+14155550100')).messages.find(m => m.id === 'SMearly');
ok('delivery callback before storage survives with the carrier error', early.status === 'undelivered' && early.errorCode === '30034');
await store.status({ sid: 'SMearly', status: 'sent' });
ok('later sent callback cannot hide an undelivered result', (await store.get('+14155550100')).messages.find(m => m.id === 'SMearly').status === 'undelivered');
const checked = await (await fetch(base+'/api/admin/messages/check-delivery',{method:'POST',headers:H,body:JSON.stringify({number:'+14155550100'})})).json();
ok('Admin can reconcile recent texts directly with carrier delivery status', checked.ok && checked.checked > 0 && (await store.get('+14155550100')).messages.some(m=>m.status==='undelivered' && m.errorCode==='30034'));
let wrongRecipient = false;
try { await readSmsStatus(tdeps, 'SMprivate', '+16469966115'); } catch (_) {wrongRecipient = true;}
ok('delivery lookup refuses a carrier record for another recipient', wrongRecipient);
// September 20: names, blocking, deletion, webhook retries and delivery state.
const post = (action,body) => fetch(base + '/api/admin/messages/' + action,{method:'POST',headers:H,body:JSON.stringify(body)});
await post('name',{number:'+14155550100',name:'Taylor'});
ok('an admin can rename Caller and the name persists', (await store.get('+14155550100')).name === 'Taylor');
ok('renaming needs admin authorization',(await fetch(base+'/api/admin/messages/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:'+14155550100',name:'Intruder'})})).status === 401);
await post('block',{number:'+14155550100',blocked:true});
const beforeBlock = twRest.length;
ok('blocked contact cannot receive an outbound text',(await post('send',{to:'+14155550100',text:'blocked'})).status===409 && twRest.length===beforeBlock);
ok('blocked contact cannot be called',(await fetch(base+'/api/admin/phone/call-client',{method:'POST',headers:H,body:JSON.stringify({to:'+14155550100'})})).status===409 && calls.length===1);
const beforeIncoming=(await store.get('+14155550100')).messages.length;
await store.inbound({from:'+14155550100',text:'blocked incoming',sid:'SMblocked'});
ok('blocked inbound does not enter the inbox',(await store.get('+14155550100')).messages.length===beforeIncoming);
await post('delete',{number:'+14155550100'});
ok('delete clears history but a blocked contact stays reachable for unblocking',(await store.get('+14155550100')).blocked && (await store.list()).some(t=>t.number==='+14155550100' && t.blocked));
await post('block',{number:'+14155550100',blocked:false});
await store.inbound({from:'+14155550100',text:'new conversation',sid:'SMnew'});
await store.inbound({from:'+14155550100',text:'new conversation',sid:'SMnew'});
ok('duplicate inbound webhook is stored exactly once and deleted threads can return',(await store.get('+14155550100')).messages.length===1 && (await store.get('+14155550100')).unread===1);
await store.outbound({to:'+14155550100',text:'hello',sid:'SMdelivery',status:'queued'});
const delivery={MessageSid:'SMdelivery',MessageStatus:'delivered'};
const callback=await fetch(base+'/api/phone/sms/status',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':sign('https://maya.manasiyo.com/api/phone/sms/status',delivery)},body:new URLSearchParams(delivery)});
await store.status({sid:'SMdelivery',status:'sent'});
ok('signed delivery callback updates status and late sent does not downgrade delivered',callback.status===204 && (await store.get('+14155550100')).messages[1].status==='delivered');
ok('unsigned status callback is refused',(await fetch(base+'/api/phone/sms/status',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(delivery)})).status===403);
await post('delete',{number:'+16469966115'});
ok('deletion never clears STOP',(await store.consent('+16469966115'))==='stop');
let writes=0;
const failing=createMessageStore({load:async()=>{throw new Error('storage down');},save:async()=>writes++,log:()=>{}});
try { await failing.inbound({from:'+14155550100',text:'x',sid:'failure'}); } catch {}
ok('failed storage read never replaces history with an empty file',writes===0);
let conflicts=0, saved;
const concurrent=createMessageStore({load:async()=>({threads:{}}),save:async(r)=>{if(!conflicts++){const e=new Error('conflict');e.status=412;throw e;}saved=r;}});
await concurrent.name('+14155550100','Retry');
ok('generation conflicts reload and retry mutations',conflicts===2 && saved.threads['+14155550100'].name==='Retry');

// Reproductions from the September 22 code audit.
let consentBucket = null;
const consentStore = createMessageStore({load:async()=>consentBucket,save:async r=>{consentBucket=structuredClone(r);}});
const consentNumber = '+14155550188';
await consentStore.inbound({from:consentNumber,text:'No problem, tomorrow works',sid:'ordinary'});
ok('ordinary No problem replies keep texting enabled',await consentStore.consent(consentNumber)==='yes');
await consentStore.inbound({from:consentNumber,text:'STOP',sid:'stop'});
await consentStore.inbound({from:consentNumber,text:'HELP',sid:'help',optOutType:'HELP'});
ok('HELP never reverses STOP',await consentStore.consent(consentNumber)==='stop');
await consentStore.inbound({from:consentNumber,text:'START',sid:'start'});
ok('explicit START restores texting',await consentStore.consent(consentNumber)==='yes');
await consentStore.inbound({from:consentNumber,text:'custom unsubscribe',sid:'customstop',optOutType:'STOP'});
ok('Twilio OptOutType STOP takes precedence over the message body',await consentStore.consent(consentNumber)==='stop');
await consentStore.inbound({from:consentNumber,text:'custom subscribe',sid:'customstart',optOutType:'START'});
ok('Twilio OptOutType START restores texting',await consentStore.consent(consentNumber)==='yes');
await consentStore.inbound({from:consentNumber,text:'no thanks',sid:'no'});
await consentStore.inbound({from:consentNumber,text:'UNSTOP',sid:'unstop'});
ok('UNSTOP restores an explicit opt-out',await consentStore.consent(consentNumber)==='yes');
await consentStore.block(consentNumber,true);
await consentStore.inbound({from:consentNumber,text:'START',sid:'blockedstart',optOutType:'START'});
ok('START cannot remove an owner block',(await consentStore.get(consentNumber)).blocked);
for(const stop of [{text:'STOP'},{text:'custom unsubscribe',optOutType:'STOP'}]){
  let stoppedBucket=null;
  const stoppedStore=createMessageStore({load:async()=>stoppedBucket,save:async r=>{stoppedBucket=structuredClone(r);}});
  await stoppedStore.inbound({from:consentNumber,text:'Hello',sid:'SMbeforeblock'});
  await stoppedStore.block(consentNumber,true);
  await stoppedStore.inbound({from:consentNumber,sid:'SMblockedstop',...stop});
  await stoppedStore.block(consentNumber,false);
  const stoppedThread=await stoppedStore.get(consentNumber);
  ok('STOP received during a block survives unblocking ('+(stop.optOutType||'body')+')',stoppedThread.consent==='stop'&&!stoppedThread.blocked&&stoppedThread.messages.length===1&&stoppedThread.unread===1);
}
await store.outbound({to:'+14155550100',text:'test',sid:'SMlatecode',status:'undelivered'});
await store.status({sid:'SMlatecode',status:'undelivered',errorCode:'30034'});
await store.status({sid:'SMlatecode',status:'delivered'});
const lateCode=(await store.get('+14155550100')).messages.find(m=>m.id==='SMlatecode');
ok('same terminal status accepts missing carrier detail without accepting contradictory status',lateCode.status==='undelivered' && lateCode.errorCode==='30034');
const signedPost = (path,host,params,extra={}) => fetch(base+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':sign('https://'+host+path,params),...extra},body:new URLSearchParams(params)});
const cloudInbound={From:'+14155550187',Body:'START',OptOutType:'START',MessageSid:'SMcloud'};
ok('configured Cloud Run webhook signatures also validate',(await signedPost('/api/phone/sms','maya-api-53947659283.us-west1.run.app',cloudInbound)).status===200);
const cloudStop={...cloudInbound,Body:'custom keyword',OptOutType:'STOP',MessageSid:'SMcloudstop'};
await signedPost('/api/phone/sms','maya.manasiyo.com',cloudStop);
ok('signed inbound route forwards OptOutType to the consent store',await store.consent(cloudStop.From)==='stop');
ok('untrusted forwarded hosts cannot authorize a webhook',(await signedPost('/api/phone/sms','attacker.example',cloudInbound,{'X-Forwarded-Host':'attacker.example'})).status===403);
ok('Cloud Run delivery callbacks validate too',(await signedPost('/api/phone/sms/status','maya-api-53947659283.us-west1.run.app',delivery)).status===204);

const ownerParams={From:'+15105550199',Body:'Add A and B',MessageSid:'SMowner'};
const ownerPost=async(params,signed=true)=>fetch(base+'/api/phone/sms',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(signed?{'X-Twilio-Signature':sign('https://maya.manasiyo.com/api/phone/sms',params)}:{})},body:new URLSearchParams(params)});
const beforeCommands=ownerCommands.length;
await ownerPost(ownerParams,false);
ok('unsigned messages never invoke owner tools',ownerCommands.length===beforeCommands);
const ownerResponse=await ownerPost(ownerParams);
ok('signed owner command replies are escaped TwiML',/A &amp; B &lt;lead&gt;/.test(await ownerResponse.text()));
const commandCount=ownerCommands.length;
await ownerPost({...ownerParams,MessageSid:'SMownerstop',Body:'STOP'});
ok('STOP never invokes owner command tools',ownerCommands.length===commandCount);
await ownerPost({...ownerParams,MessageSid:'SMownerblocked',Body:'Add another lead'});
ok('an opted-out owner receives no command reply',ownerCommands.length===commandCount);
console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + ' (' + passed + ' ok)');
twSrv.close(); server.close();
process.exit(failed ? 1 : 0);

};

checks['maya-phone']=async function(){
// tests/maya-phone.mjs: Maya's phone line, end to end against a fake Twilio
// and a fake OpenAI, no network. Run: node tests/maya-phone.mjs
const {default:crypto}=await import('node:crypto');
const {default:http}=await import('node:http');
process.env.PHONE_AUTO_LEAD_SECONDS = '0.0001';   // on for the test; off by default since v14.34
let express, WebSocketServer, WebSocket;
try { express = (await import('express')).default; ({ WebSocketServer, WebSocket } = await import('ws')); }
catch (e) { console.log('SKIPPED maya-phone: express or ws is not installed here (' + e.message.split('\n')[0] + '); CI installs both'); throw Error('Required test dependency missing.'); }
const { mountMayaPhone, twilioSignatureValid, callToken, phoneInstructions, PHONE_TOOLS } = await import('../backend/server/maya-phone.mjs');

let passed = 0, failed = 0;
function ok(name, cond, detail) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); } }
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(20); } return fn(); };

// ── a fake OpenAI Realtime server ──
const aiSrv = http.createServer();
const aiWss = new WebSocketServer({ server: aiSrv });
const ai = { sockets: [], got: [] };
aiWss.on('connection', (sock, req) => {
  ai.sockets.push({ sock, auth: req.headers.authorization || '' });
  sock.on('message', (raw) => { try { ai.got.push(JSON.parse(raw.toString())); } catch (_) {} });
});
await new Promise(r => aiSrv.listen(0, '127.0.0.1', r));
const aiPort = aiSrv.address().port;

// ── the server under test ──
const AUTH = 'test-twilio-auth-token';
const app = express();
app.use(express.urlencoded({ extended: false }));
const server = http.createServer(app);
const leads = [], transcripts = [], spends = [], notes = [], bookingSends = [];
// a fake Twilio REST API for the calls Maya places
const twSrv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { twRest.push({ url: req.url, auth: req.headers.authorization || '', form: Object.fromEntries(new URLSearchParams(b)) }); res.setHeader('Content-Type', 'application/json'); res.statusCode = 201; res.end(JSON.stringify({ sid: 'CAOUT1', status: 'queued' })); }); });
const twRest = [];
await new Promise(r => twSrv.listen(0, '127.0.0.1', r));
const latencyLogs=[];
const phoneDeps = {
  ownerContext: async from => JSON.stringify({memory:['Keep responses brief'],from}),
  ownerControl: async (from,args,id) => {ownerActions.push({from,args,id});return {ok:true,reply:'Remembered: '+args.text};},
  authToken: AUTH, openaiKey: 'sk-test', model: 'gpt-realtime', voice: 'marin', character: 'I am Maya.',
  saveLead: async (lead, prevId) => { const item = { id: prevId || ('m_' + leads.length), ...lead }; leads.push(item); return item; },
  saveTranscript: async (callSid, rec) => { transcripts.push({ callSid, rec }); },
  noteSpend: () => spends.push(1),
  openaiUrl: 'ws://127.0.0.1:' + aiPort + '/v1/realtime',
  WebSocketServer, WebSocketClient: WebSocket, publicHost: 'maya.manasiyo.com', log: (...args) => latencyLogs.push(args),
  accountSid: 'ACtest', fromNumber: '+15109909223', fromsaPhone: '+15104917540', twilioApi: 'http://127.0.0.1:' + twSrv.address().port,
  isBlocked: async n => n === '+14155559999',
  findLead: async query => ({ ok: true, lead: { name: query, phone: '+14155550100' } }),
  transfer: async entry => { transfers.push(entry); return { ok: true }; },
  listLeads: async (n) => leads.slice(-n).map(l => ({ name: l.name, phone: l.phone, wrote: l.wrote })),
  noteLead: async (lead, note) => { notes.push({ lead, note }); return /tori/i.test(lead) ? { ok: true, name: 'Tori' } : { ok: false, why: 'no lead named ' + lead }; },
  logNote: async (text) => { inbox.push(text); return { ok: true }; },
  onCallEnd: async (rec) => { threadCalls.push(rec); },
  bookingPreview: async query => ({id:'preview-nick',name:query,to:'+15105550140',text:'Hi Nick, book at https://wix.to/wT2lSqE',ownerPreview:{ok:true}}),
  bookingConfirm: async id => { bookingSends.push(id);return {ok:true,status:'queued'}; },
  setTier: async (lead, tier) => { tiers.push({ lead, tier }); return /tori/i.test(lead) ? { ok: true, name: 'Tori' } : { ok: false, why: 'no lead named ' + lead }; },
};
const phone = mountMayaPhone(app, server, phoneDeps);
const inbox = [], tiers = [], threadCalls = [], transfers = [], ownerActions = [];
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

// 1. the signature
const url = 'https://maya.manasiyo.com/api/phone/incoming';
const params = { CallSid: 'CA123', From: '+15105551234', To: '+14155550100', CallStatus: 'ringing' };
const sign = (u, p, tok) => crypto.createHmac('sha1', tok).update(u + Object.keys(p).sort().map(k => k + p[k]).join('')).digest('base64');
const good = sign(url, params, AUTH);
ok('a valid Twilio signature is accepted, a wrong one is not',
  twilioSignatureValid(AUTH, url, params, good) === true && twilioSignatureValid(AUTH, url, params, 'bad') === false && twilioSignatureValid(AUTH, url + '?x', params, good) === false);

const post = (headers) => fetch(base + '/api/phone/incoming', { method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(params).toString() });
const r403 = await post({});
ok('an unsigned webhook is refused', r403.status === 403);
const r200 = await post({ 'X-Twilio-Signature': good });
const twiml = await r200.text();
const token = callToken(AUTH, 'CA123', '+15105551234');
ok('a signed webhook answers TwiML that opens the stream with a per call token',
  r200.status === 200 && /text\/xml/.test(r200.headers.get('content-type') || '') &&
  twiml.includes('<Connect><Stream url="wss://maya.manasiyo.com/api/phone/stream">') &&
  twiml.includes('name="token" value="' + token + '"') && twiml.includes('name="from" value="+15105551234"'), twiml);
const blockedParams = { ...params, From: '+14155559999' };
const blockedResponse = await fetch(base + '/api/phone/incoming', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':sign(url,blockedParams,AUTH)},body:new URLSearchParams(blockedParams) });
ok('blocked contacts never start a voice stream', (await blockedResponse.text()).includes('<Reject'));
const st = await (await fetch(base + '/api/phone/status')).json();
ok('the status route says the line is on with no call yet', st.ok === true && st.on === true && st.calls === 0, JSON.stringify(st));

// 2. a stream with a bad token never reaches OpenAI
{
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  let closed = false; tw.on('close', () => { closed = true; });
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZbad', start: { callSid: 'CA999', customParameters: { token: 'nope', from: '+1' } } }));
  await until(() => closed, 2000);
  ok('a stream with a bad token is closed and OpenAI is never dialed', closed === true && ai.sockets.length === 0);
}

// 3. a real call
const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
const twGot = [];
tw.on('message', (raw) => { try { twGot.push(JSON.parse(raw.toString())); } catch (_) {} });
await new Promise(r => tw.on('open', r));
tw.send(JSON.stringify({ event: 'connected' }));
tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ1', start: { callSid: 'CA123', customParameters: { token, from: '+15105551234', callSid: 'CA123' } } }));
tw.send(JSON.stringify({ event: 'media', media: { payload: 'EARLY' } }));
await until(() => ai.sockets.length === 1);
ok('a stream with the right token dials OpenAI with the key', ai.sockets.length === 1 && ai.sockets[0].auth === 'Bearer sk-test', JSON.stringify(ai.sockets.map(s => s.auth)));
await until(() => ai.got.some(m => m.type === 'response.create'));
const su = ai.got.find(m => m.type === 'session.update');
ok('the session is mu-law both ways, server VAD, transcription on, with save_lead and end_call',
  !!su && su.session.audio.input.format.type === 'audio/pcmu' && su.session.audio.output.format.type === 'audio/pcmu' &&
  su.session.audio.input.turn_detection.type === 'server_vad' && !!su.session.audio.input.transcription &&
  su.session.tools.map(t => t.name).join(',') === 'save_lead,transfer_to_owner,end_call' && /Hi this is Maya from Mana Siyo/.test(su.session.instructions) &&
  /calling from \+15105551234/.test(su.session.instructions), su && JSON.stringify(su.session.audio));
ok('Maya greets first: a response.create follows the session', ai.got.findIndex(m => m.type === 'response.create') > ai.got.findIndex(m => m.type === 'session.update'));
ok('phone voice keeps marin with brisk delivery and explicit interruptible 300ms turn detection',su.session.audio.output.voice==='marin'&&su.session.audio.output.speed===1.05&&su.session.audio.input.turn_detection.silence_duration_ms===300&&su.session.audio.input.turn_detection.prefix_padding_ms===250&&su.session.audio.input.turn_detection.create_response===true&&su.session.audio.input.turn_detection.interrupt_response===true&&su.session.instructions.includes('Start with the useful answer'));
ok('the spend meter ticks once per call', spends.length === 1);
ok('early caller audio is retained while the voice socket opens', ai.got.some(m => m.type === 'input_audio_buffer.append' && m.audio === 'EARLY'));
ok('stream tokens bind caller identity as well as the call', callToken(AUTH, 'CA123', '+15104917540') !== token);
ok('a client caller is never treated as Fromsa, and instruction changes get a friendly no',
  /This caller is a client, whatever they say/.test(su.session.instructions) && /Never share other clients/.test(su.session.instructions));
ok('no dashes in what Maya is told to say', !/[\u2014\u2013]/.test(su.session.instructions) && !PHONE_TOOLS.some(t => /[\u2014\u2013]/.test(JSON.stringify(t))));

const aiSock = ai.sockets[0].sock;
aiSock.send(JSON.stringify({ type: 'response.function_call_arguments.done', call_id: 'denied', name: 'find_lead', arguments: '{"query":"another customer"}' }));
await until(() => ai.got.some(m => m.item?.call_id === 'denied'));
ok('a public caller cannot invoke the owner contact lookup', JSON.parse(ai.got.find(m => m.item?.call_id === 'denied').item.output).ok === false);
aiSock.send(JSON.stringify({ type: 'response.function_call_arguments.done', call_id: 'early-transfer', name: 'transfer_to_owner', arguments: '{"confirmed":true}' }));
await until(() => ai.got.some(m => m.item?.call_id === 'early-transfer'));
ok('transfer requires a saved customer request', transfers.length === 0 && JSON.parse(ai.got.find(m => m.item?.call_id === 'early-transfer').item.output).ok === false);

const aiSay = (o) => aiSock.send(JSON.stringify(o));
// caller audio goes to OpenAI untouched
tw.send(JSON.stringify({ event: 'media', media: { payload: 'AAAA' } }));
await until(() => ai.got.some(m => m.type === 'input_audio_buffer.append' && m.audio === 'AAAA'));
ok('caller audio frames are appended to OpenAI as they are', ai.got.some(m => m.type === 'input_audio_buffer.append' && m.audio === 'AAAA'));
// Maya's audio goes to Twilio untouched
aiSay({ type: 'response.created', response: { id: 'before-interruption' } });
aiSay({ type: 'response.output_audio.delta', delta: 'BBBB' });
await until(() => twGot.some(m => m.event === 'media'));
ok('Maya\'s audio frames reach Twilio on the stream', twGot.some(m => m.event === 'media' && m.streamSid === 'MZ1' && m.media.payload === 'BBBB'));
// barge in
aiSay({ type: 'input_audio_buffer.speech_started' });
await until(() => twGot.some(m => m.event === 'clear'));
ok('when the caller starts talking Twilio\'s buffer is cleared and Maya\'s sentence is cancelled',
  twGot.some(m => m.event === 'clear' && m.streamSid === 'MZ1') && ai.got.some(m => m.type === 'response.cancel'));
aiSay({type:'response.output_audio.delta',response_id:'before-interruption',delta:'LATE'});
aiSay({type:'response.created',response:{id:'after-interruption'}});
aiSay({type:'response.output_audio.delta',response_id:'after-interruption',delta:'NEW'});
await until(()=>twGot.some(m=>m.media?.payload==='NEW'));
ok('late cancelled response audio cannot refill the cleared buffer or suppress the next response',!twGot.some(m=>m.media?.payload==='LATE')&&twGot.some(m=>m.media?.payload==='NEW'));
// transcript
aiSay({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'I want a red gown for a gala in October.' });
aiSay({ type: 'response.output_audio_transcript.done', transcript: 'A red gown for October. What is your name?' });
// the lead
const before = ai.got.length;
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_1', name: 'save_lead', arguments: JSON.stringify({ name: 'Tori', wrote: 'a red gown for a gala in October', tier: 'ceremonial' }) });
await until(() => leads.length === 1);
ok('save_lead lands the caller in the station with the source phone and the caller id as the number',
  leads.length === 1 && leads[0].source === 'phone' && leads[0].name === 'Tori' && leads[0].phone === '+15105551234' && leads[0].wrote === 'a red gown for a gala in October' && leads[0].tier === 'ceremonial', JSON.stringify(leads));
await until(() => ai.got.slice(before).some(m => m.type === 'response.create'));
const fo = ai.got.slice(before).find(m => m.type === 'conversation.item.create');
ok('the tool answer goes back to OpenAI and Maya keeps talking', !!fo && fo.item.type === 'function_call_output' && fo.item.call_id === 'call_1' && /saved/i.test(fo.item.output) && ai.got.slice(before).some(m => m.type === 'response.create'));
// a second save updates the same lead
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_2', name: 'save_lead', arguments: JSON.stringify({ name: 'Tori', wrote: 'a red gown for a gala in October, floor length, she is 5 foot 6', email: 'tori@example.com' }) });
await until(() => leads.length === 2);
ok('a second save_lead updates the same lead instead of adding a twin', leads.length === 2 && leads[1].id === leads[0].id && leads[1].email === 'tori@example.com');
const stMid = await (await fetch(base + '/api/phone/status')).json();
ok('the status route counts the live call', stMid.calls === 1);
aiSay({ type: 'response.function_call_arguments.done', call_id: 'handoff', name: 'transfer_to_owner', arguments: '{"confirmed":true}' });
await until(() => transfers.length === 1);
ok('customer consent and a saved request hand off only the active call', transfers[0]?.callSid === 'CA123' && transfers[0]?.name === 'Tori');
// goodbye
let twClosed = false; tw.on('close', () => { twClosed = true; });
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_3', name: 'end_call', arguments: '{}' });
await until(() => twClosed, 5000);
ok('end_call hangs up after Maya\'s goodbye and the transcript is kept', twClosed === true && transcripts.length === 1 &&
  transcripts[0].callSid === 'CA123' && transcripts[0].rec.transcript.length === 2 && transcripts[0].rec.lead === leads[0].id && transcripts[0].rec.why === 'end_call', JSON.stringify(transcripts));
const stEnd = await (await fetch(base + '/api/phone/status')).json();
ok('the call is gone from the live count', stEnd.calls === 0);

// 4. a caller who talked but was never saved still lands in the station
{
  const tw2 = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw2.on('open', r));
  tw2.send(JSON.stringify({ event: 'start', streamSid: 'MZ2', start: { callSid: 'CA124', customParameters: { token: callToken(AUTH, 'CA124', '+14155550123'), from: '+14155550123' } } }));
  await until(() => ai.sockets.length === 2);
  const s2 = ai.sockets[1].sock;
  s2.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hi, I need a suit for my wedding in December, navy, three piece.' }));
  await wait(150);
  const n = leads.length;
  tw2.send(JSON.stringify({ event: 'stop' }));
  await until(() => transcripts.length === 2);
  await wait(100);
  ok('a hang up before save_lead still lands the caller in the station from the transcript, with the caller id',
    transcripts.length === 2 && leads.length === n + 1 && leads[n].source === 'phone' && leads[n].name === 'Caller' && leads[n].phone === '+14155550123' && /navy, three piece/.test(leads[n].wrote), JSON.stringify(leads.slice(n)));
}
// 5. v14.31: Maya calls Fromsa
{
  const placed = await phone.callFromsa('Fromsa asked for a test call from Admin.');
  const rest = twRest[0];
  ok('callFromsa places one Twilio call to Fromsa from the studio number, pointing at the outbound TwiML',
    placed.ok === true && placed.sid === 'CAOUT1' && !!rest && rest.url === '/2010-04-01/Accounts/ACtest/Calls.json' &&
    rest.auth === 'Basic ' + Buffer.from('ACtest:' + AUTH).toString('base64') &&
    rest.form.To === '+15104917540' && rest.form.From === '+15109909223' && rest.form.Url === 'https://maya.manasiyo.com/api/phone/outbound',
    JSON.stringify([placed, rest]));
  const oUrl = 'https://maya.manasiyo.com/api/phone/outbound';
  const oParams = { CallSid: 'CAOUT1', From: '+15109909223', To: '+15104917540', Direction: 'outbound-api' };
  const postO = (p, headers) => fetch(base + '/api/phone/outbound', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(p).toString() });
  const bad = await postO(oParams, {});
  const unknown = await postO({ ...oParams, CallSid: 'CAnope' }, { 'X-Twilio-Signature': sign(oUrl, { ...oParams, CallSid: 'CAnope' }, AUTH) });
  const good2 = await postO(oParams, { 'X-Twilio-Signature': sign(oUrl, oParams, AUTH) });
  const tw2 = await good2.text();
  ok('the outbound TwiML is signed, known to the server, and opens the same stream with a per call token',
    bad.status === 403 && unknown.status === 404 && good2.status === 200 && tw2.includes('name="context0"'), [bad.status, unknown.status, good2.status].join(','));
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  const twGot = []; tw.on('message', raw => { try { twGot.push(JSON.parse(raw.toString())); } catch (_) {} });
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ3', start: { callSid: 'CAOUT1', customParameters: { token: callToken(AUTH, 'CAOUT1', '+15104917540'), from: '+15104917540', callSid: 'CAOUT1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('on Fromsa\'s side Maya has lead and reviewable booking tools',
    !!su && /WHY YOU ARE CALLING: Fromsa asked for a test call from Admin\./.test(su.session.instructions) && /Hey Fromsa, it is Maya/.test(su.session.instructions) &&
    su.session.tools.map(t => t.name).join(',') === 'find_lead,list_leads,preview_booking,send_booking,note_lead,save_lead,set_tier,log_note,end_call,owner_control' && !/[\u2014\u2013]/.test(su.session.instructions), su && su.session.tools.map(t => t.name).join(','));
  const s3 = ai.sockets[n0].sock; const say = o => s3.send(JSON.stringify(o));
  const g1 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_l', name: 'list_leads', arguments: JSON.stringify({ count: 2 }) });
  await until(() => ai.got.slice(g1).some(m => m.type === 'conversation.item.create'));
  const lo = JSON.parse(ai.got.slice(g1).find(m => m.type === 'conversation.item.create').item.output);
  ok('list_leads reads the station for her', lo.ok === true && Array.isArray(lo.leads) && lo.leads.length === 2 && lo.leads[0].name, JSON.stringify(lo));
  const g2 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_n', name: 'note_lead', arguments: JSON.stringify({ lead: 'Tori', note: 'call her Thursday' }) });
  await until(() => ai.got.slice(g2).some(m => m.type === 'conversation.item.create'));
  const no = JSON.parse(ai.got.slice(g2).find(m => m.type === 'conversation.item.create').item.output);
  ok('note_lead writes his words onto the lead', no.ok === true && notes.length === 1 && notes[0].note === 'call her Thursday', JSON.stringify([no, notes]));
  const bookingTool=async(name,args)=>{const g=ai.got.length;say({type:'response.function_call_arguments.done',call_id:'book_'+g,name,arguments:JSON.stringify(args)});await until(()=>ai.got.slice(g).some(m=>m.type==='conversation.item.create'));return JSON.parse(ai.got.slice(g).find(m=>m.type==='conversation.item.create').item.output);};
  const bp=await bookingTool('preview_booking',{query:'Nick'});
  ok('booking is previewed to the owner before client delivery',bp.ok&&bp.text.includes('wix.to/wT2lSqE')&&bookingSends.length===0);
  const denied=await bookingTool('send_booking',{preview_id:bp.preview_id,confirmed:true});
  ok('booking cannot send without a spoken approval after the preview',denied.ok===false&&bookingSends.length===0);
  say({type:'conversation.item.input_audio_transcription.completed',transcript:'Yes, send that exact booking link to Nick.'});
  await wait(50);
  const delivered=await bookingTool('send_booking',{preview_id:bp.preview_id,confirmed:true});
  ok('spoken approval releases the exact preview once',delivered.ok&&bookingSends.length===1&&bookingSends[0]===bp.preview_id);
  let closed = false; tw.on('close', () => { closed = true; });
  const nl = leads.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_e', name: 'end_call', arguments: '{}' });
  await until(() => closed, 5000);
  const last = transcripts[transcripts.length - 1];
  ok('the brief call ends on end_call, its transcript says brief, and no ghost lead is made from Fromsa\'s own words',
    closed === true && last && last.rec.mode === 'brief' && last.rec.reason.startsWith('Fromsa asked') && leads.length === nl, JSON.stringify(last && last.rec));
  const twice = await phone.callFromsa('again');
  ok('a second call can be placed once the first is over', twice.ok === true);
}
// 6. v14.33: Fromsa calling in from his own number is the admin line
{
  const oUrl = 'https://maya.manasiyo.com/api/phone/incoming';
  const p = { CallSid: 'CAADM1', From: '+15104917540', To: '+15109909223' };
  const r = await fetch(base + '/api/phone/incoming', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign(oUrl, p, AUTH) }, body: new URLSearchParams(p).toString() });
  ok('Fromsa\'s own call is answered like any call', r.status === 200);
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ9', start: { callSid: 'CAADM1', customParameters: { token: callToken(AUTH, 'CAADM1', '+15104917540'), from: '+15104917540', callSid: 'CAADM1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('by caller id, not by his word: the session is the admin brief with the inbox tool and the snappier turn taking',
    !!su && /verified his number/.test(su.session.instructions) && /Hey Fromsa, it is Maya\. What do you need\?/.test(su.session.instructions) &&
    su.session.tools.map(t => t.name).join(',') === 'find_lead,list_leads,preview_booking,send_booking,note_lead,save_lead,set_tier,log_note,end_call,owner_control' &&
    su.session.audio.input.turn_detection.silence_duration_ms === 300, su && su.session.tools.map(t => t.name).join(','));
  const sk = ai.sockets[n0].sock; const say = o => sk.send(JSON.stringify(o));
  ok('owner call loads shared conversation preferences', /Keep responses brief/.test(su.session.instructions));
  const controlStart=ai.got.length;
  say({type:'response.function_call_arguments.done',call_id:'owner_memory',name:'owner_control',arguments:JSON.stringify({action:'remember',text:'I prefer linen'})});
  await until(()=>ai.got.slice(controlStart).some(m=>m.type==='conversation.item.create'));
  ok('verified owner voice preference reaches shared runtime control',ownerActions.length===1&&ownerActions[0].from==='+15104917540'&&ownerActions[0].id==='voice_CAADM1_owner_memory');
  const beforeOwner=leads.length;
  const saveOwner=async(args)=>{const g=ai.got.length;say({type:'response.function_call_arguments.done',call_id:'owner_'+g,name:'save_lead',arguments:JSON.stringify(args)});await until(()=>ai.got.slice(g).some(m=>m.type==='conversation.item.create'));return JSON.parse(ai.got.slice(g).find(m=>m.type==='conversation.item.create').item.output);};
  await saveOwner({name:'Pat'});
  ok('owner lead saves require a confirmed read-back',leads.length===beforeOwner);
  const pat=await saveOwner({name:'Pat',phone:'+14155550190',wrote:'Blue suit',confirmed:true});
  const sam=await saveOwner({name:'Sam',phone:'+14155550191',wrote:'Green jacket',confirmed:true});
  ok('two people on one owner call get separate lead records',pat.ok&&sam.ok&&pat.id!==sam.id&&leads.length===beforeOwner+2);
  const corrected=await saveOwner({name:'Pat',phone:'+14155550190',wrote:'Navy suit',confirmed:true,lead_id:pat.id});
  ok('an explicit correction updates only the previously saved person',corrected.ok&&corrected.id===pat.id);
  const g1 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_log', name: 'log_note', arguments: JSON.stringify({ text: 'the fabrics tab loads slowly on the iPad' }) });
  await until(() => ai.got.slice(g1).some(m => m.type === 'conversation.item.create'));
  ok('log_note lands his words in the studio inbox', inbox.length === 1 && /fabrics tab/.test(inbox[0]));
  const g1b = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_tier', name: 'set_tier', arguments: JSON.stringify({ lead: 'Tori', tier: 'signature' }) });
  await until(() => ai.got.slice(g1b).some(m => m.type === 'conversation.item.create'));
  const to = JSON.parse(ai.got.slice(g1b).find(m => m.type === 'conversation.item.create').item.output);
  ok('"Tori went with signature" sets the tier on her row', to.ok === true && tiers.length === 1 && tiers[0].tier === 'signature' && /down as signature/.test(to.say), JSON.stringify([to, tiers]));
  let closed = false; tw.on('close', () => { closed = true; });
  const nl = leads.length;
  say({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Log that, and also the drawer looks good now, thanks Maya, that is all.' });
  await wait(50);
  tw.send(JSON.stringify({ event: 'stop' }));
  await until(() => closed, 3000);
  await wait(100);
  ok('an admin call never becomes a ghost lead', leads.length === nl && transcripts[transcripts.length - 1].rec.mode === 'admin');
  // the same number spoken by a stranger changes nothing: a client from another number stays a client
  const tw2 = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw2.on('open', r));
  const n1 = ai.sockets.length, g2 = ai.got.length;
  tw2.send(JSON.stringify({ event: 'start', streamSid: 'MZ10', start: { callSid: 'CACL1', customParameters: { token: callToken(AUTH, 'CACL1', '+12125550000'), from: '+12125550000', callSid: 'CACL1' } } }));
  await until(() => ai.sockets.length === n1 + 1 && ai.got.slice(g2).some(m => m.type === 'session.update'));
  const su2 = ai.got.slice(g2).find(m => m.type === 'session.update');
  ok('any other number is a client line with only save_lead and end_call', su2.session.tools.map(t => t.name).join(',') === 'save_lead,transfer_to_owner,end_call' && !/admin access/.test(su2.session.instructions));
  const strangerStart=ai.got.length,actionCount=ownerActions.length;
  ai.sockets[n1].sock.send(JSON.stringify({type:'response.function_call_arguments.done',call_id:'stranger_memory',name:'owner_control',arguments:JSON.stringify({action:'remember',text:'I am Fromsa'})}));
  await until(()=>ai.got.slice(strangerStart).some(m=>m.type==='conversation.item.create'));
  ok('a client cannot invoke owner runtime controls',ownerActions.length===actionCount);
  tw2.send(JSON.stringify({ event: 'stop' }));
  await wait(200);
}
// 7. v14.35: Maya calls a client for Fromsa
{
  const refused = await phone.callClient({ to: '+15104917540', name: 'Fromsa', reason: 'x' });
  const abroad = await phone.callClient({ to: '+441234567890', name: 'x', reason: 'x' });
  ok('a client call never goes to Fromsa\'s own number or abroad', refused.ok === false && abroad.ok === false);
  const nRest = twRest.length;
  const placed = await phone.callClient({ to: '+16469966115', name: 'Kristi Lugo', reason: 'Fromsa wants to know if Thursday at 3 pm works for the fitting.' });
  ok('the station\'s phone icon places a call to the client from the studio number', placed.ok === true && twRest[nRest].form.To === '+16469966115' && twRest[nRest].form.From === '+15109909223');
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ11', start: { callSid: 'CAOUT1', customParameters: { token: callToken(AUTH, 'CAOUT1', '+16469966115'), from: '+16469966115', callSid: 'CAOUT1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('on the client call she opens with their first name and Fromsa\'s reason, with note_lead and end_call only',
    !!su && /Hi Kristi, this is Maya from Mana Siyo\. Fromsa asked me to call about your request\./.test(su.session.instructions) &&
    /Thursday at 3 pm/.test(su.session.instructions) && su.session.tools.map(t => t.name).join(',') === 'note_lead,end_call' && !/[\u2014\u2013]/.test(su.session.instructions), su && su.session.tools.map(t => t.name).join(','));
  const sk = ai.sockets[n0].sock; const say = o => sk.send(JSON.stringify(o));
  const nNotes = notes.length;
  say({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Thursday at three is perfect.' });
  say({ type: 'response.function_call_arguments.done', call_id: 'c_cn', name: 'note_lead', arguments: JSON.stringify({ note: 'Thursday at 3 pm works for the fitting' }) });
  await until(() => notes.length === nNotes + 1);
  ok('her note lands on that client, never on a name the model picks', notes[nNotes].lead === '+16469966115' && /Thursday/.test(notes[nNotes].note));
  let closed = false; tw.on('close', () => { closed = true; });
  say({ type: 'response.function_call_arguments.done', call_id: 'c_ce', name: 'end_call', arguments: '{}' });
  await until(() => closed, 5000);
  await wait(100);
  const tc = threadCalls[threadCalls.length - 1];
  ok('the call is written into the client\'s thread as an outgoing call with what they said', !!tc && tc.number === '+16469966115' && tc.dir === 'out' && tc.mode === 'client' && /Thursday at three/.test(tc.summary), JSON.stringify(tc));
}
// The answer and stream may land on a different Cloud Run instance.
{
  const savedContexts = new Map();
  const shared = { ...phoneDeps, saveOutbound: async (id, rec) => savedContexts.set(id, rec), loadOutbound: async id => savedContexts.get(id) };
  const sender = mountMayaPhone(express(), null, shared);
  const reason = 'A new customer request. ' + 'Details. '.repeat(90);
  const placed = await sender.callFromsa(reason);
  const callback = new URL(twRest.at(-1).form.Url);
  const receiverApp = express(); receiverApp.use(express.urlencoded({extended:false}));
  const receiverServer = http.createServer(receiverApp);
  const receiver = mountMayaPhone(receiverApp, receiverServer, shared);
  await new Promise(r => receiverServer.listen(0,'127.0.0.1',r));
  const target = 'http://127.0.0.1:' + receiverServer.address().port;
  const p = {CallSid:placed.sid,To:'+15104917540'};
  const r = await fetch(target+callback.pathname+callback.search,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':sign(callback.href,p,AUTH)},body:new URLSearchParams(p)});
  const markup = await r.text();
  const unescape = v => v.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const cp = Object.fromEntries([...markup.matchAll(/<Parameter name="([^"]+)" value="([^"]*)"/g)].map(m=>[m[1],unescape(m[2])]));
  ok('outbound briefing is durable before dialing and readable by a second instance', r.status===200 && savedContexts.size===1 && cp.context0 && Object.entries(cp).filter(([k])=>k.startsWith('context')).every(([k,v])=>k.length+v.length<500));
  const socket = new WebSocket(target.replace('http:','ws:')+'/api/phone/stream');
  await new Promise(r=>socket.on('open',r));
  const g0=ai.got.length;
  socket.send(JSON.stringify({event:'start',streamSid:'MZcross',start:{callSid:placed.sid,customParameters:cp}}));
  await until(()=>ai.got.slice(g0).some(m=>m.type==='session.update'));
  const session = ai.got.slice(g0).find(m=>m.type==='session.update');
  ok('signed stream context preserves the outbound reason without in-memory call state',session?.session.instructions.includes(reason));
  socket.close(); await wait(80);
  receiver.wss.close(); receiverServer.close();
}
// Slow/unavailable owner memory has a bounded startup and no invented preference.
{
 const oldContext=phoneDeps.ownerContext;phoneDeps.ownerContext=()=>new Promise(()=>{});phoneDeps.contextTimeoutMs=40;
 const tw=new WebSocket('ws://127.0.0.1:'+port+'/api/phone/stream');await new Promise(r=>tw.on('open',r));
 const g0=ai.got.length,n0=ai.sockets.length,started=Date.now();
 tw.send(JSON.stringify({event:'start',streamSid:'MZslow',start:{callSid:'CASLOW',customParameters:{token:callToken(AUTH,'CASLOW','+15104917540'),from:'+15104917540',callSid:'CASLOW'}}}));
 await until(()=>ai.got.slice(g0).some(m=>m.type==='response.create'));
 const su=ai.got.slice(g0).find(m=>m.type==='session.update');
 ok('owner context timeout does not stall greeting or invent remembered preferences',Date.now()-started<800&&su?.session.instructions.includes('Owner memory is unavailable'));
 const sock=ai.sockets[n0].sock;
 for(const event of [{type:'input_audio_buffer.speech_stopped'},{type:'response.created',response:{id:'timed'}},{type:'response.output_audio.delta',delta:'BBBB'},{type:'response.output_audio.delta',delta:'CCCC'}])sock.send(JSON.stringify(event));
 await until(()=>latencyLogs.some(x=>x[0]==='latency turn_first_audio'&&x[1]==='CASLOW'));
 ok('first audio timings log once per response and turn without transcript content',latencyLogs.filter(x=>x[0]==='latency response_first_audio'&&x[1]==='CASLOW').length===1&&latencyLogs.filter(x=>x[0]==='latency turn_first_audio'&&x[1]==='CASLOW').length===1);
 tw.close();await wait(80);phoneDeps.ownerContext=oldContext;delete phoneDeps.contextTimeoutMs;
}
ok('phoneInstructions reads the character first', phoneInstructions({ character: 'X', nowLA: 'now', from: '' }).startsWith('WHO YOU ARE:\nX'));

// A provider handshake that never opens releases the call instead of silently
// buffering/dropping the caller for the full ten-minute call cap.
{
 const oldClient=phoneDeps.WebSocketClient;let providerClosed=false;
 phoneDeps.WebSocketClient=class extends EventTarget {readyState=0;close(){providerClosed=true;this.readyState=3;}};
 phoneDeps.startupTimeoutMs=40;
 const socket=new WebSocket('ws://127.0.0.1:'+port+'/api/phone/stream');await new Promise(r=>socket.on('open',r));
 let closed=false;socket.on('close',()=>{closed=true;});const started=Date.now();
 socket.send(JSON.stringify({event:'start',streamSid:'MZhang',start:{callSid:'CAHANG',customParameters:{token:callToken(AUTH,'CAHANG','+15105551234'),from:'+15105551234'}}}));
 await until(()=>closed,1000);
 ok('stalled Realtime handshake closes both sockets within its configured startup deadline',closed&&providerClosed&&Date.now()-started<800&&!phone.live.has('CAHANG')&&latencyLogs.some(x=>x[0]==='call ended'&&x[2]==='openai_startup_timeout'));
 phoneDeps.WebSocketClient=oldClient;delete phoneDeps.startupTimeoutMs;
}

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + ' (' + passed + ' ok)');
aiSrv.close(); twSrv.close(); server.close();
process.exit(failed ? 1 : 0);

};

checks['maya-transfer']=async function(){
const {default:assert}=await import('node:assert/strict');
const {default:http}=await import('node:http');
const {default:crypto}=await import('node:crypto');
const {default:express}=await import('express');
const { mountTransfers }=await import('../backend/server/maya-transfer.mjs');
const app = express(), entries = new Map(), requests = [];
const carrier = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { requests.push(new URLSearchParams(b)); res.end('{}'); }); });
await new Promise(r => carrier.listen(0, '127.0.0.1', r));
const transfer = mountTransfers(app, { publicHost: 'maya.test', authToken: 'test', accountSid: 'ACtest', fromNumber: '+15109909223', fromsaPhone: '+15104917540',
  twilioApi: 'http://127.0.0.1:' + carrier.address().port, urlencoded: express.urlencoded({ extended: false }),
  save: async (id, data) => entries.set(id, data), load: async id => entries.get(id) });
const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const post = async (path, body, signed = true) => {
  const signature = crypto.createHmac('sha1', 'test').update('https://maya.test' + path + Object.keys(body).sort().map(k => k + body[k]).join('')).digest('base64');
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(signed ? { 'X-Twilio-Signature': signature } : {}) }, body: new URLSearchParams(body) });
};
try {
  assert.equal((await transfer({ callSid: 'CA123', name: 'Taylor <script>', request: 'a fitting & alterations', from: '+14155550100', to: '+19005550100' })).ok, true);
  const twiml = requests[0].get('Twiml');
  assert(twiml.includes('answerOnBridge="true"') && twiml.includes('>+15104917540</Number>') && !twiml.includes('19005550100'));
  assert.equal((await post('/api/phone/transfer/screen?call=CA123', {}, false)).status, 403);
  const screen = await (await post('/api/phone/transfer/screen?call=CA123', {})).text();
  assert(screen.includes('Taylor &lt;script&gt;') && screen.includes('&amp; alterations') && screen.includes('numDigits="1"'));
  assert(!(await (await post('/api/phone/transfer/accept', { Digits: '1' })).text()).includes('Hangup'));
  assert((await (await post('/api/phone/transfer/accept', { Digits: '2' })).text()).includes('Hangup'));
  assert((await (await post('/api/phone/transfer/result', { DialCallStatus: 'no-answer' })).text()).includes('callback request is saved'));
  entries.get('CA123').ts = 0;
  assert((await (await post('/api/phone/transfer/screen?call=CA123', {})).text()).includes('Hangup'));
  console.log('Transfer: fixed owner, signed callbacks, escaped summary, acceptance, decline, fallback, expiry passed.');
} finally { server.close(); carrier.close(); }

};

checks['maya-feedback']=async function(){
const {default:assert}=await import('node:assert/strict');
const { createFeedbackStore }=await import('../backend/server/maya-feedback.mjs');
let data = { items: [], _generation: '0' }, generation = 0;
const store = () => createFeedbackStore({ load: async () => structuredClone(data), save: async rec => {
  await new Promise(resolve => setTimeout(resolve, 1));
  if (rec._generation !== String(generation)) throw Object.assign(new Error('conflict'), { status: 412 });
  data = structuredClone({ ...rec, _generation: String(++generation) });
} });
const a = store(), b = store();
await Promise.all([a.append('The call was slow. Keep this wording.', 'Fromsa', 'phone'), b.append('The name did not save.', 'Fromsa', 'voice')]);
assert.equal(data.items.length, 2);
assert.equal(data.items.find(i => i.source === 'phone').text, 'The call was slow. Keep this wording.');
const id = data.items[0].id;
await Promise.all([a.complete(id, true), b.append('A second request', 'Fromsa', 'phone')]);
assert.equal(data.items.length, 3);
assert.equal(data.items.find(i => i.id === id).done, true);
let writes = 0;
const failing = createFeedbackStore({ load: async () => { throw new Error('offline'); }, save: async () => writes++ });
await assert.rejects(failing.append('Do not lose previous feedback', 'Fromsa'), /offline/);
assert.equal(writes, 0);
const corrupt = createFeedbackStore({ load: async () => ({ items: null }), save: async () => writes++ });
await assert.rejects(corrupt.append('x'), /invalid/);
assert.equal(writes, 0);
// No silent trimming of old, uncompleted requests at the old 500-item cap.
data.items = Array.from({ length: 500 }, (_, i) => ({ id: String(i), done: false }));
await a.append('Keep every pending request', 'Fromsa', 'phone');
assert.equal(data.items.length, 501);
console.log('Feedback: concurrent sources, completion, read failures, corruption, retention passed.');

};

checks['event-triggers']=async function(){
const {default:assert}=await import('node:assert/strict');
const {generateKeyPairSync,sign}=await import('node:crypto');
const {wixSubmission,createEventQueue,mountEventTriggers}=await import('../backend/server/event-triggers.mjs');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config={publicKey,instanceId:'maya-instance',formId:'callback-form'};
const id='11111111-1111-4111-8111-111111111111';
const data={eventType:'wix.forms.v4.submission_created',instanceId:config.instanceId,data:JSON.stringify({id,entityId:id,slug:'created',entityFqdn:'wix.forms.v4.submission',createdEvent:{entity:{id,formId:config.formId,namespace:'wix.form_app.form'}}})};
const jwt=(envelope=data,extra={},alg='RS256')=>{const parts=[{alg},{data:JSON.stringify(envelope),...extra}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url'));return parts.join('.')+'.'+sign('RSA-SHA256',Buffer.from(parts.join('.')),privateKey).toString('base64url');};
assert.deepEqual(wixSubmission(jwt(),config),{eventId:id,submissionId:id});
for(const token of ['bad',jwt(data,{},'none'),jwt({...data,instanceId:'another-site'}),jwt(data,{exp:1}),jwt({...data,eventType:'unrelated'})])assert.throws(()=>wixSubmission(token,config),e=>e.status===401);
assert.throws(()=>wixSubmission(jwt(),{}),e=>e.status===503);
const other=structuredClone(data),event=JSON.parse(other.data);event.createdEvent.entity.formId='unrelated';other.data=JSON.stringify(event);assert.equal(wixSubmission(jwt(other),config),null);
let queued=[],queueStatus=200;
const queue=createEventQueue({config:{queue:'projects/pro-maya/locations/us-west1/queues/callbacks',origin:'https://maya-api-example.us-west1.run.app',email:'worker@pro-maya.iam.gserviceaccount.com',audience:'maya-worker'},token:async()=>'fake-workload-token',fetch:async(url,request)=>{queued.push({url,body:JSON.parse(request.body)});return {ok:queueStatus===200,status:queueStatus};}});
await queue.enqueue({eventId:id,submissionId:id});queueStatus=409;assert.equal((await queue.enqueue({eventId:id,submissionId:id})).duplicate,true);
assert.equal(queued[0].body.task.name,queued[1].body.task.name);
assert.deepEqual(JSON.parse(Buffer.from(queued[0].body.task.httpRequest.body,'base64')),{submissionId:id});
assert.equal(queued[0].body.task.httpRequest.oidcToken.audience,'maya-worker');
queueStatus=503;await assert.rejects(queue.enqueue({eventId:id,submissionId:id}),e=>e.status===503);
let synced=[],runs=[],bindingCount=0,mailPending=false,alertFailed=false;
const routes=new Map(),noOp=()=>{};
mountEventTriggers({post:(path,...handlers)=>routes.set(path,handlers.at(-1))},{config:{wix:config,gmailTopic:'projects/pro-maya/topics/mail',gmailSubscription:'projects/pro-maya/subscriptions/mail'},text:noOp,json:noOp,requireAuth:noOp,requireOwner:async req=>{if(req.auth!=='owner')throw Object.assign(Error('denied'),{status:403});return {sub:'owner'};},verifyWorker:async req=>{if(req.auth!=='worker')throw Object.assign(Error('denied'),{status:401});},queue:{enqueue:async e=>{queued.push(e);}},alerts:()=>({run:async opts=>{runs.push(opts);return {failed:alertFailed?[{channel:'call'}]:[]};}}),gmail:{watch:async(uid,id,topic)=>({uid,id,topic}),watchBindings:async mail=>{bindingCount++;assert.equal(mail,'owner@example.com');return [{uid:'bound-owner',id:'mailbox'}];}},syncMailbox:async(uid,id)=>{synced.push({uid,id});return {errors:[],pending:mailPending};}});
const response=()=>({code:200,status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
async function invoke(path,req){const res=response();await routes.get(path)(req,res);return res;}
assert.equal((await invoke('/api/events/wix',{body:'fake'})).code,401);
assert.equal((await invoke('/api/events/wix',{body:jwt()})).code,200);
assert.equal((await invoke('/api/tasks/wix-callback',{body:{submissionId:id}})).code,401);assert.equal(runs.length,0);
assert.equal((await invoke('/api/tasks/wix-callback',{auth:'worker',body:{submissionId:id,phone:'forged',accountId:'forged'}})).code,200);assert.deepEqual(runs,[{source:'wix-event',submissionId:id}]);
assert.equal(routes.has('/api/events/gmail'),false,'Retired Gmail ingress is absent');
alertFailed=true;assert.equal((await invoke('/api/tasks/wix-callback',{auth:'worker',body:{submissionId:id}})).code,503,'Failed channel asks Cloud Tasks to retry through durable claims');
console.log('Event ingress: signed Wix scope, durable task deduplication, fail-closed setup without retired Gmail ingress passed.');

};

checks['lead-alerts']=async function(){
const {default:assert}=await import('node:assert/strict');
const {createLeadAlerts}=await import('../backend/server/lead-alerts.mjs');
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
const {mountLeadAlertRoutes}=await import('../backend/server/lead-alerts.mjs');
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

// Provider health remains private; the dashboard cannot render raw errors.
const {readFile}=await import('node:fs/promises');
const admin=await readFile(new URL('../backend/status.html',import.meta.url),'utf8');
assert.ok(!admin.includes('loadLeadAlertStatus')&&!admin.includes('callback-alert-note'));
assert.ok(admin.includes("fetch('/api/admin/lead-alerts/check'"),'Independent deduplicated callback check remains');
const {runInNewContext}=await import('node:vm');
const checkCode=admin.slice(admin.indexOf('async function checkLeadAlerts('),admin.indexOf('window.reloadLeads = reloadLeads;'));
let owner='owner-a',refreshes=0,screenReads=0,finishCheck;
const ui={_idTok:'fixture',_adminContext:()=>owner,_adminContextCurrent:ticket=>ticket===owner,reloadLeads:()=>refreshes++,document:{getElementById(){screenReads++;throw Error('No dashboard reporting');}},fetch:async()=>({ok:false,json:async()=>({ok:false,error:'PRIVATE_PROVIDER_FAILURE'})})};
runInNewContext(checkCode,ui);await ui.checkLeadAlerts();assert.equal(screenReads,0);assert.equal(refreshes,0,'Failure cannot imply delivery or refresh');
ui.fetch=async()=>({ok:true,json:async()=>({ok:true,texts:1,calls:0})});await ui.checkLeadAlerts();assert.equal(refreshes,1,'Accepted callback still refreshes current leads');
ui.fetch=()=>new Promise(resolve=>{finishCheck=resolve;});const late=ui.checkLeadAlerts();owner='owner-b';finishCheck({ok:true,json:async()=>({ok:true,texts:1})});await late;assert.equal(refreshes,1,'Late callback result cannot repaint another account');assert.equal(screenReads,0);
console.log('Concurrent claims, storage failure and persistent uncertainty remain protected; dashboard diagnostics are retired.');

// A blocked SMS formatter/provider cannot hold up the independent owner call.
let releaseText,ringed=false;
const fast=createLeadAlerts({...parallelStore,now:()=>now,fetchLeads:async id=>({connected:true,list:[{id:'fast',source:'wix',name:'Fast',ts:new Date(now).toISOString()},{id:'unrelated',source:'wix',name:'Unrelated',ts:new Date(now).toISOString()}]}),formatText:()=>new Promise(resolve=>{releaseText=resolve;}),textOwner:async()=>({ok:true}),callOwner:async()=>{ringed=true;return {ok:true};}});
const running=fast.run({source:'wix-event',submissionId:'fast'});
for(let i=0;i<50&&!ringed;i++)await new Promise(r=>setTimeout(r,1));
assert.equal(ringed,true,'Owner rings before SMS formatting resolves');releaseText('Fast');
assert.equal((await running).checked,1,'Immediate event sends only its verified submission');
const timing=(await fast.status()).items.find(l=>l.id==='fast');assert.equal(timing.callLeadAgeMs,0);assert.equal(timing.callProviderMs,0);
console.log('Immediate submission scoping, parallel owner ring and durable dispatch timing passed.');

};

checks['project-lifecycle']=async function(){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const {webcrypto}=await import('node:crypto');

// Execute the shipped page functions with deferred, account-aware fake stores.
// No Firebase SDK, browser, network, filesystem writes or provider calls.
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
async function until(test) { for(let i=0;i<100;i++) {if(test()) return; await Promise.resolve();} assert.fail('Deferred operation never reached its barrier'); }
function part(source, start, end) { const at=source.indexOf(start); assert.ok(at>=0,start); const stop=source.indexOf(end,at); assert.ok(stop>at,end); return source.slice(at,stop); }
function harness(page) {
  const source=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  const records=new Map(), assets=new Map(), writes=[], reads=[], notices=[], timers=new Map();
  const saveButton={textContent:'Save',disabled:false};
  let user='A', counter=0, clock=0;
  const hooks={read:null,commit:null,upload:null,batchAfterCommit:null};
  const snap=(path,data)=>({id:path.split('/').at(-1),ref:ref(path),exists:data!==undefined,data:()=>clone(data),metadata:{hasPendingWrites:false}});
  function authorize(path) {
    if(path.startsWith('users/') && path.split('/')[1]!==user) throw Error('permission-denied');
    if(path.startsWith('shares/') && path.split('/').length>2 && path.split('/')[1]!==user) throw Error('permission-denied');
  }
  async function read(path, query) {
    reads.push(path);
    const value=query ? (()=>{const docs=[...records].filter(([key,v])=>key.startsWith(path+'/') && key.slice(path.length+1).indexOf('/')<0 && query.every(([field,op,want])=>op==='==' && v[field]===want)).map(([key,v])=>snap(key,v));return {docs,forEach:fn=>docs.forEach(fn)};})() : snap(path,records.get(path));
    if(hooks.read) await hooks.read(path,query,value);
    return value;
  }
  function write(path,data,merge=false) {authorize(path); writes.push({path,data:clone(data)}); records.set(path,merge?{...records.get(path),...clone(data)}:clone(data));}
  function ref(path, query=null) {
    return {path,collection:name=>ref(path+'/'+name,[]),doc:name=>ref(path+'/'+name),where:(field,op,value)=>ref(path,[...(query||[]),[field,op,value]]),
      get:()=>read(path,query),set:async(data,options)=>write(path,data,options?.merge),update:async data=>write(path,data,true),
      delete:async()=>{authorize(path);records.delete(path);},onSnapshot:()=>()=>{}};
  }
  const db={collection:name=>ref(name,[]),runTransaction:async fn=>{const pending=[];const result=await fn({get:r=>r.get(),set:(r,v)=>pending.push([r.path,clone(v)])});if(hooks.commit) await hooks.commit(pending);for(const [p,v] of pending)write(p,v);return result;},batch:()=>{const pending=[];return {set:(r,v)=>pending.push([r.path,()=>write(r.path,v)]),delete:r=>pending.push([r.path,()=>records.delete(r.path)]),commit:async()=>{pending.forEach(([path])=>authorize(path));pending.forEach(([,fn])=>fn());if(hooks.batchAfterCommit)await hooks.batchAfterCommit();}};}};
  const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>123,delete:()=>null,increment:v=>v};
  const assetURL=path=>'https://storage.invalid/'+encodeURIComponent(path);
  function storageRef(path) {return {fullPath:path,
    put:async(blob)=>{authorize(path);if(hooks.upload) await hooks.upload(path,blob);assets.set(path,clone(blob));},
    getDownloadURL:async()=>assetURL(path),delete:async()=>{authorize(path);assets.delete(path);},
    listAll:async()=>({items:[...assets.keys()].filter(key=>key.startsWith(path.replace(/\/$/,'')+'/')).map(storageRef)})};}
  const ctx={console:{log(){},warn(){}},Promise,Set,Map,JSON,Date,Math,Uint8Array,TextEncoder,crypto:webcrypto,
    firebase:{auth:()=>({currentUser:user?{uid:user}:null}),firestore,storage:()=>({ref:storageRef})},
    setTimeout:(fn,ms)=>{const id=++clock;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async url=>({blob:async()=>({type:'image/jpeg',content:String(url)})}),
    blobFromPicture:async url=>{if(String(url).startsWith('https://storage.invalid/')){const data=assets.get(decodeURIComponent(url.split('/').at(-1)));if(!data)throw Error('missing source');return clone(data);}return {type:'image/jpeg',content:String(url)};},
    compressBlobForUpload:async blob=>blob,
    _authSeq:1,_boardEpoch:1,_persistTimer:null,_hydrating:false,_creatingBin:false,_flushNow:false,_autosaveDirty:false,_activeSessionId:null,_projectActivity:false,drawerRefreshes:0,
    currentClientName:null,lastSummary:null,lastTranscript:'',items:[],_lastPaintDropped:0,
    _avatarLibCache:null,_avatarLibCacheUid:null,_facePhotoVersion:0,_avatarSaveInFlight:false,_avatarSavePending:null,_avatarSaveTimer:null,_pendingAssetDeletes:[],_pendingLegacyDeletes:[],
    _cardSig:c=>c.title||c.imageUrl||c.image||'',_twoWordFromItems:()=>'',_autoProjectName:()=> 'Untitled fixture',
    _drainAssetDeletes(){},_hydrate:async fn=>fn(),_doClear(){ctx.items=[];ctx.lastSummary=null;ctx.lastTranscript='';ctx._projectActivity=false;ctx._boardEpoch++;},
    showError:msg=>notices.push(msg),showToast:msg=>notices.push(msg),refreshDrawerClientName(){},renderNotesPanel(){},
    document:{visibilityState:'visible',getElementById:id=>id==='save-session-btn'?saveButton:null},confirm:()=>false,_renderSessionsDropdown(){ctx.drawerRefreshes++;},
    window:{addEventListener:(_name,fn)=>{ctx.beforeUnload=fn;}},
    _flashAutosaved:()=>notices.push('Autosaved'),_notifySyncOffline:()=>notices.push('Offline'),
    _paintItems:items=>{ctx.items=items;},_opContext:()=>({id:ctx.projectStore.currentId,auth:ctx._authSeq}),_opStillValid:stamp=>stamp.id===ctx.projectStore.currentId&&stamp.auth===ctx._authSeq,
    closeShareModal(){},_showShareModal:(link,name,error)=>{if(link||error)notices.push(link||error);},location:{origin:'https://maya.invalid'},navigator:{clipboard:{writeText:async()=>{}}},
    _safeImgSrc:s=>typeof s==='string'?s:'',_safeRealism:()=>null,
  };
  runInNewContext(part(source,'const projectStore = {','async function _renderSessionsDropdown()')+'\nglobalThis.projectStore=projectStore;',ctx);
  runInNewContext(part(source,'function _persistSession(','// v11.31: flush immediately'),ctx);
  runInNewContext(part(source,'async function _persistNow(flush) {','// v11.0: full session sync'),ctx);
  runInNewContext(part(source,'async function _rescueLegacyProjects(','// ── v12.6: TIP.'),ctx);
  runInNewContext(part(source,'let _cloudBooted = false;','// ── v12.5 ONE TIME RESCUE'),ctx);
  runInNewContext(part(source,'const _shareJobs=new Map();','// v13.8: the share popup.'),ctx);
  runInNewContext(part(source,'function _shareText(','// Boot path: /?share=TOKEN.'),ctx);
  const store=ctx.projectStore;store._newId=()=> 'pfixture'+(++counter);
  ctx._avatarsDoc=()=>ref('users/'+user+'/settings/avatars');
  ctx._avatarIdentity=()=>ctx.lastSummary?{name:ctx.lastSummary.client.name,face:ctx.lastSummary._face_photo,descriptors:null,measurements:null}:null;
  runInNewContext(part(source,'async function _saveCurrentAvatarToLibrary(','async function saveAvatarFromDrawer('),ctx);
  runInNewContext(part(source,'async function saveSessionNow() {','// Hook used by confirmClientName'),ctx);
  runInNewContext(part(source,'async function renameProjectById(id, name) {','function pgRenameProject(id) {'),ctx);
  runInNewContext(part(source,'async function newConsultation() {','// ════════════════════════════════════════════════════════════\n// v10.1:'),ctx);
  runInNewContext(part(source,'async function _autosaveTick() {','setInterval(_autosaveTick'),ctx);
  runInNewContext(part(source,"window.addEventListener('beforeunload'",'// v11.32: guard against'),ctx);
  function board(name='Original',id='pfixture-existing') {store.currentId=id;store.ownerUid=user;ctx.currentClientName=name;ctx.items=[{id:1,el:{style:{left:'0',top:'0'}},card:{title:name}}];records.set('users/'+user+'/projects/'+id,{name,epoch:2,revision:0,items:[]});}
  return {ctx,store,records,assets,writes,reads,notices,timers,hooks,assetURL,board,saveButton,switchUser(next){user=next;ctx._authSeq++;},user:()=>user};
}

for(const page of ['frontend/index.html']) {
  { // A slower earlier drawer read and a background refresh cannot replace a newer row or inline rename.
    const h=harness(page),old=deferred(),fresh=deferred(),list={innerHTML:'',editing:false,querySelector(){return this.editing;}};
    h.ctx.document={getElementById:()=>list,querySelector:()=>false};h.ctx._lastReconcileAt=Date.now();h.ctx._reconcileInFlight=false;h.ctx._NEW_PROJECT_ROW='new';h.ctx._sessionRows=rows=>rows.map(r=>r.id).join(',');
    const source=readFileSync(page,'utf8');runInNewContext(part(source,'async function _renderSessionsDropdown() {','let _reconcileInFlight = false;'),h.ctx);
    let calls=0;h.store.list=()=>++calls===1?old.promise:fresh.promise;
    const first=h.ctx._renderSessionsDropdown(),second=h.ctx._renderSessionsDropdown();fresh.resolve([{id:'saved-photo'}]);await second;old.resolve([{id:'old'}]);await first;assert.equal(list.innerHTML,'saved-photo');
    list.editing=true;h.store.list=async()=>[{id:'newer'}];await h.ctx._renderSessionsDropdown();assert.equal(list.innerHTML,'saved-photo');
  }
  { // The first photo/text/mic action is visible in Projects after cloud acknowledgement.
    for(const kind of ['photo','text','mic']) {
      const h=harness(page),gate=deferred();let blocked=false;
      if(kind==='photo')h.ctx.items=[{id:1,el:{style:{}},card:{title:'Photo only',kind:'inspo',image:'data:image/jpeg;base64,FIRST'}}];
      if(kind==='text')h.ctx.lastTranscript='A cropped hood jacket';
      h.ctx._persistSession(kind==='mic');
      const touch=h.store._touchIndex.bind(h.store);h.store._touchIndex=async(...args)=>{blocked=true;await gate.promise;return touch(...args);};
      const saving=h.ctx._persistNow();await until(()=>blocked);
      assert.equal(h.ctx.drawerRefreshes,0,'Never show an unacknowledged draft as saved');
      const id=h.store.currentId,doc=h.records.get('users/A/projects/'+id);assert.ok(doc);
      gate.resolve();await saving;assert.equal(h.ctx.drawerRefreshes,1,'First acknowledgement refreshes the drawer, even without text cards');
      if(kind==='photo')assert.ok(doc.items[0].card.storagePath);
      if(kind==='text')assert.equal(doc.lastTranscript,'A cropped hood jacket');
      h.ctx._persistSession();await h.store.flush();assert.equal(h.store.currentId,id);assert.equal(h.ctx.drawerRefreshes,1,'Later autosaves do not repaint editable project rows');
    }
  }
  { // A failed first save is not presented as saved; retry uses the same project and publishes once.
    const h=harness(page);h.ctx.lastTranscript='Keep my words';h.ctx._persistSession();h.hooks.commit=async()=>{throw Error('offline');};
    await h.ctx._persistNow();const id=h.store.currentId;assert.equal(h.ctx.drawerRefreshes,0);assert.equal(h.store._dirty,true);
    h.hooks.commit=null;assert.equal(await h.store.flush(),true);assert.equal(h.store.currentId,id);assert.equal(h.ctx.drawerRefreshes,1);
  }
  { // Merely selecting an avatar must not create a project, but navigation must flush a mic-only draft.
    const h=harness(page);h.ctx.lastSummary={client:{name:'Avatar'}};h.ctx._persistSession();await h.ctx._persistNow();assert.equal(h.store.currentId,null);
    h.ctx._persistSession(true);assert.equal(await h.store.flush(),true);assert.ok(h.store.currentId);
    h.ctx._doClear();h.store.detach();await h.ctx._persistNow();assert.equal(h.store.currentId,null);
  }
  { // An account transition during first indexing cannot repaint another account's Projects.
    const h=harness(page),gate=deferred();h.ctx.lastTranscript='New project';let blocked=false;
    h.store._touchIndex=async()=>{blocked=true;await gate.promise;};const saving=h.ctx._persistNow();await until(()=>blocked);
    h.switchUser('B');gate.resolve();await saving;assert.equal(h.ctx.drawerRefreshes,0);
  }
  { // Photo and avatar uploads begin concurrently, with one transactional project acknowledgement.
    const h=harness(page),gate=deferred();h.board();h.ctx.items[0].card.image='data:image/jpeg;base64,PHOTO';h.ctx.lastSummary={client:{name:'Avatar'},_face_photo:'data:image/jpeg;base64,FACE'};
    let uploads=0;h.hooks.upload=async()=>{uploads++;await gate.promise;};const saving=h.store.save();await until(()=>uploads===2);gate.resolve();assert.equal((await saving).written,true);
    assert.equal(h.assets.size,2);assert.equal(h.writes.filter(w=>w.path==='users/A/projects/pfixture-existing').length,1);
  }
  for(const operation of ['index','list','reconcile','migration','boot']) {
    for(const returnToA of [false,true]) {
      const h=harness(page),gate=deferred();let blocked=false;
      h.records.set('users/A/projects/privateA',{name:'Private A',epoch:2,revision:1,items:[]});
      h.records.set('users/A/sessions/legacyA',{name:'Private legacy A',items:[],lastTranscript:'Private notes'});
      h.hooks.read=async path=>{if(!blocked && path===(operation==='migration'||operation==='boot'?'users/A/sessions':operation==='list'?'users/A/settings/projectIndex':'users/A/projects')){blocked=true;await gate.promise;}};
      let opens=0;h.store.open=async()=>{opens++;};
      const running=operation==='index'?h.store._rebuildIndex():operation==='list'?h.store.list(true):operation==='reconcile'?h.store.reconcile():operation==='migration'?h.ctx._rescueLegacyProjects():h.ctx._cloudBoot();
      const finished=Promise.resolve(running).catch(e=>{assert.match(e.message,/auth-changed/);});
      await until(()=>blocked);h.switchUser('B');if(returnToA)h.switchUser('A');gate.resolve();await finished;
      assert.equal(h.writes.length,0,`${page} ${operation}: stale account/session cannot write`);
      assert.equal(h.store._idxCache,null,`${page} ${operation}: stale data cannot enter cache`);
      assert.equal(opens,0,`${page} ${operation}: stale boot cannot open a project`);
    }
  }
  { // First save failure retains the bin and dirty state; retry uses the same id.
    const h=harness(page);h.ctx.items=[{id:1,el:{style:{}},card:{title:'New board'}}];
    h.hooks.commit=async()=>{throw Error('Storage unavailable');};
    await assert.rejects(h.store.createAuto(),/Storage unavailable/);const id=h.store.currentId;
    assert.ok(id);assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),false);assert.equal(h.store.currentId,id);
    h.hooks.commit=null;assert.equal(await h.store.flush(),true);assert.equal(h.store.currentId,id);assert.equal(h.store._dirty,false);
    assert.equal(h.records.get('users/A/projects/'+id).items[0].card.title,'New board');
  }
  { // A resolved non-write cannot masquerade as successful initial creation.
    const h=harness(page);h.store._commit=async()=>({written:false,reason:'stale'});
    await assert.rejects(h.store.createFromCanvas('New project'),/not saved/);assert.equal(h.store._dirty,true);
  }
  { // A navigation flush before debounce saves both existing and brand new boards.
    for(const existing of [true,false]) {const h=harness(page);if(existing)h.board();else h.ctx.items=[{id:1,el:{style:{}},card:{title:'New'}}];
      h.ctx._persistSession();assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),true);
      assert.equal(h.store._dirty,false);assert.ok(h.records.get('users/A/projects/'+h.store.currentId).items.length);assert.equal(h.ctx._persistTimer,null);
    }
  }
  { // Navigation waits for an in-flight first save.
    const h=harness(page),gate=deferred();h.ctx.items=[{id:1,el:{style:{}},card:{title:'New'}}];let blocked=false;
    h.hooks.commit=async()=>{blocked=true;await gate.promise;};const creating=h.store.createAuto();await until(()=>blocked);
    let flushed=false;const flushing=h.store.flush().then(result=>{flushed=true;return result;});await Promise.resolve();assert.equal(flushed,false);
    gate.resolve();await creating;assert.equal(await flushing,true);
  }
  { // A newer edit during a pending write remains dirty, then flush persists it.
    const h=harness(page),gate=deferred();h.board();h.store.queueSave();let blocked=false;
    h.hooks.commit=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.ctx.items[0].card.title='Newer edit';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),true);
    assert.equal(h.records.get('users/A/projects/'+h.store.currentId).items[0].card.title,'Newer edit');
  }
  { // Overlapping save requests share completed work instead of repeating identical writes.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.hooks.commit=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const first=h.store.save();await until(()=>blocked);h.ctx.items[0].card.title='Latest queued edit';h.ctx._persistSession();
    const queued=Array.from({length:6},()=>h.store.save());gate.resolve();const results=await Promise.all([first,...queued]);
    assert.ok(results.every(r=>r.written));assert.equal(h.writes.filter(w=>w.path==='users/A/projects/pfixture-existing').length,2,'Only the original and newest snapshots require writes');
    assert.equal(h.records.get('users/A/projects/pfixture-existing').items[0].card.title,'Latest queued edit');assert.equal(h.store._dirty,false);
  }
  { // Explicit saves still capture edits without a debounce; failed queued saves retry.
    for(const fails of [false,true]){const h=harness(page),gate=deferred();h.board();let commits=0;
      h.hooks.commit=async()=>{commits++;if(commits===1){await gate.promise;if(fails)throw Error('Temporary failure');}};
      const first=h.store.save().catch(e=>({error:e.message}));await until(()=>commits===1);h.ctx.currentClientName='Explicit new name';const second=h.store.save();gate.resolve();await first;assert.equal((await second).written,true);
      assert.equal(h.records.get('users/A/projects/pfixture-existing').name,'Explicit new name');assert.equal(h.store._dirty,false);
    }
  }
  { // A save queued before a same-project reopen does not write the replacement canvas.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.hooks.commit=async()=>{blocked=true;await gate.promise;};const first=h.store.save();await until(()=>blocked);const queued=h.store.save();h.store.detach();h.ctx._doClear();h.board('Reopened board');gate.resolve();await first;
    assert.equal((await queued).written,false);assert.equal(h.ctx.items[0].card.title,'Reopened board');assert.equal(h.writes.filter(w=>w.path==='users/A/projects/pfixture-existing').length,1);
  }
  { // Same UID in a new auth generation cannot commit an old queued save.
    const h=harness(page),gate=deferred();h.board();h.store.queueSave();let blocked=false;
    h.hooks.read=async path=>{if(path==='users/A/projectTombstones/'+h.store.currentId){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.switchUser('B');h.switchUser('A');gate.resolve();assert.equal((await saving).written,false);assert.equal(h.writes.length,0);
  }
  { // A late project load cannot restore A's board into a new auth session.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.records.set('users/A/projects/other',{name:'Other A project',epoch:2,revision:1,items:[]});
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const opening=h.store.open('other');await until(()=>blocked);h.switchUser('B');gate.resolve();assert.equal(await opening,false);assert.equal(h.ctx.currentClientName,'Original');
  }
  { // Editing during a slow project read must save those later edits before leaving.
    const h=harness(page),gate=deferred();h.board();h.store.queueSave();await h.store.flush();let blocked=false;
    h.records.set('users/A/projects/other',{name:'Other project',epoch:2,revision:1,items:[]});
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const opening=h.store.open('other');await until(()=>blocked);h.ctx.items[0].card.title='Edited while opening';h.ctx._persistSession();gate.resolve();
    assert.equal(await opening,true);assert.equal(h.records.get('users/A/projects/pfixture-existing').items[0].card.title,'Edited while opening','A slow project read cannot discard newer edits');
  }
  { // New invalidates an earlier pending project selection.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.records.set('users/A/projects/other',{name:'Other project',epoch:2,revision:1,items:[]});
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const opening=h.store.open('other');await until(()=>blocked);await h.ctx.newConsultation();gate.resolve();
    assert.equal(await opening,false);assert.equal(h.store.currentId,null);assert.equal(h.ctx.currentClientName,null);
  }
  { // A failed late-edit flush cancels navigation and retains the reviewed board.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.records.set('users/A/projects/other',{name:'Other project',epoch:2,revision:1,items:[]});
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const opening=h.store.open('other');await until(()=>blocked);h.ctx.items[0].card.title='Keep this edit';h.ctx._persistSession();h.hooks.commit=async()=>{throw Error('Offline');};gate.resolve();
    assert.equal(await opening,false);assert.equal(h.store.currentId,'pfixture-existing');assert.equal(h.ctx.items[0].card.title,'Keep this edit');assert.equal(h.store._dirty,true);
  }
  { // Rename must report a failed or non-written save honestly and remain retryable.
    for(const failure of ['throw','stale']){const h=harness(page);h.board();
      if(failure==='throw')h.hooks.commit=async()=>{throw Error('Offline');};else h.records.get('users/A/projects/pfixture-existing').revision=9;
      assert.equal(await h.ctx.renameProjectById('pfixture-existing','Reviewed name'),false);assert.equal(h.store._dirty,true);assert.ok(!h.notices.some(s=>s.startsWith('Renamed to ')));
      if(failure==='throw'){h.hooks.commit=null;assert.equal(await h.ctx.renameProjectById('pfixture-existing','Reviewed name'),true);assert.equal(h.records.get('users/A/projects/pfixture-existing').name,'Reviewed name');}
    }
  }
  { // Manual Save cannot acknowledge an old snapshot while newer edits remain unsaved.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.hooks.commit=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const saving=h.ctx.saveSessionNow();await until(()=>blocked);h.ctx.items[0].card.title='Newest reviewed edit';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.store._dirty,false);assert.equal(h.records.get('users/A/projects/pfixture-existing').items[0].card.title,'Newest reviewed edit');assert.ok(h.notices.includes('Saved: Original'));
  }
  { // A later write failure remains visible; retry saves the still-present draft.
    const h=harness(page),gate=deferred();h.board();let commits=0;
    h.hooks.commit=async()=>{commits++;if(commits===1)await gate.promise;else throw Error('Offline');};
    const saving=h.ctx.saveSessionNow();await until(()=>commits===1);h.ctx.items[0].card.title='Keep the later edit';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.store._dirty,true);assert.ok(!h.notices.some(s=>s.startsWith('Saved:')));assert.equal(h.ctx.items[0].card.title,'Keep the later edit');
    h.hooks.commit=null;await h.ctx.saveSessionNow();assert.equal(h.store._dirty,false);assert.equal(h.records.get('users/A/projects/pfixture-existing').items[0].card.title,'Keep the later edit');
  }
  { // Save/New completions belong to their original account and project.
    for(const action of ['save','new']){const h=harness(page),gate=deferred();h.board();h.store.queueSave();let blocked=false;
      h.hooks.commit=async()=>{blocked=true;await gate.promise;};h.ctx.confirm=()=>true;
      const pending=action==='save'?h.ctx.saveSessionNow():h.ctx.newConsultation();await until(()=>blocked);h.switchUser('B');await h.store.teardown();h.board('B workspace');gate.resolve();await pending;
      assert.equal(h.store.currentId,'pfixture-existing');assert.equal(h.ctx.currentClientName,'B workspace');assert.equal(h.ctx.items[0].card.title,'B workspace');assert.ok(!h.notices.some(s=>/^(Saved:|New project)/.test(s)));
    }
  }
  { // Save acknowledgement after a project switch must not describe its successor.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.hooks.commit=async()=>{blocked=true;await gate.promise;};const saving=h.ctx.saveSessionNow();await until(()=>blocked);h.store.detach();h.ctx._doClear();h.board('Other project','other');gate.resolve();await saving;
    assert.equal(h.ctx.currentClientName,'Other project');assert.ok(!h.notices.some(s=>s.startsWith('Saved:')));
  }
  { // Coalesced manual callers preserve their own acknowledgement scope and button state.
    for(const change of ['none','project','account']){const h=harness(page),gate=deferred();h.board();let blocked=false;
      h.hooks.commit=async()=>{if(!blocked){blocked=true;await gate.promise;}};
      const first=h.ctx.saveSessionNow();await until(()=>blocked);const second=h.ctx.saveSessionNow();
      if(change!=='none'){if(change==='account'){h.switchUser('B');await h.store.teardown();}else{h.store.detach();h.ctx._doClear();}h.board('Successor workspace');}
      gate.resolve();await Promise.all([first,second]);
      assert.equal(h.saveButton.disabled,false);assert.equal(h.saveButton.textContent,'Save');
      if(change==='none')assert.equal(h.notices.filter(s=>s==='Saved: Original').length,2);
      else{assert.equal(h.ctx.currentClientName,'Successor workspace');assert.ok(!h.notices.some(s=>s.startsWith('Saved:')));}
    }
  }
  { // A delete acknowledged after account change cannot clear the new owner's board.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.hooks.batchAfterCommit=async()=>{blocked=true;await gate.promise;};const deleting=h.store.remove('pfixture-existing');await until(()=>blocked);h.switchUser('B');await h.store.teardown();h.board('B workspace');gate.resolve();await deleting;
    assert.equal(h.store.currentId,'pfixture-existing');assert.equal(h.ctx.items[0].card.title,'B workspace');
  }
  { // No delete batch is created after any prerequisite read changes account generation.
    for(const boundary of ['users/A/projects/pfixture-existing','community','shares'])for(const back of [false,true]){
      const h=harness(page),gate=deferred();h.board();let blocked=false;
      h.hooks.read=async path=>{if(path===boundary){blocked=true;await gate.promise;}};
      const deleting=h.store.remove('pfixture-existing').catch(e=>{assert.match(e.message,/auth-changed/);});await until(()=>blocked);h.switchUser('B');if(back)h.switchUser('A');gate.resolve();await deleting;
      assert.ok(h.records.has('users/A/projects/pfixture-existing'));assert.equal(h.writes.length,0);
    }
  }
  { // Autosave never advertises a fully saved board while a newer edit is pending.
    const h=harness(page),gate=deferred();h.board();h.ctx._persistSession();let blocked=false;
    h.hooks.commit=async()=>{blocked=true;await gate.promise;};const saving=h.ctx._autosaveTick();await until(()=>blocked);h.ctx.items[0].card.title='Edit during autosave';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.store._dirty,true);assert.ok(!h.notices.includes('Autosaved'));assert.equal(h.ctx._autosaveDirty,true);
    h.hooks.commit=null;await h.ctx._autosaveTick();assert.equal(h.store._dirty,false);assert.ok(h.notices.includes('Autosaved'));
  }
  { // Oversized notes must never be silently removed from a successful save.
    for(const notes of ['Client words '.repeat(80000),'布'.repeat(310000)]){const h=harness(page);h.board();h.ctx.lastTranscript=notes;
      await assert.rejects(h.store.save(),e=>e.tooBig===true);assert.equal(h.store._dirty,true);assert.equal(h.writes.length,0);assert.equal(h.ctx.lastTranscript,notes);
      h.ctx.lastTranscript='Reviewed shorter notes';h.ctx._persistSession();assert.equal(await h.store.flush(),true);assert.equal(h.records.get('users/A/projects/pfixture-existing').lastTranscript,'Reviewed shorter notes');
    }
  }
  { // Online status does not prove a pending write survived refresh or tab close.
    const h=harness(page);h.board();
    for(const online of [true,false])for(const dirty of [true,false])for(const pending of [true,false]){
      h.ctx.navigator.onLine=online;h.store._dirty=dirty;h.ctx._persistTimer=pending?1:null;let warned=false;
      h.ctx.beforeUnload({preventDefault(){warned=true;},returnValue:undefined});assert.equal(warned,dirty||pending,'Only an acknowledged clean draft can leave without a warning');
    }
    h.ctx._persistSession();await h.ctx._persistNow(true);await h.store._chain;
    assert.equal(h.ctx._persistTimer,null);assert.equal(h.store._dirty,false,'A completed background flush does not leave a stale warning');
  }
  { // A New continuation cannot clear another account's label after hydration.
    const h=harness(page);h.board();h.ctx._hydrate=async fn=>{await fn();h.switchUser('B');h.store.detach();h.board('B workspace');};
    await h.ctx.newConsultation();assert.equal(h.ctx.currentClientName,'B workspace');assert.ok(!h.notices.includes('New project.'));
  }
  { // Replacing an image while its previous upload is pending requires a new upload.
    const h=harness(page),gate=deferred();h.board();h.ctx.items[0].card.image='data:image/jpeg;base64,OLD';h.ctx._persistSession();let blocked=false;
    h.hooks.upload=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.ctx.items[0].card.image='data:image/jpeg;base64,NEW';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.ctx.items[0].card._uploadedToCloud,undefined);assert.equal(await h.store.flush(),true);
    const card=h.records.get('users/A/projects/'+h.store.currentId).items[0].card;
    assert.equal(h.assets.get(card.storagePath).content,'data:image/jpeg;base64,NEW');
  }
  { // A late face upload cannot assign its URL to the newly selected person.
    const h=harness(page),gate=deferred();h.board();h.ctx.lastSummary={client:{name:'First'},_face_photo:'data:image/jpeg;base64,FIRST'};let blocked=false;
    h.hooks.upload=async()=>{blocked=true;await gate.promise;};const snapshot=h.store._summaryForCloud(h.store.currentId,'A');await until(()=>blocked);
    h.ctx.lastSummary={client:{name:'Second'},_face_photo:'data:image/jpeg;base64,SECOND'};gate.resolve();await snapshot;
    assert.equal(h.ctx.lastSummary._face_photo_path,undefined);assert.equal(h.ctx.lastSummary._face_photo_url,undefined);
  }
  { // Saving a migrated project must retain the source tombstone relationship.
    const h=harness(page);h.records.set('users/A/sessions/legacy',{name:'Recovered',lastTranscript:'Notes',items:[]});
    await h.ctx._rescueLegacyProjects();const [path,project]=[...h.records].find(([path])=>path.startsWith('users/A/projects/'));
    h.store.currentId=path.split('/').at(-1);h.store.ownerUid='A';h.store.revision=project.revision;h.ctx.currentClientName='Edited recovered';
    await h.store.save();assert.equal(h.records.get(path).recoveredFrom,'legacy');await h.store.remove(h.store.currentId);
    assert.ok(h.records.has('users/A/projectTombstones/legacy'));h.records.delete('users/A/settings/migration');await h.ctx._rescueLegacyProjects();
    assert.equal([...h.records.keys()].filter(path=>path.startsWith('users/A/projects/')).length,0,'Deleted legacy source cannot return on migration retry');
  }
  { // A saved imageUrl card becomes a distinct share-owned asset; stale image loses.
    const h=harness(page);h.board();const original='users/A/projects/'+h.store.currentId+'/images/original.jpg';h.assets.set(original,{type:'image/jpeg',content:'Private picture'});
    const list=[{card:{imageUrl:h.assetURL(original),image:'https://wrong.invalid/old.jpg',storagePath:original,_uploadedToCloud:true}}];
    await h.ctx._publishShare(h.store.currentId,list,null,null,'Shared');
    const share=[...h.records].find(([path])=>/^shares\/[^/]+$/.test(path))[1];const card=share.items[0].card;
    assert.ok(card.imageUrl.includes(encodeURIComponent('shares/A/')));assert.equal(card.image,undefined);assert.equal(card.storagePath,undefined);
    h.assets.delete(original);const imported=h.ctx._sanitizeSharedItem(share.items[0]);assert.equal((await h.ctx.blobFromPicture(imported.card.image)).content,'Private picture');
  }
  { // A stale source read cannot publish the old account's project as the new owner.
    const h=harness(page),gate=deferred();h.records.set('users/A/projects/other',{name:'A',items:[]});let blocked=false;
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const sharing=h.ctx.shareProjectById('other');await until(()=>blocked);h.switchUser('B');gate.resolve();await sharing;assert.equal(h.writes.length,0);
  }
  { // Switching during copy cannot create a share document or new-account metadata.
    const h=harness(page),gate=deferred();h.board();let blocked=false;h.hooks.upload=async()=>{blocked=true;await gate.promise;};
    const sharing=h.ctx._publishShare(h.store.currentId,[{card:{imageUrl:'https://source.invalid/photo'}}],null,null,'A').catch(e=>{assert.match(e.message,/auth-changed/);});
    await until(()=>blocked);h.switchUser('B');gate.resolve();await sharing;assert.equal(h.writes.length,0);
  }
  { // Deletion while copying prevents publication; partial copies are cleaned.
    const h=harness(page);h.board();h.hooks.upload=async()=>{h.records.delete('users/A/projects/'+h.store.currentId);};
    await assert.rejects(h.ctx._publishShare(h.store.currentId,[{card:{imageUrl:'https://source.invalid/photo'}}],null,null,'A'),/deleted/);
    assert.equal(h.assets.size,0);assert.equal(h.writes.length,0);
  }
  console.log(`${page}: account/session races, dirty/create/flush barriers and independent share copies passed.`);
}

};

checks['voice-preparation']=async function(){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const code=readFileSync('docs/aesthetics/ui/voice-preparation.js','utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function harness(){
 let scope='owner-A/project-A',clock=0,sequence=0,micGate=null,tokenGate=null,answerGate=null,attachGate=null,tokenError=null,blocked=false,ack=true;
 const timers=new Map(),connections=[],microphones=[],events=[],requests=[],stops=[];
 const timer=(fn,ms,repeat=false)=>{const id=++sequence;timers.set(id,{fn,at:clock+ms,ms,repeat});return id;};
 class Audio{setAttribute(){}play(){events.push('play');return blocked?Promise.reject(Error('NotAllowedError')):Promise.resolve();}pause(){events.push('pause');}}
 class PC{
  constructor(){connections.push(this);this.connectionState='new';this.sender={track:null,replaceTrack:async track=>{if(attachGate)await attachGate.promise;this.sender.track=track;events.push('attach');}};}
  addTransceiver(kind,config){assert.equal(kind,'audio');assert.equal(config.direction,'sendrecv');return {sender:this.sender};}
  createDataChannel(){this.dc={sent:[],send:v=>this.dc.sent.push(JSON.parse(v)),close:()=>{this.dc.closed=true;}};return this.dc;}
  async createOffer(){events.push('offer');return {type:'offer',sdp:'no microphone'};}
  async setLocalDescription(){}
  async setRemoteDescription(){this.connectionState='connected';this.ontrack({streams:[{}]});this.dc.onopen();if(ack)this.dc.onmessage({data:JSON.stringify({type:'session.created'})});}
  close(){this.connectionState='closed';events.push('close');}
 }
 const ctx={window:{},performance:{now:()=>clock},Audio,RTCPeerConnection:PC,AbortController,DOMException,Promise,JSON,
  setTimeout:(fn,ms)=>timer(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>timer(fn,ms,true),clearInterval:id=>timers.delete(id),
  navigator:{mediaDevices:{getUserMedia:()=>{events.push('microphone');const track={stopped:false,stop(){this.stopped=true;}};const mic={getTracks:()=>[track],getAudioTracks:()=>[track]};microphones.push(mic);return micGate?micGate.promise.then(()=>mic):Promise.resolve(mic);}}},
  fetch:async(url,options)=>{requests.push({url,options});if(answerGate)await answerGate.promise;return {ok:true,text:async()=> 'answer'};}};
 runInNewContext(code,ctx);
 const manager=ctx.window.MayaVoicePreparation.create({scope:()=>scope,token:async signal=>{events.push('token');if(tokenGate)await tokenGate.promise;if(tokenError)throw tokenError;return {value:'ephemeral-fixture',model:'fixture-model'};},
  onActive:s=>{s.dc.send(JSON.stringify({type:'conversation.item.create',scope}));s.dc.send(JSON.stringify({type:'response.create'}));},onMessage:(event,s)=>events.push('message'),onStop:reason=>stops.push(reason),onPlaybackBlocked:()=>events.push('playback-blocked')});
 return {manager,events,requests,microphones,connections,stops,setScope:value=>scope=value,setMicGate:g=>micGate=g,setTokenGate:g=>tokenGate=g,setAnswerGate:g=>answerGate=g,setAttachGate:g=>attachGate=g,setTokenError:e=>tokenError=e,setBlocked:v=>blocked=v,setAck:v=>ack=v,
  async advance(ms){const target=clock+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const[id,t]=next;clock=t.at;if(t.repeat)t.at+=t.ms;else timers.delete(id);t.fn();await flush();}clock=target;await flush();}};
}
{
 const h=harness(),s=await h.manager.prepare();await h.manager.prepare();
 assert.equal(h.connections.length,1);assert.equal(h.requests.length,1);assert.equal(h.microphones.length,0);assert.equal(s.sender.track,null);assert.deepEqual(s.dc.sent,[]);assert.ok(!h.events.includes('play'));
 s.dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done'})});assert.ok(!h.events.includes('message'),'silent standby ignores unexpected model tools');
 await h.advance(5000);const live=await h.manager.start();assert.equal(live,s);assert.equal(h.requests.length,1,'warm wake performs no new token/SDP network call');assert.equal(live.sender.track,h.microphones[0].getAudioTracks()[0]);assert.ok(live.active);assert.equal(live.dc.sent.length,2,'fresh context and response only on activation');
 live.dc.onmessage({data:JSON.stringify({type:'output_audio_buffer.started'})});const metric=h.manager.metrics.find(v=>v.name==='first-audio');assert.equal(metric.sinceWakeMs,0);assert.equal(metric.ms,5000,'timings distinguish preparation time from wake time; fake timing is not live latency');
 h.setScope('owner-A/project-B');await h.advance(250);assert.equal(h.manager.current,null);assert.equal(h.microphones[0].getTracks()[0].stopped,true);assert.equal(s.dc.closed,true);
}
{
 const h=harness();await h.manager.prepare();await h.advance(120000);assert.equal(h.manager.current,null);assert.ok(h.stops.includes('standby-expired'));await h.advance(600000);assert.equal(h.requests.length,1,'expiry does not renew a paid session');
}
{
 const h=harness();h.setAck(false);const prepared=h.manager.prepare();await flush();assert.ok(!h.manager.metrics.some(v=>v.name==='connection-ready'),'open transport alone is not a ready server session');
 const starting=h.manager.start();await flush();assert.equal(h.connections[0].sender.track,null);assert.equal(h.connections[0].dc.sent.length,0);
 h.connections[0].dc.onmessage({data:JSON.stringify({type:'session.created'})});await prepared;await starting;assert.ok(h.manager.current.active);h.manager.stop();
}
for(const boundary of ['token','answer','microphone','attach']){
 const h=harness(),gate=deferred();if(boundary==='token')h.setTokenGate(gate);if(boundary==='answer')h.setAnswerGate(gate);if(boundary==='microphone')h.setMicGate(gate);if(boundary==='attach')h.setAttachGate(gate);
 const pending=h.manager.start().catch(e=>e);await flush();assert.ok(h.events.indexOf('microphone')<h.events.indexOf('token'),'cold start requests capture without a network wait');
 h.manager.stop('off');gate.resolve();const value=await pending;assert.equal(value.name,'AbortError');assert.equal(h.manager.current,null);assert.ok(h.microphones.every(m=>m.getTracks()[0].stopped));assert.ok(h.connections.every(p=>p.connectionState==='closed'));if(boundary!=='attach')assert.ok(h.connections.every(p=>p.dc.sent.length===0));
}
{
 const h=harness();h.setBlocked(true);const s=await h.manager.start();await flush();assert.equal(s.playbackBlocked,true);assert.ok(h.events.includes('playback-blocked'));h.setBlocked(false);assert.equal(await h.manager.resumePlayback(),true);assert.equal(s.playbackBlocked,false);
 h.setScope('owner-A/project-A');h.manager.checkScope();assert.equal(h.manager.current,s,'same scoped owner keeps the line');h.setScope('owner-B/project-A');h.manager.checkScope();assert.equal(h.manager.current,null);
}
{
 const h=harness();await h.manager.start();await h.advance(120000);assert.ok(h.stops.includes('idle'));assert.equal(h.manager.current,null);
}
{
 const h=harness(),gate=deferred();h.setAnswerGate(gate);const pending=h.manager.prepare().catch(e=>e);await flush();await h.advance(20000);assert.equal(h.manager.current,null);assert.ok(h.stops.includes('setup-timeout'));gate.resolve();assert.equal((await pending).name,'AbortError');
}
{
 const h=harness();h.setTokenError(Error('voice_credit'));const error=await h.manager.start().catch(e=>e);
 assert.equal(error.message,'voice_credit','provider failures are not masked by cancellation');assert.equal(h.manager.current,null);
}
{
 const h=harness(),gate=deferred();await h.manager.prepare();h.setAttachGate(gate);const first=h.manager.start();await flush();assert.equal(h.manager.current.active,true,'fixture reaches attachment');
 let secondSettled=false;const second=h.manager.start().then(value=>{secondSettled=true;return value;});await flush();
 assert.equal(secondSettled,false,'a second start waits until the first microphone attachment finishes');
 gate.resolve();assert.equal(await first,await second);h.manager.stop();
}
{
 const h=harness(),gate=deferred();await h.manager.prepare();h.setAttachGate(gate);
 const first=h.manager.start().catch(e=>e);await flush();assert.equal(h.manager.current.active,true);
 const second=h.manager.start().catch(e=>e);h.manager.stop('off');
 assert.equal((await first).name,'AbortError');assert.equal((await second).name,'AbortError');
 gate.resolve();await flush();assert.ok(h.microphones.every(m=>m.getTracks()[0].stopped));
}
for(const boundary of ['token','answer','microphone','attach']){
 const h=harness(),gate=deferred();if(boundary==='token')h.setTokenGate(gate);if(boundary==='answer')h.setAnswerGate(gate);if(boundary==='microphone')h.setMicGate(gate);if(boundary==='attach')h.setAttachGate(gate);
 let settled=false,result;const pending=h.manager.start().catch(e=>e).then(e=>{settled=true;result=e;});
 await flush();await h.advance(20000);
 assert.equal(settled,true,`${boundary} startup must settle at the deadline even if its operation ignores abort`);
 assert.equal(result.name,'AbortError');assert.equal(h.manager.current,null);
 gate.resolve();await pending;await flush();assert.ok(h.microphones.every(m=>m.getTracks()[0].stopped),'late microphone is released');
}
console.log('Voice preparation: no microphone/output before wake, warm reuse, immediate cold capture, bounded idle/setup, scoped cancellation, late mic cleanup, playback recovery and honest timing events passed.');

};

checks['realtime-voice']=async function(){
// Pure fake-provider and extracted production-route tests. No keys or sockets.
const {default:assert}=await import('node:assert/strict');
const {readFile}=await import('node:fs/promises');
const {default:vm}=await import('node:vm');
const {createVoiceSecret,webVoiceSession,voiceTurnDetection,VOICE_DELIVERY}=await import('../backend/server/realtime-voice.mjs');
const {buildAdminCommandSnapshot,buildRealtimeCommandContext,withinVoiceBudget}=await import('../backend/server/admin-command.mjs');

let passed=0;
async function test(name,run){await run();passed++;console.log('ok realtime-voice: '+name);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const expiry=()=>Math.floor(Date.now()/1000)+120;
const session=webVoiceSession({model:'gpt-realtime-2.1-mini',voice:'marin',instructions:'Keep account A separate.',tools:[{name:'reviewed_action'}]});

await test('shared session keeps configured model, voice, tools and account instructions',async()=>{
 assert.equal(session.model,'gpt-realtime-2.1-mini');assert.equal(session.audio.output.voice,'marin');
 assert.equal(session.audio.output.speed,1.05);assert.equal(session.tools[0].name,'reviewed_action');
 assert.ok(session.instructions.startsWith('Keep account A separate.'));assert.ok(session.instructions.endsWith(VOICE_DELIVERY));
 assert.deepEqual(session.audio.input.turn_detection,{type:'server_vad',silence_duration_ms:300,prefix_padding_ms:250,create_response:true,interrupt_response:true});
 assert.equal(voiceTurnDetection(10).silence_duration_ms,250);assert.equal(voiceTurnDetection(10000).silence_duration_ms,1500);
});
await test('mint requests a short-lived secret and returns the provider expiry without persisting it',async()=>{
 const expires_at=expiry(),timings=[];let body;
 const result=await createVoiceSecret({apiKey:'fixture-only',session,onTiming:x=>timings.push(x),fetchImpl:async(_url,request)=>{
   body=JSON.parse(request.body);assert.equal(request.headers.Authorization,'Bearer fixture-only');return reply(200,{value:'ephemeral-fixture',expires_at});
 }});
 assert.deepEqual(body.expires_after,{anchor:'created_at',seconds:120});assert.deepEqual(result,{value:'ephemeral-fixture',expires_at});
 assert.equal(timings.length,1);assert.equal(timings[0].attempts,1);assert.equal(Object.keys(timings[0]).sort().join(','),'attempts,ms');
});
for(const [status,code,expected] of [[401,'','realtime_auth'],[403,'','realtime_auth'],[429,'rate_limit_exceeded','realtime_rate_limited'],[429,'insufficient_quota','insufficient_quota'],[503,'','realtime_provider_unavailable'],[400,'invalid_model','realtime_request_rejected']]){
 await test(status+' '+(code||'provider error')+' is not retried',async()=>{
   let calls=0;await assert.rejects(createVoiceSecret({apiKey:'fixture-only',session,fetchImpl:async()=>{calls++;return reply(status,{error:{code,param:'model'}});}}),new RegExp(expected));assert.equal(calls,1);
 });
}
await test('only optional input rejection retries while preserving authorization and turn settings',async()=>{
 const bodies=[];
 await createVoiceSecret({apiKey:'fixture-only',session,fetchImpl:async(_url,request)=>{
   bodies.push(JSON.parse(request.body));return bodies.length===1?reply(400,{error:{param:'session.audio.input.noise_reduction.type'}}):reply(200,{value:'retry-secret',expires_at:expiry()});
 }});
 assert.equal(bodies.length,2);assert.equal(bodies[1].session.audio.input.noise_reduction,undefined);
 assert.equal(bodies[1].session.audio.input.transcription.model,'whisper-1');
 for(const key of ['instructions','tools','model'])assert.deepEqual(bodies[1].session[key],bodies[0].session[key]);
 assert.deepEqual(bodies[1].session.audio.output,bodies[0].session.audio.output);
 assert.deepEqual(bodies[1].session.audio.input.turn_detection,bodies[0].session.audio.input.turn_detection);
 assert.equal(session.audio.input.noise_reduction.type,'far_field');
});
await test('compatibility retry shares the original deadline; late body rejection is handled',async()=>{
 let calls=0,lastSignal;const unhandled=[];const onUnhandled=e=>unhandled.push(e);process.on('unhandledRejection',onUnhandled);
 try{
   const started=Date.now();
   await assert.rejects(createVoiceSecret({apiKey:'fixture-only',session,timeoutMs:60,fetchImpl:async(_url,{signal})=>{
     calls++;lastSignal=signal;
     if(calls===1){await sleep(30);return reply(400,{error:{param:'audio.input.transcription'}});}
     return {ok:true,status:200,json:async()=>{await sleep(100);throw new Error('late body failure');}};
   }}),/realtime_timeout/);
   assert.equal(calls,2);assert.equal(lastSignal.aborted,true);assert.ok(Date.now()-started<100);
   await sleep(120);assert.equal(calls,2);assert.equal(unhandled.length,0);
 }finally{process.off('unhandledRejection',onUnhandled);}
});
await test('a stalled initial request cannot start a compatibility retry after timeout',async()=>{
 let calls=0,release;const pending=new Promise(r=>{release=r;});
 await assert.rejects(createVoiceSecret({apiKey:'fixture-only',session,timeoutMs:20,fetchImpl:async()=>{calls++;await pending;return reply(400,{error:{param:'audio.input.transcription'}});}}),/realtime_timeout/);
 release();await sleep(10);assert.equal(calls,1);
});
await test('expired or malformed success never becomes a client token',async()=>{
 for(const data of [{value:'secret'},{value:'secret',expires_at:1},{expires_at:expiry()}])await assert.rejects(createVoiceSecret({apiKey:'fixture-only',session,fetchImpl:async()=>reply(200,data)}),/realtime_invalid_secret/);
});

// Run the actual registered handlers with their real session builder. Fixtures
// inject every dependency and process.env, so no local credentials are accessed.
const source=await readFile(new URL('../backend/server/server.js',import.meta.url),'utf8');
function route(path,overrides={}){
 const start=source.indexOf("app.post('"+path+"'");assert.ok(start>=0);
 const end=source.indexOf('\n});',start)+4;assert.ok(end>start);
 const minted=[],spent=[],contexts=[];let handler;
 const user={sub:'account-a',email:'owner@fixture.invalid'};
 const scope={
   app:{post:(_path,...middleware)=>{handler=middleware.at(-1);}},requireAuthHeader:()=>{},express:{json:()=>()=>{}},
   requireAdmin:async()=>user,requireGoogleUser:async()=>user,rateLimit:()=>({ok:true}),
   process:{env:{OPENAI_API_KEY:'fixture-only'}},REALTIME_MODEL:'gpt-realtime-2.1-mini',MAYA_CHARACTER:'Fixture character',
   ADMIN_EMAILS:[],USER_TRIAL_USD:1,userSpendTotal:async()=>({usd:0}),noteSpend:()=>spent.push('global'),noteUserSpend:async()=>spent.push('account'),
   buildAdminCommandSnapshot,buildRealtimeCommandContext,withinVoiceBudget,loadAdminCommandSnapshot:async()=>buildAdminCommandSnapshot(),
   ownerConversation:{context:async uid=>{contexts.push(uid);return {memory:[],behavior:[],alertTemplate:'New lead'};}},
   loadMayaPeople:async()=>({items:[]}),loadMayaSoul:async()=>'',webVoiceSession,
   createVoiceSecret:async options=>{minted.push(options);return {value:'fixture-secret',expires_at:expiry()};},
   console:{log:()=>{},error:()=>{}},...overrides,
 };
 vm.runInNewContext(source.slice(start,end),scope);
 return {minted,spent,contexts,run:async(body={})=>{const response={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;},setHeader(){}};await handler({body},response);return response;}};
}
await test('both production token routes preserve expiry and shared delivery settings',async()=>{
 for(const path of ['/api/admin/voice-token','/api/voice-token']){
   const fixture=route(path),response=await fixture.run({name:'Client A',board:[{title:'Only A'}]});
   assert.equal(response.statusCode,200);assert.equal(response.data.value,'fixture-secret');assert.ok(response.data.expires_at>Date.now()/1000);
   assert.equal(response.data.model,'gpt-realtime-2.1-mini');assert.equal(fixture.minted.length,1);
   assert.deepEqual(fixture.minted[0].session.audio,session.audio);assert.ok(fixture.minted[0].session.instructions.endsWith(VOICE_DELIVERY));
   if(path.includes('/admin/'))assert.deepEqual(fixture.contexts,['account-a']);
   else {assert.ok(fixture.minted[0].session.instructions.includes('Only A'));assert.deepEqual(fixture.spent,['global','account']);}
 }
});
await test('auth, rate and trial gates prevent minting',async()=>{
 for(const [overrides,expected] of [
   [{requireGoogleUser:async()=>{throw new Error('unauthorized');}},401],
   [{rateLimit:()=>({ok:false,retry:5})},429],
   [{userSpendTotal:async()=>({usd:1})},402],
 ]){const fixture=route('/api/voice-token',overrides),response=await fixture.run();assert.equal(response.statusCode,expected);assert.equal(fixture.minted.length,0);assert.equal(fixture.spent.length,0);}
 const admin=route('/api/admin/voice-token',{requireAdmin:async()=>{throw new Error('unauthorized');}});assert.equal((await admin.run()).statusCode,401);assert.equal(admin.minted.length,0);
});
await test('slow optional Admin sources run concurrently and cannot delay token mint beyond their 400ms context budget',async()=>{
 const requested=[];const stall=name=>{requested.push(name);return new Promise(()=>{});};
 const fixture=route('/api/admin/voice-token',{loadAdminCommandSnapshot:()=>stall('dashboard'),ownerConversation:{context:()=>stall('memory')},loadMayaPeople:()=>stall('people'),loadMayaSoul:()=>stall('soul')});
 const started=Date.now(),pending=fixture.run();await sleep(20);assert.deepEqual(requested.sort(),['dashboard','memory','people','soul']);
 const response=await pending,elapsed=Date.now()-started;assert.equal(response.statusCode,200);assert.ok(elapsed>=350&&elapsed<1000,'context elapsed '+elapsed);
 assert.match(fixture.minted[0].session.instructions,/Owner memory is temporarily unavailable/);
 console.log('fake Admin optional-context startup_ms '+elapsed+'; provider, authentication and spend-ledger latency excluded');
});
console.log('realtime-voice: '+passed+' checks passed; no production audio or latency claim.');

};

checks['fabrics']=async function(){
const {createFabricSearch,normalizeFabricRequest,fabricSearchBody,sourceURL,mountFabricSearch,fabricCSV}=await import('../backend/server/fabrics.mjs');
const user={sub:'owner-A'},second={sub:'owner-B'},image='data:image/png;base64,aW1hZ2U=',url='https://cloth.example/product/red',other='https://cloth.example/product/other';
let count=0;const test=async(name,run)=>{await run();count++;console.log('  ok '+name);};
const entry=(i=0,extra={})=>({type:'image_result',source_website_url:'https://cloth.example/product/'+i,image_url:'https://photo.example/'+i+'.jpg',thumbnail_url:'https://photo.example/'+i+'-thumb.jpg',caption:'Red apparel fabric',...extra});
const item=results=>({type:'web_search_call',status:'completed',results});
const done=output=>({type:'response.completed',response:{status:'completed',output}});
const wire=events=>events.map(event=>'data: '+JSON.stringify(event)+'\r\n\r\n').join('');
const response=results=>new Response(wire([done([item(results)])]),{headers:{'Content-Type':'text/event-stream'}});
function store(){
 const records=new Map(['project-A','project-B'].map(id=>['submissions/'+id+'/submission.json',{buf:Buffer.from('{}'),generation:'1'}]));
 return {records,read:async key=>records.has(key)?{ok:true,...records.get(key)}:{ok:false,status:404},write:async(key,buf,type,generation)=>{assert.equal(type,'application/json');if(String(records.get(key)?.generation||'0')!==generation)throw Object.assign(Error('conflict'),{status:412});records.set(key,{buf,generation:String(Number(generation)+1)});}};
}
const put=(s,key,data)=>s.records.set(key,{buf:Buffer.from(JSON.stringify(data)),generation:'1'});
const create=(options={})=>createFabricSearch({apiKey:()=> 'fixture',fetchImpl:async()=>response([entry()]),...options});
await test('studio favorites persist across admins, garments and submission deletion without leaking client metadata',async()=>{
 const s=store(),service=create(s),product={url,title:'Red wool',image:'https://photo.example/red.jpg',garment:'PRIVATE CLIENT COAT',garmentId:'coat',description:'PRIVATE REQUEST'};
 let book=await service.loadFavorites(user);assert.equal(book.generation,'0');
 book=await service.saveFavorite(user,{generation:book.generation,action:'save',product});
 assert.deepEqual(await service.loadFavorites(second),book);assert.doesNotMatch(JSON.stringify(book),/PRIVATE|garmentId/);
 s.records.delete('submissions/project-A/submission.json');put(s,'deleted-submissions/project-A.json',{deleted:true});
 assert.equal((await service.loadFavorites(second)).items[0].url,url,'Deleting a client does not delete studio bookmarks');
 await assert.rejects(service.saveFavorite(second,{generation:'0',action:'remove',product}),e=>e.status===409);
 book=await service.saveFavorite(second,{generation:book.generation,action:'save',product:{url:'/aesthetics/fabrics/Midnight%20Velvet.JPG',title:'Midnight Velvet'}});
 assert.equal(book.items.length,2);assert.equal(book.items[0].evidence,'atelier_inventory');
 book=await service.saveFavorite(user,{generation:book.generation,action:'remove',product});assert.equal(book.items.length,1);
 await assert.rejects(service.loadFavorites({}),e=>e.status===401);
 await assert.rejects(service.saveFavorite(user,{generation:book.generation,action:'save',product:{url:'javascript:alert(1)'}}));
 let writes=0;const broken=create({read:async()=>({ok:false,status:503}),write:async()=>writes++});
 await assert.rejects(broken.saveFavorite(user,{generation:'0',action:'save',product}),e=>e.status===503);assert.equal(writes,0);
 const corrupt=create({read:async()=>({ok:true,buf:Buffer.from('{'),generation:'1'}),write:async()=>writes++});
 await assert.rejects(corrupt.saveFavorite(user,{generation:'1',action:'save',product}),e=>e.status===503);assert.equal(writes,0);
 const raceStore=store(),race=create(raceStore);
 const outcomes=await Promise.allSettled([race.saveFavorite(user,{generation:'0',action:'save',product}),race.saveFavorite(second,{generation:'0',action:'save',product:{url:other,title:'Other'}})]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);assert.equal((await race.loadFavorites(user)).items.length,1);
});
await test('one direct OpenAI request returns up to ten source-linked photos without a second engine',async()=>{
 let calls=0;const events=[];
 const service=create({fetchImpl:async(target,options)=>{
  calls++;assert.equal(target,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
  assert.equal(body.max_tool_calls,1);assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.max_output_tokens,4096);
  assert.deepEqual(body.include,['web_search_call.results']);assert.deepEqual(body.tools[0].search_content_types,['image','text']);assert.equal(body.tools[0].image_settings.max_results,10);assert.equal(body.tools[0].filters,undefined);
  assert.equal(body.input[0].content[1].image_url,image);
  return new Response(wire([done([{type:'message',content:[{type:'output_text',text:'{"image_url":"https://invented.example/a.jpg","url":"https://invented.example"}'}]},item([entry(0),entry(0),entry(1,{caption:''}),...Array.from({length:14},(_,i)=>entry(i+2))])])]));
 }});
 await service.search(user,{request:'red fabric',image,stores:['ignored.example']},event=>events.push(event));
 assert.equal(calls,1);assert.equal(events.at(-1).products.length,10);assert.equal(events.at(-1).type,'done');
 const products=events.at(-1).products;assert.equal(products[1].title,'Fabric suggestion');assert.ok(products.every(p=>p.price===''&&p.composition===''&&p.availability==='unknown'&&p.imageCandidates.length===2));assert.doesNotMatch(JSON.stringify(products),/invented/);
 const scoped=fabricSearchBody(normalizeFabricRequest({request:'wool',mode:'retailers',stores:['moodfabrics.com']}));assert.deepEqual(scoped.tools[0].filters.allowed_domains,['moodfabrics.com']);
 for(const stores of [[],['bad host'],['moodfabrics.com','bad host']])assert.throws(()=>normalizeFabricRequest({request:'wool',mode:'retailers',stores}));
});
await test('source links reject unsafe addresses and never invent photographs from text',async()=>{
 for(const value of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://x.internal','https://[::1]','https://example.com:123'])assert.equal(sourceURL(value),'');
 const events=[];await create({fetchImpl:async()=>response([entry(0,{image_url:'javascript:1',thumbnail_url:''}),entry(1,{source_website_url:'https://127.0.0.1'}),entry(2,{image_url:'',thumbnail_url:'https://photos.example/2.jpg'})])}).search(user,{request:'fabric'},e=>events.push(e));
 assert.equal(events.at(-1).products.length,2);assert.equal(events.at(-1).products[0].image,'');assert.equal(events.at(-1).products[1].image,'https://photos.example/2.jpg');
});
await test('source-cited metadata enriches CSV columns without creating unsourced URLs',async()=>{
 const events=[];await create({fetchImpl:async()=>new Response(wire([done([item([entry()]),{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{url:entry().source_website_url,fabricType:'Cotton twill',relevance:'Similar body cloth',price:'12.50',currency:'USD',unit:'yard',delivery:'Ships in 3 days'},{url:'https://invented.example/cloth',price:'1.00',currency:'USD',unit:'yard'}]})}]}])]))}).search(user,{request:'red fabric'},event=>events.push(event));
 const rows=events.at(-1).products;assert.equal(rows.length,1);assert.equal(rows[0].price,'12.50');assert.equal(rows[0].unit,'yard');assert.match(fabricCSV(rows),/Ships in 3 days/);assert.doesNotMatch(fabricCSV(rows),/invented/);
});
await test('photos stream before completion; later explicit exclusions retract even on failure',async()=>{
 let controller;const events=[],service=create({fetchImpl:async()=>new Response(new ReadableStream({start(c){controller=c;}}))});
 const pending=service.search(user,{request:'red fabric',preferences:'no polyester'},e=>events.push(e));
 while(!controller)await new Promise(r=>setImmediate(r));
 const send=e=>controller.enqueue(new TextEncoder().encode(wire([e])));
 send({type:'response.output_item.done',item:item([entry()])});
 while(!events.some(e=>e.type==='products'))await new Promise(r=>setImmediate(r));
 assert.equal(events.some(e=>e.type==='done'),false);
 send({type:'response.output_item.done',item:item([entry(0,{caption:'Red polyester apparel fabric'})])});
 send({type:'response.failed'});await assert.rejects(pending,/stopped/);
 assert.deepEqual(events.at(-1).products,[]);assert.deepEqual(events.at(-1).removedUrls,[entry().source_website_url]);assert.equal(events.some(e=>e.type==='done'),false);
});
await test('terminal incomplete output retains sourced photos without declaring success',async()=>{
 const events=[];
 await assert.rejects(create({fetchImpl:async()=>new Response(wire([{type:'response.incomplete',response:{output:[item([entry()])],incomplete_details:{reason:'max_output_tokens'}}}]))}).search(user,{request:'fabric'},e=>events.push(e)),/stopped/);
 assert.equal(events.at(-1).type,'products');assert.equal(events.at(-1).products.length,1);assert.equal(events.some(e=>e.type==='done'),false);
});
await test('SSE handles Unicode split across every byte and truncated streams fail',async()=>{
 const data=new TextEncoder().encode(wire([done([item([entry(0,{caption:'Rouge café fabric'})])])]));
 const events=[];await create({fetchImpl:async()=>new Response(new ReadableStream({start(c){for(const byte of data)c.enqueue(Uint8Array.of(byte));c.close();}}))}).search(user,{request:'fabric'},e=>events.push(e));assert.equal(events.at(-1).products[0].title,'Rouge café fabric');
 const partial=[];await assert.rejects(create({fetchImpl:async()=>new Response(wire([{type:'response.output_item.done',item:item([entry()])}]))}).search(user,{request:'fabric'},e=>partial.push(e)),/stopped/);assert.equal(partial.at(-1).products.length,1);assert.equal(partial.some(e=>e.type==='done'),false);
});
await test('canonical saved garment and preferences replace browser guesses without sending contact data',async()=>{
 const s=store();let body,calls=0;const service=create({...s,fetchImpl:async(_url,options)=>{calls++;body=JSON.parse(options.body);return response([entry()]);}});
 await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true},()=>{}),e=>e.status===409);
 put(s,'submissions/project-A/summary.json',{fabric_preferences:'no polyester',client:{name:'PRIVATE CONTACT'}});
 put(s,'submissions/project-A/pieces.json',{pieces:[{id:'coat',name:'Coat',fabric:'Red wool',_image:image},{id:'boots',name:'Boots',category:'footwear'}]});
 await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat',fabric:'FORGED'},preferences:'FORGED'},()=>{});
 assert.equal(calls,1);assert.equal(body.input[0].content[1].image_url,image);const context=JSON.parse(body.input[0].content[0].text);assert.equal(context.selectedGarment.fabric,'Red wool');assert.equal(context.clientFabricPreferences,'no polyester');assert.doesNotMatch(JSON.stringify(body),/FORGED|PRIVATE CONTACT/);
 await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'unknown'}},()=>{}),e=>e.status===409);
 put(s,'submissions/project-A/pieces.json',{pieces:[{id:'a',name:'Coat'},{id:'b',name:'Coat'}]});await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Coat'}},()=>{}),e=>e.status===409);
 s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{'),generation:'2'});await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true},()=>{}),e=>e.status===503);assert.equal(calls,1);
});
await test('lookbooks are private bookmarks with generation and garment checks, no seller fetch',async()=>{
 const s=store();put(s,'submissions/project-A/pieces.json',{pieces:[{id:'coat',name:'Coat',fabric:'wool'},{id:'pants',name:'Pants',fabric:'cotton'}]});
 const service=create({...s,fetchImpl:async()=>{throw Error('Saving must not search or fetch a seller');}}),product={url,title:'Red cloth',image:'https://photos.example/red.jpg',price:'0.01',composition:'Invented',availability:'in_stock'};
 let book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:'coat',product});
 assert.equal(book.items[0].price,'');assert.equal(book.items[0].composition,'');assert.equal(book.items[0].availability,'unknown');assert.deepEqual(book.selectedByGarment,{coat:url});
 assert.equal((await service.loadBook(second,'project-A')).items.length,0);assert.equal((await service.loadBook(user,'project-B')).items.length,0);
 await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'0',action:'save',product}),e=>e.status===409);
 await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'unknown',product}),e=>e.status===409);
 book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'pants',product});assert.deepEqual(book.selectedByGarment,{coat:url,pants:url});
 book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'remove',product});assert.deepEqual(book.selectedByGarment,{});assert.equal(book.items.length,0);
 const results=await Promise.allSettled([1,2].map(()=>service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
await test('deadlines and parent cancellation settle even when fetch or body ignores abort',async()=>{
 const keepAlive=setInterval(()=>{},1000);
 try{
  let signal;const service=create({timeoutMs:35,fetchImpl:async(_url,options)=>{signal=options.signal;return new Promise(()=>{});}});
  await assert.rejects(service.search(user,{request:'fabric'},()=>{}),e=>e.name==='TimeoutError');assert.equal(signal.aborted,true);
  const parent=new AbortController(),events=[];let release;
  const pending=create({fetchImpl:async()=>new Promise(r=>release=r)}).search(user,{request:'fabric'},e=>events.push(e),parent.signal);
  parent.abort();await assert.rejects(pending,e=>e.name==='AbortError');const before=events.length;release(response([entry()]));await new Promise(r=>setImmediate(r));assert.equal(events.length,before);
  let cancelled=0;await assert.rejects(create({timeoutMs:35,fetchImpl:async()=>({ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled++;return new Promise(()=>{});}})}})}).search(user,{request:'fabric'},()=>{}),e=>e.name==='TimeoutError');assert.ok(cancelled>0);
  let resolveRead,calls=0;const s=store();const late=create({...s,timeoutMs:35,read:async key=>{await new Promise(r=>resolveRead=r);return s.read(key);},fetchImpl:async()=>{calls++;return response([]);}});
  await assert.rejects(late.search(user,{request:'fabric',submissionId:'project-A'},()=>{}),e=>e.name==='TimeoutError');resolveRead();await new Promise(r=>setImmediate(r));assert.equal(calls,0);
 }finally{clearInterval(keepAlive);}
});
await test('provider failures stay brief and never trigger retries or reveal provider messages',async()=>{
 let calls=0;await assert.rejects(create({fetchImpl:async()=>{calls++;return new Response('private provider detail',{status:429});}}).search(user,{request:'fabric'},()=>{}),e=>e.status===502&&!e.message.includes('private'));assert.equal(calls,1);
 await assert.rejects(create({apiKey:()=>''}).search(user,{request:'fabric'},()=>{}),e=>e.status===503);
});
await test('all routes authenticate before IO and search is rate limited',async()=>{
 for(const denied of [true,false]){
  const routes=[];let reads=0,code;mountFabricSearch({post:(...a)=>routes.push(a),get:(...a)=>routes.push(a)},{requireAdmin:async()=>{if(denied)throw Object.assign(Error('denied'),{status:403});return user;},requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:false}),read:async()=>{reads++;},write:async()=>{}});
  const res={on(){},status(n){code=n;return this;},json(){},set(){return this;}};
  for(const route of denied?routes:routes.slice(0,1)){await route.at(-1)({body:{request:'fabric'},query:{}},res);assert.equal(code,denied?403:429);}assert.equal(reads,0);
 }
});
await test('a stalled streamed search terminates before the browser deadline and cannot publish late products',async()=>{
  const nativeTimeout=AbortSignal.timeout,routes=[],events=[];let release,lateSignal;
  const app={post:(...args)=>routes.push(args),get(){}};
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===55000?40:ms);
  const keepAlive=setInterval(()=>{},1000);
  try{
    mountFabricSearch(app,{...store(),requireAdmin:async()=>user,requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[]}}});
      assert.ok(target.includes('openai.com'));lateSignal=options.signal;
      return new Promise(resolve=>{release=()=>resolve(response([entry()]));});
    }});
    let ended=false,code;
    const res={on(){},set(){return this;},flushHeaders(){this.headersSent=true;},write(raw){events.push(JSON.parse(raw));},end(raw){if(raw)events.push(JSON.parse(raw));ended=true;},status(n){code=n;return this;},json(value){events.push(value);ended=true;}};
    await routes[0].at(-1)({body:{request:'crimson wool'},query:{}},res);
    assert.equal(ended,true);assert.equal(code,undefined,'Already-streamed failures use a terminal error event');
    assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/timed out/);assert.equal(lateSignal.aborted,true);
    const finalCount=events.length;release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(events.length,finalCount,'Late provider completion cannot append after terminal timeout');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('a late private storage read cannot launch providers after the route deadline',async()=>{
  const nativeTimeout=AbortSignal.timeout,routes=[];let release,providers=0;
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===55000?40:ms);
  const keepAlive=setInterval(()=>{},1000);
  try{
    const storage=store();mountFabricSearch({post:(...args)=>routes.push(args),get(){}},{...storage,read:async key=>{if(key.endsWith('/submission.json'))await new Promise(resolve=>release=resolve);return storage.read(key);},requireAdmin:async()=>user,requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),apiKey:()=> 'fake',fetchImpl:async()=>{providers++;throw Error('Late provider request');}});
    let error,code;const res={on(){},status(value){code=value;return this;},json(value){error=value.error;}};
    await routes[0].at(-1)({body:{submissionId:'project-A',request:'crimson wool'}},res);
    assert.equal(code,503);assert.match(error,/timed out/);release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(providers,0);
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
// Existing private-store compatibility checks continue below.
await test('legacy lookbook reads only infer unambiguous garment selections and never write migrations',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';let writes=0;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Coat',fabric:'wool'},{name:'Shirt',fabric:'cotton'},{name:'Shirt',fabric:'linen'}]})),generation:'1'});
  const service=createFabricSearch({...s,write:async()=>{writes++;}}),product={url,title:'Crimson wool twill'};
  for(const [attribution,expected]of [[{garment:'Coat'},{'saved-piece-0':url}],[{garment:'Shirt'},{}],[{},{}],[{garmentId:'saved-piece-2',garment:'Shirt'},{}],[{garmentId:'saved-piece-0',garment:'Coat'},{'saved-piece-0':url}],[{garmentId:'saved-piece-0',garment:'Old jacket'},{}],[{garmentId:'saved-piece-0'},{}]]){
    s.records.set(key,{buf:Buffer.from(JSON.stringify({items:[{...product,...attribution}],selectedUrl:url})),generation:'7'});
    assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,expected);
    if(attribution.garmentId){
      const raw=JSON.stringify({items:[{...product,...attribution}],selectedUrl:url,selectedByGarment:{[attribution.garmentId]:url}});s.records.set(key,{buf:Buffer.from(raw),generation:'7'});
      assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,expected);assert.equal(s.records.get(key).buf.toString(),raw,'Legacy maps obey the same identity evidence without migration writes');
    }
  }
  assert.equal(writes,0);
  for(const selectedByGarment of [null,[],{'bad id':url},{'saved-piece-0':other},{'saved-piece-0':null}]){
    s.records.set(key,{buf:Buffer.from(JSON.stringify({items:[product],selectedUrl:url,selectedByGarment})),generation:'7'});
    await assert.rejects(service.loadBook(user,'project-A'),e=>e.status===503);
    await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'7',action:'remove',product:{url}}),e=>e.status===503);
  }
  assert.equal(writes,0,'Malformed selection storage must not be silently replaced');
});
await test('redissection hides only orphan selections and prunes them on an explicit CAS mutation',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',pieceKey='submissions/project-A/pieces.json',product={...{url,title:'Crimson wool twill'},garment:'Coat',garmentId:'kept'};
  s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces:[{id:'kept',name:'Coat',fabric:'wool'}]})),generation:'2'});
  const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{kept:url,removed:url}});
  s.records.set(key,{buf:Buffer.from(raw),generation:'4'});
  const service=createFabricSearch({...s,fetchImpl:async()=>{throw Error('Stored selections do not need retailer access');}});
  const book=await service.loadBook(user,'project-A');assert.deepEqual(book.selectedByGarment,{kept:url});assert.equal(book.items.length,1);assert.equal(s.records.get(key).buf.toString(),raw,'Read does not write a migration');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'3',action:'select',garmentId:'kept',product:{url}}),e=>e.status===409);assert.equal(s.records.get(key).buf.toString(),raw);
  const updated=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'kept',product:{url}});
  assert.deepEqual(updated.selectedByGarment,{kept:url});assert.deepEqual(JSON.parse(s.records.get('submissions/project-A/fabrics/owner-A/lookbook.json').buf).selectedByGarment,{kept:url});
});
await test('selection fingerprints reject reused IDs but preserve stable garments through reorder and production work',async()=>{
  const s=store(),key='submissions/project-A/fabrics/owner-A/lookbook.json',pieceKey='submissions/project-A/pieces.json';
  const coat={id:'saved-piece-0',name:'Coat',fabric:'Crimson wool',fabric_spec:{fiber:'wool',weave:'twill'}},pants={id:'pants',name:'Pants',fabric:'cotton'};
  const writePieces=pieces=>s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  writePieces([coat,pants]);
  const service=createFabricSearch({...s,fetchImpl:async()=>response([entry()])});
  let book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:coat.id,product:{url}});
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:pants.id,product:{url}});
  const raw=s.records.get(key).buf.toString(),stored=JSON.parse(raw);
  assert.match(stored.selectedGarmentFingerprints[coat.id],/^v1:[a-f0-9]{64}$/);assert.equal(book.selectedGarmentFingerprints,undefined,'Fingerprint storage is server owned; client schema stays compatible');
  writePieces([pants,{...coat,_image:image,_pattern:'new generated pattern',_technical:'production update'}]);
  assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,{[coat.id]:url,pants:url});
  for(const replacement of [{...coat,name:'New jacket'},{...coat,fabric:'White cotton'},{...coat,fabric_spec:{fiber:'cotton',weave:'poplin'}},{...coat,fabric_hex:'#ffffff'}]){
    writePieces([replacement,pants]);const current=await service.loadBook(user,'project-A');
    assert.deepEqual(current.selectedByGarment,{pants:url});assert.equal(current.items.length,1);assert.equal(s.records.get(key).buf.toString(),raw,'Changed identity is hidden without a migration write');
  }
  const replacement={...coat,name:'New jacket',fabric:'White cotton'};writePieces([replacement,pants]);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:coat.id,product:{url}}),error=>error.status===409);assert.equal(s.records.get(key).buf.toString(),raw);
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{url}});
  assert.deepEqual(book.selectedByGarment,{pants:url});assert.deepEqual(Object.keys(JSON.parse(s.records.get(key).buf).selectedGarmentFingerprints),['pants'],'Explicit CAS mutation prunes stale identity and its fingerprint');
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:replacement.id,product:{url}});
  assert.deepEqual(book.selectedByGarment,{pants:url,[replacement.id]:url});assert.notEqual(JSON.parse(s.records.get(key).buf).selectedGarmentFingerprints[replacement.id],stored.selectedGarmentFingerprints[coat.id],'Explicit review binds the reused ID to its new garment');
});
await test('malformed garment identity storage cannot be silently overwritten',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',product={...{url,title:'Crimson wool twill'},garment:'Coat',garmentId:'coat'};
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat',fabric:'wool'}]})),generation:'1'});
  const service=createFabricSearch({...s});
  for(const selectedGarmentFingerprints of [null,[],{}, {coat:'invalid'}, {coat:'v1:'+'a'.repeat(64),extra:'v1:'+'b'.repeat(64)}]){
    const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{coat:url},selectedGarmentFingerprints});s.records.set(key,{buf:Buffer.from(raw),generation:'5'});
    await assert.rejects(service.loadBook(user,'project-A'),error=>error.status===503);
    await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'5',action:'remove',product:{url}}),error=>error.status===503);assert.equal(s.records.get(key).buf.toString(),raw);
  }
});
await test('local in-house photo favorites share the sealed book without invented inventory or arrival',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured'});
  const product={url:'/aesthetics/fabrics/Midnight%20Velvet.JPG',title:'Midnight Velvet',price:'in stock',etaDays:7,availability:'in_stock',garment:'Evening jacket'};
  const book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',product});
  assert.equal(book.items[0].image,product.url);assert.equal(book.items[0].availability,'unknown');assert.equal(book.items[0].etaDays,undefined);assert.equal(book.items[0].price,undefined);
  assert.equal((await service.loadBook(second,'project-A')).items.length,0);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...product,url:'/aesthetics/fabrics/%2e%2e/private.png'}}));
});
await test('per-item research survives reload, footwear is searchable, and dismissals survive another paid search',async()=>{
 const s=store();put(s,'submissions/project-A/pieces.json',{pieces:[{id:'coat',name:'Coat',fabric:'Wool'},{id:'boots',name:'Boots',category:'footwear'}]});
 let calls=0;const service=create({...s,fetchImpl:async(_url,options)=>{calls++;const request=JSON.parse(options.body);if(calls===2)assert.match(request.instructions,/finished items/);return new Response(wire([done([{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',url,title:'Source with no image'}]}]},item([entry()])])]));}});
 const body=id=>({submissionId:'project-A',automatic:true,piece:{id}});
 await service.search(user,body('coat'),()=>{});await service.search(user,body('boots'),()=>{});
 let coat=await service.loadResearch(user,'project-A','coat'),boots=await service.loadResearch(user,'project-A','boots');
 assert.equal(coat.items.length,2);assert.equal(coat.items[0].image,'');assert.equal(boots.items[0].garment,'Boots');
 assert.equal((await service.loadResearch(second,'project-A','coat')).items.length,0);assert.equal(calls,2,'Reads and exports must not search');
 const csv=await service.exportResearch(user,'project-A');assert.match(csv,/"Coat"/);assert.match(csv,/"Boots"/);assert.match(csv,/Delivery estimate/);assert.equal(calls,2);
 coat=await service.dismissResearch(user,{submissionId:'project-A',garmentId:'coat',url,generation:coat.generation});assert.equal(coat.items.length,1);
 await assert.rejects(service.dismissResearch(user,{submissionId:'project-A',garmentId:'coat',url,generation:'1'}),e=>e.status===409);
 await service.search(user,body('coat'),()=>{});assert.equal((await service.loadResearch(user,'project-A','coat')).items.length,1);assert.equal((await service.loadResearch(user,'project-A','boots')).items.length,2);
 assert.ok([...s.records.keys()].some(k=>k==='submissions/project-A/fabrics/owner-A/coat.json'));
 assert.match(fabricCSV([{garment:'=IMPORTXML("x")',url,description:'line1\nline2'}]),/"'=IMPORTXML/);
 s.records.set(coat.path,{buf:Buffer.from('{'),generation:'9'});await assert.rejects(service.search(user,body('coat'),()=>{}),e=>e.status===503);assert.equal(calls,3,'Unreadable saved work cannot launch a paid replacement');
});
await test('partial provider results save before failure and later exclusions remove persisted evidence',async()=>{
 const s=store();put(s,'submissions/project-A/pieces.json',{pieces:[{id:'coat',name:'Coat'}]});let polyester=false;
 const service=create({...s,fetchImpl:async()=>new Response(wire([{type:'response.output_item.done',item:item([entry(0,{caption:polyester?'Polyester cloth':'Red cloth'})])},{type:'response.failed'}]))});
 const body={submissionId:'project-A',automatic:true,piece:{id:'coat'},preferences:'no polyester'};
 await assert.rejects(service.search(user,body,()=>{}),/stopped/);let stored=await service.loadResearch(user,'project-A','coat');assert.equal(stored.items.length,1);assert.equal(stored.searched,false);
 polyester=true;await assert.rejects(service.search(user,body,()=>{}),/stopped/);stored=await service.loadResearch(user,'project-A','coat');assert.equal(stored.items.length,0);assert.equal(stored.dismissed.length,1);
});
console.log('Fabrics: '+count+' direct-search, cancellation, privacy and storage checks passed.');
};

checks['proxy-policy']=async function(){
// Commit A1 — proxy policy tests. Pure unit tests over the fail-closed request
// policy: no server, no network. Run: node tests/proxy-policy.mjs
const { evaluateProxyPolicy }=await import('../backend/server/proxy-policy.mjs');
const {IMAGE_MODEL}=await import('../backend/server/model-config.mjs');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name); }
}

const MODELS = { TERRA: 'gpt-5.6-terra', LUNA: 'gpt-5.6-luna', SOL: 'gpt-5.6-sol',
  upgrades: { 'gpt-4.1': 'gpt-5.6-terra', 'gpt-4o-mini': 'gpt-5.6-luna' } };

const json = (o) => Buffer.from(JSON.stringify(o), 'utf8');
function ev(over) {
  return evaluateProxyPolicy(Object.assign({
    method: 'POST', upstreamPath: 'v1/chat/completions',
    contentType: 'application/json', body: json({ model: 'gpt-4.1', messages: [] }),
    isAdmin: false, models: MODELS,
  }, over));
}
// build a multipart body with the given fields (and one large "image" file first)
function multipart(fields, opts = {}) {
  const b = 'B0undary' + (opts.boundary || 'XYZ');
  const parts = [];
  if (opts.bigFileFirst) {
    parts.push('--' + b + '\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n' +
      'Content-Type: image/png\r\n\r\n' + 'A'.repeat(opts.fileSize || 200000) + '\r\n');
  }
  for (const [k, v] of fields) {
    parts.push('--' + b + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + v + '\r\n');
  }
  parts.push('--' + b + '--\r\n');
  return { body: Buffer.from(parts.join(''), 'latin1'),
    contentType: 'multipart/form-data; boundary=' + b };
}

// ── valid current calls survive ──
{ const r = ev(); ok('valid chat: legacy gpt-4.1 upgrades to Terra', r.ok && r.model === 'gpt-5.6-terra' && r.original === 'gpt-4.1'); }
{ const r = ev(); ok('valid chat: a fallback body is prepared for the legacy name', r.ok && r.fallback && JSON.parse(r.fallback.toString()).model === 'gpt-4.1'); }
{ const r = ev({ body: json({ model: 'gpt-4o-mini', messages: [] }) }); ok('valid chat: gpt-4o-mini upgrades to Luna', r.ok && r.model === 'gpt-5.6-luna'); }
{ const r = ev({ body: json({ model: 'gpt-5.6-terra', messages: [] }) }); ok('valid chat: a tier name passes as itself, no rewrite', r.ok && r.model === 'gpt-5.6-terra' && !r.fallback); }
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', n: 1 }) }); ok('legacy image generation uses current image tier, n=1', r.ok && r.model === IMAGE_MODEL); }
{ const r = ev({ upstreamPath: 'v1/embeddings', body: json({ model: 'text-embedding-3-small', input: 'x' }) }); ok('valid embeddings', r.ok && r.model === 'text-embedding-3-small'); }
{ const m = multipart([['model', 'whisper-1']]); const r = ev({ upstreamPath: 'v1/audio/transcriptions', contentType: m.contentType, body: m.body }); ok('valid multipart transcription: whisper-1', r.ok && r.model === 'whisper-1'); }

// ── missing / unknown / malformed / mismatch ──
// Current and already-open legacy image clients keep the same endpoint/cost policy.
for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.5-flare']) {
  const body = json({ model, prompt: 'same garment', size: '1024x1536', quality: 'medium', n: 1 });
  const generation = ev({ upstreamPath: 'v1/images/generations', body });
  ok(model + ' generation uses current model without retry and preserves options', generation.ok && generation.model === IMAGE_MODEL && generation.body.equals(json({...JSON.parse(body),model:IMAGE_MODEL})) && !generation.fallback);
  const m = multipart([['model', model], ['quality', 'medium'], ['n', '1']], { bigFileFirst: true, fileSize: 300000 });
  const edit = ev({ upstreamPath: 'v1/images/edits', ...m });
  const expected = multipart([['model', IMAGE_MODEL], ['quality', 'medium'], ['n', '1']], { bigFileFirst: true, fileSize: 300000 });
  ok(model + ' edit upgrades only model and preserves reference bytes', edit.ok && edit.model === IMAGE_MODEL && edit.body.equals(expected.body) && !edit.fallback);
  const wrong = ev({ body: json({ model, messages: [] }) });
  ok(model + ' cannot use chat', !wrong.ok && wrong.error === 'model_endpoint_mismatch');
  const count = ev({ upstreamPath: 'v1/images/generations', body: json({ model, n: 3 }) });
  ok(model + ' retains the image-count cap', !count.ok && count.error === 'too_many_images');
  const high = multipart([['model', model], ['quality', 'high']], { bigFileFirst: true, fileSize: 300000 });
  const denied = ev({ upstreamPath: 'v1/images/edits', ...high });
  ok(model + ' keeps high quality Admin-only', !denied.ok && denied.error === 'quality_not_allowed');
  ok(model + ' permits reviewed Admin quality', ev({ upstreamPath: 'v1/images/edits', ...high, isAdmin: true }).ok);
}

{ const r = ev({ body: json({ messages: [] }) }); ok('missing model is refused', !r.ok && r.error === 'model_required'); }
{ const r = ev({ body: json({ model: 'gpt-4-turbo', messages: [] }) }); ok('unknown model is refused', !r.ok && r.error === 'model_not_allowed'); }
{ const r = ev({ body: Buffer.from('{ not json', 'utf8') }); ok('malformed JSON on a model route is refused', !r.ok && r.error === 'malformed_body'); }
{ const r = ev({ body: json({ model: 'whisper-1', messages: [] }) }); ok('a real model on the wrong endpoint is refused (whisper on chat)', !r.ok && r.error === 'model_endpoint_mismatch'); }
{ const r = ev({ upstreamPath: 'v1/embeddings', body: json({ model: 'gpt-image-2', input: 'x' }) }); ok('gpt-image-2 on embeddings is refused', !r.ok && r.error === 'model_endpoint_mismatch'); }

// ── content-type spoofing ──
{ const r = ev({ contentType: 'text/plain', body: json({ model: 'gpt-4.1' }) }); ok('a non-json/multipart content type is refused', !r.ok && r.error === 'unsupported_content_type'); }
{ const r = ev({ contentType: '', body: json({ model: 'gpt-4.1' }) }); ok('a missing content type is refused', !r.ok && r.error === 'unsupported_content_type'); }

// ── oversized JSON does not bypass model or image inspection ──
{ const big = json({ model: 'gpt-4-turbo', messages: [{ role: 'user', content: 'x'.repeat(3_000_000) }] });
  const r = ev({ body: big }); ok('oversized JSON still gets its (bad) model refused', !r.ok && r.error === 'model_not_allowed'); }
{ const big = json({ model: 'gpt-image-2', prompt: 'x'.repeat(3_000_000), n: 9 });
  const r = ev({ upstreamPath: 'v1/images/generations', body: big }); ok('oversized JSON still gets its image count refused', !r.ok && r.error === 'too_many_images'); }
{ const big = json({ model: 'gpt-image-2', prompt: 'x'.repeat(3_000_000), quality: 'high' });
  const r = ev({ upstreamPath: 'v1/images/generations', body: big }); ok('oversized JSON high-quality is refused for a non-admin', !r.ok && r.error === 'quality_not_allowed'); }

// ── image count / quality ──
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', n: 3 }) }); ok('n>2 is refused', !r.ok && r.error === 'too_many_images'); }
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', quality: 'high' }) }); ok('non-admin high quality is refused', !r.ok && r.error === 'quality_not_allowed'); }
{ const r = ev({ upstreamPath: 'v1/images/generations', isAdmin: true, body: json({ model: 'gpt-image-2', prompt: 'x', quality: 'high', n: 2 }) }); ok('admin high quality n=2 is allowed', r.ok && r.model === IMAGE_MODEL); }

// ── multipart policy after a large file, and ambiguity ──
{ const m = multipart([['model', 'gpt-image-2'], ['n', '9']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart image count is caught even after a 300KB file', !r.ok && r.error === 'too_many_images'); }
{ const m = multipart([['model', 'gpt-image-2'], ['quality', 'high']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart high quality after a large file is refused for a non-admin', !r.ok && r.error === 'quality_not_allowed'); }
{ const m = multipart([['model', 'gpt-image-2'], ['quality', 'high']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', isAdmin: true, contentType: m.contentType, body: m.body });
  ok('multipart high quality after a large file is allowed for an admin', r.ok); }
{ const b = 'B0undaryDUP';
  const body = Buffer.from(
    '--' + b + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n' +
    '--' + b + '\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2\r\n' +
    '--' + b + '--\r\n', 'latin1');
  const r = ev({ upstreamPath: 'v1/audio/transcriptions', contentType: 'multipart/form-data; boundary=' + b, body });
  ok('two different model fields are refused as ambiguous', !r.ok && r.error === 'ambiguous_field'); }
{ const m = multipart([['n', '1']], { bigFileFirst: true });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart with no model is refused', !r.ok && r.error === 'model_required'); }

// ── Sol is admin/Operations only ──
{ const r = ev({ body: json({ model: 'gpt-5.6-sol', messages: [] }) }); ok('non-admin Sol is refused', !r.ok && r.error === 'model_not_allowed'); }
{ const r = ev({ isAdmin: true, body: json({ model: 'gpt-5.6-sol', messages: [] }) }); ok('admin Sol is allowed', r.ok && r.model === 'gpt-5.6-sol'); }

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);

};

checks['design-config']=async function(){
const {default:assert}=await import('node:assert/strict');
const {validDesign,DESIGN_PATH}=await import('../backend/server/design-config.mjs');
const {readFileSync}=await import('node:fs');
assert.equal(DESIGN_PATH,'config/typography-controls.json');
const source=readFileSync(new URL('../docs/aesthetics/ui/typography-controls.js',import.meta.url),'utf8');
assert.match(source,/H1:\{size:24/);
const good={type:{H1:{size:24,weight:300,color:'white'},H2:{size:20,weight:400,color:'white'},H3:{size:16,weight:400,color:'white'},H4:{size:14,weight:400,color:'white'},P1:{size:12,weight:300,color:'gray'},P2:{size:12,weight:400,color:'white'},P3:{size:12,weight:400,color:'gray'},P4:{size:10,weight:300,color:'white'},P5:{size:10,weight:400,color:'gray'}},finish:'current',glass:{fill:18,tint:0,rim:22,highlight:28,blur:22,saturation:180},overlay:{fill:18,rim:22,blur:22,saturation:180,enabled:true},pillX:14,pillY:6};
assert.equal(validDesign(good),true);
for(const bad of [
 {...good,type:{...good.type,H4:{...good.type.H4,size:20}}},
 {...good,type:{...good.type,P1:{...good.type.P1,size:11}}},
 {...good,type:{...good.type,P1:{...good.type.P1,weight:501}}},
 {...good,type:{...good.type,P1:{...good.type.P1,color:'red'}}},
 {...good,glass:{...good.glass,fill:'0);body{display:none}' }},
 {...good,extra:'unapproved'}
])assert.equal(validDesign(bad),false);
console.log('Design validation passed: hierarchy, even sizes, weight cap, fixed colors and numeric glass.');

const compact=structuredClone(good);compact.type.P3=compact.type.P4;compact.type.P4=compact.type.P5;delete compact.type.P5;
compact.type.P1.align='center';compact.editor={fill:30,rim:14,radius:12,padding:8};
assert.equal(validDesign(compact),true);
for(const patch of [{editor:{...compact.editor,padding:21}},{editor:{...compact.editor,fill:'red'}},{type:{...compact.type,P1:{...compact.type.P1,align:'justify'}}}])assert.equal(validDesign({...compact,...patch}),false);

compact.type.H1.font='jost';compact.type.H1.case='uppercase';compact.type.H2.font='cormorant';compact.type.H2.case='none';
assert.equal(validDesign(compact),true);
for(const field of [{font:'Arial'},{font:'url(evil)'},{case:'capitalize'},{case:'uppercase;display:none'}])assert.equal(validDesign({...compact,type:{...compact.type,H3:{...compact.type.H3,...field}}}),false);
console.log('Design font/case validation accepts only the two supported families and Normal/ALL CAPS; old saved schemas remain compatible.');

compact.type.H3.align='right';compact.type.H3.vertical='middle';assert.equal(validDesign(compact),true);
const type={font:'jost',size:13,weight:400,color:'white',case:'none',align:'right',vertical:'top'};
compact.inner={fill:18,rim:22,radius:12,paddingX:30,paddingY:20,width:100};compact.filter={...compact.inner,width:330};
compact.table={fill:18,rim:22,paddingX:12,paddingY:14,header:{...type,background:'blue',opacity:80},firstColumn:{background:'pink',opacity:60},columns:[type,type,type]};
assert.equal(validDesign(compact),true);
for(const patch of [{filter:{...compact.filter,width:159}},{inner:{...compact.inner,paddingY:41}},{table:{...compact.table,columns:[type]}},{table:{...compact.table,header:{...compact.table.header,background:'url(evil)'}}},{table:{...compact.table,columns:[{...type,vertical:'sideways'},type,type]}}])assert.equal(validDesign({...compact,...patch}),false);
for(const target of ['header','firstColumn'])assert.equal(validDesign({...compact,table:{...compact.table,[target]:{...compact.table[target],background:'black'}}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,background:'black'}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,background:'url(evil)'}}),false);
console.log('Saved inner/filter/table controls validate bounded geometry, fixed backgrounds and independent column typography.');

const {saveDesign}=await import('../backend/server/design-config.mjs');
for(const size of [23,49,NaN,'28'])assert.equal(validDesign({...compact,iconSize:size}),false);
assert.equal(validDesign({...compact,iconSize:36,dropdownHeight:32}),true);
let saved=structuredClone(compact),generation=1,conflict=true,unavailable=false;
const store={read:async()=>unavailable?{ok:false,status:503}:{ok:true,buf:Buffer.from(JSON.stringify(saved)),generation:String(generation)},write:async(_,buf,type,expected)=>{assert.equal(expected,String(generation));if(conflict){conflict=false;generation++;throw Object.assign(Error('conflict'),{status:412});}saved=JSON.parse(buf);generation++;}};
const outcome=await saveDesign(store,{...compact,iconSize:36},'owner@example.com',()=> '2026-10-02T20:00:00Z');
assert.equal(outcome.savedAt,'2026-10-02T20:00:00Z');assert.equal(saved.iconSize,36);assert.equal(saved._history.length,1);assert.equal(saved._history[0].source,'design');assert.match(saved._history[0].text,/iconSize/);assert.equal(saved._history[0].who,'owner@example.com');
await saveDesign(store,{...compact,iconSize:36},'owner@example.com');assert.equal(saved._history.length,2);assert.match(saved._history[1].text,/unchanged/);
unavailable=true;await assert.rejects(()=>saveDesign(store,compact,'owner'),/storage unavailable/);assert.equal(saved._history.length,2);
console.log('Atomic design saves audit changes and no-op saves, retry concurrent writes and reject unavailable storage.');

const cell={...type,background:'black',opacity:90};
assert.equal(validDesign({...compact,table:{...compact.table,cells:{'note-0':cell,'stage-99':cell}}}),true);
for(const cells of [{'name-0':cell},{'note-100':cell},{'note-01':cell},{'note-0':{...cell,size:99}},{'note-0':{...cell,background:'url(evil)'}},[],null])assert.equal(validDesign({...compact,table:{...compact.table,cells}}),false);
console.log('Cell presentation overrides accept bounded semantic row slots and fixed styles only.');

assert.equal(validDesign({...compact,table:{...compact.table,columns:[type,{...type,background:'green',opacity:50},type]}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,columns:[type,{...type,background:'url(evil)',opacity:50},type]}}),false);

for(const weight of [200,250,450,500])assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,weight,style:'italic'}}}),true);
assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,weight:199}}}),false);
assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,style:'oblique'}}}),false);
assert.equal(validDesign({...compact,glass:{...compact.glass,borderColor:'black'},overlay:{...compact.overlay,borderColor:'white'},editor:{...compact.editor,background:'black',borderColor:'black'},table:{...compact.table,borderColor:'black'}}),true);
assert.equal(validDesign({...compact,editor:{...compact.editor,borderColor:'red'}}),false);

assert.equal(validDesign({...compact,editor:{fill:100,rim:22,radius:12,paddingX:24,paddingY:10}}),true);
for(const patch of [{paddingX:41},{paddingY:-1},{paddingX:'20'},{paddingY:null}])assert.equal(validDesign({...compact,editor:{fill:100,rim:22,radius:12,paddingX:24,paddingY:10,...patch}}),false);

assert.equal(validDesign({...compact,overlay:{...compact.overlay,radius:20}}),true);assert.equal(validDesign({...compact,overlay:{...compact.overlay,radius:25}}),false);

const withH0={...compact,type:{...compact.type,H0:{size:104,weight:400,color:'white',font:'cormorant',case:'uppercase'}}};
assert.equal(validDesign(withH0),true);for(const size of [22,105,162])assert.equal(validDesign({...withH0,type:{...withH0.type,H0:{...withH0.type.H0,size}}}),false);assert.equal(validDesign(compact),true,'Existing designs need no migration to add H0');

for(const role of ['glass','overlay','editor','inner','filter'])assert.equal(validDesign({...compact,[role]:{...compact[role],borderColor:'gray'}}),true,role+' gray border');
assert.equal(validDesign({...compact,table:{...compact.table,borderColor:'gray'}}),false);
assert.equal(validDesign({...compact,table:{...compact.table,radius:20}}),true);for(const radius of [-1,25,1.5,'12'])assert.equal(validDesign({...compact,table:{...compact.table,radius}}),false);

assert.equal(validDesign({...compact,table:{...compact.table,outerWidth:4,innerWidth:2,innerRim:50,innerBorderColor:'black'}}),true);
for(const patch of [{outerWidth:9},{innerWidth:-1},{innerBorderColor:'red'},{innerRim:101}])assert.equal(validDesign({...compact,table:{...compact.table,...patch}}),false);

const extended=structuredClone(compact);extended.type.H5={size:14,weight:400,color:"white",font:"jost",case:"none"};extended.type.H6={size:10,weight:300,color:"gray",font:"jost",case:"none"};extended.table.columns.push({...type});assert.equal(validDesign(extended),true);assert.equal(validDesign({...extended,type:{...extended.type,H6:{...extended.type.H6,color:"red"}}}),false);assert.equal(validDesign({...extended,table:{...extended.table,columns:[...extended.table.columns,type]}}),false);

for(const target of ['inner','filter','table']){
 const value={...compact,[target]:{...compact[target],background:'blue',blur:8,saturation:120}};assert.equal(validDesign(value),true);
 for(const patch of [{blur:41},{saturation:201},{background:'url(evil)'}])assert.equal(validDesign({...value,[target]:{...value[target],...patch}}),false);
}
assert.equal(validDesign({...compact,overlay:{...compact.overlay,background:'blue'}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,columnWidths:{name:300,contact:180,stage:200,note:400}}}),true);
for(const columnWidths of [{name:79},{note:801},{name:'300'},{alien:300},[],null])assert.equal(validDesign({...compact,table:{...compact.table,columnWidths}}),false);
console.log('Independent panel materials and semantic column widths validate bounded values; older schemas remain valid.');

for(const gap of [0,8,32])assert.equal(validDesign({...compact,iconPillGap:gap,iconTextGap:gap}),true);
for(const gap of [-1,33,1.5,'8'])assert.equal(validDesign({...compact,iconPillGap:gap}),false);

for(const patch of [{iconColor:'#123abc',iconOpacity:65,iconStroke:3},{sectionSpacing:{submissions:32,headingGap:24}},{statusStyles:{completed:{color:'#123abc',opacity:75,weight:500}}}])assert.equal(validDesign({...compact,...patch}),true);
for(const patch of [{iconColor:'red'},{iconOpacity:101},{iconStroke:4},{sectionSpacing:{headingGap:-1}},{sectionSpacing:{alien:12}},{statusStyles:{completed:{color:'url(evil)',opacity:75,weight:500}}},{statusStyles:{completed:{color:'#123abc',opacity:75,weight:600}}},{statusStyles:{alien:{color:'#123abc',opacity:75,weight:500}}}])assert.equal(validDesign({...compact,...patch}),false);

// Version 2 is an explicit canonical schema; versionless open editors stay valid.
const canonical=structuredClone(extended);canonical.typeVersion=2;
canonical.type.H0={...withH0.type.H0};canonical.type.H5={...extended.type.H6};
delete canonical.type.H6;delete canonical.type.P4;delete canonical.type.P5;
for(const value of [50,80,100])assert.equal(validDesign({...canonical,dismissScale:value}),true);
for(const value of [49,101,80.5,'80',null])assert.equal(validDesign({...canonical,dismissScale:value}),false);
const canonicalBefore=JSON.stringify(canonical),legacyBefore=JSON.stringify(extended);
assert.equal(validDesign(canonical),true);assert.equal(validDesign(extended),true);assert.equal(validDesign(good),true);
assert.equal(JSON.stringify(canonical),canonicalBefore);assert.equal(JSON.stringify(extended),legacyBefore,'Validation never migrates or writes a legacy saved design');
for(const role of ['H6','P4','P5','H7','P9'])assert.equal(validDesign({...canonical,type:{...canonical.type,[role]:{...canonical.type.P3}}}),false,'Canonical schema rejects '+role);
for(const role of Object.keys(canonical.type)){
 const missing=structuredClone(canonical);delete missing.type[role];assert.equal(validDesign(missing),false,'Canonical schema requires '+role);
}
for(const typeVersion of [null,undefined,1,3,'2',true])assert.equal(validDesign({...canonical,typeVersion}),false,'Only explicit numeric version 2 is supported');
for(const type of [null,[],false,'roles'])assert.equal(validDesign({...canonical,type}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,H4:{...canonical.type.H4,size:canonical.type.H3.size}}}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,P3:{...canonical.type.P3,size:canonical.type.P2.size+2}}}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,H5:{...canonical.type.H5,size:24}}}),true,'Date sizing remains independent, as in legacy H6');

const regularPill={fill:25,rim:30,borderColor:'gray',background:'black',paddingX:12,paddingY:6};
for(const design of [canonical,compact])assert.equal(validDesign({...design,regularPill}),true,'Retired pill schema remains accepted for legacy design reads');
for(const background of ['black','gray','blue','yellow','green','pink'])assert.equal(validDesign({...canonical,regularPill:{...regularPill,background}}),true);
for(const borderColor of ['black','white','gray'])assert.equal(validDesign({...canonical,regularPill:{...regularPill,borderColor}}),true);
for(const [key,min,max] of [['fill',0,100],['rim',0,100],['paddingX',4,32],['paddingY',2,16]]){
 for(const value of [min,max])assert.equal(validDesign({...canonical,regularPill:{...regularPill,[key]:value}}),true,key+' boundary');
 for(const value of [min-1,max+1,min+.5,String(min),null])assert.equal(validDesign({...canonical,regularPill:{...regularPill,[key]:value}}),false,key+' invalid value');
}
for(const key of Object.keys(regularPill)){
 const partial={...regularPill};delete partial[key];assert.equal(validDesign({...canonical,regularPill:partial}),false,'Regular pill requires '+key);
}
for(const value of [null,[],false,'pill',{...regularPill,background:'url(evil)'},{...regularPill,borderColor:'red'},{...regularPill,blur:12}])assert.equal(validDesign({...canonical,regularPill:value}),false);

for(const status of ['delivering','pending','rejected']){
 const style={color:'#123abc',opacity:50,weight:400};
 for(const design of [canonical,compact])assert.equal(validDesign({...design,statusStyles:{[status]:style}}),true,status+' accepts the shared status style');
 for(const patch of [{color:'red'},{opacity:-1},{opacity:101},{opacity:'50'},{weight:199},{weight:501},{weight:300.5},{unknown:1}])assert.equal(validDesign({...canonical,statusStyles:{[status]:{...style,...patch}}}),false);
 for(const key of Object.keys(style)){const partial={...style};delete partial[key];assert.equal(validDesign({...canonical,statusStyles:{[status]:partial}}),false);}
}
assert.equal(validDesign({...canonical,statusStyles:{unknown:{color:'#123abc',opacity:50,weight:400}}}),false);
console.log('Canonical roles, legacy compatibility, complete regular-pill materials and extended semantic statuses validate without mutating saved settings.');

for(const design of [canonical,compact]){
 for(const layoutSpacing of [{},{labelGap:0,fieldGap:64,drawerDockInset:32},{labelGap:64,fieldGap:0,drawerDockInset:0}])assert.equal(validDesign({...design,layoutSpacing}),true,'Optional workspace spacing preserves older designs');
 assert.equal(validDesign({...design,semanticStyles:{nonFabric:{color:'#fde68a',opacity:0}}}),true);
 assert.equal(validDesign({...design,semanticStyles:{nonFabric:{color:'#123abc',opacity:100}}}),true);
}
for(const layoutSpacing of [null,[],{labelGap:-1},{labelGap:65},{fieldGap:'4'},{fieldGap:1.5},{drawerDockInset:33},{unknown:4}])assert.equal(validDesign({...canonical,layoutSpacing}),false);
for(const semanticStyles of [null,[],{unknown:{}},{nonFabric:null},{nonFabric:[]},{nonFabric:{color:'yellow',opacity:50}},{nonFabric:{color:'#123abc',opacity:101}},{nonFabric:{color:'#123abc',opacity:'50'}},{nonFabric:{color:'#123abc'}},{nonFabric:{color:'#123abc',opacity:50,weight:400}}])assert.equal(validDesign({...canonical,semanticStyles}),false);
unavailable=false;
await saveDesign(store,{...canonical,layoutSpacing:{labelGap:19,fieldGap:27,drawerDockInset:0},semanticStyles:{nonFabric:{color:'#123abc',opacity:65}}},'owner@example.com');
assert.deepEqual(saved.layoutSpacing,{labelGap:19,fieldGap:27,drawerDockInset:0});assert.deepEqual(saved.semanticStyles,{nonFabric:{color:'#123abc',opacity:65}});assert.match(saved._history.at(-1).text,/layoutSpacing/);
console.log('Workspace spacing and non-fabric semantic colors validate, preserve legacy saves and persist in the atomic design audit.');

const checkbox={size:16,radius:3,background:'black',fill:100,rim:55,borderColor:'gray',checkedColor:'#aab5c4',checkColor:'#000000'};
const scrollbar={width:8,radius:8,thumbColor:'#aab5c4',thumbOpacity:55,trackColor:'#000000',trackOpacity:0};
for(const design of [canonical,compact])assert.equal(validDesign({...design,checkbox,scrollbar}),true,'Native controls preserve both design generations');
for(const [kind,value,ranges] of [['checkbox',checkbox,{size:[12,28],radius:[0,14],fill:[0,100],rim:[0,100]}],['scrollbar',scrollbar,{width:[2,20],radius:[0,16],thumbOpacity:[0,100],trackOpacity:[0,100]}]]){
 for(const [key,[min,max]] of Object.entries(ranges)){
  for(const n of [min,max])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:n}}),true,kind+' '+key+' boundary');
  for(const n of [min-1,max+1,min+.5,String(min),null])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:n}}),false,kind+' '+key+' invalid');
 }
 for(const key of Object.keys(value)){const partial={...value};delete partial[key];assert.equal(validDesign({...canonical,[kind]:partial}),false,kind+' requires '+key);}
 for(const bad of [null,[],false,'custom',{...value,unknown:1}])assert.equal(validDesign({...canonical,[kind]:bad}),false,kind+' rejects invalid shape');
 for(const key of Object.keys(value).filter(k=>k.endsWith('Color')&&k!=='borderColor'))for(const color of ['red','#fff','url(evil)',7,null])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:color}}),false,'Bounded color '+key);
}
assert.equal(validDesign({...canonical,checkbox:{...checkbox,background:'purple'}}),false);assert.equal(validDesign({...canonical,checkbox:{...checkbox,borderColor:'blue'}}),false);
await saveDesign(store,{...canonical,checkbox,scrollbar},'owner@example.com');assert.deepEqual(saved.checkbox,checkbox);assert.deepEqual(saved.scrollbar,scrollbar);assert.match(saved._history.at(-1).text,/checkbox/);
console.log('Checkbox and scrollbar controls: optional legacy-compatible complete objects, bounds, colors and atomic persistence passed.');

const drawer={background:'navy',fill:90,rim:22,borderColor:'white',blur:28,saturation:180,radius:18,paddingX:12,paddingY:16};
const thinScrollbar={...scrollbar,version:2,width:4,length:50,hideAfter:800,autoHide:true};
assert.equal(validDesign({...canonical,drawer,scrollbar:thinScrollbar}),true);
for(const [key,max]of Object.entries({fill:100,rim:100,blur:40,saturation:200,radius:24,paddingX:40,paddingY:40})){for(const value of [0,max])assert.equal(validDesign({...canonical,drawer:{...drawer,[key]:value}}),true);for(const value of [-1,max+1,1.5,'1',null])assert.equal(validDesign({...canonical,drawer:{...drawer,[key]:value}}),false);}
for(const key of Object.keys(drawer)){const partial={...drawer};delete partial[key];assert.equal(validDesign({...canonical,drawer:partial}),false);}
for(const bad of [null,[],{...drawer,background:'url(evil)'},{...drawer,borderColor:'blue'},{...drawer,extra:1}])assert.equal(validDesign({...canonical,drawer:bad}),false);
for(const [key,valid,bad]of [['length',[25,50,100],[24,101,'50',null]],['hideAfter',[200,800,3000],[199,3001,'800',null]],['autoHide',[false,true],['true',0,null]],['version',[2],[1,3,'2',null]]]){for(const value of valid)assert.equal(validDesign({...canonical,scrollbar:{...thinScrollbar,[key]:value}}),true);for(const value of bad)assert.equal(validDesign({...canonical,scrollbar:{...thinScrollbar,[key]:value}}),false);}
await saveDesign(store,{...canonical,drawer,scrollbar:thinScrollbar},'owner@example.com');assert.deepEqual(saved.drawer,drawer);assert.deepEqual(saved.scrollbar,thinScrollbar);
console.log('Shared drawer and auto-hide scrollbar schema: legacy compatibility, bounded saved settings and atomic persistence passed.');

};

checks['logic-models']=async function(){
 const {default:assert}=await import('node:assert/strict');
 const {spawnSync}=await import('node:child_process');
 const {MODEL_TERRA,MODEL_LUNA,MODEL_SOL,MODEL_UPGRADES,chatBody}=await import('../backend/server/model-config.mjs');
 const {evaluateProxyPolicy}=await import('../backend/server/proxy-policy.mjs');
 const {createCrmAI,ECONOMY_MODELS}=await import('../backend/server/crm-ai.mjs');
 const models={TERRA:MODEL_TERRA,LUNA:MODEL_LUNA,SOL:MODEL_SOL,upgrades:MODEL_UPGRADES};
 const evaluate=(body,isAdmin=false)=>evaluateProxyPolicy({method:'POST',upstreamPath:'v1/chat/completions',contentType:'application/json',body:Buffer.from(JSON.stringify(body)),isAdmin,models});
 const messages=[{role:'user',content:[{type:'text',text:'Interpret this pattern'},{type:'image_url',image_url:{url:'data:image/png;base64,YQ=='}}]}];
 for(const [alias,expected,effort]of [['gpt-4.1',MODEL_TERRA,'none'],['gpt-4o-mini',MODEL_LUNA,'none'],['gpt-5.6-sol',MODEL_SOL,'low'],['gpt-6-sol',MODEL_SOL,'low']]){
  const r=evaluate({model:alias,messages,stream:true,max_tokens:4000,temperature:.2,top_p:.9,response_format:{type:'json_object'}},true);
  assert.equal(r.ok,true);assert.equal(r.model,expected);assert.equal(r.streamRequested,true);
  const b=JSON.parse(r.body);assert.deepEqual(b.messages,messages);assert.equal(b.reasoning_effort,effort);assert.equal(b.max_completion_tokens,4000);assert.equal(b.temperature,undefined);assert.equal(b.top_p,undefined);assert.equal(b.max_tokens,undefined);assert.deepEqual(b.response_format,{type:'json_object'});
  assert.equal(JSON.parse(r.fallback).model,'gpt-4o-mini','Existing pre-inference entitlement fallback remains');
 }
 for(const model of ['gpt-5.6-sol','gpt-6-sol',MODEL_SOL])assert.equal(evaluate({model,messages}).status,403);
 assert.equal(chatBody({reasoning_effort:'high',max_tokens:9000,logprobs:true,top_logprobs:2},MODEL_SOL).reasoning_effort,'high');
 assert.equal(chatBody({reasoning_effort:'none',logprobs:true,top_logprobs:2},MODEL_SOL).logprobs,undefined);
 assert.equal(chatBody({reasoning_effort:'minimal'},MODEL_SOL).reasoning_effort,'low');
 for(const extra of [{tools:[{type:'function',function:{name:'test'}}]},{functions:[{name:'test'}]},{messages:[{role:'tool',content:'result',tool_call_id:'x'}]}])assert.equal(evaluate({model:MODEL_TERRA,messages,...extra},true).error,'responses_required');
 assert.equal(evaluate({model:MODEL_LUNA,messages,tools:[{type:'function',function:{name:'test'}}]}).ok,true);
 assert.equal(evaluate({model:MODEL_LUNA,messages,reasoning_effort:'low',tools:[{type:'function',function:{name:'test'}}]}).error,'responses_required');
 const overrides=spawnSync(process.execPath,['--input-type=module','-e',"const m=await import('./backend/server/model-config.mjs');console.log(JSON.stringify([m.MODEL_TERRA,m.MODEL_SOL,m.MODEL_LUNA,m.MODEL_UPGRADES['gpt-5.6-sol']]));"],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,MODEL_TERRA:'owner-terra',MODEL_SOL:'owner-sol',MODEL_LUNA:'owner-luna'},encoding:'utf8'});
 assert.equal(overrides.status,0,overrides.stderr);assert.deepEqual(JSON.parse(overrides.stdout),['owner-terra','owner-sol','owner-luna','owner-sol']);
 const records=new Map();let revision=0,calls=0,mode='ok',sent;
 const ai=createCrmAI({keys:{openai:'fixture'},now:()=>new Date('2026-11-11T12:00:00Z'),read:async key=>records.get(key)||{ok:false,status:404},write:async(key,buf,type,expected)=>{assert.equal(expected,records.get(key)?.generation||'0');records.set(key,{ok:true,buf,generation:String(++revision)});},fetch:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);
  if(mode==='uncertain')throw Error('network');
  if(mode==='refused')return new Response('',{status:429});
  return Response.json({output:[{content:[{type:'output_text',text:'{"reply":"Ready"}'}]}],usage:{input_tokens:1000,output_tokens:200}});
 }});
 const completion=await ai.complete('owner','Return JSON',{request:'Draft reply'},'openai',{json:true});
 assert.equal(sent.model,'gpt-6-luna');assert.deepEqual(sent.reasoning,{effort:'none'});assert.equal(sent.store,false);assert.deepEqual(sent.text,{format:{type:'json_object'}});assert.equal(completion.costUsd,.0002);
 assert.deepEqual(ECONOMY_MODELS.openai,{model:'gpt-6-luna',input:.1,output:.5});assert.equal((await ai.meter('owner')).limitUsd,1);
 mode='uncertain';await assert.rejects(ai.complete('owner','Draft',{request:'Reply'}),e=>e.code==='ai_completion_unconfirmed');const reserve=(await ai.meter('owner')).reservedUsd;assert.ok(reserve>0);
 mode='refused';await assert.rejects(ai.complete('owner','Draft',{request:'Reply'}),e=>e.code==='ai_http_429');assert.equal((await ai.meter('owner')).reservedUsd,reserve);assert.equal(calls,3,'No automatic paid retry');
 console.log('Current logic tiers preserve workload roles, owner overrides, admin gating, JSON/streaming and CRM cost/reservation safeguards.');
};

checks['image-models']=async function(){
// Exercise actual image request builders with fake transport; no paid calls.
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {default:vm}=await import('node:vm');
const {IMAGE_MODEL}=await import('../backend/server/model-config.mjs');

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fn(source,name){
  const start=source.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,name);
  const firstLine=source.slice(start,source.indexOf('\n',start));
  if(firstLine.endsWith('}'))return firstLine;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const frontend=read('frontend/index.html'),brief=read('backend/backend.html'),backendTwo=read('backend/backend2.html'),operations=read('backend/operation-workspace.html');
assert.equal(IMAGE_MODEL,'gpt-image-2.6-flare');
const calls=[],stored=new Map([['maya_image_model','gpt-image-2.5-flare']]);
const image=new Blob(['reference-image'],{type:'image/png'});
const context=vm.createContext({
  FormData,Blob,console,setTimeout,
  localStorage:{getItem:key=>stored.get(key),removeItem:key=>stored.delete(key)},
  getApiKey:()=> 'fixture-token',getPatternQuality:()=> 'high',getQuality:()=> 'high',
  blobFromPicture:async src=>new Blob([src],{type:'image/jpeg'}),compressBlobForUpload:async blob=>blob,
  operationContext:()=>({token:'fixture-token'}),requireOperation:()=>{},
  fetch:async(url,options)=>{
    if(url==='fixture-hero')return {blob:async()=>image};
    calls.push({url,options});
    return {ok:true,json:async()=>({data:[{b64_json:'fixture-output'}]})};
  },
});
vm.runInContext("const STORAGE_KEY_IMG_MODEL='maya_image_model';\n"+
  ['getImageModel','getImageQuality','callOpenAIImage','callOpenAIImageEdit'].map(name=>fn(frontend,name)).join('\n')+'\n'+
  ['renderPiece','generatePattern'].map(name=>fn(brief,name)).join('\n')+'\n'+fn(operations,'gptImageEdit'),context);

assert.equal(vm.runInContext('getImageModel()',context),IMAGE_MODEL);
assert.equal(stored.has('maya_image_model'),false,'An old saved preference cannot pin new requests to 2.5');
stored.set('maya_image_model',IMAGE_MODEL);
assert.equal(vm.runInContext('getImageModel()',context),IMAGE_MODEL);
assert.equal(stored.get('maya_image_model'),IMAGE_MODEL);
assert.equal(await vm.runInContext("callOpenAIImage('same garment')",context),'data:image/png;base64,fixture-output');
assert.deepEqual(JSON.parse(calls[0].options.body),{model:IMAGE_MODEL,complexity:'medium',prompt:'same garment',size:'1024x1536',quality:'medium',n:1});
await vm.runInContext("callOpenAIImage('same garment','1024x1024','low',{background:'transparent',output_format:'webp'})",context);
assert.deepEqual(JSON.parse(calls[1].options.body),{model:IMAGE_MODEL,complexity:'medium',prompt:'same garment',size:'1024x1024',quality:'low',n:1,background:'transparent',output_format:'webp'});
await vm.runInContext("callOpenAIImageEdit(['first reference','second reference'],'keep these details',undefined,'medium',{background:'opaque',output_format:'png'})",context);
const multi=calls.at(-1).options.body;
assert.deepEqual(await Promise.all(multi.getAll('image[]').map(blob=>blob.text())),['first reference','second reference']);
assert.equal(multi.get('prompt'),'keep these details');
assert.equal(multi.get('background'),'opaque');assert.equal(multi.get('output_format'),'png');
await vm.runInContext("callOpenAIImageEdit('single reference','keep it')",context);
assert.equal(await calls.at(-1).options.body.get('image').text(),'single reference');
await vm.runInContext("renderPiece('fixture-hero',{name:'Coat'})",context);
await vm.runInContext("generatePattern('fixture-hero',{name:'Coat',panels:8})",context);
await vm.runInContext("gptImageEdit('fixture-hero','pattern drawing')",context);
vm.runInContext(['renderPiece','generatePattern'].map(name=>fn(backendTwo,name)).join('\n'),context);
await vm.runInContext("renderPiece('fixture-hero',{name:'Coat'})",context);
await vm.runInContext("generatePattern('fixture-hero',{name:'Coat',panels:8})",context);
assert.equal(calls.length,9,'One request per explicit generation/edit, including Backend 2');
for(const [i,call] of calls.entries()){
  assert.equal(call.options.headers.Authorization,'Bearer fixture-token');
  assert.equal(call.options.method,'POST');
  if(i<2){assert.equal(call.url,'/api/openai/v1/images/generations');continue;}
  assert.equal(call.url,'/api/openai/v1/images/edits');
  const form=call.options.body;
  assert.equal(form.get('model'),IMAGE_MODEL);
  if(i<4)assert.equal(form.get('complexity'),'medium');
  assert.equal(form.get('size'),'1536x1024');assert.equal(form.get('n'),'1');
  assert.equal(form.get('quality'),[5,6,8].includes(i)?'high':'medium','Existing Admin quality choices stay intact');
  if(i>=4)assert.equal(await form.get('image').text(),'reference-image');
}
const {evaluateProxyPolicy}=await import('../backend/server/proxy-policy.mjs');
for(const oldModel of ['gpt-image-2','gpt-image-2.5-flare']){
 const bytes=Buffer.concat([Buffer.from([0,255,128,13,10]),Buffer.from(oldModel)]);
 const form=new FormData();form.append('image',new Blob([bytes],{type:'image/png'}),'reference.png');form.append('model',oldModel);form.append('prompt','Keep the jacket');form.append('quality','high');form.append('n','1');
 const request=new Request('https://fixture.test',{method:'POST',body:form}),contentType=request.headers.get('Content-Type');
 const policy=evaluateProxyPolicy({method:'POST',upstreamPath:'v1/images/edits',contentType,body:Buffer.from(await request.arrayBuffer()),isAdmin:true,models:{}});
 assert.equal(policy.ok,true);assert.equal(policy.fallback,null);
 const decoded=await new Response(policy.body,{headers:{'Content-Type':contentType}}).formData();
 assert.equal(decoded.get('model'),IMAGE_MODEL);assert.equal(decoded.get('prompt'),'Keep the jacket');assert.equal(decoded.get('quality'),'high');assert.equal(decoded.get('n'),'1');assert.deepEqual(Buffer.from(await decoded.get('image').arrayBuffer()),bytes,'Model-like text in binary references is untouched');
}
console.log('GPT Image 2.6 Flare requests preserve auth, sizes, quality, options, reference images and response handling across frontend, Brief, Backend 2 and Operations.');

};

checks['avatar-autosave']=async function(){
const {default:assert}=await import('node:assert/strict');
const {default:vm}=await import('node:vm');
const {readFileSync}=await import('node:fs');
const {webcrypto}=await import('node:crypto');
const source=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let uid='A',epoch=0,list=[{id:'unrelated',name:'Avatar',face:'keep-me',updatedAt:1}],fail=false,uploadGate=null,uploads=0,writes=0;
const notices=[];
const ctx=vm.createContext({crypto:webcrypto,console:{warn(){}},setTimeout,clearTimeout,
  document:{querySelector:()=>null},confirm:()=>true,showError:message=>notices.push(message),_persistSession(){},refreshDrawerClientName(){},showToast:message=>notices.push(message),
  _opContext:()=>({uid,epoch}),_opStillValid:c=>c.uid===uid&&c.epoch===epoch,
  projectStore:{_uid:()=>uid,ready:()=>true,_accountContext:()=>({uid,epoch}),_accountValid:c=>c.uid===uid&&c.epoch===epoch,
    uploadImage:async()=>{uploads++;if(uploadGate)await uploadGate.promise;return {url:'https://example.test/face-'+uploads+'.jpg'};}},
  firebase:{firestore:()=>({runTransaction:async fn=>{if(fail)throw Error('offline');return fn({get:async()=>({exists:true,data:()=>({list})}),set:(_,data)=>{writes++;list=data.list;}});}})},
});
vm.runInContext("let lastSummary={client:{name:null},_face_photo:'data:image/png;base64,AAAA'},_facePhotoVersion=0,_avatarLibCache=null,_avatarLibCacheUid=null,_avatarSwitcherOpen=false;function _avatarsDoc(){return {};}",ctx);
vm.runInContext(slice('function _avatarIdentity()','// v12.5:')+slice('// Avatar edits save automatically','async function saveAvatarFromDrawer('),ctx);
assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),true);
assert.equal(list.length,2);assert.equal(list[0].name,'Avatar');assert.equal(list[1].face,'keep-me','Unrelated same-name avatars are preserved');
const id=list[0].id;
await vm.runInContext('_queueAvatarSave(true)',ctx);assert.equal(writes,1);assert.equal(uploads,1);
vm.runInContext("lastSummary.client.name='Taylor';lastSummary._measurements={height:'70'}",ctx);
await Promise.all([vm.runInContext('_queueAvatarSave(true)',ctx),vm.runInContext('_queueAvatarSave(true)',ctx)]);
assert.equal(list.length,2);assert.equal(list[0].id,id);assert.equal(list[0].name,'Taylor');assert.equal(list[0].measurements.height,'70');assert.equal(uploads,1,'A name/measurement edit reuses the saved photo');
fail=true;vm.runInContext("lastSummary.client.name='New name'",ctx);assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),false);assert.equal(list[0].name,'Taylor');assert.match(notices.at(-1),/could not sync/);fail=false;
await vm.runInContext('_queueAvatarSave(true)',ctx);assert.equal(list[0].name,'New name');
list[0]={...list[0],updatedAt:list[0].updatedAt+10};vm.runInContext("lastSummary.client.name='Stale name'",ctx);
assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),false);assert.equal(list[0].name,'New name','Concurrent remote edits are not overwritten');
assert.equal(vm.runInContext('_avatarLibCache',ctx),null,'Reopening after a conflict reads the latest saved library');
for(const boundary of ['account-roundtrip','client']){
  vm.runInContext("lastSummary={client:{name:'Pending'},_face_photo:'data:image/png;base64,AAAA'};_facePhotoVersion++",ctx);
  uploadGate=deferred();const before=uploads,priorWrites=writes,running=vm.runInContext('_queueAvatarSave(true)',ctx);
  while(uploads===before)await Promise.resolve();
  if(boundary==='account-roundtrip'){uid='B';epoch++;uid='A';epoch++;}else vm.runInContext("lastSummary.client.name='Other client';_facePhotoVersion++",ctx);
  uploadGate.resolve();await running;assert.equal(writes,priorWrites,'Stale upload cannot write after '+boundary);uploadGate=null;
}
// List mutations read the latest transaction snapshot, preserving simultaneous photo edits.
vm.runInContext(slice('async function renameAvatarById(', 'function pgRenameAvatarRow(')+slice('async function deleteAvatar(', '// Helper for face-photo handlers'),ctx);
ctx._loadAvatarLibrary=async()=>list;ctx.toggleAvatarSwitcher=async()=>{};
ctx.updateClientNameInline=name=>vm.runInContext('lastSummary.client.name='+JSON.stringify(name),ctx);
list=[{id:'rename-me',name:'Old',face:'newer-remote-photo',updatedAt:10},{id:'neighbor',name:'Keep',face:'untouched'}];
vm.runInContext("lastSummary={client:{name:'Other'},_avatarLibraryId:'other'}",ctx);
assert.equal(await vm.runInContext("renameAvatarById('rename-me','Renamed')",ctx),true);
assert.equal(list[0].face,'newer-remote-photo');assert.equal(list[0].name,'Renamed');assert.equal(list[1].id,'neighbor');
vm.runInContext("lastSummary={client:{name:'Old'},_avatarLibraryId:'rename-me',_avatarLibraryRevision:10,_face_photo:'old-photo'}",ctx);
assert.equal(await vm.runInContext("renameAvatarById('rename-me','Stale rename')",ctx),false,'A stale selected avatar cannot adopt a new revision and later overwrite a remote photo');
await vm.runInContext("deleteAvatar('rename-me')",ctx);
assert.equal(list.length,1);assert.equal(list[0].id,'neighbor');assert.equal(vm.runInContext('lastSummary._avatarLibraryId',ctx),null);
assert.equal(vm.runInContext('lastSummary._face_photo',ctx),'old-photo','Removing the library entry retains the project photo');
// A queued upload cannot resurrect a record removed by another client.
list=[{id:'removed',name:'Old',updatedAt:1}];vm.runInContext("lastSummary={client:{name:'Pending'},_avatarLibraryId:'removed',_avatarLibraryRevision:1,_face_photo:'data:image/png;base64,AAAA'}",ctx);
uploadGate=deferred();const prior=uploads,pending=vm.runInContext('_queueAvatarSave(true)',ctx);while(uploads===prior)await Promise.resolve();list=[];uploadGate.resolve();assert.equal(await pending,false);assert.equal(list.length,0);uploadGate=null;
assert.ok(!source.includes('onclick="saveAvatarFromDrawer(this)"')&&!source.includes('onclick="saveAvatar()"'),'Avatar Save buttons are removed');
console.log('Avatar autosave: optional names, one stable record, preserved neighbors, reused photos, explicit failures, remote conflicts and account/client isolation passed.');

};

checks['visualize-preparation']=async function(){
const {default:assert}=await import('node:assert/strict');
const {default:vm}=await import('node:vm');
const {readFileSync}=await import('node:fs');
const source=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
function fn(name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
for(const [final,interim,fail] of [['','',false],['','silk',false],['','blue silk evening coat',false],['red wool','',false],['','blue silk coat',true]]){
  let now=0,calls=0,valid=true;
  const ctx=vm.createContext({console:{warn(){},error(){}},Date:{now:()=>now},setTimeout:(resolve,ms)=>{now+=ms;queueMicrotask(resolve);},
    _opContext:()=>({}),_opStillValid:()=>valid,getApiKey:()=> 'fixture',pushRenderStatus(){},popRenderStatus(){},
    callLiveExtract:async()=>{calls++;if(fail)throw Error('fake unavailable');return [];},placeItemUnique(){},titlesAreSimilar:()=>false});
  vm.runInContext('let isListening=false,batchInFlight=false,lastProcessedLength=0,items=[];let liveTranscriptBuffer='+JSON.stringify(final)+',liveInterimBuffer='+JSON.stringify(interim)+';'+fn('_waitForVoicePipelineQuiet')+fn('processLiveBatch'),ctx);
  await vm.runInContext('_waitForVoicePipelineQuiet()',ctx);
  assert.equal(calls,final||interim?1:0,'A transcript tail gets one extraction, even on failure');
  assert.ok(now<500,'No artificial 30-second pause: '+JSON.stringify({final,interim}));
  assert.equal(vm.runInContext('isListening',ctx),false);
  await vm.runInContext('_waitForVoicePipelineQuiet()',ctx);assert.equal(calls,final||interim?1:0,'Consumed interim text cannot restart paid extraction');
}
let anchors;
const edit=vm.createContext({callOpenAIImageEdit:async value=>{anchors=value;return 'image';},isSafetyRejection:()=>false,
  _resizeImageDataUrlToSize:()=>{throw Error('Unnecessary resize');}});
vm.runInContext(fn('callOpenAIImageEditSafe'),edit);
await vm.runInContext("callOpenAIImageEditSafe(['portrait-face','landscape-reference'],'same garment','1536x1024')",edit);
assert.deepEqual(Array.from(anchors),['portrait-face','landscape-reference'],'Full original references retain their order without PNG upscale/cropping');
console.log('Visualization preparation: empty/short/interim speech settles once without 30-second stalls; edits preserve original references without duplicate resizing.');

};

checks['submission-deletion']=async function(){
 const assert=(await import('node:assert/strict')).default;
 const {createSubmissionDeletion,markExactSubmissionRepeats}=await import('../backend/server/submission-list.mjs');
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
 const objects=new Map([['submissions/owned/submission.json',{openedBy:'owner@test.invalid'}],['submissions/owned/dream-garment.jpg','photo'],['submissions/other/dream-garment.jpg','other photo'],['users/owner/project/photo.jpg','original']]);
 let removes=0,writes=0,fail=false,unreadable=false;
 const store={read:async path=>unreadable?{ok:false,status:503}:objects.has(path)?{ok:true,buf:Buffer.from(JSON.stringify(objects.get(path))),generation:'1'}:{ok:false,status:404},write:async(path,bytes,type,generation)=>{assert.equal(generation,'0');writes++;objects.set(path,JSON.parse(bytes));},list:async prefix=>[...objects.keys()].filter(x=>x.startsWith(prefix)).map(name=>({name,generation:'1'})),remove:async(path,generation)=>{removes++;assert.equal(generation,'1');if(fail)throw Error('fixture unavailable');objects.delete(path);}};
 const service=createSubmissionDeletion(store);
 for(const id of ['../other','owned/child','a',''])await assert.rejects(service.erase(id,'admin'),e=>e.status===400);
 assert.equal(writes,0);await assert.rejects(service.erase('missing','admin'),e=>e.status===404);
 unreadable=true;await assert.rejects(service.erase('owned','admin'),e=>e.status===503);assert.equal(removes,0);unreadable=false;
 fail=true;await assert.rejects(service.erase('owned','admin'),e=>e.status===503);assert.ok(objects.has('deleted-submissions/owned.json'));
 await assert.rejects(service.assertActive('owned'),e=>e.status===410);
 fail=false;await service.erase('owned','admin');assert.equal(writes,1);assert.ok(!objects.has('submissions/owned/dream-garment.jpg'));
 assert.equal(objects.get('submissions/other/dream-garment.jpg'),'other photo');assert.equal(objects.get('users/owner/project/photo.jpg'),'original');
 objects.set('submissions/owned/late.jpg','late');await assert.rejects(service.assertActive('owned'),e=>e.status===410);await service.erase('owned','admin');assert.ok(!objects.has('submissions/owned/late.jpg'));
 assert.deepEqual([...await service.deletedIds()],['owned']);
 // Exercise the shipped endpoint's auth check, not just the storage helper.
 const source=readFileSync(new URL('../backend/server/server.js',import.meta.url),'utf8'),routes=new Map();let erased=0;
 const ctx={app:{delete:(path,fn)=>routes.set(path,fn)},requireAdmin:async()=>{throw Object.assign(Error('no'),{status:403});},submissionDeletion:{erase:async()=>{erased++;}},_subsCache:{},_subsVersion:0,_submissionCaptions:new Map(),_subOwners:new Map(),_thumbCache:new Map(),SUB_PREFIX:'submissions/'};
 const start=source.indexOf("app.delete('/api/admin/submissions/:id'");runInNewContext(source.slice(start,source.indexOf('// GET /api/admin/submissions',start)),ctx);
 const response={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.value=v;return this;},set(){}};
 await routes.get('/api/admin/submissions/:id')({params:{id:'owned'}},response);assert.equal(response.statusCode,403);assert.equal(erased,0);
 const feedRoutes=new Map(),feed={app:{get:(path,fn)=>feedRoutes.set(path,fn)},requireAdmin:async()=>({sub:'owner',email:'owner@test.invalid'}),_subsVersion:0,_subsCache:{ts:Date.now(),body:{folders:[{id:'owned'}]},deletedSignature:''},submissionDeletion:{deletedIds:async()=>new Set(['owned'])},gcsListSubmissions:async()=>[],markExactSubmissionRepeats:folders=>folders,submissionContentKey:()=>'',SUB_PREFIX:'submissions/',SUB_ID:/^[a-z]+$/,console:{log(){},error(){}}};
 const feedStart=source.indexOf("app.get('/api/admin/submissions'");runInNewContext(source.slice(feedStart,source.indexOf('// GET /api/admin/subthumb',feedStart)),feed);
 await feedRoutes.get('/api/admin/submissions')({},response);assert.deepEqual(JSON.parse(JSON.stringify(response.value.folders)),[],'A second instance cannot serve a deleted card from its warm feed cache');
 console.log('Submission deletion: durable tombstones, retry, exact-prefix isolation, cross-instance cache and Admin authorization passed.');
};


checks['image-inspection']=async function(){
 const assert=(await import('node:assert/strict')).default;
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
 const context={window:{},Date,console};runInNewContext(readFileSync('docs/aesthetics/ui/image-viewer.js','utf8'),context);
 const api=context.window.MayaImageViewer,plain=value=>JSON.parse(JSON.stringify(value));
 assert.deepEqual(plain(api.imageBounds(1200,800,600,1200)),{x:400,y:0,width:400,height:800});
 const origin={scale:1,x:0,y:0};assert.deepEqual(plain(api.zoomAt(origin,2,100,50,600,400)),{scale:2,x:-100,y:-50});
 assert.deepEqual(plain(api.zoomAt({scale:3,x:300,y:-200},1,400,300,600,400)),origin);
 assert.equal(api.zoomAt(origin,99,0,0,600,400).scale,6);
 const rows=plain(api.noteRows({profile:{color:'Midnight blue',bio:'A tailored coat'},refs:[{tag:'colour',title:'midnight BLUE'},{tag:'color',title:'blue'},{tag:'visual_ref',title:'Evening tailoring'},{tag:'visual reference',title:'Evening tailoring'}],fabrics:[{color:'Midnight blue',weave:'Velvet'}]}));
 assert.deepEqual(rows.find(r=>r.title==='Color').values,['Midnight blue']);assert.equal(rows.filter(r=>r.title==='Visual reference').length,1);
 const listeners=new Map(),image={parentElement:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:400})},clientWidth:600,clientHeight:400,naturalWidth:1200,naturalHeight:800,style:{},classList:{add(){}},setAttribute(){},setPointerCapture(){},addEventListener:(name,fn)=>{listeners.set(name,fn);}};
 let expanded=0;const bound=api.bind(image,{expand:()=>expanded++,inspect:true});
 const fire=(name,props={})=>listeners.get(name)?.({button:0,pointerType:'touch',preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},...props});
 fire('pointerdown',{pointerId:1,clientX:200,clientY:200});fire('pointerdown',{pointerId:2,clientX:400,clientY:200});fire('pointermove',{pointerId:2,clientX:600,clientY:200});assert.equal(bound.state.scale,2);
 fire('pointerup',{pointerId:1});fire('pointerup',{pointerId:2});fire('click');assert.equal(expanded,0,'A pinch cannot accidentally expand or close the card');
 fire('load');assert.deepEqual(plain(bound.state),origin,'A newly selected image starts unzoomed');
 fire('wheel',{deltaY:-100,clientX:300,clientY:200});assert.ok(bound.state.scale>1);bound.reset();assert.deepEqual(plain(bound.state),origin);
 assert.equal(api.bind(image),bound,'Rebinding cannot duplicate gesture listeners');
 const outerListeners=new Map(),outer={...image,addEventListener:(name,fn)=>outerListeners.set(name,fn)};let opened=0;
 const opener=api.bind(outer,{expand:()=>opened++});assert.equal(outerListeners.has('wheel'),false);assert.equal(outerListeners.has('pointermove'),false);assert.equal(opener.state.scale,1);
 outerListeners.get('click')({preventDefault(){}});assert.equal(opened,1,'Outer images only expand; inspection starts inside the viewer');
 const frontend=readFileSync('frontend/index.html','utf8'),brief=readFileSync('backend/backend.html','utf8');
 assert.ok(!brief.includes('delete-open-submission'));assert.ok(brief.includes('onDelete:deleteBriefSubmission'));assert.ok(frontend.includes('MayaImageViewer.notesDrawer'));assert.ok(!frontend.includes('class="vn-pill'));
 console.log('Image inspection: anchored zoom, bounds, pinch, reset, click suppression and deduplicated notes passed.');
};

checks['frontend-notes-and-wall']=async function(){
 const {default:assert}=await import('node:assert/strict'),{parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {document,Event}=parseHTML('<html><body><div id="viewer"><img id="anchor"></div><div id="community-scroller"><div class="community-row"></div><div class="community-row"></div><div class="community-row"></div></div></body></html>');
 const parent=document.getElementById('viewer'),anchor=document.getElementById('anchor');anchor.getClientRects=()=>[{}];anchor.getBoundingClientRect=parent.getBoundingClientRect=()=>({top:0,left:0,width:600,height:400});
 let now=1000;const c=vm.createContext({document,Date:{now:()=>now},console,ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1,clearTimeout(){}});c.window=c;c.addEventListener=()=>{};
 vm.runInContext(readFileSync('docs/aesthetics/ui/image-viewer.js','utf8'),c);const notes=c.MayaImageViewer.notesDrawer({parent,anchor,card:{caption:'First'}}),dock=notes.element,button=dock.querySelector('button'),panel=dock.querySelector('aside');
 dock.setPointerCapture=()=>{};button.focus=()=>{};
 const event=(type,props={})=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,isPrimary:true,pointerId:1,clientX:20,clientY:40,...props});panel.dispatchEvent(e);return e;};
 notes.set(true);assert.equal(button.getAttribute('aria-label'),'Collapse design notes');assert.equal(button.querySelector('.maya-notes-label').hidden,true);assert.equal(panel.inert,false);
 event('pointerdown');event('pointermove',{clientX:90});event('pointerup',{clientX:90});assert.equal(panel.inert,true,'A rightward swipe dismisses Design Notes');assert.equal(button.getAttribute('aria-label'),'Design Notes');assert.equal(button.querySelector('.maya-notes-label').hidden,false);
 now+=600;notes.set(true);event('pointerdown');const vertical=event('pointermove',{clientY:130});event('pointerup',{clientX:90,clientY:130});assert.equal(vertical.defaultPrevented,false);assert.equal(panel.inert,false,'Vertical reading does not close Notes');
 event('pointerdown');event('pointermove',{clientX:90});event('pointercancel');event('pointerup',{clientX:90});assert.equal(panel.inert,false,'Cancelled gestures cannot close Notes');
 const wheel=event('wheel',{deltaX:0,deltaY:90});assert.equal(wheel.defaultPrevented,false);event('wheel',{deltaX:-80,deltaY:0,deltaMode:0});assert.equal(panel.inert,true,'Rightward trackpad navigation dismisses Notes');
 notes.set(true);notes.update({caption:'Second'});assert.equal(panel.inert,true);assert.match(panel.textContent,/Second/);assert.doesNotMatch(panel.textContent,/First/);
 const source=readFileSync('frontend/index.html','utf8'),start=source.indexOf('  render() {',source.indexOf('const communityBoard =')),end=source.indexOf('\n  // v13.33:',start);
 c.escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 vm.runInContext('globalThis.wall={'+source.slice(start,end)+'};',c);Object.assign(c.wall,{posts:Array.from({length:60},(_,i)=>({id:'post-'+i,imageUrl:'https://photos.test/'+i+'.jpg',author:'Owner',summary:'Design '+i})),_measure(){},_wireRow(){}});
 c.wall.render();const images=[...document.querySelectorAll('.cc-img')],nodes=[...document.querySelectorAll('.community-card')];assert.equal(images.length,60);
 let sourceWrites=0;for(const image of images){const set=image.setAttribute.bind(image);image.setAttribute=(name,value)=>{if(name==='src')sourceWrites++;return set(name,value);};}
 const pausedRow=c.wall._rows[0];pausedRow.paused=true;c.wall.posts[4].summary='Updated description';c.wall.render();assert.equal(c.wall._rows[0],pausedRow);assert.equal(pausedRow.paused,true,'Live updates retain the hovered row and its pause state');assert.equal(document.querySelectorAll('.cc-img').length,60);assert.equal(sourceWrites,0);assert.ok(images.every(image=>image.isConnected),'A one-caption update retains every decoded image');assert.ok(nodes.every(node=>node.isConnected));
 assert.equal(document.querySelector('[data-id="post-4"] .cc-summary').textContent,'Updated description');assert.equal(document.querySelectorAll('.cc-author').length,0);
 document.querySelector('[data-id="post-4"]').style.display='none';c.wall.posts[4].imageUrl='https://photos.test/replaced.jpg';c.wall.render();assert.equal(sourceWrites,1,'Only the changed picture source is reassigned');assert.equal(document.querySelector('[data-id="post-4"]').style.display,'','A corrected picture can recover from an earlier broken image');
 c.wall.posts=c.wall.posts.filter(p=>p.id!=='post-10');c.wall.render();assert.equal(document.querySelector('[data-id="post-10"]'),null);assert.ok(images.filter(image=>image.closest('.community-card').dataset.id!=='post-10').every(image=>image.isConnected),'Row redistribution preserves surviving images');
 c.wall.posts=[];c.wall.render();assert.equal(document.querySelectorAll('.community-card').length,0);
 console.log('Frontend notes/wall: directional and cancelled gestures; 60/60 image nodes retained and zero image-source writes for a caption update (previous renderer replaced all 60).');
};

checks['pattern-work']=async function(){
 const {createPatternWork,createSubmissionDeletion}=await import('../backend/server/submission-list.mjs');
 const records=new Map(),key='submissions/project-A/',user={sub:'owner-A'},piece={id:'coat',name:'Coat',category:'jacket',fabric:'Wool',_image:'data:image/png;base64,aW1hZ2U='};
 const put=(path,data,generation='1')=>records.set(path,{buf:Buffer.from(JSON.stringify(data)),generation});put(key+'submission.json',{});put(key+'pieces.json',{pieces:[piece]});
 let writes=0,readsFail=false,afterWrite=null;
 const read=async path=>{if(readsFail&&path.includes('/patterns/'))return {ok:false,status:503};return records.has(path)?{ok:true,...records.get(path)}:{ok:false,status:404};};
 const remove=async(path,generation)=>{if(records.get(path)?.generation!==generation)throw Object.assign(Error('changed'),{status:412});records.delete(path);};
 const write=async(path,buf,_type,generation)=>{if(String(records.get(path)?.generation||'0')!==String(generation))throw Object.assign(Error('changed'),{status:412});writes++;const result={buf,generation:String(Number(generation)+1)};records.set(path,result);await afterWrite?.(path);return result;};
 const deletion=createSubmissionDeletion({read,write,remove,list:async prefix=>[...records.entries()].filter(([name])=>name.startsWith(prefix)).map(([name,value])=>({name,generation:value.generation}))});
 const service=createPatternWork({read,write,remove,assertActive:deletion.assertActive});
 const base={submissionId:'project-A',garmentId:'coat',settings:{quality:'medium',type:'jacket'}};
 let state=await service.load(user,'project-A','coat');assert.equal(state.runs.length,0);assert.equal(writes,0);
 const run={id:'version-1',createdAt:'2026-11-07T00:00:00Z',inputs:{type:'jacket',prompt:'Book construction',cutlist:[{label:'upper sleeve',qty:2}]},passes:[{img:piece._image,prompt:'Book construction'}],bestIndex:0};
 state=await service.save(user,{...base,generation:state.generation,fingerprint:state.fingerprint,run});
 const written=writes;const acknowledged=await service.save(user,{...base,generation:'0',fingerprint:state.fingerprint,run});assert.equal(acknowledged.generation,state.generation);assert.equal(writes,written,'Retrying an unconfirmed save acknowledges the identical stored run without overwriting');
 const settingsRetry=await service.save(user,{...base,generation:'0',fingerprint:state.fingerprint,run:null});assert.equal(settingsRetry.generation,state.generation);assert.equal(writes,written,'An uncertain settings-only save can be acknowledged without overwriting history');
 assert.equal((await service.load(user,'project-A','coat')).runs[0].inputs.prompt,'Book construction');assert.equal((await service.load({sub:'owner-B'},'project-A','coat')).runs.length,0);
 await assert.rejects(service.save(user,{...base,generation:'0',fingerprint:state.fingerprint,run:{...run,id:'conflict'}}),e=>e.status===409);
 const next={...run,id:'version-2',passes:[...run.passes,{img:'data:image/png;base64,c2Vjb25k',prompt:'Refine sleeves'}]};
 state=await service.save(user,{...base,generation:state.generation,fingerprint:state.fingerprint,run:next});assert.equal(state.runs.length,2);
 const unchangedWrites=writes;assert.equal((await service.load(user,'project-A','coat')).runs.length,2);assert.equal(writes,unchangedWrites,'Opening saved versions cannot generate or write');
 put(key+'pieces.json',{pieces:[{...piece,fabric:'Linen'}]},'2');const changed=await service.load(user,'project-A','coat');assert.equal(changed.stale,true);assert.equal(changed.runs.length,2);
 await assert.rejects(service.save(user,{...base,generation:state.generation,fingerprint:state.fingerprint,run:next}),e=>e.status===409);
 readsFail=true;await assert.rejects(service.save(user,{...base,generation:'0',fingerprint:changed.currentFingerprint,run}),e=>e.status===503);readsFail=false;
 const patternPath=key+'patterns/owner-A/coat.json';const backup=records.get(patternPath);records.set(patternPath,{buf:Buffer.from('{'),generation:'3'});await assert.rejects(service.load(user,'project-A','coat'),e=>e.status===503);records.set(patternPath,backup);
 await deletion.erase('project-A','owner-A');assert.equal([...records.keys()].some(k=>k.startsWith(key)),false);await assert.rejects(service.load(user,'project-A','coat'),e=>e.status===410);
 records.delete('deleted-submissions/project-A.json');put(key+'submission.json',{});put(key+'pieces.json',{pieces:[piece]});state=await service.load(user,'project-A','coat');
 afterWrite=async path=>{if(path.includes('/patterns/'))put('deleted-submissions/project-A.json',{deleted:true});};
 await assert.rejects(service.save(user,{...base,generation:state.generation,fingerprint:state.fingerprint,run}),e=>e.status===410);assert.equal(records.has(patternPath),false,'A late save cannot resurrect a deleted submission');
 console.log('Pattern work: saved passes/inputs/history, account and garment isolation, CAS, failed-read protection and deletion barriers passed.');
};

checks['pattern-reuse']=async function(){
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs');const source=readFileSync('backend/operation-workspace.html','utf8');
 const start=source.indexOf('async function startTest('),end=source.indexOf('\n}',start)+2,code=source.slice(start,end);
 const run={id:'saved-v1',passes:[{img:'data:image/png;base64,aW1hZ2U='}]},notices=[],opened=[];let paid=0;
 const context=vm.createContext({RUNNING:false,ACTIVE_TEST:'Coat',HERO:'saved-photo',FILES:{piece:{id:'coat'}},_patternReady:Promise.resolve(),_patternSave:Promise.resolve(),_patternRecord:{runs:[run]},_patternTimer:null,_patternDirty:false,_patternSettingsError:'',patternContext:()=>({garmentId:'coat'}),patternScope:()=>true,restorePatternRun:value=>opened.push(value),liveOpen(){},toast:text=>notices.push(text),getKey:()=>{paid++;return 'token';},clearTimeout});vm.runInContext(code,context);
 await vm.runInContext('startTest()',context);assert.equal(opened.length,1);assert.equal(paid,0,'Repeated Start restores saved work before any provider setup');
 context._patternReady=Promise.reject(Error('Storage unavailable'));await vm.runInContext('startTest()',context);assert.equal(paid,0);assert.match(notices.at(-1),/Storage unavailable/);
 context._patternReady=Promise.resolve();context._patternSettingsError='Invalid grammar';await vm.runInContext('startTest(true)',context);assert.equal(paid,0);assert.match(notices.at(-1),/Invalid grammar/);
 context._patternSettingsError='';context.patternScope=()=>false;await vm.runInContext('startTest(true)',context);assert.equal(paid,0,'Changed garment cannot cross the paid boundary');
 const loadStart=source.indexOf('async function loadPatternWork('),loadEnd=source.indexOf('\n}',loadStart)+2;assert.doesNotMatch(source.slice(loadStart,loadEnd),/gptImageEdit|runGrounded|classifyGarment/);
 const restoreStart=source.indexOf('function restorePatternRun('),restoreEnd=source.indexOf('\n}',restoreStart)+2;
 Object.assign(context,{structuredClone,$:()=>({textContent:''}),_patternRun:{id:'new-version'},pipelineReset(){},pipelineStep(){},liveOpen(){},renderLogic(){},renderChunks(){},applyView(){},cancelPatternTrace(){},HERO:'saved-photo'});vm.runInContext(source.slice(restoreStart,restoreEnd),context);
 context.saved=run;vm.runInContext('restorePatternRun(saved)',context);assert.equal(context._patternRun,null,'Viewing history cannot overwrite a newer run on the next settings save');
 console.log('Pattern reuse: Start restores saved versions, storage/invalid settings/changed garment block paid generation.');
};

checks['pattern-navigation']=async function(){
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),source=readFileSync('backend/operation-workspace.html','utf8');
 const fn=name=>{const start=source.indexOf('async function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);};
 const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
 const status={textContent:''},picker={value:'Coat'},picked=[];let writes=0;
 const context=vm.createContext({RUNNING:false,ACTIVE_TEST:'Coat',_patternNavigation:0,_patternDirty:true,_patternTimer:1,_patternSettingsError:'',_patternReady:Promise.resolve(),_patternSave:Promise.resolve(),patternContext:()=>({garmentId:'coat'}),patternScope:()=>true,clearTimeout(){},$:id=>id==='test-picker'?picker:status,pickTest:name=>picked.push(name)});
 context.persistPatternWork=async()=>{writes++;context._patternDirty=false;};
 vm.runInContext(fn('flushPatternBeforeNavigation')+'\n'+fn('onPickTest'),context);
 await vm.runInContext('onPickTest("Trousers")',context);assert.equal(writes,1);assert.deepEqual(picked,['Trousers'],'Selection flushes a pending debounce before discarding current work');
 const wait=pending();context._patternDirty=true;context._patternSave=wait.promise;
 const first=vm.runInContext('onPickTest("Boots")',context),last=vm.runInContext('onPickTest("Shirt")',context);await Promise.resolve();assert.equal(picked.length,1);wait.resolve();await Promise.all([first,last]);assert.deepEqual(picked,['Trousers','Shirt'],'Only the latest selection wins while saving');
 context._patternDirty=true;context._patternSave=Promise.reject(Error('Save unavailable'));
 await vm.runInContext('onPickTest("Coat")',context);assert.equal(picked.length,2);assert.equal(status.textContent,'Save unavailable');assert.equal(context._patternDirty,true,'A failed save leaves the current draft available to retry');
 const cancelled=pending();context._patternSave=cancelled.promise;
 const switching=vm.runInContext('onPickTest("Boots")',context);await Promise.resolve();context._patternNavigation++;context.patternScope=()=>false;cancelled.resolve();await switching;assert.equal(picked.length,2,'An account/project reset cancels pending navigation');
 console.log('Pattern navigation: debounce flush, pending writes, latest selection, failed-save retention and scope cancellation passed.');
};

checks['fabric-photo-retention']=async function(){
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),source=readFileSync('docs/aesthetics/ui/fabric-assistant.js','utf8');
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classes=new Set();this.isConnected=true;this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:n=>this.classes.has(n)};}
  append(...children){children.forEach(child=>{child.parent=this;this.children.push(child);});}
  prepend(child){child.parent=this;this.children.unshift(child);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.isConnected=false;}
  setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return k==='src'?this.src:this.attributes[k];} removeAttribute(k){delete this.attributes[k];if(k==='src')delete this.src;}
  addEventListener(type,fn){this.listeners[type]=fn;}
 }
 const nodes=[],node=(tag,cls)=>{const n=new Node(tag);n.className=cls;nodes.push(n);return n;};
 const context=vm.createContext({URL,location:{href:'https://maya.test/',origin:'https://maya.test'},view:'search',searchMode:'worldwide',context:{automatic:true,piece:{id:'coat'}},research:{generation:'1'},busy:false,saves:{pending:new Set()},favorites:{items:[]},favoriteQueue:{pending:new Set()},account:()=> 'owner',window:{},node,icon:()=>node('button'),action:()=>node('button'),queueMicrotask(){},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(source.slice(source.indexOf('  function photoCandidates('),source.indexOf('  function paint()')),context);
 context.product={url:'https://cloth.example/coat',title:'Wool',image:'https://photos.example/wool.jpg',garmentId:'coat'};
 const original=vm.runInContext('card(product)',context);context.original=original;
 const photo=nodes.find(n=>n.tag==='img');photo.listeners.load();
 const buttons=nodes.filter(n=>n.tag==='button'),favorite=buttons[0],remove=buttons[1];assert.equal(remove.disabled,false);assert.equal(favorite.attributes['aria-pressed'],'false');context.favorites.items=[context.product];vm.runInContext('reuseCard(original,product)',context);assert.equal(favorite.attributes['aria-pressed'],'true');
 context.busy=true;assert.equal(vm.runInContext('reuseCard(original,product)',context),original);assert.equal(remove.disabled,true);
 context.busy=false;context.research={generation:'2'};context.product={...context.product,image:'https://photos.example/new.jpg',price:'20',currency:'USD',unit:'yard'};
 assert.equal(vm.runInContext('reuseCard(original,product)',context),original);assert.equal(remove.disabled,false);assert.equal(nodes.filter(n=>n.tag==='img').length,1);assert.equal(photo.src,'https://photos.example/wool.jpg','New search evidence keeps the already loaded photograph');
 assert.match(nodes.find(n=>n.className==='fa-card-caption').textContent,/20 USD \/ yard/,'Late price metadata updates the caption without remounting the photo');
 context.product.rejectedImageURLs=['https://photos.example/wool.jpg'];vm.runInContext('reuseCard(original,product)',context);assert.equal(photo.isConnected,false);assert.equal(nodes.filter(n=>n.tag==='img').at(-1).src,'https://photos.example/new.jpg','Explicit image retractions still replace an excluded photo');
 original._fabricDispose();console.log('Fabric photos: mounted node retention during search/save state changes, controls and image retractions passed.');
};

checks['fabric-loading-reuse']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const source=readFileSync('docs/aesthetics/ui/fabric-assistant.js','utf8');
 const fn=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 let resets=0,researchReads=0,searches=0;
 const reference={submissionId:'project',automatic:true,piece:{id:'coat'},referenceImage:'saved-reference',preferences:'green'};
 const noop=()=>{},control={textContent:'',setAttribute:noop};
 const c=vm.createContext({HTMLElement:class{},context:{...reference,inhouse:[{title:'Wool'}]},identity:'project|coat',originalImage:'',epoch:1,searchSeq:0,autoStarted:true,research:{items:[],searched:true},searchState:'complete',busy:false,
   make:noop,syncLayout:noop,rememberResults:noop,scope:()=> 'project|coat',reset:()=>resets++,restoreResults:()=>false,collapse:noop,expand:noop,workspace:{},els:{sub:{},send:{},input:{focus:noop},expand:control},paint:noop,account:()=> 'owner',loadBook:noop,loadFavorites:noop,loadInventory:async()=>{},loadResearch:async()=>{researchReads++;return {items:[],searched:true};},preparedPhoto:async()=> 'prepared',loadContext:async()=>{},current:()=>true,run:async()=>searches++,status:noop});
 vm.runInContext(fn('  async function open(','  function guardAccount'),c);c.next=reference;
 await vm.runInContext('open(next)',c);await vm.runInContext('open(next)',c);
 assert.equal(resets,0,'Reopening saved research does not compare the source to an unprepared image');assert.equal(researchReads,0);assert.equal(searches,0);assert.equal(c.context.inhouse.length,1);
 c.next={...reference,referenceImage:'changed-reference'};await vm.runInContext('open(next)',c);assert.equal(resets,1,'A changed input still resets');
 c.autoStarted=false;c.research=null;c.loadResearch=async()=>null;c.next={...reference,savedOnly:true,referenceImage:'snapshot-reference'};await vm.runInContext('open(next)',c);assert.equal(searches,0,'Backend 2 snapshot never starts a paid search on opening');
 let fetches=0,resolveFetch,activeEpoch=1;const paints=[];
 const inventory=vm.createContext({epoch:1,context:{},inventoryRequest:null,inventoryData:null,inventoryVersion:0,inventoryStatus:'',AbortSignal,fetch:()=>{fetches++;return new Promise(resolve=>resolveFetch=resolve);},current:stamp=>stamp===activeEpoch,paint:()=>paints.push(activeEpoch)});
 vm.runInContext(fn('  async function loadInventory(','  async function loadContext('),inventory);
 const first=vm.runInContext('loadInventory()',inventory);activeEpoch=2;inventory.epoch=2;inventory.context={};const second=vm.runInContext('loadInventory()',inventory);
 resolveFetch({ok:true,json:async()=>({items:[{fileName:'Wool.jpg',thumbnail:'thumbs/Wool.jpg',name:'Wool'}]})});await Promise.all([first,second]);
 assert.equal(fetches,1,'Garment switches share the public inventory request');assert.equal(inventory.context.inhouse.length,1);assert.equal(paints.length,1,'Stale inventory callers cannot paint');
 inventory.context={};await vm.runInContext('loadInventory()',inventory);assert.equal(fetches,1,'The loaded public catalog is reused');
 const refresh=vm.runInContext('loadInventory(true)',inventory);resolveFetch({ok:true,json:async()=>({items:[]})});await refresh;assert.equal(fetches,2);assert.equal(inventory.context.inhouse.length,0);
 const older=vm.runInContext('loadInventory(true)',inventory),resolveOlder=resolveFetch,newer=vm.runInContext('loadInventory(true)',inventory);resolveFetch({ok:true,json:async()=>({items:[]})});await newer;resolveOlder({ok:true,json:async()=>({items:[{fileName:'Old.jpg'}]})});await older;assert.equal(inventory.context.inhouse.length,0,'A delayed catalog request cannot undo explicit refresh');
 let bookReads=0,resolveBook,project='A';const ticket=()=>({key:project});
 const book=vm.createContext({context:{submissionId:'A'},saves:{pending:new Set()},bookRead:null,bookLoadedAt:0,bookSeq:0,projectReads:new AbortController(),projectTicket:ticket,projectCurrent:t=>t.key===project,AbortSignal,Date,view:'search',json:()=>{bookReads++;return new Promise(resolve=>resolveBook=resolve);},notifySelection:noop,els:{saveStatus:{}},paint:noop});
 vm.runInContext(fn('  async function loadBook(','  async function loadResearch('),book);
 const a=vm.runInContext('loadBook()',book),b=vm.runInContext('loadBook()',book);resolveBook({generation:'1',items:[]});await Promise.all([a,b]);await vm.runInContext('loadBook()',book);assert.equal(bookReads,1,'In-flight and recent lookbook reads are reused');
 const fresh=vm.runInContext('loadBook(true)',book);resolveBook({generation:'2',items:[]});await fresh;assert.equal(bookReads,2,'Explicit refresh/save reads bypass freshness');
 const stale=vm.runInContext('loadBook(true)',book);project='B';resolveBook({generation:'stale',items:[]});await stale;assert.equal(book.book.generation,'2','Late project results cannot replace the book');
 // Retained nodes are bounded, and private reset disposes every parked image.
 const parked=vm.createContext({view:'inhouse'});vm.runInContext(fn('  const parkedCards=','  const token ='),parked);let disposed=0;
 const cards=Array.from({length:30},(_,i)=>({_fabricSignature:String(i),_fabricView:'search',classList:{contains:()=>true},remove:noop,_fabricDispose:()=>disposed++}));
 for(const card of cards){parked.card=card;vm.runInContext('releaseCard(card)',parked);}assert.equal(vm.runInContext('parkedCards.size',parked),24);assert.equal(disposed,6);vm.runInContext('clearParkedCards()',parked);assert.equal(disposed,30);
 console.log('Fabric reuse: stable reopening, one inventory/book read, explicit refresh, stale-project rejection and bounded private photo retention passed.');
};

checks['shared-style-loading']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');const source=readFileSync('docs/aesthetics/ui/typography-controls.js','utf8');
 let calls=0,resolveFetch,now=100000;const events={};
 const c=vm.createContext({Date:{now:()=>now},local:false,location:{pathname:'/backend.html'},key:'design',channel:null,defaults:{type:{size:12}},normalize:structuredClone,fetch:()=>{calls++;return new Promise(resolve=>resolveFetch=resolve);},window:{addEventListener:(name,fn)=>events[name]=fn},document:{addEventListener:(name,fn)=>events[name]=fn}});
 vm.runInContext('let applications=0;function apply(v){applications++;currentDesign=v;revision++;}',c);
 vm.runInContext(source.slice(source.indexOf('  let revision='),source.indexOf('  window.MayaTypographyControls=')),c);
 const a=vm.runInContext('load()',c),b=vm.runInContext('load()',c);events.focus();resolveFetch({ok:true,json:async()=>({type:{size:12}})});await Promise.all([a,b]);assert.equal(calls,1);assert.equal(vm.runInContext('applications',c),1);
 events.focus();events.visibilitychange();assert.equal(calls,1,'Paired focus/visibility events do not refetch fresh settings');
 const same=vm.runInContext('load()',c);resolveFetch({ok:true,json:async()=>({type:{size:12}})});await same;assert.equal(vm.runInContext('applications',c),1,'Unchanged settings do not rebuild styles or broadcast layout work');
 const racing=vm.runInContext('load()',c);vm.runInContext('apply({type:{size:20}})',c);resolveFetch({ok:true,json:async()=>({type:{size:12}})});await racing;assert.equal(vm.runInContext('currentDesign.type.size',c),20,'A delayed read cannot undo a newer live edit');
 now+=31000;events.focus();events.visibilitychange();assert.equal(calls,4);resolveFetch({ok:true,json:async()=>({type:{size:22}})});await vm.runInContext('loadRequest',c);assert.equal(vm.runInContext('currentDesign.type.size',c),22);
 console.log('Shared CSS loading: one concurrent request, focus throttle, unchanged-style no-op and newer-edit protection passed.');
};

checks['incremental-image-watching']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');let scans=0,observer,bound=0;
 const c={window:{},document:{body:{},querySelectorAll:()=>{scans++;return [];}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}}};
 vm.runInNewContext(readFileSync('docs/aesthetics/ui/image-viewer.js','utf8'),c);c.window.MayaImageViewer.watch('img');
 for(let i=0;i<100;i++)observer([{addedNodes:[{nodeType:3}]}]);assert.equal(scans,1,'Text updates never scan the whole document');
 const image={nodeType:1,isConnected:true,matches:()=>true,querySelectorAll:()=>[],classList:{add:()=>bound++},setAttribute(){},addEventListener(){}};
 const wrapper={nodeType:1,isConnected:true,matches:()=>false,querySelectorAll:()=>[image]};image.parentElement=wrapper;
 observer([{addedNodes:[wrapper,image]}]);assert.equal(bound,1,'An added subtree binds its images once');observer([{addedNodes:[image]}]);assert.equal(bound,1,'Moving a retained photo does not rebind it');assert.equal(scans,1);
 console.log('Image watcher: added subtrees only; 100 caption mutations cause zero additional whole-page scans.');
};

checks['favorites-incremental-render']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');const source=readFileSync('frontend/index.html','utf8');let creations=0;
 const wrap={children:[],dataset:{},insertBefore(card,before){card.remove();this.children.splice(before?this.children.indexOf(before):this.children.length,0,card);}};
 const document={body:{classList:{toggle(){}}},getElementById:()=>wrap,createElement:tag=>{
  assert.equal(tag,'template');return {set innerHTML(value){creations++;const card={dataset:{id:value.match(/data-id="([^"]+)"/)[1]},caption:{textContent:value.match(/class="fc-summary">([^<]*)/)[1]},querySelector(){return this.caption;},remove(){const i=wrap.children.indexOf(this);if(i>=0)wrap.children.splice(i,1);}};this.content={firstElementChild:card};}};
 }};
 const c=vm.createContext({document,items:[{id:1,card:{favorited:true,image:'https://photos.test/one',caption:'First coat'}}],_buildPieceSummaryLine:f=>f.card.caption,escapeHtml:v=>v,SHOWCASE_VIDEO_ENABLED:false,location:{search:''}});
 vm.runInContext(source.slice(source.indexOf('function _renderFavoritesScroller()'),source.indexOf('// v9.12: open the standard image viewer')),c);
 vm.runInContext('_renderFavoritesScroller()',c);const original=wrap.children[0];
 c.items.push({id:2,card:{favorited:true,image:'https://photos.test/two',caption:'Second coat'}});vm.runInContext('_renderFavoritesScroller()',c);assert.equal(wrap.children[0],original);assert.equal(creations,2);
 c.items[0].card.caption='Updated coat';vm.runInContext('_renderFavoritesScroller()',c);assert.equal(wrap.children[0],original);assert.equal(original.caption.textContent,'Updated coat');assert.equal(creations,2);
 c.items.reverse();vm.runInContext('_renderFavoritesScroller()',c);assert.equal(wrap.children[1],original);c.items.shift();vm.runInContext('_renderFavoritesScroller()',c);assert.equal(wrap.children[0],original);assert.equal(creations,2);
 c.items[0].card.image='https://photos.test/replacement';vm.runInContext('_renderFavoritesScroller()',c);assert.notEqual(wrap.children[0],original);assert.equal(creations,3,'A genuinely changed image gets a fresh card');
 console.log('Favorites: additions, removals, reordering and caption changes retain photos; replacements update correctly.');
};

checks['fabric-refresh-preparation']=async function(){
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),source=readFileSync('docs/aesthetics/ui/fabric-assistant.js','utf8');
 const start=source.indexOf('  async function refreshView('),end=source.indexOf('  async function run(',start);let release,calls=0,current=true;
 const context=vm.createContext({els:{results:{querySelectorAll:()=>[]}},view:'search',context:{automatic:true,submissionId:'project',referenceImage:'saved-photo'},searchState:'complete',epoch:1,image:'',submittedRequest:'',current:()=>current,preparedPhoto:()=>new Promise(resolve=>{release=resolve;}),run:async()=>{calls++;},status(){}});
 vm.runInContext(source.slice(start,end),context);
 const first=vm.runInContext('refreshView()',context);assert.equal(calls,0,'Refresh has not sent a request while its saved image is being prepared');release('prepared-photo');await first;assert.equal(calls,1);
 context.image='';const stale=vm.runInContext('refreshView()',context);current=false;release('late-photo');await stale;assert.equal(calls,1,'A reset during preparation cancels that search');
 console.log('Fabric refresh: saved-image preparation precedes search; resetting early cancels it.');
};

checks['operation-single-drawing']=async function(){
 const {default:assert}=await import('node:assert/strict');
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs');const source=readFileSync('backend/operation-workspace.html','utf8');
 const fn=name=>{const start=source.search(new RegExp('(?:async )?function '+name+'\\('));return source.slice(start,source.indexOf('\n}',start)+2);};
 const gram={panels:[{label:'FRONT LEG',qty:2,mirror:true},{label:'BACK LEG',qty:2,mirror:true},{label:'WAISTBAND',qty:1}],components:[{label:'FRONT POCKET BAG',qty:2},{label:'POCKET FACING',qty:2}]};
 const context=vm.createContext({_patternSettings:{logic:{},type:'pants',passes:3,hits:5,prompt:''},LAST:{type:'pants'},LOGIC_TYPE:'pants',logicLocked:()=>false,getLogic:()=>gram.panels});
 for(const name of ['buildCutList','completeCutList','cutListLines','cutListTotal'])vm.runInContext(fn(name),context);
 context.gram=gram;context.g={type:'pants',components:['side seam pockets']};
 const cut=vm.runInContext('buildCutList(g,gram)',context);assert.equal(cut.length,5);context.cut=cut;
 const lines=vm.runInContext('cutListLines(cut)',context);assert.match(lines,/FRONT LEG LEFT: ONE separate outline, label CUT 1/);assert.match(lines,/FRONT LEG RIGHT: ONE separate outline, label CUT 1/);assert.match(lines,/POCKET FACING/);assert.equal(lines.split('\n').length,9);assert.doesNotMatch(lines,/×2/);
 context.g.components=['no pockets'];assert.equal(vm.runInContext('buildCutList(g,gram).length',context),3);
 context.g.components=['side pockets'];context._patternSettings.logic.pants=gram.panels;assert.equal(vm.runInContext('buildCutList(g,gram).length',context),3,'Explicit owner cut list stays authoritative');context._patternSettings.logic={};
 let drawings=0,saves=0,traces=0;const node={textContent:'',innerHTML:''};
 Object.assign(context,{HERO:'photo',EMB:{},RUN:1,_operationInputContext:null,ANSWER:null,FILES:{},KB:{chapters:{}},PASSES:[],BEST_IDX:0,_patternRun:{},window:{},structuredClone,console,
 operationAccount:()=> 'owner',operationContext:()=>({}),operationCurrent:()=>true,requireOperationSettings(){},requireOperation(){},patternGrammar:()=>({types:{pants:gram}}),classifyGarment:async()=>context.g,resolveType:()=> 'pants',renderLogic(){},renderGrammar(){},renderChunks(){},buildQuery:()=>'',embedTexts:async()=>[[1]],retrieve:()=>[],composeGroundedPrompt:()=> 'draw all cut pieces',getQuality:()=> 'medium',gptImageEdit:async()=>{drawings++;return 'pattern';},persistPatternWork:async()=>{saves++;},viewGrounded(){},liveOpen(){},liveLine(){},liveStatus(){},pipelineStep(){},pipelineFailed(){},cancelPatternTrace(){},buildSVGfromGrounded(){traces++;},$:()=>node,esc:v=>v,toast:m=>{throw Error(m);}});
 vm.runInContext(fn('runGrounded'),context);await vm.runInContext('runGrounded()',context);
 assert.equal(drawings,1,'Even an older three-pass setting cannot trigger another paid drawing');assert.equal(context.PASSES.length,1);assert.ok(saves>0);assert.equal(traces,0,'Drawing completion must not start CPU-heavy SVG tracing');
 console.log('Pattern generation: one drawing, saved output, explicit pocket pieces and non-doubled cutting labels passed.');
};

checks['pattern-trace-worker']=async function(){
 const {default:assert}=await import('node:assert/strict');
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),source=readFileSync('backend/operation-workspace.html','utf8');
 const images=[],workers=[],timers=new Map(),notices=[];let identity=1,sequence=0,mounted=0;
 const context=vm.createContext({operationContext:()=>identity,operationCurrent:stamp=>stamp===identity,PASSES:[],CUR:{kind:'svg'},BEST_IDX:0,TRACE:null,
 Image:class{constructor(){images.push(this);this.naturalWidth=3200;this.naturalHeight=2000;}},
 Worker:class{constructor(url){this.url=url;workers.push(this);}postMessage(data,transfer){this.data=data;this.transfer=transfer;}terminate(){this.terminated=true;}},
 document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:(x,y,width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})})})},
 $:()=>({classList:{remove(){}},src:''}),mountTrace:()=>mounted++,liveLine(){},toast:m=>notices.push(m),setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source.slice(source.indexOf('let _traceTask=null;'),source.indexOf('/* ============================ export')),context);
 vm.runInContext('buildSVGfromGrounded("first");buildSVGfromGrounded("first")',context);assert.equal(images.length,1,'Repeated SVG clicks share one pending trace');images[0].onload();assert.equal(workers.length,1);assert.equal(workers[0].data.width,1600);assert.equal(workers[0].transfer[0],workers[0].data.pixels);
 vm.runInContext('cancelPatternTrace()',context);assert.equal(workers[0].terminated,true);workers[0].onmessage({data:{svg:'stale'}});assert.equal(context.TRACE,null);
 vm.runInContext('buildSVGfromGrounded("second")',context);images[1].onload();identity++;workers[1].onmessage({data:{svg:'wrong garment'}});assert.equal(context.TRACE,null);
 vm.runInContext('buildSVGfromGrounded("third")',context);assert.equal(workers[1].terminated,true);images[2].onload();workers[2].onmessage({data:{svg:'<svg/>'}});assert.equal(context.TRACE.source,'third');assert.equal(mounted,1);assert.equal(workers[2].terminated,true);
 vm.runInContext('buildSVGfromGrounded("timeout")',context);images[3].onload();[...timers.values()][0]();assert.equal(workers[3].terminated,true);assert.match(notices.at(-1),/timed out/);
 console.log('SVG: worker transfer, size bound, deduplication, cancellation, account/garment isolation and timeout passed.');
};

checks['brief-fabric-navigation']=async function(){
 const {default:assert}=await import('node:assert/strict');
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs'),source=readFileSync('backend/backend.html','utf8');
 const fn=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);};
 let opened=0;const context=vm.createContext({_pieceState:{pieces:[{_virtual:true},{id:'coat'},{id:'pants'}],idx:1},_briefView:'fabrics',document:{querySelectorAll:()=>[]},showBriefItem:()=>{context._briefView='item';},showBriefFabrics:()=>{opened++;context._briefView='fabrics';},_showActivePiece(){},_syncOpRoom(){}});
 vm.runInContext(fn('setActivePiece'),context);vm.runInContext('setActivePiece(2)',context);assert.equal(opened,1);assert.equal(context._briefView,'fabrics');vm.runInContext('setActivePiece(0)',context);assert.equal(opened,1);assert.equal(context._briefView,'item');
 const toggle=source.match(/function toggleBriefFabrics\(\)\{[^\n]+\}/)[0];vm.runInContext(toggle,context);vm.runInContext('toggleBriefFabrics();toggleBriefFabrics()',context);assert.equal(context._briefView,'item');assert.equal(opened,2);
 console.log('Brief: item changes retain Fabrics; Full View and the Fabrics toggle return to the garment.');
};

checks['submission-descriptions']=async function(){
 const {default:assert}=await import('node:assert/strict');
 const {submissionDescription}=await import('../backend/server/submission-list.mjs');
 assert.equal(submissionDescription({_submissionCaption:'Emerald tracksuit with cream side stripes',design_ideas:[{idea:'Another garment'}]}),'Emerald tracksuit with cream side stripes');
 assert.equal(submissionDescription({design_ideas:[{idea:'Green hooded embroidered tailcoat'}]}),'Green hooded embroidered tailcoat');
 assert.equal(submissionDescription({description:'Submitted garment design',_paragraphs:{vision:'Black coat with gold trim'}}),'Black coat with gold trim');
 assert.equal(submissionDescription({}), '');
 console.log('Submission captions: authored text, legacy idea objects and honest empty fallback passed.');
};

checks['submission-drawer-reuse']=async function(){
 const {default:assert}=await import('node:assert/strict'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const source=readFileSync('backend/backend.html','utf8');let now=100000,owner='A',feeds=0,photos=0,creates=0,status=200,wait=null;
 const folders=[{id:'coat',files:[{id:'photo',name:'dream-garment.jpg'}]}],revoked=[];
 const list={children:[],dataset:{},replaceChildren(...nodes){this.children.forEach(c=>c.photo.isConnected=false);this.children=nodes;this._text='';},set textContent(v){this.replaceChildren();this._text=v;},get textContent(){return this._text||'';},insertBefore(card,before){const old=this.children.indexOf(card);if(old>=0)this.children.splice(old,1);const at=before?this.children.indexOf(before):this.children.length;this.children.splice(at,0,card);card.photo.isConnected=true;},querySelectorAll(){return this.children.map(c=>c.photo).filter(p=>!p.removed);}};
 const count={textContent:''},drawer={classList:{add(){}}};
 const context=vm.createContext({Date:{now:()=>now},DOMException,AbortSignal,URL:{createObjectURL:()=> 'blob:photo-'+photos,revokeObjectURL:u=>revoked.push(u)},
  _piecesAccount:t=>t,_subCachedTok:()=>owner,window:{addEventListener(){}},document:{getElementById:id=>({'clients-list':list,'clients-count':count,'clients-drawer':drawer}[id])},getMayaFolder:async()=>null,deleteBriefSubmission(){},
  MayaSubmissionCards:{unique:v=>v,create(folder){creates++;const photo={dataset:{thumb:folder.files[0].id},src:'',isConnected:false,getAttribute(){return this.src;},remove(){this.removed=true;}};const card={dataset:{submissionId:folder.id},photo,querySelector:()=>photo,remove(){const i=list.children.indexOf(this);if(i>=0)list.children.splice(i,1);photo.isConnected=false;}};return card;}},
  fetch:async url=>{if(url.startsWith('/api/admin/subthumb')){photos++;return {ok:true,blob:async()=>({})};}feeds++;if(wait)await wait;return {ok:status===200,status,json:async()=>({folders:structuredClone(folders)})};}
 });
 vm.runInContext(source.slice(source.indexOf('let _submissionFeed='),source.indexOf('async function _loadSubmission('))+'\n'+source.slice(source.indexOf('let _drawerListSequence='),source.indexOf('// v13.45: a click anywhere outside')),context);
 const run=code=>vm.runInContext(code,context),settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 // The Brief's feed and repeated opens share the same read and decoded photo.
 await run('submissionFeed("A")');await Promise.all([run('openClientsDrawer()'),run('openClientsDrawer()')]);await settle();
 const card=list.children[0],photo=card.photo;assert.equal(feeds,1);assert.equal(photos,1);assert.equal(list.textContent,'');
 await run('openClientsDrawer()');assert.equal(feeds,1);assert.equal(list.children[0],card);
 now+=61000;await run('openClientsDrawer()');assert.equal(feeds,2);assert.equal(photos,1);assert.equal(creates,1);assert.equal(list.children[0].photo,photo);
 now+=61000;status=503;await run('openClientsDrawer()');assert.equal(list.children[0],card,'Failed background refresh retains good cards');
 status=200;let release;wait=new Promise(resolve=>release=resolve);const old=run('openClientsDrawer()');await settle();
 owner='B';wait=null;await run('openClientsDrawer()');await settle();const next=list.children[0];assert.notEqual(next,card);assert.ok(revoked.includes(photo.src));
 release();await old;assert.equal(list.children[0],next,'Old account response cannot replace current cards');
 now+=61000;status=403;await run('openClientsDrawer()');assert.equal(list.children.length,0);assert.match(list.textContent,/Sign in/);
 status=200;owner='A';await run('openClientsDrawer()');await settle();
 now+=61000;wait=new Promise(resolve=>release=resolve);const pending=run('openClientsDrawer()');await settle();
 run('clearSubmissionDrawer()');folders.length=0;wait=null;await run('openClientsDrawer()');release();await pending;
 assert.equal(list.children.length,0,'Invalidated or deleted submissions cannot reappear from a late response');
 console.log('Submission drawer: shared feed, concurrent opens, retained cards/photos, refresh failure, account reset and deletion races passed.');
};

checks['backend-two-shell']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {document,Event}=parseHTML(readFileSync('backend/backend2.html','utf8'));
 const engine=parseHTML('<html><body><select id="test-picker"><option>Coat</option></select><div id="drawer"><section class="sec" id="pattern-settings"><label for="pattern-hits">Passages</label><input id="pattern-hits" value="5"><button id="test-save">Save</button><p id="pattern-save-status" role="status"></p><div id="pattern-history"><button>Old version</button></div></section></div></body></html>');
 const frame=document.getElementById('operations-embed');let edits=0,clicks=0,reads=0,flushed=0,historyClicks=0;
 let scope={sid:'project',account:'owner',local:1,hero:'photo'},garmentId='coat';
 Object.defineProperty(document,'activeElement',{value:null,writable:true,configurable:true});
 engine.document.getElementById('pattern-hits').addEventListener('input',()=>edits++);engine.document.getElementById('test-save').addEventListener('click',()=>clicks++);
 Object.defineProperty(frame,'contentDocument',{value:engine.document});Object.defineProperty(frame,'contentWindow',{value:{Event:engine.Event,postMessage(){},backendTwoContext:()=>({account:scope.account,submissionId:scope.sid,local:scope.local,revision:0,garmentId}),flushPatternBeforeNavigation:async()=>{flushed++;return true;}}});
 const listeners=new Map(),c=vm.createContext({document,location:{origin:'https://maya.test',href:''},queueMicrotask,URLSearchParams,
  _savedOperation:null,_operationsRevision:0,_piecesContext:()=>({...scope}),showBackendToast(){},_publishSavedOperations(){},_clearBriefPrivate(){},_postPiecesToOps(){},_updateBrandSub(){},goToScreen(){},toggleWorkspaceDrawer(){},showBriefFabrics(){},toggleBriefFabrics(){},showBriefItem(){},_briefView:'item',beginDissection(){},
  openClientsDrawer:async()=>reads++,toggleClientsDrawer(force){const d=document.getElementById('clients-drawer');d.classList.toggle('open',force===undefined?!d.classList.contains('open'):force);},
  addEventListener:(name,fn)=>listeners.set(name,fn),MayaFabricAssistant:{reset(){},open:async()=>{}}
 });c.window=c;vm.runInContext(readFileSync('docs/aesthetics/ui/backend-two.js','utf8'),c);
 assert.equal(document.getElementById('workspace-title').textContent,'Backend 2');
 assert.ok(document.querySelector('#backend-two-bio #op-biography'));assert.ok(document.querySelector('#backend-two-bio #op-measurements'));
 assert.ok(document.querySelector('#backend-two-submissions #clients-list'));assert.ok(document.querySelector('#backend-two-fabric-strip #brief-fabrics'));assert.equal(document.getElementById('screen-onepager').hidden,true);
 c.toggleWorkspaceDrawer();assert.equal(document.getElementById('clients-drawer').inert,false);assert.deepEqual([...document.querySelectorAll('.backend-two-tabs [role=tab]')].map(e=>e.getAttribute('aria-label')),['Submissions','Bio','Settings']);assert.equal(document.getElementById('backend-two-tab-submissions').getAttribute('aria-selected'),'true');
 document.getElementById('backend-two-tab-settings').click();assert.equal(document.getElementById('backend-two-settings').hidden,false);
 const field=document.getElementById('b2-setting-pattern-hits');assert.ok(field);field.value='8';field.dispatchEvent(new Event('input',{bubbles:true}));assert.equal(engine.document.getElementById('pattern-hits').value,'8');assert.equal(edits,1);
 document.getElementById('b2-setting-test-save').click();assert.equal(clicks,1);
 document.activeElement=field;
 engine.document.getElementById('pattern-save-status').textContent='Save failed. Retry.';
 engine.document.getElementById('test-save').hidden=true;
 const history=engine.document.getElementById('pattern-history'),newVersion=engine.document.createElement('button');newVersion.textContent='New version';newVersion.onclick=()=>historyClicks++;history.replaceChildren(newVersion);
 listeners.get('message')({origin:c.location.origin,source:frame.contentWindow,data:{maya:'backend-two-settings',account:scope.account,submissionId:scope.sid,local:scope.local,revision:0}});
 assert.equal(document.getElementById('b2-setting-pattern-hits'),field,'Focused input stays mounted during save updates');
 assert.equal(document.getElementById('b2-setting-pattern-save-status').textContent,'Save failed. Retry.');
 assert.equal(document.getElementById('b2-setting-test-save').hidden,true,'Save updates synchronize control visibility');
 document.querySelector('#b2-setting-pattern-history button').click();assert.equal(historyClicks,1,'Refreshed history is wired to current engine buttons');
 scope={...scope,local:2};field.value='99';field.dispatchEvent(new Event('input',{bubbles:true}));assert.equal(edits,1,'A stale mirror cannot write into a later project generation');scope={...scope,local:1};document.activeElement=null;
 garmentId='pants';field.dispatchEvent(new Event('input',{bubbles:true}));assert.equal(edits,1,'A stale mirror cannot edit the newly selected garment before its message arrives');garmentId='coat';

 document.getElementById('backend-two-tab-submissions').click();assert.equal(reads,2);assert.equal(document.getElementById('backend-two-settings').hidden,true);
 c.toggleWorkspaceDrawer();assert.equal(document.getElementById('clients-drawer').inert,true);
 await c.openBackendTwoSubmission({id:'project-B',name:'Second'});assert.equal(flushed,1);assert.match(c.location.href,/^\/backend2.html\?submission=project-B/);
 frame.contentWindow.flushPatternBeforeNavigation=async()=>false;c.location.href='unchanged';await c.openBackendTwoSubmission({id:'project-C'});assert.equal(c.location.href,'unchanged','Failed settings saves block submission navigation');
 let release;frame.contentWindow.flushPatternBeforeNavigation=()=>new Promise(resolve=>release=resolve);
 const old=c.openBackendTwoSubmission({id:'project-D'});scope={...scope,account:'next-owner'};release(true);await old;assert.equal(c.location.href,'unchanged','Account changes cancel pending submission navigation');
 const waiting=[];frame.contentWindow.flushPatternBeforeNavigation=()=>new Promise(resolve=>waiting.push(resolve));
 const first=c.openBackendTwoSubmission({id:'older'}),latest=c.openBackendTwoSubmission({id:'latest'});waiting[1](true);await latest;waiting[0](true);await first;assert.match(c.location.href,/submission=latest/,'Only the latest submission click navigates');
 listeners.get('message')({origin:c.location.origin,source:frame.contentWindow,data:{maya:'backend-two-open-settings',account:scope.account,submissionId:scope.sid,local:scope.local,revision:0,open:true}});
 assert.equal(document.getElementById('backend-two-settings').hidden,false,'Engine settings requests open the parent drawer');
 console.log('Backend 2: snapshot DOM, drawer tabs, engine-backed settings and failed-save navigation passed without a browser.');
};

checks['original-operation']=async function(){
 const {default:assert}=await import('node:assert/strict'),{parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const html=readFileSync('backend/operation-workspace.html','utf8'),adapter=readFileSync('docs/aesthetics/ui/original-operation.js','utf8');
 function fixture(search=''){
  const {document,Event}=parseHTML(html);let traces=0,invalidations=0,blurs=0,lastTraceSource='';
  const c=vm.createContext({document,Event,URLSearchParams,location:{search},EMBEDDED:true,PASSES:[{img:'saved-pattern',acc:{design:90,measure:85}}],TRACE:null,RD:null,ANSWER:null,RUNNING:false,
   $:id=>document.getElementById(id),cancelPatternTrace(){},mountTrace(){},buildSVGfromGrounded(){traces++;lastTraceSource=document.getElementById('img-grounded').getAttribute('src');},setOperationRunning(value){c.RUNNING=value;},
   invalidateOperation(){invalidations++;c.PASSES=[];c.applyView();}
  });c.window=c;
  vm.runInContext(html.slice(html.indexOf("let CUR = {kind:'grounded'"),html.indexOf('/* ============================ test harness')).replace('let ANSWER = null;',''),c);
  document.getElementById('test-picker').blur=()=>blurs++;
  vm.runInContext(adapter,c);
  return {c,document,Event,counts:()=>({traces,invalidations,blurs,lastTraceSource})};
 }
 const {c,document,Event,counts}=fixture(),stage=document.getElementById('stage'),logic=document.getElementById('original-operation-logic'),host=document.getElementById('pass-pills');
 const tab=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
 assert.equal(logic.parentElement,stage);assert.equal(document.querySelector('#plan-a-view > .trace'),null);assert.equal(logic.querySelector('h3').textContent,'Logic');
 assert.ok(logic.querySelector('#live-log'));assert.ok(logic.querySelector('#t-chunks'));assert.ok(logic.querySelector('#t-prompt'));assert.equal(logic.hidden,true);
 assert.deepEqual([...host.querySelectorAll('button')].map(b=>b.textContent),['Mark 1','Logic','SVG']);
 const logicTab=tab('Logic');logicTab.click();assert.equal(logic.hidden,false);assert.equal(vm.runInContext('CUR.kind',c),'logic');assert.equal(document.getElementById('stage-empty').style.display,'none');assert.equal(counts().traces,0,'Logic must never start SVG or paid generation');
 assert.equal(document.getElementById('img-grounded').style.display,'none');assert.ok(document.getElementById('trace-view').classList.contains('off'));
 c.setOperationRunning(true);assert.ok(logic.classList.contains('is-running'));c.viewGrounded(0);c.viewRD();assert.equal(vm.runInContext('CUR.kind',c),'logic','Internal pipeline views preserve a selected Logic tab');
 document.getElementById('img-grounded').removeAttribute('src');c.TRACE={source:'old-pattern'};c.PASSES=[{img:'new-pattern'}];c.viewGrounded(0);c.setOperationRunning(false);assert.equal(logic.hidden,false);assert.equal(logic.classList.contains('is-running'),false);assert.equal(tab('Logic'),logicTab,'Progress updates keep focus targets mounted');
 assert.equal(c.TRACE,null,'A new drawing invalidates the earlier SVG even while Logic is open');tab('SVG').click();assert.equal(counts().lastTraceSource,'new-pattern','Logic can open the new SVG directly without visiting Mark 1');tab('Logic').click();
 tab('Mark 1').click();assert.equal(logic.hidden,true);assert.equal(document.getElementById('img-grounded').getAttribute('src'),'new-pattern');
 const beforeSVG=counts().traces;tab('SVG').click();assert.equal(counts().traces,beforeSVG+1);assert.equal(logic.hidden,true);tab('Logic').click();assert.equal(counts().traces,beforeSVG+1,'Returning to Logic does not retrace');
 let focused=false;tab('SVG').focus=()=>focused=true;const key=new Event('keydown',{cancelable:true});key.key='ArrowRight';logicTab.dispatchEvent(key);assert.equal(focused,true);assert.equal(vm.runInContext('CUR.kind',c),'svg');assert.equal(key.defaultPrevented,true);
 c.PASSES=[{img:'old-1'},{img:'old-2'}];c.renderPassPills();assert.ok(tab('Mark 2'),'Historical saved passes remain accessible');tab('Mark 2').click();assert.equal(document.getElementById('img-grounded').getAttribute('src'),'old-2');
 tab('Logic').click();c.invalidateOperation();assert.equal(counts().invalidations,1);assert.equal(logic.hidden,true);assert.equal(vm.runInContext('CUR.kind',c),'grounded');
 c.viewRD();assert.equal(tab('Mark 1').getAttribute('aria-selected'),'true');assert.equal(tab('Mark 1').getAttribute('tabindex'),'0','Internal redraw cannot remove every tab from keyboard navigation');
 const picker=document.getElementById('test-picker');picker.dispatchEvent(new Event('pointerdown'));picker.dispatchEvent(new Event('change'));assert.equal(counts().blurs,1,'Pointer selection releases its native focus ring');
 picker.dispatchEvent(new Event('pointerdown'));picker.dispatchEvent(new Event('keydown'));picker.dispatchEvent(new Event('change'));assert.equal(counts().blurs,1,'Keyboard selection retains accessible focus');
 const clone=fixture('?layout=backend2');assert.ok(clone.document.querySelector('#plan-a-view > .trace'));assert.equal(clone.document.getElementById('original-operation-logic'),null);assert.equal(clone.document.documentElement.classList.contains('original-operation'),false);
 console.log('Original Operation Room: integrated Logic, stable live updates, lazy SVG, legacy marks, identity reset and pointer/keyboard focus passed.');
};

checks['backend-two-operation']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {document,MutationObserver}=parseHTML(readFileSync('backend/operation-workspace.html','utf8'));
 // Linkedom exposes select.value as a getter; browsers also provide the setter.
 const picker=document.getElementById('test-picker');Object.defineProperty(picker,'value',{value:'',writable:true});
 let pendingPick=null;const notices=[],context={account:'owner',submissionId:'project',local:1,referenceImage:'data:image/png;base64,ZnVsbA=='};
 const c=vm.createContext({document,MutationObserver,URLSearchParams,location:{search:'?layout=backend2',origin:'https://maya.test'},EMBEDDED:true,RUNNING:false,_operationRevision:0,_patternNavigation:0,queueMicrotask,syncPlan(){},toggleDrawer(){},
  $:id=>document.getElementById(id),parent:{postMessage:data=>notices.push(data)},operationAccount:()=> 'owner',operationSubmission:()=> 'project',FILES:{},TESTS:{},ACTIVE_TEST:null,_operationInputContext:context,
  renderPassPills(){},setOperationRunning(value){c.RUNNING=value;},syncPatternSettings(){},lockPatternSettings(){},renderPatternHistory(){},viewGrounded(){},initTests(){picker.innerHTML='<option>waiting for pieces…</option>';},
  showView(){document.getElementById('hero-img').src=c.FILES.front;},
  pickTest(name){c.ACTIVE_TEST=name;c.FILES=c.TESTS[name];},
  async onPickTest(name){const navigation=++c._patternNavigation;if(pendingPick)await pendingPick;if(navigation===c._patternNavigation)c.pickTest(name);},
  installOperationContext(next){c._operationInputContext=next;c.TESTS={Coat:{front:'data:image/png;base64,Y29hdA==',piece:{id:'coat'}}};picker.innerHTML='<option value="Coat">Coat</option>';c.pickTest('Coat');}
 });c.window=c;vm.runInContext(readFileSync('docs/aesthetics/ui/backend-two-operation.js','utf8'),c);
 c.installOperationContext(context);assert.equal(picker.value,'__full__');assert.equal(document.getElementById('hero-img').getAttribute('src'),context.referenceImage);
 assert.equal(picker.querySelector('optgroup').label,'Dissected view');assert.equal(c.FILES.piece.id,'coat','Full view does not replace the active pattern input');
 await c.onPickTest('Coat');assert.equal(picker.value,'Coat');assert.equal(document.getElementById('hero-img').getAttribute('src'),c.FILES.front);
 assert.deepEqual([...document.querySelectorAll('#pass-pills [role=tab]')].map(b=>b.textContent),['Pattern','CLO 3D','Pipeline']);
 document.getElementById('backend-two-clo-tab').click();assert.equal(document.getElementById('backend-two-clo').hidden,false);assert.equal(document.getElementById('stage').hidden,true);
 document.getElementById('backend-two-pipeline-tab').click();assert.equal(document.getElementById('backend-two-clo').hidden,true);assert.equal(document.getElementById('stage').hidden,true);assert.equal(document.getElementById('backend-two-pipeline').hidden,false);
 assert.ok(document.querySelector('#backend-two-pipeline #t-chunks'));assert.ok(document.querySelector('#backend-two-pipeline #live-log'));
 const patternTab=document.getElementById('backend-two-pattern-tab');
 c.setOperationRunning(true);assert.equal(document.querySelector('.backend-two-pipeline-dot').classList.contains('running'),true);
 assert.equal(document.getElementById('backend-two-pattern-tab'),patternTab,'Live updates retain keyboard focus targets');
 c.setOperationRunning(false);assert.equal(document.querySelector('.backend-two-pipeline-dot').classList.contains('running'),false);
 document.getElementById('backend-two-pattern-tab').click();assert.equal(document.getElementById('stage').hidden,false);
 await c.onPickTest('__full__');assert.equal(document.getElementById('hero-img').getAttribute('src'),context.referenceImage);assert.equal(c.FILES.piece.id,'coat');
 let finishPick;pendingPick=new Promise(resolve=>finishPick=resolve);
 const selecting=c.onPickTest('Coat');await c.onPickTest('__full__');finishPick();await selecting;pendingPick=null;
 assert.equal(picker.value,'__full__','A later Full view choice cancels an earlier pending garment choice');assert.equal(document.getElementById('hero-img').getAttribute('src'),context.referenceImage);
 document.getElementById('plan-a-view').style.display='none';document.getElementById('plan-b-view').style.display='';c.syncPlan();assert.equal(document.getElementById('plan-a-view').style.display,'');assert.equal(document.getElementById('plan-b-view').style.display,'none');
 c.toggleDrawer(true);assert.ok(notices.some(n=>n.maya==='backend-two-open-settings'&&n.open&&n.local===1));
 const noticeCount=notices.length;document.getElementById('pattern-save-status').textContent='Save failed';await Promise.resolve();assert.ok(notices.slice(noticeCount).some(n=>n.maya==='backend-two-settings'),'Direct save failures refresh the mirrored settings');
 c.initTests();assert.ok(picker.querySelector('option[value="__full__"]'),'Initialization and account reset retain Full view');
 assert.ok(notices.some(n=>n.garmentId==='coat'));
 console.log('Backend 2: full/dissected images, stable pattern input, Pipeline/Mark 1 and running indicator passed without a browser.');
};

checks['studio-favorites-client']=async function(){
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const source=readFileSync('docs/aesthetics/ui/fabric-assistant.js','utf8');
 let owner='A',writes=0,state={items:[],generation:'0'},failRead=false,releasePost;
 const c=vm.createContext({structuredClone,AbortSignal,account:()=>owner,window:{addEventListener(){}},els:{saveStatus:{textContent:''}},paint(){},json:async(url,options)=>{
  assert.equal(url,'/api/admin/fabrics/favorites');
  if(options?.method==='POST'){writes++;const body=JSON.parse(options.body);assert.equal(body.generation,state.generation);if(releasePost)await new Promise(resolve=>releasePost=resolve);state={items:body.action==='save'?[body.product]:[],generation:String(Number(state.generation)+1)};}
  else if(failRead)throw Error('Unavailable');
  return structuredClone(state);
 }});
 vm.runInContext(source.slice(source.indexOf('  let favorites='),source.indexOf('  let bookRead=')),c);
 await vm.runInContext('loadFavorites()',c);c.product={url:'https://cloth.example/wool',title:'Wool'};
 await vm.runInContext('toggleFavorite(product)',c);assert.equal(writes,1);assert.equal(vm.runInContext('favorites.items.length',c),1);
 owner='B';await vm.runInContext('loadFavorites(true)',c);assert.equal(vm.runInContext('favorites.items[0].url',c),c.product.url);
 failRead=true;await vm.runInContext('loadFavorites(true)',c);assert.equal(vm.runInContext('favorites.items.length',c),1,'Failed reads retain saved fabrics');failRead=false;
 releasePost=true;const pending=vm.runInContext('toggleFavorite(product)',c);await Promise.resolve();await Promise.resolve();vm.runInContext('toggleFavorite(product)',c);assert.equal(writes,2,'Repeated clicks are deduplicated');
 while(typeof releasePost!=='function')await Promise.resolve();releasePost();await pending;assert.equal(vm.runInContext('favorites.items.length',c),0);
 assert.match(c.els.saveStatus.textContent,/Removed/);
 console.log('Studio favorites client: shared reads, heart save/remove, failed-read retention and duplicate-click suppression passed.');
};

checks['clo-assets']=async function(){
 const {createDigitalAssets,cloResults,cloSearchBody,cloListingURL,createCloQueue,mountDigitalAssets}=await import('../backend/server/digital-assets.mjs');
 const {default:assert}=await import('node:assert/strict');
 const urls=['https://connect.clo-set.com/detail/e13b408cb5854b768e0fe22df9f4be98','https://connect.clo-set.com/detail/c6c2de5fb82842e2936735ce05fe912a'];
 const output={id:'response-test',status:'completed',output:[{type:'web_search_call',results:[{type:'image_result',source_website_url:urls[0],image_url:'https://images.example.com/garment.jpg',caption:'Wrap dress'},{type:'source_result',url:urls[1],title:'Corset dress'},{type:'source_result',url:'https://connect.clo-set.com/explore/guide',title:'Not an asset'}]},{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{url:'https://connect.clo-set.com/detail/'+ 'a'.repeat(32),title:'Invented'},{url:urls[1],title:'Corset dress',price:10,currency:'USD'},{url:urls[0],title:'Wrap dress',match:'Similar shape',price:0,currency:'USD',priceType:'free',formats:['zprj'],patternStatus:'editable',physicalProduction:'allowed',factsEvidence:'Listing reports free project with editable panels and production permission.'},{url:urls[0]}]})}]}]};
 assert.equal(cloListingURL('https://connect.clo-set.com.evil.test/detail/'+ 'a'.repeat(32)),'');assert.equal(cloListingURL('javascript:alert(1)'),'');
 const items=cloResults(output);assert.equal(items.length,2);assert.equal(items[0].url,urls[1],'OpenAI order is retained');assert.equal(items[0].price,null,'Unsupported facts remain unknown');assert.equal(items[1].price,0);assert.equal(items[1].priceType,'free');assert.equal(items[1].image,'https://images.example.com/garment.jpg');
 assert.throws(()=>cloResults({...output,status:'incomplete'}),/stopped/);assert.throws(()=>cloResults({status:'completed',output:[]}),/could not/);
 const request=cloSearchBody({image:'data:image/png;base64,YQ==',garment:{category:'dress'},preferences:'',garmentId:'dress'});assert.equal(request.max_tool_calls,1);assert.deepEqual(request.tools[0].filters.allowed_domains,['connect.clo-set.com']);assert.equal(request.store,false);
 let generation=0,deleted=false,readFailure='',providerCalls=0,provider=null,now=10000;
 const files=new Map(),seed=(path,data,type='application/json')=>files.set(path,{buf:Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data)),type,generation:String(++generation)});
 const prefix='submissions/test-sub/';seed(prefix+'submission.json',{openedBy:'owner@example.com'});seed(prefix+'summary.json',{fabric_preferences:'cotton',email:'private@example.com',_measurements:{waist:32}});seed(prefix+'dream-garment.png',Buffer.from('image'),'image/png');
 seed(prefix+'pieces.json',{pieces:[{id:'coat',name:'Coat',_image:'data:image/png;base64,YQ=='}]});
 const deps={read:async path=>{if(path===readFailure)return {ok:false,status:503};const value=files.get(path);return value?{ok:true,...value}:{ok:false,status:404};},write:async(path,buf,type,expected)=>{if(String(files.get(path)?.generation||'0')!==expected)throw Object.assign(Error('conflict'),{status:412});seed(path,buf,type);return {generation:files.get(path).generation};},assertActive:async()=>{if(deleted)throw Object.assign(Error('Deleted'),{status:410});},apiKey:()=> 'fixture',now:()=>now,fetchImpl:async(_url,options)=>{providerCalls++;const body=JSON.parse(options.body);assert.ok(!JSON.stringify(body).includes('private@example.com'));assert.ok(!JSON.stringify(body).includes('waist'));if(provider)return provider(options);return Response.json(output);}};
 const service=createDigitalAssets(deps),user={sub:'admin-A'};
 // Sourcing is prepared by the server when the final canonical input lands,
 // including larger PNGs accepted by the existing submission upload endpoint.
 const uploadPrefix='submissions/upload-sub/',uploadTasks=[];
 seed(uploadPrefix+'submission.json',{openedBy:'owner@example.com'});seed(uploadPrefix+'dream-garment.png',Buffer.alloc(5*1024*1024,1),'image/png');
 const uploadService=createDigitalAssets({...deps,queue:{ready:()=>true,enqueue:async job=>uploadTasks.push(job)}});
 assert.equal((await uploadService.uploaded('upload-sub','dream-garment.png')).status,'waiting');assert.equal(uploadTasks.length,0);
 assert.equal((await uploadService.uploaded('upload-sub','one-pager.pdf')).status,'irrelevant');
 seed(uploadPrefix+'summary.json',{fabric_preferences:'cotton'});
 const uploaded=await Promise.all([uploadService.uploaded('upload-sub','summary.json'),uploadService.uploaded('upload-sub','dream-garment.png')]);
 assert.ok(uploaded.every(r=>r.queued));assert.equal(new Set(uploadTasks.map(t=>t.attempt)).size,1,'Concurrent uploads reuse one paid-search attempt');assert.equal(providerCalls,0);
 assert.ok((await uploadService.snapshot('upload-sub')).image.length>6*1024*1024,'Accepted large submission images remain sourceable');
 for(const path of [...files.keys()])if(path.startsWith(uploadPrefix))files.delete(path);
 const queued=await service.schedule('test-sub');assert.equal(queued.queued,false);assert.equal(providerCalls,0,'Preparing work does not pay without a worker');
 let pending=await service.prepare('test-sub');await Promise.all([service.execute('test-sub','',pending.attempt),service.execute('test-sub','',pending.attempt)]);assert.equal(providerCalls,1,'A generation-checked claim prevents duplicate paid work');
 let state=await service.view(user,'test-sub');assert.equal(state.status,'complete');assert.equal(state.items.length,2);await service.prepare('test-sub');await service.view(user,'test-sub');assert.equal(providerCalls,1,'Reopening is read-only');
 await assert.rejects(service.prepare('test-sub','missing'),/saved dissection/);
 state=await service.saveReview(user,{submissionId:'test-sub',action:'select',url:urls[0],generation:state.review.generation,fingerprint:state.fingerprint});assert.equal(state.review.selected.url,urls[0]);assert.equal((await service.view({sub:'admin-B'},'test-sub')).review.selected,null);
 await assert.rejects(service.saveReview(user,{submissionId:'test-sub',action:'dismiss',url:urls[0],generation:'0',fingerprint:state.fingerprint}),/changed/);
 state=await service.saveReview(user,{submissionId:'test-sub',action:'dismiss',url:urls[0],generation:state.review.generation,fingerprint:state.fingerprint});assert.deepEqual(state.review.dismissed,[urls[0]]);assert.equal(state.review.selected,null);
 readFailure=prefix+'digital-assets/research/look.json';await assert.rejects(service.prepare('test-sub'),/unavailable/);readFailure='';
 seed(prefix+'dream-garment.png',Buffer.from('changed image'),'image/png');pending=await service.prepare('test-sub');state=await service.view(user,'test-sub');assert.equal(state.stale,true,'Preserved old results remain stale during new work');
 await assert.rejects(service.saveReview(user,{submissionId:'test-sub',action:'select',url:urls[0],generation:state.review.generation,fingerprint:state.fingerprint}),/changed/);
 provider=async()=>new Response('',{status:503});await assert.rejects(service.execute('test-sub','',pending.attempt),/stopped/);const calls=providerCalls;await service.execute('test-sub','',pending.attempt);assert.equal(providerCalls,calls,'Failed and uncertain requests are never retried automatically');
 state=await service.view(user,'test-sub');provider=null;pending=await service.prepare('test-sub','',{force:true,generation:state.generation});await service.execute('test-sub','',pending.attempt);assert.equal((await service.view(user,'test-sub')).stale,false);
 let resolve;provider=()=>new Promise(r=>resolve=r);state=await service.view(user,'test-sub');pending=await service.prepare('test-sub','',{force:true,generation:state.generation});const late=service.execute('test-sub','',pending.attempt);while(!resolve)await Promise.resolve();deleted=true;resolve(Response.json(output));await assert.rejects(late,/Deleted|deleted/);deleted=false;assert.notEqual((await service.load('test-sub')).status,'complete','Late results cannot complete after deletion');
 // A request that ignores abort is still bounded and leaves a durable failed claim.
 provider=()=>new Promise(()=>{});const short=createDigitalAssets({...deps,timeoutMs:20});state=await short.load('test-sub');now+=100000;pending=await short.prepare('test-sub','',{force:true,generation:state.generation});const keep=setTimeout(()=>{},200);await assert.rejects(short.execute('test-sub','',pending.attempt),/stopped/);clearTimeout(keep);assert.equal((await short.load('test-sub')).status,'failed');
 const tasks=[];const config={queue:'projects/pro-maya/locations/us-west1/queues/clo-assets',origin:'https://maya-api-example.us-west1.run.app',email:'worker@example.com',audience:'https://maya-api-example.us-west1.run.app'};
 const queue=createCloQueue({config,token:async()=> 'fixture',fetchImpl:async(url,options)=>{tasks.push(JSON.parse(options.body).task);return new Response('',{status:409});}});assert.equal(queue.ready(),true);await queue.enqueue({submissionId:'test-sub',garmentId:'coat',attempt:'attempt'});await queue.enqueue({submissionId:'test-sub',garmentId:'coat',attempt:'attempt'});assert.equal(tasks[0].name,tasks[1].name);assert.equal(tasks[0].httpRequest.oidcToken.audience,config.origin);assert.match(tasks[0].httpRequest.url,/api\/tasks\/clo-assets$/);
 // Route authorization rejects clients before exposing research or scheduling another owner's submission.
 const routes=new Map(),app={get:(p,...handlers)=>routes.set(p,handlers.at(-1)),post:(p,...handlers)=>routes.set(p,handlers.at(-1))};
 mountDigitalAssets(app,{service,requireAuthHeader(){},json:()=>()=>{},requireAdmin:async()=>{throw Object.assign(Error('denied'),{status:403});},requireUser:async()=>({email:'other@example.com'}),ownerOf:async()=> 'owner@example.com',verifyWorker:async()=>{throw Object.assign(Error('denied'),{status:401});},rateLimit:()=>({ok:true})});
 const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;},set(){return this;},on(){}};
 await routes.get('/api/admin/digital-assets/research')({query:{submissionId:'test-sub'}},res);assert.equal(res.code,403);
 await routes.get('/api/submissions/clo-ready')({body:{submissionId:'test-sub'}},res);assert.equal(res.code,403);
 await routes.get('/api/tasks/clo-assets')({body:{}},res);assert.equal(res.code,401);
 console.log('CLO: sourced ranking, zero prices, canonical inputs, claims, account reviews, stale work, failed reads, deletion, deadlines, worker scope and duplicate dispatch passed.');
};

checks['clo-assets-client']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{default:assert}=await import('node:assert/strict');
 const {document}=parseHTML('<html><body><section id="clo"></section></body></html>');
 const c=vm.createContext({document,URL,URLSearchParams,AbortController,Date,setTimeout,clearTimeout,console});c.window=c;vm.runInContext(readFileSync('docs/aesthetics/ui/clo-assets.js','utf8'),c);
 let context={account:'A',submissionId:'sub-one',garmentId:'coat'},token='A',calls=[],resolveOld=null;
 const item={url:'https://connect.clo-set.com/detail/e13b408cb5854b768e0fe22df9f4be98',title:'Wrap dress',price:0,priceType:'free',formats:['zprj'],patternStatus:'editable',physicalProduction:'unknown'};
 let saved={status:'complete',generation:'1',fingerprint:'one',items:[item],review:{generation:'0',selected:null,dismissed:[]},searchReady:true};
 const host=document.getElementById('clo'),ui=c.MayaCloAssets.create({host,getContext:()=>context,getToken:()=>token,fetchImpl:async(url,options)=>{calls.push({url,options});if(resolveOld===true)return new Promise(resolve=>resolveOld=resolve);const body=options.body&&JSON.parse(options.body);if(body?.action==='select')saved={...saved,review:{...saved.review,generation:'1',selected:{...item,fingerprint:'one'}}};return {ok:true,json:async()=>structuredClone(saved)};}});
 const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};ui.update();assert.equal(calls.length,0);ui.setActive(true);await settle();assert.equal(calls.length,1);assert.ok(calls[0].url.includes('research?'));assert.match(host.textContent,/Free/);assert.equal(host.querySelectorAll('.clo-card').length,1);
 const select=[...host.querySelectorAll('button')].find(b=>b.textContent==='Select');await select.onclick();assert.match(host.querySelector('.clo-selection').textContent,/Selected reference/);assert.equal(JSON.parse(calls.at(-1).options.body).generation,'0');
 ui.setActive(false);ui.setActive(true);await settle();assert.equal(calls.filter(c=>c.url.endsWith('/search')).length,0,'Tab changes never pay');
 resolveOld=true;context={...context,garmentId:'pants'};ui.update();await settle();assert.equal(typeof resolveOld,'function');const completeOld=resolveOld;resolveOld=null;context={account:'B',submissionId:'sub-two',garmentId:'dress'};token='B';saved={...saved,items:[],review:{generation:'0',selected:null,dismissed:[]}};ui.update();await settle();completeOld({ok:true,json:async()=>({status:'complete',items:[item],review:{dismissed:[]}})});await settle();assert.equal(host.querySelectorAll('.clo-card').length,0,'Old account and garment results cannot reappear');
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer B');ui.reset();assert.equal(host.querySelectorAll('.clo-card').length,0);
 console.log('CLO UI: saved-only opening, free prices, private selection, tab reuse and stale account/garment responses passed.');
};

checks['clo-preview-evidence']=async function(){
 const {cloResults,cloSearchBody}=await import('../backend/server/digital-assets.mjs');
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs'),{default:assert}=await import('node:assert/strict');
 const url='https://connect.clo-set.com/detail/e13b408cb5854b768e0fe22df9f4be98';
 const images=['https://images.example.com/asset.jpg','https://images.example.com/thumb.jpg','https://images.example.com/alternate.jpg'];
 const result=cloResults({status:'completed',output:[{type:'web_search_call',results:[{type:'image_result',source_website_url:url,image_url:images[0],thumbnail_url:images[1],caption:'Jacket'},{type:'source_result',url,image_url:images[2]},{type:'source_result',url:'https://connect.clo-set.com/detail/'+ 'b'.repeat(32),image_url:'http://localhost/private'}]},{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',url,title:'Jacket'}],text:JSON.stringify({items:[{url,title:'Jacket',image_url:'https://invented.example.com/not-evidence.jpg'},{url:'https://connect.clo-set.com/detail/'+ 'b'.repeat(32),image_url:images[0]}]})}]}]});
 assert.deepEqual(result[0].imageCandidates,images,'Image and text source evidence preserve paired preview alternatives');assert.equal(result[0].image,images[0]);assert.equal(result[1].image,'','Model JSON and unsafe source photos cannot invent a preview');
 const request=cloSearchBody({garment:{},image:'data:image/png;base64,YQ==',preferences:''});assert.match(request.instructions,/Use web image search/);assert.equal(request.max_tool_calls,1,'Preview sourcing stays within the original single provider call');
 const {document,Event}=parseHTML('<html><head></head><body><section id="clo"></section></body></html>');
 const c=vm.createContext({document,URL,URLSearchParams,AbortController,Date,setTimeout,clearTimeout,console,matchMedia:()=>({matches:true})});c.window=c;vm.runInContext(readFileSync('docs/aesthetics/ui/clo-assets.js','utf8'),c);
 const state={status:'complete',generation:'1',fingerprint:'scope',items:result,review:{generation:'0',selected:null,dismissed:[]},searchReady:true};let calls=0;
 const host=document.getElementById('clo'),ui=c.MayaCloAssets.create({host,getContext:()=>({account:'A',submissionId:'sub-one'}),getToken:()=> 'token',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>state};}});ui.setActive(true);for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(document.querySelectorAll('#maya-clo-assets-style').length,1);assert.equal(calls,1,'Opening only reads saved research');
 const card=host.querySelector('.clo-card'),img=card.querySelector('img');assert.equal(img.src,images[0]);img.onerror();assert.equal(img.src,images[1]);img.onerror();assert.equal(img.src,images[2]);img.onerror();assert.ok(card.classList.contains('has-missing-photo'));assert.match(card.querySelector('.clo-photo').textContent,/Preview unavailable/);assert.ok(card.querySelector('.clo-caption .clo-title'));assert.equal(card.querySelector('.clo-title').dataset.mayaType,'P1');
 assert.equal(card.querySelector('.clo-card-actions button').getAttribute('aria-label'),'Select Jacket');assert.ok(card.querySelector('.clo-card-actions svg'));
 card.focus=()=>{};const click=new Event('click',{bubbles:true,cancelable:true});card.querySelector('.clo-photo').dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.ok(card.classList.contains('is-revealed'),'First touch reveals source details rather than unexpectedly navigating');
 assert.match(host.querySelector('.clo-status').textContent,/Refresh to search for missing previews/);assert.equal(calls,1,'Image failures do not trigger another paid search');ui.reset();
 console.log('CLO previews: sourced alternatives, unsafe/invented image rejection, thumbnail fallbacks, hover/focus card structure and touch reveal passed.');
};


checks['pattern-pipeline-state']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const html=readFileSync('backend/operation-workspace.html','utf8'),{document}=parseHTML(html);
 const c=vm.createContext({document,$:id=>document.getElementById(id),_pipelineStage:'',HERO:'saved-photo',RUN:2,EMB:{},RUNNING:true,FILES:{},_patternSettings:{type:'auto'},LAST:{},operationAccount:()=> 'owner',operationContext:()=>({}),requireOperationSettings(){},viewGrounded(){},toast(){},console:{error(){}},classifyGarment:async()=>{throw Error('Provider unavailable');}});
 vm.runInContext(html.slice(html.indexOf('function pipelineStep('),html.indexOf('/* ---- streaming chat:')),c);
 c.pipelineReset('Ready');assert.equal(document.getElementById('live-status').textContent,'Ready');assert.ok(document.getElementById('live').classList.contains('on'));
 c.pipelineStep('vision','running');assert.equal(document.querySelector('[data-pipeline-stage="vision"]').dataset.state,'running');
 c.pipelineFailed('No response');assert.equal(document.querySelector('[data-pipeline-stage="vision"]').dataset.state,'failed');assert.match(document.getElementById('live-log').textContent,/No response/);
 c.pipelineReset('Next garment');assert.ok([...document.querySelectorAll('[data-pipeline-stage]')].every(n=>n.dataset.state==='waiting'));assert.equal(document.getElementById('live-log').textContent,'');assert.match(document.getElementById('t-type').textContent,/Awaiting/);
 const start=html.indexOf('async function runGrounded(){'),end=html.indexOf('/* ---------- ACCURACY',start);vm.runInContext(html.slice(start,end),c);await c.runGrounded();
 assert.equal(document.querySelector('[data-pipeline-stage="vision"]').dataset.state,'failed','A real pipeline-stage failure is shown at the failed stage');assert.match(document.getElementById('live-status').textContent,/Stopped/);assert.match(document.getElementById('live-log').textContent,/Provider unavailable/);
 const restoreStart=html.indexOf('function restorePatternRun('),restoreEnd=html.indexOf('function renderPatternHistory(',restoreStart);Object.assign(c,{structuredClone,cancelPatternTrace(){},renderChunks(){},renderLogic(){},applyView(){}});vm.runInContext(html.slice(restoreStart,restoreEnd),c);
 c.restorePatternRun({passes:[{img:'saved'}],inputs:{garment:{type:'coat'},type:'coat',cutlist:[{label:'Front',qty:2}],hits:[{}],prompt:'saved prompt'}});assert.ok([...document.querySelectorAll('[data-pipeline-stage]')].every(n=>n.dataset.state==='saved'));assert.equal(document.getElementById('live-status').textContent,'Saved pattern · no new run');
 c.restorePatternRun({passes:[{img:'legacy'}]});assert.equal(document.querySelector('[data-pipeline-stage="vision"]').dataset.state,'unavailable');assert.equal(document.querySelector('[data-pipeline-stage="drawing"]').dataset.state,'saved');
 console.log('Pattern pipeline: waiting, real failure, restored stages and legacy unavailable states passed.');
};

checks['drawer-gestures']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {document}=parseHTML('<html><body><div id="top-actions"><button class="hamburger"></button></div><aside id="clients-drawer"><div class="drawer-title">Submissions</div><a id="card">Saved item</a></aside><section id="brief-fabrics"><button id="fabric">Global</button></section></body></html>');
 const listeners={},docListeners={},actions=[];let now=1000,timer;
 document.addEventListener=(name,fn)=>docListeners[name]=fn;
 const c=vm.createContext({document,innerWidth:1000,Date:{now:()=>now},setTimeout:fn=>(timer=fn,1),clearTimeout(){},addEventListener:(name,fn)=>listeners[name]=fn,toggleWorkspaceDrawer(value){actions.push(value);document.body.classList.toggle('drawer-open',value);}});c.window=c;
 vm.runInContext(readFileSync('docs/aesthetics/ui/drawer-gestures.js','utf8'),c);
 const handle=document.querySelector('.hamburger'),fire=(name,values={})=>listeners[name]?.({target:handle,isPrimary:true,button:0,pointerId:1,clientX:980,clientY:40,cancelable:true,preventDefault(){},...values});
 fire('pointerdown');fire('pointermove',{clientX:910});fire('pointerup',{clientX:910});assert.deepEqual(actions,[true]);
 let stopped=false;docListeners.click({target:handle,preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert.equal(stopped,true,'A drag cannot also toggle through the hamburger click');now+=600;
 fire('pointerdown',{clientX:600});fire('pointermove',{clientX:670});fire('pointerup',{clientX:670});assert.deepEqual(actions,[true,false]);
 for(const target of [document.getElementById('fabric'),document.getElementById('card')]){fire('pointerdown',{target});fire('pointermove',{clientX:800});fire('pointerup',{clientX:800});}assert.equal(actions.length,2,'Content scrollers and links cannot open a drawer');
 fire('pointerdown');fire('pointermove',{clientX:978,clientY:70});fire('pointerup',{clientX:850,clientY:80});assert.equal(actions.length,2,'Vertical intent cancels the drawer gesture');
 fire('pointerdown');fire('pointermove',{clientX:900});fire('pointercancel');fire('pointerup',{clientX:850});assert.equal(actions.length,2,'Cancelled gestures never toggle');
 fire('wheel',{deltaX:80,deltaY:0,deltaMode:0});fire('wheel',{deltaX:-100,deltaY:0,deltaMode:0});assert.deepEqual(actions,[true,false,true],'One wheel burst only toggles once');timer();fire('wheel',{deltaX:-80,deltaY:0,deltaMode:0});assert.equal(actions.at(-1),false);
 fire('wheel',{deltaX:100,deltaY:0,deltaMode:0,ctrlKey:true});assert.equal(actions.length,4,'Zoom gestures never move the drawer');
 for(const path of ['backend/backend.html','backend/backend2.html'])assert.match(readFileSync(path,'utf8'),/drawer-gestures.js/);
 assert.match(readFileSync('backend/backend.html','utf8'),/open:force===undefined\?!_operationsSettingsOpen:!!force/,'Original drawer gestures use the same screen-specific target as the hamburger');
 console.log('Drawer gestures: handle/edge scope, direction lock, cancelled drags, click suppression and wheel-burst isolation passed.');
};

checks['fabric-compact-rail']=async function(){
 const {parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {document,Event,HTMLElement,Element,CustomEvent}=parseHTML('<html><head></head><body><section id="host"></section></body></html>');
 const matches=Element.prototype.matches;Element.prototype.matches=function(selector){return selector===':popover-open'?false:matches.call(this,selector);};
 const create=document.createElement.bind(document);document.createElement=function(tag){const el=create(tag);if(tag==='dialog'){el.open=false;el.showModal=()=>{el.open=true;};el.close=()=>{el.open=false;el.dispatchEvent(new Event('close'));};}return el;};
 let requests=0;const c=vm.createContext({document,HTMLElement,CustomEvent,URL,URLSearchParams,AbortController,AbortSignal,structuredClone,atob,Date,console,queueMicrotask,localStorage:{getItem:()=>''},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,addEventListener(){},dispatchEvent(){},fetch:async()=>{requests++;throw Error('No provider call expected');}});c.window=c;
 const source=readFileSync('docs/aesthetics/ui/fabric-assistant.js','utf8');
 vm.runInContext(source.replace('window.MayaFabricAssistant={open,','window.MayaFabricAssistant={fixtureCard:card,open,'),c);
 const api=c.MayaFabricAssistant,host=document.getElementById('host');await api.open({host,automatic:true,savedOnly:true,compactRail:true});
 const workspace=host.querySelector('.fabric-assistant'),rail=workspace.querySelector('.fa-rail'),results=workspace.querySelector('.fa-results'),header=workspace.querySelector('.fa-header');
 assert.ok(workspace.classList.contains('is-rail'));assert.ok(workspace.classList.contains('fa-compact-cards'));assert.equal(rail.parentElement.className,'fa-body');assert.deepEqual([...rail.children],[header,results],'Controls and cards share the same scroll container');
 const product={url:'https://cloth.example/wool',title:'Wool cloth',image:'https://images.example/wool.jpg',merchant:'Cloth source'};
 const card=api.fixtureCard(product);results.append(card);const photo=card.querySelector('img'),link=card.querySelector('.fa-product-link');
 assert.equal(card.querySelector('.fa-card-copy .fa-card-title').dataset.mayaType,'P1');assert.equal(card.querySelector('.fa-card-copy .fa-card-caption').dataset.mayaType,'P3');assert.equal(card.querySelectorAll('.fa-card-actions [data-maya-shape="circle"]').length,2);
 let focused=0;link.focus=()=>focused++;const pointer=new Event('pointerdown',{bubbles:true});pointer.pointerType='touch';link.dispatchEvent(pointer);const first=new Event('click',{bubbles:true,cancelable:true});first.detail=1;link.dispatchEvent(first);assert.equal(first.defaultPrevented,true);assert.ok(card.classList.contains('is-revealed'));assert.equal(focused,1,'First touch reveals and focuses captions without navigating');
 link.dispatchEvent(pointer);const second=new Event('click',{bubbles:true,cancelable:true});second.detail=1;link.dispatchEvent(second);assert.equal(second.defaultPrevented,false,'Second touch can activate the source or image inspector');
 api.expand();assert.equal(workspace.parentElement.tagName,'DIALOG');assert.equal(workspace.classList.contains('is-rail'),false);assert.equal(header.parentElement,workspace);assert.equal(results.parentElement.className,'fa-body');assert.equal(rail.isConnected,false);assert.equal(card.querySelector('img'),photo,'Expansion preserves decoded image nodes');
 api.expand();assert.equal(workspace.parentElement,host);assert.equal(workspace.classList.contains('is-rail'),true);assert.deepEqual([...rail.children],[header,results]);assert.equal(card.querySelector('img'),photo,'Collapse restores the rail without rebuilding cards');
 const dialog=document.querySelector('dialog');api.expand();dialog.close();assert.equal(workspace.parentElement,host);assert.equal(workspace.classList.contains('is-rail'),true,'Native dialog close restores inline controls as well');
 await api.open({host,automatic:true,savedOnly:true,compactRail:false});assert.equal(workspace.classList.contains('is-rail'),false);assert.equal(workspace.classList.contains('fa-compact-cards'),false);assert.equal(header.parentElement,workspace);assert.equal(results.parentElement.className,'fa-body');const regular=api.fixtureCard(product);assert.equal(regular.querySelector('.fa-card-title').dataset.mayaType,'H4');assert.equal(regular.querySelector('.fa-card-copy'),null,'The ordinary gallery retains its original caption structure');
 assert.equal(requests,0,'Layout transitions and card reveal never call a provider');
 console.log('Fabric rail: shared scrolling structure, compact roles/actions, first-touch reveal, expansion/collapse and ordinary-layout restoration passed.');
};

checks['frontend-card-performance']=async function(){
 const {default:assert}=await import('node:assert/strict'),{parseHTML}=await import('linkedom'),vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const html=readFileSync('frontend/index.html','utf8'),{document,Event}=parseHTML(html);
 const scope={uid:'owner',auth:1,epoch:1,project:'project-a'},frames=new Map(),listeners={},placed=[];
 let frameId=0,requests=0,compressions=0,saves=0,clearedNotes=0,resolveManifest;
 const c=vm.createContext({document,Event,URL,AbortController,setTimeout,clearTimeout,queueMicrotask,location:{origin:'https://maya.test'},MAYA_IS_PUBLIC:true,
  console:{log(){},warn(){}},fabricsInventory:[],fabricsFolderHandle:null,_fabricsTab:'house',myFabrics:[],_fabricPickerMode:'visualize',_fabricPickerSelection:[],_imageRefPickedIdxes:[],items:[],
  _opContext:()=>({...scope}),_opStillValid:ctx=>ctx.uid===scope.uid&&ctx.auth===scope.auth&&ctx.epoch===scope.epoch,
  getApiKey:()=> 'token',showToast(){},showError(){},updateFabricPickConfirm(){},toggleFabricPick(){},pickImageRef(){},scanFabricsFolder:async()=>{},maybeAskImageRef:async()=>{},
  fetch:()=>{requests++;return new Promise(resolve=>resolveManifest=resolve);},
  requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  pgZoomLevel:()=>1,_groupOf:()=>null,bringCardToFront(){},_persistSession:()=>saves++,innerWidth:1000,innerHeight:800,
  addEventListener:(name,fn)=>listeners[name]=fn,findFreeSpot:()=>({x:100,y:150}),
  compressBlobForUpload:async blob=>{compressions++;return blob;},FileReader:class{readAsDataURL(){this.result='data:image/jpeg;base64,YQ==';queueMicrotask(()=>this.onload());}},
  placeItem:card=>placed.push(card),placeItemAt:(card,x,y)=>placed.push({...card,x,y}),
  renderViewerVersionNav(){},renderViewerFabrics(){},renderViewerRefs(){},renderViewerNotes(){},_refreshViewerHeart(){},_refreshStagedChips(){},
  exitPhotoFullscreen(){},viewerNotesDrawer:{set(){},update(value){if(!Object.keys(value).length)clearedNotes++;},clear(){}},MayaImageViewer:{bind:()=>({reset(){}})},visualizeListening:false,_resetModifyStage(){},renderModificationsBar(){}
 });c.window=c;
 const load=(start,end)=>{const at=html.indexOf(start),to=html.indexOf(end,at);assert.ok(at>=0&&to>at,start);vm.runInContext(html.slice(at,to),c);};
 load('function _safeImgSrc(', 'function _safeRealism(');load('function escapeHtml(', '// v8.1: collapse');
 load('function _fabricThumb(', 'let fabricsInventory =');load('let _fabricAssetsLoaded=', 'async function scanFabricsFolder(');
 load('function updateFabricsDrawerSub(', 'function renameFabric(');load('let _fabricModeChoice=', 'function closeFabricPicker(');
 const first=c.scanFabricsFromAssets(false,false),second=c.scanFabricsFromAssets(false,false);assert.equal(requests,1,'Concurrent drawer/chooser opens share one manifest read');
 resolveManifest({ok:true,json:async()=>({items:Array.from({length:24},(_,i)=>({id:'fabric-'+i,fileName:'Fabric '+i+'.JPG',name:'Fabric '+i,analyzed:true,color:'navy'}))})});await Promise.all([first,second]);
 assert.equal(document.querySelector('[data-house-grid]'),null,'Warming the chooser reads only metadata and does not mount swatch images');await c.scanFabricsFromAssets();
 const house=document.querySelector('[data-house-grid]'),houseCards=[...house.children],houseSwatches=houseCards.map(n=>n.querySelector('.fabric-swatch'));
 for(let i=0;i<30;i++){await c.scanFabricsFromAssets();c.renderFabricsGrid();}
 assert.equal(requests,1);assert.deepEqual([...house.children],houseCards,'Thirty warm opens retain every fabric card');
 assert.deepEqual([...house.querySelectorAll('.fabric-swatch')],houseSwatches,'Unchanged swatches retain their media nodes');
 assert.equal(houseCards[0].getAttribute('tabindex'),'0');assert.equal(houseCards[0].getAttribute('aria-label'),'Fabric 0');
 c.fabricsInventory[0].name='Updated fabric';c.renderFabricsGrid();assert.equal(house.firstElementChild,houseCards[0]);assert.equal(houseCards[0].querySelector('input').value,'Updated fabric');
 c.openFabricPicker();const grid=document.getElementById('fabric-pick-grid'),choiceNodes=[...grid.children],choiceMedia=choiceNodes.map(n=>n.querySelector('.swatch'));
 choiceNodes[0].classList.add('selected');choiceNodes[0].querySelector('.order-badge').textContent='1';
 for(let i=0;i<30;i++)c.openFabricPicker();
 assert.deepEqual([...grid.children],choiceNodes);assert.deepEqual([...grid.querySelectorAll('.swatch')],choiceMedia);assert.equal(choiceNodes[0].getAttribute('aria-pressed'),'false');assert.equal(choiceNodes[0].querySelector('.order-badge').textContent,'');
 let picked=-1;const refs=[{key:'a',image:'https://pictures.example/a.jpg',label:'A'},{key:'b',image:'https://pictures.example/b.jpg',label:'B'}];
 const refGrid=document.getElementById('image-ref-grid');c._renderMediaChoices(refGrid,refs,index=>picked=index);const retained=refGrid.firstElementChild;
 c._renderMediaChoices(refGrid,[refs[1],{...refs[0],label:'Updated A'}],index=>picked=index,[1]);assert.equal(refGrid.children[1],retained);retained.click();assert.equal(picked,1,'Retained handlers follow reordered choice indices');assert.equal(retained.getAttribute('aria-pressed'),'true');
 const enter=new Event('keydown',{cancelable:true});enter.key='Enter';retained.dispatchEvent(enter);assert.equal(enter.defaultPrevented,true);
 scope.epoch++;c._renderMediaChoices(refGrid,refs,()=>{});assert.notEqual(refGrid.firstElementChild,retained,'Private reference grids do not retain old-project nodes');
 document.getElementById('fabric-picker-modal').classList.remove('open');c.fabricsInventory=[];let finishScan;c.scanFabricsFolder=()=>new Promise(resolve=>finishScan=resolve);
 const choosing=c.chooseFabricMode('house');scope.epoch++;c.fabricsInventory=[{id:'new',name:'New fabric'}];finishScan();await choosing;assert.equal(document.getElementById('fabric-picker-modal').classList.contains('open'),false,'Late loading cannot reopen a picker in a different project');
 load('function _clearViewerImage(', 'function renderViewerFabrics(');load('function closeGarmentModal(', '// v8.9: generic Esc closer');
 const photo=document.getElementById('garment-image'),setPhoto=photo.setAttribute.bind(photo);let sourceWrites=0;
 photo.setAttribute=(name,value)=>{if(name==='src')sourceWrites++;return setPhoto(name,value);};
 for(let i=0;i<30;i++){c.renderViewerContent({card:{image:'https://pictures.example/garment.jpg',caption:'Updated caption '+i}});c.closeGarmentModal();}
 assert.equal(sourceWrites,1,'Thirty viewer close/reopen cycles write the image source only once');c._clearViewerImage();assert.equal(photo.hasAttribute('src'),false);assert.equal(photo.onload,null,'A project/account boundary clears the retained private photo');assert.equal(clearedNotes,1,'The same boundary clears retained private notes');
 load('function makeDraggable(', '// v8.2: keep the glow');
 const card=document.createElement('div');card.className='item-card';card.style.left='10px';card.style.top='20px';document.body.append(card);c.items=[{el:card,card:{}}];c.makeDraggable(card);
 const pointer=(type,x,y,kind='mouse')=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerType:kind,pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});card.dispatchEvent(e);};
 pointer('pointerdown',10,20);assert.equal(card.classList.contains('touched'),false,'Mouse clicks never leave touch captions pinned');
 for(let i=1;i<=240;i++)pointer('pointermove',10+i,20+i);
 assert.equal(frames.size,1,'240 incoming moves queue only one paint');assert.equal(card.style.left,'10px','No layout writes happen before the next paint');
 const paint=frames.values().next().value;frames.clear();paint();assert.equal(card.style.left,'250px');assert.equal(card.style.top,'260px');pointer('pointerup',250,260);assert.equal(saves,1);frames.clear();
 pointer('pointerdown',250,260);pointer('pointermove',300,310);scope.epoch++;pointer('pointerup',300,310);assert.equal(card.style.left,'250px');assert.equal(saves,1,'A cancelled old-project drag cannot dirty the new project');assert.equal(frames.size,0);
 load('const LINK_IMPORT_MAX =', 'async function runLinkImport(');load('const dropHint =', '// ════════════════════════════════════════════════════════════\n// v5.12:');
 const canvas=document.getElementById('maya-canvas');canvas.getBoundingClientRect=()=>({left:0,top:0});Object.defineProperty(canvas,'offsetWidth',{value:1000});
 let finishImport,importSignal;c.fetch=async(url,options)=>{requests++;importSignal=options.signal;return new Promise(resolve=>finishImport=resolve);};
 const importing=c.importPictureFromUrl('https://pictures.example/pin.jpg','Pin',{context:{...scope},preview:true,position:{x:40,y:70}});assert.equal(canvas.querySelectorAll('.is-importing').length,1);assert.equal(placed.length,0,'Pending previews never enter saved card state');
 scope.epoch++;c._cancelPictureImports();assert.equal(canvas.querySelectorAll('.is-importing').length,0);assert.equal(importSignal.aborted,true);finishImport({ok:true,blob:async()=>({})});assert.equal(await importing,false);assert.equal(compressions,0,'Stale imports stop before image decoding');
 c.fetch=async()=>{requests++;return {ok:true,blob:async()=>({})};};
 const pin=document.createElement('button');pin.className='pin-pic';pin.dataset.url='https://pictures.example/original.jpg';pin.dataset.alt='Original title';const thumbnail=document.createElement('img');pin.append(thumbnail);document.body.append(pin);
 function transfer(){const data=new Map();return {files:[],setData:(key,value)=>data.set(key,value),getData:key=>data.get(key)||''};}
 const dragData=transfer(),dragEvent=new Event('dragstart',{bubbles:true});dragEvent.dataTransfer=dragData;thumbnail.dispatchEvent(dragEvent);
 const beforeDrop=requests;await listeners.drop({preventDefault(){},dataTransfer:dragData,clientX:360,clientY:280});
 assert.equal(requests,beforeDrop+1);assert.equal(placed.length,1);assert.equal(placed[0].title,'Original title');assert.equal(placed[0].image,'data:image/jpeg;base64,YQ==');assert.equal(placed[0].x,240);assert.equal(placed[0].y,200);assert.equal(canvas.querySelectorAll('.is-importing').length,0);
 const staleData=transfer(),staleDrag=new Event('dragstart',{bubbles:true});staleDrag.dataTransfer=staleData;thumbnail.dispatchEvent(staleDrag);scope.epoch++;const beforeStale=requests;
 await listeners.drop({preventDefault(){},dataTransfer:staleData,clientX:400,clientY:300});assert.equal(requests,beforeStale);assert.equal(placed.length,1,'A drag started in another project cannot import into this one');
 assert.match(html,/\_boardEpoch\+\+;\s*_cancelPictureImports\(\);\s*_clearViewerImage\(\)/);
 console.log('Frontend performance: 30 fabric opens/1 manifest read; 24 cards retained across 30 picker opens; 30 viewer updates/1 source write; 240 moves/1 paint; isolated drag/import and picker races passed.');
};
