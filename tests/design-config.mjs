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
 {...good,type:{...good.type,P1:{...good.type.P1,weight:501}}},
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

const cell={...type,background:'black',opacity:90};
assert.equal(validDesign({...compact,table:{...compact.table,cells:{'note-0':cell,'stage-99':cell}}}),true);
for(const cells of [{'name-0':cell},{'note-100':cell},{'note-01':cell},{'note-0':{...cell,size:99}},{'note-0':{...cell,background:'url(evil)'}},[],null])assert.equal(validDesign({...compact,table:{...compact.table,cells}}),false);
console.log('Cell presentation overrides accept bounded semantic row slots and fixed styles only.');

assert.equal(validDesign({...compact,table:{...compact.table,columns:[type,{...type,background:'green',opacity:50},type]}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,columns:[type,{...type,background:'url(evil)',opacity:50},type]}}),false);

for(const weight of [200,250,450,500])assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,weight,style:'italic'}}}),true);
assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,weight:199}}}),false);
assert.equal(validDesign({...compact,type:{...compact.type,H1:{...compact.type.H1,style:'oblique'}}}),false);
assert.equal(validDesign({...compact,glass:{...compact.glass,borderColor:'black'},overlay:{...compact.overlay,borderColor:'white'},editor:{...compact.editor,background:'black',borderColor:'black'},table:{...compact.table,borderColor:'black'}}),true);
assert.equal(validDesign({...compact,editor:{...compact.editor,borderColor:'red'}}),false);

assert.equal(validDesign({...compact,editor:{fill:100,rim:22,radius:12,paddingX:24,paddingY:10}}),true);
for(const patch of [{paddingX:41},{paddingY:-1},{paddingX:'20'},{paddingY:null}])assert.equal(validDesign({...compact,editor:{fill:100,rim:22,radius:12,paddingX:24,paddingY:10,...patch}}),false);

assert.equal(validDesign({...compact,overlay:{...compact.overlay,radius:20}}),true);assert.equal(validDesign({...compact,overlay:{...compact.overlay,radius:25}}),false);

const withH0={...compact,type:{...compact.type,H0:{size:104,weight:400,color:'white',font:'cormorant',case:'uppercase'}}};
assert.equal(validDesign(withH0),true);for(const size of [22,105,162])assert.equal(validDesign({...withH0,type:{...withH0.type,H0:{...withH0.type.H0,size}}}),false);assert.equal(validDesign(compact),true,'Existing designs need no migration to add H0');

for(const role of ['glass','overlay','editor','inner','filter'])assert.equal(validDesign({...compact,[role]:{...compact[role],borderColor:'gray'}}),true,role+' gray border');
assert.equal(validDesign({...compact,table:{...compact.table,borderColor:'gray'}}),false);
assert.equal(validDesign({...compact,table:{...compact.table,radius:20}}),true);for(const radius of [-1,25,1.5,'12'])assert.equal(validDesign({...compact,table:{...compact.table,radius}}),false);

assert.equal(validDesign({...compact,table:{...compact.table,outerWidth:4,innerWidth:2,innerRim:50,innerBorderColor:'black'}}),true);
for(const patch of [{outerWidth:9},{innerWidth:-1},{innerBorderColor:'red'},{innerRim:101}])assert.equal(validDesign({...compact,table:{...compact.table,...patch}}),false);

const extended=structuredClone(compact);extended.type.H5={size:14,weight:400,color:"white",font:"jost",case:"none"};extended.type.H6={size:10,weight:300,color:"gray",font:"jost",case:"none"};extended.table.columns.push({...type});assert.equal(validDesign(extended),true);assert.equal(validDesign({...extended,type:{...extended.type,H6:{...extended.type.H6,color:"red"}}}),false);assert.equal(validDesign({...extended,table:{...extended.table,columns:[...extended.table.columns,type]}}),false);

