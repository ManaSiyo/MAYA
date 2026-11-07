// Isolated browser acceptance. All cloud/image/delete transports are fake.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {readFileSync,existsSync} from 'node:fs';
import {validDesign} from '../backend/server/design-config.mjs';
import {createFabricSearch} from '../backend/server/fabrics.mjs';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
const assets=existsSync(root+'/docs/aesthetics')?'/docs':'';
const engine=process.env.MAYA_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch();
const measure=[];
async function open(path,width=1194,height=834){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<1400,isMobile:width<1400});
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.addInitScript(()=>{window.setInterval=()=>0;});
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='maya.test')return route.abort();
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,folders:[],threads:[]}});
  let path=decodeURIComponent(url.pathname);if(path.startsWith('/aesthetics/'))path=assets+path;
  try{return route.fulfill({body:readFileSync(root+path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
 });
 await page.goto('https://maya.test'+path);await page.waitForFunction(()=>window.MayaTypographyControls);await page.waitForTimeout(80);return page;
}
try{
 for(const [width,height] of [[390,844],[844,390],[768,1024],[1024,768],[1194,834],[1366,1024],[1440,900]]){
  const page=await open('/frontend/index.html',width,height);
  await page.evaluate(()=>{
   document.getElementById('signin-gate').style.setProperty('display','none','important');_hydrating=true;
   communityBoard.posts=Array.from({length:12},(_,i)=>({id:'design'+i,imageUrl:'/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg',author:'Preview',summary:'Midnight velvet tailored coat'}));communityBoard.render();
   items=[{id:1,card:{favorited:true,image:'/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg',caption:'Midnight velvet tailored coat'}}];_renderFavoritesScroller();
  });
  assert.deepEqual(await page.locator('#page-indicator button').evaluateAll(nodes=>nodes.map(n=>n.title)),['Inspo','Favorites','Community']);
  assert.deepEqual(await page.locator('#screens > section').evaluateAll(nodes=>nodes.map(n=>n.id)),['screen-inspo','screen-favorites','screen-community']);
  await page.waitForFunction(()=>document.querySelector('#page-indicator button.active')?.title==='Inspo');
  for(const [screen,dot,selector] of [[2,'dot-3','.favorite-card'],[0,'dot-1','.community-card']]){
   await page.locator('#'+dot).click();
   await page.waitForFunction(({screen,dot})=>{const host=document.getElementById('screens'),section=host.querySelector('[data-screen="'+screen+'"]');return Math.abs(host.scrollTop-section.offsetTop)<2&&document.getElementById(dot).getAttribute('aria-current')==='page';},{screen,dot});
   await page.waitForFunction(label=>document.getElementById('brand-title').textContent===label,screen===0?'COMMUNITY':'FAVORITES');
   const bounds=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.top,r.bottom];}));
   if(bounds.some(([t,b])=>b===0))console.log(await page.evaluate(()=>({body:document.body.className,screen:currentScreen,rows:[...document.querySelectorAll('#screens>section')].map(e=>({id:e.id,display:getComputedStyle(e).display,top:e.offsetTop,height:e.offsetHeight})),host:document.getElementById('screens').scrollTop,card:document.querySelector('.favorite-card')?.outerHTML})));
   for(const [top,bottom] of bounds)assert.ok(top>=60&&bottom<=height-8,`${width}x${height} ${selector} clipped: ${top},${bottom}`);
  }
  await page.evaluate(()=>{_syncScreenUI(2);_syncScreenUI(0);});
  await page.waitForTimeout(250);assert.equal(await page.locator('#brand-title').textContent(),'COMMUNITY','A late title transition must not overwrite the current screen');
  // Natural scroll must update the indicator without a UI synchronization call.
  await page.evaluate(()=>document.getElementById('screens').scrollTop=0);
  await page.waitForFunction(()=>document.querySelector('#page-indicator button.active')?.title==='Inspo'&&document.getElementById('brand-title').textContent==='MAYA');
  assert.match(await page.locator('#top-left-brand img').getAttribute('src'),/logo-circle/);
  if(process.env.MAYA_CAPTURE&&(width===1194||width===390))await page.screenshot({path:`/private/tmp/maya-cleanup-${width}-community.png`,animations:'disabled'});
  await page.evaluate(()=>{
   window.fixture={uploads:0,active:0,max:0,commits:0,release:[],writes:[]};
   projectStore._uid=()=> 'owner';projectStore.ready=()=>true;projectStore.currentId='project';projectStore.flush=async()=>true;projectStore._idxDoc=()=>({update:async()=>{}});
   const source={name:'Blue coat',items:Array.from({length:6},(_,i)=>({card:{imageUrl:'picture-'+i}})),lastSummary:null};
   projectStore._col=()=>({doc:()=>({get:async()=>({exists:true,data:()=>source})})});projectStore._tombs=()=>({doc:()=>({deleted:true})});
   window.firebase={storage:()=>({ref:path=>({put:async()=>{fixture.uploads++;fixture.active++;fixture.max=Math.max(fixture.max,fixture.active);await new Promise(r=>fixture.release.push(r));fixture.active--;},getDownloadURL:async()=> 'https://storage.test/'+path,delete:async()=>{}})}),firestore:Object.assign(()=>({collection:()=>({doc:()=>({})}),runTransaction:async fn=>{await fn({get:async ref=>({exists:!ref.deleted}),set:()=>fixture.commits++});}}),{FieldValue:{serverTimestamp:()=>0}})};
   blobFromPicture=async()=>new Blob(['photo'],{type:'image/jpeg'});compressBlobForUpload=async blob=>blob;_renderSessionsDropdown=()=>{};
   const started=performance.now();window.sharePromises=[shareCurrentProject(),shareCurrentProject(),shareCurrentProject()];fixture.openMs=performance.now()-started;
  });
  assert.ok(await page.locator('#share-link-modal').evaluate(e=>e.classList.contains('open')));
  assert.ok(await page.locator('#share-copy-btn').isDisabled());
  await page.waitForFunction(()=>fixture.uploads===3);
  const latency=await page.evaluate(()=>fixture.openMs);assert.ok(latency<150,'Share popup waits on cloud work');measure.push({width,sharePopupMs:Math.round(latency)});
  await page.evaluate(()=>fixture.release.splice(0).forEach(r=>r()));await page.waitForFunction(()=>fixture.uploads===6);
  await page.evaluate(()=>fixture.release.splice(0).forEach(r=>r()));await page.evaluate(()=>Promise.all(sharePromises));
  assert.deepEqual(await page.evaluate(()=>[fixture.uploads,fixture.commits,fixture.max]),[6,1,3]);
  assert.equal(await page.locator('#share-copy-btn').textContent(),'Copy');
  await page.evaluate(()=>_copyToClipboard=async()=>true);await page.locator('#share-copy-btn').click();assert.equal(await page.locator('#share-copy-btn').textContent(),'Copied');
  const dialog=await page.locator('.share-card').boundingBox();assert.ok(dialog.x>=0&&dialog.x+dialog.width<=width+1&&dialog.height<=height);
  const before=await page.locator('.share-card').evaluate(e=>({background:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).paddingLeft}));
  await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.inner,{background:'green',fill:65,paddingX:23,paddingY:17});Object.assign(d.glass,{fill:65,blur:10,rim:70});Object.assign(d.editor,{background:'green',fill:70,paddingX:19,paddingY:11});d.type.H3.size=18;d.type.P3.size=12;MayaTypographyControls.apply(d);});
  const after=await page.locator('.share-card').evaluate(e=>({background:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).paddingLeft}));assert.notDeepEqual(after,before);assert.equal(after.padding,'23px');
  assert.equal(await page.locator('.share-link-input').evaluate(e=>getComputedStyle(e).paddingLeft),'19px');
  if(process.env.MAYA_CAPTURE&&(width===1194||width===390))await page.screenshot({path:`/private/tmp/maya-cleanup-${width}-share-saved.png`,animations:'disabled'});
  assert.deepEqual(page.errors,[]);await page.close();
 }
 // Merged legal content retains reachable Terms and shared heading roles.
 for(const width of [390,1194,1440]){
  const legal=await open('/backend/privacy.html',width,900);
  assert.equal(await legal.locator('h1').textContent(),'Privacy & Terms');
  assert.equal(await legal.locator('#terms').textContent(),'Terms of service');
  const before=await legal.locator('#terms').evaluate(e=>getComputedStyle(e).fontSize);
  await legal.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H3.size=21;MayaTypographyControls.apply(d);});
  assert.equal(await legal.locator('#terms').evaluate(e=>getComputedStyle(e).fontSize),'21px');assert.notEqual(before,'21px');
  assert.ok(await legal.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Legal content overflows at '+width);
  await legal.locator('.foot a[href="#terms"]').click();assert.match(legal.url(),/#terms$/);
  if(process.env.MAYA_CAPTURE&&width===390)await legal.screenshot({path:'/private/tmp/maya-cleanup-legal-390.png',animations:'disabled'});
  assert.deepEqual(legal.errors,[]);await legal.close();
 }
 // Real shared card, confirmation, cancel, failure and explicit delete; never a live record.
 const brief=await open('/backend/backend.html',390,844);
 assert.equal(await brief.locator('#delete-open-submission').count(),0,'Brief deletion belongs only in its drawer');
 await brief.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H1.size=32;d.pillX=18;d.pillY=9;MayaTypographyControls.apply(d);});
 const header=await brief.locator('#top-bar').evaluate(e=>{const buttons=[...e.querySelectorAll('#top-actions button')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right};});return {buttons,title:getComputedStyle(document.getElementById('workspace-title')).whiteSpace};});
 assert.equal(header.title,'nowrap');assert.ok(header.buttons.every(b=>b.top>=0&&b.bottom<=60&&b.right<=390));await brief.close();
 const page=await open('/backend/status.html');
 await page.evaluate(()=>{document.getElementById('signin-panel').hidden=true;const host=document.getElementById('subs-strip');host.style.display='flex';host.innerHTML='';window.calls=0;host.append(MayaSubmissionCards.create({id:'fixture-submission',name:'Preview',description:'Midnight velvet tailored coat',files:[{id:'photo',name:'dream-garment.jpg'}]},{src:'/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg',onDelete:()=>MayaSubmissionCards.confirmDelete(async()=>{calls++;if(calls===1)throw Error('Fixture unavailable');host.replaceChildren();})}));});
 await page.locator('.sub-tile').hover();assert.equal(await page.locator('.submission-caption').textContent(),'Midnight velvet tailored coat');
 await page.locator('.submission-delete').click();
 for(const [width,height] of [[390,844],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});
  const box=await page.locator('.submission-confirm').boundingBox();assert.ok(Math.abs(box.x+box.width/2-width/2)<2&&Math.abs(box.y+box.height/2-height/2)<2,'Delete confirmation must center in both axes');
 }
 await page.locator('[data-cancel]').click();assert.equal(await page.evaluate(()=>calls),0);
 await page.locator('.submission-delete').click();await page.locator('[data-delete]').click();assert.equal(await page.locator('.submission-confirm-status').textContent(),'Fixture unavailable');
 await page.locator('[data-delete]').click();assert.equal(await page.locator('.sub-tile').count(),0);assert.deepEqual(page.errors,[]);await page.close();
 const gallery=await open('/aesthetics/aesthetic-control.html');
 await gallery.locator('#drawer-controls-preview').waitFor();
 await gallery.getByRole('button',{name:'Share dialog',exact:true}).click();await gallery.locator('#share-style-preview').waitFor();
 await gallery.locator('#share-style-preview [data-copy]').click();assert.equal(await gallery.locator('#share-style-preview [data-copy]').textContent(),'Copied');await gallery.locator('#share-style-preview [data-done]').click();
 await gallery.locator('[data-editor=inner] summary').click();await gallery.locator('[data-editor=inner] [data-field=paddingX]').fill('23');await gallery.keyboard.press('Escape');
 await gallery.locator('#save').click();await gallery.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Saved locally'));await gallery.reload();await gallery.locator('#drawer-controls-preview').waitFor();
 await gallery.getByRole('button',{name:'Share dialog',exact:true}).click();assert.equal(await gallery.locator('#share-style-preview').evaluate(e=>getComputedStyle(e).paddingLeft),'23px');await gallery.locator('#share-style-preview [data-done]').click();
 await gallery.getByRole('button',{name:'Drawer',exact:true}).click();await gallery.locator('.sub-tile').hover();await gallery.locator('.submission-delete').click();await gallery.locator('.submission-confirm').waitFor();assert.equal(await gallery.locator('.submission-confirm').evaluate(e=>getComputedStyle(e).paddingLeft),'23px');await gallery.locator('[data-cancel]').click();
 await gallery.getByRole('button',{name:'Close Settings',exact:true}).click();
 const notes=gallery.locator('.maya-notes-preview');
 assert.equal(await notes.locator('.maya-design-notes').evaluate(e=>e.inert),true);
 await notes.getByRole('button',{name:'Design Notes',exact:true}).click();
 assert.equal(await notes.locator('.maya-design-notes').evaluate(e=>e.inert),false);
 assert.equal(await notes.locator('.maya-notes-content').getByText('Midnight blue',{exact:true}).count(),1);
 await notes.getByRole('button',{name:'Design Notes',exact:true}).click();
 await notes.locator('img').click();
 const expanded=gallery.locator('.maya-image-viewer');assert.ok(await expanded.isVisible());
 const bounds=await expanded.boundingBox();assert.equal(bounds.width,1194);assert.equal(bounds.height,834);
 await expanded.locator('img').evaluate(image=>image.decode());
 await expanded.locator('img').hover();assert.equal(await expanded.locator('.maya-image-lens').isVisible(),true);
 await expanded.locator('img').press('+');assert.notEqual(await expanded.locator('img').evaluate(e=>e.style.transform),'translate(0px,0px) scale(1)');
 await gallery.keyboard.press('Escape');await expanded.waitFor({state:'detached'});
 assert.deepEqual(gallery.errors,[]);await gallery.close();
 const deletion=await open('/backend/status.html'),deleteRequests=[];
 await deletion.route('**/api/admin/submissions/fixture-submission',route=>{deleteRequests.push({method:route.request().method(),auth:route.request().headers().authorization});return route.fulfill({json:{ok:true,id:'fixture-submission'}});});
 await deletion.evaluate(()=>{window.deleteValid=false;window.deleted=0;MayaSubmissionCards.requestDelete({id:'fixture-submission'},{token:'fixture-owner',valid:()=>deleteValid,onDeleted:()=>deleted++});});
 await deletion.locator('[data-delete]').click();assert.equal(deleteRequests.length,0);assert.match(await deletion.locator('.submission-confirm-status').textContent(),/account changed/);
 await deletion.evaluate(()=>deleteValid=true);await deletion.locator('[data-delete]').click();await deletion.waitForFunction(()=>deleted===1);assert.deepEqual(deleteRequests,[{method:'DELETE',auth:'Bearer fixture-owner'}]);await deletion.close();
 await checkFabricGallery();
 console.log('UI, responsive layout, sharing performance and saved aesthetics passed',JSON.stringify(measure));
}finally{await browser.close();}

