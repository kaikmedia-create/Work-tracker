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
  const vertex=`#version 300 es\nin vec3 position;in float kind;uniform float size;uniform vec3 palette[8];uniform mat4 matrix;out vec3 p;out vec3 c;void main(){p=position/size;c=palette[clamp(int(kind),0,7)];gl_Position=matrix*vec4(p,1.);}`;
  const fragment=`#version 300 es\nprecision highp float;in vec3 p;in vec3 c;out vec4 frag;void main(){vec3 n=normalize(cross(dFdx(p),dFdy(p)));float light=.52+.36*max(dot(n,normalize(vec3(-.8,-.5,1.7))),0.)+.17*max(dot(n,normalize(vec3(.7,.5,.9))),0.);frag=vec4(pow(c*light,vec3(.96)),1.);}`;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D-Renderer konnte nicht gestartet werden.');
  this.slots=[];this.sizeLoc=gl.getUniformLocation(this.program,'size');this.matrixLoc=gl.getUniformLocation(this.program,'matrix');this.paletteLoc=gl.getUniformLocation(this.program,'palette[0]');
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(canvas);this.last=null;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.last=[e.clientX,e.clientY];canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!this.last)return;this.yaw-=(e.clientX-this.last[0])*0.008;this.pitch=R.clamp(this.pitch+(e.clientY-this.last[1])*0.008,.13,1.57);this.last=[e.clientX,e.clientY];this.queue();});
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{this.last=null;canvas.style.cursor='grab';this.queue();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.wheeling=true;clearTimeout(this.settle);this.settle=setTimeout(()=>{this.wheeling=false;this.queue();},140);const dy=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?240:1);this.zoom=R.clamp(this.zoom*Math.exp(-R.clamp(dy,-80,80)*.001),.45,4);this.queue();},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();R.notify?.('3D-Grafikspeicher wurde zurückgesetzt. Projekt speichern und Seite neu öffnen.','error');});
 }
 upload(m,i){const gl=this.gl;let slot=this.slots[i];if(!slot){slot={vao:gl.createVertexArray(),buf:[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()]};this.slots[i]=slot;}
  gl.bindVertexArray(slot.vao);for(const [j,name,size,type,data] of [[0,'position',3,gl.FLOAT,m.vertices],[1,'kind',1,gl.UNSIGNED_BYTE,m.classes]]){gl.bindBuffer(gl.ARRAY_BUFFER,slot.buf[j]);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,false,0,0);}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,slot.buf[2]);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);slot.count=m.indices.length;
 }
 setMesh(mesh,s){const gl=this.gl;if(this.mesh!==mesh){this.upload(mesh,0);if(mesh.preview)this.upload(mesh.preview,1);}this.mesh=mesh;this.settings=s;
  const theme=s.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#568dae','#1b2628','#87a887','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb'];this.palette=new Float32Array(theme.flatMap(rgb));this.queue();
 }
 view(mode){this.zoom=1;if(mode==='top'){this.pitch=1.569;this.yaw=-Math.PI/2;}else{this.pitch=.78;this.yaw=-.7;}this.render();}
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 render(){if(!this.mesh)return;const gl=this.gl,W=this.canvas.clientWidth,H=this.canvas.clientHeight;if(!W||!H||document.visibilityState==='hidden')return;const moving=!!(this.last||this.wheeling),slot=this.slots[!this.hd&&moving&&this.mesh.preview?1:0],dpr=Math.min(devicePixelRatio||1,this.mesh.preview?1.5:2),[pixelW,pixelH]=this.hd?hdSize(W,H,devicePixelRatio):[Math.round(W*dpr),Math.round(H*dpr)];if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){this.canvas.width=pixelW;this.canvas.height=pixelH;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(slot.vao);gl.uniform1f(this.sizeLoc,Math.max(this.mesh.width,this.mesh.height));gl.uniform3fv(this.paletteLoc,this.palette);
  const target=[0,0,this.mesh.zmax/Math.max(this.mesh.width,this.mesh.height)*.35],eye=[Math.cos(this.yaw)*Math.cos(this.pitch)*3,Math.sin(this.yaw)*Math.cos(this.pitch)*3,Math.sin(this.pitch)*3+target[2]],extent=.77/this.zoom,aspect=W/H;
  const projection=ortho(-extent*aspect,extent*aspect,-extent,extent,.1,10),matrix=multiply(projection,lookAt(eye,target,[0,0,1]));gl.uniformMatrix4fv(this.matrixLoc,false,matrix);gl.drawElements(gl.TRIANGLES,slot.count,gl.UNSIGNED_INT,0);
 }
}