for(const target of ['inner','filter','table']){
 const value={...compact,[target]:{...compact[target],background:'blue',blur:8,saturation:120}};assert.equal(validDesign(value),true);
 for(const patch of [{blur:41},{saturation:201},{background:'url(evil)'}])assert.equal(validDesign({...value,[target]:{...value[target],...patch}}),false);
}
assert.equal(validDesign({...compact,overlay:{...compact.overlay,background:'blue'}}),true);
assert.equal(validDesign({...compact,table:{...compact.table,columnWidths:{name:300,contact:180,stage:200,note:400}}}),true);
for(const columnWidths of [{name:79},{note:801},{name:'300'},{alien:300},[],null])assert.equal(validDesign({...compact,table:{...compact.table,columnWidths}}),false);
console.log('Independent panel materials and semantic column widths validate bounded values; older schemas remain valid.');

for(const gap of [0,8,32])assert.equal(validDesign({...compact,iconPillGap:gap,iconTextGap:gap}),true);
for(const gap of [-1,33,1.5,'8'])assert.equal(validDesign({...compact,iconPillGap:gap}),false);

for(const patch of [{iconColor:'#123abc',iconOpacity:65,iconStroke:3},{sectionSpacing:{submissions:32,headingGap:24}},{statusStyles:{completed:{color:'#123abc',opacity:75,weight:500}}}])assert.equal(validDesign({...compact,...patch}),true);
for(const patch of [{iconColor:'red'},{iconOpacity:101},{iconStroke:4},{sectionSpacing:{headingGap:-1}},{sectionSpacing:{alien:12}},{statusStyles:{completed:{color:'url(evil)',opacity:75,weight:500}}},{statusStyles:{completed:{color:'#123abc',opacity:75,weight:600}}},{statusStyles:{alien:{color:'#123abc',opacity:75,weight:500}}}])assert.equal(validDesign({...compact,...patch}),false);

// Version 2 is an explicit canonical schema; versionless open editors stay valid.
const canonical=structuredClone(extended);canonical.typeVersion=2;
canonical.type.H0={...withH0.type.H0};canonical.type.H5={...extended.type.H6};
delete canonical.type.H6;delete canonical.type.P4;delete canonical.type.P5;
const canonicalBefore=JSON.stringify(canonical),legacyBefore=JSON.stringify(extended);
assert.equal(validDesign(canonical),true);assert.equal(validDesign(extended),true);assert.equal(validDesign(good),true);
assert.equal(JSON.stringify(canonical),canonicalBefore);assert.equal(JSON.stringify(extended),legacyBefore,'Validation never migrates or writes a legacy saved design');
for(const role of ['H6','P4','P5','H7','P9'])assert.equal(validDesign({...canonical,type:{...canonical.type,[role]:{...canonical.type.P3}}}),false,'Canonical schema rejects '+role);
for(const role of Object.keys(canonical.type)){
 const missing=structuredClone(canonical);delete missing.type[role];assert.equal(validDesign(missing),false,'Canonical schema requires '+role);
}
for(const typeVersion of [null,undefined,1,3,'2',true])assert.equal(validDesign({...canonical,typeVersion}),false,'Only explicit numeric version 2 is supported');
for(const type of [null,[],false,'roles'])assert.equal(validDesign({...canonical,type}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,H4:{...canonical.type.H4,size:canonical.type.H3.size}}}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,P3:{...canonical.type.P3,size:canonical.type.P2.size+2}}}),false);
assert.equal(validDesign({...canonical,type:{...canonical.type,H5:{...canonical.type.H5,size:24}}}),true,'Date sizing remains independent, as in legacy H6');

