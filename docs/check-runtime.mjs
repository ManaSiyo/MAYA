// Behavioral checks retained from the old test tree. Fake providers only.
// Each named check has its own scope; run all through node docs/check.mjs.
export const checks = {};

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
    _authSeq:1,_boardEpoch:1,_persistTimer:null,_hydrating:false,_creatingBin:false,_flushNow:false,_autosaveDirty:false,_activeSessionId:null,
    currentClientName:null,lastSummary:null,lastTranscript:'',items:[],_lastPaintDropped:0,
    _avatarLibCache:null,_avatarLibCacheUid:null,_facePhotoVersion:0,_avatarSaveInFlight:false,_avatarSavePending:null,_avatarSaveTimer:null,_pendingAssetDeletes:[],_pendingLegacyDeletes:[],
    _cardSig:c=>c.title||c.imageUrl||c.image||'',_twoWordFromItems:()=>'',_autoProjectName:()=> 'Untitled fixture',
    _drainAssetDeletes(){},_hydrate:async fn=>fn(),_doClear(){ctx.items=[];ctx.lastSummary=null;ctx.lastTranscript='';ctx._boardEpoch++;},
    showError:msg=>notices.push(msg),showToast:msg=>notices.push(msg),refreshDrawerClientName(){},renderNotesPanel(){},
    document:{visibilityState:'visible',getElementById:id=>id==='save-session-btn'?saveButton:null},confirm:()=>false,_renderSessionsDropdown(){},
    window:{addEventListener:(_name,fn)=>{ctx.beforeUnload=fn;}},
    _flashAutosaved:()=>notices.push('Autosaved'),_notifySyncOffline:()=>notices.push('Offline'),
    _paintItems:items=>{ctx.items=items;},_opContext:()=>({id:ctx.projectStore.currentId,auth:ctx._authSeq}),_opStillValid:stamp=>stamp.id===ctx.projectStore.currentId&&stamp.auth===ctx._authSeq,
    closeShareModal(){},_showShareModal:(link,name,error)=>{if(link||error)notices.push(link||error);},location:{origin:'https://maya.invalid'},navigator:{clipboard:{writeText:async()=>{}}},
    _safeImgSrc:s=>typeof s==='string'?s:'',_safeRealism:()=>null,
  };
  runInNewContext(part(source,'const projectStore = {','async function _renderSessionsDropdown()')+'\nglobalThis.projectStore=projectStore;',ctx);
  runInNewContext(part(source,'function _persistSession() {','// v11.31: flush immediately'),ctx);
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

