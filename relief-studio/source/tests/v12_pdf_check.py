import fitz,json,math
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
r=Path(__file__).resolve().parents[1]/'reports/v12';checks=[]
for name in ['format-800x600.pdf','browser-three-projects-800x600.pdf','guided-three-cities-800x600.pdf','real-foz-sources-800x600.pdf','browser-foz-mixed-800x600.pdf']:
 d=fitz.open(r/name);p=d[0];w,h=[x*25.4/72 for x in [p.rect.width,p.rect.height]]
 assert len(d)==1 and abs(w-800)<.01 and abs(h-600)<.01
 assert not p.get_images(),name+' has unexpected raster images'
 assert len(p.get_drawings())>1000
 assert len(p.get_text())>60
 p.get_pixmap(matrix=fitz.Matrix(.6,.6)).save(str(r/(Path(name).stem+'.png')))
 checks.append({'file':name,'widthMm':w,'heightMm':h,'imageCount':0,'drawingCount':len(p.get_drawings()),'bytes':(r/name).stat().st_size})
# Verify imported rotations visually, using exact source crop and composed first slot.
for rot in [0,90,180,270]:
 source=fitz.open(r/f'rotation-source-{rot}.pdf');out=fitz.open(r/f'rotation-{rot}.pdf');sp=source[0];op=out[0]
 width,height=800,600;margin,gap=18,10;sw=(width-margin*2-gap*2)/3;sh=height-margin*2
 rw,rh=sp.rect.width,sp.rect.height;f=min(sw/rw,sh/rh);dw,dh=rw*f,rh*f;x=margin+(sw-dw)/2;y=margin+(sh-dh)/2
 target=fitz.Rect(x*72/25.4,y*72/25.4,(x+dw)*72/25.4,(y+dh)*72/25.4)
 a=sp.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False);b=op.get_pixmap(matrix=fitz.Matrix(1,1),clip=target,alpha=False)
 ia=Image.frombytes('RGB',(a.width,a.height),a.samples).resize((300,400))
 ib=Image.frombytes('RGB',(b.width,b.height),b.samples).resize((300,400))
 error=sum(ImageStat.Stat(ImageChops.difference(ia,ib)).mean)/3
 assert error<8,(rot,error)
 checks.append({'rotation':rot,'pixelMeanError':error})
 op.get_pixmap(matrix=fitz.Matrix(.4,.4)).save(str(r/f'rotation-{rot}.png'))
# Raster inputs remain visibly flagged and embedded as raster.
p=fitz.open(r/'raster-warning.pdf')[0];assert len(p.get_images())==1
p=fitz.open(r/'selected-page.pdf')[0];assert p.get_text().count('PAGE 3')==3 and 'PAGE 1' not in p.get_text()
for file in sorted(r.glob('format-*.pdf')):
 w,h=map(float,file.stem.removeprefix('format-').split('x'));p=fitz.open(file)[0]
 assert abs(p.rect.width*25.4/72-w)<.01 and abs(p.rect.height*25.4/72-h)<.01
 assert not p.get_images()
(r/'pdf-preflight.json').write_text(json.dumps({'checks':checks,'rotationComparisons':4,'allFormatPages':len(list(r.glob('format-*.pdf'))),'rasterInputsRetained':True,'selectedPageCorrect':True},indent=2))
print('PDF preflight passed:',len(checks),'detail checks; print dimensions, vector objects, rotations, raster/source pages verified')
