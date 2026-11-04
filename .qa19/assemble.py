from pathlib import Path
import re,json,difflib,hashlib,os
site=Path('relief-studio');staging=Path(os.environ['STAGING']);edits={};patch={'version':19,'changes':{},'sourceChanges':{}};sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
for file in sorted(staging.glob('part*.txt')):
 sections=re.split(r'^@@ ([^\n]+)\n',file.read_text(),flags=re.M)
 for name,body in zip(sections[1::2],sections[2::2]):
  if not re.fullmatch(r'(?:source/(?:public/[\w.]+|tests/v\d+_gate\.test\.mjs|tools/prepare_release19\.mjs|package\.json)|index\.html|gate-v19\.js)',name):raise ValueError(name)
  chunks=re.split(r'^@@@ (\d+) (\d+)\n',body,flags=re.M);edits[name]=[(int(i),int(k),v[:-1]) for i,k,v in zip(chunks[1::3],chunks[2::3],chunks[3::3])]
original={k:(site/k.replace('19.','18.').replace('19_','18_')).read_text() for k in edits}
for name in sorted(edits):
 orig=original[name];new=orig
 for i,n,s in reversed(edits[name]):new=new[:i]+s+new[i+n:]
 if name.startswith('source/public/') or name.startswith('source/tests/') and '19_' not in name:
  a=orig.split('\n');b=new.split('\n');diff=[[i,j-i,b[k:l]] for op,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if op!='equal'];key='changes' if name.startswith('source/public/') else 'sourceChanges';patch[key][name[7:]]={'base':sha(orig),'result':sha(new),'edits':diff}
 (site/name).write_text(new)
packed=json.dumps(patch,ensure_ascii=False,separators=(',',':'))+'\n';assert sha(packed)=='0a1ac83908a4e6ba181ca2436eb739b1a790e40042f8360d08d3aa75bed59bf8',sha(packed);(site/'upgrade19.json').write_text(packed)
m=json.loads((site/'DEPLOYMENT.json').read_text());m.update(version='19.0.0',gate='gate-v19.js',base_commit='6b69f8b58dceeb510f10a9935aeab5c2216b5402',checks={'release':'19.0.0','runner':'npm test; diagnostic19_ui.py; cities19_live.py','liveDataProbeRun':41795513922},source_in_repository='Runtime, source delta and prepare_release19.mjs; public source verified against the released gate.');m['updates'].append('upgrade19.json');(site/'DEPLOYMENT.json').write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
(staging/'selected').write_text('\n'.join('relief-studio/'+x for x in [*edits,'upgrade19.json','DEPLOYMENT.json','RELEASE-NOTES-19.md','source/tests/diagnose19.test.mjs','source/tests/diagnostic19_ui.py','source/tests/cities19_live.py'])+'\n')
