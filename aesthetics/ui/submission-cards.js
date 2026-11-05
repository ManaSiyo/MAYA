// One presentation for Admin and the Brief drawer. Canonical IDs and links stay
// intact; only exact repeats confirmed by the authenticated listing are omitted.
(function(){
 const unique=folders=>{const seen=new Set();return (Array.isArray(folders)?folders:[]).filter(folder=>{if(!folder?.id||seen.has(folder.id)||folder.duplicateOf)return false;seen.add(folder.id);return true;});};
 const image=folder=>(folder.files||[]).find(file=>/^dream-garment\.(?:png|jpe?g)$/i.test(file.name||''))||(folder.files||[]).find(file=>/^image\//i.test(file.mime||''));
 const name=folder=>{const value=String(folder.name||'Submission').replace(/-\d{2}-\d{2}-\d{4}(?:-[a-f0-9]{6})?$/i,'').replace(/_/g,' ').trim();return value.charAt(0).toUpperCase()+value.slice(1);};
 function create(folder,{newTab=false,src='',onSelect}={}){
  const thumb=image(folder),card=document.createElement('a');card.className='sub-tile';card.dataset.mayaPanel='inner';card.dataset.submissionId=folder.id;
  card.href='/backend.html?'+new URLSearchParams({submission:folder.id,name:folder.name||'',...(thumb?{img:thumb.id}:{})});
  card.setAttribute('aria-label','Open Brief for '+name(folder));if(newTab){card.target='_blank';card.rel='noopener';}
  const photo=document.createElement('img');photo.alt='';photo.loading='lazy';if(src)photo.src=src;else if(thumb)photo.dataset.thumb=thumb.id;else{photo.src='/aesthetics/ui/logo-circle.png';photo.className='submission-placeholder';}
  photo.addEventListener('error',()=>{photo.remove();});card.append(photo);
  if(!thumb){const badge=document.createElement('span');badge.className='badge status-word';badge.dataset.mayaType='P3';const arriving=Date.now()-new Date(folder.createdTime||0).getTime()<180000;badge.textContent=arriving?'Arriving':'No picture';badge.dataset.status=arriving?'in_progress':'pending';if(!arriving)badge.classList.add('stale');card.append(badge);}
  if(onSelect)card.addEventListener('click',event=>{event.preventDefault();onSelect(folder);});
  return card;
 }
 window.MayaSubmissionCards={unique,image,name,create};
})();
