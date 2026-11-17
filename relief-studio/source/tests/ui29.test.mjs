import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {applyUX29,unapplyUX29} from '../public/relief-ux29.mjs';
import {composeGate} from '../public/official-gate.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const site=join(root,'..');
const read=name=>readFile(join(root,'public',name),'utf8');

test('UX29 removes editable map dimensions, coordinates, manual buttons and technical notes',async()=>{
 const html=await read('index.html');
 for(const value of ['data-setting="widthKm"','data-setting="heightKm"','data-setting="lat"','data-setting="lon"','id="world-refresh"','id="official-import"','id="official-refresh"','data-setting="worldBuildings"','id="atlas-plan"','LGL-BW CityGML/ZIP'])assert.equal(html.includes(value),false,'Old UI '+value);
 for(const value of ['id="map-canvas"','id="draw-area"','id="sidebar-toggle"','id="studio-sidebar"','data-setting="surfaceMode"'])assert.equal(html.includes(value),true,'Missing '+value);
});
test('UX29 checks worldwide 3D buildings automatically and expands viewer',async()=>{
 const app=await read('app.js'),css=await read('style.css');new Script(app);
 assert.ok(app.includes("if(opts.mode!=='model')return R.loadMap(b,opts);"));
 assert.ok(app.includes("if(settings.mode==='model'){if(loaded.sourceAudit){"));
 assert.ok(app.includes('settings.worldBuildings=true;'));
 assert.ok(app.includes('settings={...p.settings,worldBuildings:true}'));
 assert.ok(app.includes('sidebar.inert=closed'));
 assert.ok(css.includes('.workspace.sidebar-collapsed{grid-template-columns:0 minmax(0,1fr)!important}'));
 assert.ok(css.includes('.stage-bottom,.main-footer{display:none!important}'));
 assert.ok(app.includes("helpButton.textContent='?'"));
 assert.ok(!app.includes("$('world-refresh')"));
});
test('UX29 source patches are reversible and PIN preview includes them',async()=>{
 const files=Object.fromEntries(await Promise.all(['index.html','app.js','style.css','data.js'].map(async name=>['public/'+name,await read(name)])));
 files['server.mjs']=await readFile(join(root,'server.mjs'),'utf8');
 const prepatch=Object.fromEntries(Object.entries(files).map(([name,source])=>[name,unapplyUX29(name,source)]));
 assert.deepEqual(applyUX29(prepatch),files);
 assert.deepEqual(applyUX29({...files}),files);
 const gate=composeGate(await readFile(join(site,'gate-base-v28.js'),'utf8'));
 assert.ok(gate.includes('relief-ux29.mjs?v=28-poi-1'));
 assert.ok(gate.indexOf('28-bergen-1')<gate.indexOf('relief-ux29.mjs?v=28-poi-1'));
});
