"""Build authenticated encrypted v5 incremental patch from the known deployed v4 base."""
from pathlib import Path
import json,base64,hashlib,gzip,difflib,secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1]
oldsite=root/'site'
base3=json.loads(Path('/mnt/data/relief-deploy-work/reconstructed_v3.json').read_text())
man=json.loads((oldsite/'bundle.json').read_text())
key=hashlib.pbkdf2_hmac('sha256',b'2808',base64.b64decode(man['salt']),man['iterations'],32)
# Validate that our local v4 files agree with the actual v3->v4 gateway patch.
m4=json.loads((oldsite/'upgrade4.json').read_text())
encrypted=b''.join(base64.b64decode((oldsite/n).read_text().strip()) for n in m4['parts'])
delta4=json.loads(gzip.decompress(AESGCM(key).decrypt(base64.b64decode(m4['iv']),encrypted,None)))
assert delta4['version']==4
files=base3.copy()
for path,change in delta4['changes'].items():
 old=files.get(path,'');assert hashlib.sha256(old.encode()).hexdigest()==change['base'],path
 lines=old.split('\n')
 for start,count,added in reversed(change['edits']):lines[start:start+count]=added
 value='\n'.join(lines)
 assert hashlib.sha256(value.encode()).hexdigest()==change['result'],path
 files[path]=value
 forpath=Path("/mnt/data/relief-deploy-work/relief-studio")/path
 if forpath.is_file():assert forpath.read_text()==value,'Local v4 file changed unexpectedly: '+path

# Build incremental patch against committed v4 exact bytes.
paths=['public/map.js','public/data.js','public/core.js','public/poster.js','public/viewer.js','public/app.js','public/index.html','server.mjs','README.md','TEST-REPORT.md','package.json','tests/v5.test.mjs','tests/stress_browser.py','tests/stress_server.py']
changes={}
for path in paths:
 target=(root/path)
 if not target.is_file():continue
 before=files.get(path,'');after=target.read_text()
 if before==after:continue
 a=before.split('\n');b=after.split('\n')
 edits=[[i1,i2-i1,b[j1:j2]] for op,i1,i2,j1,j2 in difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes() if op!='equal']
 test=a[:]
 for start,count,lines in reversed(edits):test[start:start+count]=lines
 assert '\n'.join(test)==after,path
 changes[path]={'base':hashlib.sha256(before.encode()).hexdigest(),'result':hashlib.sha256(after.encode()).hexdigest(),'edits':edits}
 print(path,len(edits),'edits')
patch={'version':5,'changes':changes}
payload=json.dumps(patch,ensure_ascii=False,separators=(',',':')).encode()
compressed=gzip.compress(payload,compresslevel=9,mtime=0)
iv=secrets.token_bytes(12);cipher=AESGCM(key).encrypt(iv,compressed,None)
newparts=[]
for i in range(0,len(cipher),5700):
 name=f'upgrade5-{i//5700}.b64'
 (oldsite/name).write_text(base64.b64encode(cipher[i:i+5700]).decode()+'\n')
 newparts.append(name)
(oldsite/'upgrade5.json').write_text(json.dumps({'version':5,'iv':base64.b64encode(iv).decode(),'parts':newparts},separators=(',',':'))+'\n')
# Round-trip all content before upload.
p5=json.loads(gzip.decompress(AESGCM(key).decrypt(iv,b''.join(base64.b64decode((oldsite/name).read_text()) for name in newparts),None)))
assert p5['version']==5
for name,change in p5['changes'].items():
 old=files.get(name,'');assert hashlib.sha256(old.encode()).hexdigest()==change['base'],name
 lines=old.split('\n')
 for index,count,more in reversed(change['edits']):lines[index:index+count]=more
 result='\n'.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==change['result'],name
 assert result==(root/name).read_text(),name
print(json.dumps({'files':len(changes),'patch_plain_bytes':len(payload),'encrypted_bytes':len(cipher),'parts':newparts},indent=2))
