import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';
import '../public/poster.js';
const R=globalThis.RS;
const wet=(polygons,x,y)=>polygons.some(p=>R.inside(x,y,p.rings));

test('Foz-sized coast: north-sea remains blue, inland town is not blue',()=>{
 const coastline=[[1.20,.24],[.72,.22],[.50,.20],[.25,.25],[-.20,.22]];
 const w=R.seaPolygonsFromCoastlines([coastline]);
 assert.equal(w.length,1);
 assert.equal(wet(w,.5,.05),true);
 assert.equal(wet(w,.5,.52),false);
 assert.equal(wet(wet? w:[],.5,.89),false);
});

test('coastal ways are stitched as a single directed line; reverse changes the SEA side',()=>{
 const a=[[1.20,.33],[.5,.28]],b=[[.5,.28],[-.20,.32]];
 const water=R.seaPolygonsFromCoastlines([a,b]);
 assert.equal(water.length,1);
 assert(wet(water,.4,.04));assert(!wet(water,.4,.8));
 const reversed=R.seaPolygonsFromCoastlines([b.slice().reverse(),a.slice().reverse()]);
 assert(!wet(reversed,.4,.04));assert(wet(reversed,.4,.8));
});

test('two coastal bays form disjoint sea faces rather than flooding the middle',()=>{
 const a=[[1.20,.16],[.75,.18],[.45,.24],[-.20,.17]];
 const b=[[1.20,.84],[.89,.81],[.78,.68],[1.20,.55]];
 const warns=[];
 const water=R.seaPolygonsFromCoastlines([a,b],warns);
 assert(wet(water,.5,.06),'sea at northern edge');
 assert(!wet(water,.45,.50),'town in centre MUST be land');
 assert(water.every(w=>w.rings[0].every(([x,y])=>x>=-.00001&&y>=-.00001&&x<=1.00001&&y<=1.00001)));
});

test('island land remains a hole inside sea, even with no crossing coasts',()=>{
 const island=[[.4,.4],[.4,.6],[.6,.6],[.6,.4],[.4,.4]]; // negative screen area = land on the left
 const w=R.seaPolygonsFromCoastlines([island]);
 assert.equal(w.length,1);
 assert.equal(wet(w,.5,.5),false);
 assert.equal(wet(w,.15,.15),true);
});

test('incomplete coastline does NOT paint a city blue and surfaces an actionable warning',()=>{
 const warns=[];
 const water=R.seaPolygonsFromCoastlines([[[.15,.15],[.35,.18],[.55,.20]]],warns);
 assert.equal(water.length,0);
 assert(warns.some(w=>w.includes('Unvollständig')));
});

test('coastal polygon conflicting with real building locations is rejected before poster export',()=>{
 const bb=[-1,-1,1,1],d=R.boundsInfo(bb),point=(x,y)=>R.unproject([d.sw[0]+x*(d.ne[0]-d.sw[0]),d.ne[1]-y*(d.ne[1]-d.sw[1])]);
 const coast=[[1.2,.5],[.5,.5],[-.2,.5]];
 const toGeom=pts=>pts.map(p=>{const q=point(...p);return {lon:q[0],lat:q[1]};});
 const buildings=[];
 for(let i=0;i<40;i++){
  const x=.1+(i%10)*.075,y=.16+Math.floor(i/10)*.08;
  buildings.push({type:'way',id:100+i,tags:{building:'yes'},geometry:toGeom([[x,y],[x+.02,y],[x+.02,y+.02],[x,y+.02],[x,y]])});
 }
 const o=R.parseOSM({elements:[{type:'way',id:1,tags:{natural:'coastline'},geometry:toGeom(coast)},...buildings]},bb);
 assert.equal(o.buildings.length,40);
 assert.equal(o.water.length,0,'bad sea polygons rejected');
 assert(o.warnings.some(w=>w.includes('Meeresfläche')&&w.includes('Gebäuden')));
});

test('source waters painted after park and under the roads, not flooding a test building',()=>{
 const d={bounds:R.boundsFor(-7.25,43.566,3.65,3.42),terrain:{cols:2,rows:2,values:[0,0,0,0],available:false},buildings:[],roads:[],parks:[],landmarks:[],water:R.seaPolygonsFromCoastlines([[[1.2,.25],[.5,.27],[-.2,.25]]])};
 const scene=R.posterScene(d,{mode:'poster',contours:false,hillshade:false,showLabels:false,showAttribution:true,title:'Foz',subtitle:'Spanien'});
 assert(scene.ops.some(o=>o.type==='polygon'&&o.fill===R.palettes.ivory.water));
 assert(scene.ops.find(o=>o.type==='clip'));
});

test('Foz Spain small and large map selections keep town land and ocean water with the same underlying coastlines',()=>{
 const coastline=[[-7.17,43.575],[-7.22,43.575],[-7.24,43.573],[-7.257,43.575],[-7.28,43.574],[-7.34,43.578]];
 const elements=[{type:'way',id:40,tags:{natural:'coastline'},geometry:coastline.map(([lon,lat])=>({lon,lat}))}];
 let id=100;
 for(let j=0;j<8;j++)for(let i=0;i<20;i++){
  const lon=-7.276+i*.0017,lat=43.558+j*.0015;
  elements.push({id:id++,type:'way',tags:{building:'yes'},geometry:[[lon,lat],[lon+.0002,lat],[lon+.0002,lat+.0002],[lon,lat+.0002],[lon,lat]].map(([lon,lat])=>({lon,lat}))});
 }
 const bSmall=R.boundsFor(-7.2568,43.5666,3.65,3.42),bLarge=R.boundsFor(-7.2499,43.5622,8,7);
 for(const b of [bSmall,bLarge]){
  const d=R.parseOSM({elements},b);
  assert.equal(d.buildings.length,160);
  const town=R.normalized(b,[[-7.257,43.565]])[0],ocean=R.normalized(b,[[-7.257,43.581]])[0];
  assert(!wet(d.water,...town),'Foz town must stay land, not blue');
  assert(wet(d.water,...ocean),'Bay of Biscay ocean must be blue');
  const covered=d.buildings.filter(h=>d.water.some(w=>R.inside(...R.centroid(h.rings[0]),w.rings)));
  assert.equal(covered.length,0,'no Foz building should be under ocean');
 }
});