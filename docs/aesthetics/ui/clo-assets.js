/* Private source-backed CLO shortlist. Opening and polling only read saved work. */
(function(){
 'use strict';
 const listing=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='connect.clo-set.com'&&!u.username&&!u.password&&!u.port&&/^\/detail\/[a-f0-9]{28,40}$/.test(u.pathname)?u.href:'';}catch{return '';}};
 const photo=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}};
 window.MayaCloAssets={create({host,getContext,getToken,fetchImpl=(...args)=>fetch(...args)}){
  let context=null,key='',state=null,serial=0,controller=null,poll=null,active=false,busy=false,loaded=false,filter='all';
  const node=(tag,label,role='P3')=>{const el=document.createElement(tag);el.dataset.mayaType=role;if(label)el.textContent=label;return el;};
  const toolbar=node('div');toolbar.className='clo-toolbar';
  const search=node('button','Find assets');search.type='button';search.className='pill';
  const filters=node('select');filters.dataset.mayaControl='field';filters.setAttribute('aria-label','Filter CLO assets');for(const [value,label]of [['all','All assets'],['free','Free'],['paid','Paid'],['editable','Editable patterns']]){const option=node('option',label);option.value=value;filters.append(option);}
  filters.onchange=()=>{filter=filters.value;render();};
  const restore=node('button','Restore hidden');restore.type='button';restore.className='pill';restore.hidden=true;
  toolbar.append(search,filters,restore);
  const selected=node('div');selected.className='clo-selection';
  const gallery=node('div');gallery.className='clo-results';gallery.dataset.mayaScrollbar='visible';
  const status=node('p','','P1');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.className='clo-status';
  host.classList.add('maya-clo-assets');host.replaceChildren(toolbar,selected,gallery,status);
  const identity=()=>JSON.stringify([getContext(),getToken()]);
  const current=(ticket,captured)=>ticket===serial&&captured===identity();
  function cancel(){++serial;controller?.abort();controller=null;clearTimeout(poll);poll=null;busy=false;}
  function message(value){status.textContent=value;}
  const link=(url,label)=>{const a=node('a',label);a.href=listing(url);a.target='_blank';a.rel='noopener noreferrer';return a;};
  function render(){
   const running=state?.status==='running'&&Date.now()-(state.startedAt||0)<75000;
   search.disabled=busy||!context?.submissionId||!loaded||running||state?.searchReady===false;
   search.textContent=state&&['complete','failed','running'].includes(state.status)||state?.stale?'Refresh':'Find assets';
   filters.disabled=busy;restore.hidden=!state?.review?.dismissed?.length;restore.disabled=busy||state?.stale;
   selected.replaceChildren();gallery.replaceChildren();
   if(state?.review?.selected){const item=state.review.selected;selected.append(node('span','Selected reference: '),link(item.url,item.title));if(item.fingerprint!==state.fingerprint||state.stale)selected.append(node('span',' · Review for the changed garment'));const clear=node('button','Clear');clear.className='pill';clear.type='button';clear.disabled=busy||state.stale;clear.onclick=()=>mutate('clear');selected.append(clear);}
   const dismissed=new Set(state?.review?.dismissed||[]),items=(state?.items||[]).filter(i=>!dismissed.has(i.url)&&(filter==='all'||filter==='editable'&&i.patternStatus==='editable'||i.priceType===filter));
   for(const item of items){if(!listing(item.url))continue;
    const card=node('article');card.className='clo-card';card.dataset.mayaPanel='inner';
    const a=link(item.url,'');a.className='clo-photo';
    if(photo(item.image)){const img=node('img');img.alt=item.title||'CLO asset';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=item.image;let fallback=false;img.onerror=()=>{if(!fallback&&photo(item.thumbnail)&&item.thumbnail!==item.image){fallback=true;img.src=item.thumbnail;}else{img.remove();a.textContent='Open asset';}};a.append(img);}else a.textContent='Open asset';
    card.append(a,link(item.url,item.title||'CLO asset'));
    const price=item.priceType==='free'?'Free':item.price!==null&&item.currency?item.currency+' '+item.price:item.priceType==='paid'?'Paid · price unknown':'Price unknown';
    card.append(node('p',price+' · '+(item.formats?.join(', ')||'Formats unknown')));
    if(item.match)card.append(node('p',item.match));
    const details=node('details');details.append(node('summary','Match details'));
    details.append(node('p','Alterations: '+(item.alterations||'Review in CLO.')),node('p','Patterns: '+({editable:'Editable candidate reported',mesh:'Mesh reference',unknown:'Contents unknown'}[item.patternStatus]||'Contents unknown')),node('p','Physical production: '+({allowed:'Allowed according to listing',prohibited:'Not permitted by listing',unknown:'Permission unknown'}[item.physicalProduction]||'Permission unknown')));
    if(item.licenseTier)details.append(node('p','License: '+item.licenseTier));if(item.factsEvidence)details.append(node('p',item.factsEvidence));details.append(node('p','Based on listing search evidence. Inspect the file before pattern work.'));card.append(details);
    const actions=node('div');actions.className='clo-card-actions';
    for(const [action,label]of [['select',state?.review?.selected?.url===item.url?'Selected':'Select'],['dismiss','Hide']]){const b=node('button',label);b.type='button';b.className='pill';b.disabled=busy||state.stale||action==='select'&&label==='Selected';b.onclick=()=>mutate(action,item.url);actions.append(b);}card.append(actions);gallery.append(card);
   }
   if(!items.length)gallery.append(node('p',state?.status==='complete'?'No matching assets in this view. Try another filter or refresh.':'Find digital garment references similar to this saved look.','P1'));
  }
  async function request(path,body,signal,token){const r=await fetchImpl('/api/admin/digital-assets/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});const j=await r.json();if(!r.ok)throw Error(j.error||'CLO assets are unavailable.');return j;}
  function schedulePoll(){clearTimeout(poll);if(active&&(state?.status==='running'||state?.automationReady&&state.status==='pending')&&Date.now()-(state.requestedAt||0)<180000)poll=setTimeout(()=>load(),4000);}
  function savedStatus(){return state?.stale?'The garment changed. Refresh to find new matches.':state?.status==='running'?'Searching for CLO assets':state?.status==='pending'?state.automationReady?'Preparing CLO assets':'Choose Find assets to prepare this look.':state?.status==='failed'?'Search stopped. Saved results were kept. Refresh to retry.':state?.status==='complete'?'Up to 10 CONNECT references · '+(state.items||[]).length+' found':'CLO references for '+(context?.garmentId?'this garment':'the full look');}
  async function load(){
   if(!context?.submissionId||!getToken()){loaded=false;render();message('Open a saved submission to find CLO assets.');return;}
   const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();message('Loading saved CLO assets');
   try{const query=new URLSearchParams({submissionId:context.submissionId,garmentId:context.garmentId||''});const result=await request('research?'+query,null,controller.signal,token);if(!current(ticket,captured))return;state=result;loaded=true;message(savedStatus());}
   catch(e){if(current(ticket,captured)){loaded=false;message(e.message);}}
   finally{if(current(ticket,captured)){busy=false;render();if(!loaded){search.disabled=false;search.textContent='Reload';search.onclick=()=>load();}else search.onclick=searchAssets;schedulePoll();}}
  }
  async function searchAssets(){
   if(identity()!==key){update();return;}
   if(search.disabled)return;clearTimeout(poll);const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();message('Searching for CLO assets');
   try{const result=await request('search',{submissionId:context.submissionId,garmentId:context.garmentId||'',refresh:['complete','failed','running'].includes(state?.status)||!!state?.stale,generation:state?.generation},controller.signal,token);if(!current(ticket,captured))return;state=result;loaded=true;message(savedStatus());}
   catch(e){if(current(ticket,captured)){message(e.message);loaded=false;}}
   finally{if(current(ticket,captured)){busy=false;render();if(!loaded){search.disabled=false;search.textContent='Reload';search.onclick=()=>load();}else search.onclick=searchAssets;schedulePoll();}}
  }
  async function mutate(action,url=''){
   if(identity()!==key){update();return;}
   if(busy||!loaded||state?.stale)return;clearTimeout(poll);const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();
   try{const result=await request('review',{submissionId:context.submissionId,garmentId:context.garmentId||'',action,url,generation:state.review.generation,fingerprint:state.fingerprint},controller.signal,token);if(!current(ticket,captured))return;state=result;message(action==='select'?'CLO reference saved.':savedStatus());}
   catch(e){if(current(ticket,captured))message(e.message);}
   finally{if(current(ticket,captured)){busy=false;render();schedulePoll();}}
  }
  search.onclick=searchAssets;restore.onclick=()=>mutate('restore');
  function update(){const next=identity();if(next===key)return false;cancel();key=next;context=getContext();state=null;loaded=false;search.onclick=searchAssets;render();message('Open a saved submission to find CLO assets.');if(active)void load();return true;}
  return {update,setActive(value){active=value;const changed=update();if(active&&!changed&&!loaded&&!busy)void load();if(!active){clearTimeout(poll);poll=null;}else schedulePoll();},reset(){cancel();key='';context=null;state=null;loaded=false;render();message('Open a saved submission to find CLO assets.');}};
 }};
})();
