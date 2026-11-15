import test from 'node:test';import assert from 'node:assert/strict';
import '../public/core.js';import '../public/architecture.js';
import {verifySolid} from './geometry_v14_verify.mjs';
const face=poly=>({poly,plane:[0,0,2],kind:1});
function adjacent(gap){return [face([[-1,-1],[0,-1],[0,1],[-1,1]]),face([[gap,-1],[1,-1],[1,1],[gap,1]])];}
test('v18 microscopic unmatched XY endpoints are rewelded, not covered with repeated roof patches',()=>{
 const stats={},mesh=RS.architecture.stitchSurface(adjacent(3.4e-7),2,2,stats);
 const checked=verifySolid(mesh);assert.equal(stats.xySeamWelds,2);assert(stats.maxXYSeamShift<=1e-5);assert(Math.abs(checked.volume-8)<1e-6);
});
test('v18 local seam tolerance never closes a larger intentional gap',()=>{
 assert.throws(()=>RS.architecture.stitchSurface(adjacent(2e-5),2,2,{}),e=>Array.isArray(e.contacts)&&e.contacts.length>0);
});
test('v18 ordinary shared edges require no tolerance repair',()=>{
 const stats={};verifySolid(RS.architecture.stitchSurface(adjacent(0),2,2,stats));assert.equal(stats.xySeamWelds,0);assert.equal(stats.maxXYSeamShift,0);
});
test('v18 more than 100 point contacts form a valid solid without dropping any building',()=>{
 const buildings=[];let id=1;
 for(let j=0;j<10;j++)for(let i=0;i<11;i++){
  const x=.03+i*.085,y=.03+j*.094,s=.026;
  for(const [a,b] of [[x,y],[x+s,y+s]])buildings.push({id:String(id++),rings:[[[a,b],[a+s,b],[a+s,b+s],[a,b+s],[a,b]]],tags:{building:'yes',height:'9'},height:9});
 }
 const data={bounds:RS.boundsFor(8.68,49.55,1,1),buildings,roads:[],water:[],parks:[],landmarks:[],terrain:{cols:17,rows:17,values:Array(289).fill(100)}};
 const mesh=RS.buildMesh(data,{modelWidth:200,resolution:65,frame:0});
 verifySolid(mesh);assert.equal(mesh.buildingCount,220);assert.equal(mesh.missed,0);
 assert(mesh.architecture.contactRepairs>100);assert(mesh.architecture.contactRepairs<=mesh.architecture.repairLimit);
 assert(mesh.architecture.repairLimit<=2048);assert(mesh.architecture.repairPasses<=4);assert.equal(mesh.geometryKernelVersion,18);
});

function bergenSeamCube(center=[-1,-1,2]){return {vertices:Float32Array.from([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,2],[1,-1,2],[1,1,2],[-1,1,2],center].flat()),indices:Uint32Array.from([0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,8,4,5,8,5,6,8,6,7,8,7,4])};}
test('Bergen zero-area roof fan is repaired within 0.12 micrometres and remains watertight',()=>{
 const mesh=bergenSeamCube(),before=mesh.vertices.slice();
 assert.throws(()=>verifySolid(mesh),/zero-area triangles/);
 const report=RS.architecture.repairRoundedZeroFaces(mesh,2,2);
 assert.equal(report.fixed,2);assert.equal(report.remaining,0);assert(report.vertexNudges>0);
 assert(report.maxNudgeMm<=.00012001);for(let i=0;i<mesh.vertices.length;i++){
  assert(Math.abs(mesh.vertices[i]-before[i])<=.00012001);
  if(i%3!==2)assert(Math.abs(mesh.vertices[i])<=1);
 }
 assert(Math.abs(verifySolid(mesh).volume-8)<.001);
});
test('Bergen geometry repair leaves valid roofs byte-identical',()=>{
 const mesh=bergenSeamCube([0,0,2]),before=mesh.vertices.slice();
 const report=RS.architecture.repairRoundedZeroFaces(mesh,2,2);
 assert.equal(report.fixed,0);assert.equal(report.remaining,0);
 assert.deepEqual(mesh.vertices,before);verifySolid(mesh);
});
test('Bergen geometry repair never caps a genuinely missing triangle',()=>{
 const mesh=bergenSeamCube();mesh.indices=mesh.indices.slice(0,-3);
 RS.architecture.repairRoundedZeroFaces(mesh,2,2);
 assert.throws(()=>verifySolid(mesh),/every edge must have two opposite incident triangles/);
});
