// Native DOM components. No application state, network requests or framework.
let nextId=0;
function base(tag,name,{intensity='standard'}={}){const el=document.createElement(tag);el.className=`maya-ui maya-glass maya-${name}`;el.dataset.intensity=intensity;return el;}
function children(el,content){for(const item of [content].flat()){if(item!=null)el.append(item instanceof Node?item:document.createTextNode(String(item)));}return el;}
export function Pill({label='Action',disabled=false,selected=false,onClick,purpose,intensity='standard'}={}){const el=base('button','pill',{intensity});el.type='button';el.dataset.mayaType='P3';el.textContent=label;el.disabled=disabled;if(selected)el.setAttribute('aria-pressed','true');if(purpose)el.dataset.purpose=purpose;if(onClick)el.addEventListener('click',onClick);return el;}
export function IconButton({label,icon='+',disabled=false,onClick,intensity='standard'}={}){if(!label)throw new Error('IconButton requires an accessible label');const el=base('button','icon-button',{intensity});el.type='button';el.setAttribute('aria-label',label);el.title=label;const span=document.createElement('span');span.setAttribute('aria-hidden','true');const paths={'Save':'M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8','−':'M5 12h14','+':'M12 5v14M5 12h14','×':'M6 6l12 12M18 6L6 18','↻':'M20 7v5h-5M20 12a8 8 0 1 0-2 5'};
if(typeof icon==='string'&&paths[icon]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[icon]);svg.append(path);span.append(svg);}else children(span,icon);el.append(span);el.disabled=disabled;if(onClick)el.addEventListener('click',onClick);return el;}
export function GlassSurface({content,intensity='quiet'}={}){return children(base('section','surface',{intensity}),content);}
export function Metric({label,value='—',intensity='quiet'}={}){const el=base('div','metric',{intensity});const text=document.createElement('span');text.className='maya-metric-label';text.textContent=label;const number=document.createElement('span');number.className='maya-metric-value';number.textContent=value;el.append(text,number);return el;}
function overlay(name,{title,content,footer,intensity='overlay'}={}){
 const el=base('dialog',name,{intensity}),heading=document.createElement('h2'),header=document.createElement('header'),body=document.createElement('div');
 heading.className='maya-component-title';heading.id=`maya-component-${++nextId}`;heading.textContent=title;el.setAttribute('aria-labelledby',heading.id);
 header.className='maya-component-header';header.append(heading,IconButton({label:'Close '+title,icon:'×',onClick:()=>el.close()}));body.className='maya-component-body';children(body,content);el.append(header,body);
 if(footer){const f=document.createElement('footer');f.className='maya-component-footer';children(f,footer);el.append(f);}
 let trigger;
 el.showFrom=from=>{trigger=from||document.activeElement;if(!el.isConnected)document.body.append(el);if(!el.open)el.showModal();};
 el.addEventListener('click',e=>{const r=el.getBoundingClientRect();if(e.target===el&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))el.close();});
 el.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus();});return el;
}
export function Drawer(options={}){return overlay('drawer',options);}
export function FilterPopover({title='Filter',values=[],selected=values,onApply=()=>{}}={}){
 const content=document.createElement('div');content.className='maya-component-body';const boxes=[];
 for(const value of values){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=value;box.checked=selected.includes(value);label.append(box,document.createTextNode(value));content.append(label);boxes.push(box);}
 let el;const apply=Pill({label:'Apply',onClick:()=>{onApply(boxes.filter(b=>b.checked).map(b=>b.value));el.close();}});
 el=overlay('filter-popover',{title,content,footer:[apply]});let anchor;const show=el.showFrom;
 const position=()=>{if(!el.open)return;const r=anchor?.getBoundingClientRect()||{left:16,bottom:16};el.style.left=Math.max(16,Math.min(r.left,innerWidth-el.offsetWidth-16))+'px';el.style.top=Math.max(16,Math.min(r.bottom+8,innerHeight-el.offsetHeight-16))+'px';};
 el.showFrom=from=>{anchor=from;show(from);position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);};
 el.addEventListener('close',()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);});return el;
}
