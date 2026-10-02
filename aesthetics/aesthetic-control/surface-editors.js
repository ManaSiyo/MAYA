// Live, saved presentation controls; no account data or provider operations.
const fonts=[['jost','Jost'],['cormorant','Cormorant']],colors=[['white','White'],['gray','Gray']],backgrounds=['gray','blue','yellow','green','pink'].map(v=>[v,v[0].toUpperCase()+v.slice(1)]);
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
 const render=()=>window.MayaTypographyControls.previewSurfaces(settings);
 const panelFields=[['fill','Opacity',{max:100}],['rim','Border',{max:100}],['radius','Corners',{max:24}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]];
 const inner=editor(panels,'Inner panel','inner',settings.inner,[...panelFields,['width','Width %',{min:20,max:100}]],render);panels.querySelector('.context-grid').before(inner);
 const filter=editor(panels,'Filter','filter',settings.filter,[...panelFields,['width','Width',{min:160,max:600}]],render);inner.after(filter);
 const divider=document.createElement('hr');divider.className='visual-divider';guide.before(divider);
 const title=document.createElement('h3');title.textContent='Table';guide.before(title);
 const controls=document.createElement('div');controls.id='table-editors';guide.before(controls);
 editor(controls,'Table','table',settings.table,[['fill','Opacity',{max:100}],['rim','Border',{max:100}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]],render);
 const bg=[['background','Background',backgrounds],['opacity','Opacity',{max:100}]];
 editor(controls,'Top row','header',settings.table.header,[...typeFields,...bg],render);
 editor(controls,'First column','first-column',settings.table.firstColumn,bg,render);
 settings.table.columns.forEach((col,i)=>editor(controls,['First column · Full name','Second column · Status','Third column · Latest Notes'][i],'column-'+i,col,typeFields,render));
 render();return {settings:()=>settings};
}
// Edit controls close on outside click, focus leaving, Escape, or another Edit.
// Section folds and persistent States are not temporary dropdowns.
export function setupDismissal(){
 const selector='.type-editor,.overlay-controls,.finish-controls>details';
 document.addEventListener('click',e=>{for(const el of document.querySelectorAll(selector))if(el.open&&!el.contains(e.target))el.open=false;});
 document.addEventListener('focusin',e=>{for(const el of document.querySelectorAll(selector))if(el.open&&!el.contains(e.target))el.open=false;});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const opened=[...document.querySelectorAll(selector)].filter(el=>el.open);for(const el of opened)el.open=false;opened.at(-1)?.querySelector('summary')?.focus();});
}
