// Owner-only SMS command center. Caller authorization is supplied by owner-crm
// or owner-conversation's verified binding, never a query or model-provided UID.
import {createHash,randomBytes} from 'node:crypto';
import {jsonStore,problem,clip} from './crm-store.mjs';
import {e164} from './maya-messages.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const path=uid=>'private/owner-sms-access/'+hash(uid)+'.json';
const HELP=`MAYA SMS controls:
THREAD Nick: stored texts both ways and call transcripts, with times and delivery status.
INBOX: contacts and latest activity.
ACTIONS or ACTIONS Nick: recorded texts, calls, booking/alert outcomes and owner requests.
FEATURES: requested functionality and completion state.
STATUS: service readiness and limits.
REPLY Nick: your exact message. Review, then SEND the code to send it.
MORE code page: continue a report. Copy the next command shown.
LEAD Nick: contact details.
Send the booking link to Nick: preview, then BOOK code.
Add/update a lead: preview, then YES code.
You can also talk normally, remember facts and change response/alert preferences.
THREAD, INBOX, ACTIONS, FEATURES, STATUS, REPLY, SEND, MORE, LEAD and MAYA HELP need no text AI. Normal chat and natural lead changes need available AI. HELP is carrier-reserved; use MAYA HELP.
Only retained records are available; missing/failed records are stated. SMS still needs carrier service and MAYA's server.`;
function pages(text){const out=[];let part='';for(const char of text){if(part.length+char.length>900){out.push(part);part='';}part+=char;}if(part)out.push(part);return out.length?out:['No recorded entries.'];}
const stamp=s=>String(s||'Time unavailable');
export function messageLines(thread,{actions=false}={}){
  return [...(thread.messages||[])].reverse().filter(m=>!actions||m.dir==='out'||m.kind==='call').map(m=>{
    const who=m.dir==='out'?(m.by||'Studio/MAYA'):(thread.name||thread.number);
    const header=`${stamp(m.ts)} | ${m.kind==='call'?'Call '+(m.dir==='out'?'to':'from'):'SMS '+(m.dir==='out'?'to':'from')} ${thread.name||thread.number} (${thread.number}) | ${who}`;
    if(m.kind==='call')return header+` | ${m.seconds||0}s | ${m.mode||'call'}\n`+(m.transcript?.length?m.transcript.map(t=>(t.who==='maya'?'MAYA':thread.name||'Caller')+': '+t.text).join('\n'):('No transcript recorded.'+(m.text?' Summary: '+m.text:'')));
    return header+(m.dir==='out'?` | ${m.status||'status unavailable'}${m.errorCode?' | carrier error '+m.errorCode:''}`:'')+'\n'+(m.text||'No message text recorded.');
  });
}
export function createOwnerSMSAccess(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now());
  async function resolve(query){
    const q=clip(query,180);if(!q)throw problem('Which contact? Use THREAD Nick or an exact phone number.');
    const list=await deps.threads.list(),normal=s=>String(s||'').trim().toLowerCase();
    const phone=e164(q),matches=list.filter(t=>/^\+\d{8,15}$/.test(phone)&&t.number===phone||normal(t.name)===normal(q));
    const first=matches.length?matches:list.filter(t=>normal(t.name).split(/\s+/)[0]===normal(q));
    if(first.length>1)throw problem('More than one contact matches. Use an exact number:\n'+first.map(t=>`${t.name}: ${t.number}`).join('\n').slice(0,1000),409);
    if(first.length===1)return {name:first[0].name||first[0].number,number:first[0].number};
    const result=await deps.find(q);
    if(!result?.ok)throw problem(result?.why||'No matching contact. Use INBOX, then an exact phone number.',409);
    const number=e164(result.lead.phone);if(!/^\+1\d{10}$/.test(number))throw problem('This contact has no complete US phone number.',409);
    return {name:clip(result.lead.name,120)||number,number,leadId:result.lead.id};
  }
  async function report(uid,title,lines){
    const code=randomBytes(4).toString('hex'),content=pages(title+'\n'+lines.join('\n\n'));
    await db.update(path(uid),s=>{s.reports||={};for(const [k,v] of Object.entries(s.reports))if(v.expires<now())delete s.reports[k];s.reports[code]={title,pages:content,expires:now()+86400000};});
    return readPage(uid,code,1);
  }
  async function readPage(uid,code,page){
    const s=(await db.get(path(uid))).value,r=s.reports?.[String(code).toLowerCase()];
    if(!r||r.expires<now())throw problem('Report expired or code does not match. Request THREAD, ACTIONS or INBOX again.',409);
    if(!Number.isInteger(page)||page<1||page>r.pages.length)throw problem(`Choose page 1 to ${r.pages.length}.`);
    return {ok:true,reply:`${r.title} | page ${page}/${r.pages.length} | snapshot\n${r.pages[page-1]}\n`+(page<r.pages.length?`Next: MORE ${code} ${page+1}`:'End of report. Request again for new activity.')};
  }
  async function preview(uid,query,text,id){
    if(typeof text!=='string'||!text.trim()||text.length>1200)throw problem('Use REPLY Nick: message, up to 1200 characters.');
    const c=await resolve(query);if(c.number===e164(deps.ownerNumber))throw problem('This command sends to clients; talk to MAYA normally to text yourself.');
    const contact=await deps.threads.get(c.number);if(contact?.blocked||contact?.consent==='stop')throw problem('This contact is blocked or opted out. No text will be sent.',409);
    const {result}=await db.update(path(uid),s=>{s.drafts||={};const cached=Object.values(s.drafts).find(p=>p.requestId===id);if(cached)return cached;const code=randomBytes(4).toString('hex'),draft={code,requestId:id,...c,text:text.trim(),status:'preview',expires:now()+600000};s.drafts[code]=draft;for(const [k,p] of Object.entries(s.drafts))if(p.expires<now()-86400000)delete s.drafts[k];return draft;});
    return {ok:true,reply:`Text preview for ${result.name} (${result.number}):\n${result.text}\nNothing sent. Reply SEND ${result.code} within 10 minutes to send this exact text.`};
  }
  async function send(uid,code){
    const {result:p}=await db.update(path(uid),s=>{const p=s.drafts?.[code];if(!p||p.expires<now())throw problem('Text preview expired or code does not match. Make a new REPLY preview.',409);if(p.status!=='preview')throw problem('This text was already attempted. Use THREAD '+p.number+' or ACTIONS before retrying.',409);p.status='attempted';return {...p};});
    let outcome;
    try{
      const c=p.leadId?{number:e164((await deps.leadById(p.leadId))?.phone)}:await resolve(p.number);if(c.number!==p.number)throw problem('Contact changed. Make a fresh preview.',409);
      const contact=await deps.threads.get(p.number);if(contact?.blocked||contact?.consent==='stop')throw problem('This contact is blocked or opted out.',409);
      const sent=await deps.sendClient(p.number,p.text);
      outcome={ok:!!sent?.ok,reply:sent?.ok?`Carrier accepted your text to ${p.name} (${p.number}). ${sent.warning||'Use THREAD '+p.number+' for recorded delivery status.'}`:sent?.why||'The carrier did not accept the text.',sid:sent?.sid};
    }catch(e){outcome={ok:false,reply:e.status?e.message:'Send result uncertain. Use THREAD '+p.number+' or ACTIONS. Do not resend automatically.'};}
    await db.update(path(uid),s=>{Object.assign(s.drafts[code],{status:outcome.ok?'accepted':'not_confirmed',outcome,at:new Date(now()).toISOString()});});
    return outcome;
  }
  async function act(uid,d,id){
    if(!uid)throw problem('Owner binding required.',403);
    if(d.action==='sms_help')return report(uid,'SMS help',[HELP]);
    if(d.action==='sms_more')return readPage(uid,clip(d.code,20),Number(d.page));
    if(d.action==='reply_client')return preview(uid,d.query,d.text,id);
    if(d.action==='sms_status')return {ok:true,reply:await deps.status(uid)};
    if(d.action==='client_contact'){const c=await resolve(d.query);return {ok:true,reply:c.name+': '+c.number};}
    if(d.action==='client_history'){
      const c=await resolve(d.query),t=await deps.threads.history(c.number);
      const lines=t?messageLines(t):[];return report(uid,`${c.name} (${c.number}) conversation (newest first)`,lines.length?lines:['No retained conversation recorded.']);
    }
    if(d.action==='sms_inbox'){
      const list=await deps.threads.list();return report(uid,'Messages inbox',list.map(t=>`${t.name||'Unnamed'}: ${t.number}\n${t.updatedAt||'No activity'} | unread ${t.unread||0} | ${t.blocked?'blocked':t.consent}\n${t.last?.text||'No recorded text'}`));
    }
    if(d.action==='sms_features')return report(uid,'Feature requests',await deps.features());
    if(d.action==='sms_actions'){
      let lines=[],contactNumber;
      if(d.query){const c=await resolve(d.query);contactNumber=c.number;const t=await deps.threads.history(c.number);lines=t?messageLines(t,{actions:true}):['No retained actions for this contact.'];}
      else{
        const histories=await deps.threads.histories(deps.ownerNumber);
        for(const t of histories)if(t.unavailable)lines.push('History unavailable for '+t.number+'. Try THREAD '+t.number+' again.');else lines.push(...messageLines(t,{actions:true}));
      }
      const s=(await db.get(path(uid))).value;
      lines.push(...Object.values(s.drafts||{}).filter(p=>!d.query||p.number===contactNumber).map(p=>`Owner reply to ${p.name} (${p.number}) | ${p.status}\n${p.outcome?.reply||(p.status==='preview'?'Preview only; nothing sent.':'Attempt recorded; result not confirmed. Do not resend automatically.')}`));
      if(!d.query)lines.push(...await deps.audit(uid));
      return report(uid,'Recorded actions',lines.length?lines:['No retained actions recorded.']);
    }
    return null;
  }
  function command(text){
    const t=text.trim();if(/^(?:MAYA\s+HELP|COMMANDS|WHAT CAN YOU DO)[?.!]*$/i.test(t))return {action:'sms_help'};
    if(/^INBOX[.!]?$/i.test(t))return {action:'sms_inbox'};
    if(/^STATUS[.!]?$/i.test(t))return {action:'sms_status'};
    if(/^FEATURES[.!]?$/i.test(t))return {action:'sms_features'};
    let m=t.match(/^MORE\s+([a-f0-9]{8})\s+(\d+)$/i);if(m)return {action:'sms_more',code:m[1],page:Number(m[2])};
    m=t.match(/^SEND\s+([a-f0-9]{8})$/i);if(m)return {action:'sms_send',code:m[1]};
    m=t.match(/^REPLY\s+(.+?):\s*([\s\S]+)$/i);if(m)return {action:'reply_client',query:m[1],text:m[2]};
    m=t.match(/^LEAD\s+(.+)$/i);if(m)return {action:'client_contact',query:m[1]};
    m=t.match(/^ACTIONS(?:\s+(.+))?$/i);if(m)return {action:'sms_actions',query:m[1]};
    m=t.match(/^(?:THREAD|CONVERSATION|HISTORY)\s+(.+?)[?]?$/i)||t.match(/^(?:where|what|when) did you text\s+(.+?)[?.!]*$/i);if(m)return {action:'client_history',query:m[1]};
    return null;
  }
  return {act,async direct(uid,text,id){const d=command(text);if(!uid)throw problem('Owner binding required.',403);return d?(d.action==='sms_send'?send(uid,d.code.toLowerCase()):act(uid,d,id)):null;}};
}
