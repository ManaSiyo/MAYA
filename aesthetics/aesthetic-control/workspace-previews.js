import {Pill,IconButton} from '/aesthetics/ui/components/components.js';

// Active presentation samples contain no account data and make no provider calls.
export function setupWorkspacePreviews({parent,preview,render}){
 const root=document.createElement('section');root.id='workspace-previews';root.className='workspace-previews';parent.append(root);
 const title=document.createElement('h2');title.dataset.mayaType=title.dataset.previewCategory='H2';title.textContent='Where the styles are used';root.append(title);
 const help=document.createElement('p');help.dataset.mayaType=help.dataset.previewCategory='P1';help.textContent='Preview only. Open an Edit control here to change the same saved setting used on these pages. Page links show the real area.';root.append(help);
 const grid=document.createElement('div');grid.className='workspace-preview-grid';root.append(grid);
 function role(tag,text,type){const e=document.createElement(tag);e.textContent=text;e.dataset.mayaType=e.dataset.previewCategory=type;return e;}
 function openRole(type){const group=document.querySelector('[data-category="'+type+'"]');if(!group)return;group.closest('.review-fold').open=true;const edit=group.querySelector('.type-editor');edit.open=true;edit.scrollIntoView({block:'center'});edit.querySelector('input,select')?.focus();}
 function openInner(event){event?.stopPropagation();const edit=document.querySelector('[data-editor=inner] .type-editor');if(edit){edit.closest('.review-fold').open=true;edit.open=true;edit.scrollIntoView({block:'center'});edit.querySelector('input,select')?.focus();}}
 function card(name,href,uses){const e=document.createElement('section');e.className='workspace-preview-card';e.dataset.mayaPanel='inner';const link=role('a',name,'H3');link.href=href;const caption=role('p',uses,'P3');caption.className='workspace-preview-usage';e.append(link,caption);grid.append(e);return e;}
 function editButton(type){return Pill({label:'Edit '+type,onClick:event=>{event.stopPropagation();openRole(type);}});}
 const feature=card('Admin · Feature requests','/status.html#features-fold','H2 section title · P1 request · P3 name/date · Inner panel');
 const row=document.createElement('div');row.className='fr workspace-feature-row';row.append(role('span','Owner name','P3'),role('p','Preview request: make fabric choices easier to compare.','P1'),role('span','Date','P3'));feature.append(row,editButton('P1'),Pill({label:'Edit Inner panel',onClick:openInner}));
 const automation=card('Admin · Text Automations','/status.html','H3 title · P3 labels · P1 fields · saved label/field gaps');
 const timing=document.createElement('div');timing.dataset.mayaFieldStack='';timing.className='workspace-timing-preview';
 for(const [name,value] of [['Trigger','No reply after first text'],['Earliest draft time','09:00']]){const l=role('label',name,'P3');l.dataset.mayaFieldRow='';const field=role('input','','P1');field.dataset.mayaControl='field';field.value=value;field.readOnly=true;l.append(field);timing.append(l);}
 let example=0;const texts=['Hello {name}, what would you like to create?','Hi {name}, what would help with your next fitting?','Hello {name}, shall we discuss the details of your look?'];
 const output=role('p',texts[0],'P1');output.className='workspace-example-output';const next=()=>{output.textContent=texts[++example%texts.length];};
 const actions=document.createElement('div');actions.className='workspace-preview-actions';actions.append(Pill({label:'Example',onClick:next}),IconButton({label:'Another preview example',icon:'↻',onClick:next}));automation.append(actions,output,timing);
 const logs=card('Admin · Logs and voice dock','/status.html','H2 heading · P3 live voice · Glass controls · saved bottom inset');const logTitle=role('h2','Logs','H2');logTitle.className='workspace-logs-title';logs.append(logTitle,editButton('H2'));
 const dock=document.createElement('div');dock.className='workspace-dock-preview';const dockControl=Pill({label:'Hey Maya',onClick:event=>{const e=event.currentTarget;e.setAttribute('aria-pressed',e.getAttribute('aria-pressed')!=='true');}});dockControl.setAttribute('aria-pressed','false');dock.append(dockControl);logs.append(dock);
 const fabrics=card('Brief and Operation Room · Fabrics','/backend.html','H4 fabric name · P3 two-line caption · Inner product card · Glass pills');
 const material=document.createElement('article');material.className='fa-product workspace-fabric-preview';material.dataset.mayaPanel='inner';const image=document.createElement('img');image.src='/aesthetics/fabrics/thumbs/Midnight%20Velvet.jpg';image.alt='In-house Midnight Velvet presentation sample';image.className='fa-product-image';material.append(image,role('h4','Midnight Velvet','H4'),role('p','For the selected garment · inventory preview','P3'));fabrics.append(material,editButton('H4'));
 const operations=card('Brief → Operation Room','/backend.html','H2 screen title · H3 garment · P1 instructions · shared fields/pills');operations.append(role('h2','Operation Room','H2'),role('h3','Saved dissected garment','H3'),role('p','Front, back and side stay in the same submission workspace.','P1'),editButton('P3'));
 const frontend=card('Frontend · Moodboard and Favorites','/','H1 brand · H3 section · P3 pills · shared Glass and panels');frontend.append(role('h3','Favorites','H3'),Pill({label:'Tap to listen',onClick:event=>{event.stopPropagation();const edit=document.querySelector('.finish-controls .type-editor');if(edit){edit.closest('.review-fold').open=true;edit.open=true;edit.scrollIntoView({block:'center'});}}}),editButton('P3'));
 // The same Glass/P3 recovery chip is used by Admin and Frontend.
 const voice=role('button','Tap to hear Maya','P3');voice.type='button';voice.className='maya-pill workspace-voice-preview';voice.addEventListener('click',()=>openRole('P3'));logs.append(voice);
 render();
}
