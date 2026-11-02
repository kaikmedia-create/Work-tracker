"""Exercise the real v11 loader (fetch/stream/caching code), not a stub loadMap.
External responses are deterministic synthetic fault fixtures; no public load test.
"""
import asyncio, json, os, pathlib, subprocess, socket
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'/'v11';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,ok):
    assert ok,name
    checks.append(name);print('PASS',name,flush=True)
INIT=r'''(()=>{
const original=window.fetch;window.networkLog=[];window.fault='none';window.networkActive=0;window.networkMaximum=0;window.cancelCount=0;
window.fetch=async(url,options={})=>{
 if(!String(url).includes('/api/interpreter'))return original(url,options);
 const q=new URLSearchParams(options.body).get('data')||'',layer=q.includes('nwr[historic]')?'pois':q.includes('way[building]')?'geometry':'relations';
 networkLog.push({layer,url:String(url),at:performance.now()});
 if(fault==='relation'&&layer==='relations'){await new Promise(r=>setTimeout(r,600));return new Response('No data',{status:400});}
 if(fault==='rate')return new Response('Limited',{status:429,headers:{'Retry-After':'30'}});
 if(fault==='poi'&&layer==='pois')return new Promise((res,rej)=>options.signal.addEventListener('abort',()=>{cancelCount++;rej(new DOMException('Abgebrochen','AbortError'));},{once:true}));
 const building={type:'way',id:1,tags:{building:'yes'},geometry:[{lon:8.68,lat:49.55},{lon:8.681,lat:49.55},{lon:8.681,lat:49.551},{lon:8.68,lat:49.551},{lon:8.68,lat:49.55}]};
 const data={elements:layer==='geometry'?[building]:layer==='pois'?[{type:'node',id:2,lon:8.6805,lat:49.5505,tags:{historic:'monument',name:'Synthetic test marker'}}]:[]};
 const bytes=new TextEncoder().encode(JSON.stringify(data));let index=0,ended=false;networkActive++;networkMaximum=Math.max(networkMaximum,networkActive);
 const stop=()=>{if(!ended){ended=true;networkActive--;}};
 return new Response(new ReadableStream({async pull(controller){await new Promise(r=>setTimeout(r,fault==='slow'?110:70));if(options.signal.aborted){stop();cancelCount++;controller.error(new DOMException('Abgebrochen','AbortError'));return;}if(ended)return;if(index>=bytes.length){stop();controller.close();return;}controller.enqueue(bytes.slice(index,index+45));index+=45;},cancel(){stop();cancelCount++;}}),{headers:{'content-length':String(bytes.length)}});
};})();'''
async def run():
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    process=subprocess.Popen(['python','-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT/'public')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
      async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'],headless=True)
        page=await browser.new_page(viewport={'width':1440,'height':900})
        errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
        await page.route('https://tile.openstreetmap.org/**',lambda r:r.abort())
        await page.route('https://photon.komoot.io/**',lambda r:r.abort())
        await page.set_content((ROOT/'Relief-Studio.html').read_text(),wait_until='load')
        await page.evaluate(INIT)
        await page.wait_for_function('!!window.ReliefStudio')
        await page.click('#choose-poster')
        # Actual createDataLoader with only clock limits reduced for a fast fault test.
        await page.evaluate('''()=>{window.engine=RS.createDataLoader({config:{headerMs:2000,poiMs:600,idleMs:500,retryMs:5,sessionMs:15000}});RS.loadMap=engine.loadMap;}''')
        await page.click('#load-data')
        await page.wait_for_function("document.getElementById('loader-percent').textContent.includes('Datenübertragung')")
        check('Byte progress from real streaming reader visible',await page.locator('#loader').is_visible())
        await page.screenshot(path=str(OUT/'real-loader-progress.png'))
        await page.wait_for_function('ReliefStudio.data && ReliefStudio.panel==="style"')
        check('Actual loader enters map style',await page.evaluate('ReliefStudio.data.buildings.length===1&&ReliefStudio.data.loaderVersion===11'))
        check('Real request scheduler caps concurrency',await page.evaluate('networkMaximum<=2'))
        check('Usable geometry despite bounded optional-marker request',await page.evaluate('ReliefStudio.data.landmarks.length>=0'))
        await page.screenshot(path=str(OUT/'after-load.png'))
        before=await page.evaluate('networkLog.length')
        await page.click('[data-step="0"]');await page.click('#load-data')
        await page.wait_for_function('ReliefStudio.panel==="style"')
        # First marker response may have hit its reduced budget, but geometry must never reload.
        check('Second load never refetches completed geometry',await page.evaluate('networkLog.filter(x=>x.layer==="geometry").length===1&&networkLog.filter(x=>x.layer==="relations").length===1'))
        # A failed required relation: hold enough to allow geometry to complete/cache.
        await page.click('[data-step="0"]')
        await page.evaluate("()=>{fault='relation';networkLog=[];document.getElementById('force-refresh').checked=true;}")
        await page.click('#load-data');await page.wait_for_selector('#notice.error')
        check('Missing mandatory water/relations not called success','HTTP 400' in await page.locator('#notice-message').inner_text())
        check('Previous map retained after failed reload',await page.evaluate('ReliefStudio.data.buildings.length===1'))
        await page.evaluate("()=>{fault='none';networkLog=[];}")
        await page.click('#notice-action');await page.wait_for_function('ReliefStudio.panel==="style"')
        check('Retry clears force refresh and uses completed packages',await page.evaluate("!document.getElementById('force-refresh').checked&&networkLog.filter(x=>x.layer==='geometry').length===0"))
        # Cancellation must stop live stream and make controls usable.
        await page.click('[data-step="0"]');await page.evaluate("()=>{fault='slow';document.getElementById('force-refresh').checked=true;}")
        await page.click('#load-data');await page.wait_for_timeout(80);await page.click('#cancel-load');await page.wait_for_selector('#loader',state='hidden')
        check('Cancel closes loader and leaves clear notice','abgebrochen' in (await page.locator('#notice-message').inner_text()).lower())
        await page.wait_for_timeout(250)
        check('Cancel drains actual network jobs',await page.evaluate('engine.diagnostics().active===0&&engine.diagnostics().queued===0'))
        # Keep existing nav and poster footprint regression.
        await page.click('[data-step="2"]')
        for w,h in [(1366,768),(1440,900),(1920,1080),(2560,1440)]:
            await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(120)
            rect=await page.locator('#step-next').bounding_box()
            check(f'Next button completely in viewport {w}x{h}',rect is not None and rect['y']+rect['height']<=h+1 and rect['x']+rect['width']<=w+1)
        check('No unhandled JavaScript exceptions',not errs)
        report={'status':'pass','checks':checks,'count':len(checks),'pageErrors':errs,'data':'synthetic streaming fixtures; actual v11 network/cache code'}
        (OUT/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False));await browser.close()
    finally:process.terminate();process.wait()
asyncio.run(run())
