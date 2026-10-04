import {fields as buildFields,borders} from './surface-editors.js';
import {highlightPadding} from './restore-controls.js';
// Review containers are a separate material layer from the action pills.
export function setupOverlay(comparison){
 const defaults={fill:18,rim:22,blur:22,saturation:180,radius:12,paddingX:16,paddingY:16,borderColor:'white',enabled:true},values={...defaults};
 const panel=document.createElement('details');panel.className='overlay-controls type-editor';panel.innerHTML='<summary>Edit</summary><div class="type-editor-fields"></div>';
 comparison.parentElement.querySelector('.finish-controls').after(panel);
 buildFields(panel.lastChild,values,[['enabled','Glass',[['true','On'],['false','Off']]],['fill','Opacity',{max:100}],['rim','Border',{max:100}],['borderColor','Border color',borders],['radius','Corners',{max:24}],['blur','Blur',{max:40}],['saturation','Saturation',{max:200}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]],()=>render());
 function render(){const enabled=values.enabled,root=document.documentElement;for(const [key,value] of Object.entries(values).filter(([key])=>!['borderColor','enabled'].includes(key)))root.style.setProperty('--review-panel-'+key,['blur','radius','paddingX','paddingY'].includes(key)?value+'px':key==='saturation'?value+'%':String(enabled?value/100:0));root.style.setProperty('--review-panel-border-rgb',values.borderColor==='black'?'0 0 0':values.borderColor==='gray'?'170 181 196':'255 255 255');for(const input of panel.querySelectorAll('[data-field]'))input.value=values[input.dataset.field];root.style.setProperty('--maya-frost',enabled?`blur(${values.blur}px) saturate(${values.saturation}%)`:'none');root.style.setProperty('--review-panel-filter',enabled?`blur(${values.blur}px) saturate(${values.saturation}%)`:'none');}
 highlightPadding(panel,()=>[...document.querySelectorAll('#gallery>.preview-section')],()=>({x:values.paddingX,y:values.paddingY}));
 render();return {settings:()=>({...values}),set:v=>{for(const key of Object.keys(values))if(Number.isInteger(v?.[key]))values[key]=v[key];values.borderColor=['black','gray','white'].includes(v?.borderColor)?v.borderColor:'white';values.enabled=v?.enabled!==false;render();},reset:()=>{Object.assign(values,defaults);render();}};
}
