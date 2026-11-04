import assert from 'node:assert/strict';
import {captureAdminNotification} from './admin-notification-fixture.mjs';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[],notificationWrites=[];
page.on('pageerror',e=>errors.push(e.message));
// Exercise the blocked GIS retry after fake auth, independent of host speed.
await page.addInitScript(()=>{const fixtureTimer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>fixtureTimer(fn,window.fixtureFastGsi&&fn.name==='_gisBoot'?5:ms,...args);window.setInterval=()=>0;window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(captureAdminNotification(req,{tokens:['fixture'],batches:notificationWrites}))return route.fulfill({json:{ok:true,items:[]}});
  if(u.pathname==='/api/admin/text-automations'&&req.method()==='GET')return route.fulfill({json:{ok:true,settings:{first:{enabled:true,text:'Hi {name}',trigger:'new_lead',time:'10:00'},second:{enabled:false,text:'Hi {name}',trigger:'no_reply',time:'10:00',days:3}}}});
  if(!['GET','HEAD'].includes(req.method())){writes.push({path:u.pathname,body:req.postDataJSON(),auth:req.headers().authorization});return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);
 await page.evaluate(()=>{_idTok='fixture';window.fixtureFastGsi=true;_gisBoot();toggleDrawer(true);admTab('automations');});await page.locator('#automation-first-text').waitFor({state:'visible'});
 await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0;});
 const snapshot=()=>page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#drawer-automations [data-maya-type],#adm-tabtitle')].map((e,i)=>{const s=getComputedStyle(e);return [e.id||`node-${i}`,{role:e.dataset.mayaType,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,case:s.textTransform,style:s.fontStyle,paddingX:s.paddingLeft,paddingY:s.paddingTop,background:s.backgroundColor}]})));
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT});
 const before=await snapshot();
 assert.equal(before['automation-first-text'].size,'12px');
 assert.equal(before['automation-first-text'].weight,'300');
 assert.equal(before['automation-first-trigger'].paddingX,'8px');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);for(const role of ['H2','H3','P1','P3'])Object.assign(d.type[role],{font:'cormorant',size:({H2:22,H3:18,P1:12,P3:10})[role],weight:500,color:role==='P1'?'white':'gray',case:role==='P3'?'none':'uppercase',style:'italic'});Object.assign(d.inner,{paddingX:23,paddingY:17,background:'green',fill:65,blur:13,saturation:140});Object.assign(d.editor,{paddingX:19,paddingY:11,background:'green',fill:70,borderColor:'gray',rim:73,radius:16});MayaTypographyControls.apply(d);});
 const after=await snapshot();
 for(const [id,s] of Object.entries(after)){
  assert.match(s.font,/Cormorant/,id+' font');assert.equal(s.size,({H2:'22px',H3:'18px',P1:'12px',P3:'10px'})[s.role],id+' size');assert.equal(s.weight,'500',id+' weight');assert.equal(s.case,s.role==='P3'?'none':'uppercase',id+' case');assert.equal(s.style,'italic',id+' italic');assert.notEqual(s.color,before[id].color,id+' color');
 }
 for(const id of ['automation-first-text','automation-first-trigger','automation-first-time','automation-second-days']){
  assert.equal(after[id].paddingX,'19px',id+' X padding');assert.equal(after[id].paddingY,'11px',id+' Y padding');assert.equal(after[id].background,'rgba(23, 91, 59, 0.7)',id+' backing');
 }
 assert.deepEqual(await page.locator('.automation-rule').first().evaluate(e=>{const s=getComputedStyle(e);return [s.paddingLeft,s.paddingTop,s.backgroundColor,s.backdropFilter]}),['23px','17px','rgba(23, 91, 59, 0.65)','blur(13px) saturate(1.4)']);
 assert.deepEqual(await page.locator('#automation-first-trigger').evaluate(e=>{const s=getComputedStyle(e);return [s.borderTopColor,s.borderRadius,s.backgroundImage.includes('svg')]}),['rgba(170, 181, 196, 0.73)','16px',true]);
 assert.equal(await page.locator('#drawer-automations').evaluate(e=>[...e.querySelectorAll('h3,p,label,button,textarea,select,input:not([type=checkbox])')].filter(n=>!n.dataset.mayaType).length),0,'All Automations text and controls have an explicit shared role');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0;});
  assert.ok(await page.locator('#drawer-automations').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Automations overflow at '+width);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{admTab('messages');msgNewToggle(true);paintLeads({connected:true,list:[{id:'fixture',name:'New Person',phone:'+14155550123',createdAt:'2026-10-07',stage:'completed',wrote:'Fixture'}]});});
 assert.equal(await page.locator('#msg-new-number').evaluate(e=>getComputedStyle(e).fontSize),'12px');
 assert.equal(await page.locator('#msg-new-number').evaluate(e=>getComputedStyle(e).paddingLeft),'19px');
 assert.equal(await page.locator('#msg-new').evaluate(e=>getComputedStyle(e).paddingLeft),'23px');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.iconColor='#123abc';d.iconOpacity=65;d.iconStroke=3;d.sectionSpacing={submissions:48,leads:32,ads:56,insights:64,headingGap:26};d.statusStyles.completed={color:'#123abc',opacity:65,weight:450};MayaTypographyControls.apply(d);});
 assert.deepEqual(await page.locator('#msg-begin svg').evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.opacity,s.strokeWidth]}),['rgb(18, 58, 188)','0.65','3px']);
 for(const [id,value] of [['submissions-heading',48],['leads-fold',32],['ads-fold',56],['bottom-fold',64]])assert.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).marginTop),value+'px',id+' saved spacing');
 assert.equal(await page.locator('#leads-fold > summary + *').evaluate(e=>getComputedStyle(e).marginTop),'26px');
 assert.equal(await page.locator('#leads-table select.lead-stage').evaluate(e=>getComputedStyle(e).fontWeight),'450','Status weight applies to live selection');
 assert.match(await page.locator('#leads-table select.lead-stage').evaluate(e=>getComputedStyle(e).color),/0.65/,'Status color strength applies to live selection');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('#msg-new').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Begin texting fits '+width);}
 await page.setViewportSize({width:1440,height:900});if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.locator('#drawer').screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT.replace('.png','-messages.png')});
 // Flush the real delayed warning before leaving Admin. It is history, not
 // a message/rule action; healthy/connected observations remain forbidden here.
 await page.waitForFunction(()=>_gisTries>40&&document.getElementById('submissions-notification-status').textContent.includes('Google sign in could not load.'));
 await page.evaluate(()=>MayaAdminNotifications.load());
 const observations=notificationWrites.flatMap(body=>body.items);
 assert.ok(observations.some(item=>item.source==='submissions'&&item.code==='unavailable'),'The blocked-GIS warning is saved during style review');
 assert.deepEqual(observations.filter(item=>['healthy','connected'].includes(item.code)),[],'Style review does not invent provider recovery');
 assert.equal(writes.length,0,'Admin style review never submits messages, rules or other owner actions');
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');await page.locator('[data-category="P3"] .type-row').waitFor();await page.waitForFunction(()=>document.getElementById('maya-surface-control-style')?.textContent.includes('#table-preview'));
 const pillHeadings=page.locator('.finish-controls>h3');
 assert.equal(await pillHeadings.count(),1,'Glass is the sole pill family');
 assert.equal(await page.locator('[data-pill-family=regular],.regular-pill-editor,.studio-control-preview').count(),0,'Retired pill and Studio previews are absent');
 await page.locator('[data-category=H3] summary').first().click();
 await page.locator('[data-category=H3] [data-field=font]').selectOption('cormorant');
 await page.locator('[data-category=H3] [data-field=size]').fill('18');
 await page.locator('[data-category=H3] [data-field=align]').selectOption('right');
 for(const heading of await pillHeadings.all()){const style=await heading.evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.textAlign];});assert.match(style[0],/Cormorant/);assert.equal(style[1],'18px');assert.equal(style[2],'right','Each pill family follows the active H3 preview');}
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#fabric-preview-request[data-maya-control=field]').count(),1,'Active Fabric preview includes the shared follow-up field');
 assert.equal(await page.locator('#fabric-preview-request').evaluate(e=>getComputedStyle(e).fontSize),'12px','Follow-up preview uses the default P1 field');
 assert.equal(await page.locator('#workspace-previews .fa-actions button').last().textContent(),'Stop','Active Fabric preview represents cancellation');
 assert.equal(await page.locator('.pill-families + .pill-states').count(),1,'Pill states sit next to the family editors');assert.equal(await page.locator('#workspace-previews .workspace-preview-card').count(),1,'Only fabric preview remains');assert.equal(await page.locator('#workspace-previews button').filter({hasText:'Edit'}).count(),0,'Typography is edited in its own section');assert.equal(await page.locator('.input-control-usage').filter({hasText:'scrollbars'}).count(),0,'One shared scrollbar needs no repeated usage list');
 for(const selector of ['.dropdown-preview-details','.checkbox-preview-details','.scrollbar-preview-details','#workspace-previews']){const preview=page.locator(selector);assert.equal(await preview.evaluate(e=>e.open),false,selector+' starts collapsed');await preview.locator(':scope > summary').click();assert.equal(await preview.evaluate(e=>e.open),true,selector+' opens');await preview.locator(':scope > summary').click();}
 const typographyPair=await page.locator('.type-hierarchy').evaluate(el=>{const a=el.querySelector('[data-category=H1]').getBoundingClientRect(),b=el.querySelector('[data-category=H2]').getBoundingClientRect();return {right:a.right,left:b.left,top:a.top,otherTop:b.top};});assert.ok(typographyPair.right<=typographyPair.left+1&&Math.abs(typographyPair.top-typographyPair.otherTop)<2,'Changed H3 settings preserve compact typography layout');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});const pair=await page.locator('.input-control-pair').evaluate(e=>{const [a,b]=[...e.children].map(n=>n.getBoundingClientRect());return {ar:a.right,ab:a.bottom,at:a.top,bl:b.left,bt:b.top};});if(width>700)assert.ok(pair.ar<=pair.bl+1&&Math.abs(pair.at-pair.bt)<2,'Dropdown and checkbox side by side '+width);else assert.ok(pair.ab<=pair.bt+1,'Dropdown and checkbox stack '+width);assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),'Aesthetic Control fits '+width);assert.equal(await page.locator('.pill-families > *').count(),1,'Single Glass family at '+width);}

 await page.setViewportSize({width:1440,height:900});await page.locator('.status-style-preview').filter({has:page.locator('[data-status="completed"]')}).locator('.type-editor > summary').click();
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.locator('#pill-colors').screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT.replace('.png','-statuses.png')});
 assert.deepEqual(errors,[]);assert.equal(writes.length,0,'Style verification must not submit messages or rules');
 console.log('Shared Automations, typography, icon/status and Begin texting authority checks passed at six widths.');
}finally{await browser.close();}

