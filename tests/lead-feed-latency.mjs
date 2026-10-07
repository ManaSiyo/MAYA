// Execute the actual Wix lead loader with fake providers: contact reads must
// neither wait for model-generated summaries nor use a ten-minute raw cache.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../docs/server/server.js',import.meta.url),'utf8');
const start=source.indexOf('let _leadsCache ='),end=source.indexOf('// v13.54:',start);
let queries=0,summaries=0,now=Date.now();
const id='11111111-1111-4111-8111-111111111111';
const formId='d6894a81-9660-42ba-ae5b-874a85024837';
const submission={id,namespace:'wix.form_app.form',formId,createdDate:new Date(now).toISOString(),submissions:{first_name:'Test',phone:'+14155550123',what_are_you_picturing:'A garment with an original silhouette'}};
const FakeDate=class extends Date{static now(){return now;}};
const load=new Function('WIX_KEY','WIX_SITE','LEADS_DAYS','LEADS_NAMESPACE','LEADS_SKIP_FORMS','LEADS_ONLY_FORMS','wixFormNames','guessFormName','summarizeLead','fetch','AbortSignal','Date',source.slice(start,end)+';return wixLeads;')(
 'fake','site',365,'wix.form_app.form',/newsletter/,/Call back/,async()=>({[formId]:'Call back'}),()=> 'Call back',async()=>{summaries++;return 'AI summary';},async url=>{queries++;return {ok:true,json:async()=>url.includes('/namespace/query')?{submissions:[submission]}:{submission}};},AbortSignal,FakeDate);
const raw=await load();assert.equal(summaries,0);assert.equal(raw.list[0].phone,'+14155550123');assert.match(raw.list[0].note,/original silhouette/);
await load();assert.equal(queries,1,'Raw reads reuse the short cache');
now+=10001;await load();assert.equal(queries,2,'Raw data refreshes within seconds, not ten minutes');
await load({summaries:true});assert.equal(summaries,1,'AI summaries remain explicit and optional');
await load();assert.equal(summaries,1,'Summary cache cannot change the raw read mode');assert.equal(queries,4);
await load({fresh:true,submissionId:id});assert.equal(summaries,1);assert.equal(queries,5);
await load();assert.equal(queries,6,'Callback event invalidates the general feed cache');
submission.formId='another-form';assert.equal((await load({fresh:true,submissionId:id})).connected,false,'Worker re-fetch verifies the exact callback form');
console.log('PASS lead lookups bypass AI, short cache, isolated summary mode and callback invalidation');
