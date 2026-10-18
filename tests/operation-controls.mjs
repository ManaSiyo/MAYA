// Real Operations UI; deferred local sample scripts and fake provider responses only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(new URL('../',import.meta.url).pathname);
const token=(sub,revision=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,revision})).toString('base64url')+'.signature';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
const sample='window.MAYA_TESTS='+JSON.stringify({'Fixture trousers':{front:image}})+';';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],samples=new Map(),providers=new Map(),calls=[];
context.setDefaultTimeout(10000);await context.addInitScript(t=>localStorage.setItem('maya_admin_tok',t),token('owner-a'));
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url()),page=request.frame().page();if(url.hostname!=='maya-operation-controls.test')return route.abort();
 if(url.pathname==='/fixture-host')return route.fulfill({contentType:'text/html',body:'<button id="settings" onclick="document.querySelector(\'iframe\').contentWindow.postMessage({maya:\'ops-settings\',open:true},location.origin)">Settings</button><iframe style="width:100%;height:900px" src="/backend/operations.html?embedded=brief"></iframe><script>addEventListener("message",e=>{if(e.origin===location.origin&&e.source===document.querySelector("iframe").contentWindow&&e.data?.maya==="ops-settings-state")window.settingsState=e.data.open;});</script>'});
 if(url.pathname==='/aesthetics/operations/tests-data.js'){samples.set(page,route);return;}
 if(url.pathname.startsWith('/api/openai/')){calls.push(url.pathname);providers.set(page,route);return;}
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],folders:[],book:{items:[],generation:'0'}}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
async function open(path='/backend/operations.html'){
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://maya-operation-controls.test'+path,{waitUntil:'domcontentloaded'});return page;
}
async function take(map,page){for(let i=0;i<100&&!map.has(page);i++)await new Promise(r=>setTimeout(r,10));assert.ok(map.has(page),'Expected deferred request');const route=map.get(page);map.delete(page);return route;}
async function releaseSamples(page){const route=await take(samples,page);await route.fulfill({contentType:'text/javascript',body:sample});await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/aesthetics/operations/tests-data.js')));await page.evaluate(()=>new Promise(requestAnimationFrame));}
async function finishRun(page){const route=await take(providers,page);await route.fulfill({status:503,json:{error:{message:'Fixture unavailable'}}});await page.waitForFunction(()=>!RUNNING);}
const upload=page=>page.locator('#file').setInputFiles({name:'reviewed-garment.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
try{
 // No user action: lazy samples still populate the standalone sandbox.
 const first=await open();await releaseSamples(first);await first.waitForFunction(()=>ACTIVE_TEST==='Fixture trousers');assert.equal(await first.locator('#test-picker option').count(),1);
 // Actual keyboard entry, forward/backward boundary loops and Escape focus restoration.
 for(const width of [390,1440]){
  await first.setViewportSize({width,height:1000});const header=first.locator('header .hamburger');await header.focus();await first.keyboard.press('Enter');await first.waitForFunction(()=>document.activeElement.id==='m-waist');
  await first.keyboard.press('Tab');assert.equal(await first.evaluate(()=>document.activeElement.id),'m-hip');
  await first.locator('#m-length').focus();await first.keyboard.press('Tab');assert.equal(await first.evaluate(()=>document.activeElement.id),'m-waist','Last field wraps to a visible first target');
  await first.keyboard.press('Shift+Tab');assert.equal(await first.evaluate(()=>document.activeElement.id),'m-length','First field wraps backward to last');
  await first.keyboard.press('Escape');assert.equal(await header.evaluate(e=>e===document.activeElement),true);assert.equal(await first.locator('.hpane-drawer').evaluate(e=>e.inert),true);
  await first.locator('#operation-settings').focus();await first.keyboard.press('Enter');await first.waitForFunction(()=>document.activeElement.id==='m-waist');await first.keyboard.press('Escape');assert.equal(await first.evaluate(()=>document.activeElement.id),'operation-settings');
 }
 // A running operation disables every field; the focusable dialog is the safe fallback.
 await first.evaluate(()=>setOperationRunning(true));await first.locator('header .hamburger').focus();await first.keyboard.press('Enter');await first.waitForFunction(()=>document.activeElement.id==='drawer');await first.keyboard.press('Tab');assert.equal(await first.evaluate(()=>document.activeElement.id),'drawer');await first.keyboard.press('Escape');await first.evaluate(()=>setOperationRunning(false));await first.close();
 // An upload intent already wins while FileReader is still waiting.
 const pending=await open();await pending.evaluate(()=>{EMB={};window.nativeRead=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(blob){window.pendingFile={reader:this,blob};};});await upload(pending);await pending.waitForFunction(()=>!!window.pendingFile);
 await releaseSamples(pending);assert.deepEqual(await pending.evaluate(()=>({hero:HERO,active:ACTIVE_TEST,keys:Object.keys(TESTS)})),{hero:null,active:null,keys:[]});
 await pending.evaluate(()=>{FileReader.prototype.readAsDataURL=nativeRead;nativeRead.call(pendingFile.reader,pendingFile.blob);});await pending.waitForFunction(()=>RUNNING);await finishRun(pending);assert.equal(await pending.evaluate(()=>HERO),image);await pending.close();
 // Actual upload starts runGrounded and pauses at the fake vision provider. Late samples cannot cancel it.
 const active=await open();await active.evaluate(()=>{EMB={};});await upload(active);const provider=await take(providers,active);providers.set(active,provider);const before=await active.evaluate(()=>({hero:HERO,run:RUN,garment:_garmentSequence,running:RUNNING}));assert.equal(before.running,true);
 await releaseSamples(active);assert.deepEqual(await active.evaluate(()=>({hero:HERO,run:RUN,garment:_garmentSequence,running:RUNNING})),before);assert.deepEqual(await active.evaluate(()=>Object.keys(TESTS)),[]);await finishRun(active);assert.equal(await active.evaluate(()=>HERO),image);await active.close();
 // An account round trip invalidates a sample result even if the original account returns.
 const switched=await open();await switched.evaluate(tokens=>{for(const value of tokens){localStorage.setItem('maya_admin_tok',value);operationAuthChanged();}},[token('owner-b'),token('owner-a',2)]);await releaseSamples(switched);assert.deepEqual(await switched.evaluate(()=>({hero:HERO,active:ACTIVE_TEST,keys:Object.keys(TESTS)})),{hero:null,active:null,keys:[]});await switched.close();
 // Embedded parent settings requests focus the real fields; visible close button participates in both loops.
 const host=await open('/fixture-host');await host.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.location.pathname.includes('operations.html'));const frame=host.frames().find(frame=>frame.url().includes('operations.html'));await frame.waitForFunction(()=>typeof toggleDrawer==='function');await host.locator('#settings').click();await frame.waitForFunction(()=>document.activeElement.id==='m-waist');
 await frame.locator('#m-length').focus();await host.keyboard.press('Tab');assert.equal(await frame.locator('.drawer-burger').evaluate(e=>e===document.activeElement),true);
 await host.keyboard.press('Shift+Tab');assert.equal(await frame.evaluate(()=>document.activeElement.id),'m-length');await frame.locator('#m-waist').focus();await host.keyboard.press('Shift+Tab');assert.equal(await frame.locator('.drawer-burger').evaluate(e=>e===document.activeElement),true);await host.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>document.activeElement.id),'m-waist');
 await host.keyboard.press('Escape');await host.waitForFunction(()=>window.settingsState===false);assert.equal(await frame.locator('.hpane-drawer').evaluate(e=>e.inert),true);assert.equal(samples.has(host),false,'Embedded work never requests standalone samples');await host.close();
 assert.deepEqual(calls,['/api/openai/v1/chat/completions','/api/openai/v1/chat/completions']);assert.deepEqual(errors,[]);
 console.log('Operation controls: lazy samples preserve pending uploads, active runs and account changes; standalone/embedded keyboard entry, forward/backward loops, Escape and all-disabled fallback passed. Local fake providers only.');
}finally{await browser.close();}
