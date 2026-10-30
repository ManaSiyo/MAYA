// Focused v13.51 fabric sourcing tests. No network or credentials required.
import assert from 'node:assert/strict';
import {
  applyVisualRankings,
  buildVisualRankingRequest,
  collectRetailerResults,
  fabricProductMatch,
  isFabricProduct,
  fabricSeedQueries,
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

test('qualified saved weaves reach visual review without turning sheen into a weave requirement',()=>{
  const piece={id:'coat',name:'Tailcoat',fabric:'Green embroidered satin-sheen woven',fabric_spec:{weave:'smooth woven, possibly twill-like',sheen:'moderate satin sheen',texture:'smooth'}};
  const satin={title:'Forest Green Polyester Satin Fabric',description:'Smooth polyester satin, sold by the yard.',image:'https://seller.example/green.jpg',evidence:'seller_listing'};
  const input={automatic:true,pieces:[piece],allowVisualOnly:true};
  const twill={...satin,title:'Forest Green Polyester Twill Fabric',description:'Smooth polyester twill, sold by the yard.'};
  assert.equal(fabricProductMatch(twill,input)?.garmentId,'coat','Satin sheen does not demand a satin weave');
  assert.equal(fabricProductMatch(satin,input)?.garmentId,'coat','An uncertain twill guess must reach the photo check');
  assert.equal(fabricProductMatch(satin,{...input,allowVisualOnly:false}),null,'An alternative to an inferred weave needs visual review');
  for(const request of ['Only twill','No satin'])assert.equal(fabricProductMatch(satin,{...input,automatic:false,request}),null,'Explicit construction constraints remain strict');
  assert.equal(fabricProductMatch(satin,{...input,pieces:[{...piece,fabric_spec:{weave:'twill',sheen:'moderate satin sheen'}}]}),null,'Sheen must not overwrite a definite saved twill weave');
  assert.equal(fabricProductMatch({...satin,title:'Red Polyester Satin Fabric'},input),null,'A qualified weave does not loosen color matching');
});

test('knit is a family, not a mandatory jersey construction',()=>{
  const piece={id:'jacket',name:'Track jacket',fabric:'Green synthetic-looking knit, possibly polyester tricot',fabric_spec:{weave:'knit-like',sheen:'subtle sheen',texture:'smooth'}};
  const tricot={title:'Forest Green Polyester Tricot Fabric',description:'Smooth warp knitted fabric with a satin finish. Sold by the yard.',image:'https://seller.example/tricot.jpg',evidence:'seller_listing'};
  const input={automatic:true,pieces:[piece],allowVisualOnly:true};
  assert.equal(fabricProductMatch(tricot,input)?.garmentId,'jacket');
  assert.equal(fabricProductMatch({...tricot,title:'Green Denim Fabric',description:'Cotton denim twill, sold by the yard.'},input),null,'Knit-like remains a knit-family hint, not any construction');
  assert.equal(fabricProductMatch(tricot,{...input,automatic:false,request:'Only jersey'}),null,'A specifically requested jersey is not every knit');
  assert.equal(fabricProductMatch(tricot,{...input,automatic:false,request:'No knit'}),null,'Knit exclusion includes tricot');
  assert.equal(fabricProductMatch(tricot,{...input,automatic:false,request:'No jersey'})?.garmentId,'jacket','One excluded subtype must not exclude every knit');
  assert.equal(fabricProductMatch(tricot,{...input,automatic:false,request:'Only interlock'}),null);
  assert.equal(fabricProductMatch(tricot,{...input,automatic:false,request:'No tricot'}),null);
  assert.doesNotMatch(fabricSeedQueries(input).join(' '),/jersey/,'Do not substitute jersey for the saved tricot/knit family');
});

test('saved dominant color and reptile texture inform bounded retailer seeds without accepting opposite colors',()=>{
  const jacket={id:'jacket',name:'Shag jacket',fabric:'Long-pile faux fur',fabric_hex:'#991b2a',fabric_spec:{fiber:'polyester',texture:'long-pile'}};
  const input={automatic:true,pieces:[jacket],preferences:['Leather','Denim'],allowVisualOnly:true};
  const ivory={title:'Plush Reversible Rabbit & Suede Polyester Faux Fur',description:'Both sides in creamy eggshell ivory. 100% polyester. Sold by the yard.',image:'https://seller.example/fur.jpg',evidence:'seller_listing'};
  assert.equal(fabricProductMatch(ivory,input),null,'White fur cannot satisfy a saved burgundy target just because texture matches');
  assert.equal(fabricProductMatch(ivory,{...input,pieces:[{...jacket,fabric_hex:''}],visualColors:{jacket:['red']}}),null,'Qualified color observation also covers legacy garments without a saved hex');
  assert.equal(fabricProductMatch(ivory,{...input,request:'Use ivory instead',automatic:false,visualColors:{jacket:['red']}})?.garmentId,'jacket');
  assert.equal(fabricProductMatch({...ivory,title:'Burgundy long pile faux fur',description:'Burgundy polyester faux fur, sold by the yard.'},input)?.garmentId,'jacket');
  assert.match(fabricSeedQueries(input)[0],/red/);assert.match(fabricSeedQueries(input)[0],/long pile/);
  assert.equal(fabricProductMatch(ivory,{...input,automatic:false,request:'Use ivory instead'})?.garmentId,'jacket','Explicit latest color replaces the saved hint');
  const built=buildVisualRankingRequest({garmentImage,traits:{garmentId:'jacket',garments:[jacket],resolvedSearch:'burgundy faux fur',referenceObservation:'The target appears deep berry red.'},products:[{...ivory,url:'https://seller.example/fur'}]});
  const context=JSON.parse(built.requestBody.messages[1].content[0].text.replace('TARGET GARMENT. Inferred fabric traits: ',''));
  assert.equal(context.savedColorHint,'red');assert.equal(context.referenceObservation,'The target appears deep berry red.');assert.equal(context.resolvedSearch,'burgundy faux fur');
  for(const garments of [null,{},[null]])assert.doesNotThrow(()=>buildVisualRankingRequest({garmentImage,traits:{garments},products:[{...ivory,url:'https://seller.example/fur'}]}));
  for(const hex of ['#gggggg','not a color','#888888','#333333'])assert.doesNotMatch(fabricSeedQueries({...input,pieces:[{...jacket,fabric_hex:hex}]}).join(' '),/red|white|black|gray/,'Invalid or ambiguous neutral hints do not invent a color requirement');
  const pants={id:'pants',name:'Private client trousers',fabric:'Crocodile-embossed coated leather',fabric_spec:{fiber:'leather',weave:'smooth grain',texture:'embossed'}};
  const queries=fabricSeedQueries({automatic:true,pieces:[pants]});assert.match(queries[0],/crocodile/);assert.doesNotMatch(queries.join(' '),/private|client|trousers/i);assert.ok(queries.length<=2);
  assert.doesNotMatch(fabricSeedQueries({automatic:true,pieces:[{...jacket,fabric:'Wool with crocodile leather appliqué'}]}).join(' '),/crocodile/,'Secondary applique does not become the base texture');
});

test('brocade and jacquard yardage remain eligible while unrelated weaves and tools fail',()=>{
  const base={url:'https://www.moodfabrics.com/products/metallic-black-and-gold-abstract-luxury-brocade-329451',title:'Metallic Black and Gold Abstract Luxury Brocade',description:'Metallic decorative cloth. Sold by the yard.',image:'https://seller.example/brocade.jpg',evidence:'seller_listing',availability:'unknown'};
  assert.equal(isFabricProduct(base),true);
  for(const weave of ['brocade','jacquard']){
    const piece={id:'coat',name:'Embellished coat',fabric:'Black '+weave,fabric_spec:{weave}};
    assert.equal(fabricProductMatch({...base,title:'Black '+weave,description:'Sold by the yard.'},{automatic:true,pieces:[piece]})?.garmentId,'coat');
    assert.equal(fabricProductMatch({...base,title:'Black cotton twill',description:'Sold by the yard.'},{automatic:true,pieces:[piece],allowVisualOnly:true}),null,'Visual review cannot bypass the requested weave');
    assert.equal(isFabricProduct({...base,title:weave+' fabric scissors'}),false);
  }
});

test('a wool base is not required to contain its leather applique or every whole-look preference',()=>{
  const coat={id:'coat',name:'Embellished coat',fabric:'Black brushed wool blend with cognac suede leather appliqué',fabric_spec:{fiber:'wool blend with leather appliqué',weave:'dense brushed twill',texture:'brushed, embellished'}};
  const wool={title:'Black brushed wool coating',description:'80% wool 20% nylon, sold by the yard.',composition:'80% wool 20% nylon',image:'https://seller.example/wool.jpg',evidence:'seller_listing'};
  for(const preferences of [['Denim','Leather'],JSON.stringify(['Denim','Leather']),['Denim or leather'],['Denim and leather'],'Denim, leather']){
    const input={automatic:true,pieces:[coat],piece:coat,preferences,allowVisualOnly:true};
    assert.equal(fabricProductMatch(wool,input)?.garmentId,'coat','Unknown inferred weave can be checked visually; base cloth need not contain its appliqué');
    const queries=fabricSeedQueries(input);assert.match(queries.join(' '),/wool/);assert.doesNotMatch(queries.join(' '),/denim|leather/);
    assert.equal(fabricProductMatch({...wool,title:'Black cotton jersey',composition:'100% cotton',description:'Cotton knit sold by the yard.'},input),null,'A known contradictory material is still excluded');
    for(const strict of [['Only denim'],['100% leather'],['No wool','Leather'],{coat:'Leather only'},{required:['Leather']}])assert.equal(fabricProductMatch(wool,{...input,preferences:strict}),null,'Explicit requirements and exclusions stay strict');
  }
  assert.equal(fabricProductMatch(wool,{automatic:true,pieces:[coat],preferences:['Denim','Leather']}),null,'Missing weave evidence is not silently confirmed without visual comparison');
  assert.equal(fabricProductMatch({...wool,title:'Black coating fabric',description:'Cloth sold by the yard.',composition:''},{automatic:true,pieces:[coat],preferences:'No polyester',allowVisualOnly:true}),null,'Unknown inferred fiber cannot bypass an explicit fiber exclusion');
  const blend={...coat,fabric:'Black wool blended with nylon',fabric_spec:{fiber:'wool and nylon',weave:'twill'}};
  assert.doesNotMatch(fabricSeedQueries({automatic:true,pieces:[blend]}).join(' '),/leather/);assert.match(fabricSeedQueries({automatic:true,pieces:[blend]}).join(' '),/nylon/,'A real blended fiber is preserved');
  assert.equal(fabricProductMatch(wool,{automatic:true,pieces:[coat],preferences:'Only wool with leather appliqué, no nylon',allowVisualOnly:true}),null,'Exclusions after a secondary material are retained');
});

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
  const jersey={title:'Green knit fabric',description:'Green knit sold by the yard.',image:fur.image};
  const jacket={id:'jacket',name:'Track jacket',fabric:'Green knit'},trousers={id:'pants',name:'Track pants',fabric:'Green knit'};
  assert.deepEqual(fabricProductMatch(jersey,{automatic:true,pieces:[jacket,trousers]}),{garment:'Track jacket & Track pants'},'Identical cloth can be shown for both garments without assigning a garment ID');
  assert.equal(fabricProductMatch(jersey,{automatic:true,pieces:[jacket,{...trousers,fabric:'Green knit for activewear'}]}),null,'Different materials stay ambiguous');
  assert.equal(fabricProductMatch(jersey,{automatic:true,pieces:[jacket,{...trousers,fabric_spec:{weave:'twill'}}]})?.garmentId,'jacket','A conflicting weave must not be treated as shared cloth');
});

console.log('\n' + (process.exitCode ? 'FAILED' : passed + ' passed') + '\n');
