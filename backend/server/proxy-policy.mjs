import { chatBody, isGPT6, IMAGE_MODEL } from './model-config.mjs';
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
  'v1/decisions',
]);

// Legacy browser names use the current tier, including already-open image clients.
function upgradeFor(upstreamPath, model, upgrades) {
  if (/^v1\/images\/(?:generations|edits)$/.test(upstreamPath))
    return ['gpt-image-2', 'gpt-image-2.5-flare'].includes(model) ? IMAGE_MODEL : null;
  if (upstreamPath !== 'v1/chat/completions') return null;
  return (upgrades && Object.prototype.hasOwnProperty.call(upgrades, model)) ? upgrades[model] : null;
}

// Which concrete models each endpoint may run, AFTER any legacy upgrade.
function endpointModels(cfg) {
  const TERRA = cfg.TERRA, LUNA = cfg.LUNA, SOL = cfg.SOL;
  return {
    'v1/chat/completions': new Set([TERRA, LUNA, SOL, 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol']),
    'v1/images/generations': new Set(['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare']),
    'v1/images/edits': new Set(['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare']),
    'v1/audio/transcriptions': new Set(['whisper-1']),
    'v1/embeddings': new Set(['text-embedding-3-small']),
    'v1/decisions': new Set(['gpt-6-luna']),
  };
}

// The senior tier is admin/Operations only, whatever env name it wears.
function isAdminOnlyModel(model, cfg) {
  return (cfg.SOL !== cfg.LUNA && cfg.SOL !== cfg.TERRA && model === (cfg.SOL || 'gpt-5.6-sol')) || model === 'gpt-5.6-sol';
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
  const ranges = [];
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
      ranges.push({name, start:headerEnd + 4, end:valEnd});
      if (Object.prototype.hasOwnProperty.call(out, name) && out[name] !== value) ambiguous.add(name);
      else out[name] = value;
    }
    idx = next + delim.length;
  }
  return { fields: out, ambiguous: [...ambiguous], ranges };
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

  if (upstreamPath === 'v1/decisions' && (!isAdmin || method !== 'POST'))
    return reject(403, 'decision_not_allowed', 'pattern routing is admin only');

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

  let asked = '', n = null, quality = null, streamRequested = false, parsed = null, multipartRanges = [];

  if (kind === 'json') {
    try { parsed = JSON.parse(body.toString('utf8')); }
    catch (_) { return reject(400, 'malformed_body', 'body is not valid JSON'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return reject(400, 'malformed_body', 'body must be a JSON object');
    }
    if (upstreamPath === 'v1/decisions') {
      const q = parsed.questions;
      if (body.length > 8192 || typeof parsed.input !== 'string' || parsed.input.length > 1000 ||
          !Array.isArray(q) || q.length !== 1 || q[0]?.type !== 'choice' || q[0]?.name !== 'pattern_category' ||
          typeof q[0].instructions !== 'string' || q[0].instructions.length > 400 ||
          !Array.isArray(q[0].choices) || q[0].choices.length < 2 || q[0].choices.length > 12 ||
          q[0].choices.some(c => !c || typeof c.value !== 'string' || typeof c.description !== 'string' || c.value.length > 40 || c.description.length > 300) ||
          Object.keys(parsed).some(k => !['model','input','questions','prompt_cache_options'].includes(k)) ||
          parsed.prompt_cache_options?.mode !== 'explicit')
        return reject(400, 'invalid_decision', 'expected a bounded pattern category request');
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
    multipartRanges = r.ranges;
    asked = String((r.fields && r.fields.model) || '');
    if (r.fields && r.fields.n != null && r.fields.n !== '') n = Number(r.fields.n);
    if (r.fields && r.fields.quality != null) quality = String(r.fields.quality);
  }

  if (!asked) return reject(400, 'model_required', 'no model on a model-bearing route');

  // Resolve approved legacy aliases before endpoint/role enforcement.
  const upgraded = upgradeFor(upstreamPath, asked, upgrades);
  const target = upgraded || asked;

  if (!allowed.has(target)) {
    // unknown everywhere vs a real model on the wrong endpoint
    const knownAnywhere = [cfg.TERRA, cfg.LUNA, cfg.SOL, 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol',
      'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare', 'whisper-1', 'text-embedding-3-small'].includes(target);
    if (knownAnywhere) return reject(403, 'model_endpoint_mismatch', target + ' is not valid on ' + upstreamPath);
    return reject(403, 'model_not_allowed', target);
  }
  if (isAdminOnlyModel(target, cfg) && !isAdmin) {
    return reject(403, 'model_not_allowed', 'the senior tier is atelier only');
  }
  if (kind === 'json' && upstreamPath === 'v1/chat/completions') {
    const hasTools = parsed.tools?.length || parsed.functions?.length || parsed.tool_choice || parsed.function_call ||
      parsed.messages?.some?.(m => m?.role === 'tool' || m?.role === 'function' || m?.tool_calls?.length || m?.function_call);
    if (hasTools && (/^gpt-6\.1-|^gpt-6-astra/.test(target) || (isGPT6(target) && parsed.reasoning_effort && parsed.reasoning_effort !== 'none')))
      return reject(400, 'responses_required', 'this model and reasoning setting require Responses for tool calling');
  }

  // image count and quality, enforced whatever the body size
  if (upstreamPath === 'v1/images/generations' || upstreamPath === 'v1/images/edits') {
    if (n != null && (!Number.isFinite(n) || n > 2)) return reject(400, 'too_many_images', 'n must be 2 or fewer');
    if (['high','xhigh','max'].includes(quality) && !isAdmin) return reject(403, 'quality_not_allowed', 'high quality is atelier only');
  }

  // Images never retry inference. Multipart rewrites touch only model field bytes.
  // Chat retains its existing model-entitlement fallback, before inference only.
  let outBody = body, fallback = null;
  if (kind === 'json' && upgraded) {
    parsed.model = target;
    outBody = Buffer.from(JSON.stringify(parsed), 'utf8');
    if (upstreamPath === 'v1/chat/completions') {
      parsed.model = isGPT6(target) ? 'gpt-4o-mini' : asked;
      if (isGPT6(target)) delete parsed.reasoning_effort;
      fallback = Buffer.from(JSON.stringify(parsed), 'utf8');
    }
  } else if (kind === 'multipart' && upgraded) {
    const parts = []; let offset = 0;
    for (const range of multipartRanges.filter(r => r.name === 'model')) {
      parts.push(body.subarray(offset, range.start), Buffer.from(target)); offset = range.end;
    }
    parts.push(body.subarray(offset)); outBody = Buffer.concat(parts);
  }

  if (kind === 'json' && upstreamPath === 'v1/chat/completions') outBody = Buffer.from(JSON.stringify(chatBody({...JSON.parse(outBody.toString('utf8'))}, target)));
  return { ok: true, model: target, original: upgraded ? asked : '', fallbackModel: fallback ? JSON.parse(fallback.toString('utf8')).model : '', body: outBody, fallback, streamRequested };
}

export { evaluateProxyPolicy, readMultipartFields, MODEL_BEARING, endpointModels };
