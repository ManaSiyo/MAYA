// Actual Operation Room, injected browser-storage failures, no provider or remote requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve(new URL('../',import.meta.url).pathname);
const token=(sub,revision=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,revision})).toString('base64url')+'.signature';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],paid=[];let design={};
page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(({token})=>{
 localStorage.setItem('maya_admin_tok',token);
 localStorage.setItem('maya_logic_pants',JSON.stringify([{label:'AMBIGUOUS LEGACY PRIVATE SHAPE',qty:9}]));
 localStorage.setItem('maya_logic_locked','1');
 window.storageFaults={};
 const native={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem};
 const fault=(storage,key,method)=>{
  const family=storage===sessionStorage&&key.startsWith('maya_measures_v2:')?'measure':key.startsWith('maya_logic_v2:')?'logic':key.startsWith('maya_logic_locked_v2:')?'lock':'';
  if(family&&window.storageFaults[family+method])throw new DOMException('Injected '+family+' '+method,method==='Get'?'SecurityError':'QuotaExceededError');
 };
 Storage.prototype.getItem=function(key){fault(this,key,'Get');return native.get.call(this,key);};
 Storage.prototype.setItem=function(key,value){fault(this,key,'Set');return native.set.call(this,key,value);};
 Storage.prototype.removeItem=function(key){fault(this,key,'Remove');return native.remove.call(this,key);};
},{token:token('owner-a')});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.hostname!=='maya-operation-save.test')return route.abort();
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/design')return route.fulfill({json:design});
  if(url.pathname.startsWith('/api/openai/')){paid.push(url.pathname);return route.fulfill({status:503,json:{error:{message:'No providers in this fixture'}}});}
  return route.fulfill({json:{ok:true,items:[],folders:[],book:{items:[],generation:'0'}}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const ev=(fn,arg)=>page.evaluate(fn,arg);
const choose=async(id='pants-a',submission='submission-a')=>ev(async({id,submission,image})=>{
 installOperationContext({account:operationAccount(),submissionId:submission,local:0,pieces:[{id,name:'Reviewed pants',_image:image}]},id);
 await _garmentReady;LAST={type:'pants',garment:{type:'pants'},garmentGram:KB.grammar.types.pants};LOGIC_TYPE='pants';renderLogic();toggleDrawer(true);
},{id,submission,image});
const chooseStandalone=async(id='upload-a')=>ev(async({id,image})=>{
 _operationInputContext=null;invalidateOperation();for(const name of Object.keys(TESTS))delete TESTS[name];
 TESTS[id]={front:image,piece:{id,name:id}};initTests();pickTest(id);await _garmentReady;
 LAST={type:'pants',garment:{type:'pants'},garmentGram:KB.grammar.types.pants};LOGIC_TYPE='pants';renderLogic();toggleDrawer(false);
},{id,image});
const account=async(sub,revision=1)=>ev(value=>{const oldValue=localStorage.getItem('maya_admin_tok');localStorage.setItem('maya_admin_tok',value);window.dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok',oldValue,newValue:value}));},token(sub,revision));
const fault=async(value)=>ev(value=>Object.assign(storageFaults,value),value);
const toast=()=>page.locator('#toast').textContent();
const draft=async(value)=>{await ev(()=>editLogic());await page.locator('#logic-edit').fill(value);};
const styles=selector=>page.locator(selector).evaluate(e=>{const s=getComputedStyle(e);return {size:s.fontSize,font:s.fontFamily,weight:s.fontWeight,style:s.fontStyle,background:s.backgroundColor,paddingX:s.paddingLeft,paddingY:s.paddingTop};});
try{
 await page.goto('https://maya-operation-save.test/backend/operations.html');
 await page.waitForFunction(()=>window.MayaTypographyControls&&typeof installOperationContext==='function');await ev(()=>MayaTypographyControls.ready);await choose();
 assert.equal(await ev(()=>getLogic('pants')[0].label),'FRONT LEG','Unknown-owner legacy private shapes must not be adopted');
 assert.equal(await ev(()=>logicLocked()),false,'Legacy global Test lock is not an account preference');
 const base=await ev(()=>getLogic('pants'));
 await draft('reviewed front x2\nreviewed waistband x1');await fault({logicSet:true});await ev(()=>saveLogic());
 assert.match(await toast(),/not saved.*draft is kept/);assert.equal(await page.locator('#logic-edit').inputValue(),'reviewed front x2\nreviewed waistband x1');
 assert.equal(await page.locator('#logic').evaluate(e=>e.classList.contains('editing')),true);assert.deepEqual(await ev(()=>getLogic('pants')),base);
 await ev(()=>renderLogic());assert.equal(await page.locator('#logic-edit').inputValue(),'reviewed front x2\nreviewed waistband x1','Rerender cannot discard an unsaved reviewed draft');
 await ev(()=>startTest());assert.match(await toast(),/unsaved changes/);assert.equal(paid.length,0,'Unsaved Pattern Logic blocks paid embeddings and generation');
 await fault({logicSet:false});await ev(()=>saveLogic());assert.match(await toast(),/^Pattern logic saved/);
 assert.equal(await ev(()=>getLogic('pants')[0].label),'REVIEWED FRONT');assert.equal(await ev(()=>LAST.cutlist[0].label),'REVIEWED FRONT');
 assert.equal(await ev(()=>localStorage.getItem('maya_logic_pants')),JSON.stringify([{label:'AMBIGUOUS LEGACY PRIVATE SHAPE',qty:9}]));assert.equal(await ev(()=>localStorage.getItem('maya_logic_locked')),'1','Legacy keys remain intact');
 await draft('newer reset draft x3');await fault({logicRemove:true});await ev(()=>resetLogic());assert.match(await toast(),/not reset/);
 assert.equal(await page.locator('#logic-edit').inputValue(),'newer reset draft x3');assert.equal(await ev(()=>getLogic('pants')[0].label),'REVIEWED FRONT');
 await fault({logicRemove:false});await ev(()=>resetLogic());assert.deepEqual(await ev(()=>getLogic('pants')),base);assert.match(await toast(),/reset to default/);
 await fault({lockSet:true});await ev(()=>toggleLogicLock());assert.equal(await ev(()=>logicLocked()),false);assert.match(await toast(),/not changed/);
 await fault({lockSet:false});await ev(()=>toggleLogicLock());assert.equal(await ev(()=>logicLocked()),true);assert.equal(await ev(()=>localStorage.getItem(logicLockKey())),'1');
 await ev(()=>toggleLogicLock());await draft('owner a private shape x2');await ev(()=>saveLogic());
 // Same-subject renewal preserves drafts; an account round trip cannot revive one.
 await draft('owner a unsaved private draft x4');await account('owner-a',2);assert.equal(await page.locator('#logic-edit').inputValue(),'owner a unsaved private draft x4');
 await account('owner-b');await choose();assert.deepEqual(await ev(()=>getLogic('pants')),base);assert.equal(await ev(()=>logicLocked()),false);
 assert.ok(!(await page.locator('#logic').innerText()).includes('owner a'));await ev(()=>saveLogic());assert.match(await toast(),/account changed/);
 await account('owner-a',3);await choose();assert.equal(await ev(()=>getLogic('pants')[0].label),'OWNER A PRIVATE SHAPE');assert.ok(!(await page.locator('#logic-edit').inputValue()).includes('unsaved'));
 // Standalone uploads retain explicit dimensions and truthful browser-storage failures.
 await chooseStandalone();await page.locator('#m-waist').fill('30');const keyA=await ev(()=>measurementKey());
 await fault({measureSet:true});await page.locator('#m-waist').fill('42');assert.match(await toast(),/kept for this session.*could not be saved/);
 assert.equal(await ev(()=>JSON.parse(sessionStorage.getItem(measurementKey())).waist),'30');assert.equal(await ev(()=>getMeasures().waist),42);
 await ev(()=>syncMeasures());assert.equal(await page.locator('#m-waist').inputValue(),'42');assert.match(await page.locator('#dim-derived').textContent(),/waist 42/);
 const prompt=await ev(()=>{setOperationRunning(true);const result={waist:getMeasures().waist,prompt:composeGroundedPrompt({type:'pants'},'pants',KB.grammar.types.pants,[]),disabled:$('logic-edit').disabled};setOperationRunning(false);return result;});
 assert.equal(prompt.waist,42);assert.match(prompt.prompt,/waist 42/);assert.equal(prompt.disabled,true,'Running freezes the Pattern Logic textarea too');
 await account('owner-a',4);assert.equal(await ev(()=>getMeasures().waist),42,'Renewal retains unsaved current measurements');
 await fault({measureSet:false});await page.locator('#m-waist').fill('42.5');assert.equal(await ev(()=>JSON.parse(sessionStorage.getItem(measurementKey())).waist),'42.5');
 await chooseStandalone('upload-b');assert.notEqual(await ev(()=>measurementKey()),keyA,'Distinct saved IDs sharing an image do not share measurements');assert.equal(await ev(()=>getMeasures().waist),null);
 await choose('pants-a','submission-b');assert.equal(await ev(()=>getMeasures().waist),null,'Unmeasured saved submission cannot inherit standalone dimensions');assert.equal(await page.locator('#standalone-measurements').isVisible(),false);
 await chooseStandalone();assert.equal(await ev(()=>getMeasures().waist),42.5);
 await account('owner-b',2);await chooseStandalone();assert.equal(await ev(()=>getMeasures().waist),null);
 await account('owner-a',5);await chooseStandalone();assert.equal(await ev(()=>getMeasures().waist),42.5);
 // Security failures cannot silently authorize seed logic or empty measurements.
 await fault({measureGet:true});await chooseStandalone('unreadable-measurement');await ev(()=>startTest());assert.match(await toast(),/measurements could not be read/);assert.equal(paid.length,0);
 await fault({measureSet:true});await page.locator('#m-waist').fill('46');assert.equal(await ev(()=>getMeasures().waist),46);assert.equal(await ev(()=>measurementState().unavailable),false);
 await fault({measureGet:false,measureSet:false,logicGet:true});await account('unreadable-owner');await choose();await ev(()=>startTest());assert.match(await toast(),/Injected logic Get|Pattern Logic could not be read/);assert.equal(paid.length,0);
 await draft('reviewed replacement x2');await fault({logicSet:true});await ev(()=>saveLogic());assert.match(await toast(),/not saved/);assert.equal(await page.locator('#logic-edit').inputValue(),'reviewed replacement x2');
 await fault({logicSet:false});await ev(()=>saveLogic());assert.match(await toast(),/^Pattern logic saved/);assert.equal(await ev(()=>getLogic('pants')[0].label),'REVIEWED REPLACEMENT');
 await fault({logicGet:false,lockGet:true});await account('unreadable-lock');await choose();await ev(()=>startTest());assert.match(await toast(),/Injected lock Get|Test lock could not be read/);assert.equal(paid.length,0);
 await fault({lockGet:false});await ev(()=>renderLogic());await draft('shape before project switch x1');await choose('other-garment');await ev(()=>saveLogic());assert.match(await toast(),/account changed/);
 // Actual Settings fields follow Editor material; the drawer follows shared Overlay material.
 await account('visual-owner');await choose();const defaults=await ev(()=>structuredClone(MayaTypographyControls.defaults));
 const saved=structuredClone(defaults);for(const role of ['P1','P3'])Object.assign(saved.type[role],{font:'cormorant',size:role==='P1'?12:12,weight:500,style:'italic'});
 Object.assign(saved.editor,{background:'green',fill:70,paddingX:15,paddingY:11,radius:16,borderColor:'gray',rim:73});Object.assign(saved.drawer,{background:'green',fill:65,blur:13,saturation:140,paddingX:20,paddingY:18,radius:22});saved.pillX=8;saved.pillY=8;saved.iconColor='#123abc';saved.iconOpacity=65;saved.iconStroke=3;
 assert.equal(validDesign(defaults),true);assert.equal(validDesign(saved),true);
 for(const [mode,value] of [['default',defaults],['saved',saved]]){
  design=value;await ev(()=>MayaTypographyControls.load());
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});await ev(()=>toggleDrawer(true));await draft('kept after quota failure x2\nreviewed waistband x1');await fault({logicSet:true});await ev(()=>saveLogic());
   assert.match(await toast(),/not saved/);await page.locator('#logic-edit').focus();
   assert.equal(await page.locator('#logic-edit').evaluate(e=>document.activeElement===e),true);
   await page.waitForFunction(weight=>getComputedStyle(document.getElementById('logic-edit')).fontWeight===weight,mode==='saved'?'500':'300');
   await page.waitForFunction(weight=>['logic-save-btn','toast'].every(id=>getComputedStyle(document.getElementById(id)).fontWeight===weight),mode==='saved'?'500':'300');
   const field=await styles('#logic-edit'),button=await styles('#logic-save-btn'),notice=await styles('#toast');
   assert.equal(field.paddingX,mode==='saved'?'15px':'8px');assert.equal(field.paddingY,mode==='saved'?'11px':'8px');assert.equal(field.background,mode==='saved'?'rgba(23, 91, 59, 0.7)':'rgb(0, 0, 0)');
   assert.match(field.font,mode==='saved'?/Cormorant/:/Jost/);assert.equal(field.weight,mode==='saved'?'500':'300');assert.equal(field.size,'12px');
   assert.match(button.font,mode==='saved'?/Cormorant/:/Jost/);assert.equal(button.weight,mode==='saved'?'500':'300');assert.equal(button.paddingX,mode==='saved'?'8px':'14px');
   await page.waitForFunction(size=>getComputedStyle(document.getElementById('toast')).fontSize===size,mode==='saved'?'12px':'10px');
   assert.match(notice.font,mode==='saved'?/Cormorant/:/Jost/);assert.equal(notice.weight,mode==='saved'?'500':'300');
   assert.equal(await page.locator('#drawer').evaluate(e=>getComputedStyle(e).backdropFilter),mode==='saved'?'blur(13px) saturate(1.4)':'blur(28px) saturate(1.8)');
   const close=await page.locator('.drawer-burger').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),g=e.querySelector('svg'),gs=getComputedStyle(g),gr=g.getBoundingClientRect();return {x:s.paddingLeft,y:s.paddingTop,background:s.backgroundColor,width:r.width,height:r.height,glyphWidth:gr.width,glyphHeight:gr.height,color:gs.color,opacity:gs.opacity,stroke:gs.strokeWidth};});
   assert.equal(close.x,mode==='saved'?'8px':'14px');assert.equal(close.y,mode==='saved'?'8px':'6px');assert.equal(close.background,'rgba(3, 15, 29, 0.18)');assert.equal(close.color,mode==='saved'?'rgb(18, 58, 188)':'rgb(170, 181, 196)');assert.equal(close.opacity,mode==='saved'?'0.65':'1');assert.equal(close.stroke,mode==='saved'?'3px':'2px');assert.ok(Math.abs(close.width-close.glyphWidth-2*parseFloat(close.x)-2)<1&&Math.abs(close.height-close.glyphHeight-2*parseFloat(close.y)-2)<1,'Close follows the active Glass/icon preview geometry');
   for(const selector of ['#logic-edit','#logic-save-btn','#logic-reset-btn','#toast']){
    await page.locator(selector).scrollIntoViewIfNeeded();const box=await page.locator(selector).boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,mode+' '+width+' reachable '+selector);
    assert.ok(await page.locator(selector).evaluate(e=>e.scrollWidth<=e.clientWidth+1),mode+' '+width+' no clipped text '+selector);
   }
   await chooseStandalone();await fault({measureSet:true});await page.locator('#m-waist').fill('42');assert.match(await toast(),/could not be saved/);
   assert.equal(await page.locator('#m-waist').evaluate(e=>document.activeElement===e),true);assert.equal(await ev(()=>getMeasures().waist),42);
   const warning=await page.locator('#toast').boundingBox();assert.ok(warning&&warning.x>=0&&warning.x+warning.width<=width+1);assert.ok(await page.locator('#toast').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Measurement warning remains fully readable');
   if(process.env.MAYA_OPERATION_SAVE_SCREENSHOT){await page.screenshot({path:process.env.MAYA_OPERATION_SAVE_SCREENSHOT+'-'+mode+'-'+width+'.png'});}
   await fault({logicSet:false,measureSet:false});
  }
 }
 assert.equal(paid.length,0);assert.deepEqual(errors,[]);
 console.log('Operation saves: quota/security failures retain reviewed logic and current measurement prompts; retry/reset/lock, legacy retention, account renewal/round trips, submission/garment isolation and default/saved error controls at six widths passed.');
}finally{await browser.close();}
