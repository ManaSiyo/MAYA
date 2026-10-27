// Event ingress never trusts a browser-supplied account, recipient or lead body.
import {createHash,verify} from 'node:crypto';
import {problem} from './crm-store.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const guid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const object=s=>typeof s==='string'?JSON.parse(s):s;

export function wixSubmission(token,config,now=Date.now()){
  if(!config.publicKey||!config.instanceId)throw problem('Wix event verification is not configured.',503);
  try{
    if(typeof token!=='string'||token.length>131072)throw Error();
    const parts=token.trim().split('.');if(parts.length!==3)throw Error();
    const header=JSON.parse(Buffer.from(parts[0],'base64url'));
    if(header.alg!=='RS256'||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),config.publicKey,Buffer.from(parts[2],'base64url')))throw Error();
    const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
    if(claims.exp!==undefined&&(!Number.isFinite(claims.exp)||claims.exp*1000<=now))throw Error();
    const envelope=object(claims.data),event=object(envelope.data),entity=event.createdEvent?.entity;
    if(envelope.instanceId!==config.instanceId||envelope.eventType!=='wix.forms.v4.submission_created'||event.entityFqdn!=='wix.forms.v4.submission'||event.slug!=='created'||!guid(event.id)||!guid(event.entityId)||entity?.id!==event.entityId||entity.namespace!=='wix.form_app.form')throw Error();
    // Only the actual callback form can request owner calls. Fetch its saved
    // data again using MAYA's site-scoped Wix API key inside the worker.
    if(entity.formId!==config.formId)return null;
    return {eventId:event.id,submissionId:event.entityId};
  }catch{throw problem('Wix event signature or scope was not verified.',401);}
}

export function createEventQueue(deps){
  const c=deps.config;
  const ready=()=>/^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/queues\/[\w-]+$/.test(c.queue||'')&&/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/.test(c.origin||'')&&!!c.email&&!!c.audience;
  return {ready,async enqueue(event){
    if(!ready())throw problem('Immediate event queue is not configured.',503);
    const task={name:c.queue+'/tasks/'+hash('wix:'+event.eventId),dispatchDeadline:'180s',httpRequest:{httpMethod:'POST',url:c.origin+'/api/tasks/wix-callback',headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify({submissionId:event.submissionId})).toString('base64'),oidcToken:{serviceAccountEmail:c.email,audience:c.audience}}};
    const r=await deps.fetch('https://cloudtasks.googleapis.com/v2/'+c.queue+'/tasks',{method:'POST',headers:{Authorization:'Bearer '+await deps.token(),'Content-Type':'application/json'},body:JSON.stringify({task}),signal:AbortSignal.timeout(1000)});
    if(!r.ok&&r.status!==409)throw problem('Immediate event could not be queued; provider must retry.',503);
    return {duplicate:r.status===409};
  }};
}

export function mountEventTriggers(app,deps){
  const c=deps.config;
  app.post('/api/events/wix',deps.text,async(req,res)=>{
    try{const event=wixSubmission(req.body,c.wix);if(event)await deps.queue.enqueue(event);res.status(200).json({ok:true});}
    catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:'Event queue unavailable; retry.'});}
  });
  app.post('/api/tasks/wix-callback',deps.json,async(req,res)=>{
    try{await deps.verifyWorker(req);if(!guid(req.body?.submissionId))throw problem('Invalid submission ID.');const service=deps.alerts();if(!service)throw problem('Callback worker is starting.',503);
      const result=await service.run({source:'wix-event',submissionId:req.body.submissionId});res.status(result.failed.length?503:200).json({ok:!result.failed.length});}
    catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:'Callback event failed; retry.'});}
  });
}
