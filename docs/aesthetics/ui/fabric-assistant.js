// Fabric-only presentation shared with the active Aesthetic Control preview.
(function(){
 'use strict';
 let sequence=0;
 window.MayaFabricSearchDetails={create({parent,hoverTargets=[],preview=false}){
  const trigger=document.createElement('button');trigger.type='button';trigger.className='maya-pill fa-search-details-trigger';trigger.dataset.mayaType='P3';if(preview)trigger.dataset.previewCategory='P3';trigger.textContent='Search details';trigger.setAttribute('aria-expanded','false');
  const panel=document.createElement('section');panel.className='fa-search-details';panel.dataset.mayaScrollbar='visible';const content=document.createElement('div');content.dataset.mayaPanel='inner';panel.append(content);panel.id='fabric-search-details-'+(++sequence);panel.popover='manual';panel.setAttribute('role','region');panel.setAttribute('aria-label','Fabric search details');panel.tabIndex=-1;trigger.setAttribute('aria-controls',panel.id);parent.append(panel);
  let enabled=true,data=null,hideTimer;
  const line=(label,value)=>{const row=document.createElement('p');row.dataset.mayaType='P3';if(preview)row.dataset.previewCategory='P3';const title=document.createElement('strong');title.textContent=label+': ';row.append(title,document.createTextNode(value));content.append(row);};
  function close(){clearTimeout(hideTimer);if(panel.matches(':popover-open'))panel.hidePopover();trigger.setAttribute('aria-expanded','false');}
  function place(){
   const r=trigger.getBoundingClientRect(),w=Math.min(380,innerWidth-24),top=Math.max(12,Math.min(r.top,innerHeight-12)),bottom=Math.max(12,Math.min(r.bottom,innerHeight-12)),below=innerHeight-bottom-20,above=top-20,useBelow=below>=above;
   panel.style.width=w+'px';panel.style.maxHeight=Math.max(1,useBelow?below:above)+'px';panel.style.left=Math.max(12,Math.min(r.right-w,innerWidth-w-12))+'px';
   const height=panel.getBoundingClientRect().height;panel.style.top=Math.max(12,Math.min(useBelow?bottom+8:top-8-height,innerHeight-height-12))+'px';
  }
  function show(){clearTimeout(hideTimer);if(!enabled||!data||!trigger.isConnected)return;if(!panel.matches(':popover-open'))panel.showPopover();trigger.setAttribute('aria-expanded','true');place();}
  function later(){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!panel.matches(':hover')&&!trigger.matches(':hover')&&!panel.contains(document.activeElement)&&document.activeElement!==trigger)close();},160);}
  trigger.addEventListener('click',()=>{if(panel.matches(':popover-open')){close();return;}show();if(panel.matches(':popover-open'))panel.focus({preventScroll:true});});
  panel.addEventListener('focusout',later);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();trigger.focus({preventScroll:true});close();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.matches(':popover-open')){e.preventDefault();e.stopPropagation();const restore=panel.contains(document.activeElement);close();if(restore){trigger.focus({preventScroll:true});close();}}},{capture:true});
  document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!trigger.contains(e.target))close();});
  const reposition=()=>{if(panel.matches(':popover-open'))place();};addEventListener('resize',reposition);addEventListener('scroll',reposition,{capture:true});
  return {trigger,panel,close,setEnabled(value){enabled=value;trigger.hidden=!value;if(!value)close();},set(value){
   data=value;content.replaceChildren();trigger.disabled=!value;if(!value){close();return;}
   const heading=document.createElement('h3');heading.dataset.mayaType='H4';if(preview)heading.dataset.previewCategory='H4';heading.textContent='Fabric search';content.append(heading);
   line('Looking for',value.query||'Fabric for the selected look');
   if(value.observation)line('Reference interpretation',value.observation);
   if(value.stage)line('Status',value.stage);
   if(panel.matches(':popover-open'))place();
  }};
 }};
})();

