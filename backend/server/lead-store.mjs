// Shared legacy lead/note paths with fail-closed reads and generation retries.
import {createHash,randomBytes} from 'node:crypto';
import {jsonStore,problem} from './crm-store.mjs';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
export function validateLeadRecord(record){
  if(!object(record))throw problem('Lead storage is invalid.',503);
  if(!Array.isArray(record.items))throw problem('Lead storage is invalid.',503);
  if(record.tombstones===undefined)record.tombstones=[];
  if(!Array.isArray(record.tombstones))throw problem('Lead storage is invalid.',503);
  for(const key of ['overrides','ownerRequests','adminRequests']){if(record[key]===undefined)record[key]={};if(!object(record[key]))throw problem('Lead storage is invalid.',503);}
  return record;
}
export function cleanLeadPatch(next={},ts=new Date().toISOString()){
  const clean={};
  for(const [key,max] of Object.entries({name:120,email:180,phone:60,tier:80,company:120,quote:40,invoice1:40,invoice2:40,paylink:400})){
    if(Object.hasOwn(next,key))clean[key]=String(next[key]||'').trim().slice(0,max);
  }
  if(Object.hasOwn(clean,'email'))clean.email=clean.email.toLowerCase();
  if(Object.hasOwn(next,'stage')){
    if(!['new','contacted','closed','passed','in_process','in_progress','booked','completed','canceled'].includes(next.stage))throw problem('Invalid lead status.');
    clean.stage=next.stage;
  }
  if(Object.hasOwn(next,'note')){clean.note=String(next.note||'').trim().slice(0,2000);clean.wrote=clean.note;clean.noteUpdatedAt=ts;}
  return clean;
}
export function createLeadStore(deps){
  const db=jsonStore(deps),path=deps.path||'maya/leads.json',now=deps.now||(()=>new Date().toISOString());
  const empty=()=>({items:[],overrides:{},tombstones:[]});
  const read=async()=>validateLeadRecord((await db.get(path,empty())).value);
  const mutate=async fn=>db.update(path,s=>fn(validateLeadRecord(s)),empty());
  function patchRecord(s,id,patch,ts){
    if(s.tombstones.includes(id))return null;
    if(id.startsWith('m_')){
      const item=s.items.find(x=>String(x?.id)===id);if(!item)return null;
      Object.assign(item,patch,{updatedAt:ts});if(item.name==='')item.name='Unnamed';
      return {...item};
    }
    s.overrides[id]={...(s.overrides[id]||{}),...patch,updatedAt:ts};
    return {id,...s.overrides[id]};
  }
  async function add(lead={},options={}){
    const ts=now(),payload={
      source:lead.source==='phone'?'phone':'maya',name:String(lead.name||'').trim().slice(0,120)||'Unnamed',
      email:String(lead.email||'').trim().toLowerCase().slice(0,180),phone:String(lead.phone||'').trim().slice(0,60),
      tier:String(lead.tier||'').trim().slice(0,80),wrote:String(lead.wrote||lead.note||'').trim().slice(0,400),
    };
    payload.note=payload.wrote||'Added by hand.';
    const requestId=options.requestId,uid=options.uid;
    if(requestId!==undefined&&(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)||typeof uid!=='string'||!uid))throw problem('Invalid lead request ID.');
    const requestKey=requestId===undefined?'':hash(uid+'\0'+requestId),fingerprint=hash(JSON.stringify(payload));
    const item={id:'m_'+randomBytes(10).toString('hex'),ts,...payload};
    return (await mutate(s=>{
      const previous=requestKey&&s.adminRequests[requestKey];
      if(previous){if(previous.fingerprint!==fingerprint)throw problem('This request ID belongs to a different lead.',409);return previous.lead;}
      if(requestKey&&Object.keys(s.adminRequests).length>=10000)throw problem('Lead request ledger needs archival; no lead was added.',503);
      s.items.push(item);
      if(requestKey)s.adminRequests[requestKey]={fingerprint,lead:{...item}};
      return item;
    })).result;
  }
  async function update(id,next){
    const key=String(id||'').trim(),ts=now();let patch;
    try{patch=cleanLeadPatch(next,ts);}catch(e){if(e.status===400)return null;throw e;}
    if(!key||!Object.keys(patch).length)return null;
    const {result}=await mutate(s=>patchRecord(s,key,patch,ts));
    return result?{ok:true,id:key,patch,lead:result}:null;
  }
  async function remove(id){
    const key=String(id||'').trim();if(!key)return null;
    return (await mutate(s=>{
      if(key.startsWith('m_')){const index=s.items.findIndex(x=>String(x?.id)===key);if(index<0)return null;s.items.splice(index,1);}
      if(!s.tombstones.includes(key))s.tombstones.push(key);
      delete s.overrides[key];return {ok:true,id:key};
    })).result;
  }
  async function ownerCommit(command,requestId){
    const ts=now(),patch=cleanLeadPatch(Object.fromEntries(['name','phone','email','tier','stage','note'].filter(k=>command[k]).map(k=>[k,command[k]])),ts);
    return (await mutate(s=>{
      if(s.ownerRequests[requestId])return s.ownerRequests[requestId];
      let id=command.id;const name=command.name||command.displayName;
      if(command.action==='add'){
        id='m_'+hash(requestId).slice(0,20);
        if(!s.items.some(l=>l.id===id))s.items.push({id,ts,source:command.source==='gmail'?'gmail':'phone',...patch});
      }else if(!id||!patchRecord(s,id,patch,ts))throw problem('That lead was removed. Send a new request.',409);
      return s.ownerRequests[requestId]={id,name};
    })).result;
  }
  return {read,add,update,remove,ownerCommit};
}

export function createLeadNoteStore(deps){
  const db=jsonStore(deps),now=deps.now||(()=>new Date().toISOString());
  const emailKey=email=>String(email||'').trim().toLowerCase();
  const empty=email=>({email,notes:[],contacts:[]});
  function valid(s,email){
    if(!object(s)||!Array.isArray(s.notes)||!Array.isArray(s.contacts))throw problem('Lead notes are invalid.',503);
    if(s.email&&emailKey(s.email)!==email)throw problem('Lead note identity did not match.',503);
    return s;
  }
  async function read(email){const key=emailKey(email);return valid((await db.get(deps.path(key),empty(key))).value,key);}
  async function append(email,{note='',contact=''}={}){
    const key=emailKey(email),text=String(note||'').trim().slice(0,2000),ts=now();
    if(!text&&!['email','call'].includes(contact))return read(key);
    const {value}=await db.update(deps.path(key),s=>{
      valid(s,key);if(text){s.notes.push({ts,text});s.notes=s.notes.slice(-50);}
      if(['email','call'].includes(contact)){s.contacts.push({type:contact,ts});s.contacts=s.contacts.slice(-100);}
    },empty(key));
    return value;
  }
  return {read,append};
}
