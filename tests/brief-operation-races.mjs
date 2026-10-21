import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fn(source,name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const brief=read('backend/backend.html'),calls=[];let owner='owner',release;
const target={hero:'data:image/png;base64,fixture',card:{image:'fixture'}};
let generations=0,renders=0;
const b=vm.createContext({console,atob,crypto,TextEncoder,AbortSignal,window:{_openedSubmission:{id:'submission-a'},_dissectTarget:target},
 _subCachedTok:()=>owner,_shrinkDataUrl:async value=>value,renderDissection(){},showBackendToast(){},
 document:{getElementById:()=>null},setDissectStatus(){},getApiKey:()=>owner,_postPiecesToOps(){},
 dissectImage:async()=>{generations++;return {pieces:[{name:'Coat'}]};},renderAllPieces:async()=>{renders++;},
 fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return new Promise(resolve=>{release=resolve;});}
});
vm.runInContext('let _savedOperation=null,_operationsRevision=0,_pieceState={pieces:[],idx:0};function showBriefItem(){}\n'+brief.slice(brief.indexOf('let _briefLocalSequence'),brief.indexOf('// Acknowledged saved snapshots'))+'\n'+['_publishSavedOperations','_postPiecesToOps','beginDissection'].map(name=>fn(brief,name)).join('\n'),b);
vm.runInContext('_piecesReview={..._piecesContext(),generation:"0"}',b);
const dissection={pieces:[{name:'First'}]};b.d=dissection;
const first=vm.runInContext('_savePiecesToDrive(d)',b);dissection.pieces[0].name='Second';
const second=vm.runInContext('_savePiecesToDrive(d)',b);await tick();
assert.equal(calls.length,1);assert.equal(calls[0].data.pieces[0].name,'First');
release({ok:true,json:async()=>({ok:true,generation:'1'})});await first;await tick();
assert.equal(calls.length,2);assert.equal(calls[1].data.pieces[0].name,'Second');
assert.equal(calls[0].data.pieces[0].id,calls[1].data.pieces[0].id,'Repeated saves preserve the durable garment ID');
assert.deepEqual(calls.slice(0,2).map(call=>call.generation),['0','1'],'Only an acknowledged save advances the same dissection queue');
release({ok:false,status:503,json:async()=>({})});await assert.rejects(second,/503/);
const generated=vm.runInContext('beginDissection()',b);await tick();
release({ok:false,status:503,json:async()=>({})});await generated;assert.equal(generations,1);assert.equal(renders,1);
assert.equal(vm.runInContext('!!_unsavedDissection',b),true,'Failed save retains generated work');
assert.equal(vm.runInContext('_savedOperation',b),null,'Failed saves cannot publish generated garments to Operations');
const retry=vm.runInContext('retryDissectionSave()',b);await tick();
release({ok:true,json:async()=>({ok:true,generation:'2'})});await retry;
assert.equal(generations,1,'Save-only retry never repeats paid dissection');assert.equal(renders,1);
assert.equal(vm.runInContext('_unsavedDissection',b),null);
assert.equal(vm.runInContext('_savedOperation.pieces[0].name',b),'Coat','Acknowledged save publishes the saved garment');
assert.notEqual(vm.runInContext('_savedOperation.pieces[0].id',b),calls[0].data.pieces[0].id,'Fresh dissection never reuses the previous index ID');
const pending=vm.runInContext('_savePiecesToDrive(d)',b);owner='another-account';
await assert.rejects(pending,/account changed/);assert.equal(calls.length,4,'Account switch cannot redirect a queued save');
assert.equal(/renderAllPieces\(/.test(brief.slice(brief.indexOf('// ── v0.37: NOTHING FIRES'),brief.indexOf('let _piecesSaveChain'))),false,'Opening saved work never starts missing-image generation');
owner='owner';
const oversized={pieces:[{name:'Large coat',_pattern:'é'.repeat(14*1024*1024)}]};b.oversized=oversized;
await assert.rejects(vm.runInContext('_savePiecesToDrive(oversized)',b),/save limit/);
assert.equal(oversized.pieces[0]._pattern.length,14*1024*1024,'Oversized saves retain the complete pattern draft');
assert.equal(calls.length,4,'Oversized data is rejected before a network write');

function briefFixture(){
 const elements=new Map(),posts=[],notices=[],events=[],gets=[];
 for(const id of ['op-date','op-biography','op-vision','op-hero-name','op-chips-section','op-chips','op-measurements','op-measurements-section','op-image-frame','piece-swiper','piece-pills','upload-gate','upload-error','reload-btn'])
  elements.set(id,{style:{},dataset:{},innerHTML:'',textContent:'',classList:{add(){},remove(){}}});
 const state={owner:'owner-a',hero:'cloud-hero',loadedPieces:null,saveOK:true,generations:0,renders:0,patterns:0};
 const c=vm.createContext({console,atob,crypto,TextEncoder,AbortSignal,window:{_openedSubmission:{id:'submission-a',name:'A'}},
  document:{getElementById:id=>elements.get(id)||null,body:{classList:{add(){}}}},
  _subCachedTok:()=>state.owner,getApiKey:()=>state.owner,_shrinkDataUrl:async value=>value,
  BACKEND_MEAS_SCHEMA:[],escapeHtml:String,_updateBrandSub(){},_wirePieceSwipe(){},_postPiecesToOps(){},
  _syncPatternPills(){},_syncNestUiVisibility(){},_sync3DPills(){},
  setDissectStatus:on=>events.push(on?'busy':'idle'),showBackendToast:message=>{notices.push(message);events.push('notice');},
  readJson:async(dir,name)=>name==='summary.json'?dir.summary||null:dir.items||null,
  readBlobAsDataUrl:async dir=>dir.hero||null,findFirstImage:async()=>null,
  FileReader:class {readAsDataURL(blob){this.result=blob.data;this.onload();}},
  dissectImage:async()=>{state.generations++;return state.dissectionWait?await state.dissectionWait:{pieces:[{name:'New coat'}]};},
  renderAllPieces:async(hero,pieces)=>{state.renders++;if(state.renderWait)await state.renderWait;for(const piece of pieces)piece._image='piece:'+hero;},
  generatePattern:async()=>{state.patterns++;return state.patternWait?await state.patternWait:'pattern-image';},
  fetch:async(url,options)=>{
   if(options?.method==='POST'){
    const payload=JSON.parse(options.body);posts.push(payload);if(state.postWait)await state.postWait;
    const generation=state.savedRevision??(state.loadedPieces?'1':'0');
    if(payload.generation!==generation)return {ok:false,status:409,json:async()=>({detail:'Saved work changed in another window.'})};
    if(!state.saveOK)return {ok:false,status:503,json:async()=>({ok:false})};
    state.savedRevision=String(Number(generation)+1);state.loadedPieces=payload.data;
    return {ok:true,status:200,json:async()=>({ok:true,...(state.missingAcknowledgement?{}:{generation:state.savedRevision})})};
   }
   gets.push({url,options});
   if(url.startsWith('/api/admin/submissions'))return {ok:true,json:async()=>({folders:[{id:'submission-a',files:[{id:'sum',name:'summary.json'},{id:'hero',name:'dream-garment.png'},...(state.loadedPieces?[{id:'pieces',name:'pieces.json'}]:[])]}]})};
   if(url.includes('id=sum'))return {json:async()=>({client:{name:'Cloud A'}})};
   if(url.includes('id=hero'))return {blob:async()=>({data:state.hero})};
   if(url.includes('id=pieces'))return {ok:!state.piecesStatus,status:state.piecesStatus||200,headers:{get:()=>state.missingGeneration?'':state.savedRevision||'1'},json:async()=>state.invalidPieces?{}:state.loadedPieces};
   throw Error('Unexpected fixture request '+url);
  }
 });
 const helpers=brief.slice(brief.indexOf('let _briefLocalSequence'),brief.indexOf('// Acknowledged saved snapshots'));
 vm.runInContext('let _submissionLoadSequence=0,_savedOperation=null,_operationsRevision=0,_pieceState={pieces:[],idx:0},_3dMode="cube",_briefView="item";const _pieceSources=new WeakMap();function showBriefItem(){}\n'+helpers+'\n'+
  ['_publishSavedOperations','_postPiecesToOps','_loadSubmission','loadClient','loadFromFolder','render','renderDissection','inferPieces','beginDissection','dissectActivePieceForPattern','_syncOpRoom'].map(name=>fn(brief,name)).join('\n'),c);
 return {c,state,posts,notices,events,gets,elements,eval:code=>vm.runInContext(code,c)};
}

// A local folder has no cloud save target and must never borrow the cloud cache.
{
 const f=briefFixture();f.state.loadedPieces={pieces:[{name:'Cloud private coat',_image:'cloud-piece'}]};
 await f.c._loadSubmission(f.state.owner);assert.equal(f.c.window._dissectTarget.card._dissection,f.state.loadedPieces);
 await f.c.loadFromFolder({name:'Local B',summary:{client:{name:'B'}},hero:'local-b'});
 assert.equal(f.c.window._openedSubmission,null);assert.equal(f.c.window._cachedPieces,null);
 assert.equal(f.c.window._dissectTarget.card._dissection,undefined);assert.equal(f.eval('_pieceState.pieces.length'),1);
 await f.c.beginDissection();
 assert.equal(f.posts.length,0,'Local generation never claims a cloud save');
 assert.equal(f.c.window._dissectTarget.card._dissection.pieces[0]._image,'piece:local-b');
 assert.match(f.notices.at(-1),/Generated in this page only/);assert.equal(f.events.at(-1),'notice','The final cleanup must not immediately hide save/local status');
 assert.equal(f.eval('_unsavedDissection'),null);
 await f.c.loadFromFolder({name:'No image',summary:{client:{name:'Summary only'}}});
 assert.equal(f.c.window._dissectTarget,null,'A summary-only folder cannot reuse the previous garment');
 assert.equal(f.elements.get('op-image-frame').innerHTML,'');assert.equal(f.elements.get('piece-swiper').style.display,'none');
}

// The last selected folder wins even when an earlier directory lookup is slower.
{
 const f=briefFixture();let firstDirectory;
 const folders={A:{name:'A',summary:{},hero:'hero-a'},B:{name:'B',summary:{},hero:'hero-b'}};
 const clients={getDirectoryHandle:async name=>name==='A'?await new Promise(resolve=>firstDirectory=resolve):folders[name]};
 f.c.getMayaFolder=async()=>({getDirectoryHandle:async()=>({getDirectoryHandle:async()=>clients})});
 f.c.toggleClientsDrawer=()=>{};f.c.localStorage={setItem(){}};
 const first=f.c.loadClient('A');await tick();await f.c.loadClient('B');firstDirectory(folders.A);await first;
 assert.equal(f.c.window._dissectTarget.hero,'hero-b');assert.equal(f.c.currentClientName,'B');
 // Account changes during file reads cannot install a stale private view.
 let summaryDone;f.c.readJson=async(dir,name)=>name==='summary.json'?await new Promise(resolve=>summaryDone=resolve):null;
 const delayed=f.c.loadFromFolder({name:'Late',hero:'late-hero'});await tick();f.state.owner='owner-b';summaryDone({});await delayed;
 assert.equal(f.c.window._dissectTarget.hero,'hero-b');
}

// Renewal may replace the view card while generation or saving is in flight.
{
 const f=briefFixture();await f.c._loadSubmission(f.state.owner);
 let dissectDone,renderDone;f.state.dissectionWait=new Promise(resolve=>dissectDone=resolve);f.state.renderWait=new Promise(resolve=>renderDone=resolve);
 const generated=f.c.beginDissection();await tick();await f.c._loadSubmission(f.state.owner);
 const generatedPieces={pieces:[{name:'Retained coat'}]};dissectDone(generatedPieces);await tick();
 await f.c._loadSubmission(f.state.owner);assert.equal(f.c.window._dissectTarget.card._dissection,generatedPieces);
 f.state.saveOK=false;renderDone();await generated;
 assert.equal(f.c.window._dissectTarget.card._dissection,generatedPieces);assert.equal(f.eval('_unsavedDissection.dissection'),generatedPieces);
 await f.c._loadSubmission(f.state.owner);assert.equal(f.c.window._dissectTarget.card._dissection,generatedPieces,'Same-submission renewal preserves unsaved generated output');
 await f.c.loadFromFolder({name:'Invalid folder'});
 assert.equal(f.c.window._openedSubmission.id,'submission-a','An invalid folder leaves the acknowledged submission target intact');
 assert.equal(f.eval('_unsavedDissection.dissection'),generatedPieces);
 f.state.saveOK=true;await f.c.retryDissectionSave();assert.equal(f.state.generations,1);assert.equal(f.state.renders,1);
 assert.equal(f.eval('_unsavedDissection'),null);assert.equal(f.posts.at(-1).data.pieces[0]._image,'piece:cloud-hero');
}

// Pattern results belong to their original raw piece, including after renewal.
{
 const f=briefFixture();f.state.loadedPieces={pieces:[{name:'Coat',_image:'coat'}]};await f.c._loadSubmission(f.state.owner);
 let patternDone;f.state.patternWait=new Promise(resolve=>patternDone=resolve);f.eval('_pieceState.idx=1');
 const pattern=f.c.dissectActivePieceForPattern();await tick();await f.c._loadSubmission(f.state.owner);
 patternDone('saved-pattern');await pattern;
 assert.equal(f.state.loadedPieces.pieces[0]._pattern,'saved-pattern');assert.equal(f.posts[0].data.pieces[0]._pattern,'saved-pattern');
 assert.equal(f.eval('_pieceState.pieces[1]._pattern'),'saved-pattern','Rerender keeps the generated pattern');
 f.eval('_pieceState.idx=1');f.c._syncOpRoom();await tick();assert.equal(f.state.patterns,1,'Reopening the piece does not pay to regenerate its saved pattern');
}
for(const change of ['folder','account']){
 const f=briefFixture();f.state.loadedPieces={pieces:[{name:'Old coat',_image:'coat'}]};await f.c._loadSubmission(f.state.owner);
 let patternDone;f.state.patternWait=new Promise(resolve=>patternDone=resolve);f.eval('_pieceState.idx=1');
 const pattern=f.c.dissectActivePieceForPattern();await tick();
 if(change==='folder')await f.c.loadFromFolder({name:'Other',summary:{},hero:'other-hero'});else f.state.owner='owner-b';
 patternDone('stale-pattern');await pattern;
 assert.equal(f.posts.length,0,'A stale pattern completion cannot save another '+change);
 assert.equal(f.state.loadedPieces.pieces[0]._pattern,undefined);assert.ok(!f.elements.get('piece-pills').innerHTML.includes('stale-pattern'));
}

// Reopening can reveal a newer server version, but it must never rebase an old draft.
{
 const f=briefFixture();f.state.loadedPieces={pieces:[{id:'coat',name:'Coat',_image:'coat'}]};await f.c._loadSubmission(f.state.owner);
 const draft=f.c.window._dissectTarget.card._dissection;draft.pieces[0]._pattern='reviewed draft';f.state.saveOK=false;
 await assert.rejects(f.c._persistDissection(draft),/503/);
 f.state.loadedPieces={pieces:[{id:'coat',name:'Coat',_image:'coat',_pattern:'other tab saved pattern'}]};f.state.savedRevision='2';f.state.saveOK=true;
 await f.c._loadSubmission(f.state.owner);
 assert.equal(f.c.window._dissectTarget.card._dissection,draft,'New server read does not discard the retained draft');
 assert.equal(f.eval('_piecesReview.generation'),'2');await f.c.retryDissectionSave();
 assert.equal(f.posts.at(-1).generation,'1','Retained draft keeps its reviewed generation despite reopening');
 assert.equal(f.state.loadedPieces.pieces[0]._pattern,'other tab saved pattern');assert.equal(f.eval('_unsavedDissection.dissection'),draft);
 assert.match(f.notices.at(-1),/changed in another window/);
 const before=f.posts.length;await f.c.retryDissectionSave();assert.equal(f.posts.length,before,'A known conflict does not resend without a new review');
 assert.ok(f.gets.filter(request=>request.url.startsWith('/api/admin/subfile')).every(request=>request.options.cache==='no-store'));
 assert.ok(f.gets.every(request=>!request.url.includes('&v=')),'Byte length is never treated as a saved-version identity');
}

for(const failure of ['missingGeneration','invalidPieces','piecesStatus']){
 const f=briefFixture();f.state.loadedPieces={pieces:[{id:'coat',name:'Coat'}]};f.state[failure]=failure==='piecesStatus'?503:true;
 await f.c._loadSubmission(f.state.owner);
 assert.equal(f.eval('_piecesReview'),null,'Failed or unversioned dissection reads never authorize a replacement');
 assert.equal(f.c.window._dissectTarget,undefined);assert.ok(f.notices.length);
}

// Publishing an acknowledgement uses exactly its payload, not later in-memory edits.
{
 const f=briefFixture();f.state.loadedPieces={pieces:[{id:'coat',name:'Coat',_image:'coat'}]};await f.c._loadSubmission(f.state.owner);
 const draft=f.c.window._dissectTarget.card._dissection;let done;f.state.postWait=new Promise(resolve=>done=resolve);
 const saving=f.c._persistDissection(draft);await tick();draft.pieces[0]._pattern='newer pending pattern';done();await saving;
 assert.equal(f.eval('_savedOperation.pieces[0]._pattern'),undefined);assert.equal(f.c.window._dissectTarget.card._dissection.pieces[0]._pattern,'newer pending pattern');
}
{
 const f=briefFixture();f.state.loadedPieces={pieces:[{id:'coat',name:'Coat',_image:'coat'}]};await f.c._loadSubmission(f.state.owner);
 await f.c._persistDissection(f.c.window._dissectTarget.card._dissection);assert.equal(f.eval('_retainedDissection'),null,'Acknowledged work no longer masks a later reviewed server version');
 f.state.loadedPieces={pieces:[{id:'coat',name:'Coat',_image:'coat',_pattern:'new remote pattern'}]};f.state.savedRevision='3';
 await f.c._loadSubmission(f.state.owner);assert.equal(f.c.window._dissectTarget.card._dissection.pieces[0]._pattern,'new remote pattern');
 assert.equal(f.eval('_piecesReview.generation'),'3');
}
{
 const f=briefFixture();await f.c._loadSubmission(f.state.owner);f.state.missingAcknowledgement=true;
 const draft={pieces:[{name:'Coat',_pattern:'kept draft'}]};await assert.rejects(f.c._persistDissection(draft),/did not confirm/);
 assert.equal(f.eval('_unsavedDissection.dissection'),draft);assert.equal(f.eval('_piecesReview.generation'),'0','Unknown acknowledgement never advances the queue');
 assert.equal(f.eval('_savedOperation.pieces.length'),0,'Unconfirmed saves never publish generated work');
}

for(const path of ['backend/operations.html']){
 const source=read(path),stored=new Map(),elements=new Map();let token='owner-a',classifyDone;
 for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=|application\/ld\+json/.test(match[1]))new vm.Script(match[2],{filename:path});
 const element=id=>{
   if(!elements.has(id)){const el={value:'',disabled:false,style:{},dataset:{},src:'',textContent:'',innerHTML:'',classList:{remove(){},add(){},toggle(){}},removeAttribute(name){if(name==='src')this.src='';}};elements.set(id,el);}
   return elements.get(id);
 };
 const c=vm.createContext({console,atob,URLSearchParams,crypto,TextEncoder,TextDecoder,Uint8Array,queueMicrotask,structuredClone,
  getKey:()=>token,getQuality:()=> 'medium',num:value=>Number(value)>0?Number(value):null,
  sessionStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
  location:{search:'?submission=a'},window:{addEventListener(){}},document:{querySelectorAll:()=>[element('test-picker'),element('m-waist')]},
  $:element,renderDimDerived(){},applyView(){},toast(){},syncQuality(){},requireOperationSettings(){},RUNNING:false,RUN:0,HERO:'garment-a',
  ANSWER:null,RD:null,RD_PROMISE:null,RD_IS_RAW:false,TRACE:null,_tv:null,PASSES:[],LAST:{},ACTIVE_TEST:'A',FILES:{front:'garment-a'},TESTS:{A:{front:'garment-a'},B:{front:'garment-b'}},
  EMB:{},EMBEDDED:false,_operationInputContext:null,_operationRevision:-1,_operationLoadSequence:0,closeOperationFabrics(){},BEST_IDX:0,viewGrounded(){},view(){},liveOpen(){},liveStatus(){},liveLine(){},shortLabel:value=>value,markLabel:()=> 'Mark',CUR:{kind:'grounded'},renderPassPills(){},
  classifyGarment:async()=>new Promise(resolve=>{classifyDone=resolve;})
 });
 const helpers=source.slice(source.indexOf("let _measurementGarment="),source.indexOf('// PANT MEASUREMENT MODEL'));
 const names=['pickTest','showView','setHero','runGrounded','startTest','runRD','rdCacheKey','gptImageEdit','scoreGrounded','buildSVGfromGrounded','streamChat'];
 vm.runInContext(helpers+'\n'+names.map(name=>fn(source,name)).join('\n'),c);
 if(path==='backend/operations.html'){
  c._operationInputContext={submissionId:'reviewed',measurements:{waist_narrowest:'91.44 cm',hip:40,crotch_f_to_b:'685.8 mm',inseam:'30 inches',pant_length:42,bust_chest:38}};
  assert.deepEqual(JSON.parse(JSON.stringify(c.storedMeasures())),{waist:36,hip:40,crotch:27,inseam:30,length:42},'Canonical Brief facts normalize explicit units');
  element('m-waist').value='99';c.saveMeasures();assert.equal(c.getMeasures().waist,36,'Hidden/manual fields cannot overwrite recorded Brief values');
  c._operationInputContext={submissionId:'unmeasured',measurements:{}};assert.equal(c.getMeasures().waist,null,'No default or other submission dimensions');
  c._operationInputContext.measurements=[];assert.equal(c.measurementState().unavailable,true,'Malformed recorded measurements fail closed');
  c._operationInputContext=null;
 }
 const pick=async name=>{c.pickTest(name);await vm.runInContext('_garmentReady',c);};
 await pick('A');element('m-waist').value='30';c.saveMeasures();
 assert.equal(c.getMeasures().waist,30);
 await pick('B');assert.equal(c.getMeasures().waist,null,'Garments in the same submission never inherit dimensions');
 element('m-waist').value='44';c.saveMeasures();await pick('A');assert.equal(c.getMeasures().waist,30);
 c.TESTS.A.front='changed-image-with-same-name';await pick('A');assert.equal(c.getMeasures().waist,null,'A reused garment label is not its identity');
 c.TESTS.A.front='garment-a';await pick('A');assert.equal(c.getMeasures().waist,30);
 c.location.search='?submission=b';c.syncMeasures();assert.equal(element('m-waist').value,'');
 assert.equal(c.getMeasures().waist,null,'Measurements cannot cross submissions');
 c.location.search='?submission=a';token='owner-b';assert.equal(c.getMeasures().waist,null,'Measurements cannot cross accounts');
 token='owner-a';c.setOperationRunning(true);
 element('m-waist').value='99';c.saveMeasures();c.pickTest('B');c.showView('front');
 assert.equal(c.getMeasures().waist,30);assert.equal(c.HERO,'garment-a');assert.equal(c.ACTIVE_TEST,'A');
 assert.equal(element('test-picker').disabled,true,'Input controls freeze while a run is pending');
 const run=c.runGrounded();await tick();token='owner-b';classifyDone({type:'coat'});await run;
 assert.ok(c.LAST.garment==null,'Stale account classification cannot repaint or continue generation');
 c.setOperationRunning(false);assert.equal(element('test-picker').disabled,false);

 // Startup is already locked during asynchronous embedding preparation.
 token='owner-a';await pick('A');c.EMB=null;let embeddingDone,builds=0,grounded=0;
 c.buildEmbeddings=async()=>{builds++;await new Promise(resolve=>embeddingDone=resolve);c.EMB={};};
 c.runGrounded=async()=>{grounded++;};c.runRD=async()=>{};
 const starting=c.startTest();await tick();await c.startTest();assert.equal(builds,1);assert.equal(c.RUNNING,true);
 token='owner-b';c.invalidateOperation();embeddingDone();await starting;
 assert.equal(grounded,0,'An old Start cannot adopt a new account/input after embedding preparation');
 assert.equal(element('start-test').textContent,'Start');assert.equal(element('test-picker').disabled,false);
 token='owner-a';await pick('A');c.setHero('uploaded-garment');await vm.runInContext('_garmentReady',c);
 let startedImage;c.runGrounded=async()=>{startedImage=c.HERO;};c.EMB={};await c.startTest();
 assert.equal(startedImage,'uploaded-garment','Start after an upload never reverts to the previously selected test');

 // Invalidating clears every old garment/result surface, including Plan B.
 for(const id of ['hero-img','hero-img-b','img-grounded','img-rd'])element(id).src='private-old-image';
 for(const id of ['clo-result','live-log','t-panels','trace-view'])element(id).textContent='private old output';
 c.invalidateOperation();
 for(const id of ['hero-img','hero-img-b','img-grounded','img-rd'])assert.equal(element(id).src,'');
 for(const id of ['clo-result','live-log','t-panels','trace-view'])assert.equal(element(id).textContent,'');

 // Loading an image blob must not switch the model request to a later token.
 token='owner-a';await pick('A');let blobDone,imageRequests=0;
 c.FormData=class {append(){}};
 c.fetch=async url=>{if(url==='garment-a')return {blob:()=>new Promise(resolve=>blobDone=resolve)};imageRequests++;return {};};
 const edit=c.gptImageEdit('garment-a','Reviewed prompt');await tick();token='owner-b';blobDone('blob');
 await assert.rejects(edit,/operation changed/i);assert.equal(imageRequests,0);

 // Cache misses and cache writes cannot resume a stale redraw into the new view.
 token='owner-a';await pick('A');const originalKey=c.rdCacheKey,keyA=await originalKey('answer');
 token='owner-b';assert.notEqual(await originalKey('answer'),keyA);token='owner-a';
 let cacheDone,redraws=0;c.DB={};c.rdCacheKey=async()=> 'bound-cache';c.dbGet=()=>new Promise(resolve=>cacheDone=resolve);
 c.gptImageEdit=async()=>{redraws++;return 'redrawn';};vm.runInContext(fn(source,'runRD'),c);
 c.ANSWER='answer';const redraw=c.runRD();await tick();c.invalidateOperation();cacheDone(null);await redraw;
 assert.equal(redraws,0,'A stale cache miss cannot start a paid redraw');
 token='owner-a';await pick('A');c.ANSWER='answer';c.dbGet=async()=>null;c.dbPut=()=>new Promise(resolve=>cacheDone=resolve);
 const savingRedraw=c.runRD();await tick();c.invalidateOperation();cacheDone();await savingRedraw;assert.equal(element('img-rd').src,'');

 // Scoring must capture its run before waiting on the answer redraw.
 await pick('A');let answerDone,grades=0;c.RD_PROMISE=new Promise(resolve=>answerDone=resolve);c.gradeMedian=async()=>{grades++;return {};};
 const score=c.scoreGrounded({img:'old-pass'});c.invalidateOperation();c.ANSWER='new-answer';answerDone();await score;assert.equal(grades,0);

 // A delayed image decode cannot restore an old SVG after invalidation.
 let imageLoaded,traces=0;c.Image=class {addEventListener(type,callback){imageLoaded=callback;}set src(value){}};
 c.ImageTracer={imagedataToSVG(){traces++;return '<svg>old</svg>';}};
 c.document.createElement=()=>({getContext:()=>({drawImage(){},getImageData(){return {};}})});
 c.buildSVGfromGrounded('old-pass');c.invalidateOperation();imageLoaded();assert.equal(traces,0);assert.equal(c.TRACE,null);

 // Late stream chunks cannot repaint the critique log after invalidation.
 let readDone,cancelled=false;const deltas=[];
 c.fetch=async()=>({ok:true,body:{getReader:()=>({read:()=>new Promise(resolve=>readDone=resolve),cancel:async()=>{cancelled=true;}})}});
 const streamed=c.streamChat([],delta=>deltas.push(delta));await tick();c.invalidateOperation();
 readDone({done:false,value:new TextEncoder().encode('data: {"choices":[{"delta":{"content":"old"}}]}\n')});
 await assert.rejects(streamed,/Operation changed/);assert.equal(cancelled,true);assert.equal(deltas.length,0);

 if(source.includes('async function startCloMatch(')){
   vm.runInContext(fn(source,'startCloMatch'),c);let searches=0,searchDone;
   c.resolveType=value=>value;c.esc=String;c.fetch=async()=>{searches++;return new Promise(resolve=>searchDone=resolve);};
   token='owner-a';element('hero-img-b').src='garment-a';element('hero-img-b').style.display='block';
   const clo=c.startCloMatch();await tick();token='owner-b';c.invalidateOperation();classifyDone({type:'coat'});await clo;
   assert.equal(searches,0,'CLO cannot send the previous account’s garment to the next account’s search');
   token='owner-a';element('hero-img-b').src='garment-a';element('hero-img-b').style.display='block';c.classifyGarment=async()=>({type:'coat'});
   const searching=c.startCloMatch();await tick();token='owner-b';c.invalidateOperation();
   searchDone({ok:true,json:async()=>({ok:true,items:[{name:'Old private result'}]})});await searching;
   assert.equal(element('clo-result').textContent,'');assert.ok(!element('clo-result').innerHTML.includes('Old private result'));
 }
}
console.log('Brief queued saves and Operation garment measurements, guarded startup, CLO, redraw, image-request, scoring, SVG and stream isolation passed.');
