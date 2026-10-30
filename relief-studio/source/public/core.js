/* Relief Studio 2 — coordinate math, data normalization and printable geometry.
 * No third-party runtime dependencies. All dimensions in the model are millimetres.
 */
(function (root) {
'use strict';
const R = root.RS = root.RS || {};
const EARTH = 6378137, DEG = Math.PI / 180;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const finite = (v,d=0) => Number.isFinite(Number(v)) ? Number(v) : d;
const project = ([lon,lat]) => [EARTH*lon*DEG, EARTH*Math.log(Math.tan(Math.PI/4+clamp(lat,-85,85)*DEG/2))];
const unproject = ([x,y]) => [x/EARTH/DEG, (2*Math.atan(Math.exp(y/EARTH))-Math.PI/2)/DEG];
function boundsFor(lon,lat,wKm,hKm) {
 const c=project([lon,lat]), sec=1/Math.cos(lat*DEG);
 const sw=unproject([c[0]-wKm*500*sec,c[1]-hKm*500*sec]);
 const ne=unproject([c[0]+wKm*500*sec,c[1]+hKm*500*sec]);
 return [sw[0],sw[1],ne[0],ne[1]];
}
function boundsInfo(b) {
 const sw=project([b[0],b[1]]), ne=project([b[2],b[3]]), lat=unproject([(sw[0]+ne[0])/2,(sw[1]+ne[1])/2])[1];
 return {sw,ne,lon:(b[0]+b[2])/2,lat,w:(ne[0]-sw[0])*Math.cos(lat*DEG),h:(ne[1]-sw[1])*Math.cos(lat*DEG)};
}
function validateBounds(b,mode='model') {
 if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||b[0]<-180||b[2]>180||b[1]<-80||b[3]>80) throw Error('Ungültiger Kartenausschnitt.');
 const d=boundsInfo(b),poster=mode==='poster',maxSide=poster?24000:12000,maxArea=poster?240e6:80e6;
 if(d.w<100||d.h<100||d.w>maxSide||d.h>maxSide||d.w*d.h>maxArea)throw Error(poster?'Poster-Ausschnitt: maximal 24 km pro Seite und 240 km² Gesamtfläche. Für sehr große Städte zuerst die Karte verkleinern oder einen spezialisierten Kartendatenanbieter konfigurieren.':'3D-Ausschnitt: maximal 12 km pro Seite und 80 km². Für größere Städte den Poster-Modus nutzen oder einen kleineren Relief-Ausschnitt wählen.');
 return b;
}
function normalized(b,coords) {
 const d=boundsInfo(b);
 return coords.map(c=>{const p=project(c);return [(p[0]-d.sw[0])/(d.ne[0]-d.sw[0]),(d.ne[1]-p[1])/(d.ne[1]-d.sw[1])];});
}
function insideRing(x,y,ring) {
 let yes=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const a=ring[i],b=ring[j];
  if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))yes=!yes;
 }
 return yes;
}
function inside(x,y,rings) {return !!rings.length && insideRing(x,y,rings[0])&&!rings.slice(1).some(r=>insideRing(x,y,r));}
function ringBox(r) {let a=[Infinity,Infinity,-Infinity,-Infinity];for(const p of r){a[0]=Math.min(a[0],p[0]);a[1]=Math.min(a[1],p[1]);a[2]=Math.max(a[2],p[0]);a[3]=Math.max(a[3],p[1]);}return a;}
function centroid(r) {let x=0,y=0,n=r.length-(r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]?1:0);for(let i=0;i<n;i++){x+=r[i][0];y+=r[i][1];}return [x/Math.max(n,1),y/Math.max(n,1)];}
function parseHeight(t={}) {
 function metres(v) {if(v===undefined)return NaN;const s=String(v).replace(',','.');const n=parseFloat(s);return Number.isFinite(n)?n*(/ft|feet|'/.test(s)?0.3048:1):NaN;}
 const h=metres(t.height), levels=parseFloat(t['building:levels']);
 if(Number.isFinite(h)&&h>0)return {height:clamp(h,1,1000),heightSource:'OSM-Höhe'};
 if(Number.isFinite(levels)&&levels>0)return {height:clamp(levels*3+finite(t['roof:height'],1.5),3,1000),heightSource:'Geschosse × 3 m'};
 const tall=/tower|church|cathedral/.test(String(t.building)+' '+String(t.man_made));
 return {height:tall?20:9,heightSource:'Schätzwert'};
}
function regionEnglish(value){
 const region=String(value||'').trim();
 return ({'Galicien':'Galicia','Galiza':'Galicia','Baskenland':'Basque Country','Katalonien':'Catalonia','Andalusien':'Andalusia','Kastilien und León':'Castile and León','New York State':'New York'})[region]||region;
}
function subtitleForLocation(region,code,country){
 const cc=String(code||'').trim().toUpperCase(),state=(cc==='DE'?String(region||'').trim():regionEnglish(region)).toLocaleUpperCase(cc==='DE'?'de-DE':'en-US');
 let nation='';
 if(cc==='DE')nation='DEUTSCHLAND';
 else if(/^[A-Z]{2}$/.test(cc)){
  try{nation=new Intl.DisplayNames(['en'],{type:'region'}).of(cc).toUpperCase();}catch{nation='';}
 }
 if(!nation){const name=String(country||'').trim();nation=( {'Spanien':'Spain','Espana':'Spain','España':'Spain','Deutschland':'Deutschland','Germany':'Deutschland','Frankreich':'France','Italien':'Italy','Vereinigte Staaten':'United States','USA':'United States'}[name]||name).toLocaleUpperCase('en-US');}
 return [state,nation].filter(Boolean).join(' · ');
}
function landmarkPriority(t={}){
 if(/castle|fort|ruins|archaeological_site|monument|citywalls/.test(t.historic||''))return 100;
 if(t.historic)return 88;
 if(t.heritage||t.tourism==='museum')return 85;
 if(t.man_made==='lighthouse'||t.man_made==='tower')return 80;
 if(t.tourism==='attraction'||t.tourism==='artwork')return 70;
 if(t.amenity==='place_of_worship')return 65;
 return 45;
}
function landmarkCategory(t={}){
 if(t.historic||t.heritage)return 'historic';
 if(t.tourism==='museum')return 'museum';
 if(t.amenity==='place_of_worship')return 'worship';
 if(t.tourism==='artwork')return 'art';
 if(t.tourism==='viewpoint')return 'viewpoint';
 return 'other';
}
function roadClass(kind) {
 if(/^(motorway|trunk|primary)(_|$)/.test(kind))return 'major';
 if(/^(secondary|tertiary)(_|$)/.test(kind))return 'secondary';
 if(/^(footway|path|cycleway|steps|bridleway|track)$/.test(kind))return 'path';
 return 'local';
}
function joinSegments(segments) {
 const pending=segments.filter(s=>s.length>1).map(s=>s.slice()),rings=[];
 const eq=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-8;
 while(pending.length){let r=pending.pop(),changed=true;
  while(changed&&!eq(r[0],r.at(-1))){changed=false;for(let i=0;i<pending.length;i++){let s=pending[i];if(eq(r.at(-1),s[0]))r=r.concat(s.slice(1));else if(eq(r.at(-1),s.at(-1)))r=r.concat(s.slice(0,-1).reverse());else if(eq(r[0],s.at(-1)))r=s.concat(r.slice(1));else if(eq(r[0],s[0]))r=s.slice().reverse().concat(r.slice(1));else continue;pending.splice(i,1);changed=true;break;}}
  if(r.length>=4&&eq(r[0],r.at(-1)))rings.push(r);
 }
 return rings;
}
function polygonArea(ring){let area=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)area+=(ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1]);return area/2;}
function clipSegmentRect(a,b,minX=0,minY=0,maxX=1,maxY=1){let x0=a[0],y0=a[1],x1=b[0],y1=b[1],t0=0,t1=1,dx=x1-x0,dy=y1-y0;for(const [p,q] of [[-dx,x0-minX],[dx,maxX-x0],[-dy,y0-minY],[dy,maxY-y0]]){if(Math.abs(p)<1e-12){if(q<0)return null;continue;}const r=q/p;if(p<0){if(r>t1)return null;if(r>t0)t0=r;}else{if(r<t0)return null;if(r<t1)t1=r;}}return [[x0+t0*dx,y0+t0*dy],[x0+t1*dx,y0+t1*dy]];}
function clipPolylineToRect(points){const out=[],eq=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-8;let current=[];for(let i=0;i<points.length-1;i++){const seg=clipSegmentRect(points[i],points[i+1]);if(!seg){if(current.length>1){out.push(current);current=[];}continue;}let [s,e]=seg;if(!current.length)current=[s,e];else if(eq(current.at(-1),s)){if(!eq(current.at(-1),e))current.push(e);}else{if(current.length>1)out.push(current);current=[s,e];}}if(current.length>1)out.push(current);return out.map(path=>path.filter((p,i,a)=>!i||!eq(p,a[i-1]))).filter(path=>path.length>1);}
function boundaryPos(p){const e=1e-6,[x,y]=p;if(Math.abs(y)<=e)return clamp(x,0,1);if(Math.abs(x-1)<=e)return 1+clamp(y,0,1);if(Math.abs(y-1)<=e)return 2+clamp(1-x,0,1);if(Math.abs(x)<=e)return 3+clamp(1-y,0,1);return null;}
function boundaryPoint(t){let v=((t%4)+4)%4;if(v<=1)return [v,0];if(v<=2)return [1,v-1];if(v<=3)return [3-v,1];return [0,4-v];}
function boundaryRoute(a,b,dir='cw'){let pa=boundaryPos(a),pb=boundaryPos(b);if(pa===null||pb===null)return [a,b];if(dir==='cw'&&pb<pa)pb+=4;if(dir!=='cw'&&pb>pa)pb-=4;const step=dir==='cw'?1:-1,points=[a];for(let corner=Math[dir==='cw'?'ceil':'floor'](pa);dir==='cw'?corner<pb:corner>pb;corner+=step){const c=boundaryPoint(corner);const last=points.at(-1);if(Math.abs(last[0]-c[0])+Math.abs(last[1]-c[1])>1e-8)points.push(c);}const target=[...b];const last=points.at(-1);if(Math.abs(last[0]-target[0])+Math.abs(last[1]-target[1])>1e-8)points.push(target);return points;}
function coastlineMid(path){for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len>1e-6){const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,off=Math.min(.02,Math.max(.004,.02/len));return {point:[mx-dy/len*off,my+dx/len*off],segment:[a,b]};}}return {point:[0.5,0.5],segment:[path[0],path.at(-1)]};}
function stitchCoastlines(paths){
 const ready=[],pending=paths.filter(p=>p?.length>1).map(p=>p.slice()),eq=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-7;
 while(pending.length){let path=pending.pop(),modified=true;
  while(modified){modified=false;for(let i=0;i<pending.length;i++){
   const other=pending[i];if(eq(path.at(-1),other[0])){path=path.concat(other.slice(1));}
   else if(eq(other.at(-1),path[0])){path=other.concat(path.slice(1));}
   else continue;pending.splice(i,1);modified=true;break;
  }}ready.push(path);
 }
 return ready;
}
// Build shoreline faces from the full, *directed* coastline network. OSM specifies
// land on the LEFT, sea on the RIGHT. Closing every way independently against the
// bounding box causes overlaps that can flood towns when the selection changes.
function seaPolygonsFromCoastlines(coastlines,warnings=[]){
 const eps=1e-7,same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<eps;
 const square=[[0,0],[1,0],[1,1],[0,1],[0,0]],vertices=[],index=new Map(),edges=[],open=[],islands=[];
 const vertex=p=>{const point=[clamp(p[0],0,1),clamp(p[1],0,1)],key=point.map(v=>Math.round(v/eps)).join('/');if(!index.has(key)){index.set(key,vertices.length);vertices.push({p:point,out:[]});}return index.get(key);};
 function arc(points,coast=0){
  const from=vertex(points[0]),to=vertex(points.at(-1));if(from===to)return;
  const id=edges.length;
  edges.push({from,to,points,coast,twin:id+1,visited:false});
  edges.push({from:to,to:from,points:points.slice().reverse(),coast:-coast,twin:id,visited:false});
  vertices[from].out.push(id);vertices[to].out.push(id+1);
 }
 for(const raw of stitchCoastlines(coastlines)){
  const isClosed=raw.length>=4&&same(raw[0],raw.at(-1));
  if(isClosed){
   // The closed island can be clipped by the selection; only fully contained
   // rings are handled independently. Crossing rings are treated as open ways.
   const contained=raw.every(([x,y])=>x>=0&&x<=1&&y>=0&&y<=1);
   if(contained){islands.push(raw);continue;}
  }
  for(const path of clipPolylineToRect(raw)){
   if(path.length<2)continue;
   if(boundaryPos(path[0])===null||boundaryPos(path.at(-1))===null){warnings.push('Unvollständige Küstenlinie im Ausschnitt – unsichere Meeresfläche nicht gefüllt.');continue;}
   if(same(path[0],path.at(-1)))continue;
   open.push(path);
  }
 }
 if(open.length){
  // Boundary links are shared by ALL coastline segments, not constructed
  // separately for every way. The resulting faces are disjoint.
  const boundary=[...new Set(open.flatMap(path=>[vertex(path[0]),vertex(path.at(-1))]))];
  for(const corner of square.slice(0,4))boundary.push(vertex(corner));
  const sorted=[...new Set(boundary)].sort((a,b)=>boundaryPos(vertices[a].p)-boundaryPos(vertices[b].p));
  for(let i=0;i<sorted.length;i++){
   const s=vertices[sorted[i]].p,t=vertices[sorted[(i+1)%sorted.length]].p;
   const pts=boundaryRoute(s,t,'cw');arc(pts,0);
  }
  for(const path of open)arc(path,1);
 }
 if(!edges.length&&!islands.length)return [];
 // At each junction, the clockwise/anticlockwise angular order identifies
 // the next half-edge bordering the same face on its RIGHT side.
 const dir=id=>{const p=edges[id].points;for(let j=1;j<p.length;j++){let dx=p[j][0]-p[0][0],dy=p[j][1]-p[0][1];if(Math.abs(dx)+Math.abs(dy)>eps)return Math.atan2(dy,dx);}return 0;};
 for(const v of vertices)v.out.sort((a,b)=>dir(a)-dir(b));
 const faceRings=[];
 for(let start=0;start<edges.length;start++){
  if(edges[start].visited)continue;
  let eId=start,points=[],signs=[],closed=false;
  for(let guard=0;guard<edges.length+4;guard++){
   const e=edges[eId];if(e.visited)break;
   e.visited=true;points.push(...e.points.slice(0,-1));if(e.coast)signs.push(e.coast);
   const outs=vertices[e.to].out,idx=outs.indexOf(e.twin);
   if(idx<0)break;
   eId=outs[(idx-1+outs.length)%outs.length];
   if(eId===start){closed=true;break;}
  }
  if(!closed||points.length<3){warnings.push('Küstengeometrie ist nicht geschlossen – einzelne Meeresbereiche ausgelassen.');continue;}
  const signed=polygonArea(points);
  if(signed<=1e-10)continue; // the unbounded outside of the rectangle
  if(signs.some(s=>s===1)&&signs.some(s=>s===-1)){
   warnings.push('Widersprüchliche Küstenrichtung erkannt – unsichere Meeresfläche ausgelassen.');continue;
  }
  if(signs.some(s=>s===1))faceRings.push(points);
 }
 const waters=faceRings.map((ring,i)=>({id:'coastline/'+i,name:'Meer',tags:{natural:'coastline',derived:'sea'},rings:[ring]}));
 for(const ring of islands){
  if(Math.abs(polygonArea(ring))<1e-10)continue;
  if(polygonArea(ring)>0){waters.push({id:'coastline/inland-sea-'+waters.length,name:'Meer',tags:{natural:'coastline',derived:'sea'},rings:[ring]});continue;}
  let parent=waters.filter(w=>insideRing(ring[0][0],ring[0][1],w.rings[0])).sort((a,b)=>Math.abs(polygonArea(a.rings[0]))-Math.abs(polygonArea(b.rings[0])))[0];
  if(!parent){
   if(open.length){warnings.push('Küsteninsel ohne eindeutig zugeordnete Meeresfläche ausgelassen.');continue;}
   parent=waters.find(w=>w.id==='coastline/sea-around-island');
   if(!parent){parent={id:'coastline/sea-around-island',name:'Meer',tags:{natural:'coastline',derived:'sea'},rings:[square.slice()]};waters.push(parent);}
  }
  parent.rings.push(ring);
 }
 return waters;
}
function parseOSM(raw,bounds) {
 if(!raw||!Array.isArray(raw.elements))throw Error('Kartendienst hat keine gültigen OSM-Daten geliefert.');
 if(raw.remark)throw Error('Kartendienst: '+String(raw.remark).slice(0,180));
 const buildings=[],roads=[],water=[],parks=[],landmarks=[],warnings=[],coastlines=[];
 const els=raw.elements, used=new Set(), nodeMap=new Map(els.filter(e=>e.type==='node').map(e=>[e.id,[e.lon,e.lat]]));
 const coords=e=>(e.geometry?e.geometry.filter(p=>p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)).map(p=>[p.lon,p.lat]):(e.nodes||[]).map(id=>nodeMap.get(id)).filter(Boolean));
 function feature(e,rings,kind) {
  const t=e.tags||{}, n=rings.map(r=>normalized(bounds,r));
  if(!n.length||n[0].length<3)return;
  const name=String(t.name||t['name:de']||'').slice(0,120), id=e.type+'/'+e.id;
  const f={id,name,rings:n,tags:t};
  if(kind==='building')buildings.push({...f,...parseHeight(t),landmark:!!(t.historic||t.tourism||t.man_made==='tower'||/castle|church|tower|cathedral/.test(t.building||''))});
  if(kind==='water')water.push(f);
  if(kind==='park')parks.push(f);
 }
 function kind(t) {
  if((t.building&&t.building!=='no')||t['building:part']||t.man_made==='tower')return 'building';
  if(t.natural==='water'||t.water||t.waterway==='riverbank')return 'water';
  if(t.natural==='coastline')return 'coastline';
  if(t.landuse==='forest'||t.natural==='wood'||t.leisure==='park'||t.landuse==='grass')return 'park';
  return '';
 }
 for(const e of els.filter(e=>e.type==='relation')){
  const t=e.tags||{}, k=kind(t);if(!k)continue;
  const members=e.members||[],outers=joinSegments(members.filter(m=>m.type==='way'&&m.role!=='inner').map(coords)),inners=joinSegments(members.filter(m=>m.type==='way'&&m.role==='inner').map(coords));
  if(!outers.length){warnings.push('Unvollständige Relation '+e.id);continue;}
  for(const r of outers)feature(e,[r,...inners.filter(h=>insideRing(h[0][0],h[0][1],r))],k);
  for(const m of members)if(m.type==='way')used.add(m.ref);
 }
 for(const e of els){
  const t=e.tags||{};let c=e.type==='node'?[[e.lon,e.lat]]:coords(e);
  if(e.type==='way'){
   if(t.highway&&c.length>1)roads.push({id:'way/'+e.id,kind:roadClass(t.highway),highway:t.highway,name:String(t.name||'').slice(0,120),points:normalized(bounds,c)});
   if(t.waterway&&t.waterway!=='riverbank'&&c.length>1)roads.push({id:'water/'+e.id,kind:'river',points:normalized(bounds,c),highway:t.waterway,name:t.name||''});
   if(t.natural==='coastline'&&c.length>1)coastlines.push(normalized(bounds,c));
   if(!used.has(e.id)){const k=kind(t);if(k==='coastline'){}else if(k&&c.length>=4&&Math.abs(c[0][0]-c.at(-1)[0])+Math.abs(c[0][1]-c.at(-1)[1])<1e-7)feature(e,[c],k);}
  }
  const named=String(t.name||t['name:en']||t['name:de']||'').trim();
  const isPOI=!!(t.historic||t.heritage||['attraction','museum','artwork','gallery','viewpoint'].includes(t.tourism)||t.amenity==='place_of_worship'||['tower','lighthouse'].includes(t.man_made)||/castle|cathedral|church/.test(t.building||''));
  if(isPOI&&named){
   if(!c.length&&e.center&&Number.isFinite(e.center.lon)&&Number.isFinite(e.center.lat))c=[[e.center.lon,e.center.lat]];
   if(!c.length&&e.type==='relation')c=(e.members||[]).flatMap(m=>coords(m)).slice(0,20000);
   if(c.length){const xy=normalized(bounds,[centroid(c)])[0];
    if(xy[0]>=0&&xy[0]<=1&&xy[1]>=0&&xy[1]<=1)landmarks.push({id:e.type+'/'+e.id,name:named.slice(0,120),point:xy,category:landmarkCategory(t),priority:landmarkPriority(t),source:'OpenStreetMap'});
   }
  }
 }
 const cells=new Map(); for(const p of buildings.filter(b=>b.tags['building:part'])){const c=centroid(p.rings[0]),key=Math.floor(c[0]*100)+','+Math.floor(c[1]*100);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(c);}
 const kept=buildings.filter(b=>{if(b.tags['building:part'])return true;const bb=ringBox(b.rings[0]);if((bb[2]-bb[0])*(bb[3]-bb[1])>4)return true;for(let y=Math.floor(bb[1]*100);y<=Math.ceil(bb[3]*100);y++)for(let x=Math.floor(bb[0]*100);x<=Math.ceil(bb[2]*100);x++)if((cells.get(x+','+y)||[]).some(c=>inside(...c,b.rings)))return false;return true;});
 // Fail closed if a coastline geometry would flood a built-up part of town.
 // Natural=coastline explicitly separates land from sea, so flooding many
 // OSM building centres is a strong indication of broken/missing ways.
 let sea=seaPolygonsFromCoastlines(coastlines,warnings);
 if(sea.length&&kept.length>=12){
  const sample=kept.filter((_,i)=>i%Math.max(1,Math.floor(kept.length/240))===0).slice(0,240),
        flooded=sample.filter(b=>sea.some(w=>inside(...centroid(b.rings[0]),w.rings))).length;
  if(flooded>=Math.max(5,Math.ceil(sample.length*.12))){
   warnings.push('Küstenprüfung: Meeresfläche würde '+flooded+' von '+sample.length+' geprüften Gebäuden überdecken. Meer vorsichtshalber nicht gefüllt. Ausschnitt oder Datenquelle prüfen.');
   sea=[];
  }
 }
 water.push(...sea);
 const unique=new Set(),named=[];
 for(const lm of landmarks.sort((a,b)=>b.priority-a.priority)){
  const key=lm.name.toLocaleLowerCase('und')+'|'+Math.round(lm.point[0]*1000)+'|'+Math.round(lm.point[1]*1000);
  if(unique.has(key))continue;unique.add(key);named.push(lm);
  if(named.length>=450){warnings.push('Sehr viele Orte gefunden: Auf 450 beschränkt. Wähle einen kleineren Kartenausschnitt für weitere Details.');break;}
 }
 return {buildings:kept,roads,water,parks,landmarks:named,warnings};
}
function sampleTerrain(terrain,u,v) {
 const {cols,rows,values}=terrain;
 const x=clamp(u,0,1)*(cols-1), y=clamp(v,0,1)*(rows-1),a=Math.floor(x),b=Math.floor(y),c=Math.min(a+1,cols-1),d=Math.min(b+1,rows-1),tx=x-a,ty=y-b;
 return (values[b*cols+a]*(1-tx)+values[b*cols+c]*tx)*(1-ty)+(values[d*cols+a]*(1-tx)+values[d*cols+c]*tx)*ty;
}
const defaults={layout:'bottom',font:'serif',textAlign:'center',uppercase:true,boldTitle:false,tracking:0.025,subtitleScale:1,caption:'',captionScale:1,showCoordinates:true,coordinateStyle:'decimal',customCoordinates:'',divider:true,band:22,mapFit:'contain',mapBorder:false,mapScale:1,showAttribution:true,labelStyle:'plain',labelScale:1,labelMarkers:true,labelFont:'sans',labelColor:'#233737',markerColor:'#b57842',markerLimit:36,customColors:false,paperColor:'#faf8f2',landColor:'#f3f0e8',inkColor:'#233737',waterColor:'#ccd9dc',accentColor:'#b57842',majorColor:'#35494a',buildingColor:'#c6c4b9',title:'Weinheim',subtitle:'BADEN-WÜRTTEMBERG · DEUTSCHLAND',region:'Baden-Württemberg',countryCode:'DE',countryName:'Deutschland',autoSubtitle:true,lon:8.6808,lat:49.5480,widthKm:3.2,heightKm:3.0,modelWidth:200,base:3,terrainFactor:2,buildingFactor:1.5,landmarkFactor:1.8,landmarkWidth:1,frame:4,waterDepth:0.45,resolution:321,major:2.2,secondary:1.3,local:0.7,paths:0.32,roadRelief:0,style:'ivory',paper:'A4',paperW:210,paperH:297,orientation:'portrait',dpi:300,margin:12,headline:1,contours:true,hillshade:false,showBuildings:true,showLabels:true,format:'pdf',adaptive:true,mode:'model',landmarkOverrides:{}};
const paperSizes={'10 × 15 cm':[100,150],'13 × 18 cm':[130,180],'15 × 20 cm':[150,200],'20 × 30 cm':[200,300],'30 × 40 cm':[300,400],'30 × 45 cm':[300,450],'40 × 50 cm':[400,500],'40 × 60 cm':[400,600],'50 × 70 cm':[500,700],'50 × 75 cm':[500,750],'60 × 80 cm':[600,800],'60 × 90 cm':[600,900],'70 × 100 cm':[700,1000],A5:[148,210],A4:[210,297],A3:[297,420],A2:[420,594],A1:[594,841],A0:[841,1189],'20 × 20 cm':[200,200],'30 × 30 cm':[300,300],'40 × 40 cm':[400,400],'50 × 50 cm':[500,500],custom:[210,297]};
const palettes={ivory:{name:'Atelier',paper:'#faf8f2',land:'#f3f0e8',water:'#ccd9dc',park:'#e6e9dd',building:'#c6c4b9',major:'#35494a',secondary:'#6a7774',local:'#a4aaa2',path:'#c1c5ba',ink:'#233737',accent:'#b57842',contour:'#c8c8b5'},mono:{name:'Monochrom',paper:'#ffffff',land:'#ffffff',water:'#e5e7eb',park:'#f3f4f3',building:'#d8d8d8',major:'#171717',secondary:'#565656',local:'#969696',path:'#c8c8c8',ink:'#141414',accent:'#282828',contour:'#dddddd'},blue:{name:'Nordic',paper:'#f4f7f8',land:'#eef2f1',water:'#b8ccd6',park:'#dce6df',building:'#b4c4cd',major:'#214c65',secondary:'#668ba0',local:'#99b4c2',path:'#b9ccd3',ink:'#193d54',accent:'#b17c4e',contour:'#cbd7d8'},night:{name:'Midnight',paper:'#142c31',land:'#19363b',water:'#0d2025',park:'#29433f',building:'#3d5556',major:'#f2d7a6',secondary:'#b8bbaa',local:'#748c87',path:'#4b6867',ink:'#f6ead6',accent:'#e1ae6a',contour:'#355152'}};
function cleanSettings(input={}) {
 const s={...defaults};
 for(const k of Object.keys(defaults))if(Object.hasOwn(input,k))s[k]=input[k];
 const limits={lon:[-180,180],lat:[-80,80],widthKm:[0.1,24],heightKm:[0.1,24],modelWidth:[30,600],base:[1,15],terrainFactor:[0,8],buildingFactor:[0,6],landmarkFactor:[1,5],landmarkWidth:[1,3],frame:[0,20],waterDepth:[0,2],resolution:[65,641],major:[0,5],secondary:[0,4],local:[0,3],paths:[0,2],roadRelief:[0,1],paperW:[50,1600],paperH:[50,2000],dpi:[72,600],margin:[0,100],mapScale:[0.55,1],headline:[0.35,2],tracking:[0,0.3],subtitleScale:[0.5,2],captionScale:[0.5,2],band:[10,34],labelScale:[0.6,2],markerLimit:[0,100]};
 for(const [k,[a,b]] of Object.entries(limits))s[k]=clamp(finite(s[k],defaults[k]),a,b);
 s.resolution=Math.round(s.resolution);
 for(const k of ['contours','hillshade','showBuildings','showLabels','adaptive','uppercase','boldTitle','showCoordinates','divider','mapBorder','showAttribution','labelMarkers','customColors','autoSubtitle'])s[k]=!!s[k];
 for(const k of ['title','subtitle','caption','customCoordinates','region','countryCode','countryName'])s[k]=String(s[k]).slice(0,100).replace(/[\x00-\x1f]/g,'');
 for(const [key,choices] of Object.entries({mode:['poster','model'],layout:['bottom','top','map'],font:['serif','sans','mono'],labelFont:['serif','sans','mono'],textAlign:['left','center','right'],mapFit:['contain','cover'],labelStyle:['plain','halo'],coordinateStyle:['decimal','dms','custom']}))if(!choices.includes(s[key]))s[key]=defaults[key];
 for(const key of ['paperColor','landColor','inkColor','waterColor','accentColor','majorColor','buildingColor','labelColor','markerColor'])if(!/^#[0-9a-f]{6}$/i.test(s[key]))s[key]=defaults[key];
 if(!palettes[s.style])s.style='ivory';
 if(!['png','jpeg','pdf'].includes(s.format))s.format='pdf';
 if(!paperSizes[s.paper])s.paper='custom';
 if(!s.landmarkOverrides||typeof s.landmarkOverrides!=='object'||Array.isArray(s.landmarkOverrides))s.landmarkOverrides={};
 s.landmarkOverrides=Object.fromEntries(Object.entries(s.landmarkOverrides).slice(0,2000).map(([k,v])=>[k,{...(typeof v?.enabled==='boolean'?{enabled:v.enabled}:{}),...(typeof v?.label==='boolean'?{label:v.label}:{}),...(typeof v?.featured==='boolean'?{featured:v.featured}:{}),...(Number.isFinite(v?.height)?{height:clamp(v.height,1,1000)}:{}),...(Number.isFinite(v?.factor)?{factor:clamp(v.factor,1,5)}:{})}]));
 return s;
}
function validateProject(p) {
 if(!p||![2,3].includes(p.version)||!p.data||!p.settings)throw Error('Keine gültige Relief-Studio-Projektdatei (Version 2 oder 3). Bitte eine .relief.json-Datei öffnen, kein Bild oder PDF.');
 const d=p.data;validateBounds(d.bounds,p.settings.mode);
 if(!d.terrain||!Array.isArray(d.terrain.values)||d.terrain.values.length!==d.terrain.cols*d.terrain.rows||d.terrain.cols<2||d.terrain.rows<2||d.terrain.cols>1025||d.terrain.rows>1025||!d.terrain.values.every(x=>Number.isFinite(x)&&x>=-12000&&x<10000))throw Error('Ungültiges Höhenraster.');
 for(const k of ['buildings','roads','water','parks','landmarks'])if(!Array.isArray(d[k])||d[k].length>100000)throw Error('Ungültige Kartenobjekte.');
 let points=0;
 for(const f of [...d.buildings,...d.water,...d.parks]){
  if(!Array.isArray(f.rings)||!f.rings.length)throw Error('Ungültiger Gebäudegrundriss.');
  for(const ring of f.rings){if(!Array.isArray(ring)||ring.length<3)throw Error('Ungültiger Ring.');points+=ring.length;for(const p of ring)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p.some(v=>Math.abs(v)>100))throw Error('Ungültige Koordinaten.');}
 }
 for(const f of d.roads){if(!Array.isArray(f.points))throw Error('Ungültige Straße.');points+=f.points.length;for(const p of f.points)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error('Ungültige Straßenkoordinaten.');}
 if(points>2000000)throw Error('Projekt ist zu komplex.');
 for(const b of d.buildings)if(!Number.isFinite(b.height)||b.height<=0||b.height>1000)throw Error('Ungültige Gebäudehöhe.');
 for(const l of d.landmarks)if(!Array.isArray(l.point)||l.point.length!==2||!l.point.every(Number.isFinite))throw Error('Ungültige Wahrzeichen.');
 return {version:3,settings:cleanSettings(p.settings),data:d};
}
function simplify(points,tol=0.00005) {
 if(points.length<3)return points;
 const sq=tol*tol,keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;let max=sq,at=0;
 for(let i=a+1;i<b;i++){const v=points[i],t=den?clamp(((v[0]-p[0])*dx+(v[1]-p[1])*dy)/den,0,1):0,d=(v[0]-p[0]-t*dx)**2+(v[1]-p[1]-t*dy)**2;if(d>max){max=d;at=i;}}
 if(at){keep[at]=1;stack.push([a,at],[at,b]);}}
 return points.filter((_,i)=>keep[i]);
}
function contours(terrain,interval) {
 const out=[],n=terrain.cols,m=terrain.rows,v=terrain.values;let lo=Infinity,hi=-Infinity;for(const h of v){lo=Math.min(lo,h);hi=Math.max(hi,h);}
 interval=Math.max(interval,(hi-lo)/60);
 for(let z=Math.ceil(lo/interval)*interval;z<hi;z+=interval){for(let y=0;y<m-1;y++)for(let x=0;x<n-1;x++){
  const p=[[x/(n-1),y/(m-1)],[(x+1)/(n-1),y/(m-1)],[(x+1)/(n-1),(y+1)/(m-1)],[x/(n-1),(y+1)/(m-1)]], h=[v[y*n+x],v[y*n+x+1],v[(y+1)*n+x+1],v[(y+1)*n+x]],cross=[];
  for(let k=0;k<4;k++){const j=(k+1)%4;if((h[k]<z)!==(h[j]<z)){const t=(z-h[k])/(h[j]-h[k]);cross.push([p[k][0]+t*(p[j][0]-p[k][0]),p[k][1]+t*(p[j][1]-p[k][1])]);}}
  for(let k=0;k+1<cross.length;k+=2)out.push([cross[k],cross[k+1]]);
 }}return out;
}
function buildMesh(data,settings) {
 const s=cleanSettings(settings),d=boundsInfo(data.bounds),n=s.resolution,m=Math.max(33,Math.round((n-1)*d.h/d.w)+1),f=s.frame,w=s.modelWidth,h=w*d.h/d.w,W=w+f*2,H=h+f*2;
 if(n*m>450000)throw Error('Modell zu groß. Bitte Raster reduzieren oder weniger langes Format wählen.');
 const heights=new Float32Array(n*m),classes=new Uint8Array(n*m),buildingIds=new Int32Array(n*m).fill(-1),scale=w/d.w;
 let min=Infinity;for(const a of data.terrain.values)min=Math.min(min,a);
 const xof=c=>(c/(n-1)*W-f)/w,yof=r=>(r/(m-1)*H-f)/h;
 const terrainAt=(x,y)=>s.base+Math.max(0,sampleTerrain(data.terrain,x,y)-min)*scale*s.terrainFactor;
 for(let r=0;r<m;r++)for(let c=0;c<n;c++){
  const u=xof(c),v=yof(r),i=r*n+c,edge=u<0||u>1||v<0||v>1;
  heights[i]=edge?s.base+1.4:terrainAt(u,v);classes[i]=edge?4:0;
 }
 function raster(rings,cb){const b=ringBox(rings[0]),a=clamp(Math.floor((b[0]*w+f)/W*(n-1)),0,n-1),z=clamp(Math.ceil((b[2]*w+f)/W*(n-1)),0,n-1),top=clamp(Math.floor((b[1]*h+f)/H*(m-1)),0,m-1),bot=clamp(Math.ceil((b[3]*h+f)/H*(m-1)),0,m-1);let hits=0;
 for(let r=top;r<=bot;r++)for(let c=a;c<=z;c++){const u=xof(c),v=yof(r);if(u>=0&&u<=1&&v>=0&&v<=1&&inside(u,v,rings)){cb(r*n+c,u,v);hits++;}}return hits;}
 for(const p of data.water)raster(p.rings,i=>{heights[i]=Math.max(1,heights[i]-s.waterDepth);classes[i]=3;});
 for(const p of data.parks)raster(p.rings,i=>{if(classes[i]===0)classes[i]=5;});
 // Roads are rasterised with physical widths. Poster rendering remains vector-based.
 for(const road of data.roads){
  const widths={major:9*s.major,secondary:7*s.secondary,local:5*s.local,path:2*s.paths,river:15},width=(widths[road.kind]||0)/d.w;
  if(!width)continue;
  for(let k=0;k<road.points.length-1;k++){const a=road.points[k],b=road.points[k+1];if(Math.max(a[0],b[0])<0||Math.min(a[0],b[0])>1||Math.max(a[1],b[1])<0||Math.min(a[1],b[1])>1)continue;
   const dx=(b[0]-a[0])*w,dy=(b[1]-a[1])*h,len=Math.hypot(dx,dy),steps=Math.min(3000,Math.ceil(len/(W/(n-1)*0.6))+1),rr=Math.max(0.5,width*w/W*n/2);
   for(let k=0;k<=steps;k++){const t=k/steps,u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t,c=Math.round((u*w+f)/W*(n-1)),r=Math.round((v*h+f)/H*(m-1));
    for(let y=Math.floor(r-rr);y<=Math.ceil(r+rr);y++)for(let x=Math.floor(c-rr);x<=Math.ceil(c+rr);x++){if(x<0||x>=n||y<0||y>=m||(x-c)**2+(y-r)**2>(rr+0.2)**2)continue;const i=y*n+x;if(classes[i]===4)continue;if(road.kind==='river'){classes[i]=3;heights[i]=Math.max(1,terrainAt(xof(x),yof(y))-s.waterDepth);}else if(classes[i]!==3){classes[i]=road.kind==='major'?6:7;if(s.roadRelief>0)heights[i]=terrainAt(xof(x),yof(y))+s.roadRelief;}}
   }
  }
 }
 let missed=0,estimated=0;
 if(s.buildingFactor>0)for(let k=0;k<data.buildings.length;k++){
  const b=data.buildings[k],override=s.landmarkOverrides[b.id]||{},isLand=override.enabled===undefined?!!b.landmark:!!override.enabled,fac=isLand?clamp(finite(override.factor,s.landmarkFactor),1,5):1,expand=isLand?s.landmarkWidth:1,c=centroid(b.rings[0]);
  const rings=expand===1?b.rings:b.rings.map(r=>r.map(p=>[c[0]+(p[0]-c[0])*expand,c[1]+(p[1]-c[1])*expand]));
  let foot=terrainAt(c[0],c[1]);for(const p of b.rings[0])foot=Math.max(foot,terrainAt(p[0],p[1]));
  const roof=foot+(Number.isFinite(override.height)?clamp(override.height,1,1000):b.height)*scale*s.buildingFactor*fac;
  const hits=raster(rings,i=>{if(roof>heights[i]){heights[i]=roof;classes[i]=isLand?2:1;buildingIds[i]=k;}});if(!hits)missed++;if(b.heightSource!=='OSM-Höhe')estimated++;
 }
 const per=[];for(let r=0;r<m;r++)per.push(r*n);for(let c=1;c<n;c++)per.push((m-1)*n+c);for(let r=m-2;r>=0;r--)per.push(r*n+n-1);for(let c=n-2;c>0;c--)per.push(c);
 const count=n*m+per.length+1,vertices=new Float32Array(count*3),vertexClass=new Uint8Array(count);
 for(let r=0;r<m;r++)for(let c=0;c<n;c++){const i=r*n+c;vertices.set([c/(n-1)*W-W/2,H/2-r/(m-1)*H,heights[i]],i*3);vertexClass[i]=classes[i];}
 per.forEach((p,i)=>{vertices.set([vertices[p*3],vertices[p*3+1],0],(n*m+i)*3);vertexClass[n*m+i]=4;});const centre=count-1;vertices.set([0,0,0],centre*3);vertexClass[centre]=4;
 const tris=new Uint32Array(((n-1)*(m-1)*2+per.length*3)*3);let t=0;
 for(let r=0;r<m-1;r++)for(let c=0;c<n-1;c++){const a=r*n+c;tris.set([a,a+n,a+1,a+1,a+n,a+n+1],t);t+=6;}
 for(let i=0;i<per.length;i++){const j=(i+1)%per.length,a=per[i],b=per[j],A=n*m+i,B=n*m+j;tris.set([a,A,b,b,A,B,centre,B,A],t);t+=9;}
 let zmax=0;for(const z of heights)zmax=Math.max(zmax,z);
 return {vertices,indices:tris,classes:vertexClass,width:W,height:H,zmax,grid:[n,m],cell:Math.max(W/(n-1),H/(m-1)),missed,estimated,buildingCount:data.buildings.length};
}
function stl(mesh) {
 const n=mesh.indices.length/3,buf=new ArrayBuffer(84+n*50),v=new DataView(buf),verts=mesh.vertices,idx=mesh.indices;const header=new TextEncoder().encode('Relief Studio | mm | map data (c) OpenStreetMap contributors | ODbL');new Uint8Array(buf).set(header.slice(0,80));v.setUint32(80,n,true);let off=84;
 for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3,ux=verts[b]-verts[a],uy=verts[b+1]-verts[a+1],uz=verts[b+2]-verts[a+2],vx=verts[c]-verts[a],vy=verts[c+1]-verts[a+1],vz=verts[c+2]-verts[a+2],normal=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],l=Math.hypot(...normal)||1;for(const x of normal){v.setFloat32(off,x/l,true);off+=4;}for(const k of [a,b,c])for(let j=0;j<3;j++){v.setFloat32(off,verts[k+j],true);off+=4;}off+=2;}
 return buf;
}
function crc32(bytes) {let crc=-1;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;}
function zip(files) {
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 for(const [name,value] of Object.entries(files)){
  const nameBytes=enc.encode(name),data=typeof value==='string'?enc.encode(value):new Uint8Array(value),crc=crc32(data),local=new Uint8Array(30+nameBytes.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,nameBytes.length,true);local.set(nameBytes,30);
  const ce=new Uint8Array(46+nameBytes.length),d=new DataView(ce.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,nameBytes.length,true);d.setUint32(42,offset,true);ce.set(nameBytes,46);parts.push(local,data);central.push(ce);offset+=local.length+data.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
function model3mf(mesh,name='City') {
 const v=mesh.vertices,idx=mesh.indices,escape=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 const verts=[];for(let i=0;i<v.length;i+=3)verts.push(`<vertex x="${v[i].toFixed(4)}" y="${v[i+1].toFixed(4)}" z="${v[i+2].toFixed(4)}"/>`);
 const triangles=[];for(let i=0;i<idx.length;i+=3)triangles.push(`<triangle v1="${idx[i]}" v2="${idx[i+1]}" v3="${idx[i+2]}"/>`);
 const xml=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${escape(name)}</metadata><metadata name="Description">Map data © OpenStreetMap contributors, ODbL. Terrain: Mapzen / AWS Terrain Tiles. Simplified raster relief, no surveyed architectural model.</metadata><resources><object id="1" type="model"><mesh><vertices>${verts.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
 return zip({'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>','3D/3dmodel.model':xml});
}
Object.assign(R,{clamp,finite,project,unproject,boundsFor,boundsInfo,validateBounds,normalized,inside,insideRing,ringBox,centroid,parseHeight,roadClass,subtitleForLocation,landmarkPriority,landmarkCategory,parseOSM,seaPolygonsFromCoastlines,sampleTerrain,defaults,paperSizes,palettes,cleanSettings,validateProject,simplify,contours,buildMesh,stl,crc32,zip,model3mf});
if(typeof module!=='undefined')module.exports=R;
})(typeof self!=='undefined'?self:globalThis);