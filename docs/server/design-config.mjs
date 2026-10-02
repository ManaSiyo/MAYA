// Validated owner design settings. No CSS strings or arbitrary paths.
export const DESIGN_PATH = 'config/typography-controls.json';
const DESIGN_ROLES = new Set(['H1','H2','H3','H4','P1','P2','P3','P4']);
export function validDesign(body) {
  if (!body || typeof body !== 'object' || !body.type || !body.glass || !body.overlay) return false;
  if (Object.keys(body).some(k => !['type','glass','overlay','finish','pillX','pillY','editor','inner','filter','table','iconSize','dropdownHeight'].includes(k))) return false;
  for(const k of ['iconSize','dropdownHeight'])if(body[k]!==undefined&&(!Number.isInteger(body[k])||body[k]<24||body[k]>48))return false;
  const legacy=Object.hasOwn(body.type,'P5');
  const roles=legacy?new Set([...DESIGN_ROLES,'P5']):DESIGN_ROLES;
  if (Object.keys(body.type).length !== roles.size ||
      Object.keys(body.type).some(k => !roles.has(k))) return false;
  for (const v of Object.values(body.type)) {
    if (Object.keys(v || {}).some(k => !['size','weight','color','align','font','case','vertical'].includes(k))) return false;
    if(v?.font!==undefined&&!['jost','cormorant'].includes(v.font))return false;
    if(v?.case!==undefined&&!['none','uppercase'].includes(v.case))return false;
    if(v?.vertical!==undefined&&!['top','middle','bottom'].includes(v.vertical))return false;
    if (v?.align!==undefined && !['left','center','right'].includes(v.align)) return false;
    if (!v || !Number.isInteger(v.size) || v.size < 8 || v.size > 32 || v.size % 2 ||
        ![300,350,400].includes(v.weight) || !['white','gray'].includes(v.color)) return false;
  }
  const sizes=[...roles].map(k=>body.type[k].size);
  if (sizes.slice(0,4).some((n,i)=>i&&n>=sizes[i-1]) ||
      sizes.slice(4).some((n,i)=>i&&n>sizes[i+3])) return false;
  for (const [obj,keys] of [[body.glass,['fill','tint','rim','highlight','blur','saturation']],
                            [body.overlay,['fill','rim','blur','saturation']]]) {
    if(obj===body.overlay)for(const k of ['paddingX','paddingY'])if(obj[k]!==undefined&&(!Number.isInteger(obj[k])||obj[k]<0||obj[k]>40))return false;
    if (Object.keys(obj).some(k => !keys.includes(k) && !(obj===body.overlay&&['paddingX','paddingY'].includes(k)) && !(obj===body.overlay && k==='enabled' && typeof obj.enabled==='boolean'))) return false;
    for (const k of keys) if (!Number.isInteger(obj[k]) || obj[k] < 0 || obj[k] > (k === 'saturation' ? 200 : k === 'blur' ? 40 : 100)) return false;
  }
  if(body.editor!==undefined){
    if(!body.editor || Object.keys(body.editor).some(k=>!['fill','rim','radius','padding'].includes(k)))return false;
    for(const [k,max] of [['fill',100],['rim',100],['radius',24],['padding',20]])if(!Number.isInteger(body.editor[k])||body.editor[k]<0||body.editor[k]>max)return false;
  }
  const numeric=(obj,ranges)=>obj&&Object.entries(ranges).every(([k,max])=>Number.isInteger(obj[k])&&obj[k]>=0&&obj[k]<=max);
  for(const key of ['inner','filter'])if(body[key]!==undefined){
    const ranges={fill:100,rim:100,radius:24,paddingX:40,paddingY:40,width:key==='filter'?600:100};
    if(!numeric(body[key],ranges)||Object.keys(body[key]).some(k=>!Object.hasOwn(ranges,k))||body[key].width<(key==='filter'?160:20))return false;
  }
  if(body.table!==undefined){
    const t=body.table,types=['font','size','weight','color','case','align','vertical'],backgrounds=['background','opacity'];
    const typeValid=s=>s&&['jost','cormorant'].includes(s.font)&&['none','uppercase'].includes(s.case)&&['white','gray'].includes(s.color)&&['left','center','right'].includes(s.align)&&['top','middle','bottom'].includes(s.vertical)&&Number.isInteger(s.size)&&s.size>=8&&s.size<=32&&[300,350,400].includes(s.weight);
    const bgValid=s=>s&&['black','gray','blue','yellow','green','pink'].includes(s.background)&&Number.isInteger(s.opacity)&&s.opacity>=0&&s.opacity<=100;
    if(!numeric(t,{fill:100,rim:100,paddingX:40,paddingY:40})||Object.keys(t).some(k=>!['background','fill','rim','paddingX','paddingY','header','firstColumn','columns','cells'].includes(k)))return false;
    if(t.background!==undefined&&!['black','gray','blue','yellow','green','pink'].includes(t.background))return false;
    if(!typeValid(t.header)||!bgValid(t.header)||Object.keys(t.header).some(k=>![...types,...backgrounds].includes(k)))return false;
    if(!bgValid(t.firstColumn)||Object.keys(t.firstColumn).some(k=>!backgrounds.includes(k)))return false;
    if(t.cells!==undefined&&(!t.cells||Array.isArray(t.cells)||typeof t.cells!=='object'||Object.keys(t.cells).length>100||Object.entries(t.cells).some(([key,s])=>!/^(stage|note)-(0|[1-9][0-9]?)$/.test(key)||!typeValid(s)||!bgValid(s)||Object.keys(s).some(k=>![...types,...backgrounds].includes(k)))))return false;
    if(!Array.isArray(t.columns)||t.columns.length!==3||t.columns.some(s=>!typeValid(s)||Object.keys(s).some(k=>!types.includes(k))))return false;
  }
  return ['current','liquid','clear'].includes(body.finish) &&
    Number.isInteger(body.pillX) && body.pillX >= 4 && body.pillX <= 32 &&
    Number.isInteger(body.pillY) && body.pillY >= 2 && body.pillY <= 16;
}

// Settings and their audit trail share one atomic, generation-checked object.
// The public design route strips the owner-only history before responding.
export async function saveDesign(store, value, who, now = () => new Date().toISOString()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await store.read(DESIGN_PATH);
    if (!found.ok && found.status !== 404) throw new Error('design storage unavailable');
    if (found.ok && !found.generation) throw new Error('design revision unavailable');
    const previous = found.ok ? JSON.parse(found.buf.toString('utf8')) : {};
    const changed = Object.keys(value).filter(key => JSON.stringify(value[key]) !== JSON.stringify(previous[key]));
    const savedAt = now();
    const history = [...(Array.isArray(previous._history) ? previous._history : []),
      {ts:savedAt,who:String(who || 'Admin').slice(0,160),source:'design',state:'saved',
       text:'Aesthetic Control saved' + (changed.length ? ': ' + changed.join(', ') : ' · settings unchanged')}].slice(-100);
    try {
      await store.write(DESIGN_PATH, Buffer.from(JSON.stringify({...value,_history:history})), 'application/json', found.ok ? found.generation : '0');
      return {savedAt};
    } catch (e) { if (e.status !== 412 || attempt === 4) throw e; }
  }
}
