import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.'),browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let sends=0,lastSend;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const state={campaigns:[{id:'c',name:'Ceremonial',status:'active'}],contacts:Array.from({length:10000},(_,i)=>({id:'p'+i,campaignId:'c',campaignIds:['c'],name:'Prospect '+String(i).padStart(5,'0'),email:'p'+i+'@example.com',company:'Studio '+i,phone:'',notes:'A tailored introduction',stage:'new',subject:'',body:'',source:'Sheet',verification:'valid'})),companies:[],settings:{},crm:{lastRunAt:'2026-09-27T18:00:00Z',activity:[],unmatched:[]}};
 const mailboxes=[{id:'a',email:'worldofsiyo@gmail.com'},{id:'b',email:'fromsa@manasiyo.com'}];
 await page.addInitScript(()=>localStorage.setItem('maya_admin_tok','fixture'));
 await page.route('**/*',async route=>{const u=new URL(route.request().url()); if(process.env.MAYA_FONT_DIR && u.hostname==='fonts.googleapis.com'){
 const fonts=[['Jost','normal',400],['Jost','normal',500],['Jost','normal',600],['CormorantGaramond','normal',300],['CormorantGaramond','normal',400],['CormorantGaramond','normal',500],['CormorantGaramond','normal',600],['CormorantGaramond','italic',300],['CormorantGaramond','italic',400]];
 return route.fulfill({contentType:'text/css',body:fonts.map(([family,style,weight])=>`@font-face{font-family:'${family==='Jost'?'Jost':'Cormorant Garamond'}';font-style:${style};font-weight:${weight};src:url('https://maya.test/__fonts/${family}-${style}-${weight}.ttf')}`).join('\n')});}
 if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/__fonts/') && process.env.MAYA_FONT_DIR)return route.fulfill({body:readFileSync(join(process.env.MAYA_FONT_DIR,u.pathname.split('/').pop())),contentType:'font/ttf'});

  if(u.pathname==='/api/admin/ai-meter')return route.fulfill({json:{ok:true,spentUsd:.12,reservedUsd:.03,limitUsd:1,scope:'Outbound AI',models:[{provider:'openai',model:'gpt-5-nano',connected:true},{provider:'anthropic',model:'claude-haiku-4-5',connected:false},{provider:'gemini',model:'gemini-2.5-flash-lite',connected:true}],providers:{openai:.1,gemini:.02}}});
  if(u.pathname.endsWith('/intelligence'))return route.fulfill({json:{ok:true,mailboxes,crm:state.crm,gmailReady:true,schedulerReady:true}});
  if(u.pathname.endsWith('/send')){sends++;lastSend=route.request().postDataJSON();return route.fulfill({json:{ok:true,state,delivery:{status:'sent'}}});}
  if(u.pathname.endsWith('/save')){const b=route.request().postDataJSON(),p=state.contacts.find(p=>p.id===b.id);if(p)Object.assign(p,b);return route.fulfill({json:{ok:true,state}});}
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,state,accountId:'owner',capabilities:{sending:true,sheets:true}}});
  const path=u.pathname==='/outbound.html'?'/backend/outbound.html':u.pathname;try{return route.fulfill({body:readFileSync(root+path),contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[extname(path)]||'text/plain'});}catch{return route.abort();}
 });
 const start=Date.now();await page.goto('https://maya.test/outbound.html');await page.locator('[data-person]').first().waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.people-table tbody tr').count(),50);assert.ok(Date.now()-start<10000,'10k fixture becomes usable promptly');
 await page.locator('#next-page').click();assert.equal(await page.locator('[data-person]').first().textContent(),'Prospect 00050');
 await page.locator('#master-list').click();assert.equal(await page.locator('.people-table tbody tr').count(),50);
 await page.locator('[data-person]').first().click();await page.locator('#mail-sender option').nth(1).waitFor({state:'attached'});assert.equal(await page.locator('#mail-sender option').count(),2);
 await page.locator('#sample-email').click();await page.locator('[name=name]').fill('Alex');await page.locator('[name=company]').fill('Example');await page.locator('[name=offer]').fill('A small capsule collection');await page.locator('#modal-submit').click();
 assert.match(await page.locator('#body').inputValue(),/Hi Alex,\n\n/);assert.doesNotMatch(await page.locator('#body').inputValue(),/\{\{/);
 await page.locator('#mail-sender').selectOption('b');await page.locator('#send-email').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Email sent'));assert.equal(sends,1);assert.equal(lastSend.mailboxId,'b');assert.equal(lastSend.confirm,true);
 for(const width of [320,390,650,768,1024,1440,1920]){
  await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No overflow at '+width);
  await page.locator('#menu-toggle').click();await page.locator('.ai-meter-value').waitFor();await page.locator('.ai-meter-refresh').click();await page.waitForFunction(()=>document.querySelector('.ai-meter-value').textContent==='$0.120');
  assert.equal(await page.locator('.ai-meter-providers li').count(),3);const bounds=await page.locator('#outbound-drawer').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#menu-toggle').click();await page.screenshot({path:'/private/tmp/maya-outbound-intelligence.png'});
 assert.deepEqual(errors,[]);console.log('10,000-contact pagination, two senders, sample personalization, reviewed send, AI meter and seven responsive widths passed.');
}finally{await browser.close();}
