/** Verify/materialise release 17 -> 24; never overwrite unknown source edits. */
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'..'),sha=s=>createHash('sha256').update(s).digest('hex'),chains=new Map(),planned=[];
for(const version of [17,18,19,20,21,22,23,24]){
 const p=JSON.parse(await readFile(resolve(site,'upgrade'+version+'.json'),'utf8'));
 if(p.version!==version||Object.keys(p.changes||{}).length!==(version===24?6:version===23?5:version===22?4:version===21?7:version===20?5:version===19?7:4))throw Error('Invalid release '+version);
 for(const [name,c] of Object.entries({...p.changes,...p.sourceChanges})){if(!chains.has(name))chains.set(name,[]);chains.get(name).push(c);}
}
for(const [name,chain] of chains){
 if(!/^(?:public\/(?:data|app|diagnostics|architecture|core|worker|viewer)\.js|public\/index\.html|server\.mjs|tests\/v(?:12|13|14|15|16|17|18|19|20|21|22|23)_gate\.test\.mjs)$/.test(name))throw Error('Unsafe release path: '+name);
 const path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('Unsafe target.');
 const original=await readFile(path,'utf8');let value=original;
 for(let i=0;i<chain.length;i++){
  const c=chain[i],sum=sha(value);if(sum===c.result||chain.slice(i+1).some(next=>sum===next.result))continue;
  if(sum!==c.base)throw Error('Unknown source; refusing overwrite: '+name);
  const lines=value.split('\n');for(const [at,n,add] of c.edits.slice().reverse()){
   if(!Number.isInteger(at)||!Number.isInteger(n)||at<0||n<0||at+n>lines.length||!Array.isArray(add))throw Error('Invalid source edit: '+name);lines.splice(at,n,...add);
  }value=lines.join('\n');if(sha(value)!==c.result)throw Error('Corrupted release delta: '+name);
 }
 if(sha(value)!==chain.at(-1).result)throw Error('Final source mismatch: '+name);
 if(value!==original)planned.push({path,value});
}
for(const {path,value} of planned){const tmp=path+'.release19-'+process.pid;try{await writeFile(tmp,value,'utf8');await rename(tmp,path);}finally{await unlink(tmp).catch(()=>{});}}
console.log('Release 24 verified; '+planned.length+' source file(s) reconstructed.');
