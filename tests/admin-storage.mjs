import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const server=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const extract=(start,end)=>server.slice(server.indexOf(start),server.indexOf(end,server.indexOf(start)));
const response=()=>({code:200,headers:{},status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(key,value){this.headers[key]=value;},end(body){this.body=body;}});
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

// The actual route must never acknowledge two stale full-document replacements.
const piecePath='submissions/reviewed-project/pieces.json',markerPath='submissions/reviewed-project/submission.json',pieceRoutes=new Map();
const documents=new Map([[markerPath,{ok:true,buf:Buffer.from('{}'),generation:'1',type:'application/json'}]]);
let pieceWrites=0,unconfirmed=false,failedRead='';
const pieceContext={...ctx,app:{post:(path,...args)=>pieceRoutes.set(path,args.at(-1)),get:(path,...args)=>pieceRoutes.set(path,args.at(-1))},requireAdmin:async()=>({sub:'owner'}),idToPath:id=>id.startsWith('submissions/')?id:null,
 gcsGet:async path=>path===failedRead?{ok:false,status:503}:documents.get(path)||{ok:false,status:404},
 gcsPut:async(path,buf,type,generation)=>{
  assert.equal(typeof generation,'string','Every dissection write has a storage generation precondition');
  if(generation!==(documents.get(path)?.generation||'0'))throw Object.assign(Error('conflict'),{status:412});
  pieceWrites++;const next=String(Number(generation)+1);documents.set(path,{ok:true,buf,generation:next,type});return unconfirmed?{}:{generation:next};
 }};
runInNewContext(extract('function validDissection(', '\nmountFabricSearch('),pieceContext);
runInNewContext(extract("app.get('/api/admin/subfile'", '// POST /api/admin/savepieces'),pieceContext);
const savePieces=async(data,generation)=>{const res=response();await pieceRoutes.get('/api/admin/savepieces')({body:{folderId:'reviewed-project',data,generation}},res);return res;};
const base={pieces:[{id:'coat',name:'Coat',fabric:'wool'}]};
for(const generation of [undefined,null,0,'','garbled'])assert.equal((await savePieces(base,generation)).code,428);
for(const data of [{},[],{pieces:[null]},{pieces:[{name:'Coat'}]},{pieces:[{id:'coat'},{id:'coat'}]},{pieces:[{id:'coat',_pattern:{invalid:true}}]}])assert.equal((await savePieces(data,'0')).code,400);
assert.equal(pieceWrites,0);
const initial=await savePieces(base,'0');assert.equal(initial.body.ok,true);assert.equal(initial.body.generation,'1');
const [patternSave,imageSave]=await Promise.all([savePieces({pieces:[{...base.pieces[0],_pattern:'reviewed pattern'}]},'1'),savePieces({pieces:[{...base.pieces[0],_image:'stale tab image'}]},'1')]);
assert.deepEqual([patternSave.code,imageSave.code].sort(),[200,409]);assert.equal(pieceWrites,2);
const acceptedDocument=documents.get(piecePath).buf.toString();assert.match(acceptedDocument,/reviewed pattern/);
assert.equal((await savePieces(base,'0')).code,409);assert.equal(documents.get(piecePath).buf.toString(),acceptedDocument,'Stale first-save claims cannot erase existing work');
const healthy=documents.get(piecePath),before=pieceWrites;
for(const broken of [{ok:true,buf:Buffer.from('{'),generation:'2'},{ok:true,buf:Buffer.from('{}'),generation:'2'},{ok:true,buf:Buffer.from(JSON.stringify(base))}]){
 documents.set(piecePath,broken);assert.equal((await savePieces(base,'2')).code,503);assert.equal(pieceWrites,before);
}
documents.set(piecePath,healthy);failedRead=piecePath;assert.equal((await savePieces(base,'2')).code,503);failedRead=markerPath;assert.equal((await savePieces(base,'2')).code,503);failedRead='';
documents.delete(markerPath);assert.equal((await savePieces(base,'2')).code,404);documents.set(markerPath,{ok:true,buf:Buffer.from('{}')});
assert.equal(pieceWrites,before);
const fileResponse=response();await pieceRoutes.get('/api/admin/subfile')({query:{id:piecePath}},fileResponse);assert.equal(fileResponse.headers['Cache-Control'],'private, no-store');assert.equal(fileResponse.headers['X-Maya-Generation'],'2');assert.equal(fileResponse.body,healthy.buf);
documents.set(piecePath,{...healthy,buf:Buffer.from(JSON.stringify({pieces:[{name:'Legacy coat',_pattern:'old retained pattern'}]}))});
const legacySave=await savePieces({pieces:[{id:'garment-stable',name:'Legacy coat',_pattern:'old retained pattern'}]},'2');assert.equal(legacySave.body.generation,'3','A reviewed legacy document can gain IDs on an explicit save');
unconfirmed=true;const uncertain=await savePieces(base,'3');assert.equal(uncertain.code,503);assert.equal(uncertain.body.error,'save_unconfirmed');assert.equal(uncertain.body.ok,undefined);
const sizeWrites=pieceWrites;assert.equal((await savePieces({pieces:[{...base.pieces[0],_pattern:'é'.repeat(13*1024*1024)}]},'4')).code,413);assert.equal(pieceWrites,sizeWrites);
console.log('Admin storage: upload ownership, complete listing, truthful invoices and generation-checked dissection saves/cache headers passed.');
