import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
import {createTextAutomations,DEFAULT_TEXT_AUTOMATIONS} from '../docs/server/text-automations.mjs';

let output='Hi {name}, thanks for your interest in {context}. Shall we talk?',calls=0,seen;
const examples=createTextAutomations({read:async()=>{throw Error('Examples must not read private contacts');},write:async()=>{throw Error('Examples must not save');},complete:async(uid,instructions,data)=>{calls++;seen={uid,instructions,data};return {text:JSON.stringify({text:output})};}});
await assert.rejects(examples.example('',{stage:'first'}),/Owner account/);
await assert.rejects(examples.example('owner',{stage:'third'}),/Choose/);assert.equal(calls,0);
assert.equal((await examples.example('owner',{stage:'first',previous:'Hi {name}'})).text,output);assert.equal(seen.uid,'owner');assert.equal(seen.data.previous,'Hi {name}');
await examples.example('owner',{stage:'second',firstText:'Hello {name}',previous:'Earlier example'});assert.equal(seen.data.firstText,'Hello {name}');
await assert.rejects(examples.example('owner',{stage:'first',previous:output}),/unchanged/);
for(const invalid of ['Invented real contact','Hi {name} at {phone}','Hi {name} '+ 'x'.repeat(600)]){output=invalid;await assert.rejects(examples.example('owner',{stage:'first'}),/No usable example/);}

