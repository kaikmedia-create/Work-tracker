import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=existsSync(join(root,'site'))?join(root,'site'):join(root,'..');
const js=await readFile(join(site,'gate-v13.js'),'utf8'),entry=await readFile(join(site,'index.html'),'utf8');
function start(pin){let rendered='';const els=Object.fromEntries(['login','submit','status','pin'].map(id=>[id,{disabled:false,textContent:'',value:''}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],open(){rendered='';},write(text){rendered+=text;},close(){}};
 const fetch=async path=>new Response(await readFile(join(site,path.split('?')[0])),{status:200});
 const globals={window:{},document,fetch,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(js,globals);return {els,load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>rendered,files:()=>globals.window.RELIEF_SOURCE_FILES};
}
test('v13 index loads the current preview gate',()=>assert.match(entry,/gate-v19\.js\?v=19/));
test('v13 gate refuses an incorrect PIN',async()=>{const r=start('0000');await r.load();assert.match(r.els.status.textContent,/PIN falsch/);assert.equal(r.html(),'');});
test('v13 gate reconstructs tested source bytes and retains the 3D worker',async()=>{
 const r=start('2808');await r.load();assert(r.files()&&r.html().length>180000,'gate must finish writing the application');
 const files=r.files(),html=r.html();
 assert.equal(createHash('sha256').update(files['public/data.js']).digest('hex'),'f8980dda18d57661d0099a02bf8a52c0977499e5c957f54505957b33d7b78373','historical v13 data snapshot');
 assert.equal(createHash('sha256').update(files['public/index.html']).digest('hex'),'ea4b234fa59a139ad33be86fed5d6782daae44cc7b1518d25d638a2332d21dad');
 assert(html.includes('RELIEF STUDIO <b>13.0</b>'));
 assert(files['public/data.js'].includes('requiredTask'));
 // Server is not part of the encrypted static browser bundle; it is deployed separately as source.
 assert(!('server.mjs' in files)||files['server.mjs']===await readFile(join(root,'server.mjs'),'utf8'));
 assert(html.includes('overpass.private.coffee')&&html.includes('requiredTask')&&html.includes('RS_WORKER_SOURCE'));
 assert(!html.includes('src="core.js"'));
});
