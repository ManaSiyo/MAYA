import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const server=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const extract=(start,end)=>server.slice(server.indexOf(start),server.indexOf(end,server.indexOf(start)));
const response=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
let stored={ok:false,status:404},writes=0;
const routes=new Map(),ctx={app:{post:(path,...args)=>routes.set(path,args.at(-1))},requireAuthHeader(){},express:{json:()=>()=>{}},requireGoogleUser:async()=>({sub:'owner',email:'owner@example.com'}),rateLimit:()=>({ok:true}),console:{log(){},warn(){},error(){}},gcsGet:async()=>stored,gcsPut:async()=>{writes++;},SUBMISSIONS_BUCKET:'fake',SUB_PREFIX:'submissions/',SUB_ID:/^[A-Za-z0-9_-]{3,120}$/,Buffer,b64ToBytes:s=>Buffer.from(s,'base64'),pathToId:s=>s,_subsCache:{}};
runInNewContext(extract('const _subOwners =','let _svcTok ='),ctx);
runInNewContext(extract("app.post('/api/submit'",'// THE SUBMISSION STORE'),ctx);
const upload={body:{action:'upload',folder_id:'client-project',name:'summary.json',data_b64:'e30=',mime_type:'application/json'}};
for(const value of [{ok:false,status:404},{ok:false,status:503},{ok:true,buf:Buffer.from('{')},{ok:true,buf:Buffer.from('{}')},{ok:true,buf:Buffer.from('{"openedBy":42}')},{ok:true,buf:Buffer.from('{"openedBy":"other@example.com"}')}]){
  stored=value;const res=response();await routes.get('/api/submit')(upload,res);assert.ok([403,503].includes(res.code));assert.equal(writes,0);
}
// A failed read was never negatively cached; a repaired marker is read again.
stored={ok:true,buf:Buffer.from('{"openedBy":"OWNER@example.com"}')};
const owned={...upload,body:{...upload.body,folder_id:'repaired-project'}};
stored={ok:false,status:503};await routes.get('/api/submit')(owned,response());
stored={ok:true,buf:Buffer.from('{"openedBy":"OWNER@example.com"}')};const accepted=response();await routes.get('/api/submit')(owned,accepted);assert.equal(accepted.body.ok,true);assert.equal(writes,1);

const pages=[],listCtx={serviceToken:async()=> 'fake',STORAGE_SCOPE:'fake',SUB_PREFIX:'submissions/',SUBMISSIONS_BUCKET:'fake',URLSearchParams,AbortSignal,fetch:async url=>{
  const token=new URL(url).searchParams.get('pageToken');pages.push(token);return {ok:true,json:async()=>token?{items:[{name:'submissions/z-new/submission.json',timeCreated:'2026-10-07'}]}:{items:[{name:'submissions/a-old/submission.json',timeCreated:'2020-01-01'}],nextPageToken:'second'}};
}};
runInNewContext(extract('async function gcsListSubmissions()', '// THE CREDIT METER'),listCtx);
const items=await listCtx.gcsListSubmissions();assert.equal(items.length,2);assert.deepEqual(pages,[null,'second']);assert.equal(items.sort((a,b)=>b.timeCreated.localeCompare(a.timeCreated))[0].name,'submissions/z-new/submission.json');
listCtx.fetch=async()=>({ok:true,json:async()=>({items:[],nextPageToken:'stuck'})});await assert.rejects(listCtx.gcsListSubmissions(),/did not advance/);

let creates=0,saveMode='fail';const invoiceRoutes=new Map(),invoiceContext={app:{post:(path,...args)=>invoiceRoutes.set(path,args.at(-1))},requireAuthHeader(){},express:{json:()=>()=>{}},requireAdmin:async()=>({sub:'owner',email:'owner@example.com'}),rateLimit:()=>({ok:true}),console:{log(){},error(){}},WIX_KEY:'fake',WIX_SITE:'fake',INVOICE_TAX_GROUP:'fake',INVOICE_FALLBACK_IMAGE:{},AbortSignal,_leadsCache:{},updateLead:async()=>{if(saveMode==='fail')throw Error('storage unavailable');return saveMode==='missing'?null:{ok:true};},fetch:async()=>{creates++;return {ok:true,json:async()=>({paymentLink:{id:'existing-provider-link',links:{url:{url:'https://example.com/pay'}}}})};}};
runInNewContext(extract("app.post('/api/admin/invoice-create'", '// ── v13.82: WHO MAYA KNOWS'),invoiceContext);
for(const mode of ['fail','missing','saved']){
  saveMode=mode;const res=response();await invoiceRoutes.get('/api/admin/invoice-create')({body:{leadId:'m_fixture',title:'Reviewed invoice',price:'120'}},res);
  assert.equal(res.body.ok,true);assert.equal(res.body.url,'https://example.com/pay');assert.equal(res.body.linkId,'existing-provider-link');assert.equal(res.body.saved,mode==='saved');if(mode!=='saved')assert.ok(res.body.saveError);
}
assert.equal(creates,3,'One create per request; persistence handling never recreates the provider artifact');

let addOptions;
const addRoutes=new Map(),addContext={...invoiceContext,app:{post:(path,...args)=>addRoutes.set(path,args.at(-1))},appendManualLead:async(lead,options)=>{addOptions=options;return {id:'m_saved',name:lead.name};}};
runInNewContext(extract("app.post('/api/admin/lead-add'","app.post('/api/admin/lead-update'"),addContext);
const added=response();await addRoutes.get('/api/admin/lead-add')({body:{name:'Reviewed lead',uid:'attacker',requestId:'approved-request-00001'}},added);
assert.equal(added.body.ok,true);assert.equal(addOptions.uid,'owner');assert.equal(addOptions.requestId,'approved-request-00001');
console.log('Admin storage: upload ownership fails closed, listing paginates completely and invoice creation preserves URLs with truthful save outcomes.');