checks['fabric-search']=async function(){
// Behavioral evidence for conversational fabric discovery. No live AI or merchant calls.
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const {default:vm}=await import('node:vm');
const { FABRIC_SHOPS, FABRIC_STORE_GROUPS, merchantURL, normalizeFabricRequest : normalizeRequest, requestedShops, webSearchBody, readDiscovery, parseListing, applyShopifyVariant, createFabricSearch : createSearch, mountFabricSearch }=await import('../backend/server/fabric-search.mjs');

// These legacy seller/visual/storage contracts now belong to the explicit
// optional retailer path. Worldwide default behavior is exercised separately.
const normalizeFabricRequest=body=>normalizeRequest({mode:'retailers',...body});
function createFabricSearch(options){const service=createSearch(options);return {...service,search:(user,body,...rest)=>service.search(user,{mode:'retailers',...body},...rest)};}

const user={sub:'owner-A',email:'owner@example.test'}, second={sub:'owner-B',email:'other@example.test'};
const url='https://britexfabrics.com/products/crimson-wool';
const other='https://stonemountainfabric.com/product/wool-twill/';
const image='data:image/png;base64,iVBORw0KGgo=';
const seller=(overrides={})=>'<html><script type="application/ld+json">'+JSON.stringify({
  '@type':'Product',name:'Crimson wool twill',description:'100% wool. 61 inches wide. Sold by the yard.',
  image:'https://cdn.shopify.com/wool.jpg',material:'100% wool',url,
  offers:{'@type':'Offer',price:'69.99',priceCurrency:'USD',availability:'https://schema.org/InStock',url},...overrides,
})+'</script></html>';
const response=(data={})=>({status:'completed',output:[{type:'web_search_call',action:{sources:[{url},{url:other}]}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({query:'burgundy matte wool twill',observation:'Burgundy, matte and twill-like; composition cannot be confirmed from the image.',candidates:[{url,reason:'May suit the requested matte wool.'}],...data})}]}]});
let count=0;
async function test(name,run){await run();count++;console.log('  ok '+name);}
function store(){
  const records=new Map([['submissions/project-A/submission.json',{buf:Buffer.from('{}'),generation:'1'}],['submissions/project-B/submission.json',{buf:Buffer.from('{}'),generation:'1'}],['submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({client:{name:'PRIVATE NAME'},fabric_preferences:'100% wool, no polyester'})),generation:'1'}]]);
  return {records,read:async key=>records.has(key)?{ok:true,...records.get(key)}:{ok:false,status:404},write:async(key,buf,type,generation)=>{assert.equal(type,'application/json');if(String(records.get(key)?.generation||'0')!==generation)throw Object.assign(Error('conflict'),{status:412});records.set(key,{buf,generation:String(Number(generation)+1)});}};
}
await test('a tracksuit sources separate body, panels, inserts and textile trim in one checked search',async()=>{
  const s=store(),events=[],pieces=['Track jacket','Track pants'].map((name,i)=>({id:'track-'+i,name,fabric:'Green synthetic-looking knit, possibly polyester tricot',fabric_spec:{weave:'knit-like',texture:'smooth'}}));
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{"fabric_preferences":[]}'),generation:'1'});
  const materials=[
    {id:'body',role:'body',label:'Green body',fabric:'Green tricot knit',garmentIds:['track-0','track-1']},
    {id:'gold',role:'panel',label:'Gold shoulder panels',fabric:'Gold satin',garmentIds:['track-0']},
    {id:'ivory',role:'panel',label:'Ivory inserts',fabric:'Ivory knit',garmentIds:['track-0','track-1']},
    {id:'trim',role:'trim',label:'Gold laurel textile trim',fabric:'Gold ivory jacquard trim',garmentIds:['track-0','track-1']},
    {id:'rib',role:'ribbing',label:'Green cuffs and waistband',fabric:'Green rib knit',garmentIds:['track-0','track-1']},
  ];
  const listings=[['body','Forest Green Polyester Tricot Fabric','Smooth polyester tricot knit fabric, sold by the yard.'],['gold','Champagne Gold Satin Fabric','Polyester satin fabric sold by the yard.'],['ivory','Ivory Cotton Interlock Knit Fabric','Cotton interlock knit fabric sold by the yard.'],['trim','Gold Leaf Jacquard Textile Trim','Gold leaves woven on ivory cotton jacquard trim fabric, sold by the yard.']].map(([id,name,description])=>({id,name,description,url:'https://www.moodfabrics.com/products/'+id}));
  const answer=response({materials,candidates:listings.map(p=>({url:p.url,materialId:p.id,reason:'For this part of the reference.'}))});
  answer.output[0].action.sources=listings.map(p=>({url:p.url}));
  let webCalls=0,rankCalls=0,visualOutcome='accept';
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
    if(target.includes('openai.com')){webCalls++;assert.match(JSON.parse(options.body).instructions,/panels/i);return Response.json(answer);}
    if(target.includes('/search/suggest.json'))return Response.json({resources:{results:{products:[]}}});
    const p=listings.find(p=>p.url===target);assert.ok(p,'Only evidenced approved listings are fetched');
    return new Response(seller({name:p.name,description:p.description,url:p.url,material:'',image:'https://seller.example/'+p.id+'.jpg'}));
  },rank:async({products,traits})=>{rankCalls++;assert.ok(products.length<=8);assert.equal(traits.materials.length,5);assert.equal(products.find(p=>p.materialId==='gold').garmentId,'track-0');assert.equal(products.find(p=>p.materialId==='ivory').garmentId,undefined);if(visualOutcome==='error')throw Error('fake visual failure');return visualOutcome==='accept'?products:[];}});
  await service.search(user,{submissionId:'project-A',automatic:true,image},event=>events.push(event));
  assert.equal(webCalls,1);assert.equal(rankCalls,1);
  assert.deepEqual(events.at(-1).products.map(p=>p.materialId).sort(),['body','gold','ivory','trim']);
  assert.match(events.at(-1).searchDetails.stage,/Green cuffs and waistband/,'Missing components remain explicit instead of claiming the look is covered');
  assert.equal(events.at(-1).products.find(p=>p.materialId==='gold').price,'69.99','Facts still come from the fetched seller, never the planner');
  for(const outcome of ['reject','error']){visualOutcome=outcome;const beforeCalls=webCalls;await service.search(user,{submissionId:'project-A',automatic:true,image},event=>events.push(event));assert.deepEqual(events.at(-1).products,[],'Component hints never bypass failed or rejecting photo comparison');assert.equal(webCalls,beforeCalls+1,'No automatic paid retry');}
});
await test('component plans stay scoped and distinct textiles share the eight candidate slots',()=>{
  const materials=['body','gold','ivory','trim'].map((id,i)=>({id,role:i?'panel':'body',label:id,fabric:i?'Gold satin':'Green knit',garmentIds:['track']}));
  const candidates=Array.from({length:6},(_,i)=>({url:'https://www.moodfabrics.com/products/body-'+i,materialId:'body'})).concat(materials.slice(1).map(m=>({url:'https://www.moodfabrics.com/products/'+m.id,materialId:m.id})));
  const answer=response({materials,candidates});answer.output[0].action.sources=candidates.map(c=>({url:c.url}));
  const input={pieces:[{id:'track',name:'Track jacket'}]};
  const parsed=readDiscovery(answer,input);assert.equal(parsed.candidates.length,8);assert.deepEqual(parsed.candidates.slice(0,4).map(c=>c.materialId),['body','gold','ivory','trim'],'Body alternatives cannot consume every slot');
  const stale=readDiscovery(answer,{pieces:[{id:'different',name:'Track jacket'}]});assert.deepEqual(stale.materials,[]);assert.deepEqual(stale.candidates,[],'A matching name cannot override a stale/foreign garment ID');
  const duplicate=response({materials:[materials[0],{...materials[0],fabric:'Red velvet'}],candidates:[candidates[0]]});duplicate.output[0].action.sources=[{url:candidates[0].url}];
  assert.deepEqual(readDiscovery(duplicate,input).candidates,[],'Ambiguous component IDs fail closed');
  const unsupported=response({materials:[{...materials[0],role:'zipper'}],candidates:[candidates[0]]});unsupported.output[0].action.sources=[{url:candidates[0].url}];
  assert.deepEqual(readDiscovery(unsupported,input).candidates,[],'The fabric plan cannot turn hardware into a textile');
});
await test('full-look matching keeps a verified shared fabric without inventing a garment ID',async()=>{
  const s=store(),events=[];s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'jacket',name:'Jacket',fabric:'Crimson wool twill'},{id:'pants',name:'Pants',fabric:'Crimson wool twill'}]})),generation:'1'});
  let rankCalls=0;const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async target=>target.includes('openai.com')?Response.json(response()):target.includes('/search/suggest.json')?Response.json({resources:{results:{products:[]}}}):new Response(seller()),rank:async ({products})=>{rankCalls++;return products;}});
  await service.search(user,{submissionId:'project-A',automatic:true,image},e=>events.push(e));
  assert.equal(rankCalls,1);assert.equal(events.at(-1).products.length,1);assert.equal(events.at(-1).products[0].garment,'Jacket & Pants');assert.equal(events.at(-1).products[0].garmentId,undefined);
});
await test('saved tracksuit and qualified tailcoat fabrics reach one visual check with seller facts intact',async()=>{
  const cases=[
    {names:['Track jacket','Track pants'],fabric:'Green synthetic-looking knit, possibly polyester tricot',fabric_spec:{weave:'knit-like',sheen:'subtle sheen',texture:'smooth'},name:'Forest Green Polyester Tricot Fabric',description:'Smooth warp knitted fabric with a satin finish. Sold by the yard.'},
    {names:['Tailcoat','Slim trousers'],fabric:'Green embroidered satin-sheen woven',fabric_spec:{weave:'smooth woven, possibly twill-like',sheen:'moderate satin sheen',texture:'smooth'},name:'Forest Green Polyester Satin Fabric',description:'Smooth polyester satin, sold by the yard.'},
  ];
  for(const sample of cases){
    const pieces=sample.names.map((name,i)=>({id:'piece-'+i,name,fabric:sample.fabric,fabric_spec:{fiber:'',stretch:'',...sample.fabric_spec}}));
    for(const outcome of ['match','reject','error','unavailable','excluded']){
      const s=store(),events=[];let rankCalls=0,webCalls=0;
      s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
      s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:outcome==='excluded'?'No polyester':[]})),generation:'1'});
      const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
        if(target.includes('openai.com')){
          webCalls++;const sent=JSON.parse(JSON.parse(options.body).input[0].content[0].text);
          assert.deepEqual(sent.garments.map(({id,name,fabric,fabric_spec})=>({id,name,fabric,fabric_spec})),pieces,'Original saved descriptions must reach discovery unchanged');
          return Response.json(response());
        }
        if(target.includes('/search/suggest.json'))return Response.json({resources:{results:{products:[]}}});
        return new Response(seller({name:sample.name,description:sample.description,material:'100% polyester'}));
      },...(outcome==='unavailable'?{}:{rank:async ({products,traits,garmentImage})=>{
        rankCalls++;assert.equal(products.length,1);assert.equal(products[0].url,url);
        assert.equal(products[0].price,'69.99');assert.equal(products[0].unit,'yard');
        assert.equal(products[0].garment,sample.names.join(' & '));assert.equal(products[0].garmentId,undefined);
        assert.equal(garmentImage,image);assert.deepEqual(traits.garments.map(({id,name,fabric,fabric_spec})=>({id,name,fabric,fabric_spec})),pieces);
        if(outcome==='error')throw Error('comparison unavailable');
        return outcome==='match'?products:[];
      }})});
      await service.search(user,{submissionId:'project-A',automatic:true,image},e=>events.push(e));
      assert.equal(webCalls,1,'No extra paid discovery attempts');
      assert.equal(rankCalls,['match','reject','error'].includes(outcome)?1:0,outcome+' / '+sample.names[0]);
      // Without a ranker the factual tricot listing still matches the saved
      // knit family, but the alternative to a guessed twill cannot be confirmed.
      const count=outcome==='match'||outcome==='unavailable'&&sample===cases[0]?1:0;
      assert.equal(events.at(-1).products.length,count,outcome+' / '+sample.names[0]);
    }
  }
});
await test('only approved seller product URLs can become candidates',()=>{
  for(const bad of ['http://britexfabrics.com/products/a','https://britexfabrics.com.evil.test/products/a','https://127.0.0.1/a','https://user@britexfabrics.com/products/a','https://britexfabrics.com:8443/products/a','https://britexfabrics.com/search?q=wool'])assert.equal(merchantURL(bad,true),null);
  assert.equal(merchantURL(url+'?utm_source=test',true).url,url);
  assert.ok(merchantURL('https://amazon.com/dp/B000000001',true));
  assert.ok(FABRIC_SHOPS.some(s=>s.name==='Harts Fabric'));
});
await test('photo, words and refinements use one search with bounded tools and no server storage',()=>{
  const input=normalizeFabricRequest({request:'less shiny, only Britex',image,history:[{request:'red wool',query:'red wool twill'}],piece:{fabric_spec:{fiber:'wool',weave:'twill'}},preferences:'no polyester'});
  const body=webSearchBody(input,'configured-model');
  assert.equal(body.model,'configured-model');assert.equal(body.store,false);assert.equal(body.max_tool_calls,3);assert.equal(body.tool_choice,'required');
  assert.equal(body.input[0].content[1].image_url,image);
  assert.match(body.input[0].content[0].text,/less shiny, only Britex/);assert.match(body.input[0].content[0].text,/no polyester/);
  assert.deepEqual(body.tools[0].filters.allowed_domains,['britexfabrics.com']);
  const broad=webSearchBody(normalizeFabricRequest({request:'red wool'}),'configured-model');
  assert.ok(broad.tools[0].filters.allowed_domains.includes('amazon.com'));assert.ok(broad.tools[0].filters.allowed_domains.includes('stonemountainfabric.com'));
  assert.equal(requestedShops(normalizeFabricRequest({request:'less shiny',history:[{request:'only Brightex'}]}))[0].name,'Britex Fabrics');
  assert.deepEqual(requestedShops(normalizeFabricRequest({request:'only local'})).map(s=>s.place),['San Francisco','Berkeley','Santa Cruz']);
  assert.throws(()=>normalizeFabricRequest({request:'x',image:'https://private.test/photo'}));
  assert.throws(()=>normalizeFabricRequest({request:'x',submissionId:'../project'}));
});
await test('five explicit store groups replace stale merchant-only history without broadening invalid filters',()=>{
  assert.deepEqual(FABRIC_STORE_GROUPS.map(group=>group.label),['Local (Bay Area)','Mood','Swatchon','Amazon','Others']);
  const ui=readFileSync(new URL('../docs/aesthetics/ui/fabric-assistant.js',import.meta.url),'utf8');
  const browserGroups=JSON.parse(vm.runInNewContext(ui.slice(ui.indexOf('const storeGroups='),ui.indexOf('let searchSeq='))+'JSON.stringify(storeGroups)'));
  assert.deepEqual(browserGroups,FABRIC_STORE_GROUPS.map(group=>({...group,hosts:group.hosts.map(host=>host.replace(/^www\./,''))})),'Browser and server classify every approved merchant identically');
  for(const group of FABRIC_STORE_GROUPS){
    const input=normalizeFabricRequest({request:'less shiny, only Britex',history:[{request:'only Britex red wool'}],storeGroups:[group.id]});
    assert.deepEqual(requestedShops(input).map(shop=>shop.host).sort(),[...group.hosts].sort());
    const payload=webSearchBody(input,'fixture');assert.match(payload.input[0].content[0].text,/less shiny/);assert.match(payload.instructions,/never confirms pickup/);
  }
  assert.deepEqual(requestedShops(normalizeFabricRequest({request:'red wool',stores:['moodfabrics.com']})).map(shop=>shop.name),['Mood Fabrics']);
  for(const storeGroups of [[],['unknown'],['local','unknown'],'mood'])assert.throws(()=>normalizeFabricRequest({request:'wool',storeGroups}),/supported store/);
  assert.throws(()=>normalizeFabricRequest({request:'wool',stores:['evil.test']}),/supported fabric store/);
  assert.equal(requestedShops(normalizeFabricRequest({request:'wool'})).length,FABRIC_SHOPS.length,'No silent local-only default');
});
await test('Swatchon uses exact sourced product paths and SKU photos, never aggregate or swatch prices',()=>{
  const link='https://www.swatchon.com/fabric/QL-061078';
  for(const good of [link,'https://swatchon.com/wholesale-fabric/14620'])assert.equal(merchantURL(good,true).shop.name,'Swatchon');
  for(const bad of ['https://www.swatchon.com/fabric','https://www.swatchon.com/products/invented','https://www.swatchon.com/fabric/wool','https://www.swatchon.com/help/articles/how-swatchon-works','https://swatchon.com.evil.test/fabric/QL-061078'])assert.equal(merchantURL(bad,true),null);
  const html=seller({name:'Enzyme Cotton Twill',url:link,sku:'QL-061078',image:[],description:'Cotton 100%. Order from 1 yard, ships from Korea.',offers:{'@type':'AggregateOffer',lowPrice:7.48,highPrice:12.47,priceCurrency:'USD',url:link}})+'<meta property="og:image" content="https://www.swatchon.com/images/og-default.png"><img src="https://seller.test/unrelated.jpg" alt="QL-000001 1"><img src="https://seller.test/QL-061078.jpg" alt="QL-061078 1">';
  const p=parseListing(html,link);assert.equal(p.image,'https://seller.test/QL-061078.jpg');assert.equal(p.price,'');assert.equal(p.unit,'');assert.equal(p.availability,'unknown');assert.equal(p.place,'Online');
  assert.equal(parseListing(html.replace(/<img[^>]+>/g,''),link).image,'','A site logo cannot become a fabric photo');
  assert.equal(parseListing(seller({name:'Cotton Swatch',url:link,description:'Sold by the yard.'}),link).isSwatch,true);
});
await test('Swatchon-only discovery keeps refinements, verifies seller facts and rejects other approved merchants',async()=>{
  const link='https://www.swatchon.com/fabric/QL-061078',events=[],visits=[];
  const discovery=response({candidates:[{url:link,price:'1.00',reason:'Wool twill.'},{url}]});discovery.output[0].action.sources.push({url:link});
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai.com'))return Response.json(discovery);
    visits.push(target);assert.equal(target,link);return new Response(seller({url:link,offers:{'@type':'AggregateOffer',lowPrice:7,highPrice:20,priceCurrency:'USD'}}));
  }});
  await service.search(user,{request:'less shiny crimson wool',history:[{request:'only Britex wool'}],storeGroups:['swatchon']},event=>events.push(event));
  assert.deepEqual(visits,[link]);assert.deepEqual(events.at(-1).products.map(p=>p.url),[link]);assert.equal(events.at(-1).products[0].price,'');
  const redirected=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>target.includes('openai.com')?Response.json(discovery):target===link?new Response('',{status:302,headers:{location:url}}):new Response(seller())});
  const redirectedEvents=[];await redirected.search(user,{request:'crimson wool',storeGroups:['swatchon'],history:[{request:'wool'}]},event=>redirectedEvents.push(event));
  assert.deepEqual(redirectedEvents.at(-1).products,[],'An approved host redirect must still respect the selected group');
});
await test('ungrounded URLs, invented prices and unapproved sellers from AI are discarded',()=>{
  const found=readDiscovery(response({candidates:[{url,price:'1.00',reason:'Close texture'},{url:'https://britexfabrics.com/products/invented'},{url:'https://evil.test/p'},{url}]}));
  assert.equal(found.candidates.length,1);assert.equal(found.candidates[0].price,undefined);
  assert.throws(()=>readDiscovery({status:'incomplete'}));
});
await test('seller facts, price unit and stock are extracted independently of AI',()=>{
  const p=parseListing(seller(),url,0);
  assert.equal(p.price,'69.99');assert.equal(p.unit,'yard');assert.equal(p.composition,'100% wool');assert.equal(p.availability,'in_stock');assert.equal(p.checkedAt,'1970-01-01T00:00:00.000Z');
  const half=parseListing(seller({description:'Sold in half yard increments.'}),url);assert.equal(half.unit,'half yard');
  assert.equal(parseListing(seller({description:'Drapey wool'}),url).price,'','Unknown selling unit hides price');
});
await test('seller images require a real URL and choose the first valid structured or metadata fallback',()=>{
  for(const image of [undefined,'',{},null,[],{url:null},'undefined','null'])assert.equal(parseListing(seller({image}),url).image,'','Missing image never becomes a fabricated relative URL');
  assert.equal(parseListing(seller({image:['',{},'http://cdn.example/insecure.jpg','//cdn.example/denim.jpg']}),url).image,'https://cdn.example/denim.jpg');
  assert.equal(parseListing(seller({image:{contentUrl:'/images/denim.jpg'}}),url).image,'https://britexfabrics.com/images/denim.jpg');
  const metadata='<meta property="og:image" content="https://cdn.example/fallback.webp?width=800&amp;quality=80">';
  assert.equal(parseListing(seller({image:[{},'http://cdn.example/insecure.jpg']})+metadata,url).image,'https://cdn.example/fallback.webp?width=800&quality=80');
});
await test('listings without a source image never enter recommendations or the paid visual pass',async()=>{
  let rankCalls=0;const events=[];
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller({image:undefined})),rank:async input=>{rankCalls++;return input.products;}});
  await service.search(user,{request:'crimson wool',image,history:[{request:'wool'}]},event=>events.push(event));
  assert.equal(rankCalls,0);assert.deepEqual(events.at(-1).products,[]);
});
await test('swatch/yardage variants and aggregate price are never conflated',()=>{
  const swatch={price:'3',priceCurrency:'USD',url:url+'?variant=swatch',availability:'https://schema.org/InStock'};
  const yard={price:'69.99',priceCurrency:'USD',url:url+'?variant=yard',availability:'https://schema.org/InStock'};
  assert.equal(parseListing(seller({offers:[swatch,yard]}),url).price,'');
  assert.equal(parseListing(seller({offers:[swatch,yard]}),url+'?variant=yard').price,'','Variant identifier alone does not establish the selling unit');
  assert.equal(parseListing(seller({offers:{'@type':'AggregateOffer',lowPrice:'3',highPrice:'69.99',priceCurrency:'USD'}}),url).price,'');
  assert.equal(parseListing(seller({name:'Wool swatch'}),url).isSwatch,true);
  const data={handle:'crimson-wool',price:300,variants:[{id:1,title:'Default Title',price:6999,available:true},{id:2,title:'Swatch',price:300,available:true}]};
  const html=seller()+'<span>$69.99 / yard</span>';
  assert.equal(applyShopifyVariant(parseListing(html,url),data,html).price,'69.99');
  assert.equal(applyShopifyVariant(parseListing(html,url+'?variant=2'),data,html).isSwatch,true);
});
await test('out of stock is rejected, unknown stock remains explicit and redirects cannot escape',async()=>{
  let visits=[];
  const service=createFabricSearch({...store(),fetchImpl:async u=>{visits.push(u);return new Response(seller({offers:{price:'20',priceCurrency:'USD',availability:'https://schema.org/OutOfStock'}}));}});
  assert.equal(await service.verify({url}),null);
  const redirected=createFabricSearch({...store(),fetchImpl:async u=>{visits.push(u);return new Response('',{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}});}});
  const p=await redirected.verify({url});assert.equal(p.evidence,'search_link');assert.equal(p.price,'');assert.equal(p.availability,'unknown');assert.equal(visits.length,2);
  const blocked=createFabricSearch({...store(),fetchImpl:async()=>new Response('<html>Robot check</html>')});
  const amazon=await blocked.verify({url:'https://amazon.com/dp/B000000001'});assert.equal(amazon.evidence,'search_link');assert.equal(amazon.image,'');
});
await test('early seller results arrive while web reasoning is still pending',async()=>{
  let finish, called;const pending=new Promise(r=>finish=r), started=new Promise(r=>called=r);const events=[];
  const s=store();let sent;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async(u,o)=>{
    if(u.includes('api.openai.com')){sent=JSON.parse(o.body);called();await pending;return Response.json(response());}
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,available:true}]}}});
    return new Response(seller());
  }});
  const run=service.search(user,{submissionId:'project-A',request:'crimson wool',image},e=>events.push(e));
  await started;
  for(let i=0;i<20&&!events.some(e=>e.type==='products');i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(events.some(e=>e.type==='products'&&e.preliminary));assert.ok(!events.some(e=>e.type==='done'));
  assert.match(sent.input[0].content[0].text,/100% wool, no polyester/);assert.doesNotMatch(JSON.stringify(sent),/PRIVATE NAME/);
  finish();await run;assert.equal(events.at(-1).products.length,1);assert.ok(events.at(-1).timings.firstResultsMs!==null);assert.match(events.at(-1).warning,/photos have not been compared/);
});
await test('saved dissection and preferences load in parallel after submission validation',async()=>{
  const s=store(),started=[],events=[];let release,providerCalls=0;
  const gate=new Promise(resolve=>release=resolve);
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat',fabric:'crimson wool'}]})),generation:'1'});
  const service=createFabricSearch({...s,read:async key=>{if(key.endsWith('/summary.json')||key.endsWith('/pieces.json')){started.push(key);await gate;}return s.read(key);},fetchImpl:async()=>{providerCalls++;return new Response('',{status:503});}});
  const run=service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat'},image},e=>events.push(e));
  for(let i=0;i<30&&started.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(started.length,2,'Both private reads start before either completes');assert.equal(providerCalls,0,'No provider starts before saved context is validated');
  release();await run;assert.ok(events.some(event=>event.type==='done'));
});
await test('third seller-feed result reaches verification and visual review',async()=>{
  const links=['https://www.moodfabrics.com/products/white-faux-fur','https://www.moodfabrics.com/products/blue-faux-fur','https://www.moodfabrics.com/products/red-faux-fur'];
  const events=[],visited=[];let ranks=0;
  const service=createFabricSearch({...store(),fetchImpl:async target=>{
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:links.map((url,i)=>({url,title:['White faux fur fabric','Blue faux fur fabric','Red faux fur fabric'][i]}))}}});
    visited.push(target);const i=links.indexOf(target);assert.ok(i>=0);return new Response(seller({url:target,name:['White faux fur fabric','Blue faux fur fabric','Red faux fur fabric'][i],description:['White faux fur sold by the yard.','Blue faux fur sold by the yard.','Red faux fur sold by the yard.'][i]}));
  },rank:async({products})=>{ranks++;return products;}});
  await service.search(user,{request:'red faux fur',piece:{name:'Coat',fabric:'red faux fur'},storeGroups:['mood'],image},event=>events.push(event));
  assert.ok(visited.includes(links[2]),'The third feed item is verified');assert.equal(ranks,1);
  assert.deepEqual(events.at(-1).products.map(p=>p.url),[links[2]],'Only the matching third item survives qualification and visual review');
});
await test('retailer expansion stays balanced and capped at eight visual candidates',async()=>{
  const events=[],visited=[];let ranks=0;
  const service=createFabricSearch({...store(),fetchImpl:async target=>{
    const host=new URL(target).hostname;
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[1,2,3].map(n=>({url:'https://'+host+'/products/red-wool-'+n,title:'Red wool fabric '+n}))}}});
    visited.push(target);return new Response(seller({url:target,name:'Red wool fabric',description:'Red wool fabric sold by the yard.'}));
  },rank:async({products})=>{ranks++;assert.equal(products.length,8);return products;}});
  await service.search(user,{request:'red wool',piece:{name:'Coat',fabric:'red wool'},image},event=>events.push(event));
  assert.equal(visited.length,8);assert.equal(new Set(visited.map(link=>new URL(link).hostname)).size,5,'One seller cannot occupy the whole verification budget');
  assert.equal(ranks,1);assert.equal(events.at(-1).products.length,8);
});
await test('cited online merchants survive a local-heavy discovery list',async()=>{
 const urls=[...Array.from({length:9},(_,i)=>'https://britexfabrics.com/products/red-wool-'+i),'https://www.moodfabrics.com/products/red-wool','https://www.swatchon.com/fabric/QL-061078','https://amazon.com/dp/B000000001','https://www.tessuti.com.au/products/red-wool'];
 const discovery=response({candidates:urls.map(url=>({url,reason:'Red wool fabric'}))});discovery.output[0].action.sources=urls.map(url=>({url}));
 const found=readDiscovery(discovery);assert.equal(found.candidates.length,8);for(const host of ['www.moodfabrics.com','www.swatchon.com','amazon.com','www.tessuti.com.au'])assert.ok(found.candidates.some(c=>new URL(c.url).hostname===host),'Online merchant preserved: '+host);
 const req=webSearchBody(normalizeFabricRequest({request:'wool',storeGroups:['local','mood','swatchon','amazon','others']}),'fixture');assert.equal(req.tools[0].filters.allowed_domains.length,9);
});
await test('empty/error searches retry and never populate a shared private query cache',async()=>{
  const s=store();let calls=0;const events=[];
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async u=>{if(u.includes('openai')){calls++;return new Response('',{status:503});}return new Response('',{status:503});}});
  for(let n=0;n<2;n++)await service.search(user,{request:'matte wool',history:[{request:'red wool'}]},e=>events.push(e));
  assert.equal(calls,2);assert.ok(events.at(-1).warning);assert.equal(events.at(-1).products.length,0);
  assert.equal([...s.records.keys()].some(k=>k.startsWith('catalog/')),false);
});
await test('lookbooks isolate accounts and submissions, persist selection and reject stale writes',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured',fetchImpl:async()=>new Response(seller())}),product=parseListing(seller(),url);
  const b=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',product});assert.equal(b.selectedUrl,url);
  assert.equal((await service.loadBook(second,'project-A')).items.length,0);assert.equal((await service.loadBook(user,'project-B')).items.length,0);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'0',action:'save',product}),e=>e.status===409);
  const removed=await service.saveBook(user,{submissionId:'project-A',generation:b.generation,action:'remove',product});assert.equal(removed.items.length,0);assert.equal(removed.selectedUrl,'');
  await assert.rejects(service.loadBook(user,'does-not-exist'),e=>e.status===404);
});
await test('automatic searches require saved dissection and trust saved garment context over supplied guesses',async()=>{
  const s=store();let sent;
  const denim='https://britexfabrics.com/products/indigo-denim';
  const shirt='https://stonemountainfabric.com/product/white-cotton-poplin/';
  const scissors='https://britexfabrics.com/products/fabric-scissors';
  const leather='https://britexfabrics.com/products/black-leather';
  const pages=new Map([[denim,{name:'Indigo cotton denim',description:'Cotton denim, sold by the yard.'}],[shirt,{name:'White cotton poplin',description:'100% cotton, sold by the yard.'}],[scissors,{name:'Fabric scissors',description:'Scissors for denim and cotton fabric.'}],[leather,{name:'Black leather',description:'Black leather, sold by the hide.'}]]);
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async(u,o)=>{
    if(u.includes('api.openai.com')){sent=JSON.parse(o.body);return Response.json({output:[{type:'web_search_call',action:{sources:[...pages.keys()].map(url=>({url}))}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[...pages.keys()].map(url=>({url,reason:'model suggestion',garment:'Incorrect model garment'}))})}]}]});}
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[]}}});
    return new Response(seller({...pages.get(u),url:u}));
  }});
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true},()=>{}),e=>e.status===409);
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Denim top',fabric:'indigo denim'},{name:'White shirt',fabric:'white cotton poplin'},{name:'Black boots',fabric:'black leather',category:'footwear'}]})),generation:'1'});
  // These preferences are for the earlier wool fixture, not this saved look.
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:'Natural fabrics preferred'})),generation:'2'});
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,image,pieces:[{name:'Wrong',fabric:'leather'}]},e=>events.push(e));
  assert.deepEqual(events.at(-1).products.map(p=>[p.title,p.garment]),[['Indigo cotton denim','Denim top'],['White cotton poplin','White shirt']]);
  const input=JSON.parse(sent.input[0].content[0].text);assert.equal(input.garments.length,2);assert.doesNotMatch(JSON.stringify(input),/Wrong|boots|leather/);assert.equal(sent.input[0].content[1].image_url,image);
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Wrong'}},()=>{}),e=>e.status===409);
  const selected=[];await service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Denim top',fabric:'leather'},stores:['britexfabrics.com']},e=>selected.push(e));
  assert.deepEqual(selected.at(-1).products.map(p=>p.title),['Indigo cotton denim']);assert.deepEqual(sent.tools[0].filters.allowed_domains,['britexfabrics.com']);
});
await test('local in-house photo favorites share the sealed book without invented inventory or arrival',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured'});
  const product={url:'/aesthetics/fabrics/Midnight%20Velvet.JPG',title:'Midnight Velvet',price:'in stock',etaDays:7,availability:'in_stock',garment:'Evening jacket'};
  const book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',product});
  assert.equal(book.items[0].image,product.url);assert.equal(book.items[0].availability,'unknown');assert.equal(book.items[0].etaDays,undefined);assert.equal(book.items[0].price,undefined);
  assert.equal((await service.loadBook(second,'project-A')).items.length,0);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...product,url:'/aesthetics/fabrics/%2e%2e/private.png'}}));
});
await test('real dissection handoff preserves traits and active search uses saved material context',async()=>{
  const source=readFileSync(new URL('../backend/backend.html',import.meta.url),'utf8');
  const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const code=extract('const _pieceSources = new WeakMap()', '// v0.9: focusPiece');
  const crop='data:image/png;base64,c2F2ZWQtY29hdA==';
  const piece={name:'Coat',fabric:'Crimson wool',fabric_hex:'#991b2a',fabric_spec:{fiber:'wool',weave:'twill',sheen:'matte',stretch:'none',texture:'brushed',weight_gsm:null},fabric_source:{url},_image:crop,jacket_construction:'double-breasted'};
  const sandbox={};vm.createContext(sandbox);vm.runInContext(code,sandbox);
  const normalized=sandbox.inferPieces({_dissection:{pieces:[piece]}})[0];
  assert.equal(normalized.fabric_spec.weave,'twill');assert.equal(normalized.fabric_hex,'#991b2a');assert.equal(normalized.jacket_construction,'double-breasted');assert.equal(normalized.fabric_source.url,url);
  const s=store(),events=[];let discovered,ranked;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[normalized]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{
    if(u.includes('openai')){discovered=JSON.parse(o.body);return Response.json(response());}
    return new Response(seller());
  },rank:async input=>{ranked=input;return input.products;}});
  await service.search(user,{submissionId:'project-A',automatic:true,image,piece:{id:normalized.id,fabric:'Forged polyester'},preferences:'Forged preference'},event=>events.push(event));
  const context=JSON.parse(discovered.input[0].content[0].text);
  assert.equal(discovered.input[0].content[1].image_url,image);assert.equal(context.garment.fabric_hex,'#991b2a');assert.equal(context.garment.fabric_spec.weave,'twill');assert.match(context.clientFabricPreferences,/100% wool, no polyester/);
  assert.equal(ranked.garmentImage,crop);assert.equal(ranked.traits.weave,'twill');assert.equal(ranked.traits.texture,'brushed');assert.equal(ranked.traits.garments[0].fabric_hex,'#991b2a');assert.match(ranked.traits.preferences,/no polyester/);
  assert.doesNotMatch(JSON.stringify([discovered,ranked]),/Forged/);assert.equal(events.at(-1).products[0].garmentId,normalized.id);
});
await test('routes authenticate before search or lookbook IO and limit search requests',async()=>{
  const routes=[];const app={post:(...a)=>routes.push(a),get:(...a)=>routes.push(a)};let reads=0;
  mountFabricSearch(app,{requireAdmin:async()=>{throw Object.assign(Error('denied'),{status:403});},requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),read:async()=>{reads++;},write:async()=>{},model:'fake'});
  for(const route of routes){let code;const res={on(){},status(n){code=n;return this;},json(){},set(){return this;}};await route.at(-1)({body:{},query:{}},res);assert.equal(code,403);}
  assert.equal(reads,0);
});
await test('duplicate garment names require stable saved identity instead of selecting the first',async()=>{
  const s=store();s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Shirt',fabric:'red wool'},{name:'Shirt',fabric:'white cotton poplin'}]})),generation:'1'});
  let sent;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{if(u.includes('openai')){sent=JSON.parse(JSON.parse(o.body).input[0].content[0].text);return Response.json(response());}return new Response(seller({name:'White cotton poplin fabric',description:'100% cotton. Sold by the yard.',material:'100% cotton'}));}});
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Shirt'}},()=>{}),e=>e.status===409);
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'saved-piece-1',name:'Shirt'}},e=>events.push(e));
  assert.equal(sent.garment.fabric,'white cotton poplin');assert.equal(events.at(-1).products[0].garmentId,'saved-piece-1');
});
await test('one visual pass only sees eligible seller products and cannot introduce a URL or weak fallback',async()=>{
  const s=store(),events=[];let calls=0,seen;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async input=>{calls++;seen=input;return [{url,reason:'Closer brushed surface',matchScore:88},{url:'https://britexfabrics.com/products/invented'}];}});
  await service.search(user,{submissionId:'project-A',request:'crimson wool twill',image,history:[{request:'wool'}]},e=>events.push(e));
  assert.equal(calls,1);assert.equal(seen.garmentImage,image);assert.match(seen.traits.request,/crimson wool/);assert.equal(seen.products.length,1);
  assert.equal(events.at(-1).products.length,1);assert.equal(events.at(-1).products[0].matchScore,undefined);assert.equal(events.at(-1).products[0].price,'69.99');
  const unavailable=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async()=>{throw Error('timeout');}});
  const failed=[];await unavailable.search(user,{request:'wool twill',image,history:[{request:'wool'}]},e=>failed.push(e));
  assert.deepEqual(failed.at(-1).products,[]);assert.match(failed.at(-1).warning,/comparison was unavailable/);
  const rejected=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async()=>[]});
  const weak=[];await rejected.search(user,{request:'wool twill',image,history:[{request:'wool'}]},e=>weak.push(e));assert.deepEqual(weak.at(-1).products,[]);
});
await test('uncertain saved fiber requires a successful visual check and never a keyword fallback',async()=>{
  const s=store();s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Jacket',fabric:'Unknown fiber, matte structured surface'}]})),generation:'1'});
  const common={...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller())};
  let count=0;const events=[];await createFabricSearch({...common,rank:async ({products})=>{count++;return products;}}).search(user,{automatic:true,submissionId:'project-A',image},e=>events.push(e));
  assert.equal(count,1);assert.equal(events.at(-1).products.length,1);
  const without=[];await createFabricSearch(common).search(user,{automatic:true,submissionId:'project-A',image},e=>without.push(e));assert.deepEqual(without.at(-1).products,[]);
});
await test('selected garment ranks its saved crop while discovery keeps the original whole look',async()=>{
  const s=store(),crop='data:image/png;base64,c2F2ZWQtZGVuaW0=';let ranked,discovered;
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'denim',name:'Denim jacket',fabric:'indigo denim',_image:crop},{id:'shirt',name:'White shirt',fabric:'white cotton poplin',_image:image}]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{if(u.includes('openai')){discovered=JSON.parse(o.body);return Response.json(response());}return new Response(seller({name:'Indigo denim fabric',description:'100% cotton denim. Sold by the yard.',material:'100% cotton'}));},rank:async input=>{ranked=input;return input.products;}});
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,image,piece:{id:'denim',_image:'untrusted-client-crop'}},e=>events.push(e));
  assert.equal(discovered.input[0].content[1].image_url,image);assert.equal(ranked.garmentImage,crop);assert.equal(ranked.traits.garmentId,'denim');assert.equal(ranked.products[0].garmentId,'denim');
  assert.equal(events.at(-1).products[0].garment,'Denim jacket');assert.doesNotMatch(JSON.stringify(discovered),/untrusted-client-crop/);
});
await test('supplementary seller results cannot bypass a failed visual check when web search fails',async()=>{
  const events=[];let calls=0;
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async u=>{
    if(u.includes('openai'))return new Response('',{status:503});
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,available:true}]}}});
    return new Response(seller());
  },rank:async()=>{calls++;throw Error('visual unavailable');}});
  await service.search(user,{request:'crimson wool',image},event=>events.push(event));
  assert.ok(events.some(event=>event.preliminary&&event.products.length));assert.equal(calls,1);
  assert.deepEqual(events.at(-1).products,[]);assert.match(events.at(-1).warning,/comparison was unavailable/);
});
await test('lookbook selections bind to canonical garments, preserve reuse and remove every assignment',async()=>{
  const s=store(),pieces=[{id:'coat',name:'Coat',fabric:'wool'},{id:'pants',name:'Pants',fabric:'cotton'}];
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  let fetches=0,pieceReads=0;const service=createFabricSearch({...s,read:async key=>{if(key.endsWith('/pieces.json'))pieceReads++;return s.read(key);},fetchImpl:async()=>{fetches++;return new Response(seller());}});
  const product={...parseListing(seller(),url),garmentId:'coat',garment:'Forged name'};
  let book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:'coat',product});
  assert.deepEqual(book.selectedByGarment,{coat:url});assert.equal(book.items[0].garment,'Coat');assert.equal(fetches,1);
  assert.equal(pieceReads,1,'A mutation reads and parses the private dissection once, including its response');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'pants',product}),e=>e.status===409);
  const before=pieceReads;book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'pants',product:{url,title:'Client edit ignored',price:'0.01'}});
  assert.deepEqual(book.selectedByGarment,{coat:url,pants:url});assert.equal(book.items[0].title,'Crimson wool twill');assert.equal(fetches,1,'Reselecting a stored URL needs no retailer or paid request');
  assert.equal(pieceReads-before,1,'Lookbook read, validation and acknowledgement share one request-local dissection');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'unknown',product:{url}}),e=>e.status===409);
  const otherAccount=await service.loadBook(second,'project-A');assert.deepEqual(otherAccount.selectedByGarment,{});
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'remove',product:{url}});
  assert.deepEqual(book.selectedByGarment,{});assert.equal(book.selectedUrl,'');assert.equal(book.items.length,0);assert.equal(fetches,1);
});
await test('legacy lookbook reads only infer unambiguous garment selections and never write migrations',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';let writes=0;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Coat',fabric:'wool'},{name:'Shirt',fabric:'cotton'},{name:'Shirt',fabric:'linen'}]})),generation:'1'});
  const service=createFabricSearch({...s,write:async()=>{writes++;}}),product=parseListing(seller(),url);
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
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',pieceKey='submissions/project-A/pieces.json',product={...parseListing(seller(),url),garment:'Coat',garmentId:'kept'};
  s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces:[{id:'kept',name:'Coat',fabric:'wool'}]})),generation:'2'});
  const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{kept:url,removed:url}});
  s.records.set(key,{buf:Buffer.from(raw),generation:'4'});
  const service=createFabricSearch({...s,fetchImpl:async()=>{throw Error('Stored selections do not need retailer access');}});
  const book=await service.loadBook(user,'project-A');assert.deepEqual(book.selectedByGarment,{kept:url});assert.equal(book.items.length,1);assert.equal(s.records.get(key).buf.toString(),raw,'Read does not write a migration');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'3',action:'select',garmentId:'kept',product:{url}}),e=>e.status===409);assert.equal(s.records.get(key).buf.toString(),raw);
  const updated=await service.saveBook(user,{submissionId:'project-A',generation:'4',action:'select',garmentId:'kept',product:{url}});
  assert.deepEqual(updated.selectedByGarment,{kept:url});assert.deepEqual(JSON.parse(s.records.get(key).buf).selectedByGarment,{kept:url});
});
await test('selection fingerprints reject reused IDs but preserve stable garments through reorder and production work',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',pieceKey='submissions/project-A/pieces.json';
  const coat={id:'saved-piece-0',name:'Coat',fabric:'Crimson wool',fabric_spec:{fiber:'wool',weave:'twill'}},pants={id:'pants',name:'Pants',fabric:'cotton'};
  const writePieces=pieces=>s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  writePieces([coat,pants]);
  const service=createFabricSearch({...s,fetchImpl:async()=>new Response(seller())});
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
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',product={...parseListing(seller(),url),garment:'Coat',garmentId:'coat'};
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat',fabric:'wool'}]})),generation:'1'});
  const service=createFabricSearch({...s});
  for(const selectedGarmentFingerprints of [null,[],{}, {coat:'invalid'}, {coat:'v1:'+'a'.repeat(64),extra:'v1:'+'b'.repeat(64)}]){
    const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{coat:url},selectedGarmentFingerprints});s.records.set(key,{buf:Buffer.from(raw),generation:'5'});
    await assert.rejects(service.loadBook(user,'project-A'),error=>error.status===503);
    await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'5',action:'remove',product:{url}}),error=>error.status===503);assert.equal(s.records.get(key).buf.toString(),raw);
  }
});
await test('new saved seller facts are verified server-side; failures preserve the book and retries',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';let calls=0;
  const service=createFabricSearch({...s,fetchImpl:async target=>{calls++;assert.ok(!target.includes('openai'),'Saving never searches or ranks');return target===url?new Response(seller()):new Response('',{status:503});}});
  const tampered={url,title:'Fake leather',price:'0.01',unit:'yard',currency:'USD',availability:'in_stock',evidence:'atelier_inventory',composition:'100% silk',image:'https://bad.example/fake.png'};
  const book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'save',product:tampered});
  assert.equal(book.items[0].title,'Crimson wool twill');assert.equal(book.items[0].price,'69.99');assert.equal(book.items[0].composition,'100% wool');assert.equal(book.items[0].image,'https://cdn.shopify.com/wool.jpg');assert.equal(book.items[0].evidence,'seller_listing');
  const previous=s.records.get(key).buf.toString();
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...tampered,url:'https://evil.example/products/fabric'}}),e=>e.status===400);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...tampered,url:other}}),e=>e.status===422);
  assert.equal(s.records.get(key).buf.toString(),previous);assert.equal(calls,2);
  const unavailable=createFabricSearch({...s,fetchImpl:async()=>{throw Error('Retailer offline');}});
  const selected=await unavailable.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',product:{url}});
  assert.equal(selected.selectedUrl,url,'An already stored source remains selectable when its retailer is unavailable');
});
await test('canonical full-look preferences and selected scopes survive the service request boundary',async()=>{
  const s=store(),furUrl='https://britexfabrics.com/products/faux-fur',leatherUrl='https://britexfabrics.com/products/leather';let discovery;
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:{coat:'Brown faux fur',pants:'Green alligator leather',exclude:['polyester']}})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Fur coat',fabric:'Brown faux fur',fabric_spec:{fiber:'acrylic'}},{id:'pants',name:'Green pants',fabric:'Green leather'}]})),generation:'1'});
  const pages={[furUrl]:{name:'Brown faux fur fabric',description:'100% acrylic long pile. Sold by the yard.',material:'100% acrylic'},[leatherUrl]:{name:'Green alligator leather fabric',description:'Green leather. Sold by the yard.',material:'Leather'}};
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{if(target.includes('openai')){discovery=JSON.parse(options.body);return Response.json({output:[{type:'web_search_call',action:{sources:Object.keys(pages).map(url=>({url}))}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:Object.keys(pages).map(url=>({url}))})}]}]});}return new Response(seller({...pages[target],url:target}));}});
  const full=[];await service.search(user,{automatic:true,submissionId:'project-A',image},event=>full.push(event));
  assert.deepEqual(full.at(-1).products.map(p=>[p.url,p.garmentId]),[[furUrl,'coat'],[leatherUrl,'pants']]);
  const selected=[];await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},event=>selected.push(event));
  assert.deepEqual(selected.at(-1).products.map(p=>p.url),[furUrl]);assert.match(JSON.stringify(discovery),/Green alligator leather/,'Original client preferences remain in discovery');
  const normalized=normalizeFabricRequest({request:'fabric',preferences:{coat:'brown faux fur',exclude:['polyester']}});assert.match(normalized.preferences,/brown faux fur/);assert.doesNotMatch(normalized.preferences,/object Object/);
});
await test('duplicate literal seller links are verified once and published once',async()=>{
  let pages=0;const service=createFabricSearch({...store(),fetchImpl:async target=>{if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url},{url}]}}});pages++;return new Response(seller());}});
  const events=[];await service.search(user,{request:'crimson wool'},event=>events.push(event));
  assert.equal(pages,1);assert.equal(events.at(-1).products.length,1);
});
await test('collection and direct Shopify aliases produce one ranked card without rewriting sources or variants',async()=>{
  const alias='https://britexfabrics.com/collections/fabrics/products/crimson-wool',seen=[],events=[];let ranks=0;
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai'))return Response.json(response());
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url:alias}]}}});
    seen.push(target);return new Response(seller());
  },rank:async({products})=>{ranks++;assert.equal(products.length,1,'Retailer and web aliases consume one visual slot');return products;}});
  await service.search(user,{request:'crimson wool',image},e=>events.push(e));
  assert.equal(ranks,1);assert.equal(events.at(-1).products.length,1);
  assert.equal(seen.length,1,'Concurrent web/feed aliases share one actual seller read');
  assert.ok([url,alias].includes(events.at(-1).products[0].url));assert.ok(seen.includes(events.at(-1).products[0].url),'The returned source is an actual fetched destination, never a rewritten URL');
  await service.verify({url:alias});assert.ok(seen.includes(alias),'An explicit alias read must preserve its literal fetch/source destination');
  const answer=response({candidates:[{url:alias},{url},{url:url+'?variant=2'}]});answer.output[0].action.sources.push({url:alias},{url:url+'?variant=2'});
  assert.deepEqual(readDiscovery(answer).candidates.map(p=>p.url),[alias,url+'?variant=2'],'Aliases deduplicate while distinct selected variants remain distinct');
});
await test('stored preference parse failures stop before providers and structured exclusions are not truncated',async()=>{
  const s=store();let providers=0;const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async()=>{providers++;throw Error('must not call');}});
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{broken'),generation:'1'});
  await assert.rejects(service.search(user,{submissionId:'project-A',request:'wool',preferences:'client fallback'},()=>{}),e=>e.status===503);assert.equal(providers,0);
  const preferences={notes:'neutral '.repeat(180),coat:'Brown faux fur',exclude:['polyester']};
  assert.deepEqual(JSON.parse(normalizeFabricRequest({request:'fabric',preferences}).preferences),preferences,'Longer structured preferences keep their final exclusion and valid structure');
  assert.throws(()=>normalizeFabricRequest({request:'fabric',preferences:'x'.repeat(12001)}),e=>e.status===400);
});
await test('store-only constraints survive a redirect to another approved merchant',async()=>{
  const events=[],service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai'))return Response.json(response());
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url}]}}});
    if(target===url)return new Response('',{status:302,headers:{location:other}});
    return new Response(seller({url:other}));
  }});
  await service.search(user,{request:'crimson wool, only Britex',stores:['britexfabrics.com'],image},event=>events.push(event));
  assert.ok(events.every(event=>!event.products?.length),'Neither preliminary nor final results bypass the store filter after a redirect');
});
await test('concurrent garment selections cannot both acknowledge an overwrite',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat'},{id:'pants',name:'Pants'}]})),generation:'1'});
  const service=createFabricSearch({...s,fetchImpl:async()=>new Response(seller())});
  const results=await Promise.allSettled(['coat','pants'].map(garmentId=>service.saveBook(user,{submissionId:'project-A',generation:'0',garmentId,action:'select',product:{url}})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
  assert.equal(Object.keys(JSON.parse(s.records.get(key).buf).selectedByGarment).length,1);
});
await test('saved garment retailer results survive an empty web answer and still pass visual review',async()=>{
  const s=store(),feeds=[],events=[];let ranks=0;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'PRIVATE PERSON coat',fabric:'Crimson wool twill'}]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
    if(target.includes('openai'))return Response.json(response({candidates:[]}));
    if(target.includes('suggest.json')){feeds.push(new URL(target).searchParams.get('q'));return Response.json({resources:{results:{products:[{url}]}}});}
    return new Response(seller());
  },rank:async({products})=>{ranks++;return products;}});
  await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},e=>events.push(e));
  assert.ok(feeds.length&&feeds.length<=10,'Automatic saved garments get bounded direct retailer queries');
  assert.ok(feeds.every(q=>/wool|twill/.test(q)&&!q.includes('PRIVATE')),'Public queries contain material vocabulary only');
  assert.equal(ranks,1);assert.deepEqual(events.at(-1).products.map(p=>p.url),[url]);
  assert.ok(events.find(e=>e.type==='context')?.searchDetails.retailerQueries.length);
});
await test('discovery exposes actual tool queries and rejects malformed result objects',()=>{
  const body=response();body.output[0].action.queries=['burgundy wool fabric site:britexfabrics.com'];
  assert.deepEqual(readDiscovery(body).webQueries,body.output[0].action.queries);
  const colored=response({garmentColors:[{garmentId:'jacket',colors:['red','red','not a color',{},'white','blue']},null,{garmentId:{},colors:['red']}]});
  assert.deepEqual(readDiscovery(colored).garmentColors,[{garmentId:'jacket',colors:['red','white']}]);
  assert.deepEqual(readDiscovery(response({garmentColors:[{garmentId:'jacket',colors:['red']},{garmentId:'jacket',colors:['white']}]})).garmentColors,[],'Ambiguous repeated garment observations cannot pick an arbitrary last color');
  for(const value of [null,[],{}, {candidates:'invalid'}]){
    const broken=response();broken.output[1].content[0].text=JSON.stringify(value);
    assert.throws(()=>readDiscovery(broken),/unreadable|invalid|incomplete/i);
  }
});
await test('www source aliases retain evidence identity without accepting unrelated source paths',()=>{
  const result=response({candidates:[{url:'https://www.britexfabrics.com/products/crimson-wool'},null,{url:'https://britexfabrics.com/products/uncited'}]});
  assert.deepEqual(readDiscovery(result).candidates.map(c=>c.url),['https://www.britexfabrics.com/products/crimson-wool']);
  const input=normalizeFabricRequest({request:'black wool fabric',image});
  assert.deepEqual(webSearchBody(input,'gpt-6-luna').reasoning,{effort:'low'});
  assert.equal(webSearchBody(input,'configured-legacy').reasoning,undefined);assert.equal(webSearchBody(input,'gpt-5-pro').reasoning,undefined);
});
await test('canonical mixed-material garments keep original words but qualify their base cloth independently',async()=>{
  const s=store(),piece={id:'coat',name:'Embellished coat',fabric:'Black brushed wool blend with cognac suede leather appliqué',fabric_spec:{fiber:'wool blend with leather appliqué',weave:'Dense brushed twill',texture:'brushed'},_image:image};
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:['Denim','Leather']})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[piece]})),generation:'1'});
  for(const comparisonAvailable of [true,false]){
    const events=[];let ranked=0,sent;
    const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
      if(target.includes('openai')){sent=JSON.parse(options.body);return Response.json(response());}
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url}]}}});
      return new Response(seller({name:'Black brushed wool coating',description:'100% wool coating, sold by the yard.'}));
    },rank:async({products})=>{ranked++;assert.equal(products.length,1);if(!comparisonAvailable)throw Error('unavailable');return products;}});
    await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},e=>events.push(e));
    assert.equal(ranked,1);assert.equal(events.at(-1).products.length,comparisonAvailable?1:0);
    assert.equal(events.at(-1).searchDetails.preferences,JSON.stringify(['Denim','Leather']));
    assert.doesNotMatch(events.at(-1).searchDetails.retailerQueries.join(' '),/denim|leather/);
    const context=JSON.parse(sent.input[0].content[0].text);assert.match(context.garment.fabric,/leather appliqué/);assert.equal(context.clientFabricPreferences,JSON.stringify(['Denim','Leather']),'Original words remain intact for discovery');
  }
});
await test('saved burgundy fur rejects ivory and retailer notions cannot crowd out the third fabric listing',async()=>{
  const s=store(),piece={id:'jacket',name:'Shag jacket',fabric:'Long-pile faux fur',fabric_hex:'#991b2a',fabric_spec:{fiber:'polyester',texture:'long-pile'},_image:image};
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:['Leather','Denim']})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[piece]})),generation:'1'});
  const ivory='https://britexfabrics.com/products/ivory-fur',red='https://britexfabrics.com/products/burgundy-fur',events=[],visited=[];let ranked=0;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
    if(target.includes('openai')){const answer=response({garmentColors:[{garmentId:'jacket',colors:['red']}],candidates:[{url:ivory}]});answer.output[0].action.sources.push({url:ivory});return Response.json(answer);}
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{title:'Leather button',url:'https://britexfabrics.com/products/button-a'},{title:'Sewing needles',url:'https://britexfabrics.com/products/needles'},{title:'Burgundy long pile polyester faux fur',url:red}]}}});
    visited.push(target);return new Response(seller(target.includes('burgundy-fur')?{name:'Burgundy long pile polyester faux fur',description:'Burgundy polyester faux fur. Sold by the yard.',url:red,material:'polyester'}:{name:'Ivory polyester faux fur',description:'Creamy eggshell ivory polyester. Sold by the yard.',url:ivory,material:'polyester'}));
  },rank:async({products})=>{ranked++;assert.deepEqual(products.map(p=>p.url),[red]);return products;}});
  await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'jacket'},image},e=>events.push(e));
  assert.equal(ranked,1);assert.deepEqual(events.at(-1).products.map(p=>p.url),[red]);assert.match(events.at(-1).searchDetails.retailerQueries[0],/red/);
  assert.ok(!visited.some(u=>/button-a|needles/.test(u)),'Known notions are discarded before the bounded verification budget');
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{...piece,fabric_hex:''}]})),generation:'2'});
  const legacy=[];await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'jacket'},image},e=>legacy.push(e));
  assert.equal(ranked,2);assert.deepEqual(legacy.at(-1).products.map(p=>p.url),[red],'Legacy garments without hex use the scoped qualified observation, never accept opposite seller colors on a high rank alone');
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
      return new Promise(resolve=>{release=()=>resolve(Response.json(response()));});
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
await test('seller redirects and variant facts share one total verification budget',async()=>{
  const nativeTimeout=AbortSignal.timeout;let attempts=0,budget;
  AbortSignal.timeout=ms=>{const signal=nativeTimeout.call(AbortSignal,ms===8000?55:ms);if(ms===8000)budget=signal;return signal;};
  const keepAlive=setInterval(()=>{},1000);
  try{
    const service=createFabricSearch({...store(),fetchImpl:async(target,options)=>{
      attempts++;
      if(attempts===2)await new Promise((resolve,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});
      return new Response('',{status:302,headers:{location:url+'?variant='+attempts}});
    }});
    const result=await service.verify({url});assert.equal(result.evidence,'search_link');assert.equal(budget?.aborted,true,'The shared budget expires before a fresh six-second hop deadline');assert.equal(attempts,2,'No fresh third-hop timeout after the listing budget expires');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);}
});
await test('a non-cooperative web search cannot block reviewed retailer results',async()=>{
  const nativeTimeout=AbortSignal.timeout,events=[];let release,ranks=0;
  const keepAlive=setInterval(()=>{},1000);
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===20000?40:ms);
  try{
    const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
      if(target.includes('api.openai.com'))return new Promise(resolve=>release=()=>resolve(Response.json(response())));
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,title:'Crimson wool fabric'}]}}});
      return new Response(seller());
    },rank:async({products})=>{ranks++;return products;}});
    await service.search(user,{request:'crimson wool',image},event=>events.push(event));
    assert.equal(ranks,1);assert.deepEqual(events.at(-1).products.map(product=>product.url),[url]);assert.match(events.at(-1).warning,/interrupted|too long/i);
    const n=events.length;release();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(events.length,n,'Late discovery cannot replace completed results');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('non-cooperative retailer responses respect their independent budgets',async()=>{
  const nativeTimeout=AbortSignal.timeout,events=[];let release,attempts=0;
  const keepAlive=setInterval(()=>{},1000);
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===4500||ms===8000?40:ms);
  try{
    const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
      if(target.includes('api.openai.com'))return Response.json(response());
      if(target.includes('suggest.json'))return new Promise(()=>{});
      return new Response(seller());
    }});
    await service.search(user,{request:'crimson wool'},event=>events.push(event));
    assert.deepEqual(events.at(-1).products.map(product=>product.url),[url],'A stalled feed does not block a verified web result');
    const redirecting=createFabricSearch({...store(),fetchImpl:async()=>{attempts++;return new Promise(resolve=>{release=()=>resolve(new Response('',{status:302,headers:{location:url}}));});}});
    const result=await redirecting.verify({url});assert.equal(result.evidence,'search_link');release();await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal(attempts,1,'A late response cannot launch another redirect after the budget');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('web seller checks start while keyword feeds are still pending and share duplicate checks',async()=>{
  let releaseFeeds,releaseSeller,feedCalls=0,sellerCalls=0,webCalls=0,ranks=0;
  const feeds=new Promise(resolve=>releaseFeeds=resolve),sellerGate=new Promise(resolve=>releaseSeller=resolve);
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai.com')){webCalls++;return Response.json(response());}
    if(target.includes('suggest.json')){feedCalls++;await feeds;return Response.json({resources:{results:{products:[{url,title:'Crimson wool fabric'}]}}});}
    sellerCalls++;await sellerGate;return new Response(seller());
  },rank:async({products})=>{ranks++;return products;}});
  const events=[],pending=service.search(user,{request:'crimson wool, only Britex',image},event=>events.push(event));
  try{
    for(let i=0;i<20&&(!feedCalls||!webCalls||!sellerCalls);i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sellerCalls,1,'Web listing verification must not wait for the slowest seed feed');
    releaseFeeds();for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sellerCalls,1,'The same listing is fetched once across discovery and direct seeds');
    releaseSeller();await pending;assert.equal(ranks,1);assert.equal(webCalls,1);assert.equal(events.at(-1).products.length,1);assert.ok(events.at(-1).timings.firstResultsMs<=events.at(-1).timings.totalMs,'Timings reflect completed checks');
  }finally{releaseFeeds();releaseSeller();await pending;}
});
await test('a ready retailer starts seller checks before an unrelated slow feed settles',async()=>{
  let releaseFeeds,releaseSeller,sellerCalls=0,rankCalls=0;
  const feeds=new Promise(resolve=>releaseFeeds=resolve),sellerGate=new Promise(resolve=>releaseSeller=resolve);
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai.com'))return Response.json(response({candidates:[]}));
    if(target.includes('suggest.json')){
      if(target.includes('moodfabrics.com'))await feeds;
      return Response.json({resources:{results:{products:target.includes('britexfabrics.com')?[{url,title:'Crimson wool fabric'}]:[]}}});
    }
    sellerCalls++;await sellerGate;return new Response(seller());
  },rank:async({products})=>{rankCalls++;return products;}});
  const events=[],pending=service.search(user,{request:'crimson wool',image},event=>events.push(event));
  try{
    for(let i=0;i<30&&!sellerCalls;i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sellerCalls,1,'A slow unrelated feed must not postpone the ready listing verification');
    assert.equal(events.some(event=>event.type==='done'),false,'No unchecked early results');
    releaseSeller();releaseFeeds();const stats=await pending;
    assert.equal(sellerCalls,1,'Final selection reuses the same seller check');assert.equal(rankCalls,1);assert.deepEqual(events.at(-1).products.map(p=>p.url),[url]);
    assert.deepEqual(Object.keys(stats).sort(),['contextMs','count','firstResultsMs','retailerMs','totalMs','visualMs','webMs','webSellerMs'].sort(),'Logs contain only fixed aggregate timing names and counts');
    for(const key of ['contextMs','webMs','retailerMs','webSellerMs','visualMs']){assert.ok(Number.isFinite(stats[key])&&stats[key]>=0);assert.equal(events.at(-1).timings[key],stats[key]);}
  }finally{releaseSeller();releaseFeeds();await pending;}
});
await test('early retailer checks stay within the same eight balanced seller slots',async()=>{
  const visits=[],events=[];
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai.com'))return Response.json(response({candidates:[]}));
    if(target.includes('suggest.json')){const u=new URL(target),q=u.searchParams.get('q');return Response.json({resources:{results:{products:Array.from({length:3},(_,i)=>({url:u.hostname==='britexfabrics.com'&&i===0?(q.includes('twill')?'/collections/cloth/products/shared-red-wool':'/products/shared-red-wool'):'/products/'+encodeURIComponent(q)+'-'+i,title:'Crimson wool fabric'}))}}});}
    visits.push(target);return new Response(seller({url:target}));
  },rank:async({products})=>products});
  await service.search(user,{request:'red wool twill',piece:{fabric:'Red wool twill'},image},event=>events.push(event));
  assert.equal(visits.length,8,'Early work cannot add seller requests beyond the selected eight');
  assert.equal(new Set(visits).size,8);assert.equal(events.at(-1).products.length,8);
  assert.equal(new Set(events.at(-1).products.map(p=>new URL(p.url).hostname)).size,5,'All five eligible feed merchants retain their slots');
});
await test('optional variant metadata has a short deadline without dropping valid seller listings',async()=>{
  const nativeTimeout=AbortSignal.timeout,keepAlive=setInterval(()=>{},1000);let variantSignal;
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===1200?35:ms);
  try{
    const service=createFabricSearch({...store(),fetchImpl:async(target,options)=>{
      if(target.endsWith('.js')){variantSignal=options.signal;return new Promise(()=>{});}
      return new Response(seller({offers:{'@type':'Offer',priceCurrency:'USD',availability:'https://schema.org/InStock'}}));
    }});
    const pending=service.verify({url});
    const result=await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('Optional price lookup blocked the eligible fabric')),180))]);
    assert.equal(result.evidence,'seller_listing');assert.equal(result.price,'');assert.equal(variantSignal.aborted,true,'Variant lookup has its own short deadline');
    const variants={handle:'crimson-wool',variants:[{id:1,title:'Default Title',price:6999,available:true},{id:2,title:'Swatch',price:300,available:true}]};
    const html=seller({offers:{'@type':'AggregateOffer',priceCurrency:'USD',lowPrice:3,highPrice:69.99}})+'<p>69.99 per yard</p>';
    const fast=createFabricSearch({...store(),fetchImpl:async target=>target.endsWith('.js')?Response.json(variants):new Response(html)});
    assert.equal((await fast.verify({url})).price,'69.99','Fast seller variant facts remain available');
    assert.equal(await fast.verify({url:url+'?variant=2'}),null,'A selected swatch cannot become yardage');
    let visits=0;const unavailable=createFabricSearch({...store(),fetchImpl:async()=>{visits++;return new Response(seller({offers:{'@type':'Offer',priceCurrency:'USD',availability:'https://schema.org/OutOfStock'}}));}});
    assert.equal(await unavailable.verify({url}),null);assert.equal(visits,1,'Known unavailable products do not spend time fetching optional prices');

  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);}
});
// Worldwide scenarios run as their own named check.
console.log(`Fabric search: ${count} behavioral checks passed.`);

};

