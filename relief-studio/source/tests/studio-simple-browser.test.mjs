import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,mkdtemp,mkdir,readdir,rm} from 'node:fs/promises';
import {join,resolve,dirname,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const chrome=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome'].find(p=>p&&existsSync(p));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class CDP {
 constructor(ws){this.ws=ws;this.next=0;this.pending=new Map();this.events=[];ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else this.events.push(m);});}
 send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},45000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 close(){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'));}this.pending.clear();this.ws.close();}
}
async function wait(fn,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const result=await fn();if(result)return result;}catch(e){last=e;}await delay(100);}throw last||Error('Timed out waiting for page state');}

test('simple editor: actual Chromium, both workflows, exports and phone layout',{timeout:240000,skip:!chrome&&!process.env.CI},async t=>{
 assert.ok(chrome,'Chromium/Chrome must be available for CI browser verification');
 const work=await mkdtemp(join(tmpdir(),'relief-simple30-')),downloads=join(work,'downloads');await mkdir(downloads);
 const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.b64':'text/plain','.bin':'application/octet-stream'};
 const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const prefix=pathname.startsWith('/preview/')?'/preview/':pathname.startsWith('/tests/')?'/tests/':'/studio/';
  const folder=prefix==='/preview/'?resolve(root,'..'):prefix==='/tests/'?join(root,'tests'):join(root,'public');
  const path=resolve(folder,pathname.slice(prefix.length)||'index.html');if(!path.startsWith(folder+sep))throw Error('Outside fixture server');
  const b=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);
 }catch{res.writeHead(404);res.end('Not found');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let browser,cdp;
 try{
  browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+join(work,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);browser.once('error',e=>{clearTimeout(timer);reject(e);});browser.stderr.on('data',chunk=>{text+=chunk;const m=text.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});cdp=new CDP(ws);
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  async function page({phone=false,preview=false}={}){
   const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
   const send=(m,p)=>cdp.send(m,p,sessionId);
   await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
   await send('Emulation.setDeviceMetricsOverride',{width:phone?390:1440,height:phone?844:1000,deviceScaleFactor:1,mobile:phone});
   if(phone)await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('relief-settings-v3',JSON.stringify({mode:'poster',autoSubtitle:false,contours:false,hillshade:false,surfaceMode:'classic',surfaceSchema:3}));`});
   const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
   const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden click target '+${JSON.stringify(selector)});return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
   await send('Page.navigate',{url:origin+(preview?'/preview/':'/studio/')});
   if(preview){await wait(()=>evaluate("!!document.getElementById('pin')&&!document.getElementById('submit').disabled"));await evaluate("document.getElementById('pin').value='2808'");await click('#submit');}
   await wait(()=>evaluate("!!globalThis.ReliefStudio&&document.body.dataset.studioUi==='simple30'"),60000);
   return {sessionId,send,evaluate,click};
  }
  const p=await page();
  const ev=p.evaluate;
  const visible=selector=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})&&!e.closest('[inert]');})()`);
  async function importFixture(mode){await ev(`(async()=>{const p=await (await fetch('/tests/fixture-'+${JSON.stringify(mode)}+'.json')).json();p.settings={...p.settings,mode:${JSON.stringify(mode)},surfaceMode:'classic',surfaceSchema:3,autoSubtitle:false,aerialColour:false,contours:false,hillshade:false,resolution:65,modelWidth:150,dpi:150,customColors:true};const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(p)],'studio-test.relief.json',{type:'application/json'}));const input=document.getElementById('project-file');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(()=>ev(`ReliefStudio.mode===${JSON.stringify(mode)}&&!!ReliefStudio.data${mode==='model'?'&&!!ReliefStudio.mesh&&!ReliefStudio.building':''}`),90000);}
  await t.test('place selection is reduced; bindings and road ranges are preserved',async()=>{
   await p.click('#choose-poster');assert.equal(await visible('#search-form'),true);assert.equal(await visible('#load-data'),false);assert.equal(await visible('#step-next'),true);
   assert.equal(await visible('#marker-google'),false);assert.equal(await visible('[data-setting="customColors"]'),false);
   assert.deepEqual(await ev("['major','secondary','local','paths'].map(id=>{const e=document.getElementById(id);return [id,e.min,e.max,e.step,document.querySelectorAll('#'+id).length]})"),[['major','0','5','0.1',1],['secondary','0','4','0.1',1],['local','0','3','0.05',1],['paths','0','2','0.05',1]]);
   assert.equal(await ev("new Set([...document.querySelectorAll('[id]')].map(e=>e.id)).size===document.querySelectorAll('[id]').length"),true);
  });
  await t.test('poster sliders, theme and cultural marker selection respond',async()=>{
   await importFixture('poster');await p.click('[data-step="1"]');
   for(const [key,value] of [['major',2.7],['secondary',1.7],['local',.9],['paths',.5]]){assert.equal(await visible('#'+key),true);await ev(`(()=>{const e=document.getElementById('${key}');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);assert.equal(await ev(`ReliefStudio.settings.${key}`),value);}
   await p.click('[data-theme="blue"]');assert.equal(await ev('ReliefStudio.settings.style'),'blue');assert.equal(await ev('ReliefStudio.settings.customColors'),false);
   await ev("document.getElementById('marker-list').closest('details').open=true");assert.equal(await visible('#marker-list'),true);assert.ok(await ev('ReliefStudio.data.landmarks.length>0'));
  });
  await t.test('text and format remain editable without advanced typography controls',async()=>{
   await p.click('[data-step="2"]');assert.equal(await visible('[data-setting="title"]'),true);assert.equal(await visible('[data-setting="tracking"]'),false);
   await ev("(()=>{const e=document.querySelector('[data-setting=title]');e.value='MEIN LIEBLINGSORT';e.dispatchEvent(new Event('input',{bubbles:true}));})()");assert.equal(await ev('ReliefStudio.settings.title'),'MEIN LIEBLINGSORT');
   await ev("(()=>{const e=document.getElementById('paper');e.value='custom';e.dispatchEvent(new Event('change',{bubbles:true}));})()");assert.equal(await ev("document.getElementById('simple-custom-paper').open"),true);assert.equal(await visible('[data-setting="paperW"]'),true);
  });
  async function downloaded(extension,before){return wait(async()=>{const files=(await readdir(downloads)).filter(f=>(extension==='jpeg'?/\.(jpe?g)$/.test(f):f.endsWith('.'+extension))&&!before.has(f));return files.length?join(downloads,files[0]):false;},90000);}
  await t.test('actual PDF, PNG and JPEG downloads',async()=>{
   await p.click('[data-step="3"]');
   for(const format of ['pdf','png','jpeg']){const before=new Set(await readdir(downloads));await p.click(`[data-format="${format}"]`);await p.click('#export-poster');await wait(()=>ev("document.getElementById('export-dialog').open"),60000);await p.click('#download-ready');const file=await downloaded(format,before);const bytes=await readFile(file);assert.ok(bytes.length>500&&bytes.length<=8000000);if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');else if(format==='png')assert.equal(bytes.subarray(1,4).toString(),'PNG');else assert.equal(bytes.readUInt16BE(0),0xffd8);console.log('Verified download',format,bytes.length,'bytes');}
  });
  await t.test('actual 3D build, size presets and sidebar resizing',async()=>{
   await importFixture('model');await p.click('[data-step="1"]');assert.equal(await visible('[data-setting="surfaceMode"]'),false);assert.equal(await visible('[data-setting="roadMode"]'),true);
   await ev('globalThis.previousModel=ReliefStudio.mesh');await p.click('[data-model-size="200"]');await wait(()=>ev('ReliefStudio.mesh!==previousModel&&!ReliefStudio.building'),90000);assert.equal(await ev('ReliefStudio.settings.modelWidth'),200);
   const before=await ev("document.getElementById('model-canvas').getBoundingClientRect().width");await p.click('#sidebar-toggle');await delay(200);const after=await ev("document.getElementById('model-canvas').getBoundingClientRect().width");assert.ok(after-before>=300,JSON.stringify({before,after}));assert.equal(await ev("document.querySelector('.sidebar').inert"),true);await p.click('#sidebar-toggle');
   await p.click('[data-step="2"]');await ev("(()=>{const e=document.getElementById('major');e.value=3;e.dispatchEvent(new Event('input',{bubbles:true}));})()");await wait(()=>ev('!ReliefStudio.building'),90000);assert.equal(await ev('ReliefStudio.settings.major'),3);
  });
  await t.test('actual STL and 3MF downloads',async()=>{
   await delay(600);await wait(()=>ev('!!ReliefStudio.mesh&&!ReliefStudio.building'),90000);await p.click('[data-step="3"]');
   for(const type of ['stl','3mf']){const before=new Set(await readdir(downloads));await p.click('#export-'+type);const file=await downloaded(type,before),bytes=await readFile(file);assert.ok(bytes.length>100);if(type==='stl'){const triangles=bytes.readUInt32LE(80);assert.ok(triangles>0);assert.equal(bytes.length,84+50*triangles);}else assert.equal(bytes.subarray(0,2).toString(),'PK');console.log('Verified download',type,bytes.length,'bytes');}
  });
  await t.test('desktop layouts, project menu and sources are accessible',async()=>{
   for(const width of [1024,1440,2560]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth+1'));assert.ok(await ev("document.getElementById('step-next').getBoundingClientRect().bottom<=innerHeight+1"));}
   await p.click('#simple-project-menu>summary');assert.equal(await visible('#save-project'),true);await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await ev("document.getElementById('simple-project-menu').open"),false);await p.click('#help');assert.equal(await ev("document.getElementById('help-dialog').open"),true);await p.click('#close-help');
  });
  await t.test('phone editor and preview; project actions work without nested menu',async()=>{
   const m=await page({phone:true});await wait(()=>m.evaluate("document.body.hasAttribute('data-phone')"));await m.click('#choose-poster');assert.ok(await m.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
   await m.click('#phone-project');assert.equal(await m.evaluate("document.getElementById('simple-project-menu').open"),true);assert.equal(await m.evaluate("document.getElementById('open-project').checkVisibility()"),true);
   await m.click('#phone-preview');assert.equal(await m.evaluate('document.body.dataset.phonePane'),'preview');assert.ok(await m.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await m.click('#phone-edit');assert.equal(await m.evaluate('document.body.dataset.phonePane'),'edit');
  });
  await t.test('encrypted PIN preview loads the same simplified UI',async()=>{
   const gate=await page({preview:true});assert.equal(await gate.evaluate('document.body.dataset.studioUi'),'simple30');await gate.click('#choose-model');assert.equal(await gate.evaluate("document.getElementById('simple-streets').querySelectorAll('input[type=range]').length"),4);
  });
  const errors=cdp.events.filter(m=>m.method==='Runtime.exceptionThrown').map(m=>m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);assert.deepEqual(errors,[]);
  console.log('Browser verification complete: real application, 5 export formats, four road sliders, desktop/phone/PIN.');
 }finally{cdp?.close();browser?.kill('SIGTERM');await new Promise(r=>server.close(r));await rm(work,{recursive:true,force:true});}
});