const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],requests=[];let nextExample=null,nextSave=null,failExample=false,failSettings=false;let persisted=structuredClone(DEFAULT_TEXT_AUTOMATIONS);
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{window.setInterval=()=>0;});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='maya.test')return route.abort();
 if(url.pathname.startsWith('/api/')){
  if(req.method()==='POST')requests.push({path:url.pathname,body:req.postDataJSON(),auth:req.headers().authorization});
  if(url.pathname==='/api/admin/text-automations/example'){
   const body=req.postDataJSON();if(nextExample){const pending=nextExample;nextExample=null;await pending;}
   return route.fulfill({status:failExample?503:200,json:failExample?{error:'Fixture provider unavailable.'}:{ok:true,stage:body.stage,text:'Hi {name}, alternate example '+requests.length+'.'}});
  }
  if(url.pathname==='/api/admin/text-automations'){
   if(req.method()==='POST'){const snapshot=req.postDataJSON();if(nextSave){const pending=nextSave;nextSave=null;await pending;}persisted=structuredClone(snapshot);return route.fulfill({json:{ok:true,settings:persisted}});}
   return route.fulfill({status:failSettings?503:200,json:failSettings?{error:'Fixture settings unavailable.'}:{ok:true,settings:structuredClone(persisted)}});
  }
  if(url.pathname==='/api/admin/maya-features')return route.fulfill({json:{ok:true,items:[{id:'example',who:'Owner',text:'A reviewed feature request',ts:'2026-10-08',source:'admin'}]}});
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const open=()=>page.evaluate(()=>{_idTok='fixture-a';toggleDrawer(true);admTab('automations');});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);await open();
 await page.locator('#automation-first-text').waitFor({state:'visible'});
 assert.equal(requests.length,0,'Opening rules generates and sends nothing');
 await page.locator('#automation-first-text').fill('My reviewed draft');await page.evaluate(()=>{admTab('systems');admTab('automations');});
 assert.equal(await page.locator('#automation-first-text').inputValue(),'My reviewed draft','Reopening retains an edited draft');
 await page.locator('#automation-first-example').click();await page.waitForFunction(()=>document.getElementById('automation-first-example-status').textContent.includes('Example ready'));
 const first=await page.locator('#automation-first-text').inputValue();await page.locator('#automation-first-refresh').click();await page.waitForFunction(()=>!document.getElementById('automation-first-refresh').disabled);
 assert.notEqual(await page.locator('#automation-first-text').inputValue(),first);assert.equal(requests[1].body.previous,first);
 const retained=await page.locator('#automation-first-text').inputValue();failExample=true;await page.locator('#automation-first-example').click();await page.waitForFunction(()=>!document.getElementById('automation-first-example').disabled);failExample=false;
 assert.equal(await page.locator('#automation-first-text').inputValue(),retained);assert.match(await page.locator('#automation-first-example-status').innerText(),/unavailable/);
 let release;nextExample=new Promise(resolve=>release=resolve);await page.locator('#automation-first-example').click();await page.waitForFunction(()=>document.getElementById('automation-first-example').disabled);
 await page.locator('#automation-first-text').fill('Typed while generation was pending');release();await page.waitForFunction(()=>!document.getElementById('automation-first-example').disabled);
 assert.equal(await page.locator('#automation-first-text').inputValue(),'Typed while generation was pending');
 const secondBefore=await page.locator('#automation-second-text').inputValue();nextExample=new Promise(resolve=>release=resolve);await page.locator('#automation-second-example').click();await page.waitForFunction(()=>document.getElementById('automation-second-example').disabled);
 await page.locator('#automation-first-text').fill('Changed first text during follow-up generation');release();await page.waitForFunction(()=>!document.getElementById('automation-second-example').disabled);assert.equal(await page.locator('#automation-second-text').inputValue(),secondBefore,'Changed first-text context invalidates a follow-up example');
 nextExample=new Promise(resolve=>release=resolve);await page.locator('#automation-second-example').click();await page.waitForFunction(()=>document.getElementById('automation-second-example').disabled);
 await page.evaluate(()=>{for(const token of ['fixture-b','fixture-a']){_idTok=token;++_adminSession;window.dispatchEvent(new Event('maya-owner-session-changed'));}admTab('automations');});
 await page.locator('#automation-first-text').waitFor({state:'visible'});release();await page.waitForTimeout(20);
 assert.equal(await page.locator('#automation-second-text').inputValue(),DEFAULT_TEXT_AUTOMATIONS.second.text,'A to B to A rejects the earlier example');
 await page.locator('#automation-save').click();await page.waitForFunction(()=>document.getElementById('automation-status').textContent.startsWith('Saved.'));
 // Save acknowledges only its captured snapshot, in either completion order.
 let releaseExample,releaseSave;
 const beforeRace=await page.locator('#automation-first-text').inputValue();
 nextExample=new Promise(resolve=>releaseExample=resolve);await page.locator('#automation-first-example').click();
 nextSave=new Promise(resolve=>releaseSave=resolve);await page.locator('#automation-save').click();await page.waitForFunction(()=>document.getElementById('automation-save').disabled);
 releaseExample();await page.waitForFunction(()=>!document.getElementById('automation-first-example').disabled);releaseSave();await page.waitForFunction(()=>!document.getElementById('automation-save').disabled);
 assert.equal(persisted.first.text,beforeRace);assert.notEqual(await page.locator('#automation-first-text').inputValue(),beforeRace);assert.match(await page.locator('#automation-status').innerText(),/unsaved/i,'A later Save acknowledgement cannot claim the new example was saved');
 await page.locator('#automation-save').click();await page.waitForFunction(()=>!document.getElementById('automation-save').disabled);
 nextSave=new Promise(resolve=>releaseSave=resolve);await page.locator('#automation-save').click();
 nextExample=new Promise(resolve=>releaseExample=resolve);await page.locator('#automation-first-example').click();releaseSave();await page.waitForFunction(()=>!document.getElementById('automation-save').disabled);releaseExample();await page.waitForFunction(()=>!document.getElementById('automation-first-example').disabled);
 assert.match(await page.locator('#automation-status').innerText(),/unsaved/i,'A later example remains unsaved after an earlier Save');
 nextSave=new Promise(resolve=>releaseSave=resolve);await page.locator('#automation-save').click();await page.locator('#automation-first-text').fill('Hi {name}, manually reviewed while saving.');releaseSave();await page.waitForFunction(()=>!document.getElementById('automation-save').disabled);
 assert.match(await page.locator('#automation-status').innerText(),/unsaved/i);assert.equal(await page.locator('#automation-first-text').inputValue(),'Hi {name}, manually reviewed while saving.');
 assert.ok(requests.every(r=>['/api/admin/text-automations/example','/api/admin/text-automations'].includes(r.path)),'Only explicit rule/example requests occur; no send endpoint');
 await page.evaluate(async()=>{document.getElementById('features-fold').open=true;await loadFeatureRequests();});
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>admTab('systems'));
  const row=await page.locator('.systems-tools').evaluate(e=>[...e.children].map(x=>{const r=x.getBoundingClientRect();return {y:r.y,center:r.y+r.height/2};}));assert.ok(Math.abs(row[0].center-row[1].center)<2,'Systems tools share a row at '+width);
  await page.evaluate(()=>admTab('automations'));
  assert.ok(await page.locator('#drawer-automations').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No Automations overflow '+width);
  for(const stage of ['first','second'])assert.ok(await page.locator('#automation-'+stage+'-time').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.automation-timing').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2;}),'Time centered '+stage+' '+width);
  assert.ok(await page.locator('#automation-save').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2;}),'Save centered '+width);
 }
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.inner,{paddingX:23,paddingY:17,background:'green',fill:65});d.layoutSpacing={labelGap:13,fieldGap:21,drawerDockInset:2};for(const role of ['H2','H3','P1','P3'])Object.assign(d.type[role],{font:'cormorant',weight:500,color:'white'});MayaTypographyControls.apply(d);});
 for(const selector of ['.fr'])assert.deepEqual(await page.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return [s.paddingLeft,s.paddingTop,s.backgroundColor];}),['23px','17px','rgba(23, 91, 59, 0.65)'],selector+' shared Inner');
 for(const selector of ['.fr .who','.fr .ask','.fr-sec'])assert.match(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).fontFamily),/Cormorant/,selector+' shared role');
 assert.equal(await page.locator('.automation-timing').first().evaluate(e=>getComputedStyle(e).rowGap),'21px','Saved field spacing');
 await page.evaluate(()=>admTab('logs'));assert.equal(await page.locator('#adm-tabtitle').evaluate(e=>getComputedStyle(e).textAlign),'center','Logs heading centered by default');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H2.align='right';MayaTypographyControls.apply(d);});assert.equal(await page.locator('#adm-tabtitle').evaluate(e=>getComputedStyle(e).textAlign),'right','Saved H2 alignment remains authoritative');
 // The live dock, not just the gallery sample, obeys the saved inset.
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});const gaps=[];
  for(const inset of [0,32]){await page.evaluate(inset=>{const d=structuredClone(MayaTypographyControls.defaults);d.layoutSpacing.drawerDockInset=inset;MayaTypographyControls.apply(d);},inset);gaps.push(await page.locator('#voice-dock').evaluate(e=>e.closest('#drawer').getBoundingClientRect().bottom-e.getBoundingClientRect().bottom));}
  assert.ok(Math.abs(gaps[1]-gaps[0]-32)<1,'Actual dock inset applies at '+width);
  await page.evaluate(()=>toggleDrawer(false));
  for(const large of [false,true]){
   await page.evaluate(large=>{const d=structuredClone(MayaTypographyControls.defaults);if(large){Object.assign(d.inner,{paddingX:23,paddingY:23});for(const [role,size]of Object.entries({H1:32,H2:30,H3:24,H4:20,P1:18,P2:18,P3:16}))d.type[role].size=size;}MayaTypographyControls.apply(d);},large);
   assert.ok(await page.locator('.fr .ask').first().evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.fr').querySelector('.when').getBoundingClientRect();return a.width>=80&&(a.top>=b.bottom||a.right<=b.left);}),`Request text has readable independent space ${width} large=${large}`);
  }
  await page.evaluate(()=>toggleDrawer(true));
 }
 // A failed fresh settings load must expose its error, not blank editable rules.
 failSettings=true;await page.evaluate(()=>{++_adminSession;window.dispatchEvent(new Event('maya-owner-session-changed'));admTab('automations');});await page.waitForFunction(()=>document.getElementById('automation-status').textContent.includes('unavailable'));
 assert.equal(await page.locator('#text-automations-form').isVisible(),false);assert.equal(await page.locator('#text-automations-form').evaluate(e=>getComputedStyle(e).display),'none');
 failSettings=false;await page.evaluate(()=>loadTextAutomations());await page.locator('#text-automations-form').waitFor({state:'visible'});
 if(process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT){await page.evaluate(()=>{MayaTypographyControls.apply(MayaTypographyControls.defaults);admTab('automations');});await page.setViewportSize({width:1440,height:900});await page.locator('#drawer-automations').evaluate(e=>e.scrollTop=0);await page.locator('#drawer').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-desktop.png'});await page.setViewportSize({width:390,height:900});await page.locator('#drawer').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-phone.png'});await page.locator('#drawer-automations').evaluate(e=>e.scrollTop=e.scrollHeight);await page.locator('#drawer').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-save.png'});await page.evaluate(()=>admTab('systems'));await page.locator('#drawer').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-systems.png'});await page.evaluate(()=>admTab('logs'));await page.locator('#drawer').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-logs.png'});await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{toggleDrawer(false);const h=document.getElementById('adm-hscroll');h.style.scrollSnapType='none';h.scrollTo({left:0,behavior:'instant'});document.getElementById('features-fold').scrollIntoView({behavior:'instant'});});await page.waitForFunction(()=>document.getElementById('adm-hscroll').scrollLeft===0);await page.locator('#features-fold').screenshot({path:process.env.MAYA_ADMIN_EXAMPLES_SCREENSHOT+'-features.png'});}
 assert.deepEqual(errors,[]);console.log('Admin automation examples: fake AI validation, explicit generation, edited drafts, stale accounts, save-only behavior and responsive shared controls passed.');
}catch(error){console.error('Admin fixture page errors:',errors);throw error;}finally{await browser.close();}
