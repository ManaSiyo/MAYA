import assert from 'node:assert/strict';
import { createFeedbackStore } from '../docs/server/maya-feedback.mjs';
let data = { items: [], _generation: '0' }, generation = 0;
const store = () => createFeedbackStore({ load: async () => structuredClone(data), save: async rec => {
  await new Promise(resolve => setTimeout(resolve, 1));
  if (rec._generation !== String(generation)) throw Object.assign(new Error('conflict'), { status: 412 });
  data = structuredClone({ ...rec, _generation: String(++generation) });
} });
const a = store(), b = store();
await Promise.all([a.append('The call was slow. Keep this wording.', 'Fromsa', 'phone'), b.append('The name did not save.', 'Fromsa', 'voice')]);
assert.equal(data.items.length, 2);
assert.equal(data.items.find(i => i.source === 'phone').text, 'The call was slow. Keep this wording.');
const id = data.items[0].id;
await Promise.all([a.complete(id, true), b.append('A second request', 'Fromsa', 'phone')]);
assert.equal(data.items.length, 3);
assert.equal(data.items.find(i => i.id === id).done, true);
let writes = 0;
const failing = createFeedbackStore({ load: async () => { throw new Error('offline'); }, save: async () => writes++ });
await assert.rejects(failing.append('Do not lose previous feedback', 'Fromsa'), /offline/);
assert.equal(writes, 0);
const corrupt = createFeedbackStore({ load: async () => ({ items: null }), save: async () => writes++ });
await assert.rejects(corrupt.append('x'), /invalid/);
assert.equal(writes, 0);
// No silent trimming of old, uncompleted requests at the old 500-item cap.
data.items = Array.from({ length: 500 }, (_, i) => ({ id: String(i), done: false }));
await a.append('Keep every pending request', 'Fromsa', 'phone');
assert.equal(data.items.length, 501);
console.log('Feedback: concurrent sources, completion, read failures, corruption, retention passed.');
