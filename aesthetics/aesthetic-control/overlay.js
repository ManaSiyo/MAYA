// Review containers are a separate material layer from the action pills.
export function setupOverlay(comparison){
 const defaults={fill:18,rim:22,blur:22,saturation:180},values={...defaults};let enabled=true;
 const panel=document.createElement('details');panel.className='overlay-controls';panel.innerHTML='<summary>Panels</summary><p>Section backgrounds.</p><label><input id="overlay-enabled" type="checkbox" checked> Show panel glass</label><div class="finish-sliders"></div>';
 comparison.parentElement.querySelector('.finish-controls').after(panel);
 const fields=[];
 for(const [key,label,max,unit] of [['fill','Panel fill',100,'%'],['rim','Panel rim',100,'%'],['blur','Panel blur',40,'px'],['saturation','Panel saturation',200,'%']]){
  const row=document.createElement('label'),input=document.createElement('input'),output=document.createElement('output');row.append(document.createTextNode(label));input.type='range';input.min=0;input.max=max;input.setAttribute('aria-label',label);input.addEventListener('input',()=>{values[key]=Number(input.value);render();});row.append(input,output);panel.querySelector('.finish-sliders').append(row);fields.push({key,input,output,unit});
 }
 function render(){const root=document.documentElement;for(const [key,value] of Object.entries(values))root.style.setProperty('--review-panel-'+key,key==='blur'?value+'px':key==='saturation'?value+'%':String(enabled?value/100:0));root.style.setProperty('--review-panel-filter',enabled?`blur(${values.blur}px) saturate(${values.saturation}%)`:'none');for(const f of fields){f.input.value=values[f.key];f.output.value=values[f.key]+f.unit;}panel.querySelector('input[type=checkbox]').checked=enabled;}
 panel.querySelector('input[type=checkbox]').addEventListener('change',e=>{enabled=e.target.checked;render();});render();return {settings:()=>({enabled,...values}),set:v=>{for(const key of Object.keys(values))if(Number.isInteger(v?.[key]))values[key]=v[key];enabled=v?.enabled!==false;render();},reset:()=>{Object.assign(values,defaults);enabled=true;render();}};
}
