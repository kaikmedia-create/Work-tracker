#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
node tools/prepare_release28.mjs
python3 tools/global_refinements.py
python3 tools/install_global_cycle.py
npm install --prefix /tmp/rs-vendor --ignore-scripts --no-audit --no-fund esbuild@0.25.12 polygon-clipping@0.15.7 splaytree@3.1.2 robust-predicates@3.0.2
/tmp/rs-vendor/node_modules/.bin/esbuild /tmp/rs-vendor/node_modules/polygon-clipping/dist/polygon-clipping.esm.js --bundle --minify --format=esm --outfile=public/global-overlay.js
for p in polygon-clipping splaytree robust-predicates;do
 dir=/tmp/rs-vendor/node_modules/$p; f=$(find "$dir" -maxdepth 1 \( -iname '*license*' -o -iname '*licence*' -o -iname 'copying*' \) -type f | head -1)
 if [ -z "$f" ];then f=$(find "$dir" -maxdepth 1 -iname 'readme*' -type f|head -1);test -s "$f";grep -iq 'permission is hereby granted' "$f";fi
 test -s "$f";cp "$f" "public/global-$p-LICENSE.txt";done
cp /tmp/rs-vendor/package-lock.json tools/global-vendor-lock.json
python3 - <<'PY'
import urllib.request,json,concurrent.futures,pathlib
release='2026-10-21.0'
def collect(k):
 u=f'https://stac.overturemaps.org/{release}/{k}/collection.json';j=json.load(urllib.request.urlopen(u,timeout=30));assert j['type']=='Collection' and j['license'].lower()=='odbl-1.0',(k,j.get('license'));return k,{'release':release,'license':'ODbL-1.0','use':'geometry','stac':u,'spatialExtent':j['extent']['spatial'],'temporalExtent':j['extent']['temporal'],'acquisition':None}
keys=['buildings/building','buildings/building_part','base/water','base/land','base/land_use','transportation/segment'];p=dict(concurrent.futures.ThreadPoolExecutor(3).map(collect,keys));pathlib.Path('public/global-stac.json').write_text(json.dumps(p,indent=2)+'\n')
PY
node -e 'const fs=require("fs"),p=require("./package.json");p.scripts.test+=" tests/global_cycle.test.mjs";fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
node tools/prepare_release28.mjs
