import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[];let fail=false;
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/admin/messages/thread'&&u.searchParams.has('before'))return route.fulfill({json:{ok:true,messages:[{id:'older-one',dir:'in',kind:'sms',text:'Archived conversation',ts:'2026-09-01'}],hasMore:false}});
  if(u.pathname==='/api/admin/messages/suggest')return route.fulfill({json:{ok:true,eligible:true,stage:'first',text:'Hi Angela, would you like to discuss your green suit?'}});
  if(u.pathname==='/api/admin/text-automations'&&req.method()==='GET')return route.fulfill({json:{ok:true,settings:{first:{enabled:true,text:'Hi {name}',trigger:'new_lead',time:'10:00'},second:{enabled:false,text:'Hi {name}',trigger:'no_reply',time:'10:00',days:3}}}});
  if(req.method()==='POST'){writes.push({path:u.pathname,body:req.postDataJSON(),auth:req.headers().authorization});return route.fulfill({status:fail?503:200,json:fail?{error:'Save unavailable'}:{ok:true}});}
  return route.fulfill({json:{ok:true,connected:true,threads:[],thread:{number:u.searchParams.get('number'),name:'',consent:'none',messages:[],transcripts:[]}}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof msgBegin==='function');
 await page.evaluate(()=>{_idTok='fixture-owner';toggleDrawer(true);admTab('messages');});
 await page.locator('#msg-begin').click();await page.locator('#msg-new-number').fill('not a phone');await page.locator('#msg-new-start').click();assert.equal(writes.length,0);assert.match(await page.locator('#msg-new-feedback').textContent(),/valid number/);
 await page.locator('#msg-new-number').fill('(415) 555-0123');await page.locator('#msg-new-name').fill('New Person');await page.locator('#msg-new-start').click();await page.locator('#msg-input').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('msg-new').dataset.busy);
 assert.deepEqual(writes.map(w=>w.path),['/api/admin/messages/name']);assert.deepEqual(writes[0].body,{number:'+14155550123',name:'New Person'});assert.equal(writes[0].auth,'Bearer fixture-owner');assert.equal(await page.locator('#msg-name').inputValue(),'New Person');assert.equal(await page.locator('#msg-input').inputValue(),'');
 await page.locator('#msg-input').fill('Reviewed first message');await page.locator('.msg-send').click();await page.waitForFunction(()=>document.getElementById('msg-input').value==='');assert.equal(writes.at(-1).path,'/api/admin/messages/send');assert.equal(writes.at(-1).body.to,'+14155550123');assert.equal(writes.at(-1).body.text,'Reviewed first message');assert.ok(writes.at(-1).body.requestId);
 await page.evaluate(()=>{_msgPaintThread({consent:'stop',messages:[]});document.getElementById('msg-input').value='Must not send';});const stopWrites=writes.length;await page.evaluate(()=>msgSend());assert.equal(writes.length,stopWrites,'STOP cannot send even through direct handler');
 await page.evaluate(()=>msgBack());await page.locator('#msg-begin').click();await page.locator('#msg-new-name').fill('');await page.locator('#msg-new-number').fill('+44 7700 900123');await page.locator('#msg-new-call').click();assert.match(await page.locator('#msg-new-feedback').textContent(),/US numbers/);assert.equal(writes.length,stopWrites);
 await page.locator('#msg-new-start').click();await page.locator('#msg-input').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('msg-new').dataset.busy);assert.equal(await page.locator('#msg-number').textContent(),'+447700900123');assert.equal(writes.length,stopWrites,'Opening international text does not send');
 await page.locator('#msg-input').fill('Keep this draft');await page.evaluate(()=>msgBack());await page.locator('#msg-begin').click();await page.locator('#msg-new-number').fill('4155550124');
 page.once('dialog',d=>d.dismiss());await page.locator('#msg-new-call').click();await page.locator('#msg-input').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('msg-new').dataset.busy);assert.equal(writes.length,stopWrites,'Declining call never contacts provider');
 await page.evaluate(()=>msgBack());await page.locator('#msg-begin').click();page.once('dialog',d=>d.accept());await page.locator('#msg-new-call').click();await page.waitForFunction(()=>document.getElementById('msg-consent').textContent.includes('calling'));assert.equal(writes.at(-1).path,'/api/admin/phone/call-client');assert.equal(writes.at(-1).body.to,'+14155550124');
 await page.evaluate(()=>openThread('+447700900123',''));assert.equal(await page.locator('#msg-input').inputValue(),'Keep this draft','Draft stays with its recipient');
 await page.evaluate(()=>msgBack());await page.locator('#msg-begin').click();await page.locator('#msg-new-name').fill('Save fails');fail=true;await page.locator('#msg-new-start').click();await page.getByText('Save unavailable',{exact:true}).waitFor();assert.equal(await page.locator('#msg-new-number').inputValue(),'4155550124');assert.equal(await page.locator('#msg-new-start').isEnabled(),true);fail=false;
 await page.evaluate(()=>window.dispatchEvent(new Event('maya-owner-session-changed')));assert.equal(await page.locator('#msg-new').isVisible(),false);assert.equal(await page.locator('#msg-new-name').inputValue(),'');
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{_idTok='fixture-owner';admTab('messages');msgNewToggle(true);});assert.ok(await page.locator('#msg-new').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Typed-number form fits '+width);}
 assert.deepEqual(errors,[]);console.log('Begin texting validates numbers, saves optional names, preserves reviewed sends, STOP, confirmed calls, recipient drafts and account resets.');
}finally{await browser.close();}
