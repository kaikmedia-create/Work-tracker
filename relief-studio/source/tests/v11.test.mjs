import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
const R=globalThis.RS,b=R.boundsFor(-7.2568,43.5666,3.65,3.42);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cache(){const m=new Map();return {get:async k=>m.get(k),set:async(k,v)=>m.set(k,v),m};}
function classify(o){const q=new URLSearchParams(o.body).get('data')||'';return q.includes('nwr[historic]')?'pois':q.includes('way[building]')?'geometry':'relations';}
const building={type:'way',id:1,tags:{building:'yes'},geometry:[{lon:-7.257,lat:43.566},{lon:-7.2565,lat:43.566},{lon:-7.2565,lat:43.5665},{lon:-7.257,lat:43.5665},{lon:-7.257,lat:43.566}]};
const json=o=>new Response(JSON.stringify(o),{headers:{'content-type':'application/json'}});
const raw=layer=>({elements:layer==='geometry'?[building]:layer==='pois'?[{type:'node',id:2,lon:-7.257,lat:43.567,tags:{historic:'monument',name:'Test landmark'}}]:[]});
const loadOptions={mode:'poster',terrainRequired:false};
function make(fetcher,config={},storage=cache()){return R.createDataLoader({fetch:fetcher,cache:storage,config:{headerMs:200,poiMs:80,idleMs:80,bodyMs:3000,sessionMs:3000,retryMs:1,...config}});}
function held(signal){return new Promise((resolve,reject)=>{if(signal.aborted){reject(new DOMException('cancel','AbortError'));return;}signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')),{once:true});});}

test('v11 splits geometry and relations into small independent queries; compact ordered output',()=>{
 const g=R.osmQuery(b,'geometry'),r=R.osmQuery(b,'relations');
 assert(g.includes('[maxsize:134217728]')&&g.includes('[timeout:25]'));
 assert(g.includes('way[natural=coastline]'));assert(!g.includes('relation['));assert(!r.includes('way['));assert(r.includes('relation[type=multipolygon][water]'));assert(g.endsWith('out geom qt;'));
});
test('v11 loads actual network code, merges duplicate IDs and keeps POI data',async()=>{
 const events=[],l=make(async(u,o)=>json({...raw(classify(o)),osm3s:{timestamp_osm_base:'2026-11-01T00:00:00Z'}}));
 const d=await l.loadMap(b,{...loadOptions,onProgress:e=>events.push(e)});
 assert.equal(d.buildings.length,1);assert.equal(d.landmarks.length,1);assert.equal(d.loaderVersion,11);assert(events.some(e=>e.status==='part'&&e.done===2&&e.total===2));assert.equal(d.osmTimestamp,'2026-11-01T00:00:00Z');
});
test('v11 a second load uses cached packages and needs zero network calls',async()=>{
 let calls=0;const l=make(async(u,o)=>{calls++;return json(raw(classify(o)));});
 await l.loadMap(b,loadOptions);assert.equal(calls,3);await l.loadMap(b,loadOptions);assert.equal(calls,3);
});
test('v11 failed required part never yields a success map, retry resumes completed geometry',async()=>{
 const c=cache(),calls={geometry:0,relations:0,pois:0};let fail=true;
 const l=make(async(u,o)=>{const kind=classify(o);calls[kind]++;if(kind==='relations'&&fail){await sleep(20);return new Response('bad',{status:400});}return json(raw(kind));},{},c);
 await assert.rejects(l.loadMap(b,loadOptions),/400/);assert.equal(calls.geometry,1);
 fail=false;const d=await l.loadMap(b,loadOptions);assert.equal(d.buildings.length,1);assert.equal(calls.geometry,1);assert.equal(calls.relations,2);
});
test('v11 POI timeout is bounded and does not discard complete geometry',async()=>{
 let poiAborted=false;const l=make(async(u,o)=>{if(classify(o)==='pois'){o.signal.addEventListener('abort',()=>poiAborted=true);return held(o.signal);}return json(raw(classify(o)));},{poiMs:35});
 const start=performance.now(),d=await l.loadMap(b,loadOptions);assert.equal(d.buildings.length,1);assert(d.warnings.some(w=>w.includes('historische Orte')));assert(poiAborted);assert(performance.now()-start<400);
});
test('v11 missing optional POIs are retried from cached base on next load',async()=>{
 let fail=true;const calls=[];const l=make(async(u,o)=>{const kind=classify(o);calls.push(kind);return kind==='pois'&&fail?new Response('busy',{status:503}):json(raw(kind));});
 assert((await l.loadMap(b,loadOptions)).warnings.some(x=>x.includes('historische Orte')));fail=false;
 const d=await l.loadMap(b,loadOptions);assert.equal(d.landmarks.length,1);assert.equal(calls.filter(x=>x==='geometry').length,1);assert.equal(calls.filter(x=>x==='relations').length,1);assert.equal(calls.filter(x=>x==='pois').length,2);
});
test('v11 executes at most two public requests concurrently, including dense tile plans',async()=>{
 let concurrent=0,max=0;const l=make(async(u,o)=>{concurrent++;max=Math.max(max,concurrent);await sleep(8);concurrent--;return json(raw(classify(o)));});
 await l.loadMap(R.boundsFor(8.68,49.55,10,10),loadOptions);assert.equal(max,2);assert.equal(l.diagnostics().queued,0);
});
test('v11 simultaneous callers share matching requests, no duplicated downloads',async()=>{
 let calls=0;const l=make(async(u,o)=>{calls++;await sleep(8);return json(raw(classify(o)));});
 const [a,d]=await Promise.all([l.loadMap(b,loadOptions),l.loadMap(b,loadOptions)]);assert.equal(calls,3);assert.equal(a.buildings.length,d.buildings.length);
});
test('v11 cancel one shared caller does not cancel the other',async()=>{
 const l=make(async(u,o)=>{await sleep(25);if(o.signal.aborted)throw new DOMException('cancel','AbortError');return json(raw(classify(o)));});
 const a=new AbortController(),first=l.loadMap(b,{...loadOptions,signal:a.signal}),second=l.loadMap(b,loadOptions);setTimeout(()=>a.abort(),5);
 const settled=await Promise.allSettled([first,second]);assert.equal(settled[0].reason.name,'AbortError');assert.equal(settled[1].status,'fulfilled');
});
test('v11 cancellation stops active requests and queued jobs; next load can start',async()=>{
 let hold=true,calls=0;const l=make(async(u,o)=>{calls++;return hold?held(o.signal):json(raw(classify(o)));});
 const c=new AbortController(),p=l.loadMap(R.boundsFor(8,49,10,10),{...loadOptions,signal:c.signal});setTimeout(()=>c.abort(),5);
 await assert.rejects(p,e=>e.name==='AbortError');await sleep(20);assert(calls<=2);assert.equal(l.diagnostics().active,0);assert.equal(l.diagnostics().queued,0);hold=false;assert((await l.loadMap(b,loadOptions)).buildings.length===1);
});
test('v11 respects HTTP 429 Retry-After and does not rotate to evade throttling',async()=>{
 let calls=0;const l=make(async()=>{calls++;return new Response('rate limit',{status:429,headers:{'Retry-After':'45'}});});
 await assert.rejects(l.getOSMLayer(b,undefined,'geometry'),e=>e.code==='RATE_LIMIT');assert.equal(calls,1);
 await assert.rejects(l.getOSMLayer(b,undefined,'geometry'),e=>e.code==='RATE_LIMIT');assert.equal(calls,1);assert(l.diagnostics().cooldownUntil>Date.now()+40000);
});
test('v13 overload tries a current fallback endpoint and remembers it',async()=>{
 const hosts=[];const l=make(async(u,o)=>{hosts.push(u);return u.includes('ovp.dresel.systems')?new Response('busy',{status:503}):json(raw(classify(o)));});
 await l.getOSMLayer(b,undefined,'geometry');await l.getOSMLayer(b,undefined,'relations');assert.equal(hosts.length,3);assert(hosts[0].includes('ovp.dresel.systems'));assert(hosts.slice(1).every(u=>u.includes('overpass.private.coffee')));
});
test('v11 query runtime timeout splits geometry without accepting a partial remark',async()=>{
 let attempts=0;const store=cache();const l=make(async(u,o)=>{const kind=classify(o);if(kind==='geometry'&&++attempts===1)return json({elements:[building],remark:'runtime error: Query timed out'});return json(raw(kind));},{},store);
 const d=await l.loadMap(b,loadOptions);assert.equal(d.buildings.length,1);assert.equal(attempts,3);assert.equal(d.loadStats.packages,3);
 const again=await l.loadMap(b,loadOptions);assert.equal(attempts,3);assert.equal(again.buildings.length,1);
});
test('v11 incomplete relations fail rather than quietly removing water from exports',async()=>{
 const l=make(async(u,o)=>classify(o)==='relations'?json({elements:[],remark:'runtime error: Query timed out'}):json(raw(classify(o))));
 await assert.rejects(l.loadMap(b,loadOptions),e=>e.code==='QUERY_TIMEOUT');
});
test('v11 HTTP 400 is not retried or subdivided',async()=>{
 let calls=0;const l=make(async()=>{calls++;return new Response('error',{status:400});});await assert.rejects(l.getOSMLayer(b,undefined,'geometry'));assert.equal(calls,1);
});
test('v11 broken response body triggers a bounded retry, not an endless spinner',async()=>{
 let calls=0;const l=make(async(u,o)=>{calls++;if(calls===1)return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"elements":['));c.error(new TypeError('dropped'));}}));return json(raw('geometry'));});
 const d=await l.getOSMLayer(b,undefined,'geometry');assert.equal(calls,2);assert.equal(d.elements.length,1);
});
test('v11 missing Content-Length never pretends to know a percentage',async()=>{
 const events=[];await R.readJSONLimited(json(raw('geometry')),100000,100,{onActivity:e=>events.push(e)});assert(events.filter(e=>e.status==='bytes').every(e=>e.total===null));
});
test('v11 gzip Content-Length is not compared with decoded size',async()=>{
 const s=JSON.stringify(raw('geometry')),events=[];
 await R.readJSONLimited(new Response(s,{headers:{'content-encoding':'gzip','content-length':'10'}}),100000,100,{onActivity:e=>events.push(e)});assert(events.every(e=>e.total===null));assert(events.some(e=>e.received>10));
});
test('v11 byte limits apply even to the response fallback without getReader',async()=>{
 const response={headers:new Headers(),arrayBuffer:async()=>new Uint8Array(500).buffer};await assert.rejects(R.readJSONLimited(response,100,50),e=>e.code==='SIZE');
});
test('v11 abort after headers cancels a stalled stream',async()=>{
 let cancelled=false;const c=new AbortController(),response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
 const result=R.readJSONLimited(response,10000,1000,{signal:c.signal});c.abort();await assert.rejects(result,e=>e.name==='AbortError');assert(cancelled);
});
test('v11 overall deadline cancels tasks and allows explicit retry with saved packages',async()=>{
 const l=make((u,o)=>held(o.signal),{sessionMs:35,headerMs:500});await assert.rejects(l.loadMap(b,loadOptions),e=>e.code==='DEADLINE');await sleep(10);assert.equal(l.diagnostics().active,0);
});
test('v11 own-server URLs carry exact layer and poster size mode',async()=>{
 const urls=[];R.server=true;
 try{const l=make(async u=>{urls.push(u);return json({elements:[]});});await l.loadMap(b,loadOptions);assert(urls.every(u=>u.startsWith('api/map?')&&u.includes('mode=poster')));assert(urls.some(u=>u.includes('layer=geometry'))&&urls.some(u=>u.includes('layer=relations')));}finally{R.server=false;}
});
test('v11 no IDB support does not break caching within this tab',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async(u,o)=>{calls++;return json(raw(classify(o)));};
 try{const l=R.createDataLoader();await l.loadMap(b,loadOptions);await l.loadMap(b,loadOptions);assert.equal(calls,3);}finally{globalThis.fetch=old;}
});
test('v11 stalled IndexedDB open falls back rather than blocking forever',async()=>{
 const old=globalThis.indexedDB;globalThis.indexedDB={open(){return {};}};
 try{const l=R.createDataLoader({fetch:async(u,o)=>json(raw(classify(o)))});const start=performance.now();await l.loadMap(b,loadOptions);assert(performance.now()-start<1300);}finally{globalThis.indexedDB=old;}
});
