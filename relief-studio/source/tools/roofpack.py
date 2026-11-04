"""Create bounded roof-height samples (metres above ground) from a public nDSM and CityGML building outlines. For any compatible region, not keyed to OSM identifiers."""
import argparse,base64,json,math
from pathlib import Path
from zipfile import ZipFile
import numpy as np
from lxml import etree as ET
from scipy.spatial import cKDTree
from pyproj import Transformer
from shapely.geometry import Polygon,Point
from shapely.ops import transform,unary_union
import rasterio
from rasterio.windows import from_bounds

def make(gml,rasterdir,crs,functions):
 m=Transformer.from_crs(crs,3857,always_xy=True); inv=Transformer.from_crs(3857,crs,always_xy=True);geo=Transformer.from_crs(3857,4326,always_xy=True)
 tiles=[rasterio.open(f) for f in Path(rasterdir).rglob('*.tif')]; out=[]
 with ZipFile(gml) as zip_:
  for name in sorted(zip_.namelist()):
   if not name.endswith('.gml'):continue
   for _,el in ET.iterparse(zip_.open(name),events=['end'],tag='{*}cityObjectMember'):
    b=el.find('{*}Building');
    if b is None or b.findtext('{*}function') not in functions:el.clear();continue
    ringlist=[]
    for p in b.findall('.//{*}GroundSurface//{*}Polygon'):
     rings=[]
     for r in list(p):
      v=r.find('.//{*}posList');
      if v is not None:rings.append(np.fromstring(v.text,sep=' ').reshape(-1,3)[:,:2])
     if rings:ringlist.append(Polygon(rings[0],rings[1:]).buffer(0))
    if not ringlist:el.clear();continue
    poly=unary_union(ringlist); gb=transform(m.transform,poly).bounds; x1,y1,x2,y2=gb; sw=geo.transform(x1,y1);ne=geo.transform(x2,y2);latitude=(sw[1]+ne[1])/2; factor=math.cos(math.radians(latitude)); w=(x2-x1)*factor;h=(y2-y1)*factor
    if min(w,h)<3 or max(w,h)>220:el.clear();continue
    tl=next((t for t in tiles if t.bounds.left<=poly.bounds[0] and t.bounds.bottom<=poly.bounds[1] and t.bounds.right>=poly.bounds[2] and t.bounds.top>=poly.bounds[3]),None)
    if tl is None:el.clear();continue
    win=from_bounds(*poly.bounds,transform=tl.transform).round_offsets(); win=rasterio.windows.Window(win.col_off,win.row_off,math.ceil(win.width)+2,math.ceil(win.height)+2);a=tl.read(1,window=win,masked=True);aff=tl.window_transform(win); yy,xx=np.indices(a.shape);px=aff.c+(xx+.5)*aff.a;py=aff.f+(yy+.5)*aff.e
    import shapely
    mask=shapely.contains_xy(poly.buffer(-.65),px,py)&~np.ma.getmaskarray(a)&np.isfinite(a.data)&(a.data>1)&(a.data<1000)
    if mask.sum()<9:el.clear();continue
    pts=np.column_stack((px[mask],py[mask]));z=a.data[mask];tree=cKDTree(pts)
    nx=max(3,min(41,math.ceil(w/1.5)+1));ny=max(3,min(41,math.ceil(h/1.5)+1));gx,gy=np.meshgrid(np.linspace(x1,x2,nx),np.linspace(y2,y1,ny));u,v=inv.transform(gx,gy);dist,idx=tree.query(np.column_stack((u.ravel(),v.ravel())),k=3);weights=1/np.maximum(dist,.2)**2; vals=(z[idx]*weights).sum(axis=1)/weights.sum(axis=1); peak=max(vals);unit=max(.25,math.ceil(peak/250*100)/100);buf=np.round(vals/unit).astype('uint8');
    ax,ay=m.transform(*poly.representative_point().coords[0]);out.append({'id':b.get('{http://www.opengis.net/gml}id'),'bbox':[round(j,8) for j in (*sw,*ne)],'anchor':[round(j,8) for j in geo.transform(ax,ay)],'cols':nx,'rows':ny,'unit':unit,'samples':base64.b64encode(buf.tobytes()).decode()});el.clear()
 for tl in tiles:tl.close()
 return sorted(out,key=lambda e:e['id'])
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('gml_zip');p.add_argument('raster_dir');p.add_argument('--crs',required=True);p.add_argument('--functions',required=True);p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args();items=make(a.gml_zip,a.raster_dir,a.crs,set(a.functions.split(',')));Path(a.output).write_text(json.dumps({'schema':'rs-roofs-1','source':a.source,'entries':items},separators=(',',':'),ensure_ascii=False)+'\n');print('height records:',len(items))
