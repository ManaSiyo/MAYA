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
export function createMessageArchive(deps){
  const db=jsonStore(deps);
  return {
    async append(number,epoch,messages){
      await db.update(key(number,epoch),s=>{s.messages||=[];const byId=new Map(s.messages.map(m=>[m.id,m]));for(const m of messages){const saved=byId.get(m.id);if(saved)mergeStatus(saved,m);else{s.messages.push(m);byId.set(m.id,m);}}});
    },
    async status(number,epoch,update){
      const {value}=await db.get(key(number,epoch));
      if(!value.messages?.some(m=>m.id===update.sid))return false;
      await db.update(key(number,epoch),s=>{const m=s.messages.find(m=>m.id===update.sid);if(!m)return;
        mergeStatus(m,update);
      });return true;
    },
    async read(number,epoch){return (await db.get(key(number,epoch))).value.messages||[];},
  };
}
