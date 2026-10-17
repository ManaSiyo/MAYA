// Focused v13.51 fabric sourcing tests. No network or credentials required.
import assert from 'node:assert/strict';
import {
  applyVisualRankings,
  buildVisualRankingRequest,
  collectRetailerResults,
  fabricProductMatch,
} from '../docs/server/fabric-sourcing.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (error) {
    console.error('  FAIL ' + name + '  ' + error.message);
    process.exitCode = 1;
  }
}

const garmentImage = 'data:image/png;base64,iVBORw0KGgo=';
const products = [
  { merchant: 'Shop A', place: 'New York', title: 'Crimson wool twill', price: '22.00', currency: 'USD', etaDays: 5,
    url: 'https://shop.example/a', image: 'https://cdn.example/a.jpg' },
  { merchant: 'Shop B', place: 'London', title: 'Wine wool flannel', price: '31.00', currency: 'GBP', etaDays: 8,
    url: 'https://shop.example/b', image: 'https://cdn.example/b.jpg' },
];

console.log('\nMAYA fabric sourcing test\n');

test('ranking success returns ordered scores and reasons', () => {
  const built = buildVisualRankingRequest({ garmentImage, traits: { fiber: 'wool', weave: 'twill' }, products });
  const response = { choices: [{ message: { content: JSON.stringify({ rankings: [
    { id: 'fabric-2', score: 72, reason: 'Similar wine color and soft raised surface' },
    { id: 'fabric-1', score: 94, reason: 'Closest crimson tone with a visible diagonal twill' },
  ] }) } }] };
  const matches = applyVisualRankings(response, built.candidates);
  assert.deepEqual(matches.map(match => match.matchScore), [94, 72]);
  assert.equal(matches[0].title, 'Crimson wool twill');
  assert.match(matches[0].reason, /crimson/i);
});

test('one retailer failure does not discard successful inventory', () => {
  const collected = collectRetailerResults([
    [products[0]],
    { _miss: 'Unavailable Shop', why: 'http 503' },
    [products[1]],
  ]);
  assert.equal(collected.products.length, 2);
  assert.deepEqual(collected.misses, [{ _miss: 'Unavailable Shop', why: 'http 503' }]);
});

test('products without images are excluded from visual ranking', () => {
  const built = buildVisualRankingRequest({
    garmentImage,
    traits: {},
    products: [{ ...products[0], image: '' }, products[1]],
  });
  assert.equal(built.candidates.length, 1);
  assert.equal(built.candidates[0].title, products[1].title);
});

test('all missing candidate images trigger the fallback condition', () => {
  assert.throws(() => buildVisualRankingRequest({
    garmentImage,
    traits: {},
    products: products.map(product => ({ ...product, image: '' })),
  }), error => error.status === 422 && error.message === 'missing_candidate_images');
});

test('the ranking request model follows the tier env vars', () => {
  // v13.53: no hardcoded model. RANK_MODEL wins, then MODEL_TERRA, then the
  // Terra default, so a model change is an env change and nothing else.
  const built = buildVisualRankingRequest({ garmentImage, traits: {}, products });
  const expected = process.env.RANK_MODEL || process.env.MODEL_TERRA || process.env.MODEL_LUNA || 'gpt-6-luna';
  assert.equal(built.requestBody.model, expected);
});

test('an invalid model response triggers the fallback condition', () => {
  const built = buildVisualRankingRequest({ garmentImage, traits: {}, products });
  assert.throws(() => applyVisualRankings({ choices: [] }, built.candidates),
    error => error.status === 502);
});

test('tools are excluded before ranking and low-confidence materials stay absent',()=>{
  const scissors={...products[0],title:'Professional fabric scissors'};
  assert.equal(collectRetailerResults([[scissors,...products]]).products.length,2);
  const built=buildVisualRankingRequest({garmentImage,traits:{},products:[scissors,...products]});
  assert.equal(built.candidates.length,2);
  assert.equal(built.candidates[0].etaDays,undefined,'No invented seven-day delivery');
  const result=applyVisualRankings({choices:[{message:{content:JSON.stringify({rankings:[{id:'fabric-1',score:35,reason:'Only the shop is similar'}]})}}]},built.candidates);
  assert.deepEqual(result,[],'A valid empty recommendation set must not trigger unrelated fallback');
});
test('saved denim excludes leather and tools while multi-piece captions use the matching garment',()=>{
  const pieces=[{name:'Denim top',fabric:'indigo cotton denim'},{name:'White shirt',fabric:'white cotton poplin'},{name:'Black leather boots',fabric:'black leather'}];
  const match=product=>fabricProductMatch({image:'https://cdn.example/fabric.jpg',evidence:'seller_listing',...product},{automatic:true,pieces});
  assert.deepEqual(match({title:'Indigo cotton denim',description:'Sold by the yard'}),{garment:'Denim top'});
  assert.deepEqual(match({title:'White cotton poplin',description:'Sold by the yard'}),{garment:'White shirt'});
  assert.equal(match({title:'Black leather',description:'Leather hides'}),null);
  assert.equal(match({title:'Fabric scissors',description:'Cut denim, cotton or wool'}),null);
  assert.equal(match({title:'Red cotton poplin',description:'Sold by the yard'}),null);
  assert.equal(match({title:'White cotton poplin',image:'',description:'No actual product photo'}),null);
});

