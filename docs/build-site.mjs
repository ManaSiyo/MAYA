// Build an explicit public tree. Private docs, API code and dependencies never ship.
import {cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function buildSite(commit='local'){
 if(!/^(local|[0-9a-f]{40})$/.test(commit))throw Error('Use a full Git commit SHA.');
 const output=resolve(root,'.hosting');rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
 for(const folder of ['frontend','backend']){
  mkdirSync(output+'/'+folder,{recursive:true});
  for(const entry of readdirSync(root+folder,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.html'))cpSync(root+folder+'/'+entry.name,output+'/'+folder+'/'+entry.name);
 }
 cpSync(root+'docs/aesthetics',output+'/aesthetics',{recursive:true});
 cpSync(root+'frontend/robots.txt',output+'/robots.txt');
 for(const page of ['frontend/index.html','backend/status.html']){
  const path=output+'/'+page,source=readFileSync(path,'utf8');
  if(!source.includes('<meta name="maya-build" content="local">'))throw Error('Missing release marker: '+page);
  writeFileSync(path,source.replace('<meta name="maya-build" content="local">','<meta name="maya-build" content="'+commit+'">'));
 }
 writeFileSync(output+'/release.json',JSON.stringify({commit,publishedAt:new Date().toISOString()})+'\n');
 return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Public site built:',buildSite(process.argv[2]||'local'));
