from pathlib import Path
import sys
P=Path(sys.argv[1]); q=Path(__file__).parent
p=P/'source/public/architecture.js';s=p.read_text();a='function addStreetRelief(m,roads,s,w,h,scale){';s=s.replace(a,(q/'road.js').read_text()+a).replace(' for(const r of roads){const river=', ' const anchors=roadAnchors(roads);\n for(const r of roads){const river=').replace('pts=r.points;let used=false;', 'pts=river||s.streetCurve==="mapped"?r.points:roadCurve(r.points,w,h,radius,anchors,s.streetCurve==="fine"?.006:.015);let used=false;');key=" progress('Straßenprofil in Millimetern formen',0,cl.length);";s=s.replace(key,''' if(stats.lines){
  progress('Fahrbahnränder und Rundungen verbinden',0,faces.length/3);
  const field=(x,y)=>{const list=bins.get(cellY(y)*nx+cellX(x));let best=-1;
   if(list)for(const g of list){if(g[7]===3)continue;const u=x-g[0],z=y-g[1],q=Math.max(0,Math.min(1,(u*g[2]+z*g[3])*g[4]));best=Math.max(best,1-Math.hypot(u-q*g[2],z-q*g[3])/g[5]);}return best;};
  const fitted=fitRoadBands(faces,v,cl,locked,field,2800000-(t.length/3-start));faces=fitted.faces;stats.contourVertices=fitted.added;
 }
'''+key).replace('architecture:{decompose,','architecture:{roadCurve,roadAnchors,decompose,');p.write_text(s)
