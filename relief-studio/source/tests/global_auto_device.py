import sys,json,struct,time
from pathlib import Path
from playwright.sync_api import sync_playwright
engine=sys.argv[1];base=sys.argv[2];out=Path(sys.argv[3]);out.mkdir(exist_ok=True,parents=True);place,lon,lat=('Dakar',-17.449,14.692) if engine=='webkit' else ('Pokhara',83.984,28.215)
row={'engine':engine,'place':place,'simulatedDevice':True,'ok':False};ts=time.monotonic()
try:
 with sync_playwright() as pw:
  b=getattr(pw,engine).launch();ctx=b.new_context(has_touch=True,is_mobile=True,viewport={'width':390,'height':780},accept_downloads=True);page=ctx.new_page();page.goto(base,wait_until='domcontentloaded');page.evaluate('(s)=>localStorage.setItem("relief-settings-v3",JSON.stringify(s))',{'mode':'model','widthKm':0.5,'heightKm':0.5,'lon':lon,'lat':lat,'modelWidth':160,'title':place,'autoSubtitle':False});page.reload(wait_until='domcontentloaded');page.wait_for_selector('body[data-crop-ui]');page.tap('#choose-model');assert page.locator('#global-route').input_value()=='auto';page.tap('#phone-preview');page.tap('#phone-crop-action');page.wait_for_function("(ReliefStudio.mesh&&!ReliefStudio.building)||(!document.querySelector('#notice').hidden&&document.querySelector('#notice').classList.contains('error'))",timeout=220000);assert page.evaluate('!!ReliefStudio.mesh'),page.locator('#notice-message').text_content();v=page.evaluate('''()=>({bounds:ReliefStudio.data.bounds,source:ReliefStudio.data.globalSource,triangles:ReliefStudio.mesh.indices.length/3})''');assert abs((v['bounds'][0]+v['bounds'][2])/2-lon)<.0001;page.tap('#phone-project');page.tap('#export-top');
  with page.expect_download(timeout=75000) as ev:page.tap('#export-stl')
  p=Path(ev.value.path());n=p.stat().st_size
  with p.open('rb') as f:f.seek(80);assert n==84+50*struct.unpack('<I',f.read(4))[0]==84+50*v['triangles']
  row.update(v);row.update(bytes=n,ok=True);print(place,'ok',flush=True);b.close()
except Exception as e:row['error']=str(e)[:900];print(str(e),flush=True)
finally:row['seconds']=round(time.monotonic()-ts,2);(out/(engine+'.json')).write_text(json.dumps(row,indent=2,ensure_ascii=False))
if not row['ok']:sys.exit(1)
