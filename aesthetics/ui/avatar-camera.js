// Explicit, project-bound camera session. Nothing is uploaded until Use photo.
(() => {
  const dialog=document.getElementById('avatar-camera'),video=document.getElementById('avatar-camera-video'),preview=document.getElementById('avatar-camera-preview'),status=document.getElementById('avatar-camera-status');
  const capture=document.getElementById('avatar-camera-capture'),retake=document.getElementById('avatar-camera-retake'),use=document.getElementById('avatar-camera-use'),cancel=document.getElementById('avatar-camera-cancel');
  let stream=null,photo=null,photoUrl=null,serial=0,context=null,summary=null,version=0;
  const current=seq=>seq===serial&&dialog.open&&_opStillValid(context)&&lastSummary===summary&&_facePhotoVersion===version&&!document.hidden;
  function stop(){if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}video.srcObject=null;}
  function forget(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;photo=null;preview.removeAttribute('src');}
  function close(){serial++;stop();forget();context=null;summary=null;if(dialog.open)dialog.close();}
  async function start(){
    const seq=++serial;stop();forget();video.hidden=true;preview.hidden=true;capture.hidden=false;capture.disabled=true;retake.hidden=true;use.hidden=true;status.textContent='Allow camera access to take a photo.';
    if(!navigator.mediaDevices?.getUserMedia){status.textContent='Camera is unavailable here. Use Replace to upload a photo.';return;}
    try{const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});if(!current(seq)){acquired.getTracks().forEach(track=>track.stop());return;}stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();if(!current(seq)){stop();return;}status.textContent='Position your face, then take a photo.';capture.disabled=false;}
    catch(error){if(current(seq)){stop();status.textContent=error?.name==='NotAllowedError'?'Camera access was denied. Allow it in your browser settings or use Replace.':'Camera could not start. Check your camera or use Replace.';}}
  }
  function open(){close();context=_opContext();summary=lastSummary;version=_facePhotoVersion;dialog.showModal();start();}
  capture.addEventListener('click',()=>{
    const seq=serial;if(!current(seq)||!video.videoWidth||!video.videoHeight){status.textContent='Camera is not ready yet. Try again.';return;}
    capture.disabled=true;const canvas=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));const ctx=canvas.getContext('2d');if(!ctx){capture.disabled=false;status.textContent='Could not take a photo. Try again.';return;}ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{if(!current(seq))return;if(!blob){capture.disabled=false;status.textContent='Could not take a photo. Try again.';return;}photo=blob;photoUrl=URL.createObjectURL(blob);preview.src=photoUrl;video.hidden=true;preview.hidden=false;stop();capture.hidden=true;retake.hidden=false;use.hidden=false;status.textContent='Use this photo or take another.';},'image/jpeg',0.88);
  });
  retake.addEventListener('click',()=>{if(current(serial))start();else close();});
  use.addEventListener('click',()=>{if(!photo||!current(serial)){close();return;}const selected=photo,selectedContext=context;close();onFacePhotoSelected({target:{files:[selected],value:''}},selectedContext);});
  cancel.addEventListener('click',close);dialog.addEventListener('close',()=>{if(!dialog.open){serial++;stop();forget();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});addEventListener('pagehide',close);
  function renew(){if(!context)return;const now=_opContext();if(context.epoch!==now.epoch||context.uid!==now.uid||(context.project&&context.project!==now.project)){close();return;}context.auth=now.auth;}
  window.MayaAvatarCamera={open,close,renew};
})();
