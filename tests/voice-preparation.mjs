import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync('aesthetics/ui/voice-preparation.js','utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function harness(){
 let scope='owner-A/project-A',clock=0,sequence=0,micGate=null,tokenGate=null,answerGate=null,blocked=false,ack=true;
 const timers=new Map(),connections=[],microphones=[],events=[],requests=[],stops=[];
 const timer=(fn,ms,repeat=false)=>{const id=++sequence;timers.set(id,{fn,at:clock+ms,ms,repeat});return id;};
 class Audio{setAttribute(){}play(){events.push('play');return blocked?Promise.reject(Error('NotAllowedError')):Promise.resolve();}pause(){events.push('pause');}}
 class PC{
  constructor(){connections.push(this);this.connectionState='new';this.sender={track:null,replaceTrack:async track=>{this.sender.track=track;events.push('attach');}};}
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
 const manager=ctx.window.MayaVoicePreparation.create({scope:()=>scope,token:async signal=>{events.push('token');if(tokenGate)await tokenGate.promise;return {value:'ephemeral-fixture',model:'fixture-model'};},
  onActive:s=>{s.dc.send(JSON.stringify({type:'conversation.item.create',scope}));s.dc.send(JSON.stringify({type:'response.create'}));},onMessage:(event,s)=>events.push('message'),onStop:reason=>stops.push(reason),onPlaybackBlocked:()=>events.push('playback-blocked')});
 return {manager,events,requests,microphones,connections,stops,setScope:value=>scope=value,setMicGate:g=>micGate=g,setTokenGate:g=>tokenGate=g,setAnswerGate:g=>answerGate=g,setBlocked:v=>blocked=v,setAck:v=>ack=v,
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
for(const boundary of ['token','answer','microphone']){
 const h=harness(),gate=deferred();if(boundary==='token')h.setTokenGate(gate);if(boundary==='answer')h.setAnswerGate(gate);if(boundary==='microphone')h.setMicGate(gate);
 const pending=h.manager.start().catch(e=>e);await flush();assert.ok(h.events.indexOf('microphone')<h.events.indexOf('token'),'cold start requests capture without a network wait');
 h.manager.stop('off');gate.resolve();const value=await pending;assert.equal(value.name,'AbortError');assert.equal(h.manager.current,null);assert.ok(h.microphones.every(m=>m.getTracks()[0].stopped));assert.ok(h.connections.every(p=>p.connectionState==='closed'));assert.ok(h.connections.every(p=>p.dc.sent.length===0));
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
console.log('Voice preparation: no microphone/output before wake, warm reuse, immediate cold capture, bounded idle/setup, scoped cancellation, late mic cleanup, playback recovery and honest timing events passed.');
