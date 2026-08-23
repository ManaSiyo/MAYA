import { randomUUID } from 'node:crypto';

const DEFAULT_FALLBACK_CATEGORIES = Object.freeze([
  'timeout',
  'transport',
  'provider_5xx',
  'provider_overloaded',
  'invalid_response',
]);

const freezeRoute = route => Object.freeze({ ...route });
const freezeTask = task => Object.freeze({
  ...task,
  routes: Object.freeze((task.routes || []).map(freezeRoute)),
  fallbackOn: Object.freeze([...(task.fallbackOn || DEFAULT_FALLBACK_CATEGORIES)]),
});

// v13.52 begins with one exercised task and the exact v13.51 route. More
// tasks join this registry only when their current behavior is covered by an
// eval and the browser no longer chooses their provider or model directly.
export const AI_TASKS = Object.freeze({
  'fabric.visual_rank': freezeTask({
    version: '1',
    mode: 'background',
    dataClass: 'private-project-image',
    routes: [{
      provider: 'openai',
      model: 'gpt-4.1',
      endpoint: 'v1/chat/completions',
      timeoutMs: 60_000,
    }],
    fallbackOn: DEFAULT_FALLBACK_CATEGORIES,
  }),
});

export class AiRouteError extends Error {
  constructor(message, { category = 'unknown', provider = '', status = 0, cause } = {}) {
    super(message || 'AI route failed');
    this.name = 'AiRouteError';
    this.category = category;
    this.provider = provider;
    this.status = Number(status) || 0;
    if (cause) this.cause = cause;
  }
}

function cleanLabel(value, fallback, limit = 80) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, limit);
  return cleaned || fallback;
}

function cleanRequestId(value) {
  const candidate = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : randomUUID();
}

function cleanCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
}

function usageSummary(output) {
  const usage = output && output.usage;
  if (!usage || typeof usage !== 'object') return undefined;
  const summary = {
    inputTokens: cleanCount(usage.input_tokens ?? usage.prompt_tokens),
    outputTokens: cleanCount(usage.output_tokens ?? usage.completion_tokens),
    totalTokens: cleanCount(usage.total_tokens),
  };
  return Object.values(summary).some(value => value !== undefined) ? summary : undefined;
}

function normalizeError(error, { provider, timedOut, cancelled }) {
  if (error instanceof AiRouteError) return error;
  if (cancelled) {
    return new AiRouteError('AI route cancelled', { category: 'cancelled', provider, cause: error });
  }
  if (timedOut || error?.name === 'TimeoutError') {
    return new AiRouteError('AI route timed out', { category: 'timeout', provider, cause: error });
  }
  return new AiRouteError('AI provider transport failed', {
    category: 'transport', provider, cause: error,
  });
}

function emitTelemetry(telemetry, fields) {
  try {
    telemetry({
      event: 'ai.route.attempt',
      requestId: cleanRequestId(fields.requestId),
      task: cleanLabel(fields.task, 'unknown-task'),
      taskVersion: cleanLabel(fields.taskVersion, '0', 24),
      provider: cleanLabel(fields.provider, 'unknown-provider'),
      model: cleanLabel(fields.model, 'unknown-model'),
      attempt: cleanCount(fields.attempt) || 1,
      fallback: !!fields.fallback,
      outcome: fields.outcome === 'success' ? 'success' : 'error',
      category: cleanLabel(fields.category, fields.outcome === 'success' ? 'ok' : 'unknown'),
      durationMs: cleanCount(fields.durationMs) || 0,
      usage: fields.usage,
    });
  } catch (_) {
    // Telemetry is diagnostic only. It must never change a user result.
  }
}

export function createConsoleAiTelemetry(write = console.info) {
  return event => write('[ai-route] ' + JSON.stringify(event));
}

