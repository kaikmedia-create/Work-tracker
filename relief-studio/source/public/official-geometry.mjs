/** Source surfaces, not inferred roof types. All source coordinates are metres.
 * Triangulation, edge subdivision and orientation change topology only, not shape.
 * Unsupported CRS, incomplete shells and unknown semantics are rejected explicitly.
 */
import earcut,{deviation} from './world-earcut28.js';
import {rd} from './world-surfaces28.js';
export const SURFACE_SCHEMA='rs-official-surfaces-1';
const finite=Number.isFinite,sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function sourceError(message,code='OFFICIAL_GEOMETRY'){return Object.assign(Error(message),{code});}
export function crsCode(s){
 const x=String(s||'');
 if(/ETRS89_UTM32/.test(x))return 25832;
 if(/ETRS89_UTM33/.test(x))return 25833;
 const n=Number(x.match(/(?:\/|:)(\d+)\/?$/)?.[1]);
 if([25832,25833,28992,7415].includes(n))return n;
 throw sourceError('Nicht unterstütztes amtliches Koordinatensystem: '+x,'OFFICIAL_CRS');
}
/** ETRS89 / UTM (GRS80); no Web-Mercator height scaling is used for source Z. */
export function fromUTM(x,y,zone=32){
 const a=6378137,e2=0.006694380022900787,k=.9996,e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
 const M=y/k,mu=M/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
 const p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
 const ep=e2/(1-e2),C=ep*Math.cos(p)**2,T=Math.tan(p)**2,N=a/Math.sqrt(1-e2*Math.sin(p)**2),R=a*(1-e2)/(1-e2*Math.sin(p)**2)**1.5,D=(x-500000)/(N*k);
 const lat=p-N*Math.tan(p)/R*(D**2/2-(5+3*T+10*C-4*C*C-9*ep)*D**4/24+(61+90*T+298*C+45*T*T-252*ep-3*C*C)*D**6/720);
 const lon=((zone-1)*6-177)*Math.PI/180+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep+24*T*T)*D**5/120)/Math.cos(p);
 return [lon*180/Math.PI,lat*180/Math.PI];
}
export function toUTM(lon,lat,zone=32){
 const a=6378137,e2=.006694380022900787,ep=e2/(1-e2),p=lat*Math.PI/180,l=(lon-((zone-1)*6-177))*Math.PI/180,N=a/Math.sqrt(1-e2*Math.sin(p)**2),T=Math.tan(p)**2,C=ep*Math.cos(p)**2,A=Math.cos(p)*l;
 const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*p-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*p)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*p)-35*e2**3/3072*Math.sin(6*p));
 return [500000+.9996*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120),.9996*(M+N*Math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))];
}
export function geographic(p,code){return code===7415||code===28992?rd(p[0],p[1]):fromUTM(p[0],p[1],code===25833?33:32);}
const key=p=>p.map(v=>Math.round(v*1e5)).join(',');
const edge=(a,b)=>a<b?a+','+b:b+','+a;
function usages(tri){const map=new Map();for(let i=0;i<tri.length;i++)for(let j=0;j<3;j++){const a=tri[i][j],b=tri[i][(j+1)%3],k=edge(a,b);if(!map.has(k))map.set(k,[]);map.get(k).push([i,a,b]);}return map;}
/** Close only T-junctions that already have an exact collinear source vertex.
 * Missing faces are NEVER fabricated. Centroid fans stay on the existing plane. */
