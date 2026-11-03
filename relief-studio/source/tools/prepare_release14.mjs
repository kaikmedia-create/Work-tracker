/** Reconstruct the checked-in release delta before npm start/test.
 * Existing edits are never overwritten. All hashes are verified before writing.
 * The same browser sources are used by gate-v14.js on GitHub Pages.
 */
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(resolve(root,'../upgrade14.json'),'utf8'));
if(manifest.version!==14||!Array.isArray(manifest.parts)||manifest.parts.length>20)throw Error('Invalid release manifest.');
const chunks=[];
for(const name of manifest.parts){
 if(!/^upgrade14-\d+\.b64$/.test(name))throw Error('Unsafe release part.');
 chunks.push(Buffer.from(await readFile(resolve(root,'..',name),'utf8'),'base64'));
}
const packed=Buffer.concat(chunks);
if(packed.length>1500000||createHash('sha256').update(packed).digest('hex')!==manifest.sha256)throw Error('Release checksum mismatch.');
const patch=JSON.parse(gunzipSync(packed,{maxOutputLength:4000000}).toString('utf8'));
if(patch.version!==14||!patch.changes)throw Error('Invalid release 14 source delta.');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex'),planned=[];
const recovery=JSON.parse(await readFile(resolve(root,'../upgrade14-recovery.json'),'utf8'));
if(recovery.version!==14||!recovery.changes?.['public/data.js']||Object.keys(recovery.changes).length!==1)throw Error('Invalid recovery source delta.');
const entries={...patch.changes,...patch.sourceChanges,...recovery.changes,...recovery.sourceChanges};
for(const [name,c] of Object.entries(entries)){
 const path=resolve(root,name);
 if(!path.startsWith(root+sep)||!(/^(public|tests|tools)\//).test(name))throw Error('Unsafe release path: '+name);
 let before=null;try{before=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(before!==null&&hash(before)===c.result)continue;
 if((before===null?null:hash(before))!==c.base&&!(c.compatibleBases||[]).includes(before===null?null:hash(before)))throw Error('Uncommitted or different source; refusing to overwrite: '+name);
 let after;
 if(c.content!==undefined)after=c.content;
 else{
  const lines=before.split('\n');
  for(const [start,count,add] of c.edits.slice().reverse()){
   if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<0||start+count>lines.length||!Array.isArray(add))throw Error('Invalid source edit: '+name);
   lines.splice(start,count,...add);
  }
  after=lines.join('\n');
 }
 if(typeof after!=='string'||hash(after)!==c.result)throw Error('Corrupted source delta: '+name);
 planned.push({path,after});
}
for(const {path,after} of planned){
 await mkdir(dirname(path),{recursive:true});
 const temp=path+'.release14-'+process.pid;
 try{await writeFile(temp,after,'utf8');await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}
}
console.log('Release 14 source integrity verified; '+planned.length+' file(s) reconstructed.');
