// Customer handoff: dial only the configured owner and require a keypress so
// a customer's call cannot be connected to the owner's voicemail.
import { twilioSignatureValid } from './maya-phone.mjs';
const xml = v => String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const response = body => '<?xml version="1.0" encoding="UTF-8"?><Response>' + body + '</Response>';

export function mountTransfers(app, deps) {
  const base = 'https://' + deps.publicHost;
  const signed = (req, res) => {
    if (twilioSignatureValid(deps.authToken, base + req.originalUrl, req.body || {}, req.get('X-Twilio-Signature'))) return true;
    res.status(403).send('forbidden'); return false;
  };
  app.post('/api/phone/transfer/screen', deps.urlencoded, async (req, res) => {
    if (!signed(req, res)) return;
    try {
      const context = await deps.load(String(req.query.call || ''));
      if (!context || Date.now() - context.ts > 15 * 60000) return res.type('text/xml').send(response('<Hangup/>'));
      const intro = context.name + ' is calling about ' + context.request + '. Press 1 to accept, or hang up to decline.';
      res.type('text/xml').send(response('<Gather input="dtmf" numDigits="1" timeout="8" action="' + base + '/api/phone/transfer/accept" method="POST"><Say>' + xml(intro) + '</Say></Gather><Hangup/>'));
    } catch (_) { res.status(503).send('handoff unavailable'); }
  });
  app.post('/api/phone/transfer/accept', deps.urlencoded, (req, res) => {
    if (!signed(req, res)) return;
    res.type('text/xml').send(response(req.body?.Digits === '1' ? '' : '<Hangup/>'));
  });
  app.post('/api/phone/transfer/result', deps.urlencoded, async (req, res) => {
    if (!signed(req, res)) return;
    const connected = req.body?.DialCallStatus === 'completed';
    res.type('text/xml').send(response(connected ? '<Hangup/>' : '<Say>Fromsa is unavailable right now. Your callback request is saved. Thank you for calling Mana Siyo.</Say><Hangup/>'));
  });
  return async ({ callSid, name, request, from }) => {
    if (!deps.fromsaPhone || !deps.fromNumber || !deps.accountSid || !deps.authToken || !deps.publicHost) return { ok: false, why: 'Live transfer is unavailable. Offer a callback.' };
    if (!/^CA[a-zA-Z0-9]+$/.test(callSid)) return { ok: false, why: 'No active call.' };
    await deps.save(callSid, { name: String(name || 'A customer').slice(0, 120), request: String(request || 'a studio inquiry').slice(0, 240), from, ts: Date.now() });
    const twiml = response('<Say>One moment while I connect you.</Say><Dial answerOnBridge="true" timeout="20" callerId="' + xml(deps.fromNumber) + '" action="' + base + '/api/phone/transfer/result" method="POST"><Number url="' + base + '/api/phone/transfer/screen?call=' + encodeURIComponent(callSid) + '" method="POST">' + xml(deps.fromsaPhone) + '</Number></Dial>');
    const url = (deps.twilioApi || 'https://api.twilio.com') + '/2010-04-01/Accounts/' + encodeURIComponent(deps.accountSid) + '/Calls/' + encodeURIComponent(callSid) + '.json';
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { Authorization: 'Basic ' + Buffer.from(deps.accountSid + ':' + deps.authToken).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Twiml: twiml }) });
    if (!r.ok) return { ok: false, why: 'The transfer did not start. Offer a callback.' };
    return { ok: true };
  };
}
