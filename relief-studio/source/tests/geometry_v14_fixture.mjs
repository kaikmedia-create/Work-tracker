/** Deterministic synthetic intersections. These are NOT real Weinheim buildings. */
import '../public/core.js';
export function intersectionFixture(seed=1,count=100){
 const R=globalThis.RS;let r=seed;
 const rand=()=>((r=(Math.imul(r,1664525)+1013904223)>>>0)/4294967296),buildings=[];
 for(let i=0;i<count;i++){
  const x=.1+.8*rand(),y=.1+.8*rand(),w=.003+.05*rand(),h=.003+.05*rand(),a=rand()*Math.PI;
  const c=Math.cos(a),s=Math.sin(a),shape=['flat','gabled','hipped','pyramidal','skillion'][i%5];
  const p=[[-w,-h],[0,-h],[w,-h],[w,h],[0,h],[-w,h]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);
  if(i%3===0)p[1]=[p[1][0]+1e-10*(rand()-.5),p[1][1]+1e-10*(rand()-.5)];
  buildings.push({id:'synthetic/'+i,name:'Synthetisches Gebäude '+i,rings:[p],height:10+i%30,heightSource:'OSM-Höhe',tags:{building:'yes',height:String(10+i%30),'roof:shape':shape,'roof:height':'3'}});
 }
 const data={version:2,realData:false,bounds:R.boundsFor(8.68,49.548,4,4),terrain:{cols:17,rows:17,values:Array.from({length:289},(_,i)=>100+(i%17)*1.2+Math.floor(i/17)*.8),source:'SYNTHETISCHER TEST – KEINE REALEN GELÄNDEHÖHEN'},buildings,roads:[],water:[],parks:[],landmarks:[],warnings:['Synthetischer Belastungstest; keine echten Weinheimer Gebäude.']};
 const settings={...R.defaults,mode:'model',modelWidth:200,frame:4,resolution:65,terrainFactor:1,base:3,title:'Geometrie-Regressionsprüfung',subtitle:'SYNTHETISCHE GEOMETRIE · KEINE REALE STADT',autoSubtitle:false};
 return {version:3,settings,data};
}
