import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=existsSync(join(root,'site'))?join(root,'site'):join(root,'..');
const code=await readFile(join(site,'gate-v16.js'),'utf8');
function instance(pin,corrupt=false){let rendered='';const els=Object.fromEntries(['login','submit','status','pin','gate-diagnose'].map(id=>[id,{value:'',disabled:false,textContent:'',hidden:true}]));els.pin.value=pin;
 const document={createElement:()=>({click(){}}),getElementById:id=>els[id],open(){rendered='';},write(s){rendered+=s;},close(){}};
 const fetch=async path=>{let bytes=await readFile(join(site,path.split('?')[0]));if(corrupt&&path.startsWith('upgrade16.json')){const v=JSON.parse(bytes);v.changes['public/data.js'].result='0'.repeat(64);bytes=Buffer.from(JSON.stringify(v));}return new Response(bytes);};
 const globals={window:{},document,fetch,setTimeout:()=>0,URL:{createObjectURL:()=>'',revokeObjectURL(){}},crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(code,globals);return {load:()=>els.login.onsubmit({preventDefault(){}}),files:()=>globals.window.RELIEF_SOURCE_FILES,html:()=>rendered,status:()=>els.status.textContent};
}
test('v16 current preview entry and checksum-verified PIN gate',async()=>{assert.match(await readFile(join(site,'index.html'),'utf8'),/gate-v16\.js\?v=16/);});
test('v16 wrong PIN leaves the preview encrypted',async()=>{const x=instance('not-the-pin');await x.load();assert.match(x.status(),/PIN falsch/);assert.equal(x.html(),'');});
test('v16 preview matches exact current source, including provider and worker and Diagnose button',async()=>{
 const x=instance('2808');await x.load();assert(x.files(),x.status());
 for(const name of ['data.js','app.js','diagnostics.js','index.html','architecture.js','worker.js'])assert.equal(x.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);
 assert(x.html().includes('ovp.dresel.systems'));assert(x.html().includes('RELIEF STUDIO <b>16.0</b>'));assert(x.html().includes('notice-diagnose'));assert(x.html().includes('window.RS_WORKER_SOURCE='));
});
test('v16 corrupted patch rejects rather than exposing unchecked source',async()=>{const x=instance('2808',true);await x.load();assert.match(x.status(),/Prüfsumme/);assert.equal(x.html(),'');});
