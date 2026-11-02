/* Relief Studio v13 encrypted preview, NOT server-side authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function get(name){const r=await fetch(name+'?v=13',{cache:'no-store'});if(!r.ok)throw Error('Datei nicht erreichbar ('+r.status+'): '+name+'. Verbindung prüfen und neu laden.');return r;}
async function combine(names){const list=await Promise.all(names.map(async name=>bytes((await (await get(name)).text()).trim())));const total=list.reduce((n,p)=>n+p.length,0);if(total>1500000)throw Error('Datenpaket ist ungewöhnlich groß.');const out=new Uint8Array(total);let at=0;for(const p of list){out.set(p,at);at+=p.length;}return out;}
$('login').onsubmit=async e=>{
 e.preventDefault();$('submit').disabled=true;$('status').textContent='Studio 13 wird geöffnet …';
 try{
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte aktuellen Browser über HTTPS verwenden.');
  const m=await (await get('bundle10.json')).json();if(m.version!==10||!Array.isArray(m.parts)||m.parts.length>50)throw Error('Ungültiges Softwarepaket.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode($('pin').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(m.salt),iterations:m.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let compressed;try{compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m.iv)},key,await combine(m.parts));}catch{throw Error('PIN falsch oder Softwarepaket beschädigt. Bitte erneut eingeben.');}
  const packageText=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const pack=JSON.parse(packageText),files=pack.files;
  if(pack.version!==10||!files['public/app.js']||!files['public/index.html']||!files['public/style.css'])throw Error('Softwarepaket unvollständig.');
  const upgrade=await (await get('upgrade11.json')).json();
  if(upgrade.version!==11||!Array.isArray(upgrade.parts)||upgrade.parts.length>20)throw Error('Ungültiges Updatepaket.');
  const packed=await combine(upgrade.parts),hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),b=>b.toString(16).padStart(2,'0')).join('');
  if(await hash(packed)!==upgrade.sha256)throw Error('Update unvollständig. Bitte vollständig neu laden.');
  const patch=JSON.parse(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if(patch.version!==11)throw Error('Falsche Updateversion.');
  for(const [name,c] of Object.entries(patch.changes)){
   if(!(name in files))continue;
   if(await hash(files[name])!==c.base)throw Error('Programmstand passt nicht zum Update: '+name);
   const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=value;
  }
  Object.assign(files,patch.added);pack.version=11;
  const u12=await (await get('upgrade12.json')).json();
  if(u12.version!==12||!Array.isArray(u12.parts)||u12.parts.length>20)throw Error('Ungültiges Architektur-Update.');
  const p12bytes=await combine(u12.parts);if(await hash(p12bytes)!==u12.sha256)throw Error('Architektur-Update unvollständig. Bitte neu laden.');
  const p12=JSON.parse(await new Response(new Blob([p12bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  if(p12.version!==12)throw Error('Falsche Architekturversion.');
  for(const [name,c] of Object.entries(p12.changes)){
   if(!(name in files))continue;
   if(await hash(files[name])!==c.base)throw Error('Programmstand passt nicht zu Version 12: '+name);
   const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
   const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Architektur-Prüfsumme stimmt nicht: '+name);files[name]=value;
  }
  Object.assign(files,p12.added);pack.version=12;
   const p13=await (await get('upgrade13.json')).json();
   if(p13.version!==13||!p13.changes||Object.keys(p13.changes).length!==3)throw Error('Ungültiges Stabilitäts-Update.');
   for(const [name,c] of Object.entries(p13.changes)){
    if(!(name in files))throw Error('Fehlende Datei im Stabilitäts-Update: '+name);
    if(await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 13: '+name);
    const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Stabilitäts-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=13;
  let html=files['public/index.html'];html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+files['public/style.css']+'</style>');
  const icon='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(files['public/favicon.svg'])));
  html=html.replaceAll('href="favicon.svg"','href="'+icon+'"').replaceAll('src="favicon.svg"','src="'+icon+'"');
  const worker=files['public/core.js']+'\n'+files['public/architecture.js']+'\n'+files['public/worker.js'].replace("importScripts('core.js','architecture.js');",'');
  const pre='<scr'+'ipt>window.RELIEF_STATIC_PREVIEW=true;window.RS_WORKER_SOURCE='+JSON.stringify(worker).replaceAll('</','<\\/')+';</scr'+'ipt>';
  html=html.replace('<script src="core.js">',pre+'<script src="core.js">');
  html=html.replace(/<script src="([^\"]+)\.js"><\/script>/g,(_,name)=>'<scr'+'ipt>\n'+files['public/'+name+'.js'].replaceAll('</script','<\\/script')+'\n</scr'+'ipt>');
  window.RELIEF_SOURCE_FILES=files;$('pin').value='';document.open();document.write(html);document.close();
 }catch(error){$('status').textContent=error.message;$('submit').disabled=false;}
};
})();
