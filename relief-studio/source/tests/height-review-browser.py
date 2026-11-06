"""Real application, public map/height sources; camera and exported geometry are checked separately."""
import sys,json,hashlib,struct,time
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=sys.argv[1];OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True);engine=sys.argv[3];mobile=len(sys.argv)>4 and sys.argv[4]=='mobile'
results=[]
def setv(p,k,v):p.locator('[data-setting="'+k+'"]').first.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event(e.type==="text"?"input":"change",{bubbles:true}));}',str(v))
def ready(p,mode):
 p.wait_for_function('m=>!ReliefStudio.building&&ReliefStudio.settings.surfaceMode===m&&ReliefStudio.mesh&&ReliefStudio.mesh!==window.oldMesh',arg=mode,timeout=200000)
 p.wait_for_timeout(600)
def export(p):
 if mobile:p.click('#phone-project')
 p.click('#export-top')
 with p.expect_download(timeout=90000) as ev:p.click('#export-stl')
 b=Path(ev.value.path()).read_bytes();n=struct.unpack_from('<I',b,80)[0];assert n and len(b)==84+50*n
 p.evaluate("document.getElementById('notice').hidden=true")
 return hashlib.sha256(b).hexdigest()
def cam(p):return p.evaluate('(()=>{const v=qaViewer,n=Math.max(v.mesh.width,v.mesh.height);return {target:[v.focus[0],v.focus[1],v.focus[2]+v.mesh.zmax/n*.35],zoom:v.zoom,pitch:v.pitch,yaw:v.yaw}})()')
def samecam(a,b):
 for k in ['zoom','pitch','yaw']:assert abs(a[k]-b[k])<1e-10,(k,a,b)
 assert all(abs(x-y)<1e-10 for x,y in zip(a['target'],b['target'])),(a,b)
with sync_playwright() as pw:
 browser=getattr(pw,engine).launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] if engine=='chromium' else [])
 for name,lon,lat,covered in [('Heidelberg',8.7104,49.4118,True),('Sfax',10.76,34.74,False)]:
  ctx=browser.new_context(viewport={'width':390,'height':820} if mobile else {'width':1440,'height':1050},is_mobile=mobile,has_touch=mobile,accept_downloads=True,service_workers='block');p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/interpreter*',lambda r:r.abort());ctx.route('**/tile.openstreetmap.org/**',lambda r:r.abort());row={'place':name,'engine':engine,'emulatedTouch':mobile};results.append(row)
  try:
   p.goto(URL);p.fill('#pin','2808');p.click('#submit');p.wait_for_selector('#choose-model');p.evaluate('const Base=RS.ModelViewer;RS.ModelViewer=class extends Base{constructor(...a){super(...a);window.qaViewer=this;}}');p.click('#choose-model');p.wait_for_selector('#height-review',state='attached');assert not p.locator('#height-review').is_visible()
   for k,v in [('widthKm',.35),('heightKm',.35),('lon',lon),('lat',lat)]:setv(p,k,v)
   p.evaluate('window.oldMesh=null');p.click('#load-data');ready(p,'classic');assert not p.locator('#height-review').is_visible();row['classicSHA']=export(p)
   p.evaluate('window.oldMesh=ReliefStudio.mesh');setv(p,'surfaceMode','hybrid');ready(p,'hybrid');row['hybridSHA']=export(p);p.evaluate("ReliefStudio.view('model')");
   if mobile:p.click('#phone-preview')
   assert p.locator('#height-review').is_visible();row['title']=p.locator('#height-review-title').inner_text();row['text']=p.locator('#height-review-text').inner_text()
   if covered:
    assert row['classicSHA']!=row['hybridSHA'];assert p.evaluate('ReliefStudio.data.heightFusionAudit.comparison.changed>0');row['statistics']=p.evaluate('ReliefStudio.data.heightFusionAudit.comparison');p.click('#height-review-show');p.wait_for_timeout(1800);row['example']=p.locator('#height-review-building').inner_text();row['heights']=p.locator('#height-review-values').inner_text();assert '→' in row['heights'];a=cam(p);assert a['zoom']>1;p.screenshot(path=str(OUT/(name+'-after.png')))
    p.evaluate('window.oldMesh=ReliefStudio.mesh');p.click('#height-review-before');ready(p,'classic');samecam(a,cam(p));assert row['classicSHA']==export(p);p.evaluate("ReliefStudio.view('model')")
    if mobile:p.click('#phone-preview')
    p.wait_for_timeout(1800);p.screenshot(path=str(OUT/(name+'-before.png')));p.evaluate('window.oldMesh=ReliefStudio.mesh');p.click('#height-review-after');ready(p,'hybrid');samecam(a,cam(p));assert row['hybridSHA']==export(p);row['roundTripIdentical']=True;row['sameCamera']=True
   else:
    assert row['classicSHA']==row['hybridSHA'];assert 'Keine Änderung' in row['title'];assert not p.locator('#height-review-show').is_visible();p.screenshot(path=str(OUT/(name+'-no-data.png')))
    with p.expect_download() as ev:p.click('#height-review-diagnose')
    report=json.loads(Path(ev.value.path()).read_text());assert report.get('data');row['diagnosticDownload']=True
   assert not errors,errors;row['ok']=True
  except Exception as e:row.update(ok=False,error=str(e));p.screenshot(path=str(OUT/(name+'-failed.png')))
  finally:row['uncaught']=errors;ctx.close();(OUT/'acceptance.json').write_text(json.dumps(results,indent=2));print(json.dumps(row),flush=True)
 browser.close()
if not all(x.get('ok') for x in results):sys.exit(1)
