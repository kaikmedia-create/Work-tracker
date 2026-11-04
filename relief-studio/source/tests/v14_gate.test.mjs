import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import vm from 'node:vm';import {createHash,webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=existsSync(join(root,'site'))?join(root,'site'):join(root,'..');
const code=await readFile(join(site,'gate-v14.js'),'utf8');
function instance(pin,corrupt=false){
 let rendered='';const els=Object.fromEntries(['login','submit','status','pin'].map(k=>[k,{value:'',disabled:false,textContent:''}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],open(){rendered='';},write(s){rendered+=s;},close(){}};
 const fetch=async path=>{let data=await readFile(join(site,path.split('?')[0]));if(corrupt&&path.startsWith('upgrade14.json')){const j=JSON.parse(data);j.sha256='0'.repeat(64);data=JSON.stringify(j);}return new Response(data);};
 const globals={window:{},document,fetch,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(code,globals);return {load:()=>els.login.onsubmit({preventDefault(){}}),files:()=>globals.window.RELIEF_SOURCE_FILES,html:()=>rendered,status:()=>els.status.textContent};
}
test('v14 remains available while v15 is the published entry',async()=>assert((await readFile(join(site,'index.html'),'utf8')).includes('gate-v25.js?v=25')));
test('v14 wrong PIN cannot expose the application',async()=>{const r=instance('0000');await r.load();assert.match(r.status(),/PIN falsch/);assert.equal(r.html(),'');});
test('v14 decrypted app and worker match all tested browser source bytes',async()=>{
 const r=instance('2808');await r.load();assert(r.files(),r.status());
 const expected={"core.js": "714dca6989540620530dd83e46e2a890496845fad499eff717bb8f238d5791a0", "architecture.js": "3e063ee6ad6faf5f261fded5336eefbe062127e9c01dc58ac08a547910b479d7", "data.js": "db7d98825dcce7c8b7adce9fc90a6ff87815001ef866ab2628bdaa8ffa4c70e1", "app.js": "71079fe8a03139aede0d3335af7f5322eb87a494daef34716b9d27ca9fac300a", "index.html": "e255b4cd37f1e8c267077a72bcdd03706e0702a4da6a955154a866124f7e6476", "map.js": "08bf8cb8c2c5074eac454be5440525da8a0c018d9f9cdb5b1c443e9deeba7273", "viewer.js": "c644aef7b7a4a7c97e9400811f2650ae4f43ce2d6ef0ce5115a73043ec14a295", "poster.js": "5de1099800a7387a29d196f9160c61676f8b00154e29ac200f066c8bffb38599", "worker.js": "21acc06cc9821adabd378b1148df512db35f8255994648dc988b6a6b49d7a96b", "style.css": "1155f9e9cd795c2d6f331e87498292f2ae2b02675c115955631a8e18f482ed9c"};for(const [name,sha] of Object.entries(expected))assert.equal(createHash('sha256').update(r.files()['public/'+name]).digest('hex'),sha,'historical v14 '+name);
 assert(r.html().includes('retriangulateZeroArea'));assert(r.html().includes('geometryKernelVersion:14'));
 assert(r.html().includes('RELIEF STUDIO <b>14.0</b>'));assert(r.html().includes('window.RS_WORKER_SOURCE='));
});
test('v14 checksum mismatch blocks a damaged geometry update',async()=>{const r=instance('2808',true);await r.load();assert.match(r.status(),/Prüfsumme/);assert.equal(r.html(),'');});
