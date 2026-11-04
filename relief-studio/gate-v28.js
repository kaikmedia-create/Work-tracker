/* Relief Studio v28 encrypted preview, NOT server-side authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id),bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
// Bound both headers AND body: a stalled release part must not freeze the PIN screen.
async function get(name){
 for(let attempt=0;attempt<2;attempt++){
  const control=new AbortController();let timer;
  try{return await Promise.race([
   (async()=>{const r=await fetch(name+'?v=28',{cache:'no-store',signal:control.signal});
    if(!r.ok)throw Object.assign(Error('Datei nicht erreichbar ('+r.status+'): '+name),{httpStatus:r.status});
    const value=await r.text();if(value.length>2000000)throw Object.assign(Error('Softwaredatei zu groß: '+name),{httpStatus:413});
    return new Response(value,{headers:{'content-type':'text/plain;charset=utf-8'}});
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{control.abort();reject(Error('Zeitlimit beim Laden von '+name+'. Bitte erneut öffnen.'));},20000);})
  ]);}catch(e){if(attempt||e.httpStatus&&e.httpStatus<500)throw e;}
  finally{clearTimeout(timer);control.abort();}
 }
}
async function combine(names){const list=await Promise.all(names.map(async name=>bytes((await (await get(name)).text()).trim())));const total=list.reduce((n,p)=>n+p.length,0);if(total>1500000)throw Error('Datenpaket ist ungewöhnlich groß.');const out=new Uint8Array(total);let at=0;for(const p of list){out.set(p,at);at+=p.length;}return out;}
$('login').onsubmit=async e=>{
 e.preventDefault();$('submit').disabled=true;$('status').textContent='Studio 28 wird geöffnet …';
 try{
  if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte aktuellen Browser über HTTPS verwenden.');
  const m=await (await get('bundle10.json')).json();if(m.version!==10||!Array.isArray(m.parts)||m.parts.length>50)throw Error('Ungültiges Softwarepaket.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode($('pin').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(m.salt),iterations:m.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const baseBytes=await combine(m.parts);let compressed;try{compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m.iv)},key,baseBytes);}catch{throw Error('PIN falsch oder Softwarepaket beschädigt. Bitte erneut eingeben.');}
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
    if(!(name in files)){if(name==='server.mjs')continue;throw Error('Fehlende Datei im Stabilitäts-Update: '+name);}
    if(await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 13: '+name);
    const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Stabilitäts-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=13;
   const m14=await (await get('upgrade14.json')).json();
   if(m14.version!==14||!Array.isArray(m14.parts)||m14.parts.length>20)throw Error('Ungültiges Geometrie-Update.');
   const b14=await combine(m14.parts);if(await hash(b14)!==m14.sha256)throw Error('Geometrie-Prüfsumme stimmt nicht. Bitte neu laden.');
   const p14=JSON.parse(await new Response(new Blob([b14]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
   const required14=['public/core.js','public/architecture.js','public/app.js','public/index.html'];
   if(p14.version!==14||!p14.changes||Object.keys(p14.changes).length!==required14.length)throw Error('Ungültiges Geometrie-Update.');
   for(const name of required14){
    const c=p14.changes[name];
    if(!c||!(name in files)||!Array.isArray(c.edits))throw Error('Unvollständiges Geometrie-Update: '+name);
    if(await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 14: '+name);
    const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Geometrie-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   const recovery14=await (await get('upgrade14-recovery.json')).json();
   const rd=recovery14.changes?.['public/data.js'];
   if(recovery14.version!==14||!rd||!Array.isArray(rd.edits)||await hash(files['public/data.js'])!==rd.base)throw Error('Quellstand für automatische Wiederaufnahme stimmt nicht.');
   const dl=files['public/data.js'].split('\n');for(const [i,n,add] of rd.edits.slice().reverse())dl.splice(i,n,...add);
   const recovered=dl.join('\n');if(await hash(recovered)!==rd.result)throw Error('Wiederaufnahme-Prüfsumme stimmt nicht.');files['public/data.js']=recovered;
   pack.version=14;
   const m15=await (await get('upgrade15.json')).json();
   if(m15.version!==15||!Array.isArray(m15.parts)||m15.parts.length>20)throw Error('Ungültiges Diagnose-Update.');
   const b15=await combine(m15.parts);if(await hash(b15)!==m15.sha256)throw Error('Diagnose-Prüfsumme stimmt nicht.');
   const p15=JSON.parse(await new Response(new Blob([b15]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
   const paths15=['public/architecture.js','public/app.js','public/worker.js','public/index.html','public/style.css','public/diagnostics.js'];
   if(p15.version!==15||Object.keys(p15.changes||{}).length!==paths15.length)throw Error('Unvollständiges Diagnose-Update.');
   for(const name of paths15){
    const c=p15.changes[name];if(!c)throw Error('Fehlende Update-Datei: '+name);
    if((name in files?await hash(files[name]):null)!==c.base)throw Error('Quellstand passt nicht zu Version 15: '+name);
    let value;if(c.content!==undefined)value=c.content;else{const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);value=lines.join('\n');}
    if(typeof value!=='string'||await hash(value)!==c.result)throw Error('Diagnose-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=15;
   const patch16=await (await get('upgrade16.json')).json();
   const names16=['public/data.js','public/index.html','public/diagnostics.js','public/app.js'];
   if(patch16.version!==16||!patch16.changes||Object.keys(patch16.changes).length!==names16.length)throw Error('Ungültiges Kartendienst-Update.');
   for(const name of names16){
    const c=patch16.changes[name];
    if(!c||!Array.isArray(c.edits)||!(name in files))throw Error('Fehlende Datei im Kartendienst-Update: '+name);
    if(await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 16: '+name);
    const lines=files[name].split('\n');for(const [start,count,add] of c.edits.slice().reverse())lines.splice(start,count,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Kartendienst-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=16;
   const patch17=await (await get('upgrade17.json')).json();
   const names17=['public/data.js','public/index.html','public/diagnostics.js','public/app.js'];
   if(patch17.version!==17||!patch17.changes||Object.keys(patch17.changes).length!==names17.length)throw Error('Ungültiges Zuverlässigkeits-Update.');
   for(const name of names17){
    const c=patch17.changes[name];
    if(!c||!Array.isArray(c.edits)||!(name in files)||await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 17: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Zuverlässigkeits-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=17;
   const patch18=await (await get('upgrade18.json')).json();
   const names18=['public/architecture.js','public/index.html','public/diagnostics.js','public/app.js'];
   if(patch18.version!==18||!patch18.changes||Object.keys(patch18.changes).length!==names18.length)throw Error('Ungültiges Geometrie-Update.');
   for(const name of names18){
    const c=patch18.changes[name];
    if(!c||!Array.isArray(c.edits)||!(name in files)||await hash(files[name])!==c.base)throw Error('Quellstand passt nicht zu Version 18: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);
    const value=lines.join('\n');if(await hash(value)!==c.result)throw Error('Geometrie-Prüfsumme stimmt nicht: '+name);files[name]=value;
   }
   pack.version=18;
   const p19=await (await get('upgrade19.json')).json(),names19=["public/app.js", "public/architecture.js", "public/core.js", "public/data.js", "public/diagnostics.js", "public/index.html", "public/worker.js"];
   if(p19.version!==19||Object.keys(p19.changes||{}).length!==names19.length)throw Error('Diagnose-Update unvollständig.');
   for(const name of names19){const c=p19.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Version 19 stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=19;
   const p20=await (await get('upgrade20.json')).json();
   const names20=['public/architecture.js','public/core.js','public/app.js','public/index.html','public/diagnostics.js'];
   if(p20.version!==20||Object.keys(p20.changes||{}).length!==names20.length)throw Error('Straßen-Update unvollständig.');
   for(const name of names20){const c=p20.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Straßenrelief stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=20;
   const p21=await (await get('upgrade21.json')).json();
   const names21=['public/architecture.js','public/core.js','public/app.js','public/index.html','public/diagnostics.js','public/worker.js','public/viewer.js'];
   if(p21.version!==21||Object.keys(p21.changes||{}).length!==names21.length)throw Error('Gewässer-Update unvollständig.');
   for(const name of names21){const c=p21.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Straßenrelief stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=21;
   const p22=await (await get('upgrade22.json')).json();
   const names22=["public/viewer.js", "public/app.js", "public/diagnostics.js", "public/index.html"];
   if(p22.version!==22||Object.keys(p22.changes||{}).length!==names22.length)throw Error('HD-Update unvollständig.');
   for(const name of names22){const c=p22.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für HD-Vorschau stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=22;
   const p23=await (await get('upgrade23.json')).json();
   const names23=["public/core.js", "public/architecture.js", "public/app.js", "public/diagnostics.js", "public/index.html"];
   if(p23.version!==23||Object.keys(p23.changes||{}).length!==names23.length)throw Error('Straßenkurven-Update unvollständig.');
   for(const name of names23){const c=p23.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Straßenkurven stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=23;
   const p24=await (await get('upgrade24.json')).json();
   const names24=["public/core.js", "public/architecture.js", "public/app.js", "public/diagnostics.js", "public/index.html", "public/viewer.js"];
   if(p24.version!==24||Object.keys(p24.changes||{}).length!==names24.length)throw Error('Gelände-Update unvollständig.');
   for(const name of names24){const c=p24.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Gelände stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=24;
   const p25=await (await get('upgrade25.json')).json();
   const names25=["public/architecture.js", "public/app.js", "public/diagnostics.js", "public/index.html"];
   if(p25.version!==25||Object.keys(p25.changes||{}).length!==names25.length)throw Error('Wandnaht-Update unvollständig.');
   for(const name of names25){const c=p25.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Wandnaht stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=25;
   const p26=await (await get('upgrade26.json')).json();
   const names26=["public/core.js", "public/data.js", "public/architecture.js", "public/app.js", "public/diagnostics.js", "public/index.html"];
   if(p26.version!==26||Object.keys(p26.changes||{}).length!==names26.length)throw Error('Gebäudeformen-Update unvollständig.');
   for(const name of names26){const c=p26.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Gebäudeformen stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=26;
   const p27=await (await get('upgrade27.json')).json();
   const names27=["public/app.js", "public/architecture.js", "public/core.js", "public/diagnostics.js", "public/index.html"];
   if(p27.version!==27||Object.keys(p27.changes||{}).length!==names27.length)throw Error('Gebäudeformen-Update unvollständig.');
   for(const name of names27){const c=p27.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Gebäudeformen stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=27;
   const p28=await (await get('upgrade28.json')).json();
   const names28=["public/app.js", "public/architecture.js", "public/core.js", "public/diagnostics.js", "public/index.html"];
   if(p28.version!==28||Object.keys(p28.changes||{}).length!==names28.length)throw Error('Gebäudeformen-Update unvollständig.');
   for(const name of names28){const c=p28.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Quellstand für Gebäudeformen stimmt nicht: '+name);
    const lines=files[name].split('\n');for(const [i,n,add] of c.edits.slice().reverse())lines.splice(i,n,...add);const v=lines.join('\n');if(await hash(v)!==c.result)throw Error('Prüfsumme stimmt nicht: '+name);files[name]=v;}
   pack.version=28;


  let html=files['public/index.html'];html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+files['public/style.css']+'</style>');
  const icon='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(files['public/favicon.svg'])));
  html=html.replaceAll('href="favicon.svg"','href="'+icon+'"').replaceAll('src="favicon.svg"','src="'+icon+'"');
  const worker=files['public/core.js']+'\n'+files['public/architecture.js']+'\n'+files['public/worker.js'].replace("importScripts('core.js','architecture.js');",'');
  const pre='<scr'+'ipt>window.RELIEF_STATIC_PREVIEW=true;window.RS_WORKER_SOURCE='+JSON.stringify(worker).replaceAll('</','<\\/')+';</scr'+'ipt>';
  html=html.replace('<script src="core.js">',()=>pre+'<script src="core.js">');
  html=html.replace(/<script src="([^\"]+)\.js"><\/script>/g,(_,name)=>'<scr'+'ipt>\n'+files['public/'+name+'.js'].replaceAll('</script','<\\/script')+'\n</scr'+'ipt>');
  window.RELIEF_SOURCE_FILES=files;$('pin').value='';document.open();document.write(html);document.close();
 }catch(error){
  $('status').textContent=error.message;$('submit').disabled=false;
  const diagnostic=$('gate-diagnose');if(diagnostic){diagnostic.hidden=false;diagnostic.onclick=()=>{
   const report={diagnostics:{application:'Relief Studio',release:'28.0.0',stage:'Studio öffnen',message:String(error.message),stack:String(error.stack||''),recordedAt:new Date().toISOString(),privacy:'Keine PIN oder Zugangsdaten enthalten. Nur lokaler Download.'}};
   const url=URL.createObjectURL(new Blob([JSON.stringify(report)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Relief-Studio-Start-Diagnose.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };}
 }
};
})();
