/* Saved design settings are public presentation data. The owner saves them
   through the Admin authenticated API; local previews use same-origin storage. */
(() => {
  const defaults = {
    type: {
      H1:{size:24,weight:300,color:'white'}, H2:{size:20,weight:400,color:'white'},
      H3:{size:16,weight:400,color:'white'}, H4:{size:14,weight:400,color:'white'},
      P1:{size:12,weight:300,color:'gray'}, P2:{size:12,weight:400,color:'white'},
      P3:{size:10,weight:300,color:'white'}, P4:{size:10,weight:400,color:'gray'}
    },
    finish:'current',glass:{fill:18,tint:0,rim:22,highlight:28,blur:22,saturation:180},
    overlay:{fill:18,rim:22,blur:22,saturation:180},editor:{fill:30,rim:14,radius:12,padding:8},pillX:14,pillY:6
  };
  const local = ['localhost','127.0.0.1','maya.test'].includes(location.hostname);
  const key = 'maya-typography-controls-v1';
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('maya-typography-controls') : null;
  const color = name => name === 'white' ? 'rgb(255 255 255)' : 'rgb(170 181 196)';
  const font = role => ['H1','H2'].includes(role) ? "'Cormorant Garamond',serif" : "'Jost',sans-serif";
  // Older saved designs retain all four headings and map the retired P3
  // technical role into P1, old P4 pills into P3, and old P5 captions into P4.
  function normalize(value) {
    if (!value?.type || !value?.glass || !value?.overlay) return structuredClone(defaults);
    const v=structuredClone(value);
    if(v.type.P5){v.type.P3=v.type.P4;v.type.P4=v.type.P5;delete v.type.P5;}
    v.editor={...defaults.editor,...v.editor};
    return v;
  }
  function apply(value) {
    const v=normalize(value);
    let css=':root{';
    for (const [role,t] of Object.entries(v.type)) {
      if (!defaults.type[role] || !Number.isInteger(t.size) || ![300,350,400].includes(t.weight) || !['white','gray'].includes(t.color)) continue;
      css+=`--maya-type-${role}-align:${t.align==='center'?'center':'left'};--maya-type-${role}-size:${t.size}px;--maya-type-${role}-weight:${t.weight};--maya-type-${role}-color:${color(t.color)};--maya-type-${role}-font:${font(role)};`;
    }
    const g=v.glass,o=v.overlay;
    for(const [k,n,max] of [['fill',g.fill,100],['tint',g.tint,100],['rim',g.rim,100],['highlight',g.highlight,100],['blur',g.blur,40],['saturation',g.saturation,200],['pillX',v.pillX,32],['pillY',v.pillY,16]]) if(Number.isInteger(n)&&n>=0&&n<=max) css+=`--maya-control-${k}:${n}${['blur','pillX','pillY'].includes(k)?'px':k==='saturation'?'%':'%'};`;
    css+='--maya-button-fill:rgb(3 15 29 / var(--maya-control-fill));--maya-button-edge:rgb(255 255 255 / var(--maya-control-rim));--maya-button-frost:blur(var(--maya-control-blur)) saturate(var(--maya-control-saturation));';
    css+=`--maya-review-panel-fill:${o.enabled===false?0:o.fill/100};--maya-review-panel-rim:${o.enabled===false?0:o.rim/100};--maya-review-panel-blur:${o.enabled===false?0:o.blur}px;--maya-review-panel-saturation:${o.enabled===false?100:o.saturation}%;}`;
    css+=`.maya-glass-button,.maya-pill,#voice-bar{padding-inline:var(--maya-control-pillX,14px);padding-block:var(--maya-control-pillY,6px);}`;
    css+=`html body :is(h1,#client-name-modal-title,#top-left-brand .brand-title,#brand-title,.signin-wordmark,.brand-title){font-family:var(--maya-type-H1-font)!important;font-size:var(--maya-type-H1-size)!important;font-weight:var(--maya-type-H1-weight)!important;color:var(--maya-type-H1-color)}`;
    css+=`#adm-tabtitle,.pg-tabtitle,.drawer-head-title,.drawer-title{font-family:var(--maya-type-H2-font)!important;font-size:var(--maya-type-H2-size)!important;font-weight:var(--maya-type-H2-weight)!important;color:var(--maya-type-H2-color)}`;
    css+=`h2.grp,.section-title,.subheadline{font-family:var(--maya-type-H3-font)!important;font-size:var(--maya-type-H3-size)!important;font-weight:var(--maya-type-H3-weight)!important;color:var(--maya-type-H3-color)}`;
    css+=`#adm-mkt .bl-step .v,#adm-mkt .bl-tile .v,.dashboard-number,.stat strong,.affiliate-stat strong{font-family:var(--maya-type-H4-font)!important;font-size:var(--maya-type-H4-size)!important;font-weight:var(--maya-type-H4-weight)!important;color:var(--maya-type-H4-color)}`;
    css+=`html body :is(p,.note,td,th,.msg-main,.model-group){font-size:var(--maya-type-P1-size)!important;font-weight:var(--maya-type-P1-weight)}`;
    css+=`html body :is(.metric-label,.metric-value,.label-count,.status-pill,.stat span,.affiliate-stat span){font-size:var(--maya-type-P2-size)!important;font-weight:var(--maya-type-P2-weight)}`;
    css+=`html body :is(code,pre,.technical-text){font-size:var(--maya-type-P1-size)!important;font-weight:var(--maya-type-P1-weight)}`;
    css+=`html body :is(.maya-glass-button,.maya-pill,#voice-bar){font-size:var(--maya-type-P3-size)!important;font-weight:var(--maya-type-P3-weight)}`;
    css+=`html body :is(small,.caption,.bl-step .k,.bl-tile .k){font-size:var(--maya-type-P4-size)!important;font-weight:var(--maya-type-P4-weight)}`;
    css+=`html body :is(#drawer,#outbound-drawer,#notes-drawer){background-color:rgb(3 15 29 / max(.90,var(--maya-review-panel-fill)));border-color:rgb(255 255 255 / var(--maya-review-panel-rim));backdrop-filter:blur(var(--maya-review-panel-blur)) saturate(var(--maya-review-panel-saturation));}`;
    css+=`html body :is(.stat,.metric-row,#adm-mkt .bl-tile){background-color:rgb(3 15 29 / var(--maya-review-panel-fill));border-color:rgb(255 255 255 / var(--maya-review-panel-rim));backdrop-filter:blur(var(--maya-review-panel-blur)) saturate(var(--maya-review-panel-saturation));}`;
    css+=`html body :is(.maya-glass-button,.maya-pill,#voice-bar){background-image:linear-gradient(125deg,rgb(255 255 255 / var(--maya-control-tint)),transparent 55%);box-shadow:inset 0 1px 1px rgb(255 255 255 / var(--maya-control-highlight)),0 4px 16px rgb(0 0 0 / .22)}`;
    const selectors={H1:'h1,#brand-title,.brand-title,#client-name-modal-title',H2:'#adm-tabtitle,.pg-tabtitle,.drawer-title,.drawer-head-title',H3:'h2.grp,.section-title,.subheadline',H4:'.dashboard-number,.stat strong,.affiliate-stat strong',P1:'p,td,th,.note,.msg-main,.model-group',P2:'.metric-label,.metric-value,.label-count,.status-pill',P3:'.maya-pill,.maya-glass-button,#voice-bar',P4:'small,.caption,.bl-step .k,.bl-tile .k'};
    for(const [role,selector] of Object.entries(selectors))if(['left','center'].includes(v.type[role]?.align))css+=`html body :is(${selector}){text-align:var(--maya-type-${role}-align)!important}`;
    let style=document.getElementById('maya-typography-control-style');if(!style){style=document.createElement('style');style.id='maya-typography-control-style';document.head.append(style);}style.textContent=css;
    document.dispatchEvent(new CustomEvent('maya-design-applied',{detail:v}));
  }
  async function load(){if(local){let value;try{value=JSON.parse(localStorage.getItem(key)||'null')||defaults;}catch{value=defaults;}value=normalize(value);apply(value);return value;}
    try{const r=await fetch('/api/design',{cache:'no-store'});if(!r.ok)throw Error('design');const value=normalize(await r.json());apply(value);return value;}catch{apply(defaults);return defaults;}
  }
  async function save(value){if(local){localStorage.setItem(key,JSON.stringify(value));apply(value);channel?.postMessage(value);return 'Saved locally. Production changes require deployment and an Admin save on the live site.';}
    const token=localStorage.getItem('maya_admin_tok');if(!token)throw Error('Sign in to Admin before saving.');
    const r=await fetch('/api/admin/design',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(value)});
    if(!r.ok)throw Error(r.status===403?'Admin access required.':'Save failed ('+r.status+').');apply(value);channel?.postMessage(value);return 'Saved across MAYA pages.';
  }
  if(channel)channel.onmessage=e=>{if(e.data?.type&&e.data?.glass)apply(e.data);};
  window.MayaTypographyControls={defaults,normalize,apply,load,save,ready:load()};
})();
