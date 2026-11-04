"""Exercise real public city downloads against the locally served, checksum-verified Relief Studio build. No credentials or private fixtures used."""
import asyncio, json, os, pathlib, struct, sys, zipfile, time
from playwright.async_api import async_playwright

async def main(out):
    out.mkdir(parents=True, exist_ok=True)
    results=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/google-chrome'),args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
        for city,lon,lat,w,h in [('Berlin',13.409,52.521,.36,.36),('Heidelberg',8.706,49.411,.36,.36),('Weinheim',8.6808,49.548,.75,.75),('Weinheim',8.6808,49.548,2.027,1.901)]:
            t=time.monotonic(); rec={'city':city,'km':[w,h],'source':'direct-live-chromium','passed':False}; page=await browser.new_page(accept_downloads=True)
            try:
                await page.goto('http://127.0.0.1:8765/reports/v19/gate-rendered.html')
                await page.wait_for_function("window.ReliefStudio?.version==='19.0.0'"); await page.click('#choose-model')
                for key,value in [('lon',lon),('lat',lat),('widthKm',w),('heightKm',h)]:
                    el=page.locator('[data-setting='+key+']').first;await el.fill(str(value));await el.dispatch_event('change')
                await page.evaluate('n=>{const el=document.querySelector("[data-setting=title]");el.value=n;el.dispatchEvent(new Event("input"));}',city)
                assert (await page.evaluate('()=>[ReliefStudio.settings.widthKm,ReliefStudio.settings.heightKm]'))==[w,h]
                await page.click('#load-data');await page.wait_for_function('(!ReliefStudio.building&&ReliefStudio.mesh&&document.querySelector("#loader").hidden)||document.querySelector("#notice.error:not([hidden])")',timeout=420000)
                if await page.locator('#notice.error:not([hidden])').count():
                    rec['failure']=await page.locator('#notice').inner_text();rec['details']=await page.evaluate('RS.diagnostics.report().diagnostics.error.details')
                else:
                    stats=await page.evaluate('()=>({buildings:ReliefStudio.data.buildings.length,modeled:ReliefStudio.mesh.buildingCount,missed:ReliefStudio.mesh.missed,triangles:ReliefStudio.mesh.indices.length/3,tiles:ReliefStudio.data.terrain.tileCount,load:ReliefStudio.data.loadStats})');rec.update(stats);assert stats['modeled']>0 and stats['missed']==0 and stats['tiles']>0
                    await page.click('[data-step="3"]');rec['exports']={}
                    for fmt in ['stl','3mf']:
                        async with page.expect_download(timeout=120000) as event:await page.click('#export-'+fmt)
                        tmp=pathlib.Path(await (await event.value).path());size=tmp.stat().st_size
                        if fmt=='stl':
                            with tmp.open('rb') as f:f.seek(80);faces=struct.unpack('<I',f.read(4))[0]
                            assert size==84+50*faces
                        else:
                            with zipfile.ZipFile(tmp) as z:assert z.testzip() is None;faces=z.read('3D/3dmodel.model').count(b'<triangle ')
                        assert faces==rec['triangles'];rec['exports'][fmt]={'bytes':size,'triangles':faces}
                    rec['passed']=True
            except Exception as ex:rec['failure']=str(ex)[:600]
            finally:
                rec['seconds']=round(time.monotonic()-t,2);results.append(rec);print(json.dumps(rec,ensure_ascii=False),flush=True);(out/'live.json').write_text(json.dumps(results,indent=2,ensure_ascii=False));await page.close()
            if '429' in rec.get('failure',''):break
        await browser.close()
    if len(results)!=4 or not all(x['passed'] for x in results):raise SystemExit(1)

if __name__=='__main__':asyncio.run(main(pathlib.Path(sys.argv[1])))
