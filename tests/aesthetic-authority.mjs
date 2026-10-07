import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.fixtureRecognition=[];class Recognition{constructor(){window.fixtureRecognition.push(this);}start(){}abort(){this.aborted=true;}}window.SpeechRecognition=Recognition;});
await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/admin/text-automations'&&req.method()==='GET')return route.fulfill({json:{ok:true,settings:{first:{enabled:true,text:'Hi {name}',trigger:'new_lead',time:'10:00'},second:{enabled:false,text:'Hi {name}',trigger:'no_reply',time:'10:00',days:3}}}});
  if(req.method()==='POST'){writes.push({path:u.pathname,body:req.postDataJSON(),auth:req.headers().authorization});return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{ok:true,connected:true,threads:[]}});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+u.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(u.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);
 await page.evaluate(()=>{_idTok='fixture';toggleDrawer(true);admTab('automations');});await page.locator('#automation-first-text').waitFor({state:'visible'});
 await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0;});
 const snapshot=()=>page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#drawer-automations [data-maya-type],#adm-tabtitle')].map((e,i)=>{const s=getComputedStyle(e);return [e.id||`node-${i}`,{role:e.dataset.mayaType,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,case:s.textTransform,style:s.fontStyle,paddingX:s.paddingLeft,paddingY:s.paddingTop,background:s.backgroundColor}]})));
 if(process.env.MAYA_AESTHETIC_SCREENSHOT)await page.screenshot({path:process.env.MAYA_AESTHETIC_SCREENSHOT});
 const before=await snapshot();
 assert.equal(before['automation-first-text'].size,'12px');
 assert.equal(before['automation-first-text'].weight,'300');
 assert.equal(before['automation-first-trigger'].paddingX,'8px');
 await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);for(const role of ['H2','H3','P1','P3'])Object.assign(d.type[role],{font:'cormorant',size:({H2:22,H3:18,P1:12,P3:10})[role],weight:500,color:role==='P1'?'white':'gray',case:role==='P3'?'none':'uppercase',style:'italic'});Object.assign(d.inner,{paddingX:23,paddingY:17,background:'green',fill:65,blur:13,saturation:140});Object.assign(d.editor,{paddingX:19,paddingY:11,background:'green',fill:70,borderColor:'gray',rim:73,radius:16});MayaTypographyControls.apply(d);});
 const after=await snapshot();
 for(const [id,s] of Object.entries(after)){
  assert.match(s.font,/Cormorant/,id+' font');assert.equal(s.size,({H2:'22px',H3:'18px',P1:'12px',P3:'10px'})[s.role],id+' size');assert.equal(s.weight,'500',id+' weight');assert.equal(s.case,s.role==='P3'?'none':'uppercase',id+' case');assert.equal(s.style,'italic',id+' italic');assert.notEqual(s.color,before[id].color,id+' color');
 }
 for(const id of ['automation-first-text','automation-first-trigger','automation-first-time','automation-second-days']){
  assert.equal(after[id].paddingX,'19px',id+' X padding');assert.equal(after[id].paddingY,'11px',id+' Y padding');assert.equal(after[id].background,'rgba(23, 91, 59, 0.7)',id+' backing');
 }
 assert.deepEqual(await page.locator('.automation-rule').first().evaluate(e=>{const s=getComputedStyle(e);return [s.paddingLeft,s.paddingTop,s.backgroundColor,s.backdropFilter]}),['23px','17px','rgba(23, 91, 59, 0.65)','blur(13px) saturate(1.4)']);
 assert.deepEqual(await page.locator('#automation-first-trigger').evaluate(e=>{const s=getComputedStyle(e);return [s.borderTopColor,s.borderRadius,s.backgroundImage.includes('svg')]}),['rgba(170, 181, 196, 0.73)','16px',true]);
 assert.equal(await page.locator('#drawer-automations').evaluate(e=>[...e.querySelectorAll('h3,p,label,button,textarea,select,input:not([type=checkbox])')].filter(n=>!n.dataset.mayaType).length),0,'All Automations text and controls have an explicit shared role');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.right<=innerWidth+1&&r.left>=0;});
  assert.ok(await page.locator('#drawer-automations').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Automations overflow at '+width);
 }
 assert.deepEqual(errors,[]);assert.equal(writes.length,0,'Style verification must not submit messages or rules');
 console.log('Aesthetic authority passed: Automations roles, saved colors/fonts/material/X-Y padding and six viewport widths.');
}finally{await browser.close();}
