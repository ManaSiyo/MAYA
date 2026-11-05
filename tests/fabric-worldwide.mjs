// Worldwide main search: fake OpenAI evidence only; no external seller traffic.
import assert from 'node:assert/strict';
import {createFabricSearch,normalizeFabricRequest} from '../docs/server/fabric-search.mjs';
import {sourceURL,worldwideSearchBody,isColorFabricPhoto} from '../docs/server/fabric-worldwide.mjs';
const image='data:image/png;base64,iVBORw0KGgo=',url='https://global-textiles.example.net/item/forest-tricot';
const candidate={type:'candidate',url,title:'Forest green tricot fabric',material:'Green jacket and pants body',reason:'A possible smooth knit for the green body.',price:'1.00',image:'https://invented.example/fake.jpg'};
const interpretation={type:'interpretation',observation:'Green body knit, gold panels and ivory inserts; exact fiber is uncertain.',query:'green tracksuit textiles'};
const evidence={type:'web_search_call',action:{sources:[{url}]},results:[{type:'image_result',source_website_url:url,image_url:'https://seller-images.example.net/green.jpg',thumbnail_url:'https://seller-images.example.net/thumb.jpg',caption:'Forest green tricot fabric'}]};
const content=objects=>({type:'message',content:[{type:'output_text',text:objects.map(object=>JSON.stringify(object)).join('\n')}]});
const user={sub:'fixture-owner'};
let count=0;
async function test(name,run){await run();count++;console.log('  ok worldwide '+name);}
await test('default requires worldwide image results, optional legacy groups cannot scope it',()=>{
  const input=normalizeFabricRequest({request:'Find fabrics for this look',image,storeGroups:['local'],stores:['evil.invalid']});
  assert.equal(input.mode,'worldwide');assert.equal(input.storeGroups,undefined);assert.deepEqual(input.stores,[]);
  const body=worldwideSearchBody(input,'gpt-6-luna');assert.equal(body.stream,true);assert.equal(body.store,false);
  assert.equal(body.max_tool_calls,5);assert.equal(body.max_output_tokens,6000);assert.equal(body.tools[0].image_settings.max_results,32);
  assert.match(body.instructions,/dominant color/);assert.match(body.instructions,/Solid color body-cloth alternatives are useful/);
  assert.equal(body.tools[0].filters,undefined);assert.deepEqual(body.tools[0].search_content_types,['image']);
  assert.match(body.instructions,/Use image search to find photographs/);
  assert.match(body.instructions,/source_website_url/);
  assert.ok(body.include.includes('web_search_call.results'));assert.equal(body.input[0].content[1].image_url,image);
  assert.throws(()=>normalizeFabricRequest({request:'wool',mode:'unknown'}));
});
await test('patterned apparel yardage is not mistaken for a sewing pattern',async()=>{
  for(const title of ['Forest green floral pattern jacquard fabric','Black floral pattern on forest green apparel fabric by the yard']){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],caption:title}]},content([{...interpretation,colorFamily:'green'},{...candidate,title}])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
    assert.equal(events.at(-1).products.length,1,title);assert.ok(events.at(-1).products[0].image);
  }
  for(const title of ['PDF sewing pattern for green fabric coat','Knitting pattern for wool sweater','Digital pattern download with fabric guide','Dress pattern for green stretch fabrics','Pattern for a shirt using cotton fabric']){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,title}])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));assert.deepEqual(events.at(-1).products,[]);
  }
});
await test('modeled links cannot disguise upholstery, furnishing or decor evidence',async()=>{
  for(const change of [{url:'https://cloth.example/green-jacquard-upholstery-fabric'},{title:'Green furnishing fabric'},{reason:'Green brocade, though some options are furnishing-weight.'},{caption:'Green upholstery fabric by the yard'},{caption:'Green decor fabric by the yard'},{url:'https://cloth.example/products/green-%75pholstery-fabric'}]){
    const item={...candidate,...change},page=item.url;
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,action:{sources:[{url:page}]},results:[{...evidence.results[0],source_website_url:page,caption:change.caption||'Green fabric'}]},content([interpretation,item])]})});
    await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
    assert.deepEqual(events.at(-1).products,[],JSON.stringify(change));
  }
});
await test('late upholstery evidence retracts a modeled card even if the stream then fails',async()=>{
  const frames=[{type:'response.output_item.done',item:evidence},{type:'response.output_text.delta',delta:JSON.stringify(candidate)+'\n'},{type:'response.output_item.done',item:{...evidence,results:[{...evidence.results[0],caption:'Green upholstery fabric by the yard'}]}},{type:'response.failed'}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await assert.rejects(service.search(user,{request:'Green apparel fabric',image},event=>events.push(structuredClone(event))),/interrupted/);
  assert.ok(events.some(event=>event.products?.[0]?.url===url));
  assert.ok(events.some(event=>event.removedUrls?.includes(url)));
  assert.deepEqual(events.filter(event=>event.products).at(-1).products,[]);
});
await test('a text-only provider response reports missing photographs without a paid retry',async()=>{
  let calls=0;const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>{calls++;return Response.json({status:'completed',output:[{...evidence,results:[]},content([interpretation,candidate])]});}});
  await service.search(user,{request:'Green apparel fabric',image},event=>events.push(event));
  assert.equal(calls,1);assert.equal(events.at(-1).products.length,1);
  assert.match(events.at(-1).message,/no fabric photographs/i);
  assert.match(events.at(-1).searchDetails.stage,/source links only/i);
});
await test('public source links reject private addresses, credentials and unsafe schemes',()=>{
  for(const bad of ['http://shop.example/a','https://127.0.0.1/a','https://2130706433/a','https://[::1]/a','https://10.0.0.2/a','https://user:secret@shop.example/a','https://shop.local/a','https://shop.local./a','https://localhost/a','file:///etc/passwd'])assert.equal(sourceURL(bad),'',bad);
  assert.equal(sourceURL(url+'?variant=2&utm_source=ad#top'),url+'?variant=2');
});
await test('one call streams a global product before completion, with tool-backed image and no invented facts',async()=>{
  let controller,calls=0,cancelled=false;
  const stream=new ReadableStream({start(value){controller=value;},cancel(){cancelled=true;}}),events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',model:'gpt-6-luna',rank:()=>{throw Error('Main search must not call a second ranker');},fetchImpl:async(target,options)=>{
    calls++;assert.equal(target,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(options.body).tools[0].filters,undefined);
    return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
  }});
  const pending=service.search(user,{request:'Find fabrics',image},event=>events.push(event));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_item.done',item:evidence});push({type:'response.output_text.delta',delta:JSON.stringify(interpretation)+'\n'+JSON.stringify(candidate)+'\n'});
  for(let i=0;i<50&&!events.some(event=>event.incremental);i++)await new Promise(resolve=>setImmediate(resolve));
  const early=events.find(event=>event.incremental);assert.ok(early,'Useful source-backed products arrive before response.completed');assert.equal(events.some(e=>e.type==='done'),false);
  assert.equal(early.products[0].url,url);assert.equal(early.products[0].image,evidence.results[0].image_url);
  for(const field of ['price','unit','currency','composition'])assert.equal(early.products[0][field],'');assert.equal(early.products[0].availability,'unknown');
  assert.equal(early.products[0].evidence,'web_suggestion');
  push({type:'response.completed',response:{status:'completed',output:[evidence,content([interpretation,candidate])]}});
  const stats=await pending;assert.equal(calls,1);assert.equal(stats.count,1);assert.ok(cancelled,'Completion does not wait for EOF');assert.equal(stats.visualMs,0);assert.equal(stats.retailerMs,0);
});
await test('ungrounded links/images and stale garment IDs cannot become suggestions',async()=>{
  const objects=[interpretation,candidate,{...candidate,url:'https://invented-shop.example/product/red-fabric'},{...candidate,url:url+'?variant=bad',garmentIds:['foreign']}];
  const response={status:'completed',output:[{...evidence,results:[]},content(objects)]},events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async target=>{assert.equal(target,'https://api.openai.com/v1/responses');return Response.json(response);}});
  await service.search(user,{request:'green knit',image},event=>events.push(event));
  assert.equal(events.at(-1).products.length,1);assert.equal(events.at(-1).products[0].image,'','Model image URL is ignored when search did not supply a page-linked image');
});
await test('missing key and provider failure never fall back to retailer feeds or echo provider errors',async()=>{
  let calls=0;const service=createFabricSearch({fetchImpl:async()=>{calls++;throw Error('Unexpected feed');}});
  await assert.rejects(service.search(user,{request:'green knit',image},()=>{}),/Worldwide fabric search is unavailable/);assert.equal(calls,0);
  const failed=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response('secret-provider-message',{status:403})});
  await assert.rejects(failed.search(user,{request:'green knit',image},()=>{}),error=>!error.message.includes('secret-provider-message')&&error.status===502);
});
await test('known client exclusions remain strict without imposing saved-body guesses',async()=>{
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,title:'Green polyester tricot fabric'}])]})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},event=>events.push(event));assert.deepEqual(events.at(-1).products,[]);
});
await test('late source evidence retracts an initially unknown client-excluded material',async()=>{
  let controller;const events=[];
  const stream=new ReadableStream({start(value){controller=value;}});
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  const task=service.search(user,{request:'green knit',preferences:'No polyester',image},event=>events.push(event));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_item.done',item:{...evidence,results:[]}});
  push({type:'response.output_text.delta',delta:JSON.stringify(candidate)+'\n'});
  for(let i=0;i<50&&!events.some(event=>event.incremental);i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.find(event=>event.incremental)?.products[0]?.url,url,'Unknown fiber may initially be a qualified suggestion');
  push({type:'response.output_item.done',item:{...evidence,results:[{...evidence.results[0],caption:'Green polyester tricot fabric'}]}});
  push({type:'response.completed',response:{status:'completed',output:[evidence,content([candidate])]}});
  await task;
  const removal=events.find(event=>event.removedUrls?.includes(url));
  assert.ok(removal,'Later known client contradiction must retract the existing card');
  assert.deepEqual(removal.products,[]);assert.deepEqual(events.at(-1).products,[]);
});
await test('SSE handles CRLF and Unicode split across every byte without inventing a photo',async()=>{
  const product={...candidate,title:'Green crêpe fabric'};
  const events=[{type:'response.output_item.done',item:evidence},{type:'response.output_text.delta',delta:JSON.stringify(interpretation)+'\n'+JSON.stringify(product)+'\n'},{type:'response.completed',response:{status:'completed',output:[]}}];
  const bytes=new TextEncoder().encode(events.map(event=>'event: '+event.type+'\r\ndata: '+JSON.stringify(event)+'\r\n\r\n').join(''));
  const stream=new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));controller.close();}}),out=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'green fabric',image},event=>out.push(event));assert.equal(out.at(-1).products[0].title,'Green crêpe fabric');
});
await test('stalled worldwide fetch settles on parent cancellation even if transport ignores it',async()=>{
  const keepAlive=setInterval(()=>{},1000);let calls=0;
  try{const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>{calls++;return new Promise(()=>{});}});await assert.rejects(service.search(user,{request:'green knit',image},()=>{},AbortSignal.timeout(30)));assert.equal(calls,1);}finally{clearInterval(keepAlive);}
});
await test('worldwide own deadline survives GC and a stalled body cancels cleanly',async()=>{
  const native=AbortSignal.timeout,keepAlive=setInterval(()=>{},1000);AbortSignal.timeout=ms=>native.call(AbortSignal,ms===50000?35:ms);
  try{
    const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Promise(()=>{})});
    await assert.rejects(service.search(user,{request:'green knit',image},()=>{}),error=>error.name==='TimeoutError');
    let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
    const stalled=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(body,{headers:{'Content-Type':'text/event-stream'}})});
    await assert.rejects(stalled.search(user,{request:'green knit',image},()=>{}),error=>error.name==='TimeoutError');assert.ok(cancelled);
  }finally{AbortSignal.timeout=native;clearInterval(keepAlive);}
});
await test('saved context is canonical before the single worldwide call starts',async()=>{
  const piece={id:'jacket',name:'Track jacket',fabric:'Green knit',_image:image};let calls=0;const events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:path.endsWith('summary.json')?{fabric_preferences:'No polyester'}:{}))}),fetchImpl:async(target,options)=>{
    calls++;assert.equal(target,'https://api.openai.com/v1/responses');const sent=JSON.parse(JSON.parse(options.body).input[0].content[0].text);
    assert.equal(sent.selectedGarment.name,'Track jacket');assert.equal(sent.clientFabricPreferences,'No polyester');assert.doesNotMatch(JSON.stringify(sent),/forged/);
    return Response.json({status:'completed',output:[evidence,content([interpretation,{...candidate,garmentIds:['jacket']}])]});
  }});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'jacket',name:'forged'},image},event=>events.push(event));assert.equal(calls,1);assert.equal(events.at(-1).products[0].garmentId,'jacket');
});

