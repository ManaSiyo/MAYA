// Cost-first defaults. Audio and embeddings keep their modality-specific models.
export const TEXT_MODEL = process.env.MODEL_LUNA || 'gpt-6-luna';
export const IMAGE_MODEL = 'gpt-image-2.5-flare';
export function chatBody(body, model = TEXT_MODEL) {
  const next = {...body, model};
  if (/^gpt-6-/.test(model)) {
    next.reasoning_effort = 'none'; // Chat Completions tool compatibility and low latency.
    delete next.temperature; delete next.top_p;
    if (next.max_tokens !== undefined) { next.max_completion_tokens = next.max_tokens; delete next.max_tokens; }
  }
  return next;
}
