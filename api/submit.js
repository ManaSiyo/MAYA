// Maya — Vercel Node.js Function: Google Drive submission endpoint.
//
// v11.15 — uploads run as the atelier's OWN Google account via an OAuth
// refresh token (not a service account, which has no Drive quota).
//
// Required Vercel env vars:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN,
//   DRIVE_FOLDER_ID, GOOGLE_CLIENT_ID

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
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  try {
    await requireGoogleUser(req);
  } catch (e) {
    return sendJson(res, 401, { error: 'unauthorized', detail: e.message });
  }

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

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    return sendJson(res, 500, { error: 'oauth_auth_failed', detail: e.message });
  }

  const rootFolderId = process.env.DRIVE_FOLDER_ID;
  if (!rootFolderId) return sendJson(res, 500, { error: 'no_drive_folder_id' });

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
  const
