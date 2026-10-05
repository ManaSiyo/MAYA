// Native select remains the status source and retains its existing authenticated
// save handler. Its visible picker uses the shared editable dropdown material.
const menu=document.createElement('div');menu.id='lead-stage-options';menu.className='lead-stage-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-label','Lead status choices');menu.setAttribute('popover','manual');document.body.append(menu);
let active;
function close(focus=false){const previous=active;active=null;if(menu.hidePopover&&menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;previous?.setAttribute('aria-expanded','false');if(focus&&previous?.isConnected)previous.focus({preventScroll:true});}
function position(){
 if(!active?.isConnected||active.disabled)return close();
 const r=active.getBoundingClientRect(),panel=active.closest('.panel')?.getBoundingClientRect();
 if(r.bottom<0||r.top>innerHeight||panel&&(r.right<panel.left||r.left>panel.right))return close();
 menu.style.maxHeight=(innerHeight-16)+'px';const box=menu.getBoundingClientRect(),below=innerHeight-r.bottom-16,above=r.top-16,up=below<box.height&&above>below;
 menu.style.maxHeight=Math.max(40,up?above:below)+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-box.width-8))+'px';menu.style.top=Math.max(8,up?r.top-menu.getBoundingClientRect().height-8:r.bottom+8)+'px';
}
function open(select){
 close();active=select;const style=getComputedStyle(select);menu.style.fontFamily=style.fontFamily;menu.style.fontSize=style.fontSize;select.setAttribute('aria-controls',menu.id);select.setAttribute('aria-expanded','true');menu.replaceChildren();
 for(const option of select.options){const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));button.textContent=option.textContent;button.disabled=option.disabled;button.onclick=()=>{select.value=option.value;close(true);select.dispatchEvent(new Event('change',{bubbles:true}));};menu.append(button);}
 menu.hidden=false;if(menu.showPopover)menu.showPopover();else menu.removeAttribute('popover');position();(menu.querySelector('[aria-selected=true]:not(:disabled)')||menu.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
}
document.addEventListener('mousedown',e=>{if(e.button!==0)return;const select=e.target.closest('select.lead-stage');if(select&&!select.disabled){e.preventDefault();open(select);}});
document.addEventListener('keydown',e=>{
 const select=e.target.closest('select.lead-stage');if(select&&['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(select);return;}
 if(!active)return;if(e.key==='Escape'){e.preventDefault();close(true);return;}
 if(menu.contains(e.target)&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const choices=[...menu.querySelectorAll('button:not(:disabled)')],i=choices.indexOf(document.activeElement);choices[e.key==='Home'?0:e.key==='End'?choices.length-1:(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length]?.focus();}
});
document.addEventListener('pointerdown',e=>{if(active&&!menu.contains(e.target)&&e.target!==active)close();});
document.addEventListener('focusin',e=>{if(active&&e.target!==active&&!menu.contains(e.target))close();});
window.addEventListener('resize',position);document.addEventListener('scroll',e=>{if(!menu.contains(e.target))position();},true);document.addEventListener('maya-design-applied',position);
