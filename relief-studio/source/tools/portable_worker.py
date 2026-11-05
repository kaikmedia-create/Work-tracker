"""Derive an ES worker from the exact checksum-verified classic implementation."""
from pathlib import Path
import difflib,json,hashlib,sys
root=Path(__file__).resolve().parents[1];pub=root/'public';site=root.parent;old=Path(sys.argv[1]);w=(pub/'worker.js').read_text();assert w.count('await import(event.data.surveyURL)')==2
w=w.replace("importScripts('core.js','architecture.js');","import './core.js';\nimport './architecture.js';\nimport * as survey from './survey29.js';\nconst RS=globalThis.RS;").replace('await import(event.data.surveyURL)','survey');(pub/'atlas-mesh-worker.mjs').write_text(w)
f=pub/'app.js';s=f.read_text();start=s.index('function makeWorker(){');end=s.index('  worker.onmessage=',start);s=s[:start]+'''// Some WebKit configurations fail to start classic blob workers. Keep their URLs alive
// until execution starts. Retry a startup/runtime error once with the same geometry in a same-origin ES worker.
function printingWorker(){
 const inline=globalThis.RS_WORKER_SOURCE, normal=new URL((globalThis.RELIEF_STATIC_PREVIEW?'source/public/':'')+'worker.js',document.baseURI), external=new URL('atlas-mesh-worker.mjs',normal);let active=null,url=null,closed=false,moduleMode=false,job=null;
 const release=()=>{if(url){URL.revokeObjectURL(url);url=null;}};
 const api={onmessage:null,onerror:null,postMessage(m){job=m;active.postMessage(m);},terminate(){closed=true;job=null;active?.terminate();release();}};
 function launch(asModule){moduleMode=asModule;active=asModule?new Worker(external,{type:'module'}):new Worker(inline?(url=URL.createObjectURL(new Blob([inline],{type:'application/javascript'}))):normal);
  const mine=active;mine.onmessage=e=>{if(closed||active!==mine)return;release();if(!e.data?.progress)job=null;api.onmessage?.(e);};
  mine.onerror=e=>{if(closed||active!==mine)return;release();mine.terminate();if(!moduleMode){e.preventDefault();try{launch(true);if(job)active.postMessage(job);return;}catch(cause){api.onerror?.({message:cause.message});return;}}api.onerror?.(e);};
 }
 try{launch(false);}catch(e){release();launch(true);}return api;
}
function makeWorker(){
 try{
  worker=printingWorker();
'''+s[end:];a="const src=globalThis.RS_WORKER_SOURCE;w=new Worker(src?(url=URL.createObjectURL(new Blob([src],{type:'application/javascript'}))):'worker.js');";assert s.count(a)==1;s=s.replace(a,'w=printingWorker();');a="if(k==='title')autoName=false;if((autoName??(settings.title===R.defaults.title))&&settings.mode==='model'&&['lon','lat'].includes(k))settings.title='Ausschnitt '+settings.lat.toFixed(4)+', '+settings.lon.toFixed(4);";assert s.count(a)==1;s=s.replace(a,"if(k==='title')autoName=false;if((autoName??(settings.title===R.defaults.title))&&settings.mode==='model'&&['lon','lat'].includes(k)){autoName=true;settings.title='Ausschnitt '+settings.lat.toFixed(4)+', '+settings.lon.toFixed(4);}");f.write_text(s)
# Do not serialize the global multi-extent catalog into every project and diagnostic: record the source URL and only the intersection with the requested window.
f=pub/'atlas-reader.mjs';r=f.read_text();anchor="({...catalog.find(v=>v.key===key),key,release,";assert r.count(anchor)==1;r=r.replace(anchor,"({...catalog.find(v=>v.key===key),bbox:[...bounds],bboxMeaning:'requested window inside collection extent; actual presence determined by tile reads',key,release,");f.write_text(r)
p=site/'upgrade28-atlas.json';j=json.loads(p.read_text());a=(old/'public/app.js').read_text();A=a.split('\n');B=s.split('\n');h=lambda v:hashlib.sha256(v.encode()).hexdigest();j['changes']['public/app.js']=dict(base=h(a),result=h(s),edits=[[i,l-i,B[k:m]] for t,i,l,k,m in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes() if t!='equal']);p.write_text(json.dumps(j,ensure_ascii=False,separators=(',',':'))+'\n');
