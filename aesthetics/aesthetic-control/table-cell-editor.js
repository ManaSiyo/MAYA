import {fields,typeFields,backgrounds} from './surface-editors.js';
// Preview cells are presentation templates, never editable client records.
export function setupTableCellEditor({guide,controls,settings,render}){
 const table=guide.querySelector('table'),baseline=structuredClone(settings),bar=document.createElement('div');bar.id='cell-format-toolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Selected cell formatting');
 const heading=document.createElement('div');heading.className='cell-selection-heading';const title=document.createElement('span');title.id='cell-selection';title.setAttribute('role','status');
 const restore=document.createElement('button');restore.type='button';restore.className='restore-editor';restore.textContent='↻';restore.setAttribute('aria-label','Restore saved selected cells');restore.title='Restore saved selected cells';heading.append(title,restore);
 const form=document.createElement('div');form.className='cell-format-fields';form.tabIndex=0;form.setAttribute('role','group');form.setAttribute('aria-label','Cell format options');bar.append(heading,form);guide.before(bar);
 let selected,kind='corner',key,values={};
 const material=[['background','Background',backgrounds],['opacity','Opacity',{max:100}]];
 const bodyStyle=cell=>({...settings.columns[['name','stage','note'].indexOf(cell.dataset.col)],background:settings.background,opacity:settings.fill,...settings.cells?.[cell.dataset.col+'-'+cell.parentElement.sectionRowIndex]});
 function select(cell){
  selected=cell;key=cell.dataset.col+'-'+cell.parentElement.sectionRowIndex;
  kind=cell.tagName==='TH'?(cell.dataset.col==='name'?'corner':'header'):(cell.dataset.col==='name'?'column':'cell');
  values=kind==='header'||kind==='corner'?{...settings.header}:kind==='column'?{...settings.columns[0],...settings.firstColumn}:bodyStyle(cell);
  title.textContent=kind==='corner'?'Top row + first column':kind==='header'?'Top row':kind==='column'?'First column':'Cell '+['A','B','C'][cell.cellIndex]+(cell.parentElement.sectionRowIndex+2);
  for(const e of table.querySelectorAll('td,th')){const on=kind==='corner'?e.tagName==='TH'||e.dataset.col==='name':kind==='header'?e.tagName==='TH':kind==='column'?e.tagName==='TD'&&e.dataset.col==='name':e===cell;e.classList.toggle('cell-selected',on);e.setAttribute('aria-selected',String(on));}
  for(const input of form.querySelectorAll('[data-field]'))input.value=values[input.dataset.field];
 }
 function change(){
  if(kind==='header'||kind==='corner')Object.assign(settings.header,values);
  if(kind==='column'||kind==='corner'){for(const key of ['font','case','size','weight','color','align','vertical'])settings.columns[0][key]=values[key];Object.assign(settings.firstColumn,{background:values.background,opacity:values.opacity});}
  if(kind==='cell'){settings.cells||={};settings.cells[key]={...values};}
  render();
 }
 // fields owns the stable object; selection updates its keys rather than replacing it.
 const stable={...settings.header};fields(form,stable,[...typeFields,...material],()=>{values={...stable};change();});
 const sync=cell=>{select(cell);Object.assign(stable,values);};
 for(const cell of table.querySelectorAll('td,th')){cell.tabIndex=0;cell.setAttribute('aria-label','Format '+cell.textContent.trim());cell.addEventListener('click',e=>{e.preventDefault();sync(cell);});cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sync(cell);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const rows=[...table.rows],r=rows.indexOf(cell.parentElement),c=cell.cellIndex;const next=rows[r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)]?.cells[c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)];if(next){sync(next);next.focus();}}});}
 restore.onclick=()=>{if(kind==='header'||kind==='corner')settings.header=structuredClone(baseline.header);if(kind==='column'||kind==='corner'){settings.columns[0]=structuredClone(baseline.columns[0]);settings.firstColumn=structuredClone(baseline.firstColumn);}if(kind==='cell'){if(baseline.cells?.[key])settings.cells[key]=structuredClone(baseline.cells[key]);else delete settings.cells?.[key];}render();sync(selected);};
 document.addEventListener('maya-gallery-saved',()=>{for(const key of Object.keys(baseline))delete baseline[key];Object.assign(baseline,structuredClone(settings));});
 sync(table.querySelector('th'));return {refresh:()=>sync(selected)};
}
