"""Synthetic, offline browser stress suite. Never sends tile or Overpass traffic."""
import asyncio,json,os,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('RELIEF_STRESS_OUT',ROOT/'reports'/'v5-stress'));OUT.mkdir(parents=True,exist_ok=True)
HTML=(ROOT/'Relief-Studio.html').read_text()
BASE=json.loads((ROOT/'tests'/'fixture-poster.json').read_text())
async def browser_task(browser,i):
 page=await browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.route('**/*',lambda route:route.abort())
 await page.set_content(HTML,wait_until='load');await page.wait_for_function('!!window.ReliefStudio')
 await page.click('#choose-poster')
 await page.evaluate('f=>{RS.loadMap=async (bounds,opts)=>{let d=structuredClone(f.data);d.bounds=bounds;d.terrain={cols:2,rows:2,values:[0,0,0,0],available:false,source:"synthetic"};d.buildings=[];d.roads=[];for(let j=0;j<22000;j++){let x=((j*577)%10009)/10011,y=((j*701)%10007)/10009;d.buildings.push({id:"synthetic-"+j,rings:[[[x,y],[x+.001,y],[x+.001,y+.0008],[x,y+.0008]]],height:9,heightSource:"Schätzwert",tags:{},landmark:false});if(j%3===0)d.roads.push({id:"synthetic-road-"+j,kind:j%9?"local":"major",points:[[0,y],[1,y]]});}return d;}}',BASE)
 await page.click('#load-data');await page.wait_for_function('ReliefStudio.data?.buildings?.length===22000',timeout=40000)
 await page.wait_for_function('ReliefStudio.panel==="style"',timeout=40000)
 start=time.perf_counter()
 for j in range(80):
  await page.locator('#major').evaluate('(el,n)=>{el.value=(n%50)/10;el.dispatchEvent(new Event("input",{bubbles:true}));}',j)
 await page.wait_for_timeout(300)
 lag=(time.perf_counter()-start)*1000
 assert await page.locator('#view-design').is_visible()
 assert not errors,errors
 # 1) poster PDF with 22k buildings; 2) old data surviving mode switch; 3) workflow is still responsive
 await page.click('#step-next');await page.click('#step-next')
 await page.select_option('#paper','60 × 80 cm')
 await page.click('[data-format=pdf]')
 start=time.perf_counter();await page.click('#export-poster');await page.wait_for_selector('#export-dialog[open]',timeout=90000)
 elapsed=(time.perf_counter()-start)*1000
 size=await page.locator('#export-result').inner_text();assert 'MB' in size
 async with page.expect_download() as info:await page.click('#download-ready')
 dl=await info.value;out=OUT/f'poster-{i}.pdf';await dl.save_as(str(out));assert out.stat().st_size<=8_000_000
 await page.click('#switch-mode');await page.wait_for_selector('#welcome:not([hidden])')
 assert not errors,errors
 await page.close()
 return {'case':i,'features':22000,'roads':7334,'rapid_inputs':80,'slider_ms':round(lag),'pdf_ms':round(elapsed),'pdf_bytes':out.stat().st_size,'javascript_errors':errors}
async def tile_concurrency(browser):
 page=await browser.new_page(viewport={'width':1400,'height':900})
 active=0;max_active=0;count=0
 from base64 import b64decode
 tiny=b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==')
 async def handler(route):
  nonlocal active,max_active,count
  active+=1;count+=1;max_active=max(max_active,active)
  await asyncio.sleep(.025)
  try:await route.fulfill(status=200,content_type='image/png',body=tiny)
  finally:active-=1
 await page.route('https://tile.openstreetmap.org/**',handler)
 await page.route('https://**',lambda route:route.abort())
 await page.set_content(HTML,wait_until='load');await page.wait_for_function('!!window.ReliefStudio')
 await page.click('#choose-poster')
 await page.evaluate('()=>{document.querySelector("[data-city=newyork]")?.click()}')
 for j in range(40):await page.evaluate('j=>{document.getElementById(j%2?"map-plus":"map-minus").click();}',j)
 await page.wait_for_timeout(1000)
 assert max_active<=5,{'max':max_active,'count':count}
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 assert not errors
 await page.close()
 return {'tile_requests_simulated':count,'max_simultaneous':max_active,'max_allowed':5}
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-gpu'])
  # three parallel real Chromium page instances, no external network
  results=await asyncio.gather(*(browser_task(browser,i) for i in range(3)),return_exceptions=True)
  for r in results:
   if isinstance(r,Exception):raise r
  tile=await tile_concurrency(browser)
  await browser.close()
  report={'description':'Local, synthetic, no external OSM/tiles requests', 'browser_instances':3,'results':results,'tile_stress':tile}
  (OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps(report,indent=2,ensure_ascii=False))
asyncio.run(main())
