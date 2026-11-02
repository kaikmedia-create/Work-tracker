import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import '../public/core.js';import '../public/architecture.js';
const R=globalThis.RS;
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const circle=(x,y,r,n=24)=>Array.from({length:n+1},(_,i)=>[x+r*Math.cos(i/n*2*Math.PI),y+r*Math.sin(i/n*2*Math.PI)]);
function building(id,rings,tags){return {id,name:id,rings,tags,height:parseFloat(tags.height)||12,heightSource:tags.height?'OSM-Höhe':'Schätzwert',landmark:tags.building==='church'||tags.man_made==='tower'};}
export function scene(){return {bounds:R.boundsFor(8.6808,49.548,.6,.6),terrain:{cols:2,rows:2,values:[12,12,12,12]},water:[],parks:[],roads:[],landmarks:[],buildings:[]};}
function solid(mesh){
 assert.ok(mesh.vertices.every(Number.isFinite));let vol=0;const edges=new Map();
 for(let i=0;i<mesh.indices.length;i+=3){let pts=[];
  for(let j=0;j<3;j++){const a=mesh.indices[i+j],b=mesh.indices[i+(j+1)%3],k=a<b?a+','+b:b+','+a;const e=edges.get(k)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(k,e);pts.push([...mesh.vertices.slice(a*3,a*3+3)]);}
  const [a,b,c]=pts;vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 const bad=[...edges].filter(([k,e])=>e[0]!==2||e[1]!==0);assert.equal(bad.length,0,JSON.stringify(bad.slice(0,5)));assert.ok(vol>0);return vol;
}
const settings={resolution:65,modelWidth:200,frame:0,terrainFactor:1,base:3};
for(const shape of ['flat','gabled','hipped','pyramidal','skillion','cone','dome'])test(`closed union: ${shape} roof with exact walls`,()=>{
 const d=scene();d.buildings=[building(shape,[shape==='dome'||shape==='cone'?circle(.5,.5,.17):rect(.3,.25,.4,.5)],{building:'yes',height:'22','roof:shape':shape,'roof:height':'7'})];
 const m=R.buildMesh(d,settings);solid(m);assert.ok(m.zmax>9);assert.equal(m.kind,'architecture');
 fs.mkdirSync('reports/v12',{recursive:true});fs.writeFileSync(`reports/v12/${shape}.stl`,Buffer.from(R.stl(m)));
});
test('Courtyard stays empty and narrow tower is not lost at 65-point terrain',()=>{
 const d=scene();d.buildings=[building('courtyard',[rect(.1,.1,.35,.35),rect(.2,.2,.15,.15)],{height:'12'}),building('tower',[circle(.7,.7,.003)],{height:'30',man_made:'tower'})];
 const m=R.buildMesh(d,settings);solid(m);assert.equal(m.buildingCount,2);assert.equal(m.missed,0);assert.ok([...m.vertices].some((z,i)=>i%3===2&&z>12));
});
test('Two intersecting buildings with unequal roofs form one closed solid',()=>{
 const d=scene();d.terrain.values=[8,12,14,16];
 d.buildings=[building('a',[rect(.1,.1,.5,.45)],{height:'12','roof:shape':'gabled','roof:height':'5'}),building('b',[rect(.45,.2,.4,.6)],{height:'22','roof:shape':'hipped','roof:height':'7'})];solid(R.buildMesh(d,settings));
});
test('A mapped church tower does not remove the rest of the nave',()=>{
 const d=scene(),a=building('nave',[rect(.2,.4,.6,.2)],{building:'church',height:'15','roof:shape':'gabled','roof:height':'6'}),b=building('tower',[rect(.22,.43,.1,.14)],{'building:part':'tower',height:'30','roof:shape':'pyramidal','roof:height':'8'});
 a.partIds=['tower'];d.buildings=[a,b];const m=R.buildMesh(d,settings);solid(m);assert.equal(m.architecture.parts,1);assert.equal(m.buildingCount,2);
});
test('Clipping across model border preserves watertightness',()=>{
 const d=scene();d.buildings=[building('clip',[rect(-.2,.3,.8,.9)],{height:'12','roof:shape':'gabled','roof:height':'5'})];const m=R.buildMesh(d,{...settings,frame:4});solid(m);assert.ok([...m.vertices].filter((v,i)=>i%3===0).every(v=>Math.abs(v)<=104.00001));
});
test('Roof direction denotes slope, not ridge direction',()=>{
 const f=R.architecture.roofFrame(rect(-5,-10,10,20),{'roof:direction':'E'});assert.ok(Math.abs(f.u[0]-1)<1e-8);assert.ok(Math.abs(f.u[1])<1e-8);
});
test('Unknown roof is not invented, unsupported shapes are counted',()=>{
 const d=scene();d.buildings=[building('unknown',[rect(.2,.2,.4,.4)],{building:'church',height:'20','roof:shape':'onion'})];const m=R.buildMesh(d,settings);solid(m);assert.equal(m.architecture.unsupportedRoofs,1);assert.equal(m.architecture.roofTagged,0);
});
test('Explicit total height includes roof rather than adding it twice',()=>{
 const d=scene();d.buildings=[building('gable',[rect(.2,.2,.4,.4)],{height:'24','roof:shape':'gabled','roof:height':'7'})];const m=R.buildMesh(d,settings);assert.ok(Math.abs(m.zmax-(3+24*200/600))<.001);
});
test('Parent and parts survive OSM normalization, with linked replacement footprints',()=>{
 const b=R.boundsFor(8.68,49.54,1,1),info=R.boundsInfo(b),toGeo=r=>r.map(([u,v])=>{const p=R.unproject([info.sw[0]+u*(info.ne[0]-info.sw[0]),info.ne[1]-v*(info.ne[1]-info.sw[1])]);return {lon:p[0],lat:p[1]};});
 const d=R.parseOSM({elements:[{type:'way',id:1,tags:{building:'church'},geometry:toGeo(rect(.2,.2,.4,.4))},{type:'way',id:2,tags:{'building:part':'tower'},geometry:toGeo(rect(.25,.25,.1,.1))}]},b);
 assert.equal(d.buildings.length,2);assert.deepEqual(d.buildings[0].partIds,['way/2']);
});
test('Historic wall is rendered as a wall, not as a filled site',()=>{
 const b=R.boundsFor(8.68,49.54,1,1);const d=R.parseOSM({elements:[{type:'way',id:1,tags:{historic:'citywalls',height:'4',width:'1.5'},geometry:[{lon:8.68,lat:49.54},{lon:8.681,lat:49.54},{lon:8.681,lat:49.541}]},{type:'way',id:2,tags:{historic:'castle',name:'Castle site'},geometry:[{lon:8.679,lat:49.539},{lon:8.682,lat:49.539},{lon:8.682,lat:49.542},{lon:8.679,lat:49.539}]}]},b);
 assert.equal(d.buildings.length,2);assert.ok(d.buildings.every(b=>b.tags['rs:wall']==='yes'));assert.equal(d.landmarks.length,1);
});
test('Unmapped tower locations never generate fictional architecture',()=>{
 const d=scene();d.landmarks=[{id:'x',name:'Castle',point:[.5,.5]}];const m=R.buildMesh(d,settings);solid(m);assert.equal(m.architecture.buildings,0);assert.equal(m.zmax,3);
});
test('Point-touching footprints are regularised without a non-manifold seam',()=>{
 const d=scene();d.buildings=[building('a',[rect(.2,.2,.2,.2)],{height:'12'}),building('b',[rect(.4,.4,.2,.2)],{height:'20'})];
 const m=R.buildMesh(d,settings);solid(m);assert.equal(m.buildingCount,2);assert.ok(m.architecture.contactRepairs>=1);
});
test('Old exaggerated defaults are migrated to scale-correct building heights',()=>{
 const s=R.cleanSettings({buildingFactor:1.5,landmarkFactor:1.8,landmarkWidth:1.7});assert.equal(s.geometryVersion,12);assert.equal(s.buildingFactor,1);assert.equal(s.landmarkFactor,1);assert.equal(s.landmarkWidth,1);
});

test('Legacy 503-building project retains watertight terrain junctions',()=>{const p=R.validateProject(JSON.parse(fs.readFileSync(new URL('./fixture-model.json',import.meta.url))));const m=R.buildMesh(p.data,p.settings);solid(m);assert.equal(m.buildingCount,503);});
