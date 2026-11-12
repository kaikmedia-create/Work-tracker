/** Shared by desktop, mobile module worker, legacy worker and main-thread fallback. */
import * as survey from './survey29.js?official=1';
import {fuseBuildingMeasurements,samplerFromSurvey} from './hybrid-buildings.mjs?official=1';
export async function buildSurface(R,data,settings,{loadSurvey=survey.loadSurvey,signal=AbortSignal.timeout(22000)}={}){
 const mode=settings.surfaceMode||'classic';let reason='Klassisches Kartenrelief · kartierte Kanten, ohne Messraster.',source=data,fusion=null;
 if(mode==='auto'||mode==='hybrid'){
  try{
   R.meshProgress?.({step:mode==='hybrid'?'Gebäudehöhen im Grundriss prüfen':'Messoberfläche prüfen',pass:1});
   const scan=await loadSurvey(data.bounds,signal);
   if(scan&&mode==='auto'){
    const m=survey.meshSurvey(R,data,settings,scan);
    if(m){m.survey.bounds=data.bounds.slice();m.survey.mapWidth=settings.modelWidth;return m;}
   }else if(scan){
    const result=fuseBuildingMeasurements(R,data,settings,samplerFromSurvey(R,data,scan));source=result.data;fusion=result.audit;
    reason=`Amtliche Flächen zuerst; aus Messpunkten wurden für ${fusion.derivedSurfaces||fusion.updated} Gebäude belastbare Dachflächen abgeleitet. ${fusion.protected} direkte/manuelle Modelle geschützt; ${fusion.rejected} ohne geeignete Messpunkte. Keine ungeprüfte Rasterstadt.`;
   }
   if(!scan)reason='Klassisches Kartenrelief · für diesen Ausschnitt keine nutzbaren Messdaten geladen. Kartierte Gebäude bleiben unverändert.';
  }catch(e){
   if(e.name==='AbortError'||signal.aborted&&signal.reason?.name!=='TimeoutError')throw e;
   fusion={algorithm:'official-points-roof-grid-v2',updated:0,status:'unavailable',reason:e.message,code:e.code||e.name};
   reason='Amtliche Messpunkte nicht verfügbar ('+String(e.message).slice(0,160)+'). Kartendaten bleiben erhalten.';
  }
 }
 let mesh;
 try{mesh=R.buildMesh(source,settings);}catch(error){
  if(source!==data){
   fusion={...fusion,status:'not-applied',proposed: fusion.updated,updated:0,geometryError:error.code||error.message,buildings:fusion.buildings.map(b=>b.status==='applied'?{...b,status:'not-applied',reason:'mesh-conflict'}:b)};
   // Never turn crisp hybrid buildings back into a noisy whole-city raster.
   mesh=R.buildMesh(data,settings);reason='Amtlich abgeleitete Dachflächen konnten nicht kantenrein verbunden werden und wurden nicht übernommen. '+String(error.code||error.message);
  }else if(data.sourceAudit){mesh=survey.contactEnvelope(R,data,settings,error);reason=mesh.surveyReason;}
  else throw error;
 }
 mesh.surveyReason=reason;if(fusion)mesh.heightFusion=fusion;return mesh;
}
