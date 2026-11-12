/* Drawer gestures belong to its handle/edge, never to content scrollers. */
(function(){
 'use strict';
 const drawer=document.getElementById('clients-drawer'),handle=document.querySelector('#top-actions .hamburger');
 if(!drawer||!handle)return;
 handle.style.touchAction='pan-y';
 const isOpen=()=>document.body.classList.contains('drawer-open')||document.body.classList.contains('operations-settings-open');
 const interactive='a,button,input,textarea,select,summary,[contenteditable],[role=button],[role=tab],iframe';
 function eligible(target,x){
  if(target?.closest?.('#top-actions .hamburger'))return true;
  if(target?.closest?.(interactive))return false;
  if(isOpen())return !!target?.closest?.('#clients-drawer>.drawer-title,.backend-two-tabs,.drawer-head-title');
  return x>=innerWidth-32&&!target?.closest?.('#clients-drawer,#drawer-settings,#brief-fabrics,.fab-grid,.op-image-col,.op-room-col,#piece-swiper');
 }
 function setOpen(value){if(value!==isOpen())window.toggleWorkspaceDrawer?.(value);}
 let drag=null,suppressClickUntil=0;
 window.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0||!eligible(e.target,e.clientX)){drag=null;return;}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,open:isOpen(),locked:false,target:e.target};
 },{passive:true});
 window.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const x=e.clientX-drag.x,y=e.clientY-drag.y;
  if(!drag.locked){if(Math.abs(y)>10&&Math.abs(y)>=Math.abs(x)){drag=null;return;}if(Math.abs(x)<12||Math.abs(x)<Math.abs(y)*1.5)return;drag.locked=true;}
  if(e.cancelable)e.preventDefault();
 },{passive:false});
 window.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;const current=drag;drag=null;
  const x=e.clientX-current.x,y=e.clientY-current.y;
  if(!current.locked||Math.abs(x)<40||Math.abs(x)<Math.abs(y)*1.5)return;
  suppressClickUntil=Date.now()+500;
  if(current.open&&x>0)setOpen(false);else if(!current.open&&x<0)setOpen(true);
 },{passive:true});
 window.addEventListener('pointercancel',()=>{drag=null;},{passive:true});
 window.addEventListener('blur',()=>{drag=null;});
 document.addEventListener('click',e=>{
  if(Date.now()<suppressClickUntil&&e.target?.closest?.('#top-actions .hamburger')){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 let wheelX=0,wheelTimer=null,wheelLatched=false;
 window.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey||!eligible(e.target,e.clientX)||Math.abs(e.deltaX)<=Math.abs(e.deltaY)*1.5)return;
  if(e.cancelable)e.preventDefault();clearTimeout(wheelTimer);
  wheelTimer=setTimeout(()=>{wheelX=0;wheelLatched=false;},240);
  if(wheelLatched)return;const delta=e.deltaX*(e.deltaMode===1?16:e.deltaMode===2?innerWidth:1);
  if(wheelX&&Math.sign(wheelX)!==Math.sign(delta))wheelX=0;
  wheelX+=delta;if(Math.abs(wheelX)<70)return;wheelLatched=true;setOpen(wheelX>0);
 },{passive:false});
})();
