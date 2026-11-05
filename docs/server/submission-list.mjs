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
