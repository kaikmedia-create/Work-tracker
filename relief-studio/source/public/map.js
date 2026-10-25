(function(R){
'use strict';
class AreaMap{
 constructor(canvas,onBounds){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onBounds=onBounds;this.tiles=new Map();this.zoom=14;this.centre=[8.6808,49.548];this.bounds=R.boundsFor(...this.centre,3.2,3);this.drag=null;this.tilesOK=0;this.tilesFailed=0;this.wheelDelta=0;this.lastWheel=0;this.paintPending=false;this.inFlight=0;this.maxTileLoads=5;this.paintCount=0;this.tileRequests=0;this.currentVisible=new Set();
  this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(canvas);
  canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',e=>this.up(e));
  canvas.addEventListener('wheel',e=>{e.preventDefault();const now=performance.now(),delta=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?240:1);this.wheelDelta=R.clamp(this.wheelDelta+delta,-360,360);if(Math.abs(this.wheelDelta)<150||now-this.lastWheel<100)return;const dir=this.wheelDelta<0?1:-1;this.wheelDelta=0;this.lastWheel=now;const p=this.point(e),before=this.fromScreen(p);this.zoom=R.clamp(this.zoom+dir,3,19);const after=this.fromScreen(p),a=R.project(this.centre),b=R.project(before),c=R.project(after);this.centre=R.unproject([a[0]+b[0]-c[0],a[1]+b[1]-c[1]]);this.draw();},{passive:false});
 }
 size(){return [this.canvas.clientWidth,this.canvas.clientHeight];}
 world(lonlat){return R.tileXY(...lonlat,this.zoom).map(x=>x*256);}
 fromWorld(p){const k=2**this.zoom*256;return [p[0]/k*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/k)))*180/Math.PI];}
 toScreen(p){const w=this.world(p),c=this.world(this.centre),[W,H]=this.size();return [w[0]-c[0]+W/2,w[1]-c[1]+H/2];}
 fromScreen(p){const c=this.world(this.centre),[W,H]=this.size();return this.fromWorld([p[0]+c[0]-W/2,p[1]+c[1]-H/2]);}
 point(e){const r=this.canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
 setBounds(b,fit=false){this.bounds=b.slice();if(fit)this.fit();else this.draw();}
 fit(){this.centre=[(this.bounds[0]+this.bounds[2])/2,(this.bounds[1]+this.bounds[3])/2];const [W,H]=this.size();for(let z=18;z>=3;z--){const a=R.tileXY(this.bounds[0],this.bounds[3],z),b=R.tileXY(this.bounds[2],this.bounds[1],z);if((b[0]-a[0])*256<W*0.69&&(b[1]-a[1])*256<H*0.7){this.zoom=z;break;}}this.draw();}
 box(){const a=this.toScreen([this.bounds[0],this.bounds[3]]),b=this.toScreen([this.bounds[2],this.bounds[1]]);return [a[0],a[1],b[0],b[1]];}
 down(e){if(e.button!==0)return;this.canvas.setPointerCapture(e.pointerId);const p=this.point(e),b=this.box(),corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];let mode='pan',corner=-1;
  if(e.shiftKey||this.drawMode){mode='draw';this.drawMode=false;}else{corner=corners.findIndex(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<18);if(corner>=0)mode='resize';else if(p[0]>b[0]&&p[0]<b[2]&&p[1]>b[1]&&p[1]<b[3])mode='area';}
  const ratio=R.boundsInfo(this.bounds).w/Math.max(1e-9,R.boundsInfo(this.bounds).h);this.drag={mode,corner,start:p,bounds:this.bounds.slice(),centre:this.centre.slice(),world:this.world(this.centre),ratio};this.canvas.style.cursor='grabbing';
 }
 move(e){const p=this.point(e);if(!this.drag){const b=this.box(),near=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].some(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<18);this.canvas.style.cursor=near?'nwse-resize':'grab';return;}
  const d=this.drag,dx=p[0]-d.start[0],dy=p[1]-d.start[1];
  if(d.mode==='pan')this.centre=this.fromWorld([d.world[0]-dx,d.world[1]-dy]);
  if(d.mode==='area'){const a=this.world([d.bounds[0],d.bounds[1]]),b=this.world([d.bounds[2],d.bounds[3]]),sw=this.fromWorld([a[0]+dx,a[1]+dy]),ne=this.fromWorld([b[0]+dx,b[1]+dy]);this.bounds=[...sw,...ne];}
  // Mercator coordinates preserve the selection's physical aspect ratio exactly at this scale.
  const constrained=(a,z,ratio)=>{const dx=z[0]-a[0],dy=z[1]-a[1];if(Math.abs(dx)<1e-4||Math.abs(dy)<1e-4)return null;let w=Math.abs(dx),h=Math.abs(dy);if(w/h>ratio)h=w/ratio;else w=h*ratio;return R.unproject([a[0]+Math.sign(dx)*w,a[1]+Math.sign(dy)*h]);};
  if(d.mode==='draw'){const a=this.fromScreen(d.start),b=constrained(R.project(a),R.project(this.fromScreen(p)),d.ratio||1);if(b)this.bounds=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];}
  if(d.mode==='resize'){const b=d.bounds.slice(),fixed=[d.corner===0||d.corner===3?b[2]:b[0],d.corner<=1?b[1]:b[3]],moving=constrained(R.project(fixed),R.project(this.fromScreen(p)),d.ratio||1);if(moving){if(d.corner===0){b[0]=moving[0];b[3]=moving[1];}if(d.corner===1){b[2]=moving[0];b[3]=moving[1];}if(d.corner===2){b[2]=moving[0];b[1]=moving[1];}if(d.corner===3){b[0]=moving[0];b[1]=moving[1];}if(b[0]<b[2]&&b[1]<b[3])this.bounds=b;}}
  this.draw();
 }
 up(){if(!this.drag)return;const prev=this.drag.bounds;this.drag=null;this.canvas.style.cursor='grab';try{R.validateBounds(this.bounds,this.limitMode||'model');this.onBounds?.(this.bounds);}catch(e){this.bounds=prev;this.onError?.(e.message);}this.draw();}
 draw(){if(this.paintPending)return;this.paintPending=true;requestAnimationFrame(()=>{this.paintPending=false;this.paint();});}
 pumpTiles(){if(this.inFlight>=this.maxTileLoads)return;const queued=[...this.tiles.entries()].filter(([key,t])=>t.state==='queued'&&this.currentVisible.has(key)).sort((a,b)=>b[1].lastVisible-a[1].lastVisible);for(const [key,t] of queued){if(this.inFlight>=this.maxTileLoads)break;t.state='loading';this.inFlight++;this.tileRequests++;const image=new Image();image.referrerPolicy='strict-origin-when-cross-origin';t.image=image;image.onload=()=>{t.state='ready';this.inFlight--;this.draw();this.pumpTiles();};image.onerror=()=>{t.state='error';t.failedAt=Date.now();this.inFlight--;this.draw();this.pumpTiles();};image.src=`https://tile.openstreetmap.org/${key}.png`;}}
 paint(){this.paintCount++;const [W,H]=this.size();if(!W||!H)return;const ratio=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(W*ratio)||this.canvas.height!==Math.round(H*ratio)){this.canvas.width=Math.round(W*ratio);this.canvas.height=Math.round(H*ratio);}const ctx=this.ctx;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#e9ede8';ctx.fillRect(0,0,W,H);
  this.currentVisible=new Set();const centre=this.world(this.centre),left=centre[0]-W/2,top=centre[1]-H/2,n=2**this.zoom;
  for(let y=Math.floor(top/256);y<=Math.floor((top+H)/256);y++)for(let x=Math.floor(left/256);x<=Math.floor((left+W)/256);x++){
   if(y<0||y>=n)continue;const xx=((x%n)+n)%n,key=`${this.zoom}/${xx}/${y}`;this.currentVisible.add(key);let tile=this.tiles.get(key);
   if(!tile){tile={state:'queued',lastVisible:Date.now(),image:null};this.tiles.set(key,tile);}
   tile.lastVisible=Date.now();if(tile.state==='error'&&Date.now()-tile.failedAt>60000)tile.state='queued';
   if(tile.state==='ready'&&tile.image?.naturalWidth)ctx.drawImage(tile.image,x*256-left,y*256-top,256,256);else{ctx.strokeStyle='#dce3dd';ctx.strokeRect(x*256-left,y*256-top,256,256);}
  }
  // Keep a bounded in-memory tile cache; HTTP persistence is handled by the browser.
  if(this.tiles.size>150){for(const [key,t] of [...this.tiles.entries()].sort((a,b)=>a[1].lastVisible-b[1].lastVisible)){if(this.tiles.size<=120)break;if(t.state!=='loading')this.tiles.delete(key);}}
  this.pumpTiles();
  const [x,y,x2,y2]=this.box();ctx.fillStyle='rgba(245,243,237,.56)';ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(x2,y,x-x2,y2-y);ctx.fill('evenodd');ctx.fillStyle='rgba(44,110,93,.06)';ctx.fillRect(x,y,x2-x,y2-y);ctx.strokeStyle='#346657';ctx.lineWidth=2;ctx.strokeRect(x,y,x2-x,y2-y);
  for(const p of [[x,y],[x2,y],[x2,y2],[x,y2]]){ctx.fillStyle='#fff';ctx.strokeStyle='#346657';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(p[0]-6,p[1]-6,12,12,3);ctx.fill();ctx.stroke();}
  const d=R.boundsInfo(this.bounds),label=`${(d.w/1000).toFixed(2)} × ${(d.h/1000).toFixed(2)} km`;
  ctx.font='600 12px system-ui';const tw=ctx.measureText(label).width;ctx.fillStyle='#244b40';ctx.beginPath();ctx.roundRect((x+x2-tw)/2-10,Math.max(8,y-32),tw+20,25,6);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(label,(x+x2-tw)/2,Math.max(25,y-15));
  if(![...this.tiles.values()].some(t=>t.state==='ready')&&[...this.tiles.values()].some(t=>t.state==='error')){ctx.fillStyle='#41544b';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('Hintergrundkarte nicht erreichbar — Ausschnitt bleibt einstellbar.',W/2,H-32);ctx.textAlign='left';}
 }
}
R.AreaMap=AreaMap;
})(globalThis.RS);