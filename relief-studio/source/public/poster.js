(function(R){
'use strict';
const LIMIT=8000000;
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
// All positions are physical millimetres; the same scene drives preview and export.
const fontFamily=f=>f==='mono'?'Courier New,monospace':f==='serif'?'Times New Roman,serif':'Arial,sans-serif';
let measureContext;
function textWidth(value,size,font='sans',bold=false,tracking=0){
 if(typeof document!=='undefined'){
  measureContext ||= document.createElement('canvas').getContext('2d');
  if(measureContext){measureContext.font=`${bold?'bold':'normal'} ${size*10}px ${fontFamily(font)}`;return measureContext.measureText(value).width/10+Math.max(0,[...value].length-1)*tracking;}
 }
 return [...value].length*size*(font==='mono'?.6:.53)+Math.max(0,[...value].length-1)*tracking;
}
function effectivePalette(s){
 const p={...R.palettes[s.style]};
 if(s.customColors)Object.assign(p,{paper:s.paperColor,land:s.landColor,ink:s.inkColor,water:s.waterColor,accent:s.accentColor,major:s.majorColor,building:s.buildingColor});
 return p;
}
function coordinates(d,s){
 if(s.coordinateStyle==='custom')return s.customCoordinates;
 if(s.coordinateStyle==='dms'){
  const one=(v,positive,negative)=>{const total=Math.round(Math.abs(v)*3600),deg=Math.floor(total/3600),min=Math.floor(total%3600/60),sec=total%60;return `${deg}° ${String(min).padStart(2,'0')}′ ${String(sec).padStart(2,'0')}″ ${v>=0?positive:negative}`;};
  // ASCII prime signs are supported by the PDF's Base-14 fonts too.
  return (one(d.lat,'N','S')+'   '+one(d.lon,'E','W')).replaceAll('′',"'").replaceAll('″','"');
 }
 return `${Math.abs(d.lat).toFixed(4)}° ${d.lat>=0?'N':'S'}   ${Math.abs(d.lon).toFixed(4)}° ${d.lon>=0?'E':'W'}`;
}
function posterScene(data,settings,options={}){
 if(!data)throw Error('Noch keine Kartendaten geladen. Bitte im Schritt „Ort“ die Karte laden.');
 const s=R.cleanSettings(settings),p=effectivePalette(s),W=s.paperW,H=s.paperH,M=options.designPreview?0:Math.min(s.margin,W*.12,H*.10),footer=options.designPreview?0:Math.max(5,H*.026),band=s.layout==='map'?0:H*s.band/100,gap=band?Math.min(4,H*.012):0;
 const availableW=W-2*M,availableH=Math.max(15,H-2*M-footer-band-gap),areaW=availableW*(options.designPreview?1:s.mapScale),areaH=availableH*(options.designPreview?1:s.mapScale);
 const area={x:M+(availableW-areaW)/2,y:M+(s.layout==='top'?band+gap:0)+(availableH-areaH)/2,w:areaW,h:areaH},d=R.boundsInfo(data.bounds);
 const scale=(s.mapFit==='cover'?Math.max:Math.min)(area.w/d.w,area.h/d.h),drawW=d.w*scale,drawH=d.h*scale,ox=area.x+(area.w-drawW)/2,oy=area.y+(area.h-drawH)/2,clip={x:Math.max(ox,area.x),y:Math.max(oy,area.y),w:Math.min(ox+drawW,area.x+area.w)-Math.max(ox,area.x),h:Math.min(oy+drawH,area.y+area.h)-Math.max(oy,area.y)},ops=[];
 const path=(points,color,width,fill=null,close=false)=>ops.push({type:'path',points,color,width,fill,close});
 const text=(value,x,y,size,color,options={})=>ops.push({type:'text',value:String(value),x,y,size,color,bold:false,align:'center',font:'sans',tracking:0,...options});
 const xy=a=>[ox+a[0]*drawW,oy+a[1]*drawH],widthScale=Math.pow(W/210,.8);
 const screenScale=options.preview?Math.max(250,options.previewPixels||900)/Math.max(W,H):0;
 let previewOmitted=0;
 // Detail reduction applies ONLY to on-screen preview. STL and PDF/PNG/JPEG use full data.
 const visibleAtScale=b=>{if(!options.preview||data.buildings.length<7500)return true;const box=R.ringBox(b.rings[0]),width=(box[2]-box[0])*drawW*screenScale,height=(box[3]-box[1])*drawH*screenScale;return width>=.7||height>=.7;};
 ops.push({type:'rect',x:0,y:0,w:W,h:H,fill:p.paper,role:'paper'});
 ops.push({type:'clip',...clip});
 ops.push({type:'rect',x:ox,y:oy,w:drawW,h:drawH,fill:p.land,role:'map'});
 if(s.hillshade&&data.terrain.available!==false){
  let lo=Infinity,hi=-Infinity;for(const z of data.terrain.values){lo=Math.min(lo,z);hi=Math.max(hi,z);}
  const n=48,m=Math.max(24,Math.round(n*d.h/d.w)),base=hexRGB(p.land),dark=hexRGB(p.contour);
  for(let y=0;y<m;y++)for(let x=0;x<n;x++){const z=R.sampleTerrain(data.terrain,x/(n-1),y/(m-1)),k=(z-lo)/Math.max(1,hi-lo)*.28,col='#'+base.map((v,i)=>Math.round((v*(1-k)+dark[i]*k)*255).toString(16).padStart(2,'0')).join('');ops.push({type:'rect',x:ox+x/n*drawW,y:oy+y/m*drawH,w:drawW/n+.01,h:drawH/m+.01,fill:col});}
 }
 for(const park of data.parks)ops.push({type:'polygon',rings:park.rings.map(r=>r.map(xy)),fill:p.park});
 if(s.contours&&data.terrain.available!==false){if(!data._contours)data._contours=R.contours(data.terrain,20);for(const line of data._contours)path(line.map(xy),p.contour,.055*widthScale);}
 for(const water of data.water)ops.push({type:'polygon',rings:water.rings.map(r=>r.map(xy)),fill:p.water});
 for(const road of data.roads.filter(r=>r.kind==='river'))path(road.points.map(xy),p.water,Math.max(.3,drawW/d.w*18));
 if(s.showBuildings){
  const eligible=options.preview?data.buildings.filter(visibleAtScale):data.buildings,step=options.preview&&eligible.length>18000?Math.ceil(eligible.length/18000):1;
  for(let i=0;i<eligible.length;i++){const b=eligible[i];if(step>1&&i%step!==0&&!b.landmark){previewOmitted++;continue;}ops.push({type:'polygon',rings:b.rings.map(r=>r.map(xy)),fill:b.landmark?p.accent:p.building});}
  if(options.preview)previewOmitted+=data.buildings.length-eligible.length;
 }
 const widths={major:.16*s.major,secondary:.10*s.secondary,local:.065*s.local,path:.04*s.paths};
 for(const kind of ['path','local','secondary','major'])if(widths[kind]>0){const roads=data.roads.filter(r=>r.kind===kind),step=options.preview&&roads.length>15000?Math.ceil(roads.length/15000):1;
  for(let i=0;i<roads.length;i++){if(step>1&&i%step!==0){previewOmitted++;continue;}path(roads[i].points.map(xy),p[kind],widths[kind]*widthScale);}
 }
 if(s.showLabels){
  const labels=data.landmarks.filter(item=>s.landmarkOverrides?.[item.id]?.label!==false).slice().sort((a,b)=>Number(!!s.landmarkOverrides?.[b.id]?.featured)-Number(!!s.landmarkOverrides?.[a.id]?.featured)||(b.priority||0)-(a.priority||0)||String(a.name).localeCompare(String(b.name),'de')).slice(0,s.markerLimit),used=[];
  for(const item of labels){const [x,y]=xy(item.point),size=Math.max(1.4,W*.010)*s.labelScale,value=String(item.name).slice(0,40),tw=textWidth(value,size,s.labelFont),l=x-tw/2,r=x+tw/2,yy=y+size*1.6;
   if(l<clip.x+1||r>clip.x+clip.w-1||yy>clip.y+clip.h-2||y<clip.y+1||used.some(b=>!(r<b[0]||l>b[2]||yy<b[1]||yy-size>b[3])))continue;
   if(s.labelMarkers)ops.push({type:'circle',x,y,r:Math.max(.35,W*.0024),fill:s.markerColor});
   text(value,x,yy,size,s.labelColor,{role:'landmark',font:s.labelFont,halo:s.labelStyle==='halo'?p.paper:null,haloWidth:size*.18});used.push([l,yy-size,r,yy+1]);
  }
 }
 ops.push({type:'restore'});
 if(s.mapBorder){const inset=.08*widthScale,x=clip.x+inset,y=clip.y+inset,w=Math.max(0,clip.w-2*inset),h=Math.max(0,clip.h-2*inset);path([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],p.ink,.16*widthScale);}
 if(s.layout!=='map'){
  const start=s.layout==='top'?M:M+availableH+gap,align=s.textAlign,x=align==='left'?M:align==='right'?W-M:W/2,maxWidth=(W-2*M)*.97;
  const title=s.uppercase?s.title.toLocaleUpperCase('de-DE'):s.title,baseSize=Math.min(W*.092*s.headline,band*.34);
  const titleWidth=textWidth(title,baseSize,s.font,s.boldTitle,baseSize*s.tracking),size=baseSize*Math.min(1,maxWidth/Math.max(.01,titleWidth));
  const y=start+band*.34;text(title,x,y,size,p.ink,{font:s.font,bold:s.boldTitle,align,tracking:size*s.tracking,role:'title'});
  const rows=[];if(s.subtitle)rows.push({value:s.subtitle,size:Math.min(W*.019*s.subtitleScale,band*.12),role:'subtitle'});
  if(s.caption)rows.push({value:s.caption,size:Math.min(W*.016*s.captionScale,band*.105),role:'caption'});
  if(s.showCoordinates){const value=coordinates(d,s);if(value)rows.push({value,size:Math.min(W*.014,band*.09),role:'coordinates'});}
  rows.forEach((row,i)=>{const yy=start+band*(.54+i*.155),sz=row.size*Math.min(1,maxWidth/Math.max(.01,textWidth(row.value,row.size)));text(row.value,x,yy,sz,p.ink,{align,role:row.role});});
  if(s.divider){const yy=start+band*.415,line=W*.12,xx=align==='left'?M:align==='right'?W-M-line:(W-line)/2;path([[xx,yy],[xx+line,yy]],p.ink,.18*widthScale);}
 }
 if(!options.designPreview&&s.showAttribution){
  const source='© OpenStreetMap · openstreetmap.org/copyright';
  const sourceSize=Math.min(2.6,Math.max(1.9,W*.011)) * Math.min(1,(W-6)/Math.max(1,textWidth(source,Math.min(2.6,Math.max(1.9,W*.011)),'sans')));
  text(source,W/2,H-Math.max(2.5,Math.min(5,M*.4)),sourceSize,p.ink,{role:'source'});
 }
 return {width:W,height:H,ops,map:{x:ox,y:oy,w:drawW,h:drawH},area,previewOmitted};
}
function paintScene(ctx,scene,scale){
 ctx.save();ctx.setTransform(scale,0,0,scale,0,0);ctx.lineCap='round';ctx.lineJoin='round';
 for(const o of scene.ops){
  if(o.type==='rect'){ctx.fillStyle=o.fill;ctx.fillRect(o.x,o.y,o.w,o.h);}
  else if(o.type==='clip'){ctx.save();ctx.beginPath();ctx.rect(o.x,o.y,o.w,o.h);ctx.clip();}
  else if(o.type==='restore')ctx.restore();
  else if(o.type==='polygon'){ctx.beginPath();for(const ring of o.rings){ring.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}ctx.fillStyle=o.fill;ctx.fill('evenodd');}
  else if(o.type==='path'){if(o.points.length<2)continue;ctx.beginPath();o.points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(o.close)ctx.closePath();if(o.fill){ctx.fillStyle=o.fill;ctx.fill();}if(o.color&&o.width>0){ctx.strokeStyle=o.color;ctx.lineWidth=o.width;ctx.stroke();}}
  else if(o.type==='circle'){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle=o.fill;ctx.fill();}
  else if(o.type==='text'){
   ctx.font=`${o.bold?'bold':'normal'} ${o.size}px ${fontFamily(o.font)}`;ctx.textAlign='left';ctx.fillStyle=o.color;
   const chars=[...o.value],measure=ctx.measureText(o.value).width+Math.max(0,chars.length-1)*(o.tracking||0);let x=o.align==='center'?o.x-measure/2:o.align==='right'?o.x-measure:o.x;
   const paint=(value,xx)=>{if(o.halo){ctx.strokeStyle=o.halo;ctx.lineWidth=o.haloWidth;ctx.strokeText(value,xx,o.y);}ctx.fillText(value,xx,o.y);};
   if(o.tracking){for(const c of chars){paint(c,x);x+=ctx.measureText(c).width+o.tracking;}}else paint(o.value,x);
  }
 }
 ctx.restore();
}
async function compress(bytes){if(typeof CompressionStream==='undefined')return null;const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
function pdfString(value){
 // Base-14 WinAnsi text. Unknown glyphs are transliterated, and a warning is returned.
 const extra={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};let out='';
 for(const char of value){let code=extra[char]||char.charCodeAt(0);if(code>255){const plain=char.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');code=plain.charCodeAt(0);if(code>255)code=63;}if(code===40||code===41||code===92)out+='\\'+String.fromCharCode(code);else if(code>=128)out+='\\'+code.toString(8).padStart(3,'0');else out+=String.fromCharCode(code);}return '('+out+')';
}
async function pdf(scene){
 const PT=72/25.4,N=v=>Number(v.toFixed(3)).toString(),X=v=>N(v*PT),Y=v=>N((scene.height-v)*PT),rgb=h=>hexRGB(h).map(N).join(' '),lines=['1 J 1 j'];
 for(let k=0;k<scene.ops.length;k++){
  if(k&&k%650===0)await new Promise(resolve=>setTimeout(resolve,0));
  const o=scene.ops[k];
  if(o.type==='rect')lines.push(`${rgb(o.fill)} rg ${X(o.x)} ${Y(o.y+o.h)} ${X(o.w)} ${X(o.h)} re f`);
  else if(o.type==='clip')lines.push(`q ${X(o.x)} ${Y(o.y+o.h)} ${X(o.w)} ${X(o.h)} re W n`);
  else if(o.type==='restore')lines.push('Q');
  else if(o.type==='polygon'){lines.push(rgb(o.fill)+' rg');for(const ring of o.rings){ring.forEach((p,i)=>lines.push(`${X(p[0])} ${Y(p[1])} ${i?'l':'m'}`));lines.push('h');}lines.push('f*');}
  else if(o.type==='path'){if(o.points.length<2)continue;if(o.color)lines.push(`${rgb(o.color)} RG ${X(o.width)} w`);if(o.fill)lines.push(`${rgb(o.fill)} rg`);o.points.forEach((p,i)=>lines.push(`${X(p[0])} ${Y(p[1])} ${i?'l':'m'}`));if(o.close)lines.push('h');lines.push(o.fill?(o.color?'B':'f'):'S');}
  else if(o.type==='circle'){const k=o.r*.55228475,x=o.x,y=o.y,r=o.r;lines.push(`${rgb(o.fill)} rg ${X(x+r)} ${Y(y)} m ${X(x+r)} ${Y(y+k)} ${X(x+k)} ${Y(y+r)} ${X(x)} ${Y(y+r)} c ${X(x-k)} ${Y(y+r)} ${X(x-r)} ${Y(y+k)} ${X(x-r)} ${Y(y)} c ${X(x-r)} ${Y(y-k)} ${X(x-k)} ${Y(y-r)} ${X(x)} ${Y(y-r)} c ${X(x+k)} ${Y(y-r)} ${X(x+r)} ${Y(y-k)} ${X(x+r)} ${Y(y)} c f`);}
  else if(o.type==='text'){
   const font=o.font==='mono'?(o.bold?'F6':'F5'):o.font==='serif'?(o.bold?'F4':'F3'):(o.bold?'F2':'F1'),measure=textWidth(o.value,o.size,o.font,o.bold,o.tracking||0),x=o.align==='center'?o.x-measure/2:o.align==='right'?o.x-measure:o.x;
   lines.push(`q BT /${font} ${X(o.size)} Tf ${X(o.tracking||0)} Tc ${o.halo?'2':'0'} Tr ${rgb(o.color)} rg ${o.halo?rgb(o.halo)+' RG '+X(o.haloWidth)+' w ':''}1 0 0 1 ${X(x)} ${Y(o.y)} Tm ${pdfString(o.value)} Tj ET Q`);
  }
 }
 const enc=new TextEncoder(),raw=enc.encode(lines.join('\n')),compressed=await compress(raw),stream=compressed||raw,objects=[];
 objects.push(enc.encode('<< /Type /Catalog /Pages 2 0 R >>'));
 objects.push(enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
 objects.push(enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${X(scene.width)} ${X(scene.height)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R /F5 8 0 R /F6 9 0 R >> >> /Contents 10 0 R >>`));
 for(const base of ['Helvetica','Helvetica-Bold','Times-Roman','Times-Bold','Courier','Courier-Bold'])objects.push(enc.encode(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`));
 const prefix=enc.encode(`<< /Length ${stream.length}${compressed?' /Filter /FlateDecode':''} >>\nstream\n`),suffix=enc.encode('\nendstream'),streamObj=new Uint8Array(prefix.length+stream.length+suffix.length);streamObj.set(prefix);streamObj.set(stream,prefix.length);streamObj.set(suffix,prefix.length+stream.length);objects.push(streamObj);
 const header=enc.encode('%PDF-1.7\n% Relief Studio vector poster\n'),chunks=[header],offsets=[0];let offset=header.length;
 objects.forEach((obj,i)=>{offsets.push(offset);const a=enc.encode(`${i+1} 0 obj\n`),b=enc.encode('\nendobj\n');chunks.push(a,obj,b);offset+=a.length+obj.length+b.length;});
 let trailer=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('');trailer+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;chunks.push(enc.encode(trailer));return new Blob(chunks,{type:'application/pdf'});
}
function rasterCapacity(){const mem=typeof navigator!=='undefined'?Number(navigator.deviceMemory)||0:0;return mem>0&&mem<=4?24000000:80000000;}
function rasterPlan(s,maxPixels=rasterCapacity()){const targetW=Math.ceil(s.paperW/25.4*s.dpi),targetH=Math.ceil(s.paperH/25.4*s.dpi),factor=Math.min(1,Math.sqrt(maxPixels/(targetW*targetH)),14000/targetW,14000/targetH);return {width:Math.max(1,Math.floor(targetW*factor)),height:Math.max(1,Math.floor(targetH*factor)),dpi:s.dpi*factor,reduced:factor<.999};}
async function withDPI(blob,dpi,format){
 const src=new Uint8Array(await blob.arrayBuffer());
 if(format==='png'){
  const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9,false);chunk.set([112,72,89,115],4);const ppm=Math.round(dpi/0.0254);v.setUint32(8,ppm,false);v.setUint32(12,ppm,false);chunk[16]=1;v.setUint32(17,R.crc32(chunk.subarray(4,17)),false);
  const parts=[src.subarray(0,8)];let off=8,inserted=false;while(off+12<=src.length){const len=new DataView(src.buffer,src.byteOffset+off,4).getUint32(0,false),type=String.fromCharCode(...src.subarray(off+4,off+8));if(!inserted&&type==='IDAT'){parts.push(chunk);inserted=true;}if(type!=='pHYs')parts.push(src.subarray(off,off+len+12));off+=len+12;}return new Blob(parts,{type:'image/png'});
 }
 if(format==='jpeg'&&src.length>18&&src[2]===255&&src[3]===224&&String.fromCharCode(...src.subarray(6,10))==='JFIF'){src[13]=1;const d=Math.round(R.clamp(dpi,1,65535));src[14]=d>>8;src[15]=d&255;src[16]=d>>8;src[17]=d&255;}
 return new Blob([src],{type:'image/jpeg'});
}
async function exportPoster(data,settings,onProgress){
 const s=R.cleanSettings(settings),scene=posterScene(data,s),warnings=[];
 if(!s.showAttribution)warnings.push('OpenStreetMap-Quellenangabe ausgeblendet: ausschließlich für den privaten Entwurf. Bei Veröffentlichung, Weitergabe oder Druck für Dritte die Namensnennung wieder aktivieren.');
 if(s.format==='pdf'){
  onProgress?.('Vektor-PDF wird aufgebaut',.3);
  if(typeof document!=='undefined'){const ctx=document.createElement('canvas').getContext('2d');R.pdfMeasure=(text,size,serif,bold)=>{ctx.font=`${bold?'bold':'normal'} ${size*10}px ${serif?'Times New Roman':'Arial'}`;return ctx.measureText(text).width/10;};}
  const blob=await pdf(scene);if(blob.size>LIMIT)throw Error('Das Vektor-PDF überschreitet 8 MB. Bitte Gebäude oder Höhenlinien reduzieren bzw. einen kleineren Ausschnitt wählen. Die Qualität wurde nicht heimlich reduziert.');
  if(/[^\u0000-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/u.test(scene.ops.filter(o=>o.type==='text').map(o=>o.value).join('')))warnings.push('Das PDF transliteriert Zeichen außerhalb von WinAnsi. Für dieses Schriftbild bitte PNG wählen.');
  return {blob,extension:'pdf',dpi:null,width:null,height:null,vector:true,warnings,summary:`${(blob.size/1e6).toFixed(2)} MB · Vektorgrafik · ${s.paperW/10} × ${s.paperH/10} cm`};
 }
 const maxPixels=rasterCapacity();
 let plan=rasterPlan(s,maxPixels),width=plan.width,height=plan.height,quality=.96;
 if(plan.reduced&&!s.adaptive)throw Error('Die gewünschte Auflösung überschreitet das sichere Bildspeicher-Limit. Bitte Vektor-PDF wählen, DPI verringern oder adaptive Auflösung erlauben.');
 const canvas=document.createElement('canvas'),mime=s.format==='png'?'image/png':'image/jpeg';
 const encode=q=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Der Browser konnte das Bild nicht kodieren. Bitte ein kleineres Format oder PDF wählen.')),mime,q));
 for(let attempt=0;attempt<9;attempt++){
  onProgress?.(`Druckdatei berechnen: ${width.toLocaleString('de-DE')} × ${height.toLocaleString('de-DE')} Pixel`,.15+attempt*.075);
  canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Nicht genügend Bildspeicher. Bitte PDF wählen.');paintScene(ctx,scene,width/s.paperW);await new Promise(r=>setTimeout(r,0));
  let blob=await encode(quality);
  if(blob.size>LIMIT&&s.format==='jpeg'){
   for(const q of [.90,.84,.78,.72]){const next=await encode(q);blob=next;quality=q;if(blob.size<LIMIT-50)break;}
  }
  const dpi=Math.min(width/(s.paperW/25.4),height/(s.paperH/25.4));blob=await withDPI(blob,dpi,s.format);
  if(blob.size<=LIMIT){canvas.width=canvas.height=1;if(dpi<s.dpi-.5)warnings.push(`Auflösung wegen Speicher-/8-MB-Grenze: ${Math.round(dpi)} statt ${s.dpi} dpi. Vor dem Download prüfen.`);if(quality<.90)warnings.push(`JPEG-Qualität auf ${Math.round(quality*100)} % angepasst.`);if(dpi<150)warnings.push('Unter 150 dpi: Für feine Linien im Großformat das Vektor-PDF bevorzugen.');return {blob,extension:s.format==='jpeg'?'jpg':'png',dpi,width,height,quality,vector:false,warnings,summary:`${(blob.size/1e6).toFixed(2)} MB · ${width} × ${height} px · ${Math.round(dpi)} dpi`};}
  if(!s.adaptive){canvas.width=canvas.height=1;throw Error('Mehr als 8 MB. Bitte Vektor-PDF wählen oder adaptive Auflösung aktivieren. Es wurde keine zu große Datei freigegeben.');}
  const factor=Math.min(.88,Math.sqrt((LIMIT-100000)/blob.size)*.92);width=Math.max(400,Math.floor(width*factor));height=Math.max(400,Math.floor(height*factor));
 }
 canvas.width=canvas.height=1;throw Error('8 MB sind mit diesen Einstellungen nicht erreichbar. Bitte PDF wählen.');
}
Object.assign(R,{effectivePalette,textWidth,coordinates,posterScene,paintScene,pdf,pdfString,rasterPlan,rasterCapacity,exportPoster,withDPI,MAX_POSTER_BYTES:LIMIT});
})(globalThis.RS);