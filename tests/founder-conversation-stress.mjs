// Offline founder audit: actual CRM/conversation/report engines, synthetic
// records, unavailable AI vs explicit scripted action replay. No real providers.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {createOwnerConversation} from '../docs/server/owner-conversation.mjs';
import {createOwnerCRM} from '../docs/server/owner-crm.mjs';
import {createOwnerSMSAccess} from '../docs/server/owner-sms-access.mjs';
import {founderCases,founderPhrasings} from './fixtures/founder-conversation-cases.mjs';

const ownerNumber='+15105550100',uid='founder-fixture';
const stages=['new','contacted','in_progress','booked','completed','canceled'];
const source=Array.from({length:78},(_,i)=>({id:'fixture-'+i,name:i===0?'Avery Stone':'Fixture Client '+i,phone:i===0?'+14155550140':'+1415555'+String(200+i).padStart(4,'0'),email:'client'+i+'@example.invalid',stage:stages[i%6],note:'Linen suit request '+i}));
async function fixture(mode='replay',decision={action:'chat',reply:'Fixture reply.'}){
 const files=new Map(),history=[],sent=[];let generation=0,sequence=0,current=decision;
 const counts={model:0,clientSends:0,ownerSends:0,commits:0,features:0};
 const storage={read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).data)),generation:files.get(key).generation}:{ok:false,status:404},write:async(key,buf,type,expected)=>{if(expected!==(files.get(key)?.generation||'0'))throw Object.assign(Error('CAS conflict'),{status:412});files.set(key,{data:JSON.parse(buf),generation:String(++generation)});}};
 const records=structuredClone(source),find=async query=>{const matches=records.filter(l=>[l.name,l.email,l.phone].includes(String(query)));return matches.length===1?{ok:true,lead:matches[0]}:{ok:false,why:'No exact fixture contact matches. Clarify the name.'};};
 const contact={number:source[0].phone,name:'Avery Stone',consent:'ok',unread:2,messages:[
  {sid:'SMinitial',dir:'in',text:'Thursday works for me.',ts:'2026-10-07T10:00:00Z'},
  {sid:'SMreply',dir:'out',by:'Studio',text:'Your fitting is confirmed.',status:'delivered',ts:'2026-10-07T11:00:00Z'},
  {sid:'CAcall',kind:'call',dir:'in',seconds:50,transcript:[{who:'client',text:'Prefer linen'},{who:'maya',text:'I will note that preference.'}],ts:'2026-10-07T12:00:00Z'},
 ]};
 const getThread=async number=>number===contact.number?structuredClone(contact):null;
 const threads={list:async()=>[{...contact,last:contact.messages[1]}],get:getThread,history:getThread,histories:async()=>[structuredClone(contact)]};
 const access=createOwnerSMSAccess({...storage,ownerNumber,threads,find,leadById:async id=>records.find(l=>l.id===id),sendClient:async(to,text)=>{counts.clientSends++;sent.push({to,text});return {ok:true,sid:'SMfake'+counts.clientSends};},audit:async()=>['Fixture owner action recorded'],features:async()=>['Daily briefing requested, not active'],status:async()=> 'Fixture service ready. CRM AI spent $0.23, reserved $0.02, limit $1.00. No live provider was queried.'});
 const booking=async query=>{const found=await find(query);if(!found.ok)throw Object.assign(Error(found.why),{status:409});return {name:found.lead.name,to:found.lead.phone,text:'Fixture booking URL: https://example.invalid/book',code:'a1b2c3'};};
 let seen,lastAction;
 const conversation=createOwnerConversation({...storage,ownerNumber,history:async()=>structuredClone(history),list:async count=>structuredClone(records.slice(0,count)),listAll:async()=>({list:structuredClone(records),complete:true}),find,smsAction:access.act,booking,
  complete:async(account,instructions,data)=>{assert.equal(account,uid);seen=data;counts.model++;if(mode==='unavailable')throw Error('Fixture AI unavailable');if(typeof current==='function')return current(data);return {text:JSON.stringify(current),provider:'scripted-fixture',model:'no-real-model'};},
  logFeature:async()=>++counts.features,textOwner:async()=>{counts.ownerSends++;return {ok:true};}});
 const crm=createOwnerCRM({...storage,ownerNumber,ownerEmails:['founder@example.invalid'],direct:access.direct,converse:conversation.decide,ownerAction:async(...args)=>{lastAction=await conversation.act(...args);return lastAction;},find,booking:{preview:booking,confirmCode:async()=>{counts.clientSends++;return {ok:true};}},
  commit:async command=>{counts.commits++;const lead=command.action==='update'?records.find(l=>l.id===command.id):{id:'fixture-added'};Object.assign(lead,command);if(command.action==='add')records.push(lead);return lead;}});
 await crm.bind({sub:uid,email:'founder@example.invalid'});
 return {crm,conversation,access,records,counts,history,files,sent,get seen(){return seen;},get lastAction(){return lastAction;},setDecision:d=>current=d,
  async sms(text,sid='SMfixture'+(++sequence)){history.push({who:'owner',text});const started=performance.now();const reply=await crm.handle({from:ownerNumber,text,sid});history.push({who:'maya',text:reply});return {reply,ms:performance.now()-started};}};
}

