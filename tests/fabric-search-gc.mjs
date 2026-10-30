// Exercise the real fabric deadline fixtures under memory collection, including
// Node 20 used by Cloud Build/Cloud Run. No provider or merchant calls are made.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const suite = new URL('./fabric-search.mjs', import.meta.url).href;
const result = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', `
  const collection = setInterval(() => global.gc(), 5);
  try { await import(${JSON.stringify(suite)}); }
  finally { clearInterval(collection); }
`], { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
assert.equal(result.error, undefined, `Fabric deadline suite must settle under GC: ${result.error?.message}\n${result.stdout}\n${result.stderr}`);
assert.equal(result.status, 0, `Fabric GC subprocess failed:\n${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /Fabric search: \d+ behavioral checks passed\./);
console.log('Fabric GC: all fabric behavior/deadline checks settle under forced collection.');