/* One fabric conversation for the Brief and Operation Room. Research is saved per item in its submission folder. */
(function () {
  'use strict';
  let dialog, workspace, host, els, context = {}, identity = '', epoch = 0, controller, image = '', originalImage = '';
  const storeGroups=[
    {id:'local',label:'Local (Bay Area)',hosts:['britexfabrics.com','stonemountainfabric.com','hartsfabric.com']},
    {id:'mood',label:'Mood',hosts:['moodfabrics.com']},
    {id:'swatchon',label:'Swatchon',hosts:['swatchon.com']},
    {id:'amazon',label:'Amazon',hosts:['amazon.com']},
    {id:'others',label:'Others',hosts:['blackbirdfabrics.com','thefabricstore.com','tessuti.com.au']},
  ];
  let reopenSaved=null;
  let searchSeq=0, autoStarted=false, searchMode='worldwide',activeStores=new Set(),filterTouched=false,submittedRequest='',lastSearchStores='',completedStatus='';
  const storeKey=()=>searchMode==='worldwide'?'worldwide':'retailers|'+[...activeStores].sort().join('|');
  let history = [], products = [], book = { items: [], selectedUrl: '', generation: null }, view = 'search', busy = false;
  let bookSeq = 0, photoSeq = 0, projectEpoch=0, projectIdentity='', reads=new AbortController(),projectReads=new AbortController();
  let searchDetails=null,searchState='idle',research=null,researchRead=null,researchReady=Promise.resolve();
  let retracted=new Set();
  const resultCache=new Map(),preparedPhotos=new Map();
  const resultKey=()=>scope()+'|'+JSON.stringify([context.preferences||'',!!context.automatic,storeKey()]);
  function rememberResults(){
    if(identity!==scope()||!account()||!context.submissionId||(!products.length&&searchState!=='complete'))return;
    const key=resultKey();resultCache.delete(key);resultCache.set(key,{at:Date.now(),products:structuredClone(products),searchDetails:structuredClone(searchDetails),observation:els.observation.textContent,history:structuredClone(history),submittedRequest,lastSearchStores,completedStatus,searchState,stores:[...activeStores],filterTouched,image,originalImage,reference:context.referenceImage||'',view,inhouse:context.inhouse});
    if(resultCache.size>24)resultCache.delete(resultCache.keys().next().value);
  }
  function restoreResults(){
    const cached=resultCache.get(resultKey());if(!cached||cached.reference!==(context.referenceImage||'')||(!cached.products.length&&Date.now()-cached.at>30000))return false;
    ({submittedRequest,lastSearchStores,completedStatus,filterTouched,image,originalImage,view}=cached);products=structuredClone(cached.products);searchDetails=structuredClone(cached.searchDetails);history=structuredClone(cached.history);activeStores=new Set(cached.stores);context.inhouse=cached.inhouse;searchState=cached.searchState==='complete'?'complete':'interrupted';autoStarted=true;els.details.set(searchDetails);els.observation.textContent=cached.observation||searchDetails?.observation||'';paintPhoto();status(searchState==='complete'?completedStatus:'Search interrupted. Loaded suggestions are kept; Refresh to continue.');return true;
  }
  let saves={tail:Promise.resolve(),pending:new Set()},inventoryRequest=null,inventoryData=null,inventoryVersion=0;
  let favorites={items:[],generation:null},favoriteAccount='',favoriteEpoch=0,favoriteSeq=0,favoriteRead=null;
  let favoriteQueue={tail:Promise.resolve(),pending:new Set()};
  const favoriteChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('maya-studio-fabrics'):null;
  function checkFavoriteAccount(){
    const next=account();if(next===favoriteAccount)return;
    favoriteAccount=next;favoriteEpoch++;favoriteSeq++;favoriteRead=null;
    favorites={items:[],generation:null};favoriteQueue={tail:Promise.resolve(),pending:new Set()};
  }
  async function loadFavorites(force=false){
    checkFavoriteAccount();if(!favoriteAccount)return;
    if(favoriteRead&&!force)return favoriteRead;
    const owner=favoriteAccount,stamp=favoriteEpoch,seq=++favoriteSeq;
    const valid=()=>owner===account()&&stamp===favoriteEpoch&&seq===favoriteSeq;
    const task=(async()=>{try{
      const data=await json('/api/admin/fabrics/favorites',{signal:AbortSignal.timeout(10000)});
      if(!Array.isArray(data.items)||typeof data.generation!=='string')throw Error('Favorites unavailable. Try again.');
      if(valid()){favorites=data;paint();}
    }catch(e){if(valid())els.saveStatus.textContent=e.message;}})();
    favoriteRead=task;try{await task;}finally{if(favoriteRead===task)favoriteRead=null;}
  }
  function toggleFavorite(product){
    checkFavoriteAccount();if(!favoriteAccount)return;
    const queue=favoriteQueue,owner=favoriteAccount,stamp=favoriteEpoch;
    const valid=()=>owner===account()&&stamp===favoriteEpoch;
    if(queue.pending.has(product.url))return;
    const snapshot=structuredClone(product),actionName=favorites.items.some(p=>p.url===product.url)?'remove':'save';
    queue.pending.add(product.url);paint();
    queue.tail=queue.tail.catch(()=>{}).then(async()=>{
      if(!valid())return;
      if(favorites.generation===null){await loadFavorites(true);if(!valid()||favorites.generation===null)return;}
      favoriteSeq++;
      try{
        const data=await json('/api/admin/fabrics/favorites',{method:'POST',body:JSON.stringify({generation:favorites.generation,action:actionName,product:snapshot})});
        if(!valid())return;favoriteSeq++;favorites=data;els.saveStatus.textContent=actionName==='save'?'Saved to studio favorites.':'Removed from studio favorites.';
        favoriteChannel?.postMessage({changed:true});
      }catch(e){if(valid()){favorites.generation=null;els.saveStatus.textContent=e.name==='TimeoutError'?'Save not confirmed. Refresh Favorites before retrying.':e.message;await loadFavorites(true);}}
    }).finally(()=>{queue.pending.delete(product.url);if(valid())paint();});
    return queue.tail;
  }
  favoriteChannel?.addEventListener('message',()=>{if(els&&account())void loadFavorites(true);});
  window.addEventListener('focus',()=>{if(els&&account())void loadFavorites(true);});
  let bookRead=null,bookLoadedAt=0;
  // Only decoded cards survive a tab switch. Pending image requests retain
  // their normal deadlines; private nodes are discarded on every scope reset.
  const parkedCards=new Map();
  function clearParkedCards(){for(const card of parkedCards.values())card._fabricDispose?.();parkedCards.clear();}
  function releaseCard(card){
    card.remove();
    if(card._fabricView!==view&&card.classList.contains('has-photo')){
      const key=card._fabricSignature;parkedCards.get(key)?._fabricDispose?.();parkedCards.delete(key);parkedCards.set(key,card);
      if(parkedCards.size>24){const first=parkedCards.keys().next().value;parkedCards.get(first)._fabricDispose?.();parkedCards.delete(first);}
    }else card._fabricDispose?.();
  }
  const token = () => localStorage.getItem('maya_admin_tok') || localStorage.getItem('maya_google_token') || '';
  function account() {
    try { const p = JSON.parse(atob(token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.exp * 1000 > Date.now() ? String(p.sub || '') : ''; }
    catch (_) { return ''; }
  }
  const scope = () => account() + '|' + (context.submissionId || 'unsaved') + '|' + JSON.stringify([context.piece?.id||context.piece?.name||'',context.piece?.fabric||'',context.piece?.fabric_spec||{},context.pieces?.map(p=>[p.id,p.name,p.fabric,p.fabric_spec])||[]]);
  const current = stamp => stamp === epoch && identity === scope() && !!account();
  const projectScope=()=>account()+'|'+(context.submissionId||'unsaved');
  const projectTicket=()=>({epoch:projectEpoch,key:projectIdentity});
  const projectCurrent=ticket=>ticket.epoch===projectEpoch&&ticket.key===projectIdentity&&ticket.key===projectScope()&&!!account();
  function pieceMetadata(piece={}){
    piece=piece&&typeof piece==='object'?piece:{};
    if(!piece.id&&!piece.name&&!piece.fabric)return {};
    const out={};for(const [key,max] of [['id',100],['name',80],['category',80],['fabric',180],['fabric_hex',7]])if(typeof piece[key]==='string')out[key]=piece[key].slice(0,max);
    if(piece.skip)out.skip=true;
    if(piece.fabric_spec){out.fabric_spec={};for(const key of ['fiber','weave','stretch','sheen','texture'])if(typeof piece.fabric_spec[key]==='string')out.fabric_spec[key]=piece.fabric_spec[key].slice(0,80);}
    return out;
  }
  function selectedProduct(piece=context.piece){
    const id=piece?.id||'',items=book.items||[];
    let url=id&&book.selectedByGarment?.[id];
    if(!url&&id&&!Object.hasOwn(book,'selectedByGarment')&&book.selectedUrl){const legacy=items.find(p=>p.url===book.selectedUrl);const names=(context.pieces||[]).filter(p=>p.name===piece.name);if(legacy&&(legacy.garmentId===id||(!legacy.garmentId&&legacy.garment===piece.name&&names.length===1)))url=legacy.url;}
    if(!id&&!piece?.name)url=book.selectedUrl;
    const product=items.find(p=>p.url===url);return product?{...product,...(id?{garmentId:id,garment:piece.name||product.garment}:{} )}:null;
  }

  const node = (tag, className, value) => { const n = document.createElement(tag); if (className) n.className = className; if (value != null) n.textContent = value; if(['h2','h3','p','label','button','textarea','select'].includes(tag))n.dataset.mayaType=tag==='h2'?'H2':tag==='h3'?'H4':['button','label','select'].includes(tag)?'P3':'P1'; return n; };
  function waitForSignal(promise,signal) {
    return new Promise((resolve,reject)=>{
      const abort=()=>reject(signal.reason);
      if(signal.aborted){reject(signal.reason);return;}
      signal.addEventListener('abort',abort,{once:true});
      Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
    });
  }
  function action(label, fn) { const b = node('button','pill maya-pill',label); b.type = 'button'; b.addEventListener('click',fn); return b; }
  let searchStatus='',inventoryStatus='';
  function showStatus(){els.status.textContent=view==='search'?searchStatus:view==='inhouse'?inventoryStatus:'';}
  function status(message){searchStatus=message||'';showStatus();}
  function reset() {
    checkFavoriteAccount();searchStatus='';inventoryStatus='';epoch++;photoSeq++;searchSeq++;autoStarted=false;searchMode='worldwide';activeStores=new Set();filterTouched=false;submittedRequest='';lastSearchStores='';completedStatus='';controller?.abort();recognition?.stop();reads.abort();reads=new AbortController();clearParkedCards();
    const nextProject=projectScope();if(nextProject!==projectIdentity){resultCache.clear();preparedPhotos.clear();bookRead=null;bookLoadedAt=0;bookSeq++;projectReads.abort();projectReads=new AbortController();projectEpoch++;projectIdentity=nextProject;saves={tail:Promise.resolve(),pending:new Set()};book={items:[],selectedUrl:'',selectedByGarment:{},generation:null};}
    controller=null;busy=false;history=[];products=[];image='';originalImage='';view='search';
    research=null;researchRead=null;researchReady=Promise.resolve();retracted=new Set();searchDetails=null;searchState='idle';els?.details.set(null);
    if(els){els.input.value='';els.observation.textContent='';els.transcript.replaceChildren();for(const card of els.results.children)card._fabricDispose?.();els.results.replaceChildren();els.photo.hidden=true;els.preview.removeAttribute('src');els.file.value='';els.send.disabled=false;els.stop.hidden=true;els.saveStatus.textContent='';els.storeWrap.hidden=true;els.filter.setAttribute('aria-expanded','false');status('');}
  }
  function icon(label,path,fn) {
    const b=action('',fn);b.classList.add('maya-icon-button');b.setAttribute('aria-label',label);b.title=label;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');
    const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);b.append(svg);return b;
  }
  function syncLayout() {
    if(!els)return;
    const compact=!!context.compactRail,rail=compact&&workspace.classList.contains('is-inline');
    workspace.classList.toggle('fa-compact-cards',compact);workspace.classList.toggle('is-rail',rail);
    if(rail){if(els.rail.parentNode!==els.body)els.body.insertBefore(els.rail,els.saveStatus);els.rail.append(els.header,els.results);}
    else {if(els.header.parentNode!==workspace)workspace.prepend(els.header);if(els.results.parentNode!==els.body)els.body.insertBefore(els.results,els.saveStatus);els.rail.remove();}
  }
  function collapse() {
    if(dialog.open)dialog.close();
    if(host?.isConnected){host.append(workspace);workspace.classList.add('is-inline');}
    els.expand.textContent='Expand';els.expand.setAttribute('aria-expanded','false');syncLayout();
  }
  function expand() {
    if(dialog.open && host)return collapse();
    workspace.classList.remove('is-inline');dialog.append(workspace);workspace.hidden=false;syncLayout();
    if(!dialog.open)dialog.showModal();els.expand.textContent=host?'Collapse':'Close';els.expand.setAttribute('aria-expanded','true');
  }
  function close() {
    rememberResults();
    if(busy)autoStarted=products.length>0;
    controller?.abort();recognition?.stop();searchSeq++;busy=false;
    if(searchState==='searching')searchState='interrupted';
    if(!workspace)return;
    collapse();workspace.hidden=true;els.details.close();els.send.disabled=false;els.stop.hidden=true;
  }
  function make() {
    if (dialog) return;
    dialog=node('dialog','fabric-assistant-dialog');dialog.id='fabric-assistant-dialog';dialog.setAttribute('aria-labelledby','fabric-assistant-title');document.body.append(dialog);
    workspace=node('section','fabric-assistant maya-surface');workspace.id='fabric-assistant';workspace.dataset.mayaSurface='outer';
    const header=node('header','fa-header');
    const title=node('h2','', 'Fabrics');title.id='fabric-assistant-title';
    const toolbar=node('div','fa-toolbar');
    const refresh=icon('Refresh fabrics','M20 7v5h-5M20 12a8 8 0 1 0-2 5',()=>view==='search'&&busy?controller?.abort():refreshView());
    const expandButton=action('Expand',()=>host?expand():close());expandButton.setAttribute('aria-expanded','false');
    const exportButton=action('CSV',exportCSV);exportButton.setAttribute('aria-label','Export submission fabric research as CSV');toolbar.append(refresh,exportButton,expandButton);
    const sub=node('p','fa-context');
    const tabs=node('nav','fa-tabs');tabs.setAttribute('aria-label','Fabric views');tabs.dataset.mayaControl='segmented';
    const inhouse=action('In House',()=>{view='inhouse';paint();});
    const search=action('Global',()=>chooseSearch('worldwide'));
    const saved=action('Favorites',async()=>{view='saved';paint();await loadFavorites(true);});
    const fresh=action('New search',()=>open({...context,forceReset:true}));
    for(const button of [inhouse,search,saved])button.dataset.mayaSegment='';
    const filter=icon('Search specific shops','M4 5h16M7 12h10M10 19h4',()=>{storeWrap.hidden=!storeWrap.hidden;filter.setAttribute('aria-expanded',String(!storeWrap.hidden));if(!storeWrap.hidden)storeButtons[0].focus();});filter.setAttribute('aria-expanded','false');
    const storeWrap=node('div','fa-store-wrap');storeWrap.hidden=true;storeWrap.setAttribute('role','group');storeWrap.setAttribute('aria-label','Optional separate retailer searches');
    const storeButtons=storeGroups.map(group=>{const button=action(group.label,()=>chooseSearch('retailers',group.id));button.classList.add('fa-store-filter');button.dataset.mayaSegment='';button.dataset.storeGroup=group.id;return button;});storeWrap.append(...storeButtons);
    tabs.append(inhouse,search,saved,filter,fresh);
    const rail=node('div','fa-rail');rail.dataset.mayaScrollbar='visible';rail.tabIndex=0;rail.setAttribute('aria-label','Fabric views and suggestions');
    const body=node('div','fa-body');body.dataset.mayaScrollbar='visible';body.tabIndex=0;body.setAttribute('aria-label','Fabric results');
    const transcript=node('div','fa-transcript');transcript.setAttribute('aria-label','Your requests');
    const observation=node('p','fa-observation'),results=node('div','fa-results'),saveStatus=node('p','fa-save-status');saveStatus.setAttribute('role','status');results.dataset.mayaScrollbar='visible';results.tabIndex=0;results.setAttribute('aria-label','Fabric suggestions');body.append(transcript,observation,results,saveStatus);
    const form=node('form','fa-composer');
    const photo=node('div','fa-photo');photo.hidden=true;
    const preview=node('img');preview.alt='Original look reference';photo.append(preview,action('Remove photo',()=>replaceReference('')));
    const label=node('label','fa-input-label','Find or refine fabrics');label.htmlFor='fabric-request';
    const input=node('textarea');input.id='fabric-request';input.rows=2;input.maxLength=1200;input.dataset.mayaControl='field';input.placeholder='Find the fabrics for this look…';
    const row=node('div','fa-actions'),file=node('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    const upload=action('Add photo',()=>file.click());file.addEventListener('change',()=>attach(file.files?.[0]));
    const mic=action('Dictate',dictate);mic.hidden=!(window.SpeechRecognition||window.webkitSpeechRecognition);
    const send=node('button','pill maya-pill','Find fabric');send.type='submit';
    const stop=action('Stop',()=>controller?.abort());stop.hidden=true;row.append(upload,mic,send,stop,file);form.append(photo,label,input,row);
    const live=node('p','fa-status');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
    form.addEventListener('submit',e=>{e.preventDefault();run();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!busy)run();}});
    input.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));if(f){e.preventDefault();attach(f);}});
    header.append(title,tabs,toolbar);workspace.append(header,sub,storeWrap,body,form,live);dialog.append(workspace);
    const details=window.MayaFabricSearchDetails.create({parent:workspace});tabs.append(details.trigger);details.set(null);
    // Native close events are queued. A prior close must not cancel or move a
    // workspace that has already been reopened for a new search.
    let outsideDown=false;
    const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
    dialog.addEventListener('pointerdown',event=>{outsideDown=outside(event);});
    dialog.addEventListener('click',event=>{if(outsideDown&&outside(event)){if(host)collapse();else close();}outsideDown=false;});
    dialog.addEventListener('close',()=>{if(dialog.open)return;if(host?.isConnected){host.append(workspace);workspace.classList.add('is-inline');els.expand.textContent='Expand';els.expand.setAttribute('aria-expanded','false');syncLayout();}else{controller?.abort();recognition?.stop();}});
    els={header,rail,exportButton,details,sub,search,saved,inhouse,fresh,storeButtons,storeWrap,filter,refresh,expand:expandButton,form,input,file,upload,send,stop,status:live,observation,results,transcript,photo,preview,saveStatus,mic,body};
  }
  let recognition;
  function dictate() {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) return;
    if (recognition) { recognition.stop(); return; }
    const stamp = epoch;
    recognition = new API(); recognition.lang='en-US'; recognition.interimResults=false;
    recognition.onresult = e => { if (current(stamp)) els.input.value = (els.input.value + ' ' + e.results[0][0].transcript).trim().slice(0,1200); };
    recognition.onerror = () => status('Dictation unavailable. You can type your request.');
    recognition.onend = () => { recognition=null; els.mic.textContent='Dictate'; };
    els.mic.textContent='Stop dictation';
    try { recognition.start(); } catch (_) { recognition=null; els.mic.textContent='Dictate'; }
  }
  function headers() { return { Authorization:'Bearer '+token(), 'Content-Type':'application/json' }; }
  async function json(url, options={}) {
    const signal=options.signal||(!options.method||options.method==='GET'?AbortSignal.any([reads.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(15000));
    const r = await fetch(url, { ...options, signal, headers: headers(), cache:'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(data.error || 'Request failed. Try again.');
    return data;
  }
  async function photoData(source) {
    if (!source) return '';
    const blob = typeof source === 'string' ? await (await fetch(source,{signal:AbortSignal.any([reads.signal,AbortSignal.timeout(10000)])})).blob() : source;
    if (!/^image\/(jpeg|png|webp)$/.test(blob.type) || blob.size > 15*1024*1024) throw Error('Use a JPEG, PNG or WebP photo under 15 MB.');
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas'); canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',.85);
    } finally { bitmap.close(); }
  }
  function replaceReference(value){
    resultCache.delete(resultKey());controller?.abort();searchSeq++;busy=false;autoStarted=false;
    searchMode='worldwide';activeStores=new Set();
    image=value;originalImage=value;context.referenceImage=value;products=[];history=[];submittedRequest='';lastSearchStores='';completedStatus='';searchDetails=null;searchState='idle';
    els.details.set(null);els.send.disabled=false;els.stop.hidden=true;paintPhoto();paint();
  }
  async function preparedPhoto(source){
    if(preparedPhotos.has(source))return preparedPhotos.get(source);
    const ticket=projectTicket(),value=await photoData(source);
    if(projectCurrent(ticket)){preparedPhotos.set(source,value);if(preparedPhotos.size>2)preparedPhotos.delete(preparedPhotos.keys().next().value);}
    return value;
  }
  async function attach(file) {
    if (!file) return;
    const stamp=epoch, photoRequest=++photoSeq;
    try { const value=await photoData(file); if (!current(stamp) || photoRequest!==photoSeq) return; replaceReference(value); status('Photo added. Add a description or press Find fabric.'); }
    catch (e) { if (current(stamp)) status(e.message); }
    els.file.value='';
  }
  function paintPhoto() { els.photo.hidden=!image; if (image) els.preview.src=image; else els.preview.removeAttribute('src'); }
  async function loadInventory(force=false) {
    if(Array.isArray(context.inhouse)&&!force)return;
    const stamp=epoch;
    inventoryStatus='';
    // This catalog is public and versioned, independent of any garment/account.
    // Each caller applies it only to its own still-current view.
    if(force||(!inventoryData&&!inventoryRequest)){
      inventoryVersion++;
      const task=(async()=>{
      const signal=AbortSignal.timeout(15000);
      const response=await fetch('/aesthetics/fabrics/fabrics.json?v=2',{cache:force?'no-store':'default',signal});
      if(!response.ok)throw Error('In-house photos unavailable.');
      const data=await response.json();
      return (data.items||[]).filter(p=>typeof p.fileName==='string'&&!/[\\/]/.test(p.fileName)&&/\.(?:png|jpe?g|webp)$/i.test(p.fileName)).map(p=>{
        const original='/aesthetics/fabrics/'+encodeURIComponent(p.fileName);
        const thumbnail=typeof p.thumbnail==='string'&&p.thumbnail.match(/^thumbs\/([^\\/]+\.(?:png|jpe?g|webp))$/i);
        return {title:p.name||p.fileName,url:original,image:thumbnail?'/aesthetics/fabrics/thumbs/'+encodeURIComponent(thumbnail[1]):original,description:[p.weave,p.weight,p.color].filter(Boolean).join(' · ')};
      });
      })();inventoryRequest=task;
    }
    const task=inventoryRequest,version=inventoryVersion;
    try{const data=task?await task:inventoryData;if(version!==inventoryVersion)return;if(task&&inventoryRequest===task)inventoryData=data;if(current(stamp))context.inhouse=data;}
    catch(e){if(version===inventoryVersion&&current(stamp))inventoryStatus=e.name==='TimeoutError'?'In-house photos timed out. Refresh to retry.':'In-house photos unavailable. Refresh to retry.';throw e;}
    finally{if(inventoryRequest===task)inventoryRequest=null;if(version===inventoryVersion&&current(stamp))paint();}
  }
  async function loadContext(stamp) {
    if (!context.submissionId || context.referenceImage) return;
    const data = await json('/api/admin/submissions');
    const folder=(data.folders || []).find(f=>f.id===context.submissionId);
    if (!folder) throw Error('This submission is unavailable. Open it from Admin.');
    const files=folder.files || [];
    const summary=files.find(f=>f.name==='summary.json');
    const hero=files.find(f=>/^dream-garment\.(png|jpe?g)$/i.test(f.name));
    const [preferences, reference] = await Promise.all([
      summary ? json('/api/admin/subfile?id='+encodeURIComponent(summary.id)).then(s=> typeof s.fabric_preferences==='string' ? s.fabric_preferences : JSON.stringify(s.fabric_preferences || '')) : '',
      hero ? fetch('/api/admin/subfile?id='+encodeURIComponent(hero.id),{headers:headers(),signal:AbortSignal.any([reads.signal,AbortSignal.timeout(10000)])}).then(r=>{if(!r.ok)throw Error('Reference photo could not load.');return r.blob();}).then(photoData) : '',
    ]);
    if (!current(stamp)) return;
    context.preferences=preferences; context.referenceImage=reference; image=originalImage=reference; paintPhoto();
    window.dispatchEvent(new CustomEvent('maya:fabric-context',{detail:{submissionId:context.submissionId,referenceImage:reference}}));
  }
  async function loadBook(forSave=false) {
    if(saves.pending.size&&!forSave)return;
    if(!forSave){if(bookRead)return bookRead;if(bookLoadedAt&&Date.now()-bookLoadedAt<30000)return;}
    const ticket=projectTicket(),sequence=++bookSeq;
    if(!context.submissionId){if(view==='saved')status('Open a submission to save fabrics.');return;}
    const task=(async()=>{
    try{
      const data=await json('/api/admin/fabrics/lookbook?submissionId='+encodeURIComponent(context.submissionId),{signal:AbortSignal.any([projectReads.signal,AbortSignal.timeout(10000)])});
      if(!projectCurrent(ticket)||sequence!==bookSeq)return;
      book=data;bookLoadedAt=Date.now();if(view==='saved')paint();notifySelection();
    }catch(e){if(projectCurrent(ticket)&&sequence===bookSeq)els.saveStatus.textContent=e.message;}
    })();bookRead=task;try{await task;}finally{if(bookRead===task)bookRead=null;}
  }
  async function loadResearch(stamp=epoch){
    if(!context.automatic||!context.submissionId||!context.piece?.id)return null;
    if(researchRead)return researchRead;
    const task=(async()=>{
    const data=await json('/api/admin/fabrics/research?'+new URLSearchParams({submissionId:context.submissionId,garmentId:context.piece.id}));
    if(!current(stamp))return null;research=data;products=data.items.filter(p=>!retracted.has(p.url));return {...data,items:products};
    })();researchRead=task;try{return await task;}finally{if(researchRead===task)researchRead=null;}
  }
  async function dismiss(product,button){
    if(busy||!research)return;
    const stamp=epoch,submissionId=context.submissionId,garmentId=context.piece?.id;
    button.disabled=true;
    try{
      const data=await json('/api/admin/fabrics/research',{method:'POST',body:JSON.stringify({submissionId,garmentId,generation:research.generation,url:product.url})});
      if(!current(stamp))return;research=data;products=data.items;rememberResults();status('');paint();
    }catch(e){if(current(stamp))status(e.message);}finally{button.disabled=false;}
  }
  async function exportCSV(){
    const ticket=projectTicket(),submissionId=context.submissionId;if(!submissionId)return;
    els.exportButton.disabled=true;
    try{
      const response=await fetch('/api/admin/fabrics/export?'+new URLSearchParams({submissionId}),{headers:headers(),cache:'no-store',signal:AbortSignal.any([projectReads.signal,AbortSignal.timeout(30000)])});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Export unavailable.');}
      const blob=await response.blob();if(!projectCurrent(ticket))return;
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=submissionId+'-fabrics.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){if(projectCurrent(ticket))els.saveStatus.textContent=e.message;}finally{els.exportButton.disabled=false;}
  }
  function notifySelection(){
    window.dispatchEvent(new CustomEvent('maya:fabric-selected',{detail:{submissionId:context.submissionId,garmentId:context.piece?.id||'',product:selectedProduct()}}));
  }
  function save(product,actionName,button){
    const ticket=projectTicket(),queue=saves,submissionId=context.submissionId;
    if(!submissionId)return status('Open a submission to save this fabric.');
    const snapshot=structuredClone(product),garmentId=context.piece?.id||product.garmentId||'',garmentName=context.piece?.name||product.garment||'';
    const key=actionName+'|'+snapshot.url+'|'+garmentId;if(queue.pending.has(key))return;
    queue.pending.add(key);bookSeq++;button.disabled=true;button.setAttribute('aria-busy','true');
    const task=async()=>{
      if(!projectCurrent(ticket))return;
      if(book.generation===null){await loadBook(true);if(!projectCurrent(ticket)||book.generation===null)return;}
      try{
        const payload=book.items.some(p=>p.url===snapshot.url)?{url:snapshot.url}:{...snapshot,garment:snapshot.garment||garmentName,garmentId:snapshot.garmentId||garmentId};
        const data=await json('/api/admin/fabrics/lookbook',{method:'POST',body:JSON.stringify({submissionId,generation:book.generation,action:actionName,garmentId,product:payload})});
        if(!projectCurrent(ticket))return;
        book=data;bookLoadedAt=Date.now();if(view==='saved')paint();notifySelection();els.saveStatus.textContent=actionName==='remove'?'Removed.':actionName==='select'?'Selected: '+(garmentName||'this look')+'.':'Saved'+(garmentName?': '+garmentName:'')+'.';
      }catch(e){if(projectCurrent(ticket)){book.generation=null;els.saveStatus.textContent=e.name==='TimeoutError'?'Change not confirmed. Check Favorites before retrying.':e.message;await loadBook(true);}}
    };
    queue.tail=queue.tail.catch(()=>{}).then(task).finally(()=>{queue.pending.delete(key);button.removeAttribute('aria-busy');button.disabled=false;if(projectCurrent(ticket))paint();});return queue.tail;
  }
  function inventory() {
    return (context.inhouse||[]).map(p=>({...p,url:p.url&&p.url!=='#'?p.url:(p.image||p.img||''),image:p.image||p.img||'',evidence:'atelier_inventory',price:'',unit:'',availability:'unknown',garment:p.garment||''})).filter(p=>p.image && p.url);
  }
  function photoCandidates(product) {
    const values=[product.image,...(Array.isArray(product.imageCandidates)?product.imageCandidates:[])],urls=[];
    for(const value of values){
      if(typeof value!=='string'||!value||urls.includes(value))continue;
      if(/^data:image\//.test(value)){urls.push(value);}
      else try{
        const url=new URL(value,location.href),host=url.hostname.toLowerCase().replace(/\.$/,'');
        const local=value.startsWith('/aesthetics/fabrics/')&&url.origin===location.origin&&url.pathname.startsWith('/aesthetics/fabrics/');
        if(local||(value.length<=4096&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&host.includes('.')&&!/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/.test(host)))urls.push(value);
      }catch(_){}
      if(urls.length===4)break;
    }
    return urls;
  }
  let photoPaintQueued=false;
  function queuePhotoPaint(item){
    if(!item.isConnected||view!=='search'||searchMode!=='worldwide'||photoPaintQueued)return;
    photoPaintQueued=true;const stamp=epoch;
    queueMicrotask(()=>{photoPaintQueued=false;if(current(stamp)&&view==='search'&&searchMode==='worldwide')paint();});
  }
  function mountProductPhoto(item,link,product) {
    const urls=[],attempted=new Set(),rejected=new Set();let img=null,loading=false,healthy=false,unavailable=null,promoteOnLoad=false,timer=null,disposed=false;
    const clearTimer=()=>{clearTimeout(timer);timer=null;};
    item._fabricDispose=()=>{disposed=true;clearTimer();};
    const missing=()=>{
      const wasMissing=item.classList.contains('has-missing-photo');
      img?.remove();item.classList.add('has-missing-photo');item.classList.remove('has-photo');
      // The source link and two caption lines remain usable without a photo.
      if(!wasMissing)queuePhotoPaint(item);
    };
    const next=()=>{
      if(disposed||healthy||loading)return;
      const source=urls.find(url=>!attempted.has(url)&&!rejected.has(url));
      if(!source||attempted.size>=4){missing();return;}
      if(!img){
        img=node('img','fa-product-image');img.alt=product.title;img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';
        const photo=img;
        img.addEventListener('load',()=>{if(disposed||img!==photo||!item.isConnected)return;clearTimer();loading=false;healthy=true;item.classList.remove('has-missing-photo');item.classList.add('has-photo');unavailable?.remove();unavailable=null;if(promoteOnLoad){promoteOnLoad=false;queuePhotoPaint(item);}});
        img.addEventListener('error',()=>{if(disposed||img!==photo||!item.isConnected)return;clearTimer();loading=false;next();});
      }
      attempted.add(source);loading=true;promoteOnLoad=promoteOnLoad||item.classList.contains('has-missing-photo');unavailable?.remove();unavailable=null;item.classList.remove('has-missing-photo');
      if(!img.isConnected)link.prepend(img);window.MayaImageViewer?.bind(img);img.src=source;
      // Each actual browser request gets a deadline. A hung host must not leave
      // an empty swatch forever; this never retries the paid search.
      timer=setTimeout(()=>{
        timer=null;if(disposed||!item.isConnected||!loading||img?.getAttribute('src')!==source)return;
        const stalled=img;img=null;loading=false;stalled.remove();stalled.removeAttribute('src');next();
      },8000);
    };
    item._fabricUpdateImages=updated=>{
      for(const url of (Array.isArray(updated.rejectedImageURLs)?updated.rejectedImageURLs:[]))if(typeof url==='string')rejected.add(url);
      for(let i=urls.length-1;i>=0;i--)if(rejected.has(urls[i]))urls.splice(i,1);
      if(img&&rejected.has(img.getAttribute('src'))){
        clearTimer();const revoked=img;img=null;loading=false;healthy=false;item.classList.remove('has-photo');revoked.remove();revoked.removeAttribute('src');
      }
      for(const url of photoCandidates(updated))if(!rejected.has(url)&&!urls.includes(url)&&urls.length<4)urls.push(url);
      next();if(img)img.alt=updated.title;
    };
    item._fabricUpdateImages(product);
  }
  // Photo evidence can arrive late. It updates the mounted image without
  // discarding a healthy photograph or restarting URLs that already failed.
  const cardSignature=p=>JSON.stringify([view,!!context.automatic,!!context.compactRail,p.url]);
  function card(p) {
    const item=node('article','fa-product');item.dataset.mayaPanel='inner';item._fabricURL=p.url;item._fabricSignature=cardSignature(p);item._fabricView=view;
    const link=node('a','fa-product-link');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';
    mountProductPhoto(item,link,p);
    const title=node('h3','fa-card-title',p.title);title.dataset.mayaType=context.compactRail?'P1':'H4';
    const caption=node('p','fa-card-caption');caption.dataset.mayaType='P3';
    item._fabricUpdateText=updated=>{
      p=updated;const knownPrice=p.price&&p.unit?`${p.price} ${p.currency} / ${p.unit}`:'';
      const use=[p.garment?'For '+p.garment:'',p.materialLabel].filter(Boolean).join(' · '),source=p.evidence==='atelier_inventory'?'Atelier inventory':p.merchant||'View fabric source';
      title.textContent=p.title;caption.textContent=[knownPrice,source].filter(Boolean).join(' · ');link.setAttribute('aria-label',[p.title,use,source,knownPrice,p.reason].filter(Boolean).join(' · '));
    };item._fabricUpdateText(p);
    if(context.compactRail){
      const copy=node('div','fa-card-copy'),unavailable=node('span','fa-preview-unavailable','Preview unavailable');unavailable.dataset.mayaType='P3';copy.append(unavailable,title,caption);link.append(copy);
      // First touch exposes the caption; a second activates the source/inspector.
      // Keyboard focus reveals the same content without changing link semantics.
      let touch=false;link.addEventListener('pointerdown',e=>{touch=e.pointerType==='touch'||e.pointerType==='pen';});
      link.addEventListener('click',e=>{if(!touch||e.detail===0)return;touch=false;if(item.classList.contains('is-revealed'))return;e.preventDefault();e.stopImmediatePropagation();for(const other of els.results.querySelectorAll('.is-revealed'))other.classList.remove('is-revealed');item.classList.add('is-revealed');link.focus({preventScroll:true});},{capture:true});
    }else link.append(title,caption);
    item.append(link);
    const controls=node('div','fa-card-actions');
    const favorite=icon('Save to studio favorites','M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',()=>toggleFavorite(p));
    favorite.classList.add('fa-favorite');if(context.compactRail)favorite.dataset.mayaShape='circle';controls.append(favorite);
    let removing=false,remove;
    if(view==='search'&&context.automatic){
      remove=icon('Remove this source','M6 6l12 12M18 6L6 18',async()=>{if(removing)return;removing=true;try{await dismiss(p,remove);}finally{removing=false;item._fabricUpdateControls?.();}});if(context.compactRail)remove.dataset.mayaShape='circle';controls.append(remove);
    }
    item._fabricUpdateControls=()=>{
      const saved=favorites.items.some(row=>row.url===p.url),label=saved?'Remove from studio favorites':'Save to studio favorites';
      favorite.setAttribute('aria-pressed',String(saved));favorite.setAttribute('aria-label',label);favorite.title=label;
      favorite.disabled=!account()||favoriteQueue.pending.has(p.url);
      if(remove)remove.disabled=removing||busy||!research;
    };
    item.append(controls);
    item._fabricUpdateControls?.();return item;
  }
  function reuseCard(old,product){
    if(old?._fabricSignature!==cardSignature(product))return card(product);
    old._fabricUpdateImages?.(product);old._fabricUpdateText?.(product);old._fabricUpdateControls?.();return old;
  }
  function paint() {
    showStatus();els.exportButton.hidden=!context.submissionId;
    els.search.setAttribute('aria-pressed',String(view==='search'));els.saved.setAttribute('aria-pressed',String(view==='saved'));els.inhouse.setAttribute('aria-pressed',String(view==='inhouse'));
    els.inhouse.hidden=false;els.fresh.hidden=!!context.automatic;els.form.hidden=view!=='search'||!!context.automatic;els.sub.hidden=!!context.automatic;
    workspace.classList.toggle('is-automatic',!!context.automatic);els.upload.hidden=!!context.automatic;
    els.input.rows=context.automatic?1:2;els.input.placeholder=context.automatic?'Refine these fabrics…':'Find the fabrics for this look…';
    els.stop.hidden=!busy;els.send.disabled=busy||searchState==='preparing';
    workspace.setAttribute('aria-busy',String(busy));
    const refreshLabel=view==='search'&&busy?'Stop fabric search':'Refresh fabrics';els.refresh.setAttribute('aria-label',refreshLabel);els.refresh.title=refreshLabel;
    els.details.setEnabled(view==='search'&&!context.automatic);
    els.filter.hidden=view!=='search'||!!context.automatic;if(view!=='search'||context.automatic){els.storeWrap.hidden=true;els.filter.setAttribute('aria-expanded','false');}
    for(const button of els.storeButtons){button.setAttribute('aria-pressed',String(activeStores.has(button.dataset.storeGroup)));button.disabled=searchState==='preparing';}
    const candidates=view==='saved'?favorites.items:view==='inhouse'?inventory():products;
    const allowed=new Set(storeGroups.filter(group=>activeStores.has(group.id)).flatMap(group=>group.hosts));
    const items=candidates.filter(p=>view!=='search'||searchMode==='worldwide'||(()=>{try{return allowed.has(new URL(p.url).hostname.replace(/^www\./,''));}catch{return false;}})());
    // Retained cards keep their actual image/link nodes through Refresh and
    // appended results. Rebuilding the grid made loaded photographs flicker.
    const existing=new Map([...els.results.children].filter(el=>el._fabricURL).map(el=>[el._fabricURL,el]));
    const cards=items.map(product=>{const key=cardSignature(product),mounted=existing.get(product.url),old=mounted?._fabricSignature===key?mounted:parkedCards.get(key);parkedCards.delete(key);return reuseCard(old,product);});
    // Keep retained source-only cards after usable photos, even when they were
    // inserted earlier in the stream or exhausted their image URLs later.
    if(view==='search'&&searchMode==='worldwide'){
      const missingPhoto=item=>Number(item.classList.contains('has-missing-photo')||!item.querySelector('.fa-product-image'));
      cards.sort((a,b)=>missingPhoto(a)-missingPhoto(b));
    }
    for(const item of cards)item.hidden=false;
    const keep=new Set(cards);for(const child of [...els.results.children])if(!keep.has(child))releaseCard(child);
    cards.forEach((el,index)=>{if(els.results.children[index]!==el)els.results.insertBefore(el,els.results.children[index]||null);});
    if(!items.length&&!(context.automatic&&view==='search')&&(view!=='search'||(!busy&&searchState!=='preparing'))&&!(view==='inhouse'&&inventoryRequest))els.results.append(node('p','fa-empty',view==='saved'?'Studio favorites appear here across every client and admin.':view==='inhouse'?(inventoryStatus||'No in-house fabrics yet.'):searchState==='interrupted'?'Search not completed. Refresh to retry.':searchState==='complete'?'No source-backed fabric suggestions yet.':context.automatic?'Ready to search this saved look.':'Describe a fabric or add a reference photo.'));
    els.transcript.hidden=view!=='search'||!!context.automatic;els.observation.hidden=view!=='search'||!!context.automatic;
  }
  async function chooseSearch(mode,group){
    if(mode===searchMode&&(mode==='worldwide'||activeStores.has(group))){view='search';paint();return;}
    if(searchState==='preparing')return;
    const previousRequest=submittedRequest,previousHistory=history;
    rememberResults();controller?.abort();searchSeq++;busy=false;
    searchMode=mode;activeStores=new Set(group?[group]:[]);filterTouched=mode==='retailers';
    products=[];history=[];submittedRequest='';lastSearchStores='';completedStatus='';searchDetails=null;searchState='idle';els.details.set(null);els.observation.textContent='';
    const restored=restoreResults();view='search';autoStarted=true;paint();
    if(!restored){submittedRequest=previousRequest;history=previousHistory;await run(true,true);}
  }
  async function refreshView(){
    // Retry only failed photographs on explicit Refresh; healthy loaded images stay mounted.
    for(const item of els.results.querySelectorAll('.has-missing-photo'))item._fabricSignature='';
    if(view==='saved')return loadFavorites(true);
    if(view==='inhouse'){try{if(context.loadInhouse){const stamp=epoch;const items=await context.loadInhouse();if(current(stamp)){context.inhouse=items;paint();}}else await loadInventory(true);}catch(e){inventoryStatus=e.message;showStatus();}return;}
    if(context.automatic&&!context.submissionId&&reopenSaved)return reopenSaved();
    if(searchState==='preparing')return;
    if(context.automatic&&!image){const stamp=epoch;try{image=await preparedPhoto(context.referenceImage);if(!current(stamp))return;}catch(e){return status(e.message);}}
    return run(true,!!submittedRequest);
  }
  async function run(force=false,filterOnly=false) {
    if(busy&&!force)return;
    if(force)controller?.abort();
    if (!account()) { reset(); paint(); return status('Sign in to Admin to search fabrics.'); }
    if (identity!==scope()) { reset(); identity=scope(); paint(); return status('Account changed. Start a new search.'); }
    try{await researchReady;if(context.automatic&&!research)throw Error('Saved research must load before searching. Reopen this item.');}catch(e){status(e.message);return;}
    if(searchMode==='retailers'&&!activeStores.size)return status('Choose a retailer search.');
    const request=(filterOnly||force?submittedRequest:els.input.value.trim())||(context.automatic?'Find sources for this selected item. For clothing find apparel fabric; for shoes or accessories find similar finished products.':'' );
    if (!request && !image) return status('Describe a fabric or add a photo.');
    recognition?.stop();
    const stamp=epoch, sequence=++searchSeq; controller=new AbortController(); const active=controller;
    const signal=AbortSignal.any([active.signal,AbortSignal.timeout(60000)]);
    const valid=()=>current(stamp)&&sequence===searchSeq;
    let retained=(context.automatic||filterOnly||request===submittedRequest)?products:[];
    if(!retained.length)resultCache.delete(resultKey());
    busy=true;searchState='searching';completedStatus=''; els.send.disabled=true; els.stop.hidden=false; view='search'; els.saveStatus.textContent='';
    products=retained;if(!retained.length){searchDetails=null;els.details.set(null);}paint();status('Searching for Fabrics');
    const submitted=request || 'Find fabrics like this photo';
    submittedRequest=submitted;
    const line=node('p','fa-request',submitted); els.transcript.append(line);
    while(els.transcript.children.length>6)els.transcript.firstElementChild.remove();
    if(!filterOnly)els.input.value='';
    let finished=false,published=[];
    try {
      const r=await waitForSignal(fetch('/api/admin/fabrics/search',{method:'POST',headers:headers(),signal,
        body:JSON.stringify({mode:searchMode,submissionId:context.submissionId||'',request:submitted,image,preferences:context.preferences||'',piece:pieceMetadata(context.piece),pieces:(context.pieces||[]).slice(0,12).map(pieceMetadata),automatic:!!context.automatic,...(searchMode==='retailers'?{stores:storeGroups.filter(group=>activeStores.has(group.id)).flatMap(group=>group.hosts)}:{}),history})}),signal);
      if(!r.ok){const data=await waitForSignal(r.json().catch(()=>({})),signal);throw Error(data.error || 'Fabric search failed. Try again.');}
      const reader=r.body.getReader(), decoder=new TextDecoder();let buffer='';
      const accept=raw=>{
        if(!raw.trim() || !valid())return;
        const event=JSON.parse(raw);
        if(event.type==='error')throw Error(event.message);
        if(event.searchDetails){searchDetails=event.searchDetails;els.details.set(searchDetails);}
        if(event.type==='status')status('Searching for Fabrics');
        if(event.type==='interpretation'){els.observation.textContent=event.observation||'';paint();}
        if(event.type==='products'&&event.incremental&&!event.preliminary){
          const removed=new Set(Array.isArray(event.removedUrls)?event.removedUrls:[]);
          if(removed.size){for(const url of removed)retracted.add(url);retained=retained.filter(p=>!removed.has(p.url));resultCache.delete(resultKey());}
          published=(Array.isArray(event.products)?event.products:[]).filter(p=>!removed.has(p.url));
          products=[...new Map([...retained,...published].map(p=>[p.url,p])).values()].slice(-100);paint();rememberResults();
        }
        if(event.type==='products' && event.preliminary)status('Searching for Fabrics');
        if(event.type==='done'){
          const confirmed=Array.isArray(event.products)?event.products:[];
          products=[...new Map([...retained,...confirmed.filter(p=>!retracted.has(p.url))].map(p=>[p.url,p])).values()].slice(-100);
          finished=true;searchState='complete';history.push({request:submitted,query:event.query});history=history.slice(-6);
          els.observation.textContent=event.observation?'Reference interpretation: '+event.observation:'';
          lastSearchStores=storeKey();completedStatus=event.warning || (retained.length&&!confirmed.length?'No additional matches. Previously loaded fabrics are kept.':event.message) || '';status(completedStatus);rememberResults();
        }
      };
      try {
        while(!finished){const{value,done}=await waitForSignal(reader.read(),signal);if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>512*1024)throw Error('Search response was too large.');let n;while(!finished&&(n=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,n));buffer=buffer.slice(n+1);}}
        if(!finished){buffer+=decoder.decode();if(buffer.trim())accept(buffer);}
      } finally { void reader.cancel().catch(()=>{}); }
      if(!finished)throw Error('Search ended early. You can retry your request.');
    } catch(e) {
      if(valid()){ searchState='interrupted';products=[...new Map([...retained,...published].map(p=>[p.url,p])).values()].slice(-100);autoStarted=products.length>0;const message=active.signal.aborted?'Search stopped.':e.name==='TimeoutError'?'Search timed out. Refresh to retry.':e.message;status(message);if(searchDetails){searchDetails={...searchDetails,stage:message};els.details.set(searchDetails);}rememberResults();if(!filterOnly&&!els.input.value)els.input.value=request; }
    } finally { if(valid()){if(context.automatic){try{await loadResearch(stamp);if(valid())rememberResults();}catch(e){if(valid())status(e.message);}}if(valid()){busy=false;els.send.disabled=false;els.stop.hidden=true;controller=null;paint();}} }
  }
  async function open(next={}) {
    make();
    rememberResults();
    const previousContext=context, prevIdentity=identity;
    context={...next};
    reopenSaved=typeof next.reopenSaved==='function'?next.reopenSaved:null;
    const nextIdentity=scope();
    const changed=next.forceReset||prevIdentity!==nextIdentity||(next.referenceImage&&next.referenceImage!==previousContext.referenceImage)||(next.preferences!==undefined&&next.preferences!==previousContext.preferences);
    if(next.silent&&!changed){context={...previousContext,...next};return;}
    if(changed){reset();identity=nextIdentity;}
    else {context={...previousContext,...next};context.referenceImage=context.referenceImage||previousContext.referenceImage;if(next.preferences===undefined)context.preferences=previousContext.preferences;}
    if(next.forceReset){for(const key of resultCache.keys())if(key.startsWith(scope()+'|'))resultCache.delete(key);preparedPhotos.delete(next.referenceImage);}
    let restored=changed&&!next.forceReset&&restoreResults();
    const stamp=epoch,preparationSequence=searchSeq;
    if(next.host instanceof HTMLElement){collapse();host=next.host;host.append(workspace);workspace.classList.add('is-inline');els.expand.textContent='Expand';}
    else if(!next.silent){host=null;expand();}
    syncLayout();workspace.hidden=!!next.silent;
    els.sub.textContent=next.submissionId?'This submission’s fabrics'+(next.piece?.name?' · '+next.piece.name:''):'Studio favorites are shared across the backend';
    if(changed&&!restored)searchState='preparing';
    paint();
    if(!account()){status('Sign in to Admin to search fabrics.');return;}
    // The book belongs to the project, so photo loading or garment changes must
    // not cancel its only hydration request.
    if(!restored)void loadBook();
    void loadFavorites();
    // Inventory must remain usable even if the private reference photo fails.
    void loadInventory().catch(()=>{});
    if(changed&&!restored)status(next.savedOnly?'':context.automatic?'Searching for Fabrics':'Describe what you need. A photo is optional.');
    els.send.disabled=true;
    try{
      if(context.automatic&&(changed||!research)){
        researchReady=loadResearch(stamp);const saved=await researchReady;if(!current(stamp)||preparationSequence!==searchSeq)return;
        if(saved&&(saved.searched||saved.items.length)){restored=true;autoStarted=true;searchState='complete';completedStatus=saved.items.length?'':'No saved sources. Refresh to search.';status(completedStatus);paint();rememberResults();}
      }
      if(changed&&!restored&&!next.savedOnly&&next.referenceImage){const value=await preparedPhoto(next.referenceImage);if(!current(stamp)||preparationSequence!==searchSeq)return;image=value;originalImage=next.referenceImage;paintPhoto();}
      if(!restored&&!next.savedOnly)await loadContext(stamp);if(!current(stamp)||preparationSequence!==searchSeq)return;
      if(searchState==='preparing'){searchState='idle';if(next.savedOnly)status('No saved fabric research yet. Refresh to search.');paint();}
      if(current(stamp)&&context.automatic&&!next.silent&&!next.savedOnly&&!autoStarted){autoStarted=true;await run();}
    }catch(e){if(current(stamp)){searchState='interrupted';status(e.message);paint();}}
    finally{if(current(stamp)&&!busy)els.send.disabled=false;}
    if(current(stamp)&&!next.silent&&!context.automatic)els.input.focus();
  }
  function guardAccount(){if(dialog && identity!==scope()){
    const previousSubmission=context.submissionId;
    context={automatic:!!context.automatic};reset();identity=scope();paint();els.sub.textContent='Fabric search';
    window.dispatchEvent(new CustomEvent('maya:fabric-selected',{detail:{submissionId:previousSubmission,product:null}}));
    window.dispatchEvent(new CustomEvent('maya:fabric-context',{detail:{submissionId:previousSubmission,referenceImage:''}}));
    status('Account changed. Start a new search.');
  }}
  window.addEventListener('storage',guardAccount);window.addEventListener('focus',guardAccount);window.addEventListener('maya-owner-session-changed',guardAccount);
  setInterval(()=>{if(dialog)guardAccount();},1000);
  window.MayaFabricAssistant={open,close,expand,prepare:next=>open({...next,silent:true}),reset:()=>{context={automatic:!!context.automatic};reset();identity=scope();if(els){els.sub.textContent='';paint();}},selection:piece=>{guardAccount();return selectedProduct(piece);},focusGarment:piece=>{guardAccount();if(!context.submissionId)return;rememberResults();context={...context,piece:pieceMetadata(piece)};if(identity!==scope()){reset();identity=scope();paint();notifySelection();}}};
})();
