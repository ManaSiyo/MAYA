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
  assert.ok(await page.evaluate(()=>{
   const photo=document.querySelector('.fc-img');
   items.push({id:2,card:{favorited:true,image:items[0].card.image,caption:'Second garment'}});_renderFavoritesScroller();
   const keptOnAdd=document.querySelector('.fc-img')===photo;
   items.pop();items[0].card.caption='Updated velvet coat';_renderFavoritesScroller();
   return keptOnAdd&&document.querySelector('.fc-img')===photo&&document.querySelector('.fc-summary').textContent===_buildPieceSummaryLine(items[0]);
  }),'Favorites additions, removals and caption updates preserve the loaded photograph');
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
  const box=await page.locator('.submission-confirm').boundingBox();assert.ok(box.width<=Math.min(420,width-32)+1,'Delete dialog stays compact despite shared Inner width');assert.ok(Math.abs(box.x+box.width/2-width/2)<2&&Math.abs(box.y+box.height/2-height/2)<2,'Delete confirmation must center in both axes');
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
 await gallery.getByRole('button',{name:'Drawer',exact:true}).click();await gallery.locator('.sub-tile').hover();await gallery.locator('.submission-delete').click();await gallery.locator('.submission-confirm').waitFor();assert.equal(await gallery.locator('.submission-confirm').evaluate(e=>getComputedStyle(e).paddingLeft),'23px');assert.ok((await gallery.locator('.submission-confirm').boundingBox()).width<=420);await gallery.locator('[data-cancel]').click();
 await gallery.getByRole('button',{name:'Close Settings',exact:true}).click();
 const notes=gallery.locator('.maya-notes-preview');
 assert.equal(await notes.locator('.maya-design-notes').evaluate(e=>e.inert),true);
 assert.equal(await notes.locator('.maya-design-notes').getAttribute('data-maya-material'),'glass');
 const beforeInspect=await notes.locator('img').evaluate(e=>e.classList.contains('maya-zoom-image'));assert.equal(beforeInspect,false);
 for(const [width,height]of [[390,844],[768,1024],[1194,834]]){await gallery.setViewportSize({width,height});const centers=await notes.evaluate(e=>{const a=e.querySelector('img').getBoundingClientRect(),b=e.querySelector('.maya-notes-dock').getBoundingClientRect();return [a.y+a.height/2,b.y+b.height/2];});assert.ok(Math.abs(centers[0]-centers[1])<2);}
 await gallery.setViewportSize({width:1194,height:834});
 for(const changed of [false,true]){await gallery.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.glass.fill=65;d.glass.blur=12;d.pillX=21;d.pillY=11;}MayaTypographyControls.apply(d);},changed);const glass=await notes.evaluate(e=>{const panel=getComputedStyle(e.querySelector('.maya-design-notes')),drop=getComputedStyle(e.querySelector('.maya-notes-drop'));return [panel.backgroundColor,drop.backgroundColor,panel.backdropFilter,drop.backdropFilter,panel.paddingLeft,drop.paddingLeft];});assert.equal(glass[0],glass[1]);assert.equal(glass[2],glass[3]);assert.equal(glass[4],glass[5]);}
 await notes.getByRole('button',{name:'Design Notes',exact:true}).click();
 assert.equal(await notes.locator('.maya-design-notes').evaluate(e=>e.inert),false);
 assert.equal(await notes.locator('.maya-notes-content').getByText('Midnight blue',{exact:true}).count(),1);
 await notes.getByRole('button',{name:'Design Notes',exact:true}).click();
 await notes.locator('img').click();
 const expanded=gallery.locator('.maya-image-viewer');assert.ok(await expanded.isVisible());
 const bounds=await expanded.boundingBox();assert.equal(bounds.width,1194);assert.equal(bounds.height,834);
 await expanded.locator('img').evaluate(image=>image.decode());
 await expanded.locator('img').hover();assert.equal(await expanded.locator('.maya-image-lens').isVisible(),true);
 assert.ok((await expanded.locator('.maya-image-lens').boundingBox()).width>300);
 await expanded.locator('img').press('+');assert.notEqual(await expanded.locator('img').evaluate(e=>e.style.transform),'translate(0px,0px) scale(1)');
 await gallery.keyboard.press('Escape');await expanded.waitFor({state:'detached'});
 assert.deepEqual(gallery.errors,[]);await gallery.close();
 const deletion=await open('/backend/status.html'),deleteRequests=[];
 await deletion.route('**/api/admin/submissions/fixture-submission',route=>{deleteRequests.push({method:route.request().method(),auth:route.request().headers().authorization});return route.fulfill({json:{ok:true,id:'fixture-submission'}});});
 await deletion.evaluate(()=>{window.deleteValid=false;window.deleted=0;MayaSubmissionCards.requestDelete({id:'fixture-submission'},{token:'fixture-owner',valid:()=>deleteValid,onDeleted:()=>deleted++});});
 await deletion.locator('[data-delete]').click();assert.equal(deleteRequests.length,0);assert.match(await deletion.locator('.submission-confirm-status').textContent(),/account changed/);
 await deletion.evaluate(()=>deleteValid=true);await deletion.locator('[data-delete]').click();await deletion.waitForFunction(()=>deleted===1);assert.deepEqual(deleteRequests,[{method:'DELETE',auth:'Bearer fixture-owner'}]);await deletion.close();
 await checkSubmissionDrawer();
 await checkOperationLayout();
 await checkProjectActions();
 await checkFabricGallery();
 await checkBackendTwo();
 console.log('UI, responsive layout, sharing performance and saved aesthetics passed',JSON.stringify(measure));
}finally{await browser.close();}


