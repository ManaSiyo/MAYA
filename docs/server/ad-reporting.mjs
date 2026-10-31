// Read-only Google Ads reporting. Uses only the owner's existing server config.
export function createGoogleAdsReader({config,fetchImpl=fetch,now=Date.now}){
 return async function googleAdsInsights(){
  const missing=['dev','id','secret','refresh','customer'].filter(key=>!config?.[key]);
  if(missing.length)return {connected:false,why:'Google Ads reporting is not configured.'};
  const signal=AbortSignal.timeout(18000);
  try{
   const tr=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.id,client_secret:config.secret,refresh_token:config.refresh,grant_type:'refresh_token'}),signal});
   if(!tr.ok)throw Error('Google Ads authorization could not be refreshed.');
   const token=await tr.json();if(!token.access_token)throw Error('Google Ads authorization is unavailable.');
   const headers={Authorization:'Bearer '+token.access_token,'developer-token':config.dev,'Content-Type':'application/json',...(config.login?{'login-customer-id':config.login}:{})};
   const query='SELECT campaign.id, campaign.name, campaign.status, customer.currency_code, customer.time_zone, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS';
   const rows=[];let pageToken='';
   for(let page=0;page<10;page++){
    const r=await fetchImpl('https://googleads.googleapis.com/v26/customers/'+config.customer+'/googleAds:search',{method:'POST',headers,body:JSON.stringify({query,...(pageToken?{pageToken}:{})}),signal});
    if(!r.ok)throw Error('Google Ads report could not be loaded ('+r.status+').');
    const data=await r.json();if(!Array.isArray(data.results)&&data.results!==undefined)throw Error('Google Ads returned an invalid report.');rows.push(...(data.results||[]));pageToken=data.nextPageToken||'';if(!pageToken)break;
   }
   if(pageToken)throw Error('Google Ads report exceeded its page limit; totals are unavailable.');
   const currency=rows[0]?.customer?.currencyCode||null,timeZone=rows[0]?.customer?.timeZone||'UTC';
   const today=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now());
   const from7=new Date(Date.parse(today+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
   const campaignDaily=rows.map(row=>({source:'google',campaignId:row.campaign?.id,campaign:row.campaign?.name||'Unnamed campaign',status:row.campaign?.status||'',date:row.segments?.date,spend:Number(row.metrics?.costMicros||0)/1e6,impressions:Number(row.metrics?.impressions||0),clicks:Number(row.metrics?.clicks||0),linkClicks:Number(row.metrics?.clicks||0),conversions:Number(row.metrics?.conversions||0)}));
   const d7={spend:0,impressions:0,clicks:0,linkClicks:0,conversions:0};
   for(const row of campaignDaily)if(row.date>=from7&&row.date<today)for(const key of Object.keys(d7))d7[key]+=row[key];
   return {connected:true,customer:config.customer,currency,timeZone,d7,campaignDaily,coverage:campaignDaily.length?'reported':'no_rows'};
  }catch{return {connected:false,why:'Google Ads reporting could not be loaded. Check the existing server connection.'};}
 };
}
// Direct Google campaign rows must remain visible even without a Windsor report.
export function directGoogleCampaigns(report){
 if(!report?.connected)return null;
 const campaignDaily=report.campaignDaily||[],days=[...new Set(campaignDaily.map(r=>r.date).filter(Boolean))].sort();
 const google=days.map(date=>{const rows=campaignDaily.filter(r=>r.date===date);const totals=Object.fromEntries(['spend','impressions','clicks','linkClicks'].map(key=>[key,rows.reduce((sum,r)=>sum+r[key],0)]));return {date,...totals,cpc:totals.linkClicks?totals.spend/totals.linkClicks:0};});
 return {connected:true,days,google,meta:null,campaigns:[],campaignDaily};
}
export function withDirectGoogle(combined,report){
 const direct=directGoogleCampaigns(report);if(!direct)return combined;
 if(!combined)return direct;
 if(combined.campaignDaily?.some(r=>/google/i.test(r.source)))return combined;
 const days=[...new Set([...(combined.days||[]),...direct.days])].sort();
 const align=series=>series?days.map(date=>series.find(row=>row.date===date)||{date,spend:0,impressions:0,clicks:0,linkClicks:0}):null;
 return {...combined,days,google:align(direct.google),meta:align(combined.meta),campaigns:(combined.campaigns||[]).filter(r=>!/google/i.test(r.source)),campaignDaily:[...(combined.campaignDaily||[]),...direct.campaignDaily]};
}
