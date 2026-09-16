// maya-phone.mjs: Maya answers the studio's phone number.
//
// v14.30. Twilio rings the number, asks this server what to do
// (POST /api/phone/incoming), and the answer is TwiML that opens a Media
// Stream: a WebSocket from Twilio to /api/phone/stream carrying the
// caller's voice as 8 kHz mu-law, 20 ms a frame. This file bridges that
// stream to the OpenAI Realtime API over a second WebSocket in the same
// mu-law (audio/pcmu), so no audio is resampled anywhere. Maya speaks, the
// caller interrupts her (barge in clears Twilio's buffer and cancels her
// sentence), and when she has what she needs she calls save_lead, which
// lands the caller in the Lead Station with the source PHONE. Every call's
// transcript is written to storage under maya/phone/, so nothing a caller
// says is lost even if the lead was never saved.
//
// Nothing here trusts the network: the webhook is checked against Twilio's
// signature (X-Twilio-Signature, HMAC SHA1 of the URL and the sorted form
// fields with the auth token), and the stream is accepted only with the
// per call token the webhook itself minted (HMAC SHA256 of the CallSid).
// Caps: PHONE_MAX_MINUTES per call (default 10), PHONE_MAX_CALLS at once
// (default 3). With no TWILIO_AUTH_TOKEN, or no `ws` package, the line is
// simply off and the server says so once at boot.
//
// No dashes of any kind in anything Maya says.

import crypto from 'node:crypto';

const MAX_MINUTES = Number(process.env.PHONE_MAX_MINUTES || 10);
const MAX_CALLS = Number(process.env.PHONE_MAX_CALLS || 3);
const autoLeadS = () => Number(process.env.PHONE_AUTO_LEAD_SECONDS ?? 25);   // a caller who talked this long and was never saved is saved from the transcript

export function twilioSignatureValid(authToken, url, params, signature) {
  if (!authToken || !signature) return false;
  const data = url + Object.keys(params || {}).sort().map(k => k + String(params[k] ?? '')).join('');
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature))); }
  catch (_) { return false; }
}

export function callToken(authToken, callSid) {
  return crypto.createHmac('sha256', String(authToken || '')).update(String(callSid || '')).digest('hex').slice(0, 40);
}

function xmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function phoneInstructions({ character, nowLA, from }) {
  const who = character ? 'WHO YOU ARE:\n' + character + '\n\n' : '';
  return who +
    'You are Maya, answering the studio phone line of Mana Siyo, a design studio in San Francisco that makes ' +
    'one of a kind custom clothing in as little as 24 hours, because pattern making, cutting and sewing sit under one roof. ' +
    'It is ' + nowLA + ' in San Francisco. You are on a live phone call with someone you have not met' +
    (from ? ', calling from ' + from : '') + '. ' +
    'Speak like a warm, sharp person on the phone: one or two short sentences, then listen. Never spell out web ' +
    'addresses; say "maya dot manasiyo dot com". No lists, no bullet points, no dashes; say "and" or start a new sentence.\n\n' +
    'THE CALL. Open with: "Hi, this is Maya at Mana Siyo. What are you picturing?" Then learn, one question at a time and ' +
    'only what they have not already told you: what they are picturing (the garment, the occasion, when they need it), ' +
    'their first name, and whether the number they are calling from is the best one to reach them (you already have it). ' +
    'Take an email only if they offer one. As soon as you have the piece and a name, call save_lead once with everything ' +
    'you know, then tell them Fromsa, the founder, will call them back, usually the same day. If they add something ' +
    'important after that, call save_lead again with the fuller note.\n' +
    'PRICES. Custom pieces are quoted after a short consultation, and Fromsa gives the number on the call back. Never ' +
    'invent a price or a delivery date; "as little as 24 hours" is the studio\'s speed, not a promise for their piece.\n' +
    'DESIGNING THEMSELVES. If they want to see it first, tell them about maya dot manasiyo dot com, where they can ' +
    'describe a garment out loud and see it on themselves, free.\n' +
    'THE STUDIO. 655 Bryant Street in SoMa, San Francisco. Visits are by appointment, which Fromsa sets on the call back.\n' +
    'WHEN TO STOP. If the caller is a robot, a sales call, or silent for a long while, be brief and end the call. When ' +
    'the conversation is done, say goodbye in one sentence and then call end_call.';
}

export const PHONE_TOOLS = [
  { type: 'function', name: 'save_lead',
    description: 'Save this caller in the studio Lead Station so Fromsa calls them back. Call it as soon as you have what they are picturing and a name; call it again if they add something important.',
    parameters: { type: 'object', properties: {
      name: { type: 'string', description: 'their name as they said it' },
      phone: { type: 'string', description: 'the best number to reach them; the caller id if they did not give another' },
      email: { type: 'string', description: 'their email, only if they offered one' },
      wrote: { type: 'string', description: 'what they are picturing, in their own words: the piece, the occasion, the timing, anything that matters' },
      tier: { type: 'string', description: 'the kind of piece if clear: ceremonial, everyday, a gown, a suit, alterations' } },
      required: ['name', 'wrote'] } },
  { type: 'function', name: 'end_call',
    description: 'Hang up. Only after you have said goodbye.',
    parameters: { type: 'object', properties: {} } },
];

