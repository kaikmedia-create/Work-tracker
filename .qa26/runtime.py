from pathlib import Path
T=Path('relief-studio/source/public');cat=Path('catalog.json').read_text()
def edit(file,edits):
 p=T/file;s=p.read_text()
 for start,n,value in reversed(edits):s=s[:start]+value.replace('@@SURVEYS@@',cat)+s[start+n:]
 p.write_text(s)
edit('app.js',[(19695,0,'3D-Referenzmodelle: ${a.referenceModels||0} · Gebäude/Teile ohne Dachangabe: ${a.plainFootprints||0} (nur Grundriss).`, `'),(21409,417,"""const detail=R.architecture.referenceFor(b),top=detail?Math.max(...detail.v.map(v=>v[2]))/100:b.height;hint.textContent=detail?(b.detailRoof?'Eigene Dachflächen':b.id==='way/274663761'?'LoD2 + angenäherter Eckturm':'Amtliches LoD2-Dach')+' · '+number(top,1)+' m':`${b.heightSource} · ${number(b.height)} m`;
 check.addEventListener('change',()=>{settings.landmarkOverrides[b.id]={...settings.landmarkOverrides[b.id],enabled:check.checked};persist();scheduleBuild();preview();});const height=document.createElement('input');height.type='number';height.min='1';height.max='1000';height.step='1';height.value=String(settings.landmarkOverrides[b.id]?.height??top"""),(44724,184,r"""6\n${settings.title}\n\nAusschnitt (West, Süd, Ost, Nord): ${data.bounds.join(', ')}\nAbgerufen: ${data.capturedAt||'nicht angegeben'}\nOSM-Stand: ${data.osmTimestamp||'nicht angegeben'}\n\n3D-Gebäude (bei Verwendung): © LGL Baden-Württemberg, https://www.lgl-bw.de/ · LoD2 und DOP20 · Datenlizenz Deutschland – Namensnennung – Version 2.0, https://www.govdata.de/dl-de/by-2-0 · Dachflächen trianguliert, Höhen auf lokalen Boden bezogen. Peterskirche: Turmlage aus DOP20, vereinfachtes Dach; https://www.ekiwhm.de/orte/kirchen/peterskirche/ .\nEigene Dachquellen: ${[...new Set(data.buildings.filter(b=>b.detailRoof).map(b=>b.detailRoof.ref))].join('; ')||'keine"""),(56897,0,"""$('roof-import').onclick=()=>$('roof-file').click();$('roof-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(!data)throw Error('Zuerst eine Karte laden oder ein Projekt öffnen.');if(f.size>8000000)throw Error('Dachflächen-Datei größer als 8 MB.');const target=data,obj=JSON.parse(await f.text());if(target!==data)throw Error('Projekt wurde inzwischen gewechselt.');const n=R.architecture.importRoofSurfaces(data,obj);landmarkControls();quality();scheduleBuild();notify(n+' Gebäude mit eigener 3D-Quelle übernommen. Projekt erneut speichern.','success');}catch(err){notify(err.message,'error',null,err,{stage:'3D-Dachimport'});}};
"""),(63161,1,'6')]);
edit('architecture.js',[(3559,98,"""t['building:roof:shape']||'flat').toLowerCase();
 const shapes=['flat','gabled','hipped','pyramidal','skillion','dome','cone','round','gambrel','mansard"""),(6888,27,"""round','gambrel','mansard'].includes(spec.shape)){
  planes.length=0;
  const profile=spec.shape==='round'?[0,.075,.24,.46,.72,1].map(t=>[t,Math.sqrt(1-(1-t)**2)]):[[0,0],[.32,.65],[1,1]];
  const section=(dir,lo,hi,run)=>{for(let i=1;i<profile.length;i++){
   const [t0,z]=profile[i-1],[t1,z1]=profile[i],k=(z1-z)/(t1-t0),a=rh*k/run,b=rh*(z-k*t0);
   planes.push(linear(dir,a,b-a*lo),linear(dir,-a,b+a*hi));
  }};section(u,umin,umax,du/2);if(spec.shape==='mansard')section(v,vmin,vmax,Math.min(du,dv)/2);
 }
 if(['gabled','hipped','pyramidal','round','gambrel','mansard"""),(8818,0,"""// LoD2 roof surfaces: LGL Baden-Württemberg, dl-de/by-2-0. See LANDMARK-SOURCES.md.
const referenceCatalog=@@SURVEYS@@;
function referenceFor(b){return b.detailRoof || (!b.partIds?.length&&!b.tags?.['roof:shape']&&Object.hasOwn(referenceCatalog,b.id)?referenceCatalog[b.id]:null);}
function referencePatches(b,r,bounds,w,h,scale,foot,border,override){
 const fail=()=>{throw Object.assign(Error('Ungültige oder falsch zugeordnete 3D-Dachflächen: '+String(b.name||b.id)),{code:'LANDMARK_MODEL',diagnostics:{objectId:b.id}});};
 if(!Array.isArray(r.o)||r.o.length!==2||!r.o.every(Number.isSafeInteger)||!Array.isArray(r.v)||r.v.length<3||r.v.length>12000||!Array.isArray(r.t)||!r.t.length||r.t.length>4000)fail();
 let top=0;const ll=r.v.map(p=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isSafeInteger)||p[2]<0||p[2]>100000)fail();top=Math.max(top,p[2]);return [(r.o[0]+p[0])/1e7,(r.o[1]+p[1])/1e7];});if(!top)fail();
 const xy=R.normalized(bounds,ll),box=bbox(b.rings[0]),bb=bbox(xy),dx=Math.max(box[2]-box[0],.000001),dy=Math.max(box[3]-box[1],.000001);
 if(!intersects(box,bb)||bb[0]<box[0]-.4*dx||bb[2]>box[2]+.4*dx||bb[1]<box[1]-.4*dy||bb[3]>box[3]+.4*dy){if(b.detailRoof)fail();return null;}
 const f=Number.isFinite(override.height)?override.height*100/top:1;
 const xyz=xy.map(([x,y],i)=>[(x-.5)*w,(.5-y)*h,foot+scale*r.v[i][2]*.01*f]);const out=[];
 for(const tri of r.t){if(!Array.isArray(tri)||tri.length!==3||!tri.every(n=>Number.isInteger(n)&&n>=0&&n<xyz.length))fail();const q=tri.map(i=>xyz[i]);let poly=tidy(q.map(p=>p.slice(0,2)));if(!poly.length)continue;
  poly=splitBy(poly,border).inside;if(poly.length)out.push({poly,plane:planeFrom3(...q)});
 }return out.length?out:null;
}
function importRoofSurfaces(data,fc){
 const error=msg=>{throw Object.assign(Error(msg),{code:'LANDMARK_IMPORT'});};
 if(!data||fc?.type!=='FeatureCollection'||fc.height_reference!=='ground'||typeof fc.source!=='string'||!fc.source.trim()||!Array.isArray(fc.features)||!fc.features.length||fc.features.length>20000)error('Erwartet: GeoJSON FeatureCollection mit source, height_reference: ground und höchstens 20.000 Dachdreiecken.');
 const groups=new Map(),buildings=new Map(data.buildings.map(b=>[b.id,b]));
 for(const feat of fc.features){const id=feat?.properties?.osm_id,b=buildings.get(id),g=feat?.geometry,ring=g?.coordinates?.[0];if(!b||b.partIds?.length)error('Objekt nicht im Ausschnitt oder bereits in Teile gegliedert: '+String(id));
  if(g?.type!=='Polygon'||g.coordinates.length!==1||!Array.isArray(ring)||ring.length!==4||!ring.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=80&&p[2]>=0&&p[2]<=1000)||!ring[0].every((x,i)=>x===ring[3][i]))error('Jede Geometrie muss ein geschlossenes Dachdreieck [Längengrad, Breitengrad, Meter über lokalem Boden] sein.');
  if(!groups.has(id))groups.set(id,{o:[0,0],v:[],t:[],ref:fc.source.trim().slice(0,300)});const r=groups.get(id);if(r.t.length>=4000)error('Höchstens 4.000 Dachdreiecke pro Objekt.');const at=r.v.length;
  for(const [x,y,z] of ring.slice(0,3))r.v.push([Math.round(x*1e7),Math.round(y*1e7),Math.round(z*100)]);r.t.push([at,at+1,at+2]);
 }
 for(const [id,r] of groups){const b=buildings.get(id),xy=R.normalized(data.bounds,r.v.map(([x,y])=>[x/1e7,y/1e7])),bb=bbox(xy),box=bbox(b.rings[0]);for(const k of [0,1]){const width=Math.max(1e-8,box[k+2]-box[k]);if(![k,k+2].every(i=>Math.abs(bb[i]-box[i])<=.25*width))error('Dachmodell liegt nicht auf dem vollständigen Gebäudegrundriss: '+id);}if(!r.v.some(p=>p[2]>0)||r.t.some(t=>Math.abs(cross(...t.map(i=>xy[i])))<1e-16))error('Dachmodell ohne Höhe oder mit ungültigem Dreieck: '+id);}
 for(const [id,r] of groups)buildings.get(id).detailRoof=r;return groups.size;
}
"""),(8897,0,'referenceModels:0,referenceFaces:0,plainFootprints:0,'),(9105,33,');for(const b of data.buildings){if(!parents.has(b.id))parents.set(b.id,[]);parents.get(b.id).push(b);}'),(10004,60,'new Set(b.partIds||[]))for(const part of parents.get(id)||[]){'),(10927,45,"""model=referenceFor(b),reference=model?referencePatches(b,model,data.bounds,w,h,scale,foot,border,override):null;
  const parts=reference||roofPieces(polys,frame,spec,foot,scale);
  if(reference){stats.referenceModels++;stats.referenceFaces+=reference.length;}else if(!tag['roof:shape']&&!tag['building:roof:shape']&&!b.partIds?.length&&!tag['rs:wall'])stats.plainFootprints++"""),(11272,0,'!reference&&'),(50457,0,'referenceFor,referencePatches,importRoofSurfaces,')]);
