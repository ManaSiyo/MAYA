import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/admin/text-automations'&&req.method()==='GET')return route.fulfill({json:{ok:true,settings:{first:{enabled:true,text:'Hi {name}',trigger:'new_lead',time:'10:00'},second:{enabled:false,text:'Hi {name}',trigger:'no_reply',time:'10:00',days:3}}}});
  if(req.method()==='POST'){writes.push({path:u.pathname,body:req.postDataJSON(),auth:req.headers().authorization});return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);
 await page.evaluate(()=>{_idTok='fixture';toggleDrawer(true);admTab('automations');});await page.locator('#automation-first-text').waitFor({state:'visible'});
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
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');await page.locator('[data-category="P3"] .type-row').waitFor();await page.waitForFunction(()=>document.getElementById('maya-surface-control-style')?.textContent.includes('#table-preview'));
 const pillHeadings=page.locator('.finish-controls>h3,[data-pill-family=regular]>h3');
 assert.equal(await pillHeadings.count(),2);
 await page.locator('[data-category=H3] summary').first().click();
 await page.locator('[data-category=H3] [data-field=font]').selectOption('cormorant');
 await page.locator('[data-category=H3] [data-field=size]').fill('18');
 await page.locator('[data-category=H3] [data-field=align]').selectOption('right');
 for(const heading of await pillHeadings.all()){const style=await heading.evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.textAlign];});assert.match(style[0],/Cormorant/);assert.equal(style[1],'18px');assert.equal(style[2],'right','Each pill family follows the active H3 preview');}
 await page.keyboard.press('Escape');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),'Aesthetic Control fits '+width);}

 await page.setViewportSize({width:1440,height:900});await page.locator('.status-style-preview').filter({has:page.locator('[data-status="completed"]')}).locator('summary').click();
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.locator('#pill-colors').screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT.replace('.png','-statuses.png')});
 assert.deepEqual(errors,[]);assert.equal(writes.length,0,'Style verification must not submit messages or rules');
 console.log('Shared Automations, typography, icon/status and Begin texting authority checks passed at six widths.');
}finally{await browser.close();}

// Actual section and capsule geometry extend the shared authority check.
await import('./presentation-consistency.mjs');
await import('./pill-consistency.mjs');
console.log('Aesthetic authority passed: shared roles/materials, all Admin heading gaps, real Glass/Regular pill geometry, active previews and saved settings across responsive pages.');
