import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url)));const site=join(root,'site');
const js=await readFile(join(site,'gate-v11.js'),'utf8');
const entry=await readFile(join(site,'index.html'),'utf8');
assert(entry.includes('gate-v11.js?v=11'), 'published entry must load current v11 gate, not older gates');
function instance(pin){let written='';const els=Object.fromEntries(['login','submit','status','pin'].map(id=>[id,{disabled:false,textContent:'',value:''}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],open(){written='';},write(text){written+=text;},close(){}};
 const fetch=async path=>{const file=join(site,path.split('?')[0]);const data=await readFile(file);return new Response(data,{status:200});};
 const globals={window:{},document,fetch,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(js,globals);return {els,load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>written,files:()=>globals.window.RELIEF_SOURCE_FILES};}
test('v11 gate rejects wrong PIN and does not write decrypted app',async()=>{const r=instance('0000');await r.load();assert.match(r.els.status.textContent,/PIN falsch/);assert.equal(r.html(),'');});
test('v11 gate decrypts full app and embeds new UI',async()=>{const r=instance('2808');await r.load();const h=r.html();assert(h.includes('ReliefStudio'));assert(h.includes('function createDataLoader'));assert(h.includes('11.0.0'));assert(h.includes('startEndpoint'));assert(h.includes('Kartenpakete'));assert(!h.includes('map:v10:'));for(const name of ['data.js','app.js','index.html'])assert.equal(r.files()['public/'+name],await readFile(join(root,'public',name),'utf8'),'live package equals tested source: '+name);assert(h.includes('mapScale'));assert(h.includes('GALICIA'));assert(h.includes('markerLimit'));assert(h.includes('Format &amp; Weißraum'));assert(h.includes('window.RELIEF_STATIC_PREVIEW=true'));assert(!h.includes('<script src="core.js">'));assert(h.length>180000);});
