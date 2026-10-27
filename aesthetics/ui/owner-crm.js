// Owner setup uses the Admin session; the browser never supplies a trusted phone number.
class OwnerCRM extends HTMLElement{
 connectedCallback(){if(this.ready)return;this.ready=true;this.innerHTML='<details class="owner-settings"><summary>Owner tools</summary><p class="small" role="status">Checking owner tools…</p><button type="button" class="enable-owner">Enable my text commands</button></details>';this.querySelector('.enable-owner').onclick=()=>this.enable();this.onStorage=e=>{if(e.key==='maya_admin_tok'||e.key===null){this.load();}};window.addEventListener('storage',this.onStorage);this.load();}
 disconnectedCallback(){window.removeEventListener('storage',this.onStorage);this.ready=false;}
 async request(path,method='GET',body){const token=localStorage.getItem('maya_admin_tok');if(!token)throw Error('Sign in to use owner tools.');const r=await fetch('/api/admin/owner-crm'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json();if(token!==localStorage.getItem('maya_admin_tok'))throw Error('Account changed. Reload owner tools.');if(!r.ok)throw Error(j.error||'Owner tools unavailable.');return j;}
 async load(){try{const j=await this.request('');this.querySelector('.enable-owner').hidden=!!j.enabled;this.querySelector('p').textContent=(j.enabled?'Text commands enabled':'Text commands off')+' · '+j.numberEnding;}catch(e){this.querySelector('p').textContent=e.message;}}

 async enable(){const b=this.querySelector('.enable-owner');b.disabled=true;try{await this.request('/enable','POST');await this.load();}catch(e){this.querySelector('p').textContent=e.message;}finally{b.disabled=false;}}

}
customElements.define('maya-owner-crm',OwnerCRM);
