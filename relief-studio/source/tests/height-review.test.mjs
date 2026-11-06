import test from 'node:test';import assert from 'node:assert/strict';
import '../public/core.js';import '../public/architecture.js';
import {heightReview,reviewKey,restoreCamera} from '../public/height-review.mjs';
const R=globalThis.RS;
const h=(id,bb=[.2,.2,.8,.8])=>({id,name:'',height:9,tags:{building:'yes'},rings:[[[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]],[bb[0],bb[1]]]]});
const data={bounds:R.boundsFor(36.82,-1.28,2,2),buildings:[h('a'),h('b')]},s=R.cleanSettings({modelWidth:200,buildingFactor:1,landmarkFactor:1});
const row=(id,originalHeight,heightMetres,status='applied')=>({id,originalHeight,heightMetres,status});
function review(buildings,extra={}){return heightReview(R,data,s,{updated:buildings.length,buildings,...extra});}
test('identical accepted heights are confirmed, not counted as changes',()=>{const x=review([row('a',9,9),row('b',9,12)]);assert.equal(x.changed,1);assert.equal(x.confirmed,1);assert.match(x.text,/Dachformen bleiben unverändert/);});
test('no provider explicitly states that the chosen mode alone changes nothing',()=>{const x=heightReview(R,data,s,null);assert.equal(x.state,'no-coverage');assert.equal(x.changed,0);assert.match(x.title,/Keine Änderung/);assert.match(x.text,/allein ergänzt keine Daten/);});
test('network failure is different from missing coverage',()=>{const x=review([],{status:'unavailable',reason:'Timeout'});assert.equal(x.state,'unavailable');assert.match(x.text,/Timeout/);});
test('geometry rollback never advertises proposed heights as applied',()=>{const x=review([row('a',9,82)],{status:'not-applied',proposed:1});assert.equal(x.changed,0);assert.equal(x.entries.length,0);assert.match(x.text,/verworfen/);});
test('changes report actual print scale without artificial exaggeration',()=>{const x=review([row('a',9,82)]);assert.equal(x.entries[0].deltaMetres,73);assert(Math.abs(x.maxMillimetres-7.3)<.001);assert.equal(x.entries[0].newMetres,82);});
test('small typical changes remain labelled in millimetres',()=>{const x=review([row('a',9,11.2),row('b',9,8.8)]);assert(Math.abs(x.medianMillimetres-.12)<.001);});
test('protected and unchanged buildings never become changed examples',()=>{const x=review([row('a',9,82,'unchanged'),row('b',9,9)],{protected:1});assert.equal(x.changed,0);assert.equal(x.confirmed,1);assert.equal(x.protected,1);});
test('offscreen footprints and invalid height decisions are not focus targets',()=>{const d={...data,buildings:[h('a',[1.2,1.2,1.3,1.3]),h('b')]};const x=heightReview(R,d,s,{buildings:[row('a',9,82),row('b',undefined,40)]});assert.equal(x.changed,0);});
test('camera restoration keeps absolute target, yaw, pitch and zoom across changed zmax',()=>{let queued=0;const v={mesh:{width:200,height:180,zmax:30},queue(){queued++;}};restoreCamera(v,{focus:[.2,-.1,.15],zoom:12,pitch:.55,yaw:-.7});assert.equal(v.zoom,12);assert.equal(v.pitch,.55);assert.equal(v.yaw,-.7);assert(Math.abs(v.focus[2]+30/200*.35-.15)<1e-12);assert.equal(queued,1);});
test('comparison identity excludes only surface selection and viewing colours',()=>{assert.equal(reviewKey(s),reviewKey({...s,surfaceMode:'hybrid',style:'night',aerialColour:false}));assert.notEqual(reviewKey(s),reviewKey({...s,buildingFactor:2}));assert.notEqual(reviewKey(s),reviewKey({...s,modelWidth:300}));});
test('review never changes source buildings, heights, footprints or decisions',()=>{const fusion={buildings:[row('a',9,82)]},snap=JSON.stringify({data,s,fusion});heightReview(R,data,s,fusion);assert.equal(JSON.stringify({data,s,fusion}),snap);});
