/* Local-only, bounded diagnostic export. Never reads cookies, PINs or storage. */
(function(R){
'use strict';
function createDiagnostics({now=()=>Date.now(),release='15.0.0'}={}){
 const events=[],errors=[];let provider=()=>({}),latest=null,sequence=0;
 const redact=value=>String(value??'').replace(/https?:\/\/[^\s"'<>]+/g,url=>url.replace(/[?#].*$/,''))
  .replace(/(\b(?:password|passwd|pin|token|api[_-]?key|authorization|cookie|secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,'$1[entfernt]');
 const text=(v,max=2000)=>redact(v).slice(0,max);
 function event(stage,details={}){
  const entry={at:new Date(now()).toISOString(),stage:text(stage,100)};
  for(const key of ['status','phase','layer','attempt','attempts','done','total','received','count','durationMs','recovery','code','detail','buildId']){
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
  const record={id:++sequence,at:new Date(now()).toISOString(),stage:text(context.stage||state.stage||'Anwendung',100),
   name:text(input.name||'Error',80),code:text(input.code||'APP_ERROR',100),message:text(input.message||String(error)),
   stack:text(input.stack||'',8000),details:safeDetails(input.diagnostics||input.details||null)};
  if(context.message&&context.message!==record.message)record.displayMessage=text(context.message);
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
 return {event,capture,report,download,setProvider(fn){provider=typeof fn==='function'?fn:()=>({});},get errorCount(){return errors.length;}};
}
R.createDiagnostics=createDiagnostics;R.diagnostics=createDiagnostics();
})(globalThis.RS);
