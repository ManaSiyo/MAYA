// tests/maya-messages.mjs: the studio's text threads, against a fake Twilio
// and an in memory store. Run: node tests/maya-messages.mjs
import crypto from 'node:crypto';
import http from 'node:http';
let express;
try { express = (await import('express')).default; }
catch (e) { console.log('SKIPPED maya-messages: express is not installed here; CI installs it'); process.exit(0); }
const { createMessageStore, sendSms, mountMessages, e164, isNo, isYes } = await import('../docs/server/maya-messages.mjs');

let passed = 0, failed = 0;
function ok(name, cond, detail) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); } }

ok('numbers normalize to E.164', e164('(510) 991-9445') === '+15109919445' && e164('+15109909223') === '+15109909223' && e164('15109909223') === '+15109909223');
ok('a no is a no, anything else is a yes', isNo('STOP') && isNo('no thanks') && isYes('sure, sounds good') && !isYes('Stop'));

// the store on a fake bucket
let bucket = null;
const store = createMessageStore({ load: async () => bucket, save: async (rec) => { bucket = JSON.parse(JSON.stringify(rec)); }, log: () => {} });
await store.outbound({ to: '646-996-6115', text: 'Hi Kristi, it\'s Mana Siyo. We just saw your request and we\'re going to call you shortly. Okay to text you here about it?', sid: 'SM1', asks: true, name: 'Kristi Lugo' });
ok('the first text asks, and the thread waits on the answer', (await store.consent('+16469966115')) === 'asked' && (await store.get('+16469966115')).name === 'Kristi Lugo');
await store.inbound({ from: '+16469966115', text: 'Yes of course', sid: 'SM2' });
ok('a reply that is not a no is consent; the thread counts one unread', (await store.consent('+16469966115')) === 'yes' && (await store.get('+16469966115')).unread === 1);
await store.call({ number: '+16469966115', dir: 'out', seconds: 95, mode: 'client', summary: 'Thursday at three is perfect.' });
const list = await store.list();
ok('the thread list carries name, unread and the last thing that happened', list.length === 1 && list[0].name === 'Kristi Lugo' && list[0].unread === 1 && list[0].last.kind === 'call' && list[0].last.seconds === 95, JSON.stringify(list));
await store.markRead('+16469966115');
await store.inbound({ from: '+16469966115', text: 'STOP', sid: 'SM3' });
ok('STOP closes the thread to texts', (await store.consent('+16469966115')) === 'stop' && (await store.get('+16469966115')).messages.length === 4);
await store.inbound({ from: '+14155550100', text: 'Hi, do you make suits?', sid: 'SM4' });
ok('a stranger texting in opens a thread of their own, and counts as yes', (await store.list()).length === 2 && (await store.consent('+14155550100')) === 'yes');

// sendSms against a fake Twilio
const twRest = [];
const twSrv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const form = Object.fromEntries(new URLSearchParams(b)); twRest.push({ url: req.url, form }); res.setHeader('Content-Type', 'application/json'); if (form.To === '+14155559999') { res.statusCode = 400; res.end(JSON.stringify({ code: 30034, message: 'Unregistered' })); } else { res.statusCode = 201; res.end(JSON.stringify({ sid: 'SM' + twRest.length, status: 'queued' })); } }); });
await new Promise(r => twSrv.listen(0, '127.0.0.1', r));
const tdeps = { accountSid: 'ACtest', authToken: 'tok', fromNumber: '+15109909223', twilioApi: 'http://127.0.0.1:' + twSrv.address().port };
const sent = await sendSms(tdeps, { to: '646 996 6115', text: 'Great. We will call you around 3 pm.' });
ok('a text goes out from the studio number', sent.ok === true && twRest[0].url === '/2010-04-01/Accounts/ACtest/Messages.json' && twRest[0].form.From === '+15109909223' && twRest[0].form.To === '+16469966115');
const blocked = await sendSms(tdeps, { to: '+14155559999', text: 'x' });
ok('an unregistered number failure reads as the campaign still in review', blocked.ok === false && /carrier registration/.test(blocked.why));
ok('a foreign or bad number is refused before Twilio', (await sendSms(tdeps, { to: '+44 20 1234', text: 'x' })).ok === false);

// the routes
const app = express();
const AUTH = 'tok';
const calls = [];
mountMessages(app, {
  store, sendSms: (to, text) => sendSms(tdeps, { to, text }), authToken: AUTH, publicHost: 'maya.manasiyo.com',
  requireAdmin: async (req) => { if (req.get('authorization') === 'Bearer admin') return { email: 'worldofsiyo@gmail.com' }; const e = new Error('no'); e.status = 401; throw e; },
  json: express.json(), urlencoded: express.urlencoded({ extended: false }),
  callClient: async (x) => { calls.push(x); return { ok: true, sid: 'CAx' }; }, log: () => {},
});
const server = http.createServer(app);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const H = { 'Authorization': 'Bearer admin', 'Content-Type': 'application/json' };
const sign = (u, p) => crypto.createHmac('sha1', AUTH).update(u + Object.keys(p).sort().map(k => k + p[k]).join('')).digest('base64');

ok('the threads need an admin', (await fetch(base + '/api/admin/messages')).status === 401);
const threads = await (await fetch(base + '/api/admin/messages', { headers: H })).json();
ok('the admin sees the threads', threads.ok && threads.threads.length === 2 && threads.threads.some(t => t.number === '+14155550100'));
const p = { From: '+14155550100', Body: 'And a coat', MessageSid: 'SM9' };
const unsigned = await fetch(base + '/api/phone/sms', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString() });
const signed = await fetch(base + '/api/phone/sms', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign('https://maya.manasiyo.com/api/phone/sms', p) }, body: new URLSearchParams(p).toString() });
ok('an incoming text is accepted only with Twilio\'s signature and lands in the thread', unsigned.status === 403 && signed.status === 200 && /<Response><\/Response>/.test(await signed.text()) && (await store.get('+14155550100')).messages.length === 2);
const th = await (await fetch(base + '/api/admin/messages/thread?number=%2B14155550100', { headers: H })).json();
ok('opening a thread returns it and clears the unread count', th.ok && th.thread.messages.length === 2 && (await store.get('+14155550100')).unread === 0);
const snd = await (await fetch(base + '/api/admin/messages/send', { method: 'POST', headers: H, body: JSON.stringify({ to: '+14155550100', text: 'Yes we do. What are you picturing?' }) })).json();
ok('a text typed in Admin goes out and is kept in the thread', snd.ok === true && (await store.get('+14155550100')).messages.length === 3 && (await store.get('+14155550100')).messages[2].dir === 'out');
const stopped = await fetch(base + '/api/admin/messages/send', { method: 'POST', headers: H, body: JSON.stringify({ to: '+16469966115', text: 'x' }) });
ok('a thread that said STOP refuses to send', stopped.status === 409);
const cc = await (await fetch(base + '/api/admin/phone/call-client', { method: 'POST', headers: H, body: JSON.stringify({ to: '646 996 6115', name: 'Kristi Lugo', reason: 'Thursday?' }) })).json();
ok('the phone icon route hands the call to Maya with the number in E.164', cc.ok === true && calls.length === 1 && calls[0].to === '+16469966115' && calls[0].name === 'Kristi Lugo');

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + ' (' + passed + ' ok)');
twSrv.close(); server.close();
process.exit(failed ? 1 : 0);
