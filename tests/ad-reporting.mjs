import assert from 'node:assert/strict';
import {createGoogleAdsReader,createChatGPTAdsReader,createMetaAdsReader,cachedAdReader,combineDirectAds} from '../docs/server/ad-reporting.mjs';
const config={id:'fixture-id',secret:'fixture-secret',refresh:'fixture-refresh',customer:'123',login:'456'};
const row=(id,date,cost)=>({campaign:{id,name:'Campaign '+id,status:'PAUSED'},customer:{currencyCode:'USD',timeZone:'America/Los_Angeles'},segments:{date},metrics:{costMicros:String(cost),clicks:'2',impressions:'10',conversions:'1'}});
let calls=0;
const read=createGoogleAdsReader({config,now:()=>Date.parse('2026-10-31T02:00:00Z'),fetchImpl:async(url,options)=>{
 calls++;assert.equal(options.method,'POST');assert.ok(options.signal);
 if(url.includes('oauth2'))return Response.json({access_token:'fixture-access'});
 assert.equal(url,'https://googleads.googleapis.com/v26/customers/123/googleAds:search');assert.equal(options.headers['login-customer-id'],'456');assert.ok(!('developer-token' in options.headers),'Retired token is neither required nor sent');
 const body=JSON.parse(options.body);assert.match(body.query,/FROM campaign/);assert.match(body.query,/LAST_30_DAYS/);
 return body.pageToken?Response.json({results:[row('B','2026-10-20',2000000)]}):Response.json({results:[row('A','2026-10-29',1500000)],nextPageToken:'next'});
}});
const result=await read();assert.equal(calls,3);assert.equal(result.connected,true);assert.equal(result.d7.spend,1.5);assert.equal(result.campaignDaily.length,2);assert.equal(result.campaignDaily[0].status,'PAUSED');
const combined=combineDirectAds({google:result},{now:Date.parse('2026-10-31T02:00:00Z')});assert.equal(combined.campaignDaily.length,2);assert.equal(combined.days.length,30);assert.equal(combined.google.at(-1).spend,1.5);
assert.equal((await createGoogleAdsReader({config:{},fetchImpl:()=>{throw Error('Must not call');}})()).connected,false);
assert.equal((await createGoogleAdsReader({config,fetchImpl:async()=>new Response('',{status:401})})()).connected,false);
let pages=0;const capped=await createGoogleAdsReader({config,fetchImpl:async url=>url.includes('oauth2')?Response.json({access_token:'x'}):(pages++,Response.json({results:[row('A','2026-10-29',1)],nextPageToken:'repeat'}))})();assert.equal(pages,10);assert.equal(capped.connected,false,'Partial pagination cannot publish complete totals');
const empty=await createGoogleAdsReader({config,fetchImpl:async url=>Response.json(url.includes('oauth2')?{access_token:'x'}:{})})();assert.equal(empty.coverage,'no_rows');assert.equal(empty.currency,null,'Absent currency stays unavailable');assert.deepEqual(combineDirectAds({google:empty}).campaignDaily,[]);
console.log('Ad reporting: supported read-only Google endpoint, paginated campaigns, completed account-local week, direct dashboard fallback, missing/auth/partial/empty states passed. Fake providers only.');