async function checkSubmissionDrawer(){
 const page=await open('/backend/backend.html',1440,900);let feeds=0,photos=0;
 await page.route('**/api/admin/submissions',route=>{feeds++;return route.fulfill({json:{folders:[{id:'retained',name:'Retained coat',description:'Velvet coat',files:[{id:'thumb',name:'dream-garment.jpg'}]}]}});});
 await page.route('**/api/admin/subthumb?**',route=>{photos++;return route.fulfill({body:readFileSync(root+'/docs/aesthetics/fabrics/thumbs/Midnight Velvet.jpg'),contentType:'image/jpeg'});});
 await page.evaluate(()=>{localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify({sub:'fixture-owner',exp:Date.now()/1000+3600}))+'.fixture');getMayaFolder=async()=>null;toggleClientsDrawer(true);});
 await page.waitForFunction(()=>document.querySelector('#clients-list img')?.src.startsWith('blob:'));
 await page.evaluate(()=>window.retainedPhoto=document.querySelector('#clients-list img'));
 for(let i=0;i<3;i++)await page.evaluate(async()=>{toggleClientsDrawer(false);await openClientsDrawer();});
 assert.equal(feeds,1);assert.equal(photos,1);assert.equal(await page.evaluate(()=>retainedPhoto===document.querySelector('#clients-list img')),true);
 await page.evaluate(async()=>{_drawerCheckedAt=0;_submissionFeed.at=0;await openClientsDrawer();});
 assert.equal(feeds,2);assert.equal(photos,1);assert.equal(await page.evaluate(()=>retainedPhoto===document.querySelector('#clients-list img')),true);
 await page.evaluate(()=>MayaSubmissionCards.confirmDelete(async()=>{}));
 for(const changed of [false,true])for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.inner.paddingX=23;d.inner.paddingY=19;d.inner.width=95;}MayaTypographyControls.apply(d);},changed);
  const box=await page.locator('.submission-confirm').boundingBox();assert.ok(box.width<=Math.min(420,width-32)+1);assert.ok(Math.abs(box.x+box.width/2-width/2)<2&&Math.abs(box.y+box.height/2-450)<2);
 }
 await page.locator('[data-cancel]').click();assert.deepEqual(page.errors,[]);await page.close();
}

