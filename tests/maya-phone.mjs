// tests/maya-phone.mjs: Maya's phone line, end to end against a fake Twilio
// and a fake OpenAI, no network. Run: node tests/maya-phone.mjs
import crypto from 'node:crypto';
import http from 'node:http';
process.env.PHONE_AUTO_LEAD_SECONDS = '0';
let express, WebSocketServer, WebSocket;
try { express = (await import('express')).default; ({ WebSocketServer, WebSocket } = await import('ws')); }
catch (e) { console.log('SKIPPED maya-phone: express or ws is not installed here (' + e.message.split('\n')[0] + '); CI installs both'); process.exit(0); }
const { mountMayaPhone, twilioSignatureValid, callToken, phoneInstructions, PHONE_TOOLS } = await import('../docs/server/maya-phone.mjs');

let passed = 0, failed = 0;
function ok(name, cond, detail) { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); } }
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(20); } return fn(); };

// ── a fake OpenAI Realtime server ──
const aiSrv = http.createServer();
const aiWss = new WebSocketServer({ server: aiSrv });
const ai = { sockets: [], got: [] };
aiWss.on('connection', (sock, req) => {
  ai.sockets.push({ sock, auth: req.headers.authorization || '' });
  sock.on('message', (raw) => { try { ai.got.push(JSON.parse(raw.toString())); } catch (_) {} });
});
await new Promise(r => aiSrv.listen(0, '127.0.0.1', r));
const aiPort = aiSrv.address().port;

