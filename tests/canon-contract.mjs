import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export const canonPages=['frontend/index.html','playground/index.html','backend/status.html','backend/outbound.html','backend/marketing.html','backend/operations.html','backend/backend.html','backend/privacy.html','backend/terms.html','backend/verify.html','aesthetics/operations/index.html'];
export function assertCanon(){
 const css=readFileSync(new URL('../aesthetics/ui/maya-canon.css',import.meta.url),'utf8');
 for(const path of canonPages){const s=readFileSync(new URL('../'+path,import.meta.url),'utf8');if(path.startsWith('frontend/')||path.startsWith('playground/')){assert.doesNotMatch(s,/maya-canon\.css/);assert.match(s,/Jost:wght@200;300;400/);continue;}assert.equal((s.match(/href="\/aesthetics\/ui\/maya-canon.css\?v=9"/g)||[]).length,1,path);assert.match(s,/data-maya-surface="(?:consumer|dense)"/);assert.doesNotMatch(s,/href="[^\"]*status-v13.19.css/);}
 assert.match(css,/--maya-hairline:\s*\.5px/);assert.match(css,/--maya-radius-pill:\s*100px/);assert.match(css,/blur\(22px\) saturate\(180%\)/);
 assert.match(css,/font-variant-numeric:tabular-nums/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/@supports not/);
 assert.doesNotMatch(css,/conic-gradient/);assert.match(css,/--maya-drawer-glass: linear-gradient/);assert.match(css,/--maya-booked:\s*#4ade80/);
 assert.match(css,/#voice-dock \.voice-row/);
 assert.match(css,/box-shadow:var\(--maya-drawer-shadow\)/);
 assert.match(css,/\.adm-tab\.on,\.tabs button\.active/);
 assert.match(css,/--maya-text-table: 11px/);
 assert.match(css,/#maya-logs-list \.maya-log small/);
 assert.match(css,/clip-path:circle\(50%\)/);
 return true;
}
assertCanon();console.log('V4 canon source contract: 11 pages, typography, glass and accessibility passed');
