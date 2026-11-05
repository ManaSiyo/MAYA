// Actual phone/tablet UI with fake image transport and private cloud storage.
// Run MAYA_MOBILE_ENGINE=webkit locally for iOS WebKit as well as release Chromium.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),engine=process.env.MAYA_MOBILE_ENGINE||'chromium';
const browser=await (engine==='webkit'?webkit:chromium).launch();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
try{
 for(const [width,height] of [[320,740],[390,844],[844,390],[768,1024],[834,1194],[1194,834]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[],images=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.hostname!=='maya.test')return route.abort();
   if(url.pathname==='/fixture-face.png')return route.fulfill({body:png,contentType:'image/png'});
   if(url.pathname.startsWith('/api/openai/v1/images/')){images.push({path:url.pathname,body:req.postData(),auth:req.headers().authorization});return route.fulfill({json:{data:[{b64_json:png.toString('base64')}]}});}
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   try{return route.fulfill({body:readFileSync(root+url.pathname),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
  });
  const setup=async(saved=[])=>page.evaluate(saved=>{
   document.getElementById('signin-gate').style.setProperty('display','none','important');
   _hydrating=true;getApiKey=()=> 'fixture';lastSummary={client:{name:null}};
   window.avatarFixture={list:saved,writes:0,uploads:0,hold:true};
   window.firebase={firestore:()=>({runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>({list:avatarFixture.list})}),set:(_,value)=>{avatarFixture.list=value.list;avatarFixture.writes++;}})})};
   _avatarsDoc=()=>({get:async()=>({exists:true,data:()=>({list:avatarFixture.list})})});
   projectStore._uid=()=> 'fixture-user';projectStore.ready=()=>true;projectStore.currentId=null;projectStore.queueSave=()=>{};
   projectStore.uploadImage=async()=>{avatarFixture.uploads++;if(avatarFixture.hold)await new Promise(resolve=>avatarFixture.release=resolve);return {url:location.origin+'/fixture-face.png'};};
   _persistSession=()=>{};analyzeFacePhoto=async()=>({});showToast=()=>{};showError=message=>{throw Error(message);};
   callLiveExtract=async()=>[];
   const d=structuredClone(MayaTypographyControls.defaults);d.pillX=5;d.pillY=5;MayaTypographyControls.apply(d);
   placeItem({tag:'color',title:'blue'},0);placeItem({tag:'fabric',title:'silk'},0);
  },saved);
  await page.goto('https://maya.test/frontend/index.html');await page.waitForFunction(()=>window.MayaTypographyControls);await setup();
  await page.evaluate(()=>toggleNotesDrawer(true));await page.waitForFunction(()=>{const h=document.getElementById('hscroll');return Math.abs(h.scrollLeft-(h.scrollWidth-h.clientWidth))<1;});await page.evaluate(()=>toggleAvatarSwitcher());
  assert.equal(await page.locator('#notes-drawer button').filter({hasText:/^Save$/}).count(),0,'No physical Avatar Save control');
  for(const button of await page.locator('.avatar-switch-actions button').all()){const b=await button.boundingBox();assert.ok(b.height>=44&&b.width>=44,'Touch controls are larger at '+width);}
  assert.ok(await page.locator('.avatar-switch-actions').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  const dot=await page.locator('.page-dot').first().evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};});assert.ok(dot.width<=8&&dot.height<=8,'Compact board indicators retain their existing appearance');
  if(width<=640)assert.equal(await page.locator('#page-indicator').evaluate(e=>getComputedStyle(e).visibility),'hidden','Board navigation does not obstruct the phone drawer');
  if(width===390||width===834)await page.screenshot({path:'/private/tmp/maya-mobile-'+engine+'-'+width+'-drawer-default.png',animations:'disabled'});
  const chooser=page.waitForEvent('filechooser');await page.locator('.avatar-switch-actions button').filter({hasText:'Replace'}).click();await (await chooser).setFiles({name:'avatar.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>!!lastSummary?._face_photo&&!!avatarFixture.release);
  assert.equal(await page.evaluate(()=>Object.keys(lastSummary._measurements||{}).length),0);
  await page.evaluate(()=>{toggleNotesDrawer(false);liveInterimBuffer='silk';});
  await page.waitForFunction(()=>document.getElementById('hscroll').scrollLeft<1);
  const started=Date.now();await page.locator('#visualize-btn').click();await page.locator('#fabric-mode-modal.open').waitFor({timeout:4000});
  assert.ok(Date.now()-started<4000,'Short interim text does not create a 30-second wait');
  assert.equal(await page.locator('#avatar-check-modal').evaluate(e=>e.classList.contains('open')),false,'A face-only avatar proceeds without a missing-avatar warning');
  await page.locator('#fabric-mode-modal button.mode-choose').filter({hasText:'Global'}).click();
  await page.waitForFunction(()=>items.some(item=>item.card.generatedBy==='gpt-image-2.6-flare'));
  assert.equal(images.length,1,'One image request before slow cloud avatar storage acknowledges');
  assert.equal(images[0].auth,'Bearer fixture');assert.match(images[0].body,/gpt-image-2\.6-flare/);assert.match(images[0].body,/name="complexity"\r\n\r\nmedium/);
  assert.equal(await page.evaluate(()=>avatarFixture.writes),0);
  await page.evaluate(()=>{avatarFixture.hold=false;avatarFixture.release();});await page.waitForFunction(()=>avatarFixture.list.length===1&&!!lastSummary._avatarLibraryId);
  await page.evaluate(()=>_flushAvatarSave());
  const saved=await page.evaluate(()=>avatarFixture.list);assert.equal(saved[0].name,'Avatar');
  assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),'No viewport overflow '+width);
  if(width===390||width===834)await page.screenshot({path:'/private/tmp/maya-mobile-'+engine+'-'+width+'.png'});
  // Reopening the stored avatar does not require Save or another generation.
  await page.reload();await page.waitForFunction(()=>window.MayaTypographyControls);await setup(saved);
  await page.evaluate(async()=>{_avatarLibCache=null;await switchAvatar(avatarFixture.list[0].id);await visualizeGarment();});
  assert.equal(await page.locator('#avatar-check-modal').evaluate(e=>e.classList.contains('open')),false);assert.equal(images.length,1);
  await page.evaluate(()=>closeFabricMode());
  const changed=await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.touchTargetSize=52;MayaTypographyControls.apply(d);return d;});assert.equal(validDesign(changed),true);
  assert.equal(validDesign({...changed,touchTargetSize:20}),false);
  const target=await page.locator('#visualize-btn').boundingBox();assert.ok(target.height>=52&&target.width>=52,'Saved touch setting propagates at '+width);
  await page.evaluate(()=>toggleNotesDrawer(true));await page.waitForFunction(()=>{const h=document.getElementById('hscroll');return Math.abs(h.scrollLeft-(h.scrollWidth-h.clientWidth))<1;});await page.evaluate(()=>toggleAvatarSwitcher());
  await page.evaluate(()=>{document.getElementById('drawer-sessions-list').innerHTML=_projectRows([{id:'fixture-project',name:'A longer project name',createdAt:Date.now(),twoWord:'Blue silk'}]);});
  for(const size of [44,52]){
   await page.evaluate(size=>{const d=structuredClone(MayaTypographyControls.defaults);d.touchTargetSize=size;MayaTypographyControls.apply(d);},size);
   for(const selector of ['.avatar-switch-row[data-id]','.session-item[data-id]']){
    const geometry=await page.locator(selector).first().evaluate(row=>{const r=row.getBoundingClientRect();return {row:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},buttons:[...row.querySelectorAll('button')].map(b=>{const a=b.getBoundingClientRect();return {left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height,opacity:getComputedStyle(b).opacity};}).sort((a,b)=>a.left-b.left)};});
    for(const [i,b] of geometry.buttons.entries()){assert.ok(b.width>=size&&b.height>=size);assert.equal(b.opacity,'1','Touch row actions do not depend on hover');assert.ok(b.left>=geometry.row.left&&b.right<=geometry.row.right&&b.top>=geometry.row.top&&b.bottom<=geometry.row.bottom+1,selector+' contains touch action at '+width+' '+JSON.stringify(geometry));if(i)assert.ok(geometry.buttons[i-1].right<=b.left,selector+' separate touch actions at '+width);}
   }
  }
  if(width===390||width===834)await page.screenshot({path:'/private/tmp/maya-mobile-'+engine+'-'+width+'-drawer-saved.png',animations:'disabled'});
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const hasTouch of [false,true]){
 const page=await browser.newPage({viewport:{width:1100,height:900},hasTouch});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='maya.test')return route.abort();try{return route.fulfill({body:readFileSync(root+u.pathname),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}});
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');await page.locator('[data-maya-touch-preview]').waitFor();
 const desktopSize=await page.locator('#range-circle-preview button').first().boundingBox();
 assert.ok((await page.locator('[data-maya-touch-preview]').boundingBox()).height>=44);
 await page.locator('.finish-controls .type-editor > summary').click();await page.locator('#tokens [data-field=touchTargetSize]').fill('52');
 assert.ok((await page.locator('[data-maya-touch-preview]').boundingBox()).height>=52,'Active Touch preview uses the actual shared setting');
 const desktopAfter=await page.locator('#range-circle-preview button').first().boundingBox();if(hasTouch){assert.ok(desktopAfter.width>=52&&desktopAfter.height>=52);assert.ok(Math.abs(desktopAfter.width-desktopAfter.height)<1,'Touch range controls remain circular');}else{assert.equal(desktopAfter.height,desktopSize.height,'Desktop circles keep their existing geometry');assert.equal(desktopAfter.width,desktopSize.width);}
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Saved locally'));
 await page.reload();await page.locator('[data-maya-touch-preview]').waitFor();assert.ok((await page.locator('[data-maya-touch-preview]').boundingBox()).height>=52,'Saved touch setting survives reload');
 await page.close();
 }
 console.log(engine+' phone/tablet: upload auto-saves without naming/Save, face-only visualization, short transcript latency, one new-model request, saved-avatar reload, touch sizing and active Save propagation passed. Fake providers only.');
}finally{await browser.close();}
