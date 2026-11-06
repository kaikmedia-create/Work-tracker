/** Display-only inspection of the actual height-fusion decisions. No fake geometry,
 * no extra measurement downloads, and no additional full-mesh cache. */
const fmt=(n,d=1)=>Number(n).toLocaleString('de-DE',{maximumFractionDigits:d});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function reviewKey(settings){const s={...settings};delete s.surfaceMode;delete s.surfaceSchema;delete s.style;delete s.aerialColour;return JSON.stringify(s);}
export function heightReview(R,data,settings,fusion,reason=''){
 const base={state:'unchanged',changed:0,confirmed:0,protected:fusion?.protected||0,rejected:fusion?.rejected||0,entries:[],source:fusion?.source||'',reason};
 if(fusion?.status==='not-applied')return {...base,state:'rejected',title:'Keine Änderung: Messhöhen wurden nicht übernommen.',text:'Die Kantenprüfung hat die vorgeschlagenen Höhenkorrekturen verworfen. Sichtbar und exportierbar ist das klassische Modell.'};
 if(fusion?.status==='unavailable')return {...base,state:'unavailable',title:'Keine Änderung: Messhöhen nicht verfügbar.',text:'Der Messdatenabruf ist fehlgeschlagen. Das klassische Modell bleibt erhalten. '+String(fusion.reason||'')};
 if(!fusion)return {...base,state:'no-coverage',title:'Keine Änderung: keine nutzbaren Messdaten geladen.',text:'Dieser Ausschnitt wird weiterhin ausschließlich aus den klassischen Kartendaten aufgebaut. Die Auswahl „Messhöhen“ allein ergänzt keine Daten.'};
 const byId=new Map((data?.buildings||[]).map(b=>[b.id,b])),span=R.boundsInfo(data.bounds).w,scale=settings.modelWidth/span;
 for(const row of fusion.buildings||[]){
  if(row.status!=='applied'||!finite(row.originalHeight)||!finite(row.heightMetres))continue;
  if(Math.abs(row.heightMetres-row.originalHeight)<.05){base.confirmed++;continue;}
  const b=byId.get(row.id);if(!b?.rings?.[0]?.length)continue;
  const box=R.ringBox(b.rings[0]);if(box[2]<=0||box[3]<=0||box[0]>=1||box[1]>=1)continue;
  const t=b.tags||{},override=settings.landmarkOverrides?.[b.id],isLand=override?.enabled??b.landmark,amplifier=(settings.buildingFactor??1)*(isLand?(settings.landmarkFactor??1):1),delta=row.heightMetres-row.originalHeight;
  const name=b.name||[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' ')||'Gebäude '+b.id;
  base.entries.push({id:row.id,name,oldMetres:row.originalHeight,newMetres:row.heightMetres,deltaMetres:delta,deltaMillimetres:delta*scale*amplifier,box,building:b});
 }
 base.entries.sort((a,b)=>Math.abs(b.deltaMillimetres)-Math.abs(a.deltaMillimetres)||a.id.localeCompare(b.id));base.changed=base.entries.length;
 if(!base.changed)return {...base,title:'Keine geänderten Gebäudehöhen.',text:`${fmt(base.confirmed,0)} Höhen bestätigt · ${fmt(base.protected,0)} vorhandene Angaben geschützt · ${fmt(base.rejected,0)} ohne ausreichende Messwerte. Dachformen werden in diesem Modus nicht ergänzt.`};
 const ds=base.entries.map(e=>Math.abs(e.deltaMillimetres)).sort((a,b)=>a-b),middle=ds.length%2?ds[Math.floor(ds.length/2)]:(ds[ds.length/2-1]+ds[ds.length/2])/2;
 return {...base,state:'changed',medianMillimetres:middle,maxMillimetres:ds.at(-1),title:`${fmt(base.changed,0)} Gebäudehöhen geändert`,text:`Typische Änderung im ${fmt(settings.modelWidth,0)}-mm-Modell: ${fmt(middle,2)} mm (Median). Dachformen bleiben unverändert. ${fmt(base.confirmed,0)} weitere Höhen bestätigt.`};
}
function camera(v){if(!v?.mesh)return null;const n=Math.max(v.mesh.width,v.mesh.height);return {focus:[v.focus[0],v.focus[1],v.focus[2]+v.mesh.zmax/n*.35],zoom:v.zoom,pitch:v.pitch,yaw:v.yaw};}
export function restoreCamera(v,c){if(!v?.mesh||!c)return;const n=Math.max(v.mesh.width,v.mesh.height);v.focus=[c.focus[0],c.focus[1],c.focus[2]-v.mesh.zmax/n*.35];v.zoom=c.zoom;v.pitch=c.pitch;v.yaw=c.yaw;v.queue();}
export function createHeightReview(R,{getState,getViewer,showModel,changeMode,diagnose}){
 const host=document.getElementById('view-model');if(!host)return {update(){},pending(){}};
 const style=document.createElement('style');style.textContent=`
 #height-review{position:absolute;left:12px;bottom:42px;z-index:3;max-width:min(440px,calc(100% - 24px));padding:10px 12px;background:#fffefaed;border:1px solid #d3ddcf;border-radius:10px;color:#263d34;font:12px/1.4 Arial,sans-serif;box-shadow:0 2px 8px #263d3410}
 #height-review strong{display:block;font-size:13px}#height-review p{margin:5px 0;font-size:11px}#height-review button{border:1px solid #d4dccf;background:#f5f6ef;color:#263d34;border-radius:6px;min-height:36px;padding:7px 10px;font-size:11px}#height-review button[aria-pressed=true]{background:#315f4c;color:white}#height-review .height-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}#height-review .height-detail{max-height:24vh;overflow:auto}#height-review[data-state=no-coverage],#height-review[data-state=unavailable],#height-review[data-state=rejected]{border-color:#b98b4d}body[data-phone] #height-review{left:8px;bottom:40px;max-width:calc(100% - 16px);padding:8px 10px}body[data-phone] #height-review button{min-height:44px}body[data-phone] #height-review .height-detail{max-height:18vh}
 `;document.head.append(style);
 const panel=document.createElement('section');panel.id='height-review';panel.hidden=true;panel.setAttribute('aria-label','Gebäudehöhen vergleichen');
 const title=document.createElement('strong');title.id='height-review-title';title.setAttribute('role','status');title.setAttribute('aria-live','polite');
 const text=document.createElement('p');text.id='height-review-text';const detail=document.createElement('div');detail.className='height-detail';
 const item=document.createElement('p');item.id='height-review-building';const values=document.createElement('p');values.id='height-review-values';detail.append(item,values);
 const actions=document.createElement('div');actions.className='height-actions';const buttons={};
 for(const [id,label] of [['show','Unterschied ansehen'],['next','Nächstes Gebäude'],['before','Vorher'],['after','Nachher'],['diagnose','↓ Diagnose']]){const b=document.createElement('button');b.id='height-review-'+id;b.type='button';b.textContent=label;buttons[id]=b;actions.append(b);}
 panel.append(title,text,detail,actions);host.append(panel);
 let dataRef=null,key='',audit=null,review=null,selected=-1,snapshot=null,busy=false,focused=false;
 function clear(){audit=null;review=null;selected=-1;focused=false;snapshot=null;}
 function summary(){
  const state=getState();panel.hidden=!state.data||state.settings.mode!=='model'||state.settings.surfaceMode==='auto'||(!review&&(!busy||state.settings.surfaceMode!=='hybrid'));
  if(panel.hidden)return;panel.dataset.state=busy?'pending':review.state;
  title.textContent=busy?(state.settings.surfaceMode==='hybrid'?'Messhöhen werden geprüft …':'Klassischer Vergleich wird berechnet …'):review.title;
  text.textContent=busy?'Die bisherige Ansicht ist noch sichtbar; sie ist nicht das neue Ergebnis.':review.text;
  const has=!!review?.entries.length;buttons.show.hidden=!has||focused;buttons.next.hidden=!has||!focused||review.entries.length<2;
  buttons.before.hidden=buttons.after.hidden=!has;buttons.diagnose.hidden=busy||!!has;
  for(const b of Object.values(buttons))b.disabled=busy;
  buttons.before.setAttribute('aria-pressed',String(state.settings.surfaceMode==='classic'));buttons.after.setAttribute('aria-pressed',String(state.settings.surfaceMode==='hybrid'));
  buttons.before.title='Klassisches Modell aus denselben Kartendaten berechnen. Kamera bleibt erhalten.';buttons.after.title='Modell mit Messhöhen berechnen. Kamera bleibt erhalten.';
  detail.hidden=!has||!focused||busy;
  if(has&&focused){const e=review.entries[Math.min(Math.max(0,selected),review.entries.length-1)];item.textContent=e.name+' · Beispiel '+(selected+1)+' von '+review.entries.length;values.textContent=`${fmt(e.oldMetres)} m → ${fmt(e.newMetres)} m · ${e.deltaMillimetres>=0?'+':''}${fmt(e.deltaMillimetres,2)} mm im Druckmodell. Sichtbar: ${state.settings.surfaceMode==='classic'?'Vorher (klassisch)':'Nachher (Messhöhen)'}.`;
  }
 }
 function focusNext(next=false){if(!review?.entries.length)return;selected=next?(selected+1)%review.entries.length:Math.max(0,selected);const e=review.entries[selected],state=getState(),v=getViewer();if(!v?.mesh)return;focused=true;showModel();
  const {settings:s,data,mesh}=state,dim=R.boundsInfo(data.bounds),w=s.modelWidth,h=w*dim.h/dim.w,n=Math.max(mesh.width,mesh.height),scale=w/dim.w;
  const bb=e.box,u=Math.max(0,Math.min(1,(bb[0]+bb[2])/2)),y=Math.max(0,Math.min(1,(bb[1]+bb[3])/2));
  const ground=R.architecture.smoothTerrainGrid(data.terrain,s.terrainSmooth);let low=Infinity;for(const value of data.terrain.values)low=Math.min(low,value);const foot=s.base+Math.max(0,R.sampleTerrain(ground,u,y)-low)*scale*s.terrainFactor;
  const override=s.landmarkOverrides?.[e.id],factor=(s.buildingFactor??1)*((override?.enabled??e.building.landmark)?(s.landmarkFactor??1):1),z=foot+Math.max(e.oldMetres,e.newMetres)*scale*factor*.45;
  v.focus=[(u-.5)*w/n,(.5-y)*h/n,(z-mesh.zmax*.35)/n];v.pitch=.55;v.zoom=R.clamp(n/Math.max((bb[2]-bb[0])*w*4,(bb[3]-bb[1])*h*4,w/20),3,24);v.queue();const out=document.getElementById('nav-percent');if(out)out.textContent=Math.round(v.zoom*100)+' %';summary();
 }
 buttons.show.onclick=()=>focusNext();buttons.next.onclick=()=>focusNext(true);buttons.diagnose.onclick=()=>diagnose();
 for(const [id,mode] of [['before','classic'],['after','hybrid']])buttons[id].onclick=()=>{if(getState().settings.surfaceMode===mode)return;snapshot=camera(getViewer());changeMode(mode);};
 return {
  pending(){const st=getState();if(st.data!==dataRef||reviewKey(st.settings)!==key){clear();dataRef=st.data;key=reviewKey(st.settings);}if(focused&&!snapshot)snapshot=camera(getViewer());busy=true;summary();},
  update(){const st=getState(),k=reviewKey(st.settings);if(st.data!==dataRef||k!==key){clear();dataRef=st.data;key=k;}busy=!!st.building;if(!st.mesh&&!busy){review=null;audit=null;focused=false;snapshot=null;}
   if(st.mesh&&st.settings.surfaceMode==='hybrid'){audit=st.mesh.heightFusion||null;review=heightReview(R,st.data,st.settings,audit,st.mesh.surveyReason);}
   else if(st.mesh&&audit&&st.settings.surfaceMode==='classic')review=heightReview(R,st.data,st.settings,audit);
   if(snapshot&&st.mesh){restoreCamera(getViewer(),snapshot);snapshot=null;}
   if(!busy&&st.mesh&&st.settings.surfaceMode==='hybrid'&&st.data.heightFusionAudit){st.data.heightFusionAudit.comparison={changed:review.changed,confirmed:review.confirmed,medianMillimetres:review.medianMillimetres??null,maxMillimetres:review.maxMillimetres??null,modelWidth:st.settings.modelWidth};}
   summary();
  }
 };
}