const at=()=>Date.parse('2026-10-31T02:00:00Z'); // Oct 30 Pacific
const adsConfig={apiKey:'fake-advertiser-key',accountId:'adacct_fixture'};
let adsCalls=[];
const adsFetch=async(url,options)=>{
 const u=new URL(url);adsCalls.push(u);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.ok(options.signal);assert.equal(options.headers.Authorization,'Bearer fake-advertiser-key');assert.ok(!u.search.includes('fake-advertiser-key'));
 if(u.pathname==='/v1/ad_account')return Response.json({id:'adacct_fixture',currency_code:'USD',timezone:'America/Los_Angeles'});
 if(u.pathname==='/v1/campaigns')return Response.json({data:[{id:'cmp_a',name:'Same name',status:'active'},{id:'cmp_b',name:'Same name',status:'paused'},{id:'cmp_zero',name:'No delivery yet',status:'active'}],has_more:false});
 assert.equal(u.pathname,'/v1/ad_account/insights');
 assert.deepEqual(JSON.parse(u.searchParams.get('time_ranges[]')),{type:'date_range',since:'2026-09-30',until:'2026-10-29',timezone:'America/Los_Angeles'});
 assert.equal(u.searchParams.get('view_through_attribution_window_days'),'1');assert.equal(u.searchParams.get('attribution_window_days'),'30');assert.equal(u.searchParams.get('attribution_time_basis'),'ad_event_time');
 assert.ok(u.searchParams.getAll('fields[]').includes('metadata.readable_time'));
 const level=u.searchParams.get('aggregation_level');assert.ok(u.searchParams.getAll('fields[]').includes(level+'.cpc'));
 if(level==='ad_account')return Response.json({data:[{readable_time:'2026-10-29',impressions:30,clicks:6,spend:9,cpc:1.4}],has_more:false});
 if(!u.searchParams.get('after'))return Response.json({data:[{campaign_id:'cmp_a',campaign_name:'Old name',campaign_status:'paused',readable_time:'2026-10-29',impressions:20,clicks:4,spend:6,cpc:1.4}],has_more:true,last_id:'cursor?not=a-url'});
 assert.equal(u.searchParams.get('after'),'cursor?not=a-url');
 return Response.json({data:[{campaign_id:'cmp_b',readable_time:'2026-10-29',impressions:10,clicks:2,spend:3,cpc:1.4}],has_more:false});
};
const ai=await createChatGPTAdsReader({config:adsConfig,now:at,fetchImpl:adsFetch})();
assert.equal(ai.connected,true);assert.equal(ai.campaignDaily.length,2);assert.equal(ai.campaignDaily[0].status,'active','Current inventory overrides historical row state');assert.equal(ai.d7.spend,9);assert.equal(ai.series[0].cpc,1.4,'Preserve provider CPC instead of recomputing recent finalized costs');assert.equal(adsCalls.length,5);
const direct=combineDirectAds({google:result,meta:{connected:false},chatgpt:ai},{now:at()});
assert.equal(direct.campaignDaily.length,4);assert.equal(direct.chatgpt.at(-1).cpc,1.4);assert.equal(direct.meta,null);assert.equal(direct.sources.chatgpt.spend,9);assert.equal(direct.campaigns.filter(c=>c.source==='chatgpt').length,3,'Duplicate names and zero-delivery campaigns retain independent IDs');assert.equal(direct.campaigns.find(c=>c.campaignId==='cmp_b').status,'paused');assert.equal(direct.google.at(-2).spend,0,'Missing calendar days remain present');
const wrong=await createChatGPTAdsReader({config:adsConfig,fetchImpl:async()=>Response.json({id:'other_account'})})();assert.equal(wrong.code,'account_mismatch');
let notConfiguredCalls=0;
assert.equal((await createChatGPTAdsReader({config:{},fetchImpl:async()=>{notConfiguredCalls++;}})()).code,'not_configured');assert.equal(notConfiguredCalls,0);
assert.equal((await createChatGPTAdsReader({config:adsConfig,fetchImpl:async()=>new Response('secret raw provider error',{status:403})})()).code,'authorization');
for(const broken of [{data:[],has_more:true},{data:[],has_more:true,last_id:'repeat'},{}]){
 let count=0;const fail=await createChatGPTAdsReader({config:adsConfig,now:at,fetchImpl:async(url,options)=>{
  if(new URL(url).pathname==='/v1/ad_account')return Response.json({id:adsConfig.accountId,timezone:'America/Los_Angeles',currency_code:'USD'});
  count++;return Response.json(broken);
 }})();assert.equal(fail.connected,false);assert.ok(count<=6);assert.ok(!JSON.stringify(fail).includes(adsConfig.apiKey));
}
const cappedAi=await createChatGPTAdsReader({config:adsConfig,now:at,fetchImpl:async url=>new URL(url).pathname==='/v1/ad_account'?Response.json({id:adsConfig.accountId,timezone:'America/Los_Angeles',currency_code:'USD'}):Response.json({data:[],has_more:true,last_id:String(Math.random())})})();assert.equal(cappedAi.connected,false);
const otherCurrency=combineDirectAds({google:result,chatgpt:{...ai,currency:'EUR'}},{now:at()});assert.deepEqual(otherCurrency.excludedSources,['chatgpt']);assert.equal(otherCurrency.chatgpt,null);assert.ok(!otherCurrency.sources.chatgpt,'Never add unconverted currencies into dollar metrics');

