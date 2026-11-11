/** Conservative reconstruction from classified, metre-based official point records.
 * No nDOM/DSM substitution: vegetation, unclassified points and uncertain absence
 * of an existing surface model cannot start this fallback.
 */
import clip from './atlas-clip.mjs';
import {solidFromSurfaces,sourceError,crsCode} from './official-geometry.mjs';
const finite=Number.isFinite,area=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2);
function inside(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const inPoly=(p,rings)=>inside(p,rings[0])&&!rings.slice(1).some(r=>inside(p,r));
const at=(p,x,y)=>p[0]*x+p[1]*y+p[2];
function solve(rows){const a=rows.map(r=>r.slice());for(let i=0;i<3;i++){let k=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[k][i]))k=j;if(Math.abs(a[k][i])<1e-9)return null;[a[i],a[k]]=[a[k],a[i]];const d=a[i][i];for(let j=i;j<4;j++)a[i][j]/=d;for(let k=0;k<3;k++)if(k!==i){const q=a[k][i];for(let j=i;j<4;j++)a[k][j]-=q*a[i][j];}}return a.map(r=>r[3]);}
function fit(points){let xx=0,xy=0,yy=0,x=0,y=0,xz=0,yz=0,z=0;for(const [a,b,c] of points){xx+=a*a;xy+=a*b;yy+=b*b;x+=a;y+=b;xz+=a*c;yz+=b*c;z+=c;}return solve([[xx,xy,x,xz],[xy,yy,y,yz],[x,y,points.length,z]]);}
function half(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],P=a*p[0]+b*p[1]+c,Q=a*q[0]+b*q[1]+c;if(P<=1e-9)out.push(p);if((P<0)!==(Q<0)){const t=P/(P-Q);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;}
export function checkPointCollection(bundle){
 if(bundle?.schema!=='rs-classified-points-1'||bundle.unit!=='m'||typeof bundle.verticalDatum!=='string'||!bundle.verticalDatum.trim()||!bundle.source?.official||!bundle.source?.url||!bundle.source?.license||!bundle.source?.attribution)throw sourceError('Amtliche Herkunft, Lizenz, Meter-Einheit und Höhenbezug der Messpunkte fehlen.','POINT_PROVENANCE');
 crsCode(bundle.crs);if(!Array.isArray(bundle.buildings)||bundle.buildings.length>2000)throw sourceError('Ungültige Messpunkt-Gebäudeliste.');let total=0;
 for(const b of bundle.buildings){if(!b||typeof b.id!=='string'||!Array.isArray(b.footprint)||!b.footprint.length||b.footprint.some(r=>!Array.isArray(r)||r.length<3||r.length>2000||r.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))||!Array.isArray(b.points)||b.points.length>20000||b.points.some(p=>!Array.isArray(p)||p.length!==4||!p.every(finite)||!Number.isInteger(p[3])||p[3]<0||p[3]>255))throw sourceError('Ungültige klassifizierte Messpunkte.','POINT_FORMAT');total+=b.points.length;if(total>500000)throw sourceError('Messpunktbudget überschritten.');}
 return bundle;
}
export function derivePointBuilding(bundle,record){
 checkPointCollection({...bundle,buildings:[record]});
 const origin=record.footprint[0][0],rings=record.footprint.map(r=>r.map(p=>[p[0]-origin[0],p[1]-origin[1]]));
 const pts=record.points.filter(p=>p[3]===6).map(p=>[p[0]-origin[0],p[1]-origin[1],p[2]]).filter(p=>inPoly(p,rings));
 const grounds=record.points.filter(p=>p[3]===2&&record.footprint[0].some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<=10)).map(p=>p[2]).sort((a,b)=>a-b);
 if(grounds.length<8||pts.length<24)throw sourceError('Zu wenige getrennt klassifizierte Gebäude- und Bodenpunkte.','POINT_SPARSE');
 const z0=grounds[Math.floor(grounds.length/2)],size=area(rings[0])-rings.slice(1).reduce((s,r)=>s+area(r),0);
 if(size<4||pts.length/size<.5)throw sourceError('Die Gebäudepunktdichte ist zu niedrig.','POINT_DENSITY');
 const unique=new Map();for(const p of pts){const k=Math.round(p[0]*10)+','+Math.round(p[1]*10);if(!unique.has(k))unique.set(k,p);}
 const points=[...unique.values()];if(points.length<24)throw sourceError('Keine ausreichende unabhängige Messpunktbasis.','POINT_SPARSE');
 const xs=rings.flat().map(p=>p[0]),ys=rings.flat().map(p=>p[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],reach=Math.min(3,Math.max(.8,2.2*Math.sqrt(size/points.length)));
 let n=0,covered=0;for(let i=0;i<18;i++)for(let j=0;j<18;j++){const q=[box[0]+(box[2]-box[0])*(i+.5)/18,box[1]+(box[3]-box[1])*(j+.5)/18];if(!inPoly(q,rings))continue;n++;if(points.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<=reach))covered++;}
 if(!n||covered/n<.93)throw sourceError('Messpunkte decken den Gebäudegrundriss nicht ausreichend ab.','POINT_COVERAGE');
 let seed=17321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let remaining=points.slice();const planes=[];
 for(let group=0;group<4&&remaining.length>=12;group++){
  let best=[];
  for(let k=0;k<180;k++){const sample=[0,1,2].map(()=>remaining[Math.floor(random()*remaining.length)]),p=fit(sample);if(!p||Math.hypot(p[0],p[1])>2.75)continue;const hits=remaining.filter(q=>Math.abs(q[2]-at(p,q[0],q[1]))<=.18);if(hits.length>best.length)best=hits;}
  if(best.length<Math.max(12,points.length*.06))break;let p=fit(best);if(!p)break;
  best=remaining.filter(q=>Math.abs(q[2]-at(p,q[0],q[1]))<=.22);p=fit(best);if(!p)break;planes.push(p);const set=new Set(best);remaining=remaining.filter(p=>!set.has(p));
  if(remaining.length<=points.length*.03)break;
 }
 if(!planes.length)throw sourceError('Keine belastbare Dachfläche in den Messpunkten.','POINT_FIT');
 let winner=null;for(const direction of [-1,1]){
  const height=(x,y)=>direction<0?Math.min(...planes.map(p=>at(p,x,y))):Math.max(...planes.map(p=>at(p,x,y))),errors=points.map(p=>Math.abs(p[2]-height(p[0],p[1]))).sort((a,b)=>a-b),rmse=Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length),p95=errors[Math.floor(errors.length*.95)];
  if(rmse<=.2&&p95<=.3&&(!winner||rmse<winner.rmse))winner={direction,height,rmse,p95};
 }
 if(!winner)throw sourceError('Komplexes oder mehrdeutiges Dach: keine ausreichend genaue Messpunkt-Ableitung.','POINT_COMPLEX');
 const all=rings.flat();if(all.some(([x,y])=>winner.height(x,y)-z0<.8||winner.height(x,y)-z0>500||!points.some(p=>Math.hypot(p[0]-x,p[1]-y)<=reach*1.6)))throw sourceError('Dachrand nicht ausreichend durch Messpunkte belegt.','POINT_EDGE');
 const surfaces=[],world=(x,y,z)=>[x+origin[0],y+origin[1],z],rectangle=[[box[0]-1,box[1]-1],[box[2]+1,box[1]-1],[box[2]+1,box[3]+1],[box[0]-1,box[3]+1]];
 for(let i=0;i<planes.length;i++){
  let region=rectangle;for(let j=0;j<planes.length&&region.length;j++)if(j!==i){const p=planes[i],q=planes[j],sgn=winner.direction<0?1:-1;region=half(region,sgn*(p[0]-q[0]),sgn*(p[1]-q[1]),sgn*(p[2]-q[2]));}
  if(region.length<3)continue;
  for(const poly of clip.intersection([rings],[[region]]))if(area(poly[0])>.01)surfaces.push({kind:'RoofSurface',rings:poly.map(r=>r.map(([x,y])=>world(x,y,at(planes[i],x,y))))});
 }
 surfaces.push({kind:'GroundSurface',rings:rings.map(r=>r.map(([x,y])=>world(x,y,z0)))});
 for(const ring of rings){const r=ring.slice();if(r.length>1&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1])r.pop();for(let i=0;i<r.length;i++){const A=r[i],B=r[(i+1)%r.length],cuts=[0,1];for(let j=0;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const p=planes[j],q=planes[k],a=at(p,...A)-at(q,...A),b=at(p,...B)-at(q,...B),t=a/(a-b);if(t>1e-8&&t<1-1e-8)cuts.push(t);}cuts.sort((a,b)=>a-b);for(let j=0;j<cuts.length-1;j++){if(cuts[j+1]-cuts[j]<1e-8)continue;const p=cuts.slice(j,j+2).map(t=>[A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])]);surfaces.push({kind:'WallSurface',rings:[[world(...p[0],z0),world(...p[1],z0),world(...p[1],winner.height(...p[1])),world(...p[0],winner.height(...p[0]))]]});}}}
 const m=solidFromSurfaces(record.id,surfaces,{...bundle.source,crs:bundle.crs,verticalDatum:bundle.verticalDatum});m.source.method='classified-points-plane-fit-v1';m.quality={buildingPoints:points.length,groundPoints:grounds.length,coverage:covered/n,rmseMetres:winner.rmse,p95Metres:winner.p95,planes:planes.length,classification:'building=6; ground=2; all other classes excluded'};return m;
}
