// Deterministic synthetic data exclusively for testing. Not a map of any real city.
import '../public/core.js';
const R=globalThis.RS,cols=65,rows=65,values=[];
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const u=x/64,v=y/64;values.push(92+195*Math.exp(-((u-.8)**2+(v-.35)**2)/.055)+70*Math.exp(-((u-.65)**2+(v-.8)**2)/.06));}
const buildings=[],roads=[],parks=[],water=[];
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
let id=1;for(let y=0;y<24;y++)for(let x=0;x<29;x++){const u=.035+x*.032,v=.03+y*.039;if((u>.45&&u<.55)||u>.71&&v<.55)continue;buildings.push({id:'way/'+id,name:'',rings:[rect(u,v,.018+(id%4)*.002,.021)],height:7+(id*13%30),heightSource:id%4===0?'OSM-Höhe':id%3===0?'Geschosse × 3 m':'Schätzwert',landmark:false,tags:{building:'yes'}});id++;}
for(let y=1;y<24;y++)roads.push({id:'road/h'+y,kind:y%6===0?'major':'local',highway:y%6===0?'primary':'residential',points:[[0,y*.039+.018],[1,y*.039+.018]]});for(let x=1;x<29;x++)roads.push({id:'road/v'+x,kind:x%7===0?'secondary':'local',points:[[x*.032+.026,0],[x*.032+.026,1]]});
water.push({id:'river',name:'Testfluss',tags:{natural:'water'},rings:[[[.44,0],[.5,0],[.53,.28],[.49,.52],[.55,.75],[.54,1],[.48,1],[.49,.76],[.44,.52],[.48,.27],[.44,0]]]});
parks.push({id:'park',name:'Testwald',tags:{natural:'wood'},rings:[rect(.70,.05,.28,.52)]});
buildings.push({id:'way/castle',name:'Testburg',rings:[rect(.79,.33,.035,.035)],height:32,heightSource:'OSM-Höhe',landmark:true,tags:{building:'castle',historic:'castle'}});
const data={version:2,bounds:R.boundsFor(8.6808,49.548,3.2,3),terrain:{cols,rows,values,spacing:50,source:'SYNTHETISCHER FUNKTIONSTEST — keine realen Höhendaten'},buildings,roads,water,parks,landmarks:[{id:'way/castle',name:'Testburg',point:[.8075,.3475]}],warnings:['Synthetische Testdaten. Diese Geometrie bildet keine reale Stadt ab.'],realData:false,source:'SYNTHETISCHER FUNKTIONSTEST',capturedAt:'2026-10-24T00:00:00Z'};
export const fixture={version:2,settings:{...R.defaults,title:'Teststadt',subtitle:'SYNTHETISCHER FUNKTIONSTEST',resolution:161},data};
