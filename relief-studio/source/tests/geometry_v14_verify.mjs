import assert from 'node:assert/strict';
export function verifySolid(mesh){
 const v=mesh.vertices,t=mesh.indices,n=v.length/3,edges=new Map(),parents=Array.from({length:n},(_,i)=>i);
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const active=new Set();let volume=0,degenerate=0;
 assert(v.every(Number.isFinite));
 for(let k=0;k<t.length;k+=3){
  const ids=[t[k],t[k+1],t[k+2]],p=ids.map(i=>[v[i*3],v[i*3+1],v[i*3+2]]);
  const [a,b,c]=p,u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
  const norm=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  if(Math.hypot(...norm)===0)degenerate++;
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  for(let j=0;j<3;j++){const x=ids[j],y=ids[(j+1)%3],key=Math.min(x,y)*n+Math.max(x,y),e=edges.get(key)||[0,0];e[0]++;e[1]+=x<y?1:-1;edges.set(key,e);parents[root(x)]=root(y);active.add(x);}
 }
 const bad=[...edges.values()].filter(e=>e[0]!==2||e[1]!==0).length,components=new Set([...active].map(root)).size;
 assert.equal(bad,0,'every edge must have two opposite incident triangles');assert.equal(components,1,'one connected printable solid');assert(volume>0,'positive signed volume');
 assert.equal(degenerate,0,'no zero-area triangles');
 return {triangles:t.length/3,vertices:n,badEdges:bad,components,volume,degenerate};
}
