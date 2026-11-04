/* Local-only, bounded diagnostic export. Never reads cookies, PINs or storage. */
(function(R){
'use strict';
function explainFailure(input,stage,settings={}){
 const d=input.diagnostics||input.details||{}, attempts=d.attemptedProviders||[], last=attempts.at(-1)||{};
 const code=input.code||(stage==='Import'?(input.name==='SyntaxError'?'IMPORT_JSON':'IMPORT_INVALID'):'APP_ERROR');
 const phase=code==='TERRAIN'?'Geländedaten':stage, layer=({geometry:'Gebäude und Linien',relations:'zusammengesetzte Flächen',pois:'Zusatzmarker'})[d.layer];
 const facts=[];
 if(settings.title)facts.push(String(settings.title).slice(0,100));
 if(Number.isFinite(settings.widthKm)&&Number.isFinite(settings.heightKm))facts.push(`${settings.widthKm} × ${settings.heightKm} km`);
 if(phase==='3D-Geometrie'&&Number.isFinite(settings.modelWidth))facts.push(`${settings.modelWidth} mm Druckbreite`);
 if(layer)facts.push(layer);if(d.tile)facts.push('Höhenkachel '+d.tile);
 if(d.objectId)facts.push('Objekt '+d.objectId);
 if(code==='IMPORT_HEIGHT'&&typeof d.height==='number')facts.push('Gelieferte Höhe: '+d.height+' m');
 if(code==='IMPORT_TERRAIN_GRID')facts.push('Gelesen: '+(d.cols??'?')+' Spalten × '+(d.rows??'?')+' Zeilen, '+(d.actualValues??'?')+' Höhenwerte');
 if(Number.isFinite(d.contactCount))facts.push(d.contactCount+' offene Kontakte');
 if(Number.isFinite(d.badEdges))facts.push(d.badEdges+' fehlerhafte Kanten');
 if(Number.isFinite(d.completedPackages)&&Number.isFinite(d.totalPackages))facts.push(`${d.completedPackages} von ${d.totalPackages} Kartenpaketen fertig`);
 if(last.service||d.service)facts.push('Dienst: '+(last.service||d.service));
 if(last.status||d.status||input.status)facts.push('HTTP '+(last.status||d.status||input.status));
 const wait=Number.isFinite(input.retryAt)?Math.max(0,Math.ceil((input.retryAt-Date.now())/1000)):null;
 const hint=code==='RATE_LIMIT'?(wait===null?'Die angezeigte Sperrfrist abwarten.':`Nach ${wait} s erneut versuchen.`):code==='IMPORT_JSON'?'Eine unveränderte Projekt- oder Diagnose-JSON öffnen.':code==='IMPORT_NO_DATA'?'Eine Projektdatei mit Kartendaten öffnen oder den Ausschnitt neu laden.':phase==='3D-Geometrie'?'Die vorhandenen Kartendaten müssen nicht neu geladen werden. Diagnose speichern.':phase==='Geländedaten'?'Erneut versuchen; fertige Kartenpakete bleiben nutzbar.':phase==='Kartendaten'?'Erneut versuchen; vollständig geladene Pakete werden wiederverwendet.':phase==='Import'?'Dateiformat und betroffenen Wert prüfen.':phase.startsWith('Export')?'Projekt sichern und Diagnose herunterladen.':'Details über „Diagnose“ speichern.';
 return {phase,code,hint,facts};
}
function createDiagnostics({now=()=>Date.now(),release='21.0.0'}={}){
 const events=[],errors=[];let provider=()=>({}),latest=null,sequence=0,run=0;let operation=null;
 const redact=value=>String(value??'').replace(/https?:\/\/[^\s"'<>]+/g,url=>url.replace(/[?#].*$/,''))
  .replace(/(\b(?:password|passwd|pin|token|api[_-]?key|authorization|cookie|secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,'$1[entfernt]');
 const text=(v,max=2000)=>redact(v).slice(0,max);
 function event(stage,details={}){
  const entry={runId:run,at:new Date(now()).toISOString(),stage:text(stage,100)};
  for(const key of ['status','phase','layer','attempt','attempts','done','total','received','count','durationMs','recovery','code','detail','buildId','service','httpStatus','tile','format','bytes','objectId']){
   const v=details[key];if(v===undefined)continue;
   if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')entry[key]=v;
   else if(typeof v==='string')entry[key]=text(v,800);
  }
  const prev=events.at(-1);
  // Streaming byte updates should not erase the useful stage/retry history.
  if(entry.status==='bytes'&&prev?.status==='bytes'&&prev.phase===entry.phase&&prev.layer===entry.layer)events[events.length-1]=entry;
  else events.push(entry);
  if(events.length>120)events.splice(0,events.length-120);
 }
 function safeDetails(value,depth=0){
  if(value==null||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string')return text(value,1000);
  if(depth>4)return '[begrenzt]';
  if(Array.isArray(value))return value.slice(0,32).map(v=>safeDetails(v,depth+1));
  if(typeof value==='object'){
   const out={};for(const [key,v] of Object.entries(value).slice(0,40)){
    if(/pin|password|cookie|token|authorization|secret|storage/i.test(key))continue;
    out[key]=safeDetails(v,depth+1);
   }return out;
  }return undefined;
 }
 function capture(error,context={}){
  let state={};try{state=provider()||{};}catch{}
  const input=typeof error==='string'?{message:error}:error||{};
  // On failed import the current editor state belongs to the previous project.
  if(context.stage==='Import')state={...state,data:null,settings:null,bounds:null};
  const info=explainFailure(input,context.stage||state.stage||'Anwendung',context.settings||state.settings||{});
  const record={runId:run,operation:safeDetails(operation),nextStep:text(info.hint),facts:info.facts.map(v=>text(v,200)),id:++sequence,at:new Date(now()).toISOString(),stage:text(info.phase,100),
   name:text(input.name||'Error',80),code:text(info.code,100),message:text(input.message||String(error)),
   stack:text(input.stack||'',8000),details:safeDetails(input.diagnostics||input.details||null)};
  if(context.message&&context.message!==record.message)record.originalNotice=text(context.message);
  record.displayMessage=text([record.code==='IMPORT_JSON'?'Datei enthält kein gültiges JSON.':record.message,record.facts.join(' · '),record.nextStep].filter(Boolean).join(' — '),3000);
  errors.push(record);if(errors.length>10)errors.shift();
  event(record.stage,{status:'error',code:record.code,detail:record.message});
  const source=context.data===undefined?state.data:context.data,settings=context.settings||state.settings;
  // Retain the failing state, even when the user subsequently changes settings.
  let project={version:3,settings:null,data:null};
  try{project=JSON.parse(JSON.stringify({version:3,settings:settings||null,data:source?Object.fromEntries(Object.entries(source).filter(([key])=>!key.startsWith('_'))):null}));}
  catch(e){record.snapshotError=text(e.message);}
  latest={project,record,state:safeDetails({bounds:state.bounds,view:state.view,panel:state.panel,loading:state.loading,building:state.building,loader:state.loader}),
   events:events.map(e=>({...e})),errors:errors.map(e=>({...e}))};return record;
 }
 function report(){
  if(!latest)capture('Manuell angeforderte Diagnose');
  const environment={};
  if(typeof navigator!=='undefined'){environment.userAgent=text(navigator.userAgent,500);environment.online=navigator.onLine;environment.language=navigator.language;}
  if(typeof window!=='undefined'){environment.viewport={width:window.innerWidth,height:window.innerHeight,pixelRatio:window.devicePixelRatio};}
  return {...latest.project,diagnostics:{schemaVersion:1,application:'Relief Studio',release,exportedAt:new Date(now()).toISOString(),
   stage:latest.record.stage,message:latest.record.message,error:latest.record,environment,state:latest.state,
   events:latest.events,errors:latest.errors,privacy:'Lokal exportiert. Enthält Einstellungen und gegebenenfalls Kartendaten des gewählten Orts. Keine automatische Übertragung; keine PINs, Cookies oder Zugangstokens.'}};
 }
 function download(){
  const blob=new Blob([JSON.stringify(report())],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='Relief-Studio-Diagnose-'+new Date(now()).toISOString().replace(/[:.]/g,'-')+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return blob.size;
 }
 return {begin(stage,meta={}){run++;operation={stage:text(stage,100),startedAt:new Date(now()).toISOString(),...safeDetails(meta)};event(stage,{status:'started'});return run;},event,capture,report,download,setProvider(fn){provider=typeof fn==='function'?fn:()=>({});},get errorCount(){return errors.length;}};
}
R.createDiagnostics=createDiagnostics;R.diagnostics=createDiagnostics();
})(globalThis.RS);
