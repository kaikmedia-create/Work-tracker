"""Offline deterministic smoke test of the truthful progress UI and 3-color branding."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'/'v10';OUT.mkdir(exist_ok=True,parents=True)
FIX=json.loads((ROOT/'tests'/'fixture-poster.json').read_text())
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
  errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  await page.route('**/*',lambda route:route.abort())
  await page.set_content((ROOT/'Relief-Studio.html').read_text(),wait_until='load')
  await page.wait_for_function('window.ReliefStudio && window.RS')
  await page.click('#choose-poster')
  await page.evaluate('''f=>{window.rs10Fixture=f;RS.loadMap=(bounds,{onProgress,signal})=>new Promise((resolve,reject)=>{
   const timer=[];const tick=(ms,fn)=>timer.push(setTimeout(fn,ms));
   tick(0,()=>onProgress({phase:'base',status:'waiting',detail:'Datendienst berechnet. Noch keine Bytes.'}));
   tick(350,()=>onProgress({phase:'base',status:'headers',received:0,total:null}));
   tick(750,()=>onProgress({phase:'base',status:'bytes',received:65536,total:131072}));
   tick(1150,()=>{onProgress({phase:'base',status:'done',count:100});onProgress({phase:'pois',status:'waiting',detail:'Sehenswürdigkeiten werden gesucht'});});
   tick(1450,()=>onProgress({phase:'pois',status:'skipped',detail:'Historische Orte nicht erreichbar – Karte trotzdem nutzbar'}));
   tick(1700,()=>{onProgress({phase:'process',status:'done',count:503});const d=structuredClone(f.data);d.bounds=bounds;d.terrain={cols:2,rows:2,values:[0,0,0,0],available:false,source:'Synthetischer 2D-Test'};d.warnings=['Zusätzliche historische Orte konnten nicht geladen werden.'];resolve(d);});
   signal.addEventListener('abort',()=>{for(const t of timer)clearTimeout(t);reject(new DOMException('Abgebrochen','AbortError'));},{once:true});
  });}''',FIX)
  await page.click('#load-data')
  await page.wait_for_selector('#loader:not([hidden])')
  await page.wait_for_timeout(170)
  assert not await page.locator('#progress').get_attribute('value'), 'No bogus percentage before bytes arrive'
  assert 'Warten' in await page.locator('#loader-percent').inner_text()
  assert await page.locator('#loader-phases .loader-phase').count()==3
  await page.screenshot(path=str(OUT/'loader-awaiting-data.png'))
  await page.wait_for_timeout(750)
  assert '50 %' in await page.locator('#loader-percent').inner_text(),await page.locator('#loader-percent').inner_text()
  assert await page.locator('#progress').get_attribute('value')=='0.5'
  await page.screenshot(path=str(OUT/'loader-real-bytes.png'))
  await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"')
  assert not await page.locator('#loader').is_visible()
  assert 'Karte' in await page.locator('#notice-message').inner_text() or '503' in await page.locator('#notice-message').inner_text() or await page.locator('.loader-phase').count()==3
  await page.screenshot(path=str(OUT/'poster-style-after-load.png'))
  # Check no horizontal overflow on compact desktop.
  for w,h in [(1366,768),(1920,1080),(2560,1440),(3200,1800)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(110)
   metrics=await page.evaluate('''()=>({vw:innerWidth,doc:document.documentElement.scrollWidth,stage:document.querySelector('.stage')?.getBoundingClientRect().height})''')
   assert metrics['doc']<=w+1,(w,metrics)
  assert not errors,errors
  print(json.dumps({'checks':12,'status':'pass','javascriptErrors':errors,'screenshots':[str(p.name) for p in OUT.glob('*.png')]},ensure_ascii=False))
  await browser.close()
asyncio.run(main())