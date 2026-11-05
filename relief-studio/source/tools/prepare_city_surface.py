"""Build selective, georeferenced nDSM tiles from the open LGL nDOM1, not private projects."""
import gzip,json,math,sys,tempfile,urllib.request,zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np,rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject,transform_bounds,Resampling
O=20037508.342789244; STEP=2*O/65536;N=512
SOURCE='© LGL Baden-Württemberg · nDOM1 · https://www.lgl-bw.de · Datenlizenz Deutschland – Namensnennung 2.0 · https://www.govdata.de/dl-de/by-2-0'
KEYS=[(x,y) for x in (475,477) for y in (5486,5488)]+[(477,5472),(479,5472),(513,5402),(455,5428)]
def main(out,paths):
 out=Path(out);out.mkdir(exist_ok=True,parents=True);tiles={};urls=[];sources=[]
 with tempfile.TemporaryDirectory() as td:
  def get(key):
   x,y=key;name=f'ndom1_32_{x}_{y}_2_bw.zip';u='https://opengeodata.lgl-bw.de/data/ndom1/'+name;p=Path(td)/name
   for attempt in range(2):
    try:
     with urllib.request.urlopen(u,timeout=60) as r,p.open('wb') as fp:
      while chunk:=r.read(1024*1024):
       fp.write(chunk)
       if fp.tell()>65000000:raise ValueError('oversized archive')
     if not zipfile.is_zipfile(p):raise ValueError('invalid zip')
     return p,u
    except Exception as e:print(name,str(e),flush=True)
   return None
  if not paths:
   for got in ThreadPoolExecutor(max_workers=3).map(get,KEYS):
    if got:paths.append(got[0]);urls.append(got[1])
  for path in paths:
   with zipfile.ZipFile(path) as archive:
    for name in archive.namelist():
     if not name.lower().endswith('.tif') or 'ndom' not in name.lower():continue
     with rasterio.MemoryFile(archive.read(name)) as mem,mem.open() as src:
      if src.count!=1 or src.width>4096 or src.height>4096 or not all(.95<=v<=1.05 for v in src.res): print('Ignored overview:',name,src.shape,src.res);continue
      west,south,east,north=transform_bounds('EPSG:25832','EPSG:3857',*src.bounds,densify_pts=21);a=src.read(1,masked=True).astype('float32').filled(-9999);ok=(a>=-1)&(a<1000)&np.isfinite(a);a=np.where(ok,np.maximum(0,a),-9999).astype('float32');sources.append(name)
      for x in range(math.floor((west+O)/STEP),math.floor((east+O)/STEP)+1):
       for y in range(math.floor((O-north)/STEP),math.floor((O-south)/STEP)+1):
        l=x*STEP-O;t=O-y*STEP;g=np.full((N,N),-9999,'float32');reproject(a,g,src_transform=src.transform,src_crs='EPSG:25832',src_nodata=-9999,dst_transform=from_bounds(l,t-STEP,l+STEP,t,N,N),dst_crs='EPSG:3857',dst_nodata=-9999,resampling=Resampling.nearest)
        ok=g>=0
        if ok.any(): dest=tiles.setdefault((x,y),np.full((N,N),65535,'<u2'));dest[ok]=np.rint(g[ok]*10).astype('<u2')
 result=[]
 for (x,y),v in sorted(tiles.items()):
  (out/f'{x}-{y}.bin.gz').write_bytes(gzip.compress(v.tobytes(),compresslevel=6,mtime=0));result.append([x,y])
 if not result:raise RuntimeError('No survey data; not publishing.')
 (out/'index.json').write_text(json.dumps({'schema':1,'z':16,'size':512,'unit':'dm','nodata':65535,'source':SOURCE,'urls':urls,'sources':sources,'tiles':result},separators=(',',':'))+'\n');print('Prepared',len(result),'tiles from',len(sources),'survey rasters.',flush=True)
if __name__=='__main__':main(sys.argv[1],sys.argv[2:])
