import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(source,extra=''){
 const timers=new Map(),nodes=new Map(),events=new Map();let next=0;
 const document={body:{classList:{toggle(){}}},getElementById:id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){},remove(){},add(){}},setAttribute(k,v){this[k]=v;},textContent:'',innerHTML:''});return nodes.get(id);}};
 class Recognition{static throws=false;start(){if(Recognition.throws)throw Error('start unavailable');this.onstart?.();}abort(){}}
 const context=createContext({document,console:{warn(){}},setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem(){return null;},setItem(){}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},Event:class{constructor(type){this.type=type;}},fetch:async()=>({ok:false,status:502,json:async()=>({error:'voice_unavailable'})}),mayaCommandState(){},_mayaChatClear(){},_mayaActions:[],_idTok:'fixture-admin',_pgVoice:null,_pgVoiceStarting:false,showToast(){},pgMayaStart(){},pgMayaStop(){}});
 context.window=context;context.SpeechRecognition=Recognition;context.addEventListener=(name,fn)=>events.set(name,fn);context.dispatchEvent=e=>events.get(e.type)?.();
 const run=s=>new Script(s).runInContext(context);run(extra+source);
 return {run,timers,Recognition,nodes};
}
const html=read('backend/status.html');
const voice=html.slice(html.indexOf('let _voice = null;'),html.indexOf('</script>',html.indexOf('let _voice = null;')));
const f=fixture(voice);
f.run('_wakeWantOn=true;window.mayaNoteDictating=true;_wakeStart()');assert.equal(f.run('_wakeRec'),null,'Note dictation owns recognition');f.run('window.mayaNoteDictating=false');
f.run('_wakeWantOn=true;_wakeStart()');assert.equal(f.run('_wakeOn'),true);assert.equal(f.nodes.get('wake-toggle').textContent,'Hey Maya: listening');
f.run('_wakeRec.onerror({error:"network"})');assert.equal(f.run('_wakeOn'),false);assert.equal(f.timers.size,1);assert.equal(f.run('_wakeWantOn'),true);
const retry=[...f.timers.values()][0];f.timers.clear();retry();assert.equal(f.run('_wakeOn'),true);
f.run('const _testStart=toggleMayaVoice;let _testWakePromise;toggleMayaVoice=()=>{_testWakePromise=_testStart();return _testWakePromise;};_wakeRec.onresult({resultIndex:0,results:[[{transcript:"Hey Maya"}]]})');
await f.run('_testWakePromise');assert.equal(f.run('_voice'),null);assert.equal(f.run('_voiceStarting'),false);assert.equal(f.timers.size,1,'Failed token must restart wake');
f.run('_wakeStop()');f.Recognition.throws=true;f.run('_wakeStart()');assert.equal(f.run('_wakeRec'),null);assert.equal(f.timers.size,1,'Synchronous start error retries');
f.Recognition.throws=false;f.run('_wakeStop();_wakeStart();_wakeRec.onerror({error:"not-allowed"})');assert.equal(f.run('_wakeWantOn'),false);assert.equal(f.timers.size,0,'Permission refusal never loops');
for(const path of ['frontend/index.html','playground/index.html']){
 const h=read(path),wake=h.slice(h.indexOf('let _pgWakeRec = null'),h.indexOf('window.pgMayaStart =',h.indexOf('let _pgWakeRec = null')));
 const p=fixture(wake);p.run('_pgWakeWant=true;_pgWakeStart()');assert.equal(p.run('_pgWakeOn'),true,path);
 p.run('_pgWakeRec.onerror({error:"network"})');assert.equal(p.run('_pgWakeRec'),null);assert.equal(p.timers.size,1,path);
 p.Recognition.throws=true;p.run('_pgWakeStart()');assert.equal(p.timers.size,1,path+' start failure has one retry');
 p.Recognition.throws=false;p.run('_pgWakeStart();_pgWakeRec.onerror({error:"not-allowed"})');assert.equal(p.run('_pgWakeWant'),false);assert.equal(p.timers.size,0,path);
}
console.log('Wake recovery passed: actual listening status, failed voice connection, network/start recovery and permission refusal on Admin/app/Playground. No live provider or microphone used.');
