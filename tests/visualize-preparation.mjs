import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
function fn(name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
for(const [final,interim,fail] of [['','',false],['','silk',false],['','blue silk evening coat',false],['red wool','',false],['','blue silk coat',true]]){
  let now=0,calls=0,valid=true;
  const ctx=vm.createContext({console:{warn(){},error(){}},Date:{now:()=>now},setTimeout:(resolve,ms)=>{now+=ms;queueMicrotask(resolve);},
    _opContext:()=>({}),_opStillValid:()=>valid,getApiKey:()=> 'fixture',pushRenderStatus(){},popRenderStatus(){},
    callLiveExtract:async()=>{calls++;if(fail)throw Error('fake unavailable');return [];},placeItemUnique(){},titlesAreSimilar:()=>false});
  vm.runInContext('let isListening=false,batchInFlight=false,lastProcessedLength=0,items=[];let liveTranscriptBuffer='+JSON.stringify(final)+',liveInterimBuffer='+JSON.stringify(interim)+';'+fn('_waitForVoicePipelineQuiet')+fn('processLiveBatch'),ctx);
  await vm.runInContext('_waitForVoicePipelineQuiet()',ctx);
  assert.equal(calls,final||interim?1:0,'A transcript tail gets one extraction, even on failure');
  assert.ok(now<500,'No artificial 30-second pause: '+JSON.stringify({final,interim}));
  assert.equal(vm.runInContext('isListening',ctx),false);
  await vm.runInContext('_waitForVoicePipelineQuiet()',ctx);assert.equal(calls,final||interim?1:0,'Consumed interim text cannot restart paid extraction');
}
let anchors;
const edit=vm.createContext({callOpenAIImageEdit:async value=>{anchors=value;return 'image';},isSafetyRejection:()=>false,
  _resizeImageDataUrlToSize:()=>{throw Error('Unnecessary resize');}});
vm.runInContext(fn('callOpenAIImageEditSafe'),edit);
await vm.runInContext("callOpenAIImageEditSafe(['portrait-face','landscape-reference'],'same garment','1536x1024')",edit);
assert.deepEqual(Array.from(anchors),['portrait-face','landscape-reference'],'Full original references retain their order without PNG upscale/cropping');
console.log('Visualization preparation: empty/short/interim speech settles once without 30-second stalls; edits preserve original references without duplicate resizing.');