await test('three written recommendations retain source photographs from up to twelve different websites',async()=>{
  const photos=Array.from({length:14},(_,i)=>({type:'image_result',source_website_url:`https://cloth-${i}.example/products/green-twill-${i}`,image_url:`https://photos.example/green-${i}.jpg`,thumbnail_url:`https://photos.example/thumb-${i}.jpg`,caption:`Forest green cotton twill apparel fabric by the yard ${i}`}));
  const unsafe=[['upholstery','Green upholstery fabric by the yard'],['shirt','Green shirt made of premium fabric size M'],['pattern','Green sewing pattern for apparel fabric'],['orange','Orange fabric by the yard with green variants'],['sample','Green cotton apparel fabric sample'],['blog','Green apparel fabric by the yard']].map(([id,caption])=>({...photos[0],source_website_url:'https://cloth.example/'+(id==='blog'?'blog/green-fabric':'products/'+id),caption}));
  const written=photos.slice(0,3).map(p=>({...candidate,url:p.source_website_url,title:p.caption}));
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{type:'web_search_call',action:{queries:['forest green suiting fabric','hunter green cotton twill by the yard']},results:[...photos,...unsafe]},content([{...interpretation,colorFamily:'green'},...written])]})});
  await service.search(user,{request:'green apparel fabric',image},e=>events.push(e));
  const done=events.at(-1);assert.equal(done.products.length,12,'Search photographs fill the twelve-site viewer beyond the written shortlist');
  assert.ok(done.products.every(p=>p.image&&p.imageCandidates.length===2));assert.equal(done.products[0].image,photos[0].image_url);
  assert.ok(done.products.slice(3).every(p=>!p.garmentId&&!p.garment&&p.reason.includes('Approximate')),'Raw photo suggestions invent no garment identity or exact suitability');
  assert.deepEqual(done.searchDetails.webQueries,['forest green suiting fabric','hunter green cotton twill by the yard']);
  for(const field of ['price','unit','currency','composition'])assert.ok(done.products.every(p=>p[field]===''));
});
await test('unknown colors and non-yardage/editorial/variant mentions cannot auto-add photographs',()=>{
  const photo={url:'https://cloth.example/products/green',caption:'Green cotton apparel fabric by the yard',imageCandidates:['https://photos.example/green.jpg']};
  assert.equal(isColorFabricPhoto(photo,'green'),true);
  for(const family of ['unknown','chartreuse','GREEN',null])assert.equal(isColorFabricPhoto(photo,family),false);
  for(const caption of ['Green shirt made of cotton fabric','Green fabric inspiration','Red apparel fabric by the yard, also green','Green upholstery fabric by the yard','Green fabric by the yard available in other colors','Green fabric by the yard available in blue and red','Green sewing pattern for dressmaking','Green fabric swatch','Green craft fabric by the yard'])assert.equal(isColorFabricPhoto({...photo,caption},'green'),false,caption);
  for(const path of ['collections/green','category/green','search/green','blog/green','guides/green'])assert.equal(isColorFabricPhoto({...photo,url:'https://cloth.example/'+path},'green'),false,path);
});
await test('image association tolerates only trailing slash spelling and keeps variants and hosts separate',async()=>{
  for(const [source,hasPhoto]of [[url+'/',true],[url+'?variant=red',false],[url.replace('global-textiles.','www.global-textiles.'),false]]){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],source_website_url:source}]},content([candidate])]})});
    await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(!!events.at(-1).products[0].image,hasPhoto,source);
  }
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([candidate,{...candidate,url:url+'/'}])]})});
  await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(events.at(-1).products.length,1,'Slash aliases are not duplicate products');
});
await test('photo suggestions displace photo-less links at the bounded display limit',async()=>{
  const links=Array.from({length:24},(_,i)=>({...candidate,url:`https://link-${i}.example/products/green`}));
  const photos=Array.from({length:30},(_,i)=>({...evidence.results[0],source_website_url:`https://photo-${i}.example/products/green`,caption:`Green suiting fabric by the yard ${i}`}));
  const frames=[{type:'response.output_item.done',item:{type:'web_search_call',action:{sources:links.map(({url})=>({url}))}}},{type:'response.output_text.delta',delta:[{...interpretation,colorFamily:'green'},...links].map(value=>JSON.stringify(value)).join('\n')+'\n'},{type:'response.output_item.done',item:{type:'web_search_call',results:photos}},{type:'response.completed',response:{status:'completed',output:[]}}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));
  assert.equal(events.at(-1).products.length,12);assert.ok(events.at(-1).products.every(p=>p.image));
  assert.ok(events.some(e=>e.removedUrls?.length),'Earlier link-only cards are removed from retained client results when photo results take their slots');
});
await test('extra photographs still respect client exclusions and need a resolved color',async()=>{
  for(const colorFamily of ['green','unknown']){
    const photos=[{...evidence.results[0],caption:'Green polyester suiting fabric by the yard'}];
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily}])]})});
    await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
  }
});
await test('automatic worldwide keeps explicit refinements while using canonical saved garments',async()=>{
  let sent;const piece={id:'coat',name:'Hooded tailcoat',fabric:'Dense ornate brocade with embroidery'};
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:{}))}),fetchImpl:async(_,options)=>{sent=JSON.parse(JSON.parse(options.body).input[0].content[0].text);return Response.json({status:'completed',output:[]});}});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat',name:'forged'},request:'Main green color, solid cloth is fine; no polyester',history:[{request:'less shiny'}],image},()=>{});
  assert.equal(sent.request,'Main green color, solid cloth is fine; no polyester');assert.equal(sent.selectedGarment.name,'Hooded tailcoat');assert.equal(sent.earlierRequests[0].request,'less shiny');
});


