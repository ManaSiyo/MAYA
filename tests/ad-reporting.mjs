import assert from 'node:assert/strict';
import {createGoogleAdsReader,directGoogleCampaigns,withDirectGoogle} from '../docs/server/ad-reporting.mjs';
const config={dev:'fixture-dev',id:'fixture-id',secret:'fixture-secret',refresh:'fixture-refresh',customer:'123',login:'456'};
const row=(id,date,cost)=>({campaign:{id,name:'Campaign '+id,status:'PAUSED'},customer:{currencyCode:'USD',timeZone:'America/Los_Angeles'},segments:{date},metrics:{costMicros:String(cost),clicks:'2',impressions:'10',conversions:'1'}});
let calls=0;
const read=createGoogleAdsReader({config,now:()=>Date.parse('2026-10-31T02:00:00Z'),fetchImpl:async(url,options)=>{
 calls++;assert.equal(options.method,'POST');assert.ok(options.signal);
 if(url.includes('oauth2'))return Response.json({access_token:'fixture-access'});
 assert.equal(url,'https://googleads.googleapis.com/v26/customers/123/googleAds:search');assert.equal(options.headers['login-customer-id'],'456');
 const body=JSON.parse(options.body);assert.match(body.query,/FROM campaign/);assert.match(body.query,/LAST_30_DAYS/);
 return body.pageToken?Response.json({results:[row('B','2026-10-20',2000000)]}):Response.json({results:[row('A','2026-10-29',1500000)],nextPageToken:'next'});
}});
const result=await read();assert.equal(calls,3);assert.equal(result.connected,true);assert.equal(result.d7.spend,1.5);assert.equal(result.campaignDaily.length,2);assert.equal(result.campaignDaily[0].status,'PAUSED');
const combined=directGoogleCampaigns(result);assert.equal(combined.campaignDaily.length,2);assert.deepEqual(combined.days,['2026-10-20','2026-10-29']);assert.equal(combined.google[1].spend,1.5);
assert.equal((await createGoogleAdsReader({config:{},fetchImpl:()=>{throw Error('Must not call');}})()).connected,false);
assert.equal((await createGoogleAdsReader({config,fetchImpl:async()=>new Response('',{status:401})})()).connected,false);
let pages=0;const capped=await createGoogleAdsReader({config,fetchImpl:async url=>url.includes('oauth2')?Response.json({access_token:'x'}):(pages++,Response.json({results:[row('A','2026-10-29',1)],nextPageToken:'repeat'}))})();assert.equal(pages,10);assert.equal(capped.connected,false,'Partial pagination cannot publish complete totals');
const empty=await createGoogleAdsReader({config,fetchImpl:async url=>Response.json(url.includes('oauth2')?{access_token:'x'}:{})})();assert.equal(empty.coverage,'no_rows');assert.equal(empty.currency,null,'Absent currency stays unavailable');assert.deepEqual(directGoogleCampaigns(empty).campaignDaily,[]);
console.log('Ad reporting: supported read-only Google endpoint, paginated campaigns, completed account-local week, direct dashboard fallback, missing/auth/partial/empty states passed. Fake providers only.');

const merged=withDirectGoogle({days:['2026-10-21'],meta:[{date:'2026-10-21',spend:3}],campaignDaily:[{source:'meta',date:'2026-10-21'}]},result);assert.equal(merged.campaignDaily.length,3);assert.deepEqual(merged.days,['2026-10-20','2026-10-21','2026-10-29']);assert.equal(merged.meta[1].spend,3);assert.equal(merged.google[2].spend,1.5);assert.equal(withDirectGoogle(merged,result),merged,'Never duplicate Google totals');
