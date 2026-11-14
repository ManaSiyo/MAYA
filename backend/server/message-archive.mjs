// Private per-contact overflow history. Archive before trimming the live inbox.
import {createHash} from 'node:crypto';
import {jsonStore} from './crm-store.mjs';
const key=(number,epoch)=>'private/messages-archive/'+createHash('sha256').update(number).digest('hex')+'/'+String(epoch||'initial').replace(/[^a-zA-Z0-9]/g,'')+'.json';
const rank={accepted:0,queued:1,sending:2,sent:3,delivered:4,undelivered:4,failed:4};
function mergeStatus(message,update){
  if(message.status===update.status&&update.errorCode)message.errorCode=String(update.errorCode);
  if((rank[message.status]??-1)<4&&(rank[update.status]??-1)>=(rank[message.status]??-1)){
    if(update.status)message.status=update.status;
    if(update.errorCode)message.errorCode=String(update.errorCode);
  }
}
const replyId=m=>m.dir==='out'?(m.replyTo||(/^owner-reply-(SM[a-zA-Z0-9]+)$/.exec(m.id||'')?.[1])):undefined;
function bindReply(message,sid,replyTo){
  if(!replyTo)return;
  if(message.replyTo&&(message.id!==sid||message.replyTo!==replyTo))throw new Error('Reply SID mismatch');
  message.replyTo=replyTo;message.id=sid;
}
const statusMessage=(messages,update)=>messages?.find(m=>m.dir==='out'&&(m.id===update.sid||(update.replyTo&&replyId(m)===update.replyTo)));
export function createMessageArchive(deps){
  const db=jsonStore(deps);
  return {
    async append(number,epoch,messages){
      await db.update(key(number,epoch),s=>{
        s.messages||=[];const byId=new Map(s.messages.map(m=>[m.id,m])),byReply=new Map(s.messages.filter(replyId).map(m=>[replyId(m),m]));
        for(const m of messages){
          const alias=replyId(m),saved=byId.get(m.id)||(alias&&byReply.get(alias));
          if(saved){
            // An inbox CAS retry can still carry the old synthetic owner ID.
            // Merge it into the carrier record without recreating or downgrading it.
            if(alias&&/^SM[a-zA-Z0-9]+$/.test(m.id))bindReply(saved,m.id,alias);
            mergeStatus(saved,m);
            byId.set(saved.id,saved);if(alias)byReply.set(alias,saved);
          }else{s.messages.push(m);byId.set(m.id,m);if(alias)byReply.set(alias,m);}
        }
      });
    },
    async status(number,epoch,update){
      const {value}=await db.get(key(number,epoch));
      if(!statusMessage(value.messages,update))return false;
      await db.update(key(number,epoch),s=>{const m=statusMessage(s.messages,update);if(!m)return;
        bindReply(m,update.sid,update.replyTo);
        mergeStatus(m,update);
      });return true;
    },
    async read(number,epoch){return (await db.get(key(number,epoch))).value.messages||[];},
  };
}
