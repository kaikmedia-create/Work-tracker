import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import '../public/poster.js';
import '../public/data.js';
const R=globalThis.RS;

test('poster mode supports larger selections, and 3D remains protected',()=>{
 const b=R.boundsFor(8.68,49.55,20,10);
 assert.deepEqual(R.validateBounds(b,'poster'),b);
 assert.throws(()=>R.validateBounds(b,'model'),/12 km/);
 assert.throws(()=>R.validateBounds(R.boundsFor(8.68,49.55,24,24),'poster'),/240 km²/);
 const s=R.cleanSettings({widthKm:20,heightKm:10,mode:'poster'});
 assert.equal(s.widthKm,20);assert.equal(s.heightKm,10);
 assert.equal(R.validateProject({version:3,settings:s,data:{...structuredClone(fixture.data),bounds:b}}).settings.mode,'poster');
});

test('limits prevent oversized JSON even without Content-Length',async()=>{
 assert.deepEqual(await R.readJSONLimited(new Response('{"elements":[]}'),1000),{elements:[]});
 await assert.rejects(R.readJSONLimited(new Response('{"elements":['+'1,'.repeat(2000)+'0]}'),1000),/Obergrenze/);
 await assert.rejects(R.readJSONLimited(new Response('{}',{headers:{'Content-Length':'200000'}}),1000),/Zu viele Kartendaten/);
});

test('large poster preview reduces invisible details without degrading full export',async()=>{
 const data={...structuredClone(fixture.data),buildings:[],roads:[]};
 for(let i=0;i<22000;i++){
  const x=((i*1013)%997)/997,y=((i*1039)%991)/991;
  data.buildings.push({id:'feature-'+i,rings:[[[x,y],[x+.00002,y],[x+.00002,y+.00002],[x,y+.00002]]],height:8,landmark:false,tags:{},heightSource:'Schätzwert'});
 }
 const opts={...fixture.settings,contours:false};
 const preview=R.posterScene(data,opts,{preview:true,previewPixels:900});
 const full=R.posterScene(data,opts);
 assert.ok(preview.previewOmitted>18000);
 assert.ok(preview.ops.length<full.ops.length/10);
 const pdf=await R.pdf(full);assert.ok(pdf.size<8_000_000);
});

test('dynamic coastline detection remains on sea side',()=>{
 const raw={elements:[{id:1,type:'way',tags:{natural:'coastline'},geometry:[{lon:12.05,lat:54.24},{lon:12.05,lat:54.18},{lon:12.05,lat:54.12}]}]};
 const out=R.parseOSM(raw,[12,54.15,12.1,54.21]);
 assert.ok(out.water.length===1);
 assert.equal(out.water[0].name,'Meer');
});
