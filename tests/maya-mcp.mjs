// MAYA's door: the MCP module, driven with fake stores. v14.02.
//   node tests/maya-mcp.mjs
import assert from 'node:assert';
import { createMayaMcp, MCP_PROTOCOL } from '../docs/server/maya-mcp.mjs';

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '  ' + e.message); }
}
const features = { items: [
  { id: 'f_1', ts: '2026-08-25T00:00:00Z', who: 'fromsa', text: 'weekly digest', source: 'voice', done: false },
  { id: 'f_2', ts: '2026-08-26T00:00:00Z', who: 'paula', text: 'search pinterest by voice', source: 'voice', done: false },
  { id: 'f_0', ts: '2026-08-24T00:00:00Z', who: 'fromsa', text: 'already shipped', source: 'voice', done: true },
] };
let soul = '# soul\n- (2026-08-26 10:00) hello';
const saved = [];
const mcp = createMayaMcp({
  version: 'test', configured: () => ({ openai: true }),
  loadFeatures: async () => features, saveFeatures: async (r) => { saved.push(JSON.parse(JSON.stringify(r))); },
  loadMemory: async () => ({ items: [{ ts: 't', text: 'fact one' }, { ts: 't', text: 'fact two' }] }),
  loadPeople: async () => ({ items: [{ name: 'Fromsa', role: 'Founder' }] }),
  loadSoul: async () => soul, appendSoul: async (t) => { soul += '\n- ' + t; return true; },
  loadLeads: async () => ({ leads: [{ name: 'Kristi', email: 'k@x.com', source: 'wix', tier: 'Signature', lastQuote: 600, note: 'called' }] }),
});
const rpc = (method, params, id = 1) => mcp.handle({ jsonrpc: '2.0', id, method, params });

console.log('\nMAYA MCP door\n');
await test('initialize announces tools and the protocol', async () => {
  const r = await rpc('initialize', { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(r.result.protocolVersion, MCP_PROTOCOL);
  assert.equal(r.result.serverInfo.name, 'maya');
  assert.ok(r.result.capabilities.tools);
});
await test('notifications get no reply (HTTP 202 upstream)', async () => {
  assert.equal(await mcp.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
await test('tools/list carries the eight tools with schemas', async () => {
  const r = await rpc('tools/list');
  const names = r.result.tools.map(t => t.name);
  assert.deepEqual(names, ['maya_status', 'maya_inbox', 'maya_feature_done', 'maya_memory', 'maya_people', 'maya_soul', 'maya_journal', 'maya_leads']);
  assert.ok(r.result.tools.every(t => t.inputSchema && t.inputSchema.type === 'object' && t.description));
});
await test('maya_inbox lists open asks newest first, hides done', async () => {
  const r = await rpc('tools/call', { name: 'maya_inbox', arguments: {} });
  const j = JSON.parse(r.result.content[0].text);
  assert.equal(j.count, 2); assert.equal(j.items[0].id, 'f_2'); assert.ok(j.items.every(i => !i.done));
});
await test('maya_inbox open=false shows everything', async () => {
  const r = await rpc('tools/call', { name: 'maya_inbox', arguments: { open: false } });
  assert.equal(JSON.parse(r.result.content[0].text).count, 3);
});
await test('maya_feature_done marks and saves', async () => {
  const r = await rpc('tools/call', { name: 'maya_feature_done', arguments: { id: 'f_1', note: 'shipped in v14.02' } });
  assert.equal(JSON.parse(r.result.content[0].text).ok, true);
  assert.equal(saved.length, 1); assert.equal(features.items[0].done, true); assert.equal(features.items[0].note, 'shipped in v14.02');
});
await test('maya_feature_done on an unknown id is a tool error, not a crash', async () => {
  const r = await rpc('tools/call', { name: 'maya_feature_done', arguments: { id: 'nope' } });
  assert.equal(r.result.isError, true);
});
await test('maya_journal appends to the soul; maya_soul reads it back with tail', async () => {
  await rpc('tools/call', { name: 'maya_journal', arguments: { text: 'decided: zoom floor is 40 percent' } });
  const r = await rpc('tools/call', { name: 'maya_soul', arguments: { tail: 40 } });
  assert.ok(r.result.content[0].text.endsWith('zoom floor is 40 percent'));
  assert.ok(r.result.content[0].text.length <= 40);
});
await test('maya_memory, maya_people, maya_leads, maya_status read', async () => {
  const m = JSON.parse((await rpc('tools/call', { name: 'maya_memory', arguments: { limit: 1 } })).result.content[0].text);
  assert.equal(m.items.length, 1); assert.equal(m.items[0].text, 'fact two');
  const p = JSON.parse((await rpc('tools/call', { name: 'maya_people', arguments: {} })).result.content[0].text);
  assert.equal(p.items[0].name, 'Fromsa');
  const l = JSON.parse((await rpc('tools/call', { name: 'maya_leads', arguments: {} })).result.content[0].text);
  assert.equal(l.leads[0].email, 'k@x.com'); assert.equal(l.leads[0].lastQuote, 600);
  const s = JSON.parse((await rpc('tools/call', { name: 'maya_status', arguments: {} })).result.content[0].text);
  assert.equal(s.maya, 'here'); assert.equal(s.openFeatureRequests, 1); assert.equal(s.people, 1);
});
await test('unknown tool and unknown method are JSON-RPC errors', async () => {
  assert.equal((await rpc('tools/call', { name: 'nope', arguments: {} })).error.code, -32602);
  assert.equal((await rpc('nope/method')).error.code, -32601);
  assert.equal((await mcp.handle({ foo: 1 })).error.code, -32600);
});
await test('a batch answers every request in it', async () => {
  const r = await mcp.handle([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', method: 'notifications/x' }]);
  assert.equal(r.length, 2);
});
console.log('\n' + (failed ? failed + ' FAILED' : failed === 0 && 'all passed') + '\n');
process.exit(failed ? 1 : 0);
