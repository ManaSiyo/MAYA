// CONNECT's public storefront search, separate from paid visual discovery.
// Only a fixed garment vocabulary leaves MAYA; no client names, photos or notes.
import {sourceURL} from './fabrics.mjs';

const ENDPOINT='https://connect.api.clo-set.com/api/search/store/Garments';
const SITE='https://connect.clo-set.com';
// CLO's published format guides distinguish garment/project data from texture
// photographs. Containers may hold project data; their contents stay unverified.
const NATIVE_FORMATS=new Set(['zprj','zpac','zmod','zblc','zmdr']);
const ASSET_FORMATS=new Set([...NATIVE_FORMATS,'dxf','aam','obj','fbx','glb','gltf','usd','usda','usdc','usdz','abc','dae','lxo','zip','rar','7z']);
const list=value=>Array.isArray(value)?value:[];
const text=(value,max=180)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
const FAMILIES=[
 {key:'jumpsuit',detect:/\b(?:jumpsuits?|rompers?|overalls?)\b/i,accept:/\b(?:jumpsuits?|rompers?|overalls?)\b/i,queries:['jumpsuit','romper']},
 {key:'jacket',detect:/\b(?:jackets?|bombers?|hoodies?|windbreakers?|parkas?|puffers?)\b/i,accept:/\b(?:jackets?|bombers?|hoodies?|windbreakers?|parkas?|puffers?)\b/i,queries:['jacket','hoodie']},
 {key:'coat',detect:/\b(?:coats?|overcoats?|trench)\b/i,accept:/\b(?:coats?|overcoats?|trench|jackets?|parkas?)\b/i,queries:['coat','jacket']},
 {key:'blazer',detect:/\b(?:blazers?|suits?|tuxedos?)\b/i,accept:/\b(?:blazers?|suits?|tuxedos?|jackets?)\b/i,queries:['blazer','suit jacket']},
 {key:'trousers',detect:/\b(?:trousers?|pants?|jeans?|joggers?|slacks)\b/i,accept:/\b(?:trousers?|pants?|jeans?|joggers?|slacks)\b/i,queries:['trousers','pants']},
 {key:'shorts',detect:/\b(?:shorts|bermuda)\b/i,accept:/\b(?:shorts|bermuda)\b/i,queries:['shorts']},
 {key:'skirt',detect:/\b(?:skirts?|skorts?)\b/i,accept:/\b(?:skirts?|skorts?)\b/i,queries:['skirt']},
 {key:'dress',detect:/\b(?:dresses|dress|gowns?)\b/i,accept:/\b(?:dresses|dress|gowns?)\b/i,queries:['dress','gown']},
 {key:'corset',detect:/\b(?:corsets?|bustiers?|bodices?)\b/i,accept:/\b(?:corsets?|bustiers?|bodices?)\b/i,queries:['corset','bodice']},
 {key:'vest',detect:/\b(?:vests?|waistcoats?)\b/i,accept:/\b(?:vests?|waistcoats?)\b/i,queries:['vest','waistcoat']},
 {key:'shirt',detect:/\b(?:shirts?|blouses?|tunics?)\b/i,accept:/\b(?:shirts?|blouses?|tunics?)\b/i,queries:['shirt','blouse']},
 {key:'knitwear',detect:/\b(?:sweaters?|cardigans?|pullovers?|knitwear|sweatshirts?)\b/i,accept:/\b(?:sweaters?|cardigans?|pullovers?|knitwear|sweatshirts?)\b/i,queries:['sweater','cardigan']},
 {key:'top',detect:/\b(?:tops?|tanks?|camisoles?|t-shirts?|tees?)\b/i,accept:/\b(?:tops?|tanks?|camisoles?|t-shirts?|tees?)\b/i,queries:['top','t-shirt']},
 {key:'cape',detect:/\b(?:capes?|cloaks?|ponchos?)\b/i,accept:/\b(?:capes?|cloaks?|ponchos?)\b/i,queries:['cape','cloak']},
 {key:'robe',detect:/\b(?:robes?|kimonos?|bathrobes?)\b/i,accept:/\b(?:robes?|kimonos?|bathrobes?)\b/i,queries:['robe','kimono']}
];
const ATTRIBUTES=[
 {term:'cropped',pattern:/\b(?:cropped|crop)\b/i},
 {term:'hooded',pattern:/\b(?:hooded|hood|hoodie)\b/i},
 {term:'flared',pattern:/\b(?:flared|flare|bell.bottom)\b/i},
 {term:'oversized',pattern:/\b(?:oversized|oversize)\b/i},
 {term:'pleated',pattern:/\b(?:pleated|pleats?)\b/i},
 {term:'wrap',pattern:/\bwrap\b/i},
 {term:'double breasted',pattern:/\bdouble[ -]breasted\b/i},
 {term:'zip',pattern:/\b(?:zip|zipper|zipped)\b/i},
 {term:'wide leg',pattern:/\bwide[ -]leg\b/i},
 {term:'sleeveless',pattern:/\bsleeveless\b/i}
];
function descriptor(input={}){
 const garment=input.garment||{},name=text(garment.name,300),category=text(garment.category,100);
 // A named garment is more specific than a general category from dissection.
 const family=FAMILIES.find(f=>f.detect.test(name))||FAMILIES.find(f=>f.detect.test(category));
 return family?{family,attributes:ATTRIBUTES.filter(a=>a.pattern.test(name+' '+category))}:null;
}
export function cloCatalogQueries(input){
 const d=descriptor(input);if(!d)return [];
 const first=d.family.queries[0],specific=d.attributes.slice(0,2).map(a=>a.term+' '+first);
 return [...new Set([...specific,...d.family.queries])].slice(0,3);
}
function listing(value,id){
 const safe=sourceURL(value);if(!safe)return '';
 const u=new URL(safe);return /^[a-f0-9]{28,40}$/.test(id||'')&&u.origin===SITE&&u.pathname==='/detail/'+id?SITE+'/detail/'+id:'';
}
function fileFormat(value){const match=text(value,500).match(/\.([a-z0-9]{2,6})$/i);return match?match[1].toLowerCase():'';}
export function cloCatalogItems(response,input){
 const d=descriptor(input);if(!d||!Array.isArray(response?.items))return [];
 const items=[],seen=new Set();
 for(const row of response.items.slice(0,72)){
  const title=text(row?.name),url=listing(row?.itemDetailUrl,row?.itemId),format=fileFormat(row?.fileName);
  if(!url||seen.has(url)||!title||!d.family.accept.test(title)||![0,1].includes(row.pricingType)||!ASSET_FORMATS.has(format)||!(Number.isFinite(row.fileSize)&&row.fileSize>0))continue;
  // A native project extension is evidence of format, not verified editable
  // sewing panels, fit, licensing rights or permission for physical production.
  const image=sourceURL(row.imagePath),free=row.pricingType===1&&row.basePrice===0;
  const requested=d.attributes.map(a=>a.term),checks=requested.length?requested.join(', ')+' construction':'silhouette and construction';
  seen.add(url);items.push({url,title,image,thumbnail:image,imageCandidates:image?[image]:[],
   description:title,match:'Catalog '+d.family.key+' alternative. Compare the shape and construction with the submission.',
   alterations:'Check '+checks+', fit and material in CLO; adapt the source pattern as needed.',
   formats:[format],price:typeof row.basePrice==='number'&&Number.isFinite(row.basePrice)&&row.basePrice>=0?row.basePrice:null,currency:'',priceType:free?'free':row.pricingType===0?'paid':'unknown',
   licenseTier:'',patternStatus:'unknown',physicalProduction:'unknown',factsEvidence:'CONNECT Store lists a '+format.toUpperCase()+' file and '+(free?'free':row.pricingType===0?'paid':'unspecified')+' access. Pattern contents and production rights have not been inspected.',
   evidenceMode:'connect_catalog',provider:'connect',previewEvidence:{url,kind:'connect_catalog',metadataUrl:ENDPOINT}});
 }
 return items;
}
const abortSources=new WeakMap();
function deadline(parent,ms){const sources=[AbortSignal.timeout(ms),...(parent?[parent]:[])],signal=AbortSignal.any(sources);abortSources.set(signal,sources);return signal;}
function bounded(promise,signal){return new Promise((resolve,reject)=>{
 const stop=()=>reject(signal.reason);if(signal.aborted){Promise.resolve(promise).catch(()=>{});return stop();}
 signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));
});}
export function createCloCatalog({fetchImpl=fetch,now=Date.now,timeoutMs=5500,maxBytes=2*1024*1024,cacheSize=64,ttlMs=10*60*1000,limit=20}={}){
 const cache=new Map();
 async function query(keyword,signal){
  const existing=cache.get(keyword);if(existing&&existing.expires>now())return existing.response;
  const body={kind:0,keyword,minPrice:null,maxPrice:null,pricingOptions:[0,1],pageNo:1,pageSize:36,searchAfter:null,categories:[],sortBy:1,swTypes:null,suppliers:null,officials:null};
  const response=await bounded(fetchImpl(ENDPOINT,{method:'POST',redirect:'error',credentials:'omit',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),signal}),signal);
  const cancelBody=()=>{Promise.resolve(response.body?.cancel()).catch(()=>{});};
  if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>maxBytes){cancelBody();throw Error('CLO catalog unavailable');}
  const reader=response.body?.getReader();if(!reader)throw Error('CLO catalog response missing');
  const cancel=()=>{Promise.resolve(reader.cancel()).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  let raw='',bytes=0;const decoder=new TextDecoder();
  try{for(;;){const chunk=await bounded(reader.read(),signal);if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>maxBytes)throw Error('CLO catalog response too large');raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}finally{signal.removeEventListener('abort',cancel);cancel();}
  const result=JSON.parse(raw);if(!Array.isArray(result?.items))throw Error('CLO catalog response invalid');
  if(!signal.aborted){cache.delete(keyword);cache.set(keyword,{response:result,expires:now()+ttlMs});while(cache.size>cacheSize)cache.delete(cache.keys().next().value);}
  return result;
 }
 return {async search(input,{signal:parent}={}){
  const queries=cloCatalogQueries(input),d=descriptor(input);if(!queries.length||parent?.aborted)return [];
  const signal=deadline(parent,timeoutMs),results=await Promise.allSettled(queries.map(keyword=>query(keyword,signal)));
  if(parent?.aborted)return [];
  const unique=new Map();for(const result of results)if(result.status==='fulfilled')for(const item of cloCatalogItems(result.value,input))if(!unique.has(item.url))unique.set(item.url,item);
  // Preserve CONNECT's recommendation order for equal structural evidence.
  // This is a title-based catalog shortlist, never a claim of visual similarity.
  const score=item=>d.attributes.reduce((total,a)=>total+(a.pattern.test(item.title)?1:0),0);
  const native=item=>item.formats.some(format=>NATIVE_FORMATS.has(format))?1:0;
  return [...unique.values()].sort((a,b)=>score(b)-score(a)||native(b)-native(a)).slice(0,Math.min(20,Math.max(1,limit))).map((item,index)=>({...item,rank:index+1}));
 }};
}
