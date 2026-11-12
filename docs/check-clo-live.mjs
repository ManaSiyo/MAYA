// Explicit release verification against the owner's screenshot submission.
// Reuses durable research: a completed/failed/uncertain paid attempt is never retried.
// Tokens stay in memory; only status, counts and public source links enter build logs.
import {readFileSync} from 'node:fs';
import {createDigitalAssets,createCloQueue} from '../backend/server/digital-assets.mjs';
import {createSubmissionDeletion} from '../backend/server/submission-list.mjs';
const id=process.argv[2];
if(!/^[A-Za-z0-9_-]{3,120}$/.test(id||''))throw Error('A saved submission ID is required.');
const env=Object.fromEntries(readFileSync('/workspace/.clo-env','utf8').split(',').map(v=>v.split('=')));
const config={queue:env.CLO_TASK_QUEUE,origin:env.CLO_TASK_ORIGIN,email:env.CLO_TASK_SERVICE_ACCOUNT,audience:env.CLO_TASK_AUDIENCE};
const mr=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'}});
if(!mr.ok)throw Error('Build identity unavailable.');
const {access_token:accessToken}=await mr.json();
const auth={Authorization:'Bearer '+accessToken};
const base='https://storage.googleapis.com/storage/v1/b/pro-maya.firebasestorage.app/o/';
async function read(path){
 const r=await fetch(base+encodeURIComponent(path),{headers:auth});if(!r.ok)return {ok:false,status:r.status};
 const meta=await r.json(),body=await fetch(base+encodeURIComponent(path)+'?alt=media&generation='+meta.generation,{headers:auth});
 return {ok:body.ok,status:body.status,generation:meta.generation,buf:Buffer.from(await body.arrayBuffer())};
}
async function write(path,bytes,type,generation){
 const r=await fetch('https://storage.googleapis.com/upload/storage/v1/b/pro-maya.firebasestorage.app/o?uploadType=media&name='+encodeURIComponent(path)+'&ifGenerationMatch='+generation,{method:'POST',headers:{...auth,'Content-Type':type},body:bytes});
 if(!r.ok)throw Object.assign(Error('Verification storage write failed.'),{status:r.status});return r.json();
}
const deletion=createSubmissionDeletion({read});
const queue=createCloQueue({config,token:async()=>accessToken});
const receiptPath='deployment-checks/clo-rollout-20261112.json';
const receipt=await read(receiptPath);
if(receipt.ok){
 const prior=JSON.parse(receipt.buf.toString('utf8'));
 if(prior.verified&&prior.queue===config.queue&&prior.origin===config.origin){console.log('CLO rollout was already verified; no repeat paid check.');process.exit(0);}
 throw Error('Unexpected CLO verification receipt; review before continuing.');
}
if(receipt.status!==404)throw Error('CLO verification receipt is unavailable.');
const service=createDigitalAssets({read,write:async(...args)=>{await deletion.assertActive(id);const saved=await write(...args);try{await deletion.assertActive(id);}catch(e){await fetch(base+encodeURIComponent(args[0])+'?ifGenerationMatch='+saved.generation,{method:'DELETE',headers:auth});throw e;}return saved;},assertActive:deletion.assertActive,queue});
const start=await service.load(id);
if(start.status==='failed')throw Error('Previous CLO attempt failed; explicit review is needed before a paid retry.');
if(start.stale&&start.items.length)throw Error('Verification inputs changed; review before refreshing an earlier paid attempt.');
if(start.status!=='complete'){
 const scheduled=await service.schedule(id);console.log('CLO verification dispatch:',scheduled.status,scheduled.queued===true?'queued':'already claimed');
}else console.log('CLO verification reuses saved results; no new paid search.');
const deadline=Date.now()+240000;
for(;;){
 const saved=await read('submissions/'+id+'/digital-assets/research/look.json');
 if(!saved.ok)throw Error('CLO research read failed: '+saved.status);
 const state=JSON.parse(saved.buf.toString('utf8'));
 if(state.status==='complete'){
  if((await service.load(id)).stale)throw Error('CLO verification results are stale.');
  if(!state.items.length)throw Error('CLO worker completed but returned no source-backed assets; match quality needs review.');
  console.log('Live CLO sourcing verified:',state.items.length,'source-backed assets.');
  for(const item of state.items)console.log(item.rank,item.url);
  await write(receiptPath,Buffer.from(JSON.stringify({verified:true,verifiedAt:new Date().toISOString(),queue:config.queue,origin:config.origin,count:state.items.length,responseId:state.responseId||'',reused:start.status==='complete'})),'application/json','0');
  break;
 }
 if(state.status==='failed')throw Error('Live CLO provider attempt failed; automatic paid retry was prevented.');
 if(Date.now()>deadline)throw Error('CLO verification timed out while '+state.status+'; check task dispatch logs before any retry.');
 await new Promise(resolve=>setTimeout(resolve,4000));
}
