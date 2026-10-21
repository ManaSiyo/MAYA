// Real pages, isolated Chromium, fake providers. Never opens a personal Chrome profile.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
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
const requests=[],bookWrites=[],books=new Map(),inventoryImages=[];let longPreferences=false,delayed=null,delayNext=false,failNext=false,failInventoryPreview=false,legacyCatalog=false;
const catalog=JSON.parse(readFileSync(root+'/aesthetics/fabrics/fabrics.json','utf8'));
let originalBytes=0,previewBytes=0;for(const item of catalog.items){assert.match(item.thumbnail,/^thumbs\/[^\\/]+\.jpg$/);originalBytes+=statSync(root+'/aesthetics/fabrics/'+item.fileName).size;previewBytes+=statSync(root+'/aesthetics/fabrics/'+item.thumbnail).size;}assert.ok(previewBytes<originalBytes,'Existing thumbnail files reduce the actual inventory payload');
const jwt=(sub,lifetime=3600)=>'test.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+lifetime})).toString('base64url')+'.test';
const inventoryFavorite={url:'/aesthetics/fabrics/midnight-velvet.webp',image:'https://cdn.shopify.com/inventory.png',title:'Midnight Velvet',evidence:'atelier_inventory'};
books.set('owner-A|project-A',{items:[product,inventoryFavorite],selectedUrl:product.url,generation:'2'});
const groups=[['local','Local (Bay Area)','https://britexfabrics.com/products/crimson-wool'],['mood','Mood','https://www.moodfabrics.com/products/crimson-wool'],['swatchon','Swatchon','https://www.swatchon.com/fabric/QL-061078'],['amazon','Amazon','https://amazon.com/dp/B000000001'],['others','Others','https://www.blackbirdfabrics.com/products/crimson-wool']];
const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Distinct initial/renewed expiries prove token text is not store identity.
await page.addInitScript(t=>localStorage.setItem('maya_admin_tok',t),jwt('owner-A',7200));
await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='cdn.shopify.com')return u.searchParams.has('fixture-unavailable')?route.fulfill({status:404,body:'Missing fixture image'}):route.fulfill({body:png,contentType:'image/png'});
  if(u.hostname!=='maya-fabric.test')return route.abort();
  if(u.pathname==='/aesthetics/fabrics/fabrics.json'&&failInventoryPreview)return route.fulfill({json:{...catalog,items:catalog.items.map((item,i)=>i?item:{...item,thumbnail:'thumbs/Unavailable preview.jpg'})}});
  if(u.pathname==='/aesthetics/fabrics/fabrics.json'&&legacyCatalog)return route.fulfill({json:{version:1,items:catalog.items.map(({thumbnail,...item})=>item)}});
  if(u.pathname.startsWith('/aesthetics/fabrics/')&&/\.(?:jpg|png|webp)$/i.test(u.pathname)){inventoryImages.push(u.pathname);if(u.pathname.endsWith('/thumbs/Unavailable%20preview.jpg'))return route.fulfill({status:404,body:'Missing fixture thumbnail'});if(legacyCatalog)return route.fulfill({body:png,contentType:'image/png'});}
  const body=route.request().postDataJSON?.();
  if(u.pathname==='/api/design')return route.fulfill({json:savedDesign});
  if(u.pathname==='/api/admin/design'){assert.ok(validDesign(body),'Saved design is server-valid');designWrites.push(body);savedDesign=structuredClone(body);return route.fulfill({json:{ok:true,savedAt:'2026-10-08T00:00:00Z'}});}
  if(u.pathname==='/api/admin/fabrics/search'){
    requests.push(body);
    if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Search temporarily unavailable.'}});}
    const resultProduct={...product,url:groups.find(g=>body.storeGroups?.includes(g[0]))?.[2]||product.url};
    const fixtureProducts=[{...resultProduct,garment:body.piece?.name||'Crimson coat'},...(body.storeGroups?.length===1?[{...product,url:groups.find(g=>g[0]!==body.storeGroups[0])[2],title:'Wrong merchant fixture'}]:[])];
    const searchDetails={preferences:JSON.stringify(longPreferences?['Wool','Detailed reference direction. '.repeat(200),'No polyester']:['Wool','No polyester']),garments:[{name:body.piece?.name||'Crimson coat',fabric:'Burgundy wool twill',traits:{texture:'matte'}}],retailerQueries:['red wool twill'],webQueries:['burgundy matte wool fabric'],query:'matte burgundy wool',observation:'Matte, burgundy and twill-like; fiber cannot be confirmed visually.',stores:['Britex Fabrics'],stage:'Verified matches'};
    const complete=()=>route.fulfill({contentType:'application/x-ndjson',body:[{type:'context',searchDetails},{type:'products',products:fixtureProducts,preliminary:true},{type:'done',products:fixtureProducts,searchDetails,query:'matte burgundy wool',observation:'Matte, burgundy and twill-like; fiber cannot be confirmed visually.',message:'Refine these with another message.'}].map(v=>JSON.stringify(v)).join('\n')+'\n'});
    if(delayNext){delayNext=false;delayed=complete;return;}
    return complete();
  }
  if(u.pathname==='/api/admin/fabrics/lookbook'){
    const account=JSON.parse(Buffer.from(route.request().headers().authorization.split('.')[1],'base64url').toString()).sub;
    const key=account+'|'+(body?.submissionId || u.searchParams.get('submissionId'));
    let book=books.get(key)||{items:[],selectedUrl:'',generation:'0'};
    if(body){bookWrites.push(body);assert.equal(body.generation,book.generation);book={items:body.action==='remove'?book.items.filter(p=>p.url!==body.product.url):[body.product,...book.items.filter(p=>p.url!==body.product.url)],selectedUrl:body.action==='select'?body.product.url:body.action==='remove'?'':book.selectedUrl,generation:String(Number(book.generation)+1)};books.set(key,book);}
    // Model a slower independent lookbook read than the streamed search.
    if(!body)await new Promise(resolve=>setTimeout(resolve,120));
    return route.fulfill({json:{ok:true,...book}});
  }
  if(u.pathname==='/api/admin/submissions')return route.fulfill({json:{folders:[{id:'project-A',files:[{id:'summary-A',name:'summary.json'},{id:'image-A',name:'dream-garment.png'},{id:'pieces-A',name:'pieces.json'}]}]}});
  if(u.pathname==='/api/admin/subfile')return u.searchParams.get('id')==='pieces-A'?route.fulfill({json:{pieces},headers:{'X-Maya-Generation':'1'}}):u.searchParams.get('id')==='summary-A'?route.fulfill({json:{fabric_preferences:'100% wool, no polyester'}}):route.fulfill({body:png,contentType:'image/png'});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  const path=u.pathname==='/backend.html'?'/backend/backend.html':u.pathname==='/operations.html'?'/backend/operations.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+decodeURIComponent(path)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[extname(path).toLowerCase()]||'text/plain'});}catch{return route.abort();}
});
const openFavorites=async()=>{
  await page.locator('.fa-tabs').getByRole('button',{name:'Favorites',exact:true}).click();
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('.fa-product')];
    return cards.length===2&&cards.some(e=>e.textContent.includes('Crimson wool twill'))&&cards.some(e=>e.textContent.includes('Midnight Velvet'));
  });
};
try{
  await page.goto('https://maya-fabric.test/backend.html');
  await page.waitForFunction(()=>!!window.MayaFabricAssistant);
  assert.equal(await page.locator('#brief-fabrics-button').isDisabled(),true,'Brief fabrics require a saved dissection');
  await page.evaluate(({reference,pieces})=>{
    window._openedSubmission={id:'project-A'};window._currentSnap={lastSummary:{fabric_preferences:'100% wool, no polyester'}};
    window._dissectTarget={hero:reference,card:{_dissection:{pieces}}};
    renderDissection({card:{image:reference,_dissection:{pieces}}});
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
  assert.equal(await page.locator('.fa-card-actions').count(),0,'Sourceable cards have no Save or Use controls');
  assert.equal(await page.locator('.fa-product [title]').count(),0,'Cards do not repeat verbose hover copy');
  assert.match(await page.locator('.fa-card-caption').textContent(),/69.99 USD \/ yard/,'Verified price remains accessible inline');
  const details=page.locator('#fabric-assistant .fa-search-details'),detailsTrigger=page.getByRole('button',{name:'Search details',exact:true});
  const checkDetails=async(saved=false)=>{
    const before=requests.length,wasExpanded=await page.locator('#fabric-assistant-dialog').getAttribute('open');
    await page.locator('.fa-body').focus();await detailsTrigger.focus();await details.waitFor({state:'visible'});
    assert.match(await details.textContent(),/burgundy matte wool fabric/,'Shows actual web query metadata');
    assert.match(await details.textContent(),/fiber cannot be confirmed visually/);assert.match(await details.textContent(),/Client preferences: Wool · No polyester/);
    const style=await details.evaluate(e=>{const s=getComputedStyle(e.querySelector('[data-maya-panel=inner]')),r=e.getBoundingClientRect(),p=getComputedStyle(e.querySelector('p'));return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,paddingX:s.paddingLeft,paddingY:s.paddingTop,bg:s.backgroundColor,size:p.fontSize,font:p.fontFamily,overflow:e.scrollWidth<=e.clientWidth+1};});
    assert.ok(style.x>=0&&style.y>=0&&style.right<=style.width+1&&style.bottom<=style.height+1,'Details stay in the viewport');assert.ok(style.overflow);assert.equal(await detailsTrigger.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'Hover details never cover their own activation target');
    if(saved)assert.deepEqual([style.paddingX,style.paddingY,style.bg,style.size],['12px','10px','rgba(35, 76, 125, 0.7)','14px']);
    else assert.equal(style.size,'10px');
    assert.equal(await details.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+Math.min(r.height/2,40)));}),true,'Details paint above the inline/dialog surface');
    await page.keyboard.press('Escape');await details.waitFor({state:'hidden'});assert.equal(await page.locator('#fabric-assistant-dialog').getAttribute('open'),wasExpanded,'Escape closes details without collapsing the fabric workspace');
    assert.equal(requests.length,before,'Hover/focus details are free');
  };
  await checkDetails();
  await page.locator('.fa-body').hover();await details.waitFor({state:'visible'});await page.keyboard.press('Escape');
  await openFavorites();assert.equal(await page.locator('.fa-product').count(),2);assert.equal(await detailsTrigger.isVisible(),false);
  assert.deepEqual(await page.locator('.fa-card-actions button').allTextContents(),['Remove','Remove']);
  await page.evaluate(t=>{localStorage.setItem('maya_admin_tok',t);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},jwt('owner-A',10800));
  await openFavorites();assert.equal(await page.locator('.fa-product').count(),2,'Same-account renewal retains the saved lookbook');assert.equal(books.size,1,'Fixture storage is account/submission scoped, never token scoped');
  await page.locator('.fa-tabs').getByRole('button',{name:'In House',exact:true}).click();await page.locator('.fa-card-title').filter({hasText:'Midnight Velvet'}).waitFor();
  assert.equal(await page.locator('#brief-fabrics #fabric-assistant').count(),1,'In House stays in the same inline window');
  assert.doesNotMatch(await page.locator('.fa-results').textContent(),/in.house.*atelier|in stock|arrives/i);
  assert.equal(await page.locator('.fa-card-actions').count(),0,'In House has no Save or Use controls');assert.equal(bookWrites.length,0,'Browsing never mutates old favorites');
  await page.waitForFunction(()=>document.querySelectorAll('.fa-product').length===8);
  assert.ok(await page.locator('.fa-product-image').evaluateAll(es=>es.every(e=>e.getAttribute('src').startsWith('/aesthetics/fabrics/thumbs/'))),'Inventory cards display the existing thumbnails');
  assert.equal(await page.locator('.fa-product-link').first().getAttribute('href'),'/aesthetics/fabrics/Burgundy%20Lace.JPG','Opening a swatch retains the original full-resolution photo');
  assert.ok(!inventoryImages.some(path=>!path.includes('/thumbs/')),'Browsing inventory never downloads full-size originals');
  legacyCatalog=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.fa-product-image')?.getAttribute('src')==='/aesthetics/fabrics/Burgundy%20Lace.JPG');
  assert.equal(await page.locator('.fa-product').count(),8,'Older catalogs without thumbnail metadata remain usable');
  legacyCatalog=false;
  failInventoryPreview=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();
  const missing=page.locator('.fa-product').filter({has:page.getByText('Burgundy Lace',{exact:true})});await missing.getByText('Photo unavailable',{exact:true}).waitFor();
  assert.equal(await missing.locator('a').getAttribute('href'),'/aesthetics/fabrics/Burgundy%20Lace.JPG','A failed preview keeps the original photo reachable');assert.equal(await page.locator('.fa-product').count(),8);assert.equal(await missing.locator('.fa-image-unavailable').evaluate(e=>getComputedStyle(e).fontSize),'10px','Missing inventory photos keep the shared P3 default');failInventoryPreview=false;

  await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();
  await page.getByRole('button',{name:'Filter stores',exact:true}).click();
  assert.deepEqual(await page.locator('.fa-store-filter').allTextContents(),groups.map(g=>g[1]));
  assert.equal(await page.locator('.fa-store-filter[aria-pressed=true]').count(),5,'Default search includes all five groups');
  const filterCount=requests.length;
  const chooseGroups=async ids=>{for(const [id] of groups){const button=page.locator('[data-store-group="'+id+'"]');if((await button.getAttribute('aria-pressed')==='true')!==ids.includes(id))await button.click();}};
  for(const [id,label,url] of groups){
    await chooseGroups([id]);assert.equal(requests.length,filterCount+groups.findIndex(g=>g[0]===id),'Filter toggles do not call search');
    await page.getByText('Refresh to search these stores.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
    assert.deepEqual(requests.at(-1).storeGroups,[id]);assert.equal(await page.locator('.fa-product').count(),1,'Cross-group payload cannot leak into results');assert.equal(await page.locator('.fa-product-link').getAttribute('href'),url,label+' results match selected host');
  }
  const beforeEmpty=requests.length;await chooseGroups([]);assert.equal(await page.locator('.fa-product').count(),0);await page.getByText('Choose at least one store group.',{exact:true}).waitFor();await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();assert.equal(requests.length,beforeEmpty,'Empty selection never becomes an unrestricted provider call');
  await chooseGroups(['local']);await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});await checkDetails();assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'default inline view fits '+width);assert.ok((await page.locator('.fa-body').boundingBox()).height>=100,'Default inline results usable '+width);const field=await page.locator('.fa-store-filter').first().boundingBox();assert.ok(field.width>80,'default inline filter remains usable '+width+' '+JSON.stringify(field));}
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
  assert.equal(await page.locator('[data-store-group=local]').getAttribute('aria-pressed'),'true','Expansion preserves store choice');assert.equal(await page.locator('.fa-store-filter[aria-pressed=true]').count(),1);
  await openFavorites();assert.equal(await page.locator('.fa-product').count(),2,'Sourceable filters never hide historical favorites');assert.match(await page.locator('.fa-results').textContent(),/Midnight Velvet/);
  await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-card-title').filter({hasText:'Crimson wool twill'}).waitFor();
  // Actual saved authority, not merely CSS variables: all roles/materials, inline
  // and expanded at six widths, with a visible focused store control and errors.
  await page.evaluate(()=>MayaTypographyControls.ready);
  // Lookbook reads can replace cards between locator resolution and evaluation.
  // Resolve and inspect the currently connected element in one browser task.
  const readStyle=selector=>page.evaluate(selector=>{const el=document.querySelector(selector);if(!el?.isConnected)throw Error('Missing connected style target: '+selector);const s=getComputedStyle(el),r=el.getBoundingClientRect();return {size:parseFloat(s.fontSize),weight:s.fontWeight,color:s.color,font:s.fontFamily,background:s.backgroundColor,paddingX:parseFloat(s.paddingLeft),paddingY:parseFloat(s.paddingTop),radius:parseFloat(s.borderRadius),blur:s.backdropFilter,stroke:s.strokeWidth,width:r.width,height:r.height};},selector);
  const defaults={heading:await readStyle('.fa-header h2'),title:await readStyle('.fa-card-title'),caption:await readStyle('.fa-card-caption'),status:await readStyle('.fa-status'),outer:await readStyle('#fabric-assistant'),inner:await readStyle('.fa-product'),field:await readStyle('.fa-store-filter'),pill:await readStyle('.fa-toolbar button'),icon:await readStyle('.fa-toolbar button svg')};
  assert.equal(defaults.heading.size,20);assert.equal(defaults.title.size,14);assert.equal(defaults.caption.size,10);assert.equal(defaults.status.size,12);assert.equal(defaults.caption.color,'rgb(255, 255, 255)');assert.equal(defaults.status.color,'rgb(170, 181, 196)');assert.match(defaults.heading.font,/Cormorant/);assert.match(defaults.title.font,/Jost/);assert.equal(defaults.pill.paddingX,14);assert.equal(defaults.pill.paddingY,6);
  await page.evaluate(async()=>{const d=structuredClone(MayaTypographyControls.defaults);Object.assign(d.type.H1,{size:32});Object.assign(d.type.H2,{size:28,weight:450,color:'gray',font:'jost'});Object.assign(d.type.H3,{size:24});Object.assign(d.type.H4,{size:20,weight:450,color:'gray',font:'cormorant'});Object.assign(d.type.P1,{size:16,weight:400,color:'white'});Object.assign(d.type.P2,{size:16});Object.assign(d.type.P3,{size:14,weight:450,color:'gray',case:'none'});Object.assign(d.overlay,{background:'pink',fill:65,rim:70,radius:20,blur:9,saturation:130,paddingX:24,paddingY:18});Object.assign(d.inner,{background:'blue',fill:70,rim:60,radius:16,paddingX:12,paddingY:10,blur:12,saturation:110});Object.assign(d.editor,{background:'green',fill:100,rim:70,radius:16,paddingX:10,paddingY:9});Object.assign(d.glass,{fill:65,rim:70,blur:7,saturation:120});d.pillX=18;d.pillY=9;d.iconSize=32;d.iconColor='#aa1234';d.iconStroke=3;d.layoutSpacing.labelGap=12;d.layoutSpacing.fieldGap=18;await MayaTypographyControls.save(d);});
  assert.equal(designWrites.length,1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.fa-toolbar button')).backgroundColor==='rgba(3, 15, 29, 0.65)');
  for(const mode of ['inline','expanded']){
    if(mode==='expanded')await page.locator('.fa-toolbar').getByRole('button',{name:'Expand',exact:true}).click();
    for(const width of [320,390,768,1024,1440,1920]){
      await page.setViewportSize({width,height:1000});await checkDetails(true);
      assert.ok((await page.locator('.fa-body').boundingBox()).height>=100,mode+' saved results usable '+width);
      for(const[selector,size,color]of [['.fa-header h2',28,'rgb(170, 181, 196)'],['.fa-card-title',20,'rgb(170, 181, 196)'],['.fa-card-caption',14,'rgb(170, 181, 196)'],['.fa-status',16,'rgb(255, 255, 255)']]){const actual=await readStyle(selector);assert.equal(actual.size,size,mode+' '+width+' '+selector+' saved size');assert.equal(actual.color,color,mode+' '+width+' '+selector+' saved color');}
      const outer=await readStyle('#fabric-assistant'),inner=await readStyle('.fa-product'),field=await readStyle('.fa-store-filter'),pill=await readStyle('.fa-toolbar button'),glyph=await readStyle('.fa-toolbar button svg');
      assert.deepEqual([outer.paddingX,outer.paddingY,outer.radius,outer.background],[24,18,20,'rgba(115, 46, 70, 0.65)'],mode+' outer material '+width);
      assert.deepEqual([inner.paddingX,inner.paddingY,inner.radius,inner.background],[12,10,16,'rgba(35, 76, 125, 0.7)'],mode+' inner material '+width);
      assert.deepEqual([field.paddingX,field.paddingY,field.radius,field.background],[18,9,100,'rgba(3, 15, 29, 0.65)'],mode+' filter Glass material '+width);
      assert.deepEqual([pill.paddingX,pill.paddingY,pill.blur],[18,9,'blur(7px) saturate(1.2)'],mode+' glass material '+width);
      assert.equal(outer.blur,'blur(9px) saturate(1.3)');assert.equal(inner.blur,'blur(12px) saturate(1.1)');assert.equal(pill.background,'rgba(3, 15, 29, 0.65)');assert.match((await readStyle('.fa-card-title')).font,/Cormorant/);assert.equal((await readStyle('.fa-card-title')).weight,'450');assert.equal(await page.locator('.fa-store-wrap').evaluate(el=>getComputedStyle(el).gap),'12px');assert.equal(await page.locator('#fabric-assistant').evaluate(el=>getComputedStyle(el).gap),'18px');
      assert.ok(await page.locator('.fa-card-caption').first().evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1),'Seller facts wrap without losing the unit '+width);
      assert.equal(glyph.color,'rgb(170, 18, 52)');assert.equal(glyph.stroke,'3px');assert.ok(glyph.width>8&&glyph.height>8);
      assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),mode+' saved design fits '+width);
      if(mode==='expanded'&&width<=390)assert.ok((await page.locator('.fa-product-image').first().boundingBox()).width>180,'Saved phone fabric photos remain large');
      const select=page.locator('.fa-store-filter').first();if(!await select.isVisible())await page.getByRole('button',{name:'Filter stores',exact:true}).click();await select.focus();await select.press('Tab');await page.keyboard.press('Shift+Tab');assert.ok(await select.evaluate(el=>el===document.activeElement&&parseFloat(getComputedStyle(el).outlineWidth)>0),mode+' store focus visible '+width);
    }
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/private/tmp/maya-fabrics-'+mode+'-saved.png'});
  }
  failNext=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.getByText('Search temporarily unavailable.',{exact:true}).waitFor();assert.equal((await readStyle('.fa-status')).size,16,'Failure stays governed');await page.screenshot({path:'/private/tmp/maya-fabrics-error-saved.png'});
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.locator('.fa-card-title').waitFor();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/maya-fabrics-phone-saved.png'});
  await detailsTrigger.tap();await details.waitFor({state:'visible'});assert.equal(await details.evaluate(e=>document.activeElement===e),true,'Tap/activation focuses the scrollable search details');await page.screenshot({path:'/private/tmp/maya-fabric-details-saved-phone.png'});await page.keyboard.press('Escape');
  // Generic standalone conversations remain available when no dissected-look mode is supplied.
  await page.evaluate(({reference})=>window.MayaFabricAssistant.open({submissionId:'project-A',referenceImage:reference,forceReset:true}),{reference});
  await page.locator('#fabric-assistant-dialog[open]').waitFor();await page.locator('#fabric-request').fill('Find burgundy wool, preferably local');await page.locator('.fa-composer button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  await page.locator('#fabric-request').fill('Less shiny, only Britex');await page.locator('#fabric-request').press('Enter');await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  assert.equal(requests.at(-1).history[0].request,'Find burgundy wool, preferably local');
  await page.locator('#fabric-request').fill('unsent cotton draft');await page.getByRole('button',{name:'Filter stores',exact:true}).click();
  const beforeFilters=requests.length;await chooseGroups(['swatchon']);assert.equal(requests.length,beforeFilters);assert.equal(await page.locator('#fabric-request').inputValue(),'unsent cotton draft');
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  assert.equal(requests.at(-1).request,'Less shiny, only Britex');assert.deepEqual(requests.at(-1).storeGroups,['swatchon']);assert.equal(await page.locator('#fabric-request').inputValue(),'unsent cotton draft','Refresh preserves unsent edits');
  delayNext=true;await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();while(!delayed)await new Promise(r=>setTimeout(r,5));
  const delayedFilter=delayed;delayed=null;await chooseGroups(['local']);await delayedFilter().catch(()=>{});await page.getByText('Refresh to search these stores.',{exact:true}).waitFor();assert.equal(await page.locator('.fa-product').count(),0,'Obsolete filter stream cannot repaint');assert.equal(await page.locator('#fabric-request').inputValue(),'unsent cotton draft');
  failNext=true;await page.locator('#fabric-request').fill('a new texture');await page.locator('.fa-composer button[type=submit]').click();
  await page.getByText('Search temporarily unavailable.',{exact:true}).waitFor();assert.equal(await page.locator('#fabric-request').inputValue(),'a new texture');
  delayNext=true;await page.locator('.fa-composer button[type=submit]').click();while(!delayed)await new Promise(r=>setTimeout(r,5));
  await page.evaluate(t=>{localStorage.setItem('maya_admin_tok',t);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},jwt('owner-B'));await delayed().catch(()=>{});
  assert.equal(await page.locator('.fa-product').count(),0,'stale account results never repaint');assert.equal(await page.locator('#fabric-request').inputValue(),'');
  assert.equal(await details.textContent(),'','Account reset clears private search details from hidden DOM');
  assert.equal(await page.locator('.fa-photo img').getAttribute('src'),null,'Account reset removes the private reference from hidden DOM too');
  await page.evaluate(({reference})=>window.MayaFabricAssistant.open({submissionId:'project-B',referenceImage:reference}),{reference});assert.equal(await page.locator('.fa-product').count(),0,'different submission has no previous fabric');
  await page.evaluate(t=>localStorage.setItem('maya_admin_tok',t),jwt('owner-A'));
  await page.goto('https://maya-fabric.test/operations.html?submission=project-A');
  await page.waitForFunction(()=>!document.getElementById('operation-fabrics').disabled);
  assert.equal(await page.locator('#test-picker option').count(),pieces.length,'Operation Room receives only saved pieces');
  const beforeOperationSearch=requests.length;await page.locator('#operation-fabrics').click();await page.locator('#operation-fabrics-host #fabric-assistant').waitFor();
  await page.locator('.fa-card-title').filter({hasText:'Crimson wool twill'}).waitFor();assert.equal(requests.length,beforeOperationSearch+1);assert.equal(requests.at(-1).piece.name,'Crimson coat');
  await openFavorites();assert.match(await page.locator('.fa-results').textContent(),/Midnight Velvet/);
  await page.evaluate(()=>MayaTypographyControls.ready);assert.equal((await readStyle('.fa-header h2')).size,28,'Saved design propagates on the Operations page reload');assert.equal((await readStyle('.fa-product')).background,'rgba(35, 76, 125, 0.7)');
  const savedProductCard=page.locator('.fa-product').filter({hasText:'Crimson wool twill'});
  // A persistent provider-photo failure survives async lookbook repaint. A one-off
  // synthetic DOM error could be erased by the in-flight Favorites refresh.
  for(const book of books.values())for(const item of book.items)if(item.url===product.url)item.image=product.image+'?fixture-unavailable=1';
  await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();
  await savedProductCard.getByText('Photo unavailable',{exact:true}).waitFor();
  assert.equal((await readStyle('.fa-image-unavailable')).size,14,'Unavailable-photo copy follows the changed saved P3 role');assert.equal((await readStyle('.fa-image-unavailable')).color,'rgb(170, 181, 196)');
  assert.ok(await savedProductCard.getByRole('button',{name:'Remove',exact:true}).isVisible(),'A broken favorite stays manageable');
  await savedProductCard.getByRole('button',{name:'Remove',exact:true}).click();
  await page.waitForFunction(()=>![...document.querySelectorAll('.fa-card-title')].some(e=>e.textContent==='Crimson wool twill'));
  assert.ok([...books.values()].some(book=>book.items.some(p=>p.title==='Midnight Velvet')&&!book.items.some(p=>p.title==='Crimson wool twill')),'Removal persisted, instead of merely hiding a broken card');
  longPreferences=true;await page.setViewportSize({width:390,height:844});
  await page.locator('.fa-tabs').getByRole('button',{name:'Sourceable',exact:true}).click();await page.getByRole('button',{name:'Refresh fabrics',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  const beforeDetails=requests.length;await detailsTrigger.click();await details.waitFor({state:'visible'});
  assert.ok(await details.evaluate(e=>e.scrollHeight>e.clientHeight),'Long original preferences remain fully available in a bounded scroller');
  assert.equal(await details.evaluate(e=>document.activeElement===e),true);await details.press('PageDown');await page.waitForFunction(()=>document.querySelector('.fa-search-details').scrollTop>0);
  assert.equal(await details.evaluate(e=>getComputedStyle(e,'::-webkit-scrollbar').width),'4px','Details use the saved shared thin scrollbar');assert.equal(requests.length,beforeDetails,'Keyboard reading makes no provider calls');await page.keyboard.press('Escape');
  await page.goto('https://maya-fabric.test/aesthetics/aesthetic-control.html');
  const previewTrigger=page.locator('#workspace-previews').getByRole('button',{name:'Search details',exact:true});
  await previewTrigger.focus();const previewDetails=page.locator('#workspace-previews .fa-search-details');await previewDetails.waitFor({state:'visible'});
  assert.match(await previewDetails.textContent(),/Presentation sample; no search is sent/);
  assert.deepEqual(await previewDetails.locator('[data-maya-panel=inner]').evaluate(e=>{const s=getComputedStyle(e);return [s.paddingLeft,s.paddingTop,s.backgroundColor];}),['12px','10px','rgba(35, 76, 125, 0.7)'],'Active preview follows the same saved Inner material');
  assert.equal(await previewDetails.locator('p').first().evaluate(e=>getComputedStyle(e).fontSize),'14px');
  await page.screenshot({path:'/private/tmp/maya-fabric-details-gallery.png'});
  assert.deepEqual(errors,[]);
  console.log('Fabric UI: saved-look automatic inline search, optional same-view expansion, three shared tabs, store filter, concise sourced cards, sealed favorites/refinements/failures, and six widths passed.');
}catch(e){console.error('Fabric UI state:',await page.locator('.fa-status').allTextContents());await page.screenshot({path:'/private/tmp/maya-fabrics-test-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
