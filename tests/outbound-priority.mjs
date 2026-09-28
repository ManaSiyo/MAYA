import assert from 'node:assert/strict';
import {priorityInfo,priorityQueue,followupSummary,sheetDate,SHEET_COLUMNS} from '../backend/outbound-priority.js';
import {rowsToContacts,mergeContacts} from '../docs/server/outbound.mjs';
import {reconcile,hydrateOutboundHistory} from '../docs/server/crm-intelligence.mjs';
const now=Date.parse('2026-09-28T19:00:00Z');
const row=(id,status,date='',score='80')=>({...rowsToContacts([SHEET_COLUMNS,['Corporate','Example '+id,id,id+'@example.com','Director','Hello',date,status,score]])[0],id,sheetData:{syncedAt:'2026-09-28T19:00:00Z'}});
export function assertOutboundPriority(){
 const low=row('low','Never contacted','','55'),high=row('high','Never contacted','','91'),old=row('old','1st touch, no reply','06/03'),recent=row('recent','2nd touch, sent','09/27'),held=row('hold','1st touch, sent; OOO','09/23'),reply=row('reply','Replied, active','09/26'),stop=row('stop','Replied, declined','09/20'),unknown=row('unknown','Multiple touches, no reply');
 assert.deepEqual(priorityQueue([recent,low,old,held,reply,high,stop,unknown],now).map(p=>p.id),['high','low','unknown','old','recent']);
 assert.equal(old.stage,'contacted');assert.equal(unknown.stage,'contacted');assert.equal(priorityInfo(old,now).next,'F1');assert.equal(priorityInfo(recent,now).next,'F2');assert.equal(priorityInfo(unknown,now).touches,null);
 assert.equal(reply.stage,'replied');assert.equal(stop.stage,'suppressed');assert.equal(held.sheetPaused,true);
 assert.equal(low.category,'Corporate');assert.equal(low.relevance,'55');assert.equal(old.lastEmail,'06/03');assert.equal(old.sheetStatus,'1st touch, no reply');
 assert.equal(sheetDate('12/31','2026-01-02'),Date.parse('2025-12-31'));assert.equal(sheetDate('02/30',now),null);assert.equal(sheetDate('n/a',now),null);
 const counts=followupSummary([low,old,recent,held,unknown],now);assert.equal(counts.counts.uncontacted,1);assert.equal(counts.counts.first,1);assert.equal(counts.counts.f1,1);assert.equal(counts.counts.held,1);assert.equal(counts.counts.review,1);assert.equal(counts.latest.p.id,'recent');
 const state={contacts:[old]};const mail={id:'out',provider:'gmail',kind:'email',direction:'out',peers:[old.email],summary:'Follow-up',ts:'2026-09-27T19:00:00Z'};
 reconcile(state,[mail]);reconcile(state,[mail]);assert.equal(old.emailHistory.length,1);assert.equal(priorityInfo(old,now).next,'F2');
 const legacy={contacts:[{id:'legacy',stage:'replied'}],crm:{activity:[{...mail,contactIds:['legacy']}]}};hydrateOutboundHistory(legacy);hydrateOutboundHistory(legacy);assert.equal(legacy.contacts[0].emailHistory.length,1);assert.equal(legacy.contacts[0].lastOutboundAt,mail.ts);assert.equal(legacy.contacts[0].stage,'replied','Backfill never changes relationship stage');
 assert.equal(priorityInfo(old,now).lastContactAt,Date.parse(mail.ts));
 reconcile(state,[{...mail,id:'automated',automated:true,ts:'2026-09-28T19:00:00Z'}]);assert.equal(old.emailHistory.length,1);
 const queued={...mail,id:'sms',provider:'twilio',kind:'sms',status:'queued',phone:'15555550100'};old.phone=queued.phone;reconcile(state,[queued]);assert.equal(old.lastOutboundAt,mail.ts);
 // Same-day source sends must not be counted twice. Unknown old history stays unknown.
 const sameDay=row('same','2nd touch, sent','09/27');sameDay.emailHistory=[{id:'same',ts:mail.ts}];assert.equal(priorityInfo(sameDay,now).touches,2);
 const newSend=row('today','1st touch, sent','09/28');newSend.emailHistory=[{id:'later',ts:'2026-09-28T19:01:00Z'}];assert.equal(priorityInfo(newSend,now).touches,2,'Confirmed email after the Sheet snapshot advances F1 on the same day');
 mergeContacts({campaigns:[],contacts:[newSend]},[{...newSend,sheetData:{syncedAt:'2026-09-28T20:00:00Z'}}],null);assert.equal(priorityInfo(newSend,now).touches,2,'Refreshing unchanged source does not erase a recorded same-day follow-up');
 unknown.emailHistory=[{id:'new',ts:mail.ts}];assert.equal(priorityInfo(unknown,now).touches,null);
 const master={campaigns:[{id:'c'}],contacts:[]};mergeContacts(master,[low],null);assert.deepEqual(master.contacts[0].campaignIds,[]);mergeContacts(master,[{...low,id:'copy'}],'c');assert.equal(master.contacts.length,1);assert.deepEqual(master.contacts[0].campaignIds,['c']);
 const missingEmail=[{...low,id:'a',name:'Alex',company:'A',email:''},{...low,id:'b',name:'Alex',company:'B',email:''}];mergeContacts(master,missingEmail,'c');assert.equal(master.contacts.length,3);
}
assertOutboundPriority();
console.log('Outbound Sheet columns, priority, F1/F2 evidence, date precision and retained exclusions passed.');
