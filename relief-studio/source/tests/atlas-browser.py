"""Fresh browser contexts; actual external archives + elevation. No city fixtures or injected map objects."""
import json,struct,sys,time,collections,math
from pathlib import Path
from playwright.sync_api import sync_playwright
cases=json.loads(Path(__file__).with_name('atlas-matrix.json').read_text())['cases']; url=sys.argv[1]; out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True);shard=int(sys.argv[3]);rows=[]
def verify(payload):
 n=struct.unpack_from('<I',payload,80)[0];assert len(payload)==84+50*n and n>0
 import numpy as np
 d=np.frombuffer(payload[84:],dtype=np.dtype([('normal','<f4',3),('v','<f4',(3,3)),('color','<u2')]))['v'];assert np.isfinite(d).all();a,b,c=d[:,0].astype('d'),d[:,1].astype('d'),d[:,2].astype('d');normal=np.cross(b-a,c-a);assert (np.linalg.norm(normal,axis=1)>0).all();assert np.einsum('ij,ij->',a,np.cross(b,c))>0
 _,ids=np.unique(d.reshape(-1,3),axis=0,return_inverse=True);ids=ids.reshape(-1,3);edges=np.concatenate([ids[:,[0,1]],ids[:,[1,2]],ids[:,[2,0]]]);K=int(ids.max())+1;left=edges[:,0]<edges[:,1];keys=edges.min(axis=1)*K+edges.max(axis=1);assert left.sum()*2==len(keys);assert np.array_equal(np.sort(keys[left]),np.sort(keys[~left]));assert len(np.unique(keys[left]))==left.sum();return n
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--disable-gpu','--no-sandbox']);
 for i,(region,name,lon,lat,km) in enumerate(cases):
  if i//4!=shard:continue
  ctx=browser.new_context(accept_downloads=True,service_workers='block',viewport={'width':1120,'height':820});page=ctx.new_page();net=[];errors=[];t=time.monotonic();r={'region':region,'name':name,'boundsCenter':[lon,lat],'km':km};rows.append(r)
  page.on('pageerror',lambda e: errors.append(str(e)[:150]));page.on('response',lambda res:net.append({'status':res.status,'host':res.url.split('/')[2]}) if res.url.startswith('https:') else None)
  try:
   # Most runs intentionally exercise loss of optional Overpass without stressing community servers.
   if i not in (8,12):ctx.route('**/interpreter*',lambda route:route.abort());r['overpass']='simulated outage'
   else:r['overpass']='live'
   ctx.route('**/tile.openstreetmap.org/**',lambda route:route.abort());page.goto(url);page.fill('#pin','2808');page.click('#submit');page.wait_for_selector('#choose-model');page.click('#choose-model');
   for k,v in [('widthKm',km),('heightKm',km),('lon',lon),('lat',lat)]:page.locator('[data-setting="'+k+'"]').first.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("change",{bubbles:true}));}',str(v))
   page.click('#load-data');page.wait_for_function('window.ReliefStudio?.mesh || (document.querySelector("#notice.error:not([hidden])")&&!ReliefStudio.building)',polling=300,timeout=155000)
   summary=page.evaluate('''()=>({ready:!!ReliefStudio.mesh, message:document.querySelector('#notice')?.innerText,audit:ReliefStudio.data?.sourceAudit,triangles:ReliefStudio.mesh?.indices.length/3,bounds:ReliefStudio.data?.bounds})''');r.update(summary);assert summary['ready'],summary['message'];assert summary.get('audit',{}).get('release'), 'No versioned archive consumed';assert abs((r['bounds'][0]+r['bounds'][2])/2-lon)<.0002
   page.click('#export-top');
   with page.expect_download(timeout=75000) as evt:page.click('#export-stl')
   p=Path(evt.value.path());payload=p.read_bytes();n=verify(payload);assert n==r['triangles'];r.update(ok=True,bytes=len(payload));
   if i in (0,8,20):page.screenshot(path=str(out/(str(i)+'.png')))
  except Exception as e:r.update(ok=False,error=str(e)[:600],notice=page.locator('#notice').text_content(timeout=3000) if page.locator('#notice').count() else 'Gate');print('FAIL',name,r['error'],flush=True)
  finally:r['elapsedSeconds']=round(time.monotonic()-t,2);r['errors']=errors;r['http']=dict(collections.Counter(f"{a['status']} {a['host']}" for a in net));ctx.close();(out/f'matrix-{shard}.json').write_text(json.dumps(rows,indent=2));print(name,r.get('ok'),r.get('triangles'),r.get('elapsedSeconds'),flush=True)
 browser.close()
if not all(r.get('ok') and not r['errors'] for r in rows):sys.exit(1)
