// Isolated browser acceptance. All cloud/image/delete transports are fake.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {readFileSync,existsSync} from 'node:fs';
import {validDesign} from '../backend/server/design-config.mjs';
import {createFabricSearch} from '../backend/server/fabrics.mjs';
import {createDigitalAssets} from '../backend/server/digital-assets.mjs';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
const assets=existsSync(root+'/docs/aesthetics')?'/docs':'';
const engine=process.env.MAYA_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch();
const measure=[];
async function open(path,width=1194,height=834){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<1400,isMobile:width<1400});
 page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.addInitScript(()=>{window.setInterval=()=>0;});
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='maya.test')return route.abort();
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,folders:[],threads:[]}});
  let path=decodeURIComponent(url.pathname);if(path.startsWith('/aesthetics/'))path=assets+path;
  try{return route.fulfill({body:readFileSync(root+path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
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
 await gallery.waitForFunction(()=>{const e=document.querySelector('.maya-notes-preview .maya-design-notes');return e.getBoundingClientRect().left-e.closest('.maya-notes-preview').getBoundingClientRect().left>=12;});
 const notesGeometry=await notes.locator('.maya-design-notes').evaluate(e=>({width:e.getBoundingClientRect().width,label:e.parentNode.querySelector('.maya-notes-label').hidden,left:e.getBoundingClientRect().left-e.closest('.maya-notes-preview').getBoundingClientRect().left}));assert.equal(notesGeometry.width,272);assert.equal(notesGeometry.label,true);assert.ok(notesGeometry.left>=12);
 await notes.locator('.maya-design-notes').dispatchEvent('pointerdown',{pointerId:55,isPrimary:true,button:0,clientX:30,clientY:50});await notes.locator('.maya-design-notes').dispatchEvent('pointermove',{pointerId:55,isPrimary:true,button:0,clientX:100,clientY:50});await notes.locator('.maya-design-notes').dispatchEvent('pointerup',{pointerId:55,isPrimary:true,button:0,clientX:100,clientY:50});
 assert.equal(await notes.locator('.maya-design-notes').evaluate(e=>e.inert),true,'A rightward swipe closes the active Notes sample');
 await notes.getByRole('button',{name:'Design Notes',exact:true}).click();await notes.getByRole('button',{name:'Collapse design notes',exact:true}).click();
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
 for(const [name,check]of [['Submission drawer',checkSubmissionDrawer],['Original operation layout',checkOperationLayout],['Project actions',checkProjectActions],['Frontend cards',checkFrontendCards],['Fabric gallery',checkFabricGallery],['CLO preview',checkCloPreview]]){
  const started=performance.now();console.log('UI START '+name);await check();console.log('UI PASS '+name+' ('+Math.round(performance.now()-started)+'ms)');
 }
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
  await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.glass.fill=65;d.glass.blur=12;d.pillX=18;d.pillY=9;}MayaTypographyControls.apply(d);},changed);
  const dots=await page.locator('#page-indicator .page-dot').evaluateAll(nodes=>nodes.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {active:e.classList.contains('active'),current:e.getAttribute('aria-current'),width:r.width,height:r.height,background:s.backgroundColor,opacity:s.opacity};}));
  assert.equal(dots.filter(d=>d.active).length,1);
  for(const dot of dots){assert.equal(dot.width,6);assert.equal(dot.height,6);if(dot.active){assert.equal(dot.current,'page');assert.equal(dot.background,'rgb(255, 255, 255)');assert.equal(dot.opacity,'1');}}
  await frame.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P3.size=14;d.pillX=18;d.pillY=9;d.inner.paddingX=19;d.inner.paddingY=13;}MayaTypographyControls.apply(d);},changed);
  const layout=await frame.evaluate(()=>{const cols=document.querySelector('#plan-a-view .cols'),r=[...cols.children].map(e=>e.getBoundingClientRect()),image=document.getElementById('hero-img'),picker=document.getElementById('test-picker'),style=getComputedStyle(picker);return {columns:r.map(r=>({x:r.x,y:r.y,width:r.width})),overflow:document.documentElement.scrollWidth>innerWidth+1,fit:getComputedStyle(image).objectFit,position:getComputedStyle(image).objectPosition,pad:parseFloat(style.paddingRight),font:parseFloat(style.fontSize),arrow:style.backgroundImage.includes('data:image/svg+xml'),customArrows:document.querySelectorAll('.picker-chevron').length};});
  assert.equal(layout.overflow,false,'Operation layout overflow: '+JSON.stringify({width,changed,layout}));assert.equal(layout.fit,'cover');assert.match(layout.position,/50%/);assert.equal(layout.customArrows,0);assert.equal(layout.arrow,true);assert.ok(layout.pad>layout.font,'Native select reserves space for its one chevron');
  const geometry=()=>frame.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
   const hero=document.getElementById('hero-frame'),stage=document.getElementById('stage'),toolbar=hero.previousElementSibling;
   return {hero:rect(hero),stage:rect(stage),left:rect(hero.parentNode),right:rect(stage.parentNode),toolbar:rect(toolbar),picker:rect(document.getElementById('test-picker')),start:rect(document.getElementById('start-test')),
    pills:[...document.querySelectorAll('#start-test,#pass-pills button,#test-picker')].map(e=>{const s=getComputedStyle(e);return [s.paddingTop,s.paddingBottom,s.paddingLeft,s.fontSize,s.lineHeight,s.fontFamily,s.fontWeight];}),pillBounds:[...document.querySelectorAll('#start-test,#pass-pills button,#test-picker')].map(rect),logicInStage:document.getElementById('original-operation-logic')?.parentNode===stage,pipelineInLogic:document.getElementById('live').parentNode.id==='original-operation-logic',traceHeading:document.querySelector('#original-operation-logic h3')?.textContent};
  });
  const compact=await geometry();assert.ok(compact.start.bottom<=compact.hero.top);assert.ok(compact.picker.bottom<=compact.hero.top);
  assert.ok(compact.logicInStage&&compact.pipelineInLogic,'Retrieval and Pipeline belong to the Logic view inside the pattern frame');assert.equal(compact.traceHeading,'Pipeline');
  assert.equal(await frame.locator('#plan-a-view > .trace').count(),0,'Retrieval no longer adds a second section beneath the two frames');
  assert.deepEqual(await frame.locator('#pass-pills button').allTextContents(),['Mark 1','CLO 3D','Pipeline']);
  for(const pill of compact.pills)assert.deepEqual(pill,compact.pills[0],'Operation toolbar pills share P3 and Glass padding');
  const basePadding=await frame.evaluate(()=>({x:MayaTypographyControls.defaults.pillX,y:MayaTypographyControls.defaults.pillY,font:MayaTypographyControls.defaults.type.P3.size}));
  assert.equal(parseFloat(compact.pills[0][0]),Math.max(0,(changed?9:basePadding.y)-1));assert.equal(parseFloat(compact.pills[0][2]),Math.max(0,(changed?18:basePadding.x)-1));assert.equal(parseFloat(compact.pills[0][3]),changed?14:basePadding.font);
  if(width>768){
   for(const edge of ['top','bottom']){assert.ok(Math.abs(compact.hero[edge]-compact.stage[edge])<2,'Frames align at '+edge);assert.ok(Math.abs(compact.left[edge]-compact.right[edge])<2,'Outer panels align at '+edge);}
   for(const pill of compact.pillBounds){assert.ok(Math.abs(pill.height-compact.picker.height)<1,'Toolbar controls have matching pill heights');assert.ok(Math.abs((pill.top+pill.bottom)/2-(compact.picker.top+compact.picker.bottom)/2)<1,'Toolbar controls share the same vertical center');}
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
  await frame.evaluate(()=>{const prompt=document.getElementById('t-prompt');prompt.textContent=Array.from({length:80},(_,i)=>'Reviewed construction step '+i).join('\n');prompt.closest('details').open=true;});
  await frame.locator('#pass-pills button').filter({hasText:/^Pipeline$/}).click();
  assert.equal(await frame.evaluate(()=>CUR.kind),'logic');assert.equal(await frame.locator('#original-operation-logic').isVisible(),true);assert.equal(await frame.locator('#img-grounded').isVisible(),false);
  const logicGeometry=await geometry();assert.deepEqual(logicGeometry.hero,compact.hero);assert.deepEqual(logicGeometry.stage,compact.stage);assert.deepEqual(logicGeometry.right,compact.right);
  const logic=await frame.locator('#original-operation-logic').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),stage=e.parentNode.getBoundingClientRect();e.scrollTop=80;return {padding:[parseFloat(s.paddingLeft),parseFloat(s.paddingTop)],overflow:s.overflowY,scroll:e.scrollTop,hasOverflow:e.scrollHeight>e.clientHeight,contained:r.left>=stage.left-1&&r.right<=stage.right+1&&r.top>=stage.top-1&&r.bottom<=stage.bottom+1};});
  assert.ok(logic.contained&&logic.hasOverflow&&logic.scroll>0,'Long Logic content scrolls within the unchanged pattern frame');assert.match(logic.overflow,/auto|scroll/);
  const innerPadding=await frame.evaluate(()=>MayaTypographyControls.defaults.inner);assert.deepEqual(logic.padding,changed?[19,13]:[innerPadding.paddingX,innerPadding.paddingY],'Logic follows saved Inner padding');
  await frame.evaluate(()=>setOperationRunning(true));assert.equal(await frame.locator('.original-operation-pipeline-dot').evaluate(e=>getComputedStyle(e).animationName),'original-operation-live');
  await frame.evaluate(()=>setOperationRunning(false));assert.equal(await frame.locator('.original-operation-pipeline-dot').evaluate(e=>getComputedStyle(e).animationName),'none');
  await frame.evaluate(()=>{TRACE={source:PASSES[CUR.idx].img,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10 10L90 90"/></svg>'};window.fixtureExportSVG=exportSVG;exportSVG=()=>window.fixtureExported=true;});
  assert.equal(await frame.evaluate(()=>exportOriginalSVG()),true);assert.equal(await frame.evaluate(()=>window.fixtureExported),true);await frame.evaluate(()=>{exportSVG=window.fixtureExportSVG;});assert.equal(await frame.locator('#original-operation-logic').isVisible(),true,'Settings export retains Pipeline');assert.deepEqual((await geometry()).stage,compact.stage);
  await frame.locator('#pass-pills button').filter({hasText:/^Mark 1$/}).click();assert.equal(await frame.locator('#original-operation-logic').isVisible(),false);assert.equal(await frame.locator('#img-grounded').isVisible(),true);assert.deepEqual((await geometry()).stage,compact.stage);
  const [left,right]=layout.columns;if(width>768)assert.ok(Math.abs(left.width/(left.width+right.width)-.34)<.01);else assert.ok(right.y>left.y,'Small screens stack the panels');
 }
 // The same parent drawer works from the Operations screen, using the
 // current submission's real engine controls rather than independent copies.
 await page.route('**/api/admin/patterns?*',route=>route.fulfill({json:{generation:'0',runs:[],settings:{}}}));
 await page.evaluate(()=>{
  localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify({sub:'original-owner',exp:Math.floor(Date.now()/1000)+3600}))+'.fixture');
  const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="gray"/></svg>'),pieces=[{id:'original-coat',name:'Coat',_image:photo}];
  window._openedSubmission={id:'original-drawer-project'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:photo,card:{_dissection:{pieces}}};_publishSavedOperations({pieces});
 });
 await frame.waitForFunction(()=>window.originalOperationContext?.()?.submissionId==='original-drawer-project'&&window.originalOperationContext?.()?.garmentId==='original-coat');
 await frame.evaluate(()=>{window.fixtureDrawerExport=exportOriginalSVG;exportOriginalSVG=()=>{window.fixtureDrawerExported=true;return Promise.resolve(true);};});
 for(const changed of [false,true])for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.drawer.background='green';d.drawer.fill=80;d.drawer.paddingX=20;d.drawer.paddingY=22;d.drawer.blur=14;d.drawer.radius=12;}MayaTypographyControls.apply(d);const host=document.getElementById('screens');host.scrollTop=document.getElementById('screen-operating').offsetTop;},changed);
  await page.waitForFunction(()=>_currentScreen===1);
  const indicator=await page.locator('#page-indicator').boundingBox();assert.equal(indicator.x,width<=640?6:12);assert.ok(Math.abs(indicator.width-(width<=640?15:17))<=1,'Screen pill keeps the frontend dot/padding width');
  await page.locator('#top-actions .hamburger').click();assert.equal(await page.locator('#clients-drawer').evaluate(e=>e.classList.contains('open')&&!e.inert),true,'Operations hamburger opens the shared parent drawer');
  assert.deepEqual(await page.locator('.original-drawer-tabs [role="tab"]').evaluateAll(nodes=>nodes.map(e=>e.getAttribute('aria-label'))),['Submissions','Settings']);
  await page.getByRole('tab',{name:'Submissions',exact:true}).click();assert.equal(await page.locator('#original-submissions').isVisible(),true);assert.equal(await page.locator('#drawer-settings').isVisible(),false);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.waitForFunction(()=>document.getElementById('original-setting-pattern-type'));
  assert.equal(await page.locator('#original-setting-pattern-type').isVisible(),true);assert.equal(await page.getByRole('button',{name:'Export as SVG',exact:true}).isVisible(),true);assert.equal(await page.locator('#original-export-svg').isEnabled(),true);
  assert.equal(await page.locator('#original-setting-pattern-type').inputValue(),await frame.locator('#pattern-type').inputValue(),'Settings mirrors the current garment category');
  const material=await page.locator('#clients-drawer').evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,blur:s.backdropFilter,paddingX:s.paddingLeft,paddingY:s.paddingTop,radius:s.borderTopLeftRadius};});
  assert.equal(material.bg,changed?'rgba(23, 91, 59, 0.8)':'rgba(3, 15, 29, 0.9)');assert.ok(material.blur.includes(changed?'blur(14px)':'blur(28px)'));assert.equal(material.paddingX,changed?'20px':'12px');assert.equal(material.paddingY,changed?'22px':'16px');assert.equal(material.radius,changed?'12px':'18px');
  assert.equal(await page.locator('#drawer-settings').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','Settings uses the same outer Drawer surface');
  await page.locator('#original-export-svg').click();assert.equal(await frame.evaluate(()=>window.fixtureDrawerExported),true,'Parent Settings forwards SVG export to the scoped engine');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#clients-drawer').evaluate(e=>e.inert),true);
 }
 await frame.evaluate(()=>{exportOriginalSVG=window.fixtureDrawerExport;});
 await page.setViewportSize({width:1440,height:900});
 await frame.locator('#original-operation-tab-grounded-0').focus();await frame.locator('#original-operation-tab-grounded-0').press('ArrowRight');
 assert.equal(await frame.evaluate(()=>CUR.kind),'clo');await frame.locator('#original-operation-tab-clo-0').press('ArrowRight');
 assert.equal(await frame.evaluate(()=>CUR.kind),'logic');await frame.evaluate(()=>applyView());assert.equal(await frame.evaluate(()=>document.activeElement?.id),'original-operation-tab-logic-0','Live repaint retains the keyboard-focused tab');
 await frame.locator('#original-operation-tab-logic-0').press('Home');assert.equal(await frame.evaluate(()=>CUR.kind),'grounded');
 // Native selector focus is released only for pointer selection. Keyboard
 // selection retains its focus target and visible focus indicator.
 await frame.evaluate(()=>{window.fixturePick=onPickTest;onPickTest=()=>{};window.fixturePicker=document.getElementById('test-picker').innerHTML;document.getElementById('test-picker').innerHTML='<option value="first">First garment</option><option value="second">Second garment</option>';});
 const picker=frame.locator('#test-picker');await picker.focus();await picker.dispatchEvent('pointerdown',{pointerType:'mouse'});await picker.selectOption('second');
 assert.equal(await picker.evaluate(e=>document.activeElement===e),false,'Pointer selection clears lingering selector focus');
 await page.keyboard.press('Tab');await picker.focus();await picker.press('ArrowDown');await picker.selectOption('first');
 assert.equal(await picker.evaluate(e=>document.activeElement===e),true,'Keyboard selection keeps focus');assert.equal(await picker.evaluate(e=>e.matches(':focus-visible')),true);
 await frame.evaluate(()=>{onPickTest=fixturePick;document.getElementById('test-picker').innerHTML=fixturePicker;});
 await frame.locator('#hero-frame').dispatchEvent('pointermove',{pointerType:'mouse',clientX:0});
 assert.match(await frame.locator('#hero-img').evaluate(image=>getComputedStyle(image).objectPosition),/^0%/);
 await frame.locator('#hero-frame').dispatchEvent('pointerleave',{pointerType:'mouse'});
 assert.match(await frame.locator('#hero-img').evaluate(image=>getComputedStyle(image).objectPosition),/^50%/);
 // Running state and SVG do not capture ordinary vertical scrolling. With
 // retrieval inside Logic, the last screen need not have extra space below it.
 await frame.evaluate(()=>{RUNNING=true;TRACE={svg:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10 10L90 90"/></svg>'};CUR={kind:'svg'};document.getElementById('trace-view').classList.remove('off');mountTrace();});
 assert.equal(await frame.locator('#trace-canvas').evaluate(canvas=>canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}))),true);
 await page.evaluate(()=>{const host=document.getElementById('screens');host.scrollTop=document.getElementById('screen-operating').offsetTop;});
 await page.waitForTimeout(100);
 const before=await page.locator('#screens').evaluate(e=>e.scrollTop);
 assert.ok(before>20,'Operation Room remains the second native screen');
 await page.mouse.move(1000,450);await page.mouse.wheel(0,-350);
 await page.waitForFunction(before=>document.getElementById('screens').scrollTop<before-20,before);
 assert.deepEqual(page.errors,[]);await page.close();
}

