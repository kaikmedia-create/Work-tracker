import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash,webcrypto} from 'node:crypto';import vm from 'node:vm';
const root=dirname(dirname(fileURLToPath(import.meta.url))),site=join(root,'..'),code=await readFile(join(site,'gate-v17.js'),'utf8');
function instance({pin='2808',fault='',fast=false}={}){
 let html='',calls=0,downloaded;const els=Object.fromEntries(['pin','login','status','submit','gate-diagnose'].map(id=>[id,{value:'',textContent:'',hidden:true,disabled:false}]));els.pin.value=pin;
 const document={getElementById:id=>els[id],createElement:()=>({click(){}}),open(){html='';},write(t){html+=t;},close(){}};
 const fetch=async url=>{calls++;if(fault==='headers')return new Promise(()=>{});if(fault==='body')return {ok:true,text:()=>new Promise(()=>{})};
  if(fault==='404'||fault==='429')return new Response('no',{status:Number(fault)});
  if(fault==='temporary'&&calls===1)return new Response('busy',{status:503});
  let data=await readFile(join(site,url.split('?')[0]));if(fault==='checksum'&&url.startsWith('upgrade17.json')){const p=JSON.parse(data);p.changes['public/data.js'].result='0'.repeat(64);data=JSON.stringify(p);}return new Response(data);
 };
 const ctx={window:{},document,fetch,AbortController,crypto:webcrypto,DecompressionStream,TextEncoder,Response,Blob,Uint8Array,atob,btoa,unescape,encodeURIComponent,console,
  URL:{createObjectURL:blob=>(downloaded=blob,'blob:test'),revokeObjectURL(){}},setTimeout:fast?(fn,ms)=>setTimeout(fn,Math.min(ms,10)):setTimeout,clearTimeout};
 vm.runInNewContext(code,ctx);return {load:()=>els.login.onsubmit({preventDefault(){}}),html:()=>html,files:()=>ctx.window.RELIEF_SOURCE_FILES,els,calls:()=>calls,downloaded:()=>downloaded};
}
test('v17 published entry loads v17 gate',async()=>assert.match(await readFile(join(site,'index.html'),'utf8'),/gate-v26\.js\?v=26/));
test('v17 gate reconstructs exact current source and embeds exact worker bytes',async()=>{
 const x=instance();await x.load();assert(x.files(),x.els.status.textContent);
 const previous=JSON.parse(await readFile(join(site,'upgrade18.json'),'utf8')).changes;
 for(const name of ['data.js','app.js','diagnostics.js','index.html','architecture.js','worker.js','core.js','style.css']){
  const key='public/'+name;if(previous[key])assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),previous[key].base,'historical v17 '+name);
  else if(key==='public/data.js')assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),'6a8dfbf23828551b090f611b820e7f29bff40ff29ea7abe10629068f36583ab3',name);else if(key==='public/core.js')assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),'714dca6989540620530dd83e46e2a890496845fad499eff717bb8f238d5791a0',name);else if(key==='public/worker.js')assert.equal(createHash('sha256').update(x.files()[key]).digest('hex'),'d94442ddb4e08b23f8f9a62965be3b53d8801ab023aaf9a738dfa9623672b4e2',name);else assert.equal(x.files()[key],await readFile(join(root,'public',name),'utf8'),name);
 }
 assert(x.html().includes('RELIEF STUDIO <b>17.0</b>'));assert(x.html().includes('<span class="version">17</span>'));assert(x.html().includes('notice-diagnose'));
 const worker=JSON.parse(x.html().match(/window\.RS_WORKER_SOURCE=(.*?);<\/script>/s)[1]);
 assert.equal(worker,x.files()['public/core.js']+'\n'+x.files()['public/architecture.js']+'\n'+x.files()['public/worker.js'].replace("importScripts('core.js','architecture.js');",''));
 await mkdir(join(root,'reports/v17'),{recursive:true});await writeFile(join(root,'reports/v17/gate-rendered.html'),x.html());
});
test('v17 wrong PIN still rejects without exposing source',async()=>{const x=instance({pin:'not-secret-pin'});await x.load();assert.equal(x.html(),'');assert.match(x.els.status.textContent,/PIN falsch/);assert.equal(x.els.submit.disabled,false);});
test('v17 corrupted release delta rejects',async()=>{const x=instance({fault:'checksum'});await x.load();assert.equal(x.html(),'');assert.match(x.els.status.textContent,/Prüfsumme/);});
for(const fault of ['headers','body'])test('v17 stalled '+fault+' end with retryable visible error and diagnostics',async()=>{
 const x=instance({fault,fast:true});await x.load();assert.equal(x.calls(),2);assert.match(x.els.status.textContent,/Zeitlimit/);assert.equal(x.els.submit.disabled,false);assert.equal(x.els['gate-diagnose'].hidden,false);assert.equal(x.html(),'');
});
for(const fault of ['404','429'])test('v17 startup HTTP '+fault+' does not repeat requests',async()=>{const x=instance({fault});await x.load();assert.equal(x.calls(),1);assert.match(x.els.status.textContent,new RegExp(fault));assert.equal(x.html(),'');});
test('v17 transient startup 503 retries once then opens correctly',async()=>{const x=instance({fault:'temporary'});await x.load();assert(x.files(),x.els.status.textContent);});
