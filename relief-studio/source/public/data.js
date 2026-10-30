(function(R){
'use strict';
const TIMEOUT=55000;
// Header-wait is bounded. A response body may run longer ONLY while bytes arrive.
const BODY_IDLE_MS=26000, BODY_MAX_MS=185000;
function abortError(){return new DOMException('Abgebrochen','AbortError');}
async function request(url,options={},timeout=TIMEOUT){
 const controller=new AbortController(),source=options.signal,abort=()=>controller.abort();
 if(source?.aborted)throw abortError();source?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeout);
 try{const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok){const reason=r.status===429?'Zu viele Anfragen beim Kartendienst. Bitte später erneut versuchen.':r.status>=500?'Der externe Kartendienst ist vorübergehend nicht verfügbar.':r.status===401?'Die Anmeldung ist abgelaufen. Bitte neu anmelden.':'Der Datendienst hat die Anfrage abgelehnt.';throw Error(`${reason} (HTTP ${r.status})`);}return r;}
 catch(e){if(source?.aborted)throw abortError();if(controller.signal.aborted)throw Error('Zeitlimit des Datendienstes erreicht. Bitte später erneut versuchen oder den Ausschnitt verkleinern.');if(e instanceof TypeError)throw Error('Keine Verbindung zum Datendienst. Internetverbindung oder eine Browser-/Netzwerksperre prüfen.');throw e;}
 finally{clearTimeout(timer);source?.removeEventListener('abort',abort);}
}
const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
// Keep geometries and historical POIs separate. Slow or rate-limited landmark
// discovery must not invalidate roads, buildings and coastlines already loaded.
function osmQuery(b){const box=[b[1],b[0],b[3],b[2]].map(x=>x.toFixed(6)).join(',');return `[out:json][timeout:50][bbox:${box}];(way[building][building!="no"];way["building:part"];way[highway];way[waterway];way[natural=water];way[natural=coastline];way[water];way[landuse~"^(forest|grass)$"];way[natural=wood];way[leisure=park];relation[type=multipolygon][building];relation[type=multipolygon][natural=water];relation[type=multipolygon][water];relation[type=multipolygon][waterway=riverbank];);out geom;`;}
function poiQuery(b){const box=[b[1],b[0],b[3],b[2]].map(x=>x.toFixed(6)).join(',');return `[out:json][timeout:35][bbox:${box}];(nwr[historic][name];nwr[heritage][name];nwr[man_made~"^(tower|lighthouse)$"][name];nwr[tourism~"^(museum|artwork|attraction|gallery|viewpoint)$"][name];nwr[amenity=place_of_worship][name];);out center;`;}
const send=(fn,event)=>{if(typeof fn==='function')fn(event);};
const CACHE_DB='relief-studio-v10';
let databasePromise;
function openCache(){
 if(databasePromise)return databasePromise;
 databasePromise=new Promise(resolve=>{try{const q=indexedDB.open(CACHE_DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('maps');q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(null);q.onblocked=()=>resolve(null);}catch{resolve(null);}});
 return databasePromise;
}
async function cacheGet(key){const db=await openCache();if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction('maps','readonly').objectStore('maps').get(key);req.onsuccess=()=>{const value=req.result;resolve(value?.time&&Date.now()-value.time<(value.ttl||72*3600000)?value.data:null);};req.onerror=()=>resolve(null);}catch{resolve(null);}});}
async function cacheSet(key,data,ttl=72*3600000){const db=await openCache();if(!db)return;try{await new Promise(resolve=>{const t=db.transaction('maps','readwrite'),s=t.objectStore('maps');s.put({time:Date.now(),data,ttl},key);const keys=s.getAllKeys();keys.onsuccess=()=>{for(const k of keys.result.slice(0,Math.max(0,keys.result.length-6)))s.delete(k);};t.oncomplete=t.onerror=t.onabort=resolve;});}catch{/* browser quota / private mode: keep live data */}}
// Public Overpass endpoints may reject huge map responses. Cap all JSON reads, including chunked transfers.
// The optional fourth argument emits byte-accurate transfer reports. An empty
// stream does NOT advance the progress bar, and long transfers are extended only
// as long as subsequent chunks arrive. 185s is the absolute cap for one body.
async function readJSONLimited(response,limit=22_000_000,timeoutMs=BODY_IDLE_MS,options={}){
 const {signal,onActivity}=options,declared=Number(response.headers?.get('content-length')||0),total=declared>0?declared:null;
 if(declared>limit)throw Error('Zu viele Kartendaten für diesen Browser. Ausschnitt verkleinern oder eigenen OSM-Datendienst nutzen.');
 if(signal?.aborted)throw abortError();
 send(onActivity,{status:'headers',received:0,total});
 if(!response.body?.getReader){const value=await response.text();send(onActivity,{status:'bytes',received:new TextEncoder().encode(value).length,total});return JSON.parse(value);}
 const reader=response.body.getReader(),buffers=[];let received=0,lastReport=0,started=Date.now(),finished=false;
 const stop=()=>{reader.cancel().catch(()=>{});};
 try{
  while(true){
   if(signal?.aborted)throw abortError();
   const left=BODY_MAX_MS-(Date.now()-started);
   if(left<=0)throw Error('Datenübertragung wurde nach drei Minuten begrenzt. Bitte einen kleineren Ausschnitt laden.');
   let timeout,stopOnAbort;
   const next=new Promise((resolve,reject)=>{
    timeout=setTimeout(()=>reject(Error(received?'Datenübertragung steht seit 26 Sekunden still.':'Datendienst hat keine Daten übertragen.')),Math.min(timeoutMs,left));
    stopOnAbort=()=>reject(abortError());signal?.addEventListener('abort',stopOnAbort,{once:true});
    reader.read().then(resolve,reject);
   });
   let result;try{result=await next;}finally{clearTimeout(timeout);signal?.removeEventListener('abort',stopOnAbort);}
   if(result.done){finished=true;break;}
   if(!result.value?.byteLength)continue;
   received+=result.value.byteLength;
   if(received>limit)throw Error('Kartendaten überschreiten die sichere Obergrenze. Bitte kleineren Ausschnitt wählen.');
   buffers.push(result.value);
   if(Date.now()-lastReport>110||total&&received>=total){send(onActivity,{status:'bytes',received,total});lastReport=Date.now();}
  }
  send(onActivity,{status:'bytes',received,total,complete:true});
  const bytes=new Uint8Array(received);let at=0;for(const buffer of buffers){bytes.set(buffer,at);at+=buffer.byteLength;}
  // Yield once so the last progress message can reach the visible UI before parsing.
  await new Promise(resolve=>setTimeout(resolve,0));
  send(onActivity,{status:'parsing',received,total});
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Kartendienst hat keine lesbare JSON-Antwort geliefert.');}
 }catch(error){if(!finished)stop();throw error;}finally{try{reader.releaseLock();}catch{}}
}
async function searchPlace(q,signal){
 const query=String(q).trim().slice(0,140);if(query.length<2)throw Error('Bitte mindestens zwei Zeichen eingeben.');
 const url=R.server?`api/search?q=${encodeURIComponent(query)}`:`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=de`;
 const json=await readJSONLimited(await request(url,{signal},20000),1_000_000,20000);
 return (json.features||[]).map(f=>({lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],name:f.properties.name||f.properties.city||query,label:[f.properties.name,f.properties.city,f.properties.state,f.properties.country].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · '),region:f.properties.state||'',country:f.properties.country||'',countryCode:String(f.properties.countrycode||'').toUpperCase()}));
}
async function reverseRegion(lon,lat,code='',signal){
 if(!Number.isFinite(lon)||!Number.isFinite(lat))throw Error('Koordinaten sind ungültig.');
 const lang=String(code).toUpperCase()==='DE'?'de':'en';
 const url=R.server?`api/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&lang=${lang}`:`https://photon.komoot.io/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&limit=8&lang=${lang}`;
 const json=await readJSONLimited(await request(url,{signal},15000),1000000,15000);
 const features=(json.features||[]).filter(f=>f?.properties?.state||f?.properties?.countrycode);
 const first=features.find(f=>f.properties.state&&f.properties.countrycode)||features[0];
 if(!first)throw Error('Der Ort konnte keiner Region zugeordnet werden. Bitte Region manuell eintragen.');
 return {region:first.properties.state||'',countryCode:String(first.properties.countrycode||code||'').toUpperCase(),country:first.properties.country||''};
}
async function getOSMLayer(b,signal,layer,onProgress){
 const isPOI=layer==='pois',phase=isPOI?'pois':'base',timeout=isPOI?45000:58000,query=isPOI?poiQuery(b):osmQuery(b);
 const paths=R.server?[`api/map?bbox=${encodeURIComponent(b.join(','))}&layer=${layer}`]:OVERPASS;
 let last;
 for(let attempt=0;attempt<paths.length;attempt++){
  if(signal?.aborted)throw abortError();
  send(onProgress,{phase,status:'waiting',attempt:attempt+1,attempts:paths.length,detail:attempt?'Alternativer Dienst – warte auf Antwort':'Kartendienst berechnet die Anfrage; bisher noch keine empfangenen Bytes.'});
  try{
   const response=await request(paths[attempt],R.server?{signal}:{method:'POST',body:new URLSearchParams({data:query}),signal},timeout);
   const result=await readJSONLimited(response,isPOI?5_000_000:23_000_000,BODY_IDLE_MS,{signal,onActivity:activity=>send(onProgress,{phase,attempt:attempt+1,attempts:paths.length,...activity})});
   if(!Array.isArray(result.elements)||result.remark)throw Error('Der Datendienst hat die Anfrage nicht vollständig verarbeitet: '+String(result.remark||'Ungültige Antwort').slice(0,175));
   send(onProgress,{phase,status:'done',count:result.elements.length,detail:`${result.elements.length.toLocaleString('de-DE')} Kartenobjekte empfangen.`});
   return result;
  }catch(e){if(signal?.aborted)throw abortError();last=e;
   send(onProgress,{phase,status:'retry',detail:e.message+' '+(attempt+1<paths.length?'Wechsle zu einem alternativen Datendienst.':'')});
   // A rate limit must not trigger another immediate query against public servers.
   if(/429|Zu viele Anfragen|Obergrenze|zu viele Kartendaten/i.test(e.message))break;
  }
 }
 throw last||Error('Kein OpenStreetMap-Dienst erreichbar.');
}
function tileXY(lon,lat,z){const k=2**z,p=R.project([lon,lat]),extent=Math.PI*6378137;return [(p[0]+extent)/(2*extent)*k,(extent-p[1])/(2*extent)*k];}
async function terrainData(bounds,signal,onProgress){
 const info=R.boundsInfo(bounds),cols=R.clamp(Math.round(info.w/25)+1,65,257),rows=R.clamp(Math.round(info.h/25)+1,65,257);
 let z=14,a,b;do{a=tileXY(bounds[0],bounds[3],z);b=tileXY(bounds[2],bounds[1],z);if((Math.floor(b[0])-Math.floor(a[0])+1)*(Math.floor(b[1])-Math.floor(a[1])+1)<=48)break;z--;}while(z>9);
 const jobs=[];for(let y=Math.floor(a[1]);y<=Math.floor(b[1]);y++)for(let x=Math.floor(a[0]);x<=Math.floor(b[0]);x++)jobs.push([x,y]);
 const tiles=new Map();let next=0,done=0;send(onProgress,{phase:'terrain',status:'tiles',done:0,total:jobs.length,detail:`${jobs.length} Höhenkacheln zu laden`});
 const work=async()=>{while(next<jobs.length){if(signal?.aborted)throw abortError();const [x,y]=jobs[next++],url=R.server?`api/terrain/${z}/${x}/${y}.png`:`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,response=await request(url,{signal},25000),blob=await response.blob();
  let image;if(typeof createImageBitmap==='function')image=await createImageBitmap(blob);else image=await new Promise((resolve,reject)=>{const im=new Image(),u=URL.createObjectURL(blob);im.onload=()=>{URL.revokeObjectURL(u);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Höhenbild ist nicht lesbar.'));};im.src=u;});
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,256,256).data;image.close?.();const h=new Float32Array(65536);for(let i=0;i<h.length;i++)h[i]=rgba[i*4]*256+rgba[i*4+1]+rgba[i*4+2]/256-32768;tiles.set(x+','+y,h);done++;send(onProgress,{phase:'terrain',status:'tiles',done,total:jobs.length,detail:`${done} von ${jobs.length} Höhenkacheln empfangen`});
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
async function loadMap(bounds,{signal,onProgress,refresh=false,terrainRequired=true,mode='model'}={}){
 R.validateBounds(bounds,mode);const key='map:v10:'+bounds.map(x=>x.toFixed(5)).join(',')+(terrainRequired?'':':poster-2d');
 if(!refresh){const cached=await cacheGet(key);if(cached){send(onProgress,{phase:'cache',status:'done',detail:'Gespeicherte Kartendaten vollständig geladen.'});return cached;}}
 const internal=new AbortController(),cancel=()=>internal.abort();if(signal?.aborted)throw abortError();signal?.addEventListener('abort',cancel,{once:true});
 const placeholder={cols:2,rows:2,values:[0,0,0,0],available:false,source:'Nicht geladen – reines 2D-Poster'};
 // Terrain may transfer in parallel, making progress visible while Overpass computes.
 const terrainPromise=terrainRequired?terrainData(bounds,internal.signal,onProgress).then(value=>({value}),error=>({error})):Promise.resolve({value:placeholder});
 const warnings=[];
 try{
  const raw=await getOSMLayer(bounds,internal.signal,'base',onProgress).catch(e=>{throw Error('OpenStreetMap: '+e.message);});
  // Historical POIs are optional. Missing POIs must never discard usable geometry.
  let poi;
  try{poi=await getOSMLayer(bounds,internal.signal,'pois',onProgress);}
  catch(e){if(internal.signal.aborted)throw abortError();warnings.push('Zusätzliche historische Orte konnten nicht geladen werden: '+e.message+' Die Straßen und Gebäude sind verfügbar.');send(onProgress,{phase:'pois',status:'skipped',detail:'Sehenswürdigkeiten aktuell nicht erreichbar – Karte bleibt verfügbar.'});}
  const height=await terrainPromise;if(height.error)throw Error('Geländedaten: '+height.error.message);
  if(internal.signal.aborted)throw abortError();
  send(onProgress,{phase:'process',status:'working',detail:'Kartengeometrie und Wasserflächen werden verarbeitet.'});
  const seen=new Set(raw.elements.map(e=>e.type+'/'+e.id));
  const extras=(poi?.elements||[]).filter(e=>!seen.has(e.type+'/'+e.id));
  const combined={...raw,elements:raw.elements.concat(extras)};
  const features=R.parseOSM(combined,bounds),data={version:2,coastlineVersion:8,bounds,terrain:height.value,...features,capturedAt:new Date().toISOString(),osmTimestamp:raw.osm3s?.timestamp_osm_base||null,source:'OpenStreetMap contributors · ODbL 1.0',realData:true};
  data.warnings.push(...warnings);
  if(!features.buildings.length)features.warnings.push('Keine Gebäude in diesem Ausschnitt vorhanden.');
  if(R.boundsInfo(bounds).w*R.boundsInfo(bounds).h>80e6)features.warnings.push('Großer Ausschnitt: öffentliche Overpass-Dienste können den Abruf ablehnen. Für Produktion eigenen OSM-Dienst verwenden.');
  send(onProgress,{phase:'process',status:'done',count:data.buildings.length,detail:`${data.buildings.length.toLocaleString('de-DE')} Gebäude verarbeitet.`});
  await cacheSet(key,data,warnings.length?15*60000:72*3600000);return data;
 }catch(e){cancel();throw e;}finally{signal?.removeEventListener('abort',cancel);}
}
Object.assign(R,{request,osmQuery,poiQuery,getOSMLayer,searchPlace,reverseRegion,loadMap,tileXY,readJSONLimited,server:false});
})(globalThis.RS);