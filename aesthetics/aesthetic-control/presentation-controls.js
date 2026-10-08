import {fields} from './surface-editors.js';
import {addRestore} from './restore-controls.js';
import {Pill} from '/aesthetics/ui/components/components.js';
export function setupPresentation({buttons,preview,colors,design,controlSizes}){
 const shared=window.MayaPresentationControls;
 const statusStyles=Object.fromEntries(shared.statuses.map(({key})=>[key,{...shared.defaults.statusStyles[key],...design.statusStyles?.[key]}]));
 const sectionSpacing={...shared.defaults.sectionSpacing,...design.sectionSpacing};
 const settings=()=>({statusStyles,sectionSpacing});
 const render=()=>shared.apply({...design,...controlSizes,...settings()});
 function editor(parent,label,value,spec){
  const edit=document.createElement('details');edit.className='type-editor';
  const summary=document.createElement('summary');summary.dataset.mayaType='P3';summary.textContent='Edit';summary.setAttribute('aria-label','Edit '+label);
  const grid=document.createElement('div');grid.className='type-editor-fields';edit.append(summary,grid);parent.append(edit);
  fields(grid,value,spec,render);
  addRestore(edit,{label,read:()=>value,write:saved=>{Object.assign(value,saved);for(const input of grid.querySelectorAll('[data-field]'))input.value=value[input.dataset.field];render();}});
  return edit;
 }
 for(const status of shared.statuses){
  const {key,label,meaning,usage}=status,wrap=document.createElement('div');wrap.className='status-style-preview';colors.append(wrap);
  const controls=document.createElement('div');controls.className='status-style-controls';wrap.append(controls);
  const edit=editor(controls,label,statusStyles[key],[['color','Color',{type:'color'}],['opacity','Color strength',{min:0,max:100}],['weight','Weight',[200,250,300,350,400,450,500].map(n=>[String(n),String(n)])]]);
  const pill=Pill({label,onClick:event=>{event.stopPropagation();edit.open=true;edit.querySelector('input')?.focus();}});pill.classList.add('status-pill');pill.dataset.status=key;controls.prepend(pill);
  const description=document.createElement('p');description.className='status-meaning';description.dataset.mayaType='P1';description.textContent=meaning;wrap.append(description);
  const locations=document.createElement('div');locations.className='status-usage';
  for(const [page,href,text] of usage){const row=document.createElement('div'),link=document.createElement('a');row.dataset.mayaType=link.dataset.mayaType='P3';link.href=href;link.textContent=page;row.append(link,document.createTextNode(' · '+text));locations.append(row);}
  wrap.append(locations);
 }
 const spacing=document.createElement('section');spacing.className='spacing-controls';
 const row=document.createElement('div');row.className='surface-edit-row';
 const title=document.createElement('h3');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Section spacing';row.append(title);spacing.append(row);preview.append(spacing);
 editor(row,'section spacing',sectionSpacing,[['submissions','Mana Siyo → Submissions',{min:0,max:160}],['leads','Before Leads',{min:0,max:160}],['ads','Before Ad campaigns',{min:0,max:160}],['insights','Before Insights',{min:0,max:160}],['headingGap','All headings → content',{min:0,max:160}]]);
 const help=document.createElement('p');help.className='spacing-usage';help.dataset.mayaType='P1';help.append('Vertical space between each Admin section heading and its first visible content, including empty states. Separate from panel padding. ');
 const link=document.createElement('a');link.dataset.mayaType='P1';link.href='/status.html';link.textContent='Used across Admin';help.append(link);spacing.append(help);
 const sample=document.createElement('div');sample.className='spacing-preview';sample.dataset.mayaPanel='inner';
 const brand=document.createElement('span');brand.dataset.mayaType=brand.dataset.previewCategory='P3';brand.textContent='Mana Siyo';sample.append(brand);
 const sections=[
  ['Submissions','submissions','Latest submission'],['Users and traffic','','Users · 12'],['Leads','leads','Full name · Angela | Status · Not contacted'],
  ['Ad campaigns','ads','D / W / M · Campaign preview'],['Insights','insights','Lead and campaign totals'],['Recent changes','','Latest change'],
  ['Feature requests','','Latest request'],['MAYA Prompting Engine','','Reviewed prompt fields'],['Architecture','','Local and online services']
 ];
 for(const [name,before,text] of sections){
  const heading=document.createElement('h3');heading.dataset.mayaType=heading.dataset.previewCategory='H3';heading.dataset.previewHeading='';heading.textContent=name;if(before)heading.dataset.spacing=before;
  const content=document.createElement('div');content.dataset.headingGap='';content.className='spacing-preview-content';content.dataset.mayaType=content.dataset.previewCategory='P1';content.textContent=text;sample.append(heading,content);
 }
 spacing.append(sample);render();return {settings,render};
}
