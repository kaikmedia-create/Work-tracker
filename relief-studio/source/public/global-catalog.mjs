// Reviewed release, not a promise of feature-level completeness. No city names in routing.
export const release='2026-10-21.0', host='https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com';
export const sources=Object.freeze({
 buildings:{layer:'Gebäude und Teile',archive:'buildings',z:14,license:'ODbL-1.0',use:'geometry',kind:'Kartierte und abgeleitete Grundrisse',year:null},
 transportation:{layer:'Straßen und Wege',archive:'transportation',z:14,license:'ODbL-1.0',use:'geometry',kind:'Kartierte Linien',year:null},
 base:{layer:'Gewässer, Grün und kartierte Bäume',archive:'base',z:13,license:'ODbL-1.0',use:'geometry',kind:'Kartierte Objekte; kein Baumkataster',year:null}
});
export const credit='© OpenStreetMap contributors, Overture Maps Foundation · https://www.openstreetmap.org/copyright · https://docs.overturemaps.org/attribution/ · ODbL 1.0';
export function problem(code,message,details={}){return Object.assign(new Error(message),{code,diagnostics:details});}
export const wrap=(x,n)=>((x%n)+n)%n;
export function limits(b){if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite))throw problem('GLOBAL_BOUNDS','Ungültige Koordinaten.');let [w,s,e,n]=b;if(e<w)e+=360;if(e<=w||e-w>3||n<=s||n-s>1||w< -182||e>182)throw problem('GLOBAL_BOUNDS','Ungültiger oder zu großer Ausschnitt.');if(s< -80||n>80)throw problem('GLOBAL_POLAR','Für diesen polaren Ausschnitt ist kein geprüfter Boden-Datensatz angeschlossen.');return [w,s,e,n];}
export function tilePlan(b,z){const [w,s,e,n]=limits(b),N=2**z,X=v=>(v+180)/360*N,Y=v=>(1-Math.asinh(Math.tan(v*Math.PI/180))/Math.PI)*N/2;const box=[X(w),Y(n),X(e),Y(s)],tiles=[];for(let y=Math.floor(box[1]);y<Math.ceil(box[3]);y++)for(let x=Math.floor(box[0]);x<Math.ceil(box[2]);x++){if(tiles.length>=96)throw problem('GLOBAL_BUDGET','Zu viele Detailkacheln für diesen Ausschnitt.');tiles.push({x:wrap(x,N),ux:x,y,z});}return {box,tiles};}
export function plan(b){return Object.fromEntries(Object.entries(sources).filter(([,s])=>s.use==='geometry').map(([k,s])=>[k,{...tilePlan(b,s.z),...s,release}]));}
export function quality(data){const out={buildings:0,parts:0,knownFlat:0,mappedRoof:0,modelledRoof:0,unknownRoof:0,attributeHeight:0,estimatedHeight:0};for(const b of data.buildings||[]){if(b.tags?.['rs:wall'])continue;if(b.tags?.['building:part'])out.parts++;else out.buildings++;const shape=b.tags?.['roof:shape']||b.tags?.['building:roof:shape'];if(b.detailRoof)out.modelledRoof++;else if(shape==='flat')out.knownFlat++;else if(shape)out.mappedRoof++;else out.unknownRoof++;if(b.tags?.height!=null&&Number.isFinite(parseFloat(b.tags.height)))out.attributeHeight++;else out.estimatedHeight++;}return out;}
export function summary(d){const q=quality(d);return `${q.buildings} Gebäude und ${q.parts} Teile · Dach: ${q.modelledRoof} Referenzmodelle, ${q.mappedRoof} kartierte Formen, ${q.knownFlat} ausdrücklich flach, ${q.unknownRoof} unbekannt. Eine unbekannte Form ist kein belegtes Flachdach.`;}