checks['fabric-worldwide']=async function(){
// Worldwide main search: fake OpenAI evidence only; no external seller traffic.
const {default:assert}=await import('node:assert/strict');
const {createFabricSearch,normalizeFabricRequest}=await import('../backend/server/fabric-search.mjs');
const {sourceURL,worldwideSearchBody,isColorFabricPhoto}=await import('../backend/server/fabric-worldwide.mjs');
const image='data:image/png;base64,iVBORw0KGgo=',url='https://global-textiles.example.net/item/forest-tricot';
const candidate={type:'candidate',url,title:'Forest green tricot fabric',material:'Green jacket and pants body',reason:'A possible smooth knit for the green body.',price:'1.00',image:'https://invented.example/fake.jpg'};
const interpretation={type:'interpretation',observation:'Green body knit, gold panels and ivory inserts; exact fiber is uncertain.',query:'green tracksuit textiles'};
const evidence={type:'web_search_call',action:{sources:[{url}]},results:[{type:'image_result',source_website_url:url,image_url:'https://seller-images.example.net/green.jpg',thumbnail_url:'https://seller-images.example.net/thumb.jpg',caption:'Forest green tricot fabric'}]};
const content=objects=>({type:'message',content:[{type:'output_text',text:objects.map(object=>JSON.stringify(object)).join('\n')}]});
const user={sub:'fixture-owner'};
let count=0;
async function test(name,run){await run();count++;console.log('  ok worldwide '+name);}
await test('default requires worldwide image results, optional legacy groups cannot scope it',()=>{
  const input=normalizeFabricRequest({request:'Find fabrics for this look',image,storeGroups:['local'],stores:['evil.invalid']});
  assert.equal(input.mode,'worldwide');assert.equal(input.storeGroups,undefined);assert.deepEqual(input.stores,[]);
  const body=worldwideSearchBody(input,'gpt-6-luna');assert.equal(body.stream,true);assert.equal(body.store,false);
  assert.equal(body.max_tool_calls,5);assert.equal(body.max_output_tokens,6000);assert.equal(body.tools[0].image_settings.max_results,32);
  assert.match(body.instructions,/first image-search query broad/);assert.match(body.instructions,/sewing\/knitting patterns/);assert.match(body.instructions,/dominant color/);assert.match(body.instructions,/Solid color body-cloth alternatives are useful/);
  assert.equal(body.tools[0].filters,undefined);assert.deepEqual(body.tools[0].search_content_types,['image']);
  assert.match(body.instructions,/Use image search to find photographs/);
  assert.match(body.instructions,/source_website_url/);
  assert.ok(body.include.includes('web_search_call.results'));assert.equal(body.input[0].content[1].image_url,image);
  assert.throws(()=>normalizeFabricRequest({request:'wool',mode:'unknown'}));
});
await test('patterned apparel yardage is not mistaken for a sewing pattern',async()=>{
  for(const title of ['Forest green floral pattern brocade', 'Forest green floral pattern jacquard fabric','Black floral pattern on forest green apparel fabric by the yard']){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],caption:title}]},content([{...interpretation,colorFamily:'green'},{...candidate,title}])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
    assert.equal(events.at(-1).products.length,1,title);assert.ok(events.at(-1).products[0].image);assert.equal(events.at(-1).searchDetails.diagnostics.imagePages,1);assert.equal(events.at(-1).searchDetails.diagnostics.photoProducts,1);
  }
  for(const title of ['PDF sewing pattern for green fabric coat','Knitting pattern for wool sweater','Digital pattern download with fabric guide','Dress pattern for green stretch fabrics','Pattern for a shirt using cotton fabric']){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,title}])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));assert.deepEqual(events.at(-1).products,[]);
  }
});
await test('modeled links cannot disguise upholstery, furnishing or decor evidence',async()=>{
  for(const change of [{url:'https://cloth.example/green-jacquard-upholstery-fabric'},{title:'Green furnishing fabric'},{reason:'Green brocade, though some options are furnishing-weight.'},{caption:'Green upholstery fabric by the yard'},{caption:'Green decor fabric by the yard'},{url:'https://cloth.example/products/green-%75pholstery-fabric'}]){
    const item={...candidate,...change},page=item.url;
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,action:{sources:[{url:page}]},results:[{...evidence.results[0],source_website_url:page,caption:change.caption||'Green fabric'}]},content([interpretation,item])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
    assert.deepEqual(events.at(-1).products,[],JSON.stringify(change));
  }
});
await test('late upholstery evidence retracts a modeled card even if the stream then fails',async()=>{
  const frames=[{type:'response.output_item.done',item:evidence},{type:'response.output_text.delta',delta:JSON.stringify(candidate)+'\n'},{type:'response.output_item.done',item:{...evidence,results:[{...evidence.results[0],caption:'Green upholstery fabric by the yard'}]}},{type:'response.failed'}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await assert.rejects(service.search(user,{request:'Green apparel fabric',image},event=>events.push(structuredClone(event))),/interrupted/);
  assert.ok(events.some(event=>event.products?.[0]?.url===url));
  assert.ok(events.some(event=>event.removedUrls?.includes(url)));
  assert.deepEqual(events.filter(event=>event.products).at(-1).products,[]);
});
await test('a text-only provider response reports missing photographs without a paid retry',async()=>{
  let calls=0;const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>{calls++;return Response.json({status:'completed',output:[{...evidence,results:[]},content([interpretation,candidate])]});}});
  await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
  assert.equal(calls,1);assert.equal(events.at(-1).products.length,1);
  assert.match(events.at(-1).message,/no fabric photographs/i);
  assert.match(events.at(-1).searchDetails.stage,/source links only/i);
});
await test('public source links reject private addresses, credentials and unsafe schemes',()=>{
  for(const bad of ['http://shop.example/a','https://127.0.0.1/a','https://2130706433/a','https://[::1]/a','https://10.0.0.2/a','https://user:secret@shop.example/a','https://shop.local/a','https://shop.local./a','https://localhost/a','file:///etc/passwd'])assert.equal(sourceURL(bad),'',bad);
  assert.equal(sourceURL(url+'?variant=2&utm_source=ad#top'),url+'?variant=2');
});
await test('one call streams a global product before completion, with tool-backed image and no invented facts',async()=>{
  let controller,calls=0,cancelled=false;
  const stream=new ReadableStream({start(value){controller=value;},cancel(){cancelled=true;}}),events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',model:'gpt-6-luna',rank:()=>{throw Error('Main search must not call a second ranker');},fetchImpl:async(target,options)=>{
    calls++;assert.equal(target,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(options.body).tools[0].filters,undefined);
    return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
  }});
  const pending=service.search(user,{request:'Find fabrics',image},event=>events.push(event));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_item.done',item:evidence});push({type:'response.output_text.delta',delta:JSON.stringify(interpretation)+'\n'+JSON.stringify(candidate)+'\n'});
  for(let i=0;i<50&&!events.some(event=>event.incremental);i++)await new Promise(resolve=>setImmediate(resolve));
  const early=events.find(event=>event.incremental);assert.ok(early,'Useful source-backed products arrive before response.completed');assert.equal(events.some(e=>e.type==='done'),false);
  assert.equal(early.products[0].url,url);assert.equal(early.products[0].image,evidence.results[0].image_url);
  for(const field of ['price','unit','currency','composition'])assert.equal(early.products[0][field],'');assert.equal(early.products[0].availability,'unknown');
  assert.equal(early.products[0].evidence,'web_suggestion');
  push({type:'response.completed',response:{status:'completed',output:[evidence,content([interpretation,candidate])]}});
  const stats=await pending;assert.equal(calls,1);assert.equal(stats.count,1);assert.ok(cancelled,'Completion does not wait for EOF');assert.equal(stats.visualMs,0);assert.equal(stats.retailerMs,0);
});
await test('ungrounded links/images and stale garment IDs cannot become suggestions',async()=>{
  const objects=[interpretation,candidate,{...candidate,url:'https://invented-shop.example/product/red-fabric'},{...candidate,url:url+'?variant=bad',garmentIds:['foreign']}];
  const response={status:'completed',output:[{...evidence,results:[]},content(objects)]},events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async target=>{assert.equal(target,'https://api.openai.com/v1/responses');return Response.json(response);}});
  await service.search(user,{request:'green knit',image},event=>events.push(event));
  assert.equal(events.at(-1).products.length,1);assert.equal(events.at(-1).products[0].image,'','Model image URL is ignored when search did not supply a page-linked image');
});
await test('missing key and provider failure never fall back to retailer feeds or echo provider errors',async()=>{
  let calls=0;const service=createFabricSearch({fetchImpl:async()=>{calls++;throw Error('Unexpected feed');}});
  await assert.rejects(service.search(user,{request:'green knit',image},()=>{}),/Worldwide fabric search is unavailable/);assert.equal(calls,0);
  const failed=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response('secret-provider-message',{status:403})});
  await assert.rejects(failed.search(user,{request:'green knit',image},()=>{}),error=>!error.message.includes('secret-provider-message')&&error.status===502);
});
await test('known client exclusions remain strict without imposing saved-body guesses',async()=>{
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,title:'Green polyester tricot fabric'}])]})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},event=>events.push(event));assert.deepEqual(events.at(-1).products,[]);
});
await test('late source evidence retracts an initially unknown client-excluded material',async()=>{
  let controller;const events=[];
  const stream=new ReadableStream({start(value){controller=value;}});
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  const task=service.search(user,{request:'green knit',preferences:'No polyester',image},event=>events.push(event));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_item.done',item:{...evidence,results:[]}});
  push({type:'response.output_text.delta',delta:JSON.stringify(candidate)+'\n'});
  for(let i=0;i<50&&!events.some(event=>event.incremental);i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.find(event=>event.incremental)?.products[0]?.url,url,'Unknown fiber may initially be a qualified suggestion');
  push({type:'response.output_item.done',item:{...evidence,results:[{...evidence.results[0],caption:'Green polyester tricot fabric'}]}});
  push({type:'response.completed',response:{status:'completed',output:[evidence,content([candidate])]}});
  await task;
  const removal=events.find(event=>event.removedUrls?.includes(url));
  assert.ok(removal,'Later known client contradiction must retract the existing card');
  assert.deepEqual(removal.products,[]);assert.deepEqual(events.at(-1).products,[]);
});
await test('SSE handles CRLF and Unicode split across every byte without inventing a photo',async()=>{
  const product={...candidate,title:'Green crêpe fabric'};
  const events=[{type:'response.output_item.done',item:evidence},{type:'response.output_text.delta',delta:JSON.stringify(interpretation)+'\n'+JSON.stringify(product)+'\n'},{type:'response.completed',response:{status:'completed',output:[]}}];
  const bytes=new TextEncoder().encode(events.map(event=>'event: '+event.type+'\r\ndata: '+JSON.stringify(event)+'\r\n\r\n').join(''));
  const stream=new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));controller.close();}}),out=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'green fabric',image},event=>out.push(event));assert.equal(out.at(-1).products[0].title,'Green crêpe fabric');
});
await test('stalled worldwide fetch settles on parent cancellation even if transport ignores it',async()=>{
  const keepAlive=setInterval(()=>{},1000);let calls=0;
  try{const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>{calls++;return new Promise(()=>{});}});await assert.rejects(service.search(user,{request:'green knit',image},()=>{},AbortSignal.timeout(30)));assert.equal(calls,1);}finally{clearInterval(keepAlive);}
});
await test('worldwide own deadline survives GC and a stalled body cancels cleanly',async()=>{
  const native=AbortSignal.timeout,keepAlive=setInterval(()=>{},1000);AbortSignal.timeout=ms=>native.call(AbortSignal,ms===50000?35:ms);
  try{
    const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Promise(()=>{})});
    await assert.rejects(service.search(user,{request:'green knit',image},()=>{}),error=>error.name==='TimeoutError');
    let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
    const stalled=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(body,{headers:{'Content-Type':'text/event-stream'}})});
    await assert.rejects(stalled.search(user,{request:'green knit',image},()=>{}),error=>error.name==='TimeoutError');assert.ok(cancelled);
  }finally{AbortSignal.timeout=native;clearInterval(keepAlive);}
});
await test('saved context is canonical before the single worldwide call starts',async()=>{
  const piece={id:'jacket',name:'Track jacket',fabric:'Green knit',_image:image};let calls=0;const events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:path.endsWith('summary.json')?{fabric_preferences:'No polyester'}:{}))}),fetchImpl:async(target,options)=>{
    calls++;assert.equal(target,'https://api.openai.com/v1/responses');const sent=JSON.parse(JSON.parse(options.body).input[0].content[0].text);
    assert.equal(sent.selectedGarment.name,'Track jacket');assert.equal(sent.clientFabricPreferences,'No polyester');assert.doesNotMatch(JSON.stringify(sent),/forged/);
    return Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,garmentIds:['jacket']}])]});
  }});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'jacket',name:'forged'},image},event=>events.push(event));assert.equal(calls,1);assert.equal(events.at(-1).products[0].garmentId,'jacket');
});