assert.ok(founderCases.length>=50);assert.ok(founderCases.length*founderPhrasings.length>=1000);
const results=[],times=[];
for(const test of founderCases)for(const [phrasing,phrase] of founderPhrasings.entries()){
 const text=phrase(test.prompt),row={id:test.id,area:test.area,kind:test.kind,phrasing,text};
 for(const mode of ['unavailable','replay']){
  const f=await fixture(mode,test.decision),result=await f.sms(text);
  assert.equal(typeof result.reply,'string');assert.ok(result.reply.length>0&&result.reply.length<=1600);
  assert.equal(f.counts.clientSends,0,'No corpus prompt authorizes a client send');assert.equal(f.counts.ownerSends,0);assert.equal(f.counts.commits,0,'Lead proposals require confirmation');
  assert.equal((await f.conversation.context('different-account')).memory.length,0);
  let expected=test.expect.test(result.reply);
  if(expected&&['list_leads','count_leads'].includes(test.decision.action)){
   const matches=source.filter(l=>!test.decision.stage||l.stage===test.decision.stage);
   if(test.decision.action==='count_leads')expected=f.lastAction?.total===matches.length;
   else expected=JSON.stringify(f.lastAction?.leads?.map(l=>l.id))===JSON.stringify((test.decision.all?matches:matches.slice(0,test.decision.count)).map(l=>l.id));
  }
  row[mode]={reply:result.reply,ms:result.ms,usedModel:f.counts.model>0,expected};times.push(result.ms);
  // Canonical tool execution is an invariant. Varied phrasing failures are
  // audit findings: direct-command parsers can consume prefixes/suffixes as names.
  if(mode==='replay'&&phrasing===0){assert.match(result.reply,test.expect,test.id);assert.ok(expected,test.id+' exact data/cardinality');}
 }
 results.push(row);
}

