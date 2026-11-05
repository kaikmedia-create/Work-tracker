(function(R){
'use strict';
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function multiply(a,b){const c=new Float32Array(16);for(let col=0;col<4;col++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)c[col*4+r]+=a[k*4+r]*b[col*4+k];return c;}
function lookAt(eye,target,up){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
class ModelViewer{
 constructor(canvas){this.canvas=canvas;this.yaw=-0.7;this.pitch=0.78;this.zoom=1;this.mesh=null;this.pending=false;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:false});if(!this.gl)return new SoftwareViewer(canvas);
  const gl=this.gl;
  const vertex=`#version 300 es\nin vec3 position;in float kind;uniform float size;uniform vec3 palette[8];uniform mat4 matrix;out vec3 p;out vec3 c;out float surface;void main(){surface=kind==4.?0.:1.;p=position/size;c=palette[clamp(int(kind),0,7)];gl_Position=matrix*vec4(p,1.);}`;
  const fragment=`#version 300 es\nprecision highp float;in vec3 p;in vec3 c;in float surface;uniform sampler2D airMap;uniform vec4 airUV;uniform bool useAir;out vec4 frag;void main(){vec3 n=normalize(cross(dFdx(p),dFdy(p)));float light=.52+.36*max(dot(n,normalize(vec3(-.8,-.5,1.7))),0.)+.17*max(dot(n,normalize(vec3(.7,.5,.9))),0.);vec3 colour=c;if(useAir&&surface>.99){vec2 uv=p.xy*airUV.xy+airUV.zw;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){vec4 photo=texture(airMap,uv);colour=mix(c,photo.rgb,photo.a);}}frag=vec4(pow(colour*light,vec3(.96)),1.);}`;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D-Renderer konnte nicht gestartet werden.');
  this.airTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.airTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,0]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.airFlag=gl.getUniformLocation(this.program,'useAir');this.airTransform=gl.getUniformLocation(this.program,'airUV');this.slots=[];this.sizeLoc=gl.getUniformLocation(this.program,'size');this.matrixLoc=gl.getUniformLocation(this.program,'matrix');this.paletteLoc=gl.getUniformLocation(this.program,'palette[0]');
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(canvas);this.last=null;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();R.notify?.('3D-Grafikspeicher wurde zurückgesetzt. Projekt speichern und Seite neu öffnen.','error');});
 }
 async setAerial(m,enabled){const epoch=this.airEpoch=(this.airEpoch||0)+1;this.airActive=false;const status=document.getElementById('aerial-status');const say=t=>{if(status&&epoch===this.airEpoch)status.textContent=t;};if(!m.survey||!enabled){say('Druckansicht · keine Luftbildfarbe.');return;}const dir=new URL((globalThis.RELIEF_STATIC_PREVIEW?'source/public/':'')+'survey29/',document.baseURI);try{const list=await(this.airCatalog??=fetch(new URL('colour.json',dir),{signal:AbortSignal.timeout(4500)}).then(r=>r.json()).catch(e=>{this.airCatalog=null;throw e;}));const xy=(x,y)=>[(x+180)/360*65536,(1-Math.asinh(Math.tan(y*Math.PI/180))/Math.PI)*32768];const [w,s,e,n]=m.survey.bounds,A=xy(w,n),B=xy(e,s),atlas=list.find(t=>A[0]>=t.box[0]&&A[1]>=t.box[1]&&B[0]<=t.box[2]&&B[1]<=t.box[3]);if(!atlas){say('Kein passendes Luftbild · Druckansicht aktiv.');return;}if(epoch!==this.airEpoch)return;const im=new Image();im.src=new URL(atlas.file,dir).href;await im.decode();if(epoch!==this.airEpoch)return;const [x,y,X,Y]=atlas.box,sz=Math.max(m.width,m.height),mw=m.survey.mapWidth,mh=m.height-(m.width-mw);this.airUV=[sz/mw*(B[0]-A[0])/(X-x),-sz/mh*(B[1]-A[1])/(Y-y),((A[0]+B[0])/2-x)/(X-x),((A[1]+B[1])/2-y)/(Y-y)];const gl=this.gl;if(Math.max(im.width,im.height)>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error();gl.bindTexture(gl.TEXTURE_2D,this.airTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);this.airActive=true;say('Luftbild aktiv · © LGL BW, DOP20 · dl-de/by-2-0. STL ohne Farbe.');this.queue();}catch{say('Luftbild nicht verfügbar · das Druckmodell bleibt erhalten.');}}
 upload(m,i){const gl=this.gl;let slot=this.slots[i];if(!slot){slot={vao:gl.createVertexArray(),buf:[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()]};this.slots[i]=slot;}
  gl.bindVertexArray(slot.vao);for(const [j,name,size,type,data] of [[0,'position',3,gl.FLOAT,m.vertices],[1,'kind',1,gl.UNSIGNED_BYTE,m.classes]]){gl.bindBuffer(gl.ARRAY_BUFFER,slot.buf[j]);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,false,0,0);}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,slot.buf[2]);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);slot.count=m.indices.length;
 }
 setMesh(mesh,s){const gl=this.gl;if(this.mesh!==mesh){this.upload(mesh,0);if(mesh.preview)this.upload(mesh.preview,1);}this.mesh=mesh;this.settings=s;
  if(this.airObject!==mesh||this.airSetting!==s.aerialColour){this.airObject=mesh;this.airSetting=s.aerialColour;this.setAerial(mesh,s.aerialColour);}

  const theme=s.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#568dae','#1b2628','#87a887','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb'];this.palette=new Float32Array(theme.flatMap(rgb));this.queue();
 }
 view(mode){this.zoom=1;if(mode==='top'){this.pitch=1.569;this.yaw=-Math.PI/2;}else{this.pitch=.78;this.yaw=-.7;}this.render();}
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 render(){if(!this.mesh)return;const gl=this.gl,W=this.canvas.clientWidth,H=this.canvas.clientHeight;if(!W||!H||document.visibilityState==='hidden')return;const moving=!!(this.last||this.wheeling),slot=this.slots[!this.hd&&moving&&this.mesh.preview?1:0],dpr=Math.min(devicePixelRatio||1,this.mesh.preview?1.5:2),[pixelW,pixelH]=this.hd?hdSize(W,H,devicePixelRatio):[Math.round(W*dpr),Math.round(H*dpr)];if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){this.canvas.width=pixelW;this.canvas.height=pixelH;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(slot.vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.airTex);gl.uniform1i(this.airFlag,this.airActive?1:0);if(this.airActive)gl.uniform4fv(this.airTransform,this.airUV);gl.uniform1f(this.sizeLoc,Math.max(this.mesh.width,this.mesh.height));gl.uniform3fv(this.paletteLoc,this.palette);
  const target=[this.focus[0],this.focus[1],this.focus[2]+this.mesh.zmax/Math.max(this.mesh.width,this.mesh.height)*.35],eye=[target[0]+Math.cos(this.yaw)*Math.cos(this.pitch)*3,target[1]+Math.sin(this.yaw)*Math.cos(this.pitch)*3,Math.sin(this.pitch)*3+target[2]],extent=.77/this.zoom,aspect=W/H;
  const projection=ortho(-extent*aspect,extent*aspect,-extent,extent,.1,10),matrix=multiply(projection,lookAt(eye,target,[0,0,1]));gl.uniformMatrix4fv(this.matrixLoc,false,matrix);gl.drawElements(gl.TRIANGLES,slot.count,gl.UNSIGNED_INT,0);
 }
}

