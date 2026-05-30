// Maya — Vercel Node.js Function: Runway ML image-to-video proxy.
//
// v11.17 — powers the Favorites "hover to see a 3-second 360 showcase" feature.
// Keeps the Runway API key server-side. The browser never sees it.
//
// Place at: api/runway.js in the repo root. Vercel auto-routes /api/runway.
//
// Required Vercel env vars:
//   RUNWAY_API_KEY   — your Runway developer API key (Bearer)
//   GOOGLE_CLIENT_ID — the Sign-In client id, to verify the caller's ID token
//
// If RUNWAY_API_KEY is not set the endpoint returns 501 { error:'runway_not_configured' }
// and the frontend silently skips video generation — so shipping this before
// the key exists changes nothing.
//
// TWO actions (Runway video gen is async — submit, then poll):
//   1) POST /api/runway { action:'generate', image_b64, prompt, duration, ratio }
//        → { ok:true, task_id }
//   2) POST /api/runway { action:'status', task_id }
//        → { ok:true, status:'PENDING'|'RUNNING'|'SUCCEEDED'|'FAILED', video_url? }
//
// NOTE: Runway's exact field/path names occasionally shift between API versions.
// The constants below (RUNWAY_BASE, RUNWAY_VERSION, MODEL, path, field names)
// are the spots to confirm against https://docs.dev.runwayml.com once the key
// is live; everything else is generic.

import crypto from 'node:crypto';

export const config = { runtime: 'nodejs', maxDuration: 60 };

// ── Runway endpoint constants (confirm against current docs) ────────────────
const RUNWAY_BASE    = 'https://api.dev.runwayml.com';
const RUNWAY_VERSION = '2024-11-06';      // X-Runway-Version header
const MODEL          = 'gen4_turbo';      // image-to-video model

const ALLOWED_ORIGINS = [
  'https://maya.manasiyo.com',
  'http://localhost:8765', 'http://127.0.0.1:8765',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
];

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) return sendJson(res, 501, { error: 'runway_not_configured' });

  try { await requireGoogleUser(req); }
  catch (e) { return sendJson(res, 401, { error: 'unauthorized', detail: e.message }); }

  let body;
  if (req.body && typeof req.body === 'object') body = req.body;
  else {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (e) { return sendJson(res, 400, { error: 'bad_json', detail: e.message }); }
  }

  // ACTION 1: generate — submit an image-to-video task.
  if (body.action === 'generate') {
    if (!body.image_b64) return sendJson(res, 400, { error: 'no_image' });
    // Runway accepts a data URI for promptImage.
    const dataUri = body.image_b64.startsWith('data:')
      ? body.image_b64
      : ('data:image/jpeg;base64,' + body.image_b64);
    const payload = {
      model:       MODEL,
      promptImage: dataUri,
      promptText:  body.prompt || 'The model slowly rotates a full 360-degree turntable to show the garment from every angle. Clean seamless studio backdrop, soft even lighting, camera holds steady, smooth continuous rotation.',
      ratio:       body.ratio || '1280:720',
      duration:    Number(body.duration) || 5,   // seconds; Gen-4 Turbo classic = 5 or 10. 3 used if the account supports flexible durations.
    };
    try {
      const r = await fetch(RUNWAY_BASE + '/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization':   'Bearer ' + apiKey,
          'X-Runway-Version': RUNWAY_VERSION,
          'Content-Type':    'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (!r.ok) return sendJson(res, 502, { error: 'runway_generate_failed', status: r.status, detail: text.slice(0, 400) });
      const data = JSON.parse(text || '{}');
      const taskId = data.id || data.task_id || (data.task && data.task.id);
      if (!taskId) return sendJson(res, 502, { error: 'no_task_id', detail: text.slice(0, 200) });
      return sendJson(res, 200, { ok: true, task_id: taskId });
    } catch (e) {
      return sendJson(res, 500, { error: 'generate_exception', detail: e.message });
    }
  }

  // ACTION 2: status — poll a task. Frontend calls this every ~6s.
  if (body.action === 'status') {
    if (!body.task_id) return sendJson(res, 400, { error: 'no_task_id' });
    try {
      const r = await fetch(RUNWAY_BASE + '/v1/tasks/' + encodeURIComponent(body.task_id), {
        headers: {
          'Authorization':   'Bearer ' + apiKey,
          'X-Runway-Version': RUNWAY_VERSION,
        },
      });
      const text = await r.text();
      if (!r.ok) return sendJson(res, 502, { error: 'runway_status_failed', status: r.status, detail: text.slice(0, 400) });
      const data   = JSON.parse(text || '{}');
      const status = (data.status || '').toUpperCase();
      // Output is usually an array of URLs under `output`.
      let videoUrl = null;
      if (Array.isArray(data.output) && data.output.length) videoUrl = data.output[0];
      else if (typeof data.output === 'string')             videoUrl = data.output;
      else if (data.output && data.output.url)              videoUrl = data.output.url;
      return sendJson(res, 200, { ok: true, status, video_url: videoUrl, failure: data.failure || data.failureCode || null });
    } catch (e) {
      return sendJson(res, 500, { error: 'status_exception', detail: e.message });
    }
  }

  return sendJson(res, 400, { error: 'unknown_action', detail: 'expected action: generate|status' });
}

// ── CORS ────────────────────────────────────────────────────────────────────
function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://maya.manasiyo.com';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// ── Google ID token verification (same as api/submit.js) ────────────────────
async function requireGoogleUser(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw new Error('missing Bearer token');
  const payload = await verifyGoogleJwt(m[1], process.env.GOOGLE_CLIENT_ID);
  if (!payload.email_verified) throw new Error('email not verified');
  return { email: payload.email, sub: payload.sub };
}

let _googleKeysCache = { keys: null, exp: 0 };
async function getGoogleKeys() {
  if (_googleKeysCache.keys && Date.now() < _googleKeysCache.exp) return _googleKeysCache.keys;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('cannot fetch Google keys');
  const data = await r.json();
  _googleKeysCache = { keys: data.keys, exp: Date.now() + 3600 * 1000 };
  return data.keys;
}

async function verifyGoogleJwt(token, expectedAudience) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  const [headerB64, payloadB64, sigB64] = parts;
  const header  = JSON.parse(Buffer.from(headerB64,  'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('bad issuer: ' + payload.iss);
  }
  if (payload.aud !== expectedAudience) throw new Error('bad audience');
  if (Date.now() / 1000 > payload.exp) throw new Error('token expired');
  const keys = await getGoogleKeys();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verifier  = crypto.createVerify('RSA-SHA256');
  verifier.update(headerB64 + '.' + payloadB64);
  const ok = verifier.verify(publicKey, Buffer.from(sigB64, 'base64url'));
  if (!ok) throw new Error('bad signature');
  return payload;
}
