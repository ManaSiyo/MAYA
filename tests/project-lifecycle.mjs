import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

// Execute the shipped page functions with deferred, account-aware fake stores.
// No Firebase SDK, browser, network, filesystem writes or provider calls.
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
async function until(test) { for(let i=0;i<100;i++) {if(test()) return; await Promise.resolve();} assert.fail('Deferred operation never reached its barrier'); }
function part(source, start, end) { const at=source.indexOf(start); assert.ok(at>=0,start); const stop=source.indexOf(end,at); assert.ok(stop>at,end); return source.slice(at,stop); }
function harness(page) {
  const source=readFileSync(new URL('../'+page,import.meta.url),'utf8');
  const records=new Map(), assets=new Map(), writes=[], reads=[], notices=[], timers=new Map();
  let user='A', counter=0, clock=0;
  const hooks={read:null,commit:null,upload:null};
  const snap=(path,data)=>({id:path.split('/').at(-1),ref:ref(path),exists:data!==undefined,data:()=>clone(data),metadata:{hasPendingWrites:false}});
  function authorize(path) {
    if(path.startsWith('users/') && path.split('/')[1]!==user) throw Error('permission-denied');
    if(path.startsWith('shares/') && path.split('/').length>2 && path.split('/')[1]!==user) throw Error('permission-denied');
  }
  async function read(path, query) {
    reads.push(path);
    const value=query ? (()=>{const docs=[...records].filter(([key,v])=>key.startsWith(path+'/') && key.slice(path.length+1).indexOf('/')<0 && query.every(([field,op,want])=>op==='==' && v[field]===want)).map(([key,v])=>snap(key,v));return {docs,forEach:fn=>docs.forEach(fn)};})() : snap(path,records.get(path));
    if(hooks.read) await hooks.read(path,query,value);
    return value;
  }
  function write(path,data,merge=false) {authorize(path); writes.push({path,data:clone(data)}); records.set(path,merge?{...records.get(path),...clone(data)}:clone(data));}
  function ref(path, query=null) {
    return {path,collection:name=>ref(path+'/'+name,[]),doc:name=>ref(path+'/'+name),where:(field,op,value)=>ref(path,[...(query||[]),[field,op,value]]),
      get:()=>read(path,query),set:async(data,options)=>write(path,data,options?.merge),update:async data=>write(path,data,true),
      delete:async()=>{authorize(path);records.delete(path);},onSnapshot:()=>()=>{}};
  }
  const db={collection:name=>ref(name,[]),runTransaction:async fn=>{const pending=[];const result=await fn({get:r=>r.get(),set:(r,v)=>pending.push([r.path,clone(v)])});if(hooks.commit) await hooks.commit(pending);for(const [p,v] of pending)write(p,v);return result;},batch:()=>{const pending=[];return {set:(r,v)=>pending.push(()=>write(r.path,v)),delete:r=>pending.push(()=>records.delete(r.path)),commit:async()=>pending.forEach(fn=>fn())};}};
  const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>123,delete:()=>null,increment:v=>v};
  const assetURL=path=>'https://storage.invalid/'+encodeURIComponent(path);
  function storageRef(path) {return {fullPath:path,
    put:async(blob)=>{authorize(path);if(hooks.upload) await hooks.upload(path,blob);assets.set(path,clone(blob));},
    getDownloadURL:async()=>assetURL(path),delete:async()=>{authorize(path);assets.delete(path);},
    listAll:async()=>({items:[...assets.keys()].filter(key=>key.startsWith(path.replace(/\/$/,'')+'/')).map(storageRef)})};}
  const ctx={console:{log(){},warn(){}},Promise,Set,Map,JSON,Date,Math,Uint8Array,crypto:webcrypto,
    firebase:{auth:()=>({currentUser:user?{uid:user}:null}),firestore,storage:()=>({ref:storageRef})},
    setTimeout:(fn,ms)=>{const id=++clock;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async url=>({blob:async()=>({type:'image/jpeg',content:String(url)})}),
    blobFromPicture:async url=>{if(String(url).startsWith('https://storage.invalid/')){const data=assets.get(decodeURIComponent(url.split('/').at(-1)));if(!data)throw Error('missing source');return clone(data);}return {type:'image/jpeg',content:String(url)};},
    compressBlobForUpload:async blob=>blob,
    _authSeq:1,_boardEpoch:1,_persistTimer:null,_hydrating:false,_creatingBin:false,_flushNow:false,_autosaveDirty:false,_activeSessionId:null,
    currentClientName:null,lastSummary:null,lastTranscript:'',items:[],_lastPaintDropped:0,
    _avatarLibCache:null,_avatarLibCacheUid:null,_pendingAssetDeletes:[],_pendingLegacyDeletes:[],
    _cardSig:c=>c.title||c.imageUrl||c.image||'',_twoWordFromItems:()=>'',_autoProjectName:()=> 'Untitled fixture',
    _drainAssetDeletes(){},_hydrate:async fn=>fn(),_doClear(){ctx.items=[];ctx.lastSummary=null;ctx.lastTranscript='';ctx._boardEpoch++;},
    showError:msg=>notices.push(msg),showToast:msg=>notices.push(msg),refreshDrawerClientName(){},renderNotesPanel(){},
    _paintItems:items=>{ctx.items=items;},_opContext:()=>({id:ctx.projectStore.currentId,auth:ctx._authSeq}),_opStillValid:stamp=>stamp.id===ctx.projectStore.currentId&&stamp.auth===ctx._authSeq,
    _showShareModal:link=>notices.push(link),location:{origin:'https://maya.invalid'},navigator:{clipboard:{writeText:async()=>{}}},
    _safeImgSrc:s=>typeof s==='string'?s:'',_safeRealism:()=>null,
  };
  runInNewContext(part(source,'const projectStore = {','async function _renderSessionsDropdown()')+'\nglobalThis.projectStore=projectStore;',ctx);
  runInNewContext(part(source,'function _persistSession() {','// v11.31: flush immediately'),ctx);
  runInNewContext(part(source,'async function _persistNow(flush) {','// v11.0: full session sync'),ctx);
  runInNewContext(part(source,'async function _rescueLegacyProjects(','// ── v12.6: TIP.'),ctx);
  runInNewContext(part(source,'let _cloudBooted = false;','// ── v12.5 ONE TIME RESCUE'),ctx);
  runInNewContext(part(source,'async function shareProjectById(id) {','// v13.8: the share popup.'),ctx);
  runInNewContext(part(source,'function _shareText(','// Boot path: /?share=TOKEN.'),ctx);
  const store=ctx.projectStore;store._newId=()=> 'pfixture'+(++counter);
  ctx._avatarsDoc=()=>ref('users/'+user+'/settings/avatars');
  ctx._avatarIdentity=()=>ctx.lastSummary?{name:ctx.lastSummary.client.name,face:ctx.lastSummary._face_photo,descriptors:null,measurements:null}:null;
  runInNewContext(part(source,'async function _saveCurrentAvatarToLibrary(','async function saveAvatarFromDrawer('),ctx);
  function board(name='Original',id='pfixture-existing') {store.currentId=id;store.ownerUid=user;ctx.currentClientName=name;ctx.items=[{id:1,el:{style:{left:'0',top:'0'}},card:{title:name}}];records.set('users/'+user+'/projects/'+id,{name,epoch:2,revision:0,items:[]});}
  return {ctx,store,records,assets,writes,reads,notices,timers,hooks,assetURL,board,switchUser(next){user=next;ctx._authSeq++;},user:()=>user};
}

