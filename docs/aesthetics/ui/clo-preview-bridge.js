/* CLO photographs expand in the parent viewport without sharing feature state. */
(function(){
 'use strict';
 const scope=value=>JSON.stringify([value?.account,value?.submissionId,value?.local,value?.revision,value?.garmentId||'']);
 const photo=value=>{try{if(typeof value!=='string'||value.length>4096)return '';const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&host.includes('.')&&!/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/.test(host)?u.href:'';}catch{return '';}};
 window.MayaCloPreviewBridge={create({frame,getContext,viewer=window.MayaImageViewer,eventTarget=window,origin=location.origin}){
  let active=null,destroyed=false;
  const context=()=>{try{return getContext();}catch{return null;}};
  function close(){const previous=active;active=null;previous?.dialog?.close();previous?.source.remove();}
  function update(){if(active&&scope(context())!==active.scope)close();}
  function receive(event){
   if(destroyed||event.origin!==origin||event.source!==frame.contentWindow)return;
   const data=event.data;if(!data||!['ops-clo-inspect','ops-clo-inspect-close'].includes(data.maya))return;
   if(data.maya==='ops-clo-inspect-close'){if(active?.id===data.inspectionId&&active.scope===scope(data))close();return;}
   const current=context(),src=photo(data.src);
   if(!current?.account||!current?.submissionId||scope(data)!==scope(current)||!src||typeof data.inspectionId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(data.inspectionId))return;
   close();
   const source=document.createElement('img');source.hidden=true;source.src=src;source.referrerPolicy='no-referrer';source.alt=typeof data.alt==='string'?data.alt.slice(0,300):'CLO asset';document.body.append(source);
   const record={id:data.inspectionId,scope:scope(current),source,dialog:null};active=record;
   try{record.dialog=viewer?.open(source,{onClose:()=>{source.remove();if(active===record)active=null;}});if(!record.dialog)close();}catch{close();}
  }
  eventTarget.addEventListener('message',receive);frame.addEventListener('load',close);
  return {update,close,destroy(){if(destroyed)return;destroyed=true;close();eventTarget.removeEventListener('message',receive);frame.removeEventListener('load',close);}};
 }};
})();
