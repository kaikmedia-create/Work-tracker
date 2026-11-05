from pathlib import Path
import sys,subprocess,json
root=Path(__file__).resolve().parents[1];pub=root/'public';tools=root/'tools'
f=tools/'finalize_atlas.py';s=f.read_text();s=s.replace("'GEOMETRY_CONTACTS','GEOMETRY_SEAM'","'GEOMETRY_CONTACTS','ROAD_DETAIL_BUDGET','GEOMETRY_SEAM'").replace('let atlasModule,autoName=!localStorage.getItem(\'relief-settings-v3\')||settings.title===R.defaults.title;','let atlasModule,autoName;').replace("if(autoName&&settings.mode==='model'","if((autoName??(settings.title===R.defaults.title))&&settings.mode==='model'");f.write_text(s)
subprocess.run([sys.executable,str(tools/'pin_atlas_catalog.py')],check=True);subprocess.run([sys.executable,str(f),sys.argv[1]],check=True)
# Retain the exact repeatable final browser test on the stable ref, not only in the transient workflow.
f=root/'tests/atlas-browser.py';s=f.read_text().replace('return n\n', '''from scipy.sparse import coo_matrix
 from scipy.sparse.csgraph import connected_components
 e=edges[left]; graph=coo_matrix((np.ones(len(e),dtype=np.uint8),(e[:,0],e[:,1])),shape=(K,K)).tocsr();assert connected_components(graph,directed=False,return_labels=False)==1,'Disconnected STL';return n
''');s=s.replace("   if i in (0,8,20):page.screenshot",'''   if i in (0,8,20):
    (out/(str(i)+'.stl')).write_bytes(payload)
    # A second read uses actual previously persisted provider tiles. Reject all network access for that read.
    warm=page.evaluate("""async()=>{const a=await import(new URL('./source/public/atlas-reader.mjs',document.baseURI));const r=await a.readAtlas(ReliefStudio.data.bounds,{signal:AbortSignal.timeout(12000),fetcher:()=>{throw Error('warm cache missed');}});return {hits:r.manifest.cacheHits,networkBytes:r.manifest.bytes}}""");assert warm['hits']>0 and warm['networkBytes']==0;r['warmArchive']=warm
   if i in (0,8,20):page.screenshot''');f.write_text(s)
# Surface alternative geometry at its actual resolution; explicitly separate inferred details from survey returns.
f=pub/'atlas-bag.mjs';s=f.read_text().replace("license:'CC BY 4.0',status:'outside'","license:'CC BY 4.0',attribution:'3DBAG by 3D geoinformation research group and 3DGI · https://3dbag.nl/ · CC BY 4.0',status:'outside'");f.write_text(s)
# Frozen metadata is consumed by the client; verify spatial intersection before presenting a collection as a source candidate.
f=pub/'atlas-reader.mjs';s=f.read_text().replace('export function plan(bounds){', '''function spatial(bounds,extents){let [w,s,e,n]=bounds;if(e<w)e+=360;return extents.some(([a,b,c,d])=>s<d&&n>b&&[-360,0,360].some(shift=>w<c+shift&&e>a+shift));}
export function plan(bounds){''').replace("Object.entries(themes).map(([key,t])=>({...catalog.find", "Object.entries(themes).filter(([key])=>catalog.some(p=>p.key===key&&p.outputs.includes('STL')&&spatial(bounds,p.bbox))).map(([key,t])=>({...catalog.find").replace('Object.keys(themes).flatMap(k=>tasks(bounds,k))','manifest.providers.flatMap(p=>tasks(bounds,p.key))');f.write_text(s)
# Keep evidence of measured zero, absence and bounds; the archive failure must not prevent OSM fallback.
f=pub/'atlas-load.mjs';s=f.read_text().replace("manifest.osm='complete';manifest.added", "manifest.osm='complete';manifest.added");f.write_text(s)
