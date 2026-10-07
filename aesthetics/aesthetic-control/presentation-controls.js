import {fields} from './surface-editors.js';
import {addRestore} from './restore-controls.js';
import {Pill} from '/aesthetics/ui/components/components.js';
export function setupPresentation({buttons,preview,colors,design,controlSizes}){
 const statusStyles=structuredClone(design.statusStyles),sectionSpacing={...design.sectionSpacing};
 const settings=()=>({statusStyles,sectionSpacing});
 const render=()=>window.MayaTypographyControls.previewPresentation({...design,...controlSizes,...settings()});
 function editor(parent,label,value,spec){
  const edit=document.createElement('details');edit.className='type-editor';
  const summary=document.createElement('summary');summary.textContent=label;
  const grid=document.createElement('div');grid.className='type-editor-fields';edit.append(summary,grid);parent.append(edit);
  fields(grid,value,spec,render);
  addRestore(edit,{label,read:()=>value,write:saved=>{Object.assign(value,saved);for(const input of grid.querySelectorAll('[data-field]'))input.value=value[input.dataset.field];render();}});
  return edit;
 }
 for(const [key,label] of [['new','Not contacted'],['contacted','Contacted'],['in_progress','In progress'],['booked','Booked'],['completed','Completed'],['canceled','Cancelled']]){
  const wrap=document.createElement('div');wrap.className='status-style-preview';colors.append(wrap);
  const edit=editor(wrap,label,statusStyles[key],[['color','Color',{type:'color'}],['opacity','Color strength',{min:0,max:100}],['weight','Weight',[200,250,300,350,400,450,500].map(n=>[String(n),String(n)])]]);
  edit.querySelector('summary').textContent='Edit';edit.querySelector('summary').setAttribute('aria-label','Edit '+label);
  const pill=Pill({label,onClick:()=>{edit.open=true;edit.querySelector('input')?.focus();}});pill.classList.add('status-pill');pill.dataset.status=key;wrap.prepend(pill);
 }
 const spacing=document.createElement('section');spacing.className='spacing-controls';
 const title=document.createElement('h3');title.dataset.previewCategory='H3';title.textContent='Section spacing';spacing.append(title);preview.append(spacing);
 editor(spacing,'Edit spacing',sectionSpacing,[['submissions','Mana Siyo → Submissions',{min:0,max:160}],['leads','Before Leads',{min:0,max:160}],['ads','Before Ad campaigns',{min:0,max:160}],['insights','Before Insights',{min:0,max:160}],['headingGap','Heading → content',{min:0,max:160}]]);
 const sample=document.createElement('div');sample.className='spacing-preview';sample.dataset.mayaPanel='inner';
 sample.innerHTML='<span data-preview-category="P3">Mana Siyo</span><h3 data-spacing="submissions" data-preview-category="H3">Submissions</h3><h3 data-spacing="leads" data-preview-category="H3">Leads</h3><div data-heading-gap><table><thead><tr><th>Full name</th><th>Status</th></tr></thead><tbody><tr><td>Angela</td><td>Not contacted</td></tr></tbody></table></div><h3 data-spacing="ads" data-preview-category="H3">Ad campaigns</h3><h3 data-spacing="insights" data-preview-category="H3">Insights</h3>';
 spacing.append(sample);render();return {settings,render};
}
