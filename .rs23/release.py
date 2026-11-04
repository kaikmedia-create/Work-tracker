from pathlib import Path
from hashlib import sha256
from difflib import SequenceMatcher
import json,sys,shutil
P=Path(sys.argv[1]);Q=Path(__file__).parent;S=P/'source'
sha=lambda x:sha256(x.encode()).hexdigest()
order=['public/'+n for n in ('core.js','architecture.js','app.js','diagnostics.js','index.html')]+[f'tests/v{n}_gate.test.mjs' for n in (21,22,13,17,15,18,16,14,12,19,20)]
before={k:(S/k).read_text() for k in order}
exec((Q/'edit.py').read_text())
def change(path,fn):
 text=path.read_text();new=fn(text);assert text!=new,path;path.write_text(new)
change(S/'public/core.js',lambda x:x.replace("roadMode:'raised',roadRelief:","streetCurve:'soft',roadMode:'raised',roadRelief:").replace(" if(!['off','raised','engraved']", " if(!['mapped','soft','fine'].includes(s.streetCurve))s.streetCurve='soft';\n if(!['off','raised','engraved']"))
change(S/'public/app.js',lambda x:x.replace("'roadRelief','roadMode'].includes(k)","'roadRelief','roadMode','streetCurve'].includes(k)").replace("$('road-relief').disabled=","$('street-curve').disabled=settings.roadMode==='off';$('road-relief').disabled=").replace('Linien; ${r.changedVertices}', 'Linien; ${r.contourVertices||0} Konturpunkte; ${r.changedVertices}').replace("version:'22.0.0'","version:'23.0.0'"))
change(S/'public/index.html',lambda x:x.replace('<div class="control"><label for="road-relief">','<label for="street-curve">Straßenverlauf<select id="street-curve" data-setting="streetCurve"><option value="mapped">Kartierte Stützpunkte</option><option value="soft">Weiche Kurven</option><option value="fine">Weiche Kurven · fein</option></select></label>\n<div class="control"><label for="road-relief">').replace('class="version">22<','class="version">23<').replace('STUDIO <b>22.0','STUDIO <b>23.0'))
change(S/'public/diagnostics.js',lambda x:x.replace("release='22.0.0'","release='23.0.0'"))
t22=before['tests/v22_gate.test.mjs'];(S/'tests/v23_gate.test.mjs').write_text(t22.replace('22','23').replace("p.changes['public/viewer.js']","p.changes['public/architecture.js']"))
for n in range(12,23):
 p=S/f'tests/v{n}_gate.test.mjs';s=p.read_text().replace('gate-v22.js?v=22','gate-v23.js?v=23').replace(r'gate-v22\.js\?v=22',r'gate-v23\.js\?v=23');
 if n==21:s=s.replace("if(c)assert.equal", "if(!c&&['public/core.js','public/architecture.js'].includes(key))assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),JSON.parse(await readFile(join(site,'upgrade23.json'),'utf8')).changes[key].base,name);else if(c)assert.equal")
 if n==22:s="import {createHash} from 'node:crypto';\n"+s.replace("assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);","{const key='public/'+name,c=JSON.parse(await readFile(join(site,'upgrade23.json'),'utf8')).changes[key];if(c)assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),c.base,name);else assert.equal(x.files()[key],await readFile(join(root,key),'utf8'),name);}")
 p.write_text(s)
def delta(a,b):
 x=a.split('\n');y=b.split('\n');return dict(base=sha(a),result=sha(b),edits=[[i,j-i,y[u:v]] for k,i,j,u,v in SequenceMatcher(None,x,y,autojunk=False).get_opcodes() if k!='equal'])
pub={};src={}
for k,a in before.items():
 b=(S/k).read_text();
 if b!=a:(pub if k.startswith('public/') else src)[k]=delta(a,b)
assert len(pub)==5
(P/'upgrade23.json').write_text(json.dumps(dict(version=23,changes=pub,sourceChanges=src),ensure_ascii=False,separators=(',',':'))+'\n');
g=(P/'gate-v22.js').read_text();start=g.index('   const p22=');end=g.index('   pack.version=22;')+len('   pack.version=22;');block=g[start:end].replace('22','23').replace('HD-Update','Straßenkurven-Update').replace('HD-Vorschau','Straßenkurven');block=block.replace('["public/viewer.js", "public/app.js", "public/diagnostics.js", "public/index.html"]',json.dumps(list(pub)));assert 'public/architecture.js' in block
(P/'gate-v23.js').write_text((g[:end]+'\n'+block+g[end:]).replace('v22 encrypted','v23 encrypted').replace('?v=22','?v=23').replace('Studio 22 wird','Studio 23 wird').replace("release:'22.0.0'","release:'23.0.0'"));change(P/'index.html',lambda x:x.replace('STUDIO · 22','STUDIO · 23').replace('gate-v22.js?v=22','gate-v23.js?v=23'))
p=S/'tools/prepare_release22.mjs';(S/'tools/prepare_release23.mjs').write_text(p.read_text().replace('17 -> 22','17 -> 23').replace('20,21,22]','20,21,22,23]').replace('version===22?4','version===23?5:version===22?4').replace('20|21)','20|21|22)').replace('Release 22 verified','Release 23 verified'))
p=S/'package.json';d=json.loads(p.read_text().replace('prepare_release22','prepare_release23'));d['version']='23.0.0';d['scripts']['test']+=' tests/road-curves23.test.mjs tests/v23_gate.test.mjs';p.write_text(json.dumps(d,indent=2)+'\n');shutil.copy(Q/'tests.mjs',S/'tests/road-curves23.test.mjs')
p=P/'DEPLOYMENT.json';d=json.loads(p.read_text());d.update(version='23.0.0',base_commit='629115830ba2908c687b4d7cd4d7f7ebe66fb1c5',gate='gate-v23.js',source_in_repository='Physical curved road contours shared by HD preview and print formats.');d['updates'].append('upgrade23.json');d['checks']['feature']='tests/road-curves23.test.mjs';p.write_text(json.dumps(d,indent=2)+'\n');(P/'RELEASE-NOTES-23.md').write_text('## Straßenkonturen im Druckmodell\n\nRelief → Straßen und Wege → Straßenverlauf: Weiche Kurven (Standard), feinere Kurven oder unveränderte kartierte Stützpunkte. Gerade Strecken, Endpunkte und gemeinsame Knoten bleiben erhalten. Kurven werden vor der Höhenanpassung in Millimetern abgeflacht. Zusätzliche gemeinsame Netzkanten an Fahrbahn und Schulter verbessern auch diagonale Geraden. Gebäude-, Gewässer- und Rahmenkanten werden nicht aufgetrennt. STL und 3MF neu exportieren; kein neuer Kartendownload nötig.\n')
