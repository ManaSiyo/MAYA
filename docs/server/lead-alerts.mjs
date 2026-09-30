// Owner alerts for new client Call back submissions. The Wix form remains the
// source of truth; a durable claim prevents scheduler retries from ringing twice.
import {jsonStore} from './crm-store.mjs';

export const LEAD_ALERTS_PATH='private/lead-alerts/callbacks.json';
export function createLeadAlerts(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now());
  async function run(){
    const feed=await deps.fetchLeads();
    if(!feed?.connected)throw new Error('Wix Call back submissions are unavailable.');
    const recent=(feed.list||[]).filter(l=>l.id&&l.source==='wix'&&
      Number.isFinite(Date.parse(l.ts))&&now()-Date.parse(l.ts)>=0&&now()-Date.parse(l.ts)<72*3600000);
    const result={checked:recent.length,texts:0,calls:0,failed:[]};
    for(const lead of recent.reverse()){
      const id=String(lead.id),name=String(lead.name||'New client').slice(0,120);
      const claim=await db.update(LEAD_ALERTS_PATH,s=>{
        s.items||={};
        if(s.items[id])return false;
        s.items[id]={at:new Date(now()).toISOString(),name,text:'claimed',call:'claimed'};
        // Keep bounded state without forgetting current submissions.
        for(const [key,item] of Object.entries(s.items))if(Date.parse(item.at)<now()-400*86400000)delete s.items[key];
        return true;
      });
      if(!claim.result)continue;
      const summary=String(lead.note||lead.wrote||'').replace(/\s+/g,' ').slice(0,180);
      const message='New Call back request: '+name+(summary?' — '+summary:'')+'. Open the Lead Station for details.';
      try{
        const sent=await deps.textOwner(message);
        await db.update(LEAD_ALERTS_PATH,s=>{s.items[id].text=sent?.ok?'accepted':'failed';});
        if(sent?.ok)result.texts++;else result.failed.push({id,channel:'text',why:sent?.why||'not accepted'});
      }catch(e){await db.update(LEAD_ALERTS_PATH,s=>{s.items[id].text='uncertain';});result.failed.push({id,channel:'text',why:'result uncertain'});}
      try{
        const called=await deps.callOwner('New Call back request from '+name+(summary?'. They wrote: '+summary:'')+'. Tell Fromsa the lead is in the Lead Station.');
        await db.update(LEAD_ALERTS_PATH,s=>{s.items[id].call=called?.ok?'accepted':'failed';});
        if(called?.ok)result.calls++;else result.failed.push({id,channel:'call',why:called?.why||'not accepted'});
      }catch(e){await db.update(LEAD_ALERTS_PATH,s=>{s.items[id].call='uncertain';});result.failed.push({id,channel:'call',why:'result uncertain'});}
    }
    return result;
  }
  return {run};
}