edit('core.js',[(15523,0,"||t.type==='building'"),(15949,10,"&&m.role!=='inner')used.add(k+':'+(k==='building'&&t['building:part']&&t['building:part']!=='no'?'part:':'')+"),(17639,36,"{const k=kind(t);if(used.has(k+':'+(k==='building'&&t['building:part']&&t['building:part']!=='no'?'part:':'')+e.id)){}else "),(18627,0,""" // A Simple 3D Buildings relation is a membership list, not a multipolygon.
 const byId=new Map(buildings.map(b=>[b.id,b])),owners=new Map(),byOutline=new Map();
 for(const e of els){if(e.tags?.type!=='building'||e.type!=='relation')continue;
  const members=e.members||[],outlines=members.filter(m=>m.role==='outline').map(m=>m.type+'/'+m.ref).filter(id=>byId.has(id));
  if(outlines.length!==1)continue;const id=outlines[0];if(!byOutline.has(id))byOutline.set(id,new Set());
  for(const m of members){const pid=m.type+'/'+m.ref;if(m.role!=='part'||pid===id||!byId.get(pid)?.tags?.['building:part']||byId.get(pid).tags['building:part']==='no')continue;
   byOutline.get(id).add(pid);if(!owners.has(pid))owners.set(pid,new Set());owners.get(pid).add(id);
  }
 }
"""),(19006,0,'...(byOutline.get(b.id)||[])'),(19317,0,'!owners.has(p.b.id)&&')]);edit('data.js',[(6357,2,"${layer==='geometry'?'':'relation[type=building];out body qt;'}`; ")]);edit('diagnostics.js',[(2691,1,'6')]);edit('index.html',[(1506,1,'6'),(11250,0,'<details><summary>3D-Gebäude aus eigener Quelle</summary><p class="hint">Für alle Regionen: vollständige, triangulierte Dachflächen als GeoJSON (WGS84, Höhen über Gebäudegrund). Erforderlich: source, height_reference: ground und je Feature properties.osm_id. Der Import erfolgt lokal.</p><button class="secondary full" id="roof-import">Dachflächen importieren</button><input type="file" id="roof-file" accept=".geojson,.json" hidden></details>\n'),(32242,1,'6')]);
