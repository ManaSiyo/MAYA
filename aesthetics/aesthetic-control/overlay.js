import {fields as buildFields,borders} from './surface-editors.js';
import {highlightPadding} from './restore-controls.js';
// Review containers are a separate material layer from the action pills.
export function setupOverlay(comparison){
 const defaults={fill:18,rim:22,blur:22,saturation:180,paddingX:16,paddingY:16,borderColor:'white'},values={...defaults};let enabled=true;
 const panel=document.createElement('details');panel.className='overlay-controls type-editor';panel.innerHTML='<summary>Edit</summary><div class="type-editor-fields"><label><input id="overlay-enabled" type="checkbox" checked> Glass</label><div class="finish-sliders"></div></div>';
 comparison.parentElement.querySelector('.finish-controls').after(panel);
 const fields=[];
 for(const [key,label,max,unit] of [['fill','Fill',100,'%'],['rim','Border',100,'%'],['blur','Blur',40,'px'],['saturation','Saturation',200,'%'],['paddingX','Padding X',40,'px'],['paddingY','Padding Y',40,'px']]){
  const row=document.createElement('label'),input=document.createElement('input'),output=document.createElement('output');row.append(document.createTextNode(label));input.type='range';input.min=0;input.max=max;input.setAttribute('aria-label',label);input.addEventListener('input',()=>{values[key]=Number(input.value);render();});row.append(input,output);panel.querySelector('.finish-sliders').append(row);fields.push({key,input,output,unit});
 }
 buildFields(panel.querySelector('.type-editor-fields'),values,[['borderColor','Border color',borders]],()=>render());
 function render(){const root=document.documentElement;for(const [key,value] of Object.entries(values).filter(([key])=>key!=='borderColor'))root.style.setProperty('--review-panel-'+key,['blur','paddingX','paddingY'].includes(key)?value+'px':key==='saturation'?value+'%':String(enabled?value/100:0));root.style.setProperty('--review-panel-border-rgb',values.borderColor==='black'?'0 0 0':'255 255 255');panel.querySelector('[data-field="borderColor"]').value=values.borderColor;root.style.setProperty('--maya-frost',enabled?`blur(${values.blur}px) saturate(${values.saturation}%)`:'none');root.style.setProperty('--review-panel-filter',enabled?`blur(${values.blur}px) saturate(${values.saturation}%)`:'none');for(const f of fields){f.input.value=values[f.key];f.output.value=values[f.key]+f.unit;}panel.querySelector('input[type=checkbox]').checked=enabled;for(const e of document.querySelectorAll('#gallery>.preview-section')){e.style.setProperty('--padding-debug-x',values.paddingX+'px');e.style.setProperty('--padding-debug-y',values.paddingY+'px');}}
 highlightPadding(panel,()=>[...document.querySelectorAll('#gallery>.preview-section')],()=>({x:values.paddingX,y:values.paddingY}));
 panel.querySelector('input[type=checkbox]').addEventListener('change',e=>{enabled=e.target.checked;render();});render();return {settings:()=>({enabled,...values}),set:v=>{for(const key of Object.keys(values))if(Number.isInteger(v?.[key]))values[key]=v[key];values.borderColor=v?.borderColor==='black'?'black':'white';enabled=v?.enabled!==false;render();},reset:()=>{Object.assign(values,defaults);enabled=true;render();}};
}
