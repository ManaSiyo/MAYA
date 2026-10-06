// Owner-only callback alerts. Durable channel claims prevent duplicate sends;
// scheduled work is independent of Outbound, Gmail, AI and browser activity.
import {formatSignupAlert} from './owner-conversation.mjs';
import {jsonStore,problem} from './crm-store.mjs';

export const LEAD_ALERTS_PATH='private/lead-alerts/callbacks.json';
export const LEAD_ALERT_HEALTH_PATH='private/lead-alerts/health.json';
const recentLeads=(feed,now)=>(feed.list||[]).filter(l=>l.id&&l.source==='wix'&&Number.isFinite(Date.parse(l.ts))&&now-Date.parse(l.ts)>=0&&now-Date.parse(l.ts)<72*3600000).sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts));
export function createLeadAlerts(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now()),retryMs=15*60000;
  async function status(){
    const [{value:health},{value:ledger},feed]=await Promise.all([db.get(LEAD_ALERT_HEALTH_PATH),db.get(LEAD_ALERTS_PATH),deps.fetchLeads()]);
    const recent=feed?.connected?recentLeads(feed,now()):[];
    return {health,feed:{connected:!!feed?.connected,error:feed?.connected?'':String(feed?.why||'Callback submissions unavailable.').slice(0,200),recent:recent.length,latest:recent[0]?{id:recent[0].id,name:recent[0].name,ts:recent[0].ts}:null},
      items:recent.map(l=>({id:l.id,name:l.name,ts:l.ts,...ledger.items?.[l.id]})),
      pending:recent.filter(l=>!ledger.items?.[l.id]?.text||!ledger.items?.[l.id]?.call).length};
  }
  async function run({source='manual'}={}){
    const startedAt=new Date(now()).toISOString();
    await db.update(LEAD_ALERT_HEALTH_PATH,s=>{s.lastStartedAt=startedAt;s.lastSource=source;});
    try{
      const feed=await deps.fetchLeads();
      if(!feed?.connected)throw new Error('Wix Call back submissions are unavailable.');
      const recent=recentLeads(feed,now()),result={checked:recent.length,texts:0,calls:0,failed:[]};
      for(const lead of [...recent].reverse()){
        const id=String(lead.id),name=String(lead.name||'New client').slice(0,120);
        const summary=String(lead.wrote||lead.note||'').replace(/\s+/g,' ').slice(0,180);
        // A preference-storage failure must not suppress the independent call.
        let message=formatSignupAlert(lead);
        try{if(deps.formatText)message=await deps.formatText(lead);}catch{/* Grounded deterministic fallback. */}
        for(const [channel,send,payload] of [
          ['text',deps.textOwner,message],
          ['call',deps.callOwner,'New Call back request from '+name+(summary?'. They wrote: '+summary:'')+'. Tell Fromsa the lead is in Leads.'],
        ]){
          let claimed=false;
          try{
            const claim=await db.update(LEAD_ALERTS_PATH,s=>{
              s.items||={};s.items[id]||={at:new Date(now()).toISOString(),name};
              const item=s.items[id],attempts=item[channel+'Attempts']||0;
              // Only definite refusals retry. Claimed/uncertain sends require
              // provider reconciliation, never a second automatic ring/text.
              if(item[channel]&&!(item[channel]==='failed'&&attempts<3&&now()-(item[channel+'At']||0)>=retryMs))return false;
              item[channel]='claimed';item[channel+'Attempts']=attempts+1;item[channel+'At']=now();
              for(const [key,old] of Object.entries(s.items))if(Date.parse(old.at)<now()-400*86400000)delete s.items[key];
              return true;
            });
            if(!claim.result){
              const item=claim.value.items[id];
              if(item[channel]!=='accepted')result.failed.push({id,channel,why:item[channel+'Error']||('Previous '+item[channel]+' attempt needs review before retrying.')});
              continue;
            }
            claimed=true;
            let outcome;
            try{outcome=await send(payload);}catch{outcome={ok:false,uncertain:true,why:'Provider result uncertain; check delivery before retrying.'};}
            const uncertain=!outcome?.ok&&(outcome?.uncertain||/^Twilio did not answer/i.test(String(outcome?.why||'')));
            await db.update(LEAD_ALERTS_PATH,s=>{
              const item=s.items[id];item[channel]=outcome?.ok?'accepted':uncertain?'uncertain':'failed';
              item[channel+'Sid']=String(outcome?.sid||'').slice(0,100);
              item[channel+'Status']=String(outcome?.status||(outcome?.ok?'accepted':'' )).slice(0,80);
              item[channel+'Error']=String(outcome?.why||'').slice(0,300);
              item[channel+'RecordingError']=String(outcome?.recordingError||'').slice(0,200);
            });
            if(outcome?.ok)result[channel==='text'?'texts':'calls']++;
            else result.failed.push({id,channel,why:outcome?.why||'not accepted'});
            if(outcome?.recordingError)result.failed.push({id,channel,why:outcome.recordingError});
          }catch{
            result.failed.push({id,channel,why:claimed?'Alert outcome could not be saved; do not resend before checking the provider.':'Alert claim could not be saved; no send attempted.'});
          }
        }
      }
      await db.update(LEAD_ALERT_HEALTH_PATH,s=>{if(s.lastStartedAt!==startedAt)return;s.lastFinishedAt=new Date(now()).toISOString();s.lastResult=result;s.lastError='';if(!result.failed.length)s.lastSuccessAt=s.lastFinishedAt;if(source==='scheduled')s.lastScheduledAt=s.lastFinishedAt;});
      return result;
    }catch(error){
      await db.update(LEAD_ALERT_HEALTH_PATH,s=>{if(s.lastStartedAt===startedAt){s.lastFinishedAt=new Date(now()).toISOString();s.lastError=String(error.message||'Alert check failed.').slice(0,300);}});
      throw error;
    }
  }
  return {run,status};
}

// Separate Scheduler route: no CRM account ID or enabled Outbound workspace.
export function mountLeadAlertRoutes(app,deps){
  const alerts=()=>{const service=deps.getAlerts();if(!service)throw problem('Callback notification service is unavailable.',503);return service;};
  app.get('/api/admin/lead-alerts/status',deps.requireAuthHeader,async(req,res)=>{
    try{await deps.requireOwner(req);res.set('Cache-Control','no-store').json({ok:true,...await alerts().status(),readiness:deps.readiness()});}
    catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:'Callback notification status is unavailable.'});}
  });
  app.post('/api/tasks/lead-alerts',async(req,res)=>{
    try{await deps.verifyScheduler(req);const result=await alerts().run({source:'scheduled'});res.set('Cache-Control','no-store').status(result.failed.length?503:200).json({ok:!result.failed.length,...result});}
    catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:'Callback notification check failed.'});}
  });
}
