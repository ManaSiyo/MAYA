// Live, saved presentation controls; no account data or provider operations.
const fonts=[['jost','Jost'],['cormorant','Cormorant']],colors=[['white','White'],['gray','Gray']],backgrounds=['black','gray','blue','yellow','green','pink'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]);
export function fields(parent,values,specs,onChange){
 for(const [key,title,options] of specs){
  const label=document.createElement('label');label.append(document.createTextNode(title));
  const input=document.createElement(Array.isArray(options)?'select':'input');input.dataset.field=key;
  if(Array.isArray(options))for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
  else{input.type='number';input.min=options.min??0;input.max=options.max;input.step=options.step??1;}
  input.value=values[key];input.addEventListener('input',()=>{const value=Array.isArray(options)&&key!=='weight'?input.value:Number(input.value);if(!Array.isArray(options)&&(!Number.isInteger(value)||value<Number(input.min)||value>Number(input.max)))return;values[key]=value;onChange();});label.append(input);parent.append(label);
 }
}
export const typeFields=[['font','Font',fonts],['case','Case',[['none','Normal'],['uppercase','ALL CAPS']]],['size','Size',{min:8,max:32}],['weight','Weight',[['300','300'],['350','350'],['400','400']]],['color','Color',colors],['align','Alignment',[['left','Left'],['center','Centered'],['right','Right']]],['vertical','Vertical',[['top','Top'],['middle','Middle'],['bottom','Bottom']]]];
function editor(parent,label,id,values,specs,render){
 const host=document.createElement('div');host.className='surface-edit-row';host.dataset.editor=id;
 const title=document.createElement('span');title.textContent=label;
 const edit=document.createElement('details');edit.className='type-editor';edit.innerHTML='<summary>Edit</summary><div class="type-editor-fields"></div>';
 host.append(title,edit);parent.append(host);fields(edit.lastChild,values,specs,render);return host;
}
export function setupSurfaceEditors({panels,guide,design}){
 const settings={inner:structuredClone(design.inner),filter:structuredClone(design.filter),table:structuredClone(design.table)};
 const render=()=>{window.MayaTypographyControls.previewSurfaces(settings);for(const el of document.querySelectorAll('#panels .inner-panel')){el.style.setProperty('--padding-debug-x',settings.inner.paddingX+'px');el.style.setProperty('--padding-debug-y',settings.inner.paddingY+'px');}};
 const panelFields=[['fill','Opacity',{max:100}],['rim','Border',{max:100}],['radius','Corners',{max:24}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]];
 const inner=editor(panels,'Inner panel','inner',settings.inner,[...panelFields,['width','Width %',{min:20,max:100}]],render);panels.querySelector('.context-grid').before(inner);
 const debug=document.createElement('button');debug.type='button';debug.className='padding-debug';debug.dataset.paddingDebug='inner';debug.textContent='Show padding';debug.setAttribute('aria-pressed','false');debug.onclick=()=>{const on=debug.getAttribute('aria-pressed')!=='true';debug.setAttribute('aria-pressed',String(on));debug.textContent=on?'Hide padding':'Show padding';document.querySelectorAll('#panels .inner-panel').forEach(el=>el.classList.toggle('show-padding',on));};inner.querySelector('.type-editor-fields').append(debug);
 const filter=editor(panels,'Filter','filter',settings.filter,[...panelFields,['width','Width',{min:160,max:600}]],render);inner.after(filter);
 const divider=document.createElement('hr');divider.className='visual-divider';guide.before(divider);
 const title=document.createElement('h3');title.textContent='Table';guide.before(title);
 const controls=document.createElement('div');controls.id='table-editors';guide.before(controls);
 editor(controls,'Table','table',settings.table,[['background','Background',backgrounds],['fill','Opacity',{max:100}],['rim','Border',{max:100}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]],render);
 const bg=[['background','Background',backgrounds],['opacity','Opacity',{max:100}]];
 editor(controls,'Top row','header',settings.table.header,[...typeFields,...bg],render);
 editor(controls,'First column','first-column',settings.table.firstColumn,bg,render);
 settings.table.columns.forEach((col,i)=>editor(controls,['Full name','Status','Latest Notes'][i],'column-'+i,col,typeFields,render));
 render();return {settings:()=>settings};
}
// Edit controls close on outside click, focus leaving, Escape, or another Edit.
// Section folds and persistent States are not temporary dropdowns.
export function setupDismissal(){
 const selector='.type-editor,.overlay-controls,.finish-controls>details';
 setupEditorPositioning();
 document.addEventListener('click',e=>{for(const el of document.querySelectorAll(selector))if(el.open&&!el.contains(e.target))el.open=false;});
 document.addEventListener('focusin',e=>{if(e.target.matches('summary')&&e.target.closest(selector))return;for(const el of document.querySelectorAll(selector))if(el.open&&!el.contains(e.target))el.open=false;});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const opened=[...document.querySelectorAll(selector)].filter(el=>el.open);for(const el of opened)el.open=false;opened.at(-1)?.querySelector('summary')?.focus();});
}

// Place editors beside their own Edit control; clamp to the section/viewport.
function setupEditorPositioning(){
 const place=edit=>{
  if(!edit.open)return;
  const popup=edit.querySelector('.type-editor-fields'),trigger=edit.querySelector('summary');
  if(!popup||!trigger)return;
  const bounds=edit.closest('.preview-section').getBoundingClientRect(),anchor=trigger.getBoundingClientRect(),origin=edit.getBoundingClientRect();
  const leftEdge=Math.max(8,bounds.left+8),rightEdge=Math.min(innerWidth-8,bounds.right-8);
  const width=Math.min(440,rightEdge-leftEdge);
  popup.style.width=width+'px';popup.style.maxWidth='none';
  popup.style.left=Math.max(leftEdge,Math.min(anchor.left,rightEdge-width))-origin.left+'px';
  const footer=document.querySelector('.save-bar').getBoundingClientRect();
  const bottom=Math.min(innerHeight-8,footer.top-8),below=bottom-anchor.bottom-6,above=anchor.top-14;
  const flip=below<Math.min(popup.scrollHeight,240)&&above>below;
  popup.style.maxHeight=Math.max(80,flip?above:below)+'px';
  const height=Math.min(popup.scrollHeight,Math.max(80,flip?above:below));
  popup.style.top=Math.max(8,flip?anchor.top-height-6:anchor.bottom+6)-origin.top+'px';
 };
 const refresh=()=>document.querySelectorAll('.type-editor[open]').forEach(place);
 const changes=new MutationObserver(records=>records.forEach(r=>place(r.target)));
 document.querySelectorAll('.type-editor').forEach(edit=>changes.observe(edit,{attributes:true,attributeFilter:['open']}));
 document.addEventListener('toggle',e=>{if(e.target.matches('.type-editor'))place(e.target);},true);
 // Reposition after clicks that scroll an Edit control into view.
 document.addEventListener('click',()=>requestAnimationFrame(refresh));
 window.addEventListener('resize',refresh);document.addEventListener('scroll',refresh,true);
}
