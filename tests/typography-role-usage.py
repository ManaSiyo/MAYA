"""Audit authored UI role locations, not current pixels or live record totals."""
from pathlib import Path
import re,json
root=Path(__file__).resolve().parent.parent
files=sorted(p for folder in ['frontend','backend','playground','aesthetics'] for p in (root/folder).rglob('*') if p.suffix in ['.html','.js'] and 'aesthetics/aesthetic-control' not in str(p) and p.name!='aesthetic-control.html' and 'aesthetics/ui/components' not in str(p))
categories={k:{'count':0,'locations':[],'roles':{}} for k in ['H0','H1','H2','H3','H4','H5','H6','P1','P2','P3','P4']}
for path in files:
 text=path.read_text()
 # Preserve source line numbers. Exclude comments, retain JS-rendered markup.
 clean=re.sub(r'<!--.*?-->|(?m:^[ \t]*/\*).*?\*/|(?m:^[ \t]*//[^\n]*)',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
 for m in re.finditer(r'<(h[1-6]|textarea|select|input|time|span|div|p|small|label|button|a|td|th|code|pre|strong|b)\b([^<>]*?)>',clean,re.I):
  tag=m[1].lower();attrs=m[2].replace('\\"','"').replace("\\'","'");names={k.lower():v for k,q,v in re.findall(r'\b(id|class)\s*=\s*([\'"])(.*?)\2',attrs,re.S)}
  ident=names.get('id','');cls=set(names.get('class','').split());context=clean[max(0,m.start()-100):m.end()];category=None;reason=None
  role=None
  explicit=re.search(r'data-maya-type=[\'"]([^\'"]+)',attrs)
  if explicit and explicit[1] in categories:category,role=explicit[1],'field' if tag in ['input','select','textarea'] else 'label' if tag=='label' else 'drawer' if ident=='adm-tabtitle' else 'subheadline' if tag.startswith('h') else 'pill' if tag=='button' else 'paragraph'
  elif ident=='msg-name':category,role='H3','contact'
  elif 'lead-identity' in cls:category,role='H5','leadname'
  elif 'lead-signup' in cls:category,role='H6','leaddate'
  elif 'maya-signin-h0' in cls:category,role='H0','signin'
  elif tag=='h1' or cls & {'brand-title','signin-wordmark','brand-sample'} or ident=='client-name-modal-title':
   category='H1';role='editorial' if ident=='client-name-modal-title' else 'brand' if cls & {'brand-title','signin-wordmark','brand-sample'} else 'headline'
  elif ident=='adm-tabtitle' or cls & {'pg-tabtitle','drawer-title','drawer-head-title'} or (tag=='h2' and 'outbound-drawer' in context):category,role='H2','drawer'
  elif cls & {'grp','section-title'}:category,role='H3','adminsection'
  elif tag in ['h2','h3','h4','h5','h6']:category,role='H3','subheadline'
  elif path.name=='status.html' and tag=='div' and 'v' in cls and ('bl-step' in context or 'bl-tile' in context):category,role='H4','dashboard'
  elif tag=='strong' and ('class="stat"' in context or 'class="affiliate-stat"' in context):category,role='H4','dashboard'
  elif tag=='span' and ('class="stat"' in context or 'class="affiliate-stat"' in context):category,role='P2','label'
  elif tag in ['code','pre']:category,role='P1','technical'
  elif tag=='small' or cls & {'k','caption','bub-when','brand-status'}:category,role='P4','caption'
  elif tag in ['button','label'] or cls & {'status-pill','top-btn','caps'}:category,role='P3','pill'
  elif tag=='p':category,role='P1','paragraph'
  elif tag in ['td','th']:category,role='P1','table'
  elif cls & {'modal-hint','model-group','msg-main','note'}:category,role='P1','log' if 'msg-main' in cls else 'model' if 'model-group' in cls else 'paragraph'
  elif cls & {'metric-label','metric-value','label-count'}:category,role='P2','label'
  # Generic spans/divs are not assigned by guessed font size.
  reason=role
  # Generic spans/divs are not assigned by guessed font size.
  if not category:continue
  line=clean[:m.start()].count('\n')+1
  entry={'page':str(path.relative_to(root)),'line':line,'tag':tag,'id':ident or None,'class':names.get('class',''),'reason':reason,'role':role,'snippet':clean[m.start():min(m.end()+90,len(clean))].split('\n')[0][:160]}
  categories[category]['locations'].append(entry)
 # JS createElement headings/paragraphs are separate authored locations.
 for m in re.finditer(r'createElement\(\s*[\'"](h[1-6]|p|small|code|pre|button|label|td|th)[\'"]\s*\)',clean):
  tag=m[1];category='H1' if tag=='h1' else 'H3' if tag.startswith('h') else 'P1' if tag in ['code','pre'] else 'P4' if tag=='small' else 'P3' if tag in ['button','label'] else 'P1';role='headline' if tag=='h1' else 'subheadline' if tag.startswith('h') else 'technical' if tag in ['code','pre'] else 'caption' if tag=='small' else 'pill' if tag in ['button','label'] else 'paragraph'
  categories[category]['locations'].append({'page':str(path.relative_to(root)),'line':clean[:m.start()].count('\n')+1,'tag':tag,'id':None,'class':'','reason':'JavaScript-created '+tag,'role':role,'snippet':m[0]})
 # The second bottom-line number is assembled with an interpolated class and
 # cannot be parsed as a static opening tag. Count its authored template once.
 if path.name=='status.html':
  for m in re.finditer(r'const tile = \(v, k, cls\) =>',clean):
   categories['H4']['locations'].append({'page':str(path.relative_to(root)),'line':clean[:m.start()].count('\n')+1,'tag':'div','id':None,'class':'bl-tile v','reason':'dashboard','role':'dashboard','snippet':m[0]})
for value in categories.values():
 value['count']=len(value['locations'])
 for item in value['locations']:
  role=item['role'];bucket=value['roles'].setdefault(role,{'count':0,'locations':[]});bucket['count']+=1;bucket['locations'].append({'page':item['page'],'line':item['line']})
report={'method':'Mapped authored HTML and JavaScript role locations. A rendered template counts once; this is not a live DOM census. Categories equal the sum of visible role subtotals.','files':[str(p.relative_to(root)) for p in files],'categories':categories}
(root/'aesthetics/aesthetic-control/typography-usage.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'files':len(files),'counts':{k:v['count'] for k,v in categories.items()},'roles':{k:{r:q['count'] for r,q in v['roles'].items()} for k,v in categories.items()}}))
