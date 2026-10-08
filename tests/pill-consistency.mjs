import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';

// A real served-page fixture with an in-memory design API. No live provider or
// personal Chrome access; even the remote-looking hostname is intercepted.
const root=new URL('../',import.meta.url).pathname,origin='https://maya.manasiyo.com';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage(),failures=[],pageErrors=[],posts=[];
let savedDesign={},saveMode='fail',heldSave;
const widths=[320,390,768,1024,1440,1920];
const marketing={leads:{connected:true,list:[{id:'pill-person',name:'Example Person',phone:'+14155550123',stage:'completed',createdAt:'2026-10-07',wrote:'A reviewed note.'}]},adCombined:{campaigns:[{source:'google',campaign:'Example campaign',impressions:75,linkClicks:4,spend:3.2},{source:'meta',campaign:'Waiting campaign',impressions:0,linkClicks:0,spend:0}]}};
const outbound={campaigns:[{id:'ceremonial',name:'Ceremonial',status:'active'}],contacts:[{id:'person',campaignId:'ceremonial',name:'Example Person',company:'Example Studio',email:'example@example.com',stage:'contacted',notes:'Fixture'}],companies:[],settings:{}};
const routes={'/':'/frontend/index.html','/status.html':'/backend/status.html','/outbound.html':'/backend/outbound.html','/backend.html':'/backend/backend.html','/operations.html':'/backend/operations.html','/playground.html':'/playground/index.html'};
page.on('pageerror',error=>pageErrors.push({path:new URL(page.url()).pathname,message:error.message}));
await context.addInitScript(()=>{window.setInterval=()=>0;localStorage.setItem('maya_admin_tok','fixture-admin');});
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
 if(url.pathname==='/api/design')return route.fulfill({json:savedDesign});
 if(url.pathname==='/api/admin/design'){
  const body=req.postDataJSON();posts.push({body,auth:req.headers().authorization});
  if(!validDesign(body))return route.fulfill({status:400,json:{error:'Invalid fixture design'}});
  if(saveMode==='fail')return route.fulfill({status:503,json:{error:'Fixture unavailable'}});
  if(saveMode==='hold'){heldSave={route,body};return;}
  savedDesign=structuredClone(body);return route.fulfill({json:{ok:true,savedAt:'2026-10-07T12:00:00Z'}});
 }
 if(url.pathname==='/api/admin/marketing')return route.fulfill({json:marketing});
 if(url.pathname==='/api/admin/messages/thread')return route.fulfill({json:{ok:true,thread:{number:'+14155550123',name:'Example Person',consent:'yes',messages:[],hasArchive:false}}});
 if(url.pathname.startsWith('/api/admin/outbound'))return route.fulfill({json:{ok:true,state:outbound,capabilities:{sheets:true},mailboxes:[],crm:{},accountId:'fixture'}});
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,threads:[],models:{},headline:'Fixture',items:[],folders:[]}});
 const path=resolve(root,'.'+(routes[url.pathname]||url.pathname));if(!path.startsWith(root))return route.abort();
 try{return route.fulfill({body:readFileSync(path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
});
function check(condition,message,details){if(!condition)failures.push(message+(details?' '+JSON.stringify(details):''));}
async function ready(path){await page.goto(origin+path);await page.waitForFunction(()=>window.MayaTypographyControls&&window.MayaPillControls);await page.evaluate(()=>MayaTypographyControls.ready);}
async function measure(selector){
 const locator=page.locator(selector).first();if(!await locator.count()){failures.push('Missing pill: '+selector);return null;}
 return locator.evaluate(el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect(),range=document.createRange();
  const text=el.querySelector('.status-text')||el;range.selectNodeContents(text);const tr=range.getBoundingClientRect();
  const svg=el.querySelector('svg'),glyph=svg?.getBoundingClientRect();
  const before=getComputedStyle(el,'::before'),after=getComputedStyle(el,'::after');
  const flow=[...el.childNodes].flatMap(node=>{if(node.nodeType===Node.TEXT_NODE){if(!node.textContent.trim())return [];const range=document.createRange();range.selectNode(node);return [{width:range.getBoundingClientRect().width,height:parseFloat(s.lineHeight)}];}if(node.nodeType!==Node.ELEMENT_NODE)return [];const cs=getComputedStyle(node);return cs.display==='none'||['absolute','fixed'].includes(cs.position)?[]:[node.getBoundingClientRect()];});
  return {width:r.width,height:r.height,x:r.x,right:r.right,paddingX:parseFloat(s.paddingLeft),paddingY:parseFloat(s.paddingTop),paddingRight:parseFloat(s.paddingRight),paddingBottom:parseFloat(s.paddingBottom),border:parseFloat(s.borderLeftWidth),borderTop:parseFloat(s.borderTopWidth),borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow,blur:s.backdropFilter,image:s.backgroundImage,opacity:s.opacity,line:parseFloat(s.lineHeight),fontSize:parseFloat(s.fontSize),textWidth:tr.width,textHeight:tr.height,display:s.display,overflow:el.scrollWidth-el.clientWidth,flowHeight:Math.max(0,...flow.map(r=>r.height)),flowWidth:flow.reduce((n,r)=>n+r.width,0)+(parseFloat(s.columnGap)||0)*Math.max(0,flow.length-1),glyph:glyph?{width:glyph.width,height:glyph.height,left:glyph.left-r.left,top:glyph.top-r.top,right:r.right-glyph.right,bottom:r.bottom-glyph.bottom,stroke:getComputedStyle(svg).stroke,fill:getComputedStyle(svg).fill,path:svg.querySelector('path')?.getAttribute('d')}:null,before:{width:parseFloat(before.width)||0,content:before.content,position:before.position},after:{width:parseFloat(after.width)||0,height:parseFloat(after.height)||0,content:after.content,position:after.position},gap:parseFloat(s.columnGap)||0};
 });
}
function geometry(box,label,x,y,{kind='text',regular=false}={}){
 if(!box)return;
 check(box.width>0&&box.height>0,label+' is rendered',box);
 check(box.paddingX===x&&box.paddingY===y,label+' uses saved X/Y padding',{actual:[box.paddingX,box.paddingY],expected:[x,y]});
 check(box.overflow<=1,label+' content fits its capsule',{overflow:box.overflow});
 const contentHeight=kind==='icon'?box.glyph?.height:kind==='mixed'?box.flowHeight:Math.max(box.line,kind==='edit'?box.after.height:0);
 if(Number.isFinite(contentHeight))check(Math.abs(box.height-contentHeight-y*2-box.borderTop*2)<1.1,label+' height is content + padding + border',{actual:box.height,expected:contentHeight+y*2+box.borderTop*2});
 if(kind==='text'||kind==='edit'||kind==='icon'||kind==='mixed'){
  const contentWidth=kind==='icon'?box.glyph?.width:kind==='mixed'?box.flowWidth:box.textWidth+(kind==='edit'?box.after.width+box.gap:0);
  check(Math.abs(box.width-contentWidth-box.paddingX-box.paddingRight-box.border*2)<1.2,label+' width is content + padding + border',{actual:box.width,expected:contentWidth+box.paddingX+box.paddingRight+box.border*2});
 }
 if(regular)check(box.blur==='none'&&box.shadow==='none'&&box.image==='none',label+' is regular material',box);
 else check(box.border===1&&box.shadow!=='none'&&box.blur!=='none',label+' retains glass enclosure',{border:box.border,shadow:box.shadow,blur:box.blur});
 if(box.glyph){check(box.glyph.width>8&&box.glyph.height>8,label+' SVG glyph has a visible size',box.glyph);check(box.glyph.left>=x-.6&&box.glyph.right>=x-.6&&box.glyph.top>=y-.6&&box.glyph.bottom>=y-.6,label+' glyph stays inside padding',box.glyph);check(box.glyph.path&&box.glyph.stroke!=='none',label+' uses a stroked SVG glyph',box.glyph);}
}
const galleryTargets=[['#buttons > .preview-row > .maya-pill','Gallery glass text','text'],['#save','Gallery Save','icon'],['.icon-row [aria-label="Save"]','Leftmost Save icon','icon']];
const adminTargets=[['#range-chips [data-r="D"]','Admin D','text'],['#range-chips [data-r="W"]','Admin W','text'],['#range-chips [data-r="M"]','Admin M','text'],['#metric-chips [data-m="clicks"]','Admin chart clicks','text'],['#metric-chips [data-m="cpc"]','Admin chart cost','text'],['#leads-table .lead-status','Admin lead status','status']];
async function populateAdmin(){await page.evaluate(async()=>{_idTok='fixture-admin';await loadMkt();});}
async function adminChecks(label,x,y){
 await ready('/status.html');await populateAdmin();
 const snapshots={};
 for(const width of widths){await page.setViewportSize({width,height:1000});for(const [selector,name,kind] of adminTargets){const box=await measure(selector);geometry(box,`${label} ${name} ${width}`,x,y,{kind});check(box.background===(label==='saved'?'rgba(3, 15, 29, 0.55)':'rgba(3, 15, 29, 0.18)')&&box.blur===(label==='saved'?'blur(9px) saturate(1.4)':'blur(22px) saturate(1.8)'),label+' '+name+' actual material '+width,{background:box.background,blur:box.blur});if(width===1440)snapshots[selector]=box;}
  check(await page.locator('#metric-chips').evaluate(e=>e.scrollWidth<=e.clientWidth+1),label+' Admin chart controls fit '+width);
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#ads-fold').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/private/tmp/maya-pill-admin-ads-'+label+'.png'});
 await page.evaluate(()=>{toggleDrawer(true);admTab('messages');msgNewToggle(true);});await page.locator('#msg-begin').waitFor({state:'visible'});
 check(!await page.locator('#msg-older').isVisible(),label+' hidden Messages older action stays hidden');
 geometry(await measure('#msg-begin'),label+' Admin Begin texting',x,y,{kind:'mixed'});
 await page.evaluate(()=>openThread('+14155550123','Example Person'));
 for(const width of widths){await page.setViewportSize({width,height:1000});for(const selector of ['#msg-call','#msg-share'])geometry(await measure(selector),label+' '+selector+' '+width,x,y,{kind:'icon'});}
 check(!await page.locator('#msg-older').isVisible(),label+' no-archive thread keeps older action hidden');
 await page.evaluate(()=>toggleDrawer(false));return snapshots;
}
async function galleryChecks(label,x,y,rx,ry){
 const snapshots={};
 for(const width of widths){await page.setViewportSize({width,height:1000});for(const [selector,name,kind] of galleryTargets){const box=await measure(selector);geometry(box,`${label} ${name} ${width}`,x,y,{kind});if(width===1440)snapshots[selector]=box;}
  const regular=await measure('[data-maya-pill="regular"]');geometry(regular,label+' regular sample '+width,rx,ry,{regular:true});
  check(regular.background===(label==='Default'?'rgba(0, 0, 0, 0)':'rgba(35, 76, 125, 0.8)'),label+' regular saved material '+width,regular.background);
  for(const edit of await page.locator('.type-editor>summary').all()){
   const box=await edit.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {text:el.textContent,padding:[s.paddingLeft,s.paddingTop],blur:s.backdropFilter,shadow:s.boxShadow,width:r.width,height:r.height};});
   check(box.padding[0]===rx+'px'&&box.padding[1]===ry+'px'&&box.blur==='none'&&box.shadow==='none',label+' every Edit has regular material '+width,box);
  }
  check(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),label+' Gallery fits '+width);
 }
 return snapshots;
}
async function field(group,key,value){const edit=page.locator(group);if(!await edit.evaluate(e=>e.open))await edit.locator('summary').click();const input=edit.locator('[data-field="'+key+'"]');if(await input.evaluate(e=>e.tagName==='SELECT'))await input.selectOption(String(value));else await input.fill(String(value));}
try{
 const adminDefault=await adminChecks('default',14,6);
 await ready('/aesthetics/aesthetic-control.html');await page.locator('.regular-pill-editor [data-field="paddingX"]').waitFor({state:'attached'});
 await page.locator('[data-maya-pill="regular"]').click();check(await page.locator('.regular-pill-editor').evaluate(e=>e.open),'Clicking the regular pill opens its settings');await page.keyboard.press('Escape');
 await page.locator('.status-style-preview [data-status="delivering"]').click();check(await page.locator('.status-style-preview').filter({has:page.locator('[data-status="delivering"]')}).locator('.type-editor').evaluate(e=>e.open),'Clicking the status pill opens its settings');await page.keyboard.press('Escape');
 const galleryDefault=await galleryChecks('Default',14,6,14,6);
 await page.setViewportSize({width:1440,height:1000});
 for(const [key,value] of [['fill',55],['rim',72],['blur',9],['tint',20],['highlight',60],['saturation',140]])await field('.finish-controls details.type-editor',key,value);
 await page.locator('#tokens [data-field="paddingX"]').fill('22');await page.locator('#tokens [data-field="paddingY"]').fill('12');
 await page.keyboard.press('Escape');
 for(const [key,value] of [['background','blue'],['fill',80],['rim',55],['paddingX',8],['paddingY',3]])await field('.regular-pill-editor',key,value);
 await page.keyboard.press('Escape');
 const galleryChanged=await galleryChecks('Edited',22,12,8,3);
 for(const [selector,before] of Object.entries(galleryDefault)){const after=galleryChanged[selector];check(Math.abs(after.width-before.width-16)<1.2,selector+' grows exactly with glass X padding',{before:before.width,after:after.width});check(Math.abs(after.height-before.height-12)<1.2,selector+' grows exactly with glass Y padding',{before:before.height,after:after.height});}
 const regular=await measure('[data-maya-pill="regular"]');check(regular.background==='rgba(35, 76, 125, 0.8)','Regular color preview is visible',regular);
 const glass=await measure('#save');check(glass.background==='rgba(3, 15, 29, 0.55)'&&glass.blur==='blur(9px) saturate(1.4)','Glass preview uses edited material',glass);
 await page.setViewportSize({width:1440,height:1000});await page.locator('.regular-pill-editor>summary').focus();check(await page.locator('.regular-pill-editor>summary').evaluate(e=>getComputedStyle(e).outlineStyle)!=='none','Edit has visible keyboard focus');
 await page.locator('.regular-pill-editor>summary').press('Enter');check(await page.locator('.regular-pill-editor').evaluate(e=>e.open),'Keyboard opens regular editor');
 check(await page.locator('.regular-pill-editor .type-editor-fields').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+1;}),'Open editor stays in viewport');await page.screenshot({path:'/private/tmp/maya-pill-gallery-open.png'});await page.keyboard.press('Escape');
 await page.locator('.state-sample').first().evaluate(e=>e.closest('details').open=true);
 const disabled=page.locator('.state-sample').filter({has:page.locator('.maya-pill:disabled')});check(await disabled.count()===2,'Disabled and loading states are available');
 for(const item of await disabled.locator('.maya-pill').all())check(await item.evaluate(e=>e.disabled&&Number(getComputedStyle(e).opacity)<=.5),'Disabled state is visibly disabled');
 await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Save failed'));
 check(await page.locator('#feedback').evaluate(e=>{const r=e.getBoundingClientRect();return e.classList.contains('save-error')&&getComputedStyle(e).clipPath==='none'&&r.width>80&&r.height>20&&r.left>=0&&r.right<=innerWidth;}),'Failed Save has visible error feedback');check(!await page.locator('#save').isDisabled(),'Failed Save is retryable');check(await page.locator('#tokens [data-field="paddingX"]').inputValue()==='22','Failed Save keeps edited values');await page.screenshot({path:'/private/tmp/maya-pill-gallery-save-error.png'});
 saveMode='hold';await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('save').disabled);
 check(await page.locator('#gallery').evaluate(e=>e.inert),'Gallery is inert while Save is pending');
 for(let i=0;i<50&&!heldSave;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(heldSave,'Save request reached fake API');savedDesign=structuredClone(heldSave.body);await heldSave.route.fulfill({json:{ok:true,savedAt:'2026-10-07T12:00:00Z'}});heldSave=null;saveMode='success';
 await page.waitForFunction(()=>document.getElementById('feedback').textContent==='Saved.');
 check(!await page.locator('#gallery').evaluate(e=>e.inert),'Gallery becomes editable after Save');check(posts.length===2&&posts.every(p=>p.auth==='Bearer fixture-admin'),'Only authenticated fixture design saves occurred');
 await page.reload();await page.locator('.regular-pill-editor [data-field="paddingX"]').waitFor({state:'attached'});await galleryChecks('Reloaded',22,12,8,3);
 for(const [width,suffix] of [[1440,'desktop'],[390,'phone']]){await page.setViewportSize({width,height:1000});await page.locator('#buttons').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/private/tmp/maya-pill-gallery-'+suffix+'.png'});}
 const adminSaved=await adminChecks('saved',22,12);
 for(const [selector,before] of Object.entries(adminDefault)){const after=adminSaved[selector];check(Math.abs(after.width-before.width-16)<1.2,selector+' live width follows saved X padding',{before:before.width,after:after.width});check(Math.abs(after.height-before.height-12)<1.2,selector+' live height follows saved Y padding',{before:before.height,after:after.height});}
 // Existing page controls, including legacy span pills, must share the formula.
 for(const [path,selector,label,kind] of [['/','#voice-bar','App listen','mixed'],['/outbound.html','#sync-sheet','Outbound refresh','text'],['/backend.html','#fabric-workspace-actions .maya-pill','Brief Fabrics','text'],['/operations.html','#start-test','Operation Room Start','text']]){
  await ready(path);if(path==='/outbound.html')await page.locator('.people-table [data-person="person"]').waitFor();for(const width of widths){await page.setViewportSize({width,height:1000});const box=await measure(selector);geometry(box,label+' saved '+width,22,12,{kind});check(box.background==='rgba(3, 15, 29, 0.55)'&&box.blur==='blur(9px) saturate(1.4)',label+' saved material '+width,{background:box.background,blur:box.blur});if(path==='/outbound.html')geometry(await measure('#new-campaign'),'Outbound new campaign glyph '+width,22,12,{kind:'icon'});}
 }
 check(pageErrors.length===0,'All representative pages have no page errors',pageErrors);
 assert.deepEqual(failures,[]);
 console.log('Pill consistency passed: content + padding geometry, glass/regular materials, Save glyphs, Edit/focus/disabled/save failure/retry, authenticated save and reload, Admin/App/Outbound/Brief/Operation Room and six widths.');
}finally{if(heldSave)await heldSave.route.abort();await browser.close();}
