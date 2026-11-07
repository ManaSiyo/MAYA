// Shared Admin, Brief drawer and Aesthetic Control submission cards.
(function(){
 const unique=folders=>{const seen=new Set();return (Array.isArray(folders)?folders:[]).filter(folder=>{if(!folder?.id||seen.has(folder.id)||folder.duplicateOf)return false;seen.add(folder.id);return true;});};
 const image=folder=>(folder.files||[]).find(file=>/^dream-garment\.(?:png|jpe?g)$/i.test(file.name||''))||(folder.files||[]).find(file=>/^image\//i.test(file.mime||''));
 const name=folder=>{const value=String(folder.name||'Submission').replace(/-\d{2}-\d{2}-\d{4}(?:-[a-f0-9]{6})?$/i,'').replace(/_/g,' ').trim();return value.charAt(0).toUpperCase()+value.slice(1);};
 function create(folder,{newTab=false,src='',onSelect,onDelete}={}){
  const thumb=image(folder),card=document.createElement('div');card.className='sub-tile';card.dataset.mayaPanel='inner';card.dataset.submissionId=folder.id;
  const link=document.createElement('a');link.className='submission-open';
  link.href='/backend.html?'+new URLSearchParams({submission:folder.id,name:folder.name||'',...(thumb?{img:thumb.id}:{})});
  link.setAttribute('aria-label','Open Brief for '+name(folder));if(newTab){link.target='_blank';link.rel='noopener';}
  const photo=document.createElement('img');photo.alt='';photo.loading='lazy';photo.decoding='async';if(src)photo.src=src;else if(thumb)photo.dataset.thumb=thumb.id;else{photo.src='/aesthetics/ui/logo-circle.png';photo.className='submission-placeholder';}
  photo.addEventListener('error',()=>photo.remove());link.append(photo);card.append(link);
  const caption=document.createElement('span');caption.className='submission-caption';caption.dataset.mayaType='P3';caption.textContent=String(folder.description||'Submitted garment design').trim().split(/\s+/).slice(0,4).join(' ');link.append(caption);
  if(!thumb){const badge=document.createElement('span');badge.className='badge status-word';badge.dataset.mayaType='P3';const arriving=Date.now()-new Date(folder.createdTime||0).getTime()<180000;badge.textContent=arriving?'Arriving':'No picture';badge.dataset.status=arriving?'in_progress':'pending';if(!arriving)badge.classList.add('stale');link.append(badge);}
  if(onSelect)link.addEventListener('click',event=>{event.preventDefault();onSelect(folder);});
  if(onDelete){const button=document.createElement('button');button.className='submission-delete maya-icon-button';button.type='button';button.dataset.mayaShape='circle';button.dataset.mayaDismiss='';button.dataset.mayaType='P3';button.setAttribute('aria-label','Delete submission for '+name(folder));button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';button.onclick=()=>onDelete(folder);card.append(button);}
  return card;
 }
 function confirmDelete(action){
  const dialog=document.createElement('dialog');dialog.className='submission-confirm';dialog.dataset.mayaPanel='inner';dialog.setAttribute('aria-labelledby','submission-confirm-title');
  dialog.innerHTML='<div id="submission-confirm-title" data-maya-type="H3">Are you sure you want to delete the submission?</div><div class="submission-confirm-status" role="status" data-maya-type="P1"></div><div class="submission-confirm-actions"><button class="maya-glass-button" data-maya-type="P3" data-cancel>Cancel</button><button class="maya-glass-button" data-maya-type="P3" data-delete>Delete</button></div>';
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('[data-delete]').onclick=async()=>{if(dialog.dataset.busy)return;dialog.dataset.busy='1';dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action();dialog.close();}catch(e){dialog.querySelector('[role=status]').textContent=e.message||'Could not delete this submission.';}finally{delete dialog.dataset.busy;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();return dialog;
 }
 function requestDelete(folder,{token,valid=()=>true,onDeleted=()=>{}}={}){
  return confirmDelete(async()=>{
   if(!valid())throw Error('The account changed. Reopen this submission.');
   const response=await fetch('/api/admin/submissions/'+encodeURIComponent(folder.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
   const result=await response.json();if(!valid())return;
   if(!response.ok||!result.ok)throw Error(result.detail||'Could not delete this submission.');
   await onDeleted(folder);
  });
 }
 window.MayaSubmissionCards={unique,image,name,create,confirmDelete,requestDelete};
})();
