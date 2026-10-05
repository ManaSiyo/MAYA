// Authenticated configuration only: these cards do not assert a live inference test.
const card=document.createElement('section');
card.id='model-snapshot';card.className='maya-model-popover';card.hidden=true;
card.setAttribute('role','region');card.setAttribute('aria-label','Model Snapshot');
document.body.append(card);
let active=null, kind='systems', closeTimer, snapshot=null, loading=false, failure='';
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
function render(){
 card.replaceChildren(text('h2',kind==='submissions'?'Submissions':'Model Snapshot'));
 if(kind==='submissions'){card.append(text('p','Website submissions synced into Leads.'));card.append(text('p','Connection: '+(document.querySelector('#d-drive')?.classList.contains('ok')?'Available':document.querySelector('#d-drive')?.classList.contains('bad')?'Unavailable':'Checking')));position();return;}
 if(!snapshot){card.append(text('p',failure||(loading?'Loading current configuration…':'Sign in to load current models.')));position();return;}
 if(failure)card.append(text('p',failure+' · Last configuration shown.'));
 if(kind==='systems'||kind==='api'){
  for(const [role,model] of Object.entries(snapshot.models||{})){
   if(kind==='api'&&role.toLowerCase().includes('image'))continue;
   const row=text('p',role+' · '+model);card.append(row);
  }
 }
 const providers=kind==='images'?snapshot.images||[]:snapshot.connections||[];
 for(const provider of providers){
  const details=document.createElement('details');details.className='model-provider';
  const summary=text('summary',provider.provider+' · '+provider.model);
  summary.addEventListener('mouseenter',()=>{details.open=true;position();});
  summary.addEventListener('focus',()=>{details.open=true;position();});
  details.append(summary);
  details.append(text('p',(provider.configured?'Configured':'Unavailable')+' · '+(provider.transport||'API')));
  details.append(text('p',provider.endpoint||''));card.append(details);
 }
 if(kind==='api'||kind==='systems')for(const integration of snapshot.integrations||[]){const row=document.createElement('p');row.append(text('strong',integration.provider+' · '),text('span',integration.status));card.append(row);}
 card.append(text('small','Configuration · '+new Date(snapshot.checkedAt).toLocaleTimeString()));
 position();
}
function position(){
 if(!active||card.hidden)return;
 const r=active.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;
 const left=Math.max(8,Math.min(r.left,innerWidth-w-8));
 const below=r.bottom+8;
 const top=below+h<=innerHeight-8?below:Math.max(8,r.top-h-8);
 card.style.left=left+'px';card.style.top=top+'px';
}
function hide(){if(active)active.setAttribute('aria-expanded','false');active=null;card.hidden=true;}
function open(trigger,selected){
 clearTimeout(closeTimer);if(active!==trigger)hide();active=trigger;kind=selected;
 active.setAttribute('aria-expanded','true');card.hidden=false;snapshot=window.MAYA_MODEL_SNAPSHOT||snapshot;
 render();position();if(selected!=='submissions')window.loadModelSnapshot?.();
}
function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!card.matches(':hover')&&!card.contains(document.activeElement)&&!active?.matches(':hover')&&document.activeElement!==active)hide();},180);}
for(const [trigger,selected] of [[document.querySelector('#d-api')?.closest('.status-item'),'api'],[document.querySelector('#d-assets')?.closest('.status-item'),'images'],[document.querySelector('#d-drive')?.closest('.status-item'),'submissions'],[document.querySelector('#adm-tab-systems'),'systems'],[document.querySelector('#adm-tabtitle'),'systems']]){
 if(!trigger)continue;
 trigger.tabIndex=0;trigger.setAttribute('aria-controls',card.id);trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('mouseenter',()=>{if(selected==='systems'&&document.querySelector('#adm-tabtitle').textContent!=='Systems')return;open(trigger,selected);});
 trigger.addEventListener('mouseleave',scheduleClose);
 trigger.addEventListener('focus',()=>{if(selected!=='systems'||document.querySelector('#adm-tabtitle').textContent==='Systems')open(trigger,selected);});
 trigger.addEventListener('blur',scheduleClose);
 if(selected!=='systems'){
  trigger.setAttribute('role','button');trigger.setAttribute('aria-label',selected==='api'?'API model details':selected==='images'?'Image model details':'Submission connection details');
  trigger.addEventListener('click',e=>{e.stopPropagation();open(trigger,selected);});
  trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(trigger,selected);}});
 }
}
card.addEventListener('toggle',position,true);
card.addEventListener('mouseenter',()=>clearTimeout(closeTimer));card.addEventListener('mouseleave',scheduleClose);card.addEventListener('focusout',scheduleClose);
window.addEventListener('maya-model-loading',()=>{loading=true;failure='';render();});
window.addEventListener('maya-model-error',e=>{loading=false;failure=e.detail;render();});
window.addEventListener('maya-model-snapshot',e=>{snapshot=e.detail;loading=false;failure='';render();});
window.addEventListener('maya-model-clear',()=>{snapshot=null;loading=false;failure='';hide();card.replaceChildren();});
window.addEventListener('storage',e=>{if(e.key==='maya_admin_tok'||e.key===null){snapshot=null;delete window.MAYA_MODEL_SNAPSHOT;hide();}});
document.addEventListener('pointerdown',e=>{if(!card.contains(e.target)&&!active?.contains(e.target))hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden){const trigger=active;hide();trigger?.focus({preventScroll:true});hide();}});
window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
