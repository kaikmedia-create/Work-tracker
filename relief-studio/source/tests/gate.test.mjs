import vm from 'node:vm';import {webcrypto} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),html=await readFile(new URL('site/index.html',root),'utf8'),code=await readFile(new URL('site/gate-v5.js',root),'utf8');
const els={login:{},pin:{value:'wrong'},submit:{disabled:false},status:{textContent:''}};let output='';
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Blob,DecompressionStream,Response,atob,btoa,unescape,encodeURIComponent,document:{getElementById:id=>els[id],open:()=>{},write:s=>output=s,close:()=>{}},fetch:async path=>new Response(await readFile(new URL('site/'+path.split('?')[0],root)))};
context.window=context;vm.createContext(context);vm.runInContext(code,context);
await els.login.onsubmit({preventDefault(){}});if(!els.status.textContent.includes('PIN nicht korrekt'))throw Error('Wrong PIN accepted');
els.pin.value='2808';await els.login.onsubmit({preventDefault(){}});if(!output.includes('ReliefStudio')||output.includes('src="app.js"'))throw Error('Failed to build executable app: '+els.status.textContent);
if(!output.includes("version:'5.0.0'"))throw Error('Gateway did not apply v5 update');
await writeFile(new URL('reports/gate-unlocked.html',root),output);console.log('Gate OK: wrong PIN rejected, correct PIN decrypts the complete source bundle; app scripts inlined.',Object.keys(context.RELIEF_SOURCE_FILES).length);
