"""Live public footprints and terrain; no private projects and no injected meshes."""
import json,struct,hashlib,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=sys.argv[1];OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True);ENGINE=sys.argv[3] if len(sys.argv)>3 else 'chromium';MOBILE=len(sys.argv)>4 and sys.argv[4]=='mobile';results=[]
def verify(payload):
 import numpy as np
 from scipy.sparse import coo_matrix
 from scipy.sparse.csgraph import connected_components
 n=struct.unpack_from('<I',payload,80)[0];assert n>0 and len(payload)==84+50*n
 d=np.frombuffer(payload,offset=84,dtype=[('normal','<f4',3),('v','<f4',(3,3)),('colour','<u2')])['v'];assert np.isfinite(d).all();a,b,c=d[:,0].astype('d'),d[:,1].astype('d'),d[:,2].astype('d');assert (np.linalg.norm(np.cross(b-a,c-a),axis=1)>0).all();assert np.einsum('ij,ij->',a,np.cross(b,c))>0
 _,ids=np.unique(d.reshape(-1,3),axis=0,return_inverse=True);ids=ids.reshape(-1,3);edges=np.concatenate([ids[:,[0,1]],ids[:,[1,2]],ids[:,[2,0]]]);K=int(ids.max())+1;left=edges[:,0]<edges[:,1];keys=edges.min(axis=1)*K+edges.max(axis=1);assert len(keys)==2*left.sum();assert np.array_equal(np.sort(keys[left]),np.sort(keys[~left]));assert len(np.unique(keys[left]))==left.sum();e=edges[left];graph=coo_matrix((np.ones(len(e),dtype=np.uint8),(e[:,0],e[:,1])),shape=(K,K)).tocsr();assert connected_components(graph,directed=False,return_labels=False)==1
 return {'triangles':n,'bytes':len(payload),'closed':True,'components':1,'sha256':hashlib.sha256(payload).hexdigest()}
def setting(p,k,v):
 p.locator('[data-setting="'+k+'"]').first.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event(e.type==="text"?"input":"change",{bubbles:true}));}',str(v))
def ready(p,mode):
 p.wait_for_function('mode=>!ReliefStudio.building && ReliefStudio.settings.surfaceMode===mode && (ReliefStudio.mesh && ReliefStudio.mesh!==window.previousMesh || document.querySelector("#notice.error:not([hidden])"))',arg=mode,timeout=180000)
 assert p.evaluate('!!ReliefStudio.mesh && ReliefStudio.mesh!==window.previousMesh'),p.locator('#notice').inner_text()
def mode(p,value):
 p.evaluate('window.previousMesh=ReliefStudio.mesh');setting(p,'surfaceMode',value);ready(p,value)
def export(p):
 if MOBILE:p.locator('#phone-project').click()
 p.locator('#export-top').click()
 with p.expect_download(timeout=90000) as event:p.locator('#export-stl').click()
 assert event.value.suggested_filename.lower().endswith('.stl')
 payload=Path(event.value.path()).read_bytes();return payload,verify(payload)
def screenshot(p,path):
 if MOBILE:
  p.locator('#phone-preview').click() if p.locator('#phone-preview').count() else p.evaluate("ReliefStudio.view('model')")
 else:p.evaluate("ReliefStudio.view('model')")
 p.wait_for_timeout(1200);p.screenshot(path=str(path))
