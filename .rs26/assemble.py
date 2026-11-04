from pathlib import Path
import json,hashlib,re,sys,difflib,shutil
root=Path(sys.argv[1]);here=Path(__file__).parent;p=root/'source/public';tests=p.parent/'tests';sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
base={f.name:f.read_text() for f in p.iterdir() if f.suffix in ['.js','.html']};orig={i:(tests/f'v{i}_gate.test.mjs').read_text() for i in range(12,26)};server=root/'source/server.mjs';oldserver=server.read_text()
for path,edits in json.loads((here/'edits.json').read_text()).items():
 f=root/path;s=f.read_text()
 for i,n,text in edits[::-1]:s=s[:i]+text+s[i+n:]
 if '__ROOF_SOURCE__' in s:s=s.replace('__ROOF_SOURCE__\n',(here/'roofs.js').read_text().replace('__PACK__',(here/'pack.json').read_text().strip()))
 f.write_text(s)
def delta(a,b):
 aa=a.split('\n');bb=b.split('\n');return dict(base=sha(a),result=sha(b),edits=[[i,j-i,bb[k:l]] for op,i,j,k,l in difflib.SequenceMatcher(None,aa,bb,autojunk=False).get_opcodes() if op!='equal'])
changes={'public/'+n:delta(base[n],(p/n).read_text()) for n in ['diagnostics.js','core.js','app.js','data.js','architecture.js','index.html']};(tests/'v26_gate.test.mjs').write_text(orig[25].replace('25','26'))
for i,s in orig.items():
 s=s.replace('gate-v25.js?v=25','gate-v26.js?v=26').replace(r'gate-v25\.js\?v=25',r'gate-v26\.js\?v=26')
 if i>=18:
  s=re.sub(r" for\(const name of (\[\x27data.js\x27,.*?\])\)([^\n]*)",lambda m:" for(const name of "+m[1]+"){const key='public/'+name;let expected;for(let n="+str(i+1)+";n<=26&&!expected;n++){expected=JSON.parse(await readFile(join(site,'upgrade'+n+'.json'),'utf8')).changes[key]?.base;}if(expected)assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),expected,name);else assert.equal(x.files()[key],await readFile(join(root,key),'utf8'),name);}",s,count=1)
  if i==25:s=s.replace('import {webcrypto}','import {createHash,webcrypto}')
 (tests/f'v{i}_gate.test.mjs').write_text(s)
ss={'tests/v%d_gate.test.mjs'%i:delta(orig[i],(tests/f'v{i}_gate.test.mjs').read_text()) for i in [25,14,20,13,22,23,24,19,16,12,21,15,18,17]};ss['server.mjs']=delta(oldserver,server.read_text());(root/'upgrade26.json').write_text(json.dumps(dict(version=26,changes=changes,sourceChanges=ss),ensure_ascii=False,separators=(',',':'))+'\n')
gate=(root/'gate-v25.js').read_text();block=gate[gate.index('   const p25='):gate.index('   pack.version=25;')+19].replace('25','26').replace('Wandnaht','Dachhöhen');block=re.sub(r'const names26=.*?;',lambda m:'const names26='+json.dumps(sorted(changes))+';',block);gate=gate.replace('   pack.version=25;','   pack.version=25;\n'+block).replace('v25 encrypted','v26 encrypted').replace('?v=25','?v=26').replace('Studio 25 wird','Studio 26 wird').replace("release:'25.0.0'","release:'26.0.0'");(root/'gate-v26.js').write_text(gate)
f=root/'index.html';f.write_text(f.read_text().replace('gate-v25.js?v=25','gate-v26.js?v=26').replace('STUDIO · 25','STUDIO · 26'));f=p.parent/'package.json';j=json.loads(f.read_text().replace('prepare_release25','prepare_release26'));j['version']='26.0.0';j['scripts']['test']+=' tests/landmarks26.test.mjs tests/v26_gate.test.mjs';f.write_text(json.dumps(j,indent=2,ensure_ascii=False)+'\n');prep=(p.parent/'tools/prepare_release25.mjs').read_text().replace('24,25]','24,25,26]').replace('version===25?4:','version===26?6:version===25?4:').replace('23|24)','23|24|25)').replace('Release 25 verified','Release 26 verified');(p.parent/'tools/prepare_release26.mjs').write_text(prep)
f=root/'DEPLOYMENT.json';j=json.loads(f.read_text());j.update(version='26.0.0',gate='gate-v26.js',base_commit='833b7bf5fc77027fc1c7d6d291d7a01bbf46b6e8',source_in_repository='Original OSM rings and linked parts; optional evidenced roof-height fields.');j['updates'].append('upgrade26.json');j['checks']['feature']='tests/landmarks26.test.mjs';f.write_text(json.dumps(j,indent=2,ensure_ascii=False)+'\n');shutil.copyfile(here/'pack.py',p.parent/'tools/roofpack.py');(tests/'landmarks26.test.mjs').write_text((here/'landmarks26.test.mjs').read_text()+(here/'extra-tests.mjs').read_text());shutil.copyfile(here/'notes.md',root/'RELEASE-NOTES-26.md')
