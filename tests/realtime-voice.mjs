// Pure fake-provider and extracted production-route tests. No keys or sockets.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createVoiceSecret,webVoiceSession,voiceTurnDetection,VOICE_DELIVERY} from '../docs/server/realtime-voice.mjs';
import {buildAdminCommandSnapshot,buildRealtimeCommandContext,withinVoiceBudget} from '../docs/server/admin-command.mjs';

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
const source=await readFile(new URL('../docs/server/server.js',import.meta.url),'utf8');
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