await test('three written recommendations retain source photographs from up to twelve different websites',async()=>{
  const photos=Array.from({length:14},(_,i)=>({type:'image_result',source_website_url:`https://cloth-${i}.example/products/green-twill-${i}`,image_url:`https://photos.example/green-${i}.jpg`,thumbnail_url:`https://photos.example/thumb-${i}.jpg`,caption:`Forest green cotton twill apparel fabric by the yard ${i}`}));
  const unsafe=[['upholstery','Green upholstery fabric by the yard'],['shirt','Green shirt made of premium fabric size M'],['pattern','Green sewing pattern for apparel fabric'],['orange','Orange fabric by the yard with green variants'],['sample','Green cotton apparel fabric sample'],['blog','Green apparel fabric by the yard']].map(([id,caption])=>({...photos[0],source_website_url:'https://cloth.example/'+(id==='blog'?'blog/green-fabric':'products/'+id),caption}));
  const written=photos.slice(0,3).map(p=>({...candidate,url:p.source_website_url,title:p.caption}));
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{type:'web_search_call',action:{queries:['forest green suiting fabric','hunter green cotton twill by the yard']},results:[...photos,...unsafe]},content([{...interpretation,colorFamily:'green'},...written])]})});
  await service.search(user,{request:'green apparel fabric',image},e=>events.push(e));
  const done=events.at(-1);assert.equal(done.products.length,12,'Search photographs fill the twelve-site viewer beyond the written shortlist');
  assert.ok(done.products.every(p=>p.image&&p.imageCandidates.length===2));assert.equal(done.products[0].image,photos[0].image_url);
  assert.ok(done.products.slice(3).every(p=>!p.garmentId&&!p.garment&&p.reason.includes('Approximate')),'Raw photo suggestions invent no garment identity or exact suitability');
  assert.deepEqual(done.searchDetails.webQueries,['forest green suiting fabric','hunter green cotton twill by the yard']);
  for(const field of ['price','unit','currency','composition'])assert.ok(done.products.every(p=>p[field]===''));
});
await test('unknown colors and non-yardage/editorial/variant mentions cannot auto-add photographs',()=>{
  const photo={url:'https://cloth.example/products/green',caption:'Green cotton apparel fabric by the yard',imageCandidates:['https://photos.example/green.jpg']};
  assert.equal(isColorFabricPhoto(photo,'green'),true);
  for(const family of ['unknown','chartreuse','GREEN',null])assert.equal(isColorFabricPhoto(photo,family),false);
  for(const caption of ['Green shirt made of cotton fabric','Green fabric inspiration','Red apparel fabric by the yard, also green','Green upholstery fabric by the yard','Green fabric by the yard available in other colors','Green fabric by the yard available in blue and red','Green sewing pattern for dressmaking','Green fabric swatch','Green craft fabric by the yard'])assert.equal(isColorFabricPhoto({...photo,caption},'green'),false,caption);
  for(const path of ['collections/green','category/green','search/green','blog/green','guides/green'])assert.equal(isColorFabricPhoto({...photo,url:'https://cloth.example/'+path},'green'),false,path);
});
await test('image association tolerates only trailing slash spelling and keeps variants and hosts separate',async()=>{
  for(const [source,hasPhoto]of [[url+'/',true],[url+'?variant=red',false],[url.replace('global-textiles.','www.global-textiles.'),false]]){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],source_website_url:source}]},content([candidate])]})});
    await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(!!events.at(-1).products[0].image,hasPhoto,source);
  }
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([candidate,{...candidate,url:url+'/'}])]})});
  await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(events.at(-1).products.length,1,'Slash aliases are not duplicate products');
});
await test('photo suggestions displace photo-less links at the bounded display limit',async()=>{
  const links=Array.from({length:24},(_,i)=>({...candidate,url:`https://link-${i}.example/products/green`}));
  const photos=Array.from({length:30},(_,i)=>({...evidence.results[0],source_website_url:`https://photo-${i}.example/products/green`,caption:`Green suiting fabric by the yard ${i}`}));
  const frames=[{type:'response.output_item.done',item:{type:'web_search_call',action:{sources:links.map(({url})=>({url}))}}},{type:'response.output_text.delta',delta:[{...interpretation,colorFamily:'green'},...links].map(value=>JSON.stringify(value)).join('\n')+'\n'},{type:'response.output_item.done',item:{type:'web_search_call',results:photos}},{type:'response.completed',response:{status:'completed',output:[]}}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));
  assert.equal(events.at(-1).products.length,12);assert.ok(events.at(-1).products.every(p=>p.image));
  assert.ok(events.some(e=>e.removedUrls?.length),'Earlier link-only cards are removed from retained client results when photo results take their slots');
});
await test('extra photographs still respect client exclusions and need a resolved color',async()=>{
  for(const colorFamily of ['green','unknown']){
    const photos=[{...evidence.results[0],caption:'Green polyester suiting fabric by the yard'}];
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily}])]})});
    await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
  }
});
await test('automatic worldwide keeps explicit refinements while using canonical saved garments',async()=>{
  let sent;const piece={id:'coat',name:'Hooded tailcoat',fabric:'Dense ornate brocade with embroidery'};
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:{}))}),fetchImpl:async(_,options)=>{sent=JSON.parse(JSON.parse(options.body).input[0].content[0].text);return Response.json({status:'completed',output:[]});}});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat',name:'forged'},request:'Main green color, solid cloth is fine; no polyester',history:[{request:'less shiny'}],image},()=>{});
  assert.equal(sent.request,'Main green color, solid cloth is fine; no polyester');assert.equal(sent.selectedGarment.name,'Hooded tailcoat');assert.equal(sent.earlierRequests[0].request,'less shiny');
});


