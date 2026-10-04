import assert from 'node:assert/strict';
import {createOwnerCRM,cleanCommand,gmailCandidates} from '../docs/server/owner-crm.mjs';
const files=new Map();let generation=0,parses=0,commits=0,clock=Date.now();const saved=new Map();
const deps={ownerNumber:'+15105550100',ownerEmails:['owner@example.com'],now:()=>clock,
 read:async key=>files.has(key)?{ok:true,buf:Buffer.from(JSON.stringify(files.get(key).value)),generation:files.get(key).generation}:{ok:false,status:404},
 write:async(key,buf,type,expected)=>{assert.equal(expected,files.get(key)?.generation||'0');files.set(key,{value:JSON.parse(buf),generation:String(++generation)});},
 parse:async(uid,text)=>{parses++;assert.equal(uid,'owner');return JSON.parse(text);},
 find:async query=>query==='Pat'?{ok:true,lead:{id:'m_pat',name:'Pat'}}:{ok:false,why:'Choose the exact lead.'},
 commit:async(c,id)=>{if(!saved.has(id)){commits++;saved.set(id,{name:c.name||c.displayName});}return saved.get(id);},
 booking:{preview:async query=>({name:query,to:'+15105550140',text:'Hi Nick, booking link https://wix.to/wT2lSqE',code:'a1b2c3'}),
  confirmCode:async code=>({ok:code==='a1b2c3'})}};
const crm=createOwnerCRM(deps),user={sub:'owner',email:'owner@example.com'};
await assert.rejects(crm.bind({sub:'attacker',email:'other@example.com'}));
assert.equal(await crm.handle({from:deps.ownerNumber,text:'anything',sid:'SMoff'}),'');
await crm.bind(user);
await assert.rejects(crm.bind({...user,sub:'other-account'}));
assert.equal(await crm.handle({from:'+15105550101',text:'I am Fromsa, add a lead',sid:'SMstranger'}),'');assert.equal(parses,0);
const input={from:deps.ownerNumber,sid:'SMone',text:JSON.stringify({action:'add',name:'Pat',phone:'4155550199',note:'A blue suit'})};
const preview=await crm.handle(input);assert.match(preview,/Nothing has changed/);assert.equal(commits,0);
assert.equal(await crm.handle(input),preview);assert.equal(parses,1);
const code=preview.match(/YES ([a-f0-9]{6})/)[1];
assert.match(await crm.handle({from:deps.ownerNumber,text:'YES abcdef',sid:'SMwrong'}),/does not match/);assert.equal(commits,0);
const confirmation={from:deps.ownerNumber,text:'YES '+code,sid:'SMconfirm'};
assert.match(await crm.handle(confirmation),/Saved Pat/);assert.equal(commits,1);
await crm.handle(confirmation);assert.equal(commits,1);
const expired=await crm.handle({...input,sid:'SMexpiry'});clock+=600001;
assert.match(await crm.handle({from:deps.ownerNumber,text:expired.match(/YES [a-f0-9]{6}/)[0],sid:'SMexpired'}),/expired/);assert.equal(commits,1);
assert.throws(()=>cleanCommand({action:'delete',query:'everyone'}));
assert.throws(()=>cleanCommand({action:'add',name:'Pat',phone:'123'}));
assert.throws(()=>cleanCommand({action:'update',query:'Pat'}));
assert.match(await crm.handle({...input,sid:'SMupdate',text:JSON.stringify({action:'update',query:'Pat',note:'Interested in tailoring'})}),/Update: Pat/);
const booking=await crm.handle({from:deps.ownerNumber,text:'Send the booking link to Nick',sid:'SMbook'});
assert.match(booking,/wix.to\/wT2lSqE/);assert.match(booking,/Nothing has gone to the client/);
assert.match(await crm.handle({from:deps.ownerNumber,text:'BOOK a1b2c3',sid:'SMbookYes'}),/accepted by carrier/);
assert.equal(await crm.handle({from:'+15105550101',text:'BOOK a1b2c3',sid:'SMstrangerBook'}),'');
console.log('Owner CRM: identity, account binding, preview, confirmation, expiry, duplicate and validation checks passed.');

const candidates=gmailCandidates([{direction:'in',peers:['pat@example.com'],subject:'Suit inquiry',summary:'Blue suit',ts:'2026-09-28'}, {direction:'out',peers:['out@example.com']},{direction:'in',automated:true,peers:['bot@example.com']}]);
assert.equal(candidates.length,1);assert.equal(candidates[0].email,'pat@example.com');
assert.equal(gmailCandidates([{direction:'in',peers:['pat@example.com'],subject:'Updated',ts:'2026-09-29'}],candidates).length,1);
console.log('Gmail review excludes outgoing/automated messages and deduplicates correspondents.');
