/* One fabric conversation for the Brief and Operation Room. Private state is memory-only. */
(function () {
  'use strict';
  let dialog, els, context = {}, identity = '', epoch = 0, controller, image = '', originalImage = '';
  let history = [], products = [], book = { items: [], selectedUrl: '', generation: null }, view = 'search', busy = false;
  let bookSeq = 0, photoSeq = 0, saving = false;
  const token = () => localStorage.getItem('maya_admin_tok') || localStorage.getItem('maya_google_token') || '';
  function account() {
    try { const p = JSON.parse(atob(token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.exp * 1000 > Date.now() ? String(p.sub || '') : ''; }
    catch (_) { return ''; }
  }
  const scope = () => account() + '|' + (context.submissionId || 'unsaved') + '|' + (context.piece?.name || '');
  const current = stamp => stamp === epoch && identity === scope() && !!account();
  const node = (tag, className, value) => { const n = document.createElement(tag); if (className) n.className = className; if (value != null) n.textContent = value; return n; };
  function action(label, fn) { const b = node('button','pill maya-pill',label); b.type = 'button'; b.addEventListener('click',fn); return b; }
  function status(message) { els.status.textContent = message || ''; }
  function reset() {
    epoch++; bookSeq++; photoSeq++; saving=false; controller?.abort(); recognition?.stop(); controller = null; busy = false; history = []; products = [];
    book = { items: [], selectedUrl: '', generation: null }; image = ''; originalImage = ''; view = 'search';
    if (els) { els.input.value = ''; els.observation.textContent = ''; els.transcript.replaceChildren(); els.results.replaceChildren(); els.photo.hidden = true; els.file.value = ''; els.send.disabled = false; els.stop.hidden = true; els.saveStatus.textContent = ''; }
  }
  function make() {
    if (dialog) return;
    dialog = node('dialog','fabric-assistant maya-surface'); dialog.id = 'fabric-assistant'; dialog.setAttribute('aria-labelledby','fabric-assistant-title');
    const header = node('header','fa-header');
    const title = node('h2','gallery-section-title', 'Fabrics'); title.id = 'fabric-assistant-title';
    const close = action('Close', () => dialog.close());
    header.append(title,close);
    const sub = node('p','fa-context');
    const tabs = node('nav','fa-tabs'); tabs.setAttribute('aria-label','Fabric views');
    const search = action('Find fabric', () => { view='search'; paint(); });
    const saved = action('Lookbook', async () => { view='saved'; paint(); await loadBook(); });
    const inhouse = action('In-house', () => { dialog.close(); context.onInhouse?.(); });
    const fresh = action('New search', () => open({ ...context, forceReset:true }));
    tabs.append(search,saved,fresh,inhouse);
    const body = node('div','fa-body');
    const transcript = node('div','fa-transcript'); transcript.setAttribute('aria-label','Your requests');
    const observation = node('p','fa-observation');
    const results = node('div','fa-results');
    const saveStatus = node('p','fa-status'); saveStatus.setAttribute('role','status');
    body.append(transcript,observation,results,saveStatus);
    const form = node('form','fa-composer');
    const photo = node('div','fa-photo'); photo.hidden = true;
    const preview = node('img'); preview.alt = 'Fabric search reference';
    photo.append(preview, action('Remove photo', () => { image=''; paintPhoto(); }));
    const label = node('label','fa-input-label','Tell MAYA what fabric you need'); label.htmlFor='fabric-request';
    const input = node('textarea'); input.id='fabric-request'; input.rows=2; input.maxLength=1200;
    input.placeholder='Find a matte burgundy wool like this, preferably local…';
    const row = node('div','fa-actions');
    const file = node('input'); file.type='file'; file.accept='image/jpeg,image/png,image/webp'; file.hidden=true;
    const upload = action('Add photo', () => file.click());
    file.addEventListener('change', () => attach(file.files?.[0]));
    const mic = action('Dictate', dictate);
    mic.hidden = !(window.SpeechRecognition || window.webkitSpeechRecognition);
    const send = node('button','pill maya-pill','Find fabric'); send.type='submit';
    const stop = action('Stop', () => { controller?.abort(); }); stop.hidden=true;
    row.append(upload,mic,send,stop,file);
    const live = node('p','fa-status'); live.setAttribute('role','status'); live.setAttribute('aria-live','polite');
    form.append(photo,label,input,row,live);
    form.addEventListener('submit', e => { e.preventDefault(); run(); });
    input.addEventListener('keydown', e => { if (e.key==='Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) run(); } });
    input.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) { e.preventDefault(); attach(f); } });
    dialog.append(header,sub,tabs,body,form); document.body.append(dialog);
    dialog.addEventListener('close', () => { controller?.abort(); recognition?.stop(); });
    els = { sub, search, saved, inhouse, input, file, send, stop, status:live, observation, results, transcript, photo, preview, saveStatus, mic, body };
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
    const r = await fetch(url, { ...options, headers: headers(), cache:'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(data.error || 'Request failed. Try again.');
    return data;
  }
  async function photoData(source) {
    if (!source) return '';
    const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
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
      hero ? fetch('/api/admin/subfile?id='+encodeURIComponent(hero.id),{headers:headers()}).then(r=>{if(!r.ok)throw Error('Reference photo could not load.');return r.blob();}).then(photoData) : '',
    ]);
    if (!current(stamp)) return;
    context.preferences=preferences; context.referenceImage=reference; image=originalImage=reference; paintPhoto();
    window.dispatchEvent(new CustomEvent('maya:fabric-context',{detail:{submissionId:context.submissionId,referenceImage:reference}}));
  }
  async function loadBook() {
    if(saving)return;
    const stamp=epoch, sequence=++bookSeq;
    if (!context.submissionId) { if(view==='saved')status('Open a submission to save and select fabrics.'); return; }
    try {
      const data=await json('/api/admin/fabrics/lookbook?submissionId='+encodeURIComponent(context.submissionId));
      if (!current(stamp) || sequence!==bookSeq) return;
      book=data; paint(); notifySelection();
    } catch(e) { if(current(stamp))els.saveStatus.textContent=e.message; }
  }
  function notifySelection() {
    const selected=book.items.find(p=>p.url===book.selectedUrl) || null;
    window.dispatchEvent(new CustomEvent('maya:fabric-selected',{detail:{submissionId:context.submissionId,product:selected}}));
  }
  async function save(product, actionName, button) {
    const stamp=epoch;
    if(saving)return;
    if (!context.submissionId) return status('Open a submission to save this fabric.');
    if (book.generation===null) { await loadBook(); if (!current(stamp) || book.generation===null) return; }
    saving=true;bookSeq++;button.disabled=true;
    try {
      const data=await json('/api/admin/fabrics/lookbook',{method:'POST',body:JSON.stringify({submissionId:context.submissionId,generation:book.generation,action:actionName,product:{...product,garment:context.piece?.name || ''}})});
      if (!current(stamp)) return;
      book=data; paint(); notifySelection(); els.saveStatus.textContent=actionName==='remove'?'Removed from lookbook.':actionName==='select'?'Selected for this design.':'Saved to this submission’s lookbook.';
    } catch(e) { if(current(stamp)){saving=false;els.saveStatus.textContent=e.message; await loadBook();} }
    finally { if(current(stamp))saving=false;button.disabled=false; }
  }
  function card(p) {
    const item=node('article','fa-product panel');
    const link=node('a','fa-product-link'); link.href=p.url; link.target='_blank'; link.rel='noopener noreferrer';
    if (p.image && /^https:\/\//.test(p.image)) { const img=node('img','fa-product-image'); img.src=p.image; img.alt=p.title; img.loading='lazy'; img.referrerPolicy='no-referrer'; img.addEventListener('error',()=>img.remove(),{once:true}); link.append(img); }
    link.append(node('h3','section-title',p.title)); item.append(link,node('p','fa-merchant',p.merchant+' · '+p.place));
    const price = p.price && p.unit ? `${p.price} ${p.currency} / ${p.unit}` : 'Price / selling unit: check listing';
    item.append(node('p','',price));
    const stock={in_stock:'Listed in stock',out_of_stock:'Listed out of stock',preorder:'Preorder / backorder',unknown:'Availability unconfirmed'}[p.availability] || 'Availability unconfirmed';
    item.append(node('p','fa-evidence',stock+(p.checkedAt?' · checked '+new Date(p.checkedAt).toLocaleDateString():'')));
    if(p.description) { const d=node('details'); d.append(node('summary','','Seller description'),node('p','',p.description)); item.append(d); }
    if(p.reason) item.append(node('p','fa-reason','Why it may match: '+p.reason));
    if(p.evidence==='search_link')item.append(node('p','fa-evidence','Search found this link; seller details could not be checked.'));
    const controls=node('div','fa-card-actions');
    const exists=book.items.some(v=>v.url===p.url);
    const saveButton=action(exists?'Saved':'Save',()=>save(p,'save',saveButton)); saveButton.disabled=exists || !context.submissionId;
    const choose=action(book.selectedUrl===p.url?'Selected':'Use for design',()=>save(p,'select',choose)); choose.disabled=book.selectedUrl===p.url || !context.submissionId;
    controls.append(saveButton,choose);
    if(view==='saved') { const remove=action('Remove',()=>save(p,'remove',remove)); controls.append(remove); }
    item.append(controls); return item;
  }
  function paint() {
    els.search.setAttribute('aria-pressed',String(view==='search')); els.saved.setAttribute('aria-pressed',String(view==='saved'));
    els.inhouse.hidden=!context.onInhouse;
    const items=view==='saved'?book.items:products;
    els.results.replaceChildren(...items.map(card));
    if(!items.length)els.results.append(node('p','fa-empty',view==='saved'?'Saved fabrics will appear here.':'Describe a fabric or use a reference photo. MAYA will search the shops for you.'));
    els.transcript.hidden=view==='saved'; els.observation.hidden=view==='saved';
  }
  async function run() {
    if (busy) return;
    if (!account()) { reset(); paint(); return status('Sign in to Admin to search fabrics.'); }
    if (identity!==scope()) { reset(); identity=scope(); paint(); return status('Account changed. Start a new search.'); }
    const request=els.input.value.trim();
    if (!request && !image) return status('Describe a fabric or add a photo.');
    recognition?.stop();
    const stamp=epoch; controller=new AbortController(); const active=controller;
    busy=true; els.send.disabled=true; els.stop.hidden=false; view='search'; els.saveStatus.textContent='';
    products=[]; paint(); status('Searching fabric shops…');
    const submitted=request || 'Find fabrics like this photo';
    const line=node('p','fa-request',submitted); els.transcript.append(line);
    while(els.transcript.children.length>6)els.transcript.firstElementChild.remove();
    els.input.value='';
    let finished=false;
    try {
      const r=await fetch('/api/admin/fabrics/search',{method:'POST',headers:headers(),signal:active.signal,
        body:JSON.stringify({submissionId:context.submissionId || '',request:submitted,image,preferences:context.preferences || '',piece:context.piece || {},history})});
      if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error || 'Fabric search failed. Try again.');}
      const reader=r.body.getReader(), decoder=new TextDecoder();let buffer='';
      const accept=raw=>{
        if(!raw.trim() || !current(stamp))return;
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
      if(current(stamp)){ status(active.signal.aborted?'Search stopped.':e.message); if(!els.input.value)els.input.value=request; }
    } finally { if(current(stamp)){busy=false;els.send.disabled=false;els.stop.hidden=true;controller=null;} }
  }
  async function open(next={}) {
    make();
    const prevIdentity=identity;
    const previousContext=context;
    context={...next};
    const nextIdentity=scope();
    const changed=next.forceReset || prevIdentity!==nextIdentity || (next.referenceImage && next.referenceImage!==originalImage);
    if(changed){reset();identity=nextIdentity;}
    else { context.referenceImage=context.referenceImage || previousContext.referenceImage; context.preferences=context.preferences || previousContext.preferences; }
    const stamp=epoch;
    els.sub.textContent=next.submissionId?'This submission’s fabrics'+(next.piece?.name?' · '+next.piece.name:''):'Fabric search · open a submission to save a lookbook';
    paint(); if(!next.silent && !dialog.open)dialog.showModal();
    if(!account()){status('Sign in to Admin to search fabrics.');return;}
    status('Describe what you need. A photo is optional.');
    els.send.disabled=true;
    try{
      if(changed && next.referenceImage){const value=await photoData(next.referenceImage);if(!current(stamp))return;image=value;originalImage=next.referenceImage;paintPhoto();}
      await loadContext(stamp); if(!current(stamp))return; loadBook();
    }catch(e){if(current(stamp))status(e.message);}
    finally {if(current(stamp)&&!busy)els.send.disabled=false;}
    if(current(stamp) && !next.silent)els.input.focus();
  }
  function guardAccount(){if(dialog && identity!==scope()){
    const previousSubmission=context.submissionId;
    reset();context={};identity=scope();paint();els.sub.textContent='Fabric search';
    window.dispatchEvent(new CustomEvent('maya:fabric-selected',{detail:{submissionId:previousSubmission,product:null}}));
    window.dispatchEvent(new CustomEvent('maya:fabric-context',{detail:{submissionId:previousSubmission,referenceImage:''}}));
    status('Account changed. Start a new search.');
  }}
  window.addEventListener('storage',guardAccount);window.addEventListener('focus',guardAccount);
  setInterval(()=>{if(dialog)guardAccount();},1000);
  window.MayaFabricAssistant={open,prepare:next=>open({...next,silent:true}),reset:()=>{reset();identity=scope();if(els)paint();},selection:()=>{guardAccount();return book.items.find(p=>p.url===book.selectedUrl)||null;}};
})();
