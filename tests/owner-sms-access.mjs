import assert from 'node:assert/strict';
import {createOwnerSMSAccess,messageLines} from '../docs/server/owner-sms-access.mjs';
import {createMessageArchive} from '../docs/server/message-archive.mjs';
import {createMessageStore} from '../docs/server/maya-messages.mjs';
import {createOwnerConversation} from '../docs/server/owner-conversation.mjs';
import {createOwnerCRM} from '../docs/server/owner-crm.mjs';
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
