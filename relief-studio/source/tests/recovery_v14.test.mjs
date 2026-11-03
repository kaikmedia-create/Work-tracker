import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
const R=globalThis.RS,bounds=R.boundsFor(8.684,49.549,1,1),opts={mode:'model',terrainRequired:false};
const store=()=>{const m=new Map();return {get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};};
const kind=o=>{const q=new URLSearchParams(o.body).get('data');return q.includes('nwr[historic]')?'pois':q.includes('way[building]')?'geometry':'relations';};
const json=()=>new Response('{"elements":[]}');
const hold=signal=>new Promise((_,reject)=>{const stop=()=>reject(new DOMException('Cancelled','AbortError'));if(signal.aborted)return stop();signal.addEventListener('abort',stop,{once:true});});
const make=(fetch,config={})=>R.createDataLoader({fetch,cache:store(),config:{sessionMs:90,headerMs:1000,poiMs:70,idleMs:100,bodyMs:1000,retryMs:1,...config}});
test('v14 resume: completed packages survive session deadline, only missing data refetched',async()=>{
 const counts={geometry:0,relations:0,pois:0},events=[];
 const l=make(async(u,o)=>{const k=kind(o);counts[k]++;return k==='relations'&&counts[k]===1?hold(o.signal):json();});
 const d=await l.loadMap(bounds,{...opts,onProgress:e=>events.push(e)});
 assert(d.realData);assert.equal(d.loadStats.resumeAttempts,1);assert.equal(counts.geometry,1);assert.equal(counts.relations,2);
 assert.equal(events.filter(e=>e.recovery).length,1);assert(d.loadStats.durationMs>=90);
});
test('v14 resume: force-refresh is disabled only for the internal continuation',async()=>{
 const counts={geometry:0,relations:0,pois:0};
 const l=make(async(u,o)=>{const k=kind(o);counts[k]++;return k==='relations'&&counts[k]===1?hold(o.signal):json();});
 await l.loadMap(bounds,{...opts,refresh:true});assert.equal(counts.geometry,1);
 await l.loadMap(bounds,{...opts,refresh:true});assert.equal(counts.geometry,2);
});
test('v14 resume: never continue an attempt with zero completed packages',async()=>{
 let starts=0;const l=make((u,o)=>hold(o.signal));
 await assert.rejects(l.loadMap(bounds,{...opts,onProgress:e=>{if(e.status==='part'&&e.done===0)starts++;}}),e=>e.code==='DEADLINE'&&e.completedPackages===0);
 assert.equal(starts,1);
});
test('v14 resume: one continuation maximum, even when user config is excessive',async()=>{
 let recoveries=0,rel=0;const l=make((u,o)=>{if(kind(o)==='relations'){rel++;return hold(o.signal);}return json();},{resumeAttempts:99});
 await assert.rejects(l.loadMap(bounds,{...opts,onProgress:e=>{if(e.recovery)recoveries++;}}),e=>e.code==='DEADLINE');
 assert.equal(recoveries,1);assert.equal(rel,2);
});
test('v14 resume: explicit cancel during recovery notice never sends more requests',async()=>{
 const c=new AbortController();let rel=0;const l=make((u,o)=>{if(kind(o)==='relations'){rel++;return hold(o.signal);}return json();});
 await assert.rejects(l.loadMap(bounds,{...opts,signal:c.signal,onProgress:e=>{if(e.recovery)c.abort();}}),e=>e.name==='AbortError');assert.equal(rel,1);
});
test('v14 resume: rate limiting never triggers automatic continuation',async()=>{
 let recovery=0;const l=make(async(u,o)=>{if(kind(o)==='relations'){await new Promise(r=>setTimeout(r,15));return new Response('Limited',{status:429,headers:{'Retry-After':'60'}});}return json();});
 await assert.rejects(l.loadMap(bounds,{...opts,onProgress:e=>{if(e.recovery)recovery++;}}),e=>e.code==='RATE_LIMIT');assert.equal(recovery,0);
});
