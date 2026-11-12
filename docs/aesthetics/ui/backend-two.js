/* Backend 2 is a separate shell around the Brief's existing saved-work contracts. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),frame=$('operations-embed'),drawer=$('clients-drawer');
 document.body.classList.add('backend-two');
 const screens=$('screens');screens.setAttribute('aria-label','Backend 2 snapshot');
 const bio=document.createElement('section');bio.id='backend-two-bio';bio.dataset.mayaScrollbar='visible';bio.setAttribute('role','tabpanel');
 bio.append(document.querySelector('.op-info-col'));
 const submissions=document.createElement('section');submissions.id='backend-two-submissions';submissions.setAttribute('role','tabpanel');submissions.append($('clients-count'),$('clients-list'));
 const settings=document.createElement('section');settings.id='backend-two-settings';settings.dataset.mayaScrollbar='visible';settings.setAttribute('role','tabpanel');
 const tabs=document.createElement('nav');tabs.className='backend-two-tabs pg-tabrow';tabs.dataset.mayaControl='segmented';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Workspace drawer');
 const panels={submissions,bio,settings};let activeTab='submissions',selectedGarment='';
 for(const [key,label]of [['submissions','Submissions'],['bio','Bio'],['settings','Settings']]){
  const button=document.createElement('button');button.className='maya-icon-button pg-tab';button.dataset.mayaShape='circle';button.dataset.mayaType='P3';button.dataset.mayaSegment='';button.type='button';button.setAttribute('aria-label',label);button.title=label;const paths={bio:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',submissions:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',settings:'M4 7h16M4 17h16M8 4v6M16 14v6'};button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';button.id='backend-two-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls',panels[key].id);panels[key].setAttribute('aria-labelledby',button.id);button.addEventListener('click',()=>selectTab(key));
  button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const list=Object.keys(panels),i=list.indexOf(key),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectTab(list[next]);tabs.children[next].focus();});tabs.append(button);
 }
 const tabTitle=document.createElement('span');tabTitle.className='pg-tabtitle';tabTitle.dataset.mayaType='H2';tabs.append(tabTitle);
 const title=drawer.querySelector('.drawer-title');title.dataset.mayaType='H2';title.textContent='Backend 2';title.hidden=true;title.after(tabs,submissions,bio,settings);
 drawer.querySelector('.drawer-meta-row').hidden=true;
 drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Backend 2 workspace');drawer.setAttribute('aria-modal','true');drawer.inert=true;
 function selectTab(key){
  activeTab=key;tabTitle.textContent={bio:'Bio',submissions:'Submissions',settings:'Settings'}[key];for(const [name,panel]of Object.entries(panels)){panel.hidden=name!==key;const b=$('backend-two-tab-'+name);b.tabIndex=name===key?0:-1;b.setAttribute('aria-selected',String(name===key));b.classList.toggle('on',name===key);b.setAttribute('aria-pressed',String(name===key));}
  if(key==='submissions'&&drawer.classList.contains('open'))void openClientsDrawer();
  if(key==='settings')syncSettings();
 }
 // Reuse the engine's actual handlers and fields; no second settings record or
 // model pipeline. A scope-bound mirror cannot act on a later garment/account.
 let bindings=[],submissionNavigation=0;
 const scopeMatches=data=>{const context=_piecesContext();return !!data&&data.account===context.account&&data.submissionId===context.sid&&data.local===context.local&&data.revision===_operationsRevision;};
 function mirrorKey(){const data=frame.contentWindow?.backendTwoContext?.();return scopeMatches(data)?JSON.stringify([data.account,data.submissionId,data.local,data.revision,data.garmentId||'']):null;}
 function syncSettings(){
  if(activeTab!=='settings')return;
  const doc=frame.contentDocument,source=doc?.getElementById('drawer'),key=mirrorKey();
  if(!source||key===null){bindings=[];settings.replaceChildren();settings.textContent='Open a submission to load pattern settings.';return;}
  const valid=original=>settings.dataset.scope===key&&mirrorKey()===key&&original.isConnected&&doc===frame.contentDocument;
  const mirror=originalRoot=>{
   const clone=originalRoot.cloneNode(true),originals=[originalRoot,...originalRoot.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
   originals.forEach((original,i)=>{
    const copy=copies[i];for(const attr of [...copy.attributes])if(/^on/i.test(attr.name))copy.removeAttribute(attr.name);
    if(copy.id)copy.id='b2-setting-'+copy.id;
    if(copy.htmlFor)copy.htmlFor='b2-setting-'+copy.htmlFor;
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(original.tagName)){
     copy.value=original.value;copy.checked=original.checked;copy.disabled=original.disabled;
     for(const event of ['input','change'])copy.addEventListener(event,()=>{if(!valid(original)||original.disabled)return;original.value=copy.value;original.checked=copy.checked;original.dispatchEvent(new frame.contentWindow.Event(event,{bubbles:true}));});
    }
    if(original.tagName==='BUTTON')copy.addEventListener('click',()=>{if(!valid(original)||original.disabled)return;original.click();queueMicrotask(()=>{copy.blur();syncSettings();});});
    bindings.push({original,copy});
   });return clone;
  };
  if(settings.dataset.scope===key&&settings.contains(document.activeElement)){
   // Keep the typing cursor, while reflecting save failures, locks, changed
   // history buttons and logic state. Engine history nodes are replaced on save.
   for(const {original,copy}of bindings){if(!original.isConnected||!settings.contains(copy))continue;
    if('disabled'in original)copy.disabled=original.disabled;
    copy.hidden=original.hidden;copy.className=original.className;copy.style.cssText=original.style.cssText;
    if(copy!==document.activeElement&&/^(INPUT|SELECT|TEXTAREA)$/.test(original.tagName)){copy.value=original.value;copy.checked=original.checked;}
    if(original.getAttribute('role')==='status'||original.classList.contains('kb-status'))copy.textContent=original.textContent;
   }
   for(const id of ['pattern-history','logic-chips']){const original=doc.getElementById(id),copy=$('b2-setting-'+id);if(original&&copy)copy.replaceWith(mirror(original));}
   bindings=bindings.filter(({copy})=>settings.contains(copy));return;
  }
  const same=settings.dataset.scope===key,opened=[...settings.querySelectorAll('details')].map(el=>el.open),scroll=settings.scrollTop;
  bindings=[];settings.dataset.scope=key;settings.replaceChildren();
  for(const section of source.querySelectorAll(':scope > .sec')){
   if(section.querySelector('[data-plan],#operation-version-history'))continue;
   settings.append(mirror(section));
  }
  if(same){[...settings.querySelectorAll('details')].forEach((el,i)=>el.open=opened[i]||false);settings.scrollTop=scroll;}
 }
 settings.addEventListener('focusout',()=>queueMicrotask(syncSettings));
 const originalToggle=toggleClientsDrawer;
 toggleClientsDrawer=function(force){originalToggle(force);const open=drawer.classList.contains('open');drawer.inert=!open;const button=document.querySelector('#top-actions .hamburger');button.setAttribute('aria-expanded',String(open));if(open){selectTab(activeTab);tabs.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});}else button.focus({preventScroll:true});};
 toggleWorkspaceDrawer=function(){toggleClientsDrawer();};
 document.addEventListener('keydown',e=>{
  if(!drawer.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();toggleClientsDrawer(false);}
  if(e.key==='Tab'){const items=[...drawer.querySelectorAll('button,a,input,textarea,select,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 });
 _updateBrandSub=function(){ $('workspace-title').textContent='Backend 2';$('workspace-version').hidden=true;const menu=document.querySelector('#top-actions .hamburger');menu.title='Workspace menu';menu.setAttribute('aria-controls','clients-drawer');};
 goToScreen=function(){screens.scrollTop=0;};_updateBrandSub();
 // Keep legacy render targets but present only the integrated snapshot.
 $('screen-onepager').hidden=true;$('screen-operating').setAttribute('aria-label','Image, pattern, CLO 3D and pipeline');
 $('page-indicator')?.remove();
 const strip=document.createElement('section');strip.id='backend-two-fabric-strip';strip.setAttribute('aria-label','Studio fabrics');
 const fabricHost=$('brief-fabrics');fabricHost.style.display='flex';strip.append(fabricHost);screens.append(strip);
 showBriefItem=function(){_briefView='item';$('op-image-frame').style.display='';fabricHost.style.display='flex';};
 let fabricKey='',fabricSerial=0;
 async function refreshFabrics(id=''){
  if(id)selectedGarment=id;
  const saved=_savedOperation,context=_piecesContext();
  const valid=saved&&saved.account===context.account&&saved.submissionId===context.sid&&saved.local===context.local&&saved.referenceImage===context.hero;
  const piece=valid&&(saved.pieces.find(p=>p.id===selectedGarment)||saved.pieces.find(p=>p._image||p.front||p.views?.front));
  const key=JSON.stringify([context.account,context.sid,context.local,piece?.id,saved?.referenceImage,valid?saved.pieces:[]]);
  if(!window.MayaFabricAssistant||key===fabricKey)return;fabricKey=key;const serial=++fabricSerial;
  window.MayaFabricAssistant.reset();
  await window.MayaFabricAssistant.open({host:fabricHost,automatic:true,savedOnly:true,submissionId:valid?context.sid:'',referenceImage:valid?saved.referenceImage:'',preferences:valid?saved.preferences:'',piece:piece||{},pieces:valid?saved.pieces:[],reopenSaved:()=>{fabricKey='';return refreshFabrics(selectedGarment);}});
  if(serial!==fabricSerial)return;
 }
 const publish=_publishSavedOperations;
 _publishSavedOperations=function(...args){publish(...args);void refreshFabrics();};
 const clear=_clearBriefPrivate;
 // Existing reset handles account/submission identity; also clear mirrored controls.
 if(typeof clear==='function')_clearBriefPrivate=function(...args){const result=clear(...args);submissionNavigation++;bindings=[];settings.replaceChildren();fabricKey='';selectedGarment='';void refreshFabrics();return result;};
 showBriefFabrics=()=>refreshFabrics(selectedGarment);toggleBriefFabrics=showBriefFabrics;
 window.openBackendTwoSubmission=async folder=>{
  const ticket=++submissionNavigation,context=_piecesContext(),win=frame.contentWindow;
  const current=()=>{const next=_piecesContext();return ticket===submissionNavigation&&win===frame.contentWindow&&context.account===next.account&&context.sid===next.sid&&context.local===next.local;};
  try{if(!win?.flushPatternBeforeNavigation||!(await win.flushPatternBeforeNavigation())||!current())return;}
  catch{if(current())showBackendToast('Pattern settings could not save. Try again.');return;}
  const thumb=(folder.files||[]).find(f=>/^dream-garment\./i.test(f.name||''));
  location.href='/backend2.html?'+new URLSearchParams({submission:folder.id,name:folder.name||'',...(thumb?{img:thumb.id}:{})});
 };
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
  const d=e.data;
  if(d?.maya==='backend-two-selected'&&scopeMatches(d)){void refreshFabrics(d.garmentId);syncSettings();}
  if(d?.maya==='backend-two-settings'&&scopeMatches(d))syncSettings();
  if(d?.maya==='backend-two-open-settings'&&scopeMatches(d)){if(d.open){selectTab('settings');toggleClientsDrawer(true);}else toggleClientsDrawer(false);}
  if(d?.maya==='backend-two-dissect'&&scopeMatches(d))void beginDissection();
  if(d?.maya==='backend-two-workspace-pointer'&&drawer.classList.contains('open'))toggleClientsDrawer(false);
 });
 frame.addEventListener('load',()=>{_postPiecesToOps();syncSettings();});
 window.addEventListener('maya-owner-session-changed',()=>{submissionNavigation++;bindings=[];settings.replaceChildren();fabricKey='';selectedGarment='';});
 selectTab('submissions');
 document.addEventListener('DOMContentLoaded',()=>{void refreshFabrics();});
})();
