import {IconButton} from '/aesthetics/ui/components/components.js';
export const formatIcons={Alignment:'M4 5h16M7 10h10M4 15h16M7 20h10','Text color':'M7 16l5-12 5 12M9 12h6M4 21h16',Background:'M4 11l8-8 8 8-8 8zM6 2l11 11M20 17v4'};
export function formatIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',formatIcons[name]);svg.append(path);return svg;}
export function formatTools(form,read){
 const change=(key,value)=>{const input=form.querySelector('[data-field="'+key+'"]');if(!input)return;input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};
 const tools=document.createElement('div');tools.className='format-tools';let previousWeight=400;
 const bold=IconButton({label:'Bold',icon:'B',onClick:()=>{const t=read();if(t.weight<500)previousWeight=t.weight;change('weight',t.weight===500?previousWeight:500);}});
 const italic=IconButton({label:'Italic',icon:'I',onClick:()=>change('style',read().style==='italic'?'normal':'italic')});italic.style.fontStyle='italic';tools.append(bold,italic);form.prepend(tools);
 bold.style.setProperty('font-weight','500','important');
 for(const [key,name] of [['align','Alignment'],['color','Text color'],['background','Background']]){const label=form.querySelector('[data-field="'+key+'"]')?.closest('label');if(label){const mark=formatIcon(name);mark.classList.add('format-mark');label.prepend(mark);}}
 const sync=()=>{bold.setAttribute('aria-pressed',String(read().weight===500));italic.setAttribute('aria-pressed',String(read().style==='italic'));};form.addEventListener('input',sync);new MutationObserver(sync).observe(form,{attributes:true,subtree:true,attributeFilter:['data-selected']});sync();
 const size=form.querySelector('[data-field="size"]');if(size){const wrap=document.createElement('div');wrap.className='size-controls';size.before(wrap);const adjust=delta=>change('size',Math.max(Number(size.min),Math.min(Number(size.max),Number(size.value)+delta*Number(size.step||1))));wrap.append(IconButton({label:'Decrease font size',icon:'−',onClick:()=>adjust(-1)}),size,IconButton({label:'Increase font size',icon:'+',onClick:()=>adjust(1)}));}
 return sync;
}