const regularPill={fill:25,rim:30,borderColor:'gray',background:'black',paddingX:12,paddingY:6};
for(const design of [canonical,compact])assert.equal(validDesign({...design,regularPill}),true,'Regular pills are optional and independent of glass settings');
for(const background of ['black','gray','blue','yellow','green','pink'])assert.equal(validDesign({...canonical,regularPill:{...regularPill,background}}),true);
for(const borderColor of ['black','white','gray'])assert.equal(validDesign({...canonical,regularPill:{...regularPill,borderColor}}),true);
for(const [key,min,max] of [['fill',0,100],['rim',0,100],['paddingX',4,32],['paddingY',2,16]]){
 for(const value of [min,max])assert.equal(validDesign({...canonical,regularPill:{...regularPill,[key]:value}}),true,key+' boundary');
 for(const value of [min-1,max+1,min+.5,String(min),null])assert.equal(validDesign({...canonical,regularPill:{...regularPill,[key]:value}}),false,key+' invalid value');
}
for(const key of Object.keys(regularPill)){
 const partial={...regularPill};delete partial[key];assert.equal(validDesign({...canonical,regularPill:partial}),false,'Regular pill requires '+key);
}
for(const value of [null,[],false,'pill',{...regularPill,background:'url(evil)'},{...regularPill,borderColor:'red'},{...regularPill,blur:12}])assert.equal(validDesign({...canonical,regularPill:value}),false);

for(const status of ['delivering','pending','rejected']){
 const style={color:'#123abc',opacity:50,weight:400};
 for(const design of [canonical,compact])assert.equal(validDesign({...design,statusStyles:{[status]:style}}),true,status+' accepts the shared status style');
 for(const patch of [{color:'red'},{opacity:-1},{opacity:101},{opacity:'50'},{weight:199},{weight:501},{weight:300.5},{unknown:1}])assert.equal(validDesign({...canonical,statusStyles:{[status]:{...style,...patch}}}),false);
 for(const key of Object.keys(style)){const partial={...style};delete partial[key];assert.equal(validDesign({...canonical,statusStyles:{[status]:partial}}),false);}
}
assert.equal(validDesign({...canonical,statusStyles:{unknown:{color:'#123abc',opacity:50,weight:400}}}),false);
console.log('Canonical roles, legacy compatibility, complete regular-pill materials and extended semantic statuses validate without mutating saved settings.');

for(const design of [canonical,compact]){
 for(const layoutSpacing of [{},{labelGap:0,fieldGap:64,drawerDockInset:32},{labelGap:64,fieldGap:0,drawerDockInset:0}])assert.equal(validDesign({...design,layoutSpacing}),true,'Optional workspace spacing preserves older designs');
 assert.equal(validDesign({...design,semanticStyles:{nonFabric:{color:'#fde68a',opacity:0}}}),true);
 assert.equal(validDesign({...design,semanticStyles:{nonFabric:{color:'#123abc',opacity:100}}}),true);
}
for(const layoutSpacing of [null,[],{labelGap:-1},{labelGap:65},{fieldGap:'4'},{fieldGap:1.5},{drawerDockInset:33},{unknown:4}])assert.equal(validDesign({...canonical,layoutSpacing}),false);
for(const semanticStyles of [null,[],{unknown:{}},{nonFabric:null},{nonFabric:[]},{nonFabric:{color:'yellow',opacity:50}},{nonFabric:{color:'#123abc',opacity:101}},{nonFabric:{color:'#123abc',opacity:'50'}},{nonFabric:{color:'#123abc'}},{nonFabric:{color:'#123abc',opacity:50,weight:400}}])assert.equal(validDesign({...canonical,semanticStyles}),false);
unavailable=false;
await saveDesign(store,{...canonical,layoutSpacing:{labelGap:19,fieldGap:27,drawerDockInset:0},semanticStyles:{nonFabric:{color:'#123abc',opacity:65}}},'owner@example.com');
assert.deepEqual(saved.layoutSpacing,{labelGap:19,fieldGap:27,drawerDockInset:0});assert.deepEqual(saved.semanticStyles,{nonFabric:{color:'#123abc',opacity:65}});assert.match(saved._history.at(-1).text,/layoutSpacing/);
console.log('Workspace spacing and non-fabric semantic colors validate, preserve legacy saves and persist in the atomic design audit.');