for(const page of ['frontend/index.html','playground/index.html']) {
  for(const operation of ['index','list','reconcile','migration','boot']) {
    for(const returnToA of [false,true]) {
      const h=harness(page),gate=deferred();let blocked=false;
      h.records.set('users/A/projects/privateA',{name:'Private A',epoch:2,revision:1,items:[]});
      h.records.set('users/A/sessions/legacyA',{name:'Private legacy A',items:[],lastTranscript:'Private notes'});
      h.hooks.read=async path=>{if(!blocked && path===(operation==='migration'||operation==='boot'?'users/A/sessions':operation==='list'?'users/A/settings/projectIndex':'users/A/projects')){blocked=true;await gate.promise;}};
      let opens=0;h.store.open=async()=>{opens++;};
      const running=operation==='index'?h.store._rebuildIndex():operation==='list'?h.store.list(true):operation==='reconcile'?h.store.reconcile():operation==='migration'?h.ctx._rescueLegacyProjects():h.ctx._cloudBoot();
      const finished=Promise.resolve(running).catch(e=>{assert.match(e.message,/auth-changed/);});
      await until(()=>blocked);h.switchUser('B');if(returnToA)h.switchUser('A');gate.resolve();await finished;
      assert.equal(h.writes.length,0,`${page} ${operation}: stale account/session cannot write`);
      assert.equal(h.store._idxCache,null,`${page} ${operation}: stale data cannot enter cache`);
      assert.equal(opens,0,`${page} ${operation}: stale boot cannot open a project`);
    }
  }
  { // First save failure retains the bin and dirty state; retry uses the same id.
    const h=harness(page);h.ctx.items=[{id:1,el:{style:{}},card:{title:'New board'}}];
    h.hooks.commit=async()=>{throw Error('Storage unavailable');};
    await assert.rejects(h.store.createAuto(),/Storage unavailable/);const id=h.store.currentId;
    assert.ok(id);assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),false);assert.equal(h.store.currentId,id);
    h.hooks.commit=null;assert.equal(await h.store.flush(),true);assert.equal(h.store.currentId,id);assert.equal(h.store._dirty,false);
    assert.equal(h.records.get('users/A/projects/'+id).items[0].card.title,'New board');
  }
  { // A resolved non-write cannot masquerade as successful initial creation.
    const h=harness(page);h.store._commit=async()=>({written:false,reason:'stale'});
    await assert.rejects(h.store.createFromCanvas('New project'),/not saved/);assert.equal(h.store._dirty,true);
  }
  { // A navigation flush before debounce saves both existing and brand new boards.
    for(const existing of [true,false]) {const h=harness(page);if(existing)h.board();else h.ctx.items=[{id:1,el:{style:{}},card:{title:'New'}}];
      h.ctx._persistSession();assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),true);
      assert.equal(h.store._dirty,false);assert.ok(h.records.get('users/A/projects/'+h.store.currentId).items.length);assert.equal(h.ctx._persistTimer,null);
    }
  }
  { // Navigation waits for an in-flight first save.
    const h=harness(page),gate=deferred();h.ctx.items=[{id:1,el:{style:{}},card:{title:'New'}}];let blocked=false;
    h.hooks.commit=async()=>{blocked=true;await gate.promise;};const creating=h.store.createAuto();await until(()=>blocked);
    let flushed=false;const flushing=h.store.flush().then(result=>{flushed=true;return result;});await Promise.resolve();assert.equal(flushed,false);
    gate.resolve();await creating;assert.equal(await flushing,true);
  }
  { // A newer edit during a pending write remains dirty, then flush persists it.
    const h=harness(page),gate=deferred();h.board();h.store.queueSave();let blocked=false;
    h.hooks.commit=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.ctx.items[0].card.title='Newer edit';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.store._dirty,true);assert.equal(await h.store.flush(),true);
    assert.equal(h.records.get('users/A/projects/'+h.store.currentId).items[0].card.title,'Newer edit');
  }
  { // Same UID in a new auth generation cannot commit an old queued save.
    const h=harness(page),gate=deferred();h.board();h.store.queueSave();let blocked=false;
    h.hooks.read=async path=>{if(path==='users/A/projectTombstones/'+h.store.currentId){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.switchUser('B');h.switchUser('A');gate.resolve();assert.equal((await saving).written,false);assert.equal(h.writes.length,0);
  }
  { // A late project load cannot restore A's board into a new auth session.
    const h=harness(page),gate=deferred();h.board();let blocked=false;
    h.records.set('users/A/projects/other',{name:'Other A project',epoch:2,revision:1,items:[]});
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const opening=h.store.open('other');await until(()=>blocked);h.switchUser('B');gate.resolve();assert.equal(await opening,false);assert.equal(h.ctx.currentClientName,'Original');
  }
  { // Replacing an image while its previous upload is pending requires a new upload.
    const h=harness(page),gate=deferred();h.board();h.ctx.items[0].card.image='data:image/jpeg;base64,OLD';h.ctx._persistSession();let blocked=false;
    h.hooks.upload=async()=>{if(!blocked){blocked=true;await gate.promise;}};
    const saving=h.store.save();await until(()=>blocked);h.ctx.items[0].card.image='data:image/jpeg;base64,NEW';h.ctx._persistSession();gate.resolve();await saving;
    assert.equal(h.ctx.items[0].card._uploadedToCloud,undefined);assert.equal(await h.store.flush(),true);
    const card=h.records.get('users/A/projects/'+h.store.currentId).items[0].card;
    assert.equal(h.assets.get(card.storagePath).content,'data:image/jpeg;base64,NEW');
  }
  { // A late face upload cannot assign its URL to the newly selected person.
    const h=harness(page),gate=deferred();h.board();h.ctx.lastSummary={client:{name:'First'},_face_photo:'data:image/jpeg;base64,FIRST'};let blocked=false;
    h.hooks.upload=async()=>{blocked=true;await gate.promise;};const snapshot=h.store._summaryForCloud(h.store.currentId,'A');await until(()=>blocked);
    h.ctx.lastSummary={client:{name:'Second'},_face_photo:'data:image/jpeg;base64,SECOND'};gate.resolve();await snapshot;
    assert.equal(h.ctx.lastSummary._face_photo_path,undefined);assert.equal(h.ctx.lastSummary._face_photo_url,undefined);
  }
  { // Saving a migrated project must retain the source tombstone relationship.
    const h=harness(page);h.records.set('users/A/sessions/legacy',{name:'Recovered',lastTranscript:'Notes',items:[]});
    await h.ctx._rescueLegacyProjects();const [path,project]=[...h.records].find(([path])=>path.startsWith('users/A/projects/'));
    h.store.currentId=path.split('/').at(-1);h.store.ownerUid='A';h.store.revision=project.revision;h.ctx.currentClientName='Edited recovered';
    await h.store.save();assert.equal(h.records.get(path).recoveredFrom,'legacy');await h.store.remove(h.store.currentId);
    assert.ok(h.records.has('users/A/projectTombstones/legacy'));h.records.delete('users/A/settings/migration');await h.ctx._rescueLegacyProjects();
    assert.equal([...h.records.keys()].filter(path=>path.startsWith('users/A/projects/')).length,0,'Deleted legacy source cannot return on migration retry');
  }
  { // A saved imageUrl card becomes a distinct share-owned asset; stale image loses.
    const h=harness(page);h.board();const original='users/A/projects/'+h.store.currentId+'/images/original.jpg';h.assets.set(original,{type:'image/jpeg',content:'Private picture'});
    const list=[{card:{imageUrl:h.assetURL(original),image:'https://wrong.invalid/old.jpg',storagePath:original,_uploadedToCloud:true}}];
    await h.ctx._publishShare(h.store.currentId,list,null,null,'Shared');
    const share=[...h.records].find(([path])=>/^shares\/[^/]+$/.test(path))[1];const card=share.items[0].card;
    assert.ok(card.imageUrl.includes(encodeURIComponent('shares/A/')));assert.equal(card.image,undefined);assert.equal(card.storagePath,undefined);
    h.assets.delete(original);const imported=h.ctx._sanitizeSharedItem(share.items[0]);assert.equal((await h.ctx.blobFromPicture(imported.card.image)).content,'Private picture');
  }
  { // A stale source read cannot publish the old account's project as the new owner.
    const h=harness(page),gate=deferred();h.records.set('users/A/projects/other',{name:'A',items:[]});let blocked=false;
    h.hooks.read=async path=>{if(path==='users/A/projects/other'){blocked=true;await gate.promise;}};
    const sharing=h.ctx.shareProjectById('other');await until(()=>blocked);h.switchUser('B');gate.resolve();await sharing;assert.equal(h.writes.length,0);
  }
  { // Switching during copy cannot create a share document or new-account metadata.
    const h=harness(page),gate=deferred();h.board();let blocked=false;h.hooks.upload=async()=>{blocked=true;await gate.promise;};
    const sharing=h.ctx._publishShare(h.store.currentId,[{card:{imageUrl:'https://source.invalid/photo'}}],null,null,'A').catch(e=>{assert.match(e.message,/auth-changed/);});
    await until(()=>blocked);h.switchUser('B');gate.resolve();await sharing;assert.equal(h.writes.length,0);
  }
  { // Deletion while copying prevents publication; partial copies are cleaned.
    const h=harness(page);h.board();h.hooks.upload=async()=>{h.records.delete('users/A/projects/'+h.store.currentId);};
    await assert.rejects(h.ctx._publishShare(h.store.currentId,[{card:{imageUrl:'https://source.invalid/photo'}}],null,null,'A'),/deleted/);
    assert.equal(h.assets.size,0);assert.equal(h.writes.length,0);
  }
  console.log(`${page}: account/session races, dirty/create/flush barriers and independent share copies passed.`);
}
{
  // Avatar preservation is staged in Playground only, per the promotion rule.
  const h=harness('playground/index.html');h.board();const project=h.store.currentId,original='users/A/projects/'+project+'/images/face.jpg';
  h.assets.set(original,{type:'image/jpeg',content:'Portrait'});h.ctx.lastSummary={client:{name:'Client'},_face_photo:h.assetURL(original)};
  h.ctx.lastSummary.client.name='Avery';await h.ctx._saveCurrentAvatarToLibrary(true);
  const saved=h.records.get('users/A/settings/avatars').list[0];assert.ok(saved.face.includes(encodeURIComponent('users/A/projects/avatars/images/')));
  await h.store.remove(project);assert.equal(h.assets.has(original),false);assert.ok(h.assets.has(decodeURIComponent(saved.face.split('/').at(-1))));
  const failed=harness('playground/index.html');failed.ctx.lastSummary={client:{name:'Avery'},_face_photo:'https://source.invalid/face'};failed.hooks.upload=async()=>{throw Error('Upload failed');};
  await assert.rejects(failed.ctx._saveCurrentAvatarToLibrary(true),/Upload failed/);assert.equal(failed.records.has('users/A/settings/avatars'),false);
  console.log('Playground avatar: HTTPS face owns a library copy, survives source-project deletion, and failed upload never saves a roster entry.');
}