// Accessible fallback when the browser disables WebGL. Exports keep full resolution.
class SoftwareViewer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=-.7;this.pitch=.78;this.zoom=1;this.mesh=null;this.last=null;this.pending=false;this.isSoftware=true;
  new ResizeObserver(()=>this.queue()).observe(canvas);
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.last=[e.clientX,e.clientY];});
  canvas.addEventListener('pointermove',e=>{if(!this.last)return;this.yaw-=(e.clientX-this.last[0])*.008;this.pitch=R.clamp(this.pitch+(e.clientY-this.last[1])*.008,.13,1.57);this.last=[e.clientX,e.clientY];this.queue();});
  for(const key of ['pointerup','pointercancel'])canvas.addEventListener(key,()=>{this.last=null;this.queue();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.wheeling=true;clearTimeout(this.settle);this.settle=setTimeout(()=>{this.wheeling=false;this.queue();},140);this.zoom=R.clamp(this.zoom*Math.exp(-R.clamp(e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?240:1),-80,80)*.001),.45,4);this.queue();},{passive:false});
 }
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 setMesh(full,settings){const mesh=full.preview||full;this.approx=!!full.preview;this.mesh=mesh;this.settings=settings;const [n,m]=mesh.grid,step=Math.max(1,Math.ceil(Math.max(n,m)/52)),faces=[];
  if(mesh.kind==='architecture'){for(let i=0;i<mesh.indices.length;i+=3)faces.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);}else{
  for(let y=0;y<m-1;y+=step)for(let x=0;x<n-1;x+=step){const X=Math.min(n-1,x+step),Y=Math.min(m-1,y+step),a=y*n+x,b=Y*n+x,c=y*n+X,d=Y*n+X;faces.push([a,b,c],[c,b,d]);}
  const topCount=(n-1)*(m-1)*6;for(let i=topCount;i<mesh.indices.length;i+=3)faces.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);
  }
  const colors=(settings.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#527983','#1b2628','#a8b9a4','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb']).map(rgb),v=mesh.vertices;
  const prepare=ids=>{const [a,b,c]=ids.map(i=>[v[i*3],v[i*3+1],v[i*3+2]]),n=norm(cross(b.map((x,i)=>x-a[i]),c.map((x,i)=>x-a[i]))),light=.52+.36*Math.max(dot(n,norm([-.8,-.5,1.7])),0)+.17*Math.max(dot(n,norm([.7,.5,.9])),0),kind=mesh.classes[ids[0]],col=colors[kind]||colors[0];return {ids,color:'rgb('+col.map(c=>Math.round(R.clamp(Math.pow(c*light,.96)*255,0,255))).join(',') +')',normal:n};};this.faces=faces.map(prepare);this.still=this.approx?Array.from({length:mesh.indices.length/3},(_,f)=>prepare([mesh.indices[3*f],mesh.indices[3*f+1],mesh.indices[3*f+2]])):this.faces;this.queue();
 }
 view(mode){this.zoom=1;this.pitch=mode==='top'?1.569:.78;this.yaw=mode==='top'?-Math.PI/2:-.7;this.render();}
 render(){if(!this.mesh||!this.ctx||document.visibilityState==='hidden')return;const canvas=this.canvas,W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;const dpr=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),scale=Math.min(W/1.8,H/1.5)/Math.max(this.mesh.width,this.mesh.height)*this.zoom,v=this.mesh.vertices,z0=this.mesh.zmax*.35,projected=[];
  for(let i=0;i<v.length;i+=3){const x=v[i],y=v[i+1],z=v[i+2]-z0;projected.push([W/2+(-sy*x+cy*y)*scale,H/2-(-cy*sp*x-sy*sp*y+cp*z)*scale,cy*cp*x+sy*cp*y+sp*z]);}
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
  for(let i=0;i<v.length;i+=3){const x=v[i],y=v[i+1],z=v[i+2]-z0;projected[i]=w*.5+(-sy*x+cy*y)*scale;projected[i+1]=h*.5-(-cy*sp*x-sy*sp*y+cp*z)*scale;projected[i+2]=cy*cp*x+sy*cp*y+sp*z;}
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
  const [w,h]=hdSize(W,H,devicePixelRatio),key=[w,h,view.yaw,view.pitch,view.zoom,theme].join('/');
  if(cache?.key===key){if(presented!==key){canvas.width=w;canvas.height=h;view.ctx.putImageData(cache.image,0,0);presented=key;}wanted=key;say('HD · Originalmodell lokal gerendert · '+w+' × '+h+' Pixel');return;}
  if(wanted!==key){clearTimeout(timer);wanted=key;presented='';paint();say('HD · Originalmodell wird lokal gerendert …');}
  if(!busy){clearTimeout(timer);const colors=(theme==='night'?['#b8c9c3','#e5eee9','#dfb57e','#568dae','#1b2628','#87a887','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#6e9dae','#29322e','#abbd99','#7e9690','#c2c8bb']).map(rgb);
   timer=setTimeout(()=>launch({w,h,key,colors,yaw:view.yaw,pitch:view.pitch,z0:full.zmax*.35,scale:Math.min(w/1.8,h/1.5)/Math.max(full.width,full.height)*view.zoom}),150);}
 };
 refresh();
}

R.ModelViewer=class extends ModelViewer {constructor(canvas){super(canvas);attachHD(this);}};
})(globalThis.RS);
