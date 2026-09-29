import {setupFinishes} from './finishes.js';
import {Pill,GlassSurface,IconButton,Drawer,FilterPopover,Metric} from '/aesthetics/ui/components/components.js';
const gallery=document.querySelector('#gallery'),feedback=document.querySelector('#feedback');
const say=s=>feedback.textContent=s;
function section(title,id,description){const s=document.createElement('section');s.id=id;s.className='preview-section';const h=document.createElement('h2');h.textContent=title;s.append(h);if(description){const p=document.createElement('p');p.textContent=description;s.append(p);}gallery.append(s);return s;}
function row(parent){const r=document.createElement('div');r.className='preview-row';parent.append(r);return r;}
const fonts=section('Typography','fonts','The text hierarchy, with examples and where each style belongs. Interface font choices also update these samples; branding stays Cormorant.');
const cards=document.createElement('div');cards.className='font-grid';fonts.append(cards);
for(const [name,family,use] of [['Jost',"'Jost', sans-serif",'Current: buttons, navigation, forms and data.'],['Arial','Arial, sans-serif','Comparison only. Regular weight; not a new site font.'],['Cormorant Garamond',"'Cormorant Garamond', serif",'Current: MAYA / Mana Siyo branding and editorial titles.']]){
 const card=document.createElement('article');card.className='font-card';const h=document.createElement('h3');h.textContent=name;const p=document.createElement('p');p.textContent=use;
 card.append(h,p);if(name==='Cormorant Garamond'){const brand=document.createElement('div');brand.className='brand-sample';brand.style.fontFamily=family;brand.textContent='MAYA · MANA SIYO';card.append(brand);}else{const button=Pill({label:'Tap to listen',purpose:'listen'});button.style.fontFamily=family;if(name==='Arial')button.style.fontWeight='400';card.append(button);}
 const sample=document.createElement('div');sample.className='font-sample';sample.style.fontFamily=family;sample.textContent='MAYA 123 · Contacted · Your next appointment';card.append(sample);cards.append(card);
}
const fontNote=document.createElement('p');fontNote.id='font-status';fontNote.textContent='Loading font samples…';fonts.append(fontNote);
Promise.all([document.fonts.load('300 10px Jost'),document.fonts.load('400 18px "Cormorant Garamond"')]).then(()=>document.fonts.ready).then(()=>{const loaded=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replaceAll('"','').replaceAll("'",''));fontNote.textContent=['Jost','Cormorant Garamond'].every(n=>loaded.includes(n))?'Jost and Cormorant loaded. Arial uses your system font.':'Web fonts unavailable or still loading; samples may show fallback fonts.';}).catch(()=>{fontNote.textContent='Web fonts unavailable; samples show fallback fonts.';});
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
 ['Utilities & previews', [['Verify','/verify.html','Deployment and API checks'],['Operations engine','/aesthetics/operations/','Supporting embedded interface'],['Playground','/playground.html','Client feature preview'],['Style preview','/playground/components/index.html','You are here']]]
];
const map=document.createElement('div');map.className='page-map';pages.append(map);
for(const [group,items] of pageGroups){const column=document.createElement('article');const heading=document.createElement('h3');heading.textContent=group;column.append(heading);for(const [name,url,description] of items){const link=document.createElement('a');link.className='page-link';const local=location.hostname==='127.0.0.1'||location.hostname==='localhost';const localPaths={'/':'/frontend/index.html','/playground.html':'/playground/index.html'};link.href=local?(localPaths[url]||(/^\/[^/]+\.html$/.test(url)?'/backend'+url:url)):url;link.target='_blank';link.rel='noopener';const title=document.createElement('strong'),note=document.createElement('span');title.textContent=name;note.textContent=description;link.append(title,note);column.append(link);}map.append(column);}
const flow=document.createElement('p');flow.className='page-flow';flow.textContent='Client submission → Admin → Brief. Admin also opens Outbound and Operations. Affiliates is an Admin view, not a separate page.';pages.append(flow);
// Two primary sections; technical examples stay available without crowding the review.
const preview=section('Glass pill preview','pill-preview','Proposed finish, using MAYA’s galaxy. Small text stays small. Examples only.');
const comparison=document.createElement('div');comparison.className='comparison';preview.append(comparison);
buttons.querySelector('h2').textContent='In Admin & Outbound';buttons.querySelector('p').textContent='Your selected finish applies to every example below, including menus and states.';
const contextActions=buttons.querySelector('.preview-row');contextActions.querySelector('.maya-pill').textContent='Tap to listen';
const outbound=row(buttons);outbound.classList.add('outbound-example');const caption=document.createElement('span');caption.textContent='Outbound';outbound.append(caption,Pill({label:'Write an email',onClick:()=>say('Email button example only.')}),Pill({label:'Refresh',onClick:()=>say('Refresh example only.')}));
preview.append(buttons);
const menuRow=row(preview);menuRow.append(openDrawer,openFilter);
const extra=document.createElement('details');extra.innerHTML='<summary>Panels & glossary</summary>';extra.append(menus,glossary);preview.append(extra);
// Visible hierarchy: sourced roles, with preview choices clearly distinguished from live styles.
const hierarchy=document.createElement('div');hierarchy.className='type-hierarchy';fonts.prepend(hierarchy);
const roles=[
 ['Brand','MAYA','Cormorant Garamond',24,500,'Client top-left wordmark','brand'],
 ['Editorial headline','Your next design','Cormorant Garamond',26,300,'Client dialog heading · existing .modal-card h2','editorial'],
 ['Page headline','All prospects','Jost',18,500,'Outbound campaign title','headline'],
 ['Subheadline','Campaign details','Jost',16,500,'Outbound detail and dialog titles','subheadline'],
 ['Body text','Your next appointment','Jost',14,400,'General UI body scale','body'],
 ['Paragraph','Add your ideas and references. MAYA keeps the details together for your next conversation.','Jost',12,300,'Client dialog help text · 1.7 line spacing','paragraph'],
 ['Label & count','Contacted 12','Jost',12,500,'Compact preview totals · proposed metric scale','label'],
 ['Table text','Name · Category · Notes','Jost',11,400,'Admin and Outbound lead rows','table'],
 ['Pill & field label','TAP TO LISTEN','Jost',10,300,'Voice pill and client form labels · 1.5px spacing','pill'],
 ['Small caption','PAID CLICKS · 7D','Jost',8.5,400,'Admin bottom-line captions','caption'],
 ['Technical text','request_id · 10:30','Menlo',11,400,'Logs and technical identifiers','technical']
];
for(const [role,text,family,size,weight,where,key] of roles){const item=document.createElement('article');item.className='type-row';item.dataset.type=key;const meta=document.createElement('div');const title=document.createElement('h3');title.textContent=role;const note=document.createElement('p');note.textContent=where;meta.append(title,note);const example=document.createElement('div');example.className='type-example';example.style.fontFamily=family==='Jost'?'var(--ui-font)':family==='Menlo'?'Menlo, monospace':"'Cormorant Garamond', serif";example.style.fontSize=size+'px';example.style.fontWeight=weight;example.style.lineHeight=key==='paragraph'?'1.7':'1.4';if(key==='pill')example.style.letterSpacing='1.5px';if(key==='brand'){example.style.letterSpacing='.22em';const logo=document.createElement('img');logo.src='/aesthetics/ui/logo-208.png';logo.alt='';logo.className='type-logo';example.append(logo);}example.append(document.createTextNode(text));const spec=document.createElement('small');spec.textContent=family+' · '+size+'px · '+weight;spec.dataset.family=family;spec.dataset.size=size;spec.dataset.weight=weight;item.append(meta,example,spec);hierarchy.append(item);}
fonts.insertBefore(fonts.querySelector('h2'),hierarchy);fonts.insertBefore(fonts.querySelector(':scope > p'),hierarchy);
const compareFonts=document.createElement('details');compareFonts.innerHTML='<summary>Compare font families</summary>';compareFonts.append(cards,fontNote,technical);fonts.append(compareFonts);
guide.remove();
gallery.replaceChildren(preview,fonts,pages);
const finishes=setupFinishes({comparison,preview,drawer,filter,say});
// Keep circular action buttons exactly as tall as the adjacent live pill, including font changes.
const sizeReference=contextActions.querySelector('.maya-pill');
new ResizeObserver(()=>{document.documentElement.style.setProperty('--preview-control-height',sizeReference.getBoundingClientRect().height+'px');}).observe(sizeReference);
const source=await (await fetch('/aesthetics/ui/components/tokens.css')).text();
const defaults=Object.fromEntries([...source.matchAll(/(--ui-[\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const storageKey='maya-component-gallery-tokens-v2';let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
let overrides={};
function valid(key,value){if(!value||/[;{}<>]|url\s*\(|var\s*\(/i.test(value))return false;
 if(/alpha|fill$|highlight$/.test(key))return /^0(?:\.\d+)?$|^1(?:\.0+)?$|^\.\d+$/.test(value);
 if(key==='--ui-pill-weight')return /^(300|400|500|600)$/.test(value);
 if(/(?:size|width|radius|blur|padding-[xy]|gap|space|tracking|shadow-y)$/.test(key))return /^\d+(?:\.\d+)?px$/.test(value)&&parseFloat(value)<=500;
 const property=key.endsWith('saturation')?'width':key.endsWith('duration')?'transition-duration':key.endsWith('easing')?'transition-timing-function':key.endsWith('transform')?'text-transform':key.endsWith('height')?'line-height':key.endsWith('font')?'font-family':'color';
 return CSS.supports(property,value);
}
const form=document.querySelector('#tokens');
for(const [key,value] of Object.entries(defaults)){const label=document.createElement('label'),input=document.createElement('input');label.textContent=({'--ui-font':'Interface font','--ui-pill-font-size':'Button text size','--ui-pill-padding-x':'Button side padding','--ui-pill-padding-y':'Button top/bottom padding','--ui-metric-size':'Count text size','--ui-pill-weight':'Button text weight','--ui-pill-tracking':'Letter spacing','--ui-pill-radius':'Button roundness','--ui-blur':'Background blur'})[key]||key.replace('--ui-','').replaceAll('-',' ');input.name=key;input.value=valid(key,saved[key]||'')?saved[key]:value;
 if(input.value!==value){overrides[key]=input.value;document.documentElement.style.setProperty(key,input.value);}input.addEventListener('input',()=>{const value=input.value.trim();const ok=valid(key,value);input.setAttribute('aria-invalid',String(!ok));if(!ok)return;overrides[key]=value;document.documentElement.style.setProperty(key,value);try{localStorage.setItem(storageKey,JSON.stringify(overrides));}catch{say('Preview updated; browser storage unavailable.');}});label.append(input);form.append(label);}
document.querySelector('#fallback').addEventListener('change',e=>document.body.classList.toggle('no-blur',e.target.checked));
document.querySelector('#reset').addEventListener('click',()=>{for(const key of Object.keys(defaults))document.documentElement.style.removeProperty(key);overrides={};try{localStorage.removeItem(storageKey);}catch{}for(const input of form.elements){input.value=defaults[input.name];input.removeAttribute('aria-invalid');}document.querySelector('#preview-font').value=defaults['--ui-font'];finishes.reset();say('Defaults restored.');});
document.querySelector('#export').addEventListener('click',()=>{const css='/* MAYA preview tokens. Review before global application. Finish: '+JSON.stringify(finishes.settings())+' */\n:root {\n'+Object.entries({...defaults,...overrides}).map(([k,v])=>'  '+k+': '+v+';').join('\n')+'\n}\n';const url=URL.createObjectURL(new Blob([css],{type:'text/css'}));const a=document.createElement('a');a.href=url;a.download='maya-tokens.css';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Tokens exported. Live pages are unchanged.');});

const choice=document.querySelector('#preview-font');choice.value=overrides['--ui-font']||defaults['--ui-font'];choice.addEventListener('change',()=>{const input=form.elements.namedItem('--ui-font');input.value=choice.value;input.dispatchEvent(new Event('input'));document.querySelectorAll('.type-row small[data-family="Jost"]').forEach(e=>{e.textContent=(choice.value.startsWith('Arial')?'Arial':'Jost')+' · '+e.dataset.size+'px · '+e.dataset.weight;});say(choice.selectedOptions[0].text+' selected for the examples. Font comparison cards stay fixed.');});
