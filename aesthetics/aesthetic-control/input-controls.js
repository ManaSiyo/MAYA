import {fields,backgrounds,borders} from './surface-editors.js';
import {addRestore} from './restore-controls.js';

// Native controls retain their keyboard/label semantics. Preview settings use
// the exact shared runtime that governs live pages, not a gallery-only drawing.
export function setupInputControls({design,dropdownRow,popupRow}){
 const checkbox={...design.checkbox},scrollbar={...design.scrollbar};
 const node=(tag,text,role)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(role){el.dataset.mayaType=role;el.dataset.previewCategory=role;}return el;};
 const host=node('section');host.id='input-controls-preview';popupRow.before(host);
 host.append(node('h3','Dropdown and checkboxes','H3'));
 const pair=node('div');pair.className='input-control-pair';const dropdownGroup=node('section'),checkboxGroup=node('section');dropdownGroup.className='input-control-group';checkboxGroup.className='input-control-group';pair.append(dropdownGroup,checkboxGroup);host.append(pair);dropdownGroup.append(popupRow);
 const dropdownDetails=node('details');dropdownDetails.className='input-control-usage dropdown-preview-details';dropdownDetails.append(node('summary','Preview','P3'),dropdownRow);popupRow.append(dropdownDetails);
 const popupRestore=popupRow.querySelector('.restore-editor');popupRow.querySelector('.popup-editor .type-editor-fields').append(popupRestore);
 const cameraDetails=node('details');cameraDetails.className='input-control-usage';cameraDetails.append(node('summary','Camera preview','P3'));const cameraPreview=node('div');cameraPreview.dataset.mayaPopup='';cameraPreview.className='camera-style-preview';cameraPreview.append(node('h3','Take a photo','H3'),node('p','Position your face, then take a photo.','P1'));const cameraActions=node('div');cameraActions.className='camera-preview-actions';for(const label of ['Take photo','Cancel']){const button=node('button',label,'P3');button.type='button';button.className='drawer-action';cameraActions.append(button);}cameraPreview.append(cameraActions);cameraDetails.append(cameraPreview);dropdownGroup.append(cameraDetails);
 const render=()=>window.MayaPresentationControls.previewInputs({checkbox,scrollbar});
 function editor(kind,values,specs,parent=host){
  const row=node('div');row.className='surface-edit-row';row.dataset.editor=kind;
  const edit=node('details');edit.className='type-editor '+kind+'-editor';
  edit.append(node('summary','Edit '+(kind==='checkbox'?'checkbox':'scrollbars'),'P3'));
  const grid=node('div');grid.className='type-editor-fields';edit.append(grid);row.append(edit);parent.append(row);
  fields(grid,values,specs,render);
  addRestore(edit,{label:kind,read:()=>values,write:v=>{Object.assign(values,v);for(const field of edit.querySelectorAll('[data-field]'))field.value=values[field.dataset.field];render();}});
  return edit;
 }
 editor('checkbox',checkbox,[['size','Size',{min:12,max:28}],['radius','Corners',{min:0,max:14}],['background','Unchecked background',backgrounds],['fill','Unchecked opacity',{max:100}],['rim','Border opacity',{max:100}],['borderColor','Border color',borders],['checkedColor','Checked background',{type:'color'}],['checkColor','Check color',{type:'color'}]],checkboxGroup);
 const checkboxDetails=node('details');checkboxDetails.className='input-control-usage checkbox-preview-details';checkboxDetails.append(node('summary','Preview','P3'));checkboxGroup.append(checkboxDetails);const states=node('div');states.className='checkbox-preview-states';checkboxDetails.append(states);
 for(const [key,label,checked,disabled] of [['unchecked','Unchecked',false,false],['checked','Checked',true,false],['mixed','Mixed',false,false],['disabled','Disabled',true,true]]){
  const row=node('label',null,'P3'),input=node('input');input.type='checkbox';input.id='checkbox-preview-'+key;input.checked=checked;input.disabled=disabled;input.indeterminate=key==='mixed';row.append(input,node('span',label));states.append(row);
 }
 const hint=node('p','Use Tab and Space to try focus and selection.','P1');checkboxDetails.append(hint);
 function usage(title,items,parent=host){const details=node('details');details.className='input-control-usage';details.append(node('summary',title,'P3'));for(const [label,url,where] of items){const row=node('p',null,'P1'),link=node('a',label);link.href=url;row.append(link,document.createTextNode(' — '+where));details.append(row);}parent.append(details);}
 usage('Where checkboxes are used',[['Admin','/status.html','Automations and lead filters'],] ,checkboxGroup);
 editor('scrollbar',scrollbar,[['width','Width X/Y',{min:2,max:20}],['length','Thumb length %',{min:25,max:100}],['autoHide','Auto hide',[['true','On'],['false','Off']]],['hideAfter','Idle delay ms',{min:200,max:3000}],['radius','Corners',{min:0,max:16}],['thumbColor','Thumb color',{type:'color'}],['thumbOpacity','Thumb opacity',{max:100}],['trackColor','Track color',{type:'color'}],['trackOpacity','Track opacity',{max:100}]]);
 const scroll=node('div');scroll.id='scrollbar-preview';scroll.dataset.mayaScrollbar='visible';scroll.dataset.mayaPanel='inner';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Scrollbar preview');
 const wide=node('div');wide.className='scrollbar-preview-content';
 for(let i=0;i<8;i++)wide.append(node('p','Scroll preview · '+(i+1)+' · Use the wheel, keyboard or scrollbar.','P1'));
 const scrollDetails=node('details');scrollDetails.className='input-control-usage scrollbar-preview-details';scrollDetails.append(node('summary','Preview','P3'));scroll.append(wide);scrollDetails.append(scroll);host.append(scrollDetails);

 render();return {settings:()=>({checkbox:{...checkbox},scrollbar:{...scrollbar}})};
}
