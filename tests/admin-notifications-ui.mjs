import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {validDesign} from '../docs/server/design-config.mjs';

// Every HTTP request is intercepted. This fixture uses a fresh bundled Chromium
// context, fake owner identities and an in-memory notification store only.
const root=resolve(new URL('../',import.meta.url).pathname),origin='https://maya-notifications.test';
const token=subject=>'fixture.'+Buffer.from(JSON.stringify({sub:subject,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const ownerA=token('notifications-owner-a'),ownerB=token('notifications-owner-b');
const subject=authorization=>{
 const value=String(authorization||'').replace(/^Bearer /,'');
 assert.ok([ownerA,ownerB].includes(value),'Notifications use the current authenticated fixture owner');
 return value===ownerA?'owner-a':'owner-b';
};
const widths=[320,390,768,1024,1440,1920],notes=['ads-connection-status','mkt-status','leads-note','callback-alert-note','bl-note','mkt-wix-note'];
const store=new Map([['owner-a',[]],['owner-b',[{id:'b-private',source:'google_ads',code:'connected',text:'Owner B notification history',severity:'info',ts:'2026-11-03T20:00:00Z'}]]]);
const states=new Map([['owner-a',new Map()],['owner-b',new Map([['google_ads','connected']])]]);
const requests=[],writes=[],designWrites=[],pageErrors=[],held=new Set();
let savedDesign={},failRead=false,failWrite=false,holdNext=null,notificationSequence=0;
const entry=(source,code)=>({id:'notification-'+(++notificationSequence),source,code,text:({'google_ads':'Google Ads','meta_ads':'Meta Ads','chatgpt_ads':'ChatGPT Ads'}[source]||source)+' — '+code.replaceAll('_',' '),severity:code==='connected'?'info':'warning',ts:new Date(Date.UTC(2026,10,3,20,notificationSequence)).toISOString()});
function persist(owner,body){
 const items=store.get(owner),last=states.get(owner);
 for(const item of body.items){if(last.get(item.source)===item.code)continue;last.set(item.source,item.code);items.unshift(entry(item.source,item.code));}
 return structuredClone(items);
}
const readyReport=()=>({ok:true,googleAds:{connected:true},meta:{connected:false,code:'not_configured'},chatgptAds:{connected:true},adCombined:{campaignDaily:[],campaigns:[],excludedSources:[]},leads:{connected:true,list:[]},warnings:[]});
let marketing=readyReport();
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
context.on('page',opened=>opened.on('pageerror',error=>pageErrors.push(error.message)));
page.on('pageerror',error=>pageErrors.push(error.message));
await context.addInitScript(()=>{
 window.setInterval=()=>0;
 window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){},cancel(){},disableAutoSelect(){}}}};
});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==origin)return route.abort();
 const path=url.pathname,method=request.method(),authorization=request.headers().authorization;
 if(path.startsWith('/api/')){
  requests.push({path,method,authorization});
  if(path==='/api/design')return route.fulfill({json:savedDesign});
  if(path==='/api/admin/design'&&method==='POST'){
   const body=request.postDataJSON();assert.ok(validDesign(body),'The real shared design Save sends a valid configuration');assert.equal(authorization,'Bearer '+ownerB);savedDesign=structuredClone(body);designWrites.push(body);
   return route.fulfill({json:{ok:true,savedAt:'2026-11-03T20:00:00Z'}});
  }
  if(path==='/api/admin/notifications'){
   const owner=subject(authorization),body=method==='POST'?request.postDataJSON():null;
   if(method==='POST'){
    assert.deepEqual(Object.keys(body),['items'],'Only the fixed notification envelope is written');assert.ok(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=16,'Notification writes are bounded');
    for(const item of body.items){assert.deepEqual(Object.keys(item).sort(),['code','source'],'Only source and code can be stored by the browser');assert.equal(typeof item.source,'string');assert.equal(typeof item.code,'string');}
    writes.push({owner,body:structuredClone(body)});
   }else assert.equal(method,'GET','Notification history has no destructive browser action');
   if(holdNext&&holdNext.owner===owner&&holdNext.method===method){held.add({route,owner,method,body});holdNext=null;return;}
   if((method==='GET'&&failRead)||(method==='POST'&&failWrite))return route.fulfill({status:503,json:{ok:false,error:'Notification history unavailable.'}});
   return route.fulfill({json:{ok:true,items:method==='POST'?persist(owner,body):structuredClone(store.get(owner))}});
  }
  if(path==='/api/admin/marketing-brief'&&method==='POST')return route.fulfill({json:{ok:true,headline:'Fixture marketing summary'}});
  // No campaigns, communications, provider requests, or real account writes.
  assert.equal(method,'GET','Unexpected mutation outside notification/design Save: '+path);
  if(path==='/api/healthz')return route.fulfill({json:{ok:true,commit:'fixture',configured:{openai:true,submissions:true,googleAds:true,chatgptAds:true,metaAds:false}}});
  if(path==='/api/admin/marketing')return route.fulfill({json:marketing});
  if(path==='/api/admin/maya-features')return route.fulfill({json:{ok:true,items:[{id:'log-fixture',who:'Owner',text:'A saved request in diagnostic logs',source:'admin',state:'saved',ts:'2026-11-03T19:00:00Z'}]}});
  if(path==='/api/admin/design-history')return route.fulfill({json:{ok:true,items:[]}});
  if(path==='/api/admin/command-snapshot')return route.fulfill({json:{ok:true,briefing:[],attention:[]}});
  return route.fulfill({json:{ok:true,connected:true,items:[],threads:[],folders:[],accounts:{total:0},ranges:{},live:0,models:{}}});
 }
 const aliases={'/status.html':'/backend/status.html','/':'/frontend/index.html'};
 const pathOnDisk=resolve(root,'.'+(aliases[path]||decodeURIComponent(path)));
 if(!pathOnDisk.startsWith(root+'/'))return route.abort();
 try{return route.fulfill({body:readFileSync(pathOnDisk),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(pathOnDisk)]||'application/octet-stream'});}catch{return route.abort();}
});
const waitFor=async(predicate,message)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail(message);};
const nextHeld=async()=>{await waitFor(()=>held.size>0,'The held notification request was not issued');return [...held][0];};
const release=async(item,items)=>{held.delete(item);return item.route.fulfill({json:{ok:true,items:items|| (item.method==='POST'?persist(item.owner,item.body):structuredClone(store.get(item.owner)))}});};
const setOwner=async(value)=>page.evaluate(value=>{_idTok=value;++_adminSession;window.dispatchEvent(new Event('maya-owner-session-changed'));},value);
const openNotifications=async()=>{await page.evaluate(()=>{toggleDrawer(true);admTab('logs');});await page.evaluate(()=>MayaAdminNotifications.load());};
const paint=async(report)=>{marketing=report;await page.evaluate(()=>loadMkt());await page.evaluate(()=>MayaAdminNotifications.load());};
const feedback=()=>page.locator('#notifications-feedback').textContent();
const assertNoPrivateLeak=()=>{
 const body=JSON.stringify(writes);
 for(const value of ['raw-provider-token-sentinel','customer-private-id','account-private-id','Raw provider failure'])assert.ok(!body.includes(value),'Notification request excludes '+value);
};
const screenshot=async(label)=>{
 const prefix=process.env.MAYA_ADMIN_NOTIFICATIONS_SCREENSHOT;if(!prefix)return;
 await page.screenshot({path:prefix.replace(/\.png$/,'')+'-'+label+'.png'});
};
const shape=async(selector,properties)=>page.locator(selector).first().evaluate((element,properties)=>{const style=getComputedStyle(element);return Object.fromEntries(properties.map(property=>[property,style[property]]));},properties);
const styleTargets={H3:'#drawer-logs [data-maya-type="H3"]',P1:'#notifications-feedback',P3:'#drawer-logs [data-maya-type="P3"]',glass:'#drawer-logs :is([data-maya-pill],.maya-pill)',inner:'#admin-notification-list [data-maya-panel="inner"]'};
async function checkStyles(label){
 const headings=page.locator('h2.grp');assert.equal(await headings.count(),7,'All seven main Admin headings are audited');
 for(const heading of await headings.all()){assert.equal(await heading.getAttribute('data-maya-type'),'H3','Dashboard section headings declare the shared H3 role');const style=await heading.evaluate(element=>{const value=getComputedStyle(element);return {font:value.fontFamily,size:value.fontSize,weight:value.fontWeight};});assert.match(style.font,label==='saved'?/Cormorant/:/Jost/,'Dashboard headings use one saved font');assert.equal(style.size,label==='saved'?'18px':'16px');assert.equal(style.weight,label==='saved'?'500':'400');}
 for(const [role,selector] of Object.entries(styleTargets))assert.ok(await page.locator(selector).count(),role+' has a real governed notification control');
 for(const role of ['H3','P1','P3']){
  const actual=await shape(styleTargets[role],['fontFamily','fontSize','fontWeight']);
  assert.match(actual.fontFamily,label==='saved'?/Cormorant/:/Jost/,label+' '+role+' uses its shared font');
  assert.equal(actual.fontSize,({default:{H3:'16px',P1:'12px',P3:'10px'},saved:{H3:'18px',P1:'16px',P3:'12px'}})[label][role],label+' '+role+' saved size');
  assert.equal(actual.fontWeight,label==='saved'?'500':role==='H3'?'400':'300');
 }
 const glass=await shape(styleTargets.glass,['paddingLeft','paddingTop','backgroundColor','backdropFilter']);
 assert.equal(glass.paddingLeft,label==='saved'?'22px':'14px');assert.equal(glass.paddingTop,label==='saved'?'12px':'6px');assert.equal(glass.backgroundColor,label==='saved'?'rgba(3, 15, 29, 0.55)':'rgba(3, 15, 29, 0.18)');
 const inner=await shape(styleTargets.inner,['paddingLeft','paddingTop','backgroundColor']);
 assert.equal(inner.paddingLeft,label==='saved'?'23px':'16px');assert.equal(inner.paddingTop,label==='saved'?'17px':'12px');assert.equal(inner.backgroundColor,label==='saved'?'rgba(23, 91, 59, 0.65)':'rgba(0, 0, 0, 0.18)');
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>{toggleDrawer(true);document.getElementById('drawer-logs').scrollTop=0;});
  await page.waitForFunction(()=>{const scroll=document.getElementById('adm-hscroll'),drawer=document.getElementById('drawer').getBoundingClientRect();return Math.abs(scroll.scrollLeft-(scroll.scrollWidth-scroll.clientWidth))<1&&document.body.classList.contains('drawer-open')&&drawer.left>=0&&drawer.right<=innerWidth+1;});
  assert.ok(await page.locator('#drawer-logs').evaluate(element=>element.scrollWidth<=element.clientWidth+1),label+' notifications fit '+width);
  assert.ok(await page.locator('#adm-tabrow').evaluate(element=>element.scrollWidth<=element.clientWidth+1),label+' drawer header fits '+width);
  assert.equal(await page.locator('#adm-tabrow>button[role=tab]').count(),3,label+' retains all three tab controls '+width);
  assert.equal(await page.locator('#voice-dock').isVisible(),true,label+' voice dock stays visible '+width);
  for(const id of ['adm-tab-messages','adm-tab-logs','adm-tab-systems','adm-tabtitle','voice-btn','maya-toggle']){
   assert.equal(await page.locator('#'+id).isVisible(),true,label+' '+id+' remains visible '+width);
   const painted=await page.locator('#'+id).evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const rect=element.id==='adm-tabtitle'?range.getBoundingClientRect():element.getBoundingClientRect();const points=element.id==='adm-tabtitle'?[.1,.5,.9]:[.5];return points.map(fraction=>{const x=rect.left+rect.width*fraction,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);return {visible:x>=0&&x<=innerWidth&&y>=0&&y<=innerHeight&&!!hit&&(hit===element||element.contains(hit)),hit:hit?.id||hit?.tagName};});});
   assert.ok(painted.every(point=>point.visible),label+' '+id+' is painted and reachable '+width+' '+JSON.stringify(painted));
  }
  for(const article of await page.locator(styleTargets.inner).all())assert.ok(await article.evaluate(element=>element.scrollWidth<=element.clientWidth+1),label+' stored text wraps '+width);
  for(const node of await page.locator('#drawer-logs>details>summary').all())assert.ok(await node.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.left>=0&&rect.right<=innerWidth+1;}),label+' disclosure summary fits '+width);
  if(process.env.MAYA_ADMIN_NOTIFICATIONS_METRICS&&label==='saved'&&[320,390].includes(width))console.log(JSON.stringify({label,width,controls:await page.evaluate(()=>Object.fromEntries(['adm-tab-messages','adm-tab-logs','adm-tab-systems','voice-btn','maya-toggle'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return [id,{left:r.left,top:r.top,width:r.width,height:r.height,opacity:s.opacity,visibility:s.visibility,display:s.display,painted:!!hit&&(hit===e||e.contains(hit))}]})))}));
  if(width===1440||width===390)await screenshot(label+'-'+(width===1440?'desktop':'phone'));
 }
}
try{
 await page.goto(origin+'/status.html');
 await page.waitForFunction(()=>typeof admTab==='function'&&window.MayaTypographyControls);
 assert.equal(await page.locator('#adm-tab-logs').getAttribute('aria-label'),'Notifications','The compatible logs tab presents Notifications');
 assert.ok(await page.evaluate(()=>!!window.MayaAdminNotifications),'Notification history exposes its bounded session controller');
 await page.evaluate(()=>MayaTypographyControls.ready);
 await setOwner(ownerA);await openNotifications();
 assert.equal(await page.locator('#drawer-logs').isVisible(),true);assert.equal(await page.locator('#admin-notification-list').isVisible(),true);
 assert.equal(await page.locator('#notifications-feedback').getAttribute('data-maya-type'),'P1');assert.equal(await page.locator('#notifications-feedback').getAttribute('role'),'status');
 for(const selector of ['#notification-current','#maya-logs-disclosure'])assert.equal(await page.locator(selector).evaluate(element=>element.open),false,selector+' starts collapsed');
 for(const id of notes){
  assert.equal(await page.locator('#notification-current #'+id).count(),1,id+' has moved into current notification details');
  assert.equal(await page.locator('#adm-mkt #'+id).count(),0,id+' is absent from the exposed dashboard');
 }
 for(const id of ['maya-logs-list','drawer-command'])assert.equal(await page.locator('#maya-logs-disclosure #'+id).count(),1,id+' remains inside the diagnostic log disclosure');
 const failing=readyReport();Object.assign(failing.googleAds,{connected:false,code:'oauth_expired',why:'Raw provider failure raw-provider-token-sentinel',customer:'customer-private-id'});failing.accountId='account-private-id';
 await paint(failing);
 assert.ok(store.get('owner-a').some(item=>item.source==='google_ads'&&item.code==='oauth_expired'),'Provider failure is stored in account-bound history');
 assert.ok(store.get('owner-a').some(item=>item.source==='chatgpt_ads'&&item.code==='connected'),'Independent connected providers are retained');
 assert.match(await page.locator('#admin-notification-list').innerText(),/Google Ads.*oauth expired/);
 assert.equal(await page.locator('#ads-connection-status').isVisible(),false,'Current connection diagnostics stay collapsed');
 assertNoPrivateLeak();
 const writesBeforePoll=writes.length;await paint(failing);await paint(failing);assert.equal(writes.length,writesBeforePoll,'Identical polling does not write duplicate notifications');
 const leadFailure=structuredClone(failing);leadFailure.leads={connected:false,why:'Fixture lead feed unavailable.'};await paint(leadFailure);
 assert.equal(states.get('owner-a').get('leads'),'unavailable','A fresh failed lead feed records unavailable');
 const leadHistoryCount=store.get('owner-a').length,leadWarning=await page.locator('#leads-note').textContent();assert.ok(leadWarning.length>0,'A failed lead feed has current diagnostic text');
 await page.evaluate(()=>paintLeads({connected:true,list:[]}));await page.evaluate(()=>MayaAdminNotifications.load());
 assert.equal(states.get('owner-a').get('leads'),'unavailable','A local filter/column/notes repaint cannot claim provider recovery');assert.equal(store.get('owner-a').length,leadHistoryCount,'A presentation-only repaint does not store another notification');assert.equal(await page.locator('#leads-note').textContent(),leadWarning,'A local repaint retains the real feed warning');
 await page.locator('#notification-current>summary').click();assert.equal(await page.locator('#ads-connection-status').isVisible(),true);await page.locator('#notification-current>summary').click();
 await page.locator('#maya-logs-disclosure>summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#maya-logs-disclosure').evaluate(element=>element.open),true,'Keyboard opens diagnostic logs');
 await page.locator('#maya-logs-disclosure>summary').press('Enter');assert.equal(await page.locator('#maya-logs-disclosure').evaluate(element=>element.open),false,'Keyboard closes diagnostic logs');
 await page.evaluate(()=>admTab('messages'));assert.equal(await page.locator('#drawer-messages').isVisible(),true);assert.equal(await page.locator('#drawer-logs').isVisible(),false,'Messages keeps its own workspace');
 await openNotifications();assert.equal(await page.locator('#drawer-messages').isVisible(),false);assert.equal(await page.locator('#maya-logs-disclosure').evaluate(element=>element.open),false);
 await paint(readyReport());
 assert.equal(states.get('owner-a').get('leads'),'healthy','Only a subsequent real Marketing snapshot recovers the lead feed');assert.equal(await page.locator('#leads-note').textContent(),'','A successful fresh feed clears its old warning');
 const aHistory=store.get('owner-a');assert.ok(aHistory.some(item=>item.source==='google_ads'&&item.code==='connected'));assert.ok(aHistory.some(item=>item.source==='google_ads'&&item.code==='oauth_expired'),'Recovery does not erase the earlier problem');
 await page.reload();await page.waitForFunction(()=>window.MayaAdminNotifications&&window.MayaTypographyControls);await page.evaluate(()=>MayaTypographyControls.ready);await setOwner(ownerA);await openNotifications();
 const historyText=await page.locator('#admin-notification-list').innerText();assert.match(historyText,/oauth expired/);assert.match(historyText,/connected/,'Account-bound notification transitions survive a full reload');
 failRead=true;await page.evaluate(()=>MayaAdminNotifications.load());assert.match(await feedback(),/unavailable|could not|failed|unable/i,'A failed history read reports failure honestly');
 const readsAfterFailure=requests.filter(item=>item.path==='/api/admin/notifications'&&item.method==='GET').length;await page.waitForTimeout(160);assert.equal(requests.filter(item=>item.path==='/api/admin/notifications'&&item.method==='GET').length,readsAfterFailure,'A failed history read does not enter an automatic retry loop');failRead=false;
 await page.evaluate(()=>MayaAdminNotifications.load());
 failWrite=true;const writesBeforeFailure=writes.length;await page.evaluate(()=>MayaAdminNotifications.record([{source:'google_ads',code:'scope'}]));await waitFor(()=>writes.length>writesBeforeFailure,'The failed notification write was not attempted');
 await page.waitForFunction(()=>/unavailable|could not|failed|unable|not saved|unconfirmed/i.test(document.getElementById('notifications-feedback').textContent));
 const writesAfterFailure=writes.length;await page.waitForTimeout(180);assert.equal(writes.length,writesAfterFailure,'An uncertain notification write is not automatically retried');assert.ok(!store.get('owner-a').some(item=>item.code==='scope'),'A rejected write is not represented as persisted');failWrite=false;
 // An old read can finish after B is active, but must never replace B's history.
 holdNext={owner:'owner-a',method:'GET'};await page.evaluate(()=>{window.staleNotificationRead=MayaAdminNotifications.load();});const staleRead=await nextHeld();
 await setOwner(ownerB);await openNotifications();assert.match(await page.locator('#admin-notification-list').innerText(),/Owner B notification history/);
 await release(staleRead,[{id:'stale-a-read',source:'google_ads',code:'oauth_expired',text:'Owner A stale notification read',severity:'warning',ts:'2026-11-03T20:00:00Z'}]);await page.evaluate(()=>staleNotificationRead);
 assert.doesNotMatch(await page.locator('#admin-notification-list').innerText(),/Owner A stale/);assert.match(await page.locator('#admin-notification-list').innerText(),/Owner B notification history/);
 // An accepted old write may update A's store; its response must not enter B.
 await setOwner(ownerA);await openNotifications();holdNext={owner:'owner-a',method:'POST'};
 await page.evaluate(()=>{MayaAdminNotifications.record([{source:'google_ads',code:'account_access'}]);window.staleNotificationWrite=MayaAdminNotifications.load();});const staleWrite=await nextHeld();
 await setOwner(ownerB);await openNotifications();
 await release(staleWrite,[{id:'stale-a-write',source:'google_ads',code:'account_access',text:'Owner A stale notification write',severity:'warning',ts:'2026-11-03T20:00:00Z'}]);await page.evaluate(()=>staleNotificationWrite);
 assert.doesNotMatch(await page.locator('#admin-notification-list').innerText(),/Owner A stale/);assert.match(await page.locator('#admin-notification-list').innerText(),/Owner B notification history/);
 await page.evaluate(ids=>{for(const id of ids)document.getElementById(id).textContent='Previous owner current note';document.getElementById('notification-current').open=true;document.getElementById('maya-logs-disclosure').open=true;document.getElementById('maya-logs-list').textContent='Previous owner diagnostic log';MayaAdminNotifications.reset();},notes);
 assert.doesNotMatch(await page.locator('#drawer-logs').textContent(),/Previous owner current note|Previous owner diagnostic log|Owner B notification history/,'Reset clears old history, diagnostic logs and operational note text');
 for(const selector of ['#notification-current','#maya-logs-disclosure'])assert.equal(await page.locator(selector).evaluate(element=>element.open),false,'Reset collapses '+selector);
 await page.evaluate(()=>MayaAdminNotifications.load());await paint(readyReport());await page.evaluate(()=>MayaTypographyControls.apply(MayaTypographyControls.defaults));await checkStyles('default');
 await page.evaluate(value=>localStorage.setItem('maya_admin_tok',value),ownerB);
 const gallery=await context.newPage();await gallery.goto(origin+'/aesthetics/aesthetic-control.html');await gallery.waitForFunction(()=>window.MayaTypographyControls);
 assert.equal(await gallery.evaluate(async()=>{await MayaTypographyControls.ready;const design=structuredClone(MayaTypographyControls.defaults);Object.assign(design.type.H3,{font:'cormorant',size:18,weight:500});Object.assign(design.type.P1,{font:'cormorant',size:16,weight:500,color:'white'});Object.assign(design.type.P2,{size:14});Object.assign(design.type.P3,{font:'cormorant',size:12,weight:500});Object.assign(design.inner,{paddingX:23,paddingY:17,background:'green',fill:65});Object.assign(design.glass,{fill:55,blur:9,saturation:140});design.pillX=22;design.pillY=12;return MayaTypographyControls.save(design);}), 'Saved.');
 assert.equal(designWrites.length,1,'One real explicit design Save propagates into the Admin notification surface');await gallery.close();
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('notifications-feedback')).fontSize==='16px');await checkStyles('saved');
 assertNoPrivateLeak();assert.deepEqual(pageErrors,[]);assert.ok(writes.every(item=>['owner-a','owner-b'].includes(item.owner)));
 console.log('Admin notifications UI passed: private retained history, collapsed current diagnostics/logs, Messages independence, provider transitions, deduplicated polling, honest storage failures, account races/reset and real shared-design Save at six widths. Synthetic providers only.');
}finally{
 for(const item of held)await item.route.abort().catch(()=>{});
 await browser.close();
}
