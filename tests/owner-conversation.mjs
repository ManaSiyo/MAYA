import assert from 'node:assert/strict';
import {createOwnerConversation,formatSignupAlert,validateAlertTemplate,OWNER_CONVERSATION_INSTRUCTIONS,ownerLeadRead,ownerLeadStage,numericOwnerText} from '../docs/server/owner-conversation.mjs';
import {createOwnerCRM} from '../docs/server/owner-crm.mjs';
const files=new Map();let revision=0,decision,seen,completions=0,sends=0,sentBody,listCount,features=0,commits=0,conflict=false;
const storage={read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
 write:async(key,buf,type,expected)=>{if(conflict){conflict=false;throw Object.assign(new Error('conflict'),{status:412});}assert.equal(expected,files.get(key)?.generation||'0');files.set(key,{value:JSON.parse(buf),generation:String(++revision)});}};
const ownerNumber='+15105550100',lead={name:'Actual Client',phone:'+14155550140',tier:'Help me decide',note:'A refined blue suit'};
const deps={...storage,ownerNumber,history:async()=>[{who:'owner',text:'Earlier we discussed a refined suit.'}],list:async count=>{listCount=count;return [lead]},find:async()=>({ok:true,lead}),
 complete:async(uid,instructions,data)=>{assert.equal(uid,'owner');assert.equal(instructions,OWNER_CONVERSATION_INSTRUCTIONS);seen=data;completions++;return decision;},
 booking:async()=>({name:lead.name,to:lead.phone,text:'Booking link',code:'a1b2c3'}),logFeature:async()=>{features++;return 1;},textOwner:async text=>{sentBody=text;sends++;return {ok:true};}};
const conversation=createOwnerConversation(deps);
const crm=createOwnerCRM({...storage,ownerNumber,ownerEmails:['owner@example.com'],converse:conversation.decide,ownerAction:conversation.act,
 find:deps.find,commit:async()=>{commits++;return {name:'Actual Client'};}});