const checkbox={size:16,radius:3,background:'black',fill:100,rim:55,borderColor:'gray',checkedColor:'#aab5c4',checkColor:'#000000'};
const scrollbar={width:8,radius:8,thumbColor:'#aab5c4',thumbOpacity:55,trackColor:'#000000',trackOpacity:0};
for(const design of [canonical,compact])assert.equal(validDesign({...design,checkbox,scrollbar}),true,'Native controls preserve both design generations');
for(const [kind,value,ranges] of [['checkbox',checkbox,{size:[12,28],radius:[0,14],fill:[0,100],rim:[0,100]}],['scrollbar',scrollbar,{width:[2,20],radius:[0,16],thumbOpacity:[0,100],trackOpacity:[0,100]}]]){
 for(const [key,[min,max]] of Object.entries(ranges)){
  for(const n of [min,max])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:n}}),true,kind+' '+key+' boundary');
  for(const n of [min-1,max+1,min+.5,String(min),null])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:n}}),false,kind+' '+key+' invalid');
 }
 for(const key of Object.keys(value)){const partial={...value};delete partial[key];assert.equal(validDesign({...canonical,[kind]:partial}),false,kind+' requires '+key);}
 for(const bad of [null,[],false,'custom',{...value,unknown:1}])assert.equal(validDesign({...canonical,[kind]:bad}),false,kind+' rejects invalid shape');
 for(const key of Object.keys(value).filter(k=>k.endsWith('Color')&&k!=='borderColor'))for(const color of ['red','#fff','url(evil)',7,null])assert.equal(validDesign({...canonical,[kind]:{...value,[key]:color}}),false,'Bounded color '+key);
}
assert.equal(validDesign({...canonical,checkbox:{...checkbox,background:'purple'}}),false);assert.equal(validDesign({...canonical,checkbox:{...checkbox,borderColor:'blue'}}),false);
await saveDesign(store,{...canonical,checkbox,scrollbar},'owner@example.com');assert.deepEqual(saved.checkbox,checkbox);assert.deepEqual(saved.scrollbar,scrollbar);assert.match(saved._history.at(-1).text,/checkbox/);
console.log('Checkbox and scrollbar controls: optional legacy-compatible complete objects, bounds, colors and atomic persistence passed.');

const drawer={background:'navy',fill:90,rim:22,borderColor:'white',blur:28,saturation:180,radius:18,paddingX:12,paddingY:16};
const thinScrollbar={...scrollbar,version:2,width:4,length:50,hideAfter:800,autoHide:true};
assert.equal(validDesign({...canonical,drawer,scrollbar:thinScrollbar}),true);
for(const [key,max]of Object.entries({fill:100,rim:100,blur:40,saturation:200,radius:24,paddingX:40,paddingY:40})){for(const value of [0,max])assert.equal(validDesign({...canonical,drawer:{...drawer,[key]:value}}),true);for(const value of [-1,max+1,1.5,'1',null])assert.equal(validDesign({...canonical,drawer:{...drawer,[key]:value}}),false);}
for(const key of Object.keys(drawer)){const partial={...drawer};delete partial[key];assert.equal(validDesign({...canonical,drawer:partial}),false);}
for(const bad of [null,[],{...drawer,background:'url(evil)'},{...drawer,borderColor:'blue'},{...drawer,extra:1}])assert.equal(validDesign({...canonical,drawer:bad}),false);
for(const [key,valid,bad]of [['length',[25,50,100],[24,101,'50',null]],['hideAfter',[200,800,3000],[199,3001,'800',null]],['autoHide',[false,true],['true',0,null]],['version',[2],[1,3,'2',null]]]){for(const value of valid)assert.equal(validDesign({...canonical,scrollbar:{...thinScrollbar,[key]:value}}),true);for(const value of bad)assert.equal(validDesign({...canonical,scrollbar:{...thinScrollbar,[key]:value}}),false);}
await saveDesign(store,{...canonical,drawer,scrollbar:thinScrollbar},'owner@example.com');assert.deepEqual(saved.drawer,drawer);assert.deepEqual(saved.scrollbar,thinScrollbar);
console.log('Shared drawer and auto-hide scrollbar schema: legacy compatibility, bounded saved settings and atomic persistence passed.');