await test('same-page variant photos cannot mix known colors in raw or modeled fallback URLs',async()=>{
  const green={...evidence.results[0],caption:'Green cotton apparel fabric by the yard'},orange={...evidence.results[0],image_url:'https://photos.example/orange.jpg',thumbnail_url:'https://photos.example/orange-thumb.jpg',caption:'Orange cotton apparel fabric by the yard'};
  for(const modeled of [false,true])for(const results of [[green,orange],[orange,green]]){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results},content([{...interpretation,colorFamily:'green'},...(modeled?[candidate]:[])])]})});
    await service.search(user,{request:'green fabric',image},e=>events.push(e));
    if(!modeled)assert.deepEqual(events.at(-1).products,[],'Ambiguous same-page color evidence is not an automatic addition');
    else {assert.deepEqual(events.at(-1).products[0].imageCandidates,[green.image_url,green.thumbnail_url],'Only explicitly green source images can back this green card');assert.deepEqual(events.at(-1).products[0].rejectedImageURLs,[orange.image_url,orange.thumbnail_url],'Previously mounted photos can be explicitly revoked by later color evidence');}
  }
});
await test('fifth and later source captions cannot hide a known material exclusion',async()=>{
  const photos=Array.from({length:6},(_,i)=>({...evidence.results[0],caption:i===4?'Green polyester apparel fabric by the yard':'Green cotton apparel fabric by the yard '+i}));
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily:'green'},candidate])]})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
});


