// Fabric discovery uses web evidence; seller facts come only from fetched listings.
// No private image, request, conversation or lookbook is stored in a shared cache.
import {isFabricProduct, isFabricPiece, fabricProductMatch, fabricSeedQueries} from './fabric-sourcing.js';
import {FABRIC_SHOPS,FABRIC_STORE_GROUPS,merchantURL,merchantIdentity,requestedShops} from './fabric-retailers.mjs';
import {webSearchBody,readDiscovery} from './fabric-discovery.mjs';
export {FABRIC_SHOPS,FABRIC_STORE_GROUPS,merchantURL,requestedShops} from './fabric-retailers.mjs';
export {webSearchBody,readDiscovery} from './fabric-discovery.mjs';
import {createHash} from 'node:crypto';
const SUBMISSION = /^[A-Za-z0-9_-]{3,120}$/;
const text = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const list = v => Array.isArray(v) ? v : v ? [v] : [];
const plain = v => typeof v === 'string' ? text(v) : v && typeof v === 'object' ? text(JSON.stringify(v)) : '';
function untilAborted(promise,signal) {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    if(signal.aborted){reject(signal.reason);return;}
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
const strip = v => decode(String(v || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
function decode(v) {
  return text(String(v).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, m => ({ '&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' ' })[m]).replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
    const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  }), 30000);
}

function publicImage(value, base) {
  try {
    const raw=typeof value==='string'?value:value&&typeof value==='object'?(value.url||value.contentUrl):'';
    if(typeof raw!=='string'||!raw.trim()||/^(?:undefined|null)$/i.test(raw.trim()))return '';
    const u = new URL(raw.trim(), base);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.includes('.') || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)) return '';
    return u.href;
  } catch { return ''; }
}

export function fabricPreferences(summary) {
  const value=summary?.fabric_preferences;if(value==null)return '';
  const serialized=typeof value==='string'?value:typeof value==='object'?JSON.stringify(value):'';
  if(serialized.length>12000)throw fail('Fabric preferences are too long to check safely. Shorten them before searching.');
  return serialized;
}
function garmentPiece(piece={}) {
  return {id:text(piece.id,100),name:text(piece.name,80),category:text(piece.category,60),fabric:text(piece.fabric,180),skip:!!piece.skip,
    fabric_hex:/^#[a-f\d]{6}$/i.test(piece.fabric_hex||'')?piece.fabric_hex:'',
    fabric_spec:Object.fromEntries(['fiber','weave','stretch','sheen','texture'].map(k=>[k,text(piece.fabric_spec?.[k],80)]))};
}
function garmentFingerprint(piece) {
  // Stable identity excludes regenerated images and production work. A material/name
  // change still requires review even if a legacy writer reuses its index-based ID.
  const {id,skip,...identity}=garmentPiece(piece);
  return 'v1:'+createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export function normalizeFabricRequest(body = {}) {
  const submissionId = text(body.submissionId, 121);
  if (submissionId && !SUBMISSION.test(submissionId)) throw fail('Choose a valid submission.');
  const request = text(body.request, 1200);
  const image = typeof body.image === 'string' ? body.image : '';
  if (image && (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 4 * 1024 * 1024)) throw fail('Use a JPEG, PNG or WebP photo under 3 MB.');
  if (!request && !image && !body.automatic) throw fail('Describe a fabric or add a photo.');
  const history = list(body.history).slice(-6).map(h => ({ request: text(h.request, 1200), query: text(h.query, 180) }));
  const piece = body.piece || {};
  const storeGroups=body.storeGroups;
  if(storeGroups!==undefined&&(!Array.isArray(storeGroups)||!storeGroups.length||storeGroups.some(id=>!FABRIC_STORE_GROUPS.some(group=>group.id===id))))throw fail('Choose at least one supported store group.');
  const stores=list(body.stores).map(host=>FABRIC_SHOPS.find(shop=>typeof host==='string'&&shop.host.replace(/^www\./,'')===host.replace(/^www\./,''))?.host);
  if(stores.some(host=>!host))throw fail('Choose a supported fabric store.');
  return { submissionId, request, image, history, preferences:fabricPreferences({fabric_preferences:body.preferences}),automatic:body.automatic===true,
    ...(storeGroups?{storeGroups:[...new Set(storeGroups)]}:{}),stores:[...new Set(stores)],piece:garmentPiece(piece),
    pieces:list(body.pieces).filter(isFabricPiece).slice(0,12).map(garmentPiece) };
}

function scopeKey(user, submissionId) {
  if (!user?.sub || !SUBMISSION.test(submissionId)) throw fail('Open a submission to save fabrics.');
  return 'private/fabrics/' + encodeURIComponent(user.sub) + '/' + submissionId + '/lookbook.json';
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3]);
  return out;
}
function unitFrom(description) {
  const s = String(description || '').toLowerCase();
  if (/(?:sold|priced|price|order|unit|quantity|cut).{0,35}(?:half|1\/2|½)[ -]?(?:yard|metre|meter)|per\s+(?:half|1\/2|½)/i.test(s)) return /met(?:er|re)/.test(s) ? 'half metre' : 'half yard';
  if (/(?:per|by the|sold by|sold in|price\/|price per)\s*(?:one\s*)?yard|\/\s*yard\b/.test(s)) return 'yard';
  if (/(?:per|by the|sold by|sold in)\s*(?:one\s*)?(?:metre|meter)|\/\s*(?:metre|meter)\b/.test(s)) return 'metre';
  return '';
}
function availability(v) {
  const s = String(v || '').split('/').pop().toLowerCase();
  return s === 'instock' ? 'in_stock' : ['outofstock','soldout','discontinued'].includes(s) ? 'out_of_stock' : ['preorder','backorder','presale'].includes(s) ? 'preorder' : 'unknown';
}

