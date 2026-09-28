import {auditOutboundPriority} from './outbound-priority-ui.mjs';
import {chromium} from 'playwright';
import {auditLeadFilter} from './lead-filter-ui.mjs';
import {readFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=resolve('.'), browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
let syncCount=0;
const state={campaigns:[{id:'c',name:'9/23 Ceremonial',status:'active',pain:'Custom ceremony garments',criteria:'Local event planners'}],contacts:[{id:'p',campaignId:'c',name:'Example Person',company:'Example Studio',title:'Director',email:'example@example.com',stage:'new',verification:'unverified',source:'Sheet',notes:'Ceremony inquiry',subject:'',body:''}],companies:[],settings:{sheetId:'abcdefghijklmnopqrstuvwx'}};
await page.addInitScript(()=>localStorage.setItem('maya_admin_tok','fixture'));
await page.route('**/*',async route=>{const u=new URL(route.request().url());
if(process.env.MAYA_FONT_DIR && u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:['Jost','CormorantGaramond'].flatMap(family=>[400,500,600].map(weight=>`@font-face{font-family:'${family==='Jost'?'Jost':'Cormorant Garamond'}';font-style:normal;font-weight:${weight};src:url('https://maya.test/__fonts/${family}-normal-${weight}.ttf')}`)).join('\n')});
if(u.pathname.startsWith('/__fonts/') && process.env.MAYA_FONT_DIR)return route.fulfill({body:readFileSync(join(process.env.MAYA_FONT_DIR,u.pathname.split('/').pop())),contentType:'font/ttf'});
if(u.hostname!=='maya.test')return route.abort();if(u.pathname.endsWith('/sheets/sync'))syncCount++;if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,result:[{tab:'9/23 Ceremonial',total:1,added:0}],state,capabilities:{sheets:true},models:{'Frontend text':'gpt-6-luna','Admin text':'gpt-6-luna','Image':'image-test'},checkedAt:new Date().toISOString()}});let p=u.pathname==='/outbound.html'?'/backend/outbound.html':u.pathname==='/status.html'?'/backend/status.html':u.pathname;try{await route.fulfill({body:readFileSync(root+p),contentType:({'.js':'text/javascript','.html':'text/html','.png':'image/png','.css':'text/css'})[extname(p)]||'text/plain'});}catch{await route.abort();}});
try{
await auditOutboundPriority(browser);
await page.goto('https://maya.test/outbound.html');await page.locator('.people-table [data-person="p"]').waitFor();
assert.match(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage),/birth-of-a-star/);
await page.getByRole('button',{name:'Open Outbound menu'}).click();assert.ok(await page.locator('#outbound-drawer').isVisible());await page.locator('#campaign-title').click();assert.ok(await page.locator('#outbound-drawer').isHidden());
await page.getByRole('button',{name:'Open Outbound menu'}).click();await page.keyboard.press('Escape');assert.ok(await page.locator('#outbound-drawer').isHidden());
await page.locator('.people-table [data-person="p"]').click();assert.ok(await page.getByRole('button',{name:'Open in Gmail'}).isVisible());
await page.screenshot({path:join(tmpdir(),'maya-outbound-revised.png')});
for(const width of [320,390,650,768,1024,1440,1920]){
 await page.setViewportSize({width,height:844});
 const bounds=await page.evaluate(()=>{const header=document.querySelector('header').getBoundingClientRect(),brand=document.querySelector('.brand').getBoundingClientRect(),menu=document.querySelector('#menu-toggle').getBoundingClientRect(),notice=document.querySelector('#notice').getBoundingClientRect();return {fits:brand.right<=menu.left&&menu.bottom<=header.bottom&&header.bottom<=notice.top+1,overflow:document.documentElement.scrollWidth>innerWidth+1};});
 assert.ok(bounds.fits,'Outbound header at '+width);assert.equal(bounds.overflow,false,'Outbound document overflow at '+width);
 await page.locator('#menu-toggle').click();await page.locator('#drawer-help-tab').click();assert.ok(await page.locator('#drawer-help').isVisible());
 await page.locator('#drawer-workspace-tab').click();assert.ok(await page.locator('#sync-drawer').isVisible());
 const drawer=await page.locator('#outbound-drawer').boundingBox();assert.ok(drawer.x>=0&&drawer.x+drawer.width<=width+1);
 await page.keyboard.press('Escape');assert.ok(await page.locator('#menu-toggle').evaluate(e=>e===document.activeElement));
}
await page.locator('#menu-toggle').click();await page.locator('#sync-drawer').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('prospects ('));assert.equal(syncCount,2);await page.keyboard.press('Escape');
await page.setViewportSize({width:1440,height:1000});
await page.goto('https://maya.test/status.html');
await page.evaluate(()=>{document.querySelectorAll('#gate,#auth-gate').forEach(e=>e.remove());document.querySelector('#adm-mkt').style.display='block';paintLeads({connected:true,list:[{id:'fixture',name:'Example Person',phone:'+15555550100',tier:'Signature',wrote:'A custom suit for a ceremony',createdAt:'2026-09-23',stage:'new'}]});});
const report=await page.evaluate(()=>{const sel=document.querySelector('.lead-stage'),note=document.querySelector('.lead-note-vp');return {options:[...sel.options].map(x=>x.text),size:getComputedStyle(sel).fontSize,noteSize:getComputedStyle(note).fontSize,color:getComputedStyle(sel).color,actions:document.querySelectorAll('.lead-subline button').length};});
await page.evaluate(()=>{const table=document.querySelector('#campaigns-table');if(!table.querySelector('th'))table.createTHead().innerHTML='<tr><th>Status</th><th>Campaign</th></tr>';});
const compact = await page.evaluate(()=>({
  row:document.querySelector('#lead-tr-0').getBoundingClientRect().height,
  padding:getComputedStyle(document.querySelector('#lead-tr-0 td')).paddingTop,
  tierInteractive:!!document.querySelector('.lead-src [contenteditable],.lead-src button,.lead-src a'),
  tier:document.querySelector('.lead-src').textContent,
  ticker:getComputedStyle(document.querySelector('#mkt-ticker-inner')).fontSize,
  header:getComputedStyle(document.querySelector('#campaigns-table th')).backgroundColor
}));
assert.equal(report.size,'11px');assert.equal(compact.padding,'4px');assert.equal(compact.row,44);
assert.equal(await page.locator('#top-left-brand .brand-chips').count(),0);
assert.equal(await page.locator('#top-left-brand .maya-logo-mark').getAttribute('src'),'/aesthetics/ui/logo-circle.png');
assert.equal(await page.locator('.maya-logo-wrap').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
assert.equal(await page.locator('.top-btn.hamburger').evaluate(e=>getComputedStyle(e).boxShadow),'none');
assert.match(await page.locator('.grid.doors .card b').first().evaluate(e=>getComputedStyle(e).fontFamily),/Cormorant/);
assert.equal(compact.tierInteractive,false);assert.equal(compact.tier,'Signature');
assert.equal(compact.ticker,'10px');assert.equal(compact.header,'rgba(0, 0, 0, 0)');
await page.evaluate(()=>document.querySelector('#leads-fold').scrollIntoView());
await page.screenshot({path:join(tmpdir(),'maya-admin-compact.png')});
await page.setViewportSize({width:390,height:844});
assert.equal(await page.locator('.lead-stage').evaluate(el=>getComputedStyle(el).fontSize),'11px');
await page.evaluate(()=>document.body.classList.add('affiliates-view'));
assert.equal(await page.locator('#lead-tr-0 td').first().evaluate(el=>getComputedStyle(el).paddingTop),'4px');
await page.evaluate(()=>document.body.classList.remove('affiliates-view'));
await page.setViewportSize({width:1440,height:1000});

assert.deepEqual(report.options,['Not contacted','Contacted','In progress','Booked','Cancelled']);assert.equal(report.size,report.noteSize);assert.equal(report.color,'rgb(181, 189, 200)');assert.equal(report.actions,1);
for(const [value,color] of [['contacted','rgb(138, 188, 242)'],['in_progress','rgb(251, 191, 36)'],['booked','rgb(74, 222, 128)'],['canceled','rgb(253, 164, 175)']]){assert.equal(await page.locator('.lead-stage').evaluate((el,value)=>{el.value=value;return getComputedStyle(el).color;},value),color);}await page.locator('.lead-stage').evaluate(el=>el.value='new');
await page.evaluate(()=>document.fonts.ready);
let statusUpdate;
await page.route('**/api/admin/lead-update',route=>{statusUpdate=route.request().postDataJSON();return route.fulfill({json:{ok:true}});});
await page.evaluate(async()=>{
 const original=loadMkt;loadMkt=async()=>paintLeads({connected:true,list:_leadList});
 try{const select=document.querySelector('.lead-stage');select.value='contacted';await setLeadStage(0,select);}finally{loadMkt=original;}
});
assert.equal(statusUpdate.stage,'contacted');assert.equal(await page.locator('.lead-stage').inputValue(),'contacted');
assert.equal(await page.locator('.status-text').textContent(),'Contacted','Saved status survives repaint');
await page.locator('.lead-stage').focus();
assert.notEqual(await page.locator('.lead-status').evaluate(e=>getComputedStyle(e).outlineStyle),'none','Native status control retains visible keyboard focus');
await page.unroute('**/api/admin/lead-update');
await auditLeadFilter(page);
await page.evaluate(()=>paintLeads({connected:true,list:[{id:'fixture',name:'Example Person',phone:'+15555550100',tier:'Signature',wrote:'A custom suit for a ceremony',createdAt:'2026-09-23',stage:'new'}]}));
await page.evaluate(()=>admTab('messages'));assert.ok(await page.locator('#drawer maya-ai-meter').isHidden(),'Systems meter stays out of Messages');
await page.evaluate(()=>admTab('logs'));assert.ok(await page.locator('#drawer maya-ai-meter').isHidden(),'Systems meter stays out of Logs');
await page.evaluate(()=>admTab('systems'));assert.equal(await page.locator('#drawer .ai-meter h3').evaluate(el=>getComputedStyle(el).fontSize),'11px');
assert.equal(await page.evaluate(()=>{const original=window.loadModelSnapshot;let calls=0;window.loadModelSnapshot=()=>calls++;toggleDrawer(true);window.loadModelSnapshot=original;return calls;}),1,'Systems loads on first drawer open');
await page.evaluate(()=>document.querySelector('.lead-open').click());
await page.waitForFunction(()=>document.querySelector('#msg-number').textContent==='+15555550100');
await page.evaluate(()=>document.querySelector('[onclick="msgInvoice()"]').click());
assert.ok(await page.locator('#lead-inv-modal').evaluate(e=>e.classList.contains('show')));
const admin=readFileSync(root+'/backend/status.html','utf8');const modelCode='let _modelsLoading=false,_modelsAuth=null,_modelsChecked=0;'+admin.slice(admin.indexOf('async function loadModelSnapshot'),admin.indexOf('async function loadMayaLogs'));await page.evaluate(async code=>{const esc=v=>String(v).replace(/[&<>]/g,'');const _idTok='fixture';return eval(code+';loadModelSnapshot()');},modelCode);assert.equal(await page.locator('.model-group').count(),2);
assert.equal(await page.locator('.model-group strong').first().evaluate(e=>getComputedStyle(e).fontSize),'12px');
assert.deepEqual(pageErrors,[],'No uncaught UI errors');
console.log('Outbound drawer, fixture data rendering, Gmail handoff, CRM styles/statuses/filter dismissal and grouped models passed.');
}finally{await browser.close();}