async function checkFabricGallery(){
// Owner standard: the served Global gallery must match In House, not a chat UI.
const root=resolve('.'),browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}});
const png=readFileSync('docs/aesthetics/ui/logo-circle.png'),reference='data:image/png;base64,'+png.toString('base64');
const catalog=JSON.parse(readFileSync('docs/aesthetics/fabrics/fabrics.json')).items;
const products=catalog.map((p,i)=>({url:'https://cloth.example/products/fabric-'+i,title:p.name,image:'https://photos.example/'+i+'.png',merchant:'cloth.example',evidence:'web_suggestion'}));
const token='fixture.'+Buffer.from(JSON.stringify({sub:'gallery-owner',exp:4000000000})).toString('base64url')+'.fixture';
let saved={},calls=0,failed=false,holdSearch=true,releaseSearch;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(token=>{if(location.origin==='https://maya-gallery.test')localStorage.setItem('maya_admin_tok',token);window.setInterval=()=>0;},token);
await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='photos.example')return failed?route.fulfill({status:404,body:'Unavailable fixture photograph'}):route.fulfill({body:readFileSync(resolve(root,'docs/aesthetics/fabrics',catalog[Number(u.pathname.split('/').pop().split('.')[0])].thumbnail)),contentType:'image/jpeg'});
 if(u.hostname!=='maya-gallery.test')return route.abort();
 if(u.pathname==='/api/design')return route.fulfill({json:saved});
 if(u.pathname==='/api/admin/design'){saved=route.request().postDataJSON();assert.ok(validDesign(saved));return route.fulfill({json:{ok:true,savedAt:'2026-11-04'}});}
 if(u.pathname==='/api/admin/fabrics/search'){
  calls++;if(holdSearch)await new Promise(resolve=>{releaseSearch=resolve;});
  // Exercise the real adapter from the documented OpenAI payload to the browser.
  const events=[],service=createFabricSearch({apiKey:()=> 'fixture',fetchImpl:async target=>{
   assert.equal(target,'https://api.openai.com/v1/responses');
   const results=products.map(p=>({type:'image_result',source_website_url:p.url,image_url:p.image+(failed?'?failure=1':''),caption:p.title}));
   return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{type:'web_search_call',results}]}})+'\n\n');
  }});
  await service.search({sub:'gallery-owner'},{request:'Green apparel fabric',image:reference},event=>events.push(event));
  return route.fulfill({contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
 }
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],generation:'0'}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+(u.pathname.startsWith('/aesthetics/')?'/docs':'')+decodeURIComponent(u.pathname))),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.JPG':'image/jpeg'})[extname(u.pathname)]||'text/plain'});}catch{return route.abort();}
});
const tab=name=>page.locator('.fa-tabs').getByRole('button',{name,exact:true});
const measure=()=>page.locator('#fabric-assistant').evaluate(root=>{
 const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,top:r.top,left:r.left,overflowX:s.overflowX,overflowY:s.overflowY,columns:s.gridTemplateColumns,rows:s.gridTemplateRows,gap:s.gap,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,pad:[s.paddingLeft,s.paddingTop],material:s.backgroundColor,fit:s.objectFit};};
 const first=root.querySelector('.fa-product:not([hidden])');return {body:rect(root.querySelector('.fa-body')),grid:rect(root.querySelector('.fa-results')),card:rect(first),photo:rect(first.querySelector('img')),title:rect(first.querySelector('.fa-card-title')),caption:rect(first.querySelector('.fa-card-caption')),controls:[...root.querySelectorAll('button,textarea')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>el.textContent||el.getAttribute('aria-label'))};
});
try{
 await page.goto('https://maya-gallery.test/backend/backend.html');await page.waitForFunction(()=>window.MayaFabricAssistant&&window.MayaTypographyControls);
 await page.evaluate(reference=>{const pieces=[{id:'coat',name:'Coat',fabric:'Green fabric',_image:reference}];window._openedSubmission={id:'gallery-project'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:reference,card:{_dissection:{pieces}}};renderDissection({card:{image:reference,_dissection:{pieces}}});_publishSavedOperations({pieces});},reference);
 await page.locator('#brief-fabrics-button').click();
 await page.waitForFunction(()=>document.querySelector('.fa-status')?.textContent==='Searching for Fabrics');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.getByText('Searching for Fabrics',{exact:true}).count(),1);assert.equal(await page.locator('.fa-empty').count(),0);assert.ok(await page.locator('.fa-status').evaluate(e=>{const r=e.getBoundingClientRect(),b=document.querySelector('.fa-body').getBoundingClientRect();return r.top>=b.bottom-1&&r.right<=innerWidth+1;}),'One bottom loading line at '+width);}
 holdSearch=false;releaseSearch();
 await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const design of ['default','saved']){
  if(design==='saved')await page.evaluate(async()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H1.size=32;d.type.H2.size=28;d.type.H3.size=24;d.type.P1.size=16;d.type.P2.size=16;Object.assign(d.type.H4,{font:'cormorant',size:20,weight:450,color:'gray'});Object.assign(d.type.P3,{size:14,color:'white'});Object.assign(d.inner,{paddingX:19,paddingY:13,background:'green',fill:65});d.pillX=18;d.pillY=9;await MayaTypographyControls.save(d);});
  for(const mode of ['inline','expanded']){
   if(mode==='expanded')await page.getByRole('button',{name:'Expand',exact:true}).click();
   for(const width of [320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:1000});await tab('In House').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
    await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const local=await measure();
    await tab('Global').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const global=await measure();
    assert.deepEqual(global,local,design+' '+mode+' '+width+': Global must have exactly the In House geometry, roles, materials, controls and scroll containers');
    if(design==='saved'){assert.equal(global.title.size,'20px');assert.equal(global.caption.size,'14px');assert.deepEqual(global.card.pad,['19px','13px']);assert.equal(global.card.material,'rgba(23, 91, 59, 0.65)');}
    assert.equal(await page.locator('.fa-composer').isVisible(),false);assert.equal(await page.locator('.fa-observation').isVisible(),false);
    assert.deepEqual(global.controls,['In House','Global','Favorites','Refresh fabrics',mode==='inline'?'Expand':'Collapse']);
    assert.ok(global.title.height<=(parseFloat(global.title.line)||parseFloat(global.title.size)*1.5)+1);assert.ok(global.caption.height<=(parseFloat(global.caption.line)||parseFloat(global.caption.size)*1.5)+1);
    await page.locator('.fa-results').evaluate(el=>el.scrollTop=190);const globalScroll=await page.locator('.fa-results').evaluate(el=>el.scrollTop);await tab('In House').click();await page.locator('.fa-results').evaluate(el=>el.scrollTop=190);assert.equal(await page.locator('.fa-results').evaluate(el=>el.scrollTop),globalScroll);
    if(mode==='inline'&&(width===390||width===1440)){
     await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);
     for(const [name,file] of [['In House','inhouse'],['Global','global']]){
      await tab(name).click();
      await page.locator('.fa-product-image').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      process.env.MAYA_CAPTURE&&await page.screenshot({path:'/private/tmp/maya-'+file+'-'+design+'-'+width+'.png'});
     }
    }
   }
   if(mode==='expanded')await page.getByRole('button',{name:'Collapse',exact:true}).click();
  }
 }
 assert.equal(calls,1,'Comparing gallery views never repeats paid search');
 // Failed photos cannot replace the gallery with Photo unavailable text tiles.
 failed=true;await tab('Global').click();await page.evaluate(reference=>MayaFabricAssistant.open({host:document.getElementById('brief-fabrics'),submissionId:'gallery-project',referenceImage:reference,automatic:true,forceReset:true,piece:{id:'coat',name:'Coat'},pieces:[{id:'coat',name:'Coat'}]}),reference);
 await page.getByText('No fabric photographs loaded. Refresh to retry.',{exact:true}).waitFor();assert.equal(await page.locator('.fa-product:visible').count(),0);assert.equal(await page.getByText('Photo unavailable',{exact:true}).filter({visible:true}).count(),0);assert.equal(calls,2,'Failures do not retry the provider automatically');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const empty=page.getByText('No fabric photographs loaded. Refresh to retry.',{exact:true});assert.equal(await empty.getAttribute('data-maya-type'),'P1');assert.equal(await empty.evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.ok(await empty.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));}
 failed=false;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());assert.equal(await page.locator('.fa-product:visible').count(),8);assert.equal(calls,3);
 // A session reset clears private data without restoring chat controls. Explicit
 // Refresh asks the host for its current canonical saved garment after renewal.
 await page.evaluate(()=>{const old=localStorage.getItem('maya_admin_tok');const p=JSON.parse(atob(old.split('.')[1]));p.exp=1;localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify(p))+'.fixture');window.dispatchEvent(new Event('focus'));});
 assert.equal(await page.locator('.fa-product').count(),0);assert.equal(await page.locator('.fa-composer').isVisible(),false);
 await page.evaluate(token=>localStorage.setItem('maya_admin_tok',token),token);
 holdSearch=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.fa-status')?.textContent==='Searching for Fabrics');
 assert.equal(await page.locator('.fa-status').evaluate(e=>getComputedStyle(e).fontSize),'16px');assert.equal(await page.locator('.fa-empty').count(),0);assert.equal(await page.locator('.fa-composer').isVisible(),false);
 process.env.MAYA_CAPTURE&&await page.screenshot({path:'/private/tmp/maya-clean-fabric-loading.png'});holdSearch=false;releaseSearch();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());assert.equal(calls,4,'Only explicit Refresh recovers the current saved context');
 await page.evaluate(()=>MayaTypographyControls.save(MayaTypographyControls.defaults));
 await page.goto('https://maya-gallery.test/aesthetics/aesthetic-control.html');await page.locator('#workspace-previews > summary').click();
 assert.equal(await page.locator('#workspace-previews textarea,#workspace-previews .fa-composer').count(),0,'Aesthetic Control cannot restore the unrequested composer');
 const preview=page.locator('#workspace-previews');await preview.getByRole('button',{name:'Global',exact:true}).click();assert.equal(await preview.locator('.fa-status').textContent(),'Searching for Fabrics');assert.equal(await preview.locator('.fa-status').getAttribute('data-maya-type'),'P1');await preview.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const rect=()=>preview.locator('.fa-results').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,rows:getComputedStyle(el).gridTemplateRows,cards:[...el.children].map(c=>[c.clientWidth,c.clientHeight,c.querySelector('img').clientHeight])}));await preview.getByRole('button',{name:'In House',exact:true}).click();const local=await rect();await preview.getByRole('button',{name:'Global',exact:true}).click();assert.deepEqual(await rect(),local);}
 for(const changed of [false,true]){
  await page.locator('[data-category="P1"] summary').first().click();
  for(const [key,value] of Object.entries({font:changed?'cormorant':'jost',size:changed?16:12,color:changed?'white':'gray'})){const field=page.locator('[data-category="P1"] [data-field="'+key+'"]').first();if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));}
  await page.keyboard.press('Escape');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const style=await preview.locator('.fa-status').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {size:s.fontSize,font:s.fontFamily,color:s.color,margin:s.marginTop,right:r.right};});assert.equal(style.size,changed?'16px':'12px');assert.match(style.font,changed?/Cormorant/:/Jost/);assert.equal(style.color,changed?'rgb(255, 255, 255)':'rgb(170, 181, 196)');assert.equal(style.margin,'0px');assert.ok(style.right<=width+1);}
  process.env.MAYA_CAPTURE&&await preview.screenshot({path:'/private/tmp/maya-clean-preview-'+(changed?'saved':'default')+'.png'});
 }
 assert.equal(calls,4,'Aesthetic previews make no searches');assert.deepEqual(errors,[]);
 console.log('Fabric gallery: exact In House/Global parity, two caption rows, same scrolling, default/saved settings, six widths, photo failure/recovery and active preview passed.');
}catch(error){console.error(error);console.error((await page.locator('body').innerText()).slice(-2500));process.env.MAYA_CAPTURE&&await page.screenshot({path:'/private/tmp/maya-global-gallery-failure.png'});throw error;}finally{await browser.close();}

}
