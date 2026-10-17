// Active controls and actual served pages, fake authenticated data only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve(new URL('../',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext(),page=await context.newPage();
const errors=[],writes=[];let saved={},failSave=false;
page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{localStorage.setItem('maya_admin_tok','fixture');window.setInterval=()=>0;});
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya-authority.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/design')return route.fulfill({json:saved});
  if(u.pathname==='/api/admin/design'&&req.method()==='POST'){
   const payload=req.postDataJSON();writes.push(payload);assert.ok(validDesign(payload));
   if(failSave)return route.fulfill({status:503,json:{error:'Fixture write failure'}});
   saved=payload;return route.fulfill({json:{ok:true,savedAt:'2026-10-08T12:00:00Z'}});
  }
  if(u.pathname==='/api/admin/maya-features')return route.fulfill({json:{items:[{id:'request',who:'Owner',text:'Shared styles for requests',ts:'2026-10-08',source:'admin'}]}});
  if(u.pathname==='/api/admin/text-automations'&&req.method()==='GET')return route.fulfill({json:{ok:true,settings:{first:{enabled:true,text:'Hi {name}',trigger:'new_lead',time:'10:00'},second:{enabled:false,text:'Hi {name}',trigger:'no_reply',time:'10:00',days:3}}}});
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 const aliases={'/status.html':'/backend/status.html','/backend.html':'/backend/backend.html','/operations.html':'/backend/operations.html'};
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+decodeURIComponent(aliases[u.pathname]||u.pathname))),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const css=(selector,properties)=>page.locator(selector).first().evaluate((e,properties)=>Object.fromEntries(properties.map(k=>[k,getComputedStyle(e)[k]])),properties);
const change=async(host,key,value)=>{const input=page.locator(host+' [data-field="'+key+'"]').first();if(await input.evaluate(e=>e.tagName==='SELECT'))await input.selectOption(String(value));else await input.fill(String(value));};
try{
 await page.setViewportSize({width:1440,height:1000});await page.goto('https://maya-authority.test/aesthetics/aesthetic-control.html');
 await page.locator('#workspace-previews .workspace-preview-card').last().waitFor();
 assert.equal(await page.locator('#workspace-previews .workspace-preview-card').count(),8,'Each requested workspace has a linked shared-style inventory preview');
 await page.locator('.workspace-fabric-preview img').evaluate(image=>image.decode());
 assert.ok(await page.locator('.workspace-fabric-preview img').evaluate(image=>image.complete&&image.naturalWidth>0),'The active inventory preview loads its real fabric photograph');
 for(const link of await page.locator('#workspace-previews .workspace-preview-card>a').all())assert.match(await link.getAttribute('href'),/^\/(?:status\.html|backend\.html|$)/);
 // A preview must open the real editor and retain it until dismissed.
 await page.locator('#workspace-previews').getByRole('button',{name:'Edit P1',exact:true}).click();
 assert.equal(await page.locator('[data-category="P1"] .type-editor').getAttribute('open'),'');
 await page.keyboard.press('Escape');
 await page.locator('#workspace-previews').getByRole('button',{name:'Edit Inner panel',exact:true}).click();
 assert.equal(await page.locator('[data-editor="inner"] .type-editor').getAttribute('open'),'');
 await page.keyboard.press('Escape');
 const initial=await css('.workspace-preview-card',['paddingLeft','paddingTop','backgroundColor']);
 assert.deepEqual(initial,{paddingLeft:'16px',paddingTop:'12px',backgroundColor:'rgba(0, 0, 0, 0.18)'});
 assert.equal((await css('.workspace-timing-preview',['rowGap'])).rowGap,'10px');
 assert.equal((await css('.workspace-timing-preview label',['rowGap'])).rowGap,'4px');
 assert.equal((await css('[data-maya-semantic="non-fabric"]',['color'])).color,'rgb(253, 230, 138)');
 const edit='.layout-spacing-controls > .surface-edit-row';
 await page.locator(edit+' summary').click();
 for(const [k,v] of Object.entries({labelGap:19,fieldGap:27,drawerDockInset:0}))await change(edit,k,v);
 assert.equal((await css('.workspace-timing-preview',['rowGap'])).rowGap,'27px');
 assert.equal((await css('.workspace-timing-preview label',['rowGap'])).rowGap,'19px');
 assert.equal((await css('.workspace-dock-preview',['paddingBottom'])).paddingBottom,'0px');
 await page.keyboard.press('Escape');
 await page.locator('.semantic-style-controls summary').click();await change('.semantic-style-controls','color','#123abc');await change('.semantic-style-controls','opacity',65);
 assert.equal((await css('[data-maya-semantic="non-fabric"]',['color'])).color,'rgba(18, 58, 188, 0.65)');
 await page.keyboard.press('Escape');
 await page.locator('[data-category="P3"] summary').first().click();await change('[data-category="P3"]','color','gray');
 assert.equal((await css('[data-maya-semantic="non-fabric"]',['color'])).color,'rgba(18, 58, 188, 0.65)','Semantic shoe color survives shared caption settings');
 await page.keyboard.press('Escape');
 await page.locator('[data-editor="inner"] summary').click();
 for(const [k,v] of Object.entries({background:'green',fill:65,paddingX:23,paddingY:17,blur:13,saturation:140}))await change('[data-editor="inner"]',k,v);
 assert.deepEqual(await css('.workspace-preview-card',['paddingLeft','paddingTop','backgroundColor','backdropFilter']),{paddingLeft:'23px',paddingTop:'17px',backgroundColor:'rgba(23, 91, 59, 0.65)',backdropFilter:'blur(13px) saturate(1.4)'});
 await page.keyboard.press('Escape');
 for(const role of ['H2','H3','H4','P1','P3']){
  await page.locator('[data-category="'+role+'"] summary').first().click();
  await change('[data-category="'+role+'"]','font','cormorant');await change('[data-category="'+role+'"]','weight',500);await change('[data-category="'+role+'"]','style','italic');
  await page.keyboard.press('Escape');
 }
 for(const role of ['H2','H3','H4','P1','P3'])for(const e of await page.locator('#workspace-previews [data-maya-type="'+role+'"]').all()){
  const style=await e.evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontWeight,s.fontStyle];});const label=await e.evaluate(e=>e.outerHTML.slice(0,300));assert.match(style[0],/Cormorant/,label);assert.equal(style[1],'500',label);assert.equal(style[2],'italic',label);
 }
 const output=page.locator('.workspace-example-output'),before=await output.innerText();
 const refresh=await page.locator('#workspace-previews [aria-label="Another preview example"] svg').evaluate(svg=>{const r=svg.getBoundingClientRect(),s=getComputedStyle(svg),p=svg.querySelector('path').getBoundingClientRect();return {width:r.width,height:r.height,stroke:s.stroke,opacity:s.opacity,pathWidth:p.width,pathHeight:p.height};});
 assert.ok(refresh.width>8&&refresh.height>8&&refresh.pathWidth>4&&refresh.pathHeight>4&&refresh.stroke!=='none'&&Number(refresh.opacity)>0,'Refresh remains a visible shared SVG: '+JSON.stringify(refresh));
 await page.locator('#workspace-previews').getByRole('button',{name:'Example',exact:true}).click();assert.notEqual(await output.innerText(),before);assert.equal(writes.length,0,'Presentation examples make no model/provider calls');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),'Gallery fits '+width);
  for(const e of await page.locator('.workspace-preview-card').all())assert.ok(await e.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Inventory content fits '+width);
 }
 await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('feedback').textContent==='Saved.');
 assert.deepEqual(saved.layoutSpacing,{labelGap:19,fieldGap:27,drawerDockInset:0});assert.deepEqual(saved.semanticStyles,{nonFabric:{color:'#123abc',opacity:65}});
 await page.locator(edit+' summary').click();await change(edit,'labelGap',41);await page.keyboard.press('Escape');failSave=true;
 await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Save failed'));
 await page.locator(edit+' summary').click();await page.locator(edit+' .restore-editor').click();
 assert.equal((await css('.workspace-timing-preview label',['rowGap'])).rowGap,'19px','Failed Save cannot replace Restore baseline');
 await page.keyboard.press('Escape');
 if(process.env.MAYA_WORKSPACE_SCREENSHOT){await page.setViewportSize({width:1440,height:1100});await page.locator('#workspace-previews').screenshot({path:process.env.MAYA_WORKSPACE_SCREENSHOT+'-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#workspace-previews').screenshot({path:process.env.MAYA_WORKSPACE_SCREENSHOT+'-phone.png'});}
 await page.goto('https://maya-authority.test/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);
 await page.evaluate(async()=>{await MayaTypographyControls.ready;_idTok='fixture';await loadFeatureRequests();for(const id of ['features-fold','pe-fold','arch-fold'])document.getElementById(id).open=true;toggleDrawer(true);admTab('automations');});
 await page.locator('#automation-first-text').waitFor();
 for(const selector of ['.fr','.pe-live','.pe-panel','.arch .col','.automation-rule'])assert.deepEqual(await css(selector,['paddingLeft','paddingTop','backgroundColor']),{paddingLeft:'23px',paddingTop:'17px',backgroundColor:'rgba(23, 91, 59, 0.65)'},selector+' loads saved Inner material');
 assert.equal((await css('.automation-timing',['rowGap'])).rowGap,'27px');
 assert.equal((await css('[data-maya-field-row]',['rowGap'])).rowGap,'19px');
 assert.match((await css('#automation-first-text',['fontFamily'])).fontFamily,/Cormorant/);
 assert.deepEqual(errors,[]);assert.equal(writes.length,2,'Only two explicit design Save attempts, no messages');
 console.log('Workspace aesthetic authority: active linked previews, default/saved roles and material, semantic shoes, real label/field/dock spacing, six widths, authenticated Save propagation and failed-Save Restore passed.');
}finally{await browser.close();}
