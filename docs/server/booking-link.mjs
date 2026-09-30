// Owner-reviewed consultation links. Oracle!M5 in the owner-shared 2026 Sheet.
// A proposal is durable and one-use; an uncertain carrier result is never retried.
import {randomBytes,randomUUID} from 'node:crypto';
import {jsonStore,problem} from './crm-store.mjs';
import {e164} from './maya-messages.mjs';

export const BOOKING_URL='https://wix.to/wT2lSqE';
export const BOOKING_PROPOSALS='private/owner-crm/booking-proposals.json';
export function bookingText(name){
  const first=String(name||'').trim().split(/\s+/)[0]||'there';
  return `Hi ${first}, this is Maya from Mana Siyo. Fromsa asked me to share our consultation booking link: ${BOOKING_URL}`;
}
export function createBookingLinks(deps){
  const db=jsonStore(deps),now=deps.now||(()=>Date.now());
  async function preview(query,{notifyOwner=false}={}){
    const found=await deps.findLead(String(query||'').trim());
    if(!found?.ok)throw problem(found?.why||'Choose an exact lead in the Lead Station.',409);
    const lead=found.lead,to=e164(lead.phone);
    if(!/^\+1\d{10}$/.test(to))throw problem('That lead has no complete US phone number.',409);
    const id=randomUUID(),code=randomBytes(3).toString('hex');
    const proposal={id,code,leadId:lead.id,name:lead.name,to,text:bookingText(lead.name),status:'preview',at:now(),expires:now()+10*60000};
    await db.update(BOOKING_PROPOSALS,s=>{
      s.items||={};s.items[id]=proposal;
      for(const [key,item] of Object.entries(s.items))if(item.at<now()-7*86400000)delete s.items[key];
    });
    if(notifyOwner){
      const sms=`Booking preview for ${proposal.name} (${proposal.to}):\n${proposal.text}\nReply BOOK ${code} within 10 minutes to send. Nothing has gone to the client.`;
      try{proposal.ownerPreview=await deps.notifyOwner(sms);}catch{proposal.ownerPreview={ok:false};}
    }
    return proposal;
  }
  async function pending(){const {value}=await db.get(BOOKING_PROPOSALS);return Object.values(value.items||{}).filter(p=>p.status==='preview'&&p.expires>=now()).sort((a,b)=>b.at-a.at).slice(0,10);}
  async function confirm(id){
    let claimed;
    await db.update(BOOKING_PROPOSALS,s=>{
      const p=s.items?.[id];
      if(!p||p.expires<now())throw problem('That booking preview expired. Ask MAYA for a new one.',409);
      if(p.status!=='preview')throw problem('That booking preview was already used. Check Messages before retrying.',409);
      p.status='sending';claimed={...p};
    });
    try{
      const lead=await deps.findById(claimed.leadId);
      if(!lead||e164(lead.phone)!==claimed.to)throw problem('The lead or phone changed. Make a new preview.',409);
      const contact=await deps.contactState(claimed.to);
      if(contact?.blocked||contact?.consent==='stop')throw problem('This person is blocked or asked for no more texts.',409);
      const sent=await deps.sendSms(claimed.to,claimed.text);
      if(!sent?.ok)throw problem(sent?.why||'Twilio did not accept the message.',502);
      await db.update(BOOKING_PROPOSALS,s=>{s.items[id].status='accepted';s.items[id].sid=sent.sid;});
      try{await deps.recordSms({to:claimed.to,text:claimed.text,sid:sent.sid,status:sent.status,name:claimed.name,by:'maya-booking'});}
      catch{return {ok:true,status:sent.status,warning:'Carrier accepted the text, but Messages history could not be saved. Do not resend.'};}
      return {ok:true,status:sent.status,name:claimed.name};
    }catch(e){
      await db.update(BOOKING_PROPOSALS,s=>{if(s.items?.[id]?.status==='sending')s.items[id].status='failed';}).catch(()=>{});
      throw e;
    }
  }
  async function confirmCode(code){
    const matches=(await pending()).filter(p=>p.code===String(code||'').toLowerCase());
    if(matches.length!==1)throw problem('That booking code expired or does not match. Ask for a new preview.',409);
    return confirm(matches[0].id);
  }
  return {preview,pending,confirm,confirmCode};
}
