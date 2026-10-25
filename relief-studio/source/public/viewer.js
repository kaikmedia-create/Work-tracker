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
  const vertex=`#version 300 es\nin vec3 position;in vec3 color;uniform mat4 matrix;out vec3 p;out vec3 c;void main(){p=position;c=color;gl_Position=matrix*vec4(position,1.);}`;
  const fragment=`#version 300 es\nprecision highp float;in vec3 p;in vec3 c;out vec4 frag;void main(){vec3 n=normalize(cross(dFdx(p),dFdy(p)));float light=.52+.36*max(dot(n,normalize(vec3(-.8,-.5,1.7))),0.)+.17*max(dot(n,normalize(vec3(.7,.5,.9))),0.);frag=vec4(pow(c*light,vec3(.96)),1.);}`;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D-Renderer konnte nicht gestartet werden.');
  this.buffers=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  for(let i=0;i<2;i++){gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);const loc=gl.getAttribLocation(this.program,i?'color':'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers[2]);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(canvas);this.last=null;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.last=[e.clientX,e.clientY];canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!this.last)return;this.yaw-=(e.clientX-this.last[0])*0.008;this.pitch=R.clamp(this.pitch+(e.clientY-this.last[1])*0.008,.13,1.57);this.last=[e.clientX,e.clientY];this.queue();});
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{this.last=null;canvas.style.cursor='grab';});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const dy=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?240:1);this.zoom=R.clamp(this.zoom*Math.exp(-R.clamp(dy,-80,80)*.001),.45,4);this.queue();},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();R.notify?.('3D-Grafikspeicher wurde zurückgesetzt. Projekt speichern und Seite neu öffnen.','error');});
 }
 setMesh(mesh,s){this.mesh=mesh;this.settings=s;const gl=this.gl,max=Math.max(mesh.width,mesh.height),positions=new Float32Array(mesh.vertices.length);for(let i=0;i<positions.length;i++)positions[i]=mesh.vertices[i]/max;
  const colors=new Float32Array(positions.length),theme=s.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#527983','#1b2628','#a8b9a4','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#8caeb6','#29322e','#ccd3c1','#7e9690','#c2c8bb'];
  const palette=theme.map(rgb),n=mesh.grid[0],m=mesh.grid[1];
  for(let i=0;i<mesh.classes.length;i++){const c=palette[mesh.classes[i]]||palette[0];let ao=1;if(i<n*m&&mesh.classes[i]!==1&&mesh.classes[i]!==2){let hi=positions[i*3+2];for(const k of [-n,-1,1,n])if(i+k>=0&&i+k<n*m)hi=Math.max(hi,positions[(i+k)*3+2]);ao=1-Math.min(.18,(hi-positions[i*3+2])*14);}colors.set(c.map(x=>x*ao),i*3);}
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[0]);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[1]);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers[2]);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);this.render();
 }
 view(mode){this.zoom=1;if(mode==='top'){this.pitch=1.569;this.yaw=-Math.PI/2;}else{this.pitch=.78;this.yaw=-.7;}this.render();}
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 render(){if(!this.mesh)return;const gl=this.gl,W=this.canvas.clientWidth,H=this.canvas.clientHeight;if(!W||!H||document.visibilityState==='hidden')return;const dpr=Math.min(devicePixelRatio||1,2),pixelW=Math.round(W*dpr),pixelH=Math.round(H*dpr);if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){this.canvas.width=pixelW;this.canvas.height=pixelH;}gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  const target=[0,0,this.mesh.zmax/Math.max(this.mesh.width,this.mesh.height)*.35],eye=[Math.cos(this.yaw)*Math.cos(this.pitch)*3,Math.sin(this.yaw)*Math.cos(this.pitch)*3,Math.sin(this.pitch)*3+target[2]],extent=.77/this.zoom,aspect=W/H;
  const projection=ortho(-extent*aspect,extent*aspect,-extent,extent,.1,10),matrix=multiply(projection,lookAt(eye,target,[0,0,1]));gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'matrix'),false,matrix);gl.drawElements(gl.TRIANGLES,this.mesh.indices.length,gl.UNSIGNED_INT,0);
 }
}

