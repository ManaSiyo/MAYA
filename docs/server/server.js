// ═══════════════════════════════════════════════════════════════════════════
// MAYA — Cloud Run API service (replaces the three Vercel functions)
//
//   /api/openai/*   → authenticated passthrough to api.openai.com
//                     (JSON *and* multipart — images/edits, audio/transcriptions)
//   /api/submit     → submission store (open a submission / upload its files)
//                     v13.27: MAYA's OWN Cloud Storage bucket, written with the
//                     service account this server already runs as. No Google
//                     Drive, no OAuth refresh token, nothing that expires.
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
//   SUBMISSIONS_BUCKET          — optional; defaults to MAYA's own Firebase
//                                 Storage bucket. Submissions live under the
//                                 submissions/ prefix inside it.
//   RUNWAY_API_KEY              — optional; absent → /api/runway returns 501
//   FAL_API_KEY                 — optional; absent → /api/fal/* returns 501
//   STRIPE_SECRET_KEY           — optional; absent → /api/tip returns 501
// ═══════════════════════════════════════════════════════════════════════════

import express from 'express';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import dns from 'node:dns/promises';
import {
  applyVisualRankings,
  buildVisualRankingRequest,
  collectRetailerResults,
} from './fabric-sourcing.js';
import {
  AI_TASKS,
  AiRouteError,
  createConsoleAiTelemetry,
  createTaskRouter,
} from './ai-router.js';

function openAiFailureCategory(status, body) {
  const code = String(body?.error?.code || body?.error?.type || '').toLowerCase();
  if (/safety|policy|moderation/.test(code)) return 'safety';
  if (status >= 500) return 'provider_5xx';
  if (status === 408 || status === 409 || status === 429) return 'provider_overloaded';
  if (status === 401 || status === 403) return 'provider_auth';
  return 'provider_4xx';
}

const aiTaskRouter = createTaskRouter({
  tasks: AI_TASKS,
  providers: {
    openai: {
      async execute({ route, input, signal }) {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
          throw new AiRouteError('OpenAI is not configured', {
            category: 'provider_config', provider: 'openai',
          });
        }
        const upstream = await fetch('https://api.openai.com/' + route.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...(input.body || {}), model: route.model }),
          signal,
        });
        const body = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          throw new AiRouteError('OpenAI task failed', {
            category: openAiFailureCategory(upstream.status, body),
            provider: 'openai',
            status: upstream.status,
          });
        }
        return body;
      },
    },
  },
  telemetry: createConsoleAiTelemetry(),
});

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
// the submission store was unreachable. It now reports what is configured and,
// on /api/healthz/deep, whether the store really answers.
function _healthz(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true, service: 'maya-api', ts: new Date().toISOString(),
    configured: {
      openai: !!process.env.OPENAI_API_KEY,
      // v13.27: submissions live in MAYA's own bucket now. `drive` is kept as
      // a mirror for one version so an old cached page still reads something.
      submissions: !!SUBMISSIONS_BUCKET,
      drive:  !!SUBMISSIONS_BUCKET,
      fal:    !!process.env.FAL_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
    },
  });
}
// v13.0: admin only, time limited, and it never echoes Google's raw error text
// (which can contain client identifiers). Open to the world it was a free way
// to make the atelier's storage authorisation refresh on demand.
app.get('/api/healthz/deep', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const out = { ok: true, openai: !!process.env.OPENAI_API_KEY,
                submissions: false, drive: false, detail: '' };
  try {
    // v13.27: can this server actually reach the bucket its submissions live
    // in. The old check asked Google Drive whether an OAuth refresh token was
    // still alive, which is the thing that kept dying every few days.
    const tok = await serviceToken('https://www.googleapis.com/auth/devstorage.read_write');
    const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
      encodeURIComponent(SUBMISSIONS_BUCKET) + '?fields=name', {
      headers: { 'Authorization': 'Bearer ' + tok },
      signal: AbortSignal.timeout(5000),
    });
    out.submissions = r.ok;
    if (!r.ok) out.detail = 'submissions_' + r.status;
  } catch (e) {
    console.error('[healthz deep]', (e && e.message) || e);
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    out.detail = timedOut ? 'submissions_timeout' : 'submissions_error';
  }
  out.drive = out.submissions;
  out.ok = out.openai && out.submissions;
  res.json(out);
});
app.get('/healthz', _healthz);
app.get('/api/healthz', _healthz);

// Admin allow list, needed by the rate limiter and every /api/admin route.
// If ADMIN_EMAILS is set (even to empty) it is authoritative.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS !== undefined
  ? process.env.ADMIN_EMAILS
  : 'fromsa@manasiyo.com,worldofsiyo@gmail.com')   // v13.43: two admins, per Fromsa
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
  noteUser(payload.sub, payload.email);
  return { email: payload.email, sub: payload.sub };
}

