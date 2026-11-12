import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import '../public/core.js';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=join(root,'..');
test('comparison UI and automatic focus are not loaded by the application',async()=>{
 const app=await readFile(join(root,'public/app.js'),'utf8');
 assert.doesNotMatch(app,/heightReviewUI|height-review\.mjs|createHeightReview/);
 await assert.rejects(access(join(root,'public/height-review.mjs')));
});
test('both startup paths omit the removed comparison delta',async()=>{
 for(const file of [join(site,'gate-v28.js'),join(root,'tools/prepare_release28.mjs')]){
  const code=await readFile(file,'utf8');
  assert.doesNotMatch(code,/upgrade28-height-review\.json/);
  assert.match(code,/upgrade28-hybrid\.json/);
  assert.match(code,/upgrade28-official\.json/);
 }
});
test('official-surface priority is the default while classic mode and diagnostics remain available',async()=>{
 const R=globalThis.RS,html=await readFile(join(root,'public/index.html'),'utf8');
 assert.equal(R.cleanSettings({}).surfaceMode,'hybrid');
 assert.equal(R.cleanSettings({surfaceSchema:3,surfaceMode:'classic'}).surfaceMode,'classic');
 assert.match(html,/Amtliche Flächen → Messpunkte/);
 assert.match(html,/notice-diagnose/);
 assert.doesNotMatch(html,/Unterschied ansehen|Nächstes Gebäude|height-review/);
});
test('the measurement engine and per-building audit remain in the build path',async()=>{
 const surface=await readFile(join(root,'public/surface-build.mjs'),'utf8');
 const app=await readFile(join(root,'public/app.js'),'utf8');
 assert.match(surface,/fuseBuildingMeasurements/);
 assert.match(surface,/mesh\.heightFusion=fusion/);
 assert.match(app,/heightFusionAudit/);
});
