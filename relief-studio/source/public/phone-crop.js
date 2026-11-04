// Phone-only workspace. The original loader, validation, camera and exports stay in charge.
export function cropTools({$,body,dock,editor,preview,setPane,signal}) {
  const opts={signal}, make=(id,text)=>Object.assign(document.createElement('button'),{id,type:'button',textContent:text});
  const action=make('phone-crop-action',''), tools=make('phone-map-tools','Kartenhilfe'), note=$('#access-note');
  const privacy=document.createElement('small');privacy.className='phone-privacy';privacy.textContent=note.hidden?'':'Privat · Keine Kundendaten';$('.brand>span').append(privacy);
  const guide=make('phone-project-help','Hilfe & Quellen');$('.header-actions').append(guide);guide.onclick=()=>$('#help').click();
  const fullNote=document.createElement('p');fullNote.className='phone-security';fullNote.textContent=note.textContent;fullNote.hidden=note.hidden;$('.header-actions').append(fullNote);
  const dialog=document.createElement('dialog');dialog.id='phone-map-dialog';dialog.setAttribute('aria-label','Kartenausschnitt bedienen');
  const title=document.createElement('h3');title.textContent='Kartenausschnitt';const text=document.createElement('p');text.textContent='Ziehe den Rahmen in der Mitte, um ihn zu versetzen. Ziehe eine Ecke für die Größe. Zwei Finger verschieben oder zoomen die Karte, ohne den Ausschnitt zu ändern.';
  const fit=make('phone-map-fit','Auswahl zentrieren'),close=make('phone-help-close','Schließen');dialog.append(title,text,fit,close);body.append(dialog);
  const canvas=$('#map-canvas'),load=$('#load-data'),save=$('#save-project'),loader=$('#loader'),area=$('#view-area');area.append(tools);dock.append(action);body.dataset.cropUi='';
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./phone-crop.css?v=2',import.meta.url).href;document.head.append(link);
  let frame=0,fitKey='',lastPanel='',wasMap=false;const vv=window.visualViewport;
  function measure(){if(!vv||vv.scale===1)body.style.setProperty('--phone-height',`${Math.round(vv?.height||innerHeight)}px`);}
  measure();vv?.addEventListener('resize',measure,opts);window.addEventListener('resize',measure,opts);
  function key(){const s=window.ReliefStudio.settings;return [s.lon,s.lat,s.widthKm,s.heightKm].join('/');}
  function update(){
    const edit=body.dataset.phonePane==='edit',busy=!loader.hidden,ready=!!window.ReliefStudio.data&&!save.dataset.blocked;
    const mapOpen=!edit&&!area.hidden&&!$('.workspace').hidden;
    body.toggleAttribute('data-need-map',!ready);body.toggleAttribute('data-map-open',mapOpen);action.hidden=edit||busy;
    preview.hidden=!edit;preview.textContent=ready?'Vorschau öffnen':'Ausschnitt ansehen';editor.textContent=edit?'Einstellungen':'Bearbeiten';
    action.textContent=ready?'Zum Export':window.ReliefStudio.data?'Ausschnitt neu laden':body.dataset.mode==='model'?'3D-Relief erstellen':'Poster erstellen';action.disabled=busy;
    if(mapOpen&&!wasMap&&fitKey!==key()){fitKey=key();$('#fit-area').click();}if(mapOpen)fitKey=key();wasMap=mapOpen;
    const panel=window.ReliefStudio.panel;if(edit&&panel!==lastPanel)$('.sidebar').scrollTop=0;lastPanel=panel;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});}
  const watch=new MutationObserver(schedule);for(const [node,attrs] of [[body,['data-mode','data-phone-pane']],[save,['data-blocked']],[loader,['hidden']],[area,['hidden']],[$('.workspace'),['hidden']]])watch.observe(node,{attributes:true,attributeFilter:attrs});
  document.addEventListener('click',schedule,opts);document.addEventListener('change',schedule,opts);
  action.addEventListener('click',()=>{if(!loader.hidden)return;if(window.ReliefStudio.data&&!save.dataset.blocked){setPane('edit');$('#export-top').click();}else load.click();},opts);
  tools.onclick=()=>dialog.showModal();close.onclick=()=>dialog.close();fit.onclick=()=>{dialog.close();$('#fit-area').click();};
  const undo=mapGestures(canvas);update();return ()=>{watch.disconnect();cancelAnimationFrame(frame);undo();for(const el of [link,dialog,privacy,guide,fullNote,tools,action])el.remove();preview.hidden=false;delete body.dataset.cropUi;delete body.dataset.needMap;delete body.dataset.mapOpen;body.style.removeProperty('--phone-height');};
}
// AreaMap's listeners delegate to its methods. Only intercept active touches on this
// canvas and restore original methods when returning to a desktop input profile.
function mapGestures(canvas){
  const proto=globalThis.RS.AreaMap.prototype,orig={down:proto.down,move:proto.move,up:proto.up,fit:proto.fit};
  const pts=new Map();let pair=null,suppress=false,owner=null,start=null;
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function reset(m,restore){if(m.drag&&restore)m.bounds=m.drag.bounds.slice();m.drag=null;canvas.style.cursor='grab';m.draw();}
  function down(e){if(this.canvas!==canvas||e.pointerType!=='touch')return orig.down.call(this,e);owner=this;const p=this.point(e);pts.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
    if(pts.size===1&&!suppress){start=p;orig.down.call(this,e);const d=this.drag;if(d&&d.mode!=='draw'){const [x,y,X,Y]=this.box();const corners=[[x,y],[X,y],[X,Y],[x,Y]];let best=24;corners.forEach((corner,i)=>{const gap=dist(p,corner);if(gap<best){best=gap;d.corner=i;d.mode='resize';}});}return;}
    if(pts.size===2&&!suppress){reset(this,true);const [a,b]=[...pts.values()];pair={anchor:this.fromScreen(mid(a,b)),distance:Math.max(2,dist(a,b)),zoom:this.zoom};suppress=true;}
  }
  function move(e){if(this.canvas!==canvas||e.pointerType!=='touch')return orig.move.call(this,e);if(!pts.has(e.pointerId))return;pts.set(e.pointerId,this.point(e));if(!suppress){if(start&&dist(start,pts.get(e.pointerId))<4)return;start=null;return orig.move.call(this,e);}if(!pair||pts.size!==2)return;
    const [a,b]=[...pts.values()],pos=mid(a,b),level=Math.log2(Math.max(.01,dist(a,b)/pair.distance));if(Math.abs(level-(this.zoom-pair.zoom))>.62)this.zoom=Math.max(3,Math.min(19,pair.zoom+Math.round(level)));
    const anchor=this.world(pair.anchor),[w,h]=this.size();this.centre=this.fromWorld([anchor[0]-pos[0]+w/2,anchor[1]-pos[1]+h/2]);this.draw();
  }
  function up(e){if(this.canvas!==canvas||e?.pointerType!=='touch')return orig.up.call(this,e);if(!pts.delete(e.pointerId))return;if(suppress){pair=null;if(!pts.size)suppress=false;return;}
    const d=this.drag;if(!d)return;if(e.type==='pointercancel'||d.mode==='pan'||this.bounds.every((v,i)=>v===d.bounds[i])){reset(this,e.type==='pointercancel');return;}return orig.up.call(this,e);
  }
  function fit(){if(this.canvas!==canvas)return orig.fit.call(this);const [w,h]=this.size();if(!w||!h)return;const b=this.bounds;this.centre=[(b[0]+b[2])/2,(b[1]+b[3])/2];this.zoom=3;for(let z=18;z>=3;z--){const a=RS.tileXY(b[0],b[3],z),c=RS.tileXY(b[2],b[1],z);if((c[0]-a[0])*256<=w*.84&&(c[1]-a[1])*256<=h*.7){this.zoom=z;break;}}this.draw();}
  proto.fit=fit;proto.down=down;proto.move=move;proto.up=up;
  function lost(e){if(owner&&pts.has(e.pointerId))up.call(owner,{pointerType:'touch',pointerId:e.pointerId,type:'pointercancel'});}
  canvas.addEventListener('lostpointercapture',lost);return ()=>{canvas.removeEventListener('lostpointercapture',lost);if(owner&&pts.size)reset(owner,true);pts.clear();if(proto.fit===fit)proto.fit=orig.fit;if(proto.down===down)proto.down=orig.down;if(proto.move===move)proto.move=orig.move;if(proto.up===up)proto.up=orig.up;};
}
