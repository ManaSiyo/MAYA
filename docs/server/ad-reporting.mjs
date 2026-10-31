// Read-only Google Ads reporting. Uses only the owner's existing server config.
export function createGoogleAdsReader({config,fetchImpl=fetch,now=Date.now}){
 return async function googleAdsInsights(){
  const missing=['id','secret','refresh','customer'].filter(key=>!config?.[key]);
  if(missing.length)return {connected:false,code:'not_configured',missing,why:'Google Ads reporting is not configured.'};
  const signal=AbortSignal.timeout(18000);
  try{
   const tr=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.id,client_secret:config.secret,refresh_token:config.refresh,grant_type:'refresh_token'}),signal});
   if(!tr.ok)throw Error('Google Ads authorization could not be refreshed.');
   const token=await tr.json();if(!token.access_token)throw Error('Google Ads authorization is unavailable.');
   const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...(config.login?{'login-customer-id':config.login}:{})};
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

// Provider dates are calendar days in that account's timezone, including DST.
const dayInZone=(now,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const shiftDay=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const measures=['spend','impressions','clicks','linkClicks'];
const number=value=>{if(value==null||value==='')throw Error('invalid_metric');const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('invalid_metric');return n;};
const totals=rows=>Object.fromEntries(measures.map(key=>[key,rows.reduce((sum,row)=>sum+Number(row[key]||0),0)]));
const week=(rows,today)=>totals(rows.filter(r=>r.date>=shiftDay(today,-7)&&r.date<today));
const unavailable=(provider,code)=>({connected:false,code,why:code==='not_configured'?provider+' direct reporting is not configured.':code==='account_mismatch'?provider+' reporting account does not match the configured account.':provider+' direct reporting could not be loaded. Check the server connection.'});

// Credentials stay in Authorization. Never follow provider-supplied URLs/cursors as URLs.
async function readJson(fetchImpl,url,headers,signal){
 const r=await fetchImpl(url,{method:'GET',headers,signal,redirect:'error'});
 if(!r.ok)throw Error(r.status===401||r.status===403?'authorization':'provider_error');
 const data=await r.json();if(!data||data.error)throw Error('provider_error');return data;
}
async function openaiPages(fetchImpl,path,params,headers,signal){
 const rows=[];let after='';const seen=new Set();
 for(let page=0;page<10;page++){
  const q=new URLSearchParams(params);if(after)q.set('after',after);
  const data=await readJson(fetchImpl,'https://api.ads.openai.com/v1/'+path+'?'+q,headers,signal);
  if(!Array.isArray(data.data))throw Error('invalid_report');rows.push(...data.data);
  if(data.has_more===false)return rows;
  if(data.has_more!==true||!data.last_id||seen.has(data.last_id))throw Error('incomplete_report');
  after=data.last_id;seen.add(after);
 }
 throw Error('incomplete_report');
}

// Official Advertiser API, distinct from the model/Realtime API. Read-only.
export function createChatGPTAdsReader({config,fetchImpl=fetch,now=Date.now}){
 return async function chatgptAdsInsights(){
  if(!config?.apiKey||!config?.accountId)return unavailable('ChatGPT Ads','not_configured');
  const signal=AbortSignal.timeout(18000),headers={Authorization:'Bearer '+config.apiKey,Accept:'application/json'};
  try{
   const account=await readJson(fetchImpl,'https://api.ads.openai.com/v1/ad_account',headers,signal);
   if(account.id!==config.accountId)throw Error('account_mismatch');
   if(!account.timezone||!account.currency_code)throw Error('invalid_account');
   const today=dayInZone(now(),account.timezone),range=JSON.stringify({type:'date_range',since:shiftDay(today,-30),until:shiftDay(today,-1),timezone:account.timezone});
   const params=level=>{const q=new URLSearchParams({aggregation_level:level,time_granularity:'daily',limit:'2000',attribution_window_days:'30',view_through_attribution_window_days:'1',attribution_time_basis:'ad_event_time'});q.append('time_ranges[]',range);for(const key of [level+'.id',level+'.name',...(level==='campaign'?['campaign.status']:[]),'metadata.readable_time',level+'.impressions',level+'.clicks',level+'.spend',level+'.cpc'])q.append('fields[]',key);return q;};
   const [inventory,rows,daily]=await Promise.all([
    openaiPages(fetchImpl,'campaigns',{limit:'500'},headers,signal),
    openaiPages(fetchImpl,'ad_account/insights',params('campaign'),headers,signal),
    openaiPages(fetchImpl,'ad_account/insights',params('ad_account'),headers,signal),
   ]);
   const normalize=r=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(r.readable_time)||r.readable_time<shiftDay(today,-30)||r.readable_time>=today)throw Error('invalid_report');return {date:r.readable_time,spend:number(r.spend),impressions:number(r.impressions),clicks:number(r.clicks),linkClicks:number(r.clicks),cpc:r.cpc==null?null:number(r.cpc)};};
   const byId=new Map(inventory.map(c=>[c.id,c]));
   const campaignDaily=rows.map(r=>{if(!r.campaign_id)throw Error('invalid_report');const c=byId.get(r.campaign_id);return {source:'chatgpt',campaignId:r.campaign_id,campaign:c?.name||r.campaign_name||'Unnamed campaign',status:c?.status||r.campaign_status||'',...normalize(r)};});
   const series=daily.map(normalize);
   return {connected:true,account:account.id,currency:account.currency_code,timeZone:account.timezone,today,d7:week(series,today),series,campaignDaily,campaigns:inventory.map(c=>({source:'chatgpt',campaignId:c.id,campaign:c.name,status:c.status,...totals([])}))};
  }catch(e){return unavailable('ChatGPT Ads',e.message);}
 };
}

