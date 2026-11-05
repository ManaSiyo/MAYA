// Exercise actual image request builders with fake transport; no paid calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {IMAGE_MODEL} from '../docs/server/model-config.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fn(source,name){
  const start=source.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,name);
  const firstLine=source.slice(start,source.indexOf('\n',start));
  if(firstLine.endsWith('}'))return firstLine;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const frontend=read('frontend/index.html'),brief=read('backend/backend.html'),operations=read('backend/operations.html');
assert.equal(IMAGE_MODEL,'gpt-image-2.6-flare');
const calls=[],stored=new Map([['maya_image_model','gpt-image-2.5-flare']]);
const image=new Blob(['reference-image'],{type:'image/png'});
const context=vm.createContext({
  FormData,Blob,console,setTimeout,
  localStorage:{getItem:key=>stored.get(key),removeItem:key=>stored.delete(key)},
  getApiKey:()=> 'fixture-token',getPatternQuality:()=> 'high',getQuality:()=> 'high',
  blobFromPicture:async src=>new Blob([src],{type:'image/jpeg'}),compressBlobForUpload:async blob=>blob,
  operationContext:()=>({token:'fixture-token'}),requireOperation:()=>{},
  fetch:async(url,options)=>{
    if(url==='fixture-hero')return {blob:async()=>image};
    calls.push({url,options});
    return {ok:true,json:async()=>({data:[{b64_json:'fixture-output'}]})};
  },
});
vm.runInContext("const STORAGE_KEY_IMG_MODEL='maya_image_model';\n"+
  ['getImageModel','getImageQuality','callOpenAIImage','callOpenAIImageEdit'].map(name=>fn(frontend,name)).join('\n')+'\n'+
  ['renderPiece','generatePattern'].map(name=>fn(brief,name)).join('\n')+'\n'+fn(operations,'gptImageEdit'),context);

assert.equal(vm.runInContext('getImageModel()',context),IMAGE_MODEL);
assert.equal(stored.has('maya_image_model'),false,'An old saved preference cannot pin new requests to 2.5');
stored.set('maya_image_model',IMAGE_MODEL);
assert.equal(vm.runInContext('getImageModel()',context),IMAGE_MODEL);
assert.equal(stored.get('maya_image_model'),IMAGE_MODEL);
assert.equal(await vm.runInContext("callOpenAIImage('same garment')",context),'data:image/png;base64,fixture-output');
assert.deepEqual(JSON.parse(calls[0].options.body),{model:IMAGE_MODEL,prompt:'same garment',size:'1024x1536',quality:'medium',n:1});
await vm.runInContext("callOpenAIImage('same garment','1024x1024','low',{background:'transparent',output_format:'webp'})",context);
assert.deepEqual(JSON.parse(calls[1].options.body),{model:IMAGE_MODEL,prompt:'same garment',size:'1024x1024',quality:'low',n:1,background:'transparent',output_format:'webp'});
await vm.runInContext("callOpenAIImageEdit(['first reference','second reference'],'keep these details',undefined,'medium',{background:'opaque',output_format:'png'})",context);
const multi=calls.at(-1).options.body;
assert.deepEqual(await Promise.all(multi.getAll('image[]').map(blob=>blob.text())),['first reference','second reference']);
assert.equal(multi.get('prompt'),'keep these details');
assert.equal(multi.get('background'),'opaque');assert.equal(multi.get('output_format'),'png');
await vm.runInContext("callOpenAIImageEdit('single reference','keep it')",context);
assert.equal(await calls.at(-1).options.body.get('image').text(),'single reference');
await vm.runInContext("renderPiece('fixture-hero',{name:'Coat'})",context);
await vm.runInContext("generatePattern('fixture-hero',{name:'Coat',panels:8})",context);
await vm.runInContext("gptImageEdit('fixture-hero','pattern drawing')",context);
assert.equal(calls.length,7,'One request per explicit generation/edit');
for(const [i,call] of calls.entries()){
  assert.equal(call.options.headers.Authorization,'Bearer fixture-token');
  assert.equal(call.options.method,'POST');
  if(i<2){assert.equal(call.url,'/api/openai/v1/images/generations');continue;}
  assert.equal(call.url,'/api/openai/v1/images/edits');
  const form=call.options.body;
  assert.equal(form.get('model'),IMAGE_MODEL);
  assert.equal(form.get('size'),'1536x1024');assert.equal(form.get('n'),'1');
  assert.equal(form.get('quality'),i>=5?'high':'medium','Existing Admin quality choices stay intact');
  if(i>=4)assert.equal(await form.get('image').text(),'reference-image');
}
console.log('GPT Image 2.6 Flare requests preserve auth, sizes, quality, options, reference images and response handling across frontend, Brief and Operations.');
