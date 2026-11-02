"""Build a small hash-verified v12 source delta over the deployed v11 package.
Usage: python tools/build_release12.py /path/to/Relief-Studio-11-komplett.zip
The resulting files never contain auth.local.json or credentials.
"""
import base64,difflib,gzip,hashlib,json,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];site=root/'site'
base=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/Relief-Studio-11-komplett.zip')
old=zipfile.ZipFile(base);sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
paths=['public/core.js','public/app.js','public/data.js','public/index.html','public/viewer.js','public/worker.js','server.mjs','package.json','tools/standalone.py','tests/fixture.mjs','tests/core.test.mjs','tests/workflow_browser.py']
changes={}
for name in paths:
    before=old.read('relief-studio/'+name).decode();after=(root/name).read_text()
    if before==after:continue
    A=before.split('\n');B=after.split('\n');edits=[]
    for op,a,b,c,d in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes():
        if op!='equal':edits.append([a,b-a,B[c:d]])
    changes[name]={'base':sha(before),'result':sha(after),'edits':edits}
added_names=['public/architecture.js','tests/architecture_v12.test.mjs','tests/architecture_browser.py','tests/architecture_stress.mjs','tests/v12_gate.test.mjs','tools/apply_release12.py','tools/build_release12.py','TEST-REPORT-12.md','RELEASE-NOTES-12.md']
added={name:(root/name).read_text() for name in added_names}
raw=json.dumps({'version':12,'changes':changes,'added':added},ensure_ascii=False,separators=(',',':')).encode()
payload=gzip.compress(raw,mtime=0,compresslevel=9);parts=[]
for i in range(0,len(payload),6000):
    name=f'upgrade12-{i//6000}.b64';(site/name).write_text(base64.b64encode(payload[i:i+6000]).decode());parts.append(name)
manifest={'version':12,'parts':parts,'sha256':hashlib.sha256(payload).hexdigest()};(site/'upgrade12.json').write_text(json.dumps(manifest,separators=(',',':')))
gate=(site/'gate-v11.js').read_text().replace('Studio v11','Studio v12').replace('?v=11','?v=12').replace('Studio 11 wird','Studio 12 wird')
needle="  let html=files['public/index.html'];"
insert="""  const u12=await (await get('upgrade12.json')).json();
  if(u12.version!==12||!Array.isArray(u12.parts)||u12.parts.length>20)throw Error('Ungültiges Architektur-Update.');
  const p12bytes=await combine(u12.parts);if(await hash(p12bytes)!==u12.sha256)throw Error('Architektur-Update unvollständig. Bitte neu laden.');
  const p12=JSON.parse(await new Response(new Blob([p12bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if(p12.version!==12)throw Error('Falsche Architekturversion.');
  for(const [name,c] of Object.entries(p12.changes)){
   if(!(name in files))continue;
   if(await hash(files[name])!==c.base)throw Error('Programmstand passt nicht zu Version 12: '+name);
   const lines=files[name].split('\\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\\n');if(await hash(value)!==c.result)throw Error('Architektur-Prüfsumme stimmt nicht: '+name);files[name]=value;
  }
  Object.assign(files,p12.added);pack.version=12;
"""
assert needle in gate;gate=gate.replace(needle,insert+needle)
gate=gate.replace("const worker=files['public/core.js']+'\\n'+files['public/worker.js'].replace(\"importScripts('core.js');\",'');", "const worker=files['public/core.js']+'\\n'+files['public/architecture.js']+'\\n'+files['public/worker.js'].replace(\"importScripts('core.js','architecture.js');\",'');")
assert "files['public/architecture.js']" in gate
(site/'gate-v12.js').write_text(gate)
index=old.read('relief-studio/site/index.html').decode().replace('gate-v11.js?v=11','gate-v12.js?v=12').replace('ATELIER · 10','ATELIER · 12').replace('ATELIER · 11','ATELIER · 12').replace('STUDIO · 11','STUDIO · 12')
(site/'index.html').write_text(index)
report={'bytes':len(payload),'parts':parts,'changed':list(changes),'added':added_names,'sha256':manifest['sha256']}
(root/'reports/v12/patch-build.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
