/* Relief Studio 18. Robust exact-footprint, 2.5D solid construction.
 * Terrain triangles and architectural roof planes are partitioned in XY.
 * Only the upper envelope is kept; vertical seams are stitched into one closed
 * surface, rather than rasterising buildings or exporting intersecting shells.
 * No architectural detail is invented where OSM supplies no roof/part geometry.
 */
(function(R){
'use strict';
const EPS=1e-8, Q=1e7;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Translate before the area sum: tiny valid roof intersections must not vanish
// through cancellation of large absolute coordinates.
const area=p=>p.length<3?0:p.slice(1,-1).reduce((s,b,i)=>s+cross(p[0],b,p[i+2]),0)/2;
const eq=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<EPS;
const evalZ=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2];
function tidy(poly){
 const a=[];for(const p of poly){if(p.every(Number.isFinite)&&(!a.length||!eq(a.at(-1),p)))a.push(p);}
 if(a.length>1&&eq(a[0],a.at(-1)))a.pop();
 if(a.length<3||Math.abs(area(a))<1e-18)return [];
 if(area(a)<0)a.reverse();return a;
}
// Intersect a convex polygon with ax+by+c >= 0.
function half(poly,line){
 // Classify and intersect against the SAME boundary. Using d >= -EPS with
 // intersections at d = 0 can extrapolate outside an edge when both distances
 // are negative; a microscopic roof edge can then duplicate whole terrain cells.
 const norm=Math.hypot(line[0],line[1]);
 if(!norm)return line[2]>=0?tidy(poly):[];
 const signed=p=>{const d=evalZ(line,p)/norm;return Math.abs(d)<=EPS?0:d;};
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=signed(a),db=signed(b),ia=da>=0,ib=db>=0;
  if(ia)out.push(a);
  if(ia!==ib){const t=R.clamp(da/(da-db),0,1);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
 }return tidy(out);
}
const negate=l=>l.map(v=>-v);
const bbox=p=>R.ringBox(p);
const intersects=(a,b)=>a[0]<b[2]+EPS&&a[2]>b[0]-EPS&&a[1]<b[3]+EPS&&a[3]>b[1]-EPS;
function lineFor(a,b){return [a[1]-b[1],b[0]-a[0],a[0]*b[1]-b[0]*a[1]];}
function splitBy(poly,cutter){
 let part=poly;const outside=[];
 for(let i=0;i<cutter.length&&part.length;i++){
  const l=lineFor(cutter[i],cutter[(i+1)%cutter.length]),o=half(part,negate(l));if(o.length)outside.push(o);part=half(part,l);
 }return {inside:part,outside};
}
// Even-odd sweep decomposition supports concave outlines AND courtyards without
// bridging across holes. All output pieces are convex trapezoids.
function decompose(rings){
 const ys=[...new Set(rings.flat().map(p=>p[1]))].sort((a,b)=>a-b),out=[];
 for(let j=0;j<ys.length-1;j++){
  const lo=ys[j],hi=ys[j+1];if(hi-lo<EPS)continue;const mid=(lo+hi)/2,edges=[];
  for(const ring of rings)for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   if((a[1]>mid)===(b[1]>mid))continue;
   const x=y=>a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]);edges.push({x,xm:x(mid)});
  }
  edges.sort((a,b)=>a.xm-b.xm);
  if(edges.length%2)throw Error('Ein Gebäudegrundriss ist nicht geschlossen.');
  for(let i=0;i<edges.length;i+=2){const l=edges[i],r=edges[i+1],p=tidy([[l.x(lo),lo],[r.x(lo),lo],[r.x(hi),hi],[l.x(hi),hi]]);if(p.length)out.push(p);}
 }return out;
}
function metres(v){
 if(v===undefined||v===null||v==='')return NaN;
 const str=String(v).trim().replace(',','.');
 if(!/^[+\-]?\d+(?:\.\d+)?\s*(m|metres?|meters?|ft|feet|')?$/i.test(str))return NaN;
 const n=parseFloat(str);return /ft|feet|'/.test(str)?n*.3048:n;
}
function roofSpec(b,scale){
 const t=b.tags||{},shape=String(t['roof:shape']||'flat').toLowerCase();
 const shapes=['flat','gabled','hipped','pyramidal','skillion','dome','cone','gambrel','mansard'];
 let total=metres(t.height),source=b.heightSource==='Manuell'?'Manuell':'OSM-Höhe',roof=metres(t['roof:height']);
 if(!(total>0)){total=Number(b.height);source=b.heightSource||'Schätzwert';}
 if(!(total>0))total=9;
 if(!(roof>=0)){
  const levels=Number(t['roof:levels']);roof=levels>0?levels*3:NaN;
 }
 const unsupported=!shapes.includes(shape);
 if(unsupported||shape==='flat')roof=0;
 return {shape:unsupported?'flat':shape,unsupported,roof,total:R.clamp(total,0.2,1000),source,estimatedRoof:!(roof>=0),minHeight:Math.max(0,metres(t.min_height)||0)};
}
function roofFrame(ring,t){
 let best={a:Infinity,x:[1,0],y:[0,1],minX:0,maxX:0,minY:0,maxY:0};
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<EPS)continue;
  const x=[(b[0]-a[0])/len,(b[1]-a[1])/len],y=[-x[1],x[0]],xs=ring.map(p=>p[0]*x[0]+p[1]*x[1]),ys=ring.map(p=>p[0]*y[0]+p[1]*y[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),area=(maxX-minX)*(maxY-minY);
  if(area<best.a-EPS)best={a:area,x,y,minX,maxX,minY,maxY};
 }
 let slope=(best.maxX-best.minX)<=(best.maxY-best.minY)?best.x:best.y;
 if(t['roof:orientation']==='across')slope=[-slope[1],slope[0]];
 const dirs={N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};
 const tag=t['roof:direction'],angle=tag===undefined?NaN:(dirs[String(tag).toUpperCase()]??Number(tag));
 if(Number.isFinite(angle)){const r=angle*Math.PI/180;slope=[Math.sin(r),Math.cos(r)];}
 const along=[-slope[1],slope[0]],u=ring.map(p=>p[0]*slope[0]+p[1]*slope[1]),v=ring.map(p=>p[0]*along[0]+p[1]*along[1]);
 return {u:slope,v:along,umin:Math.min(...u),umax:Math.max(...u),vmin:Math.min(...v),vmax:Math.max(...v)};
}
function planeFrom3(a,b,c){
 const det=cross(a,b,c);if(Math.abs(det)<1e-12)return [0,0,a[2]];
 const x=((b[2]-a[2])*(c[1]-a[1])-(c[2]-a[2])*(b[1]-a[1]))/det;
 const y=((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/det;
 return [x,y,a[2]-x*a[0]-y*a[1]];
}
function roofPieces(pieces,frame,spec,foot,scale){
 const {u,v,umin,umax,vmin,vmax}=frame,du=umax-umin,dv=vmax-vmin;
 if(du<EPS||dv<EPS)return [];
 let roof=spec.roof;
 if(!(roof>=0)){
  // A tagged roof shape without height is a documented estimate, never an
  // invented turret. Keep the supplied TOTAL building height fixed.
  roof=Math.min(spec.total*.30,Math.min(du,dv)/scale*.35);spec.estimatedRoof=true;
 }
 roof=R.clamp(roof,0,spec.total*.95);spec.roof=roof;
 const total=foot+spec.total*scale,z0=total-roof*scale,rh=roof*scale;
 const make=(poly,plane)=>({poly,plane});
 if(spec.shape==='flat'||rh<EPS)return pieces.map(p=>make(p,[0,0,total]));
 const linear=(dir,slope,off)=>[dir[0]*slope,dir[1]*slope,z0+off];
 if(spec.shape==='skillion')return pieces.map(p=>make(p,linear(u,-rh/du,rh+rh*umin/du)));
 // Concave roof surfaces can be represented as a lower envelope of planes.
 const planes=[linear(u,2*rh/du,-2*rh*umin/du),linear(u,-2*rh/du,2*rh*umax/du)];
 if(spec.shape==='hipped'||spec.shape==='pyramidal'){
  const run=spec.shape==='hipped'?Math.min(du,dv)/2:dv/2;
  planes.push(linear(v,rh/run,-rh*vmin/run),linear(v,-rh/run,rh*vmax/run));
 }
 if(spec.shape==='gambrel'||spec.shape==='mansard'){
  // Two roof pitches: continuous upper envelope profile in each half-span.
  planes.length=0;for(const [axis,lo,hi] of [[u,umin,umax],...(spec.shape==='mansard'?[[v,vmin,vmax]]:[])]){
   const span=(hi-lo)/2;for(const [slope,offset] of [[1.9,0],[.475,.525]]){
    const k=rh*slope/span;planes.push(linear(axis,k,rh*offset-k*lo),linear(axis,-k,rh*offset+k*hi));
   }
  }
 }
 if(['gabled','hipped','pyramidal','gambrel','mansard'].includes(spec.shape)){
  const out=[];
  for(const poly of pieces)for(let i=0;i<planes.length;i++){
   let p=poly;for(let j=0;j<planes.length&&p.length;j++)if(i!==j)p=half(p,planes[j].map((z,k)=>z-planes[i][k]));
   if(p.length)out.push(make(p,planes[i]));
  }return out;
 }
 // Explicit cone/dome tags: polygonal meridians, clipped to the actual footprint.
 // Do NOT treat generic towers/churches/castles as cones.
 const cu=(umin+umax)/2,cv=(vmin+vmax)/2,center=[u[0]*cu+v[0]*cv,u[1]*cu+v[1]*cv],sectors=24,rings=spec.shape==='dome'?6:1,out=[];
 const at=(r,a)=>[center[0]+u[0]*du/2*r*Math.cos(a)+v[0]*dv/2*r*Math.sin(a),center[1]+u[1]*du/2*r*Math.cos(a)+v[1]*dv/2*r*Math.sin(a),z0+rh*(spec.shape==='dome'?Math.sqrt(Math.max(0,1-r*r)):1-r)];
 // Radius sqrt(2) covers rectangular footprint corners; outside ellipse roof is flat.
 const patches=[];
 for(let k=0;k<sectors;k++){
  const a=k*Math.PI*2/sectors,b=(k+1)*Math.PI*2/sectors;
  for(let j=0;j<rings;j++){
   const r0=j/rings,r1=(j+1)/rings,A=at(r0,a),B=at(r1,a),C=at(r1,b),D=at(r0,b);
   patches.push([A,B,C]);if(j)patches.push([A,C,D]);
  }
 }
 // The sector triangles have disjoint interiors. Clipping a footprint against each
 // triangle independently avoids repeatedly subdividing fragments outside the dome.
 const outer=tidy(Array.from({length:sectors},(_,k)=>at(1,k*Math.PI*2/sectors).slice(0,2)));
 const tiles=patches.map(triangle=>{const poly=tidy(triangle.map(p=>p.slice(0,2)));return {poly,box:bbox(poly),plane:planeFrom3(...triangle)};}).filter(t=>t.poly.length);
 for(const poly of pieces){const bb=bbox(poly),border=splitBy(poly,outer);
  if(!border.inside.length){out.push(make(poly,[0,0,z0]));continue;}
  for(const p of border.outside)out.push(make(p,[0,0,z0]));
  for(const tile of tiles)if(intersects(bb,tile.box)){const hit=splitBy(poly,tile.poly).inside;if(hit.length)out.push(make(hit,tile.plane));}
 }return out;
}
// Normalized surface heights are clipped to the original footprint, never its box.
const bundledRoofs={"schema":"rs-roofs-1","source":"Datenquelle: LGL, www.lgl-bw.de · nDOM1 und LoD2, Kachel 32/475/5488 · dl-de/by-2-0 (https://www.govdata.de/dl-de/by-2-0). Dachraster aus Oberflächenhöhen abgeleitet und für den Druck resampelt.","entries":[{"id":"DEBW_001000rOXvD","bbox":[8.67070052,49.54605099,8.67141321,49.54639564],"anchor":[8.67108802,49.54622229],"cols":36,"rows":27,"unit":0.25,"samples":"QEBBQD45NTUzMzMoJyQkIyMpKCcqLCwsLS4xMDAvLy8vLzY3QEBBQD45NDU1MzMoJygkIyMpKCcqLSwsLCwxMTAwLy80Nzg4QEBBQT81NDU1NDMpJicmIiMoKScpLSwsLi8zMjE8Pz5AR0dKP0BBQTw2NDQ1NDMpJicqIiMoKScpLi0uMjc5NkNERkdJSkpKPkBBQTw3NTQ1NjQuJiYqJyYrLTA4MDM2P0NFRkdJSkxMTU1OPj9BQTo3NTQ0NjYsKCgsLCsuNDY4OUJERkdJSUpMTU9RUVFTOzxAPzk3NTU0NC4qKSotMTQ5P0JFRUdISUpMTU5PUFJTU1NTOTg6OjY0NTU0LystLjAyQEJDRUZHSElKTE1PUFBRU1RUVFRTNTU1NDMzNDQzMDI2Oz5CREVGR0hKS0xNT1BQUVJTU1RUVFNSNTIxMTMzMzY6Oz4/QUNFRkhJSktNTk9PUVJSUlNTU1JSUlJSMDAvLzIzNjo8PkBBQ0VGSEpLTE1OT09QUVJSUlJRUVBQT05NMC8vLzE3Ojw+QENERkdJSktMTU5PT09PT09PT09OTk1NTUxGLy8wMDA5PD0/QURFRkhJSkxMTU1NTU1NTE1NTExMS0tKREM9LzAzNDY5PD9BQ0RFR0hJSUpKSkpKSkpJSkpJSEhHODU2NDQzMzM1NTU3Oz9BQkNFRkZHR0dHR0dHSEdHRURCQjM0MzMyMzMyNTU1NTQ2OT0/QEBBQUJDQ0NEQ0RERDozMzEwMDAwMDAwMTExNTU1NTQ1Nzg7PT0+P0BAQEFBP0AzLi4vLi4uLi4uLi8vKiglNDQ0NDQ0NTQ2OjxiQzw7OC4uKioqKysrKysrLCwsKSkuGRUaNDQ0NDQ0NDQ2OFRTLyonJigoKCgoKSkpKSkoJycjISApGxcZNDQ0NTQ0NDQ1NkYoJSMjJCQlJSYmJiUgHx4eHh4gHx8fHxkZNDQ1NDQ0NDQ0HxYcISEgISIjIiIfHRsbGxscHR4fIB8gGxoZNDU0NDQ0NCkUFBUXHB4eHRsaGBgZGRsbGxwcHR4fHx8fIBYZNTQ0NDQ0HRQTExMTGhsZFxYWFhcZGRobGxscHR4eHx8fHxsWNDQ0NDQdExMTExMUFhgZGRgWFhcZGRobGxsbHB0eHx8fHxsWNDQ0KR0UFBQUFRUWFxgZGRkYFhcYGRkaGxsbGx0eHh8fHx8bNDQpFBQUFRUVFRYWFhcYGBkZGBcYGRkaGxsbGx0dHh8fHx8bNCgUFRUVFRUWFhYWFhcYGBgZGRcXGBkaGxsbGxwdHh4fHx8f"},{"id":"DEBW_001000rOXvQ","bbox":[8.67057772,49.54630957,8.67105542,49.54670735],"anchor":[8.67085267,49.54656289],"cols":25,"rows":31,"unit":0.25,"samples":"NTU1Njg4ODc3Nzk5OTs7Oz09Pj9BQkVFRTU1NTU2ODg4NzY3OTk5Ozs7PT5BQkRFRUM1NTU1NTY4ODg3Njc5OTk7OzxBQ0VGRUNBNTY1NTU1Njg4ODY2Njg5Ojs/RUlHRUNBQTU1NjU1NTU2ODg4NjY2Nzc9RUtPS0RDQUA1NTY2NjU1NTY4ODg2NTY5QUpPUU1GQT8+NzU1NjY2NTU1Njg4ODc1QUpOT05KREA9Pjg3NTU2NjY2NTU2ODk6PUZMTk1JRUA+Pj05ODc1NTY2ODY2NTY6PkZKTEtHQkA8PT09OTk4NzU1NjY4NjY1PUVJS0pHQj07Ozw8PTk5OTg3NTU2Nzg5PURISUlEPzs3ODo6PDw7OTk5ODc1NTY4PEFISUhGPzs3Njc4OTo6PTs5OTk4NzY1OUJHSUlFQDk1NjY2Nzg5Oj8/Ozs5OTg3OUBHSUlGQDs1NDU2NjY3ODk9Pz89Ozo6PEFHSUhGQTs2MzMzNDU2Njc5PT1BPz06PEFGSUlHQj03NDQzMzM0NDY2Nzg9PUFDQERHSUlHQz03NDU0MzMzMzQ0NTY0ODxAQkdJSUlIQj43MzQ0NDQzMzMzMzQ1NDQ4PURJSkpJRT46NTQzMzQ0NDMzMzMzNDM0NT5ESktJRT84NTQ0MzMzMzQ0MzMzMzMzMzg/RktKRkA6NDIzMzQzMzMzNDQzMzMzNDU4QEVKSUU+NzQzMjIzMzMzMzM0NDMzMzU2Nj5ESUpHQTo3NTQ0NDQzNDQ0MzM0MzM1NTY6QkdKSkY+ODI0NDQ1NDQ0NDQ0NDU1NTo7RT5FSUpIQzs2NjU1NDQ0NDQ0NTU1NTs8RUhNQEVKSkc/OjY0NDM0NDQ1NTU1NTVER0hUVERCR0pJRD01MzM0NTU1NTU1NTU1UFRUVE8+PEJISkdCOjU1NTU1NTU1NTU1NVRUTEtDODlARkhGQjw4Njc3Nzc3Nzc3NzdLS0JBODg4O0ZGQz89ODg3Nzc3Nzc3Nzc3QkFBODk4OTpBRkFAPTk4ODc3Nzc3Nzc3Nw=="},{"id":"DEBW_001000rOZH4","bbox":[8.67116976,49.55548021,8.67158034,49.55562352],"anchor":[8.671375,49.55555177],"cols":21,"rows":12,"unit":0.25,"samples":"Hx8fHx8gICAgICAgICAgICAgICAgHx8fHyAgICAgICAgICAgICAgICAgHx8fICAgICAgICAgICAgICAgICAgHx8gICAgICAgICAhISEhICAgICAgHx8gICEhISEhISEhISEhICAgICAgHx8gICEhISEhISEhISEhISEgICAgHx8gICEhISEhISEhISEhISEgICAgHx8gICAhISEhISEhISEhISEhICAgHx8gICAgICAgISEgISEhISEhICAgHx8fICAgICAgICAgICAgICAgICAgHx8fICAgICAgICAgICAgICAgICAgHx8fICAgICAgICAgICAgICAgICAg"},{"id":"DEBW_001000rOZIW","bbox":[8.67305085,49.55493561,8.6732284,49.5551314],"anchor":[8.67312935,49.5550771],"cols":10,"rows":16,"unit":0.25,"samples":"KCgqLS8vLSsqKicnKi0vLywpKSgnJyotLi0rKCgoJycqLS4tKigoKCcnKi0uLSooKCgoKCotLiwqKCgoKCgqLS4sKicnJygoKi0uLConJyYoKCstLiwpJyUkKCgrLS4sKSYkIygoKy0uLCkmIyMpKSotLiwpJiMjKSIUDQ0NFSckIxcNDQ0NDQ0NJCMNDQ0NDQ0NDQ0dDQ0NDQ0NDQ0NEw=="},{"id":"DEBW_001000rOZW6","bbox":[8.67299555,49.54636793,8.67334911,49.54650849],"anchor":[8.67317049,49.54643669],"cols":19,"rows":12,"unit":0.25,"samples":"MzIuKywsLC8vLzAxMjI0NTg4Ozo0MSwrLC0vLy8wMjIzNDU4OTtGREI1MDAwMTEyMjQzMzU4OTs7TU9RSTw9NzY2NTY1MzQ2ODs7PkhQVEo/Pz8+Pj08PTo5ODs+Pj49OTo9P0BBQkJDQ0RDREJBPT8/NDQ2Njg6PT5BQ0RFRkZHRkA/PzIxMC8wMTU2Oj5ERkVERUQ/Pz8xMTAuLy8vMjhARkdFQEBAPDg3MTAvLy4vLzU8QUZHRD06OjcyMjAwLy8uLzA2PEBHRkI9ODc1MTIwLy8vLy8wOkBARkRBPDc3NDIy"},{"id":"DEBW_001000rOZoG","bbox":[8.67597901,49.55330692,8.67652426,49.55365305],"anchor":[8.67626707,49.55347797],"cols":28,"rows":27,"unit":0.25,"samples":"GBgXFxgiMHqfnZyYlHlgYGZSOzs7Ozs7Ozs7OxgYFxcYIjE8gZ+cmJeQM19qOzs7Ozs7Ozs7OzoYGBcXFyA8PF6kpKGflZF7Ojs7Ozs7Ozs7Ozo6GRgYFxcYPDtSoaOqq6OadDo7Ozs7Ozs7PDo6OhoZGRgXJD87VZijrK2kmXI7PTw7PDs8PDo6OjoZGhoZKkpFQj+FmqWmno9KQ0NDQDw8Ozo6Ojk5GBkZGlNPS0dEQIaanpZ9QkdJR0RAPDo6OTk4OBYWKkhUVFNPSkdES5RpQUZMT05JQTw5ODg4NC4WH0FLT1RUVFFLSEI/QERKUVJPSkI9OTk4LicjITVDRUlOUlRVUk9KRkZLUFJRTUhCPTg0KygnIzM9PUBESUxSVFRTT0pKT1JST0lEPjkzLCknIyI7Ozs7PkNGS09TVFNRT1FST0pEQDo1LSkmJCIhNzY3Ozw/QkdKT1JUVFJRUUxHQT03MSwpJSMgITk4Mz5GR0NCRElOUVRUU1FNSURBOzcyLSgjICE7Oz5ETE5JQUFGSU9SU1RUUU1JRkA8Ni4nIyIhPD1ESE1PSEFCSExRUVBRVFRTUEtHQzs0JiMjIj1GRklKSERBRUxPUVBMTFBUVFRSTEU+OTQuKSlGRklHQz9ARUpQUVBMR0ZKT1JVVFBJQz86OTo6RklAPDw8QEhMUVFNSUNBRUpNU1RRTklDPDo6Ojs7Ozs7O0BHTFBPSUQ/Oz9ER0tMTk5LRD07Ozs6Ojo6Ojo+RklLSUVBPDY4PkFDRUpLSEM8Ozs7Ojo6Ojo6PEFERURBPTgyMjc4Oj5CQ0I+Ozs7Ojo6Ojo6Ojs8Pj89PDk0LC4vLzQ4PDw8OTo6Ojo6Ojo6Ojo6OTo7Ojk5LSgqKiciMDg4Ojo6Ojo6Ojo6Ojo6OTo6Ojo5NSknJiYjICY3ODo7Ojo6Ojo6Ojo6Ojo6Ojo6OTMnJiYkIB4fKDk4OTo6Ojo6Ojo6Ojo6Ojo6OjksJiYkISAfHx8wODk5Ojo6"},{"id":"DEBW_001000rOZou","bbox":[8.67532409,49.55322513,8.67573114,49.55351414],"anchor":[8.67549068,49.55336845],"cols":21,"rows":23,"unit":0.25,"samples":"KCgnJygnKCgnJycoKCgoKSkqKSoqKCgnJycoKSgnJygoKCkpKiopKioqKCgoJycnKiopKCgoKSkqKioqKiopKCgoKSgqLC0rKSgpKSoqKioqKikpKCgoKSotLi4sKikqKioqKioqKSkpKCgnKCstLy8uLSsrKioqKiopKSkpJCgnKCosLi8wLy0sKioqKikpKikpHiIlJygqLS8wMC8tKioqKSkqKSkpHBwfJSgpLC4wMDAvLCopKikqKSkpHRwcHyYpKiwvMTExLiwpKSopKSkpIB0cHSAoKisuMDExMC0rKiopKSkpIyMhHR0jKSssLjExMTAtKikpKSkpJSUkIB4fJisrLTAxMTEuLCkpKSkoJSUkIB4eJisrLC4wMTEwLispKSgoJSUkIB4eIissLC0uMDExLy0qKCgoJSUiIB4eJyssKywtLzAwMC4sKScoJSUhIB4eJycsLCwsLi8wMC4sKSgoJSUhIB4dIR0dHSMrLC4vLy4rKSgoJSUiIB0dHR0dHR4oLCwtLSwrKikoJSMiHRwcHBwcHBsgKisrKywrKiooJSMdHBwcHBwbGxodJSYoKSosKyopJR0cHBwcGxsbGxscIiUnKCkqKysqIhwcHBsbGxsbGxweICMlJykpKisq"},{"id":"DEBW_001000rOZxG","bbox":[8.66995667,49.55562934,8.67045077,49.55592423],"anchor":[8.67021222,49.55576479],"cols":25,"rows":23,"unit":0.25,"samples":"Hx8fHitERERDQ0REREQgIB8fHx4XFBISEh8fHx4eREREREREREQsICAfHx8eFxQSEhIfHx8eHipFRUVFRUU4ICAgHx8fHhcUEhISHx8fHh4fLkREREQ4ICAgIB8fHx4XFBISEh8fHx4eHyAfJSIpICAgICAfHx8eFxMSEhIhIB8fHyAhIB8gICAgICAgHx8fHhcTEhISIyMjIyMjIiIiIiIiIiIiISEhIiEcFhQUEyclJiYmJSUlJSUlJSUlJCQkJCUmJCQjHBMpKSkoKCgoKCgoKCgoJycnJycnJycmJB8UKCkoKCgoKCkpKSgpKSgoKCgoKCkpJyQhGygoJycnJycnKCgoKCgoKCgnJygoKScjICAmJSUlJSUlJSYmJSYmJSYmJSUlJiYlIyAgISEhISEiIiIiIiIiIiIjIiIjIyMjIyIcGyEgICAgIB8fHx8fHx8fIB8fIB8fHBwbFBUgIB8fIB8cGxsbHB0dHh4eHh4dGxUUEhITICAfHyAWFRQWFhYbHR4eHh4eHRsVFBISEyAfHx8RERERExMSEhoeHh4eHh0bFRQSEhMgHx8RERERERISEhISGh4eHh4dGxUUEhISHxsRERERERISEhEREREWHh4eHRsVFBISEhYRERERERESExIRERERERYeHh0bFRQSEhIRERERERESEhMSEhISEhISFh4dGxUUEhISERERERESEhITEhISEhISEhIaHRsVFBISEhERERISEhISExISEhISEhISEh0bFRQSEhI="},{"id":"DEBW_001000rP02g","bbox":[8.67272951,49.5460828,8.67299441,49.54626832],"anchor":[8.67285848,49.54615387],"cols":14,"rows":15,"unit":0.25,"samples":"MTExNDxEUVZXU0xIREIvLzAxPEVRV1hTTEhDQi8vLzI9RlJXV1JMSEJBLy8wMz5IVFhWUUtGQUAuLi40P0pVWFZRSkZBQS4uLjVDTldZVVBKR0RDLy8vOENhZmVVT0lGQ0MvLzA6RmJsbVZPSURCQi4uMTpLV2lqVU9IQ0JCLi4yN0xVWVlSTkdDQkIuLjI7UFZZWFFNR0NDQy8wND5PVllXUExHQ0NDLy82QlFWWVZPTEZDREMwMjtEUFZYVE9LRUREQzE1PENQVVhSTkpGRURE"},{"id":"DEBW_001000rP1HA","bbox":[8.67270527,49.54591291,8.67316594,49.54609243],"anchor":[8.67293207,49.54601093],"cols":24,"rows":15,"unit":0.25,"samples":"MjIzPEVMT05JR0RCNjAiMDg5PT0/P0BCLzExO0VNUE5JR0RCPCEjMjk6PT4/P0FCLi8xO0hOUE5IRkNBPxonODk7Pj4/QEJDLS0zPUhOUE1HRENAPkA+ODo8Pj4/QUJDLy81PUdLTUpFQkE9PD48ODo9Pj5AQkNDMDA2PUNHSkhDQT41MjQ2OTo9Pj4/Q0NDLjE1Oj1ARERBQDwvMDM3PkFDRERBQkNDLC0vMjY5PT8+PTktLzI4Q0ZISUpEQ0RDLC0vMTAzNzk6OjEtLzI6R0lLTE1LR0VELS0vMDEyNzc3NzAtLzNBSUxOT1BQT0tLLS0vMDEyNjc3NzAuMDlCSExPUVJRUE9MLS0uMDIyNjc3NzAvND5ERUlOUVJRUVBQLS0uMjIyNzc3NzA0NUNGRkdMT1BRUVFQLS0wMjI0Nzc3Ny81PERGR0lLTU9QUFFRLS0wMjI0Nzc3NC88REZHSElMTU5QUFBQ"},{"id":"DEBW_001000rP1OP","bbox":[8.65999502,49.54615959,8.66040907,49.54633686],"anchor":[8.66020205,49.54624823],"cols":21,"rows":15,"unit":0.25,"samples":"FBQUFBQUFBQUFBQUFBQUFRUVFRUVFhUUFBUVFBQUFBUUFBQUFRUVFRUVGBYWFhUVFBQUFRUUFBQVFRUVFRUVGBgXFxcWFRUVFRUVFBQVFRUVFRUVGBgYGBgXFxYWFhUVFRQVFRUVFRUVFxcXFxgYGBcXFxYWFRUVFRUVFRUVFRUWFxcXGBgXGBcXFxYWFhUVFRUVFBQVFRYWFxcXFxgYGBgYFxcWFhUWFBQUFBUVFhYWFhcYGBgYGBgXFxYWFBQUFBQUFBscIyMWFxgYGRkYGBcXFBQUFBQUICoyPD0xGxcXFxgYGRgYFBQUFBQcJi01Pj9AJxsWFhYXFxgYFBQUFBsdJTE6Pj86KBsVFRUVFhYXFBQUFBweMTI6Pz81HRgVFRUWFhYWFBQUFB0kMTI/Pz8zGBgVFRUWFhYW"},{"id":"DEBW_001000rP2bm","bbox":[8.67287856,49.5571702,8.67319073,49.55726481],"anchor":[8.67303177,49.55721573],"cols":17,"rows":9,"unit":0.25,"samples":"ExMSEhISExMSEREQEREVFhgTExISEhMTExISERARERQYGBMTExISExMTExMSEhISExkaExMUFBQUFBQUFBQTExMWGxsSExQVFhYWFRUVFRQUFRkcHBESFRcXFxcXFhcXFhYYGx0dEhMVFxgYGBcXGBgZGhscHR0TExUXGBgYFxgYGBocHR8eHhMTFRgYGBgXGBgYGxwdHx4e"},{"id":"DEBW_001000rPac4","bbox":[8.67154239,49.54467626,8.67166612,49.5447542],"anchor":[8.67160402,49.54471493],"cols":7,"rows":7,"unit":0.25,"samples":"UVFTVFZYWFFPVFVXWVpSU1laWVtcVFZbXl5bWlJSV11eWVpRUFNWWFtbUVFSVFZYWA=="},{"id":"DEBW_001000rPac7","bbox":[8.67084685,49.54610661,8.67094852,49.54617365],"anchor":[8.6708978,49.54613972],"cols":6,"rows":6,"unit":0.25,"samples":"np+in6Chn56gn6Ghn52upKGgoqOur56eoJycn56enZyboZ6e"},{"id":"DEBW_001000rPac9","bbox":[8.67327687,49.54464882,8.67335508,49.54469823],"anchor":[8.67331598,49.54467331],"cols":5,"rows":5,"unit":0.25,"samples":"LS4vLy8tLS8wMCssLi8vKyotLy8rKy0vLw=="},{"id":"DEBW_001000rPace","bbox":[8.67752522,49.54636085,8.67763652,49.5464379],"anchor":[8.67758102,49.54639924],"cols":7,"rows":7,"unit":0.25,"samples":"e3t8fX1+fnp7fH1+fn56ent9fn5senp5fH1JSnl5eXxuSz14d3h4RUtMd3d4aV1OPg=="},{"id":"DEBW_001000rPacg","bbox":[8.67114131,49.54687626,8.6712513,49.54694754],"anchor":[8.67119635,49.54691334],"cols":7,"rows":7,"unit":0.25,"samples":"W1laW1lYWVZaV2FXWVtbV21vXFxcWFpvcV9eXldXXWBeYGBXWFlcYGBhWFhaXF9gYA=="}]};
function checkRoofPack(p){
 const bad=()=>{throw Object.assign(Error('Ungültiges Dachhöhenpaket: Quelle, Grenzen oder Raster prüfen.'),{code:'ROOF_PACK_INVALID'});};
 if(!p||p.schema!=='rs-roofs-1'||typeof p.source!=='string'||!p.source.trim()||p.source.length>800||!Array.isArray(p.entries)||p.entries.length>512)bad();let total=0;
 for(const r of p.entries){const b=r?.bbox,n=r?.cols,m=r?.rows;if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||!(-180<=b[0]&&b[2]-b[0]>1e-6&&b[2]<=180&&-80<=b[1]&&b[3]-b[1]>1e-6&&b[3]<=80)||!Array.isArray(r.anchor)||r.anchor.length!==2||!r.anchor.every(Number.isFinite)||r.anchor[0]<b[0]||r.anchor[0]>b[2]||r.anchor[1]<b[1]||r.anchor[1]>b[3]||typeof r.id!=='string'||r.id.length>128||!Number.isInteger(n)||!Number.isInteger(m)||n<2||m<2||n>64||m>64||!Number.isFinite(r.unit)||r.unit<=0||r.unit>5||typeof r.samples!=='string'||r.samples.length!==4*Math.ceil(n*m/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(r.samples))bad();total+=n*m;if(total>240000||atob(r.samples).length!==n*m)bad();}return p;
}
function roofLookup(data){
 const records=[],info=R.boundsInfo(data.bounds);for(const pack of [data.roofPack,bundledRoofs]){if(!pack)continue;for(const r of pack.entries){const b=r.bbox,v=data.bounds;if(b[2]<v[0]||b[3]<v[1]||b[0]>v[2]||b[1]>v[3])continue;const [a,c,anchor]=R.normalized(v,[[b[0],b[3]],[b[2],b[1]],r.anchor]);records.push({r,source:pack.source,box:[...a,...c],anchor});}}
 return b=>{if(!records.length||b.tags?.['rs:wall']||b.tags?.['building:part']||b.partIds?.length||b.tags?.['roof:shape'])return null;const a=R.ringBox(b.rings[0]),area=(a[2]-a[0])*(a[3]-a[1]);let winner=null,best=.74;
 for(const item of records){const c=item.box,i=Math.max(0,Math.min(a[2],c[2])-Math.max(a[0],c[0]))*Math.max(0,Math.min(a[3],c[3])-Math.max(a[1],c[1])),u=area+(c[2]-c[0])*(c[3]-c[1])-i,score=i/u;if(score>best&&R.inside(...item.anchor,b.rings)&&Math.hypot((a[0]+a[2]-c[0]-c[2])*info.w/2,(a[1]+a[3]-c[1]-c[3])*info.h/2)<3.5){winner=item;best=score;}}
 return winner;};
}
function measuredRoof(polys,item,foot,scale,w,h,manual){
 const r=item.r,b=item.box,heights=Uint8Array.from(atob(r.samples),s=>s.charCodeAt(0)),nx=r.cols,ny=r.rows;
 const ox=(b[0]-.5)*w,oy=(.5-b[3])*h,dx=(b[2]-b[0])*w/(nx-1),dy=(b[3]-b[1])*h/(ny-1);
 const factor=Number.isFinite(manual)?manual/(Math.max(...heights)*r.unit||1):1;
 const z=(i,j)=>foot+Math.max(.1,heights[(ny-1-R.clamp(j,0,ny-1))*nx+R.clamp(i,0,nx-1)]*r.unit)*scale*factor;
 function bands(polys,dir,o,step,max){const out=[];for(const p of polys){const box=bbox(p),start=Math.max(0,Math.floor((box[dir]-o)/step)+1),end=Math.min(max,Math.ceil((box[dir+2]-o)/step)-1);let left=p;for(let n=start;n<=end&&left.length;n++){const l=dir===0?[1,0,-o-n*step]:[0,1,-o-n*step],lower=half(left,negate(l));if(lower.length)out.push(lower);left=half(left,l);}if(left.length)out.push(left);}return out;}
 const out=[];for(const p of bands(bands(polys,0,ox,dx,nx-1),1,oy,dy,ny-1)){const mid=R.centroid(p),i=Math.floor((mid[0]-ox)/dx),j=Math.floor((mid[1]-oy)/dy),x=ox+i*dx,y=oy+j*dy,A=[x,y,z(i,j)],B=[x+dx,y,z(i+1,j)],C=[x+dx,y+dy,z(i+1,j+1)],D=[x,y+dy,z(i,j+1)];
 const line=lineFor(A,C);for(const [side,plane] of [[half(p,line),planeFrom3(A,C,D)],[half(p,negate(line)),planeFrom3(A,B,C)]])if(side.length)out.push({poly:side,plane});
 }return out;
}

function architecturePatches(data,s,terrainAt,w,h,scale){
 const out=[],stats={buildings:0,roofTagged:0,roofEstimated:0,heightEstimated:0,unsupportedRoofs:0,walls:0,minHeightFilled:0,omitted:0,parts:0};
 const border=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
 const lookupRoof=roofLookup(data);stats.measuredRoofs=0;stats.roofSources=[];
 const parents=new Map(data.buildings.map(b=>[b.id,b]));
 for(let i=0;i<data.buildings.length;i++){
  const b=data.buildings[i],tag=b.tags||{},override=s.landmarkOverrides[b.id]||{};
  if(!b.rings?.length)continue;
  const points=b.rings.reduce((n,r)=>n+r.length,0);if(points>5000)throw Object.assign(Error(`Der Grundriss hat ${points} Punkte; zulässig sind 5.000.`),{code:'FOOTPRINT_LIMIT',diagnostics:{objectId:b.id,points,limit:5000}});
  const rings=b.rings.map(r=>{const p=r.map(p=>[(p[0]-.5)*w,(.5-p[1])*h]);if(p.length>1&&eq(p[0],p.at(-1)))p.pop();return p;});
  if(rings[0].length<3)continue;
  let pieces;try{pieces=decompose(rings);}catch(e){e.code='FOOTPRINT_INVALID';e.diagnostics={objectId:b.id,points};throw e;}
  let polys=pieces.map(p=>splitBy(p,border).inside).filter(p=>p.length);
  if(!polys.length)continue;
  // Building parts replace only their footprint, not the entire main nave.
  for(const id of b.partIds||[]){const part=parents.get(id);if(!part)continue;
   const cutters=decompose(part.rings.map(r=>r.map(p=>[(p[0]-.5)*w,(.5-p[1])*h])));
   for(const cutter of cutters){polys=polys.flatMap(p=>{if(!intersects(bbox(p),bbox(cutter)))return [p];const cut=splitBy(p,cutter);return cut.inside.length?cut.outside:[p];});}
  }
  if(!polys.length)continue;
  const all=polys.flat(),sample=all.map(p=>terrainAt(p[0]/w+.5,.5-p[1]/h)),foot=Math.max(...sample);
  const obj=Number.isFinite(override.height)?{...b,height:override.height,tags:{...tag,height:String(override.height)},heightSource:'Manuell'}:b;
  const spec=roofSpec(obj,scale),frame=roofFrame(rings[0],tag);
  const explicitAngle=Number(tag['roof:angle']);
  if(spec.estimatedRoof&&Number.isFinite(explicitAngle)&&explicitAngle>0&&explicitAngle<85){spec.roof=Math.tan(explicitAngle*Math.PI/180)*(frame.umax-frame.umin)/(2*scale);spec.estimatedRoof=false;}
  const measured=lookupRoof(b),parts=measured?measuredRoof(polys,measured,foot,scale,w,h,Number.isFinite(override.height)?override.height:metres(tag.height)):roofPieces(polys,frame,spec,foot,scale);
  if(measured){stats.measuredRoofs++;if(!stats.roofSources.includes(measured.source))stats.roofSources.push(measured.source);}
  const isLand=override.enabled===undefined?!!b.landmark:!!override.enabled;
  for(const p of parts)out.push({...p,box:bbox(p.poly),kind:isLand?2:1,building:i});
  stats.buildings++;stats.parts+=tag['building:part']&&tag['building:part']!=='no'?1:0;
  stats.walls+=tag['rs:wall']==='yes'?1:0;
  if(!measured&&spec.source!=='OSM-Höhe')stats.heightEstimated++;
  if(spec.shape!=='flat')stats.roofTagged++;
  if(spec.estimatedRoof&&spec.shape!=='flat')stats.roofEstimated++;
  if(spec.unsupported)stats.unsupportedRoofs++;
  if(spec.minHeight>0)stats.minHeightFilled++;
 }
 return {patches:out,stats};
}
// Return nonoverlapping convex top faces after laying one roof patch over them.
function overlay(faces,patch){
 const out=[];
 for(const f of faces){
  if(!intersects(f.box||bbox(f.poly),patch.box)){out.push(f);continue;}
  const hit=splitBy(f.poly,patch.poly);
  if(!hit.inside.length){out.push(f);continue;}
  for(const p of hit.outside)out.push({...f,poly:p,box:bbox(p)});
  if(patch.force){out.push({...patch,poly:hit.inside,box:bbox(hit.inside)});continue;}
  const delta=patch.plane.map((v,i)=>v-f.plane[i]);
  const ds=hit.inside.map(p=>evalZ(delta,p));
  if(ds.every(v=>v>=-EPS))out.push({...patch,poly:hit.inside,box:bbox(hit.inside)});
  else if(ds.every(v=>v<=EPS))out.push({...f,poly:hit.inside,box:bbox(hit.inside)});
  else{
   const high=half(hit.inside,delta),low=half(hit.inside,negate(delta));
   if(high.length)out.push({...patch,poly:high,box:bbox(high)});
   if(low.length)out.push({...f,poly:low,box:bbox(low)});
  }
 }return out;
}
// Coordinate welding may turn a convex boundary into A-B-A spikes. Remove
// these zero-area walks before they can generate a pair of opposite triangles.
function cleanCycle(input){
 let ids=input.filter((id,i)=>!i||id!==input[i-1]);
 if(ids.length>1&&ids[0]===ids.at(-1))ids.pop();
 let changed=true;
 while(changed&&ids.length>=3){changed=false;for(let j=0;j<ids.length;j++){
  if(ids[(j+ids.length-1)%ids.length]===ids[(j+1)%ids.length]){
   ids.splice(j,1);ids=ids.filter((id,k)=>!k||id!==ids[k-1]);
   if(ids.length>1&&ids[0]===ids.at(-1))ids.pop();changed=true;break;
  }
 }}
 return ids;
}
// Resolve only sub-print-resolution contact neighbourhoods. The surrounding
// footprint and roof planes are untouched; every retry still must pass the
// oriented-edge/watertightness check below. Never omit an entire building.
function contactPatch(a,b,plane,kind,W,H,attempt=0){
 const r=.002*Math.pow(1.6,attempt),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 const u=length>EPS?[dx/length,dy/length]:[1,0],v=[-u[1],u[0]];
 const corners=[[a[0]-r*u[0]-r*v[0],a[1]-r*u[1]-r*v[1]],
  [b[0]+r*u[0]-r*v[0],b[1]+r*u[1]-r*v[1]],
  [b[0]+r*u[0]+r*v[0],b[1]+r*u[1]+r*v[1]],
  [a[0]-r*u[0]+r*v[0],a[1]-r*u[1]+r*v[1]]];
 const poly=splitBy(tidy(corners),[[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]]).inside;
 if(!poly.length)return null;
 return {poly,box:bbox(poly),plane:[plane[0],plane[1],plane[2]+.0001],kind,building:-1,force:true,precisionRepair:true};
}
function seamError(contacts){
 const e=Error('Gebäudekontakte konnten noch nicht vollständig verbunden werden.');
 e.contacts=contacts;return e;
}
// Conforming edge subdivision prevents T-junctions at roof ridges, building
// intersections, courtyards and terrain cells. The XY graph is shared by all roofs.
function stitchSurface(faces,W,H,stats){
 const groups=new Map(),segments=[];
 const lineKey=(a,b)=>{
  let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<EPS)return null;
  dx/=len;dy/=len;if(dx<-EPS||(Math.abs(dx)<EPS&&dy<0)){dx=-dx;dy=-dy;}
  const c=-dy*a[0]+dx*a[1],scale=1e6,k=[Math.round(dx*scale),Math.round(dy*scale),Math.round(c*scale)];
  let key=k.join(',');if(groups.has(key))return groups.get(key);
  // Near a rounding boundary, numerical clipping can land in a neighboring bin.
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   const v=groups.get([k[0]+x,k[1]+y,k[2]+z].join(','));if(v&&Math.abs(v.dx-dx)<1e-7&&Math.abs(v.dy-dy)<1e-7&&Math.abs(v.c-c)<1e-6)return v;
  }
  const group={dx,dy,c,values:[]};groups.set(key,group);return group;
 };
 for(let i=0;i<faces.length;i++){
  const f=faces[i];f.edgeSegments=[];
  for(let j=0;j<f.poly.length;j++){
   const a=f.poly[j],b=f.poly[(j+1)%f.poly.length],group=lineKey(a,b);if(!group)continue;
   const from=a[0]*group.dx+a[1]*group.dy,to=b[0]*group.dx+b[1]*group.dy;
   group.values.push(from,to);const e={f:i,a,b,group,from,to};segments.push(e);f.edgeSegments.push(e);
  }
 }
 for(const group of groups.values()){group.values.sort((a,b)=>a-b);group.values=group.values.filter((v,i,a)=>!i||v-a[i-1]>EPS*8);}
 const xy=[],xyIndex=new Map(),xyZ=[],edges=new Map();
 function vertex2(p){const ix=Math.round(p[0]*Q),iy=Math.round(p[1]*Q),key=ix+','+iy;let i=xyIndex.get(key);if(i!==undefined)return i;
  // A value lying on a quantisation boundary may round differently after
  // clipping from opposite sides. The acceptance radius is 2/Q, so the search
  // MUST include two bins on each side (rounding can put valid matches two
  // bins apart). A one-bin search leaves cracks that height repair cannot fix.
  for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){const n=xyIndex.get((ix+x)+','+(iy+y));if(n!==undefined&&Math.abs(xy[n][0]-p[0])+Math.abs(xy[n][1]-p[1])<2/Q)return n;}
  i=xy.length;xyIndex.set(key,i);xy.push(p);xyZ.push([]);return i;
 }
 function lower(a,x){let lo=0,hi=a.length;while(lo<hi){const mid=(lo+hi)>>1;if(a[mid]<x-EPS*8)lo=mid+1;else hi=mid;}return lo;}
 for(const e of segments){
  const vals=e.group.values,min=Math.min(e.from,e.to),max=Math.max(e.from,e.to),list=[];
  for(let j=lower(vals,min);j<vals.length&&vals[j]<=max+EPS*8;j++){
   const t=R.clamp((vals[j]-e.from)/(e.to-e.from),0,1);list.push(vertex2([e.a[0]+t*(e.b[0]-e.a[0]),e.a[1]+t*(e.b[1]-e.a[1])]));
  }
  if(e.to<e.from)list.reverse();e.ids=list.filter((v,i,a)=>!i||v!==a[i-1]);
 }
 // Welding can collapse a sub-micron polygon into a backtracking edge. Such a
 // face has no area and must not contribute two extra uses of the same seam.
 for(let i=0;i<faces.length;i++){
  const f=faces[i],ids=cleanCycle(f.edgeSegments.flatMap(e=>e.ids.slice(0,-1)));
  f.boundaryIds=ids;
  if(ids.length<3||Math.abs(area(ids.map(id=>xy[id])))<1e-18){f.boundaryIds=[];continue;}
  for(let j=0;j<ids.length;j++){
   const a=ids[j],b=ids[(j+1)%ids.length],key=a<b?a+','+b:b+','+a;
   if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,f:i});
   xyZ[a].push(evalZ(f.plane,xy[a]));
  }
 }

  // Repair only split endpoints reported by the planar seam graph, not every
  // building. A microscopic A-B-C crack is an XY topology defect: adding a
  // higher roof patch cannot remove it. Keep a deterministic representative.
  const aliases=new Map(),root=id=>{while(aliases.has(id))id=aliases.get(id);return id;};
  let seamWelds=0,maxSeamShift=0;const members=new Map();
  const atBorder=(a,b)=>[[0,-W/2],[0,W/2],[1,-H/2],[1,H/2]].some(([k,s])=>Math.abs(a[k]-s)<1e-5&&Math.abs(b[k]-s)<1e-5);
  for(let pass=0;pass<3;pass++){
   const points=new Set();
   for(const list of edges.values())if(list.length!==2&&!((list.length===1)&&atBorder(xy[list[0].a],xy[list[0].b])))
    for(const e of list){points.add(e.a);points.add(e.b);}
   const tolerance=1e-5,near=new Map();let changed=0;
   for(const id of points){
    const a=xy[id],ix=Math.floor(a[0]/tolerance),iy=Math.floor(a[1]/tolerance);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of near.get((ix+dx)+','+(iy+dy))||[]){
     const u=root(id),v=root(other);if(u===v)continue;
     const distance=Math.hypot(xy[u][0]-xy[v][0],xy[u][1]-xy[v][1]);
     if(distance<=tolerance){
      const keep=Math.min(u,v),drop=Math.max(u,v),ids=[...(members.get(keep)||[keep]),...(members.get(drop)||[drop])];
      const shift=Math.max(...ids.map(i=>Math.hypot(xy[i][0]-xy[keep][0],xy[i][1]-xy[keep][1])));
      if(shift>tolerance)continue;
      aliases.set(drop,keep);members.set(keep,ids);members.delete(drop);changed++;maxSeamShift=Math.max(maxSeamShift,shift);
     }
    }
    const key=ix+','+iy;if(!near.has(key))near.set(key,[]);near.get(key).push(id);
   }
   if(!changed)break;seamWelds+=changed;edges.clear();for(const zs of xyZ)zs.length=0;
   for(let i=0;i<faces.length;i++){
    const f=faces[i],ids=cleanCycle(f.edgeSegments.flatMap(e=>e.ids.slice(0,-1)).map(root));f.boundaryIds=ids;
    if(ids.length<3||Math.abs(area(ids.map(id=>xy[id])))<1e-18){f.boundaryIds=[];continue;}
    for(let j=0;j<ids.length;j++){const a=ids[j],b=ids[(j+1)%ids.length],key=a<b?a+','+b:b+','+a;
     if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,f:i});xyZ[a].push(evalZ(f.plane,xy[a]));
    }
   }
  }
  stats.xySeamWelds=seamWelds;stats.maxXYSeamShift=maxSeamShift;

 // A long edge and a reversed chain of shorter collinear edges are the SAME
 // planar boundary even when their line-group keys rounded differently. Reuse
 // existing vertices only; require the entire opposite chain to exist first.
 const ek=(a,b)=>a<b?a+','+b:b+','+a;
 const singles=[...edges.values()].filter(es=>es.length===1&&!atBorder(xy[es[0].a],xy[es[0].b])).map(es=>es[0]);
 stats.chainSplits=0;
 if(singles.length<=2048){
  const ids=[...new Set(singles.flatMap(e=>[e.a,e.b]))];
  for(const e of singles){const key=ek(e.a,e.b);if(edges.get(key)?.length!==1)continue;
   const a=xy[e.a],b=xy[e.b],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-18)continue;
   const pts=[];for(const id of ids){if(id===e.a||id===e.b)continue;const p=xy[id],x=p[0]-a[0],y=p[1]-a[1],t=(x*dx+y*dy)/l2;
    if(t>0&&t<1&&Math.abs(dx*y-dy*x)<=1e-7*Math.sqrt(l2))pts.push([t,id]);}
   if(!pts.length)continue;pts.sort((a,b)=>a[0]-b[0]);const path=[e.a,...pts.map(p=>p[1]),e.b];
   if(!path.slice(1).every((v,i)=>{const use=edges.get(ek(path[i],v));return use?.length===1&&use[0].a===v&&use[0].b===path[i]&&use[0].f!==e.f;}))continue;
   const f=faces[e.f],idx=f.boundaryIds.findIndex((v,i,ar)=>v===e.a&&ar[(i+1)%ar.length]===e.b);if(idx<0)continue;
   f.boundaryIds.splice(idx+1,0,...path.slice(1,-1));edges.delete(key);
   for(const id of path.slice(1,-1))xyZ[id].push(evalZ(f.plane,xy[id]));
   for(let i=1;i<path.length;i++)edges.get(ek(path[i-1],path[i])).push({a:path[i-1],b:path[i],f:e.f});stats.chainSplits++;
  }
 }
 const landFaces=[];let isLand=false;
 const positions=[],classes=[],indices=[],vertexMap=new Map(),heightIndex=new Map();
 function v3(id,z,kind){
  const p=xy[id],v=[Math.fround(p[0]),Math.fround(p[1]),Math.fround(z)],key=v.join(',');let i=vertexMap.get(key);
  // Equivalent plane evaluations may straddle a Float32 rounding boundary.
  // Weld only coincident XY points and heights within 0.00001 mm, including
  // neighbouring height bins. This is far below printable dimensional detail.
  const zbin=Math.round(z*100000),xykey=v[0]+','+v[1]+',';
  if(i===undefined)for(let dz=-1;dz<=1;dz++){const candidate=heightIndex.get(xykey+(zbin+dz));if(candidate!==undefined&&Math.abs(positions[candidate*3+2]-z)<.00001){i=candidate;break;}}
  if(i===undefined){i=positions.length/3;positions.push(...v);classes.push(kind);heightIndex.set(xykey+zbin,i);}else if(kind===1||kind===2)classes[i]=kind;
  vertexMap.set(key,i);return i;
 }
 function tri(a,b,c){if(a===b||b===c||c===a)return;if(isLand)landFaces.push(indices.length/3);indices.push(a,b,c);}
 // Centroid fans preserve every boundary split, including collinear vertices.
 for(const f of faces){
  isLand=f.kind===0||f.kind===5;const ids=f.boundaryIds;if(ids.length<3)continue;
  const ring=cleanCycle(ids.map(id=>v3(id,evalZ(f.plane,xy[id]),f.kind)));
  if(ring.length<3)continue;
  if(ring.length===3){tri(...ring);continue;}
  const center=ids.reduce((p,id)=>[p[0]+xy[id][0]/ids.length,p[1]+xy[id][1]/ids.length],[0,0]),ci=vertex2(center),cz=evalZ(f.plane,center),mid=v3(ci,cz,f.kind);
  for(let j=0;j<ring.length;j++)tri(mid,ring[j],ring[(j+1)%ring.length]);
 }
 isLand=false;
 const boundary=[],contacts=[];
 for(const list of edges.values()){
  if(list.length>2){
   const first=list[0],a=xy[first.a],b=xy[first.b],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   const upper=list.map(e=>faces[e.f]).sort((f,g)=>evalZ(g.plane,mid)-evalZ(f.plane,mid))[0];
   contacts.push({a,b,plane:upper.plane,kind:upper.kind});continue;
  }
  const e=list[0];
  if(list.length===1){
   const a=xy[e.a],b=xy[e.b],onEdge=(p,k,s)=>Math.abs(p[k]-s)<1e-5;
   if(![[0,-W/2],[0,W/2],[1,-H/2],[1,H/2]].some(([k,s])=>onEdge(a,k,s)&&onEdge(b,k,s))){contacts.push({a,b,plane:faces[e.f].plane,kind:faces[e.f].kind});continue;}
   xyZ[e.a].push(0);xyZ[e.b].push(0);boundary.push(e);
  }
 }
 if(contacts.length)throw seamError(contacts);
 // All heights meeting at each XY junction must also split vertical wall edges.
 for(let i=0;i<xyZ.length;i++){xyZ[i].sort((a,b)=>a-b);xyZ[i]=xyZ[i].filter((z,j,a)=>!j||z-a[j-1]>1e-7);}
 function wall(e,pA,pB,kind){
  const za=evalZ(pA,xy[e.a]),zb=evalZ(pA,xy[e.b]),wa=evalZ(pB,xy[e.a]),wb=evalZ(pB,xy[e.b]);
  if(Math.abs(za-wa)+Math.abs(zb-wb)<1e-7)return;
  let ids=[v3(e.a,za,kind),v3(e.b,zb,kind)];
  const byB=xyZ[e.b].filter(z=>z<zb-1e-7&&z>wb+1e-7).reverse();for(const z of byB)ids.push(v3(e.b,z,kind));ids.push(v3(e.b,wb,kind),v3(e.a,wa,kind));
  for(const z of xyZ[e.a].filter(z=>z>wa+1e-7&&z<za-1e-7))ids.push(v3(e.a,z,kind));
  // For a CCW top boundary, outward wall orientation goes down first.
  // Endpoint height welding can collapse an entire wall, or one end of it.
  // Do not emit opposite duplicate triangles for a zero-height seam.
  ids=cleanCycle(ids);
  if(ids.length<3)return;
  ids.reverse();if(ids.length===3){tri(...ids);return;}const cx=(xy[e.a][0]+xy[e.b][0])/2,cy=(xy[e.a][1]+xy[e.b][1])/2,ci=vertex2([cx,cy]),mid=v3(ci,(za+zb+wa+wb)/4,kind);
  for(let j=0;j<ids.length;j++)tri(mid,ids[j],ids[(j+1)%ids.length]);
 }
 for(const list of edges.values()){
  let e=list[0],f=faces[e.f],other=list.length===2?faces[list[1].f]:null;
  if(!other){wall(e,f.plane,[0,0,0],4);continue;}
  const a=xy[e.a],b=xy[e.b],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(evalZ(f.plane,p)<evalZ(other.plane,p)){e=list[1];const tmp=f;f=other;other=tmp;}
  wall(e,f.plane,other.plane,f.kind);
 }
 const center=vertex2([0,0]),bottom=v3(center,0,4);
 for(const e of boundary)tri(bottom,v3(e.b,0,4),v3(e.a,0,4));
 return {landFaces:Uint32Array.from(landFaces),vertices:new Float32Array(positions),indices:new Uint32Array(indices),classes:new Uint8Array(classes)};
}
// A Float32 conversion can place one triangle exactly on an edge. Discarding
// it creates a crack. Flip its shared diagonal instead: split the adjacent
// non-degenerate triangle at the collinear middle vertex. Positions, surface
// area, footprint, winding and volume are unchanged.
function retriangulateZeroArea(mesh){
 const p=mesh.vertices,t=mesh.indices,n=p.length/3,zero=[];
 const area2=(a,b,c)=>{const x=p[b*3]-p[a*3],y=p[b*3+1]-p[a*3+1],z=p[b*3+2]-p[a*3+2],u=p[c*3]-p[a*3],v=p[c*3+1]-p[a*3+1],w=p[c*3+2]-p[a*3+2];return (y*w-z*v)**2+(z*u-x*w)**2+(x*v-y*u)**2;};
 for(let i=0;i<t.length;i+=3)if(area2(t[i],t[i+1],t[i+2])===0)zero.push(i);
 if(!zero.length)return {fixed:0,remaining:0};
 const edges=new Map(),key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
 function change(i,add){for(let j=0;j<3;j++){const k=key(t[i+j],t[i+(j+1)%3]);let list=edges.get(k);if(add){if(!list)edges.set(k,list=[]);list.push(i);}else{const at=list.indexOf(i);if(at>=0)list.splice(at,1);if(!list.length)edges.delete(k);}}}
 for(let i=0;i<t.length;i+=3)change(i,true);
 let fixed=0,pending=zero,progress=true;
 while(pending.length&&progress){progress=false;const next=[];
  for(const i of pending){
   if(area2(t[i],t[i+1],t[i+2])!==0)continue;
   const candidates=[0,1,2].sort((j,k)=>{
    const length=q=>{const a=t[i+q],b=t[i+(q+1)%3];return (p[a*3]-p[b*3])**2+(p[a*3+1]-p[b*3+1])**2+(p[a*3+2]-p[b*3+2])**2;};return length(k)-length(j);
   });let repaired=false;
   for(const j of candidates){
    const a=t[i+j],b=t[i+(j+1)%3],c=t[i+(j+2)%3],list=edges.get(key(a,b));if(list?.length!==2)continue;
    const other=list[0]===i?list[1]:list[0];let d;
    for(let q=0;q<3;q++)if(t[other+q]===b&&t[other+(q+1)%3]===a)d=t[other+(q+2)%3];
    if(d===undefined||d===c)continue;
    // The opposite point must lie on the selected segment, not its extension.
    let dot=0;for(let q=0;q<3;q++)dot+=(p[c*3+q]-p[a*3+q])*(p[c*3+q]-p[b*3+q]);
    if(dot>0||!area2(a,d,c)||!area2(d,b,c))continue;
    change(i,false);change(other,false);t.set([a,d,c],i);t.set([d,b,c],other);change(i,true);change(other,true);
    fixed++;progress=repaired=true;break;
   }
   if(!repaired)next.push(i);
  }pending=next;
 }
 return {fixed,remaining:pending.length};
}
// Float32 export coordinates can place a wall edge exactly on a chain of
// shorter opposite edges. Split the single incident face at existing heights;
// never move points, cap holes, or infer a missing opposite surface.
function conformVerticalChains(mesh,bad,usage){
 const v=mesh.vertices,t=mesh.indices,n=v.length/3,cols=new Map(),plans=new Map();
 const key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
 if(!bad.length||bad.length>4096)return 0;
 for(const [k,code] of bad){const a=Math.floor(k/n),b=k%n;
  if(v[3*a]!==v[3*b]||v[3*a+1]!==v[3*b+1])continue;
  const col=v[3*a]+','+v[3*a+1];if(!cols.has(col))cols.set(col,[]);cols.get(col).push([a,b,code]);
 }
 for(const edges of cols.values()){
  if(edges.length<3||edges.length>128||edges.some(e=>e[2]!==1&&e[2]!==65536))continue;
  const ids=[...new Set(edges.flatMap(([a,b])=>[a,b]))].sort((a,b)=>v[3*a+2]-v[3*b+2]);
  if(ids.length!==edges.length||ids.some((a,i)=>i&&v[3*a+2]===v[3*ids[i-1]+2]))continue;
  const directed=new Map(edges.map(([a,b,c])=>[key(a,b),c===1?[a,b]:[b,a]]));
  const k=key(ids[0],ids.at(-1)),long=directed.get(k);if(!long)continue;
  if(long[0]!==ids[0])ids.reverse();
  if(ids.slice(1).every((b,i)=>directed.get(key(ids[i],b))?.[0]===b))plans.set(k,ids);
 }
 if(!plans.size)return 0;
 const replacements=[],extra=[],extraLand=[],land=new Set(mesh.landFaces||[]);
 for(let i=0;i<t.length;i+=3)for(let j=0;j<3;j++){
  const a=t[i+j],b=t[i+(j+1)%3],c=t[i+(j+2)%3],k=key(a,b),ids=plans.get(k);
  if(!ids||ids[0]!==a||ids.at(-1)!==b)continue;
  if((v[3*c]===v[3*a]&&v[3*c+1]===v[3*a+1])||ids.slice(1,-1).some(id=>usage.has(key(id,c))))continue;
  replacements.push([i,a,ids[1],c]);for(let s=1;s<ids.length-1;s++){
   if(land.has(i/3))extraLand.push((t.length+extra.length)/3);extra.push(ids[s],ids[s+1],c);
  }plans.delete(k);break;
 }
 if(!replacements.length)return 0;
 const out=new Uint32Array(t.length+extra.length);out.set(t);out.set(extra,t.length);
 for(const [i,a,b,c] of replacements)out.set([a,b,c],i);mesh.indices=out;
 if(extraLand.length){const old=mesh.landFaces,next=new Uint32Array(old.length+extraLand.length);next.set(old);next.set(extraLand,old.length);mesh.landFaces=next;}
 return extra.length/3;
}
const raster=R.buildMesh;
function buildArchitecture(data,settings,repairs=[],attempt=0){
 const tick=(step,done,total)=>R.meshProgress?.({step,done,total,pass:attempt+1});tick('Geländeraster',0,1);
 const s=R.cleanSettings(settings),info=R.boundsInfo(data.bounds),w=s.modelWidth,h=w*info.h/info.w,scale=w/info.w;
 // More terrain samples cannot recover missing DEM data. Buildings no longer
 // depend on this terrain resolution at all.
 const n=Math.min(s.resolution,Math.max(65,Math.min(257,(data.terrain.nativeCols?Math.round(data.terrain.nativeCols*1.20):data.terrain.cols)+16)));
 const terrain=raster({...data,buildings:[]},{...s,resolution:n,buildingFactor:0,landmarkFactor:1,landmarkWidth:1});
 let low=Infinity;for(const z of data.terrain.values)low=Math.min(low,z);
 const terrainAt=(u,v)=>s.base+Math.max(0,R.sampleTerrain(data.terrain,u,v)-low)*scale*s.terrainFactor;
 tick('Dachflächen',0,data.buildings.length);const {patches,stats}=architecturePatches(data,s,terrainAt,w,h,scale);
 // Bound repair work by scene size, not a fixed 100-contact cutoff which rejects
 // valid city blocks. Every repair is still subject to the final manifold check.
 const repairLimit=Math.min(2048,Math.max(128,stats.buildings*2));stats.repairLimit=repairLimit;
 patches.push(...repairs);stats.contactRepairs=repairs.length;stats.repairPasses=attempt;
 if(s.frame>0){const X=w/2+s.frame,Y=h/2+s.frame;
  for(const poly of [[[-X,-Y],[X,-Y],[X,-h/2],[-X,-h/2]],[[-X,h/2],[X,h/2],[X,Y],[-X,Y]],[[-X,-h/2],[-w/2,-h/2],[-w/2,h/2],[-X,h/2]],[[w/2,-h/2],[X,-h/2],[X,h/2],[w/2,h/2]]])
   patches.unshift({poly,box:bbox(poly),plane:[0,0,s.base+1.4],kind:4,building:-1,force:true});
 }

 if(patches.length>200000)throw Error('Zu viele architektonische Teilflächen. Bitte einen kleineren Kartenausschnitt wählen.');
 const [cols,rows]=terrain.grid,W=terrain.width,H=terrain.height,dx=W/(cols-1),dy=H/(rows-1),bins=new Map();
 for(let i=0;i<patches.length;i++){
  const p=patches[i],bb=p.box,x0=R.clamp(Math.floor((bb[0]+W/2)/dx),0,cols-2),x1=R.clamp(Math.floor((bb[2]+W/2)/dx),0,cols-2),y0=R.clamp(Math.floor((H/2-bb[3])/dy),0,rows-2),y1=R.clamp(Math.floor((H/2-bb[1])/dy),0,rows-2);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=y*(cols-1)+x;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);}
 }
 const faces=[],topCount=(cols-1)*(rows-1)*6,v=terrain.vertices,idx=terrain.indices;
 for(let i=0;i<topCount;i+=3){
  if(i%24576===0)tick('Flächen verbinden',i/3,topCount/3);
  const ids=[idx[i],idx[i+1],idx[i+2]],points=ids.map(id=>{const x=(id%cols)/(cols-1)*W-W/2,y=H/2-Math.floor(id/cols)/(rows-1)*H;return [x,y,terrain.classes[id]===4?terrainAt(x/w+.5,.5-y/h):v[id*3+2]];}),poly=tidy(points.map(p=>p.slice(0,2))),plane=planeFrom3(...points);
  if(!poly.length)continue;const cell=Math.floor(i/6),candidates=bins.get(cell)||[];
  let local=[{poly,plane,kind:terrain.classes[ids[0]],box:bbox(poly)}];
  for(const j of candidates)local=overlay(local,patches[j]);
  faces.push(...local);
  if(faces.length>800000)throw Error('Modell überschreitet das sichere Detailbudget. Bitte kleineren Ausschnitt wählen.');
 }
 let result;
 tick('Kanten verbinden',0,faces.length);try{result=stitchSurface(faces,W,H,stats);}
 catch(e){
  if(!e.contacts)throw e;
  if(attempt>=4||repairs.length+e.contacts.length>repairLimit){
   const failure=Error('Die Gebäudekontakte benötigen eine genauere Prüfung. Das fehlerhafte Modell wurde nicht zum Export freigegeben.');
   failure.code='GEOMETRY_CONTACTS';failure.diagnostics={attempt,contactCount:e.contacts.length,repairCount:repairs.length,repairLimit,buildings:stats.buildings,contacts:e.contacts.slice(0,24)};throw failure;
  }
  const additions=e.contacts.map(c=>contactPatch(c.a,c.b,c.plane,c.kind,W,H,attempt)).filter(Boolean);
  if(!additions.length)throw e;
  return buildArchitecture(data,settings,repairs.concat(additions),attempt+1);
 }
 tick('Geschlossenen Körper prüfen',0,result.indices.length/3);const degenerate=retriangulateZeroArea(result);
 stats.zeroAreaRetriangulations=degenerate.fixed;
 // Two footprints touching at a single XY point create a non-manifold vertical
 // edge. Regularise ONLY the reported contacts, initially 0.004 mm wide
 // (at most 0.016384 mm after four bounded passes). Never inflate all buildings.
 const count=result.vertices.length/3,usage=new Map(),vs=result.vertices;
 function audit(){usage.clear();const ix=result.indices;for(let i=0;i<ix.length;i+=3)for(let j=0;j<3;j++){
  const a=ix[i+j],b=ix[i+(j+1)%3],k=Math.min(a,b)*count+Math.max(a,b);usage.set(k,(usage.get(k)||0)+(a<b?1:65536));
 }const errors=[];for(const [key,code] of usage)if(code!==65537)errors.push([key,code]);return errors;}
 let bad=audit();stats.verticalSeamSplits=conformVerticalChains(result,bad,usage);
 if(stats.verticalSeamSplits)bad=audit();usage.clear();
 if(bad.length){
  if(attempt>=4||repairs.length+bad.length>repairLimit){
    const failure=Error('Die Gebäudegeometrie enthält eine nicht druckbare Naht. Das fehlerhafte Modell wurde nicht zum Export freigegeben.');
    failure.code='GEOMETRY_SEAM';failure.diagnostics={attempt,repairCount:repairs.length,repairLimit,badEdges:bad.length,buildings:stats.buildings,xySeamWelds:stats.xySeamWelds,maxXYSeamShift:stats.maxXYSeamShift};throw failure;
   }
  const additions=[];
  for(const [key,val] of bad){
   const ai=Math.floor(key/count)*3,bi=(key%count)*3,a=[vs[ai],vs[ai+1]],b=[vs[bi],vs[bi+1]],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
   const za=vs[ai+2],zb=vs[bi+2],slope=len2>EPS*EPS?(zb-za)/len2:0;
   const plane=len2>EPS*EPS?[slope*dx,slope*dy,za-slope*(dx*a[0]+dy*a[1])]:[0,0,Math.max(za,zb)];
   const p=contactPatch(a,b,plane,result.classes[ai/3],W,H,attempt);if(p)additions.push(p);
  }
  if(!additions.length)throw Error('Eine geometrische Naht konnte nicht repariert werden. Kein fehlerhaftes Modell wurde exportiert.');
  return buildArchitecture(data,settings,repairs.concat(additions),attempt+1);
 }
 if(degenerate.remaining)throw Error('Eine flächenlose Gebäudenaht konnte nicht aufgelöst werden. Kein fehlerhaftes Modell wurde exportiert.');
 let zmax=0;for(let i=2;i<result.vertices.length;i+=3)zmax=Math.max(zmax,result.vertices[i]);
 return {...result,width:W,height:H,zmax,grid:[0,0],cell:terrain.cell,kind:'architecture',architectureVersion:12,geometryKernelVersion:18,architecture:stats,missed:stats.omitted,estimated:stats.heightEstimated,buildingCount:stats.buildings,terrainGrid:terrain.grid};
}
// Conforming relief on already-stitched ground faces. No separate road shells.
// All XY dimensions below are millimetres on the print, not screen pixels.
// All curve construction happens in print millimetres, before terrain heights.
const roadNodeKey=p=>Math.round(p[0]*1e8)+','+Math.round(p[1]*1e8);
function roadAnchors(roads){
 const seen=new Map(),shared=new Set();
 for(const r of roads){if(r.kind==='river'||r.underground||r.inactive)continue;
  for(const p of r.points||[]){const k=roadNodeKey(p),owner=seen.get(k);if(owner&&owner!==r)shared.add(k);else seen.set(k,r);}}
 return shared;
}
function roadCurve(raw,w,h,radius,anchors,tolerance=.015){
 const pts=[],out=[];for(const p of raw){if(!p.every(Number.isFinite))return [];if(!pts.length||!eq(p,pts.at(-1)))pts.push(p);}
 if(pts.length<3)return pts;const loop=eq(pts[0],pts.at(-1));if(loop)pts.pop();
 const n=pts.length;if(n<3)return raw;const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const length=(a,b)=>Math.hypot((a[0]-b[0])*w,(a[1]-b[1])*h);
 for(let i=0;i<n;i++){const b=pts[i];if((!loop&&(i===0||i===n-1))||anchors.has(roadNodeKey(b))){out.push(b);continue;}
  const a=pts[(i+n-1)%n],c=pts[(i+1)%n],u=length(a,b),v=length(b,c),cos=((b[0]-a[0])*(c[0]-b[0])*w*w+(b[1]-a[1])*(c[1]-b[1])*h*h)/(u*v);
  if(!Number.isFinite(cos)||cos>.9997||cos<-.94){out.push(b);continue;}
  const trim=Math.min(.32*u,.32*v,1.6*radius),l=lerp(b,a,trim/u),r=lerp(b,c,trim/v);
  // Quadratic Bezier tangent to both straight runs. Chord error decreases as 1/N^2.
  const error=length(lerp(l,r,.5),b)*.5,steps=Math.max(2,Math.min(16,Math.ceil(Math.sqrt(error/tolerance))));
  out.push(l);for(let j=1;j<=steps;j++){const t=j/steps;out.push(lerp(lerp(l,b,t),lerp(b,r,t),t));}
 }if(loop)out.push(out[0]);return out;
}
// Conform terrain edges to the actual outer and shoulder contours of the union
// of round-ended strokes. Heights are applied AFTER this planar partition.
function fitRoadBands(faces,v,cl,locked,field,limit){
 const value=new Float32Array(cl.length);value.fill(NaN);let samples=value,added=0;
 for(const level of [0,.5]){
  if(samples.length<cl.length){const next=new Float32Array(cl.length);next.fill(NaN);next.set(samples);samples=next;}
  const get=i=>{let s=samples[i];if(Number.isNaN(s)){s=field(v[3*i],v[3*i+1]);samples[i]=s;}return s;};
  const cuts=new Map(),out=[],protectedEdges=new Set();
  // Do not subdivide slivers at building contacts. At Float32 precision a new
  // point there can round onto the opposite edge. Share the decision by edge.
  const edgeKey=(a,b)=>Math.min(a,b)*8388608+Math.max(a,b);
  for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],x=v[3*b]-v[3*a],y=v[3*b+1]-v[3*a+1],u=v[3*c]-v[3*a],z=v[3*c+1]-v[3*a+1];
   if(x*z-y*u < .002*Math.max(.001,Math.abs(x)+Math.abs(y),Math.abs(u)+Math.abs(z),Math.abs(x-u)+Math.abs(y-z))){protectedEdges.add(edgeKey(a,b));protectedEdges.add(edgeKey(b,c));protectedEdges.add(edgeKey(c,a));}}

  function cut(a,b,sa,sb){if(a>b)return cut(b,a,sb,sa);
   const k=a*8388608+b;if(cuts.has(k))return cuts.get(k);
   // Never add a T junction on a footprint, frame, water or excluded sliver.
   if(protectedEdges.has(k)||(locked[a]&&locked[b]))return Math.abs(sa-level)<Math.abs(sb-level)?a:b;
   const x=v[3*a],y=v[3*a+1],dx=v[3*b]-x,dy=v[3*b+1]-y,len=Math.hypot(dx,dy);
   let lo=0,hi=1,t=R.clamp((level-sa)/(sb-sa),0,1);
   for(let j=0;j<13;j++){const f=field(x+dx*t,y+dy*t)-level;if(Math.abs(f)<1e-7)break;
    if((f>0)===(sa>level))lo=t;else hi=t;t=(lo+hi)/2;}
   let id;if(t<.012||t*len<.001)id=a;else if(1-t<.012||(1-t)*len<.001)id=b;else{ id=cl.length;
    v.push(Math.fround(x+dx*t),Math.fround(y+dy*t),Math.fround(v[3*a+2]+(v[3*b+2]-v[3*a+2])*t));cl.push(cl[a]===5&&cl[b]===5?5:0);added++;}
   cuts.set(k,id);return id;
  }
  const tri=(a,b,c)=>{if(a!==b&&b!==c&&c!==a)out.push(a,b,c);};
  for(let i=0;i<faces.length;i+=3){let a=faces[i],b=faces[i+1],c=faces[i+2],sa=get(a),sb=get(b),sc=get(c);
   const A=sa>level,B=sb>level,C=sc>level;if(A===B&&B===C){out.push(a,b,c);continue;}
   if(A===B){[a,b,c]=[c,a,b];[sa,sb,sc]=[sc,sa,sb];}else if(A===C){[a,b,c]=[b,c,a];[sa,sb,sc]=[sb,sc,sa];}
   const p=cut(a,b,sa,sb),q=cut(a,c,sa,sc);tri(a,p,q);if(p===a){tri(p,b,q);tri(b,c,q);}else{tri(p,b,c);tri(p,c,q);}
   if(out.length>limit*3)throw Object.assign(Error('Straßenkonturen überschreiten das Dreiecksbudget. Bitte den Kartenausschnitt verkleinern.'),{code:'ROAD_DETAIL_BUDGET'});
  }if(out.length>limit*3)throw Object.assign(Error('Straßenkonturen überschreiten das Dreiecksbudget.'),{code:'ROAD_DETAIL_BUDGET'});faces=out;
 }return {faces,added};
}
function addStreetRelief(m,roads,s,w,h,scale){
 const land=m.landFaces;delete m.landFaces;
 const mode=s.roadMode,amp=s.roadRelief,pitch=Math.max(1,Math.max(w,h)/210),step=Math.max(.40,Math.max(w,h)/450);
 const types={major:[13,1.65,1],secondary:[9,1.4,.85],local:[6,1.15,.70],path:[2,.90,.55]};
 const stats=m.roadProfile={mode,heightMm:amp,lines:0,segments:0,changedVertices:0,addedTriangles:0,maxOffsetMm:0,classes:{major:0,secondary:0,local:0,path:0}};
 const waterOn=s.waterMode!=='flat'&&s.waterDepth>0,roadsOn=mode!=='off'&&amp>0;
 const water=m.surfaceProfile={waterMode:s.waterMode,waterDepth:s.waterDepth,greenRelief:s.greenRelief,riverLines:0,riverVertices:0};
 if((!roadsOn&&!waterOn)||!roads.length||!land.length)return m;
 const bins=new Map(),nx=Math.ceil(w/pitch)+1,ny=Math.ceil(h/pitch)+1,cellX=x=>Math.min(nx-1,Math.max(0,Math.floor((x+w/2)/pitch))),cellY=y=>Math.min(ny-1,Math.max(0,Math.floor((y+h/2)/pitch)));
 const anchors=roadAnchors(roads);
 for(const r of roads){const river=r.kind==='river';if(r.underground||r.inactive)continue;
  if(river?(!waterOn||!['river','canal','stream','ditch','drain','tidal_channel'].includes(r.highway||'river')):(!roadsOn||!Object.hasOwn(types,r.kind)))continue;
  const big=['river','canal','tidal_channel'].includes(r.highway||'river');
  const [metres,minWidth,weight]=river?[R.clamp(Number(r.widthM)||(big?16:3),1,80),big?1.8:1.0,big?1:.65]:types[r.kind],radius=Math.max(metres*scale,minWidth,step*2.2)/2,pts=river||s.streetCurve==="mapped"?r.points:roadCurve(r.points,w,h,radius,anchors,s.streetCurve==="fine"?.006:.015);let used=false;
  for(let i=1;i<pts.length;i++){
   let ax=(pts[i-1][0]-.5)*w,ay=(.5-pts[i-1][1])*h,bx=(pts[i][0]-.5)*w,by=(.5-pts[i][1])*h,dx=bx-ax,dy=by-ay;
   if(![ax,ay,bx,by,dx,dy].every(Number.isFinite))continue;
   // Parametric clipping also bounds work on long OSM ways outside the map.
   let lo=0,hi=1;for(const [a,d,l,u] of [[ax,dx,-w/2-radius,w/2+radius],[ay,dy,-h/2-radius,h/2+radius]]){
    if(!d){if(a<l||a>u){hi=-1;break;}}else{const t=(l-a)/d,q=(u-a)/d;lo=Math.max(lo,Math.min(t,q));hi=Math.min(hi,Math.max(t,q));}}
   if(lo>=hi)continue;bx=ax+hi*dx;by=ay+hi*dy;ax+=lo*dx;ay+=lo*dy;dx=bx-ax;dy=by-ay;const n=Math.ceil(Math.hypot(dx,dy)/(3*pitch));if(!n)continue;
   const xstep=dx/n,ystep=dy/n,inv=1/(xstep*xstep+ystep*ystep);
   for(let j=0;j<n;j++){const x=ax+j*xstep,y=ay+j*ystep,seg=[x,y,xstep,ystep,inv,radius,weight,river?3:r.kind==='major'||r.kind==='secondary'?6:7];
    const x0=cellX(Math.min(x,x+xstep)-radius),x1=cellX(Math.max(x,x+xstep)+radius),y0=cellY(Math.min(y,y+ystep)-radius),y1=cellY(Math.max(y,y+ystep)+radius);
    for(let row=y0;row<=y1;row++)for(let col=x0;col<=x1;col++){const k=row*nx+col;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(seg);}}
   used=true;stats.segments++;
  }if(used){if(river)water.riverLines++;else{stats.lines++;stats.classes[r.kind]++;}}
 }
 if(!stats.lines&&!water.riverLines)return m;
 const v=Array.from(m.vertices),cl=Array.from(m.classes),t=m.indices,nv=cl.length,active=new Uint8Array(t.length/3),locked=new Uint8Array(nv);let faces=[];
 const progress=(name,n,total)=>R.meshProgress?.({step:name,done:n,total,pass:1});
 const nearby=(x0,y0,x1,y1)=>{for(let y=cellY(y0);y<=cellY(y1);y++)for(let x=cellX(x0);x<=cellX(x1);x++)if(bins.has(y*nx+x))return true;return false;};
 for(const f of land){const a=t[f*3]*3,b=t[f*3+1]*3,c=t[f*3+2]*3,x=v[a],y=v[a+1],u=v[b],p=v[b+1],z=v[c],q=v[c+1];
  // Leave numerically fragile micro-slivers unchanged, not deleted.
  if((u-x)*(q-y)-(p-y)*(z-x)<1e-4*Math.max(1,Math.abs(u-x)+Math.abs(p-y),Math.abs(z-x)+Math.abs(q-y)))continue;
  if(!nearby(Math.min(x,u,z),Math.min(y,p,q),Math.max(x,u,z),Math.max(y,p,q)))continue;
  active[f]=1;faces.push(a/3,b/3,c/3);
 }
 // Vertices shared with a roof, wall, lake, frame or unchanged face stay put.
 for(let i=0;i<t.length;i+=3)if(!active[i/3])locked[t[i]]=locked[t[i+1]]=locked[t[i+2]]=1;
 const start=faces.length/3,key=(a,b)=>Math.min(a,b)*8388608+Math.max(a,b),len2=(a,b)=>(v[3*a]-v[3*b])**2+(v[3*a+1]-v[3*b+1])**2;
 function touches(a,b,l2){const x=(v[3*a]+v[3*b])/2,y=(v[3*a+1]+v[3*b+1])/2,reach=Math.sqrt(l2)*.5;
  for(let row=cellY(y-reach);row<=cellY(y+reach);row++)for(let col=cellX(x-reach);col<=cellX(x+reach);col++){
   const segs=bins.get(row*nx+col);if(!segs)continue;
   for(const g of segs){const u=x-g[0],v=y-g[1],t=Math.max(0,Math.min(1,(u*g[2]+v*g[3])*g[4]));if((u-t*g[2])**2+(v-t*g[3])**2<=(reach+g[5])**2)return true;}}
  return false;}
 for(let pass=0;pass<9;pass++){
  progress('Straßen und Gewässer verfeinern',pass+1,9);const mid=new Map();
  for(let i=0;i<faces.length;i+=3)for(let j=0;j<3;j++){
   const a=faces[i+j],b=faces[i+(j+1)%3];const l2=len2(a,b);if(l2<=step*step)continue;
   const k=key(a,b);if(!mid.has(k)){mid.set(k,-1);continue;}
   // Only a second eligible incident face can authorise a split. Thus shared
   // edges always have one midpoint in both faces, with no T-junctions.
   if(!touches(a,b,l2))continue;const id=cl.length;mid.set(k,id);v.push(Math.fround((v[3*a]+v[3*b])/2),Math.fround((v[3*a+1]+v[3*b+1])/2),Math.fround((v[3*a+2]+v[3*b+2])/2));cl.push(cl[a]===5&&cl[b]===5?5:0);
  }
  let splits=0;const next=[];
  for(let i=0;i<faces.length;i+=3){const a=faces[i],b=faces[i+1],c=faces[i+2],ab=mid.get(key(a,b))??-1,bc=mid.get(key(b,c))??-1,ca=mid.get(key(c,a))??-1;
   const mask=(ab>=0?1:0)|(bc>=0?2:0)|(ca>=0?4:0);if(mask)splits++;
   switch(mask){case 0:next.push(a,b,c);break;case 1:next.push(a,ab,c,ab,b,c);break;case 2:next.push(b,bc,a,bc,c,a);break;case 4:next.push(c,ca,b,ca,a,b);break;
    case 3:next.push(ab,b,bc,a,ab,bc,a,bc,c);break;case 6:next.push(bc,c,ca,b,bc,ca,b,ca,a);break;case 5:next.push(ca,a,ab,c,ca,ab,c,ab,b);break;
    case 7:next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  }
  faces=next;if(!splits)break;
  if(t.length/3-start+faces.length/3>2800000)throw Object.assign(Error('Das Straßenrelief überschreitet 2,8 Mio. Dreiecke. Einen kleineren Ausschnitt wählen oder das Straßenprofil ausschalten.'),{code:'ROAD_DETAIL_BUDGET',diagnostics:{mode,triangles:Math.round(t.length/3-start+faces.length/3)}});
 }
 if(stats.lines){
  progress('Fahrbahnränder und Rundungen verbinden',0,faces.length/3);
  const field=(x,y)=>{const list=bins.get(cellY(y)*nx+cellX(x));let best=-1;
   if(list)for(const g of list){if(g[7]===3)continue;const u=x-g[0],z=y-g[1],q=Math.max(0,Math.min(1,(u*g[2]+z*g[3])*g[4]));best=Math.max(best,1-Math.hypot(u-q*g[2],z-q*g[3])/g[5]);}return best;};
  const fitted=fitRoadBands(faces,v,cl,locked,field,2800000-(t.length/3-start));faces=fitted.faces;stats.contourVertices=fitted.added;
 }
 progress('Straßenprofil in Millimetern formen',0,cl.length);
 for(let i=0;i<cl.length;i++){
  if(locked[i])continue;const x=v[3*i],y=v[3*i+1];if(Math.abs(x)>w/2||Math.abs(y)>h/2)continue;
  const list=bins.get(cellY(y)*nx+cellX(x));if(!list)continue;let best=0,kind=0,wet=0;
  for(const seg of list){const [a,b,dx,dy,inv,r,weight,cls]=seg,u=x-a,z=y-b,q=Math.max(0,Math.min(1,(u*dx+z*dy)*inv)),dist2=(u-q*dx)**2+(z-q*dy)**2;if(dist2>=r*r)continue;
   const height=weight*Math.min(1,(1-Math.sqrt(dist2)/r)/.50);if(cls===3){wet=Math.max(wet,height);}else if(height>best){best=height;kind=cls;}}
  if(!best&&!wet)continue;const at=3*i+2,old=v[at];
  if(wet){v[at]=Math.fround(Math.max(.6,old+(s.waterMode==='raised'?1:-1)*s.waterDepth*wet));cl[i]=3;water.riverVertices++;}
  else{v[at]=Math.fround(mode==='engraved'?Math.max(.6,old-amp*best):old+amp*best);cl[i]=kind;stats.changedVertices++;stats.maxOffsetMm=Math.max(stats.maxOffsetMm,Math.abs(v[at]-old));}m.zmax=Math.max(m.zmax,v[at]);
 }
 const out=new Uint32Array(t.length-start*3+faces.length);let off=0;for(let i=0;i<t.length;i+=3)if(!active[i/3]){out[off++]=t[i];out[off++]=t[i+1];out[off++]=t[i+2];}out.set(faces,off);
 m.indices=out;m.vertices=new Float32Array(v);m.classes=new Uint8Array(cl);stats.addedTriangles=faces.length/3-start;return m;
}
// B-spline filtering on the DEM before any road/roof construction. Extrapolate
// linearly at boundaries to preserve planar slopes; never change the source grid.
function smoothTerrainGrid(grid,mode){
 if(mode==='off'||grid.cols<3||grid.rows<3)return grid;
 const {cols:n,rows:m,values:a}=grid;let lo=Infinity,hi=-Infinity;for(const z of a){lo=Math.min(lo,z);hi=Math.max(hi,z);}if(lo===hi)return grid;
 const N=Math.min(1025,2*n-1),M=Math.min(1025,2*m-1);
 function line(src,off,stride,len,u){const i=Math.floor(u),t=u-i,q=1-t;
  const at=j=>j<0?src[off]+j*(src[off+stride]-src[off]):j>=len?src[off+(len-1)*stride]+(j-len+1)*(src[off+(len-1)*stride]-src[off+(len-2)*stride]):src[off+j*stride];
  return (q*q*q*at(i-1)+(4-6*t*t+3*t*t*t)*at(i)+(1+3*t+3*t*t-3*t*t*t)*at(i+1)+t*t*t*at(i+2))/6;
 }
 function resample(src,n,m,N,M){const tmp=new Float64Array(N*m),out=new Float64Array(N*M);
  for(let y=0;y<m;y++)for(let x=0;x<N;x++)tmp[y*N+x]=line(src,y*n,1,n,x*(n-1)/(N-1));
  for(let x=0;x<N;x++)for(let y=0;y<M;y++)out[y*N+x]=Math.min(hi,Math.max(lo,line(tmp,x,N,m,y*(m-1)/(M-1))));return out;
 }
 const src=mode==='strong'?resample(resample(a,n,m,n,m),n,m,n,m):a;
 return {...grid,cols:N,rows:M,values:resample(src,n,m,N,M),nativeCols:n};
}
function buildWithStreets(data,input){const s=R.cleanSettings(input),info=R.boundsInfo(data.bounds),w=s.modelWidth,h=w*info.h/info.w;
 const ground=s.terrainFactor>0?smoothTerrainGrid(data.terrain,s.terrainSmooth):data.terrain;
 const mesh=buildArchitecture({...data,terrain:ground,roads:[]},{...s,roadRelief:0});
 return addStreetRelief(mesh,data.roads,s,w,h,w/info.w);
}

Object.assign(R,{checkRoofPack,buildRasterMesh:raster,buildMesh:buildWithStreets,architecture:{roofLookup,measuredRoof,conformVerticalChains,smoothTerrainGrid,roadCurve,roadAnchors,decompose,roofSpec,roofFrame,roofPieces,half,overlay,stitchSurface,buildArchitecture}});
})(globalThis.RS);