export function parseListing(html, url, now = Date.now()) {
  const m = merchantURL(url, true);
  if (!m) throw fail('Unsupported retailer.');
  const metas = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) { const a = attrs(tag); metas[a.property || a.name] = a.content || ''; }
  const nodes = [];
  const walk = (v, depth = 0) => {
    if (!v || depth > 8) return;
    if (Array.isArray(v)) { v.slice(0, 100).forEach(x => walk(x, depth + 1)); return; }
    if (typeof v !== 'object') return;
    if (list(v['@type']).some(t => /^(Product|ProductGroup)$/i.test(t))) nodes.push(v);
    for (const k of ['@graph','mainEntity','hasVariant']) if (v[k]) walk(v[k], depth + 1);
  };
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attrs(script[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    try { walk(JSON.parse(script[2])); } catch { /* malformed markup provides no facts */ }
  }
  const node = nodes.find(p => merchantURL(p.url, true)?.url === m.url) || nodes[0];
  const description = text(strip(node?.description || metas['og:description'] || metas.description || ''), 1400);
  const title = text(strip(node?.name || metas['og:title'] || ''), 180);
  if (!title) return null;
  // Multiple offers often mix a cheap swatch with yardage. Never choose the lowest price.
  const offers = list(node?.offers).flatMap(o => o['@type'] === 'AggregateOffer' ? list(o.offers) : [o]);
  const selected = offers.filter(o => {
    const u = merchantURL(o.url, true);
    return u && u.url === m.url && new URL(m.url).searchParams.has('variant');
  });
  const offer = offers.length === 1 ? offers[0] : selected.length === 1 && /\b(?:yard|metre|meter)\b/i.test(selected[0].name || '') ? selected[0] : null;
  const isSwatch = /\b(?:swatch|sample)\b/i.test([title, offer?.name, selected[0]?.name].filter(Boolean).join(' ')) && !/\byardage\b/i.test(title);
  const rawPrice = offer?.price ?? offer?.priceSpecification?.price;
  const currency = text(offer?.priceCurrency || offer?.priceSpecification?.priceCurrency, 3).toUpperCase();
  const unit = unitFrom([offer?.name, offer?.description, description].filter(Boolean).join(' '));
  const validPrice = rawPrice != null && /^\d+(?:\.\d{1,4})?$/.test(String(rawPrice)) && /^[A-Z]{3}$/.test(currency) && !!unit && !isSwatch;
  const stockValues = offers.map(o => availability(o.availability));
  const stock = offer ? availability(offer.availability) : stockValues.length && stockValues.every(v => v === stockValues[0]) ? stockValues[0] : 'unknown';
  // Swatchon's public product markup may omit JSON-LD photos and use a site logo
  // for og:image. Only its seller-authored thumbnail naming this exact SKU is a
  // product-photo fallback; an AggregateOffer range remains an unknown unit price.
  const swatchonSku=m.shop.name==='Swatchon'?(m.url.match(/\/fabric\/(QL-\d+)/i)?.[1]||text(node?.sku,30)):'';
  const swatchonPhoto=swatchonSku?[...(html.match(/<img\b[^>]*>/gi)||[])].map(attrs).find(a=>a.alt?.toUpperCase().startsWith(swatchonSku.toUpperCase()+' '))?.src:'';
  const images=[...list(node?.image),swatchonPhoto,metas['og:image']].filter(value=>!(m.shop.name==='Swatchon'&&typeof value==='string'&&/\/images\/og-default\./i.test(value)));
  return { url: m.url, merchant: m.shop.name, place: m.shop.place, title,
    image: images.map(value=>publicImage(value,m.url)).find(Boolean)||'',
    description, composition: text(plain(node?.material), 180),
    price: validPrice ? String(rawPrice) : '', currency: validPrice ? currency : '', unit: validPrice ? unit : '',
    availability: stock,
    evidence: node ? 'seller_listing' : 'seller_page', checkedAt: new Date(now).toISOString(),
    isSwatch };
}

