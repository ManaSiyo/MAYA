// Real pages, isolated Chromium, fake providers. Never opens a personal Chrome profile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root=resolve('.');
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM || process.env.CHROMIUM_PATH});
const png=readFileSync(root+'/aesthetics/ui/logo-circle.png');
const product={url:'https://britexfabrics.com/products/crimson-wool',merchant:'Britex Fabrics',place:'San Francisco',title:'Crimson wool twill',image:'https://cdn.shopify.com/fabric.jpg',description:'100% wool. Sold by the yard.',composition:'100% wool',price:'69.99',currency:'USD',unit:'yard',availability:'in_stock',evidence:'seller_listing',checkedAt:'2026-10-07T00:00:00Z',reason:'May suit the matte wool request.'};
const requests=[],books=new Map();let delayed=null,delayNext=false,failNext=false;
const jwt=sub=>'test.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(t=>localStorage.setItem('maya_admin_tok',t),jwt('owner-A'));
await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='cdn.shopify.com')return route.fulfill({body:png,contentType:'image/png'});
  if(u.hostname!=='maya.test')return route.abort();
  const body=route.request().postDataJSON?.();
  if(u.pathname==='/api/admin/fabrics/search'){
    requests.push(body);
    if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Search temporarily unavailable.'}});}
    const complete=()=>route.fulfill({contentType:'application/x-ndjson',body:[{type:'products',products:[product],preliminary:true},{type:'done',products:[product],query:'matte burgundy wool',observation:'Matte, burgundy and twill-like; fiber cannot be confirmed visually.',message:'Refine these with another message.'}].map(v=>JSON.stringify(v)).join('\n')+'\n'});
    if(delayNext){delayNext=false;delayed=complete;return;}
    return complete();
  }
  if(u.pathname==='/api/admin/fabrics/lookbook'){
    const key=route.request().headers().authorization+'|'+(body?.submissionId || u.searchParams.get('submissionId'));
    let book=books.get(key)||{items:[],selectedUrl:'',generation:'0'};
    if(body){assert.equal(body.generation,book.generation);book={items:body.action==='remove'?[]:[body.product],selectedUrl:body.action==='select'?body.product.url:body.action==='remove'?'':book.selectedUrl,generation:String(Number(book.generation)+1)};books.set(key,book);}
    return route.fulfill({json:{ok:true,...book}});
  }
  if(u.pathname==='/api/admin/submissions')return route.fulfill({json:{folders:[{id:'project-A',files:[{id:'summary-A',name:'summary.json'},{id:'image-A',name:'dream-garment.png'}]}]}});
  if(u.pathname==='/api/admin/subfile')return u.searchParams.get('id')==='summary-A'?route.fulfill({json:{fabric_preferences:'100% wool, no polyester'}}):route.fulfill({body:png,contentType:'image/png'});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true}});
  const path=u.pathname==='/backend.html'?'/backend/backend.html':u.pathname==='/operations.html'?'/backend/operations.html':u.pathname;
  try{return route.fulfill({body:readFileSync(root+path),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(path)]||'text/plain'});}catch{return route.abort();}
});
try{
  await page.goto('https://maya.test/backend.html');
  await page.evaluate(()=>{window._openedSubmission={id:'project-A'};window._currentSnap={lastSummary:{fabric_preferences:'100% wool, no polyester'}};});
  await page.setViewportSize({width:320,height:568});
  for(const button of await page.locator('#fabric-workspace-actions button').all()){
    const b=await button.boundingBox();assert.ok(b.x>=0&&b.y>=60&&b.x+b.width<=320,'workspace actions fit below mobile header');
  }
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#fabric-workspace-actions').getByRole('button',{name:'Fabrics',exact:true}).click();
  await page.locator('#fabric-assistant[open]').waitFor();
  await page.waitForFunction(()=>!!document.querySelector('.fa-photo img').getAttribute('src'));
  assert.equal(requests.length,0,'Opening a lookbook does not spend on AI or dissection');
  await page.locator('#fabric-request').fill('Find burgundy wool, preferably local');
  await page.locator('.fa-composer button[type=submit]').click();
  await page.getByRole('heading',{name:'Crimson wool twill'}).waitFor();
  assert.match(requests[0].image,/^data:image\/jpeg/);assert.equal(requests[0].preferences,'100% wool, no polyester');assert.equal(requests[0].submissionId,'project-A');
  assert.match(await page.locator('.fa-results').textContent(),/69.99 USD \/ yard/);
  await page.locator('#fabric-request').fill('Less shiny, only Britex');await page.locator('#fabric-request').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.fa-composer button[type=submit]').disabled);
  assert.equal(requests[1].history[0].request,'Find burgundy wool, preferably local');
  await page.locator('.fa-card-actions').getByRole('button',{name:'Use for design',exact:true}).click();
  await page.getByRole('button',{name:'Selected',exact:true}).waitFor();
  await page.locator('.fa-tabs').getByRole('button',{name:'Lookbook',exact:true}).click();
  assert.equal(await page.locator('.fa-product').count(),1);
  for(const[width,height]of [[320,568],[390,844],[768,1024],[1280,900],[1920,1080],[844,390]]){
    await page.setViewportSize({width,height});
    const bounds=await page.locator('#fabric-assistant').boundingBox();assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,`dialog fits ${width}x${height}`);
    assert.ok(await page.locator('#fabric-assistant').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`no horizontal overflow ${width}`);
    const send=await page.locator('.fa-composer button[type=submit]').boundingBox();assert.ok(send.y+send.height<=height,`send reachable ${width}`);
  }
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'/private/tmp/maya-fabrics-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/maya-fabrics-phone.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#fabric-assistant').getAttribute('open'),null);
  await page.goto('https://maya.test/operations.html?submission=project-A');
  await page.waitForFunction(()=>document.querySelector('#test-picker').value==='Current submission');
  assert.equal(await page.locator('#test-picker option').count(),1,'submission-linked room excludes sample garments');
  assert.match(await page.locator('#hero-img').getAttribute('src'),/^data:image\/jpeg/);
  await page.waitForFunction(()=>!document.querySelector('#operation-fabric-selection').hidden);
  assert.equal(await page.locator('#fabric-assistant').getAttribute('open'),null,'restoring a submission does not open the fabric dialog or spend on search');
  await page.getByRole('button',{name:'Fabrics',exact:true}).click();
  await page.getByRole('button',{name:'Lookbook',exact:true}).click();
  await page.getByRole('heading',{name:'Crimson wool twill'}).waitFor();
  assert.match(await page.locator('#operation-fabric-selection').textContent(),/Crimson wool twill/);
  await page.getByRole('button',{name:'New search',exact:true}).click();
  await page.locator('#fabric-request').fill('a new texture');failNext=true;await page.locator('.fa-composer button[type=submit]').click();
  await page.getByText('Search temporarily unavailable.',{exact:true}).waitFor();assert.equal(await page.locator('#fabric-request').inputValue(),'a new texture','failed search retains request');
  delayNext=true;await page.locator('.fa-composer button[type=submit]').click();
  while(!delayed)await new Promise(r=>setTimeout(r,5));
  await page.evaluate(t=>{localStorage.setItem('maya_admin_tok',t);dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},jwt('owner-B'));
  await delayed().catch(()=>{});
  assert.equal(await page.locator('.fa-product').count(),0,'stale account results never repaint');assert.equal(await page.locator('#fabric-request').inputValue(),'');
  assert.equal(await page.locator('#hero-img').getAttribute('src'),null,'account change clears private production reference');
  await page.evaluate(()=>window.MayaFabricAssistant.open({submissionId:'project-B'}));
  assert.equal(await page.locator('.fa-product').count(),0,'different submission has no previous fabric');
  assert.deepEqual(errors,[]);
  console.log('Fabric UI: text + photo, refinements, persistent selection across screens, failures, account/project isolation, and six viewport checks passed.');
}catch(e){console.error('Fabric UI state:',await page.locator('.fa-status').allTextContents());throw e;}finally{await browser.close();}