await test('same-page variant photos cannot mix known colors in raw or modeled fallback URLs',async()=>{
  const green={...evidence.results[0],caption:'Green cotton apparel fabric by the yard'},orange={...evidence.results[0],image_url:'https://photos.example/orange.jpg',thumbnail_url:'https://photos.example/orange-thumb.jpg',caption:'Orange cotton apparel fabric by the yard'};
  for(const modeled of [false,true])for(const results of [[green,orange],[orange,green]]){
    const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results},content([{...interpretation,colorFamily:'green'},...(modeled?[candidate]:[])])]})});
    await service.search(user,{request:'green fabric',image},e=>events.push(e));
    if(!modeled)assert.deepEqual(events.at(-1).products,[],'Ambiguous same-page color evidence is not an automatic addition');
    else {assert.deepEqual(events.at(-1).products[0].imageCandidates,[green.image_url,green.thumbnail_url],'Only explicitly green source images can back this green card');assert.deepEqual(events.at(-1).products[0].rejectedImageURLs,[orange.image_url,orange.thumbnail_url],'Previously mounted photos can be explicitly revoked by later color evidence');}
  }
});
await test('fifth and later source captions cannot hide a known material exclusion',async()=>{
  const photos=Array.from({length:6},(_,i)=>({...evidence.results[0],caption:i===4?'Green polyester apparel fabric by the yard':'Green cotton apparel fabric by the yard '+i}));
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily:'green'},candidate])]})});
  await service.search(user,{request:'green fabric',preferences:'No polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
});


