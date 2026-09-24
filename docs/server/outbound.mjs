import {randomUUID} from 'node:crypto';
const text = (v,n=500) => String(v ?? '').trim().slice(0,n);
const fail = (message,status=400) => Object.assign(new Error(message),{status});
export const STAGES = ['new','ready','contacted','replied','meeting','closed','suppressed'];
export function domain(value) {
  const raw=text(value,250).toLowerCase().replace(/^https?:\/\//,'').split('/')[0];
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw)) throw fail('Enter a company domain, such as example.com.');
  return raw;
}
export function contact(input) {
  const email=text(input.email,254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Invalid email address.');
  const name=text(input.name,120), company=text(input.company,160);
  if (!name && !company && !email) throw fail('A contact needs a name, company or email.');
  return {id:randomUUID(),name,company,email,domain:input.domain?domain(input.domain):email?email.split('@')[1]:'',title:text(input.title,180),notes:text(input.notes,4000),source:text(input.source,180)||'Manual',verification:'unverified',stage:'new',subject:'',body:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function rowsToContacts(rows) {
  if (!Array.isArray(rows)||rows.length>1001) throw fail('Import up to 1,000 rows at a time.');
  const normalize=h=>text(h).toLowerCase().replace(/[^a-z]/g,'');
  const columns={name:['name','fullname','contactname','contact'],email:['email','emailaddress','workemail'],company:['company','companyname','organization'],domain:['domain','website','companydomain'],title:['title','jobtitle','position','role'],notes:['notes','note','description'],subject:['subject','emailsubjectthread']};
  // Summary rows may precede the actual contact table. Never import a strategy tab.
  const start=rows.slice(0,10).findIndex(row=>Array.isArray(row)&&row.map(normalize).some(h=>columns.email.includes(h)));
  if(start<0)throw fail('Choose a contacts tab with an Email header, not a strategy or summary tab.');
  const headers=rows[start].map(normalize);
  return rows.slice(start+1).flatMap((row,index)=>{
    if(!Array.isArray(row))throw fail(`Row ${start+index+2}: Invalid row.`);
    const obj={source:'Sheet import'}, extra=[];
    for(const [key,aliases] of Object.entries(columns)){const i=headers.findIndex(h=>aliases.includes(h));if(i>=0)obj[key]=row[i];}
    if(![obj.name,obj.company,obj.email].some(v=>text(v)))return [];
    for(let i=0;i<headers.length;i++)if(text(row[i])&&!Object.values(columns).flat().includes(headers[i]))extra.push(text(rows[start][i])+': '+text(row[i],2000));
    // Truncated addresses in historical sheets are evidence, not sendable emails.
    if(/\.\.\.|…/.test(text(obj.email))){extra.push('Original email (incomplete): '+text(obj.email));obj.email='';}
    const notes=[text(obj.notes,4000),...extra].filter(Boolean).join('\n');
    if(notes.length>4000)throw fail(`Row ${start+index+2}: Notes exceed 4,000 characters; shorten before importing.`);
    try{
      const result=contact({...obj,notes});result.subject=text(obj.subject,500);
      const status=text(row[headers.indexOf('status')]).toLowerCase();
      if(/bounced|unsubscribed|do not contact/.test(status))result.stage='suppressed';
      else if(!/not sent|unsent/.test(status)&&/\bsent\b|\btouch\b/.test(status))result.stage='contacted';
      return [result];
    }catch(e){throw fail(`Row ${start+index+2}: ${e.message}`);}
  });
}
export function mergeContacts(state, incoming, campaignId) {
  if (!state.campaigns.some(c=>c.id===campaignId)) throw fail('Choose a campaign first.');
  let added=0;
  for(const c of incoming){
    const existing=state.contacts.find(x=>x.campaignId===campaignId && (c.email?x.email===c.email:x.domain===c.domain&&x.name===c.name));
    // A fresh suppression signal must also update already-imported records.
    if(c.email&&c.stage==='suppressed')for(const other of state.contacts)if(other.email===c.email)other.stage='suppressed';
    if(existing){
      if(c.sheetData){for(const field of ['name','company','title','notes','subject'])if(existing.sheetData&&existing[field]===existing.sheetData[field])existing[field]=c[field];existing.sheetData=c.sheetData;}
      continue;
    }
    if(state.contacts.length>=5000)throw fail('Workspace limit is 5,000 contacts. Export before importing more.');
    const suppressed=c.email&&state.contacts.some(x=>x.email===c.email&&x.stage==='suppressed');
    state.contacts.push({...c,campaignId,stage:suppressed?'suppressed':c.stage});added++;
  }
  return added;
}
export function mountOutbound(app,deps) {
  const empty=()=>({campaigns:[],contacts:[],companies:[],settings:{sheetId:'',tab:'',business:'Mana Siyo, a bespoke fashion studio in San Francisco.'}});
  const key=uid=>'maya/outbound/'+encodeURIComponent(uid)+'.json';
  async function load(uid){const o=await deps.read(key(uid));if(!o.ok){if(o.status===404)return {state:empty(),generation:'0'};throw fail('Outbound storage is unavailable.',503);}if(!o.generation)throw fail('Storage revision unavailable. Retry later.',503);const state=JSON.parse(o.buf.toString());return {state,generation:o.generation};}
  async function change(uid,fn){for(let i=0;i<4;i++){const {state,generation}=await load(uid);const result=fn(state);try{await deps.write(key(uid),Buffer.from(JSON.stringify(state)),'application/json',generation);return {state,result};}catch(e){if(e.status!==412)throw e;}}throw fail('Another update is in progress. Reload and try again.',409);}
  const handler=fn=>async(req,res)=>{let user;try{user=await deps.requireAdmin(req);}catch(e){return res.status(e.status||401).json({ok:false,error:'Sign in with an admin account.'});}try{if(!user.sub)throw fail('Sign in again.',401);res.set('Cache-Control','no-store');if(req.method!=='GET'&&!deps.allow(user))throw fail('Please wait before trying again.',429);await fn(req,res,user);}catch(e){res.status(e.status||502).json({ok:false,error:e.status?e.message:'Outbound could not complete the request. Please retry.'});}};
  const api='/api/admin/outbound';
  app.get(api,handler(async(req,res,user)=>{const {state}=await load(user.sub);res.json({ok:true,state,capabilities:{hunter:!!deps.hunterKey,ai:!!deps.aiReady,sheets:true,sending:false}});}));
  app.post(api+'/save',handler(async(req,res,user)=>{
    const b=req.body||{};
    const result=await change(user.sub,state=>{
      if(b.type==='settings'){
        const sheetId=text(b.sheetId,180).match(/(?:\/d\/)?([A-Za-z0-9_-]{20,})(?:\/|$)/)?.[1]||'';
        if(b.sheetId&&!sheetId)throw fail('Enter a valid Google Sheet URL or ID.');
        state.settings={sheetId,tab:text(b.tab,100),business:text(b.business,3000)};
      }else if(b.type==='campaign'){
        const name=text(b.name,120);if(!name)throw fail('Name the campaign.');
        let campaign=b.id?state.campaigns.find(c=>c.id===b.id):null;
        if(b.id&&!campaign)throw fail('Campaign not found.',404);
        if(!campaign){if(state.campaigns.length>=100)throw fail('Campaign limit reached.');campaign={id:randomUUID(),createdAt:new Date().toISOString()};state.campaigns.push(campaign);}
        Object.assign(campaign,{name,objective:text(b.objective,2000),audience:text(b.audience,1000),pain:text(b.pain,2000),criteria:text(b.criteria,3000),competitors:text(b.competitors,12000),status:b.status==='paused'?'paused':'active'});
      }else if(b.type==='contact'){
        const c=state.contacts.find(x=>x.id===b.id);if(!c)throw fail('Contact not found.',404);
        if(b.stage!==undefined){if(!STAGES.includes(b.stage))throw fail('Invalid stage.');c.stage=b.stage;if(b.stage==='suppressed'&&c.email)for(const other of state.contacts)if(other.email===c.email)other.stage='suppressed';}
        for(const field of ['notes','subject','body'])if(b[field]!==undefined)c[field]=text(b[field],field==='body'?12000:4000);
        c.updatedAt=new Date().toISOString();
      }else if(b.type==='import'){
        const incoming=b.rows?rowsToContacts(b.rows):[contact(b.contact||{})];
        return mergeContacts(state,incoming,b.campaignId);
      }else throw fail('Unknown update.');
    });res.json({ok:true,...result});
  }));
  const hunter=async(path,params,body)=>{
    if(!deps.hunterKey)throw fail('Hunter is not connected. Configure HUNTER_API_KEY on the server.',503);
    const url=new URL('https://api.hunter.io/v2/'+path);url.searchParams.set('api_key',deps.hunterKey);
    for(const[k,v]of Object.entries(params||{}))url.searchParams.set(k,String(v));
    const r=await deps.fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
    const j=await r.json();if(!r.ok)throw fail('Hunter request failed ('+r.status+'). Check access or remaining credits.',502);return j;
  };
  app.post(api+'/hunter',handler(async(req,res,user)=>{
    const b=req.body||{}, {state}=await load(user.sub);
    const campaign=state.campaigns.find(c=>c.id===b.campaignId);if(!campaign)throw fail('Choose a campaign.');
    if(b.action==='discover'){
      const query=text(b.query,500);if(!query)throw fail('Describe the companies to find.');
      const j=await hunter('discover',{}, {query,limit:25,offset:Math.max(0,Math.min(1000,Number(b.offset)||0))});
      const companies=(Array.isArray(j.data)?j.data:j.data?.companies||[]).map(c=>({id:randomUUID(),campaignId:campaign.id,name:text(c.organization||c.name,160),domain:domain(c.domain),description:text(c.description,1500),source:'Hunter Discover'}));
      const result=await change(user.sub,s=>{for(const c of companies)if(s.companies.length<2000&&!s.companies.some(x=>x.domain===c.domain&&x.campaignId===c.campaignId))s.companies.push(c);});
      return res.json({ok:true,...result,found:companies.length});
    }
    if(b.confirm!==true)throw fail('Confirm this Hunter lookup before spending credits.');
    if(b.action==='domain'){
      const d=domain(b.domain);const j=await hunter('domain-search',{domain:d,limit:25,offset:Math.max(0,Math.min(1000,Number(b.offset)||0))});
      const incoming=(j.data?.emails||[]).map(e=>({...contact({name:[e.first_name,e.last_name].filter(Boolean).join(' '),email:e.value,domain:d,company:j.data.organization||d,title:e.position,source:'Hunter'}),verification:text(e.verification?.status,60)||'unverified'}));
      const result=await change(user.sub,s=>mergeContacts(s,incoming,campaign.id));return res.json({ok:true,...result,total:j.meta?.results||incoming.length});
    }
    const current=state.contacts.find(c=>c.id===b.id&&c.campaignId===campaign.id);if(!current)throw fail('Contact not found.',404);
    if(current.stage==='suppressed')throw fail('This contact is suppressed.');
    let patch;
    if(b.action==='find'){
      if(!current.name||!current.domain)throw fail('Add a name and company domain first.');
      const j=await hunter('email-finder',{domain:current.domain,full_name:current.name});
      if(!j.data?.email)throw fail('Hunter found no email.',404);
      patch={email:contact({...current,email:j.data.email}).email,verification:text(j.data.verification?.status)||'unverified'};
    }else if(b.action==='verify'){
      if(!current.email)throw fail('No email to verify.');const j=await hunter('email-verifier',{email:current.email});patch={verification:text(j.data?.status)||'unknown'};
    }else throw fail('Unknown Hunter action.');
    const result=await change(user.sub,s=>{const c=s.contacts.find(x=>x.id===current.id);if(!c||c.stage==='suppressed')throw fail('Contact changed. Reload.',409);Object.assign(c,patch,{updatedAt:new Date().toISOString()});});res.json({ok:true,...result});
  }));
  app.post(api+'/sheets/sync',handler(async(req,res,user)=>{
    const {state}=await load(user.sub),sheetId=state.settings.sheetId;
    if(!sheetId)throw fail('Save your workbook URL in Connections first.');
    const tabs=await deps.sheetTabs(sheetId);
    const campaignTabs=tabs.filter(t=>/^9\/23 (Ceremonial|Corporates|Fashion Houses)$/.test(t));
    if(!campaignTabs.length)throw fail('No 9/23 campaign tabs found in this workbook.');
    // Read and validate every source before changing storage. A failed tab cannot
    // leave an apparently successful partial import.
    const imports=[];
    for(const tab of campaignTabs){const rows=await deps.sheetRows(sheetId,"'"+tab.replace(/'/g,"''")+"'!A1:AA1001");imports.push({tab,contacts:rowsToContacts(rows)});}
    const result=await change(user.sub,s=>{
      if(s.settings.sheetId!==sheetId)throw fail('Workbook changed while syncing. Try again.',409);
      const report=[];
      for(const entry of imports){
        let c=s.campaigns.find(c=>c.sheetId===sheetId&&c.sheetTab===entry.tab);
        if(!c){if(s.campaigns.length>=100)throw fail('Campaign limit reached.');c={id:randomUUID(),name:entry.tab,status:'active',sheetId,sheetTab:entry.tab,createdAt:new Date().toISOString()};s.campaigns.push(c);}
        const added=mergeContacts(s,entry.contacts.map(c=>({...c,source:entry.tab,sheetData:{name:c.name,company:c.company,title:c.title,notes:c.notes,subject:c.subject}})),c.id);
        c.syncedAt=new Date().toISOString();
        report.push({tab:entry.tab,read:entry.contacts.length,added,total:s.contacts.filter(p=>p.campaignId===c.id).length});
      }
      s.settings.lastSyncedAt=new Date().toISOString();return report;
    });res.json({ok:true,...result});
  }));
  app.post(api+'/sheets',handler(async(req,res,user)=>{
    const b=req.body||{}, {state}=await load(user.sub),settings=state.settings;
    if(!settings.sheetId||!settings.tab)throw fail('Save the sheet URL and tab in Connections first.');
    const range="'"+settings.tab.replace(/'/g,"''")+"'!A1:Z1001";
    const rows=await deps.sheetRows(settings.sheetId,range);
    const incoming=rowsToContacts(rows);
    const result=await change(user.sub,s=>mergeContacts(s,incoming,b.campaignId));res.json({ok:true,...result});
  }));
  app.post(api+'/research',handler(async(req,res,user)=>{
    if(req.body?.confirm!==true)throw fail('Confirm research first.');
    const {state}=await load(user.sub), campaign=state.campaigns.find(c=>c.id===req.body.campaignId);
    if(!campaign)throw fail('Choose a campaign.');
    const research=await deps.research({business:state.settings.business,campaign});
    res.json({ok:true,research});
  }));
  app.post(api+'/draft',handler(async(req,res,user)=>{
    const b=req.body||{};if(b.confirm!==true)throw fail('Confirm generation first.');
    const {state}=await load(user.sub);const c=state.contacts.find(x=>x.id===b.id);if(!c)throw fail('Contact not found.',404);
    if(c.stage==='suppressed')throw fail('This contact is suppressed.');
    const campaign=state.campaigns.find(x=>x.id===c.campaignId);
    if(campaign?.status==='paused')throw fail('Resume this campaign before drafting.');
    const draft=await deps.draft({business:state.settings.business,campaign,contact:c});
    if(!draft?.subject||!draft?.body)throw fail('Maya returned an incomplete draft.',502);
    // Return a reviewable draft; saving is explicit and cannot overwrite concurrent edits.
    res.json({ok:true,draft:{subject:text(draft.subject,200),body:text(draft.body,12000)},model:deps.model});
  }));
}