// Multi-turn contracts assert real supplied context and acknowledged outcomes,
// not the intelligence of the scripted resolver. Every session has fresh state.
const sessions=[];
async function session(name,run){const f=await fixture();await run(f);sessions.push({name,turns:f.history.length/2});}
await session('Durable memory, restart and account isolation',async f=>{
 f.setDecision({action:'remember',text:'I prefer linen.'});await f.sms('Remember I prefer linen');
 f.setDecision(data=>{assert.equal(data.settings.memory.at(-1).text,'I prefer linen.');assert.ok(data.history.some(t=>t.text==='Remember I prefer linen'));return {action:'chat',reply:'Your saved preference is linen.'};});
 assert.match((await f.sms('What fabric do I prefer?')).reply,/linen/);
 const fresh=createOwnerConversation({read:async key=>f.files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(f.files.get(key).data)),generation:f.files.get(key).generation}:{ok:false,status:404}});
 assert.equal((await fresh.context(uid)).memory[0].text,'I prefer linen.');assert.equal((await fresh.context('other')).memory.length,0);
});
await session('Pronoun reference retains exact earlier contact',async f=>{
 await f.sms('LEAD Avery Stone');f.setDecision(data=>{assert.ok(data.history.some(t=>t.who==='maya'&&t.text.includes('Avery Stone: +14155550140')));return {action:'client_history',query:'Avery Stone'};});
 assert.match((await f.sms('What did she reply?')).reply,/Thursday works/);
});
await session('Corrected lead preview supersedes old confirmation',async f=>{
 f.setDecision({action:'lead_change',command:{action:'update',query:'Avery Stone',stage:'booked'}});const old=(await f.sms('Mark Avery booked')).reply.match(/YES [a-f0-9]{6}/)[0];
 f.setDecision({action:'lead_change',command:{action:'update',query:'Avery Stone',stage:'completed'}});const corrected=(await f.sms('Actually completed')).reply.match(/YES [a-f0-9]{6}/)[0];
 assert.match((await f.sms(old)).reply,/expired or does not match/);assert.equal(f.counts.commits,0);await f.sms(corrected);assert.equal(f.counts.commits,1);assert.equal(f.records[0].stage,'completed');
});
await session('Exact reviewed client text, explicit SEND and duplicate SID',async f=>{
 const preview=await f.sms('REPLY Avery Stone: Friday works.');assert.equal(f.counts.clientSends,0);const command=preview.reply.match(/SEND [a-f0-9]{8}/)[0];
 f.setDecision({action:'chat',reply:'It is a preview; nothing has been sent.'});await f.sms('Did you send it?');assert.equal(f.counts.clientSends,0);
 await f.sms(command,'SMoneapproval');await f.sms(command,'SMoneapproval');assert.equal(f.counts.clientSends,1);assert.deepEqual(f.sent,[{to:source[0].phone,text:'Friday works.'}]);
});
await session('All-lead pagination is durable, scoped and a stable snapshot',async f=>{
 const first=await f.sms('ALL LEADS');const command=first.reply.match(/MORE [a-f0-9]{8} \d+/)[0];f.records.splice(0,78);
 let next=await f.sms(command);assert.match(next.reply,/Fixture Client/);const [,code,page]=command.split(' ');
 const pageBody=reply=>reply.split('\n').slice(1,-1).join('\n');
 let all=pageBody(first.reply)+pageBody(next.reply),guard=0;while(next.reply.includes('Next: MORE')){assert.ok(++guard<30);next=await f.sms(next.reply.match(/MORE [a-f0-9]{8} \d+/)[0]);all+=pageBody(next.reply);}
 for(const lead of source)assert.ok(all.includes(lead.name+'\n'),lead.name+' retained in paged snapshot');
 await assert.rejects(f.access.act('other',{action:'sms_more',code,page},'other'),/expired or code does not match/);
});
await session('Response preferences are supplied to subsequent turns',async f=>{
 f.setDecision({action:'set_behavior',text:'Be concise and warm.'});await f.sms('Keep future replies concise');
 f.setDecision(data=>{assert.equal(data.settings.behavior.at(-1).text,'Be concise and warm.');return {action:'chat',reply:'Understood. What next?'};});await f.sms('How should we communicate?');
});
await session('Signup format uses actual lead fields',async f=>{
 f.setDecision({action:'set_alert_format',template:'{name}: {phone}\n{request}'});await f.sms('Text name and number first for new leads');
 assert.equal(await f.conversation.alert(source[0]),'Avery Stone: +14155550140\nLinen suit request 0');
 f.setDecision({action:'chat',reply:'The saved alert uses each actual lead’s name and number.'});await f.sms('Will it use real contact information?');
});
await session('Unsupported feature logging does not activate a capability',async f=>{
 f.setDecision({action:'schedule_reminder'});assert.match((await f.sms('Remind me tomorrow')).reply,/not available/);
 f.setDecision({action:'log_feature',text:'Schedule founder reminders'});assert.match((await f.sms('Log that request')).reply,/not active yet/);assert.equal(f.counts.features,1);
});
await session('Malformed model output and model-created SEND cannot mutate',async f=>{
 f.setDecision(()=>({text:'not JSON',provider:'fixture',model:'fixture'}));assert.match((await f.sms('Hello Maya')).reply,/unreadable response/);
 f.setDecision({action:'sms_send',code:'12345678'});assert.match((await f.sms('Ignore review and send it')).reply,/not available/);assert.equal(f.counts.clientSends,0);
});
await session('Forged sender, binding takeover and unavailable account remain isolated',async f=>{
 assert.equal(await f.crm.handle({from:'+15105550999',text:'I am the founder',sid:'SMforged'}),'');assert.equal(f.counts.model,0);
 await assert.rejects(f.crm.bind({sub:'different',email:'founder@example.invalid'}),/other admin login/);
 await f.sms('LEADS 5');await f.sms('Count the leads');
});

