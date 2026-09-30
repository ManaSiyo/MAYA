"""Refresh the preview's source-only typography/color inventory (no execution)."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent.parent
pages=sorted([*root.glob('frontend/*.html'),*root.glob('backend/*.html'),*root.glob('playground/*.html'),root/'aesthetics/aesthetic-control.html',root/'aesthetics/operations/index.html'])
files={};pending=[]
def scan(path):
    if path in files or not path.is_file() or not path.is_relative_to(root):return
    text=path.read_text(); chunks=[]
    if path.suffix=='.html':
        for m in re.finditer(r'<style\b[^>]*>(.*?)</style>|\bstyle=["\'](.*?)["\']',text,re.S|re.I):chunks.append((m.group(1) or m.group(2) or '',text[:m.start()].count('\n')+1))
        for href in re.findall(r'<link\b[^>]*href=["\']([^"\']+)',text,re.I):
            if '.css' in href and not href.startswith(('http:','https:','//')):pending.append((root/href.lstrip('/') if href.startswith('/') else path.parent/href).with_name(Path(href.split('?')[0]).name))
    else:
        chunks=[(text,1)]
        for href in re.findall(r'@import\s+(?:url\()?\s*["\']([^"\']+)',text):pending.append((path.parent/href).resolve())
    styles={}
    for chunk,line in chunks:
        # Keep authored values; cascade resolution belongs to browser review.
        for m in re.finditer(r'(?<![\w-])(font(?:-family|-size|-weight|-style)?|line-height|letter-spacing|text-transform|color)\s*:\s*([^;{}\n]+)',chunk):
            prop,value=m.group(1),m.group(2).strip();styles.setdefault((prop,value),{'property':prop,'value':value,'line':line+chunk[:m.start()].count('\n')})
    files[path]={'path':str(path.relative_to(root)),'styles':list(styles.values())}
for p in pages:scan(p)
while pending:scan(pending.pop().resolve())
report={'pages':len(pages),'count':sum(len(f['styles']) for f in files.values()),'files':sorted(files.values(),key=lambda f:f['path'])}
(root/'aesthetics/aesthetic-control/style-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print(f"Scanned {report['pages']} pages, {len(files)} files, {report['count']} entries")
