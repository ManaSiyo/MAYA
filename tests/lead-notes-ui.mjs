import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[];let fail=false;
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(req.method()==='POST'){writes.push({path:u.pathname,body:req.postDataJSON(),auth:req.headers().authorization});return route.fulfill({status:fail?503:200,json:fail?{error:'Save unavailable'}:{ok:true}});}
  return route.fulfill({json:{ok:true,connected:true,threads:[],thread:{number:'+14155550101',name:'Caller',messages:[],transcripts:[]}}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof paintLeads==='function'&&typeof editLatestLeadNote==='function');
 await page.evaluate(()=>{_idTok='fixture-owner';paintLeads({connected:true,list:[{id:'m_1',name:'Angela Example',phone:'+14155550101',createdAt:'2026-10-04T12:00:00Z',wrote:'Original note',stage:'new'}]});});
 assert.deepEqual(await page.locator('#leads-table th').evaluateAll(es=>es.map(e=>e.childNodes[0].textContent.trim())),['Full name','Contact','Status','Latest Notes']);
 assert.equal(await page.locator('#leads-table .category-badge').count(),0);
 assert.equal(await page.locator('[data-col="contact"]').last().textContent(),'+14155550101');
 const name=await page.locator('.lead-identity').boundingBox(),date=await page.locator('.lead-signup').boundingBox();assert.ok(date.y>=name.y+name.height-1,'Date sits under name');
 assert.equal(await page.locator('.lead-identity').evaluate(e=>getComputedStyle(e).fontSize),'14px');assert.equal(await page.locator('.lead-signup').evaluate(e=>getComputedStyle(e).fontSize),'10px');
 await page.getByRole('button',{name:'Edit latest note for Angela Example'}).click();await page.locator('#lead-note-input').fill('Changed by typing');await page.locator('#lead-note-cancel').click();assert.equal(writes.length,0);assert.equal(await page.locator('.lead-note-vp').textContent(),'Original note');
 await page.getByRole('button',{name:'Edit latest note for Angela Example'}).click();await page.locator('#lead-note-input').fill('');await page.locator('#lead-note-dictate').click();
 await page.evaluate(()=>{const result=[{transcript:'A green suit for October'}];result.isFinal=true;fixtureRecognition.at(-1).onresult({resultIndex:0,results:[result]});});
 assert.equal(await page.locator('#lead-note-input').inputValue(),'A green suit for October');assert.equal(writes.length,0,'Dictation is a draft');
 fail=true;await page.locator('#lead-note-save').click();await page.getByText('Save unavailable',{exact:true}).waitFor();assert.equal(await page.locator('dialog#lead-note-dialog').count(),0);assert.equal(await page.locator('#lead-note-input').inputValue(),'A green suit for October');assert.equal(await page.evaluate(()=>fixtureRecognition.at(-1).aborted),true);
 fail=false;await page.locator('#lead-note-save').click();await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'A green suit for October');assert.deepEqual(writes.at(-1),{path:'/api/admin/lead-update',body:{id:'m_1',note:'A green suit for October'},auth:'Bearer fixture-owner'});
 await page.evaluate(()=>{leadOpenThread(0);});await page.waitForTimeout(80);assert.equal(await page.locator('#msg-name').inputValue(),'Angela Example');
 assert.equal(await page.locator('#msg-call svg').count(),1);assert.equal(await page.locator('#msg-call').textContent(),'');
 await page.locator('#msg-input').fill('Existing draft');const before=writes.length;await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal(writes.length,before,'Booking Link never calls send or preview providers');assert.ok(await page.locator('#msg-input').evaluate(e=>e.clientHeight>=Math.min(94,e.scrollHeight-2)),'Booking draft grows for review');
 assert.match(await page.locator('#msg-input').inputValue(),/^Existing draft\nHi Angela, here is our consultation booking link: https:\/\/wix.to\/wT2lSqE$/);await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal((await page.locator('#msg-input').inputValue()).match(/wix.to/g).length,1);
 await page.evaluate(()=>_msgPaintThread({number:'+14155550101',name:'Angela Example',consent:'stop',messages:[],transcripts:[]}));const draft=await page.locator('#msg-input').inputValue();await page.evaluate(()=>msgShare(true));await page.getByRole('button',{name:'Booking link',exact:true}).click();assert.equal(await page.locator('#msg-input').inputValue(),draft);assert.match(await page.locator('#msg-feedback').textContent(),/cannot receive/);
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>editLatestLeadNote(0));const bounds=await page.locator('#lead-note-editor').boundingBox();assert.ok(bounds.width>0,'Inline note editor remains inside its cell at '+width);await page.locator('#lead-note-cancel').click();
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>editLatestLeadNote(0));await page.locator('#lead-note-input').fill('Inline Enter saves');await page.locator('#lead-note-input').press('Enter');await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'Inline Enter saves');assert.equal(await page.locator('dialog#lead-note-dialog').count(),0);
 await page.evaluate(()=>editLatestLeadNote(0));await page.locator('#lead-note-input').fill('Blur saves');await page.locator('.lead-identity').click();await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'Blur saves');
 assert.equal(await page.locator('#msg-number').isVisible(),false,'Known contact displays name only');assert.equal(await page.locator('#msg-name').inputValue(),'Angela Example');assert.ok(await page.locator('#msg-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>parseFloat(getComputedStyle(document.querySelector('.msg-thread-heading')).fontSize)),'Name has stronger hierarchy than Messages');
 for(const selector of ['#msg-call','#msg-share'])assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width-r.height)<1&&getComputedStyle(e).borderRadius==='50%';}),'Circular action '+selector);
 assert.equal(await page.locator('#drawer').evaluate(e=>getComputedStyle(e).scrollbarWidth),'none');const dock=await page.locator('#voice-dock').boundingBox(),drawer=await page.locator('#drawer').boundingBox();assert.ok(drawer.y+drawer.height-dock.y-dock.height<25,'Wake controls stay at the drawer floor');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.table.columnWidths={name:320,contact:190,stage:210,note:420};MayaTypographyControls.apply(d);});assert.ok(Math.abs(await page.locator('#leads-table th[data-col=name]').evaluate(e=>e.getBoundingClientRect().width)-320)<2,'Saved semantic width applies to live Leads: '+JSON.stringify(await page.locator('#leads-table').evaluate(e=>({table:e.getBoundingClientRect().width,columns:[...e.querySelectorAll('th')].map(x=>({key:x.dataset.col,width:x.getBoundingClientRect().width,css:getComputedStyle(x).width})),style:document.getElementById('maya-surface-control-style').textContent.match(/html body :is\(#leads-table[^}]+}/g)}))));
 await page.locator('#drawer').screenshot({path:'/private/tmp/maya-drawer-reviewed.png'});
 assert.deepEqual(errors,[]);console.log('Lead note typing/dictation, confirmed persistence, H5/H6, Contact and unsent Booking Link drafts passed at four widths.');
}finally{await browser.close();}
