/* Shared image inspection and Design Notes. No image generation or remote reads. */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function imageBounds(width,height,naturalWidth,naturalHeight){
    const ratio=Math.min(width/naturalWidth,height/naturalHeight);
    const w=naturalWidth*ratio,h=naturalHeight*ratio;
    return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
  }
  function zoomAt(state,next,x,y,width,height){
    next=clamp(next,1,6);const ratio=next/state.scale;
    return {scale:next,x:clamp(x-(x-state.x)*ratio,-width*(next-1)/2,width*(next-1)/2),y:clamp(y-(y-state.y)*ratio,-height*(next-1)/2,height*(next-1)/2)};
  }
  function noteRows(card={}){
    const rows=new Map(),seen=new Set();
    const key=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const labels={colour:'Color',color:'Color','visual ref':'Visual reference','visual reference':'Visual reference',material:'Material',fabric:'Material'};
    const add=(label,value)=>{
      if(!value||typeof value!=='string')return;
      value=value.trim();const id=key(value);if(!id||seen.has(id))return;
      label=labels[key(label)]||label;
      const values=rows.get(label)||[];
      if(values.some(v=>(' '+key(v)+' ').includes(' '+id+' ')))return;
      seen.add(id);values.push(value);rows.set(label,values);
    };
    const p=card.profile||{};
    for(const name of ['Bio','Aesthetic','Silhouette','Color','Era'])add(name,p[name.toLowerCase()]);
    if(!p.bio)add('Notes',card.caption);
    for(const ref of card.refs||[]){const tag=String(ref?.tag||'Notes').replace(/_/g,' ');add(tag.charAt(0).toUpperCase()+tag.slice(1),ref?.title);}
    for(const idea of card.mods||[])add('Design ideas',idea);
    for(const fabric of card.fabrics||[]){add('Material',fabric.name);add('Color',fabric.color);add('Material',fabric.weave);add('Weight',fabric.weight);}
    return [...rows].map(([title,values])=>({title,values}));
  }
  function renderNotes(host,card){
    host.replaceChildren();
    for(const row of noteRows(card)){
      const section=document.createElement('section'),heading=document.createElement('h3'),text=document.createElement('p');
      heading.dataset.mayaType='H4';heading.textContent=row.title;text.dataset.mayaType='P1';text.textContent=row.values.join(' · ');
      section.append(heading,text);host.append(section);
    }
    if(!host.childElementCount){const p=document.createElement('p');p.dataset.mayaType='P1';p.textContent='No design notes yet.';host.append(p);}
  }
  function notesDrawer({parent=document.body,anchor=parent,id='design-notes',card={}}={}){
    const dock=document.createElement('div');dock.className='maya-notes-dock';
    const button=document.createElement('button');button.type='button';button.className='maya-notes-trigger';button.dataset.mayaType='P3';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);
    button.innerHTML='<span class="maya-notes-label">Design Notes</span><span class="maya-notes-drop" data-maya-pill="glass" aria-hidden="true">+</span>';
    const panel=document.createElement('aside');panel.id=id;panel.className='maya-design-notes';panel.dataset.mayaMaterial='glass';panel.dataset.mayaScrollbar='visible';panel.setAttribute('aria-label','Design Notes');panel.inert=true;
    const head=document.createElement('h2');head.dataset.mayaType='H2';head.textContent='Design Notes';
    const content=document.createElement('div');content.className='maya-notes-content';panel.append(head,content);dock.append(button,panel);parent.append(dock);
    let open=false;
    function set(value){open=value;dock.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));panel.inert=!open;button.querySelector('.maya-notes-drop').textContent=open?'−':'+';}
    button.onclick=()=>set(!open);
    const place=()=>{if(!anchor?.isConnected||!anchor.getClientRects().length)return;const r=anchor.getBoundingClientRect(),p=parent.getBoundingClientRect(),top=(parent.classList.contains('maya-notes-preview')?r.top-p.top+r.height/2:r.top+r.height/2)+'px';if(dock.style.top!==top)dock.style.top=top;};
    let placementFrame=0;const schedulePlace=()=>{if(!placementFrame)placementFrame=requestAnimationFrame(()=>{placementFrame=0;place();});};
    new ResizeObserver(schedulePlace).observe(anchor);window.addEventListener('resize',schedulePlace);document.addEventListener('scroll',schedulePlace,true);place();
    dock.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){event.stopPropagation();set(false);button.focus();}});
    renderNotes(content,card);
    return {element:dock,set,update:card=>{set(false);renderNotes(content,card);}};
  }
  const bound=new WeakMap();let active=null;
  function bind(image,{expand=()=>open(image),lens=null,inspect=false}={}){
    if(bound.has(image))return bound.get(image);
    if(!inspect){
      image.classList.add('maya-image-opener');image.draggable=false;image.tabIndex=0;
      image.setAttribute('aria-label','Expand '+(image.alt||'image'));
      image.addEventListener('click',e=>{e.preventDefault();expand(image);});
      image.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();expand(image);}});
      const api={reset(){},gesturing:false,get state(){return {scale:1,x:0,y:0};}};bound.set(image,api);return api;
    }
    const host=image.parentElement,points=new Map();let state={scale:1,x:0,y:0},last=null,moved=false,suppressUntil=0;
    image.classList.add('maya-zoom-image');image.draggable=false;
    const paint=()=>{image.style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;};
    const box=()=>imageBounds(image.clientWidth,image.clientHeight,image.naturalWidth||1,image.naturalHeight||1);
    const reset=()=>{state={scale:1,x:0,y:0};points.clear();last=null;paint();if(lens)lens.hidden=true;};
    const snapshot=()=>{const p=[...points.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:p[0];};
    const origin=(x,y)=>{const r=host.getBoundingClientRect();return {x:x-r.left-r.width/2,y:y-r.top-r.height/2};};
    function zoom(next,x,y){const b=box(),o=origin(x,y);state=zoomAt(state,next,o.x,o.y,b.width,b.height);paint();if(lens)lens.hidden=true;}
    image.addEventListener('pointerdown',e=>{if(e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});last=snapshot();moved=false;image.setPointerCapture(e.pointerId);});
    image.addEventListener('pointermove',e=>{
      if(points.has(e.pointerId)){
        const previous=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=snapshot();
        if(points.size>1&&last?.d){zoom(state.scale*now.d/last.d,now.x,now.y);moved=true;}
        else if(state.scale>1){const b=box();state.x=clamp(state.x+e.clientX-previous.x,-b.width*(state.scale-1)/2,b.width*(state.scale-1)/2);state.y=clamp(state.y+e.clientY-previous.y,-b.height*(state.scale-1)/2,b.height*(state.scale-1)/2);paint();moved=true;}
        last=now;return;
      }
      if(!lens||e.pointerType!=='mouse'||state.scale!==1)return;
      const r=image.getBoundingClientRect(),b=box(),x=e.clientX-r.left-b.x,y=e.clientY-r.top-b.y;
      if(x<0||y<0||x>b.width||y>b.height){lens.hidden=true;return;}
      const hr=host.getBoundingClientRect(),w=Math.min(324,hr.width*.567),h=Math.min(w*.72,hr.height),factor=2.5;
      const left=clamp(e.clientX-hr.left-w/2,0,hr.width-w),top=clamp(e.clientY-hr.top-h/2,0,hr.height-h);
      lens.style.setProperty('width',w+'px','important');lens.style.setProperty('padding','0','important');
      Object.assign(lens.style,{height:h+'px',left:left+'px',top:top+'px',backgroundImage:'url('+JSON.stringify(image.currentSrc||image.src)+')',backgroundSize:`${b.width*factor}px ${b.height*factor}px`,backgroundPosition:`${w/2-x*factor}px ${h/2-y*factor}px`});lens.hidden=false;
    });
    const end=e=>{if(moved||points.size>1)suppressUntil=Date.now()+350;points.delete(e.pointerId);last=snapshot();};
    image.addEventListener('pointerup',end);image.addEventListener('pointercancel',end);
    image.addEventListener('pointerleave',()=>{if(lens)lens.hidden=true;});
    image.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();zoom(state.scale*Math.exp(-e.deltaY*.008),e.clientX,e.clientY);},{passive:false});
    image.addEventListener('click',e=>{if(Date.now()<suppressUntil||state.scale!==1){e.preventDefault();e.stopImmediatePropagation();return;}e.preventDefault();expand(image);});
    image.addEventListener('dblclick',e=>{e.preventDefault();zoom(state.scale>1?1:2,e.clientX,e.clientY);});
    image.addEventListener('load',reset);
    image.tabIndex=0;image.setAttribute('aria-label',image.alt||'Inspect image');
    image.addEventListener('keydown',e=>{const r=host.getBoundingClientRect();if(['+','=','-','0'].includes(e.key)){e.preventDefault();zoom(e.key==='0'?1:state.scale*(e.key==='-'?.8:1.25),r.left+r.width/2,r.top+r.height/2);}if(e.key==='Enter'&&state.scale===1){e.preventDefault();expand(image);}});
    const api={reset,get gesturing(){return points.size>1||moved||state.scale>1;},get state(){return {...state};}};bound.set(image,api);return api;
  }
  function open(source,{onClose}={}){
    if(!source?.src)return;active?.close();const previous=document.activeElement;
    const dialog=document.createElement('dialog');dialog.className='maya-image-viewer';dialog.setAttribute('aria-label','Expanded image');
    const stage=document.createElement('div');stage.className='maya-image-stage';
    const image=document.createElement('img');image.src=source.currentSrc||source.src;image.alt=source.alt;
    const lens=document.createElement('div');lens.className='maya-image-lens';lens.dataset.mayaPanel='inner';lens.hidden=true;lens.setAttribute('aria-hidden','true');
    const close=document.createElement('button');close.className='maya-icon-button maya-image-close';close.dataset.mayaShape='circle';close.dataset.mayaDismiss='';close.dataset.mayaType='P3';close.setAttribute('aria-label','Close expanded image');close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';close.onclick=()=>dialog.close();
    stage.append(image,lens);dialog.append(stage,close);document.body.append(dialog);bind(image,{expand:()=>{},lens,inspect:true});
    const sourceURL=source.src;const observer=new MutationObserver(()=>{if(!source.isConnected||source.src!==sourceURL)dialog.close();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    dialog.addEventListener('close',()=>{observer.disconnect();dialog.remove();if(active===dialog)active=null;onClose?.();if(previous?.isConnected)previous.focus({preventScroll:true});});dialog.showModal();image.focus();active=dialog;return dialog;
  }
  function panGarment(host,image){
    if(!host||!image)return;
    host.classList.add('maya-garment-pan');
    let position=50,drag=null,suppressUntil=0;
    const update=()=>host.style.setProperty('--garment-position',position+'%');
    const ready=()=>{position=50;update();image.classList.toggle('is-wide',image.naturalWidth>image.naturalHeight*1.1);};
    image.addEventListener('load',ready);if(image.complete)ready();
    host.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')drag={x:e.clientX,y:e.clientY,position};});
    host.addEventListener('pointermove',e=>{
      if(!image.classList.contains('is-wide')||image.style.display==='none')return;
      const r=host.getBoundingClientRect();
      if(e.pointerType==='mouse')position=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
      else if(drag&&Math.abs(e.clientX-drag.x)>Math.abs(e.clientY-drag.y)+8){position=Math.max(0,Math.min(100,drag.position-(e.clientX-drag.x)/r.width*100));suppressUntil=Date.now()+350;}
      else return;
      update();
    });
    host.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){position=50;update();}});
    for(const type of ['pointerup','pointercancel'])host.addEventListener(type,()=>{drag=null;});
    image.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    host.addEventListener('keydown',e=>{if(!image.classList.contains('is-wide')||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();position=Math.max(0,Math.min(100,position+(e.key==='ArrowRight'?10:-10)));update();});
  }
  function watch(selector,options={}){
    document.querySelectorAll(selector).forEach(image=>bind(image,options));
    new MutationObserver(records=>{
      // Caption/status changes must not rescan every image on the page.
      const added=new Set(records.flatMap(record=>[...record.addedNodes]).filter(node=>node.nodeType===1&&node.isConnected));
      for(const node of added){
        let nested=false;for(let parent=node.parentElement;parent;parent=parent.parentElement)if(added.has(parent)){nested=true;break;}
        if(nested)continue;
        if(node.matches(selector))bind(node,options);
        node.querySelectorAll(selector).forEach(image=>bind(image,options));
      }
    }).observe(document.body,{childList:true,subtree:true});
  }
  window.MayaImageViewer={open,close:()=>active?.close(),bind,watch,panGarment,imageBounds,zoomAt,noteRows,notesDrawer,renderNotes};
})();
