import asyncio,pathlib,mimetypes
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1];out=root/'reports'/'v6';out.mkdir(exist_ok=True,parents=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':2048,'height':1294})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def provide(route):
   url=route.request.url.split('?',1)[0]
   name=url.rsplit('/',1)[-1] or 'index.html';file=root/'site'/name
   if file.is_file():await route.fulfill(status=200,body=file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
   else:await route.fulfill(status=404,body='Not found')
  await page.route('**/*',provide)
  await page.goto('https://relief-test.example/',wait_until='load')
  assert await page.locator('#login').is_visible(),await page.content()
  await page.locator('#pin').fill('bad-pin');await page.locator('#submit').click()
  await page.wait_for_function('document.querySelector("#status").textContent.includes("PIN falsch")',timeout=20000)
  print('PASS wrong PIN rejected',flush=True)
  await page.locator('#pin').fill('2808');await page.locator('#submit').click()
  await page.wait_for_function('window.ReliefStudio && ReliefStudio.version === "6.0.0"',timeout=30000)
  print('PASS v6 site decrypt and bootstrap',flush=True)
  assert await page.locator('#choose-poster').is_visible()
  await page.locator('#choose-poster').click()
  assert await page.locator('#paper').count()==1
  print('PASS v6 mode choice and format setting present',flush=True)
  assert not errors,errors
  await page.screenshot(path=str(out/'gate-v6-local.png'))
  await browser.close()
asyncio.run(main())
