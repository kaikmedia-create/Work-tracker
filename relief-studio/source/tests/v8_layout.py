"""Regression: keyboard/button bar is fully visible in 32-inch and smaller desktop viewports."""
import asyncio, pathlib, json
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/v8'
OUT.mkdir(parents=True,exist_ok=True)
html=(ROOT/'Relief-Studio.html').read_text()
fixture=json.loads((ROOT/'tests/fixture-poster.json').read_text())
DESKTOPS=[(900,600),(1050,630),(1280,640),(1366,768),(1440,900),(1920,1080),(2048,1294),(3200,1800)]
async def one(page,width,height,mode):
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  await page.route('**/*',lambda r:r.abort())
  await page.set_content(html,wait_until='load')
  await page.wait_for_function('window.ReliefStudio')
  await page.locator('#choose-poster' if mode=='poster' else '#choose-model').click()
  await page.evaluate('''fixture=>{RS.loadMap=async bounds=>{const d=structuredClone(fixture.data);d.bounds=bounds;d.terrain={cols:2,rows:2,values:[0,0,0,0],available:false};return d;}}''',fixture)
  if mode=='poster':
    await page.locator('#load-data').click();await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"')
    await page.locator('#step-next').click();await page.wait_for_function('ReliefStudio.panel==="text"')
    await page.locator('#step-next').click();await page.wait_for_function('ReliefStudio.panel==="export"')
  else:
    # 3D requires real terrain; inspect navigation bar in step 1 only
    pass
  await page.wait_for_timeout(300)
  data=await page.evaluate('''()=>{
  const rect=sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const steps=rect('.sidebar-bottom'),nav=rect('.step-navigation'),back=rect('#step-back'),next=rect('#step-next'),panels=rect('.panels'),workspace=rect('.workspace'),sidebar=rect('.sidebar');
  const hit=sel=>{const r=rect(sel),e=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2),btn=document.querySelector(sel);return e===btn||btn.contains(e);};
  return {v:[innerWidth,innerHeight],doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],steps,nav,back,next,panels,workspace,sidebar,backHittable:hit('#step-back'),nextHittable:hit('#step-next')};
  }''')
  assert data['doc'][0]<=width+1 and data['doc'][1]<=height+1,('document scroll',width,height,mode,data)
  assert data['steps']['bottom']<=height+0.5 and data['steps']['bottom']>0,('sidebar navigation clipped',width,height,mode,data)
  assert data['next']['bottom']<=height-6 and data['back']['bottom']<=height-6,('button clipped',width,height,mode,data)
  assert data['next']['h']>=40 and data['back']['h']>=40,('buttons too small',width,height,mode,data)
  assert data['backHittable'] and data['nextHittable'],('button overlay',width,height,mode,data)
  assert data['panels']['bottom'] <= data['steps']['y']+1,('sidebar panels overlapped buttons',width,height,mode,data)
  assert not errs,('JS errors',errs)
  if (width,height,mode) in [(1366,768,'poster'),(1280,640,'poster'),(2048,1294,'poster')]:
    await page.screenshot(path=str(OUT/f'foz-like-footer-{width}x{height}.png'))
  return { 'viewport':f'{width}x{height}', 'mode':mode, 'buttonBottom':round(data['next']['bottom'],2), 'viewportBottom':height, 'scroll':data['doc']}
async def main():
  rows=[]
  async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in DESKTOPS:
      for mode in ['poster','model']:
        page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        rows.append(await one(page,w,h,mode));await page.close()
    await browser.close()
  (OUT/'layout-results.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False))
  print('PASS',len(rows),'desktop poster & 3D navigation checks')
if __name__=='__main__':asyncio.run(main())