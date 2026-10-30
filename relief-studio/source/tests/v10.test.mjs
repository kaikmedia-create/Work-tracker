import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
const R=globalThis.RS;
const bbox=R.boundsFor(-7.2568,43.5666,3.65,3.42);
function responseFor(obj,{chunkSize=30,delay=1,contentLength=false}={}){
 const payload=new TextEncoder().encode(JSON.stringify(obj));
 let index=0;
 const stream=new ReadableStream({async pull(controller){if(delay)await new Promise(res=>setTimeout(res,delay));if(index>=payload.length){controller.close();return;}controller.enqueue(payload.slice(index,index+chunkSize));index+=chunkSize;}});
 return new Response(stream,{status:200,headers:contentLength?{'content-length':String(payload.length)}:{}});
}
const square=(x,y)=>[{lon:x,lat:y},{lon:x+.0005,lat:y},{lon:x+.0005,lat:y+.0005},{lon:x,lat:y+.0005},{lon:x,lat:y}];
const rawBase={elements:[{type:'way',id:10,tags:{building:'yes','building:levels':'2'},geometry:square(-7.256,43.566)},{type:'way',id:11,tags:{highway:'primary',name:'Rua Nova'},geometry:square(-7.257,43.565).slice(0,3)}]};
const rawPOI={elements:[{type:'node',id:20,lon:-7.255,lat:43.568,tags:{historic:'monument',name:'Test Monument'}},{type:'way',id:21,center:{lon:-7.258,lat:43.569},tags:{historic:'archaeological_site',name:'Castro antigo'}}]};
test('OSM is split into geometry and small center-only historic POIs',()=>{
 const base=R.osmQuery(bbox),poi=R.poiQuery(bbox);
 assert(base.includes('way[building]')&&base.includes('way[natural=coastline]'));
 assert(!base.includes('nwr[historic][name]'));
 assert(poi.includes('nwr[historic][name]')&&poi.includes('out center'));
});
test('stream reports measured bytes and known content length, never a guessed percentage',async()=>{
 const statuses=[];
 const payload={elements:[{id:5,type:'node'}]};
 const result=await R.readJSONLimited(responseFor(payload,{chunkSize:11,contentLength:true}),5000,1000,{onActivity:e=>statuses.push(e)});
 assert.equal(result.elements.length,1);
 assert(statuses.some(x=>x.status==='bytes'&&x.received>0&&x.total>0));
 assert.equal(statuses.findLast(x=>x.status==='bytes').received,JSON.stringify(payload).length);
});
test('stream lasts longer than inactivity limit only if real chunks continue',async()=>{
 const statuses=[];
 const payload={elements:Array.from({length:12},(_,i)=>({id:i}))};
 const started=Date.now();
 const output=await R.readJSONLimited(responseFor(payload,{delay:14,chunkSize:12}),10000,45,{onActivity:e=>statuses.push(e)});
 assert(output.elements.length===12&&Date.now()-started>45);
 assert(statuses.some(x=>x.status==='bytes'&&x.received>0));
});
test('streaming stalls without bytes fail rather than pretend progress',async()=>{
 const response=new Response(new ReadableStream({start(){}}));
 const statuses=[];
 await assert.rejects(R.readJSONLimited(response,10000,35,{onActivity:e=>statuses.push(e)}),/keine Daten|still/);
 assert.equal(statuses.some(e=>e.status==='bytes'&&e.received>0),false);
});
test('optional historic POIs are fetched after base; center-only way becomes marker',async()=>{
 const old=globalThis.fetch;const calls=[],events=[];
 globalThis.fetch=async (url,opts)=>{calls.push(String(url));const q=new URLSearchParams(opts?.body).get('data')||'';return responseFor(q.includes('nwr[historic][name]')?rawPOI:rawBase,{chunkSize:500,delay:0});};
 try{
  const data=await R.loadMap(bbox,{mode:'poster',terrainRequired:false,refresh:true,onProgress:e=>events.push(e)});
  assert.equal(data.buildings.length,1);
  assert.equal(data.landmarks.length,2);
  assert.equal(data.landmarks.find(p=>p.id==='way/21').name,'Castro antigo');
  assert.equal(calls.length,2);
  assert(events.some(e=>e.phase==='base'&&e.status==='done')&&events.some(e=>e.phase==='pois'&&e.status==='done'));
 }finally{globalThis.fetch=old;}
});
test('optional POI 503 never discards successfully received buildings, roads and water',async()=>{
 const old=globalThis.fetch,events=[];
 globalThis.fetch=async(url,opts)=>{const q=new URLSearchParams(opts?.body).get('data')||'';if(q.includes('nwr[historic][name]'))return new Response('Busy',{status:503});return responseFor(rawBase,{chunkSize:500,delay:0});};
 try{const d=await R.loadMap(bbox,{mode:'poster',terrainRequired:false,refresh:true,onProgress:e=>events.push(e)});
  assert.equal(d.buildings.length,1);
  assert(d.warnings.some(w=>w.includes('historische Orte')));
  assert(events.some(e=>e.phase==='pois'&&e.status==='skipped'));
 }finally{globalThis.fetch=old;}
});
test('favicon SVG uses exactly three paint colors and no filters',async()=>{
 const {readFile}=await import('node:fs/promises');const svg=await readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
 assert.equal(new Set([...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map(a=>a[0].toLowerCase())).size,3);
 assert(!/filter=|gradient|linearGradient|text|mask=/.test(svg));
 assert(svg.includes('viewBox="0 0 64 64"'));
});