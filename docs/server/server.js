// ═══════════════════════════════════════════════════════════════════════════
// MAYA — Cloud Run API service (replaces the three Vercel functions)
//
//   /api/openai/*   → authenticated passthrough to api.openai.com
//                     (JSON *and* multipart — images/edits, audio/transcriptions)
//   /api/submit     → Google Drive submission (init folder / upload one-pager)
//   /api/runway     → Runway ML image-to-video proxy (dormant until key set)
//   /healthz        → unauthenticated liveness probe
//
// Deployed on Cloud Run in project `pro-maya`; fronted by Firebase Hosting
// with a rewrite of /api/** → this service, so the browser keeps calling
// same-origin /api/... exactly as it did on Vercel.
//
// Required env vars (set via `gcloud run deploy/services update`):
//   OPENAI_API_KEY              — OpenAI secret key (server-side only)
//   GOOGLE_CLIENT_ID            — Google Sign-In client id (ID-token audience)
//   GOOGLE_OAUTH_CLIENT_ID      — OAuth web client id   (Drive uploads)
//   GOOGLE_OAUTH_CLIENT_SECRET  — OAuth client secret   (Drive uploads)
//   GOOGLE_OAUTH_REFRESH_TOKEN  — refresh token for the atelier Drive account
//   DRIVE_FOLDER_ID             — MAYA folder id in Drive
//   RUNWAY_API_KEY              — optional; absent → /api/runway returns 501
//   FAL_API_KEY                 — optional; absent → /api/fal/* returns 501
//   STRIPE_SECRET_KEY           — optional; absent → /api/tip returns 501
// ═══════════════════════════════════════════════════════════════════════════

import express from 'express';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

const app = express();
app.disable('x-powered-by');

const ALLOWED_ORIGINS = [
  'https://maya.manasiyo.com',
  'https://pro-maya.web.app',
  'https://pro-maya.firebaseapp.com',
  'http://localhost:8765', 'http://127.0.0.1:8765',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
];

// ── CORS (belt-and-suspenders; same-origin via Hosting rewrite normally) ────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://maya.manasiyo.com';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Public liveness probe — open CORS so the MAYA System Map artifact (and
// anything else) can read it from any origin. Returns no secrets. Also
// mounted at /api/healthz so it's reachable through the Firebase Hosting
// /api/** rewrite on maya.manasiyo.com.
// v12.9: this used to answer ok as long as the server was running, so every
// light on the Systems Map could be green while the OpenAI key was missing and
// the Drive authorisation was dead. It now reports what is actually configured
// and, on /api/healthz?deep=1, whether Drive really answers.
function _healthz(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true, service: 'maya-api', ts: new Date().toISOString(),
    configured: {
      openai: !!process.env.OPENAI_API_KEY,
      drive:  !!(process.env.GOOGLE_OAUTH_REFRESH_TOKEN && process.env.DRIVE_FOLDER_ID),
      fal:    !!process.env.FAL_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
    },
  });
}
// v13.0: admin only, time limited, and it never echoes Google's raw error text
// (which can contain client identifiers). Open to the world it was a free way
// to make the atelier's Drive authorisation refresh on demand.
app.get('/api/healthz/deep', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const out = { ok: true, openai: !!process.env.OPENAI_API_KEY, drive: false, detail: '' };
  try {
    const tok = await getDriveAccessToken();
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(process.env.DRIVE_FOLDER_ID || '') + '?fields=id', {
      headers: { 'Authorization': 'Bearer ' + tok },
      signal: AbortSignal.timeout(5000),
    });
    out.drive = r.ok;
    if (!r.ok) out.detail = 'drive_' + r.status;
  } catch (e) {
    console.error('[healthz deep]', (e && e.message) || e);
    out.detail = 'drive_auth';
  }
  out.ok = out.openai && out.drive;
  res.json(out);
});
app.get('/healthz', _healthz);
app.get('/api/healthz', _healthz);

// Admin allow list, needed by the rate limiter and every /api/admin route.
// If ADMIN_EMAILS is set (even to empty) it is authoritative.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS !== undefined
  ? process.env.ADMIN_EMAILS
  : 'fromsa@manasiyo.com,worldofsiyo@gmail.com,prasheeth@step-6.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// ═══════════════════════════════════════════════════════════════════════════
