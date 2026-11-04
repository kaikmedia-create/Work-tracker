from pathlib import Path
import difflib,json,sys,shutil,hashlib
site=Path(sys.argv[1]);base=Path(sys.argv[2]);src=site/'source';here=Path(__file__).parent
def edit(p,a,b):
 s=p.read_text();assert s.count(a)==1,(str(p),a[:80]);p.write_text(s.replace(a,b))
def delta(a,b):
 A=a.split('\n');B=b.split('\n');h=lambda x:hashlib.sha256(x.encode()).hexdigest();return {'base':h(a),'result':h(b),'edits':[[i,j-i,B[k:l]] for op,i,j,k,l in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes() if op!='equal']}
arch=src/'public/architecture.js';edit(arch,'const hit=splitBy(f.poly,patch.poly);','''// On dense assemblies, do not cut a face for a roof wholly hidden below it.
  if(patch.fastEnvelope&&!patch.force&&patch.kind===f.kind&&f.poly.every(pt=>evalZ(f.plane,pt)>=evalZ(patch.plane,pt))){out.push(f);continue;}
  const hit=splitBy(f.poly,patch.poly);''');edit(arch,'const faces=[],topCount=', '''// Upper-envelope order avoids subdividing hidden roofs hundreds of times. Forced boundary
 // and seam repairs retain priority and the final solid still undergoes the full topology audit.
 if(data.buildings.some(b=>(b.partIds?.length||0)>70)){
  const top=patches.map(p=>{p.fastEnvelope=true;return Math.max(...p.poly.map(x=>evalZ(p.plane,x)));});
  for(const list of bins.values())if(list.length>10)list.sort((a,b)=>{const ga=patches[a].force?(patches[a].precisionRepair?2:0):1,gb=patches[b].force?(patches[b].precisionRepair?2:0):1;return ga-gb||(ga===1?top[b]-top[a]:0)||a-b;});
 }
 const faces=[],topCount=''');p=src/'public/world-surfaces28.js';shutil.copyfile(here/'world-surfaces28.js',p);s=p.read_text();i=s.index('// Horizontal sweep');j=s.index('export function parseBag',i);s="import earcut, {deviation} from './world-earcut28.js';\n"+s[:i]+'''// Triangulate original polygon vertices; reject incomplete roofs instead of bridging their courtyards.
function tessellate(rings,add){const pts=[],xy=[],holes=[];for(const r of rings){if(pts.length)holes.push(pts.length);for(const v of r){pts.push(v);xy.push(v[0]-rings[0][0][0],v[1]-rings[0][0][1]);}}const triangles=earcut(xy,holes,2);if(!triangles.length||deviation(xy,holes,2,triangles)>.00001)throw Error('Invalid roof coverage');let area=0;for(let k=0;k<triangles.length;k+=3){const t=[pts[triangles[k]],pts[triangles[k+1]],pts[triangles[k+2]]],ar=Math.abs(cross(...t))/2;if(ar>1e-7){add(t);area+=ar;}}return area;}
'''+s[j:];p.write_text(s)
w=src/'public/world28.js';s=w.read_text();s="import {fetchRoofs} from './world-surfaces28.js';\n"+s[:s.index('if(typeof WorkerGlobalScope')]+'''if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope)self.onmessage=async({data})=>{
 const roofs=[],ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),data.bagMs||4000);
 const pending=fetchRoofs(data.buildings||[],m=>{roofs.push(m);self.postMessage({progress:'roof',roof:m});},ctrl.signal).catch(()=>{});
 let output;try{output=await collect(data.bounds,data.ids);}catch(e){output={status:'unavailable',reason:String(e.message||e),records:[]};}
 self.postMessage({progress:'fields',output});await pending;clearTimeout(timer);self.postMessage({...output,roofs});};
''';w.write_text(s)
app=src/'public/app.js';edit(app,'const result=await new Promise(resolve=>{let w,settled=false,timer;', '''const candidates=[],dups=new Set(),seen=new Set();for(const list of idMap.values())for(const b of list){const id=b.tags?.['ref:bag'];if(seen.has(id))dups.add(id);seen.add(id);if(!/^\\d{16}$/.test(id)||b.partIds?.length||b.tags?.['building:part']||b.tags?.['roof:shape']||b.tags?.location==='underground')continue;
   candidates.push({id,osm:b.id,score:(b.landmark?4:0)+(b.name?2:0)+(b.tags.wikidata?1:0)});}
 const inNL=target.bounds[0]>=3.2&&target.bounds[2]<=7.3&&target.bounds[1]>=50.7&&target.bounds[3]<=53.7;
 const buildings=inNL?candidates.filter(b=>!dups.has(b.id)).sort((a,b)=>b.score-a.score).slice(0,8).map(({id,osm})=>({id,osm})):[];
 const partialRoofs=[];let partialFields=null;
 const result=await new Promise(resolve=>{let w,settled=false,timer;''');edit(app,'w.onmessage=e=>finish(e.data);',"w.onmessage=e=>{const m=e.data;if(m.progress==='roof'){partialRoofs.push(m.roof);return;}if(m.progress==='fields'){partialFields=m.output;return;}finish(m);};");edit(app,"finish({status:'timeout'})","finish({...partialFields,status:'timeout',roofs:partialRoofs})");edit(app,'ids:[...idMap.keys()]','ids:[...idMap.keys()],buildings,bagMs:Math.max(1000,timeout-900)');edit(app,"const summary={status:result.status,",'''let surfaces=0;const applied=new Set();const dim=R.boundsInfo(target.bounds);const area=ring=>Math.abs(ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+(p[0]-ring[0][0])*(q[1]-ring[0][1])-(p[1]-ring[0][1])*(q[0]-ring[0][0]);},0))/2;
 for(const rec of result.roofs||[]){const list=idMap.get(rec.osm);if(list?.length!==1||applied.has(rec.osm))continue;const b=list[0];if(b.detailRoof||b.tags?.['ref:bag']!==rec.bag||b.partIds?.length||!rec.roof?.t?.length)continue;
  const bb=R.ringBox(b.rings[0]),proj=R.normalized(target.bounds,[[rec.bbox[0],rec.bbox[3]],[rec.bbox[2],rec.bbox[1]]]),a=[...proj[0],...proj[1]],w=bb[2]-bb[0],h=bb[3]-bb[1];if(!(w>0&&h>0)||Math.max(Math.abs(a[0]-bb[0])/w,Math.abs(a[2]-bb[2])/w,Math.abs(a[1]-bb[1])/h,Math.abs(a[3]-bb[3])/h)>.12)continue;
  const originalArea=(area(b.rings[0])-b.rings.slice(1).reduce((v,r)=>v+area(r),0))*dim.w*dim.h;if(!(originalArea>1)||rec.area/originalArea<.78||rec.area/originalArea>1.22)continue;
  b.detailRoof=rec.roof;b.detailRoofSource={provider:'3DBAG',identifier:rec.bag,license:'CC BY 4.0'};applied.add(b.id);surfaces++;if(!b.worldSource)count++;
 }
 const summary={surfaces,status:result.status,''');edit(app,"+' Objekte in diesem Abruf ergänzt';}","+' Objekte in diesem Abruf ergänzt'+(r.surfaces?' · '+r.surfaces+' 3DBAG-Dachmodelle':'');}");edit(app,"if(settings.mode==='model'&&settings.worldBuildings){progress('Optionale Gebäudedetails werden abgeglichen');await worldDetails(loaded,controller.signal);", "if(settings.mode==='model'&&settings.worldBuildings){progress({phase:'process',status:'waiting',detail:'Optionale Gebäudedetails: offene Quellen werden verglichen.'});try{await worldDetails(loaded,controller.signal);}catch(e){loaded.worldCheck={status:'unavailable',count:0,reason:String(e.message||e)};}");edit(app,"\\nNachbarschaftsdächer (Schätzungen):", "\\n3DBAG: ${data.buildings.some(b=>b.detailRoofSource?.provider==='3DBAG')?'TU Delft / 3DGI · CC BY 4.0 · https://3dbag.nl/ · LoD2.2-Dachflächen projiziert, trianguliert, auf lokalen Boden bezogen.':'nicht verwendet'}\\nNachbarschaftsdächer (Schätzungen):");p=src/'public/index.html';edit(p,'Overture Maps · ergänzt fehlende Angaben','3DBAG: passende vermessene Dachflächen in den Niederlanden. Overture Maps: ergänzt weltweit fehlende Angaben');p=src/'server.mjs';edit(p,'https://stac.overturemaps.org ','https://api.3dbag.nl https://stac.overturemaps.org ')
