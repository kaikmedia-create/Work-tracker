// Supply the private user fixture locally; never commit or upload it.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import '../public/core.js';import '../public/architecture.js';
import {verifySolid} from './geometry_v14_verify.mjs';
const input=process.env.RELIEF_DIAG_FIXTURE;if(!input)throw Error('Set RELIEF_DIAG_FIXTURE to the saved diagnostic JSON.');
const p=JSON.parse(fs.readFileSync(input)),out=process.env.RELIEF_DIAG_OUT||new URL('../reports/v15/user-exports/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const results=[];
for(const modelWidth of [200,100,300]){
 const settings={...p.settings,modelWidth},start=performance.now();
 try{
  const m=RS.buildMesh(p.data,settings),checks=verifySolid(m);assert.equal(m.buildingCount,p.data.buildings.length);assert.equal(m.missed,0);
  const r={modelWidth,milliseconds:Math.round(performance.now()-start),...checks,architecture:m.architecture};results.push(r);console.log(JSON.stringify(r));
  if(modelWidth===200){
   fs.writeFileSync(path.join(out,'Weinheim-200mm.stl'),Buffer.from(RS.stl(m)));
   fs.writeFileSync(path.join(out,'Weinheim-200mm.3mf'),Buffer.from(await RS.model3mf(m,'Weinheim').arrayBuffer()));
  }
 }catch(e){results.push({modelWidth,failed:true,error:e.message});console.error('FAILED',modelWidth,e.message);process.exitCode=1;}
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
}
