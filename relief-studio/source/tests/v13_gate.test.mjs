import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=existsSync(join(root,'site'))?join(root,'site'):join(root,'..');
const js=await readFile(join(site,'gate-v13.js'),'utf8'),entry=await readFile(join(site,'index.html'),'utf8');
function start(pin){let rendered='';const els=Object.fromEntries(['login','submit','status','pin'].map(id=>[id,{disabled:false,textContent:'',value:''}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],open(){rendered='';},write(text){rendered+=text;},close(){}};
 const fetch=async path=>new Response(await readFile(join(site,path.split('?')[0])),{status:200});
 const globals={window:{},document,fetch,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(js,globals);return {els,load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>rendered,files:()=>globals.window.RELIEF_SOURCE_FILES};
}
test('v13 index loads the current preview gate',()=>assert.match(entry,/gate-v13\.js\?v=13/));
test('v13 gate refuses an incorrect PIN',async()=>{const r=start('0000');await r.load();assert.match(r.els.status.textContent,/PIN falsch/);assert.equal(r.html(),'');});
test('v13 gate reconstructs tested source bytes and retains the 3D worker',async()=>{
 const r=start('2808');await r.load();assert.equal(r.els.status.textContent,'');
 const files=r.files(),html=r.html();
 for(const name of ['public/data.js','public/index.html','server.mjs'])assert.equal(files[name],await readFile(join(root,name),'utf8'),'deployed source differs: '+name);
 assert(html.includes('RELIEF STUDIO <b>13.0</b>'));
 assert(html.includes('overpass.private.coffee')&&html.includes('requiredTask')&&html.includes('RS_WORKER_SOURCE'));
 assert(!html.includes('src="core.js"'));
});