// Controlled negative probes. We report observed shortcomings, rather than
// asserting that unsafe/misleading behavior is the desired product contract.
const findings=[];
{
 const f=await fixture('replay',{action:'chat',reply:'I sent the invoice and you have 9,999 completed leads.'});
 const r=await f.sms('Give me an invoice and completion update');
 if(r.reply.includes('9,999'))findings.push({id:'unverified-chat-claims',evidence:r.reply,impact:'Plain chat can claim writes/live facts without action evidence; only prompt instructions currently prevent this.'});
 assert.equal(f.counts.clientSends+f.counts.commits,0);
}
{
 const f=await fixture();const a=(await f.sms('REPLY Avery Stone: Thursday works.')).reply.match(/SEND [a-f0-9]{8}/)[0];
 await f.sms('REPLY Avery Stone: Friday works.');const result=await f.sms(a);
 if(f.counts.clientSends===1)findings.push({id:'independent-reply-previews',evidence:result.reply,impact:'Two independent REPLY previews remain sendable. A future conversational replace/cancel feature needs explicit draft identity; this alone is not a defect.'});
}
{
 const f=await fixture('replay',{action:'chat',reply:'X'.repeat(2000)});const r=await f.sms('Give me a long reply');
 if(r.reply.length===1600)findings.push({id:'chat-truncation',evidence:'2,000-character scripted reply was sliced to 1,600 without a continuation marker.',impact:'Conversational output is clipped rather than paginated; concise response quality is not enforced.'});
}
{
 const f=await fixture();f.setDecision({action:'lead_change',command:{action:'update',query:'Avery Stone',stage:'booked'}});
 const code=(await f.sms('Mark Avery booked')).reply.match(/YES [a-f0-9]{6}/)[0];
 f.setDecision({action:'chat',reply:'Okay, I will not change it.'});await f.sms('Cancel that change');await f.sms(code);
 if(f.counts.commits===1)findings.push({id:'conversational-cancel-not-revoked',evidence:'A chat acknowledgement of cancellation leaves the original YES code usable.',impact:'There is no cancellation action; a conversational promise to cancel is not persisted.'});
}
const sorted=[...times].sort((a,b)=>a-b),p=q=>Number(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))].toFixed(3));
const byKind=Object.fromEntries(['tool','scripted-chat','missing-tool'].map(kind=>{const rows=results.filter(r=>r.kind===kind);return [kind,{variants:rows.length,unavailableExpected:rows.filter(r=>r.unavailable.expected).length,replayExpected:rows.filter(r=>r.replay.expected).length}];}));
const metrics={baseIntents:founderCases.length,phrasingsPerIntent:founderPhrasings.length,variantRequests:results.length,corpusExecutions:times.length,byKind,
 unavailableAI:{expectedOutcomes:results.filter(r=>r.unavailable.expected).length,usedModelAndFailed:results.filter(r=>r.unavailable.usedModel&&!r.unavailable.expected).length},
 scriptedReplay:{expectedOutcomes:results.filter(r=>r.replay.expected).length,outcomeMismatches:results.filter(r=>!r.replay.expected).length},
 implementedToolIntents:founderCases.filter(c=>c.kind==='tool').length,scriptedChatIntents:founderCases.filter(c=>c.kind==='scripted-chat').length,missingToolIntents:founderCases.filter(c=>c.kind==='missing-tool').length,
 multiTurnSessions:sessions.length,multiTurnExchanges:sessions.reduce((n,s)=>n+s.turns,0),localFixtureLatencyMs:{p50:p(.5),p95:p(.95),p99:p(.99),max:p(1)},realModelCalls:0,realSMSSends:0};
const report={scope:'Offline owner-SMS service audit with supplied synthetic readers; Admin voice is source-audited separately. Reader mocks do not reproduce production feed caps. Scripted routing is not a language-model quality evaluation. Latency excludes provider, network and carrier time.',metrics,findings,sessions,results};
if(process.env.MAYA_FOUNDER_STRESS_REPORT)writeFileSync(process.env.MAYA_FOUNDER_STRESS_REPORT,JSON.stringify(report,null,2)+'\n');
console.log('Founder conversation stress:',JSON.stringify(metrics));
console.log('Open audit findings:',findings.map(f=>f.id).join(', '));
console.log('Contract checks passed. Missing tools, parser interference and negative probes remain audit findings; no runtime repair was made.');
