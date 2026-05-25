// Maya — Vercel Edge Function (the OpenAI proxy).
//
// Place at: api/openai-proxy.js  in your repo root.
//
// Frontend calls land at /api/openai/<openai_path>
//   POST /api/openai/v1/images/edits   --> POST https://api.openai.com/v1/images/edits
//
// Required Vercel env vars (Settings -> Environment Variables):
//   OPENAI_API_KEY     sk-...
//   GOOGLE_CLIENT_ID   12345.apps.googleusercontent.com
//   ALLOWED_EMAILS     comma-separated, or empty = any Google user
//
// Notes:
//   - Edge runtime: fast cold starts, runs at the network edge, Web-Crypto only.
//   - No npm dependencies needed; Web Crypto verifies the Google JWT in-place.
//   - Rate limit is in-memory and best-effort; if you grow past one Edge instance
//     you'll want Vercel KV or Upstash Redis instead.

// Switched from Edge (25s timeout) to Node.js serverless with
// maxDuration: 60 (Hobby plan cap). Image generation at high quality
// with multiple anchors can take 30–50s — Edge's 25s ceiling was
// returning 504 before OpenAI had time to finish.
export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

// Bumped on every deploy that touches diagnostics. Echoed in X-Proxy-Version
// header + every JSON body, so you can confirm in the browser console which
// build of the proxy actually served a request.
const PROXY_VERSION = 'v0.13.10-diagnostics';

export default async function handler(request) {
  let phase = 'init';
  try {
    // Detect a handler-signature mismatch up front. On Vercel's Node runtime
    // a misconfigured function can receive (req, res) Node-style args instead
    // of a Fetch Request — calling .headers.get on that would throw a cryptic
    // TypeError. Surface it cleanly instead.
    if (!request || typeof request?.headers?.get !== 'function') {
      return json({
        error: 'handler_signature_mismatch',
        detail: 'Function received Node-style (req, res) args; expected Fetch Request. Runtime config likely wrong.',
        request_type: typeof request,
        proxy_version: PROXY_VERSION,
      }, 500);
    }

    phase = 'parse-url';
    const url = new URL(request.url);

    // Health check — visit /api/openai/ping in a browser to confirm liveness.
    if (url.pathname.endsWith('/ping')) {
      return json({ ok: true, ts: Date.now(), proxy_version: PROXY_VERSION }, 200, request);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders(request), 'X-Proxy-Version': PROXY_VERSION } });
    }

    // --- Auth gate -------------------------------------------------------
    phase = 'auth';
    let user;
    try {
      user = await requireGoogleUser(request);
    } catch (e) {
      return json({ error: 'unauthorized', detail: e.message, proxy_version: PROXY_VERSION }, 401, request);
    }

    // --- Per-user rate limit (best-effort) -------------------------------
    phase = 'rate-limit';
    if (!isRateAllowed(user.email)) {
      return json({ error: 'rate_limited', detail: 'Slow down — try again in a minute.', proxy_version: PROXY_VERSION }, 429, request);
    }

    // --- Build the upstream OpenAI request ------------------------------
    // /api/openai/v1/chat/completions  ->  /v1/chat/completions
    phase = 'build-upstream';
    const openaiPath = url.pathname.replace(/^\/api\/openai/, '');
    const upstream   = new URL('https://api.openai.com' + openaiPath + url.search);

    const headers = new Headers(request.headers);
    headers.set('Authorization', 'Bearer ' + process.env.OPENAI_API_KEY);
    // Strip Vercel / proxy headers so OpenAI sees a clean request.
    ['host', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for',
     'x-real-ip', 'x-vercel-id', 'x-vercel-deployment-url',
     'x-vercel-forwarded-for', 'cf-connecting-ip', 'cf-ipcountry'
    ].forEach(h => headers.delete(h));

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      // Required for streaming bodies (multipart uploads / SSE).
      duplex: 'half',
    };

    phase = 'fetch-upstream';
    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream.toString(), init);
    } catch (e) {
      return json({
        error: 'upstream_unreachable',
        detail: e.message,
        cause: e.cause ? String(e.cause) : undefined,
        proxy_version: PROXY_VERSION,
      }, 502, request);
    }

    // If OpenAI returned a non-2xx, buffer the body and surface it in a JSON
    // envelope so the browser console can see the actual upstream error
    // message (status code, OpenAI error JSON, etc.) instead of an opaque 500.
    if (!upstreamRes.ok) {
      phase = 'read-upstream-error';
      let upstreamBody = '';
      try {
        upstreamBody = await upstreamRes.text();
      } catch (e) {
        upstreamBody = '<failed to read upstream body: ' + e.message + '>';
      }
      return json({
        error: 'upstream_error',
        upstream_status: upstreamRes.status,
        upstream_status_text: upstreamRes.statusText,
        upstream_body: upstreamBody.slice(0, 4000),
        upstream_url: upstream.toString(),
        proxy_version: PROXY_VERSION,
      }, upstreamRes.status, request);
    }

    // --- Forward OpenAI's success response back -------------------------
    phase = 'forward-response';
    const responseHeaders = new Headers(upstreamRes.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => responseHeaders.set(k, v));
    responseHeaders.set('X-Proxy-Version', PROXY_VERSION);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (e) {
    // Anything that escapes the per-phase handling above ends up here. The
    // browser console will get a structured 500 with the phase + stack so we
    // know exactly where the proxy crashed.
    return json({
      error: 'proxy_crashed',
      phase,
      message: e?.message || String(e),
      stack: (e?.stack || '').split('\n').slice(0, 10).join('\n'),
      proxy_version: PROXY_VERSION,
    }, 500, request);
  }
}

