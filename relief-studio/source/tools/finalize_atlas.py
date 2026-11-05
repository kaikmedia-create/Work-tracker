"""Rebuild the SHA-checked Atlas delta from the previous shipped checkout after acceptance fixes."""
from pathlib import Path
import sys,json,difflib,hashlib
root=Path(__file__).resolve().parents[1];site=root.parent;old=Path(sys.argv[1]);pub=root/'public'
def once(s,a,b):
 if s.count(a)!=1:raise ValueError('Non-unique anchor: '+a[:120]);
 return s.replace(a,b,1)
def upd(name,edits):
 f=pub/name;s=f.read_text()
 for a,b in edits:s=once(s,a,b)
 f.write_text(s)
upd('survey29.js',[("tiles[x+','+y]=await tile(x,y,signal);","try{tiles[x+','+y]=await tile(x,y,signal);}catch(e){if(signal.aborted)throw e;/* Leave only this tile missing; use actual mapped roofs in the gap. */}"),('return {a,b,tiles,source:index.source};','return Object.keys(tiles).length?{a,b,tiles,source:index.source}:null;'),('s,scan,cap=1100){','s,scan,cap=1100,vector=false){'),('if(measured<grid.length*.70)return null;','if(!measured&&!vector)return null;')]);
f=pub/'survey29.js';f.write_text(f.read_text()+'''
// Sample the roof planes from architecturePatches, not a substitute flat extrusion. Only used for numerical contact failures.
export function contactEnvelope(R,data,s,error){
 if(!data.sourceAudit||!['GEOMETRY_CONTACTS','GEOMETRY_SEAM','GEOMETRY_BOUNDARY','ROOF_TOPOLOGY','NON_MANIFOLD'].includes(error.code))throw error;
 const result=meshSurvey(R,data,s,{a:[0,0],b:[1,1],tiles:{},source:null},1100,true),step=result.survey.step;
 delete result.survey;result.vectorEnvelope={code:error.code,step,roofSurfaces:data.buildings.filter(b=>b.detailRoof).length};
 result.surveyReason='Kartierte Dachflächen als geschlossene Höhenhülle · Raster '+step.toFixed(2)+' m ('+result.cell.toFixed(3)+' mm im Druck); keine Flächenvermessung. Feine Kanten können geglättet sein.';return result;
}
''');
upd('worker.js',[('Keine ausreichende Messabdeckung (mindestens 70 %) für diesen Ausschnitt.','Keine verwertbaren Messpunkte für diesen Ausschnitt.'),('if(!result){result=RS.buildMesh(data,settings);result.surveyReason=reason;}','if(!result){try{result=RS.buildMesh(data,settings);result.surveyReason=reason;}catch(e){if(!data.sourceAudit||!event.data.surveyURL)throw e;RS.meshProgress({step:"Kartierte Flächen: geschlossene Höhenhülle prüfen",pass:2});const mod=await import(event.data.surveyURL);result=mod.contactEnvelope(RS,data,settings,e);}}')]);
upd('app.js',[("let atlasModule;","let atlasModule,autoName=!localStorage.getItem('relief-settings-v3')||settings.title===R.defaults.title;"),(" if(k==='aerialColour'&&mesh)"," if(k==='title')autoName=false;if(autoName&&settings.mode==='model'&&['lon','lat'].includes(k))settings.title='Ausschnitt '+settings.lat.toFixed(4)+', '+settings.lon.toFixed(4);\n if(k==='aerialColour'&&mesh)"),("const place=cities[b.dataset.city];settings=","const place=cities[b.dataset.city];autoName=true;settings="),("title:p.name,region:p.region,countryCode:p.countryCode,countryName:p.country,autoSubtitle:true};","title:p.name,region:p.region,countryCode:p.countryCode,countryName:p.country,autoSubtitle:true};autoName=true;"),("settings=p.settings;data=p.data;locationEpoch++","settings=p.settings;autoName=false;data=p.data;locationEpoch++"),("mesh=result;R.diagnostics.event('Stadtoberfläche'","if(result.vectorEnvelope&&source.sourceAudit)source.sourceAudit.meshRecovery={...result.vectorEnvelope,description:result.surveyReason};else if(source.sourceAudit)delete source.sourceAudit.meshRecovery;mesh=result;R.diagnostics.event('Stadtoberfläche'"),("R.diagnostics.event('Koordinaten-Quellencheck',loaded.sourceAudit)","R.diagnostics.event('Koordinaten-Quellencheck',{status:'done',detail:loaded.sourceAudit.usedLayers+' · '+loaded.sourceAudit.quality,bytes:loaded.sourceAudit.bytes})"),('await nextFrame();result=R.buildMesh(source,inputSettings);','await nextFrame();try{result=R.buildMesh(source,inputSettings);}catch(e){if(!source.sourceAudit)throw e;const mod=await import(new URL((globalThis.RELIEF_STATIC_PREVIEW?\'source/public/\':\'\')+\'survey29.js\',document.baseURI));result=mod.contactEnvelope(R,source,inputSettings,e);}')]);
# No duplicate geometry pass when the worker already read the same immutable archives.
upd('app.js',[("});try{await worldDetails(loaded,controller.signal);}","});try{if(loaded.sourceAudit?.release)loaded.worldCheck={status:'ok',release:loaded.sourceAudit.release,count:loaded.sourceAudit.updated||0,surfaces:loaded.sourceAudit.bag?.count||0,providers:loaded.sourceAudit.providersUsed||[]};else await worldDetails(loaded,controller.signal);}")]);
# Locate the optional external module relative to the document, not relative to an inline worker blob. CSP and URLs stay unchanged.
f=site/'upgrade28-atlas.json';j=json.loads(f.read_text());oldlist=json.dumps(list(j['changes']));
for name in ['public/app.js','public/worker.js']:
 a=(old/name).read_text();b=(root/name).read_text();A=a.split('\n');B=b.split('\n');h=lambda s:hashlib.sha256(s.encode()).hexdigest();j['changes'][name]=dict(base=h(a),result=h(b),edits=[[i,l-i,B[k:m]] for t,i,l,k,m in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes() if t!='equal']);
f.write_text(json.dumps(j,ensure_ascii=False,separators=(',',':'))+'\n');g=site/'gate-v28.js';g.write_text(once(g.read_text(),'for(const name of '+oldlist+')','for(const name of '+json.dumps(list(j['changes']))+')'))
