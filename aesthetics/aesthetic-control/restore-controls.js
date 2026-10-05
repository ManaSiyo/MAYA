import {IconButton} from '/aesthetics/ui/components/components.js';
// Restore only this editor to its last saved presentation values.
export function addRestore(edit,{label,read,write}){
 let baseline=structuredClone(read());
 const button=IconButton({label:'Restore saved '+label,icon:'↻'});button.classList.add('restore-editor');
 button.addEventListener('click',()=>{write(structuredClone(baseline));edit.dispatchEvent(new Event('input',{bubbles:true}));});edit.after(button);
 document.addEventListener('maya-gallery-saved',()=>{baseline=structuredClone(read());});return button;
}
export function highlightPadding(edit,targets,dimensions){
 let active=false;
 const isPadding=el=>el?.matches('[data-field="padding"],[data-field="paddingX"],[data-field="paddingY"],[aria-label="Padding X"],[aria-label="Padding Y"],[name^="--ui-pill-padding-"]');
 const update=()=>{for(const el of targets()){const {x,y}=dimensions();el.style.setProperty('--padding-debug-x',x+'px');el.style.setProperty('--padding-debug-y',y+'px');el.classList.toggle('show-padding',(edit.tagName!=='DETAILS'||edit.open)&&active);}};
 new MutationObserver(()=>{if(edit.tagName==='DETAILS'&&!edit.open)active=false;update();}).observe(edit,{attributes:true,attributeFilter:['open']});
 for(const event of ['focusin','input'])edit.addEventListener(event,e=>{active=isPadding(e.target);update();});
 edit.addEventListener('focusout',()=>{queueMicrotask(()=>{active=isPadding(document.activeElement)&&edit.contains(document.activeElement);update();});});
 document.addEventListener('maya-gallery-saved',()=>{active=false;update();});return update;
}
