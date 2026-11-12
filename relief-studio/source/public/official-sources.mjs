import {parseCityGML,parseCityJSON,validateSolid,sourceError,geographic,crsCode} from './official-geometry.mjs';
import {checkPointCollection,derivePointBuilding} from './official-points.mjs';
import {toRD} from './atlas-bag.mjs';
import {readLimited,inflate,readGMLZip} from './official-archive.mjs';
export const LGL={provider:'LGL Baden-Württemberg',official:true,url:'https://opengeodata.lgl-bw.de/',license:'dl-de/by-2-0',attribution:'Datenquelle: LGL, www.lgl-bw.de, dl-de/by-2-0',crs:'EPSG:25832',verticalDatum:'DHHN2016',detail:'LoD2: amtliches generalisiertes Gebäudemodell, keine vollständige Fassadenvermessung'};
export const BAG={provider:'3DBAG',official:false,url:'https://3dbag.nl/',license:'CC BY 4.0',attribution:'3DBAG by TU Delft / 3DGI · CC BY 4.0',crs:'EPSG:7415',verticalDatum:'NAP',detail:'Fachmodell aus amtlichen BAG-/AHN-Grundlagen; nicht als unmittelbar amtliche Fläche bezeichnet'};
export const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const bbox=pts=>[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];
export function checkPack(pack){
 if(pack?.schema!=='rs-official-pack-1'||!Array.isArray(pack.models)||pack.models.length>15000||!Array.isArray(pack.rejected||[]))throw sourceError('Ungültiges amtliches Flächenpaket.');let n=0;
 for(const m of pack.models){validateSolid(m);n+=m.triangles.length;if(n>1800000)throw sourceError('Zu viele amtliche Flächendreiecke.');}return pack;
}
/** Local files have explicit provenance; they do not become authenticated merely by import. */
export async function importOfficial(bytes,name,bounds){
 const raw=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(raw.length>50000000)throw sourceError('Importdatei größer als 50 MB.');
 const decoded=new TextDecoder('utf-8',{fatal:true});let files;
 if(raw[0]===80&&raw[1]===75)files=await readGMLZip(raw);
 else if(/\.gml$|\.xml$/i.test(name))files=[{name,text:decoded.decode(raw)}];
 else {
  const j=JSON.parse(decoded.decode(raw[0]===31&&raw[1]===139?await inflate(raw,'gzip',100000000):raw));
  if(j.schema==='rs-classified-points-1')return {points:checkPointCollection(j)};
  if(j.schema==='rs-official-pack-1')return {surfaces:checkPack(j)};
  let parsed;
  if(j.type==='CityJSON'||j.type==='CityJSONFeature'||j.feature){const src=j.source||(/^.*(?:28992|7415)/.test(j.metadata?.referenceSystem||j.metadata?.metadata?.referenceSystem||'')?BAG:null);if(!src)throw sourceError('CityJSON benötigt eine source mit Herkunft, Lizenz und Attribution.');parsed=parseCityJSON(j,{...src,imported:true},bounds);}
  else throw sourceError('Erwartet: CityGML, CityJSON, rs-official-pack-1 oder rs-classified-points-1.');
  return {surfaces:{schema:'rs-official-pack-1',...parsed,imported:name}};
 }
 const models=[],rejected=[];
 for(const f of files){if(!/DEBW_/.test(f.text)||!/ETRS89_UTM32|25832/.test(f.text))throw sourceError('CityGML-Direktimport erwartet LGL-BW-Daten; andere Quellen benötigen ein Paket mit eigener Quellenangabe.');const p=parseCityGML(f.text,{...LGL,imported:true,file:f.name},bounds);models.push(...p.models);rejected.push(...p.rejected);}
 return {surfaces:checkPack({schema:'rs-official-pack-1',models,rejected,imported:name})};
}
export async function loadBag(bounds,{signal,fetcher=fetch}={}){
 const report={provider:'3DBAG',bounds,status:'outside',models:[],rejected:[],bytes:0};if(!overlap(bounds,[3.2,50.7,7.3,53.7]))return report;
 const corners=[[bounds[0],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[1]],[bounds[2],bounds[3]]].map(p=>toRD(...p)),bb=bbox(corners).map((v,i)=>i<2?Math.floor(v-1):Math.ceil(v+1));
 let url=new URL('https://api.3dbag.nl/collections/pand/items');url.searchParams.set('bbox',bb.join(','));url.searchParams.set('limit','100');const seen=new Set();report.status='loading';
 try{for(let page=0;url&&page<35;page++){
  signal?.throwIfAborted();if(seen.has(url.href))throw sourceError('Wiederholte 3DBAG-Ergebnisseite.');seen.add(url.href);
  const bytes=await readLimited(await fetcher(url,{signal,credentials:'omit'}),Math.min(12000000,50000000-report.bytes));report.bytes+=bytes.length;
  const j=JSON.parse(new TextDecoder().decode(bytes));if(!Array.isArray(j.features)||!j.metadata)throw sourceError('Ungültige 3DBAG-Antwort.');
  for(const f of j.features){const p=parseCityJSON({feature:f,metadata:j.metadata},{...BAG,url:url.href},bounds);report.models.push(...p.models);report.rejected.push(...p.rejected);}
  const next=j.links?.find(l=>l.rel==='next');url=next?new URL(next.href,url):null;if(url&&(url.origin!=='https://api.3dbag.nl'||url.pathname!=='/collections/pand/items'))throw sourceError('Unzulässiger Quellen-Folgelink.');
  if(report.models.length>7000)throw sourceError('Zu viele amtliche Gebäude.');
 }report.status=url?'partial':'complete';if(url)report.reason='Quellenbudget erreicht; Rest nicht als fehlend interpretiert.';
 }catch(e){if(signal?.aborted&&signal.reason?.name!=='TimeoutError')throw e;report.status=report.models.length?'partial':'unavailable';report.reason=e.message;}
 return report;
}
export async function loadOfficial(bounds,{signal=AbortSignal.timeout(65000),fetcher=fetch,server=false}={}){
 const reports=[],models=[],rejected=[];
 const take=r=>{reports.push({provider:r.provider,status:r.status,reason:r.reason,bytes:r.bytes,bounds:r.bounds});models.push(...(r.models||[]));rejected.push(...(r.rejected||[]));};
 if(overlap(bounds,[7.5,47.5,10.5,49.85])){
  try{
   const index=JSON.parse(new TextDecoder().decode(await readLimited(await fetcher(new URL('./official-data/index.json',import.meta.url),{signal}),1000000)));
   if(index.schema!==1||!Array.isArray(index.tiles)||index.tiles.length>10000)throw sourceError('Ungültiger amtlicher Katalog.');
   let found=0;for(const item of index.tiles.filter(t=>overlap(t.bounds,bounds))){if(!/^[a-zA-Z0-9_.-]+\.json(?:\.gz)?$/.test(item.file))throw sourceError('Ungültiger Katalogpfad.');const raw=await readLimited(await fetcher(new URL('./official-data/'+item.file,import.meta.url),{signal}),20000000),text=new TextDecoder().decode(raw[0]===31?await inflate(raw,'gzip',100000000):raw),pack=checkPack(JSON.parse(text));take({provider:'LGL BW · bereitgestellte Flächen',status:'complete',bounds:item.bounds,models:pack.models.filter(m=>overlap(m.bbox,bounds)),rejected:pack.rejected});found++;}
   if(!found)take({provider:'LGL BW',status:'unavailable',bounds,reason:'Für diesen Ausschnitt ist noch kein Flächenpaket bereitgestellt. Der Landes-ZIP-Dienst erlaubt keinen direkten GitHub-Pages-Abruf. CityGML/ZIP importieren; nicht durch Messraster ersetzen.'});
  }catch(e){if(signal.aborted&&signal.reason?.name!=='TimeoutError')throw e;take({provider:'LGL BW',status:'unavailable',bounds,reason:e.message});}
 }
 if(overlap(bounds,[3.2,50.7,7.3,53.7]))take(await loadBag(bounds,{signal,fetcher}));
 if(!reports.length)reports.push({provider:'Quellenabdeckung',status:'unsupported',bounds,reason:'Noch kein automatischer Flächendienst angebunden. Amtliche Dateien können importiert werden.'});
 return {schema:'rs-official-pack-1',bounds:bounds.slice(),models,rejected,reports,fetchedAt:Date.now()};
}
export async function selectOfficial(data,{signal,loader=loadOfficial,server=false}={}){
 const input=data.officialInput?checkPack(data.officialInput):null,cached=data.officialCache&&Date.now()-(data.officialCache.fetchedAt||0)<86400000&&JSON.stringify(data.officialCache.bounds)===JSON.stringify(data.bounds)?checkPack(data.officialCache):null;
 // A supplied complete local package is usable offline; never require a network service to re-approve it.
 const remote=cached||(input?{schema:'rs-official-pack-1',bounds:data.bounds,models:[],rejected:[],reports:[]} : await loader(data.bounds,{signal,server}));
 const models=[],ids=new Set(),reports=[...(remote.reports||[])],rejected=[...(remote.rejected||[]),...(input?.rejected||[])];
 for(const m of [...(input?.models||[]),...remote.models])if(overlap(m.bbox,data.bounds)&&!ids.has(m.id)){validateSolid(m);ids.add(m.id);models.push(m);}
 const pointAudit=[];if(data.officialPoints){const bundle=checkPointCollection(data.officialPoints),code=crsCode(bundle.crs);for(const r of bundle.buildings){const bb=bbox(r.footprint.flat().map(p=>geographic(p,code)));
  if(!overlap(bb,data.bounds))continue;
  if(models.some(m=>overlap(m.bbox,bb))){pointAudit.push({id:r.id,status:'protected',reason:'Amtliche/Fach-Flächen vorhanden; Messpunkte nicht verwendet.'});continue;}
  if(rejected.some(m=>m.id===r.id)||reports.some(p=>['unavailable','partial'].includes(p.status)&&overlap(p.bounds||data.bounds,bb))){pointAudit.push({id:r.id,status:'blocked',reason:'Vorhandene fehlerhafte oder nicht prüfbare Flächen sind keine bestätigte Datenlücke.'});continue;}
  const check=r.surfaceCheck;
  if(check?.status!=='absent'||typeof check.sourceURL!=='string'||!/^https:\/\//.test(check.sourceURL)||!Number.isFinite(Date.parse(check.checkedAt||''))){pointAudit.push({id:r.id,status:'blocked',reason:'Nachweis einer fehlenden Flächenquelle fehlt.'});continue;}
  try{const m=derivePointBuilding(bundle,r);m.source.surfaceCheck=check;models.push(m);pointAudit.push({id:r.id,status:'derived',quality:m.quality});}catch(e){pointAudit.push({id:r.id,status:'rejected',reason:e.message,code:e.code});}
 }}
 return {models,audit:{policy:'surfaces-first-v1',direct:models.filter(m=>m.source.method==='direct-surfaces').length,derived:models.filter(m=>m.source.method!=='direct-surfaces').length,rejected,pointAudit,reports,sources:[...new Map(models.map(m=>[JSON.stringify(m.source),m.source])).values()]},cache:remote};
}
