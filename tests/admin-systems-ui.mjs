import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.'), browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage();await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let writes=0;
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='maya.test')return route.abort();
  if(u.pathname==='/api/admin/models')return route.fulfill({json:{checkedAt:'2026-10-03T12:00:00Z',models:{'Admin text':'gpt-6-luna','Image default':'gpt-image-2.5-flare'},connections:[{provider:'OpenAI',model:'gpt-5-nano',configured:true,transport:'api',endpoint:'https://api.openai.com/v1/responses'},{provider:'gemini',model:'gemini-2.5-flash-lite',configured:true,transport:'vertex',endpoint:'https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent'}],images:[{provider:'OpenAI',model:'gpt-image-2.5-flare',configured:true,endpoint:'https://api.openai.com/v1/images/generations'}]}});
  if(u.pathname.startsWith('/api/')){if(route.request().method()==='POST')writes++;return route.fulfill({json:{ok:true,items:[],list:[],mailboxes:[]}});}
  let path=u.pathname==='/status.html'?'/backend/status.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain'});}catch{return route.abort();}
 });
 await page.goto('https://maya.test/status.html');await page.locator('#model-snapshot').waitFor({state:'attached'});
 await page.evaluate(()=>{document.querySelectorAll('#gate,#auth-gate').forEach(e=>e.remove());_idTok='fixture';});
 assert.deepEqual(await page.locator('#adm-mkt > details').evaluateAll(es=>es.map(e=>e.id)),['leads-fold','ads-fold','bottom-fold']);
 assert.equal(await page.locator('#leads-fold h2').textContent(),'Leads');assert.equal(await page.locator('#bottom-fold h2').textContent(),'Insights');
 assert.equal(await page.locator('#leads-fold h2').evaluate(e=>getComputedStyle(e).marginTop),'0px','Section text and chevron share a centered line');
 assert.equal(await page.locator('maya-ai-meter').count(),0);assert.equal(await page.locator('.test-gemini').count(),0);
 assert.equal(await page.locator('#drawer-systems a').filter({hasText:'OpenAI usage'}).getAttribute('href'),'https://platform.openai.com/settings/organization/usage');
 for(const width of [320,390,650,768,1024,1440,1920]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>{admTab('systems');toggleDrawer(true);});
  await page.getByRole('button',{name:'API model details',exact:true}).focus();
  await page.waitForFunction(()=>document.querySelector('#model-snapshot').textContent.includes('gpt-5-nano'));
  assert.match(await page.locator('#model-snapshot').textContent(),/gpt-6-luna/);
  assert.doesNotMatch(await page.locator('#model-snapshot').textContent(),/gpt-image-2.5-flare/);
  await page.locator('.model-provider summary').filter({hasText:'gemini'}).focus();assert.match(await page.locator('#model-snapshot').textContent(),/aiplatform.googleapis.com/);
  if(width===1440)await page.screenshot({path:'/private/tmp/maya-admin-systems-preview.png'});
  let b=await page.locator('#model-snapshot').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=844,'Model popup fits '+width);
  await page.keyboard.press('Escape');assert.ok(await page.locator('#model-snapshot').isHidden());
  await page.getByRole('button',{name:'Image model details',exact:true}).click();assert.match(await page.locator('#model-snapshot').textContent(),/gpt-image-2.5-flare/);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>admTab('logs'));assert.ok(await page.locator('#drawer-systems').isHidden());
  assert.equal(await page.locator('#drawer-logs #drawer-command #maya-chat').count(),1);
  await page.evaluate(()=>{document.body.classList.add('maya-live');_mayaChatAdd('maya','Fixture conversation');});
  assert.ok(await page.locator('#drawer-logs').isVisible());assert.ok(await page.locator('#adm-tabrow').isVisible());
  await page.evaluate(()=>_mayaQueueAction({kind:'memory',text:'Fixture request'}));
  assert.ok(await page.locator('#maya-confirmation').evaluate(e=>e.open));assert.equal(await page.locator('#drawer #maya-action-queue').count(),0);
  b=await page.locator('#maya-confirmation').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y+b.height<=844,'Approval fits '+width);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();assert.equal(await page.locator('#maya-confirmation').evaluate(e=>e.open),false);
 }
 for(const [width,height] of [[320,568],[844,390],[1024,600]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{admTab('systems');toggleDrawer(true);});
  await page.getByRole('button',{name:'API model details',exact:true}).focus();
  await page.getByRole('button',{name:'API model details',exact:true}).press('Enter');
  await page.locator('.model-provider summary').filter({hasText:'gemini'}).focus();
  await page.waitForTimeout(30);const b=await page.locator('#model-snapshot').boundingBox();
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'Expanded model hover fits landscape');
  await page.keyboard.press('Escape');
 }
 assert.equal(writes,0,'Hover and dismiss never perform an owner action');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('maya-model-clear')));assert.ok(await page.locator('#model-snapshot').isHidden());assert.equal(await page.locator('#model-snapshot').textContent(),'');
 assert.deepEqual(errors,[]);console.log('Admin hierarchy, provider hover details, Vault, Logs conversation and dashboard approvals passed at seven widths.');
}finally{await browser.close();}
