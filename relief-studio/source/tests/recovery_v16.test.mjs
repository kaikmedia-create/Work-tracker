import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
const R=globalThis.RS;
const weinheim=R.boundsFor(8.682,49.549037,2.027,1.901);
const outside=R.boundsFor(-74.0,40.7,1.2,1.2);
const db=()=>{const m=new Map();return {get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};};
const json=o=>new Response(JSON.stringify(o),{headers:{'content-type':'application/json'}});
const loader=(fetch,cache=db(),cfg={})=>R.createDataLoader({fetch,cache,config:{headerMs:24,poiMs:45,idleMs:100,bodyMs:1000,sessionMs:5000,retryMs:1,maxRequests:64,...cfg}});
const still=signal=>new Promise((_,reject)=>{const cancel=()=>reject(new DOMException('cancel','AbortError'));if(signal.aborted)return cancel();signal.addEventListener('abort',cancel,{once:true});});
test('v16 real Weinheim bounds use independent Europe server before formerly stalled public hosts',async()=>{
 const hosts=[];const l=loader(async u=>{hosts.push(u);return json({elements:[]});});
 await l.getOSMLayer(weinheim,undefined,'geometry');
 assert.equal(hosts.length,1);assert.equal(new URL(hosts[0]).hostname,'ovp.dresel.systems');
});
test('v16 outside Europe never sends data to the Europe-only server',async()=>{
 const hosts=[];const l=loader(async u=>{hosts.push(u);return json({elements:[]});});
 await l.getOSMLayer(outside,undefined,'geometry');
 assert.equal(hosts.length,1);assert.equal(new URL(hosts[0]).hostname,'overpass.private.coffee');
});
test('v16 a Europe failure rotates to a global provider and shares successful preference',async()=>{
 const hosts=[];const l=loader(async u=>{hosts.push(u);return u.includes('dresel.systems')?new Response('timeout',{status:504}):json({elements:[]});});
 await l.getOSMLayer(weinheim,undefined,'geometry');await l.getOSMLayer(weinheim,undefined,'relations');
 assert.deepEqual(hosts.map(u=>new URL(u).hostname),['ovp.dresel.systems','overpass.private.coffee','overpass.private.coffee']);
});
test('v16 an HTTP 429 is not evaded by switching hosts',async()=>{
 const hosts=[];const l=loader(async u=>{hosts.push(u);return new Response('rate',{status:429,headers:{'Retry-After':'60'}});});
 await assert.rejects(l.getOSMLayer(weinheim,undefined,'geometry'),e=>e.code==='RATE_LIMIT');
 assert.equal(hosts.length,1);
});
test('v16 all four unreachable providers report actionable layer and host diagnostics rather than an empty map',async()=>{
 const hosts=[];const l=loader((u,o)=>{hosts.push(u);return still(o.signal);},{get:async()=>null,set:async()=>{}},{headerMs:12});
 await assert.rejects(l.getOSMLayer(weinheim,undefined,'relations'),e=>{
  assert.equal(e.code,'HEADER_TIMEOUT');assert.equal(e.diagnostics.layer,'relations');
  assert.equal(e.diagnostics.attemptedProviders.length,4);
  assert.deepEqual([...new Set(e.diagnostics.attemptedProviders.map(x=>x.service))],['ovp.dresel.systems','overpass.private.coffee','maps.mail.ru','overpass-api.de']);
  assert.deepEqual(e.diagnostics.bounds,weinheim);return true;
 });
 assert.equal(hosts.length,4);
});
test('v16 already-cached Weinheim geometry stays saved; only its missing relations package is fetched',async()=>{
 const cache=db(),key='osm12:geometry:'+weinheim.map(x=>x.toFixed(6)).join(',');
 await cache.set(key,{elements:[{type:'way',id:17,tags:{building:'yes'},geometry:[{lat:49.549,lon:8.682},{lat:49.549,lon:8.6821},{lat:49.5491,lon:8.6821},{lat:49.5491,lon:8.682},{lat:49.549,lon:8.682}]}]});
 const calls=[];const l=loader((u,o)=>{calls.push(new URLSearchParams(o.body).get('data'));return json({elements:[]});},cache);
 const data=await l.loadMap(weinheim,{mode:'model',terrainRequired:false});
 assert(data.realData);assert.equal(data.loadStats.packages,2);
 assert(calls.every(q=>!q.includes('way[building]')),'cached compulsory geometry must never be fetched again');
 assert(data.buildings.length>=1);
});
