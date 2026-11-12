export const baseSHA256='858f35084c9173b64ab7ae211cbf4c1940bdacbc9ebe2a8e6cacc678a8cd9a09';
export function composeGate(base){
 const anchor="  let html=files['public/index.html'];";
 if(base.split(anchor).length!==2)throw Error('Unbekannter Vorschau-Ausgangsstand.');
 const patch=`  const official=await(await get('upgrade28-official.json')).json();const names=['public/core.js','public/app.js','public/index.html','public/worker.js'];if(official.version!=='28-official-1'||Object.keys(official.changes||{}).length!==names.length)throw Error('Unvollständiges Flächen-Update.');for(const name of names){const c=official.changes[name];if(!c||!Array.isArray(c.edits)||await hash(files[name])!==c.base)throw Error('Flächen-Update: falscher Quellstand '+name);const lines=files[name].split('\\n');for(const [i,n,a] of c.edits.slice().reverse())lines.splice(i,n,...a);const value=lines.join('\\n');if(await hash(value)!==c.result)throw Error('Flächen-Update: Prüfsumme '+name);files[name]=value;}\n`;
 return base.replace(anchor,patch+anchor);
}
