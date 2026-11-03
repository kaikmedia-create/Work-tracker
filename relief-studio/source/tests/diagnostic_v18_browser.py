import asyncio,json,os,pathlib,time
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ['RELIEF_DIAG_OUT']);OUT.mkdir(exist_ok=True,parents=True)
fixture=pathlib.Path(os.environ['RELIEF_DIAG_FIXTURE'])
checks=[];errors=[]
def record(name,ok,**kw):
    obj={'scenario':name,'passed':bool(ok),**kw};checks.append(obj);print(json.dumps(obj,ensure_ascii=False),flush=True)
    (OUT/'browser-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    assert ok,name
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':1512,'height':900},accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/*',lambda r:r.abort())
  try:
   html=(ROOT/'reports/v18/gate-rendered.html').read_text()
   await page.set_content(html,wait_until='load');await page.wait_for_function('!!window.ReliefStudio')
   record('Version 18 starts from the verified published-gate source',await page.evaluate('ReliefStudio.version==="18.0.0"'))
   t=time.monotonic();await page.set_input_files('#project-file',str(fixture))
   await page.wait_for_function('!ReliefStudio.building&&(!!ReliefStudio.mesh||!!document.querySelector("#notice.error:not([hidden])"))',timeout=120000)
   result=await page.evaluate('''()=>{const m=ReliefStudio.mesh;return {version:ReliefStudio.version,modelWidth:ReliefStudio.settings.modelWidth,inputCount:ReliefStudio.data?.buildings.length,triangles:m?.indices.length/3,buildings:m?.buildingCount,missed:m?.missed,kernel:m?.geometryKernelVersion,architecture:m?.architecture,error:document.querySelector('#notice.error:not([hidden])')?.innerText};}''')
   record('The exact 3.2 x 3 km user diagnostic builds in the real Chromium worker',result.get('kernel')==18 and result.get('buildings')==6344 and result.get('inputCount')==6346 and result.get('missed')==0,elapsedSeconds=round(time.monotonic()-t,2),**result)
   await page.screenshot(path=str(OUT/'Weinheim-18.png'),full_page=True)
   await page.click('[data-step="3"]')
   for fmt in ['stl','3mf']:
    async with page.expect_download(predicate=lambda d:d.suggested_filename.endswith('.'+fmt),timeout=120000) as event:await page.click('#export-'+fmt)
    d=await event.value;dest=OUT/('Weinheim-browser-18.'+fmt);await d.save_as(str(dest))
    record('Actual '+fmt.upper()+' download button produces a file',dest.stat().st_size>1000,bytes=dest.stat().st_size)
   record('Original selected 3.2 x 3 km area and 200 mm width remain unchanged',await page.evaluate('ReliefStudio.settings.widthKm===3.2&&ReliefStudio.settings.heightKm===3&&ReliefStudio.settings.modelWidth===200'))
   # Invalid import must never discard the complete map or the successful mesh.
   await page.set_input_files('#project-file',{'name':'broken.json','mimeType':'application/json','buffer':b'{broken'})
   await page.wait_for_selector('#notice.error')
   record('Invalid subsequent import preserves the successful map and offers Diagnose',await page.evaluate('ReliefStudio.data.buildings.length===6346&&!!ReliefStudio.mesh') and await page.locator('#notice-diagnose').is_visible())
   async with page.expect_download() as event:await page.click('#notice-diagnose')
   d=await event.value;await d.save_as(str(OUT/'diagnostic-private.json'))
   report=json.loads((OUT/'diagnostic-private.json').read_text())
   record('Local diagnosis still exports the complete reproducible dataset',report['diagnostics']['release']=='18.0.0' and len(report['data']['buildings'])==6346)
   record('No unhandled browser JavaScript exceptions',not errors,errors=errors)
  except Exception:
   await page.screenshot(path=str(OUT/'failure.png'),full_page=True)
   print('STATE',await page.evaluate('({text:document.body.innerText.slice(-2500),state:window.ReliefStudio?{building:ReliefStudio.building,mesh:!!ReliefStudio.mesh}:null})'),flush=True)
   raise
  finally:await browser.close()
asyncio.run(main())
