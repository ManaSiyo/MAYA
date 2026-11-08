// Tracing is CPU-heavy. Keep it outside the thread that owns scrolling and input.
importScripts('https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js');
self.onmessage=({data})=>{
  try{
    const image={width:data.width,height:data.height,data:new Uint8ClampedArray(data.pixels)};
    const options={...(ImageTracer.optionpresets.detailed||{}),numberofcolors:4,pathomit:16,ltres:1,qtres:1,blurradius:0,linefilter:true,roundcoords:1};
    const svg=ImageTracer.imagedataToSVG(image,options);
    if(svg.length>4*1024*1024)throw Error('This pattern is too detailed to preview as SVG.');
    self.postMessage({svg});
  }catch(error){self.postMessage({error:error.message||'SVG tracing failed.'});}
};