async function checkOperationLayout(){
 const page=await open('/backend/backend.html',1440,900);
 await page.evaluate(()=>{document.getElementById('upload-gate').style.display='none';});
 const frame=page.frames().find(f=>f.url().includes('operation-workspace.html'));
 await frame.waitForFunction(()=>window.MayaImageViewer&&window.MayaTypographyControls);
 await frame.evaluate(()=>{const image=document.getElementById('hero-img');image.style.display='block';image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="gray"/></svg>');document.getElementById('hero-empty').style.display='none';document.getElementById('test-picker').innerHTML='<option>Track pants with cream side stripes</option>';});
 await frame.locator('#hero-img').evaluate(image=>image.decode());
 assert.equal(await frame.locator('#operation-fabrics,#operation-fabrics-host').count(),0);
 assert.equal(await frame.locator('script[src*="fabric-assistant"]').count(),0,'Pattern workspace does not initialize a second Fabric assistant');
 await frame.evaluate(()=>{PASSES=[{img:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/></svg>')}];CUR={kind:'grounded',idx:0};applyView();});
 await frame.locator('#img-grounded').evaluate(image=>image.decode());
 for(const changed of [false,true])for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  await frame.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P3.size=14;d.pillX=18;d.pillY=9;d.inner.paddingX=19;d.inner.paddingY=13;}MayaTypographyControls.apply(d);},changed);
  const layout=await frame.evaluate(()=>{const cols=document.querySelector('#plan-a-view .cols'),r=[...cols.children].map(e=>e.getBoundingClientRect()),image=document.getElementById('hero-img'),picker=document.getElementById('test-picker'),style=getComputedStyle(picker);return {columns:r.map(r=>({x:r.x,y:r.y,width:r.width})),overflow:document.documentElement.scrollWidth>innerWidth+1,fit:getComputedStyle(image).objectFit,position:getComputedStyle(image).objectPosition,pad:parseFloat(style.paddingRight),font:parseFloat(style.fontSize),arrow:style.backgroundImage.includes('data:image/svg+xml'),customArrows:document.querySelectorAll('.picker-chevron').length};});
  assert.equal(layout.overflow,false,'Operation layout overflow: '+JSON.stringify({width,changed,layout}));assert.equal(layout.fit,'cover');assert.match(layout.position,/50%/);assert.equal(layout.customArrows,0);assert.equal(layout.arrow,true);assert.ok(layout.pad>layout.font,'Native select reserves space for its one chevron');
  const geometry=()=>frame.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
   const hero=document.getElementById('hero-frame'),stage=document.getElementById('stage'),toolbar=hero.previousElementSibling;
   return {hero:rect(hero),stage:rect(stage),left:rect(hero.parentNode),right:rect(stage.parentNode),toolbar:rect(toolbar),picker:rect(document.getElementById('test-picker')),start:rect(document.getElementById('start-test')),
    pills:[...document.querySelectorAll('#start-test,#pass-pills button,#test-picker')].map(e=>{const s=getComputedStyle(e);return [s.paddingTop,s.paddingBottom,s.fontSize,s.lineHeight];}),pipelineBelow:document.getElementById('live').parentNode.classList.contains('trace'),traceHeading:document.querySelector('.trace h3').textContent};
  });
  const compact=await geometry();assert.ok(compact.start.bottom<=compact.hero.top);assert.ok(compact.picker.bottom<=compact.hero.top);
  assert.ok(compact.pipelineBelow);assert.equal(compact.traceHeading,'Retrieval Trace');
  for(const pill of compact.pills)assert.deepEqual(pill,compact.pills[0],'Operation toolbar pills share P3 and Glass padding');
  if(width>768){
   for(const edge of ['top','bottom']){assert.ok(Math.abs(compact.hero[edge]-compact.stage[edge])<2,'Frames align at '+edge);assert.ok(Math.abs(compact.left[edge]-compact.right[edge])<2,'Outer panels align at '+edge);}
   const above=compact.toolbar.top-compact.left.top-1,below=compact.hero.top-compact.toolbar.bottom;
   assert.ok(Math.abs(above-below)<2,'Toolbar has equal space above/below');
   assert.ok(compact.start.left-compact.picker.right<16,'Selector and Start stay together');
  }
  // Empty, running and saved drawings share exactly the same geometry.
  await frame.evaluate(()=>{document.getElementById('img-grounded').style.display='none';document.getElementById('stage').classList.remove('has-pattern');document.getElementById('stage-empty').style.display='block';});
  const empty=await geometry();assert.deepEqual(empty.hero,compact.hero);assert.deepEqual(empty.stage,compact.stage);
  await frame.evaluate(()=>{liveOpen();liveLine('Drawing Mark One');});
  const running=await geometry();assert.deepEqual(running.stage,compact.stage);assert.deepEqual(running.right,compact.right);
  await frame.evaluate(()=>applyView());
  const [left,right]=layout.columns;if(width>768)assert.ok(Math.abs(left.width/(left.width+right.width)-.34)<.01);else assert.ok(right.y>left.y,'Small screens stack the panels');
 }
 await page.setViewportSize({width:1440,height:900});
 await frame.locator('#hero-frame').dispatchEvent('pointermove',{pointerType:'mouse',clientX:0});
 assert.match(await frame.locator('#hero-img').evaluate(image=>getComputedStyle(image).objectPosition),/^0%/);
 await frame.locator('#hero-frame').dispatchEvent('pointerleave',{pointerType:'mouse'});
 assert.match(await frame.locator('#hero-img').evaluate(image=>getComputedStyle(image).objectPosition),/^50%/);
 // Running state and the SVG viewer must not capture ordinary vertical scrolling.
 await frame.evaluate(()=>{RUNNING=true;TRACE={svg:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10 10L90 90"/></svg>'};CUR={kind:'svg'};document.getElementById('trace-view').classList.remove('off');mountTrace();});
 assert.equal(await frame.locator('#trace-canvas').evaluate(canvas=>canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}))),true);
 await page.evaluate(()=>{const host=document.getElementById('screens');host.scrollTop=document.getElementById('screen-operating').offsetTop;});
 await page.waitForTimeout(100);
 const before=await page.locator('#screens').evaluate(e=>e.scrollTop);
 await page.mouse.move(1000,450);await page.mouse.wheel(0,350);
 await page.waitForFunction(before=>document.getElementById('screens').scrollTop>before+20,before);
 assert.deepEqual(page.errors,[]);await page.close();
}

