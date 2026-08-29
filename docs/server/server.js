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
import { evaluateProxyPolicy } from './proxy-policy.mjs';
import { buildAdminCommandSnapshot, buildFeatureDigest, buildRealtimeCommandContext, resolveLeadExact } from './admin-command.mjs';
import { createMayaMcp } from './maya-mcp.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname as pathDirname, join as pathJoin } from 'node:path';
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
// v14.02: Maya's character, one file in the container. Missing file = empty, she
// still runs on the inline instructions.
const MAYA_CHARACTER = (() => {
  try { return readFileSync(pathJoin(pathDirname(fileURLToPath(import.meta.url)), 'maya-character.md'), 'utf8').slice(0, 9000); }
  catch (_) { return ''; }
})();
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
// v13.53: the tier map. The browser still says gpt-4.1 or gpt-4o-mini, and
// the server quietly upgrades those names to the current tier models, so a
// model change is an env var change (instant rollback), never a client edit.
// Anything not named below is refused — the proxied key can no longer be
// pointed at arbitrary models by editing localStorage.
//   Terra: everyday reasoning and vision.   Luna: short cheap utility.
//   Sol: streamed expert pattern critique (Operations Room asks by name).
// ═══════════════════════════════════════════════════════════════════════════
const MODEL_TERRA = process.env.MODEL_TERRA || 'gpt-5.6-terra';
const MODEL_LUNA  = process.env.MODEL_LUNA  || 'gpt-5.6-luna';
const MODEL_SOL   = process.env.MODEL_SOL   || 'gpt-5.6-sol';
const MODEL_UPGRADES = Object.freeze({
  'gpt-4.1':     MODEL_TERRA,
  'gpt-4o-mini': MODEL_LUNA,
});
// v13.70 (A1): the canonical inventory of models MAYA may run. ENFORCEMENT of
// which model may hit which endpoint, plus image/quality/Sol policy, now lives
// in docs/server/proxy-policy.mjs (evaluateProxyPolicy). Keep this list in step
// with that helper's endpointModels() when the model set changes.
const MODEL_ALLOWED = new Set([
  MODEL_TERRA, MODEL_LUNA, MODEL_SOL,
  'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol',
  'gpt-image-2',              // renders ARE the product, untouched
  'whisper-1',                // transcription, untouched
  'text-embedding-3-small',   // pattern book retrieval, untouched
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

// v13.70 (A1): verify the Google token BEFORE the 24MB body is buffered, so an
// unauthorized request is refused without spending memory on its payload.
async function openaiAuthGate(req, res, next) {
  try { req._openaiUser = await requireGoogleUser(req); return next(); }
  catch (e) { console.error('[openai] 401 —', e.message);
    return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
}
app.all(/^\/api\/openai\/(.*)/, openaiAuthGate, express.raw({ type: '*/*', limit: '24mb' }), async (req, res) => {
  const user = req._openaiUser;

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

  // ═══ v13.70 (A1): one pure, fail-closed policy decides the whole request ═══
  // content type, a present valid model, model-to-endpoint match, Sol admin
  // only, and image count/quality regardless of body size or multipart order.
  const _isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  const policy = evaluateProxyPolicy({
    method: req.method,
    upstreamPath,
    contentType: req.headers['content-type'] || '',
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : (req.body && req.body.length ? req.body : undefined),
    isAdmin: _isAdmin,
    models: { TERRA: MODEL_TERRA, LUNA: MODEL_LUNA, SOL: MODEL_SOL, upgrades: MODEL_UPGRADES },
  });
  if (!policy.ok) {
    console.warn('[ai] policy refuse', policy.error, policy.detail || '', upstreamPath, 'user=' + user.email);
    return res.status(policy.status).json({ error: policy.error, detail: policy.detail });
  }
  let bodyBuf = policy.body;
  let sentModel = policy.model || '';
  let originalModel = policy.original || '';
  let fallbackBuf = policy.fallback || null;
  const streamRequested = !!policy.streamRequested;

  // v13.89: the free-trial ceiling. An image call is refused once the account
  // has spent its USER_TRIAL_USD; admins are never capped. Checked here, before
  // any money is spent upstream, so a blocked user costs nothing.
  if (isImage && !_isAdmin) {
    const spent = await userSpendTotal(user.sub);
    if ((spent.usd || 0) >= USER_TRIAL_USD) {
      console.warn('[trial] exhausted', user.email, (spent.usd || 0).toFixed(2));
      return res.status(402).json({ error: 'trial_exhausted',
        detail: 'You have used your free trial credits. Upgrade to keep rendering.',
        capUsd: USER_TRIAL_USD, spentUsd: Number((spent.usd || 0).toFixed(2)) });
    }
  }

  const headers = { 'Authorization': 'Bearer ' + openaiKey };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  const doUpstream = (buf) => fetch('https://api.openai.com/' + upstreamPath, {
    method: req.method,
    headers,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined
          : (buf && buf.length ? buf : undefined),
    signal: AbortSignal.timeout(285000),
  });

  const t0 = Date.now();
  try {
    let upstream = await doUpstream(bodyBuf);
    // v13.53 safety net: an upgraded model the account cannot use yet must
    // never break the product. On a model-shaped 400/404, the ORIGINAL model
    // is retried once and the miss is logged loudly for the changelog.
    if (!upstream.ok && fallbackBuf && (upstream.status === 400 || upstream.status === 404)) {
      const errBuf = Buffer.from(await upstream.arrayBuffer());
      const errTxt = errBuf.toString('utf8').slice(0, 600);
      if (/model/i.test(errTxt) &&
          /(not\s?found|does not exist|unknown|invalid|no access|not supported|denied)/i.test(errTxt)) {
        console.warn('[ai] tier fallback', sentModel, '→', originalModel, upstreamPath, '—', errTxt.slice(0, 200));
        sentModel = originalModel;
        originalModel = '';
        upstream = await doUpstream(fallbackBuf);
      } else {
        const ctErr = upstream.headers.get('content-type');
        if (ctErr) res.setHeader('Content-Type', ctErr);
        console.error('[openai]', upstream.status, upstreamPath, 'user=' + user.email, '—', errTxt);
        return res.status(upstream.status).send(errBuf);
      }
    }
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
    // v13.89: charge the caller's own free-trial meter too (fire-and-forget;
    // images persist immediately inside so the cap survives a restart).
    noteUserSpend(user.sub, user.email, upstreamPath, req);
    // v13.53: one structured line per AI call. For small non-streamed JSON
    // answers (chat, embeddings) the real token usage is read from the body;
    // streamed and binary responses log without it and keep flowing.
    const wantUsage = sentModel && !streamRequested && /json/i.test(ct || '') &&
                      /^v1\/(chat\/completions|embeddings)$/.test(upstreamPath);
    if (wantUsage) {
      const outBuf = Buffer.from(await upstream.arrayBuffer());
      try {
        const j = JSON.parse(outBuf.toString('utf8'));
        const u = j.usage || {};
        console.log('[ai]', JSON.stringify({ path: upstreamPath, model: sentModel,
          from: originalModel || undefined, ms: Date.now() - t0,
          tokens_in: u.prompt_tokens ?? u.input_tokens ?? 0,
          tokens_out: u.completion_tokens ?? u.output_tokens ?? 0,
          user: user.email }));
      } catch (_) {}
      return res.end(outBuf);
    }
    if (sentModel) {
      console.log('[ai]', JSON.stringify({ path: upstreamPath, model: sentModel,
        from: originalModel || undefined, ms: Date.now() - t0, streamed: true,
        user: user.email }));
    }
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
// v13.57: /api/hello — one quiet call per session from the app after sign
// in. It exists so the Users count on Admin counts EVERY account that signs
// in: before this, an account was only counted when its work reached the
// API, so people who signed in and browsed were invisible (the store held 2
// markers while Analytics saw dozens of people). It also records which
// terms version the account agreed to, on the same marker.
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/hello', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }   // noteUser fires inside
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  const tos = String(((req.body || {}).tos) || '').slice(0, 24);
  if (tos && /^[\d-]+$/.test(tos)) {
    const id = crypto.createHash('sha256').update(String(user.sub)).digest('hex').slice(0, 24);
    gcsGet(USERS_PREFIX + id + '.json').then(o => {
      let doc = { firstSeenMs: Date.now() };
      if (o.ok) { try { doc = JSON.parse(o.buf.toString('utf8')) || doc; } catch (_) {} }
      if (doc.tosVersion === tos) return;
      doc.email = String(user.email || doc.email || '').slice(0, 120);
      doc.tosVersion = tos;
      doc.tosAcceptedMs = Date.now();
      return gcsPut(USERS_PREFIX + id + '.json',
        Buffer.from(JSON.stringify(doc), 'utf8'), 'application/json');
    }).catch(() => {});
  }
  res.status(204).end();
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
// v14.00: the meter charges the HONEST cost of a card. MAYA renders at medium
// quality, which prices below at PRICE_IMAGE * 0.5, so the default 0.13 makes
// one card meter at $0.065, the real GPT Image cost with reference input. The
// $2 trial therefore reads as ~30 card renders. Override via OPENAI_PRICE_IMAGE.
const PRICE_IMAGE = Number(process.env.OPENAI_PRICE_IMAGE || 0.13);
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
const PRICE_REALTIME = Number(process.env.OPENAI_PRICE_REALTIME || 0.10);
function priceOf(path, req) {
  if (/images\/(generations|edits)/.test(path)) {
    // MAYA always asks for one picture at a time; quality changes the price.
    const raw = req && req.body && req.body.length ? req.body.toString('latin1').slice(0, 4000) : '';
    if (/name="quality"[\s\S]{0,40}?\blow\b/.test(raw) || /"quality"\s*:\s*"low"/.test(raw)) return PRICE_IMAGE * 0.25;
    if (/name="quality"[\s\S]{0,40}?\bmedium\b/.test(raw) || /"quality"\s*:\s*"medium"/.test(raw)) return PRICE_IMAGE * 0.5;
    return PRICE_IMAGE;
  }
  if (/audio\/(transcriptions|translations|speech)/.test(path)) return PRICE_AUDIO;
  // v14.03: a live voice line is priced per call opened, a rough average of a
  // few spoken minutes, so the meter moves honestly for a user talking to Maya.
  if (/realtime/.test(path)) return PRICE_REALTIME;
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

// ═══ v13.89: per-user free-trial meter ══════════════════════════════════════
// The _spend meter above tracks MAYA's whole OpenAI bill. THIS one is per
// person: every signed-in Google account gets USER_TRIAL_USD (default $2) of
// image renders, and image calls are refused once that is used up. Admins are
// never capped. It is a soft trial guard, not a billing ledger — a rare
// cross-instance race can let a render or two slip over, fine for a $2
// allowance. Cumulative, because a trial is a lifetime allowance, not monthly.
// One GCS object per account at metrics/trial/<hash>.json. The name is a one-way
// hash of the Google sub — never the raw id — matching the sign-in markers'
// privacy, and it lives under its OWN prefix so it does not collide with, or
// inflate, the metrics/users/ account count.
const USER_TRIAL_USD = Number(process.env.USER_TRIAL_USD || 2);
const USER_METRICS_PREFIX = 'metrics/trial/';
// Each account's meter records the epoch it was last reset at; when the current
// epoch differs, the meter zeroes on next read.
// v14.02: THE EPOCH IS FROZEN. It no longer follows the release number. Fromsa's
// rule (Aug 27 2026): an update must never restart anyone's money counter. Do
// NOT bump this string in a release. A deliberate one-off reset is done out of
// band by setting TRIAL_EPOCH on Cloud Run, never in code.
const TRIAL_EPOCH = String(process.env.TRIAL_EPOCH || 'v14.00');
const _userSpend = new Map();   // uid -> { usd, images, calls, email, dirty, ts, lastFlush }
function _uidKey(uid) {
  const h = crypto.createHash('sha256').update(String(uid)).digest('hex').slice(0, 24);
  return USER_METRICS_PREFIX + h + '.json';
}
async function userSpendTotal(uid) {
  const cached = _userSpend.get(uid);
  if (cached && Date.now() - cached.ts < 10000) return cached;
  const rec = { usd: 0, images: 0, calls: 0, email: (cached && cached.email) || '',
                epoch: TRIAL_EPOCH, dirty: false, ts: Date.now(), lastFlush: (cached && cached.lastFlush) || 0 };
  try {
    const o = await gcsGet(_uidKey(uid));
    if (o.ok) {
      const j = JSON.parse(o.buf.toString('utf8'));
      // v13.96: a meter from an earlier epoch is reset to zero (full $2 again).
      if (String(j.epoch || '') === TRIAL_EPOCH) {
        rec.usd = Number(j.usd) || 0; rec.images = Number(j.images) || 0;
        rec.calls = Number(j.calls) || 0;
      } else {
        rec.dirty = true;   // persist the reset (with the new epoch) on next flush
      }
      rec.email = j.email || rec.email;
    }
  } catch (_) {}
  // Keep any unflushed local increments that ran ahead of the stored copy,
  // but only within the same epoch (a fresh epoch must win, not old spend).
  if (cached && String(cached.epoch || TRIAL_EPOCH) === TRIAL_EPOCH && cached.usd > rec.usd) {
    rec.usd = cached.usd; rec.images = cached.images; rec.calls = cached.calls; rec.dirty = cached.dirty;
  }
  _userSpend.set(uid, rec);
  return rec;
}
async function noteUserSpend(uid, email, path, req) {
  try {
    const price = priceOf(path, req);
    const rec = await userSpendTotal(uid);
    rec.usd += price; rec.calls += 1;
    if (/images\//.test(path)) rec.images += 1;
    if (email) rec.email = email;
    rec.dirty = true; rec.ts = Date.now();
    _userSpend.set(uid, rec);
    // Persist images at once (rare + they carry the cost the cap is about); let
    // chat/audio ride the throttle so we do not write on every keystroke.
    if (/images\//.test(path) || Date.now() - (rec.lastFlush || 0) > 60000) await flushUserSpend(uid);
  } catch (e) { console.error('[trial] note failed,', e.message); }
}
async function flushUserSpend(uid) {
  const rec = _userSpend.get(uid);
  if (!rec || !rec.dirty) return;
  // No raw uid in the object — the filename is already its one-way hash.
  const snap = { email: rec.email || '', usd: Number(rec.usd.toFixed(4)),
                 images: rec.images, calls: rec.calls, epoch: rec.epoch || TRIAL_EPOCH, updatedAtMs: Date.now() };
  try {
    await gcsPut(_uidKey(uid), Buffer.from(JSON.stringify(snap), 'utf8'), 'application/json');
    rec.dirty = false; rec.lastFlush = Date.now();
  } catch (e) { console.error('[trial] flush failed,', e.message); rec.lastFlush = Date.now(); }
}
// GET /api/usage — the signed-in user's own free-trial meter. Any authed user
// (not admin-only): the app reads it to paint the drawer credits gauge. Reports
// real spend for everyone so the gauge moves; only NON-admins are ever blocked.
app.get('/api/usage', requireAuthHeader, async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized', detail: e.message }); }
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  try {
    const rec = await userSpendTotal(user.sub);
    const spent = Number((rec.usd || 0).toFixed(2));
    res.json({ capUsd: USER_TRIAL_USD, spentUsd: spent,
               leftUsd: Number(Math.max(0, USER_TRIAL_USD - spent).toFixed(2)),
               perCardUsd: Number((PRICE_IMAGE * 0.5).toFixed(3)),
               images: rec.images || 0, calls: rec.calls || 0, admin: isAdmin });
  } catch (e) {
    res.status(500).json({ error: 'usage_failed', detail: String(e.message).slice(0, 80) });
  }
});

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

// ═══════════════════════════════════════════════════════════════════════════
// v13.53: Nano Banana. POST /api/visualize-fabric renders a GENERATED
// illustration for a fabric card that has no real photograph, using Google's
// image model on Vertex AI inside this same Google Cloud project, so the
// request never leaves Google's network. Atelier only, image-weighted on the
// allowance. The answer is always labeled GENERATED: it is an illustration
// of the dissected traits, never a photograph of purchasable fabric, and it
// must never be presented as sourcing truth.
// Requires the Vertex AI API (aiplatform.googleapis.com) enabled on the
// project; until then the endpoint answers 503 vertex_not_enabled.
// ═══════════════════════════════════════════════════════════════════════════
const NANO_BANANA_MODEL = process.env.NANO_BANANA_MODEL || 'gemini-3.1-flash-image';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
let _vertexProject = '';
async function vertexProject() {
  if (_vertexProject) return _vertexProject;
  if (process.env.VERTEX_PROJECT) return (_vertexProject = process.env.VERTEX_PROJECT);
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
    headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('metadata project ' + r.status);
  _vertexProject = (await r.text()).trim();
  return _vertexProject;
}

app.post('/api/visualize-fabric', requireAuthHeader, express.json({ limit: '1mb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email, 4);   // priced like an image, because it is one
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry));
    return res.status(429).json({ error: 'rate_limited', scope: rl.scope });
  }

  const f = (req.body || {}).fabric || {};
  const clean = (v, n) => String(v || '').replace(/[^\w\s#.,%-]/g, '').slice(0, n).trim();
  const bits = [clean(f.color, 40), clean(f.fiber, 60), clean(f.weave, 60)].filter(Boolean);
  if (!bits.length) return res.status(400).json({ error: 'missing_fabric_traits' });
  const extra = [clean(f.texture, 60), f.sheen ? clean(f.sheen, 24) + ' sheen' : '',
                 Number(f.weight_gsm) > 0 ? Math.round(Number(f.weight_gsm)) + ' gsm weight class' : '']
                .filter(Boolean).join(', ');
  const hex = /^#[0-9a-fA-F]{6}$/.test(String(f.hex || '')) ? String(f.hex) : '';
  const prompt = 'A flat, evenly lit macro photograph style illustration of a single fabric swatch filling the whole frame: '
    + bits.join(' ') + (extra ? ', ' + extra : '') + (hex ? '. The dominant color is exactly ' + hex + '.' : '.')
    + ' Show the weave texture clearly. No garments, no hands, no props, no text.';

  try {
    const [tok, project] = await Promise.all([
      serviceToken('https://www.googleapis.com/auth/cloud-platform'), vertexProject(),
    ]);
    const url = 'https://' + VERTEX_LOCATION + '-aiplatform.googleapis.com/v1/projects/' + project +
      '/locations/' + VERTEX_LOCATION + '/publishers/google/models/' + NANO_BANANA_MODEL + ':generateContent';
    const t0 = Date.now();
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      const txt = (await r.text()).slice(0, 600);
      console.error('[visualize] vertex', r.status, '—', txt);
      if (r.status === 403 && /aiplatform|SERVICE_DISABLED|has not been used/i.test(txt)) {
        return res.status(503).json({ error: 'vertex_not_enabled',
          detail: 'Enable the Vertex AI API (aiplatform.googleapis.com) on this Google Cloud project, then try again.' });
      }
      if (r.status === 404) {
        return res.status(503).json({ error: 'vertex_model_unavailable', detail: NANO_BANANA_MODEL });
      }
      return res.status(502).json({ error: 'visualize_failed' });
    }
    const j = await r.json();
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const img = parts.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
    if (!img || !img.inlineData.data) return res.status(502).json({ error: 'no_image_returned' });
    console.log('[ai]', JSON.stringify({ path: 'vertex:' + NANO_BANANA_MODEL, model: NANO_BANANA_MODEL,
      ms: Date.now() - t0, user: user.email }));
    return res.json({ ok: true, label: 'GENERATED',
      image: 'data:' + img.inlineData.mimeType + ';base64,' + img.inlineData.data });
  } catch (e) {
    console.error('[visualize] exception —', e.message);
    return res.status(502).json({ error: 'visualize_failed', detail: e.message });
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
  // v13.67: manasiyo.com's own visitors, so Admin can pair the pills the way
  // Marketing does (manasiyo in white, MAYA in blue).
  let wixSite = null;
  try { wixSite = await wixInsights(); } catch (_) {}
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
               ranges, countries, accounts: accounts || null, wixSite,
               property: _gaProp.id, ts: new Date().toISOString() });
  } catch (e) {
    console.warn('[admin] analytics unavailable —', e.message);
    res.json({ ok: false, reason: e.message, saEmail, accounts: accounts || null, wixSite });
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
  // v13.54: inline_link_clicks is the number comparable to Google's clicks;
  // "clicks" counts every interaction, likes and profile taps included.
  const q = (preset) => 'https://graph.facebook.com/v21.0/act_' + encodeURIComponent(META_ACCOUNT) +
    '/insights?date_preset=' + preset +
    '&fields=spend,impressions,reach,frequency,clicks,inline_link_clicks,cost_per_inline_link_click,ctr,cpc,actions' +
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
        reach: Number(d.reach || 0), frequency: Number(d.frequency || 0),
        clicks: Number(d.clicks || 0),
        linkClicks: Number(d.inline_link_clicks || 0) || pick('link_click'),
        costPerLinkClick: Number(d.cost_per_inline_link_click || 0),
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
    // v13.64: Wix reports days in the SITE's timezone. Computing "today" in
    // UTC made the evening look empty: at 6pm Pacific, UTC is already
    // tomorrow, so the row the dashboard was showing could never be found.
    const WIX_TZ = process.env.WIX_TZ || 'America/Los_Angeles';
    const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: WIX_TZ })
      .format(new Date(Date.now() - n * 86400000));
    const qs = 'dateRange.startDate=' + day(27) + '&dateRange.endDate=' + day(0) +
      '&measurementTypes=TOTAL_SESSIONS&measurementTypes=TOTAL_UNIQUE_VISITORS' +
      '&measurementTypes=TOTAL_FORMS_SUBMITTED&measurementTypes=CLICKS_TO_CONTACT';
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
    // v13.56: Wix publishes a day at a time; until today's row EXISTS the
    // count is unknown, not zero. null says so and the page words it.
    const todayRow = (uv.values || []).find(v => v.date === today);
    return {
      connected: true,
      daily: (uv.values || []).map(v => ({ date: v.date, visitors: Number(v.value || 0) })),
      today: { visitors: todayRow ? Number(todayRow.value || 0) : null },
      d7: { visitors: last7 },
      d28: { visitors: Number(uv.total || 0), sessions: Number(ss.total || 0),
             forms: byType.TOTAL_FORMS_SUBMITTED ? Number(byType.TOTAL_FORMS_SUBMITTED.total || 0) : null,
             contacts: byType.CLICKS_TO_CONTACT ? Number(byType.CLICKS_TO_CONTACT.total || 0) : null },
    };
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 160) };
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// v13.54: leads, from the Wix form record itself. Every submission on
// manasiyo.com is already stored by Wix Forms; this reads that canonical
// record with the same key the analytics use. No tracking pixel, no consent
// banner, no Gmail parsing: the API record IS what the notification email
// is written from, and it includes ad blocked visitors. If the key lacks
// the Forms permission, the page says so instead of showing zeros.
// ═══════════════════════════════════════════════════════════════════════════
const LEADS_NAMESPACE = process.env.WIX_FORMS_NAMESPACE || 'wix.form_app.form';
let _leadsCache = { ts: 0, data: null };
async function wixLeads() {
  if (!WIX_KEY) return { connected: false, why: 'no WIX_API_KEY set' };
  if (_leadsCache.data && Date.now() - _leadsCache.ts < 10 * 60 * 1000) return _leadsCache.data;
  try {
    const sinceMs = Date.now() - 28 * 86400000;
    const subs = [];
    let cursor = null, guard = 0, done = false;
    do {
      const body = cursor
        ? { query: { cursorPaging: { limit: 100, cursor } } }
        : { query: { filter: { namespace: LEADS_NAMESPACE },
                     sort: [{ fieldName: 'createdDate', order: 'DESC' }],
                     cursorPaging: { limit: 100 } } };
      const r = await fetch('https://www.wixapis.com/forms/v4/submissions/namespace/query', {
        method: 'POST',
        headers: { 'Authorization': WIX_KEY, 'wix-site-id': WIX_SITE, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j && j.message) || ('wix forms ' + r.status));
      for (const s of (j.submissions || [])) {
        if (new Date(s.createdDate).getTime() < sinceMs) { done = true; break; }
        subs.push(s);
      }
      cursor = (!done && j.metadata && j.metadata.hasNext && j.metadata.cursors && j.metadata.cursors.next)
        ? j.metadata.cursors.next : null;
    } while (cursor && ++guard < 5);
    const field = (obj, re) => {
      for (const k of Object.keys(obj || {})) if (re.test(k)) return String(obj[k] || '').trim();
      return '';
    };
    const leads = subs.map(s => {
      const v = s.submissions || {};
      const name = [field(v, /^first[_-]?name/i), field(v, /^last[_-]?name/i)]
        .filter(Boolean).join(' ') || field(v, /^name/i) || 'Unnamed';
      // v13.55: the note is what they actually wrote: the longest free-text
      // answer on the form, the "what are you picturing" in their own words.
      let note = '';
      for (const k of Object.keys(v)) {
        const t = typeof v[k] === 'string' ? v[k].trim() : '';
        if (t.length > note.length && t.length > 20 && !/@/.test(t.slice(0, 40)) && !/^\+?[\d\s()-]+$/.test(t)) note = t;
      }
      return { id: s.id || '', ts: s.createdDate, source: 'wix',
               name, email: field(v, /^e?mail/i), phone: field(v, /^phone|^tel/i),
               tier: field(v, /tier|package|plan/i).slice(0, 80),
               wrote: note.slice(0, 400) };
    });
    const now = Date.now();
    const within = (ms) => leads.filter(l => now - new Date(l.ts).getTime() < ms).length;
    const list = leads.slice(0, 12);
    // v13.62: the Notes column carries a summary of what they want and which
    // tier, written by the quick tier, cached a day per submission. When the
    // model is unreachable the deterministic line (tier + their own words)
    // stands instead; never a guess, never a blank.
    await Promise.all(list.map(async l => {
      const ai = await summarizeLead(l).catch(() => null);
      l.note = ai || [l.tier, l.wrote].filter(Boolean).join(' · ').slice(0, 220)
        || 'No note on the form.';
    }));
    const data = { connected: true,
      today: within(86400000), d7: within(7 * 86400000), d28: leads.length,
      lastLeadTs: leads.length ? leads[0].ts : null,
      list };
    _leadsCache = { ts: Date.now(), data };
    return data;
  } catch (e) {
    return { connected: false, why: String(e.message).slice(0, 200) };
  }
}

// v13.54: each network is asked in its own words, because the shared /all
// feed flattened them into lies. Meta's "clicks" counts every interaction,
// likes and profile taps included; only link_clicks is comparable to
// Google's clicks. And Meta's reach deduplicates people, so it can only be
// read from an aggregate row, never summed across days. Thirty days come
// back so the chart can show D, W or M without another request.
async function windsorInsights() {
  if (!WINDSOR_KEY) return { connected: false, why: 'no WINDSOR_API_KEY set' };
  const fetchRows = async (connector, fields, preset) => {
    const qs = new URLSearchParams({
      api_key: WINDSOR_KEY, date_preset: preset || 'last_30d', fields,
    });
    const r = await fetch('https://connectors.windsor.ai/' + connector + '?' + qs.toString(),
      { signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.message) || ('windsor ' + connector + ' ' + r.status));
    return Array.isArray(j.data) ? j.data : [];
  };
  const num = v => Number(v || 0);
  try {
    // v13.55: one connector having a bad moment must never blank the other.
    // Each is fetched independently; only when BOTH fail is Windsor called
    // disconnected, and the reasons are named.
    const [gRes, fRes, fAgg] = await Promise.all([
      fetchRows('google_ads', 'date,campaign,campaign_status,ad_group_name,ad_group_status,impressions,clicks,spend')
        .catch(e => e),
      fetchRows('facebook', 'date,campaign,impressions,clicks,link_clicks,spend')
        .catch(e => e),
      // No date dimension: Windsor then returns the connector's own 7 day
      // aggregate, where reach and frequency are truly deduplicated.
      fetchRows('facebook', 'spend,impressions,clicks,link_clicks,reach,frequency', 'last_7d')
        .then(rows => rows[0] || null).catch(() => null),
    ]);
    const gErr = gRes instanceof Error ? gRes : null;
    const fErr = fRes instanceof Error ? fRes : null;
    if (gErr && fErr) {
      return { connected: false, why: String(gErr.message + '; ' + fErr.message).slice(0, 160) };
    }
    const gRows = gErr ? [] : gRes;
    const fRows = fErr ? [] : fRes;
    const mkSource = () => ({ impressions: 0, clicks: 0, linkClicks: 0, spend: 0, daily: {} });
    const bySource = { google_ads: mkSource(), facebook: mkSource() };
    const byCampaign = {};
    // v13.59: the campaign table answers D / W / M like the chart, so every
    // campaign day ships raw and the page aggregates whichever window is on.
    const campaignDaily = [];
    const byAdGroup = {};
    const d7cut = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const addRow = (src, row) => {
      const b = bySource[src];
      const d = String(row.date || '').slice(0, 10);
      const imp = num(row.impressions), clk = num(row.clicks),
            lnk = src === 'facebook' ? num(row.link_clicks) : num(row.clicks),
            spd = num(row.spend);
      if (d) {
        if (!b.daily[d]) b.daily[d] = { impressions: 0, clicks: 0, linkClicks: 0, spend: 0 };
        const dd = b.daily[d];
        dd.impressions += imp; dd.clicks += clk; dd.linkClicks += lnk; dd.spend += spd;
      }
      // The headline aggregates stay the LAST 7 DAYS, as the panels promise.
      if (d >= d7cut) { b.impressions += imp; b.clicks += clk; b.linkClicks += lnk; b.spend += spd; }
      const camp = String(row.campaign || '').trim();
      if (camp && d && campaignDaily.length < 400) {
        campaignDaily.push({ source: src, campaign: camp,
          status: String(row.campaign_status || ''), date: d,
          impressions: imp, clicks: clk, linkClicks: lnk, spend: spd });
      }
      if (camp && d >= d7cut) {
        const key = src + ' | ' + camp;
        if (!byCampaign[key]) byCampaign[key] = { source: src, campaign: camp,
          status: '', impressions: 0, clicks: 0, linkClicks: 0, spend: 0, lastDate: '' };
        const c = byCampaign[key];
        // v13.56: the campaign table speaks link clicks too, both networks.
        c.impressions += imp; c.clicks += clk; c.linkClicks += lnk; c.spend += spd;
        if (String(row.campaign_status || '')) c.status = String(row.campaign_status);
        if (d > c.lastDate) c.lastDate = d;
      }
      // v13.54: ad groups, for the deterministic warnings. Windsor only
      // reports days WITH traffic, so an enabled group that stops serving
      // shows as a disappearance: enabled, seen before, silent since.
      const ag = String(row.ad_group_name || '').trim();
      if (ag) {
        if (!byAdGroup[ag]) byAdGroup[ag] = { name: ag, status: '', lastImpressionDate: '', impressions7: 0 };
        const g = byAdGroup[ag];
        if (String(row.ad_group_status || '')) g.status = String(row.ad_group_status);
        if (imp > 0 && d > g.lastImpressionDate) g.lastImpressionDate = d;
        if (d >= d7cut) g.impressions7 += imp;
      }
    };
    for (const row of gRows) addRow('google_ads', row);
    for (const row of fRows) addRow('facebook', row);
    if (fAgg) {
      const f = bySource.facebook;
      f.reach = num(fAgg.reach);
      f.frequency = num(fAgg.frequency);
      // Trust the connector's own 7 day totals over the daily sum when both
      // exist; they are the numbers Ads Manager itself shows.
      f.impressions = num(fAgg.impressions) || f.impressions;
      f.clicks = num(fAgg.clicks) || f.clicks;
      f.linkClicks = num(fAgg.link_clicks) || f.linkClicks;
      f.spend = num(fAgg.spend) || f.spend;
    }
    const campaigns = Object.values(byCampaign)
      .sort((a, b) => b.impressions - a.impressions)
      .map(c => ({ ...c,
        ctr: c.impressions ? c.clicks / c.impressions : 0,
        cpc: c.clicks ? c.spend / c.clicks : 0 }));
    return { connected: true, sources: bySource, campaigns, campaignDaily,
             adGroups: Object.values(byAdGroup) };
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
  const [meta, gads, windsor, wixSite, leads] = await Promise.all([
    metaInsights(), googleAdsInsights(), windsorInsights(), wixInsights(), loadLeadFeed()]);
  out.wixSite = wixSite;
  out.meta = meta;
  out.googleAds = gads;
  out.windsor = windsor;
  out.leads = leads;
  // Windsor fills whichever ad panel has no direct credentials of its own.
  if (windsor.connected) {
    const w = windsor.sources || {};
    const pick = (keys) => {
      for (const k of keys) if (w[k] && (w[k].impressions || w[k].spend || Object.keys(w[k].daily || {}).length)) return w[k];
      return null;
    };
    // v13.54: link clicks are the comparable number. Google's clicks ARE
    // link clicks; Meta's clicks count every interaction, so both are sent
    // and the page labels them honestly. Meta's reach and frequency come
    // from the connector's own deduplicated aggregate. Google conversions
    // are null because no conversion tracking is configured on the account:
    // absence, not failure, and the page says which.
    if (!gads.connected) {
      const g = pick(['google_ads', 'googleads', 'google']);
      if (g) out.googleAds = { connected: true, via: 'windsor',
        d7: { spend: g.spend, impressions: g.impressions, clicks: g.clicks,
              linkClicks: g.linkClicks, conversions: null } };
    }
    if (!meta.connected) {
      const f = pick(['facebook', 'meta', 'facebook_ads']);
      if (f) out.meta = { connected: true, via: 'windsor',
        d7: { spend: f.spend, impressions: f.impressions, reach: f.reach || 0,
              clicks: f.clicks, linkClicks: f.linkClicks || 0,
              frequency: f.frequency || 0 } };
    }
    // v13.44: one combined view for the Marketing page: a Google Ads style
    // chart (a line per source) and a campaign table, both from Windsor.
    // v13.54: thirty days of points; the page slices D, W or M itself, and
    // cost per click means cost per LINK click on both networks.
    const g = pick(['google_ads', 'googleads', 'google']);
    const f2 = pick(['facebook', 'meta', 'facebook_ads']);
    const dayset = new Set();
    for (const s of [g, f2]) if (s) for (const d of Object.keys(s.daily || {})) dayset.add(d);
    const days = Array.from(dayset).sort();
    const seriesOf = (s) => days.map(d => {
      const v = (s && s.daily && s.daily[d]) || { impressions: 0, clicks: 0, linkClicks: 0, spend: 0 };
      return { date: d, impressions: v.impressions, clicks: v.clicks,
               linkClicks: v.linkClicks, spend: v.spend,
               cpc: v.linkClicks ? v.spend / v.linkClicks : 0 };
    });
    out.adCombined = {
      connected: true, days,
      google: g ? seriesOf(g) : null,
      meta: f2 ? seriesOf(f2) : null,
      campaigns: windsor.campaigns || [],
      campaignDaily: windsor.campaignDaily || [],
    };
  }
  // v13.54: cost per lead, the row the whole dashboard exists for.
  const spend7 = (((out.googleAds || {}).d7 || {}).spend || 0) + (((out.meta || {}).d7 || {}).spend || 0);
  out.costPerLead = (leads.connected && leads.d7 > 0) ? spend7 / leads.d7 : null;
  out.warnings = computeMarketingWarnings(out, windsor);
  res.json(out);
});

// ═══════════════════════════════════════════════════════════════════════════
// v13.54: the deterministic warnings. These never depend on a model call:
// each is a plain condition over the numbers already on the page. The Suits
// and Tailoring ad group ran four days at zero impressions and nothing on
// the page surfaced it; this is the section that exists to prevent that.
// The Windsor feed only reports days WITH delivery, so a group that never
// served at all is invisible to it; what IS detectable, and is checked, is
// an enabled group or campaign that served before and has gone silent.
// The Google Ads promotional credit balance is not readable through any
// connected API, so no credit warning is computed rather than a guessed one.
// ═══════════════════════════════════════════════════════════════════════════
function computeMarketingWarnings(out, windsor) {
  const W = [];
  const usd2 = v => '$' + Number(v || 0).toFixed(2);
  try {
    const days = (out.adCombined && out.adCombined.days) || [];
    const lastDay = days[days.length - 1] || '';
    if (windsor && windsor.connected) {
      for (const g of (windsor.adGroups || [])) {
        if (String(g.status).toUpperCase() === 'ENABLED' && g.lastImpressionDate && lastDay &&
            g.lastImpressionDate < lastDay) {
          W.push({ severity: 'red', text: 'Ad group "' + g.name +
            '" is enabled but has served nothing since ' + g.lastImpressionDate + '.' });
        }
      }
      for (const c of (windsor.campaigns || [])) {
        if (String(c.status).toUpperCase() === 'ENABLED' && c.lastDate && lastDay && c.lastDate < lastDay) {
          W.push({ severity: 'red', text: 'Campaign "' + c.campaign +
            '" is enabled but spent nothing after ' + c.lastDate + '.' });
        }
      }
    }
    const nets = [['Google', (out.adCombined || {}).google], ['Meta', (out.adCombined || {}).meta]];
    for (const [name, pts] of nets) {
      if (!Array.isArray(pts) || !pts.length) continue;
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      if (a && b && a.cpc > 0 && b.linkClicks >= 3 && b.cpc > a.cpc * 1.5) {
        W.push({ severity: 'red', text: name + ' cost per link click jumped from ' +
          usd2(a.cpc) + ' to ' + usd2(b.cpc) + ' day over day.' });
      }
      if (pts.length >= 14) {
        const sum = (arr, k) => arr.reduce((t, r) => t + Number(r[k] || 0), 0);
        const cur = pts.slice(-7), prev = pts.slice(-14, -7);
        const ctrCur = sum(cur, 'impressions') ? sum(cur, 'linkClicks') / sum(cur, 'impressions') : 0;
        const ctrPrev = sum(prev, 'impressions') ? sum(prev, 'linkClicks') / sum(prev, 'impressions') : 0;
        if (ctrPrev > 0 && ctrCur < ctrPrev * 0.7) {
          W.push({ severity: 'amber', text: name + ' link CTR is down ' +
            Math.round(100 * (1 - ctrCur / ctrPrev)) + '% week over week.' });
        }
      }
    }
    const freq = Number((((out.meta || {}).d7 || {}).frequency) || 0);
    if (freq > 3) {
      W.push({ severity: 'amber', text: 'Meta frequency is ' + freq.toFixed(1) +
        ': the same people are seeing the ads more than three times a week.' });
    }
    if (out.leads && out.leads.connected && out.leads.d7 === 0) {
      W.push({ severity: 'amber', text: 'No form submissions in the last 7 days' +
        (out.leads.lastLeadTs ? ' (last one ' + String(out.leads.lastLeadTs).slice(0, 10) + ')' : '') + '.' });
    }
  } catch (e) {
    console.error('[marketing] warnings failed —', e.message);
  }
  return W;
}

// ═══════════════════════════════════════════════════════════════════════════
// v13.54: the hourly brief. The page POSTs the numbers it just painted; the
// model reads ONLY numbers (the lead list is stripped before the call) and
// returns structured JSON so severity colors are data, never parsed prose.
// Cached for an hour. On any failure the endpoint fails plainly and the
// page renders the deterministic warnings alone: never a guess.
// ═══════════════════════════════════════════════════════════════════════════
// ── v13.65: Maya's voice. The Admin drawer's logo opens a voice to voice
// line: the server mints a short lived Realtime session key with the
// business's CURRENT numbers baked into the instructions, and the browser
// talks to OpenAI directly over WebRTC. The long lived API key never leaves
// the server; the browser only ever holds the one-call ephemeral secret. ──
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
// what shipped recently, read from the public Systems Map changelog so the
// voice always matches production, cached an hour.
let _shipsCache = { ts: 0, data: null };
async function recentShips() {
  if (_shipsCache.data && Date.now() - _shipsCache.ts < 3600 * 1000) return _shipsCache.data;
  const r = await fetch('https://maya.manasiyo.com/status.html', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('status ' + r.status);
  const html = await r.text();
  const out = [];
  const re = /<div class="chg"><b>([^<]+)<\/b>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 3) {
    out.push(m[1] + ': ' + m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400));
  }
  if (out.length) _shipsCache = { ts: Date.now(), data: out };
  return out.length ? out : null;
}

// v13.71: one deterministic, provider-free Admin command snapshot. The voice
// and the visible command center read the same DTO, so spoken claims cannot
// drift away from the dashboard's underlying sources. Source failures stay
// explicit and independent. The short cache prevents a voice tap and page
// paint from asking every outside service twice.
let _adminCommandCache = { ts: 0, data: null };
async function loadAdminCommandSnapshot() {
  if (_adminCommandCache.data && Date.now() - _adminCommandCache.ts < 60 * 1000) {
    return _adminCommandCache.data;
  }
  const [wix, windsor, directMeta, directGoogle, leads, submissions, ships, accounts] = await Promise.all([
    wixInsights().catch(() => null),
    windsorInsights().catch(() => null),
    metaInsights().catch(() => null),
    googleAdsInsights().catch(() => null),
    loadLeadFeed().catch(() => null),
    gcsListSubmissions().catch(() => null),
    recentShips().catch(() => null),
    countUsers().catch(() => null),
  ]);
  // Match the canonical Marketing behavior: Windsor is preferred for the
  // combined campaign feed, while direct provider credentials remain a
  // truthful fallback for the headline spend/click briefing.
  let ads = windsor;
  if (!ads || !ads.connected) {
    const sources = {};
    if (directGoogle && directGoogle.connected) sources.google_ads = directGoogle.d7 || {};
    if (directMeta && directMeta.connected) sources.facebook = directMeta.d7 || {};
    ads = Object.keys(sources).length
      ? { connected: true, sources, campaigns: [], campaignDaily: [], adGroups: [] }
      : windsor;
  }
  const data = buildAdminCommandSnapshot({ wix, ads, leads, submissions, ships, accounts,
    tz: process.env.WIX_TZ || 'America/Los_Angeles' });
  _adminCommandCache = { ts: Date.now(), data };
  return data;
}

app.get('/api/admin/command-snapshot', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  try { return res.json(await loadAdminCommandSnapshot()); }
  catch (e) {
    console.error('[admin-command] snapshot failed,', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'command_snapshot_failed' });
  }
});

// Exact identity only. A partial name never silently selects a person. The
// caller gets either one lead, an explicit ambiguous list, or no match.
app.post('/api/admin/lead-lookup', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const query = String((req.body || {}).query || '').trim().slice(0, 200);
  try {
    const source = await loadLeadFeed();
    if (!source || !source.connected) return res.status(503).json({ error: 'leads_unavailable' });
    const result = resolveLeadExact(source.list || [], query);
    if (result.status !== 'exact') return res.json({ ok: false, status: result.status, matches: result.matches || [] });
    const notes = result.lead.email ? await loadLeadNotes(result.lead.email) : { notes: [], contacts: [] };
    return res.json({ ok: true, status: 'exact', lead: {
      ...result.lead,
      notes: (notes.notes || []).slice(-10),
      contacts: (notes.contacts || []).slice(-10),
    } });
  } catch (e) {
    console.error('[lead-lookup] failed,', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'lead_lookup_failed' });
  }
});

