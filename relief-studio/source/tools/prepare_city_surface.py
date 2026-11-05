"""Prepare raster tiles of actual above-ground surfaces. No project file / building IDs required.
Input: LGL nDOM1 EPSG:25832. Output: north-up EPSG:3857 512-square 16-bit little-endian dm,
0xffff=no observation; independent, compressed tiles for selective same-origin loading.
Usage: python prepare_city_surface.py OUTPUT_DIR [local LGL archive ...]
"""
import gzip, json, io, math, sys, tempfile, urllib.request, zipfile
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds, Resampling
from pyproj import Transformer
ORIGIN=20037508.342789244
# Standard XYZ z16 at 512 samples/tile: about 0.78 m/sample at 49.55 degrees.
STEP=2*ORIGIN/65536
SOURCE='LGL Baden-Württemberg · nDOM1 · https://www.lgl-bw.de · dl-de/by-2-0 · https://www.govdata.de/dl-de/by-2-0'
AREAS={'Weinheim':[(x,y) for x in (475,477) for y in (5486,5488)],'Heidelberg':[(477,5472),(479,5472)],'Stuttgart':[(513,5402)],'Karlsruhe':[(455,5426)]}
def main(out, paths):
 out=Path(out);out.mkdir(parents=True,exist_ok=True); tiles={}; urls=[]; inv=Transformer.from_crs(3857,4326,always_xy=True)
 with tempfile.TemporaryDirectory() as td:
  if not paths:
   for town,keys in AREAS.items():
    for x,y in keys:
     name=f'ndom1_32_{x}_{y}_2_bw.zip';url='https://opengeodata.lgl-bw.de/data/ndom1/'+name
     try:
      q=Path(td)/name
      with urllib.request.urlopen(url,timeout=45) as response: q.write_bytes(response.read(45000000))
      if not zipfile.is_zipfile(q):raise ValueError('not a zip')
      paths.append(q);urls.append(url)
     except Exception as e: print('Unavailable',town,name,str(e),flush=True)
  for path in paths:
   with zipfile.ZipFile(path) as archive:
    for name in archive.namelist():
     if not name.lower().endswith('.tif'):continue
     with rasterio.MemoryFile(archive.read(name)) as mem,mem.open() as src:
      if src.width!=1000 or src.height!=1000:raise ValueError('unexpected source dimensions')
      west,south,east,north=transform_bounds('EPSG:25832','EPSG:3857',*src.bounds,densify_pts=21); data=src.read(1); ok=(data>=0)&(data<5000)&np.isfinite(data);data=np.where(ok,data,-9999).astype('float32')
      for x in range(math.floor((west+ORIGIN)/STEP),math.floor((east+ORIGIN)/STEP)+1):
       for y in range(math.floor((ORIGIN-north)/STEP),math.floor((ORIGIN-south)/STEP)+1):
        left=x*STEP-ORIGIN;top=ORIGIN-y*STEP; grid=np.full((512,512),-9999,'float32');reproject(data,grid,src_transform=src.transform,src_crs='EPSG:25832',src_nodata=-9999,dst_transform=from_bounds(left,top-STEP,left+STEP,top,512,512),dst_crs='EPSG:3857',dst_nodata=-9999,resampling=Resampling.nearest)
        valid=grid>=0
        if valid.any():
         dest=tiles.setdefault((x,y),np.full((512,512),65535,'<u2'));dest[valid]=np.rint(grid[valid]*10).astype('<u2')
 result=[]
 for (x,y),a in sorted(tiles.items()):
  name=f'{x}-{y}.bin.gz';(out/name).write_bytes(gzip.compress(a.tobytes(),compresslevel=6,mtime=0));result.append([x,y])
 if not result:raise RuntimeError('no survey tiles prepared')
 (out/'index.json').write_text(json.dumps({'schema':1,'z':16,'size':512,'unit':'dm','nodata':65535,'source':SOURCE,'urls':urls,'tiles':result},separators=(',',':'))+'\n');print('Prepared',len(result),'tiles from',len(paths),'archives',flush=True)
if __name__=='__main__':main(sys.argv[1],sys.argv[2:])