let metaCalls=0;
const meta=await createMetaAdsReader({config:{token:'fake-meta-key',account:'123'},now:at,fetchImpl:async(url,options)=>{
 metaCalls++;const u=new URL(url);assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer fake-meta-key');assert.equal(options.redirect,'error');assert.ok(!url.includes('fake-meta-key'));assert.equal(u.origin,'https://graph.facebook.com');
 if(u.pathname.endsWith('/act_123'))return Response.json({account_id:'123',currency:'USD',timezone_name:'America/Los_Angeles'});
 if(u.pathname.endsWith('/campaigns'))return Response.json({data:[{id:'meta_a',name:'Meta campaign',effective_status:'PAUSED'}]});
 if(u.searchParams.get('level')==='campaign'){
  assert.equal(u.searchParams.get('time_increment'),'1');
  if(!u.searchParams.get('after'))return Response.json({data:[{campaign_id:'meta_a',campaign_name:'Meta campaign',date_start:'2026-10-29',spend:'4',impressions:'25',clicks:'10',inline_link_clicks:'3'}],paging:{next:'https://do-not-follow.invalid?token=leak',cursors:{after:'next_cursor'}}});
  return Response.json({data:[]});
 }
 return Response.json({data:[{spend:'4',impressions:'25',clicks:'10',inline_link_clicks:'3',reach:'21',frequency:'1.2'}]});
}})();assert.equal(meta.connected,true);assert.equal(metaCalls,6);assert.equal(meta.d7.reach,21);assert.equal(meta.d7.linkClicks,3);assert.equal(meta.campaignDaily[0].status,'PAUSED');
const all=combineDirectAds({google:result,meta,chatgpt:ai},{now:at()});assert.equal(Object.keys(all.sources).length,3);assert.equal(all.meta.at(-1).linkClicks,3);
assert.equal((await createMetaAdsReader({config:{}})()).connected,false);
assert.equal((await createMetaAdsReader({config:{token:'fake',account:'123'},fetchImpl:async()=>new Response('{}',{status:400})})()).connected,false);

let clock=0,reads=0,release;
const cache=cachedAdReader(async()=>{reads++;await new Promise(r=>release=r);return {connected:true};},{now:()=>clock});
const first=cache(),second=cache();assert.equal(first,second);await Promise.resolve();assert.equal(reads,1);release();await first;await cache();assert.equal(reads,1);clock=60001;const next=cache();await Promise.resolve();release();await next;assert.equal(reads,2);
const server=(await import('node:fs')).readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');assert.ok(!/WINDSOR_API_KEY|connectors\.windsor|windsorInsights/.test(server),'Retired intermediary has no runtime/configuration path');
console.log('Direct Ads: Google, ChatGPT and Meta contracts, account identity, provider status, pagination/caps, completed local days, currency isolation, independent failures, link-click parity and shared in-flight cache passed. Fake providers only.');

const {buildAdminCommandSnapshot}=await import('../docs/server/admin-command.mjs');
const snap=buildAdminCommandSnapshot({ads:all},new Date(at()));assert.equal(snap.panels.ads.spend7,14.5);assert.equal(snap.panels.ads.today,null);assert.equal(snap.panels.ads.yesterday.linkClicks,11);assert.match(snap.briefing.join(' '),/current-day activity is unavailable/);
let failedReads=0;const failedCache=cachedAdReader(async()=>{failedReads++;return {connected:false};},{now:()=>clock});await failedCache();await failedCache();assert.equal(failedReads,1);clock+=10001;await failedCache();assert.equal(failedReads,2);

const missingGoogle=await createGoogleAdsReader({config:{customer:'123'},fetchImpl:()=>{throw Error('Missing OAuth must not fetch');}})();assert.equal(missingGoogle.code,'not_configured');assert.deepEqual(missingGoogle.missing,['id','secret','refresh']);assert.ok(!missingGoogle.missing.includes('dev'));
const noManager=await createGoogleAdsReader({config:{...config,login:''},fetchImpl:async(url,options)=>{if(url.includes('oauth2'))return Response.json({access_token:'fixture'});assert.ok(!('login-customer-id' in options.headers));assert.ok(!('developer-token' in options.headers));return Response.json({results:[row('A','2026-10-29',1000000)]});}})();assert.equal(noManager.connected,true,'Direct account access needs no manager account or retired developer token');
