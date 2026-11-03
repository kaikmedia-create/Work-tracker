import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import '../public/core.js';import '../public/architecture.js';
import {intersectionFixture} from './geometry_v14_fixture.mjs';
const R=globalThis.RS;
import {verifySolid} from './geometry_v14_verify.mjs';
test('clipping cannot extrapolate outside either input segment',()=>{
 const poly=[[1,0],[-9e-9,1],[-11e-9,2],[-1,0]],out=R.architecture.half(poly,[1,0,0]);
 assert(out.length>=3);for(const [x,y] of out){assert(x>=-1&&x<=1);assert(y>=0&&y<=2,'intersection left original polygon');}
});
test('clipping classification is invariant under line scaling',()=>{
 const p=[[-1,-1],[1,-1],[1,1],[-1,1]],a=R.architecture.half(p,[1,2,.2]);
 for(const factor of [1e-10,1e-5,1e5,1e10]){const b=R.architecture.half(p,[factor,2*factor,.2*factor]);assert.equal(a.length,b.length);a.forEach((v,i)=>v.forEach((c,j)=>assert(Math.abs(c-b[i][j])<1e-12)));}
});
for(const seed of [1,6,16,22,31,50,85])test('overlapping roof regression, synthetic seed '+seed,async()=>{
 const p=intersectionFixture(seed),m=R.buildMesh(p.data,p.settings),stats=verifySolid(m);
 assert.equal(m.buildingCount,100);assert.equal(m.missed,0);assert(m.architecture.repairPasses<=4);
 if(process.env.RELIEF_V14_EXPORT_DIR&&[1,31,85].includes(seed)){
  const out=process.env.RELIEF_V14_EXPORT_DIR;fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,`synthetic-${seed}.stl`),Buffer.from(R.stl(m)));
  fs.writeFileSync(path.join(out,`synthetic-${seed}.3mf`),Buffer.from(await R.model3mf(m,'Synthetic numerical regression').arrayBuffer()));
  fs.writeFileSync(path.join(out,`synthetic-${seed}.relief.json`),JSON.stringify(p));
  fs.writeFileSync(path.join(out,`synthetic-${seed}.checks.json`),JSON.stringify({...stats,architecture:m.architecture,realData:false},null,2));
 }
});

test('3MF decimal coordinates retain every Float32 vertex on round-trip',async()=>{
 const values=new Float32Array([1.000000119,1.000000238,1e-8,-1e-8,125.00000763,-125.00000763,.000000512345,199.9999847,3.123456789]);
 const bytes=Buffer.from(await R.model3mf({vertices:values,indices:new Uint32Array([0,1,2])},'precision').arrayBuffer());
 let offset=0,xml='';while(bytes.readUInt32LE(offset)===0x04034b50){
  const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extra;
  if(name==='3D/3dmodel.model')xml=bytes.subarray(start,start+size).toString();offset=start+size;
 }
 assert(xml.includes('<vertices>'));
 const recovered=new Float32Array([...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].flatMap(x=>x.slice(1).map(Number)));
 assert.deepEqual(recovered,values,'3MF must not merge distinct sub-micron coordinates');
});
