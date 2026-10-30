/* UI state and explicit export review. Project files contain data, never credentials. */
(function(R){
'use strict';
const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)],number=(v,d=1)=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:d}),nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
let settings=R.cleanSettings(),data=null,mesh=null,currentView='area',abort=null,searchAbort=null,pendingExport=null,buildTimer=null,buildId=0,building=false,toastTimer,viewer=null,worker=null,modelResolvers=new Map(),started=false,currentPanel='place',exporting=false,loadEpoch=0;
try{settings=R.cleanSettings(JSON.parse(localStorage.getItem('relief-settings-v3')||localStorage.getItem('relief-settings-v2')||'{}'));}catch{}
const cities={
 weinheim:{title:'Weinheim',region:'Baden-Württemberg',countryCode:'DE',countryName:'Deutschland',lon:8.6808,lat:49.548,widthKm:3.2,heightKm:3},
 heidelberg:{title:'Heidelberg',region:'Baden-Württemberg',countryCode:'DE',countryName:'Deutschland',lon:8.7104,lat:49.4118,widthKm:4,heightKm:3.5},
 mannheim:{title:'Mannheim',region:'Baden-Württemberg',countryCode:'DE',countryName:'Deutschland',lon:8.467,lat:49.488,widthKm:5,heightKm:4},
 newyork:{title:'New York',region:'New York',countryCode:'US',countryName:'United States',lon:-73.982,lat:40.754,widthKm:5,heightKm:7},
 foz:{title:'Foz',region:'Galicia',countryCode:'ES',countryName:'Spain',lon:-7.2568,lat:43.5666,widthKm:3.65,heightKm:3.42}
};
let bounds=R.boundsFor(settings.lon,settings.lat,settings.widthKm,settings.heightKm),locationEpoch=0,markerFilter='all',markerQuery='';
function updateLocationFields(loc,manual=false){
 if(loc.region)settings.region=loc.region;
 if(loc.countryCode)settings.countryCode=String(loc.countryCode).toUpperCase();
 if(loc.country)settings.countryName=loc.country;
 if(!manual&&settings.autoSubtitle){
  settings.subtitle=R.subtitleForLocation(settings.region,settings.countryCode,settings.countryName);
 }
 controls();persist();schedulePreview();
}
async function resolveRegion(){
 if(!settings.autoSubtitle)return;
 const seq=++locationEpoch,lon=settings.lon,lat=settings.lat;
 const status=$('region-status');if(status)status.textContent='Region wird ermittelt …';
 try{
  const result=await R.reverseRegion(lon,lat,settings.countryCode);
  if(seq!==locationEpoch||Math.abs(settings.lon-lon)>0.00001||Math.abs(settings.lat-lat)>0.00001||!settings.autoSubtitle)return;
  updateLocationFields(result);
  if(status)status.textContent='Automatisch: '+settings.subtitle;
 }catch(error){if(seq!==locationEpoch||!settings.autoSubtitle)return;
  if(status)status.textContent='Region konnte nicht abgerufen werden. Du kannst die Unterzeile manuell eintragen oder erneut ermitteln.';
 }
}