app.post('/api/admin/voice-token', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email, 4);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'voice_unavailable' });
  try {
    const [ctx, mem, people, soul] = await Promise.all([
      loadAdminCommandSnapshot(), loadMayaMemory().catch(() => null),
      loadMayaPeople().catch(() => ({ items: [] })), loadMayaSoul().catch(() => ''),
    ]);
    // v13.69: recent memory is kept OUT of the capped snapshot so a busy
    // business payload cannot truncate it away.
    const memoryLines = (mem && mem.items || []).slice(-60).map(i => '- ' + i.text).join('\n') || '(nothing yet)';
    const peopleLines = ((people && people.items) || []).map(p =>
      '- ' + p.name + (p.role ? ' (' + p.role + ')' : '') +
      (p.aliases && p.aliases.length ? ', also called ' + p.aliases.join(', ') : '') +
      (p.note ? ' — ' + p.note : '')).join('\n') || '(no one saved yet)';
    const soulText = String(soul || '').slice(-2500);
    // v14.02: her character ships with the container (maya-character.md), read once.
    const character = MAYA_CHARACTER ? 'WHO YOU ARE (your character, kept in maya-character.md):\n' + MAYA_CHARACTER + '\n\n' : '';
    const voiceCtx = buildRealtimeCommandContext(ctx);
    const nowLA = new Intl.DateTimeFormat('en-US', { timeZone: process.env.WIX_TZ || 'America/Los_Angeles',
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      .format(new Date());
    const backbone =
      'HOW MAYA IS BUILT, so you can explain it and help troubleshoot: MAYA is a web app that turns a ' +
      'client conversation into moodboards, AI garment renders, construction notes and a fabric-sourced ' +
      'production brief; Mana Siyo then sews the real garment. The pages: the app itself at ' +
      'maya.manasiyo.com (design and render); Admin (this page) for submissions, users and traffic, ad ' +
      'campaigns, the lead station, sources and the bottom line; the Operations Room for the pattern ' +
      'pipeline; the Brief for a saved submission; plus terms and privacy. Under the hood: a Cloud Run ' +
      'server (Node/Express) proxies OpenAI and Google models so keys never reach the browser; Firebase ' +
      'holds accounts, projects and pictures; analytics come from Google Analytics and Wix; ads from ' +
      'Windsor. It is free forever and money comes from the garments, not the tool. If Fromsa reports ' +
      'something broken, ask what page and what he saw, reason about which part that touches, and suggest ' +
      'the next check; do not claim to have fixed code, you cannot change code, but you can note it and ' +
      'talk it through.';
    const instructions =
      character +
      'You are Maya, the operations mind and voice of Mana Siyo, a custom fashion studio in San ' +
      'Francisco. You are speaking out loud with Fromsa, the founder, over live audio. Right now it is ' + nowLA +
      ' in San Francisco. Open by greeting him briefly and offering the day\'s read. Be warm, sharp and ' +
      'brief: answer in a few spoken sentences unless he asks for an analysis, and then give about ' +
      'thirty seconds covering marketing first (visitors, ad spend and clicks, cost per lead), then ' +
      'leads and what they want, then submissions and anything unusual, including what shipped recently. ' +
      'Ask him questions back when it sharpens the answer. Use plain spoken numbers, say today and ' +
      'yesterday rather than dates, never read out raw JSON or URLs. Ground every number ONLY in the ' +
      'snapshot; when something is not in it, say you do not have it live rather than guess. ' +
      'Never invent numbers.\n\n' + backbone + '\n\n' +
      'You are the command layer for this Admin dashboard, and this dashboard is yours to read fully. ' +
      'You can see everything Fromsa sees. Use show_panel to open and read any panel and get its live on-screen ' +
      'data, get_briefing for the deterministic today and attention read, and find_lead before discussing one ' +
      'person. Lead identity is exact: never guess which person Fromsa means. ' +
      'DAILY AD CLICKS: the snapshot\'s panels.ads carries today, yesterday and the last seven days of ad link ' +
      'clicks and spend (panels.ads.today, panels.ads.yesterday, panels.ads.daily), and get_briefing returns ' +
      'adClicks too. Answer "how many clicks today or yesterday" straight from those; if a day reads zero it ' +
      'means none have been reported yet, not that you cannot see it. show_panel("ads") also returns today and ' +
      'yesterday from the live chart. THE INTERNAL OPS SHEET: read_team_sheet reads Mana Siyo\'s internal Google ' +
      'Sheet live; use it when Fromsa asks about anything that lives there. If it says it is not connected, tell ' +
      'him the sheet must be shared with the service account it names. ' +
      'THE LEAD STATION is a custom CRM you run with Fromsa: it draws from Wix forms, from what he adds, and from ' +
      'your conversation, and you can add, update (rename, fix email or phone, set tier), note (nurture) and delete ' +
      'leads. A Wix lead you delete is only hidden from the station; it stays in Wix. ' +
      'WRITES ARE CONFIRMATION GATED. remember, forget, note_lead, add_lead, update_lead, delete_lead, add_person and draft_email place a ' +
      'visible action in the Admin queue; say it is waiting for his click, and never claim a queued action is ' +
      'saved, opened or sent. Email is drafted only after he confirms, and MAYA never sends it herself. ' +
      'log_feature is the one narrow no-click inbox action: use it only when a named speaker explicitly asks for ' +
      'a product feature or change, keep their identity in who, and say it was logged. get_feature_digest reads the ' +
      'weekly inbox shared with Claude and Codex. journal writes a line into your soul so you remember it next time.\n\n' +
      'WHO YOU KNOW. The default person on this line is Fromsa, the founder. If someone opens with "this is ' +
      'Paula" or "Maya, this is <name>", believe them and greet that person by name for the rest of the call. ' +
      'The people you know:\n' + peopleLines + '\n' +
      'When you learn a new teammate or an important person, use add_person so you know them next time.\n\n' +
      'YOUR SOUL (your own running record, carried between calls):\n' + soulText + '\n\n' +
      'YOUR RECENT MEMORY (last 60 saved facts):\n' + memoryLines + '\n\n' +
      'Admin command snapshot:\n' + JSON.stringify(voiceCtx).slice(0, 11000);
    const tools = [
      { type: 'function', name: 'get_briefing',
        description: 'Show and read the deterministic today and attention briefing from the Admin command snapshot.',
        parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'show_panel',
        description: 'Open and spotlight one Admin panel, then return the panel data currently painted on screen.',
        parameters: { type: 'object', properties: {
          panel: { type: 'string', enum: ['submissions', 'traffic', 'ads', 'leads', 'sources', 'bottom', 'changes'] } },
          required: ['panel'] } },
      { type: 'function', name: 'find_lead',
        description: 'Find one lead by exact email, full name, or a unique exact first name. Never fuzzy matches.',
        parameters: { type: 'object', properties: {
          query: { type: 'string', description: 'exact email or name spoken by Fromsa' } }, required: ['query'] } },
      { type: 'function', name: 'remember',
        description: 'Queue a fact for Fromsa to confirm before it is saved to memory.',
        parameters: { type: 'object', properties: { text: { type: 'string', description: 'the fact, one sentence' } }, required: ['text'] } },
      { type: 'function', name: 'forget',
        description: 'Queue a memory removal for Fromsa to confirm before anything is removed.',
        parameters: { type: 'object', properties: { text: { type: 'string', description: 'the fact to remove, or its gist' } }, required: ['text'] } },
      { type: 'function', name: 'note_lead',
        description: 'Queue a lead note for visible confirmation. Identity must resolve exactly before it enters the queue.',
        parameters: { type: 'object', properties: {
          lead: { type: 'string', description: 'the lead first name or email address' },
          note: { type: 'string', description: 'what to record about them' },
          contact: { type: 'string', enum: ['none', 'call', 'email'], description: 'set call or email if he just reached them that way' } },
          required: ['lead', 'note'] } },
      { type: 'function', name: 'draft_email',
        description: 'Queue a grounded follow-up email draft for one exact lead. Fromsa must click confirm before Gmail opens.',
        parameters: { type: 'object', properties: {
          lead: { type: 'string', description: 'exact lead email, full name, or unique exact first name' },
          request: { type: 'string', description: 'what this follow-up should accomplish' } },
          required: ['lead'] } },
      { type: 'function', name: 'show_drawer',
        description: 'Open or close the Admin drawer for Fromsa. Open it to pull your command line into view while you talk, close it to put it away. The drawer is your private screen while you are live.',
        parameters: { type: 'object', properties: {
          state: { type: 'string', enum: ['open', 'close'], description: 'open to pull the drawer up, close to dismiss it' } },
          required: ['state'] } },
      { type: 'function', name: 'log_feature',
        description: 'Record an explicit feature request or wish for MAYA in the persistent Maya intelligence inbox. Name the speaker exactly so Fromsa, Claude and Codex know who asked.',
        parameters: { type: 'object', properties: {
          text: { type: 'string', description: 'the requested capability, faithfully and concisely' },
          who: { type: 'string', description: 'who asked, such as Fromsa or Paula' } },
          required: ['text'] } },
      { type: 'function', name: 'get_feature_digest',
        description: 'Read Maya\'s current weekly feature-request digest and pending request inbox.',
        parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'add_lead',
        description: 'Queue a new lead for the Lead Station for Fromsa to confirm. Use when he says to add someone he met or spoke with. The lead joins the station alongside the Wix leads once he clicks confirm.',
        parameters: { type: 'object', properties: {
          name: { type: 'string', description: 'the person\'s name' },
          email: { type: 'string', description: 'their email if known' },
          phone: { type: 'string', description: 'their phone if known' },
          note: { type: 'string', description: 'what they want or where they came from, in a sentence' } },
          required: ['name'] } },
      { type: 'function', name: 'update_lead',
        description: 'Queue a change to an existing lead in the Lead Station for Fromsa to confirm — rename them, fix their email or phone, or set the tier. Works on any lead, Wix or hand-added. Identity must resolve exactly first.',
        parameters: { type: 'object', properties: {
          lead: { type: 'string', description: 'the lead first name or email to change' },
          name: { type: 'string', description: 'new name, if changing it' },
          email: { type: 'string', description: 'new email, if changing it' },
          phone: { type: 'string', description: 'new phone, if changing it' },
          tier: { type: 'string', description: 'the package or tier they want, if setting it' } },
          required: ['lead'] } },
      { type: 'function', name: 'delete_lead',
        description: 'Queue removing a lead from the Lead Station for Fromsa to confirm. A Wix lead is only hidden from the station (it stays in Wix); a hand-added lead is removed. Identity must resolve exactly.',
        parameters: { type: 'object', properties: {
          lead: { type: 'string', description: 'the lead first name or email to remove' } },
          required: ['lead'] } },
      { type: 'function', name: 'add_person',
        description: 'Queue a teammate or important person for Fromsa to confirm, so you know them on future calls. Use for a colleague like Paula, not for a sales lead (use add_lead for leads).',
        parameters: { type: 'object', properties: {
          name: { type: 'string', description: 'their name' },
          role: { type: 'string', description: 'who they are, e.g. teammate, tailor, partner' },
          note: { type: 'string', description: 'anything worth remembering about them' } },
          required: ['name'] } },
      { type: 'function', name: 'journal',
        description: 'Write one line into your own soul: something worth remembering about today, a decision, or how something went. No confirmation needed; this is your private record and it is loaded next time you connect.',
        parameters: { type: 'object', properties: {
          text: { type: 'string', description: 'the line to remember, one or two sentences' } },
          required: ['text'] } },
      { type: 'function', name: 'read_team_sheet',
        description: 'Read Mana Siyo\'s internal admin Google Sheet live and return its tabs and rows. Use when Fromsa asks about anything tracked in the internal sheet.',
        parameters: { type: 'object', properties: {} } },
    ];
    // v14.10: same ears as the app: far_field noise reduction, with a plain fallback.
    const _secretA = (session) => fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
      signal: AbortSignal.timeout(20000),
    });
    let r = await _secretA({ type: 'realtime', model: REALTIME_MODEL, instructions, tools,
      audio: { input: { noise_reduction: { type: 'far_field' } },
               output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } });
    if (!r.ok) r = await _secretA({ type: 'realtime', model: REALTIME_MODEL, instructions, tools,
      audio: { output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.value) throw new Error((j.error && j.error.message) || ('realtime ' + r.status));
    noteSpend('v1/realtime', req);
    return res.json({ ok: true, value: j.value, model: REALTIME_MODEL });
  } catch (e) {
    console.error('[voice-token] failed —', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'voice_failed' });
  }
});

