/** Provenance/quality ledger for the canonical official-mode mesh.
 * A tier describes the construction method, NOT absolute real-world accuracy.
 * No estimated numeric confidence is invented for schematic or tagged bodies.
 */
const textOrNull=v=>typeof v==='string'&&v.trim()?v:null;
const finiteOrNull=v=>Number.isFinite(v)?v:null;
const sourceId=s=>textOrNull(s?.url)||textOrNull(s?.provider)||null;
const originalId=id=>/^schematic:(.*):\d+$/.exec(String(id))?.[1]||String(id);

export function buildBuildingEvidence(models,schematicBuildings,settings={}){
 const rows=[];
 for(const m of models){
  const measured=m.source?.method!=='direct-surfaces',tier=measured?'measured':'exact';
  rows.push({
   id:m.id,originalId:m.id,tier,heightTier:tier,method:m.source?.method||'unknown',
   footprintSource:sourceId(m.source),heightSource:sourceId(m.source),roofSource:sourceId(m.source),
   surfaceSource:sourceId(m.source),roofCoverage:finiteOrNull(m.quality?.coverage),
   roofResidualP95M:finiteOrNull(m.quality?.p95Metres),
   manualOverride:false,clippedRemainder:false
  });
 }
 for(const b of schematicBuildings){
  const t=b.tags||{},id=originalId(b.id),clipped=id!==String(b.id);
  const roofTag=textOrNull(t['roof:shape'])||textOrNull(t['building:roof:shape']);
  const detailed=!clipped&&!!b.detailRoof;
  const override=settings.landmarkOverrides?.[id],manualOverride=Number.isFinite(override?.height)||b.heightSource==='Manuell';
  const tier=clipped?'fallback':detailed||roofTag?'inferred':'fallback';
  const heightTier=manualOverride?'inferred':b.measuredHeight?'measured':textOrNull(t.height)||Number(t['building:levels'])>0?'inferred':'fallback';
  rows.push({
   id:b.id,originalId:id,tier,heightTier,
   method:clipped?'clipped-schematic':detailed?'curated-roof-reference':roofTag?'mapped-roof':'schematic',
   footprintSource:textOrNull(b.footprintSource)||(/^(way|relation|node)\//.test(id)?'OpenStreetMap':null),
   heightSource:manualOverride?'Manual override':textOrNull(b.heightSource),
   roofSource:clipped?null:detailed?(textOrNull(b.detailRoof?.ref)||'Provided roof reference'):roofTag?'OpenStreetMap roof tags':null,
   surfaceSource:null,roofCoverage:finiteOrNull(b.measuredHeight?.coverage),
   roofResidualP95M:null,manualOverride,clippedRemainder:clipped,
   landmark:!!b.landmark
  });
 }
 const counts={exact:0,measured:0,inferred:0,fallback:0};
 for(const row of rows)counts[row.tier]++;
 return {schema:'rs-building-evidence-1',counts,buildings:rows};
}
