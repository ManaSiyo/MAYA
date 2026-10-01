import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
export async function auditOutboundPriority(browser){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),root=resolve('.'),errors=[];let sends=0,syncs=0;
 const person=(id,sheetStatus,lastEmail,relevance,stage='contacted')=>({id,campaignId:'c',campaignIds:['c'],name:id,company:'Example Studio',category:'Corporate',email:id+'@example.com',title:'Director',subject:'Source subject',body:'',notes:'',sheetStatus,lastEmail,relevance,stage,verification:'unverified',sheetData:{subject:'Original Sheet subject',syncedAt:'2026-09-28T19:00:00Z'}});
 const state={contacts:[person('Recent','2nd touch, sent','09/27','75'),person('New-low','Never contacted','','55','new'),person('Old','1st touch, no reply','06/03','80'),person('New-high','Never contacted','','92','new'),person('Reply','Replied, active','09/26','85','replied'),person('Stop','Do not contact','09/23','90','suppressed'),{...person('Paused','2nd touch, sent; OOO','09/23','84'),sheetPaused:true}],campaigns:[{id:'c',name:'9/23 Corporates',status:'active'}],companies:[],settings:{sheetId:'abcdefghijklmnopqrstuvwx',lastSyncedAt:'2026-09-28T19:00:00Z'}};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('maya_admin_tok','fixture'));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());
  if(process.env.MAYA_FONT_DIR&&u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:[400,500,600].map(w=>`@font-face{font-family:'Jost';font-style:normal;font-weight:${w};src:url('https://maya.test/__fonts/Jost-normal-${w}.ttf')}`).join('\n')});
  if(u.hostname!=='maya.test')return route.abort();
  if(u.pathname.startsWith('/__fonts/'))return route.fulfill({body:readFileSync(join(process.env.MAYA_FONT_DIR,u.pathname.split('/').pop())),contentType:'font/ttf'});
  if(u.pathname.endsWith('/sheets/sync'))syncs++;
  if(u.pathname.endsWith('/send'))sends++;
  if(u.pathname.endsWith('/save')){const b=route.request().postDataJSON();if(b.type==='campaign')state.campaigns.push({id:'created',name:b.name,status:'active'});}
  if(u.pathname.endsWith('/intelligence'))return route.fulfill({json:{ok:true,crm:{},mailboxes:[]}});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,state,result:[{tab:'Funnel',read:7,total:7,added:0}],capabilities:{sheets:true}}});
  const file=u.pathname==='/outbound.html'?'/backend/outbound.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+file),contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[extname(file)]||'text/plain'});}catch{return route.abort();}
 });
 try{
  await page.goto('https://maya.test/outbound.html');await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Funnel:'));
  assert.equal(syncs,1,'Every opening refreshes the connected Sheet');
  const headerText=()=>page.locator('.people-table th').allTextContents().then(xs=>xs.map(x=>x.replace('⌄','').trim()));
  assert.deepEqual((await headerText()).slice(2,11),['Category','Company','Full Name','Email','Job Title','Subject','Last email','Status','Relevance']);
  assert.equal(await page.locator('#todo-list').count(),0);
  assert.equal(await page.locator('#master-list').innerText(),'All');
  assert.equal(await page.locator('#followups').evaluate(e=>!!e.closest('.layout>aside')),true);
  await page.locator('.history-segment.f1').focus();assert.match(await page.locator('.history-detail').innerText(),/%/);
  await page.locator('[data-column="8"]').click();await page.locator('#column-order').selectOption('desc');await page.locator('#modal-submit').click();
  assert.equal(await page.locator('.people-table tbody tr').first().getAttribute('data-contact-row'),'New-high');
  await page.locator('[data-column="4"]').click();await page.locator('#column-text').fill('director');await page.locator('#modal-submit').click();assert.equal(await page.locator('.people-table tbody tr').count(),7);
  await page.locator('[data-column="2"]').click();await page.locator('#column-text').fill('New-');await page.locator('#modal-submit').click();assert.equal(await page.locator('.people-table tbody tr').count(),2,'Column filters combine');
  await page.locator('#clear-columns').click();assert.equal(await page.locator('.people-table tbody tr').count(),7);
  await page.locator('[data-campaign="c"]').click();assert.deepEqual((await headerText()).slice(2,11),['Category','Company','Full Name','Email','Job Title','Subject','Last email','Status','Relevance']);
  await page.locator('#master-list').click();
  for(const width of [320,390,650,768,1024,1440,1920]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Document fits '+width);
   assert.equal(await page.locator('#master-list').evaluate(e=>getComputedStyle(e).textAlign),'center');assert.equal(await page.locator('#master-list').evaluate(e=>getComputedStyle(e).borderRadius),'100px');
   const plus=await page.locator('#new-campaign').boundingBox();assert.equal(plus.width,plus.height,'Circular campaign control');
   const style=await page.locator('.people-table .person-link').first().evaluate(e=>{const s=getComputedStyle(e);return {border:s.borderTopWidth,shadow:s.boxShadow,radius:s.borderRadius,font:s.fontSize};});assert.equal(style.border,'0px');assert.equal(style.shadow,'none');assert.equal(style.radius,'0px');assert.equal(style.font,'12px');
   assert.equal((await page.locator('.people-table tbody tr').first().boundingBox()).height,44,'44px rows '+width);
   const pills=await page.locator('#stats .stat').evaluateAll(items=>items.map(el=>({width:el.getBoundingClientRect().width,grow:getComputedStyle(el).flexGrow})));assert.ok(pills.every(p=>p.width<180&&p.grow==='0'),'Metrics stay content width');
   assert.equal(await page.locator('.people-table th').first().evaluate(e=>getComputedStyle(e).textAlign),'left');

   await page.locator('.people-scroll').evaluate(e=>e.scrollLeft=e.scrollWidth);await page.locator('[data-write="Recent"]').click();assert.equal(await page.locator('#detail h2').textContent(),'Recent');await page.locator('#master-list').click();
   if([390,1440].includes(width))await page.screenshot({path:'/private/tmp/maya-outbound-todo-'+width+'.png',fullPage:true});
  }
  await page.locator('#new-campaign').click();await page.locator('#field-name').fill('New segment');await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(state.campaigns.at(-1).name,'New segment');
  assert.deepEqual(errors,[]);assert.equal(sends,0);
  console.log('Column filters and sorting, stable source columns, sidebar email history, draft action, compact styling and seven widths passed.');
 }finally{await page.close();}
}
