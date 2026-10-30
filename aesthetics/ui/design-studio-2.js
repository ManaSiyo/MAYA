'use strict';
(() => {
 const form=document.getElementById('studio-form'),select=document.getElementById('studio-experience'),feedback=document.getElementById('studio-feedback');
 document.querySelectorAll('.studio-choose').forEach(button=>button.setAttribute('aria-pressed','false'));
 document.querySelectorAll('.studio-choose').forEach(button=>button.addEventListener('click',()=>{select.value=button.dataset.tier;document.querySelectorAll('.studio-choose').forEach(peer=>peer.setAttribute('aria-pressed',String(peer===button)));document.getElementById('consultation').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});select.focus({preventScroll:true});}));
 select.addEventListener('change',()=>document.querySelectorAll('.studio-choose').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tier===select.value))));
 form.addEventListener('submit',event=>{event.preventDefault();feedback.textContent='This is a design preview. Your information was not sent or saved.';});
 document.querySelectorAll('.studio-page img').forEach(img=>img.addEventListener('error',()=>{if(img.closest('.studio-hero-image,.studio-tier-image'))img.hidden=true;}));
})();
