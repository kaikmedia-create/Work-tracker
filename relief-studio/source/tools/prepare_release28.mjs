/** Verify/materialise release 17 -> 28; never overwrite unknown source edits. */
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {applyExportTransport,unapplyExportTransport} from '../public/export-transport.mjs';
import {applyUX29,unapplyUX29} from '../public/relief-ux29.mjs';
import {applySimpleStudio,unapplySimpleStudio} from '../public/studio-simple.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'..'),sha=s=>createHash('sha256').update(s).digest('hex'),chains=new Map(),planned=[];
for(const version of [17,18,19,20,21,22,23,24,25,26,27,28]){
 const p=JSON.parse(await readFile(resolve(site,'upgrade'+version+'.json'),'utf8'));
 if(p.version!==version||Object.keys(p.changes||{}).length!==(version>=27?5:version===26?6:version===25?4:version===24?6:version===23?5:version===22?4:version===21?7:version===20?5:version===19?7:4))throw Error('Invalid release '+version);
 for(const [name,c] of Object.entries({...p.changes,...p.sourceChanges})){if(!chains.has(name))chains.set(name,[]);chains.get(name).push(c);}
}
const phone=JSON.parse(await readFile(resolve(site,'upgrade28-phone.json'),'utf8'));
if(phone.version!=='28-phone.1'||Object.keys(phone.changes).join(',')!=='public/app.js')throw Error('Invalid phone patch');
chains.get('public/app.js').push(phone.changes['public/app.js']);
const city=JSON.parse(await readFile(resolve(site,'upgrade28-survey.json'),'utf8'));for(const [name,c] of Object.entries({...city.changes,...city.sourceChanges})){chains.get(name).push(c);}
const atlas=JSON.parse(await readFile(resolve(site,'upgrade28-atlas.json'),'utf8'));if(atlas.version!=='28-global-atlas-1')throw Error('Unknown atlas patch');for(const [name,c] of Object.entries({...atlas.changes,...atlas.sourceChanges})){if(!chains.has(name))throw Error('Unknown atlas target');chains.get(name).push(c);}
const hybrid=JSON.parse(await readFile(resolve(site,'upgrade28-hybrid.json'),'utf8'));if(hybrid.version!=='28-hybrid-1')throw Error('Unknown hybrid patch');for(const [name,c] of Object.entries(hybrid.changes)){if(!chains.has(name))throw Error('Unknown hybrid target');chains.get(name).push(c);}
const official=JSON.parse(await readFile(resolve(site,'upgrade28-official.json'),'utf8'));if(official.version!=='28-official-1')throw Error('Unknown official patch');for(const [name,c] of Object.entries({...official.changes,...official.sourceChanges})){if(!chains.has(name))chains.set(name,[]);chains.get(name).push(c);}
const bergen=JSON.parse(await readFile(resolve(site,'upgrade28-bergen.json'),'utf8'));
if(bergen.version!=='28-bergen-1'||Object.keys(bergen.changes||{}).join(',')!=='public/architecture.js')throw Error('Invalid Bergen geometry hotfix');
chains.get('public/architecture.js').push(bergen.changes['public/architecture.js']);
for(const [name,chain] of chains){
 if(!/^(?:public\/(?:data|app|diagnostics|architecture|core|worker|viewer)\.js|public\/index\.html|server\.mjs|tests\/(?:hybrid-buildings|no-height-review|v28_gate)\.test\.mjs|tests\/v(?:12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27)_gate\.test\.mjs)$/.test(name))throw Error('Unsafe release path: '+name);
 const path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('Unsafe target.');
 const original=await readFile(path,'utf8');const clean=unapplyUX29(name,unapplySimpleStudio(name,original));let value=name==='public/app.js'?unapplyExportTransport(clean):clean;
 for(let i=0;i<chain.length;i++){
  const c=chain[i],sum=sha(value);if(sum===c.result||chain.slice(i+1).some(next=>sum===next.result))continue;
  if(sum!==c.base)throw Error('Unknown source; refusing overwrite: '+name);
  const lines=value.split('\n');for(const [at,n,add] of c.edits.slice().reverse()){
   if(!Number.isInteger(at)||!Number.isInteger(n)||at<0||n<0||at+n>lines.length||!Array.isArray(add))throw Error('Invalid source edit: '+name);lines.splice(at,n,...add);
  }value=lines.join('\n');if(sha(value)!==c.result)throw Error('Corrupted release delta: '+name);
 }
 if(sha(value)!==chain.at(-1).result)throw Error('Final source mismatch: '+name);
 if(name==='public/app.js')value=applyExportTransport(value);
 const updated={[name]:value};applyUX29(updated);applySimpleStudio(updated);value=updated[name];
 if(value!==original)planned.push({path,value});
}
const cssPath=resolve(root,'public/style.css'),oldCss=await readFile(cssPath,'utf8'),styled={'public/style.css':unapplyUX29('public/style.css',unapplySimpleStudio('public/style.css',oldCss))};applyUX29(styled);applySimpleStudio(styled);if(styled['public/style.css']!==oldCss)planned.push({path:cssPath,value:styled['public/style.css']});
for(const {path,value} of planned){const tmp=path+'.release19-'+process.pid;try{await writeFile(tmp,value,'utf8');await rename(tmp,path);}finally{await unlink(tmp).catch(()=>{});}}
console.log('Release 28 + simple editor verified; '+planned.length+' source file(s) reconstructed.');