// Accessible fallback when the browser disables WebGL. Exports keep full resolution.
class SoftwareViewer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=-.7;this.pitch=.78;this.zoom=1;this.mesh=null;this.last=null;this.pending=false;this.isSoftware=true;
  new ResizeObserver(()=>this.queue()).observe(canvas);

 }
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 setMesh(full,settings){const air=document.getElementById('aerial-status');if(air)air.textContent='Software-Vorschau · Druckgeometrie ohne Luftbildfarbe.';const mesh=full.preview||full;this.approx=!!full.preview;this.mesh=mesh;this.settings=settings;const [n,m]=mesh.grid,step=Math.max(1,Math.ceil(Math.max(n,m)/52)),faces=[];
  if(mesh.kind==='architecture'){for(let i=0;i<mesh.indices.length;i+=3)faces.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);}else{
  for(let y=0;y<m-1;y+=step)for(let x=0;x<n-1;x+=step){const X=Math.min(n-1,x+step),Y=Math.min(m-1,y+step),a=y*n+x,b=Y*n+x,c=y*n+X,d=Y*n+X;faces.push([a,b,c],[c,b,d]);}
  const topCount=(n-1)*(m-1)*6;for(let i=topCount;i<mesh.indices.length;i+=3)faces.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);
  }
  const colors=(settings.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#527983','#1b2628','#a8b9a4','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb']).map(rgb),v=mesh.vertices;
  const prepare=ids=>{const [a,b,c]=ids.map(i=>[v[i*3],v[i*3+1],v[i*3+2]]),n=norm(cross(b.map((x,i)=>x-a[i]),c.map((x,i)=>x-a[i]))),light=.52+.36*Math.max(dot(n,norm([-.8,-.5,1.7])),0)+.17*Math.max(dot(n,norm([.7,.5,.9])),0),kind=mesh.classes[ids[0]],col=colors[kind]||colors[0];return {ids,color:'rgb('+col.map(c=>Math.round(R.clamp(Math.pow(c*light,.96)*255,0,255))).join(',') +')',normal:n};};this.faces=faces.map(prepare);this.still=this.approx?Array.from({length:mesh.indices.length/3},(_,f)=>prepare([mesh.indices[3*f],mesh.indices[3*f+1],mesh.indices[3*f+2]])):this.faces;this.queue();
 }
 view(mode){this.zoom=1;this.pitch=mode==='top'?1.569:.78;this.yaw=mode==='top'?-Math.PI/2:-.7;this.render();}
 render(){if(!this.mesh||!this.ctx||document.visibilityState==='hidden')return;const canvas=this.canvas,W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;const dpr=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),scale=Math.min(W/1.8,H/1.5)/Math.max(this.mesh.width,this.mesh.height)*this.zoom,v=this.mesh.vertices,size=Math.max(this.mesh.width,this.mesh.height),fx=this.focus[0]*size,fy=this.focus[1]*size,z0=this.mesh.zmax*.35+this.focus[2]*size,projected=[];
  for(let i=0;i<v.length;i+=3){const x=v[i]-fx,y=v[i+1]-fy,z=v[i+2]-z0;projected.push([W/2+(-sy*x+cy*y)*scale,H/2-(-cy*sp*x-sy*sp*y+cp*z)*scale,cy*cp*x+sy*cp*y+sp*z]);}
  const eye=[cy*cp,sy*cp,sp];const visible=(this.last||this.wheeling?this.faces:this.still).filter(f=>dot(f.normal,eye)>-.005).map(f=>({...f,depth:f.ids.reduce((s,i)=>s+projected[i][2],0)})).sort((a,b)=>a.depth-b.depth);
  ctx.lineWidth=.55;ctx.lineJoin='round';for(const f of visible){ctx.beginPath();f.ids.forEach((id,i)=>{const p=projected[id];if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fillStyle=ctx.strokeStyle=f.color;ctx.fill();ctx.stroke();}
  ctx.font='11px system-ui';ctx.fillStyle='#728075';ctx.textAlign='center';ctx.fillText(this.approx?'Vereinfachte Software-Vorschau · Export in voller Auflösung':'Software-3D',W/2,H-16);
 }
}