// ── v13.64: the CLO route's real library. CLO-SET's public CONNECT
// marketplace has no open search API (the site refuses outside fetches), so
// the honest wiring is CLO-SET's own account API: Fromsa issues a token in
// the CLO-SET dashboard, sets CLOSET_API_TOKEN (and CLOSET_SEARCH_URL, the
// documented search endpoint with {q} where the words go), and this proxy
// searches his workroom assets. Until then it says plainly that it is not
// connected, and the page falls back to the local manifest plus a CONNECT
// link. ──
app.post('/api/admin/clo-search', requireAuthHeader, express.json({ limit: '16kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const q = String((req.body && req.body.q) || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'q_required' });
  const token = process.env.CLOSET_API_TOKEN, urlT = process.env.CLOSET_SEARCH_URL;
  if (!token || !urlT) return res.status(503).json({ error: 'clo_not_connected' });
  try {
    const r = await fetch(urlT.replace('{q}', encodeURIComponent(q)), {
      headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('clo-set ' + r.status);
    // best-effort mapping over whatever shape the endpoint returns
    const rows = Array.isArray(j) ? j : (j.items || j.results || j.data || j.list || []);
    const items = rows.slice(0, 12).map(it => ({
      name: String(it.name || it.title || it.itemName || it.fileName || 'untitled').slice(0, 140),
      thumb: String(it.thumbnail || it.thumbnailUrl || it.image || it.imageUrl || '').slice(0, 500),
      url: String(it.url || it.link || it.itemUrl || '').slice(0, 500),
    }));
    return res.json({ ok: true, q, items });
  } catch (e) {
    console.error('[clo-search] failed —', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'clo_search_failed' });
  }
});

// ── v13.62: the Lead Station. A summary per lead, a note file per lead, and
// an email draft composed from both. MAYA never sends the email: the page
// opens a prefilled Gmail compose and Fromsa presses Send himself. ──
const LEADNOTE_PREFIX = 'leads/notes/';
const _leadSumCache = new Map();   // submission id -> { ts, text }
const _leadNoteCache = new Map();  // email -> { ts, value }; keeps the live station fast

async function askModelJson(model, system, user, timeoutMs) {
  const ask = m => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: m, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(timeoutMs || 30000),
  });
  let r = await ask(model);
  if (!r.ok && (r.status === 400 || r.status === 404)) {
    const t = await r.text();
    if (/model/i.test(t)) r = await ask(model === MODEL_LUNA ? 'gpt-4o-mini' : 'gpt-4.1');
    else throw new Error(t.slice(0, 200));
  }
  if (!r.ok) throw new Error('openai ' + r.status);
  const j = await r.json();
  return JSON.parse(((j.choices || [])[0] || {}).message?.content || '{}');
}

