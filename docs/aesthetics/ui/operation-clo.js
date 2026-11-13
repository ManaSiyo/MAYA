/* Optional CLO panel. No pattern, fabric or submission writes occur on mount. */
(function(){
 'use strict';
 const panels=window.MayaOperationPanels,assets=window.MayaCloAssets;
 if(!panels||!assets)return;
 panels.register({id:'clo',label:'CLO 3D',create({host,getContext}){
  host.classList.add('original-operation-clo');
  let inspection=0;
  return assets.create({host,getToken:()=>getKey(),getContext,
   openPreview(image){
    const context=getContext();if(!context)return;
    const inspectionId='clo-'+Date.now().toString(36)+'-'+(++inspection);
    parent.postMessage({maya:'ops-clo-inspect',...context,inspectionId,src:image.currentSrc||image.src,alt:image.alt||'CLO reference'},location.origin);
    return ()=>parent.postMessage({maya:'ops-clo-inspect-close',...context,inspectionId},location.origin);
   }
  });
 }});
})();
