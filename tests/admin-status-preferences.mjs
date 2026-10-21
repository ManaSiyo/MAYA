import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname);
const token=(sub,revision=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,revision,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const stages=['new','contacted','in_progress','booked','completed','canceled'];
const leads=stages.map((stage,i)=>({id:'status-'+i,name:'Example '+stage,phone:'+1415555010'+i,stage,createdAt:'2026-10-17'}));
const key=account=>'maya_admin_lead_status_v1:'+encodeURIComponent(account);
const a=token('account-a'),b=token('account-b');
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],writes=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){}}}};});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='maya.test')return route.abort();
 if(url.pathname.startsWith('/api/')){
  if(req.method()==='POST')writes.push(url.pathname);
  return route.fulfill({json:{ok:true,connected:true,leads:{connected:true,list:leads},list:leads,folders:[],total:0,threads:[],items:[],notes:[],models:[],briefing:[],attention:[],ranges:{},accounts:{total:0}}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const visible=()=>page.locator('#leads-table tbody tr[id]').count();
const checked=()=>page.locator('#lead-status-menu input:checked').evaluateAll(nodes=>nodes.map(n=>n.dataset.status));
const show=async()=>{await page.locator('#leads-fold').scrollIntoViewIfNeeded();await page.locator('.lead-filter>summary').click();await page.locator('#lead-status-menu').waitFor({state:'visible'});assert.ok(await page.locator('#lead-status-menu label').evaluateAll(rows=>rows.every((row,i)=>i===0||row.getBoundingClientRect().top>=rows[i-1].getBoundingClientRect().bottom-1)),'Lead filter remains a single vertical list');};
const select=async wanted=>{await show();for(const stage of stages)await page.locator('#lead-status-menu [data-status="'+stage+'"]').setChecked(wanted.includes(stage));await page.keyboard.press('Escape');};
const adopt=async t=>{await page.evaluate(t=>_adoptToken(t),t);await page.waitForFunction(()=>!document.getElementById('adm-mkt').hidden&&!!document.querySelector('#leads-table th'));};
const reload=async()=>{await page.reload();await page.waitForFunction(()=>!document.getElementById('adm-mkt').hidden&&!!document.querySelector('#leads-table th'));};
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof paintLeads==='function');await adopt(a);
 assert.equal(await visible(),6);await select(['booked']);assert.equal(await visible(),1);
 assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key('account-a'))),['booked']);
 await reload();assert.deepEqual(await checked(),['booked']);assert.equal(await visible(),1,'Reload restores the authenticated account preference');
 await adopt(token('account-a',2));assert.deepEqual(await checked(),['booked']);assert.equal(await visible(),1,'Same-account renewal keeps its preference');
 await adopt(b);assert.deepEqual(await checked(),stages);assert.equal(await visible(),6,'Another account does not inherit its predecessor');
 await select(['contacted','completed']);await adopt(token('account-a',3));assert.deepEqual(await checked(),['booked']);await adopt(token('account-b',2));assert.deepEqual(await checked(),['contacted','completed']);
 await select([]);assert.equal(await visible(),0);await reload();assert.deepEqual(await checked(),[]);assert.equal(await visible(),0,'An intentional empty filter survives reload');
 for(const bad of ['{bad',JSON.stringify({booked:true}),JSON.stringify(['new','invented']),JSON.stringify(null)]){
  await page.evaluate(({key,bad})=>localStorage.setItem(key,bad),{key:key('account-b'),bad});await reload();assert.deepEqual(await checked(),stages,'Invalid persisted filter falls back safely: '+bad);assert.equal(await visible(),6);
 }
 assert.deepEqual(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key('account-a'))),['booked'],'Invalid B data never overwrites A');
 // Storage-denied browsers retain the immediate choice; no failed request or false account write.
 await page.evaluate(()=>{window.fixtureSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('maya_admin_lead_status_v1:'))throw new DOMException('Fixture denied','SecurityError');return fixtureSetItem.call(this,key,value);};});
 await select(['canceled']);assert.deepEqual(await checked(),['canceled']);assert.equal(await visible(),1);
 await page.evaluate(()=>{Storage.prototype.setItem=fixtureSetItem;});await adopt(token('account-a',4));assert.deepEqual(await checked(),['booked']);
 assert.equal(await page.locator('#pe-fold,#pe-retired,#arch-fold,[id^="pe-"]').count(),0);assert.equal(await page.locator('#features-fold,#changes-fold').count(),2);
 assert.equal(await page.locator('script[src*="firebase"]').count(),0,'Retired editor creates no Firebase session');
 assert.deepEqual(errors,[]);assert.ok(writes.every(path=>path==='/api/admin/marketing-brief'),'Filtering never posts lead or prompting mutations');
 console.log('Admin Leads preferences: real checkbox choices, reload, same-account renewal, A/B isolation, empty/invalid storage and denied writes passed; retired folds absent, Features/Recent changes retained.');
}finally{await browser.close();}
