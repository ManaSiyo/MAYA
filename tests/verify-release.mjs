// An unchanged display version must never make an old deployment pass verification.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),want='a'.repeat(40);let published='b'.repeat(40);
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://fixture.test').pathname;
 if(path==='/release.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({commit:published,publishedAt:'2026-10-06T00:00:00Z'}));}
 if(path==='/api/healthz'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,configured:{openai:true,submissions:true}}));}
 if(path.startsWith('/api/admin/')){res.statusCode=401;res.setHeader('Content-Type','application/json');return res.end('{"error":"Sign in"}');}
 const aliases={'/index.html':'frontend/index.html','/status.html':'backend/status.html','/outbound.html':'backend/outbound.html'};
 try{const file=aliases[path]||path.slice(1);if(file.startsWith('docs/'))throw Error('private');let body=readFileSync(resolve(root,file),'utf8');body=body.replace('name="maya-build" content="local"','name="maya-build" content="'+published+'"');res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.statusCode=404;res.end('<!DOCTYPE html>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[root+'/tests/verify-live.mjs'],{env:{...process.env,MAYA_SITE:'http://127.0.0.1:'+server.address().port,MAYA_COMMIT:want}});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('error',reject);child.on('close',code=>resolve({code,output}));});
try{
 const old=await run();assert.equal(old.code,1,old.output);assert.match(old.output,/FAIL live published commit/);assert.match(old.output,/FAIL app and Admin carry the exact published build/);
 published=want;const latest=await run();assert.equal(latest.code,0,latest.output);
 console.log('Live verification rejects older commits with the same display version and accepts matching release/page stamps.');
}finally{await new Promise(r=>server.close(r));}
