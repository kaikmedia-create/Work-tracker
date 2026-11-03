"""Opt-in public OSM/DEM fixtures. No private diagnostics, credentials or production writes."""
import json,math,time,pathlib,subprocess,urllib.request,urllib.parse,urllib.error,io,traceback
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/city-qa';OUT.mkdir(parents=True,exist_ok=True)
cases=[('Weinheim-1km',8.6808,49.548,1,1),('Weinheim-4km',8.6808,49.548,4,4),('Heidelberg-1km',8.7104,49.4118,1,1),('Mannheim-1km',8.467,49.488,1,1),('Foz-1km',-7.2568,43.5666,1,1),('New-York-1km',-73.982,40.754,1,1)]
records=[];rate_limited=False
node="import './public/core.js';import './public/data.js';const b=RS.boundsFor(+process.argv[1],+process.argv[2],+process.argv[3],+process.argv[4]);console.log(JSON.stringify({bounds:b,query:RS.osmQuery(b),info:RS.boundsInfo(b),europe:RS.europeBounds(b)}));"
def request(url,body=None,limit=24000000):
 req=urllib.request.Request(url,data=body,headers={'User-Agent':'ReliefStudio-QA/19 (+https://github.com/kaikmedia-create/Work-tracker)','Accept':'application/json,image/png,*/*'})
 with urllib.request.urlopen(req,timeout=45) as r:
  data=r.read(limit+1)
  if len(data)>limit:raise ValueError('response size limit')
  return data

def tilexy(lon,lat,z):
 n=2**z;return (lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n

def terrain(b,info):
 z=14;a=tilexy(b[0],b[3],z);c=tilexy(b[2],b[1],z);tiles={}
 for y in range(math.floor(a[1]),math.floor(c[1])+1):
  for x in range(math.floor(a[0]),math.floor(c[0])+1):
   key=f'{z}-{x}-{y}';p=OUT/(key+'.png')
   if not p.exists():p.write_bytes(request(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',limit=1000000))
   im=Image.open(p).convert('RGB');assert im.size==(256,256)
   tiles[x,y]=list(im.getdata())
 cols=max(65,min(257,round(info['w']/25)+1));rows=max(65,min(257,round(info['h']/25)+1));values=[]
 def h(tile,x,y):
  r,g,b=tile[y*256+x];return r*256+g+b/256-32768
 for row in range(rows):
  for col in range(cols):
   tx=a[0]+(c[0]-a[0])*col/(cols-1);ty=a[1]+(c[1]-a[1])*row/(rows-1);ix=math.floor(tx);iy=math.floor(ty);t=tiles[ix,iy]
   px=min(255,(tx-ix)*256);py=min(255,(ty-iy)*256);x=int(px);y=int(py);dx=px-x;dy=py-y;x1=min(255,x+1);y1=min(255,y+1)
   values.append(round((h(t,x,y)*(1-dx)+h(t,x1,y)*dx)*(1-dy)+(h(t,x,y1)*(1-dx)+h(t,x1,y1)*dx)*dy,1))
 return {'cols':cols,'rows':rows,'values':values,'tileCount':len(tiles),'zoom':z,'source':'Mapzen / AWS Terrain Tiles (Terrarium)','attribution':'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'}
for name,lon,lat,w,h in cases:
 start=time.monotonic();record={'case':name,'status':'started','attempts':[],'network':'live HTTPS','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())};records.append(record)
 try:
  if rate_limited:raise RuntimeError('Not executed: prior provider HTTP 429; no rate-limit bypass')
  spec=json.loads(subprocess.check_output(['node','--input-type=module','-e',node,str(lon),str(lat),str(w),str(h)],cwd=ROOT));record['bounds']=spec['bounds']
  hosts=(['https://ovp.dresel.systems/api/interpreter'] if spec['europe'] else [])+['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];raw=None
  for host in hosts[:2]:
   t=time.monotonic()
   try:
    payload=request(host,urllib.parse.urlencode({'data':spec['query']}).encode());value=json.loads(payload)
    if value.get('remark') or not isinstance(value.get('elements'),list):raise ValueError('incomplete OSM: '+str(value.get('remark')))
    raw=value;record['attempts'].append({'host':host,'status':200,'seconds':round(time.monotonic()-t,2),'bytes':len(payload)});break
   except Exception as e:
    code=getattr(e,'code',None);record['attempts'].append({'host':host,'status':code,'error':str(e),'seconds':round(time.monotonic()-t,2)})
    if code==429:rate_limited=True;raise
  if raw is None:raise RuntimeError('All requested map providers failed')
  rawpath=OUT/(name+'-osm.json');rawpath.write_text(json.dumps(raw));record['osmElements']=len(raw['elements'])
  dem=terrain(spec['bounds'],spec['info']);(OUT/(name+'-terrain.json')).write_text(json.dumps(dem))
  config={'version':3,'settings':{'title':name,'lon':lon,'lat':lat,'widthKm':w,'heightKm':h,'modelWidth':200,'mode':'model','resolution':161},'bounds':spec['bounds'],'terrain':dem,'raw':raw}
  input_path=OUT/(name+'-input.json');input_path.write_text(json.dumps(config))
  convert="import fs from 'node:fs';import './public/core.js';const p=JSON.parse(fs.readFileSync(process.argv[1]));const f=RS.parseOSM(p.raw,p.bounds);const data={version:2,coastlineVersion:8,...f,bounds:p.bounds,terrain:p.terrain,realData:true,source:'OpenStreetMap contributors / ODbL 1.0',osmTimestamp:p.raw.osm3s?.timestamp_osm_base,capturedAt:new Date().toISOString()};fs.writeFileSync(process.argv[2],JSON.stringify({version:3,settings:RS.cleanSettings(p.settings),data}));console.log(data.buildings.length);"
  count=int(subprocess.check_output(['node','--input-type=module','-e',convert,str(input_path),str(OUT/(name+'.json'))],cwd=ROOT));record.update(status='downloaded',buildings=count,terrainTiles=dem['tileCount']);input_path.unlink()
 except Exception as e:record.update(status='failed',error=str(e),traceback=traceback.format_exc())
 record['seconds']=round(time.monotonic()-start,2);(OUT/'live-results.json').write_text(json.dumps(records,indent=2));print(json.dumps(record),flush=True)
 time.sleep(1)
