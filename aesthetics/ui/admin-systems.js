// Authenticated configuration only: these cards do not assert a live inference test.
const card=document.createElement('section');
card.id='model-snapshot';card.className='maya-model-popover';card.hidden=true;
card.setAttribute('role','region');card.setAttribute('aria-label','Model Snapshot');
document.body.append(card);
let active=null, pointer=null, interaction='pointer', kind='systems', closeTimer, snapshot=null, loading=false, failure='';
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
function modelLabel(model){return String(model).replace(/^gpt-/i,'GPT-').replace(/-(luna|sol|terra|nano|flare)$/i,(_,tier)=>' '+tier[0].toUpperCase()+tier.slice(1)).replace(/^gemini-/,'Gemini-');}
function render(){
 card.replaceChildren(text('h2',kind==='submissions'?'Submissions':'Model Snapshot'));
 if(kind==='submissions'){card.append(text('p','Website submissions synced into Leads.'));card.append(text('p','Connection: '+(document.querySelector('#d-drive')?.classList.contains('ok')?'Available':document.querySelector('#d-drive')?.classList.contains('bad')?'Unavailable':'Checking')));position();return;}
 if(!snapshot){card.append(text('p',failure||(loading?'Loading current configuration…':'Sign in to load current models.')));position();return;}
 if(failure)card.append(text('p',failure+' · Last configuration shown.'));
 if(kind==='systems'||kind==='api'){
  const grouped=new Map();
  for(const [role,model] of Object.entries(snapshot.models||{})){
   if(kind==='api'&&role.toLowerCase().includes('image'))continue;
   if(!grouped.has(model))grouped.set(model,[]);grouped.get(model).push(role.replace(/ text$/i,''));
  }
  for(const [model,roles] of grouped){const row=text('p',modelLabel(model)+' · '+roles.join(', '));row.className='model-role';row.title=model;card.append(row);}
 }
 const providers=kind==='images'?snapshot.images||[]:snapshot.connections||[];
 for(const provider of providers){
  const details=document.createElement('details');details.className='model-provider';
  const summary=text('summary',provider.provider+' · '+modelLabel(provider.model)+' · '+(provider.configured?(provider.transport||'API'):'Unavailable'));
  details.append(summary);
  details.append(text('p',provider.endpoint||''));card.append(details);
 }
 if(kind==='api'||kind==='systems')for(const integration of snapshot.integrations||[]){const row=document.createElement('p');row.append(text('strong',integration.provider+' · '),text('span',integration.status));card.append(row);}
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
function hide(){clearTimeout(closeTimer);closeTimer=null;if(active)active.setAttribute('aria-expanded','false');active=null;card.hidden=true;}
function open(trigger,selected,mode='pointer'){
 clearTimeout(closeTimer);closeTimer=null;if(active!==trigger)hide();active=trigger;kind=selected;interaction=mode;
 active.setAttribute('aria-expanded','true');card.hidden=false;snapshot=window.MAYA_MODEL_SNAPSHOT||snapshot;
 render();position();if(selected!=='submissions')window.loadModelSnapshot?.();
}
function pointerWithin(el){if(!el||!pointer)return false;const r=el.getBoundingClientRect();return pointer.x>=r.left&&pointer.x<=r.right&&pointer.y>=r.top&&pointer.y<=r.bottom;}
function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{closeTimer=null;const focused=card.contains(document.activeElement)||document.activeElement===active;if(!pointerWithin(card)&&!pointerWithin(active)&&(interaction==='pointer'||!focused))hide();},100);}
document.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(!active)return;interaction='pointer';if(pointerWithin(card)||pointerWithin(active)){clearTimeout(closeTimer);closeTimer=null;}else if(!closeTimer) scheduleClose();});
for(const [trigger,selected] of [[document.querySelector('#d-api')?.closest('.status-item'),'api'],[document.querySelector('#d-assets')?.closest('.status-item'),'images'],[document.querySelector('#d-drive')?.closest('.status-item'),'submissions'],[document.querySelector('#adm-tab-systems'),'systems'],[document.querySelector('#adm-tabtitle'),'systems']]){
 if(!trigger)continue;
 trigger.tabIndex=0;trigger.setAttribute('aria-controls',card.id);trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('mouseenter',()=>{if(selected==='systems'&&document.querySelector('#adm-tabtitle').textContent!=='Systems')return;open(trigger,selected);});
 trigger.addEventListener('mouseleave',scheduleClose);
 trigger.addEventListener('focus',()=>{if(selected!=='systems'||document.querySelector('#adm-tabtitle').textContent==='Systems')open(trigger,selected,'keyboard');});
 trigger.addEventListener('blur',scheduleClose);
 if(selected!=='systems'){
  trigger.setAttribute('role','button');trigger.setAttribute('aria-label',selected==='api'?'API model details':selected==='images'?'Image model details':'Submission connection details');
  trigger.addEventListener('click',e=>{e.stopPropagation();open(trigger,selected);});
  trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(trigger,selected,'keyboard');}});
 }
}
card.addEventListener('toggle',position,true);
card.addEventListener('mouseenter',()=>{clearTimeout(closeTimer);closeTimer=null;});card.addEventListener('mouseleave',scheduleClose);card.addEventListener('focusout',scheduleClose);
window.addEventListener('maya-model-loading',()=>{loading=true;failure='';render();});
window.addEventListener('maya-model-error',e=>{loading=false;failure=e.detail;render();});
window.addEventListener('maya-model-snapshot',e=>{snapshot=e.detail;loading=false;failure='';render();});
window.addEventListener('maya-model-clear',()=>{snapshot=null;loading=false;failure='';hide();card.replaceChildren();});
window.addEventListener('storage',e=>{if(e.key==='maya_admin_tok'||e.key===null){snapshot=null;delete window.MAYA_MODEL_SNAPSHOT;hide();}});
document.addEventListener('pointerdown',e=>{interaction='pointer';if(!card.contains(e.target)&&!active?.contains(e.target))hide();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden){const trigger=active;hide();trigger?.focus({preventScroll:true});hide();}});
window.addEventListener('resize',hide);for(const event of ['wheel','touchmove'])document.addEventListener(event,e=>{if(!card.contains(e.target))hide();},{capture:true,passive:true});
