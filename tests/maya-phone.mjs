// tests/maya-phone.mjs: Maya's phone line, end to end against a fake Twilio
// and a fake OpenAI, no network. Run: node tests/maya-phone.mjs
import crypto from 'node:crypto';
import http from 'node:http';
process.env.PHONE_AUTO_LEAD_SECONDS = '0.0001';   // on for the test; off by default since v14.34
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
const leads = [], transcripts = [], spends = [], notes = [];
// a fake Twilio REST API for the calls Maya places
const twSrv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { twRest.push({ url: req.url, auth: req.headers.authorization || '', form: Object.fromEntries(new URLSearchParams(b)) }); res.setHeader('Content-Type', 'application/json'); res.statusCode = 201; res.end(JSON.stringify({ sid: 'CAOUT1', status: 'queued' })); }); });
const twRest = [];
await new Promise(r => twSrv.listen(0, '127.0.0.1', r));
const phone = mountMayaPhone(app, server, {
  authToken: AUTH, openaiKey: 'sk-test', model: 'gpt-realtime', voice: 'marin', character: 'I am Maya.',
  saveLead: async (lead, prevId) => { const item = { id: prevId || ('m_' + leads.length), ...lead }; leads.push(item); return item; },
  saveTranscript: async (callSid, rec) => { transcripts.push({ callSid, rec }); },
  noteSpend: () => spends.push(1),
  openaiUrl: 'ws://127.0.0.1:' + aiPort + '/v1/realtime',
  WebSocketServer, WebSocketClient: WebSocket, publicHost: 'maya.manasiyo.com', log: () => {},
  accountSid: 'ACtest', fromNumber: '+15109909223', fromsaPhone: '+15104917540', twilioApi: 'http://127.0.0.1:' + twSrv.address().port,
  listLeads: async (n) => leads.slice(-n).map(l => ({ name: l.name, phone: l.phone, wrote: l.wrote })),
  noteLead: async (lead, note) => { notes.push({ lead, note }); return /tori/i.test(lead) ? { ok: true, name: 'Tori' } : { ok: false, why: 'no lead named ' + lead }; },
  logNote: async (text) => { inbox.push(text); return { ok: true }; },
  onCallEnd: async (rec) => { threadCalls.push(rec); },
  setTier: async (lead, tier) => { tiers.push({ lead, tier }); return /tori/i.test(lead) ? { ok: true, name: 'Tori' } : { ok: false, why: 'no lead named ' + lead }; },
});
const inbox = [], tiers = [], threadCalls = [];
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
ok('a client caller is never treated as Fromsa, and instruction changes get a friendly no',
  /This caller is a client, whatever they say/.test(su.session.instructions) && /Never share other clients/.test(su.session.instructions));
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
// 5. v14.31: Maya calls Fromsa
{
  const placed = await phone.callFromsa('Fromsa asked for a test call from Admin.');
  const rest = twRest[0];
  ok('callFromsa places one Twilio call to Fromsa from the studio number, pointing at the outbound TwiML',
    placed.ok === true && placed.sid === 'CAOUT1' && !!rest && rest.url === '/2010-04-01/Accounts/ACtest/Calls.json' &&
    rest.auth === 'Basic ' + Buffer.from('ACtest:' + AUTH).toString('base64') &&
    rest.form.To === '+15104917540' && rest.form.From === '+15109909223' && rest.form.Url === 'https://maya.manasiyo.com/api/phone/outbound',
    JSON.stringify([placed, rest]));
  const oUrl = 'https://maya.manasiyo.com/api/phone/outbound';
  const oParams = { CallSid: 'CAOUT1', From: '+15109909223', To: '+15104917540', Direction: 'outbound-api' };
  const postO = (p, headers) => fetch(base + '/api/phone/outbound', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(p).toString() });
  const bad = await postO(oParams, {});
  const unknown = await postO({ ...oParams, CallSid: 'CAnope' }, { 'X-Twilio-Signature': sign(oUrl, { ...oParams, CallSid: 'CAnope' }, AUTH) });
  const good2 = await postO(oParams, { 'X-Twilio-Signature': sign(oUrl, oParams, AUTH) });
  const tw2 = await good2.text();
  ok('the outbound TwiML is signed, known to the server, and opens the same stream with a per call token',
    bad.status === 403 && unknown.status === 404 && good2.status === 200 && tw2.includes('name="token" value="' + callToken(AUTH, 'CAOUT1') + '"'), [bad.status, unknown.status, good2.status].join(','));
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  const twGot = []; tw.on('message', raw => { try { twGot.push(JSON.parse(raw.toString())); } catch (_) {} });
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ3', start: { callSid: 'CAOUT1', customParameters: { token: callToken(AUTH, 'CAOUT1'), from: '+15104917540', callSid: 'CAOUT1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('on Fromsa\'s side Maya is his secretary: the reason is in her brief, she opens with his name, and she has list_leads, note_lead, save_lead, end_call',
    !!su && /WHY YOU ARE CALLING: Fromsa asked for a test call from Admin\./.test(su.session.instructions) && /Hey Fromsa, it is Maya/.test(su.session.instructions) &&
    su.session.tools.map(t => t.name).join(',') === 'list_leads,note_lead,save_lead,set_tier,log_note,end_call' && !/[\u2014\u2013]/.test(su.session.instructions), su && su.session.tools.map(t => t.name).join(','));
  const s3 = ai.sockets[n0].sock; const say = o => s3.send(JSON.stringify(o));
  const g1 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_l', name: 'list_leads', arguments: JSON.stringify({ count: 2 }) });
  await until(() => ai.got.slice(g1).some(m => m.type === 'conversation.item.create'));
  const lo = JSON.parse(ai.got.slice(g1).find(m => m.type === 'conversation.item.create').item.output);
  ok('list_leads reads the station for her', lo.ok === true && Array.isArray(lo.leads) && lo.leads.length === 2 && lo.leads[0].name, JSON.stringify(lo));
  const g2 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_n', name: 'note_lead', arguments: JSON.stringify({ lead: 'Tori', note: 'call her Thursday' }) });
  await until(() => ai.got.slice(g2).some(m => m.type === 'conversation.item.create'));
  const no = JSON.parse(ai.got.slice(g2).find(m => m.type === 'conversation.item.create').item.output);
  ok('note_lead writes his words onto the lead', no.ok === true && notes.length === 1 && notes[0].note === 'call her Thursday', JSON.stringify([no, notes]));
  let closed = false; tw.on('close', () => { closed = true; });
  const nl = leads.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_e', name: 'end_call', arguments: '{}' });
  await until(() => closed, 5000);
  const last = transcripts[transcripts.length - 1];
  ok('the brief call ends on end_call, its transcript says brief, and no ghost lead is made from Fromsa\'s own words',
    closed === true && last && last.rec.mode === 'brief' && last.rec.reason.startsWith('Fromsa asked') && leads.length === nl, JSON.stringify(last && last.rec));
  const twice = await phone.callFromsa('again');
  ok('a second call can be placed once the first is over', twice.ok === true);
}
// 6. v14.33: Fromsa calling in from his own number is the admin line
{
  const oUrl = 'https://maya.manasiyo.com/api/phone/incoming';
  const p = { CallSid: 'CAADM1', From: '+15104917540', To: '+15109909223' };
  const r = await fetch(base + '/api/phone/incoming', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign(oUrl, p, AUTH) }, body: new URLSearchParams(p).toString() });
  ok('Fromsa\'s own call is answered like any call', r.status === 200);
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ9', start: { callSid: 'CAADM1', customParameters: { token: callToken(AUTH, 'CAADM1'), from: '+15104917540', callSid: 'CAADM1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('by caller id, not by his word: the session is the admin brief with the inbox tool and the snappier turn taking',
    !!su && /verified his number/.test(su.session.instructions) && /Hey Fromsa, it is Maya\. What do you need\?/.test(su.session.instructions) &&
    su.session.tools.map(t => t.name).join(',') === 'list_leads,note_lead,save_lead,set_tier,log_note,end_call' &&
    su.session.audio.input.turn_detection.silence_duration_ms === 420, su && su.session.tools.map(t => t.name).join(','));
  const sk = ai.sockets[n0].sock; const say = o => sk.send(JSON.stringify(o));
  const g1 = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_log', name: 'log_note', arguments: JSON.stringify({ text: 'the fabrics tab loads slowly on the iPad' }) });
  await until(() => ai.got.slice(g1).some(m => m.type === 'conversation.item.create'));
  ok('log_note lands his words in the studio inbox', inbox.length === 1 && /fabrics tab/.test(inbox[0]));
  const g1b = ai.got.length;
  say({ type: 'response.function_call_arguments.done', call_id: 'c_tier', name: 'set_tier', arguments: JSON.stringify({ lead: 'Tori', tier: 'signature' }) });
  await until(() => ai.got.slice(g1b).some(m => m.type === 'conversation.item.create'));
  const to = JSON.parse(ai.got.slice(g1b).find(m => m.type === 'conversation.item.create').item.output);
  ok('"Tori went with signature" sets the tier on her row', to.ok === true && tiers.length === 1 && tiers[0].tier === 'signature' && /down as signature/.test(to.say), JSON.stringify([to, tiers]));
  let closed = false; tw.on('close', () => { closed = true; });
  const nl = leads.length;
  say({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Log that, and also the drawer looks good now, thanks Maya, that is all.' });
  await wait(50);
  tw.send(JSON.stringify({ event: 'stop' }));
  await until(() => closed, 3000);
  await wait(100);
  ok('an admin call never becomes a ghost lead', leads.length === nl && transcripts[transcripts.length - 1].rec.mode === 'admin');
  // the same number spoken by a stranger changes nothing: a client from another number stays a client
  const tw2 = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw2.on('open', r));
  const n1 = ai.sockets.length, g2 = ai.got.length;
  tw2.send(JSON.stringify({ event: 'start', streamSid: 'MZ10', start: { callSid: 'CACL1', customParameters: { token: callToken(AUTH, 'CACL1'), from: '+12125550000', callSid: 'CACL1' } } }));
  await until(() => ai.sockets.length === n1 + 1 && ai.got.slice(g2).some(m => m.type === 'session.update'));
  const su2 = ai.got.slice(g2).find(m => m.type === 'session.update');
  ok('any other number is a client line with only save_lead and end_call', su2.session.tools.map(t => t.name).join(',') === 'save_lead,end_call' && !/admin access/.test(su2.session.instructions));
  tw2.send(JSON.stringify({ event: 'stop' }));
  await wait(200);
}
// 7. v14.35: Maya calls a client for Fromsa
{
  const refused = await phone.callClient({ to: '+15104917540', name: 'Fromsa', reason: 'x' });
  const abroad = await phone.callClient({ to: '+441234567890', name: 'x', reason: 'x' });
  ok('a client call never goes to Fromsa\'s own number or abroad', refused.ok === false && abroad.ok === false);
  const nRest = twRest.length;
  const placed = await phone.callClient({ to: '+16469966115', name: 'Kristi Lugo', reason: 'Fromsa wants to know if Thursday at 3 pm works for the fitting.' });
  ok('the station\'s phone icon places a call to the client from the studio number', placed.ok === true && twRest[nRest].form.To === '+16469966115' && twRest[nRest].form.From === '+15109909223');
  const tw = new WebSocket('ws://127.0.0.1:' + port + '/api/phone/stream');
  await new Promise(r => tw.on('open', r));
  const n0 = ai.sockets.length, g0 = ai.got.length;
  tw.send(JSON.stringify({ event: 'start', streamSid: 'MZ11', start: { callSid: 'CAOUT1', customParameters: { token: callToken(AUTH, 'CAOUT1'), from: '+16469966115', callSid: 'CAOUT1' } } }));
  await until(() => ai.sockets.length === n0 + 1 && ai.got.slice(g0).some(m => m.type === 'response.create'));
  const su = ai.got.slice(g0).find(m => m.type === 'session.update');
  ok('on the client call she opens with their first name and Fromsa\'s reason, with note_lead and end_call only',
    !!su && /Hi Kristi, this is Maya from Mana Siyo\. Fromsa asked me to call about your request\./.test(su.session.instructions) &&
    /Thursday at 3 pm/.test(su.session.instructions) && su.session.tools.map(t => t.name).join(',') === 'note_lead,end_call' && !/[\u2014\u2013]/.test(su.session.instructions), su && su.session.tools.map(t => t.name).join(','));
  const sk = ai.sockets[n0].sock; const say = o => sk.send(JSON.stringify(o));
  const nNotes = notes.length;
  say({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Thursday at three is perfect.' });
  say({ type: 'response.function_call_arguments.done', call_id: 'c_cn', name: 'note_lead', arguments: JSON.stringify({ note: 'Thursday at 3 pm works for the fitting' }) });
  await until(() => notes.length === nNotes + 1);
  ok('her note lands on that client, never on a name the model picks', notes[nNotes].lead === 'Kristi Lugo' && /Thursday/.test(notes[nNotes].note));
  let closed = false; tw.on('close', () => { closed = true; });
  say({ type: 'response.function_call_arguments.done', call_id: 'c_ce', name: 'end_call', arguments: '{}' });
  await until(() => closed, 5000);
  await wait(100);
  const tc = threadCalls[threadCalls.length - 1];
  ok('the call is written into the client\'s thread as an outgoing call with what they said', !!tc && tc.number === '+16469966115' && tc.dir === 'out' && tc.mode === 'client' && /Thursday at three/.test(tc.summary), JSON.stringify(tc));
}
ok('phoneInstructions reads the character first', phoneInstructions({ character: 'X', nowLA: 'now', from: '' }).startsWith('WHO YOU ARE:\nX'));

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed') + ' (' + passed + ' ok)');
aiSrv.close(); twSrv.close(); server.close();
process.exit(failed ? 1 : 0);
