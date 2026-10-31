'use strict';
(() => {
 const $=id=>document.getElementById(id);
 let token='',subject='',generation=0,controller,pending=null,saving=false,leadSeq=0;
 const form=$('lead-form');
 function setBusy(value){saving=value;form.querySelector('button').disabled=value;}
 const columns=[['wave','Wave'],['phone','Number'],['name','Name'],['look','Look'],['color','Color'],['email','Email']];
 function paintLeads(leads){const box=$('leads');box.replaceChildren();const fragment=document.createDocumentFragment();for(const item of leads){if(!item?.payload)continue;const row=document.createElement('tr');row.className='wr-lead';for(const [key] of columns){const cell=document.createElement('td');cell.dataset.col=key==='name'?'name':key==='phone'?'contact':'note';cell.textContent=String(item.payload[key]??'');row.append(cell);}fragment.append(row);}box.append(fragment);$('applicants-empty').textContent='No applicants yet.';$('applicants-empty').hidden=box.children.length>0;}
 for(const [,label] of columns){const th=document.createElement('th');th.scope='col';th.textContent=label;$('applicants-headers').append(th);}
 async function loadLeads(seq,auth,signal){const request=++leadSeq;if(!$('leads').children.length){$('applicants-empty').textContent='Loading applicants…';$('applicants-empty').hidden=false;}try{const r=await fetch('/api/admin/wr/leads',{headers:{Authorization:'Bearer '+auth},cache:'no-store',signal});if(!r.ok)throw Error('Applicants could not be loaded.');const data=await r.json();if(!Array.isArray(data.leads))throw Error('Applicants could not be loaded.');if(seq===generation&&request===leadSeq)paintLeads(data.leads);}catch(e){if(seq===generation&&request===leadSeq&&e.name!=='AbortError'){$('applicants-empty').textContent=e.message;$('applicants-empty').hidden=false;}}}
 function identity(t){try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.sub&&p.exp*1000>Date.now()?p.sub:'';}catch{return '';}}
 function current(){try{return localStorage.getItem('maya_admin_tok')||'';}catch{return '';}}
 function clear(){controller?.abort();controller=new AbortController();generation++;leadSeq++;$('submissions').replaceChildren();$('leads').replaceChildren();$('applicants-empty').hidden=true;form.reset();pending=null;setBusy(false);for(const el of form.querySelectorAll('input'))el.disabled=false;$('lead-message').textContent='';}
 function load(){
  // WR owns its records. Admin's client gallery is never a WR submission feed.
  $('submissions-message').textContent='No submissions yet.';$('submissions').hidden=true;
  return loadLeads(generation,token,controller.signal);
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
