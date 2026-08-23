// Focused v13.51 fabric sourcing tests. No network or credentials required.
import assert from 'node:assert/strict';
import {
  applyVisualRankings,
  buildVisualRankingRequest,
  collectRetailerResults,
} from '../docs/server/fabric-sourcing.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (error) {
    console.error('  FAIL ' + name + '  ' + error.message);
    process.exitCode = 1;
  }
}

const garmentImage = 'data:image/png;base64,iVBORw0KGgo=';
const products = [
  { merchant: 'Shop A', place: 'New York', title: 'Crimson wool twill', price: '22.00', currency: 'USD', etaDays: 5,
    url: 'https://shop.example/a', image: 'https://cdn.example/a.jpg' },
  { merchant: 'Shop B', place: 'London', title: 'Wine wool flannel', price: '31.00', currency: 'GBP', etaDays: 8,
    url: 'https://shop.example/b', image: 'https://cdn.example/b.jpg' },
];

console.log('\nMAYA fabric sourcing test\n');

test('ranking success returns ordered scores and reasons', () => {
  const built = buildVisualRankingRequest({ garmentImage, traits: { fiber: 'wool', weave: 'twill' }, products });
  const response = { choices: [{ message: { content: JSON.stringify({ rankings: [
    { id: 'fabric-2', score: 72, reason: 'Similar wine color and soft raised surface' },
    { id: 'fabric-1', score: 94, reason: 'Closest crimson tone with a visible diagonal twill' },
  ] }) } }] };
  const matches = applyVisualRankings(response, built.candidates);
  assert.deepEqual(matches.map(match => match.matchScore), [94, 72]);
  assert.equal(matches[0].title, 'Crimson wool twill');
  assert.match(matches[0].reason, /crimson/i);
});

test('one retailer failure does not discard successful inventory', () => {
  const collected = collectRetailerResults([
    [products[0]],
    { _miss: 'Unavailable Shop', why: 'http 503' },
    [products[1]],
  ]);
  assert.equal(collected.products.length, 2);
  assert.deepEqual(collected.misses, [{ _miss: 'Unavailable Shop', why: 'http 503' }]);
});

test('products without images are excluded from visual ranking', () => {
  const built = buildVisualRankingRequest({
    garmentImage,
    traits: {},
    products: [{ ...products[0], image: '' }, products[1]],
  });
  assert.equal(built.candidates.length, 1);
  assert.equal(built.candidates[0].title, products[1].title);
});

test('all missing candidate images trigger the fallback condition', () => {
  assert.throws(() => buildVisualRankingRequest({
    garmentImage,
    traits: {},
    products: products.map(product => ({ ...product, image: '' })),
  }), error => error.status === 422 && error.message === 'missing_candidate_images');
});

test('an invalid model response triggers the fallback condition', () => {
  const built = buildVisualRankingRequest({ garmentImage, traits: {}, products });
  assert.throws(() => applyVisualRankings({ choices: [] }, built.candidates),
    error => error.status === 502);
});

console.log('\n' + (process.exitCode ? 'FAILED' : passed + ' passed') + '\n');
