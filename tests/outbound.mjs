import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountOutbound,rowsToContacts,contact,domain,mergeContacts} from '../docs/server/outbound.mjs';
import {chatBody,TEXT_MODEL,IMAGE_MODEL} from '../docs/server/model-config.mjs';
import {evaluateProxyPolicy} from '../docs/server/proxy-policy.mjs';
const handlers=new Map(),store=new Map();let user='owner',failWrite=false,conflict=false,providerCalls=0,failSheet=false,sheetName='Sheet Person';
mountOutbound({get:(p,h)=>handlers.set('GET '+p,h),post:(p,h)=>handlers.set('POST '+p,h)},{requireAdmin:async()=>{if(!user)throw Error('unauthorized');return{sub:user};},allow:()=>true,read:async key=>store.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(store.get(key).data)),generation:String(store.get(key).version)}:{ok:false,status:404},write:async(key,buf,type,generation)=>{if(failWrite)throw Error('storage');if(conflict){conflict=false;throw Object.assign(Error('conflict'),{status:412});}assert.equal(String(store.get(key)?.version||0),generation);store.set(key,{data:JSON.parse(buf),version:Number(generation)+1});},hunterKey:'fake',aiReady:true,model:TEXT_MODEL,fetch:async()=>{providerCalls++;return {ok:true,json:async()=>({data:{organization:'Example',emails:[{value:'a@example.com',first_name:'A',verification:{status:'valid'}}]}})};},sheetTabs:async()=>['Principles','9/23 Ceremonial','9/23 Corporates','9/23 Fashion Houses'],sheetRows:async(_,range)=>{if(failSheet&&range.includes('Corporates'))throw Error('sheet unavailable');return [['Name','Email','Notes'],[sheetName,'sheet@example.com',sheetName]];},draft:async()=>({subject:'Hello',body:'An introduction'}),research:async()=> 'Evidence and sources'});
async function call(path='',body){let status=200,data;const req={method:body?'POST':'GET',body};const res={set:()=>{},status:n=>{status=n;return res;},json:v=>{data=v;return res;}};await handlers.get(req.method+' /api/admin/outbound'+path)(req,res);return {status,...data};}
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('ok '+name);};
await test('unauthenticated reads denied',async()=>{user='';assert.equal((await call()).status,401);user='owner';});
await test('new workspace has no fabricated contacts',async()=>assert.equal((await call()).state.contacts.length,0));
let campaignId,personId;
await test('create campaign',async()=>{const j=await call('/save',{type:'campaign',name:'Boutiques',audience:'San Francisco'});assert.equal(j.status,200);campaignId=j.state.campaigns[0].id;});
await test('import deduplicates normalized email within campaign',async()=>{const rows=[['Name','Email'],['A','A@EXAMPLE.COM'],['A','a@example.com']];const j=await call('/save',{type:'import',campaignId,rows});assert.equal(j.result,1);personId=j.state.contacts[0].id;});
await test('unknown campaign rejected without write',async()=>assert.equal((await call('/save',{type:'import',campaignId:'missing',contact:{name:'B'}})).status,400));
await test('account isolation',async()=>{user='other';assert.equal((await call()).state.contacts.length,0);assert.equal((await call('/save',{type:'contact',id:personId,stage:'closed'})).status,404);user='owner';});
await test('paid lookup requires explicit confirmation',async()=>{assert.equal((await call('/hunter',{action:'domain',domain:'example.com',campaignId})).status,400);assert.equal(providerCalls,0);});
await test('Hunter results are deduplicated against imports',async()=>{const j=await call('/hunter',{action:'domain',domain:'example.com',campaignId,confirm:true});assert.equal(j.result,0);assert.equal(providerCalls,1);});
await test('draft is reviewable and never silently persisted',async()=>{const j=await call('/draft',{id:personId,confirm:true});assert.equal(j.draft.subject,'Hello');assert.equal((await call()).state.contacts[0].body,'');});
await test('suppressed contacts cannot draft',async()=>{await call('/save',{type:'contact',id:personId,stage:'suppressed'});assert.equal((await call('/draft',{id:personId,confirm:true})).status,400);});
await test('suppression follows duplicate emails across campaigns',async()=>{const j=await call('/save',{type:'campaign',name:'Another segment'});const other=j.state.campaigns.at(-1).id;const imported=await call('/save',{type:'import',campaignId:other,contact:{email:'a@example.com'}});assert.equal(imported.state.contacts.at(-1).stage,'suppressed');});
await test('invalid stage rejected',async()=>assert.equal((await call('/save',{type:'contact',id:personId,stage:'spam'})).status,400));
await test('storage failure is reported',async()=>{failWrite=true;assert.equal((await call('/save',{type:'contact',id:personId,notes:'lost'})).status,502);failWrite=false;assert.notEqual((await call()).state.contacts[0].notes,'lost');});
await test('CAS conflict retries safe mutation',async()=>{conflict=true;assert.equal((await call('/save',{type:'contact',id:personId,notes:'saved'})).status,200);});
await test('Sheet config and import',async()=>{await call('/save',{type:'settings',sheetId:'https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwx/edit',tab:'Prospects'});const j=await call('/sheets',{campaignId});assert.equal(j.result,1);});
await test('research requires confirmation',async()=>{assert.equal((await call('/research',{campaignId})).status,400);assert.equal((await call('/research',{campaignId,confirm:true})).research,'Evidence and sources');});
await test('domain rejects URL credentials and local addresses',()=>{for(const d of ['localhost','127.0.0.1','https://u:p@example.com','example.com?x=1'])assert.throws(()=>domain(d));assert.equal(domain('https://example.com/path'),'example.com');});
await test('CSV mapper rejects malformed rows',()=>{assert.throws(()=>rowsToContacts([['Email'],['bad']]));assert.throws(()=>rowsToContacts([['unknown'],['bad']]));assert.equal(contact({name:'X'}).verification,'unverified');});
await test('owner sheet headers, summaries and historical outreach survive import',()=>{
  const corporate=rowsToContacts([['Corporate outreach','Messages sent'],['Sept','101'],['Company','Contact','Email address','Role','Email subject / thread','Status'],['Example','Person','person@example.com','Director','Hello','Sent']])[0];
  assert.equal(corporate.name,'Person');assert.equal(corporate.title,'Director');assert.equal(corporate.subject,'Hello');assert.equal(corporate.stage,'contacted');
  const historical=rowsToContacts([['Full Name','Email','Status','Current Signal','Hunter Status'],['Person','per...@example.com','1st touch, no reply','Hiring','Valid']])[0];
  assert.equal(historical.email,'');assert.equal(historical.verification,'unverified');assert.match(historical.notes,/Current Signal: Hiring/);assert.match(historical.notes,/incomplete/);
  assert.equal(rowsToContacts([['Email','Status'],['a@example.com','Not sent']])[0].stage,'new');
  assert.equal(rowsToContacts([['Email','Status'],['a@example.com','Bounced']])[0].stage,'suppressed');
  assert.throws(()=>rowsToContacts([['Sales Framework','Principle'],['Framework','Rule']]));
});
await test('Luna compatibility removes unsupported knobs and preserves tool contract',()=>{const b=chatBody({temperature:.2,max_tokens:50,tools:[{type:'function'}]});assert.equal(b.model,'gpt-6-luna');assert.equal(b.reasoning_effort,'none');assert.equal(b.max_completion_tokens,50);assert.equal(b.temperature,undefined);assert.equal(b.tools.length,1);});
await test('shared Luna roles remain usable by clients; image quality gates remain',()=>{const models={TERRA:TEXT_MODEL,LUNA:TEXT_MODEL,SOL:TEXT_MODEL,upgrades:{'gpt-4.1':TEXT_MODEL}};const ev=(path,body)=>evaluateProxyPolicy({method:'POST',upstreamPath:path,contentType:'application/json',body:Buffer.from(JSON.stringify(body)),models});const routed=ev('v1/chat/completions',{model:'gpt-4.1',tools:[]});assert.equal(routed.ok,true);assert.equal(JSON.parse(routed.fallback).model,'gpt-4o-mini');assert.equal(ev('v1/images/generations',{model:IMAGE_MODEL,quality:'medium'}).ok,true);for(const quality of ['high','xhigh','max'])assert.equal(ev('v1/images/generations',{model:IMAGE_MODEL,quality}).ok,false);});
await test('CSV preserves quoted commas, newlines and quotes',()=>{
  const source=readFileSync(new URL('../backend/outbound.js',import.meta.url),'utf8');
  const csv=source.slice(source.indexOf('export function parseCSV'),source.indexOf('function exportCSV')).replace('export ','');
  const ctx=vm.createContext({});vm.runInContext(csv,ctx);
  const rows=ctx.parseCSV('Name,Notes\n"A, B","Line 1\nLine 2"');assert.equal(rows[1][0],'A, B');assert.equal(rows[1][1],'Line 1\nLine 2');
  assert.throws(()=>ctx.parseCSV('Name\n"unfinished'));
});
await test('reimported bounce suppresses existing contacts across campaigns',()=>{
  const state={campaigns:[{id:'a'},{id:'b'}],contacts:[{id:'x',campaignId:'a',email:'a@example.com',stage:'contacted'},{id:'y',campaignId:'b',email:'a@example.com',stage:'ready'}]};
  assert.equal(mergeContacts(state,rowsToContacts([['Email','Status'],['a@example.com','Bounced']]),'a'),0);
  assert.ok(state.contacts.every(c=>c.stage==='suppressed'));
});
await test('draft navigation guards detect changes and respect cancellation',()=>{
  const source=readFileSync(new URL('../backend/outbound.js',import.meta.url),'utf8');
  const fields={body:{value:'saved'},subject:{value:'Hello'},notes:{value:''},stage:{value:'new'}};
  const ctx=vm.createContext({state:{contacts:[{id:'one',body:'saved',subject:'Hello',notes:'',stage:'new'}]},selected:'one',$:id=>fields[id],confirm:()=>false});
  vm.runInContext(source.slice(source.indexOf('function hasUnsavedDraft'),source.indexOf("window.addEventListener('beforeunload'")),ctx);
  assert.equal(ctx.hasUnsavedDraft(),false);fields.body.value='edited';assert.equal(ctx.hasUnsavedDraft(),true);assert.equal(ctx.leaveDraft(),false);
  fields.body.value='saved';assert.equal(ctx.leaveDraft(),true);
});
await test('campaign pain and qualification criteria persist',async()=>{
 const j=await call('/save',{type:'campaign',id:campaignId,name:'Boutiques',pain:'Slow sampling',criteria:'Small design-led brands'});
 const c=j.state.campaigns.find(c=>c.id===campaignId);assert.equal(c.pain,'Slow sampling');assert.equal(c.criteria,'Small design-led brands');
});
await test('workbook sync creates three campaigns, preserves drafts and is idempotent',async()=>{
 const j=await call('/sheets/sync',{});assert.equal(j.status,200);assert.equal(j.result.length,3);
 const campaigns=j.state.campaigns.filter(c=>c.sheetTab);assert.equal(campaigns.length,3);
 const p=j.state.contacts.find(p=>p.campaignId===campaigns[0].id);
 await call('/save',{type:'contact',id:p.id,body:'Owner draft',stage:'replied'});
 const next=await call('/sheets/sync',{});assert.ok(next.result.every(r=>r.added===0));
 assert.equal(next.state.contacts.find(x=>x.id===p.id).body,'Owner draft');
 assert.equal(next.state.contacts.find(x=>x.id===p.id).stage,'replied');
 user='isolated';assert.equal((await call('/sheets/sync',{})).status,400);assert.equal((await call()).state.contacts.length,0);user='owner';
});
await test('failed workbook tab leaves all stored campaigns unchanged',async()=>{
 const before=JSON.stringify((await call()).state);failSheet=true;
 assert.equal((await call('/sheets/sync',{})).status,502);failSheet=false;
 assert.equal(JSON.stringify((await call()).state),before);
});
await test('source edits refresh untouched fields and preserve local edits',async()=>{
 const current=(await call()).state, c=current.campaigns.find(c=>c.sheetTab), p=current.contacts.find(p=>p.campaignId===c.id);
 sheetName='Updated source name';let j=await call('/sheets/sync',{});
 assert.equal(j.state.contacts.find(x=>x.id===p.id).name,sheetName);
 await call('/save',{type:'contact',id:p.id,notes:'Local notes'});sheetName='Another source name';
 j=await call('/sheets/sync',{});assert.equal(j.state.contacts.find(x=>x.id===p.id).notes,'Local notes');
});
console.log(`${checks} outbound/model checks passed. No live providers called.`);
