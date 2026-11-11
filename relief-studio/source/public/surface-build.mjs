/** Shared by desktop, mobile module worker, legacy worker and main-thread fallback. */
import {buildOfficial} from './official-mesh.mjs';
import * as survey from './survey29.js';
import {fuseBuildingMeasurements,samplerFromSurvey} from './hybrid-buildings.mjs';
export async function buildSurface(R,data,settings,{loadSurvey=survey.loadSurvey,signal=AbortSignal.timeout(90000),...options}={}){
 const mode=settings.surfaceMode||'official';if(mode==='official')return buildOfficial(R,data,settings,{...options,signal});
 let reason='Klassisches Kartenrelief · kartierte Kanten, ohne Messraster.',source=data,fusion=null;
 if(mode==='auto'||mode==='hybrid'){
  try{
   R.meshProgress?.({step:mode==='hybrid'?'Gebäudehöhen im Grundriss prüfen':'Messoberfläche prüfen',pass:1});
   const scan=await loadSurvey(data.bounds,signal);
   if(scan&&mode==='auto'){
    const m=survey.meshSurvey(R,data,settings,scan);
    if(m){m.survey.bounds=data.bounds.slice();m.survey.mapWidth=settings.modelWidth;return m;}
   }else if(scan){
    const result=fuseBuildingMeasurements(R,data,settings,samplerFromSurvey(R,data,scan));source=result.data;fusion=result.audit;
    reason=`Klassische Kanten + Messhöhen: ${fusion.updated} Gebäude ergänzt; ${fusion.protected} vorhandene Höhen/Dachmodelle geschützt; ${fusion.rejected} ohne geeignete Messwerte. Keine Rasterwände.`;
   }
   if(!scan)reason='Klassisches Kartenrelief · für diesen Ausschnitt keine nutzbaren Messdaten geladen. Kartierte Gebäude bleiben unverändert.';
  }catch(e){
   if(e.name==='AbortError'||signal.aborted&&signal.reason?.name!=='TimeoutError')throw e;
   fusion={algorithm:'footprint-height-p70-v1',updated:0,status:'unavailable',reason:e.message,code:e.code||e.name};
   reason='Klassisches Kartenrelief · Messhöhen nicht verfügbar ('+String(e.message).slice(0,160)+'). Kartendaten bleiben erhalten.';
  }
 }
 let mesh;
 try{mesh=R.buildMesh(source,settings);}catch(error){
  if(source!==data){
   fusion={...fusion,status:'not-applied',proposed: fusion.updated,updated:0,geometryError:error.code||error.message,buildings:fusion.buildings.map(b=>b.status==='applied'?{...b,status:'not-applied',reason:'mesh-conflict'}:b)};
   // Never turn crisp hybrid buildings back into a noisy whole-city raster.
   mesh=R.buildMesh(data,settings);reason='Klassisches Kartenrelief · Messhöhen konnten nicht kantenrein verbunden werden und wurden nicht übernommen. '+String(error.code||error.message);
  }else if(data.sourceAudit){mesh=survey.contactEnvelope(R,data,settings,error);reason=mesh.surveyReason;}
  else throw error;
 }
 mesh.surveyReason=reason;if(fusion)mesh.heightFusion=fusion;return mesh;
}
