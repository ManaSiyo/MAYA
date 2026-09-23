import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
let checks = 0;
for (const file of ['frontend/index.html','playground/index.html']) {
 const source = read(file);
 const extract = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 let uid='owner', list=[{id:'existing',name:'Taylor',face:'original'}], fail=false, upload;
 const context=vm.createContext({crypto:webcrypto, projectStore:{_uid:()=>uid,ready:()=>true,uploadImage:async()=>{if(upload)await upload();return {url:'uploaded'};}},firebase:{firestore:()=>({runTransaction:async fn=>{if(fail)throw Error('offline');return fn({get:async()=>({exists:true,data:()=>({list})}),set:(_,data)=>{list=data.list;}});}})}});
 vm.runInContext('let lastSummary={client:{name:"Taylor"},_face_photo:"changed"};let _avatarLibCache=null,_avatarLibCacheUid=null;function _avatarsDoc(){return {};}',context);
 vm.runInContext(extract('function _avatarIdentity()', '// v12.5:')+extract('async function _saveCurrentAvatarToLibrary(', 'async function saveAvatarFromDrawer('),context);
 await vm.runInContext('_saveCurrentAvatarToLibrary()',context);assert.equal(list.length,1);checks++;
 await vm.runInContext('_saveCurrentAvatarToLibrary(true)',context);assert.equal(list.length,2);assert.equal(list[1].face,'original');assert.notEqual(list[0].id,'existing');checks++;
 assert.ok(!vm.runInContext('JSON.stringify(lastSummary)',context).includes('_avatarSavedSignature'));checks++;
 await vm.runInContext('_saveCurrentAvatarToLibrary(true)',context);assert.equal(list.length,2);checks++;
 vm.runInContext('lastSummary._face_photo="another"',context);await vm.runInContext('_saveCurrentAvatarToLibrary(true)',context);assert.equal(list.length,3);checks++;
 vm.runInContext('lastSummary.client.name="New name"',context);fail=true;await assert.rejects(vm.runInContext('_saveCurrentAvatarToLibrary(true)',context),/offline/);assert.equal(list.length,3);fail=false;checks++;
 vm.runInContext('lastSummary._face_photo="data:image/png;base64,AAA"',context);upload=()=>{uid='other';};await assert.rejects(vm.runInContext('_saveCurrentAvatarToLibrary(true)',context),/changed/);assert.equal(list.length,3);checks++;
 uid='owner';upload=()=>{vm.runInContext('lastSummary={client:{name:"different project"}}',context);};vm.runInContext('lastSummary._face_photo="data:image/png;base64,AAA"',context);await assert.rejects(vm.runInContext('_saveCurrentAvatarToLibrary(true)',context),/changed/);assert.equal(list.length,3);checks++;
 for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc=|application\/ld\+json/.test(match[1]))new vm.Script(match[2],{filename:file});}checks++;
 console.log(file+': avatar preservation, failure, isolation and syntax passed');
}
const server=read('docs/server/server.js');let record={items:[{id:'m_one',name:'A'}],overrides:{}};let writes=0;
const context=vm.createContext({loadManualLeads:async()=>structuredClone(record),gcsPut:async(_,data)=>{record=JSON.parse(data);writes++;},MAYA_LEADS_PATH:'fake',Buffer});
vm.runInContext(server.slice(server.indexOf('async function updateLead('),server.indexOf('// v13.87: delete ANY lead')),context);
for(const id of ['m_one','w_one']){await vm.runInContext(`updateLead('${id}',{stage:'closed'})`,context);assert.equal(id==='m_one'?record.items[0].stage:record.overrides.w_one.stage,'closed');checks++;}
assert.equal(await vm.runInContext("updateLead('m_one',{stage:'invalid'})",context),null);assert.equal(writes,2);checks++;
const admin=read('backend/status.html');for(const match of admin.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc=|application\/ld\+json/.test(match[1]))new vm.Script(match[2]);}checks++;
console.log(`${checks} checks passed; no browser or external service used.`);