async function checkProjectActions(){
 for(const width of [390,768,1440]){
  const page=await open('/frontend/index.html',width,900);
  await page.evaluate(()=>{document.getElementById('signin-gate').style.setProperty('display','none','important');_renderSessionsDropdown=()=>{};toggleNotesDrawer(true);const list=document.getElementById('drawer-sessions-list');list.style.display='block';list.innerHTML=_projectRows([{id:'fixture-project',name:'A new reference project',createdAt:1}]);});
  for(const changed of [false,true]){
   await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.pillX=18;d.pillY=9;d.type.P3.size=14;}MayaTypographyControls.apply(d);},changed);
   await page.mouse.move(1,1);await page.evaluate(()=>document.activeElement?.blur());
   const centered=await page.locator('.session-item').evaluate(row=>{const r=row.getBoundingClientRect(),text=row.querySelector('.session-item-title').getBoundingClientRect();return {offset:Math.abs((text.left+text.right-r.left-r.right)/2),coarse:matchMedia('(any-pointer:coarse)').matches};});if(!centered.coarse)assert.ok(centered.offset<1,'Project name is centered across the full row when actions are hidden');
   await page.locator('.session-item').hover();
   const bounds=await page.locator('.session-item-actions').evaluate(group=>{const row=group.closest('.session-item'),r=row.getBoundingClientRect();return {width:row.clientWidth,scroll:row.scrollWidth,rowRight:r.right,buttons:[...group.children].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};})};});
   assert.ok(bounds.scroll<=bounds.width+1,'Project action row fits the drawer');
   for(let i=1;i<3;i++)assert.ok(bounds.buttons[i].left-bounds.buttons[i-1].right>=2,'Closer project action circles do not overlap');
   assert.ok(bounds.buttons[2].right<=bounds.rowRight);
   if(width<1400)assert.ok(bounds.buttons.every(b=>b.width>=44&&b.height>=44),'Touch targets remain full size');
  }
  await page.locator('.session-item-rename').evaluate(e=>e.click());assert.equal(await page.locator('.pg-project-rename').count(),1,'Rename is reachable from the action group');
  assert.deepEqual(page.errors,[]);await page.close();
 }
}

