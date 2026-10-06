// Used by outbound-ui's real Admin page and fake providers; no live customer data.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

export async function auditLeadFilter(page){
  const menu=page.locator('#lead-status-menu'), gear=page.locator('.lead-filter>summary');
  const rows=page.locator('#leads-table tr[id]');
  const paint=async count=>{
    await page.evaluate(count=>{
      paintLeads({connected:true,list:Array.from({length:count},(_,i)=>({
        id:'fixture-'+i,name:'Example Person '+i,phone:'+15555550100',tier:'Signature',
        wrote:'A custom suit for a ceremony, with a carefully tailored fit.',createdAt:'2026-09-23',
        stage:['new','contacted','in_progress','booked','canceled'][i%5]
      }))});
      document.querySelector('#leads-fold').scrollIntoView();
    },count);
  };
  const open=async()=>{await gear.click();await menu.waitFor({state:'visible'});};
  const bounds=async()=>{
    const data=await menu.evaluate(el=>{
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      const points=[...el.querySelectorAll('label')].map(label=>{
        const b=label.getBoundingClientRect();return label.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
      });
      return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:innerWidth,height:innerHeight,
        portal:el.parentElement===document.body,top:el.hasAttribute('popover')?el.matches(':popover-open'):true,
        background:s.backgroundColor,blur:s.backdropFilter,fontSize:s.fontSize,points};
    });
    assert.ok(data.portal && data.top,'Filter escapes sticky/scroll clipping');
    assert.ok(data.x>=8 && data.right<=data.width-7 && data.y>=0 && data.bottom<=data.height-7,JSON.stringify(data));
    assert.ok(data.points.every(Boolean),'All options receive pointer hits, above table cells');
    assert.equal(data.background,'rgb(0, 0, 0)','Functional filters follow the editable dropdown backing');
    assert.match(data.blur,/blur\(22px\)/);
    assert.equal(data.fontSize,'11px','Filter retains the compact table scale');
  };
  await page.evaluate(()=>paintLeads({connected:true,list:['Help me decide','Signature','Ceremonial','Suit'].map((tier,i)=>({id:'badge-'+i,name:'Category '+i,phone:'+15555550100',tier,createdAt:'2026-10-01'}))}));
  assert.equal(await page.locator('.category-badge').count(),0);assert.equal(await page.locator('td[data-col="contact"]').count(),4);
  assert.equal(await page.locator('#leads-bar,#leads-table [aria-label="Call"],#leads-table .lead-src').count(),0);
  const clicked=await page.evaluate(()=>{const original=window.leadOpenThread;let index;window.leadOpenThread=i=>index=i;document.querySelectorAll('td[data-col="name"]')[2].click();window.leadOpenThread=original;return index;});
  assert.equal(clicked,2,'Full name cell opens its exact client, including its padding');
  await paint(12);
  for(const width of [320,390,650,768,1024,1440,1920]){
    await page.setViewportSize({width,height:844});
    await open();await bounds();
    assert.ok(await menu.evaluate(el=>{const a=document.querySelector('.lead-filter>summary').getBoundingClientRect(),r=el.getBoundingClientRect();return a.left+r.width>innerWidth-8||Math.abs(a.left-r.left)<1;}),'Lead filter starts at its trigger when there is room');
    assert.equal(await gear.evaluate(el=>getComputedStyle(el,'::after').content),'none','No inherited section caret');
    await page.screenshot({path:join(tmpdir(),'maya-lead-filter-'+width+'.png')});
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    assert.ok(await gear.evaluate(el=>el===document.activeElement),'Escape returns focus');
    assert.equal(await gear.evaluate(el=>getComputedStyle(el).borderRadius),'100px');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.querySelector('#leads-fold').scrollIntoView());
  await open();
  await page.locator('#leads-fold .panel').evaluate(el=>el.scrollTop=200);
  await bounds(); // Still anchored to the sticky header when rows scroll.
  await menu.locator('[data-status="new"]').uncheck();
  await menu.waitFor({state:'visible'});assert.equal(await rows.count(),9);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.status),'new','Rerender preserves checkbox focus');
  await page.keyboard.press('Space');await menu.waitFor({state:'visible'});assert.equal(await rows.count(),12);
  for(const key of ['new','contacted','in_progress','booked','canceled'])await menu.locator('[data-status="'+key+'"]').uncheck();
  assert.equal(await rows.count(),0);await bounds(); // Empty results shrink the scroll panel, not the popover.
  for(const key of ['new','contacted','in_progress','booked','canceled'])await menu.locator('[data-status="'+key+'"]').check();
  await page.mouse.click(8,400);await menu.waitFor({state:'hidden'});
  await gear.focus();await page.keyboard.press('Enter');await menu.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.status),'new');
  await page.keyboard.press('Shift+Tab');await menu.waitFor({state:'hidden'});
  assert.ok(await gear.evaluate(el=>el===document.activeElement));
  await page.keyboard.press('ArrowDown');await menu.waitFor({state:'visible'});
  for(let i=0;i<5;i++)await page.keyboard.press('Tab');
  await menu.waitFor({state:'hidden'});
  assert.ok(await page.locator('.lead-open').first().evaluate(el=>el===document.activeElement),'Tab continues into the first table row');

  await page.setViewportSize({width:700,height:844});await open();
  await page.setViewportSize({width:650,height:844});
  await page.evaluate(()=>new Promise(requestAnimationFrame));await bounds();
  await page.keyboard.press('Escape');
  for(const [width,height] of [[320,568],[844,390]]){
    await page.setViewportSize({width,height});await open();await bounds();
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:320,height:568});await open();
  await page.locator('#leads-fold .panel').evaluate(el=>el.scrollLeft=el.scrollWidth);
  await menu.waitFor({state:'hidden'}); // A frozen column must not hide the open filter's anchor.
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.body.classList.add('affiliates-view'));
  await open();await bounds();await page.keyboard.press('Escape');
  await page.evaluate(()=>document.body.classList.remove('affiliates-view'));

  // One row exposes clipping below the short scroll panel. Keep the last option usable.
  await paint(1);await open();await bounds();
  assert.ok((await menu.boundingBox()).height>await page.locator('#leads-fold .panel').evaluate(el=>el.clientHeight));
  await page.keyboard.press('Escape');
  // The anchor also follows a user-reordered sticky first column.
  await page.locator('th[data-col="stage"]').dragTo(page.locator('th[data-col="name"]'));
  assert.equal(await page.locator('#leads-table th').first().getAttribute('data-col'),'stage');
  await open();await bounds();await page.keyboard.press('Escape');
  await page.locator('th[data-col="name"]').dragTo(page.locator('th[data-col="stage"]'));
  assert.equal(await page.locator('#leads-table th').first().getAttribute('data-col'),'name');

  // Older browsers still get an unclipped body portal without the Popover API.
  await menu.evaluate(el=>{el.showPopover=undefined;el.hidePopover=undefined;});
  await open();await bounds();await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  assert.equal(await page.locator('body>.lead-status-menu').count(),0,'Closing cleans up the portal');
  console.log('Lead filter: populated/empty/short tables, 7 widths, scroll, reorder, pointer, keyboard and fallback passed.');
}
