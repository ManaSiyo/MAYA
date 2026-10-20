import {Drawer,Pill,Segmented} from '/aesthetics/ui/components/components.js';
import {fields,backgrounds,borders} from './surface-editors.js';
import {addRestore,highlightPadding} from './restore-controls.js';

export function setupSharedSurfaces({parent,design}){
 const values={...design.drawer},host=document.createElement('section');host.id='drawer-controls-preview';parent.append(host);
 const heading=document.createElement('h3');heading.dataset.mayaType=heading.dataset.previewCategory='H3';heading.textContent='Drawer';host.append(heading);
 const edit=document.createElement('details');edit.className='type-editor drawer-editor';edit.innerHTML='<summary>Edit drawer</summary><div class="type-editor-fields"></div>';
 const render=()=>MayaPresentationControls.previewDrawer(values);
 fields(edit.lastChild,values,[['background','Background',[['navy','MAYA'],...backgrounds]],['fill','Opacity',{max:100}],['rim','Border',{max:100}],['borderColor','Border color',borders],['radius','Corners',{max:24}],['blur','Blur',{max:40}],['saturation','Saturation',{max:200}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]],render);
 const row=document.createElement('div');row.className='surface-edit-row';row.append(edit);host.append(row);
 addRestore(edit,{label:'drawer',read:()=>values,write:v=>{Object.assign(values,v);for(const input of edit.querySelectorAll('[data-field]'))input.value=values[input.dataset.field];render();}});
 const note=document.createElement('p');note.dataset.mayaType=note.dataset.previewCategory='P1';note.textContent='The same drawer material on MAYA, Admin, Outbound, Brief and Operation Room.';
 const drawer=Drawer({title:'Settings',content:[note,Pill({label:'Edit drawer',onClick:event=>{event.stopPropagation();drawer.addEventListener('close',()=>{edit.open=true;edit.scrollIntoView({block:'center'});edit.querySelector('input,select').focus();},{once:true});drawer.close();}})]});
 host.append(Pill({label:'Drawer',onClick:event=>drawer.showFrom(event.currentTarget)}));
 const usage=document.createElement('p');usage.dataset.mayaType=usage.dataset.previewCategory='P3';for(const [label,href]of [['MAYA','/'],['Admin','/status.html'],['Outbound','/outbound.html'],['Brief','/backend.html'],['Operation Room','/operations.html']]){const link=document.createElement('a');link.textContent=label;link.href=href;usage.append(link,document.createTextNode(' · '));}host.append(usage);
 highlightPadding(edit,()=>[drawer],()=>({x:values.paddingX,y:values.paddingY}));
 const segments=document.createElement('section');segments.id='segmented-controls-preview';parent.append(segments);
 const title=document.createElement('h3');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Segments';
 const output=document.createElement('p');output.dataset.mayaType=output.dataset.previewCategory='P1';output.textContent='Sourceable preview';output.setAttribute('aria-live','polite');
 const group=Segmented({label:'Fabric segments preview',values:['Sourceable','In House','Favorites'],selected:'Sourceable',onChange:value=>output.textContent=value+' preview'});
 segments.append(title,group,output,Pill({label:'Edit glass pill',onClick:event=>{event.stopPropagation();const target=document.querySelector('.finish-controls details');target.open=true;target.scrollIntoView({block:'center'});target.querySelector('input,select').focus();}}));
 const help=document.createElement('p');help.dataset.mayaType=help.dataset.previewCategory='P3';help.textContent='Brief and Operation Room fabric views · Glass pill material, padding and P3 text.';segments.append(help);
 render();return {drawer,settings:()=>({drawer:{...values}})};
}
