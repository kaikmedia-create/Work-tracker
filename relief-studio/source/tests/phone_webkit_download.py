"""Test the release as used by a phone: select local files and validate exported bytes."""
from pathlib import Path
import json
import struct
import sys
from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve()
url = sys.argv[2]
report = []
with sync_playwright() as pw:
    browser = pw.webkit.launch()
    page = browser.new_page(is_mobile=True, has_touch=True, viewport={'width': 390, 'height': 844}, accept_downloads=True)
    page.goto(url)
    page.fill('#pin','2808')
    page.tap('#submit')
    page.wait_for_selector('body[data-phone]')
    page.tap('#choose-model')
    for mode, ext in [('model', 'stl'), ('poster', 'pdf')]:
        fixture = json.loads((root/'tests'/('fixture-'+mode+'.json')).read_text())
        fixture['settings'].update(mode=mode, autoSubtitle=False, format='pdf')
        fixture['data']['coastlineVersion'] = 8
        testfile = Path('/tmp/phone-fixture-'+mode+'.json')
        testfile.write_text(json.dumps(fixture))
        page.tap('#phone-project')
        with page.expect_file_chooser() as chooser:
            page.tap('#open-project')
        chooser.value.set_files(testfile)
        try:
            page.wait_for_function('ReliefStudio.mode === "'+mode+'" && !!ReliefStudio.data && !ReliefStudio.building'+(' && !!ReliefStudio.mesh' if mode=='model' else ''), polling=100, timeout=45000)
        except Exception:
            print('Notice:',page.locator('#notice').inner_text(),'State:',page.evaluate('({mode:ReliefStudio.mode,building:ReliefStudio.building,hasData:!!ReliefStudio.data})'),flush=True)
            raise
        page.tap('#phone-preview')
        page.tap('#phone-project')
        page.tap('#export-top')
        if mode=='poster':
            page.tap('[data-format=pdf]')
            page.tap('#export-poster')
            page.wait_for_selector('#export-dialog[open]')
        with page.expect_download(timeout=45000) as result:
            page.tap('#export-stl' if mode=='model' else '#download-ready')
        d=result.value
        data=d.path().read_bytes()
        assert d.suggested_filename.endswith('.'+ext)
        assert (len(data)>1000 and len(data)==84+50*struct.unpack_from('<I',data,80)[0]) if mode=='model' else data.startswith(b'%PDF')
        report.append({'format':ext,'bytes':len(data)})
        print(report,flush=True)
    browser.close()
Path('webkit-exports.json').write_text(json.dumps({'engine':'WebKit, simulated phone','downloads':report},indent=2))