// Shopify's product minimum can be the swatch price. Resolve an explicit variant
// or the sole non-swatch variant, and require the page to state its selling unit.
export function applyShopifyVariant(product, data, html) {
  const u = new URL(product.url);
  if (data.handle !== u.pathname.split('/').filter(Boolean).at(-1)) return product;
  const variantId = u.searchParams.get('variant');
  const variants = list(data.variants);
  const choices = variantId ? variants.filter(v => String(v.id) === variantId) : variants.filter(v => !/\b(?:swatch|sample)\b/i.test(v.title || ''));
  if (choices.length !== 1) return product;
  const v = choices[0];
  if (/\b(?:swatch|sample)\b/i.test(v.title || '')) return { ...product, isSwatch:true };
  const amount = Number.isInteger(v.price) && v.price >= 0 ? (v.price / 100).toFixed(2) : '';
  const visible = strip(html);
  const position = amount ? visible.indexOf(amount) : -1;
  const unit = position >= 0 ? unitFrom(visible.slice(Math.max(0,position-20),position+100)) : '';
  // Currency comes from seller structured data, never from the merchant's location.
  const currencyMatch = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/);
  const currency = currencyMatch?.[1] || '';
  return { ...product, availability: typeof v.available==='boolean' ? v.available?'in_stock':'out_of_stock' : product.availability,
    price: amount && unit && currency ? amount : '', currency: unit ? currency : '', unit };
}

async function limitedText(response, max = 2 * 1024 * 1024) {
  if (!response.body?.getReader) { const s = await response.text(); if (s.length > max) throw fail('Listing too large.', 502); return s; }
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) throw fail('Listing too large.', 502); chunks.push(value); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

