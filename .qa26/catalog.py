import numpy as np,zipfile,json,hashlib
from lxml import etree as E
from shapely.geometry import Polygon
from shapely import constrained_delaunay_triangles as cdt
from pyproj import Transformer
from pathlib import Path
g='{http://www.opengis.net/gml}';b='{http://www.opengis.net/citygml/building/1.0}';t=Transformer.from_crs(25832,4326,always_xy=True)
items=[('way/274663761','DEBW_001000rOZoG','Peterskirche'),('way/347204504','DEBW_001000rOZxG','Herz Jesu'),('way/104325167','DEBW_001000rPac4','Blauer Hut'),('way/126201382','DEBW_001000rOXvD','St. Laurentius'),('way/323257338','DEBW_001000rP02g','Evangelische Stadtkirche'),('way/104325177','DEBW_001000rPacg','Roter Turm')]
def polys(el,kind):
 out=[]
 for s in el.iter(b+kind):
  for f in s.iter(g+'Polygon'):
   rings=[]
   for l in f.iter(g+'LinearRing'):
    vals=l.findtext(g+'posList')
    if vals:rings.append(np.array(vals.split(),float).reshape(-1,3))
   if rings:out.append(rings)
 return out
selected={};wanted={item[1] for item in items};zipf=zipfile.ZipFile('tile.zip')
for nm in zipf.namelist():
 if not nm.endswith('.gml'):continue
 for _,el in E.iterparse(zipf.open(nm),events=('end',),tag=b+'Building'):
  rid=el.get(g+'id')
  if rid in wanted:selected[rid]=(polys(el,'RoofSurface'),min(v[:,2].min() for a in polys(el,'GroundSurface') for v in a))
  el.clear()
catalog={}
for key,lgl,name in items:
 roof,z0=selected[lgl];pts=[];ids={};faces=[]
 def vertex(x,y,z):
  lo,la=t.transform(x,y);v=(round(lo*1e7),round(la*1e7),round((z-z0)*100))
  if v not in ids:ids[v]=len(pts);pts.append(v)
  return ids[v]
 def insert(poly):
  ring=poly[0];mean=ring[:-1].mean(0);c=np.linalg.lstsq(ring[:,:2]-mean[:2],ring[:,2]-mean[2],rcond=None)[0];shp=Polygon(ring[:,:2],[q[:,:2] for q in poly[1:]]);lut={(x,y):z for r in poly for x,y,z in r}
  if not shp.is_valid:shp=shp.buffer(0)
  for tri in cdt(shp).geoms:
   if tri.area<.0001:continue
   ii=[vertex(x,y,lut.get((x,y),mean[2]+np.dot([x-mean[0],y-mean[1]],c))) for x,y in list(tri.exterior.coords)[:3]]
   if len(set(ii))==3:faces.append(ii)
 for poly in roof:insert(poly)
 if name=='Peterskirche':
  def local(px,py,h):return np.array([476550+px*.1,5489070-py*.1,z0+h])
  corn=[local(x,y,38) for x,y in [(304,146),(364,188),(321,246),(261,204)]];apex=local(312,196,47)
  for i in range(4):insert([np.array([corn[i],corn[(i+1)%4],apex,corn[i]])])
 base=pts[0];catalog[key]={'o':base[:2],'v':[[x-base[0],y-base[1],z] for x,y,z in pts],'t':faces,'ref':lgl,'label':name}
text=json.dumps(catalog,separators=(',',':'),ensure_ascii=False);print('Catalog SHA256:',hashlib.sha256(text.encode()).hexdigest());assert hashlib.sha256(text.encode()).hexdigest()=='c7f441738eeb3c118845c21007e2a094ac5ee2aa0c6ba61dde199daa856bbcda';Path('catalog.json').write_text(text)
