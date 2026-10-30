"""Reproducible, fresh encrypted GitHub-Pages bundle. Prototype PIN, not authentication."""
import base64,gzip,hashlib,json,secrets,re,shutil
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1]
site=root/'site';site.mkdir(exist_ok=True)
source_names=['index.html','style.css','favicon.svg','logo.svg','core.js','data.js','map.js','viewer.js','poster.js','app.js','worker.js']
files={'public/'+name:(root/'public'/name).read_text(encoding='utf-8') for name in source_names}
files['README.md']=(root/'README.md').read_text(encoding='utf-8')
raw=json.dumps({'version':10,'files':files},ensure_ascii=False,separators=(',',':')).encode()
compressed=gzip.compress(raw,compresslevel=9,mtime=0)
salt=secrets.token_bytes(16);iv=secrets.token_bytes(12);iterations=280000
key=hashlib.pbkdf2_hmac('sha256',b'2808',salt,iterations,32)
cipher=AESGCM(key).encrypt(iv,compressed,None)
parts=[]
for i in range(0,len(cipher),6000):
 name=f'bundle10-{i//6000}.b64';(site/name).write_text(base64.b64encode(cipher[i:i+6000]).decode()+'\n');parts.append(name)
manifest={'version':10,'salt':base64.b64encode(salt).decode(),'iv':base64.b64encode(iv).decode(),'iterations':iterations,'parts':parts}
(site/'bundle10.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
assert json.loads(gzip.decompress(AESGCM(key).decrypt(iv,cipher,None)))['files']==files
for name in ['favicon.svg','logo.svg','apple-touch-icon.png']:
 shutil.copy(root/'public'/name,site/name)
# Use a fresh gate, not a historical chain of patches.
gate=(root/'tools'/'../site/gate-v9.js')
# v9 file removed above: load reference from the original archive's new staging if necessary.
old=root/'tools'/'gate9.reference.js'
if not old.exists():raise RuntimeError('Gate reference missing: tools/gate9.reference.js')
s=old.read_text().replace('Studio v9','Studio v10').replace('bundle9.json','bundle10.json').replace('pack.version!==9','pack.version!==10').replace('m.version!==9','m.version!==10').replace('?v=9','?v=10').replace('Studio 9 wird','Studio 10 wird')
(site/'gate-v10.js').write_text(s)
html=(root/'tools'/'gate-index9.reference.html').read_text().replace('CARTOGRAPHIC ATELIER · 09','RELIEF STUDIO · 10').replace('gate-v9.js?v=9','gate-v10.js?v=10').replace('RELIEF STUDIO · 03','RELIEF STUDIO · 10').replace('#244d40','#183C36')
(site/'index.html').write_text(html)
assert 'gate-v10.js?v=10' in html and 'bundle10.json' in s and 'pack.version!==10' in s
print(json.dumps({'version':10,'parts':len(parts),'compressed':len(compressed),'cipher':len(cipher),'full':len(raw)}))