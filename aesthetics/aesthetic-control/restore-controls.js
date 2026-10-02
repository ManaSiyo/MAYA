// Restore only this editor to its last saved presentation values.
export function addRestore(edit,{label,read,write}){
 let baseline=structuredClone(read());
 const button=document.createElement('button');button.type='button';button.className='restore-editor';button.textContent='↻';button.setAttribute('aria-label','Restore saved '+label);button.title='Restore saved '+label;
 button.addEventListener('click',()=>{write(structuredClone(baseline));edit.dispatchEvent(new Event('input',{bubbles:true}));});edit.after(button);
 document.addEventListener('maya-gallery-saved',()=>{baseline=structuredClone(read());});return button;
}
export function highlightPadding(edit,targets,dimensions){
 const update=()=>{for(const el of targets()){const {x,y}=dimensions();el.style.setProperty('--padding-debug-x',x+'px');el.style.setProperty('--padding-debug-y',y+'px');el.classList.toggle('show-padding',edit.open);}};
 new MutationObserver(update).observe(edit,{attributes:true,attributeFilter:['open']});edit.addEventListener('input',update);document.addEventListener('maya-gallery-saved',update);return update;
}
