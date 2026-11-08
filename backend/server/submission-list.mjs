// Presentation-only duplicate grouping. Never delete/merge stored submissions or
// redirect a canonical submission ID; direct links still read their own files.
import {createHash} from 'node:crypto';
export function submissionContentKey(folder){
  const files=Array.isArray(folder?.files)?folder.files:[];
  const content=files.filter(file=>!/^one-pager\.(?:pdf|png|jpe?g)$/i.test(file.name||''));
  if(!content.some(file=>/^dream-garment\.(?:png|jpe?g)$/i.test(file.name||''))||!content.some(file=>file.name==='summary.json'))return '';
  if(content.some(file=>!file.name||!Number.isFinite(file.size)||file.size<=0||!(/^[A-Za-z0-9+/]{22}==$/.test(file.checksum||''))))return '';
  return createHash('sha256').update(JSON.stringify(content.map(file=>[file.name,file.mime,file.size,file.checksum]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
}
export function markExactSubmissionRepeats(folders,markers){
  const seen=new Map();
  return folders.map(folder=>{
    const copy={...folder};delete copy.duplicateOf;
    const marker=markers.get(folder.id),content=submissionContentKey(folder);
    const owner=typeof marker?.openedBy==='string'?marker.openedBy.trim().toLowerCase():'';
    const client=typeof marker?.client==='string'?marker.client.trim():'';
    // Legacy records have no project ID. Match their complete authored payload,
    // owner and client only; explicit project identities must always agree.
    const project=marker?.projectId??marker?.project_id??'';
    if(content&&owner&&client&&typeof project==='string'){
      const key=JSON.stringify([owner,client,project,content]);
      if(seen.has(key))copy.duplicateOf=seen.get(key);else seen.set(key,folder.id);
    }
    return copy;
  });
}

// Tombstones are outside the submission prefix, so a late upload cannot make a
// deleted submission reappear. Only the exact requested copy is removed.
export function createSubmissionDeletion({read,write,list,remove}){
  const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{3,120}$/.test(id);
  const key=id=>'deleted-submissions/'+id+'.json';
  const error=(message,status)=>Object.assign(Error(message),{status});
  async function assertActive(id){
    if(!valid(id))throw error('Invalid submission.',400);
    const tomb=await read(key(id));
    if(tomb.ok)throw error('This submission was deleted.',410);
    if(tomb.status!==404)throw error('Submission status unavailable.',503);
  }
  async function deletedIds(){return new Set((await list('deleted-submissions/')).map(x=>x.name.slice('deleted-submissions/'.length).replace(/\.json$/,'')));}
  async function erase(id,actor){
    if(!valid(id))throw error('Invalid submission.',400);
    const prefix='submissions/'+id+'/';
    const existing=await read(key(id));
    if(!existing.ok){
      if(existing.status!==404)throw error('Submission status unavailable.',503);
      const marker=await read(prefix+'submission.json');
      if(!marker.ok)throw error('Submission unavailable.',marker.status===404?404:503);
      try{await write(key(id),Buffer.from(JSON.stringify({deletedAt:new Date().toISOString(),deletedBy:actor})), 'application/json','0');}
      catch(e){if(e.status!==412)throw e;}
    }
    const objects=await list(prefix);
    if(objects.some(x=>!x.name.startsWith(prefix)))throw error('Invalid submission listing.',503);
    let next=0;const failures=[];
    await Promise.all(Array.from({length:Math.min(4,objects.length)},async()=>{while(next<objects.length){const object=objects[next++];try{await remove(object.name,object.generation);}catch(e){failures.push(e);}}}));
    if(failures.length)throw error('Submission is hidden; some files could not be removed. Try Delete again.',503);
    return {ok:true,id};
  }
  return {assertActive,deletedIds,erase};
}

// Pattern work belongs to the submission's private folder. Reads never generate
// anything. Generation checks and deletion barriers protect concurrent saves.
export function createPatternWork({read,write,remove,assertActive}){
  const fail=(message,status=400)=>Object.assign(Error(message),{status});
  async function scope(user,id,garmentId){
    if(!user?.sub)throw fail('Sign in to Admin.',401);
    if(!/^[A-Za-z0-9_-]{3,120}$/.test(id||'')||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(garmentId||''))throw fail('Choose a saved garment.');
    await assertActive(id);
    const [marker,saved]=await Promise.all([read('submissions/'+id+'/submission.json'),read('submissions/'+id+'/pieces.json')]);
    if(!marker.ok||!saved.ok)throw fail('Saved submission unavailable.',503);
    let piece;
    try{const data=JSON.parse(saved.buf);if(!Array.isArray(data.pieces))throw Error();const matches=data.pieces.filter((p,i)=>p&&(p.id||'saved-piece-'+i)===garmentId&&!p.skip);if(matches.length>1)throw Error();piece=matches[0];}
    catch{throw fail('Saved dissection is unreadable.',503);}
    if(!piece)throw fail('Choose a garment from this saved dissection.',409);
    const fingerprint=createHash('sha256').update(JSON.stringify([piece.name||piece.label,piece.category,piece.fabric,piece.fabric_spec,piece._image])).digest('hex');
    return {path:'submissions/'+id+'/patterns/'+encodeURIComponent(user.sub)+'/'+garmentId+'.json',fingerprint};
  }
  async function load(user,id,garmentId){
    const {path,fingerprint}=await scope(user,id,garmentId),found=await read(path);
    if(!found.ok){if(found.status===404)return {generation:'0',fingerprint,runs:[],settings:{}};throw fail('Saved patterns unavailable.',503);}
    try{const data=JSON.parse(found.buf);if(data.schema!==2||!Array.isArray(data.runs)||!data.settings||Array.isArray(data.settings)||typeof data.settings!=='object'||!found.generation||data.runs.length>100||data.runs.some(r=>!r||typeof r.id!=='string'||!Array.isArray(r.passes)||!r.passes.length||r.passes.some(p=>typeof p?.img!=='string')))throw Error();return {...data,generation:String(found.generation),currentFingerprint:fingerprint,stale:data.fingerprint!==fingerprint};}
    catch{throw fail('Saved patterns could not be read. Existing work was kept.',503);}
  }
  async function save(user,body){
    const {submissionId:id,garmentId,generation,fingerprint,run,settings}=body;
    const current=await load(user,id,garmentId);
    if(fingerprint===(current.currentFingerprint||current.fingerprint)&&run&&JSON.stringify(current.runs.find(r=>r.id===run.id))===JSON.stringify(run)&&JSON.stringify(current.settings)===JSON.stringify(settings))return current;
    if(String(generation)!==current.generation||fingerprint!==(current.currentFingerprint||current.fingerprint))throw fail('Saved garment or patterns changed. Reopen this submission before saving.',409);
    if(!settings||typeof settings!=='object'||Array.isArray(settings)||JSON.stringify(settings).length>60000)throw fail('Pattern settings are too large.');
    const runs=[...current.runs];
    if(run){
      if(!/^[A-Za-z0-9-]{1,100}$/.test(run.id||'')||!Array.isArray(run.passes)||!run.passes.length||run.passes.length>4||run.passes.some(p=>!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.img||'')))throw fail('Choose valid pattern images.');
      const index=runs.findIndex(r=>r.id===run.id);if(index<0)runs.push(run);else runs[index]=run;
    }
    if(runs.length>100)throw fail('This garment already has 100 saved pattern versions. Existing versions were kept.');
    const bytes=Buffer.from(JSON.stringify({schema:2,fingerprint,runs,settings}));
    if(bytes.length>25*1024*1024)throw fail('Pattern history reached its save limit. Existing versions were kept.',413);
    const fresh=await scope(user,id,garmentId),path=fresh.path;
    if(fresh.fingerprint!==fingerprint)throw fail('Saved garment changed. Reopen before saving.',409);
    let saved;
    try{saved=await write(path,bytes,'application/json',generation);}catch(e){throw fail(e.status===412?'Patterns changed in another window. Reopen before saving.':'Pattern did not save. Retry Save.',e.status===412?409:503);}
    try{await assertActive(id);}catch(e){if(e.status===410)await remove(path,saved?.generation);throw e;}
    if(!saved?.generation)throw fail('Pattern save was not confirmed. Reopen to check it.',503);
    return {generation:String(saved.generation),fingerprint,runs,settings};
  }
  return {load,save};
}
