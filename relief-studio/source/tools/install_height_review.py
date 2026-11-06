from pathlib import Path
import hashlib,json,difflib
site=Path(__file__).resolve().parents[2];pub=site/'source/public'
changes={}
def patch(name,fn):
 p=site/'source'/name;old=p.read_text();new=fn(old);assert new!=old,name
 expected={'public/app.js':'95e24dcc7805d4bc1cdfd772bb4c72faf7febba1501a7adae27eed151c19a4d0','public/index.html':'0e8b646c7e7ece181d75c8aa2bdfa449f11980920b3a1dde7de7c095365574cb'};assert hashlib.sha256(old.encode()).hexdigest()==expected[name],name
 edits=[];a=old.split('\n');b=new.split('\n')
 for tag,i,j,I,J in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
  if tag!='equal':edits.append([i,j-i,b[I:J]])
 changes[name]={'base':hashlib.sha256(old.encode()).hexdigest(),'result':hashlib.sha256(new.encode()).hexdigest(),'edits':edits};p.write_text(new)
def replace(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a));return s.replace(a,b)
def app(s):
 s=replace(s,"const cities={","let heightReviewUI=null;\nconst cities={")
 s=replace(s,"building=true;mesh=null;labels();const inputSettings", "building=true;mesh=null;labels();heightReviewUI?.pending();const inputSettings")
 s=replace(s,"if(id===buildId){building=false;labels();}","if(id===buildId){building=false;labels();heightReviewUI?.update();quality();}")
 s=replace(s,"building=true;mesh=null;labels();buildTimer=setTimeout", "building=true;mesh=null;labels();heightReviewUI?.pending();buildTimer=setTimeout")
 s=replace(s,"})(globalThis.RS);", """// The comparison reports the real height deltas and reuses the existing build path.
import(new URL((globalThis.RELIEF_STATIC_PREVIEW?'source/public/':'')+'height-review.mjs?v=28-review-1',document.baseURI)).then(({createHeightReview})=>{
 heightReviewUI=createHeightReview(R,{getState:()=>({settings,data,mesh,building}),getViewer:()=>viewer,
  showModel:()=>{view('model');$('phone-preview')?.click();},
  changeMode:mode=>{const select=$('city-surface');select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));},
  diagnose:()=>R.diagnostics.download()});
 if(building)heightReviewUI.pending();else heightReviewUI.update();
}).catch(e=>R.diagnostics.event('Höhenvergleich',{status:'unavailable',detail:e.message}));
})(globalThis.RS);""")
 s=replace(s,"p.textContent='Messhöhen-Zusammenführung: '+(f.updated||0)+' Gebäude ergänzt · '","p.textContent='Messhöhen-Zusammenführung: '+(f.comparison?f.comparison.changed+' Höhen geändert, '+f.comparison.confirmed+' bestätigt':(f.updated||0)+' nutzbare Messhöhen')+' · '")
 return s
patch('public/app.js',app)
patch('public/index.html',lambda s:replace(s,'Klassisch bleibt der Standard. Die Kombination übernimmt nur belastbare Gebäudehöhen innerhalb der kartierten Grundrisse. Wände und Dachformen bleiben klar; Baumspitzen, Messlücken und Innenhöfe werden nicht als zusätzliche Häuser modelliert. Verfügbare Messabdeckung wird pro Gebäude geprüft.','Die Kombination korrigiert Gebäudehöhen, nicht die Dachform. In der Vorschau zeigen Änderungszahlen und „Unterschied ansehen“, welche Gebäude sich tatsächlich ändern. „Vorher“ und „Nachher“ behalten den Blickwinkel. Ohne nutzbare Messdaten bleibt das klassische Modell unverändert.'))
manifest={'version':'28-height-review-1','changes':changes};(site/'upgrade28-height-review.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
p=site/'gate-v28.js';s=p.read_text();s=replace(s,"  let html=files['public/index.html'];", """  const reviewPatch=await(await get('upgrade28-height-review.json')).json();if(reviewPatch.version!=='28-height-review-1'||Object.keys(reviewPatch.changes||{}).length!==2)throw Error('Unbekannter Höhenvergleich');for(const name of ['public/app.js','public/index.html']){const c=reviewPatch.changes[name];if(!c||await hash(files[name])!==c.base)throw Error('Höhenvergleich: falscher Ausgangsstand '+name);const lines=files[name].split('\\n');for(const [i,n,a] of c.edits.slice().reverse())lines.splice(i,n,...a);const value=lines.join('\\n');if(await hash(value)!==c.result)throw Error('Höhenvergleich: Prüfsumme '+name);files[name]=value;}
  let html=files['public/index.html'];""");p.write_text(s)
p=site/'source/tools/prepare_release28.mjs';s=p.read_text();s=replace(s,'for(const [name,chain] of chains){', "const review=JSON.parse(await readFile(resolve(site,'upgrade28-height-review.json'),'utf8'));if(review.version!=='28-height-review-1')throw Error('Unknown height review patch');for(const [name,c] of Object.entries(review.changes)){if(!chains.has(name))throw Error('Unknown height review target');chains.get(name).push(c);}\nfor(const [name,chain] of chains){");p.write_text(s)
p=site/'index.html';s=p.read_text();import re
s,n=re.subn(r'(src="gate-v28\.js\?v=28)[^"]*',r'\1-height-review-1',s);assert n==1;p.write_text(s)
p=site/'source/package.json';j=json.loads(p.read_text());j['scripts']['test']+=' tests/height-review.test.mjs';p.write_text(json.dumps(j,indent=2)+'\n')
print('Verified height-review delta generated; numerical geometry unchanged.')