await test('uncolored model titles can still use page-linked fabric photos without a guessed color',async()=>{
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([{...candidate,title:'Cotton tricot fabric'}])]})});
  await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(events.at(-1).products[0].image,evidence.results[0].image_url);
});


await test('automatic worldwide refinements enforce exclusions from actual client request words',async()=>{
  const piece={id:'coat',name:'Green coat',fabric:'Green cloth'},events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:{}))}),fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],caption:'Green polyester suiting fabric by the yard'}]},content([{...interpretation,colorFamily:'green'},candidate])]})});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat'},request:'Green body cloth, no polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
});


await test('late color interpretation revokes an earlier uncolored-title photo with known different color',async()=>{
  const source={...evidence,results:[{...evidence.results[0],caption:'Orange cotton apparel fabric by the yard'}]};
  const records=[{...candidate,title:'Cotton apparel fabric'}, {...interpretation,colorFamily:'green'}];
  const frames=[{type:'response.output_item.done',item:source},...records.map(record=>({type:'response.output_text.delta',delta:JSON.stringify(record)+'\n'})),{type:'response.completed',response:{status:'completed',output:[]}}];
  const stream=new ReadableStream({start(controller){for(const event of frames)controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));controller.close();}}),events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'fabric',image},event=>events.push(structuredClone(event)));
  assert.ok(events.some(e=>e.products?.[0]?.image),'An early source-backed image may precede interpretation');
  assert.equal(events.at(-1).products[0].image,'');assert.deepEqual(events.at(-1).products[0].rejectedImageURLs,[source.results[0].image_url,source.results[0].thumbnail_url]);
});