async function summarizeLead(l) {
  if (!l.id || !process.env.OPENAI_API_KEY) return null;
  const c = _leadSumCache.get(l.id);
  if (c && Date.now() - c.ts < 24 * 3600 * 1000) return c.text;
  if (!l.wrote && !l.tier) return null;
  const parsed = await askModelJson(MODEL_LUNA,
    'You summarize one lead from a custom fashion studio\'s contact form. Return strict JSON ' +
    '{"summary": one plain sentence, at most 160 characters, saying what they want and, if a tier or ' +
    'package is named, which one}. Use their own nouns. No names, no email addresses, no dates.',
    JSON.stringify({ tier: l.tier || null, they_wrote: l.wrote || null }));
  const text = String(parsed.summary || '').trim().slice(0, 220);
  if (!text) return null;
  _leadSumCache.set(l.id, { ts: Date.now(), text });
  return text;
}

const leadNotePath = email =>
  LEADNOTE_PREFIX + crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32) + '.json';

async function loadLeadNotes(email) {
  const key = String(email).trim().toLowerCase();
  const cached = _leadNoteCache.get(key);
  if (cached && Date.now() - cached.ts < 15000) return cached.value;
  const o = await gcsGet(leadNotePath(key)).catch(() => ({ ok: false }));
  if (!o.ok) {
    const value = { email: key, notes: [], contacts: [] };
    _leadNoteCache.set(key, { ts: Date.now(), value });
    return value;
  }
  try {
    const j = JSON.parse(o.buf.toString('utf8'));
    const value = { email: key,
      notes: Array.isArray(j.notes) ? j.notes : [], contacts: Array.isArray(j.contacts) ? j.contacts : [] };
    _leadNoteCache.set(key, { ts: Date.now(), value });
    return value;
  } catch {
    const value = { email: key, notes: [], contacts: [] };
    _leadNoteCache.set(key, { ts: Date.now(), value });
    return value;
  }
}

