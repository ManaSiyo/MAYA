import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=resolve('.'), browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const state={campaigns:[{id:'c',name:'9/23 Ceremonial',status:'active',pain:'Custom ceremony garments',criteria:'Local event planners'}],contacts:[{id:'p',campaignId:'c',name:'Example Person',company:'Example Studio',title:'Director',email:'example@example.com',stage:'new',verification:'unverified',source:'Sheet',notes:'Ceremony inquiry',subject:'',body:''}],companies:[],settings:{sheetId:'abcdefghijklmnopqrstuvwx'}};
await page.addInitScript(()=>localStorage.setItem('maya_admin_tok','fixture'));
await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='maya.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,state,capabilities:{sheets:true},models:{'Frontend text':'gpt-6-luna','Admin text':'gpt-6-luna','Image':'image-test'},checkedAt:new Date().toISOString()}});let p=u.pathname==='/outbound.html'?'/backend/outbound.html':u.pathname==='/status.html'?'/backend/status.html':u.pathname;try{await route.fulfill({body:readFileSync(root+p),contentType:({'.js':'text/javascript','.html':'text/html','.png':'image/png','.css':'text/css'})[extname(p)]||'text/plain'});}catch{await route.abort();}});
try{
await page.goto('https://maya.test/outbound.html');await page.getByText('Example Person',{exact:true}).waitFor();
assert.match(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage),/birth-of-a-star/);
await page.getByRole('button',{name:'Open Outbound menu'}).click();assert.ok(await page.locator('#outbound-drawer').isVisible());await page.locator('#campaign-title').click();assert.ok(await page.locator('#outbound-drawer').isHidden());
await page.getByRole('button',{name:'Open Outbound menu'}).click();await page.keyboard.press('Escape');assert.ok(await page.locator('#outbound-drawer').isHidden());
await page.getByText('Example Person',{exact:true}).click();assert.ok(await page.getByRole('button',{name:'Review in Gmail'}).isVisible());
await page.screenshot({path:join(tmpdir(),'maya-outbound-revised.png')});
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
assert.equal(report.size,'11px');assert.equal(compact.padding,'8px');assert.ok(compact.row<85);
assert.equal(await page.locator('#top-left-brand .brand-chips').count(),0);
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
assert.equal(await page.locator('#lead-tr-0 td').first().evaluate(el=>getComputedStyle(el).paddingTop),'8px');
await page.evaluate(()=>document.body.classList.remove('affiliates-view'));
await page.setViewportSize({width:1440,height:1000});

assert.deepEqual(report.options,['Not contacted','In progress','Booked','Cancelled']);assert.equal(report.size,report.noteSize);assert.equal(report.color,'rgb(181, 189, 200)');assert.equal(report.actions,1);
for(const [value,color] of [['in_progress','rgb(251, 191, 36)'],['booked','rgb(74, 222, 128)'],['canceled','rgb(253, 164, 175)']]){assert.equal(await page.locator('.lead-stage').evaluate((el,value)=>{el.value=value;return getComputedStyle(el).color;},value),color);}await page.locator('.lead-stage').evaluate(el=>el.value='new');
await page.evaluate(()=>{document.querySelector('.lead-filter').open=true;document.querySelector('.lead-filter input').click();});
assert.equal(await page.locator('#lead-tr-0').count(),0);
await page.evaluate(()=>document.querySelector('.lead-filter input').click());assert.equal(await page.locator('#lead-tr-0').count(),1);
await page.evaluate(()=>document.querySelector('.lead-filter').open=true);await page.evaluate(()=>document.body.click());assert.equal(await page.locator('.lead-filter').getAttribute('open'),null);
await page.evaluate(()=>document.querySelector('.lead-open').click());
assert.equal(await page.locator('#msg-number').textContent(),'+15555550100');
await page.evaluate(()=>document.querySelector('[onclick="msgInvoice()"]').click());
assert.ok(await page.locator('#lead-inv-modal').evaluate(e=>e.classList.contains('show')));
const admin=readFileSync(root+'/backend/status.html','utf8');const modelCode=admin.slice(admin.indexOf('async function loadModelSnapshot'),admin.indexOf('async function loadMayaLogs'));await page.evaluate(async code=>{const esc=v=>String(v).replace(/[&<>]/g,'');const _idTok='fixture';return eval(code+';loadModelSnapshot()');},modelCode);assert.equal(await page.locator('.model-group').count(),2);
console.log('Outbound drawer, fixture data rendering, Gmail handoff, CRM styles/statuses/filter dismissal and grouped models passed.');
}finally{await browser.close();}
