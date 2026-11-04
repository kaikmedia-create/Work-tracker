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
