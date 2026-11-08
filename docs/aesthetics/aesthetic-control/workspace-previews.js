import {Drawer,Pill} from '/aesthetics/ui/components/components.js';

// Active presentation samples contain no account data and make no provider calls.
export function setupWorkspacePreviews({parent,render}){
 const root=document.createElement('details');root.id='workspace-previews';root.className='workspace-previews input-control-usage';parent.append(root);
 const title=document.createElement('summary');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Fabric preview';root.append(title);
 const grid=document.createElement('div');grid.className='workspace-preview-grid';root.append(grid);
 function role(tag,text,type){const e=document.createElement(tag);e.textContent=text;e.dataset.mayaType=e.dataset.previewCategory=type;return e;}
 const fabrics=document.createElement('section');fabrics.className='workspace-preview-card';fabrics.dataset.mayaPanel='inner';grid.append(fabrics);
 const tabs=document.createElement('nav');tabs.className='fa-tabs';tabs.dataset.mayaControl='segmented';tabs.setAttribute('aria-label','Fabric layout preview');fabrics.append(tabs);fabrics.classList.add('workspace-fabric-gallery');
 const body=document.createElement('div');body.className='fa-body';body.dataset.mayaScrollbar='visible';fabrics.append(body);
 const results=document.createElement('div');results.className='fa-results';results.dataset.mayaScrollbar='visible';results.tabIndex=0;results.setAttribute('aria-label','Fabric preview gallery');body.append(results);
 const photos=['Midnight Velvet','Burgundy Lace','Gray Knit','Rustic Stretch','Orange Cheetah','Black Relic','Garden Mesh','Red Royal'];
 for(const name of photos){
  const material=document.createElement('article');material.className='fa-product workspace-fabric-preview';material.dataset.mayaPanel='inner';
  const link=document.createElement('a');link.className='fa-product-link';link.href='/aesthetics/fabrics/'+encodeURIComponent(name)+'.JPG';link.target='_blank';link.rel='noopener noreferrer';
  const image=document.createElement('img');image.src='/aesthetics/fabrics/thumbs/'+encodeURIComponent(name)+'.jpg';image.alt=name+' layout sample';image.className='fa-product-image';
  const productTitle=role('h4',name,'H4');productTitle.className='fa-card-title';const caption=role('p','Atelier inventory','P3');caption.className='fa-card-caption';link.append(image,productTitle,caption);material.append(link);results.append(material);
 }
 const status=role('p','Searching for Fabrics','P1');status.className='fa-status';status.setAttribute('role','status');fabrics.append(status);
 for(const name of ['In House','Global']){const button=role('button',name,'P3');button.type='button';button.className='pill maya-pill';button.dataset.mayaSegment='';button.setAttribute('aria-pressed',String(name==='In House'));button.addEventListener('click',()=>{for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab===button));for(const caption of results.querySelectorAll('.fa-card-caption'))caption.textContent=name==='In House'?'Atelier inventory':'Global layout sample';});tabs.append(button);}
 const csv=Pill({label:'CSV',onClick:()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['Item,Link,Fabric type\r\nPreview,,Velvet\r\n'],{type:'text/csv'}));a.href=url;a.download='fabric-preview.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});csv.setAttribute('aria-label','Export preview CSV');tabs.append(csv);

 const operations=document.createElement('section');operations.id='operations-layout-preview';operations.className='workspace-preview-card';operations.dataset.mayaSurface='outer';parent.append(operations);
 const heading=role('h3','Operation Room','H3'),version=role('span',' – version 2','P3');heading.append(version);operations.append(heading);
 const columns=document.createElement('div');columns.dataset.mayaOperationLayout='';operations.append(columns);
 const garment=document.createElement('div');garment.dataset.mayaPanel='inner';const sample=document.createElement('img');sample.src='/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg';sample.alt='Garment image layout sample';sample.className='operation-layout-image';garment.append(sample);
 const pattern=document.createElement('div');pattern.dataset.mayaPanel='inner';pattern.className='operation-layout-stage';pattern.append(role('p','Saved pattern preview','P1'));columns.append(garment,pattern);MayaImageViewer.bind(sample);
 const settings=document.createElement('section');settings.innerHTML='<label data-maya-type="P3">Garment category<select data-maya-control="field" data-maya-type="P1" aria-label="Preview garment category"><option value="jacket">Jacket</option><option value="pants">Pants</option></select></label><label data-maya-type="P3">Construction direction<textarea data-maya-control="field" data-maya-type="P1" rows="3" aria-label="Preview construction direction"></textarea></label><p data-maya-type="P1" data-preview-shapes>Jacket · upper sleeve ×2 · undersleeve ×2</p><details><summary data-maya-type="H4">Operation Room version history</summary><p data-maya-type="P1">Version 2 · saved patterns, editable inputs and per-item research.</p></details>';
 settings.querySelector('select').onchange=e=>settings.querySelector('[data-preview-shapes]').textContent=e.target.value==='jacket'?'Jacket · upper sleeve ×2 · undersleeve ×2':'Pants · front leg ×2 · back leg ×2';
 const drawer=Drawer({title:'Pattern inputs',content:[settings]});operations.append(Pill({label:'Pattern settings',onClick:event=>drawer.showFrom(event.currentTarget)}));
 render();
}
