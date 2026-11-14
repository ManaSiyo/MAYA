// Public CONNECT listing photographs. This is independent of paid discovery,
// private garment inputs, native file downloads and pattern generation.
import {sourceURL} from './fabrics.mjs';

const SITE='https://connect.clo-set.com',API='https://connect.api.clo-set.com';
const MAX_CANDIDATES=6;
const combinedSources=new WeakMap();
const list=v=>Array.isArray(v)?v:[];
function deadline(parent,ms){
 const sources=[AbortSignal.timeout(ms),...(parent?[parent]:[])],signal=AbortSignal.any(sources);
 combinedSources.set(signal,sources);return signal;
}
function bounded(promise,signal){return new Promise((resolve,reject)=>{
 const stop=()=>reject(signal.reason);if(signal.aborted)return stop();
 signal.addEventListener('abort',stop,{once:true});
 Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));
});}
function listing(value){
 const safe=sourceURL(value);if(!safe)return null;
 const u=new URL(safe),match=u.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?detail\/([a-f0-9]{28,40})\/?$/i);
 return u.origin===SITE&&match?{url:SITE+'/detail/'+match[1].toLowerCase(),id:match[1].toLowerCase()}:null;
}
function metadataURL(id){return API+'/api/Details/Items/'+id+'/context?isTempPage=false';}
function preview(urls,page,kind){
 const imageCandidates=[...new Set(urls.map(sourceURL).filter(Boolean))].slice(0,MAX_CANDIDATES);
 return imageCandidates.length?{image:imageCandidates[0],thumbnail:imageCandidates[0],imageCandidates,
  previewEvidence:{url:page.url,kind,...(kind==='connect_metadata'?{metadataUrl:metadataURL(page.id)}:{})}}:null;
}
export function hasCloPreview(item){return !!item&&[item.image,item.thumbnail,...list(item.imageCandidates)].some(sourceURL);}

