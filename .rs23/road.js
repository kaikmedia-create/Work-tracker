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
