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
