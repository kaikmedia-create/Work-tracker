/* Relief Studio 3 static preview. Not server-side authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function get(name){const r=await fetch(name+'?rs=3',{cache:'no-store'});if(!r.ok)throw Error('Programmpaket nicht erreichbar ('+r.status+'). Bitte mit Internetverbindung neu laden.');return r;}
async function parts(names){const chunks=await Promise.all(names.map(async n=>new Uint8Array(await(await get(n)).arrayBuffer())));const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;}
async function unpack(value){return JSON.parse(await new Response(new Blob([value]).stream().pipeThrough(new DecompressionStream('gzip'))).text());}
async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
$('login').onsubmit=async event=>{
 event.preventDefault();$('submit').disabled=true;$('status').textContent='Studio 3 wird geöffnet …';
 try{
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte einen aktuellen Browser über HTTPS verwenden.');
  const b=await(await get('bundle.json')).json(),encrypted=b.parts?await parts(b.parts):bytes(b.data);
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode($('pin').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(b.salt),iterations:b.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let compressed;try{compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(b.iv)},key,encrypted);}catch{throw Error('PIN nicht korrekt. Bitte erneut eingeben.');}
  const pack=await unpack(compressed),files=pack.files;
  if(![2,3].includes(pack.version)||!files['public/app.js'])throw Error('Grundpaket ist beschädigt.');
  if(pack.version===2){
  const manifest=await(await get('upgrade3.json')).json();
  let patch;try{patch=await unpack(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(manifest.iv)},key,await parts(manifest.parts)));}catch{throw Error('Updatepaket ist unvollständig oder beschädigt. Bitte die Seite neu laden.');}
  if(patch.version!==3)throw Error('Unbekanntes Updateformat.');
  for(const [name,change] of Object.entries(patch.changes)){
   const old=files[name]||'';if(await hash(old)!==change.base)throw Error('Programmversion passt nicht zum Update. Bitte vollständig neu laden.');
   const lines=old.split('\n');for(const [start,count,add] of change.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\n');if(await hash(value)!==change.result)throw Error('Prüfsumme des Updates stimmt nicht. Bitte neu laden.');files[name]=value;
  }
  }
  let html=files['public/index.html'];html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+files['public/style.css']+'</style>');
  const icon='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(files['public/favicon.svg'])));
  html=html.replaceAll('href="favicon.svg"','href="'+icon+'"').replaceAll('src="favicon.svg"','src="'+icon+'"');
  const worker=files['public/core.js']+'\n'+files['public/worker.js'].replace("importScripts('core.js');",'');
  const before='<scr'+'ipt>window.RELIEF_STATIC_PREVIEW=true;window.RS_WORKER_SOURCE='+JSON.stringify(worker).replaceAll('</','<\\/')+';</scr'+'ipt>';
  html=html.replace('<script src="core.js">',before+'<script src="core.js">');
  html=html.replace(/<script src="([^\"]+)\.js"><\/script>/g,(_,name)=>'<scr'+'ipt>\n'+files['public/'+name+'.js'].replaceAll('</script','<\\/script')+'\n</scr'+'ipt>');
  window.RELIEF_SOURCE_FILES=files;$('pin').value='';document.open();document.write(html);document.close();
 }catch(error){$('status').textContent=error.message;$('submit').disabled=false;}
};
})();
