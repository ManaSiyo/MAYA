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
  trigger.addEventListener('click',()=>{show();if(panel.matches(':popover-open'))panel.focus({preventScroll:true});});trigger.addEventListener('focus',show);
  for(const target of [trigger,panel,...hoverTargets]){target.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show();});target.addEventListener('pointerleave',later);target.addEventListener('focusout',later);}
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();trigger.focus({preventScroll:true});close();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.matches(':popover-open')){e.preventDefault();e.stopPropagation();const restore=panel.contains(document.activeElement);close();if(restore){trigger.focus({preventScroll:true});close();}}},{capture:true});
  document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!trigger.contains(e.target))close();});
  const reposition=()=>{if(panel.matches(':popover-open'))place();};addEventListener('resize',reposition);addEventListener('scroll',reposition,{capture:true});
  return {trigger,panel,close,setEnabled(value){enabled=value;trigger.hidden=!value;if(!value)close();},set(value){
   data=value;content.replaceChildren();trigger.disabled=!value;if(!value){close();return;}
   const heading=document.createElement('h3');heading.dataset.mayaType='H4';if(preview)heading.dataset.previewCategory='H4';heading.textContent='Fabric search';content.append(heading);
   for(const garment of value.garments||[]){line('Garment',garment.name||'Selected look');line('Saved description',[garment.fabric,...Object.entries(garment.traits||{}).filter(([,v])=>v).map(([k,v])=>k+': '+v)].filter(Boolean).join(' · ')||'No material description saved');}
   if(value.preferences){let preferences=value.preferences;try{const parsed=JSON.parse(preferences);preferences=Array.isArray(parsed)?parsed.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' · '):JSON.stringify(parsed);}catch{}line('Client preferences',String(preferences));}
   line('Resolved search',value.query||'Interpreting the saved look');
   line('Retailer queries',(value.retailerQueries||[]).join(' / ')||'No direct query; using web discovery');
   line('Web queries',(value.webQueries||[]).join(' / ')||'Not exposed by the search service');
   line('Reference interpretation',value.observation||'No photo interpretation returned; saved traits are hints, not confirmed fiber facts');
   line('Store scope',(value.stores||[]).join(', ')||'Selected stores');line('State',value.stage||'Searching');
   if(panel.matches(':popover-open'))place();
  }};
 }};
})();