await test('uncolored model titles can still use page-linked fabric photos without a guessed color',async()=>{
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[evidence,content([{...candidate,title:'Cotton tricot fabric'}])]})});
  await service.search(user,{request:'fabric',image},e=>events.push(e));assert.equal(events.at(-1).products[0].image,evidence.results[0].image_url);
});


await test('automatic worldwide refinements enforce exclusions from actual client request words',async()=>{
  const piece={id:'coat',name:'Green coat',fabric:'Green cloth'},events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',read:async path=>({ok:true,buf:Buffer.from(JSON.stringify(path.endsWith('pieces.json')?{pieces:[piece]}:{}))}),fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:[{...evidence.results[0],caption:'Green polyester suiting fabric by the yard'}]},content([{...interpretation,colorFamily:'green'},candidate])]})});
  await service.search(user,{submissionId:'project-A',automatic:true,piece:{id:'coat'},request:'Green body cloth, no polyester',image},e=>events.push(e));assert.deepEqual(events.at(-1).products,[]);
});


await test('late color interpretation revokes an earlier uncolored-title photo with known different color',async()=>{
  const source={...evidence,results:[{...evidence.results[0],caption:'Orange cotton apparel fabric by the yard'}]};
  const records=[{...candidate,title:'Cotton apparel fabric'}, {...interpretation,colorFamily:'green'}];
  const frames=[{type:'response.output_item.done',item:source},...records.map(record=>({type:'response.output_text.delta',delta:JSON.stringify(record)+'\n'})),{type:'response.completed',response:{status:'completed',output:[]}}];
  const stream=new ReadableStream({start(controller){for(const event of frames)controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));controller.close();}}),events=[];
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  await service.search(user,{request:'fabric',image},event=>events.push(structuredClone(event)));
  assert.ok(events.some(e=>e.products?.[0]?.image),'An early source-backed image may precede interpretation');
  assert.equal(events.at(-1).products[0].image,'');assert.deepEqual(events.at(-1).products[0].rejectedImageURLs,[source.results[0].image_url,source.results[0].thumbnail_url]);
});

