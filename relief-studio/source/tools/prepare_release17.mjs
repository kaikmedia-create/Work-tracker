/** Materialise checked release-17 source deltas before start/test. Unknown edits are never overwritten. */
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'..');
const sha=s=>createHash('sha256').update(s).digest('hex');
const patch=JSON.parse(await readFile(resolve(site,'upgrade17.json'),'utf8'));
if(patch.version!==17||Object.keys(patch.changes||{}).length!==4)throw Error('Invalid release 17.');
const planned=[];
for(const [name,c] of Object.entries({...patch.changes,...patch.sourceChanges})){
 if(!/^(?:public\/(?:data|app|diagnostics)\.js|public\/index\.html|server\.mjs|tests\/v(?:12|13|14|15|16)_gate\.test\.mjs)$/.test(name))throw Error('Unsafe release path: '+name);
 const path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('Unsafe target.');
 const original=await readFile(path,'utf8'),sum=sha(original);if(sum===c.result)continue;
 if(sum!==c.base)throw Error('Unknown source version; refusing overwrite: '+name);
 const lines=original.split('\n');for(const [at,n,add] of c.edits.slice().reverse()){
  if(!Number.isInteger(at)||!Number.isInteger(n)||at<0||n<0||at+n>lines.length||!Array.isArray(add))throw Error('Invalid source edit: '+name);
  lines.splice(at,n,...add);
 }
 const value=lines.join('\n');if(sha(value)!==c.result)throw Error('Corrupted source delta: '+name);planned.push({path,value});
}
for(const {path,value} of planned){const tmp=path+'.release17-'+process.pid;try{await writeFile(tmp,value,'utf8');await rename(tmp,path);}finally{await unlink(tmp).catch(()=>{});}}
console.log('Release 17 verified; '+planned.length+' source file(s) reconstructed.');
