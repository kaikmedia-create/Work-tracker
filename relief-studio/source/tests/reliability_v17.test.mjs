import test from 'node:test';import assert from 'node:assert/strict';
import '../public/core.js';import '../public/data.js';
const R=globalThis.RS,bounds=R.boundsFor(8.682,49.549,1,1);
const raw={elements:[]},json=()=>new Response(JSON.stringify(raw));
const store=()=>{const m=new Map();return {get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};};
const key=(b,l)=>'osm12:'+l+':'+b.map(x=>x.toFixed(6)).join(',');
const make=(fetch,cache=store(),cfg={})=>R.createDataLoader({fetch,cache,config:{headerMs:80,poiMs:100,idleMs:100,bodyMs:500,sessionMs:1000,retryMs:1,...cfg}});
const hold=signal=>new Promise((_,reject)=>{const stop=()=>reject(new DOMException('cancelled','AbortError'));if(signal.aborted)return stop();signal.addEventListener('abort',stop,{once:true});});
const opts={mode:'model',terrainRequired:false};
const tick=()=>new Promise(setImmediate);
test('v17 complete cached parent takes precedence over obsolete subdivision plans',async()=>{
 const cache=store();for(const layer of ['geometry','relations','pois'])await cache.set(key(bounds,layer),raw);
 await cache.set('plan:'+key(bounds,'geometry'),R.splitBounds(bounds));
 let calls=0;const l=make(async()=>{calls++;return new Response('bad',{status:400});},cache);
 const data=await l.loadMap(bounds,opts);assert(data.realData);assert.equal(calls,0);assert.equal(data.loadStats.requests,0);
});
test('v17 cached packages do not consume the actual network request budget',async()=>{
 const cache=store();for(const layer of ['geometry','pois'])await cache.set(key(bounds,layer),raw);
 let calls=0;const l=make(async()=>{calls++;return json();},cache,{maxRequests:1});
 const data=await l.loadMap(bounds,opts);assert(data.realData);assert.equal(calls,1);assert.equal(data.loadStats.requests,1);
});
test('v17 failed provider attempts each count against the network request budget',async()=>{
 let calls=0;const l=make(async()=>{calls++;return new Response('busy',{status:503});},store(),{maxRequests:1});
 await assert.rejects(l.getOSMLayer(bounds,undefined,'geometry',undefined,{requests:0}),e=>e.code==='BUDGET');assert.equal(calls,1);
});
test('v17 queued requests recheck rate limits when they actually obtain a slot',async()=>{
 let calls=0;const l=make(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return new Response('limited',{status:429,headers:{'Retry-After':'45'}});});
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>l.getOSMLayer(R.boundsFor(8.682+i*.001,49.549,1,1),undefined,'geometry')));
 assert(results.every(r=>r.status==='rejected'&&r.reason.code==='RATE_LIMIT'));assert.equal(calls,2);await tick();assert.equal(l.diagnostics().queued,0);
});
test('v17 invalid cached response is not mistaken for a complete data package',async()=>{
 const cache=store();await cache.set(key(bounds,'geometry'),{remark:'partial'});let calls=0;
 const l=make(async()=>{calls++;return json();},cache);const result=await l.getOSMLayer(bounds,undefined,'geometry');
 assert.deepEqual(result,raw);assert.equal(calls,1);
});
test('v17 North Africa never uses the Europe-only extract',async()=>{
 for(const [lon,lat] of [[10.18,36.8],[-5.81,35.77],[3.06,36.75],[-74,40.7],[151.2,-33.8]]){
  const calls=[],l=make(async u=>{calls.push(u);return json();});await l.getOSMLayer(R.boundsFor(lon,lat,1,1),undefined,'geometry');
  assert(calls.every(u=>!u.includes('dresel.systems')),String([lon,lat]));
 }
});
test('v17 Weinheim and Foz still use the eligible independent Europe provider',async()=>{
 for(const [lon,lat] of [[8.682,49.549],[-7.2568,43.5666]]){
  const calls=[],l=make(async u=>{calls.push(u);return json();});await l.getOSMLayer(R.boundsFor(lon,lat,1,1),undefined,'geometry');assert(calls[0].includes('dresel.systems'));
 }
});
test('v17 fallback allows a valid 23-second response instead of cancelling at 19 seconds',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,result,failure;
 const l=R.createDataLoader({cache:store(),config:{retryMs:1},fetch:async(u,o)=>{
  if(++calls===1)return new Response('busy',{status:503});
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(json()),23000);o.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('aborted','AbortError'));},{once:true});});
 }});
 const p=l.getOSMLayer(bounds,undefined,'geometry').then(v=>result=v,e=>failure=e);
 for(let i=0;i<30&&!result&&!failure;i++){await tick();t.mock.timers.tick(1000);await tick();}
 assert.ifError(failure);assert(result,'response must arrive without a premature fallback timeout');await p;assert.equal(calls,2);
});
test('v17 terrain failure cancels waiting OSM requests immediately rather than waiting for session deadline',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('missing tile',{status:404}));let aborted=0;
 const l=make((u,o)=>{o.signal.addEventListener('abort',()=>aborted++);return hold(o.signal);},store(),{headerMs:10000,sessionMs:10000});
 const start=Date.now();await assert.rejects(l.loadMap(bounds,{mode:'model',terrainRequired:true}),e=>e.code==='TERRAIN'&&e.diagnostics.status===404);
 assert(Date.now()-start<1000);await tick();assert.equal(l.diagnostics().active,0);
});
test('v17 cancelled requests leave no queue and allow a clean immediate retry',async()=>{
 let fail=true;const l=make((u,o)=>fail?hold(o.signal):json());const c=new AbortController();
 const p=l.loadMap(bounds,{...opts,signal:c.signal});setTimeout(()=>c.abort(),10);
 await assert.rejects(p,e=>e.name==='AbortError');await tick();fail=false;
 const data=await l.loadMap(bounds,opts);assert(data.realData);assert.equal(l.diagnostics().queued,0);
});
