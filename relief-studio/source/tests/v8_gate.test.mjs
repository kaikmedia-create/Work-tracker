import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url)));const site=join(root,'site');
const js=await readFile(join(site,'gate-v8.js'),'utf8');
const entry=await readFile(join(site,'index.html'),'utf8');
assert(entry.includes('gate-v8.js?v=8'), 'published entry must load the new v8 gate, never the cached v7 gate');
function instance(pin){let written='';const els=Object.fromEntries(['login','submit','status','pin'].map(id=>[id,{disabled:false,textContent:'',value:''}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],open(){written='';},write(text){written+=text;},close(){}};
 const fetch=async path=>{const file=join(site,path.split('?')[0]);const data=await readFile(file);return new Response(data,{status:200});};
 const globals={window:{},document,fetch,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console};
 vm.runInNewContext(js,globals);return {els,load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>written};}
test('v8 gate rejects wrong PIN and does not write decrypted app',async()=>{const r=instance('0000');await r.load();assert.match(r.els.status.textContent,/PIN falsch/);assert.equal(r.html(),'');});
test('v8 gate decrypts full app and embeds new UI',async()=>{const r=instance('2808');await r.load();const h=r.html();assert(h.includes('ReliefStudio'));assert(h.includes('mapScale'));assert(h.includes('Format &amp; Weißraum'));assert(h.includes('window.RELIEF_STATIC_PREVIEW=true'));assert(!h.includes('<script src="core.js">'));assert(h.length>180000);});