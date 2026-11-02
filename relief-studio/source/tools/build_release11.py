"""Build an integrity-checked delta on the already deployed v10 package.
No passwords, auth.local.json, customer projects or credentials enter this patch.
"""
import base64,difflib,gzip,hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=Path('/mnt/data/Relief-Studio-10-komplett.zip')
old=zipfile.ZipFile(base)
paths=['public/data.js','public/app.js','public/index.html','server.mjs','package.json','tests/v10.test.mjs']
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
changes={}
for name in paths:
    before=old.read('relief-studio/'+name).decode();after=(root/name).read_text()
    edits=[]
    for op,a,b,c,d in difflib.SequenceMatcher(None,before.split('\n'),after.split('\n'),autojunk=False).get_opcodes():
        if op!='equal':edits.append([a,b-a,after.split('\n')[c:d]])
    changes[name]={'base':sha(before),'result':sha(after),'edits':edits}
added={name:(root/name).read_text() for name in ['tests/v11.test.mjs','tests/v11_browser.py','tests/v11_stress.mjs','tests/v11_gate.test.mjs','tools/apply_release11.py','TEST-REPORT-11.md','RELEASE-NOTES-11.md']}
patch={'version':11,'changes':changes,'added':added}
raw=json.dumps(patch,ensure_ascii=False,separators=(',',':')).encode();payload=gzip.compress(raw,mtime=0,compresslevel=9)
site=root/'site';parts=[]
for i in range(0,len(payload),6000):
    name=f'upgrade11-{i//6000}.b64';(site/name).write_text(base64.b64encode(payload[i:i+6000]).decode());parts.append(name)
manifest={'version':11,'parts':parts,'sha256':hashlib.sha256(payload).hexdigest()}
(site/'upgrade11.json').write_text(json.dumps(manifest,separators=(',',':')))
# Gate retains the existing source package, but refuses a mixed/stale patch.
gate=(site/'gate-v10.js').read_text().replace('Studio v10','Studio v11').replace('?v=10','?v=11').replace('Studio 10 wird','Studio 11 wird')
needle="  let html=files['public/index.html'];"
insert="""  const upgrade=await (await get('upgrade11.json')).json();
  if(upgrade.version!==11||!Array.isArray(upgrade.parts)||upgrade.parts.length>20)throw Error('Ungültiges Updatepaket.');
  const packed=await combine(upgrade.parts),hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),b=>b.toString(16).padStart(2,'0')).join('');
  if(await hash(packed)!==upgrade.sha256)throw Error('Update unvollständig. Bitte vollständig neu laden.');
  const patch=JSON.parse(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if(patch.version!==11)throw Error('Falsche Updateversion.');
  for(const [name,c] of Object.entries(patch.changes)){
   if(!(name in files))continue;
   if(await hash(files[name])!==c.base)throw Error('Programmstand passt nicht zum Update: '+name);
   const lines=files[name].split('\\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\\n');if(await hash(value)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=value;
  }
  Object.assign(files,patch.added);pack.version=11;
"""
assert needle in gate;gate=gate.replace(needle,insert+needle)
# A decrypted script must never terminate its surrounding inline script tag.
gate=gate.replace("replaceAll('</','<\\/')", "replaceAll('</','<\\\\/')").replace("replaceAll('</script','<\\/script')", "replaceAll('</script','<\\\\/script')")
(site/'gate-v11.js').write_text(gate)
index=(site/'index.html').read_text().replace('STUDIO · 10','STUDIO · 11').replace('gate-v10.js?v=10','gate-v11.js?v=11')
(site/'index.html').write_text(index)
(root/'reports'/'v11'/'patch-build.json').write_text(json.dumps({'patchBytes':len(payload),'parts':len(parts),'changes':list(changes),'added':list(added)},indent=2))
print(json.dumps({'patchBytes':len(payload),'parts':parts,'manifest':manifest},indent=2))