// v11.32: simple per-user rate limiter — the cost guardrail for a FREE public
// launch. In-memory sliding window keyed by the Google user id (sub). This is
// per-instance (Cloud Run may run a few), so it's a generous ceiling that stops
// a single abuser hammering the OpenAI key, NOT an exact daily quota — a
// durable per-user daily cap (Firestore/Redis) is the follow-up when traffic
// justifies it. Tunable via env: RL_PER_MIN (default 20), RL_PER_DAY (600).
// ═══════════════════════════════════════════════════════════════════════════
// v12.5: 600 a day meant one account could spend about $39 of image credit in a
// single day. 50 is more than anyone designing a real garment will ever reach,
// and caps the worst case at a few dollars. This is a fair use ceiling, not a
// paywall; MAYA stays free.
const RL_PER_MIN = Number(process.env.RL_PER_MIN || 20);
const RL_PER_DAY = Number(process.env.RL_PER_DAY || 50);
// v12.5: the atelier's own accounts get a much higher ceiling. The Brief and
// the Operations Room now go through this proxy instead of holding the key in
// the browser, and dissecting one garment fires a burst of parallel renders
// that would trip a client-sized limit within seconds.
const RL_ADMIN_PER_MIN = Number(process.env.RL_ADMIN_PER_MIN || 120);
const RL_ADMIN_PER_DAY = Number(process.env.RL_ADMIN_PER_DAY || 6000);
const _rl = new Map();  // sub -> { min:[ts...], day:[ts...] }
function rateLimit(sub, email, weight) {
  const w = Math.max(1, Number(weight) || 1);
  const isAdmin = !!email && ADMIN_EMAILS.includes(String(email).toLowerCase());
  const perMin = isAdmin ? RL_ADMIN_PER_MIN : RL_PER_MIN;
  const perDay = isAdmin ? RL_ADMIN_PER_DAY : RL_PER_DAY;
  const now = Date.now();
  let b = _rl.get(sub);
  if (!b) { b = { min: [], day: [] }; _rl.set(sub, b); }
  b.min = b.min.filter(t => now - t < 60_000);
  b.day = b.day.filter(t => now - t < 86_400_000);
  if (b.min.length + w > perMin) return { ok: false, scope: 'minute', retry: 60 };
  if (b.day.length + w > perDay) return { ok: false, scope: 'day', retry: 3600 };
  for (let i = 0; i < w; i++) { b.min.push(now); b.day.push(now); }
  return { ok: true };
}
// Occasionally drop idle users so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [sub, b] of _rl) {
    if (b.day.every(t => now - t >= 86_400_000)) _rl.delete(sub);
  }
}, 3_600_000).unref?.();

// Only these OpenAI endpoints are ever used by the app — anything else is
// almost certainly abuse of the proxied key.
const OPENAI_ALLOWED = new Set([
  'v1/chat/completions',
  'v1/images/generations',
  'v1/images/edits',
  'v1/audio/transcriptions',
  'v1/embeddings',            // v12.5: the Operations Room knowledge base
]);

// ═══════════════════════════════════════════════════════════════════════════
// Google ID-token verification (same JWKS check the Vercel functions used)
// ═══════════════════════════════════════════════════════════════════════════
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

