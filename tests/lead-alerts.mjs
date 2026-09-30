import assert from 'node:assert/strict';
import {createLeadAlerts} from '../docs/server/lead-alerts.mjs';
const files=new Map();let seq=0,texts=0,calls=0;
const now=Date.parse('2026-09-30T19:00:00Z');
const store={
  read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
  write:async(key,buf,_,expected)=>{assert.equal(expected,files.get(key)?.generation||'0');files.set(key,{value:JSON.parse(buf),generation:String(++seq)});},
};
const alerts=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:true,list:[
  {id:'new',source:'wix',name:'Nick',ts:'2026-09-30T18:25:49Z',wrote:'A custom suit'},
  {id:'old',source:'wix',name:'Older',ts:'2026-09-05T18:00:00Z'},
  {id:'manual',source:'maya',name:'Manual',ts:'2026-09-30T18:00:00Z'},
]}),textOwner:async body=>{texts++;assert.match(body,/Nick/);return {ok:true}},callOwner:async reason=>{calls++;assert.match(reason,/Nick/);return {ok:true}}});
assert.deepEqual(await alerts.run(),{checked:1,texts:1,calls:1,failed:[]});
assert.deepEqual(await alerts.run(),{checked:1,texts:0,calls:0,failed:[]});
assert.equal(texts,1);assert.equal(calls,1);
const disconnected=createLeadAlerts({...store,now:()=>now,fetchLeads:async()=>({connected:false})});
await assert.rejects(disconnected.run(),/unavailable/);
console.log('Lead alerts: new Call back submission, deduplication, old/manual exclusion, outage.');
