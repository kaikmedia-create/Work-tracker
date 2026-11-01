/* Relief Studio v9 encrypted preview, NOT server-side authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function get(name){const r=await fetch(name+'?v=9',{cache:'no-store'});if(!r.ok)throw Error('Datei nicht erreichbar ('+r.status+'): '+name+'. Verbindung prüfen und neu laden.');return r;}
async function combine(names){const list=await Promise.all(names.map(async name=>bytes((await (await get(name)).text()).trim())));const total=list.reduce((n,p)=>n+p.length,0);if(total>1500000)throw Error('Datenpaket ist ungewöhnlich groß.');const out=new Uint8Array(total);let at=0;for(const p of list){out.set(p,at);at+=p.length;}return out;}
$('login').onsubmit=async e=>{
 e.preventDefault();$('submit').disabled=true;$('status').textContent='Studio 9 wird geöffnet …';
 try{
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte aktuellen Browser über HTTPS verwenden.');
  const m=await (await get('bundle9.json')).json();if(m.version!==9||!Array.isArray(m.parts)||m.parts.length>50)throw Error('Ungültiges Softwarepaket.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode($('pin').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(m.salt),iterations:m.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let compressed;try{compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m.iv)},key,await combine(m.parts));}catch{throw Error('PIN falsch oder Softwarepaket beschädigt. Bitte erneut eingeben.');}
  const packageText=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const pack=JSON.parse(packageText),files=pack.files;
  if(pack.version!==9||!files['public/app.js']||!files['public/index.html']||!files['public/style.css'])throw Error('Softwarepaket unvollständig.');
  let html=files['public/index.html'];html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+files['public/style.css']+'</style>');
  const icon='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(files['public/favicon.svg'])));
  html=html.replaceAll('href="favicon.svg"','href="'+icon+'"').replaceAll('src="favicon.svg"','src="'+icon+'"');
  const worker=files['public/core.js']+'\n'+files['public/worker.js'].replace("importScripts('core.js');",'');
  const pre='<scr'+'ipt>window.RELIEF_STATIC_PREVIEW=true;window.RS_WORKER_SOURCE='+JSON.stringify(worker).replaceAll('</','<\/')+';</scr'+'ipt>';
  html=html.replace('<script src="core.js">',pre+'<script src="core.js">');
  html=html.replace(/<script src="([^\"]+)\.js"><\/script>/g,(_,name)=>'<scr'+'ipt>\n'+files['public/'+name+'.js'].replaceAll('</script','<\/script')+'\n</scr'+'ipt>');
  window.RELIEF_SOURCE_FILES=files;$('pin').value='';document.open();document.write(html);document.close();
 }catch(error){$('status').textContent=error.message;$('submit').disabled=false;}
};
})();