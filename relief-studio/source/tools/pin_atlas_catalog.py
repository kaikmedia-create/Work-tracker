"""Allow-listed source metadata is built once; clients need not fetch an entire STAC tree on mobile."""
from pathlib import Path
import json,urllib.request,time
pub=Path(__file__).resolve().parents[1]/'public';release='2026-10-21.0';base='https://stac.overturemaps.org/'+release;out=[]
for key,kind in [('buildings','building'),('transportation','segment'),('base','water')]:
 url=f'{base}/{key}/{kind}/collection.json';req=urllib.request.Request(url,headers={'User-Agent':'ReliefStudio-source-audit/1'});
 for tries in range(3):
  try:
   with urllib.request.urlopen(req,timeout=15) as r: obj=json.load(r)
   break
  except (TimeoutError,OSError):
   if tries==2:raise
   time.sleep(2**tries)
 if obj.get('type')!='Collection' or not obj.get('stac_version') or not obj['extent']['spatial']['bbox']:raise ValueError('Invalid collection '+url)
 lic=str(obj.get('license',''));allowed=('odbl-1.0','odbl','open data commons open database license');
 if lic.lower() not in allowed:raise ValueError(f'Unreviewed upstream licence: {url}, {lic}')
 boxes=obj['extent']['spatial']['bbox'];assert all(len(b)==4 and all(isinstance(v,(int,float)) for v in b) for b in boxes)
 out.append({'key':key,'bbox':boxes,'catalogueID':obj['id'],'sourceSTAC':url,'upstreamLicense':lic,'outputs':['preview','STL'],'published':release.split('.')[0],'acquired':None,'spatialAccuracyMetres':None,'extentMeaning':'collection extent, not a coverage guarantee','temporalExtent':obj['extent'].get('temporal')})
(pub/'atlas-catalog.mjs').write_text('/* Spatial extents from public provider STAC; tile reads determine actual availability. */\nexport const catalog='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n');
f=pub/'atlas-reader.mjs';s='import {catalog} from "./atlas-catalog.mjs";\n'+f.read_text();a="providers:Object.entries(themes).map(([key,t])=>({key,release,license:'ODbL-1.0',";b="providers:Object.entries(themes).map(([key,t])=>({...catalog.find(v=>v.key===key),key,release,license:'ODbL-1.0',";assert s.count(a)==1;s=s.replace(a,b);f.write_text(s)
