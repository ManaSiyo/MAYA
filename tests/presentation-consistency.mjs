import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

// Real served markup/styles, isolated fake feeds, no owner Chrome or live providers.
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],writes=[];
let submissions=[];
const day=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const marketing={leads:{connected:true,list:['new','contacted','in_progress','booked','completed','canceled','closed','passed'].map((stage,i)=>({id:'style-'+i,name:stage,phone:'+141555501'+String(i).padStart(2,'0'),createdAt:'2026-10-07',stage,wrote:'Fixture'}))},adCombined:{campaignDaily:[{date:day(0),source:'google',campaign:'Current impressions',impressions:20,linkClicks:2,spend:2},{date:day(4),source:'meta',campaign:'Week impressions',impressions:30,linkClicks:3,spend:3},{date:day(15),source:'google',campaign:'Month impressions',impressions:40,linkClicks:4,spend:4},{date:day(0),source:'meta',campaign:'No impressions',impressions:0,linkClicks:0,spend:0}]}};
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;});
await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
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
const sections=['users-fold','leads-fold','ads-fold','bottom-fold','changes-fold','features-fold','pe-fold','arch-fold'];
const colors={new:'rgb(181, 189, 200)',contacted:'rgb(74, 222, 128)',in_progress:'rgb(134, 239, 172)',booked:'rgb(251, 191, 36)',completed:'rgb(34, 197, 94)',canceled:'rgb(248, 113, 113)'};
try{
 await page.goto('https://maya.test/backend/status.html');
 await page.waitForFunction(()=>window.MayaPresentationControls&&window.MayaTypographyControls&&typeof paintLeads==='function');
 await page.evaluate(async()=>{
  await MayaTypographyControls.ready;_idTok='fixture';
  document.querySelectorAll('[data-maya-section]').forEach(e=>e.open=true);
  _paintHeadTiles({accounts:{total:12},ranges:{today:{users:4}},wixSite:{today:{visitors:8}}});
  await loadMkt();
  setAdRange('W');
 });
 assert.equal(await page.locator('[data-maya-section]').count(),sections.length,'Every main Admin fold declares its heading/content boundary');
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
 submissions=[{id:'submission-1',name:'Sample design',createdTime:new Date().toISOString(),webViewLink:'https://maya.test/sample',thumbnailLink:''}];
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
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');
 await page.locator('.type-group .type-row').first().waitFor();
 assert.equal(await page.locator('#pill-colors .status-style-preview').count(),9);
 assert.equal(await page.locator('#pill-colors .status-style-preview').filter({has:page.locator('.status-usage a')}).count(),9,'Every semantic status names its actual page usage');
 assert.match(await page.locator('.status-style-preview').filter({has:page.locator('[data-status="delivering"]')}).innerText(),/Impressions recorded.*D\/W\/M.*does not confirm/s);
 const spacing=page.locator('.spacing-controls');
 await spacing.locator('summary').click();
 await spacing.locator('[data-field="headingGap"]').fill('37');
 assert.equal(await spacing.locator('[data-heading-gap]').count(),9,'Every Admin group has a spacing preview');
 for(const sample of await spacing.locator('[data-heading-gap]').all())assert.ok(Math.abs(await sample.evaluate(e=>e.getBoundingClientRect().top-e.previousElementSibling.getBoundingClientRect().bottom)-37)<1,'Preview visibly applies heading distance');
 for(const [key,color] of [['delivering','#13579b'],['pending','#2468ac'],['rejected','#97531b']]){
  const group=page.locator('.status-style-preview').filter({has:page.locator('[data-status="'+key+'"]')});
  await group.locator('summary').click();
  await group.locator('[data-field="color"]').fill(color);
  const expected=await page.evaluate(color=>{const e=document.createElement('span');e.style.color=color;document.body.append(e);const value=getComputedStyle(e).color;e.remove();return value;},color);
  assert.equal(await group.locator('.status-pill').evaluate(e=>getComputedStyle(e).color),expected,key+' editor updates actual preview');
  await group.locator('.restore-editor').click();
  assert.equal(await group.locator('.status-pill').evaluate(e=>getComputedStyle(e).color),({delivering:colors.completed,pending:colors.booked,rejected:colors.canceled})[key],key+' restore returns saved preview');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Presentation verification must not perform account mutations');
 console.log('Presentation consistency passed: all nine Admin heading/content boundaries, empty/populated submissions, D/W/M, current and retained status colors, saved overrides and functional gallery previews.');
}finally{await browser.close();}
