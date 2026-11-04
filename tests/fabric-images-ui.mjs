// Real fabric UI and fake browser/image responses; no owner Chrome or live service.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(new URL('../',import.meta.url).pathname),origin='https://fabric-images.test';
const png=readFileSync(resolve(root,'aesthetics/ui/logo-circle.png'));
const reference='data:image/png;base64,'+png.toString('base64');
const token=sub=>'fixture.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const errors=[],imageRequests=[],apiRequests=[],foreignRequests=[];
let goodImages=true,holdImage='',heldImage=null,repairBadA=false;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(value=>{localStorage.setItem('maya_admin_tok',value);window.setInterval=()=>0;},token('image-owner-A'));
await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='fabric-cdn.example'){
  imageRequests.push(u.href);
  if(u.pathname===holdImage){heldImage=route;return;}
  return goodImages&&(u.pathname.startsWith('/good')||(repairBadA&&u.pathname==='/bad-a.jpg'))?route.fulfill({body:png,contentType:'image/png'}):route.fulfill({status:404,body:'Missing fixture image'});
 }
 if(u.origin!==origin){foreignRequests.push(u.href);return route.abort();}
 if(u.pathname==='/fixture.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/aesthetics/ui/fabric-assistant.css"><script src="/aesthetics/ui/fabric-search-details.js"></script><script src="/aesthetics/ui/fabric-assistant.js"></script></head><body><div id="host" style="width:900px;height:720px"></div></body></html>'});
 if(u.pathname.startsWith('/api/')){apiRequests.push({path:u.pathname,method:route.request().method()});assert.equal(route.request().method(),'GET','Photograph fallback performs no server or provider mutations');return route.fulfill({json:{ok:true,items:[],generation:'0'}});}
 if(u.pathname==='/aesthetics/fabrics/fabrics.json')return route.fulfill({json:{items:[]}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.css':'text/css','.js':'text/javascript'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const product={url:'https://fabric-shop.example/products/green-woven-fabric',title:'Forest green woven fabric',merchant:'fabric-shop.example',materialLabel:'Green body cloth',evidence:'web_suggestion',image:'https://fabric-cdn.example/bad-thumbnail.jpg',imageCandidates:['https://fabric-cdn.example/bad-thumbnail.jpg','https://fabric-cdn.example/good-canonical.jpg']};
const emit=event=>page.evaluate(event=>fixtureStreams.at(-1).enqueue(new TextEncoder().encode(JSON.stringify(event)+'\n')),event);
const publish=products=>emit({type:'products',incremental:true,preliminary:false,products});
const done=products=>emit({type:'done',products,observation:'Green body cloth; exact fiber is unknown.',message:'Source-backed fabric suggestions.'});
const loaded=selector=>page.waitForFunction(selector=>{const image=document.querySelector(selector);return image?.complete&&image.naturalWidth>0;},selector,{timeout:5000});
try{
 await page.goto(origin+'/fixture.html');await page.waitForFunction(()=>window.MayaFabricAssistant);
 await page.evaluate(()=>{const native=window.fetch;window.fixtureStreams=[];window.fixtureSearches=0;window.fetch=async(url,options)=>{if(String(url)==='/api/admin/fabrics/search'){fixtureSearches++;const stream=new ReadableStream({start(controller){fixtureStreams.push(controller);}});return new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}});}return native(url,options);};});
 await page.evaluate(reference=>{window.fixtureOpen=MayaFabricAssistant.open({host:document.getElementById('host'),submissionId:'image-project',referenceImage:reference,automatic:true,piece:{id:'coat',name:'Green coat',fabric:'Green woven cloth'},pieces:[{id:'coat',name:'Green coat',fabric:'Green woven cloth'}]});},reference);
 await page.waitForFunction(()=>fixtureStreams.length===1);
 const empty={...product,url:product.url+'-empty',title:'Green fabric source without photograph',image:'',imageCandidates:[]};
 await publish([empty]);await page.locator('.fa-image-unavailable').waitFor({state:'attached'});
 await page.evaluate(()=>{window.originalEmptyCard=document.querySelector('.fa-product');});
 await publish([empty,product]);
 await loaded('.fa-product-image');
 assert.equal(await page.locator('.fa-product-link').first().getAttribute('href'),product.url,'An appended photo precedes a retained source-only card');
 assert.equal(await page.evaluate(url=>document.querySelector('.fa-product-link[href="'+url+'"]').parentElement===originalEmptyCard,empty.url),true,'Photo-first ordering retains the source-only card identity');
 assert.match(await page.locator('.fa-product-image').getAttribute('src'),/good-canonical/,'A failed search thumbnail falls through to the source-backed canonical photograph');
 assert.deepEqual(imageRequests,[product.image,product.imageCandidates[1]],'Each source-backed URL is attempted once');
 assert.equal(await page.locator('.fa-product-link[href="'+product.url+'"] .fa-image-unavailable').count(),0);
 await page.evaluate(()=>{window.originalFabricCard=document.querySelector('.fa-product');window.originalFabricImage=document.querySelector('.fa-product-image');});
 const richer={...product,title:'Forest green cloth selected by the assistant',reason:'A possible body cloth; verify fiber.',image:'https://fabric-cdn.example/good-new-canonical.jpg',imageCandidates:['https://fabric-cdn.example/good-new-canonical.jpg','https://fabric-cdn.example/good-new-thumbnail.jpg']};
 const beforeRicher=imageRequests.length;await publish([empty,richer]);
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product')===originalFabricCard&&document.querySelector('.fa-product-image')===originalFabricImage),true,'Late image evidence preserves the healthy card and actual loaded image node');
 assert.equal(await page.locator('.fa-product-image').getAttribute('src'),product.imageCandidates[1]);assert.equal(imageRequests.length,beforeRicher,'A healthy image is not reloaded when additional source URLs arrive');
 assert.equal(await page.locator('.fa-product-link[href="'+product.url+'"] .fa-card-title').textContent(),richer.title,'The model can refine a raw photo caption without replacing its loaded image');
 // An earlier retained source may gain a pending photo, fail and recover.
 // Image events alone must reorder the same nodes without another search.
 holdImage='/held-late-empty.jpg';
 const emptyPending={...empty,image:'https://fabric-cdn.example'+holdImage,imageCandidates:['https://fabric-cdn.example'+holdImage]};
 await publish([emptyPending,richer]);await page.locator('.fa-product-link[href="'+empty.url+'"]').scrollIntoViewIfNeeded();
 for(let i=0;i<100&&!heldImage;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(heldImage,'The retained source photograph is pending');
 assert.equal(await page.locator('.fa-product-link').first().getAttribute('href'),empty.url,'Pending photo candidates share photo-first priority');
 const pendingFailure=heldImage;heldImage=null;holdImage='';await pendingFailure.fulfill({status:404,body:'Missing late source photograph'});
 await page.waitForFunction(url=>document.querySelector('.fa-product-link').getAttribute('href')===url,product.url);
 assert.equal(await page.evaluate(url=>document.querySelector('.fa-product-link[href="'+url+'"]').parentElement===originalEmptyCard,empty.url),true,'Demotion preserves the exhausted card node');
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product-image')===originalFabricImage),true,'Failure reordering preserves the healthy image node');
 assert.equal(await page.locator('.fa-product-link').last().getAttribute('href'),empty.url,'Exhausted source links move after loaded photos without a provider event');
 const emptyRecovered={...empty,image:'https://fabric-cdn.example/good-late-recovery.jpg',imageCandidates:['https://fabric-cdn.example/good-late-recovery.jpg']};
 await publish([emptyRecovered,richer]);await loaded('.fa-product-link[href="'+empty.url+'"] img');
 assert.equal(await page.locator('.fa-product-link').first().getAttribute('href'),empty.url,'A recovered source photograph promotes the retained card');
 assert.equal(await page.evaluate(url=>document.querySelector('.fa-product-link[href="'+url+'"]').parentElement===originalEmptyCard,empty.url),true,'Recovery preserves the original card node');
 assert.equal(await page.evaluate(()=>fixtureSearches),1,'Photo ordering and recovery never start additional provider searches');
 // Explicit image rejection is stronger evidence than ordinary metadata changes.
 const revocable={...product,url:product.url+'-revoked',title:'Green fabric with corrected photograph',image:'https://fabric-cdn.example/good-wrong-color.jpg',imageCandidates:['https://fabric-cdn.example/good-wrong-color.jpg']};
 await publish([richer,revocable]);await loaded('.fa-product-link[href="'+revocable.url+'"] img');
 await page.evaluate(url=>{window.revokedImage=document.querySelector('.fa-product-link[href="'+url+'"] img');},revocable.url);
 const corrected={...revocable,image:'https://fabric-cdn.example/good-right-color.jpg',imageCandidates:['https://fabric-cdn.example/good-right-color.jpg'],rejectedImageURLs:[revocable.image]};
 await publish([richer,corrected]);await loaded('.fa-product-link[href="'+revocable.url+'"] img');
 assert.equal(await page.locator('.fa-product-link[href="'+revocable.url+'"] img').getAttribute('src'),corrected.image,'Explicit wrong-color evidence removes the healthy rejected photo and loads a valid alternative');
 assert.equal(await page.evaluate(url=>document.querySelector('.fa-product-link[href="'+url+'"] img')!==revokedImage,revocable.url),true,'Explicit revocation discards the rejected image node');
 await publish([richer,{...corrected,image:'',imageCandidates:[],rejectedImageURLs:[revocable.image,corrected.image]}]);
 await page.locator('.fa-product-link[href="'+revocable.url+'"] .fa-image-unavailable').waitFor({state:'attached'});
 assert.equal(await page.locator('.fa-product-link[href="'+revocable.url+'"] img').count(),0,'Explicit rejection with no safe alternative keeps only hidden source evidence');
 holdImage='/held-rejected-loading.jpg';
 const loadingRejected={...product,url:product.url+'-loading-rejected',title:'Green fabric pending corrected photo',image:'https://fabric-cdn.example'+holdImage,imageCandidates:['https://fabric-cdn.example'+holdImage]};
 await publish([richer,loadingRejected]);await page.locator('.fa-product-link[href="'+loadingRejected.url+'"]').scrollIntoViewIfNeeded();
 for(let i=0;i<100&&!heldImage;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(heldImage,'The rejected photograph was still loading');
 const loadingCorrected={...loadingRejected,image:'https://fabric-cdn.example/good-loading-corrected.jpg',imageCandidates:['https://fabric-cdn.example/good-loading-corrected.jpg'],rejectedImageURLs:[loadingRejected.image]};
 await publish([richer,loadingCorrected]);await loaded('.fa-product-link[href="'+loadingRejected.url+'"] img');
 const revokedRequest=heldImage;heldImage=null;holdImage='';await revokedRequest.fulfill({body:png,contentType:'image/png'});await page.waitForTimeout(60);
 assert.equal(await page.locator('.fa-product-link[href="'+loadingRejected.url+'"] img').getAttribute('src'),loadingCorrected.image,'A late revoked load cannot restore the rejected photograph');
 const failed={...product,url:product.url+'-failed',title:'Green woven fabric alternative',image:'https://fabric-cdn.example/bad-a.jpg',imageCandidates:['https://fabric-cdn.example/bad-a.jpg','https://fabric-cdn.example/bad-b.jpg','https://fabric-cdn.example/bad-c.jpg','https://fabric-cdn.example/bad-d.jpg']};
 const failedCard=page.locator('.fa-product').filter({has:page.locator('.fa-product-link[href="'+failed.url+'"]')});
 await publish([richer,failed]);await failedCard.locator('.fa-image-unavailable').waitFor({state:'attached'});
 assert.equal(await failedCard.locator('img').count(),0);assert.equal(await failedCard.locator('.fa-image-unavailable').getAttribute('data-maya-type'),'P3');
 assert.equal(await failedCard.locator('a').getAttribute('href'),failed.url,'The genuine source link survives an unavailable photograph');
 assert.equal(await failedCard.evaluate(e=>e.classList.contains('has-missing-photo')),true,'Exhausted photos retain their failure marker for bounded recovery');
 for(const url of failed.imageCandidates)assert.equal(imageRequests.filter(value=>value===url).length,1,'Every failing source-backed photo is tried at most once');
 await publish([richer,{...failed,imageCandidates:[...failed.imageCandidates,'https://fabric-cdn.example/bad-fifth.jpg']}]);
 await page.waitForTimeout(120);
 assert.equal(imageRequests.some(value=>value.includes('bad-fifth')),false,'The per-card recovery budget cannot grow past four URL attempts');
 assert.equal(await page.evaluate(()=>fixtureSearches),1,'Photo failures do not start paid/provider searches');
 await done([richer,failed]);await page.evaluate(()=>fixtureOpen);
 repairBadA=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>fixtureStreams.length===2);
 await publish([richer,failed]);await loaded('.fa-product-link[href="'+failed.url+'"] img');
 assert.equal(imageRequests.filter(value=>value===failed.image).length,2,'Only explicit Refresh retries a photograph whose candidates were exhausted');
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product-link[href="https://fabric-shop.example/products/green-woven-fabric"] img')===originalFabricImage),true,'Refreshing failed photos preserves healthy image nodes');
 const unsafe={...product,url:product.url+'-safe',title:'Green fabric safe image',image:'http://unsafe-images.example/a.jpg',imageCandidates:['https://127.0.0.1/a.jpg','https://images.internal/a.jpg','https://user:private@fabric-cdn.example/a.jpg','https://fabric-cdn.example/good-safe.jpg']};
 await publish([richer,failed,unsafe]);await loaded('.fa-product-link[href="'+unsafe.url+'"] img');
 assert.deepEqual(foreignRequests,[],'Unsafe/private/credential-bearing image URLs never enter browser requests');
 await done([richer,failed,unsafe]);
 await page.waitForFunction(()=>document.querySelector('.fa-status').textContent==='Source-backed fabric suggestions.');
 // A never-settling image must fall back without waiting for a browser error.
 await page.clock.install();holdImage='/held-timeout.jpg';
 const stalled={...product,url:product.url+'-stalled',image:'https://fabric-cdn.example'+holdImage,imageCandidates:['https://fabric-cdn.example'+holdImage,'https://fabric-cdn.example/good-timeout-fallback.jpg']};
 await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>fixtureStreams.length===3);
 await publish([richer,stalled]);await page.locator('.fa-product-link[href="'+stalled.url+'"]').scrollIntoViewIfNeeded();
 for(let i=0;i<100&&!heldImage;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(heldImage);
 await page.clock.fastForward(8100);await loaded('.fa-product-link[href="'+stalled.url+'"] img');
 assert.match(await page.locator('.fa-product-link[href="'+stalled.url+'"] img').getAttribute('src'),/good-timeout-fallback/);
 const timedOut=heldImage;heldImage=null;holdImage='';await timedOut.fulfill({body:png,contentType:'image/png'}).catch(()=>{});
 assert.match(await page.locator('.fa-product-link[href="'+stalled.url+'"] img').getAttribute('src'),/good-timeout-fallback/,'A late timed-out image cannot replace its fallback');
 const missingLinks=Array.from({length:6},(_,i)=>({...empty,url:empty.url+'-'+i}));
 await publish([richer,...missingLinks]);
 const compact=await page.locator('.fa-results').evaluate(grid=>({height:grid.scrollHeight,rows:[...grid.querySelectorAll('.has-missing-photo')].map(card=>card.getBoundingClientRect().height)}));
 assert.equal(compact.rows.length,6);assert.ok(compact.rows.every(height=>height===0),'Saved-look Global hides exhausted photo links instead of changing the In House gallery');assert.ok(compact.height<1100,'Missing links do not each consume a photo-height grid track');
 const stop=page.getByRole('button',{name:'Stop fabric search',exact:true});assert.equal(await stop.isVisible(),true,'Stop is available in automatic saved-look mode');await stop.click();
 await page.getByText('Search stopped.',{exact:true}).waitFor();assert.equal(await stop.isVisible(),false);
 // A detached old card must not start another photograph after account reset.
 holdImage='/held-old-thumbnail.jpg';await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>fixtureStreams.length===4);
 const old={...product,url:product.url+'-old',title:'Previous account green fabric',image:'https://fabric-cdn.example'+holdImage,imageCandidates:['https://fabric-cdn.example'+holdImage,'https://fabric-cdn.example/good-old-fallback.jpg']};
 await publish([old]);const oldCard=page.locator('.fa-product-link[href="'+old.url+'"]');await oldCard.scrollIntoViewIfNeeded();
 for(let i=0;i<100&&!heldImage;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(heldImage,'The old owner photograph request was held');
 await page.evaluate(value=>{localStorage.setItem('maya_admin_tok',value);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},token('image-owner-B'));
 const delayed=heldImage;heldImage=null;await delayed.fulfill({status:404,body:'Old owner missing photograph'});await page.waitForTimeout(80);
 assert.equal(await page.locator('.fa-product').count(),0,'Account reset clears private cards');
 assert.equal(imageRequests.some(value=>value.includes('good-old-fallback')),false,'A late old-owner failure cannot begin a fallback request in the next account');
 assert.equal(await page.evaluate(()=>fixtureSearches),4,'Only the initial request and explicit Refresh actions performed searches');
 assert.deepEqual(errors,[]);
 console.log('Fabric photographs passed: source-backed fallback, four-attempt bound, hidden exhausted Global links, healthy DOM retention, photo-first event ordering, explicit rejection, explicit-only retry, unsafe URL rejection and stale-account cancellation. Synthetic providers only.');
}finally{if(heldImage)await heldImage.abort().catch(()=>{});await browser.close();}
