// Same-origin Admin workspace; no credentials are copied into frame messages.
const link=document.querySelector('.design-quicklink');
if(link){
 const dialog=document.createElement('dialog');dialog.id='admin-design';dialog.setAttribute('aria-label','Aesthetic Control');
 const frame=document.createElement('iframe');frame.title='MAYA Aesthetic Control';dialog.append(frame);document.body.append(dialog);
 link.addEventListener('click',event=>{event.preventDefault();if(!frame.getAttribute('src'))frame.src=link.href;if(!dialog.open)dialog.showModal();});
 dialog.addEventListener('close',()=>link.focus());
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='maya-design-close')dialog.close();});
}
