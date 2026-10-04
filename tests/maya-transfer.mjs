import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import { mountTransfers } from '../docs/server/maya-transfer.mjs';
const app = express(), entries = new Map(), requests = [];
const carrier = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { requests.push(new URLSearchParams(b)); res.end('{}'); }); });
await new Promise(r => carrier.listen(0, '127.0.0.1', r));
const transfer = mountTransfers(app, { publicHost: 'maya.test', authToken: 'test', accountSid: 'ACtest', fromNumber: '+15109909223', fromsaPhone: '+15104917540',
  twilioApi: 'http://127.0.0.1:' + carrier.address().port, urlencoded: express.urlencoded({ extended: false }),
  save: async (id, data) => entries.set(id, data), load: async id => entries.get(id) });
const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const post = async (path, body, signed = true) => {
  const signature = crypto.createHmac('sha1', 'test').update('https://maya.test' + path + Object.keys(body).sort().map(k => k + body[k]).join('')).digest('base64');
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(signed ? { 'X-Twilio-Signature': signature } : {}) }, body: new URLSearchParams(body) });
};
try {
  assert.equal((await transfer({ callSid: 'CA123', name: 'Taylor <script>', request: 'a fitting & alterations', from: '+14155550100', to: '+19005550100' })).ok, true);
  const twiml = requests[0].get('Twiml');
  assert(twiml.includes('answerOnBridge="true"') && twiml.includes('>+15104917540</Number>') && !twiml.includes('19005550100'));
  assert.equal((await post('/api/phone/transfer/screen?call=CA123', {}, false)).status, 403);
  const screen = await (await post('/api/phone/transfer/screen?call=CA123', {})).text();
  assert(screen.includes('Taylor &lt;script&gt;') && screen.includes('&amp; alterations') && screen.includes('numDigits="1"'));
  assert(!(await (await post('/api/phone/transfer/accept', { Digits: '1' })).text()).includes('Hangup'));
  assert((await (await post('/api/phone/transfer/accept', { Digits: '2' })).text()).includes('Hangup'));
  assert((await (await post('/api/phone/transfer/result', { DialCallStatus: 'no-answer' })).text()).includes('callback request is saved'));
  entries.get('CA123').ts = 0;
  assert((await (await post('/api/phone/transfer/screen?call=CA123', {})).text()).includes('Hangup'));
  console.log('Transfer: fixed owner, signed callbacks, escaped summary, acceptance, decline, fallback, expiry passed.');
} finally { server.close(); carrier.close(); }
