import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../docs/release-stamp.mjs', import.meta.url));
const build = readFileSync(fileURLToPath(new URL('../cloudbuild.yaml', import.meta.url)), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'maya-release-'));
const commit = 'a'.repeat(40);
try {
  mkdirSync(join(dir, 'frontend'));
  mkdirSync(join(dir, 'backend'));
  for (const path of ['frontend/index.html', 'backend/status.html', 'backend/outbound.html'])
    writeFileSync(join(dir, path), '<meta name="maya-build" content="local">');
  execFileSync(process.execPath, [script, commit], { cwd: dir });
  const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'));
  assert.equal(release.commit, commit);
  assert.ok(!Number.isNaN(Date.parse(release.publishedAt)));
  for (const path of ['frontend/index.html', 'backend/status.html', 'backend/outbound.html'])
    assert.equal(readFileSync(join(dir, path), 'utf8'), `<meta name="maya-build" content="${commit}">`);
  assert.throws(() => execFileSync(process.execPath, [script, 'not-a-commit'], { cwd: dir, stdio: 'ignore' }));
  assert.equal(JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8')).commit, commit);
  assert.ok(build.includes('node docs/release-stamp.mjs "$COMMIT_SHA"'));
  console.log('Release stamp: exact commit, valid publish time, invalid commit rejected.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
