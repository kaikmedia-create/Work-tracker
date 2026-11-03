import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/architecture.js',import.meta.url),'utf8');
const a=source.indexOf(' function vertex2(p)'),b=source.indexOf('\n function lower(',a);assert(a>=0&&b>a);
function registry(){const ctx={Q:1e7,xy:[],xyIndex:new Map(),xyZ:[]};vm.createContext(ctx);vm.runInContext(source.slice(a,b)+';globalThis.vertex=vertex2;',ctx);return ctx;}
test('v15 matches the captured Weinheim points two quantisation bins apart',()=>{
 const r=registry(),p=[-71.68707467075689,89.85267372309313],q=[-71.68707466941686,89.85267387776531];
 assert.equal(Math.abs(Math.round(p[1]*r.Q)-Math.round(q[1]*r.Q)),2);
 assert(Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])<2/r.Q);
 assert.equal(r.vertex(p),r.vertex(q),'both sides of the seam must reference one XY vertex');
});
test('v15 neighbour lookup covers the full accepted weld radius in every direction',()=>{
 for(const signX of [-1,1])for(const signY of [-1,1]){
  const r=registry(),p=[signX*10.49/r.Q,signY*20.49/r.Q],q=[signX*12.1/r.Q,signY*20.5/r.Q];
  assert.equal(r.vertex(p),r.vertex(q));
 }
});
test('v15 does not increase the accepted weld tolerance',()=>{const r=registry();assert.notEqual(r.vertex([0,0]),r.vertex([2.1/r.Q,0]));});
