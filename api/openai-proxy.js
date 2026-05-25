// Maya — Vercel Edge Function. Handles FAST text/vision calls only.
//
// Routes (via vercel.json rewrite):
//   /api/openai/v1/chat/completions      → here (voice → refs, vision dissection)
//   /api/openai/v1/audio/transcriptions  → here (Whisper)
//   /api/openai/...anything-else         → here
//
// Image generation has its own proxy (api/openai-image.js, Node.js runtime,
// 300s timeout) because Edge caps at 25s and image renders take 30-120s.
//
// Required Vercel env vars: OPENAI_API_KEY, GOOGLE_CLIENT_ID, ALLOWED_EMAILS

export const config = {
  runtime: 'edge',
};

const PROXY_VERSION = 'v0.16.0-edge-text';

export default async function handler(request) {
  let phase = 'init';
  try {
    if (!request || typeof request?.headers?.get !== 'function') {
      return json({
        error: 'handler_signature_mismatch',
        detail: 'Function received Node-style (req, res) args; expected Fetch Request.',
        request_type: typeof request,
        proxy_version: PROXY_VERSION,
      }, 500);
    }

    phase = 'parse-url';
    const url = new URL(request.url);

    if (url.pathname.endsWith('/ping')) {
      return json({ ok: true, ts: Date.now(), proxy_version: PROXY_VERSION }, 200, request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders(request), 'X-Proxy-Version': PROXY_VERSION } });
    }

    phase = 'auth';
    let user;
    try {
      user = await requireGoogleUser(request);
    } catch (e) {
      return json({ error: 'unauthorized', detail: e.message, proxy_version: PROXY_VERSION }, 401, request);
    }

    phase = 'rate-limit';
    if (!isRateAllowed(user.email)) {
      return json({ error: 'rate_limited', detail: 'Slow down — try again in a minute.', proxy_version: PROXY_VERSION }, 429, request);
    }

    phase = 'build-upstream';
    const openaiPath = url.pathname.replace(/^\/api\/openai/, '');
    const upstream   = new URL('https://api.openai.com' + openaiPath + url.search);

    const headers = new Headers(request.headers);
    headers.set('Authorization', 'Bearer ' + process.env.OPENAI_API_KEY);
    ['host', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for',
     'x-real-ip', 'x-vercel-id', 'x-vercel-deployment-url',
     'x-vercel-forwarded-for', 'cf-connecting-ip', 'cf-ipcountry'
    ].forEach(h => headers.delete(h));

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
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

    if (!upstreamRes.ok) {
      phase = 'read-upstream-error';
      let upstreamBody = '';
      try { upstreamBody = await upstreamRes.text(); } catch (e) {}
      return json({
        error: 'upstream_error',
        upstream_status: upstreamRes.status,
        upstream_status_text: upstreamRes.statusText,
        upstream_body: upstreamBody.slice(0, 4000),
        proxy_version: PROXY_VERSION,
      }, upstreamRes.status, request);
    }

    phase = 'forward-response';
    const responseHeaders = new Headers(upstreamRes.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => responseHeaders.set(k, v));
    responseHeaders.set('X-Proxy-Version', PROXY_VERSION);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return json({
      error: 'proxy_crashed',
      phase,
      message: e?.message || String(e),
      stack: (e?.stack || '').split('\n').slice(0, 10).join('\n'),
      proxy_version: PROXY_VERSION,
    }, 500, request);
  }
}

async function requireGoogleUser(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw new Error('missing Bearer token');
  const token = m[1];
  const payload = await verifyGoogleJwt(token, process.env.GOOGLE_CLIENT_ID);
  const allow = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allow.length && !allow.includes(payload.email)) throw new Error('email not in allowlist');
  if (!payload.email_verified) throw new Error('email not verified');
  return { email: payload.email, sub: payload.sub };
}

let _googleKeysCache = { keys: null, exp: 0 };
async function getGoogleKeys() {
  if (_googleKeysCache.keys && Date.now() < _googleKeysCache.exp) return _googleKeysCache.keys;
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
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new Error('bad issuer');
  if (payload.aud !== expectedAudience) throw new Error('bad audience');
  if (Date.now() / 1000 > payload.exp) throw new Error('token expired');
  const keys = await getGoogleKeys();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signingInput = new TextEncoder().encode(headerB64 + '.' + payloadB64);
  const signature = b64urlToBytes(sigB64);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signingInput);
  if (!ok) throw new Error('bad signature');
  return payload;
}

const _rate = new Map();
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

function corsHeaders(request) {
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

function b64urlToString(s) { return new TextDecoder().decode(b64urlToBytes(s)); }
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
