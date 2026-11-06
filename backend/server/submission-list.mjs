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
