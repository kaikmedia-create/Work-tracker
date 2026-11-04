"""Use the rendered (checksum-verified) website, trigger errors and compare visible message with its downloaded JSON. No user data needed."""
import os,asyncio,json,pathlib,sys
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox']);p=await b.new_page(accept_downloads=True);await p.route('**/*',lambda r:r.abort());await p.set_content((root/'reports/v19/gate-rendered.html').read_text());await p.click('#choose-model');out=[]
  async def read(stage,code):
   await p.wait_for_function('([s,c])=>document.querySelector("#notice-title").textContent===s+" · "+c',arg=[stage,code]);msg=await p.locator('#notice-message').inner_text()
   async with p.expect_download() as dl:await p.click('#notice-diagnose')
   r=json.loads(pathlib.Path(await (await dl.value).path()).read_text());e=r['diagnostics']['error'];assert msg==e['displayMessage'] and e['nextStep'] and e['stage']==stage and e['code']==code
   out.append({'stage':stage,'code':code,'message':msg,'run':e['runId'],'passed':True});return e
  for payload,code in [(b'{','IMPORT_JSON'),(b'{"diagnostics":{},"data":null}','IMPORT_NO_DATA')]:
   await p.set_input_files('#project-file',{'name':'broken.json','mimeType':'application/json','buffer':payload});await read('Import',code)
  await p.click('#switch-mode');await p.click('#choose-poster');await p.evaluate("window.fetch=async()=>new Response('rate',{status:429,headers:{'Retry-After':'45'}})");await p.click('#load-data');e=await read('Kartendaten','RATE_LIMIT');assert '429' in e['displayMessage'] and e['details']['attemptedProviders'];await b.close();print(json.dumps(out,ensure_ascii=False))
asyncio.run(main())
