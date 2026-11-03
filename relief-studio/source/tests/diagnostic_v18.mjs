// Private fixture stays local. Usage: RELIEF_DIAG_FIXTURE=/path/to/report.json npm run test:diagnostic
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import '../public/core.js';import '../public/architecture.js';
import {verifySolid} from './geometry_v14_verify.mjs';
const file=process.env.RELIEF_DIAG_FIXTURE;if(!file)throw Error('Set RELIEF_DIAG_FIXTURE to a saved diagnostic containing map data.');
const raw=fs.readFileSync(file),p=JSON.parse(raw);if(!p.data?.buildings||!p.data?.terrain)throw Error('Diagnostic has no complete map data.');
const out=process.env.RELIEF_DIAG_OUT||new URL('../reports/v18/private/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const widths=(process.env.RELIEF_TEST_WIDTHS||String(p.settings.modelWidth||200)).split(',').map(Number),results=[];
for(const modelWidth of widths){
 const start=performance.now(),mesh=RS.buildMesh(p.data,{...p.settings,modelWidth}),checked=verifySolid(mesh);assert.equal(mesh.missed,0);
 const result={inputSHA256:createHash('sha256').update(raw).digest('hex'),modelWidth,inputBuildings:p.data.buildings.length,outputBuildings:mesh.buildingCount,...checked,architecture:mesh.architecture,milliseconds:Math.round(performance.now()-start)};
 results.push(result);console.log(JSON.stringify(result));
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
 if(process.env.RELIEF_WRITE_EXPORTS==='1'){fs.writeFileSync(path.join(out,'model-'+modelWidth+'mm.stl'),Buffer.from(RS.stl(mesh)));fs.writeFileSync(path.join(out,'model-'+modelWidth+'mm.3mf'),Buffer.from(await RS.model3mf(mesh,p.settings.title||'Relief').arrayBuffer()));}
}
