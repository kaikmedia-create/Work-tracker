"""Offline Chromium UI-component checks. This does NOT test the production map/export engine.
Run: python tests/studio-simple.browser.py
Requires Python Playwright + Chromium (CHROMIUM_PATH optionally overrides executable).
"""
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'reports'; REPORT.mkdir(exist_ok=True)
# Render entirely in memory: no network, remote browser, or localhost required.
fixture=(ROOT/'tests/studio-simple.fixture.html').read_text()
fixture_script=re.search(r'<script type="module">([\s\S]*?)</script>',fixture).group(1)
fixture_script=re.sub(r"import \{installSimpleStudio,simpleCSS\} from '../public/studio-simple.mjs';",'',fixture_script)
fixture=re.sub(r'<script type="module">[\s\S]*?</script>','',fixture)
module=re.sub(r'^export ', '', (ROOT/'public/studio-simple.mjs').read_text(), flags=re.M)
results=[]
def check(name,ok):
    results.append({'name':name,'passed':bool(ok)})
    assert ok,name
try:
    with sync_playwright() as pw:
        options={'headless':True,'args':['--no-sandbox']}
        executable=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
        if Path(executable).exists():options['executable_path']=executable
        browser=pw.chromium.launch(**options)
        page=browser.new_page(viewport={'width':1440,'height':1000}); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(fixture);page.add_script_tag(content=module);page.add_script_tag(content=fixture_script);page.wait_for_function('window.fixtureReady')
        check('All original control nodes, values, ranges and settings retained',page.evaluate('controlsBefore.every(x=>x.el.isConnected&&x.el.value===x.value&&x.el.checked===x.checked&&x.el.min===x.min&&x.el.max===x.max&&x.el.step===x.step&&x.el.dataset.setting===x.setting)'))
        check('No input events on installation',page.evaluate('inputEvents===0'))
        check('Four road thickness controls remain outside disclosures',page.evaluate("['major','secondary','local','paths'].every(id=>!document.getElementById(id).closest('details'))"))
        for id,value in [('major','3.1'),('secondary','1.7'),('local','0.9'),('paths','0.6')]:
            page.locator('#'+id).focus();page.locator('#'+id).press('ArrowRight')
            check(id+' keeps its original input listener',page.evaluate('inputEvents')==len([r for r in results if 'original input listener' in r['name']])+1)
        count=page.locator('details.simple-details').count();page.evaluate('install()')
        check('DOM installation idempotent',page.locator('details.simple-details').count()==count)
        check('Advanced poster details initially closed',not page.locator('#simple-style-more').evaluate('(el)=>el.open'))
        page.locator('#simple-style-more > summary').click()
        check('Existing custom marker action preserved',page.locator('#marker-add').is_visible())
        page.locator('#marker-add').click();check('Existing marker listener preserved',page.evaluate("clicks['marker-add']===1"))
        check('Redundant Google shortcut hidden',not page.locator('#marker-google').is_visible())
        page.locator('#simple-style-more > summary').click()
        page.locator('#simple-project > summary').click();check('Project menu opens',page.locator('#open-project').is_visible())
        page.locator('#open-project').click();check('Project action keeps listener and closes menu',page.evaluate("clicks['open-project']===1&&!document.getElementById('simple-project').open"))
        check('Focus not trapped in closed menu',page.locator('#simple-project > summary').evaluate('(el)=>document.activeElement===el'))
        page.locator('#simple-project > summary').focus();page.keyboard.press('Enter');page.keyboard.press('Escape')
        check('Project menu keyboard Escape',not page.locator('#simple-project').evaluate('(el)=>el.open'))
        page.locator('#simple-project > summary').click();page.locator('#help').click();check('Project menu closes outside',not page.locator('#simple-project').evaluate('(el)=>el.open'))
        page.evaluate("showPanel('model')")
        check('3D road profile controls remain in main panel',page.evaluate("['road-mode','street-curve','road-relief'].every(id=>!document.getElementById(id).closest('details'))"))
        check('Model width visible without expanding details',page.locator('[data-setting=modelWidth]').is_visible())
        check('Water and technical details collapsed',page.evaluate("['simple-model-more','simple-water-more'].every(id=>!document.getElementById(id).open)"))
        page.evaluate("showPanel('text')")
        check('Typography, paper dimensions and independent whitespace kept in main panel',page.evaluate("['title','subtitle','caption','font','textAlign','paper','paperW','paperH','mapScale','margin'].every(key=>!document.querySelector('[data-setting='+key+']').closest('details'))"))
        page.locator('#simple-text-more > summary').click();check('License warning preserved and accessible',page.locator('#license-warning').is_visible())
        page.evaluate("showPanel('export')")
        check('Export formats and guard reasons remain visible',page.locator('[data-format=pdf]').is_visible() and page.locator('#poster-export-reason').is_visible())
        check('Unavailable exports remain disabled',page.locator('#export-poster').is_disabled() and page.locator('#export-stl').is_disabled() and page.locator('#export-3mf').is_disabled())
        check('DPI and adaptive export are not removed',page.locator('[data-setting=dpi]').count()==1 and page.locator('[data-setting=adaptive]').count()==1)
        page.evaluate("showPanel('style');document.getElementById('marker-lat').value='100';document.getElementById('marker-lat').checkValidity()")
        check('Invalid input opens containing disclosure',page.locator('#simple-style-more').evaluate('(el)=>el.open'))
        page.evaluate("document.getElementById('simple-style-more').open=false")
        for width,height in [(1366,768),(1920,1080),(2560,1440),(768,1024),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate("showPanel('style')")
            check(f'{width}px: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
            if width>760:
                check(f'{width}px: settings are right of preview',page.evaluate("document.querySelector('.sidebar').getBoundingClientRect().left>=document.querySelector('.main').getBoundingClientRect().right-1"))
            check(f'{width}px: road controls have nonzero width',page.locator('#major').bounding_box()['width']>150)
        page.set_viewport_size({'width':1440,'height':1000})
        page.screenshot(path=str(REPORT/'simple-studio-desktop.png'),full_page=True)
        page.locator('#sidebar-toggle').click();check('Collapsing sidebar releases preview width',page.locator('.main').bounding_box()['width']>=1438)
        page.locator('#sidebar-toggle').click()
        # The phone workspace mounts asynchronously and may detach after rotation.
        page.set_viewport_size({'width':390,'height':844});page.evaluate("document.body.dataset.phone=''")
        page.wait_for_function("document.getElementById('open-project').parentElement.classList.contains('header-actions')")
        page.locator('#phone-project').click()
        check('Phone has one project menu, no nested dropdown',not page.locator('#simple-project').is_visible() and page.locator('#open-project').is_visible())
        check('Phone project actions retain original nodes',page.evaluate("document.getElementById('open-project').isConnected"))
        page.locator('#phone-project').click()
        page.evaluate("delete document.body.dataset.phone")
        page.wait_for_function("document.getElementById('open-project').closest('#simple-project')!==null")
        check('Desktop menu restored after phone layout detaches',not page.locator('#simple-project').evaluate('(el)=>el.hidden'))
        page.evaluate('home()');check('Mobile welcome no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(REPORT/'simple-studio-mobile.png'),full_page=True)
        check('No browser JavaScript errors',not errors)
        browser.close()
finally:
    report={'scope':'Offline UI contract fixture; not full application, live maps, geometry or export tests','checks':results,'passed':sum(r['passed'] for r in results),'total':len(results)}
    (REPORT/'simple-studio-browser.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(report,indent=2,ensure_ascii=False))
