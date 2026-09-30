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
