from pathlib import Path
import sys,hashlib,json,difflib
r=Path(sys.argv[1]); q=Path(__file__).resolve().parent
base='eea4cb1c631e0fee0f727187890df833c9dad4d9'
get=lambda p:(r/p).read_text(); put=lambda p,s:(r/p).write_text(s); enc=lambda x:json.dumps(x,ensure_ascii=False,indent=2)+'\n';sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
def delta(a,b):
 x=a.split('\n');y=b.split('\n');return dict(base=sha(a),result=sha(b),edits=[[i,j-i,y[k:l]] for op,i,j,k,l in difflib.SequenceMatcher(None,x,y,autojunk=False).get_opcodes() if op!='equal'])
p={'version':25,'changes':{},'sourceChanges':{}}
def setsrc(name,s,test=False):
 path='source/'+name;p['sourceChanges' if test else 'changes'][name]=delta(get(path),s);put(path,s)
a=get('source/public/architecture.js');a=a.replace('const raster=R.buildMesh;',(q/'seam.js').read_text()+'const raster=R.buildMesh;');i=a.index(' const count=result.vertices.length/3,usage=');j=a.index(' if(bad.length){',i)
a=a[:i]+''' const count=result.vertices.length/3,usage=new Map(),vs=result.vertices;
 function audit(){usage.clear();const ix=result.indices;for(let i=0;i<ix.length;i+=3)for(let j=0;j<3;j++){
  const a=ix[i+j],b=ix[i+(j+1)%3],k=Math.min(a,b)*count+Math.max(a,b);usage.set(k,(usage.get(k)||0)+(a<b?1:65536));
 }const errors=[];for(const [key,code] of usage)if(code!==65537)errors.push([key,code]);return errors;}
 let bad=audit();stats.verticalSeamSplits=conformVerticalChains(result,bad,usage);
 if(stats.verticalSeamSplits)bad=audit();usage.clear();
'''+a[j:];setsrc('public/architecture.js',a.replace('architecture:{smoothTerrainGrid,','architecture:{conformVerticalChains,smoothTerrainGrid,'))
for name in ['app.js','diagnostics.js','index.html']:
 a=get('source/public/'+name).replace("'24.0.0'","'25.0.0'").replace('class="version">24<','class="version">25<').replace('STUDIO <b>24.0','STUDIO <b>25.0');setsrc('public/'+name,a)
t=get('source/tests/v24_gate.test.mjs');put('source/tests/v25_gate.test.mjs',t.replace('24','25'))
for n in range(12,25):
 name=f'tests/v{n}_gate.test.mjs';a=get('source/'+name).replace('gate-v24.js?v=24','gate-v25.js?v=25').replace(r'gate-v24\.js\?v=24',r'gate-v25\.js\?v=25');
 if n==24:
  a=a.replace('{webcrypto}', '{webcrypto,createHash}').replace("assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);", "{const k='public/'+name,c=JSON.parse(await readFile(join(site,'upgrade25.json'),'utf8')).changes[k];if(c)assert.equal(createHash('sha256').update(x.files()[k]).digest('hex'),c.base,name);else assert.equal(x.files()[k],await readFile(join(root,k),'utf8'),name);}")
 setsrc(name,a,True)
put('upgrade25.json',json.dumps(p,ensure_ascii=False,separators=(',',':'))+'\n');g=get('gate-v24.js').replace('v24 encrypted','v25 encrypted').replace('?v=24','?v=25').replace('Studio 24 wird','Studio 25 wird').replace("'24.0.0'","'25.0.0'");i=g.index('   const p24=');j=g.index('   pack.version=24;',i)+len('   pack.version=24;');block=g[i:j].replace('24','25').replace('Gelände','Wandnaht');block=block[:block.index('const names25=')]+'const names25='+json.dumps(list(p['changes']))+';'+block[block.index(';',block.index('const names25='))+1:];put('gate-v25.js',g[:j]+'\n'+block+g[j:]);put('index.html',get('index.html').replace('STUDIO · 24','STUDIO · 25').replace('gate-v24.js?v=24','gate-v25.js?v=25'))
x=get('source/tools/prepare_release24.mjs').replace('17 -> 24','17 -> 25').replace('23,24]','23,24,25]').replace('version===24?6','version===25?4:version===24?6').replace('22|23)','22|23|24)').replace('Release 24 verified','Release 25 verified');put('source/tools/prepare_release25.mjs',x)
pkg=json.loads(get('source/package.json').replace('prepare_release24','prepare_release25'));pkg['version']='25.0.0';pkg['scripts']['test']+=' tests/vertical-seam25.test.mjs tests/v25_gate.test.mjs';put('source/package.json',enc(pkg));put('source/tests/vertical-seam25.test.mjs',(q/'vertical.test.mjs').read_text());d=json.loads(get('DEPLOYMENT.json'));d.update(version='25.0.0',base_commit=base,gate='gate-v25.js',source_in_repository='Conforming exact vertical wall subdivisions; no adjustment of the input geometry.');d['updates'].append('upgrade25.json');d['checks']['feature']='tests/vertical-seam25.test.mjs';put('DEPLOYMENT.json',enc(d));put('RELEASE-NOTES-25.md','# Relief Studio 25 – senkrechte Gebäudenaht\n\nTrifft eine lange Wandkante im exportierbaren Koordinatensystem genau auf eine vollständige, entgegengesetzt orientierte Kette kürzerer Kanten, verwendet auch die gegenüberliegende Wand deren vorhandene Zwischenpunkte. Die Wand bleibt an derselben Stelle. Echte Lücken werden nicht überdeckt. Nach einer Teilung prüft das Studio das gesamte Netz erneut; ein fehlerhaftes Modell bleibt für den Export gesperrt.\n')
