import {fields} from './surface-editors.js';
import {addRestore} from './restore-controls.js';
import {Pill} from '/aesthetics/ui/components/components.js';
import {setupWorkspacePreviews} from './workspace-previews.js';
export function setupPresentation({buttons,preview,colors,design,controlSizes}){
 const shared=window.MayaPresentationControls;
 const statusStyles=Object.fromEntries(shared.statuses.map(({key})=>[key,{...shared.defaults.statusStyles[key],...design.statusStyles?.[key]}]));
 const sectionSpacing={...shared.defaults.sectionSpacing,...design.sectionSpacing};
 const layoutSpacing={...shared.defaults.layoutSpacing,...design.layoutSpacing};
 const semanticStyles={nonFabric:{...shared.defaults.semanticStyles.nonFabric,...design.semanticStyles?.nonFabric}};
 const settings=()=>({statusStyles,sectionSpacing,layoutSpacing,semanticStyles});
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
  const locations=document.createElement('details');locations.className='status-usage';const usageSummary=document.createElement('summary');usageSummary.dataset.mayaType='P3';usageSummary.textContent=usage.length?'Where used':'Not currently used';locations.append(usageSummary);
  for(const [page,href,text] of usage){const row=document.createElement('div'),link=document.createElement('a');row.dataset.mayaType=link.dataset.mayaType='P3';link.href=href;link.textContent=page;row.append(link,document.createTextNode(' · '+text));locations.append(row);}
  controls.append(locations);
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
  ['Feature requests','','Latest request']
 ];
 for(const [name,before,text] of sections){
  const heading=document.createElement('h3');heading.dataset.mayaType=heading.dataset.previewCategory='H3';heading.dataset.previewHeading='';heading.textContent=name;if(before)heading.dataset.spacing=before;
  const content=document.createElement('div');content.dataset.headingGap='';content.className='spacing-preview-content';content.dataset.mayaType=content.dataset.previewCategory='P1';content.textContent=text;sample.append(heading,content);
 }
 spacing.append(sample);
 const layout=document.createElement('section');layout.className='layout-spacing-controls';
 const layoutRow=document.createElement('div');layoutRow.className='surface-edit-row';
 const layoutTitle=document.createElement('h3');layoutTitle.dataset.mayaType=layoutTitle.dataset.previewCategory='H3';layoutTitle.textContent='Fields and drawer spacing';layoutRow.append(layoutTitle);layout.append(layoutRow);preview.append(layout);
 editor(layoutRow,'field and drawer spacing',layoutSpacing,[['labelGap','Label → field',{min:0,max:64}],['fieldGap','Between fields',{min:0,max:64}],['drawerDockInset','Voice dock → bottom',{min:0,max:32}]]);
 const layoutHelp=document.createElement('p');layoutHelp.dataset.mayaType=layoutHelp.dataset.previewCategory='P1';layoutHelp.textContent='Label → field is the space from Trigger to its selected value. Between fields separates Trigger, wait and earliest-time groups. A smaller dock inset moves Hey Maya closer to the bottom.';layout.append(layoutHelp);
 const spacingExample=document.createElement('div');spacingExample.className='workspace-timing-preview';spacingExample.dataset.mayaFieldStack='';
 for(const [labelText,value] of [['Trigger','No reply after first text'],['Earliest draft time','09:00']]){const label=document.createElement('label');label.dataset.mayaType='P3';label.dataset.mayaFieldRow='';label.textContent=labelText;const field=document.createElement('input');field.dataset.mayaType='P1';field.dataset.mayaControl='field';field.value=value;field.readOnly=true;label.append(field);spacingExample.append(label);}
 const dockExample=document.createElement('div');dockExample.className='workspace-dock-preview';dockExample.append(Pill({label:'Hey Maya'}));layout.append(spacingExample,dockExample);
 const semantic=document.createElement('section');semantic.className='semantic-style-controls';
 const semanticRow=document.createElement('div');semanticRow.className='surface-edit-row';
 const semanticTitle=document.createElement('h3');semanticTitle.dataset.mayaType=semanticTitle.dataset.previewCategory='H3';semanticTitle.textContent='Non-fabric pieces';semanticRow.append(semanticTitle);semantic.append(semanticRow);preview.append(semantic);
 const semanticEdit=editor(semanticRow,'non-fabric pieces',semanticStyles.nonFabric,[['color','Text color',{type:'color'}],['opacity','Color strength',{min:0,max:100}]]);
 const shoe=Pill({label:'Black leather boots',onClick:event=>{event.stopPropagation();semanticEdit.open=true;semanticEdit.querySelector('input').focus();}});shoe.dataset.mayaSemantic='non-fabric';semantic.append(shoe);
 const semanticHelp=document.createElement('p');semanticHelp.dataset.mayaType=semanticHelp.dataset.previewCategory='P1';semanticHelp.textContent='Shoes in the Brief garment list and Operation Room are marked in pale yellow. Their text size, font and pill material still use the shared controls.';semantic.append(semanticHelp);
 setupWorkspacePreviews({parent:preview,render});
 render();return {settings,render};
}
