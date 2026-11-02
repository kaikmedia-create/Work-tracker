"""v12: actual browser/worker/export tests with labelled synthetic geometry."""
import asyncio,json,pathlib,subprocess,socket,os
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/v12';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(n,v):
 assert v,n
 checks.append(n);print('PASS',n,flush=True)
async def run():
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 server=subprocess.Popen(['python','-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT/'public')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  async with async_playwright() as pw:
   browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],headless=True)
   page=await browser.new_page(viewport={'width':1536,'height':1000},accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
   async def local_route(route):
    from urllib.parse import urlparse
    u=urlparse(route.request.url)
    if u.netloc=='studio.test':
     path=ROOT/'public'/(u.path.lstrip('/') or 'index.html')
     if path.is_file():
      await route.fulfill(path=str(path),content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}.get(path.suffix,'application/octet-stream'));return
    await route.abort()
   await page.route('**/*',local_route)
   await page.set_content(pathlib.Path(os.environ.get('RELIEF_TEST_HTML',str(ROOT/'Relief-Studio.html'))).read_text(),wait_until='load');await page.wait_for_function('!!window.ReliefStudio')
   fixture=await page.evaluate('''()=>{
    const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],circle=(x,y,r)=>Array.from({length:33},(_,i)=>[x+r*Math.cos(i/32*2*Math.PI),y+r*Math.sin(i/32*2*Math.PI)]);
    const b=(id,rings,tags)=>({id,name:id,rings,tags,height:Number(tags.height),heightSource:'OSM-Höhe',landmark:/kirche|turm|mauer/i.test(id)});
    const nave=b('Testkirche',[rect(.18,.16,.58,.18)],{height:'20',building:'church','roof:shape':'gabled','roof:height':'8'});
    const tower=b('Testturm',[rect(.19,.18,.11,.14)],{height:'42','building:part':'tower','roof:shape':'pyramidal','roof:height':'14'});nave.partIds=['Testturm'];
    const data={version:2,bounds:RS.boundsFor(8.68,49.54,.35,.35),terrain:{cols:2,rows:2,values:[10,10,10,10],source:'SYNTHETISCHER GEOMETRIETEST'},buildings:[nave,tower,b('Innenhof',[rect(.18,.48,.24,.21),rect(.24,.53,.12,.10)],{height:'12','roof:shape':'flat'}),b('Rundturm',[circle(.73,.62,.06)],{height:'26',man_made:'tower'}),b('Ringmauer',[rect(.48,.49,.19,.31),rect(.50,.51,.15,.27)],{height:'6','roof:shape':'flat','rs:wall':'yes'}),b('Kuppel',[circle(.26,.84,.07)],{height:'16','roof:shape':'dome','roof:height':'9'})],roads:[],water:[],parks:[],landmarks:[],warnings:['Synthetischer Architekturtest, keine reale Stadt.'],realData:false,architectureSourceVersion:12};
    return {version:3,settings:{...RS.defaults,title:'Architekturtest',subtitle:'SYNTHETISCHE GEOMETRIE · KEINE REALE STADT',autoSubtitle:false,mode:'model',modelWidth:200,resolution:65,terrainFactor:1,frame:3},data};
   }''')
   (OUT/'architecture-fixture.relief.json').write_text(json.dumps(fixture))
   await page.set_input_files('#project-file',str(OUT/'architecture-fixture.relief.json'))
   await page.wait_for_timeout(3000)
   await page.wait_for_function('ReliefStudio.mesh?.kind==="architecture"&&!ReliefStudio.building',timeout=30000)
   check('Actual worker builds architecture mesh',await page.evaluate('ReliefStudio.mesh.architectureVersion===12'))
   check('Tower, nave, courtyard and ring wall included',await page.evaluate('ReliefStudio.mesh.architecture.buildings===6&&ReliefStudio.mesh.architecture.parts===1'))
   check('No visible building-exaggeration sliders',await page.locator('#building-factor').count()==0 and await page.locator('#landmark-factor').count()==0 and await page.locator('[data-setting=resolution]').count()==0)
   check('Only optional terrain slider remains',await page.locator('#panel-model input[type=range]').count()==1 and not await page.locator('#terrain-factor').is_visible())
   await page.screenshot(path=str(OUT/'architecture-interface.png'))
   await page.locator('#view-model').screenshot(path=str(OUT/'architecture-detail.png'))
   check('Browser reports tagged roofs honestly','modellierte Dachformen' in await page.locator('#quality-content').text_content())
   await page.click('#export-top')
   async with page.expect_download(predicate=lambda d:d.suggested_filename.endswith('.stl')) as d:await page.click('#export-stl')
   dl=await d.value;await dl.save_as(str(OUT/'architecture-browser.stl'))
   check('STL download contains actual geometry',(OUT/'architecture-browser.stl').stat().st_size>10000)
   async with page.expect_download(predicate=lambda d:d.suggested_filename.endswith('.3mf')) as d:await page.click('#export-3mf')
   dl=await d.value;await dl.save_as(str(OUT/'architecture-browser.3mf'))
   check('3MF exported',(OUT/'architecture-browser.3mf').stat().st_size>10000)
   for w,h in [(1366,768),(1920,1080),(2560,1440)]:
    await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(130)
    dims=await page.locator('#step-next').bounding_box()
    check(f'Footer fully visible at {w}x{h}',bool(dims) and dims['y']+dims['height']<=h+1)
    check(f'No page overflow at {w}x{h}',await page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'))
   await page.close();page=await browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/*',local_route)
   # Verify that standalone uses the same architecture worker code, not the old raster.
   await page.set_content((ROOT/'Relief-Studio.html').read_text());await page.wait_for_function('!!window.ReliefStudio')
   await page.set_input_files('#project-file',str(OUT/'architecture-fixture.relief.json'))
   await page.wait_for_function('ReliefStudio.mesh?.architectureVersion===12&&!ReliefStudio.building',timeout=30000)
   check('Standalone architecture worker works',await page.evaluate('ReliefStudio.mesh.architecture.buildings===6'))
   print('ERRORS',errors,flush=True);check('No unhandled JavaScript exceptions',not errors)
   await browser.close()
 finally:server.terminate()
 (OUT/os.environ.get('RELIEF_BROWSER_REPORT','browser.json')).write_text(json.dumps({'checks':checks,'errors':errors},indent=2))
asyncio.run(run())
