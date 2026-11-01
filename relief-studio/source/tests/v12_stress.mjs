import fs from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor12/pdf-lib.min.js',import.meta.url),'utf8'));
import '../public/core.js';import '../public/poster.js';import '../public/triptych-core.js';
const R=globalThis.RS,T=R.Triptych,id=Number(process.argv[2]||0),out=new URL('../reports/v12/',import.meta.url);
const base=JSON.parse(fs.readFileSync(new URL('fixture-poster.json',import.meta.url))),n=25000;
const data=base.data;data.buildings=[];data.terrain.available=false;data.terrain.values=[0,0,0,0];data.terrain.cols=data.terrain.rows=2;data.warnings=['SYNTHETISCHER STRESSTEST'];
for(let k=0;k<n;k++){const x=(k%160)/160,y=Math.floor(k/160)/160,a=.004;data.buildings.push({id:'stress/'+k,name:'',height:9,heightSource:'Synthetisch',landmark:false,tags:{building:'yes'},rings:[[[x,y],[x+a,y],[x+a,y+a],[x,y+a],[x,y]]]});}
const start=performance.now(),items=[];
for(let i=0;i<3;i++){const p={version:3,settings:{...base.settings,contours:false,hillshade:false,title:`STRESSTEST ${id+1} / ${i+1}`,subtitle:'25.000 SYNTHETISCHE GEBÄUDE'},data};items.push(await T.fromProject(p));}
const exports=[];
for(const [width,height] of [[800,600],[1000,700],[1189,841]]){const t=performance.now(),r=await T.compose(items,{width,height,gap:12+id,margin:18});if(r.bytes.length>8000000)throw Error('Oversize');const filename=`stress-${id}-${width}x${height}.pdf`;fs.writeFileSync(new URL(filename,out),r.bytes);exports.push({width,height,bytes:r.size,ms:Math.round(performance.now()-t),file:filename});}
fs.writeFileSync(new URL(`stress-${id}.json`,out),JSON.stringify({instance:id+1,cities:3,buildingsPerCity:n,exports,elapsedMs:Math.round(performance.now()-start),maxRssMiB:Math.round(process.resourceUsage().maxRSS/1024)},null,2));console.log('STRESS',id,'OK');