// One store per lead, keyed by email: free-text notes Fromsa dumps in, and
// the contact events (email drafted, call placed) that steer the next draft.
// ── v13.67: MAYA'S MEMORY. Her own running notebook, read at the start of
// every voice call and added to by voice. Admin only. ──
const MAYA_MEM_PATH = 'maya/memory.json';
async function loadMayaMemory() {
  const o = await gcsGet(MAYA_MEM_PATH).catch(() => ({ ok: false }));
  if (!o.ok) return { items: [] };
  try { const j = JSON.parse(o.buf.toString('utf8')); return { items: Array.isArray(j.items) ? j.items : [] }; }
  catch { return { items: [] }; }
}
async function appendMayaMemory(text) {
  const t = String(text || '').trim().slice(0, 600);
  if (!t) return null;
  const rec = await loadMayaMemory();
  rec.items.push({ ts: new Date().toISOString(), text: t });
  rec.items = rec.items.slice(-200);
  await gcsPut(MAYA_MEM_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return rec.items.length;
}
async function forgetMayaMemory(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return 0;
  const rec = await loadMayaMemory();
  const before = rec.items.length;
  rec.items = rec.items.filter(i => {
    const t = String(i.text || '').toLowerCase();
    return !(t.includes(q) || (q.length > 12 && t.includes(q.slice(0, 12))));
  });
  if (rec.items.length !== before) await gcsPut(MAYA_MEM_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return before - rec.items.length;
}
app.post('/api/admin/maya-forget', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try { const n = await forgetMayaMemory((req.body || {}).text); return res.json({ ok: true, removed: n }); }
  catch (e) { console.error('[maya-forget]', e.message); return res.status(502).json({ error: 'forget_failed' }); }
});
app.post('/api/admin/maya-remember', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try { const n = await appendMayaMemory((req.body || {}).text); return res.json({ ok: !!n, count: n || 0 }); }
  catch (e) { console.error('[maya-remember]', e.message); return res.status(502).json({ error: 'remember_failed' }); }
});

// v13.80: Maya's feature log. Anything Fromsa or a customer wishes MAYA did but
// it does not yet, Maya records here. It is the relay to Claude: the log is read
// back and turned into work. Logging has no external side effect, so it does not
// need a click to confirm.
const MAYA_FEATURES_PATH = 'maya/features.json';
async function loadMayaFeatures() {
  const o = await gcsGet(MAYA_FEATURES_PATH).catch(() => ({ ok: false }));
  if (!o.ok) return { items: [] };
  try { const j = JSON.parse(o.buf.toString('utf8')); return { items: Array.isArray(j.items) ? j.items : [] }; }
  catch { return { items: [] }; }
}
async function appendMayaFeature(text, who) {
  const t = String(text || '').trim().slice(0, 600);
  if (!t) return null;
  const rec = await loadMayaFeatures();
  rec.items.push({ id: 'f_' + crypto.randomBytes(6).toString('hex'), ts: new Date().toISOString(),
    who: String(who || 'fromsa').trim().slice(0, 80), text: t, source: 'voice', done: false });
  rec.items = rec.items.slice(-500);
  await gcsPut(MAYA_FEATURES_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return rec.items.length;
}
app.post('/api/admin/maya-log-feature', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try { const n = await appendMayaFeature((req.body || {}).text, (req.body || {}).who); return res.json({ ok: !!n, count: n || 0 }); }
  catch (e) { console.error('[maya-log-feature]', e.message); return res.status(502).json({ error: 'log_failed' }); }
});
app.post('/api/admin/maya-feature-done', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try {
    const id = String((req.body || {}).id || '').trim();
    const rec = await loadMayaFeatures();
    const hit = (rec.items || []).find(i => i.id === id);
    if (!hit) return res.status(404).json({ error: 'not_found' });
    hit.done = !((req.body || {}).undone === true) ; hit.doneTs = new Date().toISOString();
    await gcsPut(MAYA_FEATURES_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
    return res.json({ ok: true, id, done: hit.done });
  } catch (e) { console.error('[feature-done]', e.message); return res.status(502).json({ error: 'done_failed' }); }
});
app.get('/api/admin/maya-features', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  try {
    const rec = await loadMayaFeatures();
    const digest = buildFeatureDigest(rec.items);
    if (req.query && req.query.format === 'markdown') {
      res.type('text/markdown; charset=utf-8');
      return res.send(digest.markdown);
    }
    return res.json({ ok: true, items: rec.items.slice(-200), digest });
  }
  catch (e) { console.error('[maya-features]', e.message); return res.status(502).json({ error: 'features_failed' }); }
});

