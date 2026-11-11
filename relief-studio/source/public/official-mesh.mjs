/** Full closed source shells are boolean-unioned with the printable terrain.
 * Roofs/walls are not projected into a height field. Only coordinate conversion,
 * uniform scale, one rigid vertical placement, crop and foundation are applied.
 */
import clip from './atlas-clip.mjs';
import {contactEnvelope} from './survey29.js';
import {validateSolid,sourceError} from './official-geometry.mjs';
import {readLimited} from './official-archive.mjs';
import {selectOfficial} from './official-sources.mjs';
let kernel;
const vendor='https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/';
const hashes={js:'ca3c8a88df63bb3083013d1eb7f700bf23216594f6e98a2566e34f55d7341ce8',wasm:'73e3b419ad31294f6b1cc478173944e50efc4a34bfdeeff0107bdfc12975f11c'};
async function verified(name,hash,signal){const b=await readLimited(await fetch(vendor+name,{signal,credentials:'omit'}),1100000),sum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');if(sum!==hash)throw sourceError('Geometriebibliothek hat eine unerwartete Prüfsumme.','KERNEL_INTEGRITY');return b;}
export async function loadKernel(){
 return kernel??=(async()=>{const signal=AbortSignal.timeout(25000),[js,wasmBinary]=await Promise.all([verified('manifold.js',hashes.js,signal),verified('manifold.wasm',hashes.wasm,signal)]),url=URL.createObjectURL(new Blob([js],{type:'text/javascript'}));try{const {default:Module}=await import(url),lib=await Module({wasmBinary});lib.setup();return lib;}finally{URL.revokeObjectURL(url);}})().catch(e=>{kernel=null;throw sourceError('Amtliche Körper konnten nicht verbunden werden: '+e.message,'KERNEL_UNAVAILABLE');});
}
function makeBody(lib,vertices,indices,classes){const props=new Float32Array(vertices.length/3*4);for(let i=0;i<vertices.length/3;i++){props.set(vertices.slice(i*3,i*3+3),i*4);props[i*4+3]=classes?.[i]??1;}const input=new lib.Mesh({numProp:4,vertProperties:props,triVerts:Uint32Array.from(indices)});input.merge();const body=new lib.Manifold(input);if(body.status()!=='NoError'){const reason=body.status();body.delete();throw sourceError('Nicht druckbarer Quellkörper: '+reason,'OFFICIAL_TOPOLOGY');}return body;}
function normalizedFootprints(R,data,models){return models.flatMap(m=>m.footprints.map(rings=>{const r=rings.map(r=>R.normalized(data.bounds,r));return {rings:r,box:R.ringBox(r[0])};}));}
function schematicBase(R,data,models){
 const polys=normalizedFootprints(R,data,models),bins=new Map();const cells=box=>{const out=[];for(let y=Math.max(-1,Math.floor(box[1]*24));y<=Math.min(24,Math.floor(box[3]*24));y++)for(let x=Math.max(-1,Math.floor(box[0]*24));x<=Math.min(24,Math.floor(box[2]*24));x++)out.push(x+','+y);return out;};
 polys.forEach((p,i)=>{for(const key of cells(p.box)){if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);}});
 const buildings=[];let replaced=0;
 for(const b of data.buildings){const hits=[...new Set(cells(R.ringBox(b.rings[0])).flatMap(k=>bins.get(k)||[]))];let remaining=[b.rings];
  if(hits.length){remaining=clip.difference([b.rings],...hits.map(i=>[polys[i].rings]));if(JSON.stringify(remaining)!==JSON.stringify([b.rings]))replaced++;}
  for(let i=0;i<remaining.length;i++){const rings=remaining[i];if(!rings.length)continue;
   const tags={...b.tags,'roof:shape':'flat'};for(const k of ['roof:height','roof:angle','roof:levels','roof:orientation','building:roof:shape','building:roof:height'])delete tags[k];
   buildings.push({...b,id:'schematic:'+b.id+':'+i,rings,tags,detailRoof:null,partIds:[],height:Math.max(.3,b.height),heightSource:b.heightSource||'Schätzwert'});
  }
 }
 return {data:{...data,buildings,trees:[],roofPack:null},replaced,schematic:buildings.length};
}
function foundation(lib,vertices,triangle){
 let top=triangle.map(i=>Array.from(vertices.slice(i*3,i*3+3)));const cross=(top[1][0]-top[0][0])*(top[2][1]-top[0][1])-(top[1][1]-top[0][1])*(top[2][0]-top[0][0]);
 if(Math.abs(cross)<1e-12)return null;if(cross<0)top.reverse();
 const v=Float32Array.from([...top.map(p=>[p[0],p[1],.02]),...top.map(p=>[p[0],p[1],p[2]+.001])].flat()),ix=[2,1,0,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5];return makeBody(lib,v,ix);
}
/** Exported for deterministic geometry tests with an injected kernel. */
export async function unionOfficial(R,data,s,base,models,lib,{signal}={}){
 const info=R.boundsInfo(data.bounds),w=s.modelWidth,h=w*info.h/info.w,scale=w/info.w,ground=R.architecture.smoothTerrainGrid(data.terrain,s.terrainSmooth);let low=Infinity;for(const z of data.terrain.values)low=Math.min(low,z);
 const terrainAt=(u,v)=>s.base+Math.max(0,R.sampleTerrain(ground,u,v)-low)*scale*s.terrainFactor;
 const alive=new Set(),keep=b=>{alive.add(b);return b;},drop=b=>{if(alive.delete(b))b.delete();};const audit=[];
 try{
  let result=keep(makeBody(lib,base.vertices,base.indices,base.classes));
  const ceiling=Math.max(base.zmax+2000,...models.map(m=>base.zmax+m.height*scale+100)),cube=keep(lib.Manifold.cube([w,h,ceiling])),crop=keep(cube.translate([-w/2,-h/2,0]));drop(cube);
  let batch=[];
  for(let index=0;index<models.length;index++){
   signal?.throwIfAborted();const model=validateSolid(models[index]);R.meshProgress?.({step:'Amtliche Dach- und Wandflächen verbinden',done:index,total:models.length,pass:1});
   const uv=R.normalized(data.bounds,model.vertices.map(p=>p.slice(0,2))),groundIDs=new Set(model.triangles.flatMap((t,i)=>model.kinds[i]==='GroundSurface'?t:[]));if(!groundIDs.size)throw sourceError('Gebäudeboden fehlt.');
   let shift=-Infinity;for(const i of groundIDs){const [u,v]=uv[i];shift=Math.max(shift,terrainAt(R.clamp(u,0,1),R.clamp(v,0,1))-(model.vertices[i][2]-model.ground)*scale);}
   const vertices=Float32Array.from(model.vertices.flatMap((p,i)=>[(uv[i][0]-.5)*w,(.5-uv[i][1])*h,shift+(p[2]-model.ground)*scale]));
   const shell=keep(makeBody(lib,vertices,model.triangles.flat())),parts=[shell];
   for(let i=0;i<model.triangles.length;i++)if(model.kinds[i]==='GroundSurface'){const f=foundation(lib,vertices,model.triangles[i]);if(f)parts.push(keep(f));}
   let supported=keep(lib.Manifold.union(parts));for(const p of parts)drop(p);
   const clipped=keep(supported.intersect(crop));drop(supported);if(clipped.status()!=='NoError')throw sourceError('Amtliche Flächen konnten nicht am Ausschnitt geschnitten werden.','OFFICIAL_CROP');
   if(clipped.isEmpty()){drop(clipped);continue;}batch.push(clipped);
   audit.push({id:model.id,method:model.source.method,uniformScaleMmPerMetre:scale,verticalPlacementMm:shift,foundation:'Separate Bodenstütze; keine Änderung der Dachform',cropped:model.bbox[0]<data.bounds[0]||model.bbox[1]<data.bounds[1]||model.bbox[2]>data.bounds[2]||model.bbox[3]>data.bounds[3]});
   if(batch.length===32||index===models.length-1){const next=keep(lib.Manifold.union([result,...batch]));drop(result);for(const m of batch)drop(m);batch=[];result=next;}
  }
  if(batch.length){const next=keep(lib.Manifold.union([result,...batch]));drop(result);for(const m of batch)drop(m);result=next;}
  if(result.status()!=='NoError'||!(result.volume()>0))throw sourceError('Amtliches Gesamtmodell ist nicht druckbar.','OFFICIAL_BOOLEAN');
  const components=result.decompose();const count=components.length;for(const part of components)part.delete();if(count!==1)throw sourceError('Amtliche Gebäudeteile sind nicht mit dem Drucksockel verbunden.','OFFICIAL_DISCONNECTED');
  const out=result.getMesh(),vertices=new Float32Array(out.numVert*3),classes=new Uint8Array(out.numVert);let zmax=0;
  for(let i=0;i<out.numVert;i++){const p=i*out.numProp;vertices.set(out.vertProperties.slice(p,p+3),i*3);classes[i]=Math.round(R.clamp(out.vertProperties[p+3]||0,0,7));zmax=Math.max(zmax,vertices[i*3+2]);}
  return {...base,vertices,classes,indices:Uint32Array.from(out.triVerts),zmax,landFaces:undefined,preview:undefined,kind:'architecture',officialPlacement:audit,booleanKernel:'Manifold 3.5.4; SHA-256 pinned',buildingCount:base.buildingCount+audit.length};
 }finally{for(const b of alive)b.delete();}
}
export async function buildOfficial(R,data,settings,{signal=AbortSignal.timeout(90000),loader,server=false,kernelLoader=loadKernel}={}){
 const s={...settings,buildingFactor:1,landmarkFactor:1,landmarkWidth:1,architectureMode:'mapped',surfaceMode:'classic'},selected=await selectOfficial(data,{signal,loader,server}),prepared=schematicBase(R,data,selected.models);
 R.meshProgress?.({step:'Gelände und ausdrücklich schematische Datenlücken',pass:1});
 let base;try{base=R.buildMesh(prepared.data,s);}catch(e){if(!data.sourceAudit)throw e;base=contactEnvelope(R,prepared.data,s,e);}
 const mesh=selected.models.length?await unionOfficial(R,data,s,base,selected.models,await kernelLoader(),{signal}):base;
 mesh.officialAudit={...selected.audit,schematic:prepared.schematic,replacedMappedFootprints:prepared.replaced,strictScale:true,warning:'Amtliche LoD2-Flächen können bereits generalisiert sein. Fehlende Fassadendetails werden nicht erfunden.'};
 mesh.officialCache=selected.cache;
 mesh.surveyReason=`Flächen zuerst: ${selected.audit.direct} direkte Modelle · ${selected.audit.derived} aus klassifizierten Messpunkten · ${prepared.schematic} schematische Kartenkörper. `+(selected.audit.reports.filter(r=>r.reason).map(r=>r.reason).join(' ')||'Dach- und Wandflächen unverändert übernommen; Ausschnitt und Druckfundament gesondert angepasst.');
 return mesh;
}