// mountMayaPhone(app, server, deps): wires the webhook and the stream.
// deps: { authToken, openaiKey, model, voice, character, saveLead(lead),
//         saveTranscript(callSid, record), noteSpend(), log(), openaiUrl,
//         WebSocketServer, WebSocketClient (from ws), publicHost }
export function mountMayaPhone(app, server, deps) {
  const log = deps.log || ((...a) => console.log('[phone]', ...a));
  const authToken = deps.authToken || '';
  const live = new Map();   // callSid -> { streamSid, ai, twilio, timers }

  const incoming = (req, res) => {
    const params = req.body || {};
    const host = deps.publicHost || req.get('x-forwarded-host') || req.get('host') || '';
    const url = 'https://' + host + (req.originalUrl || '/api/phone/incoming');
    if (!authToken || !deps.openaiKey || !deps.WebSocketServer) {
      log('line off: missing', !authToken ? 'TWILIO_AUTH_TOKEN' : !deps.openaiKey ? 'OPENAI_API_KEY' : 'ws package');
      res.set('Content-Type', 'text/xml');
      return res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>The studio line is not set up yet. Please try again later.</Say></Response>');
    }
    if (!twilioSignatureValid(authToken, url, params, req.get('X-Twilio-Signature'))) {
      log('rejected: bad signature for', url);
      return res.status(403).send('forbidden');
    }
    if (live.size >= MAX_CALLS) {
      res.set('Content-Type', 'text/xml');
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Maya is on another call right now. Please call back in a few minutes.</Say></Response>');
    }
    const callSid = String(params.CallSid || '');
    const from = String(params.From || '');
    const token = callToken(authToken, callSid);
    const streamUrl = 'wss://' + host + '/api/phone/stream';
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="' + xmlEscape(streamUrl) + '">' +
      '<Parameter name="token" value="' + xmlEscape(token) + '"/>' +
      '<Parameter name="from" value="' + xmlEscape(from) + '"/>' +
      '<Parameter name="callSid" value="' + xmlEscape(callSid) + '"/>' +
      '</Stream></Connect></Response>');
  };
  app.post('/api/phone/incoming', incoming);
  app.get('/api/phone/status', (req, res) => res.json({ ok: true, on: !!(authToken && deps.openaiKey && deps.WebSocketServer), calls: live.size }));

  if (!deps.WebSocketServer || !server) { log('line off at boot: no WebSocket server'); return { live }; }
  const wss = new deps.WebSocketServer({ server, path: '/api/phone/stream' });

  wss.on('connection', (tw) => {
    const call = { callSid: '', streamSid: '', from: '', ai: null, open: false, started: Date.now(),
                   transcript: [], saved: null, leadCalls: 0, timers: [], done: false };
    const send = (obj) => { try { if (tw.readyState === 1) tw.send(JSON.stringify(obj)); } catch (_) {} };
    const aiSend = (obj) => { try { if (call.ai && call.ai.readyState === 1) call.ai.send(JSON.stringify(obj)); } catch (_) {} };
    const finish = async (why) => {
      if (call.done) return; call.done = true;
      for (const t of call.timers) clearTimeout(t);
      live.delete(call.callSid);
      try { if (call.ai) call.ai.close(); } catch (_) {}
      try { tw.close(); } catch (_) {}
      const seconds = Math.round((Date.now() - call.started) / 1000);
      log('call ended', call.callSid, why, seconds + 's', 'lead:', call.saved ? call.saved.id : 'none');
      // a caller who talked for a while and was never saved still lands in the station
      try {
        const said = call.transcript.filter(t => t.who === 'caller').map(t => t.text).join(' ').trim();
        if (!call.saved && seconds >= autoLeadS() && said.length >= 20 && deps.saveLead) {
          call.saved = await deps.saveLead({ source: 'phone', name: 'Caller', phone: call.from, wrote: said.slice(0, 400) + ' (from the call transcript; Maya did not get a name)' });
        }
      } catch (e) { log('auto lead failed', e.message); }
      try {
        if (deps.saveTranscript && call.callSid && call.open) await deps.saveTranscript(call.callSid, {
          callSid: call.callSid, from: call.from, startedAt: new Date(call.started).toISOString(), seconds, why,
          lead: call.saved ? call.saved.id : null, transcript: call.transcript });
      } catch (e) { log('transcript save failed', e.message); }
    };

    const openAi = () => {
      const url = (deps.openaiUrl || 'wss://api.openai.com/v1/realtime') + '?model=' + encodeURIComponent(deps.model || 'gpt-realtime');
      let ai;
      const WSClient = deps.WebSocketClient || globalThis.WebSocket;
      try { ai = new WSClient(url, { headers: { Authorization: 'Bearer ' + deps.openaiKey } }); }
      catch (e) { log('openai socket failed', e.message); return finish('openai_socket'); }
      call.ai = ai;
      ai.addEventListener('open', () => {
        const nowLA = new Intl.DateTimeFormat('en-US', { timeZone: process.env.WIX_TZ || 'America/Los_Angeles',
          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
        aiSend({ type: 'session.update', session: {
          type: 'realtime',
          instructions: phoneInstructions({ character: deps.character || '', nowLA, from: call.from }),
          output_modalities: ['audio'],
          audio: { input: { format: { type: 'audio/pcmu' },
                            transcription: { model: process.env.PHONE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' },
                            turn_detection: { type: 'server_vad', silence_duration_ms: 650, prefix_padding_ms: 300 } },
                   output: { format: { type: 'audio/pcmu' }, voice: deps.voice || 'marin' } },
          tools: PHONE_TOOLS, tool_choice: 'auto' } });
        aiSend({ type: 'response.create', response: { instructions: 'Greet the caller now, exactly as THE CALL says, in one sentence.' } });
        try { if (deps.noteSpend) deps.noteSpend(); } catch (_) {}
      });
      ai.addEventListener('message', async (ev) => {
        let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch (_) { return; }
        const t = m.type || '';
        if (t === 'response.output_audio.delta' || t === 'response.audio.delta') {
          if (call.streamSid && m.delta) send({ event: 'media', streamSid: call.streamSid, media: { payload: m.delta } });
        } else if (t === 'input_audio_buffer.speech_started') {
          if (call.streamSid) send({ event: 'clear', streamSid: call.streamSid });
          aiSend({ type: 'response.cancel' });
        } else if (t === 'conversation.item.input_audio_transcription.completed') {
          if (m.transcript) call.transcript.push({ who: 'caller', text: String(m.transcript).trim(), ts: Date.now() });
        } else if (t === 'response.output_audio_transcript.done' || t === 'response.audio_transcript.done') {
          if (m.transcript) call.transcript.push({ who: 'maya', text: String(m.transcript).trim(), ts: Date.now() });
        } else if (t === 'response.function_call_arguments.done') {
          let args = {}; try { args = JSON.parse(m.arguments || '{}'); } catch (_) {}
          let output = { ok: true };
          if (m.name === 'save_lead') {
            try {
              call.leadCalls += 1;
              if (call.leadCalls > 4) { output = { ok: false, say: 'the lead is already saved' }; }
              else {
                const lead = { source: 'phone', name: args.name, phone: args.phone || call.from, email: args.email || '', tier: args.tier || '', wrote: args.wrote || '' };
                call.saved = deps.saveLead ? await deps.saveLead(lead, call.saved ? call.saved.id : null) : { id: 'none' };
                output = { ok: true, say: 'saved; tell them Fromsa will call back, usually the same day' };
              }
            } catch (e) { log('save_lead failed', e.message); output = { ok: false, say: 'the station did not answer; tell them you have their number and Fromsa will call back' }; }
          } else if (m.name === 'end_call') {
            output = { ok: true };
            call.timers.push(setTimeout(() => finish('end_call'), 2500));
          }
          aiSend({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: m.call_id, output: JSON.stringify(output) } });
          if (m.name !== 'end_call') aiSend({ type: 'response.create' });
        } else if (t === 'error') {
          const code = m.error && m.error.code;
          if (code !== 'response_cancel_not_active') log('openai error', JSON.stringify(m.error || m).slice(0, 300));
        }
      });
      ai.addEventListener('close', () => { if (!call.done) finish('openai_closed'); });
      ai.addEventListener('error', (e) => { log('openai socket error', (e && e.message) || ''); });
    };

    tw.on('message', (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
      const ev = m.event;
      if (ev === 'start') {
        const s = m.start || {};
        const cp = s.customParameters || {};
        call.callSid = String(s.callSid || cp.callSid || '');
        call.streamSid = String(m.streamSid || s.streamSid || '');
        call.from = String(cp.from || '');
        const want = callToken(authToken, call.callSid);
        if (!cp.token || String(cp.token) !== want) { log('stream rejected: bad token', call.callSid); return finish('bad_token'); }
        if (live.size >= MAX_CALLS) return finish('busy');
        live.set(call.callSid, call);
        call.open = true;
        log('call started', call.callSid, 'from', call.from ? call.from.replace(/\d(?=\d{4})/g, 'x') : '?');
        call.timers.push(setTimeout(() => finish('max_minutes'), MAX_MINUTES * 60000));
        openAi();
      } else if (ev === 'media') {
        if (call.open && m.media && m.media.payload) aiSend({ type: 'input_audio_buffer.append', audio: m.media.payload });
      } else if (ev === 'stop') {
        finish('caller_hung_up');
      }
    });
    tw.on('close', () => { if (!call.done) finish('twilio_closed'); });
    tw.on('error', () => { if (!call.done) finish('twilio_error'); });
  });

  log('line on: /api/phone/incoming and /api/phone/stream');
  return { live, wss };
}
