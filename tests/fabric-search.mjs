// Behavioral evidence for conversational fabric discovery. No live AI or merchant calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FABRIC_SHOPS, FABRIC_STORE_GROUPS, merchantURL, normalizeFabricRequest, requestedShops, webSearchBody, readDiscovery, parseListing, applyShopifyVariant, createFabricSearch, mountFabricSearch } from '../docs/server/fabric-search.mjs';

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
  assert.deepEqual(requestedShops(normalizeFabricRequest({request:'only local'})).map(s=>s.place),['San Francisco','Berkeley','Santa Cruz']);
  assert.throws(()=>normalizeFabricRequest({request:'x',image:'https://private.test/photo'}));
  assert.throws(()=>normalizeFabricRequest({request:'x',submissionId:'../project'}));
});
await test('five explicit store groups replace stale merchant-only history without broadening invalid filters',()=>{
  assert.deepEqual(FABRIC_STORE_GROUPS.map(group=>group.label),['Local (Bay Area)','Mood','Swatchon','Amazon','Others']);
  const ui=readFileSync(new URL('../aesthetics/ui/fabric-assistant.js',import.meta.url),'utf8');
  const browserGroups=JSON.parse(vm.runInNewContext(ui.slice(ui.indexOf('const storeGroups='),ui.indexOf('let searchSeq='))+'JSON.stringify(storeGroups)'));
  assert.deepEqual(browserGroups,FABRIC_STORE_GROUPS.map(group=>({...group,hosts:group.hosts.map(host=>host.replace(/^www\./,''))})),'Browser and server classify every approved merchant identically');
  for(const group of FABRIC_STORE_GROUPS){
    const input=normalizeFabricRequest({request:'less shiny, only Britex',history:[{request:'only Britex red wool'}],storeGroups:[group.id]});
    assert.deepEqual(requestedShops(input).map(shop=>shop.host).sort(),[...group.hosts].sort());
    const payload=webSearchBody(input,'fixture');assert.match(payload.input[0].content[0].text,/less shiny/);assert.match(payload.instructions,/never confirms pickup/);
  }
  assert.deepEqual(requestedShops(normalizeFabricRequest({request:'red wool',stores:['moodfabrics.com']})).map(shop=>shop.name),['Mood Fabrics']);
  for(const storeGroups of [[],['unknown'],['local','unknown'],'mood'])assert.throws(()=>normalizeFabricRequest({request:'wool',storeGroups}),/supported store/);
  assert.throws(()=>normalizeFabricRequest({request:'wool',stores:['evil.test']}),/supported fabric store/);
  assert.equal(requestedShops(normalizeFabricRequest({request:'wool'})).length,FABRIC_SHOPS.length,'No silent local-only default');
});
await test('Swatchon uses exact sourced product paths and SKU photos, never aggregate or swatch prices',()=>{
  const link='https://www.swatchon.com/fabric/QL-061078';
  for(const good of [link,'https://swatchon.com/wholesale-fabric/14620'])assert.equal(merchantURL(good,true).shop.name,'Swatchon');
  for(const bad of ['https://www.swatchon.com/fabric','https://www.swatchon.com/products/invented','https://www.swatchon.com/fabric/wool','https://www.swatchon.com/help/articles/how-swatchon-works','https://swatchon.com.evil.test/fabric/QL-061078'])assert.equal(merchantURL(bad,true),null);
  const html=seller({name:'Enzyme Cotton Twill',url:link,sku:'QL-061078',image:[],description:'Cotton 100%. Order from 1 yard, ships from Korea.',offers:{'@type':'AggregateOffer',lowPrice:7.48,highPrice:12.47,priceCurrency:'USD',url:link}})+'<meta property="og:image" content="https://www.swatchon.com/images/og-default.png"><img src="https://seller.test/unrelated.jpg" alt="QL-000001 1"><img src="https://seller.test/QL-061078.jpg" alt="QL-061078 1">';
  const p=parseListing(html,link);assert.equal(p.image,'https://seller.test/QL-061078.jpg');assert.equal(p.price,'');assert.equal(p.unit,'');assert.equal(p.availability,'unknown');assert.equal(p.place,'Online');
  assert.equal(parseListing(html.replace(/<img[^>]+>/g,''),link).image,'','A site logo cannot become a fabric photo');
  assert.equal(parseListing(seller({name:'Cotton Swatch',url:link,description:'Sold by the yard.'}),link).isSwatch,true);
});
await test('Swatchon-only discovery keeps refinements, verifies seller facts and rejects other approved merchants',async()=>{
  const link='https://www.swatchon.com/fabric/QL-061078',events=[],visits=[];
  const discovery=response({candidates:[{url:link,price:'1.00',reason:'Wool twill.'},{url}]});discovery.output[0].action.sources.push({url:link});
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai.com'))return Response.json(discovery);
    visits.push(target);assert.equal(target,link);return new Response(seller({url:link,offers:{'@type':'AggregateOffer',lowPrice:7,highPrice:20,priceCurrency:'USD'}}));
  }});
  await service.search(user,{request:'less shiny crimson wool',history:[{request:'only Britex wool'}],storeGroups:['swatchon']},event=>events.push(event));
  assert.deepEqual(visits,[link]);assert.deepEqual(events.at(-1).products.map(p=>p.url),[link]);assert.equal(events.at(-1).products[0].price,'');
  const redirected=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>target.includes('openai.com')?Response.json(discovery):target===link?new Response('',{status:302,headers:{location:url}}):new Response(seller())});
  const redirectedEvents=[];await redirected.search(user,{request:'crimson wool',storeGroups:['swatchon'],history:[{request:'wool'}]},event=>redirectedEvents.push(event));
  assert.deepEqual(redirectedEvents.at(-1).products,[],'An approved host redirect must still respect the selected group');
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
await test('saved dissection and preferences load in parallel after submission validation',async()=>{
  const s=store(),started=[],events=[];let release,providerCalls=0;
  const gate=new Promise(resolve=>release=resolve);
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat',fabric:'crimson wool'}]})),generation:'1'});
  const service=createFabricSearch({...s,read:async key=>{if(key.endsWith('/summary.json')||key.endsWith('/pieces.json')){started.push(key);await gate;}return s.read(key);},fetchImpl:async()=>{providerCalls++;return new Response('',{status:503});}});
  const run=service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat'},image},e=>events.push(e));
  for(let i=0;i<30&&started.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(started.length,2,'Both private reads start before either completes');assert.equal(providerCalls,0,'No provider starts before saved context is validated');
  release();await run;assert.ok(events.some(event=>event.type==='done'));
});
await test('third seller-feed result reaches verification and visual review',async()=>{
  const links=['https://www.moodfabrics.com/products/white-faux-fur','https://www.moodfabrics.com/products/blue-faux-fur','https://www.moodfabrics.com/products/red-faux-fur'];
  const events=[],visited=[];let ranks=0;
  const service=createFabricSearch({...store(),fetchImpl:async target=>{
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:links.map((url,i)=>({url,title:['White faux fur fabric','Blue faux fur fabric','Red faux fur fabric'][i]}))}}});
    visited.push(target);const i=links.indexOf(target);assert.ok(i>=0);return new Response(seller({url:target,name:['White faux fur fabric','Blue faux fur fabric','Red faux fur fabric'][i],description:['White faux fur sold by the yard.','Blue faux fur sold by the yard.','Red faux fur sold by the yard.'][i]}));
  },rank:async({products})=>{ranks++;return products;}});
  await service.search(user,{request:'red faux fur',piece:{name:'Coat',fabric:'red faux fur'},storeGroups:['mood'],image},event=>events.push(event));
  assert.ok(visited.includes(links[2]),'The third feed item is verified');assert.equal(ranks,1);
  assert.deepEqual(events.at(-1).products.map(p=>p.url),[links[2]],'Only the matching third item survives qualification and visual review');
});
await test('retailer expansion stays balanced and capped at eight visual candidates',async()=>{
  const events=[],visited=[];let ranks=0;
  const service=createFabricSearch({...store(),fetchImpl:async target=>{
    const host=new URL(target).hostname;
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[1,2,3].map(n=>({url:'https://'+host+'/products/red-wool-'+n,title:'Red wool fabric '+n}))}}});
    visited.push(target);return new Response(seller({url:target,name:'Red wool fabric',description:'Red wool fabric sold by the yard.'}));
  },rank:async({products})=>{ranks++;assert.equal(products.length,8);return products;}});
  await service.search(user,{request:'red wool',piece:{name:'Coat',fabric:'red wool'},image},event=>events.push(event));
  assert.equal(visited.length,8);assert.equal(new Set(visited.map(link=>new URL(link).hostname)).size,4,'One seller cannot occupy the whole verification budget');
  assert.equal(ranks,1);assert.equal(events.at(-1).products.length,8);
});
await test('empty/error searches retry and never populate a shared private query cache',async()=>{
  const s=store();let calls=0;const events=[];
  const service=createFabricSearch({...s,apiKey:()=> 'fake',model:'configured',fetchImpl:async u=>{if(u.includes('openai')){calls++;return new Response('',{status:503});}return new Response('',{status:503});}});
  for(let n=0;n<2;n++)await service.search(user,{request:'matte wool',history:[{request:'red wool'}]},e=>events.push(e));
  assert.equal(calls,2);assert.ok(events.at(-1).warning);assert.equal(events.at(-1).products.length,0);
  assert.equal([...s.records.keys()].some(k=>k.startsWith('catalog/')),false);
});
await test('lookbooks isolate accounts and submissions, persist selection and reject stale writes',async()=>{
  const s=store(),service=createFabricSearch({...s,model:'configured',fetchImpl:async()=>new Response(seller())}),product=parseListing(seller(),url);
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
    if(u.includes('suggest.json'))return Response.json({resources:{results:{products:[]}}});
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
await test('real dissection handoff preserves traits and active search uses saved material context',async()=>{
  const source=readFileSync(new URL('../backend/backend.html',import.meta.url),'utf8');
  const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  const code=extract('const _pieceSources = new WeakMap()', '// v0.9: focusPiece');
  const crop='data:image/png;base64,c2F2ZWQtY29hdA==';
  const piece={name:'Coat',fabric:'Crimson wool',fabric_hex:'#991b2a',fabric_spec:{fiber:'wool',weave:'twill',sheen:'matte',stretch:'none',texture:'brushed',weight_gsm:null},fabric_source:{url},_image:crop,jacket_construction:'double-breasted'};
  const sandbox={};vm.createContext(sandbox);vm.runInContext(code,sandbox);
  const normalized=sandbox.inferPieces({_dissection:{pieces:[piece]}})[0];
  assert.equal(normalized.fabric_spec.weave,'twill');assert.equal(normalized.fabric_hex,'#991b2a');assert.equal(normalized.jacket_construction,'double-breasted');assert.equal(normalized.fabric_source.url,url);
  const s=store(),events=[];let discovered,ranked;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[normalized]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(u,o)=>{
    if(u.includes('openai')){discovered=JSON.parse(o.body);return Response.json(response());}
    return new Response(seller());
  },rank:async input=>{ranked=input;return input.products;}});
  await service.search(user,{submissionId:'project-A',automatic:true,image,piece:{id:normalized.id,fabric:'Forged polyester'},preferences:'Forged preference'},event=>events.push(event));
  const context=JSON.parse(discovered.input[0].content[0].text);
  assert.equal(discovered.input[0].content[1].image_url,image);assert.equal(context.garment.fabric_hex,'#991b2a');assert.equal(context.garment.fabric_spec.weave,'twill');assert.match(context.clientFabricPreferences,/100% wool, no polyester/);
  assert.equal(ranked.garmentImage,crop);assert.equal(ranked.traits.weave,'twill');assert.equal(ranked.traits.texture,'brushed');assert.equal(ranked.traits.garments[0].fabric_hex,'#991b2a');assert.match(ranked.traits.preferences,/no polyester/);
  assert.doesNotMatch(JSON.stringify([discovered,ranked]),/Forged/);assert.equal(events.at(-1).products[0].garmentId,normalized.id);
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
await test('lookbook selections bind to canonical garments, preserve reuse and remove every assignment',async()=>{
  const s=store(),pieces=[{id:'coat',name:'Coat',fabric:'wool'},{id:'pants',name:'Pants',fabric:'cotton'}];
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  let fetches=0,pieceReads=0;const service=createFabricSearch({...s,read:async key=>{if(key.endsWith('/pieces.json'))pieceReads++;return s.read(key);},fetchImpl:async()=>{fetches++;return new Response(seller());}});
  const product={...parseListing(seller(),url),garmentId:'coat',garment:'Forged name'};
  let book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:'coat',product});
  assert.deepEqual(book.selectedByGarment,{coat:url});assert.equal(book.items[0].garment,'Coat');assert.equal(fetches,1);
  assert.equal(pieceReads,1,'A mutation reads and parses the private dissection once, including its response');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'pants',product}),e=>e.status===409);
  const before=pieceReads;book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'pants',product:{url,title:'Client edit ignored',price:'0.01'}});
  assert.deepEqual(book.selectedByGarment,{coat:url,pants:url});assert.equal(book.items[0].title,'Crimson wool twill');assert.equal(fetches,1,'Reselecting a stored URL needs no retailer or paid request');
  assert.equal(pieceReads-before,1,'Lookbook read, validation and acknowledgement share one request-local dissection');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:'unknown',product:{url}}),e=>e.status===409);
  const otherAccount=await service.loadBook(second,'project-A');assert.deepEqual(otherAccount.selectedByGarment,{});
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'remove',product:{url}});
  assert.deepEqual(book.selectedByGarment,{});assert.equal(book.selectedUrl,'');assert.equal(book.items.length,0);assert.equal(fetches,1);
});
await test('legacy lookbook reads only infer unambiguous garment selections and never write migrations',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';let writes=0;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{name:'Coat',fabric:'wool'},{name:'Shirt',fabric:'cotton'},{name:'Shirt',fabric:'linen'}]})),generation:'1'});
  const service=createFabricSearch({...s,write:async()=>{writes++;}}),product=parseListing(seller(),url);
  for(const [attribution,expected]of [[{garment:'Coat'},{'saved-piece-0':url}],[{garment:'Shirt'},{}],[{},{}],[{garmentId:'saved-piece-2',garment:'Shirt'},{}],[{garmentId:'saved-piece-0',garment:'Coat'},{'saved-piece-0':url}],[{garmentId:'saved-piece-0',garment:'Old jacket'},{}],[{garmentId:'saved-piece-0'},{}]]){
    s.records.set(key,{buf:Buffer.from(JSON.stringify({items:[{...product,...attribution}],selectedUrl:url})),generation:'7'});
    assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,expected);
    if(attribution.garmentId){
      const raw=JSON.stringify({items:[{...product,...attribution}],selectedUrl:url,selectedByGarment:{[attribution.garmentId]:url}});s.records.set(key,{buf:Buffer.from(raw),generation:'7'});
      assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,expected);assert.equal(s.records.get(key).buf.toString(),raw,'Legacy maps obey the same identity evidence without migration writes');
    }
  }
  assert.equal(writes,0);
  for(const selectedByGarment of [null,[],{'bad id':url},{'saved-piece-0':other},{'saved-piece-0':null}]){
    s.records.set(key,{buf:Buffer.from(JSON.stringify({items:[product],selectedUrl:url,selectedByGarment})),generation:'7'});
    await assert.rejects(service.loadBook(user,'project-A'),e=>e.status===503);
    await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'7',action:'remove',product:{url}}),e=>e.status===503);
  }
  assert.equal(writes,0,'Malformed selection storage must not be silently replaced');
});
await test('redissection hides only orphan selections and prunes them on an explicit CAS mutation',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',pieceKey='submissions/project-A/pieces.json',product={...parseListing(seller(),url),garment:'Coat',garmentId:'kept'};
  s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces:[{id:'kept',name:'Coat',fabric:'wool'}]})),generation:'2'});
  const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{kept:url,removed:url}});
  s.records.set(key,{buf:Buffer.from(raw),generation:'4'});
  const service=createFabricSearch({...s,fetchImpl:async()=>{throw Error('Stored selections do not need retailer access');}});
  const book=await service.loadBook(user,'project-A');assert.deepEqual(book.selectedByGarment,{kept:url});assert.equal(book.items.length,1);assert.equal(s.records.get(key).buf.toString(),raw,'Read does not write a migration');
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'3',action:'select',garmentId:'kept',product:{url}}),e=>e.status===409);assert.equal(s.records.get(key).buf.toString(),raw);
  const updated=await service.saveBook(user,{submissionId:'project-A',generation:'4',action:'select',garmentId:'kept',product:{url}});
  assert.deepEqual(updated.selectedByGarment,{kept:url});assert.deepEqual(JSON.parse(s.records.get(key).buf).selectedByGarment,{kept:url});
});
await test('selection fingerprints reject reused IDs but preserve stable garments through reorder and production work',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',pieceKey='submissions/project-A/pieces.json';
  const coat={id:'saved-piece-0',name:'Coat',fabric:'Crimson wool',fabric_spec:{fiber:'wool',weave:'twill'}},pants={id:'pants',name:'Pants',fabric:'cotton'};
  const writePieces=pieces=>s.records.set(pieceKey,{buf:Buffer.from(JSON.stringify({pieces})),generation:'1'});
  writePieces([coat,pants]);
  const service=createFabricSearch({...s,fetchImpl:async()=>new Response(seller())});
  let book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:coat.id,product:{url}});
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:pants.id,product:{url}});
  const raw=s.records.get(key).buf.toString(),stored=JSON.parse(raw);
  assert.match(stored.selectedGarmentFingerprints[coat.id],/^v1:[a-f0-9]{64}$/);assert.equal(book.selectedGarmentFingerprints,undefined,'Fingerprint storage is server owned; client schema stays compatible');
  writePieces([pants,{...coat,_image:image,_pattern:'new generated pattern',_technical:'production update'}]);
  assert.deepEqual((await service.loadBook(user,'project-A')).selectedByGarment,{[coat.id]:url,pants:url});
  for(const replacement of [{...coat,name:'New jacket'},{...coat,fabric:'White cotton'},{...coat,fabric_spec:{fiber:'cotton',weave:'poplin'}},{...coat,fabric_hex:'#ffffff'}]){
    writePieces([replacement,pants]);const current=await service.loadBook(user,'project-A');
    assert.deepEqual(current.selectedByGarment,{pants:url});assert.equal(current.items.length,1);assert.equal(s.records.get(key).buf.toString(),raw,'Changed identity is hidden without a migration write');
  }
  const replacement={...coat,name:'New jacket',fabric:'White cotton'};writePieces([replacement,pants]);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'0',action:'select',garmentId:coat.id,product:{url}}),error=>error.status===409);assert.equal(s.records.get(key).buf.toString(),raw);
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{url}});
  assert.deepEqual(book.selectedByGarment,{pants:url});assert.deepEqual(Object.keys(JSON.parse(s.records.get(key).buf).selectedGarmentFingerprints),['pants'],'Explicit CAS mutation prunes stale identity and its fingerprint');
  book=await service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',garmentId:replacement.id,product:{url}});
  assert.deepEqual(book.selectedByGarment,{pants:url,[replacement.id]:url});assert.notEqual(JSON.parse(s.records.get(key).buf).selectedGarmentFingerprints[replacement.id],stored.selectedGarmentFingerprints[coat.id],'Explicit review binds the reused ID to its new garment');
});
await test('malformed garment identity storage cannot be silently overwritten',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json',product={...parseListing(seller(),url),garment:'Coat',garmentId:'coat'};
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat',fabric:'wool'}]})),generation:'1'});
  const service=createFabricSearch({...s});
  for(const selectedGarmentFingerprints of [null,[],{}, {coat:'invalid'}, {coat:'v1:'+'a'.repeat(64),extra:'v1:'+'b'.repeat(64)}]){
    const raw=JSON.stringify({items:[product],selectedUrl:url,selectedByGarment:{coat:url},selectedGarmentFingerprints});s.records.set(key,{buf:Buffer.from(raw),generation:'5'});
    await assert.rejects(service.loadBook(user,'project-A'),error=>error.status===503);
    await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:'5',action:'remove',product:{url}}),error=>error.status===503);assert.equal(s.records.get(key).buf.toString(),raw);
  }
});
await test('new saved seller facts are verified server-side; failures preserve the book and retries',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';let calls=0;
  const service=createFabricSearch({...s,fetchImpl:async target=>{calls++;assert.ok(!target.includes('openai'),'Saving never searches or ranks');return target===url?new Response(seller()):new Response('',{status:503});}});
  const tampered={url,title:'Fake leather',price:'0.01',unit:'yard',currency:'USD',availability:'in_stock',evidence:'atelier_inventory',composition:'100% silk',image:'https://bad.example/fake.png'};
  const book=await service.saveBook(user,{submissionId:'project-A',generation:'0',action:'save',product:tampered});
  assert.equal(book.items[0].title,'Crimson wool twill');assert.equal(book.items[0].price,'69.99');assert.equal(book.items[0].composition,'100% wool');assert.equal(book.items[0].image,'https://cdn.shopify.com/wool.jpg');assert.equal(book.items[0].evidence,'seller_listing');
  const previous=s.records.get(key).buf.toString();
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...tampered,url:'https://evil.example/products/fabric'}}),e=>e.status===400);
  await assert.rejects(service.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'save',product:{...tampered,url:other}}),e=>e.status===422);
  assert.equal(s.records.get(key).buf.toString(),previous);assert.equal(calls,2);
  const unavailable=createFabricSearch({...s,fetchImpl:async()=>{throw Error('Retailer offline');}});
  const selected=await unavailable.saveBook(user,{submissionId:'project-A',generation:book.generation,action:'select',product:{url}});
  assert.equal(selected.selectedUrl,url,'An already stored source remains selectable when its retailer is unavailable');
});
await test('canonical full-look preferences and selected scopes survive the service request boundary',async()=>{
  const s=store(),furUrl='https://britexfabrics.com/products/faux-fur',leatherUrl='https://britexfabrics.com/products/leather';let discovery;
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:{coat:'Brown faux fur',pants:'Green alligator leather',exclude:['polyester']}})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Fur coat',fabric:'Brown faux fur',fabric_spec:{fiber:'acrylic'}},{id:'pants',name:'Green pants',fabric:'Green leather'}]})),generation:'1'});
  const pages={[furUrl]:{name:'Brown faux fur fabric',description:'100% acrylic long pile. Sold by the yard.',material:'100% acrylic'},[leatherUrl]:{name:'Green alligator leather fabric',description:'Green leather. Sold by the yard.',material:'Leather'}};
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{if(target.includes('openai')){discovery=JSON.parse(options.body);return Response.json({output:[{type:'web_search_call',action:{sources:Object.keys(pages).map(url=>({url}))}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:Object.keys(pages).map(url=>({url}))})}]}]});}return new Response(seller({...pages[target],url:target}));}});
  const full=[];await service.search(user,{automatic:true,submissionId:'project-A',image},event=>full.push(event));
  assert.deepEqual(full.at(-1).products.map(p=>[p.url,p.garmentId]),[[furUrl,'coat'],[leatherUrl,'pants']]);
  const selected=[];await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},event=>selected.push(event));
  assert.deepEqual(selected.at(-1).products.map(p=>p.url),[furUrl]);assert.match(JSON.stringify(discovery),/Green alligator leather/,'Original client preferences remain in discovery');
  const normalized=normalizeFabricRequest({request:'fabric',preferences:{coat:'brown faux fur',exclude:['polyester']}});assert.match(normalized.preferences,/brown faux fur/);assert.doesNotMatch(normalized.preferences,/object Object/);
});
await test('duplicate literal seller links are verified once and published once',async()=>{
  let pages=0;const service=createFabricSearch({...store(),fetchImpl:async target=>{if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url},{url}]}}});pages++;return new Response(seller());}});
  const events=[];await service.search(user,{request:'crimson wool'},event=>events.push(event));
  assert.equal(pages,1);assert.equal(events.at(-1).products.length,1);
});
await test('collection and direct Shopify aliases produce one ranked card without rewriting sources or variants',async()=>{
  const alias='https://britexfabrics.com/collections/fabrics/products/crimson-wool',seen=[],events=[];let ranks=0;
  const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai'))return Response.json(response());
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url:alias}]}}});
    seen.push(target);return new Response(seller());
  },rank:async({products})=>{ranks++;assert.equal(products.length,1,'Retailer and web aliases consume one visual slot');return products;}});
  await service.search(user,{request:'crimson wool',image},e=>events.push(e));
  assert.equal(ranks,1);assert.equal(events.at(-1).products.length,1);
  assert.ok([url,alias].includes(events.at(-1).products[0].url));assert.ok(seen.includes(alias),'Identity normalization must preserve actual fetch/source destinations');
  const answer=response({candidates:[{url:alias},{url},{url:url+'?variant=2'}]});answer.output[0].action.sources.push({url:alias},{url:url+'?variant=2'});
  assert.deepEqual(readDiscovery(answer).candidates.map(p=>p.url),[alias,url+'?variant=2'],'Aliases deduplicate while distinct selected variants remain distinct');
});
await test('stored preference parse failures stop before providers and structured exclusions are not truncated',async()=>{
  const s=store();let providers=0;const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async()=>{providers++;throw Error('must not call');}});
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from('{broken'),generation:'1'});
  await assert.rejects(service.search(user,{submissionId:'project-A',request:'wool',preferences:'client fallback'},()=>{}),e=>e.status===503);assert.equal(providers,0);
  const preferences={notes:'neutral '.repeat(180),coat:'Brown faux fur',exclude:['polyester']};
  assert.deepEqual(JSON.parse(normalizeFabricRequest({request:'fabric',preferences}).preferences),preferences,'Longer structured preferences keep their final exclusion and valid structure');
  assert.throws(()=>normalizeFabricRequest({request:'fabric',preferences:'x'.repeat(12001)}),e=>e.status===400);
});
await test('store-only constraints survive a redirect to another approved merchant',async()=>{
  const events=[],service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
    if(target.includes('openai'))return Response.json(response());
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url}]}}});
    if(target===url)return new Response('',{status:302,headers:{location:other}});
    return new Response(seller({url:other}));
  }});
  await service.search(user,{request:'crimson wool, only Britex',stores:['britexfabrics.com'],image},event=>events.push(event));
  assert.ok(events.every(event=>!event.products?.length),'Neither preliminary nor final results bypass the store filter after a redirect');
});
await test('concurrent garment selections cannot both acknowledge an overwrite',async()=>{
  const s=store(),key='private/fabrics/owner-A/project-A/lookbook.json';
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'Coat'},{id:'pants',name:'Pants'}]})),generation:'1'});
  const service=createFabricSearch({...s,fetchImpl:async()=>new Response(seller())});
  const results=await Promise.allSettled(['coat','pants'].map(garmentId=>service.saveBook(user,{submissionId:'project-A',generation:'0',garmentId,action:'select',product:{url}})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
  assert.equal(Object.keys(JSON.parse(s.records.get(key).buf).selectedByGarment).length,1);
});
await test('saved garment retailer results survive an empty web answer and still pass visual review',async()=>{
  const s=store(),feeds=[],events=[];let ranks=0;
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{id:'coat',name:'PRIVATE PERSON coat',fabric:'Crimson wool twill'}]})),generation:'1'});
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
    if(target.includes('openai'))return Response.json(response({candidates:[]}));
    if(target.includes('suggest.json')){feeds.push(new URL(target).searchParams.get('q'));return Response.json({resources:{results:{products:[{url}]}}});}
    return new Response(seller());
  },rank:async({products})=>{ranks++;return products;}});
  await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},e=>events.push(e));
  assert.ok(feeds.length&&feeds.length<=8,'Automatic saved garments get bounded direct retailer queries');
  assert.ok(feeds.every(q=>/wool|twill/.test(q)&&!q.includes('PRIVATE')),'Public queries contain material vocabulary only');
  assert.equal(ranks,1);assert.deepEqual(events.at(-1).products.map(p=>p.url),[url]);
  assert.ok(events.find(e=>e.type==='context')?.searchDetails.retailerQueries.length);
});
await test('discovery exposes actual tool queries and rejects malformed result objects',()=>{
  const body=response();body.output[0].action.queries=['burgundy wool fabric site:britexfabrics.com'];
  assert.deepEqual(readDiscovery(body).webQueries,body.output[0].action.queries);
  const colored=response({garmentColors:[{garmentId:'jacket',colors:['red','red','not a color',{},'white','blue']},null,{garmentId:{},colors:['red']}]});
  assert.deepEqual(readDiscovery(colored).garmentColors,[{garmentId:'jacket',colors:['red','white']}]);
  assert.deepEqual(readDiscovery(response({garmentColors:[{garmentId:'jacket',colors:['red']},{garmentId:'jacket',colors:['white']}]})).garmentColors,[],'Ambiguous repeated garment observations cannot pick an arbitrary last color');
  for(const value of [null,[],{}, {candidates:'invalid'}]){
    const broken=response();broken.output[1].content[0].text=JSON.stringify(value);
    assert.throws(()=>readDiscovery(broken),/unreadable|invalid|incomplete/i);
  }
});
await test('www source aliases retain evidence identity without accepting unrelated source paths',()=>{
  const result=response({candidates:[{url:'https://www.britexfabrics.com/products/crimson-wool'},null,{url:'https://britexfabrics.com/products/uncited'}]});
  assert.deepEqual(readDiscovery(result).candidates.map(c=>c.url),['https://www.britexfabrics.com/products/crimson-wool']);
  const input=normalizeFabricRequest({request:'black wool fabric',image});
  assert.deepEqual(webSearchBody(input,'gpt-6-luna').reasoning,{effort:'low'});
  assert.equal(webSearchBody(input,'configured-legacy').reasoning,undefined);assert.equal(webSearchBody(input,'gpt-5-pro').reasoning,undefined);
});
await test('canonical mixed-material garments keep original words but qualify their base cloth independently',async()=>{
  const s=store(),piece={id:'coat',name:'Embellished coat',fabric:'Black brushed wool blend with cognac suede leather appliqué',fabric_spec:{fiber:'wool blend with leather appliqué',weave:'Dense brushed twill',texture:'brushed'},_image:image};
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:['Denim','Leather']})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[piece]})),generation:'1'});
  for(const comparisonAvailable of [true,false]){
    const events=[];let ranked=0,sent;
    const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
      if(target.includes('openai')){sent=JSON.parse(options.body);return Response.json(response());}
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url}]}}});
      return new Response(seller({name:'Black brushed wool coating',description:'100% wool coating, sold by the yard.'}));
    },rank:async({products})=>{ranked++;assert.equal(products.length,1);if(!comparisonAvailable)throw Error('unavailable');return products;}});
    await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'coat'},image},e=>events.push(e));
    assert.equal(ranked,1);assert.equal(events.at(-1).products.length,comparisonAvailable?1:0);
    assert.equal(events.at(-1).searchDetails.preferences,JSON.stringify(['Denim','Leather']));
    assert.doesNotMatch(events.at(-1).searchDetails.retailerQueries.join(' '),/denim|leather/);
    const context=JSON.parse(sent.input[0].content[0].text);assert.match(context.garment.fabric,/leather appliqué/);assert.equal(context.clientFabricPreferences,JSON.stringify(['Denim','Leather']),'Original words remain intact for discovery');
  }
});
await test('saved burgundy fur rejects ivory and retailer notions cannot crowd out the third fabric listing',async()=>{
  const s=store(),piece={id:'jacket',name:'Shag jacket',fabric:'Long-pile faux fur',fabric_hex:'#991b2a',fabric_spec:{fiber:'polyester',texture:'long-pile'},_image:image};
  s.records.set('submissions/project-A/summary.json',{buf:Buffer.from(JSON.stringify({fabric_preferences:['Leather','Denim']})),generation:'1'});
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[piece]})),generation:'1'});
  const ivory='https://britexfabrics.com/products/ivory-fur',red='https://britexfabrics.com/products/burgundy-fur',events=[],visited=[];let ranked=0;
  const service=createFabricSearch({...s,apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
    if(target.includes('openai')){const answer=response({garmentColors:[{garmentId:'jacket',colors:['red']}],candidates:[{url:ivory}]});answer.output[0].action.sources.push({url:ivory});return Response.json(answer);}
    if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{title:'Leather button',url:'https://britexfabrics.com/products/button-a'},{title:'Sewing needles',url:'https://britexfabrics.com/products/needles'},{title:'Burgundy long pile polyester faux fur',url:red}]}}});
    visited.push(target);return new Response(seller(target.includes('burgundy-fur')?{name:'Burgundy long pile polyester faux fur',description:'Burgundy polyester faux fur. Sold by the yard.',url:red,material:'polyester'}:{name:'Ivory polyester faux fur',description:'Creamy eggshell ivory polyester. Sold by the yard.',url:ivory,material:'polyester'}));
  },rank:async({products})=>{ranked++;assert.deepEqual(products.map(p=>p.url),[red]);return products;}});
  await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'jacket'},image},e=>events.push(e));
  assert.equal(ranked,1);assert.deepEqual(events.at(-1).products.map(p=>p.url),[red]);assert.match(events.at(-1).searchDetails.retailerQueries[0],/red/);
  assert.ok(!visited.some(u=>/button-a|needles/.test(u)),'Known notions are discarded before the bounded verification budget');
  s.records.set('submissions/project-A/pieces.json',{buf:Buffer.from(JSON.stringify({pieces:[{...piece,fabric_hex:''}]})),generation:'2'});
  const legacy=[];await service.search(user,{automatic:true,submissionId:'project-A',piece:{id:'jacket'},image},e=>legacy.push(e));
  assert.equal(ranked,2);assert.deepEqual(legacy.at(-1).products.map(p=>p.url),[red],'Legacy garments without hex use the scoped qualified observation, never accept opposite seller colors on a high rank alone');
});
await test('a stalled streamed search terminates before the browser deadline and cannot publish late products',async()=>{
  const nativeTimeout=AbortSignal.timeout,routes=[],events=[];let release,lateSignal;
  const app={post:(...args)=>routes.push(args),get(){}};
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===55000?40:ms);
  const keepAlive=setInterval(()=>{},1000);
  try{
    mountFabricSearch(app,{...store(),requireAdmin:async()=>user,requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),apiKey:()=> 'fake',fetchImpl:async(target,options)=>{
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[]}}});
      assert.ok(target.includes('openai.com'));lateSignal=options.signal;
      return new Promise(resolve=>{release=()=>resolve(Response.json(response()));});
    }});
    let ended=false,code;
    const res={on(){},set(){return this;},flushHeaders(){this.headersSent=true;},write(raw){events.push(JSON.parse(raw));},end(raw){if(raw)events.push(JSON.parse(raw));ended=true;},status(n){code=n;return this;},json(value){events.push(value);ended=true;}};
    await routes[0].at(-1)({body:{request:'crimson wool'},query:{}},res);
    assert.equal(ended,true);assert.equal(code,undefined,'Already-streamed failures use a terminal error event');
    assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/timed out/);assert.equal(lateSignal.aborted,true);
    const finalCount=events.length;release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(events.length,finalCount,'Late provider completion cannot append after terminal timeout');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('a late private storage read cannot launch providers after the route deadline',async()=>{
  const nativeTimeout=AbortSignal.timeout,routes=[];let release,providers=0;
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===55000?40:ms);
  const keepAlive=setInterval(()=>{},1000);
  try{
    const storage=store();mountFabricSearch({post:(...args)=>routes.push(args),get(){}},{...storage,read:async key=>{if(key.endsWith('/submission.json'))await new Promise(resolve=>release=resolve);return storage.read(key);},requireAdmin:async()=>user,requireAuthHeader(){},json:()=>()=>{},rateLimit:()=>({ok:true}),apiKey:()=> 'fake',fetchImpl:async()=>{providers++;throw Error('Late provider request');}});
    let error,code;const res={on(){},status(value){code=value;return this;},json(value){error=value.error;}};
    await routes[0].at(-1)({body:{submissionId:'project-A',request:'crimson wool'}},res);
    assert.equal(code,503);assert.match(error,/timed out/);release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(providers,0);
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('seller redirects and variant facts share one total verification budget',async()=>{
  const nativeTimeout=AbortSignal.timeout;let attempts=0,budget;
  AbortSignal.timeout=ms=>{const signal=nativeTimeout.call(AbortSignal,ms===8000?55:ms);if(ms===8000)budget=signal;return signal;};
  const keepAlive=setInterval(()=>{},1000);
  try{
    const service=createFabricSearch({...store(),fetchImpl:async(target,options)=>{
      attempts++;
      if(attempts===2)await new Promise((resolve,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});
      return new Response('',{status:302,headers:{location:url+'?variant='+attempts}});
    }});
    const result=await service.verify({url});assert.equal(result.evidence,'search_link');assert.equal(budget?.aborted,true,'The shared budget expires before a fresh six-second hop deadline');assert.equal(attempts,2,'No fresh third-hop timeout after the listing budget expires');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);}
});
await test('a non-cooperative web search cannot block reviewed retailer results',async()=>{
  const nativeTimeout=AbortSignal.timeout,events=[];let release,ranks=0;
  const keepAlive=setInterval(()=>{},1000);
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===35000?40:ms);
  try{
    const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
      if(target.includes('api.openai.com'))return new Promise(resolve=>release=()=>resolve(Response.json(response())));
      if(target.includes('suggest.json'))return Response.json({resources:{results:{products:[{url,title:'Crimson wool fabric'}]}}});
      return new Response(seller());
    },rank:async({products})=>{ranks++;return products;}});
    await service.search(user,{request:'crimson wool',image},event=>events.push(event));
    assert.equal(ranks,1);assert.deepEqual(events.at(-1).products.map(product=>product.url),[url]);assert.match(events.at(-1).warning,/interrupted|too long/i);
    const n=events.length;release();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(events.length,n,'Late discovery cannot replace completed results');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
