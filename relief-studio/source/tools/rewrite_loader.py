from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/data.js'
old=p.read_text();Path('/mnt/data/data-v10-original.js').write_text(old)
# Retain location lookup, terrain conversion and the public compatibility API.
geo=old[old.index('async function searchPlace'):old.index('async function getOSMLayer')]
terrain=old[old.index('function tileXY'):old.index('async function loadMap')]
Path('/mnt/data/geo11.txt').write_text(geo)
Path('/mnt/data/terrain11.txt').write_text(terrain)
