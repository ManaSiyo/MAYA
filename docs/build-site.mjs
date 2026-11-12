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
 for(const page of ['frontend','backend'].flatMap(folder=>readdirSync(output+'/'+folder).filter(file=>file.endsWith('.html')).map(file=>folder+'/'+file))){
  const path=output+'/'+page,source=readFileSync(path,'utf8');
  const marker='<meta name="maya-build" content="'+commit+'">';
  if(!/<head\b[^>]*>/i.test(source))throw Error('Missing HTML head: '+page);
  writeFileSync(path,source.includes('<meta name="maya-build" content="local">')?source.replace('<meta name="maya-build" content="local">',marker):source.replace(/<head\b[^>]*>/i,head=>head+'\n'+marker));
 }
 writeFileSync(output+'/release.json',JSON.stringify({commit,publishedAt:new Date().toISOString()})+'\n');
 return output;
}
export async function verifyDeployment(commit,{fetchImpl=fetch}={}){
 if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Use a full Git commit SHA.');
 const paths=['/release.json','/api/healthz','/','/status.html','/backend.html','/backend2.html','/backend/operation-workspace.html'];
 const results=await Promise.allSettled(paths.map(async path=>{
  const response=await fetchImpl('https://maya.manasiyo.com'+path+'?release_check='+commit,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(path+': HTTP '+response.status);
  const actual=path==='/release.json'||path==='/api/healthz'?(await response.json()).commit:(await response.text()).match(/<meta\s+name="maya-build"\s+content="([^"]+)"/)?.[1];
  if(actual!==commit)throw Error(path+': expected '+commit+', received '+(actual||'no build stamp'));
 }));
 const failures=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);
 if(failures.length)throw Error('Production release is not verified:\n'+failures.join('\n'));
 return {commit,paths};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Public site built:',buildSite(process.argv[2]||'local'));
