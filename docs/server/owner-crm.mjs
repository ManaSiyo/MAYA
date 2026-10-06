// Owner-only conversations and CRM proposals. Phone identity comes from a signed Twilio webhook,
// never the message text. A separate confirmation commits the proposed change.
import {createHash,randomBytes} from 'node:crypto';
import {jsonStore,problem,clip} from './crm-store.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const number=s=>String(s||'').replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
export function gmailCandidates(events,existing=[]){
 const byEmail=new Map(existing.map(x=>[x.email,x]));
 for(const e of events){
  if(e.direction!=='in'||e.automated)continue;
  for(const email of e.peers||[]){
   if(/(?:no[._-]?reply|mailer-daemon|notifications?)@/i.test(email))continue;
   const candidate={id:hash(email).slice(0,24),email,subject:clip(e.subject,300),note:clip(e.summary,800),ts:e.ts};
   if(!byEmail.has(email)||String(byEmail.get(email).ts)<String(e.ts))byEmail.set(email,candidate);
  }
 }
 return [...byEmail.values()].sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,100);
}
export const OWNER_BINDING='private/owner-crm/binding.json';
export function cleanCommand(value){
  if(!value||!['add','update'].includes(value.action))throw problem('Tell me whether to add a lead or update an existing lead.');
  const c={action:value.action};
  for(const [k,n] of Object.entries({query:180,name:120,phone:60,email:180,note:2000,tier:80,stage:30}))if(typeof value[k]==='string'&&value[k].trim())c[k]=clip(value[k],n);
  if(c.phone){const d=number(c.phone);if(!/^\d{10}$/.test(d))throw problem('Please include a complete 10-digit phone number.');c.phone='+1'+d;}
  if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))throw problem('Please check the email address.');
  if(c.stage&&!['new','contacted','in_progress','booked','completed','canceled'].includes(c.stage))throw problem('Use Not contacted, Contacted, In progress, Booked, Completed or Cancelled.');
  if(c.action==='add'&&!c.name)throw problem('What is the person’s name? Send the complete lead details again.');
  if(c.action==='update'&&!c.query)throw problem('Which existing lead should I update? Include their name or email.');
  if(c.action==='update'&&!Object.keys(c).some(k=>!['action','query'].includes(k)))throw problem('What should I change on that lead?');
  return c;
}
export function createOwnerCRM(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now());
  const owner=n=>number(n)&&number(n)===number(deps.ownerNumber);
  return {
    commit:deps.commit,
    async bind(user){if(!deps.ownerEmails.includes(String(user.email).toLowerCase()))throw problem('Owner account required.',403);return (await db.update(OWNER_BINDING,s=>{if(s.uid&&s.uid!==user.sub)throw problem('Owner commands are already linked to your other admin login. Use that login.',409);Object.assign(s,{uid:user.sub,email:user.email,enabled:true});})).value;},
    async status(user){const {value:b}=await db.get(OWNER_BINDING);return {enabled:b.enabled&&b.uid===user.sub,numberEnding:String(deps.ownerNumber).slice(-4)};},
    async handle({from,text,sid}){
      if(!owner(from)||!/^SM[a-zA-Z0-9]+$/.test(sid||''))return '';
      const {value:b}=await db.get(OWNER_BINDING);if(!b.enabled||!b.uid)return '';
      const key='private/owner-crm/'+hash(b.uid)+'.json',t=clip(text,1600);
      const claim=await db.update(key,s=>{s.messages||={};if(s.messages[sid])return {cached:s.messages[sid].reply||'Your request is being checked. Please wait.'};s.messages[sid]={at:now()};for(const id of Object.keys(s.messages))if(s.messages[id].at<now()-7*86400000)delete s.messages[id];return {pending:s.pending};});
      if(claim.result.cached)return claim.result.cached;
      let reply;
      try{
        const direct=deps.direct?await deps.direct(b.uid,t,'sms_'+sid):null;
        if(direct){reply=direct.reply;}else{
        const bookingApproval=t.match(/^BOOK\s+([a-f0-9]{6})$/i);
        const bookingRequest=t.match(/^(?:please\s+)?send\s+(?:the\s+|a\s+)?(?:booking|consultation)\s+link\s+to\s+(.+?)[.!]?$/i);
        if(bookingApproval){
          if(!deps.booking)throw problem('Booking is unavailable.');
          const sent=await deps.booking.confirmCode(bookingApproval[1]);
          reply=sent.ok?'Booking link accepted by carrier. Check Messages for delivery.':'Booking text was not sent.';
        }else if(bookingRequest){
          if(!deps.booking)throw problem('Booking is unavailable.');
          const draft=await deps.booking.preview(bookingRequest[1]);
          reply=`Preview for ${draft.name} (${draft.to}):\n${draft.text}\nReply BOOK ${draft.code} within 10 minutes to send. Nothing has gone to the client.`;
        }else{
        const confirm=t.match(/^YES\s+([a-f0-9]{6})$/i);
        if(confirm){
          const pending=claim.result.pending;
          if(!pending||pending.code.toLowerCase()!==confirm[1].toLowerCase()||pending.expires<now())throw problem('That confirmation expired or does not match. Send the lead details again.');
          const result=await deps.commit(pending.command,pending.id);
          reply='Saved '+result.name+' in the Lead Station.';
          await db.update(key,s=>{if(s.pending?.id===pending.id)delete s.pending;});
        }else{
          const answer=deps.converse?await deps.converse(b.uid,t):await deps.parse(b.uid,t);
          if(deps.converse&&answer.action==='chat'){
            reply=clip(answer.reply,1600)||'What would you like to talk about?';
          }else if(deps.converse&&answer.action!=='lead_change'){
            const result=await deps.ownerAction(b.uid,answer,'sms_'+sid);
            reply=result.reply;
          }else{
            const command=cleanCommand(deps.converse?answer.command:answer);
            if(command.action==='update'){const found=await deps.find(command.query);if(!found.ok)throw problem(found.why||'Use the exact lead name or email.');command.id=found.lead.id;command.displayName=found.lead.name;}
            const code=randomBytes(3).toString('hex'),id='sms_'+sid;
            const detail=[command.name||command.displayName,command.phone,command.email,command.note,command.tier,command.stage].filter(Boolean).join(' · ').slice(0,1100);
            reply=(command.action==='add'?'Add: ':'Update: ')+detail+'\nReply YES '+code+' within 10 minutes to save. Nothing has changed yet.';
            await db.update(key,s=>{s.pending={id,code,command,expires:now()+600000};});
          }
        }
        }
        }
      }catch(e){reply=e.status?e.message:'I could not confirm the result. Use STATUS or ACTIONS by SMS before retrying.';}
      await db.update(key,s=>{s.messages[sid].reply=reply;});
      return reply;
    }
  };
}
