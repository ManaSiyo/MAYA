import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/opt/pw-browsers/chromium')});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let savedPost=null;
await page.route('**/*',async r=>{const u=new URL(r.request().url());if(!['maya.test','maya.manasiyo.com'].includes(u.hostname))return r.abort();if(u.pathname==='/api/design')return r.fulfill({json:{}});if(u.pathname==='/api/admin/design'){savedPost={header:r.request().headers()['authorization'],body:r.request().postDataJSON()};return r.fulfill({json:{ok:true}});}try{const p=resolve(root,'.'+u.pathname);if(!p.startsWith(root+'/'))return r.abort();await r.fulfill({body:readFileSync(p),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(p)]||'text/plain'});}catch{await r.abort();}});
try{
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');await page.locator('[data-category="H4"] .type-row').first().waitFor();
 assert.match(await page.title(),/MAYA Aesthetic Control/);
 assert.equal(await page.locator('.type-group').count(),9);
 assert.deepEqual(await page.locator('.type-group').evaluateAll(es=>es.map(e=>e.dataset.category)),['H1','H2','H3','H4','P1','P2','P3','P4','P5']);
 assert.equal(await page.locator('[data-type="dashboard"]').getAttribute('data-type'),'dashboard');
 assert.equal(await page.locator('[data-type="dashboard"] .type-example').evaluate(e=>getComputedStyle(e).fontSize),'14px');
 assert.equal(await page.locator('[data-type="drawer"] .type-example').evaluate(e=>getComputedStyle(e).fontSize),'20px');
 const usage=JSON.parse(readFileSync(root+'/aesthetics/aesthetic-control/typography-usage.json'));
 for(const [category,entry] of Object.entries(usage.categories)){
  assert.equal(entry.count,entry.locations.length);
  assert.equal(Object.values(entry.roles).reduce((n,r)=>n+r.count,0),entry.count);
  assert.equal(await page.locator(`[data-category="${category}"] > .type-category`).textContent(),`${category} (${entry.count})`);
  for(const [role,data] of Object.entries(entry.roles))assert.match(await page.locator(`[data-category="${category}"] [data-type="${role}"] .type-role`).textContent(),new RegExp(`\\(${data.count}\\)`));
 }
 await page.locator('[data-category="H4"] .type-editor summary').click();
 await page.locator('[data-category="H4"] [data-field="size"]').fill('12');
 assert.equal(await page.locator('[data-type="dashboard"] .type-example').evaluate(e=>getComputedStyle(e).fontSize),'12px');
 await page.locator('#save').click();assert.match(await page.locator('#feedback').textContent(),/Saved locally/);
 await page.reload();await page.locator('[data-category="H4"] .type-row').first().waitFor();
 assert.equal(await page.locator('[data-type="dashboard"] .type-example').evaluate(e=>getComputedStyle(e).fontSize),'12px');
 await page.goto('https://maya.test/backend/status.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.getElementById('maya-typography-control-style'));
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--maya-type-H4-size').trim()),'12px');
 assert.equal(await page.evaluate(()=>{const host=document.querySelector('#adm-mkt');const node=document.createElement('div');node.className='bl-step';node.innerHTML='<div class="v">12</div>';host.append(node);const size=getComputedStyle(node.firstChild).fontSize;node.remove();return size;}),'12px');
 const designLink=page.getByRole('link',{name:'Aesthetic Control',exact:true});
 assert.equal(await designLink.getAttribute('href'),'/aesthetics/aesthetic-control.html');
 assert.equal(await designLink.evaluate(e=>getComputedStyle(e).borderRadius),'100px');
 await page.goto('https://maya.test/frontend/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.getElementById('maya-typography-control-style'));
 assert.equal(await page.locator('#brand-title').evaluate(e=>getComputedStyle(e).fontSize),'24px');
 await page.goto('https://maya.test/backend/outbound.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.getElementById('maya-typography-control-style'));
 assert.equal(await page.evaluate(()=>{const n=document.createElement('div');n.className='stat';n.innerHTML='<strong>262</strong>';document.body.append(n);const size=getComputedStyle(n.firstChild).fontSize;n.remove();return size;}),'12px');
 await page.goto('https://maya.test/aesthetics/aesthetic-control.html');await page.locator('#save').waitFor();
 await page.locator('#reset').click();
 for(const width of [320,390,650,768,1024,1440,1920]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/private/tmp/maya-typography-controls.png',fullPage:true});
 await page.goto('https://maya.manasiyo.com/aesthetics/aesthetic-control.html');await page.locator('#save').waitFor();
 await page.evaluate(()=>localStorage.setItem('maya_admin_tok','test-owner-token'));
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Saved across MAYA pages'));
 assert.equal(savedPost.header,'Bearer test-owner-token');assert.deepEqual(Object.keys(savedPost.body.type),['H1','H2','H3','H4','P1','P2','P3','P4','P5']);
 assert.deepEqual(errors.filter(e=>!e.includes('Firebase')&&!e.includes('google')),[]);
 console.log('Typography Controls passed: role counts, descending roles, edit/save/reload, Admin application, seven widths.');
}finally{await browser.close();}