// Verified public storefront contract, served without credentials by CONNECT.
// Never accept a mismatched/private item or recursively pick a creator's photo.
export function parseCloPublicPreview(data,listingURL){
 const page=listing(listingURL);
 if(!page||!data||typeof data!=='object'||Array.isArray(data)||data.itemId!==page.id||data.hasPublished!==true||data.currentStatus!==1)return null;
 return preview([data.thumbnailImageInfo?.imageUrl,...list(data.imageList).map(image=>image?.filePath)],page,'connect_metadata');
}
function decode(value){return String(value||'').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(raw,entity)=>{
 const e=entity.toLowerCase();if(e[0]!=='#')return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[e]||raw;
 const n=e[1]==='x'?Number.parseInt(e.slice(2),16):Number.parseInt(e.slice(1),10);
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):raw;
});}
function attributes(tag){const out={};
 for(const match of tag.matchAll(/([^\s=<>"'`/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g))out[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]);
 return out;
}
function photo(value,url){try{return typeof value==='string'?sourceURL(new URL(decode(value).trim(),url).href):'';}catch{return '';}}
export function parseCloListingPreview(html,listingURL){
 const page=listing(listingURL);if(!page||typeof html!=='string'||html.length>2*1024*1024)return null;
 const urls=[],scripts=[];
 // Do not interpret a script string or HTML comment as real page metadata.
 const markup=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,(_,type,attrs,body)=>{
  if(type.toLowerCase()==='script'&&attributes(attrs).type?.toLowerCase()==='application/ld+json'&&body.length<=256*1024&&scripts.length<20)scripts.push(body);
  return '';
 });
 for(const tag of markup.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){
  const a=attributes(tag[0]),key=(a.property||a.name||'').toLowerCase();
  if(['og:image','og:image:url','og:image:secure_url','twitter:image','twitter:image:src'].includes(key)){
   const url=photo(a.content,page.url);if(url)urls.push(url);
  }
 }
 const addImage=value=>{for(const image of Array.isArray(value)?value:[value]){
  const url=photo(typeof image==='string'?image:image?.contentUrl||image?.url,page.url);if(url)urls.push(url);
 }};
 function visit(value,depth=0){if(!value||typeof value!=='object'||depth>8)return;
  if(Array.isArray(value)){for(const row of value.slice(0,100))visit(row,depth+1);return;}
  if([value['@type'],...list(value['@type'])].some(type=>type==='Product'||type==='https://schema.org/Product')){
   const identities=[value.url,value['@id']].filter(identity=>identity!==undefined&&identity!==null);
   // A page can include related products in its graph. Declared product
   // identities must refer to this listing before their photographs qualify.
   const sameListing=identities.every(identity=>{try{return typeof identity==='string'&&listing(new URL(identity,page.url).href)?.url===page.url;}catch{return false;}});
   if(sameListing)addImage(value.image);
  }
  for(const key of ['@graph','mainEntity'])if(value[key])visit(value[key],depth+1);
 }
 for(const script of scripts){try{visit(JSON.parse(script));}catch{}}
 return preview(urls,page,'listing_metadata');
}

export function createCloPreviewResolver({fetchImpl=fetch,now=Date.now,timeoutMs=9000,requestTimeoutMs=4000,maxBytes=2*1024*1024,cacheSize=256,positiveTtlMs=6*60*60*1000,negativeTtlMs=60000}={}){
 const cache=new Map();
 function remember(key,value){
  cache.delete(key);cache.set(key,{value,expires:now()+(value?positiveTtlMs:negativeTtlMs)});
  while(cache.size>cacheSize)cache.delete(cache.keys().next().value);
 }
 async function body(response,signal){
  if(Number(response.headers?.get('content-length'))>maxBytes){Promise.resolve(response.body?.cancel()).catch(()=>{});throw Error('Preview metadata too large');}
  const reader=response.body?.getReader();if(!reader)throw Error('Preview metadata missing');
  const cancel=()=>{Promise.resolve(reader.cancel()).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  const decoder=new TextDecoder();let bytes=0,result='';
  try{for(;;){const chunk=await bounded(reader.read(),signal);if(chunk.done)break;
   bytes+=chunk.value.byteLength;if(bytes>maxBytes)throw Error('Preview metadata too large');result+=decoder.decode(chunk.value,{stream:true});
  }return result+decoder.decode();}finally{signal.removeEventListener('abort',cancel);cancel();}
 }
 async function read(url,page,parent,isApi){
  const signal=deadline(parent,requestTimeoutMs);let current=url;
  for(let hop=0;hop<3;hop++){
   signal.throwIfAborted();
   const response=await bounded(fetchImpl(current,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:isApi?'application/json':'text/html,application/xhtml+xml'},signal}),signal);
   if(response.status>=300&&response.status<400){
    Promise.resolve(response.body?.cancel()).catch(()=>{});
    const target=new URL(response.headers.get('location')||'',current);
    // API requests never change origin/path/query; HTML may only change locale
    // for this exact listing. No arbitrary host, login page or redirect fetch.
    const allowed=isApi?target.href===url:listing(target.href)?.url===page.url;
    if(!allowed||target.href===current)throw Error('Preview metadata redirect rejected');current=target.href;continue;
   }
   if(!response.ok){Promise.resolve(response.body?.cancel()).catch(()=>{});throw Error('Preview metadata unavailable');}
   const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
   if(isApi?!['application/json','application/ld+json'].includes(type):!['text/html','application/xhtml+xml'].includes(type)){
    Promise.resolve(response.body?.cancel()).catch(()=>{});throw Error('Preview metadata type rejected');
   }
   const raw=await body(response,signal);return isApi?parseCloPublicPreview(JSON.parse(raw),page.url):parseCloListingPreview(raw,page.url);
  }
  throw Error('Preview metadata redirect limit');
 }
 async function resolve(page,signal){
  const saved=cache.get(page.url);if(saved&&saved.expires>now())return saved.value;
  let value=null;
  // Use CONNECT's published storefront API first. It supplies actual listing
  // thumbnails even when its HTML page is JS-only or challenges automated reads.
  try{value=await read(metadataURL(page.id),page,signal,true);}catch{}
  if(!value&&!signal.aborted){try{value=await read(page.url,page,signal,false);}catch{}}
  if(value||!signal.aborted)remember(page.url,value);return value;
 }
 async function hydrate(items,{signal:parent}={}){
  if(!Array.isArray(items)||!items.length||parent?.aborted)return items;
  const pending=new Map();for(let index=0;index<items.length;index++){
   const item=items[index];if(hasCloPreview(item))continue;const page=listing(item?.url);if(!page)continue;
   const job=pending.get(page.url)||{page,indexes:[]};job.indexes.push(index);pending.set(page.url,job);
  }
  if(!pending.size)return items;
  const signal=deadline(parent,timeoutMs),jobs=[...pending.values()],out=items.slice();let next=0,changed=false;
  async function worker(){while(next<jobs.length&&!signal.aborted){
   const job=jobs[next++],value=await resolve(job.page,signal);if(!value||signal.aborted)continue;
   for(const index of job.indexes){out[index]={...items[index],...value};changed=true;}
  }}
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));
  return parent?.aborted||!changed?items:out;
 }
 return {hydrate};
}
