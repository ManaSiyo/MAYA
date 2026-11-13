/* Private source-backed CLO shortlist. Opening and polling only read saved work. */
(function(){
 'use strict';
 const listing=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='connect.clo-set.com'&&!u.username&&!u.password&&!u.port&&/^\/detail\/[a-f0-9]{28,40}$/.test(u.pathname)?u.href:'';}catch{return '';}};
 const photo=value=>{try{if(typeof value!=='string'||value.length>4096)return '';const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&host.includes('.')&&!/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/.test(host)?u.href:'';}catch{return '';}};
 if(!document.getElementById('maya-clo-assets-style')){const css=document.createElement('link');css.id='maya-clo-assets-style';css.rel='stylesheet';css.href='/aesthetics/ui/clo-assets.css?v=3';document.head.append(css);}
 window.MayaCloAssets={create({host,getContext,getToken,fetchImpl=(...args)=>fetch(...args),openPreview=image=>window.MayaImageViewer?.open(image)}){
  let context=null,key='',state=null,serial=0,controller=null,poll=null,active=false,busy=false,loaded=false,filter='all',destroyed=false,previewRecord=null,previewClose=null;
  const cards=new Map();
  const favorites=()=>Array.isArray(state?.review?.favorites)?state.review.favorites:state?.review?.selected?[state.review.selected]:[];
  const isFavorite=url=>favorites().some(item=>item.url===url);
  const node=(tag,label,role='P3')=>{const el=document.createElement(tag);el.dataset.mayaType=role;if(label)el.textContent=label;return el;};
  const toolbar=node('div');toolbar.className='clo-toolbar';
  const search=node('button','Find assets');search.type='button';search.className='pill';
  const filters=node('select');filters.dataset.mayaControl='field';filters.dataset.mayaPill='glass';filters.setAttribute('aria-label','Filter CLO assets');for(const [value,label]of [['all','All assets'],['favorites','Favorites'],['free','Free'],['paid','Paid'],['editable','Editable patterns']]){const option=node('option',label);option.value=value;filters.append(option);}
  filters.onchange=()=>{filter=filters.value;render();};
  const restore=node('button','Restore hidden');restore.type='button';restore.className='pill';restore.hidden=true;
  toolbar.append(search,filters,restore);
  const selected=node('div');selected.className='clo-selection';
  const gallery=node('div');gallery.className='clo-results';gallery.dataset.mayaScrollbar='visible';
  const status=node('p','','P1');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.className='clo-status';
  host.classList.add('maya-clo-assets');host.replaceChildren(toolbar,selected,gallery,status);
  const identity=()=>JSON.stringify([getContext(),getToken()]);
  const current=(ticket,captured)=>!destroyed&&ticket===serial&&captured===identity();
  function cancel(){++serial;controller?.abort();controller=null;clearTimeout(poll);poll=null;busy=false;}
  function message(value){status.textContent=value;}
  const link=(url,label)=>{const a=node('a',label);a.href=listing(url);a.target='_blank';a.rel='noopener noreferrer';return a;};
  function closePreview(){const close=previewClose;previewRecord=null;previewClose=null;try{close?.();}catch{}}
  function disposeCard(record){if(previewRecord===record)closePreview();record.disposed=true;clearTimeout(record.timer);record.image?.removeAttribute('src');record.card.remove();}
  function clearCards(){closePreview();for(const record of cards.values())disposeCard(record);cards.clear();gallery.replaceChildren();}
  function showPreview(record){
   if(destroyed||!active||!record.healthy||!record.card.isConnected||identity()!==key)return;
   closePreview();previewRecord=record;
   try{const opened=openPreview(record.image);previewClose=typeof opened==='function'?opened:opened?.close?()=>opened.close():null;}catch{closePreview();message('The photo could not open. Try again or use the source listing.');}
  }
  function mountPhoto(record,item){
   const urls=[...new Set([item.image,...(Array.isArray(item.imageCandidates)?item.imageCandidates:[]),item.thumbnail].map(photo).filter(Boolean))].slice(0,6);
   if(JSON.stringify(urls)===record.imageKey)return;
   record.imageKey=JSON.stringify(urls);
   // Keep a successfully decoded source across saved reads and review changes.
   if(record.healthy&&urls.includes(record.image?.getAttribute('src')))return;
   if(previewRecord===record)closePreview();clearTimeout(record.timer);record.image?.removeAttribute('src');
   record.healthy=false;record.photo.disabled=true;record.card.classList.remove('has-photo','has-missing-photo');record.photo.replaceChildren();
   let candidate=0;
   const next=()=>{
    clearTimeout(record.timer);
    if(record.disposed||destroyed)return;
    if(candidate>=urls.length){record.image=null;record.card.classList.add('has-missing-photo');record.photo.replaceChildren(node('span','Preview unavailable'));record.photo.title='Open the source listing below to inspect this asset.';return;}
    const img=node('img');record.image=img;img.alt=item.title||'CLO asset';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';
    const source=urls[candidate++];
    const currentPhoto=()=>!record.disposed&&!destroyed&&record.image===img;
    img.onload=()=>{if(!currentPhoto())return;clearTimeout(record.timer);record.healthy=true;record.photo.disabled=false;record.card.classList.remove('has-missing-photo');record.card.classList.add('has-photo');};
    img.onerror=()=>{if(!currentPhoto())return;img.removeAttribute('src');next();};
    record.photo.replaceChildren(img);img.src=source;
    record.timer=setTimeout(()=>{if(!currentPhoto()||record.healthy)return;img.removeAttribute('src');next();},8000);
   };
   next();
  }
  function makeCard(item){
   const card=node('article');card.className='clo-card';card.dataset.mayaPanel='inner';card.tabIndex=0;
   const button=node('button');button.type='button';button.className='clo-photo';button.disabled=true;
   const caption=node('div');caption.className='clo-caption';caption.dataset.mayaScrollbar='visible';
   const actions=node('div');actions.className='clo-card-actions';
   const record={card,photo:button,caption,actions,image:null,healthy:false,disposed:false,timer:null};
   button.onclick=e=>{
    if(e.detail!==0&&window.matchMedia?.('(hover: none)').matches&&!card.classList.contains('is-revealed')){
     e.preventDefault();for(const other of gallery.querySelectorAll('.is-revealed'))other.classList.remove('is-revealed');card.classList.add('is-revealed');card.focus();return;
    }
    e.preventDefault();showPreview(record);
   };
   card.addEventListener('keydown',e=>{if(e.key==='Escape'){card.classList.remove('is-revealed');card.blur();}});
   for(const action of ['favorite','dismiss']){
    const b=node('button');b.type='button';b.className='pill maya-icon-button';b.dataset.mayaShape='circle';b.dataset.cloAction=action;
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',action==='favorite'?'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z':'M6 6l12 12M18 6L6 18');icon.append(path);
    const label=node('span');label.className='clo-action-label';b.append(icon,label);b.onclick=()=>mutate(action==='favorite'?(isFavorite(item.url)?'unfavorite':'favorite'):action,item.url);actions.append(b);
   }
   card.append(button,caption,actions);return record;
  }
  function updateCard(record,item,loadPhoto=true){
   const {card,photo:button,caption,actions}=record,title=item.title||'CLO asset';card.setAttribute('aria-label',title);button.setAttribute('aria-label','Preview '+title);
   const metadata=JSON.stringify([title,item.priceType,item.price,item.currency,item.formats,item.match,item.alterations,item.patternStatus,item.physicalProduction,item.licenseTier,item.factsEvidence]);
   if(record.metadata!==metadata){
    const wasOpen=!!caption.querySelector('details')?.open;caption.replaceChildren();
    const source=link(item.url,title);source.className='clo-title';source.dataset.mayaType='P1';source.setAttribute('aria-label','Open source listing: '+title);caption.append(source);
    const price=item.priceType==='free'?'Free':typeof item.price==='number'&&item.currency?item.currency+' '+item.price:item.priceType==='paid'?'Paid · price unknown':'Price unknown';
    caption.append(node('p',price+' · '+(item.formats?.join(', ')||'Formats unknown')));if(item.match)caption.append(node('p',item.match));
    const details=node('details');details.open=wasOpen;details.append(node('summary','Match details'));
    details.append(node('p','Alterations: '+(item.alterations||'Review in CLO.')),node('p','Patterns: '+({editable:'Editable candidate reported',mesh:'Mesh reference',unknown:'Contents unknown'}[item.patternStatus]||'Contents unknown')),node('p','Physical production: '+({allowed:'Allowed according to listing',prohibited:'Not permitted by listing',unknown:'Permission unknown'}[item.physicalProduction]||'Permission unknown')));
    if(item.licenseTier)details.append(node('p','License: '+item.licenseTier));if(item.factsEvidence)details.append(node('p',item.factsEvidence));details.append(node('p','Based on listing search evidence. Inspect the file before pattern work.'));caption.append(details);record.metadata=metadata;
   }
   const saved=isFavorite(item.url),inShortlist=(state?.items||[]).some(i=>i.url===item.url);card.classList.toggle('is-favorite',saved);
   for(const b of actions.children){const action=b.dataset.cloAction,label=action==='dismiss'?'Hide':saved?'Unfavorite':'Favorite';b.setAttribute('aria-label',label+' '+title);b.title=label;b.disabled=busy||!loaded||!!state?.stale&&!(action==='favorite'&&saved)||action==='dismiss'&&!inShortlist;if(action==='favorite')b.setAttribute('aria-pressed',String(saved));b.querySelector('.clo-action-label').textContent=label;}
   if(record.image)record.image.alt=title;if(loadPhoto)mountPhoto(record,item);
  }
  function render(){
   if(destroyed)return;
   const running=state?.status==='running'&&Date.now()-(state.startedAt||0)<75000;
   search.disabled=busy||!context?.submissionId||!loaded||running||state?.searchReady===false;
   search.textContent=state&&['complete','failed','running'].includes(state.status)||state?.stale?'Refresh':'Find assets';
   filters.disabled=busy;restore.hidden=!state?.review?.dismissed?.length;restore.disabled=busy||state?.stale;
   selected.replaceChildren();
   if(state?.review?.selected){const item=state.review.selected;selected.append(node('span','Selected reference: '),link(item.url,item.title));if(item.fingerprint!==state.fingerprint||state.stale)selected.append(node('span',' · Review for the changed garment'));const clear=node('button','Clear');clear.className='pill';clear.type='button';clear.disabled=busy||state.stale;clear.onclick=()=>mutate('clear');selected.append(clear);}
   const dismissed=new Set(state?.review?.dismissed||[]),shortlist=(state?.items||[]).filter(i=>listing(i.url)),currentURLs=new Set(shortlist.map(i=>i.url));
   const stored=favorites().filter(i=>listing(i.url)),items=[...shortlist,...stored.filter(i=>!currentURLs.has(i.url))],keep=new Set(items.map(i=>i.url)),visible=[];
   for(const [url,record]of cards)if(!keep.has(url)){disposeCard(record);cards.delete(url);}
   for(const item of items){const show=filter==='favorites'?isFavorite(item.url):currentURLs.has(item.url)&&!dismissed.has(item.url)&&(filter==='all'||filter==='editable'&&item.patternStatus==='editable'||item.priceType===filter);let record=cards.get(item.url);if(!record&&!show)continue;if(!record){record=makeCard(item);cards.set(item.url,record);}updateCard(record,item,show);if(show)visible.push(record.card);}
   const shown=new Set(visible);if(previewRecord&&!shown.has(previewRecord.card))closePreview();for(const child of [...gallery.children])if(!shown.has(child))child.remove();
   visible.forEach((card,index)=>{if(gallery.children[index]!==card)gallery.insertBefore(card,gallery.children[index]||null);});
   if(!visible.length)gallery.append(node('p',filter==='favorites'?'Favorite CLO assets to keep them with this submission.':state?.status==='complete'?'No matching assets in this view. Try another filter or refresh.':'Find digital garment references similar to this saved look.','P1'));
  }
  async function request(path,body,signal,token){const r=await fetchImpl('/api/admin/digital-assets/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});const j=await r.json();if(!r.ok)throw Error(j.error||'CLO assets are unavailable.');return j;}
  function schedulePoll(){clearTimeout(poll);if(active&&(state?.status==='running'||state?.automationReady&&state.status==='pending')&&Date.now()-(state.requestedAt||0)<180000)poll=setTimeout(()=>load(),4000);}
  function savedStatus(){return state?.stale?'The garment changed. Refresh to find new matches.':state?.status==='running'?'Searching for CLO assets':state?.status==='pending'?state.automationReady?'Preparing CLO assets':'Choose Find assets to prepare this look.':state?.status==='failed'?'Search stopped. Saved results were kept. Refresh to retry.':state?.status==='complete'?'Up to 10 CONNECT references · '+(state.items||[]).length+' found'+((state.items||[]).some(i=>!photo(i.image)&&!photo(i.thumbnail)&&!(i.imageCandidates||[]).some(photo))?' · Refresh to search for missing previews':''):'CLO references for '+(context?.garmentId?'this garment':'the full look');}
  async function load(){
   if(destroyed)return;
   if(!context?.submissionId||!getToken()){loaded=false;render();message('Open a saved submission to find CLO assets.');return;}
   const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();message('Loading saved CLO assets');
   try{const query=new URLSearchParams({submissionId:context.submissionId,garmentId:context.garmentId||''});const result=await request('research?'+query,null,controller.signal,token);if(!current(ticket,captured))return;state=result;loaded=true;message(savedStatus());}
   catch(e){if(current(ticket,captured)){loaded=false;message(e.message);}}
   finally{if(current(ticket,captured)){busy=false;render();if(!loaded){search.disabled=false;search.textContent='Reload';search.onclick=()=>load();}else search.onclick=searchAssets;schedulePoll();}}
  }
  async function searchAssets(){
   if(destroyed)return;
   if(identity()!==key){update();return;}
   if(search.disabled)return;clearTimeout(poll);const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();message('Searching for CLO assets');
   try{const result=await request('search',{submissionId:context.submissionId,garmentId:context.garmentId||'',refresh:['complete','failed','running'].includes(state?.status)||!!state?.stale,generation:state?.generation},controller.signal,token);if(!current(ticket,captured))return;state=result;loaded=true;message(savedStatus());}
   catch(e){if(current(ticket,captured)){message(e.message);loaded=false;}}
   finally{if(current(ticket,captured)){busy=false;render();if(!loaded){search.disabled=false;search.textContent='Reload';search.onclick=()=>load();}else search.onclick=searchAssets;schedulePoll();}}
  }
  async function mutate(action,url=''){
   if(destroyed)return;
   if(identity()!==key){update();return;}
   if(busy||!loaded||state?.stale&&action!=='unfavorite')return;clearTimeout(poll);const captured=identity(),ticket=++serial,token=getToken();controller?.abort();controller=new AbortController();busy=true;render();
   try{const result=await request('review',{submissionId:context.submissionId,garmentId:context.garmentId||'',action,url,generation:state.review.generation,fingerprint:state.fingerprint},controller.signal,token);if(!current(ticket,captured))return;state=result;message(action==='favorite'?'Favorite saved for this submission.':action==='unfavorite'?'Favorite removed.':action==='select'?'CLO reference saved.':savedStatus());}
   catch(e){if(current(ticket,captured))message(e.message);}
   finally{if(current(ticket,captured)){busy=false;render();schedulePoll();}}
  }
  search.onclick=searchAssets;restore.onclick=()=>mutate('restore');
  function update(){if(destroyed)return false;const next=identity();if(next===key)return false;cancel();clearCards();key=next;context=getContext();state=null;loaded=false;search.onclick=searchAssets;render();message('Open a saved submission to find CLO assets.');if(active)void load();return true;}
  return {update,setActive(value){if(destroyed)return;if(value&&!active){for(const record of cards.values())if(!record.healthy&&!record.image)record.imageKey=null;}active=value;const changed=update();if(active&&!changed){render();if(!loaded&&!busy)void load();}if(!active){clearTimeout(poll);poll=null;closePreview();}else schedulePoll();},reset(){if(destroyed)return;cancel();clearCards();key='';context=null;state=null;loaded=false;render();message('Open a saved submission to find CLO assets.');},destroy(){if(destroyed)return;destroyed=true;active=false;cancel();clearCards();host.replaceChildren();host.classList.remove('maya-clo-assets');}};
 }};
})();
