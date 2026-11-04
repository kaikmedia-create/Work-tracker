from pathlib import Path

def apply(root):
 p=root/'public/architecture.js'; s=p.read_text()
 def sub(a,b):
  nonlocal s
  assert s.count(a)==1,a[:70];s=s.replace(a,b)
 sub("const shapes=['flat'","const shapes=['onion','spherical','half-hipped','saltbox','flat'")
 sub("const planes=[linear(u,2*rh/du,-2*rh*umin/du),linear(u,-2*rh/du,2*rh*umax/du)];", """// A saltbox has an offset ridge. With mapped slope direction the longer face drains toward +u.
 const left=du*(spec.shape==='saltbox'?.34:.5),right=du-left;
 const planes=[linear(u,rh/left,-rh*umin/left),linear(u,-rh/right,rh*umax/right)];
 if(spec.shape==='half-hipped'){
  const slope=rh/Math.max(EPS,Math.min(du,dv)*.5),lift=rh*.48;
  planes.push(linear(v,slope,lift-slope*vmin),linear(v,-slope,lift+slope*vmax));
 }""")
 sub("if(['gabled','hipped','pyramidal','round','gambrel','mansard'].includes(spec.shape))", "if(['gabled','half-hipped','saltbox','hipped','pyramidal','round','gambrel','mansard'].includes(spec.shape))")
 sub("sectors=24,rings=spec.shape==='dome'?6:1,out=[];", "sectors=24,rings=spec.shape==='onion'?8:['dome','spherical'].includes(spec.shape)?6:1,out=[];")
 sub("(spec.shape==='dome'?Math.sqrt(Math.max(0,1-r*r)):1-r)","(spec.shape==='onion'?[1,.69,.58,.52,.47,.42,.36,.27,0][Math.round(r*8)]:['dome','spherical'].includes(spec.shape)?Math.sqrt(Math.max(0,1-r*r)):1-r)")
 sub('function architecturePatches(data,s,terrainAt,w,h,scale){', '''// Optional neighbourhood inference. Only tagged residential peers vote. No landmarks,
// courtyards, arbitrary building=yes, mapped flat roofs, parts or synthetic training data.
function neighbourhoodRoofs(data){
 const dim=R.boundsInfo(data.bounds),cells=new Map(),types=new Set(['house','detached','semidetached_house','terrace','residential','apartments']);
 function descriptor(b){const t=b.tags||{},k=t.building;if(!types.has(k)||b.landmark||b.name||t.historic||t.amenity||t.tourism||t.heritage||t.man_made||t['building:part']||b.partIds?.length||b.detailRoof||b.rings?.length!==1)return null;
  const ring=b.rings[0],bb=R.ringBox(ring),area=Math.abs(signed(ring))*dim.w*dim.h;if(area<24||area>1200)return null;
  return {group:['house','detached','semidetached_house'].includes(k)?'house':k,x:(bb[0]+bb[2])*dim.w/2,y:(bb[1]+bb[3])*dim.h/2,area};}
 const key=(g,x,y)=>g+':'+x+':'+y;
 for(const b of data.buildings){const shape=b.tags?.['roof:shape']||b.tags?.['building:roof:shape'];if(!shape)continue;const d=descriptor(b);if(!d)continue;const k=key(d.group,Math.floor(d.x/200),Math.floor(d.y/200));if(!cells.has(k))cells.set(k,[]);cells.get(k).push({...d,shape,id:b.id});}
 return b=>{const d=descriptor(b);if(!d||b.tags?.['roof:shape']||b.tags?.['building:roof:shape']||String(b.tags?.['roof:levels'])==='0'||String(b.tags?.['roof:height'])==='0')return null;
  const xx=Math.floor(d.x/200),yy=Math.floor(d.y/200),near=[];for(let i=xx-1;i<=xx+1;i++)for(let j=yy-1;j<=yy+1;j++)for(const a of cells.get(key(d.group,i,j))||[]){const dist=Math.hypot(a.x-d.x,a.y-d.y);if(a.id!==b.id&&a.area/d.area>=.5&&a.area/d.area<=2&&dist<=200)near.push([dist,a]);}
  near.sort((a,b)=>a[0]-b[0]);const ids=new Set(),votes=new Map();for(const [,a] of near){if(ids.has(a.id))continue;ids.add(a.id);votes.set(a.shape,1+(votes.get(a.shape)||0));if(ids.size===8)break;}
  if(ids.size<4)return null;for(const [shape,n] of votes)if(['gabled','hipped'].includes(shape)&&n/ids.size>=.8)return shape;return null;};
}
function architecturePatches(data,s,terrainAt,w,h,scale){'''.replace('signed(ring)','area2(ring)/2'))
 # Adapt to the existing polygon area helper rather than copying its convention.
 if 'function area2(' not in s and 'const area2=' not in s:
  s=s.replace('Math.abs(area2(ring)/2)', 'Math.abs(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-p[1]*q[0];},0))/2')
 sub('const lookupRoof=roofLookup(data);','const lookupRoof=roofLookup(data),localShape=s.architectureMode===\'context\'?neighbourhoodRoofs(data):()=>null;stats.contextRoofs=0;stats.underground=0;')
 sub('if(!b.rings?.length)continue;',"if(!b.rings?.length)continue;\n  if(tag.location==='underground' && !(Number(tag['building:levels'])>0)){stats.underground++;continue;}")
 sub('const cutters=decompose(part.rings',"if(part.tags?.location==='underground'&&!(Number(part.tags['building:levels'])>0))continue;\n   const cutters=decompose(part.rings")
 sub('const item=!reference&&lookupRoof(b);const parts=',"const item=!reference&&lookupRoof(b);const inferred=!reference&&!item&&spec.shape==='flat'&&!spec.unsupported&&localShape(b);if(inferred){spec.shape=inferred;spec.roof=NaN;spec.estimatedRoof=true;stats.contextRoofs++;}const parts=")
 sub("else if(!tag['roof:shape']", "else if(!inferred&&!tag['roof:shape']")
 sub("if(spec.shape!=='flat')stats.roofTagged++;","if(spec.shape!=='flat'&&!inferred)stats.roofTagged++;")
 sub("if(spec.estimatedRoof&&spec.shape!=='flat')stats.roofEstimated++;","if(!inferred&&spec.estimatedRoof&&spec.shape!=='flat')stats.roofEstimated++;")
 sub("/(2*scale);spec.estimatedRoof=false;}","/((spec.shape==='skillion'?1:2)*scale);spec.estimatedRoof=false;}")
 sub('architecture:{roofLookup','architecture:{neighbourhoodRoofs,roofLookup');p.write_text(s)
 p=root/'public/core.js';s=p.read_text();sub("terrainSmooth:'soft',streetCurve:","architectureMode:'context',terrainSmooth:'soft',streetCurve:");sub("if(!['off','soft','strong'].includes(s.terrainSmooth))","if(!['context','mapped'].includes(s.architectureMode))s.architectureMode='context';\n if(!['off','soft','strong'].includes(s.terrainSmooth))");p.write_text(s)
 p=root/'tests/architecture_v12.test.mjs';s=p.read_text();sub("'roof:shape':'onion'","'roof:shape':'unsupported-test-value'");p.write_text(s)
