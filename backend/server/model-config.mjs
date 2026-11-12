// Current workload tiers. Explicit owner overrides and modality-specific models remain.
export const MODEL_LUNA = process.env.MODEL_LUNA || 'gpt-6-luna';
export const MODEL_TERRA = process.env.MODEL_TERRA || 'gpt-6.1-terra';
export const MODEL_SOL = process.env.MODEL_SOL || 'gpt-6.1-sol';
export const TEXT_MODEL = MODEL_LUNA;
export const IMAGE_MODEL = 'gpt-image-2.6-flare';
export const MODEL_UPGRADES = Object.freeze({
  'gpt-4.1': MODEL_TERRA, 'gpt-4o': MODEL_TERRA, 'gpt-4': MODEL_TERRA, 'gpt-4-turbo': MODEL_TERRA,
  'gpt-4o-mini': MODEL_LUNA, 'gpt-4.1-mini': MODEL_LUNA,
  'gpt-5.6-terra': MODEL_TERRA, 'gpt-5.6-luna': MODEL_LUNA, 'gpt-5.6-sol': MODEL_SOL,
  'gpt-6-terra': MODEL_TERRA, 'gpt-6-sol': MODEL_SOL,
});
export const isGPT6 = model => /^gpt-6(?:\.\d+)?-/.test(model);
export function chatBody(body, model = TEXT_MODEL) {
  const next = {...body, model};
  if (isGPT6(model)) {
    const requiresReasoning = /^gpt-6(?:\.\d+)?-astra(?:-|$)|^gpt-6\.1-sol(?:-|$)/.test(model);
    const effort = next.reasoning_effort || 'none';
    next.reasoning_effort = effort === 'minimal' || (effort === 'none' && requiresReasoning) ? 'low' : effort;
    delete next.temperature; delete next.top_p;
    if (next.reasoning_effort !== 'none') { delete next.logprobs; delete next.top_logprobs; }
    if (next.max_tokens !== undefined) { next.max_completion_tokens = next.max_tokens; delete next.max_tokens; }
  }
  return next;
}
