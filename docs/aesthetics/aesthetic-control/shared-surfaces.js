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
 const note=document.createElement('p');note.dataset.mayaType=note.dataset.previewCategory='P1';note.textContent='The same drawer material on MAYA, Admin, Brief and Operation Room.';
 const settingsSample=document.createElement('div');
 for(const title of ['Behind the scenes','Add Tools']){const h=document.createElement('h3');h.dataset.mayaType=h.dataset.previewCategory='H3';h.textContent=title;settingsSample.append(h);}
 const submissions=document.createElement('div');submissions.className='submission-card-list';submissions.setAttribute('aria-label','Submission cards preview');
 const card=window.MayaSubmissionCards.create({id:'preview',name:'Submission preview',description:'Midnight velvet tailored coat',files:[{id:'preview-photo',name:'dream-garment.jpg'}]},{src:'/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg',onSelect:()=>{},onDelete:()=>MayaSubmissionCards.confirmDelete(async()=>{})});card.setAttribute('aria-label','Submission card layout sample');submissions.append(card);
 const drawer=Drawer({title:'Settings',content:[note,settingsSample,submissions]});
 const share=document.createElement('dialog');share.id='share-style-preview';share.className='share-dialog-preview';share.dataset.mayaPanel='inner';share.setAttribute('aria-label','Share project');
 share.innerHTML='<div data-maya-type="H3">Share project</div><input data-maya-control="field" data-maya-type="P1" aria-label="Project link preview" readonly value="https://maya.manasiyo.com/?share=preview"><div class="share-preview-actions"><button class="maya-glass-button" data-maya-type="P3" data-copy>Copy</button><button class="maya-glass-button" data-maya-type="P3" data-done>Done</button></div><p data-maya-type="P3">Anyone with this link can open the project and keep their own copy. Yours is untouched.</p>';
 share.querySelector('[data-copy]').onclick=event=>event.currentTarget.textContent='Copied';share.querySelector('[data-done]').onclick=()=>share.close();
 host.append(Pill({label:'Share dialog',onClick:()=>{if(!share.isConnected)document.body.append(share);share.querySelector('[data-copy]').textContent='Copy';share.showModal();}}));
 const photo=document.createElement('img');photo.src='/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg';photo.alt='Midnight velvet';photo.style.cssText='width:100%;height:220px;object-fit:contain';
 const imagePreview=document.createElement('div');imagePreview.className='maya-notes-preview';imagePreview.dataset.mayaPanel='inner';imagePreview.append(photo);host.append(imagePreview);
 MayaImageViewer.bind(photo);
 MayaImageViewer.notesDrawer({parent:imagePreview,id:'preview-design-notes',card:{profile:{bio:'Tailored velvet coat',color:'Midnight blue',silhouette:'Long fitted coat'},refs:[{tag:'color',title:'Midnight blue'},{tag:'visual ref',title:'Evening tailoring'}]}});
 host.append(Pill({label:'Drawer',onClick:event=>drawer.showFrom(event.currentTarget)}));
 const usage=document.createElement('p');usage.dataset.mayaType=usage.dataset.previewCategory='P3';for(const [label,href]of [['MAYA','/'],['Admin','/status.html'],['Brief','/backend.html'],['Brief operations','/backend.html']]){const link=document.createElement('a');link.textContent=label;link.href=href;usage.append(link,document.createTextNode(' · '));}host.append(usage);
 highlightPadding(edit,()=>[drawer],()=>({x:values.paddingX,y:values.paddingY}));
 const segments=document.createElement('section');segments.id='segmented-controls-preview';parent.append(segments);
 const title=document.createElement('h3');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Segments';
 const output=document.createElement('p');output.dataset.mayaType=output.dataset.previewCategory='P1';output.textContent='Global preview';output.setAttribute('aria-live','polite');
 const group=Segmented({label:'Fabric segments preview',values:['Global','In House','Favorites'],selected:'Global',onChange:value=>output.textContent=value+' preview'});
 segments.append(title,group,output);
 const help=document.createElement('p');help.dataset.mayaType=help.dataset.previewCategory='P3';help.textContent='Brief and Operation Room fabric views · Glass pill material, padding and P3 text.';segments.append(help);
 render();return {drawer,settings:()=>({drawer:{...values}})};
}
