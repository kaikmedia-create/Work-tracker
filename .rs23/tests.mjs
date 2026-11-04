import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/core.js';import '../public/architecture.js';
import {verifySolid} from './geometry_v14_verify.mjs';
const R=globalThis.RS,{roadCurve,roadAnchors}=R.architecture;
const way=points=>({kind:'major',highway:'primary',points});
const fixture=roads=>({bounds:R.boundsFor(8.68,49.55,1,1),terrain:{cols:2,rows:2,values:[10,10,10,10]},roads,water:[],parks:[],buildings:[],landmarks:[]});
const s={base:2,frame:0,modelWidth:80,resolution:65,terrainFactor:0,roadMode:'raised',roadRelief:.6};
test('straight runs and junctions remain mapped; a bend has tangent handles',()=>{
 const a=[.1,.1],b=[.5,.1],c=[.5,.7];assert.deepEqual(roadCurve([a,b,b,[.9,.1]],80,80,1,new Set()),[a,b,[.9,.1]]);
 const curve=roadCurve([a,b,c],80,80,1,new Set());assert(curve.length>=5);assert.deepEqual(curve[0],a);assert.deepEqual(curve.at(-1),c);assert(!curve.includes(b));assert(curve.every(p=>p[0]<=b[0]&&p[1]>=b[1]));
 const anchors=roadAnchors([way([a,b,c]),way([b,[.8,.4]])]);assert(roadCurve([a,b,c],80,80,1,anchors).includes(b));
});
test('loops remain closed; fine mode samples only bends',()=>{const p=[[.2,.2],[.8,.2],[.8,.8],[.2,.8],[.2,.2]],q=roadCurve(p,80,80,1,new Set(),.006),std=roadCurve(p,80,80,1,new Set());assert.deepEqual(q[0],q.at(-1));assert(q.length>std.length);for(const k of ['mapped','soft','fine'])assert.equal(R.cleanSettings({streetCurve:k}).streetCurve,k);assert.equal(R.cleanSettings({streetCurve:'invalid'}).streetCurve,'soft');});
// Slice the actual triangle mesh at 25% of the printed road height. Every
// contour vertex of a straight road should have the same perpendicular offset.
test('diagonal road: printed flank is straight to 0.01 mm',()=>{const m=R.buildMesh(fixture([way([[0,.75],[1,.25]])]),s);verifySolid(m);assert(m.roadProfile.contourVertices>0);const v=m.vertices,t=m.indices,sy=.5*m.height/m.width,norm=Math.hypot(1,sy),offsets=[];
 for(let i=0;i<t.length;i+=3)for(let j=0;j<3;j++){const a=3*t[i+j],b=3*t[i+(j+1)%3],z=2.15;if((v[a+2]>z)===(v[b+2]>z))continue;const q=(z-v[a+2])/(v[b+2]-v[a+2]),x=v[a]+q*(v[b]-v[a]),y=v[a+1]+q*(v[b+1]-v[a+1]);if(Math.abs(x)<25)offsets.push(Math.abs(y-sy*x)/norm);}
 assert(offsets.length>250);const ripple=Math.max(...offsets)-Math.min(...offsets);assert(ripple<.01,'edge spread (mm): '+ripple);console.log('diagonal edge spread in millimetres:',ripple);
});
for(const mode of ['raised','engraved'])test('S bend, fork, duplicate way and short cul-de-sac: '+mode,()=>{const p=[[.08,.26],[.28,.26],[.43,.37],[.52,.58],[.7,.65],[.9,.65]],d=fixture([way(p),way(p),way([p[2],[.41,.22]]),way([[.56,.8],[.6,.8]])]);const m=R.buildMesh(d,{...s,roadMode:mode});verifySolid(m);assert.equal(m.roadProfile.lines,4);assert(m.roadProfile.maxOffsetMm<=.60001);assert(m.roadProfile.contourVertices>10);});
