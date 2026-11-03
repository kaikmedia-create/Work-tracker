import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import vm from 'node:vm';import {createHash,webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=existsSync(join(root,'site'))?join(root,'site'):join(root,'..');
const code=await readFile(join(site,'gate-v15.js'),'utf8');
function instance(pin,corrupt=false){
 let rendered='',downloaded=null;const els=Object.fromEntries(['login','submit','status','pin','gate-diagnose'].map(k=>[k,{value:'',disabled:false,textContent:'',hidden:true}]));els.pin.value=pin;
 const document={createElement:()=>({click(){}}),getElementById:id=>els[id],open(){rendered='';},write(s){rendered+=s;},close(){}};
 const fetch=async path=>{let data=await readFile(join(site,path.split('?')[0]));if(corrupt&&path.startsWith('upgrade15.json')){const j=JSON.parse(data);j.sha256='0'.repeat(64);data=JSON.stringify(j);}return new Response(data);};
 const globals={window:{},document,fetch,setTimeout:()=>0,URL:{createObjectURL:blob=>(downloaded=blob,'blob:test'),revokeObjectURL(){}},crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(code,globals);return {load:()=>els.login.onsubmit({preventDefault(){}}),files:()=>globals.window.RELIEF_SOURCE_FILES,html:()=>rendered,status:()=>els.status.textContent,diagnostic:()=>els['gate-diagnose'],downloaded:()=>downloaded};
}
test('v15 remains available while v15 is the published entry',async()=>assert((await readFile(join(site,'index.html'),'utf8')).includes('gate-v15.js?v=15')));
test('v15 wrong PIN cannot expose the application',async()=>{const r=instance('0000');await r.load();assert.match(r.status(),/PIN falsch/);assert.equal(r.html(),'');});
test('v15 decrypted app and worker match all tested browser source bytes',async()=>{
 const r=instance('2808');await r.load();assert(r.files(),r.status());
 for(const name of ['core.js','architecture.js','data.js','app.js','index.html','map.js','viewer.js','poster.js','worker.js','style.css','diagnostics.js'])assert.equal(r.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),name);
 assert(r.html().includes('notice-diagnose'));assert(r.html().includes('function createDiagnostics'));
 assert(r.html().includes('retriangulateZeroArea'));assert(r.html().includes('geometryKernelVersion:15'));
 assert(r.html().includes('RELIEF STUDIO <b>15.0</b>'));assert(r.html().includes('window.RS_WORKER_SOURCE='));
});
test('v15 checksum mismatch blocks a damaged geometry update',async()=>{const r=instance('2808',true);await r.load();assert.match(r.status(),/Prüfsumme/);assert.equal(r.html(),'');});

test('v15 failed login offers local diagnostics without including entered PIN',async()=>{
 const r=instance('1234567890');await r.load();assert.equal(r.diagnostic().hidden,false);
 r.diagnostic().onclick();const text=await r.downloaded().text(),report=JSON.parse(text);
 assert.equal(report.diagnostics.stage,'Studio öffnen');assert.equal(report.diagnostics.release,'15.0.0');
 assert.match(report.diagnostics.message,/PIN falsch/);assert(!text.includes('1234567890'));
});
