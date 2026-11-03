"""Runs the real rendered release in Chromium. User geometry stays local.
Network failures use synthetic response fixtures, NOT live-provider acceptance.
First run npm test to render reports/v17/gate-rendered.html.
"""
import asyncio,base64,io,json,os,pathlib,time
from PIL import Image
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('RELIEF_TEST_OUT',ROOT/'reports/v17/browser'));OUT.mkdir(parents=True,exist_ok=True)
HTML=(ROOT/'reports/v17/gate-rendered.html').read_text()
checks=[];page_errors=[]
def check(name,ok,**details):
    entry={'scenario':name,'passed':bool(ok),**details};checks.append(entry);print(json.dumps(entry,ensure_ascii=False),flush=True)
    (OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    assert ok,name
async def fresh(browser):
    page=await browser.new_page(viewport={'width':1480,'height':1050},accept_downloads=True)
    page.on('pageerror',lambda e:page_errors.append(str(e)))
    await page.route('**/*',lambda r:r.abort())
    await page.evaluate('''()=>{window.workerStats={made:0,terminated:0,messages:0};const Native=Worker;window.Worker=class extends Native{constructor(...a){super(...a);workerStats.made++;}postMessage(...a){workerStats.messages++;return super.postMessage(...a);}terminate(){workerStats.terminated++;return super.terminate();}};}''')
    await page.set_content(HTML,wait_until='load');await page.wait_for_function('!!window.ReliefStudio');return page
async def network_scenarios(browser):
    p=await fresh(browser)
    check('Startscreen and application release',await p.evaluate('ReliefStudio.version==="17.0.0"&&!ReliefStudio.started'))
    await p.click('#choose-poster');check('Poster workflow opens',await p.evaluate('ReliefStudio.mode==="poster"&&ReliefStudio.panel==="place"'))
    await p.click('#switch-mode');await p.click('#choose-model');check('Model workflow opens',await p.evaluate('ReliefStudio.mode==="model"&&ReliefStudio.panel==="place"'))
    await p.locator('[data-setting=widthKm]').fill('1');await p.locator('[data-setting=widthKm]').dispatch_event('change')
    await p.locator('[data-setting=heightKm]').fill('1');await p.locator('[data-setting=heightKm]').dispatch_event('change')
    buff=io.BytesIO();Image.new('RGB',(256,256),(128,100,0)).save(buff,format='PNG');png=base64.b64encode(buff.getvalue()).decode()
    await p.evaluate('''png=>{
      window.fault='none';window.calls=[];window.aborted=0;
      const native=fetch;window.fetch=async(u,o={})=>{
       u=String(u);
       if(u.includes('terrarium/')){calls.push({kind:'terrain',url:u});if(fault==='terrain')return new Response('missing',{status:404});return new Response(Uint8Array.from(atob(png),c=>c.charCodeAt(0)),{headers:{'content-type':'image/png'}});}
       if(!u.includes('interpreter'))return native(u,o);
       const q=new URLSearchParams(o.body).get('data')||'',kind=q.includes('nwr[historic]')?'pois':q.includes('way[building]')?'geometry':'relations';calls.push({kind,url:u});
       if(fault==='slow'||fault==='header'&&u.includes('dresel.systems')||fault==='poi'&&kind==='pois')return new Promise((_,reject)=>{const stop=()=>{aborted++;reject(new DOMException('cancel','AbortError'));};if(o.signal.aborted)return stop();o.signal.addEventListener('abort',stop,{once:true});});
       if(fault==='rate')return new Response('limited',{status:429,headers:{'Retry-After':'45'}});
       if(fault==='relations'&&kind==='relations'){await new Promise(r=>setTimeout(r,100));return new Response('bad',{status:400});}
       const s=ReliefStudio.settings,lon=s.lon,lat=s.lat;
       const building={type:'way',id:1,tags:{building:'yes',name:'Synthetic network test building'},geometry:[{lon,lat},{lon:lon+.0003,lat},{lon:lon+.0003,lat:lat+.0003},{lon,lat:lat+.0003},{lon,lat}]};
       return new Response(JSON.stringify({elements:kind==='geometry'?[building]:[],osm3s:{timestamp_osm_base:'2026-11-03T00:00:00Z'}}),{headers:{'content-type':'application/json'}});
      };
      window.resetEngine=()=>{const m=new Map();window.engine=RS.createDataLoader({fetch:window.fetch,cache:{get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)},config:{headerMs:250,poiMs:100,idleMs:200,bodyMs:1000,sessionMs:8000,retryMs:5}});RS.loadMap=engine.loadMap;RS.loaderDiagnostics=engine.diagnostics;};resetEngine();
    }''',png)
    await p.click('#load-data');await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building&&document.getElementById("loader").hidden',timeout=20000)
    check('Complete actual loader-to-worker-to-3D pipeline (synthetic network)',await p.evaluate('ReliefStudio.mesh.buildingCount===1&&ReliefStudio.mesh.missed===0'))
    before=await p.evaluate('calls.filter(c=>c.kind!=="terrain").length')
    await p.click('[data-step="0"]');await p.click('#load-data');await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building&&document.getElementById("loader").hidden')
    check('Repeated same-area load uses cached OSM packages',await p.evaluate('calls.filter(c=>c.kind!=="terrain").length')==before)
    await p.click('[data-step="0"]');await p.evaluate("()=>{resetEngine();fault='header';calls=[];}");await p.click('#load-data')
    await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building&&document.getElementById("loader").hidden',timeout=15000)
    check('Stalled first provider recovers to working fallback',await p.evaluate('calls.some(c=>c.url.includes("private.coffee"))&&aborted>0'))
    await p.click('[data-step="0"]');await p.evaluate("()=>{fault='relations';document.getElementById('force-refresh').checked=true;calls=[];}");await p.click('#load-data')
    await p.wait_for_selector('#notice.error');await p.wait_for_selector('#loader',state='hidden')
    check('Required-layer error is not reported as success; previous map retained',await p.evaluate('!!ReliefStudio.data') and '400' in await p.locator('#notice-message').inner_text())
    check('Errors expose both Retry and Diagnose',await p.locator('#notice-action').is_visible() and await p.locator('#notice-diagnose').is_visible())
    async with p.expect_download() as dl:await p.click('#notice-diagnose')
    d=await dl.value;await d.save_as(str(OUT/'network-diagnostic.json'));report=json.loads((OUT/'network-diagnostic.json').read_text())
    check('Network diagnostic contains error layer and failed providers',report['diagnostics']['error']['details']['layer']=='relations' and bool(report['diagnostics']['error']['details']['attemptedProviders']))
    n=await p.evaluate('calls.filter(c=>c.kind==="geometry").length');await p.evaluate("fault='none'");await p.click('#notice-action')
    await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building&&document.getElementById("loader").hidden',timeout=15000)
    check('Retry only fetches missing required packages',await p.evaluate('calls.filter(c=>c.kind==="geometry").length')==n and not await p.locator('#force-refresh').is_checked())
    await p.click('[data-step="0"]');await p.evaluate("()=>{resetEngine();fault='rate';calls=[];}");await p.click('#load-data');await p.wait_for_selector('#notice.error');await p.wait_for_selector('#loader',state='hidden')
    check('HTTP 429 is visible and does not start a provider cascade',await p.evaluate('calls.filter(c=>c.kind!=="terrain").length<=2'))
    n=await p.evaluate('calls.filter(c=>c.kind!=="terrain").length');await p.click('#notice-action');await p.wait_for_selector('#loader',state='hidden')
    check('Immediate Retry respects Retry-After without new OSM requests',await p.evaluate('calls.filter(c=>c.kind!=="terrain").length')==n)
    await p.evaluate("()=>{resetEngine();fault='terrain';calls=[];}");start=time.monotonic();await p.click('#load-data');await p.wait_for_selector('#notice.error');await p.wait_for_selector('#loader',state='hidden')
    check('Broken terrain fails promptly with explicit terrain error',time.monotonic()-start<5 and 'Geländedaten' in await p.locator('#notice-message').inner_text())
    await p.evaluate("()=>{resetEngine();fault='slow';calls=[];}");await p.click('#load-data');await p.wait_for_selector('#loader:not([hidden])');await p.click('#cancel-load');await p.wait_for_selector('#loader',state='hidden');await p.wait_for_timeout(50)
    check('Cancel stops in-flight network and clears queue',await p.evaluate('engine.diagnostics().active===0&&engine.diagnostics().queued===0') and 'abgebrochen' in await p.locator('#notice-message').inner_text())
    await p.evaluate("fault='none'");await p.click('#load-data');await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building&&document.getElementById("loader").hidden',timeout=15000)
    check('Loading remains usable after cancellation',await p.evaluate('!!ReliefStudio.mesh'))
    await p.screenshot(path=str(OUT/'network-scenarios-passed.png'),full_page=True);await p.close()
async def user_scenarios(browser,fixture):
    p=await fresh(browser);await p.set_input_files('#project-file',str(fixture))
    await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building',timeout=120000)
    result=await p.evaluate('({buildings:ReliefStudio.mesh.buildingCount,missed:ReliefStudio.mesh.missed,triangles:ReliefStudio.mesh.indices.length/3,mode:ReliefStudio.mode})')
    expected=len(json.loads(fixture.read_text())['data']['buildings'])
    check('Original Weinheim project imports and builds without dropping buildings',result['buildings']==expected and result['missed']==0,**result)
    await p.screenshot(path=str(OUT/'weinheim-17.png'),full_page=True)
    await p.click('[data-step="3"]')
    for fmt in ['stl','3mf']:
      async with p.expect_download(predicate=lambda d:d.suggested_filename.endswith('.'+fmt)) as dl:await p.click('#export-'+fmt)
      download=await dl.value;dest=OUT/('Weinheim-browser.'+fmt);await download.save_as(str(dest));check('Real browser '+fmt.upper()+' export',dest.stat().st_size>1000,bytes=dest.stat().st_size)
    check('Sources download is separate and explicit',await p.locator('#notice-action').is_visible() and 'Quellen' in await p.locator('#notice-action').inner_text())
    # Test cancellation of a REAL worker; only the already-finished network stage is replayed here.
    await p.click('[data-step="0"]');await p.evaluate('()=>{window.savedLoad=RS.loadMap;RS.loadMap=async()=>structuredClone(ReliefStudio.data);}')
    await p.click('#load-data');await p.wait_for_function('ReliefStudio.building');await p.click('#cancel-load');await p.wait_for_selector('#loader',state='hidden',timeout=3000)
    check('Cancel also stops the real 3D worker after network completion',await p.evaluate('!ReliefStudio.building&&!ReliefStudio.mesh&&workerStats.terminated>0'))
    check('Cancel preserves original loaded Weinheim geometry',await p.evaluate('ReliefStudio.data.buildings.length')==expected)
    await p.click('[data-step="1"]');await p.click('#rebuild-model');await p.wait_for_function('ReliefStudio.building');await p.wait_for_timeout(300)
    await p.locator('[data-setting=modelWidth]').fill('100');await p.locator('[data-setting=modelWidth]').dispatch_event('change');await p.wait_for_timeout(350)
    await p.locator('[data-setting=modelWidth]').fill('200');await p.locator('[data-setting=modelWidth]').dispatch_event('change')
    await p.wait_for_function('ReliefStudio.mesh&&!ReliefStudio.building',timeout=120000)
    check('Rapid setting changes cancel obsolete builds and finish latest model',await p.evaluate('ReliefStudio.settings.modelWidth===200&&ReliefStudio.mesh.buildingCount===ReliefStudio.data.buildings.length&&workerStats.terminated>=2'))
    await p.click('#switch-mode');await p.click('#choose-poster');check('Existing Weinheim data switches to poster without reloading',await p.evaluate('ReliefStudio.mode==="poster"&&ReliefStudio.data.buildings.length')==expected)
    await p.click('[data-step="2"]');await p.select_option('#paper','A4');await p.click('[data-step="3"]');await p.select_option('[data-setting=dpi]','150')
    for fmt in ['pdf','png','jpeg']:
      await p.click('[data-format='+fmt+']');await p.click('#export-poster');await p.wait_for_selector('#export-dialog[open]',timeout=90000)
      async with p.expect_download() as dl:await p.click('#download-ready')
      download=await dl.value;dest=OUT/('Weinheim-poster.'+('jpg' if fmt=='jpeg' else fmt));await download.save_as(str(dest))
      check('Original Weinheim poster '+fmt.upper()+' export',0<dest.stat().st_size<=8000000,bytes=dest.stat().st_size)
    await p.set_input_files('#project-file',{'name':'broken.json','mimeType':'application/json','buffer':b'{broken'})
    await p.wait_for_selector('#notice.error');check('Invalid project import preserves loaded project and exposes Diagnose',await p.locator('#notice-diagnose').is_visible() and await p.evaluate('ReliefStudio.data.buildings.length')==expected)
    async with p.expect_download() as dl:await p.click('#notice-diagnose')
    download=await dl.value;await download.save_as(str(OUT/'import-diagnostic-private.json'));r=json.loads((OUT/'import-diagnostic-private.json').read_text())
    check('Error-download roundtrips structured diagnostic JSON',r['diagnostics']['release']=='17.0.0' and r['diagnostics']['stage']=='Import')
    await p.screenshot(path=str(OUT/'diagnose-17.png'),full_page=True);await p.close()
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  try:
   await network_scenarios(browser)
   fixture=os.environ.get('RELIEF_DIAG_FIXTURE')
   if fixture:await user_scenarios(browser,pathlib.Path(fixture))
   else:print('Private Weinheim fixture not supplied; user-data scenarios not executed.',flush=True)
   check('No unhandled JavaScript runtime errors',not page_errors,errors=page_errors)
  finally:await browser.close()
asyncio.run(main())
