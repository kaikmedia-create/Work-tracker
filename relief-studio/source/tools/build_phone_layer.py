"""Build the additive v28 phone patch against the verified v28 application.

The desktop does not fetch phone CSS or JavaScript. The guarded bootstrap is
identical in the source/server app and the verified static preview bundle.
"""
import hashlib
import json
from pathlib import Path

site = Path(__file__).resolve().parents[2]
source = site / 'source'
sha = lambda s: hashlib.sha256(s.encode()).hexdigest()
media = '(hover: none) and (pointer: coarse) and (max-width: 700px), (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1000px) and (max-height: 550px)'

def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise ValueError('Unexpected baseline: ' + str(path))
    path.write_text(text.replace(old, new))

if __name__ == '__main__':
    app = source / 'public/app.js'
    old = app.read_text()
    if sha(old) != json.loads((site/'upgrade28.json').read_text())['changes']['public/app.js']['result']:
        raise ValueError('Requires original verified v28 source')
    token = sha((source/'public/phone-workspace.js').read_text() + (source/'public/phone-workspace.css').read_text())[:12]
    tail = '''
// Optional phone layout. Inactive on desktops, including narrow mouse windows.
;(() => {
 if (typeof matchMedia !== 'function') return;
 const media = matchMedia(MEDIA); let loading = false;
 function activate() {
  if (!media.matches || loading) return;
  loading = true;
  const base = new URL(window.RELIEF_STATIC_PREVIEW ? './source/public/' : './', document.baseURI);
  import(new URL('phone-workspace.js?v=TOKEN',base).href).then(module => {
   module.attachPhoneWorkspace(media,new URL('phone-workspace.css?v=TOKEN',base).href);
   media.removeEventListener('change',activate);
  }).catch(() => { loading = false; }); // the existing responsive UI remains usable
 }
 media.addEventListener('change',activate); activate();
})();
'''.replace('MEDIA',json.dumps(media)).replace('TOKEN',token)
    new = old + tail
    key = 'public/app.js'
    edit = [len(old.split('\n')) - 1, 1, (old.split('\n')[-1]+tail).split('\n')]
    patch = {'version':'28-phone.1','changes':{key:{'base':sha(old),'result':sha(new),'edits':[edit]}}}
    app.write_text(new)
    (site/'upgrade28-phone.json').write_text(json.dumps(patch,ensure_ascii=False,separators=(',',':'))+'\n')
    prepare = source/'tools/prepare_release28.mjs'
    replace(prepare,'for(const [name,chain] of chains){',"const phone=JSON.parse(await readFile(resolve(site,'upgrade28-phone.json'),'utf8'));\nif(phone.version!=='28-phone.1'||Object.keys(phone.changes).join(',')!=='public/app.js')throw Error('Invalid phone patch');\nchains.get('public/app.js').push(phone.changes['public/app.js']);\nfor(const [name,chain] of chains){")
    marker = '   pack.version=28;'
    replace(site/'gate-v28.js',marker,marker+"\n   files['public/app.js'] += "+json.dumps(tail,ensure_ascii=False)+";\n   if(await hash(files['public/app.js'])!=="+json.dumps(sha(new))+")throw Error('Prüfsumme der mobilen Oberfläche stimmt nicht.');")
    entry = site/'index.html'
    css = '@media '+media+'{body{padding:12px;min-height:100svh}.shell{display:block;max-width:460px}.art{padding:16px 20px}.art h1{font-size:26px;margin:8px 0}.art p,.art svg,.art>span{display:none}.login{padding:20px}.login h2{margin-top:12px}input,button{min-height:44px;font-size:16px}.login small{margin-top:10px}}'
    replace(entry,'</style>',css+'</style>');replace(entry,'gate-v28.js?v=28','gate-v28.js?v=28&amp;phone='+token)
