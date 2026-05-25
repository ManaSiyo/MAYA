// Maya — Vercel Node.js Function. Handles SLOW image generation calls only.
//
// Routes (via vercel.json rewrite):
//   /api/openai/v1/images/edits      → here
//   /api/openai/v1/images/generations → here
//
// Why a separate file: image generation takes 30-120 seconds. Vercel Edge
// runtime caps at 25s. Node.js runtime on Pro tier allows up to 300s, but
// only works correctly with Node-style (req, res) handlers — NOT the Web
// API style (return Response) the Edge proxy uses. This file is written
// in Node-style to actually work on Node.js runtime.
//
// Required Vercel env vars: OPENAI_API_KEY, GOOGLE_CLIENT_ID, ALLOWED_EMAILS

import crypto from 'node:crypto';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

const PROXY_VERSION = 'v0.16.0-nodejs-image';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://maya.manasiyo.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    return res.end();
  }

  try {
    // Auth gate
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/);
    if (!m) return sendJson(res, 401, { error: 'unauthorized', detail: 'missing Bearer token' });

    let payload;
    try {
      payload = await verifyGoogleJwt(m[1], process.env.GOOGLE_CLIENT_ID);
    } catch (e) {
      return sendJson(res, 401, { error: 'unauthorized', detail: e.message });
    }
    if (!payload.email_verified) {
      return sendJson(res, 401, { error: 'unauthorized', detail: 'email not verified' });
    }
    const allow = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length && !allow.includes(payload.email)) {
      return sendJson(res, 401, { error: 'unauthorized', detail: 'email not in allowlist' });
    }

    // Read raw request body (multipart for image edits)
    const bodyChunks = [];
    for await (const chunk of req) bodyChunks.push(chunk);
    const body = Buffer.concat(bodyChunks);

    // Build upstream URL from incoming path (/api/openai/v1/images/edits → /v1/images/edits)
    const openaiPath = (req.url || '').replace(/^\/api\/openai/, '');
    const upstream   = 'https://api.openai.com' + openaiPath;

    // Forward headers (drop Vercel/host bookkeeping)
    const headers = {};
    const dropHeaders = new Set([
      'host', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for',
      'x-real-ip', 'x-vercel-id', 'x-vercel-deployment-url',
      'x-vercel-forwarded-for', 'cf-connecting-ip', 'cf-ipcountry',
      'content-length', 'connection',
    ]);
    for (const [key, value] of Object.entries(req.headers)) {
      if (dropHeaders.has(key.toLowerCase())) continue;
      headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    headers['authorization'] = 'Bearer ' + process.env.OPENAI_API_KEY;

    // Call OpenAI (Node 18+ has built-in fetch)
    let upstreamRes;
    try {
      upstreamRes = await fetch(upstream, {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
      });
    } catch (e) {
      return sendJson(res, 502, {
        error: 'upstream_unreachable',
        detail: e.message,
        cause: e.cause ? String(e.cause) : undefined,
      });
    }

    const responseBody = Buffer.from(await upstreamRes.arrayBuffer());

    // If upstream failed, surface the OpenAI error JSON to the browser console.
    if (!upstreamRes.ok) {
      return sendJson(res, upstreamRes.status, {
        error: 'upstream_error',
        upstream_status: upstreamRes.status,
        upstream_status_text: upstreamRes.statusText,
        upstream_body: responseBody.toString('utf8').slice(0, 4000),
      });
    }

    // Forward success response
    res.statusCode = upstreamRes.status;
    upstreamRes.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) return;
      res.setHeader(key, value);
    });
    res.setHeader('X-Proxy-Version', PROXY_VERSION);
    res.setHeader('Access-Control-Allow-Origin', 'https://maya.manasiyo.com');
    res.setHeader('Vary', 'Origin');
    res.end(responseBody);
  } catch (e) {
    sendJson(res, 500, {
      error: 'proxy_crashed',
      message: e?.message || String(e),
      stack: (e?.stack || '').split('\n').slice(0, 10).join('\n'),
    });
  }
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Proxy-Version', PROXY_VERSION);
  res.setHeader('Access-Control-Allow-Origin', 'https://maya.manasiyo.com');
  res.setHeader('Vary', 'Origin');
  res.end(JSON.stringify({ ...obj, proxy_version: PROXY_VERSION }));
}

// ─── Google ID token verification (Node.js native crypto) ─────────────────
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

let _googleKeysCache = { keys: null, exp: 0 };
async function getGoogleKeys() {
  if (_googleKeysCache.keys && Date.now() < _googleKeysCache.exp) return _googleKeysCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('cannot fetch Google keys');
  const data = await res.json();
  _googleKeysCache = { keys: data.keys, exp: Date.now() + 3600 * 1000 };
  return data.keys;
}