test('latest positive, negative, construction and color constraints remain independent',()=>{
  const cotton={title:'White cotton poplin fabric',description:'100% cotton, sold by the yard.',image:'https://cdn.example/cotton.jpg'};
  const wool={title:'White wool twill fabric',description:'100% wool, sold by the yard.',image:'https://cdn.example/wool.jpg'};
  assert.ok(fabricProductMatch(cotton,{request:'cotton, no wool'}));
  assert.ok(fabricProductMatch(cotton,{request:'Use cotton instead',piece:{fabric:'white wool'}}));
  assert.equal(fabricProductMatch(wool,{request:'cotton, no wool'}),null);
  assert.equal(fabricProductMatch({...cotton,description:'60% cotton 40% polyester, sold by the yard.'},{request:'white cotton poplin',preferences:'no polyester'}),null);
  assert.ok(fabricProductMatch(cotton,{request:'less shiny',history:[{request:'white cotton poplin, no polyester'}]}));
  assert.ok(fabricProductMatch({...cotton,description:cotton.description+' Matte surface.'},{request:'less shiny',history:[{request:'white cotton poplin, no polyester'}]}));
  assert.equal(fabricProductMatch({...cotton,description:cotton.description+' Shiny surface.'},{request:'less shiny',history:[{request:'white cotton poplin, no polyester'}]}),null,'Less shiny must not become a positive shiny constraint');
  assert.equal(fabricProductMatch({...cotton,title:'White cotton jersey fabric'},{automatic:true,piece:{fabric:'white cotton poplin'}}),null);
  assert.equal(fabricProductMatch({...cotton,title:'Red cotton poplin fabric'},{automatic:true,piece:{fabric:'white cotton poplin'}}),null);
  assert.equal(fabricProductMatch({...cotton,title:'Cotton shirt, size M',description:'Ready-to-wear cotton garment.'},{request:'cotton'}),null);
  assert.equal(fabricProductMatch({...cotton,title:'Indigo denim jacket',description:'Cotton denim, ready-to-wear.'},{automatic:true,piece:{fabric:'indigo denim'}}),null);
  assert.ok(fabricProductMatch({...cotton,title:'Cotton shirting fabric for shirts'},{request:'cotton'}));
  assert.ok(fabricProductMatch({...cotton,description:"100% cotton fabric, suitable for a women's shirt."},{request:'cotton'}),'Suggested garment use does not make yardage ready-to-wear');
  assert.equal(fabricProductMatch({...cotton,title:'Cotton socks',description:'Made from cotton fabric. Sold by the manufacturer.'},{request:'cotton'}),null);
  assert.equal(fabricProductMatch({...cotton,title:'Wool yarn skein',description:'Wool for knitting.'},{request:'wool'}),null);
  assert.ok(fabricProductMatch({...cotton,description:'Cotton fabric suitable for ready-to-wear shirts. Sold by the yard.'},{request:'cotton'}));
  assert.ok(fabricProductMatch({...cotton,title:'Metallic thread cotton fabric'},{request:'cotton'}),'A woven metallic thread is not a sewing notion');
});
test('visual ranking carries sourced facts and explicit words without treating guesses as facts',()=>{
  const built=buildVisualRankingRequest({garmentImage,traits:{request:'Matte denim, no polyester',preferences:'Natural fibers',garments:[{id:'denim-1',name:'Jacket',fabric:'blue denim'},{id:'shirt-2',name:'Shirt',fabric:'white cotton poplin'}]},products:[{...products[0],description:'100% cotton, brushed denim',composition:'100% cotton',garment:'Jacket',garmentId:'denim-1'}]});
  const prompt=JSON.stringify(built.requestBody.messages);
  assert.match(prompt,/Matte denim, no polyester/);assert.match(prompt,/Natural fibers/);assert.match(prompt,/100% cotton, brushed denim/);assert.match(prompt,/Jacket/);
  assert.match(prompt,/denim-1/);assert.match(prompt,/shirt-2/);assert.match(prompt,/white cotton poplin/);
});
test('whole-look garment preferences cannot turn a faux-fur coat into the pants leather',()=>{
  const coat={id:'coat',name:'Fur coat',fabric:'Brown faux fur',fabric_spec:{fiber:'acrylic',texture:'long pile'}};
  const pants={id:'pants',name:'Green alligator pants',fabric:'Green embossed leather',fabric_spec:{fiber:'leather'}};
  const fur={title:'Brown faux fur fabric',description:'100% acrylic long pile fabric. Sold by the yard.',composition:'100% acrylic',image:'https://cdn.example/fur.jpg'};
  const leather={title:'Emerald green alligator embossed leather fabric',description:'Green leather. Sold by the yard.',composition:'leather',image:'https://cdn.example/leather.jpg'};
  for(const preferences of ['Brown faux fur for the coat; green alligator leather for the pants',['Brown faux fur for the coat','green alligator leather for the pants'],{coat:'Brown faux fur',pants:'green alligator leather'},JSON.stringify({coat:'Brown faux fur',pants:'green alligator leather'})]){
    const full={automatic:true,pieces:[coat,pants],preferences,allowVisualOnly:true};
    assert.equal(fabricProductMatch(fur,full)?.garmentId,'coat');assert.equal(fabricProductMatch(leather,full)?.garmentId,'pants');
    const selected={...full,pieces:[coat],piece:coat,allPieces:[coat,pants]};
    assert.equal(fabricProductMatch(fur,selected)?.garmentId,'coat');assert.equal(fabricProductMatch(leather,selected),null);
    assert.equal(fabricProductMatch(fur,{...full,pieces:[pants],piece:pants,allPieces:[coat,pants]}),null);
  }
  const global={automatic:true,pieces:[coat,pants],preferences:{coat:'Brown faux fur',pants:'green leather',exclude:['polyester']},allowVisualOnly:true};
  assert.equal(fabricProductMatch({...fur,composition:'70% acrylic 30% polyester'},global),null,'Global exclusions survive each scoped positive clause');
  assert.equal(fabricProductMatch({...fur,composition:'70% acrylic 30% polyester'},{...global,preferences:'No polyester, green leather for pants'}),null,'A following garment clause does not swallow a global exclusion');
  assert.equal(fabricProductMatch({...fur,composition:'70% acrylic 30% wool'},{...global,preferences:'No polyester, wool or nylon'}),null,'Comma-separated exclusions stay exclusions');
  assert.equal(fabricProductMatch({...fur,title:'Faux Fur - Chocolate'},global)?.garmentId,'coat','Real acrylic faux-fur yardage does not need the literal word fabric in its title');
  assert.equal(fabricProductMatch(leather,{...global,pieces:[coat],allPieces:[coat,pants],request:'green leather',automatic:false}),null,'A new generic material request does not remove incompatible saved construction');
});
test('scoped latest refinements and qualified inferred fibers preserve garment intent',()=>{
  const coat={id:'coat',name:'Coat',fabric:'Brown faux fur',fabric_spec:{fiber:'possibly wool; exact fiber unknown'}};
  const pants={id:'pants',name:'Pants',fabric:'Green leather'};
  const fur={title:'Brown acrylic faux fur fabric',description:'Acrylic long pile. Sold by the yard.',image:'https://cdn.example/fur.jpg'};
  assert.equal(fabricProductMatch(fur,{automatic:true,pieces:[coat,pants],preferences:'Brown faux fur for the coat; green leather for pants',allowVisualOnly:true})?.garmentId,'coat','Qualified wool inference does not become an exact fiber requirement');
  const blue={...fur,title:'Blue acrylic faux fur fabric'};
  assert.equal(fabricProductMatch(blue,{piece:coat,pieces:[coat],allPieces:[coat,pants],preferences:'Brown for the coat; green leather for pants',history:[{request:'Use blue for the coat'}],request:'less shiny'})?.garmentId,'coat');
  assert.equal(fabricProductMatch({...fur,description:'Acrylic and polyester long pile.'},{piece:coat,preferences:'No polyester',request:'brown faux fur'}),null);
  const generic={id:'coat',name:'Coat',fabric:'unknown'};
  assert.equal(fabricProductMatch({title:'Green leather fabric',image:fur.image},{automatic:true,pieces:[generic,pants],allowVisualOnly:true})?.garmentId,'pants','Concrete material evidence wins over a generic first garment');
  assert.equal(fabricProductMatch(fur,{automatic:true,pieces:[{id:'one',name:'Coat',fabric:'Brown faux fur'},{id:'two',name:'Coat',fabric:'Brown faux fur'}]}),null,'An ambiguous full-look attribution is not assigned to the first garment');
});

console.log('\n' + (process.exitCode ? 'FAILED' : passed + ' passed') + '\n');
