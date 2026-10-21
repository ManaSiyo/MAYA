import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[];let fail=false,pending=0,suggestion='Hi Angela, would you like to discuss your green suit?';
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/admin/messages/thread'&&u.searchParams.has('before'))return route.fulfill({json:{ok:true,messages:[{id:'older-one',dir:'in',kind:'sms',text:'Archived conversation',ts:'2026-09-01'}],hasMore:false}});
  if(u.pathname==='/api/admin/messages/suggest')return route.fulfill({json:{ok:true,eligible:true,stage:'first',text:suggestion}});
  if(u.pathname==='/api/admin/booking/pending')return route.fulfill({json:{ok:true,items:Array.from({length:pending},(_,i)=>({id:'preview-'+i,name:'Synthetic contact '+i,to:'+14155550123',text:'Review this booking invitation. '+ 'Consultation details and availability. '.repeat(8)}))}});
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
 for(const saved of [false,true]){
  const design=await page.evaluate(saved=>{const d=structuredClone(MayaTypographyControls.defaults);if(saved){for(const [role,size]of Object.entries({H1:32,H2:28,H3:24,H4:20,P1:18,P2:16,P3:14}))d.type[role].size=size;d.type.P1.color='white';d.pillX=8;d.pillY=10;d.drawer.paddingX=18;d.drawer.paddingY=20;}MayaTypographyControls.apply(d);return d;},saved);assert.ok(validDesign(design));
  for(const width of [320,390,768,1024,1440,1920])for(const height of [400,560,900])for(const crowded of [false,true]){
   await page.setViewportSize({width,height});pending=crowded?3:0;suggestion='A reviewed message suggestion. '.repeat(crowded?40:1);
   await page.evaluate(()=>{admTab('messages');toggleDrawer(true);});await page.waitForFunction(n=>document.querySelectorAll('#booking-pending .booking-preview').length===n,pending);
   await page.evaluate(async()=>{await openThread('+14155550123','New Person');await msgSuggest();});
   if(crowded)await page.evaluate(()=>{document.getElementById('msg-feedback').textContent='The carrier returned a long diagnostic. '.repeat(30);});
   await page.waitForFunction(()=>{const h=document.getElementById('adm-hscroll');return Math.abs(h.scrollLeft-(h.scrollWidth-h.clientWidth))<.5;});
   const label=`${saved?'saved':'default'} ${width}x${height} ${crowded?'crowded':'normal'}`;
   for(const selector of ['#msg-input','.msg-send'])assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),d=document.getElementById('voice-dock').getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=Math.min(innerHeight,d.top)+.5&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector+' is fully visible and receives pointer input: '+label);
   assert.equal(await page.locator('#msg-begin').isVisible(),false,'Inbox action stays outside an open conversation: '+label);
   if(crowded){assert.ok(await page.locator('#booking-pending').evaluate(e=>e.scrollHeight>e.clientHeight),'All pending previews remain scrollable: '+label);assert.ok(await page.locator('#msg-content').evaluate(e=>e.scrollHeight>e.clientHeight),'Long suggestions remain scrollable: '+label);}
   await page.locator('#msg-input').click();await page.locator('#msg-input').fill('Keep this unsent SMS draft\n'.repeat(6));
   for(const selector of ['#msg-input','.msg-send'])assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),d=document.getElementById('voice-dock').getBoundingClientRect();return r.bottom<=d.top+.5&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Expanded '+selector+' stays reachable: '+label);
   assert.ok(await page.locator('#msg-content').evaluate(e=>e.clientHeight>=24),'Conversation keeps a usable scroll target: '+label);
   assert.equal(await page.locator('#msg-input').evaluate(e=>getComputedStyle(e).fontSize),design.type.P1.size+'px');
   if(width===390&&height===560&&crowded)await page.locator('#drawer').screenshot({path:`/private/tmp/maya-sms-composer-${saved?'saved':'default'}.png`});
  }
 }
 const beforeReview=writes.length;const retainedDraft=await page.locator('#msg-input').inputValue();await page.locator('#booking-pending [data-booking-id="preview-2"]').scrollIntoViewIfNeeded();await page.locator('#msg-idea-use').focus();assert.ok(await page.locator('#msg-idea-use').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Keyboard focus reveals the full suggestion action');await page.evaluate(()=>msgBack());assert.equal(await page.locator('#msg-begin').isVisible(),true);await page.evaluate(()=>openThread('+14155550123','New Person'));assert.equal(await page.locator('#msg-input').inputValue(),retainedDraft);assert.equal(writes.length,beforeReview,'Opening crowded threads and typing never sends');
 await page.evaluate(()=>window.dispatchEvent(new Event('maya-owner-session-changed')));assert.equal(await page.locator('#msg-begin').isVisible(),true,'Account reset restores the inbox action');assert.equal(await page.locator('#msg-thread').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('SMS composer stays visible and clickable across six widths, three heights, long previews/ideas/errors and expanded drafts under default/changed saved styles. Reviewed sends, STOP, calls, recipient drafts and account resets passed with fake providers.');
}finally{await browser.close();}
