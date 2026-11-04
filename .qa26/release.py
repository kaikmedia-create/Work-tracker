from pathlib import Path
import hashlib,difflib,json,re,shutil
B=Path('original');T=Path('relief-studio');sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
def r(q):return (B/q).read_text()
def w(q,s):(T/q).write_text(s)
review=Path(__file__).resolve().parent
shutil.copyfile(review/'landmarks26.test.mjs',T/'source/tests/landmarks26.test.mjs');shutil.copyfile(review/'LANDMARK-SOURCES.md',T/'LANDMARK-SOURCES.md')
w('RELEASE-NOTES-26.md','# Relief Studio 26 · Erkennbare Bauwerke\n\nDie Peterskirche in Weinheim erhält einen eigenständigen Eckturm und Dachflächen, fünf weitere lokale Bauwerke amtliche LoD2-Dächer. Referenzen und Höhenannahmen: [Quellen](LANDMARK-SOURCES.md). Weltweit berücksichtigt die Modellierung explizite OSM-Zuordnungen von Gebäudeumrissen und Teilen sowie zusätzlich Tonnen-, Gambrel- und Mansarddächer. Eigene georeferenzierte Dachflächen sind als GeoJSON importierbar. Die Qualitätsanzeige unterscheidet Referenzmodelle und Grundrisse ohne Dachangabe. Vorschau und Druck verwenden dieselben Dachflächen.\n')
f='source/tools/prepare_release25.mjs';s=r(f).replace('24,25]', '24,25,26]').replace('length!==(version===25','length!==(version===26?6:version===25').replace('23|24)', '23|24|25)').replace('Release 25 verified','Release 26 verified');w(f.replace('25','26'),s)
f='gate-v25.js';s=r(f);i=s.index('   const p25=');j=s.index('   pack.version=25;',i)+len('   pack.version=25;');q=s[i:j].replace('25','26').replace('Wandnaht','Gebäudeformen').replace('"public/architecture.js",','"public/core.js", "public/data.js", "public/architecture.js",');s=s[:j]+'\n'+q+s[j:];s=s.replace('v25 encrypted','v26 encrypted').replace('Studio 25 wird','Studio 26 wird').replace("fetch(name+'?v=25'","fetch(name+'?v=26'").replace("release:'25.0.0'","release:'26.0.0'");w('gate-v26.js',s)
w('index.html',r('index.html').replace('· 25','· 26').replace('gate-v25.js?v=25','gate-v26.js?v=26'))
f='source/package.json';s=r(f).replace('25.0.0','26.0.0').replace('prepare_release25','prepare_release26').replace(' tests/v25_gate.test.mjs"',' tests/v25_gate.test.mjs tests/landmarks26.test.mjs tests/v26_gate.test.mjs"');w(f,s)
f='DEPLOYMENT.json';j=json.loads(r(f));j.update(version='26.0.0',base_commit='833b7bf5fc77027fc1c7d6d291d7a01bbf46b6e8',gate='gate-v26.js',source_in_repository='Georeferenced roof models, explicit building relations, roof source provenance and import.');j['updates'].append('upgrade26.json');j['checks']['feature']='tests/landmarks26.test.mjs';w(f,json.dumps(j,ensure_ascii=False,indent=2)+'\n')
f='source/tests/v25_gate.test.mjs';w(f.replace('v25','v26'),r(f).replace('25','26'))
for i in range(12,26):
 f=f'source/tests/v{i}_gate.test.mjs';s=r(f).replace('gate-v25.js?v=25','gate-v26.js?v=26').replace(r'gate-v25\.js\?v=25',r'gate-v26\.js\?v=26');
 if i==25:
  s=s.replace("{webcrypto} from 'node:crypto'","{webcrypto,createHash} from 'node:crypto'").replace("assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);", "{const k='public/'+name,c=JSON.parse(await readFile(join(site,'upgrade26.json'),'utf8')).changes[k];if(c)assert.equal(createHash('sha256').update(x.files()[k]).digest('hex'),c.base,name);else assert.equal(x.files()[k],await readFile(join(root,k),'utf8'),name);}")
 if 16<=i<25:
  for key in ['core.js','data.js']:
   for var in ['key','k']:
    token=f"else assert.equal(x.files()[{var}],await readFile(join(root,{var}),'utf8'),name);"
    if token not in s:continue
    bsum=None
    for v in range(i+1,26):
     upd=json.loads(r(f'upgrade{v}.json')).get('changes',{});c=upd.get('public/'+key)
     if c:bsum=c['base'];break
    if bsum is None:bsum=sha(r('source/public/'+key))
    s=s.replace(token,f"else if({var}==='public/{key}')assert.equal(createHash('sha256').update(x.files()[{var}]).digest('hex'),'{bsum}',name);"+token)
 if i in (20,21):
  old="else assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);"
  s=s.replace(old,"else if(name==='data.js')assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),'"+sha(r('source/public/data.js'))+"',name);"+old)
 w(f,s)
def change(a,b):
 A=a.split('\n');C=b.split('\n');return {'base':sha(a),'result':sha(b),'edits':[[i,j-i,C[k:l]] for op,i,j,k,l in difflib.SequenceMatcher(None,A,C,autojunk=False).get_opcodes() if op!='equal']}
run=['public/'+f for f in ['architecture.js','app.js','core.js','data.js','diagnostics.js','index.html']];sources=[f'tests/v{i}_gate.test.mjs' for i in range(12,26)];ju={'version':26,'changes':{},'sourceChanges':{}}
for k,fs in [('changes',run),('sourceChanges',sources)]:
 for f in fs:
  a=r('source/'+f);b=(T/'source'/f).read_text()
  if a!=b:ju[k][f]=change(a,b)
w('upgrade26.json',json.dumps(ju,ensure_ascii=False,separators=(',',':'))+'\n')
