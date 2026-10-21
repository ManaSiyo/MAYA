import {fields,backgrounds,borders} from './surface-editors.js';
import {addRestore} from './restore-controls.js';

// Native controls retain their keyboard/label semantics. Preview settings use
// the exact shared runtime that governs live pages, not a gallery-only drawing.
export function setupInputControls({design,dropdownRow,popupRow}){
 const checkbox={...design.checkbox},scrollbar={...design.scrollbar};
 const node=(tag,text,role)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(role){el.dataset.mayaType=role;el.dataset.previewCategory=role;}return el;};
 const host=node('section');host.id='input-controls-preview';popupRow.before(host);
 host.append(node('h3','Dropdown and checkboxes','H3'),dropdownRow,popupRow);
 const render=()=>window.MayaPresentationControls.previewInputs({checkbox,scrollbar});
 function editor(kind,values,specs){
  const row=node('div');row.className='surface-edit-row';row.dataset.editor=kind;
  const edit=node('details');edit.className='type-editor '+kind+'-editor';
  edit.append(node('summary','Edit '+(kind==='checkbox'?'checkbox':'scrollbars'),'P3'));
  const grid=node('div');grid.className='type-editor-fields';edit.append(grid);row.append(edit);host.append(row);
  fields(grid,values,specs,render);
  addRestore(edit,{label:kind,read:()=>values,write:v=>{Object.assign(values,v);for(const field of edit.querySelectorAll('[data-field]'))field.value=values[field.dataset.field];render();}});
  return edit;
 }
 editor('checkbox',checkbox,[['size','Size',{min:12,max:28}],['radius','Corners',{min:0,max:14}],['background','Unchecked background',backgrounds],['fill','Unchecked opacity',{max:100}],['rim','Border opacity',{max:100}],['borderColor','Border color',borders],['checkedColor','Checked background',{type:'color'}],['checkColor','Check color',{type:'color'}]]);
 const states=node('div');states.className='checkbox-preview-states';host.append(states);
 for(const [key,label,checked,disabled] of [['unchecked','Unchecked',false,false],['checked','Checked',true,false],['mixed','Mixed',false,false],['disabled','Disabled',true,true]]){
  const row=node('label',null,'P3'),input=node('input');input.type='checkbox';input.id='checkbox-preview-'+key;input.checked=checked;input.disabled=disabled;input.indeterminate=key==='mixed';row.append(input,node('span',label));states.append(row);
 }
 const hint=node('p','Use Tab and Space to try focus and selection.','P1');host.append(hint);
 function usage(title,items){const details=node('details');details.className='input-control-usage';details.append(node('summary',title,'P3'));for(const [label,url,where] of items){const row=node('p',null,'P1'),link=node('a',label);link.href=url;row.append(link,document.createTextNode(' — '+where));details.append(row);}host.append(details);}
 usage('Where checkboxes are used',[['Admin','/status.html','Automations and lead filters'],['Outbound','/outbound.html','Contact selection and settings']]);
 host.append(node('h3','Scrollbars','H3'));
 editor('scrollbar',scrollbar,[['width','Width X/Y',{min:2,max:20}],['length','Thumb length %',{min:25,max:100}],['autoHide','Auto hide',[['true','On'],['false','Off']]],['hideAfter','Idle delay ms',{min:200,max:3000}],['radius','Corners',{min:0,max:16}],['thumbColor','Thumb color',{type:'color'}],['thumbOpacity','Thumb opacity',{max:100}],['trackColor','Track color',{type:'color'}],['trackOpacity','Track opacity',{max:100}]]);
 const scroll=node('div');scroll.id='scrollbar-preview';scroll.dataset.mayaScrollbar='visible';scroll.dataset.mayaPanel='inner';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Scrollbar preview');
 const wide=node('div');wide.className='scrollbar-preview-content';
 for(let i=0;i<8;i++)wide.append(node('p','Scroll preview · '+(i+1)+' · Use the wheel, keyboard or scrollbar.','P1'));
 scroll.append(wide);host.append(scroll,node('p','Text fields and content regions share these settings. Hidden navigation tracks stay hidden.','P1'));
 usage('Where scrollbars are used',[['Admin','/status.html','Messages and automation text'],['Brief','/backend.html','Client details and fabric results'],['Operation Room','/operations.html','Settings, Logic, pipeline log and fabric results'],['Outbound','/outbound.html','Notes and contact tables'],['App','/','Notes, fabrics and favorites'],['Aesthetic Control','#input-controls-preview','Editors and this preview']]);
 render();return {settings:()=>({checkbox:{...checkbox},scrollbar:{...scrollbar}})};
}
