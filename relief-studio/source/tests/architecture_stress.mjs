/* Deterministic synthetic city: no requests to public map services. */
import fs from 'node:fs';
import '../public/core.js';import '../public/architecture.js';
const R=globalThis.RS,report=[];
function rectangle(x,y,w,h,angle){const c=Math.cos(angle),s=Math.sin(angle);return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);}
for(const count of [250,1000,3500]){
 const columns=Math.ceil(Math.sqrt(count)),buildings=[];
 for(let i=0;i<count;i++){const x=(i%columns+.5)/columns,y=(Math.floor(i/columns)+.5)/columns;
 buildings.push({id:'stress/'+i,name:'',rings:[rectangle(x,y,.52/columns,.38/columns,((i*31)%180)*Math.PI/180)],height:10+i%15,heightSource:'OSM-Höhe',tags:{building:'yes',height:String(10+i%15),'roof:shape':i%3?'gabled':'hipped','roof:height':'3'}});}
 const data={bounds:R.boundsFor(8.68,49.548,3.2,3.2),terrain:{cols:17,rows:17,values:Array.from({length:289},(_,i)=>100+(i%17)*.8+Math.floor(i/17)*1.2)},buildings,roads:[],water:[],parks:[],landmarks:[]};
 const started=performance.now(),mesh=R.buildMesh(data,{modelWidth:200,frame:4,resolution:161}),ms=Math.round(performance.now()-started),edges=new Map(),n=mesh.vertices.length/3;
 for(let i=0;i<mesh.indices.length;i+=3)for(let j=0;j<3;j++){const a=mesh.indices[i+j],b=mesh.indices[i+(j+1)%3],key=Math.min(a,b)*n+Math.max(a,b);const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}
 const bad=[...edges.values()].filter(e=>e[0]!==2||e[1]!==0).length;
 if(bad||mesh.buildingCount!==count)throw Error('Failed architecture stress test');
 const row={syntheticBuildings:count,elapsedMs:ms,triangles:mesh.indices.length/3,vertices:n,invalidEdges:bad,contactRepairs:mesh.architecture.contactRepairs};report.push(row);console.log(row);
}
fs.mkdirSync('reports/v12',{recursive:true});fs.writeFileSync('reports/v12/stress.json',JSON.stringify(report,null,2));
