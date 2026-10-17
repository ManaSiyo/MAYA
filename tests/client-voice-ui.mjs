// Real client pages; auth/network/audio/WebRTC/recognition are local fakes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve('.'),browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
const jwt=(sub,version=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,version})).toString('base64url')+'.fixture';
try{
 for(const surface of ['frontend','playground']){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),requests=[];
  await page.addInitScript(()=>{
   localStorage.setItem('maya_admin_tok','fixture-admin');
   window.fixture={pcs:[],tracks:[],events:[],blocked:false,token:'',scope:'owner-A'};
   class FakeAudio{setAttribute(){}play(){fixture.events.push('play');return fixture.blocked?Promise.reject(new DOMException('Blocked','NotAllowedError')):Promise.resolve();}pause(){}}
   class FakePC{
    constructor(){fixture.pcs.push(this);this.connectionState='new';this.sender={track:null,replaceTrack:async t=>{this.sender.track=t;fixture.events.push('attach');}};}
    addTransceiver(){return {sender:this.sender};}
    createDataChannel(){return this.dc={sent:[],send:v=>this.dc.sent.push(JSON.parse(v)),close(){this.closed=true;}};}
    async createOffer(){return {type:'offer',sdp:'fake offer'};}async setLocalDescription(){}
    async setRemoteDescription(){this.connectionState='connected';this.ontrack({streams:[{}]});queueMicrotask(()=>{this.dc.onopen();this.dc.onmessage({data:JSON.stringify({type:'session.created'})});});}
    close(){this.connectionState='closed';}
   }
   class FakeRecognition{constructor(){fixture.rec=this;}start(){queueMicrotask(()=>this.onstart?.());}abort(){}stop(){}}
   window.Audio=FakeAudio;window.RTCPeerConnection=FakePC;window.SpeechRecognition=FakeRecognition;
   Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{fixture.events.push('microphone');const track={stopped:false,stop(){this.stopped=true;}};fixture.tracks.push(track);return {getTracks:()=>[track],getAudioTracks:()=>[track]};}}});
  });
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='api.openai.com'&&u.pathname==='/v1/realtime/calls'){requests.push('sdp');return route.fulfill({body:'fake answer',contentType:'application/sdp'});}
   if(u.hostname!=='maya-voice.test')return route.abort();
   if(u.pathname==='/api/voice-token'){requests.push('token');return route.fulfill({json:{value:'ephemeral-fixture',model:'fixture-model'}});}
   if(u.pathname==='/api/admin/design'){assert.ok(validDesign(route.request().postDataJSON()));return route.fulfill({json:{ok:true}});}
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   try{return route.fulfill({body:readFileSync(root+u.pathname),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
  });
  await page.goto('https://maya-voice.test/'+surface+'/index.html');
  await page.waitForFunction(()=>typeof pgMayaStart==='function'&&!!window.MayaVoicePreparation);
  await page.evaluate(token=>{fixture.token=token;window.getApiKey=window.getGoogleIdToken=()=>fixture.token;document.getElementById('signin-gate').classList.add('hidden');projectStore._uid=()=>fixture.scope;window._pgPhone=()=>false;window._pgWhoAmI=()=> 'Fixture';window._pgDrawerState=()=>({open:false});window._pgBoardSnapshot=()=>[{title:'CURRENT'}];window.showToast=()=>{};},jwt('owner-A'));
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('signin-gate')).opacity==='0');
  await page.evaluate(()=>pgToggleWake());await page.waitForFunction(()=>_pgVoiceLine?.current?.pc.connectionState==='connected');
  assert.deepEqual(requests,['token','sdp']);
  const state=await page.evaluate(()=>({mic:fixture.tracks.map(t=>t.stopped),sent:fixture.pcs[0].dc.sent,attached:!!fixture.pcs[0].sender.track,voice:!!_pgVoice}));
  assert.deepEqual(state,{mic:[true],sent:[],attached:false,voice:false},surface+' permission probe stops; silent standby has no mic/output');
  await page.evaluate(()=>{const result=[{transcript:'hi maya'}];result.isFinal=false;fixture.rec.onresult({resultIndex:0,results:[result]});});
  await page.waitForFunction(()=>_pgVoice?.active&&fixture.pcs[0].sender.track!==null);
  assert.deepEqual(requests,['token','sdp'],surface+' interim Hi Maya reuses warm connection');
  assert.match(await page.evaluate(()=>fixture.pcs[0].dc.sent[0].item.content[0].text),/CURRENT/,'fresh board context precedes greeting');
  await page.evaluate(token=>{fixture.token=token;_pgVoiceLine.checkScope();},jwt('owner-A',2));assert.equal(await page.evaluate(()=>!!_pgVoice?.active),true,'same-account renewal preserves voice');
  await page.evaluate(()=>{fixture.blocked=true;return _pgVoiceLine.resumePlayback();});assert.equal(await page.locator('#pg-maya-chip-word').textContent(),'Tap to hear Maya');
  await page.evaluate(()=>MayaTypographyControls.ready);
  for(const saved of [false,true]){
   if(saved)await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);for(const [role,size]of Object.entries({H1:32,H2:28,H3:24,H4:20,P1:18,P2:16,P3:14}))d.type[role].size=size;Object.assign(d.type.P3,{size:14,color:'gray',font:'cormorant',weight:500,style:'italic'});Object.assign(d.glass,{fill:65,rim:70,blur:9,saturation:120});d.pillX=24;d.pillY=12;return MayaTypographyControls.save(d);});
   for(const width of [320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:900});await page.locator('#pg-maya-chip').focus();
    const actual=await page.locator('#pg-maya-chip').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {size:s.fontSize,color:s.color,x:s.paddingLeft,y:s.paddingTop,background:s.backgroundColor,blur:s.backdropFilter,left:r.left,right:r.right,bottom:r.bottom,focused:el===document.activeElement,reachable:el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),overlapsListen:(()=>{const b=document.getElementById('voice-bar').getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;})()};});
    if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-voice-'+surface+'-'+(saved?'saved':'default')+'-'+width+'.png'});
    assert.equal(actual.size,saved?'14px':'10px');assert.equal(actual.color,saved?'rgb(170, 181, 196)':'rgb(255, 255, 255)');assert.equal(actual.x,saved?'24px':'14px');assert.equal(actual.y,saved?'12px':'6px');assert.equal(actual.background,saved?'rgba(3, 15, 29, 0.65)':'rgba(3, 15, 29, 0.18)');assert.ok(actual.left>=0&&actual.right<=width&&actual.bottom<=900);assert.ok(actual.focused);assert.ok(actual.reachable,'live chip is not covered by another overlay');assert.equal(actual.overlapsListen,false,'voice recovery never covers Tap to listen');
    await page.evaluate(()=>toggleNotesDrawer(true));await page.waitForFunction(()=>{const h=document.getElementById('hscroll');return document.body.classList.contains('drawer-open')&&Math.abs(h.scrollLeft-(h.scrollWidth-h.clientWidth))<.5;});
    await page.evaluate(()=>{fixture.blocked=false;});const before=await page.locator('#pg-maya-chip').boundingBox();
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.waitForTimeout(300);
    const label=surface+' '+(saved?'saved':'default')+' '+width;
    assert.equal(await page.evaluate(()=>document.body.classList.contains('drawer-open')),true,label+' recovery press preserves the open drawer');
    assert.deepEqual(await page.locator('#pg-maya-chip').boundingBox(),before,label+' recovery control stays under a held pointer');
    await page.mouse.up();await page.waitForFunction(()=>_pgVoice?.playbackBlocked===false);
    assert.equal(await page.evaluate(()=>!!_pgVoice?.active),true,label+' held recovery click preserves the active call');
    await page.evaluate(()=>{fixture.blocked=true;return _pgVoiceLine.resumePlayback();});
    await page.evaluate(()=>toggleNotesDrawer(false));await page.waitForFunction(()=>!document.body.classList.contains('drawer-open')&&document.getElementById('hscroll').scrollLeft<.5);
   }
  }
  await page.evaluate(()=>{fixture.blocked=false;});await page.locator('#pg-maya-chip').click();await page.waitForFunction(()=>_pgVoice?.playbackBlocked===false);assert.equal(await page.evaluate(()=>!!_pgVoice?.active),true,'playback tap recovers instead of hanging up');
  await page.evaluate(()=>{for(const type of ['response.audio_transcript.done','response.output_audio_transcript.done'])fixture.pcs[0].dc.onmessage({data:JSON.stringify({type,transcript:type})});});
  assert.equal(await page.locator('#pg-maya-lines .ln').count(),2,'legacy and GA transcript aliases are visible');
  await page.evaluate(()=>{fixture.toolCalls=0;fixture.originalTool=window._pgTool;window._pgTool=async()=>{fixture.toolCalls++;return {ok:true};};_pgToolChain=new Promise(resolve=>fixture.releaseTool=resolve);fixture.pcs[0].dc.onmessage({data:JSON.stringify({type:'response.function_call_arguments.done',call_id:'late',name:'open_drawer',arguments:'{}'})});_doClear();_pgVoiceLine.checkScope();fixture.releaseTool();});
  await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>fixture.toolCalls),0,'queued tool cannot run on another project');await page.evaluate(()=>window._pgTool=fixture.originalTool);assert.equal(await page.evaluate(()=>_pgVoiceLine.current),null);assert.equal(await page.evaluate(()=>fixture.tracks.every(t=>t.stopped)),true,'project switch stops microphone');
  await page.evaluate(()=>{_pgWarmLastAttempt=0;_pgWakePaused=false;_pgWarmVoice();});await page.waitForFunction(()=>_pgVoiceLine?.current?.pc.connectionState==='connected');
  await page.evaluate(token=>{fixture.token=token;fixture.scope='owner-B';_pgVoiceLine.checkScope();},jwt('owner-B'));assert.equal(await page.evaluate(()=>_pgVoiceLine.current),null,'account change discards prepared connection');
  await page.evaluate(()=>{_pgWarmLastAttempt=0;_pgWakePaused=false;_pgWarmVoice();});await page.waitForFunction(()=>_pgVoiceLine?.current?.pc.connectionState==='connected');
  await page.evaluate(()=>pgToggleWake());assert.equal(await page.evaluate(()=>_pgVoiceLine.current),null,'wake off closes standby');
  const count=requests.length;await page.waitForTimeout(900);assert.equal(requests.length,count,'off does not renew');
  await page.evaluate(()=>pgMayaStart());await page.waitForFunction(()=>!!_pgVoice?.active);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>_pgVoiceLine.current),null,'hidden page closes active voice');assert.equal(await page.evaluate(()=>fixture.tracks.every(t=>t.stopped)),true);
  await page.close();console.log(surface+': actual wake wiring, warm Hi Maya, fresh context, renewal, playback recovery and project/account/off teardown passed.');
 }
}finally{await browser.close();}
