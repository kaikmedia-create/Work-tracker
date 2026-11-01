from pathlib import Path
import re,json,base64
root=Path(__file__).resolve().parents[1]
pub=root/'public'
def standalone(static_preview=False):
 html=(pub/'index.html').read_text()
 css=(pub/'style.css').read_text()
 html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
 svg='data:image/svg+xml;base64,'+base64.b64encode((pub/'favicon.svg').read_bytes()).decode()
 html=html.replace('href="favicon.svg"',f'href="{svg}"').replace('src="favicon.svg"',f'src="{svg}"')
 html=re.sub(r'<link rel="(?:alternate icon|apple-touch-icon)"[^>]*>','',html)
 worker=(pub/'core.js').read_text()+'\n'+(pub/'worker.js').read_text().replace("importScripts('core.js');",'')
 before='<script>window.RS_WORKER_SOURCE='+json.dumps(worker).replace('</','<\\/')+';window.RELIEF_STATIC_PREVIEW='+str(static_preview).lower()+';</script>'
 html=html.replace('<script src="core.js">',before+'<script src="core.js">')
 html=re.sub(r'<script src="([^"]+)\.js"></script>',lambda m:'<script>\n'+(pub/(m.group(1)+'.js')).read_text().replace('</script','<\\/script')+'\n</script>',html)

 assets={'main':(pub/'vendor12/pdf.mjs').read_text(),'worker':(pub/'vendor12/pdf.worker.mjs').read_text()}
 injection='<script>'+ (pub/'vendor12/pdf-lib.min.js').read_text().replace('</script','<\\/script')+'</script><script>window.RS_PDFJS_SOURCES='+json.dumps(assets).replace('</','<\\/')+';</script>'
 html=html.replace('</head>',injection+'</head>')
 return html
if __name__=='__main__':
 (root/'Relief-Studio.html').write_text(standalone(),encoding='utf8')
 print('Standalone', (root/'Relief-Studio.html').stat().st_size)
