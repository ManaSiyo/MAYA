// Public retailer policy only; no account data, providers or private storage.
export const FABRIC_SHOPS = Object.freeze([
  { name: 'Britex Fabrics', host: 'britexfabrics.com', place: 'San Francisco', shopify: true },
  { name: 'Stonemountain & Daughter', host: 'stonemountainfabric.com', place: 'Berkeley' },
  { name: 'Harts Fabric', host: 'hartsfabric.com', place: 'Santa Cruz' },
  { name: 'Amazon', host: 'amazon.com', place: 'Online' },
  { name: 'Mood Fabrics', host: 'www.moodfabrics.com', place: 'New York', shopify: true },
  { name: 'Swatchon', host: 'www.swatchon.com', place: 'Online' },
  { name: 'Blackbird Fabrics', host: 'www.blackbirdfabrics.com', place: 'Vancouver', shopify: true },
  { name: 'The Fabric Store', host: 'thefabricstore.com', place: 'New Zealand', shopify: true },
  { name: 'Tessuti Fabrics', host: 'www.tessuti.com.au', place: 'Sydney', shopify: true },
]);
export const FABRIC_STORE_GROUPS = Object.freeze([
  {id:'local',label:'Local (Bay Area)',hosts:['britexfabrics.com','stonemountainfabric.com','hartsfabric.com']},
  {id:'mood',label:'Mood',hosts:['www.moodfabrics.com']},
  {id:'swatchon',label:'Swatchon',hosts:['www.swatchon.com']},
  {id:'amazon',label:'Amazon',hosts:['amazon.com']},
  {id:'others',label:'Others',hosts:['www.blackbirdfabrics.com','thefabricstore.com','www.tessuti.com.au']},
].map(group=>Object.freeze({...group,hosts:Object.freeze(group.hosts)})));

export function merchantURL(value, productOnly = false) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return null;
    const shop = FABRIC_SHOPS.find(s => u.hostname.replace(/^www\./, '') === s.host.replace(/^www\./, ''));
    if (!shop) return null;
    if (productOnly && !(shop.name==='Swatchon'
      ? /^\/(?:fabric\/QL-\d+|wholesale-fabric\/\d+)\/?$/i.test(u.pathname)
      : /\/products?\/[^/]+/i.test(u.pathname) || (shop.host === 'amazon.com' && /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:\/|$)/i.test(u.pathname)) || (shop.host === 'hartsfabric.com' && /\/[^/]+\.html$/i.test(u.pathname)))) return null;
    u.hash = '';
    // Keep selected variants; drop tracking and search query parameters.
    for (const key of [...u.searchParams.keys()]) if (!['variant', 'th', 'psc'].includes(key)) u.searchParams.delete(key);
    return { url: u.href, shop };
  } catch { return null; }
}


export function mentionsShop(q, shop) {
  const aliases = { 'Britex Fabrics':['britex','brightex'], 'Stonemountain & Daughter':['stonemountain','stone mountain'], 'Harts Fabric':['harts'], 'Amazon':['amazon'], 'Mood Fabrics':['mood'], 'Blackbird Fabrics':['blackbird'], 'The Fabric Store':['the fabric store'], 'Tessuti Fabrics':['tessuti'] };
  return (aliases[shop.name] || [shop.name.toLowerCase()]).some(name => q.includes(name));
}

export function requestedShops(input) {
  // An explicit current filter replaces merchant restrictions in older messages.
  if (input.storeGroups) {
    const hosts=new Set(FABRIC_STORE_GROUPS.filter(group=>input.storeGroups.includes(group.id)).flatMap(group=>group.hosts));
    return FABRIC_SHOPS.filter(shop=>hosts.has(shop.host));
  }
  let chosen = null;
  for (const step of [...input.history, { request: input.request }]) {
    const q = step.request.toLowerCase();
    if (/\b(?:anywhere|all shops|any shop|online is fine)\b/.test(q)) chosen = null;
    if (/\b(?:only local|local only|only nearby)\b/.test(q)) chosen = FABRIC_SHOPS.filter(s => FABRIC_STORE_GROUPS[0].hosts.includes(s.host));
    if (/\bonly\b/.test(q) && !/\bnot only\b/.test(q)) {
      const names = FABRIC_SHOPS.filter(s => mentionsShop(q, s));
      if (names.length) chosen = names;
    }
  }
  const shops=chosen || FABRIC_SHOPS;
  return input.stores?.length ? shops.filter(shop=>input.stores.includes(shop.host)) : shops;
}


// Shopify collection and direct product routes identify the same listing. Keep
// actual fetch/source destinations and selected variants intact.
export function merchantIdentity(value){const found=merchantURL(value,true);if(!found)return '';const u=new URL(found.url);u.hostname=u.hostname.replace(/^www\./,'');if(found.shop.shopify)u.pathname=u.pathname.replace(/^\/collections\/[^/]+(\/products\/[^/]+)\/?$/i,'$1').replace(/^(\/products\/[^/]+)\/$/i,'$1');return u.href;}
