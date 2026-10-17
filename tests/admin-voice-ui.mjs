// Actual Admin HTML with isolated fake auth, recognition, microphone and Realtime.
// This verifies lifecycle/wiring and presentation; it does not measure live latency.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';

const root=resolve(new URL('..',import.meta.url).pathname);
const expires=Math.floor(Date.now()/1000)+3600;
const jwt=(sub,revision=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,revision,exp:expires})).toString('base64url')+'.fixture';
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
 window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){}}}};
 window.fixture={pcs:[],tracks:[],events:[],blocked:false,autoSession:false,holdMicrophone:false};
 const timeout=window.setTimeout.bind(window);
 window.setTimeout=(fn,delay,...args)=>{const id=timeout(fn,delay,...args);if(delay===20000)fixture.expireSetup=()=>{clearTimeout(id);fn(...args);};return id;};
 class FakeAudio{
  setAttribute(){}
  play(){fixture.events.push('play');return fixture.blocked?Promise.reject(new DOMException('Blocked','NotAllowedError')):Promise.resolve();}
  pause(){fixture.events.push('pause');}
 }
 class FakePC{
  constructor(){fixture.pcs.push(this);this.connectionState='new';this.sender={track:null,replaceTrack:async track=>{if(fixture.failAttach)throw Error('Fixture audio attachment failed');this.sender.track=track;fixture.events.push('attach');}};}
  addTransceiver(){return {sender:this.sender};}
  createDataChannel(){return this.dc={sent:[],send:value=>{const message=JSON.parse(value);fixture.events.push(message.type);this.dc.sent.push(message);},close(){this.closed=true;}};}
  async createOffer(){return {type:'offer',sdp:'fixture offer'};}
  async setLocalDescription(){}
  async setRemoteDescription(){this.connectionState='connected';this.ontrack({streams:[{}]});queueMicrotask(()=>{this.dc.onopen();this.channelOpened=true;if(fixture.autoSession)this.dc.onmessage({data:JSON.stringify({type:'session.created'})});});}
  close(){this.connectionState='closed';}
 }
 class FakeRecognition{constructor(){fixture.rec=this;}start(){queueMicrotask(()=>this.onstart?.());}abort(){this.aborted=true;}stop(){}}
 window.Audio=FakeAudio;window.RTCPeerConnection=FakePC;window.SpeechRecognition=FakeRecognition;
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{
  fixture.events.push('microphone');
  const track={stopped:false,stop(){this.stopped=true;}};fixture.tracks.push(track);
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  if(fixture.holdMicrophone)await new Promise(resolve=>fixture.releaseMicrophone=resolve);
  return stream;
 }}});
});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.hostname==='api.openai.com'&&url.pathname==='/v1/realtime/calls'){requests.push({kind:'sdp'});return route.fulfill({body:'fixture answer',contentType:'application/sdp'});}
 if(url.hostname!=='maya-admin-voice.test')return route.abort();
 if(url.pathname==='/api/admin/voice-token'){requests.push({kind:'token',auth:req.headers().authorization});return route.fulfill({json:{ok:true,value:'ephemeral-fixture',model:'fixture-model'}});}
 if(url.pathname==='/api/admin/design'&&req.method()==='POST'){assert.ok(validDesign(req.postDataJSON()));return route.fulfill({json:{ok:true}});}
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,connected:true,list:[],leads:{connected:true,list:[]},threads:[],folders:[],total:0,items:[],notes:[],briefing:[],attention:[],ranges:{},accounts:{total:0},models:[]}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const wake=()=>page.evaluate(()=>{const result=[{transcript:'hi maya'}];result.isFinal=false;fixture.rec.onresult({resultIndex:0,results:[result]});});
const ready=()=>page.waitForFunction(()=>_adminVoiceLine?.metrics.at(-1)?.name==='connection-ready');
try{
 await page.goto('https://maya-admin-voice.test/backend/status.html');
 await page.waitForFunction(()=>typeof toggleMayaVoice==='function'&&!!window.MayaVoicePreparation);
 await page.evaluate(token=>_adoptToken(token),jwt('owner-A'));
 assert.equal(await page.evaluate(()=>fixture.pcs.length),0,'Admin does not prepare until wake is explicitly enabled');
 await page.evaluate(()=>toggleWakeWord());
 await page.waitForFunction(()=>fixture.pcs[0]?.channelOpened);
 assert.deepEqual(requests.map(r=>r.kind),['token','sdp']);assert.equal(requests[0].auth,'Bearer '+jwt('owner-A'));
 assert.deepEqual(await page.evaluate(()=>({tracks:fixture.tracks.map(t=>t.stopped),sent:fixture.pcs[0].dc.sent,attached:!!fixture.pcs[0].sender.track,active:!!_voice,ready:_adminVoiceLine.metrics.some(m=>m.name==='connection-ready')})),{tracks:[true],sent:[],attached:false,active:false,ready:false},'Permission probe stops and channel-open alone is not server readiness');
 await page.evaluate(()=>fixture.pcs[0].dc.onmessage({data:JSON.stringify({type:'session.created'})}));await ready();
 assert.deepEqual(await page.evaluate(()=>fixture.pcs[0].dc.sent),[],'Ready standby neither greets nor generates before wake');
 await page.evaluate(()=>{window.MAYA_ADMIN_DATA={...window.MAYA_ADMIN_DATA,command:{atWake:'CURRENT_ADMIN_SNAPSHOT'}};});
 await wake();await page.waitForFunction(()=>_voice?.active&&fixture.pcs[0].sender.track!==null);
 assert.deepEqual(requests.map(r=>r.kind),['token','sdp'],'Interim Hi Maya uses the prepared connection');
 assert.match(await page.evaluate(()=>fixture.pcs[0].dc.sent[0].item.content[0].text),/CURRENT_ADMIN_SNAPSHOT/);
 assert.equal(await page.evaluate(()=>fixture.events.indexOf('conversation.item.create')<fixture.events.indexOf('attach')),true,'Fresh Admin context precedes microphone upload');
 const epoch=await page.evaluate(()=>_adminSession);
 await page.evaluate(token=>_adoptToken(token),jwt('owner-A',2));
 assert.deepEqual(await page.evaluate(()=>({epoch:_adminSession,active:!!_voice?.active,pcs:fixture.pcs.length,stopped:fixture.tracks.at(-1).stopped})),{epoch,active:true,pcs:1,stopped:false},'Real token-adoption path preserves same-account active voice');
 await page.evaluate(()=>{fixture.blocked=true;return _adminVoiceLine.resumePlayback();});
 assert.equal(await page.locator('#voice-chip-word').textContent(),'Tap to hear Maya');
 await page.evaluate(()=>MayaTypographyControls.ready);
 for(const saved of [false,true]){
  if(saved)await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);for(const [role,size]of Object.entries({H1:32,H2:28,H3:24,H4:20,P1:18,P2:16,P3:14}))d.type[role].size=size;Object.assign(d.type.P3,{color:'gray',font:'cormorant',weight:500,style:'italic'});Object.assign(d.glass,{fill:65,rim:70,blur:9,saturation:120});d.pillX=24;d.pillY=12;return MayaTypographyControls.save(d);});
  for(const width of [320,390,768,1024,1440,1920])for(const open of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(open=>toggleDrawer(open),open);await page.waitForFunction(open=>document.body.classList.contains('drawer-open')===open,open);await page.locator('#voice-chip').focus();
   const actual=await page.locator('#voice-chip').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {tag:el.tagName,role:el.dataset.mayaType,size:s.fontSize,color:s.color,x:s.paddingLeft,y:s.paddingTop,background:s.backgroundColor,blur:s.backdropFilter,left:r.left,right:r.right,bottom:r.bottom,focused:el===document.activeElement,reachable:el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),dockControls:[...document.querySelectorAll('#voice-dock button')].filter(b=>b.getClientRects().length).map(b=>{const t=b.getBoundingClientRect();return {id:b.id,overlap:r.left<t.right&&r.right>t.left&&r.top<t.bottom&&r.bottom>t.top};})};});
   const label=`${saved?'saved':'default'} width=${width} drawer=${open}`;
   if((width===390||width===1440)&&open)await page.screenshot({path:`/private/tmp/maya-admin-voice-${saved?'saved':'default'}-${width}.png`});
   assert.equal(actual.tag,'BUTTON',label+' accessible recovery');assert.equal(actual.role,'P3');assert.equal(actual.size,saved?'14px':'10px');assert.equal(actual.color,saved?'rgb(170, 181, 196)':'rgb(255, 255, 255)');assert.equal(actual.x,saved?'24px':'14px');assert.equal(actual.y,saved?'12px':'6px');assert.equal(actual.background,saved?'rgba(3, 15, 29, 0.65)':'rgba(3, 15, 29, 0.18)');assert.equal(actual.blur,saved?'blur(9px) saturate(1.2)':'blur(22px) saturate(1.8)');assert.ok(actual.left>=0&&actual.right<=width&&actual.bottom<=900,label+' stays in viewport: '+JSON.stringify(actual));assert.ok(actual.focused&&actual.reachable,label+' focusable and reachable');if(open)assert.ok(actual.dockControls.every(x=>!x.overlap),label+' never covers a voice dock control: '+JSON.stringify(actual.dockControls));
  }
 }
 await page.evaluate(()=>{fixture.blocked=false;});await page.locator('#voice-chip').click();
 assert.equal(await page.evaluate(()=>!!_voice?.active),true,'Recovery click resumes instead of hanging up');assert.equal(await page.evaluate(()=>_voice.playbackBlocked),false);
 await page.evaluate(()=>{for(const type of ['response.audio_transcript.done','response.output_audio_transcript.done'])fixture.pcs[0].dc.onmessage({data:JSON.stringify({type,transcript:type})});fixture.pcs[0].dc.onmessage({data:JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:'Owner words'})});});
 assert.equal(await page.locator('#maya-chat .maya-msg').count(),3,'Legacy/GA Maya transcripts and owner transcription appear');
 await page.evaluate(()=>{fixture.originalTool=window._voiceTool;fixture.toolCalls=0;window._voiceTool=async()=>{fixture.toolCalls++;return {ok:true};};_voiceToolChain=new Promise(resolve=>fixture.releaseTool=resolve);fixture.pcs[0].dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done',call_id:'stale',name:'find_lead',arguments:'{}'})});});
 await page.evaluate(({b,a})=>{_adoptToken(b);_adoptToken(a);fixture.releaseTool();},{b:jwt('owner-B'),a:jwt('owner-A',3)});
 await page.waitForTimeout(20);
 assert.deepEqual(await page.evaluate(()=>({current:_adminVoiceLine.current,calls:fixture.toolCalls,wake:_wakeWantOn,stopped:fixture.tracks.every(t=>t.stopped)})),{current:null,calls:0,wake:false,stopped:true},'Actual A→B→A account adoption clears voice and prevents queued tools');
 await page.evaluate(()=>{fixture.pcs[0].dc.onmessage({data:JSON.stringify({type:'response.output_audio_transcript.done',transcript:'Old account text'})});window._voiceTool=fixture.originalTool;});assert.equal(await page.locator('#maya-chat .maya-msg').count(),0,'Late private transcripts cannot return after account change');
 await page.evaluate(()=>{fixture.autoSession=true;return toggleWakeWord();});await ready();
 const prepared=await page.evaluate(()=>fixture.pcs.length);await page.evaluate(token=>_adoptToken(token),jwt('owner-A',4));
 assert.equal(await page.evaluate(()=>!!_adminVoiceLine.current&&!_adminVoiceLine.current.active&&fixture.pcs.length),prepared,'Same-account renewal also preserves standby');
 await page.evaluate(()=>toggleWakeWord());assert.equal(await page.evaluate(()=>_adminVoiceLine.current),null,'Wake off closes silent standby');
 const requestCount=requests.length;await page.waitForTimeout(900);assert.equal(requests.length,requestCount,'Off cannot renew or request another token');
 await page.evaluate(()=>toggleMayaVoice());await page.waitForFunction(()=>!!_voice?.active);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>_adminVoiceLine.current),null,'Hidden Admin closes active voice');assert.equal(await page.evaluate(()=>fixture.tracks.every(t=>t.stopped)),true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});fixture.autoSession=false;fixture.holdMicrophone=true;void toggleMayaVoice();});
 await page.waitForFunction(()=>!!fixture.releaseMicrophone&&fixture.pcs.at(-1).channelOpened);
 assert.equal(await page.evaluate(()=>!!_voice),false,'Delayed server readiness and microphone cannot activate early');
 await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));fixture.releaseMicrophone();fixture.pcs.at(-1).dc.onmessage({data:JSON.stringify({type:'session.created'})});});
 await page.waitForFunction(()=>fixture.tracks.every(t=>t.stopped));assert.equal(await page.evaluate(()=>_adminVoiceLine.current),null,'Page exit cancels pending readiness and releases a late microphone');
 // Helper-driven stops have the same tool cancellation contract as explicit hang-up.
 for(const reason of ['disconnected','idle']){
  await page.evaluate(()=>{fixture.autoSession=true;fixture.holdMicrophone=false;return toggleMayaVoice();});
  await page.waitForFunction(()=>!!_voice?.active);
  const generation=await page.evaluate(()=>_voiceGeneration);
  await page.evaluate(reason=>{fixture.toolCalls=0;window._voiceTool=async()=>{fixture.toolCalls++;return {ok:true};};_voiceToolChain=new Promise(resolve=>fixture.releaseStoppedTool=resolve);_voice.dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done',call_id:reason,name:'log_feature',arguments:'{}'})});fixture.stoppedTool=_voiceToolChain;if(reason==='disconnected'){_voice.pc.connectionState='disconnected';_voice.pc.onconnectionstatechange();}else _adminVoiceLine.stop('idle');fixture.releaseStoppedTool();},reason);
  await page.evaluate(()=>fixture.stoppedTool);
  assert.deepEqual(await page.evaluate(()=>({calls:fixture.toolCalls,current:_adminVoiceLine.current,active:!!_voice,chip:document.getElementById('voice-chip').classList.contains('show'),generation:_voiceGeneration})),{calls:0,current:null,active:false,chip:false,generation:generation+1},reason+' invalidates queued tools and clears active UI');
  await page.evaluate(()=>window._voiceTool=fixture.originalTool);
 }
 // A lookup already running may not create a fresh approval after the line ends.
 for(const name of ['update_lead','note_lead','draft_email']){
  await page.evaluate(()=>toggleMayaVoice());await page.waitForFunction(()=>!!_voice?.active);
  await page.evaluate(name=>{fixture.originalLookup=window._mayaLeadLookup;window._mayaLeadLookup=()=>new Promise(resolve=>fixture.releaseLookup=()=>resolve({ok:true,lead:{id:'fixture-lead',name:'Fixture lead',email:'fixture@example.test'}}));_voice.dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done',call_id:name,name,arguments:JSON.stringify({lead:'Fixture lead',name:'Corrected name',note:'Private note',request:'Reviewed draft'})})});fixture.pendingLookupTool=_voiceToolChain;},name);
  await page.waitForFunction(()=>!!fixture.releaseLookup);
  await page.evaluate(()=>{_voice.pc.connectionState='disconnected';_voice.pc.onconnectionstatechange();fixture.releaseLookup();});await page.evaluate(()=>fixture.pendingLookupTool);
  assert.equal(await page.evaluate(()=>_mayaActions.length),0,name+' never queues after disconnect');
  await page.evaluate(()=>{window._mayaLeadLookup=fixture.originalLookup;delete fixture.releaseLookup;});
 }
 await page.evaluate(()=>toggleMayaVoice());await page.waitForFunction(()=>!!_voice?.active);
 const accepted=await page.evaluate(()=>_voiceTool('remember',{text:'Review remains available after the call.'}));
 await page.evaluate(()=>_adminVoiceLine.stop('idle'));
 assert.equal(await page.evaluate(()=>_mayaActions.length),1,'Already queued actions remain available for explicit review after voice ends');await page.evaluate(id=>mayaDismissAction(id),accepted.actionId);
 // Invoke the actual registered setup-deadline callback without a 20s wall wait.
 await page.evaluate(()=>{fixture.autoSession=false;_wakeWantOn=true;void toggleMayaVoice();});await page.waitForFunction(()=>fixture.pcs.at(-1).channelOpened);
 await page.evaluate(()=>fixture.expireSetup());await page.waitForFunction(()=>!_voiceStarting);
 assert.deepEqual(await page.evaluate(()=>({current:_adminVoiceLine.current,active:!!_voice,chip:document.getElementById('voice-chip').classList.contains('show'),stopped:fixture.tracks.every(t=>t.stopped)})),{current:null,active:false,chip:false,stopped:true},'Setup deadline clears pending UI and capture');
 assert.match(await page.locator('#maya-command-state').textContent(),/took too long/);assert.match(await page.locator('#voice-word').textContent(),/try again/);
 const beforeWakeRestart=requests.length;await page.waitForFunction(()=>_wakeOn);assert.equal(requests.length,beforeWakeRestart,'Timeout resumes wake recognition without another paid preparation');
 await page.evaluate(()=>{_wakeWantOn=false;_wakeStop();fixture.autoSession=true;fixture.failAttach=true;return toggleMayaVoice();});
 assert.equal(await page.locator('#voice-chip').isVisible(),false);assert.equal(await page.evaluate(()=>fixture.tracks.every(t=>t.stopped)),true);assert.match(await page.locator('#maya-command-state').textContent(),/did not connect/,'Failed microphone attachment remains an explicit error after activation callback');
 assert.deepEqual(errors,[]);
 console.log('Admin voice UI passed: opt-in silent standby, server readiness, warm Hi Maya, fresh context, token renewal, account/off/hidden/exit cancellation, disconnect/idle queued and pending tools, timeout UI, stale transcripts, playback recovery and default/saved six-width shared styling. Fake providers only; no live latency claim.');
}catch(error){console.error('Admin voice page errors:',errors);await page.screenshot({path:'/private/tmp/maya-admin-voice-failure.png'});throw error;}
finally{await browser.close();}
