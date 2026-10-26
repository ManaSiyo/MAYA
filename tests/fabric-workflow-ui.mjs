// Actual pages + real lookbook service, synthetic submissions and sellers only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
import {createFabricSearch} from '../docs/server/fabric-search.mjs';

const root=resolve(new URL('../',import.meta.url).pathname),png=readFileSync(root+'/aesthetics/ui/logo-circle.png');
const reference='data:image/png;base64,'+png.toString('base64');
const pieces=[{id:'coat',name:'Fur coat',fabric:'Brown faux fur',fabric_spec:{fiber:'acrylic',texture:'long pile'},_image:reference},{id:'pants',name:'Green alligator pants',fabric:'Green embossed leather',fabric_spec:{fiber:'leather'},_image:reference}];
const makeProduct=(slug,title,description,garmentId,garment)=>({url:'https://britexfabrics.com/products/'+slug,title,description,composition:description,merchant:'Britex Fabrics',image:'https://cdn.shopify.com/'+slug+'.png',evidence:'seller_listing',garmentId,garment});
const fur=makeProduct('brown-fur','Brown faux fur fabric','100% acrylic long pile. Sold by the yard.','coat','Fur coat');
const leather=makeProduct('green-leather','Green embossed leather fabric','Green alligator embossed leather. Sold by the yard.','pants','Green alligator pants');
const lining=makeProduct('cotton-lining','Ivory cotton lining','100% cotton fabric. Sold by the yard.','coat','Fur coat');
const extra=makeProduct('cotton-canvas','Brown cotton canvas','100% cotton canvas fabric. Sold by the yard.','coat','Fur coat');
const products=[fur,leather,lining,extra],records=new Map();
for(const id of ['project-A','project-B'])for(const [name,data] of [['submission.json',{}],['summary.json',{}],['pieces.json',{pieces}]])records.set('submissions/'+id+'/'+name,{buf:Buffer.from(JSON.stringify(data)),generation:'1'});
const read=async key=>records.has(key)?{ok:true,...records.get(key)}:{ok:false,status:404};
const write=async(key,buf,type,generation)=>{assert.equal(type,'application/json');assert.equal(String(records.get(key)?.generation||'0'),generation,'Every write uses the acknowledged generation');records.set(key,{buf,generation:String(Number(generation)+1)});};
const service=createFabricSearch({read,write,fetchImpl:async url=>{const p=products.find(p=>p.url===url);assert.ok(p,'Only fixture seller URLs are fetched');return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:p.title,description:p.description,material:p.composition,image:p.image,url:p.url,offers:{price:'25',priceCurrency:'USD',availability:'https://schema.org/InStock',url:p.url}})+'</script>');}});
const token=(sub,extra=0)=>'fixture.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+3600+extra})).toString('base64url')+'.fixture';
const user={sub:'owner-A'},searches=[],saves=[],errors=[];
let searchProducts=[fur,leather],holdCatalog=true,catalogRoutes=[],holdAck=false,releaseAck,failSave=false,holdBook=false,releaseBook;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH}),page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));
if(Number(process.env.MAYA_FABRIC_CPU_RATE)>1)await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.MAYA_FABRIC_CPU_RATE)});
await page.addInitScript(t=>localStorage.setItem('maya_admin_tok',t),token(user.sub));
await page.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.hostname==='cdn.shopify.com')return route.fulfill({body:png,contentType:'image/png'});
 if(url.hostname!=='maya-workflow.test')return route.abort();
 const body=request.postDataJSON();
 if(url.pathname==='/api/admin/fabrics/search'){searches.push(body);return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'done',products:searchProducts,message:'Fabrics found.'})+'\n'});}
 if(url.pathname==='/api/admin/fabrics/lookbook'){
  try{
   if(request.method()==='POST'){
    saves.push(body);if(failSave){failSave=false;return route.fulfill({status:503,json:{error:'Fixture save failed.'}});}
    const result=await service.saveBook(user,body);
    if(holdAck){holdAck=false;await new Promise(r=>releaseAck=r);}
    return route.fulfill({json:{ok:true,...result}});
   }
   const result=await service.loadBook(user,url.searchParams.get('submissionId'));
   if(holdBook){holdBook=false;await new Promise(r=>releaseBook=r);}
   return route.fulfill({json:{ok:true,...result}});
  }catch(e){return route.fulfill({status:e.status||500,json:{error:e.message}});}
 }
 if(url.pathname==='/aesthetics/fabrics/fabrics.json'&&holdCatalog){catalogRoutes.push(route);return;}
 if(url.pathname==='/api/admin/submissions')return route.fulfill({json:{folders:['project-A','project-B'].map(id=>({id,files:['summary.json','pieces.json','dream-garment.png'].map(name=>({id:id+'/'+name,name}))}))}});
 if(url.pathname==='/api/admin/subfile'){const id=url.searchParams.get('id'),record=records.get('submissions/'+id);return id.endsWith('.png')?route.fulfill({body:png,contentType:'image/png'}):route.fulfill({body:record.buf,contentType:'application/json',headers:{'X-Maya-Generation':record.generation,'Cache-Control':'private, no-store'}});}
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
 const path=url.pathname==='/backend.html'?'/backend/backend.html':url.pathname==='/operations.html'?'/backend/operations.html':url.pathname;
 try{return route.fulfill({body:readFileSync(root+decodeURIComponent(path)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
});
const seed=async(product,action='save')=>{const book=await service.loadBook(user,'project-A');return service.saveBook(user,{submissionId:'project-A',generation:book.generation,action,garmentId:product.garmentId,product});};
const favorites=async()=>{await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();await page.waitForLoadState('networkidle');};
const card=p=>page.locator('.fa-product').filter({has:page.locator('.fa-card-title',{hasText:p.title})});
const waitUntil=async predicate=>{for(let i=0;i<500&&!predicate();i++)await new Promise(r=>setTimeout(r,10));assert.ok(predicate());};
const open=async(options={})=>page.evaluate(({reference,pieces,options})=>MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,automatic:true,...options}),{reference,pieces,options});
try{
 await page.goto('https://maya-workflow.test/backend.html');await page.waitForFunction(()=>!!window.MayaFabricAssistant);
 await page.evaluate(({reference,pieces})=>{window._openedSubmission={id:'project-A'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:reference,card:{_dissection:{pieces}}};renderDissection({card:{image:reference,_dissection:{pieces}}});_publishSavedOperations({pieces});},{reference,pieces});
 await page.locator('#brief-fabrics-button').click();await card(fur).waitFor();
 assert.ok(catalogRoutes.length,'Catalog is still deliberately held');assert.equal(searches.length,1,'Sourceable starts without optional inventory');
 holdCatalog=false;await Promise.all(catalogRoutes.map(route=>route.fallback().catch(()=>{})));catalogRoutes=[];

 // Real browser request remains small even when saved piece images/patterns are large.
 const large=pieces.map(p=>({...p,_back:'data:image/png;base64,'+'A'.repeat(3_000_000),_pattern:'PRIVATE_PATTERN'.repeat(100_000)}));
 await open({pieces:large,piece:large[0],forceReset:true});
 const payload=searches.at(-1),bytes=Buffer.byteLength(JSON.stringify(payload));
 assert.ok(bytes<512*1024,'Metadata-only request, got '+bytes+' bytes');
 assert.ok(payload.pieces.every(p=>!Object.keys(p).some(key=>key.startsWith('_'))));assert.equal(payload.piece.id,'coat');assert.equal(JSON.stringify(payload).includes('PRIVATE_PATTERN'),false);

 // Existing books remain manageable; browsing never silently saves or selects.
 await seed(fur);await seed(leather);
 await open({piece:{},forceReset:true});assert.equal(await page.locator('.fa-card-actions').count(),0);
 assert.equal(saves.length,0,'No new writes from opening/searching');await favorites();holdAck=true;
 const startGeneration=(await service.loadBook(user,'project-A')).generation;
 await card(fur).getByRole('button',{name:'Remove',exact:true}).click();await waitUntil(()=>!!releaseAck);
 await card(leather).getByRole('button',{name:'Remove',exact:true}).click();await page.waitForTimeout(100);
 assert.equal(saves.length,1,'Second mutation waits for the first acknowledgement');releaseAck();releaseAck=null;
 await card(leather).waitFor({state:'detached'});
 assert.equal(saves.length,2);assert.equal(saves[0].generation,startGeneration);assert.equal(saves[1].generation,String(Number(startGeneration)+1));
 await seed(fur,'select');

 // Actual Operations picker/prompt cannot inherit coat material for pants.
 await page.goto('https://maya-workflow.test/operations.html?submission=project-A');await page.waitForFunction(()=>FILES.saved&&MayaFabricAssistant.selection(FILES.piece)?.garmentId==='coat');
 await page.locator('#test-picker').selectOption('Green alligator pants');
 assert.equal(await page.evaluate(()=>MayaFabricAssistant.selection(FILES.piece)),null);
 assert.doesNotMatch(await page.evaluate(()=>composeGroundedPrompt({type:'pants'},'pants',null,[])),/Brown faux fur|SELECTED FABRIC/);
 await seed(leather,'select');await page.locator('#operation-fabrics').click();await card(leather).waitFor();await page.waitForFunction(()=>MayaFabricAssistant.selection(FILES.piece)?.url.endsWith('/green-leather'));assert.equal(await page.locator('.fa-card-actions').count(),0);
 let book=await service.loadBook(user,'project-A');assert.equal(book.selectedByGarment.coat,fur.url);assert.equal(book.selectedByGarment.pants,leather.url);
 assert.match(await page.evaluate(()=>composeGroundedPrompt({type:'pants'},'pants',null,[])),/Green embossed leather/);
 await page.locator('#test-picker').selectOption('Fur coat');assert.equal(await page.evaluate(()=>MayaFabricAssistant.selection(FILES.piece)?.url),fur.url);
 await page.reload();await page.waitForFunction(()=>MayaFabricAssistant.selection(FILES.piece)?.garmentId==='coat');
 assert.match(await page.locator('#operation-fabric-selection').textContent(),/Brown faux fur/,'Reload shows the active garment selection, not the last global selection');
 assert.equal(await page.locator('#operation-fabric-selection').isVisible(),true);
 holdBook=true;await page.reload();await waitUntil(()=>!!releaseBook);
 await page.locator('#test-picker').selectOption('Green alligator pants');releaseBook();releaseBook=null;
 await page.waitForFunction(()=>MayaFabricAssistant.selection(FILES.piece)?.url.endsWith('/green-leather'));
 assert.match(await page.evaluate(()=>composeGroundedPrompt({type:'pants'},'pants',null,[])),/Green embossed leather/,'Switching during hydration preserves the saved fabric without opening Fabrics');

 // A pending Remove stays bound to its reviewed garment through same-project switching and renewal.
 await seed(lining);searchProducts=[lining];await open({piece:pieces[0],forceReset:true});await favorites();holdAck=true;
 await card(lining).getByRole('button',{name:'Remove',exact:true}).click();await waitUntil(()=>!!releaseAck);
 await page.evaluate(({piece,t})=>{MayaFabricAssistant.focusGarment(piece);localStorage.setItem('maya_admin_tok',t);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},{piece:pieces[1],t:token(user.sub,100)});
 releaseAck();releaseAck=null;await page.getByText('Removed.',{exact:true}).waitFor();
 book=await service.loadBook(user,'project-A');assert.ok(!book.items.some(p=>p.url===lining.url));assert.equal(await page.evaluate(piece=>MayaFabricAssistant.selection(piece)?.url, pieces[1]),leather.url);

 // Failed removals retain the saved fabric and remain explicitly retryable.
 await seed(extra);searchProducts=[extra];await open({piece:pieces[0],forceReset:true});await favorites();failSave=true;
 await card(extra).getByRole('button',{name:'Remove',exact:true}).click();await page.getByText('Fixture save failed.',{exact:true}).waitFor();
 assert.equal((await service.loadBook(user,'project-A')).items.some(p=>p.url===extra.url),true);
 await card(extra).getByRole('button',{name:'Remove',exact:true}).click();await card(extra).waitFor({state:'detached'});

 // A hung transport has a deadline; uncertain writes are reconciled, never replayed automatically.
 const stalled=makeProduct('stalled-fur','Stalled fur fabric','Brown acrylic fur fabric. Sold by the yard.','coat','Fur coat');products.push(stalled);searchProducts=[stalled];
 await seed(stalled);await open({piece:pieces[0],forceReset:true});await favorites();
 await page.evaluate(()=>{const native=AbortSignal.timeout;AbortSignal.timeout=ms=>{if(ms===15000){AbortSignal.timeout=native;return native.call(AbortSignal,150);}return native.call(AbortSignal,ms);};const original=window.fetch;window.fetch=(url,options)=>{if(String(url).endsWith('/fabrics/lookbook')&&options?.method==='POST'){window.fetch=original;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}return original(url,options);};});
 const attempts=saves.length;await card(stalled).getByRole('button',{name:'Remove',exact:true}).click();
 await page.getByText('Change not confirmed. Check Favorites before retrying.',{exact:true}).waitFor();
 await page.waitForTimeout(250);assert.equal(saves.length,attempts,'No automatic replay after an uncertain write');
 await card(stalled).getByRole('button',{name:'Remove',exact:true}).click();await card(stalled).waitFor({state:'detached'});

 // Switching submissions cancels unsent actions; the already accepted action remains in A.
 const late=makeProduct('late-fur','Late fur fabric','Brown acrylic faux fur fabric. Sold by the yard.','coat','Fur coat');
 const unsent=makeProduct('unsent-fur','Unsent fur fabric','Brown acrylic faux fur fabric. Sold by the yard.','coat','Fur coat');products.push(late,unsent);searchProducts=[late,unsent];
 await seed(late);await seed(unsent);await open({piece:pieces[0],forceReset:true});await favorites();holdAck=true;const before=saves.length;
 await card(late).getByRole('button',{name:'Remove',exact:true}).click();await waitUntil(()=>!!releaseAck);await card(unsent).getByRole('button',{name:'Remove',exact:true}).click();
 await page.waitForTimeout(250); // Exercise a slow interaction after the independent timeout probe.
 const acknowledgement=page.waitForResponse(response=>response.url().endsWith('/fabrics/lookbook')&&response.request().method()==='POST'&&response.request().postDataJSON().product.url===late.url);
 await open({submissionId:'project-B',piece:pieces[0],forceReset:true});releaseAck();releaseAck=null;
 await (await acknowledgement).finished();await page.waitForLoadState('networkidle');
 assert.equal(saves.length,before+1);assert.equal((await service.loadBook(user,'project-A')).items.some(p=>p.url===unsent.url),true);assert.equal((await service.loadBook(user,'project-B')).items.length,0);
 assert.equal(await page.evaluate(piece=>MayaFabricAssistant.selection(piece),pieces[0]),null);
 // Newly reachable saved/error states retain the same live typography authority.
 await page.evaluate(()=>MayaTypographyControls.ready);
 for(const mode of ['default','saved']){
  await page.evaluate(mode=>{const d=structuredClone(MayaTypographyControls.defaults);if(mode==='saved'){Object.assign(d.type.P1,{font:'cormorant',size:16,weight:450,color:'white'});d.pillX=22;d.pillY=10;}MayaTypographyControls.apply(d);},mode);
  await page.evaluate(()=>{document.querySelector('.fa-save-status').textContent='Change not confirmed. Check Favorites before retrying.';});
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),mode+' queued/save error fits '+width);
   const style=await page.locator('.fa-save-status').evaluate(el=>{const s=getComputedStyle(el);return {size:s.fontSize,font:s.fontFamily,weight:s.fontWeight};});
   assert.equal(style.size,mode==='saved'?'16px':'12px');assert.equal(style.weight,mode==='saved'?'450':'300');
   if(mode==='saved')assert.match(style.font,/Cormorant/);
   if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-fabric-save-'+mode+'-'+width+'.png'});
  }
 }
 // A slow/failed private photo must not delay public In House inventory.
 await page.evaluate(()=>{const native=window.fetch;window.releaseReference=null;window.fetch=(url,options)=>String(url).endsWith('/held-reference.png')?new Promise(resolve=>{window.releaseReference=()=>resolve(new Response('unavailable',{status:503,headers:{'Content-Type':'text/plain'}}));}):native(url,options);window.referenceOpen=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:'/held-reference.png',piece:{id:'coat'},automatic:true,forceReset:true});});
 await page.waitForFunction(()=>!!window.releaseReference);
 await page.locator('.fa-tabs').getByRole('button',{name:'In House',exact:true}).click();
 await page.locator('.fa-card-title').filter({hasText:'Midnight Velvet'}).waitFor();
 assert.equal(await page.locator('.fa-product').count(),8,'Inventory loads while reference conversion is still pending');
 await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();
 assert.doesNotMatch(await page.locator('.fa-results').textContent(),/No relevant|confirmed yet/,'Preparing a reference is not a completed empty search');
 await page.locator('.fa-tabs').getByRole('button',{name:'In House',exact:true}).click();
 await page.evaluate(async()=>{releaseReference();await referenceOpen;});
 assert.equal(await page.locator('.fa-product').count(),8,'Reference failure retains available inventory');
 // Closing while reference preparation is pending must not start a hidden paid search.
 const beforeClosedPreparation=searches.length;
 await page.evaluate(({reference,pieces})=>{
  const native=window.fetch;window.releaseClosedReference=null;
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/closing-reference.png'))return native(url,options);
   window.fetch=native;
   return new Promise(resolve=>window.releaseClosedReference=async()=>resolve(await native(reference)));
  };
  window.closedPreparation=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:'/closing-reference.png',pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces});
 await page.waitForFunction(()=>!!window.releaseClosedReference);
 await page.evaluate(async()=>{MayaFabricAssistant.close();await releaseClosedReference();await closedPreparation;});
 assert.equal(searches.length,beforeClosedPreparation,'A late photo cannot launch a search after leaving Fabrics');
 await open({piece:pieces[0]});await card(late).waitFor();
 assert.equal(searches.length,beforeClosedPreparation+1,'Explicit reopening can start a fresh visible search');
 // A terminal NDJSON result completes immediately, even if a proxy holds EOF.
 await page.evaluate(({reference,pieces,product})=>{
  const native=window.fetch;window.releaseFabricStream=null;
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/fabrics/search'))return native(url,options);
   window.fetch=native;
   return Promise.resolve(new Response(new ReadableStream({start(controller){
    window.releaseFabricStream=()=>{try{controller.close();}catch{}};
    controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'done',products:[product],message:'Confirmed fixture result.'})+'\n'));
   }}),{headers:{'Content-Type':'application/x-ndjson'}}));
  };
  window.terminalSearch=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces,product:fur});
 await page.getByText('Confirmed fixture result.',{exact:true}).waitFor();
 assert.equal(await page.locator('.fa-composer button[type=submit]').isDisabled(),false,'Done completes without waiting for stream EOF');
 await page.evaluate(async()=>{releaseFabricStream();await terminalSearch;});
 // Candidates remain inaccessible while the comparison is pending, including
 // a final products event followed by an interrupted stream without done.
 await page.evaluate(({reference,pieces,product})=>{
  const native=window.fetch;
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/fabrics/search'))return native(url,options);
   window.fetch=native;
   return Promise.resolve(new Response(new ReadableStream({start(controller){
    controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'products',preliminary:true,products:[product]})+'\n'));
    window.finishVisualReview=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'done',products:[],message:'No visual matches confirmed.'})+'\n'));controller.close();};
   }}),{headers:{'Content-Type':'application/x-ndjson'}}));
  };
  window.visualReview=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces,product:fur});
 await page.getByText('Retailer candidates. Photo comparison pending…',{exact:true}).waitFor();
 assert.equal(await page.locator('.fa-product-link').count(),0,'Unreviewed retailer candidates are not actionable');
 for(const mode of ['default','saved']){
  await page.evaluate(mode=>{const d=structuredClone(MayaTypographyControls.defaults);if(mode==='saved')Object.assign(d.type.P1,{font:'cormorant',size:16,weight:450,color:'white'});MayaTypographyControls.apply(d);},mode);
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});
   const style=await page.locator('.fa-empty').evaluate(el=>{const s=getComputedStyle(el);return {size:s.fontSize,color:s.color};});
   assert.equal(style.size,mode==='saved'?'16px':'12px');assert.equal(style.color,mode==='saved'?'rgb(255, 255, 255)':'rgb(170, 181, 196)');
   assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Pending search fits '+mode+' '+width);
   if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-fabric-pending-'+mode+'-'+width+'.png'});
  }
 }
 await page.evaluate(async()=>{finishVisualReview();await visualReview;});
 assert.equal(await page.locator('.fa-product-link').count(),0,'A rejected visual match never appears as a product link');
 // Provisional retailer candidates cannot survive a truncated visual review as confirmed matches.
 await page.evaluate(({reference,pieces,product})=>{
  const native=window.fetch;
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/fabrics/search'))return native(url,options);
   window.fetch=native;return Promise.resolve(new Response(JSON.stringify({type:'products',preliminary:true,products:[product]})+'\n',{headers:{'Content-Type':'application/x-ndjson'}}));
  };
  return MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces,product:fur});
 await page.getByText('Search ended early. You can retry your request.',{exact:true}).waitFor();
 assert.equal(await page.locator('.fa-product').count(),0,'Interrupted search clears unconfirmed candidates');
 assert.doesNotMatch(await page.locator('.fa-results').textContent(),/No relevant|confirmed yet/,'Transport failure is not an honest completed no-match result');
 // A queued close notification from the previous dialog cannot cancel a reopened search.
 await page.evaluate(({reference,pieces,product})=>{
  const native=window.fetch;window.finishReopenedStream=null;
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/fabrics/search'))return native(url,options);window.fetch=native;
   window.reopenedSearchSignal=options.signal;
   return Promise.resolve(new Response(new ReadableStream({start(controller){
    window.finishReopenedStream=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'done',products:[product],message:'Reopened result.'})+'\n'));controller.close();};
    options.signal.addEventListener('abort',()=>controller.error(options.signal.reason),{once:true});
   }}),{headers:{'Content-Type':'application/x-ndjson'}}));
  };
  window.reopenedSearch=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces,product:fur});
 await page.waitForFunction(()=>!!window.finishReopenedStream);
 await page.evaluate(()=>document.getElementById('fabric-assistant-dialog').dispatchEvent(new Event('close')));
 assert.equal(await page.evaluate(()=>reopenedSearchSignal.aborted),false,'Queued close for a prior opening must not abort the active stream');
 assert.equal(await page.locator('#fabric-assistant-dialog').getAttribute('open'),'');
 await page.evaluate(async()=>{finishReopenedStream();await reopenedSearch;});await card(fur).waitFor();
 // The same deadline covers a stream that started but stopped producing data.
 await page.evaluate(({reference,pieces,product})=>{
  const nativeTimeout=AbortSignal.timeout,nativeFetch=window.fetch;
  AbortSignal.timeout=ms=>{if(ms===60000){AbortSignal.timeout=nativeTimeout;return nativeTimeout.call(AbortSignal,150);}return nativeTimeout.call(AbortSignal,ms);};
  window.fetch=(url,options)=>{
   if(!String(url).endsWith('/fabrics/search'))return nativeFetch(url,options);
   window.fetch=nativeFetch;
   return Promise.resolve(new Response(new ReadableStream({start(controller){
    controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'products',preliminary:true,products:[product]})+'\n'));
    if(options.signal.aborted)controller.error(options.signal.reason);else options.signal.addEventListener('abort',()=>controller.error(options.signal.reason),{once:true});
   }}),{headers:{'Content-Type':'application/x-ndjson'}}));
  };
  window.partialSearch=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});
 },{reference,pieces,product:fur});
 try{await page.getByText('Search timed out. Refresh to retry.',{exact:true}).waitFor();}catch(error){console.error('Partial-stream fixture state:',await page.locator('#fabric-assistant').innerText());throw error;}
 await page.evaluate(()=>partialSearch);
 assert.equal(await page.locator('.fa-product').count(),0,'Timed-out streams remove provisional candidates');
 await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await card(late).waitFor();
 assert.equal(await page.locator('.fa-status').textContent(),'Fabrics found.','Explicit Refresh recovers without a stuck busy flag');
 // A stalled read-only search has its own deadline and never resends itself.
 await page.evaluate(({reference,pieces})=>{const nativeTimeout=AbortSignal.timeout;AbortSignal.timeout=ms=>ms===60000?nativeTimeout.call(AbortSignal,150):nativeTimeout.call(AbortSignal,ms);const nativeFetch=window.fetch;window.fabricTimeoutAttempts=0;window.fetch=(url,options)=>{if(String(url).endsWith('/fabrics/search')){fabricTimeoutAttempts++;if(options.signal.aborted)return Promise.reject(options.signal.reason);return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}return nativeFetch(url,options);};window.timeoutSearch=MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,pieces,piece:pieces[0],automatic:true,forceReset:true});},{reference,pieces});
 await page.getByText('Search timed out. Refresh to retry.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fabricTimeoutAttempts),1);assert.match(await page.locator('.fa-empty').textContent(),/not completed/i,'Timeout is distinguished from a completed no-match search');assert.equal(await page.locator('.fa-composer button[type=submit]').isDisabled(),false);
 // Loading/error copy uses the existing P1 authority under both saved and default designs.
 for(const mode of ['default','saved']){
  await page.evaluate(mode=>{const d=structuredClone(MayaTypographyControls.defaults);if(mode==='saved')Object.assign(d.type.P1,{font:'cormorant',size:16,weight:450,color:'white'});MayaTypographyControls.apply(d);},mode);
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});
   const style=await page.locator('.fa-empty').evaluate(el=>{const s=getComputedStyle(el);return {size:s.fontSize,color:s.color,font:s.fontFamily};});
   assert.equal(style.size,mode==='saved'?'16px':'12px');assert.equal(style.color,mode==='saved'?'rgb(255, 255, 255)':'rgb(170, 181, 196)');if(mode==='saved')assert.match(style.font,/Cormorant/);
   assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Interrupted search fits '+mode+' '+width);
   if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-fabric-interrupted-'+mode+'-'+width+'.png'});
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Fabric workflow: bounded metadata ('+bytes+' bytes), independent inventory, queued/CAS historical-favorite removals, retry, per-garment material/prompt/reload, renewal and submission cancellation passed. Synthetic records only.');
}finally{for(const route of catalogRoutes)await route.abort().catch(()=>{});releaseAck?.();releaseBook?.();await browser.close();}
