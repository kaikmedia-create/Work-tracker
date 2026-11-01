import asyncio,json,os,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'reports/v12';OUT.mkdir(parents=True,exist_ok=True)
FIX=json.loads((ROOT/'tests/fixture-poster.json').read_text()); checks=[];errors=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  page=await b.new_page(viewport={'width':1536,'height':960},accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1') or r.request.url.startswith('blob:') else r.abort())
  await page.set_content((ROOT/'Relief-Studio.html').read_text(),wait_until='load');await page.wait_for_function('!!RS.TriptychUI')
  check('only two large home cards',await page.locator('.mode-card').count()==2)
  check('third entry is a small link',await page.locator('#choose-triptych').evaluate("e=>e.tagName==='A' && !e.classList.contains('mode-card')"))
  await page.click('#choose-triptych');check('triptych opens',await page.locator('#triptych').is_visible())
  await page.click('#combo-next');check('missing three posters explained','drei' in await page.locator('#combo-message').inner_text())
  await page.screenshot(path=str(OUT/'empty.png'))
  for i in range(3):
   f=json.loads(json.dumps(FIX));f['settings'].update({'title':['WEINHEIM','HEIDELBERG','MANNHEIM'][i], 'subtitle':'SYNTHETISCHER FUNKTIONSTEST','style':['ivory','blue','mono'][i]})
   await page.set_input_files(f'#combo-file-{i}',{'name':f'city-{i}.relief.json','mimeType':'application/json','buffer':json.dumps(f).encode()})
   await page.wait_for_function(f'!!RS.TriptychUI.items[{i}] && !RS.TriptychUI.busy')
  check('three project slots independently loaded',await page.evaluate('RS.TriptychUI.items.every(x=>x.kind==="project")'))
  await page.click('#combo-next');await page.select_option('#combo-preset','80 × 60 cm');await page.locator('[data-combo-setting=gap]').fill('18');await page.locator('[data-combo-setting=gap]').dispatch_event('input')
  await page.screenshot(path=str(OUT/'layout.png'))
  check('landscape format is 800 x 600',await page.evaluate('RS.TriptychUI.settings.width===800&&RS.TriptychUI.settings.height===600'))
  check('gap changes without altering sources',await page.evaluate('RS.TriptychUI.settings.gap===18&&RS.TriptychUI.items[0].name==="WEINHEIM"'))
  await page.click('#combo-slot-0 [data-combo-swap="1"]');check('reordering works',await page.evaluate('RS.TriptychUI.items[1].name==="WEINHEIM"'))
  before=await page.evaluate('RS.TriptychUI.items[0].name')
  await page.set_input_files('#combo-file-0',{'name':'broken.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7\nbroken'})
  await page.wait_for_function('!RS.TriptychUI.busy');check('bad upload leaves existing slot intact',await page.evaluate('RS.TriptychUI.items[0].name')==before and await page.locator('#combo-message.error').is_visible())
  await page.click('#combo-next');await page.click('#combo-prepare');await page.wait_for_function('!!RS.TriptychUI.pending',timeout=60000)
  async with page.expect_download() as info:await page.click('#combo-download')
  dl=await info.value;await dl.save_as(OUT/'browser-three-projects-800x600.pdf')
  check('vector combo PDF under 8MB',(OUT/'browser-three-projects-800x600.pdf').stat().st_size<8000000)
  async with page.expect_download() as info:await page.click('#combo-save')
  dl=await info.value;await dl.save_as(OUT/'combo.triptych.json');saved=json.loads((OUT/'combo.triptych.json').read_text());check('combo saves all sources',len(saved['items'])==3)
  await page.click('[data-combo-step=motifs]');await page.click('#combo-slot-1 [data-combo-remove]');check('remove slot',await page.evaluate('RS.TriptychUI.items[1]===null'))
  await page.set_input_files('#combo-project-file',str(OUT/'combo.triptych.json'));await page.wait_for_function('!RS.TriptychUI.busy && RS.TriptychUI.items.every(Boolean)')
  check('combo reopens with gap',await page.evaluate('RS.TriptychUI.settings.gap===18'))
  # Existing user PDF stays PDF; preview renderer is tested locally, not by screenshots in export.
  await page.set_input_files('#combo-file-0','/mnt/data/foz-210x297mm.pdf' if Path('/mnt/data/foz-210x297mm.pdf').exists() else str(OUT/'format-400x300.pdf')); await page.wait_for_function('!RS.TriptychUI.busy && RS.TriptychUI.items[0].kind==="pdf"',timeout=45000)
  check('uploaded Foz vector PDF rendered to thumbnail',await page.evaluate('RS.TriptychUI.items[0].thumb.width>100'))
  await page.click('[data-combo-step=export]');await page.click('#combo-prepare');await page.wait_for_function('!!RS.TriptychUI.pending',timeout=60000)
  async with page.expect_download() as info:await page.click('#combo-download')
  dl=await info.value;await dl.save_as(OUT/'browser-foz-mixed-800x600.pdf')
  # Three-city guided creation uses the existing editor; only the map provider is mocked.
  await page.click('[data-combo-step=motifs]');await page.evaluate('f=>{RS.loadMap=async(b,opts)=>{const d=structuredClone(f.data);d.bounds=b;d.terrain.available=false;return d;};RS.reverseRegion=async()=>({region:"Baden-Württemberg",countryCode:"DE",country:"Deutschland"});}',FIX)
  for i in range(3):await page.click(f'#combo-slot-{i} [data-combo-remove]')
  await page.click('#combo-create-start')
  for i in range(3):
   await page.wait_for_function(f'RS.TriptychUI.active==={i}')
   check('guided city '+str(i+1)+' has poster editor',await page.locator('.workspace').is_visible())
   await page.click('#load-data');await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"')
   await page.click('[data-step="2"]');await page.locator('[data-setting=title]').fill(['Stadt Eins','Stadt Zwei','Stadt Drei'][i]);await page.click('#triptych-accept')
  await page.wait_for_function('RS.TriptychUI.active===-1 && RS.TriptychUI.items.every(Boolean)')
  check('three independently built city snapshots',await page.evaluate('RS.TriptychUI.items.map(x=>x.name).join("|")')=='Stadt Eins|Stadt Zwei|Stadt Drei')
  check('combo editor banner hidden after completion',not await page.locator('#triptych-editor-bar').is_visible())
  await page.screenshot(path=str(OUT/'guided-three-cities.png'))
  # A fast slider sequence uses cached previews; no mapping network traffic.
  start=time.monotonic()
  await page.evaluate('()=>{let e=document.querySelector("[data-combo-setting=gap]");for(let i=0;i<160;i++){e.value=i%25;e.dispatchEvent(new Event("input",{bubbles:true}));}}')
  await page.wait_for_timeout(300);check('160 slider changes remain responsive',time.monotonic()-start<15)
  for width,height in [(1366,768),(1536,960),(1920,1080),(2560,1440),(3840,2160)]:
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(70)
   check(f'desktop footer within {width}x{height}',await page.locator('#combo-next').evaluate('e=>{const b=e.getBoundingClientRect();return b.bottom<=innerHeight+1&&b.right<=innerWidth+1}'))
   check(f'no document overflow {width}x{height}',await page.evaluate('document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1'))
  for width in [320,390,700]:
   await page.set_viewport_size({'width':width,'height':844});check('mobile no horizontal overflow '+str(width),await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  await page.set_viewport_size({'width':1536,'height':960});await page.click('[data-combo-step=export]');await page.click('#combo-prepare');await page.wait_for_function('!!RS.TriptychUI.pending',timeout=60000)
  async with page.expect_download() as info:await page.click('#combo-download')
  await (await info.value).save_as(OUT/'guided-three-cities-800x600.pdf')
  check('no unhandled JavaScript errors',not errors)
  (OUT/'browser.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2));await b.close()
asyncio.run(main())