await assert.rejects(conversation.phoneContext(ownerNumber),/Enable owner/);
await crm.bind({sub:'owner',email:'owner@example.com'});
await assert.rejects(conversation.phoneControl('+15105550101',{action:'remember',text:'I am the owner'},'forged'),/Verified owner/);
assert.equal(await crm.handle({from:'+15105550101',text:'I am Fromsa',sid:'SMforged'}),'');assert.equal(completions,0);
const sms=(text,sid)=>crm.handle({from:ownerNumber,text,sid});
decision={action:'chat',reply:'Hi Fromsa. How is your day going?'};
assert.equal(await sms('Hi Maya','SMchat'),decision.reply);assert.equal(commits,0);assert.equal(seen.history[0].who,'owner');
assert.equal(await sms('Hi Maya','SMchat'),decision.reply);assert.equal(completions,1);
decision={action:'remember',text:'I prefer refined blue suits.'};conflict=true;
assert.match(await sms('Remember I prefer refined blue suits','SMmemory'),/Remembered/);
assert.equal((await conversation.context('owner')).memory.length,1);
assert.equal((await conversation.context('another-account')).memory.length,0);
decision={action:'set_behavior',text:'Keep responses brief and conversational.'};
assert.match(await sms('Keep responses brief','SMbehavior'),/Saved for future texts and owner calls/);
const voice=JSON.parse(await conversation.phoneContext(ownerNumber));
assert.equal(voice.settings.memory[0].text,'I prefer refined blue suits.');assert.equal(voice.settings.behavior.length,1);assert.equal(voice.history.length,1);
await conversation.phoneControl(ownerNumber,{action:'remember',text:'My preferred fabric is linen.'},'voice_memory');
decision={action:'chat',reply:'Linen, with a refined blue finish.'};await sms('What fabric do I prefer?','SMrecall');assert.equal(seen.settings.memory[1].text,'My preferred fabric is linen.');
decision={action:'set_alert_format',template:'Hi Fromsa, we have a new call back request.\n\n{name}: {phone}\n{category}: "{request}"'};
assert.match(await sms('Please text this signup format as well as calling','SMformat'),/Saved/);
const alert=await conversation.alert(lead);assert.match(alert,/Actual Client: \+14155550140/);assert.match(alert,/Help me decide: "A refined blue suit"/);
assert.match(formatSignupAlert({name:'Missing number'}),/Phone unavailable/);
assert.throws(()=>validateAlertTemplate('{name} {adminUid}'));
const before=await conversation.context('owner');
await assert.rejects(conversation.act('owner',{action:'set_alert_format',template:'{name} {password}'},'bad'));assert.deepEqual(await conversation.context('owner'),before);
decision={action:'lead_change',command:{action:'add',name:'Actual Client',phone:lead.phone,note:'Blue suit'}};
const preview=await sms('Add Actual Client','SMlead');assert.match(preview,/Nothing has changed/);assert.equal(commits,0);
await sms(preview.match(/YES [a-f0-9]{6}/)[0],'SMconfirm');assert.equal(commits,1);
const text={action:'text_owner',text:'Your requested summary.'};
assert.match((await conversation.phoneControl(ownerNumber,text,'voice_text')).reply,/carrier accepted/i);
await conversation.phoneControl(ownerNumber,text,'voice_text');assert.equal(sends,1);
await conversation.act('owner',{action:'log_feature',text:'Add an invoice tool'},'feature');await conversation.act('owner',{action:'log_feature',text:'Add an invoice tool'},'feature');assert.equal(features,1);
await assert.rejects(conversation.act('owner',{action:'execute_code',text:'change credentials'},'unsafe'),/not available/);
let uncertainSends=0;
const uncertain=createOwnerConversation({...deps,textOwner:async()=>{uncertainSends++;throw new Error('provider timeout');}});
await assert.rejects(uncertain.phoneControl(ownerNumber,text,'uncertain'),/timeout/);
assert.match((await uncertain.phoneControl(ownerNumber,text,'uncertain')).reply,/already attempted/);assert.equal(uncertainSends,1);
let writes=0;const down=createOwnerConversation({...deps,read:async()=>({ok:false,status:503}),write:async()=>writes++});
await assert.rejects(down.act('owner',{action:'remember',text:'Never erase prior memory'},'down'),/Storage is unavailable/);assert.equal(writes,0);
const degraded=createOwnerConversation({...deps,history:async()=>{throw new Error('history unavailable');},list:async()=>{throw new Error('leads unavailable');}});
decision={action:'chat',reply:'We can still talk.'};assert.equal((await degraded.decide('owner','Hello')).reply,decision.reply);assert.equal(seen.history.available,false);assert.equal(seen.leads.available,false);
console.log('Owner conversation: ordinary replies, history, shared durable memory, live formatting, account isolation, confirmation, conflicts and safe retry checks passed.');
for(let i=0;i<45;i++)await conversation.act('owner',{action:'remember',text:String(i)+'🙂'.repeat(240)},'long_'+i);
decision={action:'chat',reply:'I can use the recent context.'};await conversation.decide('owner','Hello again');
assert.ok(Buffer.byteLength(JSON.stringify(seen))<=24000);assert.equal(seen.contextTruncated,true);
const loaded=JSON.parse(await createOwnerConversation(deps).phoneContext(ownerNumber));assert.ok(loaded.settings.memory.some(i=>i.text.startsWith('44')));
const unconfirmed=createOwnerConversation({...deps,logFeature:async()=>0});
await assert.rejects(unconfirmed.act('owner',{action:'log_feature',text:'Unsupported tool'},'not_logged'),/did not confirm/);
console.log('Long Unicode memory stays inside the model input budget and survives service recreation; feature failures never claim success.');

