"""Create deterministic synthetic files; never require or publish customer posters."""
from pathlib import Path
import fitz
from PIL import Image
r=Path(__file__).resolve().parents[1]/'reports/v12';r.mkdir(parents=True,exist_ok=True)
d=fitz.open();p=d.new_page(width=200,height=300);p.insert_text((30,40),'Protected synthetic fixture')
d.save(r/'encrypted.pdf',encryption=fitz.PDF_ENCRYPT_AES_256,owner_pw='test-owner',user_pw='test-user');d.close()
Image.new('RGB',(300,450),(230,236,232)).save(r/'raster-fixture.jpg',quality=95)
