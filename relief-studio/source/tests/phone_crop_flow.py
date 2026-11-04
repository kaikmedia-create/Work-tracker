"""Acceptance against the served, encrypted preview. Public fixture only.
python phone_crop_flow.py http://127.0.0.1:8080/relief-studio/ chromium|webkit OUT
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url, engine, output = sys.argv[1:4]
out = Path(output); out.mkdir(parents=True, exist_ok=True)
checks = []; errors = []

def check(name, result):
    print(name, bool(result), flush=True)
    assert result, name
    checks.append(name)

with sync_playwright() as pw:
    browser = getattr(pw, engine).launch()
    context = browser.new_context(is_mobile=True, has_touch=True, viewport={'width':390,'height':667}, device_scale_factor=1)
    page = context.new_page(); page.set_default_timeout(15000)
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.goto(url); page.fill('#pin','2808'); page.tap('#submit'); page.wait_for_selector('body[data-crop-ui]')
    page.tap('#choose-poster'); page.tap('#phone-preview'); page.wait_for_selector('#phone-crop-action')
    check('primary action in map',page.inner_text('#phone-crop-action')=='Poster erstellen')
    for w,h in ((390,667),(320,568),(844,330)):
        page.set_viewport_size({'width':w,'height':h}); page.wait_for_timeout(250)
        check(f'{w}x{h} map and actions fit',page.evaluate('''() => {const box=id=>document.querySelector(id).getBoundingClientRect(),s=box('#stage'),d=box('#phone-dock');return s.height>=115 && s.top>=0 && s.bottom<=d.top+1 && d.bottom<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth+1}'''))
    page.set_viewport_size({'width':390,'height':667}); page.tap('#phone-map-tools'); page.tap('#phone-map-fit')
    page.evaluate('''()=>{const original=RS.AreaMap.prototype.paint;RS.AreaMap.prototype.paint=function(){window.probeMap=this;return original.apply(this,arguments)};}'''); page.tap('#map-plus'); page.tap('#map-minus'); page.wait_for_function('!!window.probeMap')
    if engine=='chromium':
        client=context.new_cdp_session(page); box=page.locator('#map-canvas').bounding_box(); x=box['x']+box['width']/2; y=box['y']+box['height']/2
        def gesture(kind,points):
            client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i,'x':a,'y':b} for i,a,b in points]});page.wait_for_timeout(50)
        def state():return page.evaluate('''()=>({bounds:probeMap.bounds.slice(),zoom:probeMap.zoom,centre:probeMap.centre.slice()})''')
        s=state();gesture('touchStart',[(1,x-20,y),(2,x+20,y)]);gesture('touchMove',[(1,x-56,y+8),(2,x+60,y+8)]);gesture('touchEnd',[]);t=state()
        check('pinch changes zoom only, keeps crop',s['bounds']==t['bounds'] and t['zoom']>s['zoom']);page.tap('#phone-map-tools');page.tap('#phone-map-fit')
        s=state();gesture('touchStart',[(1,x,y)]);gesture('touchMove',[(1,x+24,y+17)]);gesture('touchCancel',[]);check('cancelled drag restores selection',s['bounds']==state()['bounds'])
        gesture('touchStart',[(1,x,y)]);gesture('touchMove',[(1,x+14,y+12)]);gesture('touchEnd',[]);check('one-finger drag changes selection',s['bounds']!=state()['bounds'])
    page.wait_for_timeout(700);page.screenshot(path=str(out/(engine+'-map.png')))
    tile_ok=page.evaluate("[...probeMap.tiles.values()].some(t=>t.state==='ready')")
    # Real UI action, deterministic network input. Do not require an external Overpass service for CI.
    data=json.loads((Path(__file__).parent/'fixture-poster.json').read_text())['data'];data['coastlineVersion']=8
    page.evaluate('''d=>{window.loadCalls=0;RS.loadMap=async (b)=>{loadCalls++;return {...d,bounds:b,realData:true}}}''',data)
    page.tap('#phone-crop-action');page.wait_for_function("ReliefStudio.data && document.querySelector('#loader').hidden");page.wait_for_function("document.querySelector('#phone-crop-action').textContent==='Zum Export'")
    check('one load per tap',page.evaluate('loadCalls===1'));page.tap('#phone-crop-action');check('export panel accessible',page.is_visible('#panel-export'))
    check('no uncaught browser errors',not errors);browser.close()
(out/(engine+'.json')).write_text(json.dumps({'engine':engine,'checks':checks,'errors':errors,'realBackgroundTiles':tile_ok,'display':'touch emulation, not physical hardware'},indent=2))
