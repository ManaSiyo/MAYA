import assert from 'node:assert/strict';
import {mountOutbound,contact,mergeContacts,rowsToContacts} from '../docs/server/outbound.mjs';
import {reconcile,inCampaign} from '../docs/server/crm-intelligence.mjs';
import {createCrmAI,budgetDay} from '../docs/server/crm-ai.mjs';
import {createGmail,messageEvent,rawEmail} from '../docs/server/crm-gmail.mjs';
function memory(){const objects=new Map();return {objects,read:async key=>objects.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(objects.get(key).value)),generation:String(objects.get(key).n)}:{ok:false,status:404},write:async(key,buffer,type,generation)=>{if(String(objects.get(key)?.n||0)!==generation)throw Object.assign(Error('conflict'),{status:412});objects.set(key,{value:JSON.parse(buffer),n:Number(generation)+1});}};}
let checks=0;async function test(name,fn){await fn();console.log('ok '+name);checks++;}
await test('10,000 master prospects with shared campaign membership and atomic limit',()=>{
 const state={campaigns:[{id:'a'},{id:'b'}],contacts:[]};const entries=Array.from({length:10000},(_,i)=>contact({name:'P'+i,email:`p${i}@example.com`}));
 assert.equal(mergeContacts(state,entries,'a'),10000);assert.equal(mergeContacts(state,entries,'b'),0);assert.equal(state.contacts.length,10000);assert.ok(state.contacts.every(c=>inCampaign(c,'a')&&inCampaign(c,'b')));
 assert.throws(()=>mergeContacts(state,[contact({email:'extra@example.com'})],'a'),/10,000/);
 assert.equal(rowsToContacts([['Email','Phone'],['x@example.com','(415) 555-0100']])[0].phone,'(415) 555-0100');
});
await test('Gmail and phone history match exact identity, deduplicate and preserve manual/terminal states',()=>{
 const state={contacts:[{id:'a',email:'a@example.com',phone:'+14155550100',stage:'new'},{id:'b',email:'b@example.com',stage:'closed'},{id:'c',email:'c@example.com',stage:'suppressed'}]};
 const event={id:'one',provider:'gmail',peers:['a@example.com','b@example.com','c@example.com'],kind:'email',direction:'in',summary:'Reply',ts:'2026-09-27T17:00:00Z'};
 reconcile(state,[event]);reconcile(state,[event]);assert.equal(state.crm.activity.length,1);assert.equal(state.contacts[0].stage,'replied');assert.equal(state.contacts[1].stage,'closed');assert.equal(state.contacts[2].stage,'suppressed');
 state.contacts[0].stage='ready';state.contacts[0].stageManualAt='2026-09-27T18:00:00Z';reconcile(state,[{...event,id:'two',provider:'twilio',phone:'4155550100'}]);assert.equal(state.contacts[0].stage,'ready');
 reconcile(state,[{...event,id:'unmatched',peers:['stranger@example.com']}]);assert.equal(state.contacts.length,3);assert.equal(state.crm.unmatched.length,1);
});
await test('automated email replies do not advance relationship state',()=>{
 const state={contacts:[{id:'a',email:'a@example.com',stage:'new'}]};reconcile(state,[{id:'auto',provider:'gmail',automated:true,peers:['a@example.com'],direction:'in',ts:'2026-09-27T17:00:00Z'}]);assert.equal(state.contacts[0].stage,'new');
});
await test('pending or failed texts do not mark a lead contacted; delivery updates reconcile',()=>{
 const state={contacts:[{id:'a',phone:'+14155550100',stage:'new'}]};
 const event={id:'sms',provider:'twilio',phone:'4155550100',kind:'sms',direction:'out',status:'queued',summary:'Hello',ts:'2026-09-27T17:00:00Z'};
 reconcile(state,[event]);assert.equal(state.contacts[0].stage,'new');
 reconcile(state,[{...event,status:'undelivered'}]);assert.equal(state.contacts[0].stage,'new');assert.equal(state.crm.activity[0].status,'undelivered');
 reconcile(state,[{...event,status:'delivered'}]);assert.equal(state.contacts[0].stage,'contacted');assert.equal(state.crm.activity.length,1);
});
await test('MIME protects headers, Unicode and multiline bodies',()=>{
 const raw=Buffer.from(rawEmail({from:'owner@example.com',to:'a@example.com',subject:'A café',body:'Hello\nWorld',messageId:'test-id'}),'base64url').toString();assert.match(raw,/Content-Transfer-Encoding: base64/);assert.match(raw,/SGVsbG8KV29ybGQ=/);
 assert.throws(()=>rawEmail({from:'owner@example.com',to:'a@example.com',subject:'bad\r\nBcc: steal@example.com',body:'x',messageId:'x'}));
 const event=messageEvent({id:'1',threadId:'t',labelIds:['SENT'],internalDate:'1000',payload:{headers:[{name:'To',value:'Alice <a@example.com>, owner@example.com'}]}},{id:'mail',email:'owner@example.com'});assert.deepEqual(event.peers,['a@example.com']);
});
await test('daily allowance aggregates three providers, keeps unknown costs reserved and isolates accounts',async()=>{
 const storage=memory();let providerCalls=0,fail=false;
 const ai=createCrmAI({...storage,keys:{openai:'test',anthropic:'test',gemini:'test'},now:()=>new Date('2026-09-27T18:00:00Z'),fetch:async url=>{providerCalls++;if(fail)throw Error('timeout');const j=String(url).includes('anthropic')?{content:[{type:'text',text:'{}'}],usage:{input_tokens:100,output_tokens:50}}:String(url).includes('google')?{candidates:[{content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50}}:{output:[{content:[{type:'output_text',text:'{}'}]}],usage:{input_tokens:100,output_tokens:50}};return {ok:true,json:async()=>j};}});
 for(const provider of ['openai','anthropic','gemini'])await ai.complete('one','Summarize',{},provider);
 const meter=await ai.meter('one');assert.equal(Object.keys(meter.providers).length,3);assert.equal(meter.reservedUsd,0);assert.ok(meter.spentUsd>0);assert.equal((await ai.meter('other')).spentUsd,0);
 fail=true;await assert.rejects(ai.complete('one','Summarize',{}),/reserved cost/);assert.ok((await ai.meter('one')).reservedUsd>0);
 const key=[...storage.objects.keys()][0];storage.objects.get(key).value.calls.full={provider:'openai',reserve:1,actual:1};const before=providerCalls;await assert.rejects(ai.complete('one','Summarize',{}),/daily/);assert.equal(providerCalls,before);
 assert.equal(budgetDay(new Date('2026-09-28T06:59:00Z')),'2026-09-27');assert.equal(budgetDay(new Date('2026-09-28T07:00:00Z')),'2026-09-28');
});
await test('simultaneous calls cannot spend the same remaining budget',async()=>{
 const storage=memory(),day=budgetDay(),key='private/outbound/usage/owner/'+day+'.json';storage.objects.set(key,{n:1,value:{calls:{existing:{provider:'openai',actual:.999,reserve:0}}}});let calls=0;
 const ai=createCrmAI({...storage,keys:{openai:'test'},fetch:async()=>{calls++;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'x'}]}],usage:{input_tokens:10,output_tokens:20}})}}});
 const results=await Promise.allSettled([ai.complete('owner','x',{}),ai.complete('owner','x',{})]);assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
