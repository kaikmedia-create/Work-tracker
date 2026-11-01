"""Apply the published v11 source delta once; safe to rerun.
Run from a GitHub checkout: python relief-studio/source/tools/apply_release11.py
No extra Python packages required. All old/new SHA-256 values are verified first.
"""
import base64,gzip,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
site=root/'site' if (root/'site'/'upgrade11.json').exists() else root.parent
manifest=json.loads((site/'upgrade11.json').read_text())
payload=b''.join(base64.b64decode((site/name).read_text()) for name in manifest['parts'])
assert manifest['version']==11 and hashlib.sha256(payload).hexdigest()==manifest['sha256'],'Update beschädigt'
patch=json.loads(gzip.decompress(payload));sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
planned={}
for name,c in patch['changes'].items():
    path=(root/name).resolve();assert path.is_relative_to(root.resolve()),'Ungültiger Pfad'
    if not path.exists():continue
    text=path.read_text()
    if sha(text)==c['result']:continue
    assert sha(text)==c['base'],'Lokale Änderungen zuerst sichern/abgleichen: '+name
    lines=text.split('\n')
    for start,count,add in reversed(c['edits']):lines[start:start+count]=add
    updated='\n'.join(lines);assert sha(updated)==c['result'],'Prüfsumme stimmt nicht: '+name
    planned[path]=updated
for name,text in patch['added'].items():
    path=(root/name).resolve();assert path.is_relative_to(root.resolve()),'Ungültiger Pfad';planned[path]=text
for path,text in planned.items():path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
print('Version 11 angewendet. Für den kompletten historischen Testsatz das Download-ZIP verwenden.')
