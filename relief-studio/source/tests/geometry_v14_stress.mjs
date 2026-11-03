/** Deterministic numerical stress test. All city geometry is synthetic. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../public/core.js';import '../public/architecture.js';
import {intersectionFixture} from './geometry_v14_fixture.mjs';
import {verifySolid} from './geometry_v14_verify.mjs';
const count=Number(process.env.RELIEF_STRESS_CASES||100);
if(!Number.isInteger(count)||count<1||count>1000)throw Error('RELIEF_STRESS_CASES must be 1..1000');
const results=[];
for(let seed=1;seed<=count;seed++){
 const project=intersectionFixture(seed),start=performance.now();
 const mesh=RS.buildMesh(project.data,project.settings),solid=verifySolid(mesh);
 assert.equal(mesh.geometryKernelVersion,15);assert.equal(mesh.buildingCount,100);assert.equal(mesh.missed,0);
 assert.equal(mesh.architecture.omitted,0);assert(mesh.architecture.repairPasses<=4);
 const item={seed,realData:false,...solid,milliseconds:Math.round(performance.now()-start),architecture:mesh.architecture};
 results.push(item);console.log(JSON.stringify(item));
}
if(process.env.RELIEF_STRESS_REPORT)fs.writeFileSync(process.env.RELIEF_STRESS_REPORT,JSON.stringify({cases:results.length,passed:results.length,realData:false,results},null,2));
console.log('PASS '+results.length+'/'+count+' synthetic geometry cases');