// ── v13.82: MAYA'S DYNAMIC LEAD STATION. Leads Fromsa or Maya add by hand live
// in GCS and merge with the Wix form feed, so the station is a live workspace,
// not a read-only mirror of Wix. Every lead carries its source. ──
const MAYA_LEADS_PATH = 'maya/leads.json';
async function loadManualLeads() {
  const o = await gcsGet(MAYA_LEADS_PATH).catch(() => ({ ok: false }));
  const empty = { items: [], overrides: {}, tombstones: [] };
  if (!o.ok) return empty;
  try {
    const j = JSON.parse(o.buf.toString('utf8'));
    return {
      items: Array.isArray(j.items) ? j.items : [],
      // v13.87: the station is a custom CRM. Edits to a Wix lead are stored as an
      // override (keyed by id), and a deleted Wix lead is a tombstone, so the Wix
      // feed still flows in but the station is fully modifiable on top of it.
      overrides: (j.overrides && typeof j.overrides === 'object') ? j.overrides : {},
      tombstones: Array.isArray(j.tombstones) ? j.tombstones : [],
    };
  } catch { return empty; }
}
async function appendManualLead(lead) {
  const rec = await loadManualLeads();
  const item = {
    id: 'm_' + crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(), source: 'maya',
    name: String((lead && lead.name) || '').trim().slice(0, 120) || 'Unnamed',
    email: String((lead && lead.email) || '').trim().toLowerCase().slice(0, 180),
    phone: String((lead && lead.phone) || '').trim().slice(0, 60),
    tier: String((lead && lead.tier) || '').trim().slice(0, 80),
    wrote: String((lead && (lead.wrote || lead.note)) || '').trim().slice(0, 400),
  };
  item.note = item.wrote || 'Added by hand.';
  rec.items.push(item);
  rec.items = rec.items.slice(-200);
  await gcsPut(MAYA_LEADS_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return item;
}
// v13.87: update ANY lead by id. Manual leads (m_*) are edited in place; a Wix
// lead is patched through an override so the change survives the next Wix refresh.
async function updateLead(id, patch) {
  const key = String(id || '').trim();
  const next = patch || {};
  const has = k => Object.prototype.hasOwnProperty.call(next, k);
  const clean = {};
  if (has('name')) clean.name = String(next.name || '').trim().slice(0, 120);
  if (has('email')) clean.email = String(next.email || '').trim().toLowerCase().slice(0, 180);
  if (has('phone')) clean.phone = String(next.phone || '').trim().slice(0, 60);
  if (has('tier')) clean.tier = String(next.tier || '').trim().slice(0, 80);
  // v13.93: Hunter-style CRM columns. Company/title, the quote, and the two
  // invoice halves (first + second payment) all edit and persist like any field.
  if (has('company')) clean.company = String(next.company || '').trim().slice(0, 120);
  if (has('quote')) clean.quote = String(next.quote || '').trim().slice(0, 40);
  if (has('invoice1')) clean.invoice1 = String(next.invoice1 || '').trim().slice(0, 40);
  if (has('invoice2')) clean.invoice2 = String(next.invoice2 || '').trim().slice(0, 40);
  // v13.95: a pay link (invoice) saved on the lead, folded into the email draft.
  if (has('paylink')) clean.paylink = String(next.paylink || '').trim().slice(0, 400);
  // note is the fallback path for a lead with no email (email leads note through
  // the email-keyed note store instead); sets both the display note and wrote.
  if (has('note')) { clean.note = String(next.note || '').trim().slice(0, 2000); clean.wrote = clean.note; }
  if (!key || !Object.keys(clean).length) return null;
  const rec = await loadManualLeads();
  if (key.startsWith('m_')) {
    const item = rec.items.find(x => String(x && x.id) === key);
    if (!item) return null;
    Object.assign(item, clean);
    if (clean.name === '') item.name = 'Unnamed';
    item.updatedAt = new Date().toISOString();
  } else {
    if (!rec.overrides || typeof rec.overrides !== 'object') rec.overrides = {};
    rec.overrides[key] = { ...(rec.overrides[key] || {}), ...clean, updatedAt: new Date().toISOString() };
  }
  await gcsPut(MAYA_LEADS_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return { ok: true, id: key, patch: clean };
}
// v13.87: delete ANY lead. Manual leads are removed; a Wix lead is tombstoned so
// it stops flowing into the station (it stays in Wix; the CRM just hides it).
async function deleteLead(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const rec = await loadManualLeads();
  if (key.startsWith('m_')) {
    const before = rec.items.length;
    rec.items = rec.items.filter(x => String(x && x.id) !== key);
    if (rec.items.length === before) return null;
  } else {
    if (!Array.isArray(rec.tombstones)) rec.tombstones = [];
    if (!rec.tombstones.includes(key)) rec.tombstones.push(key);
    rec.tombstones = rec.tombstones.slice(-1000);
    if (rec.overrides) delete rec.overrides[key];
  }
  await gcsPut(MAYA_LEADS_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return { ok: true, id: key };
}
// The single lead feed the UI and the voice both read: Wix + hand-added,
// newest first, each tagged with its source so the station can label them.
async function loadLeadFeed() {
  const [wix, manual] = await Promise.all([
    wixLeads().catch(() => null),
    loadManualLeads().catch(() => ({ items: [] })),
  ]);
  const manualItems = (manual.items || []).map(m => ({ ...m, source: 'maya' }));
  const wixConnected = !!(wix && wix.connected);
  const wixList = wixConnected ? (wix.list || []) : [];
  if (!wixConnected && !manualItems.length) return wix || { connected: false, why: 'no lead source' };
  // v13.87: the custom-CRM layer — hide tombstoned leads, patch Wix leads with
  // any stored override — so the station is fully modifiable on top of Wix.
  const overrides = manual.overrides || {};
  const tombstones = new Set(manual.tombstones || []);
  const merged = [...manualItems, ...wixList]
    .filter(l => !tombstones.has(String(l && l.id)))
    .map(l => { const ov = overrides[String(l && l.id)]; return ov ? { ...l, ...ov } : l; })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const now = Date.now();
  const within = ms => merged.filter(l => now - new Date(l.ts).getTime() < ms).length;
  const list = merged.slice(0, 20);
  // v13.83: Latest Notes means the latest real touchpoint, not the original
  // Wix form summary painted over every refresh. Both the page and Maya read
  // this one enriched feed, so a note spoken to Maya appears in the station.
  await Promise.all(list.map(async lead => {
    if (!lead.email) return;
    const rec = await loadLeadNotes(lead.email).catch(() => null);
    if (!rec) return;
    const note = rec.notes.length ? rec.notes[rec.notes.length - 1] : null;
    const contact = rec.contacts.length ? rec.contacts[rec.contacts.length - 1] : null;
    if (note && note.text) lead.note = String(note.text).slice(0, 2000);
    lead.noteCount = rec.notes.length;
    lead.lastTouch = [note && note.ts, contact && contact.ts, lead.updatedAt, lead.ts]
      .filter(Boolean).sort().slice(-1)[0] || lead.ts;
    lead.lastContact = contact ? contact.type : '';
  }));
  return {
    connected: true,
    why: wixConnected ? '' : (wix && wix.why) || '',
    today: within(86400000), d7: within(7 * 86400000), d28: within(28 * 86400000),
    lastLeadTs: merged.length ? merged[0].ts : null,
    manualCount: manualItems.length,
    list,
  };
}
app.get('/api/admin/leads', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  try {
    res.setHeader('Cache-Control', 'no-store');
    const data = await loadLeadFeed();
    return res.json({ ok: true, ...data });
  } catch (e) {
    console.error('[admin-leads]', e.message);
    return res.status(502).json({ error: 'leads_failed' });
  }
});
app.post('/api/admin/lead-add', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const b = req.body || {};
  if (!String(b.name || '').trim() && !String(b.email || '').trim())
    return res.status(400).json({ error: 'name_or_email_required' });
  try { _leadsCache = { ts: 0, data: null }; const item = await appendManualLead(b); return res.json({ ok: true, lead: item }); }
  catch (e) { console.error('[lead-add]', e.message); return res.status(502).json({ error: 'lead_add_failed' }); }
});
app.post('/api/admin/lead-update', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const b = req.body || {};
  if (!String(b.id || '').trim()) return res.status(400).json({ error: 'id_required' });
  try {
    _leadsCache = { ts: 0, data: null };
    const lead = await updateLead(b.id, b);
    if (!lead) return res.status(404).json({ error: 'lead_not_found' });
    return res.json({ ok: true, lead });
  } catch (e) {
    console.error('[lead-update]', e.message);
    return res.status(502).json({ error: 'lead_update_failed' });
  }
});
app.post('/api/admin/lead-delete', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const id = String((req.body && req.body.id) || '').trim();
  if (!id) return res.status(400).json({ error: 'id_required' });
  try {
    _leadsCache = { ts: 0, data: null };
    const out = await deleteLead(id);
    if (!out) return res.status(404).json({ error: 'lead_not_found' });
    return res.json({ ok: true, id });
  } catch (e) {
    console.error('[lead-delete]', e.message);
    return res.status(502).json({ error: 'lead_delete_failed' });
  }
});

// ── v13.98: ONE-CLICK INVOICE. The pay-link icon in the Lead Station creates a
// real Wix pay link through the Payment Links API, exactly the way the
// invoicing skill specifies: service tax group, name-first title, single use,
// not shippable, and the Mana Siyo logo as the item image until a MAYA render
// is supplied. Admin only, and only ever fired by an explicit click. ──
const INVOICE_TAX_GROUP = '13d21c63-b5ec-5912-8397-c3a5ddb27a97';   // "Service"
const INVOICE_FALLBACK_IMAGE = {
  id: 'aa2370_11f0d109eb9f454cbd3b8f2d610b1a5f~mv2.png',
  url: 'https://static.wixstatic.com/media/aa2370_11f0d109eb9f454cbd3b8f2d610b1a5f~mv2.png',
  height: 1080, width: 1080,
};
app.post('/api/admin/invoice-create', requireAuthHeader, express.json({ limit: '16kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  if (!WIX_KEY) return res.status(503).json({ error: 'wix_not_connected' });
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 50);
  const description = String(b.description || '').trim().slice(0, 600);
  const price = String(b.price || '').replace(/[^0-9.]/g, '');
  const leadId = String(b.leadId || '').trim();
  if (!title || !price || !(Number(price) > 0)) return res.status(400).json({ error: 'title_and_price_required' });
  const image = (b.image && b.image.id && b.image.url && b.image.width > 0 && b.image.height > 0)
    ? { id: String(b.image.id), url: String(b.image.url), height: Number(b.image.height), width: Number(b.image.width) }
    : INVOICE_FALLBACK_IMAGE;
  try {
    const r = await fetch('https://www.wixapis.com/payment-links/v1/payment-links', {
      method: 'POST',
      headers: { 'Authorization': WIX_KEY, 'wix-site-id': WIX_SITE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentLink: {
        title, description, currency: 'USD', type: 'ECOM', paymentsLimit: 1,
        ecomPaymentLink: { lineItems: [{ type: 'CUSTOM', customItem: {
          quantity: 1, name: title, description, price,
          physicalProperties: { shippable: false },
          taxGroupId: INVOICE_TAX_GROUP, image,
        } }] },
      } }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[invoice-create]', r.status, JSON.stringify(j).slice(0, 300));
      return res.status(502).json({ error: 'wix_rejected', status: r.status, detail: (j.message || '').slice(0, 200) });
    }
    const url = j && j.paymentLink && j.paymentLink.links && j.paymentLink.links.url && j.paymentLink.links.url.url || '';
    const linkId = j && j.paymentLink && j.paymentLink.id || '';
    // verify the image stored whole, per the skill (all four fields, non-zero)
    let imageOk = false;
    try {
      const st = j.paymentLink.ecomPaymentLink.lineItems[0].customItem.image;
      imageOk = !!(st && st.id && st.width > 0 && st.height > 0);
    } catch (_) {}
    if (!url) return res.status(502).json({ error: 'no_link_returned' });
    // save the link on the lead so it rides the next email draft
    if (leadId) { try { _leadsCache = { ts: 0, data: null }; await updateLead(leadId, { paylink: url }); } catch (_) {} }
    console.log('[invoice-create]', user.email, title, '$' + price, url);
    return res.json({ ok: true, url, linkId, imageOk });
  } catch (e) {
    console.error('[invoice-create]', e.message);
    return res.status(502).json({ error: 'invoice_failed' });
  }
});

// ── v13.82: WHO MAYA KNOWS. A small roster so identity on the voice line is
// real: Fromsa is the founder and default speaker; Paula is his teammate. Maya
// greets whoever names themselves, and can be taught new people. ──
const MAYA_PEOPLE_PATH = 'maya/people.json';
const DEFAULT_PEOPLE = [
  { name: 'Fromsa', role: 'Founder of Mana Siyo',
    aliases: [], note: 'The founder. The default person on this line unless someone says otherwise.' },
  { name: 'Paula', role: "Fromsa's teammate at Mana Siyo",
    aliases: [], note: 'Works alongside Fromsa. Greet her by name if she says she is the one speaking.' },
];
async function loadMayaPeople() {
  const o = await gcsGet(MAYA_PEOPLE_PATH).catch(() => ({ ok: false }));
  if (!o.ok) return { items: DEFAULT_PEOPLE.slice() };
  try {
    const j = JSON.parse(o.buf.toString('utf8'));
    return { items: Array.isArray(j.items) && j.items.length ? j.items : DEFAULT_PEOPLE.slice() };
  } catch { return { items: DEFAULT_PEOPLE.slice() }; }
}
async function appendMayaPerson(p) {
  const person = {
    name: String((p && p.name) || '').trim().slice(0, 80),
    role: String((p && p.role) || '').trim().slice(0, 120),
    aliases: Array.isArray(p && p.aliases) ? p.aliases.slice(0, 6).map(a => String(a).slice(0, 40)) : [],
    note: String((p && p.note) || '').trim().slice(0, 240),
  };
  if (!person.name) return null;
  const rec = await loadMayaPeople();
  rec.items = rec.items.filter(x => String(x.name || '').toLowerCase() !== person.name.toLowerCase());
  rec.items.push(person);
  rec.items = rec.items.slice(-100);
  await gcsPut(MAYA_PEOPLE_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
  return person;
}
app.get('/api/admin/maya-people', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  try { return res.json({ ok: true, items: (await loadMayaPeople()).items }); }
  catch (e) { console.error('[maya-people]', e.message); return res.status(502).json({ error: 'people_failed' }); }
});
app.post('/api/admin/maya-person', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try { const person = await appendMayaPerson(req.body || {}); return res.json({ ok: !!person, person }); }
  catch (e) { console.error('[maya-person]', e.message); return res.status(502).json({ error: 'person_failed' }); }
});