async function checkProjectActions(){
 for(const width of [390,768,1440]){
  const page=await open('/frontend/index.html',width,900);
  await page.evaluate(()=>{document.getElementById('signin-gate').style.setProperty('display','none','important');_renderSessionsDropdown=()=>{};toggleNotesDrawer(true);const list=document.getElementById('drawer-sessions-list');list.style.display='block';list.innerHTML=_projectRows([{id:'fixture-project',name:'A new reference project',createdAt:1}]);});
  for(const changed of [false,true]){
   await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.pillX=18;d.pillY=9;d.type.P3.size=14;}MayaTypographyControls.apply(d);},changed);
   const bounds=await page.locator('.session-item-actions').evaluate(group=>{const row=group.closest('.session-item'),r=row.getBoundingClientRect();return {width:row.clientWidth,scroll:row.scrollWidth,rowRight:r.right,buttons:[...group.children].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};})};});
   assert.ok(bounds.scroll<=bounds.width+1,'Project action row fits the drawer');
   for(let i=1;i<3;i++)assert.ok(bounds.buttons[i].left-bounds.buttons[i-1].right>=5,'Project action circles do not overlap');
   assert.ok(bounds.buttons[2].right<=bounds.rowRight);
   if(width<1400)assert.ok(bounds.buttons.every(b=>b.width>=44&&b.height>=44),'Touch targets remain full size');
  }
  await page.locator('.session-item-rename').evaluate(e=>e.click());assert.equal(await page.locator('.pg-project-rename').count(),1,'Rename is reachable from the action group');
  assert.deepEqual(page.errors,[]);await page.close();
 }
}

