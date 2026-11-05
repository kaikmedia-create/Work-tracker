"""Review a proposed upstream release without changing the production pin. Standard library only.
Usage: python tools/check_global_release.py 2026-10-21.0 > /tmp/source-review.json
After review, update global-catalog.js and global-stac.json together; run the source/mesh matrix.
"""
import argparse,datetime,json,re,urllib.request
from concurrent.futures import ThreadPoolExecutor

def review(release):
 if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.\d+',release):raise ValueError('Not a release version')
 types=['buildings/building','buildings/building_part','base/water','base/land','base/land_use','transportation/segment']
 def collection(k):
  u=f'https://stac.overturemaps.org/{release}/{k}/collection.json'
  with urllib.request.urlopen(u,timeout=20) as r:raw=r.read(2_000_001)
  if len(raw)>2_000_000:raise ValueError('Metadata size limit')
  j=json.loads(raw)
  if j.get('type')!='Collection' or j.get('license','').lower()!='odbl-1.0':raise ValueError(f'Unreviewed license for {k}: {j.get("license")}')
  return k,dict(release=release,license='ODbL-1.0',use='geometry',stac=u,spatialExtent=j['extent']['spatial'],temporalExtent=j['extent']['temporal'],acquisition=None)
 report=dict(ThreadPoolExecutor(3).map(collection,types))
 for theme in ('buildings','transportation','base'):
  rq=urllib.request.Request(f'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/{release}/{theme}.pmtiles',headers={'Range':'bytes=0-126'})
  with urllib.request.urlopen(rq,timeout=15) as r:
   if r.status!=206 or r.read(8)!=b'PMTiles\x03':raise ValueError(f'Unexpected PMTiles archive: {theme}')
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('release');args=parser.parse_args();print(json.dumps(review(args.release),indent=2))