export function orientClosed(vertices,triangles,kinds){
 let t=triangles.map(t=>t.slice()),types=kinds.slice();
 for(let pass=0;pass<2;pass++){
  const use=usages(t),open=[...use.values()].filter(a=>a.length===1);
  if(!open.length)break;
  if(open.length>6000||vertices.length>16000)throw sourceError('Flächenkanten überschreiten das Reparaturbudget.');
  const split=new Map();
  for(const [[,a,b]] of open){
   const A=vertices[a],B=vertices[b],d=sub(B,A),den=dot(d,d);if(den<1e-12)throw sourceError('Nullkante in amtlicher Fläche.');
   const middle=[];
   for(let v=0;v<vertices.length;v++)if(v!==a&&v!==b){const q=sub(vertices[v],A),u=dot(q,d)/den;if(u<=1e-7||u>=1-1e-7)continue;if(q.every((x,i)=>Math.abs(x-u*d[i])<=.000025))middle.push([u,v]);}
   if(middle.length)split.set(edge(a,b),[a,...middle.sort((a,b)=>a[0]-b[0]).map(x=>x[1]),b]);
  }
  if(!split.size)break;
  const next=[],ks=[];
  for(let i=0;i<t.length;i++){
   const ring=[];let changed=false;
   for(let j=0;j<3;j++){const a=t[i][j],b=t[i][(j+1)%3],chain=split.get(edge(a,b));if(chain){const p=chain[0]===a?chain:chain.slice().reverse();ring.push(...p.slice(0,-1));changed=true;}else ring.push(a);}
   if(!changed){next.push(t[i]);ks.push(types[i]);continue;}
   const c=vertices.length;vertices.push([0,1,2].map(k=>t[i].reduce((s,v)=>s+vertices[v][k],0)/3));
   for(let j=0;j<ring.length;j++){next.push([ring[j],ring[(j+1)%ring.length],c]);ks.push(types[i]);}
  }
  t=next;types=ks;
 }
 const use=usages(t),neighbors=Array.from({length:t.length},()=>[]);
 for(const es of use.values()){
  if(es.length!==2)throw sourceError('Amtlicher Körper ist offen oder nicht mannigfaltig.','OFFICIAL_OPEN_SHELL');
  const [[i,a,b],[j,c,d]]=es,same=a===c&&b===d;neighbors[i].push([j,same]);neighbors[j].push([i,same]);
 }
 const flips=new Int8Array(t.length);flips.fill(-1);
 for(let i=0;i<t.length;i++)if(flips[i]===-1){
  const queue=[i];flips[i]=0;
  for(let q=0;q<queue.length;q++)for(const [j,same] of neighbors[queue[q]]){const f=flips[queue[q]]^(same?1:0);if(flips[j]===-1){flips[j]=f;queue.push(j);}else if(flips[j]!==f)throw sourceError('Nicht orientierbarer amtlicher Körper.');}
  let vol=0;const origin=vertices[t[i][0]];
  for(const j of queue){if(flips[j])t[j].reverse();const [a,b,c]=t[j].map(k=>sub(vertices[k],origin));vol+=dot(a,cross(b,c))/6;}
  if(Math.abs(vol)<.001)throw sourceError('Amtlicher Körper ohne belastbares Volumen.');
  if(vol<0)for(const j of queue)t[j].reverse();
 }
 return {triangles:t,kinds:types};
}
export function triangulateSurface(rings){
 const clean=rings.map(r=>{const out=r.filter((v,i)=>i===0||key(v)!==key(r[i-1]));if(out.length>1&&key(out[0])===key(out.at(-1)))out.pop();return out;});
 if(!clean.length||clean.some(r=>r.length<3||r.length>2000||r.some(v=>!Array.isArray(v)||v.length!==3||!v.every(finite))))throw sourceError('Ungültiger Flächenring.');
 const o=clean[0][0],local=clean.map(r=>r.map(p=>sub(p,o)));let normal=[0,0,0];
 for(let i=0;i<local[0].length;i++){const p=local[0][i],q=local[0][(i+1)%local[0].length],c=cross(p,q);normal=normal.map((x,k)=>x+c[k]);}
 const len=Math.hypot(...normal);if(len<1e-8)throw sourceError('Fläche ohne messbaren Flächeninhalt.');normal=normal.map(x=>x/len);
 if(local.flat().some(p=>Math.abs(dot(p,normal))>.025))throw sourceError('Nicht planare amtliche Fläche; keine stillschweigende Glättung.');
 const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(x=>x!==axis),pts=[],xy=[],holes=[];
 for(let j=0;j<local.length;j++){if(pts.length)holes.push(pts.length);for(let k=0;k<local[j].length;k++){pts.push(clean[j][k]);xy.push(local[j][k][axes[0]],local[j][k][axes[1]]);}}
 const ix=earcut(xy,holes,2);if(!ix.length||deviation(xy,holes,2,ix)>1e-6)throw sourceError('Flächentriangulierung deckt die Quelle nicht vollständig.');
 return Array.from({length:ix.length/3},(_,i)=>[pts[ix[3*i]],pts[ix[3*i+1]],pts[ix[3*i+2]]]);
}
export function solidFromSurfaces(id,surfaces,source,{parentId=id}={}){
 if(!source?.url||!source?.attribution||!source?.license)throw sourceError('Quellen- und Lizenznachweis fehlen.');
 const code=crsCode(source.crs),vertices=[],triangles=[],types=[],byKey=new Map(),footprints=[],kinds=new Set();
 if(!surfaces.length||surfaces.length>3000)throw sourceError('Flächenbudget überschritten.');
 for(const s of surfaces){
  if(!['RoofSurface','WallSurface','GroundSurface','ClosureSurface','OuterCeilingSurface','OuterFloorSurface'].includes(s.kind))throw sourceError('Unbekannte Gebäude-Flächensemantik.');
  kinds.add(s.kind);if(s.kind==='GroundSurface')footprints.push(s.rings.map(r=>r.map(p=>geographic(p,code))));
  for(const tri of triangulateSurface(s.rings)){
   const ids=tri.map(p=>{const k=key(p);if(!byKey.has(k)){byKey.set(k,vertices.length);vertices.push(p.slice());}return byKey.get(k);});
   if(new Set(ids).size!==3)throw sourceError('Entartetes Quelldreieck.');triangles.push(ids);types.push(s.kind);
  }
 }
 if(!['RoofSurface','WallSurface','GroundSurface'].every(k=>kinds.has(k)))throw sourceError('Dach-, Wand- oder Bodenflächen fehlen.','OFFICIAL_INCOMPLETE');
 if(vertices.length>16000||triangles.length>28000)throw sourceError('Ein Gebäude überschreitet das Geometriebudget.');
 const closed=orientClosed(vertices,triangles,types),ll=vertices.map(v=>[...geographic(v,code),v[2]]);
 if(ll.some(v=>!v.every(finite)||Math.abs(v[0])>180||Math.abs(v[1])>85||v[2]<-500||v[2]>10000))throw sourceError('Quellkoordinaten außerhalb des gültigen Bereichs.');
 const ground=surfaces.filter(s=>s.kind==='GroundSurface').flatMap(s=>s.rings.flat().map(v=>v[2])),z0=Math.min(...ground),zmax=Math.max(...vertices.map(p=>p[2]));
 if(zmax-z0<.3||zmax-z0>1000)throw sourceError('Unplausible Gebäudehöhe.');
 const bbox=[Math.min(...ll.map(p=>p[0])),Math.min(...ll.map(p=>p[1])),Math.max(...ll.map(p=>p[0])),Math.max(...ll.map(p=>p[1]))];
 return {schema:SURFACE_SCHEMA,id:String(id),parentId:String(parentId),vertices:ll,triangles:closed.triangles,kinds:closed.kinds,footprints,bbox,ground:z0,source:{...source,method:'direct-surfaces'},height:zmax-z0};
}
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export function parseCityJSON(payload,source,bounds){
 const f=payload.feature||payload,meta=payload.feature?payload.metadata:payload,tr=meta?.transform||f.transform,crs=meta?.metadata?.referenceSystem||f.metadata?.referenceSystem||source.crs;
 crsCode(crs);
 if(!f.CityObjects||!Array.isArray(f.vertices)||f.vertices.length>1200000||!tr||![tr.scale,tr.translate].every(a=>Array.isArray(a)&&a.length===3&&a.every(finite))||tr.scale.some(x=>x<=0))throw sourceError('Ungültige CityJSON-Koordinaten.');
 const vertices=f.vertices.map(p=>{if(!Array.isArray(p)||p.length!==3||!p.every(finite))throw sourceError('Ungültiger CityJSON-Punkt.');return p.map((v,i)=>v*tr.scale[i]+tr.translate[i]);});
 const models=[],rejected=[];
 for(const [id,obj] of Object.entries(f.CityObjects)){
  if(!['Building','BuildingPart'].includes(obj.type))continue;
  const geometries=(obj.geometry||[]).filter(g=>Number(g.lod)>=2&&Number(g.lod)<4).sort((a,b)=>Number(b.lod)-Number(a.lod));
  if(!geometries.length)continue;const g=geometries[0];
  try{
   if(!g.semantics?.surfaces||!g.semantics?.values)throw sourceError('CityJSON-Flächensemantik fehlt.');
   let shells,values;
   if(g.type==='Solid'){if(g.boundaries.length!==1)throw sourceError('Körper mit innerer Schale werden nicht umgedeutet.');shells=g.boundaries;values=g.semantics.values;}
   else if(['MultiSurface','CompositeSurface'].includes(g.type)){shells=[g.boundaries];values=[g.semantics.values];}
   else throw sourceError('Nicht unterstützter CityJSON-Geometrietyp: '+g.type);
   const surfaces=[];
   for(let k=0;k<shells.length;k++)for(let j=0;j<shells[k].length;j++){
    const v=values[k]?.[j],kind=g.semantics.surfaces[v]?.type;if(v===null||!kind)throw sourceError('Nicht zugeordnete Gebäudeoberfläche.');
    const rings=shells[k][j].map(r=>r.map(i=>{if(!Number.isInteger(i)||!vertices[i])throw sourceError('Ungültiger CityJSON-Punktindex.');return vertices[i];}));surfaces.push({kind,rings});
   }
   const m=solidFromSurfaces(id,surfaces,{...source,crs},{parentId:obj.parents?.[0]||id});if(!bounds||overlap(m.bbox,bounds))models.push(m);
  }catch(e){rejected.push({id,reason:e.message,code:e.code||'OFFICIAL_GEOMETRY'});}
 }
 return {models,rejected};
}
/** Small non-validating XML reader for the CityGML geometry subset; no entities,
 * DTD, network references or arbitrary XML execution. Used identically in workers. */
