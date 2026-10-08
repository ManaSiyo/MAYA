// Deterministic transport/store stress fixture. No real credentials or providers.
// Optional report: MAYA_MESSAGE_STRESS_RESULTS=/private/tmp/maya-message-stress-results.json
// This intentionally fails on safety defects; do not change expectations to bless them.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import express from 'express';
import {createMessageStore, mountMessages, sendSms, readSmsStatus, THREADS_PATH} from '../docs/server/maya-messages.mjs';
import {createMessageArchive} from '../docs/server/message-archive.mjs';

const started = performance.now();
const OWNER = '+15105550100', CLIENT = '+14155550123';
const AUTH = 'fixture-only-signature-secret', HOST = 'maya-stress.invalid';
const checks = [], timings = [], providerCalls = [], routeLogs = [];
const counters = {signedInbound:0, signedStatuses:0, adminSends:0, storageReads:0, storageWrites:0, generationConflicts:0, transientRetries:0, ownerEffects:0, ownerDelegateCalls:0};
const objects = new Map(), servers = [];
let generation = 0, failArchiveWrites = false, failLiveWrites = 0, failLiveReads = 0, readGate = null, rateLimited = false;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const pause = ms => new Promise(r => setTimeout(r, ms));
const problem = (message, status=503) => Object.assign(new Error(message), {status});
function check(name, condition, detail={}) {
  checks.push({name, passed:!!condition, ...(!condition ? {detail} : {})});
  console.log(`${condition ? 'ok' : 'FAIL'} message-stress: ${name}${condition ? '' : ' ' + JSON.stringify(detail)}`);
}
async function read(key) {
  counters.storageReads++;
  if (key === THREADS_PATH && failLiveReads) { failLiveReads--; return {ok:false,status:503}; }
  const item = objects.get(key);
  // A read really returns its captured generation, including when held in flight.
  const snapshot = item ? {ok:true,buf:Buffer.from(item.buf),generation:item.generation} : {ok:false,status:404};
  if (key === THREADS_PATH && readGate) {
    const gate = readGate; readGate = null; gate.entered.resolve(); await gate.release.promise;
  }
  return snapshot;
}
async function write(key, buf, _type, expected) {
  await new Promise(r => setImmediate(r));
  if (key.startsWith('private/messages-archive/') && failArchiveWrites) throw problem('injected archive outage');
  if (key === THREADS_PATH && failLiveWrites) { failLiveWrites--; throw problem('injected live write outage'); }
  const current = objects.get(key)?.generation || '0';
  if (String(expected) !== current) { counters.generationConflicts++; throw problem('generation conflict',412); }
  objects.set(key, {buf:Buffer.from(buf), generation:String(++generation)}); counters.storageWrites++;
}
const archive = createMessageArchive({read,write});
const storeDeps = {
  archive,
  load: async () => {
    const item = await read(THREADS_PATH);
    if (!item.ok) { if (item.status === 404) return {threads:{},_generation:'0'}; throw problem('injected read outage'); }
    return {...JSON.parse(item.buf),_generation:item.generation};
  },
  save: async ({_generation,...record}) => write(THREADS_PATH,Buffer.from(JSON.stringify(record)),'application/json',_generation),
  log: (...parts) => routeLogs.push(parts.join(' ')),
};
const stores = [createMessageStore(storeDeps), createMessageStore(storeDeps)];
const persisted = () => JSON.parse(objects.get(THREADS_PATH)?.buf || '{"threads":{}}');
const listen = async server => {
  servers.push(server);
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  return 'http://127.0.0.1:' + server.address().port;
};
const signature = (path, params) => crypto.createHmac('sha1',AUTH)
  .update('https://' + HOST + path + Object.keys(params).sort().map(key => key + params[key]).join('')).digest('base64');
