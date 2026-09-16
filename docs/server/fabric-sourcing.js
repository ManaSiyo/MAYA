const MAX_VISUAL_CANDIDATES = 12;

function cleanText(value, limit = 160) {
  return String(value || '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function secureImageUrl(value) {
  const raw = cleanText(value, 2048);
  try {
    const url = new URL(raw.startsWith('//') ? 'https:' + raw : raw);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) { return ''; }
}

function secureProductUrl(value) {
  try {
    const url = new URL(cleanText(value, 2048));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch (_) { return ''; }
}

function validGarmentImage(value) {
  const raw = String(value || '');
  return /^https:\/\//i.test(raw) || /^data:image\/(?:png|jpe?g|webp);base64,/i.test(raw);
}

export function collectRetailerResults(results, limit = 60) {
  const products = [];
  const misses = [];
  for (const result of results || []) {
    if (Array.isArray(result)) products.push(...result);
    else if (result && result._miss) misses.push(result);
  }
  return { products: products.slice(0, limit), misses };
}

export function buildVisualRankingRequest({ garmentImage, traits, products }) {
  if (!validGarmentImage(garmentImage)) {
    const error = new Error('missing_garment_image');
    error.status = 400;
    throw error;
  }

  const eligible = (products || []).map(product => ({
    merchant: cleanText(product.merchant, 80),
    place: cleanText(product.place, 80),
    title: cleanText(product.title, 160),
    price: cleanText(product.price, 40),
    currency: cleanText(product.currency, 12),
    etaDays: Math.max(0, Math.min(60, Number(product.etaDays) || 7)),
    url: secureProductUrl(product.url),
    image: secureImageUrl(product.image),
  })).filter(product => product.image && product.url && product.title);

  // Round-robin the shops so a six-result feed from the first merchant does
  // not crowd every other retailer out of the vision comparison.
  const merchantGroups = new Map();
  for (const product of eligible) {
    const key = product.merchant || 'retailer';
    if (!merchantGroups.has(key)) merchantGroups.set(key, []);
    merchantGroups.get(key).push(product);
  }
  const selected = [];
  while (selected.length < MAX_VISUAL_CANDIDATES) {
    let added = false;
    for (const group of merchantGroups.values()) {
      if (group.length && selected.length < MAX_VISUAL_CANDIDATES) {
        selected.push(group.shift());
        added = true;
      }
    }
    if (!added) break;
  }
  const candidates = selected.map((product, index) => ({ ...product, id: 'fabric-' + (index + 1) }));

  if (!candidates.length) {
    const error = new Error('missing_candidate_images');
    error.status = 422;
    throw error;
  }

  const safeTraits = {
    fabric: cleanText(traits && traits.fabric, 180),
    color: cleanText(traits && traits.color, 16),
    fiber: cleanText(traits && traits.fiber, 60),
    weave: cleanText(traits && traits.weave, 60),
    weight_gsm: Math.max(0, Math.min(2000, Number(traits && traits.weight_gsm) || 0)),
    stretch: cleanText(traits && traits.stretch, 24),
    sheen: cleanText(traits && traits.sheen, 24),
    texture: cleanText(traits && traits.texture, 60),
  };

  const content = [
    { type: 'text', text: 'TARGET GARMENT. Inferred fabric traits: ' + JSON.stringify(safeTraits) },
    { type: 'image_url', image_url: { url: String(garmentImage), detail: 'high' } },
  ];
  for (const candidate of candidates) {
    content.push({ type: 'text', text: 'CANDIDATE ' + candidate.id + ': ' + candidate.title + ' from ' + candidate.merchant });
    content.push({ type: 'image_url', image_url: { url: candidate.image, detail: 'low' } });
  }

  return {
    candidates,
    requestBody: {
      // v13.53: the ranking model rides the tier map. RANK_MODEL overrides
      // it alone; otherwise it follows MODEL_TERRA like every other everyday
      // vision task. An env change is the whole rollback.
      model: process.env.RANK_MODEL || process.env.MODEL_TERRA || 'gpt-5.6-terra',
      messages: [
        { role: 'system', content:
          'You are a fabric sourcing vision specialist. Compare the target garment fabric with every retailer thumbnail. Rank by visible color, texture, weave, sheen, print, and apparent weight or drape. Use the inferred traits only as supporting evidence. These are closest visual matches, never exact matches. Return strict JSON: {"rankings":[{"id":"fabric-1","score":87,"reason":"Similar muted color and softly brushed twill surface"}]}. Score 0 to 100. Include every candidate once. Reasons must be specific and no more than 14 words.' },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    },
  };
}

export function applyVisualRankings(openAiBody, candidates) {
  const content = openAiBody && openAiBody.choices && openAiBody.choices[0] &&
    openAiBody.choices[0].message && openAiBody.choices[0].message.content;
  let parsed;
  try { parsed = JSON.parse(String(content || '')); }
  catch (_) {
    const error = new Error('invalid_ranking_response');
    error.status = 502;
    throw error;
  }
  const byId = new Map((candidates || []).map(candidate => [candidate.id, candidate]));
  const seen = new Set();
  const matches = [];
  for (const ranking of (parsed && parsed.rankings) || []) {
    const id = cleanText(ranking && ranking.id, 40);
    const candidate = byId.get(id);
    if (!candidate || seen.has(id)) continue;
    const score = Math.round(Number(ranking.score));
    const reason = cleanText(ranking.reason, 120);
    if (!Number.isFinite(score) || !reason) continue;
    seen.add(id);
    const { id: _id, ...product } = candidate;
    matches.push({ ...product, matchScore: Math.max(0, Math.min(100, score)), reason });
  }
  if (!matches.length) {
    const error = new Error('empty_ranking_response');
    error.status = 502;
    throw error;
  }
  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches;
}
