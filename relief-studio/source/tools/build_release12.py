"""Reproducible v12 integrity patch. Retains deployed v10+v11 data loader."""
import base64,difflib,gzip,hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
old=zipfile.ZipFile('/mnt/data/Relief-Studio-11-komplett.zip')
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
changes={}
for name in ['public/app.js','public/index.html','public/style.css']:
 before=old.read('relief-studio/'+name).decode();after=(root/name).read_text();lines=after.split('\n')
 changes[name]={'base':sha(before),'result':sha(after),'edits':[[a,b-a,lines[c:d]] for op,a,b,c,d in difflib.SequenceMatcher(None,before.split('\n'),lines,autojunk=False).get_opcodes() if op!='equal']}
added={n:(root/n).read_text() for n in ['public/triptych-core.js','public/triptych-ui.js','server.mjs','setup.mjs','package.json','tools/standalone.py','RELEASE-NOTES-12.md','TEST-REPORT-12.md']}
patch={'version':12,'changes':changes,'added':added}
raw=json.dumps(patch,ensure_ascii=False,separators=(',',':')).encode();packed=gzip.compress(raw,mtime=0,compresslevel=9)
site=root/'site';(site/'upgrade12.b64').write_text(base64.b64encode(packed).decode())
(site/'upgrade12.json').write_text(json.dumps({'version':12,'parts':['upgrade12.b64'],'sha256':hashlib.sha256(packed).hexdigest()},separators=(',',':')))
gate=old.read('relief-studio/site/gate-v11.js').decode().replace('Studio v11','Studio v12').replace('?v=11','?v=12').replace('Studio 11 wird','Studio 12 wird')
insert="""  const up12=await (await get('upgrade12.json')).json();
  if(up12.version!==12||!Array.isArray(up12.parts)||up12.parts.length>20)throw Error('Ungültiges Kombi-Update.');
  const bytes12=await combine(up12.parts);
  if(await hash(bytes12)!==up12.sha256)throw Error('Kombi-Update unvollständig. Bitte vollständig neu laden.');
  const patch12=JSON.parse(await new Response(new Blob([bytes12]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if(patch12.version!==12)throw Error('Falsche Kombi-Version.');
  for(const [name,c] of Object.entries(patch12.changes)){
   if(!(name in files)||await hash(files[name])!==c.base)throw Error('Programmstand passt nicht zum Kombi-Update: '+name);
   const lines=files[name].split('\\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\\n');if(await hash(value)!==c.result)throw Error('Kombi-Prüfsumme stimmt nicht: '+name);files[name]=value;
  }
  Object.assign(files,patch12.added);pack.version=12;
"""
needle="  let html=files['public/index.html'];";assert needle in gate;gate=gate.replace(needle,insert+needle)
(site/'gate-v12.js').write_text(gate)
index=old.read('relief-studio/site/index.html').decode().replace('gate-v11.js?v=11','gate-v12.js?v=12').replace(' · 10',' · 12').replace(' · 11',' · 12')
(site/'index.html').write_text(index)
print(json.dumps({'patchBytes':len(packed),'base64Bytes':(site/'upgrade12.b64').stat().st_size,'sha256':hashlib.sha256(packed).hexdigest()}))
