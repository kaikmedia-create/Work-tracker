/** Footprint-first fusion. No mesh averaging and no change to XY or terrain.
 * Samplers return metres above ground (or absolute heights with a same-datum
 * groundAt function). Coverage/no-data are explicit. Works at any coordinates.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const quantile=(a,q)=>{const t=(a.length-1)*q,i=Math.floor(t);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(t-i);};
const sorted=a=>a.slice().sort((x,y)=>x-y);
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?clamp(((x-a[0])*dx+(y-a[1])*dy)/d,0,1):0;return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function edgeDistance(x,y,rings){let d=Infinity;for(const r of rings)for(let i=0;i<r.length;i++)d=Math.min(d,segmentDistance(x,y,r[i],r[(i+1)%r.length]));return d;}
function sourceError(message){return Object.assign(Error(message),{code:'MEASUREMENT_REFERENCE'});}
function validateSampler(s){
 if(!s||typeof s.sample!=='function'||!Number.isFinite(s.resolutionMetres)||s.resolutionMetres<=0)throw sourceError('Messquelle ohne gültige Auflösung.');
 if(s.unit!=='m')throw sourceError('Gebäude-Messhöhen müssen in Metern vorliegen.');
 if(s.heightReference!=='above-ground'&&!(s.heightReference==='absolute'&&typeof s.groundAt==='function'&&s.verticalDatum&&s.verticalDatum===s.groundVerticalDatum))throw sourceError('Messhöhen benötigen einen eindeutigen Bodenbezug im gleichen Höhensystem.');
}
function valueAt(s,u,v){
 const raw=s.sample(u,v);if(raw===null||raw===undefined)return null;
 const p=typeof raw==='number'?{height:raw}:raw;
 // LAS classification 6 = building. Do not mistake known vegetation for a roof.
 if(p.classification!==undefined&&p.classification!==6&&p.classification!=='building')return null;
 let h=p.height;if(!Number.isFinite(h))return null;
 if(s.heightReference==='absolute'){const ground=s.groundAt(u,v);if(!Number.isFinite(ground))return null;h-=ground;}
 return h>=0&&h<=1000?{height:h,key:p.key}:null;
}
function protectedReason(R,b,s){
 const t=b.tags||{},override=s.landmarkOverrides?.[b.id];
 if(Number.isFinite(override?.height)||b.heightSource==='Manuell')return 'manual';
 if(b.detailRoof||R.architecture?.referenceFor?.(b))return 'detailed-roof';
 if(t['rs:wall']==='yes'||t.barrier||t.location==='underground'||Number(t['building:levels'])<0)return 'not-building';
 return null;
}
function derivedRoofGrid(grid,nx,ny,mid,threshold,source,bb,id){
 const values=new Array(nx*ny).fill(NaN),queue=[];for(const [key,z] of grid){if(!Number.isFinite(z)||Math.abs(z-mid)>threshold)continue;const [i,j]=key.split(',').map(Number),at=j*nx+i;if(i<0||j<0||i>=nx||j>=ny||Number.isFinite(values[at]))continue;values[at]=z;queue.push(at);}
 if(queue.length<12)return null;for(let at=0;at<queue.length;at++){const k=queue[at],i=k%nx,j=Math.floor(k/nx);for(const q of [k-1,k+1,k-nx,k+nx]){const x=q%nx,y=Math.floor(q/nx);if(q<0||q>=values.length||Math.abs(x-i)+Math.abs(y-j)!==1||Number.isFinite(values[q]))continue;values[q]=values[k];queue.push(q);}}
 if(values.some(v=>!Number.isFinite(v)))return null;const max=Math.max(...values),unit=Math.max(.05,Math.ceil(max/250/.05)*.05);if(!Number.isFinite(unit)||unit>5)return null;const bytes=Uint8Array.from(values,v=>clamp(Math.round(v/unit),1,250));
 return {r:{id:'survey:'+String(id).slice(0,96),cols:nx,rows:ny,unit,samples:btoa(String.fromCharCode(...bytes))},box:bb.slice(),source:String(source||'Amtliche Messpunkte'),derived:true};
}
/** Returns a new buildings array; original project data and settings are untouched. */
export function fuseBuildingMeasurements(R,data,settings,sampler){
 validateSampler(sampler);
 const dim=R.boundsInfo(data.bounds),byId=new Map(data.buildings.map(b=>[b.id,b]));
 const audit={algorithm:'official-points-roof-grid-v2',source:String(sampler.source||'Messquelle'),resolutionMetres:sampler.resolutionMetres,heightReference:sampler.heightReference,unit:'m',total:data.buildings.length,updated:0,derivedSurfaces:0,protected:0,rejected:0,sampled:0,validSamples:0,reasons:{},buildings:[],footprintsUnchanged:true,terrainUnchanged:true};
 const buildings=data.buildings.map(b=>{
  const row={id:b.id,status:'unchanged',originalHeight:b.height},skip=reason=>{row.reason=reason;audit.reasons[reason]=(audit.reasons[reason]||0)+1;audit.buildings.push(row);return b;};
  const protect=protectedReason(R,b,settings);if(protect){audit.protected++;return skip(protect);}
  if(!b.rings?.length||!b.rings.flat().every(p=>p.length>=2&&p.slice(0,2).every(Number.isFinite))){audit.rejected++;return skip('invalid-footprint');}
  const bb=R.ringBox(b.rings[0]),width=(bb[2]-bb[0])*dim.w,height=(bb[3]-bb[1])*dim.h,res=sampler.resolutionMetres;
  if(Math.min(width,height)<res*3){audit.rejected++;return skip('footprint-below-resolution');}
  const rings=b.rings.map(r=>r.map(p=>[p[0]*dim.w,p[1]*dim.h])),inset=Math.min(res,Math.min(width,height)*.15);
  // Parent roof statistics must not absorb its separately mapped tower/annex.
  const children=(b.partIds||[]).map(id=>byId.get(id)).filter(Boolean);
  const nx=Math.min(24,Math.max(3,Math.floor(width/res))),ny=Math.min(24,Math.max(3,Math.floor(height/res))),points=[],grid=new Map(),keys=new Set();let expected=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const u=bb[0]+(i+.5)/nx*(bb[2]-bb[0]),v=bb[1]+(j+.5)/ny*(bb[3]-bb[1]);
   if(!R.inside(u,v,b.rings)||edgeDistance(u*dim.w,v*dim.h,rings)<inset||children.some(c=>R.inside(u,v,c.rings)))continue;
   expected++;const p=valueAt(sampler,u,v);if(!p)continue;
   const key=p.key??`${i},${j}`;if(keys.has(key))continue;keys.add(key);points.push(p.height);grid.set(`${i},${j}`,p.height);
  }
  audit.sampled++;audit.validSamples+=points.length;row.samples=points.length;row.coverage=expected?points.length/expected:0;
  if(points.length<12||row.coverage<.65){audit.rejected++;return skip('insufficient-coverage');}
  const all=sorted(points),mid=quantile(all,.5),mad=quantile(sorted(all.map(x=>Math.abs(x-mid))),.5),threshold=Math.max(2.5,4*1.4826*mad),good=all.filter(x=>Math.abs(x-mid)<=threshold);
  row.outliers=all.length-good.length;
  if(good.length<12||good.filter(x=>x>=1.5).length/good.length<.8){audit.rejected++;return skip('no-supported-roof');}
  const p10=quantile(good,.1),p70=quantile(good,.7),p90=quantile(good,.9),rough=[];
  for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){
   const z=grid.get(`${i},${j}`),a=grid.get(`${i-1},${j}`),c=grid.get(`${i+1},${j}`),d=grid.get(`${i},${j-1}`),e=grid.get(`${i},${j+1}`);
   if([z,a,c,d,e].every(Number.isFinite)&&Math.abs(z-mid)<=threshold)rough.push(Math.min(Math.abs(z-(a+c)/2),Math.abs(z-(d+e)/2)));
  }
  row.roughnessMetres=rough.length?quantile(sorted(rough),.5):null;
  if(good.length/points.length<.7||p90-p10>Math.max(8,p70*.8)||row.roughnessMetres>Math.max(1.2,p70*.05)){audit.rejected++;return skip('inconsistent-surface');}
  // Once direct official surfaces are absent, retain the measured roof landscape
  // itself instead of collapsing it to one scalar height. Sparse/noisy fields
  // were already rejected above; missing edge cells are extended from the
  // nearest supported interior sample only for clipping at the mapped footprint.
  const t=b.tags||{},H=Math.round(quantile(good,.95)*10)/10,minH=parseFloat(t.min_height)||0;
  if(H<Math.max(1.5,minH+.5)||H>1000){audit.rejected++;return skip('incompatible-roof-height');}
  const surveyRoof=derivedRoofGrid(grid,nx,ny,mid,threshold,audit.source,bb,b.id);if(!surveyRoof){audit.rejected++;return skip('insufficient-form-samples');}
  row.status='applied';row.reason='official-measurements-derived-surface';row.heightMetres=H;row.quantile=.95;row.spreadMetres=Math.round((p90-p10)*100)/100;row.roofGrid=[nx,ny];
  audit.updated++;audit.derivedSurfaces++;audit.buildings.push(row);
  return {...b,height:H,heightSource:'Amtliche Messpunkte · Dachform abgeleitet',surveyRoof,measuredHeight:{...row,source:audit.source,resolutionMetres:res}};
 });
 return {data:{...data,buildings},audit};
}
/** Adapter for existing nDSM tiles. Sampling uses the actual Web Mercator
 * coordinate, consistent with normalized footprint coordinates (including the dateline). */
