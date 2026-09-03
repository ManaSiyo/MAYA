// Commit A1 — proxy policy tests. Pure unit tests over the fail-closed request
// policy: no server, no network. Run: node tests/proxy-policy.mjs
import { evaluateProxyPolicy } from '../docs/server/proxy-policy.mjs';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name); }
}

const MODELS = { TERRA: 'gpt-5.6-terra', LUNA: 'gpt-5.6-luna', SOL: 'gpt-5.6-sol',
  upgrades: { 'gpt-4.1': 'gpt-5.6-terra', 'gpt-4o-mini': 'gpt-5.6-luna' } };

const json = (o) => Buffer.from(JSON.stringify(o), 'utf8');
function ev(over) {
  return evaluateProxyPolicy(Object.assign({
    method: 'POST', upstreamPath: 'v1/chat/completions',
    contentType: 'application/json', body: json({ model: 'gpt-4.1', messages: [] }),
    isAdmin: false, models: MODELS,
  }, over));
}
// build a multipart body with the given fields (and one large "image" file first)
function multipart(fields, opts = {}) {
  const b = 'B0undary' + (opts.boundary || 'XYZ');
  const parts = [];
  if (opts.bigFileFirst) {
    parts.push('--' + b + '\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n' +
      'Content-Type: image/png\r\n\r\n' + 'A'.repeat(opts.fileSize || 200000) + '\r\n');
  }
  for (const [k, v] of fields) {
    parts.push('--' + b + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + v + '\r\n');
  }
  parts.push('--' + b + '--\r\n');
  return { body: Buffer.from(parts.join(''), 'latin1'),
    contentType: 'multipart/form-data; boundary=' + b };
}

// ── valid current calls survive ──
{ const r = ev(); ok('valid chat: legacy gpt-4.1 upgrades to Terra', r.ok && r.model === 'gpt-5.6-terra' && r.original === 'gpt-4.1'); }
{ const r = ev(); ok('valid chat: a fallback body is prepared for the legacy name', r.ok && r.fallback && JSON.parse(r.fallback.toString()).model === 'gpt-4.1'); }
{ const r = ev({ body: json({ model: 'gpt-4o-mini', messages: [] }) }); ok('valid chat: gpt-4o-mini upgrades to Luna', r.ok && r.model === 'gpt-5.6-luna'); }
{ const r = ev({ body: json({ model: 'gpt-5.6-terra', messages: [] }) }); ok('valid chat: a tier name passes as itself, no rewrite', r.ok && r.model === 'gpt-5.6-terra' && !r.fallback); }
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', n: 1 }) }); ok('valid image generation: gpt-image-2, n=1', r.ok && r.model === 'gpt-image-2'); }
{ const r = ev({ upstreamPath: 'v1/embeddings', body: json({ model: 'text-embedding-3-small', input: 'x' }) }); ok('valid embeddings', r.ok && r.model === 'text-embedding-3-small'); }
{ const m = multipart([['model', 'whisper-1']]); const r = ev({ upstreamPath: 'v1/audio/transcriptions', contentType: m.contentType, body: m.body }); ok('valid multipart transcription: whisper-1', r.ok && r.model === 'whisper-1'); }

// ── missing / unknown / malformed / mismatch ──
{ const r = ev({ body: json({ messages: [] }) }); ok('missing model is refused', !r.ok && r.error === 'model_required'); }
{ const r = ev({ body: json({ model: 'gpt-4-turbo', messages: [] }) }); ok('unknown model is refused', !r.ok && r.error === 'model_not_allowed'); }
{ const r = ev({ body: Buffer.from('{ not json', 'utf8') }); ok('malformed JSON on a model route is refused', !r.ok && r.error === 'malformed_body'); }
{ const r = ev({ body: json({ model: 'whisper-1', messages: [] }) }); ok('a real model on the wrong endpoint is refused (whisper on chat)', !r.ok && r.error === 'model_endpoint_mismatch'); }
{ const r = ev({ upstreamPath: 'v1/embeddings', body: json({ model: 'gpt-image-2', input: 'x' }) }); ok('gpt-image-2 on embeddings is refused', !r.ok && r.error === 'model_endpoint_mismatch'); }

