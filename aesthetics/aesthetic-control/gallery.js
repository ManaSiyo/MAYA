import {addRestore,highlightPadding} from './restore-controls.js';
import {setupSurfaceEditors,setupDismissal,fields} from './surface-editors.js';
import {setupOverlay} from './overlay.js';
import {setupFinishes} from './finishes.js';
import {Pill,GlassSurface,IconButton,Drawer,FilterPopover,Metric} from '/aesthetics/ui/components/components.js';
const gallery=document.querySelector('#gallery'),feedback=document.querySelector('#feedback');
const say=s=>feedback.textContent=s;
const storedDesign=await window.MayaTypographyControls.ready;
function section(title,id){const s=document.createElement('section');s.id=id;s.className='preview-section';const h=document.createElement('h2');h.textContent=title;s.append(h);gallery.append(s);return s;}
function row(parent){const r=document.createElement('div');r.className='preview-row';parent.append(r);return r;}
function heading(parent,title){const h=document.createElement('h3');h.textContent=title;parent.append(h);}
const preview=section('Glass, Panels and Tables','pill-preview');
const buttons=document.createElement('div');buttons.id='buttons';preview.append(buttons);heading(buttons,'Glass Section');
const comparison=document.createElement('div');comparison.className='comparison';buttons.append(comparison);
const contextActions=row(buttons);contextActions.append(Pill({label:'Tap to listen',purpose:'listen',onClick:()=>say('Button preview')}));
const iconRow=row(buttons);iconRow.classList.add('icon-row');
for(const [label,icon] of [['Add','+'],['Close','×'],['Refresh','↻']])iconRow.append(IconButton({label,icon,onClick:()=>say(label+' preview')}));
const activeIcons=new Set(['Menu','Search','Dropdown','Phone','Email','Microphone','Copy','Favorite','Edit','Send','Settings']);
for(const [label,path] of [['Menu','M4 6h16M4 12h16M4 18h16'],['Search','M10 4a6 6 0 1 0 0 12a6 6 0 0 0 0-12M15 15l5 5'],['Dropdown','M6 9l6 6 6-6'],['Phone','M6 3h4l2 6-3 2a16 16 0 0 0 4 4l2-3 6 2v4c0 5-18-1-18-12z'],['Email','M3 5h18v14H3zM3 5l9 8 9-8'],['Microphone','M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0zM6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8'],['Copy','M8 8h12v13H8zM4 16V3h12'],['Download','M12 3v12M7 10l5 5 5-5M4 17v4h16v-4'],['Favorite','M12 20S2 14 2 8a5 5 0 0 1 10-3 5 5 0 0 1 10 3c0 6-10 12-10 12z'],['Expand','M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6'],['Edit','M4 16l12-12 4 4L8 20H4zM14 6l4 4'],['Upload','M12 16V3M7 8l5-5 5 5M4 17v4h16v-4'],['Send','M3 3l18 9-18 9 3-9zM6 12h15'],['Invoice','M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4'],['History','M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2'],['Help','M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18v1'],['Stop','M5 5h14v14H5z'],['Settings','M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L4 4M20 20l-2-2M6 18l-2 2M20 4l-2 2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10']].filter(([label])=>activeIcons.has(label))){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);iconRow.append(IconButton({label,icon:svg,onClick:()=>say(label+' preview')}));}
const controlSizes={iconSize:storedDesign.iconSize,dropdownHeight:storedDesign.dropdownHeight};
const sizeEdit=document.createElement('details');sizeEdit.className='type-editor control-size-editor';sizeEdit.innerHTML='<summary>Icons and dropdown</summary><div class="type-editor-fields"></div>';buttons.append(sizeEdit);
const sizeRender=()=>{document.documentElement.style.setProperty('--preview-control-height',controlSizes.iconSize+'px');document.documentElement.style.setProperty('--maya-control-icon-size',controlSizes.iconSize+'px');document.documentElement.style.setProperty('--maya-control-dropdown-height',controlSizes.dropdownHeight+'px');};
addRestore(sizeEdit,{label:'icons and dropdown',read:()=>controlSizes,write:v=>{Object.assign(controlSizes,v);for(const input of sizeEdit.querySelectorAll('[data-field]'))input.value=controlSizes[input.dataset.field];sizeRender();}});
fields(sizeEdit.lastChild,controlSizes,[['iconSize','Icon size',{min:24,max:48}],['dropdownHeight','Dropdown height',{min:24,max:48}]],sizeRender);
const dropdown=document.createElement('select');dropdown.className='dropdown-preview';dropdown.setAttribute('aria-label','Dropdown preview');dropdown.innerHTML='<option>Signature</option><option>Ceremonial</option><option>Suit</option><option>Help me decide</option>';dropdown.onchange=()=>say(dropdown.value+' preview');row(buttons).append(dropdown);sizeRender();
const colors=row(buttons);colors.id='pill-colors';
for(const [label,color] of [['Gray','#b5bdc8'],['Blue','#8abcf2'],['Yellow','#fbbf24'],['Green','#4ade80'],['Pink','#fda4af']]){const pill=Pill({label,onClick:()=>say(label+' preview')});pill.classList.add('status-example');pill.style.setProperty('--status-color',color);pill.setAttribute('aria-label',label+' pill');colors.append(pill);}
const states=document.createElement('details');states.innerHTML='<summary>States</summary>';buttons.append(states);const stateRow=row(states);
for(const state of ['default','hover','focus','selected','pressed','disabled','loading']){const wrap=document.createElement('div');wrap.className='state-sample';const label=document.createElement('span');label.textContent=state;const pill=Pill({label:'Tap to listen',purpose:'listen',disabled:['disabled','loading'].includes(state),selected:state==='selected',onClick:()=>say(state+' preview')});if(['hover','focus','pressed'].includes(state))pill.dataset.previewState=state;if(state==='loading')pill.setAttribute('aria-busy','true');wrap.append(label,pill);stateRow.append(wrap);}
const divider=document.createElement('hr');divider.className='visual-divider';preview.append(divider);
const panels=document.createElement('div');panels.id='panels';preview.append(panels);heading(panels,'Panels');
const surfaces=document.createElement('div');surfaces.className='context-grid';const outer=GlassSurface({content:surfaces,intensity:'quiet'});outer.classList.add('panel-preview');panels.append(outer);
for(const title of ['Lead Station','Campaign details']){const h=document.createElement('h3');h.textContent=title;h.dataset.previewCategory='H3';const metric=Metric({label:'Contacts',value:12});const inner=document.createElement('div');inner.className='inner-panel';inner.append(h,metric);surfaces.append(inner);}
const drawer=Drawer({title:'Systems',content:[Metric({label:'AI today',value:'$0.12'})]}),filter=FilterPopover({title:'Filter',values:['Gray','Blue','Green'],onApply:v=>say(v.join(', ')||'None')});
let openDrawer,openFilter;openDrawer=Pill({label:'Drawer',onClick:()=>drawer.showFrom(openDrawer)});openFilter=Pill({label:'Filter',onClick:()=>filter.showFrom(openFilter)});row(panels).append(openDrawer,openFilter);const filterPreview=document.createElement('div');filterPreview.className='filter-preview';filterPreview.hidden=true;filterPreview.textContent='Filter';panels.append(filterPreview);
const guide=document.createElement('div');guide.id='table-preview';guide.tabIndex=0;guide.setAttribute('role','region');guide.setAttribute('aria-label','Lead Station table preview');panels.append(guide);
const table=document.createElement('table');table.className='text-guide';table.innerHTML='<thead><tr><th data-col="name">Full name</th><th data-col="stage">Status</th><th data-col="note">Latest Notes</th></tr></thead><tbody></tbody>';guide.append(table);
for(const [name,badge,date,status,color,note] of [['Angela','?','Oct 1','Not contacted','#b5bdc8','Wedding, gala, or ceremony'],['Mary','SI','Sep 4','In progress','#fbbf24','A custom suit with a tailored fit']]){
 const tr=document.createElement('tr');tr.innerHTML='<td data-col="name" class="lead-col-first"><button class="lead-open"><span class="lead-identity">'+name+'</span><time>'+date+'</time><span class="category-badge">'+badge+'</span></button></td><td data-col="stage"><span class="status-pill lead-status" style="--status-color:'+color+'">'+status+'</span></td><td data-col="note"><div class="lead-note-vp"><span>'+note+'</span></div></td>';table.tBodies[0].append(tr);
}
const surfacesEditor=setupSurfaceEditors({panels,guide,design:storedDesign});
const fonts=section('Typography','fonts'),hierarchy=document.createElement('div');hierarchy.className='type-hierarchy';fonts.append(hierarchy);
const typeSettings=structuredClone(storedDesign.type||window.MayaTypographyControls.defaults.type);
const usage=await fetch('/aesthetics/aesthetic-control/typography-usage.json').then(r=>r.json()).catch(()=>({categories:{}}));
const editorSettings={...window.MayaTypographyControls.defaults.editor,...storedDesign.editor};
function renderEditor(){for(const [key,value] of Object.entries(editorSettings))document.documentElement.style.setProperty('--type-editor-'+key,['radius','padding'].includes(key)?value+'px':value/100);}
renderEditor();
const roles=[['H1','brand','Maya','Brand'],['H2','drawer','Systems','Drawer'],['H3','subheadline','Campaign details','Lead Station / campaign details'],['H4','dashboard','12','Dashboard'],['P1','paragraph','Your next appointment.','Body / tables'],['P2','label','Contacts 12','Labels'],['P3','field','Name','Buttons / fields'],['P4','caption','Example data','Captions']];
for(const [category,key,text,where] of roles){
 typeSettings[category].align||='center';typeSettings[category].vertical||='middle';
 const group=document.createElement('section');group.className='type-group';group.dataset.category=category;
 const head=document.createElement('div');head.className='type-group-head';const title=document.createElement('h3');title.className='type-category';title.textContent=category+' ('+(usage.categories?.[category]?.count??'?')+')';title.title='Authored uses across MAYA';head.append(title);group.append(head);hierarchy.append(group);
 const edit=document.createElement('details');edit.className='type-editor';edit.innerHTML='<summary aria-label="Edit '+category+'">Edit</summary><div class="type-editor-fields"><label>Font <select data-field="font"><option value="jost">Jost</option><option value="cormorant">Cormorant</option></select></label><label>Case <select data-field="case"><option value="none">Normal</option><option value="uppercase">ALL CAPS</option></select></label><label>Size <input type="number" min="8" max="32" step="2" data-field="size"></label><label>Weight <select data-field="weight"><option>300</option><option>350</option><option>400</option></select></label><label>Color <select data-field="color"><option value="white">White</option><option value="gray">Gray</option></select></label><label>Alignment <select data-field="align"><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></label><label>Vertical <select data-field="vertical"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label></div>';head.append(edit);
 const spec=document.createElement('span');spec.className='category-setting';head.append(spec);
 const item=document.createElement('article');item.className='type-row';item.dataset.type=key;const example=document.createElement('div');example.className='type-example';example.textContent=text;const meta=document.createElement('small');meta.className='type-setting';meta.textContent=where;item.append(example,meta);group.append(item);
 function render(){const t=typeSettings[category],family=t.font==='cormorant'?"'Cormorant Garamond', serif":"'Jost', sans-serif";spec.textContent=t.size+'px · '+t.weight;for(const e of [example,...document.querySelectorAll('[data-preview-category="'+category+'"]')])for(const [property,value] of [['font-family',family],['text-transform',t.case],['font-size',t.size+'px'],['font-weight',t.weight],['text-align',t.align],['align-self',t.vertical==='top'?'start':t.vertical==='bottom'?'end':'center'],['color',t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)']])if(property!=='color'||!e.classList.contains('status-example'))e.style.setProperty(property,value,'important');}
 for(const field of edit.querySelectorAll('[data-field]')){field.value=String(typeSettings[category][field.dataset.field]);field.addEventListener('input',()=>{const key=field.dataset.field,v=['size','weight'].includes(key)?Number(field.value):field.value;if(key==='size'&&(!Number.isInteger(v)||v<8||v>32||v%2))return;typeSettings[category][key]=v;render();});}
 addRestore(edit,{label:category,read:()=>typeSettings[category],write:v=>{Object.assign(typeSettings[category],v);for(const field of edit.querySelectorAll('[data-field]'))field.value=typeSettings[category][field.dataset.field];render();}});group.renderType=render;render();
}
function collapsible(section){const h=section.querySelector(':scope > h2'),details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');details.className='review-fold';details.open=true;summary.append(h);body.className='review-fold-body';body.append(...section.childNodes);details.append(summary,body);section.append(details);}
collapsible(preview);collapsible(fonts);
for(const link of document.querySelectorAll('.gallery-header nav a'))link.addEventListener('click',()=>{const fold=document.querySelector(link.getAttribute('href')+' > .review-fold');if(fold)fold.open=true;});
const finishes=setupFinishes({comparison,preview,drawer,filter,say});
const overlay=setupOverlay(comparison);const panelToolbar=document.createElement('div');panelToolbar.className='panel-editors';
const outerControl=document.createElement('div');outerControl.className='surface-edit-row';outerControl.append(document.createTextNode('Outer panel'),document.querySelector('.overlay-controls'));
panelToolbar.append(outerControl,...panels.querySelectorAll(':scope > .surface-edit-row'));outer.before(panelToolbar);
const advanced=document.querySelector('#advanced');buttons.querySelector('.finish-controls details').append(advanced.querySelector('#tokens'));advanced.remove();
if(storedDesign?.glass)finishes.set({finish:storedDesign.finish,...storedDesign.glass});if(storedDesign?.overlay)overlay.set(storedDesign.overlay);
addRestore(document.querySelector('.overlay-controls'),{label:'outer panel',read:overlay.settings,write:overlay.set});

for(const pill of document.querySelectorAll('.maya-pill'))pill.dataset.previewCategory='P3';for(const label of document.querySelectorAll('.maya-metric-label,.maya-metric-value'))label.dataset.previewCategory='P2';for(const group of hierarchy.querySelectorAll('.type-group'))group.renderType();

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
for(const [key,value] of [['--ui-pill-padding-x',storedDesign.pillX],['--ui-pill-padding-y',storedDesign.pillY]])if(Number.isInteger(value)){const input=form.querySelector(`[name="${key}"]`);if(input){input.value=value+'px';document.documentElement.style.setProperty(key,value+'px');}}
document.querySelector('#save').addEventListener('click',async()=>{
 const sizes=['H1','H2','H3','H4','P1','P2','P3','P4'].map(k=>typeSettings[k].size);
 if(sizes.slice(0,4).some((n,i)=>i&&n>=sizes[i-1])||sizes.slice(4).some((n,i)=>i&&n>sizes[i+3])){say('Headlines must descend in size; paragraphs must not grow down the list.');return;}
 const pillX=parseInt(form.querySelector('[name="--ui-pill-padding-x"]').value,10),pillY=parseInt(form.querySelector('[name="--ui-pill-padding-y"]').value,10);
 if(!Number.isInteger(pillX)||pillX<4||pillX>32||!Number.isInteger(pillY)||pillY<2||pillY>16){say('Pill padding must stay within 4–32px sideways and 2–16px vertically.');return;}
 const glass=finishes.settings();const value={...controlSizes,type:typeSettings,finish:glass.finish,glass:Object.fromEntries(['fill','tint','rim','highlight','blur','saturation'].map(k=>[k,glass[k]])),overlay:overlay.settings(),editor:editorSettings,...surfacesEditor.settings(),pillX:parseInt(form.querySelector('[name="--ui-pill-padding-x"]').value,10),pillY:parseInt(form.querySelector('[name="--ui-pill-padding-y"]').value,10)};
 const button=document.querySelector('#save');button.disabled=true;say('Saving…');try{say(await window.MayaTypographyControls.save(value));document.dispatchEvent(new Event('maya-gallery-saved'));}catch(e){say(e.message||'Save failed.');}finally{button.disabled=false;}
});

addRestore(document.querySelector('.finish-controls details'),{label:'glass',read:()=>({...finishes.settings(),pillX:form.querySelector('[name="--ui-pill-padding-x"]').value,pillY:form.querySelector('[name="--ui-pill-padding-y"]').value}),write:v=>{finishes.set(v);for(const [axis,key] of [['x','pillX'],['y','pillY']]){const input=form.querySelector('[name="--ui-pill-padding-'+axis+'"]');input.value=v[key];input.dispatchEvent(new Event('input',{bubbles:true}));}}});
highlightPadding(document.querySelector('.finish-controls details'),()=>[...document.querySelectorAll('.maya-pill')],()=>({x:parseInt(form.querySelector('[name="--ui-pill-padding-x"]').value,10),y:parseInt(form.querySelector('[name="--ui-pill-padding-y"]').value,10)}));
setupDismissal();
