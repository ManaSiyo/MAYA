
// Active presentation samples contain no account data and make no provider calls.
export function setupWorkspacePreviews({parent,render}){
 const root=document.createElement('section');root.id='workspace-previews';root.className='workspace-previews';parent.append(root);
 const title=document.createElement('h3');title.dataset.mayaType=title.dataset.previewCategory='H3';title.textContent='Fabric preview';root.append(title);
 const grid=document.createElement('div');grid.className='workspace-preview-grid';root.append(grid);
 function role(tag,text,type){const e=document.createElement(tag);e.textContent=text;e.dataset.mayaType=e.dataset.previewCategory=type;return e;}
 const fabrics=document.createElement('section');fabrics.className='workspace-preview-card';fabrics.dataset.mayaPanel='inner';grid.append(fabrics);
 const material=document.createElement('article');material.className='fa-product workspace-fabric-preview';material.dataset.mayaPanel='inner';const image=document.createElement('img');image.src='/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg';image.alt='In-house Midnight Velvet presentation sample';image.className='fa-product-image';material.append(image,role('h4','Midnight Velvet','H4'),role('p','For the selected garment · inventory preview','P3'));fabrics.append(material);
 const details=window.MayaFabricSearchDetails.create({parent:fabrics,hoverTargets:[material],preview:true});details.set({preferences:JSON.stringify(['Wool','No polyester']),garments:[{name:'Preview coat',fabric:'Burgundy wool twill',traits:{texture:'matte'}}],retailerQueries:['red twill wool'],webQueries:['burgundy wool twill fabric'],query:'burgundy wool twill',observation:'Burgundy and twill-like; exact fiber cannot be confirmed visually.',stores:['Britex Fabrics'],stage:'Presentation sample; no search is sent'});fabrics.append(details.trigger);
 render();
}
