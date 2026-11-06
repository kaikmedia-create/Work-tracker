from pathlib import Path
import re,json,difflib,hashlib,tempfile,shutil
root=Path(__file__).resolve().parents[1];site=root.parent;base=Path(tempfile.mkdtemp())/'public';shutil.copytree(root/'public',base)
# Refuse installation on a different prepared application revision.
expected={'core.js':'87d649a1ba83d20f6e2586730b405867663f2ff47ece95d9cbdca96051eb99eb','index.html':'cb0d4f10bfa8918f4479f9adf562259285e2ebb46dcf6306a5f8f58c51dc580f','architecture.js':'7227b4fa6799fab3e6263dd7395dbd4e4e016a2fe7252ca3ddc173097c25e142','worker.js':'bb2340f6525fb3e76f38e56310a2468bd1c34c1ddf72f359729d2a8f4bc00928','app.js':'01945dda2defca7d6982b2d23247e69a10f298b687cff378cc9e90f8440a8778'}
for name,h in expected.items(): assert hashlib.sha256((base/name).read_bytes()).hexdigest()==h,name
p=root/'public/hybrid-buildings.mjs';p.write_text(p.read_text().replace('x-a[0]-a[0]*0-t*dx','x-a[0]-t*dx'))
def change(name,fn):
 p=root/'public'/name;s=(base/name).read_text();new=fn(s);assert new!=s,name;p.write_text(new)
def unique(s,a,b):
 assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b)
change('core.js',lambda s:unique(unique(s,"surfaceMode:'auto',aerialColour", "surfaceMode:'classic',surfaceSchema:2,aerialColour"),"if(!['auto','classic'].includes(s.surfaceMode))s.surfaceMode='auto';","if(!['auto','classic','hybrid'].includes(s.surfaceMode))s.surfaceMode='classic';\n // Previous automatic raster preference must not silently survive this opt-in change.\n if(input.surfaceSchema!==2&&s.surfaceMode==='auto')s.surfaceMode='classic';\n s.surfaceSchema=2;"))
change('index.html',lambda s:unique(s,'<option value="auto">Messdaten bevorzugen</option><option value="classic">Klassisches Kartenrelief</option>','<option value="classic">Klassisches Kartenrelief · Standard</option><option value="hybrid">Klassische Kanten + Messhöhen</option><option value="auto">Messoberfläche · unbearbeitetes Raster</option>'))
p=root/'public/index.html';s=p.read_text();ix=s.index('for="city-surface"');end=s.index('</select></label>',ix)+len('</select></label>');s=s[:end]+'<p class="hint" id="hybrid-help">Klassisch bleibt der Standard. Die Kombination übernimmt nur belastbare Gebäudehöhen innerhalb der kartierten Grundrisse. Wände und Dachformen bleiben klar; Baumspitzen, Messlücken und Innenhöfe werden nicht als zusätzliche Häuser modelliert. Verfügbare Messabdeckung wird pro Gebäude geprüft.</p>'+s[end:];p.write_text(s)
change('architecture.js',lambda s:unique(unique(s,"source=b.heightSource==='Manuell'?'Manuell':'OSM-Höhe'","source=b.heightSource==='Manuell'?'Manuell':b.measuredHeight?'Messhöhe im Grundriss':'OSM-Höhe'"),"if(!reference&&!item&&spec.source!=='OSM-Höhe'&&!b.worldSource?.fields?.includes('height'))stats.heightEstimated++;","if(!reference&&!item&&!b.measuredHeight&&spec.source!=='OSM-Höhe'&&!b.worldSource?.fields?.includes('height'))stats.heightEstimated++;"))
old=(base/'atlas-mesh-worker.mjs').read_text();start=old.index('RS.meshProgress=progress');end=old.index('const transfer=',start)
body='RS.meshProgress=progress=>self.postMessage({id,progress});const result=await buildSurface(RS,data,settings);'
m=old[:start]+body+old[end:];m=m.replace("import * as survey from './survey29.js';","import {buildSurface} from './surface-build.mjs';").replace("import './core.js';","import './core.js?hybrid=1';").replace("import './architecture.js';","import './architecture.js?hybrid=1';")
(root/'public/atlas-mesh-worker.mjs').write_text(m)
old=(base/'worker.js').read_text();start=old.index('RS.meshProgress=progress');end=old.index('const transfer=',start)
(root/'public/worker.js').write_text(old[:start]+"RS.meshProgress=progress=>self.postMessage({id,progress});let result;if(event.data.surveyURL){const {buildSurface}=await import(new URL('surface-build.mjs',event.data.surveyURL).href);result=await buildSurface(RS,data,settings);}else result=RS.buildMesh(data,settings);"+old[end:])
s=(base/'app.js').read_text()
s=s.replace("+'atlas-mesh-worker.mjs',document.baseURI)","+'atlas-mesh-worker.mjs?v=28-hybrid-1',document.baseURI)")
a="await nextFrame();try{result=R.buildMesh(source,inputSettings);}catch(e){if(!source.sourceAudit)throw e;const mod=await import(new URL((globalThis.RELIEF_STATIC_PREVIEW?'source/public/':'')+'survey29.js',document.baseURI));result=mod.contactEnvelope(R,source,inputSettings,e);}"
b="await nextFrame();const {buildSurface}=await import(new URL((globalThis.RELIEF_STATIC_PREVIEW?'source/public/':'')+'surface-build.mjs',document.baseURI));result=await buildSurface(R,source,inputSettings);"
s=unique(s,a,b)
s=unique(s,"  if(result.roadProfile){","  if(result.heightFusion){source.heightFusionAudit=result.heightFusion;R.diagnostics.event('Gebäude-Messhöhen',{status:result.heightFusion.status||'done',count:result.heightFusion.updated,detail:result.surveyReason});}else delete source.heightFusionAudit;\n  if(result.roadProfile){")
needle=" if(data.sourceAudit){const audit="
s=unique(s,needle," if(mesh?.heightFusion){const f=mesh.heightFusion,p=document.createElement('p');p.textContent='Messhöhen-Zusammenführung: '+(f.updated||0)+' Gebäude ergänzt · '+(f.protected||0)+' vorhandene Angaben geschützt · '+(f.rejected||0)+' ohne belastbare Messwerte. '+(f.source||f.reason||'')+' Die Originalgrundrisse bleiben unverändert.';target.append(p);}\n"+needle)
s=unique(s,"function sources(){", "function sources(){return (mesh?.heightFusion?'Gebäudehöhen: klassische Geometrie mit gebäudeweiser Messdatenergänzung.\\n'+JSON.stringify(mesh.heightFusion,null,2)+'\\n\\n':'')+baseSources();}\nfunction baseSources(){")
(root/'public/app.js').write_text(s)
changes={}
for name in ['core.js','index.html','architecture.js','worker.js','app.js']:
 before=(base/name).read_text();after=(root/'public'/name).read_text();a=before.split('\n');b=after.split('\n');edits=[]
 for tag,i,j,k,l in difflib.SequenceMatcher(a=a,b=b,autojunk=False).get_opcodes():
  if tag!='equal':edits.append([i,j-i,b[k:l]])
 changes['public/'+name]={'base':hashlib.sha256(before.encode()).hexdigest(),'result':hashlib.sha256(after.encode()).hexdigest(),'edits':edits}