await test('selected dissected image leads a short request without saved fabric guesses',()=>{
  const pieceImage='data:image/png;base64,cGllY2U=';
  const body=worldwideSearchBody({request:'Darker green, no polyester',history:[{request:'Less shiny'}],preferences:'No polyester',image,selectedReference:pieceImage,piece:{name:'Coat',fabric:'Mandatory ornate brocade',fabric_spec:{weave:'brocade'}},pieces:[{name:'Coat',fabric:'Mandatory ornate brocade'}]},'gpt-6-luna');
  const parts=body.input[0].content;
  assert.equal(parts[1].image_url,pieceImage);assert.equal(parts.at(-1).image_url,image,'Original look remains available as context');
  assert.doesNotMatch(JSON.stringify(parts),/Mandatory ornate brocade/);
  assert.match(parts[0].text,/Darker green, no polyester/);assert.match(body.instructions,/up to 12 different websites/);
  assert.ok(body.instructions.split(/\s+/).length<300,'The provider receives a concise sourcing task');
});
await test('tool photos stream before any written shortlist, accent-first captions survive, and late exclusions retract',async()=>{
  let controller;const events=[];
  const stream=new ReadableStream({start(value){controller=value;}});
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  const task=service.search(user,{request:'Green body fabric, no polyester',image},event=>events.push(structuredClone(event)));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_text.delta',delta:JSON.stringify({...interpretation,colorFamily:'green'})+'\n'});
  const photo={...evidence.results[0],caption:'Black embroidery on forest green apparel fabric by the yard'};
  push({type:'response.output_item.done',item:{...evidence,results:[photo]}});
  for(let i=0;i<50&&!events.some(event=>event.products?.length);i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.find(event=>event.products?.length)?.products[0].image,photo.image_url,'No model candidate or completion is needed for a qualified tool photograph');
  assert.equal(events.some(event=>event.type==='done'),false);
  push({type:'response.output_item.done',item:{...evidence,results:[{...photo,caption:'Forest green polyester apparel fabric by the yard'}]}});
  push({type:'response.failed'});
  await assert.rejects(task,/interrupted/);
  assert.ok(events.some(event=>event.removedUrls?.includes(url)));assert.equal(events.filter(event=>event.products).at(-1).products.length,0);
});
await test('later ambiguous variant evidence retracts an early raw photograph before stream failure',async()=>{
  const green={...evidence.results[0],caption:'Green suiting fabric by the yard'},orange={...green,image_url:'https://seller-images.example.net/orange.jpg',caption:'Orange suiting fabric by the yard'};
  const frames=[{type:'response.output_text.delta',delta:JSON.stringify({...interpretation,colorFamily:'green'})+'\n'},{type:'response.output_item.done',item:{...evidence,results:[green]}},{type:'response.output_item.done',item:{...evidence,results:[orange]}},{type:'response.failed'}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await assert.rejects(service.search(user,{request:'Green fabric',image},event=>events.push(structuredClone(event))),/interrupted/);
  assert.ok(events.some(event=>event.products?.[0]?.image===green.image_url));assert.ok(events.some(event=>event.removedUrls?.includes(url)));assert.equal(events.filter(event=>event.products).at(-1).products.length,0);
});
await test('one merchant cannot crowd out twelve other source websites',async()=>{
  const photos=Array.from({length:20},(_,i)=>({...evidence.results[0],source_website_url:'https://one-shop.example/products/green-'+i,caption:'Green suiting fabric by the yard'}));
  for(let i=0;i<11;i++)photos.push({...photos[0],source_website_url:'https://shop-'+i+'.example/products/green'});
  const out=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily:'green'}])]})});
  await service.search(user,{request:'Green fabric',image},event=>out.push(event));
  const products=out.at(-1).products;assert.equal(products.length,12);assert.equal(new Set(products.map(p=>new URL(p.url).hostname)).size,12);
});

