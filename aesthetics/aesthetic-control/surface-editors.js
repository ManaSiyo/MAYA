import {addRestore,highlightPadding} from './restore-controls.js';
import {setupTableCellEditor} from './table-cell-editor.js';
// Live, saved presentation controls; no account data or provider operations.
const fonts=[['jost','Jost'],['cormorant','Cormorant']],colors=[['white','White'],['gray','Gray']],backgrounds=['black','gray','blue','yellow','green','pink'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]);
export {backgrounds};
export const tableBorders=[['white','White'],['black','Black']];
export const borders=[...tableBorders,['gray','Gray']];
export function fields(parent,values,specs,onChange){
 for(const [key,title,options] of specs){
  const label=document.createElement('label');label.dataset.mayaType='P3';label.append(document.createTextNode(title));
  const input=document.createElement(Array.isArray(options)?'select':'input');input.dataset.field=key;input.dataset.mayaType='P3';input.dataset.mayaControl='field';
  if(Array.isArray(options))for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
  else{input.type=options.type||'number';input.min=options.min??0;input.max=options.max;input.step=options.step??1;}
  input.value=values[key];input.addEventListener('input',()=>{const value=input.type==='color'?input.value:key==='enabled'?input.value==='true':Array.isArray(options)&&key!=='weight'?input.value:Number(input.value);if(input.type!=='color'&&!Array.isArray(options)&&(!Number.isInteger(value)||value<Number(input.min)||value>Number(input.max)))return;values[key]=value;onChange();});label.append(input);parent.append(label);
 }
}
export const typeFields=[['font','Font',fonts],['case','Case',[['none','Normal'],['uppercase','ALL CAPS']]],['size','Size',{min:8,max:32}],['weight','Weight',Array.from({length:7},(_,i)=>[String(200+i*50),String(200+i*50)])],['style','Style',[['normal','Normal'],['italic','Italic']]],['color','Color',colors],['align','Alignment',[['left','Left'],['center','Centered'],['right','Right']]],['vertical','Vertical',[['top','Top'],['middle','Middle'],['bottom','Bottom']]]];
function editor(parent,label,id,values,specs,render){
 const host=document.createElement('div');host.className='surface-edit-row';host.dataset.editor=id;
 const title=document.createElement('span');title.textContent=label;
 const edit=document.createElement('details');edit.className='type-editor';edit.innerHTML='<summary>Edit</summary><div class="type-editor-fields"></div>';
 host.append(title,edit);parent.append(host);fields(edit.lastChild,values,specs,render);
 addRestore(edit,{label,read:()=>({...Object.fromEntries(specs.map(([key])=>[key,values[key]])),...(id==='table'?{columnWidths:{...values.columnWidths}}:{})}),write:v=>{Object.assign(values,v);for(const input of edit.querySelectorAll('[data-field]'))input.value=values[input.dataset.field];render();edit.dispatchEvent(new Event('input',{bubbles:true}));}});return host;
}
export function setupSurfaceEditors({panels,guide,design}){
 const settings={inner:structuredClone(design.inner),filter:structuredClone(design.filter),table:structuredClone(design.table)};
 let cellEditor;
 const render=()=>{window.MayaTypographyControls.previewSurfaces(settings);cellEditor?.refresh();for(const el of document.querySelectorAll('#panels .inner-panel')){el.style.setProperty('--padding-debug-x',settings.inner.paddingX+'px');el.style.setProperty('--padding-debug-y',settings.inner.paddingY+'px');}};
 const panelFields=[['background','Background',backgrounds],['fill','Opacity',{max:100}],['blur','Blur',{max:40}],['saturation','Saturation',{max:200}],['rim','Border',{max:100}],['borderColor','Border color',borders],['radius','Corners',{max:24}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]];
 const inner=editor(panels,'Inner panel','inner',settings.inner,[...panelFields,['width','Width %',{min:20,max:100}]],render);panels.querySelector('.panel-preview').before(inner);
 highlightPadding(inner.querySelector('details'),()=>[...panels.querySelectorAll('.inner-panel')],()=>({x:settings.inner.paddingX,y:settings.inner.paddingY}));
 const tablePanel=editor(panels,'Table','table',settings.table,[...panelFields.map(spec=>spec[0]==='borderColor'?[...spec.slice(0,2),tableBorders]:spec),['outerWidth','Outer border px',{max:8}],['innerWidth','Inner border px',{max:8}],['innerBorderColor','Inner border color',tableBorders],['innerRim','Inner border opacity',{max:100}]],render);
 highlightPadding(tablePanel,()=>[...guide.querySelectorAll('td,th')],()=>({x:settings.table.paddingX,y:settings.table.paddingY}));
 const divider=document.createElement('hr');divider.className='visual-divider';guide.before(divider);
 const title=document.createElement('h2');title.textContent='Table';title.className='gallery-section-title';guide.before(title);
 cellEditor=setupTableCellEditor({guide,settings:settings.table,render});
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
