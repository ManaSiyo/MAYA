import {Pill,GlassSurface,IconButton,Drawer,FilterPopover,Metric} from '/aesthetics/ui/components/components.js';
const gallery=document.querySelector('#gallery'),feedback=document.querySelector('#feedback');
const say=s=>feedback.textContent=s;
function section(title){const s=document.createElement('section');s.className='preview-section';const h=document.createElement('h2');h.textContent=title;s.append(h);gallery.append(s);return s;}
function row(parent){const r=document.createElement('div');r.className='preview-row';parent.append(r);return r;}
const pills=section('Pill · IconButton');
for(const state of ['default','hover','focus','selected','pressed','disabled','loading']){
 const wrap=document.createElement('div');wrap.className='state-sample';const title=document.createElement('span');title.textContent=state;
 const disabled=state==='disabled'||state==='loading';const pill=Pill({label:state==='loading'?'Listening…':'Tap to listen',purpose:'listen',disabled,selected:state==='selected',onClick:()=>say('Pill activated')});
 const icon=IconButton({label:'Add example',disabled,onClick:()=>say('Icon activated')});
 if(['hover','focus','pressed'].includes(state)){pill.dataset.previewState=state;icon.dataset.previewState=state;}
 if(state==='selected')icon.setAttribute('aria-pressed','true');if(state==='loading'){pill.setAttribute('aria-busy','true');icon.setAttribute('aria-busy','true');}
 wrap.append(title,pill,icon);row(pills).append(wrap);
}
// Group the state samples into one wrapping row.
const stateRow=document.createElement('div');stateRow.className='preview-row';pills.querySelectorAll('.state-sample').forEach(s=>stateRow.append(s));pills.querySelectorAll('.preview-row').forEach(r=>r.remove());pills.append(stateRow);
const material=section('GlassSurface · Material intensity');
for(const intensity of ['quiet','standard','overlay']){const content=document.createElement('div');content.textContent=intensity;const s=GlassSurface({content,intensity});row(material).append(s,Pill({label:'Action',intensity}),Metric({label:'All',value:262,intensity}));}
const metrics=section('Metric · Content width');row(metrics).append(Metric({label:'Contacted',value:207}),Metric({label:'Replied',value:0}),Metric({label:'Unavailable'}),Metric({label:'Large total',value:'10,000'}));
const overlays=section('Drawer · FilterPopover');const drawer=Drawer({title:'Systems',content:[Metric({label:'AI today',value:'$0.12'}),GlassSurface({content:'Connection details',intensity:'quiet'})],footer:[Pill({label:'Hey MAYA',purpose:'listen'})]});
let openDrawer;openDrawer=Pill({label:'Open drawer',onClick:()=>drawer.showFrom(openDrawer)});let openFilter;
const filter=FilterPopover({title:'Status',values:['Not contacted','Contacted','Booked'],onApply:v=>say(v.length?v.join(', '):'No statuses selected')});
openFilter=Pill({label:'Open filter',onClick:()=>filter.showFrom(openFilter)});row(overlays).append(openDrawer,openFilter);
for(const name of ['Client frontend','Admin / Outbound']){const sec=section(name);const content=document.createElement('div');content.className='context';const r=row(content);r.append(Pill({label:'Tap to listen',purpose:'listen'}),IconButton({label:'Refresh',icon:'↻'}),Pill({label:'Selected',selected:true}));
 if(name.startsWith('Admin')){const table=document.createElement('table');table.className='fake-table';table.innerHTML='<thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>Example lead</td><td>Contacted</td></tr></tbody>';content.append(table);}else{const p=document.createElement('p');p.textContent='A quieter frame for images and conversation.';content.append(p);}sec.append(GlassSurface({content,intensity:'quiet'}));}
const source=await (await fetch('/aesthetics/ui/components/tokens.css')).text();
const defaults=Object.fromEntries([...source.matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const storageKey='maya-component-gallery-tokens-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
let overrides={};
function valid(key,value){if(!value||/[;{}<>]|url\s*\(|var\s*\(/i.test(value))return false;
 if(/alpha|fill$|highlight$/.test(key))return /^0(?:\.\d+)?$|^1(?:\.0+)?$|^\.\d+$/.test(value);
 if(key==='--ui-pill-weight')return /^(300|400|500|600)$/.test(value);
 if(/(?:size|width|radius|blur|padding-[xy]|gap|space|tracking|shadow-y)$/.test(key))return /^\d+(?:\.\d+)?px$/.test(value)&&parseFloat(value)<=500;
 const property=key.endsWith('saturation')?'width':key.endsWith('duration')?'transition-duration':key.endsWith('easing')?'transition-timing-function':key.endsWith('transform')?'text-transform':key.endsWith('height')?'line-height':key.endsWith('font')?'font-family':'color';
 return CSS.supports(property,value);
}
const form=document.querySelector('#tokens');
for(const [key,value] of Object.entries(defaults)){const label=document.createElement('label'),input=document.createElement('input');label.textContent=key.replace('--ui-','');input.name=key;input.value=valid(key,saved[key]||'')?saved[key]:value;
 if(input.value!==value){overrides[key]=input.value;document.documentElement.style.setProperty(key,input.value);}input.addEventListener('input',()=>{const value=input.value.trim();const ok=valid(key,value);input.setAttribute('aria-invalid',String(!ok));if(!ok)return;overrides[key]=value;document.documentElement.style.setProperty(key,value);try{localStorage.setItem(storageKey,JSON.stringify(overrides));}catch{say('Preview updated; browser storage unavailable.');}});label.append(input);form.append(label);}
document.querySelector('#fallback').addEventListener('change',e=>document.body.classList.toggle('no-blur',e.target.checked));
document.querySelector('#reset').addEventListener('click',()=>{for(const key of Object.keys(defaults))document.documentElement.style.removeProperty(key);overrides={};try{localStorage.removeItem(storageKey);}catch{}for(const input of form.elements){input.value=defaults[input.name];input.removeAttribute('aria-invalid');}say('Defaults restored.');});
document.querySelector('#export').addEventListener('click',()=>{const css='/* MAYA preview tokens. Review before global application. */\n:root {\n'+Object.entries({...defaults,...overrides}).map(([k,v])=>'  '+k+': '+v+';').join('\n')+'\n}\n';const url=URL.createObjectURL(new Blob([css],{type:'text/css'}));const a=document.createElement('a');a.href=url;a.download='maya-tokens.css';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Tokens exported. Live pages are unchanged.');});
