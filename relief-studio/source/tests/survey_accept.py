"""Automated browser acceptance; public coordinates, no private project files."""
import json,struct,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(sys.argv[1]);out.mkdir(exist_ok=True);url=sys.argv[2];results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);
 for title,bounds,measured in [('Weinheim',[8.6586471,49.5345234,8.7029529,49.5614729],True),('Heidelberg',[8.7035,49.409,8.7115,49.4130],True),('Karlsruhe',[8.4015,49.008,8.4068,49.0115],True),('Stuttgart',[9.178,48.776,9.185,48.780],True),('Sydney-Prüffläche',[151.207,-33.872,151.211,-33.868],False)]:
  c=b.new_context(viewport={'width':1400,'height':1000},accept_downloads=True);p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url,wait_until='domcontentloaded');p.fill('#pin','2808');p.click('#submit');p.wait_for_function('!!window.ReliefStudio');assert p.locator('#roof-file,#roof-import,#model-preset,#rebuild-model').count()==0
  q={'version':3,'settings':{'mode':'model','title':title,'autoSubtitle':False,'roadMode':'off','geometryVersion':12,'modelWidth':200},'data':{'version':2,'realData':True,'bounds':bounds,'terrain':{'cols':3,'rows':3,'values':[0]*9,'source':'Ebene Prüfunterlage'},'buildings':[],'roads':[],'water':[],'parks':[],'landmarks':[],'warnings':[],'trees':[{'point':[.5,.5],'height':12,'diameter':6}]}};fn=out/(title+'.relief.json');fn.write_text(json.dumps(q));p.locator('#project-file').set_input_files(str(fn.resolve()));p.wait_for_function('ReliefStudio.mesh && !ReliefStudio.building',timeout=90000);p.evaluate("ReliefStudio.view('model')");v=p.evaluate('''()=>({survey:ReliefStudio.mesh.survey,reason:ReliefStudio.mesh.surveyReason,trees:ReliefStudio.mesh.architecture?.treeCrowns,faces:ReliefStudio.mesh.indices.length/3})''');assert bool(v.get('survey'))==measured,(title,v);assert not errors,errors
  if measured:
   assert v['survey']['coverage']>.7
   try:p.wait_for_function("document.querySelector('#aerial-status').textContent.includes('Luftbild aktiv')",timeout=2500)
   except Exception:pass
   v['aerial']=p.locator('#aerial-status').text_content();p.wait_for_timeout(420);p.locator('#model-canvas').screenshot(path=str(out/(title+'.png')))
  else:assert v['trees']==1
  p.click('#export-top');with_download=p.expect_download(timeout=90000)
  with with_download:p.click('#export-stl')
  target=Path(with_download.value.path());data=target.stat().st_size
  with target.open('rb') as f:f.seek(80);assert struct.unpack('<I',f.read(4))[0]==v['faces'] and data==84+v['faces']*50
  results.append(dict(title=title,bytes=data,**v));(out/'browser.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(title,v,data,flush=True);c.close()
 b.close()
