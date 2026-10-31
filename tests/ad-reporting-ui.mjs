import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {combineDirectAds} from '../docs/server/ad-reporting.mjs';
import {validDesign} from '../docs/server/design-config.mjs';
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];let savedDesign={},designSaves=0;
page.on('pageerror',e=>errors.push(e.message));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const row=(id,n,spend)=>({source:'chatgpt',campaignId:id,campaign:'Duplicate campaign',status:id==='paused'?'paused':id==='archived'?'archived':'active',date:day(n),spend,impressions:20,clicks:4,linkClicks:4});
const ai={connected:true,currency:'USD',today,timeZone:'America/Los_Angeles',d7:{spend:6,linkClicks:12},campaignDaily:[row('active',1,2),row('paused',3,4),row('archived',3,0),row('old',15,8)],series:[{date:day(1),spend:2,clicks:4,linkClicks:4,impressions:20,cpc:0.4}],campaigns:[{source:'chatgpt',campaignId:'zero',campaign:'Waiting campaign',status:'active'}]};
let marketing={ok:true,googleAds:{connected:false,why:'Google direct reporting is not configured.'},meta:{connected:false,why:'Meta direct reporting is not configured.'},chatgptAds:ai,adCombined:combineDirectAds({chatgpt:ai}),leads:{connected:true,d7:1,list:[]},warnings:[]};
await context.addInitScript(()=>{window.setInterval=()=>0;localStorage.setItem('maya_admin_tok','fixture');});
await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='maya-direct-ads.test')return route.abort();
 if(u.pathname==='/api/design')return route.fulfill({json:savedDesign});
 if(u.pathname==='/api/admin/design'&&route.request().method()==='POST'){assert.equal(route.request().headers().authorization,'Bearer fixture');savedDesign=route.request().postDataJSON();assert.ok(validDesign(savedDesign));designSaves++;return route.fulfill({json:{ok:true,savedAt:'2026-10-31T20:00:00Z'}});}
 if(u.pathname==='/api/admin/marketing')return route.fulfill({json:marketing});
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya-direct-ads.test/backend/status.html');await page.waitForFunction(()=>typeof loadMkt==='function'&&window.MayaTypographyControls);
 await page.evaluate(async()=>{_idTok='fixture';await loadMkt();document.getElementById('ads-fold').open=true;setAdRange('W');});
 const rows=page.locator('#campaigns-table tbody tr');assert.equal(await rows.count(),6,'Header plus four distinct IDs and zero-delivery inventory');
 assert.equal(await page.locator('#campaigns-table td').filter({hasText:/^ChatGPT$/}).count(),5);
 assert.match(await page.locator('#ads-connection-status').innerText(),/ChatGPT: direct reporting connected/);
 assert.ok(await page.locator('#ad-chart polyline').count()>0,'ChatGPT draws its actual daily series without Google/Meta');
 assert.equal(await page.locator('#campaigns-table .status-word').filter({hasText:'paused'}).count(),1);
 assert.equal(await page.locator('#campaigns-table .status-word').filter({hasText:'archived'}).count(),1,'Known inactive state cannot become delivering from old impressions');
 await page.evaluate(()=>setAdRange('D'));assert.ok(!(await page.locator('#campaigns-table').innerText()).includes('$4.00'),'Day range removes older activity');
 await page.evaluate(()=>setAdRange('M'));assert.ok((await page.locator('#campaigns-table').innerText()).includes('$8.00'),'Month restores old activity');
 await page.evaluate(()=>setAdMetric('cpc'));assert.ok(await page.locator('#ad-chart polyline').count()>0);
 const inspect=()=>page.locator('#campaigns-table').evaluate(e=>{const td=e.querySelector('td:nth-child(2)'),s=getComputedStyle(td),p=getComputedStyle(e.parentElement);return {font:s.fontFamily,size:s.fontSize,padX:s.paddingLeft,padY:s.paddingTop,background:p.backgroundColor};});
 const before=await inspect();
 const gallery=await context.newPage();await gallery.goto('https://maya-direct-ads.test/aesthetics/aesthetic-control.html');await gallery.waitForFunction(()=>window.MayaTypographyControls);
 assert.equal(await gallery.evaluate(async()=>{await MayaTypographyControls.ready;const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.table,{background:'green',fill:72,radius:19,outerWidth:3,innerWidth:2,paddingX:17,paddingY:13});Object.assign(d.table.header,{size:17,weight:450,color:'gray',background:'blue',opacity:70});d.type.P1.font='cormorant';d.type.P1.size=18;return MayaTypographyControls.save(d);}), 'Saved.');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#campaigns-table td:nth-child(2)')).paddingLeft==='17px');assert.equal(designSaves,1,'Changed Ads receives a real authenticated design Save from another page');await gallery.close();
 const after=await inspect();assert.notEqual(after.background,before.background);assert.equal(after.padX,'17px');assert.equal(after.padY,'13px');assert.match(after.font,/Cormorant/);
 const statusStyle=await page.locator('#ads-connection-status').evaluate(e=>{const s=getComputedStyle(e);return {font:s.fontFamily,size:s.fontSize};});assert.match(statusStyle.font,/Cormorant/);assert.equal(statusStyle.size,'18px');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});await page.locator('#campaigns-table').scrollIntoViewIfNeeded();assert.ok(await page.locator('#campaigns-table').evaluate(e=>e.parentElement.getBoundingClientRect().right<=innerWidth+2),'Shared scroll housing fits '+width);}
 await page.setViewportSize({width:1440,height:1000});await page.locator('#ads-fold').scrollIntoViewIfNeeded();
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT.replace('.png','-ads-changed.png')});
 savedDesign={};await page.evaluate(()=>MayaTypographyControls.apply(MayaTypographyControls.defaults));
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT.replace('.png','-ads-default.png')});
 marketing={...marketing,chatgptAds:{connected:false,why:'ChatGPT Ads direct reporting could not be loaded.'},adCombined:combineDirectAds({})};
 await page.evaluate(()=>loadMkt());assert.match(await page.locator('#ads-connection-status').innerText(),/could not be loaded/);assert.ok(!await page.locator('#ad-chart polyline').count());
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Direct Ads UI passed: ChatGPT-only data, duplicate names, current/inactive/zero states, D/W/M, missing connections and saved Table/P1 controls at six widths. Fake providers only.');
}finally{await browser.close();}
