/* The Brief and Operations share one drawer. */
(function(){
 'use strict';
 function createTabs(drawer,panels,onSelect=()=>{}){
  const nav=document.createElement('nav');nav.className='original-drawer-tabs pg-tabrow';nav.dataset.mayaControl='segmented';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Workspace drawer');
  const title=document.createElement('span');title.className='pg-tabtitle';title.dataset.mayaType='H2';let active='submissions';
  const labels={submissions:'Submissions',settings:'Settings'},paths={submissions:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',settings:'M4 7h16M4 17h16M8 4v6M16 14v6'};
  const select=key=>{if(!panels[key])return;active=key;title.textContent=labels[key];for(const [name,panel]of Object.entries(panels)){const button=nav.querySelector('[data-tab="'+name+'"]'),on=name===key;panel.hidden=!on;button.tabIndex=on?0:-1;button.setAttribute('aria-selected',String(on));button.setAttribute('aria-pressed',String(on));button.classList.toggle('on',on);}onSelect(key);};
  for(const [key,panel]of Object.entries(panels)){
   const button=document.createElement('button');button.type='button';button.className='maya-icon-button pg-tab';button.dataset.mayaShape='circle';button.dataset.mayaType='P3';button.dataset.mayaSegment='';button.dataset.tab=key;button.id=panel.id+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-label',labels[key]);button.title=labels[key];button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
   button.addEventListener('click',()=>select(key));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=Object.keys(panels),next=event.key==='Home'?keys[0]:event.key==='End'?keys.at(-1):keys.find(k=>k!==key);select(next);nav.querySelector('[data-tab="'+next+'"]').focus();});nav.append(button);
  }
  nav.append(title);drawer.prepend(nav);return {select,get active(){return active;},nav};
 }
 window.MayaOriginalDrawerTabs={create:createTabs};
 if(!document.body.classList.contains('backend-original'))return;
 const $=id=>document.getElementById(id),drawer=$('clients-drawer'),frame=$('operations-embed'),settings=$('drawer-settings');if(!drawer||!settings||!frame)return;
 drawer.classList.add('original-workspace-drawer');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','Workspace');drawer.inert=true;
 drawer.querySelector('.drawer-title').hidden=true;settings.querySelector('.settings-header').hidden=true;
 // The legacy key-status section sent an inference just to open Settings.
 // Keep this drawer focused on editable settings; opening it makes no paid probe.
 const keyStatus=$('settings-openai-status')?.closest('.settings-section');if(keyStatus)keyStatus.hidden=true;
 const version=$('settings-info-version');if(version)version.textContent='v'+(document.querySelector('meta[name="maya-backend-version"]')?.content||'');
 const submissions=document.createElement('section');submissions.id='original-submissions';submissions.append($('clients-count'),$('clients-list'));drawer.insertBefore(submissions,settings);
 drawer.querySelector('.drawer-settings-link[onclick="openBackendSettings()"]')?.remove();
 const pattern=document.createElement('section');pattern.id='original-pattern-settings';settings.prepend(pattern);
 const exportRow=document.createElement('section');exportRow.className='sec';const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='pill';exportButton.dataset.mayaType='P3';exportButton.id='original-export-svg';exportButton.textContent='Export as SVG';exportButton.addEventListener('click',()=>{if(mirrorKey()===null||pattern.dataset.scope!==mirrorKey()){showBackendToast('Open a garment pattern first.');return;}void frame.contentWindow.exportOriginalSVG?.();});exportRow.append(exportButton);settings.prepend(exportRow);
 let bindings=[],syncQueued=false;
 const matches=data=>{const c=_piecesContext();return !!data&&data.account===c.account&&data.submissionId===c.sid&&data.local===c.local&&data.revision===_operationsRevision;};
 function mirrorKey(){const context=frame.contentWindow?.originalOperationContext?.();return matches(context)?JSON.stringify([context.account,context.submissionId,context.local,context.revision,context.garmentId||'']):null;}
 function syncSettings(){
  if(tabs.active!=='settings')return;
  const doc=frame.contentDocument,source=doc?.getElementById('drawer'),key=mirrorKey();exportButton.disabled=key===null;
  if(!source||key===null){bindings=[];delete pattern.dataset.scope;pattern.textContent='Open a submission to load pattern settings.';return;}
  const valid=original=>pattern.dataset.scope===key&&mirrorKey()===key&&original.isConnected&&doc===frame.contentDocument;
  function mirror(root){
   const clone=root.cloneNode(true),originals=[root,...root.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
   originals.forEach((original,index)=>{const copy=copies[index];for(const attr of [...copy.attributes])if(/^on/i.test(attr.name))copy.removeAttribute(attr.name);if(copy.id)copy.id='original-setting-'+copy.id;if(copy.htmlFor)copy.htmlFor='original-setting-'+copy.htmlFor;
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(original.tagName)){copy.value=original.value;copy.checked=original.checked;copy.disabled=original.disabled;for(const event of ['input','change'])copy.addEventListener(event,()=>{if(!valid(original)||original.disabled)return;original.value=copy.value;original.checked=copy.checked;original.dispatchEvent(new frame.contentWindow.Event(event,{bubbles:true}));});}
    if(original.tagName==='BUTTON')copy.addEventListener('click',()=>{if(!valid(original)||original.disabled)return;original.click();scheduleSync();});bindings.push({original,copy});
   });return clone;
  }
  if(pattern.dataset.scope===key&&pattern.contains(document.activeElement)){
   for(const {original,copy}of bindings){if(!original.isConnected||!pattern.contains(copy))continue;if('disabled'in original)copy.disabled=original.disabled;copy.hidden=original.hidden;copy.className=original.className;copy.style.cssText=original.style.cssText;if(copy!==document.activeElement&&/^(INPUT|SELECT|TEXTAREA)$/.test(original.tagName)){copy.value=original.value;copy.checked=original.checked;}if(original.getAttribute('role')==='status'||original.classList.contains('kb-status')||(!original.children.length&&!/^(INPUT|SELECT|TEXTAREA)$/.test(original.tagName)))copy.textContent=original.textContent;for(const attr of ['aria-pressed','aria-expanded','title']){const value=original.getAttribute(attr);if(value===null)copy.removeAttribute(attr);else copy.setAttribute(attr,value);}}
   for(const id of ['pattern-history','logic-chips']){const original=doc.getElementById(id),copy=$('original-setting-'+id);if(original&&copy)copy.replaceWith(mirror(original));}bindings=bindings.filter(({copy})=>pattern.contains(copy));return;
  }
  const same=pattern.dataset.scope===key,opened=[...pattern.querySelectorAll('details')].map(el=>el.open),scroll=settings.scrollTop;
  bindings=[];pattern.dataset.scope=key;pattern.replaceChildren();for(const section of source.querySelectorAll(':scope > .sec')){if(section.querySelector('#operation-version-history'))continue;pattern.append(mirror(section));}
  if(same){[...pattern.querySelectorAll('details')].forEach((el,index)=>el.open=opened[index]||false);settings.scrollTop=scroll;}
 }
 function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;syncSettings();});}
 const tabs=createTabs(drawer,{submissions,settings},key=>{if(key==='settings'){_syncQualityPills();syncSettings();}else if(drawer.classList.contains('open'))void openClientsDrawer();});
 const originalToggle=toggleClientsDrawer;
 toggleClientsDrawer=function(force){originalToggle(force);const open=drawer.classList.contains('open');drawer.inert=!open;if(open){tabs.select(tabs.active);tabs.nav.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});}else document.querySelector('#top-actions .hamburger')?.focus({preventScroll:true});};
 toggleWorkspaceDrawer=function(force){toggleClientsDrawer(force);};
 openBackendSettings=function(){tabs.select('settings');toggleClientsDrawer(true);};closeDrawerSettings=function(){tabs.select('submissions');};
 const updateBrand=_updateBrandSub;_updateBrandSub=function(){updateBrand();const menu=document.querySelector('#top-actions .hamburger');menu.title='Workspace menu';menu.setAttribute('aria-controls','clients-drawer');};_updateBrandSub();
 settings.addEventListener('focusout',scheduleSync);
 document.addEventListener('keydown',event=>{if(!drawer.classList.contains('open'))return;if(event.key==='Escape'){event.preventDefault();toggleClientsDrawer(false);return;}if(event.key!=='Tab')return;const items=[...drawer.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[hidden]')&&el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;const data=event.data;if(data?.maya==='original-operation-settings'&&matches(data))scheduleSync();if(data?.maya==='original-operation-open-settings'&&matches(data)){if(data.open){tabs.select('settings');toggleClientsDrawer(true);}else toggleClientsDrawer(false);}if(data?.maya==='original-operation-pointer'&&drawer.classList.contains('open'))toggleClientsDrawer(false);});
 frame.addEventListener('load',scheduleSync);
 const clear=_clearBriefPrivate;_clearBriefPrivate=function(...args){const result=clear(...args);bindings=[];delete pattern.dataset.scope;pattern.replaceChildren();exportButton.disabled=true;return result;};
 window.addEventListener('maya-owner-session-changed',()=>{bindings=[];delete pattern.dataset.scope;pattern.replaceChildren();exportButton.disabled=true;});
 tabs.select('submissions');
})();
