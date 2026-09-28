// Fault injection only: no connected mailboxes, real sends or production data.
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.'),browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
try {
 const page=await browser.newPage({viewport:{width:390,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let pendingSave,pendingLoad,pauseLoad=false,crmStamp='',expire=false,meterFail=false,meterCalls=0;
 let loadStarted;const waitingLoad=new Promise(resolve=>{loadStarted=resolve;});
 const stateFor=owner=>({campaigns:[{id:'c',name:owner+' campaign',status:'active'}],contacts:[{id:'p',campaignId:'c',name:owner+' person',notes:'',subject:'',body:'',stage:'new',email:'person@example.com'}],companies:[],settings:{}});
 await page.addInitScript(()=>{localStorage.setItem('maya_admin_tok','First');const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===60000)window.auditRefresh=fn;return interval(fn,ms,...args);};});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='maya.test')return route.abort();
  const owner=(route.request().headers().authorization||'').replace('Bearer ','');
  if(u.pathname==='/api/admin/ai-meter'){meterCalls++;return route.fulfill({status:meterFail?503:200,json:{ok:!meterFail,spentUsd:.12,reservedUsd:0,limitUsd:1,scope:'Outbound AI',models:[{provider:'openai',connected:true}],providers:{openai:.12}}});}
  if(u.pathname.endsWith('/intelligence'))return route.fulfill({status:expire?401:200,json:{ok:!expire,mailboxes:[{id:owner,email:owner+'@example.com'}],crm:{lastRunAt:crmStamp},gmailReady:true}});
  if(u.pathname.endsWith('/save')){pendingSave=()=>route.fulfill({json:{ok:true,state:stateFor(owner)}});return;}
  if(u.pathname==='/api/admin/outbound'&&pauseLoad){pauseLoad=false;pendingLoad=()=>route.fulfill({json:{ok:true,state:stateFor(owner),accountId:owner,capabilities:{}}});loadStarted();return;}
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,state:stateFor(owner),accountId:owner,capabilities:{}}});
  const path=u.pathname==='/outbound.html'?'/backend/outbound.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+path),contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[extname(path)]||'text/plain'});}catch{return route.abort();}
 });
 await page.goto('https://maya.test/outbound.html');await page.locator('.people-table [data-person="p"]').click();
 await page.locator('#menu-toggle').click();await page.locator('#sync-drawer').click();await page.locator('#modal-title').filter({hasText:'Connections'}).waitFor();assert.ok(await page.locator('#field-sheetId').isEnabled(),'Unconfigured sheet refresh opens usable connections');await page.keyboard.press('Escape');
 await page.locator('#automation-settings').click();
 await page.locator('#field-hunterDailyLimit').fill('2');assert.ok(await page.locator('#outbound-drawer').isVisible(),'Dialog interactions preserve drawer');
 assert.equal(await page.locator('#modal-title').evaluate(el=>getComputedStyle(el).fontSize),'16px');
 for(const [width,height] of [[320,568],[844,390]]){
  await page.setViewportSize({width,height});await page.locator('#modal-submit').scrollIntoViewIfNeeded();
  const box=await page.locator('#modal').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'Dialog fits short/mobile viewport');
  assert.ok(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog contents wrap');
 }
 await page.setViewportSize({width:390,height:720});
 await page.keyboard.press('Escape');assert.ok(await page.locator('#modal').isHidden());assert.ok(await page.locator('#outbound-drawer').isVisible(),'Escape closes only the top layer');
 await page.locator('.ai-meter-refresh').click();await page.waitForFunction(()=>document.querySelector('.ai-meter-value').textContent==='$0.120');
 const before=meterCalls;await page.evaluate(()=>{const m=document.querySelector('maya-ai-meter'),parent=m.parentNode;m.remove();parent.append(m);});
 await page.locator('maya-ai-meter').scrollIntoViewIfNeeded();await page.locator('.ai-meter-refresh').click();assert.ok(meterCalls>before,'Reattached meter refreshes');
 meterFail=true;await page.locator('.ai-meter-refresh').click();await page.waitForFunction(()=>document.querySelector('.ai-meter-value').textContent==='—');assert.equal(await page.locator('.ai-meter-providers li').count(),0,'Failed refresh clears stale spending');meterFail=false;
 await page.keyboard.press('Escape');
 crmStamp='2026-09-27T18:00:00Z';pauseLoad=true;await page.evaluate(()=>window.auditRefresh());await waitingLoad;await page.locator('#notes').fill('Keep this note');await pendingLoad();await page.waitForFunction(()=>document.querySelector('#automation-status').textContent.includes('Last run'));assert.equal(await page.locator('#notes').inputValue(),'Keep this note','Background refresh preserves a draft started during its request');await page.locator('#save-draft').click();
 await page.waitForFunction(()=>document.querySelector('#notes').disabled);assert.ok(await page.locator('[data-view=people]').isDisabled(),'Navigation cannot change the edited contact during a save');
 await page.evaluate(()=>{localStorage.setItem('maya_admin_tok','Second');dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));});
 assert.equal(await page.getByText('First person',{exact:true}).count(),0,'Account switch immediately removes private contact');
 await pendingSave();await page.getByText('Second person',{exact:true}).first().waitFor();assert.equal(await page.getByText('First person',{exact:true}).count(),0,'Old response cannot restore prior account');
 await page.locator('#menu-toggle').click();await page.locator('#mailboxes').getByText('Second@example.com',{exact:true}).waitFor();
 expire=true;await page.evaluate(()=>{localStorage.setItem('maya_admin_tok','Expired');dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));});
 await page.locator('#signin').waitFor();await page.waitForFunction(()=>!document.querySelector('#mailboxes').textContent.trim());
 assert.equal(await page.locator('[data-person]').count(),0,'Expired authorization clears contacts');
 assert.equal(await page.locator('#mail-sender').count(),0,'Expired authorization clears senders');
 assert.deepEqual(errors,[]);console.log('Dialog layering, compact type, meter reconnect/failure, busy controls and account/expiry isolation passed.');
} finally {await browser.close();}
