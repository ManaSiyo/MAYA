import {SHEET_COLUMNS,priorityInfo,priorityQueue,followupSummary} from './outbound-priority.js?v=1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={campaigns:[],contacts:[],companies:[],settings:{}},caps={},campaignId='',selected='',view='people',busy=false,session='',titleFilter='',master=true,todo=false,visibleLimit=250;
let intelligence={mailboxes:[],crm:{}},accountId='',authEpoch=0,reloadPending=false,intelligenceLoading=false;
const busyControls=new Map();
function syncBusyControls(){
 if(busy){document.querySelectorAll('button,input,select,textarea').forEach(el=>{if(el.matches('#menu-toggle,#close-drawer,#drawer-workspace-tab,#drawer-help-tab,#close-modal,#cancel-modal')||busyControls.has(el))return;busyControls.set(el,el.disabled);el.disabled=true;});}
 else{for(const [el,disabled] of busyControls)if(el.isConnected)el.disabled=disabled;busyControls.clear();$('connect-gmail').disabled=intelligence.mailboxes.length>=2;}
}
function clearWorkspace(){
 state={campaigns:[],contacts:[],companies:[],settings:{}};caps={};intelligence={mailboxes:[],crm:{}};accountId=campaignId=selected=titleFilter='';master=true;todo=false;visibleLimit=BATCH_SIZE;
 $('search').value='';$('stage-filter').value='';$('modal').close();$('signin').hidden=false;render();renderIntelligence();
}
const BATCH_SIZE=250;
let stopCollection=()=>{},appliedSearch='',appliedStage='',searchTimer;
const member=(p,id)=>(p.campaignIds||[p.campaignId]).includes(id);
// Render the filtered dataset in place; appending never replaces focused/selected rows.
function mountCollection(list, host, row, scrollRoot=null){
 let rendered=0,active=true;
 const sentinel=document.createElement('div');sentinel.className='collection-progress';sentinel.setAttribute('role','status');
 (scrollRoot||host.parentElement).append(sentinel);
 const append=()=>{
  const end=Math.min(Math.max(visibleLimit,rendered+BATCH_SIZE),list.length);
  const html=list.slice(rendered,end).map(row).join('');
  if(host===scrollRoot)sentinel.insertAdjacentHTML('beforebegin',html);else host.insertAdjacentHTML('beforeend',html);
  rendered=end;visibleLimit=Math.max(BATCH_SIZE,end);
  sentinel.textContent=rendered.toLocaleString()+' of '+list.length.toLocaleString();
  syncBusyControls();
  if(rendered>=list.length)observer?.disconnect();
 };
 let observer=null;
 const more=()=>{if(active&&rendered<list.length)append();};
 const check=()=>{
  const box=sentinel.getBoundingClientRect(),edge=scrollRoot?scrollRoot.getBoundingClientRect().bottom:innerHeight;
  if(box.top<=edge+200&&box.bottom>=0)more();
 };
 append();
 if(rendered<list.length&&typeof IntersectionObserver==='function'){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))check();},{root:scrollRoot,rootMargin:'200px'});observer.observe(sentinel);}
 const target=scrollRoot||window;target.addEventListener('scroll',check,{passive:true});
 stopCollection=()=>{active=false;observer?.disconnect();target.removeEventListener('scroll',check);};
}
const stageLabel=stage=>({new:'Not contacted',ready:'Ready',contacted:'Contacted',replied:'Replied',meeting:'Booked',closed:'Closed',suppressed:'Do not contact'}[stage]||stage||'Not contacted');
function statusPill(p){return `<span class="status-pill" data-status="${esc(p.stage||'new')}">${esc(stageLabel(p.stage))}</span>`;}
const searchText=p=>[p.name,p.company,p.domain,p.email,p.title,p.notes,p.category,p.sheetStatus,p.relevance,p.sheetData?.subject,p.subject,p.lastEmail,stageLabel(p.stage)].join(' ').toLowerCase();
function hasUnsavedDraft(){const p=state.contacts.find(p=>p.id===selected);return !!(p&&$('body')&&['body','subject','notes','stage'].some(k=>$(k).value!==(p[k]||'')));}
function leaveDraft(){return !hasUnsavedDraft()||confirm('Discard your unsaved draft and notes?');}
window.addEventListener('beforeunload',e=>{if(hasUnsavedDraft()){e.preventDefault();e.returnValue='';}});
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function token(){return localStorage.getItem('maya_admin_tok')||'';}
async function api(path='',body){
 const auth=token(),epoch=authEpoch;if(!auth)throw Error('Sign in to Maya Admin first.');
 let r;try{r=await fetch('/api/admin/outbound'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});}catch(e){if(e.name==='TimeoutError')throw Error(path==='/send'?'Send unconfirmed. Check Gmail Sent before retrying.':'Request timed out. Check the latest state before retrying.');throw e;}
 let j;try{j=await r.json();}catch{j={error:r.status===504?'Update is still running. Check again shortly.':'The server could not respond. Try again.'};}
 if(token()!==auth||epoch!==authEpoch)throw Error('Your account changed. Reloading.');
 if(!r.ok){if([401,403].includes(r.status)){authEpoch++;clearWorkspace();notice('Sign in to Maya Admin again.',true);}throw Error(j.error||'Request failed.');}
 if(j.error&&!j.ok)throw Error(j.error);return j;
}
async function run(fn){
 if(busy)return;const epoch=authEpoch;busy=true;syncBusyControls();
 try{await fn();}catch(e){if(epoch===authEpoch)notice(e.message,true);}
 finally{busy=false;syncBusyControls();if(reloadPending){reloadPending=false;run(load);}}
}
async function load(){const epoch=authEpoch;try{const j=await api();state=j.state;caps=j.capabilities;accountId=j.accountId||'';session=token();$('signin').hidden=true;if(!state.campaigns.some(c=>c.id===campaignId))campaignId=state.campaigns[0]?.id||'';render();notice('Workspace ready.');refreshIntelligence();if(state.settings.sheetId)await syncWorkbook();}catch(e){if(epoch===authEpoch){if(!token())$('signin').hidden=false;notice(e.message,true);}}}
const campaign=()=>master?{id:'master',name:todo?'To Do':'All prospects',status:'active'}:state.campaigns.find(c=>c.id===campaignId);
const contacts=()=>state.contacts.filter(c=>master||member(c,campaignId));
async function save(body){if(body.type!=='contact'&&!leaveDraft())throw Error('Save your draft before continuing.');const j=await api('/save',body);state=j.state;render();notice('Saved.');return j;}
function modal(title,html,submit,label='Save'){$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal-submit').textContent=label;$('modal-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);run(async()=>{await submit(data);$('modal').close();});};$('modal').showModal();}
function field(name,label,value='',type='input'){return `<label for="field-${name}">${esc(label)}</label>${type==='textarea'?`<textarea id="field-${name}" name="${name}">${esc(value)}</textarea>`:`<input id="field-${name}" name="${name}" value="${esc(value)}">`}`;}
function editCampaign(existing){modal(existing?'Edit campaign':'New campaign',field('name','Campaign name',existing?.name)+field('audience','Who do you want to reach?',existing?.audience,'textarea')+field('pain','Customer pain and buying trigger',existing?.pain,'textarea')+field('criteria','Qualification criteria',existing?.criteria,'textarea')+field('objective','Offer and objective',existing?.objective,'textarea')+field('competitors','Competitor names or domains (research notes)',existing?.competitors,'textarea')+`<label>Status</label><select name="status"><option value="active">Active</option><option value="paused" ${existing?.status==='paused'?'selected':''}>Paused</option></select>`,async data=>{const j=await save({type:'campaign',id:existing?.id,...Object.fromEntries(data)});if(!existing){campaignId=j.state.campaigns.at(-1).id;master=false;todo=false;view='people';visibleLimit=BATCH_SIZE;}render();});}
function render(){
 stopCollection();
 appliedSearch=$('search').value;
 appliedStage=$('stage-filter').value;
 try{
 $('master-list').classList.toggle('active',master&&!todo);$('master-list').setAttribute('aria-pressed',String(master&&!todo));
 $('todo-list').classList.toggle('active',todo);$('todo-list').setAttribute('aria-pressed',String(todo));$('todo-count').textContent=priorityQueue(state.contacts).length+' to contact';
 $('targeting-panel').hidden=master;$('discover').hidden=master;$('import').hidden=master;
 const c=campaign(),people=contacts(),count=stage=>people.filter(p=>p.stage===stage).length;
 $('campaigns').innerHTML=state.campaigns.map(c=>`<button class="campaign ${!master&&c.id===campaignId?'active':''}" data-campaign="${esc(c.id)}">${esc(c.name.replace(/^9\/23 /,'').replace(/^Corporates$/,'Corporate').replace(/^Fashion Houses$/,'Fashion house'))}<small>${state.contacts.filter(p=>member(p,c.id)).length} prospects · ${esc(c.status)}</small></button>`).join('')||'<p class="muted small" style="margin-top:18px">Start with a campaign for your ideal customers.</p>';
 document.querySelectorAll('[data-campaign]').forEach(b=>b.onclick=()=>{if(!leaveDraft())return;campaignId=b.dataset.campaign;master=false;todo=false;visibleLimit=BATCH_SIZE;selected='';render();});
 $('competitors').textContent=c?[c.pain&&'PAIN\n'+c.pain,c.criteria&&'CRITERIA\n'+c.criteria,c.competitors&&'RESEARCH\n'+c.competitors].filter(Boolean).join('\n\n')||'Add pain, criteria and research notes.':'Choose a campaign.';$('campaign-title').textContent=c?.name||'Choose a campaign';
 $('providers').textContent=`Hunter: ${caps.hunter?'configured':'needs connection'}\nGoogle Sheets: ${state.settings.sheetId?'selected':'choose a sheet'}\nMaya: ${caps.ai?'configured':'needs connection'}`;$('providers').style.whiteSpace='pre-line';$('drawer-providers').textContent=$('providers').textContent;$('drawer-providers').style.whiteSpace='pre-line';
 $('steps').innerHTML=['Define audience','Find companies','Find people','Verify','Draft','Review & reach out'].map((s,i)=>`<span class="step ${[!!c,state.companies.some(x=>x.campaignId===campaignId),!!people.length,people.some(p=>p.verification==='valid'),people.some(p=>p.body),people.some(p=>p.stage==='contacted')][i]?'done':''}"><b>${i+1}</b>${s}</span>`).join('<span class="muted">·</span>');
 renderFollowups(people);
 $('stats').innerHTML=[['Prospects',people.length],['Verified',people.filter(p=>p.verification==='valid').length],['Contacted',people.filter(p=>['contacted','replied','meeting','closed'].includes(p.stage)).length],['Meetings',count('meeting')],['Closed',count('closed')]].map(([label,n])=>`<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
 $('view-menu').value=view;
 if(!c){$('content').innerHTML='<div class="empty"><h2>Start a campaign</h2>Import your Google Sheet or find prospects with Hunter.</div>';return;}
 if(view==='activity'){renderActivity();return;}
 if(view==='results'){renderResults();return;}
 if(view==='companies'){renderCompanies();return;}
 if(view==='people'){renderPeople();return;}
 const query=$('search').value.toLowerCase(),stageFilter=$('stage-filter').value;const list=(todo?priorityQueue(people):people).filter(p=>(!stageFilter||p.stage===stageFilter)&&searchText(p).includes(query)&&(!titleFilter||(p.title||'Not recorded')===titleFilter)&&(view!=='emails'||p.email||p.body||p.id===selected));
 if(!list.some(p=>p.id===selected))selected=list[0]?.id||'';
 $('content').innerHTML=`<div class="workspace"><div><div class="row spread" style="margin-bottom:12px"><span class="muted small">${list.length} prospects</span><button id="add-person">+ Add person</button><button id="export">Export CSV</button></div><div class="list"></div></div><div id="detail"></div></div>`;
 mountCollection(list,document.querySelector('.list'),p=>`<button class="person ${p.id===selected?'active':''}" data-person="${esc(p.id)}"><div class="row"><span class="avatar">${esc((p.name||p.company||'?').slice(0,2).toUpperCase())}</span><div><h3>${esc(p.name||p.company)}</h3><div class="muted small">${esc(p.title||p.company||p.domain)}</div></div></div><span class="badge">${esc(p.source)}</span><span class="badge ${p.verification==='valid'?'valid':''}">${esc(p.verification)}</span>${statusPill(p)}<p class="small muted" style="margin-top:9px">${esc(p.email||'Email not found yet')}</p></button>`,document.querySelector('.list'));
 $('add-person').onclick=addPerson;$('export').onclick=exportCSV;renderDetail();
 }finally{syncBusyControls();}
}
const icon=(name)=>`<svg class="outbound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='fire'?'<path d="M13 3c1 5-4 5-3 9-2-1-3-2-3-4-5 5-3 13 5 13 7 0 10-9 4-13 0 3-2 4-3 4 2-3 2-6 0-9Z"/>':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'}</svg>`;
const shortDate=ts=>ts?new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'Not recorded';
function renderFollowups(people){
 const {counts,latest}=followupSummary(people),total=people.length,next=priorityQueue(people)[0];
 const buckets=[['uncontacted','Not contacted'],['first','First email sent'],['f1','F1 sent'],['f2','F2+ sent'],['review','Review history'],['held','Replied / on hold']];
 $('followups').innerHTML=`${next?'<div class="priority-next row spread"><span>'+icon('fire')+' Next: <button class="person-link" id="next-contact">'+esc(next.name||next.company)+'</button> · '+esc(priorityInfo(next).next)+'</span><button id="write-next" class="write-email">'+icon('email')+' Write an email</button></div>':''}<div class="row spread"><strong>Follow-ups</strong><span class="muted small">F1 = second email · F2 = third email</span></div><div class="followup-chart" role="img" aria-label="${buckets.map(([key,label])=>label+': '+counts[key]).join(', ')}">${buckets.filter(([key])=>counts[key]).map(([key,label])=>`<span class="followup-segment ${key}" style="flex:${counts[key]}" title="${esc(label)}: ${counts[key]}"></span>`).join('')}</div><div class="followup-legend">${buckets.map(([key,label])=>`<span><i class="${key}" aria-hidden="true"></i>${label} <b>${counts[key]}</b></span>`).join('')}</div><div class="row spread followup-note"><span>${latest?'Last contacted: <button class="person-link" id="last-contact">'+esc(latest.p.name||latest.p.company)+'</button> · '+shortDate(latest.at):'No contact date recorded'}</span><span class="muted">${total} prospects · Oldest follow-ups first</span></div>`;
 if(next)$('write-next').onclick=$('next-contact').onclick=()=>openEmail(next.id);
 if(latest)$('last-contact').onclick=()=>openEmail(latest.p.id);
 $('sheet-freshness').textContent=state.settings.lastSyncedAt?'Sheet synced '+new Date(state.settings.lastSyncedAt).toLocaleString():'Sheet not synced yet';
}
function openEmail(id){
 if(!leaveDraft())return;
 selected=id;view='emails';
 // A direct action must open that person, regardless of old table filters.
 $('search').value='';$('stage-filter').value='';titleFilter='';
 if(todo&&!priorityInfo(state.contacts.find(p=>p.id===id)).actionable)todo=false;
 visibleLimit=BATCH_SIZE;render();$('subject')?.focus();
}
function renderPeople(){
 const q=$('search').value.toLowerCase(),stage=$('stage-filter').value;
 const people=contacts(),titles=[...new Set(people.map(p=>p.title||'Not recorded'))].sort();
 const list=(todo?priorityQueue(people):people).filter(p=>(!stage||p.stage===stage)&&(!titleFilter||(p.title||'Not recorded')===titleFilter)&&searchText(p).includes(q));
 const headers=SHEET_COLUMNS.map((h,i)=>'<th scope="col" data-sheet-col="'+i+'">'+h+'</th>').join('');
 $('content').innerHTML=`<div class="actions people-actions"><button id="add-person">+ Add person</button><button id="export">Export CSV</button><button id="assign-segment">Add selected to campaign</button><label for="title-filter" class="sr-only">Job title</label><select id="title-filter" aria-label="Job title"><option value="">All job titles</option>${titles.map(t=>'<option '+(t===titleFilter?'selected':'')+'>'+esc(t)+'</option>').join('')}</select></div>${todo?'<p class="queue-caption">Not contacted first, ranked by relevance. Then oldest follow-ups. Full Sheet columns and paused contacts are in All prospects.</p>':''}<div class="people-scroll" role="region" aria-label="Prospect table; scroll horizontally for all Sheet columns" tabindex="0"><table class="people-table ${todo?'todo-table':''}"><thead><tr><th scope="col"><span class="sr-only">Select</span></th><th scope="col">Priority</th>${headers}<th scope="col">Next touch</th><th scope="col">Action</th></tr></thead><tbody></tbody></table></div>${list.length?'':'<p class="empty">'+(todo?'No prospects to contact in this view.':'No prospects match these filters.')+'</p>'}`;
 mountCollection(list,document.querySelector('.people-table tbody'),p=>{
 const info=priorityInfo(p),status=p.sheetStatus||({new:'Not contacted',ready:'Ready',contacted:'Contacted',replied:'Replied',suppressed:'Do not contact'}[p.stage]||p.stage);
 const sourceSubject=p.sheetData?.subject??p.subject;
 const lastEmail=info.lastEmailAt?shortDate(info.lastEmailAt):p.lastEmail||'Not recorded';
 return `<tr data-contact-row="${esc(p.id)}"><td><input type="checkbox" data-select="${esc(p.id)}" aria-label="Select ${esc(p.name||p.email)}"></td><td><span class="priority-label ${info.hot?'hot':''}">${info.hot?icon('fire'):''}${esc(info.label)}</span></td><td data-sheet-col="0">${esc(p.category||'Not recorded')}</td><td data-sheet-col="1">${esc(p.company||p.domain)}</td><td data-sheet-col="2"><button class="person-link" data-person="${esc(p.id)}">${esc(p.name||p.email||'Unnamed')}</button></td><td data-sheet-col="3">${esc(p.email||'Not recorded')}</td><td data-sheet-col="4">${esc(p.title||'Not recorded')}</td><td data-sheet-col="5" class="sheet-subject">${esc(sourceSubject||'Not recorded')}</td><td data-sheet-col="6" class="date-cell" title="Sheet: ${esc(p.lastEmail||'not recorded')}. Yearless dates use their most recent occurrence at sync.">${esc(lastEmail)}</td><td data-sheet-col="7" class="sheet-status" title="${esc(status)}">${statusPill(p)}${p.sheetStatus?'<span class="sr-only"> Sheet: '+esc(p.sheetStatus)+'</span>':''}</td><td data-sheet-col="8">${esc(p.relevance||'Not recorded')}</td><td>${info.actionable?esc(info.next):'On hold'}</td><td><button class="write-email" data-write="${esc(p.id)}" ${p.stage==='suppressed'?'disabled':''}>${icon('email')}Write an email</button></td></tr>`;
 },document.querySelector('.people-scroll'));
 $('assign-segment').onclick=assignSegment;
 $('title-filter').onchange=e=>{titleFilter=e.target.value;visibleLimit=BATCH_SIZE;render();};$('add-person').onclick=addPerson;$('export').onclick=exportCSV;

}
$('content').addEventListener('click',e=>{
 const person=e.target.closest('[data-person],[data-write]'),company=e.target.closest('[data-domain]');
 if(busy||person?.disabled||company?.disabled)return;
 if(person)openEmail(person.dataset.person||person.dataset.write);
 if(company)domainSearch(company.dataset.domain);
});
function renderDetail(){const p=state.contacts.find(p=>p.id===selected);if(!p){$('detail').innerHTML='<div class="empty">Select a prospect to see their details and email draft.</div>';return;}
 const blocked=p.stage==='suppressed';$('detail').innerHTML=`<section class="detail"><div class="row spread"><div><h2>${esc(p.name||p.company)}</h2><p class="muted">${esc(p.company)} · ${esc(p.title)}</p></div><span class="avatar">✦</span></div><div class="actions"><button id="find-email">Find email</button><button id="verify-email">Verify email</button><button id="generate" class="primary">Draft with Maya</button></div><label for="stage">Relationship stage</label><select id="stage">${['new','ready','contacted','replied','meeting','closed','suppressed'].map(s=>`<option ${s===p.stage?'selected':''}>${s}</option>`).join('')}</select>${p.intelligence?`<div class="crm-insight"><strong>AI suggestion</strong><p>${esc(p.intelligence.summary)}</p><p>${esc(p.intelligence.nextAction)}</p><small>${esc(p.intelligence.provider)} · ${esc(new Date(p.intelligence.updatedAt).toLocaleString())}</small></div>`:''}<label for="notes">Research and latest notes</label><textarea id="notes" class="notes">${esc(p.notes)}</textarea><label>To</label><p style="margin-top:9px">${esc(p.email||'Find an email first')}</p><label for="mail-sender">Send from</label><select id="mail-sender">${intelligence.mailboxes.map(m=>`<option value="${esc(m.id)}">${esc(m.email)}</option>`).join('')||'<option value="">Connect Gmail in the menu</option>'}</select><label for="subject">Subject</label><input id="subject" value="${esc(p.subject)}" placeholder="Your introduction"><label for="body">Email draft</label><textarea id="body" placeholder="Generate or write a personal introduction.">${esc(p.body)}</textarea><div class="actions"><button id="save-draft">Save draft & notes</button><button id="sample-email">Sample email</button><button id="send-email" class="primary">Review &amp; send</button><button id="compose">Open in Gmail ↗</button></div><p class="small muted" style="margin-top:14px">${blocked?'This person is suppressed. Outreach is disabled.':'Emails send only after your confirmation. Mailbox updates reconcile messages sent here or directly in Gmail.'}</p></section>`;
 $('sample-email').onclick=()=>sampleEmail(p);$('send-email').onclick=()=>run(()=>sendEmail(p));
 $('save-draft').onclick=()=>run(()=>save({type:'contact',id:p.id,stage:$('stage').value,notes:$('notes').value,subject:$('subject').value,body:$('body').value}));
 $('generate').onclick=()=>run(async()=>{if(blocked)throw Error('This contact is suppressed.');if(!leaveDraft())return;if(!confirm('Generate one email draft using the selected AI provider? This uses API credits.'))return;const j=await api('/draft',{id:p.id,campaignId:master?(p.campaignId||p.campaignIds?.[0]):campaignId,confirm:true});$('subject').value=j.draft.subject;$('body').value=j.draft.body;notice('Draft ready for review. Press Save to keep it.');});
 const enrich=action=>run(async()=>{if(!leaveDraft())return;if(!confirm('Run this Hunter lookup? It may use Hunter credits.'))return;const j=await api('/hunter',{action,id:p.id,campaignId:master?(p.campaignId||p.campaignIds?.[0]):campaignId,confirm:true});state=j.state;render();notice('Hunter lookup complete.');});$('find-email').onclick=()=>enrich('find');$('verify-email').onclick=()=>enrich('verify');
 $('compose').onclick=()=>{if(blocked||$('stage').value==='suppressed')return notice('This contact is suppressed.',true);if(!p.email)return notice('Find an email first.',true);if(!['valid','accept_all'].includes(p.verification)&&!confirm('This address is not verified. Continue to your email app for review?'))return;window.open('https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(p.email)+'&su='+encodeURIComponent($('subject').value)+'&body='+encodeURIComponent($('body').value),'_blank','noopener,noreferrer');};
}
function addPerson(){if(!master&&!campaignId)return notice('Create a campaign first.',true);modal('Add prospect',['name','email','phone','company','domain','title','notes'].map(k=>field(k,k[0].toUpperCase()+k.slice(1))).join(''),data=>save({type:'import',campaignId:master?null:campaignId,contact:Object.fromEntries(data)}));}
function renderCompanies(){
 const query=$('search').value.toLowerCase(),byDomain=new Map();
 for(const c of state.companies.filter(c=>master||c.campaignId===campaignId))byDomain.set(c.domain||c.name,c);
 for(const p of contacts()){const key=p.domain||p.company;if(key&&!byDomain.has(key))byDomain.set(key,{name:p.company||p.domain,domain:p.domain,description:'From your campaign workbook'});}
 const companies=[...byDomain.values()].filter(c=>[c.name,c.domain].join(' ').toLowerCase().includes(query));
 $('content').innerHTML='<div class="metrics"></div>'+(!companies.length?'<div class="empty">Sync your workbook or find companies with Hunter.</div>':'');
 mountCollection(companies,document.querySelector('.metrics'),c=>`<article class="metric-row"><div class="row spread"><div><h3>${esc(c.name||c.domain)}</h3>${c.domain?`<a href="https://${esc(c.domain)}" target="_blank" rel="noopener noreferrer">${esc(c.domain)} ↗</a>`:''}<p class="muted small">${esc(c.description)}</p></div>${c.domain?`<button data-domain="${esc(c.domain)}">Find people</button>`:'<span class="small">Add a domain to discover people</span>'}</div></article>`);
}
function domainSearch(d){if(master)return notice('Choose a campaign before finding new people.',true);modal('Find people',field('domain','Company domain',d)+field('offset','Result offset (0 for first page)','0')+'<p class="muted small">Up to 25 contacts per lookup. Hunter credits may apply.</p>',async data=>{const j=await api('/hunter',{action:'domain',campaignId,domain:data.get('domain'),offset:Number(data.get('offset')),confirm:true});state=j.state;view='people';render();notice(`${j.result} new contacts imported.`);},'Find people');}
function renderResults(){const cards=state.campaigns.map(c=>{const p=state.contacts.filter(x=>member(x,c.id)),sent=p.filter(x=>['contacted','replied','meeting','closed'].includes(x.stage)).length,replies=p.filter(x=>['replied','meeting','closed'].includes(x.stage)).length;return `<article class="metric-row"><div class="row spread"><h3>${esc(c.name)}</h3><span class="badge">${esc(c.status)}</span></div><p class="muted" style="margin-top:9px">${sent} contacted · ${replies} replied · ${p.filter(x=>x.stage==='meeting').length} meetings · ${p.filter(x=>x.stage==='closed').length} closed</p><p class="small muted">${sent?Math.round(replies/sent*100)+'% recorded reply rate':'No recorded outreach yet'}</p></article>`;});$('content').innerHTML='<p class="muted small" style="margin-bottom:14px">Results combine recorded stages with synchronized contact activity. AI recommendations do not change booked or closed stages.</p><div class="metrics">'+cards.join('')+'</div>';}
export function parseCSV(value){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<value.length;i++){const c=value[i];if(c==='"'){if(quoted&&value[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('CSV has an unclosed quoted field.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
function exportCSV(){const rows=[['Priority',...SHEET_COLUMNS,'Next touch'],...(todo?priorityQueue(contacts()):contacts()).map(p=>{const i=priorityInfo(p);return [i.label,p.category,p.company,p.name,p.email,p.title,p.sheetData?.subject??p.subject,p.lastEmail,p.sheetStatus||p.stage,p.relevance,i.next];})];const safe=v=>'"'+(/^[=+@\-\t\r]/.test(String(v))?"'":'')+String(v??'').replace(/"/g,'""')+'"';const blob=new Blob([rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='maya-outbound.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function applySearch(){if($('search').value===appliedSearch)return;if(!leaveDraft()){$('search').value=appliedSearch;return;}visibleLimit=BATCH_SIZE;render();}
$('stage-filter').onchange=()=>{if(leaveDraft()){visibleLimit=BATCH_SIZE;render();}else $('stage-filter').value=appliedStage;};
$('new-campaign').onclick=()=>editCampaign();$('edit-campaign').onclick=()=>master?notice('Choose a campaign to edit.',true):editCampaign(campaign());$('search').onchange=applySearch;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(applySearch,180);};$('view-menu').onchange=e=>{if(!leaveDraft()){e.target.value=view;return;}view=e.target.value;visibleLimit=BATCH_SIZE;render();};
function openConnections(){modal('Connections',field('sheetId','Google Sheet URL or ID',state.settings.sheetId||'https://docs.google.com/spreadsheets/d/1G2zfqopOyZNHf78nuEeNdLgRY7ON0JTeegkhhZ4azyg/edit')+field('tab','Single-tab import (optional)',state.settings.tab)+field('business','Studio facts Maya may use in drafts',state.settings.business,'textarea')+'<p class="small muted" style="margin-top:14px">Share the sheet with your Cloud Run service account. Hunter credentials stay on the server; never paste a key here.</p>',async data=>{await save({type:'settings',...Object.fromEntries(data)});await syncWorkbook();});}
$('connections').onclick=openConnections;
$('import').onclick=()=>{if(!leaveDraft())return;if(master||!campaign())return notice('Choose a campaign first.',true);modal('Import prospects','<label>Source</label><select name="source"><option value="sheet">Connected Google Sheet</option><option value="csv">Paste CSV</option><option value="domain">Hunter company domain</option></select>'+field('csv','CSV with headers: Name, Email, Company, Domain, Title, Notes','','textarea')+field('domain','Company domain (Hunter only)')+'<p class="muted small">Sheet import reads up to 10,000 rows. Existing emails gain campaign membership without another prospect record. Hunter lookup may use credits.</p>',async data=>{let j;if(data.get('source')==='sheet')j=await api('/sheets',{campaignId});else if(data.get('source')==='domain')j=await api('/hunter',{action:'domain',domain:data.get('domain'),campaignId,confirm:true});else j=await api('/save',{type:'import',rows:parseCSV(data.get('csv')),campaignId});state=j.state;render();notice(`${j.result??0} new prospects imported.`);},'Import');};
$('discover').onclick=()=>{if(!leaveDraft())return;if(master||!campaign())return notice('Choose a campaign first.',true);modal('Discover companies',field('query','Describe your target companies',campaign()?.audience,'textarea')+field('offset','Result offset (0 for first page)','0'),async data=>{const j=await api('/hunter',{action:'discover',query:data.get('query'),offset:Number(data.get('offset')),campaignId});state=j.state;view='companies';render();notice(`${j.found} companies returned.`);},'Search Hunter');};
$('close-modal').onclick=$('cancel-modal').onclick=()=>$('modal').close();$('reload').onclick=()=>{if(leaveDraft())run(load);};
window.addEventListener('storage',e=>{if((e.key==='maya_admin_tok'||e.key===null)&&token()!==session){
 authEpoch++;session=token();clearWorkspace();notice(token()?'Loading your workspace...':'Sign in to Maya Admin first.');
 if(busy)reloadPending=true;else run(load);
}});
run(load);

$('research').onclick=()=>run(async()=>{
  const c=campaign();if(master||!c)throw Error('Choose a campaign first.');
  if(!confirm('Research this market from your saved campaign facts with Maya? This uses your daily AI allowance.'))return;
  notice('Maya is analyzing your saved audience and campaign facts…');
  const j=await api('/research',{campaignId:c.id,confirm:true});
  modal('Maya market research',field('competitors','Review research before saving',j.research,'textarea'),data=>save({type:'campaign',...c,competitors:data.get('competitors')}));
  notice('Brief ready. Review the suggestions before saving.');
});

async function syncWorkbook(){
 if(!leaveDraft())return;
 if(!state.settings.sheetId){openConnections();return;}
 notice('Reading the master Sheet and campaign tabs...');
 const j=await api('/sheets/sync',{});state=j.state;
 if(!campaignId)campaignId=state.campaigns.find(c=>c.sheetTab)?.id||state.campaigns[0]?.id||'';
 render();notice(j.result.map(r=>r.tab+': '+r.total+' prospects ('+r.added+' new)').join(' · '));
}
$('sync-sheet').onclick=$('sync-drawer').onclick=()=>run(syncWorkbook);
function closeDrawer(){if($('outbound-drawer').hidden)return;$('outbound-drawer').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false');$('menu-toggle').focus();}
$('menu-toggle').onclick=()=>{const open=$('outbound-drawer').hidden;$('outbound-drawer').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));};
$('close-drawer').onclick=closeDrawer;
document.addEventListener('click',e=>{if(!$('modal').open&&!$('outbound-drawer').hidden&&!$('outbound-drawer').contains(e.target)&&!$('menu-toggle').contains(e.target))closeDrawer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').open)closeDrawer();});
$('modal').addEventListener('click',e=>{const r=$('modal').getBoundingClientRect();if(e.target===$('modal')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))$('modal').close();});

// The same compact menu behavior: tabs, keyboard dismissal, and horizontal swipe.
for (const name of ['workspace','help']) {
 $('drawer-'+name+'-tab').onclick=()=>{
  for(const other of ['workspace','help']) {
   $('drawer-'+other).hidden=other!==name;
   $('drawer-'+other+'-tab').setAttribute('aria-selected',String(other===name));
  }
 };
}
let drawerTouch=null;
document.addEventListener('touchstart',e=>{const t=e.touches[0];drawerTouch={x:t.clientX,y:t.clientY};},{passive:true});
document.addEventListener('touchend',e=>{
 if(!drawerTouch)return;const t=e.changedTouches[0],dx=t.clientX-drawerTouch.x,dy=t.clientY-drawerTouch.y;
 if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*2){
  if(dx>0&&!$('outbound-drawer').hidden)closeDrawer();
  else if(dx<0&&drawerTouch.x>innerWidth-32&&$('outbound-drawer').hidden)$('menu-toggle').click();
 }drawerTouch=null;
},{passive:true});

$('master-list').onclick=()=>{if(!leaveDraft())return;master=true;todo=false;visibleLimit=BATCH_SIZE;view='people';render();};
$('todo-list').onclick=()=>{if(!leaveDraft())return;master=true;todo=true;visibleLimit=BATCH_SIZE;view='people';selected='';$('search').value='';$('stage-filter').value='';titleFilter='';render();};
function assignSegment(){const ids=[...document.querySelectorAll('[data-select]:checked')].map(el=>el.dataset.select);if(!ids.length)return notice('Select prospects first.',true);modal('Add to campaign','<label>Campaign</label><select name="campaignId">'+state.campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'</select>',async data=>{const result=await api('/segment',{ids,campaignId:data.get('campaignId')});state=result.state;render();});}
async function refreshIntelligence(){
 if(intelligenceLoading)return;intelligenceLoading=true;const epoch=authEpoch;
 try{
  const result=await api('/intelligence');intelligence={mailboxes:[],crm:{},...result};
  if(intelligence.crm.lastRunAt&&intelligence.crm.lastRunAt!==state.crm?.lastRunAt&&!hasUnsavedDraft()&&!busy){const fresh=await api();if(!hasUnsavedDraft()&&!busy){state=fresh.state;render();}}
  renderIntelligence();
 }catch(e){if(epoch===authEpoch)$('automation-status').textContent=e.message;}
 finally{intelligenceLoading=false;if(epoch!==authEpoch&&token()&&$('signin').hidden)refreshIntelligence();}
}
function renderIntelligence(){
 const crm=intelligence.crm||{},mailboxes=intelligence.mailboxes||[];
 $('mailboxes').innerHTML=mailboxes.map(m=>`<div class="mailbox-row"><span>${esc(m.email)}</span><button data-disconnect="${esc(m.id)}" aria-label="Disconnect ${esc(m.email)}">Disconnect</button></div>`).join('');
 document.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=()=>run(async()=>{if(!confirm('Disconnect this mailbox from Outbound?'))return;await api('/gmail/disconnect',{id:b.dataset.disconnect});await refreshIntelligence();}));
 $('connect-gmail').disabled=mailboxes.length>=2;const sender=$('mail-sender');if(sender){const previous=sender.value;sender.innerHTML=mailboxes.map(m=>`<option value="${esc(m.id)}">${esc(m.email)}</option>`).join('')||'<option value="">Connect Gmail in the menu</option>';if(mailboxes.some(m=>m.id===previous))sender.value=previous;}
 syncBusyControls();
 const scheduled=crm.lastScheduledRunAt;
 const schedule=!crm.enabled?'Hourly updates paused':!intelligence.schedulerReady?'Hourly updates requested · server scheduler setup needed':!scheduled?'Hourly updates enabled · awaiting first scheduled run':Date.now()-Date.parse(scheduled)>2*3600000?'Hourly updates overdue · check scheduler':'Hourly updates running';
 $('automation-status').textContent=schedule+(crm.lastRunAt?' · Last run '+new Date(crm.lastRunAt).toLocaleString():' · No update has run yet');
 const replyCount=state.contacts.filter(c=>c.stage==='replied').length,issues=crm.lastErrors?.length||0;
 $('outbound-brief').textContent=`${state.contacts.length.toLocaleString()} prospects · ${replyCount} replied · ${mailboxes.length} mailboxes connected · ${schedule}${issues?' · '+issues+' update issues':''}${crm.pending?' · Mailbox backfill continues next run':''}`;
}
$('connect-gmail').onclick=()=>run(async()=>{const j=await api('/gmail/connect',{});location.assign(j.url);});
$('sync-all').onclick=()=>run(async()=>{if(!leaveDraft())return;notice('Updating sheets, mail, calls and texts…');const j=await api('/sync',{});state=j.state;render();await refreshIntelligence();notice(j.skipped?'An update is already running.':j.errors?.length?j.errors.map(e=>e.source+': '+e.message).join(' · '):'Contact activity updated.',!!j.errors?.length);});
$('automation-settings').onclick=()=>modal('Hourly updates & spending',`<label><input type="checkbox" name="enabled" ${intelligence.crm?.enabled?'checked':''}> Update this CRM every hour</label><p class="small muted">Requires the server scheduler. Sheet and mailbox updates do not use AI credits. AI summaries and drafts share a $1 daily allowance across providers, resetting at midnight in Los Angeles.</p><label>AI provider</label><select name="aiProvider">${['auto','openai','anthropic','gemini'].map(p=>`<option value="${p}" ${intelligence.crm?.aiProvider===p?'selected':''}>${p==='auto'?'Lowest cost connected provider':p}</option>`).join('')}</select>${field('hunterDailyLimit','Hunter lookups per day (0 disables automatic discovery)',String(intelligence.crm?.hunterDailyLimit||0))}<p class="small muted">Hunter has its own credits, separate from the $1 AI limit. Each lookup finds up to 25 people from one saved company. Emails are never sent on a schedule.</p><p class="small muted">Workspace reference: ${esc(accountId||'Reload to obtain your workspace reference')}</p>`,async data=>{await api('/schedule',{enabled:data.has('enabled'),aiProvider:data.get('aiProvider'),hunterDailyLimit:Number(data.get('hunterDailyLimit'))});await refreshIntelligence();});
async function sendEmail(p){
 if(p.stage==='suppressed'||$('stage').value==='suppressed')throw Error('This contact is suppressed.');
 const mailboxId=$('mail-sender').value,subject=$('subject').value.trim(),body=$('body').value.trim(),notes=$('notes').value;
 if(!mailboxId)throw Error('Connect a Gmail mailbox in the menu first.');
 if(!subject||!body)throw Error('Add a subject and message.');
 if(/\{\{[^}]+\}\}/.test(subject+body))throw Error('Replace the template fields before sending.');
 const sender=intelligence.mailboxes.find(m=>m.id===mailboxId)?.email;
 if(!confirm(`Send this email now?\nFrom: ${sender}\nTo: ${p.email}\nSubject: ${subject}\n\n${body}`))return;
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([accountId,p.id,mailboxId,subject,body]))))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const key='maya-send-'+digest,requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,requestId);
 const j=await api('/send',{id:p.id,mailboxId,subject,body,requestId,confirm:true});
 if(j.state){state=j.state;const saved=await api('/save',{type:'contact',id:p.id,subject,body,notes});state=saved.state;render();}
 notice(j.delivery?.status==='sent'?'Email sent. Gmail activity is recorded.':'This send is '+j.delivery?.status+'. Check Gmail Sent before attempting another.',j.delivery?.status!=='sent');await refreshIntelligence();
}
function sampleEmail(p){
 modal('Personalize a sample',`<p class="small muted">Green: person · Blue: company · Yellow: your offer. Review every field before sending.</p><div class="template-person">${field('name','Person',p.name||'')}</div><div class="template-company">${field('company','Company',p.company||'')}</div><div class="template-offer">${field('offer','Your offer',campaign()?.objective||'')}</div><p class="template-preview">Hi <span class="template-person">{{name}}</span>,<br><br>I’m Fromsa at Mana Siyo. I’m reaching out about <span class="template-company">{{company}}</span>. <span class="template-offer">{{offer}}</span><br><br>Would this be useful to discuss?<br>If this isn’t relevant, let me know and I won’t follow up.<br><br>Fromsa<br>Mana Siyo</p>`,async data=>{const name=String(data.get('name')).trim(),company=String(data.get('company')).trim(),offer=String(data.get('offer')).trim();if(!name||!company||!offer)throw Error('Fill in the three highlighted fields.');$('subject').value='An idea for '+company;$('body').value=`Hi ${name},\n\nI’m Fromsa at Mana Siyo. I’m reaching out about ${company}. ${offer}\n\nWould this be useful to discuss?\nIf this isn’t relevant, let me know and I won’t follow up.\n\nFromsa\nMana Siyo`;notice('Sample added to your draft. Review before sending.');},'Use this draft');
}
function renderActivity(){
 const crm=intelligence.crm||{},ids=new Set(contacts().map(c=>c.id)),events=(crm.activity||[]).filter(e=>master||(e.contactIds||[]).some(id=>ids.has(id))).slice().reverse();
 $('content').innerHTML='<div class="crm-activity"></div>'+(events.length?'':'<p class="empty">No synchronized activity yet. Connect Gmail and update the CRM from the menu.</p>');mountCollection(events,document.querySelector('.crm-activity'),e=>`<article><strong>${esc(e.subject||e.kind)} · ${esc(e.direction==='in'?'Received':'Sent')}</strong><small>${esc(new Date(e.ts).toLocaleString())}</small><p>${esc(e.summary)}</p></article>`);
 const reviews=(crm.unmatched||[]).slice().reverse();if(reviews.length){const box=document.createElement('details');box.innerHTML='<summary>Review new correspondents ('+reviews.length+')</summary>'+reviews.map(e=>`<article class="review-correspondent"><strong>${esc(e.subject||'Email')}</strong><small>${esc(e.peers?.join(', '))}</small><button data-accept="${esc(e.id)}">Add as prospect</button></article>`).join('');$('content').append(box);box.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>{const e=reviews.find(e=>e.id===b.dataset.accept);modal('Add correspondent',field('name','Name')+'<label>Email</label><select name="email">'+e.peers.map(mail=>`<option>${esc(mail)}</option>`).join('')+'</select><label>Campaign</label><select name="campaignId">'+state.campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'</select>',async data=>{const j=await api('/accept-contact',{eventId:e.id,...Object.fromEntries(data)});state=j.state;await refreshIntelligence();render();});});}
}
setInterval(()=>{if(!document.hidden&&!busy&&token())refreshIntelligence();},60000);
