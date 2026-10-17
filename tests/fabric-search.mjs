// Behavioral evidence for conversational fabric discovery. No live AI or merchant calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FABRIC_SHOPS, merchantURL, normalizeFabricRequest, requestedShops, webSearchBody, readDiscovery, parseListing, applyShopifyVariant, createFabricSearch, mountFabricSearch } from '../docs/server/fabric-search.mjs';

const user={sub:'owner-A',email:'owner@example.test'}, second={sub:'owner-B',email:'other@example.test'};
const url='https://britexfabrics.com/products/crimson-wool';
const other='https://stonemountainfabric.com/product/wool-twill/';
const image='data:image/png;base64,iVBORw0KGgo=';
const seller=(overrides={})=>'<html><script type="application/ld+json">'+JSON.stringify({
  '@type':'Product',name:'Crimson wool twill',description:'100% wool. 61 inches wide. Sold by the yard.',
  image:'https://cdn.shopify.com/wool.jpg',material:'100% wool',url,
  offers:{'@type':'Offer',price:'69.99',priceCurrency:'USD',availability:'https://schema.org/InStock',url},...overrides,
})+'</script></html>';
const response=(data={})=>({status:'completed',output:[{type:'web_search_call',action:{sources:[{url},{url:other}]}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({query:'burgundy matte wool twill',observation:'Burgundy, matte and twill-like; composition cannot be confirmed from the image.',candidates:[{url,reason:'May suit the requested matte wool.'}],...data})}]}]});
let count=0;
async function test(name,run){await run();count++;console.log('  ok '+name);}
function store(){
  const records=new Map([['submissions/project-A/submission.json',{buf:Buffer.from('{}'),generation:'1'}],['submissions/project-B/submission.json',{buf:Buffer.from('{}'),generation:'1'}],['submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({client:{name:'PRIVATE NAME'},fabric_preferences:'100% wool, no polyester'})),generation:'1'}]]);
  return {records,read:async key=>records.has(key)?{ok:true,...records.get(key)}:{ok:false,status:404},write:async(key,buf,type,generation)=>{assert.equal(type,'application/json');if(String(records.get(key)?.generation||'0')!==generation)throw Object.assign(Error('conflict'),{status:412});records.set(key,{buf,generation:String(Number(generation)+1)});}};
}
await test('only approved seller product URLs can become candidates',()=>{
  for(const bad of ['http://britexfabrics.com/products/a','https://britexfabrics.com.evil.test/products/a','https://127.0.0.1/a','https://user@britexfabrics.com/products/a','https://britexfabrics.com:8443/products/a','https://britexfabrics.com/search?q=wool'])assert.equal(merchantURL(bad,true),null);
  assert.equal(merchantURL(url+'?utm_source=test',true).url,url);
  assert.ok(merchantURL('https://amazon.com/dp/B000000001',true));
  assert.ok(FABRIC_SHOPS.some(s=>s.name==='Harts Fabric'));
});
await test('photo, words and refinements use one search with bounded tools and no server storage',()=>{
  const input=normalizeFabricRequest({request:'less shiny, only Britex',image,history:[{request:'red wool',query:'red wool twill'}],piece:{fabric_spec:{fiber:'wool',weave:'twill'}},preferences:'no polyester'});
  const body=webSearchBody(input,'configured-model');
  assert.equal(body.model,'configured-model');assert.equal(body.store,false);assert.equal(body.max_tool_calls,3);assert.equal(body.tool_choice,'required');
  assert.equal(body.input[0].content[1].image_url,image);
  assert.match(body.input[0].content[0].text,/less shiny, only Britex/);assert.match(body.input[0].content[0].text,/no polyester/);
  assert.deepEqual(body.tools[0].filters.allowed_domains,['britexfabrics.com']);
  const broad=webSearchBody(normalizeFabricRequest({request:'red wool'}),'configured-model');
  assert.ok(broad.tools[0].filters.allowed_domains.includes('amazon.com'));assert.ok(broad.tools[0].filters.allowed_domains.includes('stonemountainfabric.com'));
  assert.equal(requestedShops(normalizeFabricRequest({request:'less shiny',history:[{request:'only Brightex'}]}))[0].name,'Britex Fabrics');
  assert.deepEqual(requestedShops(normalizeFabricRequest({request:'only local'})).map(s=>s.place),['San Francisco','Berkeley']);
  assert.throws(()=>normalizeFabricRequest({request:'x',image:'https://private.test/photo'}));
  assert.throws(()=>normalizeFabricRequest({request:'x',submissionId:'../project'}));
});
await test('ungrounded URLs, invented prices and unapproved sellers from AI are discarded',()=>{
  const found=readDiscovery(response({candidates:[{url,price:'1.00',reason:'Close texture'},{url:'https://britexfabrics.com/products/invented'},{url:'https://evil.test/p'},{url}]}));
  assert.equal(found.candidates.length,1);assert.equal(found.candidates[0].price,undefined);
  assert.throws(()=>readDiscovery({status:'incomplete'}));
});
await test('seller facts, price unit and stock are extracted independently of AI',()=>{
  const p=parseListing(seller(),url,0);
  assert.equal(p.price,'69.99');assert.equal(p.unit,'yard');assert.equal(p.composition,'100% wool');assert.equal(p.availability,'in_stock');assert.equal(p.checkedAt,'1970-01-01T00:00:00.000Z');
  const half=parseListing(seller({description:'Sold in half yard increments.'}),url);assert.equal(half.unit,'half yard');
  assert.equal(parseListing(seller({description:'Drapey wool'}),url).price,'','Unknown selling unit hides price');
});
await test('seller images require a real URL and choose the first valid structured or metadata fallback',()=>{
  for(const image of [undefined,'',{},null,[],{url:null},'undefined','null'])assert.equal(parseListing(seller({image}),url).image,'','Missing image never becomes a fabricated relative URL');
  assert.equal(parseListing(seller({image:['',{},'http://cdn.example/insecure.jpg','//cdn.example/denim.jpg']}),url).image,'https://cdn.example/denim.jpg');
  assert.equal(parseListing(seller({image:{contentUrl:'/images/denim.jpg'}}),url).image,'https://britexfabrics.com/images/denim.jpg');
  const metadata='<meta property="og:image" content="https://cdn.example/fallback.webp?width=800&amp;quality=80">';
  assert.equal(parseListing(seller({image:[{},'http://cdn.example/insecure.jpg']})+metadata,url).image,'https://cdn.example/fallback.webp?width=800&quality=80');
});
await test('listings without a source image never enter recommendations or the paid visual pass',async()=>{
  let rankCalls=0;const events=[];
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller({image:undefined})),rank:async input=>{rankCalls++;return input.products;}});
  await service.search(user,{request:'crimson wool',image,history:[{request:'wool'}]},event=>events.push(event));
  assert.equal(rankCalls,0);assert.deepEqual(events.at(-1).products,[]);
});
await test('swatch/yardage variants and aggregate price are never conflated',()=>{
  const swatch={price:'3',priceCurrency:'USD',url:url+'?variant=swatch',availability:'https://schema.org/InStock'};
  const yard={price:'69.99',priceCurrency:'USD',url:url+'?variant=yard',availability:'https://schema.org/InStock'};
  assert.equal(parseListing(seller({offers:[swatch,yard]}),url).price,'');
  assert.equal(parseListing(seller({offers:[swatch,yard]}),url+'?variant=yard').price,'','Variant identifier alone does not establish the selling unit');
  assert.equal(parseListing(seller({offers:{'@type':'AggregateOffer',lowPrice:'3',highPrice:'69.99',priceCurrency:'USD'}}),url).price,'');
  assert.equal(parseListing(seller({name:'Wool swatch'}),url).isSwatch,true);
  const data={handle:'crimson-wool',price:300,variants:[{id:1,title:'Default Title',price:6999,available:true},{id:2,title:'Swatch',price:300,available:true}]};
  const html=seller()+'<span>$69.99 / yard</span>';
  assert.equal(applyShopifyVariant(parseListing(html,url),data,html).price,'69.99');
  assert.equal(applyShopifyVariant(parseListing(html,url+'?variant=2'),data,html).isSwatch,true);
});
await test('out of stock is rejected, unknown stock remains explicit and redirects cannot escape',async()=>{
  let visits=[];
  const service=createFabricSearch({...store(),fetchImpl:async u=>{visits.push(u);return new Response(seller({offers:{price:'20',priceCurrency:'USD',availability:'https://schema.org/OutOfStock'}}));}});
  assert.equal(await service.verify({url}),null);
  const redirected=createFabricSearch({...store(),fetchImpl:async u=>{visits.push(u);return new Response('',{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}});}});
  const p=await redirected.verify({url});assert.equal(p.evidence,'search_link');assert.equal(p.price,'');assert.equal(p.availability,'unknown');assert.equal(visits.length,2);
  const blocked=createFabricSearch({...store(),fetchImpl:async()=>new Response('<html>Robot check</html>')});
  const amazon=await blocked.verify({url:'https://amazon.com/dp/B000000001'});assert.equal(amazon.evidence,'search_link');assert.equal(amazon.image,'');
});
await test('early seller results arrive while web reasoning is still pending',async()=>{
  let finish, called;const pending=new Promise(r=>finish=r), started=new Promise(r=>called=r);const events=[];
  const s=store();let sent;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async(u,o)=>{
    if(u.includes('api.openai.com')){sent=JSON.parse(o.body);called();await pending;return Response.json(response());}
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,available:true}]}}});
    return new Response(seller());
  }});
  const run=service.search(user,{submissionId:'project-A',request:'crimson wool',image},e=>events.push(e));
  await started;
  for(let i=0;i<20&&!events.some(e=>e.type==='products');i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(events.some(e=>e.type==='products'&&e.preliminary));assert.ok(!events.some(e=>e.type==='done'));
  assert.match(sent.input[0].content[0].text,/100% wool, no polyester/);assert.doesNotMatch(JSON.stringify(sent),/PRIVATE NAME/);
  finish();await run;assert.equal(events.at(-1).products.length,1);assert.ok(events.at(-1).timings.firstResultsMs!==null);assert.match(events.at(-1).warning,/photos have not been compared/);
});
await test('empty/error searches retry and never populate a shared private query cache',async()=>{
  const s=store();let calls=0;const events=[];
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async u=>{if(u.includes('openai')){calls++;return new Response('',{status:503});}return new Response('',{status:503});}});
  for(let n=0;n<2;n++)await service.search(user,{request:'matte wool',history:[{request:'red wool'}]},e=>events.push(e));
  assert.equal(calls,2);assert.ok(events.at(-1).warning);assert.equal(events.at(-1).products.length,0);
  assert.equal([...s.records.keys()].some(k=>k.startsWith('catalog/')),false);
});
await test('lookbooks isolate accounts and submissions, persist selection and reject stale writes',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured'}),product=parseListing(seller(),url);
  const b=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',product});assert.equal(b.selectedUrl,url);
  assert.equal((await service.loadBook(second,'project-A')).items.length,0);assert.equal((await service.loadBook(user,'project-B')).items.length,0);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'0',action:'save',product}),e=>e.status===409);
  const removed=await service.saveBook(user,{submissionId:'project-A',generation:b.generation,action:'remove',product});assert.equal(removed.items.length,0);assert.equal(removed.selectedUrl,'');
  await assert.rejects(service.loadBook(user,'does-not-exist'),e=>e.status===404);
});
await test('automatic searches require saved dissection and trust saved garment context over supplied guesses',async()=>{
  const s=store();let sent;
  const denim='https://britexfabrics.com/products/indigo-denim';
  const shirt='https://stonemountainfabric.com/product/white-cotton-poplin/';
  const scissors='https://britexfabrics.com/products/fabric-scissors';
  const leather='https://britexfabrics.com/products/black-leather';
  const pages=new Map([[denim,{name:'Indigo cotton denim',description:'Cotton denim, sold by the yard.'}],[shirt,{name:'White cotton poplin',description:'100% cotton, sold by the yard.'}],[scissors,{name:'Fabric scissors',description:'Scissors for denim and cotton fabric.'}],[leather,{name:'Black leather',description:'Black leather, sold by the hide.'}]]);
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async(u,o)=>{
    if(u.includes('api.openai.com')){sent=JSON.parse(o.body);return Response.json({output:[{type:'web_search_call',action:{sources:[...pages.keys()].map(url=>({url}))}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[...pages.keys()].map(url=>({url,reason:'model suggestion',garment:'Incorrect model garment'}))})}]}]});}
    assert.ok(!u.includes('suggest.json'),'Automatic multi-garment search cannot publish a weak literal fallback');
    return new Response(seller({...pages.get(u),url:u}));
  }});
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true},()=>{}),e=>e.status===409);
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Denim top',fabric:'indigo denim'},{name:'White shirt',fabric:'white cotton poplin'},{name:'Black boots',fabric:'black leather',category:'footwear'}]})),generation:'1'});
  // These preferences are for the earlier wool fixture, not this saved look.
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:'Natural fabrics preferred'})),generation:'2'});
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,image,pieces:[{name:'Wrong',fabric:'leather'}]},e=>events.push(e));
  assert.deepEqual(events.at(-1).products.map(p=>[p.title,p.garment]),[['Indigo cotton denim','Denim top'],['White cotton poplin','White shirt']]);
  const input=JSON.parse(sent.input[0].content[0].text);assert.equal(input.garments.length,2);assert.doesNotMatch(JSON.stringify(input),/Wrong|boots|leather/);assert.equal(sent.input[0].content[1].image_url,image);
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Wrong'}},()=>{}),e=>e.status===409);
  const selected=[];await service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Denim top',fabric:'leather'},stores:['britexfabrics.com']},e=>selected.push(e));
  assert.deepEqual(selected.at(-1).products.map(p=>p.title),['Indigo cotton denim']);assert.deepEqual(sent.tools[0].filters.allowed_domains,['britexfabrics.com']);
});
await test('local in-house photo favorites share the sealed book without invented inventory or arrival',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured'});
  const product={url:'/aesthetics/fabrics/Midnight%20Velvet.JPG',title:'Midnight Velvet',price:'in stock',etaDays:7,availability:'in_stock',garment:'Evening jacket'};
  const book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',product});
  assert.equal(book.items[0].image,product.url);assert.equal(book.items[0].availability,'unknown');assert.equal(book.items[0].etaDays,undefined);assert.equal(book.items[0].price,undefined);
  assert.equal((await service.loadBook(second,'project-A')).items.length,0);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...product,url:'/aesthetics/fabrics/%2e%2e/private.png'}}));
});
await test('real dissection handoff preserves all traits; original photo and early paint reach ranking',async()=>{
  const source=readFileSync(new URL('../backend/backend.html',import.meta.url),'utf8');
  const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const code=extract('const _pieceSources = new WeakMap()', '// v0.9: focusPiece')+extract('function _sourcingQuery(piece, fabricStr)', '// ── v13.53: Nano Banana');
  const paints=[],calls=[];let resolveRank;
  const rank=new Promise(r=>resolveRank=r);
  const piece={name:'Coat',fabric:'Crimson wool',fabric_hex:'#991b2a',fabric_spec:{fiber:'wool',weave:'twill',sheen:'matte',stretch:'none',texture:'brushed',weight_gsm:null},_image:'generated-piece',jacket_construction:'double-breasted'};
  const sandbox={_pieceState:null,_COLOR_RGB:{crimson:[]},_liveSourceCache:{},_visualRankCache:{},_fabricSourceOverride:'sourceable',localStorage:{getItem:()=> 'fake'},window:{},_fabActivePiece:()=>normalized,_renderFabCards:v=>paints.push(v),fetch:async(u,o)=>{calls.push({u,o});return u.startsWith('/api/source-fabric')?{ok:true,json:async()=>({products:[{...parseListing(seller(),url),image:'https://cdn.shopify.com/wool.jpg'}]})}:rank;}};
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  const normalized=sandbox.inferPieces({_dissection:{pieces:[piece]}})[0];
  assert.equal(normalized.fabric_spec.weave,'twill');assert.equal(normalized.fabric_hex,'#991b2a');assert.equal(normalized.jacket_construction,'double-breasted');
  sandbox._pieceState={heroImage:'original-photo',pieces:[normalized]};
  const running=sandbox._fetchLiveSourcing('Crimson wool',normalized);
  await new Promise(r=>setTimeout(r,0));assert.equal(paints.length,1);
  const body=JSON.parse(calls[1].o.body);assert.equal(body.garment_image,'original-photo');assert.equal(body.traits.weave,'twill');assert.equal(body.traits.color,'#991b2a');
  resolveRank({ok:true,json:async()=>({matches:[]})});await running;assert.equal(paints.length,2);
});
await test('routes authenticate before search or lookbook IO and limit search requests',async()=>{
  const routes=[];const app={post:(...a)=>routes.push(a),get:(...a)=>routes.push(a)};let reads=0;
  mountFabricSearch(app,{requireAdmin:async()=>{throw Object.assign(Error('denied'),{status:403});},requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),read:async()=>{reads++;},write:async()=>{},model:'fake'});
  for(const route of routes){let code;const res={on(){},status(n){code=n;return this;},json(){},set(){return this;}};await route.at(-1)({body:{},query:{}},res);assert.equal(code,403);}
  assert.equal(reads,0);
});
await test('duplicate garment names require stable saved identity instead of selecting the first',async()=>{
  const s=store();s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Shirt',fabric:'red wool'},{name:'Shirt',fabric:'white cotton poplin'}]})),generation:'1'});
  let sent;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{if(u.includes('openai')){sent=JSON.parse(JSON.parse(o.body).input[0].content[0].text);return Response.json(response());}return new Response(seller({name:'White cotton poplin fabric',description:'100% cotton. Sold by the yard.',material:'100% cotton'}));}});
  await assert.rejects(service.search(user,{submissionId:'project-A',automatic:true,piece:{name:'Shirt'}},()=>{}),e=>e.status===409);
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'saved-piece-1',name:'Shirt'}},e=>events.push(e));
  assert.equal(sent.garment.fabric,'white cotton poplin');assert.equal(events.at(-1).products[0].garmentId,'saved-piece-1');
});
await test('one visual pass only sees eligible seller products and cannot introduce a URL or weak fallback',async()=>{
  const s=store(),events=[];let calls=0,seen;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async input=>{calls++;seen=input;return [{url,reason:'Closer brushed surface',matchScore:88},{url:'https://britexfabrics.com/products/invented'}];}});
  await service.search(user,{submissionId:'project-A',request:'crimson wool twill',image,history:[{request:'wool'}]},e=>events.push(e));
  assert.equal(calls,1);assert.equal(seen.garmentImage,image);assert.match(seen.traits.request,/crimson wool/);assert.equal(seen.products.length,1);
  assert.equal(events.at(-1).products.length,1);assert.equal(events.at(-1).products[0].matchScore,undefined);assert.equal(events.at(-1).products[0].price,'69.99');
  const unavailable=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async()=>{throw Error('timeout');}});
  const failed=[];await unavailable.search(user,{request:'wool twill',image,history:[{request:'wool'}]},e=>failed.push(e));
  assert.deepEqual(failed.at(-1).products,[]);assert.match(failed.at(-1).warning,/comparison was unavailable/);
  const rejected=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller()),rank:async()=>[]});
  const weak=[];await rejected.search(user,{request:'wool twill',image,history:[{request:'wool'}]},e=>weak.push(e));assert.deepEqual(weak.at(-1).products,[]);
});
await test('uncertain saved fiber requires a successful visual check and never a keyword fallback',async()=>{
  const s=store();s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Jacket',fabric:'Unknown fiber, matte structured surface'}]})),generation:'1'});
  const common={...s,apiKey:()=> 'fake',fetchImpl:async u=>u.includes('openai')?Response.json(response()):new Response(seller())};
  let count=0;const events=[];await createFabricSearch({...common,rank:async ({products})=>{count++;return products;}}).search(user,{automatic:true,submissionId:'project-A',image},e=>events.push(e));
  assert.equal(count,1);assert.equal(events.at(-1).products.length,1);
  const without=[];await createFabricSearch(common).search(user,{automatic:true,submissionId:'project-A',image},e=>without.push(e));assert.deepEqual(without.at(-1).products,[]);
});
await test('selected garment ranks its saved crop while discovery keeps the original whole look',async()=>{
  const s=store(),crop='data:image/png;base64,c2F2ZWQtZGVuaW0=';let ranked,discovered;
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{}'),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'denim',name:'Denim jacket',fabric:'indigo denim',_image:crop},{id:'shirt',name:'White shirt',fabric:'white cotton poplin',_image:image}]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{if(u.includes('openai')){discovered=JSON.parse(o.body);return Response.json(response());}return new Response(seller({name:'Indigo denim fabric',description:'100% cotton denim. Sold by the yard.',material:'100% cotton'}));},rank:async input=>{ranked=input;return input.products;}});
  const events=[];await service.search(user,{submissionId:'project-A',automatic:true,image,piece:{id:'denim',_image:'untrusted-client-crop'}},e=>events.push(e));
  assert.equal(discovered.input[0].content[1].image_url,image);assert.equal(ranked.garmentImage,crop);assert.equal(ranked.traits.garmentId,'denim');assert.equal(ranked.products[0].garmentId,'denim');
  assert.equal(events.at(-1).products[0].garment,'Denim jacket');assert.doesNotMatch(JSON.stringify(discovered),/untrusted-client-crop/);
});
await test('supplementary seller results cannot bypass a failed visual check when web search fails',async()=>{
  const events=[];let calls=0;
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async u=>{
    if(u.includes('openai'))return new Response('',{status:503});
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,available:true}]}}});
    return new Response(seller());
  },rank:async()=>{calls++;throw Error('visual unavailable');}});
  await service.search(user,{request:'crimson wool',image},event=>events.push(event));
  assert.ok(events.some(event=>event.preliminary&&event.products.length));assert.equal(calls,1);
  assert.deepEqual(events.at(-1).products,[]);assert.match(events.at(-1).warning,/comparison was unavailable/);
});
console.log(`Fabric search: ${count} behavioral checks passed.`);
