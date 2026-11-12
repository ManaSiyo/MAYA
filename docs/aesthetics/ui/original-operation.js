/* Presentation for the original Backend; Backend 2 keeps its own adapter. */
(function(){
 'use strict';
 if(!EMBEDDED||new URLSearchParams(location.search).get('layout')==='backend2')return;
 document.documentElement.classList.add('original-operation');
 const stage=$('stage'),trace=document.querySelector('#plan-a-view > .trace'),host=$('pass-pills');
 if(!stage||!trace||!host)return;
 trace.id='original-operation-logic';trace.classList.remove('panel');trace.classList.add('original-operation-logic');
 trace.dataset.mayaScrollbar='visible';trace.tabIndex=0;trace.hidden=true;
 trace.querySelector('h3').textContent='Pipeline';stage.append(trace);
 stage.setAttribute('role','tabpanel');host.setAttribute('role','tablist');host.setAttribute('aria-label','Pattern view');
 let watchingLogic=false,pendingExport=null;
 const inputScope=()=>_operationInputContext?{account:_operationInputContext.account,submissionId:_operationInputContext.submissionId,local:_operationInputContext.local,revision:_operationRevision,garmentId:FILES.piece?.id||''}:null;
 window.originalOperationContext=inputScope;
 const notifySettings=()=>parent.postMessage({maya:'original-operation-settings',...inputScope()},location.origin);
 document.addEventListener('pointerdown',()=>parent.postMessage({maya:'original-operation-pointer',...inputScope()},location.origin),{capture:true});
 toggleDrawer=function(open=true){parent.postMessage({maya:'original-operation-open-settings',...inputScope(),open:open!==false},location.origin);};
 function choose(kind,index){
  watchingLogic=kind==='logic';
  if(kind==='grounded')viewGrounded(index);else view(kind);
 }
 // Keep the same buttons during live updates, so keyboard focus survives them.
 renderPassPills=function(){
  const marks=Math.max(1,PASSES.length),keys=[...Array.from({length:marks},(_,i)=>['grounded',i,'Mark '+(i+1)]),['logic',0,'Pipeline']];
  if(host.dataset.marks!==String(marks)){
   host.dataset.marks=String(marks);host.replaceChildren();
   for(const [kind,index,label]of keys){
    const button=document.createElement('button');button.type='button';button.className='pill';button.dataset.mayaType='P3';button.dataset.mayaSegment='';button.dataset.view=kind;button.dataset.index=String(index);
    button.id='original-operation-tab-'+kind+'-'+index;button.setAttribute('role','tab');button.setAttribute('aria-controls',stage.id);button.textContent=label;
    if(kind==='logic'){const dot=document.createElement('span');dot.className='original-operation-pipeline-dot';dot.setAttribute('aria-hidden','true');button.append(dot);}
    button.addEventListener('click',()=>choose(kind,index));
    button.addEventListener('keydown',event=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();const tabs=[...host.querySelectorAll('button')],i=tabs.indexOf(button);
     const next=tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.click();next.focus();
    });host.append(button);
   }
   const accuracy=document.createElement('span');accuracy.className='acc-inline';host.append(accuracy);
  }
  for(const button of host.querySelectorAll('button')){
   const selected=button.dataset.view===CUR.kind&&(CUR.kind!=='grounded'||Number(button.dataset.index)===Math.min(CUR.idx,marks-1));
   button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;
   if(selected)stage.setAttribute('aria-labelledby',button.id);
  }
  const accuracy=host.querySelector('.acc-inline'),a=CUR.kind==='grounded'?PASSES[Math.min(CUR.idx,marks-1)]?.acc:null;
  accuracy.hidden=!a;accuracy.textContent=a?`${a.design??'…'}% design · ${a.measure??'…'}% measure`:'';
  host.querySelector('.original-operation-pipeline-dot')?.classList.toggle('running',!!RUNNING);
 };
 const paint=applyView;
 applyView=function(){
  // Pipeline calls select a drawing as work progresses. Keep Pipeline open while
  // the owner is watching; switching back still selects the latest saved pass.
  if(watchingLogic){
   // Keep the drawing current even while hidden. SVG can be selected directly
   // from Settings after a run, without first opening Mark 1 to hydrate its image.
   const pass=PASSES[Math.min(CUR.idx,PASSES.length-1)];
   if(pass){if(TRACE?.source!==pass.img){cancelPatternTrace();TRACE=null;}$('img-grounded').src=pass.img;}
   CUR={...CUR,kind:'logic'};
  }
  // Answer redraws are reference inputs, not an additional workspace tab.
  if(CUR.kind==='rd')CUR={...CUR,kind:'grounded'};
  paint();trace.hidden=CUR.kind!=='logic';
  if(!trace.hidden)$('stage-empty').style.display='none';
 };
 const invalidate=invalidateOperation;
 invalidateOperation=function(){pendingExport=null;watchingLogic=false;CUR={kind:'grounded',idx:0};const result=invalidate.apply(this,arguments);notifySettings();return result;};
 const running=setOperationRunning;
 setOperationRunning=function(on){const result=running.apply(this,arguments);trace.classList.toggle('is-running',!!on);renderPassPills();notifySettings();return result;};
 const svg=viewSVG;
 viewSVG=function(){watchingLogic=false;return svg.apply(this,arguments);};
 window.viewLogic=()=>choose('logic',0);
 window.viewPipeline=window.viewLogic;
 // Settings exports the currently selected saved drawing without changing the
 // visible tab. Reuse the engine's bounded, cancellable local tracing worker.
 window.exportOriginalSVG=function(){
  if(pendingExport&&operationCurrent(pendingExport.context))return pendingExport.promise;
  if(RUNNING){toast('Finish the current run before exporting.');return Promise.resolve(false);}
  const source=PASSES[Math.min(CUR.idx,PASSES.length-1)]?.img;
  if(!source){toast('Open a saved pattern before exporting.');return Promise.resolve(false);}
  const request={context:operationContext(),promise:null};pendingExport=request;
  request.promise=(async()=>{
   try{
    if(TRACE?.source!==source){cancelPatternTrace();TRACE=null;}
    $('img-grounded').src=source;
    if(!TRACE?.svg){
     buildSVGfromGrounded(source);
     const task=_traceTask,deadline=Date.now()+31000;
     while(task&&_traceTask===task&&operationCurrent(request.context)&&pendingExport===request&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
     if(pendingExport!==request||!operationCurrent(request.context))return false;
     if(task&&_traceTask===task){cancelPatternTrace();toast('SVG tracing timed out. Try exporting again.');return false;}
    }
    if(pendingExport!==request||!operationCurrent(request.context)||TRACE?.source!==source||!TRACE?.svg)return false;
    exportSVG();return true;
   }finally{if(pendingExport===request)pendingExport=null;}
  })();
  return request.promise;
 };
 const settingsObserver=new MutationObserver(notifySettings);settingsObserver.observe($('drawer'),{attributes:true,childList:true,characterData:true,subtree:true});
 const install=installOperationContext;
 installOperationContext=function(...args){const result=install(...args);notifySettings();return result;};
 $('drawer').addEventListener('change',notifySettings);
 const picker=$('test-picker');let pointerSelection=false;
 picker.addEventListener('pointerdown',()=>pointerSelection=true);
 picker.addEventListener('keydown',()=>pointerSelection=false);
 picker.addEventListener('change',()=>{if(pointerSelection)picker.blur();pointerSelection=false;});
 picker.addEventListener('blur',()=>pointerSelection=false);
 applyView();
})();
