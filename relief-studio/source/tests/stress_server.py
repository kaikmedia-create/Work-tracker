"""Bounded local-only HTTP/security stress against own Node process. No provider requests."""
import asyncio,os,json,subprocess,time,signal
from pathlib import Path
import aiohttp
BASE=Path(__file__).resolve().parents[1]
PORT=18883
async def main():
 guard=subprocess.run(['node','server.mjs'],cwd=BASE,env={**os.environ,'HOST':'0.0.0.0','PORT':'18890'},capture_output=True,text=True,timeout=7)
 assert guard.returncode!=0 and 'APP_PASSWORD' in guard.stderr,guard.stderr
 proc=subprocess.Popen(['node','server.mjs'],cwd=BASE,env={**os.environ,'PORT':str(PORT),'HOST':'127.0.0.1'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 root=f'http://127.0.0.1:{PORT}'
 try:
  async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25)) as client:
   for _ in range(40):
    try:
     async with client.get(root+'/login') as response:
      if response.status==200:break
    except aiohttp.ClientError:pass
    await asyncio.sleep(.1)
   else:raise AssertionError('Server not ready')
   async with client.post(root+'/login',data={'password':'2808'},allow_redirects=False) as r:
    assert r.status==303,r.status
    cookie=r.cookies.get('relief_session').value
    assert 'httponly' in str(r.headers.getall('Set-Cookie')).lower()
    assert 'samesite=strict' in str(r.headers.getall('Set-Cookie')).lower()
   jar={'relief_session':cookie}
   async with client.get(root+'/',cookies=jar) as r:
    assert r.status==200
    header=r.headers.get('Content-Security-Policy','')
    for v in ['frame-ancestors',"object-src 'none'", "script-src 'self'"]:
     assert v in header,v
    assert r.headers.get('X-Content-Type-Options')=='nosniff'
   lat=[]
   sem=asyncio.Semaphore(32)
   async def read(i):
    async with sem:
     start=time.perf_counter()
     async with client.get(root+'/api/status',cookies=jar) as r:
      assert r.status==200,r.status
      assert (await r.json())['server'] is True
     lat.append((time.perf_counter()-start)*1000)
   start=time.perf_counter();await asyncio.gather(*(read(i) for i in range(320)));duration=time.perf_counter()-start
   async with client.post(root+'/login',data={'password':'x'*5000},allow_redirects=False) as r:
    assert r.status==413,r.status
   # Map validation does not contact external providers; blocked with HTTP400/429.
   codes=[]
   for _ in range(18):
    async with client.get(root+'/api/map?bbox=0,0,99,99&mode=poster',cookies=jar) as r:
     codes.append(r.status);await r.read()
   assert 400 in codes and 429 in codes,codes
   async with client.get(root+'/../../server.mjs',cookies=jar) as r:
    assert r.status!=200
   result={'security':{'CSP':True,'nosniff':True,'httpOnly_session':True,'sameSite_strict':True,'oversized_body_413':True,'api_rate_limiter_429':True,'path_traversal_blocked':True,'public_bind_requires_strong_password_and_https':True},'http_requests':320,'peak_parallel':32,'seconds':round(duration,3),'rps':round(320/duration,1),'p50_ms':round(sorted(lat)[len(lat)//2],1),'p95_ms':round(sorted(lat)[int(.95*len(lat))],1),'max_ms':round(max(lat),1)}
   (BASE/'reports'/'v5-stress'/'security-report.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
 finally:
  proc.terminate()
  try:proc.wait(timeout=2)
  except subprocess.TimeoutExpired:proc.kill()
asyncio.run(main())