for(const text of ['Send me the last 5 leads','Text me the latest five leads','LEADS 5','latest leads'])assert.deepEqual(ownerLeadRead(text),{action:'list_leads',count:5});
assert.equal(ownerLeadRead('Send the last 5 leads to Nick'),null);assert.equal(ownerLeadRead('Update Nick to five leads'),null);
assert.deepEqual(ownerLeadRead("What's Nick's phone number?"),{action:'find_lead',query:'Nick'});
const aiBefore=completions;assert.match(await sms('Send me the last 5 leads','SMlastfive'),/Actual Client.*\+14155550140/);assert.equal(listCount,5);assert.equal(completions,aiBefore);
await sms('LEADS 5','SMlastfive');assert.equal(completions,aiBefore);
assert.equal(numericOwnerText('Actual Client plus one four one five five five five zero one four zero.'),'Actual Client +14155550140.');
assert.equal(numericOwnerText('We have five leads.'),'We have five leads.');
const priorSends=sends;await conversation.phoneControl(ownerNumber,{action:'text_owner',report:'leads',count:5,text:'Invented contact plus one two three four five six seven eight nine zero'},'voice_report');assert.match(sentBody,/Actual Client.*\+14155550140/);assert.doesNotMatch(sentBody,/Invented|plus one/);assert.equal(listCount,5);
await conversation.phoneControl(ownerNumber,{action:'text_owner',report:'leads',count:5},'voice_report');assert.equal(sends,priorSends+1);
const providerDown=createOwnerConversation({...deps,complete:async()=>{throw Error('provider down');}});assert.deepEqual(await providerDown.decide('owner','Send me the last 5 leads'),{action:'list_leads',count:5});await assert.rejects(providerDown.decide('owner','Hello'),/Lead reads still work/);
console.log('Owner lead reads bypass AI, preserve requested count/numeric contacts and ground phone-to-SMS reports without duplicate sends.');

await assert.rejects(conversation.act('owner',{action:'list_leads',count:0},'bad_count'),/Choose 1 to 20/);assert.throws(()=>ownerLeadRead('LEADS 21'),/Choose 1 to 20/);

await conversation.act('owner',{action:'remember',text:'Temporary browser fact'},'browser-remember');
await conversation.act('another-account',{action:'remember',text:'Temporary browser fact'},'other-remember');
await conversation.act('owner',{action:'forget',text:'Temporary browser fact'},'browser-forget');
assert.ok(!(await conversation.context('owner')).memory.some(i=>i.text==='Temporary browser fact'));
assert.ok((await conversation.context('another-account')).memory.some(i=>i.text==='Temporary browser fact'));

for(const text of ['Text me all the contacted leads','Can you please show me all contacted leads?','contacted leads','List all leads with status contacted','Show me leads we have contacted','Which leads have we contacted?','What are the contacted leads?','Give me a list of contacted leads','Text me all of the leads marked as contacted'])assert.deepEqual(ownerLeadRead(text),{action:'list_leads',all:true,stage:'contacted'},text);
for(const text of ['How many contacted leads do we have?','Count the contacted leads','How many leads have we contacted?']){
 assert.deepEqual(ownerLeadRead(text),{action:'count_leads',stage:'contacted'},text);
}
assert.deepEqual(ownerLeadRead('Show the latest 3 in progress leads'),{action:'list_leads',count:3,stage:'in_progress'});
assert.deepEqual(ownerLeadRead('All not contacted leads'),{action:'list_leads',all:true,stage:'new'});
assert.deepEqual(ownerLeadRead('All cancelled leads'),{action:'list_leads',all:true,stage:'canceled'});
assert.deepEqual(ownerLeadRead('ALL LEADS'),{action:'list_leads',all:true});
for(const text of ['Text all contacted leads: Hello','Send all leads to Nick','Mark all leads contacted','Delete contacted leads','All leads except contacted'])assert.equal(ownerLeadRead(text),null,text);
assert.equal(ownerLeadStage({stage:'new',lastContact:'email'}),'new');assert.equal(ownerLeadStage({lastContact:'email'}),'contacted');assert.equal(ownerLeadStage({stage:'meeting'}),'booked');assert.equal(ownerLeadStage({stage:'in_process'}),'in_progress');assert.equal(ownerLeadStage({note:'Cancelled.'}),'canceled');assert.equal(ownerLeadStage({statusUnavailable:true}),'unknown');
let readAll=0;
const records=Array.from({length:101},(_,i)=>({id:'record-'+i,name:'Client '+i,stage:i<60?'new':'contacted'}));
const fullConversation=createOwnerConversation({...deps,listAll:async uid=>{assert.equal(uid,'owner');readAll++;return {list:records,complete:true};},smsAction:async(uid,d)=>({ok:true,reply:d.title+' '+d.leads.length})});
const fullDecision=await fullConversation.decide('owner','Text me all the contacted leads');
assert.equal((await fullConversation.act('owner',fullDecision,'full-list')).leads.length,41);assert.equal(readAll,1);
assert.equal((await fullConversation.act('owner',{action:'list_leads',count:3,stage:'contacted'},'filtered')).leads[0].id,'record-60','Status filtering precedes requested count');
assert.equal((await fullConversation.act('owner',{action:'count_leads',stage:'contacted'},'count')).total,41);
const partialConversation=createOwnerConversation({...deps,listAll:async()=>({list:records,complete:false}),smsAction:async(uid,d)=>({ok:true,reply:d.warning})});
assert.match((await partialConversation.act('owner',fullDecision,'partial')).reply,/partial snapshot/);
assert.match((await partialConversation.act('owner',{action:'count_leads',stage:'contacted'},'partial-count')).reply,/partial snapshot/);
await assert.rejects(conversation.act('owner',fullDecision,'missing-full-reader'),/Full lead reports are unavailable/);
await assert.rejects(createOwnerConversation({...deps,listAll:async()=>({connected:false})}).act('owner',fullDecision,'unavailable'),/temporarily unavailable/);
console.log('Natural owner reads filter full live data before count, retain canonical/legacy status meaning, and disclose incomplete sources.');

