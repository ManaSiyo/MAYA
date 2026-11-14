import {randomUUID} from 'node:crypto';
import {jsonStore,problem} from './crm-store.mjs';

// Only fixed operational states enter this private history. Client/provider text,
// account IDs, URLs and credentials are never accepted or stored.
const adSources={google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'};
const sources={marketing:'Marketing',leads:'Leads',analytics:'Analytics',submissions:'Submissions',callback_alerts:'Callback alerts',site:'Site',api:'API',images:'Images',backup:'Backup',briefing:'Maya briefing',features:'Feature requests'};
const adStates={
 connected:['direct reporting connected.','info'],
 not_configured:['direct reporting is not configured.','warning'],
 oauth_expired:['OAuth authorization expired or was revoked. Reconnect the Ads account.','error'],
 project_access:['API needs production access in the OAuth client’s Google Cloud project.','error'],
 account_access:['OAuth identity cannot access the configured Ads account.','error'],
 scope:['OAuth grant is missing the Ads permission.','error'],
 authorization:['authorization was rejected. Check its server connection.','error'],
 account_mismatch:['reporting account does not match the configured account.','error'],
 provider_error:['reporting could not be loaded.','error'],
 incomplete_report:['report is incomplete. Totals are unavailable.','error'],
 invalid_report:['report could not be validated. Totals are unavailable.','error'],
 invalid_metric:['report contains unavailable metrics. Totals are unavailable.','error'],
 invalid_account:['account reporting settings could not be validated.','error'],
 currency_excluded:['reported currency cannot be combined with USD.','warning'],
};
const states={healthy:['is available.','info'],unavailable:['is unavailable.','error'],needs_attention:['needs attention. Open Systems to review its status.','warning'],not_configured:['is not configured.','warning']};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
function definition(source,code){
 if(typeof source!=='string'||typeof code!=='string'||(!Object.hasOwn(adSources,source)&&!Object.hasOwn(sources,source)))throw problem('Invalid notification state.',400);
 const ads=Object.hasOwn(adSources,source),label=ads?adSources[source]:sources[source],catalog=ads?adStates:states;
 if(!Object.hasOwn(catalog,code))throw problem('Invalid notification state.',400);
 const state=catalog[code];
 return {text:label+' '+state[0],severity:state[1]};
}
function validBatch(input){
 if(!only(input,['items'])||!Array.isArray(input.items)||!input.items.length||input.items.length>16)throw problem('Invalid notification batch.',400);
 const seen=new Set();
 return input.items.map(item=>{
  if(!only(item,['source','code'])||typeof item.source!=='string'||typeof item.code!=='string'||seen.has(item.source))throw problem('Invalid notification state.',400);
  definition(item.source,item.code);seen.add(item.source);
  return {source:item.source,code:item.code};
 });
}
function validDocument(doc){
 if(!only(doc,['version','states','items'])||doc.version!==1||!object(doc.states)||!Array.isArray(doc.items)||doc.items.length>200)throw problem('Notification storage is invalid.',503);
 try{
  for(const [source,code] of Object.entries(doc.states))definition(source,code);
  const ids=new Set(),seenSources=new Set();
  for(const item of doc.items){
   if(!only(item,['id','source','code','ts'])||typeof item.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)||ids.has(item.id)||typeof item.ts!=='string'||!Number.isFinite(Date.parse(item.ts)))throw Error('invalid');
   definition(item.source,item.code);ids.add(item.id);
   if(!seenSources.has(item.source)&&doc.states[item.source]!==item.code)throw Error('invalid');seenSources.add(item.source);
  }
 }catch{throw problem('Notification storage is invalid.',503);}
 return doc;
}
const view=doc=>doc.items.map(item=>({...item,...definition(item.source,item.code)}));

export function createAdminNotificationStore({read,write,now=()=>new Date().toISOString()}){
 const db=jsonStore({read,write}),empty=()=>({version:1,states:{},items:[]});
 const path=subject=>{
  if(typeof subject!=='string'||!subject||subject.length>200)throw problem('Invalid notification account.',400);
  return 'private/admin-notifications/'+Buffer.from(subject).toString('base64url')+'.json';
 };
 async function list(subject){return view(validDocument((await db.get(path(subject),empty())).value));}
 async function record(subject,input){
  const updates=validBatch(input),key=path(subject);
  for(let attempt=0;attempt<6;attempt++){
   const {value,generation}=await db.get(key,empty()),doc=validDocument(value);
   const changed=updates.filter(item=>doc.states[item.source]!==item.code);
   if(!changed.length)return view(doc);
   const ts=now();if(typeof ts!=='string'||!Number.isFinite(Date.parse(ts)))throw problem('Notification timestamp unavailable.',503);
   for(const {source,code} of changed){doc.states[source]=code;doc.items.unshift({id:randomUUID(),source,code,ts});}
   doc.items=doc.items.slice(0,200);
   try{await write(key,Buffer.from(JSON.stringify(doc)),'application/json',generation);return view(doc);}
   catch(error){if(error.status!==412)throw error;}
  }
  throw problem('Notification history is busy. Try again.',409);
 }
 return {list,record};
}
