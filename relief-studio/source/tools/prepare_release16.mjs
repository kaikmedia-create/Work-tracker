/** Verify a current source checkout against the published v16 SHA-256 delta. */
import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'..');
const sha=s=>createHash('sha256').update(s).digest('hex');
const patch=JSON.parse(await readFile(resolve(site,'upgrade16.json'),'utf8'));
if(patch.version!==16||!patch.changes||Object.keys(patch.changes).length!==4)throw Error('Invalid v16 release manifest.');
let updated=0;
for(const [name,c] of Object.entries(patch.changes)){
 if(!/^public\/(?:data|app|index|diagnostics)\.js$/.test(name)&&name!=='public/index.html')throw Error('Unsafe source path: '+name);
 const path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('Unsafe target path.');
 const content=await readFile(path,'utf8'),sum=sha(content);
 if(sum===c.result)continue;
 if(sum!==c.base)throw Error('Unknown source version: '+name);
 const lines=content.split('\n');for(const [at,count,added] of c.edits.slice().reverse()){
  if(!Number.isInteger(at)||!Number.isInteger(count)||at<0||count<0||at+count>lines.length||!Array.isArray(added))throw Error('Invalid update: '+name);
  lines.splice(at,count,...added);
 }
 const value=lines.join('\n');if(sha(value)!==c.result)throw Error('Corrupted update: '+name);
 const tmp=path+'.v16-'+process.pid;await writeFile(tmp,value,'utf8');await rename(tmp,path);updated++;
}
console.log('Release 16 verified; '+updated+' source files reconstructed.');
