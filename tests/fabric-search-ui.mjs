// Real pages, isolated Chromium, fake providers. Never opens a personal Chrome profile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve('.');
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM || process.env.CHROMIUM_PATH});
const png=readFileSync(root+'/aesthetics/ui/logo-circle.png');
const product={url:'https://britexfabrics.com/products/crimson-wool',merchant:'Britex Fabrics',place:'San Francisco',title:'Crimson wool twill',image:'https://cdn.shopify.com/fabric.jpg',description:'100% wool. Sold by the yard.',composition:'100% wool',price:'69.99',currency:'USD',unit:'yard',availability:'in_stock',evidence:'seller_listing',checkedAt:'2026-10-07T00:00:00Z',reason:'May suit the matte wool request.'};
const reference='data:image/png;base64,'+png.toString('base64');
const pieces=[{name:'Crimson coat',fabric:'Crimson wool twill',fabric_spec:{fiber:'wool',weave:'twill'},_image:reference},{name:'White shirt',fabric:'White cotton poplin',_image:reference},{name:'Black leather boots',category:'footwear',fabric:'Black leather',_image:reference}];
let savedDesign={};const designWrites=[];
const requests=[],books=new Map();let delayed=null,delayNext=false,failNext=false;
const jwt=sub=>'test.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(t=>localStorage.setItem('maya_admin_tok',t),jwt('owner-A'));
await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='cdn.shopify.com')return route.fulfill({body:png,contentType:'image/png'});
  if(u.hostname!=='maya-fabric.test')return route.abort();
  const body=route.request().postDataJSON?.();
  if(u.pathname==='/api/design')return route.fulfill({json:savedDesign});
  if(u.pathname==='/api/admin/design'){assert.ok(validDesign(body),'Saved design is server-valid');designWrites.push(body);savedDesign=structuredClone(body);return route.fulfill({json:{ok:true,savedAt:'2026-10-08T00:00:00Z'}});}
  if(u.pathname==='/api/admin/fabrics/search'){
    requests.push(body);
    if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Search temporarily unavailable.'}});}
    const complete=()=>route.fulfill({contentType:'application/x-ndjson',body:[{type:'products',products:[{...product,garment:body.piece?.name||'Crimson coat'}],preliminary:true},{type:'done',products:[{...product,garment:body.piece?.name||'Crimson coat'}],query:'matte burgundy wool',observation:'Matte, burgundy and twill-like; fiber cannot be confirmed visually.',message:'Refine these with another message.'}].map(v=>JSON.stringify(v)).join('\n')+'\n'});
    if(delayNext){delayNext=false;delayed=complete;return;}
    return complete();
  }
  if(u.pathname==='/api/admin/fabrics/lookbook'){
    const key=route.request().headers().authorization+'|'+(body?.submissionId || u.searchParams.get('submissionId'));
    let book=books.get(key)||{items:[],selectedUrl:'',generation:'0'};
    if(body){assert.equal(body.generation,book.generation);book={items:body.action==='remove'?book.items.filter(p=>p.url!==body.product.url):[body.product,...book.items.filter(p=>p.url!==body.product.url)],selectedUrl:body.action==='select'?body.product.url:body.action==='remove'?'':book.selectedUrl,generation:String(Number(book.generation)+1)};books.set(key,book);}
    return route.fulfill({json:{ok:true,...book}});
  }
  if(u.pathname==='/api/admin/submissions')return route.fulfill({json:{folders:[{id:'project-A',files:[{id:'summary-A',name:'summary.json'},{id:'image-A',name:'dream-garment.png'},{id:'pieces-A',name:'pieces.json'}]}]}});
  if(u.pathname==='/api/admin/subfile')return u.searchParams.get('id')==='pieces-A'?route.fulfill({json:{pieces}}):u.searchParams.get('id')==='summary-A'?route.fulfill({json:{fabric_preferences:'100% wool, no polyester'}}):route.fulfill({body:png,contentType:'image/png'});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  const path=u.pathname==='/backend.html'?'/backend/backend.html':u.pathname==='/operations.html'?'/backend/operations.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+decodeURIComponent(path)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[extname(path).toLowerCase()]||'text/plain'});}catch{return route.abort();}
});
try{
  await page.goto('https://maya-fabric.test/backend.html');
  await page.waitForFunction(()=>!!window.MayaFabricAssistant);
  assert.equal(await page.locator('#brief-fabrics-button').isDisabled(),true,'Brief fabrics require a saved dissection');
  await page.evaluate(({reference,pieces})=>{
    window._openedSubmission={id:'project-A'};window._currentSnap={lastSummary:{fabric_preferences:'100% wool, no polyester'}};
    window._dissectTarget={hero:reference,card:{_dissection:{pieces}}};
    _pieceState={pieces:[{name:'Full view',_virtual:true},...pieces],idx:0,heroImage:reference};window._pieceState=_pieceState;
    _publishSavedOperations({pieces});
  },{reference,pieces});
  await page.locator('#brief-fabrics-button').click();
  await page.locator('#brief-fabrics #fabric-assistant').waitFor();
  await page.locator('.fa-card-title').filter({hasText:'Crimson wool twill'}).first().waitFor();
  assert.equal(await page.locator('#fabric-assistant-dialog').getAttribute('open'),null,'Brief opens its internal window');
  assert.equal(await page.locator('.fa-composer').isVisible(),false,'Saved look recommendations do not ask for Dictate or Find fabric');
  const automatic=requests.find(r=>r.automatic);assert.ok(automatic);assert.equal(automatic.submissionId,'project-A');assert.equal(automatic.piece.name,undefined);assert.equal(automatic.pieces.length,3);assert.match(automatic.image,/^data:image\/jpeg/);assert.equal(automatic.preferences,'100% wool, no polyester');
  assert.equal(await page.locator('.fa-card-title').count(),1);assert.match(await page.locator('.fa-card-caption').textContent(),/For Crimson coat/);
  assert.equal(await page.locator('.fa-product-link').getAttribute('href'),product.url);assert.equal(await page.locator('.fa-product-link').getAttribute('target'),'_blank');
  assert.doesNotMatch(await page.locator('.fa-results').textContent(),/arrives|in.stock|35%|selling unit|San Francisco/i,'Only two concise caption rows, without guessed facts or match percent');
  await page.locator('.fa-card-actions').getByRole('button',{name:'Use for design',exact:true}).click();
  await page.getByRole('button',{name:'Selected for design',exact:true}).waitFor();
  await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();assert.equal(await page.locator('.fa-product').count(),1);
  await page.locator('.fa-tabs').getByRole('button',{name:'In House',exact:true}).click();await page.locator('.fa-card-title').filter({hasText:'Midnight Velvet'}).waitFor();
  assert.equal(await page.locator('#brief-fabrics #fabric-assistant').count(),1,'In House stays in the same inline window');
  assert.doesNotMatch(await page.locator('.fa-results').textContent(),/in.house.*atelier|in stock|arrives/i);
  const inventoryCard=page.locator('.fa-product').filter({hasText:'Midnight Velvet'});await inventoryCard.getByRole('button',{name:'Save',exact:true}).click();
  await inventoryCard.getByRole('button',{name:'Saved',exact:true}).waitFor();
  await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();assert.match(await page.locator('.fa-results').textContent(),/Midnight Velvet/);
  await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();
  await page.getByRole('button',{name:'Filter stores',exact:true}).click();await page.locator('.fa-store-filter').selectOption('britexfabrics.com');
  await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  assert.deepEqual(requests.at(-1).stores,['britexfabrics.com']);
  for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'default inline view fits '+width);assert.ok((await page.locator('.fa-body').boundingBox()).height>=150,'Default inline results usable '+width);const field=await page.locator('.fa-store-filter').boundingBox();assert.ok(field.width>80,'default inline store field remains usable '+width+' '+JSON.stringify(field));}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/private/tmp/maya-fabrics-inline-default.png'});
  await page.locator('.fa-toolbar').getByRole('button',{name:'Expand',exact:true}).click();await page.locator('#fabric-assistant-dialog[open]').waitFor();
  const searchesBeforeResize=requests.length;
  for(const[width,height]of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});
    const bounds=await page.locator('#fabric-assistant-dialog').boundingBox();assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,`expanded view fits ${width}`);
    assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`no horizontal overflow ${width}`);
    const image=await page.locator('.fa-product-image').first().boundingBox();assert.ok(image.width>100&&image.height>60,'real fabric photos retain space');
    if(width<=390)assert.ok(image.width>180,'Expanded phone fabric photos use the available row width');
    assert.equal(await page.locator('.fa-card-title').count(),await page.locator('.fa-card-caption').count(),'two authored caption rows per fabric');
  }
  assert.equal(requests.length,searchesBeforeResize,'Expand and responsive layout never spend on another search');
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/private/tmp/maya-fabrics-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/maya-fabrics-phone.png'});
  await page.keyboard.press('Escape');await page.locator('#brief-fabrics #fabric-assistant').waitFor();assert.equal(await page.locator('#brief-fabrics #fabric-assistant').count(),1,'Escape returns the same view inline');
  assert.equal(await page.locator('.fa-store-filter').inputValue(),'britexfabrics.com','Expansion preserves store choice');
  await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();assert.equal(await page.locator('.fa-product').count(),1,'Store filter retains only saved products from that store');assert.doesNotMatch(await page.locator('.fa-results').textContent(),/Midnight Velvet/);
  await page.locator('.fa-store-filter').selectOption('');await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-card-title').filter({hasText:'Crimson wool twill'}).waitFor();
  // Actual saved authority, not merely CSS variables: all roles/materials, inline
  // and expanded at six widths, with a visible focused store control and errors.
  await page.evaluate(()=>MayaTypographyControls.ready);
  const readStyle=selector=>page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {size:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,font:s.fontFamily,background:s.backgroundColor,paddingX:parseFloat(s.paddingLeft),paddingY:parseFloat(s.paddingTop),radius:parseFloat(s.borderRadius),blur:s.backdropFilter,stroke:s.strokeWidth,width:r.width,height:r.height};});
  const defaults={heading:await readStyle('.fa-header h2'),title:await readStyle('.fa-card-title'),caption:await readStyle('.fa-card-caption'),status:await readStyle('.fa-status'),outer:await readStyle('#fabric-assistant'),inner:await readStyle('.fa-product'),field:await readStyle('.fa-store-filter'),pill:await readStyle('.fa-toolbar button'),icon:await readStyle('.fa-toolbar button svg')};
  assert.equal(defaults.heading.size,20);assert.equal(defaults.title.size,14);assert.equal(defaults.caption.size,10);assert.equal(defaults.status.size,12);assert.equal(defaults.caption.color,'rgb(255, 255, 255)');assert.equal(defaults.status.color,'rgb(170, 181, 196)');assert.match(defaults.heading.font,/Cormorant/);assert.match(defaults.title.font,/Jost/);assert.equal(defaults.pill.paddingX,14);assert.equal(defaults.pill.paddingY,6);
  await page.evaluate(async()=>{const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.type.H1,{size:32});Object.assign(d.type.H2,{size:28,weight:450,color:'gray',font:'jost'});Object.assign(d.type.H3,{size:24});Object.assign(d.type.H4,{size:20,weight:450,color:'gray',font:'cormorant'});Object.assign(d.type.P1,{size:16,weight:400,color:'white'});Object.assign(d.type.P2,{size:16});Object.assign(d.type.P3,{size:14,weight:450,color:'gray',case:'none'});Object.assign(d.overlay,{background:'pink',fill:65,rim:70,radius:20,blur:9,saturation:130,paddingX:24,paddingY:18});Object.assign(d.inner,{background:'blue',fill:70,rim:60,radius:16,paddingX:12,paddingY:10,blur:12,saturation:110});Object.assign(d.editor,{background:'green',fill:100,rim:70,radius:16,paddingX:10,paddingY:9});Object.assign(d.glass,{fill:65,rim:70,blur:7,saturation:120});d.pillX=18;d.pillY=9;d.iconSize=32;d.iconColor='#aa1234';d.iconStroke=3;d.layoutSpacing.labelGap=12;d.layoutSpacing.fieldGap=18;await MayaTypographyControls.save(d);});
  assert.equal(designWrites.length,1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fa-toolbar button')).backgroundColor==='rgba(3, 15, 29, 0.65)');
  for(const mode of ['inline','expanded']){
    if(mode==='expanded')await page.locator('.fa-toolbar').getByRole('button',{name:'Expand',exact:true}).click();
    for(const width of [320,390,768,1024,1440,1920]){
      await page.setViewportSize({width,height:1000});
      assert.ok((await page.locator('.fa-body').boundingBox()).height>=150,mode+' saved results usable '+width);
      for(const[selector,size,color]of [['.fa-header h2',28,'rgb(170, 181, 196)'],['.fa-card-title',20,'rgb(170, 181, 196)'],['.fa-card-caption',14,'rgb(170, 181, 196)'],['.fa-status',16,'rgb(255, 255, 255)']]){const actual=await readStyle(selector);assert.equal(actual.size,size,mode+' '+width+' '+selector+' saved size');assert.equal(actual.color,color,mode+' '+width+' '+selector+' saved color');}
      const outer=await readStyle('#fabric-assistant'),inner=await readStyle('.fa-product'),field=await readStyle('.fa-store-filter'),pill=await readStyle('.fa-toolbar button'),glyph=await readStyle('.fa-toolbar button svg');
      assert.deepEqual([outer.paddingX,outer.paddingY,outer.radius,outer.background],[24,18,20,'rgba(115, 46, 70, 0.65)'],mode+' outer material '+width);
      assert.deepEqual([inner.paddingX,inner.paddingY,inner.radius,inner.background],[12,10,16,'rgba(35, 76, 125, 0.7)'],mode+' inner material '+width);
      assert.deepEqual([field.paddingX,field.paddingY,field.radius,field.background],[10,9,16,'rgb(23, 91, 59)'],mode+' field material '+width);
      assert.deepEqual([pill.paddingX,pill.paddingY,pill.blur],[18,9,'blur(7px) saturate(1.2)'],mode+' glass material '+width);
      assert.equal(outer.blur,'blur(9px) saturate(1.3)');assert.equal(inner.blur,'blur(12px) saturate(1.1)');assert.equal(pill.background,'rgba(3, 15, 29, 0.65)');assert.match((await readStyle('.fa-card-title')).font,/Cormorant/);assert.equal((await readStyle('.fa-card-title')).weight,'450');assert.equal(await page.locator('.fa-store-wrap').evaluate(el=>getComputedStyle(el).gap),'12px');assert.equal(await page.locator('#fabric-assistant').evaluate(el=>getComputedStyle(el).gap),'18px');
      assert.equal(glyph.color,'rgb(170, 18, 52)');assert.equal(glyph.stroke,'3px');assert.ok(glyph.width>8&&glyph.height>8);
      assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),mode+' saved design fits '+width);
      if(mode==='expanded'&&width<=390)assert.ok((await page.locator('.fa-product-image').first().boundingBox()).width>180,'Saved phone fabric photos remain large');
      const select=page.locator('.fa-store-filter');if(!await select.isVisible())await page.getByRole('button',{name:'Filter stores',exact:true}).click();await select.focus();await select.press('Tab');await page.keyboard.press('Shift+Tab');assert.ok(await select.evaluate(el=>el===document.activeElement&&parseFloat(getComputedStyle(el).outlineWidth)>0),mode+' store focus visible '+width);
    }
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/private/tmp/maya-fabrics-'+mode+'-saved.png'});
  }
  failNext=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.getByText('Search temporarily unavailable.',{exact:true}).waitFor();assert.equal((await readStyle('.fa-status')).size,16,'Failure stays governed');await page.screenshot({path:'/private/tmp/maya-fabrics-error-saved.png'});
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-card-title').waitFor();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/maya-fabrics-phone-saved.png'});
  // Generic standalone conversations remain available when no dissected-look mode is supplied.
  await page.evaluate(({reference})=>window.MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,forceReset:true}),{reference});
  await page.locator('#fabric-assistant-dialog[open]').waitFor();await page.locator('#fabric-request').fill('Find burgundy wool, preferably local');await page.locator('.fa-composer button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  await page.locator('#fabric-request').fill('Less shiny, only Britex');await page.locator('#fabric-request').press('Enter');await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  assert.equal(requests.at(-1).history[0].request,'Find burgundy wool, preferably local');
  failNext=true;await page.locator('#fabric-request').fill('a new texture');await page.locator('.fa-composer button[type=submit]').click();
  await page.getByText('Search temporarily unavailable.',{exact:true}).waitFor();assert.equal(await page.locator('#fabric-request').inputValue(),'a new texture');
  delayNext=true;await page.locator('.fa-composer button[type=submit]').click();while(!delayed)await new Promise(r=>setTimeout(r,5));
  await page.evaluate(t=>{localStorage.setItem('maya_admin_tok',t);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},jwt('owner-B'));await delayed().catch(()=>{});
  assert.equal(await page.locator('.fa-product').count(),0,'stale account results never repaint');assert.equal(await page.locator('#fabric-request').inputValue(),'');
  assert.equal(await page.locator('.fa-photo img').getAttribute('src'),null,'Account reset removes the private reference from hidden DOM too');
  await page.evaluate(({reference})=>window.MayaFabricAssistant.open({submissionId:'project-B',referenceImage:reference}),{reference});assert.equal(await page.locator('.fa-product').count(),0,'different submission has no previous fabric');
  await page.evaluate(t=>localStorage.setItem('maya_admin_tok',t),jwt('owner-A'));
  await page.goto('https://maya-fabric.test/operations.html?submission=project-A');
  await page.waitForFunction(()=>!document.getElementById('operation-fabrics').disabled);
  assert.equal(await page.locator('#test-picker option').count(),pieces.length,'Operation Room receives only saved pieces');
  const beforeOperationSearch=requests.length;await page.locator('#operation-fabrics').click();await page.locator('#operation-fabrics-host #fabric-assistant').waitFor();
  await page.locator('.fa-card-title').filter({hasText:'Crimson wool twill'}).waitFor();assert.equal(requests.length,beforeOperationSearch+1);assert.equal(requests.at(-1).piece.name,'Crimson coat');
  await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();assert.match(await page.locator('.fa-results').textContent(),/Midnight Velvet/);
  await page.evaluate(()=>MayaTypographyControls.ready);assert.equal((await readStyle('.fa-header h2')).size,28,'Saved design propagates on the Operations page reload');assert.equal((await readStyle('.fa-product')).background,'rgba(35, 76, 125, 0.7)');
  const savedProductCard=page.locator('.fa-product').filter({hasText:'Crimson wool twill'});
  await savedProductCard.locator('img').dispatchEvent('error');
  await savedProductCard.getByText('Photo unavailable',{exact:true}).waitFor();
  assert.ok(await savedProductCard.getByRole('button',{name:'Remove',exact:true}).isVisible(),'A broken favorite stays manageable');
  await savedProductCard.getByRole('button',{name:'Remove',exact:true}).click();
  await page.waitForFunction(()=>![...document.querySelectorAll('.fa-card-title')].some(e=>e.textContent==='Crimson wool twill'));
  assert.ok([...books.values()].some(book=>book.items.some(p=>p.title==='Midnight Velvet')&&!book.items.some(p=>p.title==='Crimson wool twill')),'Removal persisted, instead of merely hiding a broken card');
  assert.deepEqual(errors,[]);
  console.log('Fabric UI: saved-look automatic inline search, optional same-view expansion, three shared tabs, store filter, concise sourced cards, sealed favorites/refinements/failures, and six widths passed.');
}catch(e){console.error('Fabric UI state:',await page.locator('.fa-status').allTextContents());await page.screenshot({path:'/private/tmp/maya-fabrics-test-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