async function metaPages(fetchImpl,base,path,params,headers,signal){
 const rows=[];let after='';const seen=new Set();
 for(let page=0;page<10;page++){
  const q=new URLSearchParams(params);if(after)q.set('after',after);
  const data=await readJson(fetchImpl,base+path+'?'+q,headers,signal);
  if(!Array.isArray(data.data))throw Error('invalid_report');rows.push(...data.data);
  if(!data.paging?.next)return rows;
  after=data.paging?.cursors?.after;if(!after||seen.has(after))throw Error('incomplete_report');seen.add(after);
 }
 throw Error('incomplete_report');
}
export function createMetaAdsReader({config,fetchImpl=fetch,now=Date.now}){
 return async function metaInsights(){
  if(!config?.token||!config?.account)return unavailable('Meta','not_configured');
  const signal=AbortSignal.timeout(18000),headers={Authorization:'Bearer '+config.token};
  const base='https://graph.facebook.com/v21.0/act_'+encodeURIComponent(config.account);
  try{
   const account=await readJson(fetchImpl,base+'?fields=account_id,currency,timezone_name',headers,signal);
   if(String(account.account_id)!==String(config.account))throw Error('account_mismatch');
   if(!account.timezone_name||!account.currency)throw Error('invalid_account');
   const today=dayInZone(now(),account.timezone_name);
   const params=(days,extra={})=>({time_range:JSON.stringify({since:shiftDay(today,-days),until:shiftDay(today,-1)}),fields:'spend,impressions,clicks,inline_link_clicks,reach,frequency',limit:'500',...extra});
   const [w,m,rows,campaigns]=await Promise.all([
    metaPages(fetchImpl,base,'/insights',params(7),headers,signal),
    metaPages(fetchImpl,base,'/insights',params(30),headers,signal),
    metaPages(fetchImpl,base,'/insights',params(30,{level:'campaign',time_increment:'1',fields:'campaign_id,campaign_name,date_start,spend,impressions,clicks,inline_link_clicks'}),headers,signal),
    metaPages(fetchImpl,base,'/campaigns',{fields:'id,name,effective_status',limit:'500'},headers,signal),
   ]);
   const normalize=r=>({spend:number(r.spend||0),impressions:number(r.impressions||0),clicks:number(r.clicks||0),linkClicks:number(r.inline_link_clicks||0)});
   const byId=new Map(campaigns.map(c=>[c.id,c]));
   const campaignDaily=rows.map(r=>{if(!r.campaign_id||!/^\d{4}-\d{2}-\d{2}$/.test(r.date_start))throw Error('invalid_report');return {source:'meta',campaignId:r.campaign_id,campaign:r.campaign_name,status:byId.get(r.campaign_id)?.effective_status||'',date:r.date_start,...normalize(r)};});
   // Reach/frequency come from provider aggregates, never a daily sum.
   const aggregate=rows=>({...normalize(rows[0]||{}),reach:number(rows[0]?.reach||0),frequency:number(rows[0]?.frequency||0)});
   return {connected:true,account:config.account,currency:account.currency,timeZone:account.timezone_name,today,d7:aggregate(w),d30:aggregate(m),campaignDaily,campaigns:campaigns.map(c=>({source:'meta',campaignId:c.id,campaign:c.name,status:c.effective_status,...totals([])}))};
  }catch(e){return unavailable('Meta',e.message);}
 };
}

// A refresh and voice snapshot share in-flight reads and a short server-only cache.
export function cachedAdReader(read,{now=Date.now}={}){
 let pending=null,value=null,until=0;
 return ()=>{if(value&&now()<until)return Promise.resolve(value);if(pending)return pending;
  pending=Promise.resolve().then(read).then(result=>{value=result;until=now()+(result.connected?60000:10000);return result;}).finally(()=>{pending=null;});return pending;};
}

export function combineDirectAds(reports,{now=Date.now(),timeZone='America/Los_Angeles'}={}){
 const today=dayInZone(now,timeZone),days=Array.from({length:30},(_,i)=>shiftDay(today,i-30));
 const out={connected:false,currency:'USD',today,timeZone,days,campaigns:[],campaignDaily:[],sources:{},excludedSources:[]};
 for(const [key,report] of Object.entries(reports)){
  out[key]=null;if(!report?.connected)continue;
  // The existing dollar dashboard cannot add different currencies or invent FX.
  if(report.currency!=='USD'){out.excludedSources.push(key);continue;}
  out.connected=true;
  const rows=report.campaignDaily||[],series=report.series;
  const daily=Object.fromEntries(days.map(date=>{const rs=rows.filter(r=>r.date===date),v=series?.find(r=>r.date===date)||totals(rs);return [date,{date,...v,cpc:series?(v.cpc??null):(v.linkClicks?v.spend/v.linkClicks:0)}];}));
  out[key]=Object.values(daily);
  const source=key==='google'?'google_ads':key==='meta'?'facebook':'chatgpt';
  out.sources[source]={...(report.d7||{}),daily};
  out.campaignDaily.push(...rows);
  const summary=new Map((report.campaigns||[]).map(c=>[c.campaignId,{...c,...totals([])}]));
  const since=shiftDay(report.today||today,-7);
  for(const row of rows){let c=summary.get(row.campaignId);if(!c){c={source:key,campaignId:row.campaignId,campaign:row.campaign,status:row.status,...totals([])};summary.set(row.campaignId,c);}if(row.date>=since&&row.date<(report.today||today)){for(const k of measures)c[k]+=Number(row[k]||0);if(row.impressions&&(!c.lastDate||row.date>c.lastDate))c.lastDate=row.date;}}
  out.campaigns.push(...summary.values());
 }
 return out;
}
