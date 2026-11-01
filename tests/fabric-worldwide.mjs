// Worldwide main search: fake OpenAI evidence only; no external seller traffic.
import assert from 'node:assert/strict';
import {createFabricSearch,normalizeFabricRequest} from '../docs/server/fabric-search.mjs';
import {sourceURL,worldwideSearchBody} from '../docs/server/fabric-worldwide.mjs';
const image='data:image/png;base64,iVBORw0KGgo=',url='https://global-textiles.example.net/item/forest-tricot';
const candidate={type:'candidate',url,title:'Forest green tricot fabric',material:'Green jacket and pants body',reason:'A possible smooth knit for the green body.',price:'1.00',image:'https://invented.example/fake.jpg'};
const interpretation={type:'interpretation',observation:'Green body knit, gold panels and ivory inserts; exact fiber is uncertain.',query:'green tracksuit textiles'};
const evidence={type:'web_search_call',action:{sources:[{url}]},results:[{type:'image_result',source_website_url:url,image_url:'https://seller-images.example.net/green.jpg',thumbnail_url:'https://seller-images.example.net/thumb.jpg',caption:'Forest green tricot fabric'}]};
const content=objects=>({type:'message',content:[{type:'output_text',text:objects.map(object=>JSON.stringify(object)).join('\n')}]});
const user={sub:'fixture-owner'};
let count=0;
async function test(name,run){await run();count++;console.log('  ok worldwide '+name);}
await test('default is unfiltered image/text search, optional legacy groups cannot scope it',()=>{
  const input=normalizeFabricRequest({request:'Find fabrics for this look',image,storeGroups:['local'],stores:['evil.invalid']});
  assert.equal(input.mode,'worldwide');assert.equal(input.storeGroups,undefined);assert.deepEqual(input.stores,[]);
  const body=worldwideSearchBody(input,'gpt-6-luna');assert.equal(body.stream,true);assert.equal(body.store,false);
  assert.equal(body.tools[0].filters,undefined);assert.deepEqual(body.tools[0].search_content_types,['text','image']);
  assert.ok(body.include.includes('web_search_call.results'));assert.equal(body.input[0].content[1].image_url,image);
  assert.throws(()=>normalizeFabricRequest({request:'wool',mode:'unknown'}));
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
  assert.equal(early.products[0].url,url);assert.equal(early.products[0].image,evidence.results[0].thumbnail_url);
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
console.log('Worldwide fabric: '+count+' global/default/evidence/stream/cancellation checks passed.');