// Accessible fallback when the browser disables WebGL. Exports keep full resolution.
class SoftwareViewer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=-.7;this.pitch=.78;this.zoom=1;this.mesh=null;this.last=null;this.pending=false;this.isSoftware=true;
  new ResizeObserver(()=>this.queue()).observe(canvas);
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.last=[e.clientX,e.clientY];});
  canvas.addEventListener('pointermove',e=>{if(!this.last)return;this.yaw-=(e.clientX-this.last[0])*.008;this.pitch=R.clamp(this.pitch+(e.clientY-this.last[1])*.008,.13,1.57);this.last=[e.clientX,e.clientY];this.queue();});
  for(const key of ['pointerup','pointercancel'])canvas.addEventListener(key,()=>this.last=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=R.clamp(this.zoom*Math.exp(-R.clamp(e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?240:1),-80,80)*.001),.45,4);this.queue();},{passive:false});
 }
 queue(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
 setMesh(mesh,settings){this.mesh=mesh;this.settings=settings;const [n,m]=mesh.grid,step=Math.max(1,Math.ceil(n/135)),faces=[];
  for(let y=0;y<m-1;y+=step)for(let x=0;x<n-1;x+=step){const X=Math.min(n-1,x+step),Y=Math.min(m-1,y+step),a=y*n+x,b=Y*n+x,c=y*n+X,d=Y*n+X;faces.push([a,b,c],[c,b,d]);}
  const topCount=(n-1)*(m-1)*6;for(let i=topCount;i<mesh.indices.length;i+=3)faces.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]]);
  const colors=(settings.style==='night'?['#b8c9c3','#e5eee9','#dfb57e','#527983','#1b2628','#a8b9a4','#6f8882','#a3b0a5']:['#deddd2','#fffef9','#c4965f','#8caeb6','#29322e','#ccd3c1','#7e9690','#c2c8bb']).map(rgb),v=mesh.vertices;
  this.faces=faces.map(ids=>{const [a,b,c]=ids.map(i=>[v[i*3],v[i*3+1],v[i*3+2]]),n=norm(cross(b.map((x,i)=>x-a[i]),c.map((x,i)=>x-a[i]))),light=.52+.36*Math.max(dot(n,norm([-.8,-.5,1.7])),0)+.17*Math.max(dot(n,norm([.7,.5,.9])),0),kind=mesh.classes[ids[0]],col=colors[kind]||colors[0];return {ids,color:'rgb('+col.map(c=>Math.round(R.clamp(Math.pow(c*light,.96)*255,0,255))).join(',')+')',normal:n};});this.render();
 }
 view(mode){this.zoom=1;this.pitch=mode==='top'?1.569:.78;this.yaw=mode==='top'?-Math.PI/2:-.7;this.render();}
 render(){if(!this.mesh||!this.ctx||document.visibilityState==='hidden')return;const canvas=this.canvas,W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),scale=Math.min(W/1.8,H/1.5)/Math.max(this.mesh.width,this.mesh.height)*this.zoom,v=this.mesh.vertices,z0=this.mesh.zmax*.35,projected=[];
  for(let i=0;i<v.length;i+=3){const x=v[i],y=v[i+1],z=v[i+2]-z0;projected.push([W/2+(-sy*x+cy*y)*scale,H/2-(-cy*sp*x-sy*sp*y+cp*z)*scale,cy*cp*x+sy*cp*y+sp*z]);}
  const eye=[cy*cp,sy*cp,sp];const visible=this.faces.filter(f=>dot(f.normal,eye)>-.005).map(f=>({...f,depth:f.ids.reduce((s,i)=>s+projected[i][2],0)})).sort((a,b)=>a.depth-b.depth);
  ctx.lineWidth=.55;ctx.lineJoin='round';for(const f of visible){ctx.beginPath();f.ids.forEach((id,i)=>{const p=projected[id];if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fillStyle=ctx.strokeStyle=f.color;ctx.fill();ctx.stroke();}
  ctx.font='11px system-ui';ctx.fillStyle='#728075';ctx.textAlign='center';ctx.fillText('Software-3D · reduzierte Vorschau, voller Export',W/2,H-16);
 }
}

R.ModelViewer=ModelViewer;
})(globalThis.RS);