const ownerReplies = new Map();
// Identity/command execution is delegated by mountMessages. This fixture verifies
// ingress and TwiML/history, not the separate owner-command implementation.
async function ownerCommand(input) {
  counters.ownerDelegateCalls++;
  if (input.from !== OWNER) return '';
  if (!ownerReplies.has(input.sid)) {
    counters.ownerEffects++; ownerReplies.set(input.sid,'Founder report: A & B <lead> ' + input.sid);
  }
  return ownerReplies.get(input.sid);
}
const bases = [];
async function request(index, path, options={}, category='read') {
  const start = performance.now();
  try {
    const response = await fetch(bases[index] + path,{...options,signal:AbortSignal.timeout(15000)});
    const text = await response.text();
    let json; try { json = JSON.parse(text); } catch {}
    timings.push({category,ms:performance.now()-start,status:response.status});
    return {status:response.status,text,json,headers:response.headers};
  } catch (error) { timings.push({category,ms:performance.now()-start,error:error.message}); throw error; }
}
async function webhook(params, index=0, path='/api/phone/sms') {
  counters[path.includes('/status') ? 'signedStatuses' : 'signedInbound']++;
  return request(index,path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':signature(path,params)},body:new URLSearchParams(params)},path.includes('/status')?'status':'inbound');
}
const inbound = (number,sid,text='I would like a fitting',index=0,extra={}) => webhook({From:number,MessageSid:sid,Body:text,...extra},index);
const status = (sid,value,index=0,extra={},replyTo='') => webhook({MessageSid:sid,MessageStatus:value,...extra},index,'/api/phone/sms/status' + (replyTo ? '?replyTo='+replyTo : ''));
function admin(action,body,index=0,token='admin-a') {
  if (action === 'send') counters.adminSends++;
  return request(index,'/api/admin/messages/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body)},action==='send'?'admin-send':'admin-mutation');
}
const adminRead = (path,index=0,token='admin-a') => request(index,path,{headers:token ? {Authorization:'Bearer '+token} : {}},'admin-read');
async function batches(items, fn, size=16) {
  const results = [];
  for (let i=0;i<items.length;i+=size) results.push(...await Promise.all(items.slice(i,i+size).map(fn)));
  return results;
}
const range = n => Array.from({length:n},(_,i)=>i);
const sid = (family,i) => 'SM' + family + String(i).padStart(5,'0');
let fatal;
try {
  const twilio = await listen(http.createServer(async (req,res) => {
    let raw=''; for await (const part of req) raw+=part;
    if (req.method === 'GET') {
      const id = req.url.split('/').at(-1).replace('.json','');
      const sent = providerCalls.find(item=>item.sid===id);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(sent ? {to:sent.to,status:'delivered',error_code:null} : {code:20404})); return;
    }
    const form = Object.fromEntries(new URLSearchParams(raw));
    const entry = {sid:sid('FakeCarrier',providerCalls.length),to:form.To,text:form.Body,consentAtProvider:persisted().threads[form.To]?.consent,blockedAtProvider:!!persisted().threads[form.To]?.blocked};
    providerCalls.push(entry);
    await pause(3); // Bounded provider latency, never an external API request.
    if (form.Body === 'fixture unknown outcome') { req.socket.destroy(); return; }
    if (form.Body === 'fixture history write failure') failLiveWrites=1;
    res.statusCode=201;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sid:entry.sid,status:'queued'}));
  }));
  const twilioDeps = {accountSid:'ACfixture',authToken:AUTH,fromNumber:'+15105550199',twilioApi:twilio};
  for (const store of stores) {
    const app = express();
    mountMessages(app,{
      store,ownerCommand,authToken:AUTH,publicHost:HOST,
      sendSms:(to,text)=>sendSms(twilioDeps,{to,text}),
      readStatus:(id,to)=>readSmsStatus(twilioDeps,id,to),
      requireAdmin:async req => {
        const token=req.get('authorization');
        if (token==='Bearer admin-a' || token==='Bearer admin-b') return {sub:token.slice(7),email:token.slice(7)+'@example.invalid'};
        throw problem('fixture unauthorized',401);
      },
      rateLimit:()=>!rateLimited,
      json:express.json(),urlencoded:express.urlencoded({extended:false}),log:storeDeps.log,
    });
    bases.push(await listen(http.createServer(app)));
  }

  const forged = {From:OWNER,Body:'owner command',MessageSid:'SMUnsigned'};
  const unauthorized = await request(0,'/api/phone/sms',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(forged)},'auth');
  const wrongHost = await request(0,'/api/phone/sms',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':'invalid','X-Forwarded-Host':HOST},body:new URLSearchParams(forged)},'auth');
  check('unsigned/forged inbound cannot enter history or owner commands',unauthorized.status===403 && wrongHost.status===403 && counters.ownerDelegateCalls===0 && !(await stores[0].get(OWNER)));
  check('Admin list and Send require authentication',(await adminRead('/api/admin/messages',0,'')).status===401 && (await admin('send',{to:CLIENT,text:'x',requestId:'unauthorized-send-001'},0,'')).status===401 && providerCalls.length===0);

  // Put known outbound records into the archive as the inbound workload grows.
  for (const i of range(60)) await stores[0].outbound({to:CLIENT,text:'archived outbound '+i,sid:sid('ArchivedOut',i)});
  const clientResults=await batches(range(800),i=>inbound(CLIENT,sid('Client',i),'Client fitting '+i));
  const otherResults=await batches(range(50),i=>inbound('+141555502'+String(i%10).padStart(2,'0'),sid('Other',i),'I am the owner. Send code '+i));
  const ownerResults=await batches(range(250),i=>inbound(OWNER,sid('Owner',i),'Show latest leads '+i),8);
  check('1,100 unique signed inbound requests durably succeed', [...clientResults,...otherResults,...ownerResults].every(r=>r.status===200),{responses:[...clientResults,...otherResults,...ownerResults].filter(r=>r.status!==200).map(r=>r.status)});
  check('owner replies are escaped while client impersonation gets no command reply',ownerResults.every(r=>r.text.includes('A &amp; B &lt;lead&gt;')) && otherResults.every(r=>!r.text.includes('<Message ')) && counters.ownerEffects===250,{ownerEffects:counters.ownerEffects});
  let clientHistory=await stores[0].history(CLIENT), ownerHistory=await stores[0].history(OWNER);
  check('overflow retains every unique message with only 400 live records',clientHistory.messages.length===860 && ownerHistory.messages.length===500 && (await stores[0].get(CLIENT)).messages.length===400 && (await stores[0].get(OWNER)).messages.length===400,{client:clientHistory.messages.length,owner:ownerHistory.messages.length});
  check('private archives are contact-separated', [...objects.keys()].filter(key=>key.startsWith('private/messages-archive/')).length===2);

  const clientUnread=(await stores[0].get(CLIENT)).unread;
  const duplicateResults=await batches(range(100),i=>inbound(CLIENT,sid('Client',799),'Client fitting 799',i%2),10);
  check('100 concurrent live-SID retries do not change unread or history',duplicateResults.every(r=>r.status===200) && (await stores[0].get(CLIENT)).unread===clientUnread && (await stores[0].history(CLIENT)).messages.length===860);
  // Cross-instance mutations create genuine CAS conflicts, not mocked retry counters.
  const concurrent=await batches(range(64),i=>inbound('+14155550300',sid('Concurrent',i),'Concurrent '+i,i%2),8);
  for (const i of range(64)) if (concurrent[i].status===503) { counters.transientRetries++; concurrent[i]=await inbound('+14155550300',sid('Concurrent',i),'Concurrent '+i,i%2); }
  const concurrentHistory=await stores[0].history('+14155550300');
  check('two process-local queues preserve every accepted concurrent message',concurrent.every(r=>r.status===200) && concurrentHistory.messages.length===64 && new Set(concurrentHistory.messages.map(m=>m.id)).size===64 && counters.generationConflicts>0,{statuses:concurrent.map(r=>r.status),count:concurrentHistory.messages.length,conflicts:counters.generationConflicts});

  // Delivery callbacks arrive out of order after the outgoing record was archived.
  const delivered=await batches(range(60),i=>status(sid('ArchivedOut',i),'delivered'));
  const downgraded=await batches(range(120),i=>status(sid('ArchivedOut',i%60),i%2?'queued':'sent'));
  clientHistory=await stores[0].history(CLIENT);
  check('180 archived status callbacks cannot downgrade terminal delivery', [...delivered,...downgraded].every(r=>r.status===204) && clientHistory.messages.filter(m=>m.dir==='out').every(m=>m.status==='delivered'));
  for (const i of range(20)) {
    await status(sid('Early',i),'undelivered',0,{ErrorCode:'30034'});
    await stores[0].outbound({to:'+14155550400',text:'early callback '+i,sid:sid('Early',i)});
    await status(sid('Early',i),'sent',1);
    await status(sid('Early',i),'delivered',0);
  }
  check('callbacks before history preserve the first terminal state and carrier error',(await stores[0].history('+14155550400')).messages.every(m=>m.status==='undelivered' && m.errorCode==='30034'));

  const historyBefore=await stores[0].history(CLIENT), original=historyBefore.messages.find(m=>m.id===sid('Client',0));
  const beforeReplay=(await stores[0].get(CLIENT)).unread;
  await inbound(CLIENT,sid('Client',0),'Client fitting 0');
  const afterReplay=await stores[0].history(CLIENT), replay=afterReplay.messages.find(m=>m.id===sid('Client',0));
  check('an archived inbound SID remains idempotent without new unread or chronology',afterReplay.unread===beforeReplay && replay.ts===original.ts && afterReplay.messages.length===historyBefore.messages.length,{beforeUnread:beforeReplay,afterUnread:afterReplay.unread,originalTimestamp:original.ts,replayedTimestamp:replay.ts});

  await status('SMActualOwnerReply','delivered',0,{},sid('Owner',0));
  ownerHistory=await stores[0].history(OWNER);
  const reconciled=ownerHistory.messages.find(m=>m.id==='SMActualOwnerReply');
  check('a late owner-reply callback reconciles its archived synthetic ID',reconciled?.status==='delivered' && reconciled.replyTo===sid('Owner',0) && !ownerHistory.messages.some(m=>m.id==='owner-reply-'+sid('Owner',0)),{actualCarrierRecord:reconciled||null,syntheticRecord:ownerHistory.messages.find(m=>m.id==='owner-reply-'+sid('Owner',0))});

  // Archive-before-trim is a real failure boundary, with the same SID retried.
  const archiveThreadBefore=await stores[0].get(CLIENT);
  failArchiveWrites=true;
  const archiveFailure=await inbound(CLIENT,'SMArchiveOutage','Arrived during archive outage');
  failArchiveWrites=false;
  const archiveThreadAfter=await stores[0].get(CLIENT);
  const recovered=await inbound(CLIENT,'SMArchiveOutage','Arrived during archive outage');
  check('archive outage is not acknowledged or allowed to trim live history',archiveFailure.status===503 && JSON.stringify(archiveThreadAfter)===JSON.stringify(archiveThreadBefore) && recovered.status===200 && (await stores[0].history(CLIENT)).messages.filter(m=>m.id==='SMArchiveOutage').length===1,{failedStatus:archiveFailure.status,retryStatus:recovered.status});
  const beforeReadFailure=objects.get(THREADS_PATH).generation;
  failLiveReads=1;
  const readFailure=await inbound(CLIENT,'SMReadOutage','Storage read failure');
  check('a failed live read fails closed without an empty replacement',readFailure.status===503 && objects.get(THREADS_PATH).generation===beforeReadFailure);

  // Opening older pages is read-only; new arrivals after a displayed snapshot remain unread.
  const unreadBeforePage=(await stores[0].get(CLIENT)).unread;
  const oldestLive=(await stores[0].get(CLIENT)).messages[0].id;
  const older=await adminRead('/api/admin/messages/thread?number='+encodeURIComponent(CLIENT)+'&before='+oldestLive);
  check('archive paging returns 100 older messages without marking unread',older.status===200 && older.json.messages.length===100 && (await stores[0].get(CLIENT)).unread===unreadBeforePage);
  const snapshot=await stores[0].get('+14155550300');
  for (const i of range(5)) await inbound('+14155550300',sid('Unread',i),'Unread concurrent '+i);
  await stores[0].markRead('+14155550300',snapshot);
  check('markRead preserves messages arriving after the displayed snapshot',(await stores[0].get('+14155550300')).unread===5);

  const target='+14155550500';
  await inbound(target,'SMSendConsent','Yes');
  const sends=await batches(range(40),i=>admin('send',{to:target,text:'Reviewed Admin draft '+i,requestId:'stress-admin-draft-'+String(i).padStart(5,'0')},i%2),4);
  check('40 reviewed Admin sends reach the fake provider once and retain receipts',sends.every(r=>r.status===200 && r.json.ok) && providerCalls.filter(call=>call.text.startsWith('Reviewed Admin draft')).length===40,{statuses:sends.map(r=>r.status)});
  const beforeConcurrentSend=providerCalls.length;
  const sharedDraft={to:target,text:'One reviewed draft under contention',requestId:'stress-shared-draft-00001'};
  const shared=await batches(range(20),i=>admin('send',sharedDraft,i%2),20);
  const replayed=await admin('send',sharedDraft,1);
  check('20 cross-instance clicks on one draft make only one provider submission',providerCalls.length===beforeConcurrentSend+1 && shared.every(r=>r.status===200 || r.status===409) && replayed.status===200 && replayed.json.ok,{providerDelta:providerCalls.length-beforeConcurrentSend,statuses:shared.map(r=>r.status),replay:replayed.status});
  const mismatch=await admin('send',{...sharedDraft,text:'Changed body with reused request ID'});
  check('reusing a send ID for different content fails without another submission',mismatch.status===409 && providerCalls.length===beforeConcurrentSend+1);
  const otherAdmin=await admin('send',sharedDraft,0,'admin-b');
  check('send request IDs are bound to authenticated Admin identity',otherAdmin.status===200 && providerCalls.length===beforeConcurrentSend+2);

  // Begin texting explicitly accepts +country code numbers (design.md and
  // message-compose-ui.mjs); only the separate phone-call action is US-only.
  const beforeInternational=providerCalls.length;
  const international=await admin('send',{to:'+447700900123',text:'Reviewed international SMS',requestId:'stress-international-00001'});
  check('a valid explicit international SMS accepted by the UI reaches the provider',international.status===200 && international.json.ok && providerCalls.length===beforeInternational+1 && providerCalls.at(-1).to==='+447700900123',{response:international.status,result:international.json,providerDelta:providerCalls.length-beforeInternational});

  let beforeSafeguards=providerCalls.length;
  const invalid=await Promise.all([
    admin('send',{to:target,text:'x'}),
    admin('send',{to:target,text:'x'.repeat(1601),requestId:'stress-too-long-00001'}),
    admin('send',{to:target,text:'',requestId:'stress-empty-000001'}),
  ]);
  rateLimited=true;const limited=await admin('send',{to:target,text:'x',requestId:'stress-rate-limit-00001'});rateLimited=false;
  check('missing send ID, empty, oversize and rate-limited sends avoid the provider',invalid.every(r=>r.status>=400) && limited.status===429 && providerCalls.length===beforeSafeguards);
  await inbound(target,'SMStop','STOP');
  const stopped=await admin('send',{to:target,text:'do not send',requestId:'stress-stop-send-00001'});
  await inbound(target,'SMHelp','HELP',0,{OptOutType:'HELP'});
  check('STOP prevents Admin Send and HELP never clears consent',stopped.status===409 && (await stores[0].get(target)).consent==='stop' && providerCalls.length===beforeSafeguards);
  await admin('block',{number:target,blocked:true});
  await inbound(target,'SMBlockedStart','START',0,{OptOutType:'START'});
  const blocked=await admin('send',{to:target,text:'do not send',requestId:'stress-block-send-00001'});
  await admin('block',{number:target,blocked:false});
  check('blocking survives START and unblocking preserves STOP',blocked.status===409 && (await stores[0].get(target)).consent==='stop' && providerCalls.length===beforeSafeguards);
  await inbound(target,'SMStart','START');
  check('explicit START re-enables a reviewed send',(await admin('send',{to:target,text:'reviewed after START',requestId:'stress-restart-000001'})).status===200);

  const unknownBody={to:target,text:'fixture unknown outcome',requestId:'stress-unknown-000001'};
  beforeSafeguards=providerCalls.length;
  const unknown=await admin('send',unknownBody), unknownRetry=await admin('send',unknownBody,1);
  check('unknown carrier outcome is non-retryable for the same send ID',unknown.status===502 && unknownRetry.status===409 && providerCalls.length===beforeSafeguards+1,{first:unknown.status,retry:unknownRetry.status,providerDelta:providerCalls.length-beforeSafeguards});
  const historyFailureBody={to:target,text:'fixture history write failure',requestId:'stress-history-fail-00001'};
  beforeSafeguards=providerCalls.length;
  const historyFailure=await admin('send',historyFailureBody), historyRetry=await admin('send',historyFailureBody,1);
  check('accepted send with failed history is truthful and never resent on retry',historyFailure.status===200 && /history could not be saved/i.test(historyFailure.json.warning||'') && historyRetry.status===200 && historyRetry.json.sid===historyFailure.json.sid && providerCalls.length===beforeSafeguards+1,{first:historyFailure.json,retry:historyRetry.json});
  failLiveWrites=1;beforeSafeguards=providerCalls.length;
  const claimFailure=await admin('send',{to:target,text:'claim must save first',requestId:'stress-claim-fail-00001'});
  check('a failed durable send claim prevents the provider call',claimFailure.status===503 && providerCalls.length===beforeSafeguards);

  // Hold the initial contact read, persist STOP on another process, then return
  // the old consent snapshot. The later durable send claim reads the new record.
  const raceTarget='+14155550600';
  await inbound(raceTarget,'SMRaceStart','Yes');
  const gate={entered:deferred(),release:deferred()};readGate=gate;
  const raceStart=providerCalls.length;
  const racingSend=admin('send',{to:raceTarget,text:'must not pass a newer STOP',requestId:'stress-stop-race-00001'});
  await Promise.race([gate.entered.promise,pause(5000).then(()=>{throw new Error('contact read gate not entered');})]);
  const raceStop=await inbound(raceTarget,'SMRaceStop','STOP',1);
  gate.release.resolve();
  const racingResult=await racingSend;
  check('a STOP persisted before the durable claim prevents a stale-contact send',raceStop.status===200 && racingResult.status===409 && providerCalls.length===raceStart,{response:racingResult.status,providerDelta:providerCalls.length-raceStart,providerObservations:providerCalls.slice(raceStart)});

  const unsignedStatus=await request(0,'/api/phone/sms/status',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({MessageSid:'SMUnsignedStatus',MessageStatus:'delivered'})},'auth');
  check('unsigned callbacks cannot change delivery state',unsignedStatus.status===403 && !persisted().pendingStatuses?.SMUnsignedStatus);
  check('at least 1,000 real signed message events were exercised',counters.signedInbound>=1000,{count:counters.signedInbound});
  const slowest=Math.max(...timings.map(item=>item.ms));
  check('local fake-provider requests stay within the 15-second fixture deadline',timings.every(item=>!item.error) && slowest<15000,{maxMs:Math.round(slowest)});
} catch (error) {
  fatal={message:error.message,stack:error.stack};
  check('stress fixture completes all cases',false,fatal);
} finally {
  readGate?.release.resolve();
  await Promise.all(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})));
}

const latency={};
for (const category of new Set(timings.map(item=>item.category))) {
  const sorted=timings.filter(item=>item.category===category).map(item=>item.ms).sort((a,b)=>a-b);
  const percentile=p=>Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*100)/100;
  latency[category]={count:sorted.length,p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:percentile(1)};
}
const failures=checks.filter(item=>!item.passed);
const summary={fixture:'actual Messages routes + store + archive; loopback fake Twilio, fake Admin auth and generation-checked memory storage',productionLatencyVerified:false,durationMs:Math.round(performance.now()-started),counts:{...counters,providerCalls:providerCalls.length,checks:checks.length,passed:checks.length-failures.length,failed:failures.length},latency,failures,checks};
if (process.env.MAYA_MESSAGE_STRESS_RESULTS) await writeFile(process.env.MAYA_MESSAGE_STRESS_RESULTS,JSON.stringify(summary,null,2)+'\n');
console.log('MESSAGE_STRESS_SUMMARY '+JSON.stringify({...summary,checks:undefined}));
assert.equal(failures.length,0,`${failures.length} Messages stress safety assertion(s) failed; see MESSAGE_STRESS_SUMMARY`);
