// Owner alerts for new client Call back submissions. The Wix form remains the
// source of truth; a durable claim prevents scheduler retries from ringing twice.
import {jsonStore} from './crm-store.mjs';

export const LEAD_ALERTS_PATH='private/lead-alerts/callbacks.json';
export function createLeadAlerts(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now());
  const retryMs=15*60000;
  async function run(){
    const feed=await deps.fetchLeads();
    if(!feed?.connected)throw new Error('Wix Call back submissions are unavailable.');
    const recent=(feed.list||[]).filter(l=>l.id&&l.source==='wix'&&
      Number.isFinite(Date.parse(l.ts))&&now()-Date.parse(l.ts)>=0&&now()-Date.parse(l.ts)<72*3600000);
    const result={checked:recent.length,texts:0,calls:0,failed:[]};
    for(const lead of recent.reverse()){
      const id=String(lead.id),name=String(lead.name||'New client').slice(0,120);
      const summary=String(lead.note||lead.wrote||'').replace(/\s+/g,' ').slice(0,180);
      const message='New Call back request: '+name+(summary?'. '+summary:'')+'. Open the Lead Station for details.';
      for(const [channel,send,payload] of [
        ['text',deps.textOwner,message],
        ['call',deps.callOwner,'New Call back request from '+name+(summary?'. They wrote: '+summary:'')+'. Tell Fromsa the lead is in the Lead Station.'],
      ]){
        const claim=await db.update(LEAD_ALERTS_PATH,s=>{
          s.items||={};s.items[id]||={at:new Date(now()).toISOString(),name};
          const item=s.items[id],attempts=item[channel+'Attempts']||0;
          // Only definite provider refusals can retry. A timeout may have
          // reached Twilio, so an uncertain result must not ring twice.
          if(item[channel]&&!(item[channel]==='failed'&&attempts<3&&now()-(item[channel+'At']||0)>=retryMs))return false;
          item[channel]='claimed';item[channel+'Attempts']=attempts+1;item[channel+'At']=now();
          for(const [key,old] of Object.entries(s.items))if(Date.parse(old.at)<now()-400*86400000)delete s.items[key];
          return true;
        });
        if(!claim.result)continue;
        try{
          const outcome=await send(payload);
          const uncertain=!outcome?.ok&&/^Twilio did not answer/i.test(String(outcome?.why||''));
          await db.update(LEAD_ALERTS_PATH,s=>{s.items[id][channel]=outcome?.ok?'accepted':uncertain?'uncertain':'failed';});
          if(outcome?.ok)result[channel==='text'?'texts':'calls']++;
          else result.failed.push({id,channel,why:outcome?.why||'not accepted'});
        }catch{
          await db.update(LEAD_ALERTS_PATH,s=>{s.items[id][channel]='uncertain';});
          result.failed.push({id,channel,why:'result uncertain'});
        }
      }
    }
    return result;
  }
  return {run};
}