// ── the server under test ──
const AUTH = 'test-twilio-auth-token';
const app = express();
app.use(express.urlencoded({ extended: false }));
const server = http.createServer(app);
const leads = [], transcripts = [], spends = [];
mountMayaPhone(app, server, {
  authToken: AUTH, openaiKey: 'sk-test', model: 'gpt-realtime', voice: 'marin', character: 'I am Maya.',
  saveLead: async (lead, prevId) => { const item = { id: prevId || ('m_' + leads.length), ...lead }; leads.push(item); return item; },
  saveTranscript: async (callSid, rec) => { transcripts.push({ callSid, rec }); },
  noteSpend: () => spends.push(1),
  openaiUrl: 'ws://127.0.0.1:' + aiPort + '/v1/realtime',
  WebSocketServer, WebSocketClient: WebSocket, publicHost: 'maya.manasiyo.com', log: () => {},
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

// 1. the signature
const url = 'https://maya.manasiyo.com/api/phone/incoming';
const params = { CallSid: 'CA123', From: '+15105551234', To: '+14155550100', CallStatus: 'ringing' };
const sign = (u, p, tok) => crypto.createHmac('sha1', tok).update(u + Object.keys(p).sort().map(k => k + p[k]).join('')).digest('base64');
const good = sign(url, params, AUTH);
ok('a valid Twilio signature is accepted, a wrong one is not',
  twilioSignatureValid(AUTH, url, params, good) === true && twilioSignatureValid(AUTH, url, params, 'bad') === false && twilioSignatureValid(AUTH, url + '?x', params, good) === false);

const post = (headers) => fetch(base + '/api/phone/incoming', { method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(params).toString() });
const r403 = await post({});
ok('an unsigned webhook is refused', r403.status === 403);
const r200 = await post({ 'X-Twilio-Signature': good });
const twiml = await r200.text();
const token = callToken(AUTH, 'CA123');
ok('a signed webhook answers TwiML that opens the stream with a per call token',
  r200.status === 200 && /text\/xml/.test(r200.headers.get('content-type') || '') &&
  twiml.includes('<Connect><Stream url="wss://maya.manasiyo.com/api/phone/stream">') &&
  twiml.includes('name="token" value="' + token + '"') && twiml.includes('name="from" value="+15105551234"'), twiml);
const st = await (await fetch(base + '/api/phone/status')).json();
ok('the status route says the line is on with no call yet', st.ok === true && st.on === true && st.calls === 0, JSON.stringify(st));

// 2. a stream with a bad token never reaches OpenAI
{
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  let closed = false; tw.on('close', () => { closed = true; });
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZbad', start: { callSid: 'CA999', customParameters: { token: 'nope', from: '+1' } } }));
  await until(() => closed, 2000);
  ok('a stream with a bad token is closed and OpenAI is never dialed', closed === true && ai.sockets.length === 0);
}

// 3. a real call
const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
const twGot = [];
tw.on('message', (raw) => { try { twGot.push(JSON.parse(raw.toString())); } catch (_) {} });
await new Promise(r => tw.on('open', r));
tw.send(JSON.stringify({ event: 'connected' }));
tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ1', start: { callSid: 'CA123', customParameters: { token, from: '+15105551234', callSid: 'CA123' } } }));
await until(() => ai.sockets.length === 1);
ok('a stream with the right token dials OpenAI with the key', ai.sockets.length === 1 && ai.sockets[0].auth === 'Bearer sk-test', JSON.stringify(ai.sockets.map(s => s.auth)));
await until(() => ai.got.some(m => m.type === 'response.create'));
const su = ai.got.find(m => m.type === 'session.update');
ok('the session is mu-law both ways, server VAD, transcription on, with save_lead and end_call',
  !!su && su.session.audio.input.format.type === 'audio/pcmu' && su.session.audio.output.format.type === 'audio/pcmu' &&
  su.session.audio.input.turn_detection.type === 'server_vad' && !!su.session.audio.input.transcription &&
  su.session.tools.map(t => t.name).join(',') === 'save_lead,end_call' && /Hi, this is Maya at Mana Siyo/.test(su.session.instructions) &&
  /calling from \+15105551234/.test(su.session.instructions), su && JSON.stringify(su.session.audio));
ok('Maya greets first: a response.create follows the session', ai.got.findIndex(m => m.type === 'response.create') > ai.got.findIndex(m => m.type === 'session.update'));
ok('the spend meter ticks once per call', spends.length === 1);
ok('no dashes in what Maya is told to say', !/[\u2014\u2013]/.test(su.session.instructions) && !PHONE_TOOLS.some(t => /[\u2014\u2013]/.test(JSON.stringify(t))));

const aiSock = ai.sockets[0].sock;
const aiSay = (o) => aiSock.send(JSON.stringify(o));
// caller audio goes to OpenAI untouched
tw.send(JSON.stringify({ event: 'media', media: { payload: 'AAAA' } }));
await until(() => ai.got.some(m => m.type === 'input_audio_buffer.append'));
ok('caller audio frames are appended to OpenAI as they are', ai.got.some(m => m.type === 'input_audio_buffer.append' && m.audio === 'AAAA'));
// Maya's audio goes to Twilio untouched
aiSay({ type: 'response.output_audio.delta', delta: 'BBBB' });
await until(() => twGot.some(m => m.event === 'media'));
ok('Maya\'s audio frames reach Twilio on the stream', twGot.some(m => m.event === 'media' && m.streamSid === 'MZ1' && m.media.payload === 'BBBB'));
// barge in
aiSay({ type: 'input_audio_buffer.speech_started' });
await until(() => twGot.some(m => m.event === 'clear'));
ok('when the caller starts talking Twilio\'s buffer is cleared and Maya\'s sentence is cancelled',
  twGot.some(m => m.event === 'clear' && m.streamSid === 'MZ1') && ai.got.some(m => m.type === 'response.cancel'));
// transcript
aiSay({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'I want a red gown for a gala in October.' });
aiSay({ type: 'response.output_audio_transcript.done', transcript: 'A red gown for October. What is your name?' });
// the lead
const before = ai.got.length;
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_1', name: 'save_lead', arguments: JSON.stringify({ name: 'Tori', wrote: 'a red gown for a gala in October', tier: 'ceremonial' }) });
await until(() => leads.length === 1);
ok('save_lead lands the caller in the station with the source phone and the caller id as the number',
  leads.length === 1 && leads[0].source === 'phone' && leads[0].name === 'Tori' && leads[0].phone === '+15105551234' && leads[0].wrote === 'a red gown for a gala in October' && leads[0].tier === 'ceremonial', JSON.stringify(leads));
await until(() => ai.got.slice(before).some(m => m.type === 'response.create'));
const fo = ai.got.slice(before).find(m => m.type === 'conversation.item.create');
ok('the tool answer goes back to OpenAI and Maya keeps talking', !!fo && fo.item.type === 'function_call_output' && fo.item.call_id === 'call_1' && /saved/.test(fo.item.output) && ai.got.slice(before).some(m => m.type === 'response.create'));
// a second save updates the same lead
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_2', name: 'save_lead', arguments: JSON.stringify({ name: 'Tori', wrote: 'a red gown for a gala in October, floor length, she is 5 foot 6', email: 'tori@example.com' }) });
await until(() => leads.length === 2);
ok('a second save_lead updates the same lead instead of adding a twin', leads.length === 2 && leads[1].id === leads[0].id && leads[1].email === 'tori@example.com');
const stMid = await (await fetch(base + '/api/phone/status')).json();
ok('the status route counts the live call', stMid.calls === 1);
// goodbye
let twClosed = false; tw.on('close', () => { twClosed = true; });
aiSay({ type: 'response.function_call_arguments.done', call_id: 'call_3', name: 'end_call', arguments: '{}' });
await until(() => twClosed, 5000);
ok('end_call hangs up after Maya\'s goodbye and the transcript is kept', twClosed === true && transcripts.length === 1 &&
  transcripts[0].callSid === 'CA123' && transcripts[0].rec.transcript.length === 2 && transcripts[0].rec.lead === leads[0].id && transcripts[0].rec.why === 'end_call', JSON.stringify(transcripts));
const stEnd = await (await fetch(base + '/api/phone/status')).json();
ok('the call is gone from the live count', stEnd.calls === 0);

// 4. a caller who talked but was never saved still lands in the station
{
  const tw2 = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw2.on('open', r));
  tw2.send(JSON.stringify({ event: 'start', streamSid: 'MZ2', start: { callSid: 'CA124', customParameters: { token: callToken(AUTH, 'CA124'), from: '+14155550123' } } }));
  await until(() => ai.sockets.length === 2);
  const s2 = ai.sockets[1].sock;
  s2.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hi, I need a suit for my wedding in December, navy, three piece.' }));
  await wait(150);
  const n = leads.length;
  tw2.send(JSON.stringify({ event: 'stop' }));
  await until(() => transcripts.length === 2);
  await wait(100);
  ok('a hang up before save_lead still lands the caller in the station from the transcript, with the caller id',
    transcripts.length === 2 && leads.length === n + 1 && leads[n].source === 'phone' && leads[n].name === 'Caller' && leads[n].phone === '+14155550123' && /navy, three piece/.test(leads[n].wrote), JSON.stringify(leads.slice(n)));
}
ok('phoneInstructions reads the character first', phoneInstructions({ character: 'X', nowLA: 'now', from: '' }).startsWith('WHO YOU ARE:\nX'));

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + ' (' + passed + ' ok)');
aiSrv.close(); server.close();
process.exit(failed ? 1 : 0);
