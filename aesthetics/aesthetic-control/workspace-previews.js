
// Active presentation samples contain no account data and make no provider calls.
export function setupWorkspacePreviews({parent,render}){
 const root=document.createElement('details');root.id='workspace-previews';root.className='workspace-previews input-control-usage';parent.append(root);
 const title=document.createElement('summary');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Fabric preview';root.append(title);
 const grid=document.createElement('div');grid.className='workspace-preview-grid';root.append(grid);
 function role(tag,text,type){const e=document.createElement(tag);e.textContent=text;e.dataset.mayaType=e.dataset.previewCategory=type;return e;}
 const fabrics=document.createElement('section');fabrics.className='workspace-preview-card';fabrics.dataset.mayaPanel='inner';grid.append(fabrics);
 const interpretation=role('p','A velvet-like body cloth with contrasting inserts; fiber is unconfirmed.','P1');interpretation.className='fa-observation';fabrics.append(interpretation);
 const material=document.createElement('article');material.className='fa-product workspace-fabric-preview';material.dataset.mayaPanel='inner';const link=document.createElement('a');link.className='fa-product-link';link.href='/aesthetics/fabrics/Midnight%20Velvet.JPG';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Midnight Velvet · For the selected garment · Body fabric · Atelier inventory presentation sample');const image=document.createElement('img');image.src='/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg';image.alt='In-house Midnight Velvet presentation sample';image.className='fa-product-image';const productTitle=role('h4','Midnight Velvet','H4');productTitle.className='fa-card-title';const caption=role('p','Atelier inventory','P3');caption.className='fa-card-caption';link.append(image,productTitle,caption);material.append(link);fabrics.append(material);
 const details=window.MayaFabricSearchDetails.create({parent:fabrics,hoverTargets:[material],preview:true});details.set({preferences:JSON.stringify(['Wool','No polyester']),garments:[{name:'Preview coat',fabric:'Burgundy wool twill',traits:{texture:'matte'}}],retailerQueries:['red twill wool'],webQueries:['burgundy wool twill fabric'],query:'burgundy wool twill',observation:'Burgundy and twill-like; exact fiber cannot be confirmed visually.',stores:['Britex Fabrics'],stage:'Presentation sample; no search is sent'});fabrics.append(details.trigger);
 render();
}
