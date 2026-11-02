import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
const R=globalThis.RS,bounds=R.boundsFor(8.67,49.55,3,3),opts={mode:'model',terrainRequired:false};
const json=o=>new Response(JSON.stringify(o),{headers:{'content-type':'application/json'}});
const db=()=>{const m=new Map();return {get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};};
const make=(fetch,config={})=>R.createDataLoader({fetch,cache:db(),config:{headerMs:25,poiMs:80,idleMs:100,bodyMs:1000,sessionMs:2500,retryMs:1,...config}});
const classify=o=>{const q=new URLSearchParams(o.body).get('data')||'';return q.includes('nwr[historic]')?'pois':q.includes('way[building]')?'geometry':'relations';};
const span=o=>{const q=new URLSearchParams(o.body).get('data'),b=q.match(/\[bbox:([^\]]+)\]/)[1].split(',').map(Number);return Math.max(b[2]-b[0],b[3]-b[1]);};
const held=signal=>new Promise((_,reject)=>{const cancel=()=>reject(new DOMException('cancel','AbortError'));if(signal.aborted)return cancel();signal.addEventListener('abort',cancel,{once:true});});
test('v13 header timeout subdivides required 3D geometry',async()=>{
 let large=0,small=0;const loader=make((u,o)=>{if(classify(o)==='geometry'&&span(o)>.025){large++;return held(o.signal);}if(classify(o)==='geometry')small++;return json({elements:[]});});
 const map=await loader.loadMap(bounds,opts);assert(map.realData&&large>0&&small>0&&map.loadStats.packages>=3);
});
test('v13 header timeout also subdivides mandatory relations',async()=>{
 let large=0,small=0;const loader=make((u,o)=>{if(classify(o)==='relations'&&span(o)>.025){large++;return held(o.signal);}if(classify(o)==='relations')small++;return json({elements:[]});});
 const map=await loader.loadMap(bounds,opts);assert(map.realData&&large>0&&small>0);
});
test('v13 completed geometry is reused after a relations error',async()=>{
 let fail=true,calls=0;const loader=make(async(u,o)=>{if(classify(o)==='geometry')calls++;if(classify(o)==='relations'&&fail){await new Promise(r=>setTimeout(r,50));return new Response('bad',{status:400});}return json({elements:[]});},{headerMs:120});
 const poster={mode:'poster',terrainRequired:false};
 await assert.rejects(loader.loadMap(bounds,poster),/400/);const previous=calls;fail=false;
 const map=await loader.loadMap(bounds,poster);assert(map.realData);assert.equal(calls,previous);
});
test('v13 HTTP 429 suppresses fallbacks and honors Retry-After',async()=>{
 let calls=0;const loader=make(async()=>{calls++;return new Response('busy',{status:429,headers:{'Retry-After':'45'}});});
 await assert.rejects(loader.getOSMLayer(bounds,undefined,'geometry'),e=>e.code==='RATE_LIMIT');
 await assert.rejects(loader.getOSMLayer(bounds,undefined,'geometry'),e=>e.code==='RATE_LIMIT');
 assert.equal(calls,1);assert(loader.diagnostics().cooldownUntil>Date.now()+40000);
});
test('v13 all services stalled cannot produce a false success',async()=>{
 const loader=make((u,o)=>held(o.signal),{sessionMs:180});
 await assert.rejects(loader.loadMap(bounds,opts),e=>e.code==='DEADLINE');
 await new Promise(r=>setTimeout(r,20));assert.equal(loader.diagnostics().active,0);
});
test('v13 uses current Overpass alternative after upstream HTTP 503',async()=>{
 const hosts=[],loader=make((u,o)=>{hosts.push(u);return u.includes('overpass.private.coffee')?new Response('busy',{status:503}):json({elements:[]});});
 await loader.getOSMLayer(bounds,undefined,'geometry');
 assert(hosts[0].includes('overpass.private.coffee')&&hosts[1].includes('maps.mail.ru'));
});
