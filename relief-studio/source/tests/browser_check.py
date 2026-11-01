import json, asyncio, pathlib, mimetypes
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path('/mnt/data')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  context=await browser.new_context(viewport={'width':1500,'height':1020},device_scale_factor=1,accept_downloads=True)
  page=await context.new_page(); errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  async def local_route(route):
   u=urlparse(route.request.url)
   if u.hostname=='relief.example':
    f=ROOT/'relief-studio/public'/('index.html' if u.path=='/' else u.path.lstrip('/'))
    if f.is_file(): await route.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
    else: await route.fulfill(status=404,body='Not found')
   else: await route.abort()
  await context.route('**/*',local_route)
  await page.set_content((ROOT/'relief-studio/Relief-Studio.html').read_text(),wait_until='load')
  await page.wait_for_function('!!window.ReliefStudio')
  await page.locator('[data-setting=widthKm]').fill('4.5');await page.locator('[data-setting=widthKm]').dispatch_event('change')
  assert await page.evaluate('ReliefStudio.settings.widthKm')==4.5
  await page.set_input_files('#project-file','/mnt/data/relief-fixture.json')
  await page.wait_for_function('ReliefStudio.mesh && !ReliefStudio.building')
  await page.wait_for_timeout(600)
  await page.screenshot(path='/mnt/data/relief-studio-desktop.png',full_page=True)
  print('model',await page.evaluate('({count:ReliefStudio.mesh.indices.length/3, width:ReliefStudio.mesh.width, rendering:!document.querySelector("#model-empty").hidden, errors:window.errors})'))
  await page.click('[data-panel=style]');await page.locator('[data-setting=major]').fill('3.8');await page.locator('[data-setting=major]').dispatch_event('input');await page.wait_for_timeout(700)
  assert await page.evaluate('ReliefStudio.settings.major')==3.8
  await page.click('#export-top');await page.wait_for_timeout(500)
  await page.screenshot(path='/mnt/data/relief-studio-poster-ui.png',full_page=True)
  results=[]
  for size in ['10 × 15 cm','A4','A0']:
   await page.select_option('#paper',size)
   for fmt in ['pdf','png','jpeg']:
    await page.click(f'[data-format={fmt}]')
    await page.click('#export-poster')
    await page.wait_for_selector('#export-dialog[open]',timeout=90000)
    details=await page.locator('#export-details').text_content();summary=await page.locator('#export-result').text_content();warnings=await page.locator('#export-warnings').text_content()
    async with page.expect_download() as info:await page.click('#download-ready')
    dl=await info.value;target=ROOT/('test-'+dl.suggested_filename);await dl.save_as(target)
    assert target.stat().st_size<=8000000
    results.append({'format':fmt,'preset':size,'size':target.stat().st_size,'summary':summary,'warnings':warnings,'file':str(target)})
  await page.set_viewport_size({'width':390,'height':844});await page.screenshot(path='/mnt/data/relief-studio-mobile.png',full_page=True)
  overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
  await page.click('#save-project')
  await browser.close()
  report={'page_errors':errors,'mobile_overflow':overflow,'exports':results}
  (ROOT/'relief-browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
asyncio.run(main())