// Original mesh in display pixels; render software stills off the UI thread.
function hdSize(w,h,dpr){const k=Math.min(Math.max(1,dpr||1),3,4096/w,4096/h,Math.sqrt(6000000/(w*h)));return [Math.max(1,Math.floor(w*k)),Math.max(1,Math.floor(h*k))];}
function hdWorkerMain(){
 'use strict';let v,ix,kinds,light,projected;
 self.onmessage=({data:m})=>{try{
  if(m.init){({v,ix,kinds}=m);projected=new Float32Array(v.length);light=new Uint8Array(ix.length/3);
   const l1=Math.hypot(.8,.5,1.7),l2=Math.hypot(.7,.5,.9);
   for(let i=0,f=0;i<ix.length;i+=3,f++){
    const a=3*ix[i],b=3*ix[i+1],c=3*ix[i+2],u=v[b]-v[a],t=v[b+1]-v[a+1],s=v[b+2]-v[a+2],p=v[c]-v[a],q=v[c+1]-v[a+1],r=v[c+2]-v[a+2];
    const x=t*r-s*q,y=s*p-u*r,z=u*q-t*p,n=Math.sqrt(x*x+y*y+z*z)||1;
    light[f]=Math.round(220*(.52+.36*Math.max(0,(-.8*x-.5*y+1.7*z)/(n*l1))+.17*Math.max(0,(.7*x+.5*y+.9*z)/(n*l2))));
   }return;
  }
  const {w,h,scale,yaw,pitch,z0,key,colors}=m,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  if(!v||!(w>0&&h>0&&w*h<=6000000&&w<=4096&&h<=4096))throw Error('Ungültige Bildgröße');
  const zs=new Float32Array(w*h);zs.fill(-Infinity);const pixels=new Uint8ClampedArray(w*h*4),px=new Uint32Array(pixels.buffer),palette=new Uint32Array(colors.length*256);
  // Pack colors using the host byte order.
  const sample=new Uint8Array([1,0,0,0]),le=new Uint32Array(sample.buffer)[0]===1;
  for(let j=0;j<colors.length;j++)for(let l=0;l<256;l++){const ch=colors[j].map(c=>Math.min(255,Math.round(255*Math.pow(c*l/220,.96))));palette[j*256+l]=le?(255<<24|ch[2]<<16|ch[1]<<8|ch[0]):(ch[0]<<24|ch[1]<<16|ch[2]<<8|255);}
  for(let i=0;i<v.length;i+=3){const x=v[i]-(m.fx||0),y=v[i+1]-(m.fy||0),z=v[i+2]-z0;projected[i]=w*.5+(-sy*x+cy*y)*scale;projected[i+1]=h*.5-(-cy*sp*x-sy*sp*y+cp*z)*scale;projected[i+2]=cy*cp*x+sy*cp*y+sp*z;}
  for(let i=0,f=0;i<ix.length;i+=3,f++){
   const a=3*ix[i],b=3*ix[i+1],c=3*ix[i+2],ax=projected[a],ay=projected[a+1],az=projected[a+2],bx=projected[b],by=projected[b+1],cx=projected[c],cy2=projected[c+1],ux=bx-ax,uy=by-ay,vx=cx-ax,vy=cy2-ay,det=ux*vy-uy*vx;
   if(det>=-1e-9)continue;
   const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy2)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy2)-.5)),color=palette[(kinds[ix[i]]||0)*256+light[f]],dzb=projected[b+2]-az,dzc=projected[c+2]-az;
   for(let y=y0;y<=y1;y++)for(let x=x0,j=y*w+x0;x<=x1;x++,j++){
    const u=((x+.5-ax)*vy-(y+.5-ay)*vx)/det,t=(ux*(y+.5-ay)-uy*(x+.5-ax))/det;
    if(u<0||t<0||u+t>1)continue;const z=az+u*dzb+t*dzc;if(z>zs[j]){zs[j]=z;px[j]=color;}
   }
  }
  self.postMessage({w,h,key,pixels,triangles:ix.length/3},[pixels.buffer]);
 }catch(e){self.postMessage({error:e.message||'Lokales HD-Rendering fehlgeschlagen'});}};
}
function attachHD(view){
 const canvas=view.canvas,btn=document.getElementById('model-hd'),tip=document.querySelector('#view-model .model-tip');
 view.hd=true;try{view.hd=localStorage.getItem('rs-preview-hd')!=='off';}catch{}
 const say=t=>{if(tip&&tip.textContent!==t)tip.textContent=t;};
 const paint=view.render.bind(view),set=view.setMesh.bind(view);let full,theme,timer,worker,busy=false,failed=false,cache=null,wanted='',presented='';
 function stop(){clearTimeout(timer);worker?.terminate();worker=null;busy=false;cache=null;wanted=presented='';}
 function refresh(){if(btn){btn.disabled=!full;btn.setAttribute('aria-pressed',String(view.hd));btn.classList.toggle('selected',view.hd);}if(!view.isSoftware)say(view.hd?'HD · Originalmodell auf der GPU · Ziehen zum Drehen':'Automatisch · Details nach dem Loslassen');}
 if(btn)btn.onclick=()=>{view.hd=!view.hd;try{localStorage.setItem('rs-preview-hd',view.hd?'on':'off');}catch{}stop();failed=false;refresh();view.queue();};
 view.setMesh=(m,s)=>{if(m!==full){stop();failed=false;}if(theme!==s.style)presented='';full=m;theme=s.style;set(m,s);refresh();};
 if(!view.isSoftware){refresh();return;}
 function fail(){stop();failed=true; say('HD nicht verfügbar · schnelle Vorschau aktiv. HD aus- und einschalten, um es erneut zu versuchen.');}
 function launch(req){if(!view.hd||failed||busy||wanted!==req.key)return;
  try{if(!worker){const url=URL.createObjectURL(new Blob(['('+hdWorkerMain.toString()+')()'],{type:'text/javascript'}));try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    worker.onerror=fail;worker.onmessage=({data:m})=>{busy=false;if(m.error){fail();return;}if(m.key===wanted&&view.hd&&!view.last&&!view.wheeling){cache={key:m.key,image:new ImageData(m.pixels,m.w,m.h)};view.queue();}else if(view.hd)view.queue();};
    // Structured clone once per model. Never detach the export/mesh buffers.
    worker.postMessage({init:true,v:full.vertices,ix:full.indices,kinds:full.classes});}
   busy=true;worker.postMessage(req);
  }catch{fail();}
 }
 view.render=()=>{if(!full||!view.ctx||document.visibilityState==='hidden')return;
  const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;
  if(view.last||view.wheeling||!view.hd||failed){clearTimeout(timer);wanted=presented='';paint();if(!failed)say(view.hd?'Bewegen · HD folgt nach dem Loslassen':'Schnelle Vorschau · für das Originalmodell HD wählen');return;}
  const [w,h]=hdSize(W,H,devicePixelRatio),key=[w,h,view.yaw,view.pitch,view.zoom,...view.focus,theme].join('/');
  if(cache?.key===key){if(presented!==key){canvas.width=w;canvas.height=h;view.ctx.putImageData(cache.image,0,0);presented=key;}wanted=key;say('HD · Originalmodell lokal gerendert · '+w+' × '+h+' Pixel');return;}
  if(wanted!==key){clearTimeout(timer);wanted=key;presented='';paint();say('HD · Originalmodell wird lokal gerendert …');}
  if(!busy){clearTimeout(timer);const colors=(theme==='night'?['#b8c9c3','#e5eee9','#dfb57e','#568dae','#1b2628','#87a887','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb']).map(rgb);
   timer=setTimeout(()=>launch({w,h,key,colors,yaw:view.yaw,pitch:view.pitch,fx:view.focus[0]*Math.max(full.width,full.height),fy:view.focus[1]*Math.max(full.width,full.height),z0:full.zmax*.35+view.focus[2]*Math.max(full.width,full.height),scale:Math.min(w/1.8,h/1.5)/Math.max(full.width,full.height)*view.zoom}),150);}
 };
 refresh();
}