// ── content-type spoofing ──
{ const r = ev({ contentType: 'text/plain', body: json({ model: 'gpt-4.1' }) }); ok('a non-json/multipart content type is refused', !r.ok && r.error === 'unsupported_content_type'); }
{ const r = ev({ contentType: '', body: json({ model: 'gpt-4.1' }) }); ok('a missing content type is refused', !r.ok && r.error === 'unsupported_content_type'); }

// ── oversized JSON does not bypass model or image inspection ──
{ const big = json({ model: 'gpt-4-turbo', messages: [{ role: 'user', content: 'x'.repeat(3_000_000) }] });
  const r = ev({ body: big }); ok('oversized JSON still gets its (bad) model refused', !r.ok && r.error === 'model_not_allowed'); }
{ const big = json({ model: 'gpt-image-2', prompt: 'x'.repeat(3_000_000), n: 9 });
  const r = ev({ upstreamPath: 'v1/images/generations', body: big }); ok('oversized JSON still gets its image count refused', !r.ok && r.error === 'too_many_images'); }
{ const big = json({ model: 'gpt-image-2', prompt: 'x'.repeat(3_000_000), quality: 'high' });
  const r = ev({ upstreamPath: 'v1/images/generations', body: big }); ok('oversized JSON high-quality is refused for a non-admin', !r.ok && r.error === 'quality_not_allowed'); }

// ── image count / quality ──
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', n: 3 }) }); ok('n>2 is refused', !r.ok && r.error === 'too_many_images'); }
{ const r = ev({ upstreamPath: 'v1/images/generations', body: json({ model: 'gpt-image-2', prompt: 'x', quality: 'high' }) }); ok('non-admin high quality is refused', !r.ok && r.error === 'quality_not_allowed'); }
{ const r = ev({ upstreamPath: 'v1/images/generations', isAdmin: true, body: json({ model: 'gpt-image-2', prompt: 'x', quality: 'high', n: 2 }) }); ok('admin high quality n=2 is allowed', r.ok && r.model === 'gpt-image-2'); }

// ── multipart policy after a large file, and ambiguity ──
{ const m = multipart([['model', 'gpt-image-2'], ['n', '9']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart image count is caught even after a 300KB file', !r.ok && r.error === 'too_many_images'); }
{ const m = multipart([['model', 'gpt-image-2'], ['quality', 'high']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart high quality after a large file is refused for a non-admin', !r.ok && r.error === 'quality_not_allowed'); }
{ const m = multipart([['model', 'gpt-image-2'], ['quality', 'high']], { bigFileFirst: true, fileSize: 300000 });
  const r = ev({ upstreamPath: 'v1/images/edits', isAdmin: true, contentType: m.contentType, body: m.body });
  ok('multipart high quality after a large file is allowed for an admin', r.ok); }
{ const b = 'B0undaryDUP';
  const body = Buffer.from(
    '--' + b + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n' +
    '--' + b + '\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2\r\n' +
    '--' + b + '--\r\n', 'latin1');
  const r = ev({ upstreamPath: 'v1/audio/transcriptions', contentType: 'multipart/form-data; boundary=' + b, body });
  ok('two different model fields are refused as ambiguous', !r.ok && r.error === 'ambiguous_field'); }
{ const m = multipart([['n', '1']], { bigFileFirst: true });
  const r = ev({ upstreamPath: 'v1/images/edits', contentType: m.contentType, body: m.body });
  ok('multipart with no model is refused', !r.ok && r.error === 'model_required'); }

// ── Sol is admin/Operations only ──
{ const r = ev({ body: json({ model: 'gpt-5.6-sol', messages: [] }) }); ok('non-admin Sol is refused', !r.ok && r.error === 'model_not_allowed'); }
{ const r = ev({ isAdmin: true, body: json({ model: 'gpt-5.6-sol', messages: [] }) }); ok('admin Sol is allowed', r.ok && r.model === 'gpt-5.6-sol'); }

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
