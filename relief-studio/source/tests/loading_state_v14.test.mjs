import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const a=app.indexOf('const loadStepLabels='),b=app.indexOf('\nasync function load(){',a);
assert(a>=0&&b>a);
function harness(){
 let now=0,tick;const elements=new Map();
 const el=()=>({textContent:'',value:0,dataset:{},removeAttribute(name){delete this[name];},replaceChildren(){},append(){},querySelector(){return el();}});
 const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
 const ctx={Date:{now:()=>now},$,document:{createElement:()=>el(),querySelector:()=>null},setInterval:fn=>(tick=fn,1),clearInterval(){}};
 vm.createContext(ctx);vm.runInContext(app.slice(a,b)+'\nglobalThis.testUI={resetLoader,progress,updateLoadClock};',ctx);
 return {$,ui:ctx.testUI,advance(ms){now+=ms;tick();}};
}
test('v14 real network wait reports missing loading progress, not a geometry failure',()=>{
 const h=harness();h.ui.resetLoader(true);h.advance(47000);
 assert.match(h.$('loader-idle').textContent,/47 s kein neuer Ladefortschritt/);
});
test('v14 processing clears a previous network-idle warning immediately',()=>{
 const h=harness();h.ui.resetLoader(true);h.advance(47000);
 h.ui.progress({phase:'process',status:'working'});
 assert.match(h.$('loader-idle').textContent,/lokal aufbereitet/);
 assert.doesNotMatch(h.$('loader-idle').textContent,/47|Stillstand|Warte auf/);
});
test('v14 model phase never warns about missing downloads, even after 47 seconds',()=>{
 const h=harness();h.ui.resetLoader(true);
 h.ui.progress('Geschlossenes Relief wird berechnet');h.advance(47000);
 assert.match(h.$('loader-idle').textContent,/3D-Modell wird lokal berechnet/);
 assert.match(h.$('loader-stage').textContent,/3D-Modell berechnen/);
 assert.doesNotMatch(h.$('loader-idle').textContent,/Stillstand|kein neuer/);
 assert.doesNotMatch(h.$('loader-percent').textContent,/%/);
});
test('v14 a new load resets model status to network waiting',()=>{
 const h=harness();h.ui.resetLoader(true);h.ui.progress('Geschlossenes Relief wird berechnet');
 h.ui.resetLoader(true);h.advance(47000);assert.match(h.$('loader-idle').textContent,/47 s kein neuer/);
});
test('v14 does not claim an invented 92 percent while building',()=>{
 assert(!app.includes("progress('Geschlossenes Relief wird berechnet',.92)"));
});
