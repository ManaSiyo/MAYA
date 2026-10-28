'use strict';
(() => {
 const $=id=>document.getElementById(id);
 let token='',subject='',generation=0,urls=[],controller,pending=null,saving=false,leadSeq=0;
 const form=$('lead-form');
 function setBusy(value){saving=value;form.querySelector('button').disabled=value;}
 function paintLeads(leads){const box=$('leads');box.replaceChildren();for(const item of leads){if(!item?.payload)continue;const row=document.createElement('div');row.className='wr-lead';row.dataset.mayaType='P1';for(const key of ['name','phone','wave','color','look']){const span=document.createElement('span');span.textContent=String(item.payload[key]??'');row.append(span);}box.append(row);}}
 async function loadLeads(seq,auth,signal){const request=++leadSeq;try{const r=await fetch('/api/admin/wr/leads',{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)throw Error('Leads could not be loaded.');const data=await r.json();if(seq===generation&&request===leadSeq)paintLeads(data.leads||[]);}catch(e){if(seq===generation&&e.name!=='AbortError')$('lead-message').textContent=e.message;}}
 function identity(t){try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.sub&&p.exp*1000>Date.now()?p.sub:'';}catch{return '';}}
 function current(){try{return localStorage.getItem('maya_admin_tok')||'';}catch{return '';}}
 function clear(){controller?.abort();controller=new AbortController();generation++;leadSeq++;for(const url of urls)URL.revokeObjectURL(url);urls=[];$('submissions').replaceChildren();$('leads').replaceChildren();form.reset();pending=null;setBusy(false);for(const el of form.querySelectorAll('input'))el.disabled=false;$('lead-message').textContent='';}
 async function load(){
  const seq=generation,auth=token,signal=controller.signal;
  $('submissions-message').textContent='Loading submissions…';
  loadLeads(seq,auth,signal);
  try{
   const r=await fetch('/api/admin/submissions',{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)throw Error(r.status===401||r.status===403?'Please sign in through Admin.':'Submissions could not be loaded.');const data=await r.json();if(seq!==generation)return;
   const folders=Array.isArray(data.folders)?data.folders:[];$('submissions-message').textContent=folders.length?'':'No submissions yet.';
   for(const item of folders){if(!item||!item.id)continue;const files=Array.isArray(item.files)?item.files:[],img=files.find(x=>/dream-garment/i.test(x.name||''))||files.find(x=>/^image\//i.test(x.mime||''));const a=document.createElement('a'),label=document.createElement('p');a.dataset.mayaType='P1';label.textContent=String(item.name||item.id);a.href='/backend.html?'+new URLSearchParams({submission:item.id,name:item.name||item.id,...(img?{img:img.id}:{})});a.append(label);$('submissions').append(a);
    if(img?.id){const el=document.createElement('img');el.alt='';a.prepend(el);fetch('/api/admin/subthumb?'+new URLSearchParams({id:img.id,w:'480'}),{headers:{Authorization:'Bearer '+auth},signal}).then(r=>r.ok?r.blob():null).then(blob=>{if(!blob||seq!==generation)return;const url=URL.createObjectURL(blob);urls.push(url);el.src=url;}).catch(()=>{});}
   }
  }catch(e){if(seq===generation&&e.name!=='AbortError')$('submissions-message').textContent=e.message||'Submissions could not be loaded.';}
 }
 function adopt(){const next=current(),id=identity(next);if(id!==subject){clear();subject=id;token=next;$('workspace').hidden=!id;$('signin').hidden=!!id;if(id)load();}else token=next;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!subject)return;const seq=generation;
  if(!pending){const values=new FormData(form),wave=String(values.get('wave')||'');pending={requestId:crypto.randomUUID(),name:String(values.get('name')||''),phone:String(values.get('phone')||''),wave:wave===''?'':Number(wave),color:String(values.get('color')||''),look:String(values.get('look')||'')};}
  setBusy(true);$('lead-message').textContent='Saving…';
  try{const response=await fetch('/api/admin/wr/leads',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(pending),signal:controller.signal});if(seq!==generation)return;if(!response.ok){const body=await response.json().catch(()=>({}));if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429){pending=null;for(const el of form.querySelectorAll('input'))el.disabled=false;}throw Error(body.error||'Save failed. Try again.');}
   pending=null;for(const el of form.querySelectorAll('input'))el.disabled=false;form.reset();$('lead-message').textContent='Lead saved.';await loadLeads(seq,token,controller.signal);
  }catch(e){if(seq===generation&&e.name!=='AbortError'){if(pending)for(const el of form.querySelectorAll('input'))el.disabled=true;$('lead-message').textContent=pending?'Save could not be confirmed. Press Add lead to retry the same entry.':(e.message||'Save failed.');}}finally{if(seq===generation)setBusy(false);}
 });
 addEventListener('storage',e=>{if(e.key==='maya_admin_tok')adopt();});addEventListener('pageshow',adopt);adopt();
})();