// Actual section and capsule geometry extend the shared authority check.
await import('./presentation-consistency.mjs');
await import('./pill-consistency.mjs');
console.log('Aesthetic authority passed: shared roles/materials, all Admin heading gaps, shared Glass pill geometry, active previews and saved settings across responsive pages.');

// Re-execute changed-surface fixtures even when app-regression imported them earlier.
await import('./workspace-authority.mjs?authority');
await import('./admin-automation-examples.mjs?authority');
await import('./brief-workspace-ui.mjs?authority');
// Includes retained image nodes, prepared-photo/empty-context reuse and explicit
// missing-photo retry, plus multiple reviewed results and pending visual review,
// and default/changed shared P1 copy at phone and desktop widths.
// Re-execute late-source retractions across retained cards and private garment caches.
await import('./fabric-workflow-ui.mjs?authority');
// Reexecutes worldwide/optional-shop controls, visible P1 interpretation, partial
// streamed cards and the active preview after real Save at six widths.
// Includes four component-purpose captions, retained cards, actual Save and
// default/changed shared materials and typography inline/expanded at six widths.
// Includes default/saved follow-up fields and actions at six inline/expanded widths.
// Also verifies the source-only/no-photograph P1 completion and Search details
// under defaults and saved settings, with real response rendering at six widths.
await import('./fabric-search-ui.mjs?authority');
await import('./fabric-images-ui.mjs?authority');
await import('./operation-save-failures.mjs?authority');
await import('./client-voice-ui.mjs?authority');
await import('./admin-voice-ui.mjs?authority');

await import('./input-controls-ui.mjs?authority');

await import('./operation-controls.mjs?authority');
await import('./retired-workspaces-ui.mjs?authority');
await import('./admin-systems-ui.mjs?authority');
await import('./message-compose-ui.mjs?authority');

console.log('Final Aesthetic Control authority passed: active previews, saved settings, actual Admin/Brief/Operations/fabric controls and voice surfaces across responsive widths.');

// WR shares Table aesthetics only. Recheck independent empty/error states,
// explicit WR saves and default/changed settings at six widths.
await import('./wr-ui.mjs?authority');

await import('./avatar-camera-ui.mjs?authority');

// Direct Ads reuse the existing shared Table/P1/Glass authority.
await import('./ad-reporting-ui.mjs?authority');

// Native scrollbar precedence and real gutter/Save behavior across page consumers.
await import('./scrollbar-authority-ui.mjs?authority');

// Private Admin status/history, shared heading roles and collapsed log disclosure.
await import('./admin-notifications-ui.mjs?authority');
