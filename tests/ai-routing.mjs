// Provider-neutral task routing, telemetry and eval contracts. No network or
// credentials required; every provider here is a deterministic test double.
import assert from 'node:assert/strict';
import {
  AI_TASKS,
  AiRouteError,
  createTaskRouter,
  runTaskEvaluation,
} from '../docs/server/ai-router.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (error) {
    failed++;
    console.error('  FAIL ' + name + '  ' + error.message);
  }
}

const tasksWith = routes => ({
  test: {
    version: '1',
    routes,
    fallbackOn: ['timeout', 'transport', 'provider_5xx', 'provider_overloaded', 'invalid_response'],
  },
});

console.log('\nMAYA AI routing test\n');

await test('live fabric ranking rides the tier env with the proven fallback', async () => {
  // v13.53: the primary route follows RANK_MODEL / MODEL_TERRA (default
  // gpt-5.6-terra) and the proven previous model stays registered behind it.
  const task = AI_TASKS['fabric.visual_rank'];
  const expected = process.env.RANK_MODEL || process.env.MODEL_TERRA || 'gpt-5.6-terra';
  assert.equal(task.routes.length, 2);
  assert.deepEqual(task.routes[0], {
    provider: 'openai', model: expected, endpoint: 'v1/chat/completions', timeoutMs: 60_000,
  });
  assert.deepEqual(task.routes[1], {
    provider: 'openai', model: 'gpt-4.1', endpoint: 'v1/chat/completions', timeoutMs: 60_000,
  });
});

await test('primary success returns validated output and safe telemetry', async () => {
  const events = [];
  const router = createTaskRouter({
    tasks: tasksWith([{ provider: 'one', model: 'model-a', timeoutMs: 100 }]),
    providers: { one: { execute: async () => ({ value: 7, usage: { prompt_tokens: 2, completion_tokens: 1 } }) } },
    telemetry: event => events.push(event),
  });
  const routed = await router.run('test', { secret: 'never-log-this' }, {
    requestId: 'client@example.com', validate: output => output.value * 2,
  });
  assert.equal(routed.output, 14);
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, 'success');
  assert.deepEqual(events[0].usage, { inputTokens: 2, outputTokens: 1, totalTokens: undefined });
  assert.equal(JSON.stringify(events).includes('never-log-this'), false);
  assert.equal(JSON.stringify(events).includes('client'), false);
  assert.match(events[0].requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

await test('transient provider failure uses the next configured route', async () => {
  const called = [];
  const router = createTaskRouter({
    tasks: tasksWith([
      { provider: 'one', model: 'model-a', timeoutMs: 100 },
      { provider: 'two', model: 'model-b', timeoutMs: 100 },
    ]),
    providers: {
      one: { execute: async () => { called.push('one'); throw new AiRouteError('down', { category: 'provider_5xx' }); } },
      two: { execute: async () => { called.push('two'); return { ok: true }; } },
    },
  });
  const routed = await router.run('test', {});
  assert.deepEqual(called, ['one', 'two']);
  assert.equal(routed.route.provider, 'two');
  assert.equal(routed.attempts, 2);
});

await test('safety refusal never falls through to another provider', async () => {
  let fallbackCalled = false;
  const router = createTaskRouter({
    tasks: tasksWith([
      { provider: 'one', model: 'model-a', timeoutMs: 100 },
      { provider: 'two', model: 'model-b', timeoutMs: 100 },
    ]),
    providers: {
      one: { execute: async () => { throw new AiRouteError('refused', { category: 'safety' }); } },
      two: { execute: async () => { fallbackCalled = true; return {}; } },
    },
  });
  await assert.rejects(router.run('test', {}), error => error.category === 'safety');
  assert.equal(fallbackCalled, false);
});

await test('invalid structured output can use a configured fallback', async () => {
  const router = createTaskRouter({
    tasks: tasksWith([
      { provider: 'one', model: 'model-a', timeoutMs: 100 },
      { provider: 'two', model: 'model-b', timeoutMs: 100 },
    ]),
    providers: {
      one: { execute: async () => ({ malformed: true }) },
      two: { execute: async () => ({ rankings: [1] }) },
    },
  });
  const routed = await router.run('test', {}, {
    validate: output => {
      if (!Array.isArray(output.rankings)) throw new Error('bad schema');
      return output.rankings;
    },
  });
  assert.deepEqual(routed.output, [1]);
  assert.equal(routed.route.provider, 'two');
});

await test('a timed out primary route is aborted before fallback', async () => {
  let aborted = false;
  const router = createTaskRouter({
    tasks: tasksWith([
      { provider: 'one', model: 'model-a', timeoutMs: 10 },
      { provider: 'two', model: 'model-b', timeoutMs: 100 },
    ]),
    providers: {
      one: { execute: ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }, { once: true });
      }) },
      two: { execute: async () => ({ ok: true }) },
    },
  });
  const routed = await router.run('test', {});
  assert.equal(aborted, true);
  assert.equal(routed.route.provider, 'two');
});

await test('eval summaries expose grades and timing, not fixtures', async () => {
  const summary = await runTaskEvaluation({
    cases: [
      { id: 'good-case', input: 'private-input-one', expected: 17 },
      { id: 'bad-case', input: 'private-input-two', expected: 9 },
    ],
    execute: async input => input.length,
    grade: (output, expected) => ({ passed: output === expected, score: output === expected ? 100 : 0 }),
  });
  assert.deepEqual({ total: summary.total, passed: summary.passed, failed: summary.failed },
    { total: 2, passed: 1, failed: 1 });
  assert.equal(JSON.stringify(summary).includes('private-input'), false);
});

console.log('\n' + (failed ? failed + ' FAILED' : passed + ' passed') + '\n');
process.exit(failed ? 1 : 0);
