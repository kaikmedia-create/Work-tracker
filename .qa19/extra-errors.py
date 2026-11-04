"""Browser regression: the downloaded record must match the message and must not attach a previous project on import errors."""
import asyncio, json, os, pathlib
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox']);out=[]
  for stage,code in [('Import','IMPORT_HEIGHT'),('Import','IMPORT_TERRAIN_GRID'),('Geländedaten','TERRAIN')]:
   p=await b.new_page(accept_downloads=True);await p.route('**/*',lambda r:r.abort());await p.set_content((root/'reports/v19/gate-rendered.html').read_text());await p.click('#choose-model')
   if code=='TERRAIN':
    await p.evaluate("window.fetch=async(url)=>String(url).includes('terrarium')?new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}}):new Response('{\"elements\":[]}',{headers:{'Content-Type':'application/json'}})");await p.click('#load-data')
   else:
    terrain={'cols':2.5 if code=='IMPORT_TERRAIN_GRID' else 2,'rows':2,'values':[0,0,0,0]};obj={'id':'way/123','rings':[[[0,0],[1,0],[0,1],[0,0]]],'height':-2};v={'version':3,'settings':{'mode':'model','title':'Testdatei'},'data':{'bounds':[8.67,49.54,8.68,49.55],'terrain':terrain,'buildings':[obj],'water':[],'roads':[],'parks':[],'landmarks':[]}}
    await p.set_input_files('#project-file',{'name':'broken.json','mimeType':'application/json','buffer':json.dumps(v).encode()})
   await p.wait_for_function('s=>document.querySelector("#notice-title").textContent===s',arg=stage+' · '+code,timeout=15000);msg=await p.locator('#notice-message').inner_text()
   async with p.expect_download() as dl:await p.click('#notice-diagnose')
   j=json.loads(pathlib.Path(await (await dl.value).path()).read_text());e=j['diagnostics']['error'];assert e['displayMessage']==msg and e['code']==code and e['nextStep']
   if stage=='Import':assert j['settings'] is None and j['data'] is None and j['diagnostics']['state']['bounds'] is None and 'Weinheim' not in msg
   if code=='IMPORT_HEIGHT':assert 'way/123' in msg and '-2 m' in msg
   if code=='IMPORT_TERRAIN_GRID':assert '2.5 Spalten' in msg and '4 Höhenwerte' in msg
   if code=='TERRAIN':assert e['details']['cause']=='TILE_DECODE' and e['details']['tile'] in msg
   out.append({'phase':stage,'code':code,'displayMessage':msg,'passed':True});await p.close()
  await b.close();print(json.dumps(out,ensure_ascii=False))
asyncio.run(main())