function notify(text,type='info',action=null){
 clearTimeout(toastTimer);$('toast').hidden=true;const target=started?document.querySelector('.main'):$('welcome');if($('notice').parentElement!==target)target.prepend($('notice'));
 $('notice').hidden=false;$('notice').className='notice '+type;
 $('notice-title').textContent={info:'Hinweis',success:'Erledigt',warning:'Bitte beachten',error:'Das hat nicht funktioniert'}[type]||'Hinweis';
 $('notice-message').textContent=text;
 $('notice-action').hidden=!action;if(action){$('notice-action').textContent=action.label;$('notice-action').onclick=action.run;}
}R.notify=notify;
function persist(){try{localStorage.setItem('relief-settings-v3',JSON.stringify(settings));}catch{}}
function flow(){return settings.mode==='poster'?['place','style','text','export']:['place','model','style','export'];}
function panel(name){
 if(!flow().includes(name))name='place';currentPanel=name;
 all('.panel').forEach(p=>{p.hidden=p.id!=='panel-'+name;p.classList.toggle('active',!p.hidden);});
 const labelsByMode=settings.mode==='poster'?['Ort','Kartenstil','Text & Layout','Export']:['Ort','Relief','Details','Export'];
 all('[data-step]').forEach((button,i)=>{button.querySelector('span').textContent=labelsByMode[i];button.setAttribute('aria-current',flow()[i]===name?'step':'false');});
 if(started)view(name==='place'?'area':settings.mode==='poster'?(name==='style'&&data?'design':name==='style'?'area':'poster'):'model');
 updateStepUI();document.querySelector('.panels').scrollTop=0;
}
function needsTerrain(){return !!data&&data.terrain.available===false&&(settings.mode==='model'||settings.contours||settings.hillshade);}
function outdatedCoastline(){return !!data?.realData&&data.coastlineVersion!==8&&data.water?.some(w=>w.tags?.derived==='sea');}
function commonReason(){
 if(abort)return 'Die Kartendaten werden gerade geladen. Du kannst den Abruf mit „Abbrechen“ beenden.';
 if(exporting)return 'Eine Datei wird gerade vorbereitet. Der Download wird danach freigegeben.';
 if(!data)return 'Noch keine Kartendaten vorhanden. Im Schritt „Ort“ einen Ausschnitt wählen und „Karte laden“ anklicken.';
 if(outdatedCoastline())return 'Dieses gespeicherte Projekt enthält die alte Küstenberechnung. Bitte im Schritt „Ort“ die Karte neu laden, damit Land und Meer korrekt getrennt werden.';
 if(stale())return 'Der Ausschnitt wurde verändert. Bitte im Schritt „Ort“ neu laden; ein Export der alten Karte wäre irreführend.';
 if(needsTerrain())return settings.mode==='model'?'Dieses Projekt enthält nur 2D-Kartendaten. Im Schritt „Ort“ echte Geländehöhen für das 3D-Modell nachladen.':'Für Höhenlinien oder Höhenfärbung fehlen Geländedaten. Im Schritt „Ort“ neu laden oder diese Ebenen ausschalten.';
 return '';
}
function modelReason(){return commonReason()||(building?'Das 3D-Modell wird neu berechnet. Der Export wird nach Abschluss freigegeben.':!mesh?'Das 3D-Modell konnte noch nicht berechnet werden. Im Schritt „Relief“ „Modell erneut berechnen“ anklicken.':'');}
function availability(id,reason){const b=$(id);if(!b)return;b.disabled=false;b.setAttribute('aria-disabled',reason?'true':'false');b.dataset.blocked=reason||'';b.title=reason||'';const hintId=id==='export-poster'?'poster-export-reason':['export-stl','export-3mf'].includes(id)?'model-export-reason':id==='step-next'?'step-hint':id==='load-data'?'load-reason':null;if(hintId)b.setAttribute('aria-describedby',hintId);}
function explain(reason){notify(reason,'warning',{label:'Zum Ort / Daten laden',run:()=>panel('place')});}
function updateStepUI(){
 const index=Math.max(0,flow().indexOf(currentPanel));$('step-counter').textContent=`Schritt ${index+1} von 4`;
 $('step-summary').textContent=(settings.mode==='poster'?['Ort & Ausschnitt','Farben & Straßen','Schrift & Komposition','Posterdatei']:['Ort & Ausschnitt','Höhen & Druckmaße','Farben & Details','Druckmodell'])[index];
 $('step-back').textContent=index===0?'← Auswahl':'← Zurück';
 $('step-next').textContent=index===3?(settings.mode==='poster'?'Poster vorbereiten ↗':'3MF herunterladen ↓'):index===0&&(!data||stale()||needsTerrain())?'Karte laden & weiter →':'Weiter →';
 const reason=index===3?(settings.mode==='poster'?commonReason():modelReason()):abort?'Die Karte wird geladen. Bitte den Abruf abschließen oder abbrechen.':exporting?'Die Exportdatei wird vorbereitet.':index>0?commonReason():'';
 availability('step-next',reason);availability('step-back',abort||exporting?'Während des Ladens oder Exports ist der Moduswechsel gesperrt.':'');
 $('step-hint').textContent=reason||(index===0?'Die Auswahl lässt sich über Maße, Ecken und Verschieben ändern.':index===3?'Du prüfst das Ergebnis vor dem Druck.':settings.mode==='poster'?'Änderungen erscheinen direkt in der Postervorschau.':'Änderungen werden im 3D-Modell neu berechnet.');
}
function showChoice(){
 if(abort||exporting){explain('Bitte den laufenden Abruf oder Export zuerst beenden.');return;}
 started=false;$('welcome').hidden=false;document.querySelector('.workspace').hidden=true;document.body.dataset.mode='choose';
 for(const id of ['switch-mode','export-top','save-project'])$(id).hidden=true;
 document.querySelector('.welcome-note').textContent=data?'Deine geladenen Kartendaten und Einstellungen bleiben beim Moduswechsel erhalten.':'Deine Projekte bleiben bei dir. Kein Kundenkonto nötig.';
 window.scrollTo({top:0});
}
function chooseMode(mode){
 if(!['poster','model'].includes(mode))return;
 const previous=settings.mode;
 if(mode==='poster'&&!data&&previous!=='poster'){settings.contours=false;settings.hillshade=false;}
 if(mode==='model'&&previous!=='model')mesh=null;settings.mode=mode;started=true;document.querySelector('.main').prepend($('notice'));document.body.dataset.mode=mode;$('welcome').hidden=true;document.querySelector('.workspace').hidden=false;
 for(const id of ['switch-mode','export-top','save-project'])$(id).hidden=false;
 $('workflow-kind').textContent=mode==='poster'?'POSTER-ATELIER · PDF / PNG / JPEG':'3D-WERKSTATT · STL / 3MF';
 $('workflow-title').textContent=mode==='poster'?'Dein Kartenposter.':'Dein Stadtrelief.';
 $('workflow-subtitle').textContent=mode==='poster'?'Von deinem Ort zum fertigen Druckoriginal.':'Von echten Höhendaten zum druckbaren Modell.';
 map.limitMode=mode;
 $('load-info-title').textContent=mode==='poster'?'Deine Karte. Ohne unnötige 3D-Schritte.':'Echte Höhen statt künstlicher Hügel.';
 $('load-info-text').textContent=mode==='poster'?'Straßen, Gewässer und Gebäude aus OpenStreetMap. Gelände wird nur für optionale Höhenlinien oder Höhenfärbung geladen.':'OSM liefert Grundrisse und Straßen. Gelände kommt separat aus echten Höhenrastern. Fehlende Daten werden nicht erfunden.';
 $('export-top').textContent=mode==='poster'?'Poster exportieren ↗':'3D exportieren ↗';
 $('panel-export').querySelector('h2').textContent=mode==='poster'?'Bereit für deine Wand.':'Bereit für deinen Drucker.';
 $('metric-b-label').textContent=mode==='poster'?'POSTERFORMAT':'MODELLGRÖẞE INKL. RAHMEN';
 controls();persist();panel(!data||needsTerrain()||stale()?'place':mode==='poster'?'style':'model');
 if(data&&mode==='model'&&!needsTerrain()&&!mesh&&!building)build();
 if(needsTerrain())explain(commonReason());
 window.scrollTo({top:0});
}
// ARIA-disabled buttons remain discoverable. A click explains the reason instead of doing nothing.
document.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.dataset.blocked){event.preventDefault();event.stopImmediatePropagation();explain(button.dataset.blocked);}},true);
function view(name){if(started&&((settings.mode==='poster'&&name==='model')||(settings.mode==='model'&&(name==='poster'||name==='design'))))name=settings.mode==='poster'?'poster':'model';currentView=name;all('[data-view]').forEach(b=>{const yes=b.dataset.view===name;b.classList.toggle('active',yes);b.setAttribute('aria-selected',yes);});all('.view').forEach(p=>{p.hidden=p.id!=='view-'+name;p.classList.toggle('active',!p.hidden);});$('stage-eyebrow').textContent={area:'DEIN AUSSCHNITT',design:'KARTENSTIL · GROSSE VORSCHAU',model:'ECHTES GELÄNDE · DEIN RELIEF',poster:'DEIN DRUCKORIGINAL'}[name];requestAnimationFrame(()=>{map.draw();if(name==='model'){ensureViewer();viewer?.render();}if(name==='poster'||name==='design')preview();});}
function ensureViewer(){if(viewer||!mesh)return;try{viewer=new R.ModelViewer($('model-canvas'));viewer.setMesh(mesh,settings);}catch(e){notify(e.message,'error');$('model-empty').hidden=false;$('model-empty').replaceChildren(Object.assign(document.createElement('p'),{textContent:e.message}));}}
function stale(){if(!data)return false;return data.bounds.some((v,i)=>Math.abs(v-bounds[i])>0.00001);}
function labels(){
 all('[data-output]').forEach(e=>{const k=e.dataset.output;e.textContent=['terrainFactor','buildingFactor','landmarkFactor','landmarkWidth','headline','subtitleScale','captionScale','mapScale'].includes(k)?number(settings[k]*100,0)+' %':number(settings[k],2)+(k==='tracking'?' em':k==='band'?' %':k==='margin'?' mm':['frame','waterDepth','roadRelief'].includes(k)?' mm':' ×');});
 $('stage-title').textContent=settings.title||'Dein Ort';$('project-state').textContent=data?(stale()?'Ausschnitt verändert — neu laden':settings.title+' · Projekt geladen'):'Neues Projekt';
 $('area-value').textContent=number(settings.widthKm*settings.heightKm,2)+' km²';$('area-hint').textContent=stale()?'Vorschau und Export verwenden noch den zuvor geladenen Ausschnitt.':settings.widthKm*settings.heightKm>40?'Großer Ausschnitt: der externe Kartendienst kann langsam sein oder die Datenmenge begrenzen. PDF für großformatige Poster empfehlen.':'Kleine Ausschnitte zeigen auf derselben Druckfläche mehr Details.';
 const info=data?R.boundsInfo(data.bounds):R.boundsInfo(bounds),w=settings.modelWidth+settings.frame*2,h=settings.modelWidth*info.h/info.w+settings.frame*2;
 $('metric-a').textContent=number(info.w/1000,2)+' × '+number(info.h/1000,2)+' km';$('metric-b').textContent=number(w,1)+' × '+number(h,1)+(mesh?' × '+number(mesh.zmax,1):'')+' mm';
 $('metric-c').textContent=data?(data.realData===true?'Originaldaten':'Importierte Daten')+' · '+number(data.buildings.length,0)+' Gebäude':'Noch nicht geladen';
 $('poster-dim').textContent=number(settings.paperW/10,1)+' × '+number(settings.paperH/10,1)+' cm';
 const plan=R.rasterPlan(settings),estimate=$('export-estimate');estimate.replaceChildren();const strong=document.createElement('strong');strong.textContent=settings.format==='pdf'?'Vektor-PDF · unabhängig von Pixeln':`${number(plan.width,0)} × ${number(plan.height,0)} Pixel`;const small=document.createElement('small');small.textContent=settings.format==='pdf'?'Echte Linien, Flächen und Text. Papiermaß wird im PDF gespeichert.':`${Math.round(plan.dpi)} dpi tatsächlich bei ${number(settings.paperW/10)} × ${number(settings.paperH/10)} cm${plan.reduced?' · Speicherlimit berücksichtigt':''}. Endgröße wird geprüft.`;estimate.append(strong,small);
 all('[data-format]').forEach(e=>e.classList.toggle('selected',e.dataset.format===settings.format));all('[data-theme]').forEach(e=>e.classList.toggle('selected',e.dataset.theme===settings.style));
 $('portrait').classList.toggle('selected',settings.paperW<=settings.paperH);$('landscape').classList.toggle('selected',settings.paperW>settings.paperH);
 const common=commonReason(),model=modelReason();
 for(const id of ['save-project','export-poster','export-sources'])availability(id,common);
 for(const id of ['export-stl','export-3mf'])availability(id,model);
 for(const id of ['new-project','open-project','switch-mode','export-top'])availability(id,abort||exporting?'Während eines Abrufs oder Exports ist diese Aktion gesperrt. Bitte abschließen oder abbrechen.':'');
 let loadReason='';try{R.validateBounds(bounds,settings.mode);}catch(e){loadReason=e.message;}
 availability('load-data',abort?'Die Karte wird gerade geladen.':exporting?'Ein Export läuft gerade.':loadReason);
 $('load-reason').textContent=loadReason;
 $('poster-export-reason').textContent=common||'Bereit: Format und Auflösung werden vor dem Download geprüft.';
 $('model-export-reason').textContent=model||'Bereit: Modellmaße werden in Millimetern exportiert.';
 $('load-data').textContent=needsTerrain()?'Geländedaten nachladen →':data?'Ausschnitt neu laden →':'Karte laden →';
 if(settings.mode==='poster')$('metric-b').textContent=number(settings.paperW/10)+' × '+number(settings.paperH/10)+' cm';
 $('crop-hint').textContent=settings.mapFit==='cover'?'Die Kartenfläche wird vollständig gefüllt. Dabei können Ränder und Wahrzeichen abgeschnitten werden – Vorschau prüfen.':'Der gesamte geografische Ausschnitt bleibt sichtbar; freie Ränder sind möglich.';
 $('layout-note').textContent=settings.layout==='map'?'„Nur Karte“ blendet Titel, Unterzeile und Koordinaten aus. Deine Texte bleiben für andere Layouts gespeichert.':'Format, Weißraum und Kartengröße stellst du jetzt direkt hier ein. Alle Änderungen erscheinen in der Vorschau.';
 $('custom-coordinate-field').hidden=settings.coordinateStyle!=='custom';
 document.querySelector('.panels').inert=!!abort||exporting;
 updateStepUI();

}
function controls(){all('[data-setting]').forEach(e=>{const v=settings[e.dataset.setting];if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);});labels();}
function updateBounds(fit=false){bounds=R.boundsFor(settings.lon,settings.lat,settings.widthKm,settings.heightKm);map.setBounds(bounds,fit);labels();persist();}
const map=new R.AreaMap($('map-canvas'),b=>{bounds=b;const i=R.boundsInfo(b);settings.lon=+i.lon.toFixed(6);settings.lat=+i.lat.toFixed(6);settings.widthKm=+(i.w/1000).toFixed(3);settings.heightKm=+(i.h/1000).toFixed(3);controls();persist();map.drawMode=false;$('draw-area').classList.remove('selected');if(settings.autoSubtitle)resolveRegion();});map.limitMode=settings.mode;map.onError=e=>notify(e.message||String(e),'error');
function quality(){
 const target=$('quality-content');target.replaceChildren();if(!data){target.textContent='Die Datenqualität wird nach dem Laden angezeigt.';return;}
 const measured=data.buildings.filter(b=>b.heightSource==='OSM-Höhe').length,levels=data.buildings.filter(b=>b.heightSource==='Geschosse × 3 m').length,heights=data.terrain.values;let low=Infinity,high=-Infinity;for(const v of heights){low=Math.min(low,v);high=Math.max(high,v);}
 const values=[['Gebäudehöhen',`${measured} explizit · ${levels} aus Geschossen · ${data.buildings.length-measured-levels} Standardwerte`],['Gelände',data.terrain.available===false?'Nicht geladen – für ein reines 2D-Poster nicht erforderlich':`${number(low,0)} bis ${number(high,0)} m · Ausgabe-Abtastung ca. ${number(data.terrain.spacing||0,0)} m; Quelldaten können gröber sein`],['Druckgeometrie',settings.mode==='poster'?'Für Poster nicht benötigt':mesh?`${number(mesh.indices.length/3,0)} Dreiecke · ${number(mesh.cell,2)} mm Raster · ${mesh.missed} Gebäude zu klein für dieses Raster`:'Wird berechnet'],['Datenstand',data.osmTimestamp||data.capturedAt||'Vom Import nicht angegeben'],['Quellen',data.source||'Quelle im Import nicht angegeben']];
 for(const [label,value] of values){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(value));target.append(p);}
 for(const warning of data.warnings||[]){const p=document.createElement('p');p.className='warning';p.textContent=warning;target.append(p);}
 const note=document.createElement('p');note.textContent='Geschlossene Rasteroberfläche: feine Grundrisse werden angenähert. Keine originalgetreuen Dächer, Fassaden oder Burgtürme ohne passende Ausgangsdaten. Modell immer im Slicer prüfen.';target.append(note);
}
function landmarkControls(){
 const box=$('landmark-list');box.replaceChildren();if(!data)return;
 const list=data.buildings.filter(b=>b.landmark||b.name).sort((a,b)=>Number(!!b.landmark)-Number(!!a.landmark)).slice(0,35);
 for(const b of list){const row=document.createElement('div');row.className='landmark-row';const label=document.createElement('label');label.className='check';const check=document.createElement('input');check.type='checkbox';check.checked=settings.landmarkOverrides[b.id]?.enabled??!!b.landmark;const span=document.createElement('span');span.textContent=b.name||'Wahrzeichen '+b.id;label.append(check,span);const hint=document.createElement('small');hint.textContent=`${b.heightSource} · ${number(b.height)} m`;
 check.addEventListener('change',()=>{settings.landmarkOverrides[b.id]={...settings.landmarkOverrides[b.id],enabled:check.checked};persist();scheduleBuild();preview();});const height=document.createElement('input');height.type='number';height.min='1';height.max='1000';height.step='1';height.value=String(settings.landmarkOverrides[b.id]?.height??b.height);height.setAttribute('aria-label',(b.name||b.id)+' manuelle Höhe in Metern');height.title='Manuelle Gebäudehöhe in Metern (kein Vermessungswert)';height.addEventListener('change',()=>{const h=Number(height.value);if(!Number.isFinite(h)||h<1||h>1000){notify('Gebäudehöhe muss zwischen 1 und 1000 m liegen.','error');return;}settings.landmarkOverrides[b.id]={...settings.landmarkOverrides[b.id],height:h};hint.textContent='Manuell eingestellt · '+number(h)+' m';persist();scheduleBuild();});row.append(label,hint,height);box.append(row);}
 for(const l of data.landmarks.filter(l=>!data.buildings.some(b=>b.id===l.id||b.name===l.name)).slice(0,8)){const p=document.createElement('p');p.className='hint';p.textContent=l.name+' — nur Standort erfasst, keine zugeordnete Gebäudegeometrie.';box.append(p);}
 if(!box.children.length){const p=document.createElement('p');p.className='hint';p.textContent='Keine benannten Gebäude oder Wahrzeichen im Datensatz. Nichts wurde künstlich hinzugefügt.';box.append(p);}
}
function markerControls(){
 const box=$('marker-list');if(!box)return;box.replaceChildren();
 const counter=$('marker-count');
 if(!data){if(counter)counter.textContent='Lade zuerst Kartendaten.';return;}
 const allMarkers=data.landmarks||[];
 const list=allMarkers.filter(item=>
  (markerFilter==='all'||item.category===markerFilter)&&
  (!markerQuery||item.name.toLocaleLowerCase('de').includes(markerQuery))
 ).slice().sort((a,b)=>Number(!!settings.landmarkOverrides?.[b.id]?.featured)-Number(!!settings.landmarkOverrides?.[a.id]?.featured)||(b.priority||0)-(a.priority||0)||String(a.name).localeCompare(String(b.name),'de'));
 if(counter)counter.textContent=allMarkers.length+' Orte gefunden · '+list.length+' in dieser Ansicht. Maximal '+settings.markerLimit+' werden gleichzeitig beschriftet; Platz und Überlappungen entscheiden mit.';
 if(!list.length){const msg=document.createElement('p');msg.className='hint';msg.textContent='Keine passenden Marker. Suche oder Filter ändern.';box.append(msg);return;}
 for(const item of list.slice(0,250)){
  const row=document.createElement('div');row.className='landmark-row marker-row';
  const label=document.createElement('label');label.className='check';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=settings.landmarkOverrides[item.id]?.label!==false;
  checkbox.title='Auf dem Poster anzeigen';const span=document.createElement('span');span.textContent=item.name||item.id;
  label.append(checkbox,span);checkbox.addEventListener('change',()=>{settings.landmarkOverrides[item.id]={...settings.landmarkOverrides[item.id],label:checkbox.checked};persist();schedulePreview();markerControls();});
  const right=document.createElement('div');right.className='marker-tools';
  const star=document.createElement('button');star.type='button';star.className='marker-star';star.textContent=settings.landmarkOverrides?.[item.id]?.featured?'★':'☆';star.title='Dieser Ort erhält Vorrang bei der Beschriftung';
  star.setAttribute('aria-label',item.name+' bevorzugt anzeigen');star.onclick=()=>{settings.landmarkOverrides[item.id]={...settings.landmarkOverrides[item.id],featured:!settings.landmarkOverrides?.[item.id]?.featured,label:true};persist();schedulePreview();markerControls();};
  const source=document.createElement('small');source.textContent=item.source==='manual'?'Eigener Marker':({historic:'Historisch',museum:'Museum',worship:'Kirche',art:'Kunst',viewpoint:'Aussicht',other:'Sehenswürdigkeit'})[item.category]||'Sehenswürdigkeit';
  right.append(source,star);row.append(label,right);box.append(row);
 }
 if(list.length>250){const note=document.createElement('p');note.className='hint';note.textContent='250 Einträge sichtbar. Bitte Suche oder Kategorie nutzen, um weitere Orte zu finden.';box.append(note);}
}
function makeWorker(){try{const url=globalThis.RS_WORKER_SOURCE?URL.createObjectURL(new Blob([globalThis.RS_WORKER_SOURCE],{type:'application/javascript'})):'worker.js';worker=new Worker(url);if(globalThis.RS_WORKER_SOURCE)URL.revokeObjectURL(url);worker.onmessage=e=>{const {id,result,error}=e.data;const pending=modelResolvers.get(id);modelResolvers.delete(id);if(error)pending?.reject(Error(error));else pending?.resolve(result);};worker.onerror=()=>{for(const p of modelResolvers.values())p.reject(Error('Modellberechnung wurde unterbrochen. Bitte Raster reduzieren.'));modelResolvers.clear();worker?.terminate();worker=null;};}catch{worker=null;}}
makeWorker();
async function build(){
 if(!data||settings.mode!=='model'||data.terrain.available===false)return;const id=++buildId;building=true;mesh=null;labels();const inputSettings=R.cleanSettings(settings),source=data;
 try{let result;if(worker){result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(!modelResolvers.has(id))return;worker?.terminate();worker=null;for(const p of modelResolvers.values())p.reject(Error('Modellberechnung dauerte zu lange. Bitte ein kleineres Modellraster wählen und erneut berechnen.'));modelResolvers.clear();},45000);modelResolvers.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});worker.postMessage({id,data:source,settings:inputSettings});});}else{await nextFrame();result=R.buildMesh(source,inputSettings);}
 if(id!==buildId||source!==data)return;mesh=result;ensureViewer();viewer?.setMesh(mesh,settings);$('model-empty').hidden=!!viewer;quality();
 }catch(e){if(id===buildId)notify(e.message,'error');}finally{if(id===buildId){building=false;labels();}}
}
function scheduleBuild(){if(settings.mode!=='model'||!data)return;clearTimeout(buildTimer);buildId++;building=true;mesh=null;labels();buildTimer=setTimeout(build,220);}
function preview(){
 if(!data){$('poster-paper').hidden=true;return;}if(currentView==='design'){previewDesign();return;}if(currentView!=='poster')return;$('poster-empty').hidden=true;$('poster-paper').hidden=false;
 try{
  const scene=R.posterScene(data,settings,{preview:true,previewPixels:1000}),canvas=$('poster-canvas'),paper=$('poster-paper'),view=$('view-poster');
  // The former A4-only CSS aspect-ratio made a 60×80 poster's backing sheet
  // taller than its drawing surface. Size BOTH elements from the actual paper
  // dimensions; otherwise a white strip remains below / to the right.
  const cs=getComputedStyle(view),padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight),padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  const maxW=Math.max(1,view.clientWidth-padX-2),maxH=Math.max(1,view.clientHeight-padY-2);
  const factor=Math.min(maxW/settings.paperW,maxH/settings.paperH),w=settings.paperW*factor,h=settings.paperH*factor,dpr=Math.min(devicePixelRatio||1,2);
  paper.style.aspectRatio=settings.paperW+' / '+settings.paperH;
  paper.style.width=w+'px';paper.style.height=h+'px';
  canvas.style.width='100%';canvas.style.height='100%';
  canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
  R.paintScene(canvas.getContext('2d'),scene,canvas.width/settings.paperW);
  $('poster-dim').title=scene.previewOmitted?'Die Vorschau wurde für flüssige Bearbeitung vereinfacht. Der Export enthält alle Kartenelemente.':'';
 }catch(e){notify('Postervorschau: '+e.message,'error');}
}
function previewDesign(){
 if(!data)return;try{
  const target=$('view-design'),canvas=$('design-canvas'),info=R.boundsInfo(data.bounds),aspect=info.h/info.w;
  const physicalW=Math.min(700,1500/Math.max(.01,aspect)),physicalH=physicalW*aspect;
  const scene=R.posterScene(data,{...settings,layout:'map',mapFit:'contain',margin:0,paperW:physicalW,paperH:physicalH},{designPreview:true,preview:true,previewPixels:1400});
  const factor=Math.min(Math.max(100,target.clientWidth-32)/physicalW,Math.max(100,target.clientHeight-40)/physicalH),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(physicalW*factor*dpr));canvas.height=Math.max(1,Math.round(physicalH*factor*dpr));
  canvas.style.width=(physicalW*factor)+'px';canvas.style.height=(physicalH*factor)+'px';
  R.paintScene(canvas.getContext('2d'),scene,canvas.width/physicalW);const tip=target.querySelector('.design-tip');if(tip)tip.textContent=scene.previewOmitted?`Kartenstil in groß · ${scene.previewOmitted.toLocaleString('de-DE')} sehr kleine Elemente in der Vorschau vereinfacht · Export vollständig`:'Kartenstil in groß · Das vollständige Drucklayout folgt im nächsten Schritt';
 }catch(e){notify('Kartenstil-Vorschau: '+e.message,'error');}
}
let previewTimer;const schedulePreview=()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>{if(currentView==='poster'||currentView==='design')preview();},120);};new ResizeObserver(schedulePreview).observe($('view-poster'));new ResizeObserver(schedulePreview).observe($('view-design'));
const loadStepLabels={base:'Gebäude, Straßen & Wasser',pois:'Historische Orte',terrain:'Echte Geländehöhen',process:'Karte aufbereiten'};
let activeLoadStages=[],loadStates={},loadStartedAt=0,lastBytesAt=0,loadClock=null;
function clockString(ms){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function resetLoader(terrain){
 activeLoadStages=['base','pois',...(terrain?['terrain']:[]),'process'];loadStates=Object.fromEntries(activeLoadStages.map(k=>[k,'pending']));
 loadStartedAt=lastBytesAt=Date.now();clearInterval(loadClock);$('progress').removeAttribute('value');$('loader-percent').textContent='Messung läuft …';$('loader-text').textContent='Die Daten werden Schritt für Schritt geladen.';
 $('loader-detail').textContent='OpenStreetMap berechnet die Anfrage. Bisher noch keine Daten empfangen.';
 const list=$('loader-phases');list.replaceChildren();for(const [i,key] of activeLoadStages.entries()){
  const row=document.createElement('div');row.className='loader-phase';row.dataset.phase=key;const marker=document.createElement('span');marker.className='phase-icon';marker.textContent=String(i+1);const title=document.createElement('span');title.textContent=loadStepLabels[key];row.append(marker,title);list.append(row);
 }
 const tick=()=>{const elapsed=Date.now()-loadStartedAt,idle=Date.now()-lastBytesAt;$('loader-elapsed').textContent=clockString(elapsed);$('loader-idle').textContent=idle>=15000?'Seit '+Math.floor(idle/1000)+' s keine neuen Daten übertragen. Der Abruf endet bei anhaltendem Stillstand.':'Nur echte empfangene Daten und abgeschlossene Schritte zählen als Fortschritt.';};
 tick();loadClock=setInterval(tick,1000);refreshLoadSteps();
}
function refreshLoadSteps(){let done=0;for(const k of activeLoadStages){const st=loadStates[k];const el=document.querySelector('.loader-phase[data-phase="'+k+'"]');if(!el)continue;el.className='loader-phase '+(st==='done'?'complete':st==='skipped'?'skipped':st==='pending'?'':'active');el.querySelector('.phase-icon').textContent=st==='done'?'✓':st==='skipped'?'–':String(activeLoadStages.indexOf(k)+1);if(st==='done'||st==='skipped')done++;}
 $('loader-overall').textContent=`${done} von ${activeLoadStages.length} Schritten abgeschlossen`;
}
function progress(event,value){
 if(typeof event==='string'){$('loader-text').textContent=event;$('loader-detail').textContent=event;if(Number.isFinite(value)){$('progress').value=Math.max(0,Math.min(1,value));$('loader-percent').textContent=Math.round(value*100)+' % · Verarbeitung';}else{$('progress').removeAttribute('value');$('loader-percent').textContent='Verarbeitung';}return;}
 if(!event||typeof event!=='object')return;
 const {phase,status,detail,received,total,done,total:tilesTotal,count}=event;
 if(phase==='cache'){
  for(const key of activeLoadStages)loadStates[key]='done';refreshLoadSteps();$('loader-percent').textContent='Aus Cache';$('progress').value=1;$('loader-detail').textContent=detail||'Lokal gespeichert';return;
 }
 if(phase&&phase in loadStates){loadStates[phase]=status==='done'?'done':status==='skipped'?'skipped':status||'waiting';refreshLoadSteps();}
 if(detail)$('loader-detail').textContent=detail;
 if(phase&&loadStepLabels[phase])$('loader-stage').textContent=loadStepLabels[phase];
 if(phase==='base'||phase==='pois'){
  if(status==='bytes'&&received>0){lastBytesAt=Date.now();$('loader-detail').textContent='Der Server liefert Kartendaten. Die Übertragung läuft.';const mb=n=>(n/1024/1024).toLocaleString('de-DE',{maximumFractionDigits:2});$('loader-percent').textContent=total>0?Math.min(100,Math.round(received/total*100))+' % Datenübertragung':'Datenübertragung';$('loader-text').textContent=mb(received)+' MB empfangen'+(total?' / '+mb(total)+' MB':' (Gesamtgröße unbekannt)');if(total>0)$('progress').value=Math.min(1,received/total);else $('progress').removeAttribute('value');}
  else if(status==='waiting'||status==='retry'){$('progress').removeAttribute('value');$('loader-percent').textContent='Warten · keine Prozentangabe';$('loader-text').textContent='Warte auf Antwort des OpenStreetMap-Dienstes';}
  else if(status==='headers'){$('progress').removeAttribute('value');$('loader-percent').textContent='Antwort eingetroffen';}
  else if(status==='parsing'){$('loader-percent').textContent='Daten werden geprüft';$('progress').removeAttribute('value');}
  else if(status==='done'){$('loader-percent').textContent=(count||0).toLocaleString('de-DE')+' Objekte';$('progress').value=1;}
  else if(status==='skipped'){$('loader-percent').textContent='Teilweise geladen';$('progress').removeAttribute('value');}
 }else if(phase==='terrain'&&status==='tiles'){
  if(done>0)lastBytesAt=Date.now();$('loader-percent').textContent=done+' / '+tilesTotal+' Kacheln';$('loader-text').textContent='Höhenraster wird empfangen';$('progress').value=tilesTotal?done/tilesTotal:0;
 }else if(phase==='process'){$('loader-percent').textContent=status==='done'?'Verarbeitung abgeschlossen':'Verarbeitung läuft';$('progress').removeAttribute('value');}
}

async function load(){
 if(abort||exporting)return;try{R.validateBounds(bounds,settings.mode);}catch(e){notify(e.message,'error');return;}
 const controller=new AbortController(),epoch=++loadEpoch;abort=controller;
 $('loader').hidden=false;$('loader-title').textContent=settings.mode==='poster'?'Deine Posterkarte entsteht.':'Dein Stadtrelief entsteht.';$('cancel-load').hidden=false;resetLoader(settings.mode==='model'||settings.contours||settings.hillshade);labels();const selected=bounds.slice();
 try{
  const loaded=await R.loadMap(selected,{signal:controller.signal,onProgress:progress,refresh:$('force-refresh').checked,mode:settings.mode,terrainRequired:settings.mode==='model'||settings.contours||settings.hillshade});
  if(controller.signal.aborted||epoch!==loadEpoch)return;
  const custom=(data?.landmarks||[]).filter(x=>x.source==='manual');
  if(data&&custom.length&&data.bounds.every((v,i)=>Math.abs(v-selected[i])<1e-5))loaded.landmarks.push(...custom);
  data=loaded;mesh=null;settings.landmarkOverrides={};landmarkControls();markerControls();
  if(settings.autoSubtitle)resolveRegion();
  if(settings.mode==='model'){progress('Geschlossenes Relief wird berechnet',.92);await build();if(!mesh){panel('model');quality();return;}}
  panel(settings.mode==='poster'?'style':'model');quality();preview();
  const coastWarnings=(data.warnings||[]).filter(w=>/Küste|Küsten|Meer|Meeresfläche/.test(w));
  const historicWarnings=(data.warnings||[]).filter(w=>/historische Orte|Sehenswürdigkeiten/i.test(w));
  notify(`${number(data.buildings.length,0)} Gebäude und ${number(data.roads.length,0)} Straßen-/Wasserlinien geladen.${data.terrain.available===false?' Für dieses 2D-Poster wurde kein Gelände benötigt.':' Echtes Gelände ist enthalten.'} ${coastWarnings.length?coastWarnings.slice(0,2).join(' '):historicWarnings.length?historicWarnings[0]:'Projekt über „Speichern“ sichern.'}`,coastWarnings.length||historicWarnings.length?'warning':'success');
 }catch(e){controller.abort();if(e.name==='AbortError')notify('Laden abgebrochen. Deine vorherigen Kartendaten bleiben erhalten.','info');else notify('Karte konnte nicht geladen werden: '+e.message+' Bitte erneut versuchen, einen kleineren Ausschnitt wählen oder eine gespeicherte Projektdatei öffnen.','error',{label:'Erneut versuchen',run:load});}
 finally{if(epoch===loadEpoch){abort=null;clearInterval(loadClock);loadClock=null;$('loader').hidden=true;labels();}}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),45000);}