export function samplerFromSurvey(R,data,scan){
 const N=512,Z=65536,info=R.boundsInfo(data.bounds),resolution=2*Math.PI*6378137*Math.cos(info.lat*Math.PI/180)/(Z*N),[w,s,e,n]=data.bounds;
 return {unit:'m',heightReference:'above-ground',resolutionMetres:resolution,source:scan.source,sample(u,v){
  const lon=w+(e-w)*u,lat=R.unproject([info.sw[0],info.ne[1]-v*(info.ne[1]-info.sw[1])])[1],X=Math.floor((lon+180)/360*Z*N),Y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*Z*N/2),x=Math.floor(X/N),y=Math.floor(Y/N),col=((X%N)+N)%N,row=((Y%N)+N)%N,tile=scan.tiles[`${((x%Z)+Z)%Z},${y}`];
  const value=tile?.[row*N+col];return value===undefined||value===65535||value>10000?null:{height:value*.1,key:`${X},${Y}`};
 }};
}
/** Provider-neutral raster adapter. Absolute grids must supply ground values
 * in the same datum; absence is never interpreted as zero. */
export function samplerFromGrid(grid){
 if(!grid||!Number.isInteger(grid.cols)||!Number.isInteger(grid.rows)||grid.cols<2||grid.rows<2||grid.values?.length!==grid.cols*grid.rows)throw sourceError('Ungültiges Gebäudehöhenraster.');
 const sample=values=>(u,v)=>{if(u<0||v<0||u>1||v>1)return null;const i=Math.round(u*(grid.cols-1)),j=Math.round(v*(grid.rows-1)),index=j*grid.cols+i,value=values?.[index];return value===grid.noData||!Number.isFinite(value)?null:value;};
 const fn=sample(grid.values),g=sample(grid.groundValues);
 const s={...grid,sample:(u,v)=>{const h=fn(u,v);return h===null?null:{height:h,key:`${Math.round(u*(grid.cols-1))},${Math.round(v*(grid.rows-1))}`};},groundAt:grid.groundValues?g:undefined};validateSampler(s);return s;
}
