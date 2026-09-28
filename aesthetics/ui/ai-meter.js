// Shared Admin / Outbound meter. Only refresh while visible; never expose API keys.
class MayaAIMeter extends HTMLElement {
  connectedCallback(){
    if(this.ready)return;this.ready=true;
    this.innerHTML=`<section class="ai-meter" aria-label="AI meter"><h3>AI meter</h3><svg viewBox="0 0 220 126" aria-hidden="true"><path class="ai-track" d="M25 106 A85 85 0 0 1 195 106"/><path class="ai-fill" d="M25 106 A85 85 0 0 1 195 106" pathLength="100"/><path class="ai-needle" d="M110 106 L45 106"/><circle cx="110" cy="106" r="4"/><text x="24" y="123">$0</text><text x="179" y="123">$1</text></svg><p class="ai-meter-value">—</p><p class="ai-meter-label">Today · Outbound AI</p><p class="ai-meter-detail" role="status">Sign in to see daily spending.</p><ul class="ai-meter-providers"></ul><button class="ai-meter-refresh" type="button">Refresh meter</button></section>`;
    this.querySelector('button').onclick=()=>this.refresh(true);
    this.observer=new IntersectionObserver(entries=>{this.visible=entries.some(e=>e.isIntersecting);if(this.visible)this.refresh();});this.observer.observe(this);
    this.timer=setInterval(()=>{if(this.visible&&!document.hidden)this.refresh();},15000);
    this.onStorage=()=>{this.last=0;this.refresh();};window.addEventListener('storage',this.onStorage);
  }
  disconnectedCallback(){this.observer?.disconnect();clearInterval(this.timer);window.removeEventListener('storage',this.onStorage);}
  async refresh(force=false){
    const token=localStorage.getItem('maya_admin_tok')||'';
    if(!token){this.querySelector('.ai-meter-value').textContent='—';this.querySelector('.ai-meter-detail').textContent='Sign in to see daily spending.';this.querySelector('ul').replaceChildren();this.querySelector('.ai-fill').style.strokeDasharray='0 100';this.querySelector('.ai-needle').style.transform='rotate(0deg)';this.last=0;return;}
    if(this.loading||(!force&&this.last&&Date.now()-this.last<14000))return;
    this.loading=true;
    try{
      const r=await fetch('/api/admin/ai-meter',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(token!==localStorage.getItem('maya_admin_tok'))return;
      if(!r.ok)throw Error('Meter is unavailable. Try Refresh.');const j=await r.json();if(j.unavailable)throw Error('Meter needs server setup.');
      const spent=Number(j.spentUsd),reserved=Number(j.reservedUsd)||0,limit=Number(j.limitUsd);
      if(!Number.isFinite(spent)||!(limit>0))throw Error('No trustworthy usage data yet.');
      this.last=Date.now();this.querySelector('.ai-meter-value').textContent='$'+spent.toFixed(3);
      this.querySelector('.ai-meter-detail').textContent=`$${limit.toFixed(2)} daily cap · ${reserved?'$'+reserved.toFixed(3)+' reserved · ':''}Resets midnight, Los Angeles. Token-based estimate.`;
      this.querySelector('.ai-meter-label').textContent='Today · '+j.scope;
      const percent=Math.max(0,Math.min(100,(spent+reserved)/limit*100));this.querySelector('.ai-fill').style.strokeDasharray=percent+' 100';this.querySelector('.ai-needle').style.transform=`rotate(${percent*1.8}deg)`;
      const names={openai:'OpenAI',anthropic:'Claude',gemini:'Gemini'};
      this.querySelector('ul').replaceChildren(...(j.models||[]).map(m=>{const li=document.createElement('li'),name=document.createElement('span'),value=document.createElement('span');name.textContent=names[m.provider]||m.provider;value.textContent=m.connected?'$'+Number(j.providers?.[m.provider]||0).toFixed(3):'Not connected';li.append(name,value);li.title=m.model;return li;}));
    }catch(e){this.querySelector('.ai-meter-detail').textContent=e.message;}
    finally{this.loading=false;}
  }
}
if(!customElements.get('maya-ai-meter'))customElements.define('maya-ai-meter',MayaAIMeter);
