// Real Admin markup; all auth, data, images and navigation stay in this fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),errors=[];
let savedDesign=null;
const token='fixture.'+Buffer.from(JSON.stringify({sub:'retirement-owner',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
const submission={id:'fixture/submission-A',name:'aria & silk-10-18-2026',createdTime:'2026-10-18T12:00:00Z',files:[{id:'fixture-image-A',name:'dream-garment.png',mime:'image/png'}]};
await page.addInitScript(()=>{window.setInterval=()=>0;window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){}}}};});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());if(url.hostname!=='maya-retirement.test')return route.abort();
 if(url.pathname==='/api/admin/submissions')return route.fulfill({json:{ok:true,total:1,folders:[submission]}});
 if(url.pathname==='/api/admin/subthumb')return route.fulfill({body:readFileSync(resolve(root,'aesthetics/ui/logo-circle.png')),contentType:'image/png'});
 if(url.pathname==='/api/admin/design'&&request.method()==='POST'){savedDesign=request.postDataJSON();assert.ok(validDesign(savedDesign));return route.fulfill({json:{ok:true}});}
 if(url.pathname==='/api/design')return route.fulfill({json:savedDesign||{}});
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,connected:true,list:[],leads:{connected:true,list:[]},folders:[],threads:[],items:[],models:[],notes:[],briefing:[],attention:[],ranges:{},accounts:{total:0}}});
 if(url.pathname==='/backend.html')return route.fulfill({body:'<!doctype html><title>Fixture Brief destination</title>',contentType:'text/html'});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya-retirement.test/backend/status.html');await page.waitForFunction(()=>typeof loadSubmissions==='function'&&window.MayaTypographyControls);
 await page.evaluate(async token=>{await MayaTypographyControls.ready;_adoptToken(token);await loadSubmissions();},token);
 const tile=page.getByRole('link',{name:'Open Brief for Aria & silk',exact:true});await tile.waitFor();
 await page.waitForFunction(()=>document.querySelector('.sub-tile img')?.naturalWidth>0);
 assert.equal(await page.locator('a[href*="playground"],a[href*="affiliates"],#affiliate-profile').count(),0,'Admin has no retired workspace navigation or profile');
 for(const saved of [false,true]){
  if(saved)await page.evaluate(()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H1.size=32;d.type.H2.size=28;Object.assign(d.type.H3,{font:'cormorant',size:24,weight:500,style:'italic',color:'gray'});d.sectionSpacing={...d.sectionSpacing,submissions:48,headingGap:26};return MayaTypographyControls.save(d);});
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});await tile.scrollIntoViewIfNeeded();await tile.hover();
   assert.equal(await tile.getAttribute('title'),null,'No native metadata tooltip');assert.equal(await tile.locator('.veil,.nm,.tm').count(),0,'No metadata overlay at '+width);assert.equal(await tile.innerText(),'','Hover adds no submission name/date text');
   await tile.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
   const focus=await tile.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {focused:document.activeElement===el,visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
   assert.ok(focus.focused&&focus.visible&&focus.outline!=='none'&&focus.width>0,`${saved?'saved':'default'} ${width}: keyboard focus remains visible: ${JSON.stringify(focus)}`);
   assert.ok(focus.right>0&&focus.left<width&&focus.bottom>0&&focus.top<900,'Focused submission remains in the scroll viewport');
   assert.equal(await page.locator('#adm-scroll').evaluate(el=>el.scrollLeft),0,'Focusing a submission never pans the whole Admin page horizontally at '+width);
   assert.ok(focus.right-focus.left<=width-48,'Submission fits its phone viewport, with room for the focus outline');
   assert.equal(await page.locator('#submissions-heading').evaluate(el=>getComputedStyle(el).fontSize),saved?'24px':'16px','Surrounding shared H3 applies');
   if(width===390||width===1440)await page.screenshot({path:`/private/tmp/maya-retired-submissions-${saved?'saved':'default'}-${width}.png`});
  }
 }
 // Both input paths follow the real link and preserve submission/image identity.
 for(const input of ['keyboard','pointer']){
  const opened=context.waitForEvent('page');if(input==='keyboard')await page.keyboard.press('Enter');else await tile.click();const brief=await opened;await brief.waitForLoadState();const destination=new URL(brief.url());
  assert.equal(destination.pathname,'/backend.html');assert.equal(destination.searchParams.get('submission'),submission.id);assert.equal(destination.searchParams.get('name'),submission.name);assert.equal(destination.searchParams.get('img'),submission.files[0].id);await brief.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Retired workspace UI passed: actual Admin navigation, clean submission hover, named keyboard links and scoped Brief navigation, default/saved shared styles at six widths.');
}finally{await browser.close();}
