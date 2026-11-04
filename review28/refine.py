from pathlib import Path
import hashlib,json,difflib,sys
site,base=map(Path,sys.argv[1:3]);a=site/'source/public/architecture.js';s=a.read_text();at='  const model=referenceFor(b),reference=';assert s.count(at)==1;s=s.replace(at,'''  // Never use an arbitrary default height as a ceiling for a documented roof rise.
  const checkedTotal=Number.isFinite(override.height)||metres(tag.height)>0||Number(tag['building:levels'])>0||!['Schätzwert','Standardwert'].includes(b.heightSource)||b.worldSource?.fields?.includes('height');
  if(!checkedTotal&&spec.shape!=='flat'&&!spec.unsupported&&!b.detailRoof){
   const span=Math.min(frame.umax-frame.umin,frame.vmax-frame.vmin)/scale;
   if(!Number.isFinite(spec.roof)&&tag['building:part']==='roof'&&['dome','spherical','onion','round','cone'].includes(spec.shape)){
    spec.roof=R.clamp(span*.5,.10,55);spec.estimatedRoof=true;
   }
   if(Number.isFinite(spec.roof)&&spec.roof>0){const eaves=Math.max(spec.minHeight,Number(b.height)||0,1);spec.total=R.clamp(eaves+spec.roof,.2,1000);stats.estimatedTotals=(stats.estimatedTotals||0)+1;}
  }
'''+at);a.write_text(s)
p=site/'source/public/app.js';s=p.read_text();assert s.count('let count=0;const providers=new Set();')==1;s=s.replace('let count=0;const providers=new Set();','let count=0;const providers=new Set(),changedObjects=new Set();').replace('providers.add(p);count++;','providers.add(p);changedObjects.add(b);count++;').replace('if(!b.worldSource)count++;','if(!changedObjects.has(b))count++;');p.write_text(s)
p=site/'source/tests/world28.test.mjs';s=p.read_text();s+='''\ntest('an explicit roof rise is not flattened to the default building height; known total is retained',()=>{const a=d(),b=house('1',box(.32,.22,.16,.22),{'roof:shape':'gabled','roof:height':'18'});b.height=9;a.buildings=[b];const m=R.buildMesh(a,settings);verifySolid(m);assert.equal(m.architecture.estimatedTotals,1);b.tags.height='22';const known=R.buildMesh(a,settings);verifySolid(known);assert(!known.architecture.estimatedTotals);const max=m=>{let z=-Infinity;for(let i=2;i<m.vertices.length;i+=3)z=Math.max(z,m.vertices[i]);return z;};assert(max(m)>max(known));});\n''';p.write_text(s)
p=site/'RELEASE-NOTES-28.md';p.write_text(p.read_text()+'\nEine explizite Dachhöhe wird nicht auf die Standardhöhe eines unbekannten Gebäudes zusammengestaucht. Ohne bekannte Gesamthöhe bleiben Ansatz und ggf. Höhe eines kartierten gewölbten Dachteils Schätzungen. Eine bekannte Gesamthöhe wird nicht erhöht.\n');p=site/'upgrade28.json';j=json.loads(p.read_text());h=lambda x:hashlib.sha256(x.encode()).hexdigest()
for name in ['public/architecture.js','public/app.js']:
 x=(base/'source'/name).read_text();y=(site/'source'/name).read_text();A=x.split('\n');B=y.split('\n');j['changes'][name]={'base':h(x),'result':h(y),'edits':[[i,k-i,B[l:m]] for op,i,k,l,m in difflib.SequenceMatcher(None,A,B,autojunk=False).get_opcodes() if op!='equal']}
p.write_text(json.dumps(j,ensure_ascii=False,separators=(',',':'))+'\n')
