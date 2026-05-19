// Maya — Vercel Edge Function: Google Drive submission endpoint.
//
// Place at: api/submit.js in your repo root.
//
// What it does:
//   1. Validates the Google ID token from the signed-in visitor.
//   2. Signs a JWT as the Maya service account.
//   3. Exchanges that for a Drive access token.
//   4. Creates a subfolder in your shared MAYA Drive folder named
//      "<client-name>-<MM-DD-YYYY>".
//   5. Uploads every file in the payload (dream-garment, one-pager,
//      summary, moodboard, transcript, inspos) into that subfolder.
//
// Required Vercel env vars:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — paste the entire downloaded .json (one line OK)
//   DRIVE_FOLDER_ID              — the long string after /folders/ in the MAYA URL
//   GOOGLE_CLIENT_ID             — same one used by /api/openai
//
// Frontend talks to this endpoint in TWO actions (to stay under Vercel's
// 4.5MB per-request body cap):
//
//   1) Create the per-submission folder:
//      POST /api/submit
//      { "action": "init", "client_name": "Jane Doe" }
//      → { "ok": true, "folder_id": "...", "folder_name": "jane-doe-05-19-2026" }
//
//   2) Upload one file at a time into that folder:
//      POST /api/submit
//      { "action": "upload", "folder_id": "...", "name": "dream-garment.png",
//        "mime_type": "image/png", "data_b64": "..." }
//      → { "ok": true, "file_id": "..." }

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, request);
  }

  // 1) Auth gate — visitor must be signed in with Google.
  try {
    await requireGoogleUser(request);
  } catch (e) {
    return json({ error: 'unauthorized', detail: e.message }, 401, request);
  }

  // 2) Parse payload + dispatch action.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400, request);
  }

  // Service-account access token shared by both actions.
  let accessToken;
  try {
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    accessToken = await getAccessToken(sa.client_email, sa.private_key);
  } catch (e) {
    return json({ error: 'sa_auth_failed', detail: e.message }, 500, request);
  }

  const rootFolderId = process.env.DRIVE_FOLDER_ID;
  if (!rootFolderId) return json({ error: 'no_drive_folder_id' }, 500, request);

  // ── ACTION 1: init — create the per-submission subfolder. ─────────────
  if (body.action === 'init') {
    const clientName = (body.client_name || 'client').toString().trim().slice(0, 60) || 'client';
    const date = new Date();
    const stamp = String(date.getMonth() + 1).padStart(2, '0') + '-' +
                  String(date.getDate()).padStart(2, '0') + '-' +
                  date.getFullYear();
    const subName = `${clientName}-${stamp}`;
    try {
      const subId = await driveCreateFolder(accessToken, subName, rootFolderId);
      return json({ ok: true, folder_id: subId, folder_name: subName }, 200, request);
    } catch (e) {
      return json({ error: 'folder_create_failed', detail: e.message }, 500, request);
    }
  }

  // ── ACTION 2: upload — drop a single file into an existing folder. ────
  if (body.action === 'upload') {
    if (!body.folder_id) return json({ error: 'no_folder_id' }, 400, request);
    if (!body.name || !body.data_b64) return json({ error: 'no_file' }, 400, request);
    const bytes = b64ToBytes(body.data_b64);
    const mime  = body.mime_type || 'application/octet-stream';
    try {
      const info = await driveUploadFile(accessToken, body.name, body.folder_id, mime, bytes);
      return json({ ok: true, file_id: info.id, name: info.name }, 200, request);
    } catch (e) {
      return json({ error: 'upload_failed', detail: e.message }, 500, request);
    }
  }

  return json({ error: 'unknown_action', detail: 'expected action: init|upload' }, 400, request);
}

// ─── Google ID token verification (same as /api/openai) ───────────────────
async function requireGoogleUser(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw new Error('missing Bearer token');
  const payload = await verifyGoogleJwt(m[1], process.env.GOOGLE_CLIENT_ID);
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
  const [h64, p64, s64] = token.split('.');
  if (!h64 || !p64 || !s64) throw new Error('malformed jwt');
  const header  = JSON.parse(b64urlToString(h64));
  const payload = JSON.parse(b64urlToString(p64));
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('bad issuer');
  }
  if (payload.aud !== expectedAudience) throw new Error('bad audience');
  if (Date.now() / 1000 > payload.exp) throw new Error('token expired');
  const keys = await getGoogleKeys();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');
  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    b64urlToBytes(s64),
    new TextEncoder().encode(h64 + '.' + p64)
  );
  if (!ok) throw new Error('bad signature');
  return payload;
}

// ─── Service-account auth → Drive access token ────────────────────────────
async function getAccessToken(saEmail, privateKeyPem) {
  const privateKey = await importPrivateKey(privateKeyPem);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: saEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const enc = obj => bytesToB64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = enc(header) + '.' + enc(claims);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = signingInput + '.' + bytesToB64Url(new Uint8Array(sig));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error('token exchange ' + res.status + ': ' + (await res.text()));
  const data = await res.json();
  return data.access_token;
}

async function importPrivateKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return await crypto.subtle.importKey(
    'pkcs8', bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
}

// ─── Drive API helpers ────────────────────────────────────────────────────
async function driveCreateFolder(accessToken, name, parentId) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
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
  if (!res.ok) throw new Error('folder create ' + res.status + ': ' + (await res.text()));
  return (await res.json()).id;
}

async function driveUploadFile(accessToken, name, parentId, mimeType, dataBytes) {
  const boundary = '----maya' + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: [parentId] }) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + dataBytes.length + tail.length);
  body.set(head, 0);
  body.set(dataBytes, head.length);
  body.set(tail, head.length + dataBytes.length);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error('upload ' + res.status + ': ' + (await res.text()));
  return await res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ['https://maya.manasiyo.com', 'http://localhost:3000'];
  const allowOrigin = allowed.includes(origin) ? origin : 'https://maya.manasiyo.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

function bytesToB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
function b64ToBytes(s) {
  // Accepts either plain base64 or "data:image/png;base64,xxx" data URLs.
  const bare = s.includes(',') ? s.split(',')[1] : s;
  const bin = atob(bare);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
