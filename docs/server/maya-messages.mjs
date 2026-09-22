// maya-messages.mjs: the studio's text threads, one per phone number.
//
// v14.35. Every text in or out of the studio number, and every call, lands
// in one thread per number, kept in storage under maya/sms/threads.json.
// Admin reads the threads in the drawer's Messages tab, like a phone; a
// text typed there goes out through Twilio from the studio number; a text
// that comes in arrives through Twilio's messaging webhook and lands in the
// same thread. Calls Maya took or placed are written into the thread too,
// so the history reads in one place.
//
// Consent lives on the thread: `consent` is 'asked' after the first text
// (the one that asks "okay to text you here about it?"), 'yes' once the
// person answers anything that is not a no, 'stop' on STOP or a no. Nothing
// is sent once it is 'stop'. An admin-composed text is not automatically a
// consent question. Twilio's own STOP handling still applies on top.
//
// No dashes of any kind in anything a client reads.

import crypto from 'node:crypto';
import { twilioSignatureValid } from './maya-phone.mjs';

export const THREADS_PATH = 'maya/sms/threads.json';
const MAX_MESSAGES = 400;
const STATUS_RANK = { accepted: 0, queued: 1, sending: 2, sent: 3, delivered: 4, undelivered: 4, failed: 4 };
function applyStatus(message, update) {
  if ((STATUS_RANK[message.status] ?? -1) < 4 && STATUS_RANK[update.status] >= (STATUS_RANK[message.status] ?? -1)) {
    message.status = update.status;
    if (update.errorCode) message.errorCode = String(update.errorCode);
  }
}

