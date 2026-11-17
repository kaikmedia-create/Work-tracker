import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';

const R=globalThis.RS;
const bounds=R.boundsFor(-16.4598,28.4497,3,3);
const cache=()=>{const store=new Map();return {store,get:async key=>store.get(key),set:async(key,value)=>{store.set(key,value);}};};
const way=(id,x,y)=>({type:'way',id,tags:{building:'yes'},geometry:[{lon:x,lat:y},{lon:x+.0005,lat:y},{lon:x+.0005,lat:y+.0005},{lon:x,lat:y+.0005},{lon:x,lat:y}]});
const base={elements:[way(301,-16.46,28.449)]};
const culture={elements:[
 {type:'node',id:41,lon:-16.459,lat:28.449,tags:{name:'Iglesia El Salvador',amenity:'place_of_worship'}},
 {type:'node',id:42,lon:-16.456,lat:28.452,tags:{name:'Icaro de metal',tourism:'artwork'}},
 {type:'node',id:43,lon:-16.464,lat:28.451,tags:{name:'Achimencey Tinguaro',historic:'memorial'}},
 {type:'node',id:44,lon:-16.46,lat:28.454,tags:{name:'Casa Museo Pino',tourism:'museum'}},
 {type:'node',id:45,lon:-16.457,lat:28.448,tags:{name:'Ermita de San Diego',amenity:'place_of_worship'}}
]};
const trees={elements:[{type:'node',id:500,lon:-16.458,lat:28.450,tags:{natural:'tree',height:'10'}}]};
const classify=body=>{const q=new URLSearchParams(body).get('data')||'';return q.includes('nwr[historic][name]')?'pois':q.includes('node[natural=tree]')?'trees':q.includes('way[building]')?'geometry':'relations';};
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const make=(fetcher,storage=cache())=>({loader:R.createDataLoader({fetch:fetcher,cache:storage,config:{headerMs:300,poiMs:900,poiHeaderMs:400,treeMs:200,sessionMs:3000,retryMs:1}}),storage});
const opts={mode:'poster',terrainRequired:false,refresh:true};

test('La Matanza: named cultural objects do not share the unbounded tree query',()=>{
 const q=R.poiQuery(bounds),t=R.treeQuery(bounds);
 assert.ok(q.includes('nwr[historic][name]')&&q.includes('nwr[tourism~'));
 assert.ok(!q.includes('node[natural=tree]'));
 assert.ok(t.includes('node[natural=tree]'));
 assert.ok(q.includes('[timeout:18]'));
});
test('La Matanza: 503 on first cultural provider retries once, preserving all labels',async()=>{
 const log=[],{loader,storage}=make(async(url,options)=>{
  const kind=classify(options.body);log.push({kind,url:String(url)});
  if(kind==='pois'&&log.filter(x=>x.kind==='pois').length===1)return new Response('temporarily unavailable',{status:503});
  return json(kind==='geometry'?base:kind==='pois'?culture:{elements:[]});
 });
 const map=await loader.loadMap(bounds,opts);
 const labels=new Set(map.landmarks.map(x=>x.name));
 assert.equal(labels.size,5);for(const p of culture.elements)assert.ok(labels.has(p.tags.name));
 assert.equal(log.filter(x=>x.kind==='pois').length,2);
 assert.equal(map.warnings.filter(x=>x.includes('historische')).length,0);
 assert.ok([...storage.store.keys()].some(k=>k.startsWith('osm13:pois:')));
});
test('La Matanza: HTTP 429 never triggers provider rotation',async()=>{
 const log=[],{loader}=make(async(url,options)=>{
  const kind=classify(options.body);log.push(kind);
  if(kind==='pois')return new Response('rate limit',{status:429,headers:{'retry-after':'5'}});
  return json(kind==='geometry'?base:{elements:[]});
 });
 const map=await loader.loadMap(bounds,opts);
 assert.equal(log.filter(x=>x==='pois').length,1);
 assert.ok(map.warnings.some(w=>w.includes('historische')));
 assert.equal(map.buildings.length,1);
});
test('Model tree request is independent; a failed tree provider never erases cultural labels',async()=>{
 const log=[],{loader}=make(async(url,options)=>{
  const kind=classify(options.body);log.push(kind);
  if(kind==='trees')return new Response('temporarily unavailable',{status:503});
  return json(kind==='geometry'?base:kind==='pois'?culture:{elements:[]});
 });
 const map=await loader.loadMap(bounds,{...opts,mode:'model'});
 assert.equal(map.landmarks.length,5);
 assert.equal(log.filter(x=>x==='trees').length,1);
 assert.equal(map.warnings.some(w=>w.includes('historische')),false);
});
test('Model mapped trees remain available when the separate tree query succeeds',async()=>{
 const {loader}=make(async(url,options)=>{
  const kind=classify(options.body);
  return json(kind==='geometry'?base:kind==='pois'?culture:kind==='trees'?trees:{elements:[]});
 });
 const map=await loader.loadMap(bounds,{...opts,mode:'model'});
 assert.equal(map.landmarks.length,5);
 assert.equal(map.trees.length,1);
});
