import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {canonPages} from './canon-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const design=read('docs/design.md');
assert.match(design,/sole active design specification/);
assert.match(design,/Aesthetic Control/);
assert.match(design,/H1.*H4/);
assert.match(design,/Save/);
for(const page of canonPages)assert.equal((read(page).match(/\/aesthetics\/ui\/typography-controls\.js\?v=9/g)||[]).length,1,page);
assert.match(read('backend/status.html'),/href="\/aesthetics\/aesthetic-control.html"/);
assert.match(read('docs/server/server.js'),/app\.post\('\/api\/admin\/design', requireAuthHeader/);
assert.match(read('docs/server/server.js'),/await requireAdmin\(req\)/);
for(const path of ['docs/design-archive/Aesthetics-V3.pdf','docs/output/pdf/MAYA-Current-Fonts.pdf','docs/output/pdf/MAYA-V4-Canon.pdf','docs/output/pdf/MAYA-Aesthetics-V4-Review.pdf'])assert.equal(existsSync(new URL('../'+path,import.meta.url)),false,path);
for(const name of ['Pill','GlassSurface','IconButton','Drawer','FilterPopover','Metric'])assert.match(read('aesthetics/ui/components/components.js'),new RegExp('export function '+name+'\\('));
assert.match(read('AGENTS.md'),/docs\/design\.md/);
console.log('Design contract passed: one standard, shared runtime, owner save, retired PDFs.');

const hosting=JSON.parse(read('docs/firebase.json')).hosting;assert.ok(hosting.headers.some(h=>h.source==='/aesthetics/ui/typography-controls.js' && h.headers.some(v=>v.key==='Cache-Control'&&v.value==='no-cache')));
