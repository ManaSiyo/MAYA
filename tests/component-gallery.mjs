import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/opt/pw-browsers/chromium')});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='maya.test')return r.abort();try{const p=resolve(root,'.'+u.pathname);if(!p.startsWith(root+'/'))return r.abort();await r.fulfill({body:readFileSync(p),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'})[extname(p)]||'text/plain'});}catch{await r.abort();}});
try{
 await page.goto('https://maya.test/playground/components/index.html');await page.locator('#tokens input').first().waitFor({state:'attached'});
 const baseline=JSON.parse(readFileSync(root+'/docs/design-archive/tap-to-listen-computed.json'));
 const pill=page.locator('.comparison [data-finish="current"]');
 const actual=await pill.evaluate(e=>{const c=getComputedStyle(e);return Object.fromEntries(['paddingTop','paddingRight','borderRadius','borderTopWidth','backgroundColor','backdropFilter','boxShadow','fontSize','fontWeight','letterSpacing'].map(k=>[k,c[k]]));});
 for(const k of ['paddingTop','paddingRight','borderRadius','borderTopWidth','backgroundColor','backdropFilter','boxShadow'])assert.equal(actual[k],baseline.pill[k],k);
 for(const k of ['fontSize','fontWeight','letterSpacing'])assert.equal(actual[k],baseline.label[k],k);
 await page.locator('#advanced summary').click();
 const padding=page.locator('input[name="--ui-pill-padding-x"]');await padding.fill('22px');assert.equal(await pill.evaluate(e=>getComputedStyle(e).paddingLeft),'22px');
 await page.reload();await page.locator('#tokens input').first().waitFor({state:'attached'});assert.equal(await padding.inputValue(),'22px');await page.locator('#advanced summary').click();
 await padding.fill('bogus');assert.equal(await padding.getAttribute('aria-invalid'),'true');assert.equal(await pill.evaluate(e=>getComputedStyle(e).paddingLeft),'22px');
 await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await pill.evaluate(e=>getComputedStyle(e).paddingLeft),'14px');
 await page.locator('#fallback').check();assert.equal(await pill.evaluate(e=>getComputedStyle(e).backdropFilter),'none');await page.locator('#fallback').uncheck();
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await pill.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.emulateMedia({forcedColors:'active'});assert.equal(await pill.evaluate(e=>getComputedStyle(e).boxShadow),'none');await page.emulateMedia({forcedColors:'none'});
 await page.locator('#advanced summary').click();
 assert.equal(await page.locator('.maya-metric-value').first().evaluate(e=>getComputedStyle(e).fontSize),'12px');
 const iconCenter=await page.locator('.maya-icon-button').first().evaluate(e=>{const b=e.getBoundingClientRect(),s=e.querySelector('svg').getBoundingClientRect();return Math.abs((b.x+b.width/2)-(s.x+s.width/2))+Math.abs((b.y+b.height/2)-(s.y+s.height/2));});assert.ok(iconCenter<1);
 await page.locator('#preview-font').selectOption('Arial, sans-serif');assert.match(await page.locator('#buttons .maya-pill').first().evaluate(e=>getComputedStyle(e).fontFamily),/Arial/);
 assert.equal(await page.locator('.font-card').count(),3);assert.match(await page.locator('#pages').textContent(),/12 page files/);
 assert.equal(await page.locator('#gallery > section').count(),3);
 assert.equal(await page.locator('.page-map .page-link').count(),12);
 assert.equal(await page.locator('[data-finish="liquid"].maya-pill').first().evaluate(e=>getComputedStyle(e).fontSize),'10px');
 assert.match(await page.locator('[data-finish="liquid"].maya-pill').first().evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);
 assert.ok(await page.locator('#fonts').isVisible());
 assert.equal(await page.locator('.type-row').count(),11);
 for(const name of ['Current','Proposed liquid glass','Clearer glass']){
  await page.getByRole('button',{name,exact:true}).click();
  const finish=await page.locator('#buttons .maya-pill').first().getAttribute('data-finish');
  assert.equal(finish,{'Current':'current','Proposed liquid glass':'liquid','Clearer glass':'clear'}[name]);
  assert.ok(await page.locator('#buttons .maya-glass').evaluateAll((es,f)=>es.every(e=>e.dataset.finish===f),finish));
  await page.getByRole('button',{name:'Open drawer',exact:true}).click();assert.equal(await page.locator('.maya-drawer').getAttribute('data-finish'),finish);await page.keyboard.press('Escape');
 }
 await page.locator('#clear-glass').uncheck();assert.equal(await page.locator('#buttons .maya-pill').first().getAttribute('data-finish'),'liquid');
 await page.getByText('Adjust selected finish',{exact:true}).click();
 await page.getByRole('slider',{name:'Base transparency',exact:true}).fill('95');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#buttons .maya-pill')).backgroundColor==='rgba(3, 15, 29, 0.05)');
 assert.match(await page.locator('.finish-sample[data-selected="true"] .finish-numbers').textContent(),/95% transparent/);
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 for(const width of [320,390,650,768,1024,1440,1920]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(50);
  const heights=await page.locator('#buttons .preview-row').first().evaluate(e=>[e.querySelector('.maya-pill').getBoundingClientRect().height,e.querySelector('.maya-icon-button').getBoundingClientRect().height]);assert.ok(Math.abs(heights[0]-heights[1])<1,'icon height matches pill '+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
  const open=page.getByRole('button',{name:'Open drawer',exact:true});await open.click();const dialog=page.locator('.maya-drawer');assert.ok(await dialog.isVisible());let box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.ok(await dialog.isHidden());assert.ok(await open.evaluate(e=>e===document.activeElement));
  const f=page.getByRole('button',{name:'Open filter',exact:true});await f.click();const pop=page.locator('.maya-filter-popover');box=await pop.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0);
  await pop.getByLabel('Booked').uncheck();await pop.getByRole('button',{name:'Apply'}).click();assert.ok(await pop.isHidden());assert.ok(await f.evaluate(e=>e===document.activeElement));
 }
 await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/private/tmp/maya-component-gallery.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export choices'}).click();assert.equal((await download).suggestedFilename(),'maya-tokens.css');
 assert.deepEqual(errors,[]);console.log('Gallery passed: measured baseline, edit/persist/reset/export, states, 7 widths, drawer/filter focus, reduced motion and forced colors.');
}finally{await browser.close();}
