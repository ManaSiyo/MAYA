import {addStyleReference} from './style-reference.js';
import {setupOverlay} from './overlay.js';
import {setupFinishes} from './finishes.js';
import {Pill,GlassSurface,IconButton,Drawer,FilterPopover,Metric} from '/aesthetics/ui/components/components.js';
const gallery=document.querySelector('#gallery'),feedback=document.querySelector('#feedback');
const say=s=>feedback.textContent=s;
const storedDesign=await window.MayaTypographyControls.ready;
function section(title,id,description){const s=document.createElement('section');s.id=id;s.className='preview-section';const h=document.createElement('h2');h.textContent=title;s.append(h);if(description){const p=document.createElement('p');p.textContent=description;s.append(p);}gallery.append(s);return s;}
function row(parent){const r=document.createElement('div');r.className='preview-row';parent.append(r);return r;}
const fonts=section('Typography','fonts','H1 to H4 · P1 to P4. Edit, then Save.');
const cards=document.createElement('div');cards.className='font-grid';fonts.append(cards);
for(const [name,family,use] of [['Jost',"'Jost', sans-serif",'Current: buttons, navigation, forms and data.'],['Cormorant Garamond',"'Cormorant Garamond', serif",'Current: MAYA / Mana Siyo branding and editorial titles.']]){
 const card=document.createElement('article');card.className='font-card';const h=document.createElement('h3');h.textContent=name;const p=document.createElement('p');p.textContent=use;
 card.append(h,p);if(name==='Cormorant Garamond'){const brand=document.createElement('div');brand.className='brand-sample';brand.style.fontFamily=family;brand.textContent='MAYA · MANA SIYO';card.append(brand);}else{const button=Pill({label:'Tap to listen',purpose:'listen'});button.style.fontFamily=family;if(name==='Arial')button.style.fontWeight='400';card.append(button);}
 const sample=document.createElement('div');sample.className='font-sample';sample.style.fontFamily=family;sample.textContent='MAYA 123 · Contacted · Your next appointment';card.append(sample);cards.append(card);
}
const fontNote=document.createElement('p');fontNote.id='font-status';fontNote.textContent='Loading font samples…';fonts.append(fontNote);
Promise.all([document.fonts.load('300 10px Jost'),document.fonts.load('350 10px Jost'),document.fonts.load('400 18px "Cormorant Garamond"')]).then(()=>document.fonts.ready).then(()=>{const loaded=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replaceAll('"','').replaceAll("'",''));fontNote.textContent=['Jost','Cormorant Garamond'].every(n=>loaded.includes(n))?'Jost and Cormorant loaded. Weights 300 and 350 are available.':'Web fonts unavailable or still loading; samples may show fallback fonts.';}).catch(()=>{fontNote.textContent='Web fonts unavailable; samples show fallback fonts.';});
const technical=document.createElement('details');technical.innerHTML='<summary>Other fonts in the code</summary><p>Menlo / system monospace: technical logs, IDs and code. SF Mono and generic monospace are fallbacks, not extra brand fonts. System sans-serif is the fallback for Jost.</p><div class="mono-sample">MAYA 123 · request_id · 10:30</div>';fonts.append(technical);
const buttons=section('Buttons','buttons','Used in client MAYA, Admin and Outbound. Same small type, no oversized numbers.');
row(buttons).append(Pill({label:'Tap to listen',purpose:'listen',onClick:()=>say('Voice button example')}),IconButton({label:'Add example',onClick:()=>say('Add button example')}),Metric({label:'Contacted',value:12}));
const states=document.createElement('details');states.innerHTML='<summary>Button states</summary>';buttons.append(states);const stateRow=row(states);
for(const state of ['default','hover','focus','selected','pressed','disabled','loading']){const wrap=document.createElement('div');wrap.className='state-sample';const title=document.createElement('span');title.textContent=state;const pill=Pill({label:state==='loading'?'Listening…':'Tap to listen',purpose:'listen',disabled:['disabled','loading'].includes(state),selected:state==='selected'});if(['hover','focus','pressed'].includes(state))pill.dataset.previewState=state;if(state==='loading')pill.setAttribute('aria-busy','true');wrap.append(title,pill);stateRow.append(wrap);}
const menus=section('Menus and panels','menus','The finish changes with its job: light on buttons, quieter around data, darker over other text.');
const surfaces=document.createElement('div');surfaces.className='context-grid';menus.append(surfaces);
for(const [title,description,intensity] of [['Client actions','Tap to listen and small action buttons.','standard'],['Admin / Outbound data','Lead rows and compact totals.','quiet'],['Menus over content','Hamburger drawer and status filters.','overlay']]){const content=document.createElement('div');const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=description;content.append(h,p);surfaces.append(GlassSurface({content,intensity}));}
const drawer=Drawer({title:'Systems',content:[Metric({label:'AI today',value:'$0.12'}),GlassSurface({content:'Connection details',intensity:'quiet'})],footer:[Pill({label:'Hey MAYA',purpose:'listen'})]});let openDrawer;openDrawer=Pill({label:'Open drawer',onClick:()=>drawer.showFrom(openDrawer)});
const filter=FilterPopover({title:'Status',values:['Not contacted','Contacted','Booked'],onApply:v=>say(v.length?v.join(', '):'No statuses selected')});let openFilter;openFilter=Pill({label:'Open filter',onClick:()=>filter.showFrom(openFilter)});row(menus).append(openDrawer,openFilter);
const guide=section('Text guide','guide','What each style means and where it appears.');const table=document.createElement('table');table.className='text-guide';table.innerHTML='<thead><tr><th>Example</th><th>Used for</th><th>Style</th></tr></thead><tbody><tr><td class="brand-sample">MAYA</td><td>Brand name</td><td>Cormorant</td></tr><tr><td class="listen-sample">TAP TO LISTEN</td><td>Client voice button</td><td>Jost 10px · light</td></tr><tr><td class="body-sample">Contacted 12</td><td>Compact labels and counts</td><td>Jost 12px · numbers medium</td></tr><tr><td class="data-sample">Name · Category · Notes</td><td>Admin / Outbound tables</td><td>Jost 11px</td></tr><tr><td class="mono-sample">request_id</td><td>Technical details</td><td>System monospace</td></tr></tbody>';guide.append(table);
const glossary=document.createElement('details');glossary.innerHTML='<summary>Plain-language glossary</summary><dl><dt>Pill</dt><dd>A rounded button, like Tap to listen.</dd><dt>Glass</dt><dd>A see-through background with a soft highlight.</dd><dt>Intensity</dt><dd>How dark and blurred that background is.</dd><dt>Drawer</dt><dd>The panel opened by the hamburger menu.</dd><dt>Filter</dt><dd>The small menu for choosing which rows to show.</dd><dt>Metric</dt><dd>A label and count, such as Contacted 12.</dd><dt>Token</dt><dd>A shared setting, such as text size or padding.</dd></dl>';guide.append(glossary);
const pages=section('Page map','pages','11 page files · grouped by purpose. Click a page to open it.');
const pageGroups=[
 ['Clients', [['MAYA','/','The client app'],['Privacy','/privacy.html','Privacy policy'],['Terms','/terms.html','Service terms']]],
 ['Admin tools', [['Admin','/status.html','Leads, submissions and systems'],['Outbound','/outbound.html','Prospects, campaigns and email'],['Brief','/backend.html','An individual design submission'],['Operations','/operations.html','Operations room']]],
 ['Utilities & previews', [['Verify','/verify.html','Deployment and API checks'],['Operations engine','/aesthetics/operations/','Supporting embedded interface'],['Playground','/playground.html','Client feature preview'],['Aesthetic Control','/aesthetics/aesthetic-control.html','You are here']]]
];
const map=document.createElement('div');map.className='page-map';pages.append(map);
for(const [group,items] of pageGroups){const column=document.createElement('article');const heading=document.createElement('h3');heading.textContent=group;column.append(heading);for(const [name,url,description] of items){const link=document.createElement('a');link.className='page-link';const local=location.hostname==='127.0.0.1'||location.hostname==='localhost';const localPaths={'/':'/frontend/index.html','/playground.html':'/playground/index.html'};link.href=local?(localPaths[url]||(/^\/[^/]+\.html$/.test(url)?'/backend'+url:url)):url;link.target='_blank';link.rel='noopener';const title=document.createElement('strong'),note=document.createElement('span');title.textContent=name;note.textContent=description;link.append(title,note);column.append(link);}map.append(column);}
const flow=document.createElement('p');flow.className='page-flow';flow.textContent='Client submission → Admin → Brief. Admin also opens Outbound and Operations. Affiliates is an Admin view, not a separate page.';pages.append(flow);
// Two primary sections; technical examples stay available without crowding the review.
const preview=section('Glass','pill-preview','Pills and panels.');
const comparison=document.createElement('div');comparison.className='comparison';preview.append(comparison);
buttons.querySelector('h2').textContent='In Admin & Outbound';buttons.querySelector('p').textContent='Your selected finish applies to every example below, including menus and states.';
const contextActions=buttons.querySelector('.preview-row');contextActions.querySelector('.maya-pill').textContent='Tap to listen';
const outbound=row(buttons);outbound.classList.add('outbound-example');const caption=document.createElement('span');caption.textContent='Outbound';outbound.append(caption,Pill({label:'Write an email',onClick:()=>say('Email button example only.')}),Pill({label:'Refresh',onClick:()=>say('Refresh example only.')}));
preview.append(buttons);
const menuRow=row(preview);menuRow.append(openDrawer,openFilter);
const extra=document.createElement('details');extra.innerHTML='<summary>Panels & glossary</summary>';extra.append(menus,glossary);preview.append(extra);
// Visible hierarchy: sourced roles, with preview choices clearly distinguished from live styles.
const hierarchy=document.createElement('div');hierarchy.className='type-hierarchy';fonts.prepend(hierarchy);const columns=document.createElement('div');columns.className='type-columns';columns.innerHTML='<span>Role</span><span>Preview</span><span>Location</span>';hierarchy.append(columns);
const roles=[
 ['Brand','MAYA','Cormorant Garamond',24,300,'Client top-left wordmark · proposed weight 300','brand'],
 ['Dialog headline','Name this project','Cormorant Garamond',24,300,'Client app → Projects → new project / project-name dialog','editorial'],
 ['Page headline','OUTBOUND','Cormorant Garamond',24,300,'Outbound → top-left page heading; All prospects title was retired','headline'],
 ['Subheadline','Campaign details','Jost',16,400,'Outbound detail and dialog titles','subheadline'],
 ['Paragraph','Add your ideas and references. MAYA keeps the details together for your next conversation.','Jost',12,300,'Client dialog help text · 1.7 line spacing','paragraph'],
 ['Label & count','Contacted 12','Jost',12,400,'Compact totals and labels','label'],
 ['Table text','Name · Category · Notes','Jost',12,300,'Admin and Outbound lead rows','table'],
 ['Pill & field label','TAP TO LISTEN','Jost',10,300,'Voice pill and client form labels','pill'],
 ['Small caption','PAID CLICKS · 7D','Jost',10,400,'Admin bottom-line captions','caption'],
 ['Admin section','THE LEAD STATION','Jost',16,400,'Admin section headings','adminsection'],
 ['Drawer title','SYSTEMS','Cormorant Garamond',20,400,'Admin and Outbound drawer headings','drawer'],
 ['Log information','Updated the appointment notes.','Jost',12,300,'Admin log body','log'],
 ['Model label','Configured model','Jost',12,300,'Admin Systems model snapshot','model'],
 ['Dashboard number','12','Jost',14,400,'Admin bottom-line total','dashboard'],
 ['Technical text','request_id · 10:30','Menlo',12,400,'Logs and technical identifiers','technical']
];
const categories={brand:'H1',editorial:'H1',headline:'H1',drawer:'H2',subheadline:'H3',adminsection:'H3',dashboard:'H4',body:'H4',paragraph:'P1',table:'P1',log:'P1',model:'P1',label:'P2',technical:'P1',pill:'P3',caption:'P4'};
const typeSettings=structuredClone(storedDesign.type||window.MayaTypographyControls.defaults.type);
const editorSettings={...window.MayaTypographyControls.defaults.editor,...storedDesign.editor};
function renderEditor(){for(const [key,value] of Object.entries(editorSettings))document.documentElement.style.setProperty('--type-editor-'+key,['radius','padding'].includes(key)?value+'px':value/100);}
renderEditor();
const housing=document.createElement('details');housing.className='housing-editor';housing.innerHTML='<summary>Settings panel</summary>';
for(const [key,label,max] of [['fill','Fill',100],['rim','Border',100],['radius','Corners',24],['padding','Padding',20]]){
 const labelNode=document.createElement('label'),input=document.createElement('input');labelNode.textContent=label;input.type='number';input.min=0;input.max=max;input.value=editorSettings[key];input.dataset.editorField=key;
 input.addEventListener('input',()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<0||n>max)return;editorSettings[key]=n;renderEditor();});labelNode.append(input);housing.append(labelNode);
}
hierarchy.before(housing);
for(const category of ['H1','H2','H3','H4','P1','P2','P3','P4']){
 typeSettings[category].align ||= 'center';
 const group=document.createElement('section');group.className='type-group';group.dataset.category=category;
 const head=document.createElement('div');head.className='type-group-head';const heading=document.createElement('h3');heading.className='type-category';heading.textContent=category;head.append(heading);group.append(head);hierarchy.append(group);
 const edit=document.createElement('details');edit.className='type-editor';edit.innerHTML='<summary aria-label="Edit '+category+'">Edit</summary><div class="type-editor-fields"><label>Size <input type="number" min="8" max="32" step="2" data-field="size"></label><label>Weight <select data-field="weight"><option>300</option><option>350</option><option>400</option></select></label><label>Color <select data-field="color"><option value="white">White</option><option value="gray">Gray</option></select></label></div>';head.append(edit);
 const align=document.createElement('button');align.type='button';align.className='type-align';align.setAttribute('aria-label','Center align '+category);head.append(align);
 const spec=document.createElement('span');spec.className='category-setting';head.append(spec);
 function render(){const t=typeSettings[category];spec.textContent=t.size+'px · '+t.weight+' · '+(t.color==='white'?'White':'Gray');align.textContent=t.align==='center'?'Centered':'Left';align.setAttribute('aria-pressed',String(t.align==='center'));for(const e of group.querySelectorAll('.type-example')){Object.assign(e.style,{fontSize:t.size+'px',fontWeight:t.weight,color:t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)',textAlign:t.align});}document.querySelectorAll('[data-preview-category="'+category+'"]').forEach(e=>{for(const [property,value] of [['font-size',t.size+'px'],['font-weight',t.weight],['text-align',t.align],['color',t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)']])e.style.setProperty(property,value,'important');});}
 align.addEventListener('click',()=>{typeSettings[category].align=typeSettings[category].align==='center'?'left':'center';render();});
 for(const field of edit.querySelectorAll('[data-field]')){field.value=String(typeSettings[category][field.dataset.field]);field.addEventListener('input',()=>{const key=field.dataset.field,v=key==='color'?field.value:Number(field.value);if(key==='size'&&(!Number.isInteger(v)||v<8||v>32||v%2))return;typeSettings[category][key]=v;render();});}
 for(const [role,text,family,size,weight,where,key] of roles.filter(r=>categories[r[6]]===category)){
  const item=document.createElement('article');item.className='type-row';item.dataset.type=key;
  const title=document.createElement('div');title.className='type-role';title.textContent=role;
  const example=document.createElement('div');example.className='type-example';example.style.fontFamily=family==='Jost'?'var(--ui-font)':family==='Menlo'?'Menlo, monospace':"'Cormorant Garamond', serif";example.style.lineHeight='1.4';example.textContent=text;
  const meta=document.createElement('div');meta.className='type-setting';meta.textContent=where.replace(' · proposed weight 300','').replace(' · 1.7 line spacing','');item.append(title,example,meta);group.append(item);
 }
 group.renderType=render;render();
}
try{
 const usage=await(await fetch('/aesthetics/aesthetic-control/typography-usage.json')).json();
 for(const group of hierarchy.querySelectorAll('.type-group')){
  const entry=usage.categories[group.dataset.category],heading=group.querySelector('.type-category');heading.textContent=group.dataset.category+' ('+entry.count+')';
  for(const role of group.querySelectorAll('.type-role')){const key=role.parentElement.dataset.type;role.textContent=role.textContent+' ('+(entry.roles?.[key]?.count||0)+')';}
  const evidence=document.createElement('details');evidence.className='usage-evidence';const summary=document.createElement('summary');summary.textContent=entry.count===null?'Not mapped yet':'Usage locations';evidence.append(summary);
  const explanation=document.createElement('p');explanation.textContent='Authored locations.';evidence.append(explanation);
  for(const location of entry.locations){const line=document.createElement('p');line.textContent=location.page+':'+location.line+' · '+location.reason;line.title=location.snippet;evidence.append(line);}
  group.append(evidence);
 }
 const note=document.createElement('p');note.className='usage-note';note.textContent='Counts show authored locations.';note.title=usage.method;hierarchy.prepend(note);
}catch{const note=document.createElement('p');note.textContent='Usage counts unavailable.';hierarchy.prepend(note);}
fonts.insertBefore(fonts.querySelector('h2'),hierarchy);fonts.insertBefore(fonts.querySelector(':scope > p'),hierarchy);
const compareFonts=document.createElement('details');compareFonts.innerHTML='<summary>Compare font families</summary>';compareFonts.append(cards,fontNote,technical);fonts.append(compareFonts);
guide.id='table-preview';guide.querySelector('h2').textContent='Table preview';guide.querySelector('p').textContent='P1 cells · P2 labels · P3 pills · P4 captions';table.innerHTML='<thead><tr><th data-preview-category="P2">Name</th><th data-preview-category="P2">Category</th><th data-preview-category="P2">Status</th><th data-preview-category="P2">Notes</th></tr></thead><tbody><tr><td data-preview-category="P1">Alex</td><td data-preview-category="P1">Corporate</td><td><span class="maya-pill" data-preview-category="P3">Contacted</span></td><td data-preview-category="P1">Appointment requested</td></tr><tr><td data-preview-category="P1">Sam</td><td data-preview-category="P1">Ceremonial</td><td><span class="maya-pill" data-preview-category="P3">Booked</span></td><td data-preview-category="P1">A longer note wraps within the table on small screens.</td></tr></tbody>';const tableCaption=document.createElement('small');tableCaption.dataset.previewCategory='P4';tableCaption.textContent='Example data';guide.append(tableCaption);for(const group of hierarchy.querySelectorAll('.type-group'))group.renderType();
const icons=section('Icons','icons','Shared circular controls. Each icon uses the pill height and your selected glass finish.');
const iconRow=row(icons);
for(const [label,icon] of [['Add','+'],['Close','×'],['Refresh','↻']]){const item=document.createElement('div');item.className='icon-example';item.append(IconButton({label:label+' icon preview',icon}),document.createTextNode(label));iconRow.append(item);}
for(const [label,path] of [['Menu','M4 6h16M4 12h16M4 18h16'],['Search','M10 4a6 6 0 1 0 0 12a6 6 0 0 0 0-12M15 15l5 5'],['Dropdown','M6 9l6 6 6-6']]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);const item=document.createElement('div');item.className='icon-example';item.append(IconButton({label:label+' icon preview',icon:svg}),document.createTextNode(label));iconRow.append(item);}
function collapsible(section,open=false){const heading=section.querySelector(':scope > h2'),details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');details.className='review-fold';details.open=open;summary.append(heading);body.className='review-fold-body';body.append(...section.childNodes);details.append(summary,body);section.append(details);}
await addStyleReference(fonts,compareFonts);
for(const group of hierarchy.querySelectorAll('.type-group')){const t=typeSettings[group.dataset.category];for(const e of group.querySelectorAll('.type-example'))e.style.color=t.color==='white'?'rgb(255 255 255)':'rgb(170 181 196)';}
collapsible(preview,true);collapsible(fonts,true);collapsible(icons);collapsible(pages);
gallery.replaceChildren(fonts,guide,preview,icons,pages);
for(const link of document.querySelectorAll('.gallery-header nav a'))link.addEventListener('click',()=>{const fold=document.querySelector(link.getAttribute('href')+' > .review-fold');if(fold)fold.open=true;});
const finishes=setupFinishes({comparison,preview,drawer,filter,say});
const overlay=setupOverlay(comparison);
if(storedDesign?.glass)finishes.set({finish:storedDesign.finish,...storedDesign.glass});
if(storedDesign?.overlay)overlay.set(storedDesign.overlay);
// Keep circular action buttons exactly as tall as the adjacent live pill, including font changes.
const sizeReference=contextActions.querySelector('.maya-pill');
new ResizeObserver(()=>{const height=sizeReference.getBoundingClientRect().height;if(height>0)document.documentElement.style.setProperty('--preview-control-height',height+'px');}).observe(sizeReference);
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
for(const [key,value] of Object.entries(defaults).filter(([k])=>['--ui-pill-padding-x','--ui-pill-padding-y'].includes(k))){const label=document.createElement('label'),input=document.createElement('input');label.textContent=key.endsWith('-x')?'Pill side padding':'Pill top/bottom padding';input.name=key;input.value=valid(key,saved[key]||'')?saved[key]:value;
 if(key==='--ui-font')input.value=value;
 if(input.value!==value){overrides[key]=input.value;document.documentElement.style.setProperty(key,input.value);}input.addEventListener('input',()=>{const value=input.value.trim();const ok=valid(key,value);input.setAttribute('aria-invalid',String(!ok));if(!ok)return;overrides[key]=value;document.documentElement.style.setProperty(key,value);try{localStorage.setItem(storageKey,JSON.stringify(overrides));}catch{say('Preview updated; browser storage unavailable.');}});label.append(input);form.append(label);}
document.querySelector('#fallback').addEventListener('change',e=>document.body.classList.toggle('no-blur',e.target.checked));
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
