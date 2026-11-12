/* Opt-in presentation adapter: the original Operation Room remains unchanged. */
(function(){
 'use strict';
 if(new URLSearchParams(location.search).get('layout')!=='backend2'||!EMBEDDED)return;
 document.body.classList.add('backend-two-operation');
 const style=document.createElement('link');style.rel='stylesheet';style.href='/aesthetics/ui/backend-two.css?v=2';document.head.append(style);
 document.addEventListener('pointerdown',()=>parent.postMessage({maya:'backend-two-workspace-pointer'},location.origin),{capture:true});
 const trace=document.querySelector('#plan-a-view > .trace'),stage=$('stage');
 trace.id='backend-two-pipeline';trace.dataset.mayaScrollbar='visible';trace.setAttribute('role','tabpanel');trace.tabIndex=0;stage.after(trace);
 let pipeline=false,fullView=true,viewSelection=0;
 const inputScope=()=>_operationInputContext?{account:_operationInputContext.account,submissionId:_operationInputContext.submissionId,local:_operationInputContext.local,revision:_operationRevision,garmentId:FILES.piece?.id||''}:null;
 window.backendTwoContext=inputScope;
 const notify=()=>parent.postMessage({maya:'backend-two-selected',...inputScope(),garmentId:FILES.piece?.id||''},location.origin);
 const notifySettings=()=>parent.postMessage({maya:'backend-two-settings',...inputScope()},location.origin);
 // Backend 2 always presents the integrated pattern route. A saved Plan B
 // preference belongs to the original workspace and must not hide this snapshot.
 syncPlan=function(){ $('plan-a-view').style.display='';$('plan-b-view').style.display='none'; };
 toggleDrawer=function(open=true){parent.postMessage({maya:'backend-two-open-settings',...inputScope(),open:open!==false},location.origin);};
 function paintTabs(){
  const host=$('pass-pills');
  if(!host.querySelector('#backend-two-pattern-tab')){
   host.replaceChildren();
   for(const [key,label]of [['pattern','Mark 1'],['pipeline','Pipeline']]){
    const b=document.createElement('button');b.type='button';b.className='pill';b.dataset.mayaType='P3';b.dataset.mayaSegment='';b.setAttribute('role','tab');b.id='backend-two-'+key+'-tab';b.setAttribute('aria-controls',key==='pipeline'?trace.id:stage.id);
    b.append(document.createTextNode(label));if(key==='pipeline'){const dot=document.createElement('span');dot.className='backend-two-pipeline-dot';dot.setAttribute('aria-hidden','true');b.append(dot);}
    b.onclick=()=>{pipeline=key==='pipeline';if(!pipeline)viewGrounded();paintTabs();};
    b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();pipeline=!pipeline;if(!pipeline)viewGrounded();paintTabs();$('backend-two-'+(pipeline?'pipeline':'pattern')+'-tab').focus();}});
    host.append(b);
   }
  }
  for(const key of ['pattern','pipeline']){const button=$('backend-two-'+key+'-tab'),active=(key==='pipeline')===pipeline;button.setAttribute('aria-selected',String(active));button.setAttribute('aria-pressed',String(active));button.tabIndex=active?0:-1;}
  host.querySelector('.backend-two-pipeline-dot').classList.toggle('running',RUNNING);
  host.setAttribute('role','tablist');host.setAttribute('aria-label','Pattern view');stage.setAttribute('role','tabpanel');stage.setAttribute('aria-labelledby','backend-two-pattern-tab');trace.setAttribute('aria-labelledby','backend-two-pipeline-tab');stage.hidden=pipeline;trace.hidden=!pipeline;
 }
 renderPassPills=paintTabs;
 const running=setOperationRunning;setOperationRunning=function(...args){const result=running(...args);paintTabs();notifySettings();return result;};
 const sync=syncPatternSettings;syncPatternSettings=function(...args){const result=sync(...args);queueMicrotask(notifySettings);return result;};
 const lock=lockPatternSettings;lockPatternSettings=function(...args){const result=lock(...args);queueMicrotask(notifySettings);return result;};
 const history=renderPatternHistory;renderPatternHistory=function(...args){const result=history(...args);queueMicrotask(notifySettings);return result;};
 const originalPick=pickTest;
 pickTest=function(name){const result=originalPick(name);decoratePicker();if(fullView)showFullView();notify();return result;};
 function decoratePicker(){
  const picker=$('test-picker');
  if(!picker.querySelector('option[value="__full__"]')){const option=document.createElement('option');option.value='__full__';option.textContent='Full view';picker.prepend(option);}
  let group=picker.querySelector('optgroup');if(!group){group=document.createElement('optgroup');group.label='Dissected view';picker.append(group);}for(const option of [...picker.querySelectorAll(':scope > option')])if(option.value!=='__full__')group.append(option);
  if(fullView)picker.value='__full__';
  dissect.hidden=Object.keys(TESTS).length>0||!_operationInputContext?.referenceImage;
 }
 function showFullView(){
  const src=_operationInputContext?.referenceImage;
  if(src){$('hero-img').src=src;$('hero-img').style.display='block';$('hero-empty').style.display='none';}
  else{$('hero-img').removeAttribute('src');$('hero-img').style.display='none';$('hero-empty').textContent='Open a submission from the drawer.';$('hero-empty').style.display='';}
  $('test-picker').value='__full__';
 }
 const pick=onPickTest;
 onPickTest=async function(value){
  const selection=++viewSelection;
  if(value==='__full__'){++_patternNavigation;fullView=true;showFullView();return;}
  await pick(value);
  if(selection!==viewSelection)return;
  if(ACTIVE_TEST===value){fullView=false;showView('front');$('test-picker').value=value;notify();}
  else if(fullView)showFullView();
 };
 const install=installOperationContext;
 installOperationContext=function(...args){viewSelection++;fullView=true;const result=install(...args);decoratePicker();showFullView();paintTabs();notify();return result;};
 const init=initTests;initTests=function(...args){const result=init(...args);decoratePicker();if(fullView)showFullView();return result;};
 const dissect=document.createElement('button');dissect.type='button';dissect.className='pill';dissect.dataset.mayaType='P3';dissect.textContent='Dissect';dissect.hidden=true;dissect.onclick=()=>parent.postMessage({maya:'backend-two-dissect',...inputScope()},location.origin);$('start-test').after(dissect);
 // An empty pipeline still exposes the architecture, with no implied live run.
 decoratePicker();showFullView();paintTabs();syncPlan();
 const observer=new MutationObserver(()=>{for(const dot of document.querySelectorAll('.backend-two-pipeline-dot'))dot.classList.toggle('running',RUNNING);});observer.observe($('live-status'),{childList:true,characterData:true,subtree:true});
 // Save failures and embedding progress update the drawer directly, outside
 // the settings render helpers. Keep their status and retry controls live too.
 const settingsObserver=new MutationObserver(notifySettings);settingsObserver.observe($('drawer'),{attributes:true,childList:true,characterData:true,subtree:true});
})();
