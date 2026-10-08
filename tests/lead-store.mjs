import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createLeadStore,createLeadNoteStore} from '../docs/server/lead-store.mjs';

const files=new Map();let generation=0,writes=0,conflicts=0;
const storage={
  read:async key=>{const item=files.get(key);return item?{ok:true,generation:item.generation,buf:Buffer.from(JSON.stringify(item.value))}:{ok:false,status:404};},
  write:async(key,buf,type,expected)=>{writes++;if(expected!==(files.get(key)?.generation||'0')){conflicts++;throw Object.assign(Error('conflict'),{status:412});}files.set(key,{generation:String(++generation),value:JSON.parse(buf)});},
};
let clock='2026-10-07T14:00:00Z';const deps={...storage,now:()=>clock},leads=createLeadStore(deps);
const alice=await leads.add({name:'Alice',email:'Alice@EXAMPLE.com',note:'Original'});
assert.equal(alice.email,'alice@example.com');
await Promise.all([leads.update(alice.id,{phone:'+14155550123'}),leads.ownerCommit({action:'update',id:alice.id,displayName:'Alice',note:'Reviewed owner note'},'sms_one')]);
let record=await leads.read(),updated=record.items.find(x=>x.id===alice.id);
assert.equal(updated.phone,'+14155550123');assert.equal(updated.note,'Reviewed owner note');assert.equal(updated.noteUpdatedAt,clock);assert.ok(conflicts>0);
const server=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const ctx={lead:structuredClone(updated),note:{ts:'2020-01-01',text:'Older email note'}};
runInNewContext(server.slice(server.indexOf('function applyLatestLeadNote('),server.indexOf('async function loadLeadFeed('))+'\napplyLatestLeadNote(lead,note);',ctx);
assert.equal(ctx.lead.note,'Reviewed owner note');
clock='2026-10-08T14:00:00Z';await leads.ownerCommit({action:'update',id:alice.id,displayName:'Alice',note:'Wrong replay'},'sms_one');
assert.equal((await leads.read()).items[0].note,'Reviewed owner note');
const request={uid:'admin-a',requestId:'12345678-1234-1234-1234-123456789abc'};
const [first,replay]=await Promise.all([leads.add({name:'Bob'},request),leads.add({name:'Bob'},request)]);
assert.equal(first.id,replay.id);assert.equal((await leads.read()).items.filter(x=>x.name==='Bob').length,1);
await assert.rejects(leads.add({name:'Different'},request),e=>e.status===409);
assert.notEqual((await leads.add({name:'Bob'},{...request,uid:'admin-b'})).id,first.id);
let uncertain=true;
const ambiguous=createLeadStore({...deps,write:async(...args)=>{await storage.write(...args);if(uncertain){uncertain=false;throw Error('response lost after durable save');}}});
const uncertainRequest={...request,requestId:'uncertain-reviewed-request-00001'};
await assert.rejects(ambiguous.add({name:'Uncertain'},uncertainRequest),/response lost/);
const recovered=await createLeadStore(deps).add({name:'Uncertain'},uncertainRequest);
assert.equal((await leads.read()).items.filter(x=>x.name==='Uncertain').length,1);assert.ok(recovered.id);
await leads.remove(first.id);await leads.add({name:'Bob'},request);assert.ok(!(await leads.read()).items.some(x=>x.id===first.id),'Replay cannot resurrect a removed lead');
await Promise.all([leads.update(alice.id,{stage:'completed'}),leads.remove('wix-removed')]);
record=await leads.read();assert.equal(record.items.find(x=>x.id===alice.id).stage,'completed');assert.ok(record.tombstones.includes('wix-removed'));assert.ok(record.ownerRequests.sms_one);
assert.equal(await leads.update('wix-removed',{note:'Do not resurrect'}),null);
const many=Array.from({length:205},(_,i)=>({id:'m_old'+i,name:'Legacy '+i}));
files.set('many',{generation:String(++generation),value:{items:many,legacyMetadata:{keep:true}}});
const oldStore=createLeadStore({...deps,path:'many'});await oldStore.add({name:'New'});assert.equal((await oldStore.read()).items.length,206);assert.deepEqual((await oldStore.read()).legacyMetadata,{keep:true});

for(const value of [{ok:false,status:503},{ok:true,generation:'9',buf:Buffer.from('{')},{ok:true,generation:'9',buf:Buffer.from('{}')},{ok:true,generation:'9',buf:Buffer.from('{"items":"broken"}')},{ok:true,buf:Buffer.from('{"items":[]}')}]){
  let badWrites=0;const broken=createLeadStore({read:async()=>value,write:async()=>badWrites++});
  for(const action of [()=>broken.read(),()=>broken.add({name:'New'}),()=>broken.update(alice.id,{name:'Changed'}),()=>broken.remove('wix-id'),()=>broken.ownerCommit({action:'add',name:'New'},'sms_new')])await assert.rejects(action);
  assert.equal(badWrites,0);
}
const notePath=email=>'legacy-notes/'+email,notes=createLeadNoteStore({...deps,path:notePath});
await Promise.all([notes.append('Alice@EXAMPLE.com',{note:'One'}),notes.append('alice@example.com',{note:'Two',contact:'call'})]);
const savedNotes=await notes.read('alice@example.com');assert.equal(savedNotes.notes.length,2);assert.equal(savedNotes.contacts.length,1);
savedNotes.notes.length=0;assert.equal((await notes.read('alice@example.com')).notes.length,2);
const failing=createLeadNoteStore({...deps,path:notePath,write:async()=>{throw Error('write failed');}});
await assert.rejects(failing.append('alice@example.com',{note:'Never saved'}));assert.equal((await notes.read('alice@example.com')).notes.length,2);
for(const value of [{ok:false,status:503},{ok:true,generation:'2',buf:Buffer.from('{')},{ok:true,generation:'2',buf:Buffer.from('{}')}]){
  let badWrites=0;const broken=createLeadNoteStore({read:async()=>value,write:async()=>badWrites++,path:notePath});
  await assert.rejects(broken.append('alice@example.com',{note:'New'}));assert.equal(badWrites,0);
}
// The real production phone adapter must return a complete corrected lead.
const adapterSource=server.slice(server.indexOf('    saveLead: async (lead, prevId) => {'),server.indexOf('    saveTranscript: async',server.indexOf('    saveLead: async (lead, prevId) => {')));
const phoneContext={_leadsCache:{},updateLead:(...args)=>leads.update(...args),appendManualLead:(...args)=>leads.add(...args),_messages:{name:async()=>{}}};
runInNewContext('phone={'+adapterSource+'};',phoneContext);
const corrected=await phoneContext.phone.saveLead({name:'Alice corrected',phone:'+14155550123',wrote:'Corrected request'},alice.id);
assert.equal(corrected.id,alice.id);assert.equal(corrected.name,'Alice corrected');assert.equal(corrected.wrote,'Corrected request');assert.equal(corrected.email,'alice@example.com');
assert.ok(!/gcsPut\(MAYA_LEADS_PATH|gcsPut\(leadNotePath/.test(server),'All lead/note writers share the checked store');
console.log('Lead store: fail-closed reads, cross-writer CAS, idempotent account-bound adds, preserved history/tombstones, note precedence and production phone adapter passed.');