await test('Gmail OAuth is single-use, encrypted, supports two inboxes and isolates accounts',async()=>{
 const storage=memory();let mailbox='one@example.com';const gmail=createGmail({...storage,config:{clientId:'id',clientSecret:'secret',redirectUri:'https://maya.test/api/outbound/gmail/callback',encryptionKey:'a'.repeat(64)},fetch:async url=>({ok:true,json:async()=>String(url).includes('oauth2')?{access_token:'access',refresh_token:'never-public',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'}:{emailAddress:mailbox,historyId:'10'}})});
 const one=new URL(await gmail.begin('owner')).searchParams.get('state');await gmail.callback(one,'code');await assert.rejects(gmail.callback(one,'code'),/expired/);
 mailbox='two@example.com';await gmail.callback(new URL(await gmail.begin('owner')).searchParams.get('state'),'code');assert.equal((await gmail.list('owner')).length,2);assert.equal((await gmail.list('other')).length,0);
 assert.doesNotMatch(JSON.stringify([...storage.objects.values()]),/never-public/);assert.doesNotMatch(JSON.stringify(await gmail.list('owner')),/secret|refreshToken/);
 await gmail.disconnect('owner',(await gmail.list('owner'))[0].id);assert.equal((await gmail.list('owner')).length,1);
});
await test('Gmail history pagination retains start ID; expired history safely restarts backfill',async()=>{
 const storage=memory();let expired=false;const calls=[];const gmail=createGmail({...storage,config:{clientId:'id',clientSecret:'secret',redirectUri:'https://maya.test/api/outbound/gmail/callback',encryptionKey:'b'.repeat(64)},fetch:async url=>{const u=String(url);calls.push(u);if(u.includes('oauth2'))return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'})};if(u.includes('history?'))return expired?{ok:false,status:404}:{ok:true,json:async()=>({historyId:'30',nextPageToken:'page2',history:[{messagesAdded:[{message:{id:'m1'}}]}]})};if(u.includes('/messages/m1'))return {ok:true,json:async()=>({id:'m1',internalDate:'1000',payload:{headers:[{name:'From',value:'a@example.com'}]}})};return {ok:true,json:async()=>({emailAddress:'one@example.com',historyId:'10'})};}});
 await gmail.callback(new URL(await gmail.begin('owner')).searchParams.get('state'),'code');const mailbox=(await gmail.list('owner'))[0];
 const sync=await gmail.sync('owner',mailbox,{historyId:'20'});assert.equal(sync.cursor.historyId,'20');assert.equal(sync.cursor.pageToken,'page2');assert.equal(sync.events.length,1);expired=true;const reset=await gmail.sync('owner',mailbox,sync.cursor);assert.deepEqual(reset.cursor,{});assert.equal(reset.pending,true);
});
const storage=memory(),routes=new Map();let user='owner',sends=0,gmailFail=false,mailboxListFail=false,phoneReads=0,sendFail=false,aiCalls=0,lastAIData;
const mailboxes=[{id:'one',email:'one@example.com',connectedAt:'2026-09-27'},{id:'two',email:'two@example.com',connectedAt:'2026-09-27'}];
mountOutbound({get:(p,h)=>routes.set('GET '+p,h),post:(p,h)=>routes.set('POST '+p,h)},{...storage,requireAdmin:async()=>({sub:user}),allow:()=>true,gmail:{ready:()=>true,begin:async()=> 'https://accounts.google.com/o/oauth2/v2/auth?state='+ 'a'.repeat(64),callback:async()=>({uid:'owner'}),list:async uid=>{if(mailboxListFail)throw Error('unavailable');return uid==='owner'?mailboxes:[];},sync:async()=>{if(gmailFail)throw Error('provider');return {events:[{id:'gmail-event',provider:'gmail',kind:'email',direction:'in',peers:['person@example.com'],summary:'Hello',ts:'2026-09-27T18:00:00Z'}],cursor:{historyId:'10'}};},send:async()=>{sends++;if(sendFail)throw Error('uncertain');return {id:'sent1'};}},ai:{meter:async()=>({}),complete:async(uid,instructions,data)=>{aiCalls++;lastAIData=data;return {text:Array.isArray(data)?JSON.stringify({contacts:data.map(c=>({id:c.id,summary:'Fixture summary',nextAction:'Review'}))}):JSON.stringify({subject:'Fixture subject',body:'Fixture body'}),provider:'openai'};}},phoneEvents:async()=>{phoneReads++;return [];},schedulerReady:true,verifyScheduler:async req=>{if(req.headers.authorization!=='Bearer scheduler')throw Object.assign(Error('Denied'),{status:401});},draft:async()=>({}),fetch:async()=>{},sheetTabs:async()=>[]});
async function call(path='',body,task=false){let status=200,data;const res={set(){},status(n){status=n;return res;},json(v){data=v;},send(v){data=v;}};await routes.get((body?'POST ':'GET ')+(task?path:'/api/admin/outbound'+path))({body,method:body?'POST':'GET',headers:{authorization:task?'Bearer scheduler':''}},res);return {status,...data};}
const created=await call('/save',{type:'campaign',name:'Test'}),campaignId=created.state.campaigns[0].id;
const imported=await call('/save',{type:'import',campaignId,contact:{email:'person@example.com',name:'Person'}}),id=imported.state.contacts[0].id;
await test('send needs confirmation, selected connected sender and idempotent content',async()=>{
 const draft={id,mailboxId:'two',subject:'Hello',body:'A personal note',requestId:'12345678-1234-1234'};
 assert.equal((await call('/send',draft)).status,400);assert.equal(sends,0);
 assert.equal((await call('/send',{...draft,confirm:true})).delivery.status,'sent');assert.equal((await call('/send',{...draft,confirm:true})).delivery.status,'sent');assert.equal(sends,1);
 assert.equal((await call('/send',{...draft,confirm:true,body:'Different'})).status,409);assert.equal(sends,1);
 user='other';assert.equal((await call('/send',{...draft,confirm:true})).status,400);user='owner';
});
await test('hourly sync commits cursors with activity and exposes provider failures',async()=>{
 await call('/schedule',{enabled:true,hunterDailyLimit:0});let run=await call('/sync',{});assert.equal(run.state.crm.mailboxes.one.cursor.historyId,'10');assert.equal(run.state.contacts[0].stage,'replied');
 gmailFail=true;run=await call('/sync',{});assert.equal(run.errors.length,2);assert.equal(run.state.crm.mailboxes.one.cursor.historyId,'10');gmailFail=false;
 const scheduled=await call('/api/tasks/outbound-sync',{accountId:'owner'},true);assert.equal(scheduled.skipped,true);
});
await test('mailbox connection failure does not prevent phone synchronization',async()=>{
 mailboxListFail=true;const before=phoneReads;const result=await call('/sync',{});mailboxListFail=false;
 assert.equal(result.ok,true);assert.ok(result.errors.some(e=>e.source==='Gmail connections'));assert.equal(phoneReads,before+1);assert.ok(result.state.crm.phoneSyncedAt);
});
await test('OAuth callback requires the Hosting-compatible browser cookie',async()=>{
 let cookie='',status=200,redirect='';const res={set(k,v){if(k==='Set-Cookie')cookie=v;return res;},status(n){status=n;return res;},json(){},send(){},redirect(v){redirect=v;}};
 await routes.get('POST /api/admin/outbound/gmail/connect')({method:'POST',headers:{},body:{}},res);
 assert.match(cookie,/^__session=/);assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.match(cookie,/Path=\/api\/outbound\/gmail/);
 const handler=routes.get('GET /api/outbound/gmail/callback');
 await handler({headers:{},query:{state:'a'.repeat(64),code:'fixture'}},res);assert.equal(status,400);assert.equal(redirect,'');
 await handler({headers:{cookie:cookie.split(';')[0]},query:{state:'a'.repeat(64),code:'fixture'}},res);assert.equal(redirect,'/outbound.html?gmail=connected');
});
await test('unchanged activity spends no AI credits and scheduler validates its identity',async()=>{
 const before=aiCalls;await call('/sync',{});assert.equal(aiCalls,before);
 let status=200;const res={status(n){status=n;return res;},json(){}};
 await routes.get('POST /api/tasks/outbound-sync')({headers:{authorization:'Bearer invalid'},body:{accountId:'owner'}},res);assert.equal(status,401);
 const key='maya/outbound/owner.json';storage.objects.get(key).value.crm.lastAttempt='2000-01-01T00:00:00Z';
 const result=await call('/api/tasks/outbound-sync',{accountId:'owner'},true);assert.equal(result.ok,true);assert.ok(storage.objects.get(key).value.crm.lastScheduledRunAt);
});
await test('campaign segments use their own draft context and validate membership',async()=>{
 const second=await call('/save',{type:'campaign',name:'Second audience'}),cid=second.state.campaigns.at(-1).id;
 assert.equal((await call('/draft',{id,campaignId:cid,confirm:true})).status,400);
 await call('/segment',{ids:[id],campaignId:cid});assert.equal((await call('/draft',{id,campaignId:cid,confirm:true})).status,200);assert.equal(lastAIData.campaign.id,cid);
});
await test('ambiguous Gmail send is not retried',async()=>{
 sendFail=true;const body={id,mailboxId:'one',subject:'Follow up',body:'A new note',requestId:'uncertain-send-123456',confirm:true};
 assert.equal((await call('/send',body)).status,502);const before=sends;assert.equal((await call('/send',body)).delivery.status,'unknown');assert.equal(sends,before);sendFail=false;
});
await test('suppression blocks sending even if another campaign is active',async()=>{
 await call('/save',{type:'contact',id,stage:'suppressed'});const before=sends;assert.equal((await call('/send',{id,mailboxId:'one',subject:'Hello',body:'no',requestId:'another-send-123456',confirm:true})).status,400);assert.equal(sends,before);
});
console.log(`${checks} CRM intelligence checks passed. All providers are fixtures; no real mail, keys or spending.`);
