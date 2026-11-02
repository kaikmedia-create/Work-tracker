from pathlib import Path
root=Path(__file__).resolve().parents[1]/'site'
s=(root/'gate-v4.js').read_text()
s=s.replace('/* Relief Studio 4 static preview.', '/* Relief Studio 5 static preview.')
s=s.replace("'?rs=4'","'?rs=5'")
s=s.replace('Studio 4 wird geöffnet','Studio 5 wird geöffnet')
anchor="  let html=files['public/index.html'];"
add='''  // Upgrade v4 -> v5. Every file is verified before execution.
  const m5=await(await get('upgrade5.json')).json();
  let delta5;
  try{delta5=await unpack(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m5.iv)},key,await partsB64(m5.parts)));}
  catch{throw Error('Studio 5 konnte nicht vollständig geladen werden. Verbindung prüfen und erneut laden.');}
  if(delta5.version!==5)throw Error('Unbekanntes Studio-5-Updateformat.');
  for(const [name,change] of Object.entries(delta5.changes)){
   const old=files[name]||'';
   if(await hash(old)!==change.base)throw Error('Updatekonflikt in '+name+'. Bitte Seite vollständig neu laden.');
   const lines=old.split('\\n');for(const [start,count,add] of change.edits.slice().reverse())lines.splice(start,count,...add);
   const updated=lines.join('\\n');
   if(await hash(updated)!==change.result)throw Error('Prüfsumme fehlt oder stimmt nicht: '+name);
   files[name]=updated;
  }
'''
assert anchor in s
s=s.replace(anchor,add+anchor)
(root/'gate-v5.js').write_text(s)
p=root/'index.html';t=p.read_text().replace('CARTOGRAPHIC ATELIER · 04','CARTOGRAPHIC ATELIER · 05').replace('Studio 4 wird geöffnet','Studio 5 wird geöffnet').replace('gate-v4.js?v=4','gate-v5.js?v=5');p.write_text(t)
print('gate-v5.js',len(s))
