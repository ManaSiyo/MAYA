import {IconButton} from '/aesthetics/ui/components/components.js';
import {highlightPadding,addRestore} from './restore-controls.js';
import {formatTools} from './format-tools.js';
import {fields,typeFields,backgrounds,tableBorders} from './surface-editors.js';
// Preview cells are presentation templates, never editable client records.
export function setupTableCellEditor({guide,settings,render}){
 const table=guide.querySelector('table'),baseline=structuredClone(settings),bar=document.createElement('div');bar.id='cell-format-toolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Selected cell formatting');
 const heading=document.createElement('div');heading.className='cell-selection-heading';const title=document.createElement('span');title.id='cell-selection';title.setAttribute('role','status');
 const restore=IconButton({label:'Restore saved selected cells',icon:'↻'});restore.classList.add('restore-editor');heading.append(title,restore);
 const form=document.createElement('div');form.className='cell-format-fields';form.tabIndex=0;form.setAttribute('role','group');form.setAttribute('aria-label','Cell format options');const geometry=document.createElement('div');geometry.className='table-material-fields';geometry.dataset.editor='table';
 const outerSpecs=[['outerWidth','Outer border px',{max:8}],['borderColor','Outer border color',tableBorders],['rim','Outer border opacity',{max:100}],['radius','Corners',{max:24}],['paddingX','Padding X',{max:40}],['paddingY','Padding Y',{max:40}]];
 const innerSpecs=[['innerWidth','Inner border px',{max:8}],['innerBorderColor','Inner border color',tableBorders],['innerRim','Inner border opacity',{max:100}]];
 const specs=[...outerSpecs,...innerSpecs];
 for(const [label,rowSpecs] of [['Outer border settings',outerSpecs],['Inner border settings',innerSpecs]]){const row=document.createElement('div');row.className='cell-format-fields table-border-row';row.setAttribute('role','group');row.setAttribute('aria-label',label);fields(row,settings,rowSpecs,render);geometry.append(row);}
 const materialRestore=document.createElement('details');materialRestore.hidden=true;geometry.append(materialRestore);addRestore(materialRestore,{label:'table border and padding',read:()=>Object.fromEntries(specs.map(([key])=>[key,settings[key]])),write:v=>{Object.assign(settings,v);for(const input of geometry.querySelectorAll('[data-field]'))input.value=settings[input.dataset.field];render();}});materialRestore.remove();
 highlightPadding(geometry,()=>[...table.querySelectorAll('td,th')],()=>({x:settings.paddingX,y:settings.paddingY}));
 bar.append(geometry,heading,form);guide.before(bar);
 let selected,kind='corner',column=0,values={};
 const material=[['background','Background',backgrounds],['opacity','Opacity',{max:100}]];
 const columnStyle=()=>({background:settings.background,opacity:settings.fill,...settings.columns[column],...(column===0?settings.firstColumn:{})});
 function select(cell){
  selected=cell;column=cell.cellIndex;
  kind=cell.tagName==='TH'?(cell.dataset.col==='name'?'corner':'header'):'column';
  values=kind==='header'||kind==='corner'?{...settings.header}:columnStyle();
  form.querySelector('[data-field="color"]')?.setAttribute('title',kind==='column'&&column===1?'Status pills retain their status colors.':'Selected text color');
  title.textContent=kind==='corner'?'Top row + first column':kind==='header'?'Top row':['First column','Second column','Third column'][column];
  for(const e of table.querySelectorAll('td,th')){const on=kind==='corner'?e.tagName==='TH'||e.dataset.col==='name':kind==='header'?e.tagName==='TH':e.tagName==='TD'&&e.cellIndex===column;e.classList.toggle('cell-selected',on);e.setAttribute('aria-selected',String(on));}
  for(const input of form.querySelectorAll('[data-field]'))input.value=values[input.dataset.field];
 }
 function change(){
  if(kind==='header'||kind==='corner')Object.assign(settings.header,values);
  if(kind==='column'||kind==='corner'){
   const index=kind==='corner'?0:column;for(const key of ['font','case','size','weight','color','align','vertical','style'])settings.columns[index][key]=values[key];
   if(index===0)Object.assign(settings.firstColumn,{background:values.background,opacity:values.opacity});else Object.assign(settings.columns[index],{background:values.background,opacity:values.opacity});
   // The owner now edits full columns; discard obsolete row-slot overrides there.
   for(const key of Object.keys(settings.cells||{}))if(key.startsWith(['name','stage','note'][index]+'-'))delete settings.cells[key];
  }
  render();
 }
 // fields owns the stable object; selection updates its keys rather than replacing it.
 const stable={...settings.header};fields(form,stable,[...typeFields,...material],()=>{values={...stable};change();});
 let formatSync;const sync=cell=>{select(cell);Object.assign(stable,values);formatSync?.();};
 for(const cell of table.querySelectorAll('td,th')){cell.tabIndex=0;cell.setAttribute('aria-label','Format '+cell.textContent.trim());cell.addEventListener('click',e=>{e.preventDefault();sync(cell);});cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sync(cell);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const rows=[...table.rows],r=rows.indexOf(cell.parentElement),c=cell.cellIndex;const next=rows[r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)]?.cells[c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)];if(next){sync(next);next.focus();}}});}
 restore.onclick=()=>{
  if(kind==='header'||kind==='corner')settings.header=structuredClone(baseline.header);
  if(kind==='column'||kind==='corner'){
   const index=kind==='corner'?0:column;settings.columns[index]=structuredClone(baseline.columns[index]);if(index===0)settings.firstColumn=structuredClone(baseline.firstColumn);
   const prefix=['name','stage','note'][index]+'-';for(const key of Object.keys(settings.cells||{}))if(key.startsWith(prefix))delete settings.cells[key];
   for(const [key,value] of Object.entries(baseline.cells||{}))if(key.startsWith(prefix)){settings.cells||={};settings.cells[key]=structuredClone(value);}
  }
  render();sync(selected);
 };
 document.addEventListener('maya-gallery-saved',()=>{for(const key of Object.keys(baseline))delete baseline[key];Object.assign(baseline,structuredClone(settings));});
 formatSync=formatTools(form,()=>stable);sync(table.querySelector('th'));return {refresh:()=>sync(selected)};
}
