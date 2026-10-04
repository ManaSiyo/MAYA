import { readFileSync, writeFileSync } from 'node:fs';

const commit = process.argv[2] || '';
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('A full Git commit SHA is required for the site release.');
for (const path of ['frontend/index.html', 'backend/status.html', 'backend/outbound.html']) {
  const source = readFileSync(path, 'utf8');
  const marker = '<meta name="maya-build" content="local">';
  if (!source.includes(marker)) throw new Error(`Missing build marker: ${path}`);
  writeFileSync(path, source.replace(marker, `<meta name="maya-build" content="${commit}">`));
}
writeFileSync('release.json', JSON.stringify({ commit, publishedAt: new Date().toISOString() }) + '\n');
