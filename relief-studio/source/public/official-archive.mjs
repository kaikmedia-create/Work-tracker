/** Bounded ZIP/JSON reader; imported archive names are never filesystem paths. */
import {sourceError} from './official-geometry.mjs';
export async function readLimited(response,limit=24000000){
 if(!response.ok)throw sourceError('Datenquelle antwortet mit HTTP '+response.status,'SOURCE_HTTP');
 const chunks=[];let n=0;const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>limit)throw sourceError('Amtliche Daten überschreiten das Ladebudget.','SOURCE_LIMIT');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(n);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
}
export async function inflate(bytes,format,limit){
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader(),parts=[];let n=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>limit)throw sourceError('Entpackte Daten überschreiten das Größenlimit.','SOURCE_LIMIT');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const out=new Uint8Array(n);let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;
}
const table=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
const crc=b=>{let n=-1;for(const x of b)n=(n>>>8)^table[(n^x)&255];return (n^-1)>>>0;};
export async function readGMLZip(bytes){
 if(bytes.length>50000000||bytes.length<22)throw sourceError('Ungültige oder zu große CityGML-ZIP-Datei.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=i=>view.getUint16(i,true),u32=i=>view.getUint32(i,true);let end=bytes.length-22;
 while(end>=Math.max(0,bytes.length-65557)&&u32(end)!==0x06054b50)end--;
 if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10)||u16(end+10)>100)throw sourceError('Mehrteilige oder ungültige ZIP-Datei.');
 let p=u32(end+16),total=0;const files=[];
 for(let i=0;i<u16(end+10);i++){
  if(p+46>end||u32(p)!==0x02014b50)throw sourceError('Beschädigtes ZIP-Verzeichnis.');
  const flags=u16(p+8),method=u16(p+10),checksum=u32(p+16),compressed=u32(p+20),size=u32(p+24),nl=u16(p+28),xl=u16(p+30),cl=u16(p+32),offset=u32(p+42),name=new TextDecoder().decode(bytes.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
  if(!/\.gml$/i.test(name))continue;
  if(flags&1||![0,8].includes(method)||size>80000000||(total+=size)>160000000||offset+30>bytes.length||u32(offset)!==0x04034b50)throw sourceError('Nicht unterstütztes oder zu großes ZIP-Mitglied.');
  const start=offset+30+u16(offset+26)+u16(offset+28);if(start+compressed>u32(end+16))throw sourceError('Ungültige ZIP-Datengrenzen.');
  const raw=bytes.subarray(start,start+compressed),data=method===8?await inflate(raw,'deflate-raw',size):raw;
  if(data.length!==size||crc(data)!==checksum)throw sourceError('CityGML-Datei beschädigt (Prüfsumme).');files.push({name,text:new TextDecoder('utf-8',{fatal:true}).decode(data)});
 }
 if(!files.length)throw sourceError('ZIP enthält keine CityGML-Datei.');return files;
}