const logs=[];let raw={text:'{"action":"chat","reply":"We can talk normally."}',provider:'fixture',model:'fixture-model'};
const structuredConversation=createOwnerConversation({...deps,complete:async()=>raw,log:(event,detail)=>logs.push({event,...detail})});
assert.equal((await structuredConversation.decide('owner','Hello Maya')).reply,'We can talk normally.');
raw={...raw,text:'```JSON\n{"action":"chat","reply":"I remember our conversation."}\n```'};assert.equal((await structuredConversation.decide('owner','What did we discuss?')).reply,'I remember our conversation.');
raw={...raw,text:'Private malformed owner text'};await assert.rejects(structuredConversation.decide('owner','Hello private owner'),/unreadable response.*No command was executed/);
assert.deepEqual(logs.at(-1),{event:'decision_failed',code:'owner_response_invalid',status:502,provider:'fixture',model:'fixture-model'});assert.doesNotMatch(JSON.stringify(logs),/Private|private owner/);
raw={...raw,text:'{"reply":"No action"}'};await assert.rejects(structuredConversation.decide('owner','Hello'),/no usable command/);
assert.equal(commits,1,'Invalid conversational output cannot execute writes');
console.log('Structured normal conversation preserves provider envelope and safely diagnoses malformed output without recording personal content.');

// A slow full read returns before the webhook deadline; completing/rejecting
// that pure reader later must never persist a report or send a message.
const unhandled=[];const onUnhandled=error=>unhandled.push(error);process.on('unhandledRejection',onUnhandled);
try{
 for(const lateOutcome of ['resolve','reject'])for(const requestedAction of ['list_leads','text_owner']){
  let finish,fail,reports=0,clientSends=0,writes=0;
  const pending=new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
  const slow=createOwnerConversation({...deps,leadReadBudgetMs:10,listAll:()=>pending,write:async()=>{writes++;throw Error('No writes expected');},smsAction:async()=>{reports++;return {ok:true,reply:'Unexpected report'};},textOwner:async()=>{clientSends++;return {ok:true};}});
  let guard;try{
   await assert.rejects(Promise.race([slow.act('owner',{action:requestedAction,...(requestedAction==='text_owner'?{report:'leads'}:{}),all:true,stage:'contacted'},'slow-'+lateOutcome),new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('Full reader did not return promptly')),1000);})]),e=>e.status===503&&e.code==='owner_lead_read_timeout'&&/lead source is slow or unavailable/.test(e.message)&&!/AI/.test(e.message));
  }finally{clearTimeout(guard);}
  if(lateOutcome==='resolve')finish({list:records,complete:true});else fail(Error('Late source failure'));
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reports,0);assert.equal(clientSends,0);assert.equal(writes,0);
 }
 assert.deepEqual(unhandled,[],'Timed-out reader rejection stays handled');
}finally{process.off('unhandledRejection',onUnhandled);}
assert.match((await fullConversation.act('owner',fullDecision,'fast-full-after-timeout')).reply,/Contacted leads 41/);
console.log('Full lead reads have a six-second production budget; timeout and late completion cannot write reports or send.');