(site/'upgrade28-hybrid.json').write_text(json.dumps({'version':'28-hybrid-1','changes':changes},ensure_ascii=False,separators=(',',':'))+'\n')
p=root/'tools/prepare_release28.mjs';s=p.read_text();marker='for(const [name,chain] of chains){';code="const hybrid=JSON.parse(await readFile(resolve(site,'upgrade28-hybrid.json'),'utf8'));if(hybrid.version!=='28-hybrid-1')throw Error('Unknown hybrid patch');for(const [name,c] of Object.entries(hybrid.changes)){if(!chains.has(name))throw Error('Unknown hybrid target');chains.get(name).push(c);}\n";s=unique(s,marker,code+marker);p.write_text(s)
p=site/'gate-v28.js';s=p.read_text();marker="  let html=files['public/index.html'];";code="  const hybridPatch=await(await get('upgrade28-hybrid.json')).json();if(hybridPatch.version!=='28-hybrid-1'||Object.keys(hybridPatch.changes||{}).length!==5)throw Error('Unbekannter Gebäude-Messhöhenstand');for(const name of ['public/core.js','public/index.html','public/architecture.js','public/worker.js','public/app.js']){const c=hybridPatch.changes[name];if(!c||await hash(files[name])!==c.base)throw Error('Gebäude-Messhöhen: falscher Ausgangsstand '+name);const lines=files[name].split('\\n');for(const [i,n,a] of c.edits.slice().reverse())lines.splice(i,n,...a);const v=lines.join('\\n');if(await hash(v)!==c.result)throw Error('Gebäude-Messhöhen: Prüfsumme '+name);files[name]=v;}\n";s=unique(s,marker,code+marker);p.write_text(s)
p=site/'index.html';s=p.read_text();s=re.sub(r'gate-v28\.js\?v=28[^"\s<]*','gate-v28.js?v=28-hybrid-1',s);p.write_text(s)
p=root/'package.json';s=json.loads(p.read_text());s['scripts']['test']+=' tests/hybrid-buildings.test.mjs';p.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
expected_result={'public/core.js':'e3faaa831c2846721f26ebf98a0a23fb211b24dca1372ca11bd08c4d481535cf','public/index.html':'0e8b646c7e7ece181d75c8aa2bdfa449f11980920b3a1dde7de7c095365574cb','public/app.js':'95e24dcc7805d4bc1cdfd772bb4c72faf7febba1501a7adae27eed151c19a4d0','public/architecture.js':'a62d426da9bd02c8e354f6519b3725f3bfceade2bbb287346dab36f2914ab044','public/worker.js':'e0b3827a48224beb5c37c5e9b361d8cf81441c03482aec7b829480e4464cc844','public/atlas-mesh-worker.mjs':'17e68ab343bdd179471691254dfaf87a5dac80a70afcfe86fdc23dc4d67f0bb2','public/hybrid-buildings.mjs':'524b9afa6d61bd8cc42dc28ef99b2096e48c99033dbd92e971cf3f74b4230a94','public/surface-build.mjs':'8f1a34669071d89461ecfa9fcace50197cd5912151a451159e49c0bacbca5da4'}
for name,h in expected_result.items(): assert hashlib.sha256((root/name).read_bytes()).hexdigest()==h,name
print('All generated application bytes match locally tested code.')