export function createTaskRouter({ tasks = AI_TASKS, providers = {}, telemetry = () => {} } = {}) {
  return Object.freeze({
    async run(taskName, input, options = {}) {
      const task = tasks[taskName];
      if (!task || !Array.isArray(task.routes) || !task.routes.length) {
        throw new AiRouteError('Unknown AI task', { category: 'unknown_task' });
      }

      // An incoming trace header is user-controlled. Only UUIDs survive; a
      // name, email or other accidental identifier is replaced before logs.
      const requestId = cleanRequestId(options.requestId);
      const fallbackOn = new Set(task.fallbackOn || DEFAULT_FALLBACK_CATEGORIES);
      let lastError;

      for (let index = 0; index < task.routes.length; index++) {
        const route = task.routes[index];
        const provider = providers[route.provider];
        if (!provider || typeof provider.execute !== 'function') {
          throw new AiRouteError('AI provider is not registered', {
            category: 'provider_config', provider: route.provider,
          });
        }

        const startedAt = Date.now();
        const controller = new AbortController();
        let timedOut = false;
        let cancelled = false;
        const onParentAbort = () => {
          cancelled = true;
          controller.abort();
        };
        if (options.signal) {
          if (options.signal.aborted) onParentAbort();
          else options.signal.addEventListener('abort', onParentAbort, { once: true });
        }
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, Math.max(1, Number(route.timeoutMs) || 30_000));

        try {
          const raw = await provider.execute({
            task: taskName,
            taskVersion: task.version,
            route,
            input,
            requestId,
            signal: controller.signal,
          });
          let output = raw;
          const validate = options.validate || task.validate;
          if (typeof validate === 'function') {
            try { output = await validate(raw, input); }
            catch (error) {
              throw new AiRouteError('AI provider returned an invalid response', {
                category: 'invalid_response', provider: route.provider, cause: error,
              });
            }
          }
          emitTelemetry(telemetry, {
            requestId, task: taskName, taskVersion: task.version,
            provider: route.provider, model: route.model, attempt: index + 1,
            fallback: index > 0, outcome: 'success', category: 'ok',
            durationMs: Date.now() - startedAt, usage: usageSummary(raw),
          });
          return Object.freeze({
            output,
            requestId,
            attempts: index + 1,
            route: Object.freeze({ provider: route.provider, model: route.model }),
          });
        } catch (error) {
          const routedError = normalizeError(error, {
            provider: route.provider, timedOut, cancelled,
          });
          routedError.requestId = requestId;
          lastError = routedError;
          emitTelemetry(telemetry, {
            requestId, task: taskName, taskVersion: task.version,
            provider: route.provider, model: route.model, attempt: index + 1,
            fallback: index > 0, outcome: 'error', category: routedError.category,
            durationMs: Date.now() - startedAt,
          });
          const hasNext = index + 1 < task.routes.length;
          if (!hasNext || !fallbackOn.has(routedError.category)) throw routedError;
        } finally {
          clearTimeout(timeout);
          if (options.signal) options.signal.removeEventListener('abort', onParentAbort);
        }
      }
      throw lastError || new AiRouteError('AI route failed', { category: 'unknown' });
    },
  });
}

// A provider-neutral evaluation loop. It deliberately records only case ids,
// grades, timing and error categories, never the potentially sensitive input
// or output. Future model promotion uses this summary, not marketing claims.
export async function runTaskEvaluation({ cases, execute, grade }) {
  if (!Array.isArray(cases) || typeof execute !== 'function' || typeof grade !== 'function') {
    throw new TypeError('cases, execute and grade are required');
  }
  const results = [];
  for (let index = 0; index < cases.length; index++) {
    const fixture = cases[index] || {};
    const startedAt = Date.now();
    try {
      const output = await execute(fixture.input, fixture);
      const verdict = await grade(output, fixture.expected, fixture);
      const passed = typeof verdict === 'boolean' ? verdict : !!verdict?.passed;
      const score = cleanCount(typeof verdict === 'object' ? verdict.score : undefined);
      results.push({
        id: cleanLabel(fixture.id, 'case-' + (index + 1)),
        passed,
        score,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const routedError = normalizeError(error, { provider: '', timedOut: false, cancelled: false });
      results.push({
        id: cleanLabel(fixture.id, 'case-' + (index + 1)),
        passed: false,
        durationMs: Date.now() - startedAt,
        errorCategory: routedError.category,
      });
    }
  }
  const passed = results.filter(result => result.passed).length;
  const totalDurationMs = results.reduce((sum, result) => sum + result.durationMs, 0);
  return Object.freeze({
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 0,
    averageDurationMs: results.length ? Math.round(totalDurationMs / results.length) : 0,
    results: Object.freeze(results.map(result => Object.freeze(result))),
  });
}