// One camera and coordinate convention for WebGL, fast canvas and the HD worker.
function navigation(v){
 const c=v.canvas,points=new Map();v.focus=[0,0,0];v.tool='rotate';c.style.touchAction='none';
 const $=id=>document.getElementById(id),local=e=>{const r=c.getBoundingClientRect();return [e.clientX-r.left-c.clientWidth/2,e.clientY-r.top-c.clientHeight/2];};
 const update=()=>{const n=$('nav-percent');if(n)n.textContent=Math.round(v.zoom*100)+' %';v.queue();};
 function shift(dx,dy){const k=(v.isSoftware?Math.min(c.clientWidth/1.8,c.clientHeight/1.5):c.clientHeight/1.54)*v.zoom;if(!(k>0))return;
  const sx=Math.sin(v.yaw),cx=Math.cos(v.yaw),sp=Math.sin(v.pitch),cp=Math.cos(v.pitch);
  v.focus[0]+=(dx*sx-dy*cx*sp)/k;v.focus[1]+=(-dx*cx-dy*sx*sp)/k;v.focus[2]+=dy*cp/k;
 }
 function zoom(r,x=0,y=0){if(!Number.isFinite(r)||r<=0)return;const old=v.zoom;v.zoom=R.clamp(old*r,.35,32);const f=1-v.zoom/old;shift(x*f,y*f);update();}
 function settle(){v.wheeling=true;clearTimeout(v.settle);v.settle=setTimeout(()=>{v.wheeling=false;v.queue();},140);}
 const pair=()=>{const [a,b]=[...points.values()];return [(a[0]+b[0])/2,(a[1]+b[1])/2,Math.hypot(a[0]-b[0],a[1]-b[1])];};
 c.addEventListener('pointerdown',e=>{if(e.button>2||!v.mesh)return;e.preventDefault();c.focus({preventScroll:true});c.setPointerCapture(e.pointerId);points.set(e.pointerId,local(e));v.last=true;c.style.cursor='grabbing';});
 c.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const old=points.get(e.pointerId),p=local(e),both=points.size===2?pair():null;points.set(e.pointerId,p);
  if(both){const now=pair();if(both[2]>2&&now[2]>2)zoom(now[2]/both[2],both[0],both[1]);shift(now[0]-both[0],now[1]-both[1]);}
  else if(points.size===1){const dx=p[0]-old[0],dy=p[1]-old[1];if(v.tool==='pan'||e.shiftKey||(e.buttons&6))shift(dx,dy);else{v.yaw-=dx*.008;v.pitch=R.clamp(v.pitch+dy*.008,.13,1.569);}}update();});
 function end(e){if(!points.delete(e.pointerId))return;v.last=points.size?true:null;c.style.cursor=v.last?'grabbing':'grab';update();}
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(ev,end);
 c.addEventListener('contextmenu',e=>e.preventDefault());c.addEventListener('wheel',e=>{if(!v.mesh)return;e.preventDefault();settle();const unit=e.deltaMode===1?16:e.deltaMode===2?c.clientHeight:1,[x,y]=local(e);if(e.shiftKey){shift(-(e.deltaX||e.deltaY)*unit,e.deltaX?-e.deltaY*unit:0);update();}else zoom(Math.exp(-R.clamp(e.deltaY*unit,-160,160)*(e.ctrlKey?.011:.0028)),x,y);},{passive:false});
 c.addEventListener('dblclick',e=>{const [x,y]=local(e);shift(-x,-y);zoom(2);});
 c.addEventListener('keydown',e=>{const actions={'+':()=>zoom(1.5),'=':()=>zoom(1.5),'-':()=>zoom(1/1.5),ArrowLeft:()=>shift(48,0),ArrowRight:()=>shift(-48,0),ArrowUp:()=>shift(0,48),ArrowDown:()=>shift(0,-48),Home:()=>$('model-reset')?.click()};if(actions[e.key]){e.preventDefault();actions[e.key]();update();}});
 for(const [id,fn] of [['nav-in',()=>zoom(1.5)],['nav-out',()=>zoom(1/1.5)],['nav-pan',()=>{v.tool=v.tool==='pan'?'rotate':'pan';const b=$( 'nav-pan');b.setAttribute('aria-pressed',String(v.tool==='pan'));b.classList.toggle('selected',v.tool==='pan');}]]){const b=$(id);if(b)b.onclick=fn;}
 const orient=v.view.bind(v);v.view=mode=>{v.focus=[0,0,0];orient(mode);update();};
}

R.ModelViewer=class extends ModelViewer {constructor(canvas){super(canvas);navigation(this);attachHD(this);}};
})(globalThis.RS);
