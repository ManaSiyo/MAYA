'use strict';
(() => {
 const $=id=>document.getElementById(id);
 let token='',subject='',generation=0,urls=[],controller,pending=null,saving=false,leadSeq=0;
 const form=$('lead-form');
 function setBusy(value){saving=value;form.querySelector('button').disabled=value;}
 const columns=[['wave','Wave'],['phone','Number'],['name','Name'],['look','Look'],['color','Color'],['email','Email']];
 function paintLeads(leads){const box=$('leads');box.replaceChildren();const fragment=document.createDocumentFragment();for(const item of leads){if(!item?.payload)continue;const row=document.createElement('tr');row.className='wr-lead';for(const [key] of columns){const cell=document.createElement('td');cell.dataset.col=key==='name'?'name':key==='phone'?'contact':'note';cell.textContent=String(item.payload[key]??'');row.append(cell);}fragment.append(row);}box.append(fragment);$('applicants-empty').hidden=box.children.length>0;}
 for(const [,label] of columns){const th=document.createElement('th');th.scope='col';th.textContent=label;$('applicants-headers').append(th);}
 async function loadLeads(seq,auth,signal){const request=++leadSeq;try{const r=await fetch('/api/admin/wr/leads',{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)throw Error('Applicants could not be loaded.');const data=await r.json();if(seq===generation&&request===leadSeq)paintLeads(data.leads||[]);}catch(e){if(seq===generation&&e.name!=='AbortError')$('lead-message').textContent=e.message;}}
 function identity(t){try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.sub&&p.exp*1000>Date.now()?p.sub:'';}catch{return '';}}
 function current(){try{return localStorage.getItem('maya_admin_tok')||'';}catch{return '';}}
 function clear(){controller?.abort();controller=new AbortController();generation++;leadSeq++;for(const url of urls)URL.revokeObjectURL(url);urls=[];$('submissions').replaceChildren();$('leads').replaceChildren();form.reset();pending=null;setBusy(false);for(const el of form.querySelectorAll('input'))el.disabled=false;$('lead-message').textContent='';}
 async function load(){
  const seq=generation,auth=token,signal=controller.signal;
  $('submissions-message').textContent='Loading submissions…';
  loadLeads(seq,auth,signal);
  try{
   const r=await fetch('/api/admin/submissions',{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)throw Error(r.status===401||r.status===403?'Please sign in through Admin.':'Submissions could not be loaded.');const data=await r.json();if(seq!==generation)return;
   const folders=Array.isArray(data.folders)?data.folders:[],visible=[];
   for(const item of folders){if(!item?.id)continue;const files=Array.isArray(item.files)?item.files:[],img=files.find(x=>/dream-garment/i.test(x.name||''))||files.find(x=>/^image\//i.test(x.mime||'')),age=Date.now()-new Date(item.createdTime||0).getTime();if(!img&&!(age<86400000))continue;visible.push({item,img,age});}
   $('submissions-message').textContent=visible.length?'':'No submissions yet.';$('submissions').hidden=!visible.length;
   const fragment=document.createDocumentFragment(),queue=[];
   for(const {item,img,age} of visible){const a=document.createElement('a');a.setAttribute('aria-label','Open Brief for '+String(item.name||item.id));a.href='/backend.html?'+new URLSearchParams({submission:item.id,name:item.name||item.id,...(img?{img:img.id}:{})});const el=document.createElement('img');el.alt='';a.append(el);if(img?.id)queue.push({el,id:img.id});else{el.src='/aesthetics/ui/logo-circle.png';el.className='placeholder';const badge=document.createElement('span');badge.className=age<180000?'badge':'badge stale';badge.dataset.mayaType='P3';badge.textContent=age<180000?'Arriving':'No picture';a.append(badge);}fragment.append(a);}
   $('submissions').replaceChildren(fragment);
   // Keep early cards responsive on slower links: only four image reads run at once,
   // in the same newest-first order as the strip. Different account = stop immediately.
   async function thumbnails(){while(queue.length&&seq===generation){const {el,id}=queue.shift();try{const r=await fetch('/api/admin/subthumb?'+new URLSearchParams({id,w:'480'}),{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)continue;const blob=await r.blob();if(seq!==generation)return;const url=URL.createObjectURL(blob);urls.push(url);el.src=url;}catch(error){if(error.name==='AbortError')return;}}}
   const workers=Math.min(4,queue.length);for(let i=0;i<workers;i++)thumbnails();
  }catch(e){if(seq===generation&&e.name!=='AbortError')$('submissions-message').textContent=e.message||'Submissions could not be loaded.';}
 }
 function adopt(){const next=current(),id=identity(next);if(id!==subject){clear();subject=id;token=next;$('workspace').hidden=!id;$('signin').hidden=!!id;if(id)load();}else token=next;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!subject)return;const seq=generation;
  if(!pending){const values=new FormData(form),wave=String(values.get('wave')||'');pending={requestId:crypto.randomUUID(),name:String(values.get('name')||''),phone:String(values.get('phone')||''),wave:wave===''?'':Number(wave),color:String(values.get('color')||''),look:String(values.get('look')||''),email:String(values.get('email')||'')};}
  setBusy(true);$('lead-message').textContent='Saving…';
  try{const response=await fetch('/api/admin/wr/leads',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(pending),signal:controller.signal});if(seq!==generation)return;if(!response.ok){const body=await response.json().catch(()=>({}));if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429){pending=null;for(const el of form.querySelectorAll('input'))el.disabled=false;}throw Error(body.error||'Save failed. Try again.');}
   pending=null;for(const el of form.querySelectorAll('input'))el.disabled=false;form.reset();$('lead-message').textContent='Applicant saved.';await loadLeads(seq,token,controller.signal);
  }catch(e){if(seq===generation&&e.name!=='AbortError'){if(pending)for(const el of form.querySelectorAll('input'))el.disabled=true;$('lead-message').textContent=pending?'Save could not be confirmed. Press Add applicant to retry the same entry.':(e.message||'Save failed.');}}finally{if(seq===generation)setBusy(false);}
 });
 addEventListener('storage',e=>{if(e.key==='maya_admin_tok')adopt();});addEventListener('pageshow',adopt);adopt();
})();
