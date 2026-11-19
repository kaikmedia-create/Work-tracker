/* The already committed c171a1e optimization was missing from the materializer
 * and encrypted preview chain. Normalize it only for hash verification, then
 * reapply the identical implementation. This changes indexing, not geometry. */
const before=' function change(i,add){for(let j=0;j<3;j++){const k=key(t[i+j],t[i+(j+1)%3]);let list=edges.get(k);if(add){if(!list)edges.set(k,list=[]);list.push(i);}else{const at=list.indexOf(i);if(at>=0)list.splice(at,1);if(!list.length)edges.delete(k);}}}';
const after=[
 ' // Track only edges incident to zero-area triangles. Scanning every triangle',
 ' // is necessary to locate their neighbors, but indexing millions of unrelated',
 ' // edges exhausts browser memory on dense cities such as Bergen.',
 ' const tracked=new Set();for(const i of zero)for(let j=0;j<3;j++)tracked.add(key(t[i+j],t[i+(j+1)%3]));',
 ' function change(i,add){for(let j=0;j<3;j++){const k=key(t[i+j],t[i+(j+1)%3]);if(!tracked.has(k))continue;let list=edges.get(k);if(add){if(!list)edges.set(k,list=[]);list.push(i);}else{const at=list.indexOf(i);if(at>=0)list.splice(at,1);if(!list.length)edges.delete(k);}}}'
].join('\n');
function replaceOne(source,a,b){if(source.split(a).length!==2)throw Error('Unbekannter Geometrie-Speicherpatch.');return source.replace(a,b);}
export function applyGeometryMemory(name,source){if(name!=='public/architecture.js')return source;if(source.includes(after))return source;return replaceOne(source,before,after);}
export function unapplyGeometryMemory(name,source){if(name!=='public/architecture.js'||!source.includes(after))return source;return replaceOne(source,after,before);}
