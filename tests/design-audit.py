"""Read-only, source-level CSS inventory. Counts are diagnostics, not a CSS parser."""
from pathlib import Path
import re,json,collections,hashlib
root=Path(__file__).resolve().parents[1]
files=sorted(set([*root.glob('frontend/**/*.html'),*root.glob('backend/**/*.html'),*root.glob('backend/*.js'),*root.glob('aesthetics/ui/*.js'),root/'playground/index.html',*root.glob('aesthetics/**/*.css'),*root.glob('aesthetics/operations/**/*.html')]))
files=[p for p in files if 'components' not in p.parts]
report=[];recipes=collections.defaultdict(list);archived=[]
for p in files:
 s=p.read_text();blocks=[s] if p.suffix=='.css' else re.findall(r'<style\b[^>]*>(.*?)</style>',s,re.S|re.I)
 inline=re.findall(r'\bstyle\s*=\s*["\']([^"\']*)',s)
 relevant=[]
 for b in blocks:
  for m in re.finditer(r'([^{}]+)\{([^{}]+)\}',b):
   selector,body=m.groups();declarations=re.findall(r'([\w-]+)\s*:\s*([^;{}]+)',body)
   material=[(k,v.strip()) for k,v in declarations if k in ['background','background-color','border','border-radius','box-shadow','backdrop-filter','-webkit-backdrop-filter','padding','font-size','font-weight','letter-spacing']]
   if material:
    key=json.dumps(sorted(material));recipes[key].append({'file':str(p.relative_to(root)),'selector':selector.strip()[-220:]})
   if 'backdrop-filter' in body or 'box-shadow' in body:
    relevant.append({'selector':selector.strip()[-220:],'declarations':dict(material)})
 report.append({'file':str(p.relative_to(root)),'styleBlocks':len(blocks),'inlineStyles':len(inline),'materialRules':len(relevant),'dynamicStyleAssignments':len(re.findall(r'\.style(?:\.|\[)|setAttribute\(["\']style',s))})
 archived.append({'file':str(p.relative_to(root)),'rules':relevant})
result={'method':'Heuristic source inventory; nested CSS/template strings require review. Does not claim every duplicate is a conflict. Runtime computed styles decide precedence.','files':report,'duplicateRecipes':[v for v in recipes.values() if len(v)>1]}
(root/'docs/design-archive/css-audit.json').write_text(json.dumps(result,indent=2)+'\n')
(root/'docs/design-archive/legacy-material-rules.json').write_text(json.dumps(archived,indent=2)+'\n')
print(f'{len(files)} files; {sum(r["inlineStyles"] for r in report)} inline styles; {len(result["duplicateRecipes"])} repeated declaration groups')