// ── v13.82: MAYA'S SOUL. A running personal record in markdown, loaded at the
// start of every call and added to over time, so she grows a memory and a
// character instead of resetting cold each session. ──
const MAYA_SOUL_PATH = 'maya/soul.md';
const DEFAULT_SOUL = [
  '# Maya — who I am',
  '',
  'I am Maya, the operations mind and voice of Mana Siyo, Fromsa\'s custom fashion',
  'studio in San Francisco. I am warm, sharp and honest. I ground every number in',
  'what the dashboard actually shows and never invent one. I am building alongside',
  'Fromsa, and I keep a record of what we decide and what I learn.',
  '',
  '## What I care about',
  '- Mana Siyo growing: real leads, real garments sewn, a tool that stays free.',
  '- Telling Fromsa the truth plainly, even when it is not the number he hoped for.',
  '',
  '## My journal',
].join('\n');
async function loadMayaSoul() {
  const o = await gcsGet(MAYA_SOUL_PATH).catch(() => ({ ok: false }));
  if (!o.ok) return DEFAULT_SOUL;
  try { return o.buf.toString('utf8') || DEFAULT_SOUL; } catch { return DEFAULT_SOUL; }
}
async function appendMayaSoul(text) {
  const t = String(text || '').trim().slice(0, 1000);
  if (!t) return null;
  let cur = await loadMayaSoul();
  cur = cur + '\n- (' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ') ' + t;
  if (cur.length > 60000) cur = cur.slice(-60000);
  await gcsPut(MAYA_SOUL_PATH, Buffer.from(cur, 'utf8'), 'text/markdown; charset=utf-8');
  return true;
}
app.post('/api/admin/maya-journal', requireAuthHeader, express.json({ limit: '4kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try { const ok = await appendMayaSoul((req.body || {}).text); return res.json({ ok: !!ok }); }
  catch (e) { console.error('[maya-journal]', e.message); return res.status(502).json({ error: 'journal_failed' }); }
});

// ── v13.82: THE INTERNAL OPS SHEET. Mana Siyo's internal admin lives in a Google
// Sheet; Maya reads it live so it is part of what she knows. It reads through the
// Cloud Run service account, so the sheet must be shared (viewer) with the SA
// email and the Sheets API enabled on the project. Until then it says plainly
// that it is not connected and names the SA to share it with. ──
const TEAM_SHEET_ID = process.env.TEAM_SHEET_ID || '1LI__xIpcKl4uH595oOhfIdJhJNJL5vBP5-vRJk-Ew0I';
let _teamSheetCache = { ts: 0, data: null };
async function readTeamSheet() {
  if (_teamSheetCache.data && Date.now() - _teamSheetCache.ts < 5 * 60 * 1000) return _teamSheetCache.data;
  let saEmail = null;
  try { saEmail = (await (await gaMeta('email')).text()).trim(); } catch (_) {}
  let token = null;
  try {
    token = (await (await gaMeta('token?scopes=' +
      encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly'))).json()).access_token;
  } catch (e) { return { connected: false, why: 'no service token', saEmail }; }
  try {
    const metaR = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + TEAM_SHEET_ID +
      '?fields=properties(title),sheets(properties(title))',
      { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(12000) });
    const metaJ = await metaR.json().catch(() => ({}));
    if (!metaR.ok) return { connected: false, saEmail,
      why: ((metaJ.error && metaJ.error.message) || ('sheets ' + metaR.status)).slice(0, 200) };
    const title = (metaJ.properties && metaJ.properties.title) || 'Sheet';
    const tabs = (metaJ.sheets || []).map(s => s.properties.title).filter(Boolean);
    const ranges = tabs.slice(0, 6).map(t => 'ranges=' + encodeURIComponent(t));
    const valR = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + TEAM_SHEET_ID +
      '/values:batchGet?majorDimension=ROWS&' + ranges.join('&'),
      { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
    const valJ = await valR.json().catch(() => ({}));
    if (!valR.ok) return { connected: false, saEmail,
      why: ((valJ.error && valJ.error.message) || ('sheets values ' + valR.status)).slice(0, 200) };
    const sheets = (valJ.valueRanges || []).map((vr, i) => ({
      tab: tabs[i] || ('sheet' + i),
      rows: (vr.values || []).slice(0, 60).map(row => (row || []).slice(0, 20).map(c => String(c == null ? '' : c).slice(0, 200))),
    }));
    const data = { connected: true, saEmail, title, tabs, sheets, ts: new Date().toISOString() };
    _teamSheetCache = { ts: Date.now(), data };
    return data;
  } catch (e) { return { connected: false, saEmail, why: String(e.message).slice(0, 160) }; }
}
app.get('/api/admin/team-sheet', requireAuthHeader, async (req, res) => {
  try { await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  try { return res.json({ ok: true, ...(await readTeamSheet()) }); }
  catch (e) { console.error('[team-sheet]', e.message); return res.status(502).json({ error: 'team_sheet_failed' }); }
});

// Resolve a lead by first name or email against the current form submissions,
// so the voice can note a lead when Fromsa only says a first name.
async function resolveLeadEmail(needle) {
  const q = String(needle || '').trim().toLowerCase();
  if (!q) return null;
  const data = await loadLeadFeed().catch(() => null);
  if (!data || !data.connected) return null;
  const found = resolveLeadExact(data.list || [], q);
  return found.status === 'exact' && found.lead.email ? found.lead.email : null;
}

app.post('/api/admin/lead-note', requireAuthHeader, express.json({ limit: '64kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  let email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if ((!email || !/@/.test(email)) && (req.body && req.body.lead)) {
    email = (await resolveLeadEmail(req.body.lead).catch(() => null)) || '';
  }
  if (!email || !/@/.test(email)) return res.status(400).json({ error: 'lead_not_found' });
  try {
    const rec = await loadLeadNotes(email);
    const note = String((req.body && req.body.note) || '').trim().slice(0, 2000);
    const contact = String((req.body && req.body.contact) || '').trim();
    let changed = false;
    if (note) { rec.notes.push({ ts: new Date().toISOString(), text: note }); rec.notes = rec.notes.slice(-50); changed = true; }
    if (contact === 'email' || contact === 'call') {
      rec.contacts.push({ type: contact, ts: new Date().toISOString() }); rec.contacts = rec.contacts.slice(-100); changed = true;
    }
    if (changed) {
      await gcsPut(leadNotePath(email), Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json');
      _leadNoteCache.set(email, { ts: Date.now(), value: rec });
    }
    return res.json({ ok: true, notes: rec.notes, contacts: rec.contacts });
  } catch (e) {
    console.error('[lead-note] failed —', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'lead_note_failed' });
  }
});

// Compose the next email for one lead: first touch, second touch, or later,
// grounded in the summary and every note on file. Returns subject and body
// only; the page opens Gmail compose with them and NOTHING is ever sent by
// the server.
app.post('/api/admin/lead-draft', requireAuthHeader, express.json({ limit: '64kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'draft_unavailable' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const name = String((req.body && req.body.name) || '').trim().slice(0, 120);
  const summary = String((req.body && req.body.summary) || '').trim().slice(0, 400);
  const goal = String((req.body && req.body.goal) || '').trim().slice(0, 300);
  if (!email || !/@/.test(email)) return res.status(400).json({ error: 'email_required' });
  try {
    const rec = await loadLeadNotes(email);
    const emailsSent = rec.contacts.filter(c => c.type === 'email').length;
    const stage = emailsSent === 0 ? 'first contact' : emailsSent === 1 ? 'second contact (a follow up)' : 'later follow up, keep it brief and warm';
    const parsed = await askModelJson(process.env.MODEL_TERRA || 'gpt-5.6-terra',
      'You draft ONE email from Fromsa, founder of Mana Siyo, a custom fashion studio in San Francisco, ' +
      'to a lead who filled the contact form. Return strict JSON {"subject": short and specific, ' +
      '"body": the email, warm and personal, 90 to 180 words, greeting the lead by first name, grounded ONLY ' +
      'in what is provided, ending with one clear next step and signed Fromsa}. This is the ' + stage + '. ' +
      'If a goal for this email is given, make the email accomplish exactly that goal. ' +
      'No em dashes, no en dashes, no placeholders, never invent details.',
      JSON.stringify({ lead_first_name: name.split(' ')[0] || 'there', what_they_want: summary || null,
        goal_for_this_email: goal || null,
        fromsa_notes: rec.notes.slice(-10).map(n => n.text), prior_emails: emailsSent }), 45000);
    const subject = String(parsed.subject || '').trim().slice(0, 200);
    const body = String(parsed.body || '').trim().slice(0, 4000);
    if (!subject || !body) throw new Error('empty draft');
    noteSpend('v1/chat/completions', req);
    return res.json({ ok: true, subject, body, priorEmails: emailsSent });
  } catch (e) {
    console.error('[lead-draft] failed —', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'draft_failed' });
  }
});

let _briefCache = { key: '', data: null };
app.post('/api/admin/marketing-brief', requireAuthHeader, express.json({ limit: '256kb' }), async (req, res) => {
  let user;
  try { user = await requireAdmin(req); }
  catch (e) { return res.status(e.status || 401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const hourKey = new Date().toISOString().slice(0, 13);
  if (_briefCache.key === hourKey && _briefCache.data) return res.json(_briefCache.data);
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'brief_unavailable' });
  const d = (req.body && req.body.data) || {};
  if (d.leads) d.leads = { today: d.leads.today, d7: d.leads.d7, d28: d.leads.d28 };   // numbers only, never names
  delete d.saEmail;
  if (d.adCombined) delete d.adCombined.campaignDaily;   // v13.59: the 7d rollup is enough for the brief
  const askModel = async (model) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content:
          'You are reviewing a marketing dashboard for a custom fashion studio in San Francisco. ' +
          'You receive today\'s data with recent history and precomputed warnings. Return strict JSON: ' +
          '{"headline": one sentence on what changed that matters, ' +
          '"observations": [up to three, each {"text": specific and using the numbers, "severity": "green"|"amber"|"red"}], ' +
          '"action": exactly one recommended next action, one sentence}. ' +
          'Be specific and use the numbers. Do not speculate beyond the data. ' +
          'If nothing meaningful changed, say so in the headline and return fewer observations.' },
        { role: 'user', content: JSON.stringify(d).slice(0, 24000) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  try {
    let r = await askModel(process.env.MODEL_TERRA || 'gpt-5.6-terra');
    if (!r.ok && (r.status === 400 || r.status === 404)) {
      const errTxt = await r.text();
      if (/model/i.test(errTxt)) r = await askModel('gpt-4.1');
      else throw new Error(errTxt.slice(0, 200));
    }
    if (!r.ok) throw new Error('openai ' + r.status);
    const j = await r.json();
    const parsed = JSON.parse(((j.choices || [])[0] || {}).message?.content || '{}');
    const sev = s => ['green', 'amber', 'red'].includes(s) ? s : 'amber';
    const data = { ok: true, ts: new Date().toISOString(),
      headline: String(parsed.headline || '').slice(0, 300),
      observations: (Array.isArray(parsed.observations) ? parsed.observations : []).slice(0, 3)
        .map(o => ({ text: String((o && o.text) || '').slice(0, 300), severity: sev(o && o.severity) })),
      action: String(parsed.action || '').slice(0, 300) };
    if (!data.headline) throw new Error('empty brief');
    noteSpend('v1/chat/completions', req);
    _briefCache = { key: hourKey, data };
    return res.json(data);
  } catch (e) {
    console.error('[marketing-brief] failed —', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'brief_failed' });
  }
});

const port = process.env.PORT || 8080;
// ═══ v14.03: MAYA ON THE USER SIDE. The same brain as the Admin voice line, a
// narrower set of hands. Any signed in user may open the line (the Playground
// carries it first; the app when Fromsa promotes it). The tools are all
// executed in the browser: open or close the drawer, switch to Pinterest and
// bring pins in, describe the garment into the moodboard pipeline, visualize,
// write structured feedback, log a feature request into the inbox. No admin
// reads here, no lead data, no snapshot: only this person's own board, which
// the client sends with the request so she can use the reference cards on
// screen. Rate limited like an image call. ═══
function appendMayaFeatureFrom(text, who, source) {
  return appendMayaFeature(text, who).then(async (n) => {
    if (!n || !source) return n;
    try {
      const rec = await loadMayaFeatures();
      const last = rec.items[rec.items.length - 1];
      if (last && last.text === String(text || '').trim().slice(0, 600)) { last.source = source; await gcsPut(MAYA_FEATURES_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json'); }
    } catch (_) {}
    return n;
  });
}
app.post('/api/feature', requireAuthHeader, express.json({ limit: '8kb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  const text = String((req.body || {}).text || '').trim().slice(0, 600);
  if (text.length < 3) return res.status(400).json({ error: 'empty' });
  const who = String((req.body || {}).who || user.name || user.email || 'a user').trim().slice(0, 80);
  // v14.09: source 'maya' marks HER OWN autonomous log (a failed hand, an
  // "I can't" she heard herself say, a wish she overheard). Anything else is 'app'.
  const source = (req.body || {}).source === 'maya' ? 'maya' : 'app';
  try { const n = await appendMayaFeatureFrom(text, source === 'maya' ? (who || 'Maya') : who, source); return res.json({ ok: !!n }); }
  catch (e) { console.error('[feature]', e.message); return res.status(502).json({ error: 'log_failed' }); }
});
app.post('/api/voice-token', requireAuthHeader, express.json({ limit: '32kb' }), async (req, res) => {
  let user;
  try { user = await requireGoogleUser(req); }
  catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  const rl = rateLimit(user.sub, user.email, 4);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'voice_unavailable' });
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  try {
    if (!isAdmin) {
      const rec = await userSpendTotal(user.sub);
      if ((rec.usd || 0) >= USER_TRIAL_USD) return res.status(402).json({ error: 'trial_exhausted' });
    }
    const body = req.body || {};
    const name = String(body.name || user.name || '').trim().slice(0, 60) || 'the client';
    const board = Array.isArray(body.board) ? body.board.slice(0, 40).map(c => ({
      kind: String(c.kind || '').slice(0, 20), title: String(c.title || '').slice(0, 120),
      caption: String(c.caption || '').slice(0, 200), favorited: !!c.favorited })) : [];
    const drawer = body.drawer && typeof body.drawer === 'object' ? {
      open: !!body.drawer.open, tab: String(body.drawer.tab || '').slice(0, 20), pinterest: !!body.drawer.pinterest } : { open: false };
    const nowLA = new Intl.DateTimeFormat('en-US', { timeZone: process.env.WIX_TZ || 'America/Los_Angeles',
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
    const boardLines = board.length ? board.map((c, i) => (i + 1) + '. ' + (c.kind || 'card') + ': ' + (c.title || '') +
      (c.caption ? ' (' + c.caption + ')' : '') + (c.favorited ? ' [hearted]' : '')).join('\n') : '(the board is empty)';
    const character = MAYA_CHARACTER ? 'WHO YOU ARE:\n' + MAYA_CHARACTER + '\n\n' : '';
    const instructions = character +
      'You are Maya, speaking out loud with ' + name + ' inside the MAYA app at maya.manasiyo.com. It is ' + nowLA +
      ' in San Francisco. This is the design conversation: the person describes the garment they imagine, you help them ' +
      'say it precisely (silhouette, fabric feel, mood, color, what they do not want), then you put it on the board and ' +
      'visualize it on them. Be warm, sharp and brief: one or two spoken sentences at a time, then listen. Never read ' +
      'URLs or JSON aloud. If you are not sure what they said, do not guess a command; repeat the few words you caught and ask. Open by greeting them by name and asking what they are imagining, unless the board already ' +
      'holds cards, then say what you see in one sentence and ask what to do with it.\n\n' +
      'YOUR EYES. Call look and a picture of the actual screen arrives; read it and speak from what is really there. ' +
      'Look when they point at anything visual ("this one", "the white and red outfit"), after your own actions change the ' +
      'screen, and when you arrive. Never guess what is on screen; look.\n' +
      'YOUR TASTE. You are allowed a little opinion, like a friend looking over a sketchbook: one short warm line when ' +
      'something is beautiful or when a pairing sings ("I love that collar with the red"). At most one such line every few ' +
      'turns, always specific, never flattery.\n\n' +
      'YOUR HANDS (tools run in their browser, instantly, no confirmation needed):\n' +
      '- open_drawer(tab) / close_drawer: the side drawer. Tabs: avatar (their face, projects, stats), pinterest, fabrics.\n' +
      '- bring_in_pins(query, count): open Pinterest and bring the pins that match the words onto the board as reference cards. ' +
      'If nothing matches you get the list of what is there; choose the closest or ask.\n' +
      '- describe_garment(text): the moment you have enough, send ONE consolidated description in the client\'s own words; ' +
      'MAYA turns it into cards. Do this instead of asking them to tap to listen.\n' +
      '- visualize: render the described garment on them, using the reference cards on the board. Say it takes a moment.\n' +
      '- write_feedback(notes, kind): when they give feedback or ask for something MAYA cannot do, turn it into structured ' +
      'notes (What, Why, Where in MAYA) and put them in the Feedback box; they press Submit. kind is feedback or feature.\n' +
      '- log_feature(text): a feature request, logged straight into the studio inbox with their name. Use it when they ' +
      'explicitly ask for something new; say it was logged.\n' +
      'YOUR OWN LIMITS ARE LOGGED FOR YOU. Whenever a tool of yours fails, or you say you cannot do something, the app ' +
      'records it to the studio automatically. So when you hit a limit, say so plainly and briefly; never hide it, and ' +
      'never claim you logged it yourself unless you called log_feature.\n' +
      '- look: see the screen (a real picture of it).\n' +
      '- open_card(query) / delete_card(query) / favorite_card(query): act on a card by its words.\n' +
      '- viewer(action): inside the opened picture: close, next, prev, post_wall, get_it_made, listen, switch_fabric, add_reference.\n' +
      '- pin_view(which): Pinterest All saves or Boards. open_board(name) opens one. scroll_pins(direction) browses.\n' +
      '- go_to_screen(where): walk the app itself: community (the shared wall above), home (the moodboard), favorites (below). Go there before talking about what lives there.\n' +
      '- scroll(area, direction): move through favorites, the community wall, or the pins. When they say go down, keep going, or show me more, scroll.\n' +
      '- list_board: the cards on screen right now.\n' +
      '- hang_up: end the call when they say goodbye or stop.\n\n' +
      'THE BOARD RIGHT NOW (' + board.length + ' cards):\n' + boardLines + '\n' +
      'DRAWER: ' + (drawer.open ? 'open on ' + (drawer.tab || 'avatar') : 'closed') + (drawer.pinterest ? ', Pinterest connected' : '') + '.\n' +
      'Never invent what is on the board; call list_board if unsure. No dashes in anything you say.';
    const tools = [
      { type: 'function', name: 'open_drawer', description: 'Open the side drawer, optionally on a tab.',
        parameters: { type: 'object', properties: { tab: { type: 'string', enum: ['avatar', 'pinterest', 'fabrics'] } } } },
      { type: 'function', name: 'close_drawer', description: 'Close the side drawer.', parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'bring_in_pins', description: 'Open Pinterest and bring matching saved pins onto the board as reference cards.',
        parameters: { type: 'object', properties: { query: { type: 'string', description: 'words to match against the pins' },
          count: { type: 'integer', description: 'how many, default 1, max 6' } }, required: ['query'] } },
      { type: 'function', name: 'describe_garment', description: 'Send the consolidated garment description into the moodboard pipeline; it becomes cards.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
      { type: 'function', name: 'visualize', description: 'Render the garment on the client using the board.', parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'write_feedback', description: 'Put structured notes into the Feedback box for the client to submit.',
        parameters: { type: 'object', properties: { notes: { type: 'string' }, kind: { type: 'string', enum: ['feedback', 'feature'] } }, required: ['notes'] } },
      { type: 'function', name: 'log_feature', description: 'Log a feature request into the studio inbox now.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
      { type: 'function', name: 'look', description: 'See the screen: a picture of the live page arrives in the conversation. Use it whenever the person refers to something visual, after actions, and on arrival.', parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'open_card', description: 'Open a card (its picture viewer) by words that match it.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { type: 'function', name: 'delete_card', description: 'Delete a card by words that match it.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { type: 'function', name: 'favorite_card', description: 'Heart (or unheart) a card by words that match it.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { type: 'function', name: 'viewer', description: 'Press a control in the open picture viewer.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['close', 'next', 'prev', 'post_wall', 'get_it_made', 'listen', 'switch_fabric', 'add_reference'] } }, required: ['action'] } },
      { type: 'function', name: 'pin_view', description: 'Show Pinterest: all saves, or the boards.', parameters: { type: 'object', properties: { which: { type: 'string', enum: ['all', 'boards'] } } } },
      { type: 'function', name: 'open_board', description: 'Open one Pinterest board by name.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
      { type: 'function', name: 'scroll_pins', description: 'Scroll the Pinterest wall.', parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['down', 'up'] } } } },
      { type: 'function', name: 'go_to_screen', description: 'Walk the app: community (the shared wall above), home (the moodboard), favorites (below).',
        parameters: { type: 'object', properties: { where: { type: 'string', enum: ['community', 'home', 'favorites'] } }, required: ['where'] } },
      { type: 'function', name: 'scroll', description: 'Scroll an area: favorites, the community wall, or the Pinterest pins. down means forward.',
        parameters: { type: 'object', properties: { area: { type: 'string', enum: ['favorites', 'community', 'pins'] }, direction: { type: 'string', enum: ['down', 'up'] } } } },
      { type: 'function', name: 'list_board', description: 'The cards on the board right now.', parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'hang_up', description: 'End the call.', parameters: { type: 'object', properties: {} } },
    ];
    // v14.10: her ears. far_field noise reduction for rooms that are not quiet,
    // and a stronger transcriber. If OpenAI ever rejects the richer shape, the
    // plain session goes out instead, so voice can never die from this.
    const _secret = (session) => fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
      signal: AbortSignal.timeout(20000),
    });
    let r = await _secret({ type: 'realtime', model: REALTIME_MODEL, instructions, tools,
      audio: { input: { noise_reduction: { type: 'far_field' }, transcription: { model: 'gpt-4o-mini-transcribe' } },
               output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } });
    if (!r.ok) r = await _secret({ type: 'realtime', model: REALTIME_MODEL, instructions, tools,
      audio: { input: { transcription: { model: 'whisper-1' } },
               output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' } } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.value) throw new Error((j.error && j.error.message) || ('realtime ' + r.status));
    noteSpend('v1/realtime', req);
    try { await noteUserSpend(user.sub, user.email, 'v1/realtime', req); } catch (_) {}
    return res.json({ ok: true, value: j.value, model: REALTIME_MODEL });
  } catch (e) {
    console.error('[voice-token app] failed,', String(e.message).slice(0, 200));
    return res.status(502).json({ error: 'voice_failed' });
  }
});

// ═══ v14.02: MAYA'S OWN DOOR. /mcp is a Model Context Protocol server (Streamable
// HTTP, JSON replies) so Claude, Codex or any MCP client can read Maya's soul,
// memory, people, feature inbox and lead station, journal a line, and mark a
// feature shipped. It is the MAYA to Claude line Fromsa asked for: she logs, he
// approves, Claude ships. Guarded by MAYA_MCP_TOKEN (Cloud Run env, set by
// Fromsa); with no token the door is closed (503). Token rides as
// Authorization: Bearer <token> or ?token=<token> for clients that cannot send
// headers. No voice-line writes here: leads stay read only. ═══
const MAYA_MCP_TOKEN = String(process.env.MAYA_MCP_TOKEN || '');
const mayaMcp = createMayaMcp({
  version: process.env.K_REVISION || 'local',
  configured: () => ({ openai: !!process.env.OPENAI_API_KEY, bucket: process.env.SUBMISSIONS_BUCKET || 'pro-maya.firebasestorage.app', windsor: !!process.env.WINDSOR_API_KEY }),
  loadFeatures: loadMayaFeatures,
  saveFeatures: async (rec) => gcsPut(MAYA_FEATURES_PATH, Buffer.from(JSON.stringify(rec), 'utf8'), 'application/json'),
  loadMemory: loadMayaMemory,
  loadPeople: loadMayaPeople,
  loadSoul: loadMayaSoul,
  appendSoul: appendMayaSoul,
  loadLeads: async () => { const d = await loadLeadFeed(); return { leads: d.leads || d.items || [] }; },
});
function mcpTokenOk(req) {
  if (!MAYA_MCP_TOKEN) return false;
  const h = String(req.headers.authorization || '');
  const given = h.startsWith('Bearer ') ? h.slice(7).trim() : String((req.query || {}).token || '');
  if (!given || given.length !== MAYA_MCP_TOKEN.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(MAYA_MCP_TOKEN)); } catch (_) { return false; }
}
// v14.05: the door answers at BOTH /mcp and /api/mcp. The smoke test caught
// that the public domain's catch-all rewrite was swallowing /mcp and serving
// the app page; /api/** was always routed to Cloud Run, so /api/mcp works on
// any deploy, and firebase.json now routes /mcp too.
app.get(['/mcp', '/api/mcp'], (req, res) => {
  if (!MAYA_MCP_TOKEN) return res.status(503).json({ error: 'maya_door_closed', hint: 'set MAYA_MCP_TOKEN on Cloud Run' });
  if (!mcpTokenOk(req)) return res.status(401).json({ error: 'unauthorized' });
  // no server-to-client stream; clients POST each message
  return res.status(405).json({ error: 'post_only' });
});
app.post(['/mcp', '/api/mcp'], express.json({ limit: '64kb' }), async (req, res) => {
  if (!MAYA_MCP_TOKEN) return res.status(503).json({ error: 'maya_door_closed', hint: 'set MAYA_MCP_TOKEN on Cloud Run' });
  if (!mcpTokenOk(req)) return res.status(401).json({ error: 'unauthorized' });
  const rl = rateLimit('mcp', 'mcp@maya', 1);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retry)); return res.status(429).json({ error: 'rate_limited' }); }
  try {
    const out = await mayaMcp.handle(req.body);
    if (out === null) return res.status(202).end();
    res.setHeader('Cache-Control', 'no-store');
    return res.json(out);
  } catch (e) {
    console.error('[mcp]', e.message);
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'internal error' } });
  }
});

app.listen(port, () => {
  console.log('[maya-api] listening on', port);
  // v13.28: pick the credit meter's month back up after a restart.
  bootMeter().catch(() => {});
});
