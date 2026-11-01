// Build a static, encrypted preview. It is not a substitute for server authorization.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {randomBytes,pbkdf2Sync,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pass=process.env.RELIEF_BUILD_PASSWORD;if(!pass)throw Error('RELIEF_BUILD_PASSWORD required. Never commit a real password.');
const files={};
for(const name of await readdir(resolve(root,'public')))if(/\.(js|css|html|svg)$/.test(name))files['public/'+name]=await readFile(resolve(root,'public',name),'utf8');
files['public/index.html']=files['public/index.html'].replace(/<link rel="(?:alternate icon|apple-touch-icon)"[^>]*>/g,'');
for(const name of ['server.mjs','setup.mjs','package.json','README.md','.gitignore','START-MAC.command','START-WINDOWS.bat','TEST-REPORT.md','site/index.html','site/gate-v3.js','tools/pack.mjs','tools/standalone.py']){try{files[name]=await readFile(resolve(root,name),'utf8');}catch{}}
for(const name of ['fixture.mjs','core.test.mjs','workflows.test.mjs'])files['tests/'+name]=await readFile(resolve(root,'tests',name),'utf8');
const payload=gzipSync(Buffer.from(JSON.stringify({version:3,files})),{level:9});
const salt=randomBytes(16),iv=randomBytes(12),iterations=210000,key=pbkdf2Sync(pass,salt,iterations,32,'sha256');
const cipher=createCipheriv('aes-256-gcm',key,iv),enc=Buffer.concat([cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
const bundle=JSON.stringify({version:1,iterations,salt:salt.toString('base64'),iv:iv.toString('base64'),data:enc.toString('base64')})+'\n';
await mkdir(resolve(root,'site'),{recursive:true});const manifest=JSON.parse(bundle);delete manifest.data;manifest.parts=[];for(let i=0;i<enc.length;i+=9000){const name='bundle-'+manifest.parts.length+'.bin';manifest.parts.push(name);await writeFile(resolve(root,'site',name),enc.subarray(i,i+9000));}await writeFile(resolve(root,'site','bundle.json'),JSON.stringify(manifest)+'\n');
// Fail the build if the archive cannot round-trip through decryption and gzip.
const dec=createDecipheriv('aes-256-gcm',key,iv);dec.setAuthTag(enc.subarray(-16));const round=gunzipSync(Buffer.concat([dec.update(enc.subarray(0,-16)),dec.final()]));if(JSON.parse(round).files['public/app.js']!==files['public/app.js'])throw Error('Build round-trip mismatch.');
const b=Buffer.from(bundle),sha=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
console.log(JSON.stringify({files:Object.keys(files).length,bundleBytes:b.length,gitBlobSHA:sha}));
