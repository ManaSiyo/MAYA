// Owner standard: the served Global gallery must match In House, not a chat UI.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve('.'),browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000}});
const png=readFileSync('aesthetics/ui/logo-circle.png'),reference='data:image/png;base64,'+png.toString('base64');
const catalog=JSON.parse(readFileSync('aesthetics/fabrics/fabrics.json')).items;
const products=catalog.map((p,i)=>({url:'https://cloth.example/products/fabric-'+i,title:p.name,image:'https://photos.example/'+i+'.png',merchant:'cloth.example',evidence:'web_suggestion'}));
const token='fixture.'+Buffer.from(JSON.stringify({sub:'gallery-owner',exp:4000000000})).toString('base64url')+'.fixture';
let saved={},calls=0,failed=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(token=>{if(location.origin==='https://maya-gallery.test')localStorage.setItem('maya_admin_tok',token);window.setInterval=()=>0;},token);
await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='photos.example')return failed?route.fulfill({status:404,body:'Unavailable fixture photograph'}):route.fulfill({body:readFileSync(resolve(root,'aesthetics/fabrics',catalog[Number(u.pathname.split('/').pop().split('.')[0])].thumbnail)),contentType:'image/jpeg'});
 if(u.hostname!=='maya-gallery.test')return route.abort();
 if(u.pathname==='/api/design')return route.fulfill({json:saved});
 if(u.pathname==='/api/admin/design'){saved=route.request().postDataJSON();assert.ok(validDesign(saved));return route.fulfill({json:{ok:true,savedAt:'2026-11-04'}});}
 if(u.pathname==='/api/admin/fabrics/search'){calls++;return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'done',products:products.map(p=>({...p,image:p.image+(failed?'?failure=1':'')})),observation:'Long interpretation must stay outside the photo layout.',message:'Fabric photographs.',searchDetails:{query:'Green apparel fabric',observation:'Qualified reference interpretation.'}})+'\n'});}
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],generation:'0'}});
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+decodeURIComponent(u.pathname))),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.JPG':'image/jpeg'})[extname(u.pathname)]||'text/plain'});}catch{return route.abort();}
});
const tab=name=>page.locator('.fa-tabs').getByRole('button',{name,exact:true});
const measure=()=>page.locator('#fabric-assistant').evaluate(root=>{
 const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,top:r.top,left:r.left,overflowX:s.overflowX,overflowY:s.overflowY,columns:s.gridTemplateColumns,rows:s.gridTemplateRows,gap:s.gap,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,pad:[s.paddingLeft,s.paddingTop],material:s.backgroundColor,fit:s.objectFit};};
 const first=root.querySelector('.fa-product:not([hidden])');return {body:rect(root.querySelector('.fa-body')),grid:rect(root.querySelector('.fa-results')),card:rect(first),photo:rect(first.querySelector('img')),title:rect(first.querySelector('.fa-card-title')),caption:rect(first.querySelector('.fa-card-caption')),controls:[...root.querySelectorAll('button,textarea')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height).map(el=>el.textContent||el.getAttribute('aria-label'))};
});
try{
 await page.goto('https://maya-gallery.test/backend/backend.html');await page.waitForFunction(()=>window.MayaFabricAssistant&&window.MayaTypographyControls);
 await page.evaluate(reference=>{const pieces=[{id:'coat',name:'Coat',fabric:'Green fabric',_image:reference}];window._openedSubmission={id:'gallery-project'};window._currentSnap={lastSummary:{}};window._dissectTarget={hero:reference,card:{_dissection:{pieces}}};renderDissection({card:{image:reference,_dissection:{pieces}}});_publishSavedOperations({pieces});},reference);
 await page.locator('#brief-fabrics-button').click();
 await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const design of ['default','saved']){
  if(design==='saved')await page.evaluate(async()=>{const d=structuredClone(MayaTypographyControls.defaults);d.type.H1.size=32;d.type.H2.size=28;d.type.H3.size=24;d.type.P1.size=16;d.type.P2.size=16;Object.assign(d.type.H4,{font:'cormorant',size:20,weight:450,color:'gray'});Object.assign(d.type.P3,{size:14,color:'white'});Object.assign(d.inner,{paddingX:19,paddingY:13,background:'green',fill:65});d.pillX=18;d.pillY=9;await MayaTypographyControls.save(d);});
  for(const mode of ['inline','expanded']){
   if(mode==='expanded')await page.getByRole('button',{name:'Expand',exact:true}).click();
   for(const width of [320,390,768,1024,1440,1920]){
    await page.setViewportSize({width,height:1000});await tab('In House').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());
    await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const local=await measure();
    await tab('Global').click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);const global=await measure();
    assert.deepEqual(global,local,design+' '+mode+' '+width+': Global must have exactly the In House geometry, roles, materials, controls and scroll containers');
    if(design==='saved'){assert.equal(global.title.size,'20px');assert.equal(global.caption.size,'14px');assert.deepEqual(global.card.pad,['19px','13px']);assert.equal(global.card.material,'rgba(23, 91, 59, 0.65)');}
    assert.equal(await page.locator('.fa-composer').isVisible(),false);assert.equal(await page.locator('.fa-observation').isVisible(),false);
    assert.deepEqual(global.controls,['In House','Global','Favorites','Refresh fabrics',mode==='inline'?'Expand':'Collapse']);
    assert.ok(global.title.height<=(parseFloat(global.title.line)||parseFloat(global.title.size)*1.5)+1);assert.ok(global.caption.height<=(parseFloat(global.caption.line)||parseFloat(global.caption.size)*1.5)+1);
    await page.locator('.fa-results').evaluate(el=>el.scrollTop=190);const globalScroll=await page.locator('.fa-results').evaluate(el=>el.scrollTop);await tab('In House').click();await page.locator('.fa-results').evaluate(el=>el.scrollTop=190);assert.equal(await page.locator('.fa-results').evaluate(el=>el.scrollTop),globalScroll);
    if(mode==='inline'&&(width===390||width===1440)){await page.locator('.fa-results').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'/private/tmp/maya-inhouse-'+design+'-'+width+'.png'});await tab('Global').click();await page.screenshot({path:'/private/tmp/maya-global-'+design+'-'+width+'.png'});}
   }
   if(mode==='expanded')await page.getByRole('button',{name:'Collapse',exact:true}).click();
  }
 }
 assert.equal(calls,1,'Comparing gallery views never repeats paid search');
 // Failed photos cannot replace the gallery with Photo unavailable text tiles.
 failed=true;await tab('Global').click();await page.evaluate(reference=>MayaFabricAssistant.open({host:document.getElementById('brief-fabrics'),submissionId:'gallery-project',referenceImage:reference,automatic:true,forceReset:true,piece:{id:'coat',name:'Coat'},pieces:[{id:'coat',name:'Coat'}]}),reference);
 await page.getByText('No fabric photographs loaded. Refresh to retry.',{exact:true}).waitFor();assert.equal(await page.locator('.fa-product:visible').count(),0);assert.equal(await page.getByText('Photo unavailable',{exact:true}).filter({visible:true}).count(),0);assert.equal(calls,2,'Failures do not retry the provider automatically');
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const empty=page.getByText('No fabric photographs loaded. Refresh to retry.',{exact:true});assert.equal(await empty.getAttribute('data-maya-type'),'P1');assert.equal(await empty.evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.ok(await empty.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));}
 failed=false;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-product-image').first().evaluate(image=>image.decode());assert.equal(await page.locator('.fa-product:visible').count(),8);assert.equal(calls,3);
 await page.goto('https://maya-gallery.test/aesthetics/aesthetic-control.html');await page.locator('#workspace-previews > summary').click();
 assert.equal(await page.locator('#workspace-previews textarea,#workspace-previews .fa-composer').count(),0,'Aesthetic Control cannot restore the unrequested composer');
 const preview=page.locator('#workspace-previews');await preview.locator('.fa-product-image').first().evaluate(image=>image.decode());
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});const rect=()=>preview.locator('.fa-results').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,rows:getComputedStyle(el).gridTemplateRows,cards:[...el.children].map(c=>[c.clientWidth,c.clientHeight,c.querySelector('img').clientHeight])}));await preview.getByRole('button',{name:'In House',exact:true}).click();const local=await rect();await preview.getByRole('button',{name:'Global',exact:true}).click();assert.deepEqual(await rect(),local);}
 assert.equal(calls,3,'Aesthetic previews make no searches');assert.deepEqual(errors,[]);
 console.log('Fabric gallery: exact In House/Global parity, two caption rows, same scrolling, default/saved settings, six widths, photo failure/recovery and active preview passed.');
}catch(error){console.error(error);console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'/private/tmp/maya-global-gallery-failure.png'});throw error;}finally{await browser.close();}