with sync_playwright() as pw:
 args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] if ENGINE=='chromium' else []
 browser=getattr(pw,ENGINE).launch(args=args)
 cases=[('Heidelberg',8.7104,49.4118,True),('Karlsruhe',8.4037,49.0092,True),('Sfax',10.76,34.74,False)] if not MOBILE else [('Heidelberg',8.7104,49.4118,True),('Sfax',10.76,34.74,False)]
 for name,lon,lat,measured in cases:
  row={'name':name,'engine':ENGINE,'emulatedTouch':MOBILE,'lon':lon,'lat':lat,'km':.35};results.append(row);started=time.monotonic();errors=[];requests=[]
  ctx=browser.new_context(viewport={'width':390,'height':760} if MOBILE else {'width':1440,'height':1050},is_mobile=MOBILE,has_touch=MOBILE,accept_downloads=True,service_workers='block');p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));ctx.route('**/interpreter*',lambda r:r.abort());ctx.route('**/tile.openstreetmap.org/**',lambda r:r.abort())
  try:
   p.goto(URL);p.fill('#pin','2808');p.click('#submit');p.wait_for_selector('#choose-model');p.click('#choose-model');assert p.evaluate('ReliefStudio.settings.surfaceMode')=='classic';assert p.locator('#city-surface option').count()==3
   for k,v in [('widthKm',.35),('heightKm',.35),('lon',lon),('lat',lat)]:setting(p,k,v)
   actual=p.evaluate('({lon:ReliefStudio.settings.lon,lat:ReliefStudio.settings.lat})');assert abs(actual['lon']-lon)<1e-6 and abs(actual['lat']-lat)<1e-6,actual
   p.evaluate('window.previousMesh=null');p.click('#load-data');ready(p,'classic');assert p.evaluate('!ReliefStudio.mesh.survey');assert not any('/survey29/' in u for u in requests),'classic requested survey tiles'
   assert p.evaluate('ReliefStudio.data.sourceAudit.release');row['buildings']=p.evaluate('ReliefStudio.data.buildings.length');assert row['buildings']>0
   p.evaluate('window.originalFootprints=JSON.stringify(ReliefStudio.data.buildings.map(b=>b.rings))');classic,row['classic']=export(p);screenshot(p,OUT/(name+'-classic.png'))
   mode(p,'hybrid');assert p.evaluate('JSON.stringify(ReliefStudio.data.buildings.map(b=>b.rings))===window.originalFootprints');assert p.evaluate('!ReliefStudio.mesh.survey');fusion=p.evaluate('ReliefStudio.mesh.heightFusion||null');row['reason']=p.evaluate('ReliefStudio.mesh.surveyReason');row['fusion']=fusion
   if measured:
    assert fusion and fusion['updated']>0,row['reason'];assert not p.evaluate('!!ReliefStudio.mesh.vectorEnvelope');assert p.evaluate('ReliefStudio.data.heightFusionAudit.updated')==fusion['updated']
   else:assert not fusion or fusion['updated']==0
   hybrid,row['hybrid']=export(p);screenshot(p,OUT/(name+'-hybrid.png'))
   if not measured:assert hybrid==classic,'missing source changed classic geometry'
   if measured:
    p.evaluate("RS.notify('Kontrollierter Diagnose-Test','error',null,new Error('QA_TEST'),{stage:'Test'});")
    with p.expect_download() as event:p.click('#notice-diagnose')
    diagnostic=json.loads(Path(event.value.path()).read_text());assert diagnostic['data']['heightFusionAudit']['updated']==fusion['updated'];row['diagnosticIncludesPerBuildingDecisions']=True
    p.locator('#notice-close').click() if p.locator('#notice-close').count() else p.evaluate("document.getElementById('notice').hidden=true")
   mode(p,'classic');again,_=export(p);assert again==classic,'switching back retained measurement height';assert p.evaluate('!ReliefStudio.data.heightFusionAudit');row['classicRoundTripIdentical']=True
   if measured and not MOBILE:
    mode(p,'auto');assert p.evaluate('!!ReliefStudio.mesh.survey');screenshot(p,OUT/(name+'-raw-raster.png'))
   assert not errors,errors;row['ok']=True
  except Exception as error:
   row.update(ok=False,error=str(error),notice=p.locator('#notice').inner_text() if p.locator('#notice').count() else 'gate');p.screenshot(path=str(OUT/(name+'-failure.png')));print('FAIL',name,str(error),flush=True)
  finally:
   row['seconds']=round(time.monotonic()-started,2);row['uncaught']=errors;ctx.close();(OUT/'acceptance.json').write_text(json.dumps(results,indent=2));print(name,row.get('ok'),row.get('reason'),flush=True)
 browser.close()
if not all(row.get('ok') for row in results):sys.exit(1)
