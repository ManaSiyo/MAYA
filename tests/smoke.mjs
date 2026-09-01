// MAYA smoke test. The first automated check this project has ever had.
//
//   cd docs/server && npm install && node ../../tests/smoke.mjs
//
// It boots the real server and hits every route. It cannot prove the app is
// correct, but it catches the class of mistake that took the whole thing down
// on 13 August 2026: a variable used one line before it was declared, which
// made every single AI call hang forever instead of answering.
import assert from 'node:assert';

process.env.GOOGLE_CLIENT_ID = 'smoke-test.apps.googleusercontent.com';
process.env.PORT = process.env.PORT || '8791';
process.env.MAYA_MCP_TOKEN = process.env.MAYA_MCP_TOKEN || 'smoke-token';
const BASE = 'http://127.0.0.1:' + process.env.PORT;

await import(new URL('../docs/server/server.js', import.meta.url).href);
await new Promise(r => setTimeout(r, 700));

let failed = 0;
async function check(name, run, expect) {
  try {
    const res = await Promise.race([
      run(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('no response in 6s')), 6000)),
    ]);
    assert.strictEqual(res.status, expect, 'expected ' + expect + ', got ' + res.status);
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '  ' + e.message);
  }
}

const post = (p, o = {}) => () => fetch(BASE + p, { method: 'POST', ...o });
const get  = (p, o = {}) => () => fetch(BASE + p, o);
const AUTH = { headers: { Authorization: 'Bearer not-a-real-token' } };

console.log('\nMAYA smoke test\n');
// v14.02: Maya's door. Closed without a token, unauthorized with a wrong one,
// open with the right one (set below, before the server booted? no: env is read
// at boot, so the smoke run exports MAYA_MCP_TOKEN=smoke before importing).
await check('mcp door: wrong token is 401',        post('/mcp', { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nope' }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' }), process.env.MAYA_MCP_TOKEN ? 401 : 503);
await check('mcp door: right token answers ping', async () => {
  const r = await fetch(BASE + '/mcp?token=' + encodeURIComponent(process.env.MAYA_MCP_TOKEN || ''), { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }) });
  if (process.env.MAYA_MCP_TOKEN) { const j = await r.json(); assert.ok(j.result && j.result.tools.length === 8, 'eight tools'); }
  return r;
}, process.env.MAYA_MCP_TOKEN ? 200 : 503);
// v14.14: the query-string token is READ-ONLY and PII-free. Writes and the
// leads book demand the Authorization header.
await check('mcp scopes: query token cannot reach the leads book', async () => {
  const r = await fetch(BASE + '/mcp?token=' + encodeURIComponent(process.env.MAYA_MCP_TOKEN || ''), { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'maya_leads', arguments: {} } }) });
  if (process.env.MAYA_MCP_TOKEN) {
    const j = await r.json();
    assert.ok(j.error && /header/.test(j.error.message || ''), 'expected a header-auth refusal, got ' + JSON.stringify(j).slice(0, 120));
  }
  return r;
}, process.env.MAYA_MCP_TOKEN ? 200 : 503);
await check('mcp scopes: header token reaches everything', async () => {
  const r = await fetch(BASE + '/mcp', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (process.env.MAYA_MCP_TOKEN || '') },
    body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'maya_status', arguments: {} } }) });
  if (process.env.MAYA_MCP_TOKEN) { const j = await r.json(); assert.ok(j.result, 'expected a result'); }
  return r;
}, process.env.MAYA_MCP_TOKEN ? 200 : 503);
await check('telemetry needs a token',             post('/api/telemetry', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('the digest needs an admin',           get('/api/admin/maya-digest'), 401);
await check('pinterest search needs a token',      get('/api/pinterest/search?q=corsets'), 401);
await check('healthz answers',                    get('/api/healthz'), 200);
await check('subthumb rejects a bad token',        get('/api/admin/subthumb?id=1a2b3c4d5e6f7g', AUTH), 401);
await check('healthz reports what is configured', async () => {
  const r = await fetch(BASE + '/api/healthz');
  const j = await r.json();
  assert.ok(j.configured && typeof j.configured.openai === 'boolean', 'no configured block');
  return r;
}, 200);
await check('deep healthz needs a sign in',       get('/api/healthz/deep'), 401);
await check('openai needs a token',               post('/api/openai/v1/chat/completions'), 401);
await check('openai rejects a bad token',         post('/api/openai/v1/chat/completions', AUTH), 401);
await check('openai answers, does not hang',      post('/api/openai/v1/images/generations', AUTH), 401);
await check('submit needs a token',               post('/api/submit'), 401);
await check('feedback needs a token',             post('/api/feedback'), 401);
await check('admin feedback needs a token',       get('/api/admin/feedback'), 401);
await check('admin submissions need a token',     get('/api/admin/submissions'), 401);
await check('admin subfile needs a token',        get('/api/admin/subfile?id=abcdefghijkl'), 401);
await check('savepieces needs a token',           post('/api/admin/savepieces'), 401);
await check('analytics needs a token',            get('/api/admin/analytics'), 401);
await check('fabric sourcing needs a token',      get('/api/source-fabric?q=wool'), 401);
await check('fabric ranking needs a token',       post('/api/rank-fabric', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('fabric visualizing needs a token',   post('/api/visualize-fabric', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('marketing brief needs a token',      post('/api/admin/marketing-brief', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('hello needs a token',                post('/api/hello', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('lead note needs a token',            post('/api/admin/lead-note', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('lead draft needs a token',           post('/api/admin/lead-draft', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('clo search needs a token',           post('/api/admin/clo-search', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('the voice needs a token',            post('/api/admin/voice-token', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('command snapshot needs a token',     get('/api/admin/command-snapshot'), 401);
await check('lead lookup needs a token',          post('/api/admin/lead-lookup', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('maya remember needs a token',        post('/api/admin/maya-remember', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('maya forget needs a token',          post('/api/admin/maya-forget', { headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401);
await check('openai refuses a model off the list', async () => {
  // v13.53: even with a syntactically valid Bearer, an unknown model must be
  // turned away. The bad token dies first with 401 here (no Google upstream
  // in the smoke run), so this asserts the route still answers, not hangs.
  return fetch(BASE + '/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer not-a-real-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-99-experimental', messages: [] }),
  });
}, 401);
await check('runway is dormant',                  post('/api/runway', AUTH), 501);
await check('fal is dormant',                     post('/api/fal/fal-ai/hyper3d/rodin', AUTH), 501);
await check('fal storage is dormant',             post('/api/falstorage/storage/upload/initiate', AUTH), 501);
await check('tip is dormant until a key is set',  post('/api/tip', { ...AUTH, headers: { ...AUTH.headers, 'Content-Type': 'application/json' }, body: '{"amount":5}' }), 501);
await check('usage meter needs a token',           get('/api/usage', AUTH), 401);

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + '\n');
process.exit(failed ? 1 : 0);