// ── v13.33: HOW MANY PEOPLE HAVE ACTUALLY USED MAYA ────────────────────────
// Analytics counts browsers. This counts accounts: one tiny object per Google
// account that has ever reached the API, named by a one way hash of the
// account id, so the count is exact and no address is stored. Written once per
// account per instance, never on the request path (fire and forget).
const USERS_PREFIX = 'metrics/users/';
// v13.43: the marker now carries the account's address and when it was last
// seen, so Admin can answer WHO, not only how many. Refreshed at most every
// half hour per instance, off the request path, admin-eyes only.
const _seenUsers = new Map();   // sub -> last write ms
function noteUser(sub, email) {
  try {
    if (!sub) return;
    const last = _seenUsers.get(sub) || 0;
    if (Date.now() - last < 30 * 60 * 1000) return;
    _seenUsers.set(sub, Date.now());
    if (_seenUsers.size > 20000) _seenUsers.clear();
    const id = crypto.createHash('sha256').update(String(sub)).digest('hex').slice(0, 24);
    gcsGet(USERS_PREFIX + id + '.json').then(o => {
      let doc = { firstSeenMs: Date.now() };
      if (o.ok) { try { doc = JSON.parse(o.buf.toString('utf8')) || doc; } catch (_) {} }
      doc.email = String(email || doc.email || '').slice(0, 120);
      doc.lastSeenMs = Date.now();
      if (!doc.firstSeenMs) doc.firstSeenMs = Date.now();
      return gcsPut(USERS_PREFIX + id + '.json',
        Buffer.from(JSON.stringify(doc), 'utf8'), 'application/json');
    }).catch(() => {});
  } catch (_) {}
}
// The count, cached for a minute. Returns the total and how many are new in
// the last 7 and 28 days, read from when each object was created.
let _usersCache = { ts: 0, total: 0, d7: 0, d28: 0 };
async function countUsers() {
  if (Date.now() - _usersCache.ts < 60000) return _usersCache;
  const tok = await serviceToken(STORAGE_SCOPE);
  let total = 0, d7 = 0, d28 = 0, page = '', guard = 0;
  const now = Date.now();
  do {
    const qs = new URLSearchParams({ prefix: USERS_PREFIX, maxResults: '1000',
                                     fields: 'items(name,timeCreated),nextPageToken' });
    if (page) qs.set('pageToken', page);
    const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
      encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?' + qs.toString(), {
      headers: { 'Authorization': 'Bearer ' + tok }, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('users list ' + r.status);
    const j = await r.json();
    for (const it of (j.items || [])) {
      total++;
      const t = Date.parse(it.timeCreated || '');
      if (!Number.isFinite(t)) continue;
      if (now - t < 7 * 86400000) d7++;
      if (now - t < 28 * 86400000) d28++;
    }
    page = j.nextPageToken || '';
  } while (page && ++guard < 10);
  _usersCache = { ts: Date.now(), total, d7, d28 };
  return _usersCache;
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
    // v13.28: the meter. MAYA counts its own spending here, because OpenAI
    // will not tell an application key what the balance is.
    noteSpend(upstreamPath, req);
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
// /api/submit — one submission: open it, then upload its files (v13.27 writes
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

  // v13.27: no OAuth, no Drive. This server writes into MAYA's own bucket
  // with the identity Cloud Run already gave it, which cannot expire or be
  // revoked by a human clicking something in a console.
  console.log('[submit] action=' + body.action, 'user=' + user.email, 'bucket=' + SUBMISSIONS_BUCKET);

  if (body.action === 'init') {
    // The submission id IS its folder: readable, sortable, and unguessable at
    // the end so two clients with one name on one day cannot collide.
    const clientName = (body.client_name || 'client').toString().trim().slice(0, 60) || 'client';
    const safeClient = clientName.replace(/[^A-Za-z0-9 _-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'client';
    const d = new Date();
    const stamp = String(d.getMonth() + 1).padStart(2, '0') + '-' +
                  String(d.getDate()).padStart(2, '0') + '-' + d.getFullYear();
    const subId = (safeClient + '-' + stamp + '-' + crypto.randomBytes(3).toString('hex')).replace(/ /g, '_');
    try {
      // A marker object so the submission exists the moment it is opened, even
      // if the designer never uploads a file. It also carries the real name.
      await gcsPut(SUB_PREFIX + subId + '/submission.json', Buffer.from(JSON.stringify({
        client: clientName, openedAtMs: Date.now(), openedBy: user.email, schema: 'v13.27',
      }), 'utf8'), 'application/json');
      _subsCache = { ts: 0, body: null };     // show up on the Systems Map immediately
      _subOwners.set(subId, user.email);
      console.log('[submit] init OK —', subId);
      return res.json({ ok: true, folder_id: subId, folder_name: safeClient + '-' + stamp });
    } catch (e) {
      console.error('[submit] 500 submission_open_failed —', e.message);
      return res.status(500).json({ error: 'submission_open_failed', detail: e.message });
    }
  }

  if (body.action === 'upload') {
    if (!body.folder_id) return res.status(400).json({ error: 'no_folder_id' });
    if (!body.name || !body.data_b64) return res.status(400).json({ error: 'no_file' });
    const subId = String(body.folder_id);
    // One flat namespace, one shape. No slashes, no dots, no traversal, so a
    // caller can only ever write inside one submission of its own.
    if (!SUB_ID.test(subId)) {
      console.warn('[submit] blocked folder id', subId, 'by', user.email);
      return res.status(403).json({ error: 'folder_not_allowed' });
    }
    // v13.41 SECURITY: a submission belongs to whoever opened it. Any signed
    // in account used to be able to overwrite files in any submission it
    // could name; now the marker written at init is the lock, checked here
    // and remembered so one submission costs one read, not one per file.
    const owner = await subOwner(subId);
    if (owner && owner !== user.email) {
      console.warn('[submit] blocked cross-account upload into', subId, 'by', user.email);
      return res.status(403).json({ error: 'not_your_submission' });
    }
    // Only the files MAYA itself writes, with the types it writes them as.
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
      const path = SUB_PREFIX + subId + '/' + safeName;
      await gcsPut(path, bytes, mime);
      _subsCache = { ts: 0, body: null };
      console.log('[submit] upload OK —', path, Math.round(bytes.length / 1024) + 'kb');
      return res.json({ ok: true, file_id: pathToId(path), name: safeName });
    } catch (e) {
      console.error('[submit] 500 upload_failed for "' + body.name + '" —', e.message);
      return res.status(500).json({ error: 'upload_failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: 'unknown_action', detail: 'expected action: init|upload' });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE SUBMISSION STORE, v13.27. Google Drive is gone.
//
// Submissions used to live in one atelier Drive folder reached with an OAuth
// refresh token. That token was revoked twice in four days and each time every
// submission stopped landing, with no fix available in code. Submissions now
// live in MAYA's own Cloud Storage bucket, written with the service account
// Cloud Run runs as. There is no token to expire, no consent screen, no human
// step. One submission is one prefix: submissions/<id>/<file>.
//
// No new dependency: the storage JSON API is called directly with a token from
// the metadata server, exactly as the analytics feed already does.
// ═══════════════════════════════════════════════════════════════════════════
const SUBMISSIONS_BUCKET = process.env.SUBMISSIONS_BUCKET || 'pro-maya.firebasestorage.app';
const SUB_PREFIX = 'submissions/';
const SUB_ID = /^[A-Za-z0-9_-]{3,120}$/;
// v13.41: who opened each submission, remembered so the ownership check on
// every upload costs one storage read per submission, not per file. Bounded.
const _subOwners = new Map();
async function subOwner(subId) {
  if (_subOwners.has(subId)) return _subOwners.get(subId);
  let owner = null;
  try {
    const m = await gcsGet(SUB_PREFIX + subId + '/submission.json');
    if (m.ok) owner = String((JSON.parse(m.buf.toString('utf8')) || {}).openedBy || '') || null;
  } catch (_) {}
  if (_subOwners.size > 5000) _subOwners.clear();
  _subOwners.set(subId, owner);
  return owner;
}

let _svcTok = { key: '', token: '', exp: 0 };
async function serviceToken(scope) {
  if (_svcTok.key === scope && _svcTok.token && Date.now() < _svcTok.exp - 60000) return _svcTok.token;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=' +
    encodeURIComponent(scope), { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('metadata token ' + r.status);
  const j = await r.json();
  if (!j.access_token) throw new Error('no access_token from metadata');
  _svcTok = { key: scope, token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3000) * 1000) };
  return _svcTok.token;
}
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

// A picture is one object; its id in every MAYA screen is its path, url safe.
function pathToId(path) { return Buffer.from(path, 'utf8').toString('base64url'); }
function idToPath(id) {
  let p = '';
  try { p = Buffer.from(String(id), 'base64url').toString('utf8'); } catch (_) { return null; }
  // It must be a file inside a submission. Nothing else is readable, ever.
  if (!p.startsWith(SUB_PREFIX) || p.includes('..')) return null;
  const rest = p.slice(SUB_PREFIX.length).split('/');
  if (rest.length !== 2 || !SUB_ID.test(rest[0]) || !/^[\w.-]{3,80}$/.test(rest[1])) return null;
  return p;
}

async function gcsPut(path, bytes, contentType) {
  const tok = await serviceToken(STORAGE_SCOPE);
  const r = await fetch('https://storage.googleapis.com/upload/storage/v1/b/' +
    encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?uploadType=media&name=' + encodeURIComponent(path), {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': contentType || 'application/octet-stream' },
    body: bytes,
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error('storage put ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return await r.json();
}

async function gcsListSubmissions() {
  // ONE request for the whole feed: every object under submissions/, grouped in
  // memory. The Drive version fanned out into forty calls per refresh.
  const tok = await serviceToken(STORAGE_SCOPE);
  const qs = new URLSearchParams({
    prefix: SUB_PREFIX, maxResults: '1000',
    fields: 'items(name,size,contentType,timeCreated),nextPageToken',
  });
  const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
    encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?' + qs.toString(), {
    headers: { 'Authorization': 'Bearer ' + tok },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('storage list ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return (await r.json()).items || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CREDIT METER, v13.28. What MAYA has spent at OpenAI this month.
//
// OpenAI does not expose an account balance to an application key: only an
// organisation admin key can read billing, and that key has no business living
// on a web server. So MAYA counts its own calls. Every successful call through
// the proxy adds its estimated price, and the Systems Map shows the month
// against a budget.
//
// Prices are estimates, tunable without a deploy through env vars, and the map
// says "estimated" out loud rather than pretending to be a bank statement.
//
// Each Cloud Run instance owns ONE object, metrics/spend/<YYYY-MM>/<id>.json,
// so instances never overwrite each other and the total is their sum.
// ═══════════════════════════════════════════════════════════════════════════
const PRICE_IMAGE = Number(process.env.OPENAI_PRICE_IMAGE || 0.19);
const PRICE_CHAT  = Number(process.env.OPENAI_PRICE_CHAT  || 0.01);
const PRICE_AUDIO = Number(process.env.OPENAI_PRICE_AUDIO || 0.006);
const MONTHLY_BUDGET_USD = Number(process.env.MONTHLY_BUDGET_USD || 50);
// v13.29: what Fromsa actually loaded into OpenAI. When set, the ring counts
// down from THIS instead of an invented budget.
const OPENAI_CREDIT_USD = Number(process.env.OPENAI_CREDIT_USD || 0);
// v13.29: the only way to get REAL numbers out of OpenAI is an organisation
// admin key (sk-admin-...), which can read the Costs API. It is optional: set
// it and the meter reports measured spend, leave it and the meter estimates.
// It is read here and never leaves the server.
const OPENAI_ADMIN_KEY = process.env.OPENAI_ADMIN_KEY || '';
// v13.33: the day the money was loaded, YYYY-MM-DD. The ring counts what has
// been spent SINCE this day against OPENAI_CREDIT_USD, which is the only
// honest reading of "how much of what I put in is left". Without it the meter
// falls back to the calendar month, which flatters the number every 1st.
const OPENAI_CREDIT_SINCE = String(process.env.OPENAI_CREDIT_SINCE || '').trim();
// v13.34: OpenAI has no endpoint that returns a balance. Its own staff say so:
// costs are readable, the remaining prepaid balance is not. So the only honest
// way to show "$4.69 left" is (what you added) minus (what OpenAI says you have
// spent since you added it). The top up is recorded once, from the Systems Map
// itself, and lives in MAYA's own store so no console visit is ever needed.
const CREDIT_DOC = 'metrics/credit.json';
let _topUp = { ts: 0, usd: 0, since: '' };
async function readTopUp() {
  if (Date.now() - _topUp.ts < 30000) return _topUp;
  let out = { usd: 0, since: '' };
  try {
    const o = await gcsGet(CREDIT_DOC);
    if (o.ok) {
      const j = JSON.parse(o.buf.toString('utf8'));
      out = { usd: Number(j.usd) || 0, since: String(j.since || '').slice(0, 10) };
    }
  } catch (_) {}
  // Env vars still win if they are set, so an existing deploy does not change.
  if (OPENAI_CREDIT_USD > 0) out.usd = OPENAI_CREDIT_USD;
  if (OPENAI_CREDIT_SINCE)   out.since = OPENAI_CREDIT_SINCE;
  _topUp = { ts: Date.now(), usd: out.usd, since: out.since };
  return _topUp;
}
function creditStartMs(sinceStr) {
  const t = Date.parse(String(sinceStr || OPENAI_CREDIT_SINCE) + 'T00:00:00Z');
  return Number.isFinite(t) ? t : 0;
}
// OpenAI's own costs, from a moment to now. Cached, because the Costs API is
// slow to move and rate limited.
let _realCost = { ts: 0, key: '', usd: null, error: '' };
async function openAiCostSince(startSec) {
  if (!OPENAI_ADMIN_KEY) return null;
  const key = String(startSec);
  if (_realCost.key === key && _realCost.usd !== null && Date.now() - _realCost.ts < 15 * 60 * 1000) {
    return _realCost.usd;                                  // costs update slowly; 15 min is plenty
  }
  try {
    let usd = 0, page = null, guard = 0;
    do {
      const qs = new URLSearchParams({ start_time: String(startSec), bucket_width: '1d', limit: '31' });
      if (page) qs.set('page', page);
      const r = await fetch('https://api.openai.com/v1/organization/costs?' + qs.toString(), {
        headers: { 'Authorization': 'Bearer ' + OPENAI_ADMIN_KEY },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error('costs ' + r.status);
      const j = await r.json();
      for (const b of (j.data || [])) {
        for (const res of (b.results || [])) usd += Number((res.amount && res.amount.value) || 0);
      }
      page = j.has_more ? j.next_page : null;
    } while (page && ++guard < 24);
    _realCost = { ts: Date.now(), key, usd: Number(usd.toFixed(4)), error: '' };
    return _realCost.usd;
  } catch (e) {
    console.error('[meter] real cost read failed,', e.message);
    _realCost = { ts: Date.now(), key, usd: null, error: String(e.message).slice(0, 80) };
    return null;
  }
}
const METRICS_PREFIX = 'metrics/spend/';
const INSTANCE_ID = crypto.randomBytes(4).toString('hex');

const _spend = { month: '', usd: 0, calls: 0, images: 0, dirty: false, flushing: false, lastFlush: 0 };
function monthKey(d) {
  const t = d || new Date();
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0');
}
function priceOf(path, req) {
  if (/images\/(generations|edits)/.test(path)) {
    // MAYA always asks for one picture at a time; quality changes the price.
    const raw = req && req.body && req.body.length ? req.body.toString('latin1').slice(0, 4000) : '';
    if (/name="quality"[\s\S]{0,40}?\blow\b/.test(raw) || /"quality"\s*:\s*"low"/.test(raw)) return PRICE_IMAGE * 0.25;
    if (/name="quality"[\s\S]{0,40}?\bmedium\b/.test(raw) || /"quality"\s*:\s*"medium"/.test(raw)) return PRICE_IMAGE * 0.5;
    return PRICE_IMAGE;
  }
  if (/audio\/(transcriptions|translations|speech)/.test(path)) return PRICE_AUDIO;
  return PRICE_CHAT;
}
function noteSpend(path, req) {
  try {
    const m = monthKey();
    if (_spend.month !== m) { _spend.month = m; _spend.usd = 0; _spend.calls = 0; _spend.images = 0; }
    const price = priceOf(path, req);
    _spend.usd += price;
    _spend.calls += 1;
    if (/images\//.test(path)) _spend.images += 1;
    _spend.dirty = true;
    // Written at most once a minute: a gauge does not need to be a ledger, and
    // a storage write per render would be its own small bill.
    if (Date.now() - _spend.lastFlush > 60000) flushSpend();
  } catch (e) { console.error('[meter] note failed,', e.message); }
}
async function flushSpend() {
  if (_spend.flushing || !_spend.dirty) return;
  _spend.flushing = true;
  const snapshot = { usd: Number(_spend.usd.toFixed(4)), calls: _spend.calls, images: _spend.images,
                     month: _spend.month, instance: INSTANCE_ID, updatedAtMs: Date.now() };
  try {
    await gcsPut(METRICS_PREFIX + _spend.month + '/' + INSTANCE_ID + '.json',
      Buffer.from(JSON.stringify(snapshot), 'utf8'), 'application/json');
    _spend.dirty = false;
    _spend.lastFlush = Date.now();
  } catch (e) {
    console.error('[meter] flush failed,', e.message);
    _spend.lastFlush = Date.now();        // do not hammer a failing bucket
  } finally { _spend.flushing = false; }
}
// A restart must not lose the month, so the tally is read back once at boot.
let _meterBooted = false;
async function bootMeter() {
  if (_meterBooted) return;
  _meterBooted = true;
  try {
    const own = await gcsGet(METRICS_PREFIX + monthKey() + '/' + INSTANCE_ID + '.json');
    if (own.ok) {
      const j = JSON.parse(own.buf.toString('utf8'));
      if (j && j.month === monthKey()) {
        _spend.month = j.month; _spend.usd = Number(j.usd) || 0;
        _spend.calls = Number(j.calls) || 0; _spend.images = Number(j.images) || 0;
      }
    }
  } catch (_) {}
}

// GET /api/admin/spend — the month's estimated OpenAI spend, every instance
// summed, plus this instance's unwritten remainder so the gauge never lags.
// The other instances' totals are cached; this instance's own tally is added
// live on every request, so the gauge reacts to Fromsa's own next render
// instead of waiting for a cache to lapse.
// v13.33: the tally is kept per month per instance, and the ring may need to
// look further back than this month, so every month from the funding day
// forward is summed.
let _spendCache = { ts: 0, from: '', usd: 0, calls: 0, images: 0 };
app.get('/api/admin/spend', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const month = monthKey();
  const top = await readTopUp();
  const startMs = creditStartMs(top.since);
  const fromMonth = startMs ? monthKey(new Date(startMs)) : month;
  try {
    if (_spendCache.from !== fromMonth || Date.now() - _spendCache.ts > 20000) {
      const tok = await serviceToken(STORAGE_SCOPE);
      const qs = new URLSearchParams({ prefix: METRICS_PREFIX, maxResults: '500',
                                       fields: 'items(name)' });
      const list = await fetch('https://storage.googleapis.com/storage/v1/b/' +
        encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?' + qs.toString(), {
        headers: { 'Authorization': 'Bearer ' + tok }, signal: AbortSignal.timeout(10000),
      });
      if (!list.ok) throw new Error('metrics list ' + list.status);
      const names = ((await list.json()).items || []).map(i => i.name)
        .filter(n => {
          const m = String(n).slice(METRICS_PREFIX.length).split('/')[0];
          return /^\d{4}-\d{2}$/.test(m) && m >= fromMonth;
        });
      let usd = 0, calls = 0, images = 0;
      await Promise.all(names.map(async n => {
        if (n.endsWith('/' + INSTANCE_ID + '.json')) return;      // counted live below
        const o = await gcsGet(n).catch(() => ({ ok: false }));
        if (!o.ok) return;
        try {
          const j = JSON.parse(o.buf.toString('utf8'));
          usd += Number(j.usd) || 0; calls += Number(j.calls) || 0; images += Number(j.images) || 0;
        } catch (_) {}
      }));
      _spendCache = { ts: Date.now(), from: fromMonth, usd, calls, images };
    }
    const mine = _spend.month >= fromMonth ? _spend : { usd: 0, calls: 0, images: 0 };
    const counted = _spendCache.usd + mine.usd;
    // Measured if OpenAI itself told us, estimated if MAYA had to price its
    // own calls. The page says which, always.
    const sinceSec = Math.floor((startMs || Date.parse(month + '-01T00:00:00Z')) / 1000);
    const real = await openAiCostSince(sinceSec);
    const usd = (real === null) ? counted : real;
    // Counting down from the money actually loaded beats an invented budget.
    const funded = top.usd > 0 ? top.usd : MONTHLY_BUDGET_USD;
    // What is still missing before this number can be trusted, in plain words.
    const needs = [];
    if (!(top.usd > 0))    needs.push('the amount of your last top up');
    if (!top.since)        needs.push('the day you topped up');
    if (!OPENAI_ADMIN_KEY) needs.push('an OpenAI admin key, so the figure is OpenAI\u2019s own');
    res.json({
      ok: true,
      estimated: real === null,
      source: real === null ? (OPENAI_ADMIN_KEY ? 'estimate, OpenAI did not answer' : 'estimate') : 'openai',
      basis: top.usd > 0 ? 'credit' : 'budget',
      exact: real !== null && top.usd > 0 && !!top.since,
      hasTopUp: top.usd > 0,
      adminKey: !!OPENAI_ADMIN_KEY,
      needs,
      month,
      since: top.since || (month + '-01'),
      spentUsd: Number(usd.toFixed(2)),
      countedUsd: Number(counted.toFixed(2)),
      budgetUsd: funded,
      fundedUsd: funded,
      remainingUsd: Number(Math.max(0, funded - usd).toFixed(2)),
      pctLeft: funded > 0 ? Math.max(0, Math.min(100, Math.round((1 - usd / funded) * 100))) : null,
      calls: _spendCache.calls + mine.calls,
      images: _spendCache.images + mine.images,
      prices: { image: PRICE_IMAGE, chat: PRICE_CHAT, audio: PRICE_AUDIO },
      ts: new Date().toISOString(),
    });
    // Written after answering, so the gauge is never waiting on a storage write.
    flushSpend().catch(() => {});
  } catch (e) {
    console.error('[meter] read failed,', e.message);
    res.status(500).json({ error: 'spend_failed', detail: 'the meter could not be read' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// v13.41 — FEEDBACK. Problems, ideas and wishes, straight from inside MAYA.
// One object per note, in MAYA's own bucket, so nothing depends on a third
// party and nothing can be lost between a user's mouth and Fromsa's eyes.
// Admin-listed at /api/admin/feedback, newest first.
// ═══════════════════════════════════════════════════════════════════════════
const FEEDBACK_PREFIX = 'feedback/';
app.post('/api/feedback', requireAuthHeader, express.json({ limit: '16kb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) return res.status(429).json({ error: 'rate_limited', scope: rl.scope });
  const text = String((req.body || {}).text || '').trim().slice(0, 4000);
  if (text.length < 3) return res.status(400).json({ error: 'empty_feedback' });
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  try {
    await gcsPut(FEEDBACK_PREFIX + id + '.json', Buffer.from(JSON.stringify({
      text,
      email: user.email,
      page: String((req.body || {}).page || '').slice(0, 40),
      version: String((req.body || {}).version || '').slice(0, 12),
      ua: String(req.headers['user-agent'] || '').slice(0, 200),
      ts: new Date().toISOString(),
    }), 'utf8'), 'application/json');
    console.log('[feedback] from', user.email, '—', text.slice(0, 80));
    return res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] write failed —', e.message);
    return res.status(500).json({ error: 'feedback_failed' });
  }
});

// GET /api/admin/users — who has signed in, newest activity first. Powers the
// hover on the Users tile. Accounts counted before names were kept show blank.
app.get('/api/admin/users', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  try {
    const tok = await serviceToken(STORAGE_SCOPE);
    const qs = new URLSearchParams({ prefix: USERS_PREFIX, maxResults: '1000', fields: 'items(name,timeCreated)' });
    const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
      encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?' + qs.toString(), {
      headers: { 'Authorization': 'Bearer ' + tok }, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('list ' + r.status);
    const items = ((await r.json()).items || []);
    const docs = (await Promise.all(items.slice(0, 200).map(async it => {
      const o = await gcsGet(it.name).catch(() => ({ ok: false }));
      if (!o.ok) return null;
      try {
        const j = JSON.parse(o.buf.toString('utf8')) || {};
        return { email: j.email || '', firstSeenMs: j.firstSeenMs || Date.parse(it.timeCreated || '') || 0,
                 lastSeenMs: j.lastSeenMs || j.firstSeenMs || 0 };
      } catch (_) { return null; }
    }))).filter(Boolean).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    res.json({ ok: true, total: items.length, users: docs.slice(0, 50) });
  } catch (e) {
    console.error('[admin] users list failed —', e.message);
    res.status(500).json({ error: 'users_failed' });
  }
});

app.get('/api/admin/feedback', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  try {
    const tok = await serviceToken(STORAGE_SCOPE);
    const qs = new URLSearchParams({ prefix: FEEDBACK_PREFIX, maxResults: '1000', fields: 'items(name)' });
    const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
      encodeURIComponent(SUBMISSIONS_BUCKET) + '/o?' + qs.toString(), {
      headers: { 'Authorization': 'Bearer ' + tok }, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error('list ' + r.status);
    const names = ((await r.json()).items || []).map(i => i.name).sort().reverse().slice(0, 50);
    const notes = (await Promise.all(names.map(async n => {
      const o = await gcsGet(n).catch(() => ({ ok: false }));
      if (!o.ok) return null;
      try { return JSON.parse(o.buf.toString('utf8')); } catch (_) { return null; }
    }))).filter(Boolean);
    res.json({ ok: true, total: names.length, notes });
  } catch (e) {
    console.error('[admin] feedback list failed —', e.message);
    res.status(500).json({ error: 'feedback_list_failed' });
  }
});

// GET/POST /api/admin/credit — the last top up, told once from the Systems Map.
// Nothing sensitive: an amount and a date. Admin only, like every /admin route.
app.get('/api/admin/credit', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const t = await readTopUp();
  res.json({ ok: true, usd: t.usd, since: t.since, locked: OPENAI_CREDIT_USD > 0 || !!OPENAI_CREDIT_SINCE });
});
app.post('/api/admin/credit', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const usd = Number((req.body || {}).usd);
  const since = String((req.body || {}).since || '').slice(0, 10);
  if (!(usd > 0) || usd > 100000) return res.status(400).json({ error: 'bad_amount' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !Number.isFinite(Date.parse(since + 'T00:00:00Z'))) {
    return res.status(400).json({ error: 'bad_date' });
  }
  try {
    await gcsPut(CREDIT_DOC, Buffer.from(JSON.stringify({
      usd: Number(usd.toFixed(2)), since, setBy: user.email, setAtMs: Date.now(),
    }), 'utf8'), 'application/json');
    _topUp = { ts: 0, usd: 0, since: '' };          // read it back fresh
    _realCost = { ts: 0, key: '', usd: null, error: '' };
    _spendCache = { ts: 0, from: '', usd: 0, calls: 0, images: 0 };
    console.log('[meter] top up recorded by', user.email, '—', usd, since);
    res.json({ ok: true, usd, since });
  } catch (e) {
    console.error('[meter] top up write failed,', e.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

async function gcsGet(path) {
  const tok = await serviceToken(STORAGE_SCOPE);
  const r = await fetch('https://storage.googleapis.com/storage/v1/b/' +
    encodeURIComponent(SUBMISSIONS_BUCKET) + '/o/' + encodeURIComponent(path) + '?alt=media', {
    headers: { 'Authorization': 'Bearer ' + tok },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return { ok: false, status: r.status };
  return {
    ok: true,
    type: r.headers.get('content-type') || 'application/octet-stream',
    buf: Buffer.from(await r.arrayBuffer()),
  };
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

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/imgproxy?u=<picture address> — v13.26. Read one of MAYA's own
// stored pictures back through this server, same origin.
//
// Why this exists: since projects moved to the cloud, a card's picture is a
// Firebase Storage address, not a data URL. The browser will happily DRAW a
// cross origin picture in an <img>, but it refuses to let JavaScript READ the
// bytes unless the bucket returns CORS headers. Visualize and Modify have to
// read the bytes, because gpt-image-2 takes the previous picture as an anchor.
// The bucket had no CORS rule, so every render on a saved project died with
// "Failed to fetch" and the app said "connection hiccup".
//
// Setting CORS on the bucket is still the right permanent fix. This endpoint
// means MAYA never depends on that setting being right: the browser tries the
// picture directly first, and falls back through here.
//
// Only MAYA's own storage hosts, only for a signed in user, rate limited,
// size capped, and never a redirect follower to somewhere else.
// ═══════════════════════════════════════════════════════════════════════════
const IMGPROXY_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'pro-maya.firebasestorage.app',
  'pro-maya.appspot.com',
]);
const IMGPROXY_MAX = 25 * 1024 * 1024;
app.get('/api/imgproxy', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rlI = rateLimit(user.sub, user.email);
  if (!rlI.ok) return res.status(429).json({ error: 'rate_limited', scope: rlI.scope });

  let target;
  try { target = new URL(String(req.query.u || '')); }
  catch (_) { return res.status(400).json({ error: 'bad_url' }); }
  if (target.protocol !== 'https:' || !IMGPROXY_HOSTS.has(target.hostname)) {
    console.warn('[imgproxy] refused host', target.hostname, 'for', user.email);
    return res.status(403).json({ error: 'host_not_allowed' });
  }

  try {
    const r = await fetch(target.toString(), {
      redirect: 'error',                       // no hopping to another host
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: 'upstream_' + r.status });
    const type = r.headers.get('content-type') || 'application/octet-stream';
    if (!/^image\/|^video\//.test(type)) return res.status(415).json({ error: 'not_a_picture' });
    const len = Number(r.headers.get('content-length') || 0);
    if (len && len > IMGPROXY_MAX) return res.status(413).json({ error: 'too_large' });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > IMGPROXY_MAX) return res.status(413).json({ error: 'too_large' });
    res.end(buf);
  } catch (e) {
    console.error('[imgproxy] failed,', e.message);
    res.status(502).json({ error: 'fetch_failed', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/fetchpic?u=<picture address> — v13.31. Bring a picture from
// ANYWHERE on the web onto a MAYA board.
//
// The browser cannot read the bytes of a picture it did not serve, so pasting
// or dragging an image address from Pinterest, a lookbook or a shop page used
// to be impossible. This reads it server side and hands it back.
//
// A server that fetches any address a user names is a classic hole: point it
// at 169.254.169.254 and it reads Google's metadata, which holds this server's
// own identity. So the host is resolved FIRST and refused if it lands on a
// private, loopback or link local address, no redirect is followed, the answer
// must be an image, and it is capped.
// ═══════════════════════════════════════════════════════════════════════════
const FETCHPIC_MAX = 20 * 1024 * 1024;
function isPrivateAddress(ip) {
  if (!ip) return true;
  const v = String(ip);
  if (v === '::1' || v === '0.0.0.0' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  const p = v.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return v.includes(':') ? false : true;
  if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
  if (p[0] === 169 && p[1] === 254) return true;                 // link local, the metadata server
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;    // carrier grade NAT
  return false;
}

app.get('/api/fetchpic', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const rlF = rateLimit(user.sub, user.email);
  if (!rlF.ok) return res.status(429).json({ error: 'rate_limited', scope: rlF.scope });

  let target;
  try { target = new URL(String(req.query.u || '')); }
  catch (_) { return res.status(400).json({ error: 'bad_url' }); }
  if (target.protocol !== 'https:') return res.status(400).json({ error: 'https_only' });
  if (/^\[?(?:\d{1,3}\.){3}\d{1,3}\]?$/.test(target.hostname) || target.hostname.endsWith('.internal')) {
    return res.status(403).json({ error: 'host_not_allowed' });
  }
  try {
    const addrs = await dns.lookup(target.hostname, { all: true });
    if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) {
      console.warn('[fetchpic] refused private host', target.hostname, 'for', user.email);
      return res.status(403).json({ error: 'host_not_allowed' });
    }
  } catch (_) { return res.status(400).json({ error: 'host_unknown' }); }

  try {
    const r = await fetch(target.toString(), {
      redirect: 'error',
      headers: { 'Accept': 'image/*', 'User-Agent': 'MAYA/13.31 (+https://maya.manasiyo.com)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: 'upstream_' + r.status });
    const type = r.headers.get('content-type') || '';
    if (!/^image\//.test(type)) return res.status(415).json({ error: 'not_a_picture' });
    const len = Number(r.headers.get('content-length') || 0);
    if (len && len > FETCHPIC_MAX) return res.status(413).json({ error: 'too_large' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > FETCHPIC_MAX) return res.status(413).json({ error: 'too_large' });
    res.setHeader('Content-Type', type.split(';')[0].trim());
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.end(buf);
  } catch (e) {
    console.error('[fetchpic] failed,', e.message);
    res.status(502).json({ error: 'fetch_failed', detail: 'that address did not give a picture' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PINTEREST, v13.31. Sign in with Pinterest, browse your own boards, pick
// pictures, and they land on the MAYA board as inspiration.
//
// The secret half of this lives here and only here. The browser never sees the
// app secret or the Pinterest token: it asks this server for a sign-in link,
// Pinterest sends the person back to /api/pinterest/callback, and the tokens
// are kept server side, one small file per MAYA account, in MAYA's own bucket.
//
// Dormant until PINTEREST_APP_ID and PINTEREST_APP_SECRET are set on Cloud
// Run. Until then /status answers configured:false and the app hides the
// button, so nobody is offered something that cannot work.
//
// Pinterest access tiers matter: a new app is Trial, which works for the app's
// own account and its listed testers. Everyone else needs Standard access,
// which Pinterest grants after reviewing a video of this exact flow.
// ═══════════════════════════════════════════════════════════════════════════
const PIN_APP_ID     = process.env.PINTEREST_APP_ID || '';
const PIN_APP_SECRET = process.env.PINTEREST_APP_SECRET || '';
const PIN_REDIRECT   = process.env.PINTEREST_REDIRECT_URI ||
                       'https://maya.manasiyo.com/api/pinterest/callback';
const PIN_SCOPES     = process.env.PINTEREST_SCOPES || 'boards:read,pins:read,user_accounts:read';
const PIN_API        = 'https://api.pinterest.com/v5';
const PIN_PREFIX     = 'pinterest/';
const pinConfigured  = () => !!(PIN_APP_ID && PIN_APP_SECRET);
const pinBasic = () => 'Basic ' + Buffer.from(PIN_APP_ID + ':' + PIN_APP_SECRET).toString('base64');

// The state carries the MAYA account through Pinterest and back, signed so a
// stranger cannot hand us a callback for somebody else's account.
function pinState(uid) {
  const body = uid + '.' + Date.now();
  const mac = crypto.createHmac('sha256', PIN_APP_SECRET).update(body).digest('base64url').slice(0, 32);
  return Buffer.from(body + '.' + mac, 'utf8').toString('base64url');
}
function pinReadState(state) {
  let raw = '';
  try { raw = Buffer.from(String(state || ''), 'base64url').toString('utf8'); } catch (_) { return null; }
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [uid, ts, mac] = parts;
  const want = crypto.createHmac('sha256', PIN_APP_SECRET).update(uid + '.' + ts).digest('base64url').slice(0, 32);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  if (Date.now() - Number(ts) > 20 * 60 * 1000) return null;      // a sign in takes minutes, not hours
  return uid;
}

const pinPath = (uid) => PIN_PREFIX + uid + '.json';
async function pinLoad(uid) {
  const o = await gcsGet(pinPath(uid)).catch(() => ({ ok: false }));
  if (!o.ok) return null;
  try { return JSON.parse(o.buf.toString('utf8')); } catch (_) { return null; }
}
async function pinSave(uid, tok) {
  await gcsPut(pinPath(uid), Buffer.from(JSON.stringify(tok), 'utf8'), 'application/json');
}
async function pinForget(uid) {
  const tok = await serviceToken(STORAGE_SCOPE);
  await fetch('https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(SUBMISSIONS_BUCKET) +
    '/o/' + encodeURIComponent(pinPath(uid)), {
    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tok }, signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// Every Pinterest call goes through here, so a token that aged out is renewed
// once and the caller never sees it.
async function pinFetch(uid, path, retry) {
  const stored = await pinLoad(uid);
  if (!stored || !stored.access_token) { const e = new Error('not connected'); e.code = 'not_connected'; throw e; }
  if (stored.expiresAtMs && Date.now() > stored.expiresAtMs - 60000 && stored.refresh_token && !retry) {
    const fresh = await pinRefresh(uid, stored);
    if (!fresh) { const e = new Error('reconnect'); e.code = 'reconnect'; throw e; }
  }
  const use = retry ? stored : (await pinLoad(uid)) || stored;
  const r = await fetch(PIN_API + path, {
    headers: { 'Authorization': 'Bearer ' + use.access_token },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 401 && !retry && use.refresh_token) {
    const fresh = await pinRefresh(uid, use);
    if (fresh) return pinFetch(uid, path, true);
    const e = new Error('reconnect'); e.code = 'reconnect'; throw e;
  }
  if (!r.ok) {
    const e = new Error('pinterest ' + r.status + ': ' + (await r.text()).slice(0, 200));
    e.code = r.status === 403 ? 'not_allowed' : 'pinterest_error';
    throw e;
  }
  return await r.json();
}
async function pinRefresh(uid, stored) {
  try {
    const r = await fetch(PIN_API + '/oauth/token', {
      method: 'POST',
      headers: { 'Authorization': pinBasic(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: stored.refresh_token }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.error('[pinterest] refresh ' + r.status); await pinForget(uid); return null; }
    const j = await r.json();
    const next = {
      access_token: j.access_token,
      refresh_token: j.refresh_token || stored.refresh_token,
      expiresAtMs: Date.now() + (Number(j.expires_in || 2592000) * 1000),
      connectedAtMs: stored.connectedAtMs || Date.now(),
    };
    await pinSave(uid, next);
    return next;
  } catch (e) { console.error('[pinterest] refresh failed,', e.message); return null; }
}

app.get('/api/pinterest/status', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  if (!pinConfigured()) return res.json({ ok: true, configured: false, connected: false });
  const stored = await pinLoad(user.sub);
  // v13.39: the address MAYA will ask Pinterest to come back to. Not a secret,
  // and the single most common reason a sign in dies is that this exact string
  // is not listed in the Pinterest app, so the app can show it.
  res.json({ ok: true, configured: true, connected: !!(stored && stored.access_token),
             redirect: PIN_REDIRECT,
             connectedAtMs: (stored && stored.connectedAtMs) || null });
});

app.get('/api/pinterest/start', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  if (!pinConfigured()) return res.status(501).json({ error: 'not_configured' });
  const qs = new URLSearchParams({
    client_id: PIN_APP_ID, redirect_uri: PIN_REDIRECT, response_type: 'code',
    scope: PIN_SCOPES, state: pinState(user.sub),
  });
  res.json({ ok: true, url: 'https://www.pinterest.com/oauth/?' + qs.toString() });
});

// Pinterest sends the person here. No MAYA sign in on this request: the signed
// state is what says which account is connecting.
app.get('/api/pinterest/callback', async (req, res) => {
  const done = (msg, ok) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pinterest</title></head>' +
      '<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;' +
      'background:#05070f;color:#eef3ff;font-family:-apple-system,system-ui,sans-serif;font-weight:300">' +
      '<div style="text-align:center"><div style="font-size:15px;letter-spacing:0.04em"></div></div>' +
      '<script>document.querySelector("div div").textContent=' + JSON.stringify(msg) + ';' +
      'try{window.opener&&window.opener.postMessage({maya:"pinterest",ok:' + (ok ? 'true' : 'false') +
      '},window.location.origin);}catch(e){}' +
      'setTimeout(function(){window.close();},' + (ok ? '900' : '2600') + ');<\/script></body></html>');
  };
  if (!pinConfigured()) return done('Pinterest is not set up on this server.', false);
  const uid = pinReadState(req.query.state);
  if (!uid) return done('That sign in expired. Try again from MAYA.', false);
  if (!req.query.code) return done('Pinterest did not send a code back.', false);
  try {
    const r = await fetch(PIN_API + '/oauth/token', {
      method: 'POST',
      headers: { 'Authorization': pinBasic(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: PIN_REDIRECT,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      console.error('[pinterest] token exchange ' + r.status, (await r.text()).slice(0, 200));
      return done('Pinterest refused the sign in.', false);
    }
    const j = await r.json();
    if (!j.access_token) return done('Pinterest sent no token.', false);
    await pinSave(uid, {
      access_token: j.access_token,
      refresh_token: j.refresh_token || '',
      expiresAtMs: Date.now() + (Number(j.expires_in || 2592000) * 1000),
      connectedAtMs: Date.now(),
    });
    console.log('[pinterest] connected for', uid.slice(0, 6) + '…');
    done('Connected. You can close this.', true);
  } catch (e) {
    console.error('[pinterest] callback failed,', e.message);
    done('Could not finish the sign in.', false);
  }
});

app.post('/api/pinterest/disconnect', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  await pinForget(user.sub);
  res.json({ ok: true });
});

const pinErr = (res, e) => {
  const code = (e && e.code) || 'pinterest_error';
  console.error('[pinterest]', (e && e.message) || e);
  const status = code === 'not_connected' || code === 'reconnect' ? 401 : (code === 'not_allowed' ? 403 : 502);
  res.status(status).json({ error: code });
};

app.get('/api/pinterest/boards', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  if (!pinConfigured()) return res.status(501).json({ error: 'not_configured' });
  try {
    const j = await pinFetch(user.sub, '/boards?page_size=50');
    const boards = (j.items || []).map(b => ({
      id: String(b.id), name: String(b.name || 'board').slice(0, 80),
      pins: Number(b.pin_count || 0),
      cover: (b.media && (b.media.image_cover_url || b.media.pin_thumbnail_urls?.[0])) || '',
    }));
    res.json({ ok: true, boards });
  } catch (e) { pinErr(res, e); }
});

app.get('/api/pinterest/pins', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  if (!pinConfigured()) return res.status(501).json({ error: 'not_configured' });
  // v13.36: no board means everything the account has saved, newest first,
  // which is what "all saves" means to a person looking at Pinterest.
  const board = String(req.query.board || '');
  if (board && !/^[\w-]{1,64}$/.test(board)) return res.status(400).json({ error: 'bad_board' });
  const bookmark = String(req.query.bookmark || '');
  try {
    const qs = new URLSearchParams({ page_size: '48' });
    if (bookmark) qs.set('bookmark', bookmark);
    const path = board ? ('/boards/' + board + '/pins?' + qs.toString())
                       : ('/pins?' + qs.toString());
    const j = await pinFetch(user.sub, path);
    // The picture comes in several sizes under media.images; take the biggest
    // one Pinterest offers, whatever they happen to call it this year.
    const biggest = (images) => {
      if (!images || typeof images !== 'object') return '';
      let best = '', bestW = -1;
      for (const [key, val] of Object.entries(images)) {
        const url = val && val.url;
        if (!url) continue;
        const w = key === 'originals' ? 99999 : Number((val.width) || (String(key).split('x')[0]) || 0);
        if (w > bestW) { bestW = w; best = url; }
      }
      return best;
    };
    const pins = (j.items || []).map(p => ({
      id: String(p.id),
      url: biggest(p.media && p.media.images) || '',
      alt: String(p.alt_text || p.title || '').slice(0, 120),
    })).filter(p => p.url);
    res.json({ ok: true, pins, bookmark: j.bookmark || null });
  } catch (e) { pinErr(res, e); }
});

// GET /api/admin/submissions — every submission in MAYA's own store, newest
// first, with its files. Powers the Systems Map strip and the Brief.
app.get('/api/admin/submissions', async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  if (_subsCache.body && Date.now() - _subsCache.ts < 15000) {
    return res.json(_subsCache.body);
  }
  try {
    // v13.27: one list of MAYA's own bucket, grouped here. Newest first, by the
    // oldest file in each submission, which is when the submission was opened.
    const items = await gcsListSubmissions();
    const byId = new Map();
    for (const it of items) {
      const rest = String(it.name || '').slice(SUB_PREFIX.length).split('/');
      if (rest.length !== 2 || !rest[1]) continue;                  // not a submission file
      const id = rest[0];
      if (!SUB_ID.test(id)) continue;
      if (!byId.has(id)) byId.set(id, { id, name: id, createdTime: it.timeCreated, files: [] });
      const sub = byId.get(id);
      if (it.timeCreated && it.timeCreated < sub.createdTime) sub.createdTime = it.timeCreated;
      // submission.json is MAYA's own marker, not a file the atelier browses.
      if (rest[1] === 'submission.json') { sub.marker = it.name; continue; }
      sub.files.push({
        id: pathToId(it.name), name: rest[1], mime: it.contentType || '',
        size: Number(it.size || 0), createdTime: it.timeCreated,
        url: '/api/admin/subfile?id=' + pathToId(it.name),
      });
    }
    const folders = [...byId.values()]
      .sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
    // The client's real name lives in the marker; read it only for the cards
    // that are actually rendered, so a long history costs nothing.
    await Promise.all(folders.slice(0, 16).map(async f => {
      if (!f.marker) return;
      const m = await gcsGet(f.marker).catch(() => ({ ok: false }));
      if (!m.ok) return;
      try {
        const j = JSON.parse(m.buf.toString('utf8'));
        // Keep the shape every screen already parses: <client>-MM-DD-YYYY. The
        // Systems Map strips the date for its label and the Brief reads it for
        // the caption, so inventing a new shape would blank both.
        const dm = f.id.match(/-(\d{2}-\d{2}-\d{4})-[0-9a-f]{6}$/);
        if (j && j.client) f.name = String(j.client).slice(0, 60) + (dm ? '-' + dm[1] : '');
      } catch (_) {}
    }));
    for (const f of folders) delete f.marker;
    console.log('[admin] submissions OK for', user.email, '—', folders.length, 'submissions');
    const payload = { ok: true, total: folders.length, folders: folders.slice(0, 40),
      store: 'maya-storage', ts: new Date().toISOString() };
    _subsCache = { ts: Date.now(), body: payload };
    res.json(payload);
  } catch (e) {
    console.error('[admin] submissions failed —', e.message);
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    res.status(500).json({ error: 'submissions_failed',
      code: timedOut ? 'submissions_timeout' : 'submissions_error',
      detail: timedOut ? 'the submission store timed out' : 'the submission store could not be read' });
  }
});

// GET /api/admin/subthumb?id=<file>&w=480 and /api/admin/subfile?id=<file>
// v13.27: both read one object out of MAYA's own bucket. The id IS the object
// path, url safe, and idToPath refuses anything that is not a file directly
// inside one submission, so an admin token cannot read the rest of the bucket.
// The thumb route keeps a half hour memory cache because the Systems Map strip
// repaints often; w is accepted and ignored, the tiles scale in CSS.
const _thumbCache = new Map();
app.get('/api/admin/subthumb', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const path = idToPath(req.query.id);
  if (!path) return res.status(400).json({ error: 'bad_id' });
  const hit = _thumbCache.get(path);
  if (hit && Date.now() - hit.ts < 30 * 60 * 1000) {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    return res.end(hit.buf);
  }
  try {
    const o = await gcsGet(path);
    if (!o.ok) return res.status(o.status === 404 ? 404 : 502).json({ error: 'not_found' });
    if (!/^image\//.test(o.type)) return res.status(415).json({ error: 'not_a_picture' });
    if (o.buf.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    if (_thumbCache.size > 200) _thumbCache.clear();
    _thumbCache.set(path, { ts: Date.now(), buf: o.buf, type: o.type });
    res.setHeader('Content-Type', o.type);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.end(o.buf);
  } catch (e) {
    console.error('[admin] subthumb failed,', e.message);
    res.status(500).json({ error: 'subthumb_failed', detail: e.message });
  }
});

app.get('/api/admin/subfile', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const path = idToPath(req.query.id);
  if (!path) return res.status(400).json({ error: 'bad_id' });
  try {
    const o = await gcsGet(path);
    if (!o.ok) return res.status(o.status === 404 ? 404 : 502).json({ error: 'not_found' });
    if (o.buf.length > 30 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    res.setHeader('Content-Type', o.type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(o.buf);
  } catch (e) {
    console.error('[admin] subfile failed,', e.message);
    res.status(500).json({ error: 'subfile_failed', detail: e.message });
  }
});

// POST /api/admin/savepieces — save the dissection (rendered pieces and
// patterns) as pieces.json inside the submission, so the Brief loads it next
// time instead of paying for the dissection again. v13.27: MAYA's own bucket.
app.post('/api/admin/savepieces', requireAuthHeader, express.json({ limit: '30mb' }), async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  const subId = String((req.body || {}).folderId || '');
  const data = (req.body || {}).data;
  if (!SUB_ID.test(subId) || !data) return res.status(400).json({ error: 'bad_request' });
  try {
    const body = Buffer.from(JSON.stringify(data), 'utf8');
    if (body.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    const path = SUB_PREFIX + subId + '/pieces.json';
    await gcsPut(path, body, 'application/json');   // one object, overwrite in place
    _subsCache = { ts: 0, body: null };
    console.log('[admin] pieces.json saved for', subId, Math.round(body.length / 1024) + 'kb');
    res.json({ ok: true, id: pathToId(path) });
  } catch (e) {
    console.error('[admin] savepieces failed,', e.message);
    res.status(500).json({ error: 'savepieces_failed', detail: e.message });
  }
});

// ── v13.50: /api/source-fabric, the live merchant window ───────────────────
// The Brief asks with the dissected fabric string; this endpoint asks a
// handful of retail fabric merchants' own public Shopify search feeds, in
// parallel, and returns real products with real prices and pictures. A
// merchant that fails to answer is skipped, never fatal. Results are cached
// for a day per query, and every answer is also seeded into catalog/ in the
// bucket: the corpus that future visual matching will search.
const SOURCE_MERCHANTS = [
  { name: 'Mood Fabrics', place: 'New York', host: 'https://www.moodfabrics.com', eta: 5, currency: 'USD' },
  { name: 'Blackbird Fabrics', place: 'Vancouver', host: 'https://www.blackbirdfabrics.com', eta: 7, currency: 'CAD' },
  { name: 'Miss Matatabi', place: 'Tokyo', host: 'https://shop.missmatatabi.com', eta: 9, currency: 'JPY' },
  { name: 'The Fabric Sales', place: 'Antwerp', host: 'https://thefabricsales.com', eta: 8, currency: 'EUR' },
  { name: 'The Fabric Store', place: 'New Zealand', host: 'https://thefabricstore.com', eta: 10, currency: 'USD' },
  { name: 'Tessuti Fabrics', place: 'Sydney', host: 'https://www.tessuti.com.au', eta: 11, currency: 'AUD' },
];
const _sourceCache = new Map();
app.get('/api/source-fabric', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: 'missing_q' });
  const key = q.toLowerCase();
  const hit = _sourceCache.get(key);
  if (hit && Date.now() - hit.ts < 24 * 3600 * 1000) return res.json(hit.body);
  const enc = encodeURIComponent(q);
  const results = await Promise.all(SOURCE_MERCHANTS.map(async (m) => {
    try {
      const r = await fetch(m.host + '/search/suggest.json?q=' + enc +
        '&resources%5Btype%5D=product&resources%5Blimit%5D=6', {
        headers: { 'User-Agent': 'MAYA fabric sourcing (maya.manasiyo.com)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const ps = (((j || {}).resources || {}).results || {}).products || [];
      return ps.filter(p => p && p.available !== false).map(p => ({
        merchant: m.name, place: m.place, etaDays: m.eta, currency: m.currency,
        title: String(p.title || '').slice(0, 140),
        price: p.price != null ? String(p.price) : '',
        url: /^https?:/.test(p.url || '') ? p.url : (m.host + (p.url || '')),
        image: (p.featured_image && p.featured_image.url) || p.image || '',
      }));
    } catch (e) { return { _miss: m.name, why: String(e.message).slice(0, 80) }; }
  }));
  const { products, misses } = collectRetailerResults(results);
  const body = { ok: true, q, products: products.slice(0, 60), misses,
    fetchedAt: new Date().toISOString() };
  _sourceCache.set(key, { ts: Date.now(), body });
  try {
    gcsPut('catalog/queries/' + key.replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '.json',
      JSON.stringify(body), 'application/json').catch(() => {});
  } catch (_) {}
  res.json(body);
});

// ── v13.51: /api/rank-fabric, garment-to-swatch visual ranking ─────────────
// Retrieval and ranking stay separate on purpose. The retailer window can
// fail without spending a vision call, and the Brief can keep its immediate
// static cards whenever either stage fails. Only products with real thumbnail
// images enter the comparison. The model sees the garment first, then each
// retailer image alongside the fabric traits inferred during dissection.
app.post('/api/rank-fabric', requireAuthHeader, express.json({ limit: '8mb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'ranking_unavailable' });
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry));
    return res.status(429).json({ error: 'rate_limited', scope: rl.scope });
  }

  let ranking;
  try {
    ranking = buildVisualRankingRequest({
      garmentImage: (req.body || {}).garment_image,
      traits: (req.body || {}).traits,
      products: (req.body || {}).products,
    });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message || 'bad_ranking_request' });
  }

  try {
    const routed = await aiTaskRouter.run('fabric.visual_rank', {
      body: ranking.requestBody,
    }, {
      requestId: req.headers['x-request-id'] || crypto.randomUUID(),
      validate: body => applyVisualRankings(body, ranking.candidates),
    });
    const matches = routed.output;
    noteSpend('v1/chat/completions', req);
    return res.json({ ok: true, label: 'closest visual matches', matches });
  } catch (e) {
    console.error('[fabric-rank] failed request=' + (e.requestId || 'unknown') +
      ' category=' + (e.category || 'unknown'));
    return res.status(502).json({ error: 'ranking_failed' });
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
  // v13.33: unique accounts, counted by MAYA itself. This does not depend on
  // Analytics being connected, so the headline number is always there.
  let accounts = null;
  try { accounts = await countUsers(); } catch (e) { console.warn('[admin] user count —', e.message); }
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
               ranges, countries, accounts: accounts || null,
               property: _gaProp.id, ts: new Date().toISOString() });
  } catch (e) {
    console.warn('[admin] analytics unavailable —', e.message);
    res.json({ ok: false, reason: e.message, saEmail, accounts: accounts || null });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// v13.34 — MARKETING. Everything that brings people to Mana Siyo, in one place.
//
// Three sources, each independent, each honest about whether it is connected:
//
//   Analytics   the manasiyo.com property, read with the service account this
//               server already runs as. Traffic, where it came from, which
//               pages, day by day. Google and Facebook show up here as
//               sources whether or not the ad accounts are connected.
//   Meta ads    the Marketing API, with a long lived token. Spend, reach,
//               clicks, results.
//   Google ads  the Google Ads API needs a developer token, which is applied
//               for and approved by Google. Reported as not connected until
//               the four values are set, never faked.
//
// Nothing here writes anything. It is a read only window.
// ═══════════════════════════════════════════════════════════════════════════
const META_TOKEN   = process.env.META_ADS_TOKEN || '';
const META_ACCOUNT = String(process.env.META_AD_ACCOUNT_ID || '').replace(/^act_/, '');
const GADS = {
  dev:    process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  id:     process.env.GOOGLE_ADS_CLIENT_ID || '',
  secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
  refresh: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
  customer: String(process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, ''),
  login:  String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, ''),
};

let _mktProp = { id: null, name: '', ts: 0 };
async function marketingProperty(token) {
  const pinned = process.env.MARKETING_GA_PROPERTY_ID;
  if (pinned) return { id: 'properties/' + String(pinned).replace(/^properties\//, ''), name: 'pinned' };
  if (_mktProp.id && Date.now() - _mktProp.ts < 3600000) return _mktProp;
  const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error('ga admin ' + r.status);
  const all = ((await r.json()).accountSummaries || []).flatMap(a => a.propertySummaries || []);
  // The site property, by name. Falls back to the only one there is.
  // v13.47: prefer the site's property by name; failing that, any property
  // that is NOT MAYA's own (pro-maya), so sharing the manasiyo.com property
  // is enough by itself; failing that, whatever there is.
  const hit = all.find(p => /mana\s*siyo|manasiyo/i.test(p.displayName || ''))
    || all.find(p => !/pro-maya/i.test(p.displayName || ''))
    || all[0];
  if (!hit) throw new Error('no Analytics property is shared with this server yet');
  _mktProp = { id: hit.property, name: hit.displayName || '', ts: Date.now() };
  return _mktProp;
}

async function metaInsights() {
  if (!META_TOKEN || !META_ACCOUNT) {
    return { connected: false, why: 'no token set' };
  }
  const q = (preset) => 'https://graph.facebook.com/v21.0/act_' + encodeURIComponent(META_ACCOUNT) +
    '/insights?date_preset=' + preset +
    '&fields=spend,impressions,reach,clicks,ctr,cpc,actions' +
    '&access_token=' + encodeURIComponent(META_TOKEN);
  try {
    const [w, m] = await Promise.all([
      fetch(q('last_7d'),  { signal: AbortSignal.timeout(12000) }).then(r => r.json()),
      fetch(q('last_30d'), { signal: AbortSignal.timeout(12000) }).then(r => r.json()),
    ]);
    if (w.error) throw new Error(w.error.message || 'meta error');
    const one = (j) => {
      const d = (j.data || [])[0] || {};
      const acts = (d.actions || []);
      const pick = (t) => Number((acts.find(a => a.action_type === t) || {}).value || 0);
      return {
        spend: Number(d.spend || 0), impressions: Number(d.impressions || 0),
        reach: Number(d.reach || 0), clicks: Number(d.clicks || 0),
        ctr: Number(d.ctr || 0), cpc: Number(d.cpc || 0),
        results: pick('link_click') || pick('landing_page_view') || pick('offsite_conversion'),
      };
    };
    return { connected: true, account: META_ACCOUNT, d7: one(w), d30: one(m) };
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 120) };
  }
}

async function googleAdsInsights() {
  const missing = Object.entries(GADS).filter(([k, v]) => k !== 'login' && !v).map(([k]) => k);
  if (missing.length) return { connected: false, why: 'missing: ' + missing.join(', ') };
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GADS.id, client_secret: GADS.secret,
        refresh_token: GADS.refresh, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(12000),
    });
    const tj = await tr.json();
    if (!tr.ok) throw new Error(tj.error_description || tj.error || 'token refused');
    const hdr = { 'Authorization': 'Bearer ' + tj.access_token, 'developer-token': GADS.dev,
                  'Content-Type': 'application/json' };
    if (GADS.login) hdr['login-customer-id'] = GADS.login;
    const gaql = 'SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions ' +
                 'FROM customer WHERE segments.date DURING LAST_7_DAYS';
    const r = await fetch('https://googleads.googleapis.com/v18/customers/' + GADS.customer + '/googleAds:search', {
      method: 'POST', headers: hdr, body: JSON.stringify({ query: gaql }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ('ads ' + r.status));
    let cost = 0, impressions = 0, clicks = 0, conversions = 0;
    for (const row of (j.results || [])) {
      const m = row.metrics || {};
      cost += Number(m.costMicros || 0) / 1e6;
      impressions += Number(m.impressions || 0);
      clicks += Number(m.clicks || 0);
      conversions += Number(m.conversions || 0);
    }
    return { connected: true, customer: GADS.customer, d7: { spend: cost, impressions, clicks, conversions } };
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 160) };
  }
}

// v13.43: Windsor. One key, and it relays what Google Ads and Meta already
// know: impressions, clicks, spend, by day. Set WINDSOR_API_KEY on Cloud Run
// and both ad panels fill from it without any per-platform credentials here.
const WINDSOR_KEY = process.env.WINDSOR_API_KEY || '';

// v13.48: manasiyo.com's own visitors, from Wix itself. The Wix dashboard's
// numbers come from this same Analytics Data API, so the marketing page can
// finally show the site's real traffic. Needs WIX_API_KEY (account API key
// with Site Analytics permission); the site id is pinned to the live
// Mana Siyo site and only needs WIX_SITE_ID if that ever changes.
const WIX_KEY = process.env.WIX_API_KEY || '';
const WIX_SITE = process.env.WIX_SITE_ID || 'a4ad1a21-d8dc-4986-8ac2-9db20fbf366f';
async function wixInsights() {
  if (!WIX_KEY) return { connected: false, why: 'no WIX_API_KEY set' };
  try {
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const qs = 'dateRange.startDate=' + day(27) + '&dateRange.endDate=' + day(0) +
      '&measurementTypes=TOTAL_SESSIONS&measurementTypes=TOTAL_UNIQUE_VISITORS';
    const r = await fetch('https://www.wixapis.com/analytics/v2/site-analytics/data?' + qs, {
      headers: { 'Authorization': WIX_KEY, 'wix-site-id': WIX_SITE },
      signal: AbortSignal.timeout(12000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.message) || ('wix ' + r.status));
    const byType = {};
    for (const row of (j.data || [])) byType[row.type] = row;
    const uv = byType.TOTAL_UNIQUE_VISITORS || { values: [], total: 0 };
    const ss = byType.TOTAL_SESSIONS || { values: [], total: 0 };
    const today = day(0);
    const last7 = (uv.values || []).slice(-7).reduce((a, v) => a + Number(v.value || 0), 0);
    return {
      connected: true,
      daily: (uv.values || []).map(v => ({ date: v.date, visitors: Number(v.value || 0) })),
      today: { visitors: Number(((uv.values || []).find(v => v.date === today) || {}).value || 0) },
      d7: { visitors: last7 },
      d28: { visitors: Number(uv.total || 0), sessions: Number(ss.total || 0) },
    };
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 160) };
  }
}
async function windsorInsights() {
  if (!WINDSOR_KEY) return { connected: false, why: 'no WINDSOR_API_KEY set' };
  try {
    // v13.44: campaign comes along too, so Marketing can show a Google Ads
    // style table: one row per campaign, per source, with CTR and CPC.
    const fetchRows = async (fields) => {
      const qs = new URLSearchParams({
        api_key: WINDSOR_KEY, date_preset: 'last_7d', fields,
      });
      const r = await fetch('https://connectors.windsor.ai/all?' + qs.toString(),
        { signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j && j.message) || ('windsor ' + r.status));
      return Array.isArray(j.data) ? j.data : [];
    };
    let rows;
    try { rows = await fetchRows('source,date,campaign,impressions,clicks,spend'); }
    catch (_) { rows = await fetchRows('source,date,impressions,clicks,spend'); }
    const bySource = {};
    const byCampaign = {};
    for (const row of rows) {
      const src = String(row.source || 'unknown').toLowerCase();
      if (!bySource[src]) bySource[src] = { impressions: 0, clicks: 0, spend: 0, daily: {} };
      const b = bySource[src];
      const imp = Number(row.impressions || 0);
      const clk = Number(row.clicks || 0);
      const spd = Number(row.spend || 0);
      b.impressions += imp;
      b.clicks += clk;
      b.spend += spd;
      const d = String(row.date || '').slice(0, 10);
      if (d) {
        if (!b.daily[d]) b.daily[d] = { impressions: 0, clicks: 0, spend: 0 };
        b.daily[d].impressions += imp;
        b.daily[d].clicks += clk;
        b.daily[d].spend += spd;
      }
      const camp = String(row.campaign || '').trim();
      if (camp) {
        const key = src + ' ' + camp;
        if (!byCampaign[key]) byCampaign[key] = { source: src, campaign: camp,
          impressions: 0, clicks: 0, spend: 0, lastDate: '' };
        const c = byCampaign[key];
        c.impressions += imp; c.clicks += clk; c.spend += spd;
        if (d > c.lastDate) c.lastDate = d;
      }
    }
    const campaigns = Object.values(byCampaign)
      .sort((a, b) => b.impressions - a.impressions)
      .map(c => ({ ...c,
        ctr: c.impressions ? c.clicks / c.impressions : 0,
        cpc: c.clicks ? c.spend / c.clicks : 0 }));
    return { connected: true, sources: bySource, campaigns };
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 160) };
  }
}

app.get('/api/admin/marketing', async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized', detail: e.message }); }
  let saEmail = null;
  try { saEmail = await (await gaMeta('email')).text(); } catch (_) {}
  const out = { ok: true, saEmail, ts: new Date().toISOString() };
  // ── Analytics ──
  try {
    const token = await gaToken();
    const prop = await marketingProperty(token);
    const hdr = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
    const base = 'https://analyticsdata.googleapis.com/v1beta/' + prop.id;
    const post = (body) => fetch(base + ':runReport', { method: 'POST', headers: hdr,
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || ('ga ' + r.status)); return j; });
    const [ranges, daily, sources, pages, live] = await Promise.all([
      post({ dateRanges: [{ startDate: 'today', endDate: 'today', name: 'today' },
                          { startDate: '7daysAgo', endDate: 'today', name: 'd7' },
                          { startDate: '28daysAgo', endDate: 'today', name: 'd28' }],
             metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] }),
      post({ dateRanges: [{ startDate: '27daysAgo', endDate: 'today' }],
             dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }],
             orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      post({ dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
             dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
             metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
             orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: '12' }),
      post({ dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
             dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
             orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: '8' }),
      fetch(base + ':runRealtimeReport', { method: 'POST', headers: hdr,
        body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }), signal: AbortSignal.timeout(12000) })
        .then(r => r.ok ? r.json() : { rows: [] }).catch(() => ({ rows: [] })),
    ]);
    const R = { today: {}, d7: {}, d28: {} };
    for (const row of (ranges.rows || [])) {
      const k = row.dimensionValues[0].value;
      if (!R[k]) continue;
      R[k] = { users: Number(row.metricValues[0].value || 0),
               sessions: Number(row.metricValues[1].value || 0),
               views: Number(row.metricValues[2].value || 0) };
    }
    out.analytics = {
      connected: true,
      property: prop.id, propertyName: prop.name,
      live: Number((((live.rows || [])[0] || {}).metricValues || [{}])[0].value || 0),
      ranges: R,
      daily: (daily.rows || []).map(r => ({ date: r.dimensionValues[0].value,
                                            users: Number(r.metricValues[0].value || 0) })),
      sources: (sources.rows || []).map(r => ({
        source: r.dimensionValues[0].value, medium: r.dimensionValues[1].value,
        sessions: Number(r.metricValues[0].value || 0), users: Number(r.metricValues[1].value || 0) })),
      pages: (pages.rows || []).map(r => ({ path: r.dimensionValues[0].value,
                                            views: Number(r.metricValues[0].value || 0) })),
    };
  } catch (e) {
    out.analytics = { connected: false, why: String(e.message).slice(0, 200) };
  }
  const [meta, gads, windsor, wixSite] = await Promise.all([metaInsights(), googleAdsInsights(), windsorInsights(), wixInsights()]);
  out.wixSite = wixSite;
  out.meta = meta;
  out.googleAds = gads;
  out.windsor = windsor;
  // Windsor fills whichever ad panel has no direct credentials of its own.
  if (windsor.connected) {
    const w = windsor.sources || {};
    const pick = (keys) => {
      for (const k of keys) if (w[k]) return w[k];
      return null;
    };
    if (!gads.connected) {
      const g = pick(['google_ads', 'googleads', 'google']);
      if (g) out.googleAds = { connected: true, via: 'windsor',
        d7: { spend: g.spend, impressions: g.impressions, clicks: g.clicks, conversions: 0 } };
    }
    if (!meta.connected) {
      const f = pick(['facebook', 'meta', 'facebook_ads']);
      if (f) out.meta = { connected: true, via: 'windsor',
        d7: { spend: f.spend, impressions: f.impressions, reach: 0, clicks: f.clicks, ctr: 0, cpc: 0, results: 0 } };
    }
    // v13.44: one combined view for the Marketing page: a Google Ads style
    // chart (a line per source) and a campaign table, both from Windsor.
    const g = pick(['google_ads', 'googleads', 'google']);
    const f2 = pick(['facebook', 'meta', 'facebook_ads']);
    const dayset = new Set();
    for (const s of [g, f2]) if (s) for (const d of Object.keys(s.daily || {})) dayset.add(d);
    const days = Array.from(dayset).sort();
    const seriesOf = (s) => days.map(d => {
      const v = (s && s.daily && s.daily[d]) || { impressions: 0, clicks: 0, spend: 0 };
      return { date: d, impressions: v.impressions, clicks: v.clicks, spend: v.spend,
               cpc: v.clicks ? v.spend / v.clicks : 0 };
    });
    out.adCombined = {
      connected: true, days,
      google: g ? seriesOf(g) : null,
      meta: f2 ? seriesOf(f2) : null,
      campaigns: windsor.campaigns || [],
    };
  }
  res.json(out);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('[maya-api] listening on', port);
  // v13.28: pick the credit meter's month back up after a restart.
  bootMeter().catch(() => {});
});
