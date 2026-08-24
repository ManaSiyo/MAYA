// ═══════════════════════════════════════════════════════════════════════════
// MAYA proxy policy — v13.70 (Commit A1). PURE and testable: no I/O, no
// globals, no network. Given one proxied /api/openai request it decides
// whether the call may go to OpenAI on the atelier key, and with which model.
//
// It never fails open. On a model-bearing route it requires a recognized
// content type, a present and valid model, a model that matches the endpoint,
// image count/quality within policy REGARDLESS of body size, and Sol (the
// senior tier) only for admins. Multipart policy fields are read from a real
// (small-field-only) part walk, so a field after a large file is still seen,
// and a duplicated model field is treated as ambiguous and refused.
//
// Returns one of:
//   { ok:false, status, error, detail }
//   { ok:true, model, body /*Buffer, possibly rewritten*/, fallback /*Buffer|null*/,
//     streamRequested /*bool*/ }
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

// The five endpoints MAYA proxies. Every one of them carries a model, so a
// missing or invalid model on any of them is a rejection, not a passthrough.
const MODEL_BEARING = new Set([
  'v1/chat/completions',
  'v1/images/generations',
  'v1/images/edits',
  'v1/audio/transcriptions',
  'v1/embeddings',
]);

// Legacy names the browser still sends, upgraded to the current tier. Only on
// chat/completions: the browser never sends a legacy image/audio/embedding
// name, and upgrading elsewhere would be a lie.
function upgradeFor(upstreamPath, model, upgrades) {
  if (upstreamPath !== 'v1/chat/completions') return null;
  return (upgrades && Object.prototype.hasOwnProperty.call(upgrades, model)) ? upgrades[model] : null;
}

// Which concrete models each endpoint may run, AFTER any legacy upgrade.
function endpointModels(cfg) {
  const TERRA = cfg.TERRA, LUNA = cfg.LUNA, SOL = cfg.SOL;
  return {
    'v1/chat/completions': new Set([TERRA, LUNA, SOL, 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol']),
    'v1/images/generations': new Set(['gpt-image-2']),
    'v1/images/edits': new Set(['gpt-image-2']),
    'v1/audio/transcriptions': new Set(['whisper-1']),
    'v1/embeddings': new Set(['text-embedding-3-small']),
  };
}

// The senior tier is admin/Operations only, whatever env name it wears.
function isAdminOnlyModel(model, cfg) {
  return model === (cfg.SOL || 'gpt-5.6-sol') || model === 'gpt-5.6-sol';
}

function contentKind(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (/application\/json|\+json/.test(ct)) return 'json';
  if (/multipart\/form-data/.test(ct)) return 'multipart';
  return 'other';
}

// A minimal multipart FORM-FIELD reader. It walks the parts by boundary and
// returns only small form fields (no filename) whose name is wanted. It never
// decodes a file part's body. A field seen twice with different values is
// reported as ambiguous so the caller can refuse rather than guess.
function readMultipartFields(buf, contentType, wanted) {
  const ct = String(contentType || '');
  const bm = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!bm) return { error: 'no_boundary' };
  const boundary = (bm[1] || bm[2] || '').trim();
  if (!boundary) return { error: 'no_boundary' };
  const delim = Buffer.from('--' + boundary);
  const out = {};
  const ambiguous = new Set();
  let idx = buf.indexOf(delim);
  if (idx < 0) return { error: 'no_parts' };
  idx += delim.length;
  let guard = 0;
  while (idx < buf.length && guard++ < 5000) {
    // end marker "--" right after a boundary => done
    if (buf[idx] === 0x2d && buf[idx + 1] === 0x2d) break;
    // skip the CRLF after the boundary
    if (buf[idx] === 0x0d && buf[idx + 1] === 0x0a) idx += 2;
    const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), idx);
    const next = buf.indexOf(delim, idx);
    if (headerEnd < 0 || next < 0 || headerEnd > next) break;
    const header = buf.subarray(idx, headerEnd).toString('latin1');
    const nameM = header.match(/name="([^"]*)"/i);
    const hasFile = /filename="/i.test(header);
    const name = nameM ? nameM[1] : '';
    if (name && wanted.has(name) && !hasFile) {
      // value runs from after the header separator to the CRLF before `next`
      let valEnd = next;
      if (buf[valEnd - 2] === 0x0d && buf[valEnd - 1] === 0x0a) valEnd -= 2;
      const value = buf.subarray(headerEnd + 4, Math.min(valEnd, headerEnd + 4 + 512)).toString('utf8').trim();
      if (Object.prototype.hasOwnProperty.call(out, name) && out[name] !== value) ambiguous.add(name);
      else out[name] = value;
    }
    idx = next + delim.length;
  }
  return { fields: out, ambiguous: [...ambiguous] };
}

