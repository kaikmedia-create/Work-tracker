from pathlib import Path
from hashlib import sha256
from difflib import SequenceMatcher
import sys,json
site=Path(sys.argv[1]); src=site/'source'; here=Path(__file__).resolve().parent
sha=lambda s:sha256(s.encode()).hexdigest()
def diff(a,b):
 A,B=a.split('\n'),b.split('\n');return {'base':sha(a),'result':sha(b),'edits':[[i,j-i,B[k:l]] for op,i,j,k,l in SequenceMatcher(None,A,B,autojunk=False).get_opcodes() if op!='equal']}
def rep(s,a,b):
 assert s.count(a)==1,a;return s.replace(a,b)
payload={'version':22,'changes':{},'sourceChanges':{}}
def change(key,fn,sourceonly=False):
 f=src/key;s=f.read_text();v=fn(s);assert v!=s;f.write_text(v);payload['sourceChanges' if sourceonly else 'changes'][key]=diff(s,v)
def viewer(s):
 a="slot=this.slots[moving&&this.mesh.preview?1:0],dpr=Math.min(devicePixelRatio||1,this.mesh.preview?1.5:2),pixelW=Math.round(W*dpr),pixelH=Math.round(H*dpr)"
 b="slot=this.slots[!this.hd&&moving&&this.mesh.preview?1:0],dpr=Math.min(devicePixelRatio||1,this.mesh.preview?1.5:2),[pixelW,pixelH]=this.hd?hdSize(W,H,devicePixelRatio):[Math.round(W*dpr),Math.round(H*dpr)]"
 s=rep(s,a,b);return rep(s,'R.ModelViewer=ModelViewer;',(here/'hd.js').read_text()+"\nR.ModelViewer=class extends ModelViewer {constructor(canvas){super(canvas);attachHD(this);}};")
change('public/viewer.js',viewer)
change('public/app.js',lambda s:rep(s,"version:'21.0.0'","version:'22.0.0'"))
change('public/diagnostics.js',lambda s:rep(s,"release='21.0.0'","release='22.0.0'"))
change('public/index.html',lambda s:rep(rep(rep(s,'<span class="version">21</span>','<span class="version">22</span>'),'<b>21.0</b>','<b>22.0</b>'),'<button id="model-reset"','<button id="model-hd" type="button" class="selected" aria-label="HD-Vorschau mit vollständiger Modellgeometrie" aria-pressed="true" title="Originalmodell lokal in hoher Auflösung anzeigen" disabled>HD</button><button id="model-reset"'))
prevtest=(src/'tests/v21_gate.test.mjs').read_text()
(src/'tests/v22_gate.test.mjs').write_text(prevtest.replace('21','22').replace("p.changes['public/architecture.js']","p.changes['public/viewer.js']"))
for n in range(12,22):
 def historical(s,n=n):
  s=s.replace('gate-v21.js?v=21','gate-v22.js?v=22').replace(r'gate-v21\.js\?v=21',r'gate-v22\.js\?v=22');
  if n==21:
   s="import {createHash} from 'node:crypto';\n"+s
   a="assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);"
   s=rep(s,a,"{const key='public/'+name,c=JSON.parse(await readFile(join(site,'upgrade22.json'),'utf8')).changes[key];if(c)assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),c.base,name);else "+a+"}")
  return s
 change(f'tests/v{n}_gate.test.mjs',historical,True)
(site/'upgrade22.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
s=(site/'gate-v21.js').read_text().replace('v21 encrypted','v22 encrypted').replace("'?v=21'","'?v=22'").replace('Studio 21 wird','Studio 22 wird').replace("release:'21.0.0'","release:'22.0.0'")
a=s.index('   const p21=');b=s.index('   pack.version=21;',a)+len('   pack.version=21;');part=s[a:b].replace('21','22');start=part.index('const names22=');end=part.index(';',start);part=part[:start]+'const names22='+json.dumps(list(payload['changes']))+part[end:];part=part.replace('Gewässer-Update','HD-Update').replace('Straßenrelief','HD-Vorschau');(site/'gate-v22.js').write_text(s[:b]+'\n'+part+s[b:]);
f=site/'index.html';f.write_text(f.read_text().replace('STUDIO · 21','STUDIO · 22').replace('gate-v21.js?v=21','gate-v22.js?v=22'))
s=(src/'tools/prepare_release21.mjs').read_text().replace('17 -> 21','17 -> 22').replace('19,20,21]','19,20,21,22]').replace('version===21?7','version===22?4:version===21?7').replace('|19|20)_gate','|19|20|21)_gate').replace('Release 21 verified','Release 22 verified');(src/'tools/prepare_release22.mjs').write_text(s)
f=src/'package.json';p=json.loads(f.read_text());p['version']='22.0.0';p['scripts']={k:v.replace('prepare_release21','prepare_release22') for k,v in p['scripts'].items()};p['scripts']['test']+=' tests/hd22.test.mjs tests/v22_gate.test.mjs';f.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n');(src/'tests/hd22.test.mjs').write_text((here/'test.mjs').read_text());
f=site/'DEPLOYMENT.json';p=json.loads(f.read_text());p.update(version='22.0.0',gate='gate-v22.js',base_commit='1cabc98e666d6312fe05eb80e7e68f7ebfad999e',source_in_repository='Full geometry on the GPU, locally rendered HD software stills.',checks={'runner':'npm test','feature':'tests/hd22.test.mjs'});p['updates'].append('upgrade22.json');f.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n');
(site/'RELEASE-NOTES-22.md').write_text('# HD-Vorschau auf dem Endgerät\n\nHD ist standardmäßig eingeschaltet: Mit WebGL 2 verwendet jede Ansicht die bereits im Grafikspeicher liegende vollständige Geometrie. Ohne WebGL bleibt die schnelle Drehansicht verfügbar; nach dem Loslassen liefert ein lokaler Raster-Worker ein tiefengeprüftes Bild aller Dreiecke. Das fertige Bild wird bis zur nächsten Änderung wiederverwendet. Die Schaltfläche HD wechselt zur schnellen Ansicht. Es werden weder Projektdaten hochgeladen noch STL und 3MF geändert. Die Bildgröße berücksichtigt die Display-Pixeldichte (maximal 3×, 4096 Pixel je Achse und 6 Megapixel).\n')