await test('selected dissected image leads a short request without saved fabric guesses',()=>{
  const pieceImage='data:image/png;base64,cGllY2U=';
  const body=worldwideSearchBody({request:'Darker green, no polyester',history:[{request:'Less shiny'}],preferences:'No polyester',image,selectedReference:pieceImage,piece:{name:'Coat',fabric:'Mandatory ornate brocade',fabric_spec:{weave:'brocade'}},pieces:[{name:'Coat',fabric:'Mandatory ornate brocade'}]},'gpt-6-luna');
  const parts=body.input[0].content;
  assert.equal(parts[1].image_url,pieceImage);assert.equal(parts.at(-1).image_url,image,'Original look remains available as context');
  assert.doesNotMatch(JSON.stringify(parts),/Mandatory ornate brocade/);
  assert.match(parts[0].text,/Darker green, no polyester/);assert.match(body.instructions,/up to 12 different websites/);
  assert.ok(body.instructions.split(/\s+/).length<300,'The provider receives a concise sourcing task');
});
await test('tool photos stream before any written shortlist, accent-first captions survive, and late exclusions retract',async()=>{
  let controller;const events=[];
  const stream=new ReadableStream({start(value){controller=value;}});
  const service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(stream,{headers:{'Content-Type':'text/event-stream'}})});
  const task=service.search(user,{request:'Green body fabric, no polyester',image},event=>events.push(structuredClone(event)));
  const push=event=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  push({type:'response.output_text.delta',delta:JSON.stringify({...interpretation,colorFamily:'green'})+'\n'});
  const photo={...evidence.results[0],caption:'Black embroidery on forest green apparel fabric by the yard'};
  push({type:'response.output_item.done',item:{...evidence,results:[photo]}});
  for(let i=0;i<50&&!events.some(event=>event.products?.length);i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.find(event=>event.products?.length)?.products[0].image,photo.image_url,'No model candidate or completion is needed for a qualified tool photograph');
  assert.equal(events.some(event=>event.type==='done'),false);
  push({type:'response.output_item.done',item:{...evidence,results:[{...photo,caption:'Forest green polyester apparel fabric by the yard'}]}});
  push({type:'response.failed'});
  await assert.rejects(task,/interrupted/);
  assert.ok(events.some(event=>event.removedUrls?.includes(url)));assert.equal(events.filter(event=>event.products).at(-1).products.length,0);
});
await test('later ambiguous variant evidence retracts an early raw photograph before stream failure',async()=>{
  const green={...evidence.results[0],caption:'Green suiting fabric by the yard'},orange={...green,image_url:'https://seller-images.example.net/orange.jpg',caption:'Orange suiting fabric by the yard'};
  const frames=[{type:'response.output_text.delta',delta:JSON.stringify({...interpretation,colorFamily:'green'})+'\n'},{type:'response.output_item.done',item:{...evidence,results:[green]}},{type:'response.output_item.done',item:{...evidence,results:[orange]}},{type:'response.failed'}];
  const events=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>new Response(frames.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}})});
  await assert.rejects(service.search(user,{request:'Green fabric',image},event=>events.push(structuredClone(event))),/interrupted/);
  assert.ok(events.some(event=>event.products?.[0]?.image===green.image_url));assert.ok(events.some(event=>event.removedUrls?.includes(url)));assert.equal(events.filter(event=>event.products).at(-1).products.length,0);
});
await test('one merchant cannot crowd out twelve other source websites',async()=>{
  const photos=Array.from({length:20},(_,i)=>({...evidence.results[0],source_website_url:'https://one-shop.example/products/green-'+i,caption:'Green suiting fabric by the yard'}));
  for(let i=0;i<11;i++)photos.push({...photos[0],source_website_url:'https://shop-'+i+'.example/products/green'});
  const out=[],service=createFabricSearch({apiKey:()=> 'fake',fetchImpl:async()=>Response.json({status:'completed',output:[{...evidence,results:photos},content([{...interpretation,colorFamily:'green'}])]})});
  await service.search(user,{request:'Green fabric',image},event=>out.push(event));
  const products=out.at(-1).products;assert.equal(products.length,12);assert.equal(new Set(products.map(p=>new URL(p.url).hostname)).size,12);
});

console.log('Worldwide fabric: '+count+' global/default/evidence/stream/cancellation checks passed.');