console.log('Worldwide fabric: '+count+' global/default/evidence/stream/cancellation checks passed.');

};

checks['proxy-policy']=async function(){
// Commit A1 — proxy policy tests. Pure unit tests over the fail-closed request
// policy: no server, no network. Run: node tests/proxy-policy.mjs
const { evaluateProxyPolicy }=await import('../backend/server/proxy-policy.mjs');

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
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', n: 1 }) }); ok('valid image generation: gpt-image-2, n=1', r.ok && r.model === 'gpt-image-2'); }
{ const r = ev({ upstreamPath: 'v1/embeddings', body: json({ model: 'text-embedding-3-small', input: 'x' }) }); ok('valid embeddings', r.ok && r.model === 'text-embedding-3-small'); }
{ const m = multipart([['model', 'whisper-1']]); const r = ev({ upstreamPath: 'v1/audio/transcriptions', contentType: m.contentType, body: m.body }); ok('valid multipart transcription: whisper-1', r.ok && r.model === 'whisper-1'); }

// ── missing / unknown / malformed / mismatch ──
// Current and already-open legacy image clients keep the same endpoint/cost policy.
for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.5-flare']) {
  const body = json({ model, prompt: 'same garment', size: '1024x1536', quality: 'medium', n: 1 });
  const generation = ev({ upstreamPath: 'v1/images/generations', body });
  ok(model + ' generation is forwarded unchanged without model fallback', generation.ok && generation.model === model && generation.body.equals(body) && !generation.fallback);
  const m = multipart([['model', model], ['quality', 'medium'], ['n', '1']], { bigFileFirst: true, fileSize: 300000 });
  const edit = ev({ upstreamPath: 'v1/images/edits', ...m });
  ok(model + ' edit preserves reference bytes', edit.ok && edit.body.equals(m.body) && !edit.fallback);
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
{ const r = ev({ upstreamPath: 'v1/images/generations', isAdmin: true, body: json({ model: 'gpt-image-2', prompt: 'x', quality: 'high', n: 2 }) }); ok('admin high quality n=2 is allowed', r.ok && r.model === 'gpt-image-2'); }

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
const frontend=read('frontend/index.html'),brief=read('backend/backend.html'),operations=read('backend/operation-workspace.html');
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
assert.equal(calls.length,7,'One request per explicit generation/edit');
for(const [i,call] of calls.entries()){
  assert.equal(call.options.headers.Authorization,'Bearer fixture-token');
  assert.equal(call.options.method,'POST');
  if(i<2){assert.equal(call.url,'/api/openai/v1/images/generations');continue;}
  assert.equal(call.url,'/api/openai/v1/images/edits');
  const form=call.options.body;
  assert.equal(form.get('model'),IMAGE_MODEL);
  if(i<4)assert.equal(form.get('complexity'),'medium');
  assert.equal(form.get('size'),'1536x1024');assert.equal(form.get('n'),'1');
  assert.equal(form.get('quality'),i>=5?'high':'medium','Existing Admin quality choices stay intact');
  if(i>=4)assert.equal(await form.get('image').text(),'reference-image');
}
console.log('GPT Image 2.6 Flare requests preserve auth, sizes, quality, options, reference images and response handling across frontend, Brief and Operations.');

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
