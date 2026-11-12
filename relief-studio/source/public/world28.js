import {fetchRoofs} from './world-surfaces28.js?official=1';
// Supplement, never replace the project's footprints. No names or project files leave the device.
import {PMTiles,VectorTile,Pbf} from './world-tiles.js';
const host='https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com';
const knownRelease='2026-10-21.0';
const okNum=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
export function extractTile(bytes,ids,records=new Map()){
 const vt=new VectorTile(new Pbf(new Uint8Array(bytes)));
 for(const key of ['building','building_part']){const l=vt.layers[key];if(!l||l.length>60000)continue;
  for(let i=0;i<l.length;i++){const p=l.feature(i).properties;if(p.is_underground===true||!p.sources||typeof p.sources!=='string'||p.sources.length>30000)continue;
   const extra={};if(okNum(p.height,.2,1000))extra.height=String(p.height);if(okNum(p.num_floors,1,200))extra['building:levels']=String(p.num_floors);
   if(typeof p.roof_shape==='string'&&/^(flat|gabled|hipped|pyramidal|dome|skillion|round|gambrel|mansard|cone|saltbox|half[-_]hipped|onion|spherical)$/.test(p.roof_shape))extra['roof:shape']=p.roof_shape.replace('_','-');
   if(okNum(p.roof_height,.1,200))extra['roof:height']=String(p.roof_height);if(okNum(p.roof_direction,0,360))extra['roof:direction']=String(p.roof_direction);if(['along','across'].includes(p.roof_orientation))extra['roof:orientation']=p.roof_orientation;
   if(!Object.keys(extra).length)continue;
   let sources;try{sources=JSON.parse(p.sources);}catch{continue;}if(!Array.isArray(sources))continue;
   const src=sources.filter(s=>s.dataset==='OpenStreetMap'&&(!s.property||s.property==='/geometry'||s.property==='geometry'));
   const osm=new Set(src.map(s=>/^(w|r)(\d+)(?:@\d+)?$/.exec(String(s.record_id))).filter(Boolean).map(m=>(m[1]==='w'?'way/':'relation/')+m[2]));if(osm.size!==1)continue;const id=[...osm][0];if(!ids.has(id))continue;
   // Distinct GERS features using the same OSM identifier are ambiguous. Don't choose by name or proximity.
   const g=String(p.id||'');if(!g)continue;if(records.has(id)&&records.get(id)?.gers!==g){records.set(id,null);continue;}
   records.set(id,{id,gers:g,fields:extra,sources:[...new Set(sources.map(s=>String(s.dataset||'')).filter(Boolean))].slice(0,12),heightSource:String(p['@height_source']||'Overture')});
  }
 }return records;
}
export function tileList(b){if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||b[1]<-85||b[3]>85||b[0]<-180||b[2]>180)return [];
 const n=16384,x=a=>Math.max(0,Math.min(n-1,Math.floor((a+180)*n/360))),y=a=>Math.max(0,Math.min(n-1,Math.floor((1-Math.asinh(Math.tan(a*Math.PI/180))/Math.PI)*n/2)));
 const a=x(b[0]),z=x(b[2]),j=y(b[3]),k=y(b[1]);if((z-a+1)*(k-j+1)>12)return [];const out=[];for(let Y=j;Y<=k;Y++)for(let X=a;X<=z;X++)out.push([X,Y]);return out;}
export async function collect(bounds,keys){const tiles=tileList(bounds);if(!tiles.length)return {status:'area-limit',records:[]};
 let release=knownRelease;try{const r=await fetch('https://stac.overturemaps.org/catalog.json',{signal:AbortSignal.timeout(1600),credentials:'omit'});if(r.ok){const j=await r.json();if(/^20\d\d-\d\d-\d\d\.\d{1,2}$/.test(j.latest))release=j.latest;}}catch{}
 const url=host+'/tiles/'+release+'/buildings.pmtiles';let charged=0;
 const source={getKey:()=>url,getBytes:async(offset,length,signal)=>{if(length>6e6||charged+length>12e6)throw Error('Datenlimit');charged+=length;const r=await fetch(url,{headers:{Range:`bytes=${offset}-${offset+length-1}`},signal,credentials:'omit'});if(r.status!==206){await r.body?.cancel();throw Error('Kartendienst HTTP '+r.status);}const data=await r.arrayBuffer();if(data.byteLength!==length)throw Error('Ungültiger Bytebereich');return {data,etag:r.headers.get('etag')||undefined};}};
 const archive=new PMTiles(source),ids=new Set(keys),records=new Map();let done=0;let failure='';for(const [x,y] of tiles){try{const r=await archive.getZxy(14,x,y);if(r&&r.data.byteLength<=12e6)extractTile(r.data,ids,records);done++;}catch(e){failure=String(e.message||e).slice(0,120);break;}}
 return {release,status:done===tiles.length?'ok':done?'partial':'unavailable',tiles:done,total:tiles.length,bytes:charged,reason:failure,records:[...records.values()].filter(Boolean)};}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope)self.onmessage=async({data})=>{
 const roofs=[],ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),data.bagMs||4000);
 const pending=fetchRoofs(data.buildings||[],m=>{roofs.push(m);self.postMessage({progress:'roof',roof:m});},ctrl.signal).catch(()=>{});
 let output;try{output=await collect(data.bounds,data.ids);}catch(e){output={status:'unavailable',reason:String(e.message||e),records:[]};}
 self.postMessage({progress:'fields',output});await pending;clearTimeout(timer);self.postMessage({...output,roofs});};