function slug(){return (settings.title||'karte').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'karte';}
async function prepareExport(){
 const blocked=commonReason();if(blocked){explain(blocked);return;}exporting=true;labels();$('loader').hidden=false;$('loader-title').textContent='Druckdatei wird vorbereitet.';$('cancel-load').hidden=true;$('loader-phases').replaceChildren();$('loader-idle').textContent='Der Export wird lokal berechnet.';$('loader-overall').textContent='Exportvorgang';$('loader-elapsed').textContent='';availability('export-poster','Die Druckdatei wird vorbereitet.');await nextFrame();
 try{const result=await R.exportPoster(data,settings,progress);const name=`${slug()}-${settings.paperW}x${settings.paperH}mm${result.dpi?'-'+Math.round(result.dpi)+'dpi':''}.${result.extension}`;pendingExport={...result,name};$('export-result').textContent=result.summary;$('export-filename').textContent=name;$('export-details').textContent=`${number(result.blob.size,0)} von 8.000.000 Byte · ${result.vector?'RGB · Vektor':'RGB · Rasterbild'}`;$('file-icon').textContent=result.extension.toUpperCase();$('export-warnings').replaceChildren();
 const warnings=[...result.warnings];if(stale())warnings.push('Der geänderte Ausschnitt wurde noch nicht geladen. Diese Datei verwendet die zuletzt geladenen Kartendaten.');for(const text of warnings){const p=document.createElement('p');p.className='warning';p.textContent=text;$('export-warnings').append(p);}$('export-dialog').showModal();}
 catch(e){notify(e.message,'error');}finally{exporting=false;$('loader').hidden=true;labels();}
}
function sources(){return `RELIEF STUDIO 10\n${settings.title}\n\nAusschnitt (West, Süd, Ost, Nord): ${data.bounds.join(', ')}\nAbgerufen: ${data.capturedAt||'nicht angegeben'}\nOSM-Stand: ${data.osmTimestamp||'nicht angegeben'}\n\nKartendaten © OpenStreetMap-Mitwirkende — ODbL 1.0\nhttps://www.openstreetmap.org/copyright\n\nGelände: ${data.terrain.source||'Import'}\nQuellen/Lizenzen: https://github.com/tilezen/joerd/blob/master/docs/attribution.md\n\nGebäudehöhen: ausdrückliche OSM-Höhe, Geschosszahl × 3 m oder gekennzeichneter Standardwert.\nGeländeüberhöhung: ${settings.terrainFactor*100} %\nGebäudeüberhöhung: ${settings.buildingFactor*100} %\nZusätzliche Wahrzeichenüberhöhung: ${settings.landmarkFactor*100} %\n\nVereinfachtes Rasterrelief, kein vermessenes Architekturmodell. Farben nur Vorschau.\nQuellenhinweise bei Weitergabe und Verkauf berücksichtigen; diese Datei ist keine Rechtsberatung.\n`;}
async function modelExport(type){const blocked=modelReason();if(blocked){explain(blocked);return;}exporting=true;labels();notify('3D-Datei wird zusammengestellt.');await nextFrame();try{const blob=type==='stl'?new Blob([R.stl(mesh)],{type:'model/stl'}):R.model3mf(mesh,settings.title);download(blob,slug()+'.'+type);download(new Blob([sources()],{type:'text/plain;charset=utf-8'}),slug()+'-quellen.txt');notify(`${type.toUpperCase()} exportiert · ${number(blob.size/1e6,1)} MB · Maße in mm. Bitte Slicer prüfen.`);}catch(e){notify(e.message,'error');}finally{exporting=false;labels();}}
for(const [key,size] of Object.entries(R.paperSizes)){const opt=document.createElement('option');opt.value=key;opt.textContent=key==='custom'?'Eigene Maße':key+(key.startsWith('A')?` · ${size[0]} × ${size[1]} mm`:'');$('paper').append(opt);}
for(const [key,p] of Object.entries(R.palettes)){const button=document.createElement('button');button.type='button';button.dataset.theme=key;const swatch=document.createElement('span');swatch.style.background=`linear-gradient(130deg,${p.paper} 0 46%,${p.major} 47% 53%,${p.water} 54%)`;const label=document.createElement('small');label.textContent=p.name;button.append(swatch,label);button.addEventListener('click',()=>{settings.style=key;controls();persist();preview();if(mesh)viewer?.setMesh(mesh,settings);});$('themes').append(button);}
all('[data-setting]').forEach(el=>el.addEventListener(el.type==='range'||el.type==='text'?'input':'change',()=>{
 const k=el.dataset.setting,value=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'||typeof R.defaults[k]==='number'?Number(el.value):el.value;if(typeof value==='number'&&!Number.isFinite(value))return;
 if(el.type==='number'&&!el.validity.valid){notify(`Bitte für „${el.closest('label')?.childNodes[0]?.textContent?.trim()||k}“ einen gültigen Wert zwischen ${el.min} und ${el.max} eingeben.`,'warning');el.value=settings[k];return;}settings=R.cleanSettings({...settings,[k]:value});
 if(k==='paper'&&value!=='custom'){[settings.paperW,settings.paperH]=R.paperSizes[value].slice();if(settings.orientation==='landscape')[settings.paperW,settings.paperH]=[settings.paperH,settings.paperW];}
 if(k==='paperW'||k==='paperH')settings.paper='custom';
 if(k==='subtitle'){settings.autoSubtitle=false;document.querySelector('[data-setting=autoSubtitle]').checked=false;$('region-status').textContent='Manuell eingetragen. Automatik über die Checkbox wieder einschalten.';}
 if(k==='autoSubtitle'&&settings.autoSubtitle){settings.subtitle=R.subtitleForLocation(settings.region,settings.countryCode,settings.countryName);resolveRegion();}

 if(['lat','lon','widthKm','heightKm'].includes(k)){updateBounds();if(['lat','lon'].includes(k)&&settings.autoSubtitle)resolveRegion();}else{persist();if(['modelWidth','base','terrainFactor','buildingFactor','landmarkFactor','landmarkWidth','frame','waterDepth','resolution','major','secondary','local','paths','roadRelief'].includes(k))scheduleBuild();schedulePreview();}
 if(el.type!=='text')controls();else labels();if(k==='showAttribution'){clearTimeout(previewTimer);if(currentView==='poster')preview();if(!settings.showAttribution)notify('OpenStreetMap-Quellenzeile ist nur für deinen privaten Entwurf ausgeblendet. Beim Teilen oder Drucken für andere muss die Quellenangabe wieder sichtbar sein.','warning');}if(['contours','hillshade'].includes(k)&&needsTerrain())explain(commonReason());
}));
all('[data-step]').forEach(b=>b.addEventListener('click',()=>{panel(flow()[Number(b.dataset.step)]);if(currentPanel!=='place'&&commonReason())explain(commonReason());}));all('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));all('[data-format]').forEach(b=>b.addEventListener('click',()=>{settings.format=b.dataset.format;controls();persist();}));
all('[data-city]').forEach(b=>b.addEventListener('click',()=>{
 const place=cities[b.dataset.city];settings={...settings,...place,autoSubtitle:true};
 settings.subtitle=R.subtitleForLocation(place.region,place.countryCode,place.countryName);locationEpoch++;
 controls();updateBounds(true);view('area');$('region-status').textContent='Automatisch: '+settings.subtitle;
}));all('[data-ratio]').forEach(b=>b.addEventListener('click',()=>{settings.heightKm=R.clamp(settings.widthKm/Number(b.dataset.ratio),.1,24);controls();updateBounds();}));
$('draw-area').onclick=()=>{view('area');map.drawMode=!map.drawMode;$('draw-area').classList.toggle('selected',map.drawMode);notify(map.drawMode?'Zwei gegenüberliegende Ecken durch Ziehen festlegen.':'Zeichnen beendet.');};$('fit-area').onclick=()=>map.fit();$('map-plus').onclick=()=>{map.zoom=R.clamp(map.zoom+1,3,19);map.draw();};$('map-minus').onclick=()=>{map.zoom=R.clamp(map.zoom-1,3,19);map.draw();};
$('load-data').onclick=$('empty-load').onclick=load;$('cancel-load').onclick=()=>abort?.abort();
$('search-form').onsubmit=async e=>{e.preventDefault();searchAbort?.abort();searchAbort=new AbortController();const result=$('search-results');result.textContent='Ort wird gesucht …';try{const places=await R.searchPlace($('search').value,searchAbort.signal);result.replaceChildren();if(!places.length)result.textContent='Kein Ort gefunden. Koordinaten können direkt eingetragen werden.';for(const p of places){const b=document.createElement('button');b.type='button';b.textContent=p.label;b.onclick=()=>{settings={...settings,lon:p.lon,lat:p.lat,title:p.name,region:p.region,countryCode:p.countryCode,countryName:p.country,autoSubtitle:true};
  settings.subtitle=R.subtitleForLocation(p.region,p.countryCode,p.country);controls();updateBounds(true);view('area');result.replaceChildren();resolveRegion();};result.append(b);}}catch(e){if(e.name!=='AbortError')result.textContent='Suche nicht verfügbar: '+e.message;}};
$('region-refresh').onclick=()=>{settings.autoSubtitle=true;controls();resolveRegion();};
$('marker-filter').onchange=e=>{markerFilter=e.target.value;markerControls();};
$('marker-search').oninput=e=>{markerQuery=e.target.value.toLocaleLowerCase('de').trim().slice(0,100);markerControls();};
$('marker-show-all').onclick=()=>{if(!data){notify('Bitte zuerst Kartendaten laden.','warning');return;}
 for(const item of data.landmarks)if(markerFilter==='all'||item.category===markerFilter)settings.landmarkOverrides[item.id]={...settings.landmarkOverrides[item.id],label:true};
 persist();markerControls();schedulePreview();};
$('marker-hide-all').onclick=()=>{if(!data){notify('Bitte zuerst Kartendaten laden.','warning');return;}
 for(const item of data.landmarks)if(markerFilter==='all'||item.category===markerFilter)settings.landmarkOverrides[item.id]={...settings.landmarkOverrides[item.id],label:false};
 persist();markerControls();schedulePreview();};
$('marker-add').onclick=()=>{
 if(!data){notify('Bitte zuerst eine Karte laden.','warning');return;}
 const name=$('marker-name').value.trim().slice(0,90),lon=$('marker-lon').value.trim()?Number($('marker-lon').value):NaN,lat=$('marker-lat').value.trim()?Number($('marker-lat').value):NaN;
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){notify('Für einen eigenen Marker Name, Breitengrad und Längengrad korrekt ausfüllen.','warning');return;}
 const point=R.normalized(data.bounds,[[lon,lat]])[0];
 if(point.some(v=>v<0||v>1)){notify('Der Marker liegt außerhalb des geladenen Kartenausschnitts. Karte verschieben und neu laden oder andere Koordinaten wählen.','warning');return;}
 if(data.landmarks.length>=550){notify('Die Grenze von 550 Orten ist erreicht. Bitte andere Marker entfernen oder kleineren Ausschnitt wählen.','warning');return;}
 const id='manual/'+Date.now()+'-'+data.landmarks.length;
 data.landmarks.push({id,name,point,category:'custom',priority:120,source:'manual'});
 settings.landmarkOverrides[id]={label:true,featured:true};
 $('marker-name').value='';$('marker-lon').value='';$('marker-lat').value='';markerFilter='all';$('marker-filter').value='all';markerQuery='';$('marker-search').value='';
 markerControls();persist();schedulePreview();notify('Eigener Marker hinzugefügt. Projekt speichern, damit er erhalten bleibt.','success');
};
$('marker-google').onclick=()=>{
 const query='historical sights near '+(settings.title||'this place')+' '+(settings.region||'')+' '+(settings.countryName||'');
 const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click();
};
$('portrait').onclick=()=>{[settings.paperW,settings.paperH]=[Math.min(settings.paperW,settings.paperH),Math.max(settings.paperW,settings.paperH)];settings.orientation='portrait';controls();persist();preview();};$('landscape').onclick=()=>{[settings.paperW,settings.paperH]=[Math.max(settings.paperW,settings.paperH),Math.min(settings.paperW,settings.paperH)];settings.orientation='landscape';controls();persist();preview();};
$('isometric').onclick=$('model-reset').onclick=()=>{viewer?.view('isometric');$('isometric').classList.add('selected');$('topview').classList.remove('selected');};$('topview').onclick=()=>{viewer?.view('top');$('topview').classList.add('selected');$('isometric').classList.remove('selected');};
$('model-preset').onclick=()=>{Object.assign(settings,{terrainFactor:2,buildingFactor:1.5,landmarkFactor:1.8,landmarkWidth:1,base:3,frame:4,waterDepth:.45});controls();persist();scheduleBuild();};
$('export-top').onclick=()=>{panel('export');if(commonReason())explain(commonReason());};$('export-poster').onclick=prepareExport;$('export-stl').onclick=()=>modelExport('stl');$('export-3mf').onclick=()=>modelExport('3mf');$('export-sources').onclick=()=>data&&download(new Blob([sources()],{type:'text/plain;charset=utf-8'}),slug()+'-quellen.txt');
$('download-ready').onclick=()=>{if(pendingExport){download(pendingExport.blob,pendingExport.name);$('export-dialog').close();}};$('close-export').onclick=()=>$('export-dialog').close();
$('save-project').onclick=()=>{if(!data)return;const { _contours,...saved}=data;download(new Blob([JSON.stringify({version:3,settings,data:saved})],{type:'application/json'}),slug()+'.relief.json');notify('Projekt inklusive Kartendaten gespeichert.');};
$('open-project').onclick=()=>$('project-file').click();$('project-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>35000000)throw Error('Projektdatei ist größer als 35 MB.');const p=R.validateProject(JSON.parse(await f.text()));abort?.abort();settings=p.settings;data=p.data;locationEpoch++;bounds=data.bounds.slice();const info=R.boundsInfo(bounds);Object.assign(settings,{lon:+info.lon.toFixed(6),lat:+info.lat.toFixed(6),widthKm:+(info.w/1000).toFixed(3),heightKm:+(info.h/1000).toFixed(3)});mesh=null;buildId++;building=false;map.setBounds(bounds,true);landmarkControls();markerControls();chooseMode(settings.mode);if(settings.autoSubtitle)resolveRegion();if(settings.mode==='model'&&!building&&!mesh)await build();preview();quality();notify('Projekt und enthaltene Kartendaten geöffnet. Gespeicherter Modus: '+(settings.mode==='poster'?'Poster.':'3D-Relief.'),'success');}catch(e){notify('Import: '+e.message,'error');}};
$('new-project').onclick=()=>{if(data&&!confirm('Neues Projekt starten? Ungespeicherte Änderungen gehen verloren.'))return;abort?.abort();data=mesh=null;buildId++;building=false;locationEpoch++;settings=R.cleanSettings();bounds=R.boundsFor(settings.lon,settings.lat,settings.widthKm,settings.heightKm);map.setBounds(bounds,true);$('model-empty').hidden=false;$('poster-empty').hidden=false;controls();persist();quality();landmarkControls();markerControls();panel('place');view('area');showChoice();};
$('quality-toggle').onclick=()=>{$('quality-panel').hidden=!$('quality-panel').hidden;quality();};$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
if(globalThis.RELIEF_SOURCE_FILES){$('download-code').hidden=false;$('download-code').onclick=()=>download(R.zip(globalThis.RELIEF_SOURCE_FILES),'relief-studio-source.zip');}
if(globalThis.RELIEF_STATIC_PREVIEW){$('access-note').hidden=false;$('access-note').textContent='Private Vorschau mit PIN · statische Verschlüsselung, kein serverseitiger Zugangsschutz. Keine vertraulichen Kundendaten hinterlegen.';}
// Workflow controls are deliberately separate from output-format controls.
all('[data-mode-choice]').forEach(b=>b.onclick=()=>chooseMode(b.dataset.modeChoice));
$('switch-mode').onclick=showChoice;$('home').onclick=e=>{e.preventDefault();showChoice();};
$('welcome-open').onclick=()=>$('project-file').click();
$('step-back').onclick=()=>{const i=flow().indexOf(currentPanel);if(i<=0)showChoice();else panel(flow()[i-1]);};
$('step-next').onclick=()=>{const i=flow().indexOf(currentPanel);if(i===0&&(!data||stale()||needsTerrain()))load();else if(i===3){if(settings.mode==='poster')prepareExport();else modelExport('3mf');}else panel(flow()[i+1]);};
$('notice-close').onclick=()=>$('notice').hidden=true;
$('copy-colors').onclick=()=>{const p=R.palettes[settings.style];Object.assign(settings,{customColors:true,paperColor:p.paper,landColor:p.land,inkColor:p.ink,waterColor:p.water,accentColor:p.accent,majorColor:p.major,buildingColor:p.building});controls();persist();preview();notify('Vorlagenfarben übernommen. Du kannst die Farben jetzt einzeln ändern.','success');};
all('[data-design]').forEach(b=>b.onclick=()=>{const presets={classic:{layout:'bottom',font:'serif',textAlign:'center',uppercase:true,boldTitle:false,tracking:.025,divider:true,band:22,mapBorder:false},modern:{layout:'bottom',font:'sans',textAlign:'left',uppercase:false,boldTitle:true,tracking:0,divider:false,band:22,mapBorder:false},editorial:{layout:'top',font:'serif',textAlign:'left',uppercase:false,boldTitle:false,tracking:.01,divider:true,band:24,mapBorder:true},map:{layout:'map',mapBorder:false,divider:false}};Object.assign(settings,presets[b.dataset.design]);controls();persist();preview();});
const rebuild=document.createElement('button');rebuild.id='rebuild-model';rebuild.className='secondary full';rebuild.textContent='Modell erneut berechnen';rebuild.onclick=()=>{if(commonReason())explain(commonReason());else build();};$('panel-model').append(rebuild);
controls();map.setBounds(bounds,true);view('area');quality();showChoice();
window.addEventListener('offline',()=>notify('Du bist offline. Gespeicherte Projekte lassen sich weiterhin bearbeiten und exportieren. Neue Orte und Kartendaten benötigen Internet.','warning'));

if(!globalThis.RELIEF_STATIC_PREVIEW&&location.protocol!=='file:')fetch('api/status',{signal:AbortSignal.timeout(2500),headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(j=>{if(j?.application==='relief-studio'&&j.server===true){R.server=true;$('logout-form').hidden=false;}}).catch(()=>{});
// Diagnostics are local only. The interface exposes no credentials or remote administration.
Object.defineProperty(globalThis,'ReliefStudio',{value:{get settings(){return {...settings};},get data(){return data;},get mesh(){return mesh;},get building(){return building;},view,exportPoster:()=>R.exportPoster(data,settings),get mode(){return settings.mode;},get started(){return started;},get panel(){return currentPanel;},version:'10.0.0'}});
})(globalThis.RS);