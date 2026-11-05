import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../frontend/index.html',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let uid='A',epoch=0,list=[{id:'unrelated',name:'Avatar',face:'keep-me',updatedAt:1}],fail=false,uploadGate=null,uploads=0,writes=0;
const notices=[];
const ctx=vm.createContext({crypto:webcrypto,console:{warn(){}},setTimeout,clearTimeout,
  document:{querySelector:()=>null},confirm:()=>true,showError:message=>notices.push(message),_persistSession(){},refreshDrawerClientName(){},showToast:message=>notices.push(message),
  _opContext:()=>({uid,epoch}),_opStillValid:c=>c.uid===uid&&c.epoch===epoch,
  projectStore:{_uid:()=>uid,ready:()=>true,_accountContext:()=>({uid,epoch}),_accountValid:c=>c.uid===uid&&c.epoch===epoch,
    uploadImage:async()=>{uploads++;if(uploadGate)await uploadGate.promise;return {url:'https://example.test/face-'+uploads+'.jpg'};}},
  firebase:{firestore:()=>({runTransaction:async fn=>{if(fail)throw Error('offline');return fn({get:async()=>({exists:true,data:()=>({list})}),set:(_,data)=>{writes++;list=data.list;}});}})},
});
vm.runInContext("let lastSummary={client:{name:null},_face_photo:'data:image/png;base64,AAAA'},_facePhotoVersion=0,_avatarLibCache=null,_avatarLibCacheUid=null,_avatarSwitcherOpen=false;function _avatarsDoc(){return {};}",ctx);
vm.runInContext(slice('function _avatarIdentity()','// v12.5:')+slice('// Avatar edits save automatically','async function saveAvatarFromDrawer('),ctx);
assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),true);
assert.equal(list.length,2);assert.equal(list[0].name,'Avatar');assert.equal(list[1].face,'keep-me','Unrelated same-name avatars are preserved');
const id=list[0].id;
await vm.runInContext('_queueAvatarSave(true)',ctx);assert.equal(writes,1);assert.equal(uploads,1);
vm.runInContext("lastSummary.client.name='Taylor';lastSummary._measurements={height:'70'}",ctx);
await Promise.all([vm.runInContext('_queueAvatarSave(true)',ctx),vm.runInContext('_queueAvatarSave(true)',ctx)]);
assert.equal(list.length,2);assert.equal(list[0].id,id);assert.equal(list[0].name,'Taylor');assert.equal(list[0].measurements.height,'70');assert.equal(uploads,1,'A name/measurement edit reuses the saved photo');
fail=true;vm.runInContext("lastSummary.client.name='New name'",ctx);assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),false);assert.equal(list[0].name,'Taylor');assert.match(notices.at(-1),/could not sync/);fail=false;
await vm.runInContext('_queueAvatarSave(true)',ctx);assert.equal(list[0].name,'New name');
list[0]={...list[0],updatedAt:list[0].updatedAt+10};vm.runInContext("lastSummary.client.name='Stale name'",ctx);
assert.equal(await vm.runInContext('_queueAvatarSave(true)',ctx),false);assert.equal(list[0].name,'New name','Concurrent remote edits are not overwritten');
assert.equal(vm.runInContext('_avatarLibCache',ctx),null,'Reopening after a conflict reads the latest saved library');
for(const boundary of ['account-roundtrip','client']){
  vm.runInContext("lastSummary={client:{name:'Pending'},_face_photo:'data:image/png;base64,AAAA'};_facePhotoVersion++",ctx);
  uploadGate=deferred();const before=uploads,priorWrites=writes,running=vm.runInContext('_queueAvatarSave(true)',ctx);
  while(uploads===before)await Promise.resolve();
  if(boundary==='account-roundtrip'){uid='B';epoch++;uid='A';epoch++;}else vm.runInContext("lastSummary.client.name='Other client';_facePhotoVersion++",ctx);
  uploadGate.resolve();await running;assert.equal(writes,priorWrites,'Stale upload cannot write after '+boundary);uploadGate=null;
}
// List mutations read the latest transaction snapshot, preserving simultaneous photo edits.
vm.runInContext(slice('async function renameAvatarById(', 'function pgRenameAvatarRow(')+slice('async function deleteAvatar(', '// Helper for face-photo handlers'),ctx);
ctx._loadAvatarLibrary=async()=>list;ctx.toggleAvatarSwitcher=async()=>{};
ctx.updateClientNameInline=name=>vm.runInContext('lastSummary.client.name='+JSON.stringify(name),ctx);
list=[{id:'rename-me',name:'Old',face:'newer-remote-photo',updatedAt:10},{id:'neighbor',name:'Keep',face:'untouched'}];
vm.runInContext("lastSummary={client:{name:'Other'},_avatarLibraryId:'other'}",ctx);
assert.equal(await vm.runInContext("renameAvatarById('rename-me','Renamed')",ctx),true);
assert.equal(list[0].face,'newer-remote-photo');assert.equal(list[0].name,'Renamed');assert.equal(list[1].id,'neighbor');
vm.runInContext("lastSummary={client:{name:'Old'},_avatarLibraryId:'rename-me',_avatarLibraryRevision:10,_face_photo:'old-photo'}",ctx);
assert.equal(await vm.runInContext("renameAvatarById('rename-me','Stale rename')",ctx),false,'A stale selected avatar cannot adopt a new revision and later overwrite a remote photo');
await vm.runInContext("deleteAvatar('rename-me')",ctx);
assert.equal(list.length,1);assert.equal(list[0].id,'neighbor');assert.equal(vm.runInContext('lastSummary._avatarLibraryId',ctx),null);
assert.equal(vm.runInContext('lastSummary._face_photo',ctx),'old-photo','Removing the library entry retains the project photo');
// A queued upload cannot resurrect a record removed by another client.
list=[{id:'removed',name:'Old',updatedAt:1}];vm.runInContext("lastSummary={client:{name:'Pending'},_avatarLibraryId:'removed',_avatarLibraryRevision:1,_face_photo:'data:image/png;base64,AAAA'}",ctx);
uploadGate=deferred();const prior=uploads,pending=vm.runInContext('_queueAvatarSave(true)',ctx);while(uploads===prior)await Promise.resolve();list=[];uploadGate.resolve();assert.equal(await pending,false);assert.equal(list.length,0);uploadGate=null;
assert.ok(!source.includes('onclick="saveAvatarFromDrawer(this)"')&&!source.includes('onclick="saveAvatar()"'),'Avatar Save buttons are removed');
console.log('Avatar autosave: optional names, one stable record, preserved neighbors, reused photos, explicit failures, remote conflicts and account/client isolation passed.');
