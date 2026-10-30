import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/data.js';
import '../public/poster.js';
const R=globalThis.RS;
const bb=[-7.29,43.53,-7.20,43.60];
const at=(lon,lat)=>({lon,lat});

test('Foz subtitle uses Galicia and English Spain; Germany stays in German',()=>{
 assert.equal(R.subtitleForLocation('Galicien','ES','Spanien'),'GALICIA · SPAIN');
 assert.equal(R.subtitleForLocation('Galicia','ES','Spain'),'GALICIA · SPAIN');
 assert.equal(R.subtitleForLocation('Baden-Württemberg','DE','Germany'),'BADEN-WÜRTTEMBERG · DEUTSCHLAND');
 assert.equal(R.subtitleForLocation('New York','US','USA'),'NEW YORK · UNITED STATES');
});
test('New projects keep automatic region with safe editable overrides and featured POI state',()=>{
 const s=R.cleanSettings({region:'Galicia',countryCode:'ES',countryName:'Spain',autoSubtitle:true,markerLimit:60,landmarkOverrides:{'node/22':{label:true,featured:true}}});
 assert.equal(s.autoSubtitle,true);assert.equal(s.region,'Galicia');assert.equal(s.markerLimit,60);
 assert.equal(s.landmarkOverrides['node/22'].featured,true);
 assert.equal(R.cleanSettings({markerLimit:200}).markerLimit,100);
});
test('Overpass searches named historic heritage museums religious sites and viewpoints',()=>{
 const q=R.osmQuery(bb);
 for(const part of ['nwr[historic][name]','nwr[heritage][name]','nwr[amenity=place_of_worship][name]','museum','viewpoint','lighthouse'])assert(q.includes(part),part);
 assert(!q.includes('historic~"^(castle|ruins|monument)$"'));
});
test('Foz-style POIs include categories on nodes, ways and relations',()=>{
 const square=(lon,lat)=>[at(lon,lat),at(lon+.001,lat),at(lon+.001,lat+.001),at(lon,lat+.001),at(lon,lat)];
 const raw={elements:[
  {type:'node',id:1,lon:-7.25,lat:43.565,tags:{name:'Roman ruins',historic:'archaeological_site'}},
  {type:'node',id:2,lon:-7.25,lat:43.56,tags:{name:'Museo de Foz',tourism:'museum'}},
  {type:'node',id:3,lon:-7.26,lat:43.56,tags:{name:'Iglesia de Foz',amenity:'place_of_worship'}},
  {type:'node',id:4,lon:-7.27,lat:43.57,tags:{name:'Old stone cross',historic:'wayside_cross'}},
  {type:'node',id:5,lon:-7.249,lat:43.568,tags:{name:'Lighthouse',man_made:'lighthouse'}},
  {type:'way',id:6,geometry:square(-7.242,43.565),tags:{name:'Old chapel',historic:'church'}},
  {type:'relation',id:7,tags:{name:'Archaeological fort',historic:'fort'},members:[{type:'way',role:'outer',geometry:square(-7.246,43.574)}]},
  {type:'node',id:8,lon:-7.242,lat:43.566,tags:{historic:'monument'}},
  {type:'node',id:9,lon:-7.245,lat:43.566,tags:{name:'Ordinary station',railway:'station'}}
 ]};
 const d=R.parseOSM(raw,bb);
 assert.equal(d.landmarks.length,7);
 assert.deepEqual(new Set(d.landmarks.map(x=>x.category)),new Set(['historic','museum','worship','other']));
 assert.equal(d.landmarks[0].name,'Roman ruins');
 assert(d.landmarks.every(x=>x.point.every(n=>n>=0&&n<=1)));
});
test('Poster renderer respects higher marker limit, deselection, featured priority and manual points',()=>{
 const landmarks=Array.from({length:38},(_,i)=>({id:'node/'+i,name:'Monument '+i,priority:80,category:'historic',point:[0.08+(i%8)*.108,0.08+Math.floor(i/8)*.13]}));
 const data={bounds:bb,terrain:{cols:2,rows:2,values:[0,0,0,0],available:false},buildings:[],roads:[],parks:[],water:[],landmarks,warnings:[]};
 const settings={mode:'poster',layout:'map',paperW:600,paperH:800,mapFit:'contain',showLabels:true,markerLimit:38,labelScale:.6,landmarkOverrides:{'node/0':{label:false},'node/37':{label:true,featured:true}}};
 const scene=R.posterScene(data,settings);
 const marks=scene.ops.filter(x=>x.role==='landmark');
 assert(marks.length>16,'Previously capped at 16 labels');
 assert(!marks.some(x=>x.value==='Monument 0'));
 assert(marks.some(x=>x.value==='Monument 37'));
 const noLabels=R.posterScene(data,{...settings,markerLimit:0});assert.equal(noLabels.ops.filter(x=>x.role==='landmark').length,0);
});
test('Photon forward and reverse supply region and country code without fabricated fallback',async()=>{
 const old=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url)=>{calls.push(String(url));return new Response(JSON.stringify({features:[{geometry:{coordinates:[-7.25,43.56]},properties:{name:'Foz',state:'Galicia',country:'Spain',countrycode:'es',city:'Foz'}}]}),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const p=await R.searchPlace('Foz');assert.equal(p[0].countryCode,'ES');assert.equal(p[0].region,'Galicia');
  const reverse=await R.reverseRegion(-7.25,43.56,'ES');assert.equal(reverse.region,'Galicia');assert.equal(reverse.countryCode,'ES');
  assert(calls.some(x=>x.includes('/reverse')&&x.includes('lang=en')));
 }finally{globalThis.fetch=old;}
});