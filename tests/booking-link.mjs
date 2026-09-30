import assert from 'node:assert/strict';
import {createBookingLinks,BOOKING_URL} from '../docs/server/booking-link.mjs';
const files=new Map();let seq=0,sent=0,recorded=0,blocked=false,changed=false;
const now=Date.parse('2026-09-30T19:00:00Z');
const store={read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
  write:async(key,buf,_,expected)=>{assert.equal(expected,files.get(key)?.generation||'0');files.set(key,{value:JSON.parse(buf),generation:String(++seq)});}};
const service=createBookingLinks({...store,now:()=>now,
  findLead:async q=>q==='Nick'?{ok:true,lead:{id:'n',name:'Nick Mann',phone:'510 555 0140'}}:{ok:false,why:'Choose an exact lead.'},
  findById:async id=>id==='n'?{id:'n',name:'Nick Mann',phone:changed?'5105550141':'5105550140'}:null,
  contactState:async()=>({consent:blocked?'stop':'yes'}),
  sendSms:async(to,text)=>{sent++;assert.equal(to,'+15105550140');assert.match(text,/wix.to\/wT2lSqE/);return {ok:true,sid:'SMbooking',status:'queued'}},
  recordSms:async()=>{recorded++},notifyOwner:async()=>({ok:true})});
assert.equal(BOOKING_URL,'https://wix.to/wT2lSqE');
await assert.rejects(service.preview('Unknown'),/exact lead/);
const preview=await service.preview('Nick',{notifyOwner:true});
assert.equal(preview.ownerPreview.ok,true);assert.equal(sent,0);assert.equal((await service.pending()).length,1);
blocked=true;await assert.rejects(service.confirm(preview.id),/asked for no more texts/);assert.equal(sent,0);
blocked=false;changed=true;const changedPreview=await service.preview('Nick');await assert.rejects(service.confirm(changedPreview.id),/phone changed/);assert.equal(sent,0);
changed=false;const ready=await service.preview('Nick');assert.deepEqual(await service.confirmCode(ready.code),{ok:true,status:'queued',name:'Nick Mann'});
assert.equal(sent,1);assert.equal(recorded,1);await assert.rejects(service.confirm(ready.id),/already used/);
console.log('Booking: exact lead, preview, opt-out, changed phone, approved single send, carrier status.');
