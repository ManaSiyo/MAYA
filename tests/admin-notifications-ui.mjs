import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
// The historical gate now proves the owner-requested retirement. The server's
// private history validation/storage tests remain in admin-notifications.mjs.
const root=resolve('.'),origin='https://maya-retirement.test',requests=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||process.env.CHROMIUM_PATH});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.setInterval=()=>0;window.google={accounts:{id:{initialize(){},prompt(){},renderButton(){},cancel(){},disableAutoSelect(){}}}};});
let report={ok:true,analytics:{connected:true,sources:[]},googleAds:{connected:false,code:'oauth_expired'},meta:{connected:false,code:'not_configured'},chatgptAds:{connected:true},adCombined:{campaignDaily:[],campaigns:[],excludedSources:[]},leads:{connected:false},warnings:[]};
await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.origin!==origin)return route.abort();
 if(u.pathname.startsWith('/api/')){
  requests.push({path:u.pathname,method:req.method()});
  if(u.pathname==='/api/admin/marketing')return route.fulfill({json:report});
  if(u.pathname==='/api/admin/marketing-brief')return route.fulfill({json:{headline:'Fixture'}});
  if(u.pathname==='/api/design')return route.fulfill({json:{}});
  return route.fulfill({json:{ok:true,items:[],threads:[],models:{},folders:[],briefing:[],attention:[]}});
 }
 const path=resolve(root,'.'+(u.pathname==='/status.html'?'/backend/status.html':u.pathname));
 try{return route.fulfill({body:readFileSync(path),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(path)]||'application/octet-stream'});}catch{return route.abort();}
});
try{
 await page.goto(origin+'/status.html');await page.waitForFunction(()=>window.MayaTypographyControls&&typeof admTab==='function');await page.evaluate(async()=>{await MayaTypographyControls.ready;_idTok='fixture';toggleDrawer(true);admTab('systems');});
 assert.deepEqual(await page.locator('#adm-tabrow button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['Settings','Messages']);
 assert.equal(await page.locator('#bottom-fold,#sources-table,#drawer-logs,#admin-notifications,#notification-current,#maya-logs-disclosure').count(),0);
 assert.equal(await page.evaluate(()=>typeof window.MayaAdminNotifications),'undefined','Retired history is not loaded');
 assert.equal(await page.locator('#drawer-systems a[href="https://console.twilio.com/"]').count(),1);
 assert.equal(await page.locator('#drawer-systems>h3').filter({hasText:'Add Tools'}).count(),1);
 assert.equal(await page.locator('#drawer-systems>h3').filter({hasText:'Outside tools'}).count(),0);
 await page.evaluate(()=>loadMkt());
 assert.match(await page.locator('#ads-connection-status').textContent(),/unavailable/i,'Real provider failure remains explicit');
 assert.ok(await page.locator('#ads-connection-status').evaluate(e=>!!(document.getElementById('campaigns-table').compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)),'Failure follows campaign data');
 const warning=await page.locator('#leads-note').textContent();assert.ok(warning);
 await page.evaluate(()=>paintLeads({connected:true,list:[]}));assert.equal(await page.locator('#leads-note').textContent(),warning,'A local repaint cannot invent recovery');
 for(const saved of [false,true]){
  await page.evaluate(saved=>{const d=structuredClone(MayaTypographyControls.defaults);if(saved){Object.assign(d.type.H3,{font:'cormorant',size:18,weight:500,style:'italic',case:'uppercase'});Object.assign(d.drawer,{paddingX:21,paddingY:19});}MayaTypographyControls.apply(d);},saved);
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>{toggleDrawer(true);admTab('systems');});await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;});
   assert.ok(await page.locator('#drawer-systems').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Settings fits '+width);
   for(const heading of await page.locator('#drawer-systems>h3').all()){
    assert.equal(await heading.getAttribute('data-maya-type'),'H3');const s=await heading.evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight];});assert.match(s[0],saved?/Cormorant/:/Jost/);assert.equal(s[1],saved?'18px':'16px');assert.equal(s[2],saved?'500':'400');
   }
   if([390,1440].includes(width))await page.locator('#drawer').screenshot({path:'/private/tmp/maya-admin-settings-'+(saved?'saved':'default')+'-'+width+'.png'});
  }
 }
 await page.evaluate(()=>{admTab('logs');});assert.equal(await page.locator('#adm-tabtitle').textContent(),'Settings','Old callers cannot resurrect Logs');
 await page.evaluate(()=>{document.body.classList.add('maya-live');_mayaChatAdd('maya','Fixture conversation');});assert.ok(await page.locator('#drawer-command').isVisible(),'Voice conversation remains accessible');
 await page.evaluate(()=>_mayaQueueAction({kind:'memory',text:'Fixture reviewed memory'}));assert.ok(await page.locator('#maya-confirmation').evaluate(e=>e.open));await page.getByRole('button',{name:'Dismiss',exact:true}).click();
 await page.evaluate(()=>admTab('messages'));assert.ok(await page.locator('#drawer-messages').isVisible());assert.ok(await page.locator('#drawer-systems').isHidden());
 await page.evaluate(()=>{_idTok='other-fixture';++_adminSession;window.dispatchEvent(new Event('maya-owner-session-changed'));});
 for(const id of ['leads-note','ads-connection-status','submissions-notification-status'])assert.equal(await page.locator('#'+id).textContent(),'','Account reset clears '+id);
 assert.deepEqual(requests.filter(r=>r.path==='/api/admin/notifications'||r.path==='/api/admin/design-history'),[],'No retired history read, poll or write');
 assert.deepEqual(requests.filter(r=>r.method!=='GET'&&r.path!=='/api/admin/marketing-brief'),[],'Reviewing Settings and dismissing approval sends nothing');
 assert.deepEqual(errors,[]);console.log('Admin retirement passed: no Insights/Logs/history activity, honest feature errors, account clearing, voice approvals, Messages, Twilio/Add Tools and shared H3 at six widths.');
}finally{await browser.close();}
