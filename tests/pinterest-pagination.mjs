import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM});
try {
 for(const file of ['frontend/index.html','playground/index.html']) {
  const source=readFileSync(file,'utf8');
  assert.ok(!source.includes('id="pin-search-scope"'));
  assert.ok(source.includes("const scope = 'everywhere'"));
  const code=source.slice(source.indexOf('let _pinListSeq = 0;'),source.indexOf('function _pinToggle(el)')) + source.slice(source.indexOf('let _pinInputTimer = null;'),source.indexOf('function _pinSearchToggle()'));
  const page=await browser.newPage({viewport:{width:400,height:300}});
  await page.setContent('<style>.pin-pic{display:block;height:400px;width:100px}img{display:none}</style><div id="pinterest-drawer-body"></div>');
  await page.evaluate(code=>{
   window.searches=[];window._pinWideSearch=async(q,scope)=>{searches.push({q,scope});return {ok:true};};window.calls=[];window.uid='one';window.mode='normal';window.projectStore={_uid:()=>uid};
   window._pinSub=()=>{};window._pinSetFoot=()=>{};window.escapeHtml=s=>s;window._safeImgSrc=s=>s;
   window._pinBody=html=>document.getElementById('pinterest-drawer-body').innerHTML=html;
   window._pinApi=async url=>{calls.push(url);if(mode==='error')throw Error('offline');return url.includes('bookmark=next')?{pins:[{id:'1',url:'one'},{id:'2',url:'two'}],bookmark:'next'}:{pins:[{id:'1',url:'one'}],bookmark:'next'};};
   // Export only the functions under test; closure state is the production code.
   eval(code+';window.openPins=_pinDrawerPins;window.nextPins=_pinLoadNext;window.searchInput=_pinSearchInput;');
  },code);
  await page.evaluate(()=>openPins('',''));
  assert.equal(await page.evaluate(()=>calls.length),1);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForFunction(()=>calls.length===2);
  await page.waitForFunction(()=>document.querySelectorAll('.pin-pic').length===2);
  assert.equal(await page.locator('#pin-load-more').isVisible(),false);
  await page.evaluate(()=>nextPins());
  assert.equal(await page.evaluate(()=>calls.length),2,'repeated cursor stops requests');
  await page.evaluate(async()=>{mode='error';await openPins('','');});
  assert.equal(await page.locator('#pin-load-more').isVisible(),true,'errors expose Retry');
  await page.evaluate(async()=>{mode='normal';await nextPins();});
  assert.equal(await page.locator('#pin-load-more').isVisible(),false);
  await page.evaluate(async()=>{uid='two';await nextPins();});
  assert.equal(await page.evaluate(()=>calls.length),4,'account changes cannot paginate old account');
  await page.evaluate(()=>{searchInput('vel');searchInput('velvet');});
  await page.waitForFunction(()=>searches.length===1);
  assert.deepEqual(await page.evaluate(()=>searches),[{q:'velvet',scope:'everywhere'}]);
  await page.close();
 }
 console.log('Pinterest: automatic pages, deduplication, repeated-cursor stop, retry, account guard and global search passed on both surfaces.');
} finally {await browser.close();}
