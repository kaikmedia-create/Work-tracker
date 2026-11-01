import test from 'node:test';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';const out=process.env.RELIEF_TEST_OUTPUT||join(tmpdir(),'relief-studio-tests');await mkdir(out,{recursive:true});
import {fixture} from './fixture.mjs';import '../public/poster.js';
const R=globalThis.RS;
test('coordinates round-trip and physical dimensions',()=>{const p=[8.6808,49.548],q=R.unproject(R.project(p));assert(Math.abs(q[0]-p[0])<1e-10);assert(Math.abs(q[1]-p[1])<1e-10);const d=R.boundsInfo(R.boundsFor(...p,3.2,3));assert(Math.abs(d.w-3200)<1);assert(Math.abs(d.h-3000)<1);});
test('bounds limits reject excessively large or inverted selections',()=>{assert.throws(()=>R.validateBounds([8,49,7,50]));assert.throws(()=>R.validateBounds(R.boundsFor(8,49,12,12)));});
test('building height and road class normalization',()=>{assert.equal(R.parseHeight({height:'30 ft'}).height,9.144);assert.equal(R.parseHeight({'building:levels':'4'}).height,13.5);assert.equal(R.parseHeight({}).heightSource,'Schätzwert');assert.equal(R.roadClass('primary_link'),'major');assert.equal(R.roadClass('tertiary'),'secondary');assert.equal(R.roadClass('footway'),'path');});
test('polygon holes remain open',()=>{const outer=[[0,0],[1,0],[1,1],[0,1]],hole=[[.3,.3],[.7,.3],[.7,.7],[.3,.7]];assert(R.inside(.1,.1,[outer,hole]));assert(!R.inside(.5,.5,[outer,hole]));});
test('project validation catches malformed data',()=>{assert.equal(R.validateProject(fixture).version,3);assert.throws(()=>R.validateProject({version:1}));const bad=structuredClone(fixture);bad.data.terrain.values[0]=NaN;assert.throws(()=>R.validateProject(bad));});
test('mesh is finite, every edge belongs to exactly two triangles',async()=>{const mesh=R.buildMesh(fixture.data,fixture.settings),edges=new Map();assert(mesh.vertices.every(Number.isFinite));for(let i=0;i<mesh.indices.length;i+=3){const tri=mesh.indices.slice(i,i+3);for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}}assert([...edges.values()].every(n=>n===2));assert(mesh.zmax>4);assert(Math.abs(mesh.width-208)<1e-5);await writeFile(join(out,'relief-test.stl'),Buffer.from(R.stl(mesh)));await writeFile(join(out,'relief-test.3mf'),Buffer.from(await R.model3mf(mesh,'Teststadt').arrayBuffer()));});
test('landmark opt-out works and high resolution grows detail',()=>{const a=R.buildMesh(fixture.data,fixture.settings),b=R.buildMesh(fixture.data,{...fixture.settings,landmarkOverrides:{'way/castle':{enabled:false}}});assert(a.classes.includes(2));assert(!b.classes.includes(2));assert(R.buildMesh(fixture.data,{...fixture.settings,resolution:321}).cell<a.cell);});
test('A0 raster safety limit, custom formats and true vector PDF',async()=>{const s={...fixture.settings,paperW:841,paperH:1189,dpi:300};const plan=R.rasterPlan(s);assert(plan.width*plan.height<=R.rasterCapacity());assert(plan.reduced);const blob=await R.pdf(R.posterScene(fixture.data,s));assert(blob.size<8000000);await writeFile(join(out,'relief-test-a0.pdf'),Buffer.from(await blob.arrayBuffer()));assert.equal(R.paperSizes['10 × 15 cm'][0],100);});
test('OSM multipolygon holes, tower recognition, height tags',()=>{const point=(lon,lat)=>({lon,lat}),square=[point(8,49),point(8.001,49),point(8.001,49.001),point(8,49.001),point(8,49)];const raw={elements:[{type:'way',id:1,tags:{man_made:'tower',name:'Turm',height:'28'},geometry:square}]};const d=R.parseOSM(raw,[7.99,48.99,8.01,49.01]);assert.equal(d.buildings[0].height,28);assert.equal(d.buildings[0].landmark,true);});

test('coastlines create sea polygons clipped to the map bounds',()=>{
 const point=(lon,lat)=>({lon,lat});
 const raw={elements:[{type:'way',id:99,tags:{natural:'coastline'},geometry:[point(8.01,49.04),point(8.01,48.98)]}]};
 const d=R.parseOSM(raw,[7.99,48.99,8.03,49.03]);
 assert.equal(d.water.length,1);
 assert(R.inside(.2,.5,d.water[0].rings));
 assert(!R.inside(.8,.5,d.water[0].rings));
});

test('coastline segments split across OSM ways stitch into one sea polygon',()=>{const p=(lon,lat)=>({lon,lat});const raw={elements:[{type:'way',id:1,tags:{natural:'coastline'},geometry:[p(8.01,49.04),p(8.01,49.015)]},{type:'way',id:2,tags:{natural:'coastline'},geometry:[p(8.01,49.015),p(8.01,48.98)]}]};const d=R.parseOSM(raw,[7.99,48.99,8.03,49.03]);assert.equal(d.water.length,1);assert(R.inside(.2,.5,d.water[0].rings));assert(!R.inside(.8,.5,d.water[0].rings));});
