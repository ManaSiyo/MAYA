// Check the files shipped in the image, not just the repository's imports.
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function assertContainer(){
  const dir=resolve(root,'docs/server');
  const docker=readFileSync(resolve(dir,'Dockerfile'),'utf8');
  const files=new Set();
  for(const line of docker.split('\n')){
    if(!line.startsWith('COPY '))continue;
    const parts=line.trim().split(/\s+/).slice(1);
    assert.equal(parts.pop(),'./','Review packaging checker when COPY destinations change');
    for(const file of parts){
      assert.ok(existsSync(resolve(dir,file)),`Missing COPY source: ${file}`);
      files.add(file);
    }
  }
  for(const file of files){
    if(!/\.(m?js)$/.test(file))continue;
    const source=readFileSync(resolve(dir,file),'utf8');
    for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)){
      const dependency=resolve(dirname(resolve(dir,file)),match[1]);
      const shipped=[...files].some(name=>resolve(dir,name)===dependency);
      assert.ok(shipped,`${file} imports ${match[1]}, but Dockerfile does not ship it`);
    }
  }
  assert.ok(files.has('maya-character.md'),'Ship the runtime character resource');
  console.log('PASS container includes all local runtime imports');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))assertContainer();
