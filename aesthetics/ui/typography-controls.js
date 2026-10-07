/* Saved design settings are public presentation data. The owner saves them
   through the Admin authenticated API; local previews use same-origin storage. */
(() => {
  const defaults = {
    type: {
      H0:{size:104,weight:400,color:'white'},
      H1:{size:24,weight:300,color:'white'}, H2:{size:20,weight:400,color:'white'},
      H3:{size:16,weight:400,color:'white'}, H4:{size:14,weight:400,color:'white'},
      H5:{size:14,weight:400,color:'white'}, H6:{size:10,weight:300,color:'gray'},
      P1:{size:12,weight:300,color:'gray'}, P2:{size:12,weight:400,color:'white'},
      P3:{size:10,weight:300,color:'white'}, P4:{size:10,weight:400,color:'gray'}
    },
    finish:'current',glass:{fill:18,tint:0,rim:22,highlight:28,blur:22,saturation:180},
    overlay:{fill:18,rim:22,blur:22,saturation:180,radius:12},editor:{fill:100,rim:14,radius:12,paddingX:8,paddingY:8,background:'black',borderColor:'white'},pillX:14,pillY:6,iconSize:28,dropdownHeight:28,iconPillGap:6,iconTextGap:8
  };
  for(const [role,t] of Object.entries(defaults.type))Object.assign(t,{style:'normal',font:['H0','H1','H2'].includes(role)?'cormorant':'jost',case:role==='H0'||role==='H1'||role==='P3'||role==='P4'?'uppercase':'none'});
  const surfaceDefaults={background:'black',blur:22,saturation:180,fill:18,rim:22,radius:12,paddingX:16,paddingY:12};
  defaults.inner={borderColor:'white',...surfaceDefaults,width:100};
  defaults.filter={borderColor:'white',...surfaceDefaults,fill:88,width:280};
  const tableType={font:'jost',size:12,weight:400,color:'white',case:'none',align:'left',vertical:'middle',style:'normal'};
  defaults.table={blur:22,saturation:180,columnWidths:{},outerWidth:1,innerWidth:1,innerBorderColor:'white',innerRim:22,radius:12,borderColor:'white',background:'black',fill:18,rim:22,paddingX:12,paddingY:4,
    header:{...tableType,color:'gray',align:'center',background:'gray',opacity:100},
    firstColumn:{background:'gray',opacity:100},
    cells:{},columns:[{...tableType,font:'cormorant'},{...tableType,align:'center'},{...tableType},{...tableType}]};
  function normalizeSurfaces(v){
    v.iconPillGap ??= defaults.iconPillGap;v.iconTextGap ??= defaults.iconTextGap;v.iconSize ??= defaults.iconSize;v.dropdownHeight ??= defaults.dropdownHeight;v.inner={...defaults.inner,...v.inner};v.filter={...defaults.filter,...v.filter};
    const t=v.table||{};v.table={...defaults.table,...t,innerRim:t.innerRim??t.rim??defaults.table.innerRim,innerBorderColor:t.innerBorderColor??t.borderColor??defaults.table.innerBorderColor,columnWidths:{...t.columnWidths},cells:{...t.cells},header:{...defaults.table.header,...t.header},firstColumn:{...defaults.table.firstColumn,...t.firstColumn},columns:defaults.table.columns.map((c,i)=>({...c,...t.columns?.[i]}))};
    // Legacy cell saves now become whole-column settings in preview, not writes.
    for(const [i,col] of [[1,'stage'],[2,'note']]){
      const first=Object.entries(v.table.cells).filter(([key])=>new RegExp('^'+col+'-(0|[1-9][0-9]?)$').test(key)).sort(([a],[b])=>Number(a.split('-')[1])-Number(b.split('-')[1]))[0];
      if(first)Object.assign(v.table.columns[i],first[1]);
    }
    v.table.cells={};return v;
  }
  function applySurfaces(value){
    const v=normalizeSurfaces(structuredClone(value));
    const n=(value,max)=>Number.isInteger(value)?Math.max(0,Math.min(max,value)):0;
    const palette={black:'0 0 0',gray:'13 17 32',blue:'35 76 125',yellow:'120 91 15',green:'23 91 59',pink:'115 46 70'};
    const bg=s=>`rgb(${palette[s.background]||palette.gray} / ${n(s.opacity,100)/100})`;
    const border=s=>s.borderColor==='black'?'0 0 0':s.borderColor==='gray'?'170 181 196':'255 255 255';
    const material=s=>`background-color:rgb(${palette[s.background]||"3 15 29"} / ${n(s.fill,100)/100})!important;border:1px solid rgb(${border(s)} / ${n(s.rim,100)/100})!important;border-radius:${n(s.radius,24)}px!important;backdrop-filter:blur(${n(s.blur,40)}px) saturate(${n(s.saturation,200)}%)!important;-webkit-backdrop-filter:blur(${n(s.blur,40)}px) saturate(${n(s.saturation,200)}%)!important;padding:${n(s.paddingY,40)}px ${n(s.paddingX,40)}px!important;`;
    let css=`html body :is(#panels .inner-panel,#cell-format-toolbar,.automation-rule,.msg-call-line:has(details[open]),html[data-maya-surface="dense"] .panel:not(:has(table)),html[data-maya-surface="dense"] .model-group,html[data-maya-surface="dense"] .detail){${material(v.inner)}width:${n(v.inner.width,100)}%!important;max-width:100%;margin-inline:auto;box-sizing:border-box;}`;
    css+=`html body :is(.lead-status-menu,.maya-filter-popover,.filter-preview){${material(v.filter)}width:${n(v.filter.width,600)}px!important;max-width:calc(100vw - 32px)!important;box-sizing:border-box;}`;
    const scope='html body table';
    const t=v.table;
    const typography=s=>`font-family:${s.font==='cormorant'?"'Cormorant Garamond',serif":"'Jost',sans-serif"}!important;font-size:${n(s.size,32)}px!important;font-weight:${Number.isInteger(s.weight)&&s.weight>=200&&s.weight<=500?s.weight:400}!important;font-style:${s.style==='italic'?'italic':'normal'}!important;color:${color(s.color)}!important;text-transform:${s.case==='uppercase'?'uppercase':'none'}!important;text-align:${['left','center','right'].includes(s.align)?s.align:'left'}!important;`;
    css+=`${scope}{--line:rgb(${border(t)} / ${n(t.rim,100)/100});--maya-line:var(--line);background-color:rgb(${palette[t.background]||palette.black} / ${n(t.fill,100)/100})!important;border:${n(t.outerWidth,8)}px solid rgb(${border(t)} / ${n(t.rim,100)/100})!important;border-radius:${n(t.radius,24)}px!important;border-collapse:separate!important;border-spacing:0!important;backdrop-filter:blur(${n(t.blur,40)}px) saturate(${n(t.saturation,200)}%)!important;}`;
    const tableHousing='html body :is(.panel:has(>table),#leads-fold .panel,.people-scroll,#table-preview)';
    css+=`${tableHousing}{background-color:rgb(${palette[t.background]||palette.black} / ${n(t.fill,100)/100})!important;border:${n(t.outerWidth,8)}px solid rgb(${border(t)} / ${n(t.rim,100)/100})!important;border-radius:${n(t.radius,24)}px!important;padding:0!important;backdrop-filter:blur(${n(t.blur,40)}px) saturate(${n(t.saturation,200)}%)!important;-webkit-backdrop-filter:blur(${n(t.blur,40)}px) saturate(${n(t.saturation,200)}%)!important;width:100%!important;max-width:100%;box-sizing:border-box;overflow:auto;contain:paint}`;
    css+=`${tableHousing} table{border:0!important;border-radius:0!important;background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`;
    const widths=t.columnWidths||{},widthScope='html body :is(#leads-table,#table-preview table)';
    if(Object.keys(widths).length){const total=['name','contact','stage','note'].reduce((sum,key)=>sum+(widths[key]||({name:260,contact:160,stage:180,note:360}[key])),0);css+=`${widthScope}{table-layout:fixed!important;width:${total}px!important;min-width:${total}px!important}`;for(const key of ['name','contact','stage','note'])css+=`${widthScope} th[data-col="${key}"]{width:${widths[key]||({name:260,contact:160,stage:180,note:360}[key])}px!important;box-sizing:border-box;min-width:0!important;max-width:none!important}`;css+=`${widthScope} td{width:auto!important;min-width:0!important;max-width:none!important;overflow:hidden;text-overflow:ellipsis}${widthScope} td[data-col="stage"] .lead-stage{width:100%!important;max-width:100%!important;min-width:0!important}`;}
    const grid=`${n(t.innerWidth,8)}px solid rgb(${border({borderColor:t.innerBorderColor})} / ${n(t.innerRim,100)/100})`;
    css+=`${scope} :is(td,th){border:0!important}${scope} tr>:not(:last-child){border-right:${grid}!important}${scope} tr:not(:last-child)>*,${scope}:has(tbody tr) thead tr:last-child>*{border-bottom:${grid}!important}`;
    css+=`${scope} :is(td,th){padding:${n(t.paddingY,40)}px ${n(t.paddingX,40)}px!important;}`;
    css+=`html body table:not(.people-table) :is(td.lead-col-first,td:first-child),html body .people-table td[data-sheet-col=\"0\"]{background-color:${bg(t.firstColumn)}!important;}`;
    t.columns.forEach((c,i)=>{
      const col=['name','stage','note','contact'][i];
      const cell=`${scope} td[data-col="${col}"]`;
      css+=`${cell},${cell} :is(.lead-open,.lead-note-vp,.lead-note-vp>span){${typography(c)}}`;
      if(c.background!==undefined)css+=`${cell}{background-color:${bg(c)}!important;}`;
      css+=`${cell}{vertical-align:${['top','middle','bottom'].includes(c.vertical)?c.vertical:'middle'}!important;}`;
      if(i===1)css+=`${cell} :is(.status-pill,.status-text,.lead-stage){${typography(c).replace(/color:[^;]+!important;/,'')}}`;
      if(i===0)css+=`${cell} .lead-open{justify-content:${c.align==='right'?'flex-end':c.align==='center'?'center':'flex-start'}!important;}`;
    });
    css+=`html body .people-table td{${typography(t.columns[2])}}html body .people-table td[data-sheet-col=\"3\"],html body .people-table .person-link{${typography(t.columns[0])}}html body .people-table td[data-sheet-col=\"7\"]{${typography(t.columns[1])}}`;
    if(t.columns[0].background!==undefined)css+=`html body .people-table td[data-sheet-col="3"]{background-color:${bg(t.columns[0])}!important;}`;
    if(t.columns[2].background!==undefined)css+=`html body .people-table td:not([data-sheet-col="0"]):not([data-sheet-col="3"]):not([data-sheet-col="7"]){background-color:${bg(t.columns[2])}!important;}`;
    if(t.columns[1].background!==undefined)css+=`html body .people-table td[data-sheet-col="7"]{background-color:${bg(t.columns[1])}!important;}`;
    const headerScope='html body :is(#table-preview,#leads-table,.people-table,table) th';
    css+=`${headerScope} :is(button,span){${typography(t.header)}}`;
    css+=`${headerScope}{${typography(t.header)}vertical-align:${['top','middle','bottom'].includes(t.header.vertical)?t.header.vertical:'middle'}!important;background-color:${bg(t.header)}!important;}`;
    let style=document.getElementById('maya-surface-control-style');if(!style){style=document.createElement('style');style.id='maya-surface-control-style';document.head.append(style);}style.textContent=css;
  }
  const weightFonts=document.createElement('link');weightFonts.rel='stylesheet';weightFonts.href='https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,200..500;1,200..500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap';document.head.append(weightFonts);
  const local = ['localhost','127.0.0.1','maya.test'].includes(location.hostname);
  const key = 'maya-typography-controls-v1';
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('maya-typography-controls') : null;
  const color = name => name === 'white' ? 'rgb(255 255 255)' : 'rgb(170 181 196)';
  const font = role => ['H0','H1','H2'].includes(role) ? "'Cormorant Garamond',serif" : "'Jost',sans-serif";
  // Older saved designs retain all four headings and map the retired P3
  // technical role into P1, old P4 pills into P3, and old P5 captions into P4.
  function normalize(value) {
    if (!value?.type || !value?.glass || !value?.overlay) return structuredClone(defaults);
    const v=structuredClone(value);
    if(v.type.P5){v.type.P3=v.type.P4;v.type.P4=v.type.P5;delete v.type.P5;}
    for(const [role,t] of Object.entries(defaults.type))v.type[role]={...t,font:['H0','H1','H2'].includes(role)?'cormorant':'jost',case:role==='H0'||role==='H1'||role==='P3'||role==='P4'?'uppercase':'none',...v.type[role]};
    v.editor={...defaults.editor,...v.editor,paddingX:v.editor?.paddingX??v.editor?.padding??defaults.editor.paddingX,paddingY:v.editor?.paddingY??v.editor?.padding??defaults.editor.paddingY};delete v.editor.padding;
    return normalizeSurfaces(v);
  }
  function apply(value) {
    const v=normalize(value);currentDesign=v;revision++;
    let css=':root{';
    for (const [role,t] of Object.entries(v.type)) {
      if (!defaults.type[role] || !Number.isInteger(t.size) || (!Number.isInteger(t.weight)||t.weight<200||t.weight>500) || !['white','gray'].includes(t.color)) continue;
      css+=`--maya-type-${role}-align:${['left','center','right'].includes(t.align)?t.align:'left'};--maya-type-${role}-size:${t.size}px;--maya-type-${role}-weight:${t.weight};--maya-type-${role}-style:${t.style==='italic'?'italic':'normal'};--maya-type-${role}-color:${color(t.color)};--maya-type-${role}-font:${t.font==='cormorant'?"'Cormorant Garamond',serif":t.font==='jost'?"'Jost',sans-serif":font(role)};--maya-type-${role}-case:${t.case==='uppercase'?'uppercase':'none'};`;
    }
    const g=v.glass,o=v.overlay;const paletteOverlay=k=>({black:'0 0 0',gray:'13 17 32',blue:'35 76 125',yellow:'120 91 15',green:'23 91 59',pink:'115 46 70'})[k]||'3 15 29';
    for(const [k,n,max] of [['fill',g.fill,100],['tint',g.tint,100],['rim',g.rim,100],['highlight',g.highlight,100],['blur',g.blur,40],['saturation',g.saturation,200],['pillX',v.pillX,32],['pillY',v.pillY,16]]) if(Number.isInteger(n)&&n>=0&&n<=max) css+=`--maya-control-${k}:${n}${['blur','pillX','pillY'].includes(k)?'px':k==='saturation'?'%':'%'};`;
    css+=`--maya-icon-pill-gap:${v.iconPillGap}px;--maya-icon-text-gap:${v.iconTextGap}px;--maya-control-icon-size:${v.iconSize}px;--maya-control-dropdown-height:${v.dropdownHeight}px;--maya-text-body:var(--maya-type-P1-size);--maya-text-table:var(--maya-type-P1-size);--maya-text-section:var(--maya-type-H3-size);--maya-text-metric:var(--maya-type-H4-size);--maya-text-caption:var(--maya-type-P4-size);--ui-font:var(--maya-type-P1-font);--ui-pill-font-size:var(--maya-type-P3-size);--ui-pill-weight:var(--maya-type-P3-weight);--ui-pill-padding-x:${v.pillX}px;--ui-pill-padding-y:${v.pillY}px;`;
    css+=`--maya-button-fill:rgb(3 15 29 / var(--maya-control-fill));--maya-button-edge:rgb(${g.borderColor==='black'?'0 0 0':g.borderColor==='gray'?'170 181 196':'255 255 255'} / var(--maya-control-rim));--maya-button-frost:blur(var(--maya-control-blur)) saturate(var(--maya-control-saturation));`;
    css+=`--maya-frost:blur(${o.blur}px) saturate(${o.saturation}%);--maya-quiet-frost:var(--maya-frost);--maya-drawer-frost:var(--maya-frost);--maya-surface:rgb(3 15 29 / ${o.enabled===false?0:o.fill/100});--maya-line:rgb(${o.borderColor==='black'?'0 0 0':o.borderColor==='gray'?'170 181 196':'255 255 255'} / ${o.enabled===false?0:o.rim/100});`;
    css+=`--review-panel-border-rgb:${o.borderColor==='black'?'0 0 0':o.borderColor==='gray'?'170 181 196':'255 255 255'};--maya-review-panel-radius:${Number.isInteger(o.radius)?o.radius:12}px;--maya-review-panel-fill:${o.enabled===false?0:o.fill/100};--maya-review-panel-rim:${o.enabled===false?0:o.rim/100};--maya-review-panel-blur:${o.enabled===false?0:o.blur}px;--maya-review-panel-saturation:${o.enabled===false?100:o.saturation}%;}`;
    css+=`html body :is(select,.type-editor-fields select,.dropdown-preview){appearance:none!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23aab5c4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")!important;background-position:right 10px center!important;background-size:14px 14px!important;background-repeat:no-repeat!important;padding-right:30px!important}html body :is(.adm-tab,.maya-action-btn){background-color:var(--maya-button-fill);border-color:var(--maya-button-edge);backdrop-filter:var(--maya-button-frost);background-image:linear-gradient(125deg,rgb(255 255 255 / var(--maya-control-tint)),transparent 55%);box-shadow:inset 0 1px 1px rgb(255 255 255 / var(--maya-control-highlight)),0 4px 16px rgb(0 0 0 / .22)}`;
    const chevron=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
    css+=`html body :is(.type-editor,.review-fold,.owner-settings,.outbound-more,.model-provider,html[data-maya-surface="dense"] details.fold)>summary{display:flex;align-items:center;gap:6px;list-style:none}html body :is(.type-editor,.review-fold,.owner-settings,.outbound-more,.model-provider,html[data-maya-surface="dense"] details.fold)>summary::-webkit-details-marker{display:none}html body :is(.type-editor,.review-fold,.owner-settings,.outbound-more,.model-provider,html[data-maya-surface="dense"] details.fold)>summary::after{content:''!important;display:inline-block;width:14px!important;height:14px!important;flex:none;border:0!important;background:currentColor;mask:${chevron} center/contain no-repeat;-webkit-mask:${chevron} center/contain no-repeat;transform:rotate(-90deg)!important;align-self:center}html body :is(.type-editor,.review-fold,.owner-settings,.outbound-more,.model-provider,html[data-maya-surface="dense"] details.fold)[open]>summary::after{transform:none!important}`;
    css+=`html body :is(.review-fold,html[data-maya-surface="dense"] details.fold)>summary>:is(h2,h3){margin-block:0!important}`;
    css+=`html body :is(.maya-icon-button,#menu-toggle,#sync-sheet,#new-campaign){width:var(--maya-control-icon-size)!important;height:var(--maya-control-icon-size)!important;min-width:0!important;padding:0!important}html body :is(select,.lead-filter>summary,.column-filter){min-height:var(--maya-control-dropdown-height)!important}html body .maya-icon-button svg{width:60%;height:60%}`;
    css+=`.maya-glass-button,.maya-pill,#voice-bar{padding-inline:var(--maya-control-pillX,14px);padding-block:var(--maya-control-pillY,6px);}`;
    // Icons center on their row, never on the text baseline. Two independent gaps.
    css+=`html body :is(button,a,summary,h1,h2,h3,.maya-pill,.status-pill):has(>svg),html body label:not(:has(input,select,textarea)):has(>svg){display:inline-flex!important;align-items:center!important;vertical-align:middle;gap:var(--maya-icon-pill-gap);}
html body :is(.maya-icon-row,.msg-name-edit){display:inline-flex;align-items:center!important;gap:var(--maya-icon-text-gap)!important;vertical-align:middle;}
html body .maya-icon-row>*{align-self:center!important}html body .maya-icon-row>span{line-height:1}html body .maya-icon-row .lead-filter{margin:0!important;vertical-align:middle;}
html body :is(.maya-icon-button,.maya-inline-icon,.adm-tab,.msg-rename,.lead-filter>summary){display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1;padding-block:0;}
html body :is(button,a,summary,.maya-icon-row) svg{display:block;flex-shrink:0;align-self:center;margin-block:0;vertical-align:middle;}
html body .maya-inline-icon{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0;color:inherit;cursor:pointer;}html body :is(.maya-inline-icon,.maya-icon-row) svg,html body .maya-pill>svg{width:calc(var(--maya-control-icon-size)*.6);height:calc(var(--maya-control-icon-size)*.6);}
html body :is(.maya-pill,.maya-glass-button,.status-pill){gap:var(--maya-icon-pill-gap)!important;}
html body .status-pill:is([data-status="completed"],:has(option[value="completed"]:checked)){--status-color:var(--maya-booked);}
html body .lead-status{padding-right:calc(10px + var(--maya-icon-pill-gap) + var(--maya-control-icon-size)*.45)!important;}
html body .lead-status::after{top:50%;right:10px;width:calc(var(--maya-control-icon-size)*.45);height:calc(var(--maya-control-icon-size)*.45);border:0;background:currentColor;transform:translateY(-50%);mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;}
html body select{padding-right:calc(22px + var(--maya-icon-pill-gap))!important;}
html body :is(.type-editor,.finish-controls details,.overlay-controls details)>summary{gap:var(--maya-icon-text-gap)!important;}
html body #adm-mkt #leads-table .lead-stage:has(option[value="completed"]:checked){color:var(--maya-booked);}`;
    css+=`html body #outbound-drawer button:not([role=tab]):not(#close-drawer){border:1px solid var(--maya-button-edge);border-radius:100px;padding:var(--ui-pill-padding-y) var(--ui-pill-padding-x);color:var(--maya-type-P3-color)}`;
    css+=`html body :is(h1,#client-name-modal-title,#top-left-brand .brand-title,#brand-title,.signin-wordmark:not(.maya-signin-h0),.brand-title){font-family:var(--maya-type-H1-font)!important;font-size:var(--maya-type-H1-size)!important;font-weight:var(--maya-type-H1-weight)!important;color:var(--maya-type-H1-color)}`;
    css+=`.gallery-section-title,#adm-tabtitle,.pg-tabtitle,.drawer-head-title,.drawer-title{font-family:var(--maya-type-H2-font)!important;font-size:var(--maya-type-H2-size)!important;font-weight:var(--maya-type-H2-weight)!important;color:var(--maya-type-H2-color)}`;
    css+=`.gallery-subsection-title,h2.grp,.section-title,.subheadline{font-family:var(--maya-type-H3-font)!important;font-size:var(--maya-type-H3-size)!important;font-weight:var(--maya-type-H3-weight)!important;color:var(--maya-type-H3-color)}`;
    css+=`#adm-mkt .bl-step .v,#adm-mkt .bl-tile .v,.dashboard-number,.stat strong,.affiliate-stat strong{font-family:var(--maya-type-H4-font)!important;font-size:var(--maya-type-H4-size)!important;font-weight:var(--maya-type-H4-weight)!important;color:var(--maya-type-H4-color)}`;
    css+=`html body :is(p,.note,td,th,.msg-main,.bub,:where(#msg-input),.model-group){font-size:var(--maya-type-P1-size)!important;font-weight:var(--maya-type-P1-weight)}`;
    css+=`html body :is(.metric-label,.metric-value,.label-count,.status-pill,.stat span,.affiliate-stat span){font-size:var(--maya-type-P2-size)!important;font-weight:var(--maya-type-P2-weight)}`;
    css+=`html body :is(code,pre,.technical-text){font-size:var(--maya-type-P1-size)!important;font-weight:var(--maya-type-P1-weight)}`;
    css+=`html body :is(.maya-glass-button,.maya-pill,#voice-bar){font-size:var(--maya-type-P3-size)!important;font-weight:var(--maya-type-P3-weight)}`;
    css+=`html body :is(small,.caption,.bl-step .k,.bl-tile .k){font-size:var(--maya-type-P4-size)!important;font-weight:var(--maya-type-P4-weight)}`;
    css+=`html body :is(#drawer,#outbound-drawer,#notes-drawer){background-color:rgb(3 15 29 / max(.90,var(--maya-review-panel-fill)));border-color:rgb(var(--review-panel-border-rgb,255 255 255) / var(--maya-review-panel-rim));backdrop-filter:blur(var(--maya-review-panel-blur)) saturate(var(--maya-review-panel-saturation));}`;
    css+=`html body :is(.preview-section,.stat,.metric-row,.maya-surface,#adm-mkt .bl-tile){border-radius:var(--review-panel-radius,var(--maya-review-panel-radius))!important;background-color:rgb(${paletteOverlay(o.background)} / var(--maya-review-panel-fill));border-color:rgb(var(--review-panel-border-rgb,255 255 255) / var(--maya-review-panel-rim));backdrop-filter:blur(var(--maya-review-panel-blur)) saturate(var(--maya-review-panel-saturation));}`;
    css+=`html body :is(.maya-glass-button,.maya-pill,.maya-icon-button,#voice-bar,#outbound-drawer button:not([role=tab]):not(#close-drawer)):not([data-finish]){background-color:var(--maya-button-fill);border-color:var(--maya-button-edge);backdrop-filter:var(--maya-button-frost);-webkit-backdrop-filter:var(--maya-button-frost);background-image:linear-gradient(125deg,rgb(255 255 255 / var(--maya-control-tint)),transparent 55%);box-shadow:inset 0 1px 1px rgb(255 255 255 / var(--maya-control-highlight)),0 4px 16px rgb(0 0 0 / .22)}`;
    const selectors={H0:'.maya-signin-h0',H1:'h1,#brand-title,.brand-title,#client-name-modal-title,.signin-wordmark:not(.maya-signin-h0)',H2:'.gallery-section-title,#adm-tabtitle,.pg-tabtitle,.drawer-title,.drawer-head-title',H3:'#msg-name,.gallery-subsection-title,h2.grp,.section-title,.subheadline',H5:'.lead-identity',H6:'.lead-signup',H4:'#adm-mkt .bl-step .v,#adm-mkt .bl-tile .v,.dashboard-number,.stat strong,.affiliate-stat strong',P1:'p,td,th,.note,.msg-main,.bub,:where(#msg-input),.model-group',P2:'.metric-label,.metric-value,.maya-metric-label,.maya-metric-value,.label-count,.status-pill,.stat span,.affiliate-stat span',P3:'.maya-pill,.maya-glass-button,button.glass-pill,button.action-btn,button.modal-text-btn,button.drawer-action,button.pin-cta,button.tos-agree,button.tos-decline,button.upload-choose-btn,button.tip-amt,button.primary,button.pill,button.inv-btn,button.msg-call,button.msg-send,button.lead-tool,button.lead-cta,button.range-chip,button.metric-chip,button.wide,button.campaign,button.dissect-start,button.upload-btn,button.fab-src-pill,button.piece-pill,button.quality-pill,.dialog-actions button,.actions button,maya-ai-meter button,maya-owner-crm button,#voice-bar',P4:'small,.caption,.bub-when,.bl-step .k,.bl-tile .k'};
    for(const [role,selector] of Object.entries(selectors))css+=`html body :is(${selector}){font-size:var(--maya-type-${role}-size)!important;font-weight:var(--maya-type-${role}-weight)!important;font-style:var(--maya-type-${role}-style)!important;font-family:var(--maya-type-${role}-font)!important;text-transform:var(--maya-type-${role}-case)!important}`;
    for(const [role,selector] of Object.entries(selectors))if(role.startsWith('P')||['H5','H6'].includes(role))css+=`html body :is(${selector}):not(.status-pill):not(.status-example){color:var(--maya-type-${role}-color)!important}`;
    for(const [role,selector] of Object.entries(selectors))if(['left','center','right'].includes(v.type[role]?.align))css+=`html body :is(${selector}){text-align:var(--maya-type-${role}-align)!important}`;
    for(const [role,selector] of Object.entries(selectors))if(['top','middle','bottom'].includes(v.type[role]?.vertical))css+=`html body :is(${selector}){vertical-align:${v.type[role].vertical}!important}`;
    css+='html body #signin-gate .maya-signin-h0{font-size:min(18vw,var(--maya-type-H0-size))!important;color:var(--maya-type-H0-color)!important}';
    css+='html body :is(code,pre,.technical-text){font-family:Menlo,monospace!important}';
    let style=document.getElementById('maya-typography-control-style');if(!style){style=document.createElement('style');style.id='maya-typography-control-style';document.head.append(style);}style.textContent=css;
    if(Number.isInteger(o.paddingX)&&Number.isInteger(o.paddingY))style.textContent+=`html body :is(.preview-section,.maya-surface,.stat,#adm-mkt .bl-tile,html[data-maya-surface="dense"] .layout>aside,html[data-maya-surface="dense"] .layout>main){padding:var(--review-panel-paddingY,${o.paddingY}px) var(--review-panel-paddingX,${o.paddingX}px)!important}`;
    applySurfaces(v);
    previewEditor(v.editor);
    document.dispatchEvent(new CustomEvent('maya-design-applied',{detail:v}));
  }
  function previewEditor(e){
    const palette={black:'0 0 0',gray:'13 17 32',blue:'35 76 125',yellow:'120 91 15',green:'23 91 59',pink:'115 46 70'};
    let node=document.getElementById('maya-editor-control-style');if(!node){node=document.createElement('style');node.id='maya-editor-control-style';document.head.append(node);}
    node.textContent=`html body :is(.type-editor-fields,.maya-model-popover,.lead-status-menu,.maya-filter-popover,.lead-stage-menu,:where(#msg-share-menu)){background:rgb(${palette[e.background]||palette.black} / ${e.fill/100})!important;border:1px solid rgb(${e.borderColor==='black'?'0 0 0':e.borderColor==='gray'?'170 181 196':'255 255 255'} / ${e.rim/100})!important;border-radius:${e.radius}px!important;padding:${e.paddingY??e.padding??8}px ${e.paddingX??e.padding??8}px!important;}`;
  }
  let revision=0,currentDesign;
  async function load(){const started=revision;if(local){let value;try{value=JSON.parse(localStorage.getItem(key)||'null')||defaults;}catch{value=defaults;}value=normalize(value);apply(value);return value;}
    try{const r=await fetch('/api/design',{cache:'no-store'});if(!r.ok)throw Error('design');const value=normalize(await r.json());if(started===revision)apply(value);return currentDesign||value;}catch{if(!currentDesign)apply(defaults);return currentDesign||defaults;}
  }
  async function save(value){if(local){localStorage.setItem(key,JSON.stringify(value));apply(value);channel?.postMessage(value);return 'Saved locally.';}
    const token=localStorage.getItem('maya_admin_tok');if(!token)throw Error('Sign in to Admin before saving.');
    const r=await fetch('/api/admin/design',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(value)});
    if(!r.ok)throw Error(r.status===403?'Admin access required.':'Save failed ('+r.status+').');const result=await r.json();localStorage.setItem(key,JSON.stringify(value));apply(value);channel?.postMessage(value);document.dispatchEvent(new CustomEvent('maya-design-saved',{detail:{savedAt:result.savedAt}}));return 'Saved.';
  }
  window.addEventListener('storage',e=>{if(e.key===key&&e.newValue){try{const v=JSON.parse(e.newValue);if(v?.type&&v?.glass)apply(v);}catch{}}});
  const revalidate=()=>{if(!location.pathname.endsWith('aesthetic-control.html'))void load();};
  window.addEventListener('focus',revalidate);document.addEventListener('visibilitychange',()=>{if(!document.hidden)revalidate();});
  if(channel)channel.onmessage=e=>{if(e.data?.type&&e.data?.glass)apply(e.data);};
  window.MayaTypographyControls={defaults,normalize,apply,previewSurfaces:applySurfaces,previewEditor,load,save,ready:load()};
})();
