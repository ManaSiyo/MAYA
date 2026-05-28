// Maya — Vercel Node.js Function: Google Drive submission endpoint.
//
// v11.4 — moved from Edge runtime to Node.js runtime.
//
// Why: Vercel Edge functions cap request bodies at ~4 MB. The Send flow
// uploads one file per request as base64 (one-pager.pdf, dream-garment.png,
// inspos). A 1536x1024 PNG is typically 2–5 MB raw, which becomes 2.7–6.7 MB
// once base64-encoded — that exceeded the Edge cap and the upload requests
// failed silently. The Drive folder got created (tiny init body), but no
// files landed inside it.
//
// On Node.js runtime Vercel allows much larger payloads, and Pro tier
// also gives us up to 300 s execution time, plenty of headroom for the
// 5–10 file submit queue.
//
// Place at: api/submit.js in the repo root. The vercel.json doesn't need
// any rewrites for it — Vercel auto-routes /api/submit to api/submit.js.
//
// Required Vercel env vars:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full downloaded .json (one line OK)
//   DRIVE_FOLDER_ID              — the long string after /folders/ in the MAYA URL
//   GOOGLE_CLIENT_ID             — same one used by /api/openai
//
// Frontend talks to this endpoint in TWO actions:
//
//   1) POST /api/submit  { "action": "init", "client_name": "Jane Doe" }
//      → { ok: true, folder_id, folder_name }
//
//   2) POST /api/submit  { "action": "upload", "folder_id": "...",
//                          "name": "...", "mime_type": "...", "data_b64": "..." }
//      → { ok: true, file_id, name }

import crypto from 'node:crypto';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

const ALLOWED_ORIGINS = [
  'https://maya.manasiyo.com',
  'http://localhost:8765', 'http://127.0.0.1:8765',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
];

export default async function handler(req, res) {
  // CORS preflight + headers
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  // Auth gate
  try {
    await requireGoogleUser(req);
  } catch (e) {
    return sendJson(res, 401, { error: 'unauthorized', detail: e.message });
  }

  // Read body. Vercel's Node runtime usually parses JSON for us, but if
  // body-size dropped us into raw-stream territory we fall back to manual.
  let body;
  if (req.body && typeof req.body === 'object') {
    body = req.body;
  } else {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (e) {
      return sendJson(res, 400, { error: 'bad_json', detail: e.message });
    }
  }

  // Service-account access token shared by both actions.
  let accessToken;
  try {
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    accessToken = await getAccessToken(sa.client_email, sa.private_key);
  } catch (e) {
    return sendJson(res, 500, { error: 'sa_auth_failed', detail: e.message });
  }

  const rootFolderId = process.env.DRIVE_FOLDER_ID;
  if (!rootFolderId) return sendJson(res, 500, { error: 'no_drive_folder_id' });

  // ACTION 1: init — create the per-submission subfolder.
  if (body.action === 'init') {
    const clientName = (body.client_name || 'client').toString().trim().slice(0, 60) || 'client';
    const date = new Date();
    const stamp = String(date.getMonth() + 1).padStart(2, '0') + '-' +
                  String(date.getDate()).padStart(2, '0') + '-' +
                  date.getFullYear();
    const subName = `${clientName}-${stamp}`;
    try {
      const subId = await driveCreateFolder(accessToken, subName, rootFolderId);
      return sendJson(res, 200, { ok: true, folder_id: subId, folder_name: subName });
    } catch (e) {
      return sendJson(res, 500, { error: 'folder_create_failed', detail: e.message });
    }
  }

  // ACTION 2: upload — drop a single file into an existing folder.
  if (body.action === 'upload') {
    if (!body.folder_id) return sendJson(res, 400, { error: 'no_folder_id' });
    if (!body.name || !body.data_b64) return sendJson(res, 400, { error: 'no_file' });
    const bytes = b64ToBytes(body.data_b64);
    const mime  = body.mime_type || 'application/octet-stream';
    try {
      const info = await driveUploadFile(accessToken, body.name, body.folder_id, mime, bytes);
      return sendJson(res, 200, { ok: true, file_id: info.id, name: info.name });
    } catch (e) {
      return sendJson(res, 500, { error: 'upload_failed', detail: e.message });
    }
  }

  return sendJson(res, 400, { error: 'unknown_action', detail: 'expected action: init|upload' });
}

// ── CORS ───────────────────────────────────────────────────────────────────
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

// ── Google ID token verification ───────────────────────────────────────────
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

// ── Service-account auth → Drive access token ──────────────────────────────
async function getAccessToken(saEmail, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: saEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const b64u = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = b64u(header) + '.' + b64u(claims);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const sig = signer.sign(privateKeyPem).toString('base64url');
  const jwt = signingInput + '.' + sig;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error('token exchange ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  return data.access_token;
}

// ── Drive API helpers ──────────────────────────────────────────────────────
async function driveCreateFolder(accessToken, name, parentId) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!r.ok) throw new Error('folder create ' + r.status + ': ' + (await r.text()));
  return (await r.json()).id;
}

async function driveUploadFile(accessToken, name, parentId, mimeType, dataBytes) {
  const boundary = '----maya' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [parentId] }) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([head, Buffer.from(dataBytes), tail]);
  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  );
  if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()));
  return await r.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function b64ToBytes(s) {
  // Accepts either plain base64 or "data:image/png;base64,xxx" data URLs.
  const bare = s.includes(',') ? s.split(',')[1] : s;
  return Buffer.from(bare, 'base64');
}
