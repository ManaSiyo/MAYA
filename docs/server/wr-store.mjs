import {jsonStore,problem} from './crm-store.mjs';
import {randomUUID} from 'node:crypto';

// WR has a private, account-bound document. A saved
// request id is retained with the lead so a retry cannot create a duplicate.
export function createWrStore({read,write}) {
 const store=jsonStore({read,write});
 const key=subject=>{
  if(typeof subject!=='string'||!subject||subject.length>200)throw problem('Invalid account or workspace.',400);
  return `private/wr/${Buffer.from(subject).toString('base64url')}.json`;
 };
 const validateDoc=doc=>{if(!doc||!Array.isArray(doc.leads)||doc.leads.length>5000)throw problem('WR storage is invalid.',503);return doc.leads;};
 const field=(v,max)=>{if(typeof v!=='string'||v.length>max)throw problem('Invalid applicant field.',400);return v.trim();};
 async function list(subject){return validateDoc((await store.get(key(subject),{leads:[]})).value);}
 async function add(subject,input){
  if(!input||typeof input!=='object'||!/^[0-9a-f-]{36}$/i.test(input.requestId||''))throw problem('Invalid request.',400);
  const name=field(input.name,120),phone=field(input.phone,40),color=field(input.color,120),look=field(input.look,240),email=field(input.email??'',254);
  if(!name)throw problem('Name is required.',400);
  const wave=input.wave;if(wave!==''&&(typeof wave!=='number'||!Number.isFinite(wave)))throw problem('Wave must be a number.',400);
  const requestId=input.requestId.toLowerCase(),payload={name,phone,wave,color,look,email};
  const {result}=await store.update(key(subject),doc=>{const leads=validateDoc(doc),old=leads.find(x=>x.requestId===requestId);if(old){if(JSON.stringify({...old.payload,email:old.payload.email??''})!==JSON.stringify(payload))throw problem('This request id was already used.',409);return old;}if(leads.length>=5000)throw problem('WR applicant capacity reached.',409);const entry={id:randomUUID(),requestId,payload,createdAt:new Date().toISOString()};leads.unshift(entry);return entry;},{leads:[]});return result;
 }
 return {list,add};
}
