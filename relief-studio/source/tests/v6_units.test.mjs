import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import '../public/poster.js';
const R=globalThis.RS;
test('v6 keeps historical v3 project settings and safe attribution default',()=>{
 const migrated=R.validateProject({...structuredClone(fixture),version:3});
 assert.equal(migrated.settings.showAttribution,true);
 assert.equal(migrated.settings.mapScale,1);
});
test('v6 exactly 60x80 and at 300 dpi when desktop memory suffices',()=>{
 const settings=R.cleanSettings({mode:'poster',paper:'60 × 80 cm',paperW:600,paperH:800,dpi:300});
 const plan=R.rasterPlan(settings);
 assert(plan.width>=7087&&plan.height>=9449);
 assert(Math.abs(plan.dpi-300)<.1);
});
test('v6 map size slider changes actual printed map bounds not paper dimensions',()=>{
 const full=R.posterScene(fixture.data,{paperW:600,paperH:800,margin:10,mapScale:1});
 const reduced=R.posterScene(fixture.data,{paperW:600,paperH:800,margin:10,mapScale:.6});
 assert.equal(full.width,reduced.width);assert.equal(full.height,reduced.height);
 assert(reduced.area.w<full.area.w*.61);
 assert(reduced.area.h<full.area.h*.61);
 const mapArea=R.posterScene(fixture.data,{paperW:600,paperH:800,margin:30,mapScale:.6});
 assert(mapArea.area.x>reduced.area.x);
});
test('v6 attribution can be hidden for private drafts and defaults to legible source',()=>{
 const yes=R.posterScene(fixture.data,{showAttribution:true});const no=R.posterScene(fixture.data,{showAttribution:false});
 assert(yes.ops.some(o=>o.role==='source'&&o.value.includes('OpenStreetMap')));
 assert(!no.ops.some(o=>o.role==='source'));
 assert(yes.ops.some(o=>o.type==='clip'));
});
test('v6 allows 100mm margins and constrains map scale',()=>{
 assert.equal(R.cleanSettings({margin:200,mapScale:.001}).margin,100);
 assert.equal(R.cleanSettings({mapScale:.001}).mapScale,.55);
});