async function checkFabricGallery(){
// Owner standard: the served Global gallery must match In House, not a chat UI.
const root=resolve('.'),browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}});
const png=readFileSync('docs/aesthetics/ui/logo-circle.png'),reference='data:image/png;base64,'+png.toString('base64');
const catalog=JSON.parse(readFileSync('docs/aesthetics/fabrics/fabrics.json')).items;
const products=catalog.map((p,i)=>({url:'https://cloth.example/products/fabric-'+i,title:p.name,image:'https://photos.example/'+i+'.png',merchant:'cloth.example',evidence:'web_suggestion'}));
const token='fixture.'+Buffer.from(JSON.stringify({sub:'gallery-owner',exp:4000000000})).toString('base64url')+'.fixture';
let saved={},research={items:[],generation:'0',searched:false},calls=0,failed=false,holdSearch=true,releaseSearch;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(token=>{if(location.origin==='https://maya-gallery.test')localStorage.setItem('maya_admin_tok',token);window.setInterval=()=>0;},token);
await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='photos.example')return u.searchParams.has('failure')?route.fulfill({status:404,body:'Unavailable fixture photograph'}):route.fulfill({body:readFileSync(resolve(root,'docs/aesthetics/fabrics',catalog[Number(u.pathname.split('/').pop().split('.')[0])].thumbnail)),contentType:'image/jpeg'});
 if(u.hostname!=='maya-gallery.test')return route.abort();
 if(u.pathname==='/api/design')return route.fulfill({json:saved});
 if(u.pathname==='/api/admin/design'){saved=route.request().postDataJSON();assert.ok(validDesign(saved));return route.fulfill({json:{ok:true,savedAt:'2026-11-04'}});}
 if(u.pathname==='/api/admin/patterns')return route.fulfill({json:{generation:'0',fingerprint:'fixture',runs:[],settings:{}}});
 if(u.pathname==='/api/admin/fabrics/research')return route.fulfill({json:research});
 if(u.pathname==='/api/admin/fabrics/search'){
  calls++;if(holdSearch)await new Promise(resolve=>{releaseSearch=resolve;});
  // Exercise the real adapter from the documented OpenAI payload to the browser.
  const events=[],service=createFabricSearch({apiKey:()=> 'fixture',fetchImpl:async target=>{
   assert.equal(target,'https://api.openai.com/v1/responses');
   const results=products.map(p=>({type:'image_result',source_website_url:p.url,image_url:p.image+(failed?'?failure=1':''),caption:p.title}));
   return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{type:'web_search_call',results}]}})+'\n\n');
  }});
  await service.search({sub:'gallery-owner'},{request:'Green apparel fabric',image:reference},event=>events.push(event));
  research={items:events.at(-1).products,generation:String(calls),searched:true};
  return route.fulfill({contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
 }
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],generation:'0'}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+(u.pathname.startsWith('/aesthetics/')?'/docs':'')+decodeURIComponent(u.pathname))),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.JPG':'image/jpeg'})[extname(u.pathname)]||'text/plain'});}catch{return route.abort();}
});
const tab=name=>page.locator('.fa-tabs').getByRole('button',{name,exact:true});
const refreshSearch=async()=>{
 // Preparing the saved reference is asynchronous. An idle aria-busy value
 // immediately after click does not establish that the search has started.
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/fabrics/search'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await response;
 await page.waitForFunction(()=>document.getElementById('fabric-assistant').getAttribute('aria-busy')==='false');
};
const reopenResearch=(forceReset=true)=>page.evaluate(({reference,forceReset})=>MayaFabricAssistant.open({host:document.getElementById('brief-fabrics'),submissionId:'gallery-project',referenceImage:reference,automatic:true,forceReset,reopenSaved:showBriefFabrics,piece:{id:'coat',name:'Coat'},pieces:[{id:'coat',name:'Coat'}]}),{reference,forceReset});
const measure=()=>page.locator('#fabric-assistant').evaluate(root=>{
 const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,top:r.top,left:r.left,overflowX:s.overflowX,overflowY:s.overflowY,columns:s.gridTemplateColumns,rows:s.gridTemplateRows,gap:s.gap,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,pad:[s.paddingLeft,s.paddingTop],material:s.backgroundColor,fit:s.objectFit};};
 const first=root.querySelector('.fa-product:not([hidden])');return {body:rect(root.querySelector('.fa-body')),grid:rect(root.querySelector('.fa-results')),card:rect(first),photo:rect(first.querySelector('img')),title:rect(first.querySelector('.fa-card-title')),caption:rect(first.querySelector('.fa-card-caption')),controls:[...root.querySelectorAll('button,textarea')].filter(el=>!el.closest('.fa-card-actions')&&el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>el.textContent||el.getAttribute('aria-label'))};
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
    const heights=await page.locator('.fa-toolbar>button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().height));assert.ok(Math.max(...heights)-Math.min(...heights)<1,'Refresh, CSV and Expand share their height');
    assert.deepEqual(global.controls,['In House','Global','Favorites','Refresh fabrics','CSV',mode==='inline'?'Expand':'Collapse']);
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
   if(mode==='expanded'){await page.mouse.click(1,1);await page.waitForFunction(()=>!document.getElementById('fabric-assistant-dialog').open);assert.equal(await page.locator('.fa-product:visible').count(),8,'Outside click collapses without dropping results');}
  }
 }
 assert.equal(calls,1,'Comparing gallery views never repeats paid search');
 // Reopening reads saved research; Refresh keeps mounted healthy photos.
 await tab('Global').click();await reopenResearch();
 await page.locator('.fa-product-image').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 await page.evaluate(()=>{window._retainedFabricImage=document.querySelector('.fa-product-image');});
 await reopenResearch(false);
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product-image')===window._retainedFabricImage),true,'Reopening saved research preserves the already loaded photo even without preparing its reference again');
 await tab('In House').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());await tab('Global').click();
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product-image')===window._retainedFabricImage),true,'Switching gallery tabs reuses the decoded Global photograph');
 assert.equal(calls,1);failed=true;await refreshSearch();assert.equal(calls,2);
 assert.ok(research.items.every(p=>new URL(p.image).searchParams.has('failure')),'Saved fixture must contain the failed URLs before reopening');
 assert.equal(await page.evaluate(()=>document.querySelector('.fa-product-image')===window._retainedFabricImage),true,'Refreshing cannot discard a loaded photo');
 // A fresh mount of the failed saved URLs still retains all source links.
 await reopenResearch();
 await page.locator('.fa-product.has-missing-photo').first().waitFor();assert.equal(await page.locator('.fa-product:visible').count(),8);assert.equal(await page.getByText('Photo unavailable',{exact:true}).count(),0);assert.equal(calls,2,'Failures do not retry the provider automatically');
 await page.waitForFunction(()=>document.querySelectorAll('.fa-product.has-missing-photo').length===8);
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.locator('.fa-results').evaluate(el=>[...el.querySelectorAll('a')].every(a=>a.href.startsWith('https://cloth.example/')&&a.getBoundingClientRect().right<=innerWidth+1)));
  const sourceCards=await page.locator('.fa-product.has-missing-photo').evaluateAll(cards=>cards.map(card=>{const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return {card:bounds(card),actions:bounds(card.querySelector('.fa-card-actions')),title:bounds(card.querySelector('.fa-card-title')),caption:bounds(card.querySelector('.fa-card-caption'))};}));
  assert.equal(sourceCards.length,8);
  for(const {card,actions,title,caption}of sourceCards){
   assert.ok(actions.bottom<=title.top+1&&title.bottom<=caption.top+1,'Source-only favorite/dismiss actions leave both caption rows readable at '+width);
   assert.ok(actions.left>=card.left-1&&actions.right<=card.right+1&&caption.bottom<=card.bottom+1,'Source-only actions and captions stay inside their card at '+width);
  }
 }
 failed=false;await refreshSearch();
 await page.waitForFunction(()=>{const cards=[...document.querySelectorAll('.fa-product')];return cards.length===8&&cards.every(card=>{const img=card.querySelector('.fa-product-image');return img?.complete&&img.naturalWidth>0;});});
 assert.equal(await page.locator('.fa-product:visible').count(),8);assert.equal(calls,3);
 // A session reset clears private data without restoring chat controls. Explicit
 // Refresh asks the host for its current canonical saved garment after renewal.
 await page.evaluate(()=>{const old=localStorage.getItem('maya_admin_tok');const p=JSON.parse(atob(old.split('.')[1]));p.exp=1;localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify(p))+'.fixture');window.dispatchEvent(new Event('focus'));});
 assert.equal(await page.locator('.fa-product').count(),0);assert.equal(await page.locator('.fa-composer').isVisible(),false);
 await page.evaluate(token=>localStorage.setItem('maya_admin_tok',token),token);
 await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
 assert.equal(calls,3,'Session renewal reloads saved sources without another search');
 await page.evaluate(()=>MayaTypographyControls.save(MayaTypographyControls.defaults));
 await page.goto('https://maya-gallery.test/aesthetics/aesthetic-control.html');await page.locator('#workspace-previews > summary').click();
 assert.equal(await page.locator('#workspace-previews textarea,#workspace-previews .fa-composer').count(),0,'Aesthetic Control cannot restore the unrequested composer');
 const operationPreview=page.locator('#operations-layout-preview');
 await page.setViewportSize({width:1440,height:1000});
 const previewBounds=()=>operationPreview.locator('[data-maya-operation-fixed]').evaluate(el=>{const origin=el.getBoundingClientRect().top,r=e=>{const b=e.getBoundingClientRect();return {top:b.top-origin,bottom:b.bottom-origin,height:b.height};};return {garment:r(el.querySelector('.operation-layout-garment')),pattern:r(el.querySelector('.operation-layout-pattern'))};});
 const beforePattern=await previewBounds();assert.ok(Math.abs(beforePattern.garment.height-beforePattern.pattern.height)<2);
 await operationPreview.getByRole('button',{name:'Start',exact:true}).click();await operationPreview.locator('.operation-layout-pattern img').evaluate(img=>img.decode());
 assert.deepEqual(await previewBounds(),beforePattern,'Active preview keeps its fixed frames when a drawing arrives');
 const backendTwoPreview=page.locator('#backend-two-layout-preview');
 const snapshotBounds=()=>backendTwoPreview.locator('.backend-two-preview-columns').evaluate(el=>{const origin=el.getBoundingClientRect(),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top,width:r.width,height:r.height};};return {width:origin.width,height:origin.height,panels:[...el.children].map(rect),frames:[...el.querySelectorAll('.operation-layout-garment,.operation-layout-pattern')].map(rect)};});
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await backendTwoPreview.getByRole('button',{name:'Pattern',exact:true}).click();
  const snapshot=await snapshotBounds(),[left,right]=snapshot.panels,[garment,pattern]=snapshot.frames;
  assert.ok(await backendTwoPreview.locator('.backend-two-preview-columns').evaluate(el=>[...el.children].every(c=>!c.hasAttribute('data-maya-panel'))&&[...el.querySelectorAll('.operation-layout-garment,.operation-layout-pattern')].every(c=>c.dataset.mayaPanel==='inner')),'Compact preview puts Inner material on frames only');
  assert.equal(await backendTwoPreview.getByRole('button',{name:'Start',exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'9px');
  assert.ok(left.right<=right.left+1&&right.right<=snapshot.width+1,'Backend 2 preview keeps both panels side by side at '+width);
  assert.ok(Math.abs(garment.top-pattern.top)<2&&Math.abs(garment.bottom-pattern.bottom)<2,'Backend 2 preview aligns garment and pattern frames despite wrapped controls at '+width);
  for(const frame of snapshot.frames)assert.ok(frame.width>0&&frame.height>0&&frame.top>=0&&frame.bottom<=snapshot.height+1,'Backend 2 preview contains both complete frames at '+width);
  await backendTwoPreview.getByRole('button',{name:'CLO 3D',exact:true}).click();
  await backendTwoPreview.locator('.clo-card').waitFor();
  assert.deepEqual(await snapshotBounds(),snapshot,'CLO references preserve the paired frame geometry');
  await backendTwoPreview.getByRole('button',{name:'Pipeline',exact:true}).click();
  assert.deepEqual(await snapshotBounds(),snapshot,'Backend 2 preview keeps its paired geometry when Pipeline replaces the pattern at '+width);
 }
 const projectPreview=page.locator('#project-actions-preview');await projectPreview.getByRole('button',{name:'Rename preview project'}).click();await projectPreview.getByRole('textbox',{name:'Rename preview project'}).fill('Renamed preview');await projectPreview.getByRole('textbox',{name:'Rename preview project'}).press('Tab');assert.equal(await projectPreview.locator('[data-maya-type=H4]').textContent(),'Renamed preview');
 const preview=page.locator('#workspace-previews');await preview.getByRole('button',{name:'Global',exact:true}).click();assert.equal(await preview.locator('.fa-status').textContent(),'Searching for Fabrics');assert.equal(await preview.locator('.fa-status').getAttribute('data-maya-type'),'P1');await preview.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const rect=()=>preview.locator('.fa-results').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,rows:getComputedStyle(el).gridTemplateRows,cards:[...el.children].map(c=>[c.clientWidth,c.clientHeight,c.querySelector('img').clientHeight])}));await preview.getByRole('button',{name:'In House',exact:true}).click();const local=await rect();await preview.getByRole('button',{name:'Global',exact:true}).click();assert.deepEqual(await rect(),local);}
 for(const changed of [false,true]){
  await page.locator('[data-category="P1"] summary').first().click();
  for(const [key,value] of Object.entries({font:changed?'cormorant':'jost',size:changed?16:12,color:changed?'white':'gray'})){const field=page.locator('[data-category="P1"] [data-field="'+key+'"]').first();if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));}
  await page.keyboard.press('Escape');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const style=await preview.locator('.fa-status').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {size:s.fontSize,font:s.fontFamily,color:s.color,margin:s.marginTop,right:r.right};});assert.equal(style.size,changed?'16px':'12px');assert.match(style.font,changed?/Cormorant/:/Jost/);assert.equal(style.color,changed?'rgb(255, 255, 255)':'rgb(170, 181, 196)');assert.equal(style.margin,'0px');assert.ok(style.right<=width+1);}
  process.env.MAYA_CAPTURE&&await preview.screenshot({path:'/private/tmp/maya-clean-preview-'+(changed?'saved':'default')+'.png'});
 }
 assert.equal(calls,3,'Aesthetic previews make no searches');assert.deepEqual(errors,[]);
 console.log('Fabric gallery: exact In House/Global parity, two caption rows, same scrolling, default/saved settings, six widths, photo failure/recovery and active preview passed.');
}catch(error){console.error(error);console.error((await page.locator('body').innerText()).slice(-2500));process.env.MAYA_CAPTURE&&await page.screenshot({path:'/private/tmp/maya-global-gallery-failure.png'});throw error;}finally{await browser.close();}

}