function reject(status, error, detail) { return { ok: false, status, error, detail }; }

// The one entry point.
//   opts = { method, upstreamPath, contentType, body:Buffer|undefined,
//            isAdmin:bool, models:{ TERRA, LUNA, SOL, upgrades:{legacy:target} } }
function evaluateProxyPolicy(opts) {
  const method = String(opts.method || 'POST').toUpperCase();
  const upstreamPath = String(opts.upstreamPath || '');
  const body = opts.body && opts.body.length ? opts.body : undefined;
  const isAdmin = !!opts.isAdmin;
  const cfg = opts.models || {};
  const upgrades = cfg.upgrades || {};

  // Endpoints that do not carry a model are not part of MAYA's set; the caller
  // has already allow-listed the path, so anything not model-bearing passes.
  if (!MODEL_BEARING.has(upstreamPath)) return { ok: true, model: '', body, fallback: null, streamRequested: false };

  // GET/HEAD carry no body and no model; MAYA never uses them here, but do not
  // invent a model requirement for a bodyless method.
  if (method === 'GET' || method === 'HEAD') return { ok: true, model: '', body, fallback: null, streamRequested: false };

  if (!body) return reject(400, 'model_required', 'a model-bearing request needs a body');

  const kind = contentKind(opts.contentType);
  if (kind === 'other') return reject(415, 'unsupported_content_type', 'send application/json or multipart/form-data');

  const allowed = endpointModels(cfg)[upstreamPath] || new Set();

  let asked = '', n = null, quality = null, streamRequested = false, parsed = null;

  if (kind === 'json') {
    try { parsed = JSON.parse(body.toString('utf8')); }
    catch (_) { return reject(400, 'malformed_body', 'body is not valid JSON'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return reject(400, 'malformed_body', 'body must be a JSON object');
    }
    asked = String(parsed.model || '');
    streamRequested = parsed.stream === true;
    if (parsed.n != null) n = Number(parsed.n);
    if (parsed.quality != null) quality = String(parsed.quality);
  } else {
    // multipart: read only the small policy fields, wherever they sit
    const r = readMultipartFields(body, opts.contentType, new Set(['model', 'n', 'quality']));
    if (r.error) return reject(400, 'malformed_multipart', r.error);
    if (r.ambiguous && r.ambiguous.length) return reject(400, 'ambiguous_field', r.ambiguous.join(','));
    asked = String((r.fields && r.fields.model) || '');
    if (r.fields && r.fields.n != null && r.fields.n !== '') n = Number(r.fields.n);
    if (r.fields && r.fields.quality != null) quality = String(r.fields.quality);
  }

  if (!asked) return reject(400, 'model_required', 'no model on a model-bearing route');

  // legacy upgrade (chat only), then the model must be one this endpoint runs
  const upgraded = upgradeFor(upstreamPath, asked, upgrades);
  const target = upgraded || asked;

  if (!allowed.has(target)) {
    // unknown everywhere vs a real model on the wrong endpoint
    const knownAnywhere = [cfg.TERRA, cfg.LUNA, cfg.SOL, 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol',
      'gpt-image-2', 'whisper-1', 'text-embedding-3-small'].includes(target);
    if (knownAnywhere) return reject(403, 'model_endpoint_mismatch', target + ' is not valid on ' + upstreamPath);
    return reject(403, 'model_not_allowed', target);
  }
  if (isAdminOnlyModel(target, cfg) && !isAdmin) {
    return reject(403, 'model_not_allowed', 'the senior tier is atelier only');
  }

  // image count and quality, enforced whatever the body size
  if (upstreamPath === 'v1/images/generations' || upstreamPath === 'v1/images/edits') {
    if (n != null && (!Number.isFinite(n) || n > 2)) return reject(400, 'too_many_images', 'n must be 2 or fewer');
    if (quality === 'high' && !isAdmin) return reject(403, 'quality_not_allowed', 'high quality is atelier only');
  }

  // rewrite only when a legacy name was upgraded (JSON chat). The rewritten
  // body carries the tier model; the fallback carries the original name for the
  // one-shot retry the server does when a new tier is not yet entitled.
  let outBody = body, fallback = null;
  if (kind === 'json' && upgraded) {
    parsed.model = target;
    outBody = Buffer.from(JSON.stringify(parsed), 'utf8');
    parsed.model = asked;
    fallback = Buffer.from(JSON.stringify(parsed), 'utf8');
  }

  return { ok: true, model: target, original: upgraded ? asked : '', body: outBody, fallback, streamRequested };
}

export { evaluateProxyPolicy, readMultipartFields, MODEL_BEARING, endpointModels };
