import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';

// Real served markup/styles, isolated fake feeds, no owner Chrome or live providers.
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],writes=[],notificationWrites=[],designWrites=[];let savedDesign={};
const notificationAdSources=new Set(['google_ads','meta_ads','chatgpt_ads']);
const notificationSources=new Set(['marketing','leads','analytics','submissions','callback_alerts','site','api','images','backup','briefing','features']);
const notificationAdCodes=new Set(['connected','not_configured','oauth_expired','project_access','account_access','scope','authorization','account_mismatch','provider_error','incomplete_report','invalid_report','invalid_metric','invalid_account','currency_excluded']);
const notificationCodes=new Set(['healthy','unavailable','needs_attention','not_configured']);
function safeNotificationBatch(body){
 assert.deepEqual(Object.keys(body).sort(),['items'],'Notification writes contain only the fixed-state batch');
 assert.ok(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=16,'Notification batch is bounded');
 const seen=new Set();
 for(const item of body.items){
  assert.deepEqual(Object.keys(item).sort(),['code','source'],'Notifications contain no text, credentials, account IDs or recipient details');
  assert.ok(notificationAdSources.has(item.source)||notificationSources.has(item.source),'Notification source is allowlisted');
  assert.ok((notificationAdSources.has(item.source)?notificationAdCodes:notificationCodes).has(item.code),'Notification code is allowlisted for its source');
  assert.ok(!seen.has(item.source),'Notification batch has one fixed state per source');seen.add(item.source);
 }
 assert.ok(JSON.stringify(body).length<=2048,'Fixed-state notification payload stays small');
}
let submissions=[];
const day=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const marketing={leads:{connected:true,list:['new','contacted','in_progress','booked','completed','canceled','closed','passed'].map((stage,i)=>({id:'style-'+i,name:stage,phone:'+141555501'+String(i).padStart(2,'0'),createdAt:'2026-10-07',stage,wrote:'Fixture'}))},adCombined:{campaignDaily:[{date:day(0),source:'google',campaign:'Current impressions',impressions:20,linkClicks:2,spend:2},{date:day(4),source:'meta',campaign:'Week impressions',impressions:30,linkClicks:3,spend:3},{date:day(15),source:'google',campaign:'Month impressions',impressions:40,linkClicks:4,spend:4},{date:day(0),source:'meta',campaign:'No impressions',impressions:0,linkClicks:0,spend:0}]}};
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;});
await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya-presentation.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/design')return route.fulfill({json:savedDesign});
  if(u.pathname==='/api/admin/design'&&req.method()==='POST'){const value=req.postDataJSON();assert.equal(req.headers().authorization,'Bearer fixture');assert.ok(validDesign(value),'The actual spacing Save uses the existing design schema');designWrites.push(value);savedDesign=structuredClone(value);return route.fulfill({json:{ok:true,savedAt:'2026-11-03T21:00:00Z'}});}
  if(u.pathname==='/api/admin/notifications'){
   assert.ok(['GET','POST'].includes(req.method()),'Notification fixture permits only authenticated reads and fixed-state observations');
   assert.equal(req.headers().authorization,'Bearer fixture');
   if(req.method()==='POST'){const body=req.postDataJSON();safeNotificationBatch(body);notificationWrites.push({path:u.pathname,method:req.method(),body});}
   return route.fulfill({json:{ok:true,items:[]}});
  }
  if(u.pathname==='/api/admin/marketing')return route.fulfill({json:marketing});
  if(u.pathname==='/api/admin/marketing-brief')return route.fulfill({json:{ok:true,headline:'Fixture summary'}});
  if(req.method()!=='GET')writes.push({path:u.pathname,method:req.method()});
  if(u.pathname==='/api/admin/submissions')return route.fulfill({json:{ok:true,total:submissions.length,folders:submissions}});
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const gap=async(heading,content)=>page.evaluate(({heading,content})=>{
 const h=document.querySelector(heading),c=document.querySelector(content);
 return {gap:c.getBoundingClientRect().top-h.getBoundingClientRect().bottom,display:getComputedStyle(c).display};
},{heading,content});
const sections=['users-fold','leads-fold','ads-fold','changes-fold','features-fold'];
const colors={new:'rgb(181, 189, 200)',contacted:'rgb(74, 222, 128)',in_progress:'rgb(134, 239, 172)',booked:'rgb(251, 191, 36)',completed:'rgb(34, 197, 94)',canceled:'rgb(248, 113, 113)'};
try{
 await page.goto('https://maya-presentation.test/backend/status.html');
 await page.waitForFunction(()=>window.MayaPresentationControls&&window.MayaTypographyControls&&typeof paintLeads==='function');
 await page.evaluate(async()=>{
  await MayaTypographyControls.ready;_idTok='fixture';
  document.querySelectorAll('[data-maya-section]').forEach(e=>e.open=true);
  _paintHeadTiles({accounts:{total:12},ranges:{today:{users:4}},wixSite:{today:{visitors:8}}});
  await loadMkt();
  setAdRange('W');
 });
 assert.equal(await page.locator('#range-chips [data-r=W]').getAttribute('aria-pressed'),'true');await page.evaluate(()=>{setAdRange('D');setAdMetric('cpc');});assert.equal(await page.locator('#range-chips [data-r=D]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#metric-chips [data-m=cpc]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#range-chips [aria-pressed=true]').count(),1);assert.equal(await page.locator('#metric-chips [aria-pressed=true]').count(),1);await page.evaluate(()=>{setAdRange('W');setAdMetric('clicks');});
 assert.equal(await page.locator('[data-maya-section]').count(),sections.length,'Every main Admin fold declares its heading/content boundary');
 const openLayout=()=>page.evaluate(()=>Object.fromEntries(['#adm-mkt','.map-footer','#changes-fold','#features-fold'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [selector,[s.marginTop,s.marginBottom,s.paddingTop]];})));const beforeClosed=await openLayout();
 const lowerFolds=['changes-fold','features-fold'];
 const closedGeometry=()=>page.evaluate(ids=>{const nodes=ids.map(id=>document.getElementById(id)),headings=nodes.map(node=>node.querySelector('summary>h2')),rects=headings.map(node=>node.getBoundingClientRect());return {gaps:rects.slice(1).map((rect,i)=>rect.top-rects[i].bottom),fonts:headings.map(node=>{const s=getComputedStyle(node);return [node.dataset.mayaType,s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.textTransform];})};},lowerFolds);
 await page.evaluate(ids=>ids.forEach(id=>document.getElementById(id).open=false),lowerFolds);
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  for(const spacing of [16,0,30,64]){
   await page.evaluate(spacing=>{const d=structuredClone(MayaTypographyControls.defaults);d.sectionSpacing.insights=spacing;if(spacing===30)Object.assign(d.type.H3,{font:'jost',size:14,weight:350,case:'uppercase',align:'center',vertical:'middle'});if(spacing===64)Object.assign(d.type.H3,{font:'cormorant',size:22,weight:500,style:'italic',case:'uppercase'});MayaTypographyControls.apply(d);},spacing);
   const measured=await closedGeometry();
   for(const font of measured.fonts)assert.deepEqual(font,measured.fonts[0],'Feature requests and other closed headings share H3 at '+width);
   for(const actual of measured.gaps)assert.ok(Math.abs(actual-spacing)<1,'Closed changes / requests share the saved Insights gap at '+width+': '+JSON.stringify(measured.gaps)+', expected '+spacing);
   if([390,1440].includes(width)&&[16,30].includes(spacing)){await page.locator('#changes-fold').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/maya-admin-closed-'+(spacing===16?'default':'saved')+'-'+width+'.png'});}
  }
 }
 await page.evaluate(()=>{document.querySelectorAll('[data-maya-section]').forEach(e=>e.open=true);MayaTypographyControls.apply(structuredClone(MayaTypographyControls.defaults));});assert.deepEqual(await openLayout(),beforeClosed,'Distinct open-section margins and footer placement remain unchanged');

 // Test visible geometry, not only the margin property. An old heading margin or
 // a hidden feed sibling must not swallow or add to the saved distance.
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const headingGap of [0,27,64]){
   await page.evaluate(headingGap=>{const d=structuredClone(MayaTypographyControls.defaults);d.sectionSpacing.headingGap=headingGap;MayaTypographyControls.apply(d);},headingGap);
   for(const id of sections){
    const measured=await gap('#'+id+'>summary>h2','#'+id+'>[data-maya-section-content]');
    assert.notEqual(measured.display,'none',id+' visible content');
    assert.ok(Math.abs(measured.gap-headingGap)<1,`${id} heading/content at ${width}px: ${measured.gap}, expected ${headingGap}`);
   }
   const measured=await gap('#submissions-heading','#subs-note-inline');
   assert.ok(Math.abs(measured.gap-headingGap)<1,`Submissions empty state at ${width}px: ${measured.gap}, expected ${headingGap}`);
  }
 }
 // Populate the real submissions painter and measure its alternate first content.
 submissions=[{id:'submission-1',name:'Sample design',createdTime:new Date().toISOString(),webViewLink:'https://maya-presentation.test/sample',thumbnailLink:''}];
 await page.evaluate(()=>loadSubmissions());
 assert.equal(await page.locator('#subs-note-inline').isVisible(),false);
 assert.equal(await page.locator('#subs-strip').isVisible(),true);
 assert.ok(Math.abs((await gap('#submissions-heading','#subs-strip')).gap-64)<1,'Populated submissions obey the same heading gap');
 // D/W/M still filters campaigns while redundant long range copy stays hidden.
 for(const [range,count] of [['D',2],['W',3],['M',4]]){
  await page.locator('#range-chips [data-r="'+range+'"]').click();
  assert.equal(await page.locator('#campaigns-table .status-word').count(),count,range+' campaigns');
  assert.equal(await page.locator('#range-chips .on').getAttribute('data-r'),range);
  assert.equal(await page.locator('#range-word').isVisible(),false,'No redundant visible date range');
 }
 for(const [stage,color] of Object.entries(colors)){
  const pill=page.locator('.lead-status').filter({has:page.locator('option[value="'+stage+'"]:checked')});
  assert.equal(await pill.locator('.status-text').evaluate(e=>getComputedStyle(e).color),color,stage+' visible label');
  assert.equal(await pill.locator('select').evaluate(e=>getComputedStyle(e).color),color,stage+' accessible selection');
 }
 for(const [stage,color] of [['closed',colors.completed],['passed',colors.canceled]]){
  assert.equal(await page.locator('.lead-status').filter({has:page.locator('option[value="'+stage+'"]:checked')}).locator('.status-text').evaluate(e=>getComputedStyle(e).color),color,stage+' retained legacy status');
 }
 await page.locator('#leads-table select.lead-stage').first().press('Enter');
 for(const [stage,color] of Object.entries(colors))assert.equal(await page.locator('#lead-stage-options [data-status="'+stage+'"]').evaluate(e=>getComputedStyle(e).color),color,stage+' actual status menu');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#campaigns-table [data-status="delivering"]').first().evaluate(e=>getComputedStyle(e).color),colors.completed);
 assert.match(await page.locator('#campaigns-table [data-status="delivering"]').first().getAttribute('title'),/does not confirm.*enabled now/);
 assert.equal(await page.locator('#campaigns-table [data-status="new"]').evaluate(e=>getComputedStyle(e).color),colors.new);
 // Older saves keep the owner's explicit colors; missing new keys get defaults.
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.statusStyles={booked:{color:'#123abc',opacity:65,weight:450},in_progress:{color:'#f9a8d4',opacity:100,weight:300},delivering:{color:'#abcdef',opacity:80,weight:450}};MayaTypographyControls.apply(d);});
 assert.deepEqual(await page.locator('.lead-status').filter({has:page.locator('option[value="booked"]:checked')}).locator('.status-text').evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.fontWeight];}),['rgba(18, 58, 188, 0.65)','450']);
 assert.equal(await page.locator('.lead-status').filter({has:page.locator('option[value="in_progress"]:checked')}).locator('.status-text').evaluate(e=>getComputedStyle(e).color),'rgb(249, 168, 212)');
 assert.deepEqual(await page.locator('#campaigns-table [data-status="delivering"]').first().evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.fontWeight];}),['rgba(171, 205, 239, 0.8)','450']);
 await page.goto('https://maya-presentation.test/aesthetics/aesthetic-control.html');
 await page.locator('.type-group .type-row').first().waitFor();
 assert.equal(await page.locator('#pill-colors .status-style-preview').count(),9);
 assert.equal(await page.locator('#pill-colors .status-style-preview').filter({has:page.locator('.status-usage a')}).count(),8,'Active semantic statuses name their page usage');
 assert.match(await page.locator('.status-style-preview').filter({has:page.locator('[data-status="delivering"]')}).innerText(),/Impressions recorded.*D\/W\/M.*does not confirm/s);
 const spacing=page.locator('.spacing-controls');
 await spacing.locator('.type-editor > summary').click();
 await spacing.locator('[data-field="headingGap"]').fill('37');await spacing.locator('[data-field="insights"]').fill('30');
 await page.keyboard.press('Escape'); // Close the actual editor before opening its usage preview.
 await spacing.locator('details.input-control-usage > summary').click();
 assert.equal(await spacing.locator('[data-heading-gap]').count(),6,'Every Admin group has a spacing preview');
 const lowerPreview=spacing.locator('[data-preview-fold]');assert.equal(await lowerPreview.count(),2,'The existing spacing preview includes the two remaining closed lower sections');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  const previewGaps=await lowerPreview.evaluateAll(folds=>folds.slice(1).map((fold,i)=>fold.getBoundingClientRect().top-folds[i].getBoundingClientRect().bottom));for(const actual of previewGaps)assert.ok(Math.abs(actual-30)<1,'Closed preview uses the same Insights spacing at '+width);
  if([390,1440].includes(width))await spacing.locator('.spacing-preview').screenshot({path:'/private/tmp/maya-admin-closed-preview-'+width+'.png'});
 }
 await lowerPreview.evaluateAll(folds=>folds.forEach(fold=>fold.open=true));
 for(const sample of await spacing.locator('[data-heading-gap]').all())assert.ok(Math.abs(await sample.evaluate(e=>e.getBoundingClientRect().top-e.previousElementSibling.getBoundingClientRect().bottom)-37)<1,'Preview visibly applies heading distance');
 for(const [key,color] of [['delivering','#13579b'],['pending','#2468ac'],['rejected','#97531b']]){
  const group=page.locator('.status-style-preview').filter({has:page.locator('[data-status="'+key+'"]')});
  await group.locator('.type-editor > summary').click();
  await group.locator('[data-field="color"]').fill(color);
  const expected=await page.evaluate(color=>{const e=document.createElement('span');e.style.color=color;document.body.append(e);const value=getComputedStyle(e).color;e.remove();return value;},color);
  assert.equal(await group.locator('.status-pill').evaluate(e=>getComputedStyle(e).color),expected,key+' editor updates actual preview');
  await group.locator('.restore-editor').click();
  assert.equal(await group.locator('.status-pill').evaluate(e=>getComputedStyle(e).color),({delivering:colors.completed,pending:colors.booked,rejected:colors.canceled})[key],key+' restore returns saved preview');
 }
 await page.evaluate(()=>localStorage.setItem('maya_admin_tok','fixture'));await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('feedback').textContent==='Saved.');
 assert.equal(designWrites.length,1,'One explicit design Save');assert.equal(savedDesign.sectionSpacing.insights,30);assert.equal(savedDesign.sectionSpacing.headingGap,37);
 await page.evaluate(()=>localStorage.removeItem('maya-typography-controls-v1'));
 await page.goto('https://maya-presentation.test/backend/status.html');await page.waitForFunction(()=>window.MayaTypographyControls&&typeof paintLeads==='function');await page.evaluate(async ids=>{await MayaTypographyControls.ready;ids.forEach(id=>document.getElementById(id).open=false);},lowerFolds);
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const measured=await closedGeometry();for(const actual of measured.gaps)assert.ok(Math.abs(actual-30)<1,'The real saved Insights gap reloads on Admin at '+width);for(const font of measured.fonts)assert.deepEqual(font,measured.fonts[0],'Reloaded Feature requests keeps the same H3 font at '+width);}
 assert.equal(notificationWrites.length,0,'Retired notification history performs no writes');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Presentation verification must not perform account mutations');
 console.log('Presentation consistency passed: saved/reloaded uniform closed lower sections, all six H3 heading/content boundaries, empty/populated submissions, D/W/M, current and retained status colors, saved overrides and functional gallery previews.');
}finally{await browser.close();}
