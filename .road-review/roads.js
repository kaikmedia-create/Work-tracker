// Conforming relief on already-stitched ground faces. No separate road shells.
// All XY dimensions below are millimetres on the print, not screen pixels.
function addStreetRelief(m,roads,s,w,h,scale){
 const land=m.landFaces;delete m.landFaces;
 const mode=s.roadMode,amp=s.roadRelief,pitch=Math.max(1,Math.max(w,h)/210),step=Math.max(.40,Math.max(w,h)/450);
 const types={major:[13,1.65,1],secondary:[9,1.4,.85],local:[6,1.15,.70],path:[2,.90,.55]};
 const stats=m.roadProfile={mode,heightMm:amp,lines:0,segments:0,changedVertices:0,addedTriangles:0,maxOffsetMm:0,classes:{major:0,secondary:0,local:0,path:0}};
 if(mode==='off'||!amp||!roads.length||!land.length)return m;
 const bins=new Map(),nx=Math.ceil(w/pitch)+1,ny=Math.ceil(h/pitch)+1,cellX=x=>Math.min(nx-1,Math.max(0,Math.floor((x+w/2)/pitch))),cellY=y=>Math.min(ny-1,Math.max(0,Math.floor((y+h/2)/pitch)));
 for(const r of roads){if(!Object.hasOwn(types,r.kind)||r.underground||r.inactive)continue;
  const [metres,minWidth,weight]=types[r.kind],radius=Math.max(metres*scale,minWidth,step*2.2)/2,pts=r.points;let used=false;
  for(let i=1;i<pts.length;i++){
   let ax=(pts[i-1][0]-.5)*w,ay=(.5-pts[i-1][1])*h,bx=(pts[i][0]-.5)*w,by=(.5-pts[i][1])*h,dx=bx-ax,dy=by-ay;
   if(![ax,ay,bx,by,dx,dy].every(Number.isFinite))continue;
   // Parametric clipping also bounds work on long OSM ways outside the map.
   let lo=0,hi=1;for(const [a,d,l,u] of [[ax,dx,-w/2-radius,w/2+radius],[ay,dy,-h/2-radius,h/2+radius]]){
    if(!d){if(a<l||a>u){hi=-1;break;}}else{const t=(l-a)/d,q=(u-a)/d;lo=Math.max(lo,Math.min(t,q));hi=Math.min(hi,Math.max(t,q));}}
   if(lo>=hi)continue;bx=ax+hi*dx;by=ay+hi*dy;ax+=lo*dx;ay+=lo*dy;dx=bx-ax;dy=by-ay;const n=Math.ceil(Math.hypot(dx,dy)/(3*pitch));if(!n)continue;
   const xstep=dx/n,ystep=dy/n,inv=1/(xstep*xstep+ystep*ystep);
   for(let j=0;j<n;j++){const x=ax+j*xstep,y=ay+j*ystep,seg=[x,y,xstep,ystep,inv,radius,weight,r.kind==='major'||r.kind==='secondary'?6:7];
    const x0=cellX(Math.min(x,x+xstep)-radius),x1=cellX(Math.max(x,x+xstep)+radius),y0=cellY(Math.min(y,y+ystep)-radius),y1=cellY(Math.max(y,y+ystep)+radius);
    for(let row=y0;row<=y1;row++)for(let col=x0;col<=x1;col++){const k=row*nx+col;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(seg);}}
   used=true;stats.segments++;
  }if(used){stats.lines++;stats.classes[r.kind]++;}
 }
 if(!stats.lines)return m;
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
 for(let pass=0;pass<9;pass++){
  progress('Straßen und Wege verfeinern',pass+1,9);const mid=new Map();
  for(let i=0;i<faces.length;i+=3)for(let j=0;j<3;j++){
   const a=faces[i+j],b=faces[i+(j+1)%3];if(len2(a,b)<=step*step)continue;
   const k=key(a,b);if(!mid.has(k)){mid.set(k,-1);continue;}
   // Only a second eligible incident face can authorise a split. Thus shared
   // edges always have one midpoint in both faces, with no T-junctions.
   const id=cl.length;mid.set(k,id);v.push(Math.fround((v[3*a]+v[3*b])/2),Math.fround((v[3*a+1]+v[3*b+1])/2),Math.fround((v[3*a+2]+v[3*b+2])/2));cl.push(cl[a]===5&&cl[b]===5?5:0);
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
 progress('Straßenprofil in Millimetern formen',0,cl.length);
 for(let i=0;i<cl.length;i++){
  if(locked[i])continue;const x=v[3*i],y=v[3*i+1];if(Math.abs(x)>w/2||Math.abs(y)>h/2)continue;
  const list=bins.get(cellY(y)*nx+cellX(x));if(!list)continue;let best=0,kind=0;
  for(const seg of list){const [a,b,dx,dy,inv,r,weight,cls]=seg,u=x-a,z=y-b,q=Math.max(0,Math.min(1,(u*dx+z*dy)*inv)),dist2=(u-q*dx)**2+(z-q*dy)**2;if(dist2>=r*r)continue;
   const height=weight*Math.min(1,(1-Math.sqrt(dist2)/r)/.50);if(height>best){best=height;kind=cls;}}
  if(!best)continue;const at=3*i+2,old=v[at],value=mode==='engraved'?Math.max(.6,old-amp*best):old+amp*best;v[at]=Math.fround(value);cl[i]=kind;stats.changedVertices++;stats.maxOffsetMm=Math.max(stats.maxOffsetMm,Math.abs(v[at]-old));m.zmax=Math.max(m.zmax,v[at]);
 }
 const out=new Uint32Array(t.length-start*3+faces.length);let off=0;for(let i=0;i<t.length;i+=3)if(!active[i/3]){out[off++]=t[i];out[off++]=t[i+1];out[off++]=t[i+2];}out.set(faces,off);
 m.indices=out;m.vertices=new Float32Array(v);m.classes=new Uint8Array(cl);stats.addedTriangles=faces.length/3-start;return m;
}
function buildWithStreets(data,input){const s=R.cleanSettings(input),info=R.boundsInfo(data.bounds),w=s.modelWidth,h=w*info.h/info.w;
 const mesh=buildArchitecture({...data,roads:data.roads.filter(r=>r.kind==='river')},{...s,roadRelief:0});
 return addStreetRelief(mesh,data.roads,s,w,h,w/info.w);
}
