import {setupOverlay} from './overlay.js';
import {setupFinishes} from './finishes.js';
import {Pill,GlassSurface,IconButton,Drawer,FilterPopover,Metric} from '/aesthetics/ui/components/components.js';
const gallery=document.querySelector('#gallery'),feedback=document.querySelector('#feedback');
const say=s=>feedback.textContent=s;
const storedDesign=await window.MayaTypographyControls.ready;
function section(title,id){const s=document.createElement('section');s.id=id;s.className='preview-section';const h=document.createElement('h2');h.textContent=title;s.append(h);gallery.append(s);return s;}
function row(parent){const r=document.createElement('div');r.className='preview-row';parent.append(r);return r;}
function heading(parent,title){const h=document.createElement('h3');h.textContent=title;parent.append(h);}
const preview=section('Glass Panels and Tables','pill-preview');
const buttons=document.createElement('div');buttons.id='buttons';preview.append(buttons);heading(buttons,'Glass Section');
const comparison=document.createElement('div');comparison.className='comparison';buttons.append(comparison);
const contextActions=row(buttons);contextActions.append(Pill({label:'Tap to listen',purpose:'listen',onClick:()=>say('Button preview')}));
const iconRow=row(buttons);iconRow.classList.add('icon-row');
for(const [label,icon] of [['Add','+'],['Close','×'],['Refresh','↻']])iconRow.append(IconButton({label,icon,onClick:()=>say(label+' preview')}));
for(const [label,path] of [['Menu','M4 6h16M4 12h16M4 18h16'],['Search','M10 4a6 6 0 1 0 0 12a6 6 0 0 0 0-12M15 15l5 5'],['Dropdown','M6 9l6 6 6-6']]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);iconRow.append(IconButton({label,icon:svg,onClick:()=>say(label+' preview')}));}
const colors=row(buttons);colors.id='pill-colors';
for(const [label,color] of [['Gray','#b5bdc8'],['Blue','#8abcf2'],['Yellow','#fbbf24'],['Green','#4ade80'],['Pink','#fda4af']]){const pill=Pill({label,onClick:()=>say(label+' preview')});pill.classList.add('status-example');pill.style.setProperty('--status-color',color);pill.setAttribute('aria-label',label+' pill');colors.append(pill);}
const states=document.createElement('details');states.innerHTML='<summary>States</summary>';buttons.append(states);const stateRow=row(states);
for(const state of ['default','hover','focus','selected','pressed','disabled','loading']){const wrap=document.createElement('div');wrap.className='state-sample';const label=document.createElement('span');label.textContent=state;const pill=Pill({label:'Tap to listen',purpose:'listen',disabled:['disabled','loading'].includes(state),selected:state==='selected',onClick:()=>say(state+' preview')});if(['hover','focus','pressed'].includes(state))pill.dataset.previewState=state;if(state==='loading')pill.setAttribute('aria-busy','true');wrap.append(label,pill);stateRow.append(wrap);}
const divider=document.createElement('hr');divider.className='visual-divider';preview.append(divider);
const panels=document.createElement('div');panels.id='panels';preview.append(panels);heading(panels,'Panels');
const surfaces=document.createElement('div');surfaces.className='context-grid';panels.append(surfaces);
for(const title of ['Lead Station','Campaign details']){const content=document.createElement('div');const h=document.createElement('h3');h.textContent=title;h.dataset.previewCategory='H3';const metric=Metric({label:'Contacts',value:12});content.append(h,metric);surfaces.append(GlassSurface({content,intensity:'quiet'}));}
const drawer=Drawer({title:'Systems',content:[Metric({label:'AI today',value:'$0.12'})]}),filter=FilterPopover({title:'Filter',values:['Gray','Blue','Green'],onApply:v=>say(v.join(', ')||'None')});
let openDrawer,openFilter;openDrawer=Pill({label:'Drawer',onClick:()=>drawer.showFrom(openDrawer)});openFilter=Pill({label:'Filter',onClick:()=>filter.showFrom(openFilter)});row(panels).append(openDrawer,openFilter);
const guide=document.createElement('div');guide.id='table-preview';panels.append(guide);
const table=document.createElement('table');table.className='text-guide';table.innerHTML='<thead><tr><th data-preview-category="P2">Name</th><th data-preview-category="P2">Category</th><th data-preview-category="P2">Color</th><th data-preview-category="P2">Notes</th></tr></thead><tbody><tr><td data-preview-category="P1">Alex</td><td data-preview-category="P1">Corporate</td><td><span class="maya-ui maya-glass maya-pill status-example" data-intensity="standard" style="--status-color:#8abcf2">Blue</span></td><td data-preview-category="P1">Appointment requested</td></tr><tr><td data-preview-category="P1">Sam</td><td data-preview-category="P1">Ceremonial</td><td><span class="maya-ui maya-glass maya-pill status-example" data-intensity="standard" style="--status-color:#4ade80">Green</span></td><td data-preview-category="P1">A longer note wraps within the table.</td></tr></tbody>';guide.append(table);
const fonts=section('Typography','fonts'),hierarchy=document.createElement('div');hierarchy.className='type-hierarchy';fonts.append(hierarchy);
const typeSettings=structuredClone(storedDesign.type||window.MayaTypographyControls.defaults.type);
const editorSettings={...window.MayaTypographyControls.defaults.editor,...storedDesign.editor};
function renderEditor(){for(const [key,value] of Object.entries(editorSettings))document.documentElement.style.setProperty('--type-editor-'+key,['radius','padding'].includes(key)?value+'px':value/100);}
renderEditor();
const housing=document.createElement('details');housing.className='housing-editor';housing.innerHTML='<summary>Editor panel</summary>';
for(const [key,label,max] of [['fill','Fill',100],['rim','Border',100],['radius','Corners',24],['padding','Padding',20]]){const labelNode=document.createElement('label'),input=document.createElement('input');labelNode.textContent=label;input.type='number';input.min=0;input.max=max;input.value=editorSettings[key];input.dataset.editorField=key;input.addEventListener('input',()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<0||n>max)return;editorSettings[key]=n;renderEditor();});labelNode.append(input);housing.append(labelNode);}
hierarchy.before(housing);
const roles=[['H1','brand','Maya','Brand'],['H2','drawer','Systems','Drawer'],['H3','subheadline','Campaign details','Lead Station / campaign details'],['H4','dashboard','12','Dashboard'],['P1','paragraph','Your next appointment.','Body / tables'],['P2','label','Contacts 12','Labels'],['P3','field','Name','Buttons / fields'],['P4','caption','Example data','Captions']];
for(const [category,key,text,where] of roles){
 typeSettings[category].align||='center';
 const group=document.createElement('section');group.className='type-group';group.dataset.category=category;
 const head=document.createElement('div');head.className='type-group-head';const title=document.createElement('h3');title.className='type-category';title.textContent=category;head.append(title);group.append(head);hierarchy.append(group);
 const edit=document.createElement('details');edit.className='type-editor';edit.innerHTML='<summary aria-label="Edit '+category+'">Edit</summary><div class="type-editor-fields"><label>Font <select data-field="font"><option value="jost">Jost</option><option value="cormorant">Cormorant</option></select></label><label>Case <select data-field="case"><option value="none">Normal</option><option value="uppercase">ALL CAPS</option></select></label><label>Size <input type="number" min="8" max="32" step="2" data-field="size"></label><label>Weight <select data-field="weight"><option>300</option><option>350</option><option>400</option></select></label><label>Color <select data-field="color"><option value="white">White</option><option value="gray">Gray</option></select></label></div>';head.append(edit);
 const align=document.createElement('button');align.type='button';align.className='type-align';align.setAttribute('aria-label','Center align '+category);head.append(align);
 const spec=document.createElement('span');spec.className='category-setting';head.append(spec);
 const item=document.createElement('article');item.className='type-row';item.dataset.type=key;const example=document.createElement('div');example.className='type-example';example.textContent=text;const meta=document.createElement('small');meta.className='type-setting';meta.textContent=where;item.append(example,meta);group.append(item);
 function render(){const t=typeSettings[category],family=t.font==='cormorant'?"'Cormorant Garamond', serif":"'Jost', sans-serif";spec.textContent=t.size+'px · '+t.weight;align.textContent=t.align==='center'?'Centered':'Left';align.setAttribute('aria-pressed',String(t.align==='center'));for(const e of [example,...document.querySelectorAll('[data-preview-category="'+category+'"]')])for(const [property,value] of [['font-family',family],['text-transform',t.case],['font-size',t.size+'px'],['font-weight',t.weight],['text-align',t.align],['color',t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)']])if(property!=='color'||!e.classList.contains('status-example'))e.style.setProperty(property,value,'important');}
 align.addEventListener('click',()=>{typeSettings[category].align=typeSettings[category].align==='center'?'left':'center';render();});
 for(const field of edit.querySelectorAll('[data-field]')){field.value=String(typeSettings[category][field.dataset.field]);field.addEventListener('input',()=>{const key=field.dataset.field,v=['size','weight'].includes(key)?Number(field.value):field.value;if(key==='size'&&(!Number.isInteger(v)||v<8||v>32||v%2))return;typeSettings[category][key]=v;render();});}
 group.renderType=render;render();
}
function collapsible(section){const h=section.querySelector(':scope > h2'),details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');details.className='review-fold';details.open=true;summary.append(h);body.className='review-fold-body';body.append(...section.childNodes);details.append(summary,body);section.append(details);}
collapsible(preview);collapsible(fonts);
for(const link of document.querySelectorAll('.gallery-header nav a'))link.addEventListener('click',()=>{const fold=document.querySelector(link.getAttribute('href')+' > .review-fold');if(fold)fold.open=true;});
const finishes=setupFinishes({comparison,preview,drawer,filter,say});
const overlay=setupOverlay(comparison);panels.prepend(document.querySelector('.overlay-controls'));panels.prepend(panels.querySelector('h3'));
const advanced=document.querySelector('#advanced');buttons.querySelector('.finish-controls details').append(advanced.querySelector('#tokens'));advanced.remove();
if(storedDesign?.glass)finishes.set({finish:storedDesign.finish,...storedDesign.glass});if(storedDesign?.overlay)overlay.set(storedDesign.overlay);
for(const pill of document.querySelectorAll('.maya-pill'))pill.dataset.previewCategory='P3';for(const label of document.querySelectorAll('.maya-metric-label,.maya-metric-value'))label.dataset.previewCategory='P2';for(const group of hierarchy.querySelectorAll('.type-group'))group.renderType();
const sizeReference=contextActions.querySelector('.maya-pill');new ResizeObserver(()=>{const height=sizeReference.getBoundingClientRect().height;if(height>0)document.documentElement.style.setProperty('--preview-control-height',height+'px');}).observe(sizeReference);
const source=await (await fetch('/aesthetics/ui/components/tokens.css')).text();
const defaults=Object.fromEntries([...source.matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const storageKey='maya-component-gallery-tokens-v2';let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
let overrides={};
function valid(key,value){if(!value||/[;{}<>]|url\s*\(|var\s*\(/i.test(value))return false;
 if(/alpha|fill$|highlight$/.test(key))return /^0(?:\.\d+)?$|^1(?:\.0+)?$|^\.\d+$/.test(value);
 if(key==='--ui-pill-weight')return /^(300|350|400)$/.test(value);
 if(/(?:size|width|radius|blur|padding-[xy]|gap|space|tracking|shadow-y)$/.test(key))return /^\d+(?:\.\d+)?px$/.test(value)&&parseFloat(value)<=500;
 const property=key.endsWith('saturation')?'width':key.endsWith('duration')?'transition-duration':key.endsWith('easing')?'transition-timing-function':key.endsWith('transform')?'text-transform':key.endsWith('height')?'line-height':key.endsWith('font')?'font-family':'color';
 return CSS.supports(property,value);
}
const form=document.querySelector('#tokens');
for(const [key,value] of Object.entries(defaults).filter(([k])=>['--ui-pill-padding-x','--ui-pill-padding-y'].includes(k))){const label=document.createElement('label'),input=document.createElement('input');label.textContent=key.endsWith('-x')?'Side padding':'Vertical padding';input.name=key;input.value=valid(key,saved[key]||'')?saved[key]:value;
 if(key==='--ui-font')input.value=value;
 if(input.value!==value){overrides[key]=input.value;document.documentElement.style.setProperty(key,input.value);}input.addEventListener('input',()=>{const value=input.value.trim();const ok=valid(key,value);input.setAttribute('aria-invalid',String(!ok));if(!ok)return;overrides[key]=value;document.documentElement.style.setProperty(key,value);try{localStorage.setItem(storageKey,JSON.stringify(overrides));}catch{say('Preview updated; browser storage unavailable.');}});label.append(input);form.append(label);}
document.querySelector('#reset').addEventListener('click',()=>{for(const key of Object.keys(defaults))document.documentElement.style.removeProperty(key);overrides={};try{localStorage.removeItem(storageKey);}catch{}for(const input of form.elements){input.value=defaults[input.name];input.removeAttribute('aria-invalid');}finishes.reset();overlay.reset();for(const [category,t] of Object.entries(window.MayaTypographyControls.defaults.type)){Object.assign(typeSettings[category],t,{align:'center'});const group=hierarchy.querySelector(`[data-category="${category}"]`);for(const input of group.querySelectorAll('[data-field]'))input.value=String(t[input.dataset.field]);for(const row of group.querySelectorAll('.type-row')){const e=row.querySelector('.type-example');e.style.fontSize=t.size+'px';e.style.fontWeight=t.weight;e.style.color=t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)';}group.renderType();}Object.assign(editorSettings,window.MayaTypographyControls.defaults.editor);for(const input of housing.querySelectorAll('input'))input.value=editorSettings[input.dataset.editorField];renderEditor();say('Default preview restored. Save to apply it.');});
for(const [key,value] of [['--ui-pill-padding-x',storedDesign.pillX],['--ui-pill-padding-y',storedDesign.pillY]])if(Number.isInteger(value)){const input=form.querySelector(`[name="${key}"]`);if(input){input.value=value+'px';document.documentElement.style.setProperty(key,value+'px');}}
document.querySelector('#save').addEventListener('click',async()=>{
 const sizes=['H1','H2','H3','H4','P1','P2','P3','P4'].map(k=>typeSettings[k].size);
 if(sizes.slice(0,4).some((n,i)=>i&&n>=sizes[i-1])||sizes.slice(4).some((n,i)=>i&&n>sizes[i+3])){say('Headlines must descend in size; paragraphs must not grow down the list.');return;}
 const pillX=parseInt(form.querySelector('[name="--ui-pill-padding-x"]').value,10),pillY=parseInt(form.querySelector('[name="--ui-pill-padding-y"]').value,10);
 if(!Number.isInteger(pillX)||pillX<4||pillX>32||!Number.isInteger(pillY)||pillY<2||pillY>16){say('Pill padding must stay within 4–32px sideways and 2–16px vertically.');return;}
 const glass=finishes.settings();const value={type:typeSettings,finish:glass.finish,glass:Object.fromEntries(['fill','tint','rim','highlight','blur','saturation'].map(k=>[k,glass[k]])),overlay:overlay.settings(),editor:editorSettings,pillX:parseInt(form.querySelector('[name="--ui-pill-padding-x"]').value,10),pillY:parseInt(form.querySelector('[name="--ui-pill-padding-y"]').value,10)};
 const button=document.querySelector('#save');button.disabled=true;say('Saving…');try{say(await window.MayaTypographyControls.save(value));}catch(e){say(e.message||'Save failed.');}finally{button.disabled=false;}
});