p=site/'RELEASE-NOTES-28.md';p.write_text(p.read_text()+'''\n## Komplexe Landmarken und nationale Dachmodelle\nMehrteilige Bauwerke mit über 70 verknüpften Teilen werden mit räumlich begrenzter Höhenpriorität aufgebaut. Vollständig verdeckte Flächen derselben Materialklasse erzeugen keine unnötigen Schnitte. Alle Teile bleiben Eingaben der oberen Gebäudehülle, mit abschließender Kantenprüfung.\n\nIn den Niederlanden ergänzt die öffentliche 3DBAG-API bis zu acht passende Gebäude pro Abgleich mit echten LoD2.2-Dachflächen (markante und benannte Bauwerke zuerst). Exakte BAG-ID, ähnliche Lage, Abmessungen und Flächeninhalt sind Pflicht; alte Projekte und eigene detaillierte Dächer bleiben geschützt. Quelle: 3DBAG by TU Delft 3D Geoinformation and 3DGI, https://3dbag.nl/, CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ . Bearbeitung: RD nach WGS84, Höhen relativ zum Gebäudeboden, trianguliert. Keine Fassaden oder Archivierung eines ganzen externen Datensatzes. Bei Teilabbruch bleiben bereits abgeschlossene Ergebnisse verwendbar.\n''')
patch=site/'upgrade28.json';j=json.loads(patch.read_text());
for group in ['changes','sourceChanges']:
 for n in j[group]:j[group][n]=delta((base/'source'/n).read_text(),(src/n).read_text());
patch.write_text(json.dumps(j,ensure_ascii=False,separators=(',',':'))+'\n');
# Strict acceptance: do not stage a regression in any sampled city.
p=src/'tests/world28-cities.mjs';edit(p,'filter(x=>x.ok).length>=3','filter(x=>x.ok).length===7');edit(p,'fewer than 3 checked city scenes','not all seven city scenes have a valid solid');
