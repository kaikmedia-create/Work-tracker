// Normalized surface heights are clipped to the original footprint, never its box.
const bundledRoofs=__PACK__;
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
