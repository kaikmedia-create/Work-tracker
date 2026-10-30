"""Produce clean, single-v6 AES-GCM static preview for the existing GitHub Pages site.
It is NOT server-side authorization; the weak PIN is an intentional private prototype convenience.
"""
import base64,gzip,hashlib,json,secrets
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1]
site=root/'site'
source_names=['index.html','style.css','favicon.svg','core.js','data.js','map.js','viewer.js','poster.js','app.js','worker.js']
files={'public/'+name:(root/'public'/name).read_text() for name in source_names}
files['README.md']=(root/'README.md').read_text()
raw=json.dumps({'version':8,'files':files},ensure_ascii=False,separators=(',',':')).encode()
compressed=gzip.compress(raw,compresslevel=9,mtime=0)
salt=secrets.token_bytes(16);iv=secrets.token_bytes(12);iterations=270000
key=hashlib.pbkdf2_hmac('sha256',b'2808',salt,iterations,32)
cipher=AESGCM(key).encrypt(iv,compressed,None)
parts=[]
for i in range(0,len(cipher),6000):
 name=f'bundle8-{i//6000}.b64'
 (site/name).write_text(base64.b64encode(cipher[i:i+6000]).decode()+'\n')
 parts.append(name)
manifest={'version':8,'salt':base64.b64encode(salt).decode(),'iv':base64.b64encode(iv).decode(),'iterations':iterations,'parts':parts}
(site/'bundle8.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
# Authenticated round trip before uploading
assert json.loads(gzip.decompress(AESGCM(key).decrypt(iv,cipher,None)))['files']==files
print('bundle8',len(raw),len(compressed),len(cipher),'parts',len(parts))

# Do not log PIN or derived key. Keep original site name/domain unchanged.
gate=r'''/* Relief Studio v8 encrypted preview, NOT server-side authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function get(name){const r=await fetch(name+'?v=8',{cache:'no-store'});if(!r.ok)throw Error('Datei nicht erreichbar ('+r.status+'): '+name+'. Verbindung prüfen und neu laden.');return r;}
async function combine(names){const list=await Promise.all(names.map(async name=>bytes((await (await get(name)).text()).trim())));const total=list.reduce((n,p)=>n+p.length,0);if(total>1500000)throw Error('Datenpaket ist ungewöhnlich groß.');const out=new Uint8Array(total);let at=0;for(const p of list){out.set(p,at);at+=p.length;}return out;}
$('login').onsubmit=async e=>{
 e.preventDefault();$('submit').disabled=true;$('status').textContent='Studio 8 wird geöffnet …';
 try{
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte aktuellen Browser über HTTPS verwenden.');
  const m=await (await get('bundle8.json')).json();if(m.version!==8||!Array.isArray(m.parts)||m.parts.length>50)throw Error('Ungültiges Softwarepaket.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode($('pin').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(m.salt),iterations:m.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let compressed;try{compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m.iv)},key,await combine(m.parts));}catch{throw Error('PIN falsch oder Softwarepaket beschädigt. Bitte erneut eingeben.');}
  const packageText=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const pack=JSON.parse(packageText),files=pack.files;
  if(pack.version!==8||!files['public/app.js']||!files['public/index.html']||!files['public/style.css'])throw Error('Softwarepaket unvollständig.');
  let html=files['public/index.html'];html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+files['public/style.css']+'</style>');
  const icon='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(files['public/favicon.svg'])));
  html=html.replaceAll('href="favicon.svg"','href="'+icon+'"').replaceAll('src="favicon.svg"','src="'+icon+'"');
  const worker=files['public/core.js']+'\n'+files['public/worker.js'].replace("importScripts('core.js');",'');
  const pre='<scr'+'ipt>window.RELIEF_STATIC_PREVIEW=true;window.RS_WORKER_SOURCE='+JSON.stringify(worker).replaceAll('</','<\\/')+';</scr'+'ipt>';
  html=html.replace('<script src="core.js">',pre+'<script src="core.js">');
  html=html.replace(/<script src="([^\"]+)\.js"><\/script>/g,(_,name)=>'<scr'+'ipt>\n'+files['public/'+name+'.js'].replaceAll('</script','<\\/script')+'\n</scr'+'ipt>');
  window.RELIEF_SOURCE_FILES=files;$('pin').value='';document.open();document.write(html);document.close();
 }catch(error){$('status').textContent=error.message;$('submit').disabled=false;}
};
})();
'''
# Raw literal still has extra escaping because this is a Python raw string; normalize carefully.
gate=gate.replace('\\\\','\\')
(site/'gate-v8.js').write_text(gate)
p=site/'index.html';html=p.read_text().replace('CARTOGRAPHIC ATELIER · 07','CARTOGRAPHIC ATELIER · 08').replace('gate-v7.js?v=7','gate-v8.js?v=8').replace('Studio 6 wird geöffnet','Studio 8 wird geöffnet');p.write_text(html)
assert 'gate-v8.js?v=8' in html and 'gate-v7.js?v=7' not in html
print('gate size',len(gate),'index size',len(html))