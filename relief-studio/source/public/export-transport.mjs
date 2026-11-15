/** Deterministic, narrowly scoped precision-export transport fix.
 * Gate and editable source must apply the same change after verifying v28.
 */
export const BASE_EXPORT_TRANSFER="w.postMessage({exportType:{type,title,mesh:{vertices:m.vertices,indices:m.indices}}});";
export const AUDITED_EXPORT_TRANSFER="w.postMessage({exportType:{type,title,mesh:{vertices:m.vertices,indices:m.indices,...(type==='3mf'&&m.officialAudit?{officialAudit:m.officialAudit,officialPlacement:m.officialPlacement||[]}:{})}}});";
export function applyExportTransport(source){
 if(source.includes(AUDITED_EXPORT_TRANSFER)&&!source.includes(BASE_EXPORT_TRANSFER))return source;
 if(source.split(BASE_EXPORT_TRANSFER).length!==2||source.includes(AUDITED_EXPORT_TRANSFER))throw Error('Unbekannter Export-Quellstand (Präzisionsmetadaten).');
 return source.replace(BASE_EXPORT_TRANSFER,AUDITED_EXPORT_TRANSFER);
}
export function unapplyExportTransport(source){
 if(source.includes(BASE_EXPORT_TRANSFER)&&!source.includes(AUDITED_EXPORT_TRANSFER))return source;
 if(source.split(AUDITED_EXPORT_TRANSFER).length!==2||source.includes(BASE_EXPORT_TRANSFER))throw Error('Unbekannter aktualisierter Export-Quellstand.');
 return source.replace(AUDITED_EXPORT_TRANSFER,BASE_EXPORT_TRANSFER);
}
