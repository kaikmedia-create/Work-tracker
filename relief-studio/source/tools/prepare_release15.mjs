/** Verify/reconstruct source snapshots 14 -> 15 without overwriting unknown edits. */
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(root,'..');
const hash=s=>createHash('sha256').update(s).digest('hex');
async function load(version){
 const manifest=JSON.parse(await readFile(resolve(site,'upgrade'+version+'.json'),'utf8'));
 if(manifest.version!==version||!Array.isArray(manifest.parts)||manifest.parts.length>20)throw Error('Invalid release manifest.');
 const chunks=[];for(const name of manifest.parts){if(!new RegExp('^upgrade'+version+'-\\d+\\.b64$').test(name))throw Error('Unsafe release part.');chunks.push(Buffer.from(await readFile(resolve(site,name),'utf8'),'base64'));}
 const packed=Buffer.concat(chunks);if(packed.length>1500000||hash(packed)!==manifest.sha256)throw Error('Release checksum mismatch.');
 const p=JSON.parse(gunzipSync(packed,{maxOutputLength:4000000}).toString('utf8'));
 if(p.version!==version||!p.changes)throw Error('Invalid release delta.');return p;
}
const p14=await load(14),recovery=JSON.parse(await readFile(resolve(site,'upgrade14-recovery.json'),'utf8')),p15=await load(15);
if(recovery.version!==14)throw Error('Invalid recovery delta.');
const chains=new Map();
for(const p of [p14,recovery,p15])for(const [name,c] of Object.entries({...p.changes,...p.sourceChanges})){
 if(!chains.has(name))chains.set(name,[]);chains.get(name).push(c);
}
const planned=[];
for(const [name,chain] of chains){
 const path=resolve(root,name);if(!path.startsWith(root+sep)||!(/^(public|tests|tools)\//).test(name))throw Error('Unsafe release path: '+name);
 let value=null;try{value=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 const original=value;
 for(let i=0;i<chain.length;i++){
  const c=chain[i],current=value===null?null:hash(value);
  if(current===c.result||chain.slice(i+1).some(next=>current===next.result))continue;
  if(current!==c.base&&!(c.compatibleBases||[]).includes(current))throw Error('Different source; refusing to overwrite: '+name);
  if(c.content!==undefined)value=c.content;
  else{
   const lines=value.split('\n');for(const [start,count,add] of c.edits.slice().reverse()){
    if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<0||start+count>lines.length||!Array.isArray(add))throw Error('Invalid source edit: '+name);
    lines.splice(start,count,...add);
   }value=lines.join('\n');
  }
  if(typeof value!=='string'||hash(value)!==c.result)throw Error('Corrupted source delta: '+name);
 }
 if(hash(value)!==chain.at(-1).result)throw Error('Final source mismatch: '+name);
 if(value!==original)planned.push({path,value});
}
for(const {path,value} of planned){await mkdir(dirname(path),{recursive:true});const temp=path+'.release15-'+process.pid;try{await writeFile(temp,value,'utf8');await rename(temp,path);}finally{await unlink(temp).catch(()=>{});}}
console.log('Release 15 verified; '+planned.length+' source file(s) reconstructed.');
