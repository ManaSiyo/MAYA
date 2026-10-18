// Real shared controls, isolated browser, local files and fake authenticated saves.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
import {DEFAULT_TEXT_AUTOMATIONS} from '../docs/server/text-automations.mjs';

const root=resolve(new URL('../',import.meta.url).pathname),widths=[320,390,768,1024,1440,1920];
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH,ignoreDefaultArgs:['--hide-scrollbars']});
const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
context.setDefaultTimeout(10000);
const errors=[];let saved={},failSave=false,posts=0;
const state={campaigns:[{id:'campaign',name:'Fixture campaign',status:'active'}],contacts:[{id:'person',campaignId:'campaign',name:'Fixture person',notes:'',subject:'',body:'',stage:'new',email:'person@example.com'}],companies:[],settings:{},crm:{}};
await context.addInitScript(()=>{localStorage.setItem('maya_admin_tok','fixture');window.setInterval=()=>0;});
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='maya.manasiyo.com')return route.abort();
 if(url.pathname==='/api/design')return route.fulfill({json:saved});
 if(url.pathname==='/api/admin/design'){
  assert.equal(req.headers().authorization,'Bearer fixture');const body=req.postDataJSON();assert.equal(validDesign(body),true,'Actual Save uses the validated complete schema');posts++;
  if(failSave)return route.fulfill({status:503,json:{error:'Fixture save unavailable'}});saved=structuredClone(body);return route.fulfill({json:{ok:true}});
 }
 if(url.pathname==='/api/admin/text-automations')return route.fulfill({json:{ok:true,settings:DEFAULT_TEXT_AUTOMATIONS}});
 if(url.pathname==='/api/admin/outbound')return route.fulfill({json:{ok:true,state,accountId:'fixture',capabilities:{}}});
 if(url.pathname.endsWith('/intelligence'))return route.fulfill({json:{ok:true,mailboxes:[],crm:{},gmailReady:false}});
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 const path=resolve(root,'.'+url.pathname);if(!path.startsWith(root+'/'))return route.abort();
 try{return route.fulfill({body:readFileSync(path),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const style=async(selector,pseudo=null)=>page.locator(selector).first().evaluate((e,pseudo)=>{const s=getComputedStyle(e,pseudo),r=e.getBoundingClientRect();return {width:s.width,height:s.height,background:s.backgroundColor,image:s.backgroundImage,position:s.backgroundPosition,radius:s.borderRadius,border:s.borderColor,outline:s.outlineWidth,opacity:s.opacity,appearance:s.appearance,display:s.display,x:r.x,y:r.y,w:r.width,h:r.height};},pseudo);
const setField=async(kind,key,value)=>{const edit=page.locator('.'+kind+'-editor');if(!await edit.evaluate(e=>e.open))await edit.locator('summary').click();const field=edit.locator('[data-field="'+key+'"]');if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));};
const editFields=async(selector,values)=>{const edit=page.locator(selector);if(!await edit.evaluate(e=>e.open))await edit.locator('summary').click();for(const [key,value]of Object.entries(values)){const field=edit.locator('[data-field="'+key+'"]');if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));}await page.keyboard.press('Escape');};
const save=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/design');await page.locator('#save').click();await response;await page.waitForFunction(()=>!document.getElementById('save').disabled);};
const changed={checkbox:{size:24,radius:6,background:'blue',fill:90,rim:80,borderColor:'white',checkedColor:'#38bdf8',checkColor:'#102030'},scrollbar:{width:16,radius:2,thumbColor:'#38bdf8',thumbOpacity:85,trackColor:'#15352f',trackOpacity:60}};
try{
 await page.goto('https://maya.manasiyo.com/aesthetics/aesthetic-control.html');await page.locator('#checkbox-preview-unchecked').waitFor();await page.evaluate(()=>MayaTypographyControls.ready);
 const normalization=await page.evaluate(()=>{const before=localStorage.getItem('maya-typography-controls-v1'),old=structuredClone(MayaTypographyControls.defaults);delete old.checkbox;delete old.scrollbar;const original=JSON.stringify(old),next=MayaTypographyControls.normalize(old);return {checkbox:next.checkbox,scrollbar:next.scrollbar,unchanged:original===JSON.stringify(old),noWrite:before===localStorage.getItem('maya-typography-controls-v1')};});
 assert.equal(normalization.checkbox.size,16);assert.equal(normalization.scrollbar.trackOpacity,0);assert.ok(normalization.unchanged&&normalization.noWrite);assert.equal(posts,0,'Reading legacy settings performs no save');
 const peer=await context.newPage();peer.on('pageerror',e=>errors.push(e.message));await peer.goto('https://maya.manasiyo.com/backend/status.html');await peer.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);await peer.evaluate(async()=>{await MayaTypographyControls.ready;_idTok='fixture';toggleDrawer(true);admTab('automations');});await peer.locator('#automation-first-enabled').waitFor();
 assert.equal(await peer.locator('#automation-first-enabled').evaluate(e=>getComputedStyle(e).width),'16px','Actual Admin uses the unchecked default');assert.equal(await peer.locator('#automation-first-text').evaluate(e=>getComputedStyle(e,'::-webkit-scrollbar').width),'8px');
 let control=await style('#checkbox-preview-unchecked');assert.deepEqual([control.width,control.height,control.background,control.image,control.radius],['16px','16px','rgb(0, 0, 0)','none','3px']);
 for(const selector of ['#checkbox-preview-checked','#checkbox-preview-mixed']){control=await style(selector);assert.match(control.image,/data:image\/svg/);assert.equal(control.position,'50% 50%');assert.equal(control.background,'rgb(170, 181, 196)');}
 assert.equal((await style('#checkbox-preview-disabled')).opacity,'0.45');
 await page.locator('#checkbox-preview-unchecked').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#checkbox-preview-unchecked').isChecked(),true);assert.equal((await style('#checkbox-preview-unchecked')).outline,'2px');await page.keyboard.press('Space');
 assert.equal(await page.locator('#checkbox-preview-unchecked').isChecked(),false);assert.equal(await page.locator('#checkbox-preview-disabled').isDisabled(),true);
 assert.equal((await style('#scrollbar-preview','::-webkit-scrollbar')).width,'8px');assert.equal((await style('#scrollbar-preview','::-webkit-scrollbar-track')).background,'rgba(0, 0, 0, 0)');
 await page.setViewportSize({width:390,height:900});await page.locator('#scrollbar-preview').focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.getElementById('scrollbar-preview').scrollTop>0);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('scrollbar-preview').scrollLeft>0);
 for(const phase of ['default','saved']){
  if(phase==='saved'){
   await page.setViewportSize({width:1440,height:1100});
   for(const [kind,settings]of Object.entries(changed))for(const [key,value]of Object.entries(settings))await setField(kind,key,value);
   await page.keyboard.press('Escape');
   // Editing a different control must not silently reset these unsaved previews.
   await page.locator('.spacing-controls summary').click();await page.locator('.spacing-controls [data-field=leads]').fill('27');await page.keyboard.press('Escape');
   assert.equal((await style('#checkbox-preview-unchecked')).width,'24px');assert.equal((await style('#scrollbar-preview','::-webkit-scrollbar')).width,'16px');
   for(const role of ['H3','P1','P3'])await editFields('[data-category='+role+'] .type-editor',{font:'cormorant',weight:500,color:role==='H3'?'gray':'white'});
   await editFields('.popup-editor',{background:'black',fill:95,rim:70,radius:6,paddingX:18,paddingY:12});
   await editFields('.regular-pill-editor',{background:'green',fill:70,paddingX:20,paddingY:9});
   await editFields('[data-editor=inner] .type-editor',{background:'green',fill:70,radius:20,paddingX:20,paddingY:12});
   await save();assert.deepEqual(saved.checkbox,changed.checkbox);assert.deepEqual(saved.scrollbar,changed.scrollbar);
   await peer.waitForFunction(()=>getComputedStyle(document.getElementById('automation-first-enabled')).width==='24px');assert.equal(await peer.locator('#automation-first-text').evaluate(e=>getComputedStyle(e,'::-webkit-scrollbar').width),'16px','Successful Save propagates to an already open Admin without reload');
   await setField('checkbox','size',20);failSave=true;await save();failSave=false;assert.equal(saved.checkbox.size,24);assert.equal((await style('#checkbox-preview-unchecked')).width,'20px','A failed Save retains the editable draft');
   assert.equal(await peer.locator('#automation-first-enabled').evaluate(e=>getComputedStyle(e).width),'24px','Failed Save cannot publish an unsaved input draft to peers');await peer.close();
   await page.locator('.checkbox-editor + .restore-editor').click();assert.equal((await style('#checkbox-preview-unchecked')).width,'24px','Restore retains the last successful Save after a failed write');
   await page.reload();await page.locator('#checkbox-preview-unchecked').waitFor();await page.evaluate(()=>MayaTypographyControls.ready);assert.equal((await style('#checkbox-preview-unchecked')).width,'24px');
   control=await style('#checkbox-preview-unchecked');assert.equal(control.background,'rgba(35, 76, 125, 0.9)');assert.equal(control.radius,'6px');assert.equal(control.border,'rgba(255, 255, 255, 0.8)');
   control=await style('#checkbox-preview-checked');assert.equal(control.background,'rgb(56, 189, 248)');assert.match(control.image,/%23102030/);
   assert.equal((await style('#scrollbar-preview','::-webkit-scrollbar-thumb')).radius,'2px');assert.equal((await style('#scrollbar-preview','::-webkit-scrollbar-track')).background,'rgba(21, 53, 47, 0.6)');
   assert.equal((await style('#scrollbar-preview')).background,'rgba(23, 91, 59, 0.7)','Scroll preview follows saved Inner material');
   for(const selector of ['#input-controls-preview>h3','#input-controls-preview>p','.checkbox-preview-states label','.checkbox-editor summary'])assert.match(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).fontFamily),/Cormorant/,selector+' uses shared typography');
   assert.equal((await style('.checkbox-editor summary')).background,'rgba(23, 91, 59, 0.7)','New Edit follows Regular pill material');
  }
  for(const width of widths){
   await page.setViewportSize({width,height:1100});await page.locator('#input-controls-preview').scrollIntoViewIfNeeded();
   assert.ok(await page.locator('#input-controls-preview').evaluate(e=>e.scrollWidth<=e.clientWidth+1),phase+' preview fits '+width);
   assert.ok(await page.locator('.checkbox-preview-states label').evaluateAll(es=>es.every(e=>{const input=e.querySelector('input').getBoundingClientRect(),label=e.getBoundingClientRect();return Math.abs(input.y+input.height/2-label.y-label.height/2)<1;})),phase+' checkboxes center '+width);
   for(const kind of ['checkbox','scrollbar']){const edit=page.locator('.'+kind+'-editor');await edit.locator('summary').click();const box=await edit.locator('.type-editor-fields').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,phase+' '+kind+' editor fits '+width);if(phase==='saved'){assert.equal(await edit.locator('.type-editor-fields').evaluate(e=>getComputedStyle(e).padding),'12px 18px');assert.equal(await edit.locator('[data-field]').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0.95)');}await page.keyboard.press('Escape');}
   if(width===390||width===1440)await page.locator('#input-controls-preview').screenshot({path:'/private/tmp/maya-input-controls-'+phase+'-'+width+'.png'});
   await page.getByRole('button',{name:'Drawer',exact:true}).click();const drawer=page.locator('dialog.maya-drawer');assert.equal(await drawer.getAttribute('data-maya-popup'),'');
   const material=await drawer.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {background:s.backgroundColor,padding:s.padding,blur:s.backdropFilter,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
   assert.equal(material.background,phase==='saved'?'rgba(0, 0, 0, 0.95)':'rgb(0, 0, 0)','Settings preview follows Dropdown backing');assert.equal(material.padding,phase==='saved'?'12px 18px':'8px');assert.equal(material.blur,'blur(22px) saturate(1.8)','Temporary backing preserves overlay blur and saturation');assert.ok(material.left>=0&&material.right<=width&&material.top>=0&&material.bottom<=1100,'Settings preview fits '+width);
   if(width===390||width===1440)await drawer.screenshot({path:'/private/tmp/maya-settings-preview-'+phase+'-'+width+'.png'});
   if(width===320){await drawer.getByRole('button',{name:'Edit dropdown',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.popup-editor').open);assert.equal(await page.locator('.popup-editor').evaluate(e=>e.open),true,'Settings preview opens its actual saved material editor');await page.keyboard.press('Escape');}else await drawer.getByRole('button',{name:'Close Settings',exact:true}).click();
  }
 }
 await page.emulateMedia({forcedColors:'active'});control=await style('#checkbox-preview-checked');assert.equal(control.appearance,'auto');assert.equal(control.image,'none','High contrast returns to the native checked indicator');await page.emulateMedia({forcedColors:'none'});

 // Actual Admin controls use the same saved style and preserve native behavior.
 await page.goto('https://maya.manasiyo.com/backend/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);await page.evaluate(async()=>{await MayaTypographyControls.ready;_idTok='fixture';toggleDrawer(true);admTab('automations');});await page.locator('#automation-first-text').waitFor();
 for(const width of widths){await page.setViewportSize({width,height:1100});const checkbox=await style('#automation-first-enabled');assert.equal(checkbox.width,'24px');assert.equal(checkbox.height,'24px');assert.ok(await page.locator('#automation-first-enabled').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('label').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)<1;}),'Live Admin checkbox centers '+width);}
 const checked=await page.locator('#automation-first-enabled').isChecked();await page.locator('#automation-first-enabled').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#automation-first-enabled').isChecked(),!checked,'Native Admin toggle remains interactive');
 await page.locator('#automation-first-text').fill(Array(40).fill('A reviewed local-only automation draft.').join('\n'));await page.locator('#automation-first-text').focus();await page.keyboard.press('Control+End');assert.ok(await page.locator('#automation-first-text').evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollTop>0));assert.equal((await style('#automation-first-text','::-webkit-scrollbar')).width,'16px');assert.equal((await style('#automation-first-text','::-webkit-scrollbar')).display,'block','Explicit content controls override the drawer hidden-scrollbar rule');
 assert.equal((await style('#adm-hscroll','::-webkit-scrollbar')).display,'none','Navigation tracks retain their intentional hidden state');
 await page.setViewportSize({width:390,height:900});await page.locator('#drawer-automations').screenshot({path:'/private/tmp/maya-input-controls-admin-saved-390.png'});

 // Screenshot regression: populated Feature Requests and the open Leads filter.
 await page.evaluate(()=>{toggleDrawer(false);paintLeads({connected:true,list:[{id:'lead',name:'Reviewed lead',phone:'+14155550123',stage:'contacted'}]});const host=document.getElementById('features-list');host.innerHTML='<section class="fr-room" data-maya-scrollbar="visible" tabindex="0" aria-label="Client feature requests">'+Array.from({length:30},(_,i)=>'<p>Reviewed request '+i+'</p>').join('')+'</section>';document.getElementById('features-fold').open=true;});
 const scroller=page.locator('#features-list .fr-room');await scroller.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('#features-list .fr-room').scrollTop>0);
 assert.equal((await style('#features-list .fr-room','::-webkit-scrollbar-track')).background,'rgba(21, 53, 47, 0.6)','Real Feature Requests uses the saved track');assert.equal((await style('#features-list .fr-room','::-webkit-scrollbar-thumb')).background,'rgba(56, 189, 248, 0.85)');
 await page.locator('.lead-filter>summary').click();await page.locator('#lead-status-menu').waitFor({state:'visible'});
 await page.locator('#lead-status-menu [data-status="canceled"]').uncheck();
 const cancelled=page.locator('#lead-status-menu [data-status="canceled"]');assert.equal(await cancelled.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(35, 76, 125, 0.9)');
 assert.ok(await cancelled.evaluate(e=>{const box=e.getBoundingClientRect(),row=e.closest('label').getBoundingClientRect();return Math.abs(box.y+box.height/2-row.y-row.height/2)<1;}),'Real unchecked Leads control centers in its row');
 assert.ok(await page.locator('#lead-status-menu label').evaluateAll(rows=>rows.every((row,i)=>i===0||row.getBoundingClientRect().top>=rows[i-1].getBoundingClientRect().bottom-1)),'Actual Lead status choices remain one vertical row each');
 await page.screenshot({path:'/private/tmp/maya-leads-filter-saved-390.png'});
 await page.keyboard.press('Escape');

 // Actual Outbound row selection is centered and still keyboard-operable.
 await page.goto('https://maya.manasiyo.com/backend/outbound.html');await page.locator('.people-table [data-person="person"]').waitFor();await page.evaluate(()=>MayaTypographyControls.ready);
 const contact=page.locator('.people-table input[data-select]').first();assert.equal(await contact.evaluate(e=>getComputedStyle(e).width),'24px');
 assert.ok(await contact.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('td').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1&&Math.abs(a.y+a.height/2-b.y-b.height/2)<1;}),'Outbound selection centers within its cell');
 const before=await contact.isChecked();await contact.focus();await page.keyboard.press('Space');assert.equal(await contact.isChecked(),!before);assert.deepEqual(errors,[]);
 console.log('Input controls passed: native checkbox states/keyboard, transparent default scrollbar, saved geometry/colors, legacy compatibility, Save/failure/Restore, forced colors, six widths, and real Admin/Outbound consumers.');
}catch(error){await page.screenshot({path:'/private/tmp/maya-input-controls-failure.png',fullPage:true});console.error('Input-control fixture errors:',errors);throw error;}finally{await browser.close();}
