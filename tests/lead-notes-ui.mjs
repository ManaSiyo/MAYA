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
 fail=true;await page.locator('#lead-note-save').click();await page.getByText('Save unavailable',{exact:true}).waitFor();assert.equal(await page.locator('.lead-note-vp').textContent(),'Original note');assert.equal(await page.locator('#lead-note-input').inputValue(),'A green suit for October');assert.equal(await page.evaluate(()=>fixtureRecognition.at(-1).aborted),true);
 fail=false;await page.locator('#lead-note-save').click();await page.locator('#lead-note-dialog').waitFor({state:'detached'});assert.equal(await page.locator('.lead-note-vp').textContent(),'A green suit for October');assert.deepEqual(writes.at(-1),{path:'/api/admin/lead-update',body:{id:'m_1',note:'A green suit for October'},auth:'Bearer fixture-owner'});
 await page.evaluate(()=>{leadOpenThread(0);});await page.waitForTimeout(80);assert.equal(await page.locator('#msg-name').inputValue(),'Angela Example');
 assert.equal(await page.locator('#msg-call svg').count(),1);assert.equal(await page.locator('#msg-call').textContent(),'');
 await page.locator('#msg-input').fill('Existing draft');const before=writes.length;await page.getByRole('button',{name:'Booking Link',exact:true}).click();assert.equal(writes.length,before,'Booking Link never calls send or preview providers');
 assert.match(await page.locator('#msg-input').inputValue(),/^Existing draft\nHi Angela, here is our consultation booking link: https:\/\/wix.to\/wT2lSqE$/);await page.getByRole('button',{name:'Booking Link',exact:true}).click();assert.equal((await page.locator('#msg-input').inputValue()).match(/wix.to/g).length,1);
 await page.evaluate(()=>_msgPaintThread({number:'+14155550101',name:'Angela Example',consent:'stop',messages:[],transcripts:[]}));const draft=await page.locator('#msg-input').inputValue();await page.getByRole('button',{name:'Booking Link',exact:true}).click();assert.equal(await page.locator('#msg-input').inputValue(),draft);assert.match(await page.locator('#msg-feedback').textContent(),/cannot receive/);
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>editLatestLeadNote(0));const bounds=await page.locator('#lead-note-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'Note editor fits '+width);await page.locator('#lead-note-cancel').click();
 }
 assert.deepEqual(errors,[]);console.log('Lead note typing/dictation, confirmed persistence, H5/H6, Contact and unsent Booking Link drafts passed at four widths.');
}finally{await browser.close();}