async function checkFrontendCards(){
 const page=await open('/frontend/index.html',1440,900);
 await page.evaluate(()=>{
  document.getElementById('signin-gate').style.setProperty('display','none','important');
  const card=document.createElement('div');card.id='caption-fixture';card.className='item-card inspo touched';card.tabIndex=0;card.style.cssText='left:100px;top:120px;width:220px;height:230px;animation:none';
  card.innerHTML='<button class="fav-btn" aria-label="Favorite" aria-pressed="false"><svg class="heart-svg" viewBox="0 0 24 24"><path d="M12 21L3 9L6 3L12 7L18 3L21 9Z"/></svg></button><img class="inspo-thumb" src="/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg"><div class="item-caption" data-maya-type="P3">A velvet coat</div><div class="item-card-actions"><button class="dissect-btn" data-maya-pill="glass">Dissect</button><button class="stack-btn" data-maya-pill="glass" data-maya-shape="circle"><span>⧉</span></button><button class="delete-btn" data-maya-dismiss><span>×</span></button></div>';document.getElementById('maya-canvas').append(card);
  const reference=document.createElement('div');reference.className='community-card';reference.style.cssText='position:absolute;left:400px;top:120px';reference.innerHTML='<span class="cc-summary">A velvet coat</span>';document.getElementById('maya-canvas').append(reference);
 });
 for(const width of [390,768,1440])for(const changed of [false,true]){
  await page.setViewportSize({width,height:900});await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P1.size=16;d.type.P1.weight=400;d.type.H2.font='jost';d.pillX=9;d.pillY=7;}MayaTypographyControls.apply(d);document.activeElement?.blur();},changed);
  await page.mouse.move(2,2);await page.waitForFunction(()=>getComputedStyle(document.querySelector('#caption-fixture .item-caption')).opacity==='0');
  const copy=await page.locator('#caption-fixture .item-caption,.community-card .cc-summary').evaluateAll(nodes=>nodes.map(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.textTransform,s.lineHeight,s.color];}));assert.deepEqual(copy[0],copy[1],'Inspo and Community descriptions share typography, including saved settings');assert.equal(copy[0].at(-1),'rgb(255, 255, 255)','Photo captions remain white');
  await page.locator('#caption-fixture').hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#caption-fixture .item-caption')).opacity==='1');
  const buttons=await page.locator('#caption-fixture .item-card-actions>button').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,height:r.height};}));for(const b of buttons){assert.ok(Math.abs(b.y-buttons[0].y)<1);assert.ok(Math.abs(b.height-buttons[0].height)<1,'Dissect, stack and X have one pill height');}
  const heart=page.locator('#caption-fixture>.fav-btn');const heartBounds=await heart.boundingBox();assert.ok(Math.abs(heartBounds.y-buttons[0].y)<1&&Math.abs(heartBounds.height-buttons[0].height)<1,'Heart shares the aligned smaller action height');assert.equal(await heart.evaluate(e=>getComputedStyle(e).zIndex),'4','Favorite control stays above the photograph');
  const sizing=await heart.evaluate(e=>{const s=getComputedStyle(e),read=name=>parseFloat(s.getPropertyValue(name)),base=Math.max(read('--maya-type-P1-size')*1.4,read('--maya-control-icon-size')*.6)+Math.max(read('--maya-control-pillX'),read('--maya-control-pillY'))*2+2;return {actual:e.getBoundingClientRect().height,expected:base*.75};});assert.ok(Math.abs(sizing.actual-sizing.expected)<1,'Desktop card actions are 25% smaller');
  await heart.evaluate(e=>e.classList.add('is-fav'));await page.mouse.move(2,2);await page.waitForFunction(()=>getComputedStyle(document.querySelector('#caption-fixture>.fav-btn')).opacity==='1');await heart.evaluate(e=>e.classList.remove('is-fav'));
  await page.mouse.move(2,2);await page.keyboard.press('Tab');await page.locator('#caption-fixture').focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#caption-fixture .item-caption')).opacity==='1');await page.locator('#caption-fixture').evaluate(e=>e.blur());
 }
 await page.evaluate(()=>{
  document.getElementById('notes-drawer').classList.add('open');document.body.classList.add('drawer-open');
  document.getElementById('pinterest-drawer').classList.add('open');document.getElementById('fabrics-drawer').classList.add('open');
  document.getElementById('pinterest-drawer-body').innerHTML='<div class="pin-grid">'+Array.from({length:16},()=>'<button class="pin-pic"><img src="/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg" alt="Preview"></button>').join('')+'</div>';
  document.getElementById('fabrics-drawer-body').innerHTML='<div class="fabrics-grid">'+Array.from({length:16},()=>'<div class="fabric-card"><div class="fabric-swatch"></div><div class="fabric-meta"><input class="fabric-name-input" value="Velvet"><div class="fabric-spec">Lightweight</div></div></div>').join('')+'</div>';
 });
 for(const width of [390,768,1440])for(const which of ['pinterest','fabrics']){
  await page.setViewportSize({width,height:900});await page.evaluate(which=>{for(const pane of document.querySelectorAll('#notes-drawer .pg-pane'))pane.style.display=pane.id==='pg-pane-'+which?'flex':'none';},which);
  const wall=await page.locator('#'+which+'-drawer-body').evaluate(body=>{const s=getComputedStyle(body),r=body.getBoundingClientRect(),grid=body.querySelector('.pin-grid,.fabrics-grid').getBoundingClientRect(),card=body.querySelector('.pin-pic,.fabric-card').getBoundingClientRect();return {padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],gutter:s.scrollbarGutter,left:grid.left-r.left,right:r.right-grid.right,card:{width:card.width,height:card.height}};});
  assert.deepEqual(wall.padding,['4px','4px','4px','4px']);assert.equal(wall.gutter,'stable both-edges');assert.ok(Math.abs(wall.left-wall.right)<1,'Gallery gutters are symmetric');if(which==='fabrics')assert.ok(Math.abs(wall.card.width-wall.card.height)<1,'Frontend fabric tiles stay square');
  if(which==='fabrics'){const text=await page.locator('.fabric-card').first().evaluate(e=>[...e.querySelectorAll('.fabric-name-input,.fabric-spec')].map(n=>{const s=getComputedStyle(n);return {color:s.color,line:s.lineHeight,margin:s.marginTop};}));assert.deepEqual(text[0],text[1],'Fabric title and description have the same white typography and line spacing');assert.equal(text[0].color,'rgb(255, 255, 255)');}
 }
 assert.deepEqual(page.errors,[]);await page.close();
 const preview=await open('/aesthetics/aesthetic-control.html');await preview.locator('.frontend-card-preview').waitFor();
 for(const width of [390,768,1440])for(const changed of [false,true]){
  await preview.setViewportSize({width,height:1000});await preview.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P1.size=16;d.type.H2.font='jost';}MayaTypographyControls.apply(d);document.activeElement?.blur();},changed);
  const cards=preview.locator('.frontend-card-preview-grid>*');
  for(const [i,selector]of ['.item-caption','.cc-meta','.fc-summary','.fabric-meta','.pin-caption'].entries()){
   const card=cards.nth(i),caption=card.locator(selector);await preview.mouse.move(1,1);await preview.waitForFunction(e=>getComputedStyle(e).opacity==='0',await caption.elementHandle());await card.hover();await preview.waitForFunction(e=>getComputedStyle(e).opacity==='1',await caption.elementHandle());
  }
  const square=await cards.nth(3).boundingBox();assert.ok(Math.abs(square.width-square.height)<1,'Fabric preview stays square');
 }
 await preview.locator('.frontend-card-preview .item-card').hover();await preview.locator('.frontend-card-preview .dissect-btn').click();assert.equal(await preview.locator('[data-card-preview-status]').textContent(),'Preview: coat body, sleeve and collar');
 assert.deepEqual(preview.errors,[]);await preview.close();
}

