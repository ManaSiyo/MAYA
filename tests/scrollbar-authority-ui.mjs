import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url).pathname;
for(const relative of ['frontend/index.html',...readdirSync(resolve(root,'backend')).filter(n=>n.endsWith('.html')).map(n=>'backend/'+n),...readdirSync(resolve(root,'aesthetics/ui'),{recursive:true}).filter(n=>/\.(css|js)$/.test(n)&&n!=='presentation-runtime.js').map(n=>'aesthetics/ui/'+n)]){
 const source=readFileSync(resolve(root,relative),'utf8');assert.doesNotMatch(source,/scrollbar-color\s*:/,relative+' has no separate scrollbar palette');assert.doesNotMatch(source,/scrollbar-width\s*:\s*(thin|auto)/,relative+' has no native width that bypasses the shared renderer');assert.doesNotMatch(source,/::-webkit-scrollbar-(?:thumb|track|button|corner)[^{}]*\{/,relative+' has no competing pseudo-element theme');
}
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH,ignoreDefaultArgs:['--hide-scrollbars']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let saved={},saves=0;
await context.addInitScript(()=>{localStorage.setItem('maya_admin_tok','fixture');window.setInterval=()=>0;});
await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya-scroll.test')return route.abort();
 if(u.pathname==='/api/design')return route.fulfill({json:saved});
 if(u.pathname==='/api/admin/design'&&req.method()==='POST'){saved=req.postDataJSON();saves++;return route.fulfill({json:{ok:true,savedAt:'2026-10-31'}});}
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,connected:true,threads:[],folders:[],leads:[]}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const signature=locator=>locator.evaluate(e=>{const s=getComputedStyle(e),bar=getComputedStyle(e,'::-webkit-scrollbar'),thumb=getComputedStyle(e,'::-webkit-scrollbar-thumb'),track=getComputedStyle(e,'::-webkit-scrollbar-track');return {nativeWidth:s.scrollbarWidth,nativeColor:s.scrollbarColor,width:bar.width,height:bar.height,display:bar.display,image:thumb.backgroundImage,thumb:thumb.backgroundColor,track:track.backgroundColor,radius:thumb.borderRadius,length:thumb.backgroundSize};});
const check=async(target,width,color,track)=>{const s=await signature(target);assert.equal(s.nativeWidth,'auto','Standard native width must not bypass the saved WebKit painting');assert.equal(s.nativeColor,'auto');assert.equal(s.width,width+'px');assert.equal(s.height,width+'px');assert.match(s.image,new RegExp(encodeURIComponent(color)));assert.equal(s.thumb,'rgba(0, 0, 0, 0)');assert.equal(s.track,track);};
try{
 await page.goto('https://maya-scroll.test/frontend/index.html');await page.waitForFunction(()=>window.MayaTypographyControls);
 await page.evaluate(async()=>{await MayaTypographyControls.ready;const host=document.createElement('section');host.id='scroll-authority-fixture';host.style.cssText='position:fixed;inset:80px 30px auto;z-index:999999;display:flex;flex-wrap:wrap;gap:24px;background:#020713;padding:20px';document.body.append(host);for(const name of ['fabric-pick-grid','ordinary-content']){const e=document.createElement('div');e.className=name;e.tabIndex=0;e.style.cssText='display:block;position:relative;width:260px;height:180px;overflow:auto;max-height:none;padding:10px;flex:none';const child=document.createElement('div');child.style.cssText='width:600px;height:700px;color:white';child.textContent=name+' shared scrollbar';e.append(child);host.append(e);}const d=structuredClone(MayaTypographyControls.defaults);d.scrollbar.autoHide=false;MayaTypographyControls.apply(d);});
 await check(page.locator('#scroll-authority-fixture .fabric-pick-grid'),4,'#aab5c4','rgba(0, 0, 0, 0)');
 await check(page.locator('#scroll-authority-fixture .ordinary-content'),4,'#aab5c4','rgba(0, 0, 0, 0)');
 await page.screenshot({path:'/private/tmp/maya-scrollbars-default.png'});
 const gutter=await page.locator('#scroll-authority-fixture .fabric-pick-grid').evaluate(e=>e.offsetWidth-e.clientWidth);assert.equal(gutter,4,'The real painted scrollbar gutter follows the saved width, not the native thin gutter');
 const gallery=await context.newPage();await gallery.goto('https://maya-scroll.test/aesthetics/aesthetic-control.html');await gallery.waitForFunction(()=>window.MayaTypographyControls);await gallery.evaluate(async()=>{await MayaTypographyControls.ready;const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.scrollbar,{width:12,length:75,radius:2,autoHide:false,thumbColor:'#38bdf8',thumbOpacity:100,trackColor:'#15352f',trackOpacity:60});await MayaTypographyControls.save(d);});assert.equal(saves,1);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#scroll-authority-fixture .fabric-pick-grid'),'::-webkit-scrollbar').width==='12px');await gallery.close();
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});for(const name of ['fabric-pick-grid','ordinary-content'])await check(page.locator('#scroll-authority-fixture .'+name),12,'#38bdf8','rgba(21, 53, 47, 0.6)');}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/private/tmp/maya-scrollbars-saved.png'});
 await page.locator('#scroll-authority-fixture .fabric-pick-grid').focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('#scroll-authority-fixture .fabric-pick-grid').scrollTop>0);
 assert.equal(await page.locator('#hscroll').evaluate(e=>getComputedStyle(e).scrollbarWidth),'none','Hidden frontend navigation stays hidden');
 for(const path of ['backend/backend.html','backend/status.html','backend/wr.html','backend/operations.html']){await page.goto('https://maya-scroll.test/'+path);await page.waitForFunction(()=>window.MayaTypographyControls);await page.evaluate(async()=>{await MayaTypographyControls.ready;const e=document.createElement('div');e.id='visible-scroll-test';e.dataset.mayaScrollbar='visible';e.style.cssText='width:250px;height:150px;overflow:auto';e.innerHTML='<div style="height:800px;width:800px">Shared scroll test</div>';document.body.append(e);});await check(page.locator('#visible-scroll-test'),12,'#38bdf8','rgba(21, 53, 47, 0.6)');}
 console.log('Scrollbar authority: real frontend native/pseudo precedence and gutter, shared two-axis painting, keyboard, authenticated Save propagation and six-width values across served pages passed.');
}finally{await browser.close();}
