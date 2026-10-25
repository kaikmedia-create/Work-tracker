/** Relief Studio: dependency-free Node server with server-side authentication.
 * Default bind is loopback. For public use, terminate HTTPS at a reverse proxy.
 */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
await import('./public/core.js');
await import('./public/data.js');
const R=globalThis.RS,ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'public');
const PORT=Number(process.env.PORT||8080),HOST=process.env.HOST||'127.0.0.1',HTTPS=process.env.HTTPS_ONLY==='1',PUBLIC_BIND=!['127.0.0.1','localhost','::1'].includes(HOST),ENV_PASSWORD=process.env.APP_PASSWORD;
if(PUBLIC_BIND&&(!HTTPS||!ENV_PASSWORD||ENV_PASSWORD.length<12))throw Error('Öffentlicher Serverbetrieb erfordert HTTPS_ONLY=1 und ein neues APP_PASSWORD mit mindestens 12 Zeichen. Die kurze Demo-PIN ist nicht zulässig.');
let auth;
if(ENV_PASSWORD){const salt=randomBytes(24).toString('hex');auth={salt,hash:scryptSync(ENV_PASSWORD,salt,64).toString('hex')};delete process.env.APP_PASSWORD;}
else{try{auth=JSON.parse(await readFile(new URL('./auth.local.json',import.meta.url),'utf8'));}catch{console.error('Passwort fehlt. APP_PASSWORD als Umgebungsvariable setzen oder node setup.mjs ausführen.');process.exit(1);}}
if(!auth||!/^[0-9a-f]{48}$/i.test(auth.salt)||!/^[0-9a-f]{128}$/i.test(auth.hash))throw Error('Ungültige lokale Passwortkonfiguration.');
const key=randomBytes(48),rate=new Map(),cache=new Map();let cacheBytes=0;
const sign=s=>createHmac('sha256',key).update(s).digest('base64url');
const equal=(a,b)=>{const A=Buffer.from(a),B=Buffer.from(b);return A.length===B.length&&timingSafeEqual(A,B);};
const loginHTML=message=>`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relief Studio · Anmelden</title><style>body{font-family:system-ui;background:#f3f2ed;color:#244d40;display:grid;place-items:center;min-height:95vh}main{padding:44px;background:white;max-width:370px;border-radius:20px;box-shadow:0 20px 60px #244d4015}h1{font-family:Georgia;font-size:40px}p{line-height:1.6}input,button{box-sizing:border-box;width:100%;padding:15px;margin-top:12px;border:1px solid #bbc9c0;border-radius:8px;font-size:16px}button{background:#244d40;color:white;cursor:pointer}small{color:#718178}</style><main><small>CARTOGRAPHIC ATELIER</small><h1>Relief Studio.</h1><p>Dein Ort. Deine Perspektive.<br>Bitte mit deinem Passwort anmelden.</p><form method="post" action="/login"><input type="password" name="password" placeholder="Passwort" autocomplete="current-password" required autofocus maxlength="256"><button>Anmelden →</button></form><p role="alert">${message||''}</p><small>Serverseitig geschützter Zugang</small></main></html>`;
const CSP=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https://tile.openstreetmap.org","connect-src 'self' https://overpass-api.de https://overpass.kumi.systems https://photon.komoot.io https://s3.amazonaws.com","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self'"].join('; ');
function send(res,status,body,type='text/html; charset=utf-8',extra={}){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':CSP,'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',...(HTTPS?{'Strict-Transport-Security':'max-age=31536000; includeSubDomains'}:{}),'Cache-Control':'private, no-store',...extra});res.end(body);}
function authorized(req){const match=(req.headers.cookie||'').match(/(?:^|; )relief_session=([^;]+)/);if(!match)return false;const [value,mac]=match[1].split('.');if(!value||!mac||!equal(sign(value),mac))return false;const expiry=Number(value.split('_')[0]);return Number.isFinite(expiry)&&expiry>Date.now();}
function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>2048)throw Error('Anfrage zu groß.');chunks.push(c);}return Buffer.concat(chunks).toString('utf8');}
function cookie(value,maxAge){return `relief_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${HTTPS?'; Secure':''}`;}
async function remote(url,options={},limit=25000000){const response=await fetch(url,{...options,signal:AbortSignal.timeout(70000),headers:{'User-Agent':'ReliefStudio/5.0 (+https://github.com/kaikmedia-create/Work-tracker)',...(options.headers||{})}});if(!response.ok)throw Error('Datendienst HTTP '+response.status);const chunks=[];let n=0;for await(const chunk of response.body){n+=chunk.length;if(n>limit)throw Error('Ausschnitt zu groß für den Datendienst.');chunks.push(chunk);}return Buffer.concat(chunks);}
async function cached(id,fn,type){const entry=cache.get(id);if(entry&&entry.expires>Date.now())return entry.body;const buffer=await fn();if(buffer.length<8000000){while(cacheBytes+buffer.length>48000000&&cache.size){const first=cache.keys().next().value;cacheBytes-=cache.get(first).body.length;cache.delete(first);}if(cache.has(id))cacheBytes-=cache.get(id).body.length;cache.set(id,{body:buffer,expires:Date.now()+3600000,type});cacheBytes+=buffer.length;}return buffer;}
const apiTraffic=new Map();
function throttleAPI(req,key,limit){
 const remote=req.socket.remoteAddress||'unknown',now=Date.now(),k=remote+':'+key,entry=apiTraffic.get(k);
 if(apiTraffic.size>10000){for(const [name,v] of apiTraffic)if(v.until<now)apiTraffic.delete(name);}
 if(!entry||entry.until<now){apiTraffic.set(k,{count:1,until:now+60000});return false;}
 entry.count++;return entry.count>limit;
}
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(path==='/login'&&req.method==='GET'){send(res,200,loginHTML());return;}
 if(path==='/login'&&req.method==='POST'){
  if(!sameOrigin(req)){send(res,403,'Unzulässiger Ursprung.','text/plain');return;}
  const ip=req.socket.remoteAddress||'unknown';if(rate.size>10000)rate.clear();const record=rate.get(ip)||{count:0,until:0};if(record.until>Date.now()){send(res,429,loginHTML('Zu viele Versuche. Bitte nach einer Minute erneut versuchen.'),undefined,{'Retry-After':'60'});return;}
  const supplied=new URLSearchParams(await body(req)).get('password')||'',valid=equal(scryptSync(supplied,auth.salt,64).toString('hex'),auth.hash);
  if(!valid){record.count++;if(record.count>=5){record.until=Date.now()+60000;record.count=0;}rate.set(ip,record);send(res,401,loginHTML('Passwort nicht korrekt.'));return;}
  rate.delete(ip);const value=(Date.now()+12*3600000)+'_'+randomBytes(24).toString('base64url');send(res,303,'',undefined,{'Set-Cookie':cookie(value+'.'+sign(value),43200),Location:'/'});return;
 }
 if(!authorized(req)){if(path.startsWith('/api/'))send(res,401,JSON.stringify({error:'Bitte anmelden.'}),'application/json');else send(res,303,'',undefined,{Location:'/login'});return;}
 if(path==='/logout'&&req.method==='POST'){if(!sameOrigin(req)){send(res,403,'Ungültige Anfrage.');return;}send(res,303,'',undefined,{'Set-Cookie':cookie('',0),Location:'/login'});return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){send(res,405,'Methode nicht erlaubt.','text/plain');return;}
 if(path==='/api/status'){send(res,200,JSON.stringify({application:'relief-studio',server:true}),'application/json');return;}
 if(path==='/api/search'){
  if(throttleAPI(req,'search',30)){send(res,429,JSON.stringify({error:'Zu viele Suchen. Bitte nach einer Minute erneut versuchen.'}),'application/json',{'Retry-After':'60'});return;}
  const q=(url.searchParams.get('q')||'').trim();if(q.length<2||q.length>140){send(res,400,'Ungültige Suche.','text/plain');return;}const payload=await cached('search:'+q,()=>remote('https://photon.komoot.io/api/?limit=6&lang=de&q='+encodeURIComponent(q),{},1000000));send(res,200,payload,'application/json');return;
 }
 if(path==='/api/map'){
  if(throttleAPI(req,'map',12)){send(res,429,JSON.stringify({error:'Zu viele Kartendaten-Anfragen. Bitte nach einer Minute erneut versuchen.'}),'application/json',{'Retry-After':'60'});return;}
  const b=(url.searchParams.get('bbox')||'').split(',').map(Number);try{R.validateBounds(b,url.searchParams.get('mode')==='poster'?'poster':'model');}catch(e){send(res,400,e.message,'text/plain');return;}
  const payload=await cached('map:'+b.join(','),async()=>{let last;for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'])try{return await remote(host,{method:'POST',body:new URLSearchParams({data:R.osmQuery(b)})});}catch(e){last=e;}throw last;});send(res,200,payload,'application/json');return;
 }
 const tile=path.match(/^\/api\/terrain\/(\d+)\/(\d+)\/(\d+)\.png$/);
 if(tile){if(throttleAPI(req,'terrain',100)){send(res,429,JSON.stringify({error:'Zu viele Höhenkachel-Anfragen. Bitte später erneut versuchen.'}),'application/json',{'Retry-After':'60'});return;}const [z,x,y]=tile.slice(1).map(Number);if(z<1||z>15||x>=2**z||y>=2**z){send(res,400,'Ungültige Höhenkachel.','text/plain');return;}const buffer=await cached(path,()=>remote(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,{},1000000));send(res,200,buffer,'image/png');return;}
 if(path.startsWith('/api/')){send(res,404,'API nicht gefunden.','text/plain');return;}
 let decoded;try{decoded=decodeURIComponent(path);}catch{send(res,400,'Ungültiger Pfad.');return;}
 const filename=resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));if(!filename.startsWith(ROOT+sep)||decoded.includes('\0')){send(res,403,'Zugriff verweigert.');return;}
 const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.json':'application/json'};
 if(!types[extname(filename)]){send(res,404,'Nicht gefunden.');return;}
 try{const info=await stat(filename);if(!info.isFile())throw Error('not file');const content=await readFile(filename);send(res,200,req.method==='HEAD'?'':content,types[extname(filename)]);}catch{send(res,404,'Nicht gefunden.','text/plain');}
 }catch(e){const large=e.message==='Anfrage zu groß.',code=large?413:502;console.error('Request:',e.message);send(res,code,JSON.stringify({error:large?'Anfrage größer als 2 KB – abgelehnt.':'Anfrage fehlgeschlagen: '+String(e.message).slice(0,160)}),'application/json');}
});
server.headersTimeout=15000;server.requestTimeout=80000;server.listen(PORT,HOST,()=>console.log(`Relief Studio: http://${HOST}:${PORT} — Passwortschutz aktiv. Für Internetbetrieb HTTPS vorschalten.`));