async function checkFabricGallery(){
// Owner standard: the served Global gallery must match In House, not a chat UI.
const root=resolve('.'),browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);
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
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+(u.pathname.startsWith('/aesthetics/')?'/docs':'')+decodeURIComponent(u.pathname))),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.JPG':'image/jpeg'})[extname(u.pathname)]||'text/plain'});}catch{return route.abort();}
});
const tab=name=>page.locator('.fa-tabs').getByRole('button',{name,exact:true});
const refreshSearch=async()=>{
 // Preparing the saved reference is asynchronous. An idle aria-busy value
 // immediately after click does not establish that the search has started.
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/fabrics/search'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await response;
 await page.waitForFunction(()=>document.getElementById('fabric-assistant').getAttribute('aria-busy')==='false');
};
const reopenResearch=(forceReset=true)=>page.evaluate(({reference,forceReset})=>MayaFabricAssistant.open({host:document.getElementById('brief-fabrics'),submissionId:'gallery-project',referenceImage:reference,automatic:true,originalGrid:true,forceReset,reopenSaved:showBriefFabrics,piece:{id:'coat',name:'Coat'},pieces:[{id:'coat',name:'Coat'}]}),{reference,forceReset});
const measure=()=>page.locator('#fabric-assistant').evaluate(root=>{
 const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right,overflowX:s.overflowX,overflowY:s.overflowY,columns:s.gridTemplateColumns,rows:s.gridTemplateRows,gap:s.gap,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,color:s.color,fontStyle:s.fontStyle,margin:[s.marginTop,s.marginBottom],pad:[s.paddingLeft,s.paddingTop],material:s.backgroundColor,fit:s.objectFit};};
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
  if(design==='saved')await page.evaluate(async()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H1.size=32;d.type.H2.size=28;d.type.H3.size=24;d.type.P1.size=16;d.type.P2.size=16;Object.assign(d.type.H4,{font:'cormorant',size:20,weight:450,color:'gray'});Object.assign(d.type.P3,{size:14,color:'white'});Object.assign(d.inner,{paddingX:19,paddingY:13,background:'green',fill:65});d.pillX=18;d.pillY=9;d.iconPillGap=12;await MayaTypographyControls.save(d);});
  for(const mode of ['inline','expanded']){
   if(mode==='expanded')await page.getByRole('button',{name:'Expand',exact:true}).click();
   for(const width of [320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:1000});await tab('In House').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
    await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const local=await measure();
    await tab('Global').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const global=await measure();
    assert.deepEqual(global,local,design+' '+mode+' '+width+': Global must have exactly the In House geometry, roles, materials, controls and scroll containers');
    assert.equal(global.grid.columns.split(' ').length,width<=600?2:4,'Four original fabric columns, with a two-column phone layout for usable targets');
    assert.equal(global.title.size,design==='saved'?'16px':'12px');assert.equal(global.caption.size,global.title.size);assert.equal(global.title.fontStyle,'italic');assert.equal(global.caption.fontStyle,'italic');assert.equal(global.title.font,global.caption.font);assert.match(global.title.font,/Cormorant/);assert.equal(global.title.color,'rgb(255, 255, 255)');assert.equal(global.caption.color,'rgb(255, 255, 255)');assert.deepEqual(global.title.margin,['0px','0px']);assert.deepEqual(global.caption.margin,['0px','0px']);assert.ok(Math.abs(parseFloat(global.title.line)-parseFloat(global.title.size)*1.35)<.1);assert.equal(global.caption.line,global.title.line);assert.deepEqual(global.card.pad,['0px','0px']);
    if(design==='saved')assert.equal(global.card.material,'rgba(23, 91, 59, 0.65)');
    assert.equal(await page.locator('.fa-composer').isVisible(),false);assert.equal(await page.locator('.fa-observation').isVisible(),false);
    const heights=await page.locator('.fa-toolbar>button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().height));assert.ok(Math.max(...heights)-Math.min(...heights)<1,'Refresh, CSV and Expand share their height');
    assert.deepEqual(global.controls,['In House','Global','Favorites','Refresh fabrics','CSV',mode==='inline'?'Expand':'Collapse']);
    assert.ok(global.title.height<=(parseFloat(global.title.line)||parseFloat(global.title.size)*1.5)+1);assert.ok(global.caption.height<=(parseFloat(global.caption.line)||parseFloat(global.caption.size)*1.5)+1);
    assert.ok(Math.abs(global.photo.width-global.photo.height)<1,design+' '+mode+' '+width+': Original fabric photos stay square');
    assert.ok(Math.abs(global.card.width-global.card.height)<1,'Original cards remain square without caption height added');
    assert.ok(global.title.height>0&&global.caption.height>0&&global.title.top>=global.photo.top-1&&Math.abs(global.title.bottom-global.caption.top)<1&&global.caption.bottom<=global.photo.bottom+1,'Both white caption rows overlay the photo with Community line spacing');
    const actions=await page.locator('.fa-product:not([hidden]) .fa-card-actions').first().evaluate(e=>{const s=getComputedStyle(e),card=e.closest('.fa-product').getBoundingClientRect(),buttons=[...e.children].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});return {gap:parseFloat(s.columnGap),sharedGap:parseFloat(s.getPropertyValue('--maya-icon-pill-gap')),buttons,card:{left:card.left,right:card.right}};});
    assert.equal(actions.gap,actions.sharedGap/2,'Original card action spacing follows half the saved shared icon gap');assert.equal(actions.buttons.length,2);assert.ok(actions.buttons[0].right<=actions.buttons[1].left+1&&actions.buttons.every(b=>b.left>=actions.card.left-1&&b.right<=actions.card.right+1&&b.bottom<=global.title.top+1),'Favorite and dismiss stay separate and clear of both captions');
    if(width===390||width===1440){const copy=page.locator('.fa-product:not([hidden]) .fa-card-copy').first();await page.mouse.move(1,1);await page.waitForFunction(e=>getComputedStyle(e).opacity==='0',await copy.elementHandle());await page.locator('.fa-product:not([hidden])').first().hover();await page.waitForFunction(e=>getComputedStyle(e).opacity==='1',await copy.elementHandle());await page.mouse.move(1,1);await page.waitForFunction(e=>getComputedStyle(e).opacity==='0',await copy.elementHandle());}
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
 await operationPreview.locator('.original-operation-logic').evaluate(e=>{const extra=document.createElement('p');extra.dataset.mayaType='P1';extra.textContent='Long reviewed pattern construction notes. '.repeat(100);e.append(extra);});
 for(const changed of [false,true])for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P3.size=14;d.pillX=18;d.pillY=9;d.inner.paddingX=19;d.inner.paddingY=13;}MayaTypographyControls.apply(d);},changed);
  await operationPreview.getByRole('button',{name:'Mark 1',exact:true}).click();const originalBounds=await previewBounds();
  await operationPreview.getByRole('button',{name:'Pipeline',exact:true}).click();assert.equal(await operationPreview.locator('.original-operation-logic').isVisible(),true);assert.equal(await operationPreview.locator('.operation-layout-pattern img').isVisible(),false);assert.deepEqual(await previewBounds(),originalBounds);
  const logic=await operationPreview.locator('.original-operation-logic').evaluate(e=>{const r=e.getBoundingClientRect(),stage=e.parentNode.getBoundingClientRect();e.scrollTop=80;return {scroll:e.scrollTop,overflow:getComputedStyle(e).overflowY,contained:r.left>=stage.left-1&&r.right<=stage.right+1&&r.top>=stage.top-1&&r.bottom<=stage.bottom+1};});assert.ok(logic.contained&&logic.scroll>0);assert.match(logic.overflow,/auto|scroll/);
  await operationPreview.locator('.operation-preview-settings').evaluate(e=>e.open=true);const download=page.waitForEvent('download');await operationPreview.getByRole('button',{name:'Export as SVG',exact:true}).click();assert.match((await download).suggestedFilename(),/\.svg$/);assert.equal(await operationPreview.locator('.original-operation-logic').isVisible(),true,'Export preserves the visible Pipeline');assert.deepEqual(await previewBounds(),originalBounds);await operationPreview.locator('.operation-preview-settings').evaluate(e=>e.open=false);
  await operationPreview.getByRole('button',{name:'Mark 1',exact:true}).click();assert.equal(await operationPreview.locator('.operation-layout-pattern img').isVisible(),true);assert.deepEqual(await previewBounds(),originalBounds);
 }
 await page.evaluate(()=>MayaTypographyControls.apply(MayaTypographyControls.defaults));
 const drawerPreview=page.locator('#original-drawer-preview');await drawerPreview.getByRole('tab',{name:'Settings',exact:true}).click();assert.equal(await drawerPreview.getByRole('button',{name:'Export as SVG',exact:true}).isVisible(),true);await drawerPreview.getByRole('tab',{name:'Submissions',exact:true}).click();assert.equal(await drawerPreview.locator('#original-preview-settings').isVisible(),false);
 for(const changed of [false,true])for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.type.P1.size=16;d.inner.paddingX=19;d.inner.paddingY=13;}MayaTypographyControls.apply(d);},changed);
  await operationPreview.getByRole('button',{name:'Mark 1',exact:true}).click();const geometry=await previewBounds();
  await operationPreview.getByRole('button',{name:'CLO 3D',exact:true}).click();
  const clo=operationPreview.locator('#original-operation-clo-preview');await clo.locator('.clo-photo img').first().evaluate(img=>img.decode());
  assert.deepEqual(await previewBounds(),geometry,'CLO sample keeps the original frame geometry');
  const card=clo.locator('.clo-card').first(),box=await card.boundingBox();assert.ok(Math.abs(box.width-box.height)<2&&box.width<=220,'CLO preview photos stay square and bounded');
  const style=await card.locator('.clo-title').evaluate(e=>{const s=getComputedStyle(e);return {color:s.color,size:s.fontSize,lineHeight:s.lineHeight};});assert.equal(style.color,'rgb(255, 255, 255)');assert.equal(style.size,changed?'16px':'12px');assert.ok(Math.abs(parseFloat(style.lineHeight)/parseFloat(style.size)-1.35)<.01);
  await clo.locator('.clo-photo').first().focus();await clo.locator('.clo-photo').first().press('Enter');await page.locator('.maya-image-viewer').waitFor();await page.keyboard.press('Escape');await page.locator('.maya-image-viewer').waitFor({state:'detached'});
  if(width===1440&&!changed){
   const heart=card.locator('[data-clo-action="favorite"]');await heart.focus();await heart.press('Enter');await page.waitForFunction(()=>document.querySelector('#original-operation-clo-preview [data-clo-action="favorite"]').getAttribute('aria-pressed')==='true');
   assert.equal(await heart.locator('svg path').evaluate(e=>getComputedStyle(e).fill===getComputedStyle(e).color),true,'Saved CLO favorite has a filled heart');
   await page.mouse.move(0,0);await operationPreview.getByRole('button',{name:'CLO 3D',exact:true}).focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#original-operation-clo-preview .clo-card-actions')).opacity==='1'&&getComputedStyle(document.querySelector('#original-operation-clo-preview .clo-caption')).opacity==='0');
   await clo.getByRole('combobox',{name:'Filter CLO assets'}).selectOption('favorites');assert.equal(await clo.locator('.clo-card').count(),1);await heart.focus();await heart.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('#original-operation-clo-preview .clo-card').length===0);await clo.getByRole('combobox',{name:'Filter CLO assets'}).selectOption('all');assert.equal(await clo.locator('.clo-card').count(),1);
  }
  await operationPreview.getByRole('button',{name:'Pipeline',exact:true}).click();assert.deepEqual(await previewBounds(),geometry);
 }
 await page.evaluate(()=>MayaTypographyControls.apply(MayaTypographyControls.defaults));
 const projectPreview=page.locator('#project-actions-preview');await projectPreview.locator('.session-item').hover();await projectPreview.getByRole('button',{name:'Rename preview project'}).click();await projectPreview.getByRole('textbox',{name:'Rename preview project'}).fill('Renamed preview');await projectPreview.getByRole('textbox',{name:'Rename preview project'}).press('Tab');assert.equal(await projectPreview.locator('[data-maya-type=H4]').textContent(),'Renamed preview');
 const preview=page.locator('#workspace-previews');await preview.getByRole('button',{name:'Global',exact:true}).click();assert.equal(await preview.locator('.fa-status').textContent(),'Searching for Fabrics');assert.equal(await preview.locator('.fa-status').getAttribute('data-maya-type'),'P1');await preview.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const rect=()=>preview.locator('.fa-results').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,rows:getComputedStyle(el).gridTemplateRows,columns:getComputedStyle(el).gridTemplateColumns,cards:[...el.children].map(c=>[c.clientWidth,c.clientHeight,c.querySelector('img').clientWidth,c.querySelector('img').clientHeight])}));await preview.getByRole('button',{name:'In House',exact:true}).click();const local=await rect();await preview.getByRole('button',{name:'Global',exact:true}).click();assert.deepEqual(await rect(),local);assert.equal(local.columns.split(' ').length,width<=600?2:4);assert.ok(local.cards.every(([cw,ch,w,h])=>Math.abs(cw-ch)<1&&Math.abs(w-h)<1),'Original fabric preview keeps square cards and photographs at '+width);}
 for(const changed of [false,true]){
  await page.locator('[data-category="P1"] summary').first().click();
  for(const [key,value] of Object.entries({font:changed?'cormorant':'jost',size:changed?16:12,color:changed?'white':'gray'})){const field=page.locator('[data-category="P1"] [data-field="'+key+'"]').first();if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));}
  await page.keyboard.press('Escape');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const style=await preview.locator('.fa-status').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {size:s.fontSize,font:s.fontFamily,color:s.color,margin:s.marginTop,right:r.right};});assert.equal(style.size,changed?'16px':'12px');assert.match(style.font,changed?/Cormorant/:/Jost/);assert.equal(style.color,changed?'rgb(255, 255, 255)':'rgb(170, 181, 196)');assert.equal(style.margin,'0px');assert.ok(style.right<=width+1);}
  process.env.MAYA_CAPTURE&&await preview.screenshot({path:'/private/tmp/maya-clean-preview-'+(changed?'saved':'default')+'.png'});
 }
 assert.equal(calls,3,'Aesthetic previews make no searches');assert.deepEqual(errors,[]);
 console.log('Fabric gallery: In House/Global parity, square four-column grid, white hover captions, phone targets, saved settings, six widths, photo failure/recovery and active preview passed.');
}catch(error){console.error(error);console.error((await page.locator('body').innerText()).slice(-2500));process.env.MAYA_CAPTURE&&await page.screenshot({path:'/private/tmp/maya-global-gallery-failure.png'});throw error;}finally{await browser.close();}

}

