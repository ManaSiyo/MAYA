import assert from 'node:assert/strict';
import {validDesign,DESIGN_PATH} from '../docs/server/design-config.mjs';
import {readFileSync} from 'node:fs';
assert.equal(DESIGN_PATH,'config/typography-controls.json');
const source=readFileSync(new URL('../aesthetics/ui/typography-controls.js',import.meta.url),'utf8');
assert.match(source,/H1:\{size:24/);
const good={type:{H1:{size:24,weight:300,color:'white'},H2:{size:20,weight:400,color:'white'},H3:{size:16,weight:400,color:'white'},H4:{size:14,weight:400,color:'white'},P1:{size:12,weight:300,color:'gray'},P2:{size:12,weight:400,color:'white'},P3:{size:12,weight:400,color:'gray'},P4:{size:10,weight:300,color:'white'},P5:{size:10,weight:400,color:'gray'}},finish:'current',glass:{fill:18,tint:0,rim:22,highlight:28,blur:22,saturation:180},overlay:{fill:18,rim:22,blur:22,saturation:180,enabled:true},pillX:14,pillY:6};
assert.equal(validDesign(good),true);
for(const bad of [
 {...good,type:{...good.type,H4:{...good.type.H4,size:20}}},
 {...good,type:{...good.type,P1:{...good.type.P1,size:11}}},
 {...good,type:{...good.type,P1:{...good.type.P1,weight:500}}},
 {...good,type:{...good.type,P1:{...good.type.P1,color:'red'}}},
 {...good,glass:{...good.glass,fill:'0);body{display:none}' }},
 {...good,extra:'unapproved'}
])assert.equal(validDesign(bad),false);
console.log('Design validation passed: hierarchy, even sizes, weight cap, fixed colors and numeric glass.');

const compact=structuredClone(good);compact.type.P3=compact.type.P4;compact.type.P4=compact.type.P5;delete compact.type.P5;
compact.type.P1.align='center';compact.editor={fill:30,rim:14,radius:12,padding:8};
assert.equal(validDesign(compact),true);
for(const patch of [{editor:{...compact.editor,padding:21}},{editor:{...compact.editor,fill:'red'}},{type:{...compact.type,P1:{...compact.type.P1,align:'justify'}}}])assert.equal(validDesign({...compact,...patch}),false);

compact.type.H1.font='jost';compact.type.H1.case='uppercase';compact.type.H2.font='cormorant';compact.type.H2.case='none';
assert.equal(validDesign(compact),true);
for(const field of [{font:'Arial'},{font:'url(evil)'},{case:'capitalize'},{case:'uppercase;display:none'}])assert.equal(validDesign({...compact,type:{...compact.type,H3:{...compact.type.H3,...field}}}),false);
console.log('Design font/case validation accepts only the two supported families and Normal/ALL CAPS; old saved schemas remain compatible.');

compact.type.H3.align='right';compact.type.H3.vertical='middle';assert.equal(validDesign(compact),true);
const type={font:'jost',size:13,weight:400,color:'white',case:'none',align:'right',vertical:'top'};
compact.inner={fill:18,rim:22,radius:12,paddingX:30,paddingY:20,width:100};compact.filter={...compact.inner,width:330};
compact.table={fill:18,rim:22,paddingX:12,paddingY:14,header:{...type,background:'blue',opacity:80},firstColumn:{background:'pink',opacity:60},columns:[type,type,type]};
assert.equal(validDesign(compact),true);
for(const patch of [{filter:{...compact.filter,width:159}},{inner:{...compact.inner,paddingY:41}},{table:{...compact.table,columns:[type]}},{table:{...compact.table,header:{...compact.table.header,background:'url(evil)'}}},{table:{...compact.table,columns:[{...type,vertical:'sideways'},type,type]}}])assert.equal(validDesign({...compact,...patch}),false);
for(const target of ['header','firstColumn'])assert.equal(validDesign({...compact,table:{...compact.table,[target]:{...compact.table[target],background:'black'}}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,background:'black'}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,background:'url(evil)'}}),false);
console.log('Saved inner/filter/table controls validate bounded geometry, fixed backgrounds and independent column typography.');

const {saveDesign}=await import('../docs/server/design-config.mjs');
for(const size of [23,49,NaN,'28'])assert.equal(validDesign({...compact,iconSize:size}),false);
assert.equal(validDesign({...compact,iconSize:36,dropdownHeight:32}),true);
let saved=structuredClone(compact),generation=1,conflict=true,unavailable=false;
const store={read:async()=>unavailable?{ok:false,status:503}:{ok:true,buf:Buffer.from(JSON.stringify(saved)),generation:String(generation)},write:async(_,buf,type,expected)=>{assert.equal(expected,String(generation));if(conflict){conflict=false;generation++;throw Object.assign(Error('conflict'),{status:412});}saved=JSON.parse(buf);generation++;}};
const outcome=await saveDesign(store,{...compact,iconSize:36},'owner@example.com',()=> '2026-10-02T20:00:00Z');
assert.equal(outcome.savedAt,'2026-10-02T20:00:00Z');assert.equal(saved.iconSize,36);assert.equal(saved._history.length,1);assert.equal(saved._history[0].source,'design');assert.match(saved._history[0].text,/iconSize/);assert.equal(saved._history[0].who,'owner@example.com');
await saveDesign(store,{...compact,iconSize:36},'owner@example.com');assert.equal(saved._history.length,2);assert.match(saved._history[1].text,/unchanged/);
unavailable=true;await assert.rejects(()=>saveDesign(store,compact,'owner'),/storage unavailable/);assert.equal(saved._history.length,2);
console.log('Atomic design saves audit changes and no-op saves, retry concurrent writes and reject unavailable storage.');