async function requireGoogleUser(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw new Error('missing Bearer token');
  const payload = await verifyGoogleJwt(m[1], process.env.GOOGLE_CLIENT_ID);
  if (!payload.email_verified) throw new Error('email not verified');
  return { email: payload.email, sub: payload.sub };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/openai/* — raw passthrough. The browser sends its Google ID token as
// the Bearer; we swap it for the real OpenAI key server-side. Bodies are
// forwarded byte-for-byte, so JSON, multipart (images/edits, audio) and
// everything else survive untouched.
//
// KEY UPGRADE over the Vercel proxy: upstream error bodies are LOGGED, so a
// 400 from OpenAI shows its real reason in Cloud Run logs instead of dying
// as an anonymous status code.
// ═══════════════════════════════════════════════════════════════════════════
// v11.49 (Codex M9): cheap header gate BEFORE the body parsers — an
// unauthenticated flood of max-size requests dies without buffering a byte.
// (Full signature verification still happens afterwards, as before.)
function requireAuthHeader(req, res, next) {
  if (!/^Bearer\s+.+/.test(req.headers.authorization || '')) {
    return res.status(401).json({ error: 'unauthorized', detail: 'missing Bearer token' });
  }
  next();
}

app.all(/^\/api\/openai\/(.*)/, requireAuthHeader, express.raw({ type: '*/*', limit: '24mb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) {
    console.error('[openai] 401 —', e.message);
    return res.status(401).json({ error: 'unauthorized', detail: e.message });
  }

  const upstreamPath = req.path.replace(/^\/api\/openai\//, '');   // e.g. v1/chat/completions
  // v12.9: weight the cost. A high quality image is roughly thirty times a
  // chat call, and the old counter treated them identically, so the daily
  // ceiling meant very different amounts of money depending on what was asked
  // for. Images now cost more of the allowance than text does.
  // v11.32: reject path-traversal (…/../fine_tuning normalizes past the v1
  // guard once fetch() builds the URL) and only allow the endpoints the app
  // actually calls — the proxied key can't be pointed at anything else.
  if (upstreamPath.includes('..') || /%2e/i.test(upstreamPath)) {
    return res.status(400).json({ error: 'bad_path' });
  }
  if (!OPENAI_ALLOWED.has(upstreamPath)) {
    return res.status(403).json({ error: 'endpoint_not_allowed', detail: upstreamPath });
  }

  // v13.0: the allowance is charged only AFTER the path is known to be valid,
  // so a rejected call no longer eats into someone's day. Images count for
  // more than text because they cost far more.
  const isImage = /^v1\/images\//.test(upstreamPath);
  const rl = rateLimit(user.sub, user.email, isImage ? 4 : 1);
  if (!rl.ok) {
    console.warn('[openai] rate-limited', user.email, 'scope=' + rl.scope);
    res.setHeader('Retry-After', String(rl.retry));
    return res.status(429).json({ error: 'rate_limited', scope: rl.scope,
      detail: 'Too many requests, please wait a moment and try again.' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'openai_not_configured' });

  // v12.9: bound what can actually be asked for. Before this a signed in user
  // could send any body at all through the allowed paths, including sixteen
  // images at the highest quality in one call.
  if (isImage) {
    const _isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
    const ct = req.headers['content-type'] || '';
    if (/json/i.test(ct) && req.body && req.body.length < 1000000) {
      try {
        const body = JSON.parse(req.body.toString('utf8') || '{}');
        if (Number(body.n) > 2) return res.status(400).json({ error: 'too_many_images', detail: 'n must be 2 or fewer' });
        if (!_isAdmin && body.quality === 'high') {
          return res.status(403).json({ error: 'quality_not_allowed', detail: 'high quality is atelier only' });
        }
      } catch (_) { /* not JSON after all, fall through to the multipart check */ }
    } else if (/multipart/i.test(ct) && req.body) {
      // v13.0: the edits endpoint is multipart and is the EXPENSIVE one, and
      // it was not being checked at all. Read just the small form fields.
      const head = req.body.subarray(0, Math.min(req.body.length, 65536)).toString('latin1');
      const field = (nm) => {
        const m = head.match(new RegExp('name="' + nm + '"\\r?\\n\\r?\\n([^\\r\\n]{0,40})'));
        return m ? m[1].trim() : null;
      };
      const n = Number(field('n'));
      if (Number.isFinite(n) && n > 2) return res.status(400).json({ error: 'too_many_images', detail: 'n must be 2 or fewer' });
      if (!_isAdmin && field('quality') === 'high') {
        return res.status(403).json({ error: 'quality_not_allowed', detail: 'high quality is atelier only' });
      }
    }
  }
  const headers = { 'Authorization': 'Bearer ' + openaiKey };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  try {
    const upstream = await fetch('https://api.openai.com/' + upstreamPath, {
      method: req.method,
      headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined
            : (req.body && req.body.length ? req.body : undefined),
      signal: AbortSignal.timeout(285000),
    });
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    if (!upstream.ok) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      console.error('[openai]', upstream.status, upstreamPath, 'user=' + user.email,
                    '—', buf.toString('utf8').slice(0, 600));
      return res.status(upstream.status).send(buf);
    }
    res.status(upstream.status);
    // v13.21: do not hold a complete image response in Cloud Run memory.
    // Successful responses flow to the browser as they arrive; errors remain
    // buffered briefly above so their useful diagnostics can be logged.
    if (!upstream.body) return res.end();
    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', error => {
      console.error('[openai] response stream', upstreamPath, '—', error.message);
      res.destroy(error);
    });
    return stream.pipe(res);
  } catch (e) {
    console.error('[openai] proxy exception', upstreamPath, '—', e.message);
    return res.status(502).json({ error: 'openai_proxy_failed', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// /api/submit — Google Drive submission (ported 1:1 from api/submit.js v11.15,
// refresh-token OAuth so files are owned by the atelier account).
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/submit', requireAuthHeader, express.json({ limit: '30mb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) {
    console.error('[submit] 401 unauthorized —', e.message);
    return res.status(401).json({ error: 'unauthorized', detail: e.message });
  }

  const body = req.body || {};

  // v11.49 (Codex M8): submissions share the per-user rate limiter — no more
  // unlimited folder creation / uploads from a single account.
  const rlS = rateLimit(user.sub, user.email);
  if (!rlS.ok) {
    console.warn('[submit] rate-limited', user.email, 'scope=' + rlS.scope);
    return res.status(429).json({ error: 'rate_limited', scope: rlS.scope });
  }

  let accessToken;
  try { accessToken = await getDriveAccessToken(); }
  catch (e) {
    console.error('[submit] 500 oauth_auth_failed for', user.email, '—', e.message);
    return res.status(500).json({ error: 'oauth_auth_failed', detail: e.message });
  }

  const rootFolderId = process.env.DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    console.error('[submit] 500 no_drive_folder_id — DRIVE_FOLDER_ID env var not set');
    return res.status(500).json({ error: 'no_drive_folder_id' });
  }
  console.log('[submit] action=' + body.action, 'user=' + user.email, 'rootFolder=' + rootFolderId);

  if (body.action === 'init') {
    const clientName = (body.client_name || 'client').toString().trim().slice(0, 60) || 'client';
    const d = new Date();
    const stamp = String(d.getMonth() + 1).padStart(2, '0') + '-' +
                  String(d.getDate()).padStart(2, '0') + '-' + d.getFullYear();
    const subName = `${clientName}-${stamp}`;
    try {
      const subId = await driveCreateFolder(accessToken, subName, rootFolderId);
      _subsCache = { ts: 0, body: null };     // v12.5: show up on the Systems Map immediately
      console.log('[submit] init OK — "' + subName + '" (' + subId + ')');
      return res.json({ ok: true, folder_id: subId, folder_name: subName });
    } catch (e) {
      console.error('[submit] 500 folder_create_failed under', rootFolderId, '—', e.message);
      return res.status(500).json({ error: 'folder_create_failed', detail: e.message });
    }
  }

  if (body.action === 'upload') {
    if (!body.folder_id) return res.status(400).json({ error: 'no_folder_id' });
    if (!body.name || !body.data_b64) return res.status(400).json({ error: 'no_file' });
    // v11.49 (Codex M8): the target folder must be a DIRECT CHILD of the MAYA
    // submissions root — no uploads into the root itself or anywhere else.
    // v12.5: cached, so a submission's files no longer each pay for their own
    // round trip to Drive just to re-confirm the same folder.
    try {
      if (!(await isSubmissionFolder(accessToken, body.folder_id)) || body.folder_id === rootFolderId) {
        console.warn('[submit] blocked upload to non-submission folder', body.folder_id, 'by', user.email);
        return res.status(403).json({ error: 'folder_not_allowed' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'folder_check_failed', detail: e.message });
    }
    // v12.5: only the files MAYA itself writes, with the types it writes them
    // as. Before this any signed in Google account could upload a file of any
    // name and any type into the atelier's Drive.
    const ALLOWED_UPLOADS = /^(one-pager\.(png|jpg|jpeg|pdf)|dream-garment\.(png|jpg|jpeg)|summary\.json|pieces\.json|moodboard\.json|hero\.(png|jpg|jpeg)|face\.(png|jpg|jpeg))$/i;
    const safeName = String(body.name || '').trim();
    if (!ALLOWED_UPLOADS.test(safeName)) {
      console.warn('[submit] blocked filename', safeName, 'by', user.email);
      return res.status(403).json({ error: 'filename_not_allowed', detail: safeName });
    }
    const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/json', 'application/pdf', 'text/json']);
    const bytes = b64ToBytes(body.data_b64);
    const mime  = body.mime_type || 'application/octet-stream';
    if (!ALLOWED_MIME.has(String(mime).toLowerCase().split(';')[0].trim())) {
      return res.status(403).json({ error: 'mime_not_allowed', detail: mime });
    }
    if (bytes.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    try {
      const info = await driveUploadFile(accessToken, safeName, body.folder_id, mime, bytes);
      _subsCache = { ts: 0, body: null };     // v12.5: the picture is there now, let the map see it
      console.log('[submit] upload OK — "' + info.name + '" (' + info.id + ')');
      return res.json({ ok: true, file_id: info.id, name: info.name });
    } catch (e) {
      console.error('[submit] 500 upload_failed for "' + body.name + '" —', e.message);
      return res.status(500).json({ error: 'upload_failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: 'unknown_action', detail: 'expected action: init|upload' });
});

async function getDriveAccessToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('missing GOOGLE_OAUTH_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN');
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('oauth refresh ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  if (!data.access_token) throw new Error('no access_token in refresh response');
  return data.access_token;
}

async function driveCreateFolder(accessToken, name, parentId) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!r.ok) throw new Error('folder create ' + r.status + ': ' + (await r.text()));
  return (await r.json()).id;
}

async function driveUploadFile(accessToken, name, parentId, mimeType, dataBytes) {
  const boundary = '----maya' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [parentId] }) + `\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8');
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([head, Buffer.from(dataBytes), tail]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()));
  return await r.json();
}

function b64ToBytes(s) {
  const bare = s.includes(',') ? s.split(',')[1] : s;
  return Buffer.from(bare, 'base64');
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/runway — ported 1:1 from api/runway.js v11.17. Dormant (501) until
// RUNWAY_API_KEY is set, exactly as before.
// ═══════════════════════════════════════════════════════════════════════════
const RUNWAY_BASE    = 'https://api.dev.runwayml.com';
const RUNWAY_VERSION = '2024-11-06';
const RUNWAY_MODEL   = 'gen4_turbo';

app.post('/api/runway', requireAuthHeader, express.json({ limit: '30mb' }), async (req, res) => {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) return res.status(501).json({ error: 'runway_not_configured' });

  let rwUser;
  try { rwUser = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  // v12.5: video generation is the most expensive call MAYA can make and it
  // was the one route with no rate limit at all.
  const rlR = rateLimit(rwUser.sub, rwUser.email);
  if (!rlR.ok) {
    res.setHeader('Retry-After', String(rlR.retry));
    return res.status(429).json({ error: 'rate_limited', scope: rlR.scope });
  }

  const body = req.body || {};

  if (body.action === 'generate') {
    if (!body.image_b64) return res.status(400).json({ error: 'no_image' });
    const dataUri = body.image_b64.startsWith('data:')
      ? body.image_b64 : ('data:image/jpeg;base64,' + body.image_b64);
    const payload = {
      model:       RUNWAY_MODEL,
      promptImage: dataUri,
      promptText:  body.prompt || 'The model stays in one place and slowly rotates on the spot: starting facing the camera front-on, turning to a side profile, continuing around to show the back, then rotating back to face the camera front-on again — one smooth continuous turntable that loops seamlessly. The model does NOT walk and does NOT move toward or away from the camera. Camera is locked off, no zoom, no pan. Seamless studio backdrop, soft even studio lighting held perfectly constant throughout.',
      ratio:       ['1280:720', '720:1280', '1104:832', '832:1104', '960:960'].includes(body.ratio) ? body.ratio : '1280:720',
      duration:    [5, 10].includes(Number(body.duration)) ? Number(body.duration) : 5,
    };
    try {
      const r = await fetch(RUNWAY_BASE + '/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'X-Runway-Version': RUNWAY_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (!r.ok) {
        console.error('[runway] generate', r.status, '—', text.slice(0, 400));
        return res.status(502).json({ error: 'runway_generate_failed', status: r.status, detail: text.slice(0, 400) });
      }
      const data = JSON.parse(text || '{}');
      const taskId = data.id || data.task_id || (data.task && data.task.id);
      if (!taskId) return res.status(502).json({ error: 'no_task_id', detail: text.slice(0, 200) });
      return res.json({ ok: true, task_id: taskId });
    } catch (e) {
      return res.status(500).json({ error: 'generate_exception', detail: e.message });
    }
  }

  if (body.action === 'status') {
    if (!body.task_id) return res.status(400).json({ error: 'no_task_id' });
    try {
      const r = await fetch(RUNWAY_BASE + '/v1/tasks/' + encodeURIComponent(body.task_id), {
        headers: { 'Authorization': 'Bearer ' + apiKey, 'X-Runway-Version': RUNWAY_VERSION },
      });
      const text = await r.text();
      if (!r.ok) {
        console.error('[runway] status', r.status, '—', text.slice(0, 400));
        return res.status(502).json({ error: 'runway_status_failed', status: r.status, detail: text.slice(0, 400) });
      }
      const data = JSON.parse(text || '{}');
      const status = (data.status || '').toUpperCase();
      let videoUrl = null;
      if (Array.isArray(data.output) && data.output.length) videoUrl = data.output[0];
      else if (typeof data.output === 'string')             videoUrl = data.output;
      else if (data.output && data.output.url)              videoUrl = data.output.url;
      return res.json({ ok: true, status, video_url: videoUrl, failure: data.failure || data.failureCode || null });
    } catch (e) {
      return res.status(500).json({ error: 'status_exception', detail: e.message });
    }
  }

  return res.status(400).json({ error: 'unknown_action', detail: 'expected action: generate|status' });
});


// ═══════════════════════════════════════════════════════════════════════════
// v12.6: /api/tip — Stripe. The first money pipe through MAYA.
//
// Deliberately the smallest possible real payment: a tip to the atelier, any
// amount from $1. It proves the whole path (browser to Stripe to a receipt)
// without deciding anything about pricing, and without putting a charge in
// front of a client. Everything else in MAYA stays free.
//
// Uses Stripe's REST API directly over fetch, so there is no npm dependency to
// install or keep updated. Dormant (501) until STRIPE_SECRET_KEY is set.
//   STRIPE_SECRET_KEY — from the Stripe dashboard, server side only
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/tip', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return res.status(501).json({ error: 'stripe_not_configured' });
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }

  // Whole dollars, $1 to $500. Anything outside that is a mistake or mischief.
  const dollars = Math.round(Number((req.body || {}).amount || 0));
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 500) {
    return res.status(400).json({ error: 'bad_amount', detail: 'between 1 and 500' });
  }
  const origin = ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : 'https://maya.manasiyo.com';
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', origin + '/?tip=thanks');
  form.set('cancel_url', origin + '/?tip=cancelled');
  form.set('customer_email', user.email || '');
  form.set('client_reference_id', user.sub);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', 'usd');
  form.set('line_items[0][price_data][unit_amount]', String(dollars * 100));
  form.set('line_items[0][price_data][product_data][name]', 'Tip Mana Siyo');
  form.set('line_items[0][price_data][product_data][description]', 'Supports MAYA, which stays free for everyone.');
  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sk, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[tip] stripe', r.status, JSON.stringify(j).slice(0, 300));
      return res.status(502).json({ error: 'stripe_failed', detail: (j.error && j.error.message) || r.status });
    }
    console.log('[tip] $' + dollars, 'session for', user.email);
    return res.json({ ok: true, url: j.url });
  } catch (e) {
    console.error('[tip] exception', e.message);
    return res.status(502).json({ error: 'stripe_exception', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// v12.5: /api/fal/* — fal.ai (Hyper3D Rodin) proxy. Same shape as the OpenAI
// proxy: the browser sends its Google ID token, the server swaps in the real
// key. This exists so the Brief and the Operations Room stop holding the
// atelier's fal key in localStorage where any script on the page could read it.
// Dormant (501) until FAL_API_KEY is set on the service.
// ═══════════════════════════════════════════════════════════════════════════
const FAL_ALLOWED = [
  /^fal-ai\/hyper3d\/rodin$/,
  /^fal-ai\/hyper3d\/requests\/[\w-]{1,80}$/,
  /^fal-ai\/hyper3d\/requests\/[\w-]{1,80}\/status$/,
];
app.all(/^\/api\/fal\/(.*)/, requireAuthHeader, express.raw({ type: '*/*', limit: '30mb' }), async (req, res) => {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return res.status(501).json({ error: 'fal_not_configured' });
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry));
    return res.status(429).json({ error: 'rate_limited', scope: rl.scope });
  }
  const upstreamPath = req.path.replace(/^\/api\/fal\//, '');
  if (upstreamPath.includes('..') || /%2e/i.test(upstreamPath)) return res.status(400).json({ error: 'bad_path' });
  if (!FAL_ALLOWED.some(rx => rx.test(upstreamPath))) {
    return res.status(403).json({ error: 'endpoint_not_allowed', detail: upstreamPath });
  }
  const headers = { 'Authorization': 'Key ' + falKey };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  try {
    const qs = req.originalUrl.indexOf('?') !== -1 ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const upstream = await fetch('https://queue.fal.run/' + upstreamPath + qs, {
      method: req.method,
      headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined
            : (req.body && req.body.length ? req.body : undefined),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) console.error('[fal]', upstream.status, upstreamPath, 'user=' + user.email, '—', buf.toString('utf8').slice(0, 400));
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    return res.send(buf);
  } catch (e) {
    console.error('[fal] proxy exception', upstreamPath, '—', e.message);
    return res.status(502).json({ error: 'fal_proxy_failed', detail: e.message });
  }
});

// v12.5: /api/falstorage/* — fal.ai's upload host, same proxy treatment. The
// Brief has to hand fal a picture before Rodin can turn it into a mesh; that
// call used to go straight from the browser to fal carrying the designer's
// Google token as if it were a fal key.
app.all(/^\/api\/falstorage\/(.*)/, requireAuthHeader, express.raw({ type: '*/*', limit: '30mb' }), async (req, res) => {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) return res.status(501).json({ error: 'fal_not_configured' });
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited', scope: rl.scope }); }
  const upstreamPath = req.path.replace(/^\/api\/falstorage\//, '');
  if (upstreamPath.includes('..') || /%2e/i.test(upstreamPath)) return res.status(400).json({ error: 'bad_path' });
  if (!/^storage\/upload\/initiate$/.test(upstreamPath)) return res.status(403).json({ error: 'endpoint_not_allowed', detail: upstreamPath });
  const headers = { 'Authorization': 'Key ' + falKey };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  try {
    const upstream = await fetch('https://rest.alpha.fal.ai/' + upstreamPath, {
      method: req.method, headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : (req.body && req.body.length ? req.body : undefined),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) console.error('[falstorage]', upstream.status, '—', buf.toString('utf8').slice(0, 300));
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    return res.send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'fal_storage_proxy_failed', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// v11.43: /api/admin/* — MAYA Backend dashboard endpoints.
// Gated to ADMIN_EMAILS (env override, comma-separated). The dashboard page
// lives at https://maya.manasiyo.com/admin.html and polls these.
// ═══════════════════════════════════════════════════════════════════════════
// v11.49 (Codex M10): the baked-in pair is only the DEFAULT — if the env var
// is set (even to empty), it is authoritative, so an operator can disable all
// admin access by clearing it.

let _subsCache = { ts: 0, body: null };

async function requireAdmin(req) {
  const user = await requireGoogleUser(req);
  if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    const e = new Error('not an admin: ' + user.email);
    e.status = 403;
    throw e;
  }
  return user;
}

// v12.5: true only for the MAYA submissions folder itself or one of its direct
// children. Every admin read and write is confined to this subtree.
const _folderParentCache = new Map();
async function isSubmissionFolder(accessToken, folderId) {
  const root = process.env.DRIVE_FOLDER_ID;
  if (!root || !folderId) return false;
  if (folderId === root) return true;
  const hit = _folderParentCache.get(folderId);
  if (hit && Date.now() - hit.ts < 600000) return hit.ok;
  let ok = false;
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(folderId) + '?fields=parents', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (r.ok) {
      const j = await r.json();
      ok = Array.isArray(j.parents) && j.parents.includes(root);
    }
  } catch (_) {}
  _folderParentCache.set(folderId, { ok, ts: Date.now() });
  return ok;
}

async function driveList(accessToken, params) {
  const qs = new URLSearchParams(params);
  const r = await fetch('https://www.googleapis.com/drive/v3/files?' + qs.toString(), {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('drive list ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return (await r.json()).files || [];
}

// GET /api/admin/submissions — every submission folder in Drive, newest first,
// with the files inside each. Powers the live feed on the Backend page.
app.get('/api/admin/submissions', async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  // v13.19: submission writes invalidate this cache immediately. Reads can
  // therefore share a 15-second result instead of forcing dozens of Drive
  // requests from every open Systems Map tab.
  if (_subsCache.body && Date.now() - _subsCache.ts < 15000) {
    return res.json(_subsCache.body);
  }
  try {
    const accessToken = await getDriveAccessToken();
    const root = process.env.DRIVE_FOLDER_ID;
    if (!root) return res.status(500).json({ error: 'no_drive_folder_id' });
    const folders = await driveList(accessToken, {
      q: "'" + root + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      orderBy: 'createdTime desc',
      pageSize: '100',
      fields: 'files(id,name,createdTime)',
    });
    // Only the newest cards are rendered. Listing files in forty folders made
    // one dashboard refresh fan out into forty-one Drive API calls.
    const detailed = await Promise.all(folders.slice(0, 16).map(async f => {
      const files = await driveList(accessToken, {
        q: "'" + f.id + "' in parents and trashed = false",
        orderBy: 'createdTime',
        pageSize: '25',
        fields: 'files(id,name,mimeType,size,createdTime,webViewLink)',
      }).catch(() => []);
      return {
        id: f.id, name: f.name, createdTime: f.createdTime,
        url: 'https://drive.google.com/drive/folders/' + f.id,
        files: files.map(x => ({
          id: x.id, name: x.name, mime: x.mimeType, size: Number(x.size || 0),
          createdTime: x.createdTime, url: x.webViewLink || ('https://drive.google.com/file/d/' + x.id),
        })),
      };
    }));
    console.log('[admin] submissions OK for', user.email, '—', folders.length, 'folders');
    const payload = { ok: true, total: folders.length, folders: detailed, ts: new Date().toISOString() };
    _subsCache = { ts: Date.now(), body: payload };
    res.json(payload);
  } catch (e) {
    console.error('[admin] submissions failed —', e.message);
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    const authFailed = /oauth refresh|invalid_grant|expired|revoked/i.test(String(e && e.message));
    res.status(500).json({ error: 'submissions_failed',
      code: timedOut ? 'drive_timeout' : (authFailed ? 'drive_auth' : 'drive_error'),
      detail: timedOut ? 'Drive timed out' : (authFailed ? 'Drive authorization rejected' : 'Drive request failed') });
  }
});

// GET /api/admin/subthumb?id=<fileId>&w=480 — Drive's own thumbnail for one
// submission picture, streamed through us. v13.3. The Systems Map used to
// point its <img> straight at drive.google.com/thumbnail, which only renders
// for files shared publicly, so every private submission drew an empty tile
// and the strip looked broken. Same submission-folder check as subfile, plus
// a half hour memory cache so a strip that repaints does not re-hit Drive.
const _thumbCache = new Map();
app.get('/api/admin/subthumb', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const id = String(req.query.id || '');
  if (!/^[\w-]{10,80}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  const w = Math.min(1024, Math.max(80, parseInt(req.query.w, 10) || 480));
  const key = id + ':' + w;
  const hit = _thumbCache.get(key);
  if (hit && Date.now() - hit.ts < 30 * 60 * 1000) {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    return res.end(hit.buf);
  }
  try {
    const accessToken = await getDriveAccessToken();
    const metaR = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,mimeType,size,thumbnailLink,parents', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!metaR.ok) return res.status(404).json({ error: 'not_found' });
    const meta = await metaR.json();
    const parents = Array.isArray(meta.parents) ? meta.parents : [];
    let inside = false;
    for (const p of parents) { if (await isSubmissionFolder(accessToken, p)) { inside = true; break; } }
    if (!inside) return res.status(403).json({ error: 'file_not_allowed' });
    let buf = null, type = 'image/jpeg';
    if (meta.thumbnailLink) {
      const tl = String(meta.thumbnailLink).replace(/=[sw]\d+(-h\d+)?$/, '=s' + w);
      const tr = await fetch(tl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (tr.ok) { buf = Buffer.from(await tr.arrayBuffer()); type = tr.headers.get('content-type') || 'image/jpeg'; }
    }
    if (!buf) {
      // No Drive thumbnail yet (it can lag a fresh upload). Fall back to the
      // original, but never stream something enormous into a 200px tile.
      if (Number(meta.size || 0) > 12 * 1024 * 1024) return res.status(404).json({ error: 'no_thumb' });
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
      });
      if (!r.ok) return res.status(502).json({ error: 'drive_' + r.status });
      buf = Buffer.from(await r.arrayBuffer());
      type = meta.mimeType || 'image/jpeg';
    }
    if (_thumbCache.size > 200) _thumbCache.clear();
    _thumbCache.set(key, { ts: Date.now(), buf, type });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.end(buf);
  } catch (e) {
    console.error('[admin] subthumb failed,', e.message);
    res.status(500).json({ error: 'subthumb_failed', detail: e.message });
  }
});

// GET /api/admin/subfile?id=<fileId> — stream one submission file's content
// (summary.json, dream-garment.png) to the Backend page. Admin-gated. v12.8.
app.get('/api/admin/subfile', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const id = String(req.query.id || '');
  if (!/^[\w-]{10,80}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  try {
    const accessToken = await getDriveAccessToken();
    const metaR = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name,mimeType,size,parents', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!metaR.ok) return res.status(404).json({ error: 'not_found' });
    const meta = await metaR.json();
    if (Number(meta.size || 0) > 30 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    // v12.5: the file must sit inside a MAYA submission folder. Before this a
    // stolen admin token could read any file in the atelier's entire Drive.
    const parents = Array.isArray(meta.parents) ? meta.parents : [];
    let inside = false;
    for (const p of parents) { if (await isSubmissionFolder(accessToken, p)) { inside = true; break; } }
    if (!inside) return res.status(403).json({ error: 'file_not_allowed' });
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!r.ok) return res.status(502).json({ error: 'drive_' + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buf);
  } catch (e) {
    console.error('[admin] subfile failed,', e.message);
    res.status(500).json({ error: 'subfile_failed', detail: e.message });
  }
});

// POST /api/admin/savepieces — save the dissection (with rendered piece
// images and patterns) as pieces.json inside the submission's Drive folder.
// The Brief loads it on the next open instead of re-dissecting and
// re-rendering, so a submission only ever costs API credits once.
app.post('/api/admin/savepieces', requireAuthHeader, express.json({ limit: '30mb' }), async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const folderId = String((req.body || {}).folderId || '');
  const data = (req.body || {}).data;
  if (!/^[\w-]{10,80}$/.test(folderId) || !data) return res.status(400).json({ error: 'bad_request' });
  try {
    const accessToken = await getDriveAccessToken();
    // v12.5: only ever write inside a MAYA submission folder. Without this the
    // endpoint could write anywhere in the atelier's whole Drive.
    if (!(await isSubmissionFolder(accessToken, folderId))) {
      return res.status(403).json({ error: 'folder_not_allowed' });
    }
    const existing = await driveList(accessToken, {
      q: "'" + folderId + "' in parents and name = 'pieces.json' and trashed = false",
      pageSize: '1',
      fields: 'files(id)',
    });
    const body = JSON.stringify(data);
    let r;
    if (existing.length) {
      r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + existing[0].id + '?uploadType=media', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body,
      });
    } else {
      const boundary = 'mayapieces' + Date.now();
      const multipart =
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify({ name: 'pieces.json', parents: [folderId] }) + '\r\n' +
        '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n' +
        '--' + boundary + '--';
      r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: multipart,
      });
    }
    if (!r.ok) return res.status(502).json({ error: 'drive_' + r.status, detail: (await r.text()).slice(0, 200) });
    const out = await r.json();
    _subsCache = { ts: 0, body: null };
    console.log('[admin] pieces.json saved for folder', folderId, Math.round(body.length / 1024) + 'kb');
    res.json({ ok: true, id: out.id });
  } catch (e) {
    console.error('[admin] savepieces failed,', e.message);
    res.status(500).json({ error: 'savepieces_failed', detail: e.message });
  }
});

// ── Google Analytics (GA4 Data API) via the Cloud Run service account ──────
async function gaMeta(path) {
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/' + path, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!r.ok) throw new Error('metadata ' + r.status);
  return r;
}
async function gaToken() {
  const r = await gaMeta('token?scopes=' + encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly'));
  return (await r.json()).access_token;
}

let _gaProp = { id: null, ts: 0 };

// GET /api/admin/analytics — realtime + today/7d/28d traffic. Returns
// { ok:false, reason, saEmail } (HTTP 200) when GA access isn't set up yet,
// so the dashboard can render setup instructions instead of an error.
app.get('/api/admin/analytics', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  let saEmail = null;
  try { saEmail = await (await gaMeta('email')).text(); } catch (_) {}
  try {
    const token = await gaToken();
    // v11.49 (Codex M11): explicit property pin wins over "first visible".
    if (process.env.GA_PROPERTY_ID && _gaProp.id !== 'properties/' + process.env.GA_PROPERTY_ID.replace(/^properties\//, '')) {
      _gaProp = { id: 'properties/' + process.env.GA_PROPERTY_ID.replace(/^properties\//, ''), ts: Date.now() };
    }
    if (!_gaProp.id || Date.now() - _gaProp.ts > 3600000) {
      const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!r.ok) throw new Error('ga admin ' + r.status + ': ' + (await r.text()).slice(0, 300));
      const prop = ((await r.json()).accountSummaries || []).flatMap(a => a.propertySummaries || [])[0];
      if (!prop) throw new Error('no GA property visible to ' + (saEmail || 'the service account'));
      _gaProp = { id: prop.property, ts: Date.now() };
    }
    const hdr = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
    const base = 'https://analyticsdata.googleapis.com/v1beta/' + _gaProp.id;
    const [rep, rt, geo] = await Promise.all([
      fetch(base + ':runReport', { method: 'POST', headers: hdr, body: JSON.stringify({
        dateRanges: [
          { startDate: 'today',     endDate: 'today', name: 'today' },
          { startDate: '7daysAgo',  endDate: 'today', name: 'd7'    },
          { startDate: '28daysAgo', endDate: 'today', name: 'd28'   },
        ],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      }) }).then(r => { if (!r.ok) throw new Error('ga report ' + r.status); return r.json(); }),
      fetch(base + ':runRealtimeReport', { method: 'POST', headers: hdr, body: JSON.stringify({
        metrics: [{ name: 'activeUsers' }],
      }) }).then(r => { if (!r.ok) throw new Error('ga realtime ' + r.status); return r.json(); }),
      fetch(base + ':runReport', { method: 'POST', headers: hdr, body: JSON.stringify({
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: '5',
      }) }).then(r => { if (!r.ok) throw new Error('ga geo ' + r.status); return r.json(); }),
    ]);
    const ranges = { today: { users: 0, views: 0 }, d7: { users: 0, views: 0 }, d28: { users: 0, views: 0 } };
    for (const row of (rep.rows || [])) {
      const key = row.dimensionValues && row.dimensionValues[0] && row.dimensionValues[0].value;
      if (ranges[key]) {
        ranges[key].users = Number(row.metricValues[0].value || 0);
        ranges[key].views = Number(row.metricValues[1].value || 0);
      }
    }
    const liveRow = (rt.rows || [])[0];
    const countries = (geo.rows || []).map(r2 => ({
      name: r2.dimensionValues[0].value, users: Number(r2.metricValues[0].value || 0),
    }));
    res.json({ ok: true, live: liveRow ? Number(liveRow.metricValues[0].value || 0) : 0,
               ranges, countries, property: _gaProp.id, ts: new Date().toISOString() });
  } catch (e) {
    console.warn('[admin] analytics unavailable —', e.message);
    res.json({ ok: false, reason: e.message, saEmail });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('[maya-api] listening on', port));
