// Validated owner design settings. No CSS strings or arbitrary paths.
export const DESIGN_PATH = 'config/typography-controls.json';
const DESIGN_ROLES = new Set(['H1','H2','H3','H4','P1','P2','P3','P4','P5']);
export function validDesign(body) {
  if (!body || typeof body !== 'object' || !body.type || !body.glass || !body.overlay) return false;
  if (Object.keys(body).some(k => !['type','glass','overlay','finish','pillX','pillY'].includes(k))) return false;
  if (Object.keys(body.type).length !== DESIGN_ROLES.size ||
      Object.keys(body.type).some(k => !DESIGN_ROLES.has(k))) return false;
  for (const v of Object.values(body.type)) {
    if (Object.keys(v || {}).some(k => !['size','weight','color'].includes(k))) return false;
    if (!v || !Number.isInteger(v.size) || v.size < 8 || v.size > 32 || v.size % 2 ||
        ![300,350,400].includes(v.weight) || !['white','gray'].includes(v.color)) return false;
  }
  const sizes=['H1','H2','H3','H4','P1','P2','P3','P4','P5'].map(k=>body.type[k].size);
  if (sizes.slice(0,4).some((n,i)=>i&&n>=sizes[i-1]) ||
      sizes.slice(4).some((n,i)=>i&&n>sizes[i+3])) return false;
  for (const [obj,keys] of [[body.glass,['fill','tint','rim','highlight','blur','saturation']],
                            [body.overlay,['fill','rim','blur','saturation']]]) {
    if (Object.keys(obj).some(k => !keys.includes(k) && !(obj===body.overlay && k==='enabled' && typeof obj.enabled==='boolean'))) return false;
    for (const k of keys) if (!Number.isInteger(obj[k]) || obj[k] < 0 || obj[k] > (k === 'saturation' ? 200 : k === 'blur' ? 40 : 100)) return false;
  }
  return ['current','liquid','clear'].includes(body.finish) &&
    Number.isInteger(body.pillX) && body.pillX >= 4 && body.pillX <= 32 &&
    Number.isInteger(body.pillY) && body.pillY >= 2 && body.pillY <= 16;
}