await test('non-cooperative retailer responses respect their independent budgets',async()=>{
  const nativeTimeout=AbortSignal.timeout,events=[];let release,attempts=0;
  const keepAlive=setInterval(()=>{},1000);
  AbortSignal.timeout=ms=>nativeTimeout.call(AbortSignal,ms===4500||ms===8000?40:ms);
  try{
    const service=createFabricSearch({...store(),apiKey:()=> 'fake',fetchImpl:async target=>{
      if(target.includes('api.openai.com'))return Response.json(response());
      if(target.includes('suggest.json'))return new Promise(()=>{});
      return new Response(seller());
    }});
    await service.search(user,{request:'crimson wool'},event=>events.push(event));
    assert.deepEqual(events.at(-1).products.map(product=>product.url),[url],'A stalled feed does not block a verified web result');
    const redirecting=createFabricSearch({...store(),fetchImpl:async()=>{attempts++;return new Promise(resolve=>{release=()=>resolve(new Response('',{status:302,headers:{location:url}}));});}});
    const result=await redirecting.verify({url});assert.equal(result.evidence,'search_link');release();await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal(attempts,1,'A late response cannot launch another redirect after the budget');
  }finally{AbortSignal.timeout=nativeTimeout;clearInterval(keepAlive);release?.();}
});
console.log(`Fabric search: ${count} behavioral checks passed.`);
