import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {applySimpleStudio, unapplySimpleStudio, simpleCSS} from '../public/studio-simple.mjs';

test('app and stylesheet round-trip byte for byte', () => {
  for (const [name, original] of [['public/app.js', '/* settings and listeners */\n'], ['public/style.css', 'body{margin:0}\n']]) {
    const files = {[name]: original};
    assert.equal(applySimpleStudio(files), files);
    assert.notEqual(files[name], original);
    assert.equal(unapplySimpleStudio(name, files[name]), original);
  }
});
test('repeated application is idempotent', () => {
  const files = {'public/app.js':'void 0;', 'public/style.css':''};
  applySimpleStudio(files); const once = {...files}; applySimpleStudio(files);
  assert.deepEqual(files, once);
});
test('single-file materialization is supported', () => {
  const files = {'public/style.css':'/* existing styles */'};
  applySimpleStudio(files);
  assert.deepEqual(Object.keys(files), ['public/style.css']);
  assert.ok(files['public/style.css'].includes('RELIEF_SIMPLE_CSS_V1'));
});
test('geometry, export, settings and index sources stay byte-identical', () => {
  const files = Object.fromEntries(['core.js','architecture.js','worker.js','poster.js','viewer.js','data.js','index.html'].map(n=>['public/'+n,'original:'+n]));
  const before = {...files}; applySimpleStudio(files); assert.deepEqual(files,before);
});
test('unknown existing app layer fails closed', () => {
  assert.throws(()=>applySimpleStudio({'public/app.js':'/* RELIEF_SIMPLE_APP_V1 */ changed'}), /unknown existing/);
});
test('changed stylesheet suffix is never silently removed', () => {
  const files = {'public/style.css':'body{}'}; applySimpleStudio(files);
  assert.throws(()=>unapplySimpleStudio('public/style.css',files['public/style.css']+'/* edit */'), /refusing/);
});
test('unmodified source and unrelated files are safe no-ops', () => {
  assert.equal(unapplySimpleStudio('public/app.js','void 0;'),'void 0;');
  assert.equal(unapplySimpleStudio('public/core.js','const x=1;'),'const x=1;');
  assert.deepEqual(applySimpleStudio({}),{});
});
test('app suffix compiles as a classic script, without imports', () => {
  const files = {'public/app.js':'(function(){})();'}; applySimpleStudio(files);
  assert.doesNotThrow(()=>new vm.Script(files['public/app.js']));
});
test('no CSS overrides for rendered canvas or SVG geometry', () => {
  const selectors=simpleCSS.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(rule=>rule.split('{').slice(0,-1).join('{'));
  assert.ok(selectors.every(s=>!/(?:^|[\s,>])(canvas|svg|path)(?:[\s.,:#>{]|$)/.test(s)));
});
