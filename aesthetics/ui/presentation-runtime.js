/* Shared presentation metadata and saved settings. No account data or provider calls. */
(() => {
  const statuses=[
    {key:'new',label:'Not contacted',alias:'inactive',matches:['new'],color:'#b5bdc8',weight:300,meaning:'No contact yet; no delivery is neutral.',usage:[['Admin','/status.html','Leads · Not contacted; Ad campaigns · No delivery'],['Outbound','/outbound.html','Lead lists · Not contacted']]},
    {key:'contacted',label:'Contacted',alias:'contacted',matches:['contacted','replied'],color:'#4ade80',weight:400,meaning:'Contact made or a reply received.',usage:[['Admin','/status.html','Leads · Contacted'],['Outbound','/outbound.html','Lead lists · Contacted, Replied']]},
    {key:'in_progress',label:'In progress',alias:'progress',matches:['in_progress','in_process'],color:'#86efac',weight:400,meaning:'Work is underway; soft green.',usage:[['Admin','/status.html','Leads · In progress']]},
    {key:'booked',label:'Booked',alias:'booked',matches:['booked','meeting'],color:'#fbbf24',weight:400,meaning:'Booked and awaiting completion; yellow.',usage:[['Admin','/status.html','Leads · Booked'],['Outbound','/outbound.html','Lead lists · Booked']]},
    {key:'completed',label:'Completed',alias:'completed',matches:['completed','closed'],color:'#22c55e',weight:500,meaning:'Completed or closed successfully.',usage:[['Admin','/status.html','Leads · Completed, Closed (previous)'],['Outbound','/outbound.html','Lead lists · Closed']]},
    {key:'canceled',label:'Cancelled',alias:'cancelled',matches:['canceled','cancelled'],color:'#f87171',weight:400,meaning:'Cancelled; red.',usage:[['Admin','/status.html','Leads · Cancelled']]},
    {key:'delivering',label:'Delivering',alias:'delivering',matches:['delivering'],color:'#22c55e',weight:400,meaning:'Impressions recorded in the selected D/W/M window. This does not confirm that the campaign is enabled now.',usage:[['Admin','/status.html','Ad campaigns · Delivering']]},
    {key:'pending',label:'Pending',alias:'pending',matches:['pending','ready','follow_up_due'],color:'#fbbf24',weight:400,meaning:'Ready or waiting for the next action; yellow.',usage:[['Outbound','/outbound.html','Lead lists · Ready']]},
    {key:'rejected',label:'Rejected',alias:'rejected',matches:['rejected','suppressed','passed'],color:'#f87171',weight:400,meaning:'Declined or excluded from contact; red.',usage:[['Admin','/status.html','Leads · Passed (previous)'],['Outbound','/outbound.html','Lead lists · Do not contact']]}
  ];
  const defaults={sectionSpacing:{submissions:24,leads:16,ads:40,insights:16,headingGap:10},statusStyles:Object.fromEntries(statuses.map(s=>[s.key,{color:s.color,opacity:100,weight:s.weight}]))};
  const hex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const number=(value,min,max,fallback)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
  function apply(value={}){
    const states=Object.fromEntries(statuses.map(s=>{const saved=value.statusStyles?.[s.key]||{},base=defaults.statusStyles[s.key];return [s.key,{color:hex(saved.color,base.color),opacity:number(saved.opacity,0,100,base.opacity),weight:number(saved.weight,200,500,base.weight)}];}));
    const sp=Object.fromEntries(Object.entries(defaults.sectionSpacing).map(([key,fallback])=>[key,number(value.sectionSpacing?.[key],0,160,fallback)]));
    const iconColor=hex(value.iconColor,'#aab5c4'),iconOpacity=number(value.iconOpacity,0,100,100),iconStroke=number(value.iconStroke,1,3,2);
    let css=':root{';
    for(const s of statuses){const state=states[s.key],rgb=[1,3,5].map(i=>parseInt(state.color.slice(i,i+2),16)).join(' ');css+=`--maya-${s.alias}:rgb(${rgb} / ${state.opacity/100});`;}
    // Historical page aliases must retain success/warning semantics independently of CRM stages.
    css+=`--green:var(--maya-completed);--mint:var(--maya-completed);--amber:var(--maya-pending);--rose:var(--maya-cancelled);--maya-icon-color:${iconColor};--maya-icon-opacity:${iconOpacity/100};--maya-icon-stroke:${iconStroke};--maya-section-heading-gap:${sp.headingGap}px;}`;
    for(const s of statuses){
      const state=states[s.key],selectors=s.matches.flatMap(key=>[`.status-pill[data-status="${key}"]`,`.status-word[data-status="${key}"]`,`.status-pill:has(option[value="${key}"]:checked)`,`.lead-stage-menu [data-status="${key}"]`]);
      css+=`html body :is(${selectors.join(',')}){--maya-status-weight:${state.weight};--status-color:var(--maya-${s.alias})!important;color:var(--maya-${s.alias})!important;font-weight:${state.weight}!important}`;
      const selected=s.matches.map(key=>`.status-pill:has(option[value="${key}"]:checked)`).join(',');
      css+=`html body :is(${selected}) :is(select,.status-text){color:var(--maya-${s.alias})!important;font-weight:${state.weight}!important}`;
    }
    const arrow=encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-opacity="${iconOpacity/100}" stroke-width="${iconStroke}" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`);
    css+=`html body :is(select,.type-editor-fields select,.dropdown-preview){background-image:url("data:image/svg+xml,${arrow}")!important}`;
    const mask=encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="${iconStroke}" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`);
    css+=`html body :is(.type-editor,.review-fold,.owner-settings,.outbound-more,.model-provider,details.fold)>summary::after{mask-image:url("data:image/svg+xml,${mask}");-webkit-mask-image:url("data:image/svg+xml,${mask}");color:var(--maya-icon-color)!important;opacity:var(--maya-icon-opacity)!important}`;
    css+=`html body :is(.maya-icon-button,.maya-inline-icon,.maya-pill,.adm-tab,#msg-begin,summary) svg{color:var(--maya-icon-color)!important;opacity:var(--maya-icon-opacity)!important;stroke-width:var(--maya-icon-stroke)!important}`;
    css+=`html body #submissions-heading{margin-top:${sp.submissions}px!important}html body #adm-mkt #leads-fold{margin-top:${sp.leads}px!important}html body #adm-mkt #ads-fold{margin-top:${sp.ads}px!important}html body #adm-mkt #bottom-fold{margin-top:${sp.insights}px!important}`;
    // Explicit content markers include the visible empty-state fallback after a hidden feed.
    css+=`html body #adm-scroll [data-maya-section-heading],html body #adm-scroll [data-maya-section]>summary{margin-bottom:0!important;padding-bottom:0!important}html body #adm-scroll [data-maya-section]>summary>h2{margin-block:0!important}html body #adm-scroll [data-maya-section-content]{margin-top:var(--maya-section-heading-gap)!important}`;
    css+=`html body .spacing-preview [data-spacing]{margin-top:var(--preview-spacing,0px)}html body .spacing-preview [data-heading-gap]{margin-top:var(--maya-section-heading-gap)}html body .spacing-preview [data-preview-heading]{margin-bottom:0}`;
    let node=document.getElementById('maya-presentation-control-style');if(!node){node=document.createElement('style');node.id='maya-presentation-control-style';document.head.append(node);}node.textContent=css;
    document.querySelectorAll('.spacing-preview [data-spacing]').forEach(e=>e.style.setProperty('--preview-spacing',sp[e.dataset.spacing]+'px'));
  }
  window.MayaPresentationControls={apply,defaults,statuses};
})();
