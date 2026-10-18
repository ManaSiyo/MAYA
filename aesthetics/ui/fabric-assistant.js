/* One fabric conversation for the Brief and Operation Room. Private state is memory-only. */
(function () {
  'use strict';
  let dialog, workspace, host, els, context = {}, identity = '', epoch = 0, controller, image = '', originalImage = '';
  let searchSeq=0, autoStarted=false, storeFilter='';
  let history = [], products = [], book = { items: [], selectedUrl: '', generation: null }, view = 'search', busy = false;
  let bookSeq = 0, photoSeq = 0, projectEpoch=0, projectIdentity='', reads=new AbortController(),projectReads=new AbortController();
  let saves={tail:Promise.resolve(),pending:new Set()},inventoryRequest=null;
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
  function action(label, fn) { const b = node('button','pill maya-pill',label); b.type = 'button'; b.addEventListener('click',fn); return b; }
  function status(message) { els.status.textContent = message || ''; }
  function reset() {
    epoch++;photoSeq++;searchSeq++;autoStarted=false;storeFilter='';controller?.abort();recognition?.stop();reads.abort();reads=new AbortController();inventoryRequest=null;
    const nextProject=projectScope();if(nextProject!==projectIdentity){bookSeq++;projectReads.abort();projectReads=new AbortController();projectEpoch++;projectIdentity=nextProject;saves={tail:Promise.resolve(),pending:new Set()};book={items:[],selectedUrl:'',selectedByGarment:{},generation:null};}
    controller=null;busy=false;history=[];products=[];image='';originalImage='';view='search';
    if(els){els.input.value='';els.observation.textContent='';els.transcript.replaceChildren();els.results.replaceChildren();els.photo.hidden=true;els.preview.removeAttribute('src');els.file.value='';els.send.disabled=false;els.stop.hidden=true;els.saveStatus.textContent='';els.store.value='';status('');}
  }
  function icon(label,path,fn) {
    const b=action('',fn);b.classList.add('maya-icon-button');b.setAttribute('aria-label',label);b.title=label;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');
    const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);b.append(svg);return b;
  }
  function collapse() {
    if(dialog.open)dialog.close();
    if(host?.isConnected){host.append(workspace);workspace.classList.add('is-inline');}
    els.expand.textContent='Expand';els.expand.setAttribute('aria-expanded','false');
  }
  function expand() {
    if(dialog.open && host)return collapse();
    workspace.classList.remove('is-inline');dialog.append(workspace);workspace.hidden=false;
    if(!dialog.open)dialog.showModal();els.expand.textContent=host?'Collapse':'Close';els.expand.setAttribute('aria-expanded','true');
  }
  function close() {
    if(busy)autoStarted=false;
    controller?.abort();recognition?.stop();searchSeq++;busy=false;
    if(!workspace)return;
    collapse();workspace.hidden=true;els.send.disabled=false;els.stop.hidden=true;
  }
  function make() {
    if (dialog) return;
    dialog=node('dialog','fabric-assistant-dialog');dialog.id='fabric-assistant-dialog';dialog.setAttribute('aria-labelledby','fabric-assistant-title');document.body.append(dialog);
    workspace=node('section','fabric-assistant maya-surface');workspace.id='fabric-assistant';workspace.dataset.mayaSurface='outer';
    const header=node('header','fa-header');
    const title=node('h2','', 'Fabrics');title.id='fabric-assistant-title';
    const toolbar=node('div','fa-toolbar');
    const refresh=icon('Refresh fabrics','M20 7v5h-5M20 12a8 8 0 1 0-2 5',()=>refreshView());
    const expandButton=action('Expand',()=>host?expand():close());expandButton.setAttribute('aria-expanded','false');
    toolbar.append(refresh,expandButton);header.append(title,toolbar);
    const sub=node('p','fa-context');
    const tabs=node('nav','fa-tabs');tabs.setAttribute('aria-label','Fabric views');
    const inhouse=action('In House',()=>{view='inhouse';paint();});
    const search=action('Sourceable',()=>{view='search';paint();});
    const saved=action('Favorites',async()=>{view='saved';paint();await loadBook();});
    const fresh=action('New search',()=>open({...context,forceReset:true}));
    const filter=icon('Filter stores','M4 5h16M7 12h10M10 19h4',()=>{storeWrap.hidden=!storeWrap.hidden;filter.setAttribute('aria-expanded',String(!storeWrap.hidden));if(!storeWrap.hidden)store.focus();});filter.setAttribute('aria-expanded','false');
    const storeWrap=node('label','fa-store-wrap','Store');storeWrap.hidden=true;
    const store=node('select','fa-store-filter');store.dataset.mayaControl='field';store.setAttribute('aria-label','Fabric store');
    for(const[name,value]of [['All stores',''],['Britex Fabrics','britexfabrics.com'],['Stonemountain & Daughter','stonemountainfabric.com'],['Harts Fabric','hartsfabric.com'],['Amazon','amazon.com'],['Mood Fabrics','www.moodfabrics.com'],['Blackbird Fabrics','www.blackbirdfabrics.com'],['The Fabric Store','thefabricstore.com'],['Tessuti Fabrics','www.tessuti.com.au']]){const option=node('option','',name);option.value=value;store.append(option);}
    store.addEventListener('change',()=>{storeFilter=store.value;paint();if(context.automatic&&view==='search')run(true);});storeWrap.append(store);
    tabs.append(inhouse,search,saved,filter,fresh);
    const body=node('div','fa-body');body.dataset.mayaScrollbar='visible';body.tabIndex=0;body.setAttribute('aria-label','Fabric results');
    const transcript=node('div','fa-transcript');transcript.setAttribute('aria-label','Your requests');
    const observation=node('p','fa-observation'),results=node('div','fa-results'),saveStatus=node('p','fa-save-status');saveStatus.setAttribute('role','status');body.append(transcript,observation,results,saveStatus);
    const form=node('form','fa-composer');
    const photo=node('div','fa-photo');photo.hidden=true;
    const preview=node('img');preview.alt='Original look reference';photo.append(preview,action('Remove photo',()=>{image='';paintPhoto();}));
    const label=node('label','fa-input-label','Describe the fabric');label.htmlFor='fabric-request';
    const input=node('textarea');input.id='fabric-request';input.rows=2;input.maxLength=1200;input.dataset.mayaControl='field';input.placeholder='A matte burgundy wool, preferably local…';
    const row=node('div','fa-actions'),file=node('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    const upload=action('Add photo',()=>file.click());file.addEventListener('change',()=>attach(file.files?.[0]));
    const mic=action('Dictate',dictate);mic.hidden=!(window.SpeechRecognition||window.webkitSpeechRecognition);
    const send=node('button','pill maya-pill','Find fabric');send.type='submit';
    const stop=action('Stop',()=>controller?.abort());stop.hidden=true;row.append(upload,mic,send,stop,file);form.append(photo,label,input,row);
    const live=node('p','fa-status');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
    form.addEventListener('submit',e=>{e.preventDefault();run();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!busy)run();}});
    input.addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));if(f){e.preventDefault();attach(f);}});
    workspace.append(header,sub,tabs,storeWrap,body,form,live);dialog.append(workspace);
    dialog.addEventListener('close',()=>{if(host?.isConnected){host.append(workspace);workspace.classList.add('is-inline');els.expand.textContent='Expand';els.expand.setAttribute('aria-expanded','false');}else{controller?.abort();recognition?.stop();}});
    els={sub,search,saved,inhouse,fresh,store,storeWrap,filter,refresh,expand:expandButton,form,input,file,send,stop,status:live,observation,results,transcript,photo,preview,saveStatus,mic,body};
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
  async function attach(file) {
    if (!file) return;
    const stamp=epoch, photoRequest=++photoSeq;
    try { const value=await photoData(file); if (!current(stamp) || photoRequest!==photoSeq) return; image=value; paintPhoto(); status('Photo added. Add a description or press Find fabric.'); }
    catch (e) { if (current(stamp)) status(e.message); }
    els.file.value='';
  }
  function paintPhoto() { els.photo.hidden=!image; if (image) els.preview.src=image; else els.preview.removeAttribute('src'); }
  async function loadInventory(force=false) {
    if(Array.isArray(context.inhouse)&&!force)return;
    if(inventoryRequest&&!force)return inventoryRequest;
    const stamp=epoch,signal=AbortSignal.any([reads.signal,AbortSignal.timeout(6000)]);
    const task=(async()=>{
      const response=await fetch('/aesthetics/fabrics/fabrics.json',{cache:force?'no-store':'default',signal});
      if(!response.ok)throw Error('In-house photos unavailable.');
      const data=await response.json();if(!current(stamp))return;
      context.inhouse=(data.items||[]).filter(p=>typeof p.fileName==='string'&&!/[\\/]/.test(p.fileName)&&/\.(?:png|jpe?g|webp)$/i.test(p.fileName)).map(p=>({title:p.name||p.fileName,image:'/aesthetics/fabrics/'+encodeURIComponent(p.fileName),description:[p.weave,p.weight,p.color].filter(Boolean).join(' · ')}));
      paint();
    })();inventoryRequest=task;try{await task;}finally{if(inventoryRequest===task)inventoryRequest=null;}
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
    const ticket=projectTicket(),sequence=++bookSeq;
    if(!context.submissionId){if(view==='saved')status('Open a submission to save fabrics.');return;}
    try{
      const data=await json('/api/admin/fabrics/lookbook?submissionId='+encodeURIComponent(context.submissionId),{signal:AbortSignal.any([projectReads.signal,AbortSignal.timeout(10000)])});
      if(!projectCurrent(ticket)||(!forSave&&sequence!==bookSeq))return;
      book=data;paint();notifySelection();
    }catch(e){if(projectCurrent(ticket)&&sequence===bookSeq)els.saveStatus.textContent=e.message;}
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
        book=data;paint();notifySelection();els.saveStatus.textContent=actionName==='remove'?'Removed.':actionName==='select'?'Selected: '+(garmentName||'this look')+'.':'Saved'+(garmentName?': '+garmentName:'')+'.';
      }catch(e){if(projectCurrent(ticket)){book.generation=null;els.saveStatus.textContent=e.name==='TimeoutError'?'Save not confirmed. Check Favorites before retrying.':e.message;await loadBook(true);}}
    };
    queue.tail=queue.tail.catch(()=>{}).then(task).finally(()=>{queue.pending.delete(key);button.removeAttribute('aria-busy');button.disabled=false;if(projectCurrent(ticket))paint();});return queue.tail;
  }
  function inventory() {
    return (context.inhouse||[]).map(p=>({...p,url:p.url&&p.url!=='#'?p.url:(p.image||p.img||''),image:p.image||p.img||'',evidence:'atelier_inventory',price:'',unit:'',availability:'unknown',garment:p.garment||''})).filter(p=>p.image && p.url);
  }
  function card(p) {
    const item=node('article','fa-product');item.dataset.mayaPanel='inner';
    const local=p.evidence==='atelier_inventory';
    const link=node('a','fa-product-link');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';
    const knownPrice=p.price&&p.unit?`${p.price} ${p.currency} / ${p.unit}`:'';
    link.title=[p.title,p.description,knownPrice,p.reason].filter(Boolean).join(' — ');
    if(p.image && /^(?:https:\/\/|\/aesthetics\/fabrics\/|data:image\/)/.test(p.image)){
      const img=node('img','fa-product-image');img.src=p.image;img.alt=p.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{if(view==='saved'){img.remove();const unavailable=node('p','fa-image-unavailable','Photo unavailable');unavailable.dataset.mayaType='P3';link.prepend(unavailable);item.classList.add('has-missing-photo');}else{item.remove();if(!els.results.querySelector('.fa-product'))els.results.append(node('p','fa-empty','Fabric photos could not load. Refresh or try another store.'));}},{once:true});link.append(img);
    }
    const title=node('h3','fa-card-title',p.title);title.title=p.title;
    const use=p.garment?'For '+p.garment:'';
    const caption=node('p','fa-card-caption',[use,local?'':p.merchant].filter(Boolean).join(' · ')||(local?'Availability not recorded':'Delivery unconfirmed'));caption.dataset.mayaType='P3';caption.title=[caption.textContent,knownPrice,p.availability==='in_stock'?'Seller lists in stock':'Availability unconfirmed','Delivery unconfirmed'].filter(Boolean).join(' · ');
    link.append(title,caption);item.append(link);
    const controls=node('div','fa-card-actions');const exists=book.items.some(v=>v.url===p.url);
    const pending=actionName=>saves.pending.has(actionName+'|'+p.url+'|'+(context.piece?.id||p.garmentId||''));
    const saveButton=action(exists?'Saved':'Save',()=>save(p,'save',saveButton));saveButton.disabled=pending('save')||exists||!context.submissionId||!/^https:|^\/aesthetics\/fabrics\//.test(p.url);
    const selected=selectedProduct()?.url===p.url;
    const choose=action(selected?'Selected':'Use',()=>save(p,'select',choose));choose.setAttribute('aria-label',selected?'Selected for design':'Use for design');choose.disabled=pending('select')||selected||saveButton.disabled&&!exists;
    controls.append(saveButton,choose);
    if(view==='saved'){const remove=action('Remove',()=>save(p,'remove',remove));controls.append(remove);}
    item.append(controls);return item;
  }
  function paint() {
    els.search.setAttribute('aria-pressed',String(view==='search'));els.saved.setAttribute('aria-pressed',String(view==='saved'));els.inhouse.setAttribute('aria-pressed',String(view==='inhouse'));
    els.inhouse.hidden=false;els.fresh.hidden=!!context.automatic;els.form.hidden=!!context.automatic;els.sub.hidden=!!context.automatic;
    els.filter.hidden=view==='inhouse';if(view==='inhouse')els.storeWrap.hidden=true;
    const candidates=view==='saved'?book.items:view==='inhouse'?inventory():products;
    const items=candidates.filter(p=>!storeFilter||view==='inhouse'||(()=>{try{return new URL(p.url).hostname.replace(/^www\./,'')===storeFilter.replace(/^www\./,'');}catch{return false;}})());
    els.results.replaceChildren(...items.map(card));
    if(!items.length)els.results.append(node('p','fa-empty',view==='saved'?'Saved fabrics for this submission will appear here.':view==='inhouse'?'No in-house fabric photos are available.':context.automatic?'No relevant fabric products confirmed yet.':'Describe a fabric or add a reference photo.'));
    els.transcript.hidden=view!=='search'||!!context.automatic;els.observation.hidden=view!=='search'||!!context.automatic;
  }
  async function refreshView(){
    if(view==='saved')return loadBook();
    if(view==='inhouse'){try{if(context.loadInhouse){const stamp=epoch;const items=await context.loadInhouse();if(current(stamp)){context.inhouse=items;paint();}}else await loadInventory(true);}catch(e){status(e.message);}return;}
    return run(true);
  }
  async function run(force=false) {
    if(busy&&!force)return;
    if(force)controller?.abort();
    if (!account()) { reset(); paint(); return status('Sign in to Admin to search fabrics.'); }
    if (identity!==scope()) { reset(); identity=scope(); paint(); return status('Account changed. Start a new search.'); }
    const request=context.automatic?'Find fabrics for this saved look.':els.input.value.trim()||(force?history.at(-1)?.request||'':'');
    if (!request && !image) return status('Describe a fabric or add a photo.');
    recognition?.stop();
    const stamp=epoch, sequence=++searchSeq; controller=new AbortController(); const active=controller;
    const valid=()=>current(stamp)&&sequence===searchSeq;
    busy=true; els.send.disabled=true; els.stop.hidden=false; view='search'; els.saveStatus.textContent='';
    products=[]; paint(); status('Searching fabric shops…');
    const submitted=request || 'Find fabrics like this photo';
    const line=node('p','fa-request',submitted); els.transcript.append(line);
    while(els.transcript.children.length>6)els.transcript.firstElementChild.remove();
    els.input.value='';
    let finished=false;
    try {
      const r=await fetch('/api/admin/fabrics/search',{method:'POST',headers:headers(),signal:active.signal,
        body:JSON.stringify({submissionId:context.submissionId||'',request:submitted,image,preferences:context.preferences||'',piece:pieceMetadata(context.piece),pieces:(context.pieces||[]).slice(0,12).map(pieceMetadata),automatic:!!context.automatic,stores:storeFilter?[storeFilter]:[],history})});
      if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error || 'Fabric search failed. Try again.');}
      const reader=r.body.getReader(), decoder=new TextDecoder();let buffer='';
      const accept=raw=>{
        if(!raw.trim() || !valid())return;
        const event=JSON.parse(raw);
        if(event.type==='error')throw Error(event.message);
        if(event.products){products=event.products;paint();}
        if(event.type==='status')status(event.message);
        if(event.type==='products' && event.preliminary)status('Initial retailer results. Finding closer matches…');
        if(event.type==='done'){
          finished=true;history.push({request:submitted,query:event.query});history=history.slice(-6);
          els.observation.textContent=event.observation?'Reference interpretation: '+event.observation:'';
          status(event.warning || event.message);
        }
      };
      while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>512*1024)throw Error('Search response was too large.');let n;while((n=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,n));buffer=buffer.slice(n+1);}}
      buffer+=decoder.decode();if(buffer.trim())accept(buffer);
      if(!finished)throw Error('Search ended early. You can retry your request.');
    } catch(e) {
      if(valid()){ status(active.signal.aborted?'Search stopped.':e.message); if(!els.input.value)els.input.value=request; }
    } finally { if(valid()){busy=false;els.send.disabled=false;els.stop.hidden=true;controller=null;} }
  }
  async function open(next={}) {
    make();
    const previousContext=context, prevIdentity=identity;
    context={...next};
    const nextIdentity=scope();
    const changed=next.forceReset||prevIdentity!==nextIdentity||(next.referenceImage&&next.referenceImage!==originalImage);
    if(next.silent&&!changed){context={...previousContext,...next};return;}
    if(changed){reset();identity=nextIdentity;}
    else {context.referenceImage=context.referenceImage||previousContext.referenceImage;context.preferences=context.preferences||previousContext.preferences;}
    const stamp=epoch;
    if(next.host instanceof HTMLElement){collapse();host=next.host;host.append(workspace);workspace.classList.add('is-inline');els.expand.textContent='Expand';}
    else if(!next.silent){host=null;expand();}
    workspace.hidden=!!next.silent;
    els.sub.textContent=next.submissionId?'This submission’s fabrics'+(next.piece?.name?' · '+next.piece.name:''):'Open a submission to save favorites';
    paint();
    if(!account()){status('Sign in to Admin to search fabrics.');return;}
    // The book belongs to the project, so photo loading or garment changes must
    // not cancel its only hydration request.
    void loadBook();
    if(changed)status(context.automatic?'Loading the saved look…':'Describe what you need. A photo is optional.');
    els.send.disabled=true;
    try{
      if(changed&&next.referenceImage){const value=await photoData(next.referenceImage);if(!current(stamp))return;image=value;originalImage=next.referenceImage;paintPhoto();}
      await loadContext(stamp);if(!current(stamp))return;
      void loadInventory().catch(e=>{if(current(stamp)&&view==='inhouse')status(e.name==='TimeoutError'?'In-house photos timed out. Refresh to retry.':e.message);});
      if(current(stamp)&&context.automatic&&!next.silent&&!autoStarted){autoStarted=true;await run();}
    }catch(e){if(current(stamp))status(e.message);}
    finally{if(current(stamp)&&!busy)els.send.disabled=false;}
    if(current(stamp)&&!next.silent&&!context.automatic)els.input.focus();
  }
  function guardAccount(){if(dialog && identity!==scope()){
    const previousSubmission=context.submissionId;
    context={};reset();identity=scope();paint();els.sub.textContent='Fabric search';
    window.dispatchEvent(new CustomEvent('maya:fabric-selected',{detail:{submissionId:previousSubmission,product:null}}));
    window.dispatchEvent(new CustomEvent('maya:fabric-context',{detail:{submissionId:previousSubmission,referenceImage:''}}));
    status('Account changed. Start a new search.');
  }}
  window.addEventListener('storage',guardAccount);window.addEventListener('focus',guardAccount);window.addEventListener('maya-owner-session-changed',guardAccount);
  setInterval(()=>{if(dialog)guardAccount();},1000);
  window.MayaFabricAssistant={open,close,expand,prepare:next=>open({...next,silent:true}),reset:()=>{context={};reset();identity=scope();if(els){els.sub.textContent='';paint();}},selection:piece=>{guardAccount();return selectedProduct(piece);},focusGarment:piece=>{guardAccount();if(!context.submissionId)return;context={...context,piece:pieceMetadata(piece)};if(identity!==scope()){reset();identity=scope();paint();notifySelection();}}};
})();