function xmlTree(xml){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw sourceError('XML-Entitäten sind nicht zulässig.');
 const root={tag:'root',a:{},children:[]},stack=[root],re=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/g;let m,n=0;
 while((m=re.exec(xml))){const s=m[0];if(s.startsWith('<!--')||s.startsWith('<?'))continue;
  if(s.startsWith('</')){if(stack.length===1||s.slice(2,-1).trim().split(':').at(-1)!==stack.at(-1).tag)throw sourceError('Unvollständiges CityGML.');stack.pop();}
  else if(s.startsWith('<')){if(++n>150000)throw sourceError('Gebäude-XML überschreitet das Budget.');const tag=s.match(/^<([^\s/>]+)/)?.[1];if(!tag)throw sourceError('Ungültiges XML.');const a={};for(const x of s.matchAll(/([^\s=<>]+)\s*=\s*(["'])(.*?)\2/g))a[x[1].split(':').at(-1)]=x[3];const node={tag:tag.split(':').at(-1),a,children:[],text:'',parent:stack.at(-1)};stack.at(-1).children.push(node);if(!s.endsWith('/>'))stack.push(node);}
  else if(stack.at(-1).tag==='posList'||stack.at(-1).tag==='pos')stack.at(-1).text+=s;
 }
 if(stack.length!==1)throw sourceError('Unvollständiges CityGML.');return root;
}
const walk=(n,tag)=>{const a=[];for(const c of n.children){if(c.tag===tag)a.push(c);a.push(...walk(c,tag));}return a;};
function owned(node,building){let p=node.parent;while(p&&p!==building){if(p.tag==='Building'||p.tag==='BuildingPart')return false;p=p.parent;}return p===building;}
export function parseCityGML(text,source,bounds){
 if(typeof text!=='string'||text.length>80000000||/<!DOCTYPE|<!ENTITY/i.test(text))throw sourceError('CityGML ist zu groß oder enthält Entitäten.');
 const crs=source.crs||text.match(/srsName=["']([^"']+)/)?.[1];crsCode(crs);
 const models=[],rejected=[];let objects=0;
 const members=text.matchAll(/<(?:[\w.-]+:)?cityObjectMember\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?cityObjectMember\s*>/g);
 for(const match of members){
  if(++objects>50000)throw sourceError('Zu viele Gebäude im Datenpaket.');
  if(!/<(?:[\w.-]+:)?Building\b/.test(match[0]))continue;
  const root=xmlTree(match[0]),all=[...walk(root,'Building'),...walk(root,'BuildingPart')],polygons=new Map(walk(root,'Polygon').filter(n=>n.a.id).map(n=>[n.a.id,n]));
  for(const b of all){const id=b.a.id;if(!id){rejected.push({id:'unknown',code:'OFFICIAL_ID',reason:'Amtliche Gebäude-ID fehlt.'});continue;}
   try{
    const surfaces=[],seen=new Set();
    for(const kind of ['RoofSurface','WallSurface','GroundSurface','ClosureSurface','OuterCeilingSurface','OuterFloorSurface'])for(const face of walk(b,kind).filter(n=>owned(n,b))){
     const lod=face.children.filter(n=>/^lod[23]MultiSurface$/.test(n.tag)).sort((a,b)=>b.tag.localeCompare(a.tag))[0];if(!lod)continue;
     const ps=walk(lod,'Polygon');for(const sm of walk(lod,'surfaceMember'))if(sm.a.href){const href=sm.a.href;if(!href.startsWith('#')||!polygons.has(href.slice(1)))throw sourceError('Nicht auflösbare CityGML-Flächenreferenz.');ps.push(polygons.get(href.slice(1)));}
     for(const poly of ps){if(seen.has(poly))continue;seen.add(poly);const rings=[];
      for(const boundary of [...poly.children.filter(n=>n.tag==='exterior'),...poly.children.filter(n=>n.tag==='interior')]){
       const lists=walk(boundary,'posList');let ring=[];
       if(lists.length===1){const p=lists[0];if(p.a.srsDimension&&p.a.srsDimension!=='3')throw sourceError('CityGML muss dreidimensional sein.');const v=p.text.trim().split(/\s+/).map(Number);if(v.length%3||!v.every(finite))throw sourceError('Ungültige CityGML-Koordinaten.');ring=Array.from({length:v.length/3},(_,i)=>v.slice(3*i,3*i+3));}
       else {ring=walk(boundary,'pos').map(p=>p.text.trim().split(/\s+/).map(Number));}
       if(!ring.length)throw sourceError('Leerer CityGML-Flächenring.');rings.push(ring);
      }surfaces.push({kind,rings});
     }
    }
    if(!surfaces.length&&walk(b,'BuildingPart').length)continue;
    // Skip far-away buildings BEFORE costly edge conformity/triangulation.
    if(bounds){const pts=surfaces.flatMap(s=>s.rings.flat()),ll=pts.map(p=>geographic(p,crsCode(crs)));if(ll.length){const bb=[Math.min(...ll.map(p=>p[0])),Math.min(...ll.map(p=>p[1])),Math.max(...ll.map(p=>p[0])),Math.max(...ll.map(p=>p[1]))];if(!overlap(bb,bounds))continue;}}
    let p=b.parent;while(p&&p.tag!=='Building')p=p.parent;
    models.push(solidFromSurfaces(id,surfaces,{...source,crs},{parentId:p?.a.id||id}));
   }catch(e){rejected.push({id,code:e.code||'OFFICIAL_GEOMETRY',reason:e.message});}
  }
 }
 if(!objects)throw sourceError('Keine CityGML-Gebäudeobjekte im Paket.');return {models,rejected};
}
/** Validate saved geometry again; project imports are not a trusted execution path. */
export function validateSolid(m){
 if(m?.schema!==SURFACE_SCHEMA||typeof m.id!=='string'||!Array.isArray(m.vertices)||m.vertices.length<4||m.vertices.length>18000||!Array.isArray(m.triangles)||m.triangles.length>40000||m.kinds?.length!==m.triangles.length||!m.source?.url||!m.source?.attribution||!m.source?.license)throw sourceError('Ungültiges gespeichertes amtliches Modell.');
 if(m.vertices.some(p=>!Array.isArray(p)||p.length!==3||!p.every(finite)||Math.abs(p[0])>180||Math.abs(p[1])>85||p[2]<-500||p[2]>10000)||m.triangles.some(t=>!Array.isArray(t)||t.length!==3||new Set(t).size!==3||t.some(i=>!Number.isInteger(i)||!m.vertices[i])))throw sourceError('Ungültige amtliche Modellkoordinaten.');
 if(!finite(m.ground)||!finite(m.height)||m.height<=0||m.height>1000||!Array.isArray(m.footprints)||!m.footprints.length||m.footprints.some(poly=>!Array.isArray(poly)||!poly.length||poly.some(r=>!Array.isArray(r)||r.length<3||r.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))))throw sourceError('Ungültiger amtlicher Gebäudeboden.');
 if(!Array.isArray(m.bbox)||m.bbox.length!==4||!m.bbox.every(finite)||m.bbox[0]>m.bbox[2]||m.bbox[1]>m.bbox[3]||m.vertices.some(p=>p[0]<m.bbox[0]-1e-8||p[0]>m.bbox[2]+1e-8||p[1]<m.bbox[1]-1e-8||p[1]>m.bbox[3]+1e-8))throw sourceError('Ungültige amtliche Ausdehnung.');
 if(!['direct-surfaces','classified-points-plane-fit-v1'].includes(m.source.method)||!['RoofSurface','WallSurface','GroundSurface'].every(k=>m.kinds.includes(k))||m.kinds.some(k=>!['RoofSurface','WallSurface','GroundSurface','ClosureSurface','OuterCeilingSurface','OuterFloorSurface'].includes(k)))throw sourceError('Ungültige Flächenherkunft oder Semantik.');
 if(m.footprints.flat(2).some(p=>p[0]<m.bbox[0]-1e-8||p[0]>m.bbox[2]+1e-8||p[1]<m.bbox[1]-1e-8||p[1]>m.bbox[3]+1e-8))throw sourceError('Gebäudeboden liegt außerhalb der Quellgeometrie.');
 for(const uses of usages(m.triangles).values())if(uses.length!==2||uses[0][1]!==uses[1][2])throw sourceError('Offene gespeicherte Gebäudeflächen.');return m;
}
