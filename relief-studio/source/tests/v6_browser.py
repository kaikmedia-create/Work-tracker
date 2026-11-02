import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
from PIL import Image
import fitz
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'reports'/'v6';out.mkdir(exist_ok=True,parents=True)
f=json.loads((root/'tests'/'fixture-poster.json').read_text());checks=[]
def check(name,valid):
 print(('PASS ' if valid else 'FAIL ')+name,flush=True)
 if not valid:raise AssertionError(name)
 checks.append(name)
async def main():
 async with async_playwright() as p:
  br=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=await br.new_page(viewport={'width':2048,'height':1294},device_scale_factor=1,accept_downloads=True)
  await page.route('**/*',lambda route:route.abort())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content((root/'Relief-Studio.html').read_text(),wait_until='load');await page.wait_for_function('window.ReliefStudio')
  await page.click('#choose-poster');await page.evaluate('f=>{RS.loadMap=async(bounds)=>{const d=structuredClone(f.data);d.bounds=bounds;d.terrain={cols:2,rows:2,values:[0,0,0,0],available:false};return d;}}',f)
  await page.click('#load-data');await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"',timeout=20000)
  await page.click('#step-next');await page.wait_for_function('ReliefStudio.panel==="text"')
  check('Format in Text & Layout',await page.locator('#paper').is_visible())
  check('Whitespace map slider in Text & Layout',await page.locator('#map-scale').is_visible())
  await page.select_option('#paper','60 × 80 cm')
  await page.locator('#map-scale').fill('0.72');await page.locator('#map-scale').dispatch_event('input')
  await page.locator('#margin-space').fill('32');await page.locator('#margin-space').dispatch_event('input')
  check('Custom poster map percent persists',abs((await page.evaluate('ReliefStudio.settings.mapScale'))-.72)<.0001)
  check('Margin adjusted',await page.evaluate('ReliefStudio.settings.margin===32'))
  check('Preset width and height',await page.evaluate('ReliefStudio.settings.paperW===600 && ReliefStudio.settings.paperH===800'))
  # no OSM on private output, error warning appears
  await page.locator('[data-setting=showAttribution]').uncheck()
  check('Attribution private preview toggle',not await page.evaluate('ReliefStudio.settings.showAttribution'))
  check('Private credit warning',('privaten' in (await page.locator('#notice-message').inner_text()).lower()))
  await page.screenshot(path=str(out/'32-inch-screen.png'),full_page=True)
  metrics=await page.evaluate('''()=>{const root=document.documentElement,main=document.querySelector('.main'),w=document.querySelector('.workspace'),st=document.querySelector('.stage'),c=document.querySelector('.poster-paper');return {innerW:innerWidth,innerH:innerHeight,scrollW:root.scrollWidth,scrollH:root.scrollHeight, bodyH:document.body.scrollHeight,mainH:main.clientHeight,mainScroll:main.scrollHeight,stageH:st.clientHeight,sidebarH:document.querySelector('.sidebar').clientHeight,card:c.getBoundingClientRect().toJSON()}}''')
  print('VIEWPORT',metrics,flush=True)
  check('No document scroll at large desktop',metrics['scrollH']<=metrics['innerH']+1)
  check('No horizontal overflow desktop',metrics['scrollW']<=metrics['innerW']+1)
  await page.set_viewport_size({'width':3200,'height':1800});await page.screenshot(path=str(out/'large-32-inch.png'),full_page=True)
  scroll=await page.evaluate('({height:document.documentElement.scrollHeight,inner:innerHeight,width:document.documentElement.scrollWidth,innerW:innerWidth})');print('LARGE',scroll)
  check('No page overflow 3200x1800',scroll['height']<=scroll['inner']+1 and scroll['width']<=scroll['innerW']+1)
  await page.click('#export-top');check('Export page has DPI setting',await page.locator('[data-setting=dpi]').is_visible())
  await page.locator('[data-setting=dpi]').select_option('300')
  for fmt in ['pdf','png','jpeg']:
   await page.click(f'[data-format={fmt}]')
   estimate=await page.locator('#export-estimate').inner_text()
   print('ESTIMATE',fmt,estimate,flush=True)
   await page.click('#export-poster');await page.wait_for_selector('#export-dialog[open]',timeout=150000)
   info=await page.locator('#export-result').inner_text();warnings=await page.locator('#export-warnings').inner_text();print('EXPORTED',fmt,info,warnings[:120],flush=True)
   async with page.expect_download(timeout=150000) as dl_info:await page.click('#download-ready')
   dl=await dl_info.value;path=out/('60x80-'+fmt+('.jpg' if fmt=='jpeg' else '.'+fmt));await dl.save_as(str(path))
   check(f'{fmt} <= 8MB',path.stat().st_size<=8_000_000)
   if fmt=='pdf':
    pdf=fitz.open(str(path));rect=pdf[0].rect;check('PDF physical 60x80',abs(rect.width*25.4/72-600)<1 and abs(rect.height*25.4/72-800)<1)
    check('PDF credit switch hides credit in private draft', 'OpenStreetMap' not in pdf[0].get_text())
   else:
    im=Image.open(path);px=im.size;dpi=im.info.get('dpi');print('RASTER',fmt,px,dpi,flush=True)
    check(f'{fmt} >=290 dpi 60x80',min(px[0]/(600/25.4),px[1]/(800/25.4))>=290)
  await page.click('[data-step="2"]')
  await page.locator('[data-setting=showAttribution]').check()
  await page.screenshot(path=str(out/'32-inch-with-attribution.png'),full_page=True)
  scene=await page.evaluate('''()=>{const scene=RS.posterScene(ReliefStudio.data,ReliefStudio.settings);return {ops:scene.ops.length,credit:scene.ops.filter(o=>o.role==='source'),map:scene.map,area:scene.area}}''')
  check('Attribution on poster when enabled',bool(scene['credit']))
  check('Whitespace shrinks map',scene['area']['w']<500)
  check('No unexpected Javascript errors',not errors)
  report={'checks':checks,'metrics':metrics,'largeMetrics':scroll,'pdf':(out/'60x80-pdf.pdf').stat().st_size,'png':(out/'60x80-png.png').stat().st_size,'jpeg':(out/'60x80-jpeg.jpg').stat().st_size,'errors':errors}
  (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print('TOTAL',len(checks),flush=True)
  await br.close()
asyncio.run(main())
