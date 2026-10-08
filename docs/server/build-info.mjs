import {readFileSync} from 'node:fs';

// Written into the container at build time; never inferred from a mutable tag.
export const BUILD_COMMIT = (() => {
  try {
    const {commit} = JSON.parse(readFileSync(new URL('./build-info.json', import.meta.url), 'utf8'));
    return /^[0-9a-f]{40}$/.test(commit) ? commit : 'local';
  } catch { return 'local'; }
})();