// CI-only geometry and keyboard checks; local code-only verification never launches this.
async function checkCloPreview(){
 for(const [width,height]of [[390,844],[768,1024],[1440,900]]){
  const page=await open('/backend/backend.html',width,height);let reads=0,searches=0,providerCalls=0,previewReads=0,generation=0;
  // Real saved-input lookup and listing-photo resolution; external transports are fixtures.
  const reference='data:image/jpeg;base64,'+readFileSync(root+assets+'/aesthetics/fabrics/thumbs/Midnight Velvet.jpg').toString('base64'),records=new Map(),prefix='submissions/clo-project/';
  const seed=(path,data)=>records.set(path,{buf:Buffer.from(JSON.stringify(data)),generation:String(++generation)});
  seed(prefix+'submission.json',{openedBy:'fixture@example.test'});seed(prefix+'summary.json',{});seed(prefix+'pieces.json',{pieces:[{name:'Coat',_image:reference,fabric:'Wool'}]});
  const listing='https://connect.clo-set.com/detail/3001c20cd5d2481fa7f3357acc5ff44c';
  const service=createDigitalAssets({read:async path=>records.has(path)?{ok:true,...records.get(path)}:{ok:false,status:404},write:async(path,buf,type,expected)=>{assert.equal(String(records.get(path)?.generation||'0'),expected);seed(path,JSON.parse(buf));return {generation:records.get(path).generation};},assertActive:async id=>assert.equal(id,'clo-project'),apiKey:()=> 'fixture',fetchImpl:async(url,options)=>{if(url==='https://connect.api.clo-set.com/api/Details/Items/'+listing.split('/').at(-1)+'/context?isTempPage=false'){previewReads++;return Response.json({itemId:listing.split('/').at(-1),hasPublished:true,currentStatus:1,thumbnailImageInfo:{imageUrl:'https://maya.test/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg'}});}providerCalls++;const body=JSON.parse(options.body);assert.equal(body.input[0].content.find(c=>c.type==='input_image').image_url,reference,'CLO matches the saved dissected image before a pattern exists');return Response.json({status:'completed',output:[{type:'web_search_call',results:[{type:'source_result',url:listing,title:'Saved jacket reference'}]},{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{url:listing,title:'Saved jacket reference',match:'Preview fixture only'}]})}]}]});}});
  await page.route('**/api/admin/patterns?*',route=>route.fulfill({json:{generation:'0',runs:[],settings:{}}}));
  await page.route('**/api/admin/digital-assets/**',async route=>{try{const url=new URL(route.request().url()),body=route.request().postDataJSON(),id=body?.submissionId||url.searchParams.get('submissionId'),gid=body?.garmentId||url.searchParams.get('garmentId')||'';assert.equal(id,'clo-project');assert.equal(gid,'saved-piece-0');if(url.pathname.endsWith('/search')){searches++;const pending=await service.prepare(id,gid);await service.execute(id,gid,pending.attempt);}else if(url.pathname.endsWith('/review'))return route.fulfill({json:await service.saveReview({sub:'clo-owner'},body)});else reads++;return route.fulfill({json:await service.view({sub:'clo-owner'},id,gid)});}catch(error){return route.fulfill({status:error.status||503,json:{error:error.message}});}});
  await page.evaluate(photo=>{
   localStorage.setItem('maya_admin_tok','fixture.'+btoa(JSON.stringify({sub:'clo-owner',exp:Math.floor(Date.now()/1000)+3600}))+'.fixture');
   document.getElementById('upload-gate').style.display='none';
   const pieces=[{name:'Coat',_image:photo,fabric:'Wool'}];window._openedSubmission={id:'clo-project'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:photo,card:{_dissection:{pieces}}};_publishSavedOperations({pieces});goToScreen(1);
  },reference);
  const frame=page.frames().find(f=>f.url().includes('operation-workspace.html'));
  await frame.waitForFunction(()=>window.originalOperationContext?.()?.submissionId==='clo-project'&&window.originalOperationContext?.()?.garmentId==='saved-piece-0');
  const stageBounds=()=>frame.locator('#stage').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};});
  for(const changed of [false,true]){
   for(const target of [page,frame])await target.evaluate(changed=>{const d=structuredClone(MayaTypographyControls.defaults);if(changed){d.inner.paddingX=19;d.inner.paddingY=13;d.inner.background='blue';d.inner.fill=65;d.type.P1.size=16;d.type.P3.size=14;d.pillX=18;d.pillY=9;}MayaTypographyControls.apply(d);},changed);
   await frame.getByRole('tab',{name:'Mark 1',exact:true}).click();const before=await stageBounds();
   await frame.getByRole('tab',{name:'CLO 3D',exact:true}).click();
   const clo=frame.locator('#operation-clo'),card=clo.locator('.clo-card').first(),photo=card.locator('.clo-photo');
   if(!changed){
    assert.equal(await frame.evaluate(()=>PASSES.length),0,'CLO starts before any pattern is generated');
    await clo.getByRole('button',{name:'Find assets',exact:true}).waitFor();
    const centered=await clo.locator('.clo-empty').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentNode.getBoundingClientRect();return Math.abs(r.x+r.width/2-p.x-p.width/2)<2&&Math.abs(r.y+r.height/2-p.y-p.height/2)<2;});assert.ok(centered,'Empty CLO message is centered in its available window');
    await clo.getByRole('button',{name:'Find assets',exact:true}).click();
   }

   await photo.locator('img').evaluate(img=>img.decode());await frame.waitForFunction(()=>!document.querySelector('#operation-clo .clo-photo').disabled);
   assert.deepEqual(await stageBounds(),before,'CLO does not resize the original pattern frame');
   assert.equal(await frame.locator('#original-operation-logic').isVisible(),false);
   const layout=await clo.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.parentNode.getBoundingClientRect(),c=e.querySelector('.clo-card').getBoundingClientRect(),caption=getComputedStyle(e.querySelector('.clo-title')),image=getComputedStyle(e.querySelector('.clo-photo'));return {contained:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1,card:[c.width,c.height],pad:[parseFloat(s.paddingLeft),parseFloat(s.paddingTop)],color:caption.color,size:caption.fontSize,line:caption.lineHeight,fit:image.borderRadius};});
   assert.ok(layout.contained);assert.ok(layout.card[0]>0&&layout.card[0]<=220&&Math.abs(layout.card[0]-layout.card[1])<2,'CLO cards use bounded square photos');assert.equal(layout.color,'rgb(255, 255, 255)');assert.equal(layout.size,changed?'16px':'12px');assert.ok(Math.abs(parseFloat(layout.line)/parseFloat(layout.size)-1.35)<.01);
   const inner=await frame.evaluate(()=>MayaTypographyControls.defaults.inner);assert.deepEqual(layout.pad,changed?[19,13]:[inner.paddingX,inner.paddingY]);
   assert.ok(await card.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentNode.getBoundingClientRect();return Math.abs(r.x+r.width/2-p.x-p.width/2)<2;}),'A single CLO reference is centered');
   assert.equal(await clo.locator('.clo-toolbar').evaluate(e=>getComputedStyle(e).justifyContent),'center');assert.equal(await clo.locator('.clo-status').evaluate(e=>getComputedStyle(e).textAlign),'center');
   await frame.evaluate(()=>setOperationRunning(true));assert.equal(await clo.getByRole('combobox',{name:'Filter CLO assets'}).isEnabled(),true,'Pattern activity does not lock CLO controls');await frame.evaluate(()=>setOperationRunning(false));

   await page.mouse.move(0,0);await frame.locator('#original-operation-tab-clo-0').focus();await frame.waitForFunction(()=>getComputedStyle(document.querySelector('#operation-clo .clo-caption')).opacity==='0');
   await photo.focus();await frame.waitForFunction(()=>getComputedStyle(document.querySelector('#operation-clo .clo-caption')).opacity==='1');await photo.press('Enter');const viewer=page.locator('.maya-image-viewer');await viewer.waitFor();await viewer.locator('img').evaluate(img=>img.decode());assert.equal(await viewer.locator('img').evaluate(img=>img.referrerPolicy),'no-referrer','Expansion preserves the thumbnail request policy');const expanded=await viewer.boundingBox();assert.equal(expanded.width,width);assert.equal(expanded.height,height,'Expanded CLO photograph fills the parent viewport');assert.equal(await frame.locator('.maya-image-viewer').count(),0);
   await page.keyboard.press('Escape');await viewer.waitFor({state:'detached'});
   await frame.evaluate(()=>window.fixtureCloPhoto=document.querySelector('#operation-clo .clo-photo img'));
   await frame.getByRole('tab',{name:'Pipeline',exact:true}).click();assert.equal(await clo.isVisible(),false);assert.equal(await frame.locator('#original-operation-logic').isVisible(),true);assert.deepEqual(await stageBounds(),before);
   await frame.getByRole('tab',{name:'CLO 3D',exact:true}).click();assert.equal(await frame.evaluate(()=>fixtureCloPhoto===document.querySelector('#operation-clo .clo-photo img')),true,'Returning to CLO retains its loaded photograph');
  }
  assert.equal(reads,1,'Opening and tab switching reuse the saved shortlist');assert.equal(searches,1);assert.equal(previewReads,1,'A source-only search result gets its preview from the listing and saves it');assert.equal(providerCalls,1,'Only explicit Find assets performs the independent CLO search');assert.equal(await frame.evaluate(()=>PASSES.length),0,'CLO sourcing never generates a pattern');
  await frame.locator('#operation-clo .clo-photo').first().focus();await frame.locator('#operation-clo .clo-photo').first().press('Enter');await page.locator('.maya-image-viewer').waitFor();
  await frame.evaluate(()=>MayaOperationPanels.unregister('clo'));await page.locator('.maya-image-viewer').waitFor({state:'detached'});assert.equal(await frame.getByRole('tab',{name:'CLO 3D',exact:true}).count(),0);assert.equal(await frame.evaluate(()=>CUR.kind),'grounded');assert.ok(await frame.getByRole('tab',{name:'Pipeline',exact:true}).isVisible(),'Removing CLO leaves the original pattern controls intact');
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
