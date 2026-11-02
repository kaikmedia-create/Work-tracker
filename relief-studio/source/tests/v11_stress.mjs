import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import '../public/core.js';import '../public/data.js';
const R=globalThis.RS,b=R.boundsFor(8.68,49.55,4,4),n=25000;
const objects=Array.from({length:n},(_,i)=>{const x=8.662+(i%160)*.0002,y=49.536+Math.floor(i/160)*.00015;return {type:'way',id:i+1,tags:{building:'yes','building:levels':String(i%5+1)},geometry:[{lon:x,lat:y},{lon:x+.0001,lat:y},{lon:x+.0001,lat:y+.00008},{lon:x,lat:y+.00008},{lon:x,lat:y}]};});
const payload=JSON.stringify({elements:objects}),start=performance.now(),reports=[];
for(let browser=0;browser<3;browser++){
 let calls=0,active=0,maximum=0;const store=new Map(),events=[];
 const l=R.createDataLoader({fetch:async(u,o)=>{calls++;active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,2));active--;const q=new URLSearchParams(o.body).get('data');return new Response(q.includes('way[building]')?payload:'{"elements":[]}');}});
 const cold=performance.now(),map=await l.loadMap(b,{mode:'poster',terrainRequired:false,onProgress:e=>events.push(e)});const coldMs=performance.now()-cold;
 assert.equal(map.buildings.length,n);const callCount=calls,warm=performance.now();
 for(let i=0;i<8;i++){const result=await l.loadMap(b,{mode:'poster',terrainRequired:false});assert.equal(result.buildings.length,n);}
 assert.equal(calls,callCount);assert(maximum<=2);assert.equal(l.diagnostics().active,0);
 reports.push({client:browser+1,buildings:n,payloadBytes:Buffer.byteLength(payload),coldMs:Math.round(coldMs),eightCachedLoadsMs:Math.round(performance.now()-warm),requests:calls,extraRequestsForEightReloads:calls-callCount,maximumConcurrent:maximum,progressEvents:events.length});
}
await mkdir(new URL('../reports/v11/',import.meta.url),{recursive:true});
const report={status:'pass',fixture:'synthetic, no public provider stress',totalMs:Math.round(performance.now()-start),clients:reports};
await writeFile(new URL('../reports/v11/stress.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
