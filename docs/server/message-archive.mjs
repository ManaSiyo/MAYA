// Private per-contact overflow history. Archive before trimming the live inbox.
import {createHash} from 'node:crypto';
import {jsonStore} from './crm-store.mjs';
const key=(number,epoch)=>'private/messages-archive/'+createHash('sha256').update(number).digest('hex')+'/'+String(epoch||'initial').replace(/[^a-zA-Z0-9]/g,'')+'.json';
export function createMessageArchive(deps){
  const db=jsonStore(deps);
  return {
    async append(number,epoch,messages){
      await db.update(key(number,epoch),s=>{s.messages||=[];const ids=new Set(s.messages.map(m=>m.id));for(const m of messages)if(!ids.has(m.id)){s.messages.push(m);ids.add(m.id);}});
    },
    async status(number,epoch,update){
      const {value}=await db.get(key(number,epoch));
      if(!value.messages?.some(m=>m.id===update.sid))return false;
      const rank={accepted:0,queued:1,sending:2,sent:3,delivered:4,undelivered:4,failed:4};
      await db.update(key(number,epoch),s=>{const m=s.messages.find(m=>m.id===update.sid);if(!m)return;
        if(m.status===update.status&&update.errorCode)m.errorCode=String(update.errorCode);
        if((rank[m.status]??-1)<4&&(rank[update.status]??-1)>=(rank[m.status]??-1)){m.status=update.status;if(update.errorCode)m.errorCode=String(update.errorCode);}
      });return true;
    },
    async read(number,epoch){return (await db.get(key(number,epoch))).value.messages||[];},
  };
}
