/* Private source-backed CLO shortlist. Opening and polling only read saved work. */
(function(){
 'use strict';
 const listing=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='connect.clo-set.com'&&!u.username&&!u.password&&!u.port&&/^\/detail\/[a-f0-9]{28,40}$/.test(u.pathname)?u.href:'';}catch{return '';}};
 const photo=value=>{try{if(typeof value!=='string'||value.length>4096)return '';const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&host.includes('.')&&!/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/.test(host)?u.href:'';}catch{return '';}};
 if(!document.getElementById('maya-clo-assets-style')){const css=document.createElement('link');css.id='maya-clo-assets-style';css.rel='stylesheet';css.href='/aesthetics/ui/clo-assets.css?v=1';document.head.append(css);}
 window.MayaCloAssets={create({host,getContext,getToken,fetchImpl=(...args)=>fetch(...args)}){
  let context=null,key='',state=null,serial=0,controller=null,poll=null,active=false,busy=false,loaded=false,filter='all';
  const node=(tag,label,role='P3')=>{const el=document.createElement(tag);el.dataset.mayaType=role;if(label)el.textContent=label;return el;};
  const toolbar=node('div');toolbar.className='clo-toolbar';
  const search=node('button','Find assets');search.type='button';search.className='pill';
  const filters=node('select');filters.dataset.mayaControl='field';filters.dataset.mayaPill='glass';filters.setAttribute('aria-label','Filter CLO assets');for(const [value,label]of [['all','All assets'],['free','Free'],['paid','Paid'],['editable','Editable patterns']]){const option=node('option',label);option.value=value;filters.append(option);}
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
    const card=node('article');card.className='clo-card';card.dataset.mayaPanel='inner';card.tabIndex=0;card.setAttribute('aria-label',item.title||'CLO asset');
    const a=link(item.url,'');a.className='clo-photo';a.setAttribute('aria-label','Open '+(item.title||'CLO asset'));
    const candidates=[...new Set([item.image,...(Array.isArray(item.imageCandidates)?item.imageCandidates:[]),item.thumbnail].map(photo).filter(Boolean))];
    const unavailable=()=>{card.classList.add('has-missing-photo');a.replaceChildren(node('span','Preview unavailable'));a.title='No source preview was returned. Refresh to search for previews, or open the listing.';};
    if(candidates.length){const img=node('img');img.alt=item.title||'CLO asset';img.loading='lazy';img.referrerPolicy='no-referrer';let candidate=0;img.src=candidates[0];img.onerror=()=>{if(++candidate<candidates.length)img.src=candidates[candidate];else unavailable();};a.append(img);}else unavailable();
    // A first touch reveals the same details hover/focus exposes on desktop.
    // A second touch follows the listing; action buttons never trigger navigation.
    a.addEventListener('click',e=>{if(e.detail===0)return;if(window.matchMedia?.('(hover: none)').matches&&!card.classList.contains('is-revealed')){e.preventDefault();for(const other of gallery.querySelectorAll('.is-revealed'))other.classList.remove('is-revealed');card.classList.add('is-revealed');card.focus();}});
    card.addEventListener('keydown',e=>{if(e.key==='Escape'){card.classList.remove('is-revealed');card.blur();}});
    card.append(a);
    const caption=node('div');caption.className='clo-caption';caption.dataset.mayaScrollbar='visible';
    const title=link(item.url,item.title||'CLO asset');title.className='clo-title';title.dataset.mayaType='P1';caption.append(title);
    const price=item.priceType==='free'?'Free':item.price!==null&&item.currency?item.currency+' '+item.price:item.priceType==='paid'?'Paid · price unknown':'Price unknown';
    caption.append(node('p',price+' · '+(item.formats?.join(', ')||'Formats unknown')));
    if(item.match)caption.append(node('p',item.match));
    const details=node('details');details.append(node('summary','Match details'));
    details.append(node('p','Alterations: '+(item.alterations||'Review in CLO.')),node('p','Patterns: '+({editable:'Editable candidate reported',mesh:'Mesh reference',unknown:'Contents unknown'}[item.patternStatus]||'Contents unknown')),node('p','Physical production: '+({allowed:'Allowed according to listing',prohibited:'Not permitted by listing',unknown:'Permission unknown'}[item.physicalProduction]||'Permission unknown')));
    if(item.licenseTier)details.append(node('p','License: '+item.licenseTier));if(item.factsEvidence)details.append(node('p',item.factsEvidence));details.append(node('p','Based on listing search evidence. Inspect the file before pattern work.'));caption.append(details);card.append(caption);
    const actions=node('div');actions.className='clo-card-actions';
    for(const [action,label]of [['select',state?.review?.selected?.url===item.url?'Selected':'Select'],['dismiss','Hide']]){const b=node('button');b.type='button';b.className='pill maya-icon-button';b.dataset.mayaShape='circle';b.setAttribute('aria-label',label+' '+(item.title||'CLO asset'));b.title=label;b.disabled=busy||state.stale||action==='select'&&label==='Selected';if(action==='select')b.setAttribute('aria-pressed',String(label==='Selected'));const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',action==='select'?'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z':'M6 6l12 12M18 6L6 18');icon.append(path);const accessible=node('span',label);accessible.className='clo-action-label';b.append(icon,accessible);b.onclick=()=>mutate(action,item.url);actions.append(b);}card.append(actions);gallery.append(card);
   }
   if(!items.length)gallery.append(node('p',state?.status==='complete'?'No matching assets in this view. Try another filter or refresh.':'Find digital garment references similar to this saved look.','P1'));
  }
  async function request(path,body,signal,token){const r=await fetchImpl('/api/admin/digital-assets/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});const j=await r.json();if(!r.ok)throw Error(j.error||'CLO assets are unavailable.');return j;}
  function schedulePoll(){clearTimeout(poll);if(active&&(state?.status==='running'||state?.automationReady&&state.status==='pending')&&Date.now()-(state.requestedAt||0)<180000)poll=setTimeout(()=>load(),4000);}
  function savedStatus(){return state?.stale?'The garment changed. Refresh to find new matches.':state?.status==='running'?'Searching for CLO assets':state?.status==='pending'?state.automationReady?'Preparing CLO assets':'Choose Find assets to prepare this look.':state?.status==='failed'?'Search stopped. Saved results were kept. Refresh to retry.':state?.status==='complete'?'Up to 10 CONNECT references · '+(state.items||[]).length+' found'+((state.items||[]).some(i=>!photo(i.image)&&!photo(i.thumbnail)&&!(i.imageCandidates||[]).some(photo))?' · Refresh to search for missing previews':''):'CLO references for '+(context?.garmentId?'this garment':'the full look');}
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