export function createFabricSearch({ fetchImpl = fetch, read, write, apiKey = () => '', model, rank, now = Date.now } = {}) {
  // Public listing cache only: exact URL, short lifetime, no failed/empty responses.
  const listings = new Map();
  async function getPage(url, signal) {
    let target = merchantURL(url)?.url;
    for (let hop = 0; target && hop < 3; hop++) {
      const response = await fetchImpl(target, { redirect: 'manual', signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(6000)]), headers: { 'User-Agent': 'MAYA fabric sourcing (maya.manasiyo.com)', Accept: 'text/html,application/json' } });
      if ([301,302,303,307,308].includes(response.status)) { target = merchantURL(new URL(response.headers.get('location'), target).href)?.url; await response.body?.cancel?.(); continue; }
      if (!response.ok) throw fail('Retailer did not answer.', 502);
      return { body: await limitedText(response), url: target };
    }
    throw fail('Retailer redirect unavailable.', 502);
  }
  async function verify(candidate, signal) {
    const target = merchantURL(candidate.url, true);
    if (!target) return null;
    const linkOnly = () => ({ url: target.url, merchant: target.shop.name, place: target.shop.place,
      title: 'View fabric listing', image: '', description: '', composition: '', price: '', unit: '', currency: '',
      availability: 'unknown', evidence: 'search_link', checkedAt: '', reason: candidate.reason || '' });
    const hit = listings.get(target.url);
    if (hit && now() - hit.at < 5 * 60 * 1000) return { ...hit.product, reason: candidate.reason || '' };
    // Redirects, response bodies and the optional Shopify facts share one budget.
    // A fresh timeout at each hop could consume the browser's entire search window.
    const listingSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000);
    try {
      const page = await getPage(target.url, listingSignal);
      let product = parseListing(page.body, page.url, now());
      if (product && target.shop.shopify && !product.price) {
        try {
          const variantUrl = new URL(product.url); variantUrl.search=''; variantUrl.pathname=variantUrl.pathname.replace(/\/$/,'')+'.js';
          const variantPage = await getPage(variantUrl.href, listingSignal);
          product = applyShopifyVariant(product, JSON.parse(variantPage.body), page.body);
        } catch { /* unknown variant or unit remains unknown */ }
      }
      if (!product) return linkOnly();
      if (product.isSwatch || product.availability === 'out_of_stock' || !isFabricProduct(product)) return null;
      if (listings.size >= 250) listings.clear();
      listings.set(target.url, { product, at: now() });
      return { ...product, reason: candidate.reason || '' };
    } catch (e) {
      if (signal?.aborted) throw e;
      // A cited listing stays useful when a retailer blocks page access. It carries no invented facts.
      return linkOnly();
    }
  }
  async function requireSubmission(id) {
    if (!SUBMISSION.test(id || '')) throw fail('Open a submission first.');
    const marker = await read('submissions/' + id + '/submission.json');
    if (!marker.ok) throw fail(marker.status === 404 ? 'Submission not found.' : 'Submission unavailable.', marker.status === 404 ? 404 : 503);
  }
  async function savedGarments(id,required=false){
    const saved=await read('submissions/'+id+'/pieces.json');
    if(!saved.ok){if(saved.status===404&&!required)return {pieces:[],images:new Map()};throw fail(saved.status===404?'Dissect and save this look before finding its fabrics.':'Saved dissection could not be loaded.',saved.status===404?409:503);}
    try{
      const dissection=JSON.parse(saved.buf.toString('utf8')),images=new Map(),ids=new Set();
      if(!Array.isArray(dissection.pieces))throw Error();
      const pieces=dissection.pieces.flatMap((piece,index)=>{
        if(!isFabricPiece(piece))return [];
        const normalized=garmentPiece({...piece,id:piece.id||'saved-piece-'+index,name:piece.name||piece.label||'Item '+(index+1),fabric:piece.fabric||dissection.fabric_type||''});
        if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(normalized.id)||ids.has(normalized.id))throw Error();ids.add(normalized.id);
        if(typeof piece._image==='string'&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(piece._image)&&piece._image.length<=4*1024*1024)images.set(normalized.id,piece._image);
        return [normalized];
      });
      return {pieces,images};
    }catch{throw fail('Saved dissection could not be read.',503);}
  }
  function existingSelections(data,pieces){
    const urls=new Set(data.items.map(product=>product?.url));
    if(Object.hasOwn(data,'selectedUrl')&&(typeof data.selectedUrl!=='string'||data.selectedUrl&&!urls.has(data.selectedUrl)))throw Error();
    const map=data.selectedByGarment;
    const hasFingerprints=Object.hasOwn(data,'selectedGarmentFingerprints'),fingerprints=data.selectedGarmentFingerprints;
    if(hasFingerprints&&(!Object.hasOwn(data,'selectedByGarment')||!fingerprints||typeof fingerprints!=='object'||Array.isArray(fingerprints)||Object.values(fingerprints).some(value=>typeof value!=='string'||!/^v1:[a-f0-9]{64}$/.test(value))))throw Error();
    const legacyPiece=product=>{
      // Old product attribution has no material snapshot. A reused index or a
      // duplicated name alone cannot establish which garment was selected.
      const matches=pieces.filter(piece=>product?.garment&&piece.name===product.garment);
      return matches.length===1&&(!product.garmentId||product.garmentId===matches[0].id)?matches[0]:null;
    };
    if(Object.hasOwn(data,'selectedByGarment')){
      if(!map||typeof map!=='object'||Array.isArray(map)||Object.values(map).some(url=>typeof url!=='string'||!urls.has(url))||Object.keys(map).some(id=>!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(id)))throw Error();
      if(hasFingerprints&&(Object.keys(fingerprints).length!==Object.keys(map).length||Object.keys(map).some(id=>!Object.hasOwn(fingerprints,id))))throw Error();
      return Object.fromEntries(Object.entries(map).filter(([id,url])=>{
        const piece=pieces.find(piece=>piece.id===id);
        return piece&&(hasFingerprints?fingerprints[id]===garmentFingerprint(piece):legacyPiece(data.items.find(product=>product.url===url))?.id===id);
      }));
    }
    const selected=data.items.find(product=>product.url===data.selectedUrl);
    if(!selected)return {};
    const piece=legacyPiece(selected);
    return piece?{[piece.id]:selected.url}:{};
  }
  async function loadBook(user, id,readGarments=()=>savedGarments(id)) {
    await requireSubmission(id);
    const path = scopeKey(user, id), found = await read(path);
    if (!found.ok) { if (found.status === 404) return { items: [], selectedUrl: '', selectedByGarment:{}, generation: '0' }; throw fail('Lookbook unavailable.', 503); }
    const {pieces}=await readGarments();
    try {
      const data = JSON.parse(found.buf.toString('utf8'));
      if (!Array.isArray(data.items)||data.items.length>100||data.items.some(item=>!item||typeof item!=='object'||typeof item.url!=='string')||new Set(data.items.map(item=>item.url)).size!==data.items.length||!found.generation) throw Error();
      const selectedByGarment=existingSelections(data,pieces);
      return { items: data.items, selectedUrl: data.selectedUrl || '',selectedByGarment, generation: found.generation };
    } catch { throw fail('Lookbook could not be read.', 503); }
  }
  function savedProduct(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Choose a supported fabric product.');
    const inventory=String(input?.url||'');
    if (/^\/aesthetics\/fabrics\/[A-Za-z0-9_% -]+\.(?:png|jpe?g|webp)$/i.test(inventory) && !/\.\.|%2f|%5c|%2e/i.test(inventory)) {
      return {url:inventory,image:inventory,title:text(input.title,180),merchant:'Atelier',description:text(input.description,1400),garment:text(input.garment,80),garmentId:text(input.garmentId,100),evidence:'atelier_inventory',availability:'unknown',savedAt:new Date(now()).toISOString()};
    }
    const m = merchantURL(input?.url, true);
    if (!m) throw fail('Choose a supported product listing.');
    const p = { url: m.url, merchant: m.shop.name, place: m.shop.place };
    for (const k of ['title','description','composition','price','unit','currency','availability','evidence','checkedAt','reason','garment','garmentId']) p[k] = text(input[k], k === 'description' ? 1400 : 220);
    p.image = publicImage(input.image, m.url);
    p.savedAt = new Date(now()).toISOString();
    return p;
  }
  async function saveBook(user, body) {
    const id = text(body.submissionId, 121);
    let garments;
    const readGarments=()=>garments||=(savedGarments(id));
    const book = await loadBook(user, id,readGarments);
    if (String(body.generation) !== book.generation) throw fail('Lookbook changed in another window. Reload it before saving.', 409);
    if (!['save','remove','select'].includes(body.action)) throw fail('Choose a lookbook action.');
    const submitted=savedProduct(body.product),existing=book.items.find(product=>product.url===submitted.url);
    if(body.action!=='remove'&&!existing&&book.items.length>=100)throw fail('This lookbook has 100 fabrics. Remove one before adding another.');
    let targetGarment;
    const explicitId=body.garmentId??'',attributedId=submitted.garmentId||'';
    if(body.action!=='remove'&&(explicitId||attributedId)){
      if(typeof explicitId!=='string'||explicitId&&!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(explicitId))throw fail('Choose a valid saved garment.');
      if(explicitId&&attributedId&&explicitId!==attributedId)throw fail('This fabric was recommended for a different garment. Choose its garment before selecting it.',409);
      const {pieces}=await readGarments();targetGarment=pieces.find(piece=>piece.id===(explicitId||attributedId));
      if(!targetGarment)throw fail('This garment is not in the saved dissection. Save it first.',409);
    }
    let product=existing?{...existing}:submitted;
    if(body.action!=='remove'&&!existing&&!submitted.url.startsWith('/aesthetics/fabrics/')){
      const verified=await verify({url:submitted.url});
      if(!verified||verified.evidence==='search_link'||!verified.image||!isFabricProduct(verified))throw fail('This fabric listing could not be verified. Refresh its source before saving.',422);
      product={...verified,garment:submitted.garment,garmentId:submitted.garmentId,savedAt:new Date(now()).toISOString()};
    }
    let items = book.items.filter(p => p.url !== product.url);
    let selectedUrl = book.selectedUrl;
    const selectedByGarment={...book.selectedByGarment};
    if(targetGarment){
      if(!existing){product.garmentId=targetGarment.id;product.garment=targetGarment.name;}
      if(body.action==='select')selectedByGarment[targetGarment.id]=product.url;
    }
    if (body.action !== 'remove') { items.unshift(product); if (items.length > 100) throw fail('This lookbook has 100 fabrics. Remove one before adding another.'); }
    if (body.action === 'select') selectedUrl = product.url;
    if (body.action === 'remove'){if(selectedUrl===product.url)selectedUrl='';for(const garment of Object.keys(selectedByGarment))if(selectedByGarment[garment]===product.url)delete selectedByGarment[garment];}
    const selectedGarmentFingerprints={};
    if(Object.keys(selectedByGarment).length){const {pieces}=await readGarments();for(const garmentId of Object.keys(selectedByGarment))selectedGarmentFingerprints[garmentId]=garmentFingerprint(pieces.find(piece=>piece.id===garmentId));}
    try { await write(scopeKey(user, id), Buffer.from(JSON.stringify({ items, selectedUrl, selectedByGarment,selectedGarmentFingerprints })), 'application/json', book.generation); }
    catch (e) { throw fail(e.status === 412 ? 'Lookbook changed in another window. Reload it before saving.' : 'Fabric did not save. Try again.', e.status === 412 ? 409 : 503); }
    return loadBook(user, id,readGarments);
  }
  async function direct(input, signal) {
    // Public queries use bounded material vocabulary, never client names/measurements.
    // Refinements remain with web discovery rather than replaying a stale seed.
    const queries=fabricSeedQueries(input);
    if (!queries.length) return [];
    const allowed = requestedShops(input);
    const shops=allowed.filter(shop=>shop.shopify).slice(0,4);
    const results = await Promise.all(shops.flatMap(shop=>queries.map(async q => {
      try {
        const url = 'https://' + shop.host + '/search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=product&resources[limit]=3';
        // The feed query is intentional and must not pass through product URL canonicalization.
        const r = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]) });
        if (!r.ok) return [];
        const data = JSON.parse(await limitedText(r, 256 * 1024));
        return list(data.resources?.results?.products).filter(p => p.available !== false&&(!p.title||isFabricProduct({...p,description:p.body||p.description||''}))).slice(0, 2).map(p => ({ url: new URL(p.url, 'https://' + shop.host).href, reason: 'Initial keyword result; checking closer matches.' }));
      } catch { return []; }
    })));
    const groups=shops.map(shop=>results.flat().filter(c=>merchantURL(c.url,true)?.shop===shop)),balanced=[];
    for(let index=0;index<queries.length*2;index++)for(const group of groups)if(group[index])balanced.push(group[index]);
    const unique=[...new Map(balanced.map(candidate=>[merchantIdentity(candidate.url),candidate])).values()];
    return (await Promise.all(unique.slice(0, 5).map(c => verify(c, signal)))).flatMap(product=>{const match=product&&allowed.includes(merchantURL(product.url,true)?.shop)&&fabricProductMatch(product,{...input,allowVisualOnly:!!rank&&!!input.image});return match?[{...product,...match}]:[];});
  }
  async function search(user, body, emit, signal = new AbortController().signal) {
    const input = normalizeFabricRequest(body);
    let selectedReference='';
    if (input.submissionId) {
      await requireSubmission(input.submissionId);
      const summary = await read('submissions/' + input.submissionId + '/summary.json');
      if (summary.ok) { try { input.preferences = fabricPreferences(JSON.parse(summary.buf.toString('utf8'))) || input.preferences; } catch { throw fail('Saved fabric preferences could not be read safely.',503); } }
      else if (summary.status !== 404) throw fail('Submission preferences could not be loaded.', 503);
    }
    if (input.automatic) {
      if (!input.submissionId) throw fail('Open a saved, dissected submission first.');
      const {pieces,images:savedImages}=await savedGarments(input.submissionId,true);
      if (!pieces.length) throw fail('This dissection has no garment fabrics to source.',409);
      input.allPieces=pieces;
      if (input.piece.id || input.piece.name) {
        const candidates=pieces.filter(piece=>input.piece.id?piece.id===input.piece.id:piece.name===input.piece.name);
        if(candidates.length>1)throw fail('Choose this garment again so its saved identity can be checked.',409);
        const selected=candidates[0];
        if (!selected) throw fail('This garment is not in the saved dissection. Save it first.',409);
        input.piece=selected; input.pieces=[selected];selectedReference=savedImages.get(selected.id)||'';
      } else { input.piece={}; input.pieces=pieces.slice(0,12); }
      input.request='Find apparel fabric for these saved garments: '+input.pieces.map(piece=>piece.name+': '+piece.fabric).join('; ');
      input.history=[];
    }
    signal.throwIfAborted();
    const started = now(); let firstAt = null; let products = [];
    const send = event => { if (!signal.aborted) emit(event); };
    const searchDetails={preferences:input.preferences,garments:input.pieces.map(p=>({name:p.name,fabric:p.fabric,traits:p.fabric_spec})),
      retailerQueries:requestedShops(input).some(s=>s.shopify)?fabricSeedQueries(input):[],stores:requestedShops(input).map(s=>s.name),webQueries:[],query:'',observation:'',stage:'Searching retailers'};
    send({type:'context',searchDetails});
    send({ type: 'status', message: 'Searching fabric shops…' });
    const quick = direct(input, signal).then(items => {
      if (items.length) { products = items; firstAt = now() - started; send({ type: 'products', products, preliminary: true }); }
    });
    let discovery = null, warning = '';
    try {
      if (!apiKey()) throw fail('Web search is unavailable. Showing retailer results where available.', 503);
      const r = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey(), 'Content-Type': 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]), body: JSON.stringify(webSearchBody({...input,selectedReference}, model)),
      });
      if (!r.ok) throw fail('Web search is temporarily unavailable. Try again shortly.', 502);
      discovery = readDiscovery(await r.json());
      Object.assign(searchDetails,{query:discovery.query,observation:discovery.observation,webQueries:discovery.webQueries,stage:'Checking seller listings'});
      send({type:'context',searchDetails});
      send({type:'status',message:'Checking seller listings…'});
    } catch (e) { warning = e.status ? e.message : 'Web search took too long or was interrupted. You can retry.'; }
    await quick;
    if (signal.aborted) return;
    if (discovery) {
      const allowed = requestedShops(input);
      // Qualified base colors belong only to canonical saved garment IDs. They
      // cannot replace explicit words or flow to another garment/account.
      input.visualColors=Object.fromEntries(discovery.garmentColors.filter(hint=>input.pieces.some(piece=>piece.id===hint.garmentId)).map(hint=>[hint.garmentId,hint.colors]));
      const checked = await Promise.all(discovery.candidates.filter(c => allowed.includes(merchantURL(c.url, true)?.shop)).map(c => verify(c, signal)));
      if(signal.aborted)return;
      const discovered = checked.flatMap(product=>{const match=product&&allowed.includes(merchantURL(product.url,true)?.shop)&&fabricProductMatch(product,{...input,allowVisualOnly:!!rank&&!!input.image});return match?[{...product,...match}]:[];});
      products=[...new Map([...discovered,...products].map(p=>[merchantIdentity(p.url),p])).values()].slice(0,8);
      products=products.filter(product=>fabricProductMatch(product,{...input,pieces:input.pieces.filter(piece=>piece.id===product.garmentId),allowVisualOnly:!!rank&&!!input.image}));
    }
    const eligibleCount=products.length;
    if(products.length&&input.image&&rank){
      send({type:'status',message:'Checking fabric photos against this look…'});
      const eligible=products;
      try{
        const matches=await rank({garmentImage:selectedReference||input.image,traits:{...input.piece.fabric_spec,garmentId:input.piece.id,garment:input.piece.name,fabric:input.pieces.map(p=>p.name+': '+p.fabric).join('; '),garments:input.pieces,request:input.request,preferences:input.preferences,resolvedSearch:discovery?.query||'',referenceObservation:discovery?.observation||''},products:eligible,signal});
        if(signal.aborted)return;
        products=list(matches).flatMap(match=>{const source=eligible.find(p=>p.url===match.url);return source?[{...source,reason:text(match.reason,220)}]:[];});
      }catch(e){if(signal.aborted)return;products=[];warning='Fabric photo comparison was unavailable. Refresh to check these materials again.';}
    }else if(products.length&&input.image){
      warning=[warning,'Fabric photos have not been compared. These listings match the material words only.'].filter(Boolean).join(' ');
    }
    if (products.length && firstAt === null) firstAt = now() - started;
    searchDetails.stage=products.length?'Verified matches':eligibleCount?'No visual matches confirmed':'No eligible seller listings confirmed';
    send({ type: 'products', products, preliminary: false });
    send({ type: 'done', products, searchDetails, query: discovery?.query || input.request, observation: discovery?.observation || '', warning,
      message: products.length ? (input.automatic?'Fabrics for this look. Seller availability may change.':'Refine these with another message.') : warning || 'No relevant fabric products were confirmed. Refresh or choose another store.',
      timings: { firstResultsMs: firstAt, totalMs: now() - started } });
    // Safe aggregate diagnostics only. No request, image, URL or account identifiers.
    return { count: products.length, firstResultsMs: firstAt, totalMs: now() - started };
  }
  return { search, loadBook, saveBook, verify };
}

