"""Reconstruct tested v12 sources in a repository checkout. Safe to run twice.
Run: python relief-studio/source/tools/apply_release12.py
Uses only Python's standard library. No credentials or dependencies required.
"""
import base64, gzip, hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
site=root/'site' if (root/'site'/'upgrade12.json').exists() else root.parent
sha=lambda s:hashlib.sha256(s.encode('utf-8')).hexdigest()

def read_patch(version):
    manifest=json.loads((site/f'upgrade{version}.json').read_text(encoding='utf-8'))
    payload=b''.join(base64.b64decode(''.join((site/name).read_text(encoding='utf-8').split()),validate=True) for name in manifest['parts'])
    if manifest['version']!=version or hashlib.sha256(payload).hexdigest()!=manifest['sha256']:
        raise ValueError('Update beschädigt')
    return json.loads(gzip.decompress(payload))

p11=read_patch(11); p12=read_patch(12); planned={}
for name,change in p12['changes'].items():
    path=(root/name).resolve()
    if not path.is_relative_to(root.resolve()):raise ValueError('Ungültiger Pfad')
    if not path.exists():continue  # Historical tests may exist only in the complete download.
    text=path.read_text(encoding='utf-8')
    if sha(text)==change['result']:continue
    # Repository source can still be at v10 plus the published v11 delta.
    if sha(text)!=change['base'] and name in p11['changes']:
        previous=p11['changes'][name]
        if sha(text)==previous['base']:
            lines=text.split('\n')
            for start,count,add in reversed(previous['edits']):lines[start:start+count]=add
            text='\n'.join(lines)
    if sha(text)!=change['base']:raise ValueError('Lokale Änderungen zuerst sichern/abgleichen: '+name)
    lines=text.split('\n')
    for start,count,add in reversed(change['edits']):lines[start:start+count]=add
    text='\n'.join(lines)
    if sha(text)!=change['result']:raise ValueError('Prüfsumme stimmt nicht: '+name)
    planned[path]=text
for name,text in p12['added'].items():
    path=(root/name).resolve()
    if not path.is_relative_to(root.resolve()):raise ValueError('Ungültiger Pfad')
    if path.exists() and path.read_text(encoding='utf-8')!=text:
        raise ValueError('Vorhandene Datei weicht ab; zuerst sichern: '+name)
    planned[path]=text
# All hashes are checked before any write.
for path,text in planned.items():
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8')
print('Relief Studio 12 angewendet. Der vollständige historische Testsatz liegt im ZIP.')
