"""Run against two locally served checkouts. Never uses private projects or live geodata."""
import json, os, struct, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(os.environ.get('PHONE_RESULTS', 'phone-results')); out.mkdir(exist_ok=True,parents=True)
origin = os.environ.get('PHONE_TEST_ORIGIN','http://127.0.0.1:8788')
root = Path(__file__).resolve().parents[1]
errors=[]; checks=[]
def ok(name,condition):
    print(name, bool(condition), flush=True); assert condition,name; checks.append(name)
def run(context, version, phone=False):
    p=context.new_page();p.set_default_timeout(15000)
    p.on('pageerror',lambda e:errors.append(str(e)))
    context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin+'/') else r.abort())
    p.goto(origin+'/'+version+'/relief-studio/');p.locator('#pin').fill('2808');p.click('#submit');p.wait_for_function('!!window.ReliefStudio');
    if phone:p.wait_for_selector('body[data-phone]')
    return p

def no_overflow(p):return p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
def grab(p,name):
    p.evaluate('document.activeElement.blur()');p.wait_for_timeout(220)
    return p.screenshot(path=str(out/(name+'.png')),animations='disabled',caret='hide')

def main():
  with sync_playwright() as pw:
    kind=os.environ.get('PHONE_ENGINE','chromium');b=getattr(pw,kind).launch(headless=True)
    if kind=='chromium':
      for w,h in [(1440,900),(390,844)]:
        images=[]
        for ver in ['baseline','candidate']:
          c=b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce');p=run(c,ver);start=grab(p,f'{w}-{ver}-start');p.click('#choose-model');editor=grab(p,f'{w}-{ver}-place');images.append([start,editor]);ok(f'{w}/{ver} no phone assets on desktop',p.evaluate("!document.body.hasAttribute('data-phone')&&!performance.getEntriesByType('resource').some(r=>r.name.includes('phone-workspace.'))"));c.close()
        ok(f'{w} desktop screenshots byte-identical',images[0]==images[1])
    for w,h in [(320,568),(390,844),(844,390)]:
      c=b.new_context(has_touch=True,is_mobile=True,viewport={'width':w,'height':h},device_scale_factor=1,accept_downloads=True,reduced_motion='reduce');p=run(c,'candidate',True)
      ok(f'{w} welcome fits',no_overflow(p));p.tap('#choose-model');p.tap('[data-city=weinheim]');p.tap('#phone-preview');p.tap('#map-plus');p.tap('#map-minus');ok(f'{w} map drawn',p.locator('#map-canvas').is_visible());p.tap('#phone-edit')
      p.locator('[data-setting=widthKm]').fill('1.5');p.locator('[data-setting=widthKm]').press('Tab');p.tap('#draw-area');ok(f'{w} draw opens map',p.locator('#map-canvas').is_visible() and p.evaluate('ReliefStudio.settings.widthKm===1.5'));p.tap('#phone-edit');p.tap('#phone-project');ok(f'{w} menu exposes real actions',all(p.is_visible('#'+name) for name in ['new-project','open-project','save-project','export-top']));p.keyboard.press('Escape');ok(f'{w} editor fits',no_overflow(p));
      if w==390:
        p.tap('#phone-preview');p.set_viewport_size({'width':844,'height':390});ok('rotation retains preview and dimensions',p.is_visible('#map-canvas') and p.evaluate('ReliefStudio.settings.widthKm===1.5'));p.set_viewport_size({'width':390,'height':844});p.tap('#phone-edit');
        # Actual file picker, actual worker, actual browser downloads; synthetic repo fixtures.
        for mode,fmt in [('model','stl'),('poster','pdf')]:
          fixture=json.loads((root/'tests'/('fixture-'+mode+'.json')).read_text());fixture['settings'].update({'mode':mode,'autoSubtitle':False,'format':'pdf'});fixture['data']['coastlineVersion']=8
          p.tap('#phone-project');
          with p.expect_file_chooser() as chooser:p.tap('#open-project')
          chooser.value.set_files({'name':'phone-'+mode+'.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
          p.wait_for_function("ReliefStudio.mode==='"+mode+"' && ReliefStudio.data && !ReliefStudio.building"+(' && ReliefStudio.mesh' if mode=='model' else ''),timeout=90000)
          p.tap('#phone-preview');
          if mode=='model':
            p.tap('#nav-in');ok('3D camera zoom changes',p.inner_text('#nav-percent')!='100 %');p.tap('#model-reset');p.tap('#nav-pan');ok('pan mode toggles',p.get_attribute('#nav-pan','aria-pressed')=='true');grab(p,kind+'-model')
          p.tap('#phone-project');p.tap('#export-top');ok(mode+' export panel reachable',p.is_visible('#panel-export'))
          if mode=='poster':p.tap('[data-format=pdf]');p.tap('#export-poster');p.wait_for_selector('#export-dialog[open]')
          with p.expect_download(timeout=60000) as exported:p.tap('#export-stl' if mode=='model' else '#download-ready')
          d=exported.value;raw=d.path().read_bytes();ok(mode+' actual download valid',d.suggested_filename.endswith('.'+fmt) and ((len(raw)==84+50*struct.unpack_from('<I',raw,80)[0] and len(raw)>1000) if fmt=='stl' else raw.startswith(b'%PDF')))
        p.set_input_files('#project-file',{'name':'broken.json','mimeType':'application/json','buffer':b'{bad'});p.wait_for_selector('#notice.error');
        with p.expect_download() as diagnosed:p.tap('#notice-diagnose')
        ok('error diagnosis is downloadable',bool(json.loads(diagnosed.value.path().read_text())['diagnostics']))
      c.close()
    ok('no uncaught JavaScript errors',not errors);b.close();(out/(kind+'.json')).write_text(json.dumps({'engine':kind,'checks':checks,'errors':errors,'device':'browser touch emulation; no physical device'},indent=2))
if __name__=='__main__':main()
