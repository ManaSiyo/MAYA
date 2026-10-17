// Real Brief + reused Operation Room, fake providers and an isolated browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {validDesign} from '../docs/server/design-config.mjs';
const root=resolve('.'),png=readFileSync(root+'/aesthetics/ui/logo-circle.png');
const image='data:image/png;base64,'+png.toString('base64');
const jwt=(sub,version=1)=>'fixture.'+Buffer.from(JSON.stringify({sub,version,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const pieces={fabric_type:'cotton denim',pieces:[{name:'Denim jacket',category:'jacket',_image:image,fabric_spec:{fiber:'cotton',weave:'denim'}},{name:'White shirt',category:'shirt',fabric:'white cotton poplin',_image:image},{name:'Black boots',category:'shoes',fabric:'black leather',_image:image}]};
const folders=['A','B'].map(id=>({id,name:'Client '+id,files:[{id:id+'-summary',name:'summary.json'},{id:id+'-image',name:'dream-garment.png'},...(id==='A'?[{id:'A-pieces',name:'pieces.json'}]:[])]}));
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],searches=[],paid=[];
page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(token=>localStorage.setItem('maya_admin_tok',token),jwt('owner-A'));
await page.route('**/*',async route=>{
 const u=new URL(route.request().url());if(u.hostname!=='maya.test')return route.abort();
 if(u.pathname==='/api/admin/submissions')return route.fulfill({json:{folders}});
 if(u.pathname==='/api/admin/subfile'){
  const id=u.searchParams.get('id');
  if(id==='A-pieces')return route.fulfill({json:pieces,headers:{'X-Maya-Generation':'1','Cache-Control':'private, no-store'}});
  if(id?.endsWith('-summary'))return route.fulfill({json:{client:{name:'Client '+id[0]},fabric_preferences:'Natural fibers'}});
  return route.fulfill({body:png,contentType:'image/png'});
 }
 if(u.pathname==='/api/admin/subthumb')return route.fulfill({body:png,contentType:'image/png'});
 if(u.pathname==='/api/admin/fabrics/lookbook')return route.fulfill({json:{ok:true,items:[],selectedUrl:'',generation:'0'}});
 if(u.pathname==='/api/admin/fabrics/search'){
  searches.push(route.request().postDataJSON());
  return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'done',products:[],message:'No verified matches in this fixture.'})+'\n'});
 }
 if(u.pathname.startsWith('/api/')){paid.push(u.pathname);return route.fulfill({status:503,json:{error:'Paid generation is forbidden during read fixtures.'}});}
 const path=u.pathname==='/backend.html'?'/backend/backend.html':u.pathname==='/operations.html'?'/backend/operations.html':u.pathname;
 try{return route.fulfill({body:readFileSync(root+path),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(path)]||'text/plain'});}catch{return route.abort();}
});
try{
 await page.goto('https://maya.test/backend.html?submission=A&name=ClientA');
 await page.locator('#piece-pills').getByRole('button',{name:'Denim jacket',exact:true}).waitFor();
 const room=page.frameLocator('#operations-embed');
 await room.locator('#test-picker option').filter({hasText:'Denim jacket'}).waitFor({state:'attached'});
 const roomFrame=page.frames().find(frame=>frame.url().includes('/operations.html'));
 assert.equal(await page.locator('#screens > section[data-screen]').count(),2);
 assert.equal(await page.locator('#fab-tab-pill').count(),0,'No redundant bottom Fabrics action');
 assert.equal(await page.locator('#piece-pills [data-maya-semantic="non-fabric"]').textContent(),'Black boots');
 assert.equal(await room.locator('#test-picker option').count(),3,'Only the three saved pieces are offered');
 assert.equal(await room.locator('header.top').isVisible(),false,'The embedded room has no duplicate fixed header');
 assert.equal(await room.getByText('Upload',{exact:true}).first().isVisible(),true,'Upload remains available in the embedded room');
 assert.deepEqual(paid,[]);assert.equal(searches.length,0,'Opening saved work does not start fabric search');
 await page.locator('#piece-pills').getByRole('button',{name:'White shirt',exact:true}).click();
 await roomFrame.waitForFunction(()=>document.getElementById('test-picker').value==='White shirt');
 assert.deepEqual(paid,[],'Selecting a saved garment never draws a pattern');
 await page.locator('#brief-fabrics-button').click();
 await page.waitForFunction(()=>!!document.querySelector('#brief-fabrics .fa-results'));
 await page.waitForFunction(()=>!document.querySelector('#brief-fabrics .fa-status')?.textContent.includes('Searching'));
 await page.waitForTimeout(100);
 assert.equal(await page.locator('dialog#fabric-assistant[open]').count(),0,'Fabrics starts inline');
 assert.equal(searches.length,1);assert.equal(searches[0].submissionId,'A');assert.equal(searches[0].piece.name,'White shirt');assert.equal(searches[0].preferences,'Natural fibers');assert.match(searches[0].image,/^data:image\//);
 await page.screenshot({path:'/private/tmp/maya-brief-inline-fabrics.png'});
 await page.locator('#piece-pills').getByRole('button',{name:'Full view',exact:true}).click();
 await page.locator('#brief-fabrics-button').click();
 await page.waitForTimeout(200);
 assert.equal(searches.at(-1).piece?.name||'','', 'Full view asks about the whole look');
 assert.equal(searches.at(-1).pieces.length,3,'Whole look retains all saved dissection context');
 await page.locator('#fabric-workspace-actions').getByRole('button',{name:'Operation Room',exact:true}).click();
 await page.waitForFunction(()=>Math.abs(document.getElementById('screens').scrollTop-document.getElementById('screen-operating').offsetTop)<2);
 await room.locator('#test-picker').selectOption('Denim jacket');
 await roomFrame.evaluate(()=>_garmentReady);
 await roomFrame.evaluate(()=>{document.getElementById('m-waist').value='36';saveMeasures();});
 await page.evaluate(token=>{localStorage.setItem('maya_admin_tok',token);window.dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));},jwt('owner-A',2));
 assert.equal(await roomFrame.evaluate(()=>getMeasures().waist),36,'Same-account token renewal preserves garment measurements');
 const accepted=await roomFrame.evaluate(()=>({revision:_operationRevision,context:_operationInputContext}));
 await page.evaluate(({revision,context})=>document.getElementById('operations-embed').contentWindow.postMessage({maya:'ops-pieces',revision:revision+1,context:{...context,account:'other-owner',pieces:[]}},location.origin),accepted);
 await roomFrame.evaluate(({revision,context})=>window.dispatchEvent(new MessageEvent('message',{origin:'https://foreign.test',source:window.parent,data:{maya:'ops-pieces',revision:revision+1,context:{...context,pieces:[]}}})),accepted);
 await roomFrame.evaluate(({revision,context})=>window.postMessage({maya:'ops-pieces',revision:revision+1,context:{...context,pieces:[]}},location.origin),accepted);
 await page.waitForTimeout(50);
 assert.equal(await roomFrame.evaluate(()=>_operationRevision),accepted.revision,'Wrong account, origin and source cannot replace the saved context');
 assert.equal(await roomFrame.evaluate(()=>getMeasures().waist),36);
 await page.evaluate(()=>{window._openedSubmission={id:'B',name:'Client B'};return _loadSubmission(_subCachedTok());});
 await roomFrame.waitForFunction(()=>_operationInputContext?.submissionId==='B'&&HERO===null);
 assert.equal(await room.locator('#operation-fabrics').isDisabled(),true);
 assert.equal(await page.locator('#brief-fabrics-button').isDisabled(),true,'Undissected submission cannot open sourcing');
 await page.evaluate(({revision,context})=>document.getElementById('operations-embed').contentWindow.postMessage({maya:'ops-pieces',revision,context},location.origin),accepted);
 assert.equal(await roomFrame.evaluate(()=>_operationInputContext.submissionId),'B','Old revision cannot restore the previous submission');
 assert.deepEqual(paid,[]);
 // The retained standalone URL uses the same saved-garment loader, never a sample or full look.
 await page.goto('https://maya.test/operations.html?submission=A');
 await page.locator('#test-picker option').filter({hasText:'Denim jacket'}).waitFor({state:'attached'});
 assert.equal(await page.locator('#test-picker option').count(),3);
 assert.equal(await page.locator('header.top').isVisible(),true);
 assert.equal(await page.evaluate(()=>FILES.piece.fabric),'cotton denim','Legacy dissection-level fabric survives normalization');
 assert.deepEqual(paid,[]);
 const widths=[320,390,768,1024,1440,1920];
 for(const width of widths){
  await page.setViewportSize({width,height:width<768?844:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Standalone room fits '+width);
 }
 const saved=await page.evaluate(()=>{
  const v=structuredClone(MayaTypographyControls.defaults);
  for(const [role,size]of Object.entries({H1:28,H2:24,H3:20,H4:18,P1:16,P2:14,P3:12}))Object.assign(v.type[role],{size,font:'cormorant',weight:500,style:'italic'});
  Object.assign(v.glass,{fill:55,blur:9,rim:72,saturation:120});v.pillX=22;v.pillY=10;
  Object.assign(v.editor,{background:'blue',fill:80,rim:65,paddingX:17,paddingY:11,radius:18});
  Object.assign(v.inner,{background:'green',fill:65,blur:13,saturation:140,paddingX:23,paddingY:17,radius:20});
  v.semanticStyles.nonFabric={color:'#123abc',opacity:65};
  return v;
 });
 assert.ok(validDesign(saved),'The changed presentation is a valid owner-saveable design');
 const style=async(locator,keys)=>locator.evaluate((e,keys)=>Object.fromEntries(keys.map(k=>[k,getComputedStyle(e)[k]])),keys);
 for(const mode of ['default','saved']){
  if(mode==='saved')await page.evaluate(value=>MayaTypographyControls.save(value),saved);
  await page.goto('https://maya.test/backend.html?submission=A&name=ClientA');
  await page.locator('#piece-pills').getByRole('button',{name:'Black boots',exact:true}).waitFor();
  const embedded=page.frameLocator('#operations-embed');
  const liveFrame=page.frames().find(frame=>frame.url().includes('/operations.html'));
  await embedded.locator('#test-picker option').filter({hasText:'Black boots'}).waitFor({state:'attached'});
  await page.locator('#piece-pills').getByRole('button',{name:'Black boots',exact:true}).click();
  await liveFrame.waitForFunction(()=>document.getElementById('test-picker').dataset.mayaSemantic==='non-fabric');
  const color=mode==='saved'?'rgba(18, 58, 188, 0.65)':'rgb(253, 230, 138)';
  assert.equal((await style(page.locator('#piece-pills [data-maya-semantic="non-fabric"]'),['color'])).color,color);
  assert.equal((await style(embedded.locator('#test-picker'),['color'])).color,color,'Operations selected shoe has the governed semantic color');
  const material=mode==='saved'?{paddingLeft:'23px',paddingTop:'17px',backgroundColor:'rgba(23, 91, 59, 0.65)',backdropFilter:'blur(13px) saturate(1.4)'}:{paddingLeft:'16px',paddingTop:'12px',backgroundColor:'rgba(0, 0, 0, 0.18)',backdropFilter:'blur(22px) saturate(1.8)'};
  assert.deepEqual(await style(embedded.locator('#plan-a-view .panel').first(),Object.keys(material)),material,'Actual Operations panels use '+mode+' shared material');
  const field=mode==='saved'?{paddingLeft:'17px',paddingTop:'11px',backgroundColor:'rgba(35, 76, 125, 0.8)',borderRadius:'18px'}:{paddingLeft:'8px',paddingTop:'8px',backgroundColor:'rgb(0, 0, 0)',borderRadius:'12px'};
  assert.deepEqual(await style(embedded.locator('#test-picker'),Object.keys(field)),field,'Actual garment field uses '+mode+' saved editor style');
  const capsule={paddingLeft:mode==='saved'?'22px':'14px',paddingTop:mode==='saved'?'10px':'6px',backgroundColor:mode==='saved'?'rgba(3, 15, 29, 0.55)':'rgba(3, 15, 29, 0.18)'};
  for(const control of [page.locator('#brief-fabrics-button'),embedded.locator('#operation-fabrics')])assert.deepEqual(await style(control,Object.keys(capsule)),capsule,'Fabrics actions share '+mode+' pill geometry/material');
  assert.equal((await style(page.locator('#operations-heading'),['fontSize'])).fontSize,mode==='saved'?'24px':'20px');
  if(mode==='saved')for(const control of [page.locator('#operations-heading'),page.locator('#brief-fabrics-button'),embedded.locator('#test-picker'),embedded.locator('#operation-fabrics')]){
   const type=await style(control,['fontFamily','fontWeight','fontStyle']);assert.match(type.fontFamily,/Cormorant/);assert.equal(type.fontWeight,'500');assert.equal(type.fontStyle,'italic');
  }
  for(const width of widths){
   await page.setViewportSize({width,height:width<768?844:1000});
   await page.evaluate(()=>goToScreen(0));await page.waitForFunction(()=>document.getElementById('screens').scrollTop<20);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Brief '+mode+' fits '+width);
   if(width<=768)assert.ok(await page.locator('.op-image-col').evaluate(e=>e.clientWidth>=innerWidth-34),'Mobile Brief gives the viewer the full content width');
   if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-brief-'+mode+'-'+width+'.png'});
   await page.evaluate(()=>goToScreen(1));
   await page.waitForFunction(()=>Math.abs(document.getElementById('screens').scrollTop-document.getElementById('screen-operating').offsetTop)<2);
   const box=await page.locator('#operations-embed').boundingBox();assert.ok(box.width>200&&box.height>200&&box.x>=0&&box.x+box.width<=width+1,'Embedded '+mode+' workspace fits '+width);
   assert.equal(await liveFrame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Embedded '+mode+' content fits '+width);
   for(const panel of await embedded.locator('#plan-a-view .cols>.panel').all())assert.ok(await panel.evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1;}),'Operation panels remain reachable at '+mode+' '+width);
   if(width===390||width===1440)await page.screenshot({path:'/private/tmp/maya-brief-operations-'+mode+'-'+width+'.png'});
  }
 }
 // Navigating between screens must not replay the Brief's older garment choice.
 await page.evaluate(()=>goToScreen(1));
 const activeRoom=page.frames().find(frame=>frame.url().includes('/operations.html'));
 await activeRoom.evaluate(()=>{pickTest('White shirt');PASSES=[{img:'retained-result',badge:'local review'}];document.getElementById('t-prompt').textContent='PRIVATE PATTERN PROMPT';});
 await page.evaluate(()=>goToScreen(0));await page.locator('#fabric-workspace-actions').getByRole('button',{name:'Operation Room',exact:true}).click();
 assert.equal(await activeRoom.evaluate(()=>ACTIVE_TEST),'White shirt');assert.equal(await activeRoom.evaluate(()=>PASSES[0]?.img),'retained-result','Pure navigation preserves results');
 // Full-size inline viewport under both material settings, including narrower embedded columns.
 for(const mode of ['default','saved']){
  await activeRoom.evaluate((value)=>MayaTypographyControls.apply(value),mode==='saved'?saved:await activeRoom.evaluate(()=>MayaTypographyControls.defaults));
  await activeRoom.evaluate(()=>openOperationFabrics());
  for(const width of widths){
   await page.setViewportSize({width,height:1000});
   const body=await activeRoom.locator('.fa-body').boundingBox();assert.ok(body.height>=150,mode+' embedded fabric results have a usable viewport at '+width+' '+body.height);
   assert.ok(await activeRoom.locator('#fabric-assistant').evaluate(e=>e.scrollWidth<=e.clientWidth+1),mode+' embedded fabrics fit '+width);
   if(width===320||width===1024)await activeRoom.locator('#fabric-assistant').screenshot({path:'/private/tmp/maya-operation-fabrics-'+mode+'-'+width+'.png'});
  }
 }
 // Duplicate labels select the second stable saved piece in both real pages.
 pieces.pieces.push({name:'White shirt',fabric:'blue linen poplin',_image:image});
 await page.goto('https://maya.test/backend.html?submission=A');
 await page.locator('#piece-pills').getByRole('button',{name:'White shirt',exact:true}).nth(1).waitFor();
 await page.locator('#piece-pills').getByRole('button',{name:'White shirt',exact:true}).nth(1).click();await page.locator('#brief-fabrics-button').click();
 await page.waitForFunction(()=>document.querySelector('.fa-status')?.textContent==='No verified matches in this fixture.');
 assert.equal(searches.at(-1).piece.id,'saved-piece-3');assert.equal(searches.at(-1).piece.fabric,'blue linen poplin');
 const duplicateRoom=page.frames().find(frame=>frame.url().includes('/operations.html'));
 await duplicateRoom.waitForFunction(()=>FILES.piece?.id==='saved-piece-3');
 // Sign-out clears all visible/private summary and generated prompt state immediately.
 await duplicateRoom.evaluate(()=>document.getElementById('t-prompt').textContent='PRIVATE PATTERN PROMPT');
 await page.evaluate(()=>{localStorage.removeItem('maya_admin_tok');window.dispatchEvent(new StorageEvent('storage',{key:'maya_admin_tok'}));});
 await page.waitForFunction(()=>window._currentSnap===null&&window.lastSummary===null);
 for(const id of ['op-hero-name','op-biography','op-vision','op-measurements','op-chips'])assert.equal(await page.locator('#'+id).textContent(),'','Sign-out clears '+id);
 await duplicateRoom.waitForFunction(()=>document.getElementById('t-prompt').textContent==='');
 assert.equal(await duplicateRoom.evaluate(()=>PASSES.length),0);
 // Standalone heading grows with saved H1 typography instead of clipping above the viewport.
 await page.evaluate(token=>localStorage.setItem('maya_admin_tok',token),jwt('owner-A'));
 await page.goto('https://maya.test/operations.html?submission=A');await page.locator('#test-picker option').nth(1).waitFor({state:'attached'});
 for(const width of widths){await page.setViewportSize({width,height:1000});const heading=await page.locator('.brand h1').boundingBox();assert.ok(heading.y>=0&&heading.x>=0&&heading.x+heading.width<=width+1,'Standalone heading contained at '+width);if(width===320)await page.screenshot({path:'/private/tmp/maya-operation-heading-320.png'});}
 assert.deepEqual(errors,[]);assert.deepEqual(paid,[]);
 console.log('Brief workspace: saved-piece embedding, inline garment/whole-look sourcing, legacy context, no generation on read, scoped messages, token renewal, standalone route and default/saved aesthetic authority at six widths passed.');
}catch(error){console.error('Brief fixture state',errors,await page.locator('#piece-pills').allTextContents());await page.screenshot({path:'/private/tmp/maya-brief-workspace-failure.png'});throw error;}finally{await browser.close();}
