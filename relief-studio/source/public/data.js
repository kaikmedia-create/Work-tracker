/* Relief Studio 17: adaptive map packages, current Overpass providers, resumable 3D loads.
 * Public servers: at most two requests at once; never rotate to evade HTTP 429.
 */
(function(R){
'use strict';
const OVERPASS=['https://overpass.private.coffee/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter'];
// Independent Europe-only Overpass extract. Never query it outside its coverage.
const EUROPE_OVERPASS='https://ovp.dresel.systems/api/interpreter';
// Conservative subsets of the Europe extract; North Africa is NOT Europe.
const europeBounds=b=>Array.isArray(b)&&b.length===4&&[[-5,45,20,55],[-10,40,4,44]].some(r=>b[0]>=r[0]&&b[1]>=r[1]&&b[2]<=r[2]&&b[3]<=r[3]);
const endpointsFor=b=>europeBounds(b)?[EUROPE_OVERPASS,...OVERPASS]:OVERPASS;
const BODY_IDLE_MS=26000,BODY_MAX_MS=185000;
const abortError=()=>new DOMException('Abgebrochen','AbortError');
const send=(fn,e)=>{if(typeof fn==='function')fn(e);};
function error(code,message,extra={}){return Object.assign(new Error(message),{code,...extra});}
function check(signal){if(signal?.aborted)throw abortError();}
function pause(ms,signal){return new Promise((resolve,reject)=>{check(signal);const stop=()=>{clearTimeout(timer);reject(abortError());};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);signal?.addEventListener('abort',stop,{once:true});});}
async function timed(promise,ms,signal,message){
 check(signal);let timer,stop;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('IDLE',message)),ms);stop=()=>reject(abortError());signal?.addEventListener('abort',stop,{once:true});})]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
}
// content-length may be the compressed size, while the browser yields decoded bytes.
function knownLength(response){const h=response.headers,encoding=h?.get('content-encoding');const n=Number(h?.get('content-length'));return (!encoding||encoding==='identity')&&n>0?n:null;}
async function readBytes(response,limit,idle,options={}){
 const {signal,onActivity}=options,total=knownLength(response),maxTime=options.maxTime||BODY_MAX_MS;
 if(total>limit){response.body?.cancel().catch(()=>{});throw error('SIZE','Zu viele Kartendaten: sichere Obergrenze überschritten.');}
 check(signal);send(onActivity,{status:'headers',received:0,total});
 if(!response.body?.getReader){const b=new Uint8Array(await timed(response.arrayBuffer(),idle,signal,'Datendienst hat keine Daten übertragen.'));if(b.length>limit)throw error('SIZE','Zu viele Kartendaten: sichere Obergrenze überschritten.');check(signal);send(onActivity,{status:'bytes',received:b.length,total,complete:true});return b;}
 const reader=response.body.getReader(),chunks=[];let size=0,lastReport=0,finished=false;const start=Date.now();
 try{while(true){
  const left=maxTime-(Date.now()-start);if(left<=0)throw error('IDLE','Die maximale Übertragungszeit dieses Datenpakets wurde erreicht.');
  const part=await timed(reader.read(),Math.min(idle,left),signal,size?'Datenübertragung steht still. Bereits geladene Pakete bleiben gespeichert.':'Datendienst hat keine Daten übertragen.');check(signal);
  if(part.done){finished=true;break;}if(!part.value?.byteLength)continue;
  size+=part.value.byteLength;if(size>limit)throw error('SIZE','Zu viele Kartendaten: sichere Obergrenze überschritten.');chunks.push(part.value);
  if(Date.now()-lastReport>100){send(onActivity,{status:'bytes',received:size,total});lastReport=Date.now();}
 }
 send(onActivity,{status:'bytes',received:size,total,complete:true});const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.byteLength;}return all;
 }finally{if(!finished)reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}
}
async function readJSONLimited(response,limit=23000000,idle=BODY_IDLE_MS,options={}){
 const bytes=await readBytes(response,limit,idle,options);await pause(0,options.signal);send(options.onActivity,{status:'parsing',received:bytes.length,total:knownLength(response)});
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw error('FORMAT','Kartendienst hat keine lesbare JSON-Antwort geliefert.');}
}
async function request(url,options={},timeout=40000){
 const controller=new AbortController(),source=options.signal,abort=()=>controller.abort();check(source);source?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeout);
 try{const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok){r.body?.cancel().catch(()=>{});const retryAfter=r.headers?.get('retry-after');throw error(r.status===429?'RATE_LIMIT':r.status>=500?'SERVER':'HTTP',r.status===429?'Zu viele Anfragen beim Kartendienst (HTTP 429). Bitte nach der angezeigten Pause erneut versuchen.':`Datendienst derzeit nicht erreichbar (HTTP ${r.status}).`,{status:r.status,retryAfter});}return r;}
 catch(e){if(source?.aborted)throw abortError();if(controller.signal.aborted)throw error('HEADER_TIMEOUT','Der Kartendienst liefert noch keine Antwort.');if(e instanceof TypeError)throw error('NETWORK','Verbindung zum Kartendienst unterbrochen.');throw e;}
 finally{clearTimeout(timer);source?.removeEventListener('abort',abort);}
}
const boxText=b=>[b[1],b[0],b[3],b[2]].map(x=>x.toFixed(6)).join(',');
const WAY_FILTERS='way[building][building!="no"];way["building:part"];way[man_made~"^(tower|lighthouse)$"];way[barrier=wall];way[historic=citywalls];way[highway];way[waterway];way[natural=water];way[natural=coastline];way[water];way[landuse~"^(forest|grass)$"];way[natural=wood];way[leisure=park];';
const REL_FILTERS='relation[type=multipolygon][building][building!="no"];relation[type=multipolygon]["building:part"];relation[type=multipolygon][natural=water];relation[type=multipolygon][water];relation[type=multipolygon][waterway=riverbank];';
function osmQuery(b,layer='base'){
 if(!['base','geometry','relations'].includes(layer))throw Error('Unbekannte Kartenebene.');
 // qt avoids sorting thousands of objects by ID. Keep FULL polygon geometry:
 // clipping relation members on the server would create false coastlines/holes.
 return `[out:json][timeout:25][maxsize:134217728][bbox:${boxText(b)}];(${layer!=='relations'?WAY_FILTERS:''}${layer!=='geometry'?REL_FILTERS:''});out geom qt;${layer==='geometry'?'':'relation[type=building];out body qt;'}`; 
}
function poiQuery(b){return `[out:json][timeout:8][maxsize:33554432][bbox:${boxText(b)}];(nwr[historic][name];nwr[heritage][name];nwr[man_made~"^(tower|lighthouse)$"][name];nwr[tourism~"^(museum|artwork|attraction|gallery|viewpoint)$"][name];nwr[amenity=place_of_worship][name];);out center qt;`;}
// The cache has a stable name and bounded disk + RAM usage. Storage never blocks a
// network load indefinitely (Safari private mode / blocked IDB upgrades included).
function createCache(){
 const memory=new Map();let bytes=0,opening;
 const MAX=48*1024*1024,TTL=72*3600000;
 const remember=(k,record)=>{if(memory.has(k))bytes-=memory.get(k).size;memory.delete(k);memory.set(k,record);bytes+=record.size;while(bytes>MAX&&memory.size){const key=memory.keys().next().value;bytes-=memory.get(key).size;memory.delete(key);}};
 async function db(){if(opening)return opening;opening=new Promise(resolve=>{let done=false;const finish=v=>{if(done){v?.close();return;}done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>finish(null),700);try{const req=indexedDB.open('relief-data-packages',1);req.onupgradeneeded=()=>{req.result.createObjectStore('data');req.result.createObjectStore('meta');};req.onsuccess=()=>finish(req.result);req.onerror=req.onblocked=()=>finish(null);}catch{finish(null);}});return opening;}
 async function diskGet(k){const d=await db();if(!d)return null;return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>finish(null),700);try{const t=d.transaction('data','readonly'),q=t.objectStore('data').get(k);q.onsuccess=()=>finish(q.result);q.onerror=()=>finish(null);}catch{finish(null);}});}
 return {
  async get(k){let value=memory.get(k)||await diskGet(k);if(!value||value.expires<Date.now())return null;remember(k,value);return value.data;},
  async set(k,data,ttl=TTL){let size;try{size=data instanceof Blob?data.size:JSON.stringify(data).length*2;}catch{return;}if(size>16*1024*1024)return;const record={data,size,expires:Date.now()+ttl,used:Date.now()};remember(k,record);const d=await db();if(!d)return;
   await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};const timer=setTimeout(finish,700);try{const t=d.transaction(['data','meta'],'readwrite'),s=t.objectStore('data'),meta=t.objectStore('meta');s.put(record,k);meta.put({key:k,size,used:record.used},k);const q=meta.getAll();q.onsuccess=()=>{let entries=q.result.sort((a,b)=>a.used-b.used),n=entries.reduce((sum,x)=>sum+x.size,0);while((n>MAX||entries.length>64)&&entries.length){const first=entries.shift();s.delete(first.key);meta.delete(first.key);n-=first.size;}};t.oncomplete=t.onerror=t.onabort=finish;}catch{finish();}});
  }
 };
}
function splitBounds(b){const d=R.boundsInfo(b),c=R.project([b[0],b[1]]),e=R.project([b[2],b[3]]);if(d.w>=d.h){const x=R.unproject([(c[0]+e[0])/2,c[1]])[0];return [[b[0],b[1],x,b[3]],[x,b[1],b[2],b[3]]];}const y=R.unproject([c[0],(c[1]+e[1])/2])[1];return [[b[0],b[1],b[2],y],[b[0],y,b[2],b[3]]];}
function initialParts(b,mode='poster'){let parts=[b.slice()];const area=mode==='model'?8e6:16e6,maximum=mode==='model'?24:16;while(parts.length<maximum){const at=parts.findIndex(p=>{const d=R.boundsInfo(p);return d.w*d.h>area;});if(at<0)break;parts.splice(at,1,...splitBounds(parts[at]));}return parts;}
function mergeOSM(raws){const objects=new Map(),dates=[];for(const raw of raws){if(raw.osm3s?.timestamp_osm_base)dates.push(raw.osm3s.timestamp_osm_base);for(const e of raw.elements||[]){const id=e.type+'/'+e.id,old=objects.get(id);if(!old){objects.set(id,e);continue;}const og=old.geometry?.length||old.members?.length||0,ng=e.geometry?.length||e.members?.length||0;const richer=ng>og?e:old;objects.set(id,{...richer,tags:{...old.tags,...e.tags}});}}return {elements:[...objects.values()],osm3s:{timestamp_osm_base:dates.sort()[0]||null}};}
// Dependency injection lets tests exercise actual network/caching code, not replace
// the complete loader with a fake success function.
function createDataLoader(options={}){
 // A 25-second server query plus admission delay must fit on EVERY provider.
 const cfg={headerMs:45000,serverHeaderMs:135000,poiMs:12000,idleMs:BODY_IDLE_MS,bodyMs:BODY_MAX_MS,sessionMs:180000,retryMs:800,maxRequests:64,resumeAttempts:1,...options.config};
 const fetcher=options.fetch||((...a)=>fetch(...a)),cache=options.cache||createCache(),flights=new Map(),queue=[];
 let active=0,preferred=0,cooldown=0;
 function drain(){while(active<2&&queue.length){const job=queue.shift();job.signal?.removeEventListener('abort',job.cancel);if(job.signal?.aborted){job.reject(abortError());continue;}active++;Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
 function slot(signal,work){return new Promise((resolve,reject)=>{check(signal);const job={signal,work,resolve,reject};job.cancel=()=>{const i=queue.indexOf(job);if(i>=0)queue.splice(i,1);reject(abortError());};signal?.addEventListener('abort',job.cancel,{once:true});queue.push(job);drain();});}
 function shared(key,signal,observer,work){
  check(signal);let f=flights.get(key);if(f?.controller.signal.aborted){flights.delete(key);f=null;}
  if(!f){f={controller:new AbortController(),subscribers:new Set()};flights.set(key,f);f.promise=Promise.resolve().then(()=>work(f.controller.signal,e=>{for(const s of f.subscribers)send(s.observer,e);})).finally(()=>{if(flights.get(key)===f)flights.delete(key);});f.promise.catch(()=>{});}
  return new Promise((resolve,reject)=>{const sub={observer};let finished=false;const clean=()=>{f.subscribers.delete(sub);signal?.removeEventListener('abort',stop);};const stop=()=>{if(finished)return;finished=true;clean();if(!f.subscribers.size)f.controller.abort();reject(abortError());};f.subscribers.add(sub);signal?.addEventListener('abort',stop,{once:true});f.promise.then(value=>{if(finished)return;finished=true;clean();resolve(value);},e=>{if(finished)return;finished=true;clean();reject(e);});});
 }
 async function wire(url,params,signal,onActivity,headerMs=cfg.headerMs,limit=23000000){
  const control=new AbortController(),stop=()=>control.abort();check(signal);signal?.addEventListener('abort',stop,{once:true});let headerTimedOut=false;const timer=setTimeout(()=>{headerTimedOut=true;control.abort();},headerMs);
  try{const response=await fetcher(url,{...params,signal:control.signal});clearTimeout(timer);check(signal);
   if(!response.ok){response.body?.cancel().catch(()=>{});if(response.status===429){const h=response.headers?.get('retry-after'),n=Number(h),until=Number.isFinite(n)&&h?Date.now()+n*1000:Date.parse(h||'');cooldown=Math.max(cooldown,Number.isFinite(until)?until:Date.now()+30000,Date.now()+30000);throw error('RATE_LIMIT',`Kartendienst begrenzt Anfragen. In ${Math.ceil((cooldown-Date.now())/1000)} s erneut versuchen; fertige Pakete bleiben erhalten.`,{retryAt:cooldown,status:429});}throw error(response.status>=500?'SERVER':'HTTP',`Kartendienst antwortet mit HTTP ${response.status}.`,{status:response.status});}
   const result=await readJSONLimited(response,limit,cfg.idleMs,{signal:control.signal,onActivity,maxTime:cfg.bodyMs});
   if(result.remark)throw error(/timed out|timeout|out of memory|memory/i.test(result.remark)?'QUERY_TIMEOUT':'INCOMPLETE','Kartendienst lieferte keine vollständigen Daten: '+String(result.remark).slice(0,180));
   if(!Array.isArray(result.elements))throw error('FORMAT','Ungültige Kartendaten vom Server.');return result;
  }catch(e){if(signal?.aborted)throw abortError();if(headerTimedOut)throw error('HEADER_TIMEOUT','Kartendienst hat noch keine Daten geliefert.');if(e instanceof TypeError)throw error('NETWORK','Verbindung zum Kartendienst unterbrochen.');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);control.abort();}
 }
 function completePackage(raw){return raw&&Array.isArray(raw.elements)&&!raw.remark;}
 function allowed(){if(Date.now()<cooldown)throw error('RATE_LIMIT',`Kartendienst-Pause: noch ${Math.ceil((cooldown-Date.now())/1000)} s. Bereits geladene Pakete bleiben gespeichert.`,{retryAt:cooldown});}
 function keyFor(b,layer){return 'osm12:'+layer+':'+b.map(x=>x.toFixed(6)).join(',');}
 async function getOSMLayer(b,signal,layer,onProgress,opts={}){
  const key=keyFor(b,layer),phase=layer==='pois'?'pois':'base';check(signal);
  if(!opts.refresh){const saved=await cache.get(key);check(signal);if(completePackage(saved)){send(onProgress,{phase,status:'cached',detail:'Datenpaket aus lokalem Speicher.'});return saved;}}
  return shared((R.server?'server:':'public:')+key,signal,onProgress,async(signal,emit)=>{
   // Shared across simultaneous same-area loads; successful package persists before
   // the overall map completes, so retrying never discards already finished work.
   let last;const endpoints=endpointsFor(b),attempts=layer==='pois'||R.server?1:endpoints.length,startEndpoint=preferred,failures=[];
   for(let i=0;i<attempts;i++){
    check(signal);if(Date.now()<cooldown)throw error('RATE_LIMIT',`Kartendienst-Pause: noch ${Math.ceil((cooldown-Date.now())/1000)} s. Bereits geladene Pakete bleiben gespeichert.`,{retryAt:cooldown});
    const index=(startEndpoint+i)%endpoints.length,endpoint=endpoints[index],service=R.server?'Studio-Server':new URL(endpoint).hostname;
    const attemptStart=Date.now();emit({phase,layer,service,status:'waiting',attempt:i+1,attempts,detail:(i?'Anderer Datendienst wird versucht: ':'Kartenpaket wird angefragt: ')+service});
    try{
     const value=await slot(signal,()=>{allowed();
      if(Number.isFinite(opts.requests)){if(opts.requests>=cfg.maxRequests)throw error('BUDGET','Anfragelimit erreicht. Fertige Pakete bleiben gespeichert; bitte erneut versuchen.');opts.requests++;}
      return wire(R.server?`api/map?bbox=${encodeURIComponent(b.join(','))}&layer=${layer}&mode=${opts.mode||'poster'}`:endpoint,R.server?{}:{method:'POST',body:new URLSearchParams({data:layer==='pois'?poiQuery(b):osmQuery(b,layer)})},signal,e=>emit({phase,layer,attempt:i+1,attempts,...e}),layer==='pois'?cfg.poiMs:R.server?cfg.serverHeaderMs:cfg.headerMs,layer==='pois'?5000000:layer==='geometry'?8000000:23000000);});
     if(!R.server)preferred=index;emit({phase,layer,service,status:'response-complete',attempt:i+1,durationMs:Date.now()-attemptStart,count:value.elements.length});await cache.set(key,value);check(signal);return value;
    }catch(e){check(signal);last=e;const durationMs=Date.now()-attemptStart;failures.push({service,code:e.code||'UNKNOWN',status:e.status||null,durationMs});emit({phase,layer,service,status:'attempt-failed',code:e.code,attempt:i+1,attempts,httpStatus:e.status,durationMs});
     if(['RATE_LIMIT','BUDGET','QUERY_TIMEOUT','SIZE','INCOMPLETE','HTTP'].includes(e.code)||i+1===attempts)break;
     emit({phase,status:'retry',detail:service+': '+e.message+' Weiterer Datendienst wird versucht.'});await pause(cfg.retryMs,signal);}
   }
   if(last){last.diagnostics={...(last.diagnostics||{}),layer,bounds:b.slice(),attemptedProviders:failures};throw last;}
   throw Error('Kartendienst nicht verfügbar.');
  });
 }
 // Split only incomplete compulsory geometry and relation tiles on recoverable
 // slow-service errors. Never rotate/split in response to HTTP 429.
 async function requiredTask(b,layer,signal,onProgress,ctx,depth=0){
  // A complete parent supersedes obsolete subdivision plans. Otherwise a
  // force-refresh success can still cause the same missing child to be fetched.
  const key=keyFor(b,layer),saved=ctx.refresh?null:await cache.get(key);check(signal);
  if(completePackage(saved)){
   ctx.done++;send(onProgress,{phase:'base',status:'cached',layer,detail:'Vollständiges Datenpaket aus lokalem Speicher.'});
   send(onProgress,{phase:'base',status:'part',done:ctx.done,total:ctx.total,detail:`${ctx.done} von ${ctx.total} Kartenpaketen vollständig geladen.`});return saved;
  }
  const planKey='plan:'+key;let plan=ctx.refresh?null:await cache.get(planKey);check(signal);
  if(Array.isArray(plan)&&plan.length===2&&depth<5){
   ctx.total++;return mergeOSM(await Promise.all(plan.map(p=>requiredTask(p,layer,signal,onProgress,ctx,depth+1))));
  }
  try{
   const raw=await getOSMLayer(b,signal,layer,onProgress,ctx);
   ctx.done++;send(onProgress,{phase:'base',status:'part',done:ctx.done,total:ctx.total,detail:`${ctx.done} von ${ctx.total} Kartenpaketen vollständig geladen.`});
   return raw;
  }catch(e){
   check(signal);const dims=R.boundsInfo(b);
   if(['QUERY_TIMEOUT','SIZE','HEADER_TIMEOUT','IDLE','SERVER'].includes(e.code)&&depth<5&&Math.min(dims.w,dims.h)>140){
    const children=splitBounds(b);await cache.set(planKey,children);check(signal);ctx.total++;
    send(onProgress,{phase:'base',status:'part',done:ctx.done,total:ctx.total,detail:'Datendienst zu langsam: Teilbereich wird verkleinert. Fertige Pakete bleiben erhalten.'});
    return mergeOSM(await Promise.all(children.map(p=>requiredTask(p,layer,signal,onProgress,ctx,depth+1))));
   }
   e.diagnostics={...(e.diagnostics||{}),layer,bounds:b.slice(),completedPackages:ctx.done,totalPackages:ctx.total};
   send(onProgress,{phase:'base',status:'error',layer,code:e.code||'UNKNOWN',detail:'Das fehlende Kartenpaket konnte nach mehreren Versuchen nicht vollständig geladen werden.'});
   throw e;
  }
 }
 async function loadMap(bounds,{signal,onProgress,refresh=false,terrainRequired=true,mode='model'}={}){
  R.validateBounds(bounds,mode);check(signal);const control=new AbortController(),stop=()=>control.abort(),started=Date.now();signal?.addEventListener('abort',stop,{once:true});let expired=false;const deadline=setTimeout(()=>{expired=true;stop();},cfg.sessionMs);
  const local=control.signal,parts=initialParts(bounds,mode),ctx={done:0,total:parts.length+1,requests:0,mode,refresh};
  const placeholder={cols:2,rows:2,values:[0,0,0,0],available:false,source:'Nicht geladen – reines 2D-Poster'};
  // Heights are independent; any failed height load must not erase raw OSM cache.
  const terrainPromise=terrainRequired?terrainData(bounds,local,onProgress,cache,refresh).then(value=>({value}),e=>{
   if(e.name==='AbortError')throw e;
   throw error('TERRAIN','Geländedaten: '+e.message+' Vollständige Kartenpakete bleiben gespeichert.',{diagnostics:{...e.diagnostics,cause:e.code||'TERRAIN',status:e.status||null,completedPackages:ctx.done,totalPackages:ctx.total}});
  }):Promise.resolve({value:placeholder});
  terrainPromise.catch(()=>{});
  try{
   send(onProgress,{phase:'base',status:'part',done:0,total:ctx.total,detail:`${ctx.total} überschaubare Kartenpakete; maximal zwei Anfragen gleichzeitig.`});
   const geoPromise=Promise.all(parts.map(b=>requiredTask(b,'geometry',local,onProgress,ctx)));
   const relPromise=requiredTask(bounds,'relations',local,onProgress,ctx);
   const [geometry,relations,height]=await Promise.all([geoPromise,relPromise,terrainPromise]);check(local);
   const raw=mergeOSM([...geometry,relations]);send(onProgress,{phase:'base',status:'done',count:raw.elements.length,detail:'Alle erforderlichen Kartenpakete geladen.'});
   // POIs are optional: one bounded request, no two 45-second fallback waits.
   const optional=new AbortController(),cancelOptional=()=>optional.abort();local.addEventListener('abort',cancelOptional,{once:true});const poiTimer=setTimeout(cancelOptional,cfg.poiMs);let poi,warnings=[];
   try{poi=await getOSMLayer(bounds,optional.signal,'pois',onProgress,{mode,refresh});send(onProgress,{phase:'pois',status:'done',count:poi.elements.length,detail:'Historische Orte geladen.'});}
   catch(e){check(local);warnings.push('Zusätzliche historische Orte konnten nicht geladen werden. Die vollständigen Gebäude, Straßen und Wasserflächen bleiben nutzbar; erneutes Laden ergänzt fehlende Marker aus dem Cache.');send(onProgress,{phase:'pois',status:'skipped',detail:'Zusätzliche Marker vorerst übersprungen – Karte bleibt nutzbar.'});}
   finally{clearTimeout(poiTimer);local.removeEventListener('abort',cancelOptional);optional.abort();}
   check(local);
   send(onProgress,{phase:'process',status:'working',detail:'Vollständige Kartenpakete werden zusammengeführt.'});await pause(0,local);
   const features=R.parseOSM(mergeOSM([raw,poi||{elements:[]}]),bounds);check(local);
   const data={version:2,coastlineVersion:8,bounds:bounds.slice(),terrain:height.value,...features,capturedAt:new Date().toISOString(),osmTimestamp:raw.osm3s?.timestamp_osm_base||null,source:'OpenStreetMap contributors · ODbL 1.0',realData:true,loadStats:{packages:ctx.done,requests:ctx.requests,durationMs:Date.now()-started},loaderVersion:11,architectureSourceVersion:12};
   data.warnings.push(...warnings);if(!features.buildings.length)data.warnings.push('Keine Gebäude im geladenen Ausschnitt erfasst.');send(onProgress,{phase:'process',status:'done',count:data.buildings.length,detail:'Karte vollständig aufbereitet.'});return data;
  }catch(e){stop();if(expired&&!signal?.aborted)throw error('DEADLINE','Gesamtzeit erreicht. Vollständige Datenpakete sind gespeichert; „Erneut versuchen“ lädt nur Fehlendes.',{completedPackages:ctx.done,totalPackages:ctx.total,diagnostics:{completedPackages:ctx.done,totalPackages:ctx.total,elapsedMs:Date.now()-started,requests:ctx.requests}});if(signal?.aborted)throw abortError();throw e;}
  finally{clearTimeout(deadline);signal?.removeEventListener('abort',stop);}
 }
 // One bounded continuation is allowed only after real required packages completed.
 // Keep caches, never bypass 429, never restart after user cancellation or zero progress.
 async function loadResumable(bounds,opts={}){
  const started=Date.now(),limit=Math.min(1,Math.max(0,Number(cfg.resumeAttempts)||0));
  for(let recovery=0;;recovery++){
   try{
    const data=await loadMap(bounds,recovery?{...opts,refresh:false}:opts);
    data.loadStats={...data.loadStats,durationMs:Date.now()-started,resumeAttempts:recovery};return data;
   }catch(e){
    check(opts.signal);
    if(e.code!=='DEADLINE'||!(e.completedPackages>0)||recovery>=limit)throw e;
    send(opts.onProgress,{phase:'base',status:'retry',recovery:true,done:e.completedPackages,total:e.totalPackages,
     detail:`${e.completedPackages} von ${e.totalPackages} Kartenpaketen sind gespeichert. Fehlende Daten werden einmal automatisch nachgeladen; fertige Pakete bleiben erhalten.`});
    await pause(cfg.retryMs,opts.signal);
   }
  }
 }
 return {loadMap:loadResumable,getOSMLayer,cache,diagnostics:()=>({active,queued:queue.length,inFlight:flights.size,cooldownUntil:cooldown})};
}
async function searchPlace(q,signal){
 const query=String(q).trim().slice(0,140);if(query.length<2)throw Error('Bitte mindestens zwei Zeichen eingeben.');
 const url=R.server?`api/search?q=${encodeURIComponent(query)}`:`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=de`;
 const json=await readJSONLimited(await request(url,{signal},20000),1_000_000,20000,{signal});
 return (json.features||[]).map(f=>({lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],name:f.properties.name||f.properties.city||query,label:[f.properties.name,f.properties.city,f.properties.state,f.properties.country].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · '),region:f.properties.state||'',country:f.properties.country||'',countryCode:String(f.properties.countrycode||'').toUpperCase()}));
}
async function reverseRegion(lon,lat,code='',signal){
 if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error('Koordinaten sind ungültig.');
 const lang=String(code).toUpperCase()==='DE'?'de':'en';
 const url=R.server?`api/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&lang=${lang}`:`https://photon.komoot.io/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&limit=8&lang=${lang}`;
 const json=await readJSONLimited(await request(url,{signal},15000),1000000,15000,{signal});
 const features=(json.features||[]).filter(f=>f?.properties?.state||f?.properties?.countrycode);
 const first=features.find(f=>f.properties.state&&f.properties.countrycode)||features[0];
 if(!first)throw Error('Der Ort konnte keiner Region zugeordnet werden. Bitte Region manuell eintragen.');
 return {region:first.properties.state||'',countryCode:String(first.properties.countrycode||code||'').toUpperCase(),country:first.properties.country||''};
}
function tileXY(lon,lat,z){const k=2**z,p=R.project([lon,lat]),extent=Math.PI*6378137;return [(p[0]+extent)/(2*extent)*k,(extent-p[1])/(2*extent)*k];}
async function terrainData(bounds,signal,onProgress,cache,refresh=false){
 const info=R.boundsInfo(bounds),cols=R.clamp(Math.round(info.w/25)+1,65,257),rows=R.clamp(Math.round(info.h/25)+1,65,257);
 let z=14,a,b;do{a=tileXY(bounds[0],bounds[3],z);b=tileXY(bounds[2],bounds[1],z);if((Math.floor(b[0])-Math.floor(a[0])+1)*(Math.floor(b[1])-Math.floor(a[1])+1)<=48)break;z--;}while(z>9);
 const jobs=[];for(let y=Math.floor(a[1]);y<=Math.floor(b[1]);y++)for(let x=Math.floor(a[0]);x<=Math.floor(b[0]);x++)jobs.push([x,y]);
 const tiles=new Map();let next=0,done=0;send(onProgress,{phase:'terrain',status:'tiles',done:0,total:jobs.length,detail:`${jobs.length} Höhenkacheln zu laden`});
 const work=async()=>{while(next<jobs.length){if(signal?.aborted)throw abortError();const [x,y]=jobs[next++],url=R.server?`api/terrain/${z}/${x}/${y}.png`:`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,tileKey=`terrain11:${z}/${x}/${y}`;const tile=`${z}/${x}/${y}`,service=R.server?'Studio-Server':'s3.amazonaws.com';let rgba;
  try{
   let blob=refresh?null:await cache?.get(tileKey);check(signal);
   async function pixels(bytes){
    const image=typeof createImageBitmap==='function'?await createImageBitmap(bytes):await new Promise((resolve,reject)=>{const im=new Image(),u=URL.createObjectURL(bytes);im.onload=()=>{URL.revokeObjectURL(u);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('PNG nicht lesbar.'));};im.src=u;});
    try{if(image.width!==256||image.height!==256)throw Error('Erwartet: 256 × 256 Pixel.');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return ctx.getImageData(0,0,256,256).data;}finally{image.close?.();}
   }
   if(blob)try{rgba=await pixels(blob);}catch{send(onProgress,{phase:'terrain',status:'cache-invalid',tile,detail:'Gespeicherte Höhenkachel nicht lesbar. Sie wird neu geladen.'});}
   if(!rgba)for(let attempt=0;attempt<2;attempt++)try{
    const response=await request(url,{signal},25000);blob=new Blob([await readBytes(response,1000000,15000,{signal,maxTime:45000})],{type:'image/png'});
    try{rgba=await pixels(blob);}catch{throw error('TILE_DECODE','Höhenkachel nicht als 256 × 256-Pixel-PNG lesbar.');}
    check(signal);await cache?.set(tileKey,blob,7*24*3600000);break;
   }catch(e){check(signal);send(onProgress,{phase:'terrain',status:'attempt-failed',tile,service,attempt:attempt+1,code:e.code,httpStatus:e.status});if(attempt||['RATE_LIMIT','HTTP'].includes(e.code))throw e;await pause(500,signal);}
   check(signal);
  }catch(e){e.diagnostics={...e.diagnostics,tile,service,completedTiles:done,totalTiles:jobs.length};throw e;}
  const h=new Float32Array(65536);for(let i=0;i<h.length;i++)h[i]=rgba[i*4]*256+rgba[i*4+1]+rgba[i*4+2]/256-32768;tiles.set(x+','+y,h);done++;send(onProgress,{phase:'terrain',status:'tiles',done,total:jobs.length,detail:`${done} von ${jobs.length} Höhenkacheln empfangen`});
 }};
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},work));
 const values=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const tx=a[0]+(b[0]-a[0])*c/(cols-1),ty=a[1]+(b[1]-a[1])*r/(rows-1),ix=Math.floor(tx),iy=Math.floor(ty),tile=tiles.get(ix+','+iy);
  if(!tile)throw Error('Ein Teil des Höhenrasters fehlt. Kein künstliches Gelände wurde eingesetzt.');
  const px=R.clamp((tx-ix)*256,0,255),py=R.clamp((ty-iy)*256,0,255),x=Math.floor(px),y=Math.floor(py),x1=Math.min(255,x+1),y1=Math.min(255,y+1),dx=px-x,dy=py-y;
  const h=(tile[y*256+x]*(1-dx)+tile[y*256+x1]*dx)*(1-dy)+(tile[y1*256+x]*(1-dx)+tile[y1*256+x1]*dx)*dy;values.push(Math.round(h*10)/10);
 }
 return {cols,rows,values,zoom:z,spacing:Math.max(info.w/(cols-1),info.h/(rows-1)),source:'Mapzen / AWS Terrain Tiles (Terrarium)',attribution:'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',tileCount:jobs.length};
}
const loader=createDataLoader();
Object.assign(R,{europeBounds,request,osmQuery,poiQuery,searchPlace,reverseRegion,tileXY,readJSONLimited,createDataLoader,mergeOSM,splitBounds,loadMap:loader.loadMap,getOSMLayer:loader.getOSMLayer,loaderDiagnostics:loader.diagnostics,server:false});
})(globalThis.RS);
