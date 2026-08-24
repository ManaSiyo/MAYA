import assert from 'node:assert/strict';
import { buildAdminCommandSnapshot, resolveLeadExact } from '../docs/server/admin-command.mjs';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (error) { failed++; console.error('  FAIL ' + name + '  ' + error.message); }
}

console.log('\nMAYA Admin command test\n');

const leads = [
  { id: '1', name: 'Ari Jones', email: 'ari@example.com', note: 'Black suit for October' },
  { id: '2', name: 'Ari Smith', email: 'ari.smith@example.com', note: 'Silk dress' },
  { id: '3', name: 'Mina Patel', email: 'mina@example.com', note: 'Wedding look' },
];

await test('email and full name resolve exactly', () => {
  assert.equal(resolveLeadExact(leads, 'MINA@EXAMPLE.COM').lead.id, '3');
  assert.equal(resolveLeadExact(leads, 'Mina Patel').lead.email, 'mina@example.com');
});

await test('a unique exact first name resolves but an ambiguous one does not', () => {
  assert.equal(resolveLeadExact(leads, 'Mina').status, 'exact');
  const ari = resolveLeadExact(leads, 'Ari');
  assert.equal(ari.status, 'ambiguous');
  assert.equal(ari.matches.length, 2);
});

await test('partial and fuzzy names never silently select a lead', () => {
  assert.equal(resolveLeadExact(leads, 'Pat').status, 'not_found');
  assert.equal(resolveLeadExact(leads, 'Ari J').status, 'not_found');
});

await test('snapshot produces deterministic briefing, attention and panel DTOs', () => {
  const snap = buildAdminCommandSnapshot({
    wix: { connected: true, today: { visitors: 9 }, d7: { visitors: 70 }, d28: { visitors: 210 } },
    ads: { connected: true,
      sources: { google_ads: { spend: 25, clicks: 10 }, facebook: { spend: 15, linkClicks: 5 } },
      campaigns: [{ campaign: 'Search', spend: 25 }],
      adGroups: [{ name: 'Silent group', status: 'ENABLED', impressions7: 0 }] },
    leads: { connected: true, today: 1, d7: 2, d28: 4, list: leads },
    submissions: [
      { name: 'submissions/client-a/dream-garment.jpg', timeCreated: '2026-08-23T10:00:00Z' },
      { name: 'submissions/client-a/summary.json', timeCreated: '2026-08-23T10:01:00Z' },
      { name: 'submissions/client-b/summary.json', timeCreated: '2026-08-24T11:00:00Z' },
    ],
    accounts: { total: 12, d7: 3, d28: 8 },
    ships: ['Aug 24: command layer shipped'],
  }, new Date('2026-08-24T12:00:00Z'));
  assert.equal(snap.generatedAt, '2026-08-24T12:00:00.000Z');
  assert.equal(snap.panels.submissions.total, 2);
  assert.equal(snap.panels.bottom.costPerLead, 20);
  assert.equal(snap.panels.traffic.accounts.total, 12);
  assert.ok(snap.briefing.some(line => line.includes('9 people')));
  assert.ok(snap.attention.some(item => item.panel === 'ads' && item.severity === 'red'));
});

await test('missing feeds are called unavailable instead of becoming zero', () => {
  const snap = buildAdminCommandSnapshot({}, new Date('2026-08-24T12:00:00Z'));
  assert.equal(snap.panels.traffic.manasiyo, null);
  assert.equal(snap.panels.ads, null);
  assert.ok(snap.attention.some(item => item.text.includes('unavailable')));
});

console.log('\n' + (failed ? failed + ' FAILED' : passed + ' passed') + '\n');
process.exit(failed ? 1 : 0);
