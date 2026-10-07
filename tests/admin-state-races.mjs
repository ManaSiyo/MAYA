import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const token=(sub,revision)=>'fixture.'+Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+3600,revision})).toString('base64url')+'.signature';
const a=token('owner-a',1),a2=token('owner-a',2),a3=token('owner-a',3),b=token('owner-b',1);
const leads=[{id:'lead-angela',name:'Angela Example',phone:'4155550101',email:'angela@example.test',quote:'200',note:'Reviewed note',stage:'new'},{id:'lead-bella',name:'Bella Example',phone:'+14155550102',quote:'300',note:'Other lead',stage:'new'},{id:'lead-no-phone',name:'No Phone',stage:'new'}];
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[],writes=[],requests=[],alerts=[],held=new Map(),pending=new Map();let feed=leads;
page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.dismiss();});
await page.addInitScript(()=>{
 window.setInterval=()=>0;
 if(window===window.top){localStorage.setItem('maya_mkt_cache',JSON.stringify({ts:Date.now(),d:{leads:{connected:true,list:[{id:'cached-secret',name:'Private cached client'}]}}}));
 localStorage.setItem('maya_admin_tok','present-but-invalid');}
 window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){}}}};
 window.fixtureMicCalls=0;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.fixtureMicCalls++;throw Error('No fixture microphone');}}});
});
const bodyFor=url=>({ok:true,connected:true,list:feed,leads:{connected:true,list:feed},threads:[],folders:[],total:0,items:[],notes:[],briefing:[],attention:[],ranges:{},accounts:{total:0},models:[],thread:{number:url.searchParams.get('number'),name:'',consent:'yes',messages:[],transcripts:[]}});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='maya.test')return route.abort();
 if(url.pathname.startsWith('/api/')){
  requests.push({path:url.pathname,auth:req.headers().authorization});
  if(req.method()==='POST')writes.push({path:url.pathname,body:req.postDataJSON(),auth:req.headers().authorization});
  if(held.get(url.pathname)){held.set(url.pathname,held.get(url.pathname)-1);const list=pending.get(url.pathname)||[];list.push(route);pending.set(url.pathname,list);return;}
  if(url.pathname==='/api/admin/messages/suggest')return route.fulfill({json:{ok:true,eligible:false,reason:'No suggestion'}});
  return route.fulfill({json:bodyFor(url)});
 }
 try{return route.fulfill({body:readFileSync(resolve(root,'.'+url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[extname(url.pathname)]||'application/octet-stream'});}catch{return route.abort();}
});
const hold=(path,count=1)=>held.set(path,count);
const take=async path=>{for(let i=0;i<100&&!pending.get(path)?.length;i++)await new Promise(r=>setTimeout(r,20));assert.ok(pending.get(path)?.length,'Request reached '+path);return pending.get(path).shift();};
const restore=async()=>{await page.evaluate(({a,leads})=>{_idTok=a;document.getElementById('adm-mkt').hidden=false;paintLeads({connected:true,list:leads});}, {a,leads});};
const waitText=(id,text)=>page.waitForFunction(({id,text})=>document.getElementById(id)?.textContent.includes(text),{id,text});
try{
 await page.goto('https://maya.test/backend/status.html');await page.waitForFunction(()=>typeof paintLeads==='function');
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#leads-table tbody').textContent(),'','Unverified token never paints persisted client data');
 assert.equal(await page.evaluate(()=>localStorage.getItem('maya_mkt_cache')),null);
 await restore();
 // Capture Angela, then reorder the actual table before Create. The submitted ID stays Angela.
 await page.evaluate(()=>leadInvoice(0));await page.evaluate(leads=>paintLeads({connected:true,list:[leads[1],leads[0],leads[2]]}),leads);
 hold('/api/admin/invoice-create');await page.locator('#inv-create').click();const creation=await take('/api/admin/invoice-create');
 assert.equal(writes.at(-1).body.leadId,'lead-angela');
 await creation.fulfill({json:{ok:true,url:'https://pay.example.test/angela',linkId:'invoice-a',saved:false,saveError:'Temporary storage failure',imageOk:true}});
 await waitText('inv-msg','not saved');assert.equal(await page.locator('#inv-create').isDisabled(),true);
 assert.equal(await page.locator('#inv-save').textContent(),'Retry saving this link');
 hold('/api/admin/lead-update');await page.locator('#inv-save').click();const save=await take('/api/admin/lead-update');assert.deepEqual(writes.at(-1).body,{id:'lead-angela',paylink:'https://pay.example.test/angela'});
 await save.fulfill({status:503,json:{error:'Storage unavailable'}});await waitText('inv-msg','not saved');
 assert.equal(await page.locator('#inv-link').inputValue(),'https://pay.example.test/angela');await page.locator('#inv-save').click();await waitText('inv-msg','Link saved');
 assert.equal(writes.filter(w=>w.path==='/api/admin/invoice-create').length,1,'Save retry never recreates a provider invoice');
 // Text opens the internal review composer and keeps the text already written.
 await page.evaluate(()=>_closeInvoiceModal());await page.evaluate(()=>{document.getElementById('maya-confirmation').close();toggleDrawer(true);admTab('messages');return openThread('+14155550101','Angela Example');});await page.locator('#msg-input').fill('Existing draft');
 await page.evaluate(()=>leadInvoice(1));const beforeText=writes.length;await page.locator('#inv-text').click();await waitText('msg-feedback','Invoice link added');
 assert.equal(await page.locator('#msg-input').inputValue(),'Existing draft\nHi Angela, your Mana Siyo pay link: https://pay.example.test/angela');
 assert.equal(writes.length,beforeText,'Invoice Text never invokes a sending provider');
 assert.equal(context.pages().length,1,'Invoice Text stays in the Admin drawer');
 // Late creation cannot repaint a different dialog. Reopening recovers the first result.
 await page.evaluate(()=>leadInvoice(0));hold('/api/admin/invoice-create');await page.evaluate(()=>{window.invoicePending=_createInvoiceNow();});const late=await take('/api/admin/invoice-create');
 await page.evaluate(()=>{_closeInvoiceModal();leadInvoice(1);});
 await late.fulfill({json:{ok:true,url:'https://pay.example.test/bella',linkId:'invoice-b',saved:false,imageOk:true}});
 await page.evaluate(()=>invoicePending);assert.equal(await page.locator('#inv-link').inputValue(),'https://pay.example.test/angela');
 await page.evaluate(()=>{_closeInvoiceModal();leadInvoice(0);});assert.equal(await page.locator('#inv-link').inputValue(),'https://pay.example.test/bella');assert.equal(await page.locator('#inv-create').isDisabled(),true);
 await page.evaluate(()=>_closeInvoiceModal());
 // A real missing phone error lives outside the hidden thread.
 await page.evaluate(()=>leadOpenThread(2));assert.equal(await page.locator('#msg-list-feedback').isVisible(),true);assert.match(await page.locator('#msg-list-feedback').textContent(),/No phone number recorded for No Phone/);
 // Same-sub token refresh preserves a failed send's request ID, composer, note editor and approval queue.
 await page.evaluate(()=>{document.getElementById('maya-confirmation').close();toggleDrawer(true);admTab('messages');return openThread('+14155550101','Angela Example');});await page.locator('#msg-input').fill('Reviewed retry text');
 hold('/api/admin/messages/send');await page.evaluate(()=>{void msgSend();});const firstSend=await take('/api/admin/messages/send');const firstId=writes.at(-1).body.requestId;
 await firstSend.abort();await waitText('msg-feedback','Failed to fetch');
 await page.evaluate(()=>editLatestLeadNote(1));await page.locator('#lead-note-input').fill('Keep this note draft');
 const approval=await page.evaluate(()=>_mayaQueueAction({kind:'add_lead',lead:{name:'Pending owner lead'}}));
 await page.evaluate(a2=>_adoptToken(a2),a2);
 assert.equal(await page.locator('#lead-note-input').inputValue(),'Keep this note draft');assert.equal(await page.locator('#msg-input').inputValue(),'Reviewed retry text');
 assert.equal(await page.evaluate(()=>_mayaActions.length),1);
 await page.evaluate(()=>mayaDismissAction(_mayaActions[0].id));
 await page.locator('#lead-note-save').click();await page.locator('#lead-note-editor').waitFor({state:'detached'});assert.equal(writes.at(-1).auth,'Bearer '+a2,'Note save uses renewed authorization');
 hold('/api/admin/messages/send');await page.evaluate(()=>{void msgSend();});const secondSend=await take('/api/admin/messages/send');assert.equal(writes.at(-1).body.requestId,firstId);
 // Renew again during acceptance: a successful send clears only the reviewed draft.
 await page.evaluate(a3=>_adoptToken(a3),a3);await secondSend.fulfill({json:{ok:true}});await waitText('msg-feedback','Accepted by carrier');assert.equal(await page.locator('#msg-input').inputValue(),'');
 // A queued action's disabled state is data, so another action/re-render cannot submit twice.
 const q=await page.evaluate(()=>_mayaQueueAction({kind:'add_lead',lead:{name:'Exactly once'}}));
 hold('/api/admin/lead-add');await page.evaluate(id=>{void mayaConfirmAction(id);},q.actionId);const add=await take('/api/admin/lead-add');const requestId=writes.at(-1).body.requestId;
 await page.evaluate(()=>_mayaQueueAction({kind:'remember',text:'Another pending action'}));
 assert.equal(await page.locator('[data-action-id="'+q.actionId+'"] .confirm').isDisabled(),true);
 const addCount=writes.filter(w=>w.path==='/api/admin/lead-add').length;await page.evaluate(id=>mayaConfirmAction(id),q.actionId);assert.equal(writes.filter(w=>w.path==='/api/admin/lead-add').length,addCount);
 await add.abort();await waitText('maya-action-queue','Result unconfirmed');assert.equal(await page.locator('[data-action-id="'+q.actionId+'"] .confirm').textContent(),'Check result');
 hold('/api/admin/lead-add');await page.evaluate(id=>{void mayaConfirmAction(id);},q.actionId);const retry=await take('/api/admin/lead-add');assert.equal(writes.at(-1).body.requestId,requestId,'Uncertain add rechecks with its original durable request ID');
 await retry.fulfill({json:{ok:true,lead:{id:'created-once'}}});await page.waitForFunction(id=>!_mayaActions.some(x=>x.id===id),q.actionId);
 // Non-idempotent approvals remain uncertain, never reopened as a fresh Confirm.
 const uncertain=await page.evaluate(()=>_mayaQueueAction({kind:'remember',text:'Potentially saved'}));hold('/api/admin/maya-remember');await page.evaluate(id=>{void mayaConfirmAction(id);},uncertain.actionId);const memory=await take('/api/admin/maya-remember');await memory.abort();await waitText('maya-action-queue','this action will not be repeated');assert.equal(await page.locator('[data-action-id="'+uncertain.actionId+'"] .confirm').isDisabled(),true);
 // Sign-in to another account clears approvals/drafts/notes/invoices and rejects old voice callbacks.
 await page.evaluate(()=>{_mayaChatAdd('maya','Private previous conversation');window.oldVoiceMessage=_voiceOnMessage({send(){throw Error('Old voice must not send');}});});
 await page.evaluate(()=>{document.getElementById('maya-confirmation').close();toggleDrawer(true);admTab('messages');return openThread('+14155550101','Angela Example');});await page.locator('#msg-input').fill('Private owner A draft');
 hold('/api/admin/voice-token');await page.evaluate(()=>{void toggleMayaVoice();});const voiceToken=await take('/api/admin/voice-token');
 hold('/api/admin/marketing',2);await page.evaluate(()=>{void loadMkt();});const oldMkt=await take('/api/admin/marketing');
 await page.evaluate(b=>_adoptToken(b),b);const newMkt=await take('/api/admin/marketing');
 assert.equal(await page.evaluate(()=>_mayaActions.length),0);assert.equal(await page.locator('#msg-input').inputValue(),'');assert.equal(await page.locator('#adm-mkt').isVisible(),false);
 await page.evaluate(()=>oldVoiceMessage({data:JSON.stringify({type:'response.audio_transcript.done',transcript:'Late private transcript'})}));assert.equal(await page.locator('#maya-chat').textContent(),'');
 await voiceToken.fulfill({json:{value:'not-a-real-provider-key',model:'fixture'}});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>fixtureMicCalls),0,'Session switch cancels voice before microphone access');
 await newMkt.fulfill({json:{ok:true,leads:{connected:true,list:[{id:'b-only',name:'Owner B client',stage:'new'}]}}});await page.getByText('Owner B client',{exact:true}).waitFor();
 await oldMkt.fulfill({status:401,json:{error:'expired'}});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>_idTok),b,'Old 401 never signs out the newer account');assert.equal(await page.locator('#leads-table tbody').textContent().then(t=>t.includes('Owner B client')),true);
 // Two same-account refreshes resolve out of order; only the newest paints.
 hold('/api/admin/marketing',2);await page.evaluate(()=>{void loadMkt();void loadMkt();});const older=await take('/api/admin/marketing'),newer=await take('/api/admin/marketing');
 await newer.fulfill({json:{ok:true,leads:{connected:true,list:[{id:'new',name:'Newest verified data'}]}}});await page.getByText('Newest verified data',{exact:true}).waitFor();
 await older.fulfill({json:{ok:true,leads:{connected:true,list:[{id:'old',name:'Stale private data'}]}}});await page.waitForTimeout(30);assert.equal(await page.getByText('Stale private data',{exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('maya_mkt_cache')),null);
 // Pending reads, lookup and provider creation belong to the session that started them.
 for(const path of ['/api/admin/submissions','/api/admin/analytics','/api/admin/maya-features','/api/admin/command-snapshot','/api/admin/lead-lookup','/api/admin/invoice-create'])hold(path);
 await page.evaluate(()=>{
   window.oldSubmissions=loadSubmissions();window.oldTraffic=loadTraffic();window.oldFeatures=loadFeatureRequests();window.oldCommand=loadMayaCommand();
   window.oldLookup=_mayaQueueLeadAction('Previous account lead','delete_lead');
   leadInvoice(0);document.getElementById('inv-price').value='100';window.oldInvoice=_createInvoiceNow();
 });
 const sub=await take('/api/admin/submissions'),traffic=await take('/api/admin/analytics'),features=await take('/api/admin/maya-features'),command=await take('/api/admin/command-snapshot'),lookup=await take('/api/admin/lead-lookup'),invoice=await take('/api/admin/invoice-create');
 await page.evaluate(a=>_adoptToken(a),a);
 await Promise.all([
  sub.fulfill({json:{ok:true,total:99,folders:[{id:'private-old',name:'Previous private submission',createdTime:new Date().toISOString(),files:[]}]}}),
  traffic.fulfill({json:{ok:true,accounts:{total:987654},ranges:{},live:987654}}),
  features.fulfill({json:{ok:true,items:[{who:'Previous owner',text:'Previous private feature'}]}}),
  command.fulfill({json:{ok:true,briefing:['Previous private briefing'],attention:[]}}),
  lookup.fulfill({json:{ok:true,lead:{id:'old-private',name:'Previous private lead'}}}),
  invoice.fulfill({json:{ok:true,url:'https://pay.example.test/previous-private',saved:true,imageOk:true}})
 ]);
 await page.evaluate(()=>Promise.all([oldSubmissions,oldTraffic,oldFeatures,oldCommand,oldLookup,oldInvoice]));
 assert.equal(await page.locator('#lead-inv-modal').count(),0,'An old invoice cannot reopen private UI after sign-in changes');
 assert.equal(await page.evaluate(()=>_mayaActions.length),0,'A lookup from an old voice session cannot queue a fresh-account approval');
 assert.equal(await page.getByText('Previous private submission',{exact:true}).count(),0);
 assert.equal(await page.getByText('Previous private feature',{exact:true}).count(),0);
 assert.doesNotMatch(await page.locator('#maya-command-brief').textContent(),/Previous private/);
 assert.doesNotMatch(await page.locator('#head-tiles').textContent(),/987654/);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.MAYA_ADMIN_DATA).includes('Previous private')),false);
 // Status writes may finish in another account, but may not refresh or alert that account.
 await page.getByText('Angela Example',{exact:true}).first().waitFor();
 hold('/api/admin/lead-update');await page.evaluate(()=>{const select=document.querySelector('#lead-tr-0 .lead-stage');select.value='completed';window.staleStage=setLeadStage(0,select);});const oldStage=await take('/api/admin/lead-update');
 assert.equal(writes.at(-1).auth,'Bearer '+a);assert.equal(writes.at(-1).body.id,'lead-angela');
 hold('/api/admin/marketing');await page.evaluate(b=>_adoptToken(b),b);const currentFeed=await take('/api/admin/marketing');
 const readsBefore=requests.filter(r=>r.path==='/api/admin/marketing').length;
 await oldStage.fulfill({json:{ok:true}});await page.evaluate(()=>staleStage);
 assert.equal(requests.filter(r=>r.path==='/api/admin/marketing').length,readsBefore,'Old status success cannot invalidate the new account feed');
 await currentFeed.fulfill({json:{ok:true,leads:{connected:true,list:leads}}});await page.getByText('Angela Example',{exact:true}).first().waitFor();
 hold('/api/admin/lead-update');await page.evaluate(()=>{const select=document.querySelector('#lead-tr-0 .lead-stage');select.value='completed';window.failedStage=setLeadStage(0,select);});const failedStage=await take('/api/admin/lead-update');
 await page.evaluate(a=>_adoptToken(a),a);await failedStage.fulfill({status:503,json:{error:'Previous account save failed'}});await page.evaluate(()=>failedStage);assert.deepEqual(alerts,[],'An old status error never alerts the new account');
 await page.getByText('Angela Example',{exact:true}).first().waitFor();
 // Retained legacy editable-cell handler resolves IDs, never a stale row index.
 await page.evaluate(leads=>{paintLeads({connected:true,list:[leads[1],leads[0],leads[2]]});window.legacyCell=document.createElement('span');Object.assign(legacyCell.dataset,{id:'lead-angela',idx:'0',field:'note',orig:'Before'});legacyCell.textContent='Append to Angela';},leads);
 hold('/api/admin/lead-note');await page.evaluate(()=>{window.legacyNote=saveLeadField(legacyCell);});const legacyNote=await take('/api/admin/lead-note');assert.equal(writes.at(-1).body.email,'angela@example.test');await legacyNote.fulfill({json:{ok:true}});await page.evaluate(()=>legacyNote);
 // Rejected legacy field edits must not change any in-memory recipient details.
 await page.evaluate(()=>{Object.assign(legacyCell.dataset,{field:'name',orig:'Angela Example'});legacyCell.textContent='Unconfirmed name';});
 hold('/api/admin/lead-update');await page.evaluate(()=>{window.legacyField=saveLeadField(legacyCell);});const rejectedField=await take('/api/admin/lead-update');await rejectedField.fulfill({status:503,json:{error:'Save unavailable'}});await page.evaluate(()=>legacyField);
 await page.evaluate(()=>leadInvoice(0));assert.match(await page.locator('#inv-title').textContent(),/Bella Example/);await page.evaluate(()=>{_closeInvoiceModal();leadInvoice(1);});assert.match(await page.locator('#inv-title').textContent(),/Angela Example/);await page.evaluate(()=>_closeInvoiceModal());
 assert.equal(await page.evaluate(()=>legacyCell.dataset.orig),'Angela Example');
 // A late legacy success cannot mark a stale editor saved after an account change.
 hold('/api/admin/lead-update');await page.evaluate(()=>{legacyCell.className='';window.oldField=saveLeadField(legacyCell);});const oldField=await take('/api/admin/lead-update');await page.evaluate(b=>_adoptToken(b),b);await oldField.fulfill({json:{ok:true}});await page.evaluate(()=>oldField);assert.equal(await page.evaluate(()=>legacyCell.classList.contains('lead-saved')),false);assert.equal(await page.evaluate(()=>legacyCell.dataset.orig),'Angela Example');
 assert.deepEqual(errors,[]);
 console.log('Admin state races passed: invoice identity/recovery/save-only retry, reviewed internal drafts, session renewal/isolation, durable approval retry, duplicate guards, stale Marketing and cancelled voice startup. Fake providers only.');
}finally{await browser.close();}