// CI-only geometry and keyboard checks; local code-only verification never launches this.
async function checkBackendTwo(){
 for(const [width,height]of [[390,844],[768,1024],[1440,900]]){
  const page=await open('/backend/backend2.html',width,height);
  await page.route('**/api/admin/patterns?*',route=>route.fulfill({json:{generation:'0',runs:[],settings:{}}}));
  await page.route('**/api/admin/fabrics/research?*',route=>route.fulfill({json:{generation:'0',items:[],searched:true}}));
  await page.route('**/api/admin/fabrics/favorites',route=>route.fulfill({json:{generation:'0',items:[]}}));
  await page.evaluate(()=>{
   localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify({sub:'snapshot-owner',exp:Math.floor(Date.now()/1000)+3600}))+'.fixture');
   document.getElementById('upload-gate').classList.add('hidden');
   const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="gray"/></svg>');
   const pieces=[{id:'coat',name:'Coat',_image:photo,fabric:'Wool'}];window._openedSubmission={id:'snapshot-project'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:photo,card:{_dissection:{pieces}}};_publishSavedOperations({pieces});
  });
  const engineFrame=page.frames().find(f=>f.url().includes('operation-workspace.html'));
  await engineFrame.waitForFunction(()=>document.getElementById('test-picker').value==='__full__');
  for(const changed of [false,true]){
   for(const target of [page,engineFrame])await target.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.pillX=18;d.pillY=9;d.inner.paddingX=18;d.inner.paddingY=19;d.inner.background='blue';d.inner.fill=65;d.inner.blur=12;d.type.P3.size=14;d.drawer.background='green';d.drawer.fill=80;d.drawer.paddingX=20;d.drawer.paddingY=22;d.drawer.blur=14;d.drawer.radius=12;}MayaTypographyControls.apply(d);},changed);
   const bounds=await page.evaluate(()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};};return {screen:r('screens'),image:r('operations-embed'),fabric:r('backend-two-fabric-strip')};});
   assert.ok(bounds.image.height>150&&bounds.fabric.height>150);assert.ok(bounds.image.bottom<bounds.fabric.top);assert.ok(bounds.fabric.bottom<=height&&bounds.screen.right<=width);
   assert.equal(await engineFrame.locator('#plan-a-view > .cols > .panel').count(),0,'Backend 2 has no outer column panels');
   const pair=await engineFrame.locator('#plan-a-view > .cols > .backend-two-column').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};}));
   assert.ok(pair[0].right<pair[1].left&&Math.abs(pair[0].bottom-pair[1].bottom)<2);assert.ok(pair[1].right<=bounds.image.right-bounds.image.left+1);
   const compact=await engineFrame.evaluate(()=>{const style=e=>{const s=getComputedStyle(e);return {padding:s.paddingTop,paddingX:s.paddingLeft,border:s.borderTopWidth,bg:s.backgroundColor,blur:s.backdropFilter,font:s.fontSize};};return {columns:[...document.querySelectorAll('.backend-two-column')].map(style),frames:[...document.querySelectorAll('#hero-frame,#stage')].map(e=>({...style(e),inner:e.dataset.mayaPanel})),controls:[...document.querySelectorAll('.operation-layout-toolbar button:not([hidden]),.operation-layout-toolbar select')].map(e=>({...style(e),right:e.getBoundingClientRect().right})),width:innerWidth};});
   assert.ok(compact.columns.every(c=>c.padding==='0px'&&c.border==='0px'&&c.bg==='rgba(0, 0, 0, 0)'),'Column wrappers contribute no nested material or padding');
   assert.ok(compact.frames.every(f=>f.inner==='inner'&&f.padding==='0px'&&f.paddingX==='0px'&&parseFloat(f.border)>0),'Only the image/pattern frames retain Inner material, without image padding');
   if(changed)assert.ok(compact.frames.every(f=>f.bg==='rgba(35, 76, 125, 0.65)'&&f.blur.includes('blur(12px)')),'Saved Inner material still reaches compact frames');
   assert.ok(compact.controls.every(c=>c.font==='9px'&&c.padding==='5px'&&c.right<=compact.width+1),'Compact toolbar text and padding remain scoped and contained with either saved preset');
   const fabricCompact=await page.locator('#backend-two-fabric-strip .fabric-assistant').evaluate(e=>{const s=getComputedStyle(e),b=getComputedStyle(e.querySelector('.fa-tabs button'));return {padding:s.paddingTop,paddingX:s.paddingLeft,border:s.borderTopWidth,bg:s.backgroundColor,font:b.fontSize,pillY:b.paddingTop};});
   assert.deepEqual(fabricCompact,{padding:'0px',paddingX:'0px',border:'0px',bg:'rgba(0, 0, 0, 0)',font:'9px',pillY:'5px'});
   const drawerStyle=await page.locator('#clients-drawer').evaluate(e=>{const s=getComputedStyle(e);return {role:e.hasAttribute('data-maya-drawer'),padding:s.paddingTop,paddingX:s.paddingLeft,radius:s.borderTopLeftRadius,bg:s.backgroundColor,blur:s.backdropFilter};});
   assert.equal(drawerStyle.role,true);assert.equal(drawerStyle.padding,changed?'22px':'16px');assert.equal(drawerStyle.paddingX,changed?'20px':'12px');assert.equal(drawerStyle.radius,changed?'12px':'18px');assert.equal(drawerStyle.bg,changed?'rgba(23, 91, 59, 0.8)':'rgba(3, 15, 29, 0.9)');assert.ok(drawerStyle.blur.includes(changed?'blur(14px)':'blur(28px)'),'Backend 2 drawer follows shared saved Drawer effects');
   await engineFrame.getByRole('tab',{name:'CLO 3D',exact:true}).click();assert.ok(await engineFrame.locator('#backend-two-clo').isVisible());assert.equal(await engineFrame.locator('#stage').isVisible(),false);
   const cloBounds=await engineFrame.locator('#backend-two-clo').boundingBox();assert.ok(cloBounds.width>0&&cloBounds.height>0&&cloBounds.x+cloBounds.width<=bounds.image.right-bounds.image.left+1);
   await engineFrame.getByRole('tab',{name:'Pipeline',exact:true}).click();assert.ok(await engineFrame.locator('#backend-two-pipeline').isVisible());assert.equal(await engineFrame.locator('#stage').isVisible(),false);
   await engineFrame.getByRole('tab',{name:'Pattern',exact:true}).click();assert.ok(await engineFrame.locator('#stage').isVisible());
  }
  await page.locator('#top-actions .hamburger').click();assert.deepEqual(await page.locator('.backend-two-tabs button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['Submissions','Bio','Settings']);assert.equal(await page.getByRole('tab',{name:'Submissions',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.locator('#clients-drawer>.drawer-title').isVisible(),false);
  await page.waitForFunction(()=>document.getElementById('clients-drawer').getBoundingClientRect().right<=innerWidth+1);
  const drawerBounds=await page.locator('#clients-drawer').boundingBox();assert.ok(drawerBounds.x>=0&&drawerBounds.x+drawerBounds.width<=width+1,'Drawer stays within the viewport');
  await page.getByRole('tab',{name:'Bio',exact:true}).click();assert.ok(await page.locator('#backend-two-bio').isVisible());
  await page.getByRole('tab',{name:'Settings',exact:true}).click();assert.ok(await page.locator('#backend-two-settings').isVisible());
  await page.getByRole('tab',{name:'Submissions',exact:true}).click();assert.ok(await page.locator('#backend-two-submissions').isVisible());
  await page.keyboard.press('Escape');assert.equal(await page.locator('#clients-drawer').evaluate(e=>e.inert),true);
  assert.deepEqual(page.errors,[]);await page.close();
 }
 const admin=await open('/backend/status.html');
 const order=await admin.locator('details.fold[data-maya-section]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.deepEqual(order.slice(0,3),['users-fold','ads-fold','leads-fold']);
 await admin.evaluate(()=>document.querySelectorAll('details.fold').forEach(e=>e.open=false));
 for(const gap of [16,34]){
  await admin.evaluate(gap=>{const d=structuredClone(MayaTypographyControls.defaults);d.sectionSpacing={...d.sectionSpacing,insights:gap};MayaTypographyControls.apply(d);},gap);
  const margins=await admin.locator('#users-fold,#ads-fold,#leads-fold,#changes-fold,#features-fold').evaluateAll(nodes=>nodes.map(n=>parseFloat(getComputedStyle(n).marginTop)));assert.ok(margins.every(value=>value===gap));
 }
 assert.deepEqual(admin.errors,[]);await admin.close();
}
