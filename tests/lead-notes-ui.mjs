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
  return route.fulfill({json:{ok:true,connected:true,threads:[],thread:{number:'+14155550101',name:'Caller',hasArchive:true,messages:[{id:'fixture-live',dir:'in',kind:'sms',text:'Latest conversation',ts:'2026-10-06'}],transcripts:[]}}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof paintLeads==='function'&&typeof editLatestLeadNote==='function');
 await page.evaluate(()=>{_idTok='fixture-owner';paintLeads({connected:true,list:[{id:'m_1',name:'Angela Example',phone:'+14155550101',createdAt:'2026-10-04T12:00:00Z',wrote:'Original note',stage:'new'}]});});
 assert.deepEqual(await page.locator('#leads-table th').evaluateAll(es=>es.map(e=>(e.querySelector('.lead-heading>span')||e.childNodes[0]).textContent.trim())),['Full name','Contact','Status','Latest Notes']);
 assert.equal(await page.locator('#leads-table .category-badge').count(),0);
 assert.equal(await page.locator('[data-col="contact"]').last().textContent(),'+14155550101');
 const name=await page.locator('.lead-identity').boundingBox(),date=await page.locator('.lead-signup').boundingBox();assert.ok(date.y>=name.y+name.height-1,'Date sits under name');
 assert.equal(await page.locator('.lead-identity').evaluate(e=>getComputedStyle(e).fontSize),'14px');assert.equal(await page.locator('.lead-signup').evaluate(e=>getComputedStyle(e).fontSize),'10px');
 await page.getByRole('button',{name:'Edit latest note for Angela Example'}).click();await page.locator('#lead-note-input').fill('Changed by typing');await page.locator('#lead-note-cancel').click();assert.equal(writes.length,0);assert.equal(await page.locator('.lead-note-vp').textContent(),'Original note');
 await page.getByRole('button',{name:'Edit latest note for Angela Example'}).click();
 assert.deepEqual(await page.locator('#lead-note-editor button').allTextContents(),['Cancel','Save']);
 assert.equal(await page.locator('#lead-note-dictate').count(),0);
 await page.locator('#lead-note-input').fill('A green suit for October');
 fail=true;await page.locator('#lead-note-save').click();await page.getByText('Save unavailable',{exact:true}).waitFor();assert.equal(await page.locator('#lead-note-input').inputValue(),'A green suit for October');
 fail=false;await page.locator('#lead-note-save').click();await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'A green suit for October');assert.deepEqual(writes.at(-1),{path:'/api/admin/lead-update',body:{id:'m_1',note:'A green suit for October'},auth:'Bearer fixture-owner'});
 await page.evaluate(()=>{toggleDrawer(true);admTab('messages');});await page.waitForTimeout(350);const headingBefore=await page.locator('#adm-tabtitle').boundingBox();
 await page.evaluate(()=>{leadOpenThread(0);});await page.waitForTimeout(80);assert.equal(await page.locator('#msg-name').inputValue(),'Angela Example');
 await page.locator('#msg-older').click();await page.getByText('Archived conversation',{exact:false}).waitFor();assert.equal(await page.locator('#msg-older').isVisible(),false);
 assert.deepEqual(await page.locator('#adm-tabtitle').boundingBox(),headingBefore,'Messages never moves when a contact opens');assert.equal(await page.locator('#adm-tabtitle').textContent(),'Messages');await page.locator('#msg-idea-use').waitFor();assert.equal(await page.locator('#msg-input').inputValue(),'','Suggestion is separate from composer');const sendsBefore=writes.length;await page.locator('#msg-idea-use').click();assert.match(await page.locator('#msg-input').inputValue(),/green suit/);assert.equal(writes.length,sendsBefore,'Using AI idea never sends');
 assert.equal(await page.locator('#msg-call svg').count(),1);assert.equal(await page.locator('#msg-call').textContent(),'');
 await page.locator('#msg-input').fill('Existing draft');const before=writes.length;await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal(writes.length,before,'Booking Link never calls send or preview providers');assert.ok(await page.locator('#msg-input').evaluate(e=>e.clientHeight>=Math.min(94,e.scrollHeight-2)),'Booking draft grows for review');
 assert.match(await page.locator('#msg-input').inputValue(),/^Existing draft\nHi Angela, here is our consultation booking link: https:\/\/wix.to\/wT2lSqE$/);await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal((await page.locator('#msg-input').inputValue()).match(/wix.to/g).length,1);
 await page.evaluate(()=>_msgPaintThread({number:'+14155550101',name:'Angela Example',consent:'stop',messages:[],transcripts:[]}));const draft=await page.locator('#msg-input').inputValue();await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal(await page.locator('#msg-input').inputValue(),draft);assert.match(await page.locator('#msg-feedback').textContent(),/cannot receive/);
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>editLatestLeadNote(0));const bounds=await page.locator('#lead-note-editor').boundingBox();assert.ok(bounds.width>0,'Inline note editor remains inside its cell at '+width);await page.locator('#lead-note-cancel').click();
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>editLatestLeadNote(0));await page.locator('#lead-note-input').fill('Inline Enter saves');await page.locator('#lead-note-input').press('Enter');await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'Inline Enter saves');assert.equal(await page.locator('dialog#lead-note-dialog').count(),0);
 await page.evaluate(()=>editLatestLeadNote(0));await page.locator('#lead-note-input').fill('Discard this draft');const beforeOutside=writes.length;await page.locator('#lead-note-input').blur();assert.equal(writes.length,beforeOutside,'Blur must never save');await page.locator('#leads-table th[data-col=note]').click();await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(writes.length,beforeOutside,'Outside click cancels without a write');assert.equal(await page.locator('.lead-note-vp').textContent(),'Inline Enter saves');
 assert.equal(await page.locator('#msg-number').isVisible(),false,'Known contact displays name only');assert.equal(await page.locator('#msg-name').inputValue(),'Angela Example');assert.ok(await page.locator('#msg-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<parseFloat(getComputedStyle(document.querySelector('#adm-tabtitle')).fontSize)),'Messages has stronger hierarchy than the contact');assert.equal(await page.locator('.msg-thread-heading').count(),0);
 for(const selector of ['#msg-call','#msg-share'])assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),g=e.querySelector('svg').getBoundingClientRect(),s=getComputedStyle(e);return Math.abs(r.width-g.width-2*parseFloat(s.paddingLeft)-2*parseFloat(s.borderLeftWidth))<1&&Math.abs(r.height-g.height-2*parseFloat(s.paddingTop)-2*parseFloat(s.borderTopWidth))<1&&s.boxShadow!=='none';}),'Glass action follows glyph plus X/Y padding '+selector);
 assert.equal(await page.locator('#drawer').evaluate(e=>getComputedStyle(e).scrollbarWidth),'none');const dock=await page.locator('#voice-dock').boundingBox(),drawer=await page.locator('#drawer').boundingBox();assert.ok(drawer.y+drawer.height-dock.y-dock.height<25,'Wake controls stay at the drawer floor');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.table.columnWidths={name:320,contact:190,stage:210,note:420};MayaTypographyControls.apply(d);});assert.ok(Math.abs(await page.locator('#leads-table th[data-col=name]').evaluate(e=>e.getBoundingClientRect().width)-320)<2,'Saved semantic width applies to live Leads: '+JSON.stringify(await page.locator('#leads-table').evaluate(e=>({table:e.getBoundingClientRect().width,columns:[...e.querySelectorAll('th')].map(x=>({key:x.dataset.col,width:x.getBoundingClientRect().width,css:getComputedStyle(x).width})),style:document.getElementById('maya-surface-control-style').textContent.match(/html body :is\(#leads-table[^}]+}/g)}))));
 await page.locator('#msg-input').blur();await page.mouse.move(0,0);assert.equal(await page.locator('.msg-rename').evaluate(e=>getComputedStyle(e).opacity),'0');await page.locator('#msg-name').hover();assert.equal(await page.locator('.msg-rename').evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal(await page.locator('#msg-name').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.evaluate(()=>admTab('automations'));await page.locator('#automation-save').waitFor({state:'visible'});await page.locator('#automation-first-text').fill('Hello {name}');await page.locator('#automation-save').click();await page.getByText('Saved. Messages remain drafts until you press Send.',{exact:true}).waitFor();assert.equal(writes.at(-1).path,'/api/admin/text-automations');assert.equal(writes.at(-1).body.first.text,'Hello {name}');assert.equal(writes.at(-1).auth,'Bearer fixture-owner');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.locator('#drawer-automations').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Automation settings fit '+width);if(width===390)await page.locator('#drawer').screenshot({path:'/private/tmp/maya-automations-reviewed.png'});}
 fail=true;await page.locator('#automation-first-text').fill('Keep my draft {name}');await page.locator('#automation-save').click();await page.getByText('Save unavailable',{exact:true}).waitFor();assert.equal(await page.locator('#automation-first-text').inputValue(),'Keep my draft {name}');fail=false;
 await page.evaluate(()=>admTab('messages'));await page.setViewportSize({width:1440,height:900});
 assert.match(await page.evaluate(()=>{_msgPaintThreads([{number:'+14155550101',name:'+14155550101',last:{text:'Hello'}}]);return document.querySelector('.msg-title b').textContent;}),/Angela Example/,'Inbox resolves phone labels to known lead names');

 await page.evaluate(()=>_msgPaintThread({name:'Angela Example',messages:[{id:'call-fixture',kind:'call',ts:'2026-10-06',transcript:[{who:'caller',text:'A long conversation '+ 'x'.repeat(500)}]}]}));
 await page.locator('#msg-scroll summary').click();
 await page.evaluate(()=>_msgPaintThread({name:'Angela Example',messages:[{id:'call-fixture',kind:'call',ts:'2026-10-06',transcript:[{who:'caller',text:'A long conversation '+ 'x'.repeat(500)}]}]},true));
 assert.equal(await page.locator('#msg-scroll details').getAttribute('open'),'','Polling preserves expanded transcripts');
 assert.equal(await page.locator('.msg-call-line').evaluate(e=>getComputedStyle(e).borderRadius),'12px','Expanded transcript uses inner panel corners, not a giant pill');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.P1.size=16;d.editor.background='gray';d.editor.fill=55;d.editor.paddingX=17;MayaTypographyControls.apply(d);});
 assert.equal(await page.locator('#msg-input').evaluate(e=>getComputedStyle(e).fontSize),'16px','Composer follows saved typography');
 assert.equal(await page.locator('#msg-share-menu').evaluate(e=>getComputedStyle(e).paddingLeft),'17px','Share menu follows saved dropdown padding');
 for(const width of [320,375,390,430,768,820,1024,1440,1920]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.locator('.msg-compose').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Composer fits '+width);
   assert.ok(await page.locator('#msg-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Long transcript fits '+width);
 }
 await page.locator('#drawer').screenshot({path:'/private/tmp/maya-drawer-reviewed.png'});
 assert.deepEqual(errors,[]);console.log('Lead note Save/Cancel, outside-click discard, confirmed persistence, H4/H5, Contact and unsent Booking Link drafts passed at four widths.');
}finally{await browser.close();}