// ─── Google ID token verification ─────────────────────────────────────────
async function requireGoogleUser(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw new Error('missing Bearer token');
  const token = m[1];

  const payload = await verifyGoogleJwt(token, process.env.GOOGLE_CLIENT_ID);

  const allow = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allow.length && !allow.includes(payload.email)) {
    throw new Error('email not in allowlist: ' + payload.email);
  }
  if (!payload.email_verified) {
    throw new Error('email not verified');
  }
  return { email: payload.email, sub: payload.sub };
}

let _googleKeysCache = { keys: null, exp: 0 };
async function getGoogleKeys() {
  if (_googleKeysCache.keys && Date.now() < _googleKeysCache.exp) {
    return _googleKeysCache.keys;
  }
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('cannot fetch Google keys');
  const data = await res.json();
  _googleKeysCache = { keys: data.keys, exp: Date.now() + 3600 * 1000 };
  return data.keys;
}

async function verifyGoogleJwt(token, expectedAudience) {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('malformed jwt');

  const header  = JSON.parse(b64urlToString(headerB64));
  const payload = JSON.parse(b64urlToString(payloadB64));

  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('bad issuer: ' + payload.iss);
  }
  if (payload.aud !== expectedAudience) {
    throw new Error('bad audience');
  }
  if (Date.now() / 1000 > payload.exp) {
    throw new Error('token expired');
  }

  const keys = await getGoogleKeys();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  const signingInput = new TextEncoder().encode(headerB64 + '.' + payloadB64);
  const signature = b64urlToBytes(sigB64);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signingInput);
  if (!ok) throw new Error('bad signature');

  return payload;
}

// ─── Rate limit (in-memory per Edge instance) ─────────────────────────────
const _rate = new Map();  // email -> [timestamps in last 60s]
const RATE_PER_MIN = 30;

function isRateAllowed(email) {
  const now = Date.now();
  const cutoff = now - 60_000;
  const hits = (_rate.get(email) || []).filter(t => t > cutoff);
  if (hits.length >= RATE_PER_MIN) return false;
  hits.push(now);
  _rate.set(email, hits);
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function corsHeaders(request) {
  // Allow our own domain + localhost for dev.
  const origin = request.headers.get('Origin') || '';
  const allowed = ['https://maya.manasiyo.com', 'http://localhost:3000'];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://maya.manasiyo.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(obj, status = 200, request) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Proxy-Version': PROXY_VERSION,
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

function b64urlToString(s) {
  return new TextDecoder().decode(b64urlToBytes(s));
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
