(function(R){
'use strict';
const TIMEOUT=75000;
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
function osmQuery(b){const box=[b[1],b[0],b[3],b[2]].map(x=>x.toFixed(6)).join(',');return `[out:json][timeout:60][bbox:${box}];(way[building][building!="no"];way["building:part"];way[highway];way[waterway];way[natural=water];way[natural=coastline];way[water];way[landuse~"^(forest|grass)$"];way[natural=wood];way[leisure=park];relation[type=multipolygon][building];relation[type=multipolygon][natural=water];relation[type=multipolygon][water];relation[type=multipolygon][waterway=riverbank];nwr[historic][name];nwr[heritage][name];nwr[man_made~"^(tower|lighthouse)$"][name];nwr[tourism~"^(museum|artwork|attraction|gallery|viewpoint)$"][name];nwr[amenity=place_of_worship][name];);out geom;`;}
const CACHE_DB='relief-studio-v9';
let databasePromise;
function openCache(){
 if(databasePromise)return databasePromise;
 databasePromise=new Promise(resolve=>{try{const q=indexedDB.open(CACHE_DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('maps');q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(null);q.onblocked=()=>resolve(null);}catch{resolve(null);}});
 return databasePromise;
}
async function cacheGet(key){const db=await openCache();if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction('maps','readonly').objectStore('maps').get(key);req.onsuccess=()=>{const value=req.result;resolve(value?.time&&Date.now()-value.time<72*3600000?value.data:null);};req.onerror=()=>resolve(null);}catch{resolve(null);}});}
async function cacheSet(key,data){const db=await openCache();if(!db)return;try{await new Promise(resolve=>{const t=db.transaction('maps','readwrite'),s=t.objectStore('maps');s.put({time:Date.now(),data},key);const keys=s.getAllKeys();keys.onsuccess=()=>{for(const k of keys.result.slice(0,Math.max(0,keys.result.length-6)))s.delete(k);};t.oncomplete=t.onerror=t.onabort=resolve;});}catch{/* browser quota / private mode: keep live data */}}
// Public Overpass endpoints may reject huge map responses. Cap all JSON reads, including chunked transfers.
async function readJSONLimited(response,limit=22_000_000,timeoutMs=40000){
 const declared=Number(response.headers.get('content-length')||0);if(declared>limit)throw Error('Zu viele Kartendaten für diesen Browser. Bitte Ausschnitt verkleinern oder einen eigenen OSM-Datendienst nutzen.');
 if(!response.body?.getReader)return response.json();
 const reader=response.body.getReader(),buffers=[];let total=0,timer;
 try{const chunks=(async()=>{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw Error('Kartendaten überschreiten die sichere Obergrenze. Bitte einen kleineren Ausschnitt wählen.');}buffers.push(value);}const bytes=new Uint8Array(total);let at=0;for(const b of buffers){bytes.set(b,at);at+=b.byteLength;}return new TextDecoder().decode(bytes);})();
 // Protect against a service that sends headers but stalls while streaming data.
 const result=await Promise.race([chunks,new Promise((_,reject)=>{timer=setTimeout(()=>{reader.cancel().catch(()=>{});reject(Error('Kartendienst liefert seit längerer Zeit keine vollständige Antwort. Bitte später erneut versuchen.'));},timeoutMs);})]);
 try{return JSON.parse(result);}catch{throw Error('Kartendienst hat unlesbare Kartendaten geliefert. Bitte erneut versuchen.');}
 }finally{clearTimeout(timer);try{reader.releaseLock();}catch{}}
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
async function getOSM(b,signal,mode='model'){
 if(R.server)return readJSONLimited(await request(`api/map?bbox=${b.join(',')}&mode=${mode}`,{signal}),24_000_000);
 let last;
 for(const url of OVERPASS){
  try{const result=await readJSONLimited(await request(url,{method:'POST',body:new URLSearchParams({data:osmQuery(b)}),signal},65000),22_000_000,40000);if(!Array.isArray(result.elements)||result.remark)throw Error('OSM-Daten unvollständig oder Dienst überlastet: '+String(result.remark||'Keine Objekte').slice(0,160));return result;}
  catch(e){if(signal?.aborted)throw abortError();last=e;if(/429|Zu viele Anfragen|Obergrenze|zu viele Kartendaten/i.test(e.message))break;}
 }
 throw last||Error('OpenStreetMap ist nicht erreichbar.');
}
function tileXY(lon,lat,z){const k=2**z,p=R.project([lon,lat]),extent=Math.PI*6378137;return [(p[0]+extent)/(2*extent)*k,(extent-p[1])/(2*extent)*k];}
async function terrainData(bounds,signal,onProgress){
 const info=R.boundsInfo(bounds),cols=R.clamp(Math.round(info.w/25)+1,65,257),rows=R.clamp(Math.round(info.h/25)+1,65,257);
 let z=14,a,b;do{a=tileXY(bounds[0],bounds[3],z);b=tileXY(bounds[2],bounds[1],z);if((Math.floor(b[0])-Math.floor(a[0])+1)*(Math.floor(b[1])-Math.floor(a[1])+1)<=48)break;z--;}while(z>9);
 const jobs=[];for(let y=Math.floor(a[1]);y<=Math.floor(b[1]);y++)for(let x=Math.floor(a[0]);x<=Math.floor(b[0]);x++)jobs.push([x,y]);
 const tiles=new Map();let next=0,done=0;
 const work=async()=>{while(next<jobs.length){if(signal?.aborted)throw abortError();const [x,y]=jobs[next++],url=R.server?`api/terrain/${z}/${x}/${y}.png`:`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,response=await request(url,{signal},25000),blob=await response.blob();
  let image;if(typeof createImageBitmap==='function')image=await createImageBitmap(blob);else image=await new Promise((resolve,reject)=>{const im=new Image(),u=URL.createObjectURL(blob);im.onload=()=>{URL.revokeObjectURL(u);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Höhenbild ist nicht lesbar.'));};im.src=u;});
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,256,256).data;image.close?.();const h=new Float32Array(65536);for(let i=0;i<h.length;i++)h[i]=rgba[i*4]*256+rgba[i*4+1]+rgba[i*4+2]/256-32768;tiles.set(x+','+y,h);done++;onProgress?.(`Gelände: ${done} von ${jobs.length} Höhenkacheln`,0.18+0.5*done/jobs.length);
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
 R.validateBounds(bounds,mode);const key='map:v9:'+bounds.map(x=>x.toFixed(5)).join(',')+(terrainRequired?'':':poster-2d');
 if(!refresh){const cached=await cacheGet(key);if(cached){onProgress?.('Gespeicherte Originaldaten werden geladen',0.85);return cached;}}
 onProgress?.(terrainRequired?'OpenStreetMap und echte Geländehöhen werden geladen':'Straßen, Gebäude und Gewässer für dein Poster werden geladen',0.08);
 const [raw,terrain]=await Promise.all([getOSM(bounds,signal,mode).catch(e=>{if(e.name==='AbortError')throw e;throw Error('OpenStreetMap: '+e.message);}),terrainRequired?terrainData(bounds,signal,onProgress).catch(e=>{if(e.name==='AbortError')throw e;throw Error('Geländedaten: '+e.message);}):Promise.resolve({cols:2,rows:2,values:[0,0,0,0],available:false,source:'Nicht geladen – reines 2D-Poster'})]);
 if(signal?.aborted)throw abortError();onProgress?.('Gebäude, Straßen und Wahrzeichen aufbereiten',0.76);
 const features=R.parseOSM(raw,bounds),data={version:2,coastlineVersion:8,bounds,terrain,...features,capturedAt:new Date().toISOString(),osmTimestamp:raw.osm3s?.timestamp_osm_base||null,source:'OpenStreetMap contributors · ODbL 1.0',realData:true};
 if(!features.buildings.length)features.warnings.push('Keine Gebäude in diesem Ausschnitt vorhanden.');
 if(R.boundsInfo(bounds).w*R.boundsInfo(bounds).h>80e6)features.warnings.push('Sehr großer Ausschnitt: Gebäudedetails sind begrenzt und öffentliche Overpass-Dienste können den Abruf ablehnen. Für Produktionsbetrieb eigenen/kommerziellen OSM-Datendienst verwenden.');
 await cacheSet(key,data);return data;
}
Object.assign(R,{request,osmQuery,searchPlace,reverseRegion,loadMap,tileXY,readJSONLimited,server:false});
})(globalThis.RS);