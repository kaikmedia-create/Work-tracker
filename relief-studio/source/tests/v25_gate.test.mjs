import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {webcrypto,createHash} from 'node:crypto';import vm from 'node:vm';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=join(root,'..'),code=await readFile(join(site,'gate-v25.js'),'utf8');
function instance({pin='2808',fault='',fast=false}={}){
 let html='',calls=0,downloaded;const els=Object.fromEntries(['pin','login','status','submit','gate-diagnose'].map(id=>[id,{value:'',textContent:'',hidden:true,disabled:false}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],createElement:()=>({click(){}}),open(){html='';},write(t){html+=t;},close(){}};
 const fetch=async url=>{calls++;if(fault==='headers')return new Promise(()=>{});if(fault==='body')return {ok:true,text:()=>new Promise(()=>{})};
  if(fault==='404'||fault==='429')return new Response('no',{status:Number(fault)});
  if(fault==='temporary'&&calls===1)return new Response('busy',{status:503});
  let data=await readFile(join(site,url.split('?')[0]));if(fault==='checksum'&&url.startsWith('upgrade25.json')){const p=JSON.parse(data);p.changes['public/architecture.js'].result='0'.repeat(64);data=JSON.stringify(p);}return new Response(data);
 };
 const ctx={window:{},document,fetch,AbortController,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console,
  URL:{createObjectURL:blob=>(downloaded=blob,'blob:test'),revokeObjectURL(){}},setTimeout:fast?(fn,ms)=>setTimeout(fn,Math.min(ms,10)):setTimeout,clearTimeout};
 vm.runInNewContext(code,ctx);return {load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>html,files:()=>ctx.window.RELIEF_SOURCE_FILES,els,calls:()=>calls,downloaded:()=>downloaded};
}
test('v25 published entry loads v25 gate',async()=>assert.match(await readFile(join(site,'index.html'),'utf8'),/gate-v28\.js\?v=28/));
test('v25 gate reconstructs exact current source and embeds exact worker bytes',async()=>{
 const x=instance();await x.load();assert(x.files(),x.els.status.textContent);
 for(const name of ['data.js','app.js','diagnostics.js','index.html','architecture.js','worker.js','core.js','style.css','viewer.js']){const key='public/'+name;let expected;for(let n=26;n<=28&&!expected;n++){expected=JSON.parse(await readFile(join(site,'upgrade'+n+'.json'),'utf8')).changes[key]?.base;}if(expected)assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),expected,name);else assert.equal(x.files()[key],await readFile(join(root,key),'utf8'),name);}
 assert(x.html().includes('RELIEF STUDIO <b>25.0</b>'));assert(x.html().includes('<span class="version">25</span>'));assert(x.html().includes('notice-diagnose'));
 const worker=JSON.parse(x.html().match(/window\.RS_WORKER_SOURCE=(.*?);<\/script>/s)[1]);
 assert.equal(worker,x.files()['public/core.js']+'\n'+x.files()['public/architecture.js']+'\n'+x.files()['public/worker.js'].replace("importScripts('core.js','architecture.js');",''));
 await mkdir(join(root,'reports/v25'),{recursive:true});await writeFile(join(root,'reports/v25/gate-rendered.html'),x.html());
});
test('v25 wrong PIN still rejects without exposing source',async()=>{const x=instance({pin:'not-secret-pin'});await x.load();assert.equal(x.html(),'');assert.match(x.els.status.textContent,/PIN falsch/);assert.equal(x.els.submit.disabled,false);});
test('v25 corrupted release delta rejects',async()=>{const x=instance({fault:'checksum'});await x.load();assert.equal(x.html(),'');assert.match(x.els.status.textContent,/Prüfsumme/);});
for(const fault of ['headers','body'])test('v25 stalled '+fault+' end with retryable visible error and diagnostics',async()=>{
 const x=instance({fault,fast:true});await x.load();assert.equal(x.calls(),2);assert.match(x.els.status.textContent,/Zeitlimit/);assert.equal(x.els.submit.disabled,false);assert.equal(x.els['gate-diagnose'].hidden,false);assert.equal(x.html(),'');
});
for(const fault of ['404','429'])test('v25 startup HTTP '+fault+' does not repeat requests',async()=>{const x=instance({fault});await x.load();assert.equal(x.calls(),1);assert.match(x.els.status.textContent,new RegExp(fault));assert.equal(x.html(),'');});
test('v25 transient startup 503 retries once then opens correctly',async()=>{const x=instance({fault:'temporary'});await x.load();assert(x.files(),x.els.status.textContent);});