export const digits = (v) => String(v || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
export function e164(v) {
  const d = digits(v);
  return d.length === 10 ? '+1' + d : (String(v || '').trim().startsWith('+') ? String(v).trim() : (d ? '+' + d : ''));
}
export function isNo(text) {
  const t = String(text || '').trim().toLowerCase();
  return /^(stop|stopall|unsubscribe|cancel|end|quit|no|no thanks|no thank you|please stop|don't|do not)\b/.test(t);
}
export function isYes(text) {
  const t = String(text || '').trim().toLowerCase();
  if (isNo(t)) return false;
  return t.length > 0;   // any reply that is not a no is a yes to "okay to text you here?"
}

// createMessageStore({ load, save, log }) -> the store. load() returns the
// parsed JSON or null; save(obj) writes it. Both are the server's GCS helpers.
export function createMessageStore(deps) {
  const log = deps.log || ((...a) => console.log('[messages]', ...a));
  let queue = Promise.resolve();
  const locked = (fn) => { const retry = async () => { for (let n=0; ; n++) { try { return await fn(); } catch(e) { if (e.status !== 412 || n >= 4) throw e; } } }; const next = queue.then(retry, retry); queue = next.catch(() => {}); return next; };
  const empty = () => ({ threads: {} });
  async function read() {
    const j = await deps.load();
    if (j == null) return empty();
    if (!j.threads || typeof j.threads !== 'object') throw new Error('invalid message store');
    return structuredClone(j);
  }
  async function write(rec) { await deps.save(rec); }

  function thread(rec, number, name) {
    const key = e164(number);
    if (!key) return null;
    if (!rec.threads[key]) rec.threads[key] = { number: key, name: '', messages: [], consent: 'none', unread: 0, updatedAt: null };
    const t = rec.threads[key];
    if (name && !t.name) t.name = String(name).slice(0, 120);
    return t;
  }
  function push(t, m) {
    t.messages.push(m);
    if (t.messages.length > MAX_MESSAGES) t.messages = t.messages.slice(-MAX_MESSAGES);
    t.updatedAt = m.ts; t.deleted = false;
  }

  return {
    // a text that came in through Twilio
    async inbound({ from, text, sid }) {
      return locked(async () => {
        const rec = await read();
        const t = thread(rec, from);
        if (!t) return null;
        if (sid && t.messages.some(m => m.id === sid)) return { number: t.number, duplicate: true };
        if (t.blocked) return { number: t.number, blocked: true };
        t.deleted = false;
        const ts = new Date().toISOString();
        push(t, { id: sid || crypto.randomBytes(6).toString('hex'), dir: 'in', kind: 'sms', text: String(text || '').slice(0, 1600), ts });
        t.unread = (t.unread || 0) + 1;
        if (isNo(text)) t.consent = 'stop';
        else if (t.consent === 'asked' || t.consent === 'none') t.consent = 'yes';
        await write(rec);
        return { number: t.number, consent: t.consent };
      });
    },
    // a text the studio sent (already accepted by Twilio); asks = it was the consent question
    async outbound({ to, text, sid, status, asks, name, by }) {
      return locked(async () => {
        const rec = await read();
        const t = thread(rec, to, name);
        if (!t) return null;
        const ts = new Date().toISOString();
        if (sid && t.messages.some(m => m.id === sid)) return { number: t.number, duplicate: true };
        const message = { id: sid || crypto.randomBytes(6).toString('hex'), dir: 'out', kind: 'sms', text: String(text || '').slice(0, 1600), ts, status: status || 'queued', by: by || 'fromsa' };
        // A carrier callback can beat the response to the original send.
        if (sid && rec.pendingStatuses?.[sid]) {
          applyStatus(message, rec.pendingStatuses[sid]);
          delete rec.pendingStatuses[sid];
        }
        push(t, message);
        if (asks && t.consent === 'none') t.consent = 'asked';
        await write(rec);
        return { number: t.number, consent: t.consent };
      });
    },
    // a call, either way
    async call({ number, dir, seconds, mode, summary, name }) {
      return locked(async () => {
        const rec = await read();
        const t = thread(rec, number, name);
        if (!t) return null;
        const ts = new Date().toISOString();
        push(t, { id: crypto.randomBytes(6).toString('hex'), dir, kind: 'call', seconds: Number(seconds) || 0, mode: mode || '', text: String(summary || '').slice(0, 400), ts });
        await write(rec);
        return { number: t.number };
      });
    },
    async name(number, name) {
      return locked(async () => { const rec = await read(); const t = thread(rec, number, name); if (t) { t.name = String(name || '').trim().slice(0, 120); t.deleted = false; } await write(rec); });
    },
    async block(number, blocked) {
      return locked(async () => { const rec = await read(); const t = thread(rec, number); if (!t) throw new Error('invalid number'); t.blocked = blocked; await write(rec); });
    },
    async remove(number) {
      return locked(async () => { const rec = await read(); const t = thread(rec, number); if (!t) throw new Error('invalid number'); t.messages = []; t.unread = 0; t.deleted = true; await write(rec); });
    },
    async status({ sid, status, errorCode }) {
      if (!Object.hasOwn(STATUS_RANK, status) || !/^SM[a-zA-Z0-9]+$/.test(String(sid || ''))) return;
      return locked(async () => { const rec = await read();
        for (const t of Object.values(rec.threads)) {
          const m = t.messages.find(m => m.id === sid && m.dir === 'out');
          if (!m) continue;
          applyStatus(m, { status, errorCode });
          await write(rec);
          return;
        }
        const pending = rec.pendingStatuses || {};
        const update = pending[sid] || { ts: Date.now() };
        applyStatus(update, { status, errorCode });
        pending[sid] = update;
        rec.pendingStatuses = Object.fromEntries(Object.entries(pending)
          .filter(([, value]) => Date.now() - value.ts < 86400000).slice(-1000));
        await write(rec);
      });
    },
    async markRead(number) {
      return locked(async () => { const rec = await read(); const t = rec.threads[e164(number)]; if (t) { t.unread = 0; await write(rec); } });
    },
    async list() {
      const rec = await read();
      return Object.values(rec.threads).filter(t => !t.deleted || t.blocked)
        .map(t => { const last = t.messages[t.messages.length - 1] || null; return { number: t.number, name: t.name, blocked: !!t.blocked, consent: t.consent, unread: t.unread || 0, updatedAt: t.updatedAt, last: last ? { dir: last.dir, kind: last.kind, text: last.text, ts: last.ts, seconds: last.seconds } : null }; })
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    },
    async get(number) {
      const rec = await read();
      return rec.threads[e164(number)] || null;
    },
    async consent(number) {
      const rec = await read();
      const t = rec.threads[e164(number)];
      return t ? t.consent : 'none';
    },
  };
}

// sendSms(deps, { to, text }): one text through Twilio from the studio number.
// deps: { accountSid, authToken, fromNumber, messagingSid, twilioApi }
export async function sendSms(deps, { to, text }) {
  if (!deps.accountSid || !deps.authToken || !(deps.fromNumber || deps.messagingSid)) return { ok: false, why: 'texting needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and the studio number' };
  const dest = e164(to);
  if (!/^\+1\d{10}$/.test(dest)) return { ok: false, why: 'that is not a US mobile number' };
  const body = String(text || '').trim();
  if (!body) return { ok: false, why: 'nothing to send' };
  const api = (deps.twilioApi || 'https://api.twilio.com') + '/2010-04-01/Accounts/' + encodeURIComponent(deps.accountSid) + '/Messages.json';
  const form = new URLSearchParams({ To: dest, Body: body.slice(0, 1600) });
  if (deps.statusCallback) form.set('StatusCallback', deps.statusCallback);
  if (deps.messagingSid) form.set('MessagingServiceSid', deps.messagingSid); else form.set('From', deps.fromNumber);
  let r, j;
  try {
    r = await fetch(api, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Authorization': 'Basic ' + Buffer.from(deps.accountSid + ':' + deps.authToken).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString() });
    j = await r.json().catch(() => ({}));
  } catch (e) { return { ok: false, why: 'Twilio did not answer: ' + e.message }; }
  if (!r.ok || !j.sid) {
    const code = j && j.code;
    const why = code === 30034 || /A2P|10DLC|unregistered/i.test(String(j.message || ''))
      ? 'texting is waiting on the carrier registration (Twilio campaign still in review)'
      : 'Twilio refused the text: ' + (j.message || r.status);
    return { ok: false, why, code };
  }
  return { ok: true, sid: j.sid, status: j.status || 'queued', to: dest };
}

export async function readSmsStatus(deps, sid, to) {
  if (!/^SM[a-zA-Z0-9]+$/.test(sid) || !deps.accountSid || !deps.authToken) throw new Error('Delivery lookup is unavailable.');
  const url = (deps.twilioApi || 'https://api.twilio.com') + '/2010-04-01/Accounts/' + encodeURIComponent(deps.accountSid) + '/Messages/' + encodeURIComponent(sid) + '.json';
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: {
    Authorization: 'Basic ' + Buffer.from(deps.accountSid + ':' + deps.authToken).toString('base64') } });
  const j = await r.json();
  if (!r.ok || e164(j.to) !== e164(to)) throw new Error('The carrier could not verify this message.');
  return { sid, status: j.status, errorCode: j.error_code || '' };
}

// mountMessages(app, deps): the routes.
// deps: { store, sendSms(to, text), authToken, publicHost, requireAdmin(req), rateLimit(user), json, urlencoded, callClient({to, name, reason}), log }
export function mountMessages(app, deps) {
  const log = deps.log || ((...a) => console.log('[messages]', ...a));

  // Twilio's inbound text webhook, signed like the voice one.
  app.post('/api/phone/sms', deps.urlencoded, async (req, res) => {
    const params = req.body || {};
    const host = deps.publicHost || req.get('x-forwarded-host') || req.get('host') || '';
    const url = 'https://' + host + (req.originalUrl || '/api/phone/sms');
    if (!deps.authToken || !twilioSignatureValid(deps.authToken, url, params, req.get('X-Twilio-Signature'))) { log('sms rejected: bad signature'); return res.status(403).send('forbidden'); }
    try { await deps.store.inbound({ from: params.From, text: params.Body, sid: params.MessageSid }); }
    catch (e) { log('inbound store failed', e.message); return res.status(503).send('storage unavailable'); }
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  app.post('/api/phone/sms/status', deps.urlencoded, async (req, res) => {
    const params = req.body || {};
    const url = 'https://' + (deps.publicHost || req.get('host')) + (req.originalUrl || '/api/phone/sms/status');
    if (!deps.authToken || !twilioSignatureValid(deps.authToken, url, params, req.get('X-Twilio-Signature'))) return res.status(403).send('forbidden');
    try { await deps.store.status({sid:params.MessageSid,status:params.MessageStatus,errorCode:params.ErrorCode}); res.sendStatus(204); }
    catch(e) { log('status failed', e.message); res.sendStatus(503); }
  });

  const admin = async (req, res) => { try { return await deps.requireAdmin(req); } catch (e) { res.status(e.status || 401).json({ error: 'unauthorized' }); return null; } };

  app.get('/api/admin/messages', async (req, res) => {
    if (!(await admin(req, res))) return;
    try { res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true, threads: await deps.store.list() }); }
    catch (e) { log('list failed', e.message); res.status(502).json({ error: 'messages_failed' }); }
  });
  app.get('/api/admin/messages/thread', async (req, res) => {
    if (!(await admin(req, res))) return;
    const number = e164(req.query.number);
    if (!number) return res.status(400).json({ error: 'number_required' });
    try {
      const t = await deps.store.get(number);
      await deps.store.markRead(number);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, thread: t || { number, name: '', messages: [], consent: 'none', unread: 0 } });
    } catch (e) { log('thread failed', e.message); res.status(502).json({ error: 'messages_failed' }); }
  });
  app.post('/api/admin/messages/check-delivery', deps.json, async (req, res) => {
    const user = await admin(req, res); if (!user) return;
    if (deps.rateLimit && !deps.rateLimit(user)) return res.status(429).json({ error: 'rate_limited' });
    if (!deps.readStatus) return res.status(503).json({ error: 'Delivery lookup is unavailable.' });
    const number = e164(req.body?.number);
    try {
      const t = await deps.store.get(number);
      const messages = (t?.messages || []).filter(m => m.kind === 'sms' && m.dir === 'out' && /^SM/.test(m.id)).slice(-5);
      const results = await Promise.allSettled(messages.map(async m => deps.store.status(await deps.readStatus(m.id, number))));
      const failed = results.filter(r => r.status === 'rejected').length;
      res.json({ ok: true, checked: results.length - failed, warning: failed ? 'Some delivery statuses could not be checked. Try again shortly.' : '' });
    } catch (_) { res.status(503).json({ error: 'Delivery status could not be checked.' }); }
  });
  for (const action of ['name', 'block', 'delete']) {
    app.post('/api/admin/messages/' + action, deps.json, async (req, res) => {
      if (!(await admin(req, res))) return;
      const body = req.body || {}, number = e164(body.number);
      if (!/^\+[1-9]\d{7,14}$/.test(number)) return res.status(400).json({error:'invalid_number'});
      if (action === 'block' && typeof body.blocked !== 'boolean') return res.status(400).json({error:'blocked_required'});
      if (action === 'name' && typeof body.name !== 'string') return res.status(400).json({error:'name_required'});
      try {
        if (action === 'name') await deps.store.name(number, body.name);
        if (action === 'block') await deps.store.block(number, body.blocked);
        if (action === 'delete') await deps.store.remove(number);
        res.json({ok:true});
      } catch(e) { log('thread update failed',e.message); res.status(503).json({error:'messages_unavailable'}); }
    });
  }
  app.post('/api/admin/messages/send', deps.json, async (req, res) => {
    const user = await admin(req, res); if (!user) return;
    if (deps.rateLimit && !deps.rateLimit(user)) return res.status(429).json({ error: 'rate_limited' });
    const to = e164((req.body || {}).to);
    const text = String((req.body || {}).text || '').trim().slice(0, 1600);
    const name = String((req.body || {}).name || '').trim().slice(0, 120);
    if (!to || !text) return res.status(400).json({ error: 'to_and_text_required' });
    let contact;
    try { contact = await deps.store.get(to); } catch(e) { return res.status(503).json({error:'messages_unavailable'}); }
    if (contact && contact.blocked) return res.status(409).json({ok:false,why:'This contact is blocked.'});
    const consent = contact ? contact.consent : 'none';
    if (consent === 'stop') return res.status(409).json({ ok: false, why: 'they asked for no more texts' });
    // An arbitrary admin message is not automatically a consent question.
    const asks = false;
    const r = await deps.sendSms(to, text);
    if (!r.ok) return res.status(502).json(r);
    try { await deps.store.outbound({ to, text, sid: r.sid, status: r.status, asks, name, by: user.email || 'fromsa' }); } catch (e) { log('outbound store failed', e.message); return res.json({ok:true,sid:r.sid,status:r.status,warning:'Text accepted by carrier, but history could not be saved. Do not resend.'}); }
    res.json({ ok: true, sid: r.sid, status:r.status, consent: asks ? 'asked' : consent });
  });
  // v14.35: the phone icon in the station: Maya calls the client.
  app.post('/api/admin/phone/call-client', deps.json, async (req, res) => {
    const user = await admin(req, res); if (!user) return;
    if (deps.rateLimit && !deps.rateLimit(user)) return res.status(429).json({ error: 'rate_limited' });
    const to = e164((req.body || {}).to);
    const name = String((req.body || {}).name || '').trim().slice(0, 120);
    const reason = String((req.body || {}).reason || '').trim().slice(0, 1200);
    if (!/^\+1\d{10}$/.test(to)) return res.status(400).json({ ok: false, why: 'that is not a US number' });
    if (!deps.callClient) return res.status(503).json({ ok: false, why: 'the phone line is off' });
    try {
      const contact = await deps.store.get(to);
      if (contact && contact.blocked) return res.status(409).json({ok:false,why:'This contact is blocked.'});
      const r = await deps.callClient({ to, name, reason });
      if (!r.ok) log('call-client refused:', r.why);
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) { log('call-client', e.message); return res.status(502).json({ ok: false, why: 'the call did not go out' }); }
  });
  log('messages routes on');
}
