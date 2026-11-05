"""Build lightweight local RGB ortho atlases from the official DOP20 WMS, on the same Web Mercator tile grid as the nDSM."""
import io,math,json,sys,urllib.parse,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageStat
out=Path(sys.argv[1]);idx=json.loads((out/'index.json').read_text());base='https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C';O=20037508.342789244;step=2*O/65536
A=[('Weinheim',8.6808,49.548),('Heidelberg',8.707,49.411),('Stuttgart',9.182,48.779),('Karlsruhe',8.404,49.01)];atl=[]
def req(params):
 u=base+'?'+urllib.parse.urlencode(params);r=urllib.request.urlopen(u,timeout=28);return r.read(9000000)
try:
 dom=ET.fromstring(req(dict(SERVICE='WMS',VERSION='1.1.1',REQUEST='GetCapabilities')));layers=[n.text for l in dom.iter() if l.tag.split('}')[-1]=='Layer' for n in l if n.tag.split('}')[-1]=='Name'];print('Available ortho layers:',layers);layer=next((x for x in layers if 'rgb' in x.lower() and 'hist' not in x.lower()),next(x for x in layers if 'dop' in x.lower()))
except Exception as e:print('Capabilities not readable, using published layer name',e);layer='IMAGES_DOP_20_RGB'
def build(area):
 name,lon,lat=area;x=(lon+180)/360*65536;y=(1-math.asinh(math.tan(lat*math.pi/180))/math.pi)*32768;parts=[(i,j) for i,j in idx['tiles'] if abs(i+.5-x)<11 and abs(j+.5-y)<11];a,b=min(i for i,j in parts),min(j for i,j in parts);c,d=max(i for i,j in parts)+1,max(j for i,j in parts)+1;tilepx=256;cols=c-a;rows=d-b;atlas=Image.new('RGBA',(cols*tilepx,rows*tilepx));
 for X in range(a,c,4):
  for Y in range(b,d,4):
   ex=min(c,X+4);ey=min(d,Y+4);size=((ex-X)*tilepx,(ey-Y)*tilepx);params=dict(SERVICE='WMS',VERSION='1.1.1',REQUEST='GetMap',LAYERS=layer,STYLES='',SRS='EPSG:3857',BBOX=','.join(map(str,[X*step-O,O-ey*step,ex*step-O,O-Y*step])),WIDTH=size[0],HEIGHT=size[1],FORMAT='image/png',TRANSPARENT='TRUE');im=Image.open(io.BytesIO(req(params))).convert('RGBA');assert im.size==size;atlas.paste(im,((X-a)*tilepx,(Y-b)*tilepx))
 if max(ImageStat.Stat(atlas.convert('RGB')).stddev)<7:raise ValueError(name+' empty response');
 fn='dop-'+name.lower()+'.webp';atlas.save(out/fn,quality=86,method=4);return dict(name=name,file=fn,box=[a,b,c,d],size=atlas.size,source='© LGL Baden-Württemberg · DOP20 RGB · dl-de/by-2-0',url=base)
with ThreadPoolExecutor(max_workers=2) as pool:
 for area,f in [(a,pool.submit(build,a)) for a in A]:
  try:atl.append(f.result());print('Imagery accepted:',area[0],flush=True)
  except Exception as e:print('No verified imagery:',area[0],e,flush=True)
(out/'colour.json').write_text(json.dumps(atl,ensure_ascii=False)+'\n')
