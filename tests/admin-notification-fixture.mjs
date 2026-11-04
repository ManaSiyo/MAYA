import assert from 'node:assert/strict';

// Read-only Admin UI fixtures still exercise real fixed-state history writes.
// Exempt only this exact authenticated contract from owner-action counters.
const adSources=new Set(['google_ads','meta_ads','chatgpt_ads']);
const sources=new Set(['marketing','leads','analytics','submissions','callback_alerts','site','api','images','backup','briefing','features']);
const adCodes=new Set(['connected','not_configured','oauth_expired','project_access','account_access','scope','authorization','account_mismatch','provider_error','incomplete_report','invalid_report','invalid_metric','invalid_account','currency_excluded']);
const codes=new Set(['healthy','unavailable','needs_attention','not_configured']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function captureAdminNotification(req,{tokens,batches}){
 const url=new URL(req.url());
 if(url.pathname!=='/api/admin/notifications')return false;
 assert.equal(url.search,'','Notification fixture has no account/query overrides');
 assert.ok(['GET','POST'].includes(req.method()),'Notification fixture permits only reads and fixed-state observations');
 assert.ok(tokens.some(token=>req.headers().authorization==='Bearer '+token),'Notification history requires the expected fixture account');
 if(req.method()==='POST'){
  assert.equal(req.headers()['content-type'],'application/json','Notification observations use JSON');
  assert.ok(req.postData().length<=2048,'Fixed-state notification payload stays small');
  const body=req.postDataJSON();
  assert.ok(record(body),'Notification batch is an object');
  assert.deepEqual(Object.keys(body),['items'],'Notification writes contain only the fixed-state batch');
  assert.ok(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=16,'Notification batch is bounded');
  const seen=new Set();
  for(const item of body.items){
   assert.ok(record(item),'Notification observation is an object');
   assert.deepEqual(Object.keys(item).sort(),['code','source'],'Notifications contain no text, credentials, account IDs or recipient details');
   assert.ok(adSources.has(item.source)||sources.has(item.source),'Notification source is allowlisted');
   assert.ok((adSources.has(item.source)?adCodes:codes).has(item.code),'Notification code is allowlisted for its source');
   assert.ok(!seen.has(item.source),'Notification batch has one fixed state per source');seen.add(item.source);
  }
  batches.push(body);
 }
 return true;
}