export function mountFabricSearch(app, { requireAdmin, requireAuthHeader, json, rateLimit, ...deps }) {
  const service = createFabricSearch(deps);
  app.post('/api/admin/fabrics/search', requireAuthHeader, json({ limit: '5mb' }), async (req, res) => {
    const controller = new AbortController();
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(55000)]);
    res.on('close', () => controller.abort());
    try {
      const stats=await untilAborted((async()=>{
        const user = await requireAdmin(req);
        signal.throwIfAborted();
        const rl = rateLimit(user.sub, user.email);
        if (!rl.ok) throw fail('Please wait before searching again.', 429);
        normalizeFabricRequest(req.body);
        return service.search(user, req.body, event => {
          if (res.destroyed) return;
          if (!res.headersSent) { res.set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' }); res.flushHeaders(); }
          res.write(JSON.stringify(event) + '\n');
        }, signal);
      })(),signal);
      if (stats) console.log('[fabric.search]', JSON.stringify(stats));
      res.end();
    } catch (e) {
      if (res.destroyed) return;
      const error = e.name==='TimeoutError'?'Fabric search timed out. Refresh to retry.':e.status ? e.message : 'Fabric search is unavailable. Try again.';
      if (res.headersSent) res.end(JSON.stringify({ type: 'error', message: error }) + '\n');
      else res.status(e.status || 503).json({ error });
    }
  });
  app.get('/api/admin/fabrics/lookbook', requireAuthHeader, async (req, res) => {
    try { const user = await requireAdmin(req); res.set('Cache-Control','no-store').json({ ok: true, ...await service.loadBook(user, String(req.query.submissionId || '')) }); }
    catch (e) { res.status(e.status || 503).json({ error: e.status ? e.message : 'Lookbook unavailable.' }); }
  });
  app.post('/api/admin/fabrics/lookbook', requireAuthHeader, json({ limit: '12kb' }), async (req, res) => {
    try { const user = await requireAdmin(req); res.set('Cache-Control','no-store').json({ ok: true, ...await service.saveBook(user, req.body || {}) }); }
    catch (e) { res.status(e.status || 503).json({ error: e.status ? e.message : 'Fabric did not save.' }); }
  });
  return service;
}
