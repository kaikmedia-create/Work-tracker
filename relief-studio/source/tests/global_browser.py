"""Run against a local copy of the public native entry. Credentials are neither needed nor handled."""
import json,struct,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True);url=sys.argv[2];rows=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--no-sandbox','--disable-dev-shm-usage']);
 for place,lon,lat in [('Kigali',30.061,-1.95),('Leuven',4.702,50.878),('Taveuni',180,-16.793)]:
  row={'place':place,'ok':False};ctx=browser.new_context(viewport={'width':1440,'height':980},accept_downloads=True);p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  try:
   p.goto(url,wait_until='domcontentloaded');p.evaluate('(s)=>localStorage.setItem("relief-settings-v3",JSON.stringify(s))',{'mode':'model','widthKm':.5,'heightKm':.5,'lon':lon,'lat':lat,'modelWidth':160,'worldBuildings':False,'title':place,'autoSubtitle':False});p.reload(wait_until='domcontentloaded');p.wait_for_function('!!window.ReliefStudio');p.click('[data-mode-choice=model]');p.locator('#global-plan summary').click();p.select_option('#global-route','archive');p.click('#global-probe');p.wait_for_function("document.getElementById('global-result').textContent.includes('Archivkacheln geprüft')",timeout=75000);row['probe']=p.locator('#global-result').text_content();p.click('#load-data');p.wait_for_function("(ReliefStudio.mesh&&!ReliefStudio.building)||(!document.querySelector('#notice').hidden&&document.querySelector('#notice').classList.contains('error'))",timeout=170000);row['notice']=p.locator('#notice-message').text_content();assert p.evaluate('!!ReliefStudio.mesh'),row['notice'];q=p.evaluate('''()=>({b:ReliefStudio.data.bounds,src:ReliefStudio.data.globalSource,terrain:ReliefStudio.data.terrain.source,triangles:ReliefStudio.mesh.indices.length/3})''');row.update(q);assert abs((q['b'][0]+q['b'][2])/2-lon)<.0001 and abs((q['b'][1]+q['b'][3])/2-lat)<.0001;assert q['src']['stats']['cached']>0;p.click('#export-top');
   with p.expect_download(timeout=90000) as dl:p.click('#export-stl')
   path=Path(dl.value.path());row['bytes']=path.stat().st_size
   with path.open('rb') as f:f.seek(80);assert struct.unpack('<I',f.read(4))[0]==q['triangles'] and row['bytes']==84+50*q['triangles'];
   assert b'Overture Maps Foundation' in path.open('rb').read(80);p.evaluate("ReliefStudio.view('model')");p.wait_for_timeout(350);p.locator('#model-canvas').screenshot(path=str(out/(place+'.png')));assert not errors,errors;row['ok']=True
  except Exception as e:row['failure']=str(e)[:600];row['errors']=errors;row['detail']=p.locator('#global-result').all_text_contents();
  finally:rows.append(row);(out/'browser.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(place,row['ok'],row.get('failure',''),flush=True);ctx.close()
 browser.close()
if any(not r['ok'] for r in rows):sys.exit(1)
