import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {applySimpleStudio,unapplySimpleStudio,mountSimpleStudio,simpleCSS} from '../public/studio-simple.mjs';
import {composeGate} from '../public/official-gate.mjs';

test('simple editor is reversible, idempotent and presentation-only',()=>{
 const original={'public/app.js':'void 0;','public/style.css':'body{margin:0}','public/core.js':'geometry','public/data.js':'acquisition','public/architecture.js':'buildings'};
 const changed=applySimpleStudio({...original});
 assert.deepEqual(applySimpleStudio({...changed}),changed);
 for(const [name,source] of Object.entries(changed))assert.equal(unapplySimpleStudio(name,source),original[name]);
 for(const name of ['public/core.js','public/data.js','public/architecture.js'])assert.equal(changed[name],original[name]);
 new Script(changed['public/app.js']);
});
test('simple editor refuses to overwrite an unknown modified presentation layer',()=>{
 const files=applySimpleStudio({'public/app.js':'void 0;'});
 assert.throws(()=>unapplySimpleStudio('public/app.js',files['public/app.js']+'modified'),/Studio-UI/);
 assert.throws(()=>applySimpleStudio({'public/app.js':files['public/app.js']+'modified'}),/Studio-UI/);
});
test('all four street-width sliders keep their original ranges and bindings',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const expected={major:['5','0.1'],secondary:['4','0.1'],local:['3','0.05'],paths:['2','0.05']};
 for(const [key,[max,step]] of Object.entries(expected)){
  const inputs=[...html.matchAll(/<input\b[^>]*>/g)].map(x=>x[0]).filter(x=>x.includes('id="'+key+'"'));
  assert.equal(inputs.length,1,key);assert.ok(inputs[0].includes('max="'+max+'"'));assert.ok(inputs[0].includes('min="0"'));assert.ok(inputs[0].includes('step="'+step+'"'));
 }
 assert.ok(mountSimpleStudio.toString().includes("['major', 'secondary', 'local', 'paths'].map(control)"));
 assert.ok(!mountSimpleStudio.toString().includes('cloneNode'));
});
test('materialized source and PIN preview contain the same simple UI',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/style.css',import.meta.url),'utf8');
 assert.ok(app.includes('/* RELIEF_SIMPLE30_APP */'));assert.ok(css.endsWith(simpleCSS));new Script(app);
 const restored=unapplySimpleStudio('public/app.js',app);assert.ok(!restored.includes('/* RELIEF_SIMPLE30_APP */'));
 assert.ok(restored.includes('RELIEF_UX29_APP'));
 const base=await readFile(new URL('../../gate-base-v28.js',import.meta.url),'utf8');
 const gate=composeGate(base);new Script(gate);
 assert.ok(gate.includes('studio-simple.mjs?v=30-simple-1'));
 assert.ok(gate.indexOf('relief-ux29.mjs?v=28-poi-1')<gate.indexOf('studio-simple.mjs?v=30-simple-1'));
});
