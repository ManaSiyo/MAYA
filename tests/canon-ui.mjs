import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {canonPages} from './canon-contract.mjs';
const root=resolve('.'),dir=join(tmpdir(),'maya-canon-qa');mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.emulateMedia({reducedMotion:'reduce'});
await page.route('**/*',async r=>{
 const u=new URL(r.request().url());
 if(process.env.MAYA_FONT_DIR && u.hostname==='fonts.googleapis.com'){
 const fonts=[['Jost','normal',400],['Jost','normal',500],['Jost','normal',600],['CormorantGaramond','normal',300],['CormorantGaramond','normal',400],['CormorantGaramond','normal',500],['CormorantGaramond','normal',600],['CormorantGaramond','italic',300],['CormorantGaramond','italic',400]];
 return r.fulfill({contentType:'text/css',body:fonts.map(([family,style,weight])=>`@font-face{font-family:'${family==='Jost'?'Jost':'Cormorant Garamond'}';font-style:${style};font-weight:${weight};src:url('https://maya.test/__fonts/${family}-${style}-${weight}.ttf')}`).join('\n')});}
 if(u.hostname!=='maya.test')return r.abort();
 if(u.pathname.startsWith('/__fonts/') && process.env.MAYA_FONT_DIR)return r.fulfill({body:readFileSync(join(process.env.MAYA_FONT_DIR,u.pathname.split('/').pop())),contentType:'font/ttf'});
 if(u.pathname.startsWith('/api/'))return r.fulfill({json:{ok:true,list:[],users:[],campaigns:[],connected:false}});
 try{let body=readFileSync(root+u.pathname);if(u.pathname.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
 await r.fulfill({body,contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{await r.abort();}
});
for(const path of canonPages){
 await page.goto('https://maya.test/'+path);await page.evaluate(()=>document.fonts.ready);
 const brand=page.locator('#top-left-brand .brand-title,.brand h1,#brand,.brand-title').first();if(await brand.count())assert.match(await brand.evaluate(el=>getComputedStyle(el).fontFamily),/Cormorant/,path);
 if(!path.startsWith('frontend/')&&!path.startsWith('playground/')) {
 const result=await page.evaluate(()=>{
  const box=document.createElement('div');box.innerHTML='<div class="stat"><strong>12,345</strong></div><button class="pill">Maya action</button><table><tbody><tr><td>Data 12,345</td></tr></tbody></table>';document.body.append(box);
  const metric=getComputedStyle(box.querySelector('strong')),button=getComputedStyle(box.querySelector('button')),data=getComputedStyle(box.querySelector('td'));
  const out={family:metric.fontFamily,weight:metric.fontWeight,numeric:metric.fontVariantNumeric,data:data.fontFamily,border:button.borderTopWidth,radius:button.borderRadius,fill:button.backgroundImage};box.remove();return out;
 });
 assert.match(result.family,/Jost/,path);assert.equal(result.weight,'400',path);assert.equal(result.numeric,'tabular-nums',path);assert.match(result.data,/Jost/,path);assert.equal(result.radius,'100px',path);assert.equal(result.fill,'none',path);
 }
 await page.evaluate(()=>{document.querySelectorAll('#gate,#auth-gate,#signin-panel').forEach(x=>x.style.display='none');});
 await page.screenshot({animations:'disabled',timeout:60000,path:join(dir,path.replaceAll('/','-')+'.png')});
 for(const width of [320,390,650,768,1024,1440,1920]) {
 await page.setViewportSize({width,height:844});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('Jost')),true,path);
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(overflow.scroll<=overflow.width+1,path+' horizontal page overflow at '+width+': '+JSON.stringify(overflow));
 await page.screenshot({animations:'disabled',timeout:60000,path:join(dir,path.replaceAll('/','-')+'-'+page.viewportSize().width+'.png')});
 if(!path.startsWith('frontend/')&&!path.startsWith('playground/')){
  const drawer=await page.evaluate(()=>{
   const el=document.querySelector('#drawer,#outbound-drawer,#clients-drawer');if(!el)return null;
   el.hidden=false;el.classList.add('open');el.closest('.hpane-drawer')?.classList.add('open');
   const host=document.querySelector('#adm-hscroll');if(host)host.scrollLeft=host.scrollWidth-host.clientWidth;
   const r=el.getBoundingClientRect();return {x:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth-el.clientWidth};
  });
  if(drawer){assert.ok(drawer.x>=-1&&drawer.right<=width+1&&drawer.top>=0&&drawer.bottom<=844,path+' drawer bounds at '+width+': '+JSON.stringify(drawer));assert.ok(drawer.overflow<=1,path+' drawer content overflows at '+width);}
  const settings=page.locator('#drawer-settings');
  if(await settings.count()){
   assert.equal(await settings.evaluate(el=>getComputedStyle(el).visibility),'hidden');
   await settings.evaluate(el=>el.classList.add('open'));
   assert.ok(await settings.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Brief settings fit at '+width);
   await settings.evaluate(el=>el.classList.remove('open'));
  }
  if(await page.locator('#stage-empty').count())assert.ok(await page.evaluate(()=>{
   const a=document.querySelector('#badge-grounded').getBoundingClientRect(),b=document.querySelector('#stage-empty').getBoundingClientRect();return a.bottom<=b.top;
  }),'Pattern label does not overlap its instructions at '+width);
  await page.evaluate(()=>{const el=document.querySelector('#drawer,#outbound-drawer,#clients-drawer');if(!el)return;el.classList.remove('open');el.closest('.hpane-drawer')?.classList.remove('open');if(el.id==='outbound-drawer')el.hidden=true;const host=document.querySelector('#adm-hscroll');if(host)host.scrollLeft=0;});
 }
 }

 await page.setViewportSize({width:1440,height:1000});
}
// Compare the actual frontend master with backend chrome, not guessed values.
const chromeStyle=async(selector)=>page.locator(selector).evaluate(el=>{
 const c=getComputedStyle(el);return {background:c.backgroundImage,shadow:c.boxShadow,blur:c.backdropFilter,radius:c.borderRadius};
});
await page.goto('https://maya.test/frontend/index.html');
const master=await chromeStyle('#notes-drawer');
const masterTitle=await page.locator('.pg-tabtitle').first().evaluate(el=>({font:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize}));
const masterTab=await chromeStyle('#notes-drawer .pg-tab.on');
await page.goto('https://maya.test/backend/status.html');
assert.deepEqual(await page.locator('#adm-tabtitle').evaluate(el=>({font:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize})),masterTitle);
const adminGlass=await chromeStyle('#drawer');
assert.equal(adminGlass.blur,master.blur);assert.equal(adminGlass.radius,master.radius);
assert.equal(adminGlass.background,'none','Admin uses the requested dark glass without white gradients');
assert.equal(await page.locator('#drawer').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(3, 15, 29, 0.82)');
const adminTab=await chromeStyle('.adm-tab.on');assert.equal(adminTab.radius,masterTab.radius,'Admin retains centered round tabs');assert.match(adminTab.background,/linear-gradient/,'Admin tabs use the requested glass bubble');assert.match(adminTab.shadow,/inset/,'Admin bubble has the shared highlight');
await page.locator('#drawer').evaluate(el=>{document.body.append(el);Object.assign(el.style,{position:'fixed',left:'auto',width:'360px',zIndex:'999'});});
await page.screenshot({animations:'disabled',path:join(dir,'backend-drawer-parity.png')});
assert.equal(await page.locator('#maya-toggle .mt-switch').evaluate(el=>getComputedStyle(el).width),'34px');
await page.goto('https://maya.test/backend/outbound.html');
assert.deepEqual(await chromeStyle('#outbound-drawer'),adminGlass,'Outbound and Admin share the same quiet glass');
await page.goto('https://maya.test/backend/backend.html');
assert.deepEqual(await chromeStyle('#clients-drawer'),master,'Brief drawer matches frontend');
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).animationName),'none');
console.log('V4 canon rendered checks: 11 pages, 7 widths (320–1920), desktop/mobile, metric typography, capsule styles and reduced motion passed');
}finally{await browser.close();}
