import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve('.'),origin='https://maya-cards.test',png=readFileSync(root+'/aesthetics/fabrics/thumbs/Midnight Velvet.jpg');
const jwt=(sub,version=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,version,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const owner=jwt('owner-a'),other=jwt('owner-b'),folders=[{id:'newest',name:'Client-11-04-2026',files:[{id:'photo-a',name:'dream-garment.png',mime:'image/png'}]},{id:'exact-copy',duplicateOf:'newest',name:'Client-11-04-2026',files:[{id:'photo-copy',name:'dream-garment.png',mime:'image/png'}]},{id:'different-project',name:'Client-11-03-2026',files:[{id:'photo-b',name:'dream-garment.png',mime:'image/png'}]}];
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[],requests=[],designWrites=[];let saved={},holdList=false,heldList,holdPhoto=false,heldPhotos=[];
context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
await context.addInitScript(owner=>{try{localStorage.setItem('maya_admin_tok',owner);}catch{}window.setInterval=()=>0;window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){},cancel(){},disableAutoSelect(){}}}};},owner);
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.origin!==origin)return route.abort();
 if(u.pathname.startsWith('/api/')){
  requests.push({path:u.pathname,method:req.method(),auth:req.headers().authorization});
  if(u.pathname==='/api/design')return route.fulfill({json:saved});
  if(u.pathname==='/api/admin/design'&&req.method()==='POST'){saved=req.postDataJSON();assert.ok(validDesign(saved));designWrites.push(saved);return route.fulfill({json:{ok:true,savedAt:'2026-11-04'}});}
  if(u.pathname==='/api/admin/submissions'){if(holdList){holdList=false;heldList=route;return;}return route.fulfill({json:{ok:true,total:3,uniqueTotal:2,folders}});}
  if(u.pathname==='/api/admin/subthumb'){assert.ok(req.headers().authorization,'Private photos are authenticated');if(holdPhoto){heldPhotos.push(route);return;}return route.fulfill({body:png,contentType:'image/jpeg'});}
  return route.fulfill({json:{ok:true,folders:[],items:[],models:{},threads:[]}});
 }
 const aliases={'/status.html':'/backend/status.html','/backend.html':'/backend/backend.html','/operations.html':'/backend/operations.html'};
 const path=resolve(root,'.'+decodeURIComponent(aliases[u.pathname]||u.pathname));
 try{return route.fulfill({body:readFileSync(path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
});
const page=await context.newPage();page.setDefaultTimeout(12000);
const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Held fixture request did not arrive');};
async function ready(path){await page.goto(origin+path);await page.waitForFunction(()=>window.MayaTypographyControls&&window.MayaSubmissionCards);await page.evaluate(()=>MayaTypographyControls.ready);}
const material=async(selector,p=page)=>p.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.borderTopColor,s.borderRadius,s.paddingLeft,s.paddingTop,s.backdropFilter];});
async function admin(){await ready('/status.html');await page.evaluate(async owner=>{_idTok=owner;await loadSubmissions();},owner);await page.waitForFunction(()=>[...document.querySelectorAll('#subs-strip img')].every(e=>e.complete&&e.naturalWidth>0));}
async function brief(){await ready('/backend.html');await page.evaluate(()=>{getMayaFolder=async()=>null;listClients=async()=>[];return openClientsDrawer();});await page.waitForFunction(()=>[...document.querySelectorAll('#clients-list img')].every(e=>e.complete&&e.naturalWidth>0));}
async function checkCards(selector,{drawer=false,savedLabel=false}={}){
 assert.deepEqual(await page.locator(selector).evaluateAll(es=>es.map(e=>e.dataset.submissionId)),['newest','different-project']);
 assert.equal(await page.locator(selector+' img').count(),2,'The cards contain actual photographs');
 const href=await page.locator(selector).first().getAttribute('href');assert.equal(new URL(href,origin).searchParams.get('submission'),'newest');assert.equal(new URL(href,origin).searchParams.get('img'),'photo-a');
 assert.equal(await page.locator(selector).first().getAttribute('aria-label'),'Open Brief for Client');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  if(drawer)await page.waitForFunction(()=>{const r=document.getElementById('clients-drawer').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;});
  const box=await page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),i=e.querySelector('img');return {w:r.width,h:r.height,left:r.left,right:r.right,fit:getComputedStyle(i).objectFit,background:s.backgroundColor};});
  assert.ok(box.w>100&&box.h>60,'Card is visible at '+width);assert.equal(box.fit,'contain');
  if(drawer){assert.ok(Math.abs(box.w/box.h-1.5)<.02,'Drawer scales the 3:2 Admin card at '+width);assert.ok(box.left>=0&&box.right<=width+1);assert.ok(await page.locator('#clients-list').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Drawer has no horizontal overflow');}
  if(savedLabel)assert.equal(box.background,'rgba(23, 91, 59, 0.65)','Saved Inner material reaches card');
  if([390,1440].includes(width))await page.locator(drawer?'#clients-drawer':'#subs-strip').screenshot({path:'/private/tmp/maya-cards-'+(drawer?'drawer':'admin')+'-'+(savedLabel?'saved':'default')+'-'+width+'.png'});
 }
}
try{
 await admin();
 const missingStates=await page.evaluate(()=>{const now=Date.now();return [0,3600000].map((age,index)=>{const card=MayaSubmissionCards.create({id:'state-'+index,createdTime:new Date(now-age).toISOString(),files:[]});document.body.append(card);const badge=card.querySelector('.badge'),s=getComputedStyle(badge),value=[badge.textContent,badge.dataset.mayaType,badge.dataset.status,s.color];card.remove();return value;});});
 assert.deepEqual(missingStates,[['Arriving','P3','in_progress','rgb(134, 239, 172)'],['No picture','P3','pending','rgb(251, 191, 36)']],'Incomplete submissions retain shared progress/warning semantics');
 await checkCards('#subs-strip .sub-tile');assert.equal(await page.locator('#subs-count').textContent(),'2 total');const base=await material('#subs-strip .sub-tile');
 await page.locator('#subs-strip .sub-tile').first().evaluate(e=>window.fixtureCard=e);await page.evaluate(()=>loadSubmissions());assert.ok(await page.evaluate(()=>window.fixtureCard===document.querySelector('#subs-strip .sub-tile')),'Unchanged polls preserve healthy image nodes');
 await brief();await checkCards('#clients-list .sub-tile',{drawer:true});assert.deepEqual(await material('#clients-list .sub-tile'),base,'Admin and Brief use one material');
 // Opening an older view cannot overwrite a subsequent drawer open.
 holdList=true;await page.evaluate(()=>{window.oldDrawer=openClientsDrawer();});await wait(()=>heldList);await page.evaluate(()=>openClientsDrawer());await heldList.fulfill({json:{folders:[{...folders[0],id:'stale'}]}});heldList=null;await page.evaluate(()=>oldDrawer);assert.equal(await page.locator('[data-submission-id=stale]').count(),0);
 // Account change invalidates both listing and image work, including A→B→A.
 holdPhoto=true;await page.evaluate(()=>openClientsDrawer());await wait(()=>heldPhotos.length===2);
 await page.evaluate(other=>{localStorage.setItem('maya_admin_tok',other);window.dispatchEvent(new Event('maya-owner-session-changed'));},other);assert.equal(await page.locator('#clients-list .sub-tile').count(),0);await page.evaluate(owner=>{localStorage.setItem('maya_admin_tok',owner);window.dispatchEvent(new Event('maya-owner-session-changed'));},owner);
 for(const route of heldPhotos)await route.fulfill({body:png,contentType:'image/jpeg'});heldPhotos=[];holdPhoto=false;assert.equal(await page.locator('#clients-list img').count(),0,'Late photos never return after an account boundary');
 await page.evaluate(()=>openClientsDrawer());await page.waitForFunction(()=>[...document.querySelectorAll('#clients-list img')].every(e=>e.complete&&e.naturalWidth));await page.locator('#clients-list .sub-tile').first().evaluate(e=>window.renewedCard=e);await page.evaluate(value=>{localStorage.setItem('maya_admin_tok',value);window.dispatchEvent(new Event('maya-owner-session-changed'));},jwt('owner-a',2));assert.ok(await page.evaluate(()=>window.renewedCard===document.querySelector('#clients-list .sub-tile')),'Same-account renewal preserves the drawer');
 // Use the real shared editors and Save, then reload both consuming pages.
 await ready('/aesthetics/aesthetic-control.html');await page.locator('[data-editor="inner"] summary').click();
 for(const [field,value]of Object.entries({background:'green',fill:65,paddingX:23,paddingY:17,blur:13,saturation:140})){const e=page.locator('[data-editor="inner"] [data-field="'+field+'"]');if(await e.evaluate(e=>e.tagName==='SELECT'))await e.selectOption(value);else await e.fill(String(value));}
 await page.keyboard.press('Escape');await page.locator('#drawer-controls-preview button').filter({hasText:'Drawer'}).click();await page.locator('dialog.maya-drawer .sub-tile img').evaluate(e=>e.decode());const preview=await material('dialog.maya-drawer .sub-tile');assert.equal(preview[0],'rgba(23, 91, 59, 0.65)');await page.screenshot({path:'/private/tmp/maya-cards-active-preview.png'});await page.getByRole('button',{name:'Close Settings',exact:true}).click();
 await page.locator('[data-category=H3] summary').first().click();await page.locator('[data-category=H3] [data-field=size]').fill('18');await page.keyboard.press('Escape');await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('feedback').textContent==='Saved.');assert.equal(designWrites.length,1);
 await admin();await checkCards('#subs-strip .sub-tile',{savedLabel:true});assert.deepEqual(await material('#subs-strip .sub-tile'),preview);assert.equal(await page.locator('#drawer-systems>h3').first().evaluate(e=>getComputedStyle(e).fontSize),'18px','Saved heading size propagates to Settings');
 await brief();await checkCards('#clients-list .sub-tile',{drawer:true,savedLabel:true});assert.deepEqual(await material('#clients-list .sub-tile'),preview);
 assert.deepEqual(requests.filter(r=>r.method!=='GET'&&!['/api/admin/design','/api/admin/marketing-brief'].includes(r.path)),[],'Reading cards performs no submission or send mutation');assert.deepEqual(errors,[]);
 console.log('Submission cards passed: shared Admin/Brief photographs, exact-repeat filtering, canonical links, stable polling, account/list/photo races, same-account renewal, active preview and real Save at six widths.');
}catch(e){console.error('Card fixture feedback:',await page.locator('#feedback').textContent().catch(()=>''),'errors:',errors,'saves:',designWrites.length);throw e;}finally{await browser.close();}
