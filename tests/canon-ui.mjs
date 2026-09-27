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
 const result=await page.evaluate(()=>{
  const box=document.createElement('div');box.innerHTML='<div class="stat"><strong>12,345</strong></div><button class="pill">Maya action</button><table><tbody><tr><td>Data 12,345</td></tr></tbody></table>';document.body.append(box);
  const metric=getComputedStyle(box.querySelector('strong')),button=getComputedStyle(box.querySelector('button')),data=getComputedStyle(box.querySelector('td'));
  const out={family:metric.fontFamily,weight:metric.fontWeight,numeric:metric.fontVariantNumeric,data:data.fontFamily,border:button.borderTopWidth,radius:button.borderRadius,fill:button.backgroundImage};box.remove();return out;
 });
 assert.match(result.family,/Jost/,path);assert.equal(result.weight,'500',path);assert.equal(result.numeric,'tabular-nums',path);assert.match(result.data,/Jost/,path);assert.equal(result.radius,'100px',path);assert.equal(result.fill,'none',path);
 await page.evaluate(()=>{document.querySelectorAll('#gate,#auth-gate,#signin-panel').forEach(x=>x.style.display='none');});
 await page.screenshot({path:join(dir,path.replaceAll('/','-')+'.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('Jost')),true,path);
 await page.screenshot({path:join(dir,path.replaceAll('/','-')+'-mobile.png')});await page.setViewportSize({width:1440,height:1000});
}
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).animationName),'none');
console.log('V4 canon rendered checks: 11 pages, desktop/mobile, metric typography, capsule styles and reduced motion passed');
}finally{await browser.close();}
