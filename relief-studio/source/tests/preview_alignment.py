"""Visual regression: preview sheet and drawn canvas must be pixel-aligned at every print size."""
import asyncio, json, pathlib
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'/'preview_alignment'
OUT.mkdir(parents=True,exist_ok=True)
FIXTURE=json.loads((ROOT/'tests'/'fixture-poster.json').read_text())
FORMATS=['10 × 15 cm','A4','A3','60 × 80 cm','60 × 90 cm','70 × 100 cm','20 × 20 cm','A0']
VIEWPORTS=[(1536,960),(2048,1294),(3200,1800),(1366,768),(1920,1080),(390,844)]

async def run():
 successes=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  for width,height in VIEWPORTS:
   page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
   await page.route('**/*',lambda route:route.abort())
   errors=[]
   page.on('pageerror',lambda exc:errors.append(str(exc)))
   await page.set_content((ROOT/'Relief-Studio.html').read_text(),wait_until='load')
   await page.wait_for_function('window.ReliefStudio')
   await page.click('#choose-poster')
   await page.evaluate('''fixture=>{RS.loadMap=async bounds=>{const d=structuredClone(fixture.data);d.bounds=bounds;d.terrain={cols:2,rows:2,values:[0,0,0,0],available:false};return d;}}''',FIXTURE)
   await page.click('#load-data')
   await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"',timeout=25000)
   await page.click('#step-next')
   await page.wait_for_function('ReliefStudio.panel==="text"')
   for fmt in FORMATS:
    await page.select_option('#paper',fmt)
    await page.wait_for_timeout(240)
    metric=await page.evaluate('''()=>{const p=document.querySelector('#poster-paper').getBoundingClientRect(),c=document.querySelector('#poster-canvas').getBoundingClientRect(),v=document.querySelector('#view-poster').getBoundingClientRect(),s=ReliefStudio.settings;return {paper:{x:p.x,y:p.y,width:p.width,height:p.height,right:p.right,bottom:p.bottom},canvas:{x:c.x,y:c.y,width:c.width,height:c.height,right:c.right,bottom:c.bottom},stage:{x:v.x,y:v.y,right:v.right,bottom:v.bottom},settings:{w:s.paperW,h:s.paperH},scroll:{h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth,viewportH:innerHeight,viewportW:innerWidth}};}''')
    q=metric['paper'];c=metric['canvas'];s=metric['settings'];v=metric['stage'];
    for key in ['x','y','width','height','right','bottom']:
     assert abs(q[key]-c[key])<0.11,(width,height,fmt,key,q[key],c[key])
    assert abs(q['width']/q['height']-s['w']/s['h'])<0.001,(width,height,fmt,'aspect mismatch',metric)
    assert v['x']-1<=q['x']<q['right']<=v['right']+1 and v['y']-1<=q['y']<q['bottom']<=v['bottom']+1,(width,height,fmt,'overflow',metric)
    if width>760:
     z=metric['scroll'];assert z['h']<=z['viewportH']+1 and z['w']<=z['viewportW']+1,('page scrollbar',width,height,fmt,z)
    successes.append(f'{width}x{height} / {fmt}')
   # Verify switching orientation changes the actual preview sheet immediately.
   await page.select_option('#paper','60 × 80 cm')
   await page.click('#landscape')
   await page.wait_for_timeout(240)
   a=await page.evaluate('''()=>{const p=document.querySelector('#poster-paper').getBoundingClientRect(),s=ReliefStudio.settings;return [p.width/p.height,s.paperW/s.paperH]}''')
   assert abs(a[0]-a[1])<.001 and a[0]>1,('landscape',width,height,a)
   successes.append(f'{width}x{height} / landscape 80x60')
   if width==1536:
    await page.click('#portrait')
    await page.wait_for_timeout(100)
    await page.screenshot(path=str(OUT/'fixed-60x80-1536x960.png'))
   assert not errors,errors
   await page.close()
  await browser.close()
 (OUT/'result.json').write_text(json.dumps({'checks':len(successes),'formats':FORMATS,'viewports':VIEWPORTS,'successful':successes},indent=2,ensure_ascii=False))
 print('PASS',len(successes),'poster-sheet alignment and viewport checks across',len(VIEWPORTS),'viewports and',len(FORMATS),'print formats + landscape')

if __name__=='__main__':asyncio.run(run